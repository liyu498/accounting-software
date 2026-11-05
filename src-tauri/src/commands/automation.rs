use crate::commands::auth::authenticated_actor;
use crate::db::{
    AdapterAuthorization, AdapterProviderConfig, AiProviderConfig, AutomationJob,
    ConfirmTaxDeclarationTaskInput, CreateAutomationJobInput, CreateOperationAuditLogInput,
    Database, DbPool, ExternalBankSyncItem, ExternalBankSyncResult, ExternalInvoiceSyncItem,
    ExternalInvoiceSyncResult, OperationAuditLog, ReviewExternalBankSyncItemInput,
    ReviewExternalInvoiceSyncItemInput, RunAiRecognitionJobInput, SubmitTaxDeclarationTaskInput,
    SyncExternalBankStatementInput, SyncExternalInvoicePoolInput, SyncTaxDeclarationReceiptInput,
    TaxDeclarationTask, UpdateAutomationJobStatusInput, UpsertAdapterAuthorizationInput,
    UpsertAdapterProviderConfigInput, UpsertAiProviderConfigInput, UpsertTaxDeclarationTaskInput,
    VerifyAdapterAuthorizationInput,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
use reqwest::{redirect::Policy as RedirectPolicy, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{hash_map::DefaultHasher, HashMap};
use std::hash::{Hash, Hasher};
use std::net::{IpAddr, SocketAddr};
use std::path::Path;
use std::time::Duration as StdDuration;
use tauri::State;

const AI_PROVIDER_MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const AI_PROVIDER_MAX_RESPONSE_BYTES: usize = 1024 * 1024;
const EXTERNAL_ADAPTER_MAX_RESPONSE_BYTES: usize = 256 * 1024;

fn require_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} cannot be empty", field))
    } else {
        Ok(())
    }
}

fn default_string(value: Option<String>, default_value: &str) -> String {
    value.unwrap_or_else(|| default_value.to_string())
}

#[derive(Debug, Deserialize)]
struct AiProviderResponse {
    confidence: Option<f64>,
    summary: String,
    risk_level: Option<String>,
    fields: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ExternalAdapterVerificationResponse {
    authorized: bool,
    external_reference: Option<String>,
    account_mask: Option<String>,
    capability_scope: Option<Vec<String>>,
    expires_at: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TaxSubmissionResponse {
    accepted: bool,
    external_reference: Option<String>,
    receipt_no: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TaxReceiptSyncResponse {
    found: bool,
    declaration_status: Option<String>,
    receipt_no: Option<String>,
    payment_status: Option<String>,
    payment_no: Option<String>,
    received_at: Option<String>,
    external_reference: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct InvoicePoolLineResponse {
    item_name: String,
    specification: Option<String>,
    unit: Option<String>,
    quantity: Option<f64>,
    unit_price: Option<f64>,
    amount: f64,
    tax_rate: Option<f64>,
    tax_amount: f64,
    tax_classification_code: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct InvoicePoolItemResponse {
    external_invoice_id: String,
    invoice_type: String,
    invoice_code: Option<String>,
    invoice_no: String,
    invoice_date: String,
    seller_name: Option<String>,
    seller_tax_id: Option<String>,
    buyer_name: Option<String>,
    buyer_tax_id: Option<String>,
    amount: f64,
    tax_amount: f64,
    total_amount: f64,
    tax_rate: Option<f64>,
    currency: Option<String>,
    lines: Vec<InvoicePoolLineResponse>,
}

#[derive(Debug, Deserialize)]
struct InvoicePoolSyncResponse {
    next_cursor: Option<String>,
    items: Vec<InvoicePoolItemResponse>,
}

#[derive(Debug, Deserialize, Serialize)]
struct BankStatementItemResponse {
    external_transaction_id: String,
    account_mask: String,
    transaction_date: String,
    value_date: Option<String>,
    direction: String,
    amount: f64,
    currency: Option<String>,
    counterparty_name: Option<String>,
    counterparty_account_mask: Option<String>,
    bank_reference: Option<String>,
    summary: Option<String>,
    balance: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct BankStatementSyncResponse {
    next_cursor: Option<String>,
    items: Vec<BankStatementItemResponse>,
}

struct ExternalProviderHttpResult {
    http_status: u16,
    body: Vec<u8>,
}

struct ExternalProviderHttpError {
    message: String,
    http_status: Option<u16>,
}

fn is_forbidden_provider_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(value) => {
            let octets = value.octets();
            value.is_loopback()
                || value.is_private()
                || value.is_link_local()
                || value.is_unspecified()
                || value.is_multicast()
                || octets[0] == 0
                || octets == [255, 255, 255, 255]
        }
        IpAddr::V6(value) => {
            value.is_loopback()
                || value.is_unspecified()
                || value.is_unique_local()
                || value.is_unicast_link_local()
                || value.is_multicast()
        }
    }
}

fn validate_external_provider_endpoint(endpoint: &str) -> Result<Url, String> {
    let url = Url::parse(endpoint.trim()).map_err(|_| "外部接口地址格式无效".to_string())?;
    if url.scheme() != "https" {
        return Err("外部接口仅允许使用 HTTPS".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("外部接口地址不得包含用户名或密码".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "外部接口地址缺少主机名".to_string())?;
    let normalized_host = host
        .trim_end_matches('.')
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase();
    if normalized_host == "localhost" || normalized_host.ends_with(".localhost") {
        return Err("外部接口地址不得指向 localhost".to_string());
    }
    if let Ok(ip) = normalized_host.parse::<IpAddr>() {
        if is_forbidden_provider_ip(ip) {
            return Err("外部接口地址不得指向回环、私网或链路本地地址".to_string());
        }
    }
    Ok(url)
}

fn validate_ai_provider_endpoint(endpoint: &str) -> Result<Url, String> {
    validate_external_provider_endpoint(endpoint)
        .map_err(|message| message.replace("外部接口", "识别服务"))
}

async fn validate_external_provider_destination(url: &Url) -> Result<SocketAddr, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "外部接口地址缺少主机名".to_string())?;
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| "无法解析外部接口地址".to_string())?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err("外部接口地址没有可用的网络目标".to_string());
    }
    if addresses
        .iter()
        .any(|address| is_forbidden_provider_ip(address.ip()))
    {
        return Err("外部接口域名解析到回环、私网或链路本地地址".to_string());
    }
    Ok(addresses[0])
}

async fn validate_ai_provider_destination(url: &Url) -> Result<SocketAddr, String> {
    validate_external_provider_destination(url)
        .await
        .map_err(|message| message.replace("外部接口", "识别服务"))
}

fn validate_credential_env(value: &str) -> Result<&str, String> {
    let credential_env = value.trim();
    if credential_env.is_empty()
        || credential_env.len() > 128
        || !credential_env.chars().all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '_'
        })
    {
        return Err("凭据环境变量名只能包含大写字母、数字和下划线".to_string());
    }
    Ok(credential_env)
}

