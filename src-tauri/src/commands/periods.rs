use crate::commands::auth::authenticated_actor;
use crate::db::{
    AccountBalance, AccountingPeriod, ClosePeriodInput, CreatePeriodInput, Database, DbPool,
    SaveInitialBalanceInput,
};
use serde::{Deserialize, Serialize};
use sqlx::Sqlite;
use tauri::State;

type SubsidiaryLedgerRow = (
    String,
    String,
    String,
    Option<String>,
    String,
    f64,
    Option<String>,
);
type ReportTemplateItemRow = (
    String,
    String,
    String,
    i32,
    i32,
    i32,
    Option<String>,
    Option<String>,
    i32,
);

// ==================== Accounting Periods ====================

#[tauri::command]
pub async fn get_accounting_periods(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountingPeriod>, String> {
    log::info!("Fetching periods for company: {}", company_id);

    let periods: Vec<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE company_id = ? ORDER BY period_year DESC, period_month DESC",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(periods)
}

/// Ensure all 12 periods exist for the current accounting year of a company.
/// Creates missing periods and initializes their account_balances from the
/// previous period's closing balances.
#[tauri::command]
pub async fn ensure_periods(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountingPeriod>, String> {
    ensure_periods_record(company_id, db.pool()).await
}

async fn ensure_periods_record(
    company_id: String,
    pool: &DbPool,
) -> Result<Vec<AccountingPeriod>, String> {
    log::info!("Ensuring all periods exist for company: {}", company_id);
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start period generation transaction: {}", e))?;

    // Determine the accounting year: use enable_year if set, else current year
    let enable_info: Option<(i32, i32)> =
        sqlx::query_as("SELECT enable_year, enable_month FROM companies WHERE id = ?")
            .bind(&company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let year = enable_info
        .and_then(|(y, _)| if y > 0 { Some(y) } else { None })
        .unwrap_or_else(|| {
            chrono::Local::now()
                .format("%Y")
                .to_string()
                .parse::<i32>()
                .unwrap_or(2026)
        });

    // Get existing periods for this year
    let existing: Vec<(i32,)> = sqlx::query_as(
        "SELECT period_month FROM accounting_periods WHERE company_id = ? AND period_year = ?",
    )
    .bind(&company_id)
    .bind(year)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let existing_months: std::collections::HashSet<i32> =
        existing.into_iter().map(|(m,)| m).collect();

    // Get all enabled account codes
    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1 AND is_detail = 1",
    )
    .bind(&company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Create missing months
    for month in 1..=12 {
        if existing_months.contains(&month) {
            continue;
        }

        let start_date = format!("{}-{:02}-01", year, month);
        let end_day = days_in_month(year, month);
        let end_date = format!("{}-{:02}-{}", year, month, end_day);
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
        )
        .bind(&id)
        .bind(&company_id)
        .bind(year)
        .bind(month)
        .bind(&start_date)
        .bind(&end_date)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to create period: {}", e))?;

        // Get previous period's closing balances as opening for this period
        let prev_period: Option<AccountingPeriod> = sqlx::query_as(
            "SELECT * FROM accounting_periods WHERE company_id = ? AND (period_year < ? OR (period_year = ? AND period_month < ?)) ORDER BY period_year DESC, period_month DESC LIMIT 1",
        )
        .bind(&company_id)
        .bind(year)
        .bind(year)
        .bind(month)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for (code,) in &account_codes {
            let (opening_debit, opening_credit) = if let Some(ref prev) = prev_period {
                let prev_bal: Option<(f64, f64)> = sqlx::query_as(
                    "SELECT closing_debit, closing_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
                )
                .bind(&prev.id)
                .bind(code)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|e| format!("Database error: {}", e))?;
                prev_bal.unwrap_or((0.0, 0.0))
            } else {
                (0.0, 0.0)
            };

            sqlx::query(
                "INSERT OR IGNORE INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&id)
            .bind(code)
            .bind(opening_debit)
            .bind(opening_credit)
            .bind(opening_debit)
            .bind(opening_credit)
            .execute(&mut *transaction)
            .await
            .map_err(|e| format!("Failed to init balance: {}", e))?;
        }

        log::info!(
            "Created period {}-{:02} for company {}",
            year,
            month,
            company_id
        );
    }

    // Return all periods
    let periods: Vec<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE company_id = ? ORDER BY period_year, period_month",
    )
    .bind(&company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit period generation: {}", e))?;

    Ok(periods)
}

#[tauri::command]
pub async fn get_open_periods(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountingPeriod>, String> {
    let periods: Vec<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE company_id = ? AND status = 'open' ORDER BY period_year, period_month",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(periods)
}

#[tauri::command]
pub async fn create_accounting_period(
    input: CreatePeriodInput,
    db: State<'_, Database>,
) -> Result<AccountingPeriod, String> {
    create_accounting_period_record(input, db.pool()).await
}

async fn create_accounting_period_record(
    input: CreatePeriodInput,
    pool: &DbPool,
) -> Result<AccountingPeriod, String> {
    log::info!(
        "Creating period {}-{} for company {}",
        input.period_year,
        input.period_month,
        input.company_id
    );
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start period transaction: {}", e))?;

    // Check if period already exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
    )
    .bind(&input.company_id)
    .bind(input.period_year)
    .bind(input.period_month)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err(format!(
            "会计期间 {}-{} 已存在",
            input.period_year, input.period_month
        ));
    }

    let start_date = format!("{}-{:02}-01", input.period_year, input.period_month);
    let end_day = days_in_month(input.period_year, input.period_month);
    let end_date = format!(
        "{}-{:02}-{}",
        input.period_year, input.period_month, end_day
    );
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.period_year)
    .bind(input.period_month)
    .bind(&start_date)
    .bind(&end_date)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create period: {}", e))?;

    // Initialize account_balances rows for all enabled account codes
    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1 AND is_detail = 1",
    )
    .bind(&input.company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get previous period's closing balances as opening for this period
    let prev_period: Option<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE company_id = ? AND (period_year < ? OR (period_year = ? AND period_month < ?)) ORDER BY period_year DESC, period_month DESC LIMIT 1",
    )
    .bind(&input.company_id)
    .bind(input.period_year)
    .bind(input.period_year)
    .bind(input.period_month)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (code,) in &account_codes {
        let (opening_debit, opening_credit) = if let Some(ref prev) = prev_period {
            let prev_bal: Option<(f64, f64)> = sqlx::query_as(
                "SELECT closing_debit, closing_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
            )
            .bind(&prev.id)
            .bind(code)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            prev_bal.unwrap_or((0.0, 0.0))
        } else {
            (0.0, 0.0)
        };

        sqlx::query(
            "INSERT OR IGNORE INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(code)
        .bind(opening_debit)
        .bind(opening_credit)
        .bind(opening_debit)
        .bind(opening_credit)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to init balance: {}", e))?;
    }

    let period: AccountingPeriod = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit period transaction: {}", e))?;

    log::info!(
        "Period created: {}-{}",
        input.period_year,
        input.period_month
    );
    Ok(period)
}

#[tauri::command]
pub async fn close_period(
    input: ClosePeriodInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AccountingPeriod, String> {
    log::info!("Closing period: {}", input.period_id);

    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    close_period_record(db.pool(), &input.period_id, &actor).await
}

pub(crate) async fn close_period_record(
    pool: &DbPool,
    period_id: &str,
    actor: &str,
) -> Result<AccountingPeriod, String> {
    // Derive company_id from period for isolation
    let company_id: String =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(period_id)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    ensure_period_close_sequence(pool, &company_id, period_id).await?;

    // Pre-close validation: check for draft vouchers
    let draft_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM vouchers WHERE period_id = ? AND status = 'draft' AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
    )
    .bind(period_id)
    .bind(&company_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if draft_count.0 > 0 {
        return Err(format!("存在 {} 张草稿凭证，请先审核或删除", draft_count.0));
    }

    // Check trial balance
    let balances: Vec<AccountBalance> = sqlx::query_as(
        r#"SELECT ab.* FROM account_balances ab
           JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ab.account_code
           WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
    )
    .bind(&company_id)
    .bind(period_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let total_closing_debit: f64 = balances.iter().map(|b| b.closing_debit).sum();
    let total_closing_credit: f64 = balances.iter().map(|b| b.closing_credit).sum();

    if (total_closing_debit - total_closing_credit).abs() > 0.01 {
        return Err(format!(
            "试算不平衡: 借方合计 {} ≠ 贷方合计 {}",
            total_closing_debit, total_closing_credit
        ));
    }

    crate::commands::settlement::ensure_settlement_rules_completed(pool, &company_id, period_id)
        .await?;
    ensure_period_reconciled(pool, period_id).await?;

    let now = chrono::Utc::now().to_rfc3339();
    let period = persist_period_close(pool, &company_id, period_id, Some(actor), &now).await?;

    log::info!("Period closed: {}", period_id);
    Ok(period)
}

#[tauri::command]
pub async fn reopen_period(
    period_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AccountingPeriod, String> {
    log::info!("Reopening period: {}", period_id);

    // Derive company_id from period for isolation
    let company_id: String =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(&period_id)
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    ensure_period_reopen_sequence(db.pool(), &company_id, &period_id).await?;

    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let now = chrono::Utc::now().to_rfc3339();
    let period =
        persist_period_reopen(db.pool(), &company_id, &period_id, Some(&actor), &now).await?;

    Ok(period)
}

async fn persist_period_close(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    operator: Option<&str>,
    now: &str,
) -> Result<AccountingPeriod, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建结账事务失败: {error}"))?;
    let (year, month): (i32, i32) = sqlx::query_as(
        "SELECT period_year, period_month FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取待结账账期失败: {error}"))?;
    let result = sqlx::query(
        "UPDATE accounting_periods SET status = 'closed', closed_at = ?, closed_by = ?, updated_at = ? WHERE id = ? AND company_id = ? AND status != 'closed'",
    )
    .bind(now)
    .bind(operator)
    .bind(now)
    .bind(period_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存结账状态失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("该会计期间已经结账或状态已变更".to_string());
    }

    let period_label = format!("{year:04}-{month:02}");
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '账期管理', '结账', ?, 'high', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(&period_label)
    .bind("账期通过服务端结转、试算与账表勾稽检查后锁定")
    .bind(operator)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入结账审计记录失败: {error}"))?;

    let period = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?")
        .bind(period_id)
        .bind(company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取结账结果失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交结账事务失败: {error}"))?;
    Ok(period)
}

async fn persist_period_reopen(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    operator: Option<&str>,
    now: &str,
) -> Result<AccountingPeriod, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建反结账事务失败: {error}"))?;
    let (year, month): (i32, i32) = sqlx::query_as(
        "SELECT period_year, period_month FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取待反结账账期失败: {error}"))?;
    let result = sqlx::query(
        "UPDATE accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL, updated_at = ? WHERE id = ? AND company_id = ? AND status = 'closed'",
    )
    .bind(now)
    .bind(period_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存反结账状态失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("该会计期间尚未结账或状态已变更".to_string());
    }

    let period_label = format!("{year:04}-{month:02}");
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '账期管理', '反结账', ?, 'critical', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(&period_label)
    .bind("账期按逆序恢复开放，后续需重新执行结转、试算与账表勾稽检查")
    .bind(operator)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入反结账审计记录失败: {error}"))?;

    let period = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?")
        .bind(period_id)
        .bind(company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取反结账结果失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交反结账事务失败: {error}"))?;
    Ok(period)
}

async fn ensure_period_close_sequence(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
) -> Result<(), String> {
    let target: Option<(i32, i32, String)> = sqlx::query_as(
        "SELECT period_year, period_month, status FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取待结账账期失败: {error}"))?;
    let (year, month, status) = target.ok_or_else(|| "会计期间不存在".to_string())?;
    if status == "closed" {
        return Err("该会计期间已经结账".to_string());
    }

    let earlier_open: Option<(i32, i32)> = sqlx::query_as(
        r#"SELECT period_year, period_month
           FROM accounting_periods
           WHERE company_id = ? AND status != 'closed'
             AND (period_year < ? OR (period_year = ? AND period_month < ?))
           ORDER BY period_year, period_month
           LIMIT 1"#,
    )
    .bind(company_id)
    .bind(year)
    .bind(year)
    .bind(month)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("检查前序账期失败: {error}"))?;
    if let Some((earlier_year, earlier_month)) = earlier_open {
        return Err(format!(
            "前序账期 {earlier_year:04}-{earlier_month:02} 尚未结账，不能跳期结账"
        ));
    }
    Ok(())
}

async fn ensure_period_reopen_sequence(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
) -> Result<(), String> {
    let target: Option<(i32, i32, String)> = sqlx::query_as(
        "SELECT period_year, period_month, status FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取待反结账账期失败: {error}"))?;
    let (year, month, status) = target.ok_or_else(|| "会计期间不存在".to_string())?;
    if status != "closed" {
        return Err("该会计期间尚未结账".to_string());
    }

    let later_closed: Option<(i32, i32)> = sqlx::query_as(
        r#"SELECT period_year, period_month
           FROM accounting_periods
           WHERE company_id = ? AND status = 'closed'
             AND (period_year > ? OR (period_year = ? AND period_month > ?))
           ORDER BY period_year DESC, period_month DESC
           LIMIT 1"#,
    )
    .bind(company_id)
    .bind(year)
    .bind(year)
    .bind(month)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("检查后续账期失败: {error}"))?;
    if let Some((later_year, later_month)) = later_closed {
        return Err(format!(
            "后续账期 {later_year:04}-{later_month:02} 仍处于已结账状态，请先按逆序反结账"
        ));
    }
    Ok(())
}

