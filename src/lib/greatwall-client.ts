/**
 * 长城后端 HTTP 客户端
 * 基于 ai-cr 项目的 apiClient.ts，适配为 CLI 项目使用
 */

import { 
  GreatWallApiConfig, 
  GreatWallRequestOptions, 
  GreatWallApiResponse 
} from '../types/index.js';

export class GreatWallApiClient {
  private config: Required<GreatWallApiConfig>;

  constructor(config: GreatWallApiConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // 移除末尾斜杠
      timeout: config.timeout ?? 30000,
      retryCount: config.retryCount ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      token: config.token ?? '',
      apiKey: config.apiKey ?? ''
    };
  }

  /**
   * 发送HTTP请求
   */
  async request<T = any>(endpoint: string, options: GreatWallRequestOptions = {}): Promise<GreatWallApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      timeout = this.config.timeout,
      retryCount = this.config.retryCount,
      body
    } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    
    // 默认请求头
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'fshows-iteration-cli/1.0.0'
    };

    // 添加认证头
    if (this.config.token) {
      defaultHeaders['Authorization'] = `Bearer ${this.config.token}`;
    }

    // 添加API Key认证（用于长城后端API）
    if (this.config.apiKey) {
      defaultHeaders['x-api-key'] = this.config.apiKey;
    }

    const finalHeaders = { ...defaultHeaders, ...headers };
    
    // 准备请求选项
    const fetchOptions: RequestInit = {
      method,
      headers: finalHeaders,
      signal: AbortSignal.timeout(timeout)
    };

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // 执行请求（带重试机制）
    return this.executeWithRetry(url, fetchOptions, retryCount);
  }

  /**
   * 带重试机制的请求执行
   */
  private async executeWithRetry<T>(
    url: string, 
    options: RequestInit, 
    retriesLeft: number
  ): Promise<GreatWallApiResponse<T>> {
    try {
      // console.log(`🌐 发送请求到长城后端: ${url}`);
      // console.log(`📋 请求头:`, options.headers);
      
      const response = await fetch(url, options);
      
      // console.log(`📊 响应状态: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as GreatWallApiResponse<T>;
      // console.log(`✅响应数据:`, data);
      
      // 检查业务状态码
      if (data.success === false) {
        const errorMsg = data.errorMsg || data.message || '长城后端API错误';
        const errorCode = data.errorCode || data.code || 'UNKNOWN';
        throw new Error(`${errorMsg} (错误码: ${errorCode})`);
      }
      
      // 兼容旧的code字段检查
      if (data.code && data.code !== 200) {
        throw new Error(data.message || `长城后端API错误: ${data.code}`);
      }

      return data;
    } catch (error) {
      // console.log(`❌ 请求错误:`, error);
      
      // 如果是网络错误且还有重试次数，则重试
      if (retriesLeft > 0 && this.shouldRetry(error as Error)) {
        console.warn(`🔄 请求失败，${this.config.retryDelay}ms后重试... (剩余${retriesLeft}次)`);
        await this.delay(this.config.retryDelay);
        return this.executeWithRetry(url, options, retriesLeft - 1);
      }
      
      throw error;
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    // 网络错误、超时错误等应该重试
    return error.name === 'AbortError' || 
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET请求
   */
  async get<T = any>(endpoint: string, options?: Omit<GreatWallRequestOptions, 'method' | 'body'>): Promise<GreatWallApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = any>(endpoint: string, body?: any, options?: Omit<GreatWallRequestOptions, 'method'>): Promise<GreatWallApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT请求
   */
  async put<T = any>(endpoint: string, body?: any, options?: Omit<GreatWallRequestOptions, 'method'>): Promise<GreatWallApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(endpoint: string, options?: Omit<GreatWallRequestOptions, 'method' | 'body'>): Promise<GreatWallApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<GreatWallApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<GreatWallApiConfig>> {
    return { ...this.config };
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 尝试获取项目组列表来测试连接
      await this.post('/common/getProjectList', {});
      return true;
    } catch (error) {
      console.warn('长城后端连接测试失败:', (error as Error).message);
      return false;
    }
  }
}