async fn post_external_provider_json(
    config: &AdapterProviderConfig,
    payload: &Value,
) -> Result<ExternalProviderHttpResult, ExternalProviderHttpError> {
    let endpoint = validate_external_provider_endpoint(&config.endpoint).map_err(|message| {
        ExternalProviderHttpError {
            message,
            http_status: None,
        }
    })?;
    let resolved_address = validate_external_provider_destination(&endpoint)
        .await
        .map_err(|message| ExternalProviderHttpError {
            message,
            http_status: None,
        })?;
    let credential = std::env::var(&config.credential_env)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ExternalProviderHttpError {
            message: format!("未配置凭据环境变量 {}", config.credential_env),
            http_status: None,
        })?;
    let host = endpoint
        .host_str()
        .ok_or_else(|| ExternalProviderHttpError {
            message: "外部接口地址缺少主机名".to_string(),
            http_status: None,
        })?;
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(config.timeout_seconds as u64))
        .redirect(RedirectPolicy::none())
        .resolve(host, resolved_address)
        .build()
        .map_err(|_| ExternalProviderHttpError {
            message: "创建外部接口客户端失败".to_string(),
            http_status: None,
        })?;
    let response = client
        .post(endpoint)
        .bearer_auth(credential)
        .json(payload)
        .send()
        .await
        .map_err(|error| ExternalProviderHttpError {
            message: if error.is_timeout() {
                "外部接口请求超时".to_string()
            } else {
                "外部接口连接失败".to_string()
            },
            http_status: None,
        })?;
    let http_status = response.status();
    if !http_status.is_success() {
        return Err(ExternalProviderHttpError {
            message: format!("外部接口返回 HTTP {}", http_status.as_u16()),
            http_status: Some(http_status.as_u16()),
        });
    }
    let body = response
        .bytes()
        .await
        .map_err(|_| ExternalProviderHttpError {
            message: "无法读取外部接口返回内容".to_string(),
            http_status: Some(http_status.as_u16()),
        })?;
    if body.len() > EXTERNAL_ADAPTER_MAX_RESPONSE_BYTES {
        return Err(ExternalProviderHttpError {
            message: "外部接口返回内容超过 256 KB 上限".to_string(),
            http_status: Some(http_status.as_u16()),
        });
    }
    Ok(ExternalProviderHttpResult {
        http_status: http_status.as_u16(),
        body: body.to_vec(),
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn ai_source_mime(path: &Path) -> Result<&'static str, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "pdf" => Ok("application/pdf"),
        "png" => Ok("image/png"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "webp" => Ok("image/webp"),
        _ => Err("识别文件仅支持 PDF、PNG、JPG/JPEG 或 WebP".to_string()),
    }
}

fn validate_ai_provider_response(
    response: AiProviderResponse,
) -> Result<AiProviderResponse, String> {
    let summary = response.summary.trim();
    if summary.is_empty() || summary.chars().count() > 1000 {
        return Err("识别服务返回的摘要为空或超过 1000 字".to_string());
    }
    if response
        .confidence
        .is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
    {
        return Err("识别服务返回的置信度无效".to_string());
    }
    if response
        .risk_level
        .as_deref()
        .is_some_and(|value| !matches!(value, "normal" | "medium" | "high"))
    {
        return Err("识别服务返回的风险级别无效".to_string());
    }
    Ok(response)
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaxDeadlineRule {
    pub id: String,
    pub company_id: String,
    pub tax_type: String,
    pub filing_frequency: String,
    pub due_month_offset: i32,
    pub due_day: i32,
    pub adjustment_policy: String,
    pub effective_from: String,
    pub effective_to: Option<String>,
    pub source_name: String,
    pub source_url: Option<String>,
    pub is_active: i32,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTaxDeadlineRuleInput {
    pub company_id: String,
    pub tax_type: String,
    pub filing_frequency: String,
    pub due_month_offset: i32,
    pub due_day: i32,
    pub adjustment_policy: String,
    pub effective_from: String,
    pub effective_to: Option<String>,
    pub source_name: String,
    pub source_url: Option<String>,
    pub is_active: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaxCalendarDay {
    pub id: String,
    pub company_id: String,
    pub calendar_date: String,
    pub day_type: String,
    pub reason: String,
    pub source_name: String,
    pub source_url: Option<String>,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTaxCalendarDayInput {
    pub company_id: String,
    pub calendar_date: String,
    pub day_type: String,
    pub reason: String,
    pub source_name: String,
    pub source_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TaxDeclarationSchedule {
    pub task_id: String,
    pub tax_type: String,
    pub form_name: String,
    pub period: String,
    pub due_date: Option<String>,
    pub rule_id: Option<String>,
    pub filing_frequency: Option<String>,
    pub calculation_basis: Option<String>,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
    pub configuration_status: String,
}

fn parse_tax_period(period: &str) -> Result<(i32, u32), String> {
    if period.len() != 7 || period.as_bytes().get(4) != Some(&b'-') {
        return Err("所属期必须使用 YYYY-MM 格式".to_string());
    }
    let year = period[..4]
        .parse::<i32>()
        .map_err(|_| "所属期年份无效".to_string())?;
    let month = period[5..]
        .parse::<u32>()
        .map_err(|_| "所属期月份无效".to_string())?;
    if !(1..=12).contains(&month) {
        return Err("所属期月份无效".to_string());
    }
    Ok((year, month))
}

fn month_last_day(year: i32, month: u32) -> Result<u32, String> {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let next = NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .ok_or_else(|| "截止月份无效".to_string())?;
    Ok((next - Duration::days(1)).day())
}

fn next_workday(
    mut date: NaiveDate,
    overrides: &HashMap<NaiveDate, String>,
) -> Result<NaiveDate, String> {
    for _ in 0..=31 {
        let is_workday = match overrides.get(&date).map(String::as_str) {
            Some("workday") => true,
            Some("holiday") => false,
            _ => !matches!(date.weekday(), Weekday::Sat | Weekday::Sun),
        };
        if is_workday {
            return Ok(date);
        }
        date += Duration::days(1);
    }
    Err("工作日顺延超过 31 天，请检查调休日配置".to_string())
}

fn calculate_tax_due_date(
    period: &str,
    due_month_offset: i32,
    due_day: i32,
    adjustment_policy: &str,
    overrides: &HashMap<NaiveDate, String>,
) -> Result<NaiveDate, String> {
    let (year, month) = parse_tax_period(period)?;
    if !(0..=24).contains(&due_month_offset) || !(1..=31).contains(&due_day) {
        return Err("期限规则的月份偏移或截止日无效".to_string());
    }
    let total_month = year * 12 + month as i32 - 1 + due_month_offset;
    let due_year = total_month.div_euclid(12);
    let due_month = total_month.rem_euclid(12) as u32 + 1;
    let day = (due_day as u32).min(month_last_day(due_year, due_month)?);
    let date = NaiveDate::from_ymd_opt(due_year, due_month, day)
        .ok_or_else(|| "期限规则计算出的日期无效".to_string())?;
    match adjustment_policy {
        "none" => Ok(date),
        "next_workday" => next_workday(date, overrides),
        _ => Err("不支持的工作日调整规则".to_string()),
    }
}

fn tax_snapshot_fingerprint(
    task_id: &str,
    version: i64,
    collect_status: &str,
    validation_status: &str,
    declaration_status: &str,
    source_snapshot: Option<&str>,
    taxable_amount: f64,
    deduction_amount: f64,
    payable_amount: f64,
    risk_count: i64,
    adapter_code: Option<&str>,
) -> String {
    let mut hasher = DefaultHasher::new();
    task_id.hash(&mut hasher);
    version.hash(&mut hasher);
    collect_status.hash(&mut hasher);
    validation_status.hash(&mut hasher);
    declaration_status.hash(&mut hasher);
    source_snapshot.hash(&mut hasher);
    taxable_amount.to_bits().hash(&mut hasher);
    deduction_amount.to_bits().hash(&mut hasher);
    payable_amount.to_bits().hash(&mut hasher);
    risk_count.hash(&mut hasher);
    adapter_code.hash(&mut hasher);
    format!("t{:016x}", hasher.finish())
}

async fn write_tax_declaration_snapshot(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    task_id: &str,
    version: i64,
    fingerprint: &str,
    actor: &str,
) -> Result<(), String> {
    let result = sqlx::query(
        r#"
        INSERT INTO tax_declaration_snapshots (
            id, task_id, company_id, period, tax_type, form_name, version,
            collect_status, validation_status, declaration_status, source_snapshot,
            taxable_amount, deduction_amount, payable_amount, risk_count, adapter_code,
            fingerprint, created_by
        )
        SELECT ?, id, company_id, period, tax_type, form_name, ?,
               collect_status, validation_status, declaration_status, source_snapshot,
               taxable_amount, deduction_amount, payable_amount, risk_count, adapter_code,
               ?, ?
        FROM tax_declaration_tasks
        WHERE id = ?
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(version)
    .bind(fingerprint)
    .bind(actor)
    .bind(task_id)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("写入税务取数快照失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("申报任务不存在，无法写入取数快照".to_string());
    }
    Ok(())
}

async fn get_automation_job_by_id(id: &str, db: &Database) -> Result<AutomationJob, String> {
    sqlx::query_as(
        r#"
        SELECT
            j.id,
            j.company_id,
            c.name AS company_name,
            j.period,
            j.job_type,
            j.source_module,
            j.source_id,
            j.source_file,
            j.suggestion_no,
            j.debit_subject,
            j.credit_subject,
            j.suggestion_amount,
            j.generated_voucher_id,
            j.generated_voucher_number,
            j.status,
            j.confidence,
            j.result_summary,
            j.risk_level,
            j.reviewer,
            j.created_by,
            j.created_at,
            j.updated_at
        FROM automation_jobs j
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.id = ?
        "#,
    )
    .bind(id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

async fn fail_ai_provider_run(
    pool: &DbPool,
    run_id: &str,
    job_id: &str,
    company_id: &str,
    actor: &str,
    message: &str,
    http_status: Option<u16>,
) -> Result<(), String> {
    let safe_message = message
        .replace(['\r', '\n'], " ")
        .chars()
        .take(500)
        .collect::<String>();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建识别失败留痕事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE ai_provider_runs
           SET status = 'failed', http_status = ?, error_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(http_status.map(i64::from))
    .bind(&safe_message)
    .bind(run_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新识别失败记录失败: {error}"))?;
    sqlx::query(
        r#"UPDATE automation_jobs
           SET status = 'failed', result_summary = ?, risk_level = 'high', updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(format!("识别执行失败：{safe_message}"))
    .bind(job_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新识别任务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, 'AI自动化', '执行资料识别', ?, 'high', 'failure', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(job_id)
    .bind(&safe_message)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入识别失败审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交识别失败留痕失败: {error}"))
}

#[tauri::command]
pub async fn get_ai_provider_configs(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AiProviderConfig>, String> {
    require_non_empty(&company_id, "company_id")?;
    sqlx::query_as(
        r#"SELECT id, company_id, provider_name, provider_type, endpoint, model,
                  credential_env, timeout_seconds, max_file_bytes, is_enabled,
                  created_by, updated_by, created_at, updated_at
           FROM ai_provider_configs
           WHERE company_id = ?
           ORDER BY is_enabled DESC, provider_name"#,
    )
    .bind(company_id.trim())
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取识别服务配置失败: {error}"))
}

#[tauri::command]
pub async fn upsert_ai_provider_config(
    input: UpsertAiProviderConfigInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AiProviderConfig, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    for (value, field) in [
        (&input.company_id, "company_id"),
        (&input.provider_name, "provider_name"),
        (&input.provider_type, "provider_type"),
        (&input.endpoint, "endpoint"),
        (&input.model, "model"),
        (&input.credential_env, "credential_env"),
    ] {
        require_non_empty(value, field)?;
    }
    if input.provider_type != "generic_json" {
        return Err("当前仅支持通用 JSON 识别协议".to_string());
    }
    validate_ai_provider_endpoint(&input.endpoint)?;
    if !(5..=120).contains(&input.timeout_seconds) {
        return Err("识别超时时间必须在 5 到 120 秒之间".to_string());
    }
    if !(1024..=AI_PROVIDER_MAX_FILE_BYTES as i64).contains(&input.max_file_bytes) {
        return Err("识别文件上限必须在 1 KB 到 20 MB 之间".to_string());
    }
    if !matches!(input.is_enabled, 0 | 1) {
        return Err("启用状态无效".to_string());
    }
    let credential_env = validate_credential_env(&input.credential_env)?;
    let id = input
        .id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建识别服务配置事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO ai_provider_configs (
                id, company_id, provider_name, provider_type, endpoint, model,
                credential_env, timeout_seconds, max_file_bytes, is_enabled,
                created_by, updated_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(company_id, provider_name) DO UPDATE SET
                provider_type = excluded.provider_type,
                endpoint = excluded.endpoint,
                model = excluded.model,
                credential_env = excluded.credential_env,
                timeout_seconds = excluded.timeout_seconds,
                max_file_bytes = excluded.max_file_bytes,
                is_enabled = excluded.is_enabled,
                updated_by = excluded.updated_by,
                updated_at = datetime('now')"#,
    )
    .bind(&id)
    .bind(input.company_id.trim())
    .bind(input.provider_name.trim())
    .bind(input.provider_type.trim())
    .bind(input.endpoint.trim())
    .bind(input.model.trim())
    .bind(credential_env)
    .bind(input.timeout_seconds)
    .bind(input.max_file_bytes)
    .bind(input.is_enabled)
    .bind(&actor)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存识别服务配置失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, 'AI自动化', '维护识别服务配置', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(input.company_id.trim())
    .bind(input.provider_name.trim())
    .bind(format!(
        "服务={}，模型={}，凭据来源=环境变量 {}，启用={}",
        input.endpoint.trim(),
        input.model.trim(),
        credential_env,
        input.is_enabled
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入识别服务配置审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交识别服务配置失败: {error}"))?;

    sqlx::query_as(
        r#"SELECT id, company_id, provider_name, provider_type, endpoint, model,
                  credential_env, timeout_seconds, max_file_bytes, is_enabled,
                  created_by, updated_by, created_at, updated_at
           FROM ai_provider_configs
           WHERE company_id = ? AND provider_name = ?"#,
    )
    .bind(input.company_id.trim())
    .bind(input.provider_name.trim())
    .fetch_one(db.pool())
    .await
    .map_err(|error| format!("读取识别服务配置失败: {error}"))
}

#[tauri::command]
pub async fn run_ai_recognition_job(
    input: RunAiRecognitionJobInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AutomationJob, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    require_non_empty(&input.id, "id")?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.provider_config_id, "provider_config_id")?;
    if !input.disclosure_confirmed {
        return Err("必须确认资料将发送到外部识别服务".to_string());
    }

    let job = get_automation_job_by_id(&input.id, &db).await?;
    if job.company_id != input.company_id {
        return Err("自动化任务不属于当前账套".to_string());
    }
    if !matches!(job.status.as_str(), "queued" | "failed") {
        return Err("只有待执行或执行失败的识别任务可以重新提交".to_string());
    }
    if !matches!(
        job.job_type.as_str(),
        "invoice_recognition" | "document_ocr" | "classification"
    ) {
        return Err("当前任务类型不支持外部资料识别".to_string());
    }
    let config: AiProviderConfig = sqlx::query_as(
        r#"SELECT id, company_id, provider_name, provider_type, endpoint, model,
                  credential_env, timeout_seconds, max_file_bytes, is_enabled,
                  created_by, updated_by, created_at, updated_at
           FROM ai_provider_configs
           WHERE id = ? AND company_id = ? AND is_enabled = 1"#,
    )
    .bind(&input.provider_config_id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取识别服务配置失败: {error}"))?
    .ok_or_else(|| "未找到当前账套已启用的识别服务配置".to_string())?;

    let endpoint = validate_ai_provider_endpoint(&config.endpoint)?;
    let resolved_address = validate_ai_provider_destination(&endpoint).await?;
    let source_path_text = job
        .source_file
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "识别任务未选择来源文件".to_string())?;
    let source_path = Path::new(source_path_text);
    if !source_path.is_absolute() {
        return Err("识别来源必须是用户明确选择的本地绝对路径".to_string());
    }
    let mime_type = ai_source_mime(source_path)?;
    let metadata = tokio::fs::metadata(source_path)
        .await
        .map_err(|_| "无法读取识别来源文件".to_string())?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err("识别来源必须是非空文件".to_string());
    }
    let provider_limit = u64::try_from(config.max_file_bytes)
        .unwrap_or(AI_PROVIDER_MAX_FILE_BYTES)
        .min(AI_PROVIDER_MAX_FILE_BYTES);
    if metadata.len() > provider_limit {
        return Err(format!(
            "识别文件超过配置上限 {} MB",
            provider_limit / 1024 / 1024
        ));
    }
    let source_bytes = tokio::fs::read(source_path)
        .await
        .map_err(|_| "无法读取识别来源文件".to_string())?;
    let source_checksum = sha256_hex(&source_bytes);
    let source_file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "识别来源文件名无效".to_string())?;
    let credential = std::env::var(&config.credential_env)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("未配置凭据环境变量 {}", config.credential_env))?;
    let request_fingerprint = sha256_hex(
        format!(
            "{}|{}|{}|{}|{}",
            job.id, config.id, config.model, source_checksum, job.job_type
        )
        .as_bytes(),
    );
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建识别执行事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO ai_provider_runs (
                id, job_id, company_id, provider_config_id, provider_name, model,
                source_file_name, source_checksum, request_fingerprint, status, executed_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)"#,
    )
    .bind(&run_id)
    .bind(&job.id)
    .bind(&job.company_id)
    .bind(&config.id)
    .bind(&config.provider_name)
    .bind(&config.model)
    .bind(source_file_name)
    .bind(&source_checksum)
    .bind(&request_fingerprint)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("登记识别执行失败: {error}"))?;
    sqlx::query(
        "UPDATE automation_jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ? AND company_id = ?",
    )
    .bind(&job.id)
    .bind(&job.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新识别任务状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, 'AI自动化', '提交外部资料识别', ?, 'high', 'pending', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&job.company_id)
    .bind(&job.id)
    .bind(format!(
        "文件={}，校验值={}，服务={}，模型={}，已确认外发",
        source_file_name, source_checksum, config.provider_name, config.model
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入识别提交审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交识别执行失败: {error}"))?;

    let request_payload = json!({
        "model": config.model,
        "task": job.job_type,
        "document": {
            "file_name": source_file_name,
            "mime_type": mime_type,
            "content_base64": BASE64_STANDARD.encode(&source_bytes),
            "sha256": source_checksum,
        },
        "instructions": "识别会计资料并返回结构化结果。不得推断缺失字段；摘要必须标明需要人工复核的疑点。",
        "response_schema": {
            "confidence": "number between 0 and 1",
            "summary": "string, required",
            "risk_level": "normal | medium | high",
            "fields": "object"
        }
    });
    let host = endpoint
        .host_str()
        .ok_or_else(|| "识别服务地址缺少主机名".to_string())?;
    let client = match reqwest::Client::builder()
        .timeout(StdDuration::from_secs(config.timeout_seconds as u64))
        .redirect(RedirectPolicy::none())
        .resolve(host, resolved_address)
        .build()
    {
        Ok(client) => client,
        Err(_) => {
            let message = "创建识别服务客户端失败".to_string();
            fail_ai_provider_run(
                db.pool(),
                &run_id,
                &job.id,
                &job.company_id,
                &actor,
                &message,
                None,
            )
            .await?;
            return Err(message);
        }
    };
    let response = match client
        .post(endpoint)
        .bearer_auth(credential)
        .json(&request_payload)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            let message = if error.is_timeout() {
                "识别服务请求超时".to_string()
            } else {
                "识别服务连接失败".to_string()
            };
            fail_ai_provider_run(
                db.pool(),
                &run_id,
                &job.id,
                &job.company_id,
                &actor,
                &message,
                None,
            )
            .await?;
            return Err(message);
        }
    };
    let http_status = response.status();
    if !http_status.is_success() {
        let message = format!("识别服务返回 HTTP {}", http_status.as_u16());
        fail_ai_provider_run(
            db.pool(),
            &run_id,
            &job.id,
            &job.company_id,
            &actor,
            &message,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(message);
    }
    let response_bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(_) => {
            let message = "无法读取识别服务返回内容".to_string();
            fail_ai_provider_run(
                db.pool(),
                &run_id,
                &job.id,
                &job.company_id,
                &actor,
                &message,
                Some(http_status.as_u16()),
            )
            .await?;
            return Err(message);
        }
    };
    if response_bytes.len() > AI_PROVIDER_MAX_RESPONSE_BYTES {
        let message = "识别服务返回内容超过 1 MB 上限".to_string();
        fail_ai_provider_run(
            db.pool(),
            &run_id,
            &job.id,
            &job.company_id,
            &actor,
            &message,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(message);
    }
    let parsed = match serde_json::from_slice::<AiProviderResponse>(&response_bytes)
        .map_err(|_| "识别服务未返回约定的 JSON 结构".to_string())
        .and_then(validate_ai_provider_response)
    {
        Ok(value) => value,
        Err(message) => {
            fail_ai_provider_run(
                db.pool(),
                &run_id,
                &job.id,
                &job.company_id,
                &actor,
                &message,
                Some(http_status.as_u16()),
            )
            .await?;
            return Err(message);
        }
    };
    let response_payload = String::from_utf8(response_bytes.to_vec())
        .map_err(|_| "识别服务返回内容不是 UTF-8 JSON".to_string())?;
    let response_checksum = sha256_hex(response_payload.as_bytes());
    let risk_level = parsed.risk_level.as_deref().unwrap_or("normal");
    let result_summary = parsed.summary.trim();
    let field_count = parsed
        .fields
        .as_ref()
        .and_then(Value::as_object)
        .map_or(0, serde_json::Map::len);
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建识别结果事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE ai_provider_runs
           SET status = 'pending_review', http_status = ?, response_checksum = ?,
               response_payload = ?, confidence = ?, result_summary = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(http_status.as_u16()))
    .bind(&response_checksum)
    .bind(&response_payload)
    .bind(parsed.confidence)
    .bind(result_summary)
    .bind(&run_id)
    .bind(&job.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存识别结果失败: {error}"))?;
    sqlx::query(
        r#"UPDATE automation_jobs
           SET status = 'pending_review', confidence = ?, result_summary = ?, risk_level = ?,
               reviewer = NULL, updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(parsed.confidence)
    .bind(result_summary)
    .bind(risk_level)
    .bind(&job.id)
    .bind(&job.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新识别任务结果失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, 'AI自动化', '执行资料识别', ?, ?, 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&job.company_id)
    .bind(&job.id)
    .bind(risk_level)
    .bind(format!(
        "返回待人工复核，置信度={:?}，字段数={}，响应校验值={}",
        parsed.confidence, field_count, response_checksum
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入识别结果审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交识别结果失败: {error}"))?;

    get_automation_job_by_id(&job.id, &db).await
}

const TAX_DECLARATION_TASK_SELECT: &str = r#"
        SELECT
            t.id,
            t.company_id,
            c.name AS company_name,
            t.period,
            t.tax_type,
            t.form_name,
            t.collect_status,
            t.validation_status,
            t.declaration_status,
            t.source_snapshot,
            t.taxable_amount,
            t.deduction_amount,
            t.payable_amount,
            t.risk_count,
            t.adapter_code,
            t.confirmed_by,
            t.confirmed_at,
            t.receipt_no,
            t.payment_status,
            t.payment_no,
            t.receipt_received_at,
            t.snapshot_version,
            t.snapshot_fingerprint,
            t.created_at,
            t.updated_at
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.id = ?
        "#;

async fn get_tax_declaration_task_by_id(
    pool: &DbPool,
    id: &str,
) -> Result<TaxDeclarationTask, String> {
    sqlx::query_as(TAX_DECLARATION_TASK_SELECT)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))
}

async fn confirm_tax_declaration_task_for_company(
    pool: &DbPool,
    id: &str,
    company_id: &str,
    confirmed_by: &str,
) -> Result<TaxDeclarationTask, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建申报确认事务失败: {error}"))?;
    let current: TaxDeclarationTask = sqlx::query_as(TAX_DECLARATION_TASK_SELECT)
        .bind(id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("读取申报任务失败: {error}"))?;
    if current.company_id != company_id {
        return Err("Tax declaration task does not belong to this company".to_string());
    }
    if !matches!(current.collect_status.as_str(), "collected" | "已取数") {
        return Err("申报事项尚未完成取数，不能确认".to_string());
    }
    if current.risk_count > 0 {
        return Err("存在未处理风险项，不能确认申报".to_string());
    }
    if current.validation_status != "passed" {
        return Err("校验未通过，不能确认申报".to_string());
    }
    if matches!(
        current.declaration_status.as_str(),
        "confirmed" | "archived" | "submitted" | "completed"
    ) {
        return Err("申报事项已完成本地确认，不能重复确认".to_string());
    }

    let snapshot_version = current.snapshot_version + 1;
    let snapshot_fingerprint = tax_snapshot_fingerprint(
        &current.id,
        snapshot_version,
        &current.collect_status,
        &current.validation_status,
        "confirmed",
        current.source_snapshot.as_deref(),
        current.taxable_amount,
        current.deduction_amount,
        current.payable_amount,
        current.risk_count,
        current.adapter_code.as_deref(),
    );

    sqlx::query(
        r#"
        UPDATE tax_declaration_tasks
        SET declaration_status = 'confirmed',
            confirmed_by = ?,
            confirmed_at = datetime('now'),
            snapshot_version = ?,
            snapshot_fingerprint = ?,
            updated_at = datetime('now')
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(confirmed_by)
    .bind(snapshot_version)
    .bind(&snapshot_fingerprint)
    .bind(id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("确认申报任务失败: {error}"))?;

    write_tax_declaration_snapshot(
        &mut transaction,
        id,
        snapshot_version,
        &snapshot_fingerprint,
        confirmed_by,
    )
    .await?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务申报', '确认申报快照', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(id)
    .bind(format!(
        "快照版本 v{snapshot_version} · 任务指纹 {snapshot_fingerprint}"
    ))
    .bind(confirmed_by)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入申报确认审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交申报确认失败: {error}"))?;

    get_tax_declaration_task_by_id(pool, id).await
}

async fn ensure_tax_declaration_status_update_allowed(
    pool: &DbPool,
    company_id: &str,
    period: &str,
    tax_type: &str,
    form_name: &str,
    requested_status: &str,
) -> Result<(), String> {
    let current_status: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT declaration_status
        FROM tax_declaration_tasks
        WHERE company_id = ? AND period = ? AND tax_type = ? AND form_name = ?
        "#,
    )
    .bind(company_id)
    .bind(period)
    .bind(tax_type)
    .bind(form_name)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let Some((current_status,)) = current_status else {
        return Ok(());
    };
    let is_final_status = matches!(
        current_status.as_str(),
        "confirmed" | "archived" | "submitted" | "completed"
    );
    let allows_receipt_archive = current_status == "confirmed" && requested_status == "archived";
    if is_final_status && !allows_receipt_archive {
        if current_status == requested_status {
            return Err("已完成本地确认的申报事项不能再次覆盖".to_string());
        }
        return Err("已完成本地确认的申报事项不能回退或改写状态".to_string());
    }

    Ok(())
}

async fn get_adapter_authorization_by_key(
    company_id: &str,
    adapter_type: &str,
    adapter_code: &str,
    db: &Database,
) -> Result<AdapterAuthorization, String> {
    sqlx::query_as(
        r#"
        SELECT
            a.id,
            a.company_id,
            c.name AS company_name,
            a.adapter_type,
            a.adapter_code,
            a.region,
            a.auth_status,
            a.account_mask,
            a.login_identity,
            a.capability_scope,
            a.last_checked_at,
            a.expires_at,
            a.risk_message,
            a.created_at,
            a.updated_at
        FROM adapter_authorizations a
        LEFT JOIN companies c ON c.id = a.company_id
        WHERE a.company_id = ? AND a.adapter_type = ? AND a.adapter_code = ?
        "#,
    )
    .bind(company_id)
    .bind(adapter_type)
    .bind(adapter_code)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

async fn get_adapter_authorization_by_id(
    company_id: &str,
    authorization_id: &str,
    db: &Database,
) -> Result<AdapterAuthorization, String> {
    sqlx::query_as(
        r#"SELECT a.id, a.company_id, c.name AS company_name, a.adapter_type,
                  a.adapter_code, a.region, a.auth_status, a.account_mask,
                  a.login_identity, a.capability_scope, a.last_checked_at,
                  a.expires_at, a.risk_message, a.created_at, a.updated_at
           FROM adapter_authorizations a
           LEFT JOIN companies c ON c.id = a.company_id
           WHERE a.id = ? AND a.company_id = ?"#,
    )
    .bind(authorization_id)
    .bind(company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取接口授权失败: {error}"))?
    .ok_or_else(|| "接口授权记录不存在或不属于当前账套".to_string())
}

async fn get_enabled_adapter_provider_config(
    company_id: &str,
    authorization_id: &str,
    db: &Database,
) -> Result<AdapterProviderConfig, String> {
    let config: AdapterProviderConfig = sqlx::query_as(
        r#"SELECT id, company_id, authorization_id, provider_name, endpoint,
                  credential_env, timeout_seconds, is_enabled, created_by,
                  updated_by, created_at, updated_at
           FROM adapter_provider_configs
           WHERE company_id = ? AND authorization_id = ?"#,
    )
    .bind(company_id)
    .bind(authorization_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取接口连接配置失败: {error}"))?
    .ok_or_else(|| "请先配置并验证外部接口连接".to_string())?;
    if config.is_enabled == 0 {
        return Err("外部接口连接已停用".to_string());
    }
    Ok(config)
}

fn adapter_capability_allows(authorization: &AdapterAuthorization, action: &str) -> bool {
    let scope = authorization
        .capability_scope
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    match action {
        "tax_submit" => scope.contains("tax_submit") || scope.contains("申报"),
        "tax_receipt_sync" => {
            scope.contains("tax_receipt_sync")
                || scope.contains("receipt")
                || scope.contains("回执")
        }
        "invoice_pool_sync" => {
            scope.contains("invoice_pool_sync")
                || scope.contains("invoice")
                || scope.contains("发票")
                || scope.contains("票池")
        }
        "bank_statement_sync" => {
            scope.contains("bank_statement_sync")
                || scope.contains("bank")
                || scope.contains("流水")
                || scope.contains("银行")
        }
        _ => false,
    }
}

fn ensure_authorized_bank_adapter(authorization: &AdapterAuthorization) -> Result<(), String> {
    if authorization.adapter_type != "bank" {
        return Err("所选授权渠道不是银行渠道".to_string());
    }
    if authorization.auth_status != "authorized" {
        return Err("所选银行渠道尚未通过真实连接验证".to_string());
    }
    if let Some(expires_at) = authorization.expires_at.as_deref() {
        let date_text = expires_at.get(..10).unwrap_or(expires_at);
        if let Ok(expires_on) = NaiveDate::parse_from_str(date_text, "%Y-%m-%d") {
            if expires_on < Utc::now().date_naive() {
                return Err("所选银行渠道授权已过期，请重新验证".to_string());
            }
        }
    }
    if !adapter_capability_allows(authorization, "bank_statement_sync") {
        return Err("所选银行渠道未验证流水同步能力".to_string());
    }
    Ok(())
}

fn ensure_authorized_invoice_pool_adapter(
    authorization: &AdapterAuthorization,
) -> Result<(), String> {
    if authorization.adapter_type != "invoice_pool" {
        return Err("所选授权渠道不是发票票池渠道".to_string());
    }
    if authorization.auth_status != "authorized" {
        return Err("所选发票票池渠道尚未通过真实连接验证".to_string());
    }
    if let Some(expires_at) = authorization.expires_at.as_deref() {
        let date_text = expires_at.get(..10).unwrap_or(expires_at);
        if let Ok(expires_on) = NaiveDate::parse_from_str(date_text, "%Y-%m-%d") {
            if expires_on < Utc::now().date_naive() {
                return Err("所选发票票池渠道授权已过期，请重新验证".to_string());
            }
        }
    }
    if !adapter_capability_allows(authorization, "invoice_pool_sync") {
        return Err("所选发票票池渠道未验证发票同步能力".to_string());
    }
    Ok(())
}

fn ensure_authorized_tax_adapter(
    task: &TaxDeclarationTask,
    authorization: &AdapterAuthorization,
    action: &str,
) -> Result<(), String> {
    if authorization.company_id != task.company_id || authorization.adapter_type != "tax" {
        return Err("所选授权渠道不属于当前账套或不是税务渠道".to_string());
    }
    if authorization.auth_status != "authorized" {
        return Err("所选税务渠道尚未通过真实连接验证".to_string());
    }
    if let Some(expires_at) = authorization.expires_at.as_deref() {
        let date_text = expires_at.get(..10).unwrap_or(expires_at);
        if let Ok(expires_on) = NaiveDate::parse_from_str(date_text, "%Y-%m-%d") {
            if expires_on < Utc::now().date_naive() {
                return Err("所选税务渠道授权已过期，请重新验证".to_string());
            }
        }
    }
    let adapter_code = task
        .adapter_code
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "申报任务未指定税务渠道".to_string())?;
    if adapter_code != authorization.adapter_code {
        return Err("申报任务与所选税务渠道不匹配".to_string());
    }
    if !adapter_capability_allows(authorization, action) {
        return Err("所选税务渠道未验证当前操作能力".to_string());
    }
    Ok(())
}

fn ensure_tax_submission_ready(task: &TaxDeclarationTask) -> Result<(), String> {
    if !matches!(task.collect_status.as_str(), "collected" | "已取数") {
        return Err("申报事项尚未完成取数，不能提交税局".to_string());
    }
    if task.validation_status != "passed" {
        return Err("申报事项校验未通过，不能提交税局".to_string());
    }
    if task.risk_count != 0 {
        return Err("申报事项仍有未处理风险，不能提交税局".to_string());
    }
    if task.declaration_status != "confirmed" {
        return Err("申报事项必须先完成本地确认快照".to_string());
    }
    if task.snapshot_version <= 0
        || task
            .snapshot_fingerprint
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
    {
        return Err("申报事项缺少不可变确认快照".to_string());
    }
    Ok(())
}

fn validate_invoice_pool_item(item: &InvoicePoolItemResponse, period: &str) -> Result<(), String> {
    if item.external_invoice_id.trim().is_empty()
        || item.external_invoice_id.chars().count() > 256
        || item.invoice_no.trim().is_empty()
        || item.invoice_no.chars().count() > 128
        || item.invoice_type.trim().is_empty()
        || item.invoice_type.chars().count() > 64
    {
        return Err("票池发票标识、号码或类型不符合长度约定".to_string());
    }
    if item.invoice_type != "input" {
        return Err("进项票池同步只接受进项发票".to_string());
    }
    let invoice_date = NaiveDate::parse_from_str(item.invoice_date.trim(), "%Y-%m-%d")
        .map_err(|_| "票池发票日期格式无效".to_string())?;
    if invoice_date.format("%Y-%m").to_string() != period {
        return Err("票池发票不属于当前同步账期".to_string());
    }
    let currency = item.currency.as_deref().unwrap_or("CNY");
    if currency != "CNY" {
        return Err("当前账套仅支持人民币票池发票".to_string());
    }
    if !item.amount.is_finite()
        || !item.tax_amount.is_finite()
        || !item.total_amount.is_finite()
        || item.amount < 0.0
        || item.tax_amount < 0.0
        || item.total_amount < 0.0
        || (item.amount + item.tax_amount - item.total_amount).abs() > 0.02
    {
        return Err("票池发票金额、税额与价税合计不勾稽".to_string());
    }
    if item.lines.is_empty() || item.lines.len() > 100 {
        return Err("票池发票必须包含 1 至 100 条明细".to_string());
    }
    let mut line_amount = 0.0;
    let mut line_tax = 0.0;
    for line in &item.lines {
        if line.item_name.trim().is_empty()
            || line.item_name.chars().count() > 256
            || !line.amount.is_finite()
            || !line.tax_amount.is_finite()
            || line.amount < 0.0
            || line.tax_amount < 0.0
        {
            return Err("票池发票明细名称或金额无效".to_string());
        }
        line_amount += line.amount;
        line_tax += line.tax_amount;
    }
    if (line_amount - item.amount).abs() > 0.02 || (line_tax - item.tax_amount).abs() > 0.02 {
        return Err("票池发票明细与发票头金额不勾稽".to_string());
    }
    Ok(())
}

fn validate_bank_statement_item(
    item: &BankStatementItemResponse,
    period: &str,
) -> Result<(), String> {
    if item.external_transaction_id.trim().is_empty()
        || item.external_transaction_id.chars().count() > 256
        || item.account_mask.trim().is_empty()
        || item.account_mask.chars().count() > 128
    {
        return Err("银行流水外部标识或账号掩码不符合长度约定".to_string());
    }
    if !matches!(item.direction.as_str(), "income" | "expense") {
        return Err("银行流水方向必须为收入或支出".to_string());
    }
    let transaction_date = NaiveDate::parse_from_str(item.transaction_date.trim(), "%Y-%m-%d")
        .map_err(|_| "银行流水交易日期格式无效".to_string())?;
    if transaction_date.format("%Y-%m").to_string() != period {
        return Err("银行流水不属于当前同步账期".to_string());
    }
    if let Some(value_date) = item.value_date.as_deref() {
        NaiveDate::parse_from_str(value_date.trim(), "%Y-%m-%d")
            .map_err(|_| "银行流水入账日期格式无效".to_string())?;
    }
    if item.currency.as_deref().unwrap_or("CNY") != "CNY" {
        return Err("当前账套仅支持人民币银行流水".to_string());
    }
    if !item.amount.is_finite() || item.amount <= 0.0 {
        return Err("银行流水金额必须为大于零的有限数值".to_string());
    }
    if item.balance.is_some_and(|value| !value.is_finite()) {
        return Err("银行流水余额必须为有限数值".to_string());
    }
    for value in [
        item.counterparty_name.as_deref(),
        item.counterparty_account_mask.as_deref(),
        item.bank_reference.as_deref(),
        item.summary.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if value.chars().count() > 512 {
            return Err("银行流水文本字段超过长度上限".to_string());
        }
    }
    Ok(())
}

async fn fail_external_adapter_execution(
    pool: &DbPool,
    execution_id: &str,
    company_id: &str,
    object_id: &str,
    action: &str,
    actor: &str,
    message: &str,
    http_status: Option<u16>,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建外部接口失败事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'failed', http_status = ?, error_message = ?,
               completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(http_status.map(i64::from))
    .bind(message)
    .bind(execution_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("记录外部接口失败状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务申报', ?, ?, 'high', 'failed', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(action)
    .bind(object_id)
    .bind(message)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入外部接口失败审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交外部接口失败事务失败: {error}"))
}

async fn fail_invoice_pool_sync(
    pool: &DbPool,
    batch_id: &str,
    execution_id: &str,
    company_id: &str,
    actor: &str,
    message: &str,
    http_status: Option<u16>,
) -> Result<(), String> {
    sqlx::query(
        r#"UPDATE external_invoice_sync_batches
           SET status = 'failed', error_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(message)
    .bind(batch_id)
    .bind(company_id)
    .execute(pool)
    .await
    .map_err(|error| format!("记录票池同步失败状态失败: {error}"))?;
    fail_external_adapter_execution(
        pool,
        execution_id,
        company_id,
        batch_id,
        "同步发票票池",
        actor,
        message,
        http_status,
    )
    .await
}

async fn fail_bank_statement_sync(
    pool: &DbPool,
    batch_id: &str,
    execution_id: &str,
    company_id: &str,
    actor: &str,
    message: &str,
    http_status: Option<u16>,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建银行流水同步失败事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_bank_sync_batches
           SET status = 'failed', error_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(message)
    .bind(batch_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("记录银行流水同步失败状态失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'failed', http_status = ?, error_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(http_status.map(i64::from))
    .bind(message)
    .bind(execution_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("记录银行流水接口失败状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '银行流水', '同步银行流水', ?, 'medium', 'failed', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(batch_id)
    .bind(message)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入银行流水同步失败审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交银行流水同步失败事务失败: {error}"))
}

async fn fail_adapter_verification(
    pool: &DbPool,
    verification_id: &str,
    authorization_id: &str,
    company_id: &str,
    actor: &str,
    message: &str,
    http_status: Option<u16>,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("创建接口验证失败事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE adapter_provider_verifications
           SET status = 'failed', http_status = ?, error_message = ?,
               completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(http_status.map(i64::from))
    .bind(message)
    .bind(verification_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新接口验证失败状态失败: {error}"))?;
    sqlx::query(
        r#"UPDATE adapter_authorizations
           SET auth_status = 'configured', risk_message = ?,
               last_checked_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(message)
    .bind(authorization_id)
    .bind(company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新接口授权失败状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '接口授权', '验证外部接口连接', ?, 'high', 'failure', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(company_id)
    .bind(authorization_id)
    .bind(message)
    .bind(actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入接口验证失败审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交接口验证失败留痕失败: {error}"))
}

#[tauri::command]
pub async fn get_adapter_provider_config(
    company_id: String,
    authorization_id: String,
    db: State<'_, Database>,
) -> Result<Option<AdapterProviderConfig>, String> {
    require_non_empty(&company_id, "company_id")?;
    require_non_empty(&authorization_id, "authorization_id")?;
    sqlx::query_as(
        r#"SELECT id, company_id, authorization_id, provider_name, endpoint,
                  credential_env, timeout_seconds, is_enabled, created_by,
                  updated_by, created_at, updated_at
           FROM adapter_provider_configs
           WHERE company_id = ? AND authorization_id = ?"#,
    )
    .bind(company_id.trim())
    .bind(authorization_id.trim())
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取接口连接配置失败: {error}"))
}

#[tauri::command]
pub async fn upsert_adapter_provider_config(
    input: UpsertAdapterProviderConfigInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AdapterProviderConfig, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    for (value, field) in [
        (&input.company_id, "company_id"),
        (&input.authorization_id, "authorization_id"),
        (&input.provider_name, "provider_name"),
        (&input.endpoint, "endpoint"),
        (&input.credential_env, "credential_env"),
    ] {
        require_non_empty(value, field)?;
    }
    validate_external_provider_endpoint(&input.endpoint)?;
    let credential_env = validate_credential_env(&input.credential_env)?;
    if !(5..=120).contains(&input.timeout_seconds) {
        return Err("接口连接超时时间必须在 5 到 120 秒之间".to_string());
    }
    if !matches!(input.is_enabled, 0 | 1) {
        return Err("启用状态无效".to_string());
    }
    get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    let id = input
        .id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建接口连接配置事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO adapter_provider_configs
           (id, company_id, authorization_id, provider_name, endpoint, credential_env,
            timeout_seconds, is_enabled, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(authorization_id) DO UPDATE SET
             provider_name = excluded.provider_name,
             endpoint = excluded.endpoint,
             credential_env = excluded.credential_env,
             timeout_seconds = excluded.timeout_seconds,
             is_enabled = excluded.is_enabled,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')"#,
    )
    .bind(&id)
    .bind(input.company_id.trim())
    .bind(input.authorization_id.trim())
    .bind(input.provider_name.trim())
    .bind(input.endpoint.trim())
    .bind(credential_env)
    .bind(input.timeout_seconds)
    .bind(input.is_enabled)
    .bind(&actor)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存接口连接配置失败: {error}"))?;
    sqlx::query(
        r#"UPDATE adapter_authorizations
           SET auth_status = 'configured', last_checked_at = NULL, expires_at = NULL,
               risk_message = '连接配置已变更，需要重新验证', updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(input.authorization_id.trim())
    .bind(input.company_id.trim())
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("重置接口授权验证状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '接口授权', '维护外部接口连接', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(input.company_id.trim())
    .bind(input.authorization_id.trim())
    .bind(format!(
        "服务={}，地址={}，凭据来源=环境变量 {}，启用={}",
        input.provider_name.trim(),
        input.endpoint.trim(),
        credential_env,
        input.is_enabled
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入接口连接配置审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交接口连接配置失败: {error}"))?;

    get_adapter_provider_config(input.company_id, input.authorization_id, db)
        .await?
        .ok_or_else(|| "接口连接配置保存后未找到".to_string())
}

#[tauri::command]
pub async fn verify_adapter_authorization(
    input: VerifyAdapterAuthorizationInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AdapterAuthorization, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.authorization_id, "authorization_id")?;
    let authorization =
        get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    let config: AdapterProviderConfig = sqlx::query_as(
        r#"SELECT id, company_id, authorization_id, provider_name, endpoint,
                  credential_env, timeout_seconds, is_enabled, created_by,
                  updated_by, created_at, updated_at
           FROM adapter_provider_configs
           WHERE company_id = ? AND authorization_id = ? AND is_enabled = 1"#,
    )
    .bind(input.company_id.trim())
    .bind(input.authorization_id.trim())
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取接口连接配置失败: {error}"))?
    .ok_or_else(|| "当前授权项尚未配置并启用真实接口连接".to_string())?;
    let endpoint = validate_external_provider_endpoint(&config.endpoint)?;
    let resolved_address = validate_external_provider_destination(&endpoint).await?;
    let credential = std::env::var(&config.credential_env)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("未配置凭据环境变量 {}", config.credential_env))?;
    let nonce = uuid::Uuid::new_v4().to_string();
    let request_fingerprint = sha256_hex(
        format!(
            "{}|{}|{}|{}|{}",
            authorization.id,
            authorization.adapter_type,
            authorization.adapter_code,
            config.id,
            nonce
        )
        .as_bytes(),
    );
    let verification_id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建接口验证事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO adapter_provider_verifications
           (id, company_id, authorization_id, provider_config_id,
            request_fingerprint, status, verified_by)
           VALUES (?, ?, ?, ?, ?, 'running', ?)"#,
    )
    .bind(&verification_id)
    .bind(&input.company_id)
    .bind(&input.authorization_id)
    .bind(&config.id)
    .bind(&request_fingerprint)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("登记接口验证任务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '接口授权', '验证外部接口连接', ?, 'high', 'pending', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.authorization_id)
    .bind(format!(
        "服务={}，授权类型={}，接口代码={}，请求指纹={}",
        config.provider_name,
        authorization.adapter_type,
        authorization.adapter_code,
        request_fingerprint
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入接口验证提交审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交接口验证任务失败: {error}"))?;

    let request_payload = json!({
        "action": "verify_authorization",
        "company_id": input.company_id,
        "adapter_type": authorization.adapter_type,
        "adapter_code": authorization.adapter_code,
        "region": authorization.region,
        "nonce": nonce,
        "request_fingerprint": request_fingerprint,
    });
    let host = endpoint
        .host_str()
        .ok_or_else(|| "外部接口地址缺少主机名".to_string())?;
    let client = match reqwest::Client::builder()
        .timeout(StdDuration::from_secs(config.timeout_seconds as u64))
        .redirect(RedirectPolicy::none())
        .resolve(host, resolved_address)
        .build()
    {
        Ok(client) => client,
        Err(_) => {
            let message = "创建外部接口客户端失败".to_string();
            fail_adapter_verification(
                db.pool(),
                &verification_id,
                &input.authorization_id,
                &input.company_id,
                &actor,
                &message,
                None,
            )
            .await?;
            return Err(message);
        }
    };
    let response = match client
        .post(endpoint)
        .bearer_auth(credential)
        .json(&request_payload)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            let message = if error.is_timeout() {
                "外部接口连接验证超时".to_string()
            } else {
                "外部接口连接验证失败".to_string()
            };
            fail_adapter_verification(
                db.pool(),
                &verification_id,
                &input.authorization_id,
                &input.company_id,
                &actor,
                &message,
                None,
            )
            .await?;
            return Err(message);
        }
    };
    let http_status = response.status();
    if !http_status.is_success() {
        let message = format!("外部接口返回 HTTP {}", http_status.as_u16());
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &message,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(message);
    }
    let response_bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(_) => {
            let message = "无法读取外部接口返回内容".to_string();
            fail_adapter_verification(
                db.pool(),
                &verification_id,
                &input.authorization_id,
                &input.company_id,
                &actor,
                &message,
                Some(http_status.as_u16()),
            )
            .await?;
            return Err(message);
        }
    };
    if response_bytes.len() > EXTERNAL_ADAPTER_MAX_RESPONSE_BYTES {
        let message = "外部接口返回内容超过 256 KB 上限".to_string();
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &message,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(message);
    }
    let parsed: ExternalAdapterVerificationResponse = match serde_json::from_slice(&response_bytes)
    {
        Ok(value) => value,
        Err(_) => {
            let message = "外部接口未返回约定的授权验证 JSON".to_string();
            fail_adapter_verification(
                db.pool(),
                &verification_id,
                &input.authorization_id,
                &input.company_id,
                &actor,
                &message,
                Some(http_status.as_u16()),
            )
            .await?;
            return Err(message);
        }
    };
    let message = parsed.message.as_deref().unwrap_or_default().trim();
    if message.chars().count() > 1000 {
        let failure = "外部接口返回说明超过 1000 字".to_string();
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &failure,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(failure);
    }
    if !parsed.authorized {
        let failure = if message.is_empty() {
            "外部接口未确认当前授权".to_string()
        } else {
            message.to_string()
        };
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &failure,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(failure);
    }
    let capabilities = parsed.capability_scope.unwrap_or_default();
    if capabilities.len() > 50
        || capabilities
            .iter()
            .any(|value| value.trim().is_empty() || value.chars().count() > 100)
    {
        let failure = "外部接口返回的能力范围无效".to_string();
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &failure,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(failure);
    }
    if parsed
        .external_reference
        .as_deref()
        .is_some_and(|value| value.chars().count() > 256)
        || parsed
            .account_mask
            .as_deref()
            .is_some_and(|value| value.chars().count() > 128)
        || parsed
            .expires_at
            .as_deref()
            .is_some_and(|value| value.chars().count() > 64)
    {
        let failure = "外部接口返回的授权标识或有效期无效".to_string();
        fail_adapter_verification(
            db.pool(),
            &verification_id,
            &input.authorization_id,
            &input.company_id,
            &actor,
            &failure,
            Some(http_status.as_u16()),
        )
        .await?;
        return Err(failure);
    }
    let capability_scope = capabilities.join("、");
    let response_checksum = sha256_hex(&response_bytes);
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建接口验证完成事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE adapter_provider_verifications
           SET status = 'succeeded', http_status = ?, response_checksum = ?,
               external_reference = ?, account_mask = ?, capability_scope = ?,
               expires_at = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(http_status.as_u16()))
    .bind(&response_checksum)
    .bind(&parsed.external_reference)
    .bind(&parsed.account_mask)
    .bind(&capability_scope)
    .bind(&parsed.expires_at)
    .bind(&verification_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新接口验证结果失败: {error}"))?;
    sqlx::query(
        r#"UPDATE adapter_authorizations
           SET auth_status = 'authorized',
               account_mask = COALESCE(?, account_mask),
               login_identity = COALESCE(?, login_identity),
               capability_scope = ?, expires_at = ?, risk_message = NULL,
               last_checked_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(&parsed.account_mask)
    .bind(&parsed.external_reference)
    .bind(&capability_scope)
    .bind(&parsed.expires_at)
    .bind(&input.authorization_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新已验证授权状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '接口授权', '验证外部接口连接', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.authorization_id)
    .bind(format!(
        "服务={}，响应校验值={}，能力范围={}，到期={}",
        config.provider_name,
        response_checksum,
        if capability_scope.is_empty() {
            "未声明"
        } else {
            &capability_scope
        },
        parsed.expires_at.as_deref().unwrap_or("未声明")
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入接口验证成功审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交接口验证结果失败: {error}"))?;

    get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await
}

#[tauri::command]
pub async fn get_automation_jobs(
    company_id: String,
    period: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AutomationJob>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
        r#"
        SELECT
            j.id,
            j.company_id,
            c.name AS company_name,
            j.period,
            j.job_type,
            j.source_module,
            j.source_id,
            j.source_file,
            j.suggestion_no,
            j.debit_subject,
            j.credit_subject,
            j.suggestion_amount,
            j.generated_voucher_id,
            j.generated_voucher_number,
            j.status,
            j.confidence,
            j.result_summary,
            j.risk_level,
            j.reviewer,
            j.created_by,
            j.created_at,
            j.updated_at
        FROM automation_jobs j
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.company_id = ?
          AND (? IS NULL OR j.period = ?)
          AND (? IS NULL OR j.status = ?)
        ORDER BY j.created_at DESC
        "#,
    )
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&status)
    .bind(&status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn create_automation_job(
    input: CreateAutomationJobInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AutomationJob, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.job_type, "job_type")?;
    require_non_empty(&input.source_module, "source_module")?;

    let id = uuid::Uuid::new_v4().to_string();
    let status = default_string(input.status, "queued");
    let risk_level = default_string(input.risk_level, "normal");

    sqlx::query(
        r#"
        INSERT INTO automation_jobs (
            id, company_id, period, job_type, source_module, source_id, source_file,
            suggestion_no, debit_subject, credit_subject, suggestion_amount,
            status, confidence, result_summary, risk_level, reviewer, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.job_type)
    .bind(&input.source_module)
    .bind(&input.source_id)
    .bind(&input.source_file)
    .bind(&input.suggestion_no)
    .bind(&input.debit_subject)
    .bind(&input.credit_subject)
    .bind(input.suggestion_amount)
    .bind(&status)
    .bind(input.confidence)
    .bind(&input.result_summary)
    .bind(&risk_level)
    .bind(&input.reviewer)
    .bind(&actor)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_automation_job_by_id(&id, &db).await
}

#[tauri::command]
pub async fn update_automation_job_status(
    input: UpdateAutomationJobStatusInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AutomationJob, String> {
    require_non_empty(&input.id, "id")?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.status, "status")?;
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|e| format!("Transaction error: {}", e))?;

    let result = sqlx::query(
        r#"
        UPDATE automation_jobs
        SET
            status = ?,
            confidence = COALESCE(?, confidence),
            result_summary = COALESCE(?, result_summary),
            risk_level = COALESCE(?, risk_level),
            reviewer = ?,
            updated_at = datetime('now')
        WHERE id = ? AND company_id = ?
        "#,
    )
    .bind(&input.status)
    .bind(input.confidence)
    .bind(&input.result_summary)
    .bind(&input.risk_level)
    .bind(&actor)
    .bind(&input.id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    if result.rows_affected() != 1 {
        return Err("自动化任务不存在或不属于当前账套".to_string());
    }

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, 'AI自动化', '复核自动化任务', ?, ?, 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.id)
    .bind(input.risk_level.as_deref().unwrap_or("normal"))
    .bind(format!("任务状态更新为 {}", input.status))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to write automation review audit log: {}", e))?;

    transaction
        .commit()
        .await
        .map_err(|e| format!("Commit error: {}", e))?;

    get_automation_job_by_id(&input.id, &db).await
}

#[tauri::command]
pub async fn get_tax_declaration_tasks(
    company_id: String,
    period: Option<String>,
    declaration_status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<TaxDeclarationTask>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
        r#"
        SELECT
            t.id,
            t.company_id,
            c.name AS company_name,
            t.period,
            t.tax_type,
            t.form_name,
            t.collect_status,
            t.validation_status,
            t.declaration_status,
            t.source_snapshot,
            t.taxable_amount,
            t.deduction_amount,
            t.payable_amount,
            t.risk_count,
            t.adapter_code,
            t.confirmed_by,
            t.confirmed_at,
            t.receipt_no,
            t.payment_status,
            t.payment_no,
            t.receipt_received_at,
            t.snapshot_version,
            t.snapshot_fingerprint,
            t.created_at,
            t.updated_at
        FROM tax_declaration_tasks t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.company_id = ?
          AND (? IS NULL OR t.period = ?)
          AND (? IS NULL OR t.declaration_status = ?)
        ORDER BY t.period DESC, t.tax_type ASC, t.form_name ASC
        "#,
    )
    .bind(&company_id)
    .bind(&period)
    .bind(&period)
    .bind(&declaration_status)
    .bind(&declaration_status)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_tax_deadline_rules(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<TaxDeadlineRule>, String> {
    require_non_empty(&company_id, "company_id")?;
    sqlx::query_as(
        r#"SELECT * FROM tax_deadline_rules
           WHERE company_id = ?
           ORDER BY is_active DESC, tax_type, effective_from DESC"#,
    )
    .bind(company_id)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取税务期限规则失败: {error}"))
}

#[tauri::command]
pub async fn upsert_tax_deadline_rule(
    input: UpsertTaxDeadlineRuleInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxDeadlineRule, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.tax_type, "tax_type")?;
    require_non_empty(&input.source_name, "source_name")?;
    if !matches!(
        input.filing_frequency.as_str(),
        "monthly" | "quarterly" | "annual" | "event"
    ) {
        return Err("申报频率必须为月度、季度、年度或按次".to_string());
    }
    if !matches!(input.adjustment_policy.as_str(), "next_workday" | "none") {
        return Err("工作日调整规则无效".to_string());
    }
    if !(0..=24).contains(&input.due_month_offset) || !(1..=31).contains(&input.due_day) {
        return Err("月份偏移须为 0-24，截止日须为 1-31".to_string());
    }
    let effective_from = NaiveDate::parse_from_str(&input.effective_from, "%Y-%m-%d")
        .map_err(|_| "生效日期必须使用 YYYY-MM-DD 格式".to_string())?;
    if let Some(effective_to) = input.effective_to.as_deref() {
        let effective_to = NaiveDate::parse_from_str(effective_to, "%Y-%m-%d")
            .map_err(|_| "失效日期必须使用 YYYY-MM-DD 格式".to_string())?;
        if effective_to < effective_from {
            return Err("失效日期不能早于生效日期".to_string());
        }
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建期限规则事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO tax_deadline_rules
           (id, company_id, tax_type, filing_frequency, due_month_offset, due_day,
            adjustment_policy, effective_from, effective_to, source_name, source_url,
            is_active, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(company_id, tax_type, filing_frequency, effective_from) DO UPDATE SET
             due_month_offset = excluded.due_month_offset,
             due_day = excluded.due_day,
             adjustment_policy = excluded.adjustment_policy,
             effective_to = excluded.effective_to,
             source_name = excluded.source_name,
             source_url = excluded.source_url,
             is_active = excluded.is_active,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.tax_type)
    .bind(&input.filing_frequency)
    .bind(input.due_month_offset)
    .bind(input.due_day)
    .bind(&input.adjustment_policy)
    .bind(&input.effective_from)
    .bind(&input.effective_to)
    .bind(&input.source_name)
    .bind(&input.source_url)
    .bind(input.is_active.unwrap_or(1))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存税务期限规则失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务期限', '维护申报期限规则', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(format!("{}:{}", input.tax_type, input.filing_frequency))
    .bind(format!(
        "生效 {}，截止为偏移 {} 月第 {} 日，来源 {}",
        input.effective_from, input.due_month_offset, input.due_day, input.source_name
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入税务期限规则审计失败: {error}"))?;
    let rule: TaxDeadlineRule = sqlx::query_as(
        r#"SELECT * FROM tax_deadline_rules
           WHERE company_id = ? AND tax_type = ? AND filing_frequency = ? AND effective_from = ?"#,
    )
    .bind(&input.company_id)
    .bind(&input.tax_type)
    .bind(&input.filing_frequency)
    .bind(&input.effective_from)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取税务期限规则失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交税务期限规则失败: {error}"))?;
    Ok(rule)
}

#[tauri::command]
pub async fn get_tax_calendar_days(
    company_id: String,
    year: i32,
    db: State<'_, Database>,
) -> Result<Vec<TaxCalendarDay>, String> {
    require_non_empty(&company_id, "company_id")?;
    if !(2000..=2100).contains(&year) {
        return Err("日历年份无效".to_string());
    }
    sqlx::query_as(
        r#"SELECT * FROM tax_calendar_days
           WHERE company_id = ? AND substr(calendar_date, 1, 4) = ?
           ORDER BY calendar_date"#,
    )
    .bind(company_id)
    .bind(format!("{year:04}"))
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取税务工作日覆盖失败: {error}"))
}

#[tauri::command]
pub async fn upsert_tax_calendar_day(
    input: UpsertTaxCalendarDayInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxCalendarDay, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.reason, "reason")?;
    require_non_empty(&input.source_name, "source_name")?;
    NaiveDate::parse_from_str(&input.calendar_date, "%Y-%m-%d")
        .map_err(|_| "日历日期必须使用 YYYY-MM-DD 格式".to_string())?;
    if !matches!(input.day_type.as_str(), "holiday" | "workday") {
        return Err("日历类型必须为休息日或调休工作日".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建税务工作日事务失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO tax_calendar_days
           (id, company_id, calendar_date, day_type, reason, source_name, source_url, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(company_id, calendar_date) DO UPDATE SET
             day_type = excluded.day_type,
             reason = excluded.reason,
             source_name = excluded.source_name,
             source_url = excluded.source_url,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')"#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.calendar_date)
    .bind(&input.day_type)
    .bind(&input.reason)
    .bind(&input.source_name)
    .bind(&input.source_url)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存税务工作日覆盖失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务期限', '维护工作日覆盖', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.calendar_date)
    .bind(format!(
        "{}：{}，来源 {}",
        input.day_type, input.reason, input.source_name
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入税务工作日审计失败: {error}"))?;
    let day: TaxCalendarDay = sqlx::query_as(
        "SELECT * FROM tax_calendar_days WHERE company_id = ? AND calendar_date = ?",
    )
    .bind(&input.company_id)
    .bind(&input.calendar_date)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取税务工作日覆盖失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交税务工作日覆盖失败: {error}"))?;
    Ok(day)
}

#[tauri::command]
pub async fn get_tax_declaration_schedules(
    company_id: String,
    period: String,
    db: State<'_, Database>,
) -> Result<Vec<TaxDeclarationSchedule>, String> {
    require_non_empty(&company_id, "company_id")?;
    let (period_year, period_month) = parse_tax_period(&period)?;
    let period_start = format!("{period_year:04}-{period_month:02}-01");
    let period_end = format!(
        "{period_year:04}-{period_month:02}-{:02}",
        month_last_day(period_year, period_month)?
    );
    let tasks: Vec<(String, String, String, String)> = sqlx::query_as(
        r#"SELECT id, tax_type, form_name, period FROM tax_declaration_tasks
           WHERE company_id = ? AND period = ?
           ORDER BY tax_type, form_name"#,
    )
    .bind(&company_id)
    .bind(&period)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取申报排期任务失败: {error}"))?;
    let rules: Vec<TaxDeadlineRule> = sqlx::query_as(
        r#"SELECT * FROM tax_deadline_rules
           WHERE company_id = ? AND is_active = 1
             AND effective_from <= ?
             AND (effective_to IS NULL OR effective_to >= ?)
           ORDER BY effective_from DESC"#,
    )
    .bind(&company_id)
    .bind(&period_end)
    .bind(&period_start)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取有效税务期限规则失败: {error}"))?;
    let calendar_days: Vec<TaxCalendarDay> =
        sqlx::query_as("SELECT * FROM tax_calendar_days WHERE company_id = ?")
            .bind(&company_id)
            .fetch_all(db.pool())
            .await
            .map_err(|error| format!("读取税务工作日覆盖失败: {error}"))?;
    let overrides: HashMap<NaiveDate, String> = calendar_days
        .into_iter()
        .filter_map(|day| {
            NaiveDate::parse_from_str(&day.calendar_date, "%Y-%m-%d")
                .ok()
                .map(|date| (date, day.day_type))
        })
        .collect();

    tasks
        .into_iter()
        .map(|(task_id, tax_type, form_name, task_period)| {
            let rule = rules.iter().find(|rule| rule.tax_type == tax_type);
            let Some(rule) = rule else {
                return Ok(TaxDeclarationSchedule {
                    task_id,
                    tax_type,
                    form_name,
                    period: task_period,
                    due_date: None,
                    rule_id: None,
                    filing_frequency: None,
                    calculation_basis: None,
                    source_name: None,
                    source_url: None,
                    configuration_status: "unconfigured".to_string(),
                });
            };
            let due_date = calculate_tax_due_date(
                &task_period,
                rule.due_month_offset,
                rule.due_day,
                &rule.adjustment_policy,
                &overrides,
            )?;
            Ok(TaxDeclarationSchedule {
                task_id,
                tax_type,
                form_name,
                period: task_period,
                due_date: Some(due_date.format("%Y-%m-%d").to_string()),
                rule_id: Some(rule.id.clone()),
                filing_frequency: Some(rule.filing_frequency.clone()),
                calculation_basis: Some(format!(
                    "所属期后第 {} 月 {} 日{}",
                    rule.due_month_offset,
                    rule.due_day,
                    if rule.adjustment_policy == "next_workday" {
                        "，遇非工作日顺延"
                    } else {
                        ""
                    }
                )),
                source_name: Some(rule.source_name.clone()),
                source_url: rule.source_url.clone(),
                configuration_status: "configured".to_string(),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn upsert_tax_declaration_task(
    input: UpsertTaxDeclarationTaskInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.period, "period")?;
    require_non_empty(&input.tax_type, "tax_type")?;
    require_non_empty(&input.form_name, "form_name")?;

    let id = uuid::Uuid::new_v4().to_string();
    let collect_status = default_string(input.collect_status, "not_collected");
    let validation_status = default_string(input.validation_status, "pending");
    let declaration_status = default_string(input.declaration_status, "draft");
    let taxable_amount = input.taxable_amount.unwrap_or(0.0);
    let deduction_amount = input.deduction_amount.unwrap_or(0.0);
    let payable_amount = input.payable_amount.unwrap_or(0.0);
    let risk_count = input.risk_count.unwrap_or(0);
    let payment_status = default_string(input.payment_status, "unrecorded");
    let actor = authenticated_actor(db.pool(), &auth_token).await?;

    ensure_tax_declaration_status_update_allowed(
        db.pool(),
        &input.company_id,
        &input.period,
        &input.tax_type,
        &input.form_name,
        &declaration_status,
    )
    .await?;

    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建税务取数快照事务失败: {error}"))?;
    sqlx::query(
        r#"
        INSERT INTO tax_declaration_tasks (
            id, company_id, period, tax_type, form_name, collect_status, validation_status,
            declaration_status, source_snapshot, taxable_amount, deduction_amount, payable_amount,
            risk_count, adapter_code, receipt_no, payment_status, payment_no, receipt_received_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, period, tax_type, form_name) DO UPDATE SET
            collect_status = excluded.collect_status,
            validation_status = excluded.validation_status,
            declaration_status = excluded.declaration_status,
            source_snapshot = excluded.source_snapshot,
            taxable_amount = excluded.taxable_amount,
            deduction_amount = excluded.deduction_amount,
            payable_amount = excluded.payable_amount,
            risk_count = excluded.risk_count,
            adapter_code = excluded.adapter_code,
            receipt_no = excluded.receipt_no,
            payment_status = excluded.payment_status,
            payment_no = excluded.payment_no,
            receipt_received_at = excluded.receipt_received_at,
            updated_at = datetime('now')
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.tax_type)
    .bind(&input.form_name)
    .bind(&collect_status)
    .bind(&validation_status)
    .bind(&declaration_status)
    .bind(&input.source_snapshot)
    .bind(taxable_amount)
    .bind(deduction_amount)
    .bind(payable_amount)
    .bind(risk_count)
    .bind(&input.adapter_code)
    .bind(&input.receipt_no)
    .bind(&payment_status)
    .bind(&input.payment_no)
    .bind(&input.receipt_received_at)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存申报任务失败: {error}"))?;

    let task_id: String = sqlx::query_scalar(
        r#"SELECT id FROM tax_declaration_tasks
           WHERE company_id = ? AND period = ? AND tax_type = ? AND form_name = ?"#,
    )
    .bind(&input.company_id)
    .bind(&input.period)
    .bind(&input.tax_type)
    .bind(&input.form_name)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("读取申报任务标识失败: {error}"))?;
    let snapshot_version: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM tax_declaration_snapshots WHERE task_id = ?",
    )
    .bind(&task_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| format!("计算申报快照版本失败: {error}"))?;
    let snapshot_fingerprint = tax_snapshot_fingerprint(
        &task_id,
        snapshot_version,
        &collect_status,
        &validation_status,
        &declaration_status,
        input.source_snapshot.as_deref(),
        taxable_amount,
        deduction_amount,
        payable_amount,
        risk_count,
        input.adapter_code.as_deref(),
    );
    sqlx::query(
        r#"UPDATE tax_declaration_tasks
           SET snapshot_version = ?, snapshot_fingerprint = ?
           WHERE id = ?"#,
    )
    .bind(snapshot_version)
    .bind(&snapshot_fingerprint)
    .bind(&task_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新申报快照身份失败: {error}"))?;
    write_tax_declaration_snapshot(
        &mut transaction,
        &task_id,
        snapshot_version,
        &snapshot_fingerprint,
        &actor,
    )
    .await?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务申报', '更新申报取数快照', ?, ?, 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&task_id)
    .bind(if risk_count > 0 { "medium" } else { "normal" })
    .bind(format!(
        "快照版本 v{snapshot_version} · 任务指纹 {snapshot_fingerprint}"
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入申报取数审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交税务取数快照失败: {error}"))?;

    get_tax_declaration_task_by_id(db.pool(), &task_id).await
}

#[tauri::command]
pub async fn confirm_tax_declaration_task(
    input: ConfirmTaxDeclarationTaskInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.id, "id")?;
    require_non_empty(&input.company_id, "company_id")?;

    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    confirm_tax_declaration_task_for_company(db.pool(), &input.id, &input.company_id, &actor).await
}

#[tauri::command]
pub async fn submit_tax_declaration_task(
    input: SubmitTaxDeclarationTaskInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.task_id, "task_id")?;
    require_non_empty(&input.authorization_id, "authorization_id")?;
    if !input.submission_confirmed {
        return Err("提交税局前必须完成明确确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let task = get_tax_declaration_task_by_id(db.pool(), &input.task_id).await?;
    if task.company_id != input.company_id {
        return Err("申报任务不存在或不属于当前账套".to_string());
    }
    ensure_tax_submission_ready(&task)?;
    let authorization =
        get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    ensure_authorized_tax_adapter(&task, &authorization, "tax_submit")?;
    let config =
        get_enabled_adapter_provider_config(&input.company_id, &input.authorization_id, &db)
            .await?;
    let source_fingerprint = task
        .snapshot_fingerprint
        .as_deref()
        .ok_or_else(|| "申报任务缺少不可变确认快照".to_string())?;
    let idempotency_key = sha256_hex(
        format!(
            "{}|tax_submit|{}|{}",
            input.company_id, input.task_id, source_fingerprint
        )
        .as_bytes(),
    );
    let payload = json!({
        "action": "submit_tax_declaration",
        "idempotency_key": idempotency_key,
        "company_id": input.company_id,
        "task_id": task.id,
        "period": task.period,
        "tax_type": task.tax_type,
        "form_name": task.form_name,
        "adapter_code": task.adapter_code,
        "snapshot_version": task.snapshot_version,
        "snapshot_fingerprint": source_fingerprint,
        "source_snapshot": task.source_snapshot,
        "taxable_amount": task.taxable_amount,
        "deduction_amount": task.deduction_amount,
        "payable_amount": task.payable_amount
    });
    let request_fingerprint = sha256_hex(
        serde_json::to_vec(&payload)
            .map_err(|_| "生成税务提交请求失败".to_string())?
            .as_slice(),
    );
    let existing: Option<(String, String)> = sqlx::query_as(
        "SELECT id, status FROM external_adapter_executions WHERE idempotency_key = ?",
    )
    .bind(&idempotency_key)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取税务提交幂等记录失败: {error}"))?;
    let execution_id = if let Some((id, status)) = existing {
        match status.as_str() {
            "succeeded" => return get_tax_declaration_task_by_id(db.pool(), &input.task_id).await,
            "running" => return Err("相同申报快照正在提交，请勿重复操作".to_string()),
            _ => {
                sqlx::query(
                    r#"UPDATE external_adapter_executions
                       SET status = 'running', attempt_count = attempt_count + 1,
                           http_status = NULL, response_checksum = NULL,
                           response_message = NULL, error_message = NULL,
                           completed_at = NULL, started_at = datetime('now'), executed_by = ?
                       WHERE id = ? AND company_id = ?"#,
                )
                .bind(&actor)
                .bind(&id)
                .bind(&input.company_id)
                .execute(db.pool())
                .await
                .map_err(|error| format!("恢复税务提交重试失败: {error}"))?;
                id
            }
        }
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO external_adapter_executions
               (id, company_id, authorization_id, provider_config_id, action_type,
                object_type, object_id, idempotency_key, request_fingerprint,
                source_fingerprint, status, executed_by)
               VALUES (?, ?, ?, ?, 'tax_submit', 'tax_declaration_task', ?, ?, ?, ?, 'running', ?)"#,
        )
        .bind(&id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(&config.id)
        .bind(&input.task_id)
        .bind(&idempotency_key)
        .bind(&request_fingerprint)
        .bind(source_fingerprint)
        .bind(&actor)
        .execute(db.pool())
        .await
        .map_err(|error| format!("创建税务提交执行记录失败: {error}"))?;
        id
    };
    let result = match post_external_provider_json(&config, &payload).await {
        Ok(value) => value,
        Err(error) => {
            fail_external_adapter_execution(
                db.pool(),
                &execution_id,
                &input.company_id,
                &input.task_id,
                "提交税局",
                &actor,
                &error.message,
                error.http_status,
            )
            .await?;
            return Err(error.message);
        }
    };
    let response: TaxSubmissionResponse = match serde_json::from_slice(&result.body) {
        Ok(value) => value,
        Err(_) => {
            let message = "税务接口未返回约定的提交结果".to_string();
            fail_external_adapter_execution(
                db.pool(),
                &execution_id,
                &input.company_id,
                &input.task_id,
                "提交税局",
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    };
    if response
        .receipt_no
        .as_deref()
        .is_some_and(|value| value.chars().count() > 128)
        || response
            .external_reference
            .as_deref()
            .is_some_and(|value| value.chars().count() > 256)
        || response
            .message
            .as_deref()
            .is_some_and(|value| value.chars().count() > 1000)
    {
        let message = "税务接口返回字段超过长度上限".to_string();
        fail_external_adapter_execution(
            db.pool(),
            &execution_id,
            &input.company_id,
            &input.task_id,
            "提交税局",
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    if !response.accepted {
        let message = response
            .message
            .as_deref()
            .unwrap_or("税务接口未受理本次申报")
            .to_string();
        fail_external_adapter_execution(
            db.pool(),
            &execution_id,
            &input.company_id,
            &input.task_id,
            "提交税局",
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    let response_checksum = sha256_hex(&result.body);
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建税务提交完成事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'succeeded', http_status = ?, response_checksum = ?,
               external_reference = ?, receipt_no = ?, response_message = ?,
               completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(result.http_status))
    .bind(&response_checksum)
    .bind(&response.external_reference)
    .bind(&response.receipt_no)
    .bind(&response.message)
    .bind(&execution_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存税务提交结果失败: {error}"))?;
    let task_update = sqlx::query(
        r#"UPDATE tax_declaration_tasks
           SET declaration_status = 'submitted',
               receipt_no = COALESCE(?, receipt_no),
               receipt_received_at = CASE WHEN ? IS NULL THEN receipt_received_at ELSE datetime('now') END,
               updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND declaration_status = 'confirmed'
             AND snapshot_fingerprint = ?"#,
    )
    .bind(&response.receipt_no)
    .bind(&response.receipt_no)
    .bind(&input.task_id)
    .bind(&input.company_id)
    .bind(source_fingerprint)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新申报任务提交状态失败: {error}"))?;
    if task_update.rows_affected() != 1 {
        transaction
            .rollback()
            .await
            .map_err(|error| format!("回滚税务提交并发冲突失败: {error}"))?;
        let message = "申报任务状态或不可变快照已变化，未保存外部提交结果".to_string();
        fail_external_adapter_execution(
            db.pool(),
            &execution_id,
            &input.company_id,
            &input.task_id,
            "提交税局",
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务申报', '提交税局', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.task_id)
    .bind(format!(
        "快照={}，幂等键={}，外部参考={}，回执={}，未发起扣款或付款",
        source_fingerprint,
        idempotency_key,
        response.external_reference.as_deref().unwrap_or("-"),
        response.receipt_no.as_deref().unwrap_or("待同步")
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入税务提交审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交税务提交事务失败: {error}"))?;
    get_tax_declaration_task_by_id(db.pool(), &input.task_id).await
}

#[tauri::command]
pub async fn sync_tax_declaration_receipt(
    input: SyncTaxDeclarationReceiptInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<TaxDeclarationTask, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.task_id, "task_id")?;
    require_non_empty(&input.authorization_id, "authorization_id")?;
    if !input.sync_confirmed {
        return Err("同步税务回执前必须完成明确确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let task = get_tax_declaration_task_by_id(db.pool(), &input.task_id).await?;
    if task.company_id != input.company_id {
        return Err("申报任务不存在或不属于当前账套".to_string());
    }
    if !matches!(
        task.declaration_status.as_str(),
        "submitted" | "completed" | "rejected"
    ) {
        return Err("只有已提交税局的事项可以同步回执".to_string());
    }
    let authorization =
        get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    ensure_authorized_tax_adapter(&task, &authorization, "tax_receipt_sync")?;
    let config =
        get_enabled_adapter_provider_config(&input.company_id, &input.authorization_id, &db)
            .await?;
    let source_fingerprint = task
        .snapshot_fingerprint
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "申报任务缺少不可变确认快照".to_string())?;
    let idempotency_key = sha256_hex(
        format!(
            "{}|tax_receipt_sync|{}|{}",
            input.company_id,
            input.task_id,
            uuid::Uuid::new_v4()
        )
        .as_bytes(),
    );
    let payload = json!({
        "action": "sync_tax_declaration_receipt",
        "idempotency_key": idempotency_key,
        "company_id": input.company_id,
        "task_id": task.id,
        "adapter_code": task.adapter_code,
        "snapshot_fingerprint": source_fingerprint,
        "external_receipt_no": task.receipt_no
    });
    let request_fingerprint = sha256_hex(
        serde_json::to_vec(&payload)
            .map_err(|_| "生成回执同步请求失败".to_string())?
            .as_slice(),
    );
    let execution_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO external_adapter_executions
           (id, company_id, authorization_id, provider_config_id, action_type,
            object_type, object_id, idempotency_key, request_fingerprint,
            source_fingerprint, status, executed_by)
           VALUES (?, ?, ?, ?, 'tax_receipt_sync', 'tax_declaration_task', ?, ?, ?, ?, 'running', ?)"#,
    )
    .bind(&execution_id)
    .bind(&input.company_id)
    .bind(&input.authorization_id)
    .bind(&config.id)
    .bind(&input.task_id)
    .bind(&idempotency_key)
    .bind(&request_fingerprint)
    .bind(source_fingerprint)
    .bind(&actor)
    .execute(db.pool())
    .await
    .map_err(|error| format!("创建回执同步执行记录失败: {error}"))?;
    let result = match post_external_provider_json(&config, &payload).await {
        Ok(value) => value,
        Err(error) => {
            fail_external_adapter_execution(
                db.pool(),
                &execution_id,
                &input.company_id,
                &input.task_id,
                "同步申报回执",
                &actor,
                &error.message,
                error.http_status,
            )
            .await?;
            return Err(error.message);
        }
    };
    let response: TaxReceiptSyncResponse = match serde_json::from_slice(&result.body) {
        Ok(value) => value,
        Err(_) => {
            let message = "税务接口未返回约定的回执结果".to_string();
            fail_external_adapter_execution(
                db.pool(),
                &execution_id,
                &input.company_id,
                &input.task_id,
                "同步申报回执",
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    };
    let declaration_status = response
        .declaration_status
        .as_deref()
        .unwrap_or(task.declaration_status.as_str());
    if !matches!(declaration_status, "submitted" | "completed" | "rejected")
        || response
            .payment_status
            .as_deref()
            .is_some_and(|value| !matches!(value, "unpaid" | "pending" | "paid" | "failed"))
        || response
            .receipt_no
            .as_deref()
            .is_some_and(|value| value.chars().count() > 128)
        || response
            .payment_no
            .as_deref()
            .is_some_and(|value| value.chars().count() > 128)
        || response
            .received_at
            .as_deref()
            .is_some_and(|value| value.chars().count() > 64)
        || response
            .message
            .as_deref()
            .is_some_and(|value| value.chars().count() > 1000)
    {
        let message = "税务接口返回的回执字段不符合约定".to_string();
        fail_external_adapter_execution(
            db.pool(),
            &execution_id,
            &input.company_id,
            &input.task_id,
            "同步申报回执",
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    let response_checksum = sha256_hex(&result.body);
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建回执同步完成事务失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'succeeded', http_status = ?, response_checksum = ?,
               external_reference = ?, receipt_no = ?, response_message = ?,
               completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(result.http_status))
    .bind(&response_checksum)
    .bind(&response.external_reference)
    .bind(&response.receipt_no)
    .bind(&response.message)
    .bind(&execution_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存回执同步结果失败: {error}"))?;
    if response.found {
        let task_update = sqlx::query(
            r#"UPDATE tax_declaration_tasks
               SET declaration_status = ?, receipt_no = COALESCE(?, receipt_no),
                   payment_status = COALESCE(?, payment_status),
                   payment_no = COALESCE(?, payment_no),
                   receipt_received_at = COALESCE(?, receipt_received_at, datetime('now')),
                   updated_at = datetime('now')
               WHERE id = ? AND company_id = ? AND snapshot_fingerprint = ?"#,
        )
        .bind(declaration_status)
        .bind(&response.receipt_no)
        .bind(&response.payment_status)
        .bind(&response.payment_no)
        .bind(&response.received_at)
        .bind(&input.task_id)
        .bind(&input.company_id)
        .bind(source_fingerprint)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新申报回执状态失败: {error}"))?;
        if task_update.rows_affected() != 1 {
            transaction
                .rollback()
                .await
                .map_err(|error| format!("回滚回执同步并发冲突失败: {error}"))?;
            let message = "申报任务不可变快照已变化，未保存回执结果".to_string();
            fail_external_adapter_execution(
                db.pool(),
                &execution_id,
                &input.company_id,
                &input.task_id,
                "同步申报回执",
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    }
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '税务申报', '同步申报回执', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.task_id)
    .bind(format!(
        "找到回执={}，申报状态={}，缴款状态={}，仅同步状态，未发起扣款或付款",
        response.found,
        declaration_status,
        response.payment_status.as_deref().unwrap_or("未返回")
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入回执同步审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交回执同步事务失败: {error}"))?;
    get_tax_declaration_task_by_id(db.pool(), &input.task_id).await
}

#[tauri::command]
pub async fn sync_external_invoice_pool(
    input: SyncExternalInvoicePoolInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalInvoiceSyncResult, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.authorization_id, "authorization_id")?;
    require_non_empty(&input.period, "period")?;
    NaiveDate::parse_from_str(&format!("{}-01", input.period), "%Y-%m-%d")
        .map_err(|_| "票池同步账期格式必须为 YYYY-MM".to_string())?;
    if !input.sync_confirmed {
        return Err("同步发票票池前必须完成明确确认".to_string());
    }
    if input
        .source_cursor
        .as_deref()
        .is_some_and(|value| value.chars().count() > 512)
    {
        return Err("票池游标超过长度上限".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let authorization =
        get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    ensure_authorized_invoice_pool_adapter(&authorization)?;
    let config =
        get_enabled_adapter_provider_config(&input.company_id, &input.authorization_id, &db)
            .await?;
    let source_fingerprint = sha256_hex(
        format!(
            "{}|{}|{}|{}",
            input.company_id,
            input.authorization_id,
            input.period,
            input.source_cursor.as_deref().unwrap_or("initial")
        )
        .as_bytes(),
    );
    let idempotency_key = sha256_hex(format!("invoice_pool_sync|{source_fingerprint}").as_bytes());
    let payload = json!({
        "action": "sync_invoice_pool",
        "idempotency_key": idempotency_key,
        "company_id": input.company_id,
        "period": input.period,
        "direction": "input",
        "cursor": input.source_cursor,
        "max_items": 500
    });
    let request_fingerprint = sha256_hex(
        serde_json::to_vec(&payload)
            .map_err(|_| "生成票池同步请求失败".to_string())?
            .as_slice(),
    );
    let existing: Option<(String, String, i64, i64, Option<String>)> = sqlx::query_as(
        r#"SELECT id, status, item_count, duplicate_count, next_cursor
           FROM external_invoice_sync_batches WHERE idempotency_key = ?"#,
    )
    .bind(&idempotency_key)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取票池同步幂等记录失败: {error}"))?;
    if let Some((batch_id, status, item_count, duplicate_count, next_cursor)) = &existing {
        if matches!(status.as_str(), "pending_review" | "completed") {
            return Ok(ExternalInvoiceSyncResult {
                batch_id: batch_id.clone(),
                staged_count: *item_count,
                duplicate_count: *duplicate_count,
                next_cursor: next_cursor.clone(),
            });
        }
        if status == "running" {
            return Err("相同票池范围正在同步，请勿重复操作".to_string());
        }
    }
    let batch_id = existing
        .as_ref()
        .map(|value| value.0.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let execution: Option<(String, String)> = sqlx::query_as(
        "SELECT id, status FROM external_adapter_executions WHERE idempotency_key = ?",
    )
    .bind(&idempotency_key)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取票池执行幂等记录失败: {error}"))?;
    let execution_id = execution
        .as_ref()
        .map(|value| value.0.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建票池同步事务失败: {error}"))?;
    if existing.is_some() {
        sqlx::query(
            r#"UPDATE external_invoice_sync_batches
               SET status = 'running', error_message = NULL, completed_at = NULL,
                   started_at = datetime('now'), executed_by = ?
               WHERE id = ? AND company_id = ?"#,
        )
        .bind(&actor)
        .bind(&batch_id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("恢复票池同步重试失败: {error}"))?;
    } else {
        sqlx::query(
            r#"INSERT INTO external_invoice_sync_batches
               (id, company_id, authorization_id, provider_config_id, period,
                idempotency_key, request_fingerprint, source_cursor, status, executed_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)"#,
        )
        .bind(&batch_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(&config.id)
        .bind(&input.period)
        .bind(&idempotency_key)
        .bind(&request_fingerprint)
        .bind(&input.source_cursor)
        .bind(&actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("创建票池同步批次失败: {error}"))?;
    }
    if execution.is_some() {
        sqlx::query(
            r#"UPDATE external_adapter_executions
               SET status = 'running', attempt_count = attempt_count + 1,
                   http_status = NULL, response_checksum = NULL, response_message = NULL,
                   error_message = NULL, completed_at = NULL, started_at = datetime('now'),
                   executed_by = ? WHERE id = ? AND company_id = ?"#,
        )
        .bind(&actor)
        .bind(&execution_id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("恢复票池执行记录失败: {error}"))?;
    } else {
        sqlx::query(
            r#"INSERT INTO external_adapter_executions
               (id, company_id, authorization_id, provider_config_id, action_type,
                object_type, object_id, idempotency_key, request_fingerprint,
                source_fingerprint, status, executed_by)
               VALUES (?, ?, ?, ?, 'invoice_pool_sync', 'invoice_sync_batch', ?, ?, ?, ?, 'running', ?)"#,
        )
        .bind(&execution_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(&config.id)
        .bind(&batch_id)
        .bind(&idempotency_key)
        .bind(&request_fingerprint)
        .bind(&source_fingerprint)
        .bind(&actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("创建票池执行记录失败: {error}"))?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交票池同步启动事务失败: {error}"))?;

    let result = match post_external_provider_json(&config, &payload).await {
        Ok(value) => value,
        Err(error) => {
            fail_invoice_pool_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &error.message,
                error.http_status,
            )
            .await?;
            return Err(error.message);
        }
    };
    let response: InvoicePoolSyncResponse = match serde_json::from_slice(&result.body) {
        Ok(value) => value,
        Err(_) => {
            let message = "发票票池接口未返回约定的同步结果".to_string();
            fail_invoice_pool_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    };
    if response.items.len() > 500
        || response
            .next_cursor
            .as_deref()
            .is_some_and(|value| value.chars().count() > 512)
    {
        let message = "发票票池返回数量或游标超过上限".to_string();
        fail_invoice_pool_sync(
            db.pool(),
            &batch_id,
            &execution_id,
            &input.company_id,
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    for item in &response.items {
        if let Err(message) = validate_invoice_pool_item(item, &input.period) {
            fail_invoice_pool_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    }
    let response_checksum = sha256_hex(&result.body);
    let mut staged_count = 0_i64;
    let mut duplicate_count = 0_i64;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建票池暂存事务失败: {error}"))?;
    for item in &response.items {
        let staged_exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM external_invoice_sync_items WHERE authorization_id = ? AND external_invoice_id = ?",
        )
        .bind(&input.authorization_id)
        .bind(item.external_invoice_id.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("检查票池重复记录失败: {error}"))?;
        if staged_exists > 0 {
            duplicate_count += 1;
            continue;
        }
        let duplicate_invoice_id: Option<String> = sqlx::query_scalar(
            r#"SELECT id FROM invoices
               WHERE company_id = ? AND invoice_no = ?
                 AND COALESCE(invoice_code, '') = COALESCE(?, '')
               LIMIT 1"#,
        )
        .bind(&input.company_id)
        .bind(item.invoice_no.trim())
        .bind(item.invoice_code.as_deref())
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("检查正式发票重复记录失败: {error}"))?;
        let review_status = if duplicate_invoice_id.is_some() {
            duplicate_count += 1;
            "duplicate"
        } else {
            staged_count += 1;
            "pending_review"
        };
        let item_id = uuid::Uuid::new_v4().to_string();
        let item_checksum = sha256_hex(
            serde_json::to_vec(item)
                .map_err(|_| "计算票池发票校验值失败".to_string())?
                .as_slice(),
        );
        sqlx::query(
            r#"INSERT INTO external_invoice_sync_items
               (id, batch_id, company_id, authorization_id, external_invoice_id,
                invoice_type, invoice_code, invoice_no, invoice_date, seller_name,
                seller_tax_id, buyer_name, buyer_tax_id, amount, tax_amount,
                total_amount, tax_rate, currency, review_status, duplicate_invoice_id,
                payload_checksum)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&item_id)
        .bind(&batch_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(item.external_invoice_id.trim())
        .bind(&item.invoice_type)
        .bind(&item.invoice_code)
        .bind(item.invoice_no.trim())
        .bind(item.invoice_date.trim())
        .bind(&item.seller_name)
        .bind(&item.seller_tax_id)
        .bind(&item.buyer_name)
        .bind(&item.buyer_tax_id)
        .bind(item.amount)
        .bind(item.tax_amount)
        .bind(item.total_amount)
        .bind(item.tax_rate)
        .bind(item.currency.as_deref().unwrap_or("CNY"))
        .bind(review_status)
        .bind(&duplicate_invoice_id)
        .bind(&item_checksum)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("暂存票池发票失败: {error}"))?;
        for (index, line) in item.lines.iter().enumerate() {
            sqlx::query(
                r#"INSERT INTO external_invoice_sync_item_lines
                   (id, staging_item_id, line_no, item_name, specification, unit,
                    quantity, unit_price, amount, tax_rate, tax_amount, tax_classification_code)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&item_id)
            .bind((index + 1) as i64)
            .bind(line.item_name.trim())
            .bind(&line.specification)
            .bind(&line.unit)
            .bind(line.quantity)
            .bind(line.unit_price)
            .bind(line.amount)
            .bind(line.tax_rate)
            .bind(line.tax_amount)
            .bind(&line.tax_classification_code)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("暂存票池发票明细失败: {error}"))?;
        }
    }
    let batch_status = if staged_count > 0 {
        "pending_review"
    } else {
        "completed"
    };
    sqlx::query(
        r#"UPDATE external_invoice_sync_batches
           SET status = ?, item_count = ?, duplicate_count = ?, next_cursor = ?,
               response_checksum = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(batch_status)
    .bind(staged_count)
    .bind(duplicate_count)
    .bind(&response.next_cursor)
    .bind(&response_checksum)
    .bind(&batch_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新票池同步批次失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'succeeded', http_status = ?, response_checksum = ?,
               response_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(result.http_status))
    .bind(&response_checksum)
    .bind(format!("暂存 {staged_count} 张，重复 {duplicate_count} 张"))
    .bind(&execution_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新票池执行结果失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '发票采集', '同步发票票池', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&batch_id)
    .bind(format!(
        "账期={}，暂存={}，重复={}，仅进入待复核区，未生成凭证",
        input.period, staged_count, duplicate_count
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入票池同步审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交票池暂存事务失败: {error}"))?;
    Ok(ExternalInvoiceSyncResult {
        batch_id,
        staged_count,
        duplicate_count,
        next_cursor: response.next_cursor,
    })
}

#[tauri::command]
pub async fn get_external_invoice_sync_items(
    company_id: String,
    batch_id: Option<String>,
    review_status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<ExternalInvoiceSyncItem>, String> {
    require_non_empty(&company_id, "company_id")?;
    sqlx::query_as(
        r#"SELECT id, batch_id, company_id, external_invoice_id, invoice_type,
                  invoice_code, invoice_no, invoice_date, seller_name, seller_tax_id,
                  buyer_name, buyer_tax_id, amount, tax_amount, total_amount, tax_rate,
                  currency, review_status, duplicate_invoice_id, payload_checksum,
                  reviewed_by, reviewed_at, review_note, imported_invoice_id,
                  created_at, updated_at
           FROM external_invoice_sync_items
           WHERE company_id = ? AND (? IS NULL OR batch_id = ?)
             AND (? IS NULL OR review_status = ?)
           ORDER BY created_at DESC LIMIT 1000"#,
    )
    .bind(&company_id)
    .bind(&batch_id)
    .bind(&batch_id)
    .bind(&review_status)
    .bind(&review_status)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取票池待复核发票失败: {error}"))
}

#[tauri::command]
pub async fn import_external_invoice_sync_item(
    input: ReviewExternalInvoiceSyncItemInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalInvoiceSyncItem, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.item_id, "item_id")?;
    if !input.review_confirmed {
        return Err("导入票池发票前必须完成明确复核确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建票池发票导入事务失败: {error}"))?;
    let item: ExternalInvoiceSyncItem = sqlx::query_as(
        r#"SELECT id, batch_id, company_id, external_invoice_id, invoice_type,
                  invoice_code, invoice_no, invoice_date, seller_name, seller_tax_id,
                  buyer_name, buyer_tax_id, amount, tax_amount, total_amount, tax_rate,
                  currency, review_status, duplicate_invoice_id, payload_checksum,
                  reviewed_by, reviewed_at, review_note, imported_invoice_id,
                  created_at, updated_at
           FROM external_invoice_sync_items WHERE id = ? AND company_id = ?"#,
    )
    .bind(&input.item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取票池待复核发票失败: {error}"))?
    .ok_or_else(|| "票池待复核发票不存在或不属于当前账套".to_string())?;
    if item.review_status != "pending_review" {
        return Err("只有待复核票池发票可以导入".to_string());
    }
    let claim = sqlx::query(
        r#"UPDATE external_invoice_sync_items SET reviewed_by = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'
             AND reviewed_by IS NULL"#,
    )
    .bind(&actor)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("认领票池发票复核任务失败: {error}"))?;
    if claim.rows_affected() != 1 {
        return Err("票池发票正在由其他复核人处理，请刷新后重试".to_string());
    }
    let invoice_date = NaiveDate::parse_from_str(&item.invoice_date, "%Y-%m-%d")
        .map_err(|_| "票池发票日期格式无效".to_string())?;
    let period_id: String = sqlx::query_scalar(
        r#"SELECT id FROM accounting_periods
           WHERE company_id = ? AND period_year = ? AND period_month = ? AND status = 'open'"#,
    )
    .bind(&input.company_id)
    .bind(i64::from(invoice_date.year()))
    .bind(i64::from(invoice_date.month()))
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取发票所属账期失败: {error}"))?
    .ok_or_else(|| "发票所属账期不存在或已结账，不能导入".to_string())?;
    let duplicate_invoice_id: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM invoices WHERE company_id = ? AND invoice_no = ?
           AND COALESCE(invoice_code, '') = COALESCE(?, '') LIMIT 1"#,
    )
    .bind(&input.company_id)
    .bind(&item.invoice_no)
    .bind(item.invoice_code.as_deref())
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("复核正式发票重复记录失败: {error}"))?;
    if duplicate_invoice_id.is_some() {
        return Err("相同代码和号码的正式发票已存在，不能重复导入".to_string());
    }
    let lines: Vec<(
        i64,
        String,
        Option<String>,
        Option<String>,
        Option<f64>,
        Option<f64>,
        f64,
        Option<f64>,
        f64,
        Option<String>,
    )> = sqlx::query_as(
        r#"SELECT line_no, item_name, specification, unit, quantity, unit_price,
                  amount, tax_rate, tax_amount, tax_classification_code
           FROM external_invoice_sync_item_lines
           WHERE staging_item_id = ? ORDER BY line_no"#,
    )
    .bind(&item.id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("读取票池发票明细失败: {error}"))?;
    if lines.is_empty() {
        return Err("票池发票缺少明细，不能导入".to_string());
    }
    let invoice_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO invoices
           (id, company_id, period_id, invoice_type, invoice_no, invoice_code,
            invoice_date, amount, tax_amount, total_amount, tax_rate, seller_name,
            seller_tax_id, buyer_name, buyer_tax_id, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)"#,
    )
    .bind(&invoice_id)
    .bind(&input.company_id)
    .bind(&period_id)
    .bind(&item.invoice_type)
    .bind(&item.invoice_no)
    .bind(&item.invoice_code)
    .bind(&item.invoice_date)
    .bind(item.amount)
    .bind(item.tax_amount)
    .bind(item.total_amount)
    .bind(item.tax_rate)
    .bind(&item.seller_name)
    .bind(&item.seller_tax_id)
    .bind(&item.buyer_name)
    .bind(&item.buyer_tax_id)
    .bind(format!(
        "票池同步批次 {}，外部标识 {}",
        item.batch_id, item.external_invoice_id
    ))
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("导入正式发票失败: {error}"))?;
    for (
        line_no,
        item_name,
        specification,
        unit,
        quantity,
        unit_price,
        amount,
        tax_rate,
        tax_amount,
        tax_classification_code,
    ) in lines
    {
        sqlx::query(
            r#"INSERT INTO invoice_lines
               (id, invoice_id, company_id, line_no, item_name, specification,
                unit, quantity, unit_price, amount, tax_rate, tax_amount, tax_classification_code)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&invoice_id)
        .bind(&input.company_id)
        .bind(line_no)
        .bind(item_name)
        .bind(specification)
        .bind(unit)
        .bind(quantity)
        .bind(unit_price)
        .bind(amount)
        .bind(tax_rate)
        .bind(tax_amount)
        .bind(tax_classification_code)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("导入正式发票明细失败: {error}"))?;
    }
    let review_update = sqlx::query(
        r#"UPDATE external_invoice_sync_items
           SET review_status = 'imported', imported_invoice_id = ?, reviewed_by = ?,
               reviewed_at = datetime('now'), review_note = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'
             AND reviewed_by = ?"#,
    )
    .bind(&invoice_id)
    .bind(&actor)
    .bind(&input.review_note)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新票池发票复核状态失败: {error}"))?;
    if review_update.rows_affected() != 1 {
        return Err("票池发票已被其他操作处理，请刷新后重试".to_string());
    }
    sqlx::query(
        r#"UPDATE external_invoice_sync_batches SET status = 'completed'
           WHERE id = ? AND NOT EXISTS (
               SELECT 1 FROM external_invoice_sync_items
               WHERE batch_id = ? AND review_status = 'pending_review'
           )"#,
    )
    .bind(&item.batch_id)
    .bind(&item.batch_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新票池同步批次完成状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '发票采集', '复核导入票池发票', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&invoice_id)
    .bind(format!(
        "暂存记录={}，发票号码={}，仅生成待复核正式发票，未生成凭证",
        item.id, item.invoice_no
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入票池发票导入审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交票池发票导入事务失败: {error}"))?;
    get_external_invoice_sync_item_by_id(db.pool(), &input.company_id, &input.item_id).await
}

async fn get_external_invoice_sync_item_by_id(
    pool: &DbPool,
    company_id: &str,
    item_id: &str,
) -> Result<ExternalInvoiceSyncItem, String> {
    sqlx::query_as(
        r#"SELECT id, batch_id, company_id, external_invoice_id, invoice_type,
                  invoice_code, invoice_no, invoice_date, seller_name, seller_tax_id,
                  buyer_name, buyer_tax_id, amount, tax_amount, total_amount, tax_rate,
                  currency, review_status, duplicate_invoice_id, payload_checksum,
                  reviewed_by, reviewed_at, review_note, imported_invoice_id,
                  created_at, updated_at
           FROM external_invoice_sync_items WHERE id = ? AND company_id = ?"#,
    )
    .bind(item_id)
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("读取票池发票失败: {error}"))
}

#[tauri::command]
pub async fn reject_external_invoice_sync_item(
    input: ReviewExternalInvoiceSyncItemInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalInvoiceSyncItem, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.item_id, "item_id")?;
    if !input.review_confirmed {
        return Err("驳回票池发票前必须完成明确复核确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建票池发票驳回事务失败: {error}"))?;
    let batch_id: String = sqlx::query_scalar(
        r#"SELECT batch_id FROM external_invoice_sync_items
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'"#,
    )
    .bind(&input.item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取票池发票批次失败: {error}"))?
    .ok_or_else(|| "票池发票不存在、已处理或不属于当前账套".to_string())?;
    let result = sqlx::query(
        r#"UPDATE external_invoice_sync_items
           SET review_status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'),
               review_note = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'"#,
    )
    .bind(&actor)
    .bind(&input.review_note)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("驳回票池发票失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("票池发票不存在、已处理或不属于当前账套".to_string());
    }
    sqlx::query(
        r#"UPDATE external_invoice_sync_batches SET status = 'completed'
           WHERE id = ? AND NOT EXISTS (
               SELECT 1 FROM external_invoice_sync_items
               WHERE batch_id = ? AND review_status = 'pending_review'
           )"#,
    )
    .bind(&batch_id)
    .bind(&batch_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新票池同步批次完成状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '发票采集', '驳回票池发票', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.item_id)
    .bind(input.review_note.as_deref().unwrap_or("人工复核驳回"))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入票池发票驳回审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交票池发票驳回事务失败: {error}"))?;
    get_external_invoice_sync_item_by_id(db.pool(), &input.company_id, &input.item_id).await
}

#[tauri::command]
pub async fn sync_external_bank_statement(
    input: SyncExternalBankStatementInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalBankSyncResult, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.authorization_id, "authorization_id")?;
    require_non_empty(&input.period, "period")?;
    NaiveDate::parse_from_str(&format!("{}-01", input.period), "%Y-%m-%d")
        .map_err(|_| "银行流水同步账期格式必须为 YYYY-MM".to_string())?;
    if !input.sync_confirmed {
        return Err("同步银行流水前必须完成明确确认".to_string());
    }
    if input
        .source_cursor
        .as_deref()
        .is_some_and(|value| value.chars().count() > 512)
    {
        return Err("银行流水游标超过长度上限".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let authorization =
        get_adapter_authorization_by_id(&input.company_id, &input.authorization_id, &db).await?;
    ensure_authorized_bank_adapter(&authorization)?;
    let config =
        get_enabled_adapter_provider_config(&input.company_id, &input.authorization_id, &db)
            .await?;
    let source_fingerprint = sha256_hex(
        format!(
            "{}|{}|{}|{}",
            input.company_id,
            input.authorization_id,
            input.period,
            input.source_cursor.as_deref().unwrap_or("initial")
        )
        .as_bytes(),
    );
    let idempotency_key =
        sha256_hex(format!("bank_statement_sync|{source_fingerprint}").as_bytes());
    let payload = json!({
        "action": "sync_bank_statement",
        "idempotency_key": idempotency_key,
        "company_id": input.company_id,
        "period": input.period,
        "cursor": input.source_cursor,
        "max_items": 500
    });
    let request_fingerprint = sha256_hex(
        serde_json::to_vec(&payload)
            .map_err(|_| "生成银行流水同步请求失败".to_string())?
            .as_slice(),
    );
    let existing: Option<(String, String, i64, i64, Option<String>)> = sqlx::query_as(
        r#"SELECT id, status, item_count, duplicate_count, next_cursor
           FROM external_bank_sync_batches WHERE idempotency_key = ?"#,
    )
    .bind(&idempotency_key)
    .fetch_optional(db.pool())
    .await
    .map_err(|error| format!("读取银行流水同步幂等记录失败: {error}"))?;
    if let Some((batch_id, status, item_count, duplicate_count, next_cursor)) = &existing {
        if matches!(status.as_str(), "pending_review" | "completed") {
            return Ok(ExternalBankSyncResult {
                batch_id: batch_id.clone(),
                staged_count: *item_count,
                duplicate_count: *duplicate_count,
                next_cursor: next_cursor.clone(),
            });
        }
        if status == "running" {
            return Err("相同银行流水范围正在同步，请勿重复操作".to_string());
        }
    }
    let batch_id = existing
        .as_ref()
        .map(|value| value.0.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let execution: Option<(String,)> =
        sqlx::query_as("SELECT id FROM external_adapter_executions WHERE idempotency_key = ?")
            .bind(&idempotency_key)
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("读取银行流水执行幂等记录失败: {error}"))?;
    let execution_id = execution
        .as_ref()
        .map(|value| value.0.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建银行流水同步事务失败: {error}"))?;
    if existing.is_some() {
        sqlx::query(
            r#"UPDATE external_bank_sync_batches
               SET status = 'running', error_message = NULL, completed_at = NULL,
                   started_at = datetime('now'), executed_by = ?
               WHERE id = ? AND company_id = ?"#,
        )
        .bind(&actor)
        .bind(&batch_id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("恢复银行流水同步重试失败: {error}"))?;
    } else {
        sqlx::query(
            r#"INSERT INTO external_bank_sync_batches
               (id, company_id, authorization_id, provider_config_id, period,
                idempotency_key, request_fingerprint, source_cursor, status, executed_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)"#,
        )
        .bind(&batch_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(&config.id)
        .bind(&input.period)
        .bind(&idempotency_key)
        .bind(&request_fingerprint)
        .bind(&input.source_cursor)
        .bind(&actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("创建银行流水同步批次失败: {error}"))?;
    }
    if execution.is_some() {
        sqlx::query(
            r#"UPDATE external_adapter_executions
               SET status = 'running', attempt_count = attempt_count + 1,
                   http_status = NULL, response_checksum = NULL, response_message = NULL,
                   error_message = NULL, completed_at = NULL, started_at = datetime('now'),
                   executed_by = ? WHERE id = ? AND company_id = ?"#,
        )
        .bind(&actor)
        .bind(&execution_id)
        .bind(&input.company_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("恢复银行流水执行记录失败: {error}"))?;
    } else {
        sqlx::query(
            r#"INSERT INTO external_adapter_executions
               (id, company_id, authorization_id, provider_config_id, action_type,
                object_type, object_id, idempotency_key, request_fingerprint,
                source_fingerprint, status, executed_by)
               VALUES (?, ?, ?, ?, 'bank_statement_sync', 'bank_sync_batch', ?, ?, ?, ?, 'running', ?)"#,
        )
        .bind(&execution_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(&config.id)
        .bind(&batch_id)
        .bind(&idempotency_key)
        .bind(&request_fingerprint)
        .bind(&source_fingerprint)
        .bind(&actor)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("创建银行流水执行记录失败: {error}"))?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交银行流水同步启动事务失败: {error}"))?;

    let result = match post_external_provider_json(&config, &payload).await {
        Ok(value) => value,
        Err(error) => {
            fail_bank_statement_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &error.message,
                error.http_status,
            )
            .await?;
            return Err(error.message);
        }
    };
    let response: BankStatementSyncResponse = match serde_json::from_slice(&result.body) {
        Ok(value) => value,
        Err(_) => {
            let message = "银行接口未返回约定的流水同步结果".to_string();
            fail_bank_statement_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    };
    if response.items.len() > 500
        || response
            .next_cursor
            .as_deref()
            .is_some_and(|value| value.chars().count() > 512)
    {
        let message = "银行流水返回数量或游标超过上限".to_string();
        fail_bank_statement_sync(
            db.pool(),
            &batch_id,
            &execution_id,
            &input.company_id,
            &actor,
            &message,
            Some(result.http_status),
        )
        .await?;
        return Err(message);
    }
    for item in &response.items {
        if let Err(message) = validate_bank_statement_item(item, &input.period) {
            fail_bank_statement_sync(
                db.pool(),
                &batch_id,
                &execution_id,
                &input.company_id,
                &actor,
                &message,
                Some(result.http_status),
            )
            .await?;
            return Err(message);
        }
    }
    let response_checksum = sha256_hex(&result.body);
    let mut staged_count = 0_i64;
    let mut duplicate_count = 0_i64;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建银行流水暂存事务失败: {error}"))?;
    for item in &response.items {
        let staged_exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM external_bank_sync_items WHERE authorization_id = ? AND external_transaction_id = ?",
        )
        .bind(&input.authorization_id)
        .bind(item.external_transaction_id.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| format!("检查银行流水暂存重复记录失败: {error}"))?;
        if staged_exists > 0 {
            duplicate_count += 1;
            continue;
        }
        let duplicate_transaction_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM bank_transactions WHERE company_id = ? AND serial_no = ? LIMIT 1",
        )
        .bind(&input.company_id)
        .bind(item.external_transaction_id.trim())
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("检查正式银行流水重复记录失败: {error}"))?;
        let review_status = if duplicate_transaction_id.is_some() {
            duplicate_count += 1;
            "duplicate"
        } else {
            staged_count += 1;
            "pending_review"
        };
        let item_checksum = sha256_hex(
            serde_json::to_vec(item)
                .map_err(|_| "计算银行流水校验值失败".to_string())?
                .as_slice(),
        );
        sqlx::query(
            r#"INSERT INTO external_bank_sync_items
               (id, batch_id, company_id, authorization_id, external_transaction_id,
                account_mask, transaction_date, value_date, direction, amount, currency,
                counterparty_name, counterparty_account_mask, bank_reference, summary,
                balance, review_status, duplicate_transaction_id, payload_checksum)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&batch_id)
        .bind(&input.company_id)
        .bind(&input.authorization_id)
        .bind(item.external_transaction_id.trim())
        .bind(item.account_mask.trim())
        .bind(item.transaction_date.trim())
        .bind(&item.value_date)
        .bind(&item.direction)
        .bind(item.amount)
        .bind(item.currency.as_deref().unwrap_or("CNY"))
        .bind(&item.counterparty_name)
        .bind(&item.counterparty_account_mask)
        .bind(&item.bank_reference)
        .bind(&item.summary)
        .bind(item.balance)
        .bind(review_status)
        .bind(&duplicate_transaction_id)
        .bind(&item_checksum)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("暂存银行流水失败: {error}"))?;
    }
    let batch_status = if staged_count > 0 {
        "pending_review"
    } else {
        "completed"
    };
    sqlx::query(
        r#"UPDATE external_bank_sync_batches
           SET status = ?, item_count = ?, duplicate_count = ?, next_cursor = ?,
               response_checksum = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(batch_status)
    .bind(staged_count)
    .bind(duplicate_count)
    .bind(&response.next_cursor)
    .bind(&response_checksum)
    .bind(&batch_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新银行流水同步批次失败: {error}"))?;
    sqlx::query(
        r#"UPDATE external_adapter_executions
           SET status = 'succeeded', http_status = ?, response_checksum = ?,
               response_message = ?, completed_at = datetime('now')
           WHERE id = ? AND company_id = ?"#,
    )
    .bind(i64::from(result.http_status))
    .bind(&response_checksum)
    .bind(format!("暂存 {staged_count} 笔，重复 {duplicate_count} 笔"))
    .bind(&execution_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新银行流水执行结果失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '银行流水', '同步银行流水', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&batch_id)
    .bind(format!(
        "账期={}，暂存={}，重复={}，仅进入待复核区，未生成凭证或发起付款",
        input.period, staged_count, duplicate_count
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入银行流水同步审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交银行流水暂存事务失败: {error}"))?;
    Ok(ExternalBankSyncResult {
        batch_id,
        staged_count,
        duplicate_count,
        next_cursor: response.next_cursor,
    })
}

const EXTERNAL_BANK_SYNC_ITEM_SELECT: &str = r#"SELECT id, batch_id, company_id,
    external_transaction_id, account_mask, transaction_date, value_date, direction,
    amount, currency, counterparty_name, counterparty_account_mask, bank_reference,
    summary, balance, review_status, duplicate_transaction_id, payload_checksum,
    reviewed_by, reviewed_at, review_note, imported_transaction_id, created_at, updated_at
    FROM external_bank_sync_items"#;

#[tauri::command]
pub async fn get_external_bank_sync_items(
    company_id: String,
    batch_id: Option<String>,
    review_status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<ExternalBankSyncItem>, String> {
    require_non_empty(&company_id, "company_id")?;
    sqlx::query_as(&format!(
        "{EXTERNAL_BANK_SYNC_ITEM_SELECT} WHERE company_id = ? AND (? IS NULL OR batch_id = ?) AND (? IS NULL OR review_status = ?) ORDER BY created_at DESC LIMIT 1000"
    ))
    .bind(&company_id)
    .bind(&batch_id)
    .bind(&batch_id)
    .bind(&review_status)
    .bind(&review_status)
    .fetch_all(db.pool())
    .await
    .map_err(|error| format!("读取银行待复核流水失败: {error}"))
}

async fn get_external_bank_sync_item_by_id(
    pool: &DbPool,
    company_id: &str,
    item_id: &str,
) -> Result<ExternalBankSyncItem, String> {
    sqlx::query_as(&format!(
        "{EXTERNAL_BANK_SYNC_ITEM_SELECT} WHERE id = ? AND company_id = ?"
    ))
    .bind(item_id)
    .bind(company_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("读取银行待复核流水失败: {error}"))
}

#[tauri::command]
pub async fn import_external_bank_sync_item(
    input: ReviewExternalBankSyncItemInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalBankSyncItem, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.item_id, "item_id")?;
    if !input.review_confirmed {
        return Err("导入银行流水前必须完成明确复核确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建银行流水导入事务失败: {error}"))?;
    let item: ExternalBankSyncItem = sqlx::query_as(&format!(
        "{EXTERNAL_BANK_SYNC_ITEM_SELECT} WHERE id = ? AND company_id = ?"
    ))
    .bind(&input.item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取银行待复核流水失败: {error}"))?
    .ok_or_else(|| "银行待复核流水不存在或不属于当前账套".to_string())?;
    if item.review_status != "pending_review" {
        return Err("只有待复核银行流水可以导入".to_string());
    }
    let claim = sqlx::query(
        r#"UPDATE external_bank_sync_items SET reviewed_by = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'
             AND reviewed_by IS NULL"#,
    )
    .bind(&actor)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("认领银行流水复核任务失败: {error}"))?;
    if claim.rows_affected() != 1 {
        return Err("银行流水正在由其他复核人处理，请刷新后重试".to_string());
    }
    let transaction_date = NaiveDate::parse_from_str(&item.transaction_date, "%Y-%m-%d")
        .map_err(|_| "银行流水交易日期格式无效".to_string())?;
    let period: Option<String> = sqlx::query_scalar(
        r#"SELECT printf('%04d-%02d', period_year, period_month) FROM accounting_periods
           WHERE company_id = ? AND period_year = ? AND period_month = ? AND status = 'open'"#,
    )
    .bind(&input.company_id)
    .bind(i64::from(transaction_date.year()))
    .bind(i64::from(transaction_date.month()))
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取银行流水所属账期失败: {error}"))?;
    let period = period.ok_or_else(|| "银行流水所属账期不存在或已结账，不能导入".to_string())?;
    let duplicate_transaction_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM bank_transactions WHERE company_id = ? AND serial_no = ? LIMIT 1",
    )
    .bind(&input.company_id)
    .bind(&item.external_transaction_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("复核正式银行流水重复记录失败: {error}"))?;
    if duplicate_transaction_id.is_some() {
        return Err("相同外部流水号的正式记录已存在，不能重复导入".to_string());
    }
    let transaction_id = uuid::Uuid::new_v4().to_string();
    let (income_amount, expense_amount) = if item.direction == "income" {
        (item.amount, 0.0)
    } else {
        (0.0, item.amount)
    };
    sqlx::query(
        r#"INSERT INTO bank_transactions
           (id, company_id, period, account_name, serial_no, transaction_date,
            counterparty, summary, income_amount, expense_amount, balance,
            receipt_status, match_result, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待上传', NULL, '待处理')"#,
    )
    .bind(&transaction_id)
    .bind(&input.company_id)
    .bind(&period)
    .bind(&item.account_mask)
    .bind(&item.external_transaction_id)
    .bind(&item.transaction_date)
    .bind(&item.counterparty_name)
    .bind(&item.summary)
    .bind(income_amount)
    .bind(expense_amount)
    .bind(item.balance)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("导入正式银行流水失败: {error}"))?;
    let review_update = sqlx::query(
        r#"UPDATE external_bank_sync_items
           SET review_status = 'imported', imported_transaction_id = ?, reviewed_by = ?,
               reviewed_at = datetime('now'), review_note = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'
             AND reviewed_by = ?"#,
    )
    .bind(&transaction_id)
    .bind(&actor)
    .bind(&input.review_note)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新银行流水复核状态失败: {error}"))?;
    if review_update.rows_affected() != 1 {
        return Err("银行流水已被其他操作处理，请刷新后重试".to_string());
    }
    sqlx::query(
        r#"UPDATE external_bank_sync_batches SET status = 'completed'
           WHERE id = ? AND NOT EXISTS (
               SELECT 1 FROM external_bank_sync_items
               WHERE batch_id = ? AND review_status = 'pending_review'
           )"#,
    )
    .bind(&item.batch_id)
    .bind(&item.batch_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新银行流水同步批次完成状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '银行流水', '复核导入银行流水', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&transaction_id)
    .bind(format!(
        "暂存记录={}，外部流水={}，仅生成待处理本地流水，未生成凭证或发起付款",
        item.id, item.external_transaction_id
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入银行流水导入审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交银行流水导入事务失败: {error}"))?;
    get_external_bank_sync_item_by_id(db.pool(), &input.company_id, &input.item_id).await
}

#[tauri::command]
pub async fn reject_external_bank_sync_item(
    input: ReviewExternalBankSyncItemInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<ExternalBankSyncItem, String> {
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.item_id, "item_id")?;
    if !input.review_confirmed {
        return Err("驳回银行流水前必须完成明确复核确认".to_string());
    }
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建银行流水驳回事务失败: {error}"))?;
    let batch_id: String = sqlx::query_scalar(
        r#"SELECT batch_id FROM external_bank_sync_items
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'"#,
    )
    .bind(&input.item_id)
    .bind(&input.company_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取银行流水批次失败: {error}"))?
    .ok_or_else(|| "银行流水不存在、已处理或不属于当前账套".to_string())?;
    let result = sqlx::query(
        r#"UPDATE external_bank_sync_items
           SET review_status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'),
               review_note = ?, updated_at = datetime('now')
           WHERE id = ? AND company_id = ? AND review_status = 'pending_review'"#,
    )
    .bind(&actor)
    .bind(&input.review_note)
    .bind(&input.item_id)
    .bind(&input.company_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("驳回银行流水失败: {error}"))?;
    if result.rows_affected() != 1 {
        return Err("银行流水不存在、已处理或不属于当前账套".to_string());
    }
    sqlx::query(
        r#"UPDATE external_bank_sync_batches SET status = 'completed'
           WHERE id = ? AND NOT EXISTS (
               SELECT 1 FROM external_bank_sync_items
               WHERE batch_id = ? AND review_status = 'pending_review'
           )"#,
    )
    .bind(&batch_id)
    .bind(&batch_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新银行流水同步批次完成状态失败: {error}"))?;
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '银行流水', '驳回银行流水', ?, 'medium', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(&input.item_id)
    .bind(input.review_note.as_deref().unwrap_or("人工复核驳回"))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入银行流水驳回审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交银行流水驳回事务失败: {error}"))?;
    get_external_bank_sync_item_by_id(db.pool(), &input.company_id, &input.item_id).await
}

#[tauri::command]
pub async fn get_adapter_authorizations(
    company_id: String,
    adapter_type: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<AdapterAuthorization>, String> {
    require_non_empty(&company_id, "company_id")?;

    sqlx::query_as(
        r#"
        SELECT
            a.id,
            a.company_id,
            c.name AS company_name,
            a.adapter_type,
            a.adapter_code,
            a.region,
            a.auth_status,
            a.account_mask,
            a.login_identity,
            a.capability_scope,
            a.last_checked_at,
            a.expires_at,
            a.risk_message,
            a.created_at,
            a.updated_at
        FROM adapter_authorizations a
        LEFT JOIN companies c ON c.id = a.company_id
        WHERE a.company_id = ?
          AND (? IS NULL OR a.adapter_type = ?)
        ORDER BY a.adapter_type ASC, a.region ASC, a.updated_at DESC
        "#,
    )
    .bind(&company_id)
    .bind(&adapter_type)
    .bind(&adapter_type)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn upsert_adapter_authorization(
    input: UpsertAdapterAuthorizationInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<AdapterAuthorization, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    require_non_empty(&input.company_id, "company_id")?;
    require_non_empty(&input.adapter_type, "adapter_type")?;
    require_non_empty(&input.adapter_code, "adapter_code")?;

    let id = uuid::Uuid::new_v4().to_string();
    let auth_status = default_string(input.auth_status, "pending");
    if !matches!(
        auth_status.as_str(),
        "pending" | "configured" | "authorized" | "expired" | "disabled"
    ) {
        return Err("接口授权状态无效".to_string());
    }
    let mut transaction = db
        .pool()
        .begin()
        .await
        .map_err(|error| format!("创建接口授权事务失败: {error}"))?;
    let existing_status: Option<String> = sqlx::query_scalar(
        r#"SELECT auth_status FROM adapter_authorizations
           WHERE company_id = ? AND adapter_type = ? AND adapter_code = ?"#,
    )
    .bind(&input.company_id)
    .bind(&input.adapter_type)
    .bind(&input.adapter_code)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取接口授权状态失败: {error}"))?;
    if auth_status == "authorized" && existing_status.as_deref() != Some("authorized") {
        return Err("已授权状态只能由受控连接验证流程写入".to_string());
    }
    if existing_status.as_deref() == Some("authorized") && auth_status != "authorized" {
        return Err("已验证授权不能通过元数据维护接口直接变更或撤销".to_string());
    }

    sqlx::query(
        r#"
        INSERT INTO adapter_authorizations (
            id, company_id, adapter_type, adapter_code, region, auth_status, account_mask,
            login_identity, capability_scope, last_checked_at, expires_at, risk_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, adapter_type, adapter_code) DO UPDATE SET
            region = excluded.region,
            auth_status = excluded.auth_status,
            account_mask = excluded.account_mask,
            login_identity = excluded.login_identity,
            capability_scope = excluded.capability_scope,
            last_checked_at = excluded.last_checked_at,
            expires_at = excluded.expires_at,
            risk_message = excluded.risk_message,
            updated_at = datetime('now')
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.adapter_type)
    .bind(&input.adapter_code)
    .bind(&input.region)
    .bind(&auth_status)
    .bind(&input.account_mask)
    .bind(&input.login_identity)
    .bind(&input.capability_scope)
    .bind(&input.last_checked_at)
    .bind(&input.expires_at)
    .bind(&input.risk_message)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, ?, '接口授权', '维护接口授权元数据', ?, 'high', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&input.company_id)
    .bind(format!("{}:{}", input.adapter_type, input.adapter_code))
    .bind(format!(
        "状态 {} -> {}，能力范围={}，账号={}",
        existing_status.as_deref().unwrap_or("未登记"),
        auth_status,
        input.capability_scope.as_deref().unwrap_or("未配置"),
        input.account_mask.as_deref().unwrap_or("未配置")
    ))
    .bind(&actor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("写入接口授权审计失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交接口授权变更失败: {error}"))?;

    get_adapter_authorization_by_key(
        &input.company_id,
        &input.adapter_type,
        &input.adapter_code,
        &db,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{
        calculate_tax_due_date, confirm_tax_declaration_task_for_company,
        ensure_tax_declaration_status_update_allowed, ensure_tax_submission_ready,
        validate_ai_provider_endpoint, validate_ai_provider_response, validate_bank_statement_item,
        validate_invoice_pool_item, AiProviderResponse, BankStatementItemResponse,
        InvoicePoolItemResponse, InvoicePoolLineResponse,
    };
    use crate::db::{Database, TaxDeclarationTask};
    use chrono::NaiveDate;
    use std::collections::HashMap;

    fn ready_tax_task() -> TaxDeclarationTask {
        TaxDeclarationTask {
            id: "tax-task-1".to_string(),
            company_id: "company-1".to_string(),
            company_name: Some("测试企业".to_string()),
            period: "2026-06".to_string(),
            tax_type: "增值税及附加".to_string(),
            form_name: "增值税申报表".to_string(),
            collect_status: "collected".to_string(),
            validation_status: "passed".to_string(),
            declaration_status: "confirmed".to_string(),
            source_snapshot: Some("发票池与凭证快照".to_string()),
            taxable_amount: 1000.0,
            deduction_amount: 100.0,
            payable_amount: 900.0,
            risk_count: 0,
            adapter_code: Some("etax-shanghai".to_string()),
            confirmed_by: Some("复核员".to_string()),
            confirmed_at: Some("2026-06-20 10:00:00".to_string()),
            receipt_no: None,
            payment_status: "unpaid".to_string(),
            payment_no: None,
            receipt_received_at: None,
            snapshot_version: 1,
            snapshot_fingerprint: Some("snapshot-sha256".to_string()),
            created_at: "2026-06-20 09:00:00".to_string(),
            updated_at: "2026-06-20 10:00:00".to_string(),
        }
    }

    #[test]
    fn tax_submission_requires_validated_risk_free_immutable_snapshot() {
        let task = ready_tax_task();
        assert!(ensure_tax_submission_ready(&task).is_ok());

        let mut invalid = task.clone();
        invalid.risk_count = 1;
        assert_eq!(
            ensure_tax_submission_ready(&invalid).expect_err("blocks risk"),
            "申报事项仍有未处理风险，不能提交税局"
        );
        invalid = task.clone();
        invalid.snapshot_fingerprint = None;
        assert_eq!(
            ensure_tax_submission_ready(&invalid).expect_err("blocks missing snapshot"),
            "申报事项缺少不可变确认快照"
        );
    }

    #[test]
    fn invoice_pool_items_require_current_period_and_reconciled_lines() {
        let mut item = InvoicePoolItemResponse {
            external_invoice_id: "external-invoice-1".to_string(),
            invoice_type: "input".to_string(),
            invoice_code: Some("0310".to_string()),
            invoice_no: "000001".to_string(),
            invoice_date: "2026-06-18".to_string(),
            seller_name: Some("销售方".to_string()),
            seller_tax_id: Some("91310000TEST".to_string()),
            buyer_name: Some("购买方".to_string()),
            buyer_tax_id: Some("91330000TEST".to_string()),
            amount: 100.0,
            tax_amount: 13.0,
            total_amount: 113.0,
            tax_rate: Some(0.13),
            currency: Some("CNY".to_string()),
            lines: vec![InvoicePoolLineResponse {
                item_name: "服务费".to_string(),
                specification: None,
                unit: None,
                quantity: Some(1.0),
                unit_price: Some(100.0),
                amount: 100.0,
                tax_rate: Some(0.13),
                tax_amount: 13.0,
                tax_classification_code: None,
            }],
        };
        assert!(validate_invoice_pool_item(&item, "2026-06").is_ok());
        item.total_amount = 112.0;
        assert_eq!(
            validate_invoice_pool_item(&item, "2026-06").expect_err("blocks mismatch"),
            "票池发票金额、税额与价税合计不勾稽"
        );
        item.total_amount = 113.0;
        assert_eq!(
            validate_invoice_pool_item(&item, "2026-07").expect_err("blocks another period"),
            "票池发票不属于当前同步账期"
        );
    }

    #[test]
    fn bank_statement_items_require_current_period_positive_amount_and_cny() {
        let mut item = BankStatementItemResponse {
            external_transaction_id: "bank-transaction-1".to_string(),
            account_mask: "****1234".to_string(),
            transaction_date: "2026-06-18".to_string(),
            value_date: Some("2026-06-18".to_string()),
            direction: "income".to_string(),
            amount: 100.0,
            currency: Some("CNY".to_string()),
            counterparty_name: Some("测试客户".to_string()),
            counterparty_account_mask: Some("****5678".to_string()),
            bank_reference: Some("REF-001".to_string()),
            summary: Some("销售回款".to_string()),
            balance: Some(1200.0),
        };
        assert!(validate_bank_statement_item(&item, "2026-06").is_ok());
        item.amount = 0.0;
        assert_eq!(
            validate_bank_statement_item(&item, "2026-06").expect_err("blocks zero amount"),
            "银行流水金额必须为大于零的有限数值"
        );
        item.amount = 100.0;
        item.currency = Some("USD".to_string());
        assert_eq!(
            validate_bank_statement_item(&item, "2026-06").expect_err("blocks currency"),
            "当前账套仅支持人民币银行流水"
        );
        item.currency = Some("CNY".to_string());
        assert_eq!(
            validate_bank_statement_item(&item, "2026-07").expect_err("blocks another period"),
            "银行流水不属于当前同步账期"
        );
    }

    #[test]
    fn rejects_unsafe_ai_provider_endpoints() {
        for endpoint in [
            "http://provider.example.com/recognize",
            "https://localhost/recognize",
            "https://127.0.0.1/recognize",
            "https://10.0.0.8/recognize",
            "https://[::1]/recognize",
        ] {
            assert!(
                validate_ai_provider_endpoint(endpoint).is_err(),
                "unsafe endpoint accepted: {endpoint}"
            );
        }
        assert!(validate_ai_provider_endpoint("https://provider.example.com/recognize").is_ok());
    }

    #[test]
    fn validates_ai_provider_response_contract() {
        assert!(validate_ai_provider_response(AiProviderResponse {
            confidence: Some(0.91),
            summary: "识别完成，发票号码需人工复核".to_string(),
            risk_level: Some("medium".to_string()),
            fields: Some(serde_json::json!({"invoice_no": "123"})),
        })
        .is_ok());
        assert!(validate_ai_provider_response(AiProviderResponse {
            confidence: Some(1.2),
            summary: "置信度越界".to_string(),
            risk_level: Some("normal".to_string()),
            fields: None,
        })
        .is_err());
        assert!(validate_ai_provider_response(AiProviderResponse {
            confidence: Some(0.8),
            summary: "不支持的风险级别".to_string(),
            risk_level: Some("auto_post".to_string()),
            fields: None,
        })
        .is_err());
    }

    #[test]
    fn calculates_tax_due_dates_with_weekend_and_statutory_overrides() {
        let no_overrides = HashMap::new();
        let weekend_adjusted =
            calculate_tax_due_date("2026-07", 1, 15, "next_workday", &no_overrides)
                .expect("calculates a weekend-adjusted deadline");
        assert_eq!(
            weekend_adjusted,
            NaiveDate::from_ymd_opt(2026, 8, 17).expect("valid Monday")
        );

        let mut overrides = HashMap::new();
        overrides.insert(
            NaiveDate::from_ymd_opt(2026, 8, 17).expect("valid override date"),
            "holiday".to_string(),
        );
        let holiday_adjusted = calculate_tax_due_date("2026-07", 1, 15, "next_workday", &overrides)
            .expect("skips an explicit holiday");
        assert_eq!(
            holiday_adjusted,
            NaiveDate::from_ymd_opt(2026, 8, 18).expect("valid Tuesday")
        );

        overrides.insert(
            NaiveDate::from_ymd_opt(2026, 8, 15).expect("valid weekend date"),
            "workday".to_string(),
        );
        let adjusted_workday = calculate_tax_due_date("2026-07", 1, 15, "next_workday", &overrides)
            .expect("honors an explicit weekend workday");
        assert_eq!(
            adjusted_workday,
            NaiveDate::from_ymd_opt(2026, 8, 15).expect("valid Saturday")
        );
    }

    #[tokio::test]
    async fn confirms_a_validated_risk_free_tax_declaration_task() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-tax-confirmation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");

        sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
            .bind("company-1")
            .bind("test-company")
            .bind("测试企业")
            .execute(database.pool())
            .await
            .expect("creates company");
        sqlx::query(
            r#"
            INSERT INTO tax_declaration_tasks (
                id, company_id, period, tax_type, form_name,
                collect_status, validation_status, risk_count, declaration_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("task-1")
        .bind("company-1")
        .bind("2026-06")
        .bind("增值税及附加")
        .bind("增值税及附加申报表")
        .bind("collected")
        .bind("passed")
        .bind(0_i64)
        .bind("pending_confirmation")
        .execute(database.pool())
        .await
        .expect("creates declaration task");

        let confirmed = confirm_tax_declaration_task_for_company(
            database.pool(),
            "task-1",
            "company-1",
            "税务复核员",
        )
        .await
        .expect("confirms a valid declaration task");

        assert_eq!(confirmed.declaration_status, "confirmed");
        assert_eq!(confirmed.confirmed_by.as_deref(), Some("税务复核员"));
        assert!(confirmed.confirmed_at.is_some());
        assert_eq!(confirmed.snapshot_version, 1);
        assert!(confirmed.snapshot_fingerprint.is_some());
        let snapshots: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tax_declaration_snapshots WHERE task_id = 'task-1' AND created_by = '税务复核员'",
        )
        .fetch_one(database.pool())
        .await
        .expect("counts immutable confirmation snapshots");
        assert_eq!(snapshots, 1);

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn rejects_confirming_a_tax_declaration_task_before_collection() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-tax-collection-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");

        sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
            .bind("company-1")
            .bind("test-company")
            .bind("测试企业")
            .execute(database.pool())
            .await
            .expect("creates company");
        sqlx::query(
            r#"
            INSERT INTO tax_declaration_tasks (
                id, company_id, period, tax_type, form_name,
                collect_status, validation_status, risk_count, declaration_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("task-1")
        .bind("company-1")
        .bind("2026-06")
        .bind("增值税及附加")
        .bind("增值税及附加申报表")
        .bind("not_collected")
        .bind("passed")
        .bind(0_i64)
        .bind("draft")
        .execute(database.pool())
        .await
        .expect("creates uncollected declaration task");

        let error = confirm_tax_declaration_task_for_company(
            database.pool(),
            "task-1",
            "company-1",
            "税务复核员",
        )
        .await
        .expect_err("rejects a task that was not collected");

        assert_eq!(error, "申报事项尚未完成取数，不能确认");

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn rejects_resetting_a_confirmed_tax_declaration_task_to_draft() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-tax-status-reset-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");

        sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
            .bind("company-1")
            .bind("test-company")
            .bind("测试企业")
            .execute(database.pool())
            .await
            .expect("creates company");
        sqlx::query(
            r#"
            INSERT INTO tax_declaration_tasks (
                id, company_id, period, tax_type, form_name, declaration_status
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("task-1")
        .bind("company-1")
        .bind("2026-06")
        .bind("增值税及附加")
        .bind("增值税及附加申报表")
        .bind("confirmed")
        .execute(database.pool())
        .await
        .expect("creates confirmed declaration task");

        let error = ensure_tax_declaration_status_update_allowed(
            database.pool(),
            "company-1",
            "2026-06",
            "增值税及附加",
            "增值税及附加申报表",
            "draft",
        )
        .await
        .expect_err("rejects a final status reset");

        assert_eq!(error, "已完成本地确认的申报事项不能回退或改写状态");

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }

    #[tokio::test]
    async fn rejects_reconfirming_a_tax_declaration_task() {
        let data_dir = std::env::temp_dir().join(format!(
            "accounting-tax-reconfirmation-test-{}",
            uuid::Uuid::new_v4()
        ));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes test database");

        sqlx::query("INSERT INTO companies (id, code, name) VALUES (?, ?, ?)")
            .bind("company-1")
            .bind("test-company")
            .bind("测试企业")
            .execute(database.pool())
            .await
            .expect("creates company");
        sqlx::query(
            r#"
            INSERT INTO tax_declaration_tasks (
                id, company_id, period, tax_type, form_name,
                collect_status, validation_status, risk_count, declaration_status, confirmed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("task-1")
        .bind("company-1")
        .bind("2026-06")
        .bind("增值税及附加")
        .bind("增值税及附加申报表")
        .bind("collected")
        .bind("passed")
        .bind(0_i64)
        .bind("confirmed")
        .bind("初始复核员")
        .execute(database.pool())
        .await
        .expect("creates confirmed declaration task");

        let error = confirm_tax_declaration_task_for_company(
            database.pool(),
            "task-1",
            "company-1",
            "重复确认人",
        )
        .await
        .expect_err("rejects duplicate confirmation");

        assert_eq!(error, "申报事项已完成本地确认，不能重复确认");
        let confirmed_by: Option<String> =
            sqlx::query_scalar("SELECT confirmed_by FROM tax_declaration_tasks WHERE id = ?")
                .bind("task-1")
                .fetch_one(database.pool())
                .await
                .expect("reads original confirmer");
        assert_eq!(confirmed_by.as_deref(), Some("初始复核员"));

        database.pool().close().await;
        std::fs::remove_dir_all(data_dir).expect("removes test data directory");
    }
}

#[tauri::command]
pub async fn write_operation_audit_log(
    input: CreateOperationAuditLogInput,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<OperationAuditLog, String> {
    require_non_empty(&input.module_name, "module_name")?;
    require_non_empty(&input.action, "action")?;

    let id = uuid::Uuid::new_v4().to_string();
    let risk_level = default_string(input.risk_level, "normal");
    let result = default_string(input.result, "success");
    let actor = authenticated_actor(db.pool(), &auth_token).await?;

    sqlx::query(
        r#"
        INSERT INTO operation_audit_logs (
            id, company_id, module_name, action, object_ref, risk_level, result, detail, operator
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.company_id)
    .bind(&input.module_name)
    .bind(&input.action)
    .bind(&input.object_ref)
    .bind(&risk_level)
    .bind(&result)
    .bind(&input.detail)
    .bind(&actor)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query_as(
        r#"
        SELECT
            l.id,
            l.company_id,
            c.name AS company_name,
            l.module_name,
            l.action,
            l.object_ref,
            l.risk_level,
            l.result,
            l.detail,
            l.operator,
            l.created_at
        FROM operation_audit_logs l
        LEFT JOIN companies c ON c.id = l.company_id
        WHERE l.id = ?
        "#,
    )
    .bind(&id)
    .fetch_one(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_operation_audit_logs(
    company_id: Option<String>,
    module_name: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<OperationAuditLog>, String> {
    sqlx::query_as(
        r#"
        SELECT
            l.id,
            l.company_id,
            c.name AS company_name,
            l.module_name,
            l.action,
            l.object_ref,
            l.risk_level,
            l.result,
            l.detail,
            l.operator,
            l.created_at
        FROM operation_audit_logs l
        LEFT JOIN companies c ON c.id = l.company_id
        WHERE (? IS NULL OR l.company_id = ?)
          AND (? IS NULL OR l.module_name = ?)
        ORDER BY l.created_at DESC
        LIMIT 200
        "#,
    )
    .bind(&company_id)
    .bind(&company_id)
    .bind(&module_name)
    .bind(&module_name)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))
}
