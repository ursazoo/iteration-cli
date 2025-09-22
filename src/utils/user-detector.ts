/**
 * 简单的本机用户管理器
 * 第一次选择后保存，后续自动使用
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

const USER_CONFIG_FILE = path.join(os.homedir(), '.fshows', 'current-user.json');

export interface SavedUser {
  id: number;
  name: string;
}

export class UserDetector {
  /**
   * 获取保存的创建人信息
   */
  async getSavedCreator(): Promise<SavedUser | null> {
    try {
      if (await fs.pathExists(USER_CONFIG_FILE)) {
        const savedUser = await fs.readJson(USER_CONFIG_FILE);
        if (savedUser.id && savedUser.name) {
          return savedUser;
        }
      }
    } catch (error) {
      console.warn('读取保存的用户信息失败:', (error as Error).message);
    }
    return null;
  }

  /**
   * 保存创建人信息
   */
  async saveCreator(user: SavedUser): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(USER_CONFIG_FILE));
      await fs.writeJson(USER_CONFIG_FILE, user, { spaces: 2 });
    } catch (error) {
      console.warn('保存用户信息失败:', (error as Error).message);
    }
  }

  /**
   * 清除保存的用户信息
   */
  async clearSavedCreator(): Promise<void> {
    try {
      if (await fs.pathExists(USER_CONFIG_FILE)) {
        await fs.remove(USER_CONFIG_FILE);
      }
    } catch (error) {
      console.warn('清除用户信息失败:', (error as Error).message);
    }
  }
}
