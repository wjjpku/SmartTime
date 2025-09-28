import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('请填写所有必填字段')
      return
    }

    if (!isValidEmail(email)) {
      toast.error('请输入有效的邮箱地址')
      return
    }

    setLoading(true)
    
    // 检查网络连接
    const isConnected = await checkNetworkConnection()
    if (!isConnected) {
      toast.error('网络连接不可用，请检查网络设置后重试')
      setLoading(false)
      return
    }
    
    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        console.log('登录错误详情:', error)
        
        // 网络相关错误
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('Network request failed') ||
            error.message.includes('fetch') ||
            error.message.includes('NetworkError') ||
            !navigator.onLine) {
          toast.error('网络连接失败，请检查网络设置后重试')
        }
        // Supabase认证错误
        else if (error.message.includes('Invalid login credentials')) {
          toast.error('邮箱或密码错误')
        } 
        else if (error.message.includes('Email not confirmed')) {
          toast.error('请先验证您的邮箱')
        }
        // 服务器错误
        else if (error.message.includes('Internal server error') || error.message.includes('500')) {
          toast.error('服务器暂时不可用，请稍后重试')
        }
        // 其他错误
        else {
          toast.error(`登录失败: ${error.message || '未知错误，请重试'}`)
        }
      } else {
        toast.success('登录成功！')
        navigate('/dashboard')
      }
    } catch (err) {
      console.error('登录异常:', err)
      
      // 更详细的异常处理
      if (err instanceof TypeError && err.message.includes('fetch')) {
        toast.error('网络连接失败，请检查网络设置')
      } else if (err instanceof Error) {
        toast.error(`登录过程中发生错误: ${err.message}`)
      } else {
        toast.error('登录过程中发生未知错误，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const checkNetworkConnection = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false
    }
    
    try {
      // 直接检查后端API是否可访问（使用完整URL避免代理问题）
      const response = await fetch('http://localhost:8000/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      // 如果后端不可用，尝试检查外网连接
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors',
          signal: AbortSignal.timeout(3000)
        })
        return true // 如果能访问外网，说明网络正常
      } catch {
        return false
      }
    }
  }

  const handleGuestMode = () => {
    toast.info('游客模式功能即将推出')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 头部 */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <User className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">欢迎回来</h2>
            <p className="text-gray-600 mt-2">登录您的智能任务管理账户</p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 邮箱输入 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="请输入您的邮箱"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="请输入您的密码"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* 记住我和忘记密码 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  记住我
                </label>
              </div>
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                忘记密码？
              </Link>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            {/* 游客模式 */}
            <button
              type="button"
              onClick={handleGuestMode}
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              游客模式体验
            </button>
          </form>

          {/* 注册链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              还没有账户？{' '}
              <Link
                to="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}