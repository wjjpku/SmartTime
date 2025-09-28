import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js'

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
    try {
      console.log('开始登录流程:', { email, timestamp: new Date().toISOString() })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('登录失败:', {
          error: error.message,
          code: error.status,
          email,
          timestamp: new Date().toISOString()
        })
        return { error }
      }

      console.log('登录成功:', {
        userId: data.user?.id,
        email: data.user?.email,
        emailVerified: data.user?.email_confirmed_at,
        timestamp: new Date().toISOString()
      })

      setUser(data.user ? {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username,
        avatar_url: data.user.user_metadata?.avatar_url
      } : null)
      setSession(data.session)
      return { data, error: null }
    } catch (error) {
      console.error('登录过程中发生异常:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        email,
        timestamp: new Date().toISOString()
      })
      return { error: error as AuthError }
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    try {
      console.log('开始注册流程:', { email, username, timestamp: new Date().toISOString() })
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (error) {
        console.error('注册失败:', {
          error: error.message,
          code: error.status,
          email,
          username,
          timestamp: new Date().toISOString()
        })
        
        // 为特定的邮箱验证错误提供更友好的提示
        if (error.message.includes('Email address') && error.message.includes('is invalid')) {
          const enhancedError = {
            ...error,
            message: '邮箱地址格式不符合要求。请确保邮箱地址以字母开头，格式为：用户名@域名.com'
          }
          return { error: enhancedError }
        }
        
        return { error }
      }

      console.log('注册API调用成功:', {
        userId: data.user?.id,
        email: data.user?.email,
        hasSession: !!data.session,
        emailConfirmed: data.user?.email_confirmed_at,
        timestamp: new Date().toISOString()
      })

      // 如果注册成功但需要邮箱确认，自动确认邮箱
      if (data.user && !data.session) {
        console.log('用户注册成功但需要邮箱确认，尝试自动确认...', {
          userId: data.user.id,
          timestamp: new Date().toISOString()
        })
        
        try {
          // 调用后端API自动确认邮箱
          const response = await fetch('/api/auth/confirm-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: data.user.id }),
          })

          const responseData = await response.json()
          console.log('邮箱确认API响应:', {
            status: response.status,
            ok: response.ok,
            data: responseData,
            timestamp: new Date().toISOString()
          })

          if (response.ok) {
            console.log('邮箱确认成功，尝试登录...', {
              email,
              timestamp: new Date().toISOString()
            })
            
            // 尝试登录
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            console.log('自动登录结果:', {
              success: !signInError,
              hasSession: !!signInData?.session,
              error: signInError?.message,
              timestamp: new Date().toISOString()
            })

            if (!signInError && signInData.session) {
              setUser(signInData.user ? {
                id: signInData.user.id,
                email: signInData.user.email,
                username: signInData.user.user_metadata?.username,
                avatar_url: signInData.user.user_metadata?.avatar_url
              } : null)
              setSession(signInData.session)
              return { data: signInData, error: null }
            }
          } else {
            console.error('邮箱确认API调用失败:', {
              status: response.status,
              data: responseData,
              timestamp: new Date().toISOString()
            })
          }
        } catch (confirmError) {
          console.error('自动确认邮箱过程中发生异常:', {
            error: confirmError instanceof Error ? confirmError.message : String(confirmError),
            stack: confirmError instanceof Error ? confirmError.stack : undefined,
            timestamp: new Date().toISOString()
          })
        }
      }

      setUser(data.user ? {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username,
        avatar_url: data.user.user_metadata?.avatar_url
      } : null)
      setSession(data.session)
      return { data, error: null }
    } catch (error) {
      console.error('注册过程中发生异常:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        email,
        username,
        timestamp: new Date().toISOString()
      })
      return { error: error as AuthError }
    }
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