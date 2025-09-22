/**
 * 创建迭代命令 - 基于inquirer.js实现交互式界面
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { UserCacheManager } from '../utils/cache.js';
import { BatchReviewerAssignment } from '../utils/batch-assignment.js';
import { UserDetector } from '../utils/user-detector.js';
import { GitUtils, GitInfo, ComponentSuggestion, FunctionSuggestion } from '../utils/git.js';
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
const cacheManager = new UserCacheManager();
const batchAssignment = new BatchReviewerAssignment();
const userDetector = new UserDetector();

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

    // 4. 创建迭代
    const { sprintId, createUserId } = await createIterationOnly(users, projectGroups, gitInfo, apiManager);

    console.log('🔍 创建的迭代ID:', sprintId, '(类型:', typeof sprintId, ')');
    console.log('🔍 创建人ID:', createUserId, '(类型:', typeof createUserId, ')');

    // 5. 创建CR申请单（支持多个）
    await createMultipleCrRequests(apiManager, sprintId, gitInfo, users, createUserId);

    console.log(chalk.green.bold('\n🎉 迭代和所有CR申请单创建完成！'));

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
 * 只创建迭代，不处理CR申请单
 */
async function createIterationOnly(users: any[], projectGroups: GreatWallProjectGroup[], gitInfo: any, apiManager: GreatWallApiManager): Promise<{ sprintId: number; createUserId: number }> {
  console.log(chalk.blue('\n📝 开始创建迭代...\n'));

  // 收集迭代基础信息
  const basicInfo = await collectBasicInfo(users, projectGroups, gitInfo);

  // 立即创建迭代
  const sprintId = await createSprintImmediately(apiManager, basicInfo);

  // 确保 createUserId 是有效的数字
  const createUserId = parseInt(basicInfo.createUserId);
  if (isNaN(createUserId)) {
    throw new Error('创建人ID格式错误');
  }

  return { sprintId, createUserId };
}

/**
 * 收集基础信息
 */
async function collectBasicInfo(users: any[], projectGroups: GreatWallProjectGroup[], gitInfo: any) {
  console.log(chalk.yellow('📋 收集迭代基础信息'));
  
  const projectChoices = projectGroups.map(group => ({
    name: `${group.name} (ID: ${group.id})`,
    value: group.id
  }));

  // 尝试获取保存的创建人信息
  const savedCreator = await userDetector.getSavedCreator();
  let createUserId: number;

  if (savedCreator) {
    // 验证保存的用户是否还在用户列表中
    const userExists = users.find(user => user.id === savedCreator.id);
    if (userExists) {
      createUserId = savedCreator.id;
      console.log(chalk.green(`✅ 创建人: ${savedCreator.name} (自动使用保存的用户)`));
    } else {
      console.log(chalk.yellow(`⚠️ 保存的用户 ${savedCreator.name} 不在当前用户列表中，请重新选择`));
      createUserId = await selectCreatorManually(users);
    }
  } else {
    // 第一次使用，手动选择并保存
    console.log(chalk.blue('🔍 首次使用，请选择创建人（选择后会保存到本机）'));
    createUserId = await selectCreatorManually(users);
  }

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
      type: 'input',
      name: 'remarks',
      message: '备注信息 (可选):'
    }
  ]);

  // 添加创建人ID到答案中
  (answers as any).createUserId = createUserId;

  return answers as IterationBasicInfo;
}

/**
 * 手动选择创建人并保存
 */
