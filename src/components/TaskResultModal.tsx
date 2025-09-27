import React from 'react';
import { X, Calendar, Clock, Flag, CheckCircle } from 'lucide-react';
import { Task } from '../store/taskStore';

interface TaskResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  createdTasks: Task[];
  originalText: string;
}

const TaskResultModal: React.FC<TaskResultModalProps> = ({
  isOpen,
  onClose,
  createdTasks,
  originalText
}) => {
  if (!isOpen) return null;

  // 确保createdTasks是数组类型
  const safeTasks = Array.isArray(createdTasks) ? createdTasks : [];

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

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '普通';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500" size={24} />
            <h2 className="text-xl font-bold text-gray-800">任务创建成功</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 原始输入 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">您的输入：</h3>
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
              <p className="text-gray-700 italic">"{originalText}"</p>
            </div>
          </div>

          {/* 创建的任务列表 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              已为您创建 {safeTasks.length} 个任务：
            </h3>
            <div className="space-y-4">
              {safeTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-medium text-gray-800 flex-1">
                      {index + 1}. {task.title}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      <Flag size={12} className="inline mr-1" />
                      {getPriorityText(task.priority)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-blue-500" />
                      <span>开始时间：{formatDateTime(task.start)}</span>
                    </div>
                    {task.end && (
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-green-500" />
                        <span>结束时间：{formatDateTime(task.end)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-blue-800 text-sm">
              <strong>提示：</strong> 您可以在日历中查看这些任务，点击任务可以进行编辑或删除操作。
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskResultModal;