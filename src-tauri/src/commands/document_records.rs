use crate::db::{CreateDocumentRecordInput, Database, DocumentRecord, UpdateDocumentRecordInput};
use tauri::State;

#[tauri::command]
pub async fn get_document_records(company_id: String, period: String, db: State<'_, Database>) -> Result<Vec<DocumentRecord>, String> {
    sqlx::query_as("SELECT * FROM document_records WHERE company_id = ? AND period = ? ORDER BY business_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询登记单据失败: {error}"))
}

#[tauri::command]
pub async fn create_document_record(input: CreateDocumentRecordInput, db: State<'_, Database>) -> Result<DocumentRecord, String> {
    if input.period.trim().is_empty() || input.business_date.trim().is_empty() || input.document_code.trim().is_empty() || input.business_type.trim().is_empty() || input.amount <= 0.0 {
        return Err("单据日期、编号、业务类型不能为空且金额必须大于零".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO document_records (id, company_id, period, business_date, document_code, business_type, partner, amount, owner, attachment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id).bind(&input.company_id).bind(input.period.trim()).bind(input.business_date.trim()).bind(input.document_code.trim()).bind(input.business_type.trim())
    .bind(input.partner.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.amount).bind(input.owner.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(input.attachment_status.as_deref().unwrap_or("待补附件"))
    .execute(db.pool()).await.map_err(|error| format!("新增登记单据失败: {error}"))?;
    sqlx::query_as("SELECT * FROM document_records WHERE id = ? AND company_id = ?")
        .bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询新增登记单据失败: {error}"))
}

#[tauri::command]
pub async fn update_document_record(input: UpdateDocumentRecordInput, db: State<'_, Database>) -> Result<DocumentRecord, String> {
    if input.id.trim().is_empty() || input.business_date.trim().is_empty() || input.document_code.trim().is_empty() || input.business_type.trim().is_empty() || input.amount <= 0.0 {
        return Err("单据日期、编号、业务类型不能为空且金额必须大于零".to_string());
    }
    let affected = sqlx::query("UPDATE document_records SET business_date = ?, document_code = ?, business_type = ?, partner = ?, amount = ?, owner = ?, attachment_status = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status != '已生成凭证'")
        .bind(input.business_date.trim()).bind(input.document_code.trim()).bind(input.business_type.trim()).bind(input.partner.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.amount).bind(input.owner.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.attachment_status.as_deref().unwrap_or("待补附件")).bind(&input.id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新登记单据失败: {error}"))?;
    if affected.rows_affected() == 0 { return Err("未找到可编辑的登记单据，已生成凭证的单据不可修改".to_string()); }
    sqlx::query_as("SELECT * FROM document_records WHERE id = ? AND company_id = ?").bind(&input.id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询更新登记单据失败: {error}"))
}
