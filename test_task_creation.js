// 测试任务创建流程的脚本
// 用于验证前后端数据同步问题

const axios = require('axios');

// 配置API客户端
const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 测试任务数据
const testTask = {
  title: '测试任务 - ' + new Date().toLocaleString(),
  start: new Date().toISOString(),
  end: new Date(Date.now() + 3600000).toISOString(), // 1小时后
  priority: 'medium',
  is_recurring: false
};

async function testTaskCreation() {
  console.log('开始测试任务创建流程...');
  console.log('测试任务数据:', testTask);
  
  try {
    // 1. 测试创建任务API
    console.log('\n1. 调用创建任务API...');
    const createResponse = await api.post('/api/tasks', testTask);
    console.log('创建响应状态:', createResponse.status);
    console.log('创建响应数据:', createResponse.data);
    
    const createdTask = createResponse.data.task;
    console.log('创建的任务ID:', createdTask.id);
    
    // 2. 验证任务是否真正保存
    console.log('\n2. 验证任务是否保存到后端...');
    const getResponse = await api.get('/api/tasks');
    console.log('获取任务列表状态:', getResponse.status);
    
    const tasks = getResponse.data.tasks;
    const foundTask = tasks.find(task => task.id === createdTask.id);
    
    if (foundTask) {
      console.log('✅ 任务已成功保存到后端');
      console.log('保存的任务数据:', foundTask);
    } else {
      console.log('❌ 任务未在后端找到！');
      console.log('当前任务列表长度:', tasks.length);
    }
    
    // 3. 检查数据格式一致性
    console.log('\n3. 检查数据格式一致性...');
    if (foundTask) {
      const fieldsToCheck = ['title', 'start', 'end', 'priority'];
      let formatConsistent = true;
      
      fieldsToCheck.forEach(field => {
        if (testTask[field] !== foundTask[field]) {
          console.log(`❌ 字段 ${field} 不一致:`);
          console.log(`  发送: ${testTask[field]}`);
          console.log(`  保存: ${foundTask[field]}`);
          formatConsistent = false;
        }
      });
      
      if (formatConsistent) {
        console.log('✅ 数据格式一致');
      }
    }
    
    // 4. 清理测试数据
    console.log('\n4. 清理测试数据...');
    if (createdTask.id) {
      const deleteResponse = await api.delete(`/api/tasks/${createdTask.id}`);
      console.log('删除响应状态:', deleteResponse.status);
      console.log('✅ 测试数据已清理');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:');
    console.error('错误状态:', error.response?.status);
    console.error('错误信息:', error.response?.data || error.message);
    console.error('完整错误:', error);
  }
}

// 运行测试
testTaskCreation().then(() => {
  console.log('\n测试完成');
}).catch(error => {
  console.error('测试失败:', error);