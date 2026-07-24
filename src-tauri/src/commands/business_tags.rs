use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BusinessTag {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub applicable_modules: String,
    pub color_name: String,
    pub auto_rule: Option<String>,
    pub usage_count: i32,
    pub remarks: Option<String>,
    pub is_enabled: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BusinessTagInput {
    pub company_id: String,
    pub name: String,
    pub applicable_modules: String,
    pub color_name: String,
    pub auto_rule: Option<String>,
    pub remarks: Option<String>,
    pub is_enabled: Option<i32>,
}

fn validate(input: &BusinessTagInput) -> Result<(), String> {
    if input.name.trim().is_empty() || input.applicable_modules.trim().is_empty() || input.color_name.trim().is_empty() {
        return Err("标签名称、适用模块和颜色标识不能为空".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_business_tags(company_id: String, db: State<'_, Database>) -> Result<Vec<BusinessTag>, String> {
    sqlx::query_as("SELECT * FROM business_tags WHERE company_id = ? ORDER BY is_enabled DESC, name")
        .bind(company_id).fetch_all(db.pool()).await.map_err(|error| format!("查询业务标签失败: {error}"))
}

#[tauri::command]
pub async fn create_business_tag(input: BusinessTagInput, db: State<'_, Database>) -> Result<BusinessTag, String> {
    validate(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO business_tags (id, company_id, name, applicable_modules, color_name, auto_rule, remarks, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(input.name.trim()).bind(input.applicable_modules.trim()).bind(input.color_name.trim()).bind(input.auto_rule.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.remarks.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1))
        .execute(db.pool()).await.map_err(|error| format!("新增业务标签失败: {error}"))?;
    sqlx::query_as("SELECT * FROM business_tags WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取业务标签失败: {error}"))
}

#[tauri::command]
pub async fn update_business_tag(id: String, input: BusinessTagInput, db: State<'_, Database>) -> Result<BusinessTag, String> {
    validate(&input)?;
    let result = sqlx::query("UPDATE business_tags SET name = ?, applicable_modules = ?, color_name = ?, auto_rule = ?, remarks = ?, is_enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.name.trim()).bind(input.applicable_modules.trim()).bind(input.color_name.trim()).bind(input.auto_rule.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.remarks.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1)).bind(&id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新业务标签失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("业务标签不存在或不属于当前账套".to_string()); }
    sqlx::query_as("SELECT * FROM business_tags WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取业务标签失败: {error}"))
}

#[tauri::command]
pub async fn delete_business_tag(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM business_tags WHERE id = ? AND company_id = ?").bind(id).bind(company_id).execute(db.pool()).await.map_err(|error| format!("删除业务标签失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("业务标签不存在或不属于当前账套".to_string()); }
    Ok(())
}
