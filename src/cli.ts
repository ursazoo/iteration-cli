#!/usr/bin/env node

/**
 * 长城后端迭代管理CLI工具
 * 基于commander.js构建的命令行界面
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createIteration } from './commands/create.js';
import { configCmd } from './commands/config.js';
import { debugCmd } from './commands/debug.js';

const program = new Command();

// 设置程序基本信息
program
  .name('fiter')
  .description('长城后端迭代管理CLI工具')
  .version('1.1.0');

// 创建迭代命令
program
  .command('create')
  .description('交互式创建迭代信息')
  .option('-d, --dir <path>', '指定工作目录')
  .action(createIteration);

// 配置管理命令
configCmd.name('config').description('配置管理');
program.addCommand(configCmd);

// 调试工具命令
debugCmd.name('debug').description('调试工具');
program.addCommand(debugCmd);

// 全局错误处理
program.exitOverride((err) => {
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red('❌ 命令执行失败:'), err.message);
  process.exit(1);
});

// 解析命令行参数
program.parse();

// 如果没有提供任何命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}