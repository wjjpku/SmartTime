import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Mail, ArrowLeft, Key } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('请输入您的邮箱地址')
      return
    }

    if (!isValidEmail(email)) {
      toast.error('请输入有效的邮箱地址')
      return
    }

    setLoading(true)
    
    try {
      const { error } = await resetPassword(email)
      
      if (error) {
        if (error.message.includes('User not found')) {
          toast.error('该邮箱未注册')
        } else {
          toast.error(error.message || '发送重置邮件失败，请重试')
        }
      } else {
        setEmailSent(true)
        toast.success('重置密码邮件已发送，请检查您的邮箱')
      }
    } catch (err) {
      toast.error('发送重置邮件过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleResendEmail = async () => {
    if (!email) return
    
    setLoading(true)
    try {
      const { error } = await resetPassword(email)
      if (!error) {
        toast.success('重置密码邮件已重新发送')
      } else {
        toast.error('重新发送失败，请重试')
      }
    } catch (err) {
      toast.error('重新发送过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mx-auto h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">邮件已发送</h2>
            <p className="text-gray-600 mb-6">
              我们已向 <span className="font-medium text-gray-900">{email}</span> 发送了密码重置邮件。
              请检查您的邮箱并点击邮件中的链接来重置密码。
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleResendEmail}
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '重新发送中...' : '重新发送邮件'}
              </button>
              
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
              >
                返回登录
              </Link>
            </div>
            
            <p className="text-xs text-gray-500 mt-6">
              没有收到邮件？请检查垃圾邮件文件夹，或者重新发送邮件。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 头部 */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">忘记密码</h2>
            <p className="text-gray-600 mt-2">输入您的邮箱地址，我们将发送重置密码的链接</p>
          </div>

          {/* 重置密码表单 */}
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="请输入您注册时使用的邮箱"
                  required
                />
              </div>
            </div>

            {/* 发送重置邮件按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '发送中...' : '发送重置邮件'}
            </button>
          </form>

          {/* 返回登录 */}
          <div className="mt-6">
            <Link
              to="/login"
              className="flex items-center justify-center text-sm text-purple-600 hover:text-purple-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回登录页面
            </Link>
          </div>

          {/* 帮助信息 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">需要帮助？</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• 请确保输入的是您注册时使用的邮箱地址</li>
              <li>• 重置邮件可能需要几分钟才能到达</li>
              <li>• 请检查垃圾邮件文件夹</li>
              <li>• 如果仍有问题，请联系客服支持</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}