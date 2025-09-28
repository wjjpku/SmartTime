/**
 * 请求并发控制器
 * 用于限制同时进行的AI请求数量，避免服务器过载
 */

interface QueuedRequest {
  id: string;
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export class RequestConcurrencyController {
  private maxConcurrentRequests: number;
  private currentRequests: Set<string> = new Set();
  private requestQueue: QueuedRequest[] = [];
  private requestId = 0;

  constructor(maxConcurrentRequests: number = 2) {
    this.maxConcurrentRequests = maxConcurrentRequests;
  }

  /**
   * 执行请求（带并发控制）
   */
  async executeRequest<T>(
    requestFn: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}_${Date.now()}`;
      const queuedRequest: QueuedRequest = {
        id,
        requestFn,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      };

      // 如果当前请求数未达到上限，立即执行
      if (this.currentRequests.size < this.maxConcurrentRequests) {
        this.executeQueuedRequest(queuedRequest);
      } else {
        // 否则加入队列
        this.addToQueue(queuedRequest);
      }
    });
  }

  /**
   * 添加请求到队列（按优先级排序）
   */
  private addToQueue(request: QueuedRequest): void {
    this.requestQueue.push(request);
    
    // 按优先级和时间戳排序
    this.requestQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // 相同优先级按时间排序（先进先出）
      return a.timestamp - b.timestamp;
    });

    console.log(`[CONCURRENCY] 请求 ${request.id} 已加入队列，当前队列长度: ${this.requestQueue.length}`);
  }

  /**
   * 执行队列中的请求
   */
  private async executeQueuedRequest(request: QueuedRequest): Promise<void> {
    this.currentRequests.add(request.id);
    
    console.log(`[CONCURRENCY] 开始执行请求 ${request.id}，当前并发数: ${this.currentRequests.size}`);

    try {
      const result = await request.requestFn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.currentRequests.delete(request.id);
      console.log(`[CONCURRENCY] 请求 ${request.id} 执行完成，当前并发数: ${this.currentRequests.size}`);
      
      // 执行队列中的下一个请求
      this.processQueue();
    }
  }

  /**
   * 处理队列中的下一个请求
   */
  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.currentRequests.size < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift()!;
      this.executeQueuedRequest(nextRequest);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    currentRequests: number;
    queuedRequests: number;
    maxConcurrentRequests: number;
  } {
    return {
      currentRequests: this.currentRequests.size,
      queuedRequests: this.requestQueue.length,
      maxConcurrentRequests: this.maxConcurrentRequests
    };
  }

  /**
   * 更新最大并发数
   */
  setMaxConcurrentRequests(max: number): void {
    this.maxConcurrentRequests = max;
    // 如果增加了并发数，尝试处理队列
    this.processQueue();
  }

  /**
   * 清空队列（取消所有等待的请求）
   */
  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('请求已被取消'));
    });
    this.requestQueue = [];
    console.log('[CONCURRENCY] 队列已清空');
  }
}

// 创建全局实例
export const requestController = new RequestConcurrencyController(2);

// 导出便捷方法
export const executeWithConcurrencyControl = <T>(
  requestFn: () => Promise<T>,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<T> => {
  return requestController.executeRequest(requestFn, priority);
};