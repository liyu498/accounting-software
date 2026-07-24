use crate::db::{
    AccountingPeriod, AccountBalance, ClosePeriodInput, CreatePeriodInput, Database,
    SaveInitialBalanceInput,
};
use serde::{Deserialize, Serialize};
use sqlx::Sqlite;
use tauri::State;

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

#[tauri::command]
pub async fn get_period(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<AccountingPeriod>, String> {
    let period: Option<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(period)
}

/// Ensure all 12 periods exist for the current accounting year of a company.
/// Creates missing periods and initializes their account_balances from the
/// previous period's closing balances.
#[tauri::command]
pub async fn ensure_periods(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountingPeriod>, String> {
    log::info!("Ensuring all periods exist for company: {}", company_id);

    // Determine the accounting year: use enable_year if set, else current year
    let enable_info: Option<(i32, i32)> = sqlx::query_as(
        "SELECT enable_year, enable_month FROM companies WHERE id = ?",
    )
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let year = enable_info
        .and_then(|(y, _)| if y > 0 { Some(y) } else { None })
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse::<i32>().unwrap_or(2026));

    // Get existing periods for this year
    let existing: Vec<(i32,)> = sqlx::query_as(
        "SELECT period_month FROM accounting_periods WHERE company_id = ? AND period_year = ?",
    )
    .bind(&company_id)
    .bind(year)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let existing_months: std::collections::HashSet<i32> = existing.into_iter().map(|(m,)| m).collect();

    // Get all enabled account codes
    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
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
        .execute(db.pool())
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
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for (code,) in &account_codes {
            let (opening_debit, opening_credit) = if let Some(ref prev) = prev_period {
                let prev_bal: Option<(f64, f64)> = sqlx::query_as(
                    "SELECT closing_debit, closing_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
                )
                .bind(&prev.id)
                .bind(code)
                .fetch_optional(db.pool())
                .await
                .ok()
                .flatten();
                prev_bal.unwrap_or((0.0, 0.0))
            } else {
                (0.0, 0.0)
            };

            sqlx::query(
                "INSERT OR IGNORE INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(&id)
            .bind(code)
            .bind(opening_debit)
            .bind(opening_credit)
            .bind(opening_debit)
            .bind(opening_credit)
            .execute(db.pool())
            .await
            .map_err(|e| format!("Failed to init balance: {}", e))?;
        }

        log::info!("Created period {}-{:02} for company {}", year, month, company_id);
    }

    // Return all periods
    let periods: Vec<AccountingPeriod> = sqlx::query_as(
        "SELECT * FROM accounting_periods WHERE company_id = ? ORDER BY period_year, period_month",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

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
    log::info!("Creating period {}-{} for company {}", input.period_year, input.period_month, input.company_id);

    // Check if period already exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
    )
    .bind(&input.company_id)
    .bind(input.period_year)
    .bind(input.period_month)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err(format!("会计期间 {}-{} 已存在", input.period_year, input.period_month));
    }

    let start_date = format!("{}-{:02}-01", input.period_year, input.period_month);
    let end_day = days_in_month(input.period_year, input.period_month);
    let end_date = format!("{}-{:02}-{}", input.period_year, input.period_month, end_day);
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
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create period: {}", e))?;

    // Initialize account_balances rows for all enabled account codes
    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(&input.company_id)
    .fetch_all(db.pool())
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
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (code,) in &account_codes {
        let (opening_debit, opening_credit) = if let Some(ref prev) = prev_period {
            let prev_bal: Option<(f64, f64)> = sqlx::query_as(
                "SELECT closing_debit, closing_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
            )
            .bind(&prev.id)
            .bind(code)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            prev_bal.unwrap_or((0.0, 0.0))
        } else {
            (0.0, 0.0)
        };

        sqlx::query(
            "INSERT OR IGNORE INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
        )
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(code)
        .bind(opening_debit)
        .bind(opening_credit)
        .bind(opening_debit)
        .bind(opening_credit)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to init balance: {}", e))?;
    }

    let period: AccountingPeriod = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Period created: {}-{}", input.period_year, input.period_month);
    Ok(period)
}

