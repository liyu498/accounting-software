use crate::commands::auth::authenticated_actor;
use crate::db::{Company, CreateCompanyInput, Database, DbPool};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CompanyMemo {
    pub id: String,
    pub company_id: String,
    pub content: String,
    pub reminder_date: Option<String>,
    pub updated_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertCompanyMemoInput {
    pub company_id: String,
    pub content: String,
    pub reminder_date: Option<String>,
}

async fn authenticated_company_scope(
    auth_token: &str,
    db: &Database,
) -> Result<(String, bool), String> {
    let user_id = crate::commands::auth::validate_session_token(auth_token)?;
    let role: String = sqlx::query_scalar("SELECT role FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|error| format!("读取当前用户账套范围失败: {error}"))?
        .ok_or_else(|| "当前登录用户不存在".to_string())?;
    Ok((user_id, role == "admin"))
}

#[tauri::command]
pub async fn get_company_memos(
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Vec<CompanyMemo>, String> {
    let (user_id, is_admin) = authenticated_company_scope(&auth_token, &db).await?;
    let memos = if is_admin {
        sqlx::query_as(
            r#"
            SELECT id, company_id, content, reminder_date, updated_by, created_at, updated_at
            FROM company_memos
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(db.pool())
        .await
    } else {
        sqlx::query_as(
            r#"
            SELECT m.id, m.company_id, m.content, m.reminder_date, m.updated_by, m.created_at, m.updated_at
            FROM company_memos m
            JOIN user_companies uc ON uc.company_id = m.company_id
            WHERE uc.user_id = ?
            ORDER BY m.updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(db.pool())
        .await
    };
    memos.map_err(|e| format!("查询客户备忘录失败: {e}"))
}

#[tauri::command]
pub async fn upsert_company_memo(
    input: UpsertCompanyMemoInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<CompanyMemo, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    if input.company_id.trim().is_empty() {
        return Err("账套不能为空".to_string());
    }
    if input.content.trim().is_empty() {
        return Err("备忘录内容不能为空".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO company_memos (id, company_id, content, reminder_date, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
            content = excluded.content,
            reminder_date = excluded.reminder_date,
            updated_by = excluded.updated_by,
            updated_at = datetime('now')
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.content.trim())
    .bind(&input.reminder_date)
    .bind(&actor)
    .execute(db.pool())
    .await
    .map_err(|e| format!("保存客户备忘录失败: {e}"))?;

    sqlx::query_as(
        r#"
        SELECT id, company_id, content, reminder_date, updated_by, created_at, updated_at
        FROM company_memos
        WHERE company_id = ?
        "#,
    )
    .bind(&input.company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("读取客户备忘录失败: {e}"))
}

#[tauri::command]
pub async fn get_companies(
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Vec<Company>, String> {
    let (user_id, is_admin) = authenticated_company_scope(&auth_token, &db).await?;
    log::info!("Fetching companies for authenticated user: {}", user_id);

    let companies: Vec<Company> = if is_admin {
        sqlx::query_as("SELECT * FROM companies WHERE is_deleted = 0 ORDER BY created_at DESC")
            .fetch_all(db.pool())
            .await
    } else {
        sqlx::query_as(
            r#"
            SELECT c.*
            FROM companies c
            JOIN user_companies uc ON uc.company_id = c.id
            WHERE uc.user_id = ? AND c.is_deleted = 0
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(db.pool())
        .await
    }
    .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} companies", companies.len());
    Ok(companies)
}

#[tauri::command]
pub async fn get_company(id: String, db: State<'_, Database>) -> Result<Option<Company>, String> {
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

    let company = create_company_record(input, db.pool()).await?;
    log::info!("Company created successfully: {}", company.id);
    Ok(company)
}

async fn create_company_record(
    input: CreateCompanyInput,
    pool: &DbPool,
) -> Result<Company, String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to start company creation transaction: {error}"))?;

    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO companies (
            id, code, name, tax_id, tax_type, industry, accounting_system,
            province, city, district, enterprise_type, service_start, service_end,
            enable_year, enable_month
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.tax_id)
    .bind(input.tax_type.as_deref().unwrap_or("small"))
    .bind(&input.industry)
    .bind(
        input
            .accounting_system
            .as_deref()
            .unwrap_or("small_enterprise"),
    )
    .bind(&input.province)
    .bind(&input.city)
    .bind(&input.district)
    .bind(&input.enterprise_type)
    .bind(&input.service_start)
    .bind(&input.service_end)
    .bind(input.enable_year)
    .bind(input.enable_month)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create company: {}", e))?;

    // Create default voucher word for this company (unified "记" prefix)
    let words = vec![("Ji", "记")];
    for (word_code, word_name) in words {
        sqlx::query(
            "INSERT OR IGNORE INTO voucher_words (id, company_id, word_code, word_name) VALUES (?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(word_code)
        .bind(word_name)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create voucher word: {}", e))?;
    }

    // Create enable-period accounting period (use user-specified or current month)
    let now = chrono::Local::now();
    let year = input
        .enable_year
        .unwrap_or_else(|| now.format("%Y").to_string().parse::<i32>().unwrap_or(2026));
    let month = input
        .enable_month
        .unwrap_or_else(|| now.format("%m").to_string().parse::<i32>().unwrap_or(1));

    let start_date = format!("{}-{:02}-01", year, month);
    let end_day = days_in_month(year, month);
    let end_date = format!("{}-{:02}-{}", year, month, end_day);

    sqlx::query(
        "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&id)
    .bind(year)
    .bind(month)
    .bind(&start_date)
    .bind(&end_date)
    .execute(&mut *tx)
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
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(cat_name)
        .bind(cat_code)
        .bind(is_system as i32)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create auxiliary category: {}", e))?;
    }

    // Create default base currency (CNY)
    sqlx::query(
        "INSERT OR IGNORE INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES (?, ?, 'CNY', '人民币', 1.0, 1)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create currency: {}", e))?;

    // Seed account codes based on accounting system
    let accounting_system = input
        .accounting_system
        .as_deref()
        .unwrap_or("small_enterprise");
    Database::insert_account_codes_for_system(&mut tx, &id, accounting_system)
        .await
        .map_err(|e| format!("Failed to seed account codes: {}", e))?;

    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to fetch created company: {}", e))?;

    tx.commit()
        .await
        .map_err(|error| format!("Failed to commit company creation: {error}"))?;

    Ok(company)
}

#[tauri::command]
pub async fn update_company(
    id: String,
    input: CreateCompanyInput,
    db: State<'_, Database>,
) -> Result<Company, String> {
    log::info!("Updating company: {}", id);

    validate_accounting_system_change(db.pool(), &id, input.accounting_system.as_deref()).await?;

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        UPDATE companies
        SET code = ?, name = ?, tax_id = ?, tax_type = ?, industry = ?, accounting_system = ?,
            province = ?, city = ?, district = ?, enterprise_type = ?, service_start = ?, service_end = ?,
            enable_year = ?, enable_month = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.tax_id)
    .bind(&input.tax_type)
    .bind(&input.industry)
    .bind(&input.accounting_system)
    .bind(&input.province)
    .bind(&input.city)
    .bind(&input.district)
    .bind(&input.enterprise_type)
    .bind(&input.service_start)
    .bind(&input.service_end)
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

async fn validate_accounting_system_change(
    pool: &DbPool,
    company_id: &str,
    requested_accounting_system: Option<&str>,
) -> Result<(), String> {
    let current: Option<String> =
        sqlx::query_scalar("SELECT accounting_system FROM companies WHERE id = ?")
            .bind(company_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取账套会计准则失败: {error}"))?;
    let current = current.ok_or_else(|| "账套不存在".to_string())?;
    let requested = requested_accounting_system
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&current);

    if requested == current {
        return Ok(());
    }

    let initialized_records: i64 = sqlx::query_scalar(
        r#"SELECT
               (SELECT COUNT(*) FROM account_codes WHERE company_id = ?) +
               (SELECT COUNT(*) FROM accounting_periods WHERE company_id = ?) +
               (SELECT COUNT(*) FROM vouchers WHERE company_id = ?)"#,
    )
    .bind(company_id)
    .bind(company_id)
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("检查账套初始化状态失败: {error}"))?;

    if initialized_records > 0 {
        return Err(
            "账套已初始化会计科目或业务数据，不能直接修改会计准则；请使用会计准则迁移功能完成科目映射、期初余额和报表公式校验。"
                .to_string(),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_company(id: String, db: State<'_, Database>) -> Result<(), String> {
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
pub async fn deactivate_company(id: String, db: State<'_, Database>) -> Result<Company, String> {
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
pub async fn activate_company(id: String, db: State<'_, Database>) -> Result<Company, String> {
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
pub async fn restore_company(id: String, db: State<'_, Database>) -> Result<Company, String> {
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
pub async fn permanent_delete_company(id: String, db: State<'_, Database>) -> Result<(), String> {
    log::info!("Permanently deleting company and all related data: {}", id);

    permanently_delete_company_record(&id, db.pool()).await?;

    log::info!("Company permanently deleted: {}", id);
    Ok(())
}

async fn permanently_delete_company_record(id: &str, pool: &DbPool) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to start company deletion transaction: {error}"))?;

    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("Failed to defer company deletion constraints: {error}"))?;

    for statement in [
        "DELETE FROM voucher_logs WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = ?)",
        "DELETE FROM account_balances WHERE period_id IN (SELECT id FROM accounting_periods WHERE company_id = ?)",
        "DELETE FROM initial_balances WHERE period_id IN (SELECT id FROM accounting_periods WHERE company_id = ?)",
    ] {
        sqlx::query(statement)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("Failed to delete indirectly scoped company data: {error}"))?;
    }

    let company_tables: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT schema_table.name
        FROM sqlite_master AS schema_table
        JOIN pragma_table_info(schema_table.name) AS column_info
          ON column_info.name = 'company_id'
        WHERE schema_table.type = 'table'
          AND schema_table.name <> 'companies'
          AND schema_table.name NOT LIKE 'sqlite_%'
        ORDER BY schema_table.name
        "#,
    )
    .fetch_all(&mut *tx)
    .await
    .map_err(|error| format!("Failed to discover company-scoped tables: {error}"))?;

    for table in company_tables {
        if table.is_empty()
            || !table
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err(format!("Unsafe company-scoped table identifier: {table}"));
        }
        let statement = format!("DELETE FROM \"{table}\" WHERE company_id = ?");
        sqlx::query(&statement)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("Failed to delete company data from {table}: {error}"))?;
    }

    sqlx::query("DELETE FROM companies WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("Failed to delete company: {error}"))?;

    tx.commit()
        .await
        .map_err(|error| format!("Failed to commit company deletion: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_deleted_companies(db: State<'_, Database>) -> Result<Vec<Company>, String> {
    log::info!("Fetching soft-deleted companies");

    let companies: Vec<Company> =
        sqlx::query_as("SELECT * FROM companies WHERE is_deleted = 1 ORDER BY deleted_at DESC")
            .fetch_all(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} deleted companies", companies.len());
    Ok(companies)
}

#[tauri::command]
pub async fn cleanup_expired_companies(db: State<'_, Database>) -> Result<u64, String> {
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
        permanently_delete_company_record(id, db.pool()).await?;
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

#[cfg(test)]
mod tests {
    use super::{
        create_company_record, permanently_delete_company_record, validate_accounting_system_change,
    };
    use crate::db::{CreateCompanyInput, Database};

    fn company_input(code: &str) -> CreateCompanyInput {
        CreateCompanyInput {
            code: code.to_string(),
            name: "事务测试企业".to_string(),
            tax_id: Some("91310000TEST000001".to_string()),
            tax_type: Some("small".to_string()),
            industry: Some("软件和信息技术服务业".to_string()),
            accounting_system: Some("small_enterprise".to_string()),
            province: Some("上海市".to_string()),
            city: Some("上海市".to_string()),
            district: Some("浦东新区".to_string()),
            enterprise_type: Some("有限责任公司".to_string()),
            service_start: Some("2026-01-01".to_string()),
            service_end: Some("2026-12-31".to_string()),
            enable_year: Some(2026),
            enable_month: Some(1),
        }
    }

    async fn test_database(name: &str) -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-company-{name}-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        (database, data_dir)
    }

    async fn cleanup(database: Database, data_dir: std::path::PathBuf) {
        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn company_creation_rolls_back_every_seed_record_when_initialization_fails() {
        let (database, data_dir) = test_database("rollback").await;
        sqlx::query(
            "CREATE TRIGGER reject_base_currency BEFORE INSERT ON currencies BEGIN SELECT RAISE(ABORT, 'forced currency failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs failure trigger");

        let result = create_company_record(company_input("ROLLBACK"), database.pool()).await;
        assert!(
            result.is_err(),
            "forced initialization failure must surface"
        );

        for table in [
            "companies",
            "voucher_words",
            "accounting_periods",
            "auxiliary_categories",
            "currencies",
            "account_codes",
        ] {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(database.pool())
                .await
                .expect("counts initialization records");
            assert_eq!(count, 0, "failed creation left records in {table}");
        }

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn initialized_company_cannot_silently_switch_accounting_system() {
        let (database, data_dir) = test_database("accounting-system-guard").await;
        let company = create_company_record(company_input("STANDARD"), database.pool())
            .await
            .expect("creates complete company");

        let error =
            validate_accounting_system_change(database.pool(), &company.id, Some("non_profit"))
                .await
                .expect_err("initialized chart must block a silent standard switch");

        assert!(error.contains("会计准则迁移"));
        let persisted: String =
            sqlx::query_scalar("SELECT accounting_system FROM companies WHERE id = ?")
                .bind(&company.id)
                .fetch_one(database.pool())
                .await
                .expect("reads current accounting system");
        assert_eq!(persisted, "small_enterprise");

        cleanup(database, data_dir).await;
    }

    #[tokio::test]
    async fn permanent_deletion_covers_new_company_scoped_business_tables() {
        let (database, data_dir) = test_database("delete").await;
        let company = create_company_record(company_input("DELETE"), database.pool())
            .await
            .expect("creates complete company");

        sqlx::query(
            "INSERT INTO account_transfers (id, company_id, period, transfer_date, from_account, to_account, amount) VALUES ('transfer-1', ?, '2026-01', '2026-01-10', '1002-01', '1002-02', 100)",
        )
        .bind(&company.id)
        .execute(database.pool())
        .await
        .expect("creates newly added business record");

        permanently_delete_company_record(&company.id, database.pool())
            .await
            .expect("deletes company and all scoped records");

        let company_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM companies WHERE id = ?")
            .bind(&company.id)
            .fetch_one(database.pool())
            .await
            .expect("counts companies");
        let transfer_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM account_transfers WHERE company_id = ?")
                .bind(&company.id)
                .fetch_one(database.pool())
                .await
                .expect("counts transfers");
        assert_eq!(company_count, 0);
        assert_eq!(transfer_count, 0);

        cleanup(database, data_dir).await;
    }
}