async function selectCreatorManually(users: any[]): Promise<number> {
  const userChoices = users.map(user => ({
    name: `${user.name} (ID: ${user.id})`,
    value: user.id,
    short: user.name
  }));

  const { selectedCreator } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedCreator',
    message: '选择创建人:',
    choices: userChoices,
    pageSize: 12
  }]);

  // 保存选择的创建人
  const selectedUser = users.find(user => user.id === selectedCreator);
  if (selectedUser) {
    await userDetector.saveCreator({
      id: selectedUser.id,
      name: selectedUser.name
    });
    console.log(chalk.green(`💾 已保存创建人信息: ${selectedUser.name}`));
  }

  return selectedCreator;
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
    
    // HTTP客户端已经解包了data字段，直接访问sprintResult.id
    const sprintId = sprintResult.id;
    
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

  const userChoices = await cacheManager.generateSmartUserChoices(users, 'participants');

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
async function collectComponentModules(users: any[], gitInfo: GitInfo, workDir?: string): Promise<ComponentModule[]> {
  console.log(chalk.yellow('\n📋 第三步：组件模块 (基于Git差异智能分析)'));

  const userChoices = await cacheManager.generateSmartUserChoices(users, 'checkUsers');

  // 1. 获取Git差异分析 - 使用正确的工作目录
  const projectDir = workDir || gitInfo.projectDir || process.cwd();
  const gitUtils = new GitUtils(projectDir);
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

    // 3. 批量分配审核人员（支持重试）
    let batchAssignmentCompleted = false;
    
    while (!batchAssignmentCompleted) {
      const batchOptions = await batchAssignment.collectBatchAssignmentMode(selectedComponents, userChoices);
      
      if (batchOptions.mode === 'individual') {
        // 传统逐个选择模式
        for (const suggestion of selectedComponents) {
          let checkUser = userChoices.length > 0 ? userChoices[0].value : '1';

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

          const pathParts = suggestion.relativePath.split('/');
          let componentName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '');
          
          if (componentName.toLowerCase() === 'index') {
            componentName = pathParts[pathParts.length - 2] || 'index';
          }
          
          components.push({
            name: componentName,
            relativePath: suggestion.relativePath,
            checkUser: checkUser.toString(),
            url: ''
          });
        }
        batchAssignmentCompleted = true;
        
      } else {
        // 批量分配模式
        const assignmentResults = await batchAssignment.executeBatchAssignment(selectedComponents, batchOptions, userChoices);
        
        // 显示分配预览并获取用户选择
        const previewResult = await batchAssignment.showAssignmentPreview(assignmentResults);
        
        if (previewResult === 'confirmed') {
          // 支持个别调整
          const finalResults = await batchAssignment.adjustIndividualAssignments(assignmentResults, userChoices);
          
          // 转换为组件模块格式
          finalResults.forEach(result => {
            const pathParts = result.filePath.split('/');
            let componentName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '');
            
            if (componentName.toLowerCase() === 'index') {
              componentName = pathParts[pathParts.length - 2] || 'index';
            }
            
            components.push({
              name: componentName,
              relativePath: result.filePath,
              checkUser: result.reviewerId.toString(),
              url: ''
            });
          });

          console.log(chalk.green(`\n✅ 已完成 ${finalResults.length} 个组件的审查人员分配`));
          batchAssignmentCompleted = true;
          
        } else if (previewResult === 'retry') {
          console.log(chalk.blue('\n🔄 重新选择分配方式...'));
          // 继续循环，重新选择分配方式
          
        } else {
          // cancel
          console.log(chalk.yellow('⚠️ 批量分配已取消'));
          batchAssignmentCompleted = true;
          return components;
        }
      }
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
async function collectFunctionModules(users: any[], gitInfo: GitInfo, workDir?: string): Promise<FunctionModule[]> {
  console.log(chalk.yellow('\n📋 第四步：功能模块 (基于Git差异智能分析)'));

  const userChoices = await cacheManager.generateSmartUserChoices(users, 'checkUsers');

  // 1. 获取Git差异分析 - 使用正确的工作目录
  const projectDir = workDir || gitInfo.projectDir || process.cwd();
  const gitUtils = new GitUtils(projectDir);
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

    // 3. 批量分配审核人员（支持重试）
    let batchAssignmentCompleted = false;
    
    while (!batchAssignmentCompleted) {
      const batchOptions = await batchAssignment.collectBatchAssignmentMode(selectedFunctions, userChoices);
      
      if (batchOptions.mode === 'individual') {
        // 传统逐个选择模式
        for (const suggestion of selectedFunctions) {
          let checkUser = userChoices.length > 0 ? userChoices[0].value : '1';

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

          const pathParts = suggestion.relativePath.split('/');
          let functionName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '');
          
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
        batchAssignmentCompleted = true;
        
      } else {
        // 批量分配模式
        const assignmentResults = await batchAssignment.executeBatchAssignment(selectedFunctions, batchOptions, userChoices);
        
        // 显示分配预览并获取用户选择
        const previewResult = await batchAssignment.showAssignmentPreview(assignmentResults);
        
        if (previewResult === 'confirmed') {
          // 支持个别调整
          const finalResults = await batchAssignment.adjustIndividualAssignments(assignmentResults, userChoices);
          
          // 转换为功能模块格式
          finalResults.forEach(result => {
            const pathParts = result.filePath.split('/');
            let functionName = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '');
            
            if (functionName.toLowerCase() === 'index') {
              functionName = pathParts[pathParts.length - 2] || 'index';
            }
            
            functions.push({
              name: functionName,
              relativePath: result.filePath,
              checkUser: result.reviewerId.toString(),
              description: result.filePath
            });
          });

          console.log(chalk.green(`\n✅ 已完成 ${finalResults.length} 个功能模块的审查人员分配`));
          batchAssignmentCompleted = true;
          
        } else if (previewResult === 'retry') {
          console.log(chalk.blue('\n🔄 重新选择分配方式...'));
          // 继续循环，重新选择分配方式
          
        } else {
          // cancel
          console.log(chalk.yellow('⚠️ 批量分配已取消'));
          batchAssignmentCompleted = true;
          return functions;
        }
      }
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
 * 获取项目Git信息 - 支持多种来源
 */
async function getProjectGitInfo(isFirstCr: boolean = false, currentGitInfo?: any): Promise<any> {
  if (isFirstCr && currentGitInfo) {
    // 第一个CR申请单，使用当前目录的Git信息
    return currentGitInfo;
  }

  // 后续CR申请单，询问项目信息来源
  const { projectSource } = await inquirer.prompt([{
    type: 'list',
    name: 'projectSource',
    message: '选择项目信息来源:',
    choices: [
      { name: '📁 从其他项目目录获取Git信息', value: 'directory' },
      { name: '✏️  手动输入项目信息', value: 'manual' },
      { name: '🔄 继续使用当前目录（同项目不同模块）', value: 'current' }
    ],
    pageSize: 10
  }]);

  switch (projectSource) {
    case 'directory':
      return await getGitInfoFromDirectory();
    case 'manual':
      return await getManualProjectInfo();
    case 'current':
      return currentGitInfo ? {
        ...currentGitInfo,
        projectDir: process.cwd() // 当前目录
      } : {};
    default:
      return {};
  }
}

/**
 * 从指定目录获取Git信息
 */
async function getGitInfoFromDirectory(): Promise<any> {
  const { projectPath } = await inquirer.prompt([{
    type: 'input',
    name: 'projectPath',
    message: '请输入项目目录路径:',
    validate: (input) => {
      if (!input.trim()) return '请输入有效路径';
      return true;
    }
  }]);

  try {
    const projectDir = projectPath.trim();
    const gitUtils = new GitUtils(projectDir);
    const gitInfo = await gitUtils.getGitInfo();

    if (!gitInfo.isGitRepository) {
      console.log(chalk.yellow('⚠️  指定目录不是Git仓库，将使用手动输入模式'));
      return await getManualProjectInfo();
    }

    console.log(chalk.green('✅ 成功获取项目Git信息:'));
    console.log(`  项目名: ${chalk.cyan(gitInfo.projectName)}`);
    console.log(`  分支: ${chalk.cyan(gitInfo.currentBranch)}`);
    console.log(`  仓库: ${chalk.cyan(gitInfo.projectUrl)}`);

    // 添加项目目录信息
    return {
      ...gitInfo,
      projectDir: projectDir
    };
  } catch (error) {
    console.log(chalk.red('❌ 获取Git信息失败:'), (error as Error).message);
    console.log(chalk.yellow('回退到手动输入模式'));
    return await getManualProjectInfo();
  }
}

/**
 * 手动输入项目信息
 */
async function getManualProjectInfo(): Promise<any> {
  console.log(chalk.yellow('\n✏️  手动输入项目信息'));

  const manualInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '项目名称:',
      validate: (input) => input.trim().length > 0 || '请输入项目名称'
    },
    {
      type: 'input',
      name: 'projectUrl',
      message: 'Git仓库地址:',
      validate: (input) => input.trim().length > 0 || '请输入仓库地址'
    },
    {
      type: 'input',
      name: 'currentBranch',
      message: '分支名:',
      default: 'main'
    }
  ]);

  return {
    projectName: manualInfo.projectName,
    projectUrl: manualInfo.projectUrl,
    currentBranch: manualInfo.currentBranch,
    isGitRepository: false, // 标记为手动输入
    projectDir: null // 手动输入模式没有具体的项目目录
  };
}

