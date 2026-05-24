import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVoucherStore, Voucher } from '../stores/voucherStore'
import { useCompanyStore } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { useInvoiceStore, Invoice } from '../stores/invoiceStore'
import { VoucherToolbar } from '../components/voucher/VoucherToolbar'
import { cn, formatCurrency } from '../lib/utils'
import { Printer, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

function formatPeriodLabel(period: { period_year: number; period_month: number } | undefined): string {
  if (!period) return ''
  return `${period.period_year}年${String(period.period_month).padStart(2, '0')}月`
}

export function VoucherDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getVoucher } = useVoucherStore()
  const { selectedCompanyId } = useCompanyStore()
  const { periods, fetchPeriods } = usePeriodStore()
  const { getInvoicesByVoucher } = useInvoiceStore()
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [relatedVoucher, setRelatedVoucher] = useState<Voucher | null>(null)
  const [linkedInvoices, setLinkedInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      navigate('/vouchers')
      return
    }
    let cancelled = false
    const load = async () => {
      const v = await getVoucher(id, selectedCompanyId || '')
      if (cancelled) return
      if (!v) {
        navigate('/vouchers')
        return
      }
      setVoucher(v)

      // Fetch related voucher for red-ink references
      const relatedId = v.is_system === 1 ? v.reversal_of_id : v.status === 'reversed' ? v.reversed_by : null
      if (relatedId) {
        const related = await getVoucher(relatedId, selectedCompanyId || '')
        if (!cancelled) setRelatedVoucher(related)
      }

      // Fetch linked invoices
      if (selectedCompanyId) {
        const invoices = await getInvoicesByVoucher(id, selectedCompanyId)
        if (!cancelled) setLinkedInvoices(invoices)
      }

      // Ensure periods are loaded for period label
      if (v.company_id) {
        const { periods: currentPeriods } = usePeriodStore.getState()
        if (currentPeriods.length === 0) {
          await fetchPeriods(v.company_id)
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id, getVoucher, navigate, fetchPeriods])

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    approved: '已审核',
    reversed: '已冲销',
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    reversed: 'bg-red-100 text-red-800',
  }

  if (loading || !voucher) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const isReversalVoucher = voucher.is_system === 1 && Boolean(voucher.reversal_of_id)
  const isReversedOriginal = voucher.status === 'reversed'

  const relatedPeriod = relatedVoucher
    ? periods.find((p) => p.id === relatedVoucher.period_id)
    : undefined

  const handlePrint = () => {
    const periodLabel = formatPeriodLabel(periods.find((p) => p.id === voucher.period_id))
    const entryRows = voucher.entries.map((e) => `
      <tr>
        <td>${e.summary || ''}</td>
        <td>${e.account_code} ${e.account_name}</td>
        <td class="amt">${e.direction === 'debit' ? formatCurrency(e.amount) : ''}</td>
        <td class="amt">${e.direction === 'credit' ? formatCurrency(e.amount) : ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${voucher.voucher_number}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'SimSun', 'Microsoft YaHei', serif; font-size: 12px; color: #000; }
  h2 { text-align: center; font-size: 16px; margin: 0 0 10px; letter-spacing: 6px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
  th { background: #f5f5f5; font-weight: normal; }
  .amt { text-align: right; font-family: 'Courier New', monospace; }
  .total td { font-weight: bold; }
  .footer { display: flex; justify-content: space-between; margin-top: 12px; font-size: 11px; }
</style></head><body>
<h2>记 账 凭 证</h2>
<div class="header">
  <span>${periodLabel}</span>
  <span>${voucher.voucher_number}</span>
  <span>日期: ${voucher.voucher_date}</span>
  <span>附单据 ${voucher.attachment_count} 张</span>
</div>
<table>
<thead><tr><th style="width:30%">摘要</th><th style="width:30%">科目</th><th style="width:18%">借方金额</th><th style="width:18%">贷方金额</th></tr></thead>
<tbody>
${entryRows}
<tr class="total"><td colspan="2">合计</td><td class="amt">${formatCurrency(voucher.total_debit)}</td><td class="amt">${formatCurrency(voucher.total_credit)}</td></tr>
</tbody></table>
<div class="footer">
  <span>制单: ${voucher.created_by || ''}</span>
  <span>审核: ${voucher.approved_by || ''}</span>
  <span>记账:</span>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const w = window.open('', '_blank', 'width=800,height=600')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <VoucherToolbar title="凭证详情" />
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          打印凭证
        </Button>
      </div>

      {/* Header info */}
      <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <span className="text-sm text-gray-500">凭证字号</span>
          <p className={cn('text-sm font-medium', isReversalVoucher ? 'text-red-600' : 'text-gray-900')}>
            {voucher.voucher_number}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500">凭证日期</span>
          <p className="text-sm font-medium text-gray-900">{voucher.voucher_date}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500">附单据</span>
          <p className="text-sm font-medium text-gray-900">{voucher.attachment_count} 张</p>
        </div>
        <div>
          <span className="text-sm text-gray-500">状态</span>
          <p>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              isReversalVoucher ? 'bg-red-100 text-red-800' : statusColors[voucher.status],
            )}>
              {isReversalVoucher ? '红冲凭证' : statusLabels[voucher.status] || voucher.status}
            </span>
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500">摘要</span>
          <p className="text-sm text-gray-900 truncate">{voucher.summary || '-'}</p>
        </div>
      </div>

      {/* Red-ink relationship banner */}
      {isReversalVoucher && relatedVoucher && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <span className="text-red-600 font-medium text-sm">← 红冲凭证</span>
          <span className="text-red-500 text-sm">
            原凭证: {formatPeriodLabel(relatedPeriod)} {relatedVoucher.voucher_number}
          </span>
        </div>
      )}
      {isReversedOriginal && relatedVoucher && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <span className="text-red-600 font-medium text-sm">已红冲</span>
          <span className="text-red-500 text-sm">
            红冲凭证: {formatPeriodLabel(relatedPeriod)} {relatedVoucher.voucher_number}
          </span>
        </div>
      )}
      {isReversedOriginal && !relatedVoucher && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <span className="text-red-600 font-medium text-sm">已红冲</span>
        </div>
      )}

      {/* Entry table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">行号</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">科目</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">借方金额</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">贷方金额</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">辅助核算</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">数量/币别</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {voucher.entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-400">{entry.line_num}</td>
                <td className="px-4 py-2 text-sm">
                  <span className="font-mono text-gray-500 mr-1">{entry.account_code}</span>
                  <span>{entry.account_name}</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{entry.summary || '-'}</td>
                <td className={cn(
                  'px-4 py-2 text-sm text-right font-mono',
                  isReversalVoucher && entry.direction === 'debit' ? 'text-red-600' : 'text-gray-900',
                )}>
                  {entry.direction === 'debit'
                    ? (isReversalVoucher ? '-' : '') + formatCurrency(entry.amount)
                    : '-'}
                </td>
                <td className={cn(
                  'px-4 py-2 text-sm text-right font-mono',
                  isReversalVoucher && entry.direction === 'credit' ? 'text-red-600' : 'text-gray-900',
                )}>
                  {entry.direction === 'credit'
                    ? (isReversalVoucher ? '-' : '') + formatCurrency(entry.amount)
                    : '-'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-400">
                  {entry.auxiliary_type || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-400">
                  {entry.quantity
                    ? `${entry.quantity}${entry.unit ? ' ' + entry.unit : ''} × ${entry.unit_price ?? ''}`
                    : entry.currency_id
                      ? `${entry.currency_id} @ ${entry.exchange_rate ?? ''}`
                      : '-'}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-medium">
              <td className="px-4 py-2 text-sm" colSpan={5}>
                合计
              </td>
              <td className={cn(
                'px-4 py-2 text-sm text-right font-mono',
                isReversalVoucher ? 'text-red-600' : 'text-gray-900',
              )}>
                {(isReversalVoucher ? '-' : '') + formatCurrency(voucher.total_debit)}
              </td>
              <td className={cn(
                'px-4 py-2 text-sm text-right font-mono',
                isReversalVoucher ? 'text-red-600' : 'text-gray-900',
              )}>
                {(isReversalVoucher ? '-' : '') + formatCurrency(voucher.total_credit)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Linked invoices */}
      {linkedInvoices.length > 0 && (
        <div className="border border-gray-200 rounded-lg">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-800">关联发票 ({linkedInvoices.length})</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">发票号</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">类型</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">税额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linkedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <Link to={`/invoices/${inv.invoice_type === 'input' ? 'input' : 'output'}`} className="text-primary-600 hover:text-primary-800 font-mono font-medium">
                      {inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{inv.invoice_date}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {inv.invoice_type === 'input' ? '进项' : '销项'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono">{formatCurrency(inv.tax_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit info */}
      <div className="text-xs text-gray-400 space-y-1">
        {voucher.created_by && (
          <div>制单人: {voucher.created_by} · 创建时间: {voucher.created_at}</div>
        )}
        {voucher.approved_by && (
          <div>审核人: {voucher.approved_by} · 审核时间: {voucher.approved_at}</div>
        )}
        {voucher.modified_by && (
          <div>修改人: {voucher.modified_by} · 修改时间: {voucher.modified_at}</div>
        )}
      </div>
    </div>
  )
}
