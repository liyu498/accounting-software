import { Plus, Trash2 } from 'lucide-react'
import type { InvoiceLine, InvoiceLineInput } from '../../lib/api'

export type InvoiceLineDraft = {
  itemName: string
  specification: string
  unit: string
  quantity: string
  unitPrice: string
  amount: string
  taxRate: string
  taxAmount: string
  taxClassificationCode: string
}

export function emptyInvoiceLineDraft(taxRate = '13'): InvoiceLineDraft {
  return {
    itemName: '',
    specification: '',
    unit: '',
    quantity: '',
    unitPrice: '',
    amount: '',
    taxRate,
    taxAmount: '',
    taxClassificationCode: '',
  }
}

export function invoiceLineDraftFromRecord(line: InvoiceLine): InvoiceLineDraft {
  return {
    itemName: line.itemName,
    specification: line.specification || '',
    unit: line.unit || '',
    quantity: line.quantity == null ? '' : String(line.quantity),
    unitPrice: line.unitPrice == null ? '' : String(line.unitPrice),
    amount: String(line.amount),
    taxRate: line.taxRate == null ? '' : String(line.taxRate * 100),
    taxAmount: String(line.taxAmount),
    taxClassificationCode: line.taxClassificationCode || '',
  }
}

export function fallbackInvoiceLineDraft(invoice: {
  amount: number
  taxAmount: number
  taxRate: number | null
  remarks: string | null
}): InvoiceLineDraft {
  return {
    ...emptyInvoiceLineDraft(String((invoice.taxRate || 0) * 100)),
    itemName: invoice.remarks?.trim() || '未拆分货物或服务明细',
    amount: String(invoice.amount),
    taxAmount: String(invoice.taxAmount),
  }
}

export function parseInvoiceLineDrafts(drafts: InvoiceLineDraft[]): {
  lines?: InvoiceLineInput[]
  error?: string
  amount: number
  taxAmount: number
} {
  const lines: InvoiceLineInput[] = []
  let amount = 0
  let taxAmount = 0
  if (drafts.length === 0) return { error: '至少需要一条货物或服务明细。', amount, taxAmount }

  for (const [index, draft] of drafts.entries()) {
    const rowAmount = Number(draft.amount)
    const rowTaxAmount = Number(draft.taxAmount || 0)
    const rowTaxRate = Number(draft.taxRate || 0)
    const quantity = draft.quantity.trim() ? Number(draft.quantity) : undefined
    const unitPrice = draft.unitPrice.trim() ? Number(draft.unitPrice) : undefined
    if (!draft.itemName.trim()) return { error: `第 ${index + 1} 行货物或服务名称不能为空。`, amount, taxAmount }
    if (!Number.isFinite(rowAmount) || rowAmount <= 0) return { error: `第 ${index + 1} 行不含税金额必须大于 0。`, amount, taxAmount }
    if (!Number.isFinite(rowTaxAmount) || rowTaxAmount < 0) return { error: `第 ${index + 1} 行税额不能为负数。`, amount, taxAmount }
    if (!Number.isFinite(rowTaxRate) || rowTaxRate < 0 || rowTaxRate > 100) return { error: `第 ${index + 1} 行税率必须在 0 到 100% 之间。`, amount, taxAmount }
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) return { error: `第 ${index + 1} 行数量必须大于 0。`, amount, taxAmount }
    if (unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice < 0)) return { error: `第 ${index + 1} 行单价不能为负数。`, amount, taxAmount }
    amount += rowAmount
    taxAmount += rowTaxAmount
    lines.push({
      itemName: draft.itemName.trim(),
      specification: draft.specification.trim() || undefined,
      unit: draft.unit.trim() || undefined,
      quantity,
      unitPrice,
      amount: rowAmount,
      taxRate: rowTaxRate / 100,
      taxAmount: rowTaxAmount,
      taxClassificationCode: draft.taxClassificationCode.trim() || undefined,
    })
  }
  return { lines, amount, taxAmount }
}

