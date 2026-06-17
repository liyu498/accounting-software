import { isVoucherEditable } from '../../features/vouchers/voucherRules'
import type { VoucherDetail } from '../../services/types'

type EditorModeStateInput = {
  routeVoucherId?: string
  loading: boolean
  voucher: Pick<VoucherDetail, 'id' | 'status' | 'voucherNumber'> | null
  loadErrorMessage: string | null
}

export type EditorModeState =
  | { mode: 'create'; canSave: true }
  | { mode: 'loading'; canSave: false }
  | { mode: 'edit'; canSave: true }
  | {
      mode: 'load-error'
      canSave: false
      resultStatus: 'error'
      title: string
      subTitle: string
    }
  | {
      mode: 'not-found'
      canSave: false
      resultStatus: '404'
      title: string
      subTitle: string
    }
  | {
      mode: 'locked'
      canSave: false
      resultStatus: 'warning'
      title: string
      subTitle: string
    }

export function getEditorModeState(input: EditorModeStateInput): EditorModeState {
  if (!input.routeVoucherId) {
    return { mode: 'create', canSave: true }
  }

  if (input.loading) {
    return { mode: 'loading', canSave: false }
  }

  if (input.loadErrorMessage) {
    return {
      mode: 'load-error',
      canSave: false,
      resultStatus: 'error',
      title: '凭证加载失败',
      subTitle: input.loadErrorMessage,
    }
  }

  if (!input.voucher) {
    return {
      mode: 'not-found',
      canSave: false,
      resultStatus: '404',
      title: '未找到凭证',
      subTitle: `无法找到编号为 ${input.routeVoucherId} 的凭证，请返回列表后重试。`,
    }
  }

  if (!isVoucherEditable(input.voucher.status)) {
    return {
      mode: 'locked',
      canSave: false,
      resultStatus: 'warning',
      title: '当前凭证不可编辑',
      subTitle: '只有草稿状态的凭证可以编辑，请返回详情页查看或继续处理。',
    }
  }

  return { mode: 'edit', canSave: true }
}
