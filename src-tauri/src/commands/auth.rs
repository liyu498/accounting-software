use crate::db::{Database, DbPool, User};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::OnceLock;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<UserInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub role_id: Option<String>,
    pub permissions: Vec<PermissionGrant>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PermissionGrant {
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthCheckResponse {
    pub is_authenticated: bool,
    pub user: Option<UserInfo>,
}

#[derive(Debug, Serialize)]
pub struct AuthSetupStatus {
    pub initialized: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InitializeAdminInput {
    pub username: String,
    pub password: String,
    pub real_name: String,
}

static SESSION_SIGNING_KEY: OnceLock<Vec<u8>> = OnceLock::new();

fn session_signing_key() -> &'static [u8] {
    SESSION_SIGNING_KEY.get_or_init(|| uuid::Uuid::new_v4().as_bytes().to_vec())
}

pub(crate) fn validate_admin_password(username: &str, password: &str) -> Result<(), String> {
    let long_enough = password.chars().count() >= 12;
    let has_upper = password.chars().any(char::is_uppercase);
    let has_lower = password.chars().any(char::is_lowercase);
    let has_digit = password.chars().any(|value| value.is_ascii_digit());
    let has_symbol = password.chars().any(|value| !value.is_alphanumeric());

    if !long_enough || !has_upper || !has_lower || !has_digit || !has_symbol {
        return Err("管理员密码至少 12 位，并须包含大小写字母、数字和符号".to_string());
    }
    if password.to_lowercase().contains(&username.to_lowercase()) {
        return Err("管理员密码不能包含用户名".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct CommandPermission {
    resource: &'static str,
    action: &'static str,
    admin_only: bool,
}

fn command_permission(command: &str) -> Option<CommandPermission> {
    if matches!(
        command,
        "sync_external_invoice_pool" | "reject_external_invoice_sync_item"
    ) {
        return Some(CommandPermission {
            resource: "invoices",
            action: if command.starts_with("sync_") {
                "import"
            } else {
                "approve"
            },
            admin_only: false,
        });
    }
    if matches!(
        command,
        "sync_external_bank_statement" | "reject_external_bank_sync_item"
    ) {
        return Some(CommandPermission {
            resource: "bank",
            action: if command.starts_with("sync_") {
                "import"
            } else {
                "approve"
            },
            admin_only: false,
        });
    }
    if command == "submit_tax_declaration_task" {
        return Some(CommandPermission {
            resource: "tax",
            action: "approve",
            admin_only: false,
        });
    }
    if command == "sync_tax_declaration_receipt" {
        return Some(CommandPermission {
            resource: "tax",
            action: "edit",
            admin_only: false,
        });
    }
    if command.contains("adapter_authorization") || command.contains("adapter_provider") {
        return Some(CommandPermission {
            resource: "settings",
            action: if command.starts_with("get_") {
                "view"
            } else {
                "edit"
            },
            admin_only: true,
        });
    }
    if command.contains("agency_") || command.starts_with("get_agency_") {
        return Some(CommandPermission {
            resource: "settings",
            action: if command.starts_with("get_") {
                "view"
            } else {
                "edit"
            },
            admin_only: true,
        });
    }
    if matches!(
        command,
        "get_deleted_companies" | "cleanup_expired_companies"
    ) {
        return Some(CommandPermission {
            resource: "settings",
            action: if command.starts_with("get_") {
                "view"
            } else {
                "delete"
            },
            admin_only: true,
        });
    }
    if matches!(
        command,
        "create_company"
            | "create_local_backup"
            | "list_local_backups"
            | "verify_local_backup"
            | "schedule_local_backup_restore"
    ) {
        return Some(CommandPermission {
            resource: "settings",
            action: if command.starts_with("list_") || command.starts_with("verify_") {
                "view"
            } else if command.starts_with("schedule_") {
                "edit"
            } else {
                "create"
            },
            admin_only: true,
        });
    }

    let admin_action = match command {
        "create_role"
        | "update_role"
        | "update_user_role"
        | "create_user"
        | "reset_user_password"
        | "link_user_company"
        | "unlink_user_company" => Some("edit"),
        "delete_role" => Some("delete"),
        _ => None,
    };
    if let Some(action) = admin_action {
        return Some(CommandPermission {
            resource: "users",
            action,
            admin_only: true,
        });
    }

    let action = if command.starts_with("get_")
        || command.starts_with("list_")
        || command.starts_with("query_")
        || command.starts_with("search_")
        || command.starts_with("suggest_")
        || command.starts_with("check_")
        || command.starts_with("verify_")
        || command.starts_with("validate_")
        || command.starts_with("calculate_")
        || command.starts_with("preview_")
    {
        "view"
    } else if command.starts_with("download_") || command.starts_with("export_") {
        "export"
    } else if command.starts_with("import_") || command.starts_with("parse_") {
        "import"
    } else if command.starts_with("approve_")
        || command.starts_with("batch_approve_")
        || command.starts_with("batch_reverse_approve_")
        || command.starts_with("confirm_")
        || command.starts_with("review_")
        || command.starts_with("finalize_")
        || command.starts_with("publish_")
    {
        "approve"
    } else if command.starts_with("close_") || command.starts_with("reopen_") {
        "close"
    } else if command.starts_with("delete_")
        || command.starts_with("void_")
        || command.starts_with("permanent_delete_")
        || command.starts_with("cleanup_")
        || command.starts_with("unlink_")
    {
        "delete"
    } else if command.starts_with("create_")
        || command.starts_with("copy_")
        || command.starts_with("clone_")
        || command.starts_with("restore_")
        || command.starts_with("ensure_")
        || command.starts_with("link_")
    {
        "create"
    } else if command.starts_with("add_")
        || command.starts_with("update_")
        || command.starts_with("upsert_")
        || command.starts_with("toggle_")
        || command.starts_with("complete_")
        || command.starts_with("run_")
        || command.starts_with("recalculate_")
        || command.starts_with("prepare_")
        || command.starts_with("reverse_")
        || command.starts_with("reorganize_")
        || command.starts_with("replace_")
        || command.starts_with("match_")
        || command.starts_with("save_")
        || command.starts_with("write_")
        || command.starts_with("activate_")
        || command.starts_with("deactivate_")
    {
        "edit"
    } else {
        return None;
    };

    let resource = if command.contains("role") || command.contains("user") {
        "users"
    } else if command.contains("employee")
        || command.contains("payroll")
        || command.contains("social_security")
        || command.contains("special_deduction")
    {
        "payroll"
    } else if command.contains("voucher") {
        "vouchers"
    } else if command.contains("invoice") {
        "invoices"
    } else if command.contains("tax_declaration")
        || command.contains("tax_deadline")
        || command.contains("tax_calendar_day")
    {
        "tax"
    } else if command.contains("report")
        || command.contains("balance_sheet")
        || command.contains("income_statement")
        || command.contains("cash_flow")
        || command.contains("equity_change_statement")
    {
        "reports"
    } else if command.contains("ledger")
        || command.contains("account_balance")
        || command.contains("trial_balance")
        || command.contains("accounting_reconciliation")
    {
        "ledger"
    } else if command.contains("initial_balance") {
        "vouchers"
    } else if command.contains("period") {
        if action == "view" {
            "ledger"
        } else {
            "period"
        }
    } else if command.contains("inventory")
        || command.contains("fixed_asset")
        || command.contains("asset_category")
        || command.contains("measurement_unit")
    {
        "inventory"
    } else if command.contains("bank")
        || command.contains("settlement")
        || command.contains("account_transfer")
        || command.contains("currency")
    {
        "bank"
    } else {
        "settings"
    };

    Some(CommandPermission {
        resource,
        action,
        admin_only: false,
    })
}

fn collect_company_ids(value: &serde_json::Value, company_ids: &mut BTreeSet<String>) {
    match value {
        serde_json::Value::Object(object) => {
            for (key, child) in object {
                if matches!(key.as_str(), "companyId" | "company_id") {
                    if let Some(company_id) =
                        child.as_str().map(str::trim).filter(|id| !id.is_empty())
                    {
                        company_ids.insert(company_id.to_string());
                    }
                }
                collect_company_ids(child, company_ids);
            }
        }
        serde_json::Value::Array(values) => {
            for child in values {
                collect_company_ids(child, company_ids);
            }
        }
        _ => {}
    }
}

fn collect_string_fields(
    value: &serde_json::Value,
    field_names: &[&str],
    values: &mut BTreeSet<String>,
) {
    match value {
        serde_json::Value::Object(object) => {
            for (key, child) in object {
                if field_names.contains(&key.as_str()) {
                    if let Some(value) = child.as_str().map(str::trim).filter(|id| !id.is_empty()) {
                        values.insert(value.to_string());
                    }
                }
                collect_string_fields(child, field_names, values);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                collect_string_fields(item, field_names, values);
            }
        }
        _ => {}
    }
}

async fn collect_related_company_ids(
    pool: &sqlx::SqlitePool,
    payload: &serde_json::Value,
    company_ids: &mut BTreeSet<String>,
) -> Result<(), String> {
    let mut period_ids = BTreeSet::new();
    collect_string_fields(payload, &["periodId", "period_id"], &mut period_ids);
    for period_id in period_ids {
        let company_id: String =
            sqlx::query_scalar("SELECT company_id FROM accounting_periods WHERE id = ?")
                .bind(&period_id)
                .fetch_optional(pool)
                .await
                .map_err(|error| format!("读取会计期间所属账套失败: {error}"))?
                .ok_or_else(|| format!("会计期间不存在: {period_id}"))?;
        company_ids.insert(company_id);
    }

    let mut voucher_ids = BTreeSet::new();
    collect_string_fields(payload, &["voucherId", "voucher_id"], &mut voucher_ids);
    for voucher_id in voucher_ids {
        let company_id: String = sqlx::query_scalar("SELECT company_id FROM vouchers WHERE id = ?")
            .bind(&voucher_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取凭证所属账套失败: {error}"))?
            .ok_or_else(|| format!("凭证不存在: {voucher_id}"))?;
        company_ids.insert(company_id);
    }

    let mut entry_ids = BTreeSet::new();
    collect_string_fields(payload, &["entryId", "entry_id"], &mut entry_ids);
    for entry_id in entry_ids {
        let company_id: String = sqlx::query_scalar(
            "SELECT v.company_id FROM voucher_entries e JOIN vouchers v ON v.id = e.voucher_id WHERE e.id = ?",
        )
        .bind(&entry_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取凭证分录所属账套失败: {error}"))?
        .ok_or_else(|| format!("凭证分录不存在: {entry_id}"))?;
        company_ids.insert(company_id);
    }

    Ok(())
}

fn legacy_role_has_permission(role: &str, resource: &str, action: &str) -> bool {
    let allowed = |actions: &[&str]| actions.contains(&action);
    match role {
        "admin" => true,
        "manager" => match resource {
            "vouchers" => allowed(&["view", "create", "edit", "approve", "export", "print"]),
            "invoices" => allowed(&["view", "create", "edit", "delete"]),
            "tax" => allowed(&["view", "create", "edit", "approve", "export", "print"]),
            "reports" => allowed(&["view", "approve", "export", "print"]),
            "ledger" => allowed(&["view", "export", "print"]),
            "payroll" => allowed(&["view", "create", "edit", "export"]),
            "settings" => allowed(&["view", "edit"]),
            "period" => action == "close",
            "users" => action == "view",
            "inventory" => allowed(&["view", "create", "edit", "delete"]),
            "bank" => allowed(&["view", "create", "edit"]),
            _ => false,
        },
        "accountant" => match resource {
            "vouchers" => allowed(&["view", "create", "edit", "export"]),
            "invoices" | "inventory" => allowed(&["view", "create", "edit"]),
            "tax" | "payroll" => allowed(&["view", "create", "edit", "export"]),
            "reports" | "ledger" => allowed(&["view", "export"]),
            "settings" | "bank" => action == "view",
            _ => false,
        },
        "viewer" => {
            matches!(
                resource,
                "vouchers"
                    | "invoices"
                    | "tax"
                    | "reports"
                    | "settings"
                    | "ledger"
                    | "inventory"
                    | "payroll"
                    | "bank"
            ) && action == "view"
        }
        _ => false,
    }
}

async fn load_user_permissions(
    pool: &sqlx::SqlitePool,
    role_id: Option<&str>,
    role_code: &str,
) -> Result<Vec<PermissionGrant>, String> {
    let effective_role_id = if let Some(role_id) = role_id {
        Some(role_id.to_string())
    } else {
        sqlx::query_scalar("SELECT id FROM roles WHERE code = ? LIMIT 1")
            .bind(role_code)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取用户角色失败: {error}"))?
    };
    let Some(role_id) = effective_role_id else {
        return Ok(Vec::new());
    };

    sqlx::query_as(
        "SELECT resource, action FROM role_permissions WHERE role_id = ? ORDER BY resource, action",
    )
    .bind(role_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("读取用户权限失败: {error}"))
}

async fn authorize_user_command(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    command: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let requirement = command_permission(command)
        .ok_or_else(|| format!("命令 {command} 尚未配置服务端授权策略"))?;
    let user: (String, Option<String>) =
        sqlx::query_as("SELECT role, role_id FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取当前用户权限失败: {error}"))?
            .ok_or_else(|| "当前登录用户不存在".to_string())?;
    let (role, role_id) = user;

    if role == "admin" {
        return Ok(());
    }
    if requirement.admin_only {
        return Err("当前账户无权执行管理员操作".to_string());
    }
    if command == "check_permission" {
        let requested_user_id = payload
            .get("userId")
            .or_else(|| payload.get("user_id"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if requested_user_id != user_id {
            return Err("只能查询当前账户的权限".to_string());
        }
        return Ok(());
    }

    let has_permission = if matches!(role.as_str(), "manager" | "accountant" | "viewer") {
        legacy_role_has_permission(&role, requirement.resource, requirement.action)
    } else if let Some(role_id) = role_id {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM role_permissions WHERE role_id = ? AND resource = ? AND action = ?",
        )
        .bind(role_id)
        .bind(requirement.resource)
        .bind(requirement.action)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("读取角色权限失败: {error}"))?
            > 0
    } else {
        false
    };
    if !has_permission {
        return Err(format!(
            "当前账户无权执行 {}:{}",
            requirement.resource, requirement.action
        ));
    }

    let mut company_ids = BTreeSet::new();
    collect_company_ids(payload, &mut company_ids);
    collect_related_company_ids(pool, payload, &mut company_ids).await?;
    if matches!(
        command,
        "get_company"
            | "update_company"
            | "delete_company"
            | "deactivate_company"
            | "activate_company"
            | "restore_company"
            | "permanent_delete_company"
    ) {
        if let Some(company_id) = payload.get("id").and_then(serde_json::Value::as_str) {
            company_ids.insert(company_id.to_string());
        }
    }

    for company_id in company_ids {
        let assigned: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM user_companies WHERE user_id = ? AND company_id = ?",
        )
        .bind(user_id)
        .bind(&company_id)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("读取用户账套范围失败: {error}"))?;
        if assigned == 0 {
            return Err(format!("当前账户无权访问账套 {company_id}"));
        }
    }

    Ok(())
}

pub(crate) fn validate_session_token(token: &str) -> Result<String, String> {
    if token.is_empty() {
        return Err("登录会话已失效，请重新登录".to_string());
    }
    jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(session_signing_key()),
        &jsonwebtoken::Validation::default(),
    )
    .map(|data| data.claims.sub)
    .map_err(|_| "登录会话已失效，请重新登录".to_string())
}

pub(crate) async fn authenticated_actor(pool: &DbPool, auth_token: &str) -> Result<String, String> {
    let user_id = validate_session_token(auth_token)?;
    let user: Option<(String, String)> =
        sqlx::query_as("SELECT username, real_name FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("读取当前操作人失败: {error}"))?;
    let (username, real_name) = user.ok_or_else(|| "当前登录用户不存在".to_string())?;
    let username = username.trim();
    let real_name = real_name.trim();
    if real_name.is_empty() || real_name == username {
        Ok(username.to_string())
    } else {
        Ok(format!("{real_name} ({username})"))
    }
}

fn is_public_command(command: &str) -> bool {
    matches!(
        command,
        "login" | "logout" | "check" | "get_auth_setup_status" | "initialize_admin"
    )
}

pub(crate) async fn authorize_invoke<R: tauri::Runtime>(
    invoke: &tauri::ipc::Invoke<R>,
) -> Result<(), String> {
    let command = invoke.message.command();
    if is_public_command(command) {
        return Ok(());
    }

    let payload = match invoke.message.payload() {
        tauri::ipc::InvokeBody::Json(serde_json::Value::Object(payload)) => payload,
        _ => return Err("请先登录后再执行此操作".to_string()),
    };
    let token = payload
        .get("authToken")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "请先登录后再执行此操作".to_string())?;
    let user_id = validate_session_token(token)?;
    let state = invoke.message.state();
    let db = state.get::<Database>();
    authorize_user_command(
        db.pool(),
        &user_id,
        command,
        &serde_json::Value::Object(payload.clone()),
    )
    .await
}

#[tauri::command]
pub async fn get_auth_setup_status(db: State<'_, Database>) -> Result<AuthSetupStatus, String> {
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(db.pool())
        .await
        .map_err(|error| format!("读取管理员初始化状态失败: {error}"))?;
    Ok(AuthSetupStatus {
        initialized: user_count > 0,
    })
}

#[tauri::command]
pub async fn initialize_admin(
    input: InitializeAdminInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    let username = input.username.trim();
    let real_name = input.real_name.trim();
    if username.chars().count() < 3 || username.chars().count() > 64 {
        return Err("管理员用户名须为 3 至 64 个字符".to_string());
    }
    if username.chars().any(char::is_control) || real_name.is_empty() {
        return Err("管理员用户名或姓名不合法".to_string());
    }
    validate_admin_password(username, &input.password)?;

    let password_hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
        .map_err(|error| format!("管理员密码加密失败: {error}"))?;
    let admin_role_id: Option<String> =
        sqlx::query_scalar("SELECT id FROM roles WHERE code = 'admin' LIMIT 1")
            .fetch_optional(db.pool())
            .await
            .map_err(|error| format!("读取管理员角色失败: {error}"))?;

    let result = sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, real_name, role, role_id)
        SELECT ?, ?, ?, ?, 'admin', ?
        WHERE NOT EXISTS (SELECT 1 FROM users)
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(username)
    .bind(password_hash)
    .bind(real_name)
    .bind(admin_role_id)
    .execute(db.pool())
    .await
    .map_err(|error| format!("创建管理员失败: {error}"))?;

    if result.rows_affected() != 1 {
        return Err("系统已完成管理员初始化，请直接登录".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn login(
    request: LoginRequest,
    db: State<'_, Database>,
) -> Result<LoginResponse, String> {
    log::info!("Login attempt for user: {}", request.username);

    let user: User = sqlx::query_as("SELECT * FROM users WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Invalid credentials".to_string())?;

    let password_valid = bcrypt::verify(&request.password, &user.password_hash)
        .map_err(|e| format!("Password verification error: {}", e))?;

    if !password_valid {
        log::warn!(
            "Failed login attempt for user: {} (password mismatch)",
            request.username
        );
        return Ok(LoginResponse {
            success: false,
            token: None,
            user: None,
            error: Some("Invalid credentials".to_string()),
        });
    }

    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user.id.clone(),
        exp: now + 86400,
        iat: now,
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(session_signing_key()),
    )
    .map_err(|e| format!("Token generation error: {}", e))?;

    log::info!("User logged in successfully: {}", request.username);

    let permissions = load_user_permissions(db.pool(), user.role_id.as_deref(), &user.role).await?;

    Ok(LoginResponse {
        success: true,
        token: Some(token),
        user: Some(UserInfo {
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            role: user.role,
            role_id: user.role_id,
            permissions,
        }),
        error: None,
    })
}

#[tauri::command]
pub async fn logout() -> Result<(), String> {
    log::info!("User logged out");
    Ok(())
}

#[tauri::command]
pub async fn check(
    token: Option<String>,
    db: State<'_, Database>,
) -> Result<AuthCheckResponse, String> {
    if token.is_none() || token.as_ref().is_none_or(|t| t.is_empty()) {
        return Ok(AuthCheckResponse {
            is_authenticated: false,
            user: None,
        });
    }

    match validate_session_token(token.as_deref().unwrap_or_default()) {
        Ok(user_id) => {
            let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = ?")
                .bind(&user_id)
                .fetch_optional(db.pool())
                .await
                .map_err(|e| format!("Database error: {}", e))?;

            let user = if let Some(user) = user {
                let permissions =
                    load_user_permissions(db.pool(), user.role_id.as_deref(), &user.role).await?;
                Some(UserInfo {
                    id: user.id,
                    username: user.username,
                    real_name: user.real_name,
                    role: user.role,
                    role_id: user.role_id,
                    permissions,
                })
            } else {
                None
            };
            Ok(AuthCheckResponse {
                is_authenticated: user.is_some(),
                user,
            })
        }
        Err(_) => Ok(AuthCheckResponse {
            is_authenticated: false,
            user: None,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        authenticated_actor, authorize_user_command, collect_company_ids, command_permission,
        is_public_command, legacy_role_has_permission, load_user_permissions, session_signing_key,
        validate_admin_password, Claims,
    };
    use crate::db::Database;
    use sqlx::SqlitePool;
    use std::collections::BTreeSet;

    #[test]
    fn accepts_a_strong_initial_admin_password() {
        assert!(validate_admin_password("finance_admin", "Strong#Ledger2026").is_ok());
    }

    #[test]
    fn rejects_weak_or_username_based_initial_admin_passwords() {
        for password in [
            "short#A1",
            "alllowercase#2026",
            "ALLUPPERCASE#2026",
            "NoDigitsInHere#",
            "NoSymbolsHere2026",
            "finance_admin#A2026",
        ] {
            assert!(
                validate_admin_password("finance_admin", password).is_err(),
                "password should be rejected: {password}"
            );
        }
    }

    #[tokio::test]
    async fn audit_actor_is_derived_from_the_authenticated_session() {
        let data_dir =
            std::env::temp_dir().join(format!("authenticated-actor-test-{}", uuid::Uuid::new_v4()));
        let database = Database::new(data_dir.clone())
            .await
            .expect("initializes authenticated actor database");
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, real_name, role) VALUES ('user-1', 'accountant.wang', 'unused', '王会计', 'accountant')",
        )
        .execute(database.pool())
        .await
        .expect("creates authenticated audit user");

        let now = chrono::Utc::now().timestamp() as usize;
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &Claims {
                sub: "user-1".to_string(),
                exp: now + 3600,
                iat: now,
            },
            &jsonwebtoken::EncodingKey::from_secret(session_signing_key()),
        )
        .expect("creates test session token");

        let actor = authenticated_actor(database.pool(), &token)
            .await
            .expect("resolves authenticated actor");
        assert_eq!(actor, "王会计 (accountant.wang)");
        assert!(authenticated_actor(database.pool(), "forged-token")
            .await
            .is_err());

        database.pool().close().await;
        crate::test_support::remove_test_data_dir(
            &data_dir,
            "removes authenticated actor database",
        );
    }

    #[test]
    fn maps_sensitive_commands_to_server_side_permissions() {
        let role_write = command_permission("create_role").expect("role command must be mapped");
        assert_eq!(role_write.resource, "users");
        assert_eq!(role_write.action, "edit");
        assert!(role_write.admin_only);

        let voucher_read =
            command_permission("get_vouchers").expect("voucher command must be mapped");
        assert_eq!(voucher_read.resource, "vouchers");
        assert_eq!(voucher_read.action, "view");
        assert!(!voucher_read.admin_only);

        let settlement_preview = command_permission("preview_settlement_rule")
            .expect("settlement preview must be mapped");
        assert_eq!(settlement_preview.resource, "bank");
        assert_eq!(settlement_preview.action, "view");
        let settlement_create = command_permission("create_settlement_voucher_draft")
            .expect("settlement voucher creation must be mapped");
        assert_eq!(settlement_create.resource, "vouchers");
        assert_eq!(settlement_create.action, "create");

        assert_eq!(
            command_permission("get_employees")
                .expect("employee command must be mapped")
                .resource,
            "payroll"
        );
        assert_eq!(
            command_permission("confirm_tax_declaration_task")
                .expect("tax command must be mapped")
                .resource,
            "tax"
        );
        let reconciliation = command_permission("get_accounting_reconciliation")
            .expect("accounting reconciliation must be mapped");
        assert_eq!(reconciliation.resource, "ledger");
        assert_eq!(reconciliation.action, "view");
        let equity_change = command_permission("get_equity_change_statement")
            .expect("equity change statement must be mapped");
        assert_eq!(equity_change.resource, "reports");
        assert_eq!(equity_change.action, "view");
        let clone_template = command_permission("clone_report_template_for_company")
            .expect("report template cloning must be mapped");
        assert_eq!(clone_template.resource, "reports");
        assert_eq!(clone_template.action, "create");

        assert!(
            command_permission("get_agency_operation_overview")
                .expect("agency command must be mapped")
                .admin_only
        );
        assert!(
            command_permission("get_deleted_companies")
                .expect("global recycle-bin command must be mapped")
                .admin_only
        );
        assert!(
            command_permission("create_company")
                .expect("company creation must be mapped")
                .admin_only
        );
        assert!(
            command_permission("list_local_backups")
                .expect("backup inventory must be mapped")
                .admin_only
        );

        assert!(command_permission("unmapped_internal_command").is_none());
    }

    #[test]
    fn every_registered_tauri_command_has_an_authorization_policy() {
        let source = include_str!("../lib.rs");
        let handler = source
            .split_once("generate_handler![")
            .expect("Tauri handler must be registered")
            .1
            .split_once("]);")
            .expect("Tauri handler must be terminated")
            .0;
        let commands = handler
            .lines()
            .filter_map(|line| {
                let line = line.trim().trim_end_matches(',');
                line.starts_with("commands::")
                    .then(|| line.rsplit("::").next().expect("command name"))
            })
            .collect::<Vec<_>>();

        assert_eq!(commands.len(), 309, "registered command count changed");
        for command in commands {
            assert!(
                is_public_command(command) || command_permission(command).is_some(),
                "registered command lacks an authorization policy: {command}"
            );
        }
    }

    #[test]
    fn extracts_nested_company_scopes_from_invoke_payloads() {
        let payload = serde_json::json!({
            "companyId": "company-a",
            "input": {
                "company_id": "company-b",
                "rows": [{ "companyId": "company-a" }]
            }
        });
        let mut company_ids = BTreeSet::new();
        collect_company_ids(&payload, &mut company_ids);

        assert_eq!(
            company_ids.into_iter().collect::<Vec<_>>(),
            vec!["company-a".to_string(), "company-b".to_string()]
        );
    }

    #[test]
    fn legacy_roles_cannot_cross_configured_action_boundaries() {
        assert!(legacy_role_has_permission("viewer", "vouchers", "view"));
        assert!(!legacy_role_has_permission("viewer", "vouchers", "create"));
        assert!(!legacy_role_has_permission("accountant", "users", "view"));
        assert!(!legacy_role_has_permission("manager", "users", "delete"));
        assert!(legacy_role_has_permission("manager", "vouchers", "approve"));
        assert!(legacy_role_has_permission("manager", "payroll", "edit"));
        assert!(legacy_role_has_permission(
            "accountant",
            "payroll",
            "create"
        ));
        assert!(legacy_role_has_permission("viewer", "payroll", "view"));
        assert!(legacy_role_has_permission("manager", "tax", "approve"));
    }

    #[tokio::test]
    async fn rejects_admin_only_commands_and_unassigned_company_scopes() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        sqlx::query("CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT NOT NULL, role_id TEXT)")
            .execute(&pool)
            .await
            .expect("users table");
        sqlx::query(
            "CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role_id TEXT, resource TEXT, action TEXT)",
        )
        .execute(&pool)
        .await
        .expect("role permissions table");
        sqlx::query(
            "CREATE TABLE user_companies (id TEXT PRIMARY KEY, user_id TEXT, company_id TEXT)",
        )
        .execute(&pool)
        .await
        .expect("user companies table");
        sqlx::query(
            "CREATE TABLE accounting_periods (id TEXT PRIMARY KEY, company_id TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("accounting periods table");
        sqlx::query("CREATE TABLE vouchers (id TEXT PRIMARY KEY, company_id TEXT NOT NULL)")
            .execute(&pool)
            .await
            .expect("vouchers table");
        sqlx::query("CREATE TABLE voucher_entries (id TEXT PRIMARY KEY, voucher_id TEXT NOT NULL)")
            .execute(&pool)
            .await
            .expect("voucher entries table");
        sqlx::query("INSERT INTO users (id, role, role_id) VALUES ('viewer-1', 'viewer', NULL)")
            .execute(&pool)
            .await
            .expect("viewer user");

        assert!(
            authorize_user_command(&pool, "viewer-1", "create_role", &serde_json::json!({}))
                .await
                .is_err()
        );
        assert!(authorize_user_command(
            &pool,
            "viewer-1",
            "get_vouchers",
            &serde_json::json!({ "companyId": "company-b" })
        )
        .await
        .is_err());

        sqlx::query(
            "INSERT INTO accounting_periods (id, company_id) VALUES ('period-a', 'company-a')",
        )
        .execute(&pool)
        .await
        .expect("period row");
        sqlx::query("INSERT INTO vouchers (id, company_id) VALUES ('voucher-a', 'company-a')")
            .execute(&pool)
            .await
            .expect("voucher row");
        sqlx::query("INSERT INTO voucher_entries (id, voucher_id) VALUES ('entry-a', 'voucher-a')")
            .execute(&pool)
            .await
            .expect("voucher entry row");
        for (command, payload) in [
            (
                "get_trial_balance",
                serde_json::json!({ "periodId": "period-a" }),
            ),
            (
                "get_voucher_entries",
                serde_json::json!({ "voucherId": "voucher-a" }),
            ),
            (
                "get_voucher_entry_auxiliaries",
                serde_json::json!({ "entryId": "entry-a" }),
            ),
        ] {
            assert!(
                authorize_user_command(&pool, "viewer-1", command, &payload)
                    .await
                    .is_err(),
                "{command} must reject objects owned by another company"
            );
        }

        sqlx::query(
            "INSERT INTO user_companies (id, user_id, company_id) VALUES ('link-1', 'viewer-1', 'company-b')",
        )
        .execute(&pool)
        .await
        .expect("company link");
        assert!(authorize_user_command(
            &pool,
            "viewer-1",
            "get_vouchers",
            &serde_json::json!({ "companyId": "company-b" })
        )
        .await
        .is_ok());

        sqlx::query(
            "INSERT INTO user_companies (id, user_id, company_id) VALUES ('link-2', 'viewer-1', 'company-a')",
        )
        .execute(&pool)
        .await
        .expect("second company link");
        assert!(authorize_user_command(
            &pool,
            "viewer-1",
            "get_trial_balance",
            &serde_json::json!({ "periodId": "period-a" })
        )
        .await
        .is_ok());
    }

    #[tokio::test]
    async fn loads_custom_role_permissions_for_the_authenticated_user() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        sqlx::query(
            "CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role_id TEXT, resource TEXT, action TEXT)",
        )
        .execute(&pool)
        .await
        .expect("role permissions table");
        sqlx::query(
            "INSERT INTO role_permissions (id, role_id, resource, action) VALUES ('p1', 'custom-1', 'payroll', 'edit')",
        )
        .execute(&pool)
        .await
        .expect("custom permission");

        let permissions = load_user_permissions(&pool, Some("custom-1"), "custom_finance")
            .await
            .expect("loads custom permissions");
        assert_eq!(permissions.len(), 1);
        assert_eq!(permissions[0].resource, "payroll");
        assert_eq!(permissions[0].action, "edit");
    }
}
