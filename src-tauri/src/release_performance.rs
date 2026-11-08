use crate::commands::{
    auth::{self, InitializeAdminInput, LoginRequest},
    companies, periods,
    vouchers::{self, ImportEntryInput, ImportVoucherInput, VoucherQueryInput},
};
use crate::db::{CreateCompanyInput, Database, DbPool};
use std::time::{Duration, Instant};
use tauri::Manager;

const LARGE_ACCOUNT_VOUCHERS: usize = 10_000;
const CROSS_YEAR_MONTHS: usize = 36;
const CONCURRENT_COMPANIES: usize = 4;
const CONCURRENT_COMPANY_VOUCHERS: usize = 1_500;

const PAGINATION_BUDGET: Duration = Duration::from_secs(5);
const IMPORT_BUDGET: Duration = Duration::from_secs(60);
const EXPORT_BUDGET: Duration = Duration::from_secs(30);
const REPORT_BUDGET: Duration = Duration::from_secs(10);
const CONCURRENT_QUERY_BUDGET: Duration = Duration::from_secs(10);

fn company_input(code: &str, name: &str, enable_year: i32) -> CreateCompanyInput {
    CreateCompanyInput {
        code: code.to_string(),
        name: name.to_string(),
        tax_id: Some(format!("91310000PERF{code}")),
        tax_type: Some("general".to_string()),
        industry: Some("软件和信息技术服务业".to_string()),
        accounting_system: Some("small_enterprise".to_string()),
        province: Some("上海市".to_string()),
        city: Some("上海市".to_string()),
        district: Some("浦东新区".to_string()),
        enterprise_type: Some("性能验收主体".to_string()),
        service_start: Some(format!("{enable_year}-01-01")),
        service_end: Some("2026-12-31".to_string()),
        enable_year: Some(enable_year),
        enable_month: Some(1),
    }
}

fn import_voucher(index: usize) -> ImportVoucherInput {
    let month_index = index % CROSS_YEAR_MONTHS;
    let year = 2024 + month_index / 12;
    let month = month_index % 12 + 1;
    let amount = 100.0 + (index % 100) as f64;
    ImportVoucherInput {
        voucher_date: format!("{year}-{month:02}-15"),
        summary: format!("性能验收业务-{index:05}"),
        entries: vec![
            ImportEntryInput {
                account_code: "1002".to_string(),
                account_name: Some("银行存款".to_string()),
                account_full_name: Some("银行存款".to_string()),
                direction: "debit".to_string(),
                amount,
                summary: "收款".to_string(),
            },
            ImportEntryInput {
                account_code: "2203".to_string(),
                account_name: Some("预收账款".to_string()),
                account_full_name: Some("预收账款".to_string()),
                direction: "credit".to_string(),
                amount,
                summary: "确认预收".to_string(),
            },
        ],
    }
}

fn voucher_query(company_id: &str, page: i32, page_size: i32) -> VoucherQueryInput {
    VoucherQueryInput {
        company_id: company_id.to_string(),
        period_id: None,
        start_date: None,
        end_date: None,
        keyword: None,
        status: None,
        voucher_word_id: None,
        account_code: None,
        page: Some(page),
        page_size: Some(page_size),
    }
}

fn assert_within(label: &str, elapsed: Duration, budget: Duration) {
    assert!(
        elapsed <= budget,
        "{label}耗时 {:.2?}，超过发布上限 {:.2?}",
        elapsed,
        budget
    );
}

async fn seed_company_vouchers(pool: &DbPool, company_id: &str, count: usize) {
    let (period_id, voucher_word_id): (String, String) = sqlx::query_as(
        r#"SELECT p.id, w.id
           FROM accounting_periods p
           JOIN voucher_words w ON w.company_id = p.company_id AND w.is_enabled = 1
           WHERE p.company_id = ? AND p.period_year = 2026 AND p.period_month = 1
           LIMIT 1"#,
    )
    .bind(company_id)
    .fetch_one(pool)
    .await
    .expect("读取并发验收账期和凭证字");

    let mut transaction = pool.begin().await.expect("开始并发验收数据事务");
    for index in 0..count {
        let voucher_id = uuid::Uuid::new_v4().to_string();
        let amount = 100.0 + (index % 100) as f64;
        sqlx::query(
            r#"INSERT INTO vouchers (
                id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
                voucher_date, summary, status, total_debit, total_credit, created_by,
                approved_by, approved_at
            ) VALUES (?, ?, ?, ?, ?, ?, '2026-01-15', ?, 'approved', ?, ?,
                '性能验收员', '性能验收员', datetime('now'))"#,
        )
        .bind(&voucher_id)
        .bind(company_id)
        .bind(&period_id)
        .bind(&voucher_word_id)
        .bind(format!("记字第{:06}号", index + 1))
        .bind((index + 1) as i32)
        .bind(format!("多客户并发业务-{index:05}"))
        .bind(amount)
        .bind(amount)
        .execute(&mut *transaction)
        .await
        .expect("写入并发验收凭证");

        for (line_num, code, name, direction) in [
            (1, "1002", "银行存款", "debit"),
            (2, "2203", "预收账款", "credit"),
        ] {
            sqlx::query(
                r#"INSERT INTO voucher_entries (
                    id, voucher_id, line_num, account_code, account_name, direction, amount, summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '多客户并发验收')"#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&voucher_id)
            .bind(line_num)
            .bind(code)
            .bind(name)
            .bind(direction)
            .bind(amount)
            .execute(&mut *transaction)
            .await
            .expect("写入并发验收分录");
        }
    }
    transaction.commit().await.expect("提交并发验收数据");
}

