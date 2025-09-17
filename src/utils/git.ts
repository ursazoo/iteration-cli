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
  projectDir?: string;    // 项目目录路径
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitAuthor?: string;
  lastCommitDate?: string;
}

export interface DiffFile {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C';
  insertions?: number;
  deletions?: number;
}

export interface ComponentSuggestion {
  name: string;
  path: string;
  relativePath: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C';
  type: string; // vue, jsx, tsx, etc.
}

export interface FunctionSuggestion {
  name: string;
  path: string;
  relativePath: string;
  description: string;
  category: string; // pages, api, utils, etc.
  status: 'A' | 'M' | 'D' | 'R' | 'C';
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
        projectDir: this.workDir,
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

  /**
   * 获取分支差异文件列表
   * @param baseBranch 基础分支 (默认: origin/main 或 origin/master)
   * @returns 变更文件列表
   */
  async getBranchDiffFiles(baseBranch?: string): Promise<DiffFile[]> {
    try {
      // 如果没有指定基础分支，尝试检测主分支
      if (!baseBranch) {
        baseBranch = await this.detectMainBranch();
      }

      console.log(`🔍 分析与 ${baseBranch} 的差异...`);

      // 获取差异文件状态
      const diffSummary = await this.git.diffSummary([baseBranch]);
      
      const diffFiles: DiffFile[] = diffSummary.files.map(file => ({
        path: this.cleanGitPath(file.file),
        status: this.mapFileStatus(file.file, diffSummary),
        insertions: (file as any).insertions || 0,
        deletions: (file as any).deletions || 0
      }));

      console.log(`📊 检测到 ${diffFiles.length} 个变更文件`);
      
      return diffFiles;
    } catch (error) {
      console.warn('⚠️ 无法获取分支差异:', (error as Error).message);
      console.log('💡 提示：请确保已设置上游分支或指定正确的基础分支');
      return [];
    }
  }

  /**
   * 检测主分支名称
   */
  private async detectMainBranch(): Promise<string> {
    try {
      const branches = await this.git.branch(['-r']);
      
      // 优先查找 origin/main
      if (branches.all.includes('origin/main')) {
        return 'origin/main';
      }
      
      // 其次查找 origin/master
      if (branches.all.includes('origin/master')) {
        return 'origin/master';
      }
      
      // 如果都没有，查找本地main/master
      const localBranches = await this.git.branch();
      if (localBranches.all.includes('main')) {
        return 'main';
      }
      
      if (localBranches.all.includes('master')) {
        return 'master';
      }
      
      // 默认返回main
      return 'main';
    } catch (error) {
      console.warn('⚠️ 无法检测主分支，使用默认值 main');
      return 'main';
    }
  }

  /**
   * 映射文件状态
   */
  private mapFileStatus(filePath: string, diffSummary: any): 'A' | 'M' | 'D' | 'R' | 'C' {
    // 这里简化处理，实际可以通过git status --porcelain获取更准确的状态
    const file = diffSummary.files.find((f: any) => f.file === filePath);
    
    if (file) {
      if (file.insertions > 0 && file.deletions === 0) {
        return 'A'; // 新增
      } else if (file.insertions === 0 && file.deletions > 0) {
        return 'D'; // 删除
      } else {
        return 'M'; // 修改
      }
    }
    
    return 'M'; // 默认为修改
  }

