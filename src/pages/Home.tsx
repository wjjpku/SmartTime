import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, Send, Loader2, Zap, Trash2, LogOut, User, HelpCircle, BarChart3, Clock, CalendarDays, CheckCircle, Brain, Edit3, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { taskStore, Task } from '../store/taskStore';
import UnifiedTaskModal from '../components/UnifiedTaskModal';
import TaskResultModal from '../components/TaskResultModal';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../components/NotificationManager';
import { supabase } from '../lib/supabase';
// import TaskReminder from '../components/TaskReminder'; // 已禁用提醒功能
import TaskFilter from '../components/TaskFilter';
import DataExport from '../components/DataExport';
import UserGuide from '../components/UserGuide';
import RealtimeClock, { getRelativeTimeLabel, isToday, isThisWeek } from '../components/RealtimeClock';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const [userDisplayData, setUserDisplayData] = useState({
    username: '',
    avatar_url: ''
  });
  const calendarRef = useRef<FullCalendar>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete'>('create');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  
  // 智能日程安排相关状态
  const [scheduleInput, setScheduleInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scheduleResults, setScheduleResults] = useState<any>(null);
  const [showScheduleResults, setShowScheduleResults] = useState(false);
  const [originalInputText, setOriginalInputText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'day' | 'week' | 'month'>('day');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [currentDate, setCurrentDate] = useState(new Date()); // 日历当前显示的日期
  const [selectedDate, setSelectedDate] = useState(new Date()); // 用户选中的日期
  const [calendarViewRange, setCalendarViewRange] = useState({ start: new Date(), end: new Date() }); // 日历实际显示的日期范围
  const [showUserGuide, setShowUserGuide] = useState(false);
  
  // 昵称编辑相关状态
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);


  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { tasks, fetchTasks, parseAndCreateTasks, deleteTask, batchDeleteTasks, analyzeSchedule } = taskStore();

  useEffect(() => {
    fetchTasks();
    
    // 检查是否是首次使用，如果是则显示用户引导
    const hasViewedGuide = localStorage.getItem('smarttime_guide_viewed');
    if (!hasViewedGuide) {
      setTimeout(() => {
        setShowUserGuide(true);
      }, 1000); // 延迟1秒显示，让用户先看到界面
    }
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
      
      // 只有在不是编辑状态时才更新显示数据，避免覆盖正在编辑的内容
      if (!isEditingUsername) {
        setUserDisplayData({
          username: displayName,
          avatar_url: (user as any)?.user_metadata?.avatar_url || ''
        });
      }
    }
  }, [user, isEditingUsername]);

  // 监听来自Profile页面的用户数据更新事件
  useEffect(() => {
    const handleUserDataUpdate = (event: CustomEvent) => {
      console.log('接收到用户数据更新事件:', event.detail);
      
      const username = event.detail.username;
      const email = user?.email || '';
      
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
        avatar_url: event.detail.avatar_url || ''
      });
      // 同时刷新AuthContext中的用户数据
      refreshUser();
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    };
  }, [refreshUser, user?.email]);

  // 昵称编辑处理函数
  const handleStartEditUsername = () => {
    setIsEditingUsername(true);
    setEditedUsername(userDisplayData.username || '');
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setEditedUsername('');
  };

  const handleSaveUsername = async () => {
    if (!user) {
      showError('错误', '用户未登录');
      return;
    }

    const newUsername = editedUsername.trim();
    if (!newUsername) {
      showError('错误', '昵称不能为空');
      return;
    }

    setIsSavingUsername(true);
    try {
      // 更新用户元数据
      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: newUsername
        }
      });

      if (error) {
        console.error('昵称更新失败:', error);
        throw new Error(`昵称更新失败: ${error.message}`);
      }

      console.log('昵称更新成功:', data);

      // 立即更新本地状态
      setUserDisplayData(prev => ({
        ...prev,
        username: newUsername
      }));

      // 结束编辑状态
      setIsEditingUsername(false);
      setEditedUsername('');

      // 刷新用户数据（在编辑状态结束后）
      try {
        await refreshUser();
        console.log('用户数据刷新成功');
      } catch (refreshError: any) {
        console.error('用户数据刷新失败:', refreshError);
      }

      showSuccess('保存成功', '昵称已成功更新');

      // 触发全局用户数据更新事件
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
          detail: {
            username: newUsername,
            avatar_url: userDisplayData.avatar_url
          }
        }));
      }, 100);
    } catch (error: any) {
      console.error('保存昵称失败:', error);
      showError('保存失败', error.message || '昵称保存时发生未知错误');
    } finally {
      setIsSavingUsername(false);
    }
  };

  // 监听日期变化，在跨天时自动刷新数据
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const currentDateString = now.toDateString();
      const storedDate = localStorage.getItem('lastActiveDate');
      
      if (storedDate && storedDate !== currentDateString) {
        // 日期发生变化，刷新任务数据
        console.log('检测到日期变化，刷新任务数据');
        fetchTasks();
      }
      
      // 更新存储的日期
      localStorage.setItem('lastActiveDate', currentDateString);
    };

    // 立即检查一次
    checkDateChange();

    // 每分钟检查一次日期变化
    const interval = setInterval(checkDateChange, 60000);

    // 在午夜时刻（00:00）设置特殊检查
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimeout = setTimeout(() => {
      console.log('午夜时刻，刷新任务数据');
      fetchTasks();
      
      // 设置每天午夜的定时刷新
      const dailyInterval = setInterval(() => {
        console.log('每日午夜刷新任务数据');
        fetchTasks();
      }, 24 * 60 * 60 * 1000); // 24小时
      
      return () => clearInterval(dailyInterval);
    }, timeUntilMidnight);

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimeout);
    };
  }, [fetchTasks]);

  // 添加快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中，如果是则不处理快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // 检查是否有模态框打开，如果有则不处理快捷键
      if (showModal || showResultModal || showDeleteConfirm) {
        return;
      }

      const key = e.key.toLowerCase();
      const calendar = calendarRef.current;
      
      if (calendar) {
        switch (key) {
          case 'd':
            e.preventDefault();
            calendar.getApi().changeView('timeGridDay');
            setCurrentView('timeGridDay');
            showInfo('视图切换', '已切换到日视图');
            break;
          case 'w':
            e.preventDefault();
            calendar.getApi().changeView('timeGridWeek');
            setCurrentView('timeGridWeek');
            showInfo('视图切换', '已切换到周视图');
            break;
          case 'm':
            e.preventDefault();
            calendar.getApi().changeView('dayGridMonth');
            setCurrentView('dayGridMonth');
            showInfo('视图切换', '已切换到月视图');
            break;
          case 't':
            e.preventDefault();
            calendar.getApi().today();
            showInfo('导航', '已回到今天');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, showResultModal, showDeleteConfirm]);

  // 添加按钮点击监听器来调试视图切换
  useEffect(() => {
    const handleButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('fc-button')) {
        console.log('FullCalendar按钮被点击:', target.textContent, target.className);
      }
    };
    
    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, []);

  // 监听currentView变化，手动更新删除按钮文本
  useEffect(() => {
    const updateDeleteButtonText = () => {
      const deleteButton = document.querySelector('.fc-deleteButton-button');
      if (deleteButton) {
        const newText = getDeleteButtonText();
        deleteButton.textContent = newText;
        console.log('手动更新删除按钮文本:', newText, 'currentView:', currentView);
      } else {
        // 如果按钮还没有渲染，稍后再试
        setTimeout(updateDeleteButtonText, 100);
      }
    };
    
    if (calendarRef.current) {
      // 添加小延迟确保DOM已更新
      setTimeout(updateDeleteButtonText, 50);
    }
  }, [currentView]);
  
  // 组件挂载后初始化按钮文本
  useEffect(() => {
    const initDeleteButtonText = () => {
      const deleteButton = document.querySelector('.fc-deleteButton-button');
      if (deleteButton) {
        const newText = getDeleteButtonText();
        deleteButton.textContent = newText;
        console.log('初始化删除按钮文本:', newText);
      } else {
        // 如果按钮还没有渲染，稍后再试
        setTimeout(initDeleteButtonText, 200);
      }
    };
    
    // 延迟执行以确保FullCalendar完全渲染
    setTimeout(initDeleteButtonText, 300);
  }, []);

  console.log('Home组件渲染，当前视图:', currentView, '当前日期:', currentDate);
  console.log('FullCalendar按钮测试 - 组件已加载');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      showError('输入错误', '请输入任务描述');
      return;
    }

    setIsLoading(true);
    const currentInputText = inputText;
    try {
      const newTasks = await parseAndCreateTasks(inputText);
      setInputText('');
      
      // 刷新任务列表以确保显示所有重复任务实例
      await fetchTasks();
      
      // 显示任务创建结果
      setCreatedTasks(newTasks);
      setOriginalInputText(currentInputText);
      setShowResultModal(true);
      
      showSuccess('任务创建成功', `成功创建了 ${newTasks.length} 个任务！`);
    } catch (error) {
      showError('创建失败', '任务创建失败，请检查输入内容并重试');
    } finally {
      setIsLoading(false);
    }
  };



  const handleEventClick = (clickInfo: any) => {
    const task = tasks.find(t => t.id === clickInfo.event.id);
    if (task) {
      setSelectedTask(task);
      setModalMode('edit');
      setShowModal(true);
    }
  };

  const handleBatchDelete = (type: 'day' | 'week' | 'month') => {
    console.log('handleBatchDelete 被调用:', {
      type,
      currentView,
      currentDate,
      selectedDate
    });
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  const confirmBatchDelete = async () => {
    setIsDeleting(true);
    try {
      // 根据删除类型选择合适的日期
      let targetDate;
      
      console.log('删除前的状态:', {
        deleteType,
        currentView,
        currentDate,
        selectedDate,
        calendarViewRange,
        'calendarViewRange.start': calendarViewRange.start,
        'calendarViewRange.end': calendarViewRange.end
      });
      
      if (deleteType === 'month') {
        // 删除本月：使用当前显示的月份中的任意一天（使用currentDate）
        targetDate = new Date(currentDate);
      } else if (deleteType === 'week') {
        // 删除本周：在周视图下使用当前显示的周中间日期
        if (currentView === 'timeGridWeek') {
          targetDate = new Date(currentDate);
        } else {
          // 其他视图下使用选中的日期，如果没有选中则使用当前日期
          targetDate = selectedDate ? new Date(selectedDate) : new Date(currentDate);
        }
      } else {
        // 删除本日：在日视图下使用当前显示的日期
        if (currentView === 'timeGridDay') {
          targetDate = new Date(currentDate);
        } else {
          // 其他视图下使用选中的日期，如果没有选中则使用当前日期
          targetDate = selectedDate ? new Date(selectedDate) : new Date(currentDate);
        }
      }
      
      console.log('计算出的目标日期:', {
        targetDate,
        'targetDate.toISOString()': targetDate.toISOString(),
        'targetDate.toLocaleDateString()': targetDate.toLocaleDateString(),
        'targetDate年月日': `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`
      });
      
      const result = await batchDeleteTasks(deleteType, targetDate);
      console.log('批量删除结果:', result);
      
      if (result.success) {
        showSuccess('删除成功', result.message);
      } else {
        showError('删除失败', '操作未能完成，请重试');
      }
    } catch (error: any) {
      console.error('批量删除失败:', error);
      console.error('错误详情:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: error.config
      });
      
      // 根据错误类型显示不同的错误信息
      let errorMessage = '删除失败，请稍后重试';
      
      if (error.response?.status === 404) {
        errorMessage = '未找到要删除的任务或API路径错误';
      } else if (error.response?.status === 500) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (error.message?.includes('网络')) {
        errorMessage = '网络连接失败，请检查网络后重试';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      showError('删除失败', errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 智能日程安排处理函数
  const handleScheduleAnalyze = async () => {
    if (!scheduleInput.trim()) {
      showError('请输入工作描述');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const result = await analyzeSchedule(scheduleInput);
      
      if (result.work_info && result.recommendations) {
        setScheduleResults(result);
        setShowScheduleResults(true);
        showSuccess('智能分析完成！请选择合适的时间段');
      } else {
        showError('分析失败，请重试');
      }
    } catch (error: any) {
      console.error('智能日程分析错误:', error);
      showError('分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 应用智能日程安排结果
  const handleApplyScheduleResult = (selectedSlot: any) => {
    if (selectedSlot && scheduleResults?.work_info) {
      // 创建任务
      const taskData = {
        title: scheduleResults.work_info.title,
        start: selectedSlot.start,
        end: selectedSlot.end,
        priority: scheduleResults.work_info.priority,
      };
      
      // 打开任务创建模态框并预填数据
      setSelectedTask(taskData);
      setModalMode('create');
      setShowModal(true);
      
      // 清理智能日程安排状态
      setScheduleResults(null);
      setShowScheduleResults(false);
      setScheduleInput('');
      
      showSuccess('智能日程安排已应用，请确认并保存任务');
    }
  };

  const getDeleteTypeText = (type: 'day' | 'week' | 'month') => {
    switch (type) {
      case 'day': return '今日';
      case 'week': return '本周';
      case 'month': return '本月';
      default: return '';
    }
  };

  // 格式化时间段显示
  const formatDateRange = (type: 'day' | 'week' | 'month', targetDate: Date) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();
    
    switch (type) {
      case 'day':
        return `${year}年${month}月${date}日`;
      
      case 'week': {
        // 计算周的开始和结束日期
        const dayOfWeek = targetDate.getDay();
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startYear = startOfWeek.getFullYear();
        const startMonth = startOfWeek.getMonth() + 1;
        const startDate = startOfWeek.getDate();
        const endYear = endOfWeek.getFullYear();
        const endMonth = endOfWeek.getMonth() + 1;
        const endDate = endOfWeek.getDate();
        
        if (startYear === endYear && startMonth === endMonth) {
          return `${startYear}年${startMonth}月${startDate}日 - ${endDate}日`;
        } else if (startYear === endYear) {
          return `${startYear}年${startMonth}月${startDate}日 - ${endMonth}月${endDate}日`;
        } else {
          return `${startYear}年${startMonth}月${startDate}日 - ${endYear}年${endMonth}月${endDate}日`;
        }
      }
      
      case 'month':
        return `${year}年${month}月`;
      
      default:
        return '';
    }
  };

  // 获取要删除的时间段描述
  const getDeleteTimeRangeText = () => {
    let targetDate;
    
    if (deleteType === 'month') {
      targetDate = new Date(currentDate);
    } else if (deleteType === 'week') {
      // 删除本周：在周视图下使用当前显示的周中间日期
      if (currentView === 'timeGridWeek') {
        targetDate = new Date(currentDate);
      } else {
        // 其他视图下使用选中的日期，如果没有选中则使用当前日期
        targetDate = selectedDate ? new Date(selectedDate) : new Date(currentDate);
      }
    } else {
      // 删除本日：在日视图下使用当前显示的日期
      if (currentView === 'timeGridDay') {
        targetDate = new Date(currentDate);
      } else {
        // 其他视图下使用选中的日期，如果没有选中则使用当前日期
        targetDate = selectedDate ? new Date(selectedDate) : new Date(currentDate);
      }
    }
    
    return formatDateRange(deleteType, targetDate);
  };

  const getDeleteButtonText = () => {
    console.log('getDeleteButtonText - currentView:', currentView);
    const buttonText = (() => {
      switch (currentView) {
        case 'timeGridDay': return '删除本日';
        case 'timeGridWeek': return '删除本周';
        case 'dayGridMonth': return '删除本月';
        default: return '删除本月'; // 默认为删除本月
      }
    })();
    console.log('getDeleteButtonText - 返回文本:', buttonText);
    return buttonText;
  };

  const getDeleteTypeFromView = (): 'day' | 'week' | 'month' => {
    console.log('getDeleteTypeFromView - currentView:', currentView);
    switch (currentView) {
      case 'timeGridDay': return 'day';
      case 'timeGridWeek': return 'week';
      case 'dayGridMonth': return 'month';
      default: return 'month'; // 默认为月视图
    }
  };

  const handleDateClick = (dateClickInfo: any) => {
    // 点击日期创建新任务
    setSelectedDate(new Date(dateClickInfo.dateStr));
    setSelectedTask({
      start: dateClickInfo.date.toISOString(),
      end: new Date(dateClickInfo.date.getTime() + 60 * 60 * 1000).toISOString(), // 默认1小时
      priority: 'medium'
    } as Task);
    setModalMode('create');
    setShowModal(true);
  };

  // 处理筛选结果
  const handleFilteredTasks = (filtered: Task[]) => {
    setFilteredTasks(filtered);
    setIsFiltering(filtered.length !== tasks.length);
  };

  // 切换筛选面板
  const toggleFilter = () => {
    setShowFilter(!showFilter);
  };

  // 获取要显示的任务（筛选后的或全部）
  const getDisplayTasks = () => {
    return isFiltering ? filteredTasks : tasks;
  };

  const calendarEvents = getDisplayTasks().map(task => {
    // 基础颜色根据优先级
    let backgroundColor = task.priority === 'high' ? '#ef4444' : 
                         task.priority === 'medium' ? '#f59e0b' : '#10b981';
    let borderColor = task.priority === 'high' ? '#dc2626' : 
                     task.priority === 'medium' ? '#d97706' : '#059669';
    
    // 重复任务使用渐变色和特殊边框
    if (task.is_recurring) {
      backgroundColor = task.priority === 'high' ? '#f87171' : 
                       task.priority === 'medium' ? '#fbbf24' : '#34d399';
      borderColor = '#6366f1'; // 紫色边框表示重复任务
    }
    
    // 生成带有相对时间标识的标题
    const taskDate = new Date(task.start);
    const relativeTimeLabel = getRelativeTimeLabel(taskDate);
    let displayTitle = task.title;
    
    // 为任务添加相对时间标识
    if (relativeTimeLabel && relativeTimeLabel !== '其他') {
      displayTitle = `${relativeTimeLabel} ${task.title}`;
    }
    
    // 添加重复任务标识
    if (task.is_recurring) {
      displayTitle = `🔄 ${displayTitle}`;
    }
    
    return {
      id: task.id,
      title: displayTitle,
      start: task.start,
      end: task.end,
      backgroundColor,
      borderColor,
      borderWidth: task.is_recurring ? 2 : 1,
      extendedProps: {
        isRecurring: task.is_recurring,
        recurrenceRule: task.recurrence_rule,
        parentTaskId: task.parent_task_id,
        relativeTime: relativeTimeLabel
      }
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 顶部导航栏 */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 p-4 sm:p-6">
            {/* 左侧品牌标识 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">SmartTime</h1>
                <p className="text-gray-500 text-sm hidden sm:block">智能日程管理助手</p>
              </div>
            </div>
            
            {/* 右侧状态栏 */}
            <div className="flex items-center gap-4">
              {/* 实时时间显示 */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <RealtimeClock className="text-sm font-medium text-gray-700" />
              </div>
              
              {/* 用户信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                  {userDisplayData.avatar_url ? (
                    <img src={userDisplayData.avatar_url} alt="用户头像" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-blue-600" size={16} />
                  )}
                </div>
                <div className="text-sm hidden sm:block">
                  <p className="font-medium text-gray-800">
                    {userDisplayData.username}
                  </p>
                  <p className="text-gray-500 text-xs">{user?.email}</p>
                </div>
              </div>
              
              {/* 操作按钮组 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 border border-blue-200 hover:border-blue-300 font-medium shadow-sm hover:shadow-md"
                >
                  <User size={16} />
                  个人中心
                </button>
                
                <button
                  onClick={() => setShowUserGuide(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-all duration-200 border border-green-200 hover:border-green-300 font-medium shadow-sm hover:shadow-md"
                >
                  <HelpCircle size={16} />
                  使用指南
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                      showSuccess('登出成功', '已成功登出');
                      navigate('/login');
                    } catch (error) {
                      showError('登出失败', '登出失败，请重试');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 border border-red-200 hover:border-red-300 font-medium shadow-sm hover:shadow-md"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 欢迎信息 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            {isEditingUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  className="text-2xl sm:text-3xl font-bold text-gray-800 bg-white border-2 border-blue-300 rounded-lg px-3 py-1 text-center focus:outline-none focus:border-blue-500"
                  placeholder="输入昵称"
                  maxLength={20}
                  disabled={isSavingUsername}
                />
                <button
                  onClick={handleSaveUsername}
                  disabled={isSavingUsername || !editedUsername.trim()}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  title="保存昵称"
                >
                  {isSavingUsername ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleCancelEditUsername}
                  disabled={isSavingUsername}
                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                  title="取消编辑"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                  欢迎回来，{userDisplayData.username}！
                </h2>
                <button
                  onClick={handleStartEditUsername}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="编辑昵称"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-600 text-lg">用自然语言描述您的任务，AI 将自动为您安排日程</p>
        </div>

        {/* 智能日程安排功能区域 */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border border-purple-200 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            智能日程安排
          </h2>
          
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                placeholder="描述您的工作内容，AI将为您智能安排时间...\n例如：明天需要完成项目报告，大概需要3小时"
                className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
                disabled={isAnalyzing}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {scheduleInput.length}/500
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleScheduleAnalyze}
              disabled={isAnalyzing || !scheduleInput.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI智能分析中...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>开始智能分析</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 智能日程安排结果显示 */}
        {showScheduleResults && scheduleResults && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-200 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-800">智能分析结果</h3>
            </div>
            
            {/* 工作信息 */}
            <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <h4 className="font-medium text-gray-700 mb-2">工作信息</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">标题:</span>
                  <span className="ml-2 font-medium">{scheduleResults.work_info?.title}</span>
                </div>
                <div>
                  <span className="text-gray-500">预估时长:</span>
                  <span className="ml-2 font-medium">{scheduleResults.work_info?.duration_hours} 小时</span>
                </div>
                <div>
                  <span className="text-gray-500">优先级:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    scheduleResults.work_info?.priority === 'high' ? 'bg-red-100 text-red-700' :
                    scheduleResults.work_info?.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {scheduleResults.work_info?.priority === 'high' ? '高' : scheduleResults.work_info?.priority === 'medium' ? '中' : '低'}
                  </span>
                </div>
                {scheduleResults.work_info?.deadline && (
                  <div>
                    <span className="text-gray-500">截止时间:</span>
                    <span className="ml-2 font-medium">{new Date(scheduleResults.work_info.deadline).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* 推荐时间段 */}
            {scheduleResults.recommendations && scheduleResults.recommendations.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-3">推荐时间段</h4>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {scheduleResults.recommendations.map((slot: any, index: number) => (
                    <div
                      key={index}
                      onClick={() => handleApplyScheduleResult(slot)}
                      className="p-3 rounded-lg border-2 cursor-pointer transition-all border-gray-200 hover:border-purple-300 bg-white hover:bg-purple-50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">时间段 {index + 1}</span>
                        <span className="text-xs text-purple-600 font-medium">{slot.score}分</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        {new Date(slot.start).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - 
                        {new Date(slot.end).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-gray-500">{slot.reason}</div>
                      <div className="mt-2 flex items-center gap-1 text-purple-600">
                        <CheckCircle className="w-3 h-3" />
                        <span className="text-xs font-medium">点击应用此时间段</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleResults(false);
                  setScheduleResults(null);
                  setScheduleInput('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭结果
              </button>
            </div>
          </div>
        )}

        {/* 主要操作区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">创建新任务</h3>
            <p className="text-gray-600">使用自然语言描述，让AI为您智能安排</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  id="taskInput"
                  value={inputText}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 100) {
                      setInputText(value);
                    }
                  }}
                  placeholder="例如：明天上午9点开会，下午写项目报告，周五下午3点和客户见面..."
                  className={`w-full p-4 border-2 rounded-xl focus:ring-2 focus:border-transparent resize-none transition-all ${
                    inputText.length >= 90 ? 'border-orange-300 focus:ring-orange-500' : 
                    inputText.length === 100 ? 'border-red-300 focus:ring-red-500' : 
                    'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  rows={4}
                  disabled={isLoading}
                  maxLength={100}
                />
                <div className={`absolute bottom-3 right-3 text-xs font-medium ${
                  inputText.length >= 90 ? 'text-orange-600' : 
                  inputText.length === 100 ? 'text-red-600' : 
                  'text-gray-400'
                }`}>
                  {inputText.length}/100
                </div>
              </div>
            </div>
            
            {/* 主要操作按钮 */}
            <div className="flex gap-3">
              {/* AI智能解析按钮 - 占约1/2宽度 */}
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="flex-[2] px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 shadow-lg font-semibold transform hover:-translate-y-1 active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>AI 解析中...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>AI 智能解析</span>
                  </>
                )}
              </button>
              
              {/* 手动添加按钮 - 略小 */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setModalMode('create');
                  setShowModal(true);
                }}
                className="flex-1 px-4 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl hover:from-green-600 hover:to-teal-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg font-medium transform hover:-translate-y-1 active:scale-95"
              >
                <Plus size={18} />
                <span>手动添加</span>
              </button>
              
              {/* AI删除按钮 - 略小 */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setModalMode('delete');
                  setShowModal(true);
                }}
                className="flex-1 px-4 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg font-medium transform hover:-translate-y-1 active:scale-95"
              >
                <Trash2 size={18} />
                <span>AI 删除</span>
              </button>
            </div>
          </form>
        </div>

        {/* 任务统计概览 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            任务统计概览
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(() => {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() - today.getDay());
              const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
              
              const todayTasks = getDisplayTasks().filter(task => {
                const taskDate = new Date(task.start);
                return taskDate >= today && taskDate < tomorrow;
              });
              
              const tomorrowTasks = getDisplayTasks().filter(task => {
                const taskDate = new Date(task.start);
                const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
                return taskDate >= tomorrow && taskDate < dayAfterTomorrow;
              });
              
              const thisWeekTasks = getDisplayTasks().filter(task => {
                const taskDate = new Date(task.start);
                return taskDate >= startOfWeek && taskDate <= endOfWeek;
              });
              
              const completedTasks = getDisplayTasks().filter(task => task.completed);
              
              return (
                <>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700">今日任务</p>
                        <p className="text-2xl font-bold text-blue-600">{todayTasks.length}</p>
                      </div>
                      <div className="bg-blue-600 rounded-lg p-2">
                        <Calendar className="text-white" size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700">明日任务</p>
                        <p className="text-2xl font-bold text-green-600">{tomorrowTasks.length}</p>
                      </div>
                      <div className="bg-green-600 rounded-lg p-2">
                        <Clock className="text-white" size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700">本周任务</p>
                        <p className="text-2xl font-bold text-purple-600">{thisWeekTasks.length}</p>
                      </div>
                      <div className="bg-purple-600 rounded-lg p-2">
                        <CalendarDays className="text-white" size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-700">已完成</p>
                        <p className="text-2xl font-bold text-orange-600">{completedTasks.length}</p>
                      </div>
                      <div className="bg-orange-600 rounded-lg p-2">
                        <CheckCircle className="text-white" size={20} />
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* 日历展示区域 */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={20} />
              任务日历
            </h3>
            <p className="text-blue-100 text-sm mt-1">点击日期创建任务，点击任务进行编辑</p>
          </div>
          <div className="p-3 sm:p-6">
            <style>{`
              .fc-deleteButton-button {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
                border: none !important;
                color: white !important;
                border-radius: 8px !important;
                padding: 8px 16px !important;
                font-weight: 500 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2) !important;
              }
              .fc-deleteButton-button:hover {
                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3) !important;
              }
              .fc-deleteButton-button:active {
                transform: translateY(0) !important;
              }
            `}</style>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2025-01-27"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: isMobile ? 'dayGridMonth exportButton' : 'dayGridMonth,timeGridWeek,timeGridDay exportButton filterButton deleteButton'
            }}


            customButtons={{
              exportButton: {
                text: isMobile ? '⋯' : '导出',
                click: () => {
                  if (isMobile) {
                    // 移动端显示菜单
                    const menu = document.createElement('div');
                    menu.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end';
                    menu.innerHTML = `
                      <div class="bg-white w-full rounded-t-xl p-4 space-y-3">
                        <button class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg" onclick="document.querySelector('[data-action=export]').click(); this.closest('.fixed').remove();">导出数据</button>
                        <button class="w-full py-3 px-4 bg-gray-600 text-white rounded-lg" onclick="document.querySelector('[data-action=filter]').click(); this.closest('.fixed').remove();">筛选任务</button>
                        <button class="w-full py-3 px-4 bg-red-600 text-white rounded-lg" onclick="document.querySelector('[data-action=delete]').click(); this.closest('.fixed').remove();">删除任务</button>
                        <button class="w-full py-3 px-4 bg-gray-300 text-gray-700 rounded-lg" onclick="this.closest('.fixed').remove();">取消</button>
                      </div>
                    `;
                    document.body.appendChild(menu);
                  } else {
                    setShowExport(true);
                  }
                }
              },
              filterButton: {
                text: '筛选',
                click: toggleFilter
              },
              deleteButton: {
                text: '', // 初始为空，由useEffect动态更新
                click: () => {
                  const deleteType = getDeleteTypeFromView();
                  console.log('删除按钮点击:', {
                    currentView,
                    deleteType,
                    buttonText: getDeleteButtonText()
                  });
                  handleBatchDelete(deleteType);
                }
              }
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            viewDidMount={(info) => {
              setCurrentView(info.view.type);
              
              // 更新日历实际显示的日期范围
              setCalendarViewRange({
                start: new Date(info.view.activeStart),
                end: new Date(info.view.activeEnd)
              });
              
              // 根据视图类型设置合适的当前日期
              const view = info.view;
              if (view.type === 'dayGridMonth') {
                // 月视图：使用日历显示范围的中间日期来确定月份
                const viewStart = new Date(view.activeStart);
                const viewEnd = new Date(view.activeEnd);
                // 计算中间日期，这样可以准确获取当前显示的月份
                const middleTime = viewStart.getTime() + (viewEnd.getTime() - viewStart.getTime()) / 2;
                const middleDate = new Date(middleTime);
                // 使用中间日期的月份，设置为该月的10号
                const monthDate = new Date(middleDate.getFullYear(), middleDate.getMonth(), 10);
                setCurrentDate(monthDate);
              } else if (view.type === 'timeGridWeek') {
                // 周视图：使用当前周的开始日期，然后加2天到周三
                const weekStart = new Date(view.activeStart);
                const weekMiddle = new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000); // 加2天到周三
                setCurrentDate(weekMiddle);
              } else if (view.type === 'timeGridDay') {
                // 日视图：使用当前显示的日期
                setCurrentDate(new Date(view.activeStart));
              } else {
                setCurrentDate(new Date(view.activeStart));
              }
              
              // 日志输出
              if (view.type === 'dayGridMonth') {
                const viewStart = new Date(view.activeStart);
                const viewEnd = new Date(view.activeEnd);
                const middleTime = viewStart.getTime() + (viewEnd.getTime() - viewStart.getTime()) / 2;
                const logMiddleDate = new Date(middleTime);
                const logFinalDate = new Date(logMiddleDate.getFullYear(), logMiddleDate.getMonth(), 10);
                
                console.log('viewDidMount 更新:', {
                  viewType: view.type,
                  activeStart: view.activeStart,
                  activeEnd: view.activeEnd,
                  middleDate: logMiddleDate,
                  calendarViewRange: { start: view.activeStart, end: view.activeEnd },
                  finalCurrentDate: logFinalDate
                });
              } else {
                console.log('viewDidMount 更新:', {
                  viewType: view.type,
                  activeStart: view.activeStart,
                  activeEnd: view.activeEnd,
                  calendarViewRange: { start: view.activeStart, end: view.activeEnd },
                  finalCurrentDate: new Date(view.activeStart)
                });
              }
            }}
            datesSet={(dateInfo) => {
              // 更新日历实际显示的日期范围
              setCalendarViewRange({
                start: new Date(dateInfo.start),
                end: new Date(dateInfo.end)
              });
              
              // 当日历显示的日期范围改变时更新currentDate
              // 根据视图类型设置合适的当前日期
              const view = dateInfo.view;
              if (view.type === 'dayGridMonth') {
                // 月视图：使用日历显示范围的中间日期来确定月份
                const startDate = new Date(dateInfo.start);
                const endDate = new Date(dateInfo.end);
                // 计算中间日期，这样可以准确获取当前显示的月份
                const middleTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
                const middleDate = new Date(middleTime);
                // 使用中间日期的月份，设置为该月的10号
                const monthDate = new Date(middleDate.getFullYear(), middleDate.getMonth(), 10);
                setCurrentDate(monthDate);
              } else if (view.type === 'timeGridWeek') {
                // 周视图：使用当前周的中间日期（周三）
                const weekStart = new Date(dateInfo.start);
                const weekMiddle = new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000); // 加2天到周三
                setCurrentDate(weekMiddle);
              } else if (view.type === 'timeGridDay') {
                // 日视图：使用当前显示的日期
                setCurrentDate(new Date(dateInfo.start));
              } else {
                setCurrentDate(new Date(dateInfo.start));
              }
              
              // 日志输出
              if (view.type === 'dayGridMonth') {
                const startDate = new Date(dateInfo.start);
                const endDate = new Date(dateInfo.end);
                const middleTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
                const logMiddleDate = new Date(middleTime);
                const logFinalDate = new Date(logMiddleDate.getFullYear(), logMiddleDate.getMonth(), 10);
                
                console.log('datesSet 更新:', {
                  viewType: view.type,
                  start: dateInfo.start,
                  end: dateInfo.end,
                  middleDate: logMiddleDate,
                  calendarViewRange: { start: dateInfo.start, end: dateInfo.end },
                  finalCurrentDate: logFinalDate
                });
              } else {
                console.log('datesSet 更新:', {
                  viewType: view.type,
                  start: dateInfo.start,
                  end: dateInfo.end,
                  calendarViewRange: { start: dateInfo.start, end: dateInfo.end },
                  finalCurrentDate: new Date(dateInfo.start)
                });
              }
            }}
            height="auto"
            locale="zh-cn"
            buttonText={{
              today: '今天',
              month: '月',
              week: '周',
              day: '日'
            }}
            dayMaxEvents={3}
            moreLinkText="更多"
            eventDisplay="block"
            displayEventTime={true}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
          />
          </div>
        </div>
        
        {/* 隐藏的功能按钮，用于移动端菜单调用 */}
        <button 
          data-action="export" 
          className="hidden" 
          onClick={() => setShowExport(true)}
        />
        <button 
          data-action="filter" 
          className="hidden" 
          onClick={toggleFilter}
        />
        <button 
          data-action="delete" 
          className="hidden" 
          onClick={() => {
            const deleteType = getDeleteTypeFromView();
            handleBatchDelete(deleteType);
          }}
        />

        {/* 任务筛选面板 */}
        {showFilter && (
          <div className="mt-6">
            <TaskFilter
              tasks={tasks}
              onFilteredTasks={handleFilteredTasks}
              onClose={() => setShowFilter(false)}
              isVisible={showFilter}
              onToggle={toggleFilter}
            />
          </div>
        )}
      </div>

      {/* 统一任务模态框 */}
      {showModal && (
        <UnifiedTaskModal
          mode={modalMode}
          task={selectedTask}
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedTask(null);
            fetchTasks();
          }}
        />
      )}

      {/* 任务创建结果模态框 */}
      {showResultModal && (
        <TaskResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          createdTasks={createdTasks}
          originalText={originalInputText}
        />
      )}

      {/* 批量删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              确认删除{getDeleteTypeText(deleteType)}安排
            </h3>
            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                您确定要删除以下时间段的所有任务安排吗？
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <p className="text-red-800 font-medium text-center">
                  {getDeleteTimeRangeText()}
                </p>
              </div>
              <p className="text-gray-500 text-sm">
                此操作不可撤销，请谨慎操作。
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 数据导出模态框 */}
      {showExport && (
        <DataExport
          tasks={tasks}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* 任务提醒组件 - 已禁用以避免401错误 */}
      {/* <TaskReminder 
        tasks={tasks} 
        onMarkReminderSent={(taskId) => {
          // 标记提醒已发送
          console.log('标记提醒已发送:', taskId);
        }}
      /> */}
      
      {/* 用户引导 */}
      <UserGuide 
        isOpen={showUserGuide}
        onClose={() => setShowUserGuide(false)}
      />
    </div>
  );
}