use crate::commands::auth::authenticated_actor;
use crate::commands::period_guard::ensure_period_id_open;
use crate::db::{Database, DbPool, Invoice, InvoiceLine, InvoiceTaxEvent};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Clone, Deserialize)]
pub struct CreateInvoiceInput {
    pub company_id: String,
    pub period_id: Option<String>,
    pub invoice_type: String,
    pub invoice_no: String,
    pub invoice_code: Option<String>,
    pub invoice_date: String,
    pub amount: f64,
    pub tax_amount: f64,
    pub tax_rate: Option<f64>,
    pub seller_name: Option<String>,
    pub seller_tax_id: Option<String>,
    pub buyer_name: Option<String>,
    pub buyer_tax_id: Option<String>,
    pub remarks: Option<String>,
    pub lines: Vec<InvoiceLineInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateInvoiceInput {
    pub company_id: Option<String>,
    pub period_id: Option<String>,
    pub invoice_type: Option<String>,
    pub invoice_no: Option<String>,
    pub invoice_code: Option<String>,
    pub invoice_date: Option<String>,
    pub amount: Option<f64>,
    pub tax_amount: Option<f64>,
    pub tax_rate: Option<f64>,
    pub seller_name: Option<String>,
    pub seller_tax_id: Option<String>,
    pub buyer_name: Option<String>,
    pub buyer_tax_id: Option<String>,
    pub status: Option<String>,
    pub voucher_id: Option<String>,
    pub remarks: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceLineInput {
    pub item_name: String,
    pub specification: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<f64>,
    pub unit_price: Option<f64>,
    pub amount: f64,
    pub tax_rate: Option<f64>,
    pub tax_amount: f64,
    pub tax_classification_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateInvoiceTaxEventInput {
    pub event_type: String,
    pub deduction_period: Option<String>,
    pub deductible_tax_amount: f64,
    pub source: String,
    pub reference_no: Option<String>,
    pub remarks: Option<String>,
}

fn money_cents(value: f64) -> Result<i64, String> {
    if !value.is_finite() {
        return Err("金额必须是有限数值".to_string());
    }
    Ok((value * 100.0).round() as i64)
}

fn validate_invoice_line(line: &InvoiceLineInput, line_no: usize) -> Result<(), String> {
    if line.item_name.trim().is_empty() {
        return Err(format!("第 {} 行货物或服务名称不能为空", line_no + 1));
    }
    if money_cents(line.amount)? <= 0 {
        return Err(format!("第 {} 行不含税金额必须大于 0", line_no + 1));
    }
    if money_cents(line.tax_amount)? < 0 {
        return Err(format!("第 {} 行税额不能为负数", line_no + 1));
    }
    if let Some(rate) = line.tax_rate {
        if !rate.is_finite() || !(0.0..=1.0).contains(&rate) {
            return Err(format!("第 {} 行税率必须在 0 到 100% 之间", line_no + 1));
        }
    }
    if let Some(quantity) = line.quantity {
        if !quantity.is_finite() || quantity <= 0.0 {
            return Err(format!("第 {} 行数量必须大于 0", line_no + 1));
        }
    }
    if let Some(unit_price) = line.unit_price {
        if !unit_price.is_finite() || unit_price < 0.0 {
            return Err(format!("第 {} 行单价不能为负数", line_no + 1));
        }
    }
    Ok(())
}

async fn invoice_header_for_detail_change(
    pool: &DbPool,
    invoice_id: &str,
    company_id: &str,
) -> Result<(Option<String>, String, String, f64, f64, Option<String>), String> {
    sqlx::query_as(
        r#"SELECT period_id, invoice_type, status, amount, tax_amount, voucher_id
           FROM invoices WHERE id = ? AND company_id = ?"#,
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取发票失败: {error}"))?
    .ok_or_else(|| "发票不存在或不属于当前公司".to_string())
}

async fn replace_invoice_lines_record(
    pool: &DbPool,
    invoice_id: &str,
    company_id: &str,
    lines: Vec<InvoiceLineInput>,
    actor: &str,
) -> Result<Vec<InvoiceLine>, String> {
    if lines.is_empty() {
        return Err("发票至少需要一条货物或服务明细".to_string());
    }
    for (index, line) in lines.iter().enumerate() {
        validate_invoice_line(line, index)?;
    }

    let (period_id, _invoice_type, status, header_amount, header_tax_amount, voucher_id) =
        invoice_header_for_detail_change(pool, invoice_id, company_id).await?;
    if status != "pending" || voucher_id.is_some() {
        return Err("只有待复核且未关联凭证的发票可以修改明细".to_string());
    }
    if let Some(period_id) = period_id.as_deref() {
        ensure_period_id_open(pool, company_id, period_id, "维护发票明细").await?;
    }

    let detail_amount_cents = lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.amount).map(|value| total + value)
    })?;
    let detail_tax_cents = lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.tax_amount).map(|value| total + value)
    })?;
    if detail_amount_cents != money_cents(header_amount)?
        || detail_tax_cents != money_cents(header_tax_amount)?
    {
        return Err(format!(
            "明细合计必须与表头一致：明细金额 {:.2}、税额 {:.2}，表头金额 {:.2}、税额 {:.2}",
            detail_amount_cents as f64 / 100.0,
            detail_tax_cents as f64 / 100.0,
            header_amount,
            header_tax_amount
        ));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("启动发票明细事务失败: {error}"))?;
    sqlx::query("DELETE FROM invoice_lines WHERE invoice_id = ? AND company_id = ?")
        .bind(invoice_id)
        .bind(company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理原发票明细失败: {error}"))?;

    for (index, line) in lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO invoice_lines
               (id, invoice_id, company_id, line_no, item_name, specification, unit,
                quantity, unit_price, amount, tax_rate, tax_amount, tax_classification_code,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(invoice_id)
        .bind(company_id)
        .bind((index + 1) as i32)
        .bind(line.item_name.trim())
        .bind(line.specification.as_deref())
        .bind(line.unit.as_deref())
        .bind(line.quantity)
        .bind(line.unit_price)
        .bind(line.amount)
        .bind(line.tax_rate)
        .bind(line.tax_amount)
        .bind(line.tax_classification_code.as_deref())
        .bind(&now)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存发票明细失败: {error}"))?;
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '维护发票明细', ?, 'normal', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(invoice_id)
    .bind(format!("保存 {} 条明细，金额与税额已核对表头", lines.len()))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入发票明细审计失败: {error}"))?;

    let stored = sqlx::query_as::<_, InvoiceLine>(
        "SELECT * FROM invoice_lines WHERE invoice_id = ? AND company_id = ? ORDER BY line_no",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("读取发票明细失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交发票明细事务失败: {error}"))?;
    Ok(stored)
}

fn validate_deduction_period(period: &str) -> bool {
    let bytes = period.as_bytes();
    bytes.len() == 7
        && bytes[4] == b'-'
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..].iter().all(u8::is_ascii_digit)
        && period[5..]
            .parse::<u8>()
            .is_ok_and(|month| (1..=12).contains(&month))
}

