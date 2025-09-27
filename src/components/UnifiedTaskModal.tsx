import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Clock, Flag, Repeat, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { taskStore, Task, TaskCreate, TaskUpdate, RecurrenceRule } from '../store/taskStore';
// import ReminderSettings from './ReminderSettings'; // 已禁用提醒功能
import { useNotification } from './NotificationManager';

interface UnifiedTaskModalProps {
  mode: 'create' | 'edit' | 'delete';
  task?: Partial<Task> | null;
  onClose: () => void;
  onSave: () => void;
}

export default function UnifiedTaskModal({ mode, task, onClose, onSave }: UnifiedTaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    start: '',
    end: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    is_recurring: false,
    reminder_type: 'none',
    is_important: false,
    recurrence_rule: {
      frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: 1,
      days_of_week: [] as number[],
      end_date: null as string | null,
      count: null as number | null
    }
  });
  
  const [deleteText, setDeleteText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { createTask, updateTask, deleteTask } = taskStore();
  const { showSuccess, showError, showInfo } = useNotification();
  
  const isEditing = mode === 'edit' && task && 'id' in task && task.id;
  const isDeleting = mode === 'delete';
  const isCreating = mode === 'create';

  useEffect(() => {
    if (task && (mode === 'edit' || mode === 'create')) {
      setFormData({
        title: task.title || '',
        start: task.start ? formatDateTimeLocal(new Date(task.start)) : '',
        end: task.end ? formatDateTimeLocal(new Date(task.end)) : '',
        priority: task.priority || 'medium',
        is_recurring: task.is_recurring || false,
        reminder_type: (task as any).reminder_type || 'none',
        is_important: (task as any).is_important || false,
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
  }, [task, mode]);

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
    
    if (isDeleting) {
      await handleDeleteSubmit();
      return;
    }
    
    if (!formData.title.trim()) {
      showError('请输入任务标题');
      return;
    }
    
    if (!formData.start) {
      showError('请选择开始时间');
      return;
    }

    setIsLoading(true);
    
    try {
      const taskData: any = {
        title: formData.title.trim(),
        start: new Date(formData.start).toISOString(),
        end: formData.end ? new Date(formData.end).toISOString() : undefined,
        priority: formData.priority,
        is_recurring: formData.is_recurring,
        reminder_type: formData.reminder_type,
        is_important: formData.is_important
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
        showSuccess('任务更新成功！');
      } else {
        await createTask(taskData as TaskCreate);
        showSuccess('任务创建成功！');
      }
      
      onSave();
    } catch (error) {
      showError(isEditing ? '更新任务失败' : '创建任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteText.trim()) {
      showError('请输入要删除的任务描述');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: deleteText
        }),
      });
      
      if (!response.ok) {
        throw new Error('删除任务失败');
      }
      
      const result = await response.json();
      setDeleteText('');
      
      if (result.deleted_count > 0) {
        showSuccess(`成功删除了 ${result.deleted_count} 个任务！`);
      } else {
        showInfo('没有找到匹配的任务');
      }
      
      onSave();
    } catch (error) {
      showError('删除任务失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectDelete = () => {
    if (!isEditing || !task?.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDirectDelete = async () => {
    if (!isEditing || !task?.id) return;
    
    setIsLoading(true);
    setShowDeleteConfirm(false);
    
    try {
      await deleteTask(task.id);
      showSuccess('任务删除成功！');
      onSave();
    } catch (error) {
      showError('删除任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDirectDelete = () => {
    setShowDeleteConfirm(false);
  };

  const priorityOptions = [
    { value: 'low', label: '低优先级', color: 'text-green-600', bgColor: 'bg-green-100' },
    { value: 'medium', label: '中优先级', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    { value: 'high', label: '高优先级', color: 'text-red-600', bgColor: 'bg-red-100' }
  ];

  const getModalTitle = () => {
    switch (mode) {
      case 'create': return '创建任务';
      case 'edit': return '编辑任务';
      case 'delete': return '删除任务';
      default: return '任务管理';
    }
  };

  const getModalIcon = () => {
    switch (mode) {
      case 'create': return <Plus className="text-blue-600" size={24} />;
      case 'edit': return <Calendar className="text-blue-600" size={24} />;
      case 'delete': return <Trash2 className="text-red-600" size={24} />;
      default: return <Calendar className="text-blue-600" size={24} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            {getModalIcon()}
            {getModalTitle()}
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
          {/* 删除模式 */}
          {isDeleting && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm mb-2">
                  💡 使用自然语言描述要删除的任务，AI 将智能匹配并删除相关任务。
                </p>
                <p className="text-red-600 text-xs">
                  例如："删除明天的会议"、"取消所有写报告的任务"、"删除不重要的任务"
                </p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="deleteInput" className="block text-sm font-medium text-red-700">
                  删除描述 *
                </label>
                <div className="relative">
                  <textarea
                    id="deleteInput"
                    value={deleteText}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 100) {
                        setDeleteText(value);
                      }
                    }}
                    placeholder="例如：删除明天的会议，取消所有写报告的任务，删除不重要的任务..."
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent resize-none ${
                      deleteText.length >= 90 ? 'border-orange-300 focus:ring-orange-500' : 
                      deleteText.length === 100 ? 'border-red-300 focus:ring-red-500' : 
                      'border-red-200 focus:ring-red-500'
                    }`}
                    rows={4}
                    disabled={isLoading}
                    maxLength={100}
                    required
                  />
                  <div className={`absolute bottom-2 right-2 text-xs ${
                    deleteText.length >= 90 ? 'text-orange-600' : 
                    deleteText.length === 100 ? 'text-red-600' : 
                    'text-gray-400'
                  }`}>
                    {deleteText.length}/100
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 创建/编辑模式 */}
          {!isDeleting && (
            <>
              {/* 任务标题 */}
              <div className="space-y-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  任务标题 *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 100) {
                        setFormData({ ...formData, title: value });
                      }
                    }}
                    placeholder="输入任务标题"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                      formData.title.length >= 90 ? 'border-orange-300 focus:ring-orange-500' : 
                      formData.title.length === 100 ? 'border-red-300 focus:ring-red-500' : 
                      'border-gray-300 focus:ring-blue-500'
                    }`}
                    disabled={isLoading}
                    maxLength={100}
                    required
                  />
                  <div className={`absolute -bottom-5 right-0 text-xs ${
                    formData.title.length >= 90 ? 'text-orange-600' : 
                    formData.title.length === 100 ? 'text-red-600' : 
                    'text-gray-400'
                  }`}>
                    {formData.title.length}/100
                  </div>
                </div>
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

              {/* 提醒设置 - 已禁用 */}
              {/* <ReminderSettings
                reminderType={formData.reminder_type}
                isImportant={formData.is_important}
                onReminderTypeChange={(type) => setFormData({ ...formData, reminder_type: type })}
                onImportantChange={(important) => setFormData({ ...formData, is_important: important })}
                disabled={isLoading}
              /> */}

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
            </>
          )}

          {/* 按钮组 */}
          <div className="flex justify-between pt-4">
            {isEditing && !isDeleting && (
              <button
                type="button"
                onClick={handleDirectDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                删除
              </button>
            )}
            
            <div className={`flex gap-3 ${(!isEditing || isDeleting) ? 'ml-auto' : ''}`}>
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
                disabled={isLoading || (isDeleting && !deleteText.trim()) || (!isDeleting && !formData.title.trim())}
                className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
                  isDeleting ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : isDeleting ? (
                  <Trash2 size={16} />
                ) : (
                  <Save size={16} />
                )}
                {isLoading ? 
                  (isDeleting ? '删除中...' : '保存中...') : 
                  (isDeleting ? 'AI 智能删除' : '保存')
                }
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-red-600" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                <p className="text-sm text-gray-600">此操作无法撤销</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              确定要删除任务 <span className="font-medium text-gray-900">"{task?.title}"</span> 吗？
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelDirectDelete}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDirectDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                {isLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}