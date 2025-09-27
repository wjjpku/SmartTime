import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckCircle, Clock, AlertCircle, TrendingUp, Settings, ArrowLeft, Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { taskStore, Task } from '../store/taskStore';
import { useNotification } from '../components/NotificationManager';
import RealtimeClock from '../components/RealtimeClock';

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
  const { user } = useAuth();
  const { showSuccess } = useNotification();
  const { tasks, fetchTasks } = taskStore();
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
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="text-white" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  {(user as any)?.user_metadata?.username || user?.email?.split('@')[0] || '用户'}
                </h2>
                <p className="text-gray-600 text-sm mb-4">{user?.email}</p>
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