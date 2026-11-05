use crate::commands::auth::authenticated_actor;
use crate::commands::period_guard::ensure_period_label_open;
use crate::db::{
    CreateFixedAssetInput, Database, DepreciationBatch, FixedAsset, FixedAssetDepreciationLine,
    UpdateFixedAssetInput,
};
use sqlx::{FromRow, SqlitePool};
use tauri::State;

fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn period_index(period: &str) -> Result<i64, String> {
    let (year, month) = period
        .split_once('-')
        .ok_or_else(|| "账期格式应为 YYYY-MM".to_string())?;
    let year = year
        .parse::<i64>()
        .map_err(|_| "账期年份无效".to_string())?;
    let month = month
        .parse::<i64>()
        .map_err(|_| "账期月份无效".to_string())?;
    if year < 1900 || !(1..=12).contains(&month) {
        return Err("账期格式应为 YYYY-MM".to_string());
    }
    Ok(year * 12 + month - 1)
}

fn next_month_period(start_date: &str) -> Result<String, String> {
    let source_period = start_date
        .get(..7)
        .ok_or_else(|| "固定资产启用日期无效".to_string())?;
    let index = period_index(source_period)? + 1;
    Ok(format!("{:04}-{:02}", index / 12, index % 12 + 1))
}

fn account_code(subject: &str) -> Result<&str, String> {
    subject
        .split_whitespace()
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "折旧科目不能为空".to_string())
}

#[derive(Debug, Clone, FromRow)]
struct AssetCategoryPolicy {
    id: String,
    name: String,
    depreciation_method: String,
    asset_account: String,
    accumulated_depreciation_account: String,
    expense_account: Option<String>,
    is_enabled: i32,
}

#[derive(Debug, Clone, FromRow)]
struct CurrentAssetPolicy {
    period: String,
    category_id: Option<String>,
    start_date: String,
    original_value: f64,
    useful_life_months: i64,
    residual_rate: f64,
    depreciation_method: String,
    asset_account: String,
    accumulated_depreciation_account: String,
    expense_account: Option<String>,
    opening_accumulated_depreciation: f64,
    opening_depreciation_months: i64,
}

async fn asset_category_for_asset(
    pool: &SqlitePool,
    company_id: &str,
    category_id: &str,
) -> Result<AssetCategoryPolicy, String> {
    if category_id.trim().is_empty() {
        return Err("请选择资产类别".to_string());
    }
    sqlx::query_as(
        r#"SELECT id, name, depreciation_method, asset_account,
                  accumulated_depreciation_account, expense_account, is_enabled
           FROM asset_categories
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(category_id.trim())
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("查询资产类别失败: {error}"))?
    .ok_or_else(|| "资产类别不存在或不属于当前账套".to_string())
}

fn validate_asset_values(
    asset_code: &str,
    asset_name: &str,
    start_date: &str,
    original_value: f64,
    useful_life_months: i64,
    residual_rate: f64,
    opening_accumulated_depreciation: f64,
    opening_depreciation_months: i64,
) -> Result<(), String> {
    if asset_code.trim().is_empty()
        || asset_name.trim().is_empty()
        || start_date.trim().is_empty()
        || original_value <= 0.0
        || useful_life_months <= 0
        || !(0.0..=1.0).contains(&residual_rate)
        || opening_accumulated_depreciation < 0.0
        || opening_depreciation_months < 0
        || opening_depreciation_months > useful_life_months
        || opening_accumulated_depreciation > original_value * (1.0 - residual_rate) + 0.005
    {
        return Err(
            "资产信息不完整；原值和折旧期限必须大于零，残值率应在 0% 至 100% 之间，期初累计折旧及月数不得超过可折旧上限"
                .to_string(),
        );
    }
    Ok(())
}

