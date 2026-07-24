use crate::db::{BankReconciliationRecord, CreateBankReconciliationRecordInput, Database, UpdateBankReconciliationRecordInput};
use tauri::State;

fn optional_text(value: Option<&String>) -> Option<&str> { value.map(String::as_str).map(str::trim).filter(|item| !item.is_empty()) }
fn validate(no: &str, date: &str, account: &str, transaction_no: &str, bank_amount: f64, book_amount: f64) -> Result<f64, String> {
    if no.trim().is_empty() || date.trim().is_empty() || account.trim().is_empty() || transaction_no.trim().is_empty() || bank_amount < 0.0 || book_amount < 0.0 { return Err("对账编号、日期、账户、流水号不能为空，金额不得小于零".to_string()); }
    Ok(bank_amount - book_amount)
}
#[tauri::command]
pub async fn get_bank_reconciliation_records(company_id: String, period: String, db: State<'_, Database>) -> Result<Vec<BankReconciliationRecord>, String> { sqlx::query_as("SELECT * FROM bank_reconciliation_records WHERE company_id = ? AND period = ? ORDER BY reconciliation_date DESC, created_at DESC").bind(company_id).bind(period).fetch_all(db.pool()).await.map_err(|error| format!("查询银行对账记录失败: {error}")) }
#[tauri::command]
pub async fn create_bank_reconciliation_record(input: CreateBankReconciliationRecordInput, db: State<'_, Database>) -> Result<BankReconciliationRecord, String> {
    if input.company_id.trim().is_empty() || input.period.trim().is_empty() { return Err("账套和账期不能为空".to_string()); }
    let difference_amount = validate(&input.reconciliation_no, &input.reconciliation_date, &input.account_name, &input.transaction_no, input.bank_amount, input.book_amount)?;
    let id=uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO bank_reconciliation_records (id, company_id, period, reconciliation_no, reconciliation_date, bank_transaction_id, account_name, transaction_no, summary, bank_amount, book_amount, difference_amount, voucher_no, match_status, owner, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(&id).bind(input.company_id.trim()).bind(input.period.trim()).bind(input.reconciliation_no.trim()).bind(input.reconciliation_date.trim()).bind(optional_text(input.bank_transaction_id.as_ref())).bind(input.account_name.trim()).bind(input.transaction_no.trim()).bind(optional_text(input.summary.as_ref())).bind(input.bank_amount).bind(input.book_amount).bind(difference_amount).bind(optional_text(input.voucher_no.as_ref())).bind(optional_text(input.match_status.as_ref()).unwrap_or("待人工对账")).bind(optional_text(input.owner.as_ref())).bind(optional_text(input.status.as_ref()).unwrap_or("待处理")).bind(optional_text(input.note.as_ref())).execute(db.pool()).await.map_err(|error| format!("新增银行对账记录失败: {error}"))?;
    sqlx::query_as("SELECT * FROM bank_reconciliation_records WHERE id = ?").bind(id).fetch_one(db.pool()).await.map_err(|error| format!("查询新增银行对账记录失败: {error}"))
}
#[tauri::command]
pub async fn update_bank_reconciliation_record(input: UpdateBankReconciliationRecordInput, db: State<'_, Database>) -> Result<BankReconciliationRecord, String> {
    if input.id.trim().is_empty() { return Err("对账标识不能为空".to_string()); }
    let difference_amount=validate(&input.reconciliation_no,&input.reconciliation_date,&input.account_name,&input.transaction_no,input.bank_amount,input.book_amount)?;
    let affected=sqlx::query("UPDATE bank_reconciliation_records SET reconciliation_no=?, reconciliation_date=?, bank_transaction_id=?, account_name=?, transaction_no=?, summary=?, bank_amount=?, book_amount=?, difference_amount=?, voucher_no=?, match_status=?, owner=?, status=?, note=?, updated_at=datetime('now') WHERE id=? AND company_id=?").bind(input.reconciliation_no.trim()).bind(input.reconciliation_date.trim()).bind(optional_text(input.bank_transaction_id.as_ref())).bind(input.account_name.trim()).bind(input.transaction_no.trim()).bind(optional_text(input.summary.as_ref())).bind(input.bank_amount).bind(input.book_amount).bind(difference_amount).bind(optional_text(input.voucher_no.as_ref())).bind(optional_text(input.match_status.as_ref()).unwrap_or("待人工对账")).bind(optional_text(input.owner.as_ref())).bind(optional_text(input.status.as_ref()).unwrap_or("待处理")).bind(optional_text(input.note.as_ref())).bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|error|format!("更新银行对账记录失败: {error}"))?;
    if affected.rows_affected()==0 { return Err("未找到当前账套的银行对账记录".to_string()); }
    sqlx::query_as("SELECT * FROM bank_reconciliation_records WHERE id=? AND company_id=?").bind(input.id).bind(input.company_id).fetch_one(db.pool()).await.map_err(|error|format!("查询更新银行对账记录失败: {error}"))
}
