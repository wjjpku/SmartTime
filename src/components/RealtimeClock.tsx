import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface RealtimeClockProps {
  showSeconds?: boolean;
  showDate?: boolean;
  className?: string;
}

const RealtimeClock: React.FC<RealtimeClockProps> = ({ 
  showSeconds = true, 
  showDate = true, 
  className = '' 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    if (showSeconds) {
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}`;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}年${month}月${day}日 ${weekday}`;
  };

  const getTimeOfDay = (date: Date) => {
    const hour = date.getHours();
    if (hour < 6) return '凌晨';
    if (hour < 12) return '上午';
    if (hour < 18) return '下午';
    return '晚上';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Clock className="w-4 h-4 text-blue-500" />
      <div className="flex flex-col">
        {showDate && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(currentTime)}
          </div>
        )}
        <div className="font-mono text-lg font-semibold text-gray-800 dark:text-gray-200">
          {getTimeOfDay(currentTime)} {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
};

export default RealtimeClock;

// 导出一个简化版本的时钟组件
export const SimpleClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <span className={`font-mono ${className}`}>
      {formatTime(currentTime)}
    </span>
  );
};

// 导出日期相关的工具函数
export const getRelativeTimeLabel = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === -1) return '昨天';
  if (diffDays > 1 && diffDays <= 7) return `${diffDays}天后`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)}天前`;
  
  return date.toLocaleDateString('zh-CN');
};

// 检查是否为今天
export const isToday = (date: Date): boolean => {
  const now = new Date();
  return date.getDate() === now.getDate() &&
         date.getMonth() === now.getMonth() &&
         date.getFullYear() === now.getFullYear();
};

// 检查是否为本周
export const isThisWeek = (date: Date): boolean => {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
  
  return date >= startOfWeek && date <= endOfWeek;
};