  /**
   * 分析文件变更，智能分类为组件和功能模块
   */
  analyzeDiffForModules(diffFiles: DiffFile[]): {
    suggestedComponents: ComponentSuggestion[],
    suggestedFunctions: FunctionSuggestion[]
  } {
    const suggestedComponents: ComponentSuggestion[] = [];
    const suggestedFunctions: FunctionSuggestion[] = [];

    diffFiles.forEach(file => {
      if (this.isComponentFile(file.path)) {
        suggestedComponents.push(this.createComponentSuggestion(file));
      }
      
      if (this.isFunctionFile(file.path)) {
        suggestedFunctions.push(this.createFunctionSuggestion(file));
      }
    });

    // 按状态和名称排序（新增优先，然后按字母顺序）
    suggestedComponents.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'A' ? -1 : b.status === 'A' ? 1 : 0;
      }
      return a.name.localeCompare(b.name);
    });

    suggestedFunctions.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      if (a.status !== b.status) {
        return a.status === 'A' ? -1 : b.status === 'A' ? 1 : 0;
      }
      return a.name.localeCompare(b.name);
    });

    return { suggestedComponents, suggestedFunctions };
  }

  /**
   * 判断是否为组件文件
   */
  private isComponentFile(filePath: string): boolean {
    // 排除样式文件
    if (this.isStyleFile(filePath)) {
      return false;
    }

    const componentPaths = ['/components/', '/widgets/', '/ui/', '/component/'];
    const componentExtensions = ['.vue', '.jsx', '.tsx', '.svelte'];
    
    const hasComponentPath = componentPaths.some(p => filePath.includes(p));
    const hasComponentExt = componentExtensions.some(ext => filePath.endsWith(ext));
    const isPascalCase = /[A-Z][a-zA-Z0-9]*\.(vue|jsx|tsx|svelte)$/.test(path.basename(filePath));
    
    return hasComponentPath || (hasComponentExt && isPascalCase);
  }

  /**
   * 判断是否为功能文件
   */
  private isFunctionFile(filePath: string): boolean {
    // 排除样式文件
    if (this.isStyleFile(filePath)) {
      return false;
    }

    const functionPaths = [
      '/pages/', '/views/', '/routes/', '/router/',
      '/features/', '/modules/', '/domains/',
      '/services/', '/api/', '/utils/', '/helpers/',
      '/store/', '/stores/', '/state/'
    ];
    
    return functionPaths.some(p => filePath.includes(p)) || 
           filePath.includes('/src/') || 
           filePath.includes('/lib/');
  }

  /**
   * 判断是否为样式文件
   */
  private isStyleFile(filePath: string): boolean {
    const styleExtensions = ['.css', '.scss', '.sass', '.less', '.styl', '.stylus'];
    return styleExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  /**
   * 创建组件建议
   */
  private createComponentSuggestion(file: DiffFile): ComponentSuggestion {
    const fileName = path.basename(file.path, path.extname(file.path));
    const extension = path.extname(file.path);
    const relativePath = file.path.replace(this.workDir, '').replace(/^\//, '');
    
    // 智能生成组件名称：如果是index文件，则使用完整路径信息生成唯一名称
    let componentName = fileName;
    if (fileName.toLowerCase() === 'index') {
      const pathParts = file.path.split('/');
      const relevantParts = [];
      
      // 从路径中提取有意义的部分来构造唯一名称
      for (let i = pathParts.length - 2; i >= 0; i--) {
        const part = pathParts[i];
        if (part && part !== 'src' && part !== 'components' && part !== 'views' && part !== 'pages') {
          relevantParts.unshift(part);
          // 取前2-3个有意义的路径部分
          if (relevantParts.length >= 2) break;
        }
      }
      
      if (relevantParts.length > 0) {
        // 使用驼峰命名法组合路径部分
        componentName = relevantParts
          .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
      } else {
        // 回退到使用父目录名
        const parentDir = path.basename(path.dirname(file.path));
        componentName = parentDir !== '.' ? parentDir : fileName;
      }
      
      // 为index文件添加扩展名后缀以区分不同文件类型
      const extSuffix = this.getFileTypeSuffix(extension);
      if (extSuffix) {
        // 将文件类型放在前面，用括号括起来
        componentName = `(${extSuffix}) ${componentName}`;
      }
    }
    
    return {
      name: componentName,
      path: file.path,
      relativePath: relativePath,
      status: file.status,
      type: extension.substring(1) // 去掉点号
    };
  }

  /**
   * 创建功能建议
   */
  private createFunctionSuggestion(file: DiffFile): FunctionSuggestion {
    const fileName = path.basename(file.path, path.extname(file.path));
    const fileExt = path.extname(file.path);
    const relativePath = file.path.replace(this.workDir, '').replace(/^\//, '');
    
    // 智能生成功能名称：如果是index文件，则使用完整路径信息生成唯一名称
    let functionName = fileName;
    if (fileName.toLowerCase() === 'index') {
      const pathParts = file.path.split('/');
      const relevantParts = [];
      
      // 从路径中提取有意义的部分来构造唯一名称
      for (let i = pathParts.length - 2; i >= 0; i--) {
        const part = pathParts[i];
        if (part && part !== 'src' && part !== 'components' && part !== 'views' && part !== 'pages') {
          relevantParts.unshift(part);
          // 取前2-3个有意义的路径部分
          if (relevantParts.length >= 2) break;
        }
      }
      
      if (relevantParts.length > 0) {
        // 使用驼峰命名法组合路径部分
        functionName = relevantParts
          .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
      } else {
        // 回退到使用父目录名
        const parentDir = path.basename(path.dirname(file.path));
        functionName = parentDir !== '.' ? parentDir : fileName;
      }
      
      // 为index文件添加扩展名后缀以区分不同文件类型
      const extSuffix = this.getFileTypeSuffix(fileExt);
      if (extSuffix) {
        // 将文件类型放在前面，用括号括起来
        functionName = `(${extSuffix}) ${functionName}`;
      }
    }
    
    // 根据路径判断分类
    let category = 'other';
    let description = functionName;
    
    if (file.path.includes('/pages/') || file.path.includes('/views/')) {
      category = 'pages';
      description = `${functionName}页面`;
    } else if (file.path.includes('/api/') || file.path.includes('/services/')) {
      category = 'api';
      description = `${functionName}接口服务`;
    } else if (file.path.includes('/utils/') || file.path.includes('/helpers/')) {
      category = 'utils';
      description = `${functionName}工具函数`;
    } else if (file.path.includes('/store/') || file.path.includes('/stores/')) {
      category = 'store';
      description = `${functionName}状态管理`;
    } else if (file.path.includes('/features/') || file.path.includes('/modules/')) {
      category = 'features';
      description = `${functionName}功能模块`;
    }
    
    return {
      name: functionName,
      path: file.path,
      relativePath: relativePath,
      description: description,
      category: category,
      status: file.status
    };
  }

  /**
   * 根据文件扩展名获取类型后缀
   */
  private getFileTypeSuffix(ext: string): string {
    const extMap: Record<string, string> = {
      '.vue': 'Vue',
      '.js': 'JavaScript',
      '.ts': 'TypeScript', 
      '.jsx': 'JSX',
      '.tsx': 'TSX',
      '.css': 'CSS',
      '.scss': 'Sass',
      '.less': 'Less',
      '.sass': 'Sass',
      '.html': 'HTML',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go'
    };
    
    return extMap[ext.toLowerCase()] || '';
  }

  /**
   * 清理Git路径中的重命名信息
   */
  private cleanGitPath(gitPath: string): string {
    // 处理Git重命名格式：{oldName => newName} 或 path/{oldDir => newDir}/file
    // 我们只保留新的名称
    if (gitPath.includes('{') && gitPath.includes('=>') && gitPath.includes('}')) {
      // 匹配 {oldName => newName} 格式
      return gitPath.replace(/\{[^}]*?=>\s*([^}]+)\}/g, '$1');
    }
    return gitPath;
  }
}