#[tokio::test]
#[ignore = "run via npm run verify:release-performance"]
async fn release_performance_large_cross_year_account_set_meets_query_report_and_export_budgets() {
    let data_dir = std::env::temp_dir().join(format!(
        "accounting-release-performance-large-{}",
        uuid::Uuid::new_v4()
    ));
    let database = Database::new(data_dir.clone())
        .await
        .expect("初始化大账套性能数据库");
    let app = tauri::test::mock_app();
    assert!(app.manage(database), "性能数据库应注册为 Tauri 状态");
    let state = app.state::<Database>();
    let admin_password = format!("A1!{}", uuid::Uuid::new_v4());
    auth::initialize_admin(
        InitializeAdminInput {
            username: "performanceadmin".to_string(),
            password: admin_password.clone(),
            real_name: "性能验收员".to_string(),
        },
        state.clone(),
    )
    .await
    .expect("初始化性能验收管理员");
    let login = auth::login(
        LoginRequest {
            username: "performanceadmin".to_string(),
            password: admin_password,
        },
        state.clone(),
    )
    .await
    .expect("登录性能验收管理员");
    let auth_token = login.token.expect("性能验收登录返回会话令牌");
    let company = companies::create_company(
        company_input("LARGE", "脱敏大账套性能验收", 2024),
        state.clone(),
    )
    .await
    .expect("创建大账套性能验收公司");
    let voucher_word_id: String = sqlx::query_scalar(
        "SELECT id FROM voucher_words WHERE company_id = ? AND is_enabled = 1 LIMIT 1",
    )
    .bind(&company.id)
    .fetch_one(state.pool())
    .await
    .expect("读取大账套凭证字");

    let import_rows = (0..LARGE_ACCOUNT_VOUCHERS)
        .map(import_voucher)
        .collect::<Vec<_>>();
    let started = Instant::now();
    let imported = vouchers::import_vouchers(
        company.id.clone(),
        None,
        voucher_word_id,
        import_rows,
        auth_token,
        state.clone(),
    )
    .await
    .expect("导入大账套跨年度凭证");
    let import_elapsed = started.elapsed();
    assert_eq!(imported.success, LARGE_ACCOUNT_VOUCHERS);
    assert!(
        imported.errors.is_empty(),
        "导入错误: {:?}",
        imported.errors
    );
    assert_eq!(imported.auto_created_accounts, 0);
    assert_within("10,000 张凭证导入", import_elapsed, IMPORT_BUDGET);

    let period_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM accounting_periods WHERE company_id = ? AND period_year BETWEEN 2024 AND 2026",
    )
    .bind(&company.id)
    .fetch_one(state.pool())
    .await
    .expect("统计跨年度账期");
    assert_eq!(period_count, CROSS_YEAR_MONTHS as i64);

    let started = Instant::now();
    let page = vouchers::query_vouchers(voucher_query(&company.id, 50, 100), state.clone())
        .await
        .expect("查询大账套深页数据");
    let pagination_elapsed = started.elapsed();
    assert_eq!(page.total, LARGE_ACCOUNT_VOUCHERS as i64);
    assert_eq!(page.vouchers.len(), 100);
    assert!(page
        .vouchers
        .iter()
        .all(|voucher| voucher.entries.len() == 2));
    assert_within("大账套深页分页", pagination_elapsed, PAGINATION_BUDGET);

    let report_period_id: String = sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = 2026 AND period_month = 12",
    )
    .bind(&company.id)
    .fetch_one(state.pool())
    .await
    .expect("读取跨年度末账期");
    for (code, debit, credit) in [("1002", 1_000_000.0, 0.0), ("2203", 0.0, 1_000_000.0)] {
        sqlx::query(
            r#"UPDATE account_balances
               SET period_debit = ?, period_credit = ?, closing_debit = ?, closing_credit = ?
               WHERE period_id = ? AND account_code = ?"#,
        )
        .bind(debit)
        .bind(credit)
        .bind(debit)
        .bind(credit)
        .bind(&report_period_id)
        .bind(code)
        .execute(state.pool())
        .await
        .expect("准备报表性能余额");
    }
    let started = Instant::now();
    let trial_balance = periods::get_trial_balance(report_period_id.clone(), state.clone())
        .await
        .expect("生成大账套试算平衡表");
    let balance_sheet = periods::get_balance_sheet(report_period_id.clone(), state.clone())
        .await
        .expect("生成大账套资产负债表");
    let income_statement = periods::get_income_statement(report_period_id, state.clone())
        .await
        .expect("生成大账套利润表");
    let report_elapsed = started.elapsed();
    assert!(trial_balance.is_balanced);
    assert!((trial_balance.total_period_debit - 1_000_000.0).abs() < 0.01);
    assert!(balance_sheet.is_balanced);
    assert!(income_statement.is_statutory);
    assert_within("大账套三张核心报表", report_elapsed, REPORT_BUDGET);

    let started = Instant::now();
    let export_path = vouchers::export_vouchers_excel(company.id.clone(), None, state.clone())
        .await
        .expect("导出大账套全部凭证");
    let export_elapsed = started.elapsed();
    let export_metadata = std::fs::metadata(&export_path).expect("读取大账套导出文件");
    assert!(
        export_metadata.len() > 500_000,
        "导出文件应包含完整业务数据"
    );
    assert_within("10,000 张凭证 Excel 导出", export_elapsed, EXPORT_BUDGET);
    eprintln!(
        "大账套性能: 导入={import_elapsed:.2?}, 分页={pagination_elapsed:.2?}, 报表={report_elapsed:.2?}, 导出={export_elapsed:.2?}"
    );
    std::fs::remove_file(export_path).expect("清理大账套导出文件");

    state.pool().close().await;
    drop(state);
    drop(app);
    crate::test_support::remove_test_data_dir(&data_dir, "清理大账套性能数据库");
}

