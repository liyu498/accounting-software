/**
 * Tauri API wrapper - connects to actual Rust backend via invoke()
 */

import { invoke } from './tauri'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ApiMeta {
  total: number
  page: number
  limit: number
}

export interface LocalBackupSnapshot {
  id: string
  fileName: string
  createdAt: string
  sizeBytes: number
}

export interface LocalBackupVerification {
  id: string
  fileName: string
  valid: boolean
  message: string
}

export interface Employee {
  id: string
  companyId: string
  employeeCode: string
  name: string
  idNo: string | null
  department: string | null
  position: string | null
  mobile: string | null
  entryDate: string | null
  employmentStatus: string
  createdAt: string
  updatedAt: string
}

export interface PayrollRecord {
  id: string
  companyId: string
  employeeId: string
  employeeName: string
  period: string
  baseSalary: number
  bonus: number
  taxAmount: number
  socialPersonal: number
  netSalary: number
  status: string
  createdAt: string
  updatedAt: string
}
export interface SocialSecurityRecord { id: string; companyId: string; employeeId: string; employeeName: string; period: string; city: string | null; contributionBase: number; companyAmount: number; personalAmount: number; fundAmount: number; status: string; createdAt: string; updatedAt: string }
export interface SpecialDeductionRecord { id: string; companyId: string; employeeId: string; employeeName: string; deductionType: string; startMonth: string; endMonth: string | null; monthlyAmount: number; source: string; status: string; createdAt: string; updatedAt: string }
export interface BankTransaction { id: string; companyId: string; period: string; accountName: string; serialNo: string; transactionDate: string; counterparty: string | null; summary: string | null; incomeAmount: number; expenseAmount: number; balance: number | null; receiptStatus: string; matchResult: string | null; status: string; createdAt: string; updatedAt: string }
export interface DocumentRecord { id: string; companyId: string; period: string; businessDate: string; documentCode: string; businessType: string; partner: string | null; amount: number; owner: string | null; attachmentStatus: string; status: string; createdAt: string; updatedAt: string }
export interface AccountTransfer { id: string; companyId: string; period: string; transferDate: string; fromAccount: string; toAccount: string; amount: number; fee: number; serialNo: string | null; status: string; createdAt: string; updatedAt: string }
export interface FixedAsset { id: string; companyId: string; period: string; assetCode: string; assetName: string; category: string; startDate: string; originalValue: number; usefulLifeMonths: number; residualRate: number; sourceDocument: string | null; status: string; createdAt: string; updatedAt: string }
export interface InventoryMovement { id: string; companyId: string; period: string; movementDate: string; billNo: string; movementType: string; inventoryName: string; warehouse: string; counterparty: string | null; unit: string; quantity: number; amount: number; sourceDocument: string | null; status: string; createdAt: string; updatedAt: string }
export interface InventoryItem { id: string; companyId: string; itemCode: string; itemName: string; specification: string | null; unit: string; taxRate: number | null; defaultSubject: string | null; status: string; createdAt: string; updatedAt: string }
export interface MeasurementUnit { id:string; companyId:string; unitName:string; unitGroup:string|null; baseUnit:string|null; conversionRate:number; precisionDigits:number; remark:string|null; status:string; createdAt:string; updatedAt:string }

export interface PaginatedResponse<T> extends ApiResponse<T> {
  meta?: ApiMeta
}

// ============================================
// Types (camelCase to match frontend stores)
// ============================================
export interface User {
  id: string
  username: string
  realName: string
  role: string
}

export interface Company {
  id: string
  name: string
  accountingSystem: string
  createdAt: string
  updatedAt: string
}

export interface Subject {
  code: string
  name: string
  type: string
  level: number
  parentCode: string | null
}

export interface Voucher {
  id: string
  companyId: string | null
  number: string
  date: string
  summary: string | null
  amount: number
  status: 'draft' | 'approved' | 'posted' | 'reversed'
  attachmentCount: number
  createdBy: string | null
  createdAt: string | null
  modifiedBy: string | null
  modifiedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  entries?: VoucherEntry[]
}

export interface VoucherEntry {
  id: string
  voucherId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  summary: string | null
  entryIndex: number
}

export interface VoucherWithEntries extends Voucher {
  entries: VoucherEntry[]
}

export interface Invoice {
  id: string
  companyId: string | null
  invoiceType: 'input' | 'output'
  invoiceNo: string
  invoiceCode: string | null
  invoiceDate: string
  amount: number
  taxAmount: number
  totalAmount: number
  taxRate: number | null
  sellerName: string | null
  sellerTaxId: string | null
  buyerName: string | null
  buyerTaxId: string | null
  status: 'pending' | 'verified' | 'matched' | 'rejected'
  voucherId: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export interface AgencyServiceContract {
  id: string
  companyId: string
  companyName: string | null
  contractNo: string
  servicePackage: string
  serviceStart: string
  serviceEnd: string
  monthlyFee: number
  renewalStatus: string
  owner: string | null
  archiveStatus: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface AgencyFeeCollection {
  id: string
  companyId: string
  companyName: string | null
  period: string
  receivableAmount: number
  receivedAmount: number
  arrearsAmount: number
  invoiceStatus: string
  paymentStatus: string
  collector: string | null
  lastFollowUp: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface AgencyCollaborationItem {
  id: string
  companyId: string
  companyName: string | null
  todoTitle: string
  materialType: string | null
  customerContact: string | null
  reminderCount: number
  lastContactAt: string | null
  replyStatus: string
  owner: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface AgencyDeliveryTicket {
  id: string
  companyId: string
  companyName: string | null
  ticketNo: string
  taskName: string
  period: string
  currentStage: string
  slaStatus: string
  owner: string | null
  deliveryStatus: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface AgencyBatchTask {
  id: string
  taskType: string
  taskName: string
  period: string
  customerScope: string
  status: string
  progressCurrent: number
  progressTotal: number | null
  resultSummary: string | null
  riskLevel: string
  operator: string | null
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}

export interface AgencyHealthCheckItem {
  id: string
  companyId: string
  companyName: string | null
  moduleName: string
  riskMessage: string
  riskLevel: string
  owner: string | null
  resolutionStatus: string
}

export interface AgencyOperationOverview {
  serviceContracts: number
  expiringContracts: number
  receivableAmount: number
  arrearsAmount: number
  pendingCollaboration: number
  overdueCollaboration: number
  openTickets: number
  blockedTickets: number
}

export interface AutomationJob {
  id: string
  companyId: string
  companyName: string | null
  period: string | null
  jobType: string
  sourceModule: string
  sourceId: string | null
  sourceFile: string | null
  status: string
  confidence: number | null
  resultSummary: string | null
  riskLevel: string
  reviewer: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TaxDeclarationTask {
  id: string
  companyId: string
  companyName: string | null
  period: string
  taxType: string
  formName: string
  collectStatus: string
  validationStatus: string
  declarationStatus: string
  sourceSnapshot: string | null
  taxableAmount: number
  deductionAmount: number
  payableAmount: number
  riskCount: number
  adapterCode: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  receiptNo: string | null
  createdAt: string
  updatedAt: string
}

export interface AdapterAuthorization {
  id: string
  companyId: string
  companyName: string | null
  adapterType: string
  adapterCode: string
  region: string | null
  authStatus: string
  accountMask: string | null
  loginIdentity: string | null
  capabilityScope: string | null
  lastCheckedAt: string | null
  expiresAt: string | null
  riskMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface OperationAuditLog {
  id: string
  companyId: string | null
  companyName: string | null
  moduleName: string
  action: string
  objectRef: string | null
  riskLevel: string
  result: string
  detail: string | null
  operator: string | null
  createdAt: string
}

// ============================================
// Auth API
// ============================================
export const authApi = {
  login: async (username: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> => {
    try {
      const result = await invoke('login', { request: { username, password } }) as { success: boolean; token?: string; user?: User; error?: string }
      if (result.success && result.user) {
        return { success: true, data: { token: result.token!, user: result.user } }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  logout: async (): Promise<ApiResponse<void>> => {
    try {
      await invoke('logout')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  checkAuth: async (): Promise<ApiResponse<{ isAuthenticated: boolean; user?: User }>> => {
    try {
      const result = await invoke('check', { token: null }) as { is_authenticated: boolean; user?: User }
      return {
        success: true,
        data: { isAuthenticated: result.is_authenticated, user: result.user }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

// ============================================
// Company API (账套)
// ============================================
export const companyApi = {
  getAll: async (): Promise<ApiResponse<Company[]>> => {
    try {
      const result = await invoke('get_companies') as Company[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  get: async (id: string): Promise<ApiResponse<Company | null>> => {
    try {
      const result = await invoke('get_company', { id }) as Company | null
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  create: async (company: { name: string; accountingSystem?: string }): Promise<ApiResponse<Company>> => {
    try {
      const input = { name: company.name, accounting_system: company.accountingSystem }
      const result = await invoke('create_company', { input }) as Company
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  update: async (id: string, company: { name: string; accountingSystem?: string }): Promise<ApiResponse<Company>> => {
    try {
      const input = { name: company.name, accounting_system: company.accountingSystem }
      const result = await invoke('update_company', { id, input }) as Company
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('delete_company', { id })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

// ============================================
// Subject API (会计科目)
// ============================================
export const subjectApi = {
  getAll: async (companyId: string): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = await invoke('get_subjects', { companyId }) as Subject[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  get: async (code: string, companyId: string): Promise<ApiResponse<Subject | null>> => {
    try {
      const result = await invoke('get_subject', { code, companyId }) as Subject | null
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getByType: async (type: string, companyId: string): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = await invoke('get_subjects_by_type', { type_: type, companyId }) as Subject[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  create: async (subject: { code: string; name: string; type: string; level: number; parentCode?: string }, companyId: string): Promise<ApiResponse<Subject>> => {
    try {
      const input = { code: subject.code, name: subject.name, type_: subject.type, level: subject.level, parent_code: subject.parentCode, company_id: companyId }
      const result = await invoke('create_subject', { input }) as Subject
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  update: async (code: string, subject: { code: string; name: string; type: string; level: number; parentCode?: string }, companyId: string): Promise<ApiResponse<Subject>> => {
    try {
      const input = { code: subject.code, name: subject.name, type_: subject.type, level: subject.level, parent_code: subject.parentCode, company_id: companyId }
      const result = await invoke('update_subject', { code, companyId, input }) as Subject
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  delete: async (code: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('delete_subject', { code, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  search: async (keyword: string, companyId: string): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = await invoke('search_subjects', { keyword, companyId }) as Subject[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

// ============================================
// Voucher API (会计凭证)
// ============================================
export const voucherApi = {
  getAll: async (companyId?: string): Promise<ApiResponse<Voucher[]>> => {
    try {
      const result = await invoke('get_vouchers', { companyId }) as Voucher[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  get: async (id: string): Promise<ApiResponse<VoucherWithEntries | null>> => {
    try {
      const result = await invoke('get_voucher', { id }) as VoucherWithEntries | null
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  create: async (voucher: {
    companyId?: string
    number: string
    date: string
    summary?: string
    amount: number
    status?: string
    attachmentCount?: number
    createdBy?: string
    entries: Array<{
      accountCode: string
      accountName: string
      debit?: number
      credit?: number
      summary?: string
    }>
  }): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const input = {
        account_id: voucher.companyId,
        number: voucher.number,
        date: voucher.date,
        summary: voucher.summary,
        amount: voucher.amount,
        status: voucher.status,
        attachment_count: voucher.attachmentCount,
        created_by: voucher.createdBy,
        entries: voucher.entries.map((e, i) => ({
          account_code: e.accountCode,
          account_name: e.accountName,
          debit: e.debit ?? 0,
          credit: e.credit ?? 0,
          entry_summary: e.summary,
          entry_index: i
        }))
      }
      const result = await invoke('create_voucher', { input }) as VoucherWithEntries
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  update: async (id: string, voucher: {
    number?: string
    date?: string
    summary?: string
    amount?: number
    status?: string
    attachmentCount?: number
    modifiedBy?: string
    entries?: Array<{
      accountCode: string
      accountName: string
      debit?: number
      credit?: number
      summary?: string
    }>
  }): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const input: Record<string, unknown> = {}
      if (voucher.number !== undefined) input.number = voucher.number
      if (voucher.date !== undefined) input.date = voucher.date
      if (voucher.summary !== undefined) input.summary = voucher.summary
      if (voucher.amount !== undefined) input.amount = voucher.amount
      if (voucher.status !== undefined) input.status = voucher.status
      if (voucher.attachmentCount !== undefined) input.attachment_count = voucher.attachmentCount
      if (voucher.modifiedBy !== undefined) input.modified_by = voucher.modifiedBy
      if (voucher.entries) {
        input.entries = voucher.entries.map((e) => ({
          account_code: e.accountCode,
          account_name: e.accountName,
          debit: e.debit ?? 0,
          credit: e.credit ?? 0,
          entry_summary: e.summary
        }))
      }
      const result = await invoke('update_voucher', { id, input, companyId: undefined }) as VoucherWithEntries
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('delete_voucher', { id })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  approve: async (id: string, approvedBy: string): Promise<ApiResponse<Voucher>> => {
    try {
      const result = await invoke('approve_voucher', { id, approvedBy }) as Voucher
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  reverseApprove: async (id: string): Promise<ApiResponse<Voucher>> => {
    try {
      const result = await invoke('reverse_approve_voucher', { id }) as Voucher
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  reverse: async (id: string): Promise<ApiResponse<Voucher>> => {
    try {
      const result = await invoke('reverse_voucher', { id }) as Voucher
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  copy: async (id: string): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const result = await invoke('copy_voucher', { id }) as VoucherWithEntries
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getEntries: async (voucherId: string): Promise<ApiResponse<VoucherEntry[]>> => {
    try {
      const result = await invoke('get_voucher_entries', { voucherId }) as VoucherEntry[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  reorganizeNumbers: async (periodId: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('reorganize_voucher_numbers', { periodId, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  batchApprove: async (ids: string[], approvedBy: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('batch_approve_vouchers', { ids, approvedBy, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  batchReverseApprove: async (ids: string[], companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('batch_reverse_approve_vouchers', { ids, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

// ============================================
// Invoice API (发票)
// ============================================
export const invoiceApi = {
  getAll: async (companyId?: string, invoiceType?: string): Promise<ApiResponse<Invoice[]>> => {
    try {
      const result = await invoke('get_invoices', { companyId, invoiceType }) as Invoice[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  get: async (id: string, companyId: string): Promise<ApiResponse<Invoice | null>> => {
    try {
      const result = await invoke('get_invoice', { id, companyId }) as Invoice | null
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  create: async (invoice: {
    companyId?: string
    invoiceType: 'input' | 'output'
    invoiceNo: string
    invoiceCode?: string
    invoiceDate: string
    amount: number
    taxAmount: number
    taxRate?: number
    sellerName?: string
    sellerTaxId?: string
    buyerName?: string
    buyerTaxId?: string
    remarks?: string
  }): Promise<ApiResponse<Invoice>> => {
    try {
      const input = {
        company_id: invoice.companyId,
        invoice_type: invoice.invoiceType,
        invoice_no: invoice.invoiceNo,
        invoice_code: invoice.invoiceCode,
        invoice_date: invoice.invoiceDate,
        amount: invoice.amount,
        tax_amount: invoice.taxAmount,
        tax_rate: invoice.taxRate,
        seller_name: invoice.sellerName,
        seller_tax_id: invoice.sellerTaxId,
        buyer_name: invoice.buyerName,
        buyer_tax_id: invoice.buyerTaxId,
        remarks: invoice.remarks
      }
      const result = await invoke('create_invoice', { input }) as Invoice
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  update: async (id: string, invoice: {
    companyId?: string
    invoiceType?: string
    invoiceNo?: string
    invoiceCode?: string
    invoiceDate?: string
    amount?: number
    taxAmount?: number
    taxRate?: number
    sellerName?: string
    sellerTaxId?: string
    buyerName?: string
    buyerTaxId?: string
    status?: string
    voucherId?: string
    remarks?: string
  }): Promise<ApiResponse<Invoice>> => {
    try {
      const input: Record<string, unknown> = {}
      if (invoice.companyId) input.company_id = invoice.companyId
      if (invoice.invoiceType) input.invoice_type = invoice.invoiceType
      if (invoice.invoiceNo) input.invoice_no = invoice.invoiceNo
      if (invoice.invoiceCode) input.invoice_code = invoice.invoiceCode
      if (invoice.invoiceDate) input.invoice_date = invoice.invoiceDate
      if (invoice.amount) input.amount = invoice.amount
      if (invoice.taxAmount) input.tax_amount = invoice.taxAmount
      if (invoice.taxRate) input.tax_rate = invoice.taxRate
      if (invoice.sellerName) input.seller_name = invoice.sellerName
      if (invoice.sellerTaxId) input.seller_tax_id = invoice.sellerTaxId
      if (invoice.buyerName) input.buyer_name = invoice.buyerName
      if (invoice.buyerTaxId) input.buyer_tax_id = invoice.buyerTaxId
      if (invoice.status) input.status = invoice.status
      if (invoice.voucherId) input.voucher_id = invoice.voucherId
      if (invoice.remarks) input.remarks = invoice.remarks

      const result = await invoke('update_invoice', { id, input }) as Invoice
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  delete: async (id: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('delete_invoice', { id, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  matchToVoucher: async (invoiceId: string, voucherId: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke('match_invoice_to_voucher', { invoiceId, voucherId, companyId })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getByVoucher: async (voucherId: string, companyId: string): Promise<ApiResponse<Invoice[]>> => {
    try {
      const result = await invoke('get_invoices_by_voucher', { voucherId, companyId }) as Invoice[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

type RawAgencyServiceContract = {
  id: string
  company_id: string
  company_name: string | null
  contract_no: string
  service_package: string
  service_start: string
  service_end: string
  monthly_fee: number
  renewal_status: string
  owner: string | null
  archive_status: string
  status: string
  created_at: string
  updated_at: string
}

type RawAgencyFeeCollection = {
  id: string
  company_id: string
  company_name: string | null
  period: string
  receivable_amount: number
  received_amount: number
  arrears_amount: number
  invoice_status: string
  payment_status: string
  collector: string | null
  last_follow_up: string | null
  status: string
  created_at: string
  updated_at: string
}

type RawAgencyCollaborationItem = {
  id: string
  company_id: string
  company_name: string | null
  todo_title: string
  material_type: string | null
  customer_contact: string | null
  reminder_count: number
  last_contact_at: string | null
  reply_status: string
  owner: string | null
  status: string
  created_at: string
  updated_at: string
}

type RawAgencyDeliveryTicket = {
  id: string
  company_id: string
  company_name: string | null
  ticket_no: string
  task_name: string
  period: string
  current_stage: string
  sla_status: string
  owner: string | null
  delivery_status: string
  status: string
  created_at: string
  updated_at: string
}

type RawAgencyBatchTask = {
  id: string
  task_type: string
  task_name: string
  period: string
  customer_scope: string
  status: string
  progress_current: number
  progress_total: number | null
  result_summary: string | null
  risk_level: string
  operator: string | null
  requires_approval: number
  created_at: string
  updated_at: string
}

type RawAgencyHealthCheckItem = {
  id: string
  company_id: string
  company_name: string | null
  module_name: string
  risk_message: string
  risk_level: string
  owner: string | null
  resolution_status: string
}

type RawAgencyOperationOverview = {
  service_contracts: number
  expiring_contracts: number
  receivable_amount: number
  arrears_amount: number
  pending_collaboration: number
  overdue_collaboration: number
  open_tickets: number
  blocked_tickets: number
}

type RawAutomationJob = {
  id: string
  company_id: string
  company_name: string | null
  period: string | null
  job_type: string
  source_module: string
  source_id: string | null
  source_file: string | null
  status: string
  confidence: number | null
  result_summary: string | null
  risk_level: string
  reviewer: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type RawTaxDeclarationTask = {
  id: string
  company_id: string
  company_name: string | null
  period: string
  tax_type: string
  form_name: string
  collect_status: string
  validation_status: string
  declaration_status: string
  source_snapshot: string | null
  taxable_amount: number
  deduction_amount: number
  payable_amount: number
  risk_count: number
  adapter_code: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  receipt_no: string | null
  created_at: string
  updated_at: string
}

type RawAdapterAuthorization = {
  id: string
  company_id: string
  company_name: string | null
  adapter_type: string
  adapter_code: string
  region: string | null
  auth_status: string
  account_mask: string | null
  login_identity: string | null
  capability_scope: string | null
  last_checked_at: string | null
  expires_at: string | null
  risk_message: string | null
  created_at: string
  updated_at: string
}

type RawOperationAuditLog = {
  id: string
  company_id: string | null
  company_name: string | null
  module_name: string
  action: string
  object_ref: string | null
  risk_level: string
  result: string
  detail: string | null
  operator: string | null
  created_at: string
}

type RawEmployee = {
  id: string
  company_id: string
  employee_code: string
  name: string
  id_no: string | null
  department: string | null
  position: string | null
  mobile: string | null
  entry_date: string | null
  employment_status: string
  created_at: string
  updated_at: string
}

type RawPayrollRecord = {
  id: string
  company_id: string
  employee_id: string
  employee_name: string
  period: string
  base_salary: number
  bonus: number
  tax_amount: number
  social_personal: number
  net_salary: number
  status: string
  created_at: string
  updated_at: string
}
type RawSocialSecurityRecord = { id: string; company_id: string; employee_id: string; employee_name: string; period: string; city: string | null; contribution_base: number; company_amount: number; personal_amount: number; fund_amount: number; status: string; created_at: string; updated_at: string }
type RawSpecialDeductionRecord = { id: string; company_id: string; employee_id: string; employee_name: string; deduction_type: string; start_month: string; end_month: string | null; monthly_amount: number; source: string; status: string; created_at: string; updated_at: string }
type RawBankTransaction = { id: string; company_id: string; period: string; account_name: string; serial_no: string; transaction_date: string; counterparty: string | null; summary: string | null; income_amount: number; expense_amount: number; balance: number | null; receipt_status: string; match_result: string | null; status: string; created_at: string; updated_at: string }
type RawDocumentRecord = { id: string; company_id: string; period: string; business_date: string; document_code: string; business_type: string; partner: string | null; amount: number; owner: string | null; attachment_status: string; status: string; created_at: string; updated_at: string }
type RawAccountTransfer = { id: string; company_id: string; period: string; transfer_date: string; from_account: string; to_account: string; amount: number; fee: number; serial_no: string | null; status: string; created_at: string; updated_at: string }
type RawFixedAsset = { id: string; company_id: string; period: string; asset_code: string; asset_name: string; category: string; start_date: string; original_value: number; useful_life_months: number; residual_rate: number; source_document: string | null; status: string; created_at: string; updated_at: string }
type RawInventoryMovement = { id: string; company_id: string; period: string; movement_date: string; bill_no: string; movement_type: string; inventory_name: string; warehouse: string; counterparty: string | null; unit: string; quantity: number; amount: number; source_document: string | null; status: string; created_at: string; updated_at: string }
type RawInventoryItem = { id: string; company_id: string; item_code: string; item_name: string; specification: string | null; unit: string; tax_rate: number | null; default_subject: string | null; status: string; created_at: string; updated_at: string }
type RawMeasurementUnit = { id:string; company_id:string; unit_name:string; unit_group:string|null; base_unit:string|null; conversion_rate:number; precision_digits:number; remark:string|null; status:string; created_at:string; updated_at:string }

const mapAgencyServiceContract = (item: RawAgencyServiceContract): AgencyServiceContract => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  contractNo: item.contract_no,
  servicePackage: item.service_package,
  serviceStart: item.service_start,
  serviceEnd: item.service_end,
  monthlyFee: item.monthly_fee,
  renewalStatus: item.renewal_status,
  owner: item.owner,
  archiveStatus: item.archive_status,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAgencyFeeCollection = (item: RawAgencyFeeCollection): AgencyFeeCollection => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  receivableAmount: item.receivable_amount,
  receivedAmount: item.received_amount,
  arrearsAmount: item.arrears_amount,
  invoiceStatus: item.invoice_status,
  paymentStatus: item.payment_status,
  collector: item.collector,
  lastFollowUp: item.last_follow_up,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAgencyCollaborationItem = (item: RawAgencyCollaborationItem): AgencyCollaborationItem => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  todoTitle: item.todo_title,
  materialType: item.material_type,
  customerContact: item.customer_contact,
  reminderCount: item.reminder_count,
  lastContactAt: item.last_contact_at,
  replyStatus: item.reply_status,
  owner: item.owner,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAgencyDeliveryTicket = (item: RawAgencyDeliveryTicket): AgencyDeliveryTicket => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  ticketNo: item.ticket_no,
  taskName: item.task_name,
  period: item.period,
  currentStage: item.current_stage,
  slaStatus: item.sla_status,
  owner: item.owner,
  deliveryStatus: item.delivery_status,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAgencyBatchTask = (item: RawAgencyBatchTask): AgencyBatchTask => ({
  id: item.id,
  taskType: item.task_type,
  taskName: item.task_name,
  period: item.period,
  customerScope: item.customer_scope,
  status: item.status,
  progressCurrent: item.progress_current,
  progressTotal: item.progress_total,
  resultSummary: item.result_summary,
  riskLevel: item.risk_level,
  operator: item.operator,
  requiresApproval: item.requires_approval === 1,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAgencyHealthCheckItem = (item: RawAgencyHealthCheckItem): AgencyHealthCheckItem => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  moduleName: item.module_name,
  riskMessage: item.risk_message,
  riskLevel: item.risk_level,
  owner: item.owner,
  resolutionStatus: item.resolution_status,
})

const mapAgencyOperationOverview = (item: RawAgencyOperationOverview): AgencyOperationOverview => ({
  serviceContracts: item.service_contracts,
  expiringContracts: item.expiring_contracts,
  receivableAmount: item.receivable_amount,
  arrearsAmount: item.arrears_amount,
  pendingCollaboration: item.pending_collaboration,
  overdueCollaboration: item.overdue_collaboration,
  openTickets: item.open_tickets,
  blockedTickets: item.blocked_tickets,
})

const mapAutomationJob = (item: RawAutomationJob): AutomationJob => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  jobType: item.job_type,
  sourceModule: item.source_module,
  sourceId: item.source_id,
  sourceFile: item.source_file,
  status: item.status,
  confidence: item.confidence,
  resultSummary: item.result_summary,
  riskLevel: item.risk_level,
  reviewer: item.reviewer,
  createdBy: item.created_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapTaxDeclarationTask = (item: RawTaxDeclarationTask): TaxDeclarationTask => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  taxType: item.tax_type,
  formName: item.form_name,
  collectStatus: item.collect_status,
  validationStatus: item.validation_status,
  declarationStatus: item.declaration_status,
  sourceSnapshot: item.source_snapshot,
  taxableAmount: item.taxable_amount,
  deductionAmount: item.deduction_amount,
  payableAmount: item.payable_amount,
  riskCount: item.risk_count,
  adapterCode: item.adapter_code,
  confirmedBy: item.confirmed_by,
  confirmedAt: item.confirmed_at,
  receiptNo: item.receipt_no,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapAdapterAuthorization = (item: RawAdapterAuthorization): AdapterAuthorization => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  adapterType: item.adapter_type,
  adapterCode: item.adapter_code,
  region: item.region,
  authStatus: item.auth_status,
  accountMask: item.account_mask,
  loginIdentity: item.login_identity,
  capabilityScope: item.capability_scope,
  lastCheckedAt: item.last_checked_at,
  expiresAt: item.expires_at,
  riskMessage: item.risk_message,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapOperationAuditLog = (item: RawOperationAuditLog): OperationAuditLog => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  moduleName: item.module_name,
  action: item.action,
  objectRef: item.object_ref,
  riskLevel: item.risk_level,
  result: item.result,
  detail: item.detail,
  operator: item.operator,
  createdAt: item.created_at,
})

const mapEmployee = (item: RawEmployee): Employee => ({
  id: item.id,
  companyId: item.company_id,
  employeeCode: item.employee_code,
  name: item.name,
  idNo: item.id_no,
  department: item.department,
  position: item.position,
  mobile: item.mobile,
  entryDate: item.entry_date,
  employmentStatus: item.employment_status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const mapPayrollRecord = (item: RawPayrollRecord): PayrollRecord => ({
  id: item.id,
  companyId: item.company_id,
  employeeId: item.employee_id,
  employeeName: item.employee_name,
  period: item.period,
  baseSalary: item.base_salary,
  bonus: item.bonus,
  taxAmount: item.tax_amount,
  socialPersonal: item.social_personal,
  netSalary: item.net_salary,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})
const mapSocialSecurityRecord = (item: RawSocialSecurityRecord): SocialSecurityRecord => ({ id: item.id, companyId: item.company_id, employeeId: item.employee_id, employeeName: item.employee_name, period: item.period, city: item.city, contributionBase: item.contribution_base, companyAmount: item.company_amount, personalAmount: item.personal_amount, fundAmount: item.fund_amount, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapSpecialDeductionRecord = (item: RawSpecialDeductionRecord): SpecialDeductionRecord => ({ id: item.id, companyId: item.company_id, employeeId: item.employee_id, employeeName: item.employee_name, deductionType: item.deduction_type, startMonth: item.start_month, endMonth: item.end_month, monthlyAmount: item.monthly_amount, source: item.source, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapBankTransaction = (item: RawBankTransaction): BankTransaction => ({ id: item.id, companyId: item.company_id, period: item.period, accountName: item.account_name, serialNo: item.serial_no, transactionDate: item.transaction_date, counterparty: item.counterparty, summary: item.summary, incomeAmount: item.income_amount, expenseAmount: item.expense_amount, balance: item.balance, receiptStatus: item.receipt_status, matchResult: item.match_result, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapDocumentRecord = (item: RawDocumentRecord): DocumentRecord => ({ id: item.id, companyId: item.company_id, period: item.period, businessDate: item.business_date, documentCode: item.document_code, businessType: item.business_type, partner: item.partner, amount: item.amount, owner: item.owner, attachmentStatus: item.attachment_status, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapAccountTransfer = (item: RawAccountTransfer): AccountTransfer => ({ id: item.id, companyId: item.company_id, period: item.period, transferDate: item.transfer_date, fromAccount: item.from_account, toAccount: item.to_account, amount: item.amount, fee: item.fee, serialNo: item.serial_no, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapFixedAsset = (item: RawFixedAsset): FixedAsset => ({ id: item.id, companyId: item.company_id, period: item.period, assetCode: item.asset_code, assetName: item.asset_name, category: item.category, startDate: item.start_date, originalValue: item.original_value, usefulLifeMonths: item.useful_life_months, residualRate: item.residual_rate, sourceDocument: item.source_document, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapInventoryMovement = (item: RawInventoryMovement): InventoryMovement => ({ id: item.id, companyId: item.company_id, period: item.period, movementDate: item.movement_date, billNo: item.bill_no, movementType: item.movement_type, inventoryName: item.inventory_name, warehouse: item.warehouse, counterparty: item.counterparty, unit: item.unit, quantity: item.quantity, amount: item.amount, sourceDocument: item.source_document, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapInventoryItem = (item: RawInventoryItem): InventoryItem => ({ id: item.id, companyId: item.company_id, itemCode: item.item_code, itemName: item.item_name, specification: item.specification, unit: item.unit, taxRate: item.tax_rate, defaultSubject: item.default_subject, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })
const mapMeasurementUnit=(item:RawMeasurementUnit):MeasurementUnit=>({id:item.id,companyId:item.company_id,unitName:item.unit_name,unitGroup:item.unit_group,baseUnit:item.base_unit,conversionRate:item.conversion_rate,precisionDigits:item.precision_digits,remark:item.remark,status:item.status,createdAt:item.created_at,updatedAt:item.updated_at})

// ============================================
// Agency operation API (机构运营)
// ============================================
export const agencyApi = {
  getServiceContracts: async (filters: { companyId?: string; status?: string } = {}): Promise<ApiResponse<AgencyServiceContract[]>> => {
    try {
      const result = await invoke('get_agency_service_contracts', filters) as RawAgencyServiceContract[]
      return { success: true, data: result.map(mapAgencyServiceContract) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  createServiceContract: async (input:{companyId:string;contractNo:string;servicePackage:string;serviceStart:string;serviceEnd:string;monthlyFee:number;owner?:string}):Promise<ApiResponse<AgencyServiceContract>>=>{try{const result=await invoke('create_agency_service_contract',{input:{company_id:input.companyId,contract_no:input.contractNo,service_package:input.servicePackage,service_start:input.serviceStart,service_end:input.serviceEnd,monthly_fee:input.monthlyFee,owner:input.owner}}) as RawAgencyServiceContract;return{success:true,data:mapAgencyServiceContract(result)}}catch(error){return{success:false,error:String(error)}}},

  getFeeCollections: async (filters: { companyId?: string; period?: string; status?: string } = {}): Promise<ApiResponse<AgencyFeeCollection[]>> => {
    try {
      const result = await invoke('get_agency_fee_collections', filters) as RawAgencyFeeCollection[]
      return { success: true, data: result.map(mapAgencyFeeCollection) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  createFeeCollection: async (input: {
    companyId: string
    period: string
    receivableAmount: number
    receivedAmount: number
    invoiceStatus?: string
    paymentStatus?: string
    collector?: string
  }): Promise<ApiResponse<AgencyFeeCollection>> => {
    try {
      const result = await invoke('create_agency_fee_collection', {
        input: {
          company_id: input.companyId,
          period: input.period,
          receivable_amount: input.receivableAmount,
          received_amount: input.receivedAmount,
          invoice_status: input.invoiceStatus,
          payment_status: input.paymentStatus,
          collector: input.collector,
        },
      }) as RawAgencyFeeCollection
      return { success: true, data: mapAgencyFeeCollection(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getCollaborationItems: async (filters: { companyId?: string; status?: string } = {}): Promise<ApiResponse<AgencyCollaborationItem[]>> => {
    try {
      const result = await invoke('get_agency_collaboration_items', filters) as RawAgencyCollaborationItem[]
      return { success: true, data: result.map(mapAgencyCollaborationItem) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  createCollaborationItem: async (input: {
    companyId: string
    todoTitle: string
    materialType?: string
    customerContact?: string
    replyStatus?: string
    owner?: string
  }): Promise<ApiResponse<AgencyCollaborationItem>> => {
    try {
      const result = await invoke('create_agency_collaboration_item', {
        input: {
          company_id: input.companyId,
          todo_title: input.todoTitle,
          material_type: input.materialType,
          customer_contact: input.customerContact,
          reply_status: input.replyStatus,
          owner: input.owner,
        },
      }) as RawAgencyCollaborationItem
      return { success: true, data: mapAgencyCollaborationItem(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getDeliveryTickets: async (filters: { companyId?: string; period?: string; status?: string } = {}): Promise<ApiResponse<AgencyDeliveryTicket[]>> => {
    try {
      const result = await invoke('get_agency_delivery_tickets', filters) as RawAgencyDeliveryTicket[]
      return { success: true, data: result.map(mapAgencyDeliveryTicket) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getBatchTasks: async (filters: { period?: string; status?: string } = {}): Promise<ApiResponse<AgencyBatchTask[]>> => {
    try {
      const result = await invoke('get_agency_batch_tasks', filters) as RawAgencyBatchTask[]
      return { success: true, data: result.map(mapAgencyBatchTask) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  createBatchTasks: async (input: { period: string; operator?: string }): Promise<ApiResponse<void>> => {
    try {
      await invoke('create_agency_batch_tasks', {
        input: {
          period: input.period,
          operator: input.operator,
        },
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getHealthChecks: async (period = '2026-05'): Promise<ApiResponse<AgencyHealthCheckItem[]>> => {
    try {
      const result = await invoke('get_agency_health_checks', { period }) as RawAgencyHealthCheckItem[]
      return { success: true, data: result.map(mapAgencyHealthCheckItem) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getAutomationJobs: async (filters: { period?: string; status?: string } = {}): Promise<ApiResponse<AutomationJob[]>> => {
    try {
      const result = await invoke('get_agency_automation_jobs', filters) as RawAutomationJob[]
      return { success: true, data: result.map(mapAutomationJob) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getAuthorizations: async (filters: { adapterType?: string } = {}): Promise<ApiResponse<AdapterAuthorization[]>> => {
    try {
      const result = await invoke('get_agency_adapter_authorizations', {
        adapterType: filters.adapterType,
      }) as RawAdapterAuthorization[]
      return { success: true, data: result.map(mapAdapterAuthorization) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getOverview: async (period = '2026-05'): Promise<ApiResponse<AgencyOperationOverview>> => {
    try {
      const result = await invoke('get_agency_operation_overview', { period }) as RawAgencyOperationOverview
      return { success: true, data: mapAgencyOperationOverview(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

// ============================================
// Automation / AI / tax adapter API
// ============================================
export const automationApi = {
  getAutomationJobs: async (filters: { companyId: string; period?: string; status?: string }): Promise<ApiResponse<AutomationJob[]>> => {
    try {
      const result = await invoke('get_automation_jobs', {
        companyId: filters.companyId,
        period: filters.period,
        status: filters.status,
      }) as RawAutomationJob[]
      return { success: true, data: result.map(mapAutomationJob) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  createAutomationJob: async (input: {
    companyId: string
    period?: string
    jobType: string
    sourceModule: string
    sourceId?: string
    sourceFile?: string
    status?: string
    confidence?: number
    resultSummary?: string
    riskLevel?: string
    reviewer?: string
    createdBy?: string
  }): Promise<ApiResponse<AutomationJob>> => {
    try {
      const result = await invoke('create_automation_job', {
        input: {
          company_id: input.companyId,
          period: input.period,
          job_type: input.jobType,
          source_module: input.sourceModule,
          source_id: input.sourceId,
          source_file: input.sourceFile,
          status: input.status,
          confidence: input.confidence,
          result_summary: input.resultSummary,
          risk_level: input.riskLevel,
          reviewer: input.reviewer,
          created_by: input.createdBy,
        },
      }) as RawAutomationJob
      return { success: true, data: mapAutomationJob(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  updateAutomationJobStatus: async (input: {
    id: string
    companyId: string
    status: string
    confidence?: number
    resultSummary?: string
    riskLevel?: string
    reviewer?: string
  }): Promise<ApiResponse<AutomationJob>> => {
    try {
      const result = await invoke('update_automation_job_status', {
        input: {
          id: input.id,
          company_id: input.companyId,
          status: input.status,
          confidence: input.confidence,
          result_summary: input.resultSummary,
          risk_level: input.riskLevel,
          reviewer: input.reviewer,
        },
      }) as RawAutomationJob
      return { success: true, data: mapAutomationJob(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getTaxDeclarationTasks: async (filters: { companyId: string; period?: string; declarationStatus?: string }): Promise<ApiResponse<TaxDeclarationTask[]>> => {
    try {
      const result = await invoke('get_tax_declaration_tasks', {
        companyId: filters.companyId,
        period: filters.period,
        declarationStatus: filters.declarationStatus,
      }) as RawTaxDeclarationTask[]
      return { success: true, data: result.map(mapTaxDeclarationTask) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  upsertTaxDeclarationTask: async (input: {
    companyId: string
    period: string
    taxType: string
    formName: string
    collectStatus?: string
    validationStatus?: string
    declarationStatus?: string
    sourceSnapshot?: string
    taxableAmount?: number
    deductionAmount?: number
    payableAmount?: number
    riskCount?: number
    adapterCode?: string
    receiptNo?: string
  }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = await invoke('upsert_tax_declaration_task', {
        input: {
          company_id: input.companyId,
          period: input.period,
          tax_type: input.taxType,
          form_name: input.formName,
          collect_status: input.collectStatus,
          validation_status: input.validationStatus,
          declaration_status: input.declarationStatus,
          source_snapshot: input.sourceSnapshot,
          taxable_amount: input.taxableAmount,
          deduction_amount: input.deductionAmount,
          payable_amount: input.payableAmount,
          risk_count: input.riskCount,
          adapter_code: input.adapterCode,
          receipt_no: input.receiptNo,
        },
      }) as RawTaxDeclarationTask
      return { success: true, data: mapTaxDeclarationTask(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  confirmTaxDeclarationTask: async (input: { id: string; companyId: string; confirmedBy?: string }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = await invoke('confirm_tax_declaration_task', {
        input: {
          id: input.id,
          company_id: input.companyId,
          confirmed_by: input.confirmedBy,
        },
      }) as RawTaxDeclarationTask
      return { success: true, data: mapTaxDeclarationTask(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getAdapterAuthorizations: async (filters: { companyId: string; adapterType?: string }): Promise<ApiResponse<AdapterAuthorization[]>> => {
    try {
      const result = await invoke('get_adapter_authorizations', {
        companyId: filters.companyId,
        adapterType: filters.adapterType,
      }) as RawAdapterAuthorization[]
      return { success: true, data: result.map(mapAdapterAuthorization) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  upsertAdapterAuthorization: async (input: {
    companyId: string
    adapterType: string
    adapterCode: string
    region?: string
    authStatus?: string
    accountMask?: string
    loginIdentity?: string
    capabilityScope?: string
    lastCheckedAt?: string
    expiresAt?: string
    riskMessage?: string
  }): Promise<ApiResponse<AdapterAuthorization>> => {
    try {
      const result = await invoke('upsert_adapter_authorization', {
        input: {
          company_id: input.companyId,
          adapter_type: input.adapterType,
          adapter_code: input.adapterCode,
          region: input.region,
          auth_status: input.authStatus,
          account_mask: input.accountMask,
          login_identity: input.loginIdentity,
          capability_scope: input.capabilityScope,
          last_checked_at: input.lastCheckedAt,
          expires_at: input.expiresAt,
          risk_message: input.riskMessage,
        },
      }) as RawAdapterAuthorization
      return { success: true, data: mapAdapterAuthorization(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  writeOperationAuditLog: async (input: {
    companyId?: string
    moduleName: string
    action: string
    objectRef?: string
    riskLevel?: string
    result?: string
    detail?: string
    operator?: string
  }): Promise<ApiResponse<OperationAuditLog>> => {
    try {
      const result = await invoke('write_operation_audit_log', {
        input: {
          company_id: input.companyId,
          module_name: input.moduleName,
          action: input.action,
          object_ref: input.objectRef,
          risk_level: input.riskLevel,
          result: input.result,
          detail: input.detail,
          operator: input.operator,
        },
      }) as RawOperationAuditLog
      return { success: true, data: mapOperationAuditLog(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  getOperationAuditLogs: async (filters: { companyId?: string; moduleName?: string } = {}): Promise<ApiResponse<OperationAuditLog[]>> => {
    try {
      const result = await invoke('get_operation_audit_logs', {
        companyId: filters.companyId,
        moduleName: filters.moduleName,
      }) as RawOperationAuditLog[]
      return { success: true, data: result.map(mapOperationAuditLog) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

export const backupApi = {
  createLocalBackup: async (): Promise<ApiResponse<LocalBackupSnapshot>> => {
    try {
      const result = await invoke('create_local_backup') as LocalBackupSnapshot
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  listLocalBackups: async (): Promise<ApiResponse<LocalBackupSnapshot[]>> => {
    try {
      const result = await invoke('list_local_backups') as LocalBackupSnapshot[]
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  verifyLocalBackup: async (backupId: string): Promise<ApiResponse<LocalBackupVerification>> => {
    try {
      const result = await invoke('verify_local_backup', { backupId }) as LocalBackupVerification
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

export const employeeApi = {
  getEmployees: async (companyId: string): Promise<ApiResponse<Employee[]>> => {
    try {
      const result = await invoke('get_employees', { companyId }) as RawEmployee[]
      return { success: true, data: result.map(mapEmployee) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  createEmployee: async (input: {
    companyId: string
    employeeCode: string
    name: string
    idNo?: string
    department?: string
    position?: string
    mobile?: string
    entryDate?: string
    employmentStatus?: string
  }): Promise<ApiResponse<Employee>> => {
    try {
      const result = await invoke('create_employee', {
        input: {
          company_id: input.companyId,
          employee_code: input.employeeCode,
          name: input.name,
          id_no: input.idNo || undefined,
          department: input.department || undefined,
          position: input.position || undefined,
          mobile: input.mobile || undefined,
          entry_date: input.entryDate || undefined,
          employment_status: input.employmentStatus || undefined,
        },
      }) as RawEmployee
      return { success: true, data: mapEmployee(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  updateEmployee: async (input: {
    id: string
    companyId: string
    employeeCode: string
    name: string
    idNo?: string
    department?: string
    position?: string
    mobile?: string
    entryDate?: string
    employmentStatus?: string
  }): Promise<ApiResponse<Employee>> => {
    try {
      const result = await invoke('update_employee', {
        input: {
          id: input.id,
          company_id: input.companyId,
          employee_code: input.employeeCode,
          name: input.name,
          id_no: input.idNo || undefined,
          department: input.department || undefined,
          position: input.position || undefined,
          mobile: input.mobile || undefined,
          entry_date: input.entryDate || undefined,
          employment_status: input.employmentStatus || undefined,
        },
      }) as RawEmployee
      return { success: true, data: mapEmployee(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

export const payrollApi = {
  getPayrollRecords: async (filters: { companyId: string; period: string }): Promise<ApiResponse<PayrollRecord[]>> => {
    try {
      const result = await invoke('get_payroll_records', { companyId: filters.companyId, period: filters.period }) as RawPayrollRecord[]
      return { success: true, data: result.map(mapPayrollRecord) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  createPayrollRecord: async (input: { companyId: string; employeeId: string; period: string; baseSalary: number; bonus?: number; taxAmount?: number; socialPersonal?: number }): Promise<ApiResponse<PayrollRecord>> => {
    try {
      const result = await invoke('create_payroll_record', {
        input: {
          company_id: input.companyId,
          employee_id: input.employeeId,
          period: input.period,
          base_salary: input.baseSalary,
          bonus: input.bonus,
          tax_amount: input.taxAmount,
          social_personal: input.socialPersonal,
        },
      }) as RawPayrollRecord
      return { success: true, data: mapPayrollRecord(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  updatePayrollRecord: async (input: { id: string; companyId: string; employeeId: string; period: string; baseSalary: number; bonus?: number; taxAmount?: number; socialPersonal?: number }): Promise<ApiResponse<PayrollRecord>> => {
    try {
      const result = await invoke('update_payroll_record', {
        input: {
          id: input.id,
          company_id: input.companyId,
          employee_id: input.employeeId,
          period: input.period,
          base_salary: input.baseSalary,
          bonus: input.bonus,
          tax_amount: input.taxAmount,
          social_personal: input.socialPersonal,
        },
      }) as RawPayrollRecord
      return { success: true, data: mapPayrollRecord(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

export const socialSecurityApi = {
  getSocialSecurityRecords: async (filters: { companyId: string; period: string }): Promise<ApiResponse<SocialSecurityRecord[]>> => {
    try { const result = await invoke('get_social_security_records', { companyId: filters.companyId, period: filters.period }) as RawSocialSecurityRecord[]; return { success: true, data: result.map(mapSocialSecurityRecord) } } catch (error) { return { success: false, error: String(error) } }
  },
  createSocialSecurityRecord: async (input: { companyId: string; employeeId: string; period: string; city?: string; contributionBase: number; companyAmount: number; personalAmount: number; fundAmount: number }): Promise<ApiResponse<SocialSecurityRecord>> => {
    try {
      const result = await invoke('create_social_security_record', {
        input: { company_id: input.companyId, employee_id: input.employeeId, period: input.period, city: input.city, contribution_base: input.contributionBase, company_amount: input.companyAmount, personal_amount: input.personalAmount, fund_amount: input.fundAmount },
      }) as RawSocialSecurityRecord
      return { success: true, data: mapSocialSecurityRecord(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  updateSocialSecurityRecord: async (input:{id:string;companyId:string;city?:string;contributionBase:number;companyAmount:number;personalAmount:number;fundAmount:number}):Promise<ApiResponse<SocialSecurityRecord>>=>{try{const result=await invoke('update_social_security_record',{input:{id:input.id,company_id:input.companyId,city:input.city,contribution_base:input.contributionBase,company_amount:input.companyAmount,personal_amount:input.personalAmount,fund_amount:input.fundAmount}}) as RawSocialSecurityRecord;return{success:true,data:mapSocialSecurityRecord(result)}}catch(error){return{success:false,error:String(error)}}},
}

export const specialDeductionApi = {
  getSpecialDeductionRecords: async (filters: { companyId: string; period: string }): Promise<ApiResponse<SpecialDeductionRecord[]>> => {
    try {
      const result = await invoke('get_special_deduction_records', { companyId: filters.companyId, period: filters.period }) as RawSpecialDeductionRecord[]
      return { success: true, data: result.map(mapSpecialDeductionRecord) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  createSpecialDeductionRecord: async (input: { companyId: string; employeeId: string; deductionType: string; startMonth: string; endMonth?: string; monthlyAmount: number; source?: string }): Promise<ApiResponse<SpecialDeductionRecord>> => {
    try {
      const result = await invoke('create_special_deduction_record', {
        input: { company_id: input.companyId, employee_id: input.employeeId, deduction_type: input.deductionType, start_month: input.startMonth, end_month: input.endMonth, monthly_amount: input.monthlyAmount, source: input.source },
      }) as RawSpecialDeductionRecord
      return { success: true, data: mapSpecialDeductionRecord(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  updateSpecialDeductionRecord: async (input:{id:string;companyId:string;deductionType:string;startMonth:string;endMonth?:string;monthlyAmount:number;source?:string}):Promise<ApiResponse<SpecialDeductionRecord>>=>{try{const result=await invoke('update_special_deduction_record',{input:{id:input.id,company_id:input.companyId,deduction_type:input.deductionType,start_month:input.startMonth,end_month:input.endMonth,monthly_amount:input.monthlyAmount,source:input.source}}) as RawSpecialDeductionRecord;return{success:true,data:mapSpecialDeductionRecord(result)}}catch(error){return{success:false,error:String(error)}}},
}

export const bankTransactionApi = {
  getBankTransactions: async (filters: { companyId: string; period: string }): Promise<ApiResponse<BankTransaction[]>> => {
    try {
      const result = await invoke('get_bank_transactions', { companyId: filters.companyId, period: filters.period }) as RawBankTransaction[]
      return { success: true, data: result.map(mapBankTransaction) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  createBankTransaction: async (input: { companyId: string; period: string; accountName: string; serialNo: string; transactionDate: string; counterparty?: string; summary?: string; incomeAmount: number; expenseAmount: number; balance?: number; receiptStatus?: string }): Promise<ApiResponse<BankTransaction>> => {
    try {
      const result = await invoke('create_bank_transaction', {
        input: { company_id: input.companyId, period: input.period, account_name: input.accountName, serial_no: input.serialNo, transaction_date: input.transactionDate, counterparty: input.counterparty, summary: input.summary, income_amount: input.incomeAmount, expense_amount: input.expenseAmount, balance: input.balance, receipt_status: input.receiptStatus },
      }) as RawBankTransaction
      return { success: true, data: mapBankTransaction(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  updateBankTransaction: async (input: { id: string; companyId: string; accountName: string; serialNo: string; transactionDate: string; counterparty?: string; summary?: string; incomeAmount: number; expenseAmount: number; balance?: number; receiptStatus?: string }): Promise<ApiResponse<BankTransaction>> => {
    try {
      const result = await invoke('update_bank_transaction', {
        input: { id: input.id, company_id: input.companyId, account_name: input.accountName, serial_no: input.serialNo, transaction_date: input.transactionDate, counterparty: input.counterparty, summary: input.summary, income_amount: input.incomeAmount, expense_amount: input.expenseAmount, balance: input.balance, receipt_status: input.receiptStatus },
      }) as RawBankTransaction
      return { success: true, data: mapBankTransaction(result) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
}

export const documentRecordApi = {
  getDocumentRecords: async (filters: { companyId: string; period: string }): Promise<ApiResponse<DocumentRecord[]>> => {
    try { const result = await invoke('get_document_records', { companyId: filters.companyId, period: filters.period }) as RawDocumentRecord[]; return { success: true, data: result.map(mapDocumentRecord) } } catch (error) { return { success: false, error: String(error) } }
  },
  createDocumentRecord: async (input: { companyId: string; period: string; businessDate: string; documentCode: string; businessType: string; partner?: string; amount: number; owner?: string; attachmentStatus?: string }): Promise<ApiResponse<DocumentRecord>> => {
    try {
      const result = await invoke('create_document_record', {
        input: { company_id: input.companyId, period: input.period, business_date: input.businessDate, document_code: input.documentCode, business_type: input.businessType, partner: input.partner, amount: input.amount, owner: input.owner, attachment_status: input.attachmentStatus },
      }) as RawDocumentRecord
      return { success: true, data: mapDocumentRecord(result) }
    } catch (error) { return { success: false, error: String(error) } }
  },
  updateDocumentRecord: async (input: { id: string; companyId: string; businessDate: string; documentCode: string; businessType: string; partner?: string; amount: number; owner?: string; attachmentStatus?: string }): Promise<ApiResponse<DocumentRecord>> => {
    try {
      const result = await invoke('update_document_record', {
        input: { id: input.id, company_id: input.companyId, business_date: input.businessDate, document_code: input.documentCode, business_type: input.businessType, partner: input.partner, amount: input.amount, owner: input.owner, attachment_status: input.attachmentStatus },
      }) as RawDocumentRecord
      return { success: true, data: mapDocumentRecord(result) }
    } catch (error) { return { success: false, error: String(error) } }
  },
}

export const accountTransferApi = {
  getAccountTransfers: async (filters: { companyId: string; period: string }): Promise<ApiResponse<AccountTransfer[]>> => { try { const result = await invoke('get_account_transfers', { companyId: filters.companyId, period: filters.period }) as RawAccountTransfer[]; return { success: true, data: result.map(mapAccountTransfer) } } catch (error) { return { success: false, error: String(error) } } },
  createAccountTransfer: async (input: { companyId: string; period: string; transferDate: string; fromAccount: string; toAccount: string; amount: number; fee?: number; serialNo?: string }): Promise<ApiResponse<AccountTransfer>> => { try { const result = await invoke('create_account_transfer', { input: { company_id: input.companyId, period: input.period, transfer_date: input.transferDate, from_account: input.fromAccount, to_account: input.toAccount, amount: input.amount, fee: input.fee, serial_no: input.serialNo } }) as RawAccountTransfer; return { success: true, data: mapAccountTransfer(result) } } catch (error) { return { success: false, error: String(error) } } },
  updateAccountTransfer: async (input: { id: string; companyId: string; transferDate: string; fromAccount: string; toAccount: string; amount: number; fee?: number; serialNo?: string }): Promise<ApiResponse<AccountTransfer>> => { try { const result = await invoke('update_account_transfer', { input: { id: input.id, company_id: input.companyId, transfer_date: input.transferDate, from_account: input.fromAccount, to_account: input.toAccount, amount: input.amount, fee: input.fee, serial_no: input.serialNo } }) as RawAccountTransfer; return { success: true, data: mapAccountTransfer(result) } } catch (error) { return { success: false, error: String(error) } } },
}

export const fixedAssetApi = {
  getFixedAssets: async (filters: { companyId: string; period: string }): Promise<ApiResponse<FixedAsset[]>> => { try { const result = await invoke('get_fixed_assets', { companyId: filters.companyId, period: filters.period }) as RawFixedAsset[]; return { success: true, data: result.map(mapFixedAsset) } } catch (error) { return { success: false, error: String(error) } } },
  createFixedAsset: async (input: { companyId: string; period: string; assetCode: string; assetName: string; category: string; startDate: string; originalValue: number; usefulLifeMonths: number; residualRate?: number; sourceDocument?: string }): Promise<ApiResponse<FixedAsset>> => { try { const result = await invoke('create_fixed_asset', { input: { company_id: input.companyId, period: input.period, asset_code: input.assetCode, asset_name: input.assetName, category: input.category, start_date: input.startDate, original_value: input.originalValue, useful_life_months: input.usefulLifeMonths, residual_rate: input.residualRate, source_document: input.sourceDocument } }) as RawFixedAsset; return { success: true, data: mapFixedAsset(result) } } catch (error) { return { success: false, error: String(error) } } },
  updateFixedAsset: async (input: { id: string; companyId: string; assetCode: string; assetName: string; category: string; startDate: string; originalValue: number; usefulLifeMonths: number; residualRate?: number; sourceDocument?: string }): Promise<ApiResponse<FixedAsset>> => { try { const result = await invoke('update_fixed_asset', { input: { id: input.id, company_id: input.companyId, asset_code: input.assetCode, asset_name: input.assetName, category: input.category, start_date: input.startDate, original_value: input.originalValue, useful_life_months: input.usefulLifeMonths, residual_rate: input.residualRate, source_document: input.sourceDocument } }) as RawFixedAsset; return { success: true, data: mapFixedAsset(result) } } catch (error) { return { success: false, error: String(error) } } },
}

export const inventoryMovementApi = {
  getInventoryMovements: async (filters: { companyId: string; period: string }): Promise<ApiResponse<InventoryMovement[]>> => { try { const result = await invoke('get_inventory_movements', { companyId: filters.companyId, period: filters.period }) as RawInventoryMovement[]; return { success: true, data: result.map(mapInventoryMovement) } } catch (error) { return { success: false, error: String(error) } } },
  createInventoryMovement: async (input: { companyId: string; period: string; movementDate: string; billNo: string; movementType: string; inventoryName: string; warehouse: string; counterparty?: string; unit: string; quantity: number; amount: number; sourceDocument?: string }): Promise<ApiResponse<InventoryMovement>> => { try { const result = await invoke('create_inventory_movement', { input: { company_id: input.companyId, period: input.period, movement_date: input.movementDate, bill_no: input.billNo, movement_type: input.movementType, inventory_name: input.inventoryName, warehouse: input.warehouse, counterparty: input.counterparty, unit: input.unit, quantity: input.quantity, amount: input.amount, source_document: input.sourceDocument } }) as RawInventoryMovement; return { success: true, data: mapInventoryMovement(result) } } catch (error) { return { success: false, error: String(error) } } },
  updateInventoryMovement: async (input: { id: string; companyId: string; movementDate: string; billNo: string; movementType: string; inventoryName: string; warehouse: string; counterparty?: string; unit: string; quantity: number; amount: number; sourceDocument?: string }): Promise<ApiResponse<InventoryMovement>> => { try { const result = await invoke('update_inventory_movement', { input: { id: input.id, company_id: input.companyId, movement_date: input.movementDate, bill_no: input.billNo, movement_type: input.movementType, inventory_name: input.inventoryName, warehouse: input.warehouse, counterparty: input.counterparty, unit: input.unit, quantity: input.quantity, amount: input.amount, source_document: input.sourceDocument } }) as RawInventoryMovement; return { success: true, data: mapInventoryMovement(result) } } catch (error) { return { success: false, error: String(error) } } },
}
export const inventoryItemApi = {
  getInventoryItems: async (filters: { companyId: string }): Promise<ApiResponse<InventoryItem[]>> => { try { const result = await invoke('get_inventory_items', { companyId: filters.companyId }) as RawInventoryItem[]; return { success: true, data: result.map(mapInventoryItem) } } catch (error) { return { success: false, error: String(error) } } },
  createInventoryItem: async (input: { companyId: string; itemCode: string; itemName: string; specification?: string; unit: string; taxRate?: number; defaultSubject?: string }): Promise<ApiResponse<InventoryItem>> => { try { const result = await invoke('create_inventory_item', { input: { company_id: input.companyId, item_code: input.itemCode, item_name: input.itemName, specification: input.specification, unit: input.unit, tax_rate: input.taxRate, default_subject: input.defaultSubject } }) as RawInventoryItem; return { success: true, data: mapInventoryItem(result) } } catch (error) { return { success: false, error: String(error) } } },
  updateInventoryItem: async (input: { id:string; companyId:string; itemCode:string; itemName:string; specification?:string; unit:string; taxRate?:number; defaultSubject?:string }): Promise<ApiResponse<InventoryItem>> => { try { const result=await invoke('update_inventory_item',{input:{id:input.id,company_id:input.companyId,item_code:input.itemCode,item_name:input.itemName,specification:input.specification,unit:input.unit,tax_rate:input.taxRate,default_subject:input.defaultSubject}}) as RawInventoryItem;return{success:true,data:mapInventoryItem(result)}}catch(error){return{success:false,error:String(error)}}},
}
export const measurementUnitApi={getMeasurementUnits:async(filters:{companyId:string}):Promise<ApiResponse<MeasurementUnit[]>>=>{try{const result=await invoke('get_measurement_units',{companyId:filters.companyId}) as RawMeasurementUnit[];return{success:true,data:result.map(mapMeasurementUnit)}}catch(error){return{success:false,error:String(error)}}},createMeasurementUnit:async(input:{companyId:string;unitName:string;unitGroup?:string;baseUnit?:string;conversionRate:number;precisionDigits:number;remark?:string}):Promise<ApiResponse<MeasurementUnit>>=>{try{const result=await invoke('create_measurement_unit',{input:{company_id:input.companyId,unit_name:input.unitName,unit_group:input.unitGroup,base_unit:input.baseUnit,conversion_rate:input.conversionRate,precision_digits:input.precisionDigits,remark:input.remark}}) as RawMeasurementUnit;return{success:true,data:mapMeasurementUnit(result)}}catch(error){return{success:false,error:String(error)}}},updateMeasurementUnit:async(input:{id:string;companyId:string;unitName:string;unitGroup?:string;baseUnit?:string;conversionRate:number;precisionDigits:number;remark?:string}):Promise<ApiResponse<MeasurementUnit>>=>{try{const result=await invoke('update_measurement_unit',{input:{id:input.id,company_id:input.companyId,unit_name:input.unitName,unit_group:input.unitGroup,base_unit:input.baseUnit,conversion_rate:input.conversionRate,precision_digits:input.precisionDigits,remark:input.remark}}) as RawMeasurementUnit;return{success:true,data:mapMeasurementUnit(result)}}catch(error){return{success:false,error:String(error)}}}}
