use crate::commands::auth::authenticated_actor;
use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{
    CostCarryoverRecord, CreateInventoryMovementInput, Database, InventoryMovement,
    InventoryStockBalance, UpdateInventoryMovementInput,
};
use tauri::State;

const EPSILON: f64 = 0.000_001;

#[derive(Debug, PartialEq)]
struct InventoryValuation {
    unit_cost: f64,
    amount: f64,
    ending_quantity: f64,
    ending_amount: f64,
}

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn round_unit_cost(value: f64) -> f64 {
    (value * 1_000_000.0).round() / 1_000_000.0
}

fn movement_direction(movement_type: &str) -> Result<&'static str, String> {
    if movement_type.contains("入库") {
        Ok("inbound")
    } else if movement_type.contains("出库") {
        Ok("outbound")
    } else {
        Err("出入库类型必须明确为入库或出库".into())
    }
}

fn calculate_inventory_confirmation(
    direction: &str,
    quantity: f64,
    entered_amount: f64,
    balance_quantity: f64,
    balance_amount: f64,
) -> Result<InventoryValuation, String> {
    if !quantity.is_finite() || quantity <= 0.0 {
        return Err("出入库数量必须大于零".into());
    }
    if !balance_quantity.is_finite() || !balance_amount.is_finite() {
        return Err("库存余额无效，不能核验出入库单".into());
    }
    if direction == "inbound" {
        if !entered_amount.is_finite() || entered_amount <= 0.0 {
            return Err("入库金额必须大于零".into());
        }
        let amount = round_money(entered_amount);
        return Ok(InventoryValuation {
            unit_cost: round_unit_cost(amount / quantity),
            amount,
            ending_quantity: balance_quantity + quantity,
            ending_amount: round_money(balance_amount + amount),
        });
    }
    if direction != "outbound" {
        return Err("出入库方向无效".into());
    }
    if balance_quantity + EPSILON < quantity || balance_quantity <= EPSILON {
        return Err("出库数量超过可用库存，禁止形成负库存".into());
    }
    let unit_cost = round_unit_cost(balance_amount / balance_quantity);
    let amount = if (balance_quantity - quantity).abs() <= EPSILON {
        round_money(balance_amount)
    } else {
        round_money(unit_cost * quantity)
    };
    let ending_quantity = (balance_quantity - quantity).max(0.0);
    let ending_amount = if ending_quantity <= EPSILON {
        0.0
    } else {
        round_money((balance_amount - amount).max(0.0))
    };
    Ok(InventoryValuation {
        unit_cost,
        amount,
        ending_quantity,
        ending_amount,
    })
}