/**
 * 创建多个CR申请单
 */
async function createMultipleCrRequests(apiManager: GreatWallApiManager, sprintId: number, gitInfo: any, users: any[], createUserId: number) {
  const allCrRequests: any[] = [];
  let continueCrCreation = true;
  let crRequestCount = 0;

  console.log(chalk.blue.bold('\n📋 开始收集CR申请单信息'));
  console.log(chalk.gray('═'.repeat(50)));

  // 收集所有CR申请单信息
  while (continueCrCreation) {
    crRequestCount++;
    console.log(chalk.yellow.bold(`\n🔍 收集第 ${crRequestCount} 个CR申请单信息`));

    // 获取当前CR申请单的项目Git信息
    const currentGitInfo = await getProjectGitInfo(crRequestCount === 1, gitInfo);

    console.log(chalk.cyan(`📁 当前项目: ${currentGitInfo.projectName || '未知项目'}`));
    if (currentGitInfo.currentBranch) {
      console.log(chalk.cyan(`🌿 分支: ${currentGitInfo.currentBranch}`));
    }

    // 收集CR申请单的详细信息
    const crData = await collectCrRequestData(users, currentGitInfo, sprintId, createUserId);
    allCrRequests.push(crData);

    console.log(chalk.green(`✅ 第 ${crRequestCount} 个CR申请单信息已收集`));

    // 询问是否继续添加新的CR申请单
    const { continueCreating } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueCreating',
      message: `是否需要为当前迭代添加第 ${crRequestCount + 1} 个CR申请单？`,
      default: false
    }]);

    continueCrCreation = continueCreating;
  }

  // 显示收集结果
  console.log(chalk.blue.bold(`\n📊 共收集了 ${allCrRequests.length} 个CR申请单`));

  // 确认是否创建
  const { confirmInput } = await inquirer.prompt([{
    type: 'input',
    name: 'confirmInput',
    message: `确认创建这 ${allCrRequests.length} 个CR申请单吗？(请输入 yes 或 no):`,
    validate: (input: string) => {
      const trimmed = input.trim().toLowerCase();
      if (trimmed === 'yes' || trimmed === 'no' || trimmed === 'y' || trimmed === 'n') {
        return true;
      }
      return '请输入 yes/y 或 no/n';
    }
  }]);

  const confirmCreate = ['yes', 'y'].includes(confirmInput.trim().toLowerCase());

  if (!confirmCreate) {
    console.log(chalk.yellow('⚠️  已取消创建'));
    return;
  }

  // 批量创建所有CR申请单
  console.log(chalk.blue.bold('\n🚀 开始创建CR申请单...'));
  console.log(chalk.gray('═'.repeat(50)));

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < allCrRequests.length; i++) {
    const crData = allCrRequests[i];
    console.log(chalk.cyan(`\n正在创建第 ${i + 1}/${allCrRequests.length} 个CR申请单...`));
    console.log(`  项目: ${crData.gitProjectName}`);
    console.log(`  分支: ${crData.gitlabBranch}`);

    try {
      await submitSingleCrRequest(apiManager, sprintId, crData);
      successCount++;
      console.log(chalk.green(`✅ 第 ${i + 1} 个CR申请单创建成功`));
    } catch (error) {
      failedCount++;
      console.log(chalk.red(`❌ 第 ${i + 1} 个CR申请单创建失败: ${(error as Error).message}`));
    }
  }

  // 显示最终结果
  console.log(chalk.blue.bold('\n📈 创建结果统计：'));
  console.log(chalk.green(`  成功: ${successCount} 个`));
  if (failedCount > 0) {
    console.log(chalk.red(`  失败: ${failedCount} 个`));
  }
  console.log(chalk.cyan(`  总计: ${allCrRequests.length} 个CR申请单`));
}

