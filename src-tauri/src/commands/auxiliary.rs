use crate::db::{
    AccountAuxiliaryLink, AuxiliaryCategory, AuxiliaryItem, CreateAuxiliaryCategoryInput,
    CreateAuxiliaryItemInput, Database, LinkAccountAuxiliaryInput, VoucherEntryAuxiliary,
};
use tauri::State;

// ─── Auxiliary Categories ──────────────────────────────────────────

#[tauri::command]
pub async fn get_auxiliary_categories(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AuxiliaryCategory>, String> {
    sqlx::query_as(
        "SELECT * FROM auxiliary_categories WHERE company_id = ? ORDER BY sort_order, name",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询辅助核算类别失败: {}", e))
}

#[tauri::command]
pub async fn create_auxiliary_category(
    input: CreateAuxiliaryCategoryInput,
    db: State<'_, Database>,
) -> Result<AuxiliaryCategory, String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO auxiliary_categories (id, company_id, name, code, is_system, sort_order) VALUES (?, ?, ?, ?, 0, ?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.name)
    .bind(&input.code)
    .bind(input.sort_order)
    .execute(db.pool())
    .await
    .map_err(|e| format!("创建辅助核算类别失败: {}", e))?;

    let result: AuxiliaryCategory =
        sqlx::query_as("SELECT * FROM auxiliary_categories WHERE id = ?")
            .bind(&id)
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("查询新创建的辅助核算类别失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn update_auxiliary_category(
    id: String,
    input: CreateAuxiliaryCategoryInput,
    db: State<'_, Database>,
) -> Result<AuxiliaryCategory, String> {
    let category: Option<(i64,)> = sqlx::query_as(
        "SELECT is_system FROM auxiliary_categories WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("查询辅助核算类别失败: {}", e))?;

    match category {
        Some((1,)) => return Err("系统预置辅助核算类别不能修改".to_string()),
        Some(_) => {}
        None => return Err("辅助核算类别不存在或不属于当前账套".to_string()),
    }

    sqlx::query(
        "UPDATE auxiliary_categories SET name = ?, code = ?, sort_order = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&input.name)
    .bind(&input.code)
    .bind(input.sort_order)
    .bind(&id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新辅助核算类别失败: {}", e))?;

    let result: AuxiliaryCategory =
        sqlx::query_as("SELECT * FROM auxiliary_categories WHERE id = ?")
            .bind(&id)
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("查询更新后的辅助核算类别失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_auxiliary_category(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let category: Option<(i64,)> = sqlx::query_as(
        "SELECT is_system FROM auxiliary_categories WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("查询辅助核算类别失败: {}", e))?;

    match category {
        Some((1,)) => return Err("系统预置辅助核算类别不能删除".to_string()),
        Some(_) => {}
        None => return Err("辅助核算类别不存在或不属于当前账套".to_string()),
    }

    // Check for items linked to this category
    let item_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM auxiliary_items WHERE category_id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if item_count.0 > 0 {
        return Err("该类别下存在辅助核算项目，不能删除".to_string());
    }

    // Check for account links
    let link_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM account_auxiliary_links WHERE auxiliary_category_id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if link_count.0 > 0 {
        return Err("该类别已被科目关联，不能删除".to_string());
    }

    sqlx::query("DELETE FROM auxiliary_categories WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("删除辅助核算类别失败: {}", e))?;

    Ok(())
}

// ─── Auxiliary Items ───────────────────────────────────────────────

#[tauri::command]
pub async fn get_auxiliary_items(
    category_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AuxiliaryItem>, String> {
    sqlx::query_as(
        "SELECT * FROM auxiliary_items WHERE category_id = ? AND company_id = ? ORDER BY code",
    )
    .bind(&category_id)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询辅助核算项目失败: {}", e))
}

#[tauri::command]
pub async fn get_all_auxiliary_items(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AuxiliaryItem>, String> {
    sqlx::query_as("SELECT * FROM auxiliary_items WHERE company_id = ? ORDER BY code")
        .bind(&company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("查询辅助核算项目失败: {}", e))
}

#[tauri::command]
pub async fn create_auxiliary_item(
    input: CreateAuxiliaryItemInput,
    db: State<'_, Database>,
) -> Result<AuxiliaryItem, String> {
    // Verify category exists
    let cat: Option<(String,)> = sqlx::query_as("SELECT id FROM auxiliary_categories WHERE id = ?")
        .bind(&input.category_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("查询失败: {}", e))?;

    if cat.is_none() {
        return Err("辅助核算类别不存在".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO auxiliary_items (id, category_id, company_id, code, name, is_enabled, remarks) VALUES (?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(&id)
    .bind(&input.category_id)
    .bind(&input.company_id)
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.remarks)
    .execute(db.pool())
    .await
    .map_err(|e| format!("创建辅助核算项目失败: {}", e))?;

    let result: AuxiliaryItem = sqlx::query_as("SELECT * FROM auxiliary_items WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询新创建的辅助核算项目失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn update_auxiliary_item(
    id: String,
    input: CreateAuxiliaryItemInput,
    db: State<'_, Database>,
) -> Result<AuxiliaryItem, String> {
    sqlx::query(
        "UPDATE auxiliary_items SET category_id = ?, code = ?, name = ?, remarks = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&input.category_id)
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.remarks)
    .bind(&id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新辅助核算项目失败: {}", e))?;

    let result: AuxiliaryItem = sqlx::query_as("SELECT * FROM auxiliary_items WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询更新后的辅助核算项目失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_auxiliary_item(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    // Check if item is used in any voucher entry
    let used: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM voucher_entry_auxiliaries WHERE auxiliary_item_id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if used.0 > 0 {
        return Err("该辅助核算项目已在凭证中使用，不能删除".to_string());
    }

    sqlx::query("DELETE FROM auxiliary_items WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("删除辅助核算项目失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_auxiliary_item(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE auxiliary_items SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("切换辅助核算项目状态失败: {}", e))?;

    Ok(())
}

// ─── Account-Auxiliary Links ───────────────────────────────────────

#[tauri::command]
pub async fn get_account_auxiliary_links(
    account_code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountAuxiliaryLink>, String> {
    sqlx::query_as(
        "SELECT * FROM account_auxiliary_links WHERE account_code = ? AND company_id = ?",
    )
    .bind(&account_code)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询科目辅助核算关联失败: {}", e))
}

#[tauri::command]
pub async fn link_account_auxiliary(
    input: LinkAccountAuxiliaryInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO account_auxiliary_links (id, account_code, company_id, auxiliary_category_id, is_required) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.account_code)
    .bind(&input.company_id)
    .bind(&input.auxiliary_category_id)
    .bind(input.is_required)
    .execute(db.pool())
    .await
    .map_err(|e| format!("关联科目辅助核算失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn unlink_account_auxiliary(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM account_auxiliary_links WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("解除科目辅助核算关联失败: {}", e))?;

    Ok(())
}

// ─── Voucher Entry Auxiliaries ─────────────────────────────────────

#[tauri::command]
pub async fn get_voucher_entry_auxiliaries(
    entry_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherEntryAuxiliary>, String> {
    sqlx::query_as("SELECT * FROM voucher_entry_auxiliaries WHERE entry_id = ?")
        .bind(&entry_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("查询凭证分录辅助核算失败: {}", e))
}

// ─── Auxiliary Ledger Queries ──────────────────────────────────────

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AuxiliaryLedgerRow {
    pub date: String,
    pub voucher_number: String,
    pub summary: String,
    pub direction: String,
    pub amount: f64,
}

#[tauri::command]
pub async fn get_auxiliary_ledger(
    auxiliary_item_id: String,
    company_id: String,
    period_id: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AuxiliaryLedgerRow>, String> {
    let mut sql = String::from(
        "SELECT v.voucher_date as date, v.voucher_number, e.summary, e.direction, e.amount
         FROM voucher_entry_auxiliaries a
         JOIN voucher_entries e ON a.entry_id = e.id
         JOIN vouchers v ON e.voucher_id = v.id
         WHERE a.auxiliary_item_id = ? AND v.status = 'approved' AND v.company_id = ?",
    );
    let mut binds: Vec<String> = vec![auxiliary_item_id, company_id];

    if let Some(ref pid) = period_id {
        sql.push_str(" AND v.period_id = ?");
        binds.push(pid.clone());
    }
    if let Some(ref sd) = start_date {
        sql.push_str(" AND v.voucher_date >= ?");
        binds.push(sd.clone());
    }
    if let Some(ref ed) = end_date {
        sql.push_str(" AND v.voucher_date <= ?");
        binds.push(ed.clone());
    }

    sql.push_str(" ORDER BY v.voucher_date, v.sequence_num");

    let mut query = sqlx::query_as::<_, AuxiliaryLedgerRow>(&sql);
    for b in &binds {
        query = query.bind(b);
    }

    query
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("查询辅助核算明细账失败: {}", e))
}

#[derive(Debug, serde::Serialize)]
pub struct AuxiliaryBalanceRow {
    pub auxiliary_item_name: String,
    pub auxiliary_item_code: String,
    pub beginning_debit: f64,
    pub beginning_credit: f64,
    pub period_debit: f64,
    pub period_credit: f64,
    pub ending_debit: f64,
    pub ending_credit: f64,
}

#[tauri::command]
pub async fn get_auxiliary_balance(
    auxiliary_category_id: String,
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AuxiliaryBalanceRow>, String> {
    // Get all items in this category, scoped by company
    let items: Vec<AuxiliaryItem> = sqlx::query_as(
        "SELECT * FROM auxiliary_items WHERE category_id = ? AND company_id = ? AND is_enabled = 1 ORDER BY code",
    )
    .bind(&auxiliary_category_id)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询辅助核算项目失败: {}", e))?;

    let mut rows = Vec::new();
    for item in &items {
        // Sum period amounts by direction
        let debit: (Option<f64>,) = sqlx::query_as(
            "SELECT COALESCE(SUM(e.amount), 0)
             FROM voucher_entry_auxiliaries a
             JOIN voucher_entries e ON a.entry_id = e.id
             JOIN vouchers v ON e.voucher_id = v.id
             WHERE a.auxiliary_item_id = ? AND v.period_id = ? AND v.company_id = ? AND e.direction = 'debit' AND v.status = 'approved'",
        )
        .bind(&item.id)
        .bind(&period_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询借方发生额失败: {}", e))?;

        let credit: (Option<f64>,) = sqlx::query_as(
            "SELECT COALESCE(SUM(e.amount), 0)
             FROM voucher_entry_auxiliaries a
             JOIN voucher_entries e ON a.entry_id = e.id
             JOIN vouchers v ON e.voucher_id = v.id
             WHERE a.auxiliary_item_id = ? AND v.period_id = ? AND v.company_id = ? AND e.direction = 'credit' AND v.status = 'approved'",
        )
        .bind(&item.id)
        .bind(&period_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询贷方发生额失败: {}", e))?;

        let period_debit = debit.0.unwrap_or(0.0);
        let period_credit = credit.0.unwrap_or(0.0);

        rows.push(AuxiliaryBalanceRow {
            auxiliary_item_name: item.name.clone(),
            auxiliary_item_code: item.code.clone(),
            beginning_debit: 0.0,
            beginning_credit: 0.0,
            period_debit,
            period_credit,
            ending_debit: period_debit,
            ending_credit: period_credit,
        });
    }

    Ok(rows)
}

#[derive(Debug, serde::Serialize)]
pub struct AccountAuxiliarySetup {
    pub account_code: String,
    pub account_name: String,
    pub categories: Vec<AuxiliaryCategoryLink>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AuxiliaryCategoryLink {
    pub link_id: String,
    pub category_id: String,
    pub category_name: String,
    pub category_code: String,
    pub is_required: i32,
}

#[tauri::command]
pub async fn get_account_auxiliary_setup(
    account_code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<AccountAuxiliarySetup>, String> {
    let account: Option<(String, String)> =
        sqlx::query_as("SELECT code, name FROM account_codes WHERE code = ? AND company_id = ?")
            .bind(&account_code)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("查询科目失败: {}", e))?;

    let (code, name) = match account {
        Some(a) => a,
        None => return Ok(None),
    };

    let links: Vec<AuxiliaryCategoryLink> = sqlx::query_as(
        "SELECT l.id as link_id, c.id as category_id, c.name as category_name, c.code as category_code, l.is_required
         FROM account_auxiliary_links l
         JOIN auxiliary_categories c ON l.auxiliary_category_id = c.id
         WHERE l.account_code = ? AND l.company_id = ?
         ORDER BY c.sort_order",
    )
    .bind(&code)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询科目辅助核算设置失败: {}", e))?;

    Ok(Some(AccountAuxiliarySetup {
        account_code: code,
        account_name: name,
        categories: links,
    }))
}
