import type { VoucherEntry, VoucherStatus } from '../../services/types'
import { normalizeAmount } from '../../services/accountingMath'

export function getVoucherTotals(entries: VoucherEntry[]) {
  return entries.reduce(
    (acc, entry) => ({
      debitTotal: acc.debitTotal + Number(entry.debit || 0),
      creditTotal: acc.creditTotal + Number(entry.credit || 0),
    }),
    { debitTotal: 0, creditTotal: 0 },
  )
}

export function isVoucherBalanced(entries: VoucherEntry[]) {
  const { debitTotal, creditTotal } = getVoucherTotals(entries)
  return normalizeAmount(debitTotal) > 0 && normalizeAmount(debitTotal) === normalizeAmount(creditTotal)
}

export function isVoucherEditable(status: VoucherStatus) {
  return status === 'draft'
}
