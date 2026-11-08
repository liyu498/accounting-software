use crate::commands::auth::authenticated_actor;
use crate::db::{
    CopyLocalVoucherAttachmentsInput, CreateLocalFileRecordInput, Database,
    DeleteLocalFileRecordInput, LocalFileRecord, UpdateLocalFileRecordInput,
};
use sqlx::{Sqlite, Transaction};
use tauri::State;

const LOCAL_FILE_SELECT: &str = r#"
    SELECT id, record_kind, company_id, period, module_name, operation,
           file_name, file_size, file_format, checksum, status, row_count,
           column_preview, preview_rows, validation_note, written_row_count,
           failed_row_count, failure_rows, related_document, operator,
           created_at, updated_at
    FROM local_file_records
"#;

fn trimmed_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn validate_create_input(input: &CreateLocalFileRecordInput) -> Result<(), String> {
    if !matches!(input.record_kind.as_str(), "import" | "attachment") {
        return Err("文件登记类型仅支持导入批次或附件".to_string());
    }
    if input.company_id.trim().is_empty()
        || input.period.trim().is_empty()
        || input.module_name.trim().is_empty()
        || input.file_name.trim().is_empty()
        || input.file_format.trim().is_empty()
        || input.checksum.trim().is_empty()
    {
        return Err("账套、账期、模块、文件名、格式和校验值不能为空".to_string());
    }
    let maximum = if input.record_kind == "import" {
        25 * 1024 * 1024
    } else {
        100 * 1024 * 1024
    };
    if input.file_size <= 0 || input.file_size > maximum {
        return Err(format!(
            "文件大小必须大于零且不超过 {} MB",
            maximum / 1024 / 1024
        ));
    }
    if input.checksum.len() > 128 {
        return Err("文件校验值格式无效".to_string());
    }
    Ok(())
}

async fn write_file_audit(
    transaction: &mut Transaction<'_, Sqlite>,
    company_id: &str,
    action: &str,
    object_ref: &str,
    detail: &str,
    actor: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator, created_at)
           VALUES (?, ?, '文件中心', ?, ?, 'medium', 'success', ?, ?, datetime('now'))"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(action)
    .bind(object_ref)
    .bind(detail)
    .bind(actor)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("写入文件登记审计失败: {error}"))?;
    Ok(())
}

async fn get_record(
    pool: &crate::db::DbPool,
    id: &str,
    company_id: &str,
) -> Result<LocalFileRecord, String> {
    sqlx::query_as(&format!(
        "{LOCAL_FILE_SELECT} WHERE id = ? AND company_id = ? AND deleted_at IS NULL"
    ))
    .bind(id)
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("读取文件登记失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的文件登记".to_string())
}