// ==================== Account Balances ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct TrialBalanceResult {
    pub items: Vec<TrialBalanceItem>,
    pub total_opening_debit: f64,
    pub total_opening_credit: f64,
    pub total_period_debit: f64,
    pub total_period_credit: f64,
    pub total_cumulative_debit: f64,
    pub total_cumulative_credit: f64,
    pub total_closing_debit: f64,
    pub total_closing_credit: f64,
    pub is_balanced: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrialBalanceItem {
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub account_level: i32,
    pub is_detail: bool,
    pub opening_debit: f64,
    pub opening_credit: f64,
    pub period_debit: f64,
    pub period_credit: f64,
    pub cumulative_debit: f64,
    pub cumulative_credit: f64,
    pub closing_debit: f64,
    pub closing_credit: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountingReconciliationResult {
    pub period_id: String,
    pub company_id: String,
    pub accounting_system: String,
    pub checks: Vec<AccountingReconciliationCheck>,
    pub passed_count: usize,
    pub blocked_count: usize,
    pub is_reconciled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountingReconciliationCheck {
    pub code: String,
    pub name: String,
    pub source: String,
    pub target: String,
    pub source_amount: f64,
    pub target_amount: f64,
    pub difference: f64,
    pub status: String,
    pub detail: String,
}

fn reconciliation_check(
    code: &str,
    name: &str,
    source: &str,
    target: &str,
    source_amount: f64,
    target_amount: f64,
    difference: f64,
    detail: String,
) -> AccountingReconciliationCheck {
    AccountingReconciliationCheck {
        code: code.to_string(),
        name: name.to_string(),
        source: source.to_string(),
        target: target.to_string(),
        source_amount,
        target_amount,
        difference,
        status: if difference.abs() < 0.01 {
            "passed".to_string()
        } else {
            "blocked".to_string()
        },
        detail,
    }
}

async fn build_accounting_reconciliation(
    pool: &DbPool,
    period_id: &str,
) -> Result<AccountingReconciliationResult, String> {
    let period: Option<(String, String)> = sqlx::query_as(
        r#"SELECT p.company_id, c.accounting_system
           FROM accounting_periods p
           JOIN companies c ON c.id = p.company_id
           WHERE p.id = ?"#,
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取勾稽账期失败: {error}"))?;
    let (company_id, accounting_system) = period.ok_or_else(|| "会计期间不存在".to_string())?;

    let balances: Vec<AccountBalance> =
        sqlx::query_as("SELECT * FROM account_balances WHERE period_id = ?")
            .bind(period_id)
            .fetch_all(pool)
            .await
            .map_err(|error| format!("读取科目余额失败: {error}"))?;

    let orphan_balances: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM account_balances b
           LEFT JOIN account_codes a ON a.company_id = ? AND a.code = b.account_code
           WHERE b.period_id = ? AND a.code IS NULL"#,
    )
    .bind(&company_id)
    .bind(period_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("检查余额科目覆盖失败: {error}"))?;
    let orphan_entries: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM voucher_entries e
           JOIN vouchers v ON v.id = e.voucher_id
           LEFT JOIN account_codes a ON a.company_id = v.company_id AND a.code = e.account_code
           WHERE v.period_id = ? AND v.company_id = ? AND v.status = 'approved'
             AND (v.is_deleted = 0 OR v.is_deleted IS NULL) AND a.code IS NULL"#,
    )
    .bind(period_id)
    .bind(&company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("检查凭证科目覆盖失败: {error}"))?;
    let orphan_count = orphan_balances + orphan_entries;

    let mut rollforward_difference = 0.0_f64;
    let mut rollforward_mismatches = 0usize;
    for balance in &balances {
        let expected_net = balance.opening_debit - balance.opening_credit + balance.period_debit
            - balance.period_credit;
        let actual_net = balance.closing_debit - balance.closing_credit;
        let difference = (expected_net - actual_net).abs();
        if difference >= 0.01 {
            rollforward_mismatches += 1;
            rollforward_difference += difference;
        }
    }

    let voucher_totals: Vec<(String, f64, f64)> = sqlx::query_as(
        r#"SELECT e.account_code,
                  CAST(SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END) AS REAL),
                  CAST(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END) AS REAL)
           FROM voucher_entries e
           JOIN vouchers v ON v.id = e.voucher_id
           WHERE v.period_id = ? AND v.company_id = ? AND v.status = 'approved'
             AND (v.is_deleted = 0 OR v.is_deleted IS NULL)
           GROUP BY e.account_code"#,
    )
    .bind(period_id)
    .bind(&company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取已审核凭证发生额失败: {error}"))?;
    let voucher_map: std::collections::HashMap<String, (f64, f64)> = voucher_totals
        .iter()
        .map(|(code, debit, credit)| (code.clone(), (*debit, *credit)))
        .collect();
    let balance_map: std::collections::HashMap<String, (f64, f64)> = balances
        .iter()
        .map(|balance| {
            (
                balance.account_code.clone(),
                (balance.period_debit, balance.period_credit),
            )
        })
        .collect();
    let account_codes: std::collections::HashSet<String> = voucher_map
        .keys()
        .chain(balance_map.keys())
        .cloned()
        .collect();
    let mut voucher_balance_difference = 0.0_f64;
    let mut voucher_balance_mismatches = 0usize;
    for code in account_codes {
        let voucher = voucher_map.get(&code).copied().unwrap_or((0.0, 0.0));
        let balance = balance_map.get(&code).copied().unwrap_or((0.0, 0.0));
        let difference = (voucher.0 - balance.0).abs() + (voucher.1 - balance.1).abs();
        if difference >= 0.01 {
            voucher_balance_mismatches += 1;
            voucher_balance_difference += difference;
        }
    }
    let voucher_debit: f64 = voucher_totals.iter().map(|(_, debit, _)| *debit).sum();
    let balance_debit: f64 = balances.iter().map(|balance| balance.period_debit).sum();

    let detail_balances: Vec<(f64, f64, f64, f64, f64, f64)> = sqlx::query_as(
        r#"SELECT b.opening_debit, b.opening_credit, b.period_debit, b.period_credit,
                  b.closing_debit, b.closing_credit
           FROM account_balances b
           JOIN account_codes a ON a.company_id = ? AND a.code = b.account_code
           WHERE b.period_id = ? AND a.is_detail = 1"#,
    )
    .bind(&company_id)
    .bind(period_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取试算平衡数据失败: {error}"))?;
    let trial_differences = detail_balances
        .iter()
        .fold([0.0_f64; 3], |mut totals, row| {
            totals[0] += row.0 - row.1;
            totals[1] += row.2 - row.3;
            totals[2] += row.4 - row.5;
            totals
        });
    let trial_difference = trial_differences
        .iter()
        .map(|value| value.abs())
        .fold(0.0_f64, f64::max);

    let mut checks = vec![
        reconciliation_check(
            "chart_coverage",
            "会计科目覆盖",
            "科目表",
            "科目余额与已审核凭证",
            0.0,
            orphan_count as f64,
            orphan_count as f64,
            if orphan_count == 0 {
                "余额和已审核凭证使用的科目均存在于当前账套科目表".to_string()
            } else {
                format!("发现 {orphan_count} 条未纳入当前会计准则科目表的记录")
            },
        ),
        reconciliation_check(
            "balance_rollforward",
            "科目余额滚存",
            "期初余额与本期发生额",
            "期末余额",
            0.0,
            rollforward_difference,
            rollforward_difference,
            if rollforward_mismatches == 0 {
                "所有科目满足期初净额加本期发生额等于期末净额".to_string()
            } else {
                format!("{rollforward_mismatches} 个科目滚存不一致")
            },
        ),
        reconciliation_check(
            "voucher_to_balance",
            "凭证与科目余额",
            "已审核凭证发生额",
            "科目余额表本期发生额",
            voucher_debit,
            balance_debit,
            voucher_balance_difference,
            if voucher_balance_mismatches == 0 {
                "已审核凭证按科目汇总后与科目余额表一致".to_string()
            } else {
                format!("{voucher_balance_mismatches} 个科目的借贷发生额不一致")
            },
        ),
        reconciliation_check(
            "trial_balance",
            "借贷试算平衡",
            "借方合计",
            "贷方合计",
            detail_balances.iter().map(|row| row.2).sum(),
            detail_balances.iter().map(|row| row.3).sum(),
            trial_difference,
            if trial_difference < 0.01 {
                "期初、本期和期末借贷合计均平衡".to_string()
            } else {
                "期初、本期或期末借贷合计不平衡".to_string()
            },
        ),
    ];

    let balance_sheet = if [
        "enterprise",
        "small_enterprise",
        "non_profit",
        "cooperative",
    ]
    .contains(&accounting_system.as_str())
    {
        let statement = build_balance_sheet(pool, period_id).await?;
        let balance_target = statement.total_liabilities + statement.total_equity;
        let balance_difference = (statement.total_assets - balance_target).abs();
        checks.push(reconciliation_check(
            "balance_sheet_equation",
            "资产负债表恒等式",
            "资产总计",
            "负债与权益合计",
            statement.total_assets,
            balance_target,
            balance_difference,
            if balance_difference < 0.01 {
                "资产总计与负债及权益合计一致".to_string()
            } else {
                "资产总计与负债及权益合计不一致".to_string()
            },
        ));
        Some(statement)
    } else {
        None
    };

    if accounting_system == "enterprise" {
        let balance_sheet = balance_sheet
            .as_ref()
            .ok_or_else(|| "企业资产负债表模板不存在".to_string())?;
        let equity_statement = build_equity_change_statement(pool, period_id).await?;
        let income_statement = build_income_statement(pool, period_id).await?;
        let equity_ending = equity_statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ400")
            .and_then(|item| item.values.last())
            .copied()
            .unwrap_or(0.0);
        let equity_difference = (equity_ending - balance_sheet.total_equity).abs();
        checks.push(reconciliation_check(
            "equity_statement_to_balance_sheet",
            "权益变动表与资产负债表",
            "所有者权益变动表年末余额",
            "资产负债表所有者权益合计",
            equity_ending,
            balance_sheet.total_equity,
            equity_difference,
            if equity_difference < 0.01 {
                "所有者权益变动表年末合计与资产负债表所有者权益合计一致".to_string()
            } else {
                "所有者权益变动表年末合计与资产负债表所有者权益合计不一致".to_string()
            },
        ));

        let unclassified_equity_change = equity_statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ300")
            .map(|item| {
                item.values
                    .iter()
                    .take(ENTERPRISE_EQUITY_COLUMNS.len())
                    .map(|value| value.abs())
                    .sum::<f64>()
            })
            .unwrap_or(0.0);
        let classification_difference = if equity_statement.classification_complete {
            0.0
        } else {
            unclassified_equity_change
        };
        checks.push(reconciliation_check(
            "equity_change_classification",
            "权益变动原因分类",
            "权益科目本年增减变动",
            "法定权益变动原因明细",
            unclassified_equity_change,
            0.0,
            classification_difference,
            if equity_statement.classification_complete {
                "权益变动已归入综合收益、资本投入、利润分配或其他法定原因".to_string()
            } else {
                "权益科目存在变动，但尚未归入综合收益、资本投入、利润分配等法定原因".to_string()
            },
        ));

        let classified_comprehensive_income = equity_statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ310")
            .and_then(|item| item.values.last())
            .copied()
            .unwrap_or(0.0);
        let reported_comprehensive_income = income_statement
            .items
            .iter()
            .find(|item| item.is_total == 1 && item.item_name.contains("综合收益总额"))
            .map(|item| item.year_to_date)
            .unwrap_or(income_statement.year_to_date_total);
        let profit_difference =
            (reported_comprehensive_income - classified_comprehensive_income).abs();
        checks.push(reconciliation_check(
            "net_profit_to_equity_classification",
            "综合收益与权益变动原因",
            "利润表本年综合收益总额",
            "权益变动表综合收益总额",
            reported_comprehensive_income,
            classified_comprehensive_income,
            profit_difference,
            if profit_difference < 0.01 {
                "利润表本年综合收益总额已与权益变动表综合收益原因勾稽".to_string()
            } else {
                "利润表本年综合收益总额尚未完整归入权益变动表综合收益原因".to_string()
            },
        ));
    }
    if accounting_system == "cooperative" {
        let balance_sheet = balance_sheet
            .as_ref()
            .ok_or_else(|| "合作社资产负债表模板不存在".to_string())?;
        let equity_statement = build_equity_change_statement(pool, period_id).await?;
        let income_statement = build_income_statement(pool, period_id).await?;
        let equity_ending = equity_statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ400")
            .and_then(|item| item.values.last())
            .copied()
            .unwrap_or(0.0);
        let equity_difference = (equity_ending - balance_sheet.total_equity).abs();
        checks.push(reconciliation_check(
            "equity_statement_to_balance_sheet",
            "成员权益变动表与资产负债表",
            "成员权益变动表年末余额",
            "资产负债表所有者权益合计",
            equity_ending,
            balance_sheet.total_equity,
            equity_difference,
            if equity_difference < 0.01 {
                "成员权益变动表年末合计与资产负债表所有者权益合计一致".to_string()
            } else {
                "成员权益变动表年末合计与资产负债表所有者权益合计不一致".to_string()
            },
        ));

        let equity_change_amount: f64 = equity_statement
            .items
            .iter()
            .filter(|item| matches!(item.item_code.as_str(), "EQ200" | "EQ300"))
            .flat_map(|item| item.values.iter().take(COOPERATIVE_EQUITY_COLUMNS.len()))
            .map(|value| value.abs())
            .sum();
        let classification_difference = if equity_statement.classification_complete {
            0.0
        } else {
            equity_change_amount
        };
        checks.push(reconciliation_check(
            "equity_change_classification",
            "成员权益变动原因分类",
            "成员权益本年增减变动",
            "法定成员权益变动原因明细",
            equity_change_amount,
            if equity_statement.classification_complete {
                equity_change_amount
            } else {
                0.0
            },
            classification_difference,
            if equity_statement.classification_complete {
                "成员权益变动已归入出资、积累、分配或其他法定原因".to_string()
            } else {
                "成员权益存在变动，但尚未完整归入法定增减原因".to_string()
            },
        ));

        let classified_surplus = equity_statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ214")
            .and_then(|item| item.values.last())
            .copied()
            .unwrap_or(0.0);
        let reported_surplus = income_statement.year_to_date_total;
        let surplus_difference = (reported_surplus - classified_surplus).abs();
        checks.push(reconciliation_check(
            "surplus_to_equity_classification",
            "本年盈余与成员权益变动",
            "盈余及盈余分配表本年盈余",
            "成员权益变动表本年盈余原因",
            reported_surplus,
            classified_surplus,
            surplus_difference,
            if surplus_difference < 0.01 {
                "本年盈余已与成员权益变动表本年盈余原因勾稽".to_string()
            } else {
                "本年盈余尚未完整归入成员权益变动表法定原因".to_string()
            },
        ));
    }
    let blocked_count = checks
        .iter()
        .filter(|check| check.status == "blocked")
        .count();
    let passed_count = checks.len() - blocked_count;

    Ok(AccountingReconciliationResult {
        period_id: period_id.to_string(),
        company_id,
        accounting_system,
        checks,
        passed_count,
        blocked_count,
        is_reconciled: blocked_count == 0,
    })
}

async fn ensure_period_reconciled(pool: &DbPool, period_id: &str) -> Result<(), String> {
    let reconciliation = build_accounting_reconciliation(pool, period_id).await?;
    if reconciliation.is_reconciled {
        return Ok(());
    }

    let blockers = reconciliation
        .checks
        .iter()
        .filter(|check| check.status == "blocked")
        .map(|check| check.name.as_str())
        .collect::<Vec<_>>()
        .join("、");
    Err(format!(
        "账簿与报表勾稽未通过，不能结账：{}",
        if blockers.is_empty() {
            "存在未通过的控制检查"
        } else {
            blockers.as_str()
        }
    ))
}

#[tauri::command]
pub async fn get_accounting_reconciliation(
    period_id: String,
    db: State<'_, Database>,
) -> Result<AccountingReconciliationResult, String> {
    build_accounting_reconciliation(db.pool(), &period_id).await
}

fn trial_balance_has_activity(values: &[f64; 8]) -> bool {
    values.iter().any(|value| value.abs() >= 0.001)
}

fn account_is_descendant(
    candidate: &str,
    ancestor: &str,
    parents: &std::collections::HashMap<String, Option<String>>,
) -> bool {
    let mut current = candidate;
    let mut visited = std::collections::HashSet::new();
    while visited.insert(current.to_string()) {
        let Some(Some(parent)) = parents.get(current) else {
            return false;
        };
        if parent == ancestor {
            return true;
        }
        current = parent;
    }
    false
}

#[tauri::command]
pub async fn get_trial_balance(
    period_id: String,
    db: State<'_, Database>,
) -> Result<TrialBalanceResult, String> {
    log::info!("Generating trial balance for period: {}", period_id);

    // Derive company_id and period info
    let period_info: (String, i32, i32) = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (company_id, period_year, period_month) = period_info;

    // Get all period IDs in the same year up to and including the current month (for YTD cumulative)
    let ytd_period_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month <= ? ORDER BY period_month",
    )
    .bind(&company_id)
    .bind(period_year)
    .bind(period_month)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Load YTD before building rows so accounts with activity in an earlier
    // month are not removed merely because the selected month is all zero.
    let ytd_placeholders = ytd_period_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let ytd_query = format!(
        "SELECT account_code, SUM(COALESCE(period_debit, 0)) as cum_debit, SUM(COALESCE(period_credit, 0)) as cum_credit FROM account_balances WHERE period_id IN ({}) GROUP BY account_code",
        ytd_placeholders
    );
    let mut ytd_query_builder = sqlx::query_as::<_, (String, f64, f64)>(&ytd_query);
    for pid in &ytd_period_ids {
        ytd_query_builder = ytd_query_builder.bind(pid);
    }
    let ytd_cumulatives: Vec<(String, f64, f64)> = ytd_query_builder
        .fetch_all(db.pool())
        .await
        .unwrap_or_default();
    let ytd_map: std::collections::HashMap<String, (f64, f64)> = ytd_cumulatives
        .into_iter()
        .map(|(code, debit, credit)| (code, (debit, credit)))
        .collect();

    // Get ALL account codes (not just detail accounts) to build hierarchical trial balance
    let all_accounts: Vec<(String, String, String, i32, Option<String>, bool)> = sqlx::query_as(
        "SELECT code, name, account_type, level, parent_code, CASE WHEN is_detail = 1 THEN 1 ELSE 0 END FROM account_codes WHERE company_id = ? AND is_enabled = 1 ORDER BY code",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get all detail-level balances for this period
    let balances: Vec<AccountBalance> =
        sqlx::query_as("SELECT * FROM account_balances WHERE period_id = ? ORDER BY account_code")
            .bind(&period_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    // Build a map of account_code -> AccountBalance
    let mut bal_map: std::collections::HashMap<String, &AccountBalance> =
        std::collections::HashMap::new();
    for bal in &balances {
        bal_map.insert(bal.account_code.clone(), bal);
    }
    let parents: std::collections::HashMap<String, Option<String>> = all_accounts
        .iter()
        .map(|(code, _, _, _, parent_code, _)| (code.clone(), parent_code.clone()))
        .collect();

    // For non-detail (parent) accounts, compute balances by summing all children
    // Children are accounts whose code starts with this parent's code AND have a longer code
    let mut items = Vec::new();

    // Only sum detail accounts for totals (avoid double-counting parent totals)
    let mut detail_totals = (
        0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64,
    );

    for (code, name, account_type, level, _, is_detail) in &all_accounts {
        let (
            opening_debit,
            opening_credit,
            period_debit,
            period_credit,
            closing_debit,
            closing_credit,
        ) = if *is_detail {
            // Detail account: use its own balance from account_balances
            if let Some(bal) = bal_map.get(code) {
                (
                    bal.opening_debit,
                    bal.opening_credit,
                    bal.period_debit,
                    bal.period_credit,
                    bal.closing_debit,
                    bal.closing_credit,
                )
            } else {
                (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
            }
        } else {
            // Parent account: sum all detail children's balances
            let mut od = 0.0;
            let mut oc = 0.0;
            let mut pd = 0.0;
            let mut pc = 0.0;
            let mut cd = 0.0;
            let mut cc = 0.0;

            for (child_code, _, _, _, _, child_is_detail) in &all_accounts {
                if !child_is_detail {
                    continue;
                }
                if account_is_descendant(child_code, code, &parents) {
                    if let Some(bal) = bal_map.get(child_code) {
                        od += bal.opening_debit;
                        oc += bal.opening_credit;
                        pd += bal.period_debit;
                        pc += bal.period_credit;
                        cd += bal.closing_debit;
                        cc += bal.closing_credit;
                    }
                }
            }
            (od, oc, pd, pc, cd, cc)
        };

        let (cumulative_debit, cumulative_credit) = if *is_detail {
            ytd_map.get(code).copied().unwrap_or((0.0, 0.0))
        } else {
            let mut debit = 0.0;
            let mut credit = 0.0;
            for (child_code, _, _, _, _, child_is_detail) in &all_accounts {
                if *child_is_detail && account_is_descendant(child_code, code, &parents) {
                    if let Some((child_debit, child_credit)) = ytd_map.get(child_code) {
                        debit += child_debit;
                        credit += child_credit;
                    }
                }
            }
            (debit, credit)
        };

        if !trial_balance_has_activity(&[
            opening_debit,
            opening_credit,
            period_debit,
            period_credit,
            cumulative_debit,
            cumulative_credit,
            closing_debit,
            closing_credit,
        ]) {
            continue;
        }

        // Track detail-level totals for balance check
        if *is_detail {
            detail_totals.0 += opening_debit;
            detail_totals.1 += opening_credit;
            detail_totals.2 += period_debit;
            detail_totals.3 += period_credit;
            detail_totals.4 += cumulative_debit;
            detail_totals.5 += cumulative_credit;
            detail_totals.6 += closing_debit;
            detail_totals.7 += closing_credit;
        }

        items.push(TrialBalanceItem {
            account_code: code.clone(),
            account_name: name.clone(),
            account_type: account_type.clone(),
            account_level: *level,
            is_detail: *is_detail,
            opening_debit,
            opening_credit,
            period_debit,
            period_credit,
            cumulative_debit,
            cumulative_credit,
            closing_debit,
            closing_credit,
        });
    }

    // Use detail-level totals for the official totals and balance check
    let total_od: f64 = detail_totals.0;
    let total_oc: f64 = detail_totals.1;
    let total_pd: f64 = detail_totals.2;
    let total_pc: f64 = detail_totals.3;
    let total_cud: f64 = detail_totals.4;
    let total_cuc: f64 = detail_totals.5;
    let total_cd: f64 = detail_totals.6;
    let total_cc: f64 = detail_totals.7;

    let is_balanced = (total_od - total_oc).abs() < 0.01
        && (total_cd - total_cc).abs() < 0.01
        && (total_pd - total_pc).abs() < 0.01;

    Ok(TrialBalanceResult {
        items,
        total_opening_debit: total_od,
        total_opening_credit: total_oc,
        total_period_debit: total_pd,
        total_period_credit: total_pc,
        total_cumulative_debit: total_cud,
        total_cumulative_credit: total_cuc,
        total_closing_debit: total_cd,
        total_closing_credit: total_cc,
        is_balanced,
    })
}

#[tauri::command]
pub async fn get_account_balances(
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountBalance>, String> {
    // Verify the period belongs to the user's company
    let owner: Option<(String,)> =
        sqlx::query_as("SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?")
            .bind(&period_id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
    }

    let balances: Vec<AccountBalance> =
        sqlx::query_as("SELECT * FROM account_balances WHERE period_id = ? ORDER BY account_code")
            .bind(&period_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    Ok(balances)
}

// ==================== Initial Balances ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct InitialBalanceValidation {
    pub total_debit: f64,
    pub total_credit: f64,
    pub is_balanced: bool,
    pub message: String,
}

#[tauri::command]
pub async fn save_initial_balance(
    input: SaveInitialBalanceInput,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    log::info!("Saving initial balance for account: {}", input.account_code);

    // Verify the period belongs to the user's company
    if !input.opening_debit.is_finite()
        || !input.opening_credit.is_finite()
        || input.opening_debit < 0.0
        || input.opening_credit < 0.0
        || (input.opening_debit > 0.001 && input.opening_credit > 0.001)
    {
        return Err("期初余额必须为非负数，且同一科目只能登记借方或贷方一侧".to_string());
    }

    let owner: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT status, initial_balances_finalized_at FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
            .bind(&input.period_id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let Some((status, finalized_at)) = owner else {
        return Err("会计期间不存在或不属于当前公司".to_string());
    };
    if status != "open" {
        return Err("已结账期间不能修改期初余额".to_string());
    }
    if finalized_at.is_some() {
        return Err("期初余额已确认，不能继续修改".to_string());
    }

    let is_detail: Option<i32> = sqlx::query_scalar(
        "SELECT is_detail FROM account_codes WHERE company_id = ? AND code = ? AND is_enabled = 1",
    )
    .bind(&company_id)
    .bind(&input.account_code)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if is_detail != Some(1) {
        return Err("期初余额只能登记到当前账套的已启用末级科目".to_string());
    }

    sqlx::query(
        r#"
        INSERT INTO initial_balances (id, period_id, account_code, opening_debit, opening_credit, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(period_id, account_code) DO UPDATE SET
            opening_debit = excluded.opening_debit,
            opening_credit = excluded.opening_credit,
            updated_at = datetime('now')
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.period_id)
    .bind(&input.account_code)
    .bind(input.opening_debit)
    .bind(input.opening_credit)
    .bind(&actor)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to save initial balance: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn validate_initial_balances(
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<InitialBalanceValidation, String> {
    // Verify the period belongs to the user's company
    let owner: Option<(String,)> =
        sqlx::query_as("SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?")
            .bind(&period_id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
    }

    let balances: Vec<(String, f64, f64, i32)> = sqlx::query_as(
        r#"SELECT ib.account_code, ib.opening_debit, ib.opening_credit,
                  COALESCE(ac.is_detail, 0)
           FROM initial_balances ib
           LEFT JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ib.account_code AND ac.is_enabled = 1
           WHERE ib.period_id = ?"#,
    )
    .bind(&company_id)
    .bind(&period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let total_debit: f64 = balances.iter().map(|(_, debit, _, _)| *debit).sum();
    let total_credit: f64 = balances.iter().map(|(_, _, credit, _)| *credit).sum();
    let invalid_accounts: Vec<&str> = balances
        .iter()
        .filter(|(_, debit, credit, is_detail)| {
            *is_detail != 1
                || !debit.is_finite()
                || !credit.is_finite()
                || *debit < 0.0
                || *credit < 0.0
                || (*debit > 0.001 && *credit > 0.001)
        })
        .map(|(code, _, _, _)| code.as_str())
        .collect();
    let is_balanced = invalid_accounts.is_empty() && (total_debit - total_credit).abs() < 0.01;

    Ok(InitialBalanceValidation {
        total_debit,
        total_credit,
        is_balanced,
        message: if !invalid_accounts.is_empty() {
            format!(
                "存在非末级、无效或借贷双边期初余额科目: {}",
                invalid_accounts.join("、")
            )
        } else if is_balanced {
            "期初余额试算平衡".to_string()
        } else {
            format!(
                "期初余额试算不平衡: 借方 {} ≠ 贷方 {}",
                total_debit, total_credit
            )
        },
    })
}

#[tauri::command]
pub async fn finalize_initial_balances(
    period_id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    finalize_initial_balances_record(period_id, company_id, &actor, db.pool()).await
}

async fn finalize_initial_balances_record(
    period_id: String,
    company_id: String,
    actor: &str,
    pool: &DbPool,
) -> Result<(), String> {
    log::info!("Finalizing initial balances for period: {}", period_id);
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start initial balance transaction: {}", e))?;

    // Verify the period belongs to the user's company
    let owner: Option<(String, Option<String>, i32, i32)> = sqlx::query_as(
        "SELECT status, initial_balances_finalized_at, period_year, period_month FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
            .bind(&period_id)
            .bind(&company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let Some((status, finalized_at, period_year, period_month)) = owner else {
        return Err("会计期间不存在或不属于当前公司".to_string());
    };
    if status != "open" {
        return Err("已结账期间不能确认期初余额".to_string());
    }
    if finalized_at.is_some() {
        return Err("期初余额已确认，不能重复确认".to_string());
    }

    // Copy initial_balances to account_balances
    let initials: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT account_code, opening_debit, opening_credit FROM initial_balances WHERE period_id = ?",
    )
    .bind(&period_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let total_debit: f64 = initials.iter().map(|(_, debit, _)| *debit).sum();
    let total_credit: f64 = initials.iter().map(|(_, _, credit)| *credit).sum();
    if (total_debit - total_credit).abs() >= 0.01 {
        return Err("期初余额试算不平衡，无法完成建账".to_string());
    }

    let invalid_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM initial_balances ib
           LEFT JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ib.account_code AND ac.is_enabled = 1
           WHERE ib.period_id = ?
             AND (COALESCE(ac.is_detail, 0) <> 1
                  OR ib.opening_debit < 0 OR ib.opening_credit < 0
                  OR (ib.opening_debit > 0.001 AND ib.opening_credit > 0.001))"#,
    )
    .bind(&company_id)
    .bind(&period_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if invalid_count > 0 {
        return Err("存在非末级、无效或借贷双边期初余额，无法完成建账".to_string());
    }

    for (code, debit, credit) in &initials {
        sqlx::query(
            r#"
            INSERT INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
            ON CONFLICT(period_id, account_code) DO UPDATE SET
                opening_debit = excluded.opening_debit,
                opening_credit = excluded.opening_credit,
                closing_debit = excluded.opening_debit,
                closing_credit = excluded.opening_credit
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&period_id)
        .bind(code)
        .bind(debit)
        .bind(credit)
        .bind(debit)
        .bind(credit)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to write balance: {}", e))?;
        crate::commands::vouchers::recompute_account_closing_balance(
            &period_id,
            code,
            &mut transaction,
        )
        .await?;
    }

    sqlx::query(
        "UPDATE accounting_periods SET initial_balances_finalized_at = datetime('now'), initial_balances_finalized_by = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?",
    )
    .bind(actor)
    .bind(&period_id)
    .bind(&company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to lock initial balances: {}", e))?;

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '期初余额', '确认期初余额', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&company_id)
    .bind(format!("{period_year:04}-{period_month:02}"))
    .bind(format!(
        "已确认 {} 个末级科目的期初余额并锁定后续修改",
        initials.len()
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to write initial balance audit log: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit initial balances: {}", e))?;

    log::info!("Initial balances finalized for period: {}", period_id);
    Ok(())
}

// ==================== Voucher Words ====================

use crate::db::VoucherWord;

#[tauri::command]
pub async fn get_voucher_words(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherWord>, String> {
    let words: Vec<VoucherWord> = sqlx::query_as(
        "SELECT * FROM voucher_words WHERE company_id = ? AND is_enabled = 1 ORDER BY word_code",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(words)
}

// ==================== Ledger & Reports ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneralLedgerEntry {
    pub voucher_id: String,
    pub voucher_number: String,
    pub voucher_date: String,
    pub summary: String,
    pub source_account_code: String,
    pub source_account_name: String,
    pub direction: String,
    pub amount: f64,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneralLedgerItem {
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub entries: Vec<GeneralLedgerEntry>,
    pub opening_debit: f64,
    pub opening_credit: f64,
    pub period_debit: f64,
    pub period_credit: f64,
    pub closing_debit: f64,
    pub closing_credit: f64,
}

type GeneralLedgerAccountRow = (String, String, String, String, i32, Option<String>, bool);

type GeneralLedgerVoucherRow = (
    String,
    String,
    String,
    Option<String>,
    String,
    f64,
    String,
    String,
);

fn root_account_code(
    account_code: &str,
    parents: &std::collections::HashMap<String, Option<String>>,
) -> String {
    let mut current = account_code.to_string();
    let mut visited = std::collections::HashSet::new();
    while visited.insert(current.clone()) {
        let Some(Some(parent)) = parents.get(&current) else {
            break;
        };
        current = parent.clone();
    }
    current
}

fn split_balance_sides(debit: f64, credit: f64) -> (f64, f64) {
    let net = debit - credit;
    if net > 0.001 {
        (net, 0.0)
    } else if net < -0.001 {
        (0.0, -net)
    } else {
        (0.0, 0.0)
    }
}

async fn build_general_ledger(
    pool: &DbPool,
    period_id: &str,
    account_type: Option<&str>,
) -> Result<Vec<GeneralLedgerItem>, String> {
    let company_id: String =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(period_id)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let accounts: Vec<GeneralLedgerAccountRow> = sqlx::query_as(
        r#"SELECT code, name, account_type, normal_balance, level, parent_code,
                  CASE WHEN is_detail = 1 THEN 1 ELSE 0 END
           FROM account_codes
           WHERE company_id = ? AND is_enabled = 1
           ORDER BY level, code"#,
    )
    .bind(&company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let parents: std::collections::HashMap<String, Option<String>> = accounts
        .iter()
        .map(|(code, _, _, _, _, parent, _)| (code.clone(), parent.clone()))
        .collect();
    let account_info: std::collections::HashMap<String, (String, String, String, i32, bool)> =
        accounts
            .iter()
            .map(|(code, name, kind, normal, level, _, is_detail)| {
                (
                    code.clone(),
                    (
                        name.clone(),
                        kind.clone(),
                        normal.clone(),
                        *level,
                        *is_detail,
                    ),
                )
            })
            .collect();

    let balances: Vec<AccountBalance> = sqlx::query_as(
        r#"SELECT ab.*
           FROM account_balances ab
           JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ab.account_code
           WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1
           ORDER BY ab.account_code"#,
    )
    .bind(&company_id)
    .bind(period_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let voucher_rows: Vec<GeneralLedgerVoucherRow> = sqlx::query_as(
        r#"SELECT v.id, v.voucher_date, v.voucher_number, ve.summary,
                  ve.direction, ve.amount, ve.account_code, ac.name
           FROM voucher_entries ve
           JOIN vouchers v ON ve.voucher_id = v.id
           JOIN account_codes ac
             ON ac.company_id = v.company_id AND ac.code = ve.account_code
           WHERE v.period_id = ? AND v.status = 'approved' AND v.company_id = ?
             AND ac.is_enabled = 1 AND ac.is_detail = 1
             AND (v.is_deleted = 0 OR v.is_deleted IS NULL)
           ORDER BY v.voucher_date, v.sequence_num, ve.line_num"#,
    )
    .bind(period_id)
    .bind(&company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut grouped_balances: std::collections::HashMap<String, [f64; 6]> =
        std::collections::HashMap::new();
    for balance in balances {
        let root = root_account_code(&balance.account_code, &parents);
        let totals = grouped_balances.entry(root).or_insert([0.0; 6]);
        totals[0] += balance.opening_debit;
        totals[1] += balance.opening_credit;
        totals[2] += balance.period_debit;
        totals[3] += balance.period_credit;
        totals[4] += balance.closing_debit;
        totals[5] += balance.closing_credit;
    }

    let mut grouped_entries: std::collections::HashMap<String, Vec<GeneralLedgerVoucherRow>> =
        std::collections::HashMap::new();
    for row in voucher_rows {
        let root = root_account_code(&row.6, &parents);
        grouped_entries.entry(root).or_default().push(row);
    }

    let mut items = Vec::new();
    let mut roots: Vec<String> = grouped_balances
        .keys()
        .chain(grouped_entries.keys())
        .cloned()
        .collect();
    roots.sort();
    roots.dedup();
    for root in roots {
        let Some((name, kind, normal_balance, _, _)) = account_info.get(&root) else {
            continue;
        };
        if account_type.is_some_and(|filter| filter != kind) {
            continue;
        }
        let totals = grouped_balances.get(&root).copied().unwrap_or([0.0; 6]);
        let (opening_debit, opening_credit) = split_balance_sides(totals[0], totals[1]);
        let (closing_debit, closing_credit) = split_balance_sides(totals[4], totals[5]);
        let is_debit_normal = normal_balance == "debit";
        let mut running = if is_debit_normal {
            opening_debit - opening_credit
        } else {
            opening_credit - opening_debit
        };
        let mut entries = Vec::new();
        for (vid, vdate, vnum, summary, direction, amount, source_code, source_name) in
            grouped_entries.remove(&root).unwrap_or_default()
        {
            running += if (direction == "debit") == is_debit_normal {
                amount
            } else {
                -amount
            };
            entries.push(GeneralLedgerEntry {
                voucher_id: vid,
                voucher_number: vnum,
                voucher_date: vdate,
                summary: summary.unwrap_or_default(),
                source_account_code: source_code,
                source_account_name: source_name,
                direction,
                amount,
                balance: running,
            });
        }

        items.push(GeneralLedgerItem {
            account_code: root,
            account_name: name.clone(),
            account_type: kind.clone(),
            entries,
            opening_debit,
            opening_credit,
            period_debit: totals[2],
            period_credit: totals[3],
            closing_debit,
            closing_credit,
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn get_general_ledger(
    period_id: String,
    account_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<GeneralLedgerItem>, String> {
    build_general_ledger(db.pool(), &period_id, account_type.as_deref()).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubsidiaryLedgerItem {
    pub voucher_id: String,
    pub voucher_date: String,
    pub voucher_number: String,
    pub summary: String,
    pub opposite_account: String,
    pub debit: f64,
    pub credit: f64,
    pub balance: f64,
    pub balance_direction: String,
}

fn subsidiary_balance_direction(is_debit_normal: bool, running_balance: f64) -> String {
    if running_balance.abs() < 0.001 {
        return "平".to_string();
    }
    match (is_debit_normal, running_balance.is_sign_positive()) {
        (true, true) | (false, false) => "借".to_string(),
        (true, false) | (false, true) => "贷".to_string(),
    }
}

async fn build_subsidiary_ledger(
    pool: &DbPool,
    period_id: &str,
    account_code: &str,
) -> Result<Vec<SubsidiaryLedgerItem>, String> {
    let company_id: String =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(period_id)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let acct: Option<(String, String)> = sqlx::query_as(
        "SELECT name, normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(&company_id)
    .bind(account_code)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if acct.is_none() {
        return Err("科目不存在或不属于当前账套".to_string());
    }

    let is_debit_normal = acct.as_ref().map(|(_, nb)| nb == "debit").unwrap_or(true);

    let opening: Option<(f64, f64)> = sqlx::query_as(
        "SELECT opening_debit, opening_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
    )
    .bind(period_id)
    .bind(account_code)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut running_balance = if is_debit_normal {
        opening.map(|(d, c)| d - c).unwrap_or(0.0)
    } else {
        opening.map(|(d, c)| c - d).unwrap_or(0.0)
    };

    let mut items = Vec::new();

    if running_balance.abs() > 0.001 {
        items.push(SubsidiaryLedgerItem {
            voucher_id: String::new(),
            voucher_date: String::new(),
            voucher_number: String::new(),
            summary: "期初余额".to_string(),
            opposite_account: String::new(),
            debit: 0.0,
            credit: 0.0,
            balance: running_balance.abs(),
            balance_direction: subsidiary_balance_direction(is_debit_normal, running_balance),
        });
    }

    let entries: Vec<SubsidiaryLedgerRow> = sqlx::query_as(
        r#"SELECT v.id, v.voucher_date, v.voucher_number, ve.summary, ve.direction, ve.amount,
           (SELECT GROUP_CONCAT(ve2.account_code, ',') FROM voucher_entries ve2
            WHERE ve2.voucher_id = ve.voucher_id AND ve2.direction != ve.direction AND ve2.account_code != ?)
           FROM voucher_entries ve
           JOIN vouchers v ON ve.voucher_id = v.id
           WHERE v.period_id = ? AND ve.account_code = ? AND v.status = 'approved' AND v.company_id = ? AND (v.is_deleted = 0 OR v.is_deleted IS NULL)
           ORDER BY v.voucher_date, v.sequence_num, ve.line_num"#,
    )
    .bind(account_code)
    .bind(period_id)
    .bind(account_code)
    .bind(&company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (voucher_id, date, number, summary, direction, amount, opposite) in entries {
        let debit = if direction == "debit" { amount } else { 0.0 };
        let credit = if direction == "credit" { amount } else { 0.0 };

        if is_debit_normal {
            running_balance += debit - credit;
        } else {
            running_balance += credit - debit;
        }

        items.push(SubsidiaryLedgerItem {
            voucher_id,
            voucher_date: date,
            voucher_number: number,
            summary: summary.unwrap_or_default(),
            opposite_account: opposite.unwrap_or_default(),
            debit,
            credit,
            balance: running_balance.abs(),
            balance_direction: subsidiary_balance_direction(is_debit_normal, running_balance),
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn get_subsidiary_ledger(
    period_id: String,
    account_code: String,
    db: State<'_, Database>,
) -> Result<Vec<SubsidiaryLedgerItem>, String> {
    log::info!(
        "Generating subsidiary ledger for account {} in period {}",
        account_code,
        period_id
    );
    build_subsidiary_ledger(db.pool(), &period_id, &account_code).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceSheetResult {
    pub period_id: String,
    pub template_name: String,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: bool,
    pub items: Vec<BalanceSheetItem>,
    pub total_assets: f64,
    pub total_liabilities: f64,
    pub total_equity: f64,
    pub opening_total_assets: f64,
    pub opening_total_liabilities: f64,
    pub opening_total_equity: f64,
    pub is_balanced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceSheetItem {
    pub item_code: String,
    pub item_name: String,
    pub line_number: Option<String>,
    pub item_level: i32,
    pub is_total: i32,
    pub opening_balance: f64,
    pub ending_balance: f64,
    pub section: String,
}

fn finalize_balance_sheet_totals(items: &mut [BalanceSheetItem]) -> (f64, f64, f64, f64, f64, f64) {
    let amount = |code: &str| {
        items
            .iter()
            .find(|item| item.item_code == code)
            .map(|item| (item.ending_balance, item.opening_balance))
            .unwrap_or((0.0, 0.0))
    };
    let (total_assets, opening_total_assets) = amount("BS999");
    let (total_liabilities, opening_total_liabilities) = amount("BS599");
    let (total_equity, opening_total_equity) = amount("BS699");

    if let Some(combined) = items.iter_mut().find(|item| item.item_code == "BS799") {
        combined.ending_balance = total_liabilities + total_equity;
        combined.opening_balance = opening_total_liabilities + opening_total_equity;
    }

    (
        total_assets,
        total_liabilities,
        total_equity,
        opening_total_assets,
        opening_total_liabilities,
        opening_total_equity,
    )
}

async fn build_balance_sheet(pool: &DbPool, period_id: &str) -> Result<BalanceSheetResult, String> {
    // Derive company_id from period
    let company_id: String =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(period_id)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let template = find_report_template_for_company(pool, &company_id, "balance_sheet").await?;
    let template_id = template.id.clone();

    let report_items: Vec<ReportTemplateItemRow> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula, line_number, calculation_sign FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Evaluate formulas for ending balance
    let mut raw_items: Vec<(String, String, Option<String>, i32, i32, f64, f64, String)> =
        Vec::new();
    let mut level_sums: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    let mut opening_level_sums: std::collections::HashMap<i32, f64> =
        std::collections::HashMap::new();
    let mut current_section = "";

    for (_id, item_code, item_name, level, _sort, is_total, formula, line_number, _sign) in
        &report_items
    {
        let section = if item_code.starts_with("BS1") || item_code.starts_with("BS2") {
            "asset"
        } else if item_code.starts_with("BS3")
            || item_code.starts_with("BS4")
            || item_code.starts_with("BS5")
        {
            "liability"
        } else if item_code.starts_with("BS6") || item_code.starts_with("BS7") {
            "equity"
        } else {
            "asset"
        };

        // Reset all level sums on section change
        if current_section != section {
            level_sums.clear();
            opening_level_sums.clear();
            current_section = section;
        }

        let (ending_amount, opening_amount) = if let Some(f) = formula {
            let ending = evaluate_formula(f, &company_id, period_id, pool).await;
            let opening = evaluate_statement_formula(
                f,
                &company_id,
                period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::OpeningBalance,
                pool,
            )
            .await;
            if is_total == &0 {
                *level_sums.entry(*level).or_insert(0.0) += ending;
                *opening_level_sums.entry(*level).or_insert(0.0) += opening;
            }
            (ending, opening)
        } else if is_total == &1 {
            let ending_total = level_sums.get(level).copied().unwrap_or(0.0);
            let opening_total = opening_level_sums.get(level).copied().unwrap_or(0.0);
            level_sums.insert(*level, 0.0);
            opening_level_sums.insert(*level, 0.0);
            *level_sums.entry(*level - 1).or_insert(0.0) += ending_total;
            *opening_level_sums.entry(*level - 1).or_insert(0.0) += opening_total;
            (ending_total, opening_total)
        } else {
            (0.0, 0.0)
        };

        raw_items.push((
            item_code.clone(),
            item_name.clone(),
            line_number.clone(),
            *level,
            *is_total,
            ending_amount,
            opening_amount,
            section.to_string(),
        ));
    }

    let mut items: Vec<BalanceSheetItem> = raw_items
        .into_iter()
        .map(
            |(
                item_code,
                item_name,
                line_number,
                item_level,
                is_total,
                ending_balance,
                opening_balance,
                section,
            )| {
                BalanceSheetItem {
                    item_code,
                    item_name,
                    line_number,
                    item_level,
                    is_total,
                    opening_balance,
                    ending_balance,
                    section,
                }
            },
        )
        .collect();
    let (
        total_assets,
        total_liabilities,
        total_equity,
        opening_total_assets,
        opening_total_liabilities,
        opening_total_equity,
    ) = finalize_balance_sheet_totals(&mut items);

    let is_balanced = (total_assets - total_liabilities - total_equity).abs() < 0.01;

    Ok(BalanceSheetResult {
        period_id: period_id.to_string(),
        template_name: template.template_name,
        accounting_system: template.accounting_system,
        form_code: template.form_code,
        reporting_frequency: template.reporting_frequency,
        is_statutory: template.is_statutory != 0,
        items,
        total_assets,
        total_liabilities,
        total_equity,
        opening_total_assets,
        opening_total_liabilities,
        opening_total_equity,
        is_balanced,
    })
}

#[tauri::command]
pub async fn get_balance_sheet(
    period_id: String,
    db: State<'_, Database>,
) -> Result<BalanceSheetResult, String> {
    log::info!("Generating balance sheet for period: {}", period_id);
    build_balance_sheet(db.pool(), &period_id).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomeStatementResult {
    pub period_id: String,
    pub template_name: String,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: bool,
    pub column_basis: String,
    pub has_comparative_period: bool,
    pub classification_complete: bool,
    pub items: Vec<IncomeStatementItem>,
    pub current_period_total: f64,
    pub year_to_date_total: f64,
    pub comparative_period_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomeStatementItem {
    pub item_code: String,
    pub item_name: String,
    pub line_number: Option<String>,
    pub item_level: i32,
    pub is_total: i32,
    pub current_amount: f64,
    pub year_to_date: f64,
    pub comparative_amount: f64,
    pub current_unrestricted_amount: f64,
    pub current_restricted_amount: f64,
    pub ytd_unrestricted_amount: f64,
    pub ytd_restricted_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityChangeResult {
    pub period_id: String,
    pub template_name: String,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: bool,
    pub layout: String,
    pub columns: Vec<EquityChangeColumn>,
    pub has_comparative_period: bool,
    pub classification_complete: bool,
    pub comparative_classification_complete: bool,
    pub items: Vec<EquityChangeItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityChangeColumn {
    pub column_code: String,
    pub column_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityChangeItem {
    pub item_code: String,
    pub item_name: String,
    pub line_number: Option<String>,
    pub item_level: i32,
    pub is_total: i32,
    pub opening_balance: f64,
    pub current_increase: f64,
    pub current_decrease: f64,
    pub ending_balance: f64,
    pub values: Vec<f64>,
    pub comparative_values: Vec<f64>,
}

type EquityColumnSpec = (&'static str, &'static str, &'static str, f64);

const ENTERPRISE_EQUITY_COLUMNS: [EquityColumnSpec; 8] = [
    ("paid_in_capital", "实收资本（或股本）", "4001", 1.0),
    ("other_equity_instruments", "其他权益工具", "4401", 1.0),
    ("capital_reserve", "资本公积", "4002", 1.0),
    ("treasury_stock", "减：库存股", "4201", -1.0),
    ("other_comprehensive_income", "其他综合收益", "4003", 1.0),
    ("special_reserve", "专项储备", "4301", 1.0),
    ("surplus_reserve", "盈余公积", "4101", 1.0),
    ("retained_earnings", "未分配利润", "4103+4104", 1.0),
];

const COOPERATIVE_EQUITY_COLUMNS: [EquityColumnSpec; 5] = [
    ("member_capital", "股金", "301", 1.0),
    ("special_fund", "专项基金", "311", 1.0),
    ("capital_reserve", "资本公积", "321", 1.0),
    ("surplus_reserve", "盈余公积", "322", 1.0),
    ("undistributed_surplus", "未分配盈余", "331+332", 1.0),
];

const ENTERPRISE_EQUITY_AGGREGATE_ROWS: [(&str, &[&str]); 4] = [
    ("EQ320", &["EQ321", "EQ322", "EQ323", "EQ324"]),
    ("EQ330", &["EQ331", "EQ332", "EQ333"]),
    (
        "EQ340",
        &["EQ341", "EQ342", "EQ343", "EQ344", "EQ345", "EQ346"],
    ),
    ("EQ350", &["EQ351", "EQ352"]),
];
const ENTERPRISE_EQUITY_SUMMARY_ROWS: [&str; 6] =
    ["EQ310", "EQ320", "EQ330", "EQ340", "EQ350", "EQ360"];
const COOPERATIVE_EQUITY_SUMMARY_ROWS: [&str; 18] = [
    "EQ210", "EQ211", "EQ212", "EQ213", "EQ214", "EQ215", "EQ216", "EQ217", "EQ218", "EQ219",
    "EQ310", "EQ311", "EQ312", "EQ313", "EQ314", "EQ315", "EQ316", "EQ317",
];

#[derive(Debug, sqlx::FromRow)]
struct EquityChangeMappingRuleRow {
    source_account_code: String,
    equity_direction: String,
    equity_change_item_code: String,
    summary_keyword: Option<String>,
    priority: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct EquityChangeVoucherEntryRow {
    voucher_summary: Option<String>,
    account_code: String,
    direction: String,
    amount: f64,
    entry_summary: Option<String>,
}

#[derive(Debug, Default)]
struct EquityChangeClassification {
    amounts: std::collections::HashMap<String, Vec<f64>>,
    unmapped_amount: f64,
    conflict_count: i64,
}

async fn classify_equity_change_vouchers(
    pool: &DbPool,
    company_id: &str,
    period_year: i32,
    period_month: i32,
    template_id: &str,
    columns: &[EquityColumnSpec],
) -> Result<EquityChangeClassification, String> {
    let rules: Vec<EquityChangeMappingRuleRow> = sqlx::query_as(
        r#"SELECT source_account_code, cash_direction AS equity_direction,
                  cash_flow_item_code AS equity_change_item_code,
                  summary_keyword, priority
           FROM matching_rules
           WHERE company_id = ? AND rule_scope = 'equity_change' AND is_enabled = 1
             AND source_account_code IS NOT NULL AND trim(source_account_code) <> ''
             AND cash_direction IN ('increase', 'decrease')
             AND cash_flow_item_code IS NOT NULL AND trim(cash_flow_item_code) <> ''
           ORDER BY priority DESC, name, id"#,
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取权益变动映射失败: {error}"))?;
    let valid_items: std::collections::HashSet<String> = sqlx::query_scalar(
        r#"SELECT item_code FROM report_items
           WHERE template_id = ? AND item_code LIKE 'EQ%'
             AND item_level >= 2 AND is_total = 0"#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取权益变动明细项目失败: {error}"))?
    .into_iter()
    .collect();
    let account_rows: Vec<(String, Option<String>, String)> = sqlx::query_as(
        "SELECT code, parent_code, normal_balance FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取权益科目层级失败: {error}"))?;
    let parents: std::collections::HashMap<String, Option<String>> = account_rows
        .iter()
        .map(|(code, parent, _)| (code.clone(), parent.clone()))
        .collect();
    let normal_balances: std::collections::HashMap<String, String> = account_rows
        .into_iter()
        .map(|(code, _, normal)| (code, normal))
        .collect();
    let column_roots: Vec<Vec<String>> = columns
        .iter()
        .map(|(_, _, formula, _)| formula_account_codes(formula))
        .collect();
    let entries: Vec<EquityChangeVoucherEntryRow> = sqlx::query_as(
        r#"SELECT voucher.summary AS voucher_summary, entry.account_code,
                  entry.direction, entry.amount, entry.summary AS entry_summary
           FROM vouchers voucher
           JOIN accounting_periods period ON period.id = voucher.period_id
           JOIN voucher_entries entry ON entry.voucher_id = voucher.id
           WHERE voucher.company_id = ? AND period.period_year = ? AND period.period_month <= ?
             AND voucher.status = 'approved' AND COALESCE(voucher.is_deleted, 0) = 0
           ORDER BY period.period_month, voucher.sequence_num, entry.line_num"#,
    )
    .bind(company_id)
    .bind(period_year)
    .bind(period_month)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取权益变动凭证失败: {error}"))?;

    let mut result = EquityChangeClassification::default();
    for entry in entries {
        let Some(column_index) = column_roots.iter().position(|roots| {
            roots
                .iter()
                .any(|root| account_is_under(&entry.account_code, root, &parents))
        }) else {
            continue;
        };
        let normal_balance = normal_balances
            .get(&entry.account_code)
            .map(String::as_str)
            .unwrap_or("credit");
        let normal_activity = match (normal_balance, entry.direction.as_str()) {
            ("credit", "credit") | ("debit", "debit") => entry.amount,
            _ => -entry.amount,
        };
        let signed_change = normal_activity * columns[column_index].3;
        if signed_change.abs() < 0.005 {
            continue;
        }
        let equity_direction = if signed_change > 0.0 {
            "increase"
        } else {
            "decrease"
        };
        let summary = [
            entry.voucher_summary.as_deref(),
            entry.entry_summary.as_deref(),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
        let candidates: Vec<&EquityChangeMappingRuleRow> = rules
            .iter()
            .filter(|rule| {
                rule.equity_direction == equity_direction
                    && valid_items.contains(&rule.equity_change_item_code)
                    && account_is_under(&entry.account_code, &rule.source_account_code, &parents)
                    && rule
                        .summary_keyword
                        .as_deref()
                        .map(str::trim)
                        .filter(|keyword| !keyword.is_empty())
                        .map(|keyword| summary.contains(&keyword.to_lowercase()))
                        .unwrap_or(true)
            })
            .collect();
        let target = candidates.first().and_then(|first| {
            let top_targets: std::collections::HashSet<&str> = candidates
                .iter()
                .take_while(|candidate| candidate.priority == first.priority)
                .map(|candidate| candidate.equity_change_item_code.as_str())
                .collect();
            (top_targets.len() == 1).then(|| first.equity_change_item_code.as_str())
        });
        if let Some(target) = target {
            let values = result
                .amounts
                .entry(target.to_string())
                .or_insert_with(|| vec![0.0; columns.len() + 1]);
            values[column_index] += signed_change;
            values[columns.len()] += signed_change;
        } else {
            result.unmapped_amount += signed_change.abs();
            if !candidates.is_empty() {
                result.conflict_count += 1;
            }
        }
    }
    Ok(result)
}

fn sum_equity_classification_rows(
    amounts: &std::collections::HashMap<String, Vec<f64>>,
    codes: &[&str],
    column_count: usize,
) -> Vec<f64> {
    let mut total = vec![0.0; column_count + 1];
    for code in codes {
        if let Some(values) = amounts.get(*code) {
            for (target, value) in total.iter_mut().zip(values) {
                *target += value;
            }
        }
    }
    total
}

struct EquityMatrix {
    opening_values: Vec<f64>,
    ending_values: Vec<f64>,
    change_values: Vec<f64>,
    classification_amounts: std::collections::HashMap<String, Vec<f64>>,
    classification_complete: bool,
}

async fn build_equity_matrix(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    period_year: i32,
    period_month: i32,
    template_id: &str,
    columns: &[EquityColumnSpec],
    aggregate_rows: &[(&str, &[&str])],
    classified_summary_rows: &[&str],
) -> Result<EquityMatrix, String> {
    let opening_period_id: String = sqlx::query_scalar(
        r#"SELECT id FROM accounting_periods
           WHERE company_id = ? AND period_year = ?
           ORDER BY period_month ASC LIMIT 1"#,
    )
    .bind(company_id)
    .bind(period_year)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("读取权益变动表年初期间失败: {error}"))?;
    let mut opening_values = Vec::with_capacity(columns.len() + 1);
    let mut ending_values = Vec::with_capacity(columns.len() + 1);
    for (_, _, formula, sign) in columns {
        let opening = evaluate_statement_formula(
            formula,
            company_id,
            &opening_period_id,
            FormulaPeriodScope::Current,
            BareFormulaMeasure::OpeningBalance,
            pool,
        )
        .await;
        let ending = evaluate_formula(formula, company_id, period_id, pool).await;
        opening_values.push(opening * sign);
        ending_values.push(ending * sign);
    }
    opening_values.push(opening_values.iter().sum());
    ending_values.push(ending_values.iter().sum());
    let change_values: Vec<f64> = ending_values
        .iter()
        .zip(&opening_values)
        .map(|(ending, opening)| ending - opening)
        .collect();
    let mut classification = classify_equity_change_vouchers(
        pool,
        company_id,
        period_year,
        period_month,
        template_id,
        columns,
    )
    .await?;
    for (parent, children) in aggregate_rows {
        let values =
            sum_equity_classification_rows(&classification.amounts, children, columns.len());
        if values.iter().any(|value| value.abs() >= 0.005) {
            classification.amounts.insert((*parent).to_string(), values);
        }
    }
    let classified_values = sum_equity_classification_rows(
        &classification.amounts,
        classified_summary_rows,
        columns.len(),
    );
    let classification_complete = classification.unmapped_amount < 0.01
        && classification.conflict_count == 0
        && change_values[..columns.len()]
            .iter()
            .zip(&classified_values[..columns.len()])
            .all(|(change, classified)| (change - classified).abs() < 0.01);

    Ok(EquityMatrix {
        opening_values,
        ending_values,
        change_values,
        classification_amounts: classification.amounts,
        classification_complete,
    })
}

async fn build_equity_change_statement(
    pool: &DbPool,
    period_id: &str,
) -> Result<EquityChangeResult, String> {
    let (company_id, period_year, period_month): (String, i32, i32) = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取权益变动表账期失败: {error}"))?
    .ok_or_else(|| "会计期间不存在".to_string())?;
    let template = find_report_template_for_company(pool, &company_id, "equity_change").await?;
    let report_items: Vec<ReportTemplateItemRow> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula, line_number, calculation_sign FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template.id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取权益变动表项目失败: {error}"))?;

    if template.accounting_system == "enterprise" {
        let current_matrix = build_equity_matrix(
            pool,
            &company_id,
            period_id,
            period_year,
            period_month,
            &template.id,
            &ENTERPRISE_EQUITY_COLUMNS,
            &ENTERPRISE_EQUITY_AGGREGATE_ROWS,
            &ENTERPRISE_EQUITY_SUMMARY_ROWS,
        )
        .await?;
        let comparative_period_id: Option<String> = sqlx::query_scalar(
            r#"SELECT id FROM accounting_periods
               WHERE company_id = ? AND period_year = ? AND period_month = ?
               LIMIT 1"#,
        )
        .bind(&company_id)
        .bind(period_year - 1)
        .bind(period_month)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取权益变动表上年同期失败: {error}"))?;
        let comparative_matrix =
            if let Some(comparative_period_id) = comparative_period_id.as_deref() {
                Some(
                    build_equity_matrix(
                        pool,
                        &company_id,
                        comparative_period_id,
                        period_year - 1,
                        period_month,
                        &template.id,
                        &ENTERPRISE_EQUITY_COLUMNS,
                        &ENTERPRISE_EQUITY_AGGREGATE_ROWS,
                        &ENTERPRISE_EQUITY_SUMMARY_ROWS,
                    )
                    .await?,
                )
            } else {
                None
            };
        let zero_values = vec![0.0; ENTERPRISE_EQUITY_COLUMNS.len() + 1];
        let items = report_items
            .into_iter()
            .map(
                |(
                    _id,
                    item_code,
                    item_name,
                    item_level,
                    _sort,
                    is_total,
                    _formula,
                    line_number,
                    _sign,
                )| {
                    let values = match item_code.as_str() {
                        "EQ100" | "EQ200" => current_matrix.opening_values.clone(),
                        "EQ300" => current_matrix.change_values.clone(),
                        "EQ400" => current_matrix.ending_values.clone(),
                        _ => current_matrix
                            .classification_amounts
                            .get(&item_code)
                            .cloned()
                            .unwrap_or_else(|| zero_values.clone()),
                    };
                    let comparative_values = comparative_matrix
                        .as_ref()
                        .map(|matrix| match item_code.as_str() {
                            "EQ100" | "EQ200" => matrix.opening_values.clone(),
                            "EQ300" => matrix.change_values.clone(),
                            "EQ400" => matrix.ending_values.clone(),
                            _ => matrix
                                .classification_amounts
                                .get(&item_code)
                                .cloned()
                                .unwrap_or_else(|| zero_values.clone()),
                        })
                        .unwrap_or_else(|| zero_values.clone());
                    let opening_balance = *current_matrix.opening_values.last().unwrap_or(&0.0);
                    let ending_balance = *current_matrix.ending_values.last().unwrap_or(&0.0);
                    let change = ending_balance - opening_balance;
                    EquityChangeItem {
                        item_code,
                        item_name,
                        line_number,
                        item_level,
                        is_total,
                        opening_balance,
                        current_increase: change.max(0.0),
                        current_decrease: (-change).max(0.0),
                        ending_balance,
                        values,
                        comparative_values,
                    }
                },
            )
            .collect();
        let mut columns: Vec<EquityChangeColumn> = ENTERPRISE_EQUITY_COLUMNS
            .iter()
            .map(|(code, name, _, _)| EquityChangeColumn {
                column_code: (*code).to_string(),
                column_name: (*name).to_string(),
            })
            .collect();
        columns.push(EquityChangeColumn {
            column_code: "total_equity".to_string(),
            column_name: "所有者权益合计".to_string(),
        });

        return Ok(EquityChangeResult {
            period_id: period_id.to_string(),
            template_name: template.template_name,
            accounting_system: template.accounting_system,
            form_code: template.form_code,
            reporting_frequency: template.reporting_frequency,
            is_statutory: template.is_statutory != 0,
            layout: "statutory_matrix".to_string(),
            columns,
            has_comparative_period: comparative_period_id.is_some(),
            classification_complete: current_matrix.classification_complete,
            comparative_classification_complete: comparative_matrix
                .as_ref()
                .map(|matrix| matrix.classification_complete)
                .unwrap_or(false),
            items,
        });
    }

    if template.accounting_system == "cooperative" {
        let current_matrix = build_equity_matrix(
            pool,
            &company_id,
            period_id,
            period_year,
            period_month,
            &template.id,
            &COOPERATIVE_EQUITY_COLUMNS,
            &[],
            &COOPERATIVE_EQUITY_SUMMARY_ROWS,
        )
        .await?;
        let component_count = COOPERATIVE_EQUITY_COLUMNS.len();
        let mut increase_values: Vec<f64> = current_matrix.change_values[..component_count]
            .iter()
            .map(|value| value.max(0.0))
            .collect();
        increase_values.push(increase_values.iter().sum());
        let mut decrease_values: Vec<f64> = current_matrix.change_values[..component_count]
            .iter()
            .map(|value| value.min(0.0))
            .collect();
        decrease_values.push(decrease_values.iter().sum());
        let zero_values = vec![0.0; component_count + 1];
        let opening_balance = *current_matrix.opening_values.last().unwrap_or(&0.0);
        let ending_balance = *current_matrix.ending_values.last().unwrap_or(&0.0);
        let current_increase = *increase_values.last().unwrap_or(&0.0);
        let current_decrease = -*decrease_values.last().unwrap_or(&0.0);
        let items = report_items
            .into_iter()
            .map(
                |(
                    _id,
                    item_code,
                    item_name,
                    item_level,
                    _sort,
                    is_total,
                    _formula,
                    line_number,
                    _sign,
                )| {
                    let values = match item_code.as_str() {
                        "EQ100" => current_matrix.opening_values.clone(),
                        "EQ200" => increase_values.clone(),
                        "EQ300" => decrease_values.clone(),
                        "EQ400" => current_matrix.ending_values.clone(),
                        _ => current_matrix
                            .classification_amounts
                            .get(&item_code)
                            .cloned()
                            .unwrap_or_else(|| zero_values.clone()),
                    };
                    EquityChangeItem {
                        item_code,
                        item_name,
                        line_number,
                        item_level,
                        is_total,
                        opening_balance,
                        current_increase,
                        current_decrease,
                        ending_balance,
                        values,
                        comparative_values: zero_values.clone(),
                    }
                },
            )
            .collect();
        let mut columns: Vec<EquityChangeColumn> = COOPERATIVE_EQUITY_COLUMNS
            .iter()
            .map(|(code, name, _, _)| EquityChangeColumn {
                column_code: (*code).to_string(),
                column_name: (*name).to_string(),
            })
            .collect();
        columns.push(EquityChangeColumn {
            column_code: "total_member_equity".to_string(),
            column_name: "成员权益合计".to_string(),
        });

        return Ok(EquityChangeResult {
            period_id: period_id.to_string(),
            template_name: template.template_name,
            accounting_system: template.accounting_system,
            form_code: template.form_code,
            reporting_frequency: template.reporting_frequency,
            is_statutory: template.is_statutory != 0,
            layout: "statutory_matrix".to_string(),
            columns,
            has_comparative_period: false,
            classification_complete: current_matrix.classification_complete,
            comparative_classification_complete: false,
            items,
        });
    }

    let mut items = Vec::with_capacity(report_items.len());
    for (_id, item_code, item_name, item_level, _sort, is_total, formula, line_number, _sign) in
        report_items
    {
        let (opening_balance, ending_balance) = if let Some(formula) = formula {
            let opening = evaluate_statement_formula(
                &formula,
                &company_id,
                period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::OpeningBalance,
                pool,
            )
            .await;
            let ending = evaluate_formula(&formula, &company_id, period_id, pool).await;
            (opening, ending)
        } else {
            (0.0, 0.0)
        };
        let change = ending_balance - opening_balance;
        items.push(EquityChangeItem {
            item_code,
            item_name,
            line_number,
            item_level,
            is_total,
            opening_balance,
            current_increase: change.max(0.0),
            current_decrease: (-change).max(0.0),
            ending_balance,
            values: Vec::new(),
            comparative_values: Vec::new(),
        });
    }

    Ok(EquityChangeResult {
        period_id: period_id.to_string(),
        template_name: template.template_name,
        accounting_system: template.accounting_system,
        form_code: template.form_code,
        reporting_frequency: template.reporting_frequency,
        is_statutory: template.is_statutory != 0,
        layout: "component_rows".to_string(),
        columns: Vec::new(),
        has_comparative_period: false,
        classification_complete: true,
        comparative_classification_complete: true,
        items,
    })
}

#[tauri::command]
pub async fn get_equity_change_statement(
    period_id: String,
    db: State<'_, Database>,
) -> Result<EquityChangeResult, String> {
    build_equity_change_statement(db.pool(), &period_id).await
}

fn income_line_amount(
    running_total: &mut f64,
    is_total: i32,
    has_formula: bool,
    calculation_sign: i32,
    source_value: f64,
) -> f64 {
    if is_total == 1 {
        return if has_formula {
            source_value
        } else {
            *running_total
        };
    }

    *running_total += source_value * f64::from(calculation_sign);
    source_value
}

fn primary_income_total<'a>(
    items: &'a [IncomeStatementItem],
    accounting_system: &str,
) -> Option<&'a IncomeStatementItem> {
    let expected_name = match accounting_system {
        "non_profit" => "净资产变动额",
        "cooperative" => "本年盈余",
        _ => "净利润",
    };
    items
        .iter()
        .find(|item| item.is_total == 1 && item.item_name.contains(expected_name))
        .or_else(|| items.iter().rev().find(|item| item.is_total == 1))
}

async fn build_income_statement(
    pool: &DbPool,
    period_id: &str,
) -> Result<IncomeStatementResult, String> {
    log::info!("Generating income statement for period: {}", period_id);

    // Get period info and company for year-to-date calculation
    let period_info: Option<(String, i32, i32)> = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (company_id, period_year, period_month) =
        period_info.ok_or_else(|| "会计期间不存在".to_string())?;

    let template = find_report_template_for_company(pool, &company_id, "income_statement").await?;
    let template_id = template.id.clone();
    let comparative_period_id: Option<String> = if template.accounting_system == "enterprise" {
        sqlx::query_scalar(
            "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ? LIMIT 1",
        )
        .bind(&company_id)
        .bind(period_year - 1)
        .bind(period_month)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取利润表上期比较期间失败: {error}"))?
    } else {
        None
    };

    let report_items: Vec<ReportTemplateItemRow> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula, line_number, calculation_sign FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut items = Vec::new();
    let mut running_sum = 0.0;
    let mut ytd_running_sum = 0.0;
    let mut comparative_running_sum = 0.0;
    let is_nonprofit = template.accounting_system == "non_profit";
    let mut current_unrestricted_running_sum = 0.0;
    let mut current_restricted_running_sum = 0.0;
    let mut ytd_unrestricted_running_sum = 0.0;
    let mut ytd_restricted_running_sum = 0.0;
    let mut classification_complete = true;

    for (
        _id,
        item_code,
        item_name,
        level,
        _sort,
        is_total,
        formula,
        line_number,
        calculation_sign,
    ) in &report_items
    {
        // Current period amount
        let current_source = if let Some(f) = formula {
            evaluate_statement_formula(
                f,
                &company_id,
                period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::AccountActivity,
                pool,
            )
            .await
        } else {
            0.0
        };
        let current_amount = income_line_amount(
            &mut running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            current_source,
        );
        let (current_restricted_source, current_unclassified) = if is_nonprofit && formula.is_some()
        {
            evaluate_nonprofit_restricted_formula(
                formula.as_deref().unwrap_or_default(),
                &company_id,
                period_id,
                FormulaPeriodScope::Current,
                pool,
            )
            .await
        } else {
            (0.0, false)
        };
        classification_complete &= !current_unclassified;
        let current_restricted_amount = if is_nonprofit {
            income_line_amount(
                &mut current_restricted_running_sum,
                *is_total,
                formula.is_some(),
                *calculation_sign,
                current_restricted_source,
            )
        } else {
            0.0
        };
        let current_unrestricted_amount = if is_nonprofit {
            income_line_amount(
                &mut current_unrestricted_running_sum,
                *is_total,
                formula.is_some(),
                *calculation_sign,
                current_source - current_restricted_source,
            )
        } else {
            current_amount
        };

        // Year-to-date activity is evaluated once at the selected period. This
        // prevents cumulative or closing-balance tokens from being summed once
        // for every month in the year.
        let ytd_source = if let Some(f) = formula {
            evaluate_statement_formula(
                f,
                &company_id,
                period_id,
                FormulaPeriodScope::YearToDate,
                BareFormulaMeasure::AccountActivity,
                pool,
            )
            .await
        } else {
            0.0
        };
        let ytd_amount = income_line_amount(
            &mut ytd_running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            ytd_source,
        );
        let (ytd_restricted_source, ytd_unclassified) = if is_nonprofit && formula.is_some() {
            evaluate_nonprofit_restricted_formula(
                formula.as_deref().unwrap_or_default(),
                &company_id,
                period_id,
                FormulaPeriodScope::YearToDate,
                pool,
            )
            .await
        } else {
            (0.0, false)
        };
        classification_complete &= !ytd_unclassified;
        let ytd_restricted_amount = if is_nonprofit {
            income_line_amount(
                &mut ytd_restricted_running_sum,
                *is_total,
                formula.is_some(),
                *calculation_sign,
                ytd_restricted_source,
            )
        } else {
            0.0
        };
        let ytd_unrestricted_amount = if is_nonprofit {
            income_line_amount(
                &mut ytd_unrestricted_running_sum,
                *is_total,
                formula.is_some(),
                *calculation_sign,
                ytd_source - ytd_restricted_source,
            )
        } else {
            ytd_amount
        };
        let comparative_source = if let (Some(f), Some(comparative_period_id)) =
            (formula, comparative_period_id.as_deref())
        {
            evaluate_statement_formula(
                f,
                &company_id,
                comparative_period_id,
                FormulaPeriodScope::YearToDate,
                BareFormulaMeasure::AccountActivity,
                pool,
            )
            .await
        } else {
            0.0
        };
        let comparative_amount = income_line_amount(
            &mut comparative_running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            comparative_source,
        );

        items.push(IncomeStatementItem {
            item_code: item_code.clone(),
            item_name: item_name.clone(),
            line_number: line_number.clone(),
            item_level: *level,
            is_total: *is_total,
            current_amount,
            year_to_date: ytd_amount,
            comparative_amount,
            current_unrestricted_amount,
            current_restricted_amount,
            ytd_unrestricted_amount,
            ytd_restricted_amount,
        });
    }

    let primary_total = primary_income_total(&items, &template.accounting_system);
    let current_total = primary_total.map(|item| item.current_amount).unwrap_or(0.0);
    let ytd_total = primary_total.map(|item| item.year_to_date).unwrap_or(0.0);
    let comparative_total = primary_total
        .map(|item| item.comparative_amount)
        .unwrap_or(0.0);
    let column_basis = match template.accounting_system.as_str() {
        "enterprise" => "current_comparative",
        "non_profit" => "nonprofit_activity_matrix",
        _ => "monthly_ytd",
    };

    Ok(IncomeStatementResult {
        period_id: period_id.to_string(),
        template_name: template.template_name,
        accounting_system: template.accounting_system,
        form_code: template.form_code,
        reporting_frequency: template.reporting_frequency,
        is_statutory: template.is_statutory != 0,
        column_basis: column_basis.to_string(),
        has_comparative_period: comparative_period_id.is_some(),
        classification_complete,
        items,
        current_period_total: current_total,
        year_to_date_total: ytd_total,
        comparative_period_total: comparative_total,
    })
}

#[tauri::command]
pub async fn get_income_statement(
    period_id: String,
    db: State<'_, Database>,
) -> Result<IncomeStatementResult, String> {
    build_income_statement(db.pool(), &period_id).await
}

// ==================== Formula Evaluation ====================

// ==================== Formula Evaluation ====================

/// Supported formula rules:
/// - "1001" → closing balance (default, net)
/// - "opening:1001" → opening balance
/// - "debit:1001" → period debit
/// - "credit:1001" → period credit
/// - "cdebit:1001" → cumulative (year-to-date) debit
/// - "ccredit:1001" → cumulative (year-to-date) credit
/// - "closing_d:1001" → closing debit
/// - "closing_c:1001" → closing credit
///
/// Operators: + and - between tokens, e.g. "1001+1002-1231" or "debit:6001+debit:6051"
async fn evaluate_formula(
    formula: &str,
    company_id: &str,
    period_id: &str,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    let mut total = 0.0;
    let mut current_op = '+';
    let mut current_token = String::new();

    for ch in formula.chars() {
        if ch == '+' || ch == '-' {
            if !current_token.is_empty() {
                let amount = evaluate_token(&current_token, company_id, period_id, pool).await;
                match current_op {
                    '+' => total += amount,
                    '-' => total -= amount,
                    _ => {}
                }
                current_token.clear();
            }
            current_op = ch;
        } else if !ch.is_whitespace() {
            current_token.push(ch);
        }
    }

    // Process last token
    if !current_token.is_empty() {
        let amount = evaluate_token(&current_token, company_id, period_id, pool).await;
        match current_op {
            '+' => total += amount,
            '-' => total -= amount,
            _ => {}
        }
    }

    total
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FormulaPeriodScope {
    Current,
    YearToDate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BareFormulaMeasure {
    OpeningBalance,
    ClosingBalance,
    AccountActivity,
}

fn scoped_formula_rule(rule: &str, scope: FormulaPeriodScope) -> &'static str {
    match (rule, scope) {
        ("opening", _) => "opening",
        ("debit", FormulaPeriodScope::Current) => "period_debit",
        ("debit", FormulaPeriodScope::YearToDate) => "cumulative_debit",
        ("credit", FormulaPeriodScope::Current) => "period_credit",
        ("credit", FormulaPeriodScope::YearToDate) => "cumulative_credit",
        ("cdebit", _) => "cumulative_debit",
        ("ccredit", _) => "cumulative_credit",
        ("closing_d", _) => "closing_debit",
        ("closing_c", _) => "closing_credit",
        _ => "",
    }
}

fn period_activity_value(normal_balance: &str, debit: f64, credit: f64) -> f64 {
    if normal_balance == "credit" {
        credit - debit
    } else {
        debit - credit
    }
}

async fn evaluate_statement_formula(
    formula: &str,
    company_id: &str,
    period_id: &str,
    scope: FormulaPeriodScope,
    bare_measure: BareFormulaMeasure,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    let mut total = 0.0;
    let mut current_op = '+';
    let mut current_token = String::new();

    for ch in formula.chars() {
        if ch == '+' || ch == '-' {
            if !current_token.is_empty() {
                let amount = evaluate_statement_token(
                    &current_token,
                    company_id,
                    period_id,
                    scope,
                    bare_measure,
                    pool,
                )
                .await;
                match current_op {
                    '+' => total += amount,
                    '-' => total -= amount,
                    _ => {}
                }
                current_token.clear();
            }
            current_op = ch;
        } else if !ch.is_whitespace() {
            current_token.push(ch);
        }
    }

    if !current_token.is_empty() {
        let amount = evaluate_statement_token(
            &current_token,
            company_id,
            period_id,
            scope,
            bare_measure,
            pool,
        )
        .await;
        match current_op {
            '+' => total += amount,
            '-' => total -= amount,
            _ => {}
        }
    }

    total
}

async fn evaluate_statement_token(
    token: &str,
    company_id: &str,
    period_id: &str,
    scope: FormulaPeriodScope,
    bare_measure: BareFormulaMeasure,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    if let Some(colon_pos) = token.find(':') {
        let rule = scoped_formula_rule(&token[..colon_pos], scope);
        if rule.is_empty() {
            return 0.0;
        }
        return get_account_balance_by_rule(
            &token[colon_pos + 1..],
            company_id,
            period_id,
            rule,
            pool,
        )
        .await;
    }

    match bare_measure {
        BareFormulaMeasure::OpeningBalance => {
            get_account_opening_balance(token, company_id, period_id, pool).await
        }
        BareFormulaMeasure::ClosingBalance => {
            get_account_closing_balance(token, company_id, period_id, pool).await
        }
        BareFormulaMeasure::AccountActivity => {
            get_account_activity_by_scope(token, company_id, period_id, scope, pool).await
        }
    }
}

async fn evaluate_token(
    token: &str,
    company_id: &str,
    period_id: &str,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    if let Some(colon_pos) = token.find(':') {
        let rule = &token[..colon_pos];
        let code = &token[colon_pos + 1..];
        match rule {
            "opening" => {
                get_account_balance_by_rule(code, company_id, period_id, "opening", pool).await
            }
            "debit" => {
                get_account_balance_by_rule(code, company_id, period_id, "period_debit", pool).await
            }
            "credit" => {
                get_account_balance_by_rule(code, company_id, period_id, "period_credit", pool)
                    .await
            }
            "cdebit" => {
                get_account_balance_by_rule(code, company_id, period_id, "cumulative_debit", pool)
                    .await
            }
            "ccredit" => {
                get_account_balance_by_rule(code, company_id, period_id, "cumulative_credit", pool)
                    .await
            }
            "closing_d" => {
                get_account_balance_by_rule(code, company_id, period_id, "closing_debit", pool)
                    .await
            }
            "closing_c" => {
                get_account_balance_by_rule(code, company_id, period_id, "closing_credit", pool)
                    .await
            }
            _ => 0.0,
        }
    } else {
        // Default: closing balance (net, based on normal_balance)
        get_account_closing_balance(token, company_id, period_id, pool).await
    }
}

#[derive(Debug, Default)]
struct FormulaBalanceTotals {
    opening_debit: f64,
    opening_credit: f64,
    period_debit: f64,
    period_credit: f64,
    closing_debit: f64,
    closing_credit: f64,
    cumulative_debit: f64,
    cumulative_credit: f64,
}

fn formula_balance_value(rule: &str, normal_balance: &str, totals: &FormulaBalanceTotals) -> f64 {
    match rule {
        "opening" => {
            if normal_balance == "debit" {
                totals.opening_debit - totals.opening_credit
            } else {
                totals.opening_credit - totals.opening_debit
            }
        }
        "period_debit" => totals.period_debit,
        "period_credit" => totals.period_credit,
        "closing_debit" => totals.closing_debit,
        "closing_credit" => totals.closing_credit,
        "cumulative_debit" => totals.cumulative_debit,
        "cumulative_credit" => totals.cumulative_credit,
        _ => 0.0,
    }
}

async fn get_account_activity_by_scope(
    code: &str,
    company_id: &str,
    period_id: &str,
    scope: FormulaPeriodScope,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    let totals: (f64, f64) = match scope {
        FormulaPeriodScope::Current => sqlx::query_as(
            r#"WITH RECURSIVE descendants(code) AS (
                 SELECT code FROM account_codes WHERE company_id = ? AND code = ?
                 UNION ALL
                 SELECT ac.code FROM account_codes ac
                 JOIN descendants parent ON ac.parent_code = parent.code
                 WHERE ac.company_id = ?
               )
               SELECT COALESCE(SUM(ab.period_debit), 0),
                      COALESCE(SUM(ab.period_credit), 0)
               FROM account_balances ab
               JOIN descendants d ON d.code = ab.account_code
               JOIN account_codes ac
                 ON ac.company_id = ? AND ac.code = ab.account_code
               WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
        )
        .bind(company_id)
        .bind(code)
        .bind(company_id)
        .bind(company_id)
        .bind(period_id)
        .fetch_one(pool)
        .await
        .unwrap_or((0.0, 0.0)),
        FormulaPeriodScope::YearToDate => sqlx::query_as(
            r#"WITH RECURSIVE descendants(code) AS (
                 SELECT code FROM account_codes WHERE company_id = ? AND code = ?
                 UNION ALL
                 SELECT ac.code FROM account_codes ac
                 JOIN descendants parent ON ac.parent_code = parent.code
                 WHERE ac.company_id = ?
               )
               SELECT COALESCE(SUM(ab.period_debit), 0), COALESCE(SUM(ab.period_credit), 0)
               FROM account_balances ab
               JOIN accounting_periods ap ON ap.id = ab.period_id
               JOIN descendants d ON d.code = ab.account_code
               JOIN account_codes ac
                 ON ac.company_id = ap.company_id AND ac.code = ab.account_code
               WHERE ap.company_id = ?
                 AND ap.period_year = (SELECT period_year FROM accounting_periods WHERE id = ?)
                 AND ap.period_month <= (SELECT period_month FROM accounting_periods WHERE id = ?)
                 AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
        )
        .bind(company_id)
        .bind(code)
        .bind(company_id)
        .bind(company_id)
        .bind(period_id)
        .bind(period_id)
        .fetch_one(pool)
        .await
        .unwrap_or((0.0, 0.0)),
    };

    let normal_balance: Option<String> = sqlx::query_scalar(
        "SELECT normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(company_id)
    .bind(code)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    period_activity_value(
        normal_balance.as_deref().unwrap_or("debit"),
        totals.0,
        totals.1,
    )
}

async fn get_nonprofit_restricted_activity_by_scope(
    code: &str,
    company_id: &str,
    period_id: &str,
    scope: FormulaPeriodScope,
    pool: &sqlx::Pool<Sqlite>,
) -> (f64, bool) {
    let rows: Vec<(String, String, f64, f64)> = match scope {
        FormulaPeriodScope::Current => sqlx::query_as(
            r#"WITH RECURSIVE descendants(code) AS (
                 SELECT code FROM account_codes WHERE company_id = ? AND code = ?
                 UNION ALL
                 SELECT ac.code FROM account_codes ac
                 JOIN descendants parent ON ac.parent_code = parent.code
                 WHERE ac.company_id = ?
               )
               SELECT ac.name, ac.normal_balance,
                      COALESCE(ab.period_debit, 0), COALESCE(ab.period_credit, 0)
               FROM account_balances ab
               JOIN descendants d ON d.code = ab.account_code
               JOIN account_codes ac
                 ON ac.company_id = ? AND ac.code = ab.account_code
               WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
        )
        .bind(company_id)
        .bind(code)
        .bind(company_id)
        .bind(company_id)
        .bind(period_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default(),
        FormulaPeriodScope::YearToDate => sqlx::query_as(
            r#"WITH RECURSIVE descendants(code) AS (
                 SELECT code FROM account_codes WHERE company_id = ? AND code = ?
                 UNION ALL
                 SELECT ac.code FROM account_codes ac
                 JOIN descendants parent ON ac.parent_code = parent.code
                 WHERE ac.company_id = ?
               )
               SELECT ac.name, ac.normal_balance,
                      COALESCE(SUM(ab.period_debit), 0), COALESCE(SUM(ab.period_credit), 0)
               FROM account_balances ab
               JOIN accounting_periods ap ON ap.id = ab.period_id
               JOIN descendants d ON d.code = ab.account_code
               JOIN account_codes ac
                 ON ac.company_id = ap.company_id AND ac.code = ab.account_code
               WHERE ap.company_id = ?
                 AND ap.period_year = (SELECT period_year FROM accounting_periods WHERE id = ?)
                 AND ap.period_month <= (SELECT period_month FROM accounting_periods WHERE id = ?)
                 AND ac.is_enabled = 1 AND ac.is_detail = 1
               GROUP BY ac.code, ac.name, ac.normal_balance"#,
        )
        .bind(company_id)
        .bind(code)
        .bind(company_id)
        .bind(company_id)
        .bind(period_id)
        .bind(period_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default(),
    };

    let mut restricted = 0.0;
    let mut has_unclassified = false;
    for (name, normal_balance, debit, credit) in rows {
        let amount = period_activity_value(&normal_balance, debit, credit);
        if amount.abs() < 0.005 {
            continue;
        }
        if name.contains("非限定性") {
            continue;
        }
        if name.contains("限定性") {
            restricted += amount;
        } else {
            has_unclassified = true;
        }
    }
    (restricted, has_unclassified)
}

async fn evaluate_nonprofit_restricted_formula(
    formula: &str,
    company_id: &str,
    period_id: &str,
    scope: FormulaPeriodScope,
    pool: &sqlx::Pool<Sqlite>,
) -> (f64, bool) {
    let mut total = 0.0;
    let mut current_op = '+';
    let mut current_token = String::new();
    let mut has_unclassified = false;

    for ch in formula.chars().chain(std::iter::once('+')) {
        if ch == '+' || ch == '-' {
            if !current_token.is_empty() {
                let code = current_token
                    .split_once(':')
                    .map(|(_, code)| code)
                    .unwrap_or(current_token.as_str());
                let (amount, token_unclassified) = get_nonprofit_restricted_activity_by_scope(
                    code, company_id, period_id, scope, pool,
                )
                .await;
                if current_op == '-' {
                    total -= amount;
                } else {
                    total += amount;
                }
                has_unclassified |= token_unclassified;
                current_token.clear();
            }
            current_op = ch;
        } else if !ch.is_whitespace() {
            current_token.push(ch);
        }
    }

    (total, has_unclassified)
}

async fn get_account_balance_by_rule(
    code: &str,
    company_id: &str,
    period_id: &str,
    rule: &str,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    let rows: Vec<(String, f64, f64, f64, f64, f64, f64)> = sqlx::query_as(
        r#"WITH RECURSIVE descendants(code) AS (
             SELECT code FROM account_codes WHERE company_id = ? AND code = ?
             UNION ALL
             SELECT ac.code FROM account_codes ac
             JOIN descendants parent ON ac.parent_code = parent.code
             WHERE ac.company_id = ?
           )
           SELECT ab.account_code, COALESCE(ab.opening_debit, 0),
                  COALESCE(ab.opening_credit, 0), COALESCE(ab.period_debit, 0),
                  COALESCE(ab.period_credit, 0), COALESCE(ab.closing_debit, 0),
                  COALESCE(ab.closing_credit, 0)
           FROM account_balances ab
           JOIN descendants d ON d.code = ab.account_code
           JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ab.account_code
           WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1
           ORDER BY ab.account_code"#,
    )
    .bind(company_id)
    .bind(code)
    .bind(company_id)
    .bind(company_id)
    .bind(period_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut totals = FormulaBalanceTotals::default();
    for (_row_code, od, oc, pd, pc, cd, cc) in &rows {
        totals.opening_debit += od;
        totals.opening_credit += oc;
        totals.period_debit += pd;
        totals.period_credit += pc;
        totals.closing_debit += cd;
        totals.closing_credit += cc;
    }

    if rule == "cumulative_debit" || rule == "cumulative_credit" {
        let ytd: (f64, f64) = sqlx::query_as(
            r#"WITH RECURSIVE descendants(code) AS (
                 SELECT code FROM account_codes WHERE company_id = ? AND code = ?
                 UNION ALL
                 SELECT ac.code FROM account_codes ac
                 JOIN descendants parent ON ac.parent_code = parent.code
                 WHERE ac.company_id = ?
               )
               SELECT COALESCE(SUM(ab.period_debit), 0), COALESCE(SUM(ab.period_credit), 0)
               FROM account_balances ab
               JOIN accounting_periods ap ON ap.id = ab.period_id
               JOIN descendants d ON d.code = ab.account_code
               JOIN account_codes ac
                 ON ac.company_id = ap.company_id AND ac.code = ab.account_code
               WHERE ap.company_id = ?
                 AND ap.period_year = (SELECT period_year FROM accounting_periods WHERE id = ?)
                 AND ap.period_month <= (SELECT period_month FROM accounting_periods WHERE id = ?)
                 AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
        )
        .bind(company_id)
        .bind(code)
        .bind(company_id)
        .bind(company_id)
        .bind(period_id)
        .bind(period_id)
        .fetch_one(pool)
        .await
        .unwrap_or((0.0, 0.0));
        totals.cumulative_debit = ytd.0;
        totals.cumulative_credit = ytd.1;
    }

    let normal_balance: Option<String> = sqlx::query_scalar(
        "SELECT normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(company_id)
    .bind(code)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    formula_balance_value(rule, normal_balance.as_deref().unwrap_or("debit"), &totals)
}

async fn get_account_opening_balance(
    code: &str,
    company_id: &str,
    period_id: &str,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    let normal_balance: Option<String> = sqlx::query_scalar(
        "SELECT normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(company_id)
    .bind(code)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let totals: (f64, f64) = sqlx::query_as(
        r#"WITH RECURSIVE descendants(code) AS (
             SELECT code FROM account_codes WHERE company_id = ? AND code = ?
             UNION ALL
             SELECT ac.code FROM account_codes ac
             JOIN descendants parent ON ac.parent_code = parent.code
             WHERE ac.company_id = ?
           )
           SELECT COALESCE(SUM(ab.opening_debit), 0),
                  COALESCE(SUM(ab.opening_credit), 0)
           FROM account_balances ab
           JOIN descendants d ON d.code = ab.account_code
           JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ab.account_code
           WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
    )
    .bind(company_id)
    .bind(code)
    .bind(company_id)
    .bind(company_id)
    .bind(period_id)
    .fetch_one(pool)
    .await
    .unwrap_or((0.0, 0.0));

    period_activity_value(
        normal_balance.as_deref().unwrap_or("debit"),
        totals.0,
        totals.1,
    )
}

async fn get_account_closing_balance(
    code: &str,
    company_id: &str,
    period_id: &str,
    pool: &sqlx::Pool<Sqlite>,
) -> f64 {
    // Get the normal balance side for the parent account code
    let normal: Option<(String,)> = sqlx::query_as(
        "SELECT normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(company_id)
    .bind(code)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let is_debit_normal = normal
        .as_ref()
        .map(|(b,)| b.as_str() == "debit")
        .unwrap_or(true);

    let rows: Vec<(f64, f64)> = sqlx::query_as(
        r#"WITH RECURSIVE descendants(code) AS (
             SELECT code FROM account_codes WHERE company_id = ? AND code = ?
             UNION ALL
             SELECT ac.code FROM account_codes ac
             JOIN descendants parent ON ac.parent_code = parent.code
             WHERE ac.company_id = ?
           )
           SELECT COALESCE(ab.closing_debit, 0), COALESCE(ab.closing_credit, 0)
           FROM account_balances ab
           JOIN descendants d ON d.code = ab.account_code
           JOIN account_codes ac
             ON ac.company_id = ? AND ac.code = ab.account_code
           WHERE ab.period_id = ? AND ac.is_enabled = 1 AND ac.is_detail = 1"#,
    )
    .bind(company_id)
    .bind(code)
    .bind(company_id)
    .bind(company_id)
    .bind(period_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return 0.0;
    }

    let total_cd: f64 = rows.iter().map(|(d, _)| *d).sum();
    let total_cc: f64 = rows.iter().map(|(_, c)| *c).sum();

    if is_debit_normal {
        total_cd - total_cc
    } else {
        total_cc - total_cd
    }
}

// ==================== Cash Flow Statement ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashFlowResult {
    pub period_id: String,
    pub template_name: String,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: bool,
    pub column_basis: String,
    pub has_comparative_period: bool,
    pub items: Vec<CashFlowItem>,
    pub net_increase: f64,
    pub net_increase_year_to_date: f64,
    pub net_increase_comparative: f64,
    pub opening_cash_balance: f64,
    pub ending_cash_balance: f64,
    pub cash_balance_change: f64,
    pub cash_balance_change_year_to_date: f64,
    pub reconciliation_difference: f64,
    pub reconciliation_difference_year_to_date: f64,
    pub is_reconciled: bool,
    pub classification_mode: String,
    pub unmapped_cash_amount: f64,
    pub unmapped_cash_amount_year_to_date: f64,
    pub unmapped_voucher_count: i64,
    pub mapping_conflict_count: i64,
    pub is_classification_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashFlowItem {
    pub item_code: String,
    pub item_name: String,
    pub line_number: Option<String>,
    pub item_level: i32,
    pub is_total: i32,
    pub current_amount: f64,
    pub year_to_date: f64,
    pub comparative_amount: f64,
}

fn cash_flow_line_amount(
    running_total: &mut f64,
    is_total: i32,
    has_formula: bool,
    calculation_sign: i32,
    source_value: f64,
) -> f64 {
    if is_total == 1 {
        if has_formula {
            return source_value;
        }
        let total = *running_total;
        *running_total = 0.0;
        return total;
    }

    *running_total += source_value * f64::from(calculation_sign);
    source_value
}

fn cash_flow_net_increase(items: &[CashFlowItem], year_to_date: bool) -> f64 {
    ["CF199", "CF299", "CF399"]
        .iter()
        .filter_map(|code| items.iter().find(|item| item.item_code == *code))
        .chain(
            items
                .iter()
                .filter(|item| item.item_code == "CF400" || item.item_name.contains("汇率变动")),
        )
        .map(|item| {
            if year_to_date {
                item.year_to_date
            } else {
                item.current_amount
            }
        })
        .sum()
}

fn cash_flow_amount(items: &[CashFlowItem], code: &str, year_to_date: bool) -> f64 {
    items
        .iter()
        .find(|item| item.item_code == code)
        .map(|item| {
            if year_to_date {
                item.year_to_date
            } else {
                item.current_amount
            }
        })
        .unwrap_or(0.0)
}

fn cash_flow_sum(items: &[CashFlowItem], codes: &[&str], year_to_date: bool) -> f64 {
    codes
        .iter()
        .map(|code| cash_flow_amount(items, code, year_to_date))
        .sum()
}

fn set_cash_flow_amount(
    items: &mut [CashFlowItem],
    code: &str,
    current_amount: f64,
    year_to_date: f64,
) {
    if let Some(item) = items.iter_mut().find(|item| item.item_code == code) {
        item.current_amount = current_amount;
        item.year_to_date = year_to_date;
    }
}

fn derive_cash_flow_section(
    items: &mut [CashFlowItem],
    inflow_codes: &[&str],
    outflow_codes: &[&str],
    inflow_total_code: &str,
    outflow_total_code: &str,
    net_code: &str,
) {
    let has_detail = items.iter().any(|item| {
        inflow_codes.contains(&item.item_code.as_str())
            || outflow_codes.contains(&item.item_code.as_str())
    });
    if !has_detail {
        return;
    }
    let current_inflow = cash_flow_sum(items, inflow_codes, false);
    let ytd_inflow = cash_flow_sum(items, inflow_codes, true);
    let current_outflow = cash_flow_sum(items, outflow_codes, false);
    let ytd_outflow = cash_flow_sum(items, outflow_codes, true);
    set_cash_flow_amount(items, inflow_total_code, current_inflow, ytd_inflow);
    set_cash_flow_amount(items, outflow_total_code, current_outflow, ytd_outflow);
    set_cash_flow_amount(
        items,
        net_code,
        current_inflow - current_outflow,
        ytd_inflow - ytd_outflow,
    );
}

fn apply_cash_flow_control_lines(items: &mut [CashFlowItem]) -> (f64, f64) {
    derive_cash_flow_section(
        items,
        &["CF101", "CF102", "CF103", "CF108", "CF110", "CF118"],
        &["CF104", "CF105", "CF106", "CF107", "CF117"],
        "CF109",
        "CF119",
        "CF199",
    );
    derive_cash_flow_section(
        items,
        &["CF201", "CF202", "CF203", "CF206", "CF207"],
        &["CF204", "CF205", "CF208", "CF210"],
        "CF209",
        "CF219",
        "CF299",
    );
    derive_cash_flow_section(
        items,
        &["CF301", "CF302", "CF305"],
        &["CF303", "CF304", "CF306"],
        "CF309",
        "CF319",
        "CF399",
    );
    let net_increase = cash_flow_net_increase(items, false);
    let net_increase_year_to_date = cash_flow_net_increase(items, true);
    for item in items
        .iter_mut()
        .filter(|item| item.item_code == "CF499" || item.item_name.contains("现金净增加额"))
    {
        item.current_amount = net_increase;
        item.year_to_date = net_increase_year_to_date;
    }
    (net_increase, net_increase_year_to_date)
}

fn cash_flow_comparative_amount(items: &[CashFlowItem], code: &str) -> f64 {
    items
        .iter()
        .find(|item| item.item_code == code)
        .map(|item| item.comparative_amount)
        .unwrap_or(0.0)
}

fn set_cash_flow_comparative_amount(items: &mut [CashFlowItem], code: &str, amount: f64) {
    if let Some(item) = items.iter_mut().find(|item| item.item_code == code) {
        item.comparative_amount = amount;
    }
}

fn derive_cash_flow_comparative_section(
    items: &mut [CashFlowItem],
    inflow_codes: &[&str],
    outflow_codes: &[&str],
    inflow_total_code: &str,
    outflow_total_code: &str,
    net_code: &str,
) {
    if !items.iter().any(|item| {
        inflow_codes.contains(&item.item_code.as_str())
            || outflow_codes.contains(&item.item_code.as_str())
    }) {
        return;
    }
    let inflow: f64 = inflow_codes
        .iter()
        .map(|code| cash_flow_comparative_amount(items, code))
        .sum();
    let outflow: f64 = outflow_codes
        .iter()
        .map(|code| cash_flow_comparative_amount(items, code))
        .sum();
    set_cash_flow_comparative_amount(items, inflow_total_code, inflow);
    set_cash_flow_comparative_amount(items, outflow_total_code, outflow);
    set_cash_flow_comparative_amount(items, net_code, inflow - outflow);
}

fn apply_cash_flow_comparative_control_lines(items: &mut [CashFlowItem]) -> f64 {
    derive_cash_flow_comparative_section(
        items,
        &["CF101", "CF102", "CF103", "CF108", "CF110", "CF118"],
        &["CF104", "CF105", "CF106", "CF107", "CF117"],
        "CF109",
        "CF119",
        "CF199",
    );
    derive_cash_flow_comparative_section(
        items,
        &["CF201", "CF202", "CF203", "CF206", "CF207"],
        &["CF204", "CF205", "CF208", "CF210"],
        "CF209",
        "CF219",
        "CF299",
    );
    derive_cash_flow_comparative_section(
        items,
        &["CF301", "CF302", "CF305"],
        &["CF303", "CF304", "CF306"],
        "CF309",
        "CF319",
        "CF399",
    );
    let net_increase = ["CF199", "CF299", "CF399", "CF400"]
        .iter()
        .map(|code| cash_flow_comparative_amount(items, code))
        .sum();
    for item in items
        .iter_mut()
        .filter(|item| item.item_code == "CF499" || item.item_name.contains("现金净增加额"))
    {
        item.comparative_amount = net_increase;
    }
    net_increase
}

fn apply_cash_flow_balance_lines(
    items: &mut [CashFlowItem],
    opening_cash_balance: f64,
    year_opening_cash_balance: f64,
    ending_cash_balance: f64,
) {
    set_cash_flow_amount(
        items,
        "CF500",
        opening_cash_balance,
        year_opening_cash_balance,
    );
    let has_statutory_opening_line = items.iter().any(|item| item.item_code == "CF500");
    if items.iter().any(|item| {
        item.item_code == "CF999"
            && (has_statutory_opening_line || item.item_name.contains("期末现金"))
    }) {
        set_cash_flow_amount(items, "CF999", ending_cash_balance, ending_cash_balance);
    }
}

async fn cash_control_formula(
    pool: &DbPool,
    company_id: &str,
    cash_flow_template_id: &str,
) -> Option<String> {
    let cash_flow_formula: Option<String> = sqlx::query_scalar(
        r#"SELECT formula FROM report_items
           WHERE template_id = ? AND formula IS NOT NULL
             AND (item_code = 'CF999' OR item_name LIKE '%期末现金%')
           ORDER BY CASE WHEN item_name LIKE '%期末现金%' THEN 0 ELSE 1 END
           LIMIT 1"#,
    )
    .bind(cash_flow_template_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    if cash_flow_formula.is_some() {
        return cash_flow_formula;
    }

    let balance_template = find_report_template_for_company(pool, company_id, "balance_sheet")
        .await
        .ok()?;
    sqlx::query_scalar(
        r#"SELECT formula FROM report_items
           WHERE template_id = ? AND formula IS NOT NULL
             AND (item_code = 'BS101' OR item_name LIKE '%货币资金%')
           ORDER BY CASE WHEN item_code = 'BS101' THEN 0 ELSE 1 END
           LIMIT 1"#,
    )
    .bind(balance_template.id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}

#[derive(Debug, sqlx::FromRow)]
struct CashFlowMappingRuleRow {
    source_account_code: String,
    cash_direction: String,
    cash_flow_item_code: String,
    summary_keyword: Option<String>,
    priority: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct CashFlowVoucherEntryRow {
    voucher_id: String,
    period_id: String,
    voucher_summary: Option<String>,
    account_code: String,
    direction: String,
    amount: f64,
    entry_summary: Option<String>,
}

#[derive(Debug, Default)]
struct CashFlowMappingAmounts {
    current: std::collections::HashMap<String, f64>,
    year_to_date: std::collections::HashMap<String, f64>,
    unmapped_cash_amount: f64,
    unmapped_cash_amount_year_to_date: f64,
    unmapped_voucher_count: i64,
    mapping_conflict_count: i64,
}

fn formula_account_codes(formula: &str) -> Vec<String> {
    formula
        .split(['+', '-'])
        .filter_map(|token| {
            let normalized = token.trim();
            let code = normalized
                .split_once(':')
                .map(|(_, code)| code)
                .unwrap_or(normalized)
                .trim();
            (!code.is_empty()).then(|| code.to_string())
        })
        .collect()
}

fn account_is_under(
    account_code: &str,
    root_code: &str,
    parents: &std::collections::HashMap<String, Option<String>>,
) -> bool {
    let mut current = Some(account_code);
    let mut visited = std::collections::HashSet::new();
    while let Some(code) = current {
        if code == root_code {
            return true;
        }
        if !visited.insert(code.to_string()) {
            break;
        }
        current = parents.get(code).and_then(|parent| parent.as_deref());
    }
    false
}

async fn classify_cash_flow_vouchers(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    period_year: i32,
    period_month: i32,
    control_formula: &str,
    template_id: &str,
) -> Result<Option<CashFlowMappingAmounts>, String> {
    let rules: Vec<CashFlowMappingRuleRow> = sqlx::query_as(
        r#"SELECT source_account_code, cash_direction, cash_flow_item_code,
                  summary_keyword, priority
           FROM matching_rules
           WHERE company_id = ? AND rule_scope = 'cash_flow' AND is_enabled = 1
             AND source_account_code IS NOT NULL AND trim(source_account_code) <> ''
             AND cash_direction IN ('inflow', 'outflow')
             AND cash_flow_item_code IS NOT NULL AND trim(cash_flow_item_code) <> ''
           ORDER BY priority DESC, name, id"#,
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取现金流量映射失败: {error}"))?;
    if rules.is_empty() {
        return Ok(None);
    }

    let account_rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT code, parent_code FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取现金流科目层级失败: {error}"))?;
    let parents: std::collections::HashMap<String, Option<String>> =
        account_rows.into_iter().collect();
    let cash_roots = formula_account_codes(control_formula);
    let valid_items: std::collections::HashSet<String> = sqlx::query_scalar(
        r#"SELECT item_code FROM report_items
           WHERE template_id = ? AND is_total = 0
             AND (item_level > 1 OR formula IS NOT NULL OR item_name LIKE '%汇率变动%')"#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取现金流量项目失败: {error}"))?
    .into_iter()
    .collect();
    let entries: Vec<CashFlowVoucherEntryRow> = sqlx::query_as(
        r#"SELECT v.id AS voucher_id, v.period_id, v.summary AS voucher_summary,
                  entry.account_code, entry.direction, entry.amount,
                  entry.summary AS entry_summary
           FROM vouchers v
           JOIN accounting_periods period ON period.id = v.period_id
           JOIN voucher_entries entry ON entry.voucher_id = v.id
           WHERE v.company_id = ? AND period.period_year = ? AND period.period_month <= ?
             AND v.status = 'approved' AND COALESCE(v.is_deleted, 0) = 0
           ORDER BY period.period_month, v.sequence_num, entry.line_num"#,
    )
    .bind(company_id)
    .bind(period_year)
    .bind(period_month)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取现金流凭证失败: {error}"))?;

    let mut vouchers: std::collections::BTreeMap<(String, String), Vec<CashFlowVoucherEntryRow>> =
        std::collections::BTreeMap::new();
    for entry in entries {
        vouchers
            .entry((entry.period_id.clone(), entry.voucher_id.clone()))
            .or_default()
            .push(entry);
    }

    let mut result = CashFlowMappingAmounts::default();
    for ((entry_period_id, _voucher_id), voucher_entries) in vouchers {
        let is_cash = |code: &str| {
            cash_roots
                .iter()
                .any(|root| account_is_under(code, root, &parents))
        };
        let cash_delta: f64 = voucher_entries
            .iter()
            .filter(|entry| is_cash(&entry.account_code))
            .map(|entry| {
                if entry.direction == "debit" {
                    entry.amount
                } else {
                    -entry.amount
                }
            })
            .sum();
        if cash_delta.abs() < 0.005 {
            continue;
        }
        let cash_direction = if cash_delta > 0.0 {
            "inflow"
        } else {
            "outflow"
        };
        let amount = cash_delta.abs();
        let counterpart_codes: Vec<&str> = voucher_entries
            .iter()
            .filter(|entry| !is_cash(&entry.account_code))
            .map(|entry| entry.account_code.as_str())
            .collect();
        let summary = voucher_entries
            .iter()
            .flat_map(|entry| {
                [
                    entry.voucher_summary.as_deref(),
                    entry.entry_summary.as_deref(),
                ]
            })
            .flatten()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();
        let candidates: Vec<&CashFlowMappingRuleRow> = rules
            .iter()
            .filter(|rule| {
                rule.cash_direction == cash_direction
                    && valid_items.contains(&rule.cash_flow_item_code)
                    && counterpart_codes
                        .iter()
                        .any(|code| account_is_under(code, &rule.source_account_code, &parents))
                    && rule
                        .summary_keyword
                        .as_deref()
                        .map(str::trim)
                        .filter(|keyword| !keyword.is_empty())
                        .map(|keyword| summary.contains(&keyword.to_lowercase()))
                        .unwrap_or(true)
            })
            .collect();
        let is_current = entry_period_id == period_id;
        let target = candidates.first().and_then(|first| {
            let top_targets: std::collections::HashSet<&str> = candidates
                .iter()
                .take_while(|candidate| candidate.priority == first.priority)
                .map(|candidate| candidate.cash_flow_item_code.as_str())
                .collect();
            (top_targets.len() == 1).then(|| first.cash_flow_item_code.as_str())
        });
        if let Some(target) = target {
            *result.year_to_date.entry(target.to_string()).or_default() += amount;
            if is_current {
                *result.current.entry(target.to_string()).or_default() += amount;
            }
        } else {
            result.unmapped_cash_amount_year_to_date += amount;
            if is_current {
                result.unmapped_cash_amount += amount;
                result.unmapped_voucher_count += 1;
                if !candidates.is_empty() {
                    result.mapping_conflict_count += 1;
                }
            }
        }
    }
    Ok(Some(result))
}

async fn build_cash_flow_statement(
    pool: &DbPool,
    period_id: &str,
) -> Result<CashFlowResult, String> {
    log::info!("Generating cash flow statement for period: {}", period_id);

    // Read the selected period once so the report can expose both the month and the
    // year-to-date cash-flow amounts using the same accounting-period boundary.
    let period_info: Option<(String, i32, i32)> = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (company_id, period_year, period_month) =
        period_info.ok_or_else(|| "会计期间不存在".to_string())?;

    let template = find_report_template_for_company(pool, &company_id, "cash_flow").await;

    let template = if let Ok(template) = template {
        template
    } else {
        return Ok(CashFlowResult {
            period_id: period_id.to_string(),
            template_name: "现金流量表".to_string(),
            accounting_system: "unconfigured".to_string(),
            form_code: None,
            reporting_frequency: "按需".to_string(),
            is_statutory: false,
            column_basis: "monthly_ytd".to_string(),
            has_comparative_period: false,
            items: vec![],
            net_increase: 0.0,
            net_increase_year_to_date: 0.0,
            net_increase_comparative: 0.0,
            opening_cash_balance: 0.0,
            ending_cash_balance: 0.0,
            cash_balance_change: 0.0,
            cash_balance_change_year_to_date: 0.0,
            reconciliation_difference: 0.0,
            reconciliation_difference_year_to_date: 0.0,
            is_reconciled: false,
            classification_mode: "unconfigured".to_string(),
            unmapped_cash_amount: 0.0,
            unmapped_cash_amount_year_to_date: 0.0,
            unmapped_voucher_count: 0,
            mapping_conflict_count: 0,
            is_classification_complete: false,
        });
    };
    let template_id = template.id.clone();
    let comparative_period_id: Option<String> = if matches!(
        template.accounting_system.as_str(),
        "enterprise" | "non_profit"
    ) {
        sqlx::query_scalar(
            "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ? LIMIT 1",
        )
        .bind(&company_id)
        .bind(period_year - 1)
        .bind(period_month)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取现金流量表上期比较期间失败: {error}"))?
    } else {
        None
    };

    let report_items: Vec<ReportTemplateItemRow> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula, line_number, calculation_sign FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let control_formula = cash_control_formula(pool, &company_id, &template_id).await;
    let mapped_amounts = if let Some(formula) = control_formula.as_deref() {
        classify_cash_flow_vouchers(
            pool,
            &company_id,
            period_id,
            period_year,
            period_month,
            formula,
            &template_id,
        )
        .await?
    } else {
        None
    };
    let comparative_mapped_amounts = if let (Some(formula), Some(comparative_period_id)) =
        (control_formula.as_deref(), comparative_period_id.as_deref())
    {
        classify_cash_flow_vouchers(
            pool,
            &company_id,
            comparative_period_id,
            period_year - 1,
            period_month,
            formula,
            &template_id,
        )
        .await?
    } else {
        None
    };

    let mut items = Vec::new();
    let mut running_sum = 0.0;
    let mut ytd_running_sum = 0.0;
    let mut comparative_running_sum = 0.0;

    for (
        _id,
        item_code,
        item_name,
        level,
        _sort,
        is_total,
        formula,
        line_number,
        calculation_sign,
    ) in &report_items
    {
        let current_source = if *is_total == 0 && mapped_amounts.is_some() {
            mapped_amounts
                .as_ref()
                .and_then(|mapped| mapped.current.get(item_code))
                .copied()
                .unwrap_or(0.0)
        } else if let Some(f) = formula {
            evaluate_statement_formula(
                f,
                &company_id,
                period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::ClosingBalance,
                pool,
            )
            .await
        } else {
            0.0
        };
        let current_amount = cash_flow_line_amount(
            &mut running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            current_source,
        );

        let year_to_date_source = if *is_total == 0 && mapped_amounts.is_some() {
            mapped_amounts
                .as_ref()
                .and_then(|mapped| mapped.year_to_date.get(item_code))
                .copied()
                .unwrap_or(0.0)
        } else if let Some(f) = formula {
            evaluate_statement_formula(
                f,
                &company_id,
                period_id,
                FormulaPeriodScope::YearToDate,
                BareFormulaMeasure::ClosingBalance,
                pool,
            )
            .await
        } else {
            0.0
        };
        let year_to_date = cash_flow_line_amount(
            &mut ytd_running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            year_to_date_source,
        );
        let comparative_source = if *is_total == 0 && comparative_mapped_amounts.is_some() {
            comparative_mapped_amounts
                .as_ref()
                .and_then(|mapped| mapped.year_to_date.get(item_code))
                .copied()
                .unwrap_or(0.0)
        } else if let (Some(f), Some(comparative_period_id)) =
            (formula, comparative_period_id.as_deref())
        {
            evaluate_statement_formula(
                f,
                &company_id,
                comparative_period_id,
                FormulaPeriodScope::YearToDate,
                BareFormulaMeasure::ClosingBalance,
                pool,
            )
            .await
        } else {
            0.0
        };
        let comparative_amount = cash_flow_line_amount(
            &mut comparative_running_sum,
            *is_total,
            formula.is_some(),
            *calculation_sign,
            comparative_source,
        );

        items.push(CashFlowItem {
            item_code: item_code.clone(),
            item_name: item_name.clone(),
            line_number: line_number.clone(),
            item_level: *level,
            is_total: *is_total,
            current_amount,
            year_to_date,
            comparative_amount,
        });
    }

    // CF999 stores the period-end cash balance. Net increase is the sum of the
    // three activity subtotals plus the exchange-rate effect.
    let (net_increase, net_increase_year_to_date) = apply_cash_flow_control_lines(&mut items);
    let net_increase_comparative = apply_cash_flow_comparative_control_lines(&mut items);
    let first_period_id: String = sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? ORDER BY period_month LIMIT 1",
    )
    .bind(&company_id)
    .bind(period_year)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("读取年度起始账期失败: {error}"))?;
    let (opening_cash_balance, ytd_opening_cash_balance, ending_cash_balance) =
        if let Some(formula) = control_formula.as_deref() {
            (
                evaluate_statement_formula(
                    formula,
                    &company_id,
                    period_id,
                    FormulaPeriodScope::Current,
                    BareFormulaMeasure::OpeningBalance,
                    pool,
                )
                .await,
                evaluate_statement_formula(
                    formula,
                    &company_id,
                    &first_period_id,
                    FormulaPeriodScope::Current,
                    BareFormulaMeasure::OpeningBalance,
                    pool,
                )
                .await,
                evaluate_statement_formula(
                    formula,
                    &company_id,
                    period_id,
                    FormulaPeriodScope::Current,
                    BareFormulaMeasure::ClosingBalance,
                    pool,
                )
                .await,
            )
        } else {
            (0.0, 0.0, 0.0)
        };
    let cash_balance_change = ending_cash_balance - opening_cash_balance;
    let cash_balance_change_year_to_date = ending_cash_balance - ytd_opening_cash_balance;
    let reconciliation_difference = cash_balance_change - net_increase;
    let reconciliation_difference_year_to_date =
        cash_balance_change_year_to_date - net_increase_year_to_date;
    let is_classification_complete = mapped_amounts
        .as_ref()
        .map(|mapped| {
            mapped.unmapped_cash_amount < 0.01
                && mapped.unmapped_cash_amount_year_to_date < 0.01
                && mapped.mapping_conflict_count == 0
        })
        .unwrap_or(false);
    let is_reconciled = control_formula.is_some()
        && reconciliation_difference.abs() < 0.01
        && reconciliation_difference_year_to_date.abs() < 0.01
        && (mapped_amounts.is_none() || is_classification_complete);
    let classification_mode = if mapped_amounts.is_some() {
        "voucher_mapping"
    } else {
        "account_formula"
    };
    apply_cash_flow_balance_lines(
        &mut items,
        opening_cash_balance,
        ytd_opening_cash_balance,
        ending_cash_balance,
    );
    if let (Some(formula), Some(comparative_period_id)) =
        (control_formula.as_deref(), comparative_period_id.as_deref())
    {
        let comparative_first_period_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? ORDER BY period_month LIMIT 1",
        )
        .bind(&company_id)
        .bind(period_year - 1)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取现金流量表上期年度起始账期失败: {error}"))?;
        if let Some(comparative_first_period_id) = comparative_first_period_id {
            let comparative_opening = evaluate_statement_formula(
                formula,
                &company_id,
                &comparative_first_period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::OpeningBalance,
                pool,
            )
            .await;
            let comparative_ending = evaluate_statement_formula(
                formula,
                &company_id,
                comparative_period_id,
                FormulaPeriodScope::Current,
                BareFormulaMeasure::ClosingBalance,
                pool,
            )
            .await;
            set_cash_flow_comparative_amount(&mut items, "CF500", comparative_opening);
            if items.iter().any(|item| item.item_code == "CF500") {
                set_cash_flow_comparative_amount(&mut items, "CF999", comparative_ending);
            }
        }
    }
    let column_basis = if matches!(
        template.accounting_system.as_str(),
        "enterprise" | "non_profit"
    ) {
        "current_comparative"
    } else {
        "monthly_ytd"
    };

    Ok(CashFlowResult {
        period_id: period_id.to_string(),
        template_name: template.template_name,
        accounting_system: template.accounting_system,
        form_code: template.form_code,
        reporting_frequency: template.reporting_frequency,
        is_statutory: template.is_statutory != 0,
        column_basis: column_basis.to_string(),
        has_comparative_period: comparative_period_id.is_some(),
        items,
        net_increase,
        net_increase_year_to_date,
        net_increase_comparative,
        opening_cash_balance,
        ending_cash_balance,
        cash_balance_change,
        cash_balance_change_year_to_date,
        reconciliation_difference,
        reconciliation_difference_year_to_date,
        is_reconciled,
        classification_mode: classification_mode.to_string(),
        unmapped_cash_amount: mapped_amounts
            .as_ref()
            .map(|mapped| mapped.unmapped_cash_amount)
            .unwrap_or(0.0),
        unmapped_cash_amount_year_to_date: mapped_amounts
            .as_ref()
            .map(|mapped| mapped.unmapped_cash_amount_year_to_date)
            .unwrap_or(0.0),
        unmapped_voucher_count: mapped_amounts
            .as_ref()
            .map(|mapped| mapped.unmapped_voucher_count)
            .unwrap_or(0),
        mapping_conflict_count: mapped_amounts
            .as_ref()
            .map(|mapped| mapped.mapping_conflict_count)
            .unwrap_or(0),
        is_classification_complete,
    })
}

#[tauri::command]
pub async fn get_cash_flow_statement(
    period_id: String,
    db: State<'_, Database>,
) -> Result<CashFlowResult, String> {
    build_cash_flow_statement(db.pool(), &period_id).await
}

// ==================== Report Template CRUD ====================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReportTemplate {
    pub id: String,
    pub template_code: String,
    pub template_name: String,
    pub report_type: String,
    pub company_id: Option<String>,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: i32,
    pub is_system: i32,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReportItem {
    pub id: String,
    pub template_id: String,
    pub item_code: String,
    pub item_name: String,
    pub parent_id: Option<String>,
    pub item_level: i32,
    pub sort_order: i32,
    pub is_total: i32,
    pub formula: Option<String>,
    pub line_number: Option<String>,
    pub calculation_sign: i32,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReportSnapshot {
    pub id: String,
    pub company_id: String,
    pub period_id: String,
    pub report_type: String,
    pub version: i32,
    pub template_id: Option<String>,
    pub template_name: String,
    pub snapshot_json: String,
    pub source_fingerprint: String,
    pub template_fingerprint: Option<String>,
    pub generated_by: String,
    pub generated_at: String,
    pub published_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct ReportMappingFingerprintRow {
    report_item_id: String,
    account_code: String,
    operation_type: String,
    coefficient: f64,
    is_enabled: i32,
}

struct BuiltReportSnapshot {
    report_type: String,
    template_id: String,
    template_name: String,
    snapshot_json: String,
    source_fingerprint: String,
    template_fingerprint: String,
}

fn stable_report_fingerprint(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

async fn report_template_fingerprint(
    pool: &DbPool,
    template: &ReportTemplate,
) -> Result<String, String> {
    let items: Vec<ReportItem> = sqlx::query_as(
        "SELECT * FROM report_items WHERE template_id = ? ORDER BY sort_order, item_code, id",
    )
    .bind(&template.id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取报表模板项目失败: {error}"))?;
    let mappings: Vec<ReportMappingFingerprintRow> = sqlx::query_as(
        r#"SELECT mapping.report_item_id, mapping.account_code, mapping.operation_type,
                  mapping.coefficient, mapping.is_enabled
           FROM report_account_mappings mapping
           JOIN report_items item ON item.id = mapping.report_item_id
           WHERE item.template_id = ?
           ORDER BY mapping.report_item_id, mapping.account_code, mapping.id"#,
    )
    .bind(&template.id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取报表模板科目映射失败: {error}"))?;
    let source = serde_json::to_string(&serde_json::json!({
        "template": template,
        "items": items,
        "mappings": mappings,
    }))
    .map_err(|error| format!("序列化报表模板失败: {error}"))?;
    Ok(stable_report_fingerprint(&source))
}

async fn quarter_period_ids(pool: &DbPool, period_id: &str) -> Result<Vec<String>, String> {
    let (company_id, year, month): (String, i32, i32) = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取报表账期失败: {error}"))?
    .ok_or_else(|| "会计期间不存在".to_string())?;
    let quarter_start = ((month - 1) / 3) * 3 + 1;
    let period_ids: Vec<String> = sqlx::query_scalar(
        r#"SELECT id FROM accounting_periods
           WHERE company_id = ? AND period_year = ? AND period_month BETWEEN ? AND ?
           ORDER BY period_month"#,
    )
    .bind(company_id)
    .bind(year)
    .bind(quarter_start)
    .bind(month)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取季度报表账期失败: {error}"))?;
    if period_ids.is_empty() {
        Err("季度范围内没有可用会计期间".to_string())
    } else {
        Ok(period_ids)
    }
}

async fn build_income_quarter(
    pool: &DbPool,
    period_id: &str,
) -> Result<IncomeStatementResult, String> {
    let mut reports = Vec::new();
    for quarter_period_id in quarter_period_ids(pool, period_id).await? {
        reports.push(build_income_statement(pool, &quarter_period_id).await?);
    }
    let mut latest = reports
        .last()
        .cloned()
        .ok_or_else(|| "季度范围内没有利润表账期".to_string())?;
    for item in &mut latest.items {
        item.current_amount = reports
            .iter()
            .filter_map(|report| {
                report
                    .items
                    .iter()
                    .find(|candidate| candidate.item_code == item.item_code)
            })
            .map(|candidate| candidate.current_amount)
            .sum();
        item.current_unrestricted_amount = reports
            .iter()
            .filter_map(|report| {
                report
                    .items
                    .iter()
                    .find(|candidate| candidate.item_code == item.item_code)
            })
            .map(|candidate| candidate.current_unrestricted_amount)
            .sum();
        item.current_restricted_amount = reports
            .iter()
            .filter_map(|report| {
                report
                    .items
                    .iter()
                    .find(|candidate| candidate.item_code == item.item_code)
            })
            .map(|candidate| candidate.current_restricted_amount)
            .sum();
    }
    latest.current_period_total = reports
        .iter()
        .map(|report| report.current_period_total)
        .sum();
    latest.period_id = period_id.to_string();
    Ok(latest)
}

async fn build_cash_flow_quarter(pool: &DbPool, period_id: &str) -> Result<CashFlowResult, String> {
    let mut reports = Vec::new();
    for quarter_period_id in quarter_period_ids(pool, period_id).await? {
        reports.push(build_cash_flow_statement(pool, &quarter_period_id).await?);
    }
    let mut latest = reports
        .last()
        .cloned()
        .ok_or_else(|| "季度范围内没有现金流量表账期".to_string())?;
    for item in &mut latest.items {
        if item.item_code != "CF999" {
            item.current_amount = reports
                .iter()
                .filter_map(|report| {
                    report
                        .items
                        .iter()
                        .find(|candidate| candidate.item_code == item.item_code)
                })
                .map(|candidate| candidate.current_amount)
                .sum();
        }
    }
    latest.opening_cash_balance = reports
        .first()
        .map(|report| report.opening_cash_balance)
        .unwrap_or(0.0);
    latest.net_increase = reports.iter().map(|report| report.net_increase).sum();
    latest.cash_balance_change = latest.ending_cash_balance - latest.opening_cash_balance;
    latest.reconciliation_difference = latest.cash_balance_change - latest.net_increase;
    latest.classification_mode = if reports
        .iter()
        .all(|report| report.classification_mode == "voucher_mapping")
    {
        "voucher_mapping".to_string()
    } else {
        "account_formula".to_string()
    };
    latest.unmapped_cash_amount = reports
        .iter()
        .map(|report| report.unmapped_cash_amount)
        .sum();
    latest.unmapped_voucher_count = reports
        .iter()
        .map(|report| report.unmapped_voucher_count)
        .sum();
    latest.mapping_conflict_count = reports
        .iter()
        .map(|report| report.mapping_conflict_count)
        .sum();
    latest.is_classification_complete = latest.classification_mode == "voucher_mapping"
        && reports
            .iter()
            .all(|report| report.is_classification_complete);
    latest.is_reconciled = latest.reconciliation_difference.abs() < 0.01
        && latest.reconciliation_difference_year_to_date.abs() < 0.01
        && latest.is_classification_complete;
    latest.period_id = period_id.to_string();
    Ok(latest)
}

async fn find_report_template_for_company(
    pool: &DbPool,
    company_id: &str,
    report_type: &str,
) -> Result<ReportTemplate, String> {
    sqlx::query_as(
        r#"SELECT t.*
           FROM companies c
           JOIN report_templates t
             ON t.company_id = c.id
             OR (t.company_id IS NULL AND t.accounting_system = c.accounting_system AND t.is_system = 1)
           WHERE c.id = ? AND t.report_type = ?
           ORDER BY CASE WHEN t.company_id = c.id THEN 0 ELSE 1 END,
                    t.is_statutory DESC, t.template_name
           LIMIT 1"#,
    )
    .bind(company_id)
    .bind(report_type)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {e}"))?
    .ok_or_else(|| format!("当前会计准则未配置{}模板", report_type))
}

async fn ensure_report_template_access(
    pool: &DbPool,
    company_id: &str,
    template_id: &str,
) -> Result<(), String> {
    let accessible: Option<String> = sqlx::query_scalar(
        r#"SELECT t.id
           FROM companies c
           JOIN report_templates t
             ON t.company_id = c.id
             OR (t.company_id IS NULL AND t.accounting_system = c.accounting_system)
           WHERE c.id = ? AND t.id = ?"#,
    )
    .bind(company_id)
    .bind(template_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {e}"))?;

    if accessible.is_some() {
        Ok(())
    } else {
        Err("报表模板不存在或不属于当前账套会计准则".to_string())
    }
}

async fn ensure_report_template_mutable(
    pool: &DbPool,
    company_id: &str,
    template_id: &str,
) -> Result<(), String> {
    let owner: Option<(Option<String>, i32)> =
        sqlx::query_as("SELECT company_id, is_system FROM report_templates WHERE id = ?")
            .bind(template_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("Database error: {error}"))?;
    let (owner_company_id, is_system) = owner.ok_or_else(|| "报表模板不存在".to_string())?;
    if is_system == 1 || owner_company_id.as_deref() != Some(company_id) {
        return Err("系统标准模板只读，请先复制为当前账套模板后再修改".to_string());
    }
    Ok(())
}

async fn build_report_snapshot_payload(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    report_type: &str,
) -> Result<BuiltReportSnapshot, String> {
    let period_company_id: Option<String> =
        sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
            .bind(period_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取报表账期失败: {error}"))?;
    if period_company_id.as_deref() != Some(company_id) {
        return Err("会计期间不存在或不属于当前账套".to_string());
    }

    let template_report_type = match report_type {
        "balance_sheet" => "balance_sheet",
        "income_statement" | "income_quarter" => "income_statement",
        "cash_flow" | "cash_flow_quarter" => "cash_flow",
        "equity_change" => "equity_change",
        _ => return Err("不支持发布该报表类型的快照".to_string()),
    };
    let template = find_report_template_for_company(pool, company_id, template_report_type).await?;
    if template.is_statutory != 1 {
        return Err("内部管理分析不能发布为法定报表快照".to_string());
    }
    if matches!(report_type, "income_quarter" | "cash_flow_quarter")
        && !template.reporting_frequency.contains('季')
    {
        return Err("当前法定模板不支持季度报表发布".to_string());
    }

    let report = match report_type {
        "balance_sheet" => {
            let report = build_balance_sheet(pool, period_id).await?;
            if !report.is_statutory {
                return Err("当前资产负债表不是法定报表".to_string());
            }
            if !report.is_balanced {
                return Err("资产负债表未平衡，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        "income_statement" => {
            let report = build_income_statement(pool, period_id).await?;
            if !report.is_statutory {
                return Err("当前利润表不是法定报表".to_string());
            }
            if !report.classification_complete {
                return Err("利润表分栏分类未完成，不能发布快照".to_string());
            }
            if report.column_basis == "current_comparative" && !report.has_comparative_period {
                return Err("利润表缺少法定上期比较数据，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        "income_quarter" => {
            let report = build_income_quarter(pool, period_id).await?;
            if !report.is_statutory || !report.classification_complete {
                return Err("季度利润表未完成法定分类，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        "cash_flow" => {
            let report = build_cash_flow_statement(pool, period_id).await?;
            if !report.is_statutory {
                return Err("当前现金流量表不是法定报表".to_string());
            }
            if report.classification_mode != "voucher_mapping"
                || !report.is_classification_complete
                || !report.is_reconciled
            {
                return Err("现金流量表凭证映射或勾稽未完成，不能发布快照".to_string());
            }
            if report.column_basis == "current_comparative" && !report.has_comparative_period {
                return Err("现金流量表缺少法定上期比较数据，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        "cash_flow_quarter" => {
            let report = build_cash_flow_quarter(pool, period_id).await?;
            if !report.is_statutory
                || report.classification_mode != "voucher_mapping"
                || !report.is_classification_complete
                || !report.is_reconciled
            {
                return Err("季度现金流量表凭证映射或勾稽未完成，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        "equity_change" => {
            let report = build_equity_change_statement(pool, period_id).await?;
            if !report.is_statutory || !report.classification_complete {
                return Err("权益变动表分类未完成，不能发布快照".to_string());
            }
            if report.accounting_system == "enterprise"
                && (!report.has_comparative_period || !report.comparative_classification_complete)
            {
                return Err("权益变动表缺少完整的上年比较分类，不能发布快照".to_string());
            }
            serde_json::to_value(report)
        }
        _ => unreachable!(),
    }
    .map_err(|error| format!("序列化报表快照失败: {error}"))?;

    let snapshot_json = serde_json::to_string(&serde_json::json!({
        "schemaVersion": 1,
        "companyId": company_id,
        "periodId": period_id,
        "reportType": report_type,
        "report": report,
    }))
    .map_err(|error| format!("序列化报表快照失败: {error}"))?;
    let source_fingerprint = stable_report_fingerprint(&snapshot_json);
    let template_fingerprint = report_template_fingerprint(pool, &template).await?;

    Ok(BuiltReportSnapshot {
        report_type: report_type.to_string(),
        template_id: template.id,
        template_name: template.template_name,
        snapshot_json,
        source_fingerprint,
        template_fingerprint,
    })
}

#[tauri::command]
pub async fn publish_report_snapshot(
    company_id: String,
    period_id: String,
    report_type: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ReportSnapshot, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let payload =
        build_report_snapshot_payload(db.pool(), &company_id, &period_id, &report_type).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建报表快照事务失败: {error}"))?;
    let version: i32 = sqlx::query_scalar(
        r#"SELECT COALESCE(MAX(version), 0) + 1 FROM report_snapshots
           WHERE company_id = ? AND period_id = ? AND report_type = ?"#,
    )
    .bind(&company_id)
    .bind(&period_id)
    .bind(&payload.report_type)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("生成报表快照版本失败: {error}"))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO report_snapshots
           (id, company_id, period_id, report_type, version, template_id, template_name,
            snapshot_json, source_fingerprint, template_fingerprint, generated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&company_id)
    .bind(&period_id)
    .bind(&payload.report_type)
    .bind(version)
    .bind(&payload.template_id)
    .bind(&payload.template_name)
    .bind(&payload.snapshot_json)
    .bind(&payload.source_fingerprint)
    .bind(&payload.template_fingerprint)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("发布报表快照失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '财务报表', '发布报表快照', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&company_id)
    .bind(format!("{}#v{}", payload.report_type, version))
    .bind(format!(
        "账期 {}，来源指纹 {}，模板指纹 {}",
        period_id, payload.source_fingerprint, payload.template_fingerprint
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入报表发布审计失败: {error}"))?;
    let snapshot: ReportSnapshot = sqlx::query_as("SELECT * FROM report_snapshots WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取报表快照失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交报表快照失败: {error}"))?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn get_report_snapshots(
    company_id: String,
    period_id: String,
    report_type: String,
    db: State<'_, Database>,
) -> Result<Vec<ReportSnapshot>, String> {
    sqlx::query_as(
        r#"SELECT * FROM report_snapshots
           WHERE company_id = ? AND period_id = ? AND report_type = ?
           ORDER BY version DESC"#,
    )
    .bind(company_id)
    .bind(period_id)
    .bind(report_type)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取报表历史版本失败: {error}"))
}

#[tauri::command]
pub async fn get_report_snapshot(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<ReportSnapshot, String> {
    sqlx::query_as("SELECT * FROM report_snapshots WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|error| format!("读取报表快照失败: {error}"))?
        .ok_or_else(|| "报表快照不存在或不属于当前账套".to_string())
}

#[tauri::command]
pub async fn get_report_templates(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ReportTemplate>, String> {
    let templates: Vec<ReportTemplate> = sqlx::query_as(
        r#"SELECT t.*
           FROM companies c
           JOIN report_templates t
             ON t.company_id = c.id
             OR (t.company_id IS NULL AND t.accounting_system = c.accounting_system AND t.is_system = 1)
           WHERE c.id = ?
           ORDER BY t.report_type,
                    CASE WHEN t.company_id = c.id THEN 0 ELSE 1 END,
                    t.is_statutory DESC, t.template_name"#,
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(templates)
}

async fn clone_report_template_record(
    pool: &DbPool,
    template_id: &str,
    company_id: &str,
) -> Result<ReportTemplate, String> {
    ensure_report_template_access(pool, company_id, template_id).await?;
    let source: ReportTemplate = sqlx::query_as("SELECT * FROM report_templates WHERE id = ?")
        .bind(template_id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("读取源报表模板失败: {error}"))?;
    if source.company_id.as_deref() == Some(company_id) {
        return Ok(source);
    }
    if let Some(existing) = sqlx::query_as::<_, ReportTemplate>(
        "SELECT * FROM report_templates WHERE company_id = ? AND report_type = ? LIMIT 1",
    )
    .bind(company_id)
    .bind(&source.report_type)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取账套报表模板失败: {error}"))?
    {
        return Ok(existing);
    }

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建账套报表模板事务失败: {error}"))?;
    let cloned_id = uuid::Uuid::new_v4().to_string();
    let cloned_code = format!(
        "CUSTOM_{}_{}",
        source.template_code,
        uuid::Uuid::new_v4().simple()
    );
    let cloned_name = format!("{}（账套自定义）", source.template_name);
    sqlx::query(
        r#"INSERT INTO report_templates (
               id, template_code, template_name, report_type, company_id,
               accounting_system, form_code, reporting_frequency, is_statutory, is_system
           ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, 0)"#,
    )
    .bind(&cloned_id)
    .bind(&cloned_code)
    .bind(&cloned_name)
    .bind(&source.report_type)
    .bind(company_id)
    .bind(&source.accounting_system)
    .bind(&source.reporting_frequency)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("创建账套报表模板失败: {error}"))?;

    let source_items: Vec<ReportItem> =
        sqlx::query_as("SELECT * FROM report_items WHERE template_id = ? ORDER BY sort_order")
            .bind(template_id)
            .fetch_all(&mut *transaction)
            .await
            .map_err(|error| format!("读取源报表项目失败: {error}"))?;
    let item_id_map: std::collections::HashMap<String, String> = source_items
        .iter()
        .map(|item| (item.id.clone(), uuid::Uuid::new_v4().to_string()))
        .collect();
    for item in &source_items {
        let new_item_id = item_id_map
            .get(&item.id)
            .expect("cloned item id should exist");
        let parent_id = item
            .parent_id
            .as_ref()
            .and_then(|parent| item_id_map.get(parent))
            .cloned();
        sqlx::query(
            r#"INSERT INTO report_items (
                   id, template_id, item_code, item_name, parent_id, item_level,
                   sort_order, is_total, formula, line_number, calculation_sign, is_enabled
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(new_item_id)
        .bind(&cloned_id)
        .bind(&item.item_code)
        .bind(&item.item_name)
        .bind(parent_id)
        .bind(item.item_level)
        .bind(item.sort_order)
        .bind(item.is_total)
        .bind(&item.formula)
        .bind(&item.line_number)
        .bind(item.calculation_sign)
        .bind(item.is_enabled)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("复制报表项目失败: {error}"))?;

        let mappings: Vec<(String, String, f64, i32)> = sqlx::query_as(
            "SELECT account_code, operation_type, coefficient, is_enabled FROM report_account_mappings WHERE report_item_id = ?",
        )
        .bind(&item.id)
        .fetch_all(&mut *transaction)
        .await
        .map_err(|error| format!("读取报表科目映射失败: {error}"))?;
        for (account_code, operation_type, coefficient, is_enabled) in mappings {
            sqlx::query(
                "INSERT INTO report_account_mappings (id, report_item_id, account_code, operation_type, coefficient, is_enabled) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(new_item_id)
            .bind(account_code)
            .bind(operation_type)
            .bind(coefficient)
            .bind(is_enabled)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("复制报表科目映射失败: {error}"))?;
        }
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交账套报表模板失败: {error}"))?;

    sqlx::query_as("SELECT * FROM report_templates WHERE id = ?")
        .bind(&cloned_id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("读取账套报表模板失败: {error}"))
}

#[tauri::command]
pub async fn clone_report_template_for_company(
    template_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<ReportTemplate, String> {
    clone_report_template_record(db.pool(), &template_id, &company_id).await
}

#[tauri::command]
pub async fn get_report_items(
    template_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ReportItem>, String> {
    ensure_report_template_access(db.pool(), &company_id, &template_id).await?;

    let items: Vec<ReportItem> =
        sqlx::query_as("SELECT * FROM report_items WHERE template_id = ? ORDER BY sort_order")
            .bind(&template_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    Ok(items)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateReportItemInput {
    pub id: String,
    pub item_name: Option<String>,
    pub formula: Option<String>,
    pub sort_order: Option<i32>,
    pub is_total: Option<i32>,
    pub line_number: Option<String>,
    pub calculation_sign: Option<i32>,
}

async fn write_report_formula_note(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    company_id: &str,
    template_id: &str,
    report_item_id: Option<&str>,
    action: &str,
    before: Option<&ReportItem>,
    after: Option<&ReportItem>,
    operator: &str,
) -> Result<(), String> {
    let before_json = before
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("序列化报表公式修改前数据失败: {error}"))?;
    let after_json = after
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("序列化报表公式修改后数据失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO report_formula_notes
           (id, company_id, template_id, report_item_id, action, before_json, after_json, operator)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(template_id)
    .bind(report_item_id)
    .bind(action)
    .bind(before_json)
    .bind(after_json)
    .bind(operator)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("写入报表公式变更记录失败: {error}"))?;
    Ok(())
}

async fn write_report_formula_operation_audit(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    company_id: &str,
    action: &str,
    item: &ReportItem,
    operator: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '报表公式', ?, ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(action)
    .bind(&item.id)
    .bind(format!("{} ({})", item.item_name, item.item_code))
    .bind(operator)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("写入报表公式操作审计失败: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn update_report_item(
    input: UpdateReportItemInput,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ReportItem, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let existing: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Item not found: {}", e))?;
    ensure_report_template_access(db.pool(), &company_id, &existing.template_id).await?;
    ensure_report_template_mutable(db.pool(), &company_id, &existing.template_id).await?;

    let item_name = input
        .item_name
        .unwrap_or_else(|| existing.item_name.clone());
    let formula = input.formula.or_else(|| existing.formula.clone());
    let sort_order = input.sort_order.unwrap_or(existing.sort_order);
    let is_total = input.is_total.unwrap_or(existing.is_total);
    let line_number = input
        .line_number
        .or_else(|| existing.line_number.clone())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let calculation_sign = input.calculation_sign.unwrap_or(existing.calculation_sign);
    if !matches!(calculation_sign, -1 | 1) {
        return Err("报表项目汇总方向只能为加项或减项".to_string());
    }

    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建报表公式修改事务失败: {error}"))?;
    sqlx::query(
        "UPDATE report_items SET item_name = ?, formula = ?, sort_order = ?, is_total = ?, line_number = ?, calculation_sign = ? WHERE id = ?",
    )
    .bind(&item_name)
    .bind(&formula)
    .bind(sort_order)
    .bind(is_total)
    .bind(&line_number)
    .bind(calculation_sign)
    .bind(&input.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to update report item: {}", e))?;

    let item: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&input.id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to fetch updated item: {}", e))?;

    write_report_formula_note(
        &mut transaction,
        &company_id,
        &existing.template_id,
        Some(&item.id),
        "update",
        Some(&existing),
        Some(&item),
        &actor,
    )
    .await?;
    write_report_formula_operation_audit(
        &mut transaction,
        &company_id,
        "修改报表项目",
        &item,
        &actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交报表公式修改失败: {error}"))?;

    Ok(item)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_report_item(
    template_id: String,
    item_code: String,
    item_name: String,
    item_level: i32,
    sort_order: i32,
    is_total: i32,
    formula: Option<String>,
    line_number: Option<String>,
    calculation_sign: Option<i32>,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ReportItem, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    ensure_report_template_access(db.pool(), &company_id, &template_id).await?;
    ensure_report_template_mutable(db.pool(), &company_id, &template_id).await?;

    let id = uuid::Uuid::new_v4().to_string();
    let line_number = line_number
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let calculation_sign = calculation_sign.unwrap_or(1);
    if !matches!(calculation_sign, -1 | 1) {
        return Err("报表项目汇总方向只能为加项或减项".to_string());
    }

    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建报表项目事务失败: {error}"))?;
    sqlx::query(
        "INSERT INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula, line_number, calculation_sign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&template_id)
    .bind(&item_code)
    .bind(&item_name)
    .bind(item_level)
    .bind(sort_order)
    .bind(is_total)
    .bind(&formula)
    .bind(&line_number)
    .bind(calculation_sign)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create report item: {}", e))?;

    let item: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to fetch created item: {}", e))?;

    write_report_formula_note(
        &mut transaction,
        &company_id,
        &template_id,
        Some(&item.id),
        "create",
        None,
        Some(&item),
        &actor,
    )
    .await?;
    write_report_formula_operation_audit(
        &mut transaction,
        &company_id,
        "新增报表项目",
        &item,
        &actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交报表项目失败: {error}"))?;

    Ok(item)
}

#[tauri::command]
pub async fn delete_report_item(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let existing: Option<ReportItem> = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let existing = existing.ok_or_else(|| "报表项目不存在".to_string())?;
    let template_id = existing.template_id.clone();
    ensure_report_template_access(db.pool(), &company_id, &template_id).await?;
    ensure_report_template_mutable(db.pool(), &company_id, &template_id).await?;

    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建报表项目删除事务失败: {error}"))?;
    sqlx::query("DELETE FROM report_account_mappings WHERE report_item_id = ?")
        .bind(&id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("删除报表项目科目映射失败: {error}"))?;
    sqlx::query("DELETE FROM report_items WHERE id = ?")
        .bind(&id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to delete report item: {}", e))?;
    write_report_formula_note(
        &mut transaction,
        &company_id,
        &template_id,
        Some(&existing.id),
        "delete",
        Some(&existing),
        None,
        &actor,
    )
    .await?;
    write_report_formula_operation_audit(
        &mut transaction,
        &company_id,
        "删除报表项目",
        &existing,
        &actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交报表项目删除失败: {error}"))?;
    Ok(())
}

fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

#[cfg(test)]
mod report_formula_tests {
    use super::{
        formula_balance_value, period_activity_value, scoped_formula_rule, FormulaBalanceTotals,
        FormulaPeriodScope,
    };

    #[test]
    fn formula_rules_use_real_closing_and_ytd_totals() {
        let totals = FormulaBalanceTotals {
            opening_debit: 100.0,
            opening_credit: 0.0,
            period_debit: 30.0,
            period_credit: 20.0,
            closing_debit: 110.0,
            closing_credit: 0.0,
            cumulative_debit: 330.0,
            cumulative_credit: 220.0,
        };

        assert_eq!(
            formula_balance_value("closing_debit", "debit", &totals),
            110.0
        );
        assert_eq!(
            formula_balance_value("closing_credit", "debit", &totals),
            0.0
        );
        assert_eq!(
            formula_balance_value("cumulative_debit", "debit", &totals),
            330.0
        );
        assert_eq!(
            formula_balance_value("cumulative_credit", "debit", &totals),
            220.0
        );
        assert_eq!(formula_balance_value("opening", "debit", &totals), 100.0);
    }

    #[test]
    fn income_activity_respects_the_account_normal_balance() {
        assert_eq!(period_activity_value("debit", 130.0, 20.0), 110.0);
        assert_eq!(period_activity_value("credit", 20.0, 130.0), 110.0);
    }

    #[test]
    fn statement_rules_switch_activity_to_ytd_without_accumulating_balances() {
        assert_eq!(
            scoped_formula_rule("debit", FormulaPeriodScope::Current),
            "period_debit"
        );
        assert_eq!(
            scoped_formula_rule("debit", FormulaPeriodScope::YearToDate),
            "cumulative_debit"
        );
        assert_eq!(
            scoped_formula_rule("closing_d", FormulaPeriodScope::YearToDate),
            "closing_debit"
        );
    }

    #[test]
    fn income_totals_roll_forward_through_profit_before_tax_and_net_profit() {
        let mut running = 0.0;
        assert_eq!(
            super::income_line_amount(&mut running, 0, true, 1, 100.0),
            100.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 0, true, -1, 40.0),
            40.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 1, false, 1, 0.0),
            60.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 0, true, 1, 10.0),
            10.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 0, true, -1, 5.0),
            5.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 1, false, 1, 0.0),
            65.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 0, true, -1, 15.0),
            15.0
        );
        assert_eq!(
            super::income_line_amount(&mut running, 1, false, 1, 0.0),
            50.0
        );
    }

    #[test]
    fn cash_flow_totals_subtract_outflows_and_reset_between_sections() {
        let mut running = 0.0;
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 0, true, 1, 100.0),
            100.0
        );
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 0, true, -1, 40.0),
            40.0
        );
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 1, false, 1, 0.0),
            60.0
        );
        assert_eq!(running, 0.0);
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 0, true, -1, 10.0),
            10.0
        );
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 1, false, 1, 0.0),
            -10.0
        );
        assert_eq!(
            super::cash_flow_line_amount(&mut running, 1, true, 1, 90.0),
            90.0
        );
    }

    #[test]
    fn cash_flow_net_increase_rows_receive_the_control_total() {
        let row = |code: &str, name: &str, current: f64, year_to_date: f64| super::CashFlowItem {
            item_code: code.to_string(),
            item_name: name.to_string(),
            line_number: None,
            item_level: 1,
            is_total: 1,
            current_amount: current,
            year_to_date,
            comparative_amount: 0.0,
        };
        let mut rows = vec![
            row("CF199", "经营活动产生的现金流量净额", 100.0, 180.0),
            row("CF299", "投资活动产生的现金流量净额", -40.0, -55.0),
            row("CF399", "筹资活动产生的现金流量净额", 10.0, 20.0),
            row("CF400", "四、现金净增加额", 0.0, 0.0),
            row("CF999", "五、期末现金余额", 220.0, 220.0),
        ];

        let (current, year_to_date) = super::apply_cash_flow_control_lines(&mut rows);

        assert_eq!((current, year_to_date), (70.0, 145.0));
        assert_eq!(rows[3].current_amount, 70.0);
        assert_eq!(rows[3].year_to_date, 145.0);
        assert_eq!(rows[4].current_amount, 220.0, "期末余额不能被净增加额覆盖");
    }

    #[test]
    fn enterprise_cash_flow_control_rows_follow_the_statutory_arithmetic() {
        let row = |code: &str, current: f64, year_to_date: f64| super::CashFlowItem {
            item_code: code.to_string(),
            item_name: code.to_string(),
            line_number: None,
            item_level: 2,
            is_total: 0,
            current_amount: current,
            year_to_date,
            comparative_amount: 0.0,
        };
        let mut rows = vec![
            row("CF101", 100.0, 180.0),
            row("CF102", 20.0, 30.0),
            row("CF109", 0.0, 0.0),
            row("CF104", 40.0, 60.0),
            row("CF105", 10.0, 15.0),
            row("CF119", 0.0, 0.0),
            row("CF199", 0.0, 0.0),
            row("CF201", 5.0, 8.0),
            row("CF204", 25.0, 30.0),
            row("CF209", 0.0, 0.0),
            row("CF219", 0.0, 0.0),
            row("CF299", 0.0, 0.0),
            row("CF301", 30.0, 40.0),
            row("CF303", 15.0, 20.0),
            row("CF309", 0.0, 0.0),
            row("CF319", 0.0, 0.0),
            row("CF399", 0.0, 0.0),
            row("CF400", 2.0, 3.0),
            row("CF499", 0.0, 0.0),
            row("CF500", 0.0, 0.0),
            row("CF999", 0.0, 0.0),
        ];

        let (current, year_to_date) = super::apply_cash_flow_control_lines(&mut rows);
        super::apply_cash_flow_balance_lines(&mut rows, 200.0, 125.0, 267.0);
        let amount = |code: &str| {
            let item = rows.iter().find(|item| item.item_code == code).unwrap();
            (item.current_amount, item.year_to_date)
        };

        assert_eq!(amount("CF109"), (120.0, 210.0));
        assert_eq!(amount("CF119"), (50.0, 75.0));
        assert_eq!(amount("CF199"), (70.0, 135.0));
        assert_eq!(amount("CF209"), (5.0, 8.0));
        assert_eq!(amount("CF219"), (25.0, 30.0));
        assert_eq!(amount("CF299"), (-20.0, -22.0));
        assert_eq!(amount("CF309"), (30.0, 40.0));
        assert_eq!(amount("CF319"), (15.0, 20.0));
        assert_eq!(amount("CF399"), (15.0, 20.0));
        assert_eq!((current, year_to_date), (67.0, 136.0));
        assert_eq!(amount("CF499"), (67.0, 136.0));
        assert_eq!(amount("CF500"), (200.0, 125.0));
        assert_eq!(amount("CF999"), (267.0, 267.0));
    }

    #[test]
    fn balance_sheet_control_totals_include_liabilities_and_equity() {
        let row = |code: &str, opening: f64, ending: f64| super::BalanceSheetItem {
            item_code: code.to_string(),
            item_name: code.to_string(),
            line_number: None,
            item_level: 1,
            is_total: 1,
            opening_balance: opening,
            ending_balance: ending,
            section: "control".to_string(),
        };
        let mut rows = vec![
            row("BS999", 90.0, 100.0),
            row("BS599", 50.0, 60.0),
            row("BS699", 40.0, 40.0),
            row("BS799", 0.0, 0.0),
        ];

        let totals = super::finalize_balance_sheet_totals(&mut rows);

        assert_eq!(totals, (100.0, 60.0, 40.0, 90.0, 50.0, 40.0));
        let combined = rows.iter().find(|item| item.item_code == "BS799").unwrap();
        assert_eq!(combined.ending_balance, 100.0);
        assert_eq!(combined.opening_balance, 90.0);
    }

    #[test]
    fn trial_balance_keeps_accounts_with_ytd_activity_only() {
        assert!(super::trial_balance_has_activity(&[
            0.0, 0.0, 0.0, 0.0, 25.0, 0.0, 0.0, 0.0,
        ]));
        assert!(!super::trial_balance_has_activity(&[0.0; 8]));
    }

    #[tokio::test]
    async fn report_formula_queries_use_selected_month_and_true_ytd_activity() {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for statement in [
            "CREATE TABLE accounting_periods (id TEXT PRIMARY KEY, company_id TEXT, period_year INTEGER, period_month INTEGER)",
            "CREATE TABLE account_codes (company_id TEXT, code TEXT, normal_balance TEXT, parent_code TEXT, is_enabled INTEGER, is_detail INTEGER)",
            "CREATE TABLE account_balances (period_id TEXT, account_code TEXT, opening_debit REAL, opening_credit REAL, period_debit REAL, period_credit REAL, closing_debit REAL, closing_credit REAL)",
            "INSERT INTO accounting_periods VALUES ('p1', 'c1', 2026, 1)",
            "INSERT INTO accounting_periods VALUES ('p2', 'c1', 2026, 2)",
            "INSERT INTO account_codes VALUES ('c1', '6001', 'credit', NULL, 1, 1)",
            "INSERT INTO account_balances VALUES ('p1', '6001', 0, 0, 0, 100, 0, 100)",
            "INSERT INTO account_balances VALUES ('p2', '6001', 0, 100, 10, 40, 0, 130)",
        ] {
            sqlx::query(statement).execute(&pool).await.unwrap();
        }

        assert_eq!(
            super::get_account_activity_by_scope(
                "6001",
                "c1",
                "p2",
                super::FormulaPeriodScope::Current,
                &pool,
            )
            .await,
            30.0
        );
        assert_eq!(
            super::get_account_activity_by_scope(
                "6001",
                "c1",
                "p2",
                super::FormulaPeriodScope::YearToDate,
                &pool,
            )
            .await,
            130.0
        );
        assert_eq!(
            super::get_account_balance_by_rule("6001", "c1", "p2", "cumulative_credit", &pool)
                .await,
            140.0
        );
        assert_eq!(
            super::get_account_balance_by_rule("6001", "c1", "p2", "closing_credit", &pool).await,
            130.0
        );
        assert_eq!(
            super::get_account_opening_balance("6001", "c1", "p2", &pool).await,
            100.0
        );
    }
}

#[cfg(test)]
mod transaction_tests {
    use super::{
        create_accounting_period_record, ensure_periods_record, finalize_initial_balances_record,
    };
    use crate::db::{CreatePeriodInput, Database};

    async fn test_database(name: &str) -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-period-{name}-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '测试企业')",
        )
        .execute(database.pool())
        .await
        .expect("creates company");
        (database, data_dir)
    }

    async fn cleanup(database: Database, data_dir: std::path::PathBuf) {
        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn period_creation_rolls_back_period_when_balance_initialization_fails() {
        let (database, data_dir) = test_database("creation-rollback").await;
        for (code, name, account_type) in [
            ("1001", "库存现金", "asset"),
            ("2001", "短期借款", "liability"),
        ] {
            sqlx::query(
                "INSERT INTO account_codes (company_id, code, name, account_type) VALUES ('company-1', ?, ?, ?)",
            )
            .bind(code)
            .bind(name)
            .bind(account_type)
            .execute(database.pool())
            .await
            .expect("creates account code");
        }
        sqlx::query(
            "CREATE TRIGGER reject_second_period_balance BEFORE INSERT ON account_balances WHEN (SELECT COUNT(*) FROM account_balances WHERE period_id = NEW.period_id) >= 1 BEGIN SELECT RAISE(ABORT, 'forced balance failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = create_accounting_period_record(
            CreatePeriodInput {
                company_id: "company-1".to_string(),
                period_year: 2026,
                period_month: 6,
            },
            database.pool(),
        )
        .await;
        assert!(
            result.is_err(),
            "forced initialization failure must surface"
        );

        let period_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM accounting_periods WHERE company_id = 'company-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts periods");
        let balance_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM account_balances")
            .fetch_one(database.pool())
            .await
            .expect("counts balances");
        assert_eq!(period_count, 0);
        assert_eq!(balance_count, 0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn ensuring_year_periods_rolls_back_every_month_on_failure() {
        let (database, data_dir) = test_database("ensure-rollback").await;
        sqlx::query(
            "UPDATE companies SET enable_year = 2026, enable_month = 1 WHERE id = 'company-1'",
        )
        .execute(database.pool())
        .await
        .expect("sets accounting year");
        sqlx::query(
            "CREATE TRIGGER reject_second_accounting_period BEFORE INSERT ON accounting_periods WHEN (SELECT COUNT(*) FROM accounting_periods WHERE company_id = NEW.company_id) >= 1 BEGIN SELECT RAISE(ABORT, 'forced period failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = ensure_periods_record("company-1".to_string(), database.pool()).await;
        assert!(result.is_err(), "forced period failure must surface");

        let period_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM accounting_periods WHERE company_id = 'company-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts generated periods");
        assert_eq!(period_count, 0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn finalizing_initial_balances_rolls_back_every_account_on_failure() {
        let (database, data_dir) = test_database("finalize-rollback").await;
        sqlx::query(
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('period-1', 'company-1', 2026, 6, '2026-06-01', '2026-06-30')",
        )
        .execute(database.pool())
        .await
        .expect("creates period");
        for (id, code, debit, credit) in [
            ("initial-1", "1001", 100.0, 0.0),
            ("initial-2", "2001", 0.0, 100.0),
        ] {
            sqlx::query(
                "INSERT INTO initial_balances (id, period_id, account_code, opening_debit, opening_credit) VALUES (?, 'period-1', ?, ?, ?)",
            )
            .bind(id)
            .bind(code)
            .bind(debit)
            .bind(credit)
            .execute(database.pool())
            .await
            .expect("creates initial balance");
        }
        sqlx::query(
            "CREATE TRIGGER reject_second_final_balance BEFORE INSERT ON account_balances WHEN (SELECT COUNT(*) FROM account_balances WHERE period_id = NEW.period_id) >= 1 BEGIN SELECT RAISE(ABORT, 'forced finalization failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = finalize_initial_balances_record(
            "period-1".to_string(),
            "company-1".to_string(),
            "测试会计",
            database.pool(),
        )
        .await;
        assert!(result.is_err(), "forced finalization failure must surface");

        let balance_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM account_balances WHERE period_id = 'period-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts finalized balances");
        assert_eq!(balance_count, 0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn finalizing_initial_balances_carries_net_opening_into_later_periods() {
        let (database, data_dir) = test_database("finalize-carry-forward").await;
        for statement in [
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('period-1', 'company-1', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('period-2', 'company-1', 2026, 2, '2026-02-01', '2026-02-28')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('company-1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('company-1', '2001', '短期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO initial_balances (id, period_id, account_code, opening_debit, opening_credit) VALUES ('initial-1', 'period-1', '1001', 100, 0)",
            "INSERT INTO initial_balances (id, period_id, account_code, opening_debit, opening_credit) VALUES ('initial-2', 'period-1', '2001', 0, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit, closing_credit) VALUES ('later-1', 'period-2', '1001', 30, 30)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit, closing_debit) VALUES ('later-2', 'period-2', '2001', 20, 20)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds initial balance carry-forward data");
        }

        finalize_initial_balances_record(
            "period-1".to_string(),
            "company-1".to_string(),
            "测试会计",
            database.pool(),
        )
        .await
        .expect("finalizes initial balances");

        let finalized: (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT initial_balances_finalized_at, initial_balances_finalized_by FROM accounting_periods WHERE id = 'period-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads persisted initial balance lock");
        assert!(finalized.0.is_some());
        assert!(finalized.1.is_some());
        assert!(
            finalize_initial_balances_record(
                "period-1".to_string(),
                "company-1".to_string(),
                "测试会计",
                database.pool(),
            )
            .await
            .is_err(),
            "a finalized opening balance cannot be finalized again"
        );

        let cash: (f64, f64, f64, f64) = sqlx::query_as(
            "SELECT opening_debit, opening_credit, closing_debit, closing_credit FROM account_balances WHERE id = 'later-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads carried cash balance");
        let loan: (f64, f64, f64, f64) = sqlx::query_as(
            "SELECT opening_debit, opening_credit, closing_debit, closing_credit FROM account_balances WHERE id = 'later-2'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads carried loan balance");
        assert_eq!(cash, (100.0, 0.0, 70.0, 0.0));
        assert_eq!(loan, (0.0, 100.0, 0.0, 80.0));

        cleanup(database, data_dir).await;
    }
}

#[cfg(test)]
mod report_template_scope_tests {
    use super::{
        build_balance_sheet, build_cash_flow_statement, build_equity_change_statement,
        build_income_statement, build_report_snapshot_payload, clone_report_template_record,
        ensure_report_template_mutable, find_report_template_for_company,
        write_report_formula_note, ReportItem,
    };
    use crate::db::Database;

    async fn test_database(name: &str) -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-report-scope-{name}-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        (database, data_dir)
    }

    async fn cleanup(database: Database, data_dir: std::path::PathBuf) {
        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn company_report_lookup_never_crosses_accounting_systems() {
        let (database, data_dir) = test_database("selection").await;
        for (id, code, system) in [
            ("small-company", "SMALL", "small_enterprise"),
            ("nonprofit-company", "NPO", "non_profit"),
        ] {
            sqlx::query(
                "INSERT INTO companies (id, code, name, accounting_system) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(code)
            .bind(code)
            .bind(system)
            .execute(database.pool())
            .await
            .expect("creates company");
        }

        let small =
            find_report_template_for_company(database.pool(), "small-company", "income_statement")
                .await
                .expect("selects small enterprise statement");
        let nonprofit = find_report_template_for_company(
            database.pool(),
            "nonprofit-company",
            "income_statement",
        )
        .await
        .expect("selects nonprofit statement");

        assert_eq!(small.accounting_system, "small_enterprise");
        assert_eq!(small.template_name, "利润表");
        assert_eq!(small.form_code.as_deref(), Some("会小企 02 表"));
        assert_eq!(nonprofit.accounting_system, "non_profit");
        assert_eq!(nonprofit.template_name, "业务活动表");
        assert_eq!(nonprofit.form_code.as_deref(), Some("会民非 02 表"));
        assert_ne!(small.id, nonprofit.id);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn company_clone_isolated_from_system_template_and_other_companies() {
        let (database, data_dir) = test_database("company-template-clone").await;
        for (id, code) in [("company-a", "A"), ("company-b", "B")] {
            sqlx::query(
                "INSERT INTO companies (id, code, name, accounting_system) VALUES (?, ?, ?, 'small_enterprise')",
            )
            .bind(id)
            .bind(code)
            .bind(code)
            .execute(database.pool())
            .await
            .expect("creates small enterprise company");
        }

        let system_template =
            find_report_template_for_company(database.pool(), "company-a", "income_statement")
                .await
                .expect("selects system income statement");
        let cloned =
            clone_report_template_record(database.pool(), &system_template.id, "company-a")
                .await
                .expect("clones the statement for company A");

        assert_eq!(cloned.company_id.as_deref(), Some("company-a"));
        assert_eq!(cloned.is_system, 0);
        assert_eq!(cloned.is_statutory, 0);
        assert_eq!(cloned.form_code, None);
        assert!(
            ensure_report_template_mutable(database.pool(), "company-a", &system_template.id)
                .await
                .is_err()
        );
        ensure_report_template_mutable(database.pool(), "company-a", &cloned.id)
            .await
            .expect("company clone is mutable by its owner");

        let source_item: (String, String, String) = sqlx::query_as(
            "SELECT id, item_code, item_name FROM report_items WHERE template_id = ? ORDER BY sort_order LIMIT 1",
        )
        .bind(&system_template.id)
        .fetch_one(database.pool())
        .await
        .expect("reads source report item");
        let cloned_item_id: String = sqlx::query_scalar(
            "SELECT id FROM report_items WHERE template_id = ? AND item_code = ?",
        )
        .bind(&cloned.id)
        .bind(&source_item.1)
        .fetch_one(database.pool())
        .await
        .expect("reads cloned report item");
        sqlx::query("UPDATE report_items SET item_name = '账套 A 自定义项目' WHERE id = ?")
            .bind(cloned_item_id)
            .execute(database.pool())
            .await
            .expect("updates only the cloned item");

        let source_name: String =
            sqlx::query_scalar("SELECT item_name FROM report_items WHERE id = ?")
                .bind(&source_item.0)
                .fetch_one(database.pool())
                .await
                .expect("reads unchanged source item");
        assert_eq!(source_name, source_item.2);

        let company_a =
            find_report_template_for_company(database.pool(), "company-a", "income_statement")
                .await
                .expect("company A resolves its clone");
        let company_b =
            find_report_template_for_company(database.pool(), "company-b", "income_statement")
                .await
                .expect("company B resolves the system template");
        assert_eq!(company_a.id, cloned.id);
        assert_eq!(company_b.id, system_template.id);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn report_snapshots_use_stable_server_values_and_formula_notes_keep_both_sides() {
        let (database, data_dir) = test_database("snapshot-and-formula-audit").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('small', 'SMALL', '小企业', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'small', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '3001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('cash', 'current', '1001', 100, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('capital', 'current', '3001', 100, 100)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds report snapshot source");
        }

        let first =
            build_report_snapshot_payload(database.pool(), "small", "current", "balance_sheet")
                .await
                .expect("builds balanced statutory snapshot");
        let second =
            build_report_snapshot_payload(database.pool(), "small", "current", "balance_sheet")
                .await
                .expect("rebuilds the same statutory snapshot");
        assert_eq!(first.source_fingerprint, second.source_fingerprint);
        assert_eq!(first.template_fingerprint, second.template_fingerprint);
        let payload: serde_json::Value =
            serde_json::from_str(&first.snapshot_json).expect("parses snapshot payload");
        assert_eq!(payload["companyId"], "small");
        assert_eq!(payload["periodId"], "current");
        assert_eq!(payload["report"]["is_balanced"], true);

        let system_template =
            find_report_template_for_company(database.pool(), "small", "income_statement")
                .await
                .expect("selects system report template");
        let template = clone_report_template_record(database.pool(), &system_template.id, "small")
            .await
            .expect("clones a mutable company report template");
        let before: ReportItem = sqlx::query_as(
            "SELECT * FROM report_items WHERE template_id = ? ORDER BY sort_order LIMIT 1",
        )
        .bind(&template.id)
        .fetch_one(database.pool())
        .await
        .expect("reads cloned report item");
        let mut after = before.clone();
        after.formula = Some("1001".to_string());
        let mut transaction = database
            .pool()
            .begin()
            .await
            .expect("starts audit transaction");
        write_report_formula_note(
            &mut transaction,
            "small",
            &template.id,
            Some(&before.id),
            "update",
            Some(&before),
            Some(&after),
            "测试会计",
        )
        .await
        .expect("writes immutable formula evidence");
        transaction
            .commit()
            .await
            .expect("commits formula evidence");
        let note: (Option<String>, Option<String>, String) = sqlx::query_as(
            "SELECT before_json, after_json, operator FROM report_formula_notes WHERE report_item_id = ?",
        )
        .bind(&before.id)
        .fetch_one(database.pool())
        .await
        .expect("reads formula evidence");
        assert_ne!(note.0, note.1);
        assert_eq!(note.2, "测试会计");
        assert!(note.1.as_deref().unwrap_or_default().contains("1001"));

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn cooperative_equity_change_uses_the_statutory_template_and_balance_movement() {
        let (database, data_dir) = test_database("cooperative-equity").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('coop', 'COOP', '合作社', 'cooperative')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'coop', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '301', '股金', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('b1', 'p1', '301', 80, 20, 100)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds cooperative equity balance");
        }

        let statement = build_equity_change_statement(database.pool(), "p1")
            .await
            .expect("builds cooperative equity change statement");
        let values = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .expect("contains statutory member-equity row")
                .values
                .clone()
        };

        assert_eq!(statement.template_name, "成员权益变动表");
        assert_eq!(statement.form_code.as_deref(), Some("会农社 03 表"));
        assert!(statement.is_statutory);
        assert_eq!(statement.layout, "statutory_matrix");
        assert_eq!(statement.columns.len(), 6);
        assert_eq!(statement.columns[0].column_name, "股金");
        assert_eq!(statement.columns[4].column_name, "未分配盈余");
        assert_eq!(statement.columns[5].column_name, "成员权益合计");
        assert_eq!(values("EQ100"), vec![80.0, 0.0, 0.0, 0.0, 0.0, 80.0]);
        assert_eq!(values("EQ200"), vec![20.0, 0.0, 0.0, 0.0, 0.0, 20.0]);
        assert_eq!(values("EQ300"), vec![0.0; 6]);
        assert_eq!(values("EQ400"), vec![100.0, 0.0, 0.0, 0.0, 0.0, 100.0]);
        assert!(!statement.has_comparative_period);
        assert!(!statement.classification_complete);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn cooperative_balance_sheet_reconciles_statutory_subtotals_without_double_counting() {
        let (database, data_dir) = test_database("cooperative-balance-sheet").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('coop', 'COOP', '合作社', 'cooperative')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'coop', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '101', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '142', '生产性生物资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '143', '生产性生物资产累计折旧', 'asset', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '151', '固定资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '152', '累计折旧', 'asset', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '153', '在建工程', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '154', '固定资产清理', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '161', '无形资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '162', '累计摊销', 'asset', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '144', '公益性生物资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '171', '长期待摊费用', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '201', '短期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '231', '长期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '235', '专项应付款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '301', '股金', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('cash', 'p1', '101', 100)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('productive-bio', 'p1', '142', 80)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('productive-bio-depreciation', 'p1', '143', 20)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('fixed-asset', 'p1', '151', 60)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('fixed-depreciation', 'p1', '152', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('construction', 'p1', '153', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('fixed-disposal', 'p1', '154', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('intangible', 'p1', '161', 40)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('amortization', 'p1', '162', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('public-bio', 'p1', '144', 3)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('deferred', 'p1', '171', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('short-loan', 'p1', '201', 50)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('long-loan', 'p1', '231', 30)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('special-payable', 'p1', '235', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_credit) VALUES ('capital', 'p1', '301', 170)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds cooperative balance sheet");
        }

        let statement = build_balance_sheet(database.pool(), "p1")
            .await
            .expect("builds cooperative balance sheet");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .expect("contains cooperative balance-sheet row")
                .ending_balance
        };

        assert_eq!(amount("BS202"), 80.0);
        assert_eq!(amount("BS203"), 20.0);
        assert_eq!(amount("BS204"), 60.0);
        assert_eq!(amount("BS210"), 57.0);
        assert_eq!(amount("BS299"), 160.0);
        assert_eq!(amount("BS499"), 40.0);
        assert_eq!(statement.total_assets, 260.0);
        assert_eq!(statement.total_liabilities, 90.0);
        assert_eq!(statement.total_equity, 170.0);
        assert!(statement.is_balanced);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn cooperative_income_statement_reconciles_surplus_and_distribution_lines() {
        let (database, data_dir) = test_database("cooperative-income").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('coop', 'COOP', '合作社', 'cooperative')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'coop', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '501', '经营收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '511', '投资收益', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '521', '经营支出', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '522', '税金及附加', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '523', '管理费用', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '524', '财务费用', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '502', '其他收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '529', '其他支出', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '531', '所得税费用', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '322', '盈余公积', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '332101', '提取盈余公积', 'equity', 'debit', 3, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '332102', '盈余返还', 'equity', 'debit', 3, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '332103', '剩余盈余分配', 'equity', 'debit', 3, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '332104', '转为成员出资', 'equity', 'debit', 3, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '3322', '未分配盈余', 'equity', 'credit', 2, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('revenue', 'p1', '501', 100)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('investment', 'p1', '511', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('operating-cost', 'p1', '521', 30)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('tax', 'p1', '522', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('management', 'p1', '523', 4)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('finance', 'p1', '524', 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('other-income', 'p1', '502', 3)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('other-cost', 'p1', '529', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('income-tax', 'p1', '531', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('reserve-transfer', 'p1', '322', 6)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('reserve-allocation', 'p1', '332101', 8)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('return-allocation', 'p1', '332102', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('remaining-allocation', 'p1', '332103', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('capital-allocation', 'p1', '332104', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit) VALUES ('opening-surplus', 'p1', '3322', 40)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds cooperative surplus statement");
        }

        let statement = build_income_statement(database.pool(), "p1")
            .await
            .expect("builds cooperative surplus statement");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .expect("contains cooperative surplus row")
                .current_amount
        };

        assert_eq!(amount("IS010"), 70.0);
        assert_eq!(amount("IS013"), 71.0);
        assert_eq!(amount("IS015"), 66.0);
        assert_eq!(amount("IS019"), 104.0);
        assert_eq!(amount("IS023"), 87.0);
        assert_eq!(statement.current_period_total, 66.0);
        assert_eq!(statement.year_to_date_total, 66.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn cooperative_equity_change_classifies_member_contributions_with_rules() {
        let (database, data_dir) = test_database("cooperative-equity-classification").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('coop', 'COOP', '合作社', 'cooperative')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'coop', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'coop', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '101', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '301', '股金', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('cash', 'p1', '101', 80, 20, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('capital', 'p1', '301', 80, 20, 100)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('v1', 'coop', 'p1', 'w1', '记-1', 1, '2026-12-15', '成员增加出资', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e1', 'v1', 1, '101', '库存现金', 'debit', 20, '收到成员出资')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e2', 'v1', 2, '301', '股金', 'credit', 20, '成员增加出资')",
            "INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, source_account_code, cash_direction, cash_flow_item_code, summary_keyword, priority, is_enabled) VALUES ('r1', 'coop', 'equity_change', '成员增加出资', '股金增加且摘要包含成员增加出资', '归入成员增加出资', '301', 'increase', 'EQ219', '成员增加出资', 100, 1)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds cooperative equity classification");
        }

        let statement = build_equity_change_statement(database.pool(), "p1")
            .await
            .expect("builds classified cooperative member-equity statement");
        let contribution = statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ219")
            .expect("contains member contribution reason row");

        assert_eq!(contribution.values, vec![20.0, 0.0, 0.0, 0.0, 0.0, 20.0]);
        assert!(statement.classification_complete);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_equity_change_builds_the_statutory_component_matrix() {
        let (database, data_dir) = test_database("enterprise-equity").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'ent', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4201', '库存股', 'equity', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('b1', 'p1', '4001', 100, 20, 120)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('b2', 'p1', '4201', 5, 3, 8)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds enterprise equity balances");
        }

        let statement = build_equity_change_statement(database.pool(), "p1")
            .await
            .expect("builds enterprise equity change statement");
        assert_eq!(statement.form_code.as_deref(), Some("会企 04 表"));
        assert_eq!(statement.layout, "statutory_matrix");
        assert_eq!(statement.columns.len(), 9);
        assert_eq!(statement.columns[0].column_name, "实收资本（或股本）");
        assert_eq!(statement.columns[3].column_name, "减：库存股");
        assert_eq!(statement.columns[8].column_name, "所有者权益合计");

        let values = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .expect("contains statutory equity row")
                .values
                .clone()
        };
        assert_eq!(
            values("EQ200"),
            vec![100.0, 0.0, 0.0, -5.0, 0.0, 0.0, 0.0, 0.0, 95.0]
        );
        assert_eq!(
            values("EQ300"),
            vec![20.0, 0.0, 0.0, -3.0, 0.0, 0.0, 0.0, 0.0, 17.0]
        );
        assert_eq!(
            values("EQ400"),
            vec![120.0, 0.0, 0.0, -8.0, 0.0, 0.0, 0.0, 0.0, 112.0]
        );
        assert!(
            !statement.classification_complete,
            "发生权益变动时必须提示明细原因尚待分类"
        );

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_equity_change_classifies_approved_vouchers_with_structured_rules() {
        let (database, data_dir) = test_database("enterprise-equity-classification").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'ent', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'ent', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1002', '银行存款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('cash', 'p1', '1002', 100, 20, 120)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('capital', 'p1', '4001', 100, 20, 120)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('v1', 'ent', 'p1', 'w1', '记-1', 1, '2026-12-15', '股东投入资本', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e1', 'v1', 1, '1002', '银行存款', 'debit', 20, '收到投资款')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e2', 'v1', 2, '4001', '实收资本', 'credit', 20, '股东投入普通股')",
            "INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, source_account_code, cash_direction, cash_flow_item_code, summary_keyword, priority, is_enabled) VALUES ('r1', 'ent', 'equity_change', '普通股投入', '实收资本增加且摘要包含股东投入', '归入所有者投入普通股', '4001', 'increase', 'EQ321', '股东投入', 100, 1)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds structured equity change classification");
        }

        let statement = build_equity_change_statement(database.pool(), "p1")
            .await
            .expect("builds classified enterprise equity change statement");
        let values = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .expect("contains statutory equity row")
                .values
                .clone()
        };
        assert_eq!(
            values("EQ321"),
            vec![20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 20.0]
        );
        assert_eq!(
            values("EQ320"),
            vec![20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 20.0]
        );
        assert!(statement.classification_complete);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_equity_change_includes_prior_year_comparative_columns() {
        let (database, data_dir) = test_database("enterprise-equity-comparative").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior', 'ent', 2025, 12, '2025-12-01', '2025-12-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'ent', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'ent', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1002', '银行存款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('prior-capital', 'prior', '4001', 100, 10, 110)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('current-capital', 'current', '4001', 110, 20, 130)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('prior-voucher', 'ent', 'prior', 'w1', '记-1', 1, '2025-12-15', '股东投入资本', 'approved', 10, 10)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('current-voucher', 'ent', 'current', 'w1', '记-1', 1, '2026-12-15', '股东投入资本', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('prior-cash', 'prior-voucher', 1, '1002', '银行存款', 'debit', 10, '收到投资款')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('prior-capital-entry', 'prior-voucher', 2, '4001', '实收资本', 'credit', 10, '股东投入普通股')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('current-cash', 'current-voucher', 1, '1002', '银行存款', 'debit', 20, '收到投资款')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('current-capital-entry', 'current-voucher', 2, '4001', '实收资本', 'credit', 20, '股东投入普通股')",
            "INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, source_account_code, cash_direction, cash_flow_item_code, summary_keyword, priority, is_enabled) VALUES ('r1', 'ent', 'equity_change', '普通股投入', '实收资本增加且摘要包含股东投入', '归入所有者投入普通股', '4001', 'increase', 'EQ321', '股东投入', 100, 1)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds comparative equity change statement");
        }

        let statement = build_equity_change_statement(database.pool(), "current")
            .await
            .expect("builds comparative equity change statement");
        let capital_contribution = statement
            .items
            .iter()
            .find(|item| item.item_code == "EQ321")
            .expect("contains ordinary share contribution row");
        assert!(statement.has_comparative_period);
        assert!(statement.classification_complete);
        assert!(statement.comparative_classification_complete);
        assert_eq!(capital_contribution.values[0], 20.0);
        assert_eq!(capital_contribution.comparative_values[0], 10.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_income_statement_uses_current_and_prior_comparative_ytd_amounts() {
        let (database, data_dir) = test_database("enterprise-income-comparative").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior-jan', 'ent', 2025, 1, '2025-01-01', '2025-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior', 'ent', 2025, 10, '2025-10-01', '2025-10-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current-jan', 'ent', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'ent', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '6001', '主营业务收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-income-jan', 'prior-jan', '6001', 68)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-income', 'prior', '6001', 12)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-income-jan', 'current-jan', '6001', 85)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-income', 'current', '6001', 15)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds comparative income statement");
        }

        let statement = build_income_statement(database.pool(), "current")
            .await
            .expect("builds enterprise comparative income statement");
        let revenue = statement
            .items
            .iter()
            .find(|item| item.item_code == "IS001")
            .expect("contains operating revenue");
        assert_eq!(statement.column_basis, "current_comparative");
        assert!(statement.has_comparative_period);
        assert_eq!(revenue.current_amount, 15.0);
        assert_eq!(revenue.year_to_date, 100.0);
        assert_eq!(revenue.comparative_amount, 80.0);
        assert_eq!(statement.current_period_total, 15.0);
        assert_eq!(statement.year_to_date_total, 100.0);
        assert_eq!(statement.comparative_period_total, 80.0);
        let comprehensive_income = statement
            .items
            .iter()
            .find(|item| item.item_code == "IS040")
            .expect("contains total comprehensive income");
        assert_eq!(comprehensive_income.current_amount, 15.0);
        assert_eq!(comprehensive_income.year_to_date, 100.0);
        assert_eq!(comprehensive_income.comparative_amount, 80.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_balance_sheet_maps_new_standard_accounts_and_balances() {
        let (database, data_dir) = test_database("enterprise-current-balance-sheet").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'ent', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1124', '合同资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1483', '合同资产减值准备', 'asset', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1704', '使用权资产', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1705', '使用权资产累计折旧', 'asset', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '2204', '合同负债', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '2703', '租赁负债', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('b1', 'current', '1124', 50, 50)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('b2', 'current', '1483', 5, 5)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('b3', 'current', '1704', 100, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('b4', 'current', '1705', 20, 20)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('b5', 'current', '2204', 25, 25)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('b6', 'current', '2703', 40, 40)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('b7', 'current', '4001', 60, 60)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds enterprise current-standard balance sheet");
        }

        let statement = build_balance_sheet(database.pool(), "current")
            .await
            .expect("builds enterprise current-standard balance sheet");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .map(|item| item.ending_balance)
                .expect("contains statutory balance-sheet row")
        };
        assert_eq!(amount("BS110"), 45.0);
        assert_eq!(amount("BS212"), 80.0);
        assert_eq!(amount("BS307"), 25.0);
        assert_eq!(amount("BS405"), 40.0);
        assert_eq!(statement.total_assets, 125.0);
        assert_eq!(statement.total_liabilities, 65.0);
        assert_eq!(statement.total_equity, 60.0);
        assert!(statement.is_balanced);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_income_statement_keeps_analytical_rows_out_of_profit_totals() {
        let (database, data_dir) = test_database("enterprise-current-income-statement").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'ent', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '6001', '主营业务收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '6602', '管理费用', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('ent', '660201', '办公费', 'expense', 'debit', 2, '6602', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('ent', '660206', '研发费用', 'expense', 'debit', 2, '6602', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '6603', '财务费用', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('ent', '660301', '利息支出', 'expense', 'debit', 2, '6603', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('ent', '660304', '利息收入', 'expense', 'credit', 2, '6603', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '4003', '其他综合收益', 'equity', 'credit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('ent', '400303', '其他权益工具投资公允价值变动', 'equity', 'credit', 2, '4003', 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('b1', 'current', '6001', 100)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('b2', 'current', '660201', 20)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('b3', 'current', '660206', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('b4', 'current', '660301', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('b5', 'current', '660304', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('b6', 'current', '400303', 7)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds enterprise current-standard income statement");
        }

        let statement = build_income_statement(database.pool(), "current")
            .await
            .expect("builds enterprise current-standard income statement");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .map(|item| item.current_amount)
                .expect("contains statutory income-statement row")
        };
        assert_eq!(amount("IS005"), 20.0);
        assert_eq!(amount("IS006"), 10.0);
        assert_eq!(amount("IS007"), 3.0);
        assert_eq!(amount("IS008"), 5.0);
        assert_eq!(amount("IS009"), 2.0);
        assert_eq!(amount("IS019"), 67.0);
        assert_eq!(amount("IS024"), 67.0);
        assert_eq!(amount("IS027"), 7.0);
        assert_eq!(amount("IS031"), 7.0);
        assert_eq!(amount("IS040"), 74.0);
        assert_eq!(statement.current_period_total, 67.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn small_enterprise_balance_sheet_exposes_inventory_components_once() {
        let (database, data_dir) = test_database("small-enterprise-balance-sheet").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('small', 'SMALL', '小企业', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'small', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '1403', '原材料', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '4001', '生产成本', 'cost', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '1405', '库存商品', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '1411', '周转材料', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '3001', '实收资本', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('cash', 'current', '1001', 100, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('material', 'current', '1403', 10, 10)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('wip', 'current', '4001', 6, 6)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('goods', 'current', '1405', 8, 8)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('turnover', 'current', '1411', 4, 4)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, closing_credit) VALUES ('capital', 'current', '3001', 128, 128)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds small-enterprise balance sheet");
        }

        let statement = build_balance_sheet(database.pool(), "current")
            .await
            .expect("builds small-enterprise balance sheet");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .map(|item| item.ending_balance)
                .expect("contains statutory balance-sheet row")
        };
        assert_eq!(amount("BS109"), 28.0);
        assert_eq!(amount("BS110"), 10.0);
        assert_eq!(amount("BS111"), 6.0);
        assert_eq!(amount("BS112"), 8.0);
        assert_eq!(amount("BS113"), 4.0);
        assert_eq!(statement.total_assets, 128.0);
        assert_eq!(statement.total_equity, 128.0);
        assert!(statement.is_balanced);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn small_enterprise_income_statement_keeps_statutory_details_out_of_totals() {
        let (database, data_dir) = test_database("small-enterprise-income-statement").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('small', 'SMALL', '小企业', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'small', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5001', '主营业务收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5401', '主营业务成本', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5403', '营业税金及附加', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '540301', '消费税', 'expense', 'debit', 2, '5403', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '540303', '城市维护建设税', 'expense', 'debit', 2, '5403', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5601', '销售费用', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560101', '广告费和业务宣传费', 'expense', 'debit', 2, '5601', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560104', '商品维修费', 'expense', 'debit', 2, '5601', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5602', '管理费用', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560206', '开办费', 'expense', 'debit', 2, '5602', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560207', '业务招待费', 'expense', 'debit', 2, '5602', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560208', '研究费用', 'expense', 'debit', 2, '5602', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5603', '财务费用', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560301', '利息支出', 'expense', 'debit', 2, '5603', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '560303', '利息收入', 'expense', 'credit', 2, '5603', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5111', '投资收益', 'income', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5301', '营业外收入', 'income', 'credit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '530102', '政府补助利得', 'income', 'credit', 2, '5301', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5711', '营业外支出', 'expense', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '571103', '坏账损失', 'expense', 'debit', 2, '5711', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('small', '571107', '税收滞纳金', 'expense', 'debit', 2, '5711', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('small', '5801', '所得税费用', 'expense', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('revenue', 'current', '5001', 100)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('cost', 'current', '5401', 30)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('consumption-tax', 'current', '540301', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('city-tax', 'current', '540303', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('advertising', 'current', '560101', 6)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('repair', 'current', '560104', 4)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('startup', 'current', '560206', 3)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('entertainment', 'current', '560207', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('research', 'current', '560208', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('interest-expense', 'current', '560301', 4)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('interest-income', 'current', '560303', 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('investment', 'current', '5111', 8)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('subsidy', 'current', '530102', 5)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('bad-debt', 'current', '571103', 2)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('late-fee', 'current', '571107', 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('income-tax', 'current', '5801', 4)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds small-enterprise income statement");
        }

        let statement = build_income_statement(database.pool(), "current")
            .await
            .expect("builds small-enterprise income statement");
        let amount = |code: &str| {
            statement
                .items
                .iter()
                .find(|item| item.item_code == code)
                .map(|item| item.current_amount)
                .expect("contains statutory income-statement row")
        };
        assert_eq!(amount("IS003"), 7.0);
        assert_eq!(amount("IS00301"), 5.0);
        assert_eq!(amount("IS004"), 10.0);
        assert_eq!(amount("IS00402"), 6.0);
        assert_eq!(amount("IS005"), 10.0);
        assert_eq!(amount("IS00503"), 5.0);
        assert_eq!(amount("IS006"), 3.0);
        assert_eq!(amount("IS00601"), 3.0);
        assert_eq!(amount("IS010"), 48.0);
        assert_eq!(amount("IS01101"), 5.0);
        assert_eq!(amount("IS01201"), 2.0);
        assert_eq!(amount("IS013"), 50.0);
        assert_eq!(amount("IS015"), 46.0);
        assert_eq!(statement.current_period_total, 46.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn enterprise_cash_flow_uses_current_and_prior_comparative_ytd_amounts() {
        let (database, data_dir) = test_database("enterprise-cash-comparative").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('ent', 'ENT', '一般企业', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior-jan', 'ent', 2025, 1, '2025-01-01', '2025-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior', 'ent', 2025, 10, '2025-10-01', '2025-10-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current-jan', 'ent', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'ent', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('ent', '1121', '应收票据', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-cash-jan', 'prior-jan', '1121', 68)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-cash', 'prior', '1121', 12)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-cash-jan', 'current-jan', '1121', 85)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-cash', 'current', '1121', 15)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds comparative cash-flow statement");
        }

        let statement = build_cash_flow_statement(database.pool(), "current")
            .await
            .expect("builds enterprise comparative cash-flow statement");
        let receipts = statement
            .items
            .iter()
            .find(|item| item.item_code == "CF101")
            .expect("contains customer cash receipts");
        assert_eq!(statement.column_basis, "current_comparative");
        assert!(statement.has_comparative_period);
        assert_eq!(receipts.current_amount, 15.0);
        assert_eq!(receipts.year_to_date, 100.0);
        assert_eq!(receipts.comparative_amount, 80.0);
        assert_eq!(statement.net_increase_comparative, 80.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn nonprofit_cash_flow_uses_current_and_prior_comparative_ytd_amounts() {
        let (database, data_dir) = test_database("nonprofit-cash-comparative").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('np', 'NP', '民非组织', 'non_profit')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior-jan', 'np', 2025, 1, '2025-01-01', '2025-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('prior', 'np', 2025, 10, '2025-10-01', '2025-10-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current-jan', 'np', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'np', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('np', '4101', '捐赠收入', 'income', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-donation-jan', 'prior-jan', '4101', 68)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('prior-donation', 'prior', '4101', 12)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-donation-jan', 'current-jan', '4101', 85)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-donation', 'current', '4101', 15)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds nonprofit comparative cash flow");
        }

        let statement = build_cash_flow_statement(database.pool(), "current")
            .await
            .expect("builds nonprofit comparative cash flow");
        let donations = statement
            .items
            .iter()
            .find(|item| item.item_code == "CF101")
            .expect("contains donation cash receipt row");
        assert_eq!(statement.column_basis, "current_comparative");
        assert!(statement.has_comparative_period);
        assert_eq!(donations.current_amount, 15.0);
        assert_eq!(donations.year_to_date, 100.0);
        assert_eq!(donations.comparative_amount, 80.0);

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn nonprofit_activity_statement_splits_restricted_and_unrestricted_amounts() {
        let (database, data_dir) = test_database("nonprofit-activity-classification").await;
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('np', 'NP', '民非组织', 'non_profit')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('jan', 'np', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('current', 'np', 2026, 2, '2026-02-01', '2026-02-28')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('np', '4101', '捐赠收入', 'income', 'credit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('np', '410101', '捐赠收入-非限定性', 'income', 'credit', 2, '4101', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('np', '410102', '捐赠收入-限定性', 'income', 'credit', 2, '4101', 1)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('jan-unrestricted', 'jan', '410101', 20)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('jan-restricted', 'jan', '410102', 8)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-unrestricted', 'current', '410101', 10)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('current-restricted', 'current', '410102', 5)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds nonprofit activity classification");
        }

        let statement = build_income_statement(database.pool(), "current")
            .await
            .expect("builds nonprofit activity statement");
        let donations = statement
            .items
            .iter()
            .find(|item| item.item_code == "IS101")
            .expect("contains donation income row");
        assert_eq!(statement.column_basis, "nonprofit_activity_matrix");
        assert!(statement.classification_complete);
        assert_eq!(donations.current_unrestricted_amount, 10.0);
        assert_eq!(donations.current_restricted_amount, 5.0);
        assert_eq!(donations.current_amount, 15.0);
        assert_eq!(donations.ytd_unrestricted_amount, 30.0);
        assert_eq!(donations.ytd_restricted_amount, 13.0);
        assert_eq!(donations.year_to_date, 43.0);

        cleanup(database, data_dir).await;
    }
}

#[cfg(test)]
mod subsidiary_ledger_tests {
    use super::build_subsidiary_ledger;
    use crate::db::Database;

    #[tokio::test]
    async fn credit_normal_ledger_keeps_direction_and_voucher_trace() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-subsidiary-ledger-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes ledger test database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '明细账测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'c1', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '2001', '短期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_debit, period_credit, closing_credit) VALUES ('b1', 'p1', '2001', 100, 100, 30, 30)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v1', 'c1', 'p1', 'w1', '记-1', 1, '2026-10-10', 'approved', 100, 100)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e1', 'v1', 1, '2001', '短期借款', 'debit', 100)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e2', 'v1', 2, '1001', '库存现金', 'credit', 100)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v2', 'c1', 'p1', 'w1', '记-2', 2, '2026-10-20', 'approved', 30, 30)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e3', 'v2', 1, '1001', '库存现金', 'debit', 30)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e4', 'v2', 2, '2001', '短期借款', 'credit', 30)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds subsidiary ledger row");
        }

        let rows = build_subsidiary_ledger(database.pool(), "p1", "2001")
            .await
            .expect("builds credit-normal subsidiary ledger");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].summary, "期初余额");
        assert_eq!(rows[0].balance, 100.0);
        assert_eq!(rows[0].balance_direction, "贷");
        assert_eq!(rows[1].voucher_id, "v1");
        assert_eq!(rows[1].balance, 0.0);
        assert_eq!(rows[1].balance_direction, "平");
        assert_eq!(rows[2].voucher_id, "v2");
        assert_eq!(rows[2].balance, 30.0);
        assert_eq!(rows[2].balance_direction, "贷");

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes ledger test data directory");
    }
}

#[cfg(test)]
mod ledger_hierarchy_tests {
    use super::{build_general_ledger, get_account_balance_by_rule, get_account_closing_balance};
    use crate::db::Database;

    #[tokio::test]
    async fn formulas_and_general_ledger_roll_detail_accounts_to_their_parent_once() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-ledger-hierarchy-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes ledger hierarchy database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '层级测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'c1', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 0)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, parent_code, is_detail) VALUES ('c1', 'CASH-A', '库存现金-A户', 'asset', 'debit', 2, '1001', 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '2001', '短期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, closing_debit) VALUES ('stale-parent', 'p1', '1001', 999)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('child-balance', 'p1', 'CASH-A', 100, 20, 120)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit, closing_credit) VALUES ('loan-balance', 'p1', '2001', 20, 20)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v1', 'c1', 'p1', 'w1', '记-1', 1, '2026-10-10', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e1', 'v1', 1, 'CASH-A', '库存现金-A户', 'debit', 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e2', 'v1', 2, '2001', '短期借款', 'credit', 20)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds hierarchy ledger data");
        }

        assert_eq!(
            get_account_closing_balance("1001", "c1", "p1", database.pool()).await,
            120.0
        );
        assert_eq!(
            get_account_balance_by_rule("1001", "c1", "p1", "closing_debit", database.pool(),)
                .await,
            120.0
        );

        let ledger = build_general_ledger(database.pool(), "p1", None)
            .await
            .expect("builds hierarchy-aware general ledger");
        let cash = ledger
            .iter()
            .find(|item| item.account_code == "1001")
            .expect("contains the parent general-ledger account");
        assert_eq!(cash.opening_debit, 100.0);
        assert_eq!(cash.period_debit, 20.0);
        assert_eq!(cash.closing_debit, 120.0);
        assert_eq!(cash.entries.len(), 1);
        assert_eq!(cash.entries[0].source_account_code, "CASH-A");
        assert_eq!(cash.entries[0].source_account_name, "库存现金-A户");
        assert!(ledger.iter().all(|item| item.account_code != "CASH-A"));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(
            &data_dir,
            "removes hierarchy test data directory",
        );
    }
}

#[cfg(test)]
mod cash_flow_reconciliation_tests {
    use super::build_cash_flow_statement;
    use crate::db::Database;

    #[tokio::test]
    async fn cash_flow_net_increase_reconciles_to_cash_balance_movement() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-cash-flow-reconciliation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes cash-flow test database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '现金流测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1002', '银行存款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1012', '其他货币资金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1122', '应收账款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('cash', 'p1', '1001', 100, 15, 115)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit) VALUES ('receivable', 'p1', '1122', 15)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds cash-flow reconciliation data");
        }

        let reconciled = build_cash_flow_statement(database.pool(), "p1")
            .await
            .expect("builds reconciled cash-flow statement");
        assert_eq!(reconciled.opening_cash_balance, 100.0);
        assert_eq!(reconciled.ending_cash_balance, 115.0);
        assert_eq!(reconciled.cash_balance_change, 15.0);
        assert_eq!(reconciled.net_increase, 15.0);
        assert_eq!(reconciled.reconciliation_difference, 0.0);
        assert!(reconciled.is_reconciled);
        let amount = |code: &str| {
            reconciled
                .items
                .iter()
                .find(|item| item.item_code == code)
                .map(|item| item.current_amount)
                .expect("contains statutory small-enterprise cash-flow row")
        };
        assert_eq!(amount("CF101"), 15.0);
        assert_eq!(amount("CF199"), 15.0);
        assert_eq!(amount("CF400"), 15.0);
        assert_eq!(amount("CF500"), 100.0);
        assert_eq!(amount("CF999"), 115.0);

        sqlx::query("UPDATE account_balances SET period_credit = 0 WHERE id = 'receivable'")
            .execute(database.pool())
            .await
            .expect("breaks cash-flow classification");
        let unreconciled = build_cash_flow_statement(database.pool(), "p1")
            .await
            .expect("builds unreconciled cash-flow statement");
        assert_eq!(unreconciled.net_increase, 0.0);
        assert_eq!(unreconciled.reconciliation_difference, 15.0);
        assert!(!unreconciled.is_reconciled);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(
            &data_dir,
            "removes cash-flow test data directory",
        );
    }

    #[tokio::test]
    async fn structured_cash_flow_mappings_classify_approved_cash_vouchers() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-cash-flow-mapping-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes cash-flow mapping test database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '现金流映射测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'c1', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1002', '银行存款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1012', '其他货币资金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1122', '应收账款', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '2202', '应付账款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('cash', 'p1', '1001', 100, 15, 115)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('v1', 'c1', 'p1', 'w1', '记-1', 1, '2026-01-10', '销售回款', 'approved', 15, 15)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e1', 'v1', 1, '1001', '库存现金', 'debit', 15, '销售回款')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e2', 'v1', 2, '1122', '应收账款', 'credit', 15, '销售回款')",
            "INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, priority, is_enabled, source_account_code, cash_direction, cash_flow_item_code, summary_keyword) VALUES ('r1', 'c1', 'cash_flow', '销售回款', '应收账款', '销售商品收到的现金', 100, 1, '1122', 'inflow', 'CF101', '销售')",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds mapped cash-flow data");
        }

        let mapped = build_cash_flow_statement(database.pool(), "p1")
            .await
            .expect("builds mapped cash-flow statement");
        assert_eq!(mapped.classification_mode, "voucher_mapping");
        assert_eq!(mapped.unmapped_cash_amount, 0.0);
        assert_eq!(mapped.unmapped_voucher_count, 0);
        assert!(mapped.is_classification_complete);
        assert_eq!(
            mapped
                .items
                .iter()
                .find(|item| item.item_code == "CF101")
                .expect("contains configured target cash-flow item")
                .current_amount,
            15.0
        );
        assert_eq!(
            mapped
                .items
                .iter()
                .find(|item| item.item_code == "CF104")
                .expect("contains an unmapped formula-based item")
                .current_amount,
            0.0
        );
        assert!(mapped.is_reconciled);

        for statement in [
            "UPDATE account_balances SET period_credit = 5, closing_debit = 110 WHERE id = 'cash'",
            "INSERT INTO account_balances (id, period_id, account_code, period_debit) VALUES ('payable', 'p1', '2202', 5)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('v2', 'c1', 'p1', 'w1', '记-2', 2, '2026-01-12', '支付货款', 'approved', 5, 5)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e3', 'v2', 1, '2202', '应付账款', 'debit', 5, '支付货款')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e4', 'v2', 2, '1001', '库存现金', 'credit', 5, '支付货款')",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds an unmapped cash payment");
        }

        let incomplete = build_cash_flow_statement(database.pool(), "p1")
            .await
            .expect("builds incomplete mapped cash-flow statement");
        assert_eq!(incomplete.unmapped_cash_amount, 5.0);
        assert_eq!(incomplete.unmapped_voucher_count, 1);
        assert!(!incomplete.is_classification_complete);
        assert!(!incomplete.is_reconciled);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(
            &data_dir,
            "removes cash-flow mapping test data directory",
        );
    }
}

#[cfg(test)]
mod reconciliation_tests {
    use super::{build_accounting_reconciliation, ensure_period_reconciled};
    use crate::db::Database;

    async fn seeded_database() -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-reconciliation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone()).await.unwrap();
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '勾稽测试企业', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'c1', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '2001', '短期借款', 'liability', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('b1', 'p1', '1001', 100, 20, 120)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('b2', 'p1', '2001', 100, 20, 120)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v1', 'c1', 'p1', 'w1', '记-1', 1, '2026-10-10', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e1', 'v1', 1, '1001', '库存现金', 'debit', 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e2', 'v1', 2, '2001', '短期借款', 'credit', 20)",
        ] {
            sqlx::query(statement).execute(database.pool()).await.unwrap();
        }
        (database, data_dir)
    }

    #[tokio::test]
    async fn reconciliation_connects_chart_vouchers_balances_and_trial_balance() {
        let (database, data_dir) = seeded_database().await;

        let result = build_accounting_reconciliation(database.pool(), "p1")
            .await
            .expect("builds reconciliation");
        assert!(result.is_reconciled);
        assert_eq!(result.blocked_count, 0);
        for code in [
            "chart_coverage",
            "balance_rollforward",
            "voucher_to_balance",
            "trial_balance",
            "balance_sheet_equation",
        ] {
            assert!(
                result
                    .checks
                    .iter()
                    .any(|check| check.code == code && check.status == "passed"),
                "{code} should pass"
            );
        }

        sqlx::query("UPDATE account_balances SET closing_debit = 119 WHERE id = 'b1'")
            .execute(database.pool())
            .await
            .unwrap();
        let broken = build_accounting_reconciliation(database.pool(), "p1")
            .await
            .expect("builds broken reconciliation");
        assert!(!broken.is_reconciled);
        assert!(broken
            .checks
            .iter()
            .any(|check| { check.code == "balance_rollforward" && check.status == "blocked" }));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn period_close_guard_rejects_balanced_but_unreconciled_books() {
        let (database, data_dir) = seeded_database().await;
        for statement in [
            "UPDATE voucher_entries SET amount = 10 WHERE id = 'e1'",
            "UPDATE voucher_entries SET amount = 10 WHERE id = 'e2'",
            "UPDATE vouchers SET total_debit = 10, total_credit = 10 WHERE id = 'v1'",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect(
                    "keeps the voucher balanced while breaking voucher-to-balance reconciliation",
                );
        }

        let reconciliation = build_accounting_reconciliation(database.pool(), "p1")
            .await
            .expect("builds the blocked reconciliation");
        assert!(reconciliation
            .checks
            .iter()
            .any(|check| check.code == "trial_balance" && check.status == "passed"));
        assert!(reconciliation
            .checks
            .iter()
            .any(|check| check.code == "voucher_to_balance" && check.status == "blocked"));

        let error = ensure_period_reconciled(database.pool(), "p1")
            .await
            .expect_err("unreconciled books must not pass the close guard");
        assert!(error.contains("凭证与科目余额"));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn enterprise_reconciliation_checks_equity_statement_and_classification() {
        let data_dir = std::env::temp_dir().join(format!(
            "enterprise-equity-reconciliation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone()).await.unwrap();
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c2', 'C2', '企业权益勾稽测试', 'enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p2', 'c2', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w2', 'c2', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c2', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c2', '4001', '实收资本（或股本）', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c2', '4104', '利润分配', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c2', '6001', '主营业务收入', 'profit_loss', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('b3', 'p2', '1001', 80, 60, 140)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('b4', 'p2', '4001', 80, 20, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit, closing_credit) VALUES ('b5', 'p2', '4104', 20, 20)",
            "INSERT INTO account_balances (id, period_id, account_code, period_credit, closing_credit) VALUES ('b6', 'p2', '6001', 20, 20)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v2', 'c2', 'p2', 'w2', '记-1', 1, '2026-10-10', 'approved', 60, 60)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e3', 'v2', 1, '1001', '库存现金', 'debit', 60)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e4', 'v2', 2, '4001', '实收资本（或股本）', 'credit', 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e5', 'v2', 3, '4104', '利润分配', 'credit', 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e6', 'v2', 4, '6001', '主营业务收入', 'credit', 20)",
        ] {
            sqlx::query(statement).execute(database.pool()).await.unwrap();
        }

        let result = build_accounting_reconciliation(database.pool(), "p2")
            .await
            .expect("builds enterprise equity reconciliation");
        let statement_check = result
            .checks
            .iter()
            .find(|check| check.code == "equity_statement_to_balance_sheet")
            .expect("includes equity statement to balance sheet check");
        assert_eq!(statement_check.status, "passed");
        assert_eq!(statement_check.source_amount, 120.0);
        assert_eq!(statement_check.target_amount, 120.0);

        let classification_check = result
            .checks
            .iter()
            .find(|check| check.code == "equity_change_classification")
            .expect("includes equity change classification check");
        assert_eq!(classification_check.status, "blocked");
        assert_eq!(classification_check.difference, 40.0);

        let profit_check = result
            .checks
            .iter()
            .find(|check| check.code == "net_profit_to_equity_classification")
            .expect("includes net profit to equity classification check");
        assert_eq!(profit_check.status, "blocked");
        assert_eq!(profit_check.source_amount, 20.0);
        assert_eq!(profit_check.target_amount, 0.0);
        assert_eq!(profit_check.difference, 20.0);
        assert!(!result.is_reconciled);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn cooperative_reconciliation_connects_member_equity_and_balance_sheet() {
        let data_dir = std::env::temp_dir().join(format!(
            "cooperative-equity-reconciliation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone()).await.unwrap();
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('coop', 'COOP', '合作社勾稽测试', 'cooperative')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'coop', 2026, 12, '2026-12-01', '2026-12-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'coop', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '101', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('coop', '301', '股金', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, period_debit, closing_debit) VALUES ('cash', 'p1', '101', 80, 20, 100)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_credit, period_credit, closing_credit) VALUES ('capital', 'p1', '301', 80, 20, 100)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, summary, status, total_debit, total_credit) VALUES ('v1', 'coop', 'p1', 'w1', '记-1', 1, '2026-12-15', '成员增加出资', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e1', 'v1', 1, '101', '库存现金', 'debit', 20, '收到成员出资')",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount, summary) VALUES ('e2', 'v1', 2, '301', '股金', 'credit', 20, '成员增加出资')",
            "INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, source_account_code, cash_direction, cash_flow_item_code, summary_keyword, priority, is_enabled) VALUES ('r1', 'coop', 'equity_change', '成员增加出资', '股金增加且摘要包含成员增加出资', '归入成员增加出资', '301', 'increase', 'EQ219', '成员增加出资', 100, 1)",
        ] {
            sqlx::query(statement).execute(database.pool()).await.unwrap();
        }

        let result = build_accounting_reconciliation(database.pool(), "p1")
            .await
            .expect("builds cooperative reconciliation");
        for code in [
            "balance_sheet_equation",
            "equity_statement_to_balance_sheet",
            "equity_change_classification",
            "surplus_to_equity_classification",
        ] {
            assert!(
                result
                    .checks
                    .iter()
                    .any(|check| check.code == code && check.status == "passed"),
                "{code} should pass"
            );
        }
        assert!(result.is_reconciled);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }
}

#[cfg(test)]
mod period_transition_guard_tests {
    use super::{
        ensure_period_close_sequence, ensure_period_reopen_sequence, persist_period_close,
        persist_period_reopen,
    };
    use crate::db::Database;

    #[tokio::test]
    async fn period_transitions_follow_chronological_accounting_order() {
        let data_dir = std::env::temp_dir().join(format!(
            "period-transition-guard-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes period transition database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '账期顺序测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('jan', 'c1', 2026, 1, '2026-01-01', '2026-01-31', 'open')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('feb', 'c1', 2026, 2, '2026-02-01', '2026-02-28', 'open')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('mar', 'c1', 2026, 3, '2026-03-01', '2026-03-31', 'closed')",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds ordered periods");
        }

        let close_error = ensure_period_close_sequence(database.pool(), "c1", "feb")
            .await
            .expect_err("an open earlier period must block closing a later period");
        assert!(close_error.contains("2026-01"));

        sqlx::query("UPDATE accounting_periods SET status = 'closed' WHERE id = 'jan'")
            .execute(database.pool())
            .await
            .expect("closes the earlier period");
        ensure_period_close_sequence(database.pool(), "c1", "feb")
            .await
            .expect("closing may continue after all earlier periods are closed");

        let reopen_error = ensure_period_reopen_sequence(database.pool(), "c1", "jan")
            .await
            .expect_err("a closed later period must block reopening an earlier period");
        assert!(reopen_error.contains("2026-03"));
        ensure_period_reopen_sequence(database.pool(), "c1", "mar")
            .await
            .expect("the latest closed period may be reopened first");

        persist_period_close(
            database.pool(),
            "c1",
            "feb",
            Some("close-reviewer"),
            "2026-02-28T12:00:00Z",
        )
        .await
        .expect("persists period close with its audit record");
        persist_period_reopen(
            database.pool(),
            "c1",
            "mar",
            Some("reopen-reviewer"),
            "2026-03-31T12:00:00Z",
        )
        .await
        .expect("persists period reopen with its audit record");

        let transitions: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
            "SELECT action, object_ref, risk_level, operator FROM operation_audit_logs WHERE company_id = 'c1' ORDER BY created_at, action",
        )
        .fetch_all(database.pool())
        .await
        .expect("reads period transition audit records");
        assert_eq!(transitions.len(), 2);
        assert!(transitions
            .iter()
            .any(|(action, object_ref, risk, operator)| {
                action == "结账"
                    && object_ref == "2026-02"
                    && risk == "high"
                    && operator.as_deref() == Some("close-reviewer")
            }));
        assert!(transitions
            .iter()
            .any(|(action, object_ref, risk, operator)| {
                action == "反结账"
                    && object_ref == "2026-03"
                    && risk == "critical"
                    && operator.as_deref() == Some("reopen-reviewer")
            }));

        let feb_status: String =
            sqlx::query_scalar("SELECT status FROM accounting_periods WHERE id = 'feb'")
                .fetch_one(database.pool())
                .await
                .expect("reads closed February status");
        let mar_status: String =
            sqlx::query_scalar("SELECT status FROM accounting_periods WHERE id = 'mar'")
                .fetch_one(database.pool())
                .await
                .expect("reads reopened March status");
        assert_eq!(feb_status, "closed");
        assert_eq!(mar_status, "open");

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes period transition database");
    }
}
