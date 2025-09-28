/**
 * 性能监控工具
 * 用于收集和分析应用性能指标
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'api' | 'ui' | 'database' | 'ai' | 'general';
  metadata?: Record<string, any>;
}

interface PerformanceReport {
  totalMetrics: number;
  averageResponseTime: number;
  slowestOperations: PerformanceMetric[];
  fastestOperations: PerformanceMetric[];
  errorRate: number;
  categoryStats: Record<string, {
    count: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000; // 最多保存1000条记录
  private errors: Array<{ timestamp: number; error: string; category: string }> = [];

  /**
   * 记录性能指标
   */
  recordMetric(
    name: string,
    value: number,
    category: 'api' | 'ui' | 'database' | 'ai' | 'general',
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.metrics.push(metric);

    // 保持指标数量在限制内
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 如果是慢操作，记录警告
    if (value > 5000) { // 超过5秒
      console.warn(`[PERFORMANCE] 慢操作检测: ${name} 耗时 ${value}ms`, metadata);
    }
  }

  /**
   * 记录错误
   */
  recordError(error: string, category: string): void {
    this.errors.push({
      timestamp: Date.now(),
      error,
      category
    });

    // 保持错误记录在限制内
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
  }

  /**
   * 测量函数执行时间
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    category: 'api' | 'ui' | 'database' | 'ai' | 'general',
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, { ...metadata, error: true });
      this.recordError(error instanceof Error ? error.message : String(error), category);
      throw error;
    }
  }

  /**
   * 测量同步函数执行时间
   */
  measure<T>(
    name: string,
    fn: () => T,
    category: 'api' | 'ui' | 'database' | 'ai' | 'general',
    metadata?: Record<string, any>
  ): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, { ...metadata, error: true });
      this.recordError(error instanceof Error ? error.message : String(error), category);
      throw error;
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    let filteredMetrics = this.metrics;
    
    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    if (filteredMetrics.length === 0) {
      return {
        totalMetrics: 0,
        averageResponseTime: 0,
        slowestOperations: [],
        fastestOperations: [],
        errorRate: 0,
        categoryStats: {}
      };
    }

    // 计算平均响应时间
    const totalTime = filteredMetrics.reduce((sum, metric) => sum + metric.value, 0);
    const averageResponseTime = totalTime / filteredMetrics.length;

    // 找出最慢和最快的操作
    const sortedByTime = [...filteredMetrics].sort((a, b) => b.value - a.value);
    const slowestOperations = sortedByTime.slice(0, 5);
    const fastestOperations = sortedByTime.slice(-5).reverse();

    // 计算错误率
    const errorMetrics = filteredMetrics.filter(metric => metric.metadata?.error);
    const errorRate = (errorMetrics.length / filteredMetrics.length) * 100;

    // 按类别统计
    const categoryStats: Record<string, any> = {};
    const categories = [...new Set(filteredMetrics.map(m => m.category))];
    
    categories.forEach(category => {
      const categoryMetrics = filteredMetrics.filter(m => m.category === category);
      const times = categoryMetrics.map(m => m.value);
      
      categoryStats[category] = {
        count: categoryMetrics.length,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
      };
    });

    return {
      totalMetrics: filteredMetrics.length,
      averageResponseTime,
      slowestOperations,
      fastestOperations,
      errorRate,
      categoryStats
    };
  }

  /**
   * 获取最近的指标
   */
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * 清除所有指标
   */
  clearMetrics(): void {
    this.metrics = [];
    this.errors = [];
  }

  /**
   * 导出性能数据
   */
  exportData(): {
    metrics: PerformanceMetric[];
    errors: Array<{ timestamp: number; error: string; category: string }>;
    report: PerformanceReport;
  } {
    return {
      metrics: this.metrics,
      errors: this.errors,
      report: this.generateReport()
    };
  }

  /**
   * 监控页面性能
   */
  monitorPagePerformance(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // 监控页面加载时间
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ui');
            this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ui');
            this.recordMetric('first_paint', navigation.responseEnd - navigation.fetchStart, 'ui');
          }
        }, 0);
      });

      // 监控资源加载时间
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.recordMetric(
              `resource_load_${resourceEntry.name.split('/').pop()}`,
              resourceEntry.duration,
              'ui',
              { url: resourceEntry.name, type: resourceEntry.initiatorType }
            );
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }
}

/**
 * 请求并发控制器
 */
export class RequestConcurrencyController {
  private maxConcurrent: number;
  private currentRequests: number = 0;
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
  }> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async executeWithConcurrencyControl<T>(
    fn: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = {
        fn,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.currentRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // 按优先级和时间戳排序
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const request = this.queue.shift();
    if (!request) return;

    this.currentRequests++;

    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.currentRequests--;
      this.processQueue();
    }
  }

  getStatus() {
    return {
      currentRequests: this.currentRequests,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = max;
    this.processQueue();
  }
}

// 创建全局实例
export const performanceMonitor = new PerformanceMonitor();
export const requestController = new RequestConcurrencyController(3);

// 自动开始监控页面性能
if (typeof window !== 'undefined') {
  performanceMonitor.monitorPagePerformance();
}

// 导出便捷方法
export const measurePerformance = <T>(
  name: string,
  fn: () => Promise<T>,
  category: 'api' | 'ui' | 'database' | 'ai' | 'general' = 'general',
  metadata?: Record<string, any>
): Promise<T> => {
  return performanceMonitor.measureAsync(name, fn, category, metadata);
};

export const measureSync = <T>(
  name: string,
  fn: () => T,
  category: 'api' | 'ui' | 'database' | 'ai' | 'general' = 'general',
  metadata?: Record<string, any>
): T => {
  return performanceMonitor.measure(name, fn, category, metadata);
};