function Field({ label, value, onChange, type = 'text', min, step, className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; step?: string; className?: string }) {
  return <label className={`grid min-w-0 gap-1 text-xs text-slate-600 dark:text-slate-300 ${className}`}><span>{label}</span><input type={type} min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 min-w-0 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500" /></label>
}

export function InvoiceLineEditor({ drafts, onChange, headerAmount, headerTaxAmount, disabled = false }: { drafts: InvoiceLineDraft[]; onChange: (drafts: InvoiceLineDraft[]) => void; headerAmount: string; headerTaxAmount: string; disabled?: boolean }) {
  const parsed = parseInvoiceLineDrafts(drafts)
  const headerAmountNumber = Number(headerAmount || 0)
  const headerTaxNumber = Number(headerTaxAmount || 0)
  const reconciled = !parsed.error
    && Math.round(parsed.amount * 100) === Math.round(headerAmountNumber * 100)
    && Math.round(parsed.taxAmount * 100) === Math.round(headerTaxNumber * 100)
  const update = (index: number, patch: Partial<InvoiceLineDraft>) => onChange(drafts.map((draft, rowIndex) => rowIndex === index ? { ...draft, ...patch } : draft))

  return <section className="border-t border-slate-200 dark:border-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div><h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">货物或服务明细</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">行金额与税额必须分别核对至发票表头。</p></div>
      <button type="button" disabled={disabled} onClick={() => onChange([...drafts, emptyInvoiceLineDraft(drafts[0]?.taxRate || '13')])} className="inline-flex h-8 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300"><Plus className="h-3.5 w-3.5" />新增行</button>
    </header>
    <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {drafts.map((draft, index) => <div key={index} className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label={`第 ${index + 1} 行 · 名称 *`} value={draft.itemName} onChange={(value) => update(index, { itemName: value })} className="lg:col-span-2" />
        <Field label="规格型号" value={draft.specification} onChange={(value) => update(index, { specification: value })} />
        <Field label="单位" value={draft.unit} onChange={(value) => update(index, { unit: value })} />
        <Field label="数量" type="number" min="0" step="0.000001" value={draft.quantity} onChange={(value) => update(index, { quantity: value })} />
        <Field label="单价" type="number" min="0" step="0.000001" value={draft.unitPrice} onChange={(value) => update(index, { unitPrice: value })} />
        <Field label="不含税金额 *" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(value) => update(index, { amount: value })} />
        <Field label="税率（%）" type="number" min="0" step="0.01" value={draft.taxRate} onChange={(value) => update(index, { taxRate: value })} />
        <Field label="税额" type="number" min="0" step="0.01" value={draft.taxAmount} onChange={(value) => update(index, { taxAmount: value })} />
        <Field label="税收分类编码" value={draft.taxClassificationCode} onChange={(value) => update(index, { taxClassificationCode: value })} className="lg:col-span-2" />
        <div className="flex items-end justify-end"><button type="button" disabled={disabled || drafts.length === 1} onClick={() => onChange(drafts.filter((_, rowIndex) => rowIndex !== index))} title="删除明细行" aria-label={`删除第 ${index + 1} 行`} className="inline-flex h-8 w-8 items-center justify-center border border-rose-300 text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div>
      </div>)}
    </div>
    <div className={`flex flex-wrap justify-end gap-x-5 gap-y-1 px-4 py-2 text-xs ${reconciled ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
      <span>明细金额 {parsed.amount.toFixed(2)} / 表头 {Number.isFinite(headerAmountNumber) ? headerAmountNumber.toFixed(2) : '0.00'}</span>
      <span>明细税额 {parsed.taxAmount.toFixed(2)} / 表头 {Number.isFinite(headerTaxNumber) ? headerTaxNumber.toFixed(2) : '0.00'}</span>
      <span>{reconciled ? '核对一致' : '待核对'}</span>
    </div>
  </section>
}
