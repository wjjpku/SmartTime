import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Clock, Flag, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { taskStore, Task, TaskCreate, TaskUpdate, RecurrenceRule } from '../store/taskStore';
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
    priority: 'medium' as 'low' | 'medium' | 'high',
    is_recurring: false,
    recurrence_rule: {
      frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: 1,
      days_of_week: [] as number[],
      end_date: null as string | null,
      count: null as number | null
    }
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
        priority: task.priority || 'medium',
        is_recurring: task.is_recurring || false,
        recurrence_rule: task.recurrence_rule ? {
          frequency: task.recurrence_rule.frequency || 'weekly',
          interval: task.recurrence_rule.interval || 1,
          days_of_week: task.recurrence_rule.days_of_week || [],
          end_date: task.recurrence_rule.end_date || null,
          count: task.recurrence_rule.count || null
        } : {
          frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
          interval: 1,
          days_of_week: [] as number[],
          end_date: null as string | null,
          count: null as number | null
        }
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
      const taskData: any = {
        title: formData.title.trim(),
        start: new Date(formData.start).toISOString(),
        end: formData.end ? new Date(formData.end).toISOString() : undefined,
        priority: formData.priority,
        is_recurring: formData.is_recurring
      };
      
      // 如果是重复任务，添加重复规则
      if (formData.is_recurring) {
        taskData.recurrence_rule = {
          frequency: formData.recurrence_rule.frequency,
          interval: formData.recurrence_rule.interval,
          days_of_week: formData.recurrence_rule.days_of_week,
          end_date: formData.recurrence_rule.end_date,
          count: formData.recurrence_rule.count
        };
      }

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

          {/* 重复任务设置 */}
          {!isEditing && (
            <div className="space-y-4">
              {/* 重复任务开关 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Repeat size={16} />
                  重复任务
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_recurring: !formData.is_recurring })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_recurring ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_recurring ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 重复规则设置 */}
              {formData.is_recurring && (
                <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  {/* 重复频率 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      重复频率
                    </label>
                    <select
                      value={formData.recurrence_rule.frequency}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrence_rule: {
                          ...formData.recurrence_rule,
                          frequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly'
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    >
                      <option value="daily">每日</option>
                      <option value="weekly">每周</option>
                      <option value="monthly">每月</option>
                      <option value="yearly">每年</option>
                    </select>
                  </div>

                  {/* 重复间隔 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      重复间隔
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">每</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={formData.recurrence_rule.interval}
                        onChange={(e) => setFormData({
                          ...formData,
                          recurrence_rule: {
                            ...formData.recurrence_rule,
                            interval: parseInt(e.target.value) || 1
                          }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                      />
                      <span className="text-sm text-gray-600">
                        {formData.recurrence_rule.frequency === 'daily' ? '天' :
                         formData.recurrence_rule.frequency === 'weekly' ? '周' :
                         formData.recurrence_rule.frequency === 'monthly' ? '月' : '年'}
                      </span>
                    </div>
                  </div>

                  {/* 星期几选择（仅周重复时显示） */}
                  {formData.recurrence_rule.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        重复日期
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              const days = [...formData.recurrence_rule.days_of_week];
                              const dayIndex = days.indexOf(index);
                              if (dayIndex > -1) {
                                days.splice(dayIndex, 1);
                              } else {
                                days.push(index);
                              }
                              setFormData({
                                ...formData,
                                recurrence_rule: {
                                  ...formData.recurrence_rule,
                                  days_of_week: days.sort()
                                }
                              });
                            }}
                            className={`p-2 text-xs rounded-lg border-2 transition-all ${
                              formData.recurrence_rule.days_of_week.includes(index)
                                ? 'border-blue-500 bg-blue-100 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            disabled={isLoading}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 重复任务信息显示（编辑模式） */}
          {isEditing && task && task.is_recurring && (
            <div className="space-y-2 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 font-medium">
                🔄 重复任务
              </div>
              {task.recurrence_rule && (
                <div className="text-sm text-purple-600">
                  <div>频率: {task.recurrence_rule.frequency === 'daily' ? '每日' : 
                                task.recurrence_rule.frequency === 'weekly' ? '每周' :
                                task.recurrence_rule.frequency === 'monthly' ? '每月' : '每年'}</div>
                  {task.recurrence_rule.interval > 1 && (
                    <div>间隔: 每 {task.recurrence_rule.interval} 次</div>
                  )}
                  {task.recurrence_rule.days_of_week && task.recurrence_rule.days_of_week.length > 0 && (
                    <div>星期: {task.recurrence_rule.days_of_week.map(day => 
                      ['日', '一', '二', '三', '四', '五', '六'][day]
                    ).join(', ')}</div>
                  )}
                  {task.recurrence_rule.end_date && (
                    <div>结束日期: {new Date(task.recurrence_rule.end_date).toLocaleDateString()}</div>
                  )}
                  {task.recurrence_rule.count && (
                    <div>重复次数: {task.recurrence_rule.count} 次</div>
                  )}
                </div>
              )}
              {task.parent_task_id && (
                <div className="text-xs text-purple-500">
                  这是重复任务的一个实例
                </div>
              )}
            </div>
          )}

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