async fn create_local_file_record_record(
    pool: &crate::db::DbPool,
    input: CreateLocalFileRecordInput,
    actor: &str,
) -> Result<LocalFileRecord, String> {
    validate_create_input(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    let status = trimmed_optional(input.status.clone()).unwrap_or_else(|| "待确认".to_string());
    if status != "待确认" {
        return Err("新文件登记必须从待确认状态开始".to_string());
    }
    let module_name = input.module_name.trim().to_string();
    let detail = format!(
        "{}：{}，校验值 {}",
        module_name,
        input.file_name.trim(),
        input.checksum.trim()
    );
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建文件登记事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO local_file_records
           (id, record_kind, company_id, period, module_name, operation, file_name,
            file_size, file_format, checksum, status, row_count, column_preview,
            preview_rows, validation_note, related_document, operator)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.record_kind)
    .bind(input.company_id.trim())
    .bind(input.period.trim())
    .bind(&module_name)
    .bind(trimmed_optional(input.operation))
    .bind(input.file_name.trim())
    .bind(input.file_size)
    .bind(input.file_format.trim())
    .bind(input.checksum.trim())
    .bind(&status)
    .bind(input.row_count)
    .bind(trimmed_optional(input.column_preview))
    .bind(trimmed_optional(input.preview_rows))
    .bind(trimmed_optional(input.validation_note))
    .bind(trimmed_optional(input.related_document))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存文件登记失败: {error}"))?;
    write_file_audit(
        &mut transaction,
        input.company_id.trim(),
        "登记文件",
        &id,
        &detail,
        actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交文件登记失败: {error}"))?;
    get_record(pool, &id, input.company_id.trim()).await
}

async fn update_local_file_record_record(
    pool: &crate::db::DbPool,
    input: UpdateLocalFileRecordInput,
    actor: &str,
) -> Result<LocalFileRecord, String> {
    let current = get_record(pool, input.id.trim(), input.company_id.trim()).await?;
    let allowed = match current.record_kind.as_str() {
        "attachment" => matches!(input.status.as_str(), "待确认" | "已关联" | "异常"),
        "import" => matches!(
            input.status.as_str(),
            "待确认" | "已校验" | "已写入" | "异常"
        ),
        _ => false,
    };
    if !allowed {
        return Err("文件登记状态与登记类型不匹配".to_string());
    }
    if current.record_kind == "import" && current.status == "已写入" && input.status != "已写入"
    {
        return Err("已写入账套的导入批次不能回退状态".to_string());
    }
    if input.written_row_count.unwrap_or(0) < 0 || input.failed_row_count.unwrap_or(0) < 0 {
        return Err("导入行数不能为负数".to_string());
    }
    let detail = format!("{} -> {}", current.status, input.status);
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建文件登记更新事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE local_file_records
           SET status = ?, related_document = COALESCE(?, related_document),
               validation_note = COALESCE(?, validation_note),
               written_row_count = COALESCE(?, written_row_count),
               failed_row_count = COALESCE(?, failed_row_count),
               failure_rows = COALESCE(?, failure_rows), operator = ?,
               updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND deleted_at IS NULL"#,
    )
    .bind(input.status.trim())
    .bind(trimmed_optional(input.related_document))
    .bind(trimmed_optional(input.validation_note))
    .bind(input.written_row_count)
    .bind(input.failed_row_count)
    .bind(trimmed_optional(input.failure_rows))
    .bind(actor)
    .bind(input.id.trim())
    .bind(input.company_id.trim())
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新文件登记失败: {error}"))?;
    write_file_audit(
        &mut transaction,
        input.company_id.trim(),
        "更新文件登记",
        input.id.trim(),
        &detail,
        actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交文件登记更新失败: {error}"))?;
    get_record(pool, input.id.trim(), input.company_id.trim()).await
}

async fn delete_local_file_record_record(
    pool: &crate::db::DbPool,
    input: DeleteLocalFileRecordInput,
    actor: &str,
) -> Result<bool, String> {
    let current = get_record(pool, input.id.trim(), input.company_id.trim()).await?;
    if current.record_kind == "import" && current.status == "已写入" {
        return Err("已写入账套的导入批次必须保留审计记录，不能移除".to_string());
    }
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建文件登记删除事务失败: {error}"))?;
    let result = sqlx::query(
        "UPDATE local_file_records SET deleted_at = datetime('now'), updated_at = datetime('now'), operator = ? WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
    )
    .bind(actor)
    .bind(input.id.trim())
    .bind(input.company_id.trim())
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("移除文件登记失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("文件登记已被移除，请刷新后重试".to_string());
    }
    write_file_audit(
        &mut transaction,
        input.company_id.trim(),
        "移除文件登记",
        input.id.trim(),
        &current.file_name,
        actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交文件登记移除失败: {error}"))?;
    Ok(true)
}

async fn copy_local_voucher_attachments_record(
    pool: &crate::db::DbPool,
    input: CopyLocalVoucherAttachmentsInput,
    actor: &str,
) -> Result<Vec<LocalFileRecord>, String> {
    if input.company_id.trim().is_empty()
        || input.period.trim().is_empty()
        || input.source_document.trim().is_empty()
        || input.target_document.trim().is_empty()
        || input.source_document == input.target_document
    {
        return Err("附件复制必须提供同账套、同账期且不同的源凭证和目标凭证".to_string());
    }
    let sources: Vec<LocalFileRecord> = sqlx::query_as(&format!(
        "{LOCAL_FILE_SELECT} WHERE record_kind = 'attachment' AND company_id = ? AND period = ? AND related_document = ? AND deleted_at IS NULL ORDER BY created_at"
    ))
    .bind(input.company_id.trim())
    .bind(input.period.trim())
    .bind(input.source_document.trim())
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取源凭证附件失败: {error}"))?;
    if sources.is_empty() {
        return Ok(Vec::new());
    }
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建附件复制事务失败: {error}"))?;
    for source in &sources {
        sqlx::query(
            r#"INSERT INTO local_file_records
               (id, record_kind, company_id, period, module_name, operation, file_name,
                file_size, file_format, checksum, status, related_document, operator)
               VALUES (?, 'attachment', ?, ?, ?, '复制凭证附件关联', ?, ?, ?, ?, '已关联', ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(input.company_id.trim())
        .bind(input.period.trim())
        .bind(&source.module_name)
        .bind(&source.file_name)
        .bind(source.file_size)
        .bind(&source.file_format)
        .bind(&source.checksum)
        .bind(input.target_document.trim())
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("复制凭证附件关联失败: {error}"))?;
    }
    write_file_audit(
        &mut transaction,
        input.company_id.trim(),
        "复制凭证附件关联",
        input.target_document.trim(),
        &format!(
            "从 {} 复制 {} 个附件关联",
            input.source_document.trim(),
            sources.len()
        ),
        actor,
    )
    .await?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交附件复制失败: {error}"))?;
    sqlx::query_as(&format!(
        "{LOCAL_FILE_SELECT} WHERE company_id = ? AND period = ? AND related_document = ? AND deleted_at IS NULL ORDER BY created_at"
    ))
    .bind(input.company_id.trim())
    .bind(input.period.trim())
    .bind(input.target_document.trim())
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取复制后的附件关联失败: {error}"))
}

#[tauri::command]
pub async fn get_local_file_records(
    company_id: String,
    period: String,
    record_kind: String,
    db: State<'_, Database>,
) -> Result<Vec<LocalFileRecord>, String> {
    if !matches!(record_kind.as_str(), "import" | "attachment") {
        return Err("文件登记类型无效".to_string());
    }
    sqlx::query_as(&format!(
        "{LOCAL_FILE_SELECT} WHERE company_id = ? AND period = ? AND record_kind = ? AND deleted_at IS NULL ORDER BY created_at DESC"
    ))
    .bind(company_id)
    .bind(period)
    .bind(record_kind)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询文件登记失败: {error}"))
}

#[tauri::command]
pub async fn create_local_file_record(
    input: CreateLocalFileRecordInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<LocalFileRecord, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_local_file_record_record(db.pool(), input, &actor).await
}

#[tauri::command]
pub async fn update_local_file_record(
    input: UpdateLocalFileRecordInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<LocalFileRecord, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    update_local_file_record_record(db.pool(), input, &actor).await
}

#[tauri::command]
pub async fn delete_local_file_record(
    input: DeleteLocalFileRecordInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    delete_local_file_record_record(db.pool(), input, &actor).await
}

#[tauri::command]
pub async fn copy_local_voucher_attachments(
    input: CopyLocalVoucherAttachmentsInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<Vec<LocalFileRecord>, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    copy_local_voucher_attachments_record(db.pool(), input, &actor).await
}

#[cfg(test)]
mod tests {
    use super::{
        copy_local_voucher_attachments_record, create_local_file_record_record,
        delete_local_file_record_record, update_local_file_record_record,
    };
    use crate::db::{
        CopyLocalVoucherAttachmentsInput, CreateLocalFileRecordInput, Database,
        DeleteLocalFileRecordInput, UpdateLocalFileRecordInput,
    };

    #[tokio::test]
    async fn attachment_lifecycle_is_scoped_copied_soft_deleted_and_audited() {
        let data_dir =
            std::env::temp_dir().join(format!("accounting-local-files-{}", uuid::Uuid::new_v4()));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes file registry database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '文件测试企业')",
        )
        .execute(database.pool())
        .await
        .expect("creates company");

        let source = create_local_file_record_record(
            database.pool(),
            CreateLocalFileRecordInput {
                record_kind: "attachment".to_string(),
                company_id: "company-1".to_string(),
                period: "2026-05".to_string(),
                module_name: "会计凭证".to_string(),
                operation: None,
                file_name: "invoice.pdf".to_string(),
                file_size: 128,
                file_format: "PDF".to_string(),
                checksum: "a".repeat(64),
                status: None,
                row_count: None,
                column_preview: None,
                preview_rows: None,
                validation_note: None,
                related_document: None,
            },
            "王会计",
        )
        .await
        .expect("creates attachment");
        let linked = update_local_file_record_record(
            database.pool(),
            UpdateLocalFileRecordInput {
                id: source.id.clone(),
                company_id: "company-1".to_string(),
                status: "已关联".to_string(),
                related_document: Some("voucher-1".to_string()),
                validation_note: None,
                written_row_count: None,
                failed_row_count: None,
                failure_rows: None,
            },
            "王会计",
        )
        .await
        .expect("links attachment");
        assert_eq!(linked.related_document.as_deref(), Some("voucher-1"));

        let copies = copy_local_voucher_attachments_record(
            database.pool(),
            CopyLocalVoucherAttachmentsInput {
                company_id: "company-1".to_string(),
                period: "2026-05".to_string(),
                source_document: "voucher-1".to_string(),
                target_document: "voucher-2".to_string(),
            },
            "王会计",
        )
        .await
        .expect("copies attachment association");
        assert_eq!(copies.len(), 1);
        assert_eq!(copies[0].checksum, source.checksum);

        delete_local_file_record_record(
            database.pool(),
            DeleteLocalFileRecordInput {
                id: source.id,
                company_id: "company-1".to_string(),
            },
            "王会计",
        )
        .await
        .expect("soft deletes source association");
        let active_sources: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM local_file_records WHERE related_document = 'voucher-1' AND deleted_at IS NULL",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts active source records");
        assert_eq!(active_sources, 0);
        let audits: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE module_name = '文件中心' AND company_id = 'company-1' AND operator = '王会计'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts file audits");
        assert_eq!(audits, 4);

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes file registry database");
    }
}
