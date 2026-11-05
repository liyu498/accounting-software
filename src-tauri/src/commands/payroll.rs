use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{CreatePayrollRecordInput, Database, PayrollRecord, UpdatePayrollRecordInput};
use tauri::State;

async fn payroll_by_id(id: &str, company_id: &str, db: &Database) -> Result<PayrollRecord, String> {
    sqlx::query_as(
        r#"
        SELECT p.*, e.name AS employee_name
        FROM payroll_records p
        INNER JOIN employees e ON e.id = p.employee_id AND e.company_id = p.company_id
        WHERE p.id = ? AND p.company_id = ?
        "#,
    )
    .bind(id)
    .bind(company_id)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("查询薪酬记录失败: {error}"))
}

#[tauri::command]
pub async fn get_payroll_records(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<PayrollRecord>, String> {
    sqlx::query_as(
        r#"
        SELECT p.*, e.name AS employee_name
        FROM payroll_records p
        INNER JOIN employees e ON e.id = p.employee_id AND e.company_id = p.company_id
        WHERE p.company_id = ? AND p.period = ?
        ORDER BY e.employee_code
        "#,
    )
    .bind(&company_id)
    .bind(&period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询薪酬表失败: {error}"))
}

#[tauri::command]
pub async fn create_payroll_record(
    input: CreatePayrollRecordInput,
    db: State<'_, Database>,
) -> Result<PayrollRecord, String> {
    if input.period.trim().is_empty() || input.base_salary < 0.0 {
        return Err("所属期不能为空且基本工资不能为负数".to_string());
    }
    let bonus = input.bonus.unwrap_or(0.0);
    let tax_amount = input.tax_amount.unwrap_or(0.0);
    let social_personal = input.social_personal.unwrap_or(0.0);
    if bonus < 0.0 || tax_amount < 0.0 || social_personal < 0.0 {
        return Err("薪酬金额不能为负数".to_string());
    }
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增工资表").await?;
    let employee_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM employees WHERE id = ? AND company_id = ?")
            .bind(&input.employee_id)
            .bind(&input.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询人员档案失败: {error}"))?;
    if employee_exists.is_none() {
        return Err("人员不属于当前账套".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let net_salary = input.base_salary + bonus - tax_amount - social_personal;
    sqlx::query(
        r#"
        INSERT INTO payroll_records (
            id, company_id, employee_id, period, base_salary, bonus, tax_amount, social_personal, net_salary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.employee_id)
    .bind(input.period.trim())
    .bind(input.base_salary)
    .bind(bonus)
    .bind(tax_amount)
    .bind(social_personal)
    .bind(net_salary)
    .execute(db.pool())
    .await
    .map_err(|error| format!("新增薪酬行失败: {error}"))?;

    payroll_by_id(&id, &input.company_id, &db).await
}

#[tauri::command]
pub async fn update_payroll_record(
    input: UpdatePayrollRecordInput,
    db: State<'_, Database>,
) -> Result<PayrollRecord, String> {
    if input.id.trim().is_empty() || input.period.trim().is_empty() || input.base_salary < 0.0 {
        return Err("薪酬行、所属期不能为空且基本工资不能为负数".to_string());
    }
    let bonus = input.bonus.unwrap_or(0.0);
    let tax_amount = input.tax_amount.unwrap_or(0.0);
    let social_personal = input.social_personal.unwrap_or(0.0);
    if bonus < 0.0 || tax_amount < 0.0 || social_personal < 0.0 {
        return Err("薪酬金额不能为负数".to_string());
    }

    let status: Option<(String, Option<String>, String)> = sqlx::query_as(
        "SELECT status, voucher_id, period FROM payroll_records WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询薪酬行失败: {error}"))?;
    match status {
        Some((value, voucher_id, _)) if value == "已生成凭证" || voucher_id.is_some() => {
            return Err("该薪酬行已生成凭证，不可直接修改".to_string());
        }
        Some((_, _, current_period)) => {
            ensure_period_label_open(db.pool(), &input.company_id, &current_period, "修改工资表")
                .await?;
            if current_period != input.period.trim() {
                ensure_period_label_open(
                    db.pool(),
                    &input.company_id,
                    &input.period,
                    "调整工资表所属期",
                )
                .await?;
            }
        }
        None => return Err("未找到当前账套薪酬行".to_string()),
    }

    let employee_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM employees WHERE id = ? AND company_id = ?")
            .bind(&input.employee_id)
            .bind(&input.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询人员档案失败: {error}"))?;
    if employee_exists.is_none() {
        return Err("人员不属于当前账套".to_string());
    }

    let net_salary = input.base_salary + bonus - tax_amount - social_personal;
    sqlx::query(
        r#"
        UPDATE payroll_records
        SET employee_id = ?, period = ?, base_salary = ?, bonus = ?, tax_amount = ?,
            social_personal = ?, net_salary = ?, updated_at = datetime('now')
        WHERE id = ? AND company_id = ? AND voucher_id IS NULL AND status != '已生成凭证'
        "#,
    )
    .bind(&input.employee_id)
    .bind(input.period.trim())
    .bind(input.base_salary)
    .bind(bonus)
    .bind(tax_amount)
    .bind(social_personal)
    .bind(net_salary)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|error| format!("更新薪酬行失败: {error}"))?;

    payroll_by_id(&input.id, &input.company_id, &db).await
}
