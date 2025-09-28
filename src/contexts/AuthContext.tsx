import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'

interface User {
  id: string
  email: string | undefined
  username?: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取初始会话
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('获取初始会话失败:', error)
        setSession(null)
        setUser(null)
      } else {
        setSession(session)
        setUser(session?.user ? {
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username,
          avatar_url: session.user.user_metadata?.avatar_url
        } : null)
      }
      setLoading(false)
    })

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('认证状态变化:', event, session?.user?.id)
      
      setSession(session)
      setUser(session?.user ? {
        id: session.user.id,
        email: session.user.email,
        username: session.user.user_metadata?.username,
        avatar_url: session.user.user_metadata?.avatar_url
      } : null)
      setLoading(false)
      
      // 处理特定的认证事件
      if (event === 'SIGNED_OUT') {
        console.log('用户已登出，清除本地状态')
        setSession(null)
        setUser(null)
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token已刷新')
      } else if (event === 'SIGNED_IN') {
        console.log('用户已登录')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, username: string) => {
    // 注意：这里只创建用户账户，不发送Supabase的确认邮件
    // 邮箱验证通过我们自定义的验证码系统处理
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
        emailRedirectTo: undefined, // 禁用邮件重定向
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const refreshUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      
      if (user) {
        const updatedUser = {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username,
          avatar_url: user.user_metadata?.avatar_url
        }
        setUser(updatedUser)
        console.log('用户信息已刷新:', updatedUser)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error)
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}