#[tokio::test]
#[ignore = "run via npm run verify:release-performance"]
async fn release_performance_multi_company_concurrency_meets_budget() {
    let data_dir = std::env::temp_dir().join(format!(
        "accounting-release-performance-concurrent-{}",
        uuid::Uuid::new_v4()
    ));
    let database = Database::new(data_dir.clone())
        .await
        .expect("初始化多客户并发性能数据库");
    let app = tauri::test::mock_app();
    assert!(app.manage(database), "并发数据库应注册为 Tauri 状态");
    let state = app.state::<Database>();
    let mut company_ids = Vec::with_capacity(CONCURRENT_COMPANIES);
    for index in 0..CONCURRENT_COMPANIES {
        let company = companies::create_company(
            company_input(
                &format!("CLIENT{}", index + 1),
                &format!("脱敏并发客户账套-{}", index + 1),
                2026,
            ),
            state.clone(),
        )
        .await
        .expect("创建并发客户账套");
        seed_company_vouchers(state.pool(), &company.id, CONCURRENT_COMPANY_VOUCHERS).await;
        company_ids.push(company.id);
    }

    let started = Instant::now();
    let (first, second, third, fourth) = tokio::join!(
        vouchers::query_vouchers(voucher_query(&company_ids[0], 10, 100), state.clone()),
        vouchers::query_vouchers(voucher_query(&company_ids[1], 10, 100), state.clone()),
        vouchers::query_vouchers(voucher_query(&company_ids[2], 10, 100), state.clone()),
        vouchers::query_vouchers(voucher_query(&company_ids[3], 10, 100), state.clone()),
    );
    let concurrent_elapsed = started.elapsed();
    for result in [first, second, third, fourth] {
        let page = result.expect("并发客户分页查询成功");
        assert_eq!(page.total, CONCURRENT_COMPANY_VOUCHERS as i64);
        assert_eq!(page.vouchers.len(), 100);
        assert!(page
            .vouchers
            .iter()
            .all(|voucher| voucher.entries.len() == 2));
    }
    assert_within(
        "4 个客户账套并发分页",
        concurrent_elapsed,
        CONCURRENT_QUERY_BUDGET,
    );
    eprintln!("多客户并发分页性能: {concurrent_elapsed:.2?}");

    let total_vouchers: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vouchers")
        .fetch_one(state.pool())
        .await
        .expect("统计多客户凭证");
    assert_eq!(
        total_vouchers,
        (CONCURRENT_COMPANIES * CONCURRENT_COMPANY_VOUCHERS) as i64
    );

    state.pool().close().await;
    drop(state);
    drop(app);
    crate::test_support::remove_test_data_dir(&data_dir, "清理多客户并发性能数据库");
}
