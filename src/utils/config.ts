/**
 * CLI配置管理
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CLIConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.fshows');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export class ConfigManager {
  private config: CLIConfig | null = null;

  /**
   * 加载配置 - 优先使用环境变量
   */
  async loadConfig(): Promise<CLIConfig | null> {
    try {
      // 优先使用环境变量
      const envConfig: CLIConfig = {
        apiBaseUrl: process.env.AI_CR_API_BASE_URL || 'http://gw.fshows.com/api',
        apiKey: process.env.API_KEY_PROD || 'Ht5bK8mN3jL7vR4qP9wE2xI6sA1zB4cD9eF6',
        defaultWorkDir: process.env.DEFAULT_WORK_DIR || process.cwd()
      };

      this.config = envConfig;
      return this.config;
    } catch (error) {
      console.warn('⚠️ 配置加载失败:', (error as Error).message);
    }
    return null;
  }

  /**
   * 保存配置
   */
  async saveConfig(config: CLIConfig): Promise<void> {
    try {
      await fs.ensureDir(CONFIG_DIR);
      await fs.writeJSON(CONFIG_FILE, config, { spaces: 2 });
      this.config = config;
      console.log('✅ 配置已保存');
    } catch (error) {
      console.error('❌ 配置保存失败:', (error as Error).message);
      throw error;
    }
  }

  /**
   * 获取配置项
   */
  async getConfig(key?: keyof CLIConfig): Promise<any> {
    if (!this.config) {
      this.config = await this.loadConfig();
    }

    if (!this.config) {
      return null;
    }

    return key ? this.config[key] : this.config;
  }

  /**
   * 设置配置项
   */
  async setConfig(key: keyof CLIConfig, value: any): Promise<void> {
    if (!this.config) {
      this.config = await this.loadConfig() || {
        apiBaseUrl: '',
        apiKey: ''
      };
    }

    this.config[key] = value;
    await this.saveConfig(this.config);
  }

  /**
   * 检查配置是否完整
   */
  async checkConfig(): Promise<{ valid: boolean; missing: string[] }> {
    const config = await this.getConfig();
    
    // 由于使用环境变量和默认值，配置始终可用
    if (config && config.apiBaseUrl && config.apiKey) {
      return { valid: true, missing: [] };
    }

    return { valid: false, missing: ['配置初始化失败'] };
  }

  /**
   * 重置配置
   */
  async resetConfig(): Promise<void> {
    try {
      if (await fs.pathExists(CONFIG_FILE)) {
        await fs.remove(CONFIG_FILE);
        this.config = null;
        console.log('✅ 配置已重置');
      }
    } catch (error) {
      console.error('❌ 配置重置失败:', (error as Error).message);
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return CONFIG_FILE;
  }
}