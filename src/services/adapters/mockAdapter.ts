import { accounts, adminSession, companies, periods, seedVouchers } from '../../mocks/seed'
import type {
  AccountingApi,
  BalanceSheet,
  Company,
  ExportInput,
  ExportResult,
  GeneralLedger,
  GeneralLedgerRow,
  IncomeStatement,
  LedgerQuery,
  LoginInput,
  LoginResult,
  PagedResult,
  ReportQuery,
  Session,
  SubsidiaryLedger,
  SubsidiaryLedgerQuery,
  TrialBalance,
  TrialBalanceRow,
  VoucherDetail,
  VoucherEntry,
  VoucherQuery,
  VoucherSummary,
} from '../types'

const UNBALANCED_ERROR = '鍊熻捶涓嶅钩琛?'
const AUDIT_STATUS_ERROR = '鍙兘瀹℃牳鑽夌鍑瘉'

let currentSession: Session | null = null
let voucherStore: VoucherDetail[] = seedVouchers.map(clone)

function clone<T>(value: T): T {
  return structuredClone(value)
}

function requireCompany(companyId: string): Company {
  const company = companies.find((item) => item.id === companyId)
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  return company
}

function requireVoucher(id: string): VoucherDetail {
  const voucher = voucherStore.find((item) => item.id === id)
  if (!voucher) {
    throw new Error(`Voucher not found: ${id}`)
  }

  return voucher
}

function buildVoucherSummary(voucher: VoucherDetail): VoucherSummary {
  return {
    id: voucher.id,
    companyId: voucher.companyId,
    periodId: voucher.periodId,
    voucherDate: voucher.voucherDate,
    voucherNumber: voucher.voucherNumber,
    summary: voucher.summary,
    debitTotal: voucher.debitTotal,
    creditTotal: voucher.creditTotal,
    status: voucher.status,
    createdBy: voucher.createdBy,
  }
}

function calculateTotals(entries: VoucherEntry[]) {
  return entries.reduce(
    (totals, entry) => ({
      debit: totals.debit + entry.debit,
      credit: totals.credit + entry.credit,
    }),
    { debit: 0, credit: 0 },
  )
}

function nextVoucherSequence(companyId: string, periodId: string, voucherWord: string) {
  const count = voucherStore.filter((voucher) => voucher.companyId === companyId && voucher.periodId === periodId).length + 1
  return `${voucherWord}-${String(count).padStart(4, '0')}`
}

function filterVouchers(query: VoucherQuery) {
  return voucherStore
    .filter((voucher) => voucher.companyId === query.companyId)
    .filter((voucher) => !query.periodId || voucher.periodId === query.periodId)
    .filter((voucher) => !query.status || query.status === 'all' || voucher.status === query.status)
    .filter((voucher) => {
      if (!query.keyword) {
        return true
      }

      return [voucher.summary, voucher.voucherNumber, ...voucher.entries.map((entry) => entry.summary)].some((value) =>
        value.includes(query.keyword ?? ''),
      )
    })
}

function buildLedgerRows(query: LedgerQuery): GeneralLedgerRow[] {
  const filtered = voucherStore.filter((voucher) => voucher.companyId === query.companyId && voucher.periodId === query.periodId)

  return accounts.map((account) => {
    let balance = 0
    const entries = filtered.flatMap((voucher) =>
      voucher.entries
        .filter((entry) => entry.accountCode === account.code)
        .map((entry) => {
          balance += account.direction === 'debit' ? entry.debit - entry.credit : entry.credit - entry.debit
          return {
            voucherDate: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            summary: entry.summary,
            debit: entry.debit,
            credit: entry.credit,
            balance,
          }
        }),
    )

    const periodDebit = entries.reduce((total, entry) => total + entry.debit, 0)
    const periodCredit = entries.reduce((total, entry) => total + entry.credit, 0)

    return {
      accountCode: account.code,
      accountName: account.name,
      openingDebit: 0,
      openingCredit: 0,
      periodDebit,
      periodCredit,
      closingDebit: account.direction === 'debit' ? Math.max(balance, 0) : 0,
      closingCredit: account.direction === 'credit' ? Math.max(balance, 0) : 0,
      entries,
    }
  })
}

function buildTrialBalance(query: LedgerQuery): TrialBalance {
  const rows: TrialBalanceRow[] = buildLedgerRows(query).map(({ entries, ...row }) => row)

  return {
    rows,
    totalDebit: rows.reduce((total, row) => total + row.periodDebit, 0),
    totalCredit: rows.reduce((total, row) => total + row.periodCredit, 0),
  }
}

function buildBalanceSheet(query: ReportQuery): BalanceSheet {
  const rows = buildTrialBalance(query).rows
  const cash = rows.filter((row) => row.accountCode.startsWith('1')).reduce((total, row) => total + row.closingDebit, 0)
  const liabilities = rows.filter((row) => row.accountCode.startsWith('2')).reduce((total, row) => total + row.closingCredit, 0)
  const income = rows.filter((row) => row.accountCode.startsWith('6')).reduce((total, row) => total + row.closingCredit, 0)

  return {
    assets: [{ item: 'Cash and bank', lineNumber: '1', amount: cash }],
    liabilitiesAndEquity: [
      { item: 'Liabilities', lineNumber: '20', amount: liabilities },
      { item: 'Current earnings', lineNumber: '30', amount: income },
    ],
  }
}

