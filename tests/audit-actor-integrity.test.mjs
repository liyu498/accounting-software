import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function commandBody(source, command) {
  const marker = `pub async fn ${command}(`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing command ${command}`)
  const next = source.indexOf('#[tauri::command]', start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

function structBody(source, name) {
  const marker = `pub struct ${name}`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing struct ${name}`)
  const end = source.indexOf('\n}', start + marker.length)
  assert.notEqual(end, -1, `unterminated struct ${name}`)
  return source.slice(start, end + 2)
}

test('high-risk accounting actions derive their audit actor from the session', () => {
  const commandGroups = [
    {
      file: 'src-tauri/src/commands/periods.rs',
      commands: ['close_period', 'reopen_period', 'finalize_initial_balances'],
    },
    {
      file: 'src-tauri/src/commands/vouchers.rs',
      commands: [
        'approve_voucher',
        'reverse_approve_voucher',
        'reverse_voucher',
        'batch_approve_vouchers',
        'batch_reverse_approve_vouchers',
        'delete_voucher',
        'restore_voucher',
        'permanent_delete_voucher',
        'reorganize_voucher_numbers',
        'delete_company_vouchers',
        'recalculate_balances',
      ],
    },
    {
      file: 'src-tauri/src/commands/automation.rs',
      commands: [
        'upsert_tax_declaration_task',
        'confirm_tax_declaration_task',
        'update_automation_job_status',
        'upsert_adapter_authorization',
        'upsert_adapter_provider_config',
        'verify_adapter_authorization',
        'write_operation_audit_log',
      ],
    },
    {
      file: 'src-tauri/src/commands/agency.rs',
      commands: [
        'create_agency_batch_tasks',
        'run_agency_batch_task_precheck',
        'review_agency_batch_task',
        'run_agency_batch_task',
      ],
    },
    {
      file: 'src-tauri/src/commands/backups.rs',
      commands: ['schedule_local_backup_restore'],
    },
    {
      file: 'src-tauri/src/commands/local_files.rs',
      commands: [
        'create_local_file_record',
        'update_local_file_record',
        'delete_local_file_record',
        'copy_local_voucher_attachments',
      ],
    },
    {
      file: 'src-tauri/src/commands/export_jobs.rs',
      commands: ['create_export_job'],
    },
    {
      file: 'src-tauri/src/commands/inventory_movements.rs',
      commands: [
        'confirm_inventory_movement',
        'create_cost_carryover_from_inventory_movement',
      ],
    },
    {
      file: 'src-tauri/src/commands/cost_carryover_records.rs',
      commands: ['update_cost_carryover_record'],
    },
  ]

  for (const group of commandGroups) {
    const source = read(group.file)
    for (const command of group.commands) {
      const body = commandBody(source, command)
      assert.match(body, /auth_token: String/, `${command} must receive the authenticated session`)
      assert.match(body, /authenticated_actor/, `${command} must derive the audit actor server-side`)
    }
  }
})

