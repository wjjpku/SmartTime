import { create } from 'zustand';
import axios from 'axios';

// 任务接口定义
export interface Task {
  id: string;
  title: string;
  start: string;
  end?: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  start: string;
  end?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface TaskUpdate {
  title?: string;
  start?: string;
  end?: string;
  priority?: 'low' | 'medium' | 'high';
}

// API 基础配置
const API_BASE_URL = 'http://localhost:8000/api';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  parseAndCreateTasks: (text: string) => Promise<Task[]>;
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
      const response = await api.get('/tasks');
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
      const response = await api.post('/tasks', taskData);
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
      const response = await api.put(`/tasks/${id}`, taskData);
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
      await api.delete(`/tasks/${id}`);
      
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

  // 解析自然语言并创建任务
  parseAndCreateTasks: async (text: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/tasks/parse', { text });
      
      if (response.data.success) {
        const newTasks = response.data.tasks;
        
        set(state => ({
          tasks: [...state.tasks, ...newTasks],
          isLoading: false
        }));
        
        return newTasks;
      } else {
        throw new Error(response.data.error || '解析任务失败');
      }
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || error.message || '解析任务失败', 
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