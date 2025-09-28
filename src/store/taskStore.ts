import { create } from 'zustand'
import axios from 'axios'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { executeWithConcurrencyControl } from '../utils/requestConcurrencyController'
import { measurePerformance, performanceMonitor } from '../utils/performanceMonitor'
import { withCache, apiCache } from '../utils/apiCache'

// 重复规则接口定义
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  days_of_week?: number[];
  day_of_month?: number;
  end_date?: string;
  count?: number;
}

// 工作信息接口定义
export interface WorkInfo {
  title: string;
  duration_hours: number;
  deadline?: string;
  preferences?: string[];
}

// 时间段接口定义
export interface TimeSlot {
  start: string;
  end: string;
  score: number;
  reason: string;
}

// 任务接口定义
export interface Task {
  id: string;
  title: string;
  start: string;
  end?: string;
  priority: 'low' | 'medium' | 'high';
  recurrence_rule?: RecurrenceRule;
  is_recurring: boolean;
  parent_task_id?: string;
  created_at: string;
  updated_at: string;
  description?: string;
  reminder_type?: string;
  is_important?: boolean;
  reminder_sent?: boolean;
  completed?: boolean;
}

export interface TaskCreate {
  title: string;
  start: string;
  end?: string;
  priority?: 'low' | 'medium' | 'high';
  recurrence_rule?: RecurrenceRule;
  is_recurring?: boolean;
  parent_task_id?: string;
}

export interface TaskUpdate {
  title?: string;
  start?: string;
  end?: string;
  priority?: 'low' | 'medium' | 'high';
  recurrence_rule?: RecurrenceRule;
  is_recurring?: boolean;
  parent_task_id?: string;
}

// 配置axios实例
const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 60000, // 增加到60秒超时
  headers: {
    'Content-Type': 'application/json',
  },
  // 添加更详细的配置
  validateStatus: (status) => status < 500, // 只有5xx错误才被认为是网络错误
  maxRedirects: 3,
  // 添加更多网络配置
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
})

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 1, // 进一步减少重试次数
  retryDelay: 1000, // 1秒重试延迟
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  exponentialBackoff: false // 禁用指数退避，使用固定延迟
}

// 重试函数
const retryRequest = async (requestFn: () => Promise<any>, retries = RETRY_CONFIG.maxRetries, attempt = 0): Promise<any> => {
  try {
    return await requestFn()
  } catch (error: any) {
    const isRetryable = retries > 0 && (
      RETRY_CONFIG.retryableStatuses.includes(error.response?.status) ||
      error.code === 'ECONNABORTED' || // 超时错误
      error.code === 'ECONNRESET' ||   // 连接重置
      error.code === 'ENOTFOUND'       // DNS解析失败
    )
    
    if (isRetryable) {
      const delay = RETRY_CONFIG.exponentialBackoff 
        ? RETRY_CONFIG.retryDelay * Math.pow(2, attempt)
        : RETRY_CONFIG.retryDelay
      
      console.log(`[RETRY] 请求失败 (${error.response?.status || error.code}): ${error.message}，${delay}ms后重试，剩余重试次数: ${retries}`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return retryRequest(requestFn, retries - 1, attempt + 1)
    }
    
    // 记录详细错误信息
    console.error('[API ERROR] 请求失败:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      }
    })
    throw error
  }
}

