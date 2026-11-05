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
    pub source_account_code: Option<String>,
    pub cash_direction: Option<String>,
    pub cash_flow_item_code: Option<String>,
    pub summary_keyword: Option<String>,
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
    pub source_account_code: Option<String>,
    pub cash_direction: Option<String>,
    pub cash_flow_item_code: Option<String>,
    pub summary_keyword: Option<String>,
    pub priority: Option<i32>,
    pub is_enabled: Option<i32>,
}

fn validate(input: &MatchingRuleInput) -> Result<(), String> {
    if ![
        "invoice",
        "bill",
        "cash_flow",
        "equity_change",
        "ai_training",
    ]
    .contains(&input.rule_scope.as_str())
    {
        return Err("规则类型无效".to_string());
    }
    if input.name.trim().is_empty()
        || input.condition_text.trim().is_empty()
        || input.action_text.trim().is_empty()
    {
        return Err("规则名称、匹配条件和处理动作不能为空".to_string());
    }
    if input.rule_scope == "cash_flow" {
        if input
            .source_account_code
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
            || input
                .cash_flow_item_code
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty()
        {
            return Err("现金流量映射必须选择来源科目和现金流量项目".to_string());
        }
        if !matches!(input.cash_direction.as_deref(), Some("inflow" | "outflow")) {
            return Err("现金方向必须为流入或流出".to_string());
        }
    }
    if input.rule_scope == "equity_change" {
        if input
            .source_account_code
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
            || input
                .cash_flow_item_code
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty()
        {
            return Err("权益变动映射必须选择来源科目和法定原因项目".to_string());
        }
        if !matches!(
            input.cash_direction.as_deref(),
            Some("increase" | "decrease")
        ) {
            return Err("权益变动方向必须为增加或减少".to_string());
        }
    }
    Ok(())
}

