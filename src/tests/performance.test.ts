/**
 * 性能测试用例
 * 用于验证优化后的性能表现
 */

import { performanceMonitor, measurePerformance } from '../utils/performanceMonitor';
import { requestController, executeWithConcurrencyControl } from '../utils/requestConcurrencyController';
import { taskStore } from '../store/taskStore';

// 模拟API响应延迟
const mockApiCall = (delay: number = 1000): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { tasks: [], success: true } });
    }, delay);
  });
};

// 模拟AI API调用（较慢）
const mockAiApiCall = (delay: number = 3000): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { result: 'AI处理完成', created_count: 2 } });
    }, delay);
  });
};

describe('性能监控测试', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
  });

  test('应该正确记录API调用性能', async () => {
    const result = await measurePerformance(
      'test_api_call',
      () => mockApiCall(500),
      'api'
    );

    expect(result.data.success).toBe(true);
    
    const metrics = performanceMonitor.getRecentMetrics(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test_api_call');
    expect(metrics[0].category).toBe('api');
    expect(metrics[0].value).toBeGreaterThan(400); // 至少400ms
    expect(metrics[0].value).toBeLessThan(700); // 不超过700ms
  });

  test('应该正确记录AI调用性能', async () => {
    const result = await measurePerformance(
      'test_ai_call',
      () => mockAiApiCall(2000),
      'ai',
      { input_length: 100 }
    );

    expect(result.data.result).toBe('AI处理完成');
    
    const metrics = performanceMonitor.getRecentMetrics(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test_ai_call');
    expect(metrics[0].category).toBe('ai');
    expect(metrics[0].metadata?.input_length).toBe(100);
  });

  test('应该生成正确的性能报告', async () => {
    // 记录多个指标
    await measurePerformance('fast_operation', () => mockApiCall(100), 'api');
    await measurePerformance('slow_operation', () => mockApiCall(2000), 'api');
    await measurePerformance('ai_operation', () => mockAiApiCall(1500), 'ai');

    const report = performanceMonitor.generateReport();
    
    expect(report.totalMetrics).toBe(3);
    expect(report.categoryStats.api.count).toBe(2);
    expect(report.categoryStats.ai.count).toBe(1);
    expect(report.slowestOperations).toHaveLength(3);
    expect(report.slowestOperations[0].name).toBe('slow_operation');
  });

  test('应该正确处理错误记录', async () => {
    try {
      await measurePerformance(
        'error_operation',
        () => Promise.reject(new Error('测试错误')),
        'api'
      );
    } catch (error) {
      // 预期的错误
    }

    const metrics = performanceMonitor.getRecentMetrics(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].metadata?.error).toBe(true);
    
    const report = performanceMonitor.generateReport();
    expect(report.errorRate).toBe(100); // 100%错误率
  });
});

describe('并发控制测试', () => {
  beforeEach(() => {
    // 重置并发控制器状态
    requestController.setMaxConcurrentRequests(2);
  });

  test('应该限制并发请求数量', async () => {
    const startTime = Date.now();
    
    // 同时发起4个请求，但最大并发数为2
    const promises = [
      requestController.executeRequest(() => mockApiCall(1000), 'high'),
      requestController.executeRequest(() => mockApiCall(1000), 'high'),
      requestController.executeRequest(() => mockApiCall(1000), 'medium'),
      requestController.executeRequest(() => mockApiCall(1000), 'low')
    ];

    await Promise.all(promises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // 由于并发限制，总时间应该大于2秒（两批执行）
    expect(totalTime).toBeGreaterThan(1800);
    expect(totalTime).toBeLessThan(2500);
  });

  test('应该按优先级处理请求', async () => {
    const results: string[] = [];
    
    // 先填满并发槽位
    const blockingPromises = [
      requestController.executeRequest(() => mockApiCall(1500), 'low'),
      requestController.executeRequest(() => mockApiCall(1500), 'low')
    ];

    // 然后添加不同优先级的请求到队列
    setTimeout(() => {
      requestController.executeRequest(() => {
        results.push('low');
        return mockApiCall(100);
      }, 'low');
      
      requestController.executeRequest(() => {
        results.push('high');
        return mockApiCall(100);
      }, 'high');
      
      requestController.executeRequest(() => {
        results.push('medium');
        return mockApiCall(100);
      }, 'medium');
    }, 100);

    await Promise.all(blockingPromises);
    
    // 等待队列中的请求完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 高优先级应该先执行
    expect(results[0]).toBe('high');
    expect(results[1]).toBe('medium');
    expect(results[2]).toBe('low');
  });

  test('应该正确报告并发状态', () => {
    const status = requestController.getStatus();
    
    expect(status.currentRequests).toBe(0);
    expect(status.queuedRequests).toBe(0);
    expect(status.maxConcurrentRequests).toBe(2);
  });
});

describe('集成性能测试', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
  });

  test('应该在实际使用场景中保持良好性能', async () => {
    const startTime = Date.now();
    
    // 模拟用户的典型操作序列
    const operations = [
      () => measurePerformance('fetch_tasks', () => mockApiCall(800), 'api'),
      () => measurePerformance('create_task', () => mockApiCall(600), 'api'),
      () => measurePerformance('ai_parse', () => mockAiApiCall(2500), 'ai'),
      () => measurePerformance('update_task', () => mockApiCall(400), 'api'),
      () => measurePerformance('delete_task', () => mockApiCall(300), 'api')
    ];

    // 使用并发控制执行操作
    const results = await Promise.all(
      operations.map((op, index) => 
        requestController.executeRequest(op, index < 2 ? 'high' : 'medium')
      )
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(5);
    expect(totalTime).toBeLessThan(6000); // 应该在6秒内完成
    
    // 检查性能报告
    const report = performanceMonitor.generateReport();
    expect(report.totalMetrics).toBe(5);
    expect(report.categoryStats.api.count).toBe(4);
    expect(report.categoryStats.ai.count).toBe(1);
    expect(report.averageResponseTime).toBeLessThan(2000); // 平均响应时间小于2秒
  });

  test('应该在高负载情况下保持稳定', async () => {
    const concurrentOperations = 5; // 减少并发数量
    const operations = Array.from({ length: concurrentOperations }, (_, i) => 
      () => measurePerformance(
        `load_test_${i}`,
        () => mockApiCall(Math.random() * 1000 + 500),
        'api'
      )
    );

    const startTime = Date.now();
    
    const results = await Promise.all(
      operations.map(op => requestController.executeRequest(op, 'medium'))
    );
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrentOperations);
    
    // 由于并发限制，不应该同时执行所有请求
    const report = performanceMonitor.generateReport();
    expect(report.totalMetrics).toBe(concurrentOperations);
    expect(report.errorRate).toBe(0); // 无错误
    
    // 验证并发控制生效
    expect(totalTime).toBeGreaterThan(2000); // 至少需要几批执行
  });
});