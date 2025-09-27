import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  start: string;
  end?: string;
  priority: 'low' | 'medium' | 'high';
  reminder_type?: string;
  is_important?: boolean;
  reminder_sent?: boolean;
}

interface TaskReminderProps {
  tasks: Task[];
  onMarkReminderSent: (taskId: string) => void;
}

const TaskReminder: React.FC<TaskReminderProps> = ({ tasks, onMarkReminderSent }) => {
  const [notifications, setNotifications] = useState<Task[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // 请求通知权限
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setPermissionGranted(permission === 'granted');
      }
    };

    requestNotificationPermission();
  }, []);

  // 从后端获取提醒任务
  const fetchReminderTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks/reminders');
      if (response.ok) {
        const data = await response.json();
        const pendingReminders = data.tasks || [];
        
        setNotifications(pendingReminders);
        
        // 显示提醒
        pendingReminders.forEach((task: Task) => {
          showNotification(task);
          onMarkReminderSent(task.id);
        });
      }
    } catch (error) {
      console.error('获取提醒任务失败:', error);
      // 使用备用方案
      checkReminders();
    }
  }, []);

  // 检查需要提醒的任务（备用方案）
  const checkReminders = () => {
    const now = new Date();
    const pendingReminders: Task[] = [];

    tasks.forEach(task => {
      if (task.reminder_sent || task.reminder_type === 'none') {
        return;
      }

      const taskStart = new Date(task.start);
      let reminderTime = new Date(taskStart);

      // 计算提醒时间
      switch (task.reminder_type) {
        case 'at_time':
          reminderTime = taskStart;
          break;
        case 'before_5min':
          reminderTime = new Date(taskStart.getTime() - 5 * 60 * 1000);
          break;
        case 'before_15min':
          reminderTime = new Date(taskStart.getTime() - 15 * 60 * 1000);
          break;
        case 'before_30min':
          reminderTime = new Date(taskStart.getTime() - 30 * 60 * 1000);
          break;
        case 'before_1hour':
          reminderTime = new Date(taskStart.getTime() - 60 * 60 * 1000);
          break;
        case 'before_1day':
          reminderTime = new Date(taskStart.getTime() - 24 * 60 * 60 * 1000);
          break;
        default:
          return;
      }

      // 检查是否到了提醒时间
      if (now >= reminderTime) {
        pendingReminders.push(task);
      }
    });

    // 按重要性和开始时间排序
    pendingReminders.sort((a, b) => {
      if (a.is_important !== b.is_important) {
        return a.is_important ? -1 : 1;
      }
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    setNotifications(pendingReminders);

    // 发送浏览器通知
    pendingReminders.forEach(task => {
      showNotification(task);
      onMarkReminderSent(task.id);
    });
  };

  // 检查需要提醒的任务
  useEffect(() => {

    const interval = setInterval(fetchReminderTasks, 30000); // 每30秒检查一次
    fetchReminderTasks(); // 立即检查一次

    return () => clearInterval(interval);
  }, [tasks, onMarkReminderSent]);

  const showNotification = (task: Task) => {
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const importantPrefix = task.is_important ? '⭐ ' : '';
    const priorityPrefix = priorityEmoji[task.priority] || '🟡';
    
    const now = new Date();
    const taskStart = new Date(task.start);
    const timeDiff = taskStart.getTime() - now.getTime();
    
    let timeText = '';
    if (timeDiff <= 0) {
      timeText = '现在开始';
    } else if (timeDiff < 3600000) { // 小于1小时
      const minutes = Math.floor(timeDiff / 60000);
      timeText = `${minutes}分钟后开始`;
    } else if (timeDiff < 86400000) { // 小于1天
      const hours = Math.floor(timeDiff / 3600000);
      timeText = `${hours}小时后开始`;
    } else {
      const days = Math.floor(timeDiff / 86400000);
      timeText = `${days}天后开始`;
    }

    const message = `${importantPrefix}${priorityPrefix} ${task.title}\n${timeText}`;

    // 显示toast通知
    toast(message, {
      duration: task.is_important ? 10000 : 5000,
      action: {
        label: '知道了',
        onClick: () => {}
      },
      className: task.is_important ? 'border-red-500 bg-red-50' : undefined
    });

    // 显示浏览器通知
    if (permissionGranted && 'Notification' in window) {
      const notification = new Notification(`任务提醒: ${task.title}`, {
        body: timeText,
        icon: '/favicon.ico',
        tag: task.id,
        requireInteraction: task.is_important
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 自动关闭通知
      setTimeout(() => {
        notification.close();
      }, task.is_important ? 10000 : 5000);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return '今天';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return '明天';
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const dismissNotification = (taskId: string) => {
    setNotifications(prev => prev.filter(task => task.id !== taskId));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(task => (
        <div
          key={task.id}
          className={`bg-white border-l-4 ${
            task.is_important ? 'border-red-500' : 'border-blue-500'
          } rounded-lg shadow-lg p-4 animate-slide-in-right`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {task.is_important && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <Bell className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-900">
                  任务提醒
                </span>
              </div>
              
              <h4 className="font-medium text-gray-900 mb-1">
                {task.title}
              </h4>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-3 h-3" />
                <span>
                  {formatDate(task.start)} {formatTime(task.start)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                  {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => dismissNotification(task.id)}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskReminder;