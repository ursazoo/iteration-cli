/**
 * 配置管理命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config.js';

const configManager = new ConfigManager();

export const configCmd = new Command('config');

// 显示当前配置
configCmd
  .command('show')
  .alias('list')
  .alias('ls')
  .description('显示当前配置')
  .action(async () => {
    try {
      const config = await configManager.getConfig();
      
      if (!config) {
        console.log(chalk.red('❌ 无法获取配置信息'));
        return;
      }

      console.log(chalk.blue('📋 当前配置（基于环境变量）:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      Object.entries(config).forEach(([key, value]) => {
        // 隐藏敏感信息
        const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') 
          ? chalk.gray(`${String(value).substring(0, 8)}...`) 
          : chalk.cyan(String(value));
        
        console.log(`${chalk.white(key.padEnd(20))}: ${displayValue}`);
      });

      // 检查配置完整性
      const { valid, missing } = await configManager.checkConfig();
      if (!valid) {
        console.log(chalk.red('\n❌ 配置异常:'), missing.join(', '));
      } else {
        console.log(chalk.green('\n✅ 配置正常'));
      }

      console.log(chalk.gray('\n提示：配置通过环境变量管理，无需手动设置'));

    } catch (error) {
      console.error(chalk.red('❌ 获取配置失败:'), (error as Error).message);
      process.exit(1);
    }
  });

// 检查配置
configCmd
  .command('check')
  .description('检查配置完整性')
  .action(async () => {
    try {
      const { valid, missing } = await configManager.checkConfig();
      
      if (valid) {
        console.log(chalk.green('✅ 配置正常，可以正常使用'));
        
        const config = await configManager.getConfig();
        console.log(chalk.blue('\n📋 配置信息:'));
        console.log(`  API地址: ${chalk.cyan(config.apiBaseUrl)}`);
        console.log(`  API密钥: ${chalk.cyan(config.apiKey.substring(0, 8) + '...')}`);
        console.log(`  工作目录: ${chalk.cyan(config.defaultWorkDir)}`);
      } else {
        console.log(chalk.red('❌ 配置异常'));
        console.log(chalk.yellow('异常信息:'));
        missing.forEach(item => console.log(`  - ${item}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ 检查配置失败:'), (error as Error).message);
      process.exit(1);
    }
  });