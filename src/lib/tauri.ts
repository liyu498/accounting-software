import {
  closeBrowserPreviewPeriod,
  createBrowserPreviewPeriod,
  ensureBrowserPreviewPeriods,
  reopenBrowserPreviewPeriod,
} from "./browserPreviewPeriods.js";
import {
  createBrowserPreviewInvoice,
  filterBrowserPreviewInvoices,
  matchBrowserPreviewInvoiceToVoucher,
  updateBrowserPreviewInvoice,
} from "./browserPreviewInvoices.js";
import {
  createBrowserPreviewVoucher,
  getDeletedBrowserPreviewVouchers,
  queryBrowserPreviewVouchers,
  reverseBrowserPreviewVoucher,
  restoreBrowserPreviewVoucher,
  setBrowserPreviewVoucherStatus,
  softDeleteBrowserPreviewVoucher,
  updateBrowserPreviewVoucher,
} from "./browserPreviewVouchers.js";
import { copyBrowserPreviewVoucherTags } from "./browserPreviewBusinessTags.js";
import { buildAgencyCompanyProgressRows } from "./agencyCompanyProgress.js";
import {
  buildBrowserPreviewBalanceSheet,
  buildBrowserPreviewTrialBalance,
} from "./browserPreviewReports.js";
import { readBrowserPreviewSettlementRules } from "./browserPreviewSettlementRules.js";
import { buildSettlementRulePreview } from "./settlementExecutionWorkflow.js";
import {
  linkBrowserDepreciationVoucher,
  linkBrowserBusinessVoucherSource,
  loadBrowserBusinessVoucherSource,
  unlinkBrowserDepreciationVoucher,
  unlinkBrowserBusinessVoucherSources,
} from "./businessVoucherSourceWorkflow.js";
import {
  browserPreviewAccountAuxiliaryLinks,
  browserPreviewAccountAuxiliarySetup,
  browserPreviewAccountHasAuxiliary,
  browserPreviewAuxiliaryCategories,
  browserPreviewAuxiliaryItems,
} from "./browserPreviewAuxiliary.js";

const isTauriEnv =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export const isTauri = isTauriEnv;