// 请求拦截器：添加认证token
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('[AUTH ERROR] 获取session失败:', error)
        throw new Error('认证失败，请重新登录')
      }
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
        console.log('[AUTH SUCCESS] 已添加认证头')
      } else {
        console.warn('[AUTH WARNING] 未找到有效的access_token，用户可能未登录')
        throw new Error('用户未登录，请先登录')
      }
      
      return config
    } catch (error: any) {
      console.error('[AUTH ERROR] 请求拦截器错误:', error)
      // 如果是认证相关错误，重定向到登录页
      if (error.message.includes('登录') || error.message.includes('认证')) {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  },
  (error) => {
    console.error('[REQUEST ERROR] 请求配置错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器：处理认证错误
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // 处理401未授权错误
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      console.log('[AUTH DEBUG] 收到401错误，尝试刷新token')
      
      try {
        // 尝试刷新session
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError || !session?.access_token) {
          console.error('[AUTH ERROR] Session刷新失败，重定向到登录页:', refreshError)
          // 清除本地存储的认证信息
          await supabase.auth.signOut()
          window.location.href = '/login'
          return Promise.reject(error)
        }
        
        console.log('[AUTH DEBUG] Token刷新成功，重试请求')
        // 更新请求头并重试
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        console.error('[AUTH ERROR] 刷新认证失败:', refreshError)
        await supabase.auth.signOut()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    
    // 如果不是401错误或已经重试过，直接返回错误
    console.error('[API ERROR] 请求失败:', error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// 加载状态类型
interface LoadingStates {
  fetching: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  parsing: boolean;
  analyzing: boolean;
  confirming: boolean;
  batchOperating: boolean;
}

// 状态管理接口
interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  loadingStates: LoadingStates;
  error: string | null;
  
  // 操作方法
  fetchTasks: (forceRefresh?: boolean) => Promise<void>;
  createTask: (task: TaskCreate) => Promise<Task>;
  updateTask: (id: string, task: TaskUpdate) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  batchDeleteTasks: (type: 'day' | 'week' | 'month', date: Date) => Promise<{ success: boolean; deleted_count: number; message: string }>;
  batchCreateTasks: (tasks: TaskCreate[]) => Promise<Task[]>;
  batchUpdateTasks: (updates: { id: string; data: TaskUpdate }[]) => Promise<Task[]>;
  parseAndCreateTasks: (text: string) => Promise<Task[]>;
  analyzeSchedule: (description: string) => Promise<{ work_info: WorkInfo; recommendations: TimeSlot[] }>;
  confirmSchedule: (work_info: WorkInfo, selected_slot: TimeSlot) => Promise<Task>;
  clearError: () => void;
  setLoadingState: (operation: keyof LoadingStates, loading: boolean) => void;
}

// 创建状态管理store
export const taskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  loadingStates: {
    fetching: false,
    creating: false,
    updating: false,
    deleting: false,
    parsing: false,
    analyzing: false,
    confirming: false,
    batchOperating: false,
  },
  error: null,

  // 设置特定操作的加载状态
  setLoadingState: (operation: keyof LoadingStates, loading: boolean) => {
    set(state => ({
      loadingStates: {
        ...state.loadingStates,
        [operation]: loading
      },
      isLoading: loading || Object.values({
        ...state.loadingStates,
        [operation]: loading
      }).some(Boolean)
    }));
  },

  // 获取所有任务（重试机制 + 缓存 + 并发控制）
  fetchTasks: async (forceRefresh = false) => {
    const { setLoadingState } = get();
    setLoadingState('fetching', true);
    set({ error: null });
    
    try {
      // 如果强制刷新，清除缓存
      if (forceRefresh) {
        apiCache.delete('/api/tasks');
      }
      
      const response = await executeWithConcurrencyControl(
        () => measurePerformance(
          'fetch_tasks',
          () => withCache(
            '/api/tasks',
            () => retryRequest(() => api.get('/api/tasks')),
            undefined,
            2 * 60 * 1000 // 2分钟缓存
          ),
          'api'
        ),
        'high' // 获取任务设为高优先级
      );
      
      set({ tasks: response.data.tasks });
    } catch (error: any) {
      let errorMessage = '获取任务失败';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = '请求超时，请检查网络连接';
      } else if (error.response?.status === 401) {
        errorMessage = '认证失败，请重新登录';
      } else if (error.response?.status === 403) {
        errorMessage = '权限不足，无法访问任务数据';
      } else if (error.response?.status >= 500) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = `网络错误: ${error.message}`;
      }
      
      console.error('[FETCH_TASKS_ERROR]', {
        message: errorMessage,
        originalError: error,
        timestamp: new Date().toISOString()
      });
      
      set({ error: errorMessage });
      performanceMonitor.recordError(errorMessage, 'api');
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('fetching', false);
    }
  },

  // 创建任务（乐观更新 + 重试）
  createTask: async (taskData: TaskCreate) => {
    const { setLoadingState } = get();
    setLoadingState('creating', true);
    set({ error: null });
    
    // 在乐观更新之前先验证认证状态
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session?.access_token) {
        const errorMessage = '用户未登录或认证已过期，请重新登录';
        set({ error: errorMessage });
        toast.error(errorMessage);
        setLoadingState('creating', false);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || '认证验证失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      setLoadingState('creating', false);
      throw error;
    }
    
    // 生成临时ID用于乐观更新
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticTask: Task = {
      id: tempId,
      title: taskData.title,
      start: taskData.start,
      end: taskData.end,
      priority: taskData.priority || 'medium',
      recurrence_rule: taskData.recurrence_rule,
      is_recurring: taskData.is_recurring || false,
      parent_task_id: taskData.parent_task_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed: false
    };
    
    // 乐观更新：立即添加到UI（只有在认证验证通过后）
    set(state => ({
      tasks: [...state.tasks, optimisticTask]
    }));
    
    try {
      const response = await retryRequest(() => api.post('/api/tasks', taskData));
      const newTask = response.data.task;
      
      // 替换临时任务为真实任务
      set(state => ({
        tasks: state.tasks.map(task => 
          task.id === tempId ? newTask : task
        )
      }));
      
      toast.success('任务创建成功');
      return newTask;
    } catch (error: any) {
      // 回滚乐观更新
      set(state => ({
        tasks: state.tasks.filter(task => task.id !== tempId)
      }));
      
      let errorMessage = '创建任务失败';
      
      if (error.response?.status === 401) {
        errorMessage = '认证已过期，请重新登录';
      } else if (error.response?.status === 403) {
        errorMessage = '权限不足，无法创建任务';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('creating', false);
    }
  },

  // 更新任务（乐观更新 + 重试）
  updateTask: async (id: string, taskData: TaskUpdate) => {
    const { setLoadingState } = get();
    setLoadingState('updating', true);
    set({ error: null });
    
    // 保存原始任务用于回滚
    const originalTask = get().tasks.find(task => task.id === id);
    if (!originalTask) {
      throw new Error('任务不存在');
    }
    
    // 乐观更新：立即更新UI
    const optimisticTask = { ...originalTask, ...taskData, updated_at: new Date().toISOString() };
    set(state => ({
      tasks: state.tasks.map(task => 
        task.id === id ? optimisticTask : task
      )
    }));
    
    try {
      const response = await retryRequest(() => api.put(`/api/tasks/${id}`, taskData));
      const updatedTask = response.data.task;
      
      // 用服务器返回的真实数据替换乐观更新
      set(state => ({
        tasks: state.tasks.map(task => 
          task.id === id ? updatedTask : task
        )
      }));
      
      toast.success('任务更新成功');
      return updatedTask;
    } catch (error: any) {
      // 回滚乐观更新
      set(state => ({
        tasks: state.tasks.map(task => 
          task.id === id ? originalTask : task
        )
      }));
      
      const errorMessage = error.response?.data?.detail || '更新任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('updating', false);
    }
  },

  // 删除任务（乐观更新 + 重试）
  deleteTask: async (id: string) => {
    const { setLoadingState } = get();
    setLoadingState('deleting', true);
    set({ error: null });
    
    // 保存原始任务用于回滚
    const originalTask = get().tasks.find(task => task.id === id);
    if (!originalTask) {
      throw new Error('任务不存在');
    }
    
    // 乐观更新：立即从UI移除
    set(state => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
    
    try {
      await retryRequest(() => api.delete(`/api/tasks/${id}`));
      toast.success('任务删除成功');
    } catch (error: any) {
      // 回滚乐观更新：重新添加任务
      set(state => ({
        tasks: [...state.tasks, originalTask].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }));
      
      const errorMessage = error.response?.data?.detail || '删除任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('deleting', false);
    }
  },

  // 批量删除任务（重试机制）
  batchDeleteTasks: async (type: 'day' | 'week' | 'month', date: Date) => {
    const { setLoadingState } = get();
    setLoadingState('batchOperating', true);
    set({ error: null });
    try {
      const response = await retryRequest(() => 
        api.post(`/api/tasks/delete/${type}`, { date: date.toISOString() })
      );
      
      // 重新获取任务列表
      await get().fetchTasks();
      toast.success(`成功删除${response.data.deleted_count}个任务`);
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '批量删除任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('batchOperating', false);
    }
  },

  // 批量创建任务（重试机制）
  batchCreateTasks: async (tasks: TaskCreate[]) => {
    const { setLoadingState } = get();
    setLoadingState('batchOperating', true);
    set({ error: null });
    try {
      const response = await retryRequest(() => 
        api.post('/api/tasks/batch/create', { tasks })
      );
      const newTasks = response.data.tasks;
      
      set(state => ({
        tasks: [...state.tasks, ...newTasks]
      }));
      
      toast.success(`成功创建${newTasks.length}个任务`);
      return newTasks;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '批量创建任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('batchOperating', false);
    }
  },

  // 批量更新任务（重试机制）
  batchUpdateTasks: async (updates: { id: string; data: TaskUpdate }[]) => {
    const { setLoadingState } = get();
    setLoadingState('batchOperating', true);
    set({ error: null });
    try {
      const response = await retryRequest(() => 
        api.put('/api/tasks/batch/update', { updates })
      );
      const updatedTasks = response.data.tasks;
      
      set(state => ({
        tasks: state.tasks.map(task => {
          const updated = updatedTasks.find(ut => ut.id === task.id);
          return updated || task;
        })
      }));
      
      toast.success(`成功更新${updatedTasks.length}个任务`);
      return updatedTasks;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '批量更新任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('batchOperating', false);
    }
  },

  // 解析自然语言并创建任务（异步队列 + 重试）
  parseAndCreateTasks: async (text: string) => {
    const { setLoadingState } = get();
    setLoadingState('parsing', true);
    set({ error: null });
    try {
      // 使用并发控制器和性能监控提交异步任务
      const submitResponse = await executeWithConcurrencyControl(
        () => measurePerformance(
          'ai_parse_submit',
          () => retryRequest(() => api.post('/api/tasks/parse/async', { text: text })),
          'ai',
          { description_length: text.length }
        ),
        'high' // AI解析任务设为高优先级
      );
      const taskId = submitResponse.data.task_id;
      
      // 轮询检查任务状态
      let attempts = 0;
      const maxAttempts = 60; // 最多等待60秒，与axios超时保持一致
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        
        try {
          const statusResponse = await api.get(`/api/tasks/async/${taskId}/status`);
          const { status, result, error } = statusResponse.data;
          
          if (status === 'completed') {
            // 刷新任务列表以获取新创建的任务
            await get().fetchTasks();
            toast.success('任务解析完成');
            return result?.tasks || [];
          } else if (status === 'failed') {
            throw new Error(error || '任务解析失败');
          }
          // 如果状态是 'pending' 或 'running'，继续轮询
        } catch (statusError: any) {
          console.error('检查任务状态失败:', statusError);
        }
        
        attempts++;
      }
      
      throw new Error('任务解析超时，请稍后重试');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || '解析任务失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('parsing', false);
    }
  },

  // 分析智能日程安排（重试机制）
  analyzeSchedule: async (description: string) => {
    const { setLoadingState } = get();
    setLoadingState('analyzing', true);
    set({ error: null });
    try {
      console.log('[FRONTEND DEBUG] 开始智能日程分析，描述:', description);
      const response = await executeWithConcurrencyControl(
        () => measurePerformance(
          'ai_schedule_analyze',
          () => retryRequest(() => api.post('/api/schedule/analyze', { description })),
          'ai',
          { description_length: description.length }
        ),
        'medium' // 日程分析设为中等优先级
      );
      
      console.log('[FRONTEND DEBUG] 智能日程分析响应:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[FRONTEND DEBUG] 智能日程分析错误:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || '分析日程失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('analyzing', false);
    }
  },

  // 确认并创建日程（重试机制）
  confirmSchedule: async (work_info: WorkInfo, selected_slot: TimeSlot) => {
    const { setLoadingState } = get();
    setLoadingState('confirming', true);
    set({ error: null });
    try {
      const response = await executeWithConcurrencyControl(
        () => measurePerformance(
          'ai_schedule_confirm',
          () => retryRequest(() => api.post('/api/schedule/confirm', { work_info, selected_slot })),
          'ai',
          { work_info_length: JSON.stringify(work_info).length }
        ),
        'high' // 日程确认设为高优先级
      );
      
      // 重新获取任务列表
      await get().fetchTasks();
      toast.success('日程确认成功');
      
      return response.data.task;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '确认日程失败';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoadingState('confirming', false);
    }
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },
}));

// 导出类型
export type { TaskStore };