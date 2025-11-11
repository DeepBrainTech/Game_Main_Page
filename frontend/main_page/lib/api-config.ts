/**
 * API 配置
 * 使用环境变量 NEXT_PUBLIC_API_URL，如果没有设置则使用本地开发默认值
 */
export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

/**
 * 获取完整的 API 端点 URL
 * @param endpoint API 端点路径（如 '/api/auth/login'）
 * @returns 完整的 API URL
 */
export function getApiUrl(endpoint: string): string {
  // 确保 endpoint 以 / 开头
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // 移除 API_BASE_URL 末尾可能存在的斜杠，避免双斜杠
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  return `${baseUrl}${path}`;
}

