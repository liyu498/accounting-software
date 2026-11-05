use crate::commands::auth::authenticated_actor;
use crate::db::{CreateExportJobInput, Database, DbPool, ExportJobRecord};
use tauri::State;

const EXPORT_JOB_SELECT: &str = r#"
    SELECT id, scope_kind, company_id, file_name, module_name, format,
           data_scope, fingerprint, operator, status, template_kind,
           row_count, expires_at, created_at
    FROM export_jobs
"#;

fn validate_input(input: &CreateExportJobInput) -> Result<(), String> {
    if !matches!(input.scope_kind.as_str(), "account" | "agency") {
        return Err("导出任务范围仅支持账套或机构".to_string());
    }
    let company_id = input
        .company_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if (input.scope_kind == "account" && company_id.is_none())
        || (input.scope_kind == "agency" && company_id.is_some())
    {
        return Err("账套导出必须指定账套，机构导出不能绑定单一账套".to_string());
    }
    if input.file_name.trim().is_empty()
        || input.module_name.trim().is_empty()
        || input.format.trim().is_empty()
        || input.data_scope.trim().is_empty()
        || input.fingerprint.trim().is_empty()
        || input.template_kind.trim().is_empty()
    {
        return Err("导出文件、模块、格式、数据范围、任务指纹和模板类型不能为空".to_string());
    }
    if input.fingerprint.len() > 128 || input.row_count < 0 {
        return Err("导出任务指纹或数据行数无效".to_string());
    }
    if !matches!(
        input.status.as_deref().unwrap_or("已完成"),
        "已完成" | "待确认" | "异常"
    ) {
        return Err("导出任务状态无效".to_string());
    }
    Ok(())
}

async fn create_export_job_record(
    pool: &DbPool,
    input: CreateExportJobInput,
    actor: &str,
) -> Result<ExportJobRecord, String> {
    validate_input(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    let status = input.status.as_deref().unwrap_or("已完成");
    let expires_at = (input.format != "打印预览").then(|| {
        (chrono::Utc::now() + chrono::Duration::days(7))
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
    });
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建导出任务事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO export_jobs
           (id, scope_kind, company_id, file_name, module_name, format,
            data_scope, fingerprint, operator, status, template_kind,
            row_count, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(input.scope_kind.trim())
    .bind(
        input
            .company_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(input.file_name.trim())
    .bind(input.module_name.trim())
    .bind(input.format.trim())
    .bind(input.data_scope.trim())
    .bind(input.fingerprint.trim())
    .bind(actor)
    .bind(status)
    .bind(input.template_kind.trim())
    .bind(input.row_count)
    .bind(expires_at)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存导出任务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '下载中心', '登记导出任务', ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(
        input
            .company_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(&id)
    .bind(if input.template_kind == "tax" {
        "medium"
    } else {
        "normal"
    })
    .bind(if status == "异常" { "failed" } else { "success" })
    .bind(format!(
        "{} · {} · {} 行 · {}",
        input.file_name.trim(),
        input.format.trim(),
        input.row_count,
        input.fingerprint.trim()
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入导出任务审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交导出任务失败: {error}"))?;
    sqlx::query_as(&format!("{EXPORT_JOB_SELECT} WHERE id = ?"))
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("读取导出任务失败: {error}"))
}

async fn get_export_job_records(
    pool: &DbPool,
    scope_kind: &str,
    company_id: Option<&str>,
) -> Result<Vec<ExportJobRecord>, String> {
    if !matches!(scope_kind, "account" | "agency") {
        return Err("导出任务范围无效".to_string());
    }
    if scope_kind == "account" {
        let company_id = company_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "查看账套导出任务前必须选择账套".to_string())?;
        sqlx::query_as(&format!(
            "{EXPORT_JOB_SELECT} WHERE scope_kind = 'account' AND company_id = ? ORDER BY created_at DESC LIMIT 200"
        ))
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("查询账套导出任务失败: {error}"))
    } else {
        sqlx::query_as(&format!(
            "{EXPORT_JOB_SELECT} WHERE scope_kind = 'agency' AND company_id IS NULL ORDER BY created_at DESC LIMIT 200"
        ))
        .fetch_all(pool)
        .await
        .map_err(|error| format!("查询机构导出任务失败: {error}"))
    }
}

#[tauri::command]
pub async fn get_export_jobs(
    scope_kind: String,
    company_id: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<ExportJobRecord>, String> {
    get_export_job_records(db.pool(), &scope_kind, company_id.as_deref()).await
}

#[tauri::command]
pub async fn create_export_job(
    input: CreateExportJobInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExportJobRecord, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_export_job_record(db.pool(), input, &actor).await
}

#[cfg(test)]
mod tests {
    use super::{create_export_job_record, get_export_job_records};
    use crate::db::{CreateExportJobInput, Database};

    #[tokio::test]
    async fn export_jobs_are_immutable_scoped_and_audited() {
        let data_dir =
            std::env::temp_dir().join(format!("accounting-export-jobs-{}", uuid::Uuid::new_v4()));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes export database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '导出测试企业')",
        )
        .execute(database.pool())
        .await
        .expect("creates company");

        create_export_job_record(
            database.pool(),
            CreateExportJobInput {
                scope_kind: "account".to_string(),
                company_id: Some("company-1".to_string()),
                file_name: "明细账.xlsx".to_string(),
                module_name: "明细账".to_string(),
                format: "Excel".to_string(),
                data_scope: "2026-05".to_string(),
                fingerprint: "h12345678".to_string(),
                status: None,
                template_kind: "accounting".to_string(),
                row_count: 10,
            },
            "李会计",
        )
        .await
        .expect("creates account export job");
        create_export_job_record(
            database.pool(),
            CreateExportJobInput {
                scope_kind: "agency".to_string(),
                company_id: None,
                file_name: "客户清单.pdf".to_string(),
                module_name: "机构-客户总览".to_string(),
                format: "PDF".to_string(),
                data_scope: "全部客户".to_string(),
                fingerprint: "h87654321".to_string(),
                status: None,
                template_kind: "agency".to_string(),
                row_count: 3,
            },
            "李会计",
        )
        .await
        .expect("creates agency export job");

        let account_jobs = get_export_job_records(database.pool(), "account", Some("company-1"))
            .await
            .expect("reads account exports");
        let agency_jobs = get_export_job_records(database.pool(), "agency", None)
            .await
            .expect("reads agency exports");
        assert_eq!(account_jobs.len(), 1);
        assert_eq!(agency_jobs.len(), 1);
        assert_eq!(account_jobs[0].operator, "李会计");
        let audits: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE module_name = '下载中心' AND action = '登记导出任务' AND operator = '李会计'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts export audits");
        assert_eq!(audits, 2);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes export database");
    }
}
