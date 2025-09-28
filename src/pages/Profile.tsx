import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckCircle, Clock, AlertCircle, TrendingUp, Settings, ArrowLeft, Plus, Eye, Edit3, Camera, Save, X, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { taskStore, Task } from '../store/taskStore';
import { useNotification } from '../components/NotificationManager';
import RealtimeClock from '../components/RealtimeClock';
import { supabase } from '../lib/supabase';
import { NetworkStatus, useNetworkStatus } from '../components/NetworkStatus';

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  today: number;
  thisWeek: number;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const { tasks, fetchTasks } = taskStore();
  const { isOnline, checkConnection } = useNetworkStatus();
  const [userDisplayData, setUserDisplayData] = useState({
    username: '',
    avatar_url: ''
  });
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    today: 0,
    thisWeek: 0
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 编辑相关状态
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await fetchTasks();
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchTasks]);

  // 监听用户数据变化，确保实时更新显示
  useEffect(() => {
    if (user) {
      const username = (user as any)?.user_metadata?.username;
      const email = user.email || '';
      
      // 如果有昵称就使用昵称，否则使用邮箱前缀，最后才使用默认值
      let displayName = '';
      if (username && username.trim()) {
        displayName = username;
      } else if (email) {
        // 使用邮箱@前面的部分作为显示名
        displayName = email.split('@')[0];
      } else {
        displayName = '朋友';
      }
      
      setUserDisplayData({
        username: displayName,
        avatar_url: (user as any)?.user_metadata?.avatar_url || ''
      });
      
      // 初始化编辑状态
      setEditedUsername(username || '');
      setAvatarPreview((user as any)?.user_metadata?.avatar_url || null);
    }
  }, [user]);

  // 监听用户数据更新事件
  useEffect(() => {
    const handleUserDataUpdate = () => {
      if (user) {
        const username = (user as any)?.user_metadata?.username;
        const email = user.email || '';
        
        let displayName = '';
        if (username && username.trim()) {
          displayName = username;
        } else if (email) {
          displayName = email.split('@')[0];
        } else {
          displayName = '朋友';
        }
        
        setUserDisplayData({
          username: displayName,
          avatar_url: (user as any)?.user_metadata?.avatar_url || ''
        });
        
        setEditedUsername(username || '');
        setAvatarPreview((user as any)?.user_metadata?.avatar_url || null);
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate);
    return () => window.removeEventListener('userDataUpdated', handleUserDataUpdate);
  }, [user]);



  useEffect(() => {
    if (tasks.length > 0) {
      calculateTaskStats();
      getRecentTasks();
    }
  }, [tasks]);

  const calculateTaskStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats = tasks.reduce((acc, task) => {
      const taskStart = new Date(task.start);
      const taskEnd = new Date(task.end);
      
      acc.total++;
      
      if (task.completed) {
        acc.completed++;
      } else {
        acc.pending++;
        // 检查是否逾期
        if (taskEnd < now) {
          acc.overdue++;
        }
      }
      
      // 今天的任务
      if (taskStart >= today && taskStart < tomorrow) {
        acc.today++;
      }
      
      // 本周的任务
      if (taskStart >= weekStart && taskStart < weekEnd) {
        acc.thisWeek++;
      }
      
      return acc;
    }, {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      today: 0,
      thisWeek: 0
    });

    setTaskStats(stats);
  };

  const getRecentTasks = () => {
    // 获取最近的5个任务（按创建时间或开始时间排序）
    const sortedTasks = [...tasks]
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      .slice(0, 5);
    setRecentTasks(sortedTasks);
  };

  // 获取注册日期，为早期用户设置默认值
  const getRegistrationDate = () => {
    if (!user?.created_at) {
      return '2025年9月27日';
    }
    
    const createdDate = new Date(user.created_at);
    const defaultDate = new Date('2025-09-27');
    
    // 如果注册时间早于默认日期，使用默认日期
    if (createdDate < defaultDate) {
      return '2025年9月27日';
    }
    
    return createdDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 计算使用天数
  const getDaysUsed = () => {
    const registrationDate = user?.created_at ? new Date(user.created_at) : new Date('2025-09-27');
    const defaultDate = new Date('2025-09-27');
    
    // 使用较晚的日期作为起始日期
    const startDate = registrationDate < defaultDate ? defaultDate : registrationDate;
    const now = new Date();
    
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays); // 至少显示1天
  };

  const getCompletionRate = () => {
    if (taskStats.total === 0) return 0;
    return Math.round((taskStats.completed / taskStats.total) * 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === -1) return '昨天';
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}天后`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  // 处理头像文件选择
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件大小（5MB限制）
      if (file.size > 5 * 1024 * 1024) {
        showError('文件过大', `头像文件大小不能超过5MB，当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      
      // 检查文件类型
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showError('文件格式不支持', `请选择有效的图片文件（JPG、PNG、GIF、WebP），当前文件类型：${file.type}`);
        return;
      }
      
      console.log('选择的头像文件:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type
      });
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
        showSuccess('文件选择成功', '头像预览已更新，请点击保存修改');
      };
      reader.onerror = () => {
        showError('文件读取失败', '无法读取选择的图片文件，请重新选择');
      };
      reader.readAsDataURL(file);
    }
  };

  // 网络连接检查函数
  const checkNetworkConnection = async (): Promise<boolean> => {
    if (!isOnline) {
      showError('网络连接已断开', '请检查网络设置后重试');
      return false;
    }

    const connected = await checkConnection();
    if (!connected) {
      showError('网络连接不稳定', '请稍后重试');
      return false;
    }
    
    return true;
  };

  // 判断是否为网络相关错误
  const isNetworkError = (error: any): boolean => {
    const errorMessage = error.message || '';
    const networkErrorPatterns = [
      'Failed to fetch',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED',
      'ERR_SOCKET_NOT_CONNECTED',
      'Network request failed',
      'fetch is not defined',
      'AbortError',
      'TimeoutError'
    ];
    
    return networkErrorPatterns.some(pattern => 
      errorMessage.includes(pattern)
    ) && !errorMessage.includes('404') && !errorMessage.includes('Not Found');
  };

  // 重试机制函数
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.log(`操作失败，第 ${attempt} 次尝试:`, error.message);
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 检查是否是网络相关错误
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('ERR_SOCKET_NOT_CONNECTED') ||
            error.message.includes('ERR_NETWORK') ||
            error.name === 'AuthRetryableFetchError') {
          
          // 检查网络连接
          const isConnected = await checkNetworkConnection();
          if (!isConnected) {
            console.log('网络连接检查失败，等待重试...');
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
        }
        
        // 对于其他错误，等待后重试
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError;
  };

  // 保存修改
  const handleSaveChanges = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {

      // 检查用户认证状态
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('登录状态已过期，请重新登录');
      }

      let avatarUrl = (user as any)?.user_metadata?.avatar_url;
      
      // 如果有新头像，先上传
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        
        console.log('开始上传头像:', {
          fileName,
          fileSize: `${(avatarFile.size / 1024 / 1024).toFixed(2)}MB`,
          fileType: avatarFile.type
        });
        
        try {
          // 使用重试机制上传头像
          await retryOperation(async () => {
            // 先删除旧文件（如果存在）
            const { error: removeError } = await supabase.storage
              .from('avatars')
              .remove([fileName]);
            
            if (removeError) {
              console.log('删除旧头像文件时出现错误（可能文件不存在）:', removeError.message);
            }
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, avatarFile, { 
                cacheControl: '3600',
                upsert: true 
              });
            
            if (uploadError) {
              console.error('头像上传失败:', uploadError);
              if (uploadError.message.includes('Bucket not found')) {
                throw new Error('存储服务配置错误，请联系管理员');
              } else if (uploadError.message.includes('File size')) {
                throw new Error('文件大小超出限制，请选择更小的图片');
              } else if (uploadError.message.includes('Invalid file type')) {
                throw new Error('不支持的文件格式，请选择JPG、PNG或WebP格式的图片');
              } else {
                throw new Error(`头像上传失败: ${uploadError.message}`);
              }
            }
            
            console.log('头像上传成功:', uploadData);
            return uploadData;
          });
          
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          
          avatarUrl = publicUrl;
          console.log('头像URL:', avatarUrl);
        } catch (storageError: any) {
          console.error('头像存储操作失败:', storageError);
          throw storageError;
        }
      }
      
      // 更新用户元数据
      const newUsername = editedUsername.trim() || '用户';
      console.log('开始更新用户信息:', {
        username: newUsername,
        avatar_url: avatarUrl,
        userId: user.id
      });
      
      // 使用重试机制更新用户信息
      const updateData = await retryOperation(async () => {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            username: newUsername,
            avatar_url: avatarUrl
          }
        });
        
        if (error) {
          console.error('用户信息更新失败:', error);
          if (error.message.includes('Invalid user')) {
            throw new Error('用户身份验证失败，请重新登录');
          } else if (error.message.includes('Rate limit')) {
            throw new Error('操作过于频繁，请稍后再试');
          } else if (isNetworkError(error)) {
            throw new Error('网络连接失败，正在重试...');
          } else if (error.message.includes('404') || error.message.includes('Not Found')) {
            throw new Error(`服务错误: ${error.message}`);
          } else {
            throw new Error(`用户信息更新失败: ${error.message}`);
          }
        }
        
        return data;
      });
      
      console.log('用户信息更新成功:', updateData);
      
      // 刷新用户数据以更新界面显示
      try {
        await retryOperation(async () => {
          await refreshUser();
        });
        console.log('用户数据刷新成功');
      } catch (refreshError: any) {
        console.error('用户数据刷新失败:', refreshError);
        // 即使刷新失败，也不阻止保存成功的提示
      }
      
      // 立即更新本地状态以确保界面实时更新
      setEditedUsername(newUsername);
      if (avatarUrl) {
        setAvatarPreview(avatarUrl);
      }
      
      const successMessage = avatarFile && newUsername !== ((user as any)?.user_metadata?.username || '') 
        ? '头像和昵称已成功更新' 
        : avatarFile 
        ? '头像已成功更新' 
        : '昵称已成功更新';
      
      showSuccess('保存成功', successMessage);
      setIsEditing(false);
      setAvatarFile(null);
      
      // 强制触发页面重新渲染以确保所有组件都能获取到最新的用户数据
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
          detail: {
            username: newUsername,
            avatar_url: avatarUrl
          }
        }));
      }, 100);
    } catch (error: any) {
      console.error('保存失败:', error);
      
      // 根据错误类型提供更具体的错误信息
      let errorTitle = '保存失败';
      let errorMessage = error.message || '保存个人信息时发生未知错误';
      
      // 使用新的网络错误判断函数
      if (isNetworkError(error)) {
        errorTitle = '网络错误';
        errorMessage = '网络连接不稳定，请检查网络后重试';
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorTitle = '服务错误';
        errorMessage = '服务暂时不可用，请稍后重试或联系管理员';
      } else if (error.message.includes('存储')) {
        errorTitle = '文件上传失败';
        errorMessage = '头像上传失败，请重新选择图片或稍后重试';
      } else if (error.message.includes('身份验证') || 
                 error.message.includes('登录状态') ||
                 error.message.includes('Invalid user')) {
        errorTitle = '身份验证失败';
        errorMessage = '登录状态已过期，请重新登录';
      } else if (error.message.includes('频繁')) {
        errorTitle = '操作频繁';
        errorMessage = '操作过于频繁，请稍后再试';
      }
      
      showError(errorTitle, errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedUsername((user as any)?.user_metadata?.username || '');
    setAvatarPreview((user as any)?.user_metadata?.avatar_url || null);
    setAvatarFile(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '普通';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NetworkStatus />
      <div className="container mx-auto px-4 py-8">
        {/* 头部导航 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
              <span>返回主页</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <User className="text-blue-600" size={32} />
              个人主页
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* 实时时钟 */}
            <div className="bg-white rounded-lg shadow-md px-4 py-2">
              <RealtimeClock showSeconds={true} showDate={true} />
            </div>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-3 py-2 text-blue-600 hover:text-blue-800 transition-colors rounded-lg hover:bg-blue-50"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  编辑
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving || !isOnline}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {!isOnline ? (
                      <>
                        <WifiOff className="w-4 h-4 mr-1" />
                        网络断开
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? '保存中...' : '保存'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 mr-1" />
                    取消
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => showSuccess('设置功能', '个人设置功能即将上线')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
            >
              <Settings size={20} />
              <span>设置</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：用户信息 */}
          <div className="lg:col-span-1">
            {/* 用户信息卡片 */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="text-center">
                <div className="relative mx-auto mb-4">
                  {isEditing ? (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mx-auto">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="头像预览" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                        <Camera className="w-3 h-3 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
                      {(user as any)?.user_metadata?.avatar_url ? (
                        <img src={(user as any).user_metadata.avatar_url} alt="用户头像" className="w-full h-full object-cover" />
                      ) : (
                        <User className="text-white" size={32} />
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2 mb-4">
                    <input
                      type="text"
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      placeholder="请输入昵称"
                      className="text-xl font-bold text-gray-800 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 outline-none w-full text-center"
                    />
                    <p className="text-gray-600 text-sm">{user?.email}</p>
                  </div>
                ) : (
                  <div className="mb-4">
                     <h2 className="text-xl font-bold text-gray-800 mb-1">
                       {editedUsername || userDisplayData.username}
                     </h2>
                     <p className="text-gray-600 text-sm">{user?.email}</p>
                   </div>
                )}
                <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>加入时间：{getRegistrationDate()}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    已使用 {getDaysUsed()} 天
                  </div>
                </div>
              </div>
            </div>

            {/* 任务完成率 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="text-green-600" size={20} />
                任务完成率
              </h3>
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#10b981"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${getCompletionRate() * 2.51} 251`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-800">{getCompletionRate()}%</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">
                  已完成 {taskStats.completed} / {taskStats.total} 个任务
                </p>
              </div>
            </div>
          </div>

          {/* 右侧：任务统计和最近活动 */}
          <div className="lg:col-span-2">
            {/* 任务统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">总任务</p>
                    <p className="text-2xl font-bold text-gray-800">{taskStats.total}</p>
                  </div>
                  <Calendar className="text-blue-600" size={24} />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
                  </div>
                  <CheckCircle className="text-green-600" size={24} />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">进行中</p>
                    <p className="text-2xl font-bold text-blue-600">{taskStats.pending}</p>
                  </div>
                  <Clock className="text-blue-600" size={24} />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">逾期</p>
                    <p className="text-2xl font-bold text-red-600">{taskStats.overdue}</p>
                  </div>
                  <AlertCircle className="text-red-600" size={24} />
                </div>
              </div>
            </div>

            {/* 今日和本周统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">今日任务</h3>
                <p className="text-3xl font-bold">{taskStats.today}</p>
                <p className="text-blue-100 text-sm">需要完成的任务</p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">本周任务</h3>
                <p className="text-3xl font-bold">{taskStats.thisWeek}</p>
                <p className="text-purple-100 text-sm">本周安排的任务</p>
              </div>
            </div>

            {/* 最近任务 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Clock className="text-blue-600" size={20} />
                  最近任务
                </h3>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <Eye size={16} />
                  查看全部
                </button>
              </div>
              
              {recentTasks.length > 0 ? (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-800 truncate">{task.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityText(task.priority)}
                          </span>
                          {task.is_recurring && (
                            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">🔄 重复</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{formatDate(task.start)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.completed ? (
                          <CheckCircle className="text-green-600" size={20} />
                        ) : (
                          <Clock className="text-gray-400" size={20} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto mb-2" size={48} />
                  <p>暂无任务记录</p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    创建第一个任务
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}