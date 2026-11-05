use crate::db::{AccountCode, CreateAccountCodeInput, Database, DbPool};
use tauri::State;

#[tauri::command]
pub async fn get_account_codes(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!("Fetching account codes for company: {}", company_id);

    let codes: Vec<AccountCode> =
        sqlx::query_as("SELECT * FROM account_codes WHERE company_id = ? ORDER BY code")
            .bind(&company_id)
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    log::info!(
        "Found {} account codes for company {}",
        codes.len(),
        company_id
    );
    Ok(codes)
}

pub async fn get_account_code(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<AccountCode>, String> {
    log::info!(
        "Fetching account code: {} for company: {}",
        code,
        company_id
    );

    let result: Option<AccountCode> =
        sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
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
    log::info!(
        "Fetching account codes by type: {} for company: {}",
        account_type,
        company_id
    );

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
    create_account_code_record(input, db.pool()).await
}

async fn account_usage_count(
    company_id: &str,
    code: &str,
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<i64, String> {
    sqlx::query_scalar(
        r#"SELECT
             (SELECT COUNT(*) FROM voucher_entries ve
              JOIN vouchers v ON v.id = ve.voucher_id
              WHERE v.company_id = ? AND ve.account_code = ?)
             +
             (SELECT COUNT(*) FROM account_balances ab
              JOIN accounting_periods ap ON ap.id = ab.period_id
              WHERE ap.company_id = ? AND ab.account_code = ?
                AND (ABS(ab.opening_debit) >= 0.001
                     OR ABS(ab.opening_credit) >= 0.001
                     OR ABS(ab.period_debit) >= 0.001
                     OR ABS(ab.period_credit) >= 0.001
                     OR ABS(ab.closing_debit) >= 0.001
                     OR ABS(ab.closing_credit) >= 0.001))"#,
    )
    .bind(company_id)
    .bind(code)
    .bind(company_id)
    .bind(code)
    .fetch_one(&mut **transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))
}

async fn create_account_code_record(
    input: CreateAccountCodeInput,
    pool: &DbPool,
) -> Result<AccountCode, String> {
    log::info!(
        "Creating new account code: {} for company: {}",
        input.code,
        input.company_id
    );
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start account transaction: {}", e))?;

    // Validate parent exists if parent_code provided
    if let Some(ref parent) = input.parent_code {
        if parent == &input.code {
            return Err("科目不能设置自身为父级科目".to_string());
        }
        let parent_info: Option<(String, String, i32, i32)> = sqlx::query_as(
            "SELECT account_type, normal_balance, level, is_detail FROM account_codes WHERE code = ? AND company_id = ? AND is_enabled = 1",
        )
        .bind(parent)
        .bind(&input.company_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        let Some((parent_type, parent_balance, parent_level, parent_is_detail)) = parent_info
        else {
            return Err(format!("父级科目 {} 不存在", parent));
        };
        if input.account_type != parent_type {
            return Err("下级科目的科目类型必须与父级科目一致".to_string());
        }
        if input.normal_balance.as_deref().unwrap_or("debit") != parent_balance {
            return Err("下级科目的余额方向必须与父级科目一致".to_string());
        }
        if input.level != parent_level + 1 {
            return Err(format!("下级科目级次必须为 {}", parent_level + 1));
        }

        if parent_is_detail == 1 {
            let usage_count =
                account_usage_count(&input.company_id, parent, &mut transaction).await?;
            if usage_count > 0 {
                return Err(
                    "父级科目已有余额或凭证，不能直接改为非末级科目；请先完成余额转移".to_string(),
                );
            }
        }

        // When adding a child, mark parent as non-detail
        sqlx::query("UPDATE account_codes SET is_detail = 0 WHERE code = ? AND company_id = ? AND is_detail = 1")
            .bind(parent)
            .bind(&input.company_id)
            .execute(&mut *transaction)
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
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create account code: {}", e))?;

    let code: AccountCode =
        sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
            .bind(&input.code)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| format!("Failed to fetch created account code: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit account transaction: {}", e))?;

    log::info!(
        "Account code created successfully: {} for company: {}",
        input.code,
        input.company_id
    );
    Ok(code)
}

#[tauri::command]
pub async fn update_account_code(
    code: String,
    company_id: String,
    input: CreateAccountCodeInput,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    update_account_code_record(code, company_id, input, db.pool()).await
}

async fn update_account_code_record(
    code: String,
    company_id: String,
    input: CreateAccountCodeInput,
    pool: &DbPool,
) -> Result<AccountCode, String> {
    log::info!(
        "Updating account code: {} for company: {}",
        code,
        company_id
    );

    if input.code != code || input.company_id != company_id {
        return Err("科目编码或账套标识与当前记录不一致".to_string());
    }

    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start account transaction: {}", e))?;
    let existing: AccountCode =
        sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
            .bind(&code)
            .bind(&company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let normal_balance = input.normal_balance.as_deref().unwrap_or("debit");
    let is_detail = input.is_detail.unwrap_or(1);
    let has_quantity = input.has_quantity.unwrap_or(0);
    let has_auxiliary = input.has_auxiliary.unwrap_or(0);
    let structural_changed = existing.account_type != input.account_type
        || existing.normal_balance != normal_balance
        || existing.level != input.level
        || existing.parent_code != input.parent_code
        || existing.is_detail != is_detail
        || existing.has_quantity != has_quantity
        || existing.default_unit != input.default_unit
        || existing.has_auxiliary != has_auxiliary;
    if structural_changed && account_usage_count(&company_id, &code, &mut transaction).await? > 0 {
        return Err("该科目已在余额或凭证中使用，只能修改科目名称".to_string());
    }

    let child_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM account_codes WHERE company_id = ? AND parent_code = ?",
    )
    .bind(&company_id)
    .bind(&code)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if is_detail == 1 && child_count > 0 {
        return Err("存在下级科目的科目不能设置为末级科目".to_string());
    }

    if let Some(parent) = input.parent_code.as_deref() {
        if parent == code {
            return Err("科目不能设置自身为父级科目".to_string());
        }
        let parent_info: Option<(String, String, i32)> = sqlx::query_as(
            "SELECT account_type, normal_balance, level FROM account_codes WHERE company_id = ? AND code = ? AND is_enabled = 1",
        )
        .bind(&company_id)
        .bind(parent)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
        let Some((parent_type, parent_balance, parent_level)) = parent_info else {
            return Err(format!("父级科目 {} 不存在", parent));
        };
        if parent_type != input.account_type || parent_balance != normal_balance {
            return Err("下级科目的科目类型和余额方向必须与父级科目一致".to_string());
        }
        if input.level != parent_level + 1 {
            return Err(format!("下级科目级次必须为 {}", parent_level + 1));
        }
    } else if input.level != 1 {
        return Err("无父级科目只能设置为一级科目".to_string());
    }

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
    .bind(has_quantity)
    .bind(&input.default_unit)
    .bind(has_auxiliary)
    .bind(&code)
    .bind(&company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to update account code: {}", e))?;

    if let Some(parent) = input.parent_code.as_deref() {
        sqlx::query("UPDATE account_codes SET is_detail = 0 WHERE company_id = ? AND code = ?")
            .bind(&company_id)
            .bind(parent)
            .execute(&mut *transaction)
            .await
            .map_err(|e| format!("Failed to update parent: {}", e))?;
    }
    if existing.parent_code != input.parent_code {
        if let Some(old_parent) = existing.parent_code.as_deref() {
            sqlx::query(
                r#"UPDATE account_codes SET is_detail = 1
                   WHERE company_id = ? AND code = ?
                     AND NOT EXISTS (
                       SELECT 1 FROM account_codes child
                       WHERE child.company_id = ? AND child.parent_code = ?
                     )"#,
            )
            .bind(&company_id)
            .bind(old_parent)
            .bind(&company_id)
            .bind(old_parent)
            .execute(&mut *transaction)
            .await
            .map_err(|e| format!("Failed to restore former parent: {}", e))?;
        }
    }

    let result: AccountCode =
        sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
            .bind(&code)
            .bind(&company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| format!("Failed to fetch updated account code: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit account transaction: {}", e))?;

    log::info!(
        "Account code updated successfully: {} for company: {}",
        code,
        company_id
    );
    Ok(result)
}

#[tauri::command]
pub async fn toggle_account_code(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    log::info!(
        "Toggling account code enabled: {} for company: {}",
        code,
        company_id
    );

    sqlx::query(
        "UPDATE account_codes SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE code = ? AND company_id = ?",
    )
    .bind(&code)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to toggle account code: {}", e))?;

    let result: AccountCode =
        sqlx::query_as("SELECT * FROM account_codes WHERE code = ? AND company_id = ?")
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
    log::info!(
        "Deleting account code: {} for company: {}",
        code,
        company_id
    );

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

    log::info!(
        "Account code deleted successfully: {} for company: {}",
        code,
        company_id
    );
    Ok(())
}

#[tauri::command]
pub async fn search_account_codes(
    keyword: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    log::info!(
        "Searching account codes with keyword: {} for company: {}",
        keyword,
        company_id
    );

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

#[cfg(test)]
mod tests {
    use super::{create_account_code_record, update_account_code_record};
    use crate::db::{CreateAccountCodeInput, Database};

    #[tokio::test]
    async fn failed_child_creation_keeps_parent_as_detail_account() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-account-code-test-{}",
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
            "INSERT INTO account_codes (company_id, code, name, account_type, is_detail) VALUES ('company-1', '1001', '库存现金', 'asset', 1)",
        )
        .execute(database.pool())
        .await
        .expect("creates parent account");
        sqlx::query(
            "CREATE TRIGGER reject_child_account BEFORE INSERT ON account_codes WHEN NEW.code = '100101' BEGIN SELECT RAISE(ABORT, 'forced child failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = create_account_code_record(
            CreateAccountCodeInput {
                code: "100101".to_string(),
                company_id: "company-1".to_string(),
                name: "备用金".to_string(),
                account_type: "asset".to_string(),
                normal_balance: Some("debit".to_string()),
                level: 2,
                parent_code: Some("1001".to_string()),
                is_detail: Some(1),
                has_quantity: Some(0),
                default_unit: None,
                has_auxiliary: Some(0),
            },
            database.pool(),
        )
        .await;
        assert!(result.is_err(), "forced child failure must surface");

        let parent_is_detail: i32 = sqlx::query_scalar(
            "SELECT is_detail FROM account_codes WHERE company_id = 'company-1' AND code = '1001'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads parent account");
        assert_eq!(parent_is_detail, 1);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn used_detail_account_cannot_be_converted_into_a_parent() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-used-parent-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        for statement in [
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '测试企业')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'company-1', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('company-1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('b1', 'p1', '1001', 100, 100)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds used parent account");
        }

        let result = create_account_code_record(
            CreateAccountCodeInput {
                code: "100101".to_string(),
                company_id: "company-1".to_string(),
                name: "备用金".to_string(),
                account_type: "asset".to_string(),
                normal_balance: Some("debit".to_string()),
                level: 2,
                parent_code: Some("1001".to_string()),
                is_detail: Some(1),
                has_quantity: Some(0),
                default_unit: None,
                has_auxiliary: Some(0),
            },
            database.pool(),
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("已有余额或凭证"));
        let parent_is_detail: i32 = sqlx::query_scalar(
            "SELECT is_detail FROM account_codes WHERE company_id = 'company-1' AND code = '1001'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads unchanged parent");
        assert_eq!(parent_is_detail, 1);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn used_account_allows_rename_but_rejects_structural_changes() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-used-account-update-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        for statement in [
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '测试企业')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('p1', 'company-1', 2026, 1, '2026-01-01', '2026-01-31')",
            "INSERT INTO account_codes (company_id, code, name, account_type, normal_balance, level, is_detail) VALUES ('company-1', '1001', '库存现金', 'asset', 'debit', 1, 1)",
            "INSERT INTO account_balances (id, period_id, account_code, opening_debit, closing_debit) VALUES ('b1', 'p1', '1001', 100, 100)",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds used account");
        }

        let renamed = update_account_code_record(
            "1001".to_string(),
            "company-1".to_string(),
            CreateAccountCodeInput {
                code: "1001".to_string(),
                company_id: "company-1".to_string(),
                name: "库存现金（人民币）".to_string(),
                account_type: "asset".to_string(),
                normal_balance: Some("debit".to_string()),
                level: 1,
                parent_code: None,
                is_detail: Some(1),
                has_quantity: Some(0),
                default_unit: None,
                has_auxiliary: Some(0),
            },
            database.pool(),
        )
        .await
        .expect("renames a used account");
        assert_eq!(renamed.name, "库存现金（人民币）");

        let structural = update_account_code_record(
            "1001".to_string(),
            "company-1".to_string(),
            CreateAccountCodeInput {
                code: "1001".to_string(),
                company_id: "company-1".to_string(),
                name: "库存现金（人民币）".to_string(),
                account_type: "expense".to_string(),
                normal_balance: Some("debit".to_string()),
                level: 1,
                parent_code: None,
                is_detail: Some(1),
                has_quantity: Some(0),
                default_unit: None,
                has_auxiliary: Some(0),
            },
            database.pool(),
        )
        .await;
        assert!(structural.is_err());
        assert!(structural.unwrap_err().contains("已在余额或凭证中使用"));

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }
}
