import { isVoucherBalanced } from '../../features/vouchers/voucherRules'
import type { VoucherEntry } from '../../services/types'

type VoucherSaveGuardInput = {
  canSave: boolean
  hasCompany: boolean
  hasPeriod: boolean
  entries: VoucherEntry[]
}

export function getVoucherSaveBlockMessage(input: VoucherSaveGuardInput) {
  if (!input.canSave) {
    return null
  }

  if (!input.hasCompany || !input.hasPeriod) {
    return '请先选择账套和会计期间。'
  }

  if (!isVoucherBalanced(input.entries)) {
    return '凭证明细借贷不平衡，无法保存。'
  }

  return null
}
