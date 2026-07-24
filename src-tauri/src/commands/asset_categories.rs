use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AssetCategory {
    pub id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub useful_life_months: i32,
    pub residual_rate: f64,
    pub depreciation_method: String,
    pub asset_account: String,
    pub accumulated_depreciation_account: String,
    pub expense_account: Option<String>,
    pub is_enabled: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetCategoryInput {
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub useful_life_months: i32,
    pub residual_rate: f64,
    pub depreciation_method: String,
    pub asset_account: String,
    pub accumulated_depreciation_account: String,
    pub expense_account: Option<String>,
    pub is_enabled: Option<i32>,
}

fn validate(input: &AssetCategoryInput) -> Result<(), String> {
    if input.code.trim().is_empty() || input.name.trim().is_empty()
        || input.useful_life_months <= 0 || !(0.0..=1.0).contains(&input.residual_rate)
        || input.asset_account.trim().is_empty() || input.accumulated_depreciation_account.trim().is_empty()
    {
        return Err("资产类别编码、名称、折旧年限、残值率和默认科目必须有效".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_asset_categories(company_id: String, db: State<'_, Database>) -> Result<Vec<AssetCategory>, String> {
    sqlx::query_as("SELECT * FROM asset_categories WHERE company_id = ? ORDER BY code, name")
        .bind(company_id).fetch_all(db.pool()).await.map_err(|error| format!("查询资产类别失败: {error}"))
}

#[tauri::command]
pub async fn create_asset_category(input: AssetCategoryInput, db: State<'_, Database>) -> Result<AssetCategory, String> {
    validate(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO asset_categories (id, company_id, code, name, useful_life_months, residual_rate, depreciation_method, asset_account, accumulated_depreciation_account, expense_account, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(input.code.trim()).bind(input.name.trim()).bind(input.useful_life_months).bind(input.residual_rate).bind(input.depreciation_method.trim()).bind(input.asset_account.trim()).bind(input.accumulated_depreciation_account.trim()).bind(input.expense_account.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1))
        .execute(db.pool()).await.map_err(|error| format!("新增资产类别失败: {error}"))?;
    sqlx::query_as("SELECT * FROM asset_categories WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取资产类别失败: {error}"))
}

#[tauri::command]
pub async fn update_asset_category(id: String, input: AssetCategoryInput, db: State<'_, Database>) -> Result<AssetCategory, String> {
    validate(&input)?;
    let result = sqlx::query("UPDATE asset_categories SET code = ?, name = ?, useful_life_months = ?, residual_rate = ?, depreciation_method = ?, asset_account = ?, accumulated_depreciation_account = ?, expense_account = ?, is_enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.code.trim()).bind(input.name.trim()).bind(input.useful_life_months).bind(input.residual_rate).bind(input.depreciation_method.trim()).bind(input.asset_account.trim()).bind(input.accumulated_depreciation_account.trim()).bind(input.expense_account.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1)).bind(&id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新资产类别失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("资产类别不存在或不属于当前账套".to_string()); }
    sqlx::query_as("SELECT * FROM asset_categories WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取资产类别失败: {error}"))
}

#[tauri::command]
pub async fn delete_asset_category(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM asset_categories WHERE id = ? AND company_id = ?").bind(id).bind(company_id).execute(db.pool()).await.map_err(|error| format!("删除资产类别失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("资产类别不存在或不属于当前账套".to_string()); }
    Ok(())
}

#[tauri::command]
pub async fn toggle_asset_category(id: String, company_id: String, db: State<'_, Database>) -> Result<AssetCategory, String> {
    let result = sqlx::query("UPDATE asset_categories SET is_enabled = CASE is_enabled WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND company_id = ?").bind(&id).bind(&company_id).execute(db.pool()).await.map_err(|error| format!("切换资产类别状态失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("资产类别不存在或不属于当前账套".to_string()); }
    sqlx::query_as("SELECT * FROM asset_categories WHERE id = ? AND company_id = ?").bind(id).bind(company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取资产类别失败: {error}"))
}
