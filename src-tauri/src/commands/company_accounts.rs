use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CompanyAccount {
    pub id: String,
    pub company_id: String,
    pub account_name: String,
    pub account_type: String,
    pub bank_name: Option<String>,
    pub account_number: String,
    pub subject_code: String,
    pub opening_balance: f64,
    pub attachment_note: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CompanyAccountInput {
    pub company_id: String,
    pub account_name: String,
    pub account_type: String,
    pub bank_name: Option<String>,
    pub account_number: String,
    pub subject_code: String,
    pub opening_balance: f64,
    pub attachment_note: Option<String>,
    pub status: String,
}

fn validate(input: &CompanyAccountInput) -> Result<(), String> {
    if input.account_name.trim().is_empty() || input.account_type.trim().is_empty()
        || input.account_number.trim().is_empty() || input.subject_code.trim().is_empty()
        || !input.opening_balance.is_finite() || !["启用", "停用"].contains(&input.status.as_str())
    {
        return Err("账户名称、类型、账号、默认科目和状态必须有效".to_string());
    }
    Ok(())
}

async fn migrate_legacy_account(company_id: &str, db: &Database) -> Result<(), String> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM company_accounts WHERE company_id = ?")
        .bind(company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取账户档案失败: {error}"))?;
    if count.0 > 0 { return Ok(()); }
    let legacy: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT name, bank_name, bank_account FROM companies WHERE id = ?",
    ).bind(company_id).fetch_optional(db.pool()).await.map_err(|error| format!("读取企业银行资料失败: {error}"))?;
    if let Some((company_name, bank_name, Some(account_number))) = legacy {
        if !account_number.trim().is_empty() {
            let id = uuid::Uuid::new_v4().to_string();
            sqlx::query("INSERT OR IGNORE INTO company_accounts (id, company_id, account_name, account_type, bank_name, account_number, subject_code, attachment_note) VALUES (?, ?, ?, '银行账户', ?, ?, '1002 银行存款', '从企业基础资料迁移')")
                .bind(id).bind(company_id).bind(format!("{company_name}基本账户")).bind(bank_name).bind(account_number)
                .execute(db.pool()).await.map_err(|error| format!("迁移企业银行资料失败: {error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_company_accounts(company_id: String, db: State<'_, Database>) -> Result<Vec<CompanyAccount>, String> {
    migrate_legacy_account(&company_id, &db).await?;
    sqlx::query_as("SELECT * FROM company_accounts WHERE company_id = ? ORDER BY status, account_name")
        .bind(company_id).fetch_all(db.pool()).await.map_err(|error| format!("查询账户档案失败: {error}"))
}

#[tauri::command]
pub async fn create_company_account(input: CompanyAccountInput, db: State<'_, Database>) -> Result<CompanyAccount, String> {
    validate(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO company_accounts (id, company_id, account_name, account_type, bank_name, account_number, subject_code, opening_balance, attachment_note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(input.account_name.trim()).bind(input.account_type.trim()).bind(input.bank_name.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.account_number.trim()).bind(input.subject_code.trim()).bind(input.opening_balance).bind(input.attachment_note.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.status.trim())
        .execute(db.pool()).await.map_err(|error| format!("新增账户档案失败: {error}"))?;
    sqlx::query_as("SELECT * FROM company_accounts WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取账户档案失败: {error}"))
}

#[tauri::command]
pub async fn update_company_account(id: String, input: CompanyAccountInput, db: State<'_, Database>) -> Result<CompanyAccount, String> {
    validate(&input)?;
    let result = sqlx::query("UPDATE company_accounts SET account_name = ?, account_type = ?, bank_name = ?, account_number = ?, subject_code = ?, opening_balance = ?, attachment_note = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.account_name.trim()).bind(input.account_type.trim()).bind(input.bank_name.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.account_number.trim()).bind(input.subject_code.trim()).bind(input.opening_balance).bind(input.attachment_note.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.status.trim()).bind(&id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新账户档案失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("账户档案不存在或不属于当前账套".to_string()); }
    sqlx::query_as("SELECT * FROM company_accounts WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("读取账户档案失败: {error}"))
}

#[tauri::command]
pub async fn delete_company_account(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM company_accounts WHERE id = ? AND company_id = ?").bind(id).bind(company_id).execute(db.pool()).await.map_err(|error| format!("删除账户档案失败: {error}"))?;
    if result.rows_affected() == 0 { return Err("账户档案不存在或不属于当前账套".to_string()); }
    Ok(())
}
