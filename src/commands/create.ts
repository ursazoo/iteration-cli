/**
 * 创建迭代命令 - 基于inquirer.js实现交互式界面
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { GitUtils, ComponentSuggestion, FunctionSuggestion } from '../utils/git.js';
import { GreatWallApiClient } from '../lib/greatwall-client.js';
import { GreatWallApiManager } from '../lib/greatwall-services.js';
import {
  IterationBasicInfo,
  UserInfo,
  ComponentModule,
  FunctionModule,
  GreatWallProjectGroup
} from '../types/index.js';

const configManager = new ConfigManager();

interface CreateOptions {
  dir?: string;
}

export async function createIteration(options: CreateOptions) {
  console.log(chalk.blue.bold('🚀 长城后端迭代创建工具'));
  console.log(chalk.gray('═'.repeat(50)));

  const workDir = options.dir || process.cwd();
  console.log(chalk.cyan(`📂 工作目录: ${workDir}\n`));

  try {
    // 1. 获取Git信息
    const gitInfo = await getGitInfo(workDir);

    // 2. 初始化API管理器
    const apiManager = await initializeApiManager();

    // 3. 获取基础数据
    const { users, projectGroups } = await fetchBaseData(apiManager);

    // 4. 开始交互式创建流程
    const iterationData = await createIterationFlow(gitInfo, users, projectGroups, apiManager);

    console.log('🔍 createIterationFlow返回的数据:');
    console.log('  sprintId:', iterationData.sprintId, '(类型:', typeof iterationData.sprintId, ')');
    console.log('  iterationData keys:', Object.keys(iterationData));

    // 5. 创建CR申请单
    await submitCrRequest(apiManager, iterationData.sprintId, iterationData);

    console.log(chalk.green.bold('\n🎉 迭代和CR申请单创建完成！'));

  } catch (error) {
    console.error(chalk.red.bold('\n❌ 迭代或CR申请单创建失败:'), (error as Error).message);
    process.exit(1);
  }
}


/**
 * 获取Git信息
 */
async function getGitInfo(workDir: string) {
  const spinner = ora('获取Git信息...').start();
  
  try {
    const gitUtils = new GitUtils(workDir);
    const gitInfo = await gitUtils.getGitInfo();
    
    spinner.succeed(`Git信息获取完成 (${gitInfo.isGitRepository ? '✓' : '✗'} Git仓库)`);
    
    if (gitInfo.isGitRepository) {
      console.log(chalk.cyan(`  项目: ${gitInfo.projectName}`));
      console.log(chalk.cyan(`  分支: ${gitInfo.currentBranch}`));
      if (gitInfo.projectUrl) {
        console.log(chalk.cyan(`  仓库: ${gitInfo.projectUrl}`));
      }
    }
    
    return gitInfo;
  } catch (error) {
    spinner.warn('Git信息获取部分失败');
    return {
      projectName: 'unknown-project',
      projectUrl: '',
      currentBranch: 'main',
      isGitRepository: false
    };
  }
}

/**
 * 初始化API管理器
 */
async function initializeApiManager() {
  const spinner = ora('初始化API连接...').start();
  
  const config = await configManager.getConfig();
  const apiManager = new GreatWallApiManager({
    baseUrl: config.apiBaseUrl,
    apiKey: config.apiKey
  });
  
  spinner.succeed('API连接初始化完成');
  return apiManager;
}

/**
 * 获取基础数据
 */
async function fetchBaseData(apiManager: GreatWallApiManager) {
  const spinner = ora('获取基础数据...').start();
  
  try {
    const [users, projectGroups] = await Promise.all([
      apiManager.user.getAllUsers(),
      apiManager.project.getProjectGroupList()
    ]);
    
    spinner.succeed(`基础数据获取完成 (${users.length} 名用户, ${projectGroups.length} 个项目组)`);
    return { users, projectGroups };
  } catch (error) {
    spinner.fail('基础数据获取失败');
    throw error;
  }
}

/**
 * 交互式创建流程
 */
