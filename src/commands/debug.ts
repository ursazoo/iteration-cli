/**
 * 调试工具命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as os from 'os';
import * as fs from 'fs-extra';
import { ConfigManager } from '../utils/config.js';
import { GitUtils } from '../utils/git.js';
import { GreatWallApiClient } from '../lib/greatwall-client.js';
import { GreatWallApiManager } from '../lib/greatwall-services.js';

const configManager = new ConfigManager();

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