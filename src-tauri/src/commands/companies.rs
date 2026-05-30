use crate::db::{Company, CreateCompanyInput, Database};
use tauri::State;

#[tauri::command]
pub async fn get_companies(
    db: State<'_, Database>,
) -> Result<Vec<Company>, String> {
    log::info!("Fetching all companies");

    let companies: Vec<Company> = sqlx::query_as(
        "SELECT * FROM companies WHERE is_deleted = 0 ORDER BY created_at DESC",
    )
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} companies", companies.len());
    Ok(companies)
}

#[tauri::command]
pub async fn get_company(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Company>, String> {
    log::info!("Fetching company: {}", id);

    let company: Option<Company> = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(company)
}

#[tauri::command]
pub async fn create_company(
    input: CreateCompanyInput,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Creating new company: {}", input.name);

    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO companies (id, code, name, tax_id, tax_type, industry, accounting_system, province, city, enable_year, enable_month)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.tax_id)
    .bind(input.tax_type.as_deref().unwrap_or("small"))
    .bind(&input.industry)
    .bind(input.accounting_system.as_deref().unwrap_or("small_enterprise"))
    .bind(&input.province)
    .bind(&input.city)
    .bind(input.enable_year)
    .bind(input.enable_month)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create company: {}", e))?;

    // Create default voucher word for this company (unified "记" prefix)
    let words = vec![("Ji", "记")];
    for (word_code, word_name) in words {
        sqlx::query(
            "INSERT OR IGNORE INTO voucher_words (id, company_id, word_code, word_name) VALUES (?, ?, ?, ?)",
        )
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(word_code)
        .bind(word_name)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to create voucher word: {}", e))?;
    }

    // Create enable-period accounting period (use user-specified or current month)
    let now = chrono::Local::now();
    let year = input.enable_year.unwrap_or_else(|| now.format("%Y").to_string().parse::<i32>().unwrap_or(2026));
    let month = input.enable_month.unwrap_or_else(|| now.format("%m").to_string().parse::<i32>().unwrap_or(1));

    let start_date = format!("{}-{:02}-01", year, month);
    let end_day = days_in_month(year, month);
    let end_date = format!("{}-{:02}-{}", year, month, end_day);

    sqlx::query(
        "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(&id)
    .bind(year)
    .bind(month)
    .bind(&start_date)
    .bind(&end_date)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create period: {}", e))?;

    // Create default auxiliary categories for this company
    let aux_categories = vec![
        ("CUST", "客户", true),
        ("SUPP", "供应商", true),
        ("EMP", "职员", true),
        ("PROJ", "项目", true),
        ("DEPT", "部门", true),
        ("INV", "存货", true),
    ];
    for (cat_code, cat_name, is_system) in aux_categories {
        sqlx::query(
            "INSERT OR IGNORE INTO auxiliary_categories (id, company_id, name, code, is_system, sort_order) VALUES (?, ?, ?, ?, ?, 0)",
        )
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(cat_name)
        .bind(cat_code)
        .bind(is_system as i32)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to create auxiliary category: {}", e))?;
    }

    // Create default base currency (CNY)
    sqlx::query(
        "INSERT OR IGNORE INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES (?, ?, 'CNY', '人民币', 1.0, 1)",
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(&id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create currency: {}", e))?;

    // Seed account codes based on accounting system
    let accounting_system = input.accounting_system.as_deref().unwrap_or("small_enterprise");
    Database::insert_account_codes_for_system(db.pool(), &id, accounting_system).await
        .map_err(|e| format!("Failed to seed account codes: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch created company: {}", e))?;

    log::info!("Company created successfully: {}", id);
    Ok(company)
}

#[tauri::command]
pub async fn update_company(
    id: String,
    input: CreateCompanyInput,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Updating company: {}", id);

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        UPDATE companies
        SET name = ?, tax_id = ?, tax_type = ?, industry = ?, province = ?, city = ?,
            enable_year = ?, enable_month = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.name)
    .bind(&input.tax_id)
    .bind(&input.tax_type)
    .bind(&input.industry)
    .bind(&input.province)
    .bind(&input.city)
    .bind(input.enable_year)
    .bind(input.enable_month)
    .bind(&now)
    .bind(&id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to update company: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch updated company: {}", e))?;

    log::info!("Company updated successfully: {}", id);
    Ok(company)
}

#[tauri::command]
pub async fn delete_company(
    id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Soft-deleting company (30-day retention): {}", id);

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE companies SET is_deleted = 1, is_active = 0, deleted_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(&now)
    .bind(&id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to delete company: {}", e))?;

    log::info!("Company soft-deleted successfully: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn deactivate_company(
    id: String,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Deactivating company: {}", id);

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query("UPDATE companies SET is_active = 0, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to deactivate company: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch company: {}", e))?;

    log::info!("Company deactivated successfully: {}", id);
    Ok(company)
}

#[tauri::command]
pub async fn activate_company(
    id: String,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Activating company: {}", id);

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query("UPDATE companies SET is_active = 1, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to activate company: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch company: {}", e))?;

    log::info!("Company activated successfully: {}", id);
    Ok(company)
}

#[tauri::command]
pub async fn restore_company(
    id: String,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Restoring soft-deleted company: {}", id);

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE companies SET is_deleted = 0, is_active = 1, deleted_at = NULL, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(&id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to restore company: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch company: {}", e))?;

    log::info!("Company restored successfully: {}", id);
    Ok(company)
}

#[tauri::command]
pub async fn permanent_delete_company(
    id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Permanently deleting company and all related data: {}", id);

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Delete all related data in correct order (child → parent)
    let related_tables = [
        "voucher_entry_auxiliaries",
        "voucher_entries",
        "voucher_logs",
        "vouchers",
        "account_balances",
        "account_auxiliary_links",
        "auxiliary_items",
        "auxiliary_categories",
        "currencies",
        "voucher_template_types",
        "voucher_templates",
        "common_digests",
        "settlement_rules",
        "dashboard_widgets",
        "financial_indicators",
        "voucher_words",
        "accounting_periods",
        "account_codes",
        "counterparties",
        "invoices",
        "initial_balances",
        "user_companies",
    ];

    for table in &related_tables {
        sqlx::query(&format!("DELETE FROM {} WHERE company_id = ?", table))
            .bind(&id)
            .execute(&mut *tx)
            .await
            .ok(); // Ignore errors for tables that don't exist yet
    }

    // Finally delete the company itself
    sqlx::query("DELETE FROM companies WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete company: {}", e))?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Company permanently deleted: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn get_deleted_companies(
    db: State<'_, Database>,
) -> Result<Vec<Company>, String> {
    log::info!("Fetching soft-deleted companies");

    let companies: Vec<Company> = sqlx::query_as(
        "SELECT * FROM companies WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} deleted companies", companies.len());
    Ok(companies)
}

#[tauri::command]
pub async fn cleanup_expired_companies(
    db: State<'_, Database>,
) -> Result<u64, String> {
    log::info!("Cleaning up companies deleted more than 30 days ago");

    // Find companies deleted more than 30 days ago
    let expired: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM companies WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND datetime(deleted_at) <= datetime('now', '-30 days')",
    )
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let count = expired.len() as u64;

    for (id,) in &expired {
        // Inline permanent deletion logic (can't call Tauri command from here)
        let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

        let related_tables = [
            "voucher_entry_auxiliaries", "voucher_entries", "voucher_logs", "vouchers",
            "account_balances", "account_auxiliary_links", "auxiliary_items", "auxiliary_categories",
            "currencies", "voucher_template_types", "voucher_templates", "common_digests",
            "settlement_rules", "dashboard_widgets", "financial_indicators", "voucher_words",
            "accounting_periods", "account_codes", "counterparties", "invoices",
            "initial_balances", "user_companies",
        ];

        for table in &related_tables {
            sqlx::query(&format!("DELETE FROM {} WHERE company_id = ?", table))
                .bind(id)
                .execute(&mut *tx)
                .await
                .ok();
        }

        sqlx::query("DELETE FROM companies WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to delete company: {}", e))?;

        tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;
    }

    log::info!("Permanently deleted {} expired companies", count);
    Ok(count)
}

fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}
