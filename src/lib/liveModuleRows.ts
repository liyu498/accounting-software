import type { Invoice } from '../stores/invoiceStore'
import type {
  BalanceSheetItem,
  BalanceSheetResult,
  CashFlowResult,
  GeneralLedgerItem,
  IncomeStatementItem,
  IncomeStatementResult,
  TrialBalanceResult,
} from '../stores/periodStore'
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

function balanceLabel(debit: number, credit: number) {
  if (debit > 0) return `借 ${currency(debit)}`
  if (credit > 0) return `贷 ${currency(credit)}`
  return currency(0)
}

export function mapLiveTrialBalanceRows(result: TrialBalanceResult): LiveModuleRow[] {
  const status: LiveModuleStatus = result.is_balanced ? '已通过' : '异常'
  return result.items.map((item) => ({
    id: `trial-${item.account_code}`,
    status,
    voucher: '可穿透',
    attachment: item.is_detail ? '明细科目' : '汇总科目',
    values: {
      code: item.account_code,
      name: item.account_name,
      aux: item.is_detail ? '明细核算' : '总账核算',
      openingDebit: currency(item.opening_debit),
      openingCredit: currency(item.opening_credit),
      currentDebit: currency(item.period_debit),
      currentCredit: currency(item.period_credit),
      endingBalance: balanceLabel(item.closing_debit, item.closing_credit),
    },
  }))
}

export function summarizeLiveTrialBalance(result: TrialBalanceResult): LiveSummaryItem[] {
  const difference = Math.abs(result.total_closing_debit - result.total_closing_credit)
  return [
    { label: '科目行数', value: `${result.items.length} 行`, tone: 'blue' },
    { label: '本期借方', value: currency(result.total_period_debit), tone: 'green' },
    { label: '本期贷方', value: currency(result.total_period_credit), tone: 'green' },
    { label: '试算差异', value: currency(difference), tone: result.is_balanced ? 'gray' : 'red' },
  ]
}

export function mapLiveGeneralLedgerRows(items: GeneralLedgerItem[]): LiveModuleRow[] {
  return items.map((item) => {
    const hasActivity = item.entries.length > 0 || item.period_debit !== 0 || item.period_credit !== 0
    return {
      id: `ledger-${item.account_code}`,
      status: hasActivity ? '已通过' : '待处理',
      voucher: hasActivity ? `${item.entries.length} 笔` : '无发生',
      attachment: item.entries.length > 0 ? '凭证穿透' : '月度汇总',
      values: {
        code: item.account_code,
        name: item.account_name,
        month: '本期',
        opening: balanceLabel(item.opening_debit, item.opening_credit),
        debit: currency(item.period_debit),
        credit: currency(item.period_credit),
        direction: item.closing_debit > 0 ? '借' : item.closing_credit > 0 ? '贷' : '-',
        ending: balanceLabel(item.closing_debit, item.closing_credit),
      },
    }
  })
}

export function summarizeLiveGeneralLedger(items: GeneralLedgerItem[]): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + item.period_debit, 0)
  const credit = items.reduce((sum, item) => sum + item.period_credit, 0)
  const reviewed = items.filter((item) => item.entries.length > 0).length
  return [
    { label: '总账科目', value: `${items.length} 个`, tone: 'blue' },
    { label: '已核对', value: `${reviewed} 个`, tone: 'green' },
    { label: '本期借方', value: currency(debit), tone: 'amber' },
    { label: '本期贷方', value: currency(credit), tone: 'gray' },
  ]
}

function flattenBalanceSheetItems(items: BalanceSheetItem[]): BalanceSheetItem[] {
  return items.flatMap((item) => [item, ...flattenBalanceSheetItems(item.children || [])])
}

export function mapLiveBalanceSheetRows(result: BalanceSheetResult): LiveModuleRow[] {
  const status: LiveModuleStatus = result.is_balanced ? '已通过' : '异常'
  return flattenBalanceSheetItems(result.items).map((item) => ({
    id: `balance-${item.item_code}`,
    status,
    voucher: '取数快照',
    attachment: item.is_total ? '汇总项目' : '报表项目',
    values: {
      line: item.item_code,
      item: item.item_name,
      formula: item.section || '报表模板',
      opening: currency(item.opening_balance),
      ending: currency(item.ending_balance),
      reclass: '未启用',
      check: result.is_balanced ? '通过' : '资产负债不平',
    },
  }))
}

export function summarizeLiveBalanceSheet(result: BalanceSheetResult): LiveSummaryItem[] {
  const difference = Math.abs(result.total_assets - result.total_liabilities - result.total_equity)
  return [
    { label: '资产合计', value: currency(result.total_assets), tone: 'blue' },
    { label: '负债合计', value: currency(result.total_liabilities), tone: 'green' },
    { label: '所有者权益', value: currency(result.total_equity), tone: 'green' },
    { label: '平衡差异', value: currency(difference), tone: result.is_balanced ? 'gray' : 'red' },
  ]
}

function flattenIncomeStatementItems(items: IncomeStatementItem[]): IncomeStatementItem[] {
  return items.flatMap((item) => [item, ...flattenIncomeStatementItems(item.children || [])])
}

export function mapLiveIncomeStatementRows(result: IncomeStatementResult): LiveModuleRow[] {
  return flattenIncomeStatementItems(result.items).map((item) => ({
    id: `income-${item.item_code}`,
    status: '已通过',
    voucher: '取数快照',
    attachment: item.is_total ? '汇总项目' : '凭证取数',
    values: {
      line: item.item_code,
      item: item.item_name,
      formula: item.item_code,
      current: currency(item.current_amount),
      yearTotal: currency(item.year_to_date),
      source: '本地账套凭证',
      check: '通过',
    },
  }))
}

export function summarizeLiveIncomeStatement(result: IncomeStatementResult): LiveSummaryItem[] {
  return [
    { label: '本期合计', value: currency(result.current_period_total), tone: 'blue' },
    { label: '本年累计', value: currency(result.year_to_date_total), tone: 'green' },
    { label: '报表项目', value: `${flattenIncomeStatementItems(result.items).length} 行`, tone: 'amber' },
    { label: '异常项目', value: '0 项', tone: 'gray' },
  ]
}

export function mapLiveCashFlowRows(result: CashFlowResult): LiveModuleRow[] {
  return result.items.map((item) => ({
    id: `cash-flow-${item.item_code}`,
    status: '已通过',
    voucher: '现金流快照',
    attachment: item.is_total ? '汇总项目' : '映射取数',
    values: {
      line: item.item_code,
      item: item.item_name,
      rule: '报表模板公式',
      current: currency(item.amount),
      yearTotal: '待累计取数',
      source: '本地账套凭证',
      check: '通过',
    },
  }))
}

export function summarizeLiveCashFlow(result: CashFlowResult): LiveSummaryItem[] {
  return [
    { label: '报表项目', value: `${result.items.length} 行`, tone: 'blue' },
    { label: '现金净增加', value: currency(result.net_increase), tone: result.net_increase >= 0 ? 'green' : 'amber' },
    { label: '本期取数', value: '已完成', tone: 'green' },
    { label: '未映射', value: '待规则接入', tone: 'gray' },
  ]
}
