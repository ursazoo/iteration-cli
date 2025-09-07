/**
 * 长城后端专用服务类
 * 基于 ai-cr 项目的服务层设计，提供项目组、用户、报告等相关功能
 */

import { GreatWallApiClient } from './greatwall-client.js';
import {
  GreatWallProjectGroup,
  GreatWallProjectGroupListResponse,
  GreatWallUser,
  GreatWallUserInfoResponse,
  GreatWallProject,
  GreatWallProjectDetailResponse,
  GreatWallProjectListResponse,
  GreatWallProjectListParams,
  GreatWallReviewReport,
  GreatWallReportUploadRequest,
  GreatWallReportUploadResponse,
  GreatWallReportListResponse,
  GreatWallReportDetailResponse,
  GreatWallReportListParams,
  GreatWallCreateSprintParams,
  GreatWallCreateCrRequestParams
} from '../types/index.js';

/**
 * 长城项目服务
 */
export class GreatWallProjectService {
  constructor(private apiClient: GreatWallApiClient) {}

  /**
   * 获取项目组列表
   */
  async getProjectGroupList(): Promise<GreatWallProjectGroup[]> {
    const response = await this.apiClient.post<GreatWallProjectGroupListResponse>(
      '/common/getProjectList',
      {}
    );

    return response.data?.list || [];
  }

  /**
   * 获取项目组选择列表（用于用户选择）
   */
  async getProjectGroupChoices(): Promise<Array<{name: string, value: string}>> {
    const projectGroups = await this.getProjectGroupList();
    
    return projectGroups.map(group => ({
      name: group.name,
      value: group.id
    }));
  }

