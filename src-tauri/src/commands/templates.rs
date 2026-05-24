use crate::db::{
    CommonDigest, CreateCommonDigestInput, CreateVoucherTemplateInput, Database, VoucherTemplate,
    VoucherTemplateType,
};
use serde::{Deserialize, Serialize};
use tauri::State;

// ─── Voucher Template Types ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTemplateTypeInput {
    pub company_id: String,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[tauri::command]
pub async fn get_voucher_template_types(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherTemplateType>, String> {
    sqlx::query_as(
        "SELECT * FROM voucher_template_types WHERE company_id = ? ORDER BY sort_order, name",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询模板类型失败: {}", e))
}

#[tauri::command]
pub async fn create_voucher_template_type(
    input: CreateTemplateTypeInput,
    db: State<'_, Database>,
) -> Result<VoucherTemplateType, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let sort_order = input.sort_order.unwrap_or(0);

    sqlx::query(
        "INSERT INTO voucher_template_types (id, company_id, name, sort_order) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.name)
    .bind(sort_order)
    .execute(db.pool())
    .await
    .map_err(|e| format!("创建模板类型失败: {}", e))?;

    let result: VoucherTemplateType = sqlx::query_as(
        "SELECT * FROM voucher_template_types WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询新创建的模板类型失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_voucher_template_type(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM voucher_templates WHERE type_id = ? AND company_id = ?",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if count.0 > 0 {
        return Err("该类型下存在模板，不能删除".to_string());
    }

    sqlx::query("DELETE FROM voucher_template_types WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("删除模板类型失败: {}", e))?;

    Ok(())
}

// ─── Voucher Templates ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateEntry {
    pub account_code: String,
    pub account_name: String,
    pub direction: String,
    pub summary: String,
    pub auxiliary_type: Option<String>,
    pub auxiliary_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoucherTemplateWithEntries {
    pub template: VoucherTemplate,
    pub entries: Vec<TemplateEntry>,
}

#[tauri::command]
pub async fn get_voucher_templates(
    type_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<VoucherTemplateWithEntries>, String> {
    let templates: Vec<VoucherTemplate> = sqlx::query_as(
        "SELECT * FROM voucher_templates WHERE type_id = ? AND company_id = ? ORDER BY name",
    )
    .bind(&type_id)
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询模板失败: {}", e))?;

    let mut result = Vec::new();
    for t in templates {
        let entries: Vec<TemplateEntry> =
            serde_json::from_str(&t.entries_json).unwrap_or_default();
        result.push(VoucherTemplateWithEntries {
            template: t,
            entries,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_voucher_template(
    input: CreateVoucherTemplateInput,
    db: State<'_, Database>,
) -> Result<VoucherTemplate, String> {
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO voucher_templates (id, type_id, company_id, name, entries_json) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.type_id)
    .bind(&input.company_id)
    .bind(&input.name)
    .bind(&input.entries_json)
    .execute(db.pool())
    .await
    .map_err(|e| format!("创建模板失败: {}", e))?;

    let result: VoucherTemplate = sqlx::query_as(
        "SELECT * FROM voucher_templates WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询新创建的模板失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn update_voucher_template(
    id: String,
    input: CreateVoucherTemplateInput,
    db: State<'_, Database>,
) -> Result<VoucherTemplate, String> {
    sqlx::query(
        "UPDATE voucher_templates SET type_id = ?, name = ?, entries_json = ? WHERE id = ? AND company_id = ?",
    )
    .bind(&input.type_id)
    .bind(&input.name)
    .bind(&input.entries_json)
    .bind(&id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("更新模板失败: {}", e))?;

    let result: VoucherTemplate = sqlx::query_as(
        "SELECT * FROM voucher_templates WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询更新后的模板失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_voucher_template(id: String, company_id: String, db: State<'_, Database>) -> Result<(), String> {
    sqlx::query("DELETE FROM voucher_templates WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("删除模板失败: {}", e))?;

    Ok(())
}

// ─── Common Digests ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_common_digests(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<CommonDigest>, String> {
    sqlx::query_as(
        "SELECT * FROM common_digests WHERE company_id = ? ORDER BY content",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("查询常用摘要失败: {}", e))
}

#[tauri::command]
pub async fn create_common_digest(
    input: CreateCommonDigestInput,
    db: State<'_, Database>,
) -> Result<CommonDigest, String> {
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO common_digests (id, company_id, content) VALUES (?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.content)
    .execute(db.pool())
    .await
    .map_err(|e| format!("创建常用摘要失败: {}", e))?;

    let result: CommonDigest = sqlx::query_as(
        "SELECT * FROM common_digests WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询新创建的常用摘要失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn update_common_digest(
    id: String,
    input: CreateCommonDigestInput,
    db: State<'_, Database>,
) -> Result<CommonDigest, String> {
    sqlx::query("UPDATE common_digests SET content = ? WHERE id = ?")
        .bind(&input.content)
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("更新常用摘要失败: {}", e))?;

    let result: CommonDigest = sqlx::query_as(
        "SELECT * FROM common_digests WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("查询更新后的常用摘要失败: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_common_digest(id: String, db: State<'_, Database>) -> Result<(), String> {
    sqlx::query("DELETE FROM common_digests WHERE id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("删除常用摘要失败: {}", e))?;

    Ok(())
}
