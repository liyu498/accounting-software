use crate::db::{Database, DbPool};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BusinessTag {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub applicable_modules: String,
    pub color_name: String,
    pub auto_rule: Option<String>,
    pub usage_count: i32,
    pub remarks: Option<String>,
    pub is_enabled: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BusinessTagInput {
    pub company_id: String,
    pub name: String,
    pub applicable_modules: String,
    pub color_name: String,
    pub auto_rule: Option<String>,
    pub remarks: Option<String>,
    pub is_enabled: Option<i32>,
}

fn validate(input: &BusinessTagInput) -> Result<(), String> {
    if input.name.trim().is_empty()
        || input.applicable_modules.trim().is_empty()
        || input.color_name.trim().is_empty()
    {
        return Err("标签名称、适用模块和颜色标识不能为空".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_business_tags(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<BusinessTag>, String> {
    sqlx::query_as(
        "SELECT * FROM business_tags WHERE company_id = ? ORDER BY is_enabled DESC, name",
    )
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询业务标签失败: {error}"))
}

#[tauri::command]
pub async fn create_business_tag(
    input: BusinessTagInput,
    db: State<'_, Database>,
) -> Result<BusinessTag, String> {
    validate(&input)?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO business_tags (id, company_id, name, applicable_modules, color_name, auto_rule, remarks, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(input.name.trim()).bind(input.applicable_modules.trim()).bind(input.color_name.trim()).bind(input.auto_rule.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.remarks.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1))
        .execute(db.pool()).await.map_err(|error| format!("新增业务标签失败: {error}"))?;
    sqlx::query_as("SELECT * FROM business_tags WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("读取业务标签失败: {error}"))
}

#[tauri::command]
pub async fn update_business_tag(
    id: String,
    input: BusinessTagInput,
    db: State<'_, Database>,
) -> Result<BusinessTag, String> {
    validate(&input)?;
    let result = sqlx::query("UPDATE business_tags SET name = ?, applicable_modules = ?, color_name = ?, auto_rule = ?, remarks = ?, is_enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.name.trim()).bind(input.applicable_modules.trim()).bind(input.color_name.trim()).bind(input.auto_rule.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.remarks.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.is_enabled.unwrap_or(1)).bind(&id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新业务标签失败: {error}"))?;
    if result.rows_affected() == 0 {
        return Err("业务标签不存在或不属于当前账套".to_string());
    }
    sqlx::query_as("SELECT * FROM business_tags WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("读取业务标签失败: {error}"))
}

#[tauri::command]
pub async fn delete_business_tag(
    id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let usage_count: i64 = sqlx::query_scalar("SELECT (SELECT COUNT(*) FROM invoice_tags WHERE tag_id = ? AND company_id = ?) + (SELECT COUNT(*) FROM voucher_tags WHERE tag_id = ? AND company_id = ?) + (SELECT COUNT(*) FROM bank_transaction_tags WHERE tag_id = ? AND company_id = ?)")
        .bind(&id).bind(&company_id)
        .bind(&id).bind(&company_id)
        .bind(&id).bind(&company_id).fetch_one(db.pool()).await.map_err(|error| format!("校验业务标签使用情况失败: {error}"))?;
    if usage_count > 0 {
        return Err("该标签已关联业务记录，请先移除关联后再删除".to_string());
    }
    let result = sqlx::query("DELETE FROM business_tags WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .execute(db.pool())
        .await
        .map_err(|error| format!("删除业务标签失败: {error}"))?;
    if result.rows_affected() == 0 {
        return Err("业务标签不存在或不属于当前账套".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_invoice_tag_ids(
    invoice_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    sqlx::query_scalar(
        "SELECT tag_id FROM invoice_tags WHERE invoice_id = ? AND company_id = ? ORDER BY tag_id",
    )
    .bind(invoice_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询发票标签失败: {error}"))
}

#[tauri::command]
pub async fn replace_invoice_tags(
    invoice_id: String,
    company_id: String,
    tag_ids: Vec<String>,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    replace_invoice_tags_record(invoice_id, company_id, tag_ids, db.pool()).await
}

async fn replace_invoice_tags_record(
    invoice_id: String,
    company_id: String,
    tag_ids: Vec<String>,
    pool: &DbPool,
) -> Result<Vec<String>, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("开始发票标签事务失败: {error}"))?;
    let invoice_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM invoices WHERE id = ? AND company_id = ?")
            .bind(&invoice_id)
            .bind(&company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("校验发票失败: {error}"))?;
    if invoice_exists.is_none() {
        return Err("发票不存在或不属于当前账套".to_string());
    }
    let mut seen_ids = HashSet::new();
    let distinct_ids: Vec<String> = tag_ids
        .into_iter()
        .filter(|id| !id.trim().is_empty() && seen_ids.insert(id.clone()))
        .collect();
    for tag_id in &distinct_ids {
        let tag_exists: Option<(String,)> =
            sqlx::query_as("SELECT id FROM business_tags WHERE id = ? AND company_id = ?")
                .bind(tag_id)
                .bind(&company_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|error| format!("校验业务标签失败: {error}"))?;
        if tag_exists.is_none() {
            return Err("标签不存在或不属于当前账套".to_string());
        }
    }
    sqlx::query("DELETE FROM invoice_tags WHERE invoice_id = ? AND company_id = ?")
        .bind(&invoice_id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理发票标签失败: {error}"))?;
    for tag_id in &distinct_ids {
        sqlx::query("INSERT INTO invoice_tags (invoice_id, tag_id, company_id) VALUES (?, ?, ?)")
            .bind(&invoice_id)
            .bind(tag_id)
            .bind(&company_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("保存发票标签失败: {error}"))?;
    }
    sqlx::query("UPDATE business_tags SET usage_count = (SELECT COUNT(*) FROM invoice_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM voucher_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM bank_transaction_tags WHERE tag_id = business_tags.id), updated_at = datetime('now') WHERE company_id = ?")
        .bind(&company_id).execute(&mut *transaction).await.map_err(|error| format!("更新标签使用次数失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交发票标签事务失败: {error}"))?;
    Ok(distinct_ids)
}

#[tauri::command]
pub async fn get_voucher_tag_ids(
    voucher_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    sqlx::query_scalar(
        "SELECT tag_id FROM voucher_tags WHERE voucher_id = ? AND company_id = ? ORDER BY tag_id",
    )
    .bind(voucher_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询凭证标签失败: {error}"))
}

#[tauri::command]
pub async fn replace_voucher_tags(
    voucher_id: String,
    company_id: String,
    tag_ids: Vec<String>,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("开始凭证标签事务失败: {error}"))?;
    let voucher_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM vouchers WHERE id = ? AND company_id = ?")
            .bind(&voucher_id)
            .bind(&company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("校验凭证失败: {error}"))?;
    if voucher_exists.is_none() {
        return Err("凭证不存在或不属于当前账套".to_string());
    }
    let mut seen_ids = HashSet::new();
    let distinct_ids: Vec<String> = tag_ids
        .into_iter()
        .filter(|id| !id.trim().is_empty() && seen_ids.insert(id.clone()))
        .collect();
    for tag_id in &distinct_ids {
        let tag_exists: Option<(String,)> =
            sqlx::query_as("SELECT id FROM business_tags WHERE id = ? AND company_id = ?")
                .bind(tag_id)
                .bind(&company_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|error| format!("校验业务标签失败: {error}"))?;
        if tag_exists.is_none() {
            return Err("标签不存在或不属于当前账套".to_string());
        }
    }
    sqlx::query("DELETE FROM voucher_tags WHERE voucher_id = ? AND company_id = ?")
        .bind(&voucher_id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理凭证标签失败: {error}"))?;
    for tag_id in &distinct_ids {
        sqlx::query("INSERT INTO voucher_tags (voucher_id, tag_id, company_id) VALUES (?, ?, ?)")
            .bind(&voucher_id)
            .bind(tag_id)
            .bind(&company_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("保存凭证标签失败: {error}"))?;
    }
    sqlx::query("UPDATE business_tags SET usage_count = (SELECT COUNT(*) FROM invoice_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM voucher_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM bank_transaction_tags WHERE tag_id = business_tags.id), updated_at = datetime('now') WHERE company_id = ?")
        .bind(&company_id).execute(&mut *transaction).await.map_err(|error| format!("更新标签使用次数失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交凭证标签事务失败: {error}"))?;
    Ok(distinct_ids)
}

#[tauri::command]
pub async fn get_bank_transaction_tag_ids(
    bank_transaction_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    sqlx::query_scalar("SELECT tag_id FROM bank_transaction_tags WHERE bank_transaction_id = ? AND company_id = ? ORDER BY tag_id")
        .bind(bank_transaction_id).bind(company_id).fetch_all(db.pool()).await.map_err(|error| format!("查询银行流水标签失败: {error}"))
}

#[tauri::command]
pub async fn replace_bank_transaction_tags(
    bank_transaction_id: String,
    company_id: String,
    tag_ids: Vec<String>,
    db: State<'_, Database>,
) -> Result<Vec<String>, String> {
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("开始流水标签事务失败: {error}"))?;
    let transaction_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM bank_transactions WHERE id = ? AND company_id = ?")
            .bind(&bank_transaction_id)
            .bind(&company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("校验银行流水失败: {error}"))?;
    if transaction_exists.is_none() {
        return Err("银行流水不存在或不属于当前账套".to_string());
    }
    let mut seen_ids = HashSet::new();
    let distinct_ids: Vec<String> = tag_ids
        .into_iter()
        .filter(|id| !id.trim().is_empty() && seen_ids.insert(id.clone()))
        .collect();
    for tag_id in &distinct_ids {
        let tag_exists: Option<(String,)> =
            sqlx::query_as("SELECT id FROM business_tags WHERE id = ? AND company_id = ?")
                .bind(tag_id)
                .bind(&company_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|error| format!("校验业务标签失败: {error}"))?;
        if tag_exists.is_none() {
            return Err("标签不存在或不属于当前账套".to_string());
        }
    }
    sqlx::query(
        "DELETE FROM bank_transaction_tags WHERE bank_transaction_id = ? AND company_id = ?",
    )
    .bind(&bank_transaction_id)
    .bind(&company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("清理银行流水标签失败: {error}"))?;
    for tag_id in &distinct_ids {
        sqlx::query("INSERT INTO bank_transaction_tags (bank_transaction_id, tag_id, company_id) VALUES (?, ?, ?)").bind(&bank_transaction_id).bind(tag_id).bind(&company_id).execute(&mut *transaction).await.map_err(|error| format!("保存银行流水标签失败: {error}"))?;
    }
    sqlx::query("UPDATE business_tags SET usage_count = (SELECT COUNT(*) FROM invoice_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM voucher_tags WHERE tag_id = business_tags.id) + (SELECT COUNT(*) FROM bank_transaction_tags WHERE tag_id = business_tags.id), updated_at = datetime('now') WHERE company_id = ?")
        .bind(&company_id).execute(&mut *transaction).await.map_err(|error| format!("更新标签使用次数失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交流水标签事务失败: {error}"))?;
    Ok(distinct_ids)
}

#[cfg(test)]
mod tests {
    use super::replace_invoice_tags_record;
    use crate::db::Database;

    #[tokio::test]
    async fn failed_invoice_tag_replacement_preserves_existing_assignments() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-business-tag-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");
        for statement in [
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '测试企业')",
            "INSERT INTO invoices (id, company_id, invoice_type, invoice_no, invoice_date) VALUES ('invoice-1', 'company-1', 'input', 'INV-001', '2026-06-01')",
            "INSERT INTO business_tags (id, company_id, name, applicable_modules, color_name, usage_count) VALUES ('tag-old', 'company-1', '原标签', '发票', '蓝色', 1)",
            "INSERT INTO business_tags (id, company_id, name, applicable_modules, color_name, usage_count) VALUES ('tag-new', 'company-1', '新标签', '发票', '绿色', 0)",
            "INSERT INTO invoice_tags (invoice_id, tag_id, company_id) VALUES ('invoice-1', 'tag-old', 'company-1')",
            "CREATE TRIGGER reject_new_invoice_tag BEFORE INSERT ON invoice_tags WHEN NEW.tag_id = 'tag-new' BEGIN SELECT RAISE(ABORT, 'forced tag failure'); END",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("prepares tag replacement test");
        }

        let result = replace_invoice_tags_record(
            "invoice-1".to_string(),
            "company-1".to_string(),
            vec!["tag-new".to_string()],
            database.pool(),
        )
        .await;
        assert!(result.is_err(), "forced replacement failure must surface");

        let assignments: Vec<String> = sqlx::query_scalar(
            "SELECT tag_id FROM invoice_tags WHERE invoice_id = 'invoice-1' ORDER BY tag_id",
        )
        .fetch_all(database.pool())
        .await
        .expect("reads preserved tag assignments");
        let usage: Vec<(String, i32)> = sqlx::query_as(
            "SELECT id, usage_count FROM business_tags WHERE company_id = 'company-1' ORDER BY id",
        )
        .fetch_all(database.pool())
        .await
        .expect("reads preserved usage counts");
        assert_eq!(assignments, vec!["tag-old".to_string()]);
        assert_eq!(
            usage,
            vec![("tag-new".to_string(), 0), ("tag-old".to_string(), 1)]
        );

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }
}