/**
 * 收集单个CR申请单的数据
 */
async function collectCrRequestData(users: any[], gitInfo: any, sprintId: number, createUserId: number) {
  console.log(chalk.yellow('\n📋 收集CR申请单信息'));

  // 显示当前项目信息来源
  if (gitInfo.isGitRepository === false) {
    console.log(chalk.gray('📝 基于手动输入的项目信息'));
  } else if (gitInfo.isGitRepository) {
    console.log(chalk.gray('📁 基于Git仓库信息'));
  }

  // 1. 基础项目信息
  const projectInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'gitProjectName',
      message: 'Git项目名称:',
      default: gitInfo.projectName || '',
      validate: (input) => input.trim().length > 0 || '请输入项目名称'
    },
    {
      type: 'input',
      name: 'gitlabBranch',
      message: 'Git分支名:',
      default: gitInfo.currentBranch || 'main',
      validate: (input) => input.trim().length > 0 || '请输入分支名'
    },
    {
      type: 'input',
      name: 'gitlabUrl',
      message: 'Git仓库地址:',
      default: gitInfo.projectUrl || '',
      validate: (input) => input.trim().length > 0 || '请输入仓库地址'
    },
    {
      type: 'input',
      name: 'reqDocUrl',
      message: '产品文档链接:',
      default: '-'
    },
    {
      type: 'input',
      name: 'spendTime',
      message: '预估工时 (小时):',
      default: '8',
      validate: (input) => !isNaN(Number(input)) || '请输入有效数字'
    }
  ]);

  // 2. 人员选择
  const participantChoices = await cacheManager.generateSmartUserChoices(users, 'participants');
  const checkUserChoices = await cacheManager.generateSmartUserChoices(users, 'checkUsers');

  // 获取上次选择的用户作为默认选项
  const lastParticipants = await cacheManager.getLastSelectedUsers('participants');
  const lastCheckUsers = await cacheManager.getLastSelectedUsers('checkUsers');

  const personnelInfo = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'participantIds',
      message: '选择参与人员:',
      choices: participantChoices.map(choice => ({
        ...choice,
        checked: lastParticipants.includes(choice.value)
      })),
      validate: (choices) => choices.length > 0 || '请至少选择一个参与人员'
    },
    {
      type: 'checkbox',
      name: 'checkUserIds',
      message: '选择审核人员:',
      choices: checkUserChoices.map(choice => ({
        ...choice,
        checked: lastCheckUsers.includes(choice.value)
      })),
      validate: (choices) => choices.length > 0 || '请至少选择一个审核人员'
    }
  ]);

  // 更新用户选择缓存
  await cacheManager.updateParticipantUsage(personnelInfo.participantIds.map((id: any) => parseInt(id)));
  await cacheManager.updateCheckUserUsage(personnelInfo.checkUserIds.map((id: any) => parseInt(id)));

  // 3. 收集组件模块 - 传递正确的项目目录
  const componentModules = await collectComponentModules(users, gitInfo, gitInfo.projectDir);

  // 4. 收集功能模块 - 传递正确的项目目录
  const functionModules = await collectFunctionModules(users, gitInfo, gitInfo.projectDir);

  return {
    ...projectInfo,
    participantIds: personnelInfo.participantIds.join(','),
    checkUserIds: personnelInfo.checkUserIds.join(','),
    componentList: componentModules,
    functionList: functionModules,
    sprintId,
    createUserId
  };
}

