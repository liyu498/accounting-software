import type { Invoice } from '../stores/invoiceStore'
import type { Voucher, VoucherEntry } from '../stores/voucherStore'

export type LiveModuleStatus = '待处理' | '已匹配' | '已生成凭证' | '待确认' | '异常' | '启用' | '停用' | '已通过'

export interface LiveModuleRow {
  id: string
  status: LiveModuleStatus
  voucher: string
  attachment: string
  values: Record<string, string>
}

export interface LiveSummaryItem {
  label: string
  value: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'gray'
}

function currency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

function invoiceStatus(invoice: Invoice): LiveModuleStatus {
  if (invoice.voucher_id) return '已生成凭证'
  if (invoice.status === 'matched' || invoice.status === 'confirmed') return '已匹配'
  if (invoice.status === 'error' || invoice.status === 'void' || invoice.status === 'rejected') return '异常'
  if (invoice.status === 'pending' || invoice.status === 'draft') return '待确认'
  return '待处理'
}

function invoiceAttachment(invoice: Invoice) {
  return invoice.invoice_code ? `发票代码 ${invoice.invoice_code}` : '待关联影像'
}

export function mapLiveInvoiceRows(invoices: Invoice[], invoiceType: 'output' | 'input'): LiveModuleRow[] {
  return invoices
    .filter((invoice) => invoice.invoice_type === invoiceType)
    .map((invoice) => {
      const status = invoiceStatus(invoice)
      const commonValues = {
        source: '本地账套',
        date: invoice.invoice_date,
        number: invoice.invoice_no,
        goods: invoice.remarks || '待补充商品/服务信息',
        amount: currency(invoice.amount),
        taxRate: invoice.tax_rate === null ? '待核' : `${invoice.tax_rate}%`,
        tax: currency(invoice.tax_amount),
      }

      if (invoiceType === 'output') {
        return {
          id: invoice.id,
          status,
          voucher: invoice.voucher_id || '未生成',
          attachment: invoiceAttachment(invoice),
          values: {
            ...commonValues,
            buyer: invoice.buyer_name || '待匹配购方',
            total: currency(invoice.total_amount),
          },
        }
      }

      const selectionStatus = invoice.status === 'confirmed' || invoice.status === 'matched'
        ? '已认证'
        : status === '异常'
          ? '阻断'
          : '待认证'
      return {
        id: invoice.id,
        status,
        voucher: invoice.voucher_id || '未生成',
        attachment: invoiceAttachment(invoice),
        values: {
          ...commonValues,
          seller: invoice.seller_name || '待匹配销方',
          deduction: selectionStatus === '已认证' ? '增值税抵扣' : '待勾选',
          selectionStatus,
        },
      }
    })
}

export function summarizeLiveInvoices(invoices: Invoice[], invoiceType: 'output' | 'input'): LiveSummaryItem[] {
  const scoped = invoices.filter((invoice) => invoice.invoice_type === invoiceType)
  const totalAmount = scoped.reduce((sum, invoice) => sum + invoice.amount, 0)
  const totalTax = scoped.reduce((sum, invoice) => sum + invoice.tax_amount, 0)
  const exceptions = scoped.filter((invoice) => invoiceStatus(invoice) === '异常').length

  if (invoiceType === 'output') {
    return [
      { label: '发票张数', value: `${scoped.length} 张`, tone: 'blue' },
      { label: '不含税金额', value: currency(totalAmount), tone: 'green' },
      { label: '销项税额', value: currency(totalTax), tone: 'amber' },
      { label: '异常发票', value: `${exceptions} 张`, tone: 'red' },
    ]
  }

  const pendingSelection = scoped.filter((invoice) => invoice.status === 'pending' || invoice.status === 'draft').length
  return [
    { label: '发票张数', value: `${scoped.length} 张`, tone: 'blue' },
    { label: '可抵扣税额', value: currency(totalTax), tone: 'green' },
    { label: '待勾选', value: `${pendingSelection} 张`, tone: 'amber' },
    { label: '异常发票', value: `${exceptions} 张`, tone: 'red' },
  ]
}

function entryAccount(entries: VoucherEntry[], direction: 'debit' | 'credit') {
  const names = entries
    .filter((entry) => entry.direction === direction)
    .map((entry) => entry.account_name || entry.account_code)
  return names.length > 0 ? names.join(' / ') : '-'
}

function voucherStatus(voucher: Voucher): LiveModuleStatus {
  if (voucher.status === 'approved' || voucher.status === 'posted') return '已通过'
  if (voucher.status === 'error' || voucher.total_debit !== voucher.total_credit) return '异常'
  if (voucher.status === 'draft') return '待确认'
  return '待处理'
}

export function mapLiveVoucherRows(vouchers: Voucher[]): LiveModuleRow[] {
  return vouchers.map((voucher) => ({
    id: voucher.id,
    status: voucherStatus(voucher),
    voucher: voucher.voucher_number,
    attachment: voucher.attachment_count > 0 ? `附件 ${voucher.attachment_count}` : '无附件',
    values: {
      date: voucher.voucher_date,
      wordNo: voucher.voucher_number,
      summary: voucher.summary || voucher.entries[0]?.summary || '待补充摘要',
      debitAccount: entryAccount(voucher.entries, 'debit'),
      creditAccount: entryAccount(voucher.entries, 'credit'),
      debit: currency(voucher.total_debit),
      credit: currency(voucher.total_credit),
      source: voucher.is_system ? '系统结转' : '本地账套',
      maker: voucher.created_by || '系统',
      auditor: voucher.approved_by || '未审',
    },
  }))
}

export function summarizeLiveVouchers(vouchers: Voucher[]): LiveSummaryItem[] {
  const approved = vouchers.filter((voucher) => voucher.status === 'approved' || voucher.status === 'posted').length
  const abnormal = vouchers.filter((voucher) => voucher.status === 'error' || voucher.total_debit !== voucher.total_credit).length
  return [
    { label: '本期凭证', value: `${vouchers.length} 张`, tone: 'blue' },
    { label: '已审核', value: `${approved} 张`, tone: 'green' },
    { label: '待审核', value: `${Math.max(vouchers.length - approved - abnormal, 0)} 张`, tone: 'amber' },
    { label: '断号/异常', value: `${abnormal} 张`, tone: 'red' },
  ]
}
