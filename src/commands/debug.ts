/**
 * 调试工具命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config.js';
import { UserCacheManager } from '../utils/cache.js';
import { UserDetector } from '../utils/user-detector.js';
import { GitUtils } from '../utils/git.js';
import { GreatWallApiClient } from '../lib/greatwall-client.js';
import { GreatWallApiManager } from '../lib/greatwall-services.js';

const configManager = new ConfigManager();
const cacheManager = new UserCacheManager();
const userDetector = new UserDetector();

export const debugCmd = new Command('debug');

// Git信息调试
debugCmd
  .command('git')
  .description('检查Git信息获取')
  .option('-d, --dir <path>', '指定工作目录', process.cwd())
  .action(async (options) => {
    const spinner = ora('正在获取Git信息...').start();
    
    try {
      const gitUtils = new GitUtils(options.dir);
      const gitInfo = await gitUtils.getGitInfo();
      
      spinner.succeed('Git信息获取完成');
      
      console.log(chalk.blue('\n📂 Git仓库信息:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`工作目录: ${chalk.cyan(options.dir)}`);
      console.log(`是否Git仓库: ${gitInfo.isGitRepository ? chalk.green('是') : chalk.red('否')}`);
      console.log(`项目名称: ${chalk.cyan(gitInfo.projectName)}`);
      console.log(`项目URL: ${chalk.cyan(gitInfo.projectUrl || '未设置')}`);
      console.log(`当前分支: ${chalk.cyan(gitInfo.currentBranch || '未检测到')}`);
      
      if (gitInfo.lastCommitHash) {
        console.log(`最后提交: ${chalk.cyan(gitInfo.lastCommitHash.substring(0, 7))}`);
        console.log(`提交信息: ${chalk.cyan(gitInfo.lastCommitMessage || '')}`);
        console.log(`提交作者: ${chalk.cyan(gitInfo.lastCommitAuthor || '')}`);
        console.log(`提交时间: ${chalk.cyan(gitInfo.lastCommitDate || '')}`);
      }

      // 获取预估工时
      const workHours = await gitUtils.estimateWorkHours();
      console.log(`预估工时: ${chalk.cyan(workHours)} 小时`);

    } catch (error) {
      spinner.fail('Git信息获取失败');
      console.error(chalk.red('❌ 错误:'), (error as Error).message);
      process.exit(1);
    }
  });

// API连接测试
debugCmd
  .command('api')
  .description('测试长城后端API连接')
  .action(async () => {
    const spinner = ora('正在检查配置...').start();
    
    try {
      // 检查配置
      const { valid, missing } = await configManager.checkConfig();
      if (!valid) {
        spinner.fail('配置不完整');
        console.log(chalk.red('❌ 缺少配置项:'), missing.join(', '));
        console.log(chalk.yellow('请先运行 fiter config set 进行配置'));
        return;
      }

      const config = await configManager.getConfig();
      spinner.text = '正在测试API连接...';

      // 创建API客户端
      const apiClient = new GreatWallApiClient({
        baseUrl: config.apiBaseUrl,
        apiKey: config.apiKey
      });

      // 测试基础连接
      const connected = await apiClient.testConnection();
      if (!connected) {
        spinner.fail('API连接失败');
        console.log(chalk.red('❌ 无法连接到长城后端'));
        return;
      }

      spinner.text = '正在测试API功能...';

      // 创建API管理器
      const apiManager = new GreatWallApiManager({
        baseUrl: config.apiBaseUrl,
        apiKey: config.apiKey
      });

      // 测试用户列表获取
      try {
        const users = await apiManager.user.getAllUsers();
        console.log(chalk.green('✅ 用户列表获取成功:'), `${users.length} 名用户`);
      } catch (error) {
        console.log(chalk.red('❌ 用户列表获取失败:'), (error as Error).message);
      }

      // 测试项目组列表获取
      try {
        const projects = await apiManager.project.getProjectGroupList();
        console.log(chalk.green('✅ 项目组列表获取成功:'), `${projects.length} 个项目组`);
      } catch (error) {
        console.log(chalk.red('❌ 项目组列表获取失败:'), (error as Error).message);
      }

      spinner.succeed('API测试完成');

    } catch (error) {
      spinner.fail('API测试失败');
      console.error(chalk.red('❌ 错误:'), (error as Error).message);
      process.exit(1);
    }
  });

// 环境信息
debugCmd
  .command('env')
  .description('显示环境信息')
  .action(async () => {
    console.log(chalk.blue('🔧 环境信息:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Node.js版本: ${chalk.cyan(process.version)}`);
    console.log(`平台: ${chalk.cyan(process.platform)}`);
    console.log(`架构: ${chalk.cyan(process.arch)}`);
    console.log(`当前目录: ${chalk.cyan(process.cwd())}`);
    console.log(`用户主目录: ${chalk.cyan(os.homedir())}`);
    
    // 配置文件路径
    const configPath = configManager.getConfigPath();
    const configExists = await fs.pathExists(configPath);
    console.log(`配置文件: ${chalk.cyan(configPath)} ${configExists ? chalk.green('(存在)') : chalk.red('(不存在)')}`);

    // 检查依赖
    console.log(chalk.blue('\n📦 关键依赖:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const packages = ['commander', 'inquirer', 'simple-git', 'axios', 'chalk', 'ora'];
    packages.forEach(pkg => {
      try {
        // 由于ES模块限制，这里只显示包名
        console.log(`${pkg}: ${chalk.green('已安装')}`);
      } catch {
        console.log(`${pkg}: ${chalk.red('未安装')}`);
      }
    });
  });

// 用户缓存调试
debugCmd
  .command('cache')
  .description('显示用户选择缓存状态')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 用户选择缓存状态:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const stats = await cacheManager.getCacheStats();
      
      console.log(`缓存的参与人员: ${chalk.cyan(stats.participantCount)} 个`);
      console.log(`缓存的审核人员: ${chalk.cyan(stats.checkUserCount)} 个`);
      console.log(`文件类型偏好: ${stats.hasFilePreferences ? chalk.green('已建立') : chalk.gray('未建立')}`);
      console.log(`最后更新时间: ${chalk.cyan(stats.lastUpdated)}`);
      
      if (stats.participantCount === 0 && stats.checkUserCount === 0) {
        console.log(chalk.yellow('\n💡 提示: 缓存为空，使用 fiter create 后会自动建立缓存'));
      } else {
        console.log(chalk.green('\n✅ 缓存正常，下次选择人员时会优先显示常用人员'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 缓存检查失败:'), (error as Error).message);
    }
  });

// 保存的用户调试
debugCmd
  .command('user')
  .description('显示和管理保存的创建人信息')
  .option('--clear', '清除保存的创建人信息')
  .action(async (options) => {
    try {
      if (options.clear) {
        await userDetector.clearSavedCreator();
        console.log(chalk.green('✅ 已清除保存的创建人信息'));
        return;
      }

      console.log(chalk.blue('👤 保存的创建人信息:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const savedCreator = await userDetector.getSavedCreator();
      
      if (savedCreator) {
        console.log(`姓名: ${chalk.cyan(savedCreator.name)}`);
        console.log(`ID: ${chalk.cyan(savedCreator.id)}`);
        console.log(chalk.green('\n✅ 下次创建迭代时会自动使用此用户'));
        console.log(chalk.gray('💡 如需更换创建人，请运行: fiter debug user --clear'));
      } else {
        console.log(chalk.yellow('⚠️ 未保存创建人信息'));
        console.log(chalk.gray('💡 首次运行 fiter create 时会要求选择并保存创建人'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 用户信息检查失败:'), (error as Error).message);
    }
  });

// 重置所有缓存和配置
debugCmd
  .command('reset')
  .description('清空所有缓存和配置，重新初始化')
  .option('--confirm', '跳过确认直接重置')
  .action(async (options) => {
    try {
      // 如果没有 --confirm 选项，先询问确认
      if (!options.confirm) {
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow('⚠️  这将清空所有缓存和配置，确定要重置吗？'),
          default: false
        }]);

        if (!confirmed) {
          console.log(chalk.gray('已取消重置操作'));
          return;
        }
      }

      console.log(chalk.blue('🔄 开始重置所有缓存和配置...'));
      console.log(chalk.gray('─'.repeat(50)));

      let resetCount = 0;
      let errorCount = 0;

      // 1. 清除用户选择缓存
      try {
        await cacheManager.cleanExpiredCache();
        console.log(chalk.green('✅ 用户选择缓存已清除'));
        resetCount++;
      } catch (error) {
        console.log(chalk.red('❌ 清除用户选择缓存失败:'), (error as Error).message);
        errorCount++;
      }

      // 2. 清除保存的创建人信息
      try {
        await userDetector.clearSavedCreator();
        console.log(chalk.green('✅ 保存的创建人信息已清除'));
        resetCount++;
      } catch (error) {
        console.log(chalk.red('❌ 清除创建人信息失败:'), (error as Error).message);
        errorCount++;
      }

      // 3. 清除配置文件（如果存在）
      try {
        const configPath = configManager.getConfigPath();
        if (await fs.pathExists(configPath)) {
          await fs.remove(configPath);
          console.log(chalk.green('✅ 配置文件已清除'));
          resetCount++;
        } else {
          console.log(chalk.gray('ℹ️  配置文件不存在，跳过'));
        }
      } catch (error) {
        console.log(chalk.red('❌ 清除配置文件失败:'), (error as Error).message);
        errorCount++;
      }

      // 4. 清除整个.fshows目录（如果为空）
      try {
        const fshowsDir = path.join(os.homedir(), '.fshows');
        if (await fs.pathExists(fshowsDir)) {
          const files = await fs.readdir(fshowsDir);
          if (files.length === 0) {
            await fs.remove(fshowsDir);
            console.log(chalk.green('✅ .fshows目录已清除'));
            resetCount++;
          } else {
            console.log(chalk.gray('ℹ️  .fshows目录不为空，保留'));
          }
        }
      } catch (error) {
        console.log(chalk.red('❌ 清除.fshows目录失败:'), (error as Error).message);
        errorCount++;
      }

      console.log(chalk.gray('\n' + '─'.repeat(50)));
      
      if (errorCount === 0) {
        console.log(chalk.green.bold(`🎉 重置完成！共清理了 ${resetCount} 项内容`));
        console.log(chalk.blue('\n💡 下次运行 fiter create 时将重新初始化所有配置'));
      } else {
        console.log(chalk.yellow.bold(`⚠️  重置部分完成：成功 ${resetCount} 项，失败 ${errorCount} 项`));
        console.log(chalk.gray('请检查上面的错误信息'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 重置操作失败:'), (error as Error).message);
    }
  });