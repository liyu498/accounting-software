use crate::commands::auth::authenticated_actor;
use crate::db::{
    CreateInventoryBomInput, CreateInventoryCategoryInput, CreateInventoryWarehouseInput, Database,
    InventoryBom, InventoryBomLine, InventoryBomLineInput, InventoryCategory, InventoryWarehouse,
    UpdateInventoryBomInput, UpdateInventoryCategoryInput, UpdateInventoryWarehouseInput,
};
use chrono::NaiveDate;
use sqlx::{Sqlite, Transaction};
use std::collections::{HashMap, HashSet};
use tauri::State;

fn optional_text(value: Option<&String>) -> Option<&str> {
    value
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn master_status(value: Option<&String>) -> Result<&str, String> {
    let status = optional_text(value).unwrap_or("启用");
    if !matches!(status, "启用" | "停用") {
        return Err("存货主数据状态只能为启用或停用".into());
    }
    Ok(status)
}

fn validate_category(
    code: &str,
    name: &str,
    inventory_subject: &str,
    cost_subject: &str,
) -> Result<(), String> {
    if code.trim().is_empty()
        || name.trim().is_empty()
        || inventory_subject.trim().is_empty()
        || cost_subject.trim().is_empty()
    {
        return Err("分类编码、名称、存货科目和成本科目不能为空".into());
    }
    Ok(())
}

fn validate_warehouse(code: &str, name: &str) -> Result<(), String> {
    if code.trim().is_empty() || name.trim().is_empty() {
        return Err("仓库编码和名称不能为空".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_inventory_categories(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryCategory>, String> {
    sqlx::query_as("SELECT * FROM inventory_categories WHERE company_id = ? ORDER BY category_code")
        .bind(company_id)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询存货分类失败: {error}"))
}

#[tauri::command]
pub async fn create_inventory_category(
    input: CreateInventoryCategoryInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryCategory, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_inventory_category_record(input, &actor, db.inner()).await
}

async fn create_inventory_category_record(
    input: CreateInventoryCategoryInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryCategory, String> {
    validate_category(
        &input.category_code,
        &input.category_name,
        &input.inventory_subject,
        &input.cost_subject,
    )?;
    let status = master_status(input.status.as_ref())?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    sqlx::query("INSERT INTO inventory_categories (id, company_id, category_code, category_name, inventory_subject, cost_subject, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&input.company_id)
        .bind(input.category_code.trim())
        .bind(input.category_name.trim())
        .bind(input.inventory_subject.trim())
        .bind(input.cost_subject.trim())
        .bind(status)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("新增存货分类失败: {error}"))?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '新增存货分类', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.category_code.trim())
        .bind(format!("分类名称={}; 状态={status}", input.category_name.trim()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入存货分类审计日志失败: {error}"))?;
    let record =
        sqlx::query_as("SELECT * FROM inventory_categories WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("查询新增存货分类失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}

#[tauri::command]
pub async fn update_inventory_category(
    input: UpdateInventoryCategoryInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryCategory, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    update_inventory_category_record(input, &actor, db.inner()).await
}

async fn update_inventory_category_record(
    input: UpdateInventoryCategoryInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryCategory, String> {
    validate_category(
        &input.category_code,
        &input.category_name,
        &input.inventory_subject,
        &input.cost_subject,
    )?;
    let status = master_status(Some(&input.status))?;
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    let affected = sqlx::query("UPDATE inventory_categories SET category_code = ?, category_name = ?, inventory_subject = ?, cost_subject = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.category_code.trim())
        .bind(input.category_name.trim())
        .bind(input.inventory_subject.trim())
        .bind(input.cost_subject.trim())
        .bind(status)
        .bind(&input.id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新存货分类失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套的存货分类".into());
    }
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '修改存货分类', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.category_code.trim())
        .bind(format!("分类名称={}; 状态={status}", input.category_name.trim()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入存货分类审计日志失败: {error}"))?;
    let record =
        sqlx::query_as("SELECT * FROM inventory_categories WHERE id = ? AND company_id = ?")
            .bind(&input.id)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("查询更新存货分类失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}

#[tauri::command]
pub async fn get_inventory_warehouses(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryWarehouse>, String> {
    sqlx::query_as(
        "SELECT * FROM inventory_warehouses WHERE company_id = ? ORDER BY warehouse_code",
    )
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询仓库档案失败: {error}"))
}

#[tauri::command]
pub async fn create_inventory_warehouse(
    input: CreateInventoryWarehouseInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryWarehouse, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_inventory_warehouse_record(input, &actor, db.inner()).await
}

async fn create_inventory_warehouse_record(
    input: CreateInventoryWarehouseInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryWarehouse, String> {
    validate_warehouse(&input.warehouse_code, &input.warehouse_name)?;
    let status = master_status(input.status.as_ref())?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    sqlx::query("INSERT INTO inventory_warehouses (id, company_id, warehouse_code, warehouse_name, location, manager, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&input.company_id)
        .bind(input.warehouse_code.trim())
        .bind(input.warehouse_name.trim())
        .bind(optional_text(input.location.as_ref()))
        .bind(optional_text(input.manager.as_ref()))
        .bind(status)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("新增仓库档案失败: {error}"))?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '新增仓库档案', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.warehouse_code.trim())
        .bind(format!("仓库名称={}; 状态={status}", input.warehouse_name.trim()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入仓库档案审计日志失败: {error}"))?;
    let record =
        sqlx::query_as("SELECT * FROM inventory_warehouses WHERE id = ? AND company_id = ?")
            .bind(&id)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("查询新增仓库失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}

#[tauri::command]
pub async fn update_inventory_warehouse(
    input: UpdateInventoryWarehouseInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryWarehouse, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    update_inventory_warehouse_record(input, &actor, db.inner()).await
}

async fn update_inventory_warehouse_record(
    input: UpdateInventoryWarehouseInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryWarehouse, String> {
    validate_warehouse(&input.warehouse_code, &input.warehouse_name)?;
    let status = master_status(Some(&input.status))?;
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    let affected = sqlx::query("UPDATE inventory_warehouses SET warehouse_code = ?, warehouse_name = ?, location = ?, manager = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?")
        .bind(input.warehouse_code.trim())
        .bind(input.warehouse_name.trim())
        .bind(optional_text(input.location.as_ref()))
        .bind(optional_text(input.manager.as_ref()))
        .bind(status)
        .bind(&input.id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新仓库档案失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套的仓库档案".into());
    }
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '修改仓库档案', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.warehouse_code.trim())
        .bind(format!("仓库名称={}; 状态={status}", input.warehouse_name.trim()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入仓库档案审计日志失败: {error}"))?;
    let record =
        sqlx::query_as("SELECT * FROM inventory_warehouses WHERE id = ? AND company_id = ?")
            .bind(&input.id)
            .bind(&input.company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("查询更新仓库失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}

#[derive(sqlx::FromRow)]
struct InventoryBomHeader {
    id: String,
    company_id: String,
    bom_code: String,
    bom_name: String,
    version: String,
    parent_item_id: String,
    parent_item_code: String,
    parent_item_name: String,
    parent_specification: Option<String>,
    parent_unit: String,
    effective_date: String,
    expiration_date: Option<String>,
    status: String,
    note: Option<String>,
    created_by: String,
    updated_by: String,
    created_at: String,
    updated_at: String,
}

async fn get_inventory_bom_lines(
    bom_id: &str,
    company_id: &str,
    db: &Database,
) -> Result<Vec<InventoryBomLine>, String> {
    sqlx::query_as(
        r#"SELECT line.id, line.bom_id, line.company_id, line.component_item_id,
                  item.item_code AS component_item_code,
                  item.item_name AS component_item_name,
                  item.specification AS component_specification,
                  item.unit AS component_unit,
                  line.quantity, line.loss_rate, line.sort_order, line.note,
                  line.created_at, line.updated_at
           FROM inventory_bom_items line
           INNER JOIN inventory_items item
             ON item.id = line.component_item_id AND item.company_id = line.company_id
           WHERE line.bom_id = ? AND line.company_id = ?
           ORDER BY line.sort_order, line.created_at, line.id"#,
    )
    .bind(bom_id)
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询物料清单组件失败: {error}"))
}

async fn inventory_bom_from_header(
    header: InventoryBomHeader,
    db: &Database,
) -> Result<InventoryBom, String> {
    let lines = get_inventory_bom_lines(&header.id, &header.company_id, db).await?;
    Ok(InventoryBom {
        id: header.id,
        company_id: header.company_id,
        bom_code: header.bom_code,
        bom_name: header.bom_name,
        version: header.version,
        parent_item_id: header.parent_item_id,
        parent_item_code: header.parent_item_code,
        parent_item_name: header.parent_item_name,
        parent_specification: header.parent_specification,
        parent_unit: header.parent_unit,
        effective_date: header.effective_date,
        expiration_date: header.expiration_date,
        status: header.status,
        note: header.note,
        created_by: header.created_by,
        updated_by: header.updated_by,
        created_at: header.created_at,
        updated_at: header.updated_at,
        lines,
    })
}

async fn get_inventory_bom_record(
    id: &str,
    company_id: &str,
    db: &Database,
) -> Result<InventoryBom, String> {
    let header = sqlx::query_as::<_, InventoryBomHeader>(
        r#"SELECT bom.id, bom.company_id, bom.bom_code, bom.bom_name, bom.version,
                  bom.parent_item_id, item.item_code AS parent_item_code,
                  item.item_name AS parent_item_name,
                  item.specification AS parent_specification,
                  item.unit AS parent_unit,
                  bom.effective_date, bom.expiration_date, bom.status, bom.note,
                  bom.created_by, bom.updated_by, bom.created_at, bom.updated_at
           FROM inventory_boms bom
           INNER JOIN inventory_items item
             ON item.id = bom.parent_item_id AND item.company_id = bom.company_id
           WHERE bom.id = ? AND bom.company_id = ?"#,
    )
    .bind(id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询物料清单失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的物料清单".to_string())?;
    inventory_bom_from_header(header, db).await
}

async fn get_inventory_bom_records(
    company_id: &str,
    db: &Database,
) -> Result<Vec<InventoryBom>, String> {
    let headers = sqlx::query_as::<_, InventoryBomHeader>(
        r#"SELECT bom.id, bom.company_id, bom.bom_code, bom.bom_name, bom.version,
                  bom.parent_item_id, item.item_code AS parent_item_code,
                  item.item_name AS parent_item_name,
                  item.specification AS parent_specification,
                  item.unit AS parent_unit,
                  bom.effective_date, bom.expiration_date, bom.status, bom.note,
                  bom.created_by, bom.updated_by, bom.created_at, bom.updated_at
           FROM inventory_boms bom
           INNER JOIN inventory_items item
             ON item.id = bom.parent_item_id AND item.company_id = bom.company_id
           WHERE bom.company_id = ?
           ORDER BY bom.bom_code, bom.version, bom.created_at"#,
    )
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询物料清单失败: {error}"))?;
    let mut records = Vec::with_capacity(headers.len());
    for header in headers {
        records.push(inventory_bom_from_header(header, db).await?);
    }
    Ok(records)
}

fn visit_bom_graph(
    item_id: &str,
    graph: &HashMap<String, Vec<String>>,
    visiting: &mut HashSet<String>,
    visited: &mut HashSet<String>,
) -> Result<(), String> {
    if visiting.contains(item_id) {
        return Err("物料清单不能形成循环引用".into());
    }
    if visited.contains(item_id) {
        return Ok(());
    }
    visiting.insert(item_id.to_string());
    if let Some(components) = graph.get(item_id) {
        for component in components {
            visit_bom_graph(component, graph, visiting, visited)?;
        }
    }
    visiting.remove(item_id);
    visited.insert(item_id.to_string());
    Ok(())
}

async fn validate_inventory_bom(
    company_id: &str,
    current_id: Option<&str>,
    bom_code: &str,
    bom_name: &str,
    version: &str,
    parent_item_id: &str,
    effective_date: &str,
    expiration_date: Option<&String>,
    status: &str,
    lines: &[InventoryBomLineInput],
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<(), String> {
    if bom_code.trim().is_empty()
        || bom_name.trim().is_empty()
        || version.trim().is_empty()
        || parent_item_id.trim().is_empty()
        || effective_date.trim().is_empty()
    {
        return Err("BOM 编码、名称、版本、成品和生效日期不能为空".into());
    }
    if !matches!(status, "启用" | "停用") {
        return Err("物料清单状态只能为启用或停用".into());
    }
    let effective = NaiveDate::parse_from_str(effective_date.trim(), "%Y-%m-%d")
        .map_err(|_| "生效日期格式无效".to_string())?;
    if let Some(expiration_date) = optional_text(expiration_date) {
        let expiration = NaiveDate::parse_from_str(expiration_date, "%Y-%m-%d")
            .map_err(|_| "失效日期格式无效".to_string())?;
        if expiration < effective {
            return Err("失效日期不能早于生效日期".into());
        }
    }
    if lines.is_empty() {
        return Err("物料清单至少需要一个组件".into());
    }

    let parent_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM inventory_items WHERE id = ? AND company_id = ?")
            .bind(parent_item_id.trim())
            .bind(company_id)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(|error| format!("查询 BOM 成品失败: {error}"))?;
    let Some(parent_status) = parent_status else {
        return Err("成品不属于当前账套".into());
    };
    if status == "启用" && parent_status != "启用" {
        return Err("启用的物料清单必须引用已启用的成品".into());
    }

    let mut component_ids = HashSet::new();
    for line in lines {
        let component_id = line.component_item_id.trim();
        if component_id == parent_item_id.trim() {
            return Err("物料清单不能引用自身".into());
        }
        if !component_ids.insert(component_id.to_string()) {
            return Err("同一组件不能重复".into());
        }
        if !line.quantity.is_finite() || line.quantity <= 0.0 {
            return Err("组件数量必须大于零".into());
        }
        if !line.loss_rate.is_finite() || !(0.0..1.0).contains(&line.loss_rate) {
            return Err("损耗率必须在 0% 至 100% 之间".into());
        }
        let component_status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM inventory_items WHERE id = ? AND company_id = ?",
        )
        .bind(component_id)
        .bind(company_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|error| format!("查询 BOM 组件失败: {error}"))?;
        let Some(component_status) = component_status else {
            return Err("BOM 组件不属于当前账套".into());
        };
        if status == "启用" && component_status != "启用" {
            return Err("启用的物料清单只能引用已启用的组件".into());
        }
    }

    if status == "启用" {
        let existing_edges: Vec<(String, String)> = sqlx::query_as(
            r#"SELECT bom.parent_item_id, line.component_item_id
               FROM inventory_boms bom
               INNER JOIN inventory_bom_items line ON line.bom_id = bom.id
               WHERE bom.company_id = ? AND bom.status = '启用'
                 AND (? IS NULL OR bom.id <> ?)"#,
        )
        .bind(company_id)
        .bind(current_id)
        .bind(current_id)
        .fetch_all(&mut **transaction)
        .await
        .map_err(|error| format!("检查物料清单引用关系失败: {error}"))?;
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        for (parent, component) in existing_edges {
            graph.entry(parent).or_default().push(component);
        }
        graph.insert(
            parent_item_id.trim().to_string(),
            component_ids.into_iter().collect(),
        );
        let mut visiting = HashSet::new();
        let mut visited = HashSet::new();
        for item_id in graph.keys() {
            visit_bom_graph(item_id, &graph, &mut visiting, &mut visited)?;
        }
    }
    Ok(())
}

async fn insert_inventory_bom_lines(
    bom_id: &str,
    company_id: &str,
    lines: &[InventoryBomLineInput],
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<(), String> {
    for (index, line) in lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO inventory_bom_items
               (id, bom_id, company_id, component_item_id, quantity, loss_rate, sort_order, note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(bom_id)
        .bind(company_id)
        .bind(line.component_item_id.trim())
        .bind(line.quantity)
        .bind(line.loss_rate)
        .bind(i64::try_from(index + 1).unwrap_or(i64::MAX))
        .bind(optional_text(line.note.as_ref()))
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("保存物料清单组件失败: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_inventory_boms(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<InventoryBom>, String> {
    get_inventory_bom_records(&company_id, db.inner()).await
}

#[tauri::command]
pub async fn create_inventory_bom(
    input: CreateInventoryBomInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryBom, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    create_inventory_bom_record(input, &actor, db.inner()).await
}

async fn create_inventory_bom_record(
    input: CreateInventoryBomInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryBom, String> {
    let status = master_status(input.status.as_ref())?.to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    validate_inventory_bom(
        &input.company_id,
        None,
        &input.bom_code,
        &input.bom_name,
        &input.version,
        &input.parent_item_id,
        &input.effective_date,
        input.expiration_date.as_ref(),
        &status,
        &input.lines,
        &mut transaction,
    )
    .await?;
    sqlx::query(
        r#"INSERT INTO inventory_boms
           (id, company_id, bom_code, bom_name, version, parent_item_id,
            effective_date, expiration_date, status, note, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.bom_code.trim())
    .bind(input.bom_name.trim())
    .bind(input.version.trim())
    .bind(input.parent_item_id.trim())
    .bind(input.effective_date.trim())
    .bind(optional_text(input.expiration_date.as_ref()))
    .bind(&status)
    .bind(optional_text(input.note.as_ref()))
    .bind(actor)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        if error.to_string().contains("UNIQUE") {
            "同一账套内 BOM 编码或成品版本不能重复".to_string()
        } else {
            format!("新增物料清单失败: {error}")
        }
    })?;
    insert_inventory_bom_lines(&id, &input.company_id, &input.lines, &mut transaction).await?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '新增物料清单', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.bom_code.trim())
        .bind(format!("名称={}; 版本={}; 组件={}项; 状态={status}", input.bom_name.trim(), input.version.trim(), input.lines.len()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入物料清单审计日志失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    get_inventory_bom_record(&id, &input.company_id, db).await
}

#[tauri::command]
pub async fn update_inventory_bom(
    input: UpdateInventoryBomInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<InventoryBom, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    update_inventory_bom_record(input, &actor, db.inner()).await
}

async fn update_inventory_bom_record(
    input: UpdateInventoryBomInput,
    actor: &str,
    db: &Database,
) -> Result<InventoryBom, String> {
    let status = master_status(Some(&input.status))?.to_string();
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    validate_inventory_bom(
        &input.company_id,
        Some(&input.id),
        &input.bom_code,
        &input.bom_name,
        &input.version,
        &input.parent_item_id,
        &input.effective_date,
        input.expiration_date.as_ref(),
        &status,
        &input.lines,
        &mut transaction,
    )
    .await?;
    let affected = sqlx::query(
        r#"UPDATE inventory_boms
           SET bom_code = ?, bom_name = ?, version = ?, parent_item_id = ?,
               effective_date = ?, expiration_date = ?, status = ?, note = ?,
               updated_by = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(input.bom_code.trim())
    .bind(input.bom_name.trim())
    .bind(input.version.trim())
    .bind(input.parent_item_id.trim())
    .bind(input.effective_date.trim())
    .bind(optional_text(input.expiration_date.as_ref()))
    .bind(&status)
    .bind(optional_text(input.note.as_ref()))
    .bind(actor)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        if error.to_string().contains("UNIQUE") {
            "同一账套内 BOM 编码或成品版本不能重复".to_string()
        } else {
            format!("更新物料清单失败: {error}")
        }
    })?;
    if affected.rows_affected() == 0 {
        return Err("未找到当前账套的物料清单".into());
    }
    sqlx::query("DELETE FROM inventory_bom_items WHERE bom_id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新物料清单组件失败: {error}"))?;
    insert_inventory_bom_lines(&input.id, &input.company_id, &input.lines, &mut transaction)
        .await?;
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '修改物料清单', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&input.company_id)
        .bind(input.bom_code.trim())
        .bind(format!("名称={}; 版本={}; 组件={}项; 状态={status}", input.bom_name.trim(), input.version.trim(), input.lines.len()))
        .bind(actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入物料清单审计日志失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    get_inventory_bom_record(&input.id, &input.company_id, db).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_data_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "accounting-inventory-master-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ))
    }

    #[tokio::test]
    async fn master_data_is_company_scoped_and_audited() {
        let data_dir = test_data_dir();
        let db = Database::new(data_dir.clone())
            .await
            .expect("create database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '存货账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");

        let category = create_inventory_category_record(
            CreateInventoryCategoryInput {
                company_id: "company-1".into(),
                category_code: "SP".into(),
                category_name: "商品".into(),
                inventory_subject: "库存商品".into(),
                cost_subject: "主营业务成本".into(),
                status: None,
            },
            "测试会计",
            &db,
        )
        .await
        .expect("create category");
        assert_eq!(category.status, "启用");

        let warehouse = create_inventory_warehouse_record(
            CreateInventoryWarehouseInput {
                company_id: "company-1".into(),
                warehouse_code: "MAIN".into(),
                warehouse_name: "主仓".into(),
                location: Some("一层".into()),
                manager: Some("张三".into()),
                status: None,
            },
            "测试会计",
            &db,
        )
        .await
        .expect("create warehouse");
        assert_eq!(warehouse.warehouse_name, "主仓");

        let audit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM operation_audit_logs WHERE company_id = 'company-1' AND operator = '测试会计' AND action IN ('新增存货分类', '新增仓库档案')")
            .fetch_one(db.pool()).await.expect("count audits");
        assert_eq!(audit_count, 2);

        db.pool().close().await;
        drop(db);
        std::fs::remove_dir_all(data_dir).expect("remove test data");
    }

    #[tokio::test]
    async fn inventory_boms_persist_versioned_lines_and_reject_cycles() {
        let data_dir = test_data_dir();
        let db = Database::new(data_dir.clone())
            .await
            .expect("create database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '生产账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        for (id, code, name) in [
            ("finished", "CP001", "成品"),
            ("component-a", "CL001", "材料 A"),
            ("component-b", "CL002", "材料 B"),
        ] {
            sqlx::query("INSERT INTO inventory_items (id, company_id, item_code, item_name, unit) VALUES (?, 'company-1', ?, ?, '件')")
                .bind(id)
                .bind(code)
                .bind(name)
                .execute(db.pool())
                .await
                .expect("insert inventory item");
        }

        let first = create_inventory_bom_record(
            CreateInventoryBomInput {
                company_id: "company-1".into(),
                bom_code: "BOM-001".into(),
                bom_name: "成品标准物料清单".into(),
                version: "V1".into(),
                parent_item_id: "finished".into(),
                effective_date: "2026-01-01".into(),
                expiration_date: None,
                status: Some("启用".into()),
                note: Some("生产领料基础".into()),
                lines: vec![InventoryBomLineInput {
                    component_item_id: "component-a".into(),
                    quantity: 2.5,
                    loss_rate: 0.03,
                    sort_order: 1,
                    note: Some("主材".into()),
                }],
            },
            "测试会计",
            &db,
        )
        .await
        .expect("create first BOM");
        assert_eq!(first.lines.len(), 1);
        assert_eq!(first.lines[0].component_item_code, "CL001");
        assert_eq!(first.lines[0].quantity, 2.5);

        create_inventory_bom_record(
            CreateInventoryBomInput {
                company_id: "company-1".into(),
                bom_code: "BOM-002".into(),
                bom_name: "材料 A 下级结构".into(),
                version: "V1".into(),
                parent_item_id: "component-a".into(),
                effective_date: "2026-01-01".into(),
                expiration_date: None,
                status: Some("启用".into()),
                note: None,
                lines: vec![InventoryBomLineInput {
                    component_item_id: "component-b".into(),
                    quantity: 1.0,
                    loss_rate: 0.0,
                    sort_order: 1,
                    note: None,
                }],
            },
            "测试会计",
            &db,
        )
        .await
        .expect("create second BOM");

        let cycle_error = create_inventory_bom_record(
            CreateInventoryBomInput {
                company_id: "company-1".into(),
                bom_code: "BOM-003".into(),
                bom_name: "非法循环结构".into(),
                version: "V1".into(),
                parent_item_id: "component-b".into(),
                effective_date: "2026-01-01".into(),
                expiration_date: None,
                status: Some("启用".into()),
                note: None,
                lines: vec![InventoryBomLineInput {
                    component_item_id: "finished".into(),
                    quantity: 1.0,
                    loss_rate: 0.0,
                    sort_order: 1,
                    note: None,
                }],
            },
            "测试会计",
            &db,
        )
        .await
        .expect_err("cycle must be rejected");
        assert!(cycle_error.contains("循环引用"));

        let records = get_inventory_bom_records("company-1", &db)
            .await
            .expect("list BOMs");
        assert_eq!(records.len(), 2);
        let audit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM operation_audit_logs WHERE company_id = 'company-1' AND action = '新增物料清单'")
            .fetch_one(db.pool())
            .await
            .expect("count BOM audits");
        assert_eq!(audit_count, 2);

        db.pool().close().await;
        drop(db);
        std::fs::remove_dir_all(data_dir).expect("remove test data");
    }
}
