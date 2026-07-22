use crate::db::{AccountTransfer, CreateAccountTransferInput, Database, UpdateAccountTransferInput};
use tauri::State;

#[tauri::command]
pub async fn get_account_transfers(company_id: String, period: String, db: State<'_, Database>) -> Result<Vec<AccountTransfer>, String> {
    sqlx::query_as("SELECT * FROM account_transfers WHERE company_id = ? AND period = ? ORDER BY transfer_date DESC, created_at DESC").bind(company_id).bind(period).fetch_all(db.pool()).await.map_err(|error| format!("查询账户转账失败: {error}"))
}

#[tauri::command]
pub async fn create_account_transfer(input: CreateAccountTransferInput, db: State<'_, Database>) -> Result<AccountTransfer, String> {
    let fee = input.fee.unwrap_or(0.0);
    if input.period.trim().is_empty() || input.transfer_date.trim().is_empty() || input.from_account.trim().is_empty() || input.to_account.trim().is_empty() || input.from_account.trim() == input.to_account.trim() || input.amount <= 0.0 || fee < 0.0 { return Err("转账信息不完整，账户必须不同且金额不能为负数".to_string()); }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO account_transfers (id, company_id, period, transfer_date, from_account, to_account, amount, fee, serial_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(&id).bind(&input.company_id).bind(input.period.trim()).bind(input.transfer_date.trim()).bind(input.from_account.trim()).bind(input.to_account.trim()).bind(input.amount).bind(fee).bind(input.serial_no.as_deref()).execute(db.pool()).await.map_err(|error| format!("新增账户转账失败: {error}"))?;
    sqlx::query_as("SELECT * FROM account_transfers WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询新增账户转账失败: {error}"))
}

#[tauri::command]
pub async fn update_account_transfer(input: UpdateAccountTransferInput, db: State<'_, Database>) -> Result<AccountTransfer, String> {
    let fee = input.fee.unwrap_or(0.0);
    if input.id.trim().is_empty() || input.transfer_date.trim().is_empty() || input.from_account.trim().is_empty() || input.to_account.trim().is_empty() || input.from_account.trim() == input.to_account.trim() || input.amount <= 0.0 || fee < 0.0 {
        return Err("转账信息不完整，账户必须不同且金额不能为负数".to_string());
    }
    let affected = sqlx::query("UPDATE account_transfers SET transfer_date = ?, from_account = ?, to_account = ?, amount = ?, fee = ?, serial_no = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status != '已生成凭证'")
        .bind(input.transfer_date.trim()).bind(input.from_account.trim()).bind(input.to_account.trim()).bind(input.amount).bind(fee).bind(input.serial_no.as_deref()).bind(&input.id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新账户转账失败: {error}"))?;
    if affected.rows_affected() == 0 { return Err("未找到可编辑的账户转账，已生成凭证的记录不可修改".to_string()); }
    sqlx::query_as("SELECT * FROM account_transfers WHERE id = ? AND company_id = ?").bind(&input.id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询更新账户转账失败: {error}"))
}
