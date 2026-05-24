import { useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useVoucherFormStore } from '../../stores/voucherFormStore'
import { VoucherEntryRow } from './VoucherEntryRow'

export function VoucherEntryGrid() {
  const { entries, activeEntryIndex, addEntry, removeEntry, moveToNextRow } =
    useVoucherFormStore()

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        moveToNextRow()
      } else if (e.key === 'Tab' && !e.shiftKey) {
        const target = e.target as HTMLElement
        const row = target.closest('tr')
        if (row) {
          const cells = Array.from(row.querySelectorAll('input, button, select'))
          const lastCell = cells[cells.length - 1]
          if (target === lastCell || (cells.indexOf(target as HTMLInputElement) === cells.length - 1)) {
            e.preventDefault()
            moveToNextRow()
          }
        }
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        addEntry()
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        if (entries.length > 2) {
          removeEntry(index)
        }
      }
    },
    [addEntry, removeEntry, moveToNextRow, entries.length],
  )

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-10">行号</th>
            <th className="px-1 py-2 text-left text-xs font-medium text-gray-500 min-w-[120px]">摘要</th>
            <th className="px-1 py-2 text-left text-xs font-medium text-gray-500" style={{ width: '13rem' }}>科目编码</th>
            <th className="px-1 py-2 text-right text-xs font-medium text-gray-500" style={{ width: '8.5rem' }}>借方金额</th>
            <th className="px-1 py-2 text-right text-xs font-medium text-gray-500" style={{ width: '8.5rem' }}>贷方金额</th>
            <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 w-10">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, idx) => (
            <VoucherEntryRow
              key={idx}
              index={idx}
              entry={entry}
              isActive={idx === activeEntryIndex}
              onKeyDown={handleRowKeyDown}
            />
          ))}
        </tbody>
      </table>

      {/* Add Row Button */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加分录 (Ctrl+N)
        </button>
      </div>
    </div>
  )
}
