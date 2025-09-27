import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, Send, Loader2, Zap, Trash2, LogOut, User, HelpCircle } from 'lucide-react';
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
import TaskReminder from '../components/TaskReminder';
import TaskFilter from '../components/TaskFilter';
import DataExport from '../components/DataExport';
import UserGuide from '../components/UserGuide';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const calendarRef = useRef<FullCalendar>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete'>('create');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
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


  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { tasks, fetchTasks, parseAndCreateTasks, deleteTask, batchDeleteTasks } = taskStore();

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
      start: dateClickInfo.date,
      end: new Date(dateClickInfo.date.getTime() + 60 * 60 * 1000), // 默认1小时
      priority: 'medium'
    });
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
    
    return {
      id: task.id,
      title: task.is_recurring ? `🔄 ${task.title}` : task.title,
      start: task.start,
      end: task.end,
      backgroundColor,
      borderColor,
      borderWidth: task.is_recurring ? 2 : 1,
      extendedProps: {
        isRecurring: task.is_recurring,
        recurrenceRule: task.recurrence_rule,
        parentTaskId: task.parent_task_id
      }
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 头部区域 */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 lg:gap-0 mb-8">
          {/* 左侧标题 */}
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2 flex items-center gap-2 lg:gap-3">
              <Calendar className="text-blue-600" size={32} />
              SmartTime
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">用自然语言描述您的任务，AI 将自动为您安排日程</p>
          </div>
          
          {/* 右侧用户信息 */}
          <div className="flex items-center gap-2 sm:gap-4 bg-white rounded-lg shadow-md px-3 sm:px-4 py-2 sm:py-3 self-start lg:self-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="text-blue-600" size={16} />
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-800">
                  {user?.user_metadata?.username || user?.email?.split('@')[0] || '用户'}
                </p>
                <p className="text-gray-500 text-xs">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => setShowUserGuide(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="查看使用指南"
            >
              <HelpCircle size={16} />
              <span className="text-sm">帮助</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await signOut();
                  toast.success('已成功登出');
                  navigate('/login');
                } catch (error) {
                  toast.error('登出失败，请重试');
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="登出"
            >
              <LogOut size={16} />
              <span className="text-sm">登出</span>
            </button>
          </div>
        </div>

        {/* 任务输入区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-4">
              <label htmlFor="taskInput" className="text-lg font-semibold text-gray-700">
                描述您的任务
              </label>
              <textarea
                id="taskInput"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如：明天上午9点开会，下午写项目报告，周五下午3点和客户见面..."
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg text-sm sm:text-base"
              >
                <Zap size={18} />
                智能日程安排
              </button>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(null);
                    setModalMode('create');
                    setShowModal(true);
                  }}
                  className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-none"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">手动添加</span>
                  <span className="sm:hidden">添加</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(null);
                    setModalMode('delete');
                    setShowModal(true);
                  }}
                  className="px-3 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-none"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">AI 删除</span>
                  <span className="sm:hidden">删除</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="px-3 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-none"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  <span className="hidden sm:inline">{isLoading ? '解析中...' : 'AI 解析任务'}</span>
                  <span className="sm:hidden">{isLoading ? '解析中' : 'AI解析'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>



        {/* 日历展示区域 */}
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6">
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

      {/* 任务提醒组件 */}
      <TaskReminder tasks={tasks} />
      
      {/* 用户引导 */}
      <UserGuide 
        isOpen={showUserGuide}
        onClose={() => setShowUserGuide(false)}
      />
    </div>
  );
}