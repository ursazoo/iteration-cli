/**
 * 批量审查人员分配工具
 * 支持多种分配策略，提升文件审查人员分配效率
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import * as path from 'path';
import { ComponentSuggestion, FunctionSuggestion } from './git.js';
import { UserCacheManager } from './cache.js';

export interface BatchAssignmentOptions {
  mode: 'single' | 'byType' | 'byDirectory' | 'individual';
  defaultReviewer?: number;
  typeBasedMapping?: Record<string, number>;
  directoryBasedMapping?: Record<string, number>;
}

export interface AssignmentResult {
  filePath: string;
  fileName: string;
  reviewerId: number;
  reviewerName: string;
  assignmentReason: string;
}

export class BatchReviewerAssignment {
  private cacheManager: UserCacheManager;

  constructor() {
    this.cacheManager = new UserCacheManager();
  }

  /**
   * 收集批量分配模式选择
   */
  async collectBatchAssignmentMode(
    selectedFiles: (ComponentSuggestion | FunctionSuggestion)[],
    userChoices: any[]
  ): Promise<BatchAssignmentOptions> {
    console.log(chalk.blue(`\n🚀 检测到 ${selectedFiles.length} 个文件需要分配审查人员`));
    console.log(chalk.gray('选择批量分配模式以提高效率：\n'));

    const { assignmentMode } = await inquirer.prompt([{
      type: 'list',
      name: 'assignmentMode',
      message: '选择分配模式:',
      choices: [
        {
          name: '🚀 全部分配给同一人 (最快)',
          value: 'single',
          short: '统一分配'
        },
        {
          name: '🎯 按文件类型智能分配 (推荐)',
          value: 'byType',
          short: '类型分配'
        },
        {
          name: '📁 按目录结构分配',
          value: 'byDirectory',
          short: '目录分配'
        },
        {
          name: '✏️ 逐个文件单独选择 (传统模式)',
          value: 'individual',
          short: '逐个选择'
        }
      ],
      pageSize: 6
    }]);

    switch (assignmentMode) {
      case 'single':
        return await this.configureSingleAssignment(userChoices);
      case 'byType':
        return await this.configureTypeBasedAssignment(selectedFiles, userChoices);
      case 'byDirectory':
        return await this.configureDirectoryBasedAssignment(selectedFiles, userChoices);
      default:
        return { mode: 'individual' };
    }
  }

  /**
   * 配置统一分配模式
   */
  private async configureSingleAssignment(userChoices: any[]): Promise<BatchAssignmentOptions> {
    console.log(chalk.yellow('\n📋 统一分配模式：所有文件分配给同一审查人员'));

    const { defaultReviewer } = await inquirer.prompt([{
      type: 'list',
      name: 'defaultReviewer',
      message: '选择审查人员:',
      choices: userChoices,
      pageSize: 12
    }]);

    return {
      mode: 'single',
      defaultReviewer: defaultReviewer
    };
  }

  /**
   * 配置基于文件类型的分配模式
   */
  private async configureTypeBasedAssignment(
    selectedFiles: (ComponentSuggestion | FunctionSuggestion)[],
    userChoices: any[]
  ): Promise<BatchAssignmentOptions> {
    console.log(chalk.yellow('\n📋 文件类型分配模式：根据文件扩展名智能分配'));

    // 分析文件类型
    const fileTypes = this.analyzeFileTypes(selectedFiles);
    const typeBasedMapping: Record<string, number> = {};

    console.log(chalk.blue('\n检测到的文件类型：'));
    
    for (const [extension, files] of Object.entries(fileTypes)) {
      console.log(chalk.cyan(`  ${extension}: ${files.length} 个文件`));
      
      // 尝试从缓存获取推荐审查人员
      const recommendedReviewer = await this.getRecommendedReviewerForType(extension, userChoices);
      
      const choices = [...userChoices];
      if (recommendedReviewer) {
        // 将推荐的审查人员标记并移到前面
        const index = choices.findIndex(choice => choice.value === recommendedReviewer);
        if (index !== -1) {
          const recommended = choices.splice(index, 1)[0];
          recommended.name = `⭐ ${recommended.name} [AI推荐]`;
          choices.unshift(recommended);
        }
      }

      const { reviewer } = await inquirer.prompt([{
        type: 'list',
        name: 'reviewer',
        message: `为 ${extension} 文件选择审查人员:`,
        choices: choices,
        pageSize: 12,
        default: recommendedReviewer
      }]);

      typeBasedMapping[extension] = reviewer;
    }

    return {
      mode: 'byType',
      typeBasedMapping
    };
  }

  /**
   * 配置基于目录的分配模式
   */
  private async configureDirectoryBasedAssignment(
    selectedFiles: (ComponentSuggestion | FunctionSuggestion)[],
    userChoices: any[]
  ): Promise<BatchAssignmentOptions> {
    console.log(chalk.yellow('\n📋 目录结构分配模式：根据文件所在目录分配'));

    // 分析目录结构
    const directories = this.analyzeDirectories(selectedFiles);
    const directoryBasedMapping: Record<string, number> = {};

    console.log(chalk.blue('\n检测到的目录：'));
    
    for (const [directory, files] of Object.entries(directories)) {
      console.log(chalk.cyan(`  ${directory}: ${files.length} 个文件`));
      
      const { reviewer } = await inquirer.prompt([{
        type: 'list',
        name: 'reviewer',
        message: `为 ${directory} 目录选择审查人员:`,
        choices: userChoices,
        pageSize: 12
      }]);

      directoryBasedMapping[directory] = reviewer;
    }

    return {
      mode: 'byDirectory',
      directoryBasedMapping
    };
  }

  /**
   * 执行批量分配
   */
  async executeBatchAssignment(
    selectedFiles: (ComponentSuggestion | FunctionSuggestion)[],
    options: BatchAssignmentOptions,
    userChoices: any[]
  ): Promise<AssignmentResult[]> {
    const results: AssignmentResult[] = [];

    for (const file of selectedFiles) {
      let reviewerId: number;
      let assignmentReason: string;

      switch (options.mode) {
        case 'single':
          reviewerId = options.defaultReviewer!;
          assignmentReason = '统一分配';
          break;

        case 'byType':
          const extension = path.extname(file.relativePath).toLowerCase() || '.other';
          reviewerId = options.typeBasedMapping![extension] || options.typeBasedMapping!['.other'] || userChoices[0].value;
          assignmentReason = `文件类型: ${extension}`;
          break;

        case 'byDirectory':
          const directory = this.getMainDirectory(file.relativePath);
          reviewerId = options.directoryBasedMapping![directory] || userChoices[0].value;
          assignmentReason = `目录: ${directory}`;
          break;

        default:
          reviewerId = userChoices[0].value;
          assignmentReason = '默认分配';
      }

      const reviewer = userChoices.find(choice => choice.value === reviewerId);
      const reviewerName = reviewer ? reviewer.short || reviewer.name.replace(/⭐\s*/, '').replace(/\s*\[.*?\]/, '') : '未知';

      results.push({
        filePath: file.relativePath,
        fileName: file.name,
        reviewerId,
        reviewerName,
        assignmentReason
      });

      // 更新文件审查偏好缓存
      await this.cacheManager.updateFileReviewerPreference(file.relativePath, reviewerId);
    }

    return results;
  }

  /**
   * 显示分配结果预览并确认
   */
  async showAssignmentPreview(results: AssignmentResult[]): Promise<'confirmed' | 'retry' | 'cancel'> {
    console.log(chalk.blue('\n📋 批量分配结果预览：'));
    console.log(chalk.gray('─'.repeat(60)));

    // 按审查人员分组显示
    const groupedByReviewer = results.reduce((groups, result) => {
      if (!groups[result.reviewerName]) {
        groups[result.reviewerName] = [];
      }
      groups[result.reviewerName].push(result);
      return groups;
    }, {} as Record<string, AssignmentResult[]>);

    Object.entries(groupedByReviewer).forEach(([reviewerName, files]) => {
      console.log(chalk.cyan(`\n👤 ${reviewerName} (${files.length} 个文件):`));
      files.forEach(file => {
        console.log(chalk.gray(`   📁 ${file.fileName} (${file.assignmentReason})`));
      });
    });

    console.log(chalk.gray('\n' + '─'.repeat(60)));

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '请选择操作:',
      choices: [
        { name: '✅ 确认分配并继续', value: 'confirmed' },
        { name: '🔄 重新选择分配方式', value: 'retry' },
        { name: '❌ 取消分配', value: 'cancel' }
      ],
      default: 'confirmed'
    }]);

    return action;
  }

  /**
   * 支持个别文件调整
   */
  async adjustIndividualAssignments(
    results: AssignmentResult[],
    userChoices: any[]
  ): Promise<AssignmentResult[]> {
    const { needAdjustment } = await inquirer.prompt([{
      type: 'confirm',
      name: 'needAdjustment',
      message: '需要调整个别文件的审查人员吗？',
      default: false
    }]);

    if (!needAdjustment) {
      return results;
    }

    console.log(chalk.blue('\n✏️ 个别调整模式：'));

    const adjustedResults = [...results];

    const { filesToAdjust } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'filesToAdjust',
      message: '选择需要调整的文件：',
      choices: results.map((result, index) => ({
        name: `${result.fileName} → 当前: ${result.reviewerName}`,
        value: index,
        short: result.fileName
      })),
      pageSize: 12
    }]);

    for (const index of filesToAdjust) {
      const result = adjustedResults[index];
      console.log(chalk.cyan(`\n📝 调整文件: ${result.fileName}`));
      console.log(chalk.gray(`   当前审查人员: ${result.reviewerName}`));

      const { newReviewer } = await inquirer.prompt([{
        type: 'list',
        name: 'newReviewer',
        message: '选择新的审查人员:',
        choices: userChoices,
        pageSize: 12
      }]);

      const reviewer = userChoices.find(choice => choice.value === newReviewer);
      const reviewerName = reviewer ? reviewer.short || reviewer.name.replace(/⭐\s*/, '').replace(/\s*\[.*?\]/, '') : '未知';

      adjustedResults[index] = {
        ...result,
        reviewerId: newReviewer,
        reviewerName,
        assignmentReason: '手动调整'
      };

      // 更新缓存
      await this.cacheManager.updateFileReviewerPreference(result.filePath, newReviewer);

      console.log(chalk.green(`   ✅ 已调整为: ${reviewerName}`));
    }

    return adjustedResults;
  }

  /**
   * 分析文件类型
   */
  private analyzeFileTypes(files: (ComponentSuggestion | FunctionSuggestion)[]): Record<string, typeof files> {
    return files.reduce((types, file) => {
      const extension = path.extname(file.relativePath).toLowerCase() || '.other';
      if (!types[extension]) {
        types[extension] = [];
      }
      types[extension].push(file);
      return types;
    }, {} as Record<string, typeof files>);
  }

  /**
   * 分析目录结构
   */
  private analyzeDirectories(files: (ComponentSuggestion | FunctionSuggestion)[]): Record<string, typeof files> {
    return files.reduce((dirs, file) => {
      const directory = this.getMainDirectory(file.relativePath);
      if (!dirs[directory]) {
        dirs[directory] = [];
      }
      dirs[directory].push(file);
      return dirs;
    }, {} as Record<string, typeof files>);
  }

  /**
   * 获取文件的主要目录
   */
  private getMainDirectory(filePath: string): string {
    const parts = filePath.split('/').filter(part => part.length > 0);
    
    // 寻找有意义的目录名
    const meaningfulDirs = ['components', 'pages', 'views', 'utils', 'services', 'api', 'store', 'features', 'modules'];
    
    for (const part of parts) {
      if (meaningfulDirs.includes(part.toLowerCase())) {
        return part;
      }
    }
    
    // 如果没找到有意义的目录，返回第一个目录或根目录
    return parts.length > 1 ? parts[0] : 'root';
  }

  /**
   * 根据文件类型从缓存获取推荐审查人员
   */
  private async getRecommendedReviewerForType(extension: string, userChoices: any[]): Promise<number | null> {
    // 创建临时文件路径用于获取推荐
    const tempFilePath = `temp${extension}`;
    return await this.cacheManager.getRecommendedReviewerForFile(tempFilePath, userChoices);
  }
}