async function createIterationFlow(gitInfo: any, users: any[], projectGroups: GreatWallProjectGroup[], apiManager: GreatWallApiManager) {
  console.log(chalk.blue('\n📝 开始创建迭代和CR申请单...\n'));

  // 第一步：基础信息收集
  const basicInfo = await collectBasicInfo(users, projectGroups, gitInfo);
  
  // 立即创建迭代
  const sprintId = await createSprintImmediately(apiManager, basicInfo);
  
  // 第二步：项目信息收集
  const projectInfo = await collectProjectInfo(users, gitInfo);
  
  // 第三步：组件模块收集
  const componentModules = await collectComponentModules(users, gitInfo);
  
  // 第四步：功能模块收集
  const functionModules = await collectFunctionModules(users, gitInfo);
  
  // 第五步：确认CR申请单信息
  const confirmed = await confirmCrRequestInformation({
    sprintId,
    basicInfo,
    projectInfo,
    componentModules,
    functionModules
  });
  
  if (!confirmed) {
    console.log(chalk.yellow('❌ CR申请单创建已取消'));
    process.exit(0);
  }

  return {
    sprintId,
    basicInfo,
    projectInfo,
    componentModules,
    functionModules
  };
}

/**
 * 收集基础信息
 */
async function collectBasicInfo(users: any[], projectGroups: GreatWallProjectGroup[], gitInfo: any) {
  console.log(chalk.yellow('📋 第一步：基础信息 (收集后立即创建迭代)'));
  
  const projectChoices = projectGroups.map(group => ({
    name: `${group.name} (ID: ${group.id})`,
    value: group.id
  }));

  const userChoices = users.map(user => ({
    name: `${user.name} (ID: ${user.id})`,
    value: user.id
  }));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'projectLine',
      message: '选择项目组:',
      choices: projectChoices,
      pageSize: 12,
      when: projectChoices.length > 0
    },
    {
      type: 'input',
      name: 'projectLine',
      message: '输入项目线名称:',
      when: projectChoices.length === 0,
      validate: (input) => input.trim().length > 0 || '请输入项目线名称'
    },
    {
      type: 'input',
      name: 'iterationName',
      message: '迭代名称:',
      default: `v1.0.0 ${gitInfo.projectName} 迭代`,
      validate: (input) => input.trim().length > 0 || '请输入迭代名称'
    },
    {
      type: 'input',
      name: 'onlineTime',
      message: '上线时间 (YYYY-MM-DD):',
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 14); // 默认两周后
        return date.toISOString().split('T')[0];
      },
      validate: (input) => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(input) || '请输入正确的日期格式 (YYYY-MM-DD)';
      }
    },
    {
      type: 'list',
      name: 'createUserId',
      message: '选择创建人:',
      choices: userChoices,
      pageSize: 12,
      when: userChoices.length > 0
    },
    {
      type: 'input',
      name: 'remarks',
      message: '备注信息 (可选):'
    }
  ]);

  return answers as IterationBasicInfo;
}

/**
 * 立即创建迭代
 */
async function createSprintImmediately(apiManager: GreatWallApiManager, basicInfo: any): Promise<number> {
  const spinner = ora('正在创建迭代...').start();
  
  try {
    const sprintParams = {
      projectId: parseInt(basicInfo.projectLine),
      name: basicInfo.iterationName,
      releaseTime: basicInfo.onlineTime,
      remark: basicInfo.remarks || '',
      createUserId: parseInt(basicInfo.createUserId)
    };
    
    // console.log(chalk.yellow('🔍 调用createSprint接口的参数:'));
    // console.log('传入的basicInfo:', JSON.stringify(basicInfo, null, 2));
    // console.log('构造的sprintParams:', JSON.stringify(sprintParams, null, 2));
    
    const sprintResult = await apiManager.project.createSprint(sprintParams);
    console.log('🔍 完整的API响应结构:', JSON.stringify(sprintResult, null, 2));
    
    // HTTP客户端已经解包了data字段，直接访问sprintResult.id
    const sprintId = sprintResult.id;
    console.log('🔍 提取的sprintId:', sprintId);
    console.log('🔍 sprintResult对象keys:', Object.keys(sprintResult));
    
    if (!sprintId) {
      spinner.fail('迭代创建失败: 无法获取迭代ID');
      throw new Error('迭代创建失败: API响应中缺少迭代ID');
    }
    
    spinner.succeed(`迭代创建成功 (ID: ${sprintId})`);
    console.log(chalk.green(`✅ 迭代"${basicInfo.iterationName}"已创建`));
    console.log(chalk.cyan(`   迭代ID: ${sprintId}`));
    console.log(chalk.cyan(`   上线时间: ${basicInfo.onlineTime}`));
    
    console.log('🔍 createSprintImmediately函数返回的sprintId:', sprintId);
    return sprintId;
  } catch (error) {
    spinner.fail('迭代创建失败');
    console.error(chalk.red('❌ 错误详情:'), (error as Error).message);
    throw error;
  }
}

