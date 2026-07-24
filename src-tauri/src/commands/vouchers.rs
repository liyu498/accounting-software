use crate::db::{
    CreateVoucherEntryInput, CreateVoucherInput, Database, UpdateVoucherInput, Voucher,
    VoucherEntry, VoucherLog,
};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Simple command to read a text file (used by import dialog for JSON files)
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("无法读取文件: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoucherWithEntries {
    #[serde(flatten)]
    pub voucher: Voucher,
    pub entries: Vec<VoucherEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoucherListResponse {
    pub vouchers: Vec<VoucherWithEntries>,
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct VoucherQueryInput {
    pub company_id: String,
    pub period_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub voucher_word_id: Option<String>,
    pub account_code: Option<String>,
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

#[tauri::command]
pub async fn get_vouchers(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherWithEntries>, String> {
    log::info!("Fetching vouchers for company: {}", company_id);

    let vouchers: Vec<Voucher> = sqlx::query_as(
        "SELECT * FROM vouchers WHERE company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY voucher_date DESC, sequence_num DESC",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::with_capacity(vouchers.len());
    for voucher in vouchers {
        let entries = fetch_entries(&voucher.id, db.pool()).await?;
        result.push(VoucherWithEntries { voucher, entries });
    }

    log::info!("Found {} vouchers with entries", result.len());
    Ok(result)
}

#[tauri::command]
pub async fn query_vouchers(
    input: VoucherQueryInput,
    db: State<'_, Database>,
) -> Result<VoucherListResponse, String> {
    log::info!("Querying vouchers for company: {}", input.company_id);

    let page = input.page.unwrap_or(1).max(1);
    let page_size = input.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    // Build parameterized query to avoid SQL injection
    let mut conditions = vec!["v.company_id = ?".to_string(), "(v.is_deleted = 0 OR v.is_deleted IS NULL)".to_string()];
    let mut param_index = 2u32; // $1 is company_id

    if input.period_id.is_some() {
        conditions.push(format!("v.period_id = ${}", param_index));
        param_index += 1;
    }
    if input.start_date.is_some() {
        conditions.push(format!("v.voucher_date >= ${}", param_index));
        param_index += 1;
    }
    if input.end_date.is_some() {
        conditions.push(format!("v.voucher_date <= ${}", param_index));
        param_index += 1;
    }
    if input.status.is_some() {
        conditions.push(format!("v.status = ${}", param_index));
        param_index += 1;
    }
    if input.voucher_word_id.is_some() {
        conditions.push(format!("v.voucher_word_id = ${}", param_index));
        param_index += 1;
    }
    if input.keyword.is_some() {
        conditions.push(format!("(v.voucher_number LIKE ${} OR v.summary LIKE ${})", param_index, param_index));
        param_index += 1;
    }
    if input.account_code.is_some() {
        conditions.push(format!(
            "EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id AND ve.account_code = ${})",
            param_index
        ));
        param_index += 1;
    }

    let _ = param_index;

    let where_clause = format!(" WHERE {}", conditions.join(" AND "));

    // Count query
    let count_sql = format!("SELECT COUNT(*) FROM vouchers v{}", where_clause);
    let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql);
    count_query = count_query.bind(&input.company_id);
    if let Some(ref v) = input.period_id { count_query = count_query.bind(v); }
    if let Some(ref v) = input.start_date { count_query = count_query.bind(v); }
    if let Some(ref v) = input.end_date { count_query = count_query.bind(v); }
    if let Some(ref v) = input.status { count_query = count_query.bind(v); }
    if let Some(ref v) = input.voucher_word_id { count_query = count_query.bind(v); }
    let keyword_pattern = input.keyword.as_ref().map(|v| format!("%{}%", v));
    if let Some(ref p) = keyword_pattern {
        count_query = count_query.bind(p).bind(p);
    }
    if let Some(ref v) = input.account_code { count_query = count_query.bind(v); }

    let total: (i64,) = count_query
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Count error: {}", e))?;

    // Data query - SQLite uses ? placeholders, not $N
    // Rebuild with ? placeholders for SQLite compatibility
    let mut where_params: Vec<String> = vec![input.company_id.clone()];
    let mut sqlite_conditions = vec!["v.company_id = ?".to_string(), "(v.is_deleted = 0 OR v.is_deleted IS NULL)".to_string()];

    if let Some(ref v) = input.period_id {
        sqlite_conditions.push("v.period_id = ?".to_string());
        where_params.push(v.clone());
    }
    if let Some(ref v) = input.start_date {
        sqlite_conditions.push("v.voucher_date >= ?".to_string());
        where_params.push(v.clone());
    }
    if let Some(ref v) = input.end_date {
        sqlite_conditions.push("v.voucher_date <= ?".to_string());
        where_params.push(v.clone());
    }
    if let Some(ref v) = input.status {
        sqlite_conditions.push("v.status = ?".to_string());
        where_params.push(v.clone());
    }
    if let Some(ref v) = input.voucher_word_id {
        sqlite_conditions.push("v.voucher_word_id = ?".to_string());
        where_params.push(v.clone());
    }
    if let Some(ref v) = input.keyword {
        sqlite_conditions.push("(v.voucher_number LIKE ? OR v.summary LIKE ?)".to_string());
        let pattern = format!("%{}%", v);
        where_params.push(pattern.clone());
        where_params.push(pattern);
    }
    if let Some(ref v) = input.account_code {
        sqlite_conditions.push(
            "EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id AND ve.account_code = ?)".to_string(),
        );
        where_params.push(v.clone());
    }

    let sqlite_where = format!(" WHERE {}", sqlite_conditions.join(" AND "));
    let data_sql = format!(
        "SELECT v.* FROM vouchers v{} ORDER BY v.voucher_date ASC, v.sequence_num ASC LIMIT ? OFFSET ?",
        sqlite_where
    );

    let mut data_query = sqlx::query_as::<_, Voucher>(&data_sql);
    for param in &where_params {
        data_query = data_query.bind(param);
    }
    data_query = data_query.bind(page_size).bind(offset);

    let vouchers = data_query
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Query error: {}", e))?;

    let mut result = Vec::with_capacity(vouchers.len());
    for voucher in vouchers {
        let entries = fetch_entries(&voucher.id, db.pool()).await?;
        result.push(VoucherWithEntries { voucher, entries });
    }

    log::info!("Query returned {} / {} total", result.len(), total.0);
    Ok(VoucherListResponse {
        vouchers: result,
        total: total.0,
    })
}

#[tauri::command]
pub async fn get_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<VoucherWithEntries>, String> {
    log::info!("Fetching voucher: {} for company: {}", id, company_id);

    let voucher: Option<Voucher> = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    match voucher {
        Some(v) => {
            let entries = fetch_entries(&id, db.pool()).await?;
            Ok(Some(VoucherWithEntries { voucher: v, entries }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn create_voucher(
    input: CreateVoucherInput,
    db: State<'_, Database>,
) -> Result<VoucherWithEntries, String> {
    log::info!("Creating voucher for company: {}", input.company_id);

    // Validate period exists and is open
    let period: Option<(String, String, i32, i32)> = sqlx::query_as(
        "SELECT id, status, period_year, period_month FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(&input.period_id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (period_year, period_month) = match period {
        None => return Err("会计期间不存在".to_string()),
        Some((_, status, _, _)) if status != "open" => return Err("该会计期间已结账，不能新增凭证".to_string()),
        Some((_, _, year, month)) => (year, month),
    };
    let suggestion_period = format!("{}-{:02}", period_year, period_month);

    // Validate voucher word exists
    let word: Option<(String, String)> = sqlx::query_as(
        "SELECT word_code, word_name FROM voucher_words WHERE id = ? AND company_id = ?",
    )
    .bind(&input.voucher_word_id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (_word_code, word_name) = word.ok_or_else(|| "凭证字不存在".to_string())?;

    // Validate date format and falls within period
    validate_voucher_date(&input.voucher_date, &input.period_id, db.pool()).await?;

    // Validate entries: direction-based debit/credit balance
    let (total_debit, total_credit) = validate_entries(&input.entries)?;

    // Validate account codes exist and are detail (leaf) accounts
    for (i, entry) in input.entries.iter().enumerate() {
        let code_info: Option<(i32,)> = sqlx::query_as(
            "SELECT is_detail FROM account_codes WHERE code = ? AND company_id = ?",
        )
        .bind(&entry.account_code)
        .bind(&input.company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        match code_info {
            None => return Err(format!("科目编码 {} 不存在", entry.account_code)),
            Some((is_detail,)) if is_detail == 0 => {
                return Err(format!("第{}行: 科目 {} 是汇总科目，不能直接使用", i + 1, entry.account_code));
            }
            _ => {}
        }
    }

    // Voucher number: use provided or auto-generate
    let (voucher_number, sequence_num) = if let Some(ref vn) = input.voucher_number {
        // Extract sequence number from user-provided number (e.g., "记字第005号" → 5)
        let seq = vn
            .trim_end_matches('号')
            .split('第')
            .last()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(1);
        (vn.clone(), seq)
    } else {
        // Auto-number: get next sequence for this period + voucher word
        let last_seq: Option<(Option<i32>,)> = sqlx::query_as(
            "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND voucher_word_id = ? AND company_id = ?",
        )
        .bind(&input.period_id)
        .bind(&input.voucher_word_id)
        .bind(&input.company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        let seq = match last_seq {
            Some((Some(n),)) => n + 1,
            _ => 1,
        };
        (format!("{}字第{:03}号", word_name, seq), seq)
    };

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    sqlx::query(
        r#"
        INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit, version,
            created_by, created_at, reference_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&input.voucher_word_id)
    .bind(&voucher_number)
    .bind(sequence_num)
    .bind(&input.voucher_date)
    .bind(&input.summary)
    .bind(input.attachment_count.unwrap_or(0))
    .bind(total_debit)
    .bind(total_credit)
    .bind(&input.created_by)
    .bind(&now)
    .bind(&input.reference_number)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create voucher: {}", e))?;

    // Insert entries
    for (line_num, entry) in input.entries.iter().enumerate() {
        let entry_id = uuid::Uuid::new_v4().to_string();
        // Build full hierarchical account name for display
        let display_name = build_full_account_name(&entry.account_code, &input.company_id, &mut *tx).await;
        sqlx::query(
            r#"
            INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                quantity, unit_price, unit, currency_id, exchange_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry_id)
        .bind(&id)
        .bind(line_num as i32 + 1)
        .bind(&entry.account_code)
        .bind(&display_name)
        .bind(&entry.direction)
        .bind(entry.amount)
        .bind(&entry.summary)
        .bind(&entry.auxiliary_type)
        .bind(&entry.auxiliary_id)
        .bind(&entry.doc_number)
        .bind(entry.quantity)
        .bind(entry.unit_price)
        .bind(&entry.unit)
        .bind(&entry.currency_id)
        .bind(entry.exchange_rate)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create voucher entry: {}", e))?;

        // Insert auxiliary accounting links if provided
        if let Some(ref aux_items) = entry.auxiliary_items {
            for aux in aux_items {
                let aux_id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO voucher_entry_auxiliaries (id, entry_id, auxiliary_category_id, auxiliary_item_id) VALUES (?, ?, ?, ?)",
                )
                .bind(&aux_id)
                .bind(&entry_id)
                .bind(&aux.auxiliary_category_id)
                .bind(&aux.auxiliary_item_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to create entry auxiliary: {}", e))?;
            }
        }
    }

    if let Some(ai_suggestion_id) = input.ai_suggestion_id.as_deref() {
        let linked = sqlx::query(
            r#"
            UPDATE automation_jobs
            SET
                generated_voucher_id = ?,
                generated_voucher_number = ?,
                status = 'completed',
                updated_at = datetime('now')
            WHERE id = ?
              AND company_id = ?
              AND period = ?
              AND job_type = 'voucher_suggestion'
              AND status = 'confirmed'
              AND generated_voucher_id IS NULL
            "#,
        )
        .bind(&id)
        .bind(&voucher_number)
        .bind(ai_suggestion_id)
        .bind(&input.company_id)
        .bind(&suggestion_period)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to link AI voucher suggestion: {}", e))?;

        if linked.rows_affected() != 1 {
            return Err("AI 凭证建议不存在、未确认、账期不匹配或已关联其他凭证".to_string());
        }
    }

    // Audit log
    log_voucher_operation(&id, "create", None, Some(&id), input.created_by.as_deref(), &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let entries = fetch_entries(&id, db.pool()).await?;

    log::info!("Voucher created: {} ({})", voucher_number, id);
    Ok(VoucherWithEntries { voucher, entries })
}

#[tauri::command]
pub async fn update_voucher(
    input: UpdateVoucherInput,
    company_id: String,
    db: State<'_, Database>,
) -> Result<VoucherWithEntries, String> {
    log::info!("Updating voucher: {} for company: {}", input.id, company_id);

    let now = chrono::Utc::now().to_rfc3339();

    // Fetch existing voucher with company isolation
    let existing: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "凭证不存在或不属于当前公司".to_string())?;

    // Check period is open
    if existing.status != "draft" {
        return Err("只能修改草稿状态的凭证".to_string());
    }

    // Optimistic lock check
    if let Some(version) = input.version {
        if version != existing.version {
            return Err(format!(
                "凭证已被他人修改（版本号不匹配: 期望 {}, 实际 {}），请刷新后重试",
                existing.version, version
            ));
        }
    }

    // Check period status
    let period_status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM accounting_periods WHERE id = ?",
    )
    .bind(&existing.period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((status,)) = period_status {
        if status != "open" {
            return Err("该会计期间已结账，不能修改凭证".to_string());
        }
    }

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Capture before state for audit
    let before_data = serde_json::to_string(&existing).unwrap_or_default();

    // Update voucher fields
    let new_version = existing.version + 1;

    if let Some(ref voucher_date) = input.voucher_date {
        sqlx::query("UPDATE vouchers SET voucher_date = ?, version = ?, modified_by = ?, modified_at = ? WHERE id = ? AND company_id = ?")
            .bind(voucher_date)
            .bind(new_version)
            .bind(&input.modified_by)
            .bind(&now)
            .bind(&input.id)
            .bind(&company_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update voucher date: {}", e))?;
    }

    if let Some(ref summary) = input.summary {
        sqlx::query("UPDATE vouchers SET summary = ?, version = ?, modified_by = ?, modified_at = ? WHERE id = ? AND company_id = ?")
            .bind(summary)
            .bind(new_version)
            .bind(&input.modified_by)
            .bind(&now)
            .bind(&input.id)
            .bind(&company_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update summary: {}", e))?;
    }

    if let Some(attachment_count) = input.attachment_count {
        sqlx::query("UPDATE vouchers SET attachment_count = ?, version = ?, modified_by = ?, modified_at = ? WHERE id = ? AND company_id = ?")
            .bind(attachment_count)
            .bind(new_version)
            .bind(&input.modified_by)
            .bind(&now)
            .bind(&input.id)
            .bind(&company_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update attachment count: {}", e))?;
    }

    if let Some(ref reference_number) = input.reference_number {
        sqlx::query("UPDATE vouchers SET reference_number = ?, version = ?, modified_by = ?, modified_at = ? WHERE id = ? AND company_id = ?")
            .bind(reference_number)
            .bind(new_version)
            .bind(&input.modified_by)
            .bind(&now)
            .bind(&input.id)
            .bind(&company_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update reference number: {}", e))?;
    }

    // Update entries if provided
    if let Some(ref entries) = input.entries {
        let (total_debit, total_credit) = validate_entries(entries)?;

        // Validate account codes
        for (i, entry) in entries.iter().enumerate() {
            let code_info: Option<(i32,)> = sqlx::query_as(
                "SELECT is_detail FROM account_codes WHERE code = ? AND company_id = ?",
            )
            .bind(&entry.account_code)
            .bind(&existing.company_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            match code_info {
                None => return Err(format!("科目编码 {} 不存在", entry.account_code)),
                Some((is_detail,)) if is_detail == 0 => {
                    return Err(format!("第{}行: 科目 {} 是汇总科目，不能直接使用", i + 1, entry.account_code));
                }
                _ => {}
            }
        }

        // Delete existing entries
        sqlx::query("DELETE FROM voucher_entries WHERE voucher_id = ?")
            .bind(&input.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to delete old entries: {}", e))?;

        // Insert new entries
        for (line_num, entry) in entries.iter().enumerate() {
            let entry_id = uuid::Uuid::new_v4().to_string();
            let display_name = build_full_account_name(&entry.account_code, &company_id, &mut *tx).await;
            sqlx::query(
                r#"
                INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                    direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                    quantity, unit_price, unit, currency_id, exchange_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&entry_id)
            .bind(&input.id)
            .bind(line_num as i32 + 1)
            .bind(&entry.account_code)
            .bind(&display_name)
            .bind(&entry.direction)
            .bind(entry.amount)
            .bind(&entry.summary)
            .bind(&entry.auxiliary_type)
            .bind(&entry.auxiliary_id)
            .bind(&entry.doc_number)
            .bind(entry.quantity)
            .bind(entry.unit_price)
            .bind(&entry.unit)
            .bind(&entry.currency_id)
            .bind(entry.exchange_rate)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to create entry: {}", e))?;

            if let Some(ref aux_items) = entry.auxiliary_items {
                for aux in aux_items {
                    let aux_id = uuid::Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO voucher_entry_auxiliaries (id, entry_id, auxiliary_category_id, auxiliary_item_id) VALUES (?, ?, ?, ?)",
                    )
                    .bind(&aux_id)
                    .bind(&entry_id)
                    .bind(&aux.auxiliary_category_id)
                    .bind(&aux.auxiliary_item_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| format!("Failed to create entry auxiliary: {}", e))?;
                }
            }
        }

        // Update totals and version
        sqlx::query(
            "UPDATE vouchers SET total_debit = ?, total_credit = ?, version = ?, modified_by = ?, modified_at = ? WHERE id = ? AND company_id = ?",
        )
        .bind(total_debit)
        .bind(total_credit)
        .bind(new_version)
        .bind(&input.modified_by)
        .bind(&now)
        .bind(&input.id)
        .bind(&company_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update totals: {}", e))?;
    }

    // Audit log
    let after_voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&company_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let after_data = serde_json::to_string(&after_voucher).unwrap_or_default();

    log_voucher_operation_raw(&input.id, "update", Some(&before_data), Some(&after_data), input.modified_by.as_deref(), &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let entries = fetch_entries(&input.id, db.pool()).await?;

    log::info!("Voucher updated: {}", input.id);
    Ok(VoucherWithEntries { voucher, entries })
}

#[tauri::command]
pub async fn delete_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Soft-deleting voucher: {} for company: {}", id, company_id);

    let voucher: Option<Voucher> = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let v = voucher.ok_or_else(|| "凭证不存在".to_string())?;

    if v.status != "draft" {
        return Err("只能删除草稿状态的凭证".to_string());
    }

    // Check period is open
    let period_status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM accounting_periods WHERE id = ?",
    )
    .bind(&v.period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((status,)) = period_status {
        if status != "open" {
            return Err("该会计期间已结账，不能删除凭证".to_string());
        }
    }

    // Soft delete: set is_deleted = 1, deleted_at = now
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE vouchers SET is_deleted = 1, deleted_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to soft-delete voucher: {}", e))?;

    log::info!("Voucher soft-deleted: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn get_deleted_vouchers(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Voucher>, String> {
    let vouchers: Vec<Voucher> = sqlx::query_as(
        "SELECT * FROM vouchers WHERE company_id = ? AND is_deleted = 1 ORDER BY deleted_at DESC",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(vouchers)
}

#[tauri::command]
pub async fn restore_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Restoring voucher: {} for company: {}", id, company_id);

    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM vouchers WHERE id = ? AND company_id = ? AND is_deleted = 1",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if exists.is_none() {
        return Err("凭证不存在或未被删除".to_string());
    }

    sqlx::query("UPDATE vouchers SET is_deleted = 0, deleted_at = NULL WHERE id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to restore voucher: {}", e))?;

    log::info!("Voucher restored: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn permanent_delete_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Permanently deleting voucher: {} for company: {}", id, company_id);

    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM vouchers WHERE id = ? AND company_id = ? AND is_deleted = 1",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if exists.is_none() {
        return Err("只能永久删除已在回收站的凭证".to_string());
    }

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    sqlx::query("DELETE FROM voucher_logs WHERE voucher_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete voucher logs: {}", e))?;

    sqlx::query("DELETE FROM voucher_entries WHERE voucher_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete voucher entries: {}", e))?;

    sqlx::query("DELETE FROM vouchers WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete voucher: {}", e))?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Voucher permanently deleted: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn approve_voucher(
    id: String,
    approved_by: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Voucher, String> {
    log::info!("Approving voucher: {} for company: {}", id, company_id);

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "凭证不存在或不属于当前公司".to_string())?;

    if voucher.status != "draft" {
        return Err("只能审核草稿状态的凭证".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    let before_data = serde_json::to_string(&voucher).unwrap_or_default();

    sqlx::query(
        "UPDATE vouchers SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&approved_by)
    .bind(&now)
    .bind(&id)
    .bind(&company_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to approve voucher: {}", e))?;

    // Update account balances for all entries
    update_balances_on_approve(&id, &voucher.period_id, &mut tx).await?;

    // Audit log
    let updated: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let after_data = serde_json::to_string(&updated).unwrap_or_default();
    log_voucher_operation_raw(&id, "approve", Some(&before_data), Some(&after_data), Some(&approved_by), &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let result: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Voucher approved: {}", id);
    Ok(result)
}

#[tauri::command]
pub async fn reverse_approve_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Voucher, String> {
    log::info!("Reversing approval for voucher: {} for company: {}", id, company_id);

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "凭证不存在".to_string())?;

    if voucher.status != "approved" {
        return Err("只能反审核已审核的凭证".to_string());
    }

    // Check period is still open
    let period_status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM accounting_periods WHERE id = ?",
    )
    .bind(&voucher.period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((status,)) = period_status {
        if status != "open" {
            return Err("该会计期间已结账，不能反审核凭证".to_string());
        }
    }

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    let before_data = serde_json::to_string(&voucher).unwrap_or_default();

    sqlx::query("UPDATE vouchers SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to reverse approval: {}", e))?;

    // Reverse account balances
    update_balances_on_reverse_approve(&id, &voucher.period_id, &mut tx).await?;

    let updated: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    let after_data = serde_json::to_string(&updated).unwrap_or_default();
    log_voucher_operation_raw(&id, "reverse_approve", Some(&before_data), Some(&after_data), None, &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let result: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Voucher approval reversed: {}", id);
    Ok(result)
}

#[tauri::command]
pub async fn reverse_voucher(
    id: String,
    reversed_by: Option<String>,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Voucher, String> {
    log::info!("Reversing voucher (红冲): {} for company: {}", id, company_id);

    let original: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "凭证不存在或不属于当前公司".to_string())?;

    if original.status == "reversed" {
        return Err("凭证已红冲，不能重复操作".to_string());
    }
    if original.status == "draft" {
        return Err("草稿凭证无需红冲，可直接删除".to_string());
    }

    // Check period is open for the reversal
    let period_status: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM accounting_periods WHERE id = ?",
    )
    .bind(&original.period_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((status,)) = period_status {
        if status != "open" {
            return Err("该会计期间已结账，不能红冲凭证".to_string());
        }
    }

    let entries: Vec<VoucherEntry> = fetch_entries(&id, db.pool()).await?;

    // Auto-number for reversal
    let last_seq: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND voucher_word_id = ?",
    )
    .bind(&original.period_id)
    .bind(&original.voucher_word_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let sequence_num = match last_seq {
        Some((Some(n),)) => n + 1,
        _ => 1,
    };

    // Get word name for voucher number
    let word_name: (String,) = sqlx::query_as(
        "SELECT word_name FROM voucher_words WHERE id = ?",
    )
    .bind(&original.voucher_word_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let reversal_id = uuid::Uuid::new_v4().to_string();
    let reversal_number = format!("{}字第{:03}号", word_name.0, sequence_num);
    let now = chrono::Utc::now().to_rfc3339();

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Create reversal voucher with reversed debit/credit
    sqlx::query(
        r#"
        INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit, version,
            created_by, created_at, reversal_of_id, is_system)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, 1, ?, ?, ?, 1)
        "#,
    )
    .bind(&reversal_id)
    .bind(&original.company_id)
    .bind(&original.period_id)
    .bind(&original.voucher_word_id)
    .bind(&reversal_number)
    .bind(sequence_num)
    .bind(&original.voucher_date)
    .bind(format!("红冲凭证: {}", original.voucher_number))
    .bind(0)
    .bind(original.total_credit) // swap: original credit becomes reversal debit
    .bind(original.total_debit)  // swap: original debit becomes reversal credit
    .bind(reversed_by.as_deref().unwrap_or("system"))
    .bind(&now)
    .bind(&id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create reversal: {}", e))?;

    // Create reversed entries (swap directions)
    for entry in &entries {
        let entry_id = uuid::Uuid::new_v4().to_string();
        let reversed_direction = match entry.direction.as_str() {
            "debit" => "credit",
            "credit" => "debit",
            _ => &entry.direction,
        };

        sqlx::query(
            r#"
            INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                quantity, unit_price, unit, currency_id, exchange_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry_id)
        .bind(&reversal_id)
        .bind(entry.line_num)
        .bind(&entry.account_code)
        .bind(&entry.account_name)
        .bind(reversed_direction)
        .bind(entry.amount)
        .bind(&entry.summary)
        .bind(&entry.auxiliary_type)
        .bind(&entry.auxiliary_id)
        .bind(&entry.doc_number)
        .bind(entry.quantity)
        .bind(entry.unit_price)
        .bind(&entry.unit)
        .bind(&entry.currency_id)
        .bind(entry.exchange_rate)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create reversal entry: {}", e))?;
    }

    // Mark original as reversed
    sqlx::query(
        "UPDATE vouchers SET status = 'reversed', reversed_by = ?, reversed_at = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&reversal_id)
    .bind(&now)
    .bind(&id)
    .bind(&company_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to mark original as reversed: {}", e))?;

    // Update balances for the reversal voucher (it's auto-approved)
    update_balances_on_approve(&reversal_id, &original.period_id, &mut tx).await?;

    // Audit log
    log_voucher_operation_raw(&id, "reverse", None, Some(&reversal_id), reversed_by.as_deref(), &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let result: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&reversal_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Voucher reversed: {} -> {}", id, reversal_id);
    Ok(result)
}

#[tauri::command]
pub async fn copy_voucher(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<VoucherWithEntries, String> {
    log::info!("Copying voucher: {} for company: {}", id, company_id);

    let original: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let entries: Vec<VoucherEntry> = fetch_entries(&id, db.pool()).await?;

    // Auto-number
    let last_seq: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND voucher_word_id = ?",
    )
    .bind(&original.period_id)
    .bind(&original.voucher_word_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let sequence_num = match last_seq {
        Some((Some(n),)) => n + 1,
        _ => 1,
    };

    let word_name: (String,) = sqlx::query_as(
        "SELECT word_name FROM voucher_words WHERE id = ?",
    )
    .bind(&original.voucher_word_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let copy_id = uuid::Uuid::new_v4().to_string();
    let copy_number = format!("{}字第{:03}号", word_name.0, sequence_num);
    let now = chrono::Utc::now().to_rfc3339();

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    sqlx::query(
        r#"
        INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit, version, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, ?)
        "#,
    )
    .bind(&copy_id)
    .bind(&original.company_id)
    .bind(&original.period_id)
    .bind(&original.voucher_word_id)
    .bind(&copy_number)
    .bind(sequence_num)
    .bind(&original.voucher_date)
    .bind(&original.summary)
    .bind(original.attachment_count)
    .bind(original.total_debit)
    .bind(original.total_credit)
    .bind(&original.created_by)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to copy voucher: {}", e))?;

    for entry in &entries {
        let entry_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                quantity, unit_price, unit, currency_id, exchange_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry_id)
        .bind(&copy_id)
        .bind(entry.line_num)
        .bind(&entry.account_code)
        .bind(&entry.account_name)
        .bind(&entry.direction)
        .bind(entry.amount)
        .bind(&entry.summary)
        .bind(&entry.auxiliary_type)
        .bind(&entry.auxiliary_id)
        .bind(&entry.doc_number)
        .bind(entry.quantity)
        .bind(entry.unit_price)
        .bind(&entry.unit)
        .bind(&entry.currency_id)
        .bind(entry.exchange_rate)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to copy entry: {}", e))?;
    }

    log_voucher_operation_raw(&id, "copy", Some(&id), Some(&copy_id), None, &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
        .bind(&copy_id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let copied_entries = fetch_entries(&copy_id, db.pool()).await?;

    log::info!("Voucher copied: {} -> {}", id, copy_id);
    Ok(VoucherWithEntries { voucher, entries: copied_entries })
}

#[tauri::command]
pub async fn get_voucher_entries(
    voucher_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherEntry>, String> {
    log::info!("Fetching entries for voucher: {}", voucher_id);
    fetch_entries(&voucher_id, db.pool()).await
}

#[tauri::command]
pub async fn reorganize_voucher_numbers(
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Reorganizing voucher numbers for period: {} company: {}", period_id, company_id);

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Get all voucher words for this period
    let words: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT DISTINCT vw.id, vw.word_name
        FROM voucher_words vw
        INNER JOIN vouchers v ON v.voucher_word_id = vw.id
        WHERE v.period_id = ? AND v.company_id = ?
        ORDER BY vw.word_code
        "#,
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (word_id, word_name) in words {
        let vouchers: Vec<Voucher> = sqlx::query_as(
            "SELECT * FROM vouchers WHERE period_id = ? AND voucher_word_id = ? AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY voucher_date, created_at, id",
        )
        .bind(&period_id)
        .bind(&word_id)
        .bind(&company_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for (idx, voucher) in vouchers.iter().enumerate() {
            let seq = idx as i32 + 1;
            let new_number = format!("{}字第{:03}号", word_name, seq);
            sqlx::query("UPDATE vouchers SET voucher_number = ?, sequence_num = ? WHERE id = ?")
                .bind(&new_number)
                .bind(seq)
                .bind(&voucher.id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to renumber: {}", e))?;
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Voucher numbers reorganized for period: {}", period_id);
    Ok(())
}

#[tauri::command]
pub async fn batch_approve_vouchers(
    ids: Vec<String>,
    approved_by: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Batch approving {} vouchers for company: {}", ids.len(), company_id);

    let now = chrono::Utc::now().to_rfc3339();

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    for id in &ids {
        let voucher: Option<Voucher> = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
                .bind(id)
                .bind(&company_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| format!("Database error: {}", e))?;

        if let Some(v) = voucher {
            if v.status != "draft" {
                continue;
            }

            sqlx::query(
                "UPDATE vouchers SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND company_id = ?",
            )
            .bind(&approved_by)
            .bind(&now)
            .bind(id)
            .bind(&company_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to approve voucher {}: {}", id, e))?;

            update_balances_on_approve(id, &v.period_id, &mut tx).await?;
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Batch approval completed");
    Ok(())
}

#[tauri::command]
pub async fn batch_reverse_approve_vouchers(
    ids: Vec<String>,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Batch reversing approval for {} vouchers for company: {}", ids.len(), company_id);

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    for id in &ids {
        let voucher: Option<Voucher> = sqlx::query_as("SELECT * FROM vouchers WHERE id = ? AND company_id = ?")
                .bind(id)
                .bind(&company_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| format!("Database error: {}", e))?;

        if let Some(v) = voucher {
            if v.status != "approved" {
                continue;
            }

            // Check period is open
            let period_status: Option<(String,)> = sqlx::query_as(
                "SELECT status FROM accounting_periods WHERE id = ?",
            )
            .bind(&v.period_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            if let Some((status,)) = period_status {
                if status != "open" {
                    continue;
                }
            }

            sqlx::query("UPDATE vouchers SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ? AND company_id = ?")
                .bind(id)
                .bind(&company_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to reverse approve {}: {}", id, e))?;

            update_balances_on_reverse_approve(id, &v.period_id, &mut tx).await?;
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Batch reverse approval completed");
    Ok(())
}

#[tauri::command]
pub async fn get_voucher_logs(
    voucher_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherLog>, String> {
    log::info!("Fetching logs for voucher: {}", voucher_id);

    let logs: Vec<VoucherLog> = sqlx::query_as(
        "SELECT * FROM voucher_logs WHERE voucher_id = ? ORDER BY created_at DESC",
    )
    .bind(&voucher_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(logs)
}

#[tauri::command]
pub async fn suggest_summary(
    account_code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    let summaries: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT ve.summary
        FROM voucher_entries ve
        INNER JOIN vouchers v ON v.id = ve.voucher_id
        WHERE ve.account_code = ? AND v.company_id = ? AND ve.summary IS NOT NULL AND ve.summary != ''
        GROUP BY ve.summary
        ORDER BY COUNT(*) DESC
        LIMIT 5
        "#,
    )
    .bind(&account_code)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(summaries.into_iter().map(|(s,)| s).collect())
}

// ==================== Helper functions ====================

/// Build the full hierarchical account name by walking up the parent chain.
/// E.g., for code 560203 with parents 5602→NULL, returns "管理费用_工资".
/// For code 22210102 with parents 222101→2221→NULL, returns "应交税费_应交增值税_销项税额".
async fn build_full_account_name(
    code: &str,
    company_id: &str,
    conn: &mut sqlx::SqliteConnection,
) -> String {
    let mut names: Vec<String> = Vec::new();
    let mut current_code = code.to_string();

    loop {
        let row: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT name, parent_code FROM account_codes WHERE code = ? AND company_id = ?",
        )
        .bind(&current_code)
        .bind(company_id)
        .fetch_optional(&mut *conn)
        .await
        .unwrap_or(None);

        match row {
            Some((name, parent)) => {
                names.push(name);
                match parent {
                    Some(p) if !p.is_empty() => current_code = p,
                    _ => break,
                }
            }
            None => {
                names.push(current_code.clone());
                break;
            }
        }
    }

    names.reverse();
    names.join("_")
}

async fn fetch_entries(
    voucher_id: &str,
    pool: &sqlx::Pool<sqlx::Sqlite>,
) -> Result<Vec<VoucherEntry>, String> {
    sqlx::query_as(
        "SELECT * FROM voucher_entries WHERE voucher_id = ? ORDER BY line_num",
    )
    .bind(voucher_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))
}

fn validate_entries(entries: &[CreateVoucherEntryInput]) -> Result<(f64, f64), String> {
    if entries.is_empty() {
        return Err("凭证分录不能为空".to_string());
    }

    let mut total_debit = 0.0;
    let mut total_credit = 0.0;

    for (i, entry) in entries.iter().enumerate() {
        if entry.amount <= 0.0 {
            return Err(format!("第{}行: 金额必须大于0", i + 1));
        }

        match entry.direction.as_str() {
            "debit" => total_debit += entry.amount,
            "credit" => total_credit += entry.amount,
            _ => return Err(format!("第{}行: 方向必须是 debit 或 credit", i + 1)),
        }
    }

    let diff = (total_debit - total_credit).abs();
    if diff > 0.001 {
        return Err(format!(
            "借贷不平衡: 借方合计{} ≠ 贷方合计{}，差异{}",
            total_debit, total_credit, diff
        ));
    }

    if total_debit <= 0.0 && total_credit <= 0.0 {
        return Err("凭证金额必须大于0".to_string());
    }

    Ok((total_debit, total_credit))
}

async fn validate_voucher_date(
    voucher_date: &str,
    period_id: &str,
    pool: &sqlx::Pool<sqlx::Sqlite>,
) -> Result<(), String> {
    // Validate date format
    if voucher_date.len() != 10 {
        return Err("日期格式错误，请使用 YYYY-MM-DD 格式".to_string());
    }

    let parts: Vec<&str> = voucher_date.split('-').collect();
    if parts.len() != 3 {
        return Err("日期格式错误".to_string());
    }

    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: i32 = parts[1].parse().unwrap_or(0);
    let day: i32 = parts[2].parse().unwrap_or(0);

    if year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 {
        return Err("日期数值超出合理范围".to_string());
    }

    // Check date falls within the period
    let period: Option<(String, String)> = sqlx::query_as(
        "SELECT start_date, end_date FROM accounting_periods WHERE id = ?",
    )
    .bind(period_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((start_date, end_date)) = period {
        if voucher_date < start_date.as_str() || voucher_date > end_date.as_str() {
            return Err(format!(
                "凭证日期 {} 不在会计期间范围内 ({} ~ {})",
                voucher_date, start_date, end_date
            ));
        }
    }

    Ok(())
}

async fn update_balances_on_approve(
    voucher_id: &str,
    period_id: &str,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    let entries: Vec<VoucherEntry> = sqlx::query_as(
        "SELECT * FROM voucher_entries WHERE voucher_id = ? ORDER BY line_num",
    )
    .bind(voucher_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for entry in &entries {
        // Ensure account_balances row exists
        let exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM account_balances WHERE period_id = ? AND account_code = ?",
        )
        .bind(period_id)
        .bind(&entry.account_code)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if exists.is_none() {
            let balance_id = uuid::Uuid::new_v4().to_string();
            // Get opening from previous period or initial balances
            let opening_debit: f64 = 0.0;
            let opening_credit: f64 = 0.0;

            sqlx::query(
                r#"
                INSERT INTO account_balances (id, period_id, account_code, opening_debit, opening_credit,
                    period_debit, period_credit, closing_debit, closing_credit)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
                "#,
            )
            .bind(&balance_id)
            .bind(period_id)
            .bind(&entry.account_code)
            .bind(opening_debit)
            .bind(opening_credit)
            .bind(opening_debit)
            .bind(opening_credit)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to create balance row: {}", e))?;
        }

        // Update period debit/credit
        if entry.direction == "debit" {
            sqlx::query(
                "UPDATE account_balances SET period_debit = period_debit + ?, closing_debit = opening_debit + period_debit + ?, closing_credit = opening_credit + period_credit WHERE period_id = ? AND account_code = ?",
            )
            .bind(entry.amount)
            .bind(entry.amount)
            .bind(period_id)
            .bind(&entry.account_code)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to update balance: {}", e))?;
        } else {
            sqlx::query(
                "UPDATE account_balances SET period_credit = period_credit + ?, closing_credit = opening_credit + period_credit + ?, closing_debit = opening_debit + period_debit WHERE period_id = ? AND account_code = ?",
            )
            .bind(entry.amount)
            .bind(entry.amount)
            .bind(period_id)
            .bind(&entry.account_code)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to update balance: {}", e))?;
        }
    }

    Ok(())
}

async fn update_balances_on_reverse_approve(
    voucher_id: &str,
    period_id: &str,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    let entries: Vec<VoucherEntry> = sqlx::query_as(
        "SELECT * FROM voucher_entries WHERE voucher_id = ? ORDER BY line_num",
    )
    .bind(voucher_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for entry in &entries {
        if entry.direction == "debit" {
            sqlx::query(
                "UPDATE account_balances SET period_debit = period_debit - ?, closing_debit = opening_debit + period_debit, closing_credit = opening_credit + period_credit WHERE period_id = ? AND account_code = ?",
            )
            .bind(entry.amount)
            .bind(period_id)
            .bind(&entry.account_code)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to reverse balance: {}", e))?;
        } else {
            sqlx::query(
                "UPDATE account_balances SET period_credit = period_credit - ?, closing_credit = opening_credit + period_credit, closing_debit = opening_debit + period_debit WHERE period_id = ? AND account_code = ?",
            )
            .bind(entry.amount)
            .bind(period_id)
            .bind(&entry.account_code)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("Failed to reverse balance: {}", e))?;
        }
    }

    Ok(())
}

async fn log_voucher_operation(
    voucher_id: &str,
    operation_type: &str,
    before_data: Option<&str>,
    after_data: Option<&str>,
    operator_id: Option<&str>,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    let log_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO voucher_logs (id, voucher_id, operation_type, before_data, after_data, operator_id) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&log_id)
    .bind(voucher_id)
    .bind(operation_type)
    .bind(before_data)
    .bind(after_data)
    .bind(operator_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| format!("Failed to write audit log: {}", e))?;
    Ok(())
}

async fn log_voucher_operation_raw(
    voucher_id: &str,
    operation_type: &str,
    before_data: Option<&str>,
    after_data: Option<&str>,
    operator_id: Option<&str>,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    log_voucher_operation(voucher_id, operation_type, before_data, after_data, operator_id, tx).await
}

#[tauri::command]
pub async fn get_next_voucher_number(
    period_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<String, String> {
    let last_seq: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND company_id = ?",
    )
    .bind(&period_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let seq = match last_seq {
        Some((Some(n),)) => n + 1,
        _ => 1,
    };

    Ok(format!("记字第{:03}号", seq))
}

#[derive(Debug, Deserialize)]
pub struct ImportVoucherInput {
    pub voucher_date: String,
    pub summary: String,
    pub entries: Vec<ImportEntryInput>,
}

#[derive(Debug, Deserialize)]
pub struct ImportEntryInput {
    pub account_code: String,
    pub account_name: Option<String>,
    pub account_full_name: Option<String>,
    pub direction: String,
    pub amount: f64,
    pub summary: String,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: usize,
    pub errors: Vec<String>,
    pub voucher_ids: Vec<String>,
    pub auto_created_accounts: usize,
    pub auto_created_periods: usize,
}

#[tauri::command]
pub async fn insert_voucher(
    period_id: String,
    voucher_word_id: String,
    voucher_date: String,
    summary: String,
    entries: Vec<CreateVoucherEntryInput>,
    insert_after_seq: Option<i32>,
    created_by: Option<String>,
    db: State<'_, Database>,
) -> Result<VoucherWithEntries, String> {
    log::info!("Inserting voucher at position after seq {:?}", insert_after_seq);

    let insert_pos = insert_after_seq.unwrap_or(0);
    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Shift all subsequent sequence numbers up by 1
    sqlx::query(
        "UPDATE vouchers SET sequence_num = sequence_num + 1 WHERE period_id = ? AND voucher_word_id = ? AND sequence_num > ?",
    )
    .bind(&period_id)
    .bind(&voucher_word_id)
    .bind(insert_pos)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to shift sequence numbers: {}", e))?;

    let new_seq = insert_pos + 1;

    // Get word name for voucher number
    let word_name: (String,) = sqlx::query_as(
        "SELECT word_name FROM voucher_words WHERE id = ?",
    )
    .bind(&voucher_word_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let voucher_number = format!("{}字第{:03}号", word_name.0, new_seq);
    let now = chrono::Utc::now().to_rfc3339();

    // Calculate totals
    let total_debit: f64 = entries.iter()
        .filter(|e| e.direction == "debit")
        .map(|e| e.amount)
        .sum();
    let total_credit: f64 = entries.iter()
        .filter(|e| e.direction == "credit")
        .map(|e| e.amount)
        .sum();

    // Get company_id from period
    let company_id: (String,) = sqlx::query_as(
        "SELECT company_id FROM accounting_periods WHERE id = ?",
    )
    .bind(&period_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("数据库错误: {}", e))?;

    sqlx::query(
        "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
            voucher_date, summary, attachment_count, status, total_debit, total_credit, version, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&company_id.0)
    .bind(&period_id)
    .bind(&voucher_word_id)
    .bind(&voucher_number)
    .bind(new_seq)
    .bind(&voucher_date)
    .bind(&summary)
    .bind(total_debit)
    .bind(total_credit)
    .bind(created_by.as_deref().unwrap_or("system"))
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to insert voucher: {}", e))?;

    // Insert entries
    for (idx, entry) in entries.iter().enumerate() {
        let entry_id = uuid::Uuid::new_v4().to_string();
        let line_num = idx as i32 + 1;

        let account_name: (String,) = sqlx::query_as(
            "SELECT name FROM account_codes WHERE code = ? AND company_id = ?",
        )
        .bind(&entry.account_code)
        .bind(&company_id.0)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("科目 {} 不存在: {}", entry.account_code, e))?;

        sqlx::query(
            "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                quantity, unit_price, unit, currency_id, exchange_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry_id)
        .bind(&id)
        .bind(line_num)
        .bind(&entry.account_code)
        .bind(&account_name.0)
        .bind(&entry.direction)
        .bind(entry.amount)
        .bind(&entry.summary)
        .bind(&entry.auxiliary_type)
        .bind(&entry.auxiliary_id)
        .bind(&entry.doc_number)
        .bind(entry.quantity)
        .bind(entry.unit_price)
        .bind(&entry.unit)
        .bind(&entry.currency_id)
        .bind(entry.exchange_rate)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

        if let Some(ref aux_items) = entry.auxiliary_items {
            for aux in aux_items {
                let aux_id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO voucher_entry_auxiliaries (id, entry_id, auxiliary_category_id, auxiliary_item_id) VALUES (?, ?, ?, ?)",
                )
                .bind(&aux_id)
                .bind(&entry_id)
                .bind(&aux.auxiliary_category_id)
                .bind(&aux.auxiliary_item_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to insert entry auxiliary: {}", e))?;
            }
        }
    }

    log_voucher_operation(&id, "create", None, Some(&id), created_by.as_deref(), &mut tx).await?;

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let voucher: Voucher = sqlx::query_as("SELECT * FROM vouchers WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let saved_entries = fetch_entries(&id, db.pool()).await?;

    log::info!("Voucher inserted at seq {}: {}", new_seq, id);
    Ok(VoucherWithEntries { voucher, entries: saved_entries })
}

#[tauri::command]
pub async fn download_voucher_template() -> Result<String, String> {
    use rust_xlsxwriter::*;

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    let headers = ["日期(YYYY-MM-DD)", "摘要", "科目编码", "方向(debit/credit)", "金额", "分录摘要"];
    for (col, h) in headers.iter().enumerate() {
        sheet.write_string(0, col as u16, *h)
            .map_err(|e| format!("{}", e))?;
    }

    sheet.set_column_width(0, 18).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(1, 30).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(2, 15).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(3, 14).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(4, 15).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(5, 30).map_err(|e| format!("{}", e))?;

    let path = std::env::temp_dir().join("voucher_import_template.xlsx");
    workbook.save(&path).map_err(|e| format!("Failed to save template: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
/// Resolve or create an accounting period for the given company + year + month.
/// Returns the period_id. Also updates the company's enable_year/enable_month
/// if the period is earlier than the current setting.
async fn resolve_period_for_date(
    company_id: &str,
    year: i32,
    month: i32,
    tx: &mut sqlx::SqliteConnection,
) -> Result<String, String> {
    // Check if period already exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
    )
    .bind(company_id)
    .bind(year)
    .bind(month)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("查询期间失败: {}", e))?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    // Create the period
    let start_date = format!("{}-{:02}-01", year, month);
    let end_day = {
        let days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let d = days[(month - 1) as usize];
        if month == 2 && (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) {
            29
        } else {
            d
        }
    };
    let end_date = format!("{}-{:02}-{}", year, month, end_day);
    let period_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    )
    .bind(&period_id)
    .bind(company_id)
    .bind(year)
    .bind(month)
    .bind(&start_date)
    .bind(&end_date)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("创建期间{}-{}失败: {}", year, month, e))?;

    // Initialize account_balances for this new period
    let prev_period: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND (period_year < ? OR (period_year = ? AND period_month < ?)) ORDER BY period_year DESC, period_month DESC LIMIT 1",
    )
    .bind(company_id)
    .bind(year)
    .bind(year)
    .bind(month)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("查询上期失败: {}", e))?;

    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(company_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("查询科目失败: {}", e))?;

    for (code,) in &account_codes {
        let (opening_debit, opening_credit) = if let Some((ref prev_id,)) = prev_period {
            let prev_bal: (f64, f64) = sqlx::query_as(
                "SELECT closing_debit, closing_credit FROM account_balances WHERE period_id = ? AND account_code = ?",
            )
            .bind(prev_id)
            .bind(code)
            .fetch_optional(&mut *tx)
            .await
            .unwrap_or(None)
            .unwrap_or((0.0, 0.0));
            prev_bal
        } else {
            (0.0, 0.0)
        };

        sqlx::query(
            "INSERT OR IGNORE INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
        )
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&period_id)
        .bind(code)
        .bind(opening_debit)
        .bind(opening_credit)
        .bind(opening_debit)
        .bind(opening_credit)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("初始化科目余额失败: {}", e))?;
    }

    // Update company's enable_year/enable_month if this period is earlier
    let current_enable: Option<(Option<i32>, Option<i32>)> = sqlx::query_as(
        "SELECT enable_year, enable_month FROM companies WHERE id = ?",
    )
    .bind(company_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("查询公司失败: {}", e))?;

    let should_update = match current_enable {
        Some((Some(ey), Some(em))) => {
            year < ey || (year == ey && month < em)
        }
        _ => true,
    };

    if should_update {
        sqlx::query(
            "UPDATE companies SET enable_year = ?, enable_month = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(year)
        .bind(month)
        .bind(company_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("更新公司启用期间失败: {}", e))?;
    }

    Ok(period_id)
}

/// Extract year and month from a voucher_date string (e.g., "2026-03-15" → (2026, 3))
fn parse_year_month(date_str: &str) -> Result<(i32, i32), String> {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() >= 2 {
        let year: i32 = parts[0].parse().map_err(|_| format!("无效年份: {}", parts[0]))?;
        let month: i32 = parts[1].parse().map_err(|_| format!("无效月份: {}", parts[1]))?;
        if month < 1 || month > 12 {
            return Err(format!("月份超出范围: {}", month));
        }
        Ok((year, month))
    } else {
        // Try other date formats like "2026/03/15" or "20260315"
        let cleaned: String = date_str.chars().filter(|c| c.is_ascii_digit()).collect();
        if cleaned.len() >= 6 {
            let year: i32 = cleaned[..4].parse().map_err(|_| format!("无效年份"))?;
            let month: i32 = cleaned[4..6].parse().map_err(|_| format!("无效月份"))?;
            if month < 1 || month > 12 {
                return Err(format!("月份超出范围: {}", month));
            }
            Ok((year, month))
        } else {
            Err(format!("无法解析日期: {}", date_str))
        }
    }
}

#[tauri::command]
pub async fn import_vouchers(
    company_id: String,
    _period_id: Option<String>,
    voucher_word_id: String,
    vouchers: Vec<ImportVoucherInput>,
    db: State<'_, Database>,
) -> Result<ImportResult, String> {
    log::info!("Importing {} vouchers for company {}", vouchers.len(), company_id);

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Resolve voucher word — default to first word for the company if not specified
    let resolved_word_id: String = if voucher_word_id.is_empty() {
        let (id,): (String,) = sqlx::query_as(
            "SELECT id FROM voucher_words WHERE company_id = ? ORDER BY rowid LIMIT 1",
        )
        .bind(&company_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("未找到凭证字(请先为该公司创建凭证字): {}", e))?;
        id
    } else {
        voucher_word_id.clone()
    };

    let word_name: (String,) = sqlx::query_as(
        "SELECT word_name FROM voucher_words WHERE id = ?",
    )
    .bind(&resolved_word_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("凭证字不存在: {}", e))?;

    // Cache for period_id lookup: (year, month) → period_id
    let mut period_cache: std::collections::HashMap<(i32, i32), String> = std::collections::HashMap::new();

    // Pre-scan all voucher dates to find the min/max range,
    // then create ALL periods in that range continuously (no gaps).
    // This ensures period continuity: Jan, Feb, Mar, Apr, May — not skip Mar.
    {
        let mut min_ym: Option<(i32, i32)> = None;
        let mut max_ym: Option<(i32, i32)> = None;
        for v in &vouchers {
            if let Ok((y, m)) = parse_year_month(&v.voucher_date) {
                match min_ym {
                    None => { min_ym = Some((y, m)); max_ym = Some((y, m)); }
                    Some((my, mm)) => {
                        if y < my || (y == my && m < mm) { min_ym = Some((y, m)); }
                        if y > my || (y == my && m > mm) { max_ym = Some((y, m)); }
                    }
                }
                if let Some((cy, cm)) = max_ym {
                    if y > cy || (y == cy && m > cm) { max_ym = Some((y, m)); }
                }
            }
        }

        if let (Some((min_y, min_m)), Some((max_y, max_m))) = (min_ym, max_ym) {
            // Walk through every month from min to max, creating missing periods
            let mut cur_y = min_y;
            let mut cur_m = min_m;
            loop {
                let pid = resolve_period_for_date(&company_id, cur_y, cur_m, &mut *tx).await?;
                period_cache.insert((cur_y, cur_m), pid);

                if cur_y == max_y && cur_m == max_m { break; }
                cur_m += 1;
                if cur_m > 12 { cur_m = 1; cur_y += 1; }
            }
        }
    }

    let mut success = 0usize;
    let mut errors: Vec<String> = Vec::new();
    let mut voucher_ids: Vec<String> = Vec::new();
    let mut total_auto_created_accounts = 0usize;
    let mut all_auto_created_codes: Vec<String> = Vec::new();

    for (idx, v) in vouchers.iter().enumerate() {
        // Validate
        let total_debit: f64 = v.entries.iter()
            .filter(|e| e.direction == "debit")
            .map(|e| e.amount)
            .sum();
        let total_credit: f64 = v.entries.iter()
            .filter(|e| e.direction == "credit")
            .map(|e| e.amount)
            .sum();

        if (total_debit - total_credit).abs() > 0.01 {
            errors.push(format!("第{}行凭证借贷不平衡(借:{:.2} 贷:{:.2})", idx + 1, total_debit, total_credit));
            continue;
        }

        if v.entries.is_empty() {
            errors.push(format!("第{}行凭证无分录", idx + 1));
            continue;
        }

        // Auto-create missing account codes (with their parent chain)
        // Uses account_full_name (科目全称, underscore-separated path) to determine correct names
        // and hierarchy. Supports cross-standard account codes (e.g., import uses 5602 while
        // system seeds 6602 for 管理费用).
        let mut auto_created: Vec<String> = Vec::new();
        for e in &v.entries {
            let exists: Option<(String,)> = sqlx::query_as(
                "SELECT code FROM account_codes WHERE code = ? AND company_id = ?",
            )
            .bind(&e.account_code)
            .bind(&company_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|err| format!("查询失败: {}", err))?;

            if exists.is_some() || auto_created.contains(&e.account_code) {
                continue;
            }

            let code = &e.account_code;
            let full_name = e.account_full_name.as_deref().unwrap_or("");

            // Parse the underscore-separated path from 科目全称
            // e.g., "应交税费_应交增值税_销项税额" → ["应交税费", "应交增值税", "销项税额"]
            // Each element corresponds to a level in the account hierarchy.
            let mut name_path: Vec<String> = if !full_name.is_empty() {
                full_name.split('_').filter(|s| !s.is_empty()).map(|s| s.to_string()).collect()
            } else if let Some(an) = e.account_name.as_deref() {
                if !an.is_empty() && an != code { vec![an.to_string()] } else { vec![] }
            } else {
                vec![]
            };

            if name_path.is_empty() {
                // No name info provided — derive a default name from the deepest existing parent
                let parent_name: Option<String> = {
                    let mut sc = code.clone();
                    let mut found_name: Option<String> = None;
                    loop {
                        if sc.len() > 4 {
                            sc = sc[..sc.len() - 2].to_string();
                        } else if sc.len() > 1 {
                            sc = sc[..sc.len() - 1].to_string();
                        } else {
                            break;
                        }
                        let pn: Option<(String,)> = sqlx::query_as(
                            "SELECT name FROM account_codes WHERE code = ? AND company_id = ?",
                        )
                        .bind(&sc)
                        .bind(&company_id)
                        .fetch_optional(&mut *tx)
                        .await
                        .ok()
                        .flatten();
                        if let Some((n,)) = pn {
                            found_name = Some(n);
                            break;
                        }
                    }
                    found_name
                };
                let derived = parent_name.unwrap_or_else(|| code.clone());
                name_path = vec![derived];
            }

            // Determine account type from first digit of code
            let (account_type, normal_balance) = match code.chars().next() {
                Some('1') => ("asset", "debit"),
                Some('2') => ("liability", "credit"),
                Some('3') => ("equity", "credit"),
                Some('4') => ("cost", "debit"),
                Some('5') | Some('6') => ("expense", "debit"),
                _ => ("asset", "debit"),
            };

            // Strategy: find the deepest existing ancestor by code prefix.
            // For code "22210102":
            //   Try: 222101, 2221, 222, 22, 2
            // If none found, fall back to finding any top-level account of the same type.
            // Track HOW we found the parent to determine code generation strategy.
            let mut closest_parent_code: Option<String> = None;
            let mut closest_parent_level: i32 = 0;
            let mut found_by_code_prefix = false; // true = parent is actual ancestor by code

            {
                let mut search_code = code.clone();
                loop {
                    if search_code.len() > 4 {
                        search_code = search_code[..search_code.len() - 2].to_string();
                    } else if search_code.len() > 1 {
                        search_code = search_code[..search_code.len() - 1].to_string();
                    } else {
                        break;
                    }

                    let found: Option<(String, i32)> = sqlx::query_as(
                        "SELECT code, level FROM account_codes WHERE code = ? AND company_id = ?",
                    )
                    .bind(&search_code)
                    .bind(&company_id)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|err| format!("查询失败: {}", err))?;

                    if let Some((f_code, f_level)) = found {
                        closest_parent_code = Some(f_code);
                        closest_parent_level = f_level;
                        found_by_code_prefix = true;
                        break;
                    }
                }
            }

            // If no parent found by code prefix, the code belongs to a different accounting standard.
            // We'll create the accounts as top-level entries (parent_code = NULL) since they
            // use a different code system. The name_path will define the hierarchy within the
            // new code system.
            // E.g., for code 560203 (管理费用_工资) in a system seeded with 6xxx codes:
            //   Create 5602 (管理费用, level 1, parent NULL)
            //   Create 560203 (工资, level 2, parent 5602)
            if closest_parent_code.is_none() {
                found_by_code_prefix = false;
                // Don't set a parent — will create as top-level hierarchy
            }

            // If still no parent, we cannot auto-create — skip this account
            // (closest_parent_code is None only when found_by_code_prefix is false AND
            //  no code-prefix parent was found — in this case, create as top-level)
            let parent_code_opt = closest_parent_code.clone();
            let parent_level_val = closest_parent_level;

            // Build the list of codes to create: (code, name, level, parent_code_for_this_level)
            // Build the list of codes to create: (code, name, level, parent_code_for_this_level)
            // parent_code = None means top-level account (parent_code column = NULL)
            let mut codes_to_create: Vec<(String, String, i32, Option<String>)> = Vec::new();

            if found_by_code_prefix {
                // Parent is a real ancestor by code prefix — derive intermediate codes
                // by appending remaining digits from the target code to the parent code.
                if let Some(ref p_code) = parent_code_opt {
                    let remaining_digits = &code[p_code.len()..];
                    let chars: Vec<char> = remaining_digits.chars().collect();
                    let mut current_prefix = p_code.clone();
                    let mut current_level = parent_level_val;

                    let mut i = 0;
                    while i < chars.len() {
                        let chunk_len = if i + 2 <= chars.len() { 2 } else { chars.len() - i };
                        let chunk: String = chars[i..i + chunk_len].iter().collect();
                        current_prefix = format!("{}{}", current_prefix, chunk);
                        current_level += 1;

                        let name_idx = (current_level as usize) - 1;
                        let name = if name_idx < name_path.len() {
                            name_path[name_idx].clone()
                        } else {
                            name_path.last().cloned().unwrap_or_else(|| code.clone())
                        };

                        let p_for_this = if codes_to_create.is_empty() {
                            Some(p_code.clone())
                        } else {
                            Some(codes_to_create.last().unwrap().0.clone())
                        };

                        codes_to_create.push((current_prefix.clone(), name, current_level, p_for_this));
                        i += chunk_len;
                    }
                }
            } else {
                // No code-prefix parent found — the target code belongs to a different
                // accounting standard (e.g., 5xxx codes in a system seeded with 6xxx codes).
                // Create the hierarchy from the target code's own structure as top-level accounts.
                //
                // Code derivation from target code:
                //   4-digit prefix → level 1 (top-level, parent = NULL)
                //   6-digit prefix → level 2 (parent = 4-digit code)
                //   8-digit prefix → level 3 (parent = 6-digit code)
                //   etc.
                //
                // name_path[0] → level 1 name, name_path[1] → level 2 name, etc.
                //
                // Examples:
                //   560203, name_path=["管理费用","工资"] → create 5602(管理费用,L1,NULL), 560203(工资,L2,5602)
                //   3103, name_path=["本年利润"] → create 3103(本年利润,L1,NULL)
                //   540101, name_path=["主营业务成本",...] → create 5401(主营业务成本,L1,NULL), 540101(...,L2,5401)
                //   22210102, name_path=["应交税费","应交增值税","销项税额"] →
                //     create 2221(应交税费,L1,NULL), 222101(应交增值税,L2,2221), 22210102(销项税额,L3,222101)
                {
                    let full_code = code.clone();
                    let mut codes_derived: Vec<(String, i32)> = Vec::new();

                    if full_code.len() == 4 {
                        // 4-digit code is already a top-level account
                        codes_derived.push((full_code.clone(), 1));
                    } else {
                        // Derive hierarchy: 4-digit prefix = level 1, then +2 chars per level
                        let mut derived_code = full_code[..4].to_string();
                        let mut derived_level = 1i32;
                        codes_derived.push((derived_code.clone(), derived_level));
                        derived_level += 1;

                        let mut char_idx = 4;
                        while char_idx < full_code.len() {
                            let end = std::cmp::min(char_idx + 2, full_code.len());
                            derived_code = format!("{}{}", derived_code, &full_code[char_idx..end]);
                            codes_derived.push((derived_code.clone(), derived_level));
                            derived_level += 1;
                            char_idx = end;
                        }
                    }

                    // Map derived codes to names from name_path
                    for (di, (d_code, d_level)) in codes_derived.iter().enumerate() {
                        let name = if di < name_path.len() {
                            name_path[di].clone()
                        } else {
                            name_path.last().cloned().unwrap_or_else(|| d_code.clone())
                        };

                        let p_for_this: Option<String> = if di == 0 {
                            None // Top-level account, no parent
                        } else {
                            Some(codes_derived[di - 1].0.clone())
                        };

                        codes_to_create.push((d_code.clone(), name, *d_level, p_for_this));
                    }
                }
            }

            // Fallback: if nothing to create, create the target directly
            if codes_to_create.is_empty() {
                let name = name_path.last().cloned().unwrap_or_else(|| code.clone());
                codes_to_create.push((code.clone(), name, 1, None));
            }

            // Create each missing account in the chain
            for (c_code, c_name, c_level, c_parent) in &codes_to_create {
                let already: Option<(String,)> = sqlx::query_as(
                    "SELECT code FROM account_codes WHERE code = ? AND company_id = ?",
                )
                .bind(c_code)
                .bind(&company_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|err| format!("查询失败: {}", err))?;

                if already.is_none() {
                    let is_detail = if c_code == code { 1 } else { 0 };
                    sqlx::query(
                        "INSERT INTO account_codes (code, company_id, name, account_type, normal_balance, level, parent_code, is_detail, is_enabled)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                    )
                    .bind(c_code)
                    .bind(&company_id)
                    .bind(c_name)
                    .bind(account_type)
                    .bind(normal_balance)
                    .bind(c_level)
                    .bind(c_parent.as_deref()) // None → SQL NULL
                    .bind(is_detail)
                    .execute(&mut *tx)
                    .await
                    .map_err(|err| format!("自动创建科目{}失败: {}", c_code, err))?;

                    auto_created.push(c_code.clone());
                    if !all_auto_created_codes.contains(c_code) {
                        all_auto_created_codes.push(c_code.clone());
                    }
                    log::info!("Auto-created account: {} {} (level {}, type {})", c_code, c_name, c_level, account_type);
                }
            }
        }

        total_auto_created_accounts = all_auto_created_codes.len();

        // Validate account codes again (catch any that couldn't be auto-created)
        let mut acct_errors = Vec::new();
        for (ei, e) in v.entries.iter().enumerate() {
            let exists: Option<(String,)> = sqlx::query_as(
                "SELECT code FROM account_codes WHERE code = ? AND company_id = ?",
            )
            .bind(&e.account_code)
            .bind(&company_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|err| format!("查询失败: {}", err))?;

            if exists.is_none() {
                acct_errors.push(format!("分录{} 科目编码{}不存在(无法自动创建,未找到父级科目)", ei + 1, e.account_code));
            }
        }
        if !acct_errors.is_empty() {
            errors.push(format!("第{}行凭证: {}", idx + 1, acct_errors.join("; ")));
            continue;
        }

        // Resolve period from voucher_date: auto-create if missing, update company enable period
        let resolved_period_id = match parse_year_month(&v.voucher_date) {
            Ok((year, month)) => {
                if let Some(pid) = period_cache.get(&(year, month)) {
                    pid.clone()
                } else {
                    let pid = resolve_period_for_date(&company_id, year, month, &mut *tx).await?;
                    period_cache.insert((year, month), pid.clone());
                    pid
                }
            }
            Err(e) => {
                errors.push(format!("第{}行凭证日期解析失败: {}", idx + 1, e));
                continue;
            }
        };

        // Get current max sequence for this specific period
        let last_seq_in_period: Option<(Option<i32>,)> = sqlx::query_as(
            "SELECT MAX(sequence_num) FROM vouchers WHERE period_id = ? AND voucher_word_id = ?",
        )
        .bind(&resolved_period_id)
        .bind(&resolved_word_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        let seq_in_period = match last_seq_in_period {
            Some((Some(n),)) => n + 1,
            _ => 1,
        };

        let id = uuid::Uuid::new_v4().to_string();
        let voucher_number = format!("{}字第{:03}号", word_name.0, seq_in_period);
        let now = chrono::Utc::now().to_rfc3339();

        // Imported vouchers are auto-approved since 序时账 represents already-posted entries
        let insert_result = sqlx::query(
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num,
                voucher_date, summary, attachment_count, status, total_debit, total_credit, version, created_by, created_at, approved_by, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved', ?, ?, 1, 'import', ?, 'import', ?)",
        )
        .bind(&id)
        .bind(&company_id)
        .bind(&resolved_period_id)
        .bind(&resolved_word_id)
        .bind(&voucher_number)
        .bind(seq_in_period)
        .bind(&v.voucher_date)
        .bind(&v.summary)
        .bind(total_debit)
        .bind(total_credit)
        .bind(&now)
        .bind(&now) // approved_at
        .execute(&mut *tx)
        .await;

        if let Err(e) = insert_result {
            errors.push(format!("第{}行凭证入库失败: {}", idx + 1, e));
            continue;
        }

        let mut entry_failed = false;
        for (ei, e) in v.entries.iter().enumerate() {
            let entry_id = uuid::Uuid::new_v4().to_string();

            // Build the full hierarchical account name for display:
            // Use account_full_name (科目全称) if available, otherwise build from DB hierarchy.
            // Format: "管理费用_工资" or "应交税费_应交增值税_销项税额"
            let display_name = if let Some(ref full_name) = e.account_full_name {
                if !full_name.is_empty() {
                    full_name.clone()
                } else {
                    build_full_account_name(&e.account_code, &company_id, &mut *tx).await
                }
            } else {
                build_full_account_name(&e.account_code, &company_id, &mut *tx).await
            };

            let entry_result = sqlx::query(
                "INSERT INTO voucher_entries (id, voucher_id, line_num, account_code, account_name,
                    direction, amount, summary, auxiliary_type, auxiliary_id, doc_number,
                    quantity, unit_price, unit, currency_id, exchange_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
            )
            .bind(&entry_id)
            .bind(&id)
            .bind(ei as i32 + 1)
            .bind(&e.account_code)
            .bind(&display_name)
            .bind(&e.direction)
            .bind(e.amount)
            .bind(&e.summary)
            .execute(&mut *tx)
            .await;

            if let Err(e) = entry_result {
                errors.push(format!("第{}行凭证分录{}入库失败: {}", idx + 1, ei + 1, e));
                entry_failed = true;
                break;
            }
        }

        if entry_failed {
            continue;
        }

        // Update account_balances since imported vouchers are auto-approved
        if let Err(e) = update_balances_on_approve(&id, &resolved_period_id, &mut tx).await {
            errors.push(format!("第{}行凭证余额更新失败: {}", idx + 1, e));
            continue;
        }

        success += 1;
        voucher_ids.push(id);
    }

    // After all vouchers are imported, recalculate closing balances for each
    // affected period and carry forward to subsequent periods.
    // This ensures that when multiple periods are created during import,
    // each period's closing balance correctly feeds into the next period's opening.
    {
        // Collect all affected period IDs in chronological order
        let mut affected_periods: Vec<(i32, i32, String)> = Vec::new();
        for ((y, m), pid) in &period_cache {
            affected_periods.push((*y, *m, pid.clone()));
        }
        affected_periods.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));

        // For each period, recalculate closing balances from opening + period activity
        for (idx, (_y, _m, pid)) in affected_periods.iter().enumerate() {
            // Recalculate closing balances for this period based on actual period_debit/period_credit
            sqlx::query(
                "UPDATE account_balances SET closing_debit = opening_debit + period_debit, closing_credit = opening_credit + period_credit WHERE period_id = ?",
            )
            .bind(pid)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("更新期间{}期末余额失败: {}", pid, e))?;

            // Carry forward closing balances to the next period's opening balances
            if idx + 1 < affected_periods.len() {
                let next_pid = &affected_periods[idx + 1].2;
                // Update opening balances of next period from this period's closing balances
                let closings: Vec<(String, f64, f64)> = sqlx::query_as(
                    "SELECT account_code, closing_debit, closing_credit FROM account_balances WHERE period_id = ?",
                )
                .bind(pid)
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| format!("查询期间{}期末余额失败: {}", pid, e))?;

                for (code, cd, cc) in &closings {
                    sqlx::query(
                        "UPDATE account_balances SET opening_debit = ?, opening_credit = ?, closing_debit = opening_debit + period_debit, closing_credit = opening_credit + period_credit WHERE period_id = ? AND account_code = ?",
                    )
                    .bind(cd)
                    .bind(cc)
                    .bind(next_pid)
                    .bind(code)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| format!("结转余额到期间{}失败: {}", next_pid, e))?;
                }
            }
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Imported {}/{} vouchers", success, vouchers.len());
    let auto_created_periods = period_cache.len();
    Ok(ImportResult { success, errors, voucher_ids, auto_created_accounts: total_auto_created_accounts, auto_created_periods })
}

#[tauri::command]
pub async fn delete_company_vouchers(
    company_id: String,
    db: State<'_, Database>,
) -> Result<u64, String> {
    log::info!("Deleting all vouchers for company: {}", company_id);

    let voucher_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM vouchers WHERE company_id = ? AND status = 'draft'",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let count = voucher_ids.len() as u64;
    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    for (vid,) in &voucher_ids {
        sqlx::query("DELETE FROM voucher_logs WHERE voucher_id = ?")
            .bind(vid)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to delete logs: {}", e))?;

        sqlx::query("DELETE FROM vouchers WHERE id = ?")
            .bind(vid)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to delete voucher: {}", e))?;
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    log::info!("Deleted {} vouchers for company: {}", count, company_id);
    Ok(count)
}

#[tauri::command]
pub async fn export_vouchers_excel(
    company_id: String,
    period_id: Option<String>,
    db: State<'_, Database>,
) -> Result<String, String> {
    use rust_xlsxwriter::*;

    let vouchers: Vec<Voucher> = if let Some(ref pid) = period_id {
        sqlx::query_as(
            "SELECT * FROM vouchers WHERE company_id = ? AND period_id = ? ORDER BY voucher_date, sequence_num",
        )
        .bind(&company_id)
        .bind(pid)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    } else {
        sqlx::query_as(
            "SELECT * FROM vouchers WHERE company_id = ? ORDER BY voucher_date, sequence_num",
        )
        .bind(&company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    };

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    // Header
    let headers = ["日期", "凭证号", "摘要", "科目编码", "科目名称", "方向", "金额", "状态"];
    for (col, h) in headers.iter().enumerate() {
        sheet.write_string(0, col as u16, *h).map_err(|e| format!("{}", e))?;
    }

    let mut row = 1u32;
    for v in &vouchers {
        let entries: Vec<VoucherEntry> = sqlx::query_as(
            "SELECT * FROM voucher_entries WHERE voucher_id = ? ORDER BY line_num",
        )
        .bind(&v.id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for e in &entries {
            sheet.write_string(row, 0, &v.voucher_date).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 1, &v.voucher_number).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 2, e.summary.as_deref().unwrap_or("")).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 3, &e.account_code).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 4, &e.account_name).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 5, &e.direction).map_err(|e| format!("{}", e))?;
            sheet.write_number(row, 6, e.amount).map_err(|e| format!("{}", e))?;
            sheet.write_string(row, 7, &v.status).map_err(|e| format!("{}", e))?;
            row += 1;
        }
    }

    // Set column widths
    sheet.set_column_width(0, 12).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(1, 18).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(2, 30).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(3, 15).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(4, 20).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(5, 8).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(6, 15).map_err(|e| format!("{}", e))?;
    sheet.set_column_width(7, 8).map_err(|e| format!("{}", e))?;

    let path = std::env::temp_dir().join(format!("vouchers_export_{}.xlsx", uuid::Uuid::new_v4()));
    workbook.save(&path).map_err(|e| format!("Failed to save Excel: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

// ==================== Excel Parse (序时账) ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedVoucherRow {
    pub row_index: usize,
    pub voucher_date: String,
    pub voucher_number: String,
    pub summary: String,
    pub account_code: String,
    pub account_name: String,
    pub account_full_name: String,
    pub direction: String,
    pub amount: f64,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParseExcelResult {
    pub rows: Vec<ParsedVoucherRow>,
    pub total_rows: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

/// Parse a 序时账 (chronological account) Excel file.
/// Supports two formats:
/// 1. Standard template: 日期 | 摘要 | 科目编码 | 方向 | 金额 | 分录摘要
/// 2. 序时账格式: 日期 | 凭证号/凭证字号 | 摘要 | 科目编码 | 科目名称 | 借方金额 | 贷方金额
///
/// Auto-detects the header row by scanning the first 5 rows for known column names.
#[tauri::command]
pub async fn parse_voucher_excel(
    file_path: String,
    format_type: String,
) -> Result<ParseExcelResult, String> {
    use calamine::{open_workbook_auto, DataType, Reader};

    let mut workbook = open_workbook_auto(&file_path)
        .map_err(|e| format!("无法打开Excel文件: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let sheet_name = sheet_names.first()
        .ok_or_else(|| "Excel文件没有工作表".to_string())?
        .clone();

    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e| format!("读取工作表失败: {}", e))?;

    let all_rows: Vec<Vec<calamine::Data>> = range.rows().map(|r| r.to_vec()).collect();

    // Find header row: scan first 5 rows for known column names
    let header_keywords = ["日期", "凭证号", "凭证字号", "摘要", "科目编码", "科目全称", "科目名称", "借方金额", "贷方金额", "方向", "金额"];
    let mut header_row_idx = 0usize;
    let mut col_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for ri in 0..std::cmp::min(all_rows.len(), 5) {
        let row = &all_rows[ri];
        let mut found = 0usize;
        let mut local_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

        for (ci, cell) in row.iter().enumerate() {
            if let Some(s) = cell.get_string() {
                let trimmed = s.trim();
                for kw in &header_keywords {
                    if trimmed.contains(kw) || *kw == trimmed {
                        found += 1;
                        // Insert both the actual header text AND the keyword
                        // so lookups by keyword work even if header has extra text
                        local_map.insert(trimmed.to_string(), ci);
                        local_map.insert(kw.to_string(), ci);
                        if trimmed.contains("凭证字号") {
                            local_map.insert("凭证号".to_string(), ci);
                        }
                    }
                }
            }
        }

        if found >= 3 {
            header_row_idx = ri;
            col_map = local_map;
            break;
        }
    }

    // Helper to get cell string value by column name
    let get_cell_str = |row: &[calamine::Data], col_name: &str, map: &std::collections::HashMap<String, usize>| -> String {
        if let Some(&ci) = map.get(col_name) {
            row.get(ci)
                .and_then(|c| if let Some(s) = c.get_string() { Some(s.trim().to_string()) } else if let calamine::Data::Float(f) = c { Some(format!("{}", f)) } else if let calamine::Data::Int(i) = c { Some(format!("{}", i)) } else { None })
                .unwrap_or_default()
        } else {
            String::new()
        }
    };

    // Helper to parse amount from cell
    let parse_amt = |s: &str| -> f64 {
        if s.is_empty() { return 0.0; }
        s.parse::<f64>().unwrap_or(0.0)
    };

    let mut rows: Vec<ParsedVoucherRow> = Vec::new();
    let mut global_errors: Vec<String> = Vec::new();
    let mut error_count = 0usize;
    let mut row_index = 0usize;

    for (ri, row) in all_rows.iter().enumerate() {
        // Skip header row and rows before it
        if ri <= header_row_idx {
            continue;
        }

        row_index += 1;
        let mut row_errors: Vec<String> = Vec::new();

        if format_type == "chronological" {
            let date_str = get_cell_str(row, "日期", &col_map);
            let voucher_num = get_cell_str(row, "凭证号", &col_map);
            let summary = get_cell_str(row, "摘要", &col_map);
            let acct_code = get_cell_str(row, "科目编码", &col_map);
            let acct_name = get_cell_str(row, "科目名称", &col_map);
            let acct_full_name = get_cell_str(row, "科目全称", &col_map);
            let debit_str = get_cell_str(row, "借方金额", &col_map);
            let credit_str = get_cell_str(row, "贷方金额", &col_map);

            if date_str.is_empty() && acct_code.is_empty() && debit_str.is_empty() && credit_str.is_empty() {
                continue;
            }

            let debit = parse_amt(&debit_str);
            let credit = parse_amt(&credit_str);

            let direction = if debit > 0.0 { "debit".to_string() } else { "credit".to_string() };
            let amount = if debit > 0.0 { debit } else { credit };

            if amount <= 0.0 {
                row_errors.push("借贷金额均为零或负数".to_string());
            }
            if acct_code.is_empty() {
                row_errors.push("科目编码为空".to_string());
            }

            if !row_errors.is_empty() {
                error_count += row_errors.len();
            }

            rows.push(ParsedVoucherRow {
                row_index,
                voucher_date: date_str,
                voucher_number: voucher_num,
                summary,
                account_code: acct_code,
                account_name: acct_name,
                account_full_name: acct_full_name,
                direction,
                amount,
                errors: row_errors,
            });
        } else {
            let date_str = get_cell_str(row, "日期", &col_map);
            let summary = get_cell_str(row, "摘要", &col_map);
            let acct_code = get_cell_str(row, "科目编码", &col_map);
            let direction_str = get_cell_str(row, "方向", &col_map);
            let amount_str = get_cell_str(row, "金额", &col_map);
            let entry_summary = get_cell_str(row, "分录摘要", &col_map);

            if date_str.is_empty() && acct_code.is_empty() {
                continue;
            }

            let direction = if direction_str == "debit" || direction_str == "借" || direction_str == "借方" {
                "debit".to_string()
            } else if direction_str == "credit" || direction_str == "贷" || direction_str == "贷方" {
                "credit".to_string()
            } else {
                row_errors.push(format!("方向无法识别: '{}'", direction_str));
                "debit".to_string()
            };

            let amount = parse_amt(&amount_str);

            if acct_code.is_empty() {
                row_errors.push("科目编码为空".to_string());
            }
            if amount <= 0.0 {
                row_errors.push("金额为零或负数".to_string());
            }

            if !row_errors.is_empty() {
                error_count += row_errors.len();
            }

            rows.push(ParsedVoucherRow {
                row_index,
                voucher_date: date_str,
                voucher_number: String::new(),
                summary: if entry_summary.is_empty() { summary } else { entry_summary },
                account_code: acct_code,
                account_name: String::new(),
                account_full_name: String::new(),
                direction,
                amount,
                errors: row_errors,
            });
        }
    }

    if rows.is_empty() {
        global_errors.push("Excel文件中没有有效数据行".to_string());
    }

    Ok(ParseExcelResult {
        total_rows: rows.len(),
        error_count,
        errors: global_errors,
        rows,
    })
}

/// Recalculate all account_balances for a company.
/// This will:
/// 1. Approve all draft vouchers (imported vouchers should be auto-approved)
/// 2. Recalculate period_debit/period_credit/closing for each period
/// 3. Carry forward closing balances to next period's opening
/// 4. Create missing periods between min and max voucher dates
#[tauri::command]
pub async fn recalculate_balances(
    company_id: String,
    db: State<'_, Database>,
) -> Result<String, String> {
    log::info!("Recalculating balances for company: {}", company_id);

    let mut tx = db.pool().begin().await.map_err(|e| format!("Transaction error: {}", e))?;

    // Step 0: Deduplicate periods — keep the earliest created one per (year, month)
    let dup_periods: Vec<(String, i32, i32)> = sqlx::query_as(
        r#"SELECT p.id, p.period_year, p.period_month
           FROM accounting_periods p
           WHERE p.company_id = ? AND p.id NOT IN (
               SELECT MIN(p2.id) FROM accounting_periods p2 WHERE p2.company_id = ? GROUP BY p2.period_year, p2.period_month
           )"#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("查询重复期间失败: {}", e))?;

    let mut duplicates_removed = 0u32;
    for (dup_id, _dy, _dm) in &dup_periods {
        // Reassign any vouchers referencing the duplicate period to the kept period
        let kept: Option<(String,)> = sqlx::query_as(
            "SELECT MIN(id) FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
        )
        .bind(&company_id)
        .bind(_dy)
        .bind(_dm)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("查询保留期间失败: {}", e))?;

        if let Some((kept_id,)) = kept {
            sqlx::query("UPDATE vouchers SET period_id = ? WHERE period_id = ?")
                .bind(&kept_id)
                .bind(dup_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("迁移凭证期间失败: {}", e))?;

            sqlx::query("DELETE FROM account_balances WHERE period_id = ?")
                .bind(dup_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("删除重复余额失败: {}", e))?;

            sqlx::query("DELETE FROM accounting_periods WHERE id = ?")
                .bind(dup_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("删除重复期间失败: {}", e))?;

            duplicates_removed += 1;
        }
    }
    if duplicates_removed > 0 {
        log::info!("Removed {} duplicate periods", duplicates_removed);
    }

    // Step 1: Approve all draft vouchers
    let now = chrono::Utc::now().to_rfc3339();
    let draft_count = sqlx::query(
        "UPDATE vouchers SET status = 'approved', approved_by = 'recalculate', approved_at = ? WHERE company_id = ? AND status = 'draft' AND (is_deleted = 0 OR is_deleted IS NULL)",
    )
    .bind(&now)
    .bind(&company_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("审批草稿凭证失败: {}", e))?
    .rows_affected();

    log::info!("Approved {} draft vouchers", draft_count);

    // Step 2: Determine the full date range from both voucher dates AND existing periods,
    // then create all missing periods to ensure continuity (no gaps between months).
    let voucher_range: Option<(String, String)> = sqlx::query_as(
        "SELECT MIN(voucher_date), MAX(voucher_date) FROM vouchers WHERE company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
    )
    .bind(&company_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("查询凭证日期范围失败: {}", e))?;

    let period_range: Option<(i32, i32, i32, i32)> = sqlx::query_as(
        "SELECT MIN(period_year), MIN(period_month), MAX(period_year), MAX(period_month) FROM accounting_periods WHERE company_id = ?",
    )
    .bind(&company_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("查询期间范围失败: {}", e))?;

    // Compute overall min and max across vouchers and existing periods
    let mut min_y = i32::MAX;
    let mut min_m = i32::MAX;
    let mut max_y = 0i32;
    let mut max_m = 0i32;

    if let Some((min_date, max_date)) = voucher_range {
        if let (Ok((vy1, vm1)), Ok((vy2, vm2))) = (parse_year_month(&min_date), parse_year_month(&max_date)) {
            min_y = min_y.min(vy1); min_m = min_m.min(vm1);
            max_y = max_y.max(vy2); max_m = max_m.max(vm2);
        }
    }
    if let Some((py1, pm1, py2, pm2)) = period_range {
        min_y = min_y.min(py1); min_m = min_m.min(pm1);
        max_y = max_y.max(py2); max_m = max_m.max(pm2);
    }

    let mut periods_created = 0u32;

    if min_y > 0 && max_y > 0 {
        let mut cur_y = min_y;
        let mut cur_m = min_m;
        loop {
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
            )
            .bind(&company_id)
            .bind(cur_y)
            .bind(cur_m)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("查询期间失败: {}", e))?;

            if existing.is_none() {
                let _pid = resolve_period_for_date(&company_id, cur_y, cur_m, &mut *tx).await?;
                log::info!("Created missing period {}-{}", cur_y, cur_m);
                periods_created += 1;
            }

            if cur_y == max_y && cur_m == max_m { break; }
            cur_m += 1;
            if cur_m > 12 { cur_m = 1; cur_y += 1; }
        }
    }

    // Step 3: Reset all account_balances to zero, then recalculate from vouchers
    // Get all periods in chronological order
    let periods: Vec<(String, i32, i32)> = sqlx::query_as(
        "SELECT id, period_year, period_month FROM accounting_periods WHERE company_id = ? ORDER BY period_year, period_month",
    )
    .bind(&company_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("查询期间失败: {}", e))?;

    // Get all enabled account codes
    let account_codes: Vec<(String,)> = sqlx::query_as(
        "SELECT code FROM account_codes WHERE company_id = ? AND is_enabled = 1",
    )
    .bind(&company_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("查询科目失败: {}", e))?;

    // First period gets opening from initial_balances or zero
    let mut prev_closing: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new();

    for (period_id, _year, _month) in &periods {
        // For each account, reset period activity and recalculate from vouchers
        for (code,) in &account_codes {
            // Get opening from previous period's closing
            let (opening_debit, opening_credit) = prev_closing.get(code).copied().unwrap_or((0.0, 0.0));

            // Sum debit/credit from approved, non-deleted vouchers in this period
            let activity: (f64, f64) = sqlx::query_as(
                r#"SELECT COALESCE(SUM(CASE WHEN ve.direction = 'debit' THEN ve.amount ELSE 0 END), 0),
                          COALESCE(SUM(CASE WHEN ve.direction = 'credit' THEN ve.amount ELSE 0 END), 0)
                   FROM voucher_entries ve
                   JOIN vouchers v ON ve.voucher_id = v.id
                   WHERE v.period_id = ? AND ve.account_code = ? AND v.status = 'approved' AND (v.is_deleted = 0 OR v.is_deleted IS NULL)"#,
            )
            .bind(period_id)
            .bind(code)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| format!("查询期间活动失败: {}", e))?;

            let (period_debit, period_credit) = activity;
            let closing_debit = opening_debit + period_debit;
            let closing_credit = opening_credit + period_credit;

            // Upsert the balance row
            let existing_bal: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM account_balances WHERE period_id = ? AND account_code = ?",
            )
            .bind(period_id)
            .bind(code)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("查询余额行失败: {}", e))?;

            if existing_bal.is_some() {
                sqlx::query(
                    "UPDATE account_balances SET opening_debit = ?, opening_credit = ?, period_debit = ?, period_credit = ?, closing_debit = ?, closing_credit = ? WHERE period_id = ? AND account_code = ?",
                )
                .bind(opening_debit)
                .bind(opening_credit)
                .bind(period_debit)
                .bind(period_credit)
                .bind(closing_debit)
                .bind(closing_credit)
                .bind(period_id)
                .bind(code)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("更新余额失败: {}", e))?;
            } else {
                sqlx::query(
                    "INSERT INTO account_balances (id, period_id, account_code, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(uuid::Uuid::new_v4().to_string())
                .bind(period_id)
                .bind(code)
                .bind(opening_debit)
                .bind(opening_credit)
                .bind(period_debit)
                .bind(period_credit)
                .bind(closing_debit)
                .bind(closing_credit)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("插入余额失败: {}", e))?;
            }

            prev_closing.insert(code.clone(), (closing_debit, closing_credit));
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {}", e))?;

    let msg = format!("重算完成: 清理{}个重复期间, 审批{}张草稿凭证, 新建{}个期间, 重算{}个期间余额", duplicates_removed, draft_count, periods_created, periods.len());
    log::info!("{}", msg);
    Ok(msg)
}
