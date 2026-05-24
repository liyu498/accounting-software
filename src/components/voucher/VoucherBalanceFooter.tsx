import { useVoucherFormStore } from '../../stores/voucherFormStore'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function VoucherBalanceFooter() {
  const { totalDebit, totalCredit, isBalanced, balanceDiff, entries } = useVoucherFormStore()
  const entryCount = entries.filter((e) => e.accountCode && e.amount > 0).length

  return (
    <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-gray-500">分录数: </span>
          <span className="font-medium text-gray-900">{entryCount}</span>
        </div>
        <div>
          <span className="text-gray-500">借方合计: </span>
          <span className="font-mono font-medium text-blue-600">{formatCurrency(totalDebit)}</span>
        </div>
        <div>
          <span className="text-gray-500">贷方合计: </span>
          <span className="font-mono font-medium text-red-600">{formatCurrency(totalCredit)}</span>
        </div>
        <div>
          {isBalanced ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              借贷平衡
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                balanceDiff > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500',
              )}
            >
              差额: {formatCurrency(balanceDiff)}
            </span>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-400">
        按 = 自动平衡
      </div>
    </div>
  )
}
