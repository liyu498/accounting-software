use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{BusinessOrder, CreateBusinessOrderInput, Database, UpdateBusinessOrderInput};
use tauri::State;

fn validate_order(
    order_type: &str,
    order_no: &str,
    business_date: &str,
    counterparty: &str,
    goods_name: &str,
    amount: f64,
) -> Result<(), String> {
    if !matches!(order_type, "purchase" | "sales") {
        return Err("订单类型必须为采购或销售".to_string());
    }
    if order_no.trim().is_empty()
        || business_date.trim().is_empty()
        || counterparty.trim().is_empty()
        || goods_name.trim().is_empty()
        || amount <= 0.0
    {
        return Err("订单编号、业务日期、往来单位、商品服务不能为空且金额必须大于零".to_string());
    }
    Ok(())
}

fn optional_text(value: Option<&String>) -> Option<&str> {
    value
        .map(String::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
}

#[tauri::command]
pub async fn get_business_orders(
    company_id: String,
    period: String,
    order_type: String,
    db: State<'_, Database>,
) -> Result<Vec<BusinessOrder>, String> {
    if !matches!(order_type.as_str(), "purchase" | "sales") {
        return Err("订单类型必须为采购或销售".to_string());
    }
    sqlx::query_as("SELECT * FROM business_orders WHERE company_id = ? AND period = ? AND order_type = ? ORDER BY business_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .bind(order_type)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询业务订单失败: {error}"))
}

#[tauri::command]
pub async fn create_business_order(
    input: CreateBusinessOrderInput,
    db: State<'_, Database>,
) -> Result<BusinessOrder, String> {
    validate_order(
        &input.order_type,
        &input.order_no,
        &input.business_date,
        &input.counterparty,
        &input.goods_name,
        input.amount,
    )?;
    if input.period.trim().is_empty() || input.company_id.trim().is_empty() {
        return Err("账套和账期不能为空".to_string());
    }
    ensure_period_label_open(db.pool(), &input.company_id, &input.period, "新增业务订单").await?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO business_orders (id, company_id, period, order_type, order_no, business_date, counterparty, goods_name, amount, fulfillment_status, invoice_status, settlement_status, status, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(input.company_id.trim()).bind(input.period.trim()).bind(input.order_type.trim()).bind(input.order_no.trim()).bind(input.business_date.trim()).bind(input.counterparty.trim()).bind(input.goods_name.trim()).bind(input.amount)
        .bind(optional_text(input.fulfillment_status.as_ref()).unwrap_or("待确认"))
        .bind(optional_text(input.invoice_status.as_ref()).unwrap_or("待开票"))
        .bind(optional_text(input.settlement_status.as_ref()).unwrap_or("未结算"))
        .bind(optional_text(input.status.as_ref()).unwrap_or("待确认"))
        .bind(optional_text(input.source_document.as_ref()))
        .execute(db.pool()).await.map_err(|error| format!("新增业务订单失败: {error}"))?;
    sqlx::query_as("SELECT * FROM business_orders WHERE id = ?")
        .bind(id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询新增业务订单失败: {error}"))
}

#[tauri::command]
pub async fn update_business_order(
    input: UpdateBusinessOrderInput,
    db: State<'_, Database>,
) -> Result<BusinessOrder, String> {
    if input.id.trim().is_empty() {
        return Err("订单标识不能为空".to_string());
    }
    let order: Option<(String, String)> = sqlx::query_as(
        "SELECT order_type, period FROM business_orders WHERE id = ? AND company_id = ?",
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("查询业务订单失败: {error}"))?;
    let (order_type, period) = order.ok_or_else(|| "未找到当前账套的业务订单".to_string())?;
    ensure_period_label_open(db.pool(), &input.company_id, &period, "修改业务订单").await?;
    validate_order(
        &order_type,
        &input.order_no,
        &input.business_date,
        &input.counterparty,
        &input.goods_name,
        input.amount,
    )?;
    let affected = sqlx::query("UPDATE business_orders SET order_no = ?, business_date = ?, counterparty = ?, goods_name = ?, amount = ?, fulfillment_status = ?, invoice_status = ?, settlement_status = ?, status = ?, source_document = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ? AND voucher_id IS NULL AND status != '已生成凭证'")
        .bind(input.order_no.trim()).bind(input.business_date.trim()).bind(input.counterparty.trim()).bind(input.goods_name.trim()).bind(input.amount)
        .bind(optional_text(input.fulfillment_status.as_ref()).unwrap_or("待确认"))
        .bind(optional_text(input.invoice_status.as_ref()).unwrap_or("待开票"))
        .bind(optional_text(input.settlement_status.as_ref()).unwrap_or("未结算"))
        .bind(optional_text(input.status.as_ref()).unwrap_or("待确认"))
        .bind(optional_text(input.source_document.as_ref()))
        .bind(&input.id).bind(&input.company_id).execute(db.pool()).await.map_err(|error| format!("更新业务订单失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到可编辑的业务订单，已生成凭证的订单不可修改".to_string());
    }
    sqlx::query_as("SELECT * FROM business_orders WHERE id = ? AND company_id = ?")
        .bind(input.id)
        .bind(input.company_id)
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("查询更新业务订单失败: {error}"))
}
