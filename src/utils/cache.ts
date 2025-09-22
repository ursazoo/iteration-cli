/**
 * 用户选择缓存管理器
 * 用于优化用户选择体验，记录和优先显示常用人员
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import { LocalCache, UserInfo } from '../types/index.js';

const CACHE_DIR = path.join(os.homedir(), '.fshows');
const CACHE_FILE = path.join(CACHE_DIR, 'user-cache.json');
const CACHE_EXPIRY_DAYS = 30; // 缓存过期天数

export class UserCacheManager {
  private cache: LocalCache | null = null;

  /**
   * 加载缓存数据
   */
  async loadCache(): Promise<LocalCache> {
    try {
      if (await fs.pathExists(CACHE_FILE)) {
        const cacheData = await fs.readJson(CACHE_FILE);
        
        // 检查缓存是否过期
        const now = Date.now();
        const cacheAge = now - (cacheData.lastUpdated || 0);
        const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        
        if (cacheAge > maxAge) {
          console.log('🔄 用户缓存已过期，重新初始化');
          return this.getDefaultCache();
        }
        
        this.cache = cacheData;
        return cacheData;
      }
    } catch (error) {
      console.warn('⚠️ 缓存加载失败:', (error as Error).message);
    }
    
    return this.getDefaultCache();
  }

  /**
   * 保存缓存数据
   */
  async saveCache(cache: LocalCache): Promise<void> {
    try {
      await fs.ensureDir(CACHE_DIR);
      cache.lastUpdated = Date.now();
      await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
      this.cache = cache;
    } catch (error) {
      console.warn('⚠️ 缓存保存失败:', (error as Error).message);
    }
  }

  /**
   * 获取默认缓存结构
   */
  private getDefaultCache(): LocalCache {
    return {
      projectLines: [],
      participants: [],
      checkUsers: [],
      recentParticipants: [],
      recentCheckUsers: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * 更新参与人员使用记录
   */
  async updateParticipantUsage(userIds: number[]): Promise<void> {
    const cache = await this.loadCache();
    
    // 更新最近使用的参与人员列表
    const recentParticipants = [...userIds];
    
    // 合并之前的记录，去重并保持顺序
    cache.recentParticipants.forEach(id => {
      if (!recentParticipants.includes(id)) {
        recentParticipants.push(id);
      }
    });
    
    // 只保留最近20个记录
    cache.recentParticipants = recentParticipants.slice(0, 20);
    
    await this.saveCache(cache);
  }

  /**
   * 更新审核人员使用记录
   */
  async updateCheckUserUsage(userIds: number[]): Promise<void> {
    const cache = await this.loadCache();
    
    // 更新最近使用的审核人员列表
    const recentCheckUsers = [...userIds];
    
    // 合并之前的记录，去重并保持顺序
    cache.recentCheckUsers.forEach(id => {
      if (!recentCheckUsers.includes(id)) {
        recentCheckUsers.push(id);
      }
    });
    
    // 只保留最近20个记录
    cache.recentCheckUsers = recentCheckUsers.slice(0, 20);
    
    await this.saveCache(cache);
  }

  /**
   * 更新文件审查偏好
   */
  async updateFileReviewerPreference(filePath: string, reviewerId: number): Promise<void> {
    const cache = await this.loadCache();
    
    // 提取文件扩展名作为分类依据
    const extension = path.extname(filePath).toLowerCase();
    if (!extension) return;
    
    // 如果缓存中没有文件偏好字段，初始化它
    if (!(cache as any).fileReviewerPreferences) {
      (cache as any).fileReviewerPreferences = {};
    }
    
    const preferences = (cache as any).fileReviewerPreferences;
    
    // 记录该类型文件的审查人员偏好
    if (!preferences[extension]) {
      preferences[extension] = {};
    }
    
    // 增加该审查人员对该文件类型的权重
    preferences[extension][reviewerId] = (preferences[extension][reviewerId] || 0) + 1;
    
    await this.saveCache(cache);
  }

  /**
   * 根据文件类型推荐审查人员
   */
  async getRecommendedReviewerForFile(filePath: string, availableUsers: any[]): Promise<number | null> {
    const cache = await this.loadCache();
    const extension = path.extname(filePath).toLowerCase();
    
    const preferences = (cache as any).fileReviewerPreferences;
    if (!preferences || !preferences[extension]) {
      return null;
    }
    
    // 找到该文件类型使用最多的审查人员
    const fileTypePrefs = preferences[extension];
    const sortedReviewers = Object.entries(fileTypePrefs)
      .sort(([, a], [, b]) => (b as number) - (a as number));
    
    // 返回第一个在可用用户列表中的审查人员
    for (const [reviewerId] of sortedReviewers) {
      const userId = parseInt(reviewerId);
      if (availableUsers.some(user => user.id === userId)) {
        return userId;
      }
    }
    
    return null;
  }

  /**
   * 生成智能排序的用户选择列表
   */
  async generateSmartUserChoices(
    users: any[], 
    type: 'participants' | 'checkUsers' | 'creators' = 'participants'
  ): Promise<any[]> {
    const cache = await this.loadCache();
    
    // 获取相应的最近使用列表
    const recentIds = type === 'checkUsers' 
      ? cache.recentCheckUsers 
      : cache.recentParticipants;
    
    // 分离最近使用的用户和其他用户
    const recentUsers: any[] = [];
    const otherUsers: any[] = [];
    
    users.forEach(user => {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      if (recentIds.includes(userId)) {
        recentUsers.push(user);
      } else {
        otherUsers.push(user);
      }
    });
    
    // 按最近使用顺序排序recentUsers
    recentUsers.sort((a, b) => {
      const aId = typeof a.id === 'string' ? parseInt(a.id) : a.id;
      const bId = typeof b.id === 'string' ? parseInt(b.id) : b.id;
      return recentIds.indexOf(aId) - recentIds.indexOf(bId);
    });
    
    // 生成选择列表
    const choices: any[] = [];
    
    // 添加最近使用的用户（带星标）
    recentUsers.forEach((user, index) => {
      const label = index === 0 ? '[最近使用]' : '[常用]';
      choices.push({
        name: `⭐ ${user.name || user.realName} (ID: ${user.id}) ${label}`,
        value: user.id,
        short: user.name || user.realName
      });
    });
    
    // 添加分割线（如果有最近使用的用户）
    if (recentUsers.length > 0 && otherUsers.length > 0) {
      choices.push(new inquirer.Separator('─'.repeat(35)));
    }
    
    // 添加其他用户（按名称排序）
    otherUsers
      .sort((a, b) => (a.name || a.realName).localeCompare(b.name || b.realName))
      .forEach(user => {
        choices.push({
          name: `${user.name || user.realName} (ID: ${user.id})`,
          value: user.id,
          short: user.name || user.realName
        });
      });
    
    return choices;
  }

  /**
   * 获取上次选择的用户ID列表（用于预选）
   */
  async getLastSelectedUsers(type: 'participants' | 'checkUsers'): Promise<number[]> {
    const cache = await this.loadCache();
    const recentIds = type === 'checkUsers' 
      ? cache.recentCheckUsers 
      : cache.recentParticipants;
    
    // 返回最近使用的前几个用户作为默认选择
    return recentIds.slice(0, 3);
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      if (await fs.pathExists(CACHE_FILE)) {
        await fs.remove(CACHE_FILE);
        this.cache = null;
        console.log('✅ 过期缓存已清理');
      }
    } catch (error) {
      console.warn('⚠️ 缓存清理失败:', (error as Error).message);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    participantCount: number;
    checkUserCount: number;
    lastUpdated: string;
    hasFilePreferences: boolean;
  }> {
    const cache = await this.loadCache();
    const preferences = (cache as any).fileReviewerPreferences || {};
    
    return {
      participantCount: cache.recentParticipants.length,
      checkUserCount: cache.recentCheckUsers.length,
      lastUpdated: new Date(cache.lastUpdated).toLocaleString(),
      hasFilePreferences: Object.keys(preferences).length > 0
    };
  }
}
