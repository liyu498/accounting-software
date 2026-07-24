pub mod commands;
pub mod db;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    log::info!("Starting Accounting Software...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            log::info!("Setting up application...");

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            log::info!("App data directory: {:?}", app_data_dir);

            let database = tauri::async_runtime::block_on(async {
                Database::new(app_data_dir).await
            }).expect("Failed to initialize database");

            log::info!("Database initialized successfully");

            app.manage(database);

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            commands::auth::login,
            commands::auth::logout,
            commands::auth::check,
            commands::auth::register,
            commands::auth::get_current_user,
            // Agency operation commands
            commands::agency::get_agency_service_contracts,
            commands::agency::create_agency_service_contract,
            commands::agency::get_agency_fee_collections,
            commands::agency::create_agency_fee_collection,
            commands::agency::get_agency_collaboration_items,
            commands::agency::create_agency_collaboration_item,
            commands::agency::get_agency_delivery_tickets,
            commands::agency::get_agency_batch_tasks,
            commands::agency::create_agency_batch_tasks,
            commands::agency::get_agency_health_checks,
            commands::agency::get_agency_automation_jobs,
            commands::agency::get_agency_adapter_authorizations,
            commands::agency::get_agency_operation_overview,
            // Automation, AI bookkeeping, tax adapter boundary, and audit commands
            commands::automation::get_automation_jobs,
            commands::automation::create_automation_job,
            commands::automation::update_automation_job_status,
            commands::automation::get_tax_declaration_tasks,
            commands::automation::upsert_tax_declaration_task,
            commands::automation::confirm_tax_declaration_task,
            commands::automation::get_adapter_authorizations,
            commands::automation::upsert_adapter_authorization,
            commands::automation::write_operation_audit_log,
            commands::automation::get_operation_audit_logs,
            // Local backup snapshots. Restore remains an explicit manual workflow.
            commands::backups::create_local_backup,
            commands::backups::list_local_backups,
            commands::backups::verify_local_backup,
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
            commands::account_transfers::get_account_transfers,
            commands::account_transfers::create_account_transfer,
            commands::account_transfers::update_account_transfer,
            commands::fixed_assets::get_fixed_assets,
            commands::fixed_assets::create_fixed_asset,
            commands::fixed_assets::update_fixed_asset,
            commands::inventory_movements::get_inventory_movements,
            commands::inventory_movements::create_inventory_movement,
            commands::inventory_movements::update_inventory_movement,
            commands::inventory_items::get_inventory_items,
            commands::inventory_items::create_inventory_item,
            commands::inventory_items::update_inventory_item,
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
            // Account code commands
            commands::accounts::get_account_codes,
            commands::accounts::get_account_code,
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
            commands::periods::get_period,
            commands::periods::get_open_periods,
            commands::periods::create_accounting_period,
            commands::periods::close_period,
            commands::periods::reopen_period,
            // Voucher word commands
            commands::periods::get_voucher_words,
            // Account balance commands
            commands::periods::get_account_balances,
            commands::periods::get_trial_balance,
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
            // Report template management
            commands::periods::get_report_templates,
            commands::periods::get_report_items,
            commands::periods::create_report_item,
            commands::periods::update_report_item,
            commands::periods::delete_report_item,
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
            commands::vouchers::get_voucher_logs,
            commands::vouchers::suggest_summary,
            commands::vouchers::get_next_voucher_number,
            commands::vouchers::insert_voucher,
            commands::vouchers::download_voucher_template,
            commands::vouchers::import_vouchers,
            commands::vouchers::delete_company_vouchers,
            commands::vouchers::export_vouchers_excel,
            commands::vouchers::parse_voucher_excel,
            commands::vouchers::read_text_file,
            // Voucher template commands
            commands::templates::get_voucher_template_types,
            commands::templates::create_voucher_template_type,
            commands::templates::delete_voucher_template_type,
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
            commands::auxiliary::get_accounts_with_auxiliary,
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
            commands::invoices::update_invoice,
            commands::invoices::delete_invoice,
            commands::invoices::match_invoice_to_voucher,
            commands::invoices::get_invoices_by_voucher,
            // Settlement commands
            commands::settlement::get_settlement_rules,
            commands::settlement::create_settlement_rule,
            commands::settlement::update_settlement_rule,
            commands::settlement::delete_settlement_rule,
            commands::settlement::generate_settlement_voucher,
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
            commands::roles::update_user_role,
            commands::roles::link_user_company,
            commands::roles::unlink_user_company,
            commands::roles::check_permission,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
