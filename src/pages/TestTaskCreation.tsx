import React, { useState, useEffect } from 'react';
import { taskStore } from '../store/taskStore';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  data?: any;
}

const TestTaskCreation: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  const { createTask, tasks, fetchTasks } = taskStore();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const addTestResult = (step: string, status: 'pending' | 'success' | 'error', message: string, data?: any) => {
    setTestResults(prev => [...prev, { step, status, message, data }]);
  };

  const checkAuthStatus = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('获取session失败:', error);
        setUserInfo({ error: error.message });
      } else if (session) {
        setUserInfo({
          user: session.user,
          token: session.access_token ? '已获取' : '未获取',
          tokenLength: session.access_token?.length || 0
        });
      } else {
        setUserInfo({ error: '用户未登录' });
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      setUserInfo({ error: '检查认证状态失败' });
    }
  };

  const runTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // 步骤1: 检查认证状态
      addTestResult('1. 检查认证状态', 'pending', '正在检查用户认证状态...');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        addTestResult('1. 检查认证状态', 'error', '用户未登录或认证失败', { authError });
        return;
      }
      
      addTestResult('1. 检查认证状态', 'success', '用户已登录', {
        userId: session.user.id,
        email: session.user.email,
        hasToken: !!session.access_token
      });

      // 步骤2: 获取当前任务列表
      addTestResult('2. 获取当前任务列表', 'pending', '正在获取任务列表...');
      try {
        await fetchTasks();
        addTestResult('2. 获取当前任务列表', 'success', `成功获取 ${tasks.length} 个任务`);
      } catch (error: any) {
        addTestResult('2. 获取当前任务列表', 'error', '获取任务列表失败', { error: error.message });
        return;
      }

      // 步骤3: 创建测试任务
      addTestResult('3. 创建测试任务', 'pending', '正在创建测试任务...');
      const testTaskData = {
        title: `测试任务 - ${new Date().toLocaleString()}`,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(), // 1小时后
        priority: 'medium' as const,
        is_recurring: false
      };

      try {
        const createdTask = await createTask(testTaskData);
        addTestResult('3. 创建测试任务', 'success', '任务创建成功', {
          taskId: createdTask.id,
          title: createdTask.title
        });

        // 步骤4: 验证任务是否在列表中
        addTestResult('4. 验证任务显示', 'pending', '正在验证任务是否在列表中...');
        await fetchTasks(); // 重新获取任务列表
        
        const foundTask = tasks.find(task => task.id === createdTask.id);
        if (foundTask) {
          addTestResult('4. 验证任务显示', 'success', '任务已在列表中找到', {
            foundInList: true,
            taskData: foundTask
          });
        } else {
          addTestResult('4. 验证任务显示', 'error', '任务未在列表中找到', {
            foundInList: false,
            totalTasks: tasks.length
          });
        }

        // 步骤5: 清理测试数据
        addTestResult('5. 清理测试数据', 'pending', '正在删除测试任务...');
        try {
          await taskStore.getState().deleteTask(createdTask.id);
          addTestResult('5. 清理测试数据', 'success', '测试任务已删除');
        } catch (error: any) {
          addTestResult('5. 清理测试数据', 'error', '删除测试任务失败', { error: error.message });
        }

      } catch (error: any) {
        addTestResult('3. 创建测试任务', 'error', '任务创建失败', {
          error: error.message,
          response: error.response?.data
        });
      }

    } catch (error: any) {
      addTestResult('测试异常', 'error', '测试过程中发生异常', { error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">任务创建流程测试</h1>
      
      {/* 认证状态 */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">认证状态</h2>
        {userInfo ? (
          <div className="space-y-2">
            {userInfo.error ? (
              <p className="text-red-600">❌ {userInfo.error}</p>
            ) : (
              <div>
                <p className="text-green-600">✅ 用户已登录</p>
                <p className="text-sm text-gray-600">用户ID: {userInfo.user?.id}</p>
                <p className="text-sm text-gray-600">邮箱: {userInfo.user?.email}</p>
                <p className="text-sm text-gray-600">Token状态: {userInfo.token}</p>
              </div>
            )}
          </div>
        ) : (
          <p>正在检查认证状态...</p>
        )}
        <button
          onClick={checkAuthStatus}
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          刷新认证状态
        </button>
      </div>

      {/* 测试控制 */}
      <div className="mb-6">
        <button
          onClick={runTest}
          disabled={isRunning || userInfo?.error}
          className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isRunning ? '测试进行中...' : '开始测试'}
        </button>
      </div>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">测试结果</h2>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border-l-4 border-gray-200 pl-4">
                <div className={`flex items-center gap-2 ${getStatusColor(result.status)}`}>
                  <span>{getStatusIcon(result.status)}</span>
                  <span className="font-medium">{result.step}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                {result.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-blue-600 cursor-pointer">查看详细数据</summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestTaskCreation;