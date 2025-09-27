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
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[FRONTEND DEBUG] 获取到的session:', session)
    if (session?.access_token) {
      console.log('[FRONTEND DEBUG] 添加Authorization header:', `Bearer ${session.access_token.substring(0, 20)}...`)
      config.headers.Authorization = `Bearer ${session.access_token}`
    } else {
      console.log('[FRONTEND DEBUG] 没有找到access_token')
    }
    return config
  },
  (error) => {
    console.log('[FRONTEND DEBUG] 请求拦截器错误:', error)
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
      const response = await api.delete('/api/tasks/batch', { 
        data: { type, date: date.toISOString() } 
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
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '解析任务失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 分析智能日程安排
  analyzeSchedule: async (text: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/schedule/analyze', { text });
      
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || '分析日程失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  // 确认并创建日程
  confirmSchedule: async (tasks: any[]) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/schedule/confirm', { tasks });
      
      // 重新获取任务列表
      await get().fetchTasks();
      
      set({ isLoading: false });
      return response.data;
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