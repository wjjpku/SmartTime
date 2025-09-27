import React, { useState } from 'react';
import { Filter, X, Calendar, Star, Clock } from 'lucide-react';
import { Task } from '../store/taskStore';

interface TaskFilterProps {
  tasks: Task[];
  onFilteredTasks: (filteredTasks: Task[]) => void;
  isVisible: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

interface FilterOptions {
  priority: string[];
  timeRange: string;
  important: boolean | null;
  hasReminder: boolean | null;
}

const TaskFilter: React.FC<TaskFilterProps> = ({
  tasks,
  onFilteredTasks,
  isVisible,
  onToggle,
  onClose
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    priority: [],
    timeRange: 'all',
    important: null,
    hasReminder: null
  });

  // 应用筛选
  const applyFilters = (newFilters: FilterOptions) => {
    let filteredTasks = [...tasks];
    const now = new Date();

    // 按优先级筛选
    if (newFilters.priority.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        newFilters.priority.includes(task.priority)
      );
    }

    // 按重要程度筛选
    if (newFilters.important !== null) {
      filteredTasks = filteredTasks.filter(task => 
        task.is_important === newFilters.important
      );
    }

    // 按提醒设置筛选
    if (newFilters.hasReminder !== null) {
      filteredTasks = filteredTasks.filter(task => {
        const hasReminder = task.reminder_type && task.reminder_type !== 'none';
        return hasReminder === newFilters.hasReminder;
      });
    }

    // 按时间范围筛选
    if (newFilters.timeRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (newFilters.timeRange) {
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          filteredTasks = filteredTasks.filter(task => {
            const taskDate = new Date(task.start);
            return taskDate >= today && taskDate < tomorrow;
          });
          break;
        case 'week':
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          filteredTasks = filteredTasks.filter(task => {
            const taskDate = new Date(task.start);
            return taskDate >= today && taskDate < weekEnd;
          });
          break;
        case 'month':
          const monthEnd = new Date(today);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          filteredTasks = filteredTasks.filter(task => {
            const taskDate = new Date(task.start);
            return taskDate >= today && taskDate < monthEnd;
          });
          break;
        case 'overdue':
          filteredTasks = filteredTasks.filter(task => {
            const taskDate = new Date(task.start);
            return taskDate < now;
          });
          break;
      }
    }

    onFilteredTasks(filteredTasks);
  };

  // 更新筛选条件
  const updateFilter = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  // 切换优先级筛选
  const togglePriority = (priority: string) => {
    const newPriorities = filters.priority.includes(priority)
      ? filters.priority.filter(p => p !== priority)
      : [...filters.priority, priority];
    updateFilter('priority', newPriorities);
  };

  // 重置筛选
  const resetFilters = () => {
    const resetFilters = {
      priority: [],
      timeRange: 'all',
      important: null,
      hasReminder: null
    };
    setFilters(resetFilters);
    applyFilters(resetFilters);
  };

  // 获取活跃筛选数量
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.priority.length > 0) count++;
    if (filters.timeRange !== 'all') count++;
    if (filters.important !== null) count++;
    if (filters.hasReminder !== null) count++;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  return (
    <div className="relative">
      {/* 筛选按钮 */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
          isVisible || activeCount > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Filter size={16} />
        筛选
        {activeCount > 0 && (
          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* 筛选面板 */}
      {isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-start sm:justify-start">
          <div className="w-full sm:w-80 bg-white rounded-t-xl sm:rounded-xl sm:absolute sm:top-full sm:left-0 sm:mt-2 shadow-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-800">任务筛选</h3>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  重置
                </button>
              )}
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 优先级筛选 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              优先级
            </label>
            <div className="flex gap-2">
              {[
                { value: 'high', label: '高', color: 'bg-red-100 text-red-700 border-red-200' },
                { value: 'medium', label: '中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                { value: 'low', label: '低', color: 'bg-green-100 text-green-700 border-green-200' }
              ].map(priority => (
                <button
                  key={priority.value}
                  onClick={() => togglePriority(priority.value)}
                  className={`px-3 py-1 rounded-lg border text-sm transition-all ${
                    filters.priority.includes(priority.value)
                      ? priority.color
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* 时间范围筛选 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={14} className="inline mr-1" />
              时间范围
            </label>
            <select
              value={filters.timeRange}
              onChange={(e) => updateFilter('timeRange', e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部时间</option>
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
              <option value="overdue">已过期</option>
            </select>
          </div>

          {/* 重要任务筛选 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Star size={14} className="inline mr-1" />
              重要程度
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateFilter('important', filters.important === true ? null : true)}
                className={`px-3 py-1 rounded-lg border text-sm transition-all ${
                  filters.important === true
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                重要任务
              </button>
              <button
                onClick={() => updateFilter('important', filters.important === false ? null : false)}
                className={`px-3 py-1 rounded-lg border text-sm transition-all ${
                  filters.important === false
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                普通任务
              </button>
            </div>
          </div>

          {/* 提醒设置筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock size={14} className="inline mr-1" />
              提醒设置
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateFilter('hasReminder', filters.hasReminder === true ? null : true)}
                className={`px-3 py-1 rounded-lg border text-sm transition-all ${
                  filters.hasReminder === true
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                有提醒
              </button>
              <button
                onClick={() => updateFilter('hasReminder', filters.hasReminder === false ? null : false)}
                className={`px-3 py-1 rounded-lg border text-sm transition-all ${
                  filters.hasReminder === false
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                无提醒
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskFilter;