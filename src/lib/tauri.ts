const isTauriEnv = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

export const isTauri = isTauriEnv

const EMPTY_RESULTS: Record<string, unknown> = {
  get_companies: [],
  get_company: null,
  get_accounting_periods: [],
  get_open_periods: [],
  get_voucher_words: [],
  get_account_balances: [],
  get_trial_balance: { items: [], total_debit: 0, total_credit: 0 },
  get_general_ledger: [],
  get_subsidiary_ledger: [],
  get_balance_sheet: { items: [], total_assets: 0, total_liabilities_equity: 0 },
  get_income_statement: { items: [], total_revenue: 0, total_expense: 0 },
  get_cash_flow_statement: { items: [] },
  get_report_templates: [],
  get_report_items: [],
  get_vouchers: [],
  query_vouchers: { vouchers: [], total: 0 },
  get_voucher: null,
  get_voucher_entries: [],
  get_voucher_logs: [],
  get_voucher_template_types: [],
  get_voucher_templates: [],
  get_common_digests: [],
  get_account_codes: [],
  get_account_codes_by_type: [],
  get_detail_account_codes: [],
  get_account_code: null,
  search_account_codes: [],
  get_subjects: [],
  get_subjects_by_type: [],
  get_subject: null,
  search_subjects: [],
  get_invoices: [],
  get_invoice: null,
  get_invoices_by_voucher: [],
  get_auxiliary_categories: [],
  get_auxiliary_items: [],
  get_all_auxiliary_items: [],
  get_employees: [],
  get_payroll_records: [],
  get_special_deduction_records: [],
  get_bank_transactions: [],
  get_document_records: [],
  create_employee: { id: 'employee-dev-1', company_id: 'mock-1', employee_code: 'EMP-001', name: '开发预览人员', id_no: null, department: null, position: null, mobile: null, entry_date: null, employment_status: '在职', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  create_payroll_record: { id: 'payroll-dev-1', company_id: 'mock-1', employee_id: 'employee-dev-1', employee_name: '开发预览人员', period: '2026-05', base_salary: 0, bonus: 0, tax_amount: 0, social_personal: 0, net_salary: 0, status: '待确认', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  create_special_deduction_record: { id: 'deduction-dev-1', company_id: 'mock-1', employee_id: 'employee-dev-1', employee_name: '开发预览人员', deduction_type: '子女教育', start_month: '2026-05', end_month: null, monthly_amount: 0, source: '手工', status: '待确认', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  create_bank_transaction: { id: 'bank-dev-1', company_id: 'mock-1', period: '2026-05', account_name: '开发预览账户', serial_no: 'DEV-001', transaction_date: '2026-05-01', counterparty: null, summary: null, income_amount: 0, expense_amount: 0, balance: null, receipt_status: '待上传', match_result: null, status: '待处理', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  create_document_record: { id: 'document-dev-1', company_id: 'mock-1', period: '2026-05', business_date: '2026-05-01', document_code: 'DEV-DOC-001', business_type: '费用报销', partner: null, amount: 0, owner: null, attachment_status: '待补附件', status: '待审核', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  update_employee: { id: 'employee-dev-1', company_id: 'mock-1', employee_code: 'EMP-001', name: '开发预览人员', id_no: null, department: null, position: null, mobile: null, entry_date: null, employment_status: '在职', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  get_account_auxiliary_links: [],
  get_accounts_with_auxiliary: [],
  get_voucher_entry_auxiliaries: [],
  get_auxiliary_ledger: [],
  get_auxiliary_balance: [],
  get_account_auxiliary_setup: [],
  get_settlement_rules: [],
  get_currencies: [],
  get_roles: [],
  get_users_with_roles: [],
  get_company_memos: [],
  upsert_company_memo: { id: 'company-memo-dev-1', companyId: 'mock-1', content: '浏览器预览备忘录', reminderDate: null, updatedBy: 'dev', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  get_company_todos: [],
  create_company_todo: { id: 'company-todo-dev-1', companyId: 'mock-1', companyName: '浏览器预览账套', period: '2026-05', title: '浏览器预览待办', sourceModule: '通知待办', priority: 'normal', owner: 'admin', dueDate: null, relatedEntry: null, evidence: null, note: null, status: 'open', completedAt: null, completedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  complete_company_todo: { id: 'company-todo-dev-1', companyId: 'mock-1', companyName: '浏览器预览账套', period: '2026-05', title: '浏览器预览待办', sourceModule: '通知待办', priority: 'normal', owner: 'admin', dueDate: null, relatedEntry: null, evidence: null, note: null, status: 'completed', completedAt: new Date().toISOString(), completedBy: 'admin', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  get_agency_service_contracts: [],
  get_agency_fee_collections: [],
  get_agency_collaboration_items: [],
  get_agency_delivery_tickets: [],
  get_agency_operation_overview: {
    service_contracts: 0,
    expiring_contracts: 0,
    receivable_amount: 0,
    arrears_amount: 0,
    pending_collaboration: 0,
    overdue_collaboration: 0,
    open_tickets: 0,
    blocked_tickets: 0,
  },
  get_automation_jobs: [],
  create_automation_job: {
    id: 'auto-dev-1',
    company_id: 'mock-1',
    company_name: '示例公司',
    period: '2026-05',
    job_type: 'voucher_suggestion',
    source_module: 'invoice',
    source_id: null,
    source_file: null,
    status: 'queued',
    confidence: null,
    result_summary: null,
    risk_level: 'normal',
    reviewer: null,
    created_by: 'dev',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  update_automation_job_status: {
    id: 'auto-dev-1',
    company_id: 'mock-1',
    company_name: '示例公司',
    period: '2026-05',
    job_type: 'voucher_suggestion',
    source_module: 'invoice',
    source_id: null,
    source_file: null,
    status: 'completed',
    confidence: 0.92,
    result_summary: '浏览器预览 mock',
    risk_level: 'normal',
    reviewer: 'dev',
    created_by: 'dev',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  get_adapter_authorizations: [],
  upsert_adapter_authorization: {
    id: 'adapter-dev-1',
    company_id: 'mock-1',
    company_name: '示例公司',
    adapter_type: 'tax',
    adapter_code: 'demo-tax-adapter',
    region: '上海',
    auth_status: 'pending',
    account_mask: 'demo****',
    login_identity: '办税员',
    capability_scope: '取数/申报包生成',
    last_checked_at: null,
    expires_at: null,
    risk_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  create_local_backup: { id: 'backup-dev-1', file_name: 'accounting-preview.db', created_at: new Date().toISOString(), size_bytes: 0 },
  list_local_backups: [],
  verify_local_backup: { id: 'backup-dev-1', file_name: 'accounting-preview.db', valid: true, message: '浏览器预览 mock' },
  check_permission: { allowed: true },
  get_initial_balance: null,
  suggest_summary: [],
  get_next_voucher_number: '001',
  get_period: null,
  get_current_user: null,
  login: { success: true, token: 'dev-token', user: { id: 'dev', username: 'admin', real_name: '开发用户', role: 'admin', role_id: null }, error: null },
  check: { is_authenticated: true, user: { id: 'dev', username: 'admin', real_name: '开发用户', role: 'admin', role_id: null } },
  register: { id: 'dev', username: 'new', real_name: 'New', role: 'user', role_id: null, password_hash: '', created_at: '', updated_at: '' },
  create_company: { id: 'mock-1', code: 'A001', name: '示例公司', tax_id: '91110108MA01ABCDEF', tax_type: 'small', contact: null, phone: null, email: null, address: null, bank_name: null, bank_account: null, industry: null, accounting_system: 'small_enterprise', province: null, city: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  update_company: { id: 'mock-1', code: 'A001', name: '示例公司', tax_id: '91110108MA01ABCDEF', tax_type: 'small', contact: null, phone: null, email: null, address: null, bank_name: null, bank_account: null, industry: null, accounting_system: 'small_enterprise', province: null, city: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  delete_company: null,
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

let realInvoke: InvokeFn | null = null

const AGENCY_PREVIEW_STORAGE_KEY = 'accounting-preview-agency-data-v1'
const PREVIEW_COMPANY_INFO_STORAGE_KEY = 'accounting-preview-company-info-v1'

type BrowserAgencyContract = {
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

type BrowserAgencyFee = {
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

type BrowserAgencyCollaboration = {
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

type BrowserAgencyBatchTask = {
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

type BrowserAutomationJob = {
  id: string
  company_id: string
  company_name: string | null
  period: string | null
  job_type: string
  source_module: string
  source_id: string | null
  source_file: string | null
  suggestion_no: string | null
  debit_subject: string | null
  credit_subject: string | null
  suggestion_amount: number | null
  generated_voucher_id: string | null
  generated_voucher_number: string | null
  status: string
  confidence: number | null
  result_summary: string | null
  risk_level: string
  reviewer: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type BrowserAdapterAuthorization = {
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

type BrowserTaxDeclarationTask = {
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
  payment_status: string
  payment_no: string | null
  receipt_received_at: string | null
  created_at: string
  updated_at: string
}

type BrowserOperationAuditLog = {
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

type BrowserAgencyPreviewData = {
  contracts: BrowserAgencyContract[]
  fees: BrowserAgencyFee[]
  collaborations: BrowserAgencyCollaboration[]
  batchTasks: BrowserAgencyBatchTask[]
  automationJobs: BrowserAutomationJob[]
  authorizations: BrowserAdapterAuthorization[]
  taxDeclarationTasks: BrowserTaxDeclarationTask[]
  operationAuditLogs: BrowserOperationAuditLog[]
}

function browserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function emptyBrowserAgencyPreviewData(): BrowserAgencyPreviewData {
  return {
    contracts: [], fees: [], collaborations: [], batchTasks: [], automationJobs: [], authorizations: [],
    taxDeclarationTasks: [], operationAuditLogs: [],
  }
}

function loadBrowserAgencyPreviewData(): BrowserAgencyPreviewData {
  const storage = browserStorage()
  if (!storage) return emptyBrowserAgencyPreviewData()
  try {
    const parsed = JSON.parse(storage.getItem(AGENCY_PREVIEW_STORAGE_KEY) || 'null') as Partial<BrowserAgencyPreviewData> | null
    if (!parsed || typeof parsed !== 'object') return emptyBrowserAgencyPreviewData()
    return {
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts as BrowserAgencyContract[] : [],
      fees: Array.isArray(parsed.fees) ? parsed.fees as BrowserAgencyFee[] : [],
      collaborations: Array.isArray(parsed.collaborations) ? parsed.collaborations as BrowserAgencyCollaboration[] : [],
      batchTasks: Array.isArray(parsed.batchTasks) ? parsed.batchTasks as BrowserAgencyBatchTask[] : [],
      automationJobs: Array.isArray(parsed.automationJobs) ? parsed.automationJobs as BrowserAutomationJob[] : [],
      authorizations: Array.isArray(parsed.authorizations) ? parsed.authorizations as BrowserAdapterAuthorization[] : [],
      taxDeclarationTasks: Array.isArray(parsed.taxDeclarationTasks) ? parsed.taxDeclarationTasks as BrowserTaxDeclarationTask[] : [],
      operationAuditLogs: Array.isArray(parsed.operationAuditLogs) ? parsed.operationAuditLogs as BrowserOperationAuditLog[] : [],
    }
  } catch {
    return emptyBrowserAgencyPreviewData()
  }
}

function saveBrowserAgencyPreviewData(data: BrowserAgencyPreviewData) {
  const storage = browserStorage()
  if (!storage) return
  try {
    storage.setItem(AGENCY_PREVIEW_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function asPreviewText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asPreviewNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBrowserPreviewCompanies() {
  const storage = browserStorage()
  if (!storage) return []
  try {
    const draft = JSON.parse(storage.getItem(PREVIEW_COMPANY_INFO_STORAGE_KEY) || 'null') as Record<string, unknown> | null
    if (!draft || typeof draft.name !== 'string' || !draft.name.trim()) return []
    const now = new Date().toISOString()
    return [{
      id: 'browser-preview-company',
      code: asPreviewText(draft.code, 'PREVIEW'),
      name: draft.name.trim(),
      tax_id: asPreviewText(draft.taxId) || null,
      contact: null,
      phone: null,
      email: null,
      address: null,
      bank_name: null,
      bank_account: null,
      tax_type: asPreviewText(draft.taxpayerType) || null,
      industry: asPreviewText(draft.industry) || null,
      accounting_system: asPreviewText(draft.accountingSystem) || null,
      province: asPreviewText(draft.province) || null,
      city: asPreviewText(draft.city) || null,
      district: asPreviewText(draft.district) || null,
      enterprise_type: asPreviewText(draft.enterpriseType) || null,
      service_start: asPreviewText(draft.serviceStart) || null,
      service_end: asPreviewText(draft.serviceEnd) || null,
      enable_year: asPreviewNumber(draft.enableYear) || null,
      enable_month: asPreviewNumber(draft.enableMonth) || null,
      is_active: 1,
      is_deleted: 0,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }]
  } catch {
    return []
  }
}

function browserAgencyCompanyName(companyId: string, storedName: string | null = null) {
  return readBrowserPreviewCompanies().find((company) => company.id === companyId)?.name || storedName || '未关联客户'
}

function browserAgencyId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function upsertBrowserAgencyRecord<T extends { id: string }>(records: T[], record: T) {
  return [record, ...records.filter((item) => item.id !== record.id)]
}

const browserBatchTaskTemplates = [
  ['invoice_collection', '批量采集发票', '全部已授权税务客户', '检查税务授权后执行', 'medium', 0],
  ['bank_collection', '批量采集银行流水', '已授权银行客户', '检查银行授权后执行', 'medium', 0],
  ['voucher_generation_precheck', '批量生成凭证预检', '已完成资料核验客户', '只生成凭证建议与待确认草稿', 'medium', 0],
  ['closing_precheck', '批量结账预检', '待结账客户', '需完成风险检查', 'high', 1],
  ['tax_declaration_precheck', '批量申报预检', '待申报税种', '只生成申报包，不自动提交税局', 'high', 1],
  ['declaration_receipt_archive', '申报回执归档预检', '已确认申报事项', '只核验本地回执和缴款书归档条件', 'high', 1],
] as const

async function browserInvoke<T>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
  const input = (_args?.input ?? {}) as Record<string, unknown>
  const filters = (_args ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()
  const data = loadBrowserAgencyPreviewData()
  const firstCompanyId = readBrowserPreviewCompanies()[0]?.id || 'browser-preview-company'

  if (cmd === 'get_companies') return readBrowserPreviewCompanies() as T

  if (cmd === 'get_agency_service_contracts') {
    const companyId = asPreviewText(filters.companyId)
    const status = asPreviewText(filters.status)
    return data.contracts.filter((item) => (!companyId || item.company_id === companyId) && (!status || item.status === status)) as T
  }
  if (cmd === 'create_agency_service_contract' || cmd === 'update_agency_service_contract') {
    const existing = data.contracts.find((item) => item.id === asPreviewText(input.id))
    const companyId = asPreviewText(input.company_id, existing?.company_id || firstCompanyId)
    const record: BrowserAgencyContract = {
      id: existing?.id || browserAgencyId('agency-contract'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      contract_no: asPreviewText(input.contract_no, existing?.contract_no || ''),
      service_package: asPreviewText(input.service_package, existing?.service_package || ''),
      service_start: asPreviewText(input.service_start, existing?.service_start || ''),
      service_end: asPreviewText(input.service_end, existing?.service_end || ''),
      monthly_fee: asPreviewNumber(input.monthly_fee, existing?.monthly_fee || 0),
      renewal_status: asPreviewText(input.renewal_status, existing?.renewal_status || 'normal'),
      owner: asPreviewText(input.owner, existing?.owner || '') || null,
      archive_status: asPreviewText(input.archive_status, existing?.archive_status || 'pending'),
      status: asPreviewText(input.status, existing?.status || 'active'),
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.contracts = upsertBrowserAgencyRecord(data.contracts, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_agency_fee_collections') {
    const companyId = asPreviewText(filters.companyId)
    const period = asPreviewText(filters.period)
    const status = asPreviewText(filters.status)
    return data.fees.filter((item) => (!companyId || item.company_id === companyId) && (!period || item.period === period) && (!status || item.status === status)) as T
  }
  if (cmd === 'create_agency_fee_collection' || cmd === 'update_agency_fee_collection') {
    const existing = data.fees.find((item) => item.id === asPreviewText(input.id))
    const companyId = asPreviewText(input.company_id, existing?.company_id || firstCompanyId)
    const receivable = asPreviewNumber(input.receivable_amount, existing?.receivable_amount || 0)
    const received = asPreviewNumber(input.received_amount, existing?.received_amount || 0)
    const record: BrowserAgencyFee = {
      id: existing?.id || browserAgencyId('agency-fee'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      period: asPreviewText(input.period, existing?.period || new Date().toISOString().slice(0, 7)),
      receivable_amount: receivable,
      received_amount: received,
      arrears_amount: Math.max(0, receivable - received),
      invoice_status: asPreviewText(input.invoice_status, existing?.invoice_status || 'pending'),
      payment_status: asPreviewText(input.payment_status, existing?.payment_status || 'pending'),
      collector: asPreviewText(input.collector, existing?.collector || '') || null,
      last_follow_up: asPreviewText(input.last_follow_up, existing?.last_follow_up || '') || null,
      status: asPreviewText(input.status, existing?.status || 'pending'),
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.fees = upsertBrowserAgencyRecord(data.fees, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_agency_collaboration_items') {
    const companyId = asPreviewText(filters.companyId)
    const status = asPreviewText(filters.status)
    return data.collaborations.filter((item) => (!companyId || item.company_id === companyId) && (!status || item.status === status)) as T
  }
  if (cmd === 'create_agency_collaboration_item' || cmd === 'update_agency_collaboration_item') {
    const existing = data.collaborations.find((item) => item.id === asPreviewText(input.id))
    const companyId = asPreviewText(input.company_id, existing?.company_id || firstCompanyId)
    const record: BrowserAgencyCollaboration = {
      id: existing?.id || browserAgencyId('agency-collaboration'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      todo_title: asPreviewText(input.todo_title, existing?.todo_title || ''),
      material_type: asPreviewText(input.material_type, existing?.material_type || '') || null,
      customer_contact: asPreviewText(input.customer_contact, existing?.customer_contact || '') || null,
      reminder_count: asPreviewNumber(input.reminder_count, existing?.reminder_count || 0),
      last_contact_at: asPreviewText(input.last_contact_at, existing?.last_contact_at || '') || null,
      reply_status: asPreviewText(input.reply_status, existing?.reply_status || 'pending'),
      owner: asPreviewText(input.owner, existing?.owner || '') || null,
      status: asPreviewText(input.status, existing?.status || 'pending'),
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.collaborations = upsertBrowserAgencyRecord(data.collaborations, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_agency_batch_tasks') {
    const period = asPreviewText(filters.period)
    const status = asPreviewText(filters.status)
    return data.batchTasks.filter((item) => (!period || item.period === period) && (!status || item.status === status)) as T
  }
  if (cmd === 'create_agency_batch_tasks') {
    const period = asPreviewText(input.period, new Date().toISOString().slice(0, 7))
    const taskTypes = Array.isArray(input.task_types) ? input.task_types.filter((item): item is string => typeof item === 'string') : browserBatchTaskTemplates.map(([taskType]) => taskType)
    const operator = asPreviewText(input.operator, 'admin')
    let created = 0
    let skipped = 0
    for (const [taskType, taskName, scope, summary, riskLevel, requiresApproval] of browserBatchTaskTemplates) {
      if (!taskTypes.includes(taskType)) continue
      const activeTask = data.batchTasks.some((item) => item.period === period && item.task_type === taskType && !['completed', 'cancelled'].includes(item.status))
      if (activeTask) {
        skipped += 1
        continue
      }
      data.batchTasks.unshift({
        id: browserAgencyId('agency-batch'), task_type: taskType, task_name: taskName, period, customer_scope: scope,
        status: 'queued', progress_current: 0, progress_total: null, result_summary: summary, risk_level: riskLevel,
        operator, requires_approval: requiresApproval, created_at: now, updated_at: now,
      })
      created += 1
    }
    saveBrowserAgencyPreviewData(data)
    return { created, skipped } as T
  }
  if (cmd === 'run_agency_batch_task_precheck') {
    const task = data.batchTasks.find((item) => item.id === asPreviewText(input.id))
    if (!task || task.status !== 'queued') throw new Error('当前任务状态不允许重复执行预检')
    task.status = task.requires_approval ? 'awaiting_approval' : 'prechecked'
    task.progress_current = 1
    task.progress_total = task.progress_total || 1
    task.operator = asPreviewText(input.operator, task.operator || 'admin')
    task.result_summary = task.requires_approval
      ? '本地预检完成，不会登录或调用税局、银行等外部系统；高风险任务待人工审批。'
      : '本地预检完成，不会登录或调用税局、银行等外部系统；后续采集需人工发起。'
    task.updated_at = now
    saveBrowserAgencyPreviewData(data)
    return task as T
  }
  if (cmd === 'review_agency_batch_task') {
    const task = data.batchTasks.find((item) => item.id === asPreviewText(input.id))
    if (!task || !task.requires_approval || task.status !== 'awaiting_approval') throw new Error('当前任务不在待审批状态')
    const approved = input.decision === 'approved'
    task.status = approved ? 'prechecked' : 'blocked'
    task.operator = asPreviewText(input.operator, task.operator || 'admin')
    task.result_summary = approved
      ? '本地预检已人工通过；未登录或调用税局、银行等外部系统，后续动作仍需人工发起。'
      : '本地预检已驳回并阻断后续操作；未登录或调用税局、银行等外部系统。'
    task.updated_at = now
    saveBrowserAgencyPreviewData(data)
    return task as T
  }

  if (cmd === 'get_agency_adapter_authorizations' || cmd === 'get_adapter_authorizations') {
    const companyId = asPreviewText(filters.companyId)
    const adapterType = asPreviewText(filters.adapterType)
    return data.authorizations.filter((item) => (!companyId || item.company_id === companyId) && (!adapterType || item.adapter_type === adapterType)) as T
  }
  if (cmd === 'upsert_adapter_authorization') {
    const existing = data.authorizations.find((item) => item.company_id === asPreviewText(input.company_id, firstCompanyId) && item.adapter_type === asPreviewText(input.adapter_type, 'tax'))
    const companyId = asPreviewText(input.company_id, existing?.company_id || firstCompanyId)
    const record: BrowserAdapterAuthorization = {
      id: existing?.id || browserAgencyId('agency-authorization'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      adapter_type: asPreviewText(input.adapter_type, existing?.adapter_type || 'tax'),
      adapter_code: asPreviewText(input.adapter_code, existing?.adapter_code || ''),
      region: asPreviewText(input.region, existing?.region || '') || null,
      auth_status: asPreviewText(input.auth_status, existing?.auth_status || 'pending'),
      account_mask: asPreviewText(input.account_mask, existing?.account_mask || '') || null,
      login_identity: asPreviewText(input.login_identity, existing?.login_identity || '') || null,
      capability_scope: asPreviewText(input.capability_scope, existing?.capability_scope || '') || null,
      last_checked_at: asPreviewText(input.last_checked_at, existing?.last_checked_at || now) || null,
      expires_at: asPreviewText(input.expires_at, existing?.expires_at || '') || null,
      risk_message: asPreviewText(input.risk_message, existing?.risk_message || '') || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.authorizations = upsertBrowserAgencyRecord(data.authorizations, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_tax_declaration_tasks') {
    const companyId = asPreviewText(filters.companyId)
    const period = asPreviewText(filters.period)
    const declarationStatus = asPreviewText(filters.declarationStatus)
    return data.taxDeclarationTasks.filter((item) => (
      (!companyId || item.company_id === companyId)
      && (!period || item.period === period)
      && (!declarationStatus || item.declaration_status === declarationStatus)
    )) as T
  }
  if (cmd === 'upsert_tax_declaration_task') {
    const companyId = asPreviewText(input.company_id, firstCompanyId)
    const period = asPreviewText(input.period, new Date().toISOString().slice(0, 7))
    const taxType = asPreviewText(input.tax_type)
    const existing = data.taxDeclarationTasks.find((item) => (
      item.company_id === companyId
      && item.period === period
      && item.tax_type === taxType
      && item.form_name === asPreviewText(input.form_name)
    ))
    const record: BrowserTaxDeclarationTask = {
      id: existing?.id || browserAgencyId('tax-declaration'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      period,
      tax_type: taxType,
      form_name: asPreviewText(input.form_name, existing?.form_name || ''),
      collect_status: asPreviewText(input.collect_status, existing?.collect_status || '未取数'),
      validation_status: asPreviewText(input.validation_status, existing?.validation_status || 'pending'),
      declaration_status: asPreviewText(input.declaration_status, existing?.declaration_status || 'draft'),
      source_snapshot: asPreviewText(input.source_snapshot, existing?.source_snapshot || '') || null,
      taxable_amount: asPreviewNumber(input.taxable_amount, existing?.taxable_amount || 0),
      deduction_amount: asPreviewNumber(input.deduction_amount, existing?.deduction_amount || 0),
      payable_amount: asPreviewNumber(input.payable_amount, existing?.payable_amount || 0),
      risk_count: asPreviewNumber(input.risk_count, existing?.risk_count || 0),
      adapter_code: asPreviewText(input.adapter_code, existing?.adapter_code || '') || null,
      confirmed_by: existing?.confirmed_by || null,
      confirmed_at: existing?.confirmed_at || null,
      receipt_no: asPreviewText(input.receipt_no, existing?.receipt_no || '') || null,
      payment_status: asPreviewText(input.payment_status, existing?.payment_status || 'unrecorded'),
      payment_no: asPreviewText(input.payment_no, existing?.payment_no || '') || null,
      receipt_received_at: asPreviewText(input.receipt_received_at, existing?.receipt_received_at || '') || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.taxDeclarationTasks = upsertBrowserAgencyRecord(data.taxDeclarationTasks, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }
  if (cmd === 'confirm_tax_declaration_task') {
    const task = data.taxDeclarationTasks.find((item) => (
      item.id === asPreviewText(input.id) && item.company_id === asPreviewText(input.company_id)
    ))
    if (!task) throw new Error('未找到需要确认的本地申报事项')
    if (task.validation_status !== 'passed' || task.risk_count > 0) {
      throw new Error('申报事项未通过校验或仍有风险，不能确认')
    }
    task.declaration_status = 'confirmed'
    task.confirmed_by = asPreviewText(input.confirmed_by, 'admin')
    task.confirmed_at = now
    task.updated_at = now
    saveBrowserAgencyPreviewData(data)
    return task as T
  }

  if (cmd === 'get_operation_audit_logs') {
    const companyId = asPreviewText(filters.companyId)
    const moduleName = asPreviewText(filters.moduleName)
    return data.operationAuditLogs.filter((item) => (
      (!companyId || item.company_id === companyId)
      && (!moduleName || item.module_name === moduleName)
    )) as T
  }
  if (cmd === 'write_operation_audit_log') {
    const companyId = asPreviewText(input.company_id) || null
    const record: BrowserOperationAuditLog = {
      id: browserAgencyId('operation-audit'),
      company_id: companyId,
      company_name: companyId ? browserAgencyCompanyName(companyId) : null,
      module_name: asPreviewText(input.module_name),
      action: asPreviewText(input.action),
      object_ref: asPreviewText(input.object_ref) || null,
      risk_level: asPreviewText(input.risk_level, 'normal'),
      result: asPreviewText(input.result, 'success'),
      detail: asPreviewText(input.detail) || null,
      operator: asPreviewText(input.operator, 'admin'),
      created_at: now,
    }
    data.operationAuditLogs.unshift(record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_agency_automation_jobs' || cmd === 'get_automation_jobs') {
    const companyId = asPreviewText(filters.companyId)
    const period = asPreviewText(filters.period)
    const status = asPreviewText(filters.status)
    return data.automationJobs.filter((item) => (!companyId || item.company_id === companyId) && (!period || item.period === period) && (!status || item.status === status)) as T
  }
  if (cmd === 'create_automation_job' || cmd === 'update_automation_job_status') {
    const existing = data.automationJobs.find((item) => item.id === asPreviewText(input.id))
    const companyId = asPreviewText(input.company_id, existing?.company_id || firstCompanyId)
    const record: BrowserAutomationJob = {
      id: existing?.id || browserAgencyId('automation-job'),
      company_id: companyId,
      company_name: browserAgencyCompanyName(companyId, existing?.company_name || null),
      period: asPreviewText(input.period, existing?.period || '') || null,
      job_type: asPreviewText(input.job_type, existing?.job_type || 'voucher_suggestion'),
      source_module: asPreviewText(input.source_module, existing?.source_module || 'manual'),
      source_id: asPreviewText(input.source_id, existing?.source_id || '') || null,
      source_file: asPreviewText(input.source_file, existing?.source_file || '') || null,
      suggestion_no: asPreviewText(input.suggestion_no, existing?.suggestion_no || '') || null,
      debit_subject: asPreviewText(input.debit_subject, existing?.debit_subject || '') || null,
      credit_subject: asPreviewText(input.credit_subject, existing?.credit_subject || '') || null,
      suggestion_amount: input.suggestion_amount === undefined ? existing?.suggestion_amount || null : asPreviewNumber(input.suggestion_amount),
      generated_voucher_id: existing?.generated_voucher_id || null,
      generated_voucher_number: existing?.generated_voucher_number || null,
      status: asPreviewText(input.status, existing?.status || 'queued'),
      confidence: input.confidence === undefined ? existing?.confidence || null : asPreviewNumber(input.confidence),
      result_summary: asPreviewText(input.result_summary, existing?.result_summary || '') || null,
      risk_level: asPreviewText(input.risk_level, existing?.risk_level || 'normal'),
      reviewer: asPreviewText(input.reviewer, existing?.reviewer || '') || null,
      created_by: asPreviewText(input.created_by, existing?.created_by || 'admin') || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    data.automationJobs = upsertBrowserAgencyRecord(data.automationJobs, record)
    saveBrowserAgencyPreviewData(data)
    return record as T
  }

  if (cmd === 'get_agency_health_checks') {
    const period = asPreviewText(filters.period)
    const feeRisks = data.fees.filter((item) => (!period || item.period === period) && (item.payment_status === 'overdue' || item.arrears_amount > 0)).map((item) => ({
      id: `fee-${item.id}`, company_id: item.company_id, company_name: browserAgencyCompanyName(item.company_id, item.company_name), module_name: '服务费开票',
      risk_message: `服务费欠费 ${item.arrears_amount.toFixed(2)} 元`, risk_level: item.payment_status === 'overdue' ? '高' : '中', owner: item.collector, resolution_status: item.payment_status === 'paid' ? '已完成' : '待跟进',
    }))
    const collaborationRisks = data.collaborations.filter((item) => item.reply_status === 'overdue' || item.status === 'overdue').map((item) => ({
      id: `collaboration-${item.id}`, company_id: item.company_id, company_name: browserAgencyCompanyName(item.company_id, item.company_name), module_name: '交付协同',
      risk_message: `客户协同超时：${item.todo_title}`, risk_level: '中', owner: item.owner, resolution_status: '待跟进',
    }))
    const batchRisks = data.batchTasks.filter((item) => item.status === 'blocked').map((item) => ({
      id: `batch-${item.id}`, company_id: firstCompanyId, company_name: browserAgencyCompanyName(firstCompanyId), module_name: '批量操作',
      risk_message: `预检已阻断：${item.task_name}`, risk_level: '高', owner: item.operator, resolution_status: '待审批',
    }))
    return [...feeRisks, ...collaborationRisks, ...batchRisks] as T
  }

  if (cmd === 'get_agency_operation_overview') {
    const period = asPreviewText(filters.period)
    const expiring = data.contracts.filter((item) => item.renewal_status !== 'normal' || item.status === 'overdue')
    const scopedFees = data.fees.filter((item) => !period || item.period === period)
    const pendingCollaboration = data.collaborations.filter((item) => item.status !== 'completed' && item.reply_status !== 'replied')
    const overdueCollaboration = data.collaborations.filter((item) => item.status === 'overdue' || item.reply_status === 'overdue')
    const openTasks = data.batchTasks.filter((item) => !['completed', 'cancelled', 'blocked'].includes(item.status))
    const blockedTasks = data.batchTasks.filter((item) => item.status === 'blocked')
    return {
      service_contracts: data.contracts.filter((item) => item.status === 'active').length,
      expiring_contracts: expiring.length,
      receivable_amount: scopedFees.reduce((sum, item) => sum + item.receivable_amount, 0),
      arrears_amount: scopedFees.reduce((sum, item) => sum + item.arrears_amount, 0),
      pending_collaboration: pendingCollaboration.length,
      overdue_collaboration: overdueCollaboration.length,
      open_tickets: openTasks.length,
      blocked_tickets: blockedTasks.length,
    } as T
  }

  const empty = EMPTY_RESULTS[cmd]
  if (empty !== undefined) {
    return empty as T
  }
  console.warn(`[tauri.ts] No mock data for command: ${cmd}`)
  return null as T
}

export const invoke: InvokeFn = isTauriEnv
  ? async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      if (!realInvoke) {
        const mod = await import('@tauri-apps/api/core')
        realInvoke = mod.invoke as InvokeFn
      }
      try {
        const result = args ? await realInvoke<T>(cmd, args) : await realInvoke<T>(cmd)
        return result
      } catch (error) {
        console.error(`[tauri.ts] Invoke '${cmd}' failed:`, error)
        throw error
      }
    }
  : browserInvoke