async fn inventory_item_for_movement(
    db: &Database,
    company_id: &str,
    inventory_item_id: &str,
) -> Result<(String, String, String, String, String, String), String> {
    sqlx::query_as(
        "SELECT item_name, unit, valuation_method, inventory_subject, cost_subject, status FROM inventory_items WHERE id = ? AND company_id = ?",
    )
    .bind(inventory_item_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询存货档案失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的存货档案".to_string())
}

async fn inventory_warehouse_for_movement(
    db: &Database,
    company_id: &str,
    warehouse_id: &str,
) -> Result<String, String> {
    let warehouse: (String, String) = sqlx::query_as(
        "SELECT warehouse_name, status FROM inventory_warehouses WHERE id = ? AND company_id = ?",
    )
    .bind(warehouse_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询仓库档案失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的仓库档案".to_string())?;
    if warehouse.1 != "启用" {
        return Err("停用的仓库不能登记出入库单".into());
    }
    Ok(warehouse.0)
}

fn validate_movement_input(
    movement_date: &str,
    bill_no: &str,
    movement_type: &str,
    inventory_item_id: &str,
    warehouse_id: &str,
    quantity: f64,
    amount: f64,
) -> Result<&'static str, String> {
    if movement_type.trim() == "期初入库" {
        return Err("期初入库只能由期初库存确认流程生成".into());
    }
    if movement_type.trim() == "盘盈入库" {
        return Err("盘盈入库只能由库存盘点确认流程生成".into());
    }
    if movement_type.trim() == "盘亏出库" {
        return Err("盘亏出库只能由库存盘点确认流程生成".into());
    }
    let direction = movement_direction(movement_type)?;
    if movement_date.trim().is_empty()
        || bill_no.trim().is_empty()
        || inventory_item_id.trim().is_empty()
        || warehouse_id.trim().is_empty()
        || !quantity.is_finite()
        || quantity <= 0.0
        || !amount.is_finite()
        || amount < 0.0
        || (direction == "inbound" && amount <= 0.0)
    {
        return Err(
            "出入库单信息不完整，数量必须大于零，入库金额必须大于零且金额不能为负数".into(),
        );
    }
    Ok(direction)
}

#[tauri::command]
pub async fn get_inventory_movements(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryMovement>, String> {
    sqlx::query_as("SELECT * FROM inventory_movements WHERE company_id = ? AND period = ? ORDER BY movement_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询出入库单失败: {error}"))
}

#[tauri::command]
pub async fn get_inventory_stock_balances(
    company_id: String,
    through_period: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryStockBalance>, String> {
    sqlx::query_as(
        r#"SELECT
            i.id AS inventory_item_id,
            i.item_code,
            i.item_name,
            m.warehouse,
            i.unit,
            SUM(CASE WHEN m.direction = 'inbound' THEN m.quantity ELSE -m.quantity END) AS quantity,
            ROUND(SUM(CASE WHEN m.direction = 'inbound' THEN m.amount ELSE -m.amount END), 2) AS amount,
            CASE
                WHEN ABS(SUM(CASE WHEN m.direction = 'inbound' THEN m.quantity ELSE -m.quantity END)) < 0.000001 THEN 0
                ELSE ROUND(
                    SUM(CASE WHEN m.direction = 'inbound' THEN m.amount ELSE -m.amount END) /
                    SUM(CASE WHEN m.direction = 'inbound' THEN m.quantity ELSE -m.quantity END),
                    6
                )
            END AS average_unit_cost,
            i.safety_stock
        FROM inventory_movements m
        JOIN inventory_items i ON i.id = m.inventory_item_id AND i.company_id = m.company_id
        WHERE m.company_id = ?
          AND m.period <= ?
          AND m.status IN ('已核验', '已生成凭证')
          AND m.direction IN ('inbound', 'outbound')
        GROUP BY i.id, i.item_code, i.item_name, m.warehouse, i.unit, i.safety_stock
        ORDER BY i.item_code, m.warehouse"#,
    )
    .bind(company_id)
    .bind(through_period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询库存余额失败: {error}"))
}

#[tauri::command]
pub async fn create_inventory_movement(
    input: CreateInventoryMovementInput,
    db: State<'_, Database>,
) -> Result<InventoryMovement, String> {
    if input.company_id.trim().is_empty() || input.period.trim().is_empty() {
        return Err("账套和账期不能为空".into());
    }
    let direction = validate_movement_input(
        &input.movement_date,
        &input.bill_no,
        &input.movement_type,
        &input.inventory_item_id,
        &input.warehouse_id,
        input.quantity,
        input.amount,
    )?;
    let (inventory_name, unit, valuation_method, _, _, item_status) =
        inventory_item_for_movement(&db, &input.company_id, &input.inventory_item_id).await?;
    let warehouse =
        inventory_warehouse_for_movement(&db, &input.company_id, &input.warehouse_id).await?;
    if item_status != "启用" {
        return Err("停用的存货档案不能登记出入库单".into());
    }
    if valuation_method != "移动加权" {
        return Err("当前仅支持移动加权计价，请先修正存货档案".into());
    }
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增出入库单").await?;
    let id = uuid::Uuid::new_v4().to_string();
    let amount = if direction == "inbound" {
        round_money(input.amount)
    } else {
        0.0
    };
    sqlx::query("INSERT INTO inventory_movements (id, company_id, period, movement_date, bill_no, movement_type, inventory_name, warehouse, warehouse_id, counterparty, unit, quantity, amount, inventory_item_id, direction, unit_cost, source_document, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '待确认')")
        .bind(&id).bind(&input.company_id).bind(input.period.trim()).bind(input.movement_date.trim()).bind(input.bill_no.trim()).bind(input.movement_type.trim()).bind(inventory_name).bind(warehouse).bind(input.warehouse_id.trim())
        .bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(unit).bind(input.quantity).bind(amount).bind(input.inventory_item_id.trim()).bind(direction).bind(input.source_document.as_deref().map(str::trim).filter(|value| !value.is_empty()))
        .execute(db.pool()).await.map_err(|error| format!("新增出入库单失败: {error}"))?;
    sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增出入库单失败: {error}"))
}

#[tauri::command]
pub async fn update_inventory_movement(
    input: UpdateInventoryMovementInput,
    db: State<'_, Database>,
) -> Result<InventoryMovement, String> {
    if input.id.trim().is_empty() {
        return Err("出入库单标识不能为空".into());
    }
    let direction = validate_movement_input(
        &input.movement_date,
        &input.bill_no,
        &input.movement_type,
        &input.inventory_item_id,
        &input.warehouse_id,
        input.quantity,
        input.amount,
    )?;
    let (inventory_name, unit, valuation_method, _, _, item_status) =
        inventory_item_for_movement(&db, &input.company_id, &input.inventory_item_id).await?;
    let warehouse =
        inventory_warehouse_for_movement(&db, &input.company_id, &input.warehouse_id).await?;
    if item_status != "启用" || valuation_method != "移动加权" {
        return Err("只能选择启用且采用移动加权计价的存货档案".into());
    }
    let period: String = sqlx::query_scalar(
        "SELECT period FROM inventory_movements WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询出入库单账期失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的出入库单".to_string())?;
    ensure_period_label_open(db.pool(), &input.company_id, &period, "修改出入库单").await?;
    let amount = if direction == "inbound" {
        round_money(input.amount)
    } else {
        0.0
    };
    let affected = sqlx::query("UPDATE inventory_movements SET movement_date = ?, bill_no = ?, movement_type = ?, inventory_name = ?, inventory_item_id = ?, direction = ?, warehouse = ?, warehouse_id = ?, counterparty = ?, unit = ?, quantity = ?, amount = ?, unit_cost = 0, source_document = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status = '待确认'")
        .bind(input.movement_date.trim()).bind(input.bill_no.trim()).bind(input.movement_type.trim()).bind(inventory_name).bind(input.inventory_item_id.trim()).bind(direction).bind(warehouse).bind(input.warehouse_id.trim()).bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(unit).bind(input.quantity).bind(amount).bind(input.source_document.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(&input.id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新出入库单失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到可编辑的出入库单，已核验或已生成凭证的单据不可修改".into());
    }
    sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询更新出入库单失败: {error}"))
}

#[tauri::command]
pub async fn confirm_inventory_movement(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryMovement, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    confirm_inventory_movement_for_company(id, company_id, &actor, db.inner()).await
}

async fn confirm_inventory_movement_for_company(
    id: String,
    company_id: String,
    actor: &str,
    db: &Database,
) -> Result<InventoryMovement, String> {
    let movement: InventoryMovement =
        sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询出入库单失败: {error}"))?
            .ok_or_else(|| "未找到当前账套的出入库单".to_string())?;
    if movement.status == "已核验" || movement.status == "已生成凭证" {
        return Ok(movement);
    }
    if movement.status != "待确认" {
        return Err("当前出入库单状态不允许核验".into());
    }
    let inventory_item_id = movement
        .inventory_item_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "旧出入库单未关联存货档案，请先编辑补齐后再核验".to_string())?;
    let (_, _, valuation_method, _, _, item_status) =
        inventory_item_for_movement(db, &company_id, inventory_item_id).await?;
    if item_status != "启用" || valuation_method != "移动加权" {
        return Err("只能核验启用且采用移动加权计价的存货".into());
    }
    let direction = movement
        .direction
        .as_deref()
        .ok_or_else(|| "出入库方向缺失，请先编辑单据".to_string())?;
    ensure_period_label_open(db.pool(), &company_id, &movement.period, "核验出入库单").await?;

    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    let locked = sqlx::query("UPDATE inventory_movements SET status = '核验中' WHERE id = ? AND company_id = ? AND status = '待确认'")
        .bind(&id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("锁定出入库单失败: {error}"))?;
    if locked.rows_affected() == 0 {
        return Err("出入库单已由其他操作处理，请刷新后重试".into());
    }
    let later_confirmed: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM inventory_movements
           WHERE company_id = ? AND inventory_item_id = ? AND warehouse = ?
             AND status IN ('已核验', '已生成凭证')
             AND (
                 movement_date > ? OR
                 (movement_date = ? AND (
                     created_at > ? OR (created_at = ? AND id > ?)
                 ))
             )"#,
    )
    .bind(&company_id)
    .bind(inventory_item_id)
    .bind(&movement.warehouse)
    .bind(&movement.movement_date)
    .bind(&movement.movement_date)
    .bind(&movement.created_at)
    .bind(&movement.created_at)
    .bind(&movement.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("检查后续库存记录失败: {error}"))?;
    if later_confirmed > 0 {
        return Err(
            "存在日期更晚的已核验出入库单，请按业务日期顺序核验，避免改写后续移动加权成本".into(),
        );
    }
    let (balance_quantity, balance_amount): (f64, f64) = sqlx::query_as(
        r#"SELECT
            CAST(COALESCE(SUM(CASE WHEN direction = 'inbound' THEN quantity ELSE -quantity END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE WHEN direction = 'inbound' THEN amount ELSE -amount END), 0) AS REAL)
           FROM inventory_movements
           WHERE company_id = ? AND inventory_item_id = ? AND warehouse = ?
             AND status IN ('已核验', '已生成凭证')
             AND (
                 movement_date < ? OR
                 (movement_date = ? AND (
                     created_at < ? OR (created_at = ? AND id < ?)
                 ))
             )"#,
    )
    .bind(&company_id)
    .bind(inventory_item_id)
    .bind(&movement.warehouse)
    .bind(&movement.movement_date)
    .bind(&movement.movement_date)
    .bind(&movement.created_at)
    .bind(&movement.created_at)
    .bind(&movement.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("计算核验前库存余额失败: {error}"))?;
    let valuation = calculate_inventory_confirmation(
        direction,
        movement.quantity,
        movement.amount,
        balance_quantity,
        balance_amount,
    )?;
    sqlx::query("UPDATE inventory_movements SET amount = ?, unit_cost = ?, status = '已核验', confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status = '核验中'")
        .bind(valuation.amount)
        .bind(valuation.unit_cost)
        .bind(&id)
        .bind(&company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("核验出入库单失败: {error}"))?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '核验出入库单', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&company_id)
        .bind(&movement.bill_no)
        .bind(format!("方向={direction}; 数量={}; 单位成本={:.6}; 金额={:.2}; 结存数量={:.4}; 结存金额={:.2}", movement.quantity, valuation.unit_cost, valuation.amount, valuation.ending_quantity, valuation.ending_amount))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入库存核验审计日志失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询已核验出入库单失败: {error}"))
}

#[tauri::command]
pub async fn create_cost_carryover_from_inventory_movement(
    id: String,
    company_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<CostCarryoverRecord, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_cost_carryover_from_inventory_movement_for_company(id, company_id, &actor, db.inner())
        .await
}

async fn create_cost_carryover_from_inventory_movement_for_company(
    id: String,
    company_id: String,
    actor: &str,
    db: &Database,
) -> Result<CostCarryoverRecord, String> {
    let movement: InventoryMovement =
        sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询出库单失败: {error}"))?
            .ok_or_else(|| "未找到当前账套的出库单".to_string())?;
    if movement.direction.as_deref() != Some("outbound") {
        return Err("只有出库单可以生成成本结转".into());
    }
    if movement.status != "已核验" && movement.status != "已生成凭证" {
        return Err("出库单尚未核验，不能生成成本结转".into());
    }
    if movement.amount <= 0.0 {
        return Err("出库计价金额无效，不能生成成本结转".into());
    }
    if let Some(existing) = sqlx::query_as(
        "SELECT * FROM cost_carryover_records WHERE company_id = ? AND period = ? AND source_bill_no = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&company_id)
    .bind(&movement.period)
    .bind(&movement.bill_no)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("检查成本结转记录失败: {error}"))?
    {
        return Ok(existing);
    }
    let inventory_item_id = movement
        .inventory_item_id
        .as_deref()
        .ok_or_else(|| "出库单未关联存货档案".to_string())?;
    let (_, _, valuation_method, inventory_subject, cost_subject, _) =
        inventory_item_for_movement(db, &company_id, inventory_item_id).await?;
    ensure_period_label_open(db.pool(), &company_id, &movement.period, "生成成本结转").await?;
    let carryover_id = uuid::Uuid::new_v4().to_string();
    let batch_no = format!(
        "CB-{}-{}",
        movement.period.replace('-', ""),
        movement.bill_no
    );
    let source_document = movement
        .source_document
        .as_deref()
        .unwrap_or(&movement.bill_no);
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    if let Some(existing) = sqlx::query_as(
        "SELECT * FROM cost_carryover_records WHERE company_id = ? AND period = ? AND source_bill_no = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&company_id)
    .bind(&movement.period)
    .bind(&movement.bill_no)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("锁定成本结转来源失败: {error}"))?
    {
        transaction.rollback().await.map_err(|error| error.to_string())?;
        return Ok(existing);
    }
    sqlx::query("INSERT INTO cost_carryover_records (id, company_id, period, batch_no, carryover_date, valuation_method, source_bill_no, inventory_name, debit_subject, credit_subject, cost_amount, difference_amount, voucher_no, status, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, '待确认', ?)")
        .bind(&carryover_id)
        .bind(&company_id)
        .bind(&movement.period)
        .bind(batch_no)
        .bind(&movement.movement_date)
        .bind(valuation_method)
        .bind(&movement.bill_no)
        .bind(&movement.inventory_name)
        .bind(cost_subject)
        .bind(inventory_subject)
        .bind(movement.amount)
        .bind(source_document)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("生成成本结转失败: {error}"))?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '生成成本结转', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&company_id)
        .bind(&movement.bill_no)
        .bind(format!("出库单={}; 存货={}; 结转金额={:.2}", movement.bill_no, movement.inventory_name, movement.amount))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入成本结转审计日志失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM cost_carryover_records WHERE id = ?")
        .bind(&carryover_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("查询生成的成本结转失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_data_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "accounting-inventory-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ))
    }

    #[test]
    fn moving_weighted_outbound_uses_current_average_cost() {
        let valuation = calculate_inventory_confirmation("outbound", 4.0, 999.0, 10.0, 123.45)
            .expect("calculate outbound valuation");
        assert_eq!(valuation.unit_cost, 12.345);
        assert_eq!(valuation.amount, 49.38);
        assert_eq!(valuation.ending_quantity, 6.0);
        assert_eq!(valuation.ending_amount, 74.07);
    }

    #[test]
    fn outbound_rejects_negative_stock() {
        let error = calculate_inventory_confirmation("outbound", 11.0, 0.0, 10.0, 123.45)
            .expect_err("negative stock must fail");
        assert!(error.contains("负库存"));
    }

    #[test]
    fn inbound_requires_positive_cost_amount() {
        let error = calculate_inventory_confirmation("inbound", 1.0, 0.0, 0.0, 0.0)
            .expect_err("zero inbound cost must fail");
        assert!(error.contains("入库金额"));
    }

    #[test]
    fn manual_opening_receipt_is_rejected() {
        let error = validate_movement_input(
            "2026-01-01",
            "OPEN-001",
            "期初入库",
            "item-1",
            "warehouse-1",
            1.0,
            100.0,
        )
        .expect_err("opening receipt must come from the audited opening workflow");
        assert!(error.contains("期初库存确认流程"));
    }

    #[tokio::test]
    async fn confirmation_persists_weighted_cost_and_rejects_negative_stock() {
        let data_dir = test_data_dir();
        let db = Database::new(data_dir.clone())
            .await
            .expect("create test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '库存测试账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        sqlx::query("INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES ('period-1', 'company-1', 2026, 5, '2026-05-01', '2026-05-31', 'open')")
            .execute(db.pool())
            .await
            .expect("insert open period");
        sqlx::query("INSERT INTO inventory_items (id, company_id, item_code, item_name, unit, valuation_method, inventory_subject, cost_subject, safety_stock, status) VALUES ('item-1', 'company-1', 'INV001', '测试商品', '件', '移动加权', '库存商品', '主营业务成本', 0, '启用')")
            .execute(db.pool())
            .await
            .expect("insert item");
        sqlx::query("INSERT INTO inventory_movements (id, company_id, period, movement_date, bill_no, movement_type, inventory_name, warehouse, unit, quantity, amount, inventory_item_id, direction, unit_cost, status, created_at) VALUES ('movement-in', 'company-1', '2026-05', '2026-05-01', 'RK001', '采购入库', '测试商品', '主仓', '件', 10, 123.45, 'item-1', 'inbound', 0, '待确认', '2026-05-01 09:00:00')")
            .execute(db.pool())
            .await
            .expect("insert inbound");
        let inbound = confirm_inventory_movement_for_company(
            "movement-in".into(),
            "company-1".into(),
            "测试会计",
            &db,
        )
        .await
        .expect("confirm inbound");
        assert_eq!(inbound.status, "已核验");
        assert_eq!(inbound.unit_cost, 12.345);

        sqlx::query("INSERT INTO inventory_movements (id, company_id, period, movement_date, bill_no, movement_type, inventory_name, warehouse, unit, quantity, amount, inventory_item_id, direction, unit_cost, status, created_at) VALUES ('movement-out', 'company-1', '2026-05', '2026-05-02', 'CK001', '销售出库', '测试商品', '主仓', '件', 4, 0, 'item-1', 'outbound', 0, '待确认', '2026-05-02 09:00:00')")
            .execute(db.pool())
            .await
            .expect("insert outbound");
        let outbound = confirm_inventory_movement_for_company(
            "movement-out".into(),
            "company-1".into(),
            "测试会计",
            &db,
        )
        .await
        .expect("confirm outbound");
        assert_eq!(outbound.amount, 49.38);
        assert_eq!(outbound.unit_cost, 12.345);

        let carryover = create_cost_carryover_from_inventory_movement_for_company(
            "movement-out".into(),
            "company-1".into(),
            "测试会计",
            &db,
        )
        .await
        .expect("create source-backed cost carryover");
        assert_eq!(carryover.source_bill_no, "CK001");
        assert_eq!(carryover.cost_amount, 49.38);
        assert_eq!(carryover.debit_subject, "主营业务成本");
        assert_eq!(carryover.credit_subject, "库存商品");
        let repeated = create_cost_carryover_from_inventory_movement_for_company(
            "movement-out".into(),
            "company-1".into(),
            "测试会计",
            &db,
        )
        .await
        .expect("reuse existing source-backed cost carryover");
        assert_eq!(repeated.id, carryover.id);
        let carryover_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM cost_carryover_records WHERE company_id = 'company-1' AND source_bill_no = 'CK001'",
        )
        .fetch_one(db.pool())
        .await
        .expect("count source-backed carryovers");
        assert_eq!(carryover_count, 1);
        let audit_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT action, operator FROM operation_audit_logs WHERE company_id = 'company-1' AND object_ref IN ('RK001', 'CK001') ORDER BY action",
        )
        .fetch_all(db.pool())
        .await
        .expect("load inventory audit rows");
        assert!(audit_rows
            .iter()
            .any(|(action, operator)| action == "核验出入库单" && operator == "测试会计"));
        assert!(audit_rows
            .iter()
            .any(|(action, operator)| action == "生成成本结转" && operator == "测试会计"));

        sqlx::query("INSERT INTO inventory_movements (id, company_id, period, movement_date, bill_no, movement_type, inventory_name, warehouse, unit, quantity, amount, inventory_item_id, direction, unit_cost, status, created_at) VALUES ('movement-overdraw', 'company-1', '2026-05', '2026-05-03', 'CK002', '销售出库', '测试商品', '主仓', '件', 7, 0, 'item-1', 'outbound', 0, '待确认', '2026-05-03 09:00:00')")
            .execute(db.pool())
            .await
            .expect("insert overdraw");
        let error = confirm_inventory_movement_for_company(
            "movement-overdraw".into(),
            "company-1".into(),
            "测试会计",
            &db,
        )
        .await
        .expect_err("negative stock must be rejected");
        assert!(error.contains("负库存"));
        let status: String = sqlx::query_scalar(
            "SELECT status FROM inventory_movements WHERE id = 'movement-overdraw'",
        )
        .fetch_one(db.pool())
        .await
        .expect("read rolled back movement status");
        assert_eq!(status, "待确认");

        db.pool().close().await;
        drop(db);
        std::fs::remove_dir_all(data_dir).expect("remove test data");
    }
}
