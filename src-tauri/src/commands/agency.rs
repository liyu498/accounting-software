use crate::commands::auth::authenticated_actor;
use crate::commands::periods::close_period_record;
use crate::db::{
    AdapterAuthorization, AgencyBatchTask, AgencyBatchTaskItem, AgencyCollaborationItem,
    AgencyDeliveryTicket, AgencyFeeCollection, AgencyServiceContract, AutomationJob,
    CreateAgencyBatchTasksInput, Database, DbPool, ReviewAgencyBatchTaskInput,
    RunAgencyBatchTaskInput, UpdateAgencyCollaborationItemInput, UpdateAgencyFeeCollectionInput,
    UpdateAgencyServiceContractInput,
};
use serde::{Deserialize, Serialize};
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
pub struct AgencyCompanyProgress {
    pub company_id: String,
    pub period: String,
    pub invoice_count: i64,
    pub invoice_pending_count: i64,
    pub voucher_count: i64,
    pub approved_voucher_count: i64,
    pub tax_task_count: i64,
    pub collected_tax_task_count: i64,
    pub declared_tax_task_count: i64,
    pub paid_tax_task_count: i64,
    pub risk_count: i64,
    pub latest_activity_at: Option<String>,
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

#[derive(Debug, Clone, Serialize)]
pub struct CreateAgencyBatchTasksResult {
    pub created: i64,
    pub skipped: i64,
}

async fn get_agency_batch_task_record(pool: &DbPool, id: &str) -> Result<AgencyBatchTask, String> {
    sqlx::query_as(
        r#"
        SELECT id, task_type, task_name, period, customer_scope, status,
               progress_current, progress_total, result_summary, risk_level,
               operator, requires_approval, created_at, updated_at
        FROM agency_batch_tasks WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取批量任务失败: {error}"))?
    .ok_or_else(|| "未找到批量任务".to_string())
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
pub async fn create_agency_service_contract(
    input: crate::db::CreateAgencyServiceContractInput,
    db: State<'_, Database>,
) -> Result<AgencyServiceContract, String> {
    if input.contract_no.trim().is_empty()
        || input.service_package.trim().is_empty()
        || input.service_start.trim().is_empty()
        || input.service_end.trim().is_empty()
        || input.monthly_fee < 0.0
    {
        return Err("合同编号、套餐和服务期间不能为空，服务费不能为负数".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO agency_service_contracts (id,company_id,contract_no,service_package,service_start,service_end,monthly_fee,owner) VALUES (?,?,?,?,?,?,?,?)").bind(&id).bind(&input.company_id).bind(input.contract_no.trim()).bind(input.service_package.trim()).bind(input.service_start.trim()).bind(input.service_end.trim()).bind(input.monthly_fee).bind(input.owner).execute(db.pool()).await.map_err(|e|format!("新增服务合同失败: {e}"))?;
    sqlx::query_as("SELECT c.id,c.company_id,co.name AS company_name,c.contract_no,c.service_package,c.service_start,c.service_end,c.monthly_fee,c.renewal_status,c.owner,c.archive_status,c.status,c.created_at,c.updated_at FROM agency_service_contracts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=?").bind(id).fetch_one(db.pool()).await.map_err(|e|format!("查询新增服务合同失败: {e}"))
}

#[tauri::command]
pub async fn update_agency_service_contract(
    input: UpdateAgencyServiceContractInput,
    db: State<'_, Database>,
) -> Result<AgencyServiceContract, String> {
    if input.id.trim().is_empty()
        || input.company_id.trim().is_empty()
        || input.contract_no.trim().is_empty()
        || input.service_package.trim().is_empty()
        || input.service_start.trim().is_empty()
        || input.service_end.trim().is_empty()
        || input.monthly_fee < 0.0
    {
        return Err("合同编号、套餐、服务期间和客户账套不能为空，服务费不能为负数".into());
    }
    if !["normal", "expiring", "overdue", "renewed"].contains(&input.renewal_status.as_str()) {
        return Err("续费状态不合法".into());
    }
    if !["pending", "archived", "missing"].contains(&input.archive_status.as_str()) {
        return Err("归档状态不合法".into());
    }
    if !["active", "completed", "suspended", "overdue"].contains(&input.status.as_str()) {
        return Err("合同状态不合法".into());
    }

    let affected = sqlx::query(
        "UPDATE agency_service_contracts SET company_id=?,contract_no=?,service_package=?,service_start=?,service_end=?,monthly_fee=?,renewal_status=?,owner=?,archive_status=?,status=?,updated_at=datetime('now') WHERE id=?",
    )
    .bind(&input.company_id)
    .bind(input.contract_no.trim())
    .bind(input.service_package.trim())
    .bind(input.service_start.trim())
    .bind(input.service_end.trim())
    .bind(input.monthly_fee)
    .bind(&input.renewal_status)
    .bind(input.owner)
    .bind(&input.archive_status)
    .bind(&input.status)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新服务合同失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到要更新的服务合同".into());
    }

    sqlx::query_as("SELECT c.id,c.company_id,co.name AS company_name,c.contract_no,c.service_package,c.service_start,c.service_end,c.monthly_fee,c.renewal_status,c.owner,c.archive_status,c.status,c.created_at,c.updated_at FROM agency_service_contracts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询更新后的服务合同失败: {e}"))
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
    let status = if arrears > 0.0 {
        "pending"
    } else {
        "completed"
    };

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
pub async fn update_agency_fee_collection(
    input: UpdateAgencyFeeCollectionInput,
    db: State<'_, Database>,
) -> Result<AgencyFeeCollection, String> {
    if input.id.trim().is_empty()
        || input.company_id.trim().is_empty()
        || input.period.trim().is_empty()
        || input.receivable_amount < 0.0
        || input.received_amount < 0.0
        || input.received_amount > input.receivable_amount
    {
        return Err("客户账套、收费账期和金额不合法".into());
    }
    if !["pending", "issued", "void", "reversed"].contains(&input.invoice_status.as_str()) {
        return Err("开票状态不合法".into());
    }
    if !["pending", "paid", "overdue"].contains(&input.payment_status.as_str()) {
        return Err("收费状态不合法".into());
    }
    if !["pending", "completed", "overdue"].contains(&input.status.as_str()) {
        return Err("收费台账状态不合法".into());
    }
    let arrears = input.receivable_amount - input.received_amount;
    let affected = sqlx::query(
        "UPDATE agency_fee_collections SET company_id=?,period=?,receivable_amount=?,received_amount=?,arrears_amount=?,invoice_status=?,payment_status=?,collector=?,last_follow_up=?,status=?,updated_at=datetime('now') WHERE id=?",
    )
    .bind(&input.company_id)
    .bind(input.period.trim())
    .bind(input.receivable_amount)
    .bind(input.received_amount)
    .bind(arrears)
    .bind(&input.invoice_status)
    .bind(&input.payment_status)
    .bind(input.collector)
    .bind(input.last_follow_up)
    .bind(&input.status)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新收费记录失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到要更新的收费记录".into());
    }

    sqlx::query_as("SELECT f.id,f.company_id,co.name AS company_name,f.period,f.receivable_amount,f.received_amount,f.arrears_amount,f.invoice_status,f.payment_status,f.collector,f.last_follow_up,f.status,f.created_at,f.updated_at FROM agency_fee_collections f LEFT JOIN companies co ON co.id=f.company_id WHERE f.id=?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询更新后的收费记录失败: {e}"))
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
    let status = if reply_status == "replied" {
        "completed"
    } else {
        "pending"
    };

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
pub async fn update_agency_collaboration_item(
    input: UpdateAgencyCollaborationItemInput,
    db: State<'_, Database>,
) -> Result<AgencyCollaborationItem, String> {
    if input.id.trim().is_empty()
        || input.company_id.trim().is_empty()
        || input.todo_title.trim().is_empty()
        || input.reminder_count < 0
    {
        return Err("客户账套、协同事项和催办次数不合法".into());
    }
    if !["pending", "replied", "overdue"].contains(&input.reply_status.as_str()) {
        return Err("客户答复状态不合法".into());
    }
    if !["pending", "completed", "overdue"].contains(&input.status.as_str()) {
        return Err("协同事项状态不合法".into());
    }
    let affected = sqlx::query(
        "UPDATE agency_collaboration_items SET company_id=?,todo_title=?,material_type=?,customer_contact=?,reply_status=?,owner=?,reminder_count=?,last_contact_at=?,status=?,updated_at=datetime('now') WHERE id=?",
    )
    .bind(&input.company_id)
    .bind(input.todo_title.trim())
    .bind(input.material_type)
    .bind(input.customer_contact)
    .bind(&input.reply_status)
    .bind(input.owner)
    .bind(input.reminder_count)
    .bind(input.last_contact_at)
    .bind(&input.status)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新协同事项失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到要更新的协同事项".into());
    }

    sqlx::query_as("SELECT i.id,i.company_id,co.name AS company_name,i.todo_title,i.material_type,i.customer_contact,i.reminder_count,i.last_contact_at,i.reply_status,i.owner,i.status,i.created_at,i.updated_at FROM agency_collaboration_items i LEFT JOIN companies co ON co.id=i.company_id WHERE i.id=?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询更新后的协同事项失败: {e}"))
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
    auth_token: String,
    db: State<'_, Database>,
) -> Result<CreateAgencyBatchTasksResult, String> {
    if input.period.trim().is_empty() {
        return Err("period cannot be empty".to_string());
    }

    let operator = authenticated_actor(db.pool(), &auth_token).await?;
    let templates = [
        (
            "invoice_collection",
            "批量采集发票",
            "全部已授权税务客户",
            "检查税务授权后执行",
            "medium",
            0,
        ),
        (
            "bank_collection",
            "批量采集银行流水",
            "已授权银行客户",
            "检查银行授权后执行",
            "medium",
            0,
        ),
        (
            "voucher_generation_precheck",
            "批量生成凭证预检",
            "已完成资料核验客户",
            "只生成凭证建议与待确认草稿",
            "medium",
            0,
        ),
        (
            "closing_precheck",
            "批量结账预检",
            "待结账客户",
            "需完成风险检查",
            "high",
            1,
        ),
        (
            "tax_declaration_precheck",
            "批量申报预检",
            "待申报税种",
            "只生成申报包，不自动提交税局",
            "high",
            1,
        ),
        (
            "declaration_receipt_archive",
            "申报回执归档预检",
            "已确认申报事项",
            "只核验本地回执和缴款书归档条件",
            "high",
            1,
        ),
    ];

    let selected_task_types = input.task_types.unwrap_or_else(|| {
        templates
            .iter()
            .map(|(task_type, ..)| task_type.to_string())
            .collect()
    });
    if selected_task_types.is_empty() {
        return Err("至少选择一个批量预检任务".to_string());
    }
    if let Some(unknown_task_type) = selected_task_types.iter().find(|task_type| {
        !templates
            .iter()
            .any(|(known_task_type, ..)| *known_task_type == task_type.as_str())
    }) {
        return Err(format!("不支持的批量任务类型: {unknown_task_type}"));
    }

    let mut created = 0_i64;
    let mut skipped = 0_i64;

    for (task_type, task_name, customer_scope, result_summary, risk_level, requires_approval) in
        templates
    {
        if !selected_task_types
            .iter()
            .any(|selected_task_type| selected_task_type.as_str() == task_type)
        {
            continue;
        }
        let id = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query(
            r#"
            INSERT INTO agency_batch_tasks (
                id, task_type, task_name, period, customer_scope, status,
                result_summary, risk_level, operator, requires_approval
            )
            SELECT ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM agency_batch_tasks
                WHERE period = ?
                  AND task_type = ?
                  AND status NOT IN ('completed', 'cancelled')
            )
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
        .bind(&input.period)
        .bind(task_type)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if result.rows_affected() == 1 {
            created += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(CreateAgencyBatchTasksResult { created, skipped })
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunAgencyBatchTaskPrecheckInput {
    pub id: String,
}

#[tauri::command]
pub async fn run_agency_batch_task_precheck(
    input: RunAgencyBatchTaskPrecheckInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AgencyBatchTask, String> {
    let task: AgencyBatchTask = sqlx::query_as(
        r#"
        SELECT id, task_type, task_name, period, customer_scope, status,
               progress_current, progress_total, result_summary, risk_level,
               operator, requires_approval, created_at, updated_at
        FROM agency_batch_tasks
        WHERE id = ?
        "#,
    )
    .bind(&input.id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("读取批量任务失败: {e}"))?
    .ok_or_else(|| "未找到批量任务".to_string())?;

    if task.status != "queued" {
        return Err("当前任务状态不允许重复执行预检".to_string());
    }

    let operator = authenticated_actor(db.pool(), &auth_token).await?;
    let next_status = if task.requires_approval == 1 {
        "awaiting_approval"
    } else {
        "prechecked"
    };
    let summary = if task.requires_approval == 1 {
        "本地预检完成，不会登录或调用税局、银行等外部系统；高风险任务待人工审批。"
    } else {
        "本地预检完成，不会登录或调用税局、银行等外部系统；后续采集需人工发起。"
    };

    sqlx::query(
        r#"
        UPDATE agency_batch_tasks
        SET status = ?, progress_current = 1, progress_total = COALESCE(progress_total, 1),
            result_summary = ?, operator = ?, updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(next_status)
    .bind(summary)
    .bind(operator)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新批量预检状态失败: {e}"))?;

    sqlx::query_as(
        r#"
        SELECT id, task_type, task_name, period, customer_scope, status,
               progress_current, progress_total, result_summary, risk_level,
               operator, requires_approval, created_at, updated_at
        FROM agency_batch_tasks
        WHERE id = ?
        "#,
    )
    .bind(&input.id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("读取更新后的批量任务失败: {e}"))
}

#[tauri::command]
pub async fn review_agency_batch_task(
    input: ReviewAgencyBatchTaskInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AgencyBatchTask, String> {
    if input.id.trim().is_empty() {
        return Err("批量任务不能为空".to_string());
    }

    let task: AgencyBatchTask = sqlx::query_as(
        r#"
        SELECT id, task_type, task_name, period, customer_scope, status,
               progress_current, progress_total, result_summary, risk_level,
               operator, requires_approval, created_at, updated_at
        FROM agency_batch_tasks
        WHERE id = ?
        "#,
    )
    .bind(&input.id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("读取批量审批任务失败: {e}"))?
    .ok_or_else(|| "未找到批量任务".to_string())?;

    if task.requires_approval != 1 || task.status != "awaiting_approval" {
        return Err("当前任务不在待审批状态".to_string());
    }

    let (next_status, summary) = match input.decision.as_str() {
        "approved" => (
            "prechecked",
            "本地预检已人工通过；未登录或调用税局、银行等外部系统，后续动作仍需人工发起。",
        ),
        "rejected" => (
            "blocked",
            "本地预检已驳回并阻断后续操作；未登录或调用税局、银行等外部系统。",
        ),
        _ => return Err("审批结果仅支持 approved 或 rejected".to_string()),
    };
    let operator = authenticated_actor(db.pool(), &auth_token).await?;

    let result = sqlx::query(
        r#"
        UPDATE agency_batch_tasks
        SET status = ?, result_summary = ?, operator = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'awaiting_approval' AND requires_approval = 1
        "#,
    )
    .bind(next_status)
    .bind(summary)
    .bind(operator)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新批量审批任务失败: {e}"))?;

    if result.rows_affected() != 1 {
        return Err("审批状态已变更，请刷新后重试".to_string());
    }

    sqlx::query_as(
        r#"
        SELECT id, task_type, task_name, period, customer_scope, status,
               progress_current, progress_total, result_summary, risk_level,
               operator, requires_approval, created_at, updated_at
        FROM agency_batch_tasks
        WHERE id = ?
        "#,
    )
    .bind(&input.id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("读取审批结果失败: {e}"))
}

async fn agency_period_id(
    pool: &DbPool,
    company_id: &str,
    period: &str,
) -> Result<Option<String>, String> {
    let (year, month) = period
        .split_once('-')
        .ok_or_else(|| "批量任务账期必须使用 YYYY-MM 格式".to_string())?;
    let year = year
        .parse::<i32>()
        .map_err(|_| "批量任务账期年份无效".to_string())?;
    let month = month
        .parse::<i32>()
        .map_err(|_| "批量任务账期月份无效".to_string())?;
    if !(1..=12).contains(&month) {
        return Err("批量任务账期月份无效".to_string());
    }
    sqlx::query_scalar(
        "SELECT id FROM accounting_periods WHERE company_id = ? AND period_year = ? AND period_month = ?",
    )
    .bind(company_id)
    .bind(year)
    .bind(month)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取账套会计期间失败: {error}"))
}

async fn enqueue_agency_automation_job(
    pool: &DbPool,
    task: &AgencyBatchTask,
    company_id: &str,
    job_type: &str,
    summary: &str,
    actor: &str,
) -> Result<(), String> {
    let result = sqlx::query(
        r#"
        INSERT INTO automation_jobs (
            id, company_id, period, job_type, source_module, source_id,
            status, result_summary, risk_level, created_by
        )
        SELECT ?, ?, ?, ?, 'agency_batch', ?, 'queued', ?, ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM automation_jobs
            WHERE company_id = ? AND source_module = 'agency_batch'
              AND source_id = ? AND job_type = ?
              AND status NOT IN ('failed', 'cancelled')
        )
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(&task.period)
    .bind(job_type)
    .bind(&task.id)
    .bind(summary)
    .bind(&task.risk_level)
    .bind(actor)
    .bind(company_id)
    .bind(&task.id)
    .bind(job_type)
    .execute(pool)
    .await
    .map_err(|error| format!("写入批量执行队列失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("该账套已有同一批量任务的未完成执行记录".to_string());
    }
    Ok(())
}

async fn execute_agency_company_task(
    pool: &DbPool,
    task: &AgencyBatchTask,
    company_id: &str,
    actor: &str,
) -> Result<(String, String, Option<String>), String> {
    let period_id = agency_period_id(pool, company_id, &task.period).await?;
    let queued = |summary: &str| ("queued".to_string(), summary.to_string(), period_id.clone());

    match task.task_type.as_str() {
        "invoice_collection" | "bank_collection" => {
            let is_bank_collection = task.task_type == "bank_collection";
            let authorization_count: i64 = if is_bank_collection {
                sqlx::query_scalar(
                    r#"SELECT COUNT(*) FROM adapter_authorizations
                       WHERE company_id = ? AND adapter_type = 'bank' AND auth_status = 'authorized'
                         AND (expires_at IS NULL OR expires_at = '' OR date(expires_at) >= date('now'))"#,
                )
                .bind(company_id)
                .fetch_one(pool)
                .await
            } else {
                sqlx::query_scalar(
                    r#"SELECT COUNT(*) FROM adapter_authorizations
                       WHERE company_id = ? AND adapter_type IN ('tax', 'invoice_pool')
                         AND auth_status = 'authorized'
                         AND (expires_at IS NULL OR expires_at = '' OR date(expires_at) >= date('now'))"#,
                )
                .bind(company_id)
                .fetch_one(pool)
                .await
            }
            .map_err(|error| format!("核验采集授权失败: {error}"))?;
            if authorization_count == 0 {
                return Err(if is_bank_collection {
                    "缺少有效银行授权，未进入采集队列".to_string()
                } else {
                    "缺少有效税务或票池授权，未进入发票采集队列".to_string()
                });
            }
            let summary = if is_bank_collection {
                "已进入银行流水采集队列；结果需在采集工作台复核。"
            } else {
                "已进入发票采集队列；结果需在发票采集工作台复核。"
            };
            enqueue_agency_automation_job(pool, task, company_id, &task.task_type, summary, actor)
                .await?;
            Ok(queued(summary))
        }
        "voucher_generation_precheck" => {
            if period_id.is_none() {
                return Err("当前账期不存在，不能生成凭证建议".to_string());
            }
            let summary = "已进入凭证建议生成队列；只生成待确认草稿，不自动审核或记账。";
            enqueue_agency_automation_job(
                pool,
                task,
                company_id,
                "voucher_suggestion",
                summary,
                actor,
            )
            .await?;
            Ok(queued(summary))
        }
        "closing_precheck" => {
            let period_id = period_id.ok_or_else(|| "当前账期不存在，不能执行结账".to_string())?;
            close_period_record(pool, &period_id, actor).await?;
            Ok((
                "completed".to_string(),
                "已按单账套结账规则完成结账，并写入账期审计。".to_string(),
                Some(period_id),
            ))
        }
        "tax_declaration_precheck" => {
            if period_id.is_none() {
                return Err("当前账期不存在，不能生成申报包".to_string());
            }
            let task_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM tax_declaration_tasks WHERE company_id = ? AND period = ?",
            )
            .bind(company_id)
            .bind(&task.period)
            .fetch_one(pool)
            .await
            .map_err(|error| format!("读取申报任务失败: {error}"))?;
            if task_count == 0 {
                return Err("当前账期没有可生成申报包的税务任务".to_string());
            }
            let summary = "已进入本地申报包生成队列；不会登录税局或自动提交。";
            enqueue_agency_automation_job(
                pool,
                task,
                company_id,
                "tax_package_generation",
                summary,
                actor,
            )
            .await?;
            Ok(queued(summary))
        }
        "declaration_receipt_archive" => {
            let task_count: i64 = sqlx::query_scalar(
                r#"SELECT COUNT(*) FROM tax_declaration_tasks
                   WHERE company_id = ? AND period = ?
                     AND declaration_status IN ('confirmed', 'submitted', 'archived')"#,
            )
            .bind(company_id)
            .bind(&task.period)
            .fetch_one(pool)
            .await
            .map_err(|error| format!("读取申报回执任务失败: {error}"))?;
            if task_count == 0 {
                return Err("当前账期没有已确认的申报事项可归档".to_string());
            }
            let summary = "已进入回执与缴款资料归档队列；仅处理本地已取得资料。";
            enqueue_agency_automation_job(
                pool,
                task,
                company_id,
                "declaration_receipt_archive",
                summary,
                actor,
            )
            .await?;
            Ok(queued(summary))
        }
        _ => Err(format!("不支持执行的批量任务类型: {}", task.task_type)),
    }
}

async fn run_agency_batch_task_record(
    pool: &DbPool,
    id: &str,
    actor: &str,
) -> Result<AgencyBatchTask, String> {
    let task = get_agency_batch_task_record(pool, id).await?;
    if task.status != "prechecked" {
        return Err("只有已完成预检并通过审批的任务可以执行".to_string());
    }

    let claimed = sqlx::query(
        "UPDATE agency_batch_tasks SET status = 'processing', progress_current = 0, operator = ?, updated_at = datetime('now') WHERE id = ? AND status = 'prechecked'",
    )
    .bind(actor)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|error| format!("锁定批量任务失败: {error}"))?;
    if claimed.rows_affected() != 1 {
        return Err("批量任务状态已变化，请刷新后重试".to_string());
    }

    let companies: Vec<(String, String)> =
        sqlx::query_as("SELECT id, name FROM companies WHERE is_active = 1 ORDER BY name")
            .fetch_all(pool)
            .await
            .map_err(|error| format!("读取可执行账套失败: {error}"))?;
    if companies.is_empty() {
        let summary = "没有启用账套可执行";
        let mut transaction = pool
            .begin()
            .await
            .map_err(|error| format!("创建空批量任务事务失败: {error}"))?;
        sqlx::query(
            "UPDATE agency_batch_tasks SET status = 'blocked', progress_current = 0, progress_total = 0, result_summary = ?, updated_at = datetime('now') WHERE id = ? AND status = 'processing'",
        )
        .bind(summary)
        .bind(id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新空批量任务失败: {error}"))?;
        sqlx::query(
            r#"INSERT INTO operation_audit_logs
               (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
               VALUES (?, NULL, '批量操作', '执行批量任务', ?, 'high', 'blocked', ?, ?, datetime('now'))"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(id)
        .bind(summary)
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入空批量任务审计失败: {error}"))?;
        transaction
            .commit()
            .await
            .map_err(|error| format!("提交空批量任务结果失败: {error}"))?;
        return get_agency_batch_task_record(pool, id).await;
    }

    sqlx::query("DELETE FROM agency_batch_task_items WHERE task_id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|error| format!("清理旧批量执行明细失败: {error}"))?;

    let total = companies.len() as i64;
    let mut success_count = 0_i64;
    let mut failed_count = 0_i64;
    for (company_id, _company_name) in companies {
        let item_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO agency_batch_task_items
               (id, task_id, company_id, action, status, result_summary)
               VALUES (?, ?, ?, ?, 'processing', '正在执行账套级任务')"#,
        )
        .bind(&item_id)
        .bind(id)
        .bind(&company_id)
        .bind(&task.task_name)
        .execute(pool)
        .await
        .map_err(|error| format!("创建批量执行明细失败: {error}"))?;

        match execute_agency_company_task(pool, &task, &company_id, actor).await {
            Ok((status, summary, period_id)) => {
                success_count += 1;
                sqlx::query(
                    "UPDATE agency_batch_task_items SET period_id = ?, status = ?, result_summary = ?, error_message = NULL, updated_at = datetime('now') WHERE id = ?",
                )
                .bind(period_id)
                .bind(status)
                .bind(summary)
                .bind(&item_id)
                .execute(pool)
                .await
                .map_err(|error| format!("保存批量执行结果失败: {error}"))?;
            }
            Err(error) => {
                failed_count += 1;
                sqlx::query(
                    "UPDATE agency_batch_task_items SET status = 'blocked', result_summary = '未执行', error_message = ?, updated_at = datetime('now') WHERE id = ?",
                )
                .bind(error)
                .bind(&item_id)
                .execute(pool)
                .await
                .map_err(|error| format!("保存批量阻断结果失败: {error}"))?;
            }
        }
        sqlx::query(
            "UPDATE agency_batch_tasks SET progress_current = progress_current + 1, progress_total = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(total)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|error| format!("更新批量任务进度失败: {error}"))?;
    }

    let final_status = if success_count == 0 {
        "blocked"
    } else if failed_count > 0 {
        "completed_with_errors"
    } else {
        "completed"
    };
    let summary = format!(
        "逐账套执行完成：成功或已入队 {} 户，阻断 {} 户，共 {} 户。",
        success_count, failed_count, total
    );
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建批量任务完成事务失败: {error}"))?;
    sqlx::query(
        "UPDATE agency_batch_tasks SET status = ?, progress_current = ?, progress_total = ?, result_summary = ?, operator = ?, updated_at = datetime('now') WHERE id = ? AND status = 'processing'",
    )
    .bind(final_status)
    .bind(total)
    .bind(total)
    .bind(&summary)
    .bind(actor)
    .bind(id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("完成批量任务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, NULL, '批量操作', '执行批量任务', ?, 'high', ?, ?, ?, datetime('now'))"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(id)
    .bind(if failed_count == 0 { "success" } else { "partial" })
    .bind(&summary)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入批量执行审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交批量任务结果失败: {error}"))?;

    get_agency_batch_task_record(pool, id).await
}

#[tauri::command]
pub async fn run_agency_batch_task(
    input: RunAgencyBatchTaskInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AgencyBatchTask, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    run_agency_batch_task_record(db.pool(), &input.id, &actor).await
}

#[tauri::command]
pub async fn get_agency_batch_task_items(
    task_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AgencyBatchTaskItem>, String> {
    sqlx::query_as(
        r#"SELECT i.id, i.task_id, i.company_id, c.name AS company_name, i.period_id,
                  i.action, i.status, i.result_summary, i.error_message,
                  i.created_at, i.updated_at
           FROM agency_batch_task_items i
           JOIN companies c ON c.id = i.company_id
           WHERE i.task_id = ? ORDER BY c.name"#,
    )
    .bind(task_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取逐账套执行结果失败: {error}"))
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
            j.suggestion_no,
            j.debit_subject,
            j.credit_subject,
            j.suggestion_amount,
            j.generated_voucher_id,
            j.generated_voucher_number,
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

#[tauri::command]
pub async fn get_agency_company_progress(
    period: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AgencyCompanyProgress>, String> {
    let rows: Vec<AgencyCompanyProgress> = sqlx::query_as(
        r#"
        WITH selected_period AS (
            SELECT
                c.id AS company_id,
                COALESCE(
                    NULLIF(?, ''),
                    (
                        SELECT printf('%04d-%02d', ap.period_year, ap.period_month)
                        FROM accounting_periods ap
                        WHERE ap.company_id = c.id
                        ORDER BY CASE WHEN ap.status = 'open' THEN 0 ELSE 1 END,
                                 ap.period_year DESC,
                                 ap.period_month DESC
                        LIMIT 1
                    ),
                    printf('%04d-%02d', COALESCE(c.enable_year, strftime('%Y', 'now')), COALESCE(c.enable_month, 1))
                ) AS period
            FROM companies c
            WHERE COALESCE(c.is_deleted, 0) = 0
        ),
        resolved_period AS (
            SELECT
                sp.company_id,
                sp.period,
                (
                    SELECT ap.id
                    FROM accounting_periods ap
                    WHERE ap.company_id = sp.company_id
                      AND printf('%04d-%02d', ap.period_year, ap.period_month) = sp.period
                    ORDER BY CASE WHEN ap.status = 'open' THEN 0 ELSE 1 END
                    LIMIT 1
                ) AS period_id
            FROM selected_period sp
        )
        SELECT
            rp.company_id,
            rp.period,
            (
                SELECT COUNT(*) FROM invoices i
                WHERE i.company_id = rp.company_id
                  AND (i.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(i.invoice_date, 1, 7) = rp.period))
            ) AS invoice_count,
            (
                SELECT COUNT(*) FROM invoices i
                WHERE i.company_id = rp.company_id
                  AND (i.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(i.invoice_date, 1, 7) = rp.period))
                  AND lower(COALESCE(i.status, '')) NOT IN ('matched', 'approved', 'booked', 'processed', 'completed', 'passed')
            ) AS invoice_pending_count,
            (
                SELECT COUNT(*) FROM vouchers v
                WHERE v.company_id = rp.company_id
                  AND COALESCE(v.is_deleted, 0) = 0
                  AND (v.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(v.voucher_date, 1, 7) = rp.period))
            ) AS voucher_count,
            (
                SELECT COUNT(*) FROM vouchers v
                WHERE v.company_id = rp.company_id
                  AND COALESCE(v.is_deleted, 0) = 0
                  AND (v.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(v.voucher_date, 1, 7) = rp.period))
                  AND lower(COALESCE(v.status, '')) IN ('approved', 'reversed')
            ) AS approved_voucher_count,
            (
                SELECT COUNT(*) FROM tax_declaration_tasks t
                WHERE t.company_id = rp.company_id AND t.period = rp.period
            ) AS tax_task_count,
            (
                SELECT COUNT(*) FROM tax_declaration_tasks t
                WHERE t.company_id = rp.company_id AND t.period = rp.period
                  AND lower(COALESCE(t.collect_status, '')) NOT IN ('', 'not_collected', 'pending', 'failed', 'blocked')
            ) AS collected_tax_task_count,
            (
                SELECT COUNT(*) FROM tax_declaration_tasks t
                WHERE t.company_id = rp.company_id AND t.period = rp.period
                  AND lower(COALESCE(t.declaration_status, '')) IN ('confirmed', 'archived', 'filed', 'submitted', 'completed')
            ) AS declared_tax_task_count,
            (
                SELECT COUNT(*) FROM tax_declaration_tasks t
                WHERE t.company_id = rp.company_id AND t.period = rp.period
                  AND lower(COALESCE(t.payment_status, '')) IN ('paid', 'confirmed', 'completed')
            ) AS paid_tax_task_count,
            (
                SELECT COUNT(*) FROM invoices i
                WHERE i.company_id = rp.company_id
                  AND (i.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(i.invoice_date, 1, 7) = rp.period))
                  AND lower(COALESCE(i.status, '')) IN ('abnormal', 'rejected', 'error', 'blocked')
            ) + COALESCE((
                SELECT SUM(
                    MAX(COALESCE(t.risk_count, 0), 0)
                    + CASE
                        WHEN COALESCE(t.risk_count, 0) = 0
                         AND lower(COALESCE(t.validation_status, '')) IN ('failed', 'error', 'blocked')
                        THEN 1 ELSE 0
                      END
                )
                FROM tax_declaration_tasks t
                WHERE t.company_id = rp.company_id AND t.period = rp.period
            ), 0) AS risk_count,
            NULLIF(MAX(
                COALESCE((
                    SELECT MAX(i.updated_at) FROM invoices i
                    WHERE i.company_id = rp.company_id
                      AND (i.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(i.invoice_date, 1, 7) = rp.period))
                ), ''),
                COALESCE((
                    SELECT MAX(COALESCE(v.modified_at, v.created_at)) FROM vouchers v
                    WHERE v.company_id = rp.company_id
                      AND COALESCE(v.is_deleted, 0) = 0
                      AND (v.period_id = rp.period_id OR (rp.period_id IS NULL AND substr(v.voucher_date, 1, 7) = rp.period))
                ), ''),
                COALESCE((
                    SELECT MAX(t.updated_at) FROM tax_declaration_tasks t
                    WHERE t.company_id = rp.company_id AND t.period = rp.period
                ), '')
            ), '') AS latest_activity_at
        FROM resolved_period rp
        JOIN companies c ON c.id = rp.company_id
        ORDER BY c.name COLLATE NOCASE ASC
        "#,
    )
    .bind(period)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询客户进度失败: {e}"))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::run_agency_batch_task_record;
    use crate::db::Database;

    async fn test_database(label: &str) -> (Database, std::path::PathBuf) {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-agency-batch-{label}-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        (database, data_dir)
    }

    #[tokio::test]
    async fn batch_collection_dispatches_authorized_accounts_and_blocks_the_rest() {
        let (database, data_dir) = test_database("collection").await;
        for (id, code, name) in [
            ("company-ok", "C001", "已授权企业"),
            ("company-blocked", "C002", "未授权企业"),
        ] {
            sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
                .bind(id)
                .bind(code)
                .bind(name)
                .execute(database.pool())
                .await
                .expect("creates company");
        }
        sqlx::query(
            "INSERT INTO adapter_authorizations (id, company_id, adapter_type, adapter_code, auth_status) VALUES ('auth-1', 'company-ok', 'invoice_pool', 'invoice-pool-local', 'authorized')",
        )
        .execute(database.pool())
        .await
        .expect("creates authorization");
        sqlx::query(
            "INSERT INTO agency_batch_tasks (id, task_type, task_name, period, customer_scope, status) VALUES ('task-1', 'invoice_collection', '批量采集发票', '2026-05', '已授权客户', 'prechecked')",
        )
        .execute(database.pool())
        .await
        .expect("creates prechecked task");

        let task = run_agency_batch_task_record(database.pool(), "task-1", "测试会计")
            .await
            .expect("executes batch task");
        assert_eq!(task.status, "completed_with_errors");
        assert_eq!(task.progress_current, 2);
        assert_eq!(task.progress_total, Some(2));

        let jobs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM automation_jobs WHERE source_id = 'task-1' AND job_type = 'invoice_collection'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts queued jobs");
        assert_eq!(jobs, 1);
        let item_statuses: Vec<String> = sqlx::query_scalar(
            "SELECT status FROM agency_batch_task_items WHERE task_id = 'task-1' ORDER BY status",
        )
        .fetch_all(database.pool())
        .await
        .expect("reads execution items");
        assert_eq!(
            item_statuses,
            vec!["blocked".to_string(), "queued".to_string()]
        );
        let audits: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE action = '执行批量任务' AND object_ref = 'task-1' AND operator = '测试会计'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts audit records");
        assert_eq!(audits, 1);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn batch_execution_without_active_accounts_is_blocked_and_audited() {
        let (database, data_dir) = test_database("empty").await;
        sqlx::query(
            "INSERT INTO agency_batch_tasks (id, task_type, task_name, period, customer_scope, status) VALUES ('task-empty', 'invoice_collection', '批量采集发票', '2026-05', '全部客户', 'prechecked')",
        )
        .execute(database.pool())
        .await
        .expect("creates empty batch task");

        let task = run_agency_batch_task_record(database.pool(), "task-empty", "审计会计")
            .await
            .expect("blocks empty batch task");
        assert_eq!(task.status, "blocked");
        assert_eq!(task.progress_current, 0);
        assert_eq!(task.progress_total, Some(0));

        let audits: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE action = '执行批量任务' AND object_ref = 'task-empty' AND result = 'blocked' AND operator = '审计会计'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts blocked audit records");
        assert_eq!(audits, 1);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn batch_closing_uses_the_existing_draft_voucher_guard() {
        let (database, data_dir) = test_database("closing").await;
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '待结账企业')",
        )
        .execute(database.pool())
        .await
        .expect("creates company");
        sqlx::query(
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('period-1', 'company-1', 2026, 5, '2026-05-01', '2026-05-31', 'open')",
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
            "INSERT INTO vouchers (id, company_id, period_id, voucher_word_id, voucher_number, sequence_num, voucher_date, status) VALUES ('voucher-1', 'company-1', 'period-1', 'word-1', '记-001', 1, '2026-05-31', 'draft')",
        )
        .execute(database.pool())
        .await
        .expect("creates draft voucher");
        sqlx::query(
            "INSERT INTO agency_batch_tasks (id, task_type, task_name, period, customer_scope, status, requires_approval) VALUES ('task-close', 'closing_precheck', '批量结账预检', '2026-05', '待结账客户', 'prechecked', 1)",
        )
        .execute(database.pool())
        .await
        .expect("creates approved close task");

        let task = run_agency_batch_task_record(database.pool(), "task-close", "结账会计")
            .await
            .expect("finishes batch attempt");
        assert_eq!(task.status, "blocked");
        let period_status: String =
            sqlx::query_scalar("SELECT status FROM accounting_periods WHERE id = 'period-1'")
                .fetch_one(database.pool())
                .await
                .expect("reads period status");
        assert_eq!(period_status, "open");
        let error: String = sqlx::query_scalar(
            "SELECT error_message FROM agency_batch_task_items WHERE task_id = 'task-close'",
        )
        .fetch_one(database.pool())
        .await
        .expect("reads close blocking reason");
        assert!(error.contains("草稿凭证"));

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }
}