async fn asset_has_depreciation_business(
    pool: &SqlitePool,
    company_id: &str,
    asset_id: &str,
    asset_period: &str,
) -> Result<bool, String> {
    sqlx::query_scalar::<_, i64>(
        r#"SELECT EXISTS(
               SELECT 1 FROM fixed_asset_depreciation_lines
               WHERE company_id = ? AND asset_id = ?
               UNION ALL
               SELECT 1 FROM depreciation_batches batch
               WHERE batch.company_id = ? AND batch.period >= ? AND batch.asset_count > 0
                 AND NOT EXISTS (
                   SELECT 1 FROM fixed_asset_depreciation_lines line
                   WHERE line.batch_id = batch.id
                 )
           )"#,
    )
    .bind(company_id)
    .bind(asset_id)
    .bind(company_id)
    .bind(asset_period)
    .fetch_one(pool)
    .await
    .map(|value| value != 0)
    .map_err(|error| format!("查询固定资产折旧业务失败: {error}"))
}

#[tauri::command]
pub async fn get_fixed_assets(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<FixedAsset>, String> {
    sqlx::query_as("SELECT * FROM fixed_assets WHERE company_id = ? AND period <= ? AND status != '已处置' ORDER BY start_date DESC, created_at DESC")
        .bind(company_id)
        .bind(period)
        .fetch_all(db.pool())
        .await
        .map_err(|error| format!("查询固定资产失败: {error}"))
}

#[tauri::command]
pub async fn get_fixed_asset_depreciation_batch(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Option<DepreciationBatch>, String> {
    sqlx::query_as("SELECT * FROM depreciation_batches WHERE company_id = ? AND period = ?")
        .bind(company_id)
        .bind(period)
        .fetch_optional(db.pool())
        .await
        .map_err(|error| format!("查询折旧批次失败: {error}"))
}

#[tauri::command]
pub async fn get_fixed_asset_depreciation_lines(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<FixedAssetDepreciationLine>, String> {
    sqlx::query_as(
        r#"SELECT * FROM fixed_asset_depreciation_lines
           WHERE company_id = ? AND period = ?
           ORDER BY category, asset_code, asset_name"#,
    )
    .bind(company_id)
    .bind(period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("查询固定资产折旧明细失败: {error}"))
}

pub(crate) async fn prepare_depreciation_batch_record(
    pool: &SqlitePool,
    company_id: &str,
    period: &str,
    actor: &str,
) -> Result<DepreciationBatch, String> {
    let target_period_index = period_index(period)?;
    ensure_period_label_open(pool, company_id, period, "计算固定资产折旧").await?;
    let existing: Option<DepreciationBatch> =
        sqlx::query_as("SELECT * FROM depreciation_batches WHERE company_id = ? AND period = ?")
            .bind(company_id)
            .bind(period)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("查询折旧批次失败: {error}"))?;
    if existing
        .as_ref()
        .is_some_and(|batch| batch.voucher_id.is_some())
    {
        return Err("已有凭证的折旧批次不能重新计算".to_string());
    }

    let batch_id = existing
        .as_ref()
        .map(|batch| batch.id.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("开始计算折旧失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO depreciation_batches
           (id, company_id, period, asset_count, depreciation_amount, status)
           VALUES (?, ?, ?, 0, 0, '待复核')
           ON CONFLICT(company_id, period) DO UPDATE SET
             asset_count = 0,
             depreciation_amount = 0,
             voucher_id = NULL,
             voucher_number = NULL,
             status = '待复核',
             updated_at = datetime('now')
           WHERE depreciation_batches.voucher_id IS NULL"#,
    )
    .bind(&batch_id)
    .bind(company_id)
    .bind(period)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("初始化折旧批次失败: {error}"))?;
    sqlx::query("DELETE FROM fixed_asset_depreciation_lines WHERE company_id = ? AND period = ?")
        .bind(company_id)
        .bind(period)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理待复核折旧明细失败: {error}"))?;

    let assets: Vec<FixedAsset> = sqlx::query_as(
        r#"SELECT * FROM fixed_assets
           WHERE company_id = ? AND period <= ? AND status != '已处置'
           ORDER BY asset_code, asset_name"#,
    )
    .bind(company_id)
    .bind(period)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("读取待计提固定资产失败: {error}"))?;

    let mut asset_count = 0_i64;
    let mut depreciation_total = 0.0_f64;
    for asset in assets {
        let start_period = next_month_period(&asset.start_date)?;
        let start_index = period_index(&start_period)?;
        let elapsed_months = target_period_index - start_index;
        if elapsed_months < 0 || elapsed_months >= asset.useful_life_months {
            continue;
        }
        if asset.depreciation_method != "平均年限法" {
            return Err(format!(
                "资产 {} 使用的折旧方法暂不支持自动计算，请改为平均年限法或手工处理",
                asset.asset_code
            ));
        }
        let expense_account = asset
            .expense_account
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| format!("资产 {} 未配置折旧费用科目", asset.asset_code))?;
        let accumulated_account = asset.accumulated_depreciation_account.trim();
        for (label, subject) in [
            ("折旧费用", expense_account),
            ("累计折旧", accumulated_account),
        ] {
            let code = account_code(subject)?;
            let valid_account: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM account_codes WHERE company_id = ? AND code = ? AND is_enabled = 1 AND is_detail = 1",
            )
            .bind(company_id)
            .bind(code)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("校验{label}科目失败: {error}"))?;
            if valid_account == 0 {
                return Err(format!(
                    "资产 {} 的{label}科目 {} 不是当前账套已启用末级科目",
                    asset.asset_code, subject
                ));
            }
        }

        let unposted_prior: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM fixed_asset_depreciation_lines
               WHERE company_id = ? AND asset_id = ? AND period < ? AND voucher_id IS NULL"#,
        )
        .bind(company_id)
        .bind(&asset.id)
        .bind(period)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("检查前期折旧批次失败: {error}"))?;
        if unposted_prior > 0 {
            return Err(format!(
                "资产 {} 存在未生成凭证的前期折旧批次",
                asset.asset_code
            ));
        }
        let (posted_months, posted_amount): (i64, f64) = sqlx::query_as(
            r#"SELECT COUNT(*), CAST(COALESCE(SUM(depreciation_amount), 0) AS REAL)
               FROM fixed_asset_depreciation_lines
               WHERE company_id = ? AND asset_id = ? AND period < ? AND voucher_id IS NOT NULL"#,
        )
        .bind(company_id)
        .bind(&asset.id)
        .bind(period)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("汇总前期累计折旧失败: {error}"))?;
        let accounted_months = asset.opening_depreciation_months + posted_months;
        if accounted_months != elapsed_months {
            return Err(format!(
                "资产 {} 折旧历史不完整：本期前应累计 {} 个月，当前档案及凭证仅有 {} 个月，请补录期初累计折旧及已折旧月数",
                asset.asset_code, elapsed_months, accounted_months
            ));
        }
        let depreciable_amount = round_money(asset.original_value * (1.0 - asset.residual_rate));
        let opening_accumulated_depreciation =
            round_money(asset.opening_accumulated_depreciation + posted_amount);
        let remaining = round_money(depreciable_amount - opening_accumulated_depreciation);
        if remaining <= 0.0 {
            continue;
        }
        let regular_amount = round_money(depreciable_amount / asset.useful_life_months as f64);
        let depreciation_amount = if elapsed_months + 1 == asset.useful_life_months {
            remaining
        } else {
            regular_amount.min(remaining)
        };
        if depreciation_amount <= 0.0 {
            continue;
        }
        let closing_accumulated_depreciation =
            round_money(opening_accumulated_depreciation + depreciation_amount);
        let closing_net_value =
            round_money((asset.original_value - closing_accumulated_depreciation).max(0.0));
        sqlx::query(
            r#"INSERT INTO fixed_asset_depreciation_lines
               (id, batch_id, company_id, period, asset_id, asset_code, asset_name,
                category, depreciation_method, expense_account,
                accumulated_depreciation_account, depreciable_amount,
                months_depreciated, opening_accumulated_depreciation,
                depreciation_amount, closing_accumulated_depreciation,
                closing_net_value, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待复核')"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&batch_id)
        .bind(company_id)
        .bind(period)
        .bind(&asset.id)
        .bind(&asset.asset_code)
        .bind(&asset.asset_name)
        .bind(&asset.category)
        .bind(&asset.depreciation_method)
        .bind(expense_account)
        .bind(accumulated_account)
        .bind(depreciable_amount)
        .bind(accounted_months + 1)
        .bind(opening_accumulated_depreciation)
        .bind(depreciation_amount)
        .bind(closing_accumulated_depreciation)
        .bind(closing_net_value)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存固定资产折旧明细失败: {error}"))?;
        asset_count += 1;
        depreciation_total = round_money(depreciation_total + depreciation_amount);
    }
    if asset_count == 0 || depreciation_total <= 0.0 {
        return Err("当前账期没有可计提折旧的固定资产".to_string());
    }
    sqlx::query(
        r#"UPDATE depreciation_batches
           SET asset_count = ?, depreciation_amount = ?, status = '待复核',
               updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND period = ? AND voucher_id IS NULL"#,
    )
    .bind(asset_count)
    .bind(depreciation_total)
    .bind(&batch_id)
    .bind(company_id)
    .bind(period)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新折旧批次汇总失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '固定资产', '计算本期折旧', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(period)
    .bind(format!(
        "{} 项资产，本期折旧 {:.2} 元",
        asset_count, depreciation_total
    ))
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("记录折旧计算审计日志失败: {error}"))?;
    let batch: DepreciationBatch =
        sqlx::query_as("SELECT * FROM depreciation_batches WHERE id = ? AND company_id = ?")
            .bind(&batch_id)
            .bind(company_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("读取折旧批次结果失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交折旧计算失败: {error}"))?;
    Ok(batch)
}

