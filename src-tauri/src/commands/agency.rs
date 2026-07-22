use crate::db::{
    AdapterAuthorization, AgencyBatchTask, AgencyCollaborationItem, AgencyDeliveryTicket,
    AgencyFeeCollection, AgencyServiceContract, AutomationJob, CreateAgencyBatchTasksInput,
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

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AgencyHealthCheckItem {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub module_name: String,
    pub risk_message: String,
    pub risk_level: String,
    pub owner: Option<String>,
    pub resolution_status: String,
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
pub async fn create_agency_service_contract(input: crate::db::CreateAgencyServiceContractInput, db: State<'_, Database>) -> Result<AgencyServiceContract, String> {
    if input.contract_no.trim().is_empty() || input.service_package.trim().is_empty() || input.service_start.trim().is_empty() || input.service_end.trim().is_empty() || input.monthly_fee < 0.0 { return Err("合同编号、套餐和服务期间不能为空，服务费不能为负数".into()); }
    let id=uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO agency_service_contracts (id,company_id,contract_no,service_package,service_start,service_end,monthly_fee,owner) VALUES (?,?,?,?,?,?,?,?)").bind(&id).bind(&input.company_id).bind(input.contract_no.trim()).bind(input.service_package.trim()).bind(input.service_start.trim()).bind(input.service_end.trim()).bind(input.monthly_fee).bind(input.owner).execute(db.pool()).await.map_err(|e|format!("新增服务合同失败: {e}"))?;
    sqlx::query_as("SELECT c.id,c.company_id,co.name AS company_name,c.contract_no,c.service_package,c.service_start,c.service_end,c.monthly_fee,c.renewal_status,c.owner,c.archive_status,c.status,c.created_at,c.updated_at FROM agency_service_contracts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=?").bind(id).fetch_one(db.pool()).await.map_err(|e|format!("查询新增服务合同失败: {e}"))
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
pub async fn create_agency_fee_collection(
    input: crate::db::CreateAgencyFeeCollectionInput,
    db: State<'_, Database>,
) -> Result<AgencyFeeCollection, String> {
    if input.company_id.trim().is_empty()
        || input.period.trim().is_empty()
        || input.receivable_amount < 0.0
        || input.received_amount < 0.0
        || input.received_amount > input.receivable_amount
    {
        return Err("客户账套、收费账期和金额不合法".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let arrears = input.receivable_amount - input.received_amount;
    let invoice_status = input.invoice_status.unwrap_or_else(|| "pending".into());
    let payment_status = input.payment_status.unwrap_or_else(|| "pending".into());
    let status = if arrears > 0.0 { "pending" } else { "completed" };

    sqlx::query(
        "INSERT INTO agency_fee_collections (id,company_id,period,receivable_amount,received_amount,arrears_amount,invoice_status,payment_status,collector,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.period.trim())
    .bind(input.receivable_amount)
    .bind(input.received_amount)
    .bind(arrears)
    .bind(invoice_status)
    .bind(payment_status)
    .bind(input.collector)
    .bind(status)
    .execute(db.pool())
    .await
    .map_err(|e| format!("新增收费记录失败: {e}"))?;

    sqlx::query_as(
        "SELECT f.id,f.company_id,co.name AS company_name,f.period,f.receivable_amount,f.received_amount,f.arrears_amount,f.invoice_status,f.payment_status,f.collector,f.last_follow_up,f.status,f.created_at,f.updated_at FROM agency_fee_collections f LEFT JOIN companies co ON co.id=f.company_id WHERE f.id=?",
    )
    .bind(id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询新增收费记录失败: {e}"))
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
pub async fn create_agency_collaboration_item(
    input: crate::db::CreateAgencyCollaborationItemInput,
    db: State<'_, Database>,
) -> Result<AgencyCollaborationItem, String> {
    if input.company_id.trim().is_empty() || input.todo_title.trim().is_empty() {
        return Err("客户账套和协同事项不能为空".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let reply_status = input.reply_status.unwrap_or_else(|| "pending".into());
    let status = if reply_status == "replied" { "completed" } else { "pending" };

    sqlx::query(
        "INSERT INTO agency_collaboration_items (id,company_id,todo_title,material_type,customer_contact,reply_status,owner,status) VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.todo_title.trim())
    .bind(input.material_type)
    .bind(input.customer_contact)
    .bind(reply_status)
    .bind(input.owner)
    .bind(status)
    .execute(db.pool())
    .await
    .map_err(|e| format!("新增协同事项失败: {e}"))?;

    sqlx::query_as(
        "SELECT i.id,i.company_id,co.name AS company_name,i.todo_title,i.material_type,i.customer_contact,i.reminder_count,i.last_contact_at,i.reply_status,i.owner,i.status,i.created_at,i.updated_at FROM agency_collaboration_items i LEFT JOIN companies co ON co.id=i.company_id WHERE i.id=?",
    )
    .bind(id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询新增协同事项失败: {e}"))
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
pub async fn get_agency_batch_tasks(
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyBatchTask>, String> {
    let rows: Vec<AgencyBatchTask> = sqlx::query_as(
        r#"
        SELECT
            id,
            task_type,
            task_name,
            period,
            customer_scope,
            status,
            progress_current,
            progress_total,
            result_summary,
            risk_level,
            operator,
            requires_approval,
            created_at,
            updated_at
        FROM agency_batch_tasks
        WHERE (? IS NULL OR period = ?)
          AND (? IS NULL OR status = ?)
        ORDER BY created_at DESC
        "#,
    )
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn create_agency_batch_tasks(
    input: CreateAgencyBatchTasksInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    if input.period.trim().is_empty() {
        return Err("period cannot be empty".to_string());
    }

    let operator = input.operator.unwrap_or_else(|| "admin".to_string());
    let templates = [
        ("invoice_collection", "批量采集发票", "全部已授权税务客户", "检查税务授权后执行", "medium", 0),
        ("bank_collection", "批量采集银行流水", "已授权银行客户", "检查银行授权后执行", "medium", 0),
        ("closing_precheck", "批量结账预检", "待结账客户", "需完成风险检查", "high", 1),
        ("tax_declaration_precheck", "批量申报预检", "待申报税种", "只生成申报包，不自动提交税局", "high", 1),
    ];

    for (task_type, task_name, customer_scope, result_summary, risk_level, requires_approval) in templates {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO agency_batch_tasks (
                id, task_type, task_name, period, customer_scope, status,
                result_summary, risk_level, operator, requires_approval
            )
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(task_type)
        .bind(task_name)
        .bind(&input.period)
        .bind(customer_scope)
        .bind(result_summary)
        .bind(risk_level)
        .bind(&operator)
        .bind(requires_approval)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_agency_health_checks(
    period: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyHealthCheckItem>, String> {
    let period_filter = period.unwrap_or_else(|| "2026-05".to_string());
    let rows: Vec<AgencyHealthCheckItem> = sqlx::query_as(
        r#"
        SELECT
            'invoice-unmatched-' || i.company_id AS id,
            i.company_id,
            c.name AS company_name,
            '发票' AS module_name,
            printf('%d 张有效发票尚未匹配凭证', COUNT(*)) AS risk_message,
            CASE WHEN COUNT(*) >= 5 THEN '高' ELSE '中' END AS risk_level,
            NULL AS owner,
            '待整改' AS resolution_status
        FROM invoices i
        LEFT JOIN companies c ON c.id = i.company_id
        WHERE i.voucher_id IS NULL
          AND i.status NOT IN ('void', 'cancelled')
        GROUP BY i.company_id, c.name
        HAVING COUNT(*) > 0

        UNION ALL

        SELECT
            'tax-risk-' || t.company_id AS id,
            t.company_id,
            c.name AS company_name,
            '税务申报' AS module_name,
            printf('%d 项税务申报风险待处理', SUM(t.risk_count)) AS risk_message,
            CASE WHEN SUM(t.risk_count) >= 3 THEN '高' ELSE '中' END AS risk_level,
            MAX(t.confirmed_by) AS owner,
            '待整改' AS resolution_status
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.period = ?
          AND t.risk_count > 0
        GROUP BY t.company_id, c.name

        UNION ALL

        SELECT
            'delivery-blocked-' || t.id AS id,
            t.company_id,
            c.name AS company_name,
            '交付' AS module_name,
            '交付任务 ' || t.ticket_no || ' 已阻断' AS risk_message,
            '高' AS risk_level,
            t.owner,
            '待审批' AS resolution_status
        FROM agency_delivery_tickets t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.period = ?
          AND (t.status = 'blocked' OR t.delivery_status = 'blocked')

        ORDER BY risk_level DESC, company_name ASC, module_name ASC
        "#,
    )
    .bind(&period_filter)
    .bind(&period_filter)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_automation_jobs(
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AutomationJob>, String> {
    let rows: Vec<AutomationJob> = sqlx::query_as(
        r#"
        SELECT
            j.id,
            j.company_id,
            c.name AS company_name,
            j.period,
            j.job_type,
            j.source_module,
            j.source_id,
            j.source_file,
            j.status,
            j.confidence,
            j.result_summary,
            j.risk_level,
            j.reviewer,
            j.created_by,
            j.created_at,
            j.updated_at
        FROM automation_jobs j
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE (? IS NULL OR j.period = ?)
          AND (? IS NULL OR j.status = ?)
        ORDER BY j.updated_at DESC, c.name ASC
        "#,
    )
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_agency_adapter_authorizations(
    adapter_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AdapterAuthorization>, String> {
    let rows: Vec<AdapterAuthorization> = sqlx::query_as(
        r#"
        SELECT
            a.id,
            a.company_id,
            c.name AS company_name,
            a.adapter_type,
            a.adapter_code,
            a.region,
            a.auth_status,
            a.account_mask,
            a.login_identity,
            a.capability_scope,
            a.last_checked_at,
            a.expires_at,
            a.risk_message,
            a.created_at,
            a.updated_at
        FROM adapter_authorizations a
        LEFT JOIN companies c ON c.id = a.company_id
        WHERE (? IS NULL OR a.adapter_type = ?)
        ORDER BY a.updated_at DESC, c.name ASC, a.adapter_type ASC
        "#,
    )
    .bind(&adapter_type)
    .bind(&adapter_type)
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
