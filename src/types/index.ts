// 用户列表接口返回类型（统一使用）
export interface UserInfo {
  id: number;
  realName: string;
}

// 迭代信息相关类型
export interface IterationBasicInfo {
  projectLine: string;        // 所属项目线
  iterationName: string;      // 迭代名称
  onlineTime: string;         // 上线时间
  createUserId: string;       // 创建人ID（字符串形式，来自inquirer）
  remarks?: string;           // 备注
}

// 项目信息
export interface ProjectInfo {
  projectName: string;
  participants: string[];
  checkUsers: string[];
  startDate: string;
  endDate: string;
  description: string;
}

export interface ComponentModule {
  name: string;              // 组件名称
  url?: string;             // 组件地址
  relativePath: string;      // 项目内相对路径
  checkUser: string;          // 审核人员ID
  image?: {
    type: 'clipboard' | 'file' | 'upload_later';
    value?: string;          // 文件路径或上传链接
  };
}

export interface FunctionModule {
  name: string;              // 功能名称
  relativePath: string;      // 项目内相对路径
  checkUser: string;          // 审核人员ID
  description?: string;      // 功能描述
}

export interface CRApplication {
  projectInfo: ProjectInfo;
  componentModules: ComponentModule[];
  functionModules: FunctionModule[];
}

export interface CompleteIteration {
  basicInfo: IterationBasicInfo;
  crApplication: CRApplicationData;
}

// 正确的CR申请单数据结构
export interface CRApplicationData {
  reqDocUrl: string;           // 产品文档
  techDocUrl: string;          // 技术分析文档
  projexUrl: string;           // 项目大盘链接（一般填"-"）
  uxDocUrl: string;            // 设计稿链接
  gitlabUrl: string;           // 项目git地址
  gitProjectName: string;      // git项目名称
  gitlabBranch: string;        // 分支名
  participantIds: string;      // 参与人员ID（逗号分隔）
  checkUserIds: string;        // 审核人员ID（逗号分隔）
  spendTime: string;           // 预估工时
  componentList: ComponentItem[];
  functionList: FunctionItem[];
  sprintId: number;            // 迭代ID
}

export interface ComponentItem {
  componentName: string;       // 组件名称
  address: string;             // 组件相对路径
  auditId: number;             // 审核人员ID
  imgUrl: string;              // 组件截图URL
}

export interface FunctionItem {
  desc: string;                // 功能描述
}

// 本地缓存数据
export interface LocalCache {
  projectLines: string[]; // 项目线选项
  defaultProjectLine?: string; // 默认项目线
  participants: UserInfo[]; // 参与人员列表（从API缓存）
  checkUsers: UserInfo[]; // 审核人员列表（从API缓存）
  recentParticipants: number[]; // 最近使用的参与人员ID
  recentCheckUsers: number[]; // 最近使用的审核人员ID
  gitInfo?: {
    projectUrl: string;
    projectName: string;
  };
  lastUpdated: number; // 缓存更新时间
}

// 迭代模板类型
export interface IterationTemplate {
  basicInfo: IterationBasicInfo;
  crApplication: CRApplication;
}

// ==================== 长城后端 API 类型定义 ====================

// 长城后端迭代创建参数
export interface GreatWallCreateSprintParams {
  projectId: number;
  name: string;
  releaseTime?: string;  // YYYY-MM-dd HH:mm:ss
  remark?: string;
}

// 长城后端CR申请单创建参数
export interface GreatWallCreateCrRequestParams {
  sprintId: number;
  createUserId: number;      // 创建人ID（服务调用时必需）
  gitProjectName: string;
  gitlabBranch: string;
  reqDocUrl: string;
  techDocUrl: string;
  projexUrl: string;
  uxDocUrl: string;
  gitlabUrl: string;
  spendTime: string;
  participantIds: string;    // 逗号分隔的ID
  checkUserIds: string;      // 逗号分隔的ID
  remark?: string;
  componentList: GreatWallComponentItem[];
  functionList: GreatWallFunctionItem[];
}

