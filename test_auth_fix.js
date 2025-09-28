// 测试认证修复的脚本
import axios from 'axios';

// 配置API客户端
const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 测试任务数据
const testTask = {
  title: '测试任务 - 认证修复验证',
  start: new Date().toISOString(),
  end: new Date(Date.now() + 3600000).toISOString(), // 1小时后
  priority: 'medium',
  is_recurring: false
};

async function testWithoutAuth() {
  console.log('\n=== 测试无认证情况 ===');
  try {
    const response = await api.post('/api/tasks', testTask);
    console.log('❌ 意外成功：', response.status);
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ 正确行为：返回401未授权错误');
      console.log('   错误信息：', error.response.data?.detail || error.message);
      return true;
    } else {
      console.log('❓ 意外错误：', error.response?.status, error.message);
      return false;
    }
  }
}

async function testWithInvalidAuth() {
  console.log('\n=== 测试无效认证情况 ===');
  try {
    const response = await api.post('/api/tasks', testTask, {
      headers: {
        'Authorization': 'Bearer invalid_token_12345'
      }
    });
    console.log('❌ 意外成功：', response.status);
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ 正确行为：返回401未授权错误');
      console.log('   错误信息：', error.response.data?.detail || error.message);
      return true;
    } else {
      console.log('❓ 意外错误：', error.response?.status, error.message);
      return false;
    }
  }
}

async function testServerConnection() {
  console.log('\n=== 测试服务器连接 ===');
  try {
    const response = await axios.get('http://localhost:8000/health', { timeout: 5000 });
    console.log('✅ 后端服务器正常运行');
    console.log('   响应：', response.data);
    return true;
  } catch (error) {
    console.log('❌ 后端服务器连接失败：', error.message);
    return false;
  }
}

async function runTests() {
  console.log('开始测试认证修复...');
  
  const results = {
    serverConnection: await testServerConnection(),
    withoutAuth: await testWithoutAuth(),
    withInvalidAuth: await testWithInvalidAuth()
  };
  
  console.log('\n=== 测试结果汇总 ===');
  console.log('服务器连接：', results.serverConnection ? '✅ 通过' : '❌ 失败');
  console.log('无认证测试：', results.withoutAuth ? '✅ 通过' : '❌ 失败');
  console.log('无效认证测试：', results.withInvalidAuth ? '✅ 通过' : '❌ 失败');
  
  const allPassed = Object.values(results).every(result => result);
  console.log('\n总体结果：', allPassed ? '✅ 所有测试通过' : '❌ 部分测试失败');
  
  if (allPassed) {
    console.log('\n🎉 认证修复验证成功！');
    console.log('现在前端应该能够正确处理认证错误，避免显示虚假的任务创建成功状态。');
  } else {
    console.log('\n⚠️  需要进一步检查后端认证实现。');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行失败：', error);
});