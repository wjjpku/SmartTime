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
    // 从user对象中获取created_at，如果没有则使用默认日期
    if (!user) {
      return '2025年9月27日';
    }
    
    // 尝试从user对象获取created_at
    const userCreatedAt = (user as any).created_at;
    if (!userCreatedAt) {
      return '2025年9月27日';
    }
    
    const createdDate = new Date(userCreatedAt);
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
    if (!user) {
      return 1;
    }
    
    const userCreatedAt = (user as any).created_at;
    const registrationDate = userCreatedAt ? new Date(userCreatedAt) : new Date('2025-09-27');
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
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件大小（限制为5MB）
      if (file.size > 5 * 1024 * 1024) {
        showError('头像文件大小不能超过5MB');
        return;
      }
      
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        showError('请选择图片文件');
        return;
      }
      
      setAvatarFile(file);
      
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkNetworkConnection = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      // 直接检查后端API是否可访问（使用完整URL避免代理问题）
      const response = await fetch('http://localhost:8000/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      
      return response.ok;
    } catch (error) {
      console.warn('后端API连接检查失败:', error);
      
      // 如果后端API不可用，尝试检查外网连接
      try {
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        return true; // 外网可用但后端API不可用
      } catch (fallbackError) {
        return false; // 完全无网络连接
      }
    }
  };

  const isNetworkError = (error: any) => {
    return (
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('fetch') ||
      error?.code === 'NETWORK_ERROR' ||
      !navigator.onLine
    );
  };

  const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 检查网络连接
        const networkOk = await checkNetworkConnection();
        if (!networkOk) {
          throw new Error('网络连接不可用，请检查网络设置');
        }
        
        return await operation();
      } catch (error) {
        console.log(`操作失败，尝试次数: ${i + 1}/${maxRetries}`, error);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      // 检查用户认证状态
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('用户未登录，请重新登录');
        return;
      }

      let avatarUrl = userDisplayData.avatar_url;
      
      // 如果有新头像文件，先上传头像
      if (avatarFile) {
        try {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('头像上传失败:', uploadError);
            if (uploadError.message.includes('Duplicate')) {
              // 如果文件已存在，尝试用新的文件名
              const newFileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
              const { data: retryData, error: retryError } = await supabase.storage
                .from('avatars')
                .upload(newFileName, avatarFile, {
                  cacheControl: '3600',
                  upsert: false
                });
              
              if (retryError) {
                throw retryError;
              }
              
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(retryData.path);
              avatarUrl = urlData.publicUrl;
            } else {
              throw uploadError;
            }
          } else {
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(uploadData.path);
            avatarUrl = urlData.publicUrl;
          }
        } catch (error: any) {
          console.error('头像上传过程中出错:', error);
          
          if (isNetworkError(error)) {
            showError('网络连接问题，请检查网络后重试');
          } else if (error?.message?.includes('storage')) {
            showError('存储服务暂时不可用，请稍后重试');
          } else if (error?.message?.includes('size')) {
            showError('文件大小超出限制，请选择较小的图片');
          } else {
            showError('头像上传失败，请重试');
          }
          return;
        }
      }
      
      // 更新用户元数据
      const updateOperation = async () => {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            username: editedUsername.trim() || null,
            avatar_url: avatarUrl
          }
        });
        
        if (error) {
          throw error;
        }
        
        return data;
      };
      
      await retryOperation(updateOperation);
      
      // 刷新用户数据
      await refreshUser();
      
      // 更新本地状态
      setUserDisplayData({
        username: editedUsername.trim() || userDisplayData.username,
        avatar_url: avatarUrl
      });
      
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      
      showSuccess('个人信息更新成功！');
      
      // 触发页面重新渲染
      window.dispatchEvent(new CustomEvent('userDataUpdated'));
      
    } catch (error: any) {
      console.error('保存用户信息失败:', error);
      
      if (isNetworkError(error)) {
        showError('网络连接问题，请检查网络后重试');
      } else if (error?.message?.includes('rate_limit')) {
        showError('操作过于频繁，请稍后重试');
      } else if (error?.message?.includes('auth')) {
        showError('身份验证失败，请重新登录');
      } else if (error?.message?.includes('storage')) {
        showError('文件上传失败，请重试');
      } else {
        showError('保存失败，请重试');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedUsername((user as any)?.user_metadata?.username || '');
    setAvatarFile(null);
    setAvatarPreview((user as any)?.user_metadata?.avatar_url || null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '无';
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
      {/* 头部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>返回主页</span>
              </button>
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900">个人主页</h1>
            
            <div className="flex items-center space-x-4">
              <RealtimeClock />
              
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSaving ? '保存中...' : '保存'}</span>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    <span>取消</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>编辑</span>
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：用户信息 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* 用户头像和昵称 */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 overflow-hidden">
                    {(avatarPreview || userDisplayData.avatar_url) ? (
                      <img 
                        src={avatarPreview || userDisplayData.avatar_url} 
                        alt="头像" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ display: (avatarPreview || userDisplayData.avatar_url) ? 'none' : 'flex' }}
                    >
                      {userDisplayData.username.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                  
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                
                {isEditing ? (
                  <input
                    type="text"
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    placeholder="输入昵称"
                    className="text-xl font-semibold text-gray-900 text-center bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <h2 className="text-xl font-semibold text-gray-900">{userDisplayData.username}</h2>
                )}
                
                <p className="text-gray-600 mt-1">加入时间：{getRegistrationDate()}</p>
              </div>
              
              {/* 任务完成率 */}
              <div className="text-center mb-6">
                <div className="relative w-32 h-32 mx-auto">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="#3b82f6"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - getCompletionRate() / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{getCompletionRate()}%</div>
                      <div className="text-sm text-gray-600">完成率</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 使用统计 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">使用天数</span>
                  <span className="font-semibold text-gray-900">{getDaysUsed()} 天</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">总任务数</span>
                  <span className="font-semibold text-gray-900">{taskStats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">已完成</span>
                  <span className="font-semibold text-green-600">{taskStats.completed}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 右侧：任务统计和最近任务 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 任务统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{taskStats.total}</div>
                <div className="text-sm text-gray-600">总任务</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{taskStats.completed}</div>
                <div className="text-sm text-gray-600">已完成</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{taskStats.pending}</div>
                <div className="text-sm text-gray-600">进行中</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{taskStats.overdue}</div>
                <div className="text-sm text-gray-600">逾期</div>
              </div>
            </div>
            
            {/* 今日和本周统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">今日任务</h3>
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-blue-600">{taskStats.today}</div>
                <p className="text-gray-600 text-sm mt-1">今天需要完成的任务</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">本周任务</h3>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-green-600">{taskStats.thisWeek}</div>
                <p className="text-gray-600 text-sm mt-1">本周需要完成的任务</p>
              </div>
            </div>
            
            {/* 最近任务 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">最近任务</h3>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  <span>查看全部</span>
                </button>
              </div>
              
              {recentTasks.length > 0 ? (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)} bg-opacity-10`}>
                            优先级: {getPriorityText(task.priority)}
                          </span>
                          {task.is_recurring && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                              重复任务
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDate(task.start)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        {task.completed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">暂无任务</p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 flex items-center space-x-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>创建第一个任务</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <NetworkStatus />
    </div>
  );
}