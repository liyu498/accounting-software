use crate::db::{CreateInventoryItemInput, Database, InventoryItem, UpdateInventoryItemInput};
use tauri::State;

const INVENTORY_ITEM_COLUMNS: &str = "id, company_id, item_code, item_name, specification, unit, unit_id, tax_rate, default_subject, category, category_id, valuation_method, inventory_subject, cost_subject, safety_stock, status, created_at, updated_at";

fn optional_text(value: Option<&String>) -> Option<&str> {
    value
        .map(String::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
}

fn valuation_method(value: Option<&String>) -> Result<&str, String> {
    let method = optional_text(value).unwrap_or("移动加权");
    if method != "移动加权" {
        return Err("当前版本仅支持移动加权计价，不能选择未实现的计价方法".into());
    }
    Ok(method)
}

async fn inventory_category_for_item(
    db: &Database,
    company_id: &str,
    category_id: Option<&String>,
) -> Result<Option<(String, String, String)>, String> {
    let Some(category_id) = optional_text(category_id) else {
        return Ok(None);
    };
    let category: (String, String, String, String) = sqlx::query_as(
        "SELECT category_name, inventory_subject, cost_subject, status FROM inventory_categories WHERE id = ? AND company_id = ?",
    )
    .bind(category_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询存货分类失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的存货分类".to_string())?;
    if category.3 != "启用" {
        return Err("停用的存货分类不能用于存货档案".into());
    }
    Ok(Some((category.0, category.1, category.2)))
}

async fn inventory_unit_for_item(
    db: &Database,
    company_id: &str,
    unit_id: &str,
) -> Result<String, String> {
    let unit_id = unit_id.trim();
    if unit_id.is_empty() {
        return Err("请选择计量单位".into());
    }
    let unit: (String, String) = sqlx::query_as(
        "SELECT unit_name, status FROM measurement_units WHERE id = ? AND company_id = ?",
    )
    .bind(unit_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询计量单位失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的计量单位".to_string())?;
    if unit.1 != "启用" {
        return Err("停用的计量单位不能用于存货档案".into());
    }
    Ok(unit.0)
}

async fn inventory_item_has_business(db: &Database, item_id: &str) -> Result<bool, String> {
    sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM inventory_movements WHERE inventory_item_id = ?
            UNION ALL
            SELECT 1 FROM inventory_opening_balances WHERE inventory_item_id = ?
            UNION ALL
            SELECT 1 FROM inventory_stocktake_lines WHERE inventory_item_id = ?
        )"#,
    )
    .bind(item_id)
    .bind(item_id)
    .bind(item_id)
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("检查存货历史业务失败: {error}"))
}
#[tauri::command]
pub async fn get_inventory_items(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryItem>, String> {
    let query = format!(
        "SELECT {INVENTORY_ITEM_COLUMNS} FROM inventory_items WHERE company_id = ? ORDER BY item_code"
    );
    sqlx::query_as(&query)
        .bind(company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询存货档案失败: {error}"))
}
#[tauri::command]
pub async fn create_inventory_item(
    input: CreateInventoryItemInput,
    db: State<'_, Database>,
) -> Result<InventoryItem, String> {
    create_inventory_item_record(input, db.inner()).await
}

pub(crate) async fn create_inventory_item_record(
    input: CreateInventoryItemInput,
    db: &Database,
) -> Result<InventoryItem, String> {
    if input.item_code.trim().is_empty()
        || input.item_name.trim().is_empty()
        || input
            .tax_rate
            .is_some_and(|rate| !(0.0..=1.0).contains(&rate))
        || input.safety_stock.is_some_and(|value| value < 0.0)
    {
        return Err(
            "存货编码和名称不能为空，税率应在 0% 至 100% 之间，安全库存不得为负数".to_string(),
        );
    }
    let unit_name = inventory_unit_for_item(db, &input.company_id, &input.unit_id).await?;
    let valuation_method = valuation_method(input.valuation_method.as_ref())?;
    let category =
        inventory_category_for_item(db, &input.company_id, input.category_id.as_ref()).await?;
    let category_name = category.as_ref().map(|value| value.0.as_str());
    let inventory_subject = input
        .inventory_subject
        .as_ref()
        .and_then(|value| optional_text(Some(value)))
        .or_else(|| category.as_ref().map(|value| value.1.as_str()))
        .unwrap_or("库存商品");
    let cost_subject = input
        .cost_subject
        .as_ref()
        .and_then(|value| optional_text(Some(value)))
        .or_else(|| category.as_ref().map(|value| value.2.as_str()))
        .unwrap_or("主营业务成本");
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO inventory_items (id, company_id, item_code, item_name, specification, unit, unit_id, tax_rate, default_subject, category, category_id, valuation_method, inventory_subject, cost_subject, safety_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&input.company_id)
        .bind(input.item_code.trim())
        .bind(input.item_name.trim())
        .bind(optional_text(input.specification.as_ref()))
        .bind(unit_name)
        .bind(input.unit_id.trim())
        .bind(input.tax_rate)
        .bind(optional_text(input.default_subject.as_ref()))
        .bind(category_name)
        .bind(optional_text(input.category_id.as_ref()))
        .bind(valuation_method)
        .bind(inventory_subject)
        .bind(cost_subject)
        .bind(input.safety_stock.unwrap_or(0.0))
        .execute(db.pool()).await.map_err(|error| format!("新增存货失败: {error}"))?;
    let query = format!(
        "SELECT {INVENTORY_ITEM_COLUMNS} FROM inventory_items WHERE id = ? AND company_id = ?"
    );
    sqlx::query_as(&query)
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增存货失败: {error}"))
}
#[tauri::command]
pub async fn update_inventory_item(
    input: UpdateInventoryItemInput,
    db: State<'_, Database>,
) -> Result<InventoryItem, String> {
    update_inventory_item_record(input, db.inner()).await
}

pub(crate) async fn update_inventory_item_record(
    input: UpdateInventoryItemInput,
    db: &Database,
) -> Result<InventoryItem, String> {
    if input.id.trim().is_empty()
        || input.item_code.trim().is_empty()
        || input.item_name.trim().is_empty()
        || input
            .tax_rate
            .is_some_and(|rate| !(0.0..=1.0).contains(&rate))
        || input.safety_stock.is_some_and(|value| value < 0.0)
    {
        return Err(
            "存货编码和名称不能为空，税率应在 0% 至 100% 之间，安全库存不得为负数".to_string(),
        );
    }
    let unit_name = inventory_unit_for_item(db, &input.company_id, &input.unit_id).await?;
    let current_unit_id = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT unit_id FROM inventory_items WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询存货档案失败: {error}"))?
    .ok_or_else(|| "未找到当前账套存货档案".to_string())?
    .0;
    if current_unit_id.as_deref() != Some(input.unit_id.trim())
        && inventory_item_has_business(db, &input.id).await?
    {
        return Err("已有库存业务的存货不能更换计量单位".into());
    }
    let valuation_method = valuation_method(input.valuation_method.as_ref())?;
    let category =
        inventory_category_for_item(db, &input.company_id, input.category_id.as_ref()).await?;
    let category_name = category.as_ref().map(|value| value.0.as_str());
    let inventory_subject = input
        .inventory_subject
        .as_ref()
        .and_then(|value| optional_text(Some(value)))
        .or_else(|| category.as_ref().map(|value| value.1.as_str()))
        .unwrap_or("库存商品");
    let cost_subject = input
        .cost_subject
        .as_ref()
        .and_then(|value| optional_text(Some(value)))
        .or_else(|| category.as_ref().map(|value| value.2.as_str()))
        .unwrap_or("主营业务成本");
    let affected=sqlx::query("UPDATE inventory_items SET item_code=?, item_name=?, specification=?, unit=?, unit_id=?, tax_rate=?, default_subject=?, category=?, category_id=?, valuation_method=?, inventory_subject=?, cost_subject=?, safety_stock=?, updated_at=datetime('now') WHERE id=? AND company_id=?")
        .bind(input.item_code.trim())
        .bind(input.item_name.trim())
        .bind(optional_text(input.specification.as_ref()))
        .bind(unit_name)
        .bind(input.unit_id.trim())
        .bind(input.tax_rate)
        .bind(optional_text(input.default_subject.as_ref()))
        .bind(category_name)
        .bind(optional_text(input.category_id.as_ref()))
        .bind(valuation_method)
        .bind(inventory_subject)
        .bind(cost_subject)
        .bind(input.safety_stock.unwrap_or(0.0))
        .bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|e|format!("更新存货失败: {e}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套存货档案".into());
    }
    let query =
        format!("SELECT {INVENTORY_ITEM_COLUMNS} FROM inventory_items WHERE id=? AND company_id=?");
    sqlx::query_as(&query)
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("查询更新存货失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::units::update_measurement_unit_record;
    use crate::db::UpdateMeasurementUnitInput;

    fn item_update(id: &str, unit_id: &str) -> UpdateInventoryItemInput {
        UpdateInventoryItemInput {
            id: id.into(),
            company_id: "company-1".into(),
            item_code: "ITEM001".into(),
            item_name: "测试商品".into(),
            specification: None,
            unit_id: unit_id.into(),
            tax_rate: Some(0.13),
            default_subject: None,
            category_id: None,
            valuation_method: Some("移动加权".into()),
            inventory_subject: Some("库存商品".into()),
            cost_subject: Some("主营业务成本".into()),
            safety_stock: Some(0.0),
        }
    }

    #[tokio::test]
    async fn structured_unit_changes_respect_inventory_history() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-inventory-unit-{}",
            uuid::Uuid::new_v4()
        ));
        let db = Database::new(data_dir.clone())
            .await
            .expect("create inventory unit test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '单位测试账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        sqlx::query(
            r#"INSERT INTO measurement_units
               (id, company_id, unit_name, unit_group, base_unit, conversion_rate, precision_digits)
               VALUES ('unit-piece', 'company-1', '个', '数量', '个', 1, 0),
                      ('unit-box', 'company-1', '箱', '数量', '个', 10, 0)"#,
        )
        .execute(db.pool())
        .await
        .expect("insert measurement units");

        let item = create_inventory_item_record(
            CreateInventoryItemInput {
                company_id: "company-1".into(),
                item_code: "ITEM001".into(),
                item_name: "测试商品".into(),
                specification: None,
                unit_id: "unit-piece".into(),
                tax_rate: Some(0.13),
                default_subject: None,
                category_id: None,
                valuation_method: Some("移动加权".into()),
                inventory_subject: Some("库存商品".into()),
                cost_subject: Some("主营业务成本".into()),
                safety_stock: Some(0.0),
            },
            &db,
        )
        .await
        .expect("create inventory item with structured unit");
        assert_eq!(item.unit_id.as_deref(), Some("unit-piece"));
        assert_eq!(item.unit, "个");

        let item = update_inventory_item_record(item_update(&item.id, "unit-box"), &db)
            .await
            .expect("unused inventory item may change unit");
        assert_eq!(item.unit_id.as_deref(), Some("unit-box"));
        assert_eq!(item.unit, "箱");

        sqlx::query(
            r#"INSERT INTO inventory_movements
               (id, company_id, period, movement_date, bill_no, movement_type,
                inventory_name, warehouse, unit, quantity, amount, inventory_item_id,
                direction, unit_cost, status)
               VALUES ('movement-1', 'company-1', '2026-05', '2026-05-01', 'RK001',
                       '采购入库', '测试商品', '主仓', '箱', 2, 200, ?, 'inbound', 100, '待确认')"#,
        )
        .bind(&item.id)
        .execute(db.pool())
        .await
        .expect("insert inventory business");

        let change_error = update_inventory_item_record(item_update(&item.id, "unit-piece"), &db)
            .await
            .expect_err("used inventory item cannot change unit");
        assert!(change_error.contains("已有库存业务"));

        let renamed = update_measurement_unit_record(
            UpdateMeasurementUnitInput {
                id: "unit-box".into(),
                company_id: "company-1".into(),
                unit_name: "标准箱".into(),
                unit_group: Some("数量".into()),
                base_unit: Some("个".into()),
                conversion_rate: 10.0,
                precision_digits: 0,
                remark: None,
            },
            &db,
        )
        .await
        .expect("renaming unit keeps quantity semantics");
        assert_eq!(renamed.unit_name, "标准箱");
        let item_unit: String = sqlx::query_scalar("SELECT unit FROM inventory_items WHERE id = ?")
            .bind(&item.id)
            .fetch_one(db.pool())
            .await
            .expect("read synchronized inventory unit");
        assert_eq!(item_unit, "标准箱");

        let definition_error = update_measurement_unit_record(
            UpdateMeasurementUnitInput {
                id: "unit-box".into(),
                company_id: "company-1".into(),
                unit_name: "标准箱".into(),
                unit_group: Some("数量".into()),
                base_unit: Some("个".into()),
                conversion_rate: 12.0,
                precision_digits: 0,
                remark: None,
            },
            &db,
        )
        .await
        .expect_err("used unit cannot change conversion semantics");
        assert!(definition_error.contains("已有库存业务"));

        drop(db);
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
