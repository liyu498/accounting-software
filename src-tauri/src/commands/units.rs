use crate::db::{
    CreateMeasurementUnitInput, Database, MeasurementUnit, UpdateMeasurementUnitInput,
};
use tauri::State;

fn optional_text(value: Option<&String>) -> Option<&str> {
    value
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

async fn unit_has_inventory_business(
    db: &Database,
    company_id: &str,
    unit_id: &str,
) -> Result<bool, String> {
    sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM inventory_items i
            WHERE i.company_id = ? AND i.unit_id = ? AND (
                EXISTS (SELECT 1 FROM inventory_movements m WHERE m.inventory_item_id = i.id)
                OR EXISTS (SELECT 1 FROM inventory_opening_balances o WHERE o.inventory_item_id = i.id)
                OR EXISTS (SELECT 1 FROM inventory_stocktake_lines s WHERE s.inventory_item_id = i.id)
            )
        )"#,
    )
    .bind(company_id)
    .bind(unit_id)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("检查计量单位历史业务失败: {error}"))
}
#[tauri::command]
pub async fn get_measurement_units(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<MeasurementUnit>, String> {
    sqlx::query_as("SELECT * FROM measurement_units WHERE company_id=? ORDER BY unit_name")
        .bind(company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("查询计量单位失败: {e}"))
}
#[tauri::command]
pub async fn create_measurement_unit(
    input: CreateMeasurementUnitInput,
    db: State<'_, Database>,
) -> Result<MeasurementUnit, String> {
    if input.unit_name.trim().is_empty()
        || input.conversion_rate <= 0.0
        || input.precision_digits < 0
    {
        return Err("单位名称不能为空，换算率必须大于零".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO measurement_units (id,company_id,unit_name,unit_group,base_unit,conversion_rate,precision_digits,remark) VALUES (?,?,?,?,?,?,?,?)").bind(&id).bind(&input.company_id).bind(input.unit_name.trim()).bind(optional_text(input.unit_group.as_ref())).bind(optional_text(input.base_unit.as_ref())).bind(input.conversion_rate).bind(input.precision_digits).bind(optional_text(input.remark.as_ref())).execute(db.pool()).await.map_err(|e|format!("新增计量单位失败: {e}"))?;
    sqlx::query_as("SELECT * FROM measurement_units WHERE id=?")
        .bind(id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询新增计量单位失败: {e}"))
}
#[tauri::command]
pub async fn update_measurement_unit(
    input: UpdateMeasurementUnitInput,
    db: State<'_, Database>,
) -> Result<MeasurementUnit, String> {
    update_measurement_unit_record(input, db.inner()).await
}

pub(crate) async fn update_measurement_unit_record(
    input: UpdateMeasurementUnitInput,
    db: &Database,
) -> Result<MeasurementUnit, String> {
    if input.id.trim().is_empty()
        || input.unit_name.trim().is_empty()
        || input.conversion_rate <= 0.0
        || input.precision_digits < 0
    {
        return Err("单位名称不能为空，换算率必须大于零".into());
    }
    let current: MeasurementUnit =
        sqlx::query_as("SELECT * FROM measurement_units WHERE id = ? AND company_id = ?")
            .bind(&input.id)
            .bind(&input.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询计量单位失败: {error}"))?
            .ok_or_else(|| "未找到当前账套计量单位".to_string())?;
    let semantic_definition_changed = current.unit_group.as_deref()
        != optional_text(input.unit_group.as_ref())
        || current.base_unit.as_deref() != optional_text(input.base_unit.as_ref())
        || (current.conversion_rate - input.conversion_rate).abs() > 0.00000001
        || current.precision_digits != input.precision_digits;
    if semantic_definition_changed
        && unit_has_inventory_business(db, &input.company_id, &input.id).await?
    {
        return Err(
            "已有库存业务引用该计量单位，不能修改单位组、基础单位、换算倍率或数量精度".into(),
        );
    }
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    let affected=sqlx::query("UPDATE measurement_units SET unit_name=?,unit_group=?,base_unit=?,conversion_rate=?,precision_digits=?,remark=?,updated_at=datetime('now') WHERE id=? AND company_id=?").bind(input.unit_name.trim()).bind(optional_text(input.unit_group.as_ref())).bind(optional_text(input.base_unit.as_ref())).bind(input.conversion_rate).bind(input.precision_digits).bind(optional_text(input.remark.as_ref())).bind(&input.id).bind(&input.company_id).execute(&mut *transaction).await.map_err(|e|format!("更新计量单位失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套计量单位".into());
    }
    sqlx::query("UPDATE inventory_items SET unit = ?, updated_at = datetime('now') WHERE company_id = ? AND unit_id = ?")
        .bind(input.unit_name.trim())
        .bind(&input.company_id)
        .bind(&input.id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("同步存货计量单位失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM measurement_units WHERE id=? AND company_id=?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("查询更新计量单位失败: {e}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}
