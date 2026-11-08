pub mod commands;
pub mod db;

#[cfg(test)]
mod release_acceptance;

#[cfg(test)]
mod release_performance;

#[cfg(test)]
pub(crate) mod test_support;

use db::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting Accounting Software...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            log::info!("Setting up application...");

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            log::info!("App data directory: {:?}", app_data_dir);

            let (applied_restore, restore_failure) = tauri::async_runtime::block_on(async {
                commands::backups::apply_pending_restore_safely(&app_data_dir).await
            });

            let database =
                tauri::async_runtime::block_on(async { Database::new(app_data_dir).await })
                    .expect("Failed to initialize database");

            if let Some(applied) = applied_restore.as_ref() {
                tauri::async_runtime::block_on(async {
                    commands::backups::record_applied_restore(&database, applied).await
                })
                .expect("Failed to record completed database restore");
            }
            if let Some(error) = restore_failure.as_deref() {
                log::error!("Pending database restore failed: {}", error);
                tauri::async_runtime::block_on(async {
                    commands::backups::record_restore_failure(&database, error).await
                })
                .expect("Failed to record database restore failure");
            }

            log::info!("Database initialized successfully");

            app.manage(database);

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler({
            let command_handler: Arc<tauri::ipc::InvokeHandler<tauri::Wry>> =
                Arc::new(tauri::generate_handler![
                    // Auth commands
                    commands::auth::login,
                    commands::auth::logout,
                    commands::auth::check,
                    commands::auth::get_auth_setup_status,
                    commands::auth::initialize_admin,
                    // Agency operation commands
                    commands::agency::get_agency_service_contracts,
                    commands::agency::create_agency_service_contract,
                    commands::agency::update_agency_service_contract,
                    commands::agency::get_agency_fee_collections,
                    commands::agency::create_agency_fee_collection,
                    commands::agency::update_agency_fee_collection,
                    commands::agency::get_agency_collaboration_items,
                    commands::agency::create_agency_collaboration_item,
                    commands::agency::update_agency_collaboration_item,
                    commands::agency::get_agency_delivery_tickets,
                    commands::agency::get_agency_batch_tasks,
                    commands::agency::create_agency_batch_tasks,
                    commands::agency::run_agency_batch_task_precheck,
                    commands::agency::review_agency_batch_task,
                    commands::agency::run_agency_batch_task,
                    commands::agency::get_agency_batch_task_items,
                    commands::agency::get_agency_health_checks,
                    commands::agency::get_agency_automation_jobs,
                    commands::agency::get_agency_adapter_authorizations,
                    commands::agency::get_agency_operation_overview,
                    commands::agency::get_agency_company_progress,
                    // Automation, AI bookkeeping, tax adapter boundary, and audit commands
                    commands::automation::get_automation_jobs,
                    commands::automation::create_automation_job,
                    commands::automation::update_automation_job_status,
                    commands::automation::get_ai_provider_configs,
                    commands::automation::upsert_ai_provider_config,
                    commands::automation::run_ai_recognition_job,
                    commands::automation::get_tax_declaration_tasks,
                    commands::automation::get_tax_deadline_rules,
                    commands::automation::upsert_tax_deadline_rule,
                    commands::automation::get_tax_calendar_days,
                    commands::automation::upsert_tax_calendar_day,
                    commands::automation::get_tax_declaration_schedules,
                    commands::automation::upsert_tax_declaration_task,
                    commands::automation::confirm_tax_declaration_task,
                    commands::automation::submit_tax_declaration_task,
                    commands::automation::sync_tax_declaration_receipt,
                    commands::automation::sync_external_invoice_pool,
                    commands::automation::get_external_invoice_sync_items,
                    commands::automation::import_external_invoice_sync_item,
                    commands::automation::reject_external_invoice_sync_item,
                    commands::automation::sync_external_bank_statement,
                    commands::automation::get_external_bank_sync_items,
                    commands::automation::import_external_bank_sync_item,
                    commands::automation::reject_external_bank_sync_item,
                    commands::automation::get_adapter_authorizations,
                    commands::automation::upsert_adapter_authorization,
                    commands::automation::get_adapter_provider_config,
                    commands::automation::upsert_adapter_provider_config,
                    commands::automation::verify_adapter_authorization,
                    commands::automation::write_operation_audit_log,
                    commands::automation::get_operation_audit_logs,
                    // Local backup snapshots and restart-safe restore scheduling.
                    commands::backups::create_local_backup,
                    commands::backups::list_local_backups,
                    commands::backups::verify_local_backup,
                    commands::backups::schedule_local_backup_restore,
                    // Employee archive commands
                    commands::employees::get_employees,
                    commands::employees::create_employee,
                    commands::employees::update_employee,
                    commands::payroll::get_payroll_records,
                    commands::payroll::create_payroll_record,
                    commands::payroll::update_payroll_record,
                    commands::social_security::get_social_security_records,
                    commands::social_security::create_social_security_record,
                    commands::social_security::update_social_security_record,
                    commands::special_deductions::get_special_deduction_records,
                    commands::special_deductions::create_special_deduction_record,
                    commands::special_deductions::update_special_deduction_record,
                    commands::bank_transactions::get_bank_transactions,
                    commands::bank_transactions::create_bank_transaction,
                    commands::bank_transactions::update_bank_transaction,
                    commands::document_records::get_document_records,
                    commands::document_records::create_document_record,
                    commands::document_records::update_document_record,
                    commands::local_files::get_local_file_records,
                    commands::local_files::create_local_file_record,
                    commands::local_files::update_local_file_record,
                    commands::local_files::delete_local_file_record,
                    commands::local_files::copy_local_voucher_attachments,
                    commands::export_jobs::get_export_jobs,
                    commands::export_jobs::create_export_job,
                    commands::business_orders::get_business_orders,
                    commands::business_orders::create_business_order,
                    commands::business_orders::update_business_order,
                    commands::settlement_records::get_settlement_records,
                    commands::settlement_records::create_settlement_record,
                    commands::settlement_records::update_settlement_record,
                    commands::bank_reconciliation_records::get_bank_reconciliation_records,
                    commands::bank_reconciliation_records::create_bank_reconciliation_record,
                    commands::bank_reconciliation_records::update_bank_reconciliation_record,
                    commands::cost_carryover_records::get_cost_carryover_records,
                    commands::cost_carryover_records::update_cost_carryover_record,
                    commands::account_transfers::get_account_transfers,
                    commands::account_transfers::create_account_transfer,
                    commands::account_transfers::update_account_transfer,
                    commands::fixed_assets::get_fixed_assets,
                    commands::fixed_assets::get_fixed_asset_depreciation_batch,
                    commands::fixed_assets::get_fixed_asset_depreciation_lines,
                    commands::fixed_assets::prepare_fixed_asset_depreciation_batch,
                    commands::fixed_assets::create_fixed_asset,
                    commands::fixed_assets::update_fixed_asset,
                    commands::inventory_movements::get_inventory_movements,
                    commands::inventory_movements::get_inventory_stock_balances,
                    commands::inventory_movements::create_inventory_movement,
                    commands::inventory_movements::update_inventory_movement,
                    commands::inventory_movements::confirm_inventory_movement,
                    commands::inventory_movements::create_cost_carryover_from_inventory_movement,
                    commands::inventory_items::get_inventory_items,
                    commands::inventory_items::create_inventory_item,
                    commands::inventory_items::update_inventory_item,
                    commands::inventory_master_data::get_inventory_categories,
                    commands::inventory_master_data::create_inventory_category,
                    commands::inventory_master_data::update_inventory_category,
                    commands::inventory_master_data::get_inventory_warehouses,
                    commands::inventory_master_data::create_inventory_warehouse,
                    commands::inventory_master_data::update_inventory_warehouse,
                    commands::inventory_master_data::get_inventory_boms,
                    commands::inventory_master_data::create_inventory_bom,
                    commands::inventory_master_data::update_inventory_bom,
                    commands::inventory_opening::get_inventory_opening_balances,
                    commands::inventory_opening::get_inventory_opening_reconciliation,
                    commands::inventory_opening::save_inventory_opening_balance,
                    commands::inventory_opening::delete_inventory_opening_balance,
                    commands::inventory_opening::finalize_inventory_opening_balances,
                    commands::inventory_stocktakes::get_inventory_stocktakes,
                    commands::inventory_stocktakes::get_inventory_stocktake_lines,
                    commands::inventory_stocktakes::create_inventory_stocktake,
                    commands::inventory_stocktakes::add_inventory_stocktake_line,
                    commands::inventory_stocktakes::save_inventory_stocktake_count,
                    commands::inventory_stocktakes::confirm_inventory_stocktake,
                    commands::inventory_stocktakes::void_inventory_stocktake,
                    commands::units::get_measurement_units,
                    commands::units::create_measurement_unit,
                    commands::units::update_measurement_unit,
                    // Company commands
                    commands::companies::get_companies,
                    commands::companies::get_company,
                    commands::companies::create_company,
                    commands::companies::update_company,
                    commands::companies::delete_company,
                    commands::companies::deactivate_company,
                    commands::companies::activate_company,
                    commands::companies::restore_company,
                    commands::companies::permanent_delete_company,
                    commands::companies::get_deleted_companies,
                    commands::companies::cleanup_expired_companies,
                    commands::companies::get_company_memos,
                    commands::companies::upsert_company_memo,
                    commands::company_todos::get_company_todos,
                    commands::company_todos::create_company_todo,
                    commands::company_todos::complete_company_todo,
                    // Account code commands
                    commands::accounts::get_account_codes,
                    commands::accounts::get_account_codes_by_type,
                    commands::accounts::get_detail_account_codes,
                    commands::accounts::create_account_code,
                    commands::accounts::update_account_code,
                    commands::accounts::toggle_account_code,
                    commands::accounts::delete_account_code,
                    commands::accounts::search_account_codes,
                    // Subject (backward compat) commands
                    commands::subjects::get_subjects,
                    commands::subjects::get_subject,
                    commands::subjects::get_subjects_by_type,
                    commands::subjects::create_subject,
                    commands::subjects::update_subject,
                    commands::subjects::delete_subject,
                    commands::subjects::search_subjects,
                    // Period commands
                    commands::periods::ensure_periods,
                    commands::periods::get_accounting_periods,
                    commands::periods::get_open_periods,
                    commands::periods::create_accounting_period,
                    commands::periods::close_period,
                    commands::periods::reopen_period,
                    // Voucher word commands
                    commands::periods::get_voucher_words,
                    // Account balance commands
                    commands::periods::get_account_balances,
                    commands::periods::get_trial_balance,
                    commands::periods::get_accounting_reconciliation,
                    // Initial balance commands
                    commands::periods::save_initial_balance,
                    commands::periods::validate_initial_balances,
                    commands::periods::finalize_initial_balances,
                    // Ledger commands
                    commands::periods::get_general_ledger,
                    commands::periods::get_subsidiary_ledger,
                    // Report commands
                    commands::periods::get_balance_sheet,
                    commands::periods::get_income_statement,
                    commands::periods::get_cash_flow_statement,
                    commands::periods::get_equity_change_statement,
                    // Report template management
                    commands::periods::get_report_templates,
                    commands::periods::get_report_items,
                    commands::periods::clone_report_template_for_company,
                    commands::periods::create_report_item,
                    commands::periods::update_report_item,
                    commands::periods::delete_report_item,
                    commands::periods::publish_report_snapshot,
                    commands::periods::get_report_snapshots,
                    commands::periods::get_report_snapshot,
                    // Voucher commands
                    commands::vouchers::get_vouchers,
                    commands::vouchers::query_vouchers,
                    commands::vouchers::get_voucher,
                    commands::vouchers::create_voucher,
                    commands::vouchers::update_voucher,
                    commands::vouchers::delete_voucher,
                    commands::vouchers::get_deleted_vouchers,
                    commands::vouchers::restore_voucher,
                    commands::vouchers::permanent_delete_voucher,
                    commands::vouchers::recalculate_balances,
                    commands::vouchers::approve_voucher,
                    commands::vouchers::reverse_approve_voucher,
                    commands::vouchers::reverse_voucher,
                    commands::vouchers::copy_voucher,
                    commands::vouchers::get_voucher_entries,
                    commands::vouchers::reorganize_voucher_numbers,
                    commands::vouchers::batch_approve_vouchers,
                    commands::vouchers::batch_reverse_approve_vouchers,
                    commands::vouchers::add_voucher_annotation,
                    commands::vouchers::get_voucher_logs,
                    commands::vouchers::suggest_summary,
                    commands::vouchers::get_next_voucher_number,
                    commands::vouchers::download_voucher_template,
                    commands::vouchers::import_vouchers,
                    commands::vouchers::delete_company_vouchers,
                    commands::vouchers::export_vouchers_excel,
                    commands::vouchers::parse_voucher_excel,
                    // Voucher template commands
                    commands::templates::get_voucher_template_types,
                    commands::templates::create_voucher_template_type,
                    commands::templates::get_voucher_templates,
                    commands::templates::create_voucher_template,
                    commands::templates::update_voucher_template,
                    commands::templates::delete_voucher_template,
                    // Common digest commands
                    commands::templates::get_common_digests,
                    commands::templates::create_common_digest,
                    commands::templates::update_common_digest,
                    commands::templates::delete_common_digest,
                    // Auxiliary accounting commands
                    commands::auxiliary::get_auxiliary_categories,
                    commands::auxiliary::create_auxiliary_category,
                    commands::auxiliary::update_auxiliary_category,
                    commands::auxiliary::delete_auxiliary_category,
                    commands::auxiliary::get_auxiliary_items,
                    commands::auxiliary::get_all_auxiliary_items,
                    commands::auxiliary::create_auxiliary_item,
                    commands::auxiliary::update_auxiliary_item,
                    commands::auxiliary::delete_auxiliary_item,
                    commands::auxiliary::toggle_auxiliary_item,
                    commands::auxiliary::get_account_auxiliary_links,
                    commands::auxiliary::link_account_auxiliary,
                    commands::auxiliary::unlink_account_auxiliary,
                    commands::auxiliary::get_voucher_entry_auxiliaries,
                    commands::auxiliary::get_auxiliary_ledger,
                    commands::auxiliary::get_auxiliary_balance,
                    commands::auxiliary::get_account_auxiliary_setup,
                    // Invoice commands
                    commands::invoices::get_invoices,
                    commands::invoices::get_invoice,
                    commands::invoices::create_invoice,
                    commands::invoices::update_invoice_with_lines,
                    commands::invoices::review_output_invoice,
                    commands::invoices::delete_invoice,
                    commands::invoices::match_invoice_to_voucher,
                    commands::invoices::get_invoices_by_voucher,
                    commands::invoices::get_invoice_lines,
                    commands::invoices::replace_invoice_lines,
                    commands::invoices::get_invoice_tax_events,
                    commands::invoices::create_invoice_tax_event,
                    // Settlement commands
                    commands::settlement::get_settlement_rules,
                    commands::settlement::create_settlement_rule,
                    commands::settlement::update_settlement_rule,
                    commands::settlement::delete_settlement_rule,
                    commands::settlement::preview_settlement_rule,
                    commands::settlement::create_settlement_voucher_draft,
                    // Invoice, bank bill, and cash-flow matching rule commands
                    commands::matching_rules::get_matching_rules,
                    commands::matching_rules::create_matching_rule,
                    commands::matching_rules::update_matching_rule,
                    commands::matching_rules::delete_matching_rule,
                    // Fixed asset category commands
                    commands::asset_categories::get_asset_categories,
                    commands::asset_categories::create_asset_category,
                    commands::asset_categories::update_asset_category,
                    commands::asset_categories::delete_asset_category,
                    commands::asset_categories::toggle_asset_category,
                    // Cross-module business tag commands
                    commands::business_tags::get_business_tags,
                    commands::business_tags::create_business_tag,
                    commands::business_tags::update_business_tag,
                    commands::business_tags::delete_business_tag,
                    commands::business_tags::get_invoice_tag_ids,
                    commands::business_tags::replace_invoice_tags,
                    commands::business_tags::get_voucher_tag_ids,
                    commands::business_tags::replace_voucher_tags,
                    commands::business_tags::get_bank_transaction_tag_ids,
                    commands::business_tags::replace_bank_transaction_tags,
                    // Company account archive commands
                    commands::company_accounts::get_company_accounts,
                    commands::company_accounts::create_company_account,
                    commands::company_accounts::update_company_account,
                    commands::company_accounts::delete_company_account,
                    // Currency commands
                    commands::currencies::get_currencies,
                    commands::currencies::create_currency,
                    commands::currencies::update_currency,
                    commands::currencies::delete_currency,
                    commands::currencies::calculate_exchange_adjustment,
                    // Role & permission commands
                    commands::roles::get_roles,
                    commands::roles::create_role,
                    commands::roles::update_role,
                    commands::roles::delete_role,
                    commands::roles::get_users_with_roles,
                    commands::roles::create_user,
                    commands::roles::reset_user_password,
                    commands::roles::update_user_role,
                    commands::roles::link_user_company,
                    commands::roles::unlink_user_company,
                    commands::roles::check_permission,
                ]);
            move |invoke: tauri::ipc::Invoke| {
                let command_handler = Arc::clone(&command_handler);
                tauri::async_runtime::spawn(async move {
                    match commands::auth::authorize_invoke(&invoke).await {
                        Ok(()) => {
                            command_handler(invoke);
                        }
                        Err(error) => invoke.resolver.reject(error),
                    }
                });
                true
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
