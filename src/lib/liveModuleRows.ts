import type { Invoice } from '../stores/invoiceStore'
import type {
  AccountingPeriod,
  BalanceSheetItem,
  BalanceSheetResult,
  CashFlowResult,
  GeneralLedgerItem,
  IncomeStatementItem,
  IncomeStatementResult,
  SubsidiaryLedgerItem,
  TrialBalanceResult,
} from '../stores/periodStore'
import type { Company } from '../stores/companyStore'
import type { AccountCode } from '../stores/accountStore'
import type { AuxiliaryBalanceRow, AuxiliaryCategory, AuxiliaryItem, AuxiliaryLedgerRow } from '../stores/auxiliaryStore'
import type { Voucher, VoucherEntry } from '../stores/voucherStore'
import type { SettlementRule } from '../stores/settlementRuleStore'
import type { MatchingRule, MatchingRuleScope } from '../stores/matchingRuleStore'
import type { AssetCategory } from '../stores/assetCategoryStore'
import type { BusinessTag } from '../stores/businessTagStore'
import type { CompanyAccount } from '../stores/companyAccountStore'
import type { Currency } from '../stores/currencyStore'
import type { CommonDigest, VoucherTemplateType, VoucherTemplateWithEntries } from '../stores/templateStore'
import type { ReportItem, ReportTemplate } from '../stores/reportTemplateStore'
import type { AdapterAuthorization, AutomationJob, OperationAuditLog, TaxDeclarationTask } from '../lib/api'

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

export function mapLiveRiskCheckRows(vouchers: Voucher[], invoices: Invoice[]): LiveModuleRow[] {
  const rows: LiveModuleRow[] = []
  const unbalancedVouchers = vouchers.filter((voucher) => voucher.status === 'error' || voucher.total_debit !== voucher.total_credit)
  const draftVouchers = vouchers.filter((voucher) => voucher.status === 'draft')
  const rejectedInvoices = invoices.filter((invoice) => invoice.status === 'rejected')

  for (const voucher of unbalancedVouchers) {
    rows.push({
      id: `risk-voucher-balance-${voucher.id}`,
      status: '异常',
      voucher: voucher.voucher_number,
      attachment: voucher.attachment_count > 0 ? `附件 ${voucher.attachment_count}` : '无附件',
      values: {
        level: '高',
        module: '会计凭证',
        rule: '借贷不平',
        impact: '阻断结账',
        owner: voucher.modified_by || voucher.created_by || '待分配',
        updated: voucher.modified_at || voucher.created_at || '未记录',
      },
    })
  }

  for (const voucher of draftVouchers) {
    rows.push({
      id: `risk-voucher-draft-${voucher.id}`,
      status: '待处理',
      voucher: voucher.voucher_number,
      attachment: voucher.attachment_count > 0 ? `附件 ${voucher.attachment_count}` : '无附件',
      values: {
        level: '中',
        module: '会计凭证',
        rule: '草稿凭证待审核',
        impact: '结账前需审核',
        owner: voucher.created_by || '待分配',
        updated: voucher.modified_at || voucher.created_at || '未记录',
      },
    })
  }

  for (const invoice of rejectedInvoices) {
    rows.push({
      id: `risk-invoice-rejected-${invoice.id}`,
      status: '异常',
      voucher: invoice.voucher_id || '未关联凭证',
      attachment: invoiceAttachment(invoice),
      values: {
        level: '高',
        module: invoice.invoice_type === 'input' ? '进项发票' : '销项发票',
        rule: '发票状态异常',
        impact: '影响申报',
        owner: '待分配',
        updated: invoice.updated_at,
      },
    })
  }

  if (rows.length === 0 && (vouchers.length > 0 || invoices.length > 0)) {
    const updateTimes = [...vouchers.map((voucher) => voucher.modified_at || voucher.created_at), ...invoices.map((invoice) => invoice.updated_at)]
      .filter((value): value is string => Boolean(value))
      .sort()
    const updated = updateTimes.length > 0 ? updateTimes[updateTimes.length - 1] : '未记录'

    rows.push({
      id: 'risk-base-check-passed',
      status: '已通过',
      voucher: `已检查 ${vouchers.length} 张凭证`,
      attachment: `已检查 ${invoices.length} 张发票`,
      values: {
        level: '低',
        module: '基础校验',
        rule: '借贷平衡与发票状态检查',
        impact: '未发现阻断项',
        owner: '系统校验',
        updated,
      },
    })
  }

  return rows
}