const EMPTY_RESULTS: Record<string, unknown> = {
  get_companies: [],
  get_company: null,
  get_accounting_periods: [],
  get_open_periods: [],
  get_voucher_words: [],
  get_account_balances: [],
  get_trial_balance: { items: [], total_debit: 0, total_credit: 0 },
  get_accounting_reconciliation: {
    period_id: "",
    company_id: "",
    accounting_system: "",
    checks: [],
    passed_count: 0,
    blocked_count: 0,
    is_reconciled: false,
  },
  get_general_ledger: [],
  get_subsidiary_ledger: [],
  get_balance_sheet: {
    items: [],
    total_assets: 0,
    total_liabilities_equity: 0,
  },
  get_income_statement: {
    items: [],
    current_period_total: 0,
    year_to_date_total: 0,
    comparative_period_total: 0,
    column_basis: "monthly_ytd",
    has_comparative_period: false,
    classification_complete: true,
  },
  get_cash_flow_statement: {
    period_id: "",
    template_name: "现金流量表",
    accounting_system: "unconfigured",
    form_code: null,
    reporting_frequency: "按需",
    is_statutory: false,
    column_basis: "monthly_ytd",
    has_comparative_period: false,
    items: [],
    net_increase: 0,
    net_increase_year_to_date: 0,
    net_increase_comparative: 0,
    opening_cash_balance: 0,
    ending_cash_balance: 0,
    cash_balance_change: 0,
    cash_balance_change_year_to_date: 0,
    reconciliation_difference: 0,
    reconciliation_difference_year_to_date: 0,
    is_reconciled: false,
    classification_mode: "unconfigured",
    unmapped_cash_amount: 0,
    unmapped_cash_amount_year_to_date: 0,
    unmapped_voucher_count: 0,
    mapping_conflict_count: 0,
    is_classification_complete: false,
  },
  get_equity_change_statement: {
    items: [],
    columns: [],
    layout: "component_rows",
    has_comparative_period: false,
    classification_complete: true,
    comparative_classification_complete: true,
  },
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
  search_account_codes: [],
  get_subjects: [],
  get_subjects_by_type: [],
  get_subject: null,
  search_subjects: [],
  get_invoices: [],
  get_invoice: null,
  get_invoices_by_voucher: [],
  get_invoice_lines: [],
  get_invoice_tax_events: [],
  get_auxiliary_categories: [],
  get_auxiliary_items: [],
  get_all_auxiliary_items: [],
  get_special_deduction_records: [],
  get_bank_transactions: [],
  get_document_records: [],
  get_account_auxiliary_links: [],
  get_voucher_entry_auxiliaries: [],
  get_auxiliary_ledger: [],
  get_auxiliary_balance: [],
  get_account_auxiliary_setup: [],
  get_settlement_rules: [],
  get_currencies: [],
  get_roles: [],
  get_users_with_roles: [],
  get_company_memos: [],
  get_company_todos: [],
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
  get_adapter_authorizations: [],
  get_tax_deadline_rules: [],
  get_tax_calendar_days: [],
  get_tax_declaration_schedules: [],
  get_report_snapshots: [],
  get_report_snapshot: null,
  list_local_backups: [],
  check_permission: { allowed: true },
  get_initial_balance: null,
  suggest_summary: [],
  get_next_voucher_number: "001",
  get_auth_setup_status: { initialized: true },
  initialize_admin: null,
  login: {
    success: true,
    token: "dev-token",
    user: {
      id: "dev",
      username: "admin",
      real_name: "开发用户",
      role: "admin",
      role_id: null,
      permissions: [],
    },
    error: null,
  },
  check: {
    is_authenticated: true,
    user: {
      id: "dev",
      username: "admin",
      real_name: "开发用户",
      role: "admin",
      role_id: null,
      permissions: [],
    },
  },
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let realInvoke: InvokeFn | null = null;
const PROTECTED_INVOKE_TOKEN_KEY = "auth_token";
const PUBLIC_INVOKE_COMMANDS = new Set([
  "login",
  "logout",
  "check",
  "get_auth_setup_status",
  "initialize_admin",
]);

const AGENCY_PREVIEW_STORAGE_KEY = "accounting-preview-agency-data-v1";
const PREVIEW_COMPANY_STORAGE_KEY = "accounting-preview-companies-v1";
const PREVIEW_COMPANY_INFO_STORAGE_KEY = "accounting-preview-company-info-v1";
const PREVIEW_PERIOD_STORAGE_KEY = "accounting-preview-periods-v1";
const PREVIEW_INVOICE_STORAGE_KEY = "accounting-preview-invoices-v1";
const PREVIEW_INVOICE_LINE_STORAGE_KEY = "accounting-preview-invoice-lines-v1";
const PREVIEW_INVOICE_TAX_EVENT_STORAGE_KEY =
  "accounting-preview-invoice-tax-events-v1";
const PREVIEW_VOUCHER_STORAGE_KEY = "accounting-preview-vouchers-v1";
const PREVIEW_VOUCHER_LOG_STORAGE_KEY = "accounting-preview-voucher-logs-v1";
const PREVIEW_FIXED_ASSET_STORAGE_KEY =
  "accounting-preview-fixed-asset-data-v1";
const PREVIEW_DEPRECIATION_BATCH_STORAGE_KEY =
  "accounting-preview-depreciation-batches-v1";
const PREVIEW_DEPRECIATION_LINE_STORAGE_KEY =
  "accounting-preview-depreciation-lines-v1";

type BrowserPreviewPeriod = {
  id: string;
  company_id: string;
  period_year: number;
  period_month: number;
  start_date: string;
  end_date: string;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserPreviewInvoice = {
  id: string;
  company_id: string;
  period_id: string | null;
  invoice_type: string;
  invoice_no: string;
  invoice_code: string | null;
  invoice_date: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number | null;
  seller_name: string | null;
  seller_tax_id: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  status: string;
  voucher_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserPreviewInvoiceLine = {
  id: string;
  invoice_id: string;
  company_id: string;
  line_no: number;
  item_name: string;
  specification: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  tax_rate: number | null;
  tax_amount: number;
  tax_classification_code: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserPreviewInvoiceTaxEvent = {
  id: string;
  invoice_id: string;
  company_id: string;
  event_type: string;
  deduction_period: string | null;
  deductible_tax_amount: number;
  source: string;
  reference_no: string | null;
  remarks: string | null;
  operator: string;
  occurred_at: string;
};

type BrowserPreviewVoucher = {
  id: string;
  company_id: string;
  period_id: string;
  voucher_word_id: string;
  voucher_number: string;
  sequence_num: number;
  voucher_date: string;
  summary: string | null;
  attachment_count: number;
  status: string;
  total_debit: number;
  total_credit: number;
  version: number;
  created_by: string | null;
  created_at: string | null;
  reference_number: string | null;
  modified_by: string | null;
  modified_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_of_id: string | null;
  is_system: number;
  is_settlement: number;
  settlement_rule_id: string | null;
  is_deleted: number;
  deleted_at: string | null;
  entries: Array<Record<string, unknown>>;
};

type BrowserPreviewVoucherLog = {
  id: string;
  voucher_id: string;
  operation_type: string;
  before_data: string | null;
  after_data: string | null;
  operator_id: string | null;
  created_at: string;
};

type BrowserAgencyContract = {
  id: string;
  company_id: string;
  company_name: string | null;
  contract_no: string;
  service_package: string;
  service_start: string;
  service_end: string;
  monthly_fee: number;
  renewal_status: string;
  owner: string | null;
  archive_status: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserAgencyFee = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string;
  receivable_amount: number;
  received_amount: number;
  arrears_amount: number;
  invoice_status: string;
  payment_status: string;
  collector: string | null;
  last_follow_up: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserAgencyCollaboration = {
  id: string;
  company_id: string;
  company_name: string | null;
  todo_title: string;
  material_type: string | null;
  customer_contact: string | null;
  reminder_count: number;
  last_contact_at: string | null;
  reply_status: string;
  owner: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserAgencyBatchTask = {
  id: string;
  task_type: string;
  task_name: string;
  period: string;
  customer_scope: string;
  status: string;
  progress_current: number;
  progress_total: number | null;
  result_summary: string | null;
  risk_level: string;
  operator: string | null;
  requires_approval: number;
  created_at: string;
  updated_at: string;
};

type BrowserAgencyBatchTaskItem = {
  id: string;
  task_id: string;
  company_id: string;
  company_name: string | null;
  period_id: string | null;
  action: string;
  status: string;
  result_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserAutomationJob = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string | null;
  job_type: string;
  source_module: string;
  source_id: string | null;
  source_file: string | null;
  suggestion_no: string | null;
  debit_subject: string | null;
  credit_subject: string | null;
  suggestion_amount: number | null;
  generated_voucher_id: string | null;
  generated_voucher_number: string | null;
  status: string;
  confidence: number | null;
  result_summary: string | null;
  risk_level: string;
  reviewer: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserAiProviderConfig = {
  id: string;
  company_id: string;
  provider_name: string;
  provider_type: string;
  endpoint: string;
  model: string;
  credential_env: string;
  timeout_seconds: number;
  max_file_bytes: number;
  is_enabled: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type BrowserAdapterAuthorization = {
  id: string;
  company_id: string;
  company_name: string | null;
  adapter_type: string;
  adapter_code: string;
  region: string | null;
  auth_status: string;
  account_mask: string | null;
  login_identity: string | null;
  capability_scope: string | null;
  last_checked_at: string | null;
  expires_at: string | null;
  risk_message: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserTaxDeclarationTask = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string;
  tax_type: string;
  form_name: string;
  collect_status: string;
  validation_status: string;
  declaration_status: string;
  source_snapshot: string | null;
  taxable_amount: number;
  deduction_amount: number;
  payable_amount: number;
  risk_count: number;
  adapter_code: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  receipt_no: string | null;
  payment_status: string;
  payment_no: string | null;
  receipt_received_at: string | null;
  snapshot_version: number;
  snapshot_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

type BrowserOperationAuditLog = {
  id: string;
  company_id: string | null;
  company_name: string | null;
  module_name: string;
  action: string;
  object_ref: string | null;
  risk_level: string;
  result: string;
  detail: string | null;
  operator: string | null;
  created_at: string;
};

type BrowserBankTransaction = {
  id: string;
  company_id: string;
  period: string;
  account_name: string;
  serial_no: string;
  transaction_date: string;
  counterparty: string | null;
  summary: string | null;
  income_amount: number;
  expense_amount: number;
  balance: number | null;
  receipt_status: string;
  match_result: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserEmployee = {
  id: string;
  company_id: string;
  employee_code: string;
  name: string;
  id_no: string | null;
  department: string | null;
  position: string | null;
  mobile: string | null;
  entry_date: string | null;
  employment_status: string;
  created_at: string;
  updated_at: string;
};

type BrowserPayrollRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  base_salary: number;
  bonus: number;
  tax_amount: number;
  social_personal: number;
  net_salary: number;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserSocialSecurityRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  city: string | null;
  contribution_base: number;
  company_amount: number;
  personal_amount: number;
  fund_amount: number;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrowserAgencyPreviewData = {
  contracts: BrowserAgencyContract[];
  fees: BrowserAgencyFee[];
  collaborations: BrowserAgencyCollaboration[];
  batchTasks: BrowserAgencyBatchTask[];
  batchTaskItems: BrowserAgencyBatchTaskItem[];
  automationJobs: BrowserAutomationJob[];
  aiProviderConfigs: BrowserAiProviderConfig[];
  authorizations: BrowserAdapterAuthorization[];
  taxDeclarationTasks: BrowserTaxDeclarationTask[];
  operationAuditLogs: BrowserOperationAuditLog[];
  bankTransactions: BrowserBankTransaction[];
  employees: BrowserEmployee[];
  payrollRecords: BrowserPayrollRecord[];
  socialSecurityRecords: BrowserSocialSecurityRecord[];
};

type BrowserPreviewCompany = {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account: string | null;
  tax_type: string | null;
  industry: string | null;
  accounting_system: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  enterprise_type: string | null;
  service_start: string | null;
  service_end: string | null;
  enable_year: number | null;
  enable_month: number | null;
  is_active: number;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emptyBrowserAgencyPreviewData(): BrowserAgencyPreviewData {
  return {
    contracts: [],
    fees: [],
    collaborations: [],
    batchTasks: [],
    batchTaskItems: [],
    automationJobs: [],
    aiProviderConfigs: [],
    authorizations: [],
    taxDeclarationTasks: [],
    operationAuditLogs: [],
    bankTransactions: [],
    employees: [],
    payrollRecords: [],
    socialSecurityRecords: [],
  };
}

function loadBrowserAgencyPreviewData(): BrowserAgencyPreviewData {
  const storage = browserStorage();
  if (!storage) return emptyBrowserAgencyPreviewData();
  try {
    const parsed = JSON.parse(
      storage.getItem(AGENCY_PREVIEW_STORAGE_KEY) || "null",
    ) as Partial<BrowserAgencyPreviewData> | null;
    if (!parsed || typeof parsed !== "object")
      return emptyBrowserAgencyPreviewData();
    return {
      contracts: Array.isArray(parsed.contracts)
        ? (parsed.contracts as BrowserAgencyContract[])
        : [],
      fees: Array.isArray(parsed.fees)
        ? (parsed.fees as BrowserAgencyFee[])
        : [],
      collaborations: Array.isArray(parsed.collaborations)
        ? (parsed.collaborations as BrowserAgencyCollaboration[])
        : [],
      batchTasks: Array.isArray(parsed.batchTasks)
        ? (parsed.batchTasks as BrowserAgencyBatchTask[])
        : [],
      batchTaskItems: Array.isArray(parsed.batchTaskItems)
        ? (parsed.batchTaskItems as BrowserAgencyBatchTaskItem[])
        : [],
      automationJobs: Array.isArray(parsed.automationJobs)
        ? (parsed.automationJobs as BrowserAutomationJob[])
        : [],
      aiProviderConfigs: Array.isArray(parsed.aiProviderConfigs)
        ? (parsed.aiProviderConfigs as BrowserAiProviderConfig[])
        : [],
      authorizations: Array.isArray(parsed.authorizations)
        ? (parsed.authorizations as BrowserAdapterAuthorization[])
        : [],
      taxDeclarationTasks: Array.isArray(parsed.taxDeclarationTasks)
        ? (parsed.taxDeclarationTasks as BrowserTaxDeclarationTask[]).map(
            (task) => ({
              ...task,
              snapshot_version: Number(task.snapshot_version || 0),
              snapshot_fingerprint: task.snapshot_fingerprint || null,
            }),
          )
        : [],
      operationAuditLogs: Array.isArray(parsed.operationAuditLogs)
        ? (parsed.operationAuditLogs as BrowserOperationAuditLog[])
        : [],
      bankTransactions: Array.isArray(parsed.bankTransactions)
        ? (parsed.bankTransactions as BrowserBankTransaction[])
        : [],
      employees: Array.isArray(parsed.employees)
        ? (parsed.employees as BrowserEmployee[])
        : [],
      payrollRecords: Array.isArray(parsed.payrollRecords)
        ? (parsed.payrollRecords as BrowserPayrollRecord[])
        : [],
      socialSecurityRecords: Array.isArray(parsed.socialSecurityRecords)
        ? (parsed.socialSecurityRecords as BrowserSocialSecurityRecord[])
        : [],
    };
  } catch {
    return emptyBrowserAgencyPreviewData();
  }
}

function saveBrowserAgencyPreviewData(data: BrowserAgencyPreviewData) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(AGENCY_PREVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function asPreviewText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asPreviewNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function browserPreviewCompanyFromInput(
  input: Record<string, unknown>,
  existing?: BrowserPreviewCompany,
): BrowserPreviewCompany {
  const now = new Date().toISOString();
  return {
    id: asPreviewText(
      input.id,
      existing?.id || browserAgencyId("browser-company"),
    ),
    code: asPreviewText(input.code, existing?.code || "PREVIEW"),
    name: asPreviewText(input.name, existing?.name || ""),
    tax_id:
      asPreviewText(input.tax_id ?? input.taxId, existing?.tax_id || "") ||
      null,
    contact: null,
    phone: null,
    email: null,
    address: null,
    bank_name: null,
    bank_account: null,
    tax_type:
      asPreviewText(
        input.tax_type ?? input.taxpayerType,
        existing?.tax_type || "",
      ) || null,
    industry: asPreviewText(input.industry, existing?.industry || "") || null,
    accounting_system:
      asPreviewText(
        input.accounting_system ?? input.accountingSystem,
        existing?.accounting_system || "",
      ) || null,
    province: asPreviewText(input.province, existing?.province || "") || null,
    city: asPreviewText(input.city, existing?.city || "") || null,
    district: asPreviewText(input.district, existing?.district || "") || null,
    enterprise_type:
      asPreviewText(
        input.enterprise_type ?? input.enterpriseType,
        existing?.enterprise_type || "",
      ) || null,
    service_start:
      asPreviewText(
        input.service_start ?? input.serviceStart,
        existing?.service_start || "",
      ) || null,
    service_end:
      asPreviewText(
        input.service_end ?? input.serviceEnd,
        existing?.service_end || "",
      ) || null,
    enable_year:
      asPreviewNumber(
        input.enable_year ?? input.enableYear,
        existing?.enable_year || 0,
      ) || null,
    enable_month:
      asPreviewNumber(
        input.enable_month ?? input.enableMonth,
        existing?.enable_month || 0,
      ) || null,
    is_active: existing?.is_active ?? 1,
    is_deleted: existing?.is_deleted ?? 0,
    deleted_at: existing?.deleted_at ?? null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

function saveBrowserPreviewCompanies(companies: BrowserPreviewCompany[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_COMPANY_STORAGE_KEY, JSON.stringify(companies));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function syncBrowserPreviewCompanyInfo(company: BrowserPreviewCompany) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      PREVIEW_COMPANY_INFO_STORAGE_KEY,
      JSON.stringify({
        id: company.id,
        code: company.code,
        name: company.name,
        taxId: company.tax_id || "",
        taxpayerType: company.tax_type || "general",
        province: company.province || "",
        city: company.city || "",
        district: company.district || "",
        accountingSystem: company.accounting_system || "small_enterprise",
        enableYear: company.enable_year || "",
        enableMonth: company.enable_month || "",
        serviceStart: company.service_start || "",
        serviceEnd: company.service_end || "",
        industry: company.industry || "",
        enterpriseType: company.enterprise_type || "私营有限责任公司",
      }),
    );
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewCompanies(): BrowserPreviewCompany[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_COMPANY_STORAGE_KEY) || "null",
    ) as unknown;
    if (Array.isArray(stored)) {
      return stored.filter((item): item is BrowserPreviewCompany =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as BrowserPreviewCompany).id === "string" &&
          typeof (item as BrowserPreviewCompany).name === "string",
        ),
      );
    }

    const legacyDraft = JSON.parse(
      storage.getItem(PREVIEW_COMPANY_INFO_STORAGE_KEY) || "null",
    ) as Record<string, unknown> | null;
    if (
      !legacyDraft ||
      typeof legacyDraft.name !== "string" ||
      !legacyDraft.name.trim()
    )
      return [];
    return [
      browserPreviewCompanyFromInput({
        ...legacyDraft,
        id: "browser-preview-company",
      }),
    ];
  } catch {
    return [];
  }
}

function readBrowserPreviewPeriods(): BrowserPreviewPeriod[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_PERIOD_STORAGE_KEY) || "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is BrowserPreviewPeriod =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserPreviewPeriod).id === "string" &&
        typeof (item as BrowserPreviewPeriod).company_id === "string" &&
        Number.isInteger((item as BrowserPreviewPeriod).period_year) &&
        Number.isInteger((item as BrowserPreviewPeriod).period_month),
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserPreviewPeriods(periods: BrowserPreviewPeriod[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_PERIOD_STORAGE_KEY, JSON.stringify(periods));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewInvoices(): BrowserPreviewInvoice[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_INVOICE_STORAGE_KEY) || "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is BrowserPreviewInvoice =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserPreviewInvoice).id === "string" &&
        typeof (item as BrowserPreviewInvoice).company_id === "string" &&
        typeof (item as BrowserPreviewInvoice).invoice_no === "string",
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserPreviewInvoices(invoices: BrowserPreviewInvoice[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_INVOICE_STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewInvoiceLines(): BrowserPreviewInvoiceLine[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_INVOICE_LINE_STORAGE_KEY) || "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.filter(
          (item): item is BrowserPreviewInvoiceLine =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as BrowserPreviewInvoiceLine).invoice_id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function saveBrowserPreviewInvoiceLines(lines: BrowserPreviewInvoiceLine[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_INVOICE_LINE_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewInvoiceTaxEvents(): BrowserPreviewInvoiceTaxEvent[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_INVOICE_TAX_EVENT_STORAGE_KEY) || "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.filter(
          (item): item is BrowserPreviewInvoiceTaxEvent =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as BrowserPreviewInvoiceTaxEvent).invoice_id ===
              "string",
        )
      : [];
  } catch {
    return [];
  }
}

function saveBrowserPreviewInvoiceTaxEvents(
  events: BrowserPreviewInvoiceTaxEvent[],
) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      PREVIEW_INVOICE_TAX_EVENT_STORAGE_KEY,
      JSON.stringify(events),
    );
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewVouchers(): BrowserPreviewVoucher[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_VOUCHER_STORAGE_KEY) || "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is BrowserPreviewVoucher =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserPreviewVoucher).id === "string" &&
        typeof (item as BrowserPreviewVoucher).company_id === "string" &&
        typeof (item as BrowserPreviewVoucher).period_id === "string" &&
        Array.isArray((item as BrowserPreviewVoucher).entries),
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserPreviewVouchers(vouchers: BrowserPreviewVoucher[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_VOUCHER_STORAGE_KEY, JSON.stringify(vouchers));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewVoucherLogs(): BrowserPreviewVoucherLog[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const stored = JSON.parse(
      storage.getItem(PREVIEW_VOUCHER_LOG_STORAGE_KEY) || "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is BrowserPreviewVoucherLog =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserPreviewVoucherLog).id === "string" &&
        typeof (item as BrowserPreviewVoucherLog).voucher_id === "string",
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserPreviewVoucherLogs(logs: BrowserPreviewVoucherLog[]) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(PREVIEW_VOUCHER_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewFixedAssets(): Array<Record<string, unknown>> {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(PREVIEW_FIXED_ASSET_STORAGE_KEY) || "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
      : [];
  } catch {
    return [];
  }
}

function readBrowserPreviewDepreciationBatches(): Array<
  Record<string, unknown>
> {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(PREVIEW_DEPRECIATION_BATCH_STORAGE_KEY) || "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
      : [];
  } catch {
    return [];
  }
}

function saveBrowserPreviewDepreciationBatches(
  batches: Array<Record<string, unknown>>,
) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      PREVIEW_DEPRECIATION_BATCH_STORAGE_KEY,
      JSON.stringify(batches),
    );
  } catch {
    // Browser preview remains read-only when local storage is unavailable.
  }
}

function readBrowserPreviewDepreciationLines(): Array<
  Record<string, unknown>
> {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(PREVIEW_DEPRECIATION_LINE_STORAGE_KEY) || "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
      : [];
  } catch {
    return [];
  }
}

function saveBrowserPreviewDepreciationLines(
  lines: Array<Record<string, unknown>>,
) {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(PREVIEW_DEPRECIATION_LINE_STORAGE_KEY, JSON.stringify(lines));
}

function browserPreviewAccountCodes(companyId: string) {
  return [
    ["1001", "库存现金", "asset", "debit"],
    ["1002", "银行存款", "asset", "debit"],
    ["1122", "应收账款", "asset", "debit"],
    ["1405", "库存商品", "asset", "debit"],
    ["1602", "累计折旧", "asset", "credit"],
    ["2211", "应付职工薪酬", "liability", "credit"],
    ["2221", "应交税费", "liability", "credit"],
    ["2202", "应付账款", "liability", "credit"],
    ["5001", "主营业务收入", "revenue", "credit"],
    ["4103", "本年利润", "equity", "credit"],
    ["6602", "管理费用", "expense", "debit"],
  ].map(([code, name, accountType, normalBalance]) => ({
    code,
    company_id: companyId,
    name,
    account_type: accountType,
    normal_balance: normalBalance,
    level: 1,
    parent_code: null,
    is_detail: 1,
    is_enabled: 1,
    has_quantity: 0,
    default_unit: null,
    has_auxiliary: browserPreviewAccountHasAuxiliary(code) ? 1 : 0,
  }));
}

function sortBrowserPreviewPeriods(
  periods: BrowserPreviewPeriod[],
  descending = false,
) {
  return [...periods].sort((left, right) => {
    const difference =
      left.period_year - right.period_year ||
      left.period_month - right.period_month;
    return descending ? -difference : difference;
  });
}

function browserAgencyCompanyName(
  companyId: string,
  storedName: string | null = null,
) {
  return (
    readBrowserPreviewCompanies().find((company) => company.id === companyId)
      ?.name ||
    storedName ||
    "未关联客户"
  );
}

function browserAgencyId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function browserTaxSnapshotFingerprint(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `t${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function upsertBrowserAgencyRecord<T extends { id: string }>(
  records: T[],
  record: T,
) {
  return [record, ...records.filter((item) => item.id !== record.id)];
}

const browserBatchTaskTemplates = [
  [
    "invoice_collection",
    "批量采集发票",
    "全部已授权税务客户",
    "检查税务授权后执行",
    "medium",
    0,
  ],
  [
    "bank_collection",
    "批量采集银行流水",
    "已授权银行客户",
    "检查银行授权后执行",
    "medium",
    0,
  ],
  [
    "voucher_generation_precheck",
    "批量生成凭证预检",
    "已完成资料核验客户",
    "只生成凭证建议与待确认草稿",
    "medium",
    0,
  ],
  [
    "closing_precheck",
    "批量结账预检",
    "待结账客户",
    "需完成风险检查",
    "high",
    1,
  ],
  [
    "tax_declaration_precheck",
    "批量申报预检",
    "待申报税种",
    "只生成申报包，不自动提交税局",
    "high",
    1,
  ],
  [
    "declaration_receipt_archive",
    "申报回执归档预检",
    "已确认申报事项",
    "只核验本地回执和缴款书归档条件",
    "high",
    1,
  ],
] as const;

async function browserInvoke<T>(
  cmd: string,
  _args?: Record<string, unknown>,
): Promise<T> {
  const input = (_args?.input ?? {}) as Record<string, unknown>;
  const filters = (_args ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const data = loadBrowserAgencyPreviewData();
  const firstCompanyId =
    readBrowserPreviewCompanies()[0]?.id || "browser-preview-company";

  if (cmd === "publish_report_snapshot") {
    throw new Error("报表快照必须在桌面数据库中重新取数并发布");
  }

  if (cmd === "get_companies")
    return readBrowserPreviewCompanies().filter(
      (company) => company.is_deleted !== 1,
    ) as T;
  if (cmd === "get_deleted_companies")
    return readBrowserPreviewCompanies().filter(
      (company) => company.is_deleted === 1,
    ) as T;
  if (cmd === "get_company")
    return (readBrowserPreviewCompanies().find(
      (company) => company.id === asPreviewText(filters.id),
    ) || null) as T;
  if (cmd === "create_company") {
    const company = browserPreviewCompanyFromInput(input);
    if (!company.name || !company.tax_id)
      throw new Error("请填写企业名称和纳税人识别号");
    const companies = [...readBrowserPreviewCompanies(), company];
    saveBrowserPreviewCompanies(companies);
    saveBrowserPreviewPeriods(
      ensureBrowserPreviewPeriods({
        company,
        periods: readBrowserPreviewPeriods(),
        now: new Date(now),
      }) as BrowserPreviewPeriod[],
    );
    syncBrowserPreviewCompanyInfo(company);
    return company as T;
  }
  if (cmd === "update_company") {
    const companyId = asPreviewText(filters.id);
    const companies = readBrowserPreviewCompanies();
    const existing = companies.find((company) => company.id === companyId);
    if (!existing) throw new Error("未找到需要更新的企业档案");
    const company = browserPreviewCompanyFromInput(
      { ...input, id: companyId },
      existing,
    );
    saveBrowserPreviewCompanies(
      companies.map((item) => (item.id === companyId ? company : item)),
    );
    syncBrowserPreviewCompanyInfo(company);
    return company as T;
  }
  if (
    cmd === "deactivate_company" ||
    cmd === "activate_company" ||
    cmd === "restore_company"
  ) {
    const companyId = asPreviewText(filters.id);
    const companies = readBrowserPreviewCompanies();
    const existing = companies.find((company) => company.id === companyId);
    if (!existing) throw new Error("未找到需要更新的企业档案");
    const company = {
      ...existing,
      is_active: cmd === "deactivate_company" ? 0 : 1,
      is_deleted: cmd === "restore_company" ? 0 : existing.is_deleted,
      deleted_at: cmd === "restore_company" ? null : existing.deleted_at,
      updated_at: now,
    };
    saveBrowserPreviewCompanies(
      companies.map((item) => (item.id === companyId ? company : item)),
    );
    syncBrowserPreviewCompanyInfo(company);
    return company as T;
  }
  if (cmd === "delete_company") {
    const companyId = asPreviewText(filters.id);
    const companies = readBrowserPreviewCompanies();
    const existing = companies.find((company) => company.id === companyId);
    if (!existing) throw new Error("未找到需要删除的企业档案");
    const company = {
      ...existing,
      is_active: 0,
      is_deleted: 1,
      deleted_at: now,
      updated_at: now,
    };
    saveBrowserPreviewCompanies(
      companies.map((item) => (item.id === companyId ? company : item)),
    );
    return undefined as T;
  }
  if (cmd === "permanent_delete_company") {
    const companyId = asPreviewText(filters.id);
    saveBrowserPreviewCompanies(
      readBrowserPreviewCompanies().filter(
        (company) => company.id !== companyId,
      ),
    );
    saveBrowserPreviewPeriods(
      readBrowserPreviewPeriods().filter(
        (period) => period.company_id !== companyId,
      ),
    );
    saveBrowserPreviewInvoices(
      readBrowserPreviewInvoices().filter(
        (invoice) => invoice.company_id !== companyId,
      ),
    );
    saveBrowserPreviewVouchers(
      readBrowserPreviewVouchers().filter(
        (voucher) => voucher.company_id !== companyId,
      ),
    );
    return undefined as T;
  }

  if (cmd === "ensure_periods") {
    const companyId = asPreviewText(filters.companyId);
    const company = readBrowserPreviewCompanies().find(
      (item) => item.id === companyId,
    );
    if (!company) throw new Error("未找到需要初始化账期的企业");
    const periods = ensureBrowserPreviewPeriods({
      company,
      periods: readBrowserPreviewPeriods(),
      now: new Date(now),
    }) as BrowserPreviewPeriod[];
    saveBrowserPreviewPeriods(periods);
    return sortBrowserPreviewPeriods(
      periods.filter((period) => period.company_id === companyId),
    ) as T;
  }
  if (cmd === "get_accounting_periods" || cmd === "get_open_periods") {
    const companyId = asPreviewText(filters.companyId);
    const openOnly = cmd === "get_open_periods";
    return sortBrowserPreviewPeriods(
      readBrowserPreviewPeriods().filter(
        (period) =>
          period.company_id === companyId &&
          (!openOnly || period.status === "open"),
      ),
      cmd === "get_accounting_periods",
    ) as T;
  }
  if (cmd === "create_accounting_period") {
    const periods = readBrowserPreviewPeriods();
    const period = createBrowserPreviewPeriod({
      companyId: asPreviewText(input.company_id),
      year: asPreviewNumber(input.period_year),
      month: asPreviewNumber(input.period_month),
      periods,
      now: new Date(now),
    }) as BrowserPreviewPeriod;
    saveBrowserPreviewPeriods([...periods, period]);
    return period as T;
  }
  if (cmd === "close_period") {
    const result = closeBrowserPreviewPeriod({
      periodId: asPreviewText(input.period_id),
      periods: readBrowserPreviewPeriods(),
      closedBy: asPreviewText(input.closed_by) || "admin",
      now: new Date(now),
    }) as { period: BrowserPreviewPeriod; periods: BrowserPreviewPeriod[] };
    saveBrowserPreviewPeriods(result.periods);
    return result.period as T;
  }
  if (cmd === "reopen_period") {
    const result = reopenBrowserPreviewPeriod({
      periodId: asPreviewText(filters.periodId),
      periods: readBrowserPreviewPeriods(),
      now: new Date(now),
    }) as { period: BrowserPreviewPeriod; periods: BrowserPreviewPeriod[] };
    saveBrowserPreviewPeriods(result.periods);
    return result.period as T;
  }

  if (cmd === "get_voucher_words") {
    const companyId = asPreviewText(filters.companyId);
    return [
      {
        id: `browser-voucher-word-${companyId}-ji`,
        company_id: companyId,
        word_code: "记",
        word_name: "记",
        is_enabled: 1,
      },
    ] as T;
  }

  if (cmd === "get_fixed_assets") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    return readBrowserPreviewFixedAssets()
      .filter(
        (asset) =>
          asPreviewText(asset.companyId) === companyId &&
          asPreviewText(asset.period) <= period &&
          asPreviewText(asset.status) !== "已处置",
      )
      .map((asset) => ({
        id: asPreviewText(asset.id),
        company_id: asPreviewText(asset.companyId),
        period: asPreviewText(asset.period),
        asset_code: asPreviewText(asset.assetCode),
        asset_name: asPreviewText(asset.assetName),
        category: asPreviewText(asset.category),
        category_id: asPreviewText(asset.categoryId) || null,
        start_date: asPreviewText(asset.startDate),
        original_value: asPreviewNumber(asset.originalValue),
        useful_life_months: asPreviewNumber(asset.usefulLifeMonths),
        residual_rate: asPreviewNumber(asset.residualRate),
        depreciation_method: asPreviewText(
          asset.depreciationMethod,
          "平均年限法",
        ),
        asset_account: asPreviewText(asset.assetAccount, "1601"),
        accumulated_depreciation_account: asPreviewText(
          asset.accumulatedDepreciationAccount,
          "1602",
        ),
        expense_account: asPreviewText(asset.expenseAccount) || null,
        opening_accumulated_depreciation: asPreviewNumber(
          asset.openingAccumulatedDepreciation,
        ),
        opening_depreciation_months: asPreviewNumber(
          asset.openingDepreciationMonths,
        ),
        source_document: asPreviewText(asset.sourceDocument) || null,
        status: asPreviewText(asset.status, "待计提"),
        created_at: asPreviewText(asset.createdAt, now),
        updated_at: asPreviewText(asset.updatedAt, now),
      })) as T;
  }
  if (cmd === "get_fixed_asset_depreciation_batch") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    const batch = readBrowserPreviewDepreciationBatches().find(
      (item) =>
        asPreviewText(item.companyId) === companyId &&
        asPreviewText(item.period) === period,
    );
    return (
      batch
        ? {
            id: asPreviewText(batch.id),
            company_id: companyId,
            period,
            asset_count: asPreviewNumber(batch.assetCount),
            depreciation_amount: asPreviewNumber(batch.depreciationAmount),
            voucher_id: asPreviewText(batch.voucherId) || null,
            voucher_number: asPreviewText(batch.voucherNumber) || null,
            status: asPreviewText(batch.status, "待复核"),
            created_at: asPreviewText(batch.createdAt, now),
            updated_at: asPreviewText(batch.updatedAt, now),
          }
        : null
    ) as T;
  }
  if (cmd === "get_fixed_asset_depreciation_lines") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    return readBrowserPreviewDepreciationLines()
      .filter(
        (line) =>
          asPreviewText(line.companyId) === companyId &&
          asPreviewText(line.period) === period,
      )
      .map((line) => ({
        id: asPreviewText(line.id),
        batch_id: asPreviewText(line.batchId),
        company_id: companyId,
        period,
        asset_id: asPreviewText(line.assetId),
        asset_code: asPreviewText(line.assetCode),
        asset_name: asPreviewText(line.assetName),
        category: asPreviewText(line.category),
        depreciation_method: asPreviewText(line.depreciationMethod),
        expense_account: asPreviewText(line.expenseAccount),
        accumulated_depreciation_account: asPreviewText(
          line.accumulatedDepreciationAccount,
        ),
        depreciable_amount: asPreviewNumber(line.depreciableAmount),
        months_depreciated: asPreviewNumber(line.monthsDepreciated),
        opening_accumulated_depreciation: asPreviewNumber(
          line.openingAccumulatedDepreciation,
        ),
        depreciation_amount: asPreviewNumber(line.depreciationAmount),
        closing_accumulated_depreciation: asPreviewNumber(
          line.closingAccumulatedDepreciation,
        ),
        closing_net_value: asPreviewNumber(line.closingNetValue),
        voucher_id: asPreviewText(line.voucherId) || null,
        status: asPreviewText(line.status, "待复核"),
        created_at: asPreviewText(line.createdAt, now),
        updated_at: asPreviewText(line.updatedAt, now),
      })) as T;
  }
  if (cmd === "prepare_fixed_asset_depreciation_batch") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    const periodIndex = (value: string) => {
      const match = value.match(/^(\d{4})-(\d{2})$/);
      if (!match) throw new Error("账期格式应为 YYYY-MM");
      const month = Number(match[2]);
      if (month < 1 || month > 12) throw new Error("账期格式应为 YYYY-MM");
      return Number(match[1]) * 12 + month - 1;
    };
    const targetIndex = periodIndex(period);
    const existingBatch = readBrowserPreviewDepreciationBatches().find(
      (batch) =>
        asPreviewText(batch.companyId) === companyId &&
        asPreviewText(batch.period) === period,
    );
    if (asPreviewText(existingBatch?.voucherId)) {
      throw new Error("已有凭证的折旧批次不能重新计算");
    }
    const batchId =
      asPreviewText(existingBatch?.id) ||
      `preview-depreciation-${companyId}-${period}`;
    const allLines = readBrowserPreviewDepreciationLines();
    const retainedLines = allLines.filter(
      (line) =>
        !(
          asPreviewText(line.companyId) === companyId &&
          asPreviewText(line.period) === period
        ),
    );
    const newLines: Array<Record<string, unknown>> = [];
    for (const asset of readBrowserPreviewFixedAssets().filter(
      (item) =>
        asPreviewText(item.companyId) === companyId &&
        asPreviewText(item.period) <= period &&
        asPreviewText(item.status) !== "已处置",
    )) {
      const startPeriod = asPreviewText(asset.startDate).slice(0, 7);
      const startIndex = periodIndex(startPeriod) + 1;
      const elapsedMonths = targetIndex - startIndex;
      const life = asPreviewNumber(asset.usefulLifeMonths);
      if (elapsedMonths < 0 || elapsedMonths >= life) continue;
      if (asPreviewText(asset.depreciationMethod, "平均年限法") !== "平均年限法") {
        throw new Error(
          `资产 ${asPreviewText(asset.assetCode)} 使用的折旧方法暂不支持自动计算`,
        );
      }
      const priorLines = allLines.filter(
        (line) =>
          asPreviewText(line.companyId) === companyId &&
          asPreviewText(line.assetId) === asPreviewText(asset.id) &&
          asPreviewText(line.period) < period,
      );
      if (priorLines.some((line) => !asPreviewText(line.voucherId))) {
        throw new Error(
          `资产 ${asPreviewText(asset.assetCode)} 存在未生成凭证的前期折旧批次`,
        );
      }
      const openingMonths = asPreviewNumber(asset.openingDepreciationMonths);
      const accountedMonths = openingMonths + priorLines.length;
      if (accountedMonths !== elapsedMonths) {
        throw new Error(
          `资产 ${asPreviewText(asset.assetCode)} 折旧历史不完整，请补录期初累计折旧及已折旧月数`,
        );
      }
      const roundMoney = (value: number) => Math.round(value * 100) / 100;
      const originalValue = asPreviewNumber(asset.originalValue);
      const residualRate = asPreviewNumber(asset.residualRate);
      const depreciableAmount = roundMoney(originalValue * (1 - residualRate));
      const openingAccumulatedDepreciation = roundMoney(
        asPreviewNumber(asset.openingAccumulatedDepreciation) +
          priorLines.reduce(
            (sum, line) => sum + asPreviewNumber(line.depreciationAmount),
            0,
          ),
      );
      const remaining = roundMoney(
        depreciableAmount - openingAccumulatedDepreciation,
      );
      if (remaining <= 0) continue;
      const regularAmount = roundMoney(depreciableAmount / life);
      const depreciationAmount =
        elapsedMonths + 1 === life
          ? remaining
          : Math.min(regularAmount, remaining);
      const closingAccumulatedDepreciation = roundMoney(
        openingAccumulatedDepreciation + depreciationAmount,
      );
      newLines.push({
        id: `preview-depreciation-line-${asset.id}-${period}`,
        batchId,
        companyId,
        period,
        assetId: asPreviewText(asset.id),
        assetCode: asPreviewText(asset.assetCode),
        assetName: asPreviewText(asset.assetName),
        category: asPreviewText(asset.category),
        depreciationMethod: asPreviewText(
          asset.depreciationMethod,
          "平均年限法",
        ),
        expenseAccount: asPreviewText(asset.expenseAccount),
        accumulatedDepreciationAccount: asPreviewText(
          asset.accumulatedDepreciationAccount,
          "1602",
        ),
        depreciableAmount,
        monthsDepreciated: accountedMonths + 1,
        openingAccumulatedDepreciation,
        depreciationAmount,
        closingAccumulatedDepreciation,
        closingNetValue: roundMoney(
          originalValue - closingAccumulatedDepreciation,
        ),
        voucherId: null,
        status: "待复核",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (newLines.length === 0) {
      throw new Error("当前账期没有可计提折旧的固定资产");
    }
    const depreciationAmount = newLines.reduce(
      (sum, line) => sum + asPreviewNumber(line.depreciationAmount),
      0,
    );
    const batch = {
      id: batchId,
      companyId,
      period,
      assetCount: newLines.length,
      depreciationAmount: Math.round(depreciationAmount * 100) / 100,
      voucherId: null,
      voucherNumber: null,
      status: "待复核",
      createdAt: asPreviewText(existingBatch?.createdAt, now),
      updatedAt: now,
    };
    saveBrowserPreviewDepreciationLines([...retainedLines, ...newLines]);
    saveBrowserPreviewDepreciationBatches([
      ...readBrowserPreviewDepreciationBatches().filter(
        (item) =>
          !(
            asPreviewText(item.companyId) === companyId &&
            asPreviewText(item.period) === period
          ),
      ),
      batch,
    ]);
    return {
      id: batch.id,
      company_id: companyId,
      period,
      asset_count: batch.assetCount,
      depreciation_amount: batch.depreciationAmount,
      voucher_id: null,
      voucher_number: null,
      status: batch.status,
      created_at: batch.createdAt,
      updated_at: batch.updatedAt,
    } as T;
  }

  if (cmd === "get_employees") {
    const companyId = asPreviewText(filters.companyId);
    return data.employees
      .filter((employee) => !companyId || employee.company_id === companyId)
      .sort((left, right) =>
        left.employee_code.localeCompare(right.employee_code),
      ) as T;
  }
  if (cmd === "create_employee" || cmd === "update_employee") {
    const existing = data.employees.find(
      (employee) => employee.id === asPreviewText(input.id),
    );
    if (cmd === "update_employee" && !existing) {
      throw new Error("未找到需要更新的人员档案");
    }
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const employeeCode = asPreviewText(
      input.employee_code,
      existing?.employee_code || "",
    );
    const name = asPreviewText(input.name, existing?.name || "");
    if (!companyId || !employeeCode || !name) {
      throw new Error("人员编码和姓名不能为空");
    }
    if (
      data.employees.some(
        (employee) =>
          employee.company_id === companyId &&
          employee.employee_code === employeeCode &&
          employee.id !== existing?.id,
      )
    ) {
      throw new Error("当前账套已存在相同人员编码");
    }
    const employee: BrowserEmployee = {
      id: existing?.id || browserAgencyId("employee"),
      company_id: companyId,
      employee_code: employeeCode,
      name,
      id_no: asPreviewText(input.id_no, existing?.id_no || "") || null,
      department:
        asPreviewText(input.department, existing?.department || "") || null,
      position: asPreviewText(input.position, existing?.position || "") || null,
      mobile: asPreviewText(input.mobile, existing?.mobile || "") || null,
      entry_date:
        asPreviewText(input.entry_date, existing?.entry_date || "") || null,
      employment_status: asPreviewText(
        input.employment_status,
        existing?.employment_status || "在职",
      ),
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.employees = existing
      ? data.employees.map((item) =>
          item.id === existing.id ? employee : item,
        )
      : [employee, ...data.employees];
    data.payrollRecords = data.payrollRecords.map((record) =>
      record.employee_id === employee.id
        ? { ...record, employee_name: employee.name, updated_at: now }
        : record,
    );
    data.socialSecurityRecords = data.socialSecurityRecords.map((record) =>
      record.employee_id === employee.id
        ? { ...record, employee_name: employee.name, updated_at: now }
        : record,
    );
    saveBrowserAgencyPreviewData(data);
    return employee as T;
  }

  if (cmd === "get_payroll_records") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    return data.payrollRecords
      .filter(
        (record) =>
          (!companyId || record.company_id === companyId) &&
          (!period || record.period === period),
      )
      .sort((left, right) =>
        left.employee_name.localeCompare(right.employee_name),
      ) as T;
  }
  if (cmd === "create_payroll_record" || cmd === "update_payroll_record") {
    const existing = data.payrollRecords.find(
      (record) => record.id === asPreviewText(input.id),
    );
    if (cmd === "update_payroll_record" && !existing) {
      throw new Error("未找到需要更新的薪酬行");
    }
    if (existing?.voucher_id || existing?.status === "已生成凭证") {
      throw new Error("该薪酬行已关联凭证，不能修改");
    }
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const employeeId = asPreviewText(
      input.employee_id,
      existing?.employee_id || "",
    );
    const period = asPreviewText(input.period, existing?.period || "");
    const employee = data.employees.find(
      (item) => item.id === employeeId && item.company_id === companyId,
    );
    if (!employee || !period) {
      throw new Error("请选择当前账套的人员和有效账期");
    }
    if (
      data.payrollRecords.some(
        (record) =>
          record.company_id === companyId &&
          record.employee_id === employeeId &&
          record.period === period &&
          record.id !== existing?.id,
      )
    ) {
      throw new Error("该人员当前账期已存在薪酬行");
    }
    const baseSalary = asPreviewNumber(
      input.base_salary,
      existing?.base_salary || 0,
    );
    const bonus = asPreviewNumber(input.bonus, existing?.bonus || 0);
    const taxAmount = asPreviewNumber(
      input.tax_amount,
      existing?.tax_amount || 0,
    );
    const socialPersonal = asPreviewNumber(
      input.social_personal,
      existing?.social_personal || 0,
    );
    const netSalary = baseSalary + bonus - taxAmount - socialPersonal;
    if (
      [baseSalary, bonus, taxAmount, socialPersonal, netSalary].some(
        (value) => value < 0,
      )
    ) {
      throw new Error("薪酬金额不能为负，且扣款不能超过应发金额");
    }
    const record: BrowserPayrollRecord = {
      id: existing?.id || browserAgencyId("payroll"),
      company_id: companyId,
      employee_id: employeeId,
      employee_name: employee.name,
      period,
      base_salary: baseSalary,
      bonus,
      tax_amount: taxAmount,
      social_personal: socialPersonal,
      net_salary: netSalary,
      voucher_id: null,
      voucher_number: null,
      status: "待确认",
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.payrollRecords = existing
      ? data.payrollRecords.map((item) =>
          item.id === existing.id ? record : item,
        )
      : [record, ...data.payrollRecords];
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_social_security_records") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    return data.socialSecurityRecords
      .filter(
        (record) =>
          (!companyId || record.company_id === companyId) &&
          (!period || record.period === period),
      )
      .sort((left, right) =>
        left.employee_name.localeCompare(right.employee_name),
      ) as T;
  }
  if (
    cmd === "create_social_security_record" ||
    cmd === "update_social_security_record"
  ) {
    const existing = data.socialSecurityRecords.find(
      (record) => record.id === asPreviewText(input.id),
    );
    if (cmd === "update_social_security_record" && !existing) {
      throw new Error("未找到需要更新的社保缴费资料");
    }
    if (existing?.voucher_id || existing?.status === "已生成凭证") {
      throw new Error("该社保缴费资料已关联凭证，不能修改");
    }
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const employeeId = asPreviewText(
      input.employee_id,
      existing?.employee_id || "",
    );
    const period = asPreviewText(input.period, existing?.period || "");
    const employee = data.employees.find(
      (item) => item.id === employeeId && item.company_id === companyId,
    );
    if (!employee || !period) {
      throw new Error("请选择当前账套的人员和有效账期");
    }
    if (
      data.socialSecurityRecords.some(
        (record) =>
          record.company_id === companyId &&
          record.employee_id === employeeId &&
          record.period === period &&
          record.id !== existing?.id,
      )
    ) {
      throw new Error("该人员当前账期已存在社保缴费资料");
    }
    const amounts = {
      contributionBase: asPreviewNumber(
        input.contribution_base,
        existing?.contribution_base || 0,
      ),
      companyAmount: asPreviewNumber(
        input.company_amount,
        existing?.company_amount || 0,
      ),
      personalAmount: asPreviewNumber(
        input.personal_amount,
        existing?.personal_amount || 0,
      ),
      fundAmount: asPreviewNumber(
        input.fund_amount,
        existing?.fund_amount || 0,
      ),
    };
    if (Object.values(amounts).some((value) => value < 0)) {
      throw new Error("社保缴费金额不能为负数");
    }
    const record: BrowserSocialSecurityRecord = {
      id: existing?.id || browserAgencyId("social-security"),
      company_id: companyId,
      employee_id: employeeId,
      employee_name: employee.name,
      period,
      city: asPreviewText(input.city, existing?.city || "") || null,
      contribution_base: amounts.contributionBase,
      company_amount: amounts.companyAmount,
      personal_amount: amounts.personalAmount,
      fund_amount: amounts.fundAmount,
      voucher_id: null,
      voucher_number: null,
      status: "待确认",
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.socialSecurityRecords = existing
      ? data.socialSecurityRecords.map((item) =>
          item.id === existing.id ? record : item,
        )
      : [record, ...data.socialSecurityRecords];
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_bank_transactions") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    return data.bankTransactions
      .filter(
        (record) =>
          (!companyId || record.company_id === companyId) &&
          (!period || record.period === period),
      )
      .sort((left, right) =>
        right.transaction_date.localeCompare(left.transaction_date),
      ) as T;
  }
  if (cmd === "create_bank_transaction" || cmd === "update_bank_transaction") {
    const existing = data.bankTransactions.find(
      (record) => record.id === asPreviewText(input.id),
    );
    if (cmd === "update_bank_transaction" && !existing) {
      throw new Error("未找到可编辑的银行流水");
    }
    if (existing?.voucher_id) {
      throw new Error("已生成凭证的流水不可修改");
    }
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const incomeAmount = asPreviewNumber(
      input.income_amount,
      existing?.income_amount || 0,
    );
    const expenseAmount = asPreviewNumber(
      input.expense_amount,
      existing?.expense_amount || 0,
    );
    if (
      !asPreviewText(input.account_name, existing?.account_name || "") ||
      !asPreviewText(input.serial_no, existing?.serial_no || "") ||
      !asPreviewText(
        input.transaction_date,
        existing?.transaction_date || "",
      ) ||
      incomeAmount > 0 === expenseAmount > 0
    ) {
      throw new Error("流水信息不完整，且收入和支出必须二选一并大于零");
    }
    const record: BrowserBankTransaction = {
      id: existing?.id || browserAgencyId("bank-transaction"),
      company_id: companyId,
      period: asPreviewText(input.period, existing?.period || ""),
      account_name: asPreviewText(
        input.account_name,
        existing?.account_name || "",
      ),
      serial_no: asPreviewText(input.serial_no, existing?.serial_no || ""),
      transaction_date: asPreviewText(
        input.transaction_date,
        existing?.transaction_date || "",
      ),
      counterparty:
        asPreviewText(input.counterparty, existing?.counterparty || "") || null,
      summary: asPreviewText(input.summary, existing?.summary || "") || null,
      income_amount: incomeAmount,
      expense_amount: expenseAmount,
      balance:
        input.balance === undefined
          ? existing?.balance || null
          : asPreviewNumber(input.balance),
      receipt_status: asPreviewText(
        input.receipt_status,
        existing?.receipt_status || "待上传",
      ),
      match_result: existing?.match_result || null,
      voucher_id: existing?.voucher_id || null,
      voucher_number: existing?.voucher_number || null,
      status: existing?.status || "待处理",
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.bankTransactions = upsertBrowserAgencyRecord(
      data.bankTransactions,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_accounting_reconciliation") {
    const periodId = asPreviewText(filters.periodId);
    const period = readBrowserPreviewPeriods().find(
      (item) => item.id === periodId,
    );
    const companyId = period?.company_id || "browser-preview-company";
    const company = readBrowserPreviewCompanies().find(
      (item) => item.id === companyId,
    );
    const trial = buildBrowserPreviewTrialBalance(
      readBrowserPreviewVouchers(),
      periodId,
    );
    const unavailable = (
      code: string,
      name: string,
      source: string,
      target: string,
    ) => ({
      code,
      name,
      source,
      target,
      source_amount: 0,
      target_amount: 0,
      difference: 1,
      status: "blocked",
      detail:
        "浏览器预览不保存完整科目余额账簿，请在桌面数据库中执行该项勾稽检查",
    });
    const checks = [
      unavailable(
        "chart_coverage",
        "会计科目覆盖",
        "科目表",
        "科目余额与已审核凭证",
      ),
      unavailable(
        "balance_rollforward",
        "科目余额滚存",
        "期初余额与本期发生额",
        "期末余额",
      ),
      unavailable(
        "voucher_to_balance",
        "凭证与科目余额",
        "已审核凭证发生额",
        "科目余额表本期发生额",
      ),
      unavailable(
        "balance_sheet_equation",
        "资产负债表恒等式",
        "资产总计",
        "负债与权益合计",
      ),
      {
        code: "trial_balance",
        name: "借贷试算平衡",
        source: "借方合计",
        target: "贷方合计",
        source_amount: trial.total_period_debit,
        target_amount: trial.total_period_credit,
        difference: Math.abs(
          trial.total_period_debit - trial.total_period_credit,
        ),
        status: trial.is_balanced ? "passed" : "blocked",
        detail: trial.is_balanced
          ? "浏览器预览凭证的本期借贷合计平衡"
          : "浏览器预览凭证的本期借贷合计不平衡",
      },
    ];
    const passedCount = checks.filter(
      (check) => check.status === "passed",
    ).length;
    return {
      period_id: periodId,
      company_id: companyId,
      accounting_system: asPreviewText(company?.accounting_system),
      checks,
      passed_count: passedCount,
      blocked_count: checks.length - passedCount,
      is_reconciled: passedCount === checks.length,
    } as T;
  }

  if (cmd === "get_trial_balance") {
    return buildBrowserPreviewTrialBalance(
      readBrowserPreviewVouchers(),
      asPreviewText(filters.periodId),
    ) as T;
  }
  if (cmd === "get_balance_sheet") {
    return buildBrowserPreviewBalanceSheet(
      readBrowserPreviewVouchers(),
      asPreviewText(filters.periodId),
    ) as T;
  }

  if (
    [
      "get_account_codes",
      "get_account_codes_by_type",
      "get_detail_account_codes",
      "search_account_codes",
    ].includes(cmd)
  ) {
    const companyId = asPreviewText(filters.companyId);
    const accountType = asPreviewText(filters.accountType);
    const parentCode = asPreviewText(filters.parentCode);
    const keyword = asPreviewText(filters.keyword).toLowerCase();
    return browserPreviewAccountCodes(companyId).filter(
      (account) =>
        (!accountType || account.account_type === accountType) &&
        (!parentCode || account.parent_code === parentCode) &&
        (!keyword ||
          `${account.code} ${account.name}`.toLowerCase().includes(keyword)),
    ) as T;
  }

  if (cmd === "get_auxiliary_categories") {
    return browserPreviewAuxiliaryCategories(
      asPreviewText(filters.companyId),
    ) as T;
  }
  if (cmd === "get_all_auxiliary_items") {
    return browserPreviewAuxiliaryItems(asPreviewText(filters.companyId)) as T;
  }
  if (cmd === "get_auxiliary_items") {
    const companyId = asPreviewText(filters.companyId);
    const categoryId = asPreviewText(filters.categoryId);
    return browserPreviewAuxiliaryItems(companyId).filter(
      (item) => item.category_id === categoryId,
    ) as T;
  }
  if (cmd === "get_account_auxiliary_setup") {
    return browserPreviewAccountAuxiliarySetup(
      asPreviewText(filters.companyId),
      asPreviewText(filters.accountCode),
    ) as T;
  }
  if (cmd === "get_account_auxiliary_links") {
    return browserPreviewAccountAuxiliaryLinks(
      asPreviewText(filters.companyId),
      asPreviewText(filters.accountCode),
    ) as T;
  }
  if (cmd === "get_voucher_entry_auxiliaries") {
    const entryId = asPreviewText(filters.entryId);
    const entry = readBrowserPreviewVouchers()
      .flatMap((voucher) => voucher.entries)
      .find((item) => item.id === entryId);
    const auxiliaries = Array.isArray(entry?.auxiliary_items)
      ? entry.auxiliary_items
      : [];
    return auxiliaries.map((item, index) => ({
      id: `${entryId}:auxiliary:${index + 1}`,
      entry_id: entryId,
      auxiliary_category_id: asPreviewText(item.auxiliary_category_id),
      auxiliary_item_id: asPreviewText(item.auxiliary_item_id),
    })) as T;
  }

  if (cmd === "get_settlement_rules") {
    const companyId = asPreviewText(filters.companyId);
    return readBrowserPreviewSettlementRules(browserStorage())
      .filter((rule) => rule.company_id === companyId)
      .sort(
        (left, right) =>
          left.priority - right.priority || left.name.localeCompare(right.name),
      ) as T;
  }
  if (
    cmd === "preview_settlement_rule" ||
    cmd === "create_settlement_voucher_draft"
  ) {
    const companyId = asPreviewText(filters.companyId);
    const periodId = asPreviewText(filters.periodId);
    const ruleId = asPreviewText(filters.ruleId);
    const period = readBrowserPreviewPeriods().find(
      (item) => item.id === periodId && item.company_id === companyId,
    );
    if (!period) throw new Error("会计期间不存在");
    if (period.status !== "open")
      throw new Error("当前账期已结账，不能生成结转凭证");
    const rule = readBrowserPreviewSettlementRules(browserStorage()).find(
      (item) => item.id === ruleId && item.company_id === companyId,
    );
    if (!rule) throw new Error("结转规则不存在或未启用");
    const vouchers = readBrowserPreviewVouchers();
    const periodLabel = `${period.period_year}-${String(period.period_month).padStart(2, "0")}`;
    const preview = buildSettlementRulePreview({
      rule,
      periodLabel,
      accounts: browserPreviewAccountCodes(companyId),
      vouchers: vouchers.filter(
        (voucher) =>
          voucher.company_id === companyId && voucher.period_id === periodId,
      ),
    });
    const response = {
      ...preview,
      periodId,
      voucherDate: period.end_date,
      voucherWordId: `browser-voucher-word-${companyId}-ji`,
      voucherWordName: "记",
    };
    if (cmd === "preview_settlement_rule") return response as T;

    const voucher = createBrowserPreviewVoucher({
      input: {
        company_id: companyId,
        period_id: periodId,
        voucher_word_id: response.voucherWordId,
        voucher_date: response.voucherDate,
        summary: response.summary,
        reference_number: `JZ-${periodLabel}-${ruleId}`,
        created_by: asPreviewText(filters.createdBy, "admin"),
        is_settlement: 1,
        settlement_rule_id: ruleId,
        entries: response.entries.map((entry) => ({
          account_code: entry.accountCode,
          account_name: entry.accountName,
          direction: entry.direction,
          amount: entry.amount,
          summary: entry.summary,
        })),
      },
      vouchers,
      now: new Date(now),
    }) as BrowserPreviewVoucher;
    saveBrowserPreviewVouchers([voucher, ...vouchers]);
    return {
      id: voucher.id,
      voucherNumber: voucher.voucher_number,
      ruleId,
      totalDebit: voucher.total_debit,
      totalCredit: voucher.total_credit,
    } as T;
  }

  if (cmd === "get_vouchers") {
    const companyId = asPreviewText(filters.companyId);
    const result = queryBrowserPreviewVouchers(readBrowserPreviewVouchers(), {
      company_id: companyId,
      page: 1,
      page_size: Number.MAX_SAFE_INTEGER,
    }) as { vouchers: BrowserPreviewVoucher[]; total: number };
    return result as T;
  }
  if (cmd === "query_vouchers") {
    return queryBrowserPreviewVouchers(
      readBrowserPreviewVouchers(),
      input,
    ) as T;
  }
  if (cmd === "get_voucher") {
    const id = asPreviewText(filters.id);
    const companyId = asPreviewText(filters.companyId);
    return (readBrowserPreviewVouchers().find(
      (voucher) =>
        voucher.id === id &&
        voucher.company_id === companyId &&
        voucher.is_deleted !== 1,
    ) || null) as T;
  }
  if (cmd === "create_voucher") {
    const vouchers = readBrowserPreviewVouchers();
    const aiSuggestionId = asPreviewText(input.ai_suggestion_id);
    const aiSuggestion = aiSuggestionId
      ? data.automationJobs.find(
          (job) =>
            job.id === aiSuggestionId &&
            job.company_id === asPreviewText(input.company_id) &&
            job.period === asPreviewText(input.voucher_date).slice(0, 7) &&
            job.job_type === "voucher_suggestion" &&
            job.status === "confirmed" &&
            !job.generated_voucher_id,
        )
      : null;
    if (aiSuggestionId && !aiSuggestion) {
      throw new Error("AI 凭证建议不存在、未确认、账期不匹配或已关联其他凭证");
    }
    const bankTransactionId = asPreviewText(input.bank_transaction_id);
    const voucherPeriod = asPreviewText(input.voucher_date).slice(0, 7);
    const bankTransaction = bankTransactionId
      ? data.bankTransactions.find(
          (record) =>
            record.id === bankTransactionId &&
            record.company_id === asPreviewText(input.company_id) &&
            record.period === voucherPeriod &&
            !record.voucher_id,
        )
      : null;
    if (bankTransactionId && !bankTransaction) {
      throw new Error("银行流水不存在、账期不匹配或已关联其他凭证");
    }
    if (bankTransaction) {
      const sourceAmount =
        bankTransaction.income_amount || bankTransaction.expense_amount;
      const voucherAmount = Array.isArray(input.entries)
        ? input.entries
            .filter((entry) => entry.direction !== "credit")
            .reduce((total, entry) => total + asPreviewNumber(entry.amount), 0)
        : 0;
      if (Math.abs(sourceAmount - voucherAmount) >= 0.005) {
        throw new Error("凭证金额与银行流水金额不一致");
      }
    }
    const businessSourceKind = asPreviewText(input.business_source_kind);
    const businessSourceId = asPreviewText(input.business_source_id);
    if (Boolean(businessSourceKind) !== Boolean(businessSourceId)) {
      throw new Error("业务凭证来源类型和标识必须同时提供");
    }
    const payrollBatchRecords =
      businessSourceKind === "payroll_batch"
        ? data.payrollRecords.filter(
            (record) =>
              record.company_id === asPreviewText(input.company_id) &&
              record.period === businessSourceId,
          )
        : [];
    const socialSecurityBatchRecords =
      businessSourceKind === "social_security_batch"
        ? data.socialSecurityRecords.filter(
            (record) =>
              record.company_id === asPreviewText(input.company_id) &&
              record.period === businessSourceId,
          )
        : [];
    const depreciationBatchRecords =
      businessSourceKind === "depreciation_batch" &&
      businessSourceId === `${asPreviewText(input.company_id)}:${voucherPeriod}`
        ? readBrowserPreviewDepreciationLines().filter(
            (record) =>
              asPreviewText(record.companyId) ===
                asPreviewText(input.company_id) &&
              asPreviewText(record.period) === voucherPeriod,
          )
        : [];
    const existingDepreciationBatch =
      businessSourceKind === "depreciation_batch"
        ? readBrowserPreviewDepreciationBatches().find(
            (record) =>
              asPreviewText(record.companyId) ===
                asPreviewText(input.company_id) &&
              asPreviewText(record.period) === voucherPeriod,
          )
        : undefined;
    if (businessSourceKind === "depreciation_batch") {
      const batchAmount = asPreviewNumber(
        existingDepreciationBatch?.depreciationAmount,
      );
      const lineAmount = depreciationBatchRecords.reduce(
        (total, record) =>
          total + asPreviewNumber(record.depreciationAmount),
        0,
      );
      if (
        !existingDepreciationBatch ||
        asPreviewText(existingDepreciationBatch.status) !== "待复核" ||
        depreciationBatchRecords.length === 0 ||
        depreciationBatchRecords.some(
          (record) =>
            asPreviewText(record.status, "待复核") !== "待复核" ||
            Boolean(asPreviewText(record.voucherId)),
        ) ||
        asPreviewNumber(existingDepreciationBatch.assetCount) !==
          depreciationBatchRecords.length ||
        batchAmount <= 0 ||
        Math.abs(batchAmount - lineAmount) >= 0.005
      ) {
        throw new Error("折旧批次与待复核明细不一致，请重新计算");
      }
    }
    const linkedPayrollRecord = payrollBatchRecords.find(
      (record) => record.voucher_id || record.status === "已生成凭证",
    );
    const linkedSocialSecurityRecord = socialSecurityBatchRecords.find(
      (record) => record.voucher_id || record.status === "已生成凭证",
    );
    const businessSource =
      businessSourceKind === "payroll_batch" && payrollBatchRecords.length > 0
        ? {
            id: businessSourceId,
            companyId: asPreviewText(input.company_id),
            period: businessSourceId,
            amount: payrollBatchRecords.reduce(
              (total, record) => total + record.base_salary + record.bonus,
              0,
            ),
            voucherId: linkedPayrollRecord?.voucher_id || null,
            status: linkedPayrollRecord ? "已生成凭证" : "待确认",
          }
        : businessSourceKind === "social_security_batch" &&
            socialSecurityBatchRecords.length > 0
          ? {
              id: businessSourceId,
              companyId: asPreviewText(input.company_id),
              period: businessSourceId,
              amount: socialSecurityBatchRecords.reduce(
                (total, record) =>
                  total + record.company_amount + record.fund_amount,
                0,
              ),
              voucherId: linkedSocialSecurityRecord?.voucher_id || null,
              status: linkedSocialSecurityRecord ? "已生成凭证" : "待确认",
            }
          : businessSourceKind === "depreciation_batch" &&
              depreciationBatchRecords.length > 0
            ? {
                id: businessSourceId,
                companyId: asPreviewText(input.company_id),
                period: voucherPeriod,
                amount: depreciationBatchRecords.reduce(
                  (total, record) =>
                    total + asPreviewNumber(record.depreciationAmount),
                  0,
                ),
                voucherId:
                  asPreviewText(existingDepreciationBatch?.voucherId) || null,
                status: asPreviewText(
                  existingDepreciationBatch?.status,
                  "待复核",
                ),
              }
            : businessSourceKind
              ? loadBrowserBusinessVoucherSource(
                  businessSourceKind,
                  businessSourceId,
                )
              : null;
    if (businessSourceKind && !businessSource) {
      throw new Error("业务来源不存在或不属于当前账套");
    }
    if (businessSource) {
      if (
        businessSource.companyId !== asPreviewText(input.company_id) ||
        businessSource.period !== voucherPeriod ||
        businessSource.voucherId ||
        (businessSourceKind === "cost_carryover" && businessSource.voucherNo) ||
        businessSource.status === "已生成凭证"
      ) {
        throw new Error("业务来源不存在、账期不匹配或已关联其他凭证");
      }
      const sourceAmount =
        businessSourceKind === "cost_carryover"
          ? asPreviewNumber(businessSource.costAmount)
          : asPreviewNumber(businessSource.amount) +
            (businessSourceKind === "account_transfer"
              ? asPreviewNumber(businessSource.fee)
              : 0);
      const voucherAmount = Array.isArray(input.entries)
        ? input.entries
            .filter((entry) => entry.direction !== "credit")
            .reduce((total, entry) => total + asPreviewNumber(entry.amount), 0)
        : 0;
      if (
        sourceAmount <= 0 ||
        Math.abs(sourceAmount - voucherAmount) >= 0.005
      ) {
        throw new Error("凭证金额与业务来源金额不一致");
      }
    }
    const voucher = createBrowserPreviewVoucher({
      input,
      vouchers,
      now: new Date(now),
    }) as BrowserPreviewVoucher;
    if (businessSource) {
      if (businessSourceKind === "payroll_batch") {
        data.payrollRecords = data.payrollRecords.map((record) =>
          record.company_id === voucher.company_id &&
          record.period === businessSourceId
            ? {
                ...record,
                voucher_id: voucher.id,
                voucher_number: voucher.voucher_number,
                status: "已生成凭证",
                updated_at: now,
              }
            : record,
        );
        saveBrowserAgencyPreviewData(data);
      } else if (businessSourceKind === "social_security_batch") {
        data.socialSecurityRecords = data.socialSecurityRecords.map((record) =>
          record.company_id === voucher.company_id &&
          record.period === businessSourceId
            ? {
                ...record,
                voucher_id: voucher.id,
                voucher_number: voucher.voucher_number,
                status: "已生成凭证",
                updated_at: now,
              }
            : record,
        );
        saveBrowserAgencyPreviewData(data);
      } else if (businessSourceKind === "depreciation_batch") {
        const batches = readBrowserPreviewDepreciationBatches();
        const nextBatch = {
          id:
            asPreviewText(existingDepreciationBatch?.id) ||
            `depreciation-${voucher.company_id}-${voucherPeriod}`,
          companyId: voucher.company_id,
          period: voucherPeriod,
          assetCount: depreciationBatchRecords.length,
          depreciationAmount: asPreviewNumber(businessSource.amount),
          voucherId: voucher.id,
          voucherNumber: voucher.voucher_number,
          status: "已生成凭证",
          createdAt: asPreviewText(existingDepreciationBatch?.createdAt, now),
          updatedAt: now,
        };
        const nextBatches = [
          ...batches.filter(
            (record) =>
              !(
                asPreviewText(record.companyId) === voucher.company_id &&
                asPreviewText(record.period) === voucherPeriod
              ),
          ),
          nextBatch,
        ];
        const linked = linkBrowserDepreciationVoucher({
          batches: nextBatches,
          lines: readBrowserPreviewDepreciationLines(),
          companyId: voucher.company_id,
          period: voucherPeriod,
          voucherId: voucher.id,
          voucherNumber: voucher.voucher_number,
          now,
        });
        saveBrowserPreviewDepreciationBatches(linked.batches);
        saveBrowserPreviewDepreciationLines(linked.lines);
      } else {
        linkBrowserBusinessVoucherSource({
          kind: businessSourceKind,
          id: businessSourceId,
          voucherId: voucher.id,
          voucherNumber: voucher.voucher_number,
        });
      }
    }
    saveBrowserPreviewVouchers([voucher, ...vouchers]);
    if (aiSuggestion) {
      data.automationJobs = data.automationJobs.map((job) =>
        job.id === aiSuggestion.id
          ? {
              ...job,
              generated_voucher_id: voucher.id,
              generated_voucher_number: voucher.voucher_number,
              status: "completed",
              updated_at: now,
            }
          : job,
      );
      saveBrowserAgencyPreviewData(data);
    }
    if (bankTransaction) {
      data.bankTransactions = data.bankTransactions.map((record) =>
        record.id === bankTransaction.id
          ? {
              ...record,
              voucher_id: voucher.id,
              voucher_number: voucher.voucher_number,
              status: "已生成凭证",
              match_result: `已关联凭证 ${voucher.voucher_number}`,
              updated_at: now,
            }
          : record,
      );
      saveBrowserAgencyPreviewData(data);
    }
    return voucher as T;
  }
  if (cmd === "update_voucher") {
    const result = updateBrowserPreviewVoucher({
      input,
      companyId: asPreviewText(filters.companyId),
      vouchers: readBrowserPreviewVouchers(),
      now: new Date(now),
    }) as { voucher: BrowserPreviewVoucher; vouchers: BrowserPreviewVoucher[] };
    saveBrowserPreviewVouchers(result.vouchers);
    return result.voucher as T;
  }
  if (cmd === "approve_voucher" || cmd === "reverse_approve_voucher") {
    const result = setBrowserPreviewVoucherStatus({
      id: asPreviewText(filters.id),
      companyId: asPreviewText(filters.companyId),
      status: cmd === "approve_voucher" ? "approved" : "draft",
      operator: asPreviewText(filters.approvedBy, "admin"),
      vouchers: readBrowserPreviewVouchers(),
      now: new Date(now),
    }) as { voucher: BrowserPreviewVoucher; vouchers: BrowserPreviewVoucher[] };
    saveBrowserPreviewVouchers(result.vouchers);
    return result.voucher as T;
  }
  if (
    cmd === "batch_approve_vouchers" ||
    cmd === "batch_reverse_approve_vouchers"
  ) {
    const ids = Array.isArray(filters.ids) ? filters.ids.map(String) : [];
    const companyId = asPreviewText(filters.companyId);
    let vouchers = readBrowserPreviewVouchers();
    for (const id of ids) {
      const result = setBrowserPreviewVoucherStatus({
        id,
        companyId,
        status: cmd === "batch_approve_vouchers" ? "approved" : "draft",
        operator: asPreviewText(filters.approvedBy, "admin"),
        vouchers,
        now: new Date(now),
      }) as {
        voucher: BrowserPreviewVoucher;
        vouchers: BrowserPreviewVoucher[];
      };
      vouchers = result.vouchers;
    }
    saveBrowserPreviewVouchers(vouchers);
    return undefined as T;
  }
  if (cmd === "reverse_voucher") {
    const companyId = asPreviewText(filters.companyId);
    const result = reverseBrowserPreviewVoucher({
      id: asPreviewText(filters.id),
      companyId,
      reversedBy: asPreviewText(filters.reversedBy, "admin"),
      vouchers: readBrowserPreviewVouchers(),
      now: new Date(now),
    }) as {
      source: BrowserPreviewVoucher;
      reversal: BrowserPreviewVoucher;
      vouchers: BrowserPreviewVoucher[];
    };
    saveBrowserPreviewVouchers(result.vouchers);
    copyBrowserPreviewVoucherTags(
      result.source.id,
      result.reversal.id,
      companyId,
    );
    return result.reversal as T;
  }
  if (cmd === "copy_voucher") {
    const vouchers = readBrowserPreviewVouchers();
    const companyId = asPreviewText(filters.companyId);
    const source = vouchers.find(
      (voucher) =>
        voucher.id === asPreviewText(filters.id) &&
        voucher.company_id === companyId,
    );
    if (!source) throw new Error("凭证不存在或不属于当前账套");
    const voucher = createBrowserPreviewVoucher({
      input: {
        company_id: source.company_id,
        period_id: source.period_id,
        voucher_word_id: source.voucher_word_id,
        voucher_date: source.voucher_date,
        summary: `复制：${source.summary || source.voucher_number}`,
        reference_number: source.reference_number,
        attachment_count: source.attachment_count,
        created_by: asPreviewText(filters.reversedBy, "admin"),
        entries: source.entries.map((entry) => ({
          ...entry,
          direction: entry.direction,
        })),
      },
      vouchers,
      now: new Date(now),
    }) as BrowserPreviewVoucher;
    saveBrowserPreviewVouchers([voucher, ...vouchers]);
    copyBrowserPreviewVoucherTags(source.id, voucher.id, companyId);
    return voucher as T;
  }
  if (cmd === "get_voucher_entries") {
    const voucherId = asPreviewText(filters.voucherId);
    return (readBrowserPreviewVouchers().find(
      (voucher) => voucher.id === voucherId,
    )?.entries || []) as T;
  }
  if (cmd === "add_voucher_annotation") {
    const voucherId = asPreviewText(filters.voucherId);
    const companyId = asPreviewText(filters.companyId);
    const content = asPreviewText(filters.content).trim();
    const voucher = readBrowserPreviewVouchers().find(
      (item) => item.id === voucherId && item.company_id === companyId,
    );
    if (!voucher) throw new Error("凭证不存在或不属于当前账套");
    if (!content) throw new Error("批注内容不能为空");
    if (content.length > 500) throw new Error("批注内容不能超过 500 个字符");
    const log: BrowserPreviewVoucherLog = {
      id: `voucher-annotation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      voucher_id: voucherId,
      operation_type: "ANNOTATION",
      before_data: null,
      after_data: content,
      operator_id: asPreviewText(filters.operatorId, "admin"),
      created_at: now,
    };
    saveBrowserPreviewVoucherLogs([log, ...readBrowserPreviewVoucherLogs()]);
    return log as T;
  }
  if (cmd === "get_voucher_logs") {
    const voucherId = asPreviewText(filters.voucherId);
    return readBrowserPreviewVoucherLogs()
      .filter((log) => log.voucher_id === voucherId)
      .sort((left, right) =>
        right.created_at.localeCompare(left.created_at),
      ) as T;
  }
  if (cmd === "delete_voucher") {
    const id = asPreviewText(filters.id);
    const companyId = asPreviewText(filters.companyId);
    const result = softDeleteBrowserPreviewVoucher({
      id,
      companyId,
      vouchers: readBrowserPreviewVouchers(),
      now: new Date(now),
    }) as { voucher: BrowserPreviewVoucher; vouchers: BrowserPreviewVoucher[] };
    saveBrowserPreviewVouchers(result.vouchers);
    return undefined as T;
  }
  if (cmd === "get_deleted_vouchers") {
    return getDeletedBrowserPreviewVouchers(
      readBrowserPreviewVouchers(),
      asPreviewText(filters.companyId),
    ) as T;
  }
  if (cmd === "restore_voucher") {
    const result = restoreBrowserPreviewVoucher({
      id: asPreviewText(filters.id),
      companyId: asPreviewText(filters.companyId),
      vouchers: readBrowserPreviewVouchers(),
    }) as { voucher: BrowserPreviewVoucher; vouchers: BrowserPreviewVoucher[] };
    saveBrowserPreviewVouchers(result.vouchers);
    return undefined as T;
  }
  if (cmd === "permanent_delete_voucher") {
    const id = asPreviewText(filters.id);
    const companyId = asPreviewText(filters.companyId);
    const vouchers = readBrowserPreviewVouchers();
    const voucher = vouchers.find(
      (item) =>
        item.id === id &&
        item.company_id === companyId &&
        item.is_deleted === 1,
    );
    if (!voucher) throw new Error("只能永久删除已在回收站的凭证");
    unlinkBrowserBusinessVoucherSources(id);
    const unlinkedDepreciation = unlinkBrowserDepreciationVoucher({
      batches: readBrowserPreviewDepreciationBatches(),
      lines: readBrowserPreviewDepreciationLines(),
      companyId,
      voucherId: id,
      now,
    });
    saveBrowserPreviewDepreciationBatches(unlinkedDepreciation.batches);
    saveBrowserPreviewDepreciationLines(unlinkedDepreciation.lines);
    data.payrollRecords = data.payrollRecords.map((record) =>
      record.voucher_id === id && record.company_id === companyId
        ? {
            ...record,
            voucher_id: null,
            voucher_number: null,
            status: "待确认",
            updated_at: now,
          }
        : record,
    );
    data.socialSecurityRecords = data.socialSecurityRecords.map((record) =>
      record.voucher_id === id && record.company_id === companyId
        ? {
            ...record,
            voucher_id: null,
            voucher_number: null,
            status: "待确认",
            updated_at: now,
          }
        : record,
    );
    data.automationJobs = data.automationJobs.map((job) =>
      job.generated_voucher_id === id
        ? {
            ...job,
            generated_voucher_id: null,
            generated_voucher_number: null,
            status: "confirmed",
            updated_at: now,
          }
        : job,
    );
    data.bankTransactions = data.bankTransactions.map((record) =>
      record.voucher_id === id
        ? {
            ...record,
            voucher_id: null,
            voucher_number: null,
            status: "待处理",
            match_result: null,
            updated_at: now,
          }
        : record,
    );
    saveBrowserAgencyPreviewData(data);
    saveBrowserPreviewInvoices(
      readBrowserPreviewInvoices().map((invoice) =>
        invoice.voucher_id === id
          ? {
              ...invoice,
              voucher_id: null,
              status: "verified",
              updated_at: now,
            }
          : invoice,
      ),
    );
    saveBrowserPreviewVouchers(vouchers.filter((item) => item.id !== id));
    return undefined as T;
  }
  if (cmd === "reorganize_voucher_numbers") {
    const periodId = asPreviewText(filters.periodId);
    const companyId = asPreviewText(filters.companyId);
    const scoped = readBrowserPreviewVouchers()
      .filter(
        (voucher) =>
          voucher.company_id === companyId &&
          voucher.period_id === periodId &&
          voucher.is_deleted !== 1,
      )
      .sort(
        (left, right) =>
          left.voucher_date.localeCompare(right.voucher_date) ||
          left.sequence_num - right.sequence_num,
      );
    const numbered = new Map(
      scoped.map((voucher, index) => [voucher.id, index + 1]),
    );
    saveBrowserPreviewVouchers(
      readBrowserPreviewVouchers().map((voucher) => {
        const sequence = numbered.get(voucher.id);
        return sequence
          ? {
              ...voucher,
              sequence_num: sequence,
              voucher_number: `记-${String(sequence).padStart(4, "0")}`,
            }
          : voucher;
      }),
    );
    return undefined as T;
  }

  if (cmd === "get_invoices") {
    return filterBrowserPreviewInvoices(readBrowserPreviewInvoices(), {
      companyId: asPreviewText(filters.companyId),
      periodId: asPreviewText(filters.periodId),
      invoiceType: asPreviewText(filters.invoiceType),
    }) as T;
  }
  if (cmd === "get_invoice") {
    const id = asPreviewText(filters.id);
    const companyId = asPreviewText(filters.companyId);
    return (readBrowserPreviewInvoices().find(
      (invoice) => invoice.id === id && invoice.company_id === companyId,
    ) || null) as T;
  }
  if (cmd === "create_invoice") {
    const invoices = readBrowserPreviewInvoices();
    const invoice = createBrowserPreviewInvoice({
      input,
      invoices,
      now: new Date(now),
    }) as BrowserPreviewInvoice;
    const rawLines = Array.isArray(input.lines)
      ? (input.lines as Record<string, unknown>[])
      : [];
    // prettier-ignore
    if (rawLines.length === 0) throw new Error("发票至少需要一条货物或服务明细");
    {
      const detailAmount = rawLines.reduce(
        (total, line) => total + Number(line.amount || 0),
        0,
      );
      const detailTax = rawLines.reduce(
        (total, line) => total + Number(line.tax_amount || 0),
        0,
      );
      if (
        Math.round(detailAmount * 100) !== Math.round(invoice.amount * 100) ||
        Math.round(detailTax * 100) !== Math.round(invoice.tax_amount * 100)
      ) {
        throw new Error("发票明细金额和税额必须分别与表头一致");
      }
      const lines = rawLines.map((line, index): BrowserPreviewInvoiceLine => ({
        id: `invoice-line-${Date.now()}-${index + 1}`,
        invoice_id: invoice.id,
        company_id: invoice.company_id,
        line_no: index + 1,
        item_name: asPreviewText(line.item_name),
        specification: asPreviewText(line.specification) || null,
        unit: asPreviewText(line.unit) || null,
        quantity: line.quantity == null ? null : Number(line.quantity),
        unit_price: line.unit_price == null ? null : Number(line.unit_price),
        amount: Number(line.amount || 0),
        tax_rate: line.tax_rate == null ? null : Number(line.tax_rate),
        tax_amount: Number(line.tax_amount || 0),
        tax_classification_code:
          asPreviewText(line.tax_classification_code) || null,
        created_at: now,
        updated_at: now,
      }));
      if (lines.some((line) => !line.item_name.trim() || line.amount <= 0)) {
        throw new Error("发票明细不完整");
      }
      saveBrowserPreviewInvoiceLines([
        ...readBrowserPreviewInvoiceLines(),
        ...lines,
      ]);
    }
    saveBrowserPreviewInvoices([invoice, ...invoices]);
    return invoice as T;
  }
  if (cmd === "update_invoice_with_lines") {
    const id = asPreviewText(filters.id);
    const invoices = readBrowserPreviewInvoices();
    const existing = invoices.find(
      (invoice) =>
        invoice.id === id &&
        invoice.company_id === asPreviewText(input.company_id),
    );
    if (!existing) throw new Error("发票不存在或不属于当前公司");
    if (existing.status !== "pending" || existing.voucher_id) {
      throw new Error("只有待复核且未关联凭证的发票可以修改");
    }
    const rawLines = Array.isArray(filters.lines)
      ? (filters.lines as Record<string, unknown>[])
      : [];
    // prettier-ignore
    if (rawLines.length === 0) throw new Error("发票至少需要一条货物或服务明细");
    const targetAmount =
      input.amount == null ? existing.amount : Number(input.amount);
    const targetTaxAmount =
      input.tax_amount == null ? existing.tax_amount : Number(input.tax_amount);
    const detailAmount = rawLines.reduce(
      (total, line) => total + Number(line.amount || 0),
      0,
    );
    const detailTax = rawLines.reduce(
      (total, line) => total + Number(line.tax_amount || 0),
      0,
    );
    if (
      Math.round(detailAmount * 100) !== Math.round(targetAmount * 100) ||
      Math.round(detailTax * 100) !== Math.round(targetTaxAmount * 100)
    ) {
      throw new Error("发票明细金额和税额必须分别与更新后的表头一致");
    }
    const lines = rawLines.map((line, index): BrowserPreviewInvoiceLine => {
      const itemName = asPreviewText(line.item_name).trim();
      if (!itemName || Number(line.amount || 0) <= 0) {
        throw new Error(`第 ${index + 1} 行明细不完整`);
      }
      return {
        id: `invoice-line-${Date.now()}-${index + 1}`,
        invoice_id: id,
        company_id: existing.company_id,
        line_no: index + 1,
        item_name: itemName,
        specification: asPreviewText(line.specification) || null,
        unit: asPreviewText(line.unit) || null,
        quantity: line.quantity == null ? null : Number(line.quantity),
        unit_price: line.unit_price == null ? null : Number(line.unit_price),
        amount: Number(line.amount || 0),
        tax_rate: line.tax_rate == null ? null : Number(line.tax_rate),
        tax_amount: Number(line.tax_amount || 0),
        tax_classification_code:
          asPreviewText(line.tax_classification_code) || null,
        created_at: now,
        updated_at: now,
      };
    });
    const result = updateBrowserPreviewInvoice({
      id,
      input,
      invoices,
      now: new Date(now),
    }) as { invoice: BrowserPreviewInvoice; invoices: BrowserPreviewInvoice[] };
    saveBrowserPreviewInvoiceLines([
      ...readBrowserPreviewInvoiceLines().filter(
        (line) =>
          !(line.invoice_id === id && line.company_id === existing.company_id),
      ),
      ...lines,
    ]);
    saveBrowserPreviewInvoices(result.invoices);
    return result.invoice as T;
  }
  if (cmd === "review_output_invoice") {
    const invoiceId = asPreviewText(filters.invoiceId);
    const companyId = asPreviewText(filters.companyId);
    const invoices = readBrowserPreviewInvoices();
    const invoice = invoices.find(
      (item) =>
        item.id === invoiceId &&
        item.company_id === companyId &&
        item.invoice_type === "output",
    );
    if (!invoice) throw new Error("销项发票不存在或不属于当前公司");
    if (invoice.status !== "pending" || invoice.voucher_id) {
      throw new Error("只有待复核且未关联凭证的销项发票可以完成复核");
    }
    const lines = readBrowserPreviewInvoiceLines().filter(
      (line) => line.invoice_id === invoiceId && line.company_id === companyId,
    );
    if (lines.length === 0)
      throw new Error("请先补齐并核对销项发票货物或服务明细");
    const lineAmount = lines.reduce((total, line) => total + line.amount, 0);
    const lineTax = lines.reduce((total, line) => total + line.tax_amount, 0);
    if (
      Math.round(lineAmount * 100) !== Math.round(invoice.amount * 100) ||
      Math.round(lineTax * 100) !== Math.round(invoice.tax_amount * 100)
    ) {
      throw new Error("销项发票明细合计与表头不一致，不能完成复核");
    }
    const reviewed = { ...invoice, status: "verified", updated_at: now };
    saveBrowserPreviewInvoices(
      invoices.map((item) => (item.id === invoiceId ? reviewed : item)),
    );
    data.operationAuditLogs = [
      {
        id: `invoice-review-audit-${Date.now()}`,
        company_id: companyId,
        company_name: null,
        module_name: "发票管理",
        action: "复核销项发票",
        object_ref: invoiceId,
        risk_level: "normal",
        result: "success",
        detail: `销项发票 ${invoice.invoice_no} 已完成本地收入、税额和明细合计复核`,
        operator: "浏览器预览用户",
        created_at: now,
      },
      ...data.operationAuditLogs,
    ];
    saveBrowserAgencyPreviewData(data);
    return reviewed as T;
  }
  if (cmd === "delete_invoice") {
    const id = asPreviewText(filters.id);
    const companyId = asPreviewText(filters.companyId);
    const invoices = readBrowserPreviewInvoices();
    const existing = invoices.find(
      (invoice) => invoice.id === id && invoice.company_id === companyId,
    );
    if (!existing) throw new Error("发票不存在或不属于当前公司");
    if (existing.status !== "pending" || existing.voucher_id) {
      throw new Error("只有待复核且未关联凭证的发票可以删除");
    }
    saveBrowserPreviewInvoices(invoices.filter((invoice) => invoice.id !== id));
    saveBrowserPreviewInvoiceLines(
      readBrowserPreviewInvoiceLines().filter(
        (line) => !(line.invoice_id === id && line.company_id === companyId),
      ),
    );
    saveBrowserPreviewInvoiceTaxEvents(
      readBrowserPreviewInvoiceTaxEvents().filter(
        (event) => !(event.invoice_id === id && event.company_id === companyId),
      ),
    );
    data.operationAuditLogs = [
      {
        id: `invoice-delete-audit-${Date.now()}`,
        company_id: companyId,
        company_name: null,
        module_name: "发票管理",
        action: "删除发票",
        object_ref: id,
        risk_level: "high",
        result: "success",
        detail: `删除待复核发票 ${existing.invoice_no} 及其明细`,
        operator: "浏览器预览用户",
        created_at: now,
      },
      ...data.operationAuditLogs,
    ];
    saveBrowserAgencyPreviewData(data);
    return undefined as T;
  }
  if (cmd === "match_invoice_to_voucher") {
    const companyId = asPreviewText(filters.companyId);
    const invoiceId = asPreviewText(filters.invoiceId);
    const voucherId = asPreviewText(filters.voucherId);
    const invoices = readBrowserPreviewInvoices();
    const invoice = invoices.find(
      (item) => item.id === invoiceId && item.company_id === companyId,
    );
    if (!invoice) throw new Error("发票不存在或不属于当前公司");
    const lines = readBrowserPreviewInvoiceLines().filter(
      (line) => line.invoice_id === invoiceId && line.company_id === companyId,
    );
    if (lines.length === 0) {
      throw new Error("请先补齐并核对发票货物或服务明细，再关联凭证");
    }
    const lineAmount = lines.reduce((total, line) => total + line.amount, 0);
    const lineTax = lines.reduce((total, line) => total + line.tax_amount, 0);
    if (
      Math.round(lineAmount * 100) !== Math.round(invoice.amount * 100) ||
      Math.round(lineTax * 100) !== Math.round(invoice.tax_amount * 100)
    ) {
      throw new Error("发票明细合计与表头不一致，不能关联凭证");
    }
    const voucher = readBrowserPreviewVouchers().find(
      (item) => item.id === voucherId && item.company_id === companyId,
    );
    const result = matchBrowserPreviewInvoiceToVoucher({
      id: invoiceId,
      voucherId,
      companyId,
      voucher,
      invoices,
      now: new Date(now),
    }) as { invoice: BrowserPreviewInvoice; invoices: BrowserPreviewInvoice[] };
    saveBrowserPreviewInvoices(result.invoices);
    data.operationAuditLogs = [
      {
        id: `invoice-match-audit-${Date.now()}`,
        company_id: companyId,
        company_name: null,
        module_name: "发票管理",
        action: "关联发票与凭证",
        object_ref: invoiceId,
        risk_level: "normal",
        result: "success",
        detail: `发票 ${invoice.invoice_no} 已关联草稿凭证 ${voucherId}`,
        operator: "浏览器预览用户",
        created_at: now,
      },
      ...data.operationAuditLogs,
    ];
    saveBrowserAgencyPreviewData(data);
    return undefined as T;
  }
  if (cmd === "get_invoices_by_voucher") {
    const companyId = asPreviewText(filters.companyId);
    const voucherId = asPreviewText(filters.voucherId);
    return readBrowserPreviewInvoices().filter(
      (invoice) =>
        invoice.company_id === companyId && invoice.voucher_id === voucherId,
    ) as T;
  }
  if (cmd === "get_invoice_lines") {
    const invoiceId = asPreviewText(filters.invoiceId);
    const companyId = asPreviewText(filters.companyId);
    return readBrowserPreviewInvoiceLines()
      .filter(
        (line) =>
          line.invoice_id === invoiceId && line.company_id === companyId,
      )
      .sort((left, right) => left.line_no - right.line_no) as T;
  }
  if (cmd === "replace_invoice_lines") {
    const invoiceId = asPreviewText(filters.invoiceId);
    const companyId = asPreviewText(filters.companyId);
    const invoice = readBrowserPreviewInvoices().find(
      (item) => item.id === invoiceId && item.company_id === companyId,
    );
    if (!invoice) throw new Error("发票不存在或不属于当前公司");
    if (invoice.status !== "pending" || invoice.voucher_id) {
      throw new Error("只有待复核且未关联凭证的发票可以修改明细");
    }
    const rawLines = Array.isArray(filters.lines)
      ? (filters.lines as Record<string, unknown>[])
      : [];
    // prettier-ignore
    if (rawLines.length === 0) throw new Error("发票至少需要一条货物或服务明细");
    const detailAmount = rawLines.reduce(
      (total, line) => total + Number(line.amount || 0),
      0,
    );
    const detailTax = rawLines.reduce(
      (total, line) => total + Number(line.tax_amount || 0),
      0,
    );
    if (
      Math.round(detailAmount * 100) !== Math.round(invoice.amount * 100) ||
      Math.round(detailTax * 100) !== Math.round(invoice.tax_amount * 100)
    ) {
      throw new Error("明细合计必须与发票表头金额和税额一致");
    }
    const lines = rawLines.map((line, index): BrowserPreviewInvoiceLine => {
      const itemName = asPreviewText(line.item_name).trim();
      const amount = Number(line.amount || 0);
      const taxAmount = Number(line.tax_amount || 0);
      if (
        !itemName ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(taxAmount) ||
        taxAmount < 0
      ) {
        throw new Error(`第 ${index + 1} 行明细不完整`);
      }
      return {
        id: `invoice-line-${Date.now()}-${index + 1}`,
        invoice_id: invoiceId,
        company_id: companyId,
        line_no: index + 1,
        item_name: itemName,
        specification: asPreviewText(line.specification) || null,
        unit: asPreviewText(line.unit) || null,
        quantity: line.quantity == null ? null : Number(line.quantity),
        unit_price: line.unit_price == null ? null : Number(line.unit_price),
        amount,
        tax_rate: line.tax_rate == null ? null : Number(line.tax_rate),
        tax_amount: taxAmount,
        tax_classification_code:
          asPreviewText(line.tax_classification_code) || null,
        created_at: now,
        updated_at: now,
      };
    });
    saveBrowserPreviewInvoiceLines([
      ...readBrowserPreviewInvoiceLines().filter(
        (line) =>
          !(line.invoice_id === invoiceId && line.company_id === companyId),
      ),
      ...lines,
    ]);
    return lines as T;
  }
  if (cmd === "get_invoice_tax_events") {
    const invoiceId = asPreviewText(filters.invoiceId);
    const companyId = asPreviewText(filters.companyId);
    return readBrowserPreviewInvoiceTaxEvents()
      .filter(
        (event) =>
          event.invoice_id === invoiceId && event.company_id === companyId,
      )
      .sort((left, right) =>
        right.occurred_at.localeCompare(left.occurred_at),
      ) as T;
  }
  if (cmd === "create_invoice_tax_event") {
    const invoiceId = asPreviewText(filters.invoiceId);
    const companyId = asPreviewText(filters.companyId);
    const invoices = readBrowserPreviewInvoices();
    const invoice = invoices.find(
      (item) =>
        item.id === invoiceId &&
        item.company_id === companyId &&
        item.invoice_type === "input",
    );
    if (!invoice) throw new Error("进项发票不存在或不属于当前公司");
    if (
      !readBrowserPreviewInvoiceLines().some(
        (line) =>
          line.invoice_id === invoiceId && line.company_id === companyId,
      )
    ) {
      throw new Error("请先补齐并核对发票货物或服务明细，再登记认证或抵扣记录");
    }
    const eventType = asPreviewText(input.event_type);
    const allowed = new Set([
      "certification_review_passed",
      "deduction_declared",
      "deduction_transferred_out",
      "not_deductible",
    ]);
    if (!allowed.has(eventType)) throw new Error("不支持的进项税处理类型");
    if (
      eventType === "certification_review_passed" &&
      invoice.status !== "pending"
    ) {
      throw new Error("只有待认证发票可以登记认证复核通过");
    }
    const deductibleTaxAmount = Number(input.deductible_tax_amount || 0);
    if (
      !Number.isFinite(deductibleTaxAmount) ||
      deductibleTaxAmount < 0 ||
      Math.round(deductibleTaxAmount * 100) >
        Math.round(invoice.tax_amount * 100)
    ) {
      throw new Error("本次抵扣税额必须在 0 与发票税额之间");
    }
    const event: BrowserPreviewInvoiceTaxEvent = {
      id: `invoice-tax-event-${Date.now()}`,
      invoice_id: invoiceId,
      company_id: companyId,
      event_type: eventType,
      deduction_period: asPreviewText(input.deduction_period) || null,
      deductible_tax_amount: deductibleTaxAmount,
      source: asPreviewText(input.source, "人工复核"),
      reference_no: asPreviewText(input.reference_no) || null,
      remarks: asPreviewText(input.remarks) || null,
      operator: "浏览器预览用户",
      occurred_at: now,
    };
    saveBrowserPreviewInvoiceTaxEvents([
      event,
      ...readBrowserPreviewInvoiceTaxEvents(),
    ]);
    if (eventType === "certification_review_passed") {
      saveBrowserPreviewInvoices(
        invoices.map((item) =>
          item.id === invoiceId && item.company_id === companyId
            ? { ...item, status: "verified", updated_at: now }
            : item,
        ),
      );
    }
    return event as T;
  }

  if (cmd === "get_agency_service_contracts") {
    const companyId = asPreviewText(filters.companyId);
    const status = asPreviewText(filters.status);
    return data.contracts.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!status || item.status === status),
    ) as T;
  }
  if (
    cmd === "create_agency_service_contract" ||
    cmd === "update_agency_service_contract"
  ) {
    const existing = data.contracts.find(
      (item) => item.id === asPreviewText(input.id),
    );
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const record: BrowserAgencyContract = {
      id: existing?.id || browserAgencyId("agency-contract"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      contract_no: asPreviewText(
        input.contract_no,
        existing?.contract_no || "",
      ),
      service_package: asPreviewText(
        input.service_package,
        existing?.service_package || "",
      ),
      service_start: asPreviewText(
        input.service_start,
        existing?.service_start || "",
      ),
      service_end: asPreviewText(
        input.service_end,
        existing?.service_end || "",
      ),
      monthly_fee: asPreviewNumber(
        input.monthly_fee,
        existing?.monthly_fee || 0,
      ),
      renewal_status: asPreviewText(
        input.renewal_status,
        existing?.renewal_status || "normal",
      ),
      owner: asPreviewText(input.owner, existing?.owner || "") || null,
      archive_status: asPreviewText(
        input.archive_status,
        existing?.archive_status || "pending",
      ),
      status: asPreviewText(input.status, existing?.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.contracts = upsertBrowserAgencyRecord(data.contracts, record);
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_agency_fee_collections") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    const status = asPreviewText(filters.status);
    return data.fees.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!period || item.period === period) &&
        (!status || item.status === status),
    ) as T;
  }
  if (
    cmd === "create_agency_fee_collection" ||
    cmd === "update_agency_fee_collection"
  ) {
    const existing = data.fees.find(
      (item) => item.id === asPreviewText(input.id),
    );
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const receivable = asPreviewNumber(
      input.receivable_amount,
      existing?.receivable_amount || 0,
    );
    const received = asPreviewNumber(
      input.received_amount,
      existing?.received_amount || 0,
    );
    const record: BrowserAgencyFee = {
      id: existing?.id || browserAgencyId("agency-fee"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      period: asPreviewText(
        input.period,
        existing?.period || new Date().toISOString().slice(0, 7),
      ),
      receivable_amount: receivable,
      received_amount: received,
      arrears_amount: Math.max(0, receivable - received),
      invoice_status: asPreviewText(
        input.invoice_status,
        existing?.invoice_status || "pending",
      ),
      payment_status: asPreviewText(
        input.payment_status,
        existing?.payment_status || "pending",
      ),
      collector:
        asPreviewText(input.collector, existing?.collector || "") || null,
      last_follow_up:
        asPreviewText(input.last_follow_up, existing?.last_follow_up || "") ||
        null,
      status: asPreviewText(input.status, existing?.status || "pending"),
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.fees = upsertBrowserAgencyRecord(data.fees, record);
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_agency_collaboration_items") {
    const companyId = asPreviewText(filters.companyId);
    const status = asPreviewText(filters.status);
    return data.collaborations.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!status || item.status === status),
    ) as T;
  }
  if (
    cmd === "create_agency_collaboration_item" ||
    cmd === "update_agency_collaboration_item"
  ) {
    const existing = data.collaborations.find(
      (item) => item.id === asPreviewText(input.id),
    );
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const record: BrowserAgencyCollaboration = {
      id: existing?.id || browserAgencyId("agency-collaboration"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      todo_title: asPreviewText(input.todo_title, existing?.todo_title || ""),
      material_type:
        asPreviewText(input.material_type, existing?.material_type || "") ||
        null,
      customer_contact:
        asPreviewText(
          input.customer_contact,
          existing?.customer_contact || "",
        ) || null,
      reminder_count: asPreviewNumber(
        input.reminder_count,
        existing?.reminder_count || 0,
      ),
      last_contact_at:
        asPreviewText(input.last_contact_at, existing?.last_contact_at || "") ||
        null,
      reply_status: asPreviewText(
        input.reply_status,
        existing?.reply_status || "pending",
      ),
      owner: asPreviewText(input.owner, existing?.owner || "") || null,
      status: asPreviewText(input.status, existing?.status || "pending"),
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.collaborations = upsertBrowserAgencyRecord(
      data.collaborations,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_agency_batch_tasks") {
    const period = asPreviewText(filters.period);
    const status = asPreviewText(filters.status);
    return data.batchTasks.filter(
      (item) =>
        (!period || item.period === period) &&
        (!status || item.status === status),
    ) as T;
  }
  if (cmd === "create_agency_batch_tasks") {
    const period = asPreviewText(
      input.period,
      new Date().toISOString().slice(0, 7),
    );
    const taskTypes = Array.isArray(input.task_types)
      ? input.task_types.filter(
          (item): item is string => typeof item === "string",
        )
      : browserBatchTaskTemplates.map(([taskType]) => taskType);
    const operator = asPreviewText(input.operator, "admin");
    let created = 0;
    let skipped = 0;
    for (const [
      taskType,
      taskName,
      scope,
      summary,
      riskLevel,
      requiresApproval,
    ] of browserBatchTaskTemplates) {
      if (!taskTypes.includes(taskType)) continue;
      const activeTask = data.batchTasks.some(
        (item) =>
          item.period === period &&
          item.task_type === taskType &&
          !["completed", "cancelled"].includes(item.status),
      );
      if (activeTask) {
        skipped += 1;
        continue;
      }
      data.batchTasks.unshift({
        id: browserAgencyId("agency-batch"),
        task_type: taskType,
        task_name: taskName,
        period,
        customer_scope: scope,
        status: "queued",
        progress_current: 0,
        progress_total: null,
        result_summary: summary,
        risk_level: riskLevel,
        operator,
        requires_approval: requiresApproval,
        created_at: now,
        updated_at: now,
      });
      created += 1;
    }
    saveBrowserAgencyPreviewData(data);
    return { created, skipped } as T;
  }
  if (cmd === "run_agency_batch_task_precheck") {
    const task = data.batchTasks.find(
      (item) => item.id === asPreviewText(input.id),
    );
    if (!task || task.status !== "queued")
      throw new Error("当前任务状态不允许重复执行预检");
    task.status = task.requires_approval ? "awaiting_approval" : "prechecked";
    task.progress_current = 1;
    task.progress_total = task.progress_total || 1;
    task.operator = asPreviewText(input.operator, task.operator || "admin");
    task.result_summary = task.requires_approval
      ? "本地预检完成，不会登录或调用税局、银行等外部系统；高风险任务待人工审批。"
      : "本地预检完成，不会登录或调用税局、银行等外部系统；后续采集需人工发起。";
    task.updated_at = now;
    saveBrowserAgencyPreviewData(data);
    return task as T;
  }
  if (cmd === "review_agency_batch_task") {
    const task = data.batchTasks.find(
      (item) => item.id === asPreviewText(input.id),
    );
    if (!task || !task.requires_approval || task.status !== "awaiting_approval")
      throw new Error("当前任务不在待审批状态");
    const approved = input.decision === "approved";
    task.status = approved ? "prechecked" : "blocked";
    task.operator = asPreviewText(input.operator, task.operator || "admin");
    task.result_summary = approved
      ? "本地预检已人工通过；未登录或调用税局、银行等外部系统，后续动作仍需人工发起。"
      : "本地预检已驳回并阻断后续操作；未登录或调用税局、银行等外部系统。";
    task.updated_at = now;
    saveBrowserAgencyPreviewData(data);
    return task as T;
  }
  if (cmd === "get_agency_batch_task_items") {
    const taskId = asPreviewText(filters.taskId);
    return data.batchTaskItems
      .filter((item) => item.task_id === taskId)
      .sort((left, right) =>
        (left.company_name || left.company_id).localeCompare(
          right.company_name || right.company_id,
          "zh-CN",
        ),
      ) as T;
  }
  if (cmd === "run_agency_batch_task") {
    const task = data.batchTasks.find(
      (item) => item.id === asPreviewText(input.id),
    );
    if (!task || task.status !== "prechecked") {
      throw new Error("只有已完成预检并通过审批的任务可以执行");
    }
    const companies = readBrowserPreviewCompanies().filter(
      (company) => company.is_active === 1,
    );
    task.status = "processing";
    task.progress_current = 0;
    task.progress_total = companies.length;
    task.operator = "浏览器预览用户";
    task.updated_at = now;
    data.batchTaskItems = data.batchTaskItems.filter(
      (item) => item.task_id !== task.id,
    );
    const [periodYearText, periodMonthText] = task.period.split("-");
    const periodYear = Number(periodYearText);
    const periodMonth = Number(periodMonthText);
    let successCount = 0;
    let blockedCount = 0;

    for (const company of companies) {
      const period = readBrowserPreviewPeriods().find(
        (item) =>
          item.company_id === company.id &&
          item.period_year === periodYear &&
          item.period_month === periodMonth,
      );
      const item: BrowserAgencyBatchTaskItem = {
        id: browserAgencyId("agency-batch-item"),
        task_id: task.id,
        company_id: company.id,
        company_name: company.name,
        period_id: period?.id || null,
        action: task.task_name,
        status: "processing",
        result_summary: null,
        error_message: null,
        created_at: now,
        updated_at: now,
      };
      const enqueueJob = (jobType: string, summary: string) => {
        data.automationJobs.unshift({
          id: browserAgencyId("agency-batch-job"),
          company_id: company.id,
          company_name: company.name,
          period: task.period,
          job_type: jobType,
          source_module: "agency_batch",
          source_id: task.id,
          source_file: null,
          suggestion_no: null,
          debit_subject: null,
          credit_subject: null,
          suggestion_amount: null,
          generated_voucher_id: null,
          generated_voucher_number: null,
          status: "queued",
          confidence: null,
          result_summary: summary,
          risk_level: task.risk_level,
          reviewer: null,
          created_by: "浏览器预览用户",
          created_at: now,
          updated_at: now,
        });
        item.status = "queued";
        item.result_summary = summary;
      };

      try {
        if (
          task.task_type === "invoice_collection" ||
          task.task_type === "bank_collection"
        ) {
          const adapterType =
            task.task_type === "bank_collection" ? "bank" : "tax";
          const authorized = data.authorizations.some(
            (authorization) =>
              authorization.company_id === company.id &&
              (adapterType === "bank"
                ? authorization.adapter_type === "bank"
                : ["tax", "invoice_pool"].includes(
                    authorization.adapter_type,
                  )) &&
              authorization.auth_status === "authorized" &&
              (!authorization.expires_at ||
                authorization.expires_at >= now.slice(0, 10)),
          );
          if (!authorized)
            throw new Error(
              adapterType === "bank"
                ? "缺少有效银行授权"
                : "缺少有效税务或票池授权",
            );
          enqueueJob(
            task.task_type,
            adapterType === "bank"
              ? "已进入银行流水采集队列；结果需在采集工作台复核。"
              : "已进入发票采集队列；结果需在发票采集工作台复核。",
          );
        } else if (task.task_type === "voucher_generation_precheck") {
          if (!period) throw new Error("当前账期不存在，不能生成凭证建议");
          enqueueJob(
            "voucher_suggestion",
            "已进入凭证建议生成队列；只生成待确认草稿。",
          );
        } else if (task.task_type === "closing_precheck") {
          if (!period) throw new Error("当前账期不存在，不能执行结账");
          throw new Error(
            "浏览器预览不执行正式批量结账，请在桌面端使用完整会计校验",
          );
        } else if (task.task_type === "tax_declaration_precheck") {
          if (!period) throw new Error("当前账期不存在，不能生成申报包");
          if (
            !data.taxDeclarationTasks.some(
              (taxTask) =>
                taxTask.company_id === company.id &&
                taxTask.period === task.period,
            )
          ) {
            throw new Error("当前账期没有可生成申报包的税务任务");
          }
          enqueueJob(
            "tax_package_generation",
            "已进入本地申报包生成队列；不会自动提交税局。",
          );
        } else if (task.task_type === "declaration_receipt_archive") {
          if (
            !data.taxDeclarationTasks.some(
              (taxTask) =>
                taxTask.company_id === company.id &&
                taxTask.period === task.period &&
                ["confirmed", "submitted", "archived"].includes(
                  taxTask.declaration_status,
                ),
            )
          ) {
            throw new Error("当前账期没有已确认的申报事项可归档");
          }
          enqueueJob(
            "declaration_receipt_archive",
            "已进入本地回执与缴款资料归档队列。",
          );
        } else {
          throw new Error(`不支持执行的批量任务类型: ${task.task_type}`);
        }
        successCount += 1;
      } catch (error) {
        blockedCount += 1;
        item.status = "blocked";
        item.result_summary = "未执行";
        item.error_message = String(error).replace(/^Error:\s*/, "");
      }
      data.batchTaskItems.unshift(item);
      task.progress_current += 1;
    }

    task.status =
      successCount === 0
        ? "blocked"
        : blockedCount > 0
          ? "completed_with_errors"
          : "completed";
    task.result_summary = `逐账套执行完成：成功或已入队 ${successCount} 户，阻断 ${blockedCount} 户，共 ${companies.length} 户。`;
    task.updated_at = now;
    data.operationAuditLogs.unshift({
      id: browserAgencyId("agency-batch-audit"),
      company_id: null,
      company_name: null,
      module_name: "批量操作",
      action: "执行批量任务",
      object_ref: task.id,
      risk_level: "high",
      result: blockedCount === 0 ? "success" : "partial",
      detail: task.result_summary,
      operator: "浏览器预览用户",
      created_at: now,
    });
    saveBrowserAgencyPreviewData(data);
    return task as T;
  }

  if (
    cmd === "get_agency_adapter_authorizations" ||
    cmd === "get_adapter_authorizations"
  ) {
    const companyId = asPreviewText(filters.companyId);
    const adapterType = asPreviewText(filters.adapterType);
    return data.authorizations.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!adapterType || item.adapter_type === adapterType),
    ) as T;
  }
  if (cmd === "upsert_adapter_authorization") {
    const existing = data.authorizations.find(
      (item) =>
        item.company_id === asPreviewText(input.company_id, firstCompanyId) &&
        item.adapter_type === asPreviewText(input.adapter_type, "tax") &&
        item.adapter_code === asPreviewText(input.adapter_code, ""),
    );
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const record: BrowserAdapterAuthorization = {
      id: existing?.id || browserAgencyId("agency-authorization"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      adapter_type: asPreviewText(
        input.adapter_type,
        existing?.adapter_type || "tax",
      ),
      adapter_code: asPreviewText(
        input.adapter_code,
        existing?.adapter_code || "",
      ),
      region: asPreviewText(input.region, existing?.region || "") || null,
      auth_status: asPreviewText(
        input.auth_status,
        existing?.auth_status || "pending",
      ),
      account_mask:
        asPreviewText(input.account_mask, existing?.account_mask || "") || null,
      login_identity:
        asPreviewText(input.login_identity, existing?.login_identity || "") ||
        null,
      capability_scope:
        asPreviewText(
          input.capability_scope,
          existing?.capability_scope || "",
        ) || null,
      last_checked_at:
        asPreviewText(
          input.last_checked_at,
          existing?.last_checked_at || now,
        ) || null,
      expires_at:
        asPreviewText(input.expires_at, existing?.expires_at || "") || null,
      risk_message:
        asPreviewText(input.risk_message, existing?.risk_message || "") || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.authorizations = upsertBrowserAgencyRecord(
      data.authorizations,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }
  if (cmd === "get_adapter_provider_config") {
    return null as T;
  }
  if (
    cmd === "upsert_adapter_provider_config" ||
    cmd === "verify_adapter_authorization"
  ) {
    throw new Error("真实接口授权验证仅支持桌面版；浏览器预览不会读取凭据或发起外部请求");
  }
  if (
    cmd === "submit_tax_declaration_task" ||
    cmd === "sync_tax_declaration_receipt"
  ) {
    throw new Error("真实税局申报与回执同步仅支持桌面版；浏览器预览不会连接税局系统");
  }
  if (cmd === "get_external_invoice_sync_items") return [] as T;
  if (
    cmd === "sync_external_invoice_pool" ||
    cmd === "import_external_invoice_sync_item" ||
    cmd === "reject_external_invoice_sync_item"
  ) {
    throw new Error("真实发票池同步仅支持桌面版；浏览器预览不会连接票池或生成正式发票");
  }
  if (cmd === "get_external_bank_sync_items") return [] as T;
  if (
    cmd === "sync_external_bank_statement" ||
    cmd === "import_external_bank_sync_item" ||
    cmd === "reject_external_bank_sync_item"
  ) {
    throw new Error("真实银行流水同步仅支持桌面版；浏览器预览不会连接网银、生成流水或发起付款");
  }

  if (cmd === "get_tax_declaration_tasks") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    const declarationStatus = asPreviewText(filters.declarationStatus);
    return data.taxDeclarationTasks.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!period || item.period === period) &&
        (!declarationStatus || item.declaration_status === declarationStatus),
    ) as T;
  }
  if (cmd === "upsert_tax_declaration_task") {
    const companyId = asPreviewText(input.company_id, firstCompanyId);
    const period = asPreviewText(
      input.period,
      new Date().toISOString().slice(0, 7),
    );
    const taxType = asPreviewText(input.tax_type);
    const existing = data.taxDeclarationTasks.find(
      (item) =>
        item.company_id === companyId &&
        item.period === period &&
        item.tax_type === taxType &&
        item.form_name === asPreviewText(input.form_name),
    );
    const declarationStatus = asPreviewText(
      input.declaration_status,
      existing?.declaration_status || "draft",
    );
    const currentStatus = existing?.declaration_status.toLowerCase();
    const isFinalStatus = Boolean(
      currentStatus &&
      ["confirmed", "archived", "submitted", "completed"].includes(
        currentStatus,
      ),
    );
    const allowsReceiptArchive =
      currentStatus === "confirmed" && declarationStatus === "archived";
    if (isFinalStatus && !allowsReceiptArchive) {
      if (currentStatus === declarationStatus) {
        throw new Error("已完成本地确认的申报事项不能再次覆盖");
      }
      throw new Error("已完成本地确认的申报事项不能回退或改写状态");
    }
    const snapshotVersion = (existing?.snapshot_version || 0) + 1;
    const snapshotFingerprint = browserTaxSnapshotFingerprint(
      JSON.stringify([
        companyId,
        period,
        taxType,
        input.form_name,
        declarationStatus,
        input.source_snapshot,
        input.taxable_amount,
        input.deduction_amount,
        input.payable_amount,
        input.risk_count,
        snapshotVersion,
      ]),
    );
    const record: BrowserTaxDeclarationTask = {
      id: existing?.id || browserAgencyId("tax-declaration"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      period,
      tax_type: taxType,
      form_name: asPreviewText(input.form_name, existing?.form_name || ""),
      collect_status: asPreviewText(
        input.collect_status,
        existing?.collect_status || "未取数",
      ),
      validation_status: asPreviewText(
        input.validation_status,
        existing?.validation_status || "pending",
      ),
      declaration_status: declarationStatus,
      source_snapshot:
        asPreviewText(input.source_snapshot, existing?.source_snapshot || "") ||
        null,
      taxable_amount: asPreviewNumber(
        input.taxable_amount,
        existing?.taxable_amount || 0,
      ),
      deduction_amount: asPreviewNumber(
        input.deduction_amount,
        existing?.deduction_amount || 0,
      ),
      payable_amount: asPreviewNumber(
        input.payable_amount,
        existing?.payable_amount || 0,
      ),
      risk_count: asPreviewNumber(input.risk_count, existing?.risk_count || 0),
      adapter_code:
        asPreviewText(input.adapter_code, existing?.adapter_code || "") || null,
      confirmed_by: existing?.confirmed_by || null,
      confirmed_at: existing?.confirmed_at || null,
      receipt_no:
        asPreviewText(input.receipt_no, existing?.receipt_no || "") || null,
      payment_status: asPreviewText(
        input.payment_status,
        existing?.payment_status || "unrecorded",
      ),
      payment_no:
        asPreviewText(input.payment_no, existing?.payment_no || "") || null,
      receipt_received_at:
        asPreviewText(
          input.receipt_received_at,
          existing?.receipt_received_at || "",
        ) || null,
      snapshot_version: snapshotVersion,
      snapshot_fingerprint: snapshotFingerprint,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.taxDeclarationTasks = upsertBrowserAgencyRecord(
      data.taxDeclarationTasks,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }
  if (cmd === "confirm_tax_declaration_task") {
    const task = data.taxDeclarationTasks.find(
      (item) =>
        item.id === asPreviewText(input.id) &&
        item.company_id === asPreviewText(input.company_id),
    );
    if (!task) throw new Error("未找到需要确认的本地申报事项");
    if (!["collected", "已取数"].includes(task.collect_status)) {
      throw new Error("申报事项尚未完成取数，不能确认");
    }
    if (task.validation_status !== "passed" || task.risk_count > 0) {
      throw new Error("申报事项未通过校验或仍有风险，不能确认");
    }
    if (
      ["confirmed", "archived", "submitted", "completed"].includes(
        task.declaration_status.toLowerCase(),
      )
    ) {
      throw new Error("申报事项已完成本地确认，不能重复确认");
    }
    task.declaration_status = "confirmed";
    task.confirmed_by = "本地预览用户";
    task.confirmed_at = now;
    task.snapshot_version += 1;
    task.snapshot_fingerprint = browserTaxSnapshotFingerprint(
      JSON.stringify([
        task.id,
        task.snapshot_version,
        task.collect_status,
        task.validation_status,
        task.declaration_status,
        task.source_snapshot,
        task.taxable_amount,
        task.deduction_amount,
        task.payable_amount,
        task.risk_count,
      ]),
    );
    task.updated_at = now;
    saveBrowserAgencyPreviewData(data);
    return task as T;
  }

  if (cmd === "get_operation_audit_logs") {
    const companyId = asPreviewText(filters.companyId);
    const moduleName = asPreviewText(filters.moduleName);
    return data.operationAuditLogs.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!moduleName || item.module_name === moduleName),
    ) as T;
  }
  if (cmd === "write_operation_audit_log") {
    const companyId = asPreviewText(input.company_id) || null;
    const record: BrowserOperationAuditLog = {
      id: browserAgencyId("operation-audit"),
      company_id: companyId,
      company_name: companyId ? browserAgencyCompanyName(companyId) : null,
      module_name: asPreviewText(input.module_name),
      action: asPreviewText(input.action),
      object_ref: asPreviewText(input.object_ref) || null,
      risk_level: asPreviewText(input.risk_level, "normal"),
      result: asPreviewText(input.result, "success"),
      detail: asPreviewText(input.detail) || null,
      operator: "本地预览用户",
      created_at: now,
    };
    data.operationAuditLogs.unshift(record);
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_ai_provider_configs") {
    const companyId = asPreviewText(filters.companyId);
    return data.aiProviderConfigs.filter(
      (item) => !companyId || item.company_id === companyId,
    ) as T;
  }
  if (cmd === "upsert_ai_provider_config") {
    const companyId = asPreviewText(input.company_id, firstCompanyId);
    const providerName = asPreviewText(input.provider_name);
    const existing = data.aiProviderConfigs.find(
      (item) =>
        item.company_id === companyId && item.provider_name === providerName,
    );
    const record: BrowserAiProviderConfig = {
      id:
        asPreviewText(input.id, existing?.id || "") ||
        browserAgencyId("ai-provider"),
      company_id: companyId,
      provider_name: providerName,
      provider_type: asPreviewText(input.provider_type, "generic_json"),
      endpoint: asPreviewText(input.endpoint),
      model: asPreviewText(input.model),
      credential_env: asPreviewText(input.credential_env),
      timeout_seconds: asPreviewNumber(input.timeout_seconds, 30),
      max_file_bytes: asPreviewNumber(input.max_file_bytes, 8 * 1024 * 1024),
      is_enabled: asPreviewNumber(input.is_enabled, 1),
      created_by: existing?.created_by || "本地预览用户",
      updated_by: "本地预览用户",
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.aiProviderConfigs = upsertBrowserAgencyRecord(
      data.aiProviderConfigs,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }
  if (cmd === "run_ai_recognition_job") {
    throw new Error("外部资料识别仅可在桌面端执行，浏览器预览不会发送文件");
  }

  if (cmd === "get_agency_automation_jobs" || cmd === "get_automation_jobs") {
    const companyId = asPreviewText(filters.companyId);
    const period = asPreviewText(filters.period);
    const status = asPreviewText(filters.status);
    return data.automationJobs.filter(
      (item) =>
        (!companyId || item.company_id === companyId) &&
        (!period || item.period === period) &&
        (!status || item.status === status),
    ) as T;
  }
  if (
    cmd === "create_automation_job" ||
    cmd === "update_automation_job_status"
  ) {
    const existing = data.automationJobs.find(
      (item) => item.id === asPreviewText(input.id),
    );
    const companyId = asPreviewText(
      input.company_id,
      existing?.company_id || firstCompanyId,
    );
    const record: BrowserAutomationJob = {
      id: existing?.id || browserAgencyId("automation-job"),
      company_id: companyId,
      company_name: browserAgencyCompanyName(
        companyId,
        existing?.company_name || null,
      ),
      period: asPreviewText(input.period, existing?.period || "") || null,
      job_type: asPreviewText(
        input.job_type,
        existing?.job_type || "voucher_suggestion",
      ),
      source_module: asPreviewText(
        input.source_module,
        existing?.source_module || "manual",
      ),
      source_id:
        asPreviewText(input.source_id, existing?.source_id || "") || null,
      source_file:
        asPreviewText(input.source_file, existing?.source_file || "") || null,
      suggestion_no:
        asPreviewText(input.suggestion_no, existing?.suggestion_no || "") ||
        null,
      debit_subject:
        asPreviewText(input.debit_subject, existing?.debit_subject || "") ||
        null,
      credit_subject:
        asPreviewText(input.credit_subject, existing?.credit_subject || "") ||
        null,
      suggestion_amount:
        input.suggestion_amount === undefined
          ? existing?.suggestion_amount || null
          : asPreviewNumber(input.suggestion_amount),
      generated_voucher_id: existing?.generated_voucher_id || null,
      generated_voucher_number: existing?.generated_voucher_number || null,
      status: asPreviewText(input.status, existing?.status || "queued"),
      confidence:
        input.confidence === undefined
          ? existing?.confidence || null
          : asPreviewNumber(input.confidence),
      result_summary:
        asPreviewText(input.result_summary, existing?.result_summary || "") ||
        null,
      risk_level: asPreviewText(
        input.risk_level,
        existing?.risk_level || "normal",
      ),
      reviewer:
        cmd === "update_automation_job_status"
          ? "本地预览用户"
          : asPreviewText(input.reviewer, existing?.reviewer || "") || null,
      created_by: existing?.created_by || "本地预览用户",
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    data.automationJobs = upsertBrowserAgencyRecord(
      data.automationJobs,
      record,
    );
    saveBrowserAgencyPreviewData(data);
    return record as T;
  }

  if (cmd === "get_agency_health_checks") {
    const period = asPreviewText(filters.period);
    const feeRisks = data.fees
      .filter(
        (item) =>
          (!period || item.period === period) &&
          (item.payment_status === "overdue" || item.arrears_amount > 0),
      )
      .map((item) => ({
        id: `fee-${item.id}`,
        company_id: item.company_id,
        company_name: browserAgencyCompanyName(
          item.company_id,
          item.company_name,
        ),
        module_name: "服务费开票",
        risk_message: `服务费欠费 ${item.arrears_amount.toFixed(2)} 元`,
        risk_level: item.payment_status === "overdue" ? "高" : "中",
        owner: item.collector,
        resolution_status: item.payment_status === "paid" ? "已完成" : "待跟进",
      }));
    const collaborationRisks = data.collaborations
      .filter(
        (item) => item.reply_status === "overdue" || item.status === "overdue",
      )
      .map((item) => ({
        id: `collaboration-${item.id}`,
        company_id: item.company_id,
        company_name: browserAgencyCompanyName(
          item.company_id,
          item.company_name,
        ),
        module_name: "交付协同",
        risk_message: `客户协同超时：${item.todo_title}`,
        risk_level: "中",
        owner: item.owner,
        resolution_status: "待跟进",
      }));
    const batchRisks = data.batchTasks
      .filter((item) => item.status === "blocked")
      .map((item) => ({
        id: `batch-${item.id}`,
        company_id: firstCompanyId,
        company_name: browserAgencyCompanyName(firstCompanyId),
        module_name: "批量操作",
        risk_message: `预检已阻断：${item.task_name}`,
        risk_level: "高",
        owner: item.operator,
        resolution_status: "待审批",
      }));
    return [...feeRisks, ...collaborationRisks, ...batchRisks] as T;
  }

  if (cmd === "get_agency_operation_overview") {
    const period = asPreviewText(filters.period);
    const expiring = data.contracts.filter(
      (item) => item.renewal_status !== "normal" || item.status === "overdue",
    );
    const scopedFees = data.fees.filter(
      (item) => !period || item.period === period,
    );
    const pendingCollaboration = data.collaborations.filter(
      (item) => item.status !== "completed" && item.reply_status !== "replied",
    );
    const overdueCollaboration = data.collaborations.filter(
      (item) => item.status === "overdue" || item.reply_status === "overdue",
    );
    const openTasks = data.batchTasks.filter(
      (item) => !["completed", "cancelled", "blocked"].includes(item.status),
    );
    const blockedTasks = data.batchTasks.filter(
      (item) => item.status === "blocked",
    );
    return {
      service_contracts: data.contracts.filter(
        (item) => item.status === "active",
      ).length,
      expiring_contracts: expiring.length,
      receivable_amount: scopedFees.reduce(
        (sum, item) => sum + item.receivable_amount,
        0,
      ),
      arrears_amount: scopedFees.reduce(
        (sum, item) => sum + item.arrears_amount,
        0,
      ),
      pending_collaboration: pendingCollaboration.length,
      overdue_collaboration: overdueCollaboration.length,
      open_tickets: openTasks.length,
      blocked_tickets: blockedTasks.length,
    } as T;
  }

  if (cmd === "get_agency_company_progress") {
    return buildAgencyCompanyProgressRows({
      companies: readBrowserPreviewCompanies().filter(
        (company) => company.is_deleted !== 1,
      ),
      periods: readBrowserPreviewPeriods(),
      invoices: readBrowserPreviewInvoices(),
      vouchers: readBrowserPreviewVouchers(),
      taxTasks: data.taxDeclarationTasks,
      requestedPeriod: asPreviewText(filters.period),
    }) as T;
  }

  const empty = EMPTY_RESULTS[cmd];
  if (empty !== undefined) {
    return empty as T;
  }
  throw new Error(`浏览器预览暂不支持命令：${cmd}`);
}

export const invoke: InvokeFn = isTauriEnv
  ? async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      if (!realInvoke) {
        const mod = await import("@tauri-apps/api/core");
        realInvoke = mod.invoke as InvokeFn;
      }
      try {
        const invokeArgs = PUBLIC_INVOKE_COMMANDS.has(cmd)
          ? args
          : {
              ...(args ?? {}),
              authToken: sessionStorage.getItem(PROTECTED_INVOKE_TOKEN_KEY),
            };
        const result = invokeArgs
          ? await realInvoke<T>(cmd, invokeArgs)
          : await realInvoke<T>(cmd);
        return result;
      } catch (error) {
        console.error(`[tauri.ts] Invoke '${cmd}' failed:`, error);
        throw error;
      }
    }
  : browserInvoke;