#[tauri::command]
pub async fn prepare_fixed_asset_depreciation_batch(
    company_id: String,
    period: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<DepreciationBatch, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    prepare_depreciation_batch_record(db.pool(), &company_id, &period, &actor).await
}

pub(crate) async fn create_fixed_asset_record(
    pool: &SqlitePool,
    input: &CreateFixedAssetInput,
) -> Result<FixedAsset, String> {
    let residual_rate = input.residual_rate.unwrap_or(0.0);
    let opening_accumulated_depreciation = input.opening_accumulated_depreciation.unwrap_or(0.0);
    let opening_depreciation_months = input.opening_depreciation_months.unwrap_or(0);
    if input.period.trim().is_empty() {
        return Err("请选择固定资产所属账期".to_string());
    }
    validate_asset_values(
        &input.asset_code,
        &input.asset_name,
        &input.start_date,
        input.original_value,
        input.useful_life_months,
        residual_rate,
        opening_accumulated_depreciation,
        opening_depreciation_months,
    )?;
    let category = asset_category_for_asset(pool, &input.company_id, &input.category_id).await?;
    if category.is_enabled != 1 {
        return Err("所选资产类别已停用".to_string());
    }
    ensure_period_label_open(pool, &input.company_id, &input.period, "新增固定资产").await?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO fixed_assets (
               id, company_id, period, asset_code, asset_name, category, category_id,
               start_date, original_value, useful_life_months, residual_rate,
               depreciation_method, asset_account, accumulated_depreciation_account,
               expense_account, opening_accumulated_depreciation,
               opening_depreciation_months, source_document
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(input.period.trim())
    .bind(input.asset_code.trim())
    .bind(input.asset_name.trim())
    .bind(&category.name)
    .bind(&category.id)
    .bind(input.start_date.trim())
    .bind(input.original_value)
    .bind(input.useful_life_months)
    .bind(residual_rate)
    .bind(&category.depreciation_method)
    .bind(&category.asset_account)
    .bind(&category.accumulated_depreciation_account)
    .bind(&category.expense_account)
    .bind(opening_accumulated_depreciation)
    .bind(opening_depreciation_months)
    .bind(
        input
            .source_document
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .execute(pool)
    .await
    .map_err(|error| format!("新增固定资产失败: {error}"))?;
    sqlx::query_as("SELECT * FROM fixed_assets WHERE id = ? AND company_id = ?")
        .bind(id)
        .bind(&input.company_id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("查询新增固定资产失败: {error}"))
}

#[tauri::command]
pub async fn create_fixed_asset(
    input: CreateFixedAssetInput,
    db: State<'_, Database>,
) -> Result<FixedAsset, String> {
    create_fixed_asset_record(db.pool(), &input).await
}

pub(crate) async fn update_fixed_asset_record(
    pool: &SqlitePool,
    input: &UpdateFixedAssetInput,
) -> Result<FixedAsset, String> {
    let residual_rate = input.residual_rate.unwrap_or(0.0);
    let opening_accumulated_depreciation = input.opening_accumulated_depreciation.unwrap_or(0.0);
    let opening_depreciation_months = input.opening_depreciation_months.unwrap_or(0);
    if input.id.trim().is_empty() {
        return Err("固定资产标识不能为空".to_string());
    }
    validate_asset_values(
        &input.asset_code,
        &input.asset_name,
        &input.start_date,
        input.original_value,
        input.useful_life_months,
        residual_rate,
        opening_accumulated_depreciation,
        opening_depreciation_months,
    )?;
    let current: CurrentAssetPolicy = sqlx::query_as(
        r#"SELECT period, category_id, start_date, original_value, useful_life_months,
                  residual_rate, depreciation_method, asset_account,
                  accumulated_depreciation_account, expense_account,
                  opening_accumulated_depreciation, opening_depreciation_months
           FROM fixed_assets WHERE id = ? AND company_id = ?"#,
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("查询固定资产账期失败: {error}"))?
    .ok_or_else(|| "未找到当前账套的固定资产".to_string())?;
    ensure_period_label_open(pool, &input.company_id, &current.period, "修改固定资产").await?;
    let category = asset_category_for_asset(pool, &input.company_id, &input.category_id).await?;
    let category_changed = current.category_id.as_deref() != Some(category.id.as_str());
    if category_changed && category.is_enabled != 1 {
        return Err("所选资产类别已停用".to_string());
    }
    let policy_changed = category_changed
        || current.start_date != input.start_date.trim()
        || (current.original_value - input.original_value).abs() >= 0.005
        || current.useful_life_months != input.useful_life_months
        || (current.residual_rate - residual_rate).abs() >= 0.000_001
        || (current.opening_accumulated_depreciation - opening_accumulated_depreciation).abs()
            >= 0.005
        || current.opening_depreciation_months != opening_depreciation_months;
    if policy_changed
        && asset_has_depreciation_business(pool, &input.company_id, &input.id, &current.period)
            .await?
    {
        return Err(
            "已有折旧业务的固定资产不能修改类别、启用日期、原值、折旧期限、残值率或期初累计折旧"
                .to_string(),
        );
    }
    let (method, asset_account, accumulated_account, expense_account) = if category_changed {
        (
            category.depreciation_method.as_str(),
            category.asset_account.as_str(),
            category.accumulated_depreciation_account.as_str(),
            category.expense_account.as_deref(),
        )
    } else {
        (
            current.depreciation_method.as_str(),
            current.asset_account.as_str(),
            current.accumulated_depreciation_account.as_str(),
            current.expense_account.as_deref(),
        )
    };
    let affected = sqlx::query(
        r#"UPDATE fixed_assets
           SET asset_code = ?, asset_name = ?, category = ?, category_id = ?,
               start_date = ?, original_value = ?, useful_life_months = ?, residual_rate = ?,
               depreciation_method = ?, asset_account = ?,
               accumulated_depreciation_account = ?, expense_account = ?,
               opening_accumulated_depreciation = ?, opening_depreciation_months = ?,
               source_document = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(input.asset_code.trim())
    .bind(input.asset_name.trim())
    .bind(&category.name)
    .bind(&category.id)
    .bind(input.start_date.trim())
    .bind(input.original_value)
    .bind(input.useful_life_months)
    .bind(residual_rate)
    .bind(method)
    .bind(asset_account)
    .bind(accumulated_account)
    .bind(expense_account)
    .bind(opening_accumulated_depreciation)
    .bind(opening_depreciation_months)
    .bind(
        input
            .source_document
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(pool)
    .await
    .map_err(|error| format!("更新固定资产失败: {error}"))?;
    if affected.rows_affected() == 0 {
        return Err("未找到可编辑的固定资产".to_string());
    }
    sqlx::query_as("SELECT * FROM fixed_assets WHERE id = ? AND company_id = ?")
        .bind(&input.id)
        .bind(&input.company_id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("查询更新固定资产失败: {error}"))
}

#[tauri::command]
pub async fn update_fixed_asset(
    input: UpdateFixedAssetInput,
    db: State<'_, Database>,
) -> Result<FixedAsset, String> {
    update_fixed_asset_record(db.pool(), &input).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::asset_categories::{
        delete_asset_category_record, update_asset_category_record, AssetCategoryInput,
    };

    fn create_input(category_id: &str) -> CreateFixedAssetInput {
        CreateFixedAssetInput {
            company_id: "company-1".into(),
            period: "2026-05".into(),
            asset_code: "FA001".into(),
            asset_name: "测试设备".into(),
            category_id: category_id.into(),
            start_date: "2026-05-10".into(),
            original_value: 12_000.0,
            useful_life_months: 60,
            residual_rate: Some(0.05),
            opening_accumulated_depreciation: Some(0.0),
            opening_depreciation_months: Some(0),
            source_document: Some("采购发票001".into()),
        }
    }

    fn update_input(id: &str, category_id: &str) -> UpdateFixedAssetInput {
        UpdateFixedAssetInput {
            id: id.into(),
            company_id: "company-1".into(),
            asset_code: "FA001".into(),
            asset_name: "测试设备（更新）".into(),
            category_id: category_id.into(),
            start_date: "2026-05-10".into(),
            original_value: 12_000.0,
            useful_life_months: 60,
            residual_rate: Some(0.05),
            opening_accumulated_depreciation: Some(0.0),
            opening_depreciation_months: Some(0),
            source_document: Some("采购发票001".into()),
        }
    }

    #[tokio::test]
    async fn structured_categories_preserve_asset_policy_and_history() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-fixed-asset-category-{}",
            uuid::Uuid::new_v4()
        ));
        let db = Database::new(data_dir.clone())
            .await
            .expect("create fixed asset category test database");
        sqlx::query(
            r#"INSERT INTO companies (id, code, name)
               VALUES ('company-1', 'C001', '固定资产测试账套'),
                      ('company-2', 'C002', '其他账套')"#,
        )
        .execute(db.pool())
        .await
        .expect("insert companies");
        sqlx::query(
            r#"INSERT INTO accounting_periods
               (id, company_id, period_year, period_month, start_date, end_date, status)
               VALUES ('period-1', 'company-1', 2026, 5, '2026-05-01', '2026-05-31', 'open')"#,
        )
        .execute(db.pool())
        .await
        .expect("insert open period");
        sqlx::query(
            r#"INSERT INTO asset_categories
               (id, company_id, code, name, useful_life_months, residual_rate,
                depreciation_method, asset_account, accumulated_depreciation_account,
                expense_account, is_enabled)
               VALUES ('category-office', 'company-1', 'OFFICE', '办公设备', 60, 0.05,
                       '平均年限法', '1601', '1602', '6602', 1),
                      ('category-machine', 'company-1', 'MACHINE', '机器设备', 120, 0.03,
                       '平均年限法', '1601', '1602', '5101', 1),
                      ('category-disabled', 'company-1', 'OLD', '停用类别', 36, 0,
                       '平均年限法', '1601', '1602', '6602', 0),
                      ('category-foreign', 'company-2', 'FOREIGN', '其他账套类别', 60, 0.05,
                       '平均年限法', '1601', '1602', '6602', 1)"#,
        )
        .execute(db.pool())
        .await
        .expect("insert asset categories");

        let foreign_error = create_fixed_asset_record(db.pool(), &create_input("category-foreign"))
            .await
            .expect_err("cross-company category must be rejected");
        assert!(foreign_error.contains("不属于当前账套"));
        let disabled_error =
            create_fixed_asset_record(db.pool(), &create_input("category-disabled"))
                .await
                .expect_err("disabled category must be rejected");
        assert!(disabled_error.contains("已停用"));

        let asset = create_fixed_asset_record(db.pool(), &create_input("category-office"))
            .await
            .expect("create asset with structured category");
        assert_eq!(asset.category_id.as_deref(), Some("category-office"));
        assert_eq!(asset.category, "办公设备");
        assert_eq!(asset.depreciation_method, "平均年限法");
        assert_eq!(asset.expense_account.as_deref(), Some("6602"));

        let renamed = update_asset_category_record(
            "category-office",
            &AssetCategoryInput {
                company_id: "company-1".into(),
                code: "OFFICE".into(),
                name: "电子办公设备".into(),
                useful_life_months: 48,
                residual_rate: 0.02,
                depreciation_method: "平均年限法".into(),
                asset_account: "1601".into(),
                accumulated_depreciation_account: "1602".into(),
                expense_account: Some("6603".into()),
                is_enabled: Some(1),
            },
            db.pool(),
        )
        .await
        .expect("rename category and change defaults");
        assert_eq!(renamed.name, "电子办公设备");
        let renamed_asset: FixedAsset = sqlx::query_as("SELECT * FROM fixed_assets WHERE id = ?")
            .bind(&asset.id)
            .fetch_one(db.pool())
            .await
            .expect("read renamed asset");
        assert_eq!(renamed_asset.category, "电子办公设备");
        assert_eq!(renamed_asset.useful_life_months, 60);
        assert_eq!(renamed_asset.residual_rate, 0.05);
        assert_eq!(renamed_asset.expense_account.as_deref(), Some("6602"));

        let delete_error = delete_asset_category_record("category-office", "company-1", db.pool())
            .await
            .expect_err("referenced category must not be deleted");
        assert!(delete_error.contains("不能删除"));

        let changed =
            update_fixed_asset_record(db.pool(), &update_input(&asset.id, "category-machine"))
                .await
                .expect("unused asset may change category");
        assert_eq!(changed.category, "机器设备");
        assert_eq!(changed.expense_account.as_deref(), Some("5101"));

        sqlx::query(
            r#"INSERT INTO depreciation_batches
               (id, company_id, period, asset_count, depreciation_amount, status)
               VALUES ('batch-1', 'company-1', '2026-06', 1, 190, '待确认')"#,
        )
        .execute(db.pool())
        .await
        .expect("insert depreciation batch");
        let policy_error =
            update_fixed_asset_record(db.pool(), &update_input(&asset.id, "category-office"))
                .await
                .expect_err("asset policy must lock after depreciation business");
        assert!(policy_error.contains("已有折旧业务"));

        let name_only =
            update_fixed_asset_record(db.pool(), &update_input(&asset.id, "category-machine"))
                .await
                .expect("non-policy fields remain editable");
        assert_eq!(name_only.asset_name, "测试设备（更新）");

        drop(db);
        let _ = std::fs::remove_dir_all(data_dir);
    }

    #[tokio::test]
    async fn depreciation_starts_next_month_and_persists_reviewable_asset_lines() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-fixed-asset-depreciation-{}",
            uuid::Uuid::new_v4()
        ));
        let db = Database::new(data_dir.clone())
            .await
            .expect("create fixed asset depreciation test database");
        sqlx::query(
            "INSERT INTO companies (id, code, name) VALUES ('company-1', 'C001', '固定资产折旧测试账套')",
        )
        .execute(db.pool())
        .await
        .expect("insert company");
        sqlx::query(
            r#"INSERT INTO accounting_periods
               (id, company_id, period_year, period_month, start_date, end_date, status)
               VALUES ('period-may', 'company-1', 2026, 5, '2026-05-01', '2026-05-31', 'open'),
                      ('period-june', 'company-1', 2026, 6, '2026-06-01', '2026-06-30', 'open')"#,
        )
        .execute(db.pool())
        .await
        .expect("insert open periods");
        sqlx::query(
            r#"INSERT INTO account_codes
               (code, company_id, name, account_type, normal_balance, level, is_detail, is_enabled)
               VALUES ('1602', 'company-1', '累计折旧', 'asset', 'credit', 1, 1, 1),
                      ('6602', 'company-1', '管理费用', 'expense', 'debit', 1, 1, 1)"#,
        )
        .execute(db.pool())
        .await
        .expect("insert depreciation accounts");
        sqlx::query(
            r#"INSERT INTO asset_categories
               (id, company_id, code, name, useful_life_months, residual_rate,
                depreciation_method, asset_account, accumulated_depreciation_account,
                expense_account, is_enabled)
               VALUES ('category-office', 'company-1', 'OFFICE', '办公设备', 60, 0.05,
                       '平均年限法', '1601', '1602', '6602', 1)"#,
        )
        .execute(db.pool())
        .await
        .expect("insert asset category");

        let asset = create_fixed_asset_record(db.pool(), &create_input("category-office"))
            .await
            .expect("create fixed asset");
        let may_error =
            prepare_depreciation_batch_record(db.pool(), "company-1", "2026-05", "tester")
                .await
                .expect_err("the activation month must not depreciate");
        assert!(may_error.contains("没有可计提折旧"));

        let batch = prepare_depreciation_batch_record(db.pool(), "company-1", "2026-06", "tester")
            .await
            .expect("calculate first depreciation month");
        assert_eq!(batch.asset_count, 1);
        assert!((batch.depreciation_amount - 190.0).abs() < 0.005);
        assert_eq!(batch.status, "待复核");

        let lines: Vec<FixedAssetDepreciationLine> = sqlx::query_as(
            "SELECT * FROM fixed_asset_depreciation_lines WHERE company_id = ? AND period = ?",
        )
        .bind("company-1")
        .bind("2026-06")
        .fetch_all(db.pool())
        .await
        .expect("read depreciation lines");
        assert_eq!(lines.len(), 1);
        let line = &lines[0];
        assert_eq!(line.asset_id, asset.id);
        assert_eq!(line.months_depreciated, 1);
        assert!((line.opening_accumulated_depreciation - 0.0).abs() < 0.005);
        assert!((line.depreciation_amount - 190.0).abs() < 0.005);
        assert!((line.closing_accumulated_depreciation - 190.0).abs() < 0.005);
        assert!((line.closing_net_value - 11_810.0).abs() < 0.005);

        prepare_depreciation_batch_record(db.pool(), "company-1", "2026-06", "tester")
            .await
            .expect("recalculate the unvouchered batch idempotently");
        let line_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM fixed_asset_depreciation_lines WHERE company_id = ? AND period = ?",
        )
        .bind("company-1")
        .bind("2026-06")
        .fetch_one(db.pool())
        .await
        .expect("count depreciation lines");
        assert_eq!(line_count, 1);

        let mut changed_policy = update_input(&asset.id, "category-office");
        changed_policy.original_value = 13_000.0;
        let policy_error = update_fixed_asset_record(db.pool(), &changed_policy)
            .await
            .expect_err("depreciation policy must lock after a detail line exists");
        assert!(policy_error.contains("已有折旧业务"));

        drop(db);
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
