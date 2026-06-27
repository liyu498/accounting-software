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

async function browserInvoke<T>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
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