function buildIncomeStatement(query: ReportQuery): IncomeStatement {
  const income = buildTrialBalance(query).rows
    .filter((row) => row.accountCode.startsWith('6'))
    .reduce((total, row) => total + row.periodCredit - row.periodDebit, 0)

  return {
    rows: [{ item: 'Main business income', lineNumber: '1', amount: income }],
  }
}

function buildExportResult(input: ExportInput): ExportResult {
  return {
    success: true,
    message: `${input.title} exported as ${input.format}`,
  }
}

export const mockAdapter: AccountingApi = {
  async login(input: LoginInput): Promise<LoginResult> {
    if (input.username !== 'admin' || input.password !== 'admin123') {
      throw new Error('Invalid credentials')
    }

    currentSession = clone(adminSession)
    currentSession.token = `${adminSession.token}-${Date.now()}`

    return { session: clone(currentSession) }
  },

  async checkSession() {
    return currentSession ? clone(currentSession) : null
  },

  async listCompanies() {
    return companies.map(clone)
  },

  async selectCompany(companyId) {
    return clone(requireCompany(companyId))
  },

  async listPeriods(companyId) {
    requireCompany(companyId)
    return periods.filter((period) => period.companyId === companyId).map(clone)
  },

  async listVouchers(query): Promise<PagedResult<VoucherSummary>> {
    const filtered = filterVouchers(query)
    const start = (query.page - 1) * query.pageSize
    const items = filtered.slice(start, start + query.pageSize).map((voucher) => buildVoucherSummary(clone(voucher)))

    return {
      items,
      total: filtered.length,
    }
  },

  async getVoucher(id) {
    return clone(requireVoucher(id))
  },

  async saveVoucher(input) {
    requireCompany(input.companyId)
    const totals = calculateTotals(input.entries)
    if (totals.debit !== totals.credit) {
      throw new Error(UNBALANCED_ERROR)
    }

    const summary = input.entries[0]?.summary ?? ''
    const existing = input.id ? voucherStore.find((voucher) => voucher.id === input.id) : undefined
    const voucher: VoucherDetail = {
      id: existing?.id ?? `voucher-${crypto.randomUUID()}`,
      companyId: input.companyId,
      periodId: input.periodId,
      voucherDate: input.voucherDate,
      voucherNumber: existing?.voucherNumber ?? nextVoucherSequence(input.companyId, input.periodId, input.voucherWord),
      voucherWord: input.voucherWord,
      summary,
      debitTotal: totals.debit,
      creditTotal: totals.credit,
      status: existing?.status ?? 'draft',
      createdBy: existing?.createdBy ?? currentSession?.user.username ?? 'admin',
      attachmentCount: input.attachmentCount,
      entries: input.entries.map(clone),
    }

    if (existing) {
      voucherStore = voucherStore.map((item) => (item.id === existing.id ? voucher : item))
    } else {
      voucherStore = [...voucherStore, voucher]
    }

    return clone(voucher)
  },

  async auditVoucher(id) {
    const voucher = requireVoucher(id)
    if (voucher.status !== 'draft') {
      throw new Error(AUDIT_STATUS_ERROR)
    }

    voucher.status = 'approved'
  },

  async reverseAuditVoucher(id) {
    const voucher = requireVoucher(id)
    if (voucher.status !== 'approved') {
      throw new Error('Only approved vouchers can reverse audit')
    }

    voucher.status = 'draft'
  },

  async createRedReversal(id) {
    const voucher = requireVoucher(id)
    const reversal = await this.saveVoucher({
      companyId: voucher.companyId,
      periodId: voucher.periodId,
      voucherDate: voucher.voucherDate,
      voucherWord: voucher.voucherWord,
      attachmentCount: voucher.attachmentCount,
      entries: voucher.entries.map((entry) => ({
        ...entry,
        id: `reversal-${entry.id}`,
        debit: entry.credit,
        credit: entry.debit,
      })),
    })

    reversal.status = 'approved'
    voucherStore = voucherStore.map((item) => (item.id === reversal.id ? clone(reversal) : item))

    return reversal
  },

  async getTrialBalance(query) {
    return buildTrialBalance(query)
  },

  async getGeneralLedger(query): Promise<GeneralLedger> {
    return buildLedgerRows(query)
  },

  async getSubsidiaryLedger(query: SubsidiaryLedgerQuery): Promise<SubsidiaryLedger> {
    const rows = buildLedgerRows(query)
    return query.accountCode ? rows.filter((row) => row.accountCode === query.accountCode) : rows
  },

  async getBalanceSheet(query) {
    return buildBalanceSheet(query)
  },

  async getIncomeStatement(query) {
    return buildIncomeStatement(query)
  },

  async exportDocument(input) {
    return buildExportResult(input)
  },
}
