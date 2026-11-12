use crate::commands::{
    auth::{self, InitializeAdminInput, LoginRequest},
    companies,
    company_accounts::{self, CompanyAccountInput},
    invoices::{self, CreateInvoiceInput, InvoiceLineInput},
    periods, vouchers,
};
use crate::db::{CreateCompanyInput, CreateVoucherEntryInput, CreateVoucherInput, Database};
use tauri::Manager;

fn company_input(code: &str, name: &str) -> CreateCompanyInput {
    CreateCompanyInput {
        code: code.to_string(),
        name: name.to_string(),
        tax_id: Some(format!("91310000ISOLATION{code}")),
        tax_type: Some("general".to_string()),
        industry: Some("软件和信息技术服务业".to_string()),
        accounting_system: Some("small_enterprise".to_string()),
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

fn account_input(company_id: &str, name: &str, number: &str) -> CompanyAccountInput {
    CompanyAccountInput {
        company_id: company_id.to_string(),
        account_name: name.to_string(),
        account_type: "银行账户".to_string(),
        bank_name: Some("脱敏银行".to_string()),
        account_number: number.to_string(),
        subject_code: "1002 银行存款".to_string(),
        opening_balance: 1_000.0,
        attachment_note: Some("隔离验收资料".to_string()),
        status: "启用".to_string(),
    }
}

fn invoice_input(company_id: &str, period_id: &str, invoice_no: &str) -> CreateInvoiceInput {
    CreateInvoiceInput {
        company_id: company_id.to_string(),
        period_id: Some(period_id.to_string()),
        invoice_type: "output".to_string(),
        invoice_no: invoice_no.to_string(),
        invoice_code: Some("3100260000".to_string()),
        invoice_date: "2026-01-15".to_string(),
        amount: 100.0,
        tax_amount: 6.0,
        tax_rate: Some(0.06),
        seller_name: Some("脱敏服务方".to_string()),
        seller_tax_id: Some("91310000SELLER0001".to_string()),
        buyer_name: Some("脱敏客户".to_string()),
        buyer_tax_id: Some("91310000BUYER00001".to_string()),
        remarks: Some("账套隔离验收".to_string()),
        lines: vec![InvoiceLineInput {
            item_name: "信息技术服务".to_string(),
            specification: None,
            unit: Some("项".to_string()),
            quantity: Some(1.0),
            unit_price: Some(100.0),
            amount: 100.0,
            tax_rate: Some(0.06),
            tax_amount: 6.0,
            tax_classification_code: Some("3040201990000000000".to_string()),
        }],
    }
}

fn voucher_entry(code: &str, name: &str, direction: &str) -> CreateVoucherEntryInput {
    CreateVoucherEntryInput {
        account_code: code.to_string(),
        account_name: name.to_string(),
        direction: direction.to_string(),
        amount: 100.0,
        summary: Some("账套隔离验收".to_string()),
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

#[tokio::test]
async fn release_isolation_keeps_customer_accounts_periods_and_documents_separate() {
    let data_dir = std::env::temp_dir().join(format!(
        "accounting-release-isolation-{}",
        uuid::Uuid::new_v4()
    ));
    let database = Database::new(data_dir.clone())
        .await
        .expect("初始化数据隔离验收数据库");
    let app = tauri::test::mock_app();
    assert!(app.manage(database), "隔离验收数据库应注册为 Tauri 状态");
    let state = app.state::<Database>();
    let password = format!("A1!{}", uuid::Uuid::new_v4());
    auth::initialize_admin(
        InitializeAdminInput {
            username: "isolationadmin".to_string(),
            password: password.clone(),
            real_name: "隔离验收员".to_string(),
        },
        state.clone(),
    )
    .await
    .expect("初始化隔离验收管理员");
    let token = auth::login(
        LoginRequest {
            username: "isolationadmin".to_string(),
            password,
        },
        state.clone(),
    )
    .await
    .expect("登录隔离验收管理员")
    .token
    .expect("隔离验收登录返回令牌");

    let company_a =
        companies::create_company(company_input("ISO-A", "脱敏客户账套-A"), state.clone())
            .await
            .expect("创建客户账套 A");
    let company_b =
        companies::create_company(company_input("ISO-B", "脱敏客户账套-B"), state.clone())
            .await
            .expect("创建客户账套 B");

    let account_a = company_accounts::create_company_account(
        account_input(&company_a.id, "A 基本户", "622200******0001"),
        state.clone(),
    )
    .await
    .expect("创建客户 A 账户资料");
    let account_b = company_accounts::create_company_account(
        account_input(&company_b.id, "B 基本户", "622200******0002"),
        state.clone(),
    )
    .await
    .expect("创建客户 B 账户资料");
    let accounts_a = company_accounts::get_company_accounts(company_a.id.clone(), state.clone())
        .await
        .expect("读取客户 A 账户资料");
    let accounts_b = company_accounts::get_company_accounts(company_b.id.clone(), state.clone())
        .await
        .expect("读取客户 B 账户资料");
    assert_eq!(accounts_a.len(), 1);
    assert_eq!(accounts_a[0].id, account_a.id);
    assert_eq!(accounts_a[0].account_number, "622200******0001");
    assert_eq!(accounts_b.len(), 1);
    assert_eq!(accounts_b[0].id, account_b.id);
    assert_eq!(accounts_b[0].account_number, "622200******0002");
    let cross_account_error = company_accounts::update_company_account(
        account_b.id.clone(),
        account_input(&company_a.id, "越权修改", "622200******9999"),
        state.clone(),
    )
    .await
    .expect_err("客户 A 不能修改客户 B 的账户资料");
    assert!(cross_account_error.contains("不属于当前账套"));

    periods::ensure_periods(company_a.id.clone(), state.clone())
        .await
        .expect("补齐客户 A 全年账期");
    periods::ensure_periods(company_b.id.clone(), state.clone())
        .await
        .expect("补齐客户 B 全年账期");
    let periods_a = periods::get_accounting_periods(company_a.id.clone(), state.clone())
        .await
        .expect("读取客户 A 账期");
    let periods_b = periods::get_accounting_periods(company_b.id.clone(), state.clone())
        .await
        .expect("读取客户 B 账期");
    assert_eq!(periods_a.len(), 12);
    assert_eq!(periods_b.len(), 12);
    assert!(periods_a
        .iter()
        .all(|period| period.company_id == company_a.id));
    assert!(periods_b
        .iter()
        .all(|period| period.company_id == company_b.id));
    assert!(periods_a
        .iter()
        .all(|left| periods_b.iter().all(|right| left.id != right.id)));
    let january_a = periods_a
        .iter()
        .find(|period| period.period_month == 1)
        .expect("客户 A 一月账期");
    let january_b = periods_b
        .iter()
        .find(|period| period.period_month == 1)
        .expect("客户 B 一月账期");

    let invoice_a = invoices::create_invoice(
        invoice_input(&company_a.id, &january_a.id, "ISO-A-INV-001"),
        token.clone(),
        state.clone(),
    )
    .await
    .expect("创建客户 A 发票");
    let invoice_b = invoices::create_invoice(
        invoice_input(&company_b.id, &january_b.id, "ISO-B-INV-001"),
        token.clone(),
        state.clone(),
    )
    .await
    .expect("创建客户 B 发票");
    let invoices_a = invoices::get_invoices(
        Some(company_a.id.clone()),
        Some(january_a.id.clone()),
        None,
        state.clone(),
    )
    .await
    .expect("读取客户 A 发票");
    assert_eq!(invoices_a.len(), 1);
    assert_eq!(invoices_a[0].id, invoice_a.id);
    assert!(
        invoices::get_invoice(invoice_b.id.clone(), company_a.id.clone(), state.clone())
            .await
            .expect("跨账套发票查询应安全返回")
            .is_none()
    );
    assert!(invoices::get_invoices(
        Some(company_a.id.clone()),
        Some(january_b.id.clone()),
        None,
        state.clone(),
    )
    .await
    .expect("跨账套账期筛选应安全返回")
    .is_empty());

    let voucher_word_id: String = sqlx::query_scalar(
        "SELECT id FROM voucher_words WHERE company_id = ? AND is_enabled = 1 LIMIT 1",
    )
    .bind(&company_a.id)
    .fetch_one(state.pool())
    .await
    .expect("读取客户 A 凭证字");
    let bank_name: String =
        sqlx::query_scalar("SELECT name FROM account_codes WHERE company_id = ? AND code = '1002'")
            .bind(&company_a.id)
            .fetch_one(state.pool())
            .await
            .expect("读取客户 A 银行科目");
    let liability_name: String =
        sqlx::query_scalar("SELECT name FROM account_codes WHERE company_id = ? AND code = '2203'")
            .bind(&company_a.id)
            .fetch_one(state.pool())
            .await
            .expect("读取客户 A 负债科目");
    let entries = vec![
        voucher_entry("1002", &bank_name, "debit"),
        voucher_entry("2203", &liability_name, "credit"),
    ];
    let cross_period_error = vouchers::create_voucher(
        CreateVoucherInput {
            company_id: company_a.id.clone(),
            period_id: january_b.id.clone(),
            voucher_word_id: voucher_word_id.clone(),
            voucher_date: "2026-01-15".to_string(),
            voucher_number: None,
            summary: Some("跨账套账期应被拒绝".to_string()),
            attachment_count: Some(0),
            reference_number: None,
            ai_suggestion_id: None,
            bank_transaction_id: None,
            business_source_kind: None,
            business_source_id: None,
            entries: entries.clone(),
        },
        token.clone(),
        state.clone(),
    )
    .await
    .expect_err("客户 A 不能使用客户 B 的账期创建凭证");
    assert!(cross_period_error.contains("会计期间不存在"));

    let voucher_a = vouchers::create_voucher(
        CreateVoucherInput {
            company_id: company_a.id.clone(),
            period_id: january_a.id.clone(),
            voucher_word_id,
            voucher_date: "2026-01-15".to_string(),
            voucher_number: None,
            summary: Some("客户 A 正常凭证".to_string()),
            attachment_count: Some(0),
            reference_number: None,
            ai_suggestion_id: None,
            bank_transaction_id: None,
            business_source_kind: None,
            business_source_id: None,
            entries,
        },
        token,
        state.clone(),
    )
    .await
    .expect("客户 A 在本账期创建凭证");
    assert!(
        vouchers::get_voucher(voucher_a.voucher.id, company_b.id.clone(), state.clone(),)
            .await
            .expect("跨账套凭证查询应安全返回")
            .is_none()
    );

    state.pool().close().await;
    drop(state);
    drop(app);
    crate::test_support::remove_test_data_dir(&data_dir, "清理发布数据隔离验收数据库");
}