test('high-risk commands do not persist client-supplied actor fields', () => {
  const db = read('src-tauri/src/db.rs')
  const periods = read('src-tauri/src/commands/periods.rs')
  const automation = read('src-tauri/src/commands/automation.rs')
  const agency = read('src-tauri/src/commands/agency.rs')
  const localFiles = read('src-tauri/src/commands/local_files.rs')

  for (const inputName of [
    'ClosePeriodInput',
    'ConfirmTaxDeclarationTaskInput',
    'CreateOperationAuditLogInput',
    'CreateAgencyBatchTasksInput',
    'ReviewAgencyBatchTaskInput',
    'RunAgencyBatchTaskInput',
    'CreateLocalFileRecordInput',
    'UpdateLocalFileRecordInput',
    'DeleteLocalFileRecordInput',
    'CopyLocalVoucherAttachmentsInput',
    'CreateExportJobInput',
  ]) {
    const input = structBody(db, inputName)
    assert.doesNotMatch(input, /pub\s+(?:closed_by|confirmed_by|operator):/)
  }
  const runInput = structBody(agency, 'RunAgencyBatchTaskPrecheckInput')
  assert.doesNotMatch(runInput, /pub\s+operator:/)

  assert.doesNotMatch(commandBody(periods, 'close_period'), /input\.closed_by/)
  assert.doesNotMatch(commandBody(periods, 'reopen_period'), /operator\.as_deref/)
  assert.doesNotMatch(commandBody(periods, 'finalize_initial_balances'), /['"]admin['"]/)
  assert.doesNotMatch(commandBody(automation, 'confirm_tax_declaration_task'), /input\.confirmed_by/)
  assert.doesNotMatch(commandBody(automation, 'update_automation_job_status'), /input\.reviewer/)
  assert.doesNotMatch(commandBody(automation, 'write_operation_audit_log'), /input\.operator/)
  for (const command of [
    'create_agency_batch_tasks',
    'run_agency_batch_task_precheck',
    'review_agency_batch_task',
    'run_agency_batch_task',
  ]) {
    assert.doesNotMatch(commandBody(agency, command), /input\s*\.operator/)
  }
  for (const command of [
    'create_local_file_record',
    'update_local_file_record',
    'delete_local_file_record',
    'copy_local_voucher_attachments',
  ]) {
    assert.doesNotMatch(commandBody(localFiles, command), /input\s*\.operator/)
  }
})

test('frontend high-risk actions do not accept or send client-supplied actors', () => {
  const periods = read('src/stores/periodStore.ts')
  const vouchers = read('src/stores/voucherStore.ts')
  const api = read('src/lib/api.ts')
  const voucherWorkspace = read('src/pages/operations/VoucherWorkspace.tsx')
  const voucherDetail = read('src/pages/operations/VoucherDetailWorkspace.tsx')
  const taxWorkspace = read('src/pages/tax/TaxWorkspace.tsx')
  const taxReport = read('src/pages/tax/TaxReportWorkspace.tsx')
  const initialization = read('src/pages/operations/InitializationWorkspace.tsx')
  const agency = read('src/pages/agency/AgencyModulePage.tsx')
  const fileCenter = read('src/pages/operations/FileCenterWorkspace.tsx')
  const voucherEntry = read('src/pages/operations/VoucherEntryWorkspace.tsx')
  const exports = read('src/lib/exportJobs.ts')

  assert.doesNotMatch(periods, /closePeriod: \(periodId: string, closedBy/)
  assert.doesNotMatch(periods, /closed_by:\s*closedBy|operator:\s*['"]admin['"]/)
  assert.doesNotMatch(vouchers, /approvedBy|reversedBy/)
  assert.doesNotMatch(voucherWorkspace, /approveVoucher\([^\n]+['"]admin['"]|reverseVoucher\([^\n]+['"]admin['"]|batchApprove\([^\n]+['"]admin['"]/)
  assert.doesNotMatch(voucherDetail, /approveVoucher\([^\n]+['"]admin['"]|reverseVoucher\([^\n]+['"]admin['"]/)

  assert.doesNotMatch(api, /approve:\s*async\s*\([^)]*approvedBy|batchApprove:\s*async\s*\([^)]*approvedBy/)
  assert.doesNotMatch(api, /confirmedBy\?:\s*string|operator\?:\s*string/)
  assert.doesNotMatch(api, /updateAutomationJobStatus:[\s\S]*?reviewer\?:\s*string/)
  assert.doesNotMatch(api, /approvedBy,\s*companyId|confirmed_by:\s*input\.confirmedBy|operator:\s*input\.operator/)
  assert.doesNotMatch(taxWorkspace, /confirmedBy:\s*['"]admin['"]|operator:\s*['"]admin['"]/)
  assert.doesNotMatch(taxReport, /confirmedBy:\s*['"]admin['"]/)
  assert.doesNotMatch(initialization, /confirmedBy:\s*['"]admin['"]/)
  assert.doesNotMatch(agency, /(?:createBatchTasks|runBatchTaskPrecheck|reviewBatchTask|runBatchTask)\([^\n]+operator:\s*['"]admin['"]/)
  assert.doesNotMatch(`${agency}\n${fileCenter}\n${voucherEntry}\n${exports}`, /operator:\s*['"]admin['"]|operator:\s*input\.operator\s*\|\|\s*['"]admin['"]/)
})

test('high-risk maintenance commands persist immutable operation audit records', () => {
  const vouchers = read('src-tauri/src/commands/vouchers.rs')
  const periods = read('src-tauri/src/commands/periods.rs')
  const automation = read('src-tauri/src/commands/automation.rs')
  const backups = read('src-tauri/src/commands/backups.rs')
  const agency = read('src-tauri/src/commands/agency.rs')
  const localFiles = read('src-tauri/src/commands/local_files.rs')
  const exportJobs = read('src-tauri/src/commands/export_jobs.rs')
  const inventoryMovements = read('src-tauri/src/commands/inventory_movements.rs')
  const costCarryovers = read('src-tauri/src/commands/cost_carryover_records.rs')

  for (const command of [
    'delete_voucher',
    'restore_voucher',
    'permanent_delete_voucher',
    'reorganize_voucher_numbers',
    'delete_company_vouchers',
    'recalculate_balances',
  ]) {
    assert.match(
      commandBody(vouchers, command),
      /log_operation_audit/,
      `${command} must write an immutable operation audit record`,
    )
  }
  assert.match(vouchers, /async fn log_operation_audit[\s\S]*?operation_audit_logs/)
  assert.match(commandBody(periods, 'finalize_initial_balances'), /operation_audit_logs/)
  assert.match(commandBody(automation, 'update_automation_job_status'), /operation_audit_logs/)
  assert.match(commandBody(automation, 'upsert_adapter_authorization'), /operation_audit_logs/)
  assert.match(commandBody(automation, 'upsert_adapter_provider_config'), /operation_audit_logs/)
  assert.match(commandBody(automation, 'verify_adapter_authorization'), /operation_audit_logs/)
  assert.match(commandBody(backups, 'schedule_local_backup_restore'), /operation_audit_logs/)
  assert.match(commandBody(agency, 'run_agency_batch_task'), /run_agency_batch_task_record/)
  assert.match(agency, /'批量操作', '执行批量任务'/)
  assert.match(localFiles, /operation_audit_logs/)
  assert.match(localFiles, /write_file_audit/)
  assert.match(exportJobs, /operation_audit_logs/)
  assert.match(commandBody(inventoryMovements, 'confirm_inventory_movement'), /confirm_inventory_movement_for_company/)
  assert.match(commandBody(inventoryMovements, 'create_cost_carryover_from_inventory_movement'), /create_cost_carryover_from_inventory_movement_for_company/)
  assert.match(inventoryMovements, /'存货核算', '生成成本结转'/)
  assert.match(commandBody(costCarryovers, 'update_cost_carryover_record'), /operation_audit_logs/)
})

test('adapter authorization metadata cannot forge a verified external authorization', () => {
  const automation = read('src-tauri/src/commands/automation.rs')
  const body = commandBody(automation, 'upsert_adapter_authorization')
  assert.match(body, /auth_status.*authorized|authorized.*auth_status/s)
  assert.match(body, /return Err/)
  assert.match(body, /begin\(\)/)
  assert.match(body, /transaction\s*\.commit\(\)/)
})

test('live data verifier follows server-derived audit actors', () => {
  const verifier = read('scripts/verify-live-module-data.mjs')
  assert.doesNotMatch(verifier, /approveVoucher\(voucher\.id, ['"]admin['"]/)
  assert.doesNotMatch(verifier, /batchApprove\(selectedIds, ['"]admin['"]/)
  assert.doesNotMatch(verifier, /closePeriod\(periodId, ['"]admin['"]/)
  assert.doesNotMatch(verifier, /completedBy:\s*['"]admin['"]/)
})

test('operational writes derive creator, modifier, completer, and annotator from the session', () => {
  const commandGroups = [
    {
      file: 'src-tauri/src/commands/company_todos.rs',
      commands: ['complete_company_todo'],
    },
    {
      file: 'src-tauri/src/commands/companies.rs',
      commands: ['upsert_company_memo'],
    },
    {
      file: 'src-tauri/src/commands/periods.rs',
      commands: ['save_initial_balance'],
    },
    {
      file: 'src-tauri/src/commands/vouchers.rs',
      commands: [
        'create_voucher',
        'update_voucher',
        'copy_voucher',
        'add_voucher_annotation',
        'import_vouchers',
      ],
    },
    {
      file: 'src-tauri/src/commands/automation.rs',
      commands: ['create_automation_job'],
    },
    {
      file: 'src-tauri/src/commands/settlement.rs',
      commands: ['create_settlement_voucher_draft'],
    },
  ]

  for (const group of commandGroups) {
    const source = read(group.file)
    for (const command of group.commands) {
      const body = commandBody(source, command)
      assert.match(body, /auth_token: String/, `${command} must receive the authenticated session`)
      assert.match(body, /authenticated_actor/, `${command} must derive the audit actor server-side`)
      assert.doesNotMatch(
        body,
        /input\.(?:created_by|modified_by|completed_by|updated_by)|operator_id:\s*Option|created_by:\s*Option/,
        `${command} must not persist a caller-supplied actor`,
      )
    }
  }
})

test('frontend operational writes do not expose audit actor inputs', () => {
  const api = read('src/lib/api.ts')
  const periods = read('src/stores/periodStore.ts')
  const vouchers = read('src/stores/voucherStore.ts')
  const settlementRules = read('src/stores/settlementRuleStore.ts')
  const welcome = read('src/pages/Welcome.tsx')
  const aiOperations = read('src/pages/operations/AiOperationsWorkspace.tsx')
  const initialization = read('src/pages/operations/InitializationWorkspace.tsx')
  const voucherWorkspace = read('src/pages/operations/VoucherWorkspace.tsx')
  const voucherDetail = read('src/pages/operations/VoucherDetailWorkspace.tsx')
  const voucherEntry = read('src/pages/operations/VoucherEntryWorkspace.tsx')
  const systemHub = read('src/pages/operations/SystemHubWorkspace.tsx')
  const voucherImport = read('src/components/operations/VoucherImportDialog.tsx')

  assert.doesNotMatch(api, /updatedBy\?:\s*string|completedBy\?:\s*string|createdBy:\s*input\.createdBy/)
  assert.doesNotMatch(api, /updated_by:\s*input\.updatedBy|completed_by:\s*input\.completedBy|created_by:\s*input\.createdBy/)
  assert.doesNotMatch(periods, /created_by\?:\s*string/)
  assert.doesNotMatch(vouchers, /created_by\?:\s*string|modified_by\?:\s*string|operatorId\?:\s*string/)
  assert.doesNotMatch(settlementRules, /createdBy/)
  for (const source of [welcome, aiOperations, initialization, voucherWorkspace, voucherDetail, voucherEntry, systemHub, voucherImport]) {
    assert.doesNotMatch(source, /(?:createdBy|updatedBy|completedBy|created_by|modified_by|operatorId):\s*['"](?:admin|机构管理员)['"]/)
  }
})
