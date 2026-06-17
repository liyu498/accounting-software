import type { AccountingApi } from '../types'

export const tauriAdapter: AccountingApi = new Proxy({} as AccountingApi, {
  get() {
    return async () => {
      throw new Error('Tauri adapter is not connected yet')
    }
  },
})
