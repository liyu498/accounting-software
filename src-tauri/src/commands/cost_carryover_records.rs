use crate::commands::auth::authenticated_actor;
use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{CostCarryoverRecord, Database, UpdateCostCarryoverRecordInput};
use tauri::State;
fn opt(v: Option<&String>) -> Option<&str> {
    v.map(String::as_str)
        .map(str::trim)
        .filter(|x| !x.is_empty())
}
#[tauri::command]
pub async fn get_cost_carryover_records(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<CostCarryoverRecord>, String> {
    sqlx::query_as("SELECT * FROM cost_carryover_records WHERE company_id=? AND period=? ORDER BY carryover_date DESC, created_at DESC").bind(company_id).bind(period).fetch_all(db.pool()).await.map_err(|e|format!("查询成本结转记录失败: {e}"))
}
#[tauri::command]
pub async fn update_cost_carryover_record(
    i: UpdateCostCarryoverRecordInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<CostCarryoverRecord, String> {
    if i.debit_subject.trim().is_empty()
        || i.credit_subject.trim().is_empty()
        || !i.difference_amount.unwrap_or(0.0).is_finite()
    {
        return Err("成本结转借贷科目不能为空，差异金额必须有效".into());
    }
    let current: CostCarryoverRecord =
        sqlx::query_as("SELECT * FROM cost_carryover_records WHERE id = ? AND company_id = ?")
            .bind(&i.id)
            .bind(&i.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("查询成本结转账期失败: {error}"))?
            .ok_or_else(|| "未找到当前账套的成本结转记录".to_string())?;
    ensure_period_label_open(
        db.pool(),
        &i.company_id,
        &current.period,
        "修改成本结转记录",
    )
    .await?;
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db.pool().begin().await.map_err(|error| error.to_string())?;
    let r=sqlx::query("UPDATE cost_carryover_records SET debit_subject=?,credit_subject=?,difference_amount=?,status=?,source_document=?,updated_at=datetime('now') WHERE id=? AND company_id=? AND voucher_id IS NULL AND voucher_no IS NULL AND status != '已生成凭证'")
        .bind(i.debit_subject.trim())
        .bind(i.credit_subject.trim())
        .bind(i.difference_amount.unwrap_or(0.0))
        .bind(opt(i.status.as_ref()).unwrap_or("待确认"))
        .bind(opt(i.source_document.as_ref()))
        .bind(&i.id)
        .bind(&i.company_id)
        .execute(&mut *transaction).await.map_err(|e|format!("更新成本结转记录失败: {e}"))?;
    if r.rows_affected() == 0 {
        let linked: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT voucher_id, voucher_no FROM cost_carryover_records WHERE id=? AND company_id=?",
        )
        .bind(&i.id)
        .bind(&i.company_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| format!("检查成本结转记录失败: {e}"))?;
        return if linked
            .is_some_and(|(voucher_id, voucher_no)| voucher_id.is_some() || voucher_no.is_some())
        {
            Err("成本结转已关联凭证，不能修改来源和科目".into())
        } else {
            Err("未找到当前账套的成本结转记录".into())
        };
    }
    sqlx::query("INSERT INTO operation_audit_logs (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator) VALUES (?, ?, '存货核算', '复核成本结转', ?, 'normal', 'success', ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&i.company_id)
        .bind(&current.batch_no)
        .bind(format!("借方科目={}; 贷方科目={}; 差异金额={:.2}; 状态={}", i.debit_subject.trim(), i.credit_subject.trim(), i.difference_amount.unwrap_or(0.0), opt(i.status.as_ref()).unwrap_or("待确认")))
        .bind(&actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入成本结转复核日志失败: {error}"))?;
    let record = sqlx::query_as("SELECT * FROM cost_carryover_records WHERE id=? AND company_id=?")
        .bind(&i.id)
        .bind(&i.company_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| format!("查询更新成本结转记录失败: {e}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(record)
}
