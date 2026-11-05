use crate::commands::auth::authenticated_actor;
use crate::db::{
    AddInventoryStocktakeLineInput, CreateInventoryStocktakeInput, Database, InventoryStocktake,
    InventoryStocktakeLine, SaveInventoryStocktakeCountInput,
};
use sqlx::{Sqlite, Transaction};
use std::collections::BTreeMap;
use tauri::State;

const QUANTITY_EPSILON: f64 = 0.000_001;
const MONEY_EPSILON: f64 = 0.005;

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn round_unit_cost(value: f64) -> f64 {
    (value * 1_000_000.0).round() / 1_000_000.0
}

fn account_code(subject: &str) -> Result<&str, String> {
    let code = subject
        .split_whitespace()
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "存货科目必须以末级科目编码开头".to_string())?;
    if !code
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_'))
    {
        return Err("存货科目必须以有效的末级科目编码开头".into());
    }
    Ok(code)
}

fn calculate_variance(
    book_quantity: f64,
    book_unit_cost: f64,
    actual_quantity: f64,
    actual_unit_cost: Option<f64>,
) -> Result<(f64, f64, f64), String> {
    if !actual_quantity.is_finite() || actual_quantity < 0.0 {
        return Err("实盘数量必须是大于或等于零的有效数值".into());
    }
    let variance_quantity = actual_quantity - book_quantity;
    if variance_quantity.abs() <= QUANTITY_EPSILON {
        return Ok((0.0, 0.0, book_unit_cost.max(0.0)));
    }
    let unit_cost = if variance_quantity > 0.0 && book_unit_cost <= QUANTITY_EPSILON {
        actual_unit_cost
            .filter(|value| value.is_finite() && *value > 0.0)
            .ok_or_else(|| "账面无库存的盘盈必须填写有效的实盘单位成本".to_string())?
    } else {
        book_unit_cost
    };
    if !unit_cost.is_finite() || unit_cost <= 0.0 {
        return Err("盘点差异缺少有效的库存单位成本".into());
    }
    let variance_amount = round_money(variance_quantity * unit_cost);
    if variance_amount.abs() < 0.01 {
        return Err("盘点差异金额不足 0.01 元，请核对数量和单位成本".into());
    }
    Ok((
        variance_quantity,
        variance_amount,
        round_unit_cost(unit_cost),
    ))
}

