use crate::db::{CreateFixedAssetInput, Database, FixedAsset};
use tauri::State;

#[tauri::command]
pub async fn get_fixed_assets(company_id: String, period: String, db: State<'_, Database>) -> Result<Vec<FixedAsset>, String> {
    sqlx::query_as("SELECT * FROM fixed_assets WHERE company_id = ? AND period = ? ORDER BY start_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询固定资产失败: {error}"))
}

#[tauri::command]
pub async fn create_fixed_asset(input: CreateFixedAssetInput, db: State<'_, Database>) -> Result<FixedAsset, String> {
    let residual_rate = input.residual_rate.unwrap_or(0.0);
    if input.period.trim().is_empty() || input.asset_code.trim().is_empty() || input.asset_name.trim().is_empty() || input.category.trim().is_empty() || input.start_date.trim().is_empty() || input.original_value <= 0.0 || input.useful_life_months <= 0 || !(0.0..=1.0).contains(&residual_rate) {
        return Err("资产信息不完整，原值和折旧期限必须大于零，残值率应在 0% 至 100% 之间".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO fixed_assets (id, company_id, period, asset_code, asset_name, category, start_date, original_value, useful_life_months, residual_rate, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&input.company_id)
        .bind(input.period.trim())
        .bind(input.asset_code.trim())
        .bind(input.asset_name.trim())
        .bind(input.category.trim())
        .bind(input.start_date.trim())
        .bind(input.original_value)
        .bind(input.useful_life_months)
        .bind(residual_rate)
        .bind(input.source_document.as_deref().map(str::trim).filter(|value| !value.is_empty()))
        .execute(db.pool())
        .await
        .map_err(|error| format!("新增固定资产失败: {error}"))?;
    sqlx::query_as("SELECT * FROM fixed_assets WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增固定资产失败: {error}"))
}