#[tauri::command]
pub async fn close_period(
    input: ClosePeriodInput,
    db: State<'_, Database>,
) -> Result<AccountingPeriod, String> {
    log::info!("Closing period: {}", input.period_id);

    // Derive company_id from period for isolation
    let company_id: String = sqlx::query_scalar(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&input.period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Pre-close validation: check for draft vouchers
    let draft_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM vouchers WHERE period_id = ? AND status = 'draft' AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
    )
    .bind(&input.period_id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if draft_count.0 > 0 {
        return Err(format!("存在 {} 张草稿凭证，请先审核或删除", draft_count.0));
    }

    // Check trial balance
    let balances: Vec<AccountBalance> = sqlx::query_as(
        "SELECT * FROM account_balances WHERE period_id = ?",
    )
    .bind(&input.period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let total_closing_debit: f64 = balances.iter().map(|b| b.closing_debit).sum();
    let total_closing_credit: f64 = balances.iter().map(|b| b.closing_credit).sum();

    if (total_closing_debit - total_closing_credit).abs() > 0.01 {
        return Err(format!("试算不平衡: 借方合计 {} ≠ 贷方合计 {}", total_closing_debit, total_closing_credit));
    }

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE accounting_periods SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&now)
    .bind(&input.closed_by)
    .bind(&input.period_id)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to close period: {}", e))?;

    let period: AccountingPeriod = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?")
        .bind(&input.period_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Period closed: {}", input.period_id);
    Ok(period)
}

#[tauri::command]
pub async fn reopen_period(
    period_id: String,
    db: State<'_, Database>,
) -> Result<AccountingPeriod, String> {
    log::info!("Reopening period: {}", period_id);

    // Derive company_id from period for isolation
    let company_id: String = sqlx::query_scalar(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query(
        "UPDATE accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to reopen period: {}", e))?;

    let period: AccountingPeriod = sqlx::query_as("SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?")
        .bind(&period_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(period)
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

    // Get ALL account codes (not just detail accounts) to build hierarchical trial balance
    let all_accounts: Vec<(String, String, String, i32, bool)> = sqlx::query_as(
        "SELECT code, name, account_type, level, CASE WHEN is_detail = 1 THEN 1 ELSE 0 END FROM account_codes WHERE company_id = ? AND is_enabled = 1 ORDER BY code",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get all detail-level balances for this period
    let balances: Vec<AccountBalance> = sqlx::query_as(
        "SELECT * FROM account_balances WHERE period_id = ? ORDER BY account_code",
    )
    .bind(&period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Build a map of account_code -> AccountBalance
    let mut bal_map: std::collections::HashMap<String, &AccountBalance> = std::collections::HashMap::new();
    for bal in &balances {
        bal_map.insert(bal.account_code.clone(), bal);
    }

    // For non-detail (parent) accounts, compute balances by summing all children
    // Children are accounts whose code starts with this parent's code AND have a longer code
    let mut items = Vec::new();
    let total_od: f64; let total_oc: f64;
    let total_pd: f64; let total_pc: f64;
    let total_cud: f64; let total_cuc: f64;
    let total_cd: f64; let total_cc: f64;

    // Only sum detail accounts for totals (avoid double-counting parent totals)
    let mut detail_totals = (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64);

    for (code, name, account_type, level, is_detail) in &all_accounts {
        let (opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) = if *is_detail {
            // Detail account: use its own balance from account_balances
            if let Some(bal) = bal_map.get(code) {
                (bal.opening_debit, bal.opening_credit, bal.period_debit, bal.period_credit, bal.closing_debit, bal.closing_credit)
            } else {
                (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
            }
        } else {
            // Parent account: sum all detail children's balances
            let mut od = 0.0; let mut oc = 0.0;
            let mut pd = 0.0; let mut pc = 0.0;
            let mut cd = 0.0; let mut cc = 0.0;

            for (child_code, _, _, _, child_is_detail) in &all_accounts {
                if !child_is_detail { continue; }
                // A child starts with this parent's code and is longer
                if child_code.starts_with(code.as_str()) && child_code.len() > code.len() {
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

        // Skip accounts with all zeros
        if opening_debit.abs() < 0.001 && opening_credit.abs() < 0.001
            && period_debit.abs() < 0.001 && period_credit.abs() < 0.001
            && closing_debit.abs() < 0.001 && closing_credit.abs() < 0.001
        {
            continue;
        }

            // Calculate YTD cumulative (deferred — will be filled from batch query below)
        let cumulative_debit = 0.0_f64;
        let cumulative_credit = 0.0_f64;

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
    total_od = detail_totals.0;
    total_oc = detail_totals.1;
    total_pd = detail_totals.2;
    total_pc = detail_totals.3;
    // total_cud/total_cuc set later after batch YTD query
    total_cd = detail_totals.6;
    total_cc = detail_totals.7;

    // Batch-load YTD cumulative data in a single query
    let ytd_placeholders = ytd_period_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
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

    // Build YTD cumulative map: account_code -> (cumulative_debit, cumulative_credit)
    let ytd_map: std::collections::HashMap<String, (f64, f64)> = ytd_cumulatives
        .into_iter()
        .map(|(code, cd, cc)| (code, (cd, cc)))
        .collect();

    // Fill cumulative values for each item
    for item in &mut items {
        if item.is_detail {
            if let Some((cd, cc)) = ytd_map.get(&item.account_code) {
                item.cumulative_debit = *cd;
                item.cumulative_credit = *cc;
            }
        } else {
            // Parent account: sum cumulative from detail children
            let mut cd = 0.0_f64;
            let mut cc = 0.0_f64;
            for (child_code, _, _, _, child_is_detail) in &all_accounts {
                if !child_is_detail { continue; }
                if child_code.starts_with(item.account_code.as_str()) && child_code.len() > item.account_code.len() {
                    if let Some((ccd, ccc)) = ytd_map.get(child_code) {
                        cd += ccd;
                        cc += ccc;
                    }
                }
            }
            item.cumulative_debit = cd;
            item.cumulative_credit = cc;
        }
    }

    // Recompute detail-level cumulative totals
    let mut cum_totals = (0.0_f64, 0.0_f64);
    for item in &items {
        if item.is_detail {
            cum_totals.0 += item.cumulative_debit;
            cum_totals.1 += item.cumulative_credit;
        }
    }
    total_cud = cum_totals.0;
    total_cuc = cum_totals.1;

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
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
    }

    let balances: Vec<AccountBalance> = sqlx::query_as(
        "SELECT * FROM account_balances WHERE period_id = ? ORDER BY account_code",
    )
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
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Saving initial balance for account: {}", input.account_code);

    // Verify the period belongs to the user's company
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&input.period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
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
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(&input.period_id)
    .bind(&input.account_code)
    .bind(input.opening_debit)
    .bind(input.opening_credit)
    .bind(&input.created_by)
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
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
    }

    let balances: Vec<(f64, f64)> = sqlx::query_as(
        "SELECT opening_debit, opening_credit FROM initial_balances WHERE period_id = ?",
    )
    .bind(&period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let total_debit: f64 = balances.iter().map(|(d, _)| *d).sum();
    let total_credit: f64 = balances.iter().map(|(_, c)| *c).sum();
    let is_balanced = (total_debit - total_credit).abs() < 0.01;

    Ok(InitialBalanceValidation {
        total_debit,
        total_credit,
        is_balanced,
        message: if is_balanced {
            "期初余额试算平衡".to_string()
        } else {
            format!("期初余额试算不平衡: 借方 {} ≠ 贷方 {}", total_debit, total_credit)
        },
    })
}

#[tauri::command]
pub async fn finalize_initial_balances(
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Finalizing initial balances for period: {}", period_id);

    // Verify the period belongs to the user's company
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT company_id FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if owner.is_none() {
        return Err("会计期间不存在或不属于当前公司".to_string());
    }

    // Validate first
    let validation = validate_initial_balances(period_id.clone(), company_id.clone(), db.clone()).await?;
    if !validation.is_balanced {
        return Err("期初余额试算不平衡，无法完成建账".to_string());
    }

    // Copy initial_balances to account_balances
    let initials: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT account_code, opening_debit, opening_credit FROM initial_balances WHERE period_id = ?",
    )
    .bind(&period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

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
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&period_id)
        .bind(code)
        .bind(debit)
        .bind(credit)
        .bind(debit)
        .bind(credit)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to write balance: {}", e))?;
    }

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

#[tauri::command]
pub async fn get_general_ledger(
    period_id: String,
    account_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<GeneralLedgerItem>, String> {
    // Derive company_id from period
    let company_id: String = sqlx::query_scalar(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let balances: Vec<AccountBalance> = if let Some(at) = account_type {
        sqlx::query_as(
            r#"SELECT ab.* FROM account_balances ab
               JOIN account_codes ac ON ab.account_code = ac.code AND ac.company_id = ?
               WHERE ab.period_id = ? AND ac.account_type = ?
               ORDER BY ab.account_code"#,
        )
        .bind(&company_id)
        .bind(&period_id)
        .bind(&at)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    } else {
        sqlx::query_as(
            "SELECT * FROM account_balances WHERE period_id = ? ORDER BY account_code",
        )
        .bind(&period_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    };

    let mut items = Vec::new();
    for bal in &balances {
        let info: Option<(String, String, String)> = sqlx::query_as(
            "SELECT name, account_type, normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
        )
        .bind(&company_id)
        .bind(&bal.account_code)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if let Some((name, atype, normal_balance)) = info {
            let is_debit_normal = normal_balance == "debit";
            let opening = if is_debit_normal {
                bal.opening_debit - bal.opening_credit
            } else {
                bal.opening_credit - bal.opening_debit
            };

            // Fetch entries for this account in this period (only approved vouchers)
            let entry_rows: Vec<(String, String, String, Option<String>, String, f64)> = sqlx::query_as(
                r#"SELECT ve.voucher_id, v.voucher_date, v.voucher_number, ve.summary, ve.direction, ve.amount
                   FROM voucher_entries ve
                   JOIN vouchers v ON ve.voucher_id = v.id
                   WHERE v.period_id = ? AND ve.account_code = ? AND v.status = 'approved' AND v.company_id = ? AND (v.is_deleted = 0 OR v.is_deleted IS NULL)
                   ORDER BY v.voucher_date, v.sequence_num, ve.line_num"#,
            )
            .bind(&period_id)
            .bind(&bal.account_code)
            .bind(&company_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            let mut entries = Vec::new();
            let mut running = opening;

            for (vid, vdate, vnum, summary, direction, amount) in entry_rows {
                let (debit, credit) = if direction == "debit" {
                    (amount, 0.0)
                } else {
                    (0.0, amount)
                };

                running = if is_debit_normal {
                    running + debit - credit
                } else {
                    running + credit - debit
                };

                entries.push(GeneralLedgerEntry {
                    voucher_id: vid,
                    voucher_number: vnum,
                    voucher_date: vdate,
                    summary: summary.unwrap_or_default(),
                    direction,
                    amount,
                    balance: running,
                });
            }

            items.push(GeneralLedgerItem {
                account_code: bal.account_code.clone(),
                account_name: name,
                account_type: atype,
                entries,
                opening_debit: bal.opening_debit,
                opening_credit: bal.opening_credit,
                period_debit: bal.period_debit,
                period_credit: bal.period_credit,
                closing_debit: bal.closing_debit,
                closing_credit: bal.closing_credit,
            });
        }
    }

    Ok(items)
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

#[tauri::command]
pub async fn get_subsidiary_ledger(
    period_id: String,
    account_code: String,
    db: State<'_, Database>,
) -> Result<Vec<SubsidiaryLedgerItem>, String> {
    log::info!("Generating subsidiary ledger for account {} in period {}", account_code, period_id);

    // Derive company_id from period
    let company_id: String = sqlx::query_scalar(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get account info for balance direction
    let acct: Option<(String, String)> = sqlx::query_as(
        "SELECT name, normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
    )
    .bind(&company_id)
    .bind(&account_code)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let is_debit_normal = acct
        .as_ref()
        .map(|(_, nb)| nb == "debit")
        .unwrap_or(true);

    // Get opening balance
    let opening: Option<(f64, f64)> = sqlx::query_as(
        "SELECT opening_debit, opening_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
    )
    .bind(&period_id)
    .bind(&account_code)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut running_balance = if is_debit_normal {
        opening.map(|(d, c)| d - c).unwrap_or(0.0)
    } else {
        opening.map(|(d, c)| c - d).unwrap_or(0.0)
    };

    let mut items = Vec::new();

    // Opening balance row
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
            balance_direction: if running_balance >= 0.0 { "借".to_string() } else { "贷".to_string() },
        });
    }

    // Get voucher entries for this account in this period
    // Also fetch the opposite account code from entries in the same voucher with the opposite direction
    let entries: Vec<(String, String, String, Option<String>, String, f64, Option<String>)> = sqlx::query_as(
        r#"SELECT ve.id, v.voucher_date, v.voucher_number, ve.summary, ve.direction, ve.amount,
           (SELECT GROUP_CONCAT(ve2.account_code, ',') FROM voucher_entries ve2
            WHERE ve2.voucher_id = ve.voucher_id AND ve2.direction != ve.direction AND ve2.account_code != ?)
           FROM voucher_entries ve
           JOIN vouchers v ON ve.voucher_id = v.id
           WHERE v.period_id = ? AND ve.account_code = ? AND v.status = 'approved' AND v.company_id = ? AND (v.is_deleted = 0 OR v.is_deleted IS NULL)
           ORDER BY v.voucher_date, v.sequence_num, ve.line_num"#,
    )
    .bind(&account_code)
    .bind(&period_id)
    .bind(&account_code)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (_id, date, number, summary, direction, amount, opposite) in entries {
        let debit = if direction == "debit" { amount } else { 0.0 };
        let credit = if direction == "credit" { amount } else { 0.0 };

        if is_debit_normal {
            running_balance += debit - credit;
        } else {
            running_balance += credit - debit;
        }

        items.push(SubsidiaryLedgerItem {
            voucher_id: String::new(),
            voucher_date: date,
            voucher_number: number,
            summary: summary.unwrap_or_default(),
            opposite_account: opposite.unwrap_or_default(),
            debit,
            credit,
            balance: running_balance.abs(),
            balance_direction: if running_balance >= 0.0 { "借".to_string() } else { "贷".to_string() },
        });
    }

    Ok(items)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BalanceSheetResult {
    pub period_id: String,
    pub items: Vec<BalanceSheetItem>,
    pub total_assets: f64,
    pub total_liabilities: f64,
    pub total_equity: f64,
    pub opening_total_assets: f64,
    pub opening_total_liabilities: f64,
    pub opening_total_equity: f64,
    pub is_balanced: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BalanceSheetItem {
    pub item_code: String,
    pub item_name: String,
    pub item_level: i32,
    pub is_total: i32,
    pub opening_balance: f64,
    pub ending_balance: f64,
    pub section: String,
}

#[tauri::command]
pub async fn get_balance_sheet(
    period_id: String,
    db: State<'_, Database>,
) -> Result<BalanceSheetResult, String> {
    log::info!("Generating balance sheet for period: {}", period_id);

    // Derive company_id from period
    let company_id: String = sqlx::query_scalar(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get previous period for opening balances
    let prev_period_id: Option<String> = sqlx::query_scalar(
        r#"SELECT p2.id FROM accounting_periods p1
           JOIN accounting_periods p2 ON p2.company_id = p1.company_id
           AND (p2.period_year * 12 + p2.period_month) = (p1.period_year * 12 + p1.period_month) - 1
           WHERE p1.id = ?"#,
    )
    .bind(&period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let template: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_templates WHERE template_code = 'BALANCE_SHEET'",
    )
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let template_id = template.ok_or("资产负债表模板不存在")?.0;

    let report_items: Vec<(String, String, String, i32, i32, i32, Option<String>)> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Evaluate formulas for ending balance
    let mut raw_items: Vec<(String, String, i32, i32, f64, f64, String)> = Vec::new();
    let mut level_sums: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    let mut opening_level_sums: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    let mut current_section = "";

    for (_id, item_code, item_name, level, _sort, is_total, formula) in &report_items {
        let section = if item_code.starts_with("BS1") || item_code.starts_with("BS2") {
            "asset"
        } else if item_code.starts_with("BS3") || item_code.starts_with("BS4") || item_code.starts_with("BS5") {
            "liability"
        } else if item_code.starts_with("BS6") || item_code.starts_with("BS7") {
            "equity"
        } else if item_code.starts_with("BS9") {
            "asset"
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
            let ending = evaluate_formula(f, &company_id, &period_id, db.pool()).await;
            let opening = if let Some(ref prev_id) = prev_period_id {
                evaluate_formula(f, &company_id, prev_id, db.pool()).await
            } else {
                0.0
            };
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

        raw_items.push((item_code.clone(), item_name.clone(), *level, *is_total, ending_amount, opening_amount, section.to_string()));
    }

    // Compute grand totals from the last total in each section
    let mut total_assets = 0.0;
    let mut total_liabilities = 0.0;
    let mut total_equity = 0.0;
    let mut opening_total_assets = 0.0;
    let mut opening_total_liabilities = 0.0;
    let mut opening_total_equity = 0.0;

    for (_code, _, _, is_total, ending, opening, section) in &raw_items {
        if *is_total == 1 {
            match section.as_str() {
                "asset" => { total_assets = *ending; opening_total_assets = *opening; }
                "liability" => { total_liabilities = *ending; opening_total_liabilities = *opening; }
                "equity" => { total_equity = *ending; opening_total_equity = *opening; }
                _ => {}
            }
        }
    }

    let items: Vec<BalanceSheetItem> = raw_items.into_iter().map(|(item_code, item_name, item_level, is_total, ending_balance, opening_balance, section)| {
        BalanceSheetItem { item_code, item_name, item_level, is_total, opening_balance, ending_balance, section }
    }).collect();

    let is_balanced = (total_assets - total_liabilities - total_equity).abs() < 0.01;

    Ok(BalanceSheetResult {
        period_id,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomeStatementResult {
    pub period_id: String,
    pub items: Vec<IncomeStatementItem>,
    pub current_period_total: f64,
    pub year_to_date_total: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomeStatementItem {
    pub item_code: String,
    pub item_name: String,
    pub item_level: i32,
    pub is_total: i32,
    pub current_amount: f64,
    pub year_to_date: f64,
}

#[tauri::command]
pub async fn get_income_statement(
    period_id: String,
    db: State<'_, Database>,
) -> Result<IncomeStatementResult, String> {
    log::info!("Generating income statement for period: {}", period_id);

    // Get period info and company for year-to-date calculation
    let period_info: Option<(String, i32, i32)> = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (company_id, period_year, _period_month) = period_info
        .ok_or_else(|| "会计期间不存在".to_string())?;

    // Get all periods in the same year up to and including the selected month for YTD
    let ytd_period_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month <= ? ORDER BY period_month",
    )
    .bind(&company_id)
    .bind(period_year)
    .bind(_period_month)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let template: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_templates WHERE template_code = 'INCOME_STATEMENT'",
    )
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let template_id = template.ok_or("利润表模板不存在")?.0;

    let report_items: Vec<(String, String, String, i32, i32, i32, Option<String>)> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Items that should be subtracted (expenses/losses)
    let subtract_items: std::collections::HashSet<&str> = [
        "IS002", "IS003", "IS004", "IS005", "IS006", "IS007",
        "IS012", "IS014",
    ].iter().cloned().collect();

    let mut items = Vec::new();
    let mut running_sum = 0.0;
    let mut ytd_running_sum = 0.0;

    for (_id, item_code, item_name, level, _sort, is_total, formula) in &report_items {
        // Current period amount
        let current_amount = if let Some(f) = formula {
            let val = evaluate_formula(f, &company_id, &period_id, db.pool()).await;
            if is_total == &0 {
                if subtract_items.contains(item_code.as_str()) {
                    running_sum -= val;
                } else {
                    running_sum += val;
                }
            }
            val
        } else if is_total == &1 {
            let total = running_sum;
            running_sum = 0.0;
            total
        } else {
            0.0
        };

        // Year-to-date: sum across all periods in the year up to current
        let ytd_amount = if let Some(f) = formula {
            let mut ytd_val = 0.0;
            for pid in &ytd_period_ids {
                ytd_val += evaluate_formula(f, &company_id, pid, db.pool()).await;
            }
            if is_total == &0 {
                if subtract_items.contains(item_code.as_str()) {
                    ytd_running_sum -= ytd_val;
                } else {
                    ytd_running_sum += ytd_val;
                }
            }
            ytd_val
        } else if is_total == &1 {
            let total = ytd_running_sum;
            ytd_running_sum = 0.0;
            total
        } else {
            0.0
        };

        items.push(IncomeStatementItem {
            item_code: item_code.clone(),
            item_name: item_name.clone(),
            item_level: *level,
            is_total: *is_total,
            current_amount,
            year_to_date: ytd_amount,
        });
    }

    // The last total item (IS015 净利润) is the current_period_total
    let current_total = items.iter()
        .filter(|i| i.is_total == 1 && i.item_code == "IS015")
        .map(|i| i.current_amount)
        .next()
        .unwrap_or(0.0);

    let ytd_total = items.iter()
        .filter(|i| i.is_total == 1 && i.item_code == "IS015")
        .map(|i| i.year_to_date)
        .next()
        .unwrap_or(0.0);

    Ok(IncomeStatementResult {
        period_id,
        items,
        current_period_total: current_total,
        year_to_date_total: ytd_total,
    })
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
async fn evaluate_formula(formula: &str, company_id: &str, period_id: &str, pool: &sqlx::Pool<Sqlite>) -> f64 {
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
        } else {
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

async fn evaluate_token(token: &str, company_id: &str, period_id: &str, pool: &sqlx::Pool<Sqlite>) -> f64 {
    if let Some(colon_pos) = token.find(':') {
        let rule = &token[..colon_pos];
        let code = &token[colon_pos + 1..];
        match rule {
            "opening" => get_account_balance_by_rule(code, company_id, period_id, "opening", pool).await,
            "debit" => get_account_balance_by_rule(code, company_id, period_id, "period_debit", pool).await,
            "credit" => get_account_balance_by_rule(code, company_id, period_id, "period_credit", pool).await,
            "cdebit" => get_account_balance_by_rule(code, company_id, period_id, "cumulative_debit", pool).await,
            "ccredit" => get_account_balance_by_rule(code, company_id, period_id, "cumulative_credit", pool).await,
            "closing_d" => get_account_balance_by_rule(code, company_id, period_id, "closing_debit", pool).await,
            "closing_c" => get_account_balance_by_rule(code, company_id, period_id, "closing_credit", pool).await,
            _ => 0.0,
        }
    } else {
        // Default: closing balance (net, based on normal_balance)
        get_account_closing_balance(token, company_id, period_id, pool).await
    }
}

async fn get_account_balance_by_rule(code: &str, company_id: &str, period_id: &str, rule: &str, pool: &sqlx::Pool<Sqlite>) -> f64 {
    // Sum balances for the exact code AND all child codes (e.g., "2211" matches "2211", "221101", "221102", etc.)
    let rows: Vec<(String, f64, f64, f64, f64)> = sqlx::query_as(
        "SELECT ab.account_code, COALESCE(ab.opening_debit, 0), COALESCE(ab.opening_credit, 0), COALESCE(ab.period_debit, 0), COALESCE(ab.period_credit, 0) FROM account_balances ab WHERE ab.period_id = ? AND (ab.account_code = ? OR ab.account_code LIKE ?) ORDER BY ab.account_code",
    )
    .bind(period_id)
    .bind(code)
    .bind(format!("{}%", code))
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return 0.0;
    }

    let mut total_od = 0.0;
    let mut total_oc = 0.0;
    let mut total_pd = 0.0;
    let mut total_pc = 0.0;

    for (_row_code, od, oc, pd, pc) in &rows {
        total_od += od;
        total_oc += oc;
        total_pd += pd;
        total_pc += pc;
    }

    match rule {
        "opening" => {
            let normal: Option<(String,)> = sqlx::query_as(
                "SELECT normal_balance FROM account_codes WHERE company_id = ? AND code = ?",
            )
            .bind(company_id)
            .bind(code)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
            match normal.as_ref().map(|(b,)| b.as_str()) {
                Some("debit") => total_od - total_oc,
                _ => total_oc - total_od,
            }
        }
        "period_debit" => total_pd,
        "period_credit" => total_pc,
        "closing_debit" => total_od + total_pd,
        "closing_credit" => total_oc + total_pc,
        "cumulative_debit" => total_od + total_pd,
        "cumulative_credit" => total_oc + total_pc,
        _ => 0.0,
    }
}

async fn get_account_closing_balance(code: &str, company_id: &str, period_id: &str, pool: &sqlx::Pool<Sqlite>) -> f64 {
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

    let is_debit_normal = normal.as_ref().map(|(b,)| b.as_str() == "debit").unwrap_or(true);

    // Sum closing balances for exact code AND all child codes
    let rows: Vec<(f64, f64)> = sqlx::query_as(
        "SELECT COALESCE(closing_debit, 0), COALESCE(closing_credit, 0) FROM account_balances WHERE period_id = ? AND (account_code = ? OR account_code LIKE ?)",
    )
    .bind(period_id)
    .bind(code)
    .bind(format!("{}%", code))
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CashFlowResult {
    pub period_id: String,
    pub items: Vec<CashFlowItem>,
    pub net_increase: f64,
    pub net_increase_year_to_date: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CashFlowItem {
    pub item_code: String,
    pub item_name: String,
    pub item_level: i32,
    pub is_total: i32,
    pub current_amount: f64,
    pub year_to_date: f64,
}

#[tauri::command]
pub async fn get_cash_flow_statement(
    period_id: String,
    db: State<'_, Database>,
) -> Result<CashFlowResult, String> {
    log::info!("Generating cash flow statement for period: {}", period_id);

    // Read the selected period once so the report can expose both the month and the
    // year-to-date cash-flow amounts using the same accounting-period boundary.
    let period_info: Option<(String, i32, i32)> = sqlx::query_as(
        "SELECT company_id, period_year, period_month FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (company_id, period_year, period_month) = period_info
        .ok_or_else(|| "会计期间不存在".to_string())?;

    let ytd_period_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month <= ? ORDER BY period_month",
    )
    .bind(&company_id)
    .bind(period_year)
    .bind(period_month)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let template: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_templates WHERE template_code = 'CASH_FLOW'",
    )
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // If no template, create default
    let template_id = if let Some((id,)) = template {
        id
    } else {
        return Ok(CashFlowResult {
            period_id,
            items: vec![],
            net_increase: 0.0,
            net_increase_year_to_date: 0.0,
        });
    };

    let report_items: Vec<(String, String, String, i32, i32, i32, Option<String>)> = sqlx::query_as(
        "SELECT id, item_code, item_name, item_level, sort_order, is_total, formula FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
    .bind(&template_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut items = Vec::new();
    let mut running_sum = 0.0;
    let mut ytd_running_sum = 0.0;

    for (_id, item_code, item_name, level, _sort, is_total, formula) in &report_items {
        let current_amount = if let Some(f) = formula {
            let val = evaluate_formula(f, &company_id, &period_id, db.pool()).await;
            if is_total == &0 {
                running_sum += val;
            }
            val
        } else if is_total == &1 {
            let total = running_sum;
            running_sum = 0.0;
            total
        } else {
            0.0
        };

        let year_to_date = if let Some(f) = formula {
            let mut value = 0.0;
            for ytd_period_id in &ytd_period_ids {
                value += evaluate_formula(f, &company_id, ytd_period_id, db.pool()).await;
            }
            if is_total == &0 {
                ytd_running_sum += value;
            }
            value
        } else if is_total == &1 {
            let total = ytd_running_sum;
            ytd_running_sum = 0.0;
            total
        } else {
            0.0
        };

        items.push(CashFlowItem {
            item_code: item_code.clone(),
            item_name: item_name.clone(),
            item_level: *level,
            is_total: *is_total,
            current_amount,
            year_to_date,
        });
    }

    // CF999's formula stores the closing cash balance in the system template.
    // The cash-flow increase is therefore the sum of operating, investing,
    // financing and exchange-rate section totals, excluding that closing balance.
    let net_increase = items.iter()
        .filter(|item| item.is_total == 1 && item.item_code != "CF999")
        .map(|item| item.current_amount)
        .sum();
    let net_increase_year_to_date = items.iter()
        .filter(|item| item.is_total == 1 && item.item_code != "CF999")
        .map(|item| item.year_to_date)
        .sum();

    Ok(CashFlowResult {
        period_id,
        items,
        net_increase,
        net_increase_year_to_date,
    })
}

// ==================== Report Template CRUD ====================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReportTemplate {
    pub id: String,
    pub template_code: String,
    pub template_name: String,
    pub report_type: String,
    pub is_system: i32,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
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
    pub is_enabled: i32,
}

#[tauri::command]
pub async fn get_report_templates(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ReportTemplate>, String> {
    // Report templates are system-wide (is_system=1) with no company_id column.
    // Return all templates; company_id is accepted for future custom-template support.
    let _ = &company_id;
    let templates: Vec<ReportTemplate> = sqlx::query_as(
        "SELECT * FROM report_templates ORDER BY report_type, template_name",
    )
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(templates)
}

#[tauri::command]
pub async fn get_report_items(
    template_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ReportItem>, String> {
    // Verify the template exists; system templates are shared across all companies.
    // company_id is accepted for future custom-template ownership verification.
    let _ = &company_id;
    let template_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_templates WHERE id = ?",
    )
    .bind(&template_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if template_exists.is_none() {
        return Err("报表模板不存在".to_string());
    }

    let items: Vec<ReportItem> = sqlx::query_as(
        "SELECT * FROM report_items WHERE template_id = ? ORDER BY sort_order",
    )
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
}

#[tauri::command]
pub async fn update_report_item(
    input: UpdateReportItemInput,
    company_id: String,
    db: State<'_, Database>,
) -> Result<ReportItem, String> {
    // Verify the item exists and belongs to a template accessible by this company.
    // System templates are shared; company_id is for future custom-template support.
    let _ = &company_id;
    let existing: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Item not found: {}", e))?;

    let item_name = input.item_name.unwrap_or(existing.item_name);
    let formula = input.formula.or(existing.formula);
    let sort_order = input.sort_order.unwrap_or(existing.sort_order);
    let is_total = input.is_total.unwrap_or(existing.is_total);

    sqlx::query(
        "UPDATE report_items SET item_name = ?, formula = ?, sort_order = ?, is_total = ? WHERE id = ?",
    )
    .bind(&item_name)
    .bind(&formula)
    .bind(sort_order)
    .bind(is_total)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to update report item: {}", e))?;

    let item: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch updated item: {}", e))?;

    Ok(item)
}

#[tauri::command]
pub async fn create_report_item(
    template_id: String,
    item_code: String,
    item_name: String,
    item_level: i32,
    sort_order: i32,
    is_total: i32,
    formula: Option<String>,
    company_id: String,
    db: State<'_, Database>,
) -> Result<ReportItem, String> {
    // Verify the template exists; system templates are shared across all companies.
    // company_id is for future custom-template ownership verification.
    let _ = &company_id;
    let template_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_templates WHERE id = ?",
    )
    .bind(&template_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if template_exists.is_none() {
        return Err("报表模板不存在".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&template_id)
    .bind(&item_code)
    .bind(&item_name)
    .bind(item_level)
    .bind(sort_order)
    .bind(is_total)
    .bind(&formula)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create report item: {}", e))?;

    let item: ReportItem = sqlx::query_as("SELECT * FROM report_items WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch created item: {}", e))?;

    Ok(item)
}

#[tauri::command]
pub async fn delete_report_item(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    // Verify the item exists and belongs to a template accessible by this company.
    // System templates are shared; company_id is for future custom-template support.
    let _ = &company_id;
    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM report_items WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if exists.is_none() {
        return Err("报表项目不存在".to_string());
    }

    sqlx::query("DELETE FROM report_items WHERE id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete report item: {}", e))?;
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
