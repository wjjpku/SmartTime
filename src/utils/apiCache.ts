/**
 * API缓存管理器
 * 用于缓存API响应，减少重复请求
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
}

export class ApiCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 默认5分钟

  /**
   * 生成缓存键
   */
  private generateKey(url: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${url}${paramStr}`;
  }

  /**
   * 获取缓存数据
   */
  get(url: string, params?: any): any | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`[CACHE HIT] ${key}`);
    return entry.data;
  }

  /**
   * 设置缓存数据
   */
  set(url: string, data: any, params?: any, ttl?: number): void {
    const key = this.generateKey(url, params);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    
    this.cache.set(key, entry);
    console.log(`[CACHE SET] ${key}, TTL: ${entry.ttl}ms`);
  }

  /**
   * 删除缓存
   */
  delete(url: string, params?: any): void {
    const key = this.generateKey(url, params);
    this.cache.delete(key);
    console.log(`[CACHE DELETE] ${key}`);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    console.log('[CACHE] 所有缓存已清空');
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[CACHE CLEANUP] 清理了 ${cleanedCount} 个过期缓存`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局缓存实例
export const apiCache = new ApiCache();

// 定期清理过期缓存
setInterval(() => {
  apiCache.cleanup();
}, 60000); // 每分钟清理一次

/**
 * 带缓存的请求包装器
 */
export const withCache = async <T>(
  url: string,
  requestFn: () => Promise<T>,
  params?: any,
  ttl?: number
): Promise<T> => {
  // 尝试从缓存获取
  const cached = apiCache.get(url, params);
  if (cached) {
    return cached;
  }
  
  // 执行请求
  const result = await requestFn();
  
  // 缓存结果
  apiCache.set(url, result, params, ttl);
  
  return result;
};