import React from 'react';
import { Bell, Clock, AlertCircle } from 'lucide-react';

interface ReminderSettingsProps {
  reminderType: string;
  isImportant: boolean;
  onReminderTypeChange: (type: string) => void;
  onImportantChange: (important: boolean) => void;
  disabled?: boolean;
}

const ReminderSettings: React.FC<ReminderSettingsProps> = ({
  reminderType,
  isImportant,
  onReminderTypeChange,
  onImportantChange,
  disabled = false
}) => {
  const reminderOptions = [
    { value: 'none', label: '无提醒', icon: null },
    { value: 'at_time', label: '准时提醒', icon: <Bell className="w-4 h-4" /> },
    { value: 'before_5min', label: '提前5分钟', icon: <Clock className="w-4 h-4" /> },
    { value: 'before_15min', label: '提前15分钟', icon: <Clock className="w-4 h-4" /> },
    { value: 'before_30min', label: '提前30分钟', icon: <Clock className="w-4 h-4" /> },
    { value: 'before_1hour', label: '提前1小时', icon: <Clock className="w-4 h-4" /> },
    { value: 'before_1day', label: '提前1天', icon: <Clock className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-4">
      {/* 提醒类型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Bell className="w-4 h-4 inline mr-1" />
          提醒设置
        </label>
        <select
          value={reminderType}
          onChange={(e) => onReminderTypeChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reminderOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 重要任务标记 */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="important-task"
          checked={isImportant}
          onChange={(e) => onImportantChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <label htmlFor="important-task" className="flex items-center text-sm font-medium text-gray-700">
          <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
          标记为重要任务
        </label>
      </div>

      {/* 提醒说明 */}
      {reminderType !== 'none' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-start">
            <Bell className="w-4 h-4 text-blue-500 mt-0.5 mr-2" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">提醒说明：</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>系统会在设定时间发送浏览器通知</li>
                <li>重要任务会优先显示并使用特殊提示音</li>
                <li>请确保浏览器允许通知权限</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;