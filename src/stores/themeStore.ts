import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'app-theme-mode'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemTheme()
  return mode
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

const savedMode = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as ThemeMode | null
const initialMode: ThemeMode = savedMode === 'system' || savedMode === 'light' || savedMode === 'dark' ? savedMode : 'system'
const initialResolved = resolveTheme(initialMode)
applyTheme(initialResolved)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  resolvedTheme: initialResolved,

  setMode: (mode) => {
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode)
    }
    set({ mode, resolvedTheme: resolved })
  },
}))

// Listen for system theme changes when mode is 'system'
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState()
    if (state.mode === 'system') {
      const resolved = getSystemTheme()
      applyTheme(resolved)
      useThemeStore.setState({ resolvedTheme: resolved })
    }
  })
}
