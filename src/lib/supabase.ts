import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // 禁用URL中的会话检测
  }
})

// 类型定义
export interface User {
  id: string
  email?: string
  username?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

export interface AuthError {
  message: string
  status?: number
}

export interface AuthResponse {
  user: User | null
  error: AuthError | null
}