/**
 * 收集项目信息
 */
async function collectProjectInfo(users: any[], gitInfo: any) {
  console.log(chalk.yellow('\n📋 第二步：项目信息 (为CR申请单收集详细信息)'));

  const userChoices = users.map(user => ({
    name: user.name,
    value: user.id
  }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'productDoc',
      message: '产品文档链接:',
      default: '-'
    },
    {
      type: 'input',
      name: 'technicalDoc', 
      message: '技术文档链接:',
      default: '-'
    },
    {
      type: 'input',
      name: 'projectDashboard',
      message: '项目大盘链接:',
      default: '-'
    },
    {
      type: 'input',
      name: 'designDoc',
      message: '设计文档链接:',
      default: '-'
    },
    {
      type: 'input',
      name: 'gitProjectUrl',
      message: 'Git项目地址:',
      default: gitInfo.projectUrl || ''
    },
    {
      type: 'input',
      name: 'gitProjectName',
      message: 'Git项目名称:',
      default: gitInfo.projectName || ''
    },
    {
      type: 'input',
      name: 'developmentBranch',
      message: '开发分支:',
      default: gitInfo.currentBranch || 'main'
    },
    {
      type: 'checkbox',
      name: 'participants',
      message: '选择参与人员:',
      choices: userChoices,
      pageSize: 12,
      validate: (answer) => answer.length > 0 || '请至少选择一名参与人员'
    },
    {
      type: 'checkbox',
      name: 'checkUsers',
      message: '选择审核人员:',
      choices: userChoices,
      pageSize: 12,
      validate: (answer) => answer.length > 0 || '请至少选择一名审核人员'
    },
    {
      type: 'number',
      name: 'workHours',
      message: '预估工时 (小时):',
      default: 40,
      validate: (input) => input > 0 || '请输入有效的工时数'
    },
    {
      type: 'input',
      name: 'remarks',
      message: '项目备注 (可选):'
    }
  ]);

  return answers;
}

/**
 * 收集组件模块 - 基于Git差异分析
 */
async function collectComponentModules(users: any[], gitInfo: any): Promise<ComponentModule[]> {
  console.log(chalk.yellow('\n📋 第三步：组件模块 (基于Git差异智能分析)'));

  const userChoices = users.map(user => ({
    name: user.name,
    value: user.id
  }));

  // 1. 获取Git差异分析
  const gitUtils = new GitUtils();
  const diffFiles = await gitUtils.getBranchDiffFiles();
  const { suggestedComponents } = gitUtils.analyzeDiffForModules(diffFiles);

  const components: ComponentModule[] = [];

  if (suggestedComponents.length === 0) {
    console.log(chalk.gray('📂 未检测到组件文件变更'));
    
    const { hasComponents } = await inquirer.prompt([{
      type: 'confirm',
      name: 'hasComponents',
      message: '是否需要手动添加组件模块？',
      default: false
    }]);

    if (!hasComponents) return components;

    // 回退到手动添加模式
    return await collectComponentsManually(userChoices);
  }

  console.log(chalk.blue(`🎯 检测到 ${suggestedComponents.length} 个组件变更文件`));

  // 2. 智能选择界面
  const componentChoices = suggestedComponents.map(comp => {
    const statusIcon = getStatusIcon(comp.status);
    const statusText = getStatusText(comp.status);
    
    return {
      name: `${statusIcon} ${comp.relativePath} (${statusText})`,
      value: comp,
      checked: comp.status === 'A' || comp.status === 'M' // 新增和修改默认选中
    };
  });

  if (componentChoices.length > 0) {
    const { selectedComponents } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedComponents',
      message: '选择需要包含的组件模块:',
      choices: componentChoices,
      pageSize: 12,
      validate: (choices) => choices.length > 0 || '请至少选择一个组件或选择手动添加'
    }]);

    // 3. 为选中的组件分配审核人员
    for (const suggestion of selectedComponents) {
      let checkUser = userChoices.length > 0 ? userChoices[0].value : '1'; // 默认第一个用户

      if (userChoices.length > 1) {
        const { selectedUser } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedUser',
          message: `${suggestion.relativePath} - 选择审核人员:`,
          choices: userChoices,
          pageSize: 12
        }]);
        checkUser = selectedUser;
      }

      // 提取最后一层有意义的目录名作为组件名称
      const pathParts = suggestion.relativePath.split('/');
      let componentName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, ''); // 去掉扩展名
      
      // 如果是index文件，使用父目录名
      if (componentName.toLowerCase() === 'index') {
        componentName = pathParts[pathParts.length - 2] || 'index';
      }
      
      components.push({
        name: componentName,
        relativePath: suggestion.relativePath,
        checkUser: checkUser.toString(),
        url: '' // 可以后续优化为自动推测
      });
    }
  }

  // 4. 询问是否手动添加更多组件
  const { addMore } = await inquirer.prompt([{
    type: 'confirm',
    name: 'addMore',
    message: '是否需要添加其他未检测到的组件？',
    default: false
  }]);

  if (addMore) {
    const manualComponents = await collectComponentsManually(userChoices);
    components.push(...manualComponents);
  }

  return components;
}

