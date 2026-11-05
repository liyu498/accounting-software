use crate::commands::auth::authenticated_actor;
use crate::db::{
    Database, InventoryOpeningBalance, InventoryOpeningReconciliation,
    SaveInventoryOpeningBalanceInput,
};
use sqlx::{Sqlite, Transaction};
use std::collections::{BTreeMap, BTreeSet};
use tauri::State;

const MONEY_EPSILON: f64 = 0.01;

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn round_unit_cost(value: f64) -> f64 {
    (value * 1_000_000.0).round() / 1_000_000.0
}

fn subject_code(subject: &str) -> Result<&str, String> {
    let code = subject
        .split_whitespace()
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "存货科目必须以末级科目编码开头，例如“1403 原材料”".to_string())?;
    if !code
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_'))
    {
        return Err("存货科目必须以有效的末级科目编码开头".into());
    }
    Ok(code)
}

async fn period_scope(
    company_id: &str,
    period_id: &str,
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<(String, Option<String>, Option<String>, String, String), String> {
    sqlx::query_as(
        r#"SELECT status, initial_balances_finalized_at,
                  inventory_opening_finalized_at,
                  printf('%04d-%02d', period_year, period_month), start_date
           FROM accounting_periods
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("查询会计期间失败: {error}"))?
    .ok_or_else(|| "会计期间不存在或不属于当前账套".to_string())
}

async fn ensure_opening_editable(
    company_id: &str,
    period_id: &str,
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<String, String> {
    let (status, _, finalized_at, period, _) =
        period_scope(company_id, period_id, transaction).await?;
    if status != "open" {
        return Err("已结账期间不能维护期初库存".into());
    }
    if finalized_at.is_some() {
        return Err("期初库存已确认锁定，不能继续修改".into());
    }
    let confirmed_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM inventory_movements WHERE company_id = ? AND period = ? AND status IN ('已核验', '已生成凭证')",
    )
    .bind(company_id)
    .bind(&period)
    .fetch_one(&mut **transaction)
    .await
    .map_err(|error| format!("检查本期出入库状态失败: {error}"))?;
    if confirmed_count > 0 {
        return Err("本期已有核验后的出入库记录，不能再补录期初库存".into());
    }
    Ok(period)
}

#[tauri::command]
pub async fn get_inventory_opening_balances(
    company_id: String,
    period_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryOpeningBalance>, String> {
    sqlx::query_as(
        "SELECT * FROM inventory_opening_balances WHERE company_id = ? AND period_id = ? ORDER BY item_code, warehouse_name",
    )
    .bind(company_id)
    .bind(period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询期初库存失败: {error}"))
}

#[tauri::command]
pub async fn get_inventory_opening_reconciliation(
    company_id: String,
    period_id: String,
    db: State<'_, Database>,
) -> Result<InventoryOpeningReconciliation, String> {
    inventory_opening_reconciliation(&company_id, &period_id, db.inner()).await
}

async fn inventory_opening_reconciliation(
    company_id: &str,
    period_id: &str,
    db: &Database,
) -> Result<InventoryOpeningReconciliation, String> {
    let period: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT initial_balances_finalized_at, inventory_opening_finalized_at FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询会计期间失败: {error}"))?;
    let Some((financial_finalized_at, inventory_finalized_at)) = period else {
        return Err("会计期间不存在或不属于当前账套".into());
    };

    let detail_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT inventory_subject, SUM(amount) FROM inventory_opening_balances WHERE company_id = ? AND period_id = ? GROUP BY inventory_subject",
    )
    .bind(company_id)
    .bind(period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("汇总期初库存失败: {error}"))?;
    let item_subjects: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT inventory_subject FROM inventory_items WHERE company_id = ? AND status = '启用'",
    )
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询存货核算科目失败: {error}"))?;
    let ledger_rows: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT account_code, opening_debit, opening_credit FROM initial_balances WHERE period_id = ?",
    )
    .bind(period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询财务期初余额失败: {error}"))?;

    let mut codes = BTreeSet::new();
    let mut detail_by_code: BTreeMap<String, f64> = BTreeMap::new();
    for subject in item_subjects {
        codes.insert(subject_code(&subject)?.to_string());
    }
    for (subject, amount) in detail_rows {
        let code = subject_code(&subject)?.to_string();
        codes.insert(code.clone());
        *detail_by_code.entry(code).or_default() += amount;
    }
    let ledger_by_code: BTreeMap<String, f64> = ledger_rows
        .into_iter()
        .map(|(code, debit, credit)| (code, round_money(debit - credit)))
        .collect();

    let detail_amount = round_money(detail_by_code.values().sum());
    let ledger_amount = round_money(
        codes
            .iter()
            .map(|code| ledger_by_code.get(code).copied().unwrap_or(0.0))
            .sum(),
    );
    let mismatched_codes: Vec<String> = codes
        .iter()
        .filter(|code| {
            let detail = detail_by_code.get(*code).copied().unwrap_or(0.0);
            let ledger = ledger_by_code.get(*code).copied().unwrap_or(0.0);
            (detail - ledger).abs() >= MONEY_EPSILON
        })
        .cloned()
        .collect();
    let difference_amount = round_money(detail_amount - ledger_amount);
    let is_reconciled = mismatched_codes.is_empty();
    let financial_opening_finalized = financial_finalized_at.is_some();
    let inventory_opening_finalized = inventory_finalized_at.is_some();
    let message = if inventory_opening_finalized {
        "期初库存已确认锁定".to_string()
    } else if !financial_opening_finalized {
        "请先在期初余额模块完成试算平衡并确认建账".to_string()
    } else if is_reconciled {
        "存货明细金额与财务期初余额一致，可以确认锁定".to_string()
    } else {
        format!(
            "以下存货科目与财务期初余额不一致: {}",
            mismatched_codes.join("、")
        )
    };

    Ok(InventoryOpeningReconciliation {
        detail_amount,
        ledger_amount,
        difference_amount,
        is_reconciled,
        financial_opening_finalized,
        inventory_opening_finalized,
        message,
    })
}

#[tauri::command]
pub async fn save_inventory_opening_balance(
    input: SaveInventoryOpeningBalanceInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryOpeningBalance, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    save_inventory_opening_balance_record(input, &actor, db.inner()).await
}

async fn save_inventory_opening_balance_record(
    input: SaveInventoryOpeningBalanceInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryOpeningBalance, String> {
    if !input.quantity.is_finite() || input.quantity <= 0.0 {
        return Err("期初数量必须大于零".into());
    }
    if !input.amount.is_finite() || input.amount <= 0.0 {
        return Err("期初金额必须大于零".into());
    }
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动期初库存事务失败: {error}"))?;
    let period =
        ensure_opening_editable(&input.company_id, &input.period_id, &mut transaction).await?;
    let item: (String, String, String, String, String) = sqlx::query_as(
        "SELECT item_code, item_name, unit, inventory_subject, status FROM inventory_items WHERE id = ? AND company_id = ?",
    )
    .bind(&input.inventory_item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询存货档案失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的存货档案".to_string())?;
    if item.4 != "启用" {
        return Err("停用的存货不能登记期初库存".into());
    }
    let warehouse: (String, String) = sqlx::query_as(
        "SELECT warehouse_name, status FROM inventory_warehouses WHERE id = ? AND company_id = ?",
    )
    .bind(&input.warehouse_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询仓库档案失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的仓库档案".to_string())?;
    if warehouse.1 != "启用" {
        return Err("停用的仓库不能登记期初库存".into());
    }
    let code = subject_code(&item.3)?;
    let is_detail: Option<i64> = sqlx::query_scalar(
        "SELECT is_detail FROM account_codes WHERE company_id = ? AND code = ? AND is_enabled = 1",
    )
    .bind(&input.company_id)
    .bind(code)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("检查存货科目失败: {error}"))?;
    if is_detail != Some(1) {
        return Err("存货档案的存货科目必须对应当前账套的已启用末级科目".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO inventory_opening_balances
           (id, company_id, period_id, period, inventory_item_id, warehouse_id,
            item_code, item_name, warehouse_name, unit, inventory_subject,
            quantity, amount, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(company_id, period_id, inventory_item_id, warehouse_id) DO UPDATE SET
             item_code = excluded.item_code,
             item_name = excluded.item_name,
             warehouse_name = excluded.warehouse_name,
             unit = excluded.unit,
             inventory_subject = excluded.inventory_subject,
             quantity = excluded.quantity,
             amount = excluded.amount,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&period)
    .bind(&input.inventory_item_id)
    .bind(&input.warehouse_id)
    .bind(&item.0)
    .bind(&item.1)
    .bind(&warehouse.0)
    .bind(&item.2)
    .bind(&item.3)
    .bind(input.quantity)
    .bind(round_money(input.amount))
    .bind(actor)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存期初库存失败: {error}"))?;

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '期初库存', '保存期初库存', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(format!("{} / {}", item.0, warehouse.0))
    .bind(format!(
        "期间 {period}，数量 {} {}，金额 {:.2}",
        input.quantity,
        item.2,
        round_money(input.amount)
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入期初库存审计日志失败: {error}"))?;

    let record = sqlx::query_as(
        "SELECT * FROM inventory_opening_balances WHERE company_id = ? AND period_id = ? AND inventory_item_id = ? AND warehouse_id = ?",
    )
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&input.inventory_item_id)
    .bind(&input.warehouse_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取期初库存失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交期初库存失败: {error}"))?;
    Ok(record)
}

#[tauri::command]
pub async fn delete_inventory_opening_balance(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动删除期初库存事务失败: {error}"))?;
    let record: Option<(String, String, String)> = sqlx::query_as(
        "SELECT period_id, item_code, warehouse_name FROM inventory_opening_balances WHERE id = ? AND company_id = ? AND status = '草稿'",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询期初库存失败: {error}"))?;
    let Some((period_id, item_code, warehouse_name)) = record else {
        return Err("期初库存不存在、已确认或不属于当前账套".into());
    };
    ensure_opening_editable(&company_id, &period_id, &mut transaction).await?;
    sqlx::query("DELETE FROM inventory_opening_balances WHERE id = ? AND company_id = ?")
        .bind(&id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("删除期初库存失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '期初库存', '删除期初库存', ?, 'medium', 'success', '删除未确认的期初库存明细', ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&company_id)
    .bind(format!("{item_code} / {warehouse_name}"))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入期初库存审计日志失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交删除期初库存失败: {error}"))
}

#[tauri::command]
pub async fn finalize_inventory_opening_balances(
    company_id: String,
    period_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    finalize_inventory_opening_balances_record(&company_id, &period_id, &actor, db.inner()).await
}

async fn finalize_inventory_opening_balances_record(
    company_id: &str,
    period_id: &str,
    actor: &str,
    db: &Database,
) -> Result<(), String> {
    let reconciliation = inventory_opening_reconciliation(company_id, period_id, db).await?;
    if !reconciliation.financial_opening_finalized {
        return Err("请先完成财务期初余额试算平衡并确认建账".into());
    }
    if reconciliation.inventory_opening_finalized {
        return Err("期初库存已确认，不能重复确认".into());
    }
    if !reconciliation.is_reconciled {
        return Err(format!(
            "期初库存金额与财务期初余额不一致，差异 {:.2}",
            reconciliation.difference_amount
        ));
    }

    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动确认期初库存事务失败: {error}"))?;
    let (status, financial_finalized_at, inventory_finalized_at, period, start_date) =
        period_scope(company_id, period_id, &mut transaction).await?;
    if status != "open" {
        return Err("已结账期间不能确认期初库存".into());
    }
    if financial_finalized_at.is_none() {
        return Err("请先确认财务期初余额".into());
    }
    if inventory_finalized_at.is_some() {
        return Err("期初库存已确认，不能重复确认".into());
    }
    let confirmed_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM inventory_movements WHERE company_id = ? AND period = ? AND status IN ('已核验', '已生成凭证')",
    )
    .bind(company_id)
    .bind(&period)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("检查本期出入库状态失败: {error}"))?;
    if confirmed_count > 0 {
        return Err("本期已有核验后的出入库记录，必须先撤销业务记录再确认期初库存".into());
    }

    let rows: Vec<InventoryOpeningBalance> = sqlx::query_as(
        "SELECT * FROM inventory_opening_balances WHERE company_id = ? AND period_id = ? AND status = '草稿' ORDER BY item_code, warehouse_name",
    )
    .bind(company_id)
    .bind(period_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("查询待确认期初库存失败: {error}"))?;
    for row in &rows {
        let movement_id = uuid::Uuid::new_v4().to_string();
        let bill_no = format!("OPEN-{}-{}", period.replace('-', ""), row.id);
        sqlx::query(
            r#"INSERT INTO inventory_movements
               (id, company_id, period, movement_date, bill_no, movement_type,
                inventory_name, warehouse, unit, quantity, amount,
                inventory_item_id, warehouse_id, direction, unit_cost,
                confirmed_at, source_document, status)
               VALUES (?, ?, ?, ?, ?, '期初入库', ?, ?, ?, ?, ?, ?, ?, 'inbound', ?, datetime('now'), '期初库存', '已核验')"#,
        )
        .bind(&movement_id)
        .bind(company_id)
        .bind(&period)
        .bind(&start_date)
        .bind(&bill_no)
        .bind(&row.item_name)
        .bind(&row.warehouse_name)
        .bind(&row.unit)
        .bind(row.quantity)
        .bind(row.amount)
        .bind(&row.inventory_item_id)
        .bind(&row.warehouse_id)
        .bind(round_unit_cost(round_money(row.amount) / row.quantity))
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("生成期初库存核验记录失败: {error}"))?;
        sqlx::query(
            "UPDATE inventory_opening_balances SET status = '已确认', movement_id = ?, confirmed_at = datetime('now'), confirmed_by = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status = '草稿'",
        )
        .bind(&movement_id)
        .bind(actor)
        .bind(actor)
        .bind(&row.id)
        .bind(company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("锁定期初库存明细失败: {error}"))?;
    }
    sqlx::query(
        "UPDATE accounting_periods SET inventory_opening_finalized_at = datetime('now'), inventory_opening_finalized_by = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?",
    )
    .bind(actor)
    .bind(period_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("锁定期初库存失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '期初库存', '确认期初库存', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(&period)
    .bind(format!(
        "确认并锁定 {} 条期初库存，金额 {:.2}，同步生成期初入库核验记录",
        rows.len(),
        reconciliation.detail_amount
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入期初库存审计日志失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交确认期初库存失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::path::PathBuf;

    fn test_data_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "accounting-inventory-opening-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[tokio::test]
    async fn opening_inventory_requires_financial_reconciliation_before_locking() {
        let data_dir = test_data_dir();
        let db = Database::new(data_dir.clone())
            .await
            .expect("create database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '期初库存账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        sqlx::query("INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('period-1', 'company-1', 2026, 1, '2026-01-01', '2026-01-31', 'open')")
            .execute(db.pool()).await.expect("insert period");
        sqlx::query("INSERT INTO inventory_categories (id, company_id, category_code, category_name, inventory_subject, cost_subject) VALUES ('category-1', 'company-1', 'RM', '原材料', '1403 原材料', '6401 主营业务成本')")
            .execute(db.pool()).await.expect("insert category");
        sqlx::query("INSERT INTO inventory_items (id, company_id, item_code, item_name, unit, category_id, category, inventory_subject, cost_subject) VALUES ('item-1', 'company-1', 'RM001', '钢材', '吨', 'category-1', '原材料', '1403 原材料', '6401 主营业务成本')")
            .execute(db.pool()).await.expect("insert item");
        sqlx::query("INSERT INTO inventory_warehouses (id, company_id, warehouse_code, warehouse_name) VALUES ('warehouse-1', 'company-1', 'WH01', '主仓')")
            .execute(db.pool()).await.expect("insert warehouse");
        sqlx::query("INSERT INTO account_codes (code, company_id, name, account_type, normal_balance, level, is_detail) VALUES ('1403', 'company-1', '原材料', 'asset', 'debit', 1, 1)")
            .execute(db.pool()).await.expect("insert account");

        let record = save_inventory_opening_balance_record(
            SaveInventoryOpeningBalanceInput {
                company_id: "company-1".into(),
                period_id: "period-1".into(),
                inventory_item_id: "item-1".into(),
                warehouse_id: "warehouse-1".into(),
                quantity: 10.0,
                amount: 100.0,
            },
            "测试会计",
            &db,
        )
        .await
        .expect("save opening inventory");
        assert_eq!(record.status, "草稿");
        let error =
            finalize_inventory_opening_balances_record("company-1", "period-1", "测试会计", &db)
                .await
                .expect_err("financial opening must be finalized first");
        assert!(error.contains("财务期初余额"));

        drop(db);
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
