export type VoucherStatus = 'draft' | 'approved' | 'reversed'

export interface LoginInput {
  username: string
  password: string
}

export interface User {
  id: string
  username: string
  realName: string
  role: string
}

export interface Session {
  token: string
  user: User
}

export interface LoginResult {
  session: Session
}

export interface Company {
  id: string
  code: string
  name: string
  taxId: string
  accountingSystem: 'small_enterprise' | 'enterprise' | 'non_profit'
  currentPeriodId: string
  status: 'active' | 'archived'
}

export interface AccountingPeriod {
  id: string
  companyId: string
  year: number
  month: number
  status: 'open' | 'closed'
}

export interface VoucherEntry {
  id: string
  summary: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export interface SaveVoucherInput {
  id?: string
  companyId: string
  periodId: string
  voucherDate: string
  voucherWord: string
  attachmentCount: number
  entries: VoucherEntry[]
}

export interface VoucherSummary {
  id: string
  companyId: string
  periodId: string
  voucherDate: string
  voucherNumber: string
  summary: string
  debitTotal: number
  creditTotal: number
  status: VoucherStatus
  createdBy: string
}

export interface VoucherDetail extends VoucherSummary {
  voucherWord: string
  attachmentCount: number
  entries: VoucherEntry[]
}

export interface PagedResult<T> {
  items: T[]
  total: number
}

export interface VoucherQuery {
  companyId: string
  periodId?: string
  status?: VoucherStatus | 'all'
  keyword?: string
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

export interface LedgerQuery {
  companyId: string
  periodId: string
}

export interface SubsidiaryLedgerQuery extends LedgerQuery {
  accountCode?: string
}

export interface ReportQuery {
  companyId: string
  periodId: string
}

export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export interface TrialBalance {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
}

export interface LedgerEntry {
  voucherDate: string
  voucherNumber: string
  summary: string
  debit: number
  credit: number
  balance: number
}

export interface GeneralLedgerRow extends TrialBalanceRow {
  entries: LedgerEntry[]
}

export type GeneralLedger = GeneralLedgerRow[]
export type SubsidiaryLedger = GeneralLedgerRow[]

export interface ReportRow {
  item: string
  lineNumber: string
  amount: number
}

export interface BalanceSheet {
  assets: ReportRow[]
  liabilitiesAndEquity: ReportRow[]
}

export interface IncomeStatement {
  rows: ReportRow[]
}

export interface ExportInput {
  type: 'voucher' | 'ledger' | 'report'
  format: 'excel' | 'pdf'
  title: string
}

export interface ExportResult {
  success: true
  message: string
}

export interface AccountingApi {
  login(input: LoginInput): Promise<LoginResult>
  checkSession(): Promise<Session | null>
  listCompanies(): Promise<Company[]>
  selectCompany(companyId: string): Promise<Company>
  listPeriods(companyId: string): Promise<AccountingPeriod[]>
  listVouchers(query: VoucherQuery): Promise<PagedResult<VoucherSummary>>
  getVoucher(id: string): Promise<VoucherDetail>
  saveVoucher(input: SaveVoucherInput): Promise<VoucherDetail>
  auditVoucher(id: string): Promise<void>
  reverseAuditVoucher(id: string): Promise<void>
  createRedReversal(id: string): Promise<VoucherDetail>
  getTrialBalance(query: LedgerQuery): Promise<TrialBalance>
  getGeneralLedger(query: LedgerQuery): Promise<GeneralLedger>
  getSubsidiaryLedger(query: SubsidiaryLedgerQuery): Promise<SubsidiaryLedger>
  getBalanceSheet(query: ReportQuery): Promise<BalanceSheet>
  getIncomeStatement(query: ReportQuery): Promise<IncomeStatement>
  exportDocument(input: ExportInput): Promise<ExportResult>
}
