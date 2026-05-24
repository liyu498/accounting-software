import { useCallback } from 'react'
import { useVoucherFormStore } from '../../stores/voucherFormStore'
import { Input } from '../ui/Input'

function parseVoucherNumber(full: string): string {
  const match = full.match(/第(\d+)号/)
  return match ? match[1] : '001'
}

export function VoucherHeaderFields() {
  const {
    voucherDate,
    attachmentCount,
    voucherNumber,
    setHeaderField,
  } = useVoucherFormStore()

  const numericPart = parseVoucherNumber(voucherNumber)

  const handleNumberChange = useCallback(
    (numStr: string) => {
      setHeaderField('voucherNumber', `记字第${numStr.replace(/\D/g, '')}号`)
    },
    [setHeaderField],
  )

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          凭证日期 <span className="text-red-500">*</span>
        </label>
        <Input
          type="date"
          value={voucherDate}
          onChange={(e) => setHeaderField('voucherDate', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          凭证字号 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-0">
          <span className="h-10 flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-sm font-medium text-gray-700">
            记
          </span>
          <span className="h-10 flex items-center px-1 border-y border-gray-300 bg-gray-50 text-sm text-gray-500">
            字第
          </span>
          <input
            type="text"
            value={numericPart}
            onChange={(e) => handleNumberChange(e.target.value)}
            className="h-10 w-20 px-2 border-y border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="001"
          />
          <span className="h-10 flex items-center px-2 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-sm text-gray-500">
            号
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">附单据</label>
        <Input
          type="number"
          value={attachmentCount || ''}
          onChange={(e) => setHeaderField('attachmentCount', parseInt(e.target.value) || 0)}
          placeholder="0"
        />
      </div>
    </div>
  )
}