/**
 * 获取文件状态图标
 */
function getStatusIcon(status: 'A' | 'M' | 'D' | 'R' | 'C'): string {
  switch (status) {
    case 'A': return '🟢'; // 新增
    case 'M': return '🟡'; // 修改
    case 'D': return '🔴'; // 删除
    case 'R': return '🔄'; // 重命名
    case 'C': return '📋'; // 复制
    default: return '❓';
  }
}

/**
 * 获取文件状态文本
 */
function getStatusText(status: 'A' | 'M' | 'D' | 'R' | 'C'): string {
  switch (status) {
    case 'A': return '新增';
    case 'M': return '修改';
    case 'D': return '删除';
    case 'R': return '重命名';
    case 'C': return '复制';
    default: return '未知';
  }
}

/**
 * 手动添加组件模式 (备选方案)
 */
async function collectComponentsManually(userChoices: any[]): Promise<ComponentModule[]> {
  const components: ComponentModule[] = [];
  
  let addMore = true;
  while (addMore) {
    console.log(chalk.cyan(`\n手动添加第 ${components.length + 1} 个组件:`));
    
    const component = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '组件名称:',
        validate: (input) => input.trim().length > 0 || '请输入组件名称'
      },
      {
        type: 'input',
        name: 'relativePath',
        message: '组件相对路径:',
        validate: (input) => input.trim().length > 0 || '请输入组件路径'
      },
      {
        type: 'list',
        name: 'checkUser',
        message: '选择审核人员:',
        choices: userChoices,
        pageSize: 12,
        when: userChoices.length > 0
      },
      {
        type: 'input',
        name: 'url',
        message: '组件访问地址 (可选):'
      }
    ]);

    components.push(component as ComponentModule);

    const { continueAdding } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueAdding',
      message: '是否继续添加组件？',
      default: false
    }]);

    addMore = continueAdding;
  }

  return components;
}

/**
 * 收集功能模块 - 基于Git差异分析
 */
