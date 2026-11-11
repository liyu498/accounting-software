use crate::commands::{
    auth::{self, InitializeAdminInput, LoginRequest},
    automation, bank_transactions, companies, invoices, periods, settlement, vouchers,
};
use crate::db::{
    BankTransaction, ClosePeriodInput, ConfirmTaxDeclarationTaskInput, CreateBankTransactionInput,
    CreateCompanyInput, CreateVoucherEntryInput, CreateVoucherInput, Database,
    ReviewExternalBankSyncItemInput, ReviewExternalInvoiceSyncItemInput,
    UpsertTaxDeclarationTaskInput,
};
use tauri::Manager;

#[derive(Clone, Copy)]
struct AcceptanceScenario {
    code: &'static str,
    accounting_system: &'static str,
    bank_code: &'static str,
    liability_code: &'static str,
    settlement_target_code: &'static str,
}

const ACCEPTANCE_SCENARIOS: [AcceptanceScenario; 4] = [
    AcceptanceScenario {
        code: "ENT",
        accounting_system: "enterprise",
        bank_code: "1002",
        liability_code: "2203",
        settlement_target_code: "4103",
    },
    AcceptanceScenario {
        code: "SME",
        accounting_system: "small_enterprise",
        bank_code: "1002",
        liability_code: "2203",
        settlement_target_code: "3103",
    },
    AcceptanceScenario {
        code: "NPO",
        accounting_system: "non_profit",
        bank_code: "1002",
        liability_code: "2203",
        settlement_target_code: "3101",
    },
    AcceptanceScenario {
        code: "COOP",
        accounting_system: "cooperative",
        bank_code: "102",
        liability_code: "211",
        settlement_target_code: "331",
    },
];

fn company_input(scenario: AcceptanceScenario) -> CreateCompanyInput {
    CreateCompanyInput {
        code: format!("ACCEPT-{}", scenario.code),
        name: format!("脱敏验收账套-{}", scenario.code),
        tax_id: Some(format!("91310000ACCEPT{}", scenario.code)),
        tax_type: Some("general".to_string()),
        industry: Some("软件和信息技术服务业".to_string()),
        accounting_system: Some(scenario.accounting_system.to_string()),
        province: Some("上海市".to_string()),
        city: Some("上海市".to_string()),
        district: Some("浦东新区".to_string()),
        enterprise_type: Some("验收测试主体".to_string()),
        service_start: Some("2026-01-01".to_string()),
        service_end: Some("2026-12-31".to_string()),
        enable_year: Some(2026),
        enable_month: Some(1),
    }
}

fn voucher_entry(code: &str, name: String, direction: &str) -> CreateVoucherEntryInput {
    CreateVoucherEntryInput {
        account_code: code.to_string(),
        account_name: name,
        direction: direction.to_string(),
        amount: 1_000.0,
        summary: Some("脱敏验收业务".to_string()),
        auxiliary_type: None,
        auxiliary_id: None,
        doc_number: None,
        quantity: None,
        unit_price: None,
        unit: None,
        currency_id: None,
        exchange_rate: None,
        auxiliary_items: None,
    }
}

async fn account_name(database: &Database, company_id: &str, code: &str) -> String {
    sqlx::query_scalar("SELECT name FROM account_codes WHERE company_id = ? AND code = ?")
        .bind(company_id)
        .bind(code)
        .fetch_one(database.pool())
        .await
        .unwrap_or_else(|error| panic!("验收科目 {code} 不存在: {error}"))
}