async fn stocktake_book_balance(
    company_id: &str,
    inventory_item_id: &str,
    warehouse_id: &str,
    stocktake_date: &str,
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<(f64, f64), String> {
    let (quantity, amount): (f64, f64) = sqlx::query_as(
        r#"SELECT
               COALESCE(SUM(CASE WHEN direction = 'inbound' THEN quantity ELSE -quantity END), 0),
               COALESCE(SUM(CASE WHEN direction = 'inbound' THEN amount ELSE -amount END), 0)
           FROM inventory_movements
           WHERE company_id = ? AND inventory_item_id = ? AND warehouse_id = ?
             AND movement_date <= ? AND status IN ('已核验', '已生成凭证')"#,
    )
    .bind(company_id)
    .bind(inventory_item_id)
    .bind(warehouse_id)
    .bind(stocktake_date)
    .fetch_one(&mut **transaction)
    .await
    .map_err(|error| format!("计算盘点账面库存失败: {error}"))?;
    Ok((quantity, round_money(amount)))
}

async fn ensure_stocktake_period_open(
    company_id: &str,
    period_id: &str,
    stocktake_date: &str,
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<String, String> {
    let period: Option<(String, i32, i32, String, String)> = sqlx::query_as(
        "SELECT status, period_year, period_month, start_date, end_date FROM accounting_periods WHERE id = ? AND company_id = ?",
    )
    .bind(period_id)
    .bind(company_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("查询会计期间失败: {error}"))?;
    let Some((status, year, month, start_date, end_date)) = period else {
        return Err("会计期间不存在或不属于当前账套".into());
    };
    if status != "open" {
        return Err("已结账期间不能维护库存盘点".into());
    }
    if stocktake_date < start_date.as_str() || stocktake_date > end_date.as_str() {
        return Err("盘点日期必须位于所选会计期间内".into());
    }
    Ok(format!("{year:04}-{month:02}"))
}

#[tauri::command]
pub async fn get_inventory_stocktakes(
    company_id: String,
    period_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryStocktake>, String> {
    sqlx::query_as(
        "SELECT * FROM inventory_stocktakes WHERE company_id = ? AND period_id = ? ORDER BY stocktake_date DESC, stocktake_no DESC",
    )
    .bind(company_id)
    .bind(period_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询库存盘点失败: {error}"))
}

#[tauri::command]
pub async fn get_inventory_stocktake_lines(
    stocktake_id: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryStocktakeLine>, String> {
    let owned: Option<i64> =
        sqlx::query_scalar("SELECT 1 FROM inventory_stocktakes WHERE id = ? AND company_id = ?")
            .bind(&stocktake_id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("检查盘点单归属失败: {error}"))?;
    if owned.is_none() {
        return Err("盘点单不存在或不属于当前账套".into());
    }
    sqlx::query_as(
        "SELECT * FROM inventory_stocktake_lines WHERE stocktake_id = ? AND company_id = ? ORDER BY item_code",
    )
    .bind(stocktake_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询盘点明细失败: {error}"))
}

#[tauri::command]
pub async fn create_inventory_stocktake(
    input: CreateInventoryStocktakeInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryStocktake, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_inventory_stocktake_record(input, &actor, db.inner()).await
}

async fn create_inventory_stocktake_record(
    input: CreateInventoryStocktakeInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryStocktake, String> {
    if input.stocktake_date.trim().len() != 10 {
        return Err("盘点日期格式必须为 YYYY-MM-DD".into());
    }
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动库存盘点事务失败: {error}"))?;
    let period = ensure_stocktake_period_open(
        &input.company_id,
        &input.period_id,
        input.stocktake_date.trim(),
        &mut transaction,
    )
    .await?;
    let warehouse: Option<(String, String)> = sqlx::query_as(
        "SELECT warehouse_name, status FROM inventory_warehouses WHERE id = ? AND company_id = ?",
    )
    .bind(&input.warehouse_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点仓库失败: {error}"))?;
    let Some((warehouse_name, warehouse_status)) = warehouse else {
        return Err("仓库不存在或不属于当前账套".into());
    };
    if warehouse_status != "启用" {
        return Err("停用仓库不能创建盘点单".into());
    }
    let existing_draft: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM inventory_stocktakes WHERE company_id = ? AND period_id = ? AND warehouse_id = ? AND status = '草稿'",
    )
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&input.warehouse_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("检查仓库盘点草稿失败: {error}"))?;
    if existing_draft > 0 {
        return Err("当前仓库在本期已有未确认盘点单，请先完成或作废".into());
    }
    let source_movement_max_rowid: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(rowid), 0) FROM inventory_movements WHERE company_id = ? AND warehouse_id = ?",
    )
    .bind(&input.company_id)
    .bind(&input.warehouse_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取库存变动快照失败: {error}"))?;
    let next_sequence: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(CAST(substr(stocktake_no, 11) AS INTEGER)), 0) + 1 FROM inventory_stocktakes WHERE company_id = ? AND period = ?",
    )
    .bind(&input.company_id)
    .bind(&period)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("生成盘点单号失败: {error}"))?;
    let stocktake_no = format!("PD-{}-{next_sequence:03}", period.replace('-', ""));
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO inventory_stocktakes
           (id, company_id, period_id, period, stocktake_no, stocktake_date,
            warehouse_id, warehouse_name, note, source_movement_max_rowid,
            created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period_id)
    .bind(&period)
    .bind(&stocktake_no)
    .bind(input.stocktake_date.trim())
    .bind(&input.warehouse_id)
    .bind(&warehouse_name)
    .bind(
        input
            .note
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(source_movement_max_rowid)
    .bind(actor)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("创建盘点单失败: {error}"))?;

    let snapshots: Vec<(String, String, String, String, String, f64, f64)> = sqlx::query_as(
        r#"SELECT i.id, i.item_code, i.item_name, i.unit, i.inventory_subject,
                  COALESCE(SUM(CASE WHEN m.direction = 'inbound' THEN m.quantity ELSE -m.quantity END), 0) AS book_quantity,
                  COALESCE(SUM(CASE WHEN m.direction = 'inbound' THEN m.amount ELSE -m.amount END), 0) AS book_amount
           FROM inventory_items i
           LEFT JOIN inventory_movements m
             ON m.inventory_item_id = i.id AND m.company_id = i.company_id
            AND m.warehouse_id = ? AND m.movement_date <= ?
            AND m.status IN ('已核验', '已生成凭证')
           WHERE i.company_id = ? AND i.status = '启用'
           GROUP BY i.id, i.item_code, i.item_name, i.unit, i.inventory_subject
           HAVING ABS(book_quantity) > 0.000001 OR ABS(book_amount) >= 0.005
           ORDER BY i.item_code"#,
    )
    .bind(&input.warehouse_id)
    .bind(input.stocktake_date.trim())
    .bind(&input.company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("生成盘点账面快照失败: {error}"))?;
    for (item_id, item_code, item_name, unit, inventory_subject, quantity, amount) in snapshots {
        if quantity < -QUANTITY_EPSILON || amount < -MONEY_EPSILON {
            return Err(format!("存货 {item_code} 存在负库存，不能创建盘点快照"));
        }
        let book_amount = round_money(amount.max(0.0));
        let book_unit_cost = if quantity > QUANTITY_EPSILON {
            round_unit_cost(book_amount / quantity)
        } else {
            0.0
        };
        sqlx::query(
            r#"INSERT INTO inventory_stocktake_lines
               (id, stocktake_id, company_id, inventory_item_id, item_code,
                item_name, unit, inventory_subject, book_quantity, book_amount,
                book_unit_cost)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(&input.company_id)
        .bind(item_id)
        .bind(item_code)
        .bind(item_name)
        .bind(unit)
        .bind(inventory_subject)
        .bind(quantity.max(0.0))
        .bind(book_amount)
        .bind(book_unit_cost)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存盘点账面快照失败: {error}"))?;
    }
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '库存盘点', '创建盘点单', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&stocktake_no)
    .bind(format!(
        "仓库 {warehouse_name}，盘点日期 {}，账面快照行数 {}",
        input.stocktake_date,
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM inventory_stocktake_lines WHERE stocktake_id = ?",
        )
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("统计盘点快照失败: {error}"))?
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入盘点审计日志失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM inventory_stocktakes WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取新建盘点单失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交盘点单失败: {error}"))?;
    Ok(record)
}

#[tauri::command]
pub async fn add_inventory_stocktake_line(
    input: AddInventoryStocktakeLineInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryStocktakeLine, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动新增盘点明细事务失败: {error}"))?;
    let stocktake: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT period_id, stocktake_date, warehouse_id, status FROM inventory_stocktakes WHERE id = ? AND company_id = ?",
    )
    .bind(&input.stocktake_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点单失败: {error}"))?;
    let Some((period_id, stocktake_date, warehouse_id, status)) = stocktake else {
        return Err("盘点单不存在或不属于当前账套".into());
    };
    if status != "草稿" {
        return Err("只有草稿盘点单可以新增明细".into());
    }
    ensure_stocktake_period_open(
        &input.company_id,
        &period_id,
        &stocktake_date,
        &mut transaction,
    )
    .await?;
    let item: Option<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT item_code, item_name, unit, inventory_subject, status FROM inventory_items WHERE id = ? AND company_id = ?",
    )
    .bind(&input.inventory_item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询存货档案失败: {error}"))?;
    let Some((item_code, item_name, unit, inventory_subject, item_status)) = item else {
        return Err("存货不存在或不属于当前账套".into());
    };
    if item_status != "启用" {
        return Err("停用存货不能加入盘点单".into());
    }
    let (book_quantity, book_amount) = stocktake_book_balance(
        &input.company_id,
        &input.inventory_item_id,
        &warehouse_id,
        &stocktake_date,
        &mut transaction,
    )
    .await?;
    if book_quantity < -QUANTITY_EPSILON || book_amount < -MONEY_EPSILON {
        return Err("该存货存在负库存，不能加入盘点单".into());
    }
    let book_unit_cost = if book_quantity > QUANTITY_EPSILON {
        round_unit_cost(book_amount / book_quantity)
    } else {
        0.0
    };
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO inventory_stocktake_lines
           (id, stocktake_id, company_id, inventory_item_id, item_code, item_name,
            unit, inventory_subject, book_quantity, book_amount, book_unit_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.stocktake_id)
    .bind(&input.company_id)
    .bind(&input.inventory_item_id)
    .bind(&item_code)
    .bind(&item_name)
    .bind(&unit)
    .bind(&inventory_subject)
    .bind(book_quantity.max(0.0))
    .bind(round_money(book_amount.max(0.0)))
    .bind(book_unit_cost)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        if error.to_string().contains("UNIQUE") {
            "该存货已在当前盘点单中".to_string()
        } else {
            format!("新增盘点明细失败: {error}")
        }
    })?;
    sqlx::query(
        "UPDATE inventory_stocktakes SET updated_by = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(actor)
    .bind(&input.stocktake_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新盘点单失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM inventory_stocktake_lines WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取盘点明细失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交盘点明细失败: {error}"))?;
    Ok(record)
}

#[tauri::command]
pub async fn save_inventory_stocktake_count(
    input: SaveInventoryStocktakeCountInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryStocktakeLine, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    save_inventory_stocktake_count_record(input, &actor, db.inner()).await
}

async fn save_inventory_stocktake_count_record(
    input: SaveInventoryStocktakeCountInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryStocktakeLine, String> {
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动保存实盘数量事务失败: {error}"))?;
    let current: Option<(String, f64, f64, String, String, String)> = sqlx::query_as(
        r#"SELECT l.stocktake_id, l.book_quantity, l.book_unit_cost,
                  s.period_id, s.stocktake_date, s.status
           FROM inventory_stocktake_lines l
           JOIN inventory_stocktakes s ON s.id = l.stocktake_id AND s.company_id = l.company_id
           WHERE l.id = ? AND l.company_id = ?"#,
    )
    .bind(&input.line_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点明细失败: {error}"))?;
    let Some((stocktake_id, book_quantity, book_unit_cost, period_id, stocktake_date, status)) =
        current
    else {
        return Err("盘点明细不存在或不属于当前账套".into());
    };
    if status != "草稿" {
        return Err("已确认或已作废的盘点单不能修改实盘数量".into());
    }
    ensure_stocktake_period_open(
        &input.company_id,
        &period_id,
        &stocktake_date,
        &mut transaction,
    )
    .await?;
    let (variance_quantity, variance_amount, unit_cost) = calculate_variance(
        book_quantity,
        book_unit_cost,
        input.actual_quantity,
        input.actual_unit_cost,
    )?;
    let reason = input
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if variance_quantity.abs() > QUANTITY_EPSILON && reason.is_none() {
        return Err("存在盘盈或盘亏时必须填写差异原因".into());
    }
    sqlx::query(
        r#"UPDATE inventory_stocktake_lines
           SET actual_quantity = ?, actual_unit_cost = ?, variance_quantity = ?,
               variance_amount = ?, reason = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(input.actual_quantity)
    .bind(unit_cost)
    .bind(variance_quantity)
    .bind(variance_amount)
    .bind(reason)
    .bind(&input.line_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存实盘数量失败: {error}"))?;
    sqlx::query(
        "UPDATE inventory_stocktakes SET updated_by = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(actor)
    .bind(stocktake_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新盘点单失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM inventory_stocktake_lines WHERE id = ?")
        .bind(&input.line_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取盘点明细失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交实盘数量失败: {error}"))?;
    Ok(record)
}

#[tauri::command]
pub async fn confirm_inventory_stocktake(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryStocktake, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    confirm_inventory_stocktake_record(&id, &company_id, &actor, db.inner()).await
}

async fn confirm_inventory_stocktake_record(
    id: &str,
    company_id: &str,
    actor: &str,
    db: &Database,
) -> Result<InventoryStocktake, String> {
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动确认盘点事务失败: {error}"))?;
    let stocktake: Option<InventoryStocktake> =
        sqlx::query_as("SELECT * FROM inventory_stocktakes WHERE id = ? AND company_id = ?")
            .bind(id)
            .bind(company_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("查询盘点单失败: {error}"))?;
    let Some(stocktake) = stocktake else {
        return Err("盘点单不存在或不属于当前账套".into());
    };
    if stocktake.status != "草稿" {
        return Err("只有草稿盘点单可以确认".into());
    }
    ensure_stocktake_period_open(
        company_id,
        &stocktake.period_id,
        &stocktake.stocktake_date,
        &mut transaction,
    )
    .await?;
    let changed_movements: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM inventory_movements
           WHERE company_id = ? AND warehouse_id = ? AND status IN ('已核验', '已生成凭证')
             AND (rowid > ? OR (confirmed_at IS NOT NULL AND confirmed_at > ?))"#,
    )
    .bind(company_id)
    .bind(&stocktake.warehouse_id)
    .bind(stocktake.source_movement_max_rowid)
    .bind(&stocktake.created_at)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("检查盘点后库存变动失败: {error}"))?;
    if changed_movements > 0 {
        return Err("盘点快照后已有新的核验出入库，请作废当前盘点单并重新盘点".into());
    }
    let lines: Vec<InventoryStocktakeLine> = sqlx::query_as(
        "SELECT * FROM inventory_stocktake_lines WHERE stocktake_id = ? AND company_id = ? ORDER BY item_code",
    )
    .bind(id)
    .bind(company_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点明细失败: {error}"))?;
    if lines.is_empty() {
        return Err("盘点单没有明细，不能确认".into());
    }
    if lines.iter().any(|line| line.actual_quantity.is_none()) {
        return Err("所有盘点明细都必须录入实盘数量后才能确认".into());
    }

    let adjustment_account: Option<(String, String)> = sqlx::query_as(
        "SELECT code, name FROM account_codes WHERE company_id = ? AND name = '待处理财产损溢' AND is_detail = 1 AND is_enabled = 1 ORDER BY code LIMIT 1",
    )
    .bind(company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点差异科目失败: {error}"))?;
    let has_variance = lines
        .iter()
        .any(|line| line.variance_quantity.abs() > QUANTITY_EPSILON);
    let adjustment_account = if has_variance {
        Some(adjustment_account.ok_or_else(|| {
            "当前账套缺少已启用的末级科目“待处理财产损溢”，不能生成盘点调整".to_string()
        })?)
    } else {
        None
    };
    let mut voucher_entries: BTreeMap<(String, String, String), f64> = BTreeMap::new();
    let mut movement_count = 0usize;
    for line in &lines {
        if line.variance_quantity.abs() <= QUANTITY_EPSILON {
            continue;
        }
        let code = account_code(&line.inventory_subject)?.to_string();
        let inventory_account: Option<(String, String)> = sqlx::query_as(
            "SELECT code, name FROM account_codes WHERE company_id = ? AND code = ? AND is_detail = 1 AND is_enabled = 1",
        )
        .bind(company_id)
        .bind(&code)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("查询存货科目失败: {error}"))?;
        let Some((inventory_code, inventory_name)) = inventory_account else {
            return Err(format!("存货 {} 的核算科目无效", line.item_code));
        };
        let (adjustment_code, adjustment_name) = adjustment_account
            .as_ref()
            .expect("variance requires adjustment account");
        let is_gain = line.variance_quantity > 0.0;
        let amount = line.variance_amount.abs();
        let quantity = line.variance_quantity.abs();
        if amount < 0.01 || quantity <= QUANTITY_EPSILON {
            return Err(format!("存货 {} 的盘点差异无效", line.item_code));
        }
        let movement_id = uuid::Uuid::new_v4().to_string();
        let movement_type = if is_gain {
            "盘盈入库"
        } else {
            "盘亏出库"
        };
        let direction = if is_gain { "inbound" } else { "outbound" };
        movement_count += 1;
        let bill_no = format!("{}-{:03}", stocktake.stocktake_no, movement_count);
        sqlx::query(
            r#"INSERT INTO inventory_movements
               (id, company_id, period, movement_date, bill_no, movement_type,
                inventory_name, warehouse, warehouse_id, unit, quantity, amount,
                inventory_item_id, direction, unit_cost, confirmed_at,
                source_document, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, '已核验')"#,
        )
        .bind(&movement_id)
        .bind(company_id)
        .bind(&stocktake.period)
        .bind(&stocktake.stocktake_date)
        .bind(&bill_no)
        .bind(movement_type)
        .bind(&line.item_name)
        .bind(&stocktake.warehouse_name)
        .bind(&stocktake.warehouse_id)
        .bind(&line.unit)
        .bind(quantity)
        .bind(amount)
        .bind(&line.inventory_item_id)
        .bind(direction)
        .bind(round_unit_cost(amount / quantity))
        .bind(format!("盘点单 {}", stocktake.stocktake_no))
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("生成盘点调整出入库失败: {error}"))?;
        sqlx::query("UPDATE inventory_stocktake_lines SET movement_id = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(&movement_id)
            .bind(&line.id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("关联盘点调整记录失败: {error}"))?;
        if is_gain {
            *voucher_entries
                .entry((inventory_code, inventory_name, "debit".into()))
                .or_default() += amount;
            *voucher_entries
                .entry((
                    adjustment_code.clone(),
                    adjustment_name.clone(),
                    "credit".into(),
                ))
                .or_default() += amount;
        } else {
            *voucher_entries
                .entry((
                    adjustment_code.clone(),
                    adjustment_name.clone(),
                    "debit".into(),
                ))
                .or_default() += amount;
            *voucher_entries
                .entry((inventory_code, inventory_name, "credit".into()))
                .or_default() += amount;
        }
    }

    let voucher_id = if voucher_entries.is_empty() {
        None
    } else {
        let voucher_word: Option<(String, String)> = sqlx::query_as(
            "SELECT id, word_name FROM voucher_words WHERE company_id = ? AND is_enabled = 1 ORDER BY word_code LIMIT 1",
        )
        .bind(company_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("查询凭证字失败: {error}"))?;
        let Some((voucher_word_id, voucher_word_name)) = voucher_word else {
            return Err("当前账套没有启用的凭证字，不能生成盘点调整草稿".into());
        };
        let last_sequence: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(sequence_num) FROM vouchers WHERE company_id = ? AND period_id = ? AND voucher_word_id = ?",
        )
        .bind(company_id)
        .bind(&stocktake.period_id)
        .bind(&voucher_word_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("生成盘点调整凭证号失败: {error}"))?;
        let sequence = last_sequence.unwrap_or(0) + 1;
        let voucher_number = format!("{}字第{sequence:03}号", voucher_word_name);
        let voucher_id = uuid::Uuid::new_v4().to_string();
        let total_amount = round_money(
            voucher_entries
                .iter()
                .filter(|((_, _, direction), _)| direction == "debit")
                .map(|(_, amount)| *amount)
                .sum(),
        );
        sqlx::query(
            r#"INSERT INTO vouchers
               (id, company_id, period_id, voucher_word_id, voucher_number,
                sequence_num, voucher_date, summary, status, total_debit,
                total_credit, version, created_by, reference_number)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, ?)"#,
        )
        .bind(&voucher_id)
        .bind(company_id)
        .bind(&stocktake.period_id)
        .bind(&voucher_word_id)
        .bind(&voucher_number)
        .bind(sequence)
        .bind(&stocktake.stocktake_date)
        .bind(format!("库存盘点差异调整 {}", stocktake.stocktake_no))
        .bind(total_amount)
        .bind(total_amount)
        .bind(actor)
        .bind(&stocktake.stocktake_no)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("生成盘点调整凭证失败: {error}"))?;
        for (index, ((code, name, direction), amount)) in voucher_entries.iter().enumerate() {
            sqlx::query(
                r#"INSERT INTO voucher_entries
                   (id, voucher_id, line_num, account_code, account_name,
                    direction, amount, summary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&voucher_id)
            .bind(index as i32 + 1)
            .bind(code)
            .bind(name)
            .bind(direction)
            .bind(round_money(*amount))
            .bind(format!("库存盘点差异调整 {}", stocktake.stocktake_no))
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("生成盘点调整凭证明细失败: {error}"))?;
        }
        Some(voucher_id)
    };
    sqlx::query(
        r#"UPDATE inventory_stocktakes
           SET status = '已确认', voucher_id = ?, confirmed_at = datetime('now'),
               confirmed_by = ?, updated_by = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND status = '草稿'"#,
    )
    .bind(&voucher_id)
    .bind(actor)
    .bind(actor)
    .bind(id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("锁定盘点单失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '库存盘点', '确认盘点差异', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(&stocktake.stocktake_no)
    .bind(format!(
        "确认 {} 条盘点明细，生成 {} 条盘盈/盘亏记录{}",
        lines.len(),
        movement_count,
        if voucher_id.is_some() {
            "及一张待审核调整凭证"
        } else {
            "，无盘点差异"
        }
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入盘点确认审计日志失败: {error}"))?;
    let confirmed = sqlx::query_as("SELECT * FROM inventory_stocktakes WHERE id = ?")
        .bind(id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取已确认盘点单失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交盘点确认失败: {error}"))?;
    Ok(confirmed)
}

#[tauri::command]
pub async fn void_inventory_stocktake(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryStocktake, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("启动作废盘点单事务失败: {error}"))?;
    let stocktake_no: Option<String> = sqlx::query_scalar(
        "SELECT stocktake_no FROM inventory_stocktakes WHERE id = ? AND company_id = ? AND status = '草稿'",
    )
    .bind(&id)
    .bind(&company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("查询盘点单失败: {error}"))?;
    let Some(stocktake_no) = stocktake_no else {
        return Err("只有当前账套的草稿盘点单可以作废".into());
    };
    sqlx::query(
        "UPDATE inventory_stocktakes SET status = '已作废', voided_at = datetime('now'), voided_by = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status = '草稿'",
    )
    .bind(&actor)
    .bind(&actor)
    .bind(&id)
    .bind(&company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("作废盘点单失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '库存盘点', '作废盘点单', ?, 'medium', 'success', '作废未确认盘点单，不产生库存和凭证影响', ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&company_id)
    .bind(&stocktake_no)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入盘点作废审计日志失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM inventory_stocktakes WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取已作废盘点单失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交作废盘点单失败: {error}"))?;
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_data_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "accounting-inventory-stocktake-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[test]
    fn variance_uses_book_cost_and_requires_cost_for_newly_found_stock() {
        let (quantity, amount, cost) =
            calculate_variance(10.0, 12.5, 8.0, None).expect("calculate inventory loss");
        assert_eq!(quantity, -2.0);
        assert_eq!(amount, -25.0);
        assert_eq!(cost, 12.5);

        let error = calculate_variance(0.0, 0.0, 2.0, None)
            .expect_err("newly found inventory requires a cost");
        assert!(error.contains("实盘单位成本"));

        let (quantity, amount, cost) =
            calculate_variance(0.0, 0.0, 2.0, Some(15.0)).expect("calculate inventory gain");
        assert_eq!(quantity, 2.0);
        assert_eq!(amount, 30.0);
        assert_eq!(cost, 15.0);
    }

    #[tokio::test]
    async fn stocktake_confirmation_creates_loss_movement_balanced_voucher_and_audit() {
        let data_dir = test_data_dir();
        let db = Database::new(data_dir.clone())
            .await
            .expect("create stocktake test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '盘点测试账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        sqlx::query("INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('period-1', 'company-1', 2026, 5, '2026-05-01', '2026-05-31', 'open')")
            .execute(db.pool()).await.expect("insert period");
        sqlx::query("INSERT INTO inventory_items (id, company_id, item_code, item_name, unit, inventory_subject, cost_subject) VALUES ('item-1', 'company-1', 'RM001', '钢材', '吨', '1403 原材料', '6401 主营业务成本')")
            .execute(db.pool()).await.expect("insert inventory item");
        sqlx::query("INSERT INTO inventory_warehouses (id, company_id, warehouse_code, warehouse_name) VALUES ('warehouse-1', 'company-1', 'WH01', '主仓')")
            .execute(db.pool()).await.expect("insert warehouse");
        sqlx::query("INSERT INTO account_codes (code, company_id, name, account_type, normal_balance, level, is_detail) VALUES ('1403', 'company-1', '原材料', 'asset', 'debit', 1, 1), ('1901', 'company-1', '待处理财产损溢', 'asset', 'debit', 1, 1)")
            .execute(db.pool()).await.expect("insert stocktake accounts");
        sqlx::query("INSERT INTO voucher_words (id, company_id, word_code, word_name) VALUES ('word-1', 'company-1', '记', '记')")
            .execute(db.pool()).await.expect("insert voucher word");
        sqlx::query(
            r#"INSERT INTO inventory_movements
               (id, company_id, period, movement_date, bill_no, movement_type,
                inventory_name, warehouse, warehouse_id, unit, quantity, amount,
                inventory_item_id, direction, unit_cost, confirmed_at, status)
               VALUES ('movement-in', 'company-1', '2026-05', '2026-05-01', 'RK001',
                       '采购入库', '钢材', '主仓', 'warehouse-1', '吨', 10, 200,
                       'item-1', 'inbound', 20, '2026-05-01 09:00:00', '已核验')"#,
        )
        .execute(db.pool())
        .await
        .expect("insert confirmed stock");

        let stocktake = create_inventory_stocktake_record(
            CreateInventoryStocktakeInput {
                company_id: "company-1".into(),
                period_id: "period-1".into(),
                stocktake_date: "2026-05-31".into(),
                warehouse_id: "warehouse-1".into(),
                note: Some("月末全面盘点".into()),
            },
            "测试会计",
            &db,
        )
        .await
        .expect("create stocktake snapshot");
        let line: InventoryStocktakeLine =
            sqlx::query_as("SELECT * FROM inventory_stocktake_lines WHERE stocktake_id = ?")
                .bind(&stocktake.id)
                .fetch_one(db.pool())
                .await
                .expect("load stocktake line");
        assert_eq!(line.book_quantity, 10.0);
        assert_eq!(line.book_amount, 200.0);
        assert_eq!(line.book_unit_cost, 20.0);

        let counted = save_inventory_stocktake_count_record(
            SaveInventoryStocktakeCountInput {
                company_id: "company-1".into(),
                line_id: line.id,
                actual_quantity: 8.0,
                actual_unit_cost: None,
                reason: Some("保管损耗".into()),
            },
            "测试会计",
            &db,
        )
        .await
        .expect("save physical count");
        assert_eq!(counted.variance_quantity, -2.0);
        assert_eq!(counted.variance_amount, -40.0);

        let confirmed =
            confirm_inventory_stocktake_record(&stocktake.id, "company-1", "测试会计", &db)
                .await
                .expect("confirm stocktake");
        assert_eq!(confirmed.status, "已确认");
        let voucher_id = confirmed.voucher_id.expect("stocktake adjustment voucher");
        let movement: (String, String, f64, f64) = sqlx::query_as(
            "SELECT movement_type, direction, quantity, amount FROM inventory_movements WHERE source_document = ?",
        )
        .bind(format!("盘点单 {}", stocktake.stocktake_no))
        .fetch_one(db.pool())
        .await
        .expect("load generated stock loss");
        assert_eq!(movement, ("盘亏出库".into(), "outbound".into(), 2.0, 40.0));
        let entries: Vec<(String, String, f64)> = sqlx::query_as(
            "SELECT account_code, direction, amount FROM voucher_entries WHERE voucher_id = ? ORDER BY line_num",
        )
        .bind(&voucher_id)
        .fetch_all(db.pool())
        .await
        .expect("load stocktake voucher entries");
        assert_eq!(
            entries,
            vec![
                ("1403".into(), "credit".into(), 40.0),
                ("1901".into(), "debit".into(), 40.0),
            ]
        );
        let audit: (String, String, String) = sqlx::query_as(
            "SELECT action, risk_level, operator FROM operation_audit_logs WHERE company_id = 'company-1' AND object_ref = ? AND action = '确认盘点差异'",
        )
        .bind(&stocktake.stocktake_no)
        .fetch_one(db.pool())
        .await
        .expect("load stocktake audit");
        assert_eq!(
            audit,
            ("确认盘点差异".into(), "high".into(), "测试会计".into())
        );

        drop(db);
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
