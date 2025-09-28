import React, { useState } from 'react';
import { taskStore } from '../store/taskStore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const AuthTestPage: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, signOut } = useAuth();
  const { createTask, tasks } = taskStore();

  const testTaskCreationWithAuth = async () => {
    setIsLoading(true);
    setTestResult('');
    
    try {
      const testTaskData = {
        title: `认证测试任务 - ${new Date().toLocaleString()}`,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        priority: 'medium' as const,
        is_recurring: false
      };

      const createdTask = await createTask(testTaskData);
      setTestResult(`✅ 任务创建成功！任务ID: ${createdTask.id}`);
      
      // 清理测试数据
      setTimeout(async () => {
        try {
          await taskStore.getState().deleteTask(createdTask.id);
          console.log('测试任务已清理');
        } catch (error) {
          console.error('清理测试任务失败:', error);
        }
      }, 2000);
      
    } catch (error: any) {
      setTestResult(`❌ 任务创建失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testTaskCreationWithoutAuth = async () => {
    setIsLoading(true);
    setTestResult('');
    
    // 先登出用户
    await signOut();
    
    // 等待一下确保登出完成
    setTimeout(async () => {
      try {
        const testTaskData = {
          title: `未认证测试任务 - ${new Date().toLocaleString()}`,
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(),
          priority: 'medium' as const,
          is_recurring: false
        };

        await createTask(testTaskData);
        setTestResult(`❌ 意外成功：任务在未认证状态下创建成功（这不应该发生）`);
      } catch (error: any) {
        setTestResult(`✅ 正确行为：${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">认证修复测试页面</h1>
      
      {/* 用户状态 */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">当前用户状态</h2>
        {user ? (
          <div>
            <p className="text-green-600">✅ 已登录</p>
            <p className="text-sm text-gray-600">用户ID: {user.id}</p>
            <p className="text-sm text-gray-600">邮箱: {user.email}</p>
          </div>
        ) : (
          <p className="text-red-600">❌ 未登录</p>
        )}
      </div>

      {/* 测试按钮 */}
      <div className="space-y-4 mb-6">
        <button
          onClick={testTaskCreationWithAuth}
          disabled={isLoading || !user}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '测试中...' : '测试已认证状态下的任务创建'}
        </button>
        
        <button
          onClick={testTaskCreationWithoutAuth}
          disabled={isLoading || !user}
          className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '测试中...' : '测试未认证状态下的任务创建（会先登出）'}
        </button>
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">测试结果</h3>
          <p className={`${testResult.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
            {testResult}
          </p>
        </div>
      )}

      {/* 说明 */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">测试说明</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• 第一个测试验证已登录用户可以正常创建任务</li>
          <li>• 第二个测试验证未登录用户无法创建任务，且不会显示虚假成功提示</li>
          <li>• 修复后，系统会在乐观更新前验证认证状态</li>
          <li>• 如果认证失败，用户会立即看到错误提示，而不是先看到成功再失败</li>
        </ul>
      </div>

      {/* 当前任务数量 */}
      <div className="mt-4 text-sm text-gray-600">
        当前任务总数: {tasks.length}
      </div>
    </div>
  );
};

export default AuthTestPage;