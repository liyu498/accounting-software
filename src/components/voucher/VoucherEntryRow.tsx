import { useRef, useCallback, useEffect, useState } from 'react'
import { Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { invoke } from '../../lib/tauri'
import { useVoucherFormStore, VoucherFormEntry } from '../../stores/voucherFormStore'
import { useAuxiliaryStore, AuxiliaryItem } from '../../stores/auxiliaryStore'
import { useCompanyStore } from '../../stores/companyStore'
import { AccountSelector } from './AccountSelector'
import { cn } from '../../lib/utils'

interface VoucherEntryRowProps {
  index: number
  entry: VoucherFormEntry
  isActive: boolean
  onKeyDown: (e: React.KeyboardEvent, index: number) => void
}

export function VoucherEntryRow({ index, entry, isActive, onKeyDown }: VoucherEntryRowProps) {
  const { updateEntry, selectAccount, removeEntry, toggleDirection, setActiveEntry } =
    useVoucherFormStore()
  const { fetchAccountSetup, fetchItems } = useAuxiliaryStore()
  const debitRef = useRef<HTMLInputElement>(null)
  const creditRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [accountAuxCategories, setAccountAuxCategories] = useState<
    { link_id: string; category_id: string; category_name: string; category_code: string; is_required: number }[]
  >([])
  const [auxItems, setAuxItems] = useState<Record<string, AuxiliaryItem[]>>({})
  const [currencies, setCurrencies] = useState<{ id: string; code: string; name: string; exchange_rate: number; is_base: number }[]>([])
  const { selectedCompanyId } = useCompanyStore()

  useEffect(() => {
    if (!selectedCompanyId) return
    let cancelled = false
    invoke('get_currencies', { companyId: selectedCompanyId }).then((data) => {
      if (!cancelled) setCurrencies(data as typeof currencies)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [selectedCompanyId])

  // When account changes, fetch its auxiliary setup
  useEffect(() => {
    if (!entry.accountCode) {
      setAccountAuxCategories([])
      return
    }
    let cancelled = false
    if (!selectedCompanyId) return
    fetchAccountSetup(entry.accountCode, selectedCompanyId).then((setup) => {
      if (cancelled || !setup) return
      setAccountAuxCategories(setup.categories)
      // Fetch items for each category and cache locally
      Promise.all(
        setup.categories.map(async (cat) => {
          await fetchItems(cat.category_id)
          const items = useAuxiliaryStore.getState().items.filter((i) => i.category_id === cat.category_id)
          if (!cancelled) {
            setAuxItems((prev) => ({ ...prev, [cat.category_id]: items }))
          }
        }),
      )
    })
    return () => { cancelled = true }
  }, [entry.accountCode, fetchAccountSetup, fetchItems])

  const handleFocus = useCallback(() => {
    setActiveEntry(index)
  }, [index, setActiveEntry])

  const handleAccountChange = useCallback(
    (v: { code: string; name: string }) => {
      selectAccount(index, v.code, v.name)
    },
    [index, selectAccount],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      toggleDirection(index)
      return
    }
    onKeyDown(e, index)
  }

  const accountValue = { code: entry.accountCode, name: entry.accountName }

  return (
    <>
      <tr
        className={cn(
          'transition-colors',
          isActive && 'bg-blue-50/50',
          !isActive && 'hover:bg-gray-50',
        )}
      >
        {/* 行号 */}
        <td className="px-2 py-1 text-center text-xs text-gray-400 font-mono w-10">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-gray-400 hover:text-gray-600"
            title={expanded ? '折叠' : '展开'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <span className="ml-0.5">{index + 1}</span>
        </td>

        {/* 摘要 */}
        <td className="px-1 py-1">
          <input
            type="text"
            value={entry.summary}
            onChange={(e) => updateEntry(index, 'summary', e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="摘要"
            className="w-full h-9 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </td>

        {/* 科目代码 */}
        <td className="px-1 py-1" style={{ width: '13rem' }}>
          <AccountSelector
            value={accountValue}
            onChange={handleAccountChange}
          />
        </td>

        {/* 借方金额 */}
        <td className="px-1 py-1" style={{ width: '8.5rem' }}>
          <input
            ref={debitRef}
            type="number"
            step="0.01"
            value={entry.direction === 'debit' ? (entry.amount || '') : ''}
            onChange={(e) => {
              updateEntry(index, 'direction', 'debit')
              updateEntry(index, 'amount', parseFloat(e.target.value) || 0)
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className="w-full h-9 px-2 border border-gray-300 rounded text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </td>

        {/* 贷方金额 */}
        <td className="px-1 py-1" style={{ width: '8.5rem' }}>
          <input
            ref={creditRef}
            type="number"
            step="0.01"
            value={entry.direction === 'credit' ? (entry.amount || '') : ''}
            onChange={(e) => {
              updateEntry(index, 'direction', 'credit')
              updateEntry(index, 'amount', parseFloat(e.target.value) || 0)
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className="w-full h-9 px-2 border border-gray-300 rounded text-right text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </td>

        {/* 操作 */}
        <td className="px-1 py-1 text-center w-10">
          <button
            type="button"
            onClick={() => removeEntry(index)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="删除此行 (Ctrl+D)"
          >
            <Minus className="w-4 h-4" />
          </button>
        </td>
      </tr>

      {/* Expanded: auxiliary + quantity row */}
      {expanded && (
        <tr className="bg-gray-50/70 border-b border-gray-100">
          <td colSpan={6} className="px-4 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Doc number */}
              <div className="flex items-center gap-1">
                <label className="text-gray-400 whitespace-nowrap">单据号</label>
                <input
                  type="text"
                  value={entry.docNumber || ''}
                  onChange={(e) => updateEntry(index, 'docNumber', e.target.value || null)}
                  placeholder="单号"
                  className="w-24 h-7 px-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Quantity fields */}
              <div className="flex items-center gap-1">
                <label className="text-gray-400 whitespace-nowrap">数量</label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.quantity ?? ''}
                  onChange={(e) => updateEntry(index, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0"
                  className="w-20 h-7 px-2 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-400 whitespace-nowrap">单价</label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.unitPrice ?? ''}
                  onChange={(e) => updateEntry(index, 'unitPrice', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  className="w-20 h-7 px-2 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-400 whitespace-nowrap">单位</label>
                <input
                  type="text"
                  value={entry.unit || ''}
                  onChange={(e) => updateEntry(index, 'unit', e.target.value || null)}
                  placeholder="个"
                  className="w-16 h-7 px-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Currency & Exchange Rate */}
              {currencies.length > 0 && (
                <>
                  <div className="w-px h-5 bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <label className="text-gray-400 whitespace-nowrap">币别</label>
                    <select
                      value={entry.currencyId || ''}
                      onChange={(e) => {
                        const curId = e.target.value
                        const cur = currencies.find((c) => c.id === curId)
                        updateEntry(index, 'currencyId', curId || null)
                        updateEntry(index, 'exchangeRate', cur ? cur.exchange_rate : null)
                      }}
                      title="币别"
                      className="h-7 px-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      <option value="">本位币</option>
                      {currencies.filter((c) => !c.is_base).map((c) => (
                        <option key={c.id} value={c.id}>{c.code} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  {entry.currencyId && (
                    <div className="flex items-center gap-1">
                      <label className="text-gray-400 whitespace-nowrap">汇率</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={entry.exchangeRate ?? ''}
                        onChange={(e) => updateEntry(index, 'exchangeRate', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="1.0000"
                        className="w-20 h-7 px-2 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Auxiliary accounting selectors */}
              {accountAuxCategories.length > 0 && (
                <>
                  <div className="w-px h-5 bg-gray-300" />
                  {accountAuxCategories.map((cat) => {
                    const items = auxItems[cat.category_id] || []
                    return (
                      <div key={cat.link_id} className="flex items-center gap-1">
                        <label className="text-gray-400 whitespace-nowrap">
                          {cat.category_name}
                          {cat.is_required ? <span className="text-red-400">*</span> : null}
                        </label>
                        <select
                          value={entry.auxiliaryId || ''}
                          onChange={(e) => {
                            const itemId = e.target.value
                            const item = items.find((it) => it.id === itemId)
                            updateEntry(index, 'auxiliaryType', cat.category_id)
                            updateEntry(index, 'auxiliaryId', itemId || null)
                            updateEntry(index, 'auxiliaryName', item?.name || null)
                          }}
                          title={cat.category_name}
                          className="h-7 px-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          <option value="">-- 选择 --</option>
                          {items.filter((it) => it.is_enabled === 1).map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.code} {it.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