/**
 * 创建单个CR申请单
 */
async function submitSingleCrRequest(apiManager: GreatWallApiManager, sprintId: number, crData: any) {
  console.log('🔍 submitSingleCrRequest函数接收的参数:');
  console.log('  sprintId:', sprintId, '(类型:', typeof sprintId, ')');
  console.log('  crData keys:', Object.keys(crData));

  // 验证必需的字段
  if (!sprintId) {
    throw new Error('submitSingleCrRequest函数参数错误: sprintId为空或undefined');
  }
  if (!crData.createUserId) {
    throw new Error('submitSingleCrRequest函数参数错误: createUserId为空或undefined');
  }
  if (!crData.gitProjectName) {
    throw new Error('submitSingleCrRequest函数参数错误: gitProjectName为空或undefined');
  }

  const spinner = ora('创建CR申请单...').start();

  try {
    // 转换组件数据格式
    const componentList = crData.componentList.map((comp: any) => ({
      name: comp.name,
      address: comp.relativePath,
      auditId: parseInt(comp.checkUser),
      imgUrl: comp.url || '-'
    }));

    // 转换功能数据格式
    const functionList = crData.functionList.map((func: any) => ({
      name: func.name,
      auditId: parseInt(func.checkUser || crData.checkUserIds.split(',')[0]),
      desc: func.description || func.name
    }));

    const crRequestParams = {
      sprintId: sprintId,
      createUserId: crData.createUserId,
      gitProjectName: crData.gitProjectName,
      gitlabBranch: crData.gitlabBranch,
      reqDocUrl: crData.reqDocUrl || '-',
      techDocUrl: '-',
      projexUrl: '-',
      uxDocUrl: '-',
      gitlabUrl: crData.gitlabUrl,
      spendTime: crData.spendTime,
      participantIds: crData.participantIds,
      checkUserIds: crData.checkUserIds,
      remark: '-',
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
    console.log(`  Git项目: ${chalk.cyan(crData.gitProjectName)}`);
    console.log(`  开发分支: ${chalk.cyan(crData.gitlabBranch)}`);
    console.log(`  组件数量: ${chalk.cyan(componentList.length)} 个`);
    console.log(`  功能数量: ${chalk.cyan(functionList.length)} 个`);
    console.log(`  参与人员: ${chalk.cyan(crData.participantIds.split(',').length)} 人`);
    console.log(`  审核人员: ${chalk.cyan(crData.checkUserIds.split(',').length)} 人`);

  } catch (error) {
    spinner.fail('CR申请单创建失败');
    console.error(chalk.red('\n错误详情:'), (error as Error).message);
    throw error;
  }
}