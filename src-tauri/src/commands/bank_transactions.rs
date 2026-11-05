use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{
    BankTransaction, CreateBankTransactionInput, Database, UpdateBankTransactionInput,
};
use tauri::State;

#[tauri::command]
pub async fn get_bank_transactions(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<BankTransaction>, String> {
    sqlx::query_as(
        "SELECT * FROM bank_transactions WHERE company_id = ? AND period = ? ORDER BY transaction_date DESC, created_at DESC",
    )
    .bind(company_id)
    .bind(period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询银行流水失败: {error}"))
}

#[tauri::command]
pub async fn create_bank_transaction(
    input: CreateBankTransactionInput,
    db: State<'_, Database>,
) -> Result<BankTransaction, String> {
    if input.period.trim().is_empty()
        || input.account_name.trim().is_empty()
        || input.serial_no.trim().is_empty()
        || input.transaction_date.trim().is_empty()
        || input.income_amount < 0.0
        || input.expense_amount < 0.0
        || (input.income_amount <= 0.0 && input.expense_amount <= 0.0)
        || (input.income_amount > 0.0 && input.expense_amount > 0.0)
    {
        return Err("流水信息不完整，且收入和支出必须二选一并大于零".to_string());
    }
    if let Some(balance) = input.balance {
        if balance < 0.0 {
            return Err("账户余额不能为负数".to_string());
        }
    }
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增银行流水").await?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO bank_transactions (
            id, company_id, period, account_name, serial_no, transaction_date, counterparty, summary,
            income_amount, expense_amount, balance, receipt_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.period.trim())
    .bind(input.account_name.trim())
    .bind(input.serial_no.trim())
    .bind(input.transaction_date.trim())
    .bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(input.summary.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(input.income_amount)
    .bind(input.expense_amount)
    .bind(input.balance)
    .bind(input.receipt_status.as_deref().unwrap_or("待上传"))
    .execute(db.pool())
    .await
    .map_err(|error| format!("新增银行流水失败: {error}"))?;

    sqlx::query_as("SELECT * FROM bank_transactions WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增银行流水失败: {error}"))
}

#[tauri::command]
pub async fn update_bank_transaction(
    input: UpdateBankTransactionInput,
    db: State<'_, Database>,
) -> Result<BankTransaction, String> {
    if input.id.trim().is_empty()
        || input.account_name.trim().is_empty()
        || input.serial_no.trim().is_empty()
        || input.transaction_date.trim().is_empty()
        || input.income_amount < 0.0
        || input.expense_amount < 0.0
        || (input.income_amount <= 0.0 && input.expense_amount <= 0.0)
        || (input.income_amount > 0.0 && input.expense_amount > 0.0)
    {
        return Err("流水信息不完整，且收入和支出必须二选一并大于零".to_string());
    }
    if input.balance.is_some_and(|balance| balance < 0.0) {
        return Err("账户余额不能为负数".to_string());
    }
    let period: String =
        sqlx::query_scalar("SELECT period FROM bank_transactions WHERE id = ? AND company_id = ?")
            .bind(&input.id)
            .bind(&input.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询银行流水账期失败: {error}"))?
            .ok_or_else(|| "未找到当前账套的银行流水".to_string())?;
    ensure_period_label_open(db.pool(), &input.company_id, &period, "修改银行流水").await?;
    let affected = sqlx::query(
        r#"
        UPDATE bank_transactions
        SET account_name = ?, serial_no = ?, transaction_date = ?, counterparty = ?, summary = ?,
            income_amount = ?, expense_amount = ?, balance = ?, receipt_status = ?, updated_at = datetime('now')
        WHERE id = ? AND company_id = ? AND status != '已生成凭证'
        "#,
    )
    .bind(input.account_name.trim())
    .bind(input.serial_no.trim())
    .bind(input.transaction_date.trim())
    .bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(input.summary.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(input.income_amount)
    .bind(input.expense_amount)
    .bind(input.balance)
    .bind(input.receipt_status.as_deref().unwrap_or("待上传"))
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|error| format!("更新银行流水失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到可编辑的银行流水，已生成凭证的流水不可修改".to_string());
    }
    sqlx::query_as("SELECT * FROM bank_transactions WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询更新银行流水失败: {error}"))
}
