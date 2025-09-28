// API性能测试脚本
import axios from 'axios';

// 配置
const API_BASE_URL = 'http://localhost:8000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlFHdmYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL25jdHBzYXdydXRlZGtweWp3dHJzLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxOGMyNjI5OS05N2VlLTQ3NjUtODcwMi1jNTgxYWUzZDU1ZDciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU5MDQwNTQwLCJpYXQiOjE3NTkwMzY5NDAsImVtYWlsIjoiMzMyMzUxNjI3OUBxcS5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImF2YXRhcl91cmwiOiJodHRwczovL25jdHBzYXdydXRlZGtweWp3dHJzLnN1cGFiYXNlLmNvL3N0b3JhZ2UvdjEvb2JqZWN0L3B1YmxpYy9hdmF0YXJzLzE4YzI2Mjk5LTk3ZWUtNDc2NS04NzAyLWM1ODFhZTNkNTVkNy5qcGciLCJlbWFpbCI6IjMzMjM1MTYyNzlAcXEuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiMThjMjYyOTktOTdlZS00NzY1LTg3MDItYzU4MWFlM2Q1NWQ3IiwidXNlcm5hbWUiOiIxMTEifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc1OTAzNjk0MH1dLCJzZXNzaW9uX2lkIjoiOTdiOWZkNDctYzU0ZC00NTQxLWI4MmMtYjNkMTI1ZThmYmQzIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.Wwfq3BSJ4a_WQRpNPARaUs6hcZEEFTxA7QeznEg6uYU';

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60秒超时
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// 性能测试函数
async function testApiPerformance() {
  console.log('开始API性能测试...');
  console.log('测试目标: /api/tasks');
  console.log('超时设置: 60秒');
  console.log('=' .repeat(50));
  
  const results = [];
  
  for (let i = 1; i <= 5; i++) {
    console.log(`\n第 ${i} 次测试:`);
    
    try {
      const startTime = Date.now();
      
      const response = await apiClient.get('/api/tasks');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const result = {
        test: i,
        status: response.status,
        duration: duration,
        dataSize: JSON.stringify(response.data).length,
        success: true
      };
      
      results.push(result);
      
      console.log(`  ✅ 成功 - ${duration}ms`);
      console.log(`  状态码: ${response.status}`);
      console.log(`  数据大小: ${result.dataSize} 字符`);
      console.log(`  任务数量: ${response.data.length || 0}`);
      
    } catch (error) {
      const duration = error.code === 'ECONNABORTED' ? 60000 : Date.now() - Date.now();
      
      const result = {
        test: i,
        status: error.response?.status || 'TIMEOUT',
        duration: duration,
        error: error.message,
        success: false
      };
      
      results.push(result);
      
      console.log(`  ❌ 失败 - ${duration}ms`);
      console.log(`  错误: ${error.message}`);
      
      if (error.code === 'ECONNABORTED') {
        console.log(`  原因: 请求超时 (${error.timeout}ms)`);
      }
    }
    
    // 测试间隔
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 统计结果
  console.log('\n' + '=' .repeat(50));
  console.log('测试结果统计:');
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`成功: ${successfulTests.length}/5`);
  console.log(`失败: ${failedTests.length}/5`);
  
  if (successfulTests.length > 0) {
    const durations = successfulTests.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log(`\n响应时间统计:`);
    console.log(`  平均: ${avgDuration.toFixed(2)}ms`);
    console.log(`  最快: ${minDuration}ms`);
    console.log(`  最慢: ${maxDuration}ms`);
    
    if (avgDuration < 1000) {
      console.log(`  ✅ 性能良好 (< 1秒)`);
    } else if (avgDuration < 5000) {
      console.log(`  ⚠️  性能一般 (1-5秒)`);
    } else {
      console.log(`  ❌ 性能较差 (> 5秒)`);
    }
  }
  
  if (failedTests.length > 0) {
    console.log(`\n失败原因:`);
    failedTests.forEach(test => {
      console.log(`  测试${test.test}: ${test.error}`);
    });
  }
  
  console.log('\n测试完成!');
}

// 运行测试
testApiPerformance().catch(console.error);