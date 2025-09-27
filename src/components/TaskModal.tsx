import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Clock, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { taskStore, Task, TaskCreate, TaskUpdate } from '../store/taskStore';
import { toast } from 'react-toastify';

interface TaskModalProps {
  task?: Partial<Task> | null;
  onClose: () => void;
  onSave: () => void;
}

export default function TaskModal({ task, onClose, onSave }: TaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    start: '',
    end: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const { createTask, updateTask, deleteTask } = taskStore();
  
  const isEditing = task && 'id' in task && task.id;

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        start: task.start ? formatDateTimeLocal(new Date(task.start)) : '',
        end: task.end ? formatDateTimeLocal(new Date(task.end)) : '',
        priority: task.priority || 'medium'
      });
    }
  }, [task]);

  // 格式化日期时间为本地输入格式
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('请输入任务标题');
      return;
    }
    
    if (!formData.start) {
      toast.error('请选择开始时间');
      return;
    }

    setIsLoading(true);
    
    try {
      const taskData = {
        title: formData.title.trim(),
        start: new Date(formData.start).toISOString(),
        end: formData.end ? new Date(formData.end).toISOString() : undefined,
        priority: formData.priority
      };

      if (isEditing) {
        await updateTask(task.id!, taskData as TaskUpdate);
        toast.success('任务更新成功！');
      } else {
        await createTask(taskData as TaskCreate);
        toast.success('任务创建成功！');
      }
      
      onSave();
    } catch (error) {
      toast.error(isEditing ? '更新任务失败' : '创建任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !task?.id) return;
    
    if (!confirm('确定要删除这个任务吗？')) return;
    
    setIsLoading(true);
    
    try {
      await deleteTask(task.id);
      toast.success('任务删除成功！');
      onSave();
    } catch (error) {
      toast.error('删除任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const priorityOptions = [
    { value: 'low', label: '低优先级', color: 'text-green-600', bgColor: 'bg-green-100' },
    { value: 'medium', label: '中优先级', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    { value: 'high', label: '高优先级', color: 'text-red-600', bgColor: 'bg-red-100' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            {isEditing ? '编辑任务' : '创建任务'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 任务标题 */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              任务标题 *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入任务标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          {/* 开始时间 */}
          <div className="space-y-2">
            <label htmlFor="start" className="block text-sm font-medium text-gray-700 flex items-center gap-1">
              <Clock size={16} />
              开始时间 *
            </label>
            <input
              type="datetime-local"
              id="start"
              value={formData.start}
              onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          {/* 结束时间 */}
          <div className="space-y-2">
            <label htmlFor="end" className="block text-sm font-medium text-gray-700 flex items-center gap-1">
              <Clock size={16} />
              结束时间（可选）
            </label>
            <input
              type="datetime-local"
              id="end"
              value={formData.end}
              onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              min={formData.start}
            />
          </div>

          {/* 优先级 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
              <Flag size={16} />
              优先级
            </label>
            <div className="grid grid-cols-3 gap-2">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: option.value as any })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.priority === option.value
                      ? `border-blue-500 ${option.bgColor} ${option.color}`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 按钮组 */}
          <div className="flex justify-between pt-4">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                删除
              </button>
            )}
            
            <div className={`flex gap-3 ${!isEditing ? 'ml-auto' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                {isLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}