async fn validate_report_mapping_references(
    input: &MatchingRuleInput,
    db: &Database,
) -> Result<(), String> {
    if !matches!(input.rule_scope.as_str(), "cash_flow" | "equity_change") {
        return Ok(());
    }
    let source_account_code = input
        .source_account_code
        .as_deref()
        .unwrap_or_default()
        .trim();
    let cash_flow_item_code = input
        .cash_flow_item_code
        .as_deref()
        .unwrap_or_default()
        .trim();
    let account_exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM account_codes WHERE company_id = ? AND code = ? AND is_enabled = 1",
    )
    .bind(&input.company_id)
    .bind(source_account_code)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("校验来源科目失败: {error}"))?;
    if account_exists == 0 {
        return Err("来源科目不存在、已停用或不属于当前账套".to_string());
    }
    let (report_type, item_predicate) = if input.rule_scope == "cash_flow" {
        (
            "cash_flow",
            "(item.item_level > 1 OR item.formula IS NOT NULL OR item.item_name LIKE '%汇率变动%')",
        )
    } else {
        ("equity_change", "item.item_level >= 2")
    };
    let item_exists_sql = format!(
        r#"SELECT COUNT(*)
           FROM report_items item
           JOIN report_templates template ON template.id = item.template_id
           JOIN companies company ON company.id = ?
           WHERE item.item_code = ?
             AND item.is_total = 0
             AND {item_predicate}
             AND template.report_type = ?
             AND (
               template.company_id = company.id
               OR (template.company_id IS NULL AND template.accounting_system = company.accounting_system)
             )"#,
    );
    let item_exists: i64 = sqlx::query_scalar(&item_exists_sql)
        .bind(&input.company_id)
        .bind(cash_flow_item_code)
        .bind(report_type)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("校验报表映射项目失败: {error}"))?;
    if item_exists == 0 {
        return Err(if input.rule_scope == "cash_flow" {
            "现金流量项目不存在、不是明细项目或与当前会计准则不匹配".to_string()
        } else {
            "权益变动原因项目不存在、不是明细项目或与当前会计准则不匹配".to_string()
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn get_matching_rules(
    company_id: String,
    rule_scope: String,
    db: State<'_, Database>,
) -> Result<Vec<MatchingRule>, String> {
    sqlx::query_as("SELECT * FROM matching_rules WHERE company_id = ? AND rule_scope = ? ORDER BY priority DESC, name")
        .bind(company_id)
        .bind(rule_scope)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn create_matching_rule(
    input: MatchingRuleInput,
    db: State<'_, Database>,
) -> Result<MatchingRule, String> {
    validate(&input)?;
    validate_report_mapping_references(&input, &db).await?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO matching_rules (id, company_id, rule_scope, name, condition_text, action_text, target_account_code, voucher_template_id, source_account_code, cash_direction, cash_flow_item_code, summary_keyword, priority, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(&input.rule_scope).bind(input.name.trim()).bind(input.condition_text.trim()).bind(input.action_text.trim()).bind(&input.target_account_code).bind(&input.voucher_template_id).bind(input.source_account_code.as_deref().map(str::trim)).bind(input.cash_direction.as_deref().map(str::trim)).bind(input.cash_flow_item_code.as_deref().map(str::trim)).bind(input.summary_keyword.as_deref().map(str::trim)).bind(input.priority.unwrap_or(0)).bind(input.is_enabled.unwrap_or(1))
        .execute(db.pool()).await.map_err(|error| format!("新增匹配规则失败: {}", error))?;
    sqlx::query_as("SELECT * FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("读取匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn update_matching_rule(
    id: String,
    input: MatchingRuleInput,
    db: State<'_, Database>,
) -> Result<MatchingRule, String> {
    validate(&input)?;
    validate_report_mapping_references(&input, &db).await?;
    let result = sqlx::query("UPDATE matching_rules SET name = ?, condition_text = ?, action_text = ?, target_account_code = ?, voucher_template_id = ?, source_account_code = ?, cash_direction = ?, cash_flow_item_code = ?, summary_keyword = ?, priority = ?, is_enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND rule_scope = ?")
        .bind(input.name.trim()).bind(input.condition_text.trim()).bind(input.action_text.trim()).bind(&input.target_account_code).bind(&input.voucher_template_id).bind(input.source_account_code.as_deref().map(str::trim)).bind(input.cash_direction.as_deref().map(str::trim)).bind(input.cash_flow_item_code.as_deref().map(str::trim)).bind(input.summary_keyword.as_deref().map(str::trim)).bind(input.priority.unwrap_or(0)).bind(input.is_enabled.unwrap_or(1)).bind(&id).bind(&input.company_id).bind(&input.rule_scope)
        .execute(db.pool()).await.map_err(|error| format!("更新匹配规则失败: {}", error))?;
    if result.rows_affected() == 0 {
        return Err("匹配规则不存在或不属于当前账套".to_string());
    }
    sqlx::query_as("SELECT * FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("读取匹配规则失败: {}", error))
}

#[tauri::command]
pub async fn delete_matching_rule(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM matching_rules WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .execute(db.pool())
        .await
        .map_err(|error| format!("删除匹配规则失败: {}", error))?;
    if result.rows_affected() == 0 {
        return Err("匹配规则不存在或不属于当前账套".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate, MatchingRuleInput};

    fn equity_rule(direction: &str, item_code: &str) -> MatchingRuleInput {
        MatchingRuleInput {
            company_id: "company-1".to_string(),
            rule_scope: "equity_change".to_string(),
            name: "普通股投入".to_string(),
            condition_text: "实收资本增加".to_string(),
            action_text: "归入所有者投入普通股".to_string(),
            target_account_code: None,
            voucher_template_id: None,
            source_account_code: Some("4001".to_string()),
            cash_direction: Some(direction.to_string()),
            cash_flow_item_code: Some(item_code.to_string()),
            summary_keyword: None,
            priority: Some(100),
            is_enabled: Some(1),
        }
    }

    #[test]
    fn equity_change_rules_require_account_direction_and_statutory_item() {
        assert!(validate(&equity_rule("increase", "EQ321")).is_ok());
        assert!(validate(&equity_rule("outflow", "EQ321")).is_err());
        assert!(validate(&equity_rule("decrease", "")).is_err());
    }
}
