use crate::db::DbPool;

fn closed_period_error(year: i32, month: i32, action: &str) -> String {
    format!(
        "账期 {year:04}-{month:02} 已结账，不能{}；请先按会计期间顺序反结账",
        action.trim()
    )
}

pub(crate) async fn ensure_period_label_open(
    pool: &DbPool,
    company_id: &str,
    period: &str,
    action: &str,
) -> Result<(), String> {
    let period = period.trim();
    let row: Option<(i32, i32, String)> = sqlx::query_as(
        r#"
        SELECT period_year, period_month, status
        FROM accounting_periods
        WHERE company_id = ?
          AND printf('%04d-%02d', period_year, period_month) = ?
        "#,
    )
    .bind(company_id)
    .bind(period)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("校验会计期间失败: {error}"))?;

    let Some((year, month, status)) = row else {
        return Err(format!(
            "账期 {period} 不存在或不属于当前账套，不能{}",
            action.trim()
        ));
    };
    if status != "open" {
        return Err(closed_period_error(year, month, action));
    }
    Ok(())
}

pub(crate) async fn ensure_period_id_open(
    pool: &DbPool,
    company_id: &str,
    period_id: &str,
    action: &str,
) -> Result<(), String> {
    let row: Option<(i32, i32, String)> = sqlx::query_as(
        r#"
        SELECT period_year, period_month, status
        FROM accounting_periods
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(period_id.trim())
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("校验会计期间失败: {error}"))?;

    let Some((year, month, status)) = row else {
        return Err(format!("账期不存在或不属于当前账套，不能{}", action.trim()));
    };
    if status != "open" {
        return Err(closed_period_error(year, month, action));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ensure_period_id_open, ensure_period_label_open};
    use crate::db::Database;

    #[tokio::test]
    async fn accounting_source_writes_require_an_open_existing_period() {
        let data_dir =
            std::env::temp_dir().join(format!("period-write-guard-test-{}", uuid::Uuid::new_v4()));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes period write guard database");
        for statement in [
            "INSERT INTO companies (id, code, name, accounting_system) VALUES ('c1', 'C1', '账期写入守卫测试', 'small_enterprise')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('open-period', 'c1', 2026, 5, '2026-05-01', '2026-05-31', 'open')",
            "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('closed-period', 'c1', 2026, 4, '2026-04-01', '2026-04-30', 'closed')",
        ] {
            sqlx::query(statement)
                .execute(database.pool())
                .await
                .expect("seeds accounting periods");
        }

        ensure_period_label_open(database.pool(), "c1", "2026-05", "新增银行流水")
            .await
            .expect("open period accepts source writes");
        ensure_period_id_open(database.pool(), "c1", "open-period", "新增发票")
            .await
            .expect("open period id accepts source writes");

        let closed_label_error =
            ensure_period_label_open(database.pool(), "c1", "2026-04", "修改工资表")
                .await
                .expect_err("closed period label must reject source writes");
        assert!(closed_label_error.contains("2026-04"));
        assert!(closed_label_error.contains("已结账"));
        assert!(closed_label_error.contains("修改工资表"));

        let closed_id_error =
            ensure_period_id_open(database.pool(), "c1", "closed-period", "删除发票")
                .await
                .expect_err("closed period id must reject source writes");
        assert!(closed_id_error.contains("2026-04"));
        assert!(closed_id_error.contains("删除发票"));

        let missing_error =
            ensure_period_label_open(database.pool(), "c1", "2027-01", "新增库存单据")
                .await
                .expect_err("unknown period must reject source writes");
        assert!(missing_error.contains("不存在"));

        let wrong_company_error = ensure_period_id_open(
            database.pool(),
            "another-company",
            "open-period",
            "新增发票",
        )
        .await
        .expect_err("period ownership must be enforced");
        assert!(wrong_company_error.contains("不存在"));

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes period write guard database");
    }
}
