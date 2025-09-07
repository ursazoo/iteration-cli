/**
 * Git工具类 - 基于simple-git重新实现，解决CLI环境下的Git信息获取问题
 */

import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';

export interface GitInfo {
  projectUrl: string;
  projectName: string;
  currentBranch: string;
  isGitRepository: boolean;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitAuthor?: string;
  lastCommitDate?: string;
}

export class GitUtils {
  private git: SimpleGit;
  private workDir: string;

  constructor(workDir: string = process.cwd()) {
    this.workDir = path.resolve(workDir);
    this.git = simpleGit(this.workDir);
  }

  /**
   * 获取完整的Git信息
   */
  async getGitInfo(): Promise<GitInfo> {
    const defaultResult: GitInfo = {
      projectUrl: '',
      projectName: path.basename(this.workDir),
      currentBranch: '',
      isGitRepository: false
    };

    try {
      // 检查是否为Git仓库
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        console.log('📁 当前目录不是Git仓库');
        return defaultResult;
      }

      console.log('📂 检测到Git仓库，开始获取信息...');

      // 获取远程仓库URL
      const remotes = await this.git.getRemotes(true);
      let projectUrl = '';
      let projectName = path.basename(this.workDir);

      if (remotes.length > 0) {
        // 优先使用origin，如果没有则使用第一个
        const origin = remotes.find(remote => remote.name === 'origin') || remotes[0];
        projectUrl = origin.refs.fetch || '';
        
        if (projectUrl) {
          // 从URL中提取项目名称
          const urlMatch = projectUrl.match(/\/([^\/]+?)(?:\.git)?$/);
          if (urlMatch) {
            projectName = urlMatch[1];
          }
        }
      }

      // 获取当前分支
      const currentBranch = await this.git.branch();
      const branchName = currentBranch.current || '';

      // 获取最后一次提交信息
      let lastCommitInfo = {};
      try {
        const log = await this.git.log({ maxCount: 1 });
        if (log.latest) {
          lastCommitInfo = {
            lastCommitHash: log.latest.hash,
            lastCommitMessage: log.latest.message,
            lastCommitAuthor: log.latest.author_name,
            lastCommitDate: log.latest.date
          };
        }
      } catch (error) {
        console.warn('⚠️ 无法获取提交信息:', (error as Error).message);
      }

      const result: GitInfo = {
        projectUrl: projectUrl,
        projectName: projectName,
        currentBranch: branchName,
        isGitRepository: true,
        ...lastCommitInfo
      };

      console.log('✅ Git信息获取成功:', {
        项目名称: result.projectName,
        项目URL: result.projectUrl,
        当前分支: result.currentBranch,
        最后提交: result.lastCommitHash?.substring(0, 7)
      });

      return result;

    } catch (error) {
      console.error('❌ Git信息获取失败:', (error as Error).message);
      return {
        ...defaultResult,
        projectName: path.basename(this.workDir)
      };
    }
  }

  /**
   * 获取项目名称
   */
  async getProjectName(): Promise<string> {
    const gitInfo = await this.getGitInfo();
    return gitInfo.projectName;
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.branch();
      return branch.current || 'main';
    } catch (error) {
      console.warn('⚠️ 无法获取当前分支:', (error as Error).message);
      return 'main';
    }
  }

  /**
   * 获取远程仓库URL
   */
  async getRemoteUrl(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length > 0) {
        const origin = remotes.find(remote => remote.name === 'origin') || remotes[0];
        return origin.refs.fetch || '';
      }
      return '';
    } catch (error) {
      console.warn('⚠️ 无法获取远程仓库URL:', (error as Error).message);
      return '';
    }
  }

  /**
   * 检查是否为Git仓库
   */
  async isGitRepository(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取Git状态
   */
  async getStatus() {
    try {
      return await this.git.status();
    } catch (error) {
      console.warn('⚠️ 无法获取Git状态:', (error as Error).message);
      return null;
    }
  }

  /**
   * 计算预估工时（基于提交频率和文件变更）
   */
  async estimateWorkHours(daysBack: number = 7): Promise<number> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      
      const log = await this.git.log({
        since: since.toISOString().split('T')[0]
      });

      // 简单的估算：每个提交平均2小时工作量
      const commitCount = log.all.length;
      const estimatedHours = Math.max(1, Math.ceil(commitCount * 2));
      
      console.log(`📊 基于最近${daysBack}天${commitCount}个提交，预估工时: ${estimatedHours}小时`);
      return estimatedHours;

    } catch (error) {
      console.warn('⚠️ 无法计算预估工时:', (error as Error).message);
      return 8; // 默认1天工时
    }
  }

  /**
   * 更改工作目录
   */
  setWorkDir(workDir: string): void {
    this.workDir = path.resolve(workDir);
    this.git = simpleGit(this.workDir);
  }
}