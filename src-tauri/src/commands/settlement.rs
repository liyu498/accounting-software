use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

// ── Data types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SettlementRule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub rule_type: String,
    pub source_formula: Option<String>,
    pub target_account_code: Option<String>,
    pub voucher_word_id: Option<String>,
    pub summary_template: Option<String>,
    pub priority: i32,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSettlementRuleInput {
    pub company_id: String,
    pub name: String,
    pub rule_type: String,
    pub source_formula: Option<String>,
    pub target_account_code: Option<String>,
    pub voucher_word_id: Option<String>,
    pub summary_template: Option<String>,
    pub priority: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSettlementRuleInput {
    pub id: String,
    pub company_id: String,
    pub name: Option<String>,
    pub rule_type: Option<String>,
    pub source_formula: Option<String>,
    pub target_account_code: Option<String>,
    pub voucher_word_id: Option<String>,
    pub summary_template: Option<String>,
    pub priority: Option<i32>,
    pub is_enabled: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SettlementResult {
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub total_debit: f64,
    pub total_credit: f64,
    pub entries: Vec<SettlementEntryResult>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SettlementEntryResult {
    pub account_code: String,
    pub account_name: String,
    pub direction: String,
    pub amount: f64,
}

// ── CRUD commands ───────────────────────────────────────────

#[tauri::command]
pub async fn get_settlement_rules(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<SettlementRule>, String> {
    let rules: Vec<SettlementRule> = sqlx::query_as(
        "SELECT * FROM settlement_rules WHERE company_id = ? ORDER BY priority, name",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rules)
}

#[tauri::command]
pub async fn create_settlement_rule(
    input: CreateSettlementRuleInput,
    db: State<'_, Database>,
) -> Result<SettlementRule, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let priority = input.priority.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO settlement_rules (id, company_id, name, rule_type, source_formula,
            target_account_code, voucher_word_id, summary_template, priority, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.name)
    .bind(&input.rule_type)
    .bind(&input.source_formula)
    .bind(&input.target_account_code)
    .bind(&input.voucher_word_id)
    .bind(&input.summary_template)
    .bind(priority)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create settlement rule: {}", e))?;

    let rule: SettlementRule = sqlx::query_as("SELECT * FROM settlement_rules WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch created rule: {}", e))?;

    Ok(rule)
}

#[tauri::command]
pub async fn update_settlement_rule(
    input: UpdateSettlementRuleInput,
    db: State<'_, Database>,
) -> Result<SettlementRule, String> {
    let existing: SettlementRule = sqlx::query_as("SELECT * FROM settlement_rules WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Rule not found: {}", e))?;

    let name = input.name.unwrap_or(existing.name);
    let rule_type = input.rule_type.unwrap_or(existing.rule_type);
    let source_formula = input.source_formula.or(existing.source_formula);
    let target_account_code = input.target_account_code.or(existing.target_account_code);
    let voucher_word_id = input.voucher_word_id.or(existing.voucher_word_id);
    let summary_template = input.summary_template.or(existing.summary_template);
    let priority = input.priority.unwrap_or(existing.priority);
    let is_enabled = input.is_enabled.unwrap_or(existing.is_enabled);

    sqlx::query(
        r#"
        UPDATE settlement_rules SET name = ?, rule_type = ?, source_formula = ?,
            target_account_code = ?, voucher_word_id = ?, summary_template = ?,
            priority = ?, is_enabled = ?
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(&name)
    .bind(&rule_type)
    .bind(&source_formula)
    .bind(&target_account_code)
    .bind(&voucher_word_id)
    .bind(&summary_template)
    .bind(priority)
    .bind(is_enabled)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to update settlement rule: {}", e))?;

    let rule: SettlementRule = sqlx::query_as("SELECT * FROM settlement_rules WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch updated rule: {}", e))?;

    Ok(rule)
}

#[tauri::command]
pub async fn delete_settlement_rule(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM settlement_rules WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete settlement rule: {}", e))?;

    Ok(())
}

// ── Auto-settlement: generate settlement voucher ────────────

#[tauri::command]
pub async fn generate_settlement_voucher(
    company_id: String,
    period_id: String,
    rule_type: String,
    db: State<'_, Database>,
) -> Result<SettlementResult, String> {
    // Validate period is open
    let period: Option<(String, i32, i32, String)> = sqlx::query_as(
        "SELECT id, period_year, period_month, status FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (_, period_year, period_month, status) = period
        .ok_or_else(|| "会计期间不存在".to_string())?;

    if status != "open" {
        return Err("该会计期间已结账，不能生成结转凭证".to_string());
    }

    let voucher_date = format!(
        "{}-{:02}-{}",
        period_year,
        period_month,
        get_last_day_of_month(period_year, period_month)
    );

    match rule_type.as_str() {
        "profit_loss" => generate_profit_loss_settlement(
            &company_id,
            &period_id,
            &voucher_date,
            db.pool(),
        )
        .await,
        _ => Err(format!("不支持的结转类型: {}", rule_type)),
    }
}

async fn generate_profit_loss_settlement(
    company_id: &str,
    period_id: &str,
    voucher_date: &str,
    pool: &sqlx::Pool<sqlx::Sqlite>,
) -> Result<SettlementResult, String> {
    // Find all revenue accounts (6xxx with credit balance) and expense accounts (6xxx with debit balance)
    // In Chinese accounting: revenue = credit balance, expense = debit balance
    let revenue_accounts: Vec<(String, String, f64)> = sqlx::query_as(
        r#"
        SELECT ac.code, ac.name,
            COALESCE(SUM(ve.amount), 0) as total_amount
        FROM account_codes ac
        LEFT JOIN voucher_entries ve ON ve.account_code = ac.code
        LEFT JOIN vouchers v ON v.id = ve.voucher_id AND v.period_id = ? AND v.company_id = ? AND v.status != 'reversed'
        WHERE ac.account_type = 'revenue'
            AND ac.company_id = ?
            AND ac.is_detail = 1
            AND ac.is_enabled = 1
            AND ve.direction = 'credit'
        GROUP BY ac.code, ac.name
        HAVING total_amount > 0
        ORDER BY ac.code
        "#,
    )
    .bind(period_id)
    .bind(company_id)
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query revenue accounts: {}", e))?;

    let expense_accounts: Vec<(String, String, f64)> = sqlx::query_as(
        r#"
        SELECT ac.code, ac.name,
            COALESCE(SUM(ve.amount), 0) as total_amount
        FROM account_codes ac
        LEFT JOIN voucher_entries ve ON ve.account_code = ac.code
        LEFT JOIN vouchers v ON v.id = ve.voucher_id AND v.period_id = ? AND v.company_id = ? AND v.status != 'reversed'
        WHERE ac.account_type = 'cost'
            AND ac.company_id = ?
            AND ac.is_detail = 1
            AND ac.is_enabled = 1
            AND ve.direction = 'debit'
        GROUP BY ac.code, ac.name
        HAVING total_amount > 0
        ORDER BY ac.code
        "#,
    )
    .bind(period_id)
    .bind(company_id)
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query expense accounts: {}", e))?;

    // Also check for expense-type accounts under 'profit_loss' type
    let profit_loss_expense_accounts: Vec<(String, String, f64)> = sqlx::query_as(
        r#"
        SELECT ac.code, ac.name,
            COALESCE(SUM(ve.amount), 0) as total_amount
        FROM account_codes ac
        LEFT JOIN voucher_entries ve ON ve.account_code = ac.code
        LEFT JOIN vouchers v ON v.id = ve.voucher_id AND v.period_id = ? AND v.company_id = ? AND v.status != 'reversed'
        WHERE ac.account_type = 'profit_loss'
            AND ac.company_id = ?
            AND ac.is_detail = 1
            AND ac.is_enabled = 1
            AND ve.direction = 'debit'
        GROUP BY ac.code, ac.name
        HAVING total_amount > 0
        ORDER BY ac.code
        "#,
    )
    .bind(period_id)
    .bind(company_id)
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query profit_loss expense accounts: {}", e))?;

    // Also check for profit_loss credit entries (other income)
    let profit_loss_credit_accounts: Vec<(String, String, f64)> = sqlx::query_as(
        r#"
        SELECT ac.code, ac.name,
            COALESCE(SUM(ve.amount), 0) as total_amount
        FROM account_codes ac
        LEFT JOIN voucher_entries ve ON ve.account_code = ac.code
        LEFT JOIN vouchers v ON v.id = ve.voucher_id AND v.period_id = ? AND v.company_id = ? AND v.status != 'reversed'
        WHERE ac.account_type = 'profit_loss'
            AND ac.company_id = ?
            AND ac.is_detail = 1
            AND ac.is_enabled = 1
            AND ve.direction = 'credit'
        GROUP BY ac.code, ac.name
        HAVING total_amount > 0
        ORDER BY ac.code
        "#,
    )
    .bind(period_id)
    .bind(company_id)
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query profit_loss credit accounts: {}", e))?;

    // Check if there's anything to settle
    let total_revenue: f64 = revenue_accounts.iter().map(|(_, _, a)| a).sum::<f64>()
        + profit_loss_credit_accounts.iter().map(|(_, _, a)| a).sum::<f64>();
    let total_expense: f64 = expense_accounts.iter().map(|(_, _, a)| a).sum::<f64>()
        + profit_loss_expense_accounts.iter().map(|(_, _, a)| a).sum::<f64>();

    if total_revenue == 0.0 && total_expense == 0.0 {
        return Ok(SettlementResult {
            voucher_id: None,
            voucher_number: None,
            total_debit: 0.0,
            total_credit: 0.0,
            entries: vec![],
            message: "本期无收入和费用，无需结转损益".to_string(),
        });
    }

    // Find target account: 本年利润 (3101)
    let target_account: Option<(String, String)> = sqlx::query_as(
        "SELECT code, name FROM account_codes WHERE code = '3101' AND company_id = ? AND is_enabled = 1",
    )
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (target_code, target_name) = target_account
        .ok_or_else(|| "未找到本年利润科目(3101)，请先在科目表中添加".to_string())?;

    // Find default voucher word
    let voucher_word: Option<(String, String, String)> = sqlx::query_as(
        "SELECT id, word_code, word_name FROM voucher_words WHERE company_id = ? AND is_enabled = 1 ORDER BY word_code LIMIT 1",
    )
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (voucher_word_id, _word_code, word_name) = voucher_word
        .ok_or_else(|| "未找到可用的凭证字，请先创建凭证字".to_string())?;

    // Build entries for settlement voucher
    let mut entries: Vec<SettlementEntryResult> = Vec::new();

    // Revenue entries: debit revenue accounts (reverse their credit balance), credit 本年利润
    for (code, name, amount) in &revenue_accounts {
        entries.push(SettlementEntryResult {
            account_code: code.clone(),
            account_name: name.clone(),
            direction: "debit".to_string(),
            amount: *amount,
        });
    }
    for (code, name, amount) in &profit_loss_credit_accounts {
        entries.push(SettlementEntryResult {
            account_code: code.clone(),
            account_name: name.clone(),
            direction: "debit".to_string(),
            amount: *amount,
        });
    }

    // Expense entries: credit expense accounts (reverse their debit balance), debit 本年利润
    for (code, name, amount) in &expense_accounts {
        entries.push(SettlementEntryResult {
            account_code: code.clone(),
            account_name: name.clone(),
            direction: "credit".to_string(),
            amount: *amount,
        });
    }
    for (code, name, amount) in &profit_loss_expense_accounts {
        entries.push(SettlementEntryResult {
            account_code: code.clone(),
            account_name: name.clone(),
            direction: "credit".to_string(),
            amount: *amount,
        });
    }

    // 本年利润 entry: credit = total_revenue - total_expense if positive, debit if negative
    let net_profit = total_revenue - total_expense;
    if net_profit > 0.0 {
        entries.push(SettlementEntryResult {
            account_code: target_code.clone(),
            account_name: target_name.clone(),
            direction: "credit".to_string(),
            amount: net_profit,
        });
    } else if net_profit < 0.0 {
        entries.push(SettlementEntryResult {
            account_code: target_code.clone(),
            account_name: target_name.clone(),
            direction: "debit".to_string(),
            amount: net_profit.abs(),
        });
    }

    // Calculate totals
    let total_debit: f64 = entries.iter().filter(|e| e.direction == "debit").map(|e| e.amount).sum();
    let total_credit: f64 = entries.iter().filter(|e| e.direction == "credit").map(|e| e.amount).sum();

    // Create the voucher
    let last_seq: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND voucher_word_id = ?",
    )
    .bind(period_id)
    .bind(&voucher_word_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let sequence_num = match last_seq {
        Some((Some(n),)) => n + 1,
        _ => 1,
    };
    let voucher_number = format!("{}字第{:03}号", word_name, sequence_num);

    let voucher_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let summary_text = "结转损益";

    let mut tx = pool.begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    sqlx::query(
        r#"
        INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit, version,
            created_by, created_at, is_system)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, 1, 'system', ?, 1)
        "#,
    )
    .bind(&voucher_id)
    .bind(company_id)
    .bind(period_id)
    .bind(&voucher_word_id)
    .bind(&voucher_number)
    .bind(sequence_num)
    .bind(voucher_date)
    .bind(summary_text)
    .bind(total_debit)
    .bind(total_credit)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create settlement voucher: {}", e))?;

    for (line_num, entry) in entries.iter().enumerate() {
        let entry_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                direction, amount, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry_id)
        .bind(&voucher_id)
        .bind((line_num + 1) as i32)
        .bind(&entry.account_code)
        .bind(&entry.account_name)
        .bind(&entry.direction)
        .bind(entry.amount)
        .bind(summary_text)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create settlement entry: {}", e))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit settlement voucher: {}", e))?;

    Ok(SettlementResult {
        voucher_id: Some(voucher_id),
        voucher_number: Some(voucher_number),
        total_debit,
        total_credit,
        entries,
        message: format!(
            "结转损益凭证已生成: 收入 {}, 费用 {}, 净利润 {}",
            total_revenue, total_expense, net_profit
        ),
    })
}

fn get_last_day_of_month(year: i32, month: i32) -> String {
    let last_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    };
    format!("{:02}", last_day)
}
