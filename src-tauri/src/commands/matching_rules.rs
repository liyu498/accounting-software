use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MatchingRule {
    pub id: String,
    pub company_id: String,
    pub rule_scope: String,
    pub name: String,
    pub condition_text: String,
    pub action_text: String,
    pub target_account_code: Option<String>,
    pub voucher_template_id: Option<String>,
    pub priority: i32,
    pub is_enabled: i32,
    pub hit_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MatchingRuleInput {
    pub company_id: String,
    pub rule_scope: String,
    pub name: String,
    pub condition_text: String,
    pub action_text: String,
    pub target_account_code: Option<String>,
    pub voucher_template_id: Option<String>,
    pub priority: Option<i32>,
    pub is_enabled: Option<i32>,
}

fn validate(input: &MatchingRuleInput) -> Result<(), String> {
    if !["invoice", "bill", "cash_flow"].contains(&input.rule_scope.as_str()) {
        return Err("规则类型无效".to_string());
    }
    if input.name.trim().is_empty() || input.condition_text.trim().is_empty() || input.action_text.trim().is_empty() {
        return Err("规则名称、匹配条件和处理动作不能为空".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_matching_rules(company_id: String, rule_scope: String, db: State<'_, Database>) -> Result<Vec<MatchingRule>, String> {
    sqlx::query_as("SELECT * FROM matching_rules WHERE company_id = ? AND rule_scope = ? ORDER BY priority DESC, name")
        .bind(company_id)
        .bind(rule_scope)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn create_matching_rule(input: MatchingRuleInput, db: State<'_, Database>) -> Result<MatchingRule, String> {
    validate(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, target_account_code, voucher_template_id, priority, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(&input.rule_scope).bind(input.name.trim()).bind(input.condition_text.trim()).bind(input.action_text.trim()).bind(&input.target_account_code).bind(&input.voucher_template_id).bind(input.priority.unwrap_or(0)).bind(input.is_enabled.unwrap_or(1))
        .execute(db.pool()).await.map_err(|error| format!("新增匹配规则失败: {}", error))?;
    sqlx::query_as("SELECT * FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn update_matching_rule(id: String, input: MatchingRuleInput, db: State<'_, Database>) -> Result<MatchingRule, String> {
    validate(&input)?;
    let result = sqlx::query("UPDATE matching_rules SET name = ?, condition_text = ?, action_text = ?, target_account_code = ?, voucher_template_id = ?, priority = ?, is_enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND rule_scope = ?")
        .bind(input.name.trim()).bind(input.condition_text.trim()).bind(input.action_text.trim()).bind(&input.target_account_code).bind(&input.voucher_template_id).bind(input.priority.unwrap_or(0)).bind(input.is_enabled.unwrap_or(1)).bind(&id).bind(&input.company_id).bind(&input.rule_scope)
        .execute(db.pool()).await.map_err(|error| format!("更新匹配规则失败: {}", error))?;
    if result.rows_affected() == 0 { return Err("匹配规则不存在或不属于当前账套".to_string()); }
    sqlx::query_as("SELECT * FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn delete_matching_rule(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id).bind(company_id).execute(db.pool()).await.map_err(|error| format!("删除匹配规则失败: {}", error))?;
    if result.rows_affected() == 0 { return Err("匹配规则不存在或不属于当前账套".to_string()); }
    Ok(())
}