export function summarizeLiveRiskChecks(vouchers: Voucher[], invoices: Invoice[]): LiveSummaryItem[] {
  const rows = mapLiveRiskCheckRows(vouchers, invoices)
  const passed = rows.filter((row) => row.status === '已通过').length
  const pending = rows.filter((row) => row.status === '待处理' || row.status === '待确认').length
  const blockers = rows.filter((row) => row.status === '异常').length
  return [
    { label: '检查项', value: `${rows.length} 项`, tone: rows.length > 0 ? 'blue' : 'gray' },
    { label: '已通过', value: `${passed} 项`, tone: passed > 0 ? 'green' : 'gray' },
    { label: '需复核', value: `${pending} 项`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '阻断结账', value: `${blockers} 项`, tone: blockers > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveClosingTaskRows(
  period: AccountingPeriod | undefined,
  vouchers: Voucher[],
  trialBalance: TrialBalanceResult | null,
  balanceSheet: BalanceSheetResult | null,
): LiveModuleRow[] {
  if (!period) return []

  const unbalancedVouchers = vouchers.filter((voucher) => voucher.status === 'error' || voucher.total_debit !== voucher.total_credit)
  const draftVouchers = vouchers.filter((voucher) => voucher.status === 'draft')
  const voucherStatus: LiveModuleStatus = unbalancedVouchers.length > 0 ? '异常' : draftVouchers.length > 0 ? '待确认' : '已通过'
  const trialStatus: LiveModuleStatus = !trialBalance ? '待处理' : trialBalance.is_balanced ? '已通过' : '异常'
  const balanceStatus: LiveModuleStatus = !balanceSheet ? '待处理' : balanceSheet.is_balanced ? '已通过' : '异常'
  const hasBlocker = [voucherStatus, trialStatus, balanceStatus].includes('异常')
  const periodStatus: LiveModuleStatus = period.status === 'closed' ? '已通过' : hasBlocker ? '异常' : '待确认'
  const periodLabel = `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
  const updated = period.closed_at || period.updated_at || '未记录'

  return [
    {
      id: `closing-voucher-review-${period.id}`,
      status: voucherStatus,
      voucher: draftVouchers.length > 0 ? `待审核 ${draftVouchers.length} 张` : `已检查 ${vouchers.length} 张`,
      attachment: `账期 ${periodLabel}`,
      values: {
        order: '1',
        name: '凭证审核',
        source: '会计凭证',
        template: '不生成凭证',
        amount: '—',
        condition: '无草稿且借贷平衡',
        lastRun: updated,
        blocker: unbalancedVouchers.length > 0 ? `${unbalancedVouchers.length} 张借贷不平` : draftVouchers.length > 0 ? `${draftVouchers.length} 张待审核` : '无',
      },
    },
    {
      id: `closing-trial-balance-${period.id}`,
      status: trialStatus,
      voucher: trialBalance?.is_balanced ? '试算平衡' : '待试算',
      attachment: `账期 ${periodLabel}`,
      values: {
        order: '2',
        name: '科目余额试算',
        source: '科目余额表',
        template: '不生成凭证',
        amount: trialBalance ? currency(trialBalance.total_period_debit) : '未取数',
        condition: '本期借贷平衡',
        lastRun: updated,
        blocker: !trialBalance ? '尚未取数' : trialBalance.is_balanced ? '无' : '试算不平',
      },
    },
    {
      id: `closing-balance-sheet-${period.id}`,
      status: balanceStatus,
      voucher: balanceSheet?.is_balanced ? '报表平衡' : '待校验',
      attachment: `账期 ${periodLabel}`,
      values: {
        order: '3',
        name: '资产负债表校验',
        source: '资产负债表',
        template: '不生成凭证',
        amount: balanceSheet ? currency(balanceSheet.total_assets) : '未取数',
        condition: '资产=负债+权益',
        lastRun: updated,
        blocker: !balanceSheet ? '尚未取数' : balanceSheet.is_balanced ? '无' : '资产负债不平',
      },
    },
    {
      id: `closing-period-lock-${period.id}`,
      status: periodStatus,
      voucher: period.status === 'closed' ? '账期已锁定' : '待人工结账',
      attachment: `账期 ${periodLabel}`,
      values: {
        order: '4',
        name: '账期结账',
        source: '账期管理',
        template: '结账锁定',
        amount: '—',
        condition: '结账前检查通过',
        lastRun: updated,
        blocker: period.status === 'closed' ? '已结账' : hasBlocker ? '存在阻断项' : '需人工确认',
      },
    },
  ]
}

export function summarizeLiveClosingTasks(
  period: AccountingPeriod | undefined,
  vouchers: Voucher[],
  trialBalance: TrialBalanceResult | null,
  balanceSheet: BalanceSheetResult | null,
): LiveSummaryItem[] {
  const rows = mapLiveClosingTaskRows(period, vouchers, trialBalance, balanceSheet)
  const completed = rows.filter((row) => row.status === '已通过').length
  const pending = rows.filter((row) => row.status === '待处理' || row.status === '待确认').length
  const blockers = rows.filter((row) => row.status === '异常').length
  return [
    { label: '结转任务', value: `${rows.length} 项`, tone: rows.length > 0 ? 'blue' : 'gray' },
    { label: '已完成', value: `${completed} 项`, tone: completed > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${pending} 项`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '阻断', value: `${blockers} 项`, tone: blockers > 0 ? 'red' : 'gray' },
  ]
}

function invoiceVoucherMatchingStatus(invoice: Invoice, voucher: Voucher | undefined): LiveModuleStatus {
  if (invoice.status === 'rejected') return '异常'
  if (!invoice.voucher_id) return '待处理'
  if (!voucher) return '异常'
  return Math.abs(voucher.total_debit - invoice.total_amount) < 0.01 ? '已匹配' : '待确认'
}

export function mapLiveInvoiceVoucherMatchingRows(invoices: Invoice[], vouchers: Voucher[]): LiveModuleRow[] {
  const vouchersById = new Map(vouchers.map((voucher) => [voucher.id, voucher]))
  return invoices.map((invoice) => {
    const voucher = invoice.voucher_id ? vouchersById.get(invoice.voucher_id) : undefined
    const status = invoiceVoucherMatchingStatus(invoice, voucher)
    const difference = voucher ? Math.abs(voucher.total_debit - invoice.total_amount) : null
    const counterparty = invoice.invoice_type === 'input' ? invoice.seller_name : invoice.buyer_name

    return {
      id: `invoice-voucher-match-${invoice.id}`,
      status,
      voucher: voucher?.voucher_number || invoice.voucher_id || '未关联凭证',
      attachment: invoiceAttachment(invoice),
      values: {
        invoiceNo: invoice.invoice_no,
        counterparty: counterparty || '未记录往来单位',
        invoiceAmount: currency(invoice.total_amount),
        voucherNo: voucher?.voucher_number || '未匹配',
        voucherAmount: voucher ? currency(voucher.total_debit) : '未记录',
        difference: difference === null ? '未匹配' : currency(difference),
        confidence: invoice.voucher_id ? '未记录' : '—',
        matchStatus: status === '已匹配'
          ? '凭证已关联'
          : status === '待确认'
            ? '金额差异'
            : status === '异常'
              ? invoice.voucher_id ? '关联凭证缺失' : '发票状态异常'
              : '待关联凭证',
      },
    }
  })
}

export function summarizeLiveInvoiceVoucherMatching(invoices: Invoice[], vouchers: Voucher[]): LiveSummaryItem[] {
  const rows = mapLiveInvoiceVoucherMatchingRows(invoices, vouchers)
  const linked = rows.filter((row) => row.status === '已匹配').length
  const pending = rows.filter((row) => row.status === '待确认').length
  const exceptions = rows.filter((row) => row.status === '异常').length
  const unmatched = rows.filter((row) => row.status === '待处理').length
  const linkedRate = rows.length === 0 ? '—' : `${Math.round((linked / rows.length) * 100)}%`
  return [
    { label: '待匹配票据', value: `${unmatched} 张`, tone: unmatched > 0 ? 'blue' : 'gray' },
    { label: '已关联率', value: linkedRate, tone: linked > 0 ? 'green' : 'gray' },
    { label: '待人工确认', value: `${pending} 张`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '差异票据', value: `${exceptions} 张`, tone: exceptions > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveVoucherRecycleRows(vouchers: Voucher[]): LiveModuleRow[] {
  return [...vouchers]
    .sort((left, right) => (right.deleted_at || '').localeCompare(left.deleted_at || ''))
    .map((voucher) => ({
      id: `voucher-recycle-${voucher.id}`,
      status: '待确认',
      voucher: voucher.voucher_number,
      attachment: voucher.attachment_count > 0 ? `附件 ${voucher.attachment_count}` : '无附件',
      values: {
        date: voucher.voucher_date,
        wordNo: voucher.voucher_number,
        summary: voucher.summary || voucher.entries[0]?.summary || '待补充摘要',
        amount: currency(Math.max(voucher.total_debit, voucher.total_credit)),
        deletedBy: '未记录删除人',
        deletedAt: voucher.deleted_at || '未记录删除时间',
        reason: '未记录删除原因',
      },
    }))
}

export function summarizeLiveVoucherRecycle(vouchers: Voucher[]): LiveSummaryItem[] {
  const missingTimestamp = vouchers.filter((voucher) => !voucher.deleted_at).length
  return [
    { label: '删除凭证', value: `${vouchers.length} 张`, tone: 'blue' },
    { label: '可恢复', value: `${vouchers.length} 张`, tone: vouchers.length > 0 ? 'green' : 'gray' },
    { label: '待复核', value: `${missingTimestamp} 张`, tone: missingTimestamp > 0 ? 'amber' : 'gray' },
    { label: '异常', value: '0 张', tone: 'gray' },
  ]
}

function declarationReceiptStatus(task: TaxDeclarationTask): LiveModuleStatus {
  const value = task.declarationStatus.toLowerCase()
  if (['failed', 'error', 'rejected'].includes(value)) return '异常'
  if (task.receiptNo || ['confirmed', 'submitted', 'completed'].includes(value)) return '已通过'
  return '待确认'
}

export function mapLiveDeclarationReceiptRows(tasks: TaxDeclarationTask[]): LiveModuleRow[] {
  return [...tasks]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((task) => ({
      id: `declaration-receipt-${task.id}`,
      status: declarationReceiptStatus(task),
      voucher: task.adapterCode || '未关联申报渠道',
      attachment: task.sourceSnapshot || '未记录回执附件',
      values: {
        taxType: task.taxType,
        form: task.formName,
        period: task.period,
        declareStatus: task.declarationStatus,
        receiptNo: task.receiptNo || '未收回执',
        paymentStatus: '未记录缴款状态',
        paymentNo: '未记录缴款书号',
        receivedAt: task.confirmedAt || '未记录收取时间',
      },
    }))
}

export function summarizeLiveDeclarationReceipts(tasks: TaxDeclarationTask[]): LiveSummaryItem[] {
  const received = tasks.filter((task) => Boolean(task.receiptNo)).length
  const pending = tasks.filter((task) => declarationReceiptStatus(task) === '待确认').length
  const exception = tasks.filter((task) => declarationReceiptStatus(task) === '异常').length
  return [
    { label: '申报事项', value: `${tasks.length} 项`, tone: 'blue' },
    { label: '已收回执', value: `${received} 项`, tone: received > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${pending} 项`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '异常', value: `${exception} 项`, tone: exception > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveTaxInitRows(tasks: TaxDeclarationTask[], adapters: AdapterAuthorization[]): LiveModuleRow[] {
  const taxAdapter = adapters.find((adapter) => adapter.adapterType === 'tax')
  return [...tasks]
    .sort((left, right) => left.taxType.localeCompare(right.taxType, 'zh-CN'))
    .map((task) => ({
      id: `tax-init-${task.id}`,
      status: task.riskCount > 0 ? '待确认' : task.validationStatus === 'passed' ? '启用' : '异常',
      voucher: task.adapterCode || taxAdapter?.adapterCode || '未配置税局渠道',
      attachment: task.sourceSnapshot || '未记录认定资料',
      values: {
        taxType: task.taxType,
        period: task.period,
        method: '未记录计税方式',
        adapter: task.adapterCode || taxAdapter?.adapterCode || '未配置',
        account: taxAdapter?.accountMask || '未配置授权账号',
        nextPeriod: task.declarationStatus === 'submitted' ? '已申报，待下期任务' : task.period,
      },
    }))
}

export function summarizeLiveTaxInit(tasks: TaxDeclarationTask[], adapters: AdapterAuthorization[]): LiveSummaryItem[] {
  const taxAdapter = adapters.find((adapter) => adapter.adapterType === 'tax')
  const ready = tasks.filter((task) => task.validationStatus === 'passed' && task.riskCount === 0).length
  const pending = tasks.filter((task) => task.riskCount > 0 || task.validationStatus !== 'passed').length
  return [
    { label: '认定税种', value: `${tasks.length} 项`, tone: tasks.length > 0 ? 'blue' : 'gray' },
    { label: '校验通过', value: `${ready} 项`, tone: ready > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${pending} 项`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '税局授权', value: taxAdapter?.authStatus || '未配置', tone: taxAdapter ? 'blue' : 'gray' },
  ]
}

function taxReportStatus(task: TaxDeclarationTask): LiveModuleStatus {
  if (task.riskCount > 0 || task.validationStatus === 'failed') return '异常'
  if (task.validationStatus === 'passed') return '已通过'
  return '待确认'
}

export function mapLiveTaxReportRows(tasks: TaxDeclarationTask[]): LiveModuleRow[] {
  return [...tasks]
    .sort((left, right) => left.taxType.localeCompare(right.taxType, 'zh-CN'))
    .map((task) => ({
      id: `tax-report-${task.id}`,
      status: taxReportStatus(task),
      voucher: task.adapterCode || '未关联申报渠道',
      attachment: task.sourceSnapshot || '未记录取数快照',
      values: {
        taxType: task.taxType,
        form: task.formName,
        source: task.sourceSnapshot || '未记录取数来源',
        amount: currency(task.taxableAmount),
        tax: currency(task.payableAmount),
        check: task.riskCount > 0
          ? `${task.riskCount} 项风险待复核`
          : task.validationStatus === 'passed'
            ? '校验通过'
            : '待校验',
      },
    }))
}

export function summarizeLiveTaxReports(tasks: TaxDeclarationTask[]): LiveSummaryItem[] {
  const passed = tasks.filter((task) => taxReportStatus(task) === '已通过').length
  const pending = tasks.filter((task) => taxReportStatus(task) === '待确认').length
  const exception = tasks.filter((task) => taxReportStatus(task) === '异常').length
  return [
    { label: '税表', value: `${tasks.length} 张`, tone: tasks.length > 0 ? 'blue' : 'gray' },
    { label: '校验通过', value: `${passed} 张`, tone: passed > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${pending} 张`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '差异', value: `${exception} 张`, tone: exception > 0 ? 'red' : 'gray' },
  ]
}

function isFinanceTaxReportTask(task: TaxDeclarationTask) {
  return /资产负债|利润表|现金流|财报|财务报表/.test(`${task.taxType} ${task.formName}`)
}

export function mapLiveFinanceTaxReportRows(tasks: TaxDeclarationTask[]): LiveModuleRow[] {
  return tasks
    .filter(isFinanceTaxReportTask)
    .sort((left, right) => left.formName.localeCompare(right.formName, 'zh-CN'))
    .map((task) => ({
      id: `finance-tax-report-${task.id}`,
      status: taxReportStatus(task),
      voucher: task.adapterCode || '未关联报送渠道',
      attachment: task.sourceSnapshot || '未记录取数快照',
      values: {
        form: task.formName,
        period: task.period,
        source: task.sourceSnapshot || '未记录来源报表',
        amount: currency(task.payableAmount),
        snapshot: task.sourceSnapshot ? '已记录' : '未记录',
        attachment: task.receiptNo || '未记录报送附件',
        owner: task.confirmedBy || '未记录负责人',
        check: task.riskCount > 0
          ? `${task.riskCount} 项风险待复核`
          : task.validationStatus === 'passed'
            ? '校验通过'
            : '待校验',
      },
    }))
}

export function summarizeLiveFinanceTaxReports(tasks: TaxDeclarationTask[]): LiveSummaryItem[] {
  const scoped = tasks.filter(isFinanceTaxReportTask)
  const passed = scoped.filter((task) => taxReportStatus(task) === '已通过').length
  const pending = scoped.filter((task) => taxReportStatus(task) === '待确认').length
  const exception = scoped.filter((task) => taxReportStatus(task) === '异常').length
  return [
    { label: '报送表', value: `${scoped.length} 张`, tone: scoped.length > 0 ? 'blue' : 'gray' },
    { label: '已取数', value: `${passed} 张`, tone: passed > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${pending} 张`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '差异', value: `${exception} 项`, tone: exception > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveFinancialOverviewRows(
  balanceSheet: BalanceSheetResult,
  incomeStatement: IncomeStatementResult,
  cashFlow: CashFlowResult,
): LiveModuleRow[] {
  if (balanceSheet.items.length === 0 && incomeStatement.items.length === 0 && cashFlow.items.length === 0) return []
  const balanceDifference = Math.abs(balanceSheet.total_assets - balanceSheet.total_liabilities - balanceSheet.total_equity)
  return [
    {
      id: `financial-overview-balance-${balanceSheet.period_id}`,
      status: balanceSheet.is_balanced ? '已通过' : '异常',
      voucher: '资产负债表',
      attachment: '本地取数',
      values: {
        line: '01',
        item: '资产负债表',
        formula: '资产、负债及所有者权益汇总',
        opening: currency(balanceSheet.opening_total_assets),
        ending: currency(balanceSheet.total_assets),
        reclass: balanceSheet.is_balanced ? '无需' : '待复核',
        note: `负债及权益 ${currency(balanceSheet.total_liabilities + balanceSheet.total_equity)}；差异 ${currency(balanceDifference)}`,
      },
    },
    {
      id: `financial-overview-income-${incomeStatement.period_id}`,
      status: incomeStatement.items.length > 0 ? '已通过' : '待确认',
      voucher: '利润表',
      attachment: '本地取数',
      values: {
        line: '02',
        item: '利润表',
        formula: '收入、成本、费用及损益科目汇总',
        opening: '-',
        ending: currency(incomeStatement.current_period_total),
        reclass: '无需',
        note: `本年累计 ${currency(incomeStatement.year_to_date_total)}；取数项目 ${incomeStatement.items.length} 行`,
      },
    },
    {
      id: `financial-overview-cash-${cashFlow.period_id}`,
      status: cashFlow.items.length > 0 ? '已通过' : '待确认',
      voucher: '现金流量表',
      attachment: '本地取数',
      values: {
        line: '03',
        item: '现金流量表',
        formula: '现金及现金等价物净增加额',
        opening: '-',
        ending: currency(cashFlow.net_increase),
        reclass: '无需',
        note: `取数项目 ${cashFlow.items.length} 行`,
      },
    },
  ]
}

export function summarizeLiveFinancialOverview(
  balanceSheet: BalanceSheetResult,
  incomeStatement: IncomeStatementResult,
  cashFlow: CashFlowResult,
): LiveSummaryItem[] {
  const hasReports = balanceSheet.items.length > 0 || incomeStatement.items.length > 0 || cashFlow.items.length > 0
  const difference = Math.abs(balanceSheet.total_assets - balanceSheet.total_liabilities - balanceSheet.total_equity)
  return [
    { label: '报表项目', value: hasReports ? '3 张' : '0 张', tone: hasReports ? 'blue' : 'gray' },
    { label: '资产合计', value: hasReports ? currency(balanceSheet.total_assets) : '未取数', tone: hasReports ? 'green' : 'gray' },
    { label: '负债权益', value: hasReports ? currency(balanceSheet.total_liabilities + balanceSheet.total_equity) : '未取数', tone: hasReports ? 'green' : 'gray' },
    { label: '校验差异', value: hasReports ? currency(difference) : '未取数', tone: hasReports ? (difference === 0 ? 'gray' : 'red') : 'gray' },
  ]
}

function automationJobStatus(job: AutomationJob): LiveModuleStatus {
  const status = job.status.toLowerCase()
  if (['failed', 'error', 'rejected', 'cancelled'].includes(status)) return '异常'
  if (['completed', 'succeeded', 'approved', 'confirmed'].includes(status)) return '已通过'
  if (['pending', 'review', 'awaiting_review', 'waiting_confirmation'].includes(status)) return '待确认'
  return '待处理'
}

function automationSuggestionStatus(job: AutomationJob): LiveModuleStatus {
  const status = job.status.toLowerCase()
  if (['failed', 'error', 'rejected', 'cancelled'].includes(status)) return '异常'
  if (['completed', 'succeeded', 'approved', 'confirmed'].includes(status)) return '已生成凭证'
  if (['pending', 'review', 'awaiting_review', 'waiting_confirmation', 'needs_review'].includes(status)) return '待确认'
  return '待处理'
}

function automationConfidence(confidence: number | null) {
  if (confidence === null) return '未记录'
  const percentage = confidence <= 1 ? confidence * 100 : confidence
  return `${Math.round(percentage)}%`
}

function automationNext(status: LiveModuleStatus) {
  if (status === '已通过') return '查看结果'
  if (status === '待确认') return '人工复核'
  if (status === '异常') return '人工处理'
  return '等待执行'
}

export function mapLiveAutomationJobRows(jobs: AutomationJob[], view: 'queue' | 'recognition' | 'suggestion'): LiveModuleRow[] {
  const suggestionJobs = jobs.filter((job) => job.jobType === 'voucher_suggestion')
  const visibleJobs = view === 'suggestion' ? suggestionJobs : jobs

  return [...visibleJobs]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((job) => {
      const status = view === 'suggestion' ? automationSuggestionStatus(job) : automationJobStatus(job)
      const sourceFile = job.sourceFile || job.sourceId || '未记录来源文件'
      const shared = {
        id: `automation-${view}-${job.id}`,
        status,
        voucher: job.sourceId || '未关联凭证',
        attachment: sourceFile,
      }

      if (view === 'recognition') {
        return {
          ...shared,
          values: {
            object: job.sourceId || job.jobType,
            file: sourceFile,
            fields: job.resultSummary || '未记录识别字段',
            matched: status === '已通过' ? '已复核' : status === '异常' ? '匹配异常' : '待复核',
            confidence: automationConfidence(job.confidence),
            risk: job.riskLevel || '未记录',
            reviewer: job.reviewer || '待分配',
            target: job.sourceModule,
          },
        }
      }

      if (view === 'suggestion') {
        return {
          ...shared,
          values: {
            suggestNo: job.id,
            source: [job.sourceModule, job.sourceId].filter(Boolean).join(' / ') || '未记录来源',
            summary: job.resultSummary || '未记录摘要',
            debit: '未记录分录',
            credit: '未记录分录',
            amount: '未记录金额',
            confidence: automationConfidence(job.confidence),
            risk: job.riskLevel || '未记录',
          },
        }
      }

      return {
        ...shared,
        values: {
          jobNo: job.id,
          source: job.sourceModule,
          file: sourceFile,
          stage: job.status,
          confidence: automationConfidence(job.confidence),
          owner: job.reviewer || job.createdBy || '待分配',
          startedAt: job.createdAt,
          next: automationNext(status),
        },
      }
    })
}

export function summarizeLiveAutomationJobs(jobs: AutomationJob[], view: 'queue' | 'recognition' | 'suggestion'): LiveSummaryItem[] {
  const suggestionJobs = jobs.filter((job) => job.jobType === 'voucher_suggestion')
  const visibleJobs = view === 'suggestion' ? suggestionJobs : jobs
  const statusForView = view === 'suggestion' ? automationSuggestionStatus : automationJobStatus
  const riskJobs = visibleJobs.filter((job) => ['high', 'critical'].includes(job.riskLevel.toLowerCase()) || statusForView(job) === '异常').length
  const completed = visibleJobs.filter((job) => statusForView(job) === (view === 'suggestion' ? '已生成凭证' : '已通过')).length
  const pending = visibleJobs.filter((job) => statusForView(job) === '待确认').length
  const waiting = visibleJobs.filter((job) => statusForView(job) === '待处理').length
  const exception = visibleJobs.filter((job) => statusForView(job) === '异常').length

  if (view === 'suggestion') {
    return [
      { label: '凭证建议', value: `${visibleJobs.length} 条`, tone: visibleJobs.length > 0 ? 'blue' : 'gray' },
      { label: '可确认', value: `${pending} 条`, tone: pending > 0 ? 'green' : 'gray' },
      { label: '待修改', value: `${waiting} 条`, tone: waiting > 0 ? 'amber' : 'gray' },
      { label: '高风险', value: `${riskJobs} 条`, tone: riskJobs > 0 ? 'red' : 'gray' },
    ]
  }

  const passed = completed
  const label = view === 'queue' ? 'AI任务' : '识别结果'
  const passedLabel = view === 'queue' ? '已完成' : '自动通过'
  const pendingLabel = view === 'queue' ? '待确认' : '待复核'
  const exceptionLabel = view === 'queue' ? '异常' : '异常字段'
  return [
    { label, value: `${visibleJobs.length} 条`, tone: visibleJobs.length > 0 ? 'blue' : 'gray' },
    { label: passedLabel, value: `${passed} 条`, tone: passed > 0 ? 'green' : 'gray' },
    { label: pendingLabel, value: `${pending} 条`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: exceptionLabel, value: `${exception} 条`, tone: exception > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveHistoryVoucherRows(vouchers: Voucher[], periodLabel: string): LiveModuleRow[] {
  return vouchers.map((voucher) => ({
    id: `history-voucher-${voucher.id}`,
    status: voucherStatus(voucher),
    voucher: voucher.voucher_number,
    attachment: voucher.attachment_count > 0 ? `附件 ${voucher.attachment_count}` : '无附件',
    values: {
      period: periodLabel,
      wordNo: voucher.voucher_number,
      date: voucher.voucher_date,
      summary: voucher.summary || voucher.entries[0]?.summary || '待补充摘要',
      subjectMap: `${entryAccount(voucher.entries, 'debit')} / ${entryAccount(voucher.entries, 'credit')}`,
      debit: currency(voucher.total_debit),
      credit: currency(voucher.total_credit),
      sourceBatch: '本地账套查询',
    },
  }))
}

export function summarizeLiveHistoryVouchers(vouchers: Voucher[], periodLabel: string): LiveSummaryItem[] {
  const approved = vouchers.filter((voucher) => voucher.status === 'approved' || voucher.status === 'posted').length
  const abnormal = vouchers.filter((voucher) => voucher.status === 'error' || voucher.total_debit !== voucher.total_credit).length
  const hasPeriod = Boolean(periodLabel)
  return [
    { label: '历史凭证', value: hasPeriod ? `${vouchers.length} 张` : '未选择期间', tone: hasPeriod ? 'blue' : 'gray' },
    { label: '已映射', value: hasPeriod ? `${vouchers.filter((voucher) => voucher.entries.length > 0).length} 张` : '-', tone: hasPeriod ? 'green' : 'gray' },
    { label: '待确认', value: hasPeriod ? `${Math.max(vouchers.length - approved - abnormal, 0)} 张` : '-', tone: hasPeriod ? 'amber' : 'gray' },
    { label: '异常', value: hasPeriod ? `${abnormal} 张` : '-', tone: hasPeriod ? 'red' : 'gray' },
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

export function mapLiveLedgerOverviewRows(result: TrialBalanceResult): LiveModuleRow[] {
  const status: LiveModuleStatus = result.is_balanced ? '已通过' : '异常'
  return result.items.map((item) => ({
    id: `ledger-overview-${item.account_code}`,
    status,
    voucher: '可穿透',
    attachment: item.is_detail ? '明细科目' : '汇总科目',
    values: {
      code: item.account_code,
      name: item.account_name,
      aux: item.is_detail ? '明细核算' : '总账核算',
      openingDebit: currency(item.opening_debit),
      openingCredit: currency(item.opening_credit),
      debit: currency(item.period_debit),
      credit: currency(item.period_credit),
      direction: item.closing_debit > 0 ? '借' : item.closing_credit > 0 ? '贷' : '-',
      balance: balanceLabel(item.closing_debit, item.closing_credit),
    },
  }))
}

export function summarizeLiveLedgerOverview(result: TrialBalanceResult): LiveSummaryItem[] {
  return [
    { label: '科目数', value: `${result.items.length} 个`, tone: 'blue' },
    { label: '本期借方', value: currency(result.total_period_debit), tone: 'green' },
    { label: '本期贷方', value: currency(result.total_period_credit), tone: 'green' },
    { label: '不平项', value: result.is_balanced ? '0' : '1', tone: result.is_balanced ? 'gray' : 'red' },
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

export function mapLiveSubsidiaryLedgerRows(items: SubsidiaryLedgerItem[]): LiveModuleRow[] {
  return items.map((item, index) => ({
    id: `subsidiary-${item.voucher_id || item.voucher_number || index}`,
    status: item.balance_direction ? '已通过' : '待确认',
    voucher: item.voucher_number || '期初',
    attachment: item.summary === '期初余额' ? '期初余额' : '凭证穿透',
    values: {
      date: item.voucher_date || '-',
      wordNo: item.voucher_number || '期初',
      subject: '当前选择科目',
      summary: item.summary || '期初余额',
      opposite: item.opposite_account || '-',
      debit: currency(item.debit),
      credit: currency(item.credit),
      balance: item.balance_direction ? `${item.balance_direction} ${currency(item.balance)}` : currency(item.balance),
    },
  }))
}

export function summarizeLiveSubsidiaryLedger(items: SubsidiaryLedgerItem[]): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + item.debit, 0)
  const credit = items.reduce((sum, item) => sum + item.credit, 0)
  return [
    { label: '明细行数', value: `${items.length} 行`, tone: 'blue' },
    { label: '借方发生', value: currency(debit), tone: 'green' },
    { label: '贷方发生', value: currency(credit), tone: 'green' },
    { label: '待复核', value: `${items.filter((item) => !item.balance_direction).length} 行`, tone: 'amber' },
  ]
}

export function mapLiveAuxiliaryLedgerRows(
  items: AuxiliaryLedgerRow[],
  categoryName: string,
  itemName: string,
): LiveModuleRow[] {
  return items.map((item, index) => {
    const isDebit = item.direction === '借' || item.direction === 'debit'
    return {
      id: `auxiliary-ledger-${item.voucher_number || index}`,
      status: item.voucher_number ? '已通过' : '待确认',
      voucher: item.voucher_number || '期初',
      attachment: categoryName || '辅助核算',
      values: {
        category: categoryName || '当前选择类别',
        item: itemName || '当前选择项目',
        subject: '辅助核算明细',
        date: item.date || '-',
        wordNo: item.voucher_number || '期初',
        summary: item.summary || '期初余额',
        debit: isDebit ? currency(item.amount) : currency(0),
        credit: isDebit ? currency(0) : currency(item.amount),
      },
    }
  })
}

export function summarizeLiveAuxiliaryLedger(items: AuxiliaryLedgerRow[], categoryName: string, itemName: string): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + (item.direction === '借' || item.direction === 'debit' ? item.amount : 0), 0)
  const credit = items.reduce((sum, item) => sum + (item.direction === '贷' || item.direction === 'credit' ? item.amount : 0), 0)
  return [
    { label: '辅助类别', value: categoryName || '未选择', tone: categoryName ? 'blue' : 'gray' },
    { label: '辅助项目', value: itemName || '未选择', tone: itemName ? 'green' : 'gray' },
    { label: '发生金额', value: currency(debit + credit), tone: 'amber' },
    { label: '异常项目', value: '0 个', tone: 'gray' },
  ]
}

export function mapLiveAuxiliaryBalanceRows(items: AuxiliaryBalanceRow[], categoryName: string): LiveModuleRow[] {
  return items.map((item) => {
    const endingDebit = item.ending_debit > 0
    const endingCredit = item.ending_credit > 0
    return {
      id: `auxiliary-balance-${item.auxiliary_item_code}`,
      status: endingDebit || endingCredit ? '已通过' : '待处理',
      voucher: '辅助余额',
      attachment: categoryName || '辅助核算',
      values: {
        category: categoryName || '当前选择类别',
        item: item.auxiliary_item_name,
        subject: '辅助核算余额',
        opening: balanceLabel(item.beginning_debit, item.beginning_credit),
        debit: currency(item.period_debit),
        credit: currency(item.period_credit),
        direction: endingDebit ? '借' : endingCredit ? '贷' : '-',
        ending: balanceLabel(item.ending_debit, item.ending_credit),
      },
    }
  })
}

export function summarizeLiveAuxiliaryBalance(items: AuxiliaryBalanceRow[], categoryName: string): LiveSummaryItem[] {
  const endingDebit = items.reduce((sum, item) => sum + item.ending_debit, 0)
  const endingCredit = items.reduce((sum, item) => sum + item.ending_credit, 0)
  return [
    { label: '辅助余额行', value: categoryName ? `${items.length} 行` : '未选择类别', tone: categoryName ? 'blue' : 'gray' },
    { label: '借方余额', value: currency(endingDebit), tone: 'green' },
    { label: '贷方余额', value: currency(endingCredit), tone: 'amber' },
    { label: '不一致', value: '待总账核对', tone: 'gray' },
  ]
}

export function mapLivePeriodManagementRows(periods: AccountingPeriod[]): LiveModuleRow[] {
  return [...periods]
    .sort((left, right) => right.period_year - left.period_year || right.period_month - left.period_month)
    .map((period) => {
      const isClosed = period.status === 'closed'
      return {
        id: `period-${period.id}`,
        status: isClosed ? '已通过' : '待确认',
        voucher: isClosed ? '已锁定' : '开放编辑',
        attachment: isClosed ? '结账记录' : '结账前检查',
        values: {
          period: `${period.period_year}-${String(period.period_month).padStart(2, '0')}`,
          status: isClosed ? '已结账' : '开放中',
          voucher: isClosed ? '已锁定' : '待审核后结账',
          report: '需单独核对',
          tax: '请至申报工作台核对',
          lockedBy: period.closed_by || '-',
          closedAt: period.closed_at || '-',
          action: isClosed ? '申请反结账' : '执行结账前检查',
        },
      }
    })
}

export function summarizeLivePeriodManagement(periods: AccountingPeriod[]): LiveSummaryItem[] {
  const closed = periods.filter((period) => period.status === 'closed').length
  const open = periods.filter((period) => period.status === 'open').length
  return [
    { label: '账期', value: `${periods.length} 期`, tone: 'blue' },
    { label: '已结账', value: `${closed} 期`, tone: 'green' },
    { label: '待结账', value: `${open} 期`, tone: open > 0 ? 'amber' : 'gray' },
    { label: '阻断', value: '需执行检查', tone: 'gray' },
  ]
}

export function mapLiveHistoryBalanceRows(result: TrialBalanceResult, periodLabel: string): LiveModuleRow[] {
  const status: LiveModuleStatus = result.is_balanced ? '已通过' : '异常'
  return result.items.map((item) => ({
    id: `history-balance-${periodLabel}-${item.account_code}`,
    status,
    voucher: periodLabel,
    attachment: '历史余额取数',
    values: {
      sourcePeriod: periodLabel,
      code: item.account_code,
      name: item.account_name,
      aux: item.is_detail ? '明细核算' : '总账核算',
      opening: balanceLabel(item.opening_debit, item.opening_credit),
      debit: currency(item.period_debit),
      credit: currency(item.period_credit),
      ending: balanceLabel(item.closing_debit, item.closing_credit),
    },
  }))
}

export function summarizeLiveHistoryBalance(result: TrialBalanceResult, periodLabel: string): LiveSummaryItem[] {
  const difference = Math.abs(result.total_closing_debit - result.total_closing_credit)
  const hasPeriod = Boolean(periodLabel)
  return [
    { label: '科目余额行', value: hasPeriod ? `${result.items.length} 行` : '未选择期间', tone: hasPeriod ? 'blue' : 'gray' },
    { label: '借方累计', value: hasPeriod ? currency(result.total_period_debit) : '-', tone: hasPeriod ? 'green' : 'gray' },
    { label: '贷方累计', value: hasPeriod ? currency(result.total_period_credit) : '-', tone: hasPeriod ? 'green' : 'gray' },
    { label: '差异', value: hasPeriod ? currency(difference) : '-', tone: hasPeriod ? (result.is_balanced ? 'gray' : 'red') : 'gray' },
  ]
}

export function mapLiveHistoryGeneralLedgerRows(items: GeneralLedgerItem[], periodLabel: string): LiveModuleRow[] {
  return items.map((item) => ({
    id: `history-general-ledger-${periodLabel}-${item.account_code}`,
    status: item.entries.length > 0 ? '已通过' : '待处理',
    voucher: item.entries.length > 0 ? `${item.entries.length} 笔` : '无发生',
    attachment: '历史总账取数',
    values: {
      period: periodLabel,
      code: item.account_code,
      name: item.account_name,
      direction: item.closing_debit > 0 ? '借' : item.closing_credit > 0 ? '贷' : '-',
      opening: balanceLabel(item.opening_debit, item.opening_credit),
      debit: currency(item.period_debit),
      credit: currency(item.period_credit),
      ending: balanceLabel(item.closing_debit, item.closing_credit),
    },
  }))
}

export function summarizeLiveHistoryGeneralLedger(items: GeneralLedgerItem[], periodLabel: string): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + item.period_debit, 0)
  const credit = items.reduce((sum, item) => sum + item.period_credit, 0)
  const hasPeriod = Boolean(periodLabel)
  return [
    { label: '总账科目', value: hasPeriod ? `${items.length} 个` : '未选择期间', tone: hasPeriod ? 'blue' : 'gray' },
    { label: '已核对', value: hasPeriod ? `${items.filter((item) => item.entries.length > 0).length} 个` : '-', tone: hasPeriod ? 'green' : 'gray' },
    { label: '待复核', value: hasPeriod ? '需人工核对' : '-', tone: hasPeriod ? 'amber' : 'gray' },
    { label: '异常', value: hasPeriod ? (debit === credit ? '0 个' : '需检查') : '-', tone: hasPeriod ? (debit === credit ? 'gray' : 'red') : 'gray' },
  ]
}

export function mapLiveHistorySubsidiaryLedgerRows(items: SubsidiaryLedgerItem[], subject: string): LiveModuleRow[] {
  return items.map((item, index) => ({
    id: `history-subsidiary-${item.voucher_id || item.voucher_number || index}`,
    status: item.balance_direction ? '已通过' : '待确认',
    voucher: item.voucher_number || '期初',
    attachment: item.summary === '期初余额' ? '历史期初' : '历史凭证穿透',
    values: {
      date: item.voucher_date || '-',
      wordNo: item.voucher_number || '期初',
      subject: subject || '未选择科目',
      summary: item.summary || '期初余额',
      opposite: item.opposite_account || '-',
      debit: currency(item.debit),
      credit: currency(item.credit),
      balance: item.balance_direction ? `${item.balance_direction} ${currency(item.balance)}` : currency(item.balance),
    },
  }))
}

export function summarizeLiveHistorySubsidiaryLedger(items: SubsidiaryLedgerItem[], hasSelection: boolean): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + item.debit, 0)
  const credit = items.reduce((sum, item) => sum + item.credit, 0)
  const unreviewed = items.filter((item) => !item.balance_direction).length
  return [
    { label: '明细行数', value: hasSelection ? `${items.length} 行` : '未选择条件', tone: hasSelection ? 'blue' : 'gray' },
    { label: '已核对', value: hasSelection ? `${items.length - unreviewed} 行` : '-', tone: hasSelection ? 'green' : 'gray' },
    { label: '待复核', value: hasSelection ? `${unreviewed} 行` : '-', tone: hasSelection ? 'amber' : 'gray' },
    { label: '异常', value: hasSelection ? (debit === credit ? '0 行' : '需检查') : '-', tone: hasSelection ? (debit === credit ? 'gray' : 'red') : 'gray' },
  ]
}

const settlementRuleLabels: Record<string, string> = {
  profit_loss: '结转损益',
  tax: '计提所得税',
  vat: '转出未交增值税',
  custom: '自定义结转',
}

export function mapLiveSettlementRuleRows(rules: SettlementRule[]): LiveModuleRow[] {
  return [...rules]
    .sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name))
    .map((rule) => ({
      id: `settlement-rule-${rule.id}`,
      status: rule.is_enabled === 1 ? '启用' : '停用',
      voucher: rule.voucher_word_id || '-',
      attachment: rule.target_account_code ? `目标科目 ${rule.target_account_code}` : '待配置目标科目',
      values: {
        order: String(rule.priority),
        name: rule.name,
        source: rule.source_formula || '未配置取数公式',
        template: rule.summary_template || '未配置摘要模板',
        condition: settlementRuleLabels[rule.rule_type] || rule.rule_type,
        lastRun: '暂无执行记录',
      },
    }))
}

export function summarizeLiveSettlementRules(rules: SettlementRule[]): LiveSummaryItem[] {
  const enabled = rules.filter((rule) => rule.is_enabled === 1).length
  const missingTarget = rules.filter((rule) => !rule.target_account_code).length
  return [
    { label: '结转规则', value: `${rules.length} 条`, tone: 'blue' },
    { label: '启用', value: `${enabled} 条`, tone: 'green' },
    { label: '待执行', value: '待期末触发', tone: 'amber' },
    { label: '阻断', value: `${missingTarget} 条`, tone: missingTarget > 0 ? 'red' : 'gray' },
  ]
}

const currencySymbols: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  HKD: 'HK$',
}

export function mapLiveCurrencyRows(currencies: Currency[]): LiveModuleRow[] {
  return [...currencies]
    .sort((left, right) => right.is_base - left.is_base || left.code.localeCompare(right.code))
    .map((currencyItem) => ({
      id: `currency-${currencyItem.id}`,
      status: '启用',
      voucher: '-',
      attachment: currencyItem.is_base === 1 ? '本位币' : '可用于期末调汇',
      values: {
        code: currencyItem.code,
        name: currencyItem.name || '未命名币别',
        symbol: currencySymbols[currencyItem.code.toUpperCase()] || currencyItem.code,
        rate: currencyItem.exchange_rate.toFixed(4),
        method: currencyItem.is_base === 1 ? '本位币' : '账套记账汇率',
        updatedAt: '未记录更新时间',
      },
    }))
}

export function summarizeLiveCurrencies(currencies: Currency[]): LiveSummaryItem[] {
  const baseCount = currencies.filter((currencyItem) => currencyItem.is_base === 1).length
  const foreignCount = currencies.length - baseCount
  return [
    { label: '币别', value: `${currencies.length} 个`, tone: 'blue' },
    { label: '本位币', value: `${baseCount} 个`, tone: baseCount === 1 ? 'green' : baseCount === 0 ? 'amber' : 'red' },
    { label: '外币', value: `${foreignCount} 个`, tone: foreignCount > 0 ? 'amber' : 'gray' },
    { label: '异常', value: baseCount === 1 ? '0 个' : `${Math.abs(baseCount - 1)} 个`, tone: baseCount === 1 ? 'gray' : 'red' },
  ]
}

export function mapLiveCommonDigestRows(digests: CommonDigest[]): LiveModuleRow[] {
  return [...digests]
    .sort((left, right) => left.content.localeCompare(right.content))
    .map((digest) => ({
      id: `digest-${digest.id}`,
      status: '启用',
      voucher: '-',
      attachment: '账套摘要库',
      values: {
        template: digest.content,
        module: '凭证录入',
        keywords: '未配置关键词',
        subject: '未配置默认科目',
        priority: '-',
        usage: '暂无使用记录',
      },
    }))
}

export function summarizeLiveCommonDigests(digests: CommonDigest[]): LiveSummaryItem[] {
  return [
    { label: '摘要模板', value: `${digests.length} 条`, tone: 'blue' },
    { label: '启用', value: `${digests.length} 条`, tone: 'green' },
    { label: '待补关键词', value: `${digests.length} 条`, tone: digests.length > 0 ? 'amber' : 'gray' },
    { label: '冲突', value: '0 条', tone: 'gray' },
  ]
}

function templateTypeName(template: VoucherTemplateWithEntries, types: VoucherTemplateType[]) {
  return types.find((type) => type.id === template.template.type_id)?.name || '未分类模板'
}

function templateAccounts(template: VoucherTemplateWithEntries, direction: 'debit' | 'credit') {
  const values = template.entries
    .filter((entry) => entry.direction === direction)
    .map((entry) => `${entry.account_code} ${entry.account_name}`)
  return values.length > 0 ? values.join(' / ') : '未配置'
}

export function mapLiveVoucherTemplateRows(
  templates: VoucherTemplateWithEntries[],
  types: VoucherTemplateType[],
): LiveModuleRow[] {
  return [...templates]
    .sort((left, right) => templateTypeName(left, types).localeCompare(templateTypeName(right, types)) || left.template.name.localeCompare(right.template.name))
    .map((template) => {
      const summaries = [...new Set(template.entries.map((entry) => entry.summary).filter(Boolean))]
      const auxiliaries = [...new Set(template.entries.map((entry) => entry.auxiliary_type).filter(Boolean))]
      const hasEntries = template.entries.length > 0
      return {
        id: `voucher-template-${template.template.id}`,
        status: hasEntries ? '启用' : '待确认',
        voucher: '-',
        attachment: `${template.entries.length} 条分录`,
        values: {
          name: template.template.name,
          source: templateTypeName(template, types),
          summary: summaries.length > 0 ? summaries.join(' / ') : '未配置摘要',
          debit: templateAccounts(template, 'debit'),
          credit: templateAccounts(template, 'credit'),
          aux: auxiliaries.length > 0 ? auxiliaries.join(' / ') : '无辅助核算',
          priority: '未配置优先级',
          usage: '暂无使用记录',
        },
      }
    })
}

export function summarizeLiveVoucherTemplates(
  templates: VoucherTemplateWithEntries[],
  types: VoucherTemplateType[],
): LiveSummaryItem[] {
  const enabled = templates.filter((template) => template.entries.length > 0).length
  const incomplete = templates.length - enabled
  return [
    { label: '凭证模板', value: `${templates.length} 套`, tone: 'blue' },
    { label: '模板类型', value: `${types.length} 类`, tone: 'green' },
    { label: '可用模板', value: `${enabled} 套`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '待补分录', value: `${incomplete} 套`, tone: incomplete > 0 ? 'amber' : 'gray' },
  ]
}

const reportTypeLabels: Record<string, string> = {
  balance_sheet: '资产负债表',
  income_statement: '利润表',
  cash_flow: '现金流量表',
  equity_change: '所有者权益变动表',
}

export function mapLiveReportFormulaRows(
  templates: ReportTemplate[],
  items: ReportItem[],
): LiveModuleRow[] {
  const templateById = new Map(templates.map((template) => [template.id, template]))
  return [...items]
    .sort((left, right) => {
      const leftTemplate = templateById.get(left.template_id)?.template_name || ''
      const rightTemplate = templateById.get(right.template_id)?.template_name || ''
      return leftTemplate.localeCompare(rightTemplate) || left.sort_order - right.sort_order
    })
    .map((item) => {
      const template = templateById.get(item.template_id)
      const hasFormula = Boolean(item.formula?.trim())
      return {
        id: `report-formula-${item.id}`,
        status: item.is_enabled === 1 ? (hasFormula ? '启用' : '待确认') : '停用',
        voucher: '-',
        attachment: template?.is_system === 1 ? '系统模板' : '账套模板',
        values: {
          report: template ? reportTypeLabels[template.report_type] || template.template_name : '未知模板',
          line: item.item_code,
          item: item.item_name,
          formula: item.formula || '未配置取数公式',
          direction: '未配置',
          reclass: '未配置',
          version: template?.template_code || '未记录版本',
          check: item.is_enabled === 0 ? '已停用' : hasFormula ? '待报表取数校验' : '缺少公式',
        },
      }
    })
}

export function summarizeLiveReportFormulas(
  templates: ReportTemplate[],
  items: ReportItem[],
): LiveSummaryItem[] {
  const enabled = items.filter((item) => item.is_enabled === 1 && Boolean(item.formula?.trim())).length
  const pending = items.filter((item) => item.is_enabled === 1 && !item.formula?.trim()).length
  const disabled = items.filter((item) => item.is_enabled === 0).length
  return [
    { label: '报表公式', value: `${items.length} 条`, tone: 'blue' },
    { label: '启用', value: `${enabled} 条`, tone: 'green' },
    { label: '待复核', value: `${pending} 条`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '异常', value: `${disabled} 条`, tone: disabled > 0 ? 'red' : 'gray' },
  ]
}

type AdapterKind = 'tax' | 'bank'

function adapterStatus(adapter: AdapterAuthorization): LiveModuleStatus {
  const value = adapter.authStatus.toLowerCase()
  if (adapter.riskMessage || ['expired', 'failed', 'error', 'revoked'].includes(value)) return '异常'
  if (['authorized', 'active', 'configured', 'ready'].includes(value)) return '启用'
  if (['disabled', 'inactive'].includes(value)) return '停用'
  return '待确认'
}

function adapterStatusLabel(adapter: AdapterAuthorization) {
  return adapter.authStatus || '未记录授权状态'
}

export function mapLiveAdapterAuthorizationRows(
  adapters: AdapterAuthorization[],
  kind: AdapterKind,
): LiveModuleRow[] {
  return adapters
    .filter((adapter) => adapter.adapterType === kind)
    .sort((left, right) => (left.region || '').localeCompare(right.region || '') || left.adapterCode.localeCompare(right.adapterCode))
    .map((adapter) => {
      const status = adapterStatus(adapter)
      if (kind === 'tax') {
        return {
          id: `tax-adapter-${adapter.id}`,
          status,
          voucher: '-',
          attachment: adapter.riskMessage || '授权边界记录',
          values: {
            region: adapter.region || '未配置地区',
            channel: adapter.adapterCode,
            taxTypes: adapter.capabilityScope || '未配置税种范围',
            authMode: adapter.loginIdentity || '未配置授权身份',
            account: adapter.accountMask || '未配置脱敏账号',
            submitScope: adapter.capabilityScope || '未配置能力范围',
            receipt: '未配置回执能力',
            lastCheck: adapter.lastCheckedAt || '未检测',
          },
        }
      }

      return {
        id: `bank-adapter-${adapter.id}`,
        status,
        voucher: '-',
        attachment: adapter.riskMessage || '授权边界记录',
        values: {
          bank: adapter.adapterCode,
          account: adapter.accountMask || '未配置脱敏账号',
          collectMode: adapter.capabilityScope || '未配置采集能力',
          fileFormat: '未配置文件格式',
          authStatus: adapterStatusLabel(adapter),
          reconcile: '未配置对账能力',
          receipt: '未配置回单能力',
          lastSync: adapter.lastCheckedAt || '未检测',
        },
      }
    })
}

export function summarizeLiveAdapterAuthorizations(
  adapters: AdapterAuthorization[],
  kind: AdapterKind,
): LiveSummaryItem[] {
  const scoped = adapters.filter((adapter) => adapter.adapterType === kind)
  const enabled = scoped.filter((adapter) => adapterStatus(adapter) === '启用').length
  const pending = scoped.filter((adapter) => adapterStatus(adapter) === '待确认').length
  const exception = scoped.filter((adapter) => adapterStatus(adapter) === '异常').length
  const label = kind === 'tax' ? '税局渠道' : '银行渠道'
  return [
    { label, value: `${scoped.length} 个`, tone: 'blue' },
    { label: '已配置', value: `${enabled} 个`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '待授权', value: `${pending} 个`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '异常', value: `${exception} 个`, tone: exception > 0 ? 'red' : 'gray' },
  ]
}

function operationAuditStatus(log: OperationAuditLog): LiveModuleStatus {
  const result = log.result.toLowerCase()
  if (['failed', 'error', 'rejected'].includes(result)) return '异常'
  if (['pending', 'review'].includes(result)) return '待确认'
  return '已通过'
}

export function mapLiveOperationAuditRows(logs: OperationAuditLog[]): LiveModuleRow[] {
  return logs.map((log) => ({
    id: `operation-audit-${log.id}`,
    status: operationAuditStatus(log),
    voucher: log.objectRef || '-',
    attachment: log.detail || '后端审计记录',
    values: {
      time: log.createdAt,
      operator: log.operator || '系统',
      module: log.moduleName,
      action: log.action,
      object: log.objectRef || '-',
      level: log.riskLevel || 'normal',
      result: log.result || '未记录结果',
      ip: '后端日志',
    },
  }))
}

export function summarizeLiveOperationAudits(logs: OperationAuditLog[]): LiveSummaryItem[] {
  const normal = logs.filter((log) => !['high', 'critical'].includes(log.riskLevel.toLowerCase())).length
  const pending = logs.filter((log) => operationAuditStatus(log) === '待确认').length
  const highRisk = logs.filter((log) => ['high', 'critical'].includes(log.riskLevel.toLowerCase())).length
  return [
    { label: '日志条数', value: `${logs.length} 条`, tone: 'blue' },
    { label: '普通操作', value: `${normal} 条`, tone: 'green' },
    { label: '需复核', value: `${pending} 条`, tone: pending > 0 ? 'amber' : 'gray' },
    { label: '高风险', value: `${highRisk} 条`, tone: highRisk > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveAccountSummaryRows(items: GeneralLedgerItem[]): LiveModuleRow[] {
  return items.map((item) => {
    const debitEntries = item.entries.filter((entry) => entry.direction === 'debit')
    const creditEntries = item.entries.filter((entry) => entry.direction === 'credit')
    const hasActivity = item.entries.length > 0
    return {
      id: `account-summary-${item.account_code}`,
      status: hasActivity ? '已通过' : '待处理',
      voucher: hasActivity ? `${item.entries.length} 笔` : '无发生',
      attachment: hasActivity ? '凭证汇总' : '无附件',
      values: {
        code: item.account_code,
        name: item.account_name,
        voucherCount: `${new Set(item.entries.map((entry) => entry.voucher_id)).size}`,
        debitCount: `${debitEntries.length}`,
        creditCount: `${creditEntries.length}`,
        debit: currency(item.period_debit),
        credit: currency(item.period_credit),
        check: hasActivity ? '已取数' : '无发生',
      },
    }
  })
}

export function summarizeLiveAccountSummary(items: GeneralLedgerItem[]): LiveSummaryItem[] {
  const debit = items.reduce((sum, item) => sum + item.period_debit, 0)
  const credit = items.reduce((sum, item) => sum + item.period_credit, 0)
  const voucherIds = new Set(items.flatMap((item) => item.entries.map((entry) => entry.voucher_id)))
  return [
    { label: '凭证张数', value: `${voucherIds.size} 张`, tone: 'blue' },
    { label: '借方合计', value: currency(debit), tone: 'green' },
    { label: '贷方合计', value: currency(credit), tone: 'green' },
    { label: '不平凭证', value: debit === credit ? '0 张' : '待复核', tone: debit === credit ? 'gray' : 'red' },
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

export function mapLiveCompanyInfoRows(company: Company | undefined): LiveModuleRow[] {
  if (!company) return []

  const status: LiveModuleStatus = company.is_active ? '启用' : '停用'
  const enabledAt = company.enable_year && company.enable_month
    ? `${company.enable_year}-${String(company.enable_month).padStart(2, '0')}`
    : '待设置'
  const rows = [
    ['企业名称', company.name, '企业档案'],
    ['纳税人识别号', company.tax_id || '待补充', '企业档案'],
    ['纳税人资格', company.tax_type || '待设置', '税务初始化'],
    ['会计制度', company.accounting_system || '待设置', '账套设置'],
    ['所属地区', [company.province, company.city].filter(Boolean).join(' ') || '待设置', '企业档案'],
    ['会计行业', company.industry || '待设置', '账套设置'],
    ['启用期间', enabledAt, '账套设置'],
    ['开户行及账号', [company.bank_name, company.bank_account].filter(Boolean).join(' / ') || '待补充', '银行资料'],
  ]

  return rows.map(([field, value, source], index) => ({
    id: `company-${index}`,
    status,
    voucher: '-',
    attachment: source,
    values: {
      field,
      value,
      source,
      required: ['企业名称', '纳税人识别号', '纳税人资格', '会计制度', '启用期间'].includes(field) ? '是' : '否',
      updatedBy: '账套管理员',
      updatedAt: company.updated_at,
    },
  }))
}

export function summarizeLiveCompanyInfo(company: Company | undefined): LiveSummaryItem[] {
  if (!company) {
    return [
      { label: '基础字段', value: '0 项', tone: 'blue' },
      { label: '已完成', value: '0 项', tone: 'green' },
      { label: '待补资料', value: '8 项', tone: 'amber' },
      { label: '关键异常', value: '0 项', tone: 'gray' },
    ]
  }

  const values = [company.name, company.tax_id, company.tax_type, company.accounting_system, company.province, company.city, company.industry, company.bank_name]
  const completed = values.filter(Boolean).length
  return [
    { label: '基础字段', value: '8 项', tone: 'blue' },
    { label: '已完成', value: `${completed} 项`, tone: 'green' },
    { label: '待补资料', value: `${values.length - completed} 项`, tone: values.length === completed ? 'gray' : 'amber' },
    { label: '关键异常', value: company.is_active ? '0 项' : '1 项', tone: company.is_active ? 'gray' : 'red' },
  ]
}

export function mapLiveCompanyBankAccountRows(company: Company | undefined): LiveModuleRow[] {
  if (!company) return []

  const hasBankProfile = Boolean(company.bank_name || company.bank_account)
  return [{
    id: `company-bank-${company.id}`,
    status: hasBankProfile ? '启用' : '待确认',
    voucher: '未关联默认科目',
    attachment: '企业信息',
    values: {
      name: `${company.name}基本账户`,
      type: '银行账户',
      bank: company.bank_name || '未维护开户行',
      number: company.bank_account || '未维护银行账号',
      subject: '未关联默认科目',
      balance: '未接入余额数据',
    },
  }]
}

export function summarizeLiveCompanyBankAccounts(company: Company | undefined): LiveSummaryItem[] {
  const configured = Boolean(company?.bank_name && company?.bank_account)
  return [
    { label: '账户数量', value: company ? '1 个' : '0 个', tone: company ? 'blue' : 'gray' },
    { label: '资料完整', value: configured ? '1 个' : '0 个', tone: configured ? 'green' : 'gray' },
    { label: '待补资料', value: company && !configured ? '1 个' : '0 个', tone: company && !configured ? 'amber' : 'gray' },
    { label: '余额数据', value: '未接入', tone: 'gray' },
  ]
}

export function mapLiveInitialBalanceRows(result: TrialBalanceResult): LiveModuleRow[] {
  const status: LiveModuleStatus = result.is_balanced ? '已通过' : '异常'
  return result.items.map((item) => ({
    id: `initial-${item.account_code}`,
    status,
    voucher: '期初',
    attachment: item.is_detail ? '明细科目' : '汇总科目',
    values: {
      code: item.account_code,
      name: item.account_name,
      aux: item.is_detail ? '明细核算' : '总账核算',
      direction: item.opening_debit > 0 ? '借' : item.opening_credit > 0 ? '贷' : '-',
      debit: currency(item.opening_debit),
      credit: currency(item.opening_credit),
      check: result.is_balanced ? '通过' : '借贷不平',
    },
  }))
}

export function summarizeLiveInitialBalance(result: TrialBalanceResult): LiveSummaryItem[] {
  const difference = Math.abs(result.total_opening_debit - result.total_opening_credit)
  return [
    { label: '科目行数', value: `${result.items.length} 行`, tone: 'blue' },
    { label: '期初借方', value: currency(result.total_opening_debit), tone: 'green' },
    { label: '期初贷方', value: currency(result.total_opening_credit), tone: 'green' },
    { label: '差异', value: currency(difference), tone: result.is_balanced ? 'gray' : 'red' },
  ]
}

export function mapLiveSubjectRows(accounts: AccountCode[]): LiveModuleRow[] {
  return accounts.map((account) => ({
    id: `subject-${account.code}`,
    status: account.is_enabled ? '启用' : '停用',
    voucher: '-',
    attachment: account.is_detail ? '明细科目' : '汇总科目',
    values: {
      code: account.code,
      name: account.name,
      direction: account.normal_balance === 'credit' ? '贷' : '借',
      aux: account.has_auxiliary ? '已启用' : '未启用',
      report: account.account_type || '待设置',
      cashFlow: account.has_quantity ? '待维护' : '-',
    },
  }))
}

export function summarizeLiveSubjects(accounts: AccountCode[]): LiveSummaryItem[] {
  const enabled = accounts.filter((account) => account.is_enabled === 1).length
  const auxiliary = accounts.filter((account) => account.has_auxiliary === 1).length
  return [
    { label: '科目数量', value: `${accounts.length} 个`, tone: 'blue' },
    { label: '启用', value: `${enabled} 个`, tone: 'green' },
    { label: '辅助核算', value: `${auxiliary} 个`, tone: 'amber' },
    { label: '映射异常', value: '待维护', tone: 'gray' },
  ]
}

type LiveAuxiliaryArchiveKind = 'customerArchive' | 'supplierArchive' | 'otherContactArchive' | 'projectArchive' | 'departmentArchive'

const archiveCategoryCodes: Record<LiveAuxiliaryArchiveKind, string> = {
  customerArchive: 'CUST',
  supplierArchive: 'SUPP',
  otherContactArchive: 'EMP',
  projectArchive: 'PROJ',
  departmentArchive: 'DEPT',
}

function archiveValues(kind: LiveAuxiliaryArchiveKind, item: AuxiliaryItem): Record<string, string> {
  const remark = item.remarks || '待补充'
  if (kind === 'customerArchive') {
    return { code: item.code, name: item.name, taxNo: '待补充', bank: '待补充', subject: '1122 应收账款', contract: remark }
  }
  if (kind === 'supplierArchive') {
    return { code: item.code, name: item.name, alias: remark, taxNo: '待补充', subject: '2202 应付账款', taxRate: '待维护' }
  }
  if (kind === 'otherContactArchive') {
    return { code: item.code, name: item.name, type: '职员/其他往来', idNo: '待补充', subject: '1221/2241 待设置', remark }
  }
  if (kind === 'projectArchive') {
    return { code: item.code, name: item.name, owner: '待补充', start: '待补充', subject: '待设置', budget: remark }
  }
  return { code: item.code, name: item.name, parent: '待补充', owner: '待补充', subject: '待设置', people: remark }
}

export function mapLiveAuxiliaryArchiveRows(
  kind: LiveAuxiliaryArchiveKind,
  categories: AuxiliaryCategory[],
  items: AuxiliaryItem[],
): LiveModuleRow[] {
  const category = categories.find((item) => item.code === archiveCategoryCodes[kind])
  if (!category) return []
  return items
    .filter((item) => item.category_id === category.id)
    .map((item) => ({
      id: `auxiliary-${item.id}`,
      status: item.is_enabled ? '启用' : '停用',
      voucher: '-',
      attachment: category.name,
      values: archiveValues(kind, item),
    }))
}

export function summarizeLiveAuxiliaryArchive(
  kind: LiveAuxiliaryArchiveKind,
  categories: AuxiliaryCategory[],
  items: AuxiliaryItem[],
): LiveSummaryItem[] {
  const category = categories.find((item) => item.code === archiveCategoryCodes[kind])
  const scoped = category ? items.filter((item) => item.category_id === category.id) : []
  const enabled = scoped.filter((item) => item.is_enabled === 1).length
  const disabled = scoped.length - enabled
  const labels: Record<LiveAuxiliaryArchiveKind, string> = {
    customerArchive: '客户数量',
    supplierArchive: '供应商',
    otherContactArchive: '其他往来',
    projectArchive: '项目数量',
    departmentArchive: '部门数量',
  }
  return [
    { label: labels[kind], value: `${scoped.length} 个`, tone: 'blue' },
    { label: '启用', value: `${enabled} 个`, tone: 'green' },
    { label: '待补资料', value: `${scoped.filter((item) => !item.remarks).length} 个`, tone: 'amber' },
    { label: '停用', value: `${disabled} 个`, tone: 'gray' },
  ]
}

export function mapLiveAuxiliaryCategoryRows(categories: AuxiliaryCategory[]): LiveModuleRow[] {
  return [...categories]
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
    .map((category) => ({
      id: `auxiliary-category-${category.id}`,
      status: '启用',
      voucher: '-',
      attachment: category.is_system === 1 ? '系统预置' : '账套自定义',
      values: {
        code: category.code,
        name: category.name,
        scope: '账套辅助核算',
        subjects: '未配置关联科目',
        required: '待配置',
        source: category.is_system === 1 ? '系统预置' : '账套自定义',
      },
    }))
}

export function summarizeLiveAuxiliaryCategories(categories: AuxiliaryCategory[]): LiveSummaryItem[] {
  const systemCount = categories.filter((category) => category.is_system === 1).length
  return [
    { label: '辅助类别', value: `${categories.length} 类`, tone: 'blue' },
    { label: '系统预置', value: `${systemCount} 类`, tone: systemCount > 0 ? 'green' : 'gray' },
    { label: '账套自定义', value: `${categories.length - systemCount} 类`, tone: categories.length - systemCount > 0 ? 'amber' : 'gray' },
    { label: '异常', value: '0 类', tone: 'gray' },
  ]
}

export function mapLiveAuxiliaryItemRows(
  categories: AuxiliaryCategory[],
  items: AuxiliaryItem[],
): LiveModuleRow[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  return [...items]
    .sort((left, right) => {
      const leftCategory = categoryById.get(left.category_id)?.name || ''
      const rightCategory = categoryById.get(right.category_id)?.name || ''
      return leftCategory.localeCompare(rightCategory) || left.code.localeCompare(right.code)
    })
    .map((item) => ({
      id: `auxiliary-item-${item.id}`,
      status: item.is_enabled === 1 ? '启用' : '停用',
      voucher: '-',
      attachment: item.remarks || '无备注',
      values: {
        category: categoryById.get(item.category_id)?.name || '未知类别',
        code: item.code,
        name: item.name,
        alias: item.remarks || '未配置别名/备注',
        subject: '未配置默认科目',
        lastUsed: '未记录使用时间',
      },
    }))
}

export function summarizeLiveAuxiliaryItems(items: AuxiliaryItem[]): LiveSummaryItem[] {
  const enabled = items.filter((item) => item.is_enabled === 1).length
  const missingRemark = items.filter((item) => !item.remarks?.trim()).length
  const disabled = items.length - enabled
  return [
    { label: '辅助项目', value: `${items.length} 个`, tone: 'blue' },
    { label: '启用', value: `${enabled} 个`, tone: 'green' },
    { label: '待补资料', value: `${missingRemark} 个`, tone: missingRemark > 0 ? 'amber' : 'gray' },
    { label: '停用', value: `${disabled} 个`, tone: disabled > 0 ? 'red' : 'gray' },
  ]
}

export function mapLiveMatchingRuleRows(rules: MatchingRule[], scope: MatchingRuleScope): LiveModuleRow[] {
  return rules
    .filter((rule) => rule.rule_scope === scope)
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    .map((rule) => ({
      id: `matching-rule-${rule.id}`,
      status: rule.is_enabled === 1 ? '启用' : '停用',
      voucher: rule.voucher_template_id || '未关联模板',
      attachment: rule.created_at,
      values: scope === 'cash_flow'
        ? {
            projectCode: rule.target_account_code || '待维护', projectName: rule.name,
            subject: rule.action_text, keywords: rule.condition_text,
            direction: rule.action_text.includes('流出') ? '流出' : rule.action_text.includes('流入') ? '流入' : '待确认',
            source: '现金流规则', priority: String(rule.priority), hit: String(rule.hit_count),
          }
        : scope === 'invoice'
          ? { name: rule.name, condition: rule.condition_text, template: rule.voucher_template_id || rule.action_text, subject: rule.target_account_code || '待维护', priority: String(rule.priority), hit: String(rule.hit_count) }
          : { name: rule.name, condition: rule.condition_text, action: rule.action_text, subject: rule.target_account_code || '待维护', priority: String(rule.priority), hit: String(rule.hit_count) },
    }))
}

export function summarizeLiveMatchingRules(rules: MatchingRule[]): LiveSummaryItem[] {
  const enabled = rules.filter((rule) => rule.is_enabled === 1).length
  return [
    { label: '规则数量', value: `${rules.length} 条`, tone: 'blue' },
    { label: '启用', value: `${enabled} 条`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '待确认', value: `${rules.length - enabled} 条`, tone: rules.length - enabled > 0 ? 'amber' : 'gray' },
    { label: '本期命中', value: `${rules.reduce((total, rule) => total + rule.hit_count, 0)} 次`, tone: 'gray' },
  ]
}

export function mapLiveAssetCategoryRows(categories: AssetCategory[]): LiveModuleRow[] {
  return categories.map((category) => ({
    id: `asset-category-${category.id}`,
    status: category.is_enabled === 1 ? '启用' : '停用',
    voucher: '-',
    attachment: category.updated_at,
    values: {
      code: category.code,
      name: category.name,
      life: `${Math.max(1, Math.round(category.useful_life_months / 12))} 年`,
      residual: `${(category.residual_rate * 100).toFixed(2).replace(/\\.00$/, '')}%`,
      method: category.depreciation_method,
      subject: `${category.asset_account}/${category.accumulated_depreciation_account}`,
    },
  }))
}

export function summarizeLiveAssetCategories(categories: AssetCategory[]): LiveSummaryItem[] {
  const enabled = categories.filter((category) => category.is_enabled === 1).length
  return [
    { label: '资产类别', value: `${categories.length} 类`, tone: 'blue' },
    { label: '启用', value: `${enabled} 类`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '默认规则', value: `${categories.filter((category) => category.asset_account && category.accumulated_depreciation_account).length} 条`, tone: 'amber' },
    { label: '停用', value: `${categories.length - enabled} 类`, tone: categories.length - enabled > 0 ? 'gray' : 'green' },
  ]
}

export function mapLiveBusinessTagRows(tags: BusinessTag[]): LiveModuleRow[] {
  return tags.map((tag) => ({
    id: `business-tag-${tag.id}`,
    status: tag.is_enabled === 1 ? '启用' : '停用',
    voucher: '-',
    attachment: tag.updated_at,
    values: {
      name: tag.name,
      module: tag.applicable_modules,
      color: tag.color_name,
      rule: tag.auto_rule || '无',
      count: String(tag.usage_count),
      remark: tag.remarks || '-',
    },
  }))
}

export function summarizeLiveBusinessTags(tags: BusinessTag[]): LiveSummaryItem[] {
  const enabled = tags.filter((tag) => tag.is_enabled === 1).length
  return [
    { label: '标签数量', value: `${tags.length} 个`, tone: 'blue' },
    { label: '启用', value: `${enabled} 个`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '本期使用', value: `${tags.reduce((total, tag) => total + tag.usage_count, 0)} 次`, tone: 'amber' },
    { label: '停用', value: `${tags.length - enabled} 个`, tone: tags.length - enabled > 0 ? 'gray' : 'green' },
  ]
}

export function mapLiveCompanyAccountRows(accounts: CompanyAccount[]): LiveModuleRow[] {
  return accounts.map((account) => ({
    id: `company-account-${account.id}`,
    status: account.status,
    voucher: '-',
    attachment: account.attachment_note || '-',
    values: {
      name: account.account_name,
      type: account.account_type,
      bank: account.bank_name || '未维护开户机构',
      number: account.account_number,
      subject: account.subject_code,
      balance: `¥${account.opening_balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
  }))
}

export function summarizeLiveCompanyAccounts(accounts: CompanyAccount[]): LiveSummaryItem[] {
  const enabled = accounts.filter((account) => account.status === '启用').length
  return [
    { label: '账户数量', value: `${accounts.length} 个`, tone: 'blue' },
    { label: '启用', value: `${enabled} 个`, tone: enabled > 0 ? 'green' : 'gray' },
    { label: '默认科目', value: `${accounts.filter((account) => account.subject_code.trim()).length} 个`, tone: 'amber' },
    { label: '停用', value: `${accounts.length - enabled} 个`, tone: accounts.length - enabled > 0 ? 'gray' : 'green' },
  ]
}
