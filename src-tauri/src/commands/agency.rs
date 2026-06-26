use crate::db::{
    AgencyCollaborationItem, AgencyDeliveryTicket, AgencyFeeCollection, AgencyServiceContract,
    Database,
};
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct AgencyOperationOverview {
    pub service_contracts: i64,
    pub expiring_contracts: i64,
    pub receivable_amount: f64,
    pub arrears_amount: f64,
    pub pending_collaboration: i64,
    pub overdue_collaboration: i64,
    pub open_tickets: i64,
    pub blocked_tickets: i64,
}

#[tauri::command]
pub async fn get_agency_service_contracts(
    company_id: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyServiceContract>, String> {
    let rows: Vec<AgencyServiceContract> = sqlx::query_as(
        r#"
        SELECT
            c.id,
            c.company_id,
            co.name AS company_name,
            c.contract_no,
            c.service_package,
            c.service_start,
            c.service_end,
            c.monthly_fee,
            c.renewal_status,
            c.owner,
            c.archive_status,
            c.status,
            c.created_at,
            c.updated_at
        FROM agency_service_contracts c
        LEFT JOIN companies co ON co.id = c.company_id
        WHERE (? IS NULL OR c.company_id = ?)
          AND (? IS NULL OR c.status = ? OR c.renewal_status = ?)
        ORDER BY c.service_end ASC, co.name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&status)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_fee_collections(
    company_id: Option<String>,
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyFeeCollection>, String> {
    let rows: Vec<AgencyFeeCollection> = sqlx::query_as(
        r#"
        SELECT
            f.id,
            f.company_id,
            co.name AS company_name,
            f.period,
            f.receivable_amount,
            f.received_amount,
            f.arrears_amount,
            f.invoice_status,
            f.payment_status,
            f.collector,
            f.last_follow_up,
            f.status,
            f.created_at,
            f.updated_at
        FROM agency_fee_collections f
        LEFT JOIN companies co ON co.id = f.company_id
        WHERE (? IS NULL OR f.company_id = ?)
          AND (? IS NULL OR f.period = ?)
          AND (? IS NULL OR f.status = ? OR f.payment_status = ?)
        ORDER BY f.period DESC, f.arrears_amount DESC, co.name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_collaboration_items(
    company_id: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyCollaborationItem>, String> {
    let rows: Vec<AgencyCollaborationItem> = sqlx::query_as(
        r#"
        SELECT
            i.id,
            i.company_id,
            co.name AS company_name,
            i.todo_title,
            i.material_type,
            i.customer_contact,
            i.reminder_count,
            i.last_contact_at,
            i.reply_status,
            i.owner,
            i.status,
            i.created_at,
            i.updated_at
        FROM agency_collaboration_items i
        LEFT JOIN companies co ON co.id = i.company_id
        WHERE (? IS NULL OR i.company_id = ?)
          AND (? IS NULL OR i.status = ? OR i.reply_status = ?)
        ORDER BY i.updated_at DESC, i.reminder_count DESC, co.name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&status)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_delivery_tickets(
    company_id: Option<String>,
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyDeliveryTicket>, String> {
    let rows: Vec<AgencyDeliveryTicket> = sqlx::query_as(
        r#"
        SELECT
            t.id,
            t.company_id,
            co.name AS company_name,
            t.ticket_no,
            t.task_name,
            t.period,
            t.current_stage,
            t.sla_status,
            t.owner,
            t.delivery_status,
            t.status,
            t.created_at,
            t.updated_at
        FROM agency_delivery_tickets t
        LEFT JOIN companies co ON co.id = t.company_id
        WHERE (? IS NULL OR t.company_id = ?)
          AND (? IS NULL OR t.period = ?)
          AND (? IS NULL OR t.status = ? OR t.delivery_status = ?)
        ORDER BY t.period DESC, t.updated_at DESC, co.name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_operation_overview(
    period: Option<String>,
    db: State<'_, Database>,
) -> Result<AgencyOperationOverview, String> {
    let period_filter = period.unwrap_or_else(|| "2026-05".to_string());

    let service_contracts: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM agency_service_contracts WHERE status <> 'inactive'")
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let expiring_contracts: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM agency_service_contracts WHERE status = 'expiring' OR renewal_status LIKE '%到期%'")
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let fees: (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(receivable_amount), 0), COALESCE(SUM(arrears_amount), 0) FROM agency_fee_collections WHERE period = ?",
    )
    .bind(&period_filter)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let pending_collaboration: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agency_collaboration_items WHERE status IN ('pending', 'overdue')",
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let overdue_collaboration: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM agency_collaboration_items WHERE status = 'overdue' OR reply_status = '超时'")
            .fetch_one(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let open_tickets: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agency_delivery_tickets WHERE period = ? AND status <> 'completed'",
    )
    .bind(&period_filter)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let blocked_tickets: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agency_delivery_tickets WHERE period = ? AND (status = 'blocked' OR delivery_status = 'blocked')",
    )
    .bind(&period_filter)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(AgencyOperationOverview {
        service_contracts: service_contracts.0,
        expiring_contracts: expiring_contracts.0,
        receivable_amount: fees.0,
        arrears_amount: fees.1,
        pending_collaboration: pending_collaboration.0,
        overdue_collaboration: overdue_collaboration.0,
        open_tickets: open_tickets.0,
        blocked_tickets: blocked_tickets.0,
    })
}
