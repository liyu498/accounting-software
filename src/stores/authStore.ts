import { create } from 'zustand'
import { invoke, isTauri } from '../lib/tauri'

const DEV_USER: User = {
  id: 'dev-user-001',
  username: 'admin',
  realName: '开发测试用户',
  role: 'admin',
  roleId: null,
}

interface User {
  id: string
  username: string
  realName: string
  role: string
  roleId: string | null
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
  register: (username: string, password: string, realName: string) => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !isTauri,
  user: !isTauri ? DEV_USER : null,
  token: !isTauri ? 'dev-browser-token' : localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null })

    if (!isTauri) {
      localStorage.setItem('auth_token', 'dev-browser-token')
      set({
        isAuthenticated: true,
        token: 'dev-browser-token',
        user: { ...DEV_USER, username },
        isLoading: false,
      })
      return true
    }

    try {
      const result = await invoke<{
        success: boolean
        token: string | null
        user: { id: string; username: string; real_name: string; role: string; role_id: string | null } | null
        error: string | null
      }>('login', { request: { username, password } })

      if (result.success && result.token && result.user) {
        localStorage.setItem('auth_token', result.token)
        set({
          isAuthenticated: true,
          token: result.token,
          user: {
            id: result.user.id,
            username: result.user.username,
            realName: result.user.real_name,
            role: result.user.role,
            roleId: result.user.role_id,
          },
          isLoading: false,
        })
        return true
      }

      set({
        isLoading: false,
        error: result.error || '登录失败',
      })
      return false
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    invoke('logout').catch(() => {})
    set({ isAuthenticated: false, user: null, token: null })
  },

  checkAuth: async () => {
    if (!isTauri) {
      set({ isAuthenticated: true, user: DEV_USER, token: 'dev-browser-token' })
      return
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null })
      return
    }

    try {
      const result = await invoke<{
        is_authenticated: boolean
        user: { id: string; username: string; real_name: string; role: string; role_id: string | null } | null
      }>('check', { token })

      if (result.is_authenticated && result.user) {
        set({
          isAuthenticated: true,
          token,
          user: {
            id: result.user.id,
            username: result.user.username,
            realName: result.user.real_name,
            role: result.user.role,
            roleId: result.user.role_id,
          },
        })
      } else {
        localStorage.removeItem('auth_token')
        set({ isAuthenticated: false, user: null, token: null })
      }
    } catch {
      localStorage.removeItem('auth_token')
      set({ isAuthenticated: false, user: null, token: null })
    }
  },

  register: async (username, password, realName) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('register', {
        input: { username, password, real_name: realName },
      })
      set({ isLoading: false })
      return true
    } catch (error) {
      set({ isLoading: false, error: String(error) })
      return false
    }
  },
}))