async function collectFunctionModules(users: any[], gitInfo: any): Promise<FunctionModule[]> {
  console.log(chalk.yellow('\n📋 第四步：功能模块 (基于Git差异智能分析)'));

  const userChoices = users.map(user => ({
    name: user.name,
    value: user.id
  }));

  // 1. 获取Git差异分析
  const gitUtils = new GitUtils();
  const diffFiles = await gitUtils.getBranchDiffFiles();
  const { suggestedFunctions } = gitUtils.analyzeDiffForModules(diffFiles);

  const functions: FunctionModule[] = [];

  if (suggestedFunctions.length === 0) {
    console.log(chalk.gray('📂 未检测到功能模块文件变更'));
    
    const { hasFunctions } = await inquirer.prompt([{
      type: 'confirm',
      name: 'hasFunctions',
      message: '是否需要手动添加功能模块？',
      default: false
    }]);

    if (!hasFunctions) return functions;

    // 回退到手动添加模式
    return await collectFunctionsManually();
  }

  console.log(chalk.blue(`🎯 检测到 ${suggestedFunctions.length} 个功能模块变更文件`));

  // 2. 按分类分组显示
  const categorizedSuggestions = suggestedFunctions.reduce((acc, func) => {
    if (!acc[func.category]) acc[func.category] = [];
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, FunctionSuggestion[]>);

  const functionChoices: any[] = [];

  // 添加分类分隔符和选项 (简化显示)
  Object.entries(categorizedSuggestions).forEach(([category, funcs]) => {
    const categoryName = getCategoryDisplayName(category);
    functionChoices.push(new inquirer.Separator(`== ${categoryName} ==`));
    
    funcs.forEach(func => {
      const statusIcon = getStatusIcon(func.status);
      const statusText = getStatusText(func.status);
      
      functionChoices.push({
        name: `${statusIcon} ${func.relativePath} (${statusText})`,
        value: func,
        checked: func.status === 'A' || func.status === 'M' // 新增和修改默认选中
      });
    });
  });

  if (functionChoices.length > 0) {
    const { selectedFunctions } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedFunctions',
      message: '选择需要包含的功能模块:',
      choices: functionChoices,
      pageSize: 12
    }]);

    // 3. 为选中的功能分配审核人员
    for (const suggestion of selectedFunctions) {
      let checkUser = userChoices.length > 0 ? userChoices[0].value : '1'; // 默认第一个用户

      if (userChoices.length > 1) {
        const { selectedUser } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedUser',
          message: `${suggestion.relativePath} - 选择审核人员:`,
          choices: userChoices,
          pageSize: 12
        }]);
        checkUser = selectedUser;
      }

      // 提取最后一层有意义的目录名作为功能名称
      const pathParts = suggestion.relativePath.split('/');
      let functionName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, ''); // 去掉扩展名
      
      // 如果是index文件，使用父目录名
      if (functionName.toLowerCase() === 'index') {
        functionName = pathParts[pathParts.length - 2] || 'index';
      }
      
      functions.push({
        name: functionName,
        relativePath: suggestion.relativePath,
        checkUser: checkUser.toString(),
        description: suggestion.relativePath
      });
    }
  }

  // 4. 询问是否手动添加更多功能
  const { addMore } = await inquirer.prompt([{
    type: 'confirm',
    name: 'addMore',
    message: '是否需要添加其他未检测到的功能？',
    default: false
  }]);

  if (addMore) {
    const manualFunctions = await collectFunctionsManually();
    functions.push(...manualFunctions);
  }

  return functions;
}

/**
 * 获取分类显示名称
 */
function getCategoryDisplayName(category: string): string {
  const categoryNames: Record<string, string> = {
    'pages': '页面模块',
    'api': 'API服务',
    'utils': '工具函数',
    'store': '状态管理',
    'features': '功能模块',
    'other': '其他变更'
  };
  return categoryNames[category] || category;
}

/**
 * 手动添加功能模式 (备选方案)
 */
async function collectFunctionsManually(): Promise<FunctionModule[]> {
  const functions: FunctionModule[] = [];
  
  let addMore = true;
  while (addMore) {
    console.log(chalk.cyan(`\n手动添加第 ${functions.length + 1} 个功能:`));
    
    const func = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '功能名称:',
        validate: (input) => input.trim().length > 0 || '请输入功能名称'
      },
      {
        type: 'input',
        name: 'relativePath',
        message: '功能相对路径:',
        validate: (input) => input.trim().length > 0 || '请输入功能路径'
      },
      {
        type: 'input',
        name: 'checkUser',
        message: '审核人员ID:',
        default: '1',
        validate: (input) => input.trim().length > 0 || '请输入审核人员ID'
      },
      {
        type: 'input',
        name: 'description',
        message: '功能描述:'
      }
    ]);

    functions.push(func as FunctionModule);

    const { continueAdding } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueAdding',
      message: '是否继续添加功能？',
      default: false
    }]);

    addMore = continueAdding;
  }

  return functions;
}

/**
 * 确认CR申请单信息
 */
