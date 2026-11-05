use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{
    CreateSocialSecurityRecordInput, Database, SocialSecurityRecord,
    UpdateSocialSecurityRecordInput,
};
use tauri::State;

#[tauri::command]
pub async fn get_social_security_records(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<SocialSecurityRecord>, String> {
    sqlx::query_as("SELECT s.*, e.name AS employee_name FROM social_security_records s INNER JOIN employees e ON e.id = s.employee_id AND e.company_id = s.company_id WHERE s.company_id = ? AND s.period = ? ORDER BY e.employee_code")
        .bind(company_id).bind(period).fetch_all(db.pool()).await.map_err(|error| format!("查询社保明细失败: {error}"))
}

#[tauri::command]
pub async fn create_social_security_record(
    input: CreateSocialSecurityRecordInput,
    db: State<'_, Database>,
) -> Result<SocialSecurityRecord, String> {
    if input.period.trim().is_empty()
        || [
            input.contribution_base,
            input.company_amount,
            input.personal_amount,
            input.fund_amount,
        ]
        .iter()
        .any(|value| *value < 0.0)
    {
        return Err("所属期不能为空且社保金额不能为负数".to_string());
    }
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增社保明细").await?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO social_security_records (id, company_id, employee_id, period, city, contribution_base, company_amount, personal_amount, fund_amount) SELECT ?, ?, e.id, ?, ?, ?, ?, ?, ? FROM employees e WHERE e.id = ? AND e.company_id = ?")
        .bind(&id).bind(&input.company_id).bind(input.period.trim()).bind(&input.city).bind(input.contribution_base).bind(input.company_amount).bind(input.personal_amount).bind(input.fund_amount).bind(&input.employee_id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("新增社保明细失败: {error}"))?;
    sqlx::query_as("SELECT s.*, e.name AS employee_name FROM social_security_records s INNER JOIN employees e ON e.id = s.employee_id WHERE s.id = ? AND s.company_id = ?")
        .bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询新增社保明细失败: {error}"))
}
#[tauri::command]
pub async fn update_social_security_record(
    input: UpdateSocialSecurityRecordInput,
    db: State<'_, Database>,
) -> Result<SocialSecurityRecord, String> {
    if input.id.trim().is_empty()
        || [
            input.contribution_base,
            input.company_amount,
            input.personal_amount,
            input.fund_amount,
        ]
        .iter()
        .any(|value| *value < 0.0)
    {
        return Err("社保金额不能为负数".into());
    }
    let linked: Option<(String, Option<String>, String)> = sqlx::query_as(
        "SELECT status, voucher_id, period FROM social_security_records WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("查询社保明细状态失败: {e}"))?;
    match linked {
        Some((status, voucher_id, _)) if status == "已生成凭证" || voucher_id.is_some() => {
            return Err("该社保明细已关联凭证，不能修改".into());
        }
        None => return Err("未找到当前账套社保明细".into()),
        Some((_, _, period)) => {
            ensure_period_label_open(db.pool(), &input.company_id, &period, "修改社保明细").await?;
        }
    }
    let affected=sqlx::query("UPDATE social_security_records SET city=?,contribution_base=?,company_amount=?,personal_amount=?,fund_amount=?,updated_at=datetime('now') WHERE id=? AND company_id=? AND voucher_id IS NULL AND status != '已生成凭证'").bind(input.city).bind(input.contribution_base).bind(input.company_amount).bind(input.personal_amount).bind(input.fund_amount).bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|e|format!("更新社保明细失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套社保明细".into());
    }
    sqlx::query_as("SELECT s.*,e.name AS employee_name FROM social_security_records s INNER JOIN employees e ON e.id=s.employee_id WHERE s.id=? AND s.company_id=?").bind(&input.id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|e|format!("查询更新社保明细失败: {e}"))
}
