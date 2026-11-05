use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{
    CreateSettlementRecordInput, Database, SettlementRecord, UpdateSettlementRecordInput,
};
use tauri::State;

fn optional_text(value: Option<&String>) -> Option<&str> {
    value
        .map(String::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
}

fn validate_settlement(
    settlement_type: &str,
    settlement_no: &str,
    settlement_date: &str,
    counterparty: &str,
    total_amount: f64,
    settled_amount: f64,
) -> Result<f64, String> {
    if !matches!(settlement_type, "receivable" | "payable") {
        return Err("核销类型必须为应收或应付".to_string());
    }
    if settlement_no.trim().is_empty()
        || settlement_date.trim().is_empty()
        || counterparty.trim().is_empty()
        || total_amount <= 0.0
        || settled_amount < 0.0
        || settled_amount > total_amount
    {
        return Err(
            "核销编号、日期、往来单位不能为空，且核销金额必须介于零和应收应付金额之间".to_string(),
        );
    }
    Ok(total_amount - settled_amount)
}

#[tauri::command]
pub async fn get_settlement_records(
    company_id: String,
    period: String,
    settlement_type: String,
    db: State<'_, Database>,
) -> Result<Vec<SettlementRecord>, String> {
    if !matches!(settlement_type.as_str(), "receivable" | "payable") {
        return Err("核销类型必须为应收或应付".to_string());
    }
    sqlx::query_as("SELECT * FROM settlement_records WHERE company_id = ? AND period = ? AND settlement_type = ? ORDER BY settlement_date DESC, created_at DESC")
        .bind(company_id).bind(period).bind(settlement_type).fetch_all(db.pool()).await
        .map_err(|error| format!("查询核销台账失败: {error}"))
}

#[tauri::command]
pub async fn create_settlement_record(
    input: CreateSettlementRecordInput,
    db: State<'_, Database>,
) -> Result<SettlementRecord, String> {
    if input.company_id.trim().is_empty() || input.period.trim().is_empty() {
        return Err("账套和账期不能为空".to_string());
    }
    let balance_amount = validate_settlement(
        &input.settlement_type,
        &input.settlement_no,
        &input.settlement_date,
        &input.counterparty,
        input.total_amount,
        input.settled_amount,
    )?;
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增核销记录").await?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO settlement_records (id, company_id, period, settlement_type, settlement_no, settlement_date, counterparty, invoice_no, transaction_no, total_amount, settled_amount, balance_amount, settlement_method, owner, status, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(input.company_id.trim()).bind(input.period.trim()).bind(input.settlement_type.trim()).bind(input.settlement_no.trim()).bind(input.settlement_date.trim()).bind(input.counterparty.trim())
        .bind(optional_text(input.invoice_no.as_ref())).bind(optional_text(input.transaction_no.as_ref())).bind(input.total_amount).bind(input.settled_amount).bind(balance_amount)
        .bind(optional_text(input.settlement_method.as_ref()).unwrap_or("待人工核销")).bind(optional_text(input.owner.as_ref())).bind(optional_text(input.status.as_ref()).unwrap_or("待确认")).bind(optional_text(input.source_document.as_ref()))
        .execute(db.pool()).await.map_err(|error| format!("新增核销台账失败: {error}"))?;
    sqlx::query_as("SELECT * FROM settlement_records WHERE id = ?")
        .bind(id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增核销台账失败: {error}"))
}

#[tauri::command]
pub async fn update_settlement_record(
    input: UpdateSettlementRecordInput,
    db: State<'_, Database>,
) -> Result<SettlementRecord, String> {
    if input.id.trim().is_empty() {
        return Err("核销标识不能为空".to_string());
    }
    let settlement: Option<(String, String)> = sqlx::query_as(
        "SELECT settlement_type, period FROM settlement_records WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询核销台账失败: {error}"))?;
    let (settlement_type, period) =
        settlement.ok_or_else(|| "未找到当前账套的核销记录".to_string())?;
    ensure_period_label_open(db.pool(), &input.company_id, &period, "修改核销记录").await?;
    let balance_amount = validate_settlement(
        &settlement_type,
        &input.settlement_no,
        &input.settlement_date,
        &input.counterparty,
        input.total_amount,
        input.settled_amount,
    )?;
    sqlx::query("UPDATE settlement_records SET settlement_no = ?, settlement_date = ?, counterparty = ?, invoice_no = ?, transaction_no = ?, total_amount = ?, settled_amount = ?, balance_amount = ?, settlement_method = ?, owner = ?, status = ?, source_document = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.settlement_no.trim()).bind(input.settlement_date.trim()).bind(input.counterparty.trim()).bind(optional_text(input.invoice_no.as_ref())).bind(optional_text(input.transaction_no.as_ref()))
        .bind(input.total_amount).bind(input.settled_amount).bind(balance_amount).bind(optional_text(input.settlement_method.as_ref()).unwrap_or("待人工核销")).bind(optional_text(input.owner.as_ref())).bind(optional_text(input.status.as_ref()).unwrap_or("待确认")).bind(optional_text(input.source_document.as_ref()))
        .bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|error| format!("更新核销台账失败: {error}"))?;
    sqlx::query_as("SELECT * FROM settlement_records WHERE id = ? AND company_id = ?")
        .bind(input.id)
        .bind(input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询更新核销台账失败: {error}"))
}