  /**
   * 获取项目详情
   */
  async getProjectDetail(projectId: string): Promise<GreatWallProject | null> {
    try {
      const response = await this.apiClient.get<GreatWallProjectDetailResponse>(
        `/project/detail/${projectId}`
      );
      return response.data?.project || null;
    } catch (error) {
      console.warn('获取项目详情失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 获取项目列表
   */
  async getProjectList(params?: GreatWallProjectListParams): Promise<GreatWallProjectListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.groupId) queryParams.set('groupId', params.groupId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.keyword) queryParams.set('keyword', params.keyword);

    const url = `/project/list?${queryParams.toString()}`;
    const response = await this.apiClient.get<GreatWallProjectListResponse>(url);

    return response.data || { list: [], total: 0, page: 1, pageSize: 10 };
  }

  /**
   * 创建迭代
   */
  async createSprint(params: GreatWallCreateSprintParams): Promise<any> {
    const response = await this.apiClient.post('/codeReview/createSprint', params);
    return response.data;
  }

  /**
   * 创建CR申请单
   */
  async createCrRequest(params: GreatWallCreateCrRequestParams): Promise<any> {
    const response = await this.apiClient.post('/codeReview/createCrRequest', params);
    return response.data;
  }
}

/**
 * 长城用户服务
 */
export class GreatWallUserService {
  constructor(private apiClient: GreatWallApiClient) {}

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<GreatWallUser | null> {
    try {
      const response = await this.apiClient.get<GreatWallUserInfoResponse>(
        '/common/getUserInfo'
      );
      return response.data?.user || null;
    } catch (error) {
      console.warn('获取用户信息失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 根据真实姓名查询用户列表
   */
  async getUserList(realName?: string): Promise<GreatWallUser[]> {
    try {
      const requestBody = realName ? { realName } : {};
      const response = await this.apiClient.post<{ list: any[] }>(
        '/common/getUserList',
        requestBody
      );

      // 映射后端返回的数据格式到统一格式
      const users = response.data?.list?.map(backendUser => ({
        id: backendUser.id.toString(),
        username: backendUser.realName || '',
        name: backendUser.realName || '',
        email: backendUser.email || '',
        role: 'user',
        avatar: backendUser.avatar || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) || [];

      return users;
    } catch (error) {
      console.warn('查询用户列表失败:', (error as Error).message);
      return [];
    }
  }

  /**
   * 获取所有用户列表（不带搜索条件）
   */
  async getAllUsers(): Promise<GreatWallUser[]> {
    return this.getUserList();
  }
}

/**
 * 长城报告服务
 */
export class GreatWallReportService {
  constructor(private apiClient: GreatWallApiClient) {}

  /**
   * 上传代码审查报告
   */
  async uploadReport(
    reportData: any,
    markdownContent: string,
    projectGroupId: string,
    userId: string,
    userName: string,
    branchName?: string
  ): Promise<GreatWallReportUploadResponse> {
    // 获取当前分支名
    let currentBranchName = branchName || 'main';
    try {
      // 在 MCP 环境中可能无法直接执行 git 命令，使用传入的 branchName
      if (!branchName) {
        console.log('⚠️ 未提供分支名，使用默认值: main');
      }
    } catch (error) {
      console.log('⚠️ 无法获取 git 分支信息，使用默认值: main');
    }

    // 构造符合长城后端API期望的数据格式
    const uploadRequest: GreatWallReportUploadRequest = {
      projectId: parseInt(projectGroupId),
      userName: userName,
      branchName: currentBranchName,
      reviewContent: markdownContent
    };

    console.log('📤 上传报告到长城后端:', {
      projectId: uploadRequest.projectId,
      userName: uploadRequest.userName,
      branchName: uploadRequest.branchName,
      contentLength: markdownContent.length
    });

    const response = await this.apiClient.post<GreatWallReportUploadResponse>(
      '/document/createCodeReviewDocument',
      uploadRequest
    );

    if (!response.data) {
      throw new Error('上传报告失败：长城后端未返回有效响应');
    }

    console.log('✅ 报告上传成功:', response.data);
    return response.data;
  }

  /**
   * 获取报告列表
   */
  async getReportList(params?: GreatWallReportListParams): Promise<GreatWallReportListResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
      if (params?.projectId) queryParams.set('projectId', params.projectId);
      if (params?.userId) queryParams.set('userId', params.userId);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.reviewMode) queryParams.set('reviewMode', params.reviewMode);
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);

      const url = `/report/list?${queryParams.toString()}`;
      const response = await this.apiClient.get<GreatWallReportListResponse>(url);

      return response.data || { list: [], total: 0, page: 1, pageSize: 10 };
    } catch (error) {
      console.warn('获取报告列表失败:', (error as Error).message);
      return { list: [], total: 0, page: 1, pageSize: 10 };
    }
  }

  /**
   * 获取报告详情
   */
  async getReportDetail(reportId: string): Promise<GreatWallReviewReport | null> {
    try {
      const response = await this.apiClient.get<GreatWallReportDetailResponse>(
        `/report/detail/${reportId}`
      );
      return response.data?.report || null;
    } catch (error) {
      console.warn('获取报告详情失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 更新报告状态
   */
  async updateReportStatus(reportId: string, status: string): Promise<boolean> {
    try {
      const response = await this.apiClient.put(
        `/report/updateStatus/${reportId}`,
        { status }
      );
      return response.code === 200;
    } catch (error) {
      console.warn('更新报告状态失败:', (error as Error).message);
      return false;
    }
  }

  /**
   * 删除报告
   */
  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const response = await this.apiClient.delete(
        `/report/delete/${reportId}`
      );
      return response.code === 200;
    } catch (error) {
      console.warn('删除报告失败:', (error as Error).message);
      return false;
    }
  }
}

/**
 * 长城API管理器
 * 统一管理所有长城后端相关的服务
 */
export class GreatWallApiManager {
  private apiClient: GreatWallApiClient;
  
  public readonly project: GreatWallProjectService;
  public readonly user: GreatWallUserService;
  public readonly report: GreatWallReportService;

  constructor(config: { baseUrl: string; apiKey?: string; timeout?: number }) {
    this.apiClient = new GreatWallApiClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      retryCount: 3,
      retryDelay: 1000
    });
    
    this.project = new GreatWallProjectService(this.apiClient);
    this.user = new GreatWallUserService(this.apiClient);
    this.report = new GreatWallReportService(this.apiClient);
  }

  /**
   * 更新API配置
   */
  updateConfig(config: Partial<{ baseUrl: string; apiKey?: string; timeout?: number }>): void {
    this.apiClient.updateConfig(config);
  }

  /**
   * 获取API配置
   */
  getConfig() {
    return this.apiClient.getConfig();
  }

  /**
   * 测试长城后端连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.project.getProjectGroupList();
      return true;
    } catch (error) {
      console.warn('长城后端连接测试失败:', (error as Error).message);
      return false;
    }
  }
}