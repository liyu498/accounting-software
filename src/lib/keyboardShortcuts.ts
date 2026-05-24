import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  handler: () => void
  description: string
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

      for (const s of shortcuts) {
        const ctrlMatch = s.ctrlKey === undefined ? !e.ctrlKey : s.ctrlKey === e.ctrlKey
        const shiftMatch = s.shiftKey === undefined ? !e.shiftKey : s.shiftKey === e.shiftKey

        if (e.key === s.key && ctrlMatch && shiftMatch) {
          // Always allow in inputs: Escape, F12, Ctrl+key combos
          if (isInput && s.key !== 'Escape' && s.key !== 'F12' && !s.ctrlKey) {
            // Allow = (auto balance) only when not in a text input
            if (s.key === '=') {
              const inputType = (target as HTMLInputElement).type
              if (inputType === 'text' || inputType === 'password' || target.tagName === 'TEXTAREA') {
                continue
              }
            }
            // Allow Space (toggle direction) only in number inputs (amount fields)
            if (s.key === ' ') {
              const inputType = (target as HTMLInputElement).type
              if (inputType !== 'number') {
                continue
              }
            }
            // Block other single-key shortcuts when in text inputs
            if (s.key !== '=' && s.key !== ' ') {
              continue
            }
          }
          if (s.preventDefault !== false) {
            e.preventDefault()
          }
          s.handler()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}
