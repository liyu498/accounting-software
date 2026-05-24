use crate::db::{AccountCode, CreateAccountCodeInput, Database};
use tauri::State;

#[tauri::command]
pub async fn get_account_codes(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!("Fetching account codes for company: {}", company_id);

    let codes: Vec<AccountCode> = sqlx::query_as(
        "SELECT * FROM account_codes WHERE company_id = ? ORDER BY code",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} account codes for company {}", codes.len(), company_id);
    Ok(codes)
}

#[tauri::command]
pub async fn get_account_code(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<AccountCode>, String> {
    log::info!("Fetching account code: {} for company: {}", code, company_id);

    let result: Option<AccountCode> = sqlx::query_as(
        "SELECT * FROM account_codes WHERE code = ? AND company_id = ?",
    )
    .bind(&code)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn get_account_codes_by_type(
    account_type: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!("Fetching account codes by type: {} for company: {}", account_type, company_id);

    let codes: Vec<AccountCode> = sqlx::query_as(
        "SELECT * FROM account_codes WHERE account_type = ? AND company_id = ? AND is_enabled = 1 ORDER BY code",
    )
    .bind(&account_type)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(codes)
}

#[tauri::command]
pub async fn get_detail_account_codes(
    company_id: String,
    parent_code: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!("Fetching detail account codes for company: {}", company_id);

    let codes: Vec<AccountCode> = if let Some(ref pc) = parent_code {
        sqlx::query_as(
            "SELECT * FROM account_codes WHERE company_id = ? AND parent_code = ? AND is_detail = 1 AND is_enabled = 1 ORDER BY code",
        )
        .bind(&company_id)
        .bind(pc)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    } else {
        sqlx::query_as(
            "SELECT * FROM account_codes WHERE company_id = ? AND is_detail = 1 AND is_enabled = 1 ORDER BY code",
        )
        .bind(&company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    };

    Ok(codes)
}

#[tauri::command]
pub async fn create_account_code(
    input: CreateAccountCodeInput,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    log::info!("Creating new account code: {} for company: {}", input.code, input.company_id);

    // Validate parent exists if parent_code provided
    if let Some(ref parent) = input.parent_code {
        let parent_exists: Option<(String,)> = sqlx::query_as(
            "SELECT code FROM account_codes WHERE code = ? AND company_id = ?",
        )
        .bind(parent)
        .bind(&input.company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if parent_exists.is_none() {
            return Err(format!("父级科目 {} 不存在", parent));
        }

        // When adding a child, mark parent as non-detail
        sqlx::query("UPDATE account_codes SET is_detail = 0 WHERE code = ? AND company_id = ? AND is_detail = 1")
            .bind(parent)
            .bind(&input.company_id)
            .execute(db.pool())
            .await
            .map_err(|e| format!("Failed to update parent: {}", e))?;
    }

    let normal_balance = input.normal_balance.as_deref().unwrap_or("debit");
    let is_detail = input.is_detail.unwrap_or(1);

    sqlx::query(
        r#"
        INSERT INTO account_codes (code, company_id, name, account_type, normal_balance, level, parent_code, is_detail,
            has_quantity, default_unit, has_auxiliary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&input.code)
    .bind(&input.company_id)
    .bind(&input.name)
    .bind(&input.account_type)
    .bind(normal_balance)
    .bind(input.level)
    .bind(&input.parent_code)
    .bind(is_detail)
    .bind(input.has_quantity.unwrap_or(0))
    .bind(&input.default_unit)
    .bind(input.has_auxiliary.unwrap_or(0))
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create account code: {}", e))?;

    let code: AccountCode = sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
        .bind(&input.code)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch created account code: {}", e))?;

    log::info!("Account code created successfully: {} for company: {}", input.code, input.company_id);
    Ok(code)
}

#[tauri::command]
pub async fn update_account_code(
    code: String,
    company_id: String,
    input: CreateAccountCodeInput,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    log::info!("Updating account code: {} for company: {}", code, company_id);

    let normal_balance = input.normal_balance.as_deref().unwrap_or("debit");
    let is_detail = input.is_detail.unwrap_or(1);

    sqlx::query(
        r#"
        UPDATE account_codes
        SET name = ?, account_type = ?, normal_balance = ?, level = ?, parent_code = ?, is_detail = ?,
            has_quantity = ?, default_unit = ?, has_auxiliary = ?
        WHERE code = ? AND company_id = ?
        "#,
    )
    .bind(&input.name)
    .bind(&input.account_type)
    .bind(normal_balance)
    .bind(input.level)
    .bind(&input.parent_code)
    .bind(is_detail)
    .bind(input.has_quantity.unwrap_or(0))
    .bind(&input.default_unit)
    .bind(input.has_auxiliary.unwrap_or(0))
    .bind(&code)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to update account code: {}", e))?;

    let result: AccountCode = sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
        .bind(&code)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch updated account code: {}", e))?;

    log::info!("Account code updated successfully: {} for company: {}", code, company_id);
    Ok(result)
}

#[tauri::command]
pub async fn toggle_account_code(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    log::info!("Toggling account code enabled: {} for company: {}", code, company_id);

    sqlx::query(
        "UPDATE account_codes SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE code = ? AND company_id = ?",
    )
    .bind(&code)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to toggle account code: {}", e))?;

    let result: AccountCode = sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
        .bind(&code)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_account_code(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Deleting account code: {} for company: {}", code, company_id);

    // Check for child codes
    let children: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM account_codes WHERE parent_code = ? AND company_id = ?",
    )
    .bind(&code)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if children.0 > 0 {
        return Err("该科目存在下级科目，不能删除".to_string());
    }

    // Check for usage in voucher entries (through vouchers belonging to this company)
    let used: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM voucher_entries ve JOIN vouchers v ON ve.voucher_id = v.id WHERE ve.account_code = ? AND v.company_id = ?",
    )
    .bind(&code)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if used.0 > 0 {
        return Err("该科目已在凭证中使用，不能删除".to_string());
    }

    sqlx::query("DELETE FROM account_codes WHERE code = ? AND company_id = ?")
        .bind(&code)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete account code: {}", e))?;

    log::info!("Account code deleted successfully: {} for company: {}", code, company_id);
    Ok(())
}

#[tauri::command]
pub async fn search_account_codes(
    keyword: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!("Searching account codes with keyword: {} for company: {}", keyword, company_id);

    let search_pattern = format!("%{}%", keyword);
    let codes: Vec<AccountCode> = sqlx::query_as(
        "SELECT * FROM account_codes WHERE company_id = ? AND (code LIKE ? OR name LIKE ?) ORDER BY code",
    )
    .bind(&company_id)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(codes)
}