async function confirmCrRequestInformation(data: any): Promise<boolean> {
  console.log(chalk.yellow('\n📋 第五步：确认CR申请单信息'));
  console.log(chalk.gray('─'.repeat(50)));

  // 显示已创建的迭代信息
  console.log(chalk.green('✅ 已创建的迭代:'));
  console.log(`  迭代ID: ${chalk.cyan(data.sprintId)}`);
  console.log(`  迭代名称: ${chalk.cyan(data.basicInfo.iterationName)}`);
  console.log(`  上线时间: ${chalk.cyan(data.basicInfo.onlineTime)}`);
  
  console.log(chalk.blue('\n项目信息:'));
  console.log(`  Git项目: ${chalk.cyan(data.projectInfo.gitProjectName)}`);
  console.log(`  开发分支: ${chalk.cyan(data.projectInfo.developmentBranch)}`);
  console.log(`  参与人员: ${chalk.cyan(data.projectInfo.participants.length)} 人`);
  console.log(`  审核人员: ${chalk.cyan(data.projectInfo.checkUsers.length)} 人`);
  console.log(`  预估工时: ${chalk.cyan(data.projectInfo.workHours)} 小时`);
  
  if (data.componentModules.length > 0) {
    console.log(chalk.blue('\n组件模块:'));
    data.componentModules.forEach((comp: any, index: number) => {
      console.log(`  ${index + 1}. ${chalk.cyan(comp.name)} (${comp.relativePath})`);
    });
  }
  
  if (data.functionModules.length > 0) {
    console.log(chalk.blue('\n功能模块:'));
    data.functionModules.forEach((func: any, index: number) => {
      console.log(`  ${index + 1}. ${chalk.cyan(func.name)} (${func.relativePath})`);
    });
  }

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: chalk.yellow('\n确认创建CR申请单？'),
    default: true
  }]);

  return confirmed;
}

/**
 * 创建CR申请单
 */
async function submitCrRequest(apiManager: GreatWallApiManager, sprintId: number, iterationData: any) {
  console.log('🔍 submitCrRequest函数接收的参数:');
  console.log('  sprintId:', sprintId, '(类型:', typeof sprintId, ')');
  console.log('  iterationData keys:', Object.keys(iterationData));
  
  if (!sprintId) {
    throw new Error('submitCrRequest函数参数错误: sprintId为空或undefined');
  }
  
  const spinner = ora('创建CR申请单...').start();
  
  try {
    // 转换组件数据格式
    const componentList = iterationData.componentModules.map((comp: any) => ({
      name: comp.name,
      address: comp.relativePath,
      auditId: parseInt(comp.checkUser),
      imgUrl: comp.url || '-'
    }));
    
    // 转换功能数据格式
    const functionList = iterationData.functionModules.map((func: any) => ({
      name: func.name,
      auditId: parseInt(func.checkUser || iterationData.projectInfo.checkUsers[0]),
      desc: func.description || func.name
    }));
    
    const crRequestParams = {
      sprintId: sprintId,
      createUserId: parseInt(iterationData.basicInfo.createUserId),
      gitProjectName: iterationData.projectInfo.gitProjectName,
      gitlabBranch: iterationData.projectInfo.developmentBranch,
      reqDocUrl: iterationData.projectInfo.productDoc || '-',
      techDocUrl: iterationData.projectInfo.technicalDoc || '-',
      projexUrl: iterationData.projectInfo.projectDashboard || '-',
      uxDocUrl: iterationData.projectInfo.designDoc || '-',
      gitlabUrl: iterationData.projectInfo.gitProjectUrl,
      spendTime: iterationData.projectInfo.workHours.toString(),
      participantIds: iterationData.projectInfo.participants.join(','),
      checkUserIds: iterationData.projectInfo.checkUsers.join(','),
      remark: iterationData.projectInfo.remarks || '',
      componentList,
      functionList
    };
    
    console.log(chalk.yellow('🔍 调用createCrRequest接口的参数:'));
    console.log('传入的sprintId:', sprintId);
    console.log('构造的crRequestParams:', JSON.stringify(crRequestParams, null, 2));
    
    await apiManager.project.createCrRequest(crRequestParams);
    
    spinner.succeed('CR申请单创建成功');
    
    // 显示结果
    console.log(chalk.green('\n✅ CR申请单创建结果:'));
    console.log(`  关联迭代ID: ${chalk.cyan(sprintId)}`);
    console.log(`  Git项目: ${chalk.cyan(iterationData.projectInfo.gitProjectName)}`);
    console.log(`  开发分支: ${chalk.cyan(iterationData.projectInfo.developmentBranch)}`);
    console.log(`  组件数量: ${chalk.cyan(componentList.length)} 个`);
    console.log(`  功能数量: ${chalk.cyan(functionList.length)} 个`);
    console.log(`  参与人员: ${chalk.cyan(iterationData.projectInfo.participants.length)} 人`);
    console.log(`  审核人员: ${chalk.cyan(iterationData.projectInfo.checkUsers.length)} 人`);
    
  } catch (error) {
    spinner.fail('CR申请单创建失败');
    console.error(chalk.red('\n错误详情:'), (error as Error).message);
    throw error;
  }
}