async fn create_invoice_tax_event_record(
    pool: &DbPool,
    invoice_id: &str,
    company_id: &str,
    input: CreateInvoiceTaxEventInput,
    actor: &str,
) -> Result<InvoiceTaxEvent, String> {
    const ALLOWED_EVENT_TYPES: [&str; 4] = [
        "certification_review_passed",
        "deduction_declared",
        "deduction_transferred_out",
        "not_deductible",
    ];
    if !ALLOWED_EVENT_TYPES.contains(&input.event_type.as_str()) {
        return Err("不支持的进项税处理类型".to_string());
    }
    if input.source.trim().is_empty() {
        return Err("税务处理来源不能为空".to_string());
    }
    if let Some(period) = input.deduction_period.as_deref() {
        if !validate_deduction_period(period) {
            return Err("抵扣所属期必须使用 YYYY-MM 格式".to_string());
        }
    }

    let (period_id, invoice_type, status, _amount, tax_amount, _voucher_id) =
        invoice_header_for_detail_change(pool, invoice_id, company_id).await?;
    if invoice_type != "input" {
        return Err("只有进项发票可以登记认证与抵扣历史".to_string());
    }
    if let Some(period_id) = period_id.as_deref() {
        ensure_period_id_open(pool, company_id, period_id, "登记进项税处理").await?;
    }
    let line_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = ? AND company_id = ?",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("核对发票明细失败: {error}"))?;
    if line_count == 0 {
        return Err("请先补齐并核对发票货物或服务明细，再登记认证或抵扣记录".to_string());
    }
    let deductible_cents = money_cents(input.deductible_tax_amount)?;
    if deductible_cents < 0 || deductible_cents > money_cents(tax_amount)? {
        return Err("本次抵扣税额必须在 0 与发票税额之间".to_string());
    }
    if input.event_type == "certification_review_passed" && status != "pending" {
        return Err("只有待认证发票可以登记认证复核通过".to_string());
    }
    if input.event_type != "certification_review_passed"
        && !matches!(status.as_str(), "verified" | "matched")
    {
        return Err("抵扣、转出或不抵扣记录只能登记在已认证发票上".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("启动进项税处理事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO invoice_tax_events
           (id, invoice_id, company_id, event_type, deduction_period, deductible_tax_amount,
            source, reference_no, remarks, operator, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(invoice_id)
    .bind(company_id)
    .bind(&input.event_type)
    .bind(input.deduction_period.as_deref())
    .bind(input.deductible_tax_amount)
    .bind(input.source.trim())
    .bind(input.reference_no.as_deref())
    .bind(input.remarks.as_deref())
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存进项税处理记录失败: {error}"))?;

    if input.event_type == "certification_review_passed" {
        let result = sqlx::query(
            "UPDATE invoices SET status = 'verified', updated_at = ? WHERE id = ? AND company_id = ? AND status = 'pending'",
        )
        .bind(&now)
        .bind(invoice_id)
        .bind(company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新发票认证状态失败: {error}"))?;
        if result.rows_affected() != 1 {
            return Err("发票状态已变化，请刷新后重试".to_string());
        }
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '登记进项税处理', ?, 'high', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(invoice_id)
    .bind(format!(
        "处理类型 {}，抵扣所属期 {}，税额 {:.2}，来源 {}",
        input.event_type,
        input.deduction_period.as_deref().unwrap_or("未指定"),
        input.deductible_tax_amount,
        input.source.trim()
    ))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入进项税处理审计失败: {error}"))?;

    let event = sqlx::query_as::<_, InvoiceTaxEvent>(
        "SELECT * FROM invoice_tax_events WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(company_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取进项税处理记录失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交进项税处理事务失败: {error}"))?;
    Ok(event)
}

#[tauri::command]
pub async fn get_invoices(
    company_id: Option<String>,
    period_id: Option<String>,
    invoice_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<Invoice>, String> {
    log::info!(
        "Fetching invoices - company: {:?}, period: {:?}, type: {:?}",
        company_id,
        period_id,
        invoice_type
    );

    let invoices: Vec<Invoice> = match (company_id.as_ref(), period_id.as_ref(), invoice_type.as_ref()) {
        (Some(cid), Some(pid), Some(it)) => {
            sqlx::query_as(
                "SELECT * FROM invoices WHERE company_id = ? AND period_id = ? AND invoice_type = ? ORDER BY invoice_date DESC",
            )
            .bind(cid).bind(pid).bind(it)
            .fetch_all(db.pool()).await
        }
        (Some(cid), None, Some(it)) => {
            sqlx::query_as(
                "SELECT * FROM invoices WHERE company_id = ? AND invoice_type = ? ORDER BY invoice_date DESC",
            )
            .bind(cid).bind(it)
            .fetch_all(db.pool()).await
        }
        (Some(cid), Some(pid), None) => {
            sqlx::query_as(
                "SELECT * FROM invoices WHERE company_id = ? AND period_id = ? ORDER BY invoice_date DESC",
            )
            .bind(cid).bind(pid)
            .fetch_all(db.pool()).await
        }
        (Some(cid), None, None) => {
            sqlx::query_as(
                "SELECT * FROM invoices WHERE company_id = ? ORDER BY invoice_date DESC",
            )
            .bind(cid)
            .fetch_all(db.pool()).await
        }
        (None, _, _) => {
            return Err("company_id is required for invoice queries".to_string());
        }
    }.map_err(|e| format!("Database error: {}", e))?;

    log::info!("Found {} invoices", invoices.len());
    Ok(invoices)
}

#[tauri::command]
pub async fn get_invoice(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<Invoice>, String> {
    log::info!("Fetching invoice: {} for company: {}", id, company_id);

    let invoice: Option<Invoice> =
        sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    Ok(invoice)
}

#[tauri::command]
pub async fn create_invoice(
    input: CreateInvoiceInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Invoice, String> {
    log::info!(
        "Creating invoice: {} for company: {}",
        input.invoice_no,
        input.company_id
    );

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let total_amount = input.amount + input.tax_amount;
    money_cents(input.amount)?;
    money_cents(input.tax_amount)?;
    if input.amount <= 0.0 || input.tax_amount < 0.0 {
        return Err("发票金额必须大于 0，税额不能为负数".to_string());
    }
    if let Some(period_id) = input.period_id.as_deref() {
        ensure_period_id_open(db.pool(), &input.company_id, period_id, "新增发票").await?;
    }
    if input.lines.is_empty() {
        return Err("发票至少需要一条货物或服务明细".to_string());
    }
    for (index, line) in input.lines.iter().enumerate() {
        validate_invoice_line(line, index)?;
    }
    let detail_amount_cents = input.lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.amount).map(|value| total + value)
    })?;
    let detail_tax_cents = input.lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.tax_amount).map(|value| total + value)
    })?;
    if detail_amount_cents != money_cents(input.amount)?
        || detail_tax_cents != money_cents(input.tax_amount)?
    {
        return Err("发票明细金额和税额必须分别与表头一致".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动发票登记事务失败: {error}"))?;

    sqlx::query(
        r#"
        INSERT INTO invoices (id, company_id, period_id, invoice_type, invoice_no, invoice_code,
            invoice_date, amount, tax_amount, total_amount, tax_rate, seller_name, seller_tax_id,
            buyer_name, buyer_tax_id, status, remarks, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&input.invoice_type)
    .bind(&input.invoice_no)
    .bind(&input.invoice_code)
    .bind(&input.invoice_date)
    .bind(input.amount)
    .bind(input.tax_amount)
    .bind(total_amount)
    .bind(input.tax_rate)
    .bind(&input.seller_name)
    .bind(&input.seller_tax_id)
    .bind(&input.buyer_name)
    .bind(&input.buyer_tax_id)
    .bind(&input.remarks)
    .bind(&now)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create invoice: {}", e))?;

    for (index, line) in input.lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO invoice_lines
               (id, invoice_id, company_id, line_no, item_name, specification, unit,
                quantity, unit_price, amount, tax_rate, tax_amount, tax_classification_code,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(&input.company_id)
        .bind((index + 1) as i32)
        .bind(line.item_name.trim())
        .bind(line.specification.as_deref())
        .bind(line.unit.as_deref())
        .bind(line.quantity)
        .bind(line.unit_price)
        .bind(line.amount)
        .bind(line.tax_rate)
        .bind(line.tax_amount)
        .bind(line.tax_classification_code.as_deref())
        .bind(&now)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存发票明细失败: {error}"))?;
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '登记发票', ?, 'normal', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&id)
    .bind(format!(
        "登记 {} 发票 {}，明细 {} 条",
        input.invoice_type,
        input.invoice_no,
        input.lines.len()
    ))
    .bind(&actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入发票登记审计失败: {error}"))?;

    let invoice: Invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&input.company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交发票登记事务失败: {error}"))?;

    log::info!("Invoice created: {}", id);
    Ok(invoice)
}

async fn update_invoice_with_lines_record(
    pool: &DbPool,
    id: &str,
    input: UpdateInvoiceInput,
    lines: Vec<InvoiceLineInput>,
    actor: &str,
) -> Result<Invoice, String> {
    if lines.is_empty() {
        return Err("发票至少需要一条货物或服务明细".to_string());
    }
    for (index, line) in lines.iter().enumerate() {
        validate_invoice_line(line, index)?;
    }
    if input.status.is_some() || input.voucher_id.is_some() {
        return Err("发票状态和凭证关联必须通过专用业务流程变更".to_string());
    }

    let existing: Invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取发票失败: {error}"))?
        .ok_or_else(|| "发票不存在".to_string())?;
    if input
        .company_id
        .as_deref()
        .is_some_and(|company_id| company_id != existing.company_id)
    {
        return Err("发票不存在或不属于当前公司".to_string());
    }
    if existing.status != "pending" || existing.voucher_id.is_some() {
        return Err("只有待复核且未关联凭证的发票可以修改".to_string());
    }
    if let Some(period_id) = existing.period_id.as_deref() {
        ensure_period_id_open(pool, &existing.company_id, period_id, "修改发票及明细").await?;
    }
    if let Some(period_id) = input.period_id.as_deref() {
        if existing.period_id.as_deref() != Some(period_id) {
            ensure_period_id_open(pool, &existing.company_id, period_id, "调整发票所属期").await?;
        }
    }

    let target_amount = input.amount.unwrap_or(existing.amount);
    let target_tax_amount = input.tax_amount.unwrap_or(existing.tax_amount);
    let detail_amount_cents = lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.amount).map(|value| total + value)
    })?;
    let detail_tax_cents = lines.iter().try_fold(0_i64, |total, line| {
        money_cents(line.tax_amount).map(|value| total + value)
    })?;
    if detail_amount_cents != money_cents(target_amount)?
        || detail_tax_cents != money_cents(target_tax_amount)?
    {
        return Err("发票明细金额和税额必须分别与更新后的表头一致".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("启动发票更新事务失败: {error}"))?;
    let result = sqlx::query(
        r#"UPDATE invoices SET
            period_id = COALESCE(?, period_id),
            invoice_type = COALESCE(?, invoice_type),
            invoice_no = COALESCE(?, invoice_no),
            invoice_code = COALESCE(?, invoice_code),
            invoice_date = COALESCE(?, invoice_date),
            amount = COALESCE(?, amount),
            tax_amount = COALESCE(?, tax_amount),
            total_amount = COALESCE(?, amount) + COALESCE(?, tax_amount),
            tax_rate = COALESCE(?, tax_rate),
            seller_name = COALESCE(?, seller_name),
            seller_tax_id = COALESCE(?, seller_tax_id),
            buyer_name = COALESCE(?, buyer_name),
            buyer_tax_id = COALESCE(?, buyer_tax_id),
            remarks = COALESCE(?, remarks),
            updated_at = ?
        WHERE id = ? AND company_id = ? AND status = 'pending' AND voucher_id IS NULL"#,
    )
    .bind(input.period_id.as_deref())
    .bind(input.invoice_type.as_deref())
    .bind(input.invoice_no.as_deref())
    .bind(input.invoice_code.as_deref())
    .bind(input.invoice_date.as_deref())
    .bind(input.amount)
    .bind(input.tax_amount)
    .bind(input.amount)
    .bind(input.tax_amount)
    .bind(input.tax_rate)
    .bind(input.seller_name.as_deref())
    .bind(input.seller_tax_id.as_deref())
    .bind(input.buyer_name.as_deref())
    .bind(input.buyer_tax_id.as_deref())
    .bind(input.remarks.as_deref())
    .bind(&now)
    .bind(id)
    .bind(&existing.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新发票表头失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("发票状态已变化，请刷新后重试".to_string());
    }

    sqlx::query("DELETE FROM invoice_lines WHERE invoice_id = ? AND company_id = ?")
        .bind(id)
        .bind(&existing.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理原发票明细失败: {error}"))?;
    for (index, line) in lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO invoice_lines
               (id, invoice_id, company_id, line_no, item_name, specification, unit,
                quantity, unit_price, amount, tax_rate, tax_amount, tax_classification_code,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(id)
        .bind(&existing.company_id)
        .bind((index + 1) as i32)
        .bind(line.item_name.trim())
        .bind(line.specification.as_deref())
        .bind(line.unit.as_deref())
        .bind(line.quantity)
        .bind(line.unit_price)
        .bind(line.amount)
        .bind(line.tax_rate)
        .bind(line.tax_amount)
        .bind(line.tax_classification_code.as_deref())
        .bind(&now)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存发票明细失败: {error}"))?;
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '更新发票及明细', ?, 'normal', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&existing.company_id)
    .bind(id)
    .bind(format!("更新发票表头并保存 {} 条核对明细", lines.len()))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入发票更新审计失败: {error}"))?;

    let invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&existing.company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取更新后发票失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交发票更新事务失败: {error}"))?;
    Ok(invoice)
}

#[tauri::command]
pub async fn update_invoice_with_lines(
    id: String,
    input: UpdateInvoiceInput,
    lines: Vec<InvoiceLineInput>,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Invoice, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    update_invoice_with_lines_record(db.pool(), &id, input, lines, &actor).await
}

async fn review_output_invoice_record(
    pool: &DbPool,
    invoice_id: &str,
    company_id: &str,
    actor: &str,
) -> Result<Invoice, String> {
    let invoice: Invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(invoice_id)
        .bind(company_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取销项发票失败: {error}"))?
        .ok_or_else(|| "销项发票不存在或不属于当前公司".to_string())?;
    if invoice.invoice_type != "output" {
        return Err("只有销项发票可以执行收入与税额复核".to_string());
    }
    if invoice.status != "pending" || invoice.voucher_id.is_some() {
        return Err("只有待复核且未关联凭证的销项发票可以完成复核".to_string());
    }
    if let Some(period_id) = invoice.period_id.as_deref() {
        ensure_period_id_open(pool, company_id, period_id, "复核销项发票").await?;
    }

    let detail_totals: (i64, Option<f64>, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(*), SUM(amount), SUM(tax_amount) FROM invoice_lines WHERE invoice_id = ? AND company_id = ?",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("核对销项发票明细失败: {error}"))?;
    if detail_totals.0 == 0 {
        return Err("请先补齐并核对销项发票货物或服务明细".to_string());
    }
    if money_cents(detail_totals.1.unwrap_or_default())? != money_cents(invoice.amount)?
        || money_cents(detail_totals.2.unwrap_or_default())? != money_cents(invoice.tax_amount)?
    {
        return Err("销项发票明细合计与表头不一致，不能完成复核".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("启动销项发票复核事务失败: {error}"))?;
    let result = sqlx::query(
        "UPDATE invoices SET status = 'verified', updated_at = ? WHERE id = ? AND company_id = ? AND invoice_type = 'output' AND status = 'pending' AND voucher_id IS NULL",
    )
    .bind(&now)
    .bind(invoice_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新销项发票复核状态失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("销项发票状态已变化，请刷新后重试".to_string());
    }
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '复核销项发票', ?, 'normal', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(invoice_id)
    .bind(format!(
        "销项发票 {} 已完成本地收入、税额和明细合计复核",
        invoice.invoice_no
    ))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入销项发票复核审计失败: {error}"))?;
    let reviewed = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(invoice_id)
        .bind(company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取销项发票复核结果失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交销项发票复核事务失败: {error}"))?;
    Ok(reviewed)
}

#[tauri::command]
pub async fn review_output_invoice(
    invoice_id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Invoice, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    review_output_invoice_record(db.pool(), &invoice_id, &company_id, &actor).await
}

#[tauri::command]
pub async fn delete_invoice(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    delete_invoice_record(db.pool(), &id, &company_id, &actor).await
}

async fn delete_invoice_record(
    pool: &DbPool,
    id: &str,
    company_id: &str,
    actor: &str,
) -> Result<(), String> {
    log::info!("Deleting invoice: {} for company: {}", id, company_id);

    let invoice: Option<(Option<String>, String, Option<String>, String)> = sqlx::query_as(
        "SELECT period_id, status, voucher_id, invoice_no FROM invoices WHERE id = ? AND company_id = ?",
    )
            .bind(&id)
            .bind(&company_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    let (period_id, status, voucher_id, invoice_no) =
        invoice.ok_or_else(|| "发票不存在或不属于当前公司".to_string())?;
    if status != "pending" || voucher_id.is_some() {
        return Err("只有待复核且未关联凭证的发票可以删除".to_string());
    }
    if let Some(period_id) = period_id.as_deref() {
        ensure_period_id_open(pool, company_id, period_id, "删除发票").await?;
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("启动发票删除事务失败: {error}"))?;
    sqlx::query("DELETE FROM invoice_tags WHERE invoice_id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理发票标签失败: {error}"))?;
    let result = sqlx::query(
        "DELETE FROM invoices WHERE id = ? AND company_id = ? AND status = 'pending' AND voucher_id IS NULL",
    )
    .bind(id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("删除发票失败: {error}"))?;

    if result.rows_affected() == 0 {
        return Err("发票状态已变化，请刷新后重试".to_string());
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '删除发票', ?, 'high', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(id)
    .bind(format!("删除待复核发票 {invoice_no}"))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入发票删除审计失败: {error}"))?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交发票删除事务失败: {error}"))?;

    log::info!("Invoice deleted: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn match_invoice_to_voucher(
    invoice_id: String,
    voucher_id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    match_invoice_to_voucher_record(db.pool(), &invoice_id, &voucher_id, &company_id, &actor).await
}

async fn match_invoice_to_voucher_record(
    pool: &DbPool,
    invoice_id: &str,
    voucher_id: &str,
    company_id: &str,
    actor: &str,
) -> Result<(), String> {
    log::info!(
        "Matching invoice {} to voucher {} for company: {}",
        invoice_id,
        voucher_id,
        company_id
    );

    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start invoice matching transaction: {}", e))?;

    let invoice: Option<(String, Option<String>, String, Option<String>, f64, f64)> = sqlx::query_as(
        "SELECT invoice_no, period_id, status, voucher_id, amount, tax_amount FROM invoices WHERE id = ? AND company_id = ?",
    )
    .bind(&invoice_id)
    .bind(&company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let Some((invoice_no, invoice_period_id, status, linked_voucher_id, amount, tax_amount)) =
        invoice
    else {
        return Err("发票不存在或不属于当前公司".to_string());
    };
    if status != "verified" || linked_voucher_id.is_some() {
        return Err("只有已复核且尚未关联凭证的发票可以生成凭证".to_string());
    }

    let voucher: Option<(String, String, String)> = sqlx::query_as(
        "SELECT id, period_id, status FROM vouchers WHERE id = ? AND company_id = ?",
    )
    .bind(&voucher_id)
    .bind(&company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let Some((_voucher_record_id, voucher_period_id, voucher_status)) = voucher else {
        return Err("凭证不存在或不属于当前公司".to_string());
    };
    if voucher_status != "draft" {
        return Err("只有草稿凭证可以关联发票".to_string());
    }
    ensure_period_id_open(pool, company_id, &voucher_period_id, "关联发票与凭证").await?;
    if let Some(invoice_period_id) = invoice_period_id.as_deref() {
        ensure_period_id_open(pool, company_id, invoice_period_id, "关联发票与凭证").await?;
        if invoice_period_id != voucher_period_id {
            return Err("发票与凭证不属于同一账期".to_string());
        }
    }

    let detail: (i64, f64, f64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(amount), 0), COALESCE(SUM(tax_amount), 0) FROM invoice_lines WHERE invoice_id = ? AND company_id = ?",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("核对发票明细失败: {error}"))?;
    if detail.0 == 0 {
        return Err("请先补齐并核对发票货物或服务明细，再关联凭证".to_string());
    }
    if money_cents(detail.1)? != money_cents(amount)?
        || money_cents(detail.2)? != money_cents(tax_amount)?
    {
        return Err("发票明细合计与表头不一致，不能关联凭证".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query(
        "UPDATE invoices SET voucher_id = ?, status = 'matched', updated_at = ? WHERE id = ? AND company_id = ? AND status = 'verified' AND voucher_id IS NULL",
    )
    .bind(&voucher_id)
    .bind(&now)
    .bind(&invoice_id)
    .bind(&company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to match invoice: {}", e))?;
    if result.rows_affected() == 0 {
        return Err("发票状态已变化，请刷新后重试".to_string());
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '发票管理', '关联发票与凭证', ?, 'normal', 'success', ?, ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(invoice_id)
    .bind(format!("发票 {invoice_no} 已关联草稿凭证 {voucher_id}"))
    .bind(actor)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入发票关联审计失败: {error}"))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Failed to commit invoice matching transaction: {}", e))?;

    log::info!("Invoice matched to voucher");
    Ok(())
}

#[tauri::command]
pub async fn get_invoices_by_voucher(
    voucher_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Invoice>, String> {
    log::info!(
        "Fetching invoices for voucher: {} in company: {}",
        voucher_id,
        company_id
    );

    sqlx::query_as::<_, Invoice>(
        "SELECT * FROM invoices WHERE voucher_id = ? AND company_id = ? ORDER BY invoice_date DESC",
    )
    .bind(&voucher_id)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_invoice_lines(
    invoice_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InvoiceLine>, String> {
    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM invoices WHERE id = ? AND company_id = ?")
            .bind(&invoice_id)
            .bind(&company_id)
            .fetch_one(db.pool())
            .await
            .map_err(|error| format!("读取发票失败: {error}"))?;
    if exists != 1 {
        return Err("发票不存在或不属于当前公司".to_string());
    }
    sqlx::query_as(
        "SELECT * FROM invoice_lines WHERE invoice_id = ? AND company_id = ? ORDER BY line_no",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取发票明细失败: {error}"))
}

#[tauri::command]
pub async fn replace_invoice_lines(
    invoice_id: String,
    company_id: String,
    lines: Vec<InvoiceLineInput>,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Vec<InvoiceLine>, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    replace_invoice_lines_record(db.pool(), &invoice_id, &company_id, lines, &actor).await
}

#[tauri::command]
pub async fn get_invoice_tax_events(
    invoice_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InvoiceTaxEvent>, String> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM invoices WHERE id = ? AND company_id = ? AND invoice_type = 'input'",
    )
    .bind(&invoice_id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("读取进项发票失败: {error}"))?;
    if exists != 1 {
        return Err("进项发票不存在或不属于当前公司".to_string());
    }
    sqlx::query_as(
        "SELECT * FROM invoice_tax_events WHERE invoice_id = ? AND company_id = ? ORDER BY occurred_at DESC, id DESC",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取进项税处理历史失败: {error}"))
}

#[tauri::command]
pub async fn create_invoice_tax_event(
    invoice_id: String,
    company_id: String,
    input: CreateInvoiceTaxEventInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InvoiceTaxEvent, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_invoice_tax_event_record(db.pool(), &invoice_id, &company_id, input, &actor).await
}

#[cfg(test)]
mod tests {
    use super::{
        create_invoice_tax_event_record, delete_invoice_record, match_invoice_to_voucher_record,
        replace_invoice_lines_record, review_output_invoice_record,
        update_invoice_with_lines_record, CreateInvoiceTaxEventInput, InvoiceLineInput,
        UpdateInvoiceInput,
    };
    use crate::db::Database;

    #[tokio::test]
    async fn invoice_lines_must_reconcile_to_header_and_replace_atomically() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-lines-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount) VALUES ('invoice-1', 'company-1', 'input', 'INV-001', '2026-06-01', 100, 13, 113)",
        )
        .execute(database.pool())
        .await
        .expect("creates invoice");

        let lines = vec![
            InvoiceLineInput {
                item_name: "办公用品".to_string(),
                specification: Some("A4".to_string()),
                unit: Some("箱".to_string()),
                quantity: Some(1.0),
                unit_price: Some(60.0),
                amount: 60.0,
                tax_rate: Some(0.13),
                tax_amount: 7.8,
                tax_classification_code: Some("1060501".to_string()),
            },
            InvoiceLineInput {
                item_name: "耗材".to_string(),
                specification: None,
                unit: Some("批".to_string()),
                quantity: Some(1.0),
                unit_price: Some(40.0),
                amount: 40.0,
                tax_rate: Some(0.13),
                tax_amount: 5.2,
                tax_classification_code: None,
            },
        ];
        let stored = replace_invoice_lines_record(
            database.pool(),
            "invoice-1",
            "company-1",
            lines,
            "测试会计",
        )
        .await
        .expect("stores reconciled lines");
        assert_eq!(stored.len(), 2);
        assert_eq!(stored[0].line_no, 1);
        assert_eq!(stored[1].line_no, 2);

        let mismatch = replace_invoice_lines_record(
            database.pool(),
            "invoice-1",
            "company-1",
            vec![InvoiceLineInput {
                item_name: "错误金额".to_string(),
                specification: None,
                unit: None,
                quantity: None,
                unit_price: None,
                amount: 99.0,
                tax_rate: Some(0.13),
                tax_amount: 12.87,
                tax_classification_code: None,
            }],
            "测试会计",
        )
        .await;
        assert!(
            mismatch.is_err(),
            "line totals must reconcile to the header"
        );
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = 'invoice-1'")
                .fetch_one(database.pool())
                .await
                .expect("counts retained lines");
        assert_eq!(count, 2, "failed replacement must keep prior lines");

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn invoice_tax_events_are_immutable_and_audited() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-tax-event-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount) VALUES ('invoice-1', 'company-1', 'input', 'INV-001', '2026-06-01', 100, 13, 113)",
        )
        .execute(database.pool())
        .await
        .expect("creates invoice");

        replace_invoice_lines_record(
            database.pool(),
            "invoice-1",
            "company-1",
            vec![InvoiceLineInput {
                item_name: "咨询服务".to_string(),
                specification: None,
                unit: Some("项".to_string()),
                quantity: Some(1.0),
                unit_price: Some(100.0),
                amount: 100.0,
                tax_rate: Some(0.13),
                tax_amount: 13.0,
                tax_classification_code: None,
            }],
            "测试会计",
        )
        .await
        .expect("stores invoice detail before tax review");

        let event = create_invoice_tax_event_record(
            database.pool(),
            "invoice-1",
            "company-1",
            CreateInvoiceTaxEventInput {
                event_type: "certification_review_passed".to_string(),
                deduction_period: Some("2026-06".to_string()),
                deductible_tax_amount: 13.0,
                source: "人工复核".to_string(),
                reference_no: None,
                remarks: Some("本地复核记录，不代表税局提交".to_string()),
            },
            "测试会计",
        )
        .await
        .expect("records certification review");
        assert_eq!(event.operator, "测试会计");

        let status: String =
            sqlx::query_scalar("SELECT status FROM invoices WHERE id = 'invoice-1'")
                .fetch_one(database.pool())
                .await
                .expect("reads updated invoice status");
        assert_eq!(status, "verified");
        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE company_id = 'company-1' AND module_name = '发票管理' AND action = '登记进项税处理' AND object_ref = 'invoice-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts audit rows");
        assert_eq!(audit_count, 1);

        assert!(
            sqlx::query("UPDATE invoice_tax_events SET remarks = 'tampered' WHERE id = ?")
                .bind(&event.id)
                .execute(database.pool())
                .await
                .is_err(),
            "tax history must reject updates"
        );
        assert!(
            sqlx::query("DELETE FROM invoice_tax_events WHERE id = ?")
                .bind(&event.id)
                .execute(database.pool())
                .await
                .is_err(),
            "tax history must reject deletes"
        );

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn invoice_header_and_lines_update_rolls_back_as_one_unit() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-detail-update-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount) VALUES ('invoice-1', 'company-1', 'output', 'INV-OLD', '2026-06-01', 100, 13, 113)",
        )
        .execute(database.pool())
        .await
        .expect("creates invoice");
        replace_invoice_lines_record(
            database.pool(),
            "invoice-1",
            "company-1",
            vec![InvoiceLineInput {
                item_name: "原服务".to_string(),
                specification: None,
                unit: Some("项".to_string()),
                quantity: Some(1.0),
                unit_price: Some(100.0),
                amount: 100.0,
                tax_rate: Some(0.13),
                tax_amount: 13.0,
                tax_classification_code: None,
            }],
            "测试会计",
        )
        .await
        .expect("stores original line");

        let result = update_invoice_with_lines_record(
            database.pool(),
            "invoice-1",
            UpdateInvoiceInput {
                company_id: Some("company-1".to_string()),
                period_id: None,
                invoice_type: None,
                invoice_no: Some("INV-NEW".to_string()),
                invoice_code: None,
                invoice_date: None,
                amount: Some(200.0),
                tax_amount: Some(26.0),
                tax_rate: Some(0.13),
                seller_name: None,
                seller_tax_id: None,
                buyer_name: None,
                buyer_tax_id: None,
                status: None,
                voucher_id: None,
                remarks: None,
            },
            vec![InvoiceLineInput {
                item_name: "错误合计".to_string(),
                specification: None,
                unit: Some("项".to_string()),
                quantity: Some(1.0),
                unit_price: Some(199.0),
                amount: 199.0,
                tax_rate: Some(0.13),
                tax_amount: 25.87,
                tax_classification_code: None,
            }],
            "测试会计",
        )
        .await;
        assert!(result.is_err(), "mismatched detail update must fail");
        let header: (String, f64, f64) = sqlx::query_as(
            "SELECT invoice_no, amount, tax_amount FROM invoices WHERE id = 'invoice-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads unchanged header");
        assert_eq!(header, ("INV-OLD".to_string(), 100.0, 13.0));
        let line: (String, f64, f64) = sqlx::query_as(
            "SELECT item_name, amount, tax_amount FROM invoice_lines WHERE invoice_id = 'invoice-1'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads unchanged line");
        assert_eq!(line, ("原服务".to_string(), 100.0, 13.0));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn output_invoice_review_requires_reconciled_lines_and_writes_audit() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-output-invoice-review-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount) VALUES ('invoice-1', 'company-1', 'output', 'OUT-001', '2026-06-01', 100, 13, 113)",
        )
        .execute(database.pool())
        .await
        .expect("creates invoice");

        assert!(
            review_output_invoice_record(database.pool(), "invoice-1", "company-1", "复核会计")
                .await
                .is_err(),
            "review must reject header-only invoices"
        );
        replace_invoice_lines_record(
            database.pool(),
            "invoice-1",
            "company-1",
            vec![InvoiceLineInput {
                item_name: "技术服务".to_string(),
                specification: None,
                unit: Some("项".to_string()),
                quantity: Some(1.0),
                unit_price: Some(100.0),
                amount: 100.0,
                tax_rate: Some(0.13),
                tax_amount: 13.0,
                tax_classification_code: None,
            }],
            "复核会计",
        )
        .await
        .expect("stores output invoice line");
        let invoice =
            review_output_invoice_record(database.pool(), "invoice-1", "company-1", "复核会计")
                .await
                .expect("reviews output invoice");
        assert_eq!(invoice.status, "verified");
        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE action = '复核销项发票' AND object_ref = 'invoice-1' AND operator = '复核会计'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts review audit");
        assert_eq!(audit_count, 1);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn invoice_delete_rejects_reviewed_or_linked_records() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-delete-guard-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount, status) VALUES ('invoice-1', 'company-1', 'output', 'OUT-REVIEWED', '2026-06-01', 100, 13, 113, 'verified')",
        )
        .execute(database.pool())
        .await
        .expect("creates reviewed invoice");

        let result =
            delete_invoice_record(database.pool(), "invoice-1", "company-1", "测试会计").await;
        assert!(result.is_err(), "reviewed invoices must not be deleted");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM invoices WHERE id = 'invoice-1'")
            .fetch_one(database.pool())
            .await
            .expect("counts retained invoice");
        assert_eq!(count, 1);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn invoice_delete_and_audit_commit_atomically() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-delete-audit-test-{}",
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
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount) VALUES ('invoice-1', 'company-1', 'output', 'OUT-DRAFT', '2026-06-01', 100, 13, 113)",
        )
        .execute(database.pool())
        .await
        .expect("creates draft invoice");
        sqlx::query(
            "CREATE TRIGGER reject_invoice_delete_audit BEFORE INSERT ON operation_audit_logs WHEN NEW.action = '删除发票' BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END",
        )
        .execute(database.pool())
        .await
        .expect("installs audit failure trigger");

        let failed =
            delete_invoice_record(database.pool(), "invoice-1", "company-1", "删除会计").await;
        assert!(failed.is_err(), "audit failure must abort invoice deletion");
        let retained: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM invoices WHERE id = 'invoice-1'")
                .fetch_one(database.pool())
                .await
                .expect("counts retained invoice");
        assert_eq!(retained, 1, "failed audit must roll back deletion");

        sqlx::query("DROP TRIGGER reject_invoice_delete_audit")
            .execute(database.pool())
            .await
            .expect("removes audit failure trigger");
        delete_invoice_record(database.pool(), "invoice-1", "company-1", "删除会计")
            .await
            .expect("deletes draft invoice with audit");
        let audit: (String, String) = sqlx::query_as(
            "SELECT operator, object_ref FROM operation_audit_logs WHERE action = '删除发票'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads deletion audit");
        assert_eq!(audit, ("删除会计".to_string(), "invoice-1".to_string()));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }

    #[tokio::test]
    async fn invoice_voucher_matching_requires_lines_and_writes_audit() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-invoice-match-audit-test-{}",
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
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date) VALUES ('period-1', 'company-1', 2026, 6, '2026-06-01', '2026-06-30')",
        )
        .execute(database.pool())
        .await
        .expect("creates period");
        sqlx::query(
            "INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('word-1', 'company-1', '记', '记')",
        )
        .execute(database.pool())
        .await
        .expect("creates voucher word");
        sqlx::query(
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status) VALUES ('voucher-1', 'company-1', 'period-1', 'word-1', '记-1', 1, '2026-06-30', 'draft')",
        )
        .execute(database.pool())
        .await
        .expect("creates draft voucher");
        sqlx::query(
            "INSERT INTO invoices (id, company_id, period_id, invoice_type, invoice_no, invoice_date, amount, tax_amount, total_amount, status) VALUES ('invoice-1', 'company-1', 'period-1', 'output', 'OUT-001', '2026-06-01', 100, 13, 113, 'verified')",
        )
        .execute(database.pool())
        .await
        .expect("creates verified invoice");

        let without_lines = match_invoice_to_voucher_record(
            database.pool(),
            "invoice-1",
            "voucher-1",
            "company-1",
            "制证会计",
        )
        .await;
        assert!(
            without_lines.is_err(),
            "header-only invoices must not link to vouchers"
        );
        sqlx::query(
            "INSERT INTO invoice_lines (id, invoice_id, company_id, line_no, item_name, amount, tax_amount) VALUES ('line-1', 'invoice-1', 'company-1', 1, '技术服务', 100, 13)",
        )
        .execute(database.pool())
        .await
        .expect("creates reconciled line");

        match_invoice_to_voucher_record(
            database.pool(),
            "invoice-1",
            "voucher-1",
            "company-1",
            "制证会计",
        )
        .await
        .expect("links invoice to voucher");
        let invoice: (String, String) =
            sqlx::query_as("SELECT status, voucher_id FROM invoices WHERE id = 'invoice-1'")
                .fetch_one(database.pool())
                .await
                .expect("reads matched invoice");
        assert_eq!(invoice, ("matched".to_string(), "voucher-1".to_string()));
        let audit: (String, String) = sqlx::query_as(
            "SELECT operator, object_ref FROM operation_audit_logs WHERE action = '关联发票与凭证'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads matching audit");
        assert_eq!(audit, ("制证会计".to_string(), "invoice-1".to_string()));

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }
}
