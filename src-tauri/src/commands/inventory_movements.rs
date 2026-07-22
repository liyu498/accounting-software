use crate::db::{CreateInventoryMovementInput, Database, InventoryMovement, UpdateInventoryMovementInput};
use tauri::State;

#[tauri::command]
pub async fn get_inventory_movements(company_id: String, period: String, db: State<'_, Database>) -> Result<Vec<InventoryMovement>, String> {
    sqlx::query_as("SELECT * FROM inventory_movements WHERE company_id = ? AND period = ? ORDER BY movement_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询出入库单失败: {error}"))
}

#[tauri::command]
pub async fn create_inventory_movement(input: CreateInventoryMovementInput, db: State<'_, Database>) -> Result<InventoryMovement, String> {
    if input.period.trim().is_empty() || input.movement_date.trim().is_empty() || input.bill_no.trim().is_empty() || input.movement_type.trim().is_empty() || input.inventory_name.trim().is_empty() || input.warehouse.trim().is_empty() || input.unit.trim().is_empty() || input.quantity <= 0.0 || input.amount < 0.0 {
        return Err("出入库单信息不完整，数量必须大于零且金额不能为负数".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO inventory_movements (id, company_id, period, movement_date, bill_no, movement_type, inventory_name, warehouse, counterparty, unit, quantity, amount, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&input.company_id).bind(input.period.trim()).bind(input.movement_date.trim()).bind(input.bill_no.trim()).bind(input.movement_type.trim()).bind(input.inventory_name.trim()).bind(input.warehouse.trim())
        .bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.unit.trim()).bind(input.quantity).bind(input.amount).bind(input.source_document.as_deref().map(str::trim).filter(|value| !value.is_empty()))
        .execute(db.pool()).await.map_err(|error| format!("新增出入库单失败: {error}"))?;
    sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?").bind(id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询新增出入库单失败: {error}"))
}

#[tauri::command]
pub async fn update_inventory_movement(input: UpdateInventoryMovementInput, db: State<'_, Database>) -> Result<InventoryMovement, String> {
    if input.id.trim().is_empty() || input.movement_date.trim().is_empty() || input.bill_no.trim().is_empty() || input.movement_type.trim().is_empty() || input.inventory_name.trim().is_empty() || input.warehouse.trim().is_empty() || input.unit.trim().is_empty() || input.quantity <= 0.0 || input.amount < 0.0 {
        return Err("出入库单信息不完整，数量必须大于零且金额不能为负数".to_string());
    }
    let affected = sqlx::query("UPDATE inventory_movements SET movement_date = ?, bill_no = ?, movement_type = ?, inventory_name = ?, warehouse = ?, counterparty = ?, unit = ?, quantity = ?, amount = ?, source_document = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND status != '已生成凭证'")
        .bind(input.movement_date.trim()).bind(input.bill_no.trim()).bind(input.movement_type.trim()).bind(input.inventory_name.trim()).bind(input.warehouse.trim()).bind(input.counterparty.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(input.unit.trim()).bind(input.quantity).bind(input.amount).bind(input.source_document.as_deref().map(str::trim).filter(|value| !value.is_empty())).bind(&input.id).bind(&input.company_id)
        .execute(db.pool()).await.map_err(|error| format!("更新出入库单失败: {error}"))?;
    if affected.rows_affected() == 0 { return Err("未找到可编辑的出入库单，已生成凭证的单据不可修改".to_string()); }
    sqlx::query_as("SELECT * FROM inventory_movements WHERE id = ? AND company_id = ?").bind(&input.id).bind(&input.company_id).fetch_one(db.pool()).await.map_err(|error| format!("查询更新出入库单失败: {error}"))
}
