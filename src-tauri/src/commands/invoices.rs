use crate::db::{Database, Invoice};
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
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateInvoiceInput {
    pub company_id: Option<String>,
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

#[tauri::command]
pub async fn get_invoices(
    company_id: Option<String>,
    period_id: Option<String>,
    invoice_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<Invoice>, String> {
    log::info!("Fetching invoices - company: {:?}, period: {:?}, type: {:?}", company_id, period_id, invoice_type);

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

    let invoice: Option<Invoice> = sqlx::query_as(
        "SELECT * FROM invoices WHERE id = ? AND company_id = ?",
    )
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
    db: State<'_, Database>,
) -> Result<Invoice, String> {
    log::info!("Creating invoice: {} for company: {}", input.invoice_no, input.company_id);

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let total_amount = input.amount + input.tax_amount;

    sqlx::query(
        r#"
        INSERT INTO invoices (id, company_id, period_id, invoice_type, invoice_no, invoice_code,
            invoice_date, amount, tax_amount, total_amount, tax_rate, seller_name, seller_tax_id,
            buyer_name, buyer_tax_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
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
    .bind(&input.tax_rate)
    .bind(&input.seller_name)
    .bind(&input.seller_tax_id)
    .bind(&input.buyer_name)
    .bind(&input.buyer_tax_id)
    .bind(&now)
    .bind(&now)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create invoice: {}", e))?;

    let invoice: Invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Invoice created: {}", id);
    Ok(invoice)
}

#[tauri::command]
pub async fn update_invoice(
    id: String,
    input: UpdateInvoiceInput,
    db: State<'_, Database>,
) -> Result<Invoice, String> {
    log::info!("Updating invoice: {}", id);

    // Resolve company_id: use provided value, or fetch from existing invoice
    let company_id = match input.company_id {
        Some(ref cid) => cid.clone(),
        None => {
            let row: Option<(String,)> = sqlx::query_as(
                "SELECT company_id FROM invoices WHERE id = ?",
            )
            .bind(&id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

            match row {
                Some((cid,)) => cid,
                None => return Err("发票不存在".to_string()),
            }
        }
    };

    // Verify company ownership
    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM invoices WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if exists.is_none() {
        return Err("发票不存在或不属于当前公司".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();

    if let Some(ref v) = input.invoice_type {
        sqlx::query("UPDATE invoices SET invoice_type = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.invoice_no {
        sqlx::query("UPDATE invoices SET invoice_no = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.invoice_code {
        sqlx::query("UPDATE invoices SET invoice_code = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.invoice_date {
        sqlx::query("UPDATE invoices SET invoice_date = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(v) = input.amount {
        sqlx::query("UPDATE invoices SET amount = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(v) = input.tax_amount {
        sqlx::query("UPDATE invoices SET tax_amount = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.tax_rate {
        sqlx::query("UPDATE invoices SET tax_rate = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.seller_name {
        sqlx::query("UPDATE invoices SET seller_name = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.seller_tax_id {
        sqlx::query("UPDATE invoices SET seller_tax_id = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.buyer_name {
        sqlx::query("UPDATE invoices SET buyer_name = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.buyer_tax_id {
        sqlx::query("UPDATE invoices SET buyer_tax_id = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.status {
        sqlx::query("UPDATE invoices SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.voucher_id {
        sqlx::query("UPDATE invoices SET voucher_id = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }
    if let Some(ref v) = input.remarks {
        sqlx::query("UPDATE invoices SET remarks = ?, updated_at = ? WHERE id = ? AND company_id = ?")
            .bind(v).bind(&now).bind(&id).bind(&company_id)
            .execute(db.pool()).await.map_err(|e| format!("Failed: {}", e))?;
    }

    // Recalculate total
    let amounts: (f64, f64) = sqlx::query_as(
        "SELECT amount, tax_amount FROM invoices WHERE id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query("UPDATE invoices SET total_amount = ?, updated_at = ? WHERE id = ? AND company_id = ?")
        .bind(amounts.0 + amounts.1)
        .bind(&now)
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed: {}", e))?;

    let invoice: Invoice = sqlx::query_as("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Invoice updated: {}", id);
    Ok(invoice)
}

#[tauri::command]
pub async fn delete_invoice(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Deleting invoice: {} for company: {}", id, company_id);

    let result = sqlx::query("DELETE FROM invoices WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete invoice: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("发票不存在或不属于当前公司".to_string());
    }

    log::info!("Invoice deleted: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn match_invoice_to_voucher(
    invoice_id: String,
    voucher_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    log::info!("Matching invoice {} to voucher {} for company: {}", invoice_id, voucher_id, company_id);

    // Verify invoice belongs to company
    let inv: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM invoices WHERE id = ? AND company_id = ?",
    )
    .bind(&invoice_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if inv.is_none() {
        return Err("发票不存在或不属于当前公司".to_string());
    }

    // Verify voucher belongs to company
    let vch: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM vouchers WHERE id = ? AND company_id = ?",
    )
    .bind(&voucher_id)
    .bind(&company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if vch.is_none() {
        return Err("凭证不存在或不属于当前公司".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE invoices SET voucher_id = ?, status = 'matched', updated_at = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&voucher_id)
    .bind(&now)
    .bind(&invoice_id)
    .bind(&company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to match invoice: {}", e))?;

    log::info!("Invoice matched to voucher");
    Ok(())
}

#[tauri::command]
pub async fn get_invoices_by_voucher(
    voucher_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Invoice>, String> {
    log::info!("Fetching invoices for voucher: {} in company: {}", voucher_id, company_id);

    sqlx::query_as::<_, Invoice>(
        "SELECT * FROM invoices WHERE voucher_id = ? AND company_id = ? ORDER BY invoice_date DESC",
    )
    .bind(&voucher_id)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}
