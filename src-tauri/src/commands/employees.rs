use crate::db::{CreateEmployeeInput, Database, Employee, UpdateEmployeeInput};
use tauri::State;

#[tauri::command]
pub async fn get_employees(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Employee>, String> {
    sqlx::query_as(
        "SELECT * FROM employees WHERE company_id = ? ORDER BY employment_status, employee_code",
    )
    .bind(&company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询人员档案失败: {error}"))
}

#[tauri::command]
pub async fn create_employee(
    input: CreateEmployeeInput,
    db: State<'_, Database>,
) -> Result<Employee, String> {
    if input.employee_code.trim().is_empty() || input.name.trim().is_empty() {
        return Err("人员编码和姓名不能为空".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO employees (
            id, company_id, employee_code, name, id_no, department, position, mobile,
            entry_date, employment_status, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.employee_code.trim())
    .bind(input.name.trim())
    .bind(&input.id_no)
    .bind(&input.department)
    .bind(&input.position)
    .bind(&input.mobile)
    .bind(&input.entry_date)
    .bind(input.employment_status.as_deref().unwrap_or("在职"))
    .execute(db.pool())
    .await
    .map_err(|error| format!("新增人员失败: {error}"))?;

    sqlx::query_as("SELECT * FROM employees WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增人员失败: {error}"))
}

#[tauri::command]
pub async fn update_employee(
    input: UpdateEmployeeInput,
    db: State<'_, Database>,
) -> Result<Employee, String> {
    if input.employee_code.trim().is_empty() || input.name.trim().is_empty() {
        return Err("人员编码和姓名不能为空".to_string());
    }

    let affected = sqlx::query(
        r#"
        UPDATE employees
        SET employee_code = ?, name = ?, id_no = ?, department = ?, position = ?, mobile = ?,
            entry_date = ?, employment_status = ?, updated_at = datetime('now')
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(input.employee_code.trim())
    .bind(input.name.trim())
    .bind(&input.id_no)
    .bind(&input.department)
    .bind(&input.position)
    .bind(&input.mobile)
    .bind(&input.entry_date)
    .bind(input.employment_status.as_deref().unwrap_or("在职"))
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(db.pool())
    .await
    .map_err(|error| format!("更新人员失败: {error}"))?;

    if affected.rows_affected() == 0 {
        return Err("未找到当前账套人员档案".to_string());
    }

    sqlx::query_as("SELECT * FROM employees WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询更新人员失败: {error}"))
}
