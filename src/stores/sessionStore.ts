import { create } from 'zustand'
import { accountingApi } from '../services/accountingApi'
import type { LoginInput, Session } from '../services/types'

type SessionState = {
  session: Session | null
  login: (input: LoginInput) => Promise<Session>
  logout: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  async login(input) {
    const { session } = await accountingApi.login(input)
    set({ session })
    return session
  },
  logout() {
    set({ session: null })
  },
}))
