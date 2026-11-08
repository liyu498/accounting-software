use crate::db::{
    CreateSpecialDeductionRecordInput, Database, DbPool, SpecialDeductionRecord,
    UpdateSpecialDeductionRecordInput,
};
use tauri::State;

const SPECIAL_DEDUCTION_SELECT: &str = r#"
    SELECT d.*, e.name AS employee_name
    FROM special_deduction_records d
    INNER JOIN employees e ON e.id = d.employee_id AND e.company_id = d.company_id
    WHERE d.company_id = ?
      AND d.start_month <= ?
      AND (d.end_month IS NULL OR d.end_month = '' OR d.end_month >= ?)
    ORDER BY e.employee_code, d.deduction_type
    "#;

async fn list_special_deduction_records(
    pool: &DbPool,
    company_id: &str,
    period: &str,
) -> Result<Vec<SpecialDeductionRecord>, sqlx::Error> {
    sqlx::query_as(SPECIAL_DEDUCTION_SELECT)
        .bind(company_id)
        .bind(period)
        .bind(period)
        .fetch_all(pool)
        .await
}

#[tauri::command]
pub async fn get_special_deduction_records(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<SpecialDeductionRecord>, String> {
    list_special_deduction_records(db.pool(), &company_id, &period)
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
#[tauri::command]
pub async fn update_special_deduction_record(
    input: UpdateSpecialDeductionRecordInput,
    db: State<'_, Database>,
) -> Result<SpecialDeductionRecord, String> {
    if input.id.trim().is_empty()
        || input.deduction_type.trim().is_empty()
        || input.start_month.trim().is_empty()
        || input.monthly_amount < 0.0
    {
        return Err("扣除类型、起始月份不能为空且月扣除额不能为负数".into());
    }
    if input
        .end_month
        .as_deref()
        .is_some_and(|end| !end.trim().is_empty() && end.trim() < input.start_month.trim())
    {
        return Err("结束月份不能早于起始月份".into());
    }
    let affected=sqlx::query("UPDATE special_deduction_records SET deduction_type=?,start_month=?,end_month=?,monthly_amount=?,source=?,updated_at=datetime('now') WHERE id=? AND company_id=?").bind(input.deduction_type.trim()).bind(input.start_month.trim()).bind(input.end_month.as_deref().map(str::trim).filter(|v|!v.is_empty())).bind(input.monthly_amount).bind(input.source.as_deref().unwrap_or("手工")).bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|e|format!("更新专项附加扣除失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套专项扣除资料".into());
    }
    sqlx::query_as("SELECT d.*,e.name AS employee_name FROM special_deduction_records d INNER JOIN employees e ON e.id=d.employee_id WHERE d.id=? AND d.company_id=?").bind(&input.id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|e|format!("查询更新专项扣除失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::list_special_deduction_records;
    use crate::db::Database;

    #[tokio::test]
    async fn lists_only_deductions_active_for_requested_period() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-special-deduction-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");

        sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
            .bind("company-1")
            .bind("test-company")
            .bind("测试企业")
            .execute(database.pool())
            .await
            .expect("creates company");
        sqlx::query(
            "INSERT INTO employees (id, company_id, employee_code, name) VALUES (?, ?, ?, ?)",
        )
        .bind("employee-1")
        .bind("company-1")
        .bind("0001")
        .bind("张三")
        .execute(database.pool())
        .await
        .expect("creates employee");

        for (id, deduction_type, start_month, end_month) in [
            ("active", "A-有效", "2026-01", None),
            ("expired", "B-已结束", "2026-01", Some("2026-05")),
            ("future", "C-未开始", "2026-07", None),
        ] {
            sqlx::query(
                "INSERT INTO special_deduction_records (id, company_id, employee_id, deduction_type, start_month, end_month, monthly_amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(id)
            .bind("company-1")
            .bind("employee-1")
            .bind(deduction_type)
            .bind(start_month)
            .bind(end_month)
            .bind(100.0)
            .execute(database.pool())
            .await
            .expect("creates deduction record");
        }

        let records = list_special_deduction_records(database.pool(), "company-1", "2026-06")
            .await
            .expect("queries active deductions");

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "active");
        assert_eq!(records[0].employee_name, "张三");

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(&data_dir, "removes test data directory");
    }
}
