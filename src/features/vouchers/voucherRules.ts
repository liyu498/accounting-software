import type { VoucherEntry } from '../../services/types'

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
  return debitTotal > 0 && Math.abs(debitTotal - creditTotal) < 0.005
}
