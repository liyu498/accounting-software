use crate::commands::auth::authenticated_actor;
use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CompanyTodo {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub period: Option<String>,
    pub title: String,
    pub source_module: String,
    pub priority: String,
    pub owner: Option<String>,
    pub due_date: Option<String>,
    pub related_entry: Option<String>,
    pub evidence: Option<String>,
    pub note: Option<String>,
    pub status: String,
    pub completed_at: Option<String>,
    pub completed_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCompanyTodoInput {
    pub company_id: String,
    pub period: Option<String>,
    pub title: String,
    pub source_module: String,
    pub priority: Option<String>,
    pub owner: Option<String>,
    pub due_date: Option<String>,
    pub related_entry: Option<String>,
    pub evidence: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteCompanyTodoInput {
    pub id: String,
    pub company_id: String,
    pub note: Option<String>,
}

const TODO_SELECT: &str = r#"
    SELECT t.id, t.company_id, c.name AS company_name, t.period, t.title, t.source_module,
           t.priority, t.owner, t.due_date, t.related_entry, t.evidence, t.note, t.status,
           t.completed_at, t.completed_by, t.created_at, t.updated_at
    FROM company_todos t
    LEFT JOIN companies c ON c.id = t.company_id
"#;

#[tauri::command]
pub async fn get_company_todos(
    company_id: String,
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<CompanyTodo>, String> {
    if company_id.trim().is_empty() {
        return Err("客户账套不能为空".to_string());
    }
    let query = format!("{} WHERE t.company_id = ? AND (? IS NULL OR t.period = ?) AND (? IS NULL OR t.status = ?) ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'review' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END, COALESCE(t.due_date, '9999-12-31'), t.updated_at DESC", TODO_SELECT);
    sqlx::query_as(&query)
        .bind(company_id.trim())
        .bind(&period)
        .bind(&period)
        .bind(&status)
        .bind(&status)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询账套待办失败: {error}"))
}

#[tauri::command]
pub async fn create_company_todo(
    input: CreateCompanyTodoInput,
    db: State<'_, Database>,
) -> Result<CompanyTodo, String> {
    if input.company_id.trim().is_empty()
        || input.title.trim().is_empty()
        || input.source_module.trim().is_empty()
    {
        return Err("客户账套、待办标题和来源模块不能为空".to_string());
    }
    let priority = input.priority.unwrap_or_else(|| "normal".to_string());
    if !["normal", "high", "blocking"].contains(&priority.as_str()) {
        return Err("待办优先级不合法".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO company_todos (id, company_id, period, title, source_module, priority, owner, due_date, related_entry, evidence, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(input.company_id.trim())
        .bind(input.period)
        .bind(input.title.trim())
        .bind(input.source_module.trim())
        .bind(priority)
        .bind(input.owner)
        .bind(input.due_date)
        .bind(input.related_entry)
        .bind(input.evidence)
        .bind(input.note)
        .execute(db.pool())
        .await
        .map_err(|error| format!("新增账套待办失败: {error}"))?;

    sqlx::query_as(&format!("{} WHERE t.id = ?", TODO_SELECT))
        .bind(id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增账套待办失败: {error}"))
}

#[tauri::command]
pub async fn complete_company_todo(
    input: CompleteCompanyTodoInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<CompanyTodo, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    if input.id.trim().is_empty() || input.company_id.trim().is_empty() {
        return Err("待办和客户账套不能为空".to_string());
    }
    let affected = sqlx::query("UPDATE company_todos SET status='completed', completed_at=datetime('now'), completed_by=?, note=COALESCE(?, note), updated_at=datetime('now') WHERE id=? AND company_id=?")
        .bind(actor)
        .bind(input.note)
        .bind(input.id.trim())
        .bind(input.company_id.trim())
        .execute(db.pool())
        .await
        .map_err(|error| format!("完成账套待办失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套待办".to_string());
    }
    sqlx::query_as(&format!(
        "{} WHERE t.id = ? AND t.company_id = ?",
        TODO_SELECT
    ))
    .bind(input.id.trim())
    .bind(input.company_id.trim())
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("查询完成后的账套待办失败: {error}"))
}
