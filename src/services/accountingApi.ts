import { mockAdapter } from './adapters/mockAdapter'
import { tauriAdapter } from './adapters/tauriAdapter'

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

export const accountingApi = isTauri ? tauriAdapter : mockAdapter
