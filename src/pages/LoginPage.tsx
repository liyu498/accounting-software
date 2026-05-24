import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import { useAuthStore } from '../stores/authStore'
import { Lock, User } from 'lucide-react'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const { login, isAuthenticated } = useAuthStore()

  // Check if running in Tauri webview
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

  // In browser dev mode, auto-login and redirect
  useEffect(() => {
    if (!isTauri && !isAuthenticated) {
      login('admin', 'admin123').then((ok) => {
        if (ok) navigate('/', { replace: true })
      })
    }
  }, [isTauri, isAuthenticated, login, navigate])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setIsLoading(true)
    try {
      const success = await login(username, password)
      if (success) {
        navigate('/', { replace: true })
      } else {
        const currentError = useAuthStore.getState().error
        setError(currentError || '用户名或密码错误')
      }
    } catch (err) {
      setError('登录失败: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl font-bold text-primary-600">账</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">会计软件</h1>
          <p className="text-primary-100">智能记账，轻松管理</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
              用户登录
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full"
              >
                登录
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>演示账号: admin / admin123</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-primary-200 text-sm mt-6">
          © 2024 会计软件. 保留所有权利.
        </p>
      </div>
    </div>
  )
}