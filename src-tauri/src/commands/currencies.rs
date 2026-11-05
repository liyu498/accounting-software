use crate::db::{Database, DbPool};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Currency {
    pub id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub exchange_rate: f64,
    pub is_base: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCurrencyInput {
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub exchange_rate: f64,
    pub is_base: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateCurrencyInput {
    pub id: String,
    pub company_id: String,
    pub code: Option<String>,
    pub name: Option<String>,
    pub exchange_rate: Option<f64>,
    pub is_base: Option<i32>,
}

#[tauri::command]
pub async fn get_currencies(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Currency>, String> {
    let currencies: Vec<Currency> =
        sqlx::query_as("SELECT * FROM currencies WHERE company_id = ? ORDER BY is_base DESC, code")
            .bind(&company_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    Ok(currencies)
}

#[tauri::command]
pub async fn create_currency(
    input: CreateCurrencyInput,
    db: State<'_, Database>,
) -> Result<Currency, String> {
    create_currency_record(input, db.pool()).await
}

async fn create_currency_record(
    input: CreateCurrencyInput,
    pool: &DbPool,
) -> Result<Currency, String> {
    if input.code.trim().is_empty() {
        return Err("币别编码不能为空".to_string());
    }
    if input.exchange_rate <= 0.0 {
        return Err("汇率必须大于0".to_string());
    }
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start currency transaction: {}", e))?;

    // Check for duplicate code within company
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM currencies WHERE company_id = ? AND code = ?")
            .bind(&input.company_id)
            .bind(input.code.trim())
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err(format!("币别编码 {} 已存在", input.code));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let is_base = input.is_base.unwrap_or(0);

    // If setting as base, unset any existing base
    if is_base == 1 {
        sqlx::query("UPDATE currencies SET is_base = 0 WHERE company_id = ? AND is_base = 1")
            .bind(&input.company_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    }

    sqlx::query(
        "INSERT INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.code.trim())
    .bind(input.name.trim())
    .bind(input.exchange_rate)
    .bind(is_base)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create currency: {}", e))?;

    let currency: Currency = sqlx::query_as("SELECT * FROM currencies WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to fetch created currency: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit currency transaction: {}", e))?;

    Ok(currency)
}

#[tauri::command]
pub async fn update_currency(
    input: UpdateCurrencyInput,
    db: State<'_, Database>,
) -> Result<Currency, String> {
    update_currency_record(input, db.pool()).await
}

async fn update_currency_record(
    input: UpdateCurrencyInput,
    pool: &DbPool,
) -> Result<Currency, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start currency transaction: {}", e))?;
    let existing: Currency =
        sqlx::query_as("SELECT * FROM currencies WHERE id = ? AND company_id = ?")
            .bind(&input.id)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| format!("Currency not found: {}", e))?;

    let code = input.code.unwrap_or(existing.code);
    let name = input.name.unwrap_or(existing.name);
    let exchange_rate = input.exchange_rate.unwrap_or(existing.exchange_rate);
    let is_base = input.is_base.unwrap_or(existing.is_base);

    if exchange_rate <= 0.0 {
        return Err("汇率必须大于0".to_string());
    }

    // If setting as base, unset any existing base
    if is_base == 1 && existing.is_base != 1 {
        sqlx::query("UPDATE currencies SET is_base = 0 WHERE company_id = ? AND is_base = 1")
            .bind(&input.company_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    }

    sqlx::query(
        "UPDATE currencies SET code = ?, name = ?, exchange_rate = ?, is_base = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&code)
    .bind(&name)
    .bind(exchange_rate)
    .bind(is_base)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to update currency: {}", e))?;

    let currency: Currency = sqlx::query_as("SELECT * FROM currencies WHERE id = ?")
        .bind(&input.id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Failed to fetch updated currency: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit currency transaction: {}", e))?;

    Ok(currency)
}

#[tauri::command]
pub async fn delete_currency(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let existing: Currency =
        sqlx::query_as("SELECT * FROM currencies WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&company_id)
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("Currency not found: {}", e))?;

    if existing.is_base == 1 {
        return Err("不能删除本位币".to_string());
    }

    // Check if used in any voucher entries
    let in_use: Option<(i32,)> =
        sqlx::query_as("SELECT COUNT(*) FROM voucher_entries WHERE currency_id = ?")
            .bind(&id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if let Some((count,)) = in_use {
        if count > 0 {
            return Err(format!("该币别已在 {} 条分录中使用，无法删除", count));
        }
    }

    sqlx::query("DELETE FROM currencies WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete currency: {}", e))?;

    Ok(())
}

/// Calculate exchange rate difference at period end (期末调汇)
/// Returns a list of adjustment entries needed for foreign currency accounts
#[tauri::command]
pub async fn calculate_exchange_adjustment(
    company_id: String,
    period_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ExchangeAdjustmentItem>, String> {
    // Get all non-base currencies with their rates
    let currencies: Vec<Currency> =
        sqlx::query_as("SELECT * FROM currencies WHERE company_id = ? AND is_base = 0")
            .bind(&company_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if currencies.is_empty() {
        return Ok(vec![]);
    }

    let mut adjustments = Vec::new();

    for currency in &currencies {
        // Find all accounts with foreign currency transactions in this period
        let entries: Vec<(String, String, f64, f64)> = sqlx::query_as(
            r#"SELECT ve.account_code, ve.account_name,
                      SUM(CASE WHEN ve.direction = 'debit' THEN ve.amount ELSE 0 END),
                      SUM(CASE WHEN ve.direction = 'credit' THEN ve.amount ELSE 0 END)
               FROM voucher_entries ve
               JOIN vouchers v ON ve.voucher_id = v.id
               WHERE v.company_id = ? AND v.period_id = ? AND ve.currency_id = ?
               GROUP BY ve.account_code, ve.account_name"#,
        )
        .bind(&company_id)
        .bind(&period_id)
        .bind(&currency.id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for (account_code, account_name, total_debit, total_credit) in entries {
            let net = total_debit - total_credit;
            if net.abs() < 0.01 {
                continue;
            }

            // Get the normal balance side
            let normal: Option<(String,)> = sqlx::query_as(
                "SELECT normal_balance FROM account_codes WHERE code = ? AND company_id = ?",
            )
            .bind(&account_code)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .ok()
            .flatten();

            let is_debit_normal = normal.as_ref().map(|(b,)| b.as_str()) == Some("debit");
            let original_balance = if is_debit_normal { net } else { -net };
            let adjusted_balance = original_balance * currency.exchange_rate;
            let difference = adjusted_balance - original_balance;

            if difference.abs() >= 0.01 {
                adjustments.push(ExchangeAdjustmentItem {
                    currency_code: currency.code.clone(),
                    currency_name: currency.name.clone(),
                    exchange_rate: currency.exchange_rate,
                    account_code,
                    account_name,
                    original_balance,
                    adjusted_balance,
                    difference,
                    direction: if difference > 0.0 { "credit" } else { "debit" }.to_string(),
                });
            }
        }
    }

    Ok(adjustments)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeAdjustmentItem {
    pub currency_code: String,
    pub currency_name: String,
    pub exchange_rate: f64,
    pub account_code: String,
    pub account_name: String,
    pub original_balance: f64,
    pub adjusted_balance: f64,
    pub difference: f64,
    pub direction: String,
}

#[cfg(test)]
mod tests {
    use super::{
        create_currency_record, update_currency_record, CreateCurrencyInput, UpdateCurrencyInput,
    };
    use crate::db::Database;

    async fn test_database(name: &str) -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-currency-{name}-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '测试企业')",
        )
        .execute(database.pool())
        .await
        .expect("creates company");
        sqlx::query(
            "INSERT INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES ('cny', 'company-1', 'CNY', '人民币', 1, 1)",
        )
        .execute(database.pool())
        .await
        .expect("creates base currency");
        (database, data_dir)
    }

    async fn cleanup(database: Database, data_dir: std::path::PathBuf) {
        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn failed_base_currency_creation_preserves_existing_base_currency() {
        let (database, data_dir) = test_database("create-rollback").await;
        sqlx::query(
            "CREATE TRIGGER reject_usd_currency BEFORE INSERT ON currencies WHEN NEW.code = 'USD' BEGIN SELECT RAISE(ABORT, 'forced currency failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = create_currency_record(
            CreateCurrencyInput {
                company_id: "company-1".to_string(),
                code: "USD".to_string(),
                name: "美元".to_string(),
                exchange_rate: 7.1,
                is_base: Some(1),
            },
            database.pool(),
        )
        .await;
        assert!(result.is_err(), "forced creation failure must surface");

        let base: i32 = sqlx::query_scalar("SELECT is_base FROM currencies WHERE id = 'cny'")
            .fetch_one(database.pool())
            .await
            .expect("reads original base currency");
        assert_eq!(base, 1);
        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn failed_base_currency_switch_preserves_existing_base_currency() {
        let (database, data_dir) = test_database("update-rollback").await;
        sqlx::query(
            "INSERT INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES ('usd', 'company-1', 'USD', '美元', 7.1, 0)",
        )
        .execute(database.pool())
        .await
        .expect("creates alternate currency");
        sqlx::query(
            "CREATE TRIGGER reject_usd_base_switch BEFORE UPDATE ON currencies WHEN OLD.id = 'usd' AND NEW.is_base = 1 BEGIN SELECT RAISE(ABORT, 'forced switch failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = update_currency_record(
            UpdateCurrencyInput {
                id: "usd".to_string(),
                company_id: "company-1".to_string(),
                code: None,
                name: None,
                exchange_rate: None,
                is_base: Some(1),
            },
            database.pool(),
        )
        .await;
        assert!(result.is_err(), "forced switch failure must surface");

        let states: Vec<(String, i32)> = sqlx::query_as(
            "SELECT id, is_base FROM currencies WHERE company_id = 'company-1' ORDER BY id",
        )
        .fetch_all(database.pool())
        .await
        .expect("reads currency states");
        assert_eq!(states, vec![("cny".to_string(), 1), ("usd".to_string(), 0)]);
        cleanup(database, data_dir).await;
    }
}
