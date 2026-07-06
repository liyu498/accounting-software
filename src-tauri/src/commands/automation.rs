use crate::db::{
    AdapterAuthorization, AutomationJob, ConfirmTaxDeclarationTaskInput,
    CreateAutomationJobInput, CreateOperationAuditLogInput, Database, OperationAuditLog,
    TaxDeclarationTask, UpdateAutomationJobStatusInput, UpsertAdapterAuthorizationInput,
    UpsertTaxDeclarationTaskInput,
};
use tauri::State;

fn require_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} cannot be empty", field))
    } else {
        Ok(())
    }
}

fn default_string(value: Option<String>, default_value: &str) -> String {
    value.unwrap_or_else(|| default_value.to_string())
}

async fn get_automation_job_by_id(
    id: &str,
    db: &Database,
) -> Result<AutomationJob, String> {
    sqlx::query_as(
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
        WHERE j.id = ?
        "#,
    )
    .bind(id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

async fn get_tax_declaration_task_by_id(
    id: &str,
    db: &Database,
) -> Result<TaxDeclarationTask, String> {
    sqlx::query_as(
        r#"
        SELECT
            t.id,
            t.company_id,
            c.name AS company_name,
            t.period,
            t.tax_type,
            t.form_name,
            t.collect_status,
            t.validation_status,
            t.declaration_status,
            t.source_snapshot,
            t.taxable_amount,
            t.deduction_amount,
            t.payable_amount,
            t.risk_count,
            t.adapter_code,
            t.confirmed_by,
            t.confirmed_at,
            t.receipt_no,
            t.created_at,
            t.updated_at
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.id = ?
        "#,
    )
    .bind(id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

async fn get_adapter_authorization_by_key(
    company_id: &str,
    adapter_type: &str,
    adapter_code: &str,
    db: &Database,
) -> Result<AdapterAuthorization, String> {
    sqlx::query_as(
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
        WHERE a.company_id = ? AND a.adapter_type = ? AND a.adapter_code = ?
        "#,
    )
    .bind(company_id)
    .bind(adapter_type)
    .bind(adapter_code)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_automation_jobs(
    company_id: String,
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AutomationJob>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
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
        WHERE j.company_id = ?
          AND (? IS NULL OR j.period = ?)
          AND (? IS NULL OR j.status = ?)
        ORDER BY j.created_at DESC
        "#,
    )
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn create_automation_job(
    input: CreateAutomationJobInput,
    db: State<'_, Database>,
) -> Result<AutomationJob, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.job_type, "job_type")?;
    require_non_empty(&input.source_module, "source_module")?;

    let id = uuid::Uuid::new_v4().to_string();
    let status = default_string(input.status, "queued");
    let risk_level = default_string(input.risk_level, "normal");

    sqlx::query(
        r#"
        INSERT INTO automation_jobs (
            id, company_id, period, job_type, source_module, source_id, source_file,
            status, confidence, result_summary, risk_level, reviewer, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.job_type)
    .bind(&input.source_module)
    .bind(&input.source_id)
    .bind(&input.source_file)
    .bind(&status)
    .bind(input.confidence)
    .bind(&input.result_summary)
    .bind(&risk_level)
    .bind(&input.reviewer)
    .bind(&input.created_by)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_automation_job_by_id(&id, &db).await
}

#[tauri::command]
pub async fn update_automation_job_status(
    input: UpdateAutomationJobStatusInput,
    db: State<'_, Database>,
) -> Result<AutomationJob, String> {
    require_non_empty(&input.id, "id")?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.status, "status")?;

    sqlx::query(
        r#"
        UPDATE automation_jobs
        SET
            status = ?,
            confidence = COALESCE(?, confidence),
            result_summary = COALESCE(?, result_summary),
            risk_level = COALESCE(?, risk_level),
            reviewer = COALESCE(?, reviewer),
            updated_at = datetime('now')
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(&input.status)
    .bind(input.confidence)
    .bind(&input.result_summary)
    .bind(&input.risk_level)
    .bind(&input.reviewer)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_automation_job_by_id(&input.id, &db).await
}

#[tauri::command]
pub async fn get_tax_declaration_tasks(
    company_id: String,
    period: Option<String>,
    declaration_status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<TaxDeclarationTask>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
        r#"
        SELECT
            t.id,
            t.company_id,
            c.name AS company_name,
            t.period,
            t.tax_type,
            t.form_name,
            t.collect_status,
            t.validation_status,
            t.declaration_status,
            t.source_snapshot,
            t.taxable_amount,
            t.deduction_amount,
            t.payable_amount,
            t.risk_count,
            t.adapter_code,
            t.confirmed_by,
            t.confirmed_at,
            t.receipt_no,
            t.created_at,
            t.updated_at
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.company_id = ?
          AND (? IS NULL OR t.period = ?)
          AND (? IS NULL OR t.declaration_status = ?)
        ORDER BY t.period DESC, t.tax_type ASC, t.form_name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&declaration_status)
    .bind(&declaration_status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn upsert_tax_declaration_task(
    input: UpsertTaxDeclarationTaskInput,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.period, "period")?;
    require_non_empty(&input.tax_type, "tax_type")?;
    require_non_empty(&input.form_name, "form_name")?;

    let id = uuid::Uuid::new_v4().to_string();
    let collect_status = default_string(input.collect_status, "not_collected");
    let validation_status = default_string(input.validation_status, "pending");
    let declaration_status = default_string(input.declaration_status, "draft");
    let taxable_amount = input.taxable_amount.unwrap_or(0.0);
    let deduction_amount = input.deduction_amount.unwrap_or(0.0);
    let payable_amount = input.payable_amount.unwrap_or(0.0);
    let risk_count = input.risk_count.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO tax_declaration_tasks (
            id, company_id, period, tax_type, form_name, collect_status, validation_status,
            declaration_status, source_snapshot, taxable_amount, deduction_amount, payable_amount,
            risk_count, adapter_code, receipt_no
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, period, tax_type, form_name) DO UPDATE SET
            collect_status = excluded.collect_status,
            validation_status = excluded.validation_status,
            declaration_status = excluded.declaration_status,
            source_snapshot = excluded.source_snapshot,
            taxable_amount = excluded.taxable_amount,
            deduction_amount = excluded.deduction_amount,
            payable_amount = excluded.payable_amount,
            risk_count = excluded.risk_count,
            adapter_code = excluded.adapter_code,
            receipt_no = excluded.receipt_no,
            updated_at = datetime('now')
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.tax_type)
    .bind(&input.form_name)
    .bind(&collect_status)
    .bind(&validation_status)
    .bind(&declaration_status)
    .bind(&input.source_snapshot)
    .bind(taxable_amount)
    .bind(deduction_amount)
    .bind(payable_amount)
    .bind(risk_count)
    .bind(&input.adapter_code)
    .bind(&input.receipt_no)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query_as(
        r#"
        SELECT
            t.id,
            t.company_id,
            c.name AS company_name,
            t.period,
            t.tax_type,
            t.form_name,
            t.collect_status,
            t.validation_status,
            t.declaration_status,
            t.source_snapshot,
            t.taxable_amount,
            t.deduction_amount,
            t.payable_amount,
            t.risk_count,
            t.adapter_code,
            t.confirmed_by,
            t.confirmed_at,
            t.receipt_no,
            t.created_at,
            t.updated_at
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.company_id = ? AND t.period = ? AND t.tax_type = ? AND t.form_name = ?
        "#,
    )
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.tax_type)
    .bind(&input.form_name)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn confirm_tax_declaration_task(
    input: ConfirmTaxDeclarationTaskInput,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.id, "id")?;
    require_non_empty(&input.company_id, "company_id")?;

    let current = get_tax_declaration_task_by_id(&input.id, &db).await?;
    if current.company_id != input.company_id {
        return Err("Tax declaration task does not belong to this company".to_string());
    }
    if current.risk_count > 0 {
        return Err("存在未处理风险项，不能确认申报".to_string());
    }
    if current.validation_status != "passed" {
        return Err("校验未通过，不能确认申报".to_string());
    }

    sqlx::query(
        r#"
        UPDATE tax_declaration_tasks
        SET declaration_status = 'confirmed',
            confirmed_by = ?,
            confirmed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(&input.confirmed_by)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_tax_declaration_task_by_id(&input.id, &db).await
}

#[tauri::command]
pub async fn get_adapter_authorizations(
    company_id: String,
    adapter_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AdapterAuthorization>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
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
        WHERE a.company_id = ?
          AND (? IS NULL OR a.adapter_type = ?)
        ORDER BY a.adapter_type ASC, a.region ASC, a.updated_at DESC
        "#,
    )
    .bind(&company_id)
    .bind(&adapter_type)
    .bind(&adapter_type)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn upsert_adapter_authorization(
    input: UpsertAdapterAuthorizationInput,
    db: State<'_, Database>,
) -> Result<AdapterAuthorization, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.adapter_type, "adapter_type")?;
    require_non_empty(&input.adapter_code, "adapter_code")?;

    let id = uuid::Uuid::new_v4().to_string();
    let auth_status = default_string(input.auth_status, "pending");

    sqlx::query(
        r#"
        INSERT INTO adapter_authorizations (
            id, company_id, adapter_type, adapter_code, region, auth_status, account_mask,
            login_identity, capability_scope, last_checked_at, expires_at, risk_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, adapter_type, adapter_code) DO UPDATE SET
            region = excluded.region,
            auth_status = excluded.auth_status,
            account_mask = excluded.account_mask,
            login_identity = excluded.login_identity,
            capability_scope = excluded.capability_scope,
            last_checked_at = excluded.last_checked_at,
            expires_at = excluded.expires_at,
            risk_message = excluded.risk_message,
            updated_at = datetime('now')
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.adapter_type)
    .bind(&input.adapter_code)
    .bind(&input.region)
    .bind(&auth_status)
    .bind(&input.account_mask)
    .bind(&input.login_identity)
    .bind(&input.capability_scope)
    .bind(&input.last_checked_at)
    .bind(&input.expires_at)
    .bind(&input.risk_message)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_adapter_authorization_by_key(
        &input.company_id,
        &input.adapter_type,
        &input.adapter_code,
        &db,
    )
    .await
}

#[tauri::command]
pub async fn write_operation_audit_log(
    input: CreateOperationAuditLogInput,
    db: State<'_, Database>,
) -> Result<OperationAuditLog, String> {
    require_non_empty(&input.module_name, "module_name")?;
    require_non_empty(&input.action, "action")?;

    let id = uuid::Uuid::new_v4().to_string();
    let risk_level = default_string(input.risk_level, "normal");
    let result = default_string(input.result, "success");

    sqlx::query(
        r#"
        INSERT INTO operation_audit_logs (
            id, company_id, module_name, action, object_ref, risk_level, result, detail, operator
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.module_name)
    .bind(&input.action)
    .bind(&input.object_ref)
    .bind(&risk_level)
    .bind(&result)
    .bind(&input.detail)
    .bind(&input.operator)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query_as(
        r#"
        SELECT
            l.id,
            l.company_id,
            c.name AS company_name,
            l.module_name,
            l.action,
            l.object_ref,
            l.risk_level,
            l.result,
            l.detail,
            l.operator,
            l.created_at
        FROM operation_audit_logs l
        LEFT JOIN companies c ON c.id = l.company_id
        WHERE l.id = ?
        "#,
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_operation_audit_logs(
    company_id: Option<String>,
    module_name: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<OperationAuditLog>, String> {
    sqlx::query_as(
        r#"
        SELECT
            l.id,
            l.company_id,
            c.name AS company_name,
            l.module_name,
            l.action,
            l.object_ref,
            l.risk_level,
            l.result,
            l.detail,
            l.operator,
            l.created_at
        FROM operation_audit_logs l
        LEFT JOIN companies c ON c.id = l.company_id
        WHERE (? IS NULL OR l.company_id = ?)
          AND (? IS NULL OR l.module_name = ?)
        ORDER BY l.created_at DESC
        LIMIT 200
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&module_name)
    .bind(&module_name)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}
