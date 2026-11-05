use crate::commands::auth::authenticated_actor;
use crate::db::{Database, DbPool};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
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
#[serde(rename_all = "camelCase")]
pub struct SettlementPreviewEntry {
    pub account_code: String,
    pub account_name: String,
    pub direction: String,
    pub amount: f64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementRulePreview {
    pub rule_id: String,
    pub rule_name: String,
    pub period_id: String,
    pub period_label: String,
    pub voucher_date: String,
    pub voucher_word_id: String,
    pub voucher_word_name: String,
    pub target_account_code: String,
    pub summary: String,
    pub entries: Vec<SettlementPreviewEntry>,
    pub total_debit: f64,
    pub total_credit: f64,
    pub total_amount: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementVoucherDraft {
    pub id: String,
    pub voucher_number: String,
    pub rule_id: String,
    pub total_debit: f64,
    pub total_credit: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct SettlementAccountRow {
    code: String,
    name: String,
    account_type: String,
    is_detail: i32,
    is_enabled: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct SettlementSourceEntryRow {
    account_code: String,
    direction: String,
    amount: f64,
}

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn extract_account_codes(value: &str) -> Vec<String> {
    let mut codes = Vec::new();
    let mut current = String::new();
    for character in value.chars().chain(std::iter::once(' ')) {
        if character.is_ascii_digit() {
            current.push(character);
        } else {
            if (4..=12).contains(&current.len()) && !codes.contains(&current) {
                codes.push(current.clone());
            }
            current.clear();
        }
    }
    codes
}

async fn build_rule_preview(
    rule_id: &str,
    company_id: &str,
    period_id: &str,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<SettlementRulePreview, String> {
    let rule: SettlementRule = sqlx::query_as(
        "SELECT * FROM settlement_rules WHERE id = ? AND company_id = ? AND is_enabled = 1",
    )
    .bind(rule_id)
    .bind(company_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?
    .ok_or_else(|| "结转规则不存在或未启用".to_string())?;

    let period: Option<(i32, i32, String, String)> = sqlx::query_as(
        "SELECT period_year, period_month, end_date, status FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let (period_year, period_month, voucher_date, period_status) =
        period.ok_or_else(|| "会计期间不存在".to_string())?;
    if period_status != "open" {
        return Err("当前账期已结账，不能生成结转凭证".to_string());
    }

    let duplicate: Option<(String, String)> = sqlx::query_as(
        "SELECT id, voucher_number FROM vouchers WHERE company_id = ? AND period_id = ? AND settlement_rule_id = ? AND is_deleted = 0 AND status != 'reversed' LIMIT 1",
    )
    .bind(company_id)
    .bind(period_id)
    .bind(rule_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if let Some((_, voucher_number)) = duplicate {
        return Err(format!(
            "当前账期已存在结转凭证 {}，请先处理已有凭证",
            voucher_number
        ));
    }

    let accounts: Vec<SettlementAccountRow> = sqlx::query_as(
        "SELECT code, name, account_type, is_detail, is_enabled FROM account_codes WHERE company_id = ?",
    )
    .bind(company_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let account_by_code: BTreeMap<String, SettlementAccountRow> = accounts
        .into_iter()
        .filter(|account| account.is_detail == 1 && account.is_enabled == 1)
        .map(|account| (account.code.clone(), account))
        .collect();

    let target_code = extract_account_codes(rule.target_account_code.as_deref().unwrap_or(""))
        .into_iter()
        .next()
        .ok_or_else(|| "目标科目未设置".to_string())?;
    let target_account = account_by_code
        .get(&target_code)
        .ok_or_else(|| "目标科目不存在、已停用或不是明细科目".to_string())?;

    let source_codes: Vec<String> = if rule.rule_type == "profit_loss" {
        account_by_code
            .values()
            .filter(|account| {
                matches!(
                    account.account_type.as_str(),
                    "income" | "revenue" | "expense"
                )
            })
            .map(|account| account.code.clone())
            .collect()
    } else {
        let codes = extract_account_codes(rule.source_formula.as_deref().unwrap_or(""));
        if codes.is_empty() {
            return Err("非损益结转必须在取数规则中填写来源科目编码".to_string());
        }
        codes
    };
    if source_codes.contains(&target_code) {
        return Err("目标科目不能同时作为来源科目".to_string());
    }
    for code in &source_codes {
        if !account_by_code.contains_key(code) {
            return Err(format!("来源科目 {} 不存在、已停用或不是明细科目", code));
        }
    }

    let source_set: BTreeSet<&str> = source_codes.iter().map(String::as_str).collect();
    let rows: Vec<SettlementSourceEntryRow> = sqlx::query_as(
        r#"
        SELECT ve.account_code, ve.direction, ve.amount
        FROM voucher_entries ve
        INNER JOIN vouchers v ON v.id = ve.voucher_id
        WHERE v.company_id = ? AND v.period_id = ? AND v.status = 'approved'
          AND v.is_deleted = 0 AND v.is_settlement = 0 AND v.settlement_rule_id IS NULL
        "#,
    )
    .bind(company_id)
    .bind(period_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let mut net_by_account: BTreeMap<String, f64> = source_codes
        .iter()
        .map(|code| (code.clone(), 0.0))
        .collect();
    for row in rows {
        if !source_set.contains(row.account_code.as_str()) {
            continue;
        }
        let signed_amount = if row.direction == "debit" {
            row.amount
        } else {
            -row.amount
        };
        *net_by_account.entry(row.account_code).or_default() += signed_amount;
    }

    let period_label = format!("{:04}-{:02}", period_year, period_month);
    let summary = rule
        .summary_template
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{}结转", rule.name))
        .replace("{期间}", &period_label)
        .replace("{账期}", &period_label);
    let mut entries = Vec::new();
    for (code, net_debit) in net_by_account {
        let net_debit = round_money(net_debit);
        if net_debit.abs() < 0.005 {
            continue;
        }
        let account = account_by_code
            .get(&code)
            .ok_or_else(|| format!("来源科目 {} 不存在", code))?;
        entries.push(SettlementPreviewEntry {
            account_code: code,
            account_name: account.name.clone(),
            direction: if net_debit > 0.0 { "credit" } else { "debit" }.to_string(),
            amount: round_money(net_debit.abs()),
            summary: summary.clone(),
        });
    }
    if entries.is_empty() {
        return Err("当前账期没有可结转的来源科目发生额".to_string());
    }
    let mut total_debit = round_money(
        entries
            .iter()
            .filter(|entry| entry.direction == "debit")
            .map(|entry| entry.amount)
            .sum(),
    );
    let mut total_credit = round_money(
        entries
            .iter()
            .filter(|entry| entry.direction == "credit")
            .map(|entry| entry.amount)
            .sum(),
    );
    let difference = round_money(total_debit - total_credit);
    if difference.abs() >= 0.005 {
        entries.push(SettlementPreviewEntry {
            account_code: target_code.clone(),
            account_name: target_account.name.clone(),
            direction: if difference > 0.0 { "credit" } else { "debit" }.to_string(),
            amount: round_money(difference.abs()),
            summary: summary.clone(),
        });
        total_debit = round_money(
            entries
                .iter()
                .filter(|entry| entry.direction == "debit")
                .map(|entry| entry.amount)
                .sum(),
        );
        total_credit = round_money(
            entries
                .iter()
                .filter(|entry| entry.direction == "credit")
                .map(|entry| entry.amount)
                .sum(),
        );
    }
    if entries.len() < 2 || (total_debit - total_credit).abs() >= 0.005 {
        return Err("结转分录无法形成借贷平衡凭证".to_string());
    }

    let preferred_word = rule.voucher_word_id.as_deref().unwrap_or("").trim();
    let voucher_word: Option<(String, String)> = if preferred_word.is_empty() {
        sqlx::query_as(
            "SELECT id, word_name FROM voucher_words WHERE company_id = ? AND is_enabled = 1 ORDER BY word_code LIMIT 1",
        )
        .bind(company_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?
    } else {
        sqlx::query_as(
            "SELECT id, word_name FROM voucher_words WHERE company_id = ? AND is_enabled = 1 AND (id = ? OR word_code = ? OR word_name = ?) LIMIT 1",
        )
        .bind(company_id)
        .bind(preferred_word)
        .bind(preferred_word)
        .bind(preferred_word)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?
    };
    let (voucher_word_id, voucher_word_name) =
        voucher_word.ok_or_else(|| "未找到可用凭证字".to_string())?;

    Ok(SettlementRulePreview {
        rule_id: rule.id,
        rule_name: rule.name,
        period_id: period_id.to_string(),
        period_label,
        voucher_date,
        voucher_word_id,
        voucher_word_name,
        target_account_code: target_code,
        summary,
        total_debit,
        total_credit,
        total_amount: total_debit.max(total_credit),
        entries,
    })
}

pub(crate) async fn ensure_settlement_rules_completed(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
) -> Result<(), String> {
    let rules: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM settlement_rules WHERE company_id = ? AND is_enabled = 1 ORDER BY priority, name",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取启用的结转规则失败: {error}"))?;
    if rules.is_empty() {
        return Err("未配置启用的结转规则，不能结账".to_string());
    }

    let mut blockers = Vec::new();
    for (rule_id, rule_name) in rules {
        let active_status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM vouchers WHERE company_id = ? AND period_id = ? AND settlement_rule_id = ? AND is_deleted = 0 AND status != 'reversed' ORDER BY created_at DESC LIMIT 1",
        )
        .bind(company_id)
        .bind(period_id)
        .bind(&rule_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取结转凭证状态失败: {error}"))?;
        if active_status.as_deref() == Some("approved") {
            continue;
        }
        if let Some(status) = active_status {
            blockers.push(format!("{rule_name}（结转凭证状态：{status}）"));
            continue;
        }

        let mut transaction = pool
            .begin()
            .await
            .map_err(|error| format!("检查结转规则失败: {error}"))?;
        let preview = build_rule_preview(&rule_id, company_id, period_id, &mut transaction).await;
        transaction
            .rollback()
            .await
            .map_err(|error| format!("结束结转规则检查失败: {error}"))?;
        match preview {
            Ok(_) => blockers.push(format!("{rule_name}（待生成并审核结转凭证）")),
            Err(error) if error.contains("没有可结转的来源科目发生额") => {}
            Err(error) => blockers.push(format!("{rule_name}（{error}）")),
        }
    }

    if blockers.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "期末结转尚未完成，不能结账：{}",
            blockers.join("；")
        ))
    }
}

// ── CRUD commands ───────────────────────────────────────────

#[tauri::command]
pub async fn preview_settlement_rule(
    rule_id: String,
    company_id: String,
    period_id: String,
    db: State<'_, Database>,
) -> Result<SettlementRulePreview, String> {
    let mut tx = db
        .pool()
        .begin()
        .await
        .map_err(|e| format!("Transaction error: {}", e))?;
    let preview = build_rule_preview(&rule_id, &company_id, &period_id, &mut tx).await?;
    tx.commit()
        .await
        .map_err(|e| format!("Commit error: {}", e))?;
    Ok(preview)
}

#[tauri::command]
pub async fn create_settlement_voucher_draft(
    rule_id: String,
    company_id: String,
    period_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<SettlementVoucherDraft, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut tx = db
        .pool()
        .begin()
        .await
        .map_err(|e| format!("Transaction error: {}", e))?;
    let preview = build_rule_preview(&rule_id, &company_id, &period_id, &mut tx).await?;

    let last_sequence: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT MAX(sequence_num) FROM vouchers WHERE company_id = ? AND period_id = ? AND voucher_word_id = ?",
    )
    .bind(&company_id)
    .bind(&period_id)
    .bind(&preview.voucher_word_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    let sequence_num = last_sequence.and_then(|row| row.0).unwrap_or(0) + 1;
    let voucher_number = format!("{}字第{:03}号", preview.voucher_word_name, sequence_num);
    let voucher_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let reference_number = format!("JZ-{}-{}", preview.period_label, preview.rule_id);

    sqlx::query(
        r#"
        INSERT INTO vouchers (
            id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit,
            version, created_by, created_at, reference_number, is_settlement, settlement_rule_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, 1, ?, ?, ?, 1, ?)
        "#,
    )
    .bind(&voucher_id)
    .bind(&company_id)
    .bind(&period_id)
    .bind(&preview.voucher_word_id)
    .bind(&voucher_number)
    .bind(sequence_num)
    .bind(&preview.voucher_date)
    .bind(&preview.summary)
    .bind(preview.total_debit)
    .bind(preview.total_credit)
    .bind(&actor)
    .bind(&now)
    .bind(&reference_number)
    .bind(&preview.rule_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create settlement voucher: {}", e))?;

    for (index, entry) in preview.entries.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO voucher_entries (
                id, voucher_id, line_num, account_code, account_name, direction, amount, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&voucher_id)
        .bind(index as i32 + 1)
        .bind(&entry.account_code)
        .bind(&entry.account_name)
        .bind(&entry.direction)
        .bind(entry.amount)
        .bind(&entry.summary)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create settlement voucher entry: {}", e))?;
    }

    let log_data = serde_json::json!({
        "rule_id": preview.rule_id,
        "period_id": preview.period_id,
        "reference_number": reference_number,
    })
    .to_string();
    sqlx::query(
        "INSERT INTO voucher_logs (id, voucher_id, operation_type, after_data, operator_id) VALUES (?, ?, 'settlement_create', ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&voucher_id)
    .bind(log_data)
    .bind(&actor)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to write settlement audit log: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("Commit error: {}", e))?;

    Ok(SettlementVoucherDraft {
        id: voucher_id,
        voucher_number,
        rule_id: preview.rule_id,
        total_debit: preview.total_debit,
        total_credit: preview.total_credit,
    })
}

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
    let existing: SettlementRule =
        sqlx::query_as("SELECT * FROM settlement_rules WHERE id = ? AND company_id = ?")
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

#[cfg(test)]
mod close_guard_tests {
    use super::ensure_settlement_rules_completed;
    use crate::db::Database;

    #[tokio::test]
    async fn enabled_rule_with_activity_requires_an_approved_settlement_voucher() {
        let data_dir = std::env::temp_dir().join(format!(
            "settlement-close-guard-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes settlement close-guard database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '结转门禁测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'c1', 2026, 10, '2026-10-01', '2026-10-31')",
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('w1', 'c1', '记', '记')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '3103', '本年利润', 'equity', 'credit', 1, 1)",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('c1', '5001', '主营业务收入', 'income', 'credit', 1, 1)",
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit) VALUES ('v1', 'c1', 'p1', 'w1', '记-1', 1, '2026-10-10', 'approved', 20, 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e1', 'v1', 1, '1001', '库存现金', 'debit', 20)",
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name, direction, amount) VALUES ('e2', 'v1', 2, '5001', '主营业务收入', 'credit', 20)",
            "INSERT INTO settlement_rules (id, company_id, name, rule_type, target_account_code, priority, is_enabled) VALUES ('r1', 'c1', '损益结转', 'profit_loss', '3103', 10, 1)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds settlement close-guard data");
        }

        let error = ensure_settlement_rules_completed(database.pool(), "c1", "p1")
            .await
            .expect_err("unsettled activity must block period close");
        assert!(error.contains("损益结转"));

        sqlx::query(
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status, total_debit, total_credit, is_settlement, settlement_rule_id) VALUES ('v2', 'c1', 'p1', 'w1', '记-2', 2, '2026-10-31', 'approved', 20, 20, 1, 'r1')",
        )
        .execute(database.pool())
        .await
        .expect("seeds approved settlement voucher");

        ensure_settlement_rules_completed(database.pool(), "c1", "p1")
            .await
            .expect("approved settlement voucher completes the enabled rule");

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes settlement close-guard database");
    }
}
