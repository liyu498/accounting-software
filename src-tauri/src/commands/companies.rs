use crate::db::{Company, CreateCompanyInput, Database};
use tauri::State;

#[tauri::command]
pub async fn get_companies(
    db: State<'_, Database>,
) -> Result<Vec<Company>, String> {
    log::info!("Fetching all companies");

    let companies: Vec<Company> = sqlx::query_as("SELECT * FROM companies ORDER BY created_at DESC")
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
    log::info!("Deleting company: {}", id);

    sqlx::query("DELETE FROM companies WHERE id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete company: {}", e))?;

    log::info!("Company deleted successfully: {}", id);
    Ok(())
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