export interface GreatWallComponentItem {
  name: string;
  address: string;
  auditId: number;
  imgUrl: string;
}

export interface GreatWallFunctionItem {
  name: string;
  auditId: number;
  desc: string;
}

// 长城后端基础响应结构
export interface GreatWallApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
  success?: boolean;
  errorCode?: number | string;
  errorMsg?: string;
}

// 长城后端分页响应结构
export interface GreatWallPaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 长城项目组相关类型
export interface GreatWallProjectGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GreatWallProjectGroupListResponse {
  list: GreatWallProjectGroup[];
}

// 长城用户相关类型
export interface GreatWallUser {
  id: string;
  username: string;
  email?: string;
  name: string;
  role?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GreatWallUserInfoResponse {
  user: GreatWallUser;
}

// 长城项目相关类型
export interface GreatWallProject {
  id: string;
  name: string;
  description?: string;
  groupId: string;
  groupName: string;
  repositoryUrl?: string;
  mainBranch?: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface GreatWallProjectDetailResponse {
  project: GreatWallProject;
}

export interface GreatWallProjectListResponse extends GreatWallPaginatedResponse<GreatWallProject> {}

// 长城报告相关类型
export interface GreatWallReviewReport {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  reviewMode: 'static' | 'ai' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    generatedAt: string;
    toolVersion: string;
    totalFiles: number;
    totalIssues: number;
    filesWithIssues: number;
    aiProcessed: number;
    cacheHits: number;
  };
  statistics: {
    severityDistribution: {
      critical: number;
      major: number;
      minor: number;
      info: number;
    };
    categoryDistribution: Record<string, number>;
  };
  reportData: any; // 完整的报告数据
  markdownContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GreatWallReportUploadRequest {
  projectId: number;
  userName: string;
  branchName: string;
  reviewContent: string;
}

export interface GreatWallReportUploadResponse {
  reportId: string;
  status: string;
  message?: string;
}

export interface GreatWallReportListResponse extends GreatWallPaginatedResponse<GreatWallReviewReport> {}

export interface GreatWallReportDetailResponse {
  report: GreatWallReviewReport;
}

// 长城 API 配置
export interface GreatWallApiConfig {
  baseUrl: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  token?: string;
  apiKey?: string;
}

// 长城 API 请求选项
export interface GreatWallRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  body?: any;
}

// 长城 API 端点定义
export interface GreatWallApiEndpoints {
  // 公共接口
  common: {
    projectList: string;
    userInfo: string;
    userList: string;
  };
  // 项目相关
  project: {
    detail: string;
    list: string;
    create: string;
    update: string;
  };
  // 用户相关
  user: {
    profile: string;
    settings: string;
  };
  // 文档相关
  document: {
    createCodeReview: string;
  };
  // 迭代相关
  iteration: {
    create: string;
    list: string;
    detail: string;
    update: string;
    delete: string;
  };
  // 报告相关
  report: {
    upload: string;
    list: string;
    detail: string;
    updateStatus: string;
    delete: string;
  };
}

// 请求参数类型
export interface GreatWallPaginationParams {
  page?: number;
  pageSize?: number;
}

export interface GreatWallProjectListParams extends GreatWallPaginationParams {
  groupId?: string;
  status?: string;
  keyword?: string;
}

export interface GreatWallReportListParams extends GreatWallPaginationParams {
  projectId?: string;
  userId?: string;
  status?: string;
  reviewMode?: string;
  startDate?: string;
  endDate?: string;
}

// API错误类型
export interface GreatWallApiError {
  code: number;
  message: string;
  details?: any;
  timestamp: string;
}

// CLI 配置类型
export interface CLIConfig {
  apiBaseUrl: string;
  apiKey: string;
  defaultWorkDir?: string;
}