async fn stage_reviewable_collection_items(
    database: &Database,
    scenario: AcceptanceScenario,
    company_id: &str,
    company_name: &str,
    company_tax_id: Option<&str>,
) -> (String, String) {
    let authorization_id = uuid::Uuid::new_v4().to_string();
    let provider_config_id = uuid::Uuid::new_v4().to_string();
    let invoice_batch_id = uuid::Uuid::new_v4().to_string();
    let invoice_item_id = uuid::Uuid::new_v4().to_string();
    let bank_batch_id = uuid::Uuid::new_v4().to_string();
    let bank_item_id = uuid::Uuid::new_v4().to_string();
    let mut transaction = database.pool().begin().await.expect("创建脱敏采集夹具事务");

    sqlx::query(
        r#"INSERT INTO adapter_authorizations
           (id, company_id, adapter_type, adapter_code, region, auth_status,
            account_mask, capability_scope)
           VALUES (?, ?, 'release_acceptance_fixture', ?, 'test-only', 'pending',
                   '****0000', 'fixture_only')"#,
    )
    .bind(&authorization_id)
    .bind(company_id)
    .bind(format!("FIXTURE-{}", scenario.code))
    .execute(&mut *transaction)
    .await
    .expect("写入未授权的脱敏采集夹具");
    sqlx::query(
        r#"INSERT INTO adapter_provider_configs
           (id, company_id, authorization_id, provider_name, endpoint, credential_env,
            timeout_seconds, is_enabled, created_by, updated_by)
           VALUES (?, ?, ?, 'release_acceptance_fixture',
                   'https://release-acceptance.invalid',
                   'RELEASE_ACCEPTANCE_FIXTURE_DISABLED', 5, 0,
                   'releaseadmin', 'releaseadmin')"#,
    )
    .bind(&provider_config_id)
    .bind(company_id)
    .bind(&authorization_id)
    .execute(&mut *transaction)
    .await
    .expect("写入禁用的脱敏采集提供方夹具");

    sqlx::query(
        r#"INSERT INTO external_invoice_sync_batches
           (id, company_id, authorization_id, provider_config_id, period,
            idempotency_key, request_fingerprint, status, item_count, executed_by)
           VALUES (?, ?, ?, ?, '2026-01', ?, ?, 'pending_review', 1, 'releaseadmin')"#,
    )
    .bind(&invoice_batch_id)
    .bind(company_id)
    .bind(&authorization_id)
    .bind(&provider_config_id)
    .bind(format!(
        "release-acceptance-invoice-{}-{}",
        scenario.code,
        uuid::Uuid::new_v4()
    ))
    .bind(format!("fixture-invoice-request-{}", scenario.code))
    .execute(&mut *transaction)
    .await
    .expect("写入脱敏发票采集批次");
    sqlx::query(
        r#"INSERT INTO external_invoice_sync_items
           (id, batch_id, company_id, authorization_id, external_invoice_id,
            invoice_type, invoice_code, invoice_no, invoice_date, seller_name,
            seller_tax_id, buyer_name, buyer_tax_id, amount, tax_amount,
            total_amount, tax_rate, currency, review_status, payload_checksum)
           VALUES (?, ?, ?, ?, ?, 'output', ?, ?, '2026-01-15', ?, ?,
                   '脱敏客户', '91310000CUSTOMER01', 943.40, 56.60,
                   1000.00, 0.06, 'CNY', 'pending_review', ?)"#,
    )
    .bind(&invoice_item_id)
    .bind(&invoice_batch_id)
    .bind(company_id)
    .bind(&authorization_id)
    .bind(format!("EXT-INV-{}-202601", scenario.code))
    .bind("3100260000")
    .bind(format!("INV-{}-202601", scenario.code))
    .bind(company_name)
    .bind(company_tax_id)
    .bind(format!("fixture-invoice-payload-{}", scenario.code))
    .execute(&mut *transaction)
    .await
    .expect("写入脱敏待复核发票");
    sqlx::query(
        r#"INSERT INTO external_invoice_sync_item_lines
           (id, staging_item_id, line_no, item_name, unit, quantity, unit_price,
            amount, tax_rate, tax_amount, tax_classification_code)
           VALUES (?, ?, 1, '信息技术服务', '项', 1, 943.40,
                   943.40, 0.06, 56.60, '3040201990000000000')"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&invoice_item_id)
    .execute(&mut *transaction)
    .await
    .expect("写入脱敏待复核发票明细");

    sqlx::query(
        r#"INSERT INTO external_bank_sync_batches
           (id, company_id, authorization_id, provider_config_id, period,
            idempotency_key, request_fingerprint, status, item_count, executed_by)
           VALUES (?, ?, ?, ?, '2026-01', ?, ?, 'pending_review', 1, 'releaseadmin')"#,
    )
    .bind(&bank_batch_id)
    .bind(company_id)
    .bind(&authorization_id)
    .bind(&provider_config_id)
    .bind(format!(
        "release-acceptance-bank-{}-{}",
        scenario.code,
        uuid::Uuid::new_v4()
    ))
    .bind(format!("fixture-bank-request-{}", scenario.code))
    .execute(&mut *transaction)
    .await
    .expect("写入脱敏银行流水采集批次");
    sqlx::query(
        r#"INSERT INTO external_bank_sync_items
           (id, batch_id, company_id, authorization_id, external_transaction_id,
            account_mask, transaction_date, direction, amount, currency,
            counterparty_name, counterparty_account_mask, bank_reference, summary,
            balance, review_status, payload_checksum)
           VALUES (?, ?, ?, ?, ?, '基本户 ****0000', '2026-01-15', 'income',
                   1000.00, 'CNY', '脱敏客户', '****0000', ?, '收到预收服务款',
                   1000.00, 'pending_review', ?)"#,
    )
    .bind(&bank_item_id)
    .bind(&bank_batch_id)
    .bind(company_id)
    .bind(&authorization_id)
    .bind(format!("BANK-{}-001", scenario.code))
    .bind(format!("FIXTURE-BANK-{}", scenario.code))
    .bind(format!("fixture-bank-payload-{}", scenario.code))
    .execute(&mut *transaction)
    .await
    .expect("写入脱敏待复核银行流水");

    transaction.commit().await.expect("提交脱敏采集夹具事务");
    (invoice_item_id, bank_item_id)
}

#[tokio::test]
async fn four_accounting_systems_complete_the_release_acceptance_matrix() {
    let data_dir = std::env::temp_dir().join(format!(
        "accounting-release-acceptance-{}",
        uuid::Uuid::new_v4()
    ));
    let database = Database::new(data_dir.clone())
        .await
        .expect("初始化发布验收数据库");
    let app = tauri::test::mock_app();
    assert!(app.manage(database), "验收数据库应注册为 Tauri 状态");
    let state = app.state::<Database>();
    let admin_password = format!("A1!{}", uuid::Uuid::new_v4());

    auth::initialize_admin(
        InitializeAdminInput {
            username: "releaseadmin".to_string(),
            password: admin_password.clone(),
            real_name: "发布验收员".to_string(),
        },
        state.clone(),
    )
    .await
    .expect("初始化发布验收管理员");
    let login = auth::login(
        LoginRequest {
            username: "releaseadmin".to_string(),
            password: admin_password,
        },
        state.clone(),
    )
    .await
    .expect("登录发布验收管理员");
    let auth_token = login.token.expect("管理员登录返回会话令牌");

    for scenario in ACCEPTANCE_SCENARIOS {
        let context = scenario.accounting_system;
        let company = companies::create_company(company_input(scenario), state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 创建账套失败: {error}"));
        let period: crate::db::AccountingPeriod = sqlx::query_as(
            "SELECT * FROM accounting_periods WHERE company_id = ? AND period_year = 2026 AND period_month = 1",
        )
        .bind(&company.id)
        .fetch_one(state.pool())
        .await
        .unwrap_or_else(|error| panic!("{context}: 读取启用账期失败: {error}"));
        let voucher_word_id: String = sqlx::query_scalar(
            "SELECT id FROM voucher_words WHERE company_id = ? AND is_enabled = 1 LIMIT 1",
        )
        .bind(&company.id)
        .fetch_one(state.pool())
        .await
        .unwrap_or_else(|error| panic!("{context}: 读取凭证字失败: {error}"));

        let (invoice_item_id, bank_item_id) = stage_reviewable_collection_items(
            &state,
            scenario,
            &company.id,
            &company.name,
            company.tax_id.as_deref(),
        )
        .await;
        let imported_invoice_item = automation::import_external_invoice_sync_item(
            ReviewExternalInvoiceSyncItemInput {
                company_id: company.id.clone(),
                item_id: invoice_item_id,
                review_confirmed: true,
                review_note: Some("1.0.0 脱敏验收人工确认".to_string()),
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 复核导入采集发票失败: {error}"));
        assert_eq!(imported_invoice_item.review_status, "imported");
        let invoice_id = imported_invoice_item
            .imported_invoice_id
            .expect("采集发票导入后应关联正式发票");
        let invoice = invoices::get_invoice(invoice_id, company.id.clone(), state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 读取导入发票失败: {error}"))
            .expect("导入的正式发票应存在");
        let verified_invoice = invoices::review_output_invoice(
            invoice.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 复核发票失败: {error}"));
        assert_eq!(
            verified_invoice.status, "verified",
            "{context}: 发票复核状态"
        );

        let imported_bank_item = automation::import_external_bank_sync_item(
            ReviewExternalBankSyncItemInput {
                company_id: company.id.clone(),
                item_id: bank_item_id,
                review_confirmed: true,
                review_note: Some("1.0.0 脱敏验收人工确认".to_string()),
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 复核导入采集银行流水失败: {error}"));
        assert_eq!(imported_bank_item.review_status, "imported");
        let bank_transaction_id = imported_bank_item
            .imported_transaction_id
            .expect("采集银行流水导入后应关联正式流水");
        let bank_transaction: BankTransaction =
            sqlx::query_as("SELECT * FROM bank_transactions WHERE id = ? AND company_id = ?")
                .bind(&bank_transaction_id)
                .bind(&company.id)
                .fetch_one(state.pool())
                .await
                .unwrap_or_else(|error| panic!("{context}: 读取导入银行流水失败: {error}"));

        let bank_name = account_name(&state, &company.id, scenario.bank_code).await;
        let liability_name = account_name(&state, &company.id, scenario.liability_code).await;
        let voucher = vouchers::create_voucher(
            CreateVoucherInput {
                company_id: company.id.clone(),
                period_id: period.id.clone(),
                voucher_word_id: voucher_word_id.clone(),
                voucher_date: "2026-01-15".to_string(),
                voucher_number: None,
                summary: Some("收到预收服务款".to_string()),
                attachment_count: Some(2),
                reference_number: Some(format!("ACCEPT-{}-001", scenario.code)),
                ai_suggestion_id: None,
                bank_transaction_id: Some(bank_transaction.id.clone()),
                business_source_kind: None,
                business_source_id: None,
                entries: vec![
                    voucher_entry(scenario.bank_code, bank_name, "debit"),
                    voucher_entry(scenario.liability_code, liability_name, "credit"),
                ],
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 流水生成凭证失败: {error}"));
        invoices::match_invoice_to_voucher(
            invoice.id.clone(),
            voucher.voucher.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 发票关联凭证失败: {error}"));
        let approved = vouchers::approve_voucher(
            voucher.voucher.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 审核凭证失败: {error}"));
        assert_eq!(approved.status, "approved", "{context}: 凭证审核状态");

        settlement::create_settlement_rule(
            settlement::CreateSettlementRuleInput {
                company_id: company.id.clone(),
                name: "损益结转".to_string(),
                rule_type: "profit_loss".to_string(),
                source_formula: None,
                target_account_code: Some(scenario.settlement_target_code.to_string()),
                voucher_word_id: Some(voucher_word_id),
                summary_template: Some("{账期} 损益结转".to_string()),
                priority: Some(10),
            },
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 配置结转规则失败: {error}"));

        let closed = periods::close_period(
            ClosePeriodInput {
                period_id: period.id.clone(),
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 结账失败: {error}"));
        assert_eq!(closed.status, "closed", "{context}: 结账状态");

        let general_ledger = periods::get_general_ledger(period.id.clone(), None, state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 生成总账失败: {error}"));
        let bank_general_ledger = general_ledger
            .iter()
            .find(|item| item.account_code == scenario.bank_code)
            .unwrap_or_else(|| panic!("{context}: 总账缺少银行科目 {}", scenario.bank_code));
        assert!((bank_general_ledger.period_debit - 1_000.0).abs() < 0.01);
        let subsidiary_ledger = periods::get_subsidiary_ledger(
            period.id.clone(),
            scenario.bank_code.to_string(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 生成明细账失败: {error}"));
        assert!(
            subsidiary_ledger.iter().any(|item| {
                item.voucher_id == voucher.voucher.id && (item.debit - 1_000.0).abs() < 0.01
            }),
            "{context}: 明细账应包含采集流水生成的借方凭证"
        );

        let locked_error = bank_transactions::create_bank_transaction(
            CreateBankTransactionInput {
                company_id: company.id.clone(),
                period: "2026-01".to_string(),
                account_name: "基本户".to_string(),
                serial_no: format!("BANK-{}-LOCKED", scenario.code),
                transaction_date: "2026-01-20".to_string(),
                counterparty: None,
                summary: Some("结账后写入应被阻止".to_string()),
                income_amount: 1.0,
                expense_amount: 0.0,
                balance: Some(1_001.0),
                receipt_status: None,
            },
            state.clone(),
        )
        .await
        .expect_err("结账后不能新增银行流水");
        assert!(locked_error.contains("已结账"), "{context}: {locked_error}");

        let balance_sheet = periods::get_balance_sheet(period.id.clone(), state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 生成资产负债表失败: {error}"));
        assert_eq!(balance_sheet.accounting_system, scenario.accounting_system);
        assert!(balance_sheet.is_statutory, "{context}: 应使用法定报表模板");
        assert!(balance_sheet.is_balanced, "{context}: 资产负债表必须平衡");
        assert!((balance_sheet.total_assets - 1_000.0).abs() < 0.01);
        assert!((balance_sheet.total_liabilities - 1_000.0).abs() < 0.01);

        let income_statement = periods::get_income_statement(period.id.clone(), state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 生成利润或业务活动表失败: {error}"));
        assert_eq!(
            income_statement.accounting_system,
            scenario.accounting_system
        );
        assert!(
            income_statement.is_statutory,
            "{context}: 应使用法定损益报表模板"
        );
        assert!(income_statement.current_period_total.abs() < 0.01);

        let tax_task = automation::upsert_tax_declaration_task(
            UpsertTaxDeclarationTaskInput {
                company_id: company.id.clone(),
                period: "2026-01".to_string(),
                tax_type: "增值税及附加".to_string(),
                form_name: "增值税及附加税费申报表".to_string(),
                collect_status: Some("collected".to_string()),
                validation_status: Some("passed".to_string()),
                declaration_status: Some("draft".to_string()),
                source_snapshot: Some(
                    serde_json::json!({
                        "period": "2026-01",
                        "invoice": invoice.invoice_no,
                        "voucher": approved.voucher_number,
                        "balanceSheetBalanced": balance_sheet.is_balanced,
                    })
                    .to_string(),
                ),
                taxable_amount: Some(943.40),
                deduction_amount: Some(0.0),
                payable_amount: Some(56.60),
                risk_count: Some(0),
                adapter_code: None,
                receipt_no: None,
                payment_status: Some("unrecorded".to_string()),
                payment_no: None,
                receipt_received_at: None,
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 生成申报取数快照失败: {error}"));
        let confirmed_tax = automation::confirm_tax_declaration_task(
            ConfirmTaxDeclarationTaskInput {
                id: tax_task.id,
                company_id: company.id.clone(),
            },
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 本地确认申报失败: {error}"));
        assert_eq!(confirmed_tax.declaration_status, "confirmed");
        assert_eq!(confirmed_tax.snapshot_version, 2);

        let reopened = periods::reopen_period(period.id.clone(), auth_token.clone(), state.clone())
            .await
            .unwrap_or_else(|error| panic!("{context}: 反结账失败: {error}"));
        assert_eq!(reopened.status, "open", "{context}: 反结账状态");
        let draft = vouchers::reverse_approve_voucher(
            voucher.voucher.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 反审核失败: {error}"));
        assert_eq!(draft.status, "draft", "{context}: 反审核状态");
        vouchers::approve_voucher(
            voucher.voucher.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 重新审核失败: {error}"));
        let reversal = vouchers::reverse_voucher(
            voucher.voucher.id.clone(),
            company.id.clone(),
            auth_token.clone(),
            state.clone(),
        )
        .await
        .unwrap_or_else(|error| panic!("{context}: 红冲失败: {error}"));
        assert_eq!(reversal.status, "approved", "{context}: 红冲凭证状态");
        assert_eq!(
            reversal.reversal_of_id.as_deref(),
            Some(voucher.voucher.id.as_str())
        );

        let audit_actions: Vec<String> = sqlx::query_scalar(
            "SELECT action FROM operation_audit_logs WHERE company_id = ? ORDER BY created_at, rowid",
        )
        .bind(&company.id)
        .fetch_all(state.pool())
        .await
        .unwrap_or_else(|error| panic!("{context}: 读取业务审计日志失败: {error}"));
        for action in [
            "复核导入票池发票",
            "复核导入银行流水",
            "复核销项发票",
            "关联发票与凭证",
            "结账",
            "确认申报快照",
            "反结账",
        ] {
            assert!(
                audit_actions.iter().any(|actual| actual == action),
                "{context}: 缺少业务审计动作 {action}"
            );
        }
        let voucher_operations: Vec<String> = sqlx::query_scalar(
            "SELECT operation_type FROM voucher_logs WHERE voucher_id = ? ORDER BY created_at, rowid",
        )
        .bind(&voucher.voucher.id)
        .fetch_all(state.pool())
        .await
        .unwrap_or_else(|error| panic!("{context}: 读取凭证审计日志失败: {error}"));
        for operation in ["approve", "reverse_approve", "reverse"] {
            assert!(
                voucher_operations.iter().any(|actual| actual == operation),
                "{context}: 缺少凭证审计动作 {operation}"
            );
        }
    }

    state.pool().close().await;
    drop(state);
    drop(app);
    crate::test_support::remove_test_data_dir(&data_dir, "清理发布验收数据库");
}
