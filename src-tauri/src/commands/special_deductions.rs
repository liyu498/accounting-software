use crate::db::{CreateSpecialDeductionRecordInput, Database, SpecialDeductionRecord};
use tauri::State;

#[tauri::command]
pub async fn get_special_deduction_records(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<SpecialDeductionRecord>, String> {
    sqlx::query_as(
        r#"
        SELECT d.*, e.name AS employee_name
        FROM special_deduction_records d
        INNER JOIN employees e ON e.id = d.employee_id AND e.company_id = d.company_id
        WHERE d.company_id = ?
          AND d.start_month <= ?
          AND (d.end_month IS NULL OR d.end_month = '' OR d.end_month >= ?)
        ORDER BY e.employee_code, d.deduction_type
        "#,
    )
    .bind(company_id)
    .bind(&period)
    .bind(period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询专项附加扣除失败: {error}"))
}

#[tauri::command]
pub async fn create_special_deduction_record(
    input: CreateSpecialDeductionRecordInput,
    db: State<'_, Database>,
) -> Result<SpecialDeductionRecord, String> {
    if input.deduction_type.trim().is_empty()
        || input.start_month.trim().is_empty()
        || input.monthly_amount < 0.0
    {
        return Err("扣除类型、起始月份不能为空且月扣除额不能为负数".to_string());
    }
    if let Some(end_month) = input.end_month.as_deref() {
        if !end_month.trim().is_empty() && end_month.trim() < input.start_month.trim() {
            return Err("结束月份不能早于起始月份".to_string());
        }
    }

    let employee_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM employees WHERE id = ? AND company_id = ?",
    )
    .bind(&input.employee_id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询人员档案失败: {error}"))?;
    if employee_exists.is_none() {
        return Err("人员不属于当前账套".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let end_month = input
        .end_month
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let source = input.source.as_deref().unwrap_or("手工").trim();
    sqlx::query(
        r#"
        INSERT INTO special_deduction_records (
            id, company_id, employee_id, deduction_type, start_month, end_month, monthly_amount, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.employee_id)
    .bind(input.deduction_type.trim())
    .bind(input.start_month.trim())
    .bind(end_month)
    .bind(input.monthly_amount)
    .bind(source)
    .execute(db.pool())
    .await
    .map_err(|error| format!("新增专项附加扣除失败: {error}"))?;

    sqlx::query_as(
        r#"
        SELECT d.*, e.name AS employee_name
        FROM special_deduction_records d
        INNER JOIN employees e ON e.id = d.employee_id AND e.company_id = d.company_id
        WHERE d.id = ? AND d.company_id = ?
        "#,
    )
    .bind(id)
    .bind(&input.company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("查询新增专项附加扣除失败: {error}"))
}
