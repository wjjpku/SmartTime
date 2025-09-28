import { create } from 'zustand'
import axios from 'axios'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

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
  headers: {
    'Content-Type': 'application/json',
  },
})

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

// 状态管理接口
interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  fetchTasks: () => Promise<void>;
  createTask: (task: TaskCreate) => Promise<Task>;
  updateTask: (id: string, task: TaskUpdate) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  batchDeleteTasks: (type: 'day' | 'week' | 'month', date: Date) => Promise<{ success: boolean; deleted_count: number; message: string }>;
  parseAndCreateTasks: (text: string) => Promise<Task[]>;
  analyzeSchedule: (description: string) => Promise<{ work_info: WorkInfo; recommendations: TimeSlot[] }>;
  confirmSchedule: (work_info: WorkInfo, selected_slot: TimeSlot) => Promise<Task>;
  clearError: () => void;
}

// 创建状态管理store
export const taskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  // 获取所有任务
  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/api/tasks');
      set({ tasks: response.data.tasks, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '获取任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 创建任务
  createTask: async (taskData: TaskCreate) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/tasks', taskData);
      const newTask = response.data.task;
      
      set(state => ({
        tasks: [...state.tasks, newTask],
        isLoading: false
      }));
      
      return newTask;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '创建任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 更新任务
  updateTask: async (id: string, taskData: TaskUpdate) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(`/api/tasks/${id}`, taskData);
      const updatedTask = response.data.task;
      
      set(state => ({
        tasks: state.tasks.map(task => 
          task.id === id ? updatedTask : task
        ),
        isLoading: false
      }));
      
      return updatedTask;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '更新任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 删除任务
  deleteTask: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/tasks/${id}`);
      
      set(state => ({
        tasks: state.tasks.filter(task => task.id !== id),
        isLoading: false
      }));
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '删除任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 批量删除任务
  batchDeleteTasks: async (type: 'day' | 'week' | 'month', date: Date) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/api/tasks/delete/${type}`, { 
        date: date.toISOString() 
      });
      
      // 重新获取任务列表
      await get().fetchTasks();
      
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '批量删除任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 解析自然语言并创建任务
  parseAndCreateTasks: async (text: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/schedule/parse', { text });
      
      set({ isLoading: false });
      // 确保返回的是任务数组
      const tasks = response.data?.tasks || [];
      return Array.isArray(tasks) ? tasks : [];
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '解析任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 分析智能日程安排
  analyzeSchedule: async (description: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[FRONTEND DEBUG] 开始智能日程分析，描述:', description);
      const response = await api.post('/api/schedule/analyze', { description });
      
      console.log('[FRONTEND DEBUG] 智能日程分析响应:', response.data);
      set({ isLoading: false });
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
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  },

  // 确认并创建日程
  confirmSchedule: async (work_info: WorkInfo, selected_slot: TimeSlot) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/schedule/confirm', { work_info, selected_slot });
      
      // 重新获取任务列表
      await get().fetchTasks();
      
      set({ isLoading: false });
      return response.data.task;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '确认日程失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },
}));

// 导出类型
export type { TaskStore };