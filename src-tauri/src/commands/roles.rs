use crate::db::{Database, DbPool};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use tauri::State;

type UserRoleRow = (
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
);

// ============ Data Types ============

#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub code: String,
    pub description: String,
    pub is_system: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct RolePermission {
    pub id: String,
    pub role_id: String,
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateRoleInput {
    pub name: String,
    pub code: String,
    pub description: String,
    pub permissions: Vec<PermissionInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateRoleInput {
    pub id: String,
    pub name: String,
    pub description: String,
    pub permissions: Vec<PermissionInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PermissionInput {
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoleWithPermissions {
    pub role: Role,
    pub permissions: Vec<RolePermission>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserWithRole {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub role_id: Option<String>,
    pub role_name: Option<String>,
    pub company_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserRoleInput {
    pub user_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkUserCompanyInput {
    pub user_id: String,
    pub company_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserInput {
    pub username: String,
    pub real_name: String,
    pub password: String,
    pub role_id: String,
    pub company_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetUserPasswordInput {
    pub user_id: String,
    pub password: String,
}

async fn create_user_record(
    pool: &sqlx::SqlitePool,
    input: CreateUserInput,
) -> Result<String, String> {
    let username = input.username.trim();
    let real_name = input.real_name.trim();
    if username.chars().count() < 3 || username.chars().count() > 64 {
        return Err("成员用户名须为 3 至 64 个字符".to_string());
    }
    if username.chars().any(char::is_control) || real_name.is_empty() {
        return Err("成员用户名或姓名不合法".to_string());
    }
    crate::commands::auth::validate_admin_password(username, &input.password)?;

    let company_ids = input
        .company_ids
        .into_iter()
        .map(|company_id| company_id.trim().to_string())
        .filter(|company_id| !company_id.is_empty())
        .collect::<BTreeSet<_>>();
    if company_ids.is_empty() {
        return Err("请至少为成员分配一个账套".to_string());
    }

    let role_code: String = sqlx::query_scalar("SELECT code FROM roles WHERE id = ?")
        .bind(&input.role_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("读取成员角色失败: {error}"))?
        .ok_or_else(|| "所选角色不存在".to_string())?;
    let password_hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
        .map_err(|error| format!("成员密码加密失败: {error}"))?;
    let user_id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("创建成员事务失败: {error}"))?;

    sqlx::query(
        "INSERT INTO users (id, username, password_hash, real_name, role, role_id) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&user_id)
    .bind(username)
    .bind(password_hash)
    .bind(real_name)
    .bind(role_code)
    .bind(&input.role_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| format!("创建成员失败，用户名可能已存在: {error}"))?;

    for company_id in company_ids {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM companies WHERE id = ?")
            .bind(&company_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|error| format!("校验成员账套失败: {error}"))?;
        if exists == 0 {
            return Err(format!("账套不存在: {company_id}"));
        }
        sqlx::query("INSERT INTO user_companies (id, user_id, company_id) VALUES (?, ?, ?)")
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&user_id)
            .bind(company_id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("保存成员账套范围失败: {error}"))?;
    }

    tx.commit()
        .await
        .map_err(|error| format!("提交成员创建失败: {error}"))?;
    Ok(user_id)
}

#[cfg(test)]
mod tests {
    use super::{
        create_role_record, create_user_record, update_user_role_record, CreateRoleInput,
        CreateUserInput, LinkUserCompanyInput, PermissionInput, UpdateUserRoleInput,
    };
    use sqlx::SqlitePool;

    #[tokio::test]
    async fn creates_a_login_user_with_a_hashed_password_and_company_scope() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        for statement in [
            "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, real_name TEXT, role TEXT, role_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL)",
            "CREATE TABLE companies (id TEXT PRIMARY KEY)",
            "CREATE TABLE user_companies (id TEXT PRIMARY KEY, user_id TEXT, company_id TEXT, UNIQUE(user_id, company_id))",
        ] {
            sqlx::query(statement)
                .execute(&pool)
                .await
                .expect("test schema");
        }
        sqlx::query("INSERT INTO roles (id, code, name) VALUES ('role-1', 'accountant', '会计')")
            .execute(&pool)
            .await
            .expect("role row");
        sqlx::query("INSERT INTO companies (id) VALUES ('company-a'), ('company-b')")
            .execute(&pool)
            .await
            .expect("company rows");

        let user_id = create_user_record(
            &pool,
            CreateUserInput {
                username: "finance_01".to_string(),
                real_name: "财务一号".to_string(),
                password: "Strong#Ledger2026".to_string(),
                role_id: "role-1".to_string(),
                company_ids: vec!["company-a".to_string(), "company-b".to_string()],
            },
        )
        .await
        .expect("creates user");

        let (password_hash, role): (String, String) =
            sqlx::query_as("SELECT password_hash, role FROM users WHERE id = ?")
                .bind(&user_id)
                .fetch_one(&pool)
                .await
                .expect("created user");
        assert_ne!(password_hash, "Strong#Ledger2026");
        assert!(bcrypt::verify("Strong#Ledger2026", &password_hash).expect("valid hash"));
        assert_eq!(role, "accountant");
        let scope_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM user_companies WHERE user_id = ?")
                .bind(user_id)
                .fetch_one(&pool)
                .await
                .expect("company scope");
        assert_eq!(scope_count, 2);
    }

    #[test]
    fn accepts_camel_case_role_and_company_scope_inputs_from_tauri() {
        let role: UpdateUserRoleInput = serde_json::from_value(serde_json::json!({
            "userId": "user-1",
            "roleId": "role-1"
        }))
        .expect("camel-case role input");
        assert_eq!(role.user_id, "user-1");

        let scope: LinkUserCompanyInput = serde_json::from_value(serde_json::json!({
            "userId": "user-1",
            "companyId": "company-1"
        }))
        .expect("camel-case company scope input");
        assert_eq!(scope.company_id, "company-1");
    }

    async fn role_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory role database");
        for statement in [
            "CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, description TEXT NOT NULL DEFAULT '', is_system INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL, resource TEXT NOT NULL, action TEXT NOT NULL, UNIQUE(role_id, resource, action))",
            "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password_hash TEXT, real_name TEXT, role TEXT, role_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
        ] {
            sqlx::query(statement)
                .execute(&pool)
                .await
                .expect("role test schema");
        }
        pool
    }

    #[tokio::test]
    async fn role_creation_rolls_back_when_any_permission_fails() {
        let pool = role_test_pool().await;
        sqlx::query(
            "CREATE TRIGGER reject_forbidden_permission BEFORE INSERT ON role_permissions WHEN NEW.action = 'forbidden' BEGIN SELECT RAISE(ABORT, 'forced permission failure'); END",
        )
        .execute(&pool)
        .await
        .expect("permission failure trigger");

        let result = create_role_record(
            &pool,
            CreateRoleInput {
                name: "事务角色".to_string(),
                code: "transaction_role".to_string(),
                description: "测试权限原子性".to_string(),
                permissions: vec![
                    PermissionInput {
                        resource: "vouchers".to_string(),
                        action: "view".to_string(),
                    },
                    PermissionInput {
                        resource: "vouchers".to_string(),
                        action: "forbidden".to_string(),
                    },
                ],
            },
        )
        .await;
        assert!(result.is_err());

        let role_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM roles WHERE code = 'transaction_role'")
                .fetch_one(&pool)
                .await
                .expect("counts rolled-back role");
        let permission_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM role_permissions")
            .fetch_one(&pool)
            .await
            .expect("counts rolled-back permissions");
        assert_eq!(role_count, 0);
        assert_eq!(permission_count, 0);
    }

    #[tokio::test]
    async fn invalid_role_assignment_keeps_both_user_role_fields_unchanged() {
        let pool = role_test_pool().await;
        sqlx::query("INSERT INTO users (id, username, password_hash, real_name, role, role_id) VALUES ('user-1', 'tester', 'hash', '测试成员', 'viewer', 'role-old')")
            .execute(&pool)
            .await
            .expect("user row");

        let result = update_user_role_record(
            &pool,
            UpdateUserRoleInput {
                user_id: "user-1".to_string(),
                role_id: "missing-role".to_string(),
            },
        )
        .await;
        assert!(result.is_err());

        let fields: (String, Option<String>) =
            sqlx::query_as("SELECT role, role_id FROM users WHERE id = 'user-1'")
                .fetch_one(&pool)
                .await
                .expect("unchanged user role");
        assert_eq!(fields.0, "viewer");
        assert_eq!(fields.1.as_deref(), Some("role-old"));
    }
}

// ============ Commands ============

#[tauri::command]
pub async fn create_user(
    input: CreateUserInput,
    db: State<'_, Database>,
) -> Result<String, String> {
    create_user_record(db.pool(), input).await
}

#[tauri::command]
pub async fn reset_user_password(
    input: ResetUserPasswordInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
        .bind(&input.user_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|error| format!("读取成员失败: {error}"))?
        .ok_or_else(|| "成员不存在".to_string())?;
    crate::commands::auth::validate_admin_password(&username, &input.password)?;
    let password_hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
        .map_err(|error| format!("成员密码加密失败: {error}"))?;
    sqlx::query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(password_hash)
        .bind(&input.user_id)
        .execute(db.pool())
        .await
        .map_err(|error| format!("重置成员密码失败: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_roles(db: State<'_, Database>) -> Result<Vec<RoleWithPermissions>, String> {
    let roles: Vec<Role> = sqlx::query_as("SELECT * FROM roles ORDER BY is_system DESC, name")
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::new();
    for role in roles {
        let perms: Vec<RolePermission> =
            sqlx::query_as("SELECT * FROM role_permissions WHERE role_id = ?")
                .bind(&role.id)
                .fetch_all(db.pool())
                .await
                .map_err(|e| format!("Database error: {}", e))?;

        result.push(RoleWithPermissions {
            role,
            permissions: perms,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_role(
    input: CreateRoleInput,
    db: State<'_, Database>,
) -> Result<RoleWithPermissions, String> {
    create_role_record(db.pool(), input).await
}

async fn create_role_record(
    pool: &DbPool,
    input: CreateRoleInput,
) -> Result<RoleWithPermissions, String> {
    if input.name.trim().is_empty() || input.code.trim().is_empty() {
        return Err("角色名称和编码不能为空".to_string());
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("创建角色事务失败: {error}"))?;
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM roles WHERE code = ?")
        .bind(&input.code)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err("角色编码已存在".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO roles (id, name, code, description, is_system) VALUES (?, ?, ?, ?, 0)",
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.code)
    .bind(&input.description)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create role: {}", e))?;

    // Insert permissions
    for perm in &input.permissions {
        let perm_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)",
        )
        .bind(&perm_id)
        .bind(&id)
        .bind(&perm.resource)
        .bind(&perm.action)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create permission: {}", e))?;
    }

    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to fetch role: {}", e))?;

    let perms: Vec<RolePermission> =
        sqlx::query_as("SELECT * FROM role_permissions WHERE role_id = ?")
            .bind(&id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let result = RoleWithPermissions {
        role,
        permissions: perms,
    };
    tx.commit()
        .await
        .map_err(|error| format!("提交角色创建失败: {error}"))?;
    Ok(result)
}

#[tauri::command]
pub async fn update_role(
    input: UpdateRoleInput,
    db: State<'_, Database>,
) -> Result<RoleWithPermissions, String> {
    update_role_record(db.pool(), input).await
}

async fn update_role_record(
    pool: &DbPool,
    input: UpdateRoleInput,
) -> Result<RoleWithPermissions, String> {
    if input.name.trim().is_empty() {
        return Err("角色名称不能为空".to_string());
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("更新角色事务失败: {error}"))?;
    // Check not system role
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if role.is_system == 1 {
        return Err("系统内置角色不可修改".to_string());
    }

    sqlx::query("UPDATE roles SET name = ?, description = ?, created_at = created_at WHERE id = ?")
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update role: {}", e))?;

    // Replace permissions: delete old, insert new
    sqlx::query("DELETE FROM role_permissions WHERE role_id = ?")
        .bind(&input.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to clear permissions: {}", e))?;

    for perm in &input.permissions {
        let perm_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)",
        )
        .bind(&perm_id)
        .bind(&input.id)
        .bind(&perm.resource)
        .bind(&perm.action)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to create permission: {}", e))?;
    }

    let updated_role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let perms: Vec<RolePermission> =
        sqlx::query_as("SELECT * FROM role_permissions WHERE role_id = ?")
            .bind(&input.id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let result = RoleWithPermissions {
        role: updated_role,
        permissions: perms,
    };
    tx.commit()
        .await
        .map_err(|error| format!("提交角色更新失败: {error}"))?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_role(id: String, db: State<'_, Database>) -> Result<(), String> {
    delete_role_record(db.pool(), &id).await
}

async fn delete_role_record(pool: &DbPool, id: &str) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("删除角色事务失败: {error}"))?;
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if role.is_system == 1 {
        return Err("系统内置角色不可删除".to_string());
    }

    // Unlink users from this role
    sqlx::query("UPDATE users SET role_id = NULL, role = 'user' WHERE role_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to unlink users: {}", e))?;

    // Delete permissions
    sqlx::query("DELETE FROM role_permissions WHERE role_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete permissions: {}", e))?;

    // Delete role
    sqlx::query("DELETE FROM roles WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete role: {}", e))?;

    tx.commit()
        .await
        .map_err(|error| format!("提交角色删除失败: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_users_with_roles(
    company_id: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<UserWithRole>, String> {
    let rows: Vec<UserRoleRow> = if let Some(ref cid) = company_id {
        sqlx::query_as(
            r#"SELECT u.id, u.username, u.real_name, u.role, u.role_id, r.name as role_name
               FROM users u
               LEFT JOIN roles r ON u.role_id = r.id
               LEFT JOIN user_companies uc ON u.id = uc.user_id
               WHERE uc.company_id = ?
               ORDER BY u.created_at"#,
        )
        .bind(cid)
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    } else {
        sqlx::query_as(
            r#"SELECT u.id, u.username, u.real_name, u.role, u.role_id, r.name as role_name
               FROM users u
               LEFT JOIN roles r ON u.role_id = r.id
               ORDER BY u.created_at"#,
        )
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
    };

    let mut users = Vec::new();
    for (id, username, real_name, role, role_id, role_name) in rows {
        // Get company associations
        let company_rows: Vec<(String,)> =
            sqlx::query_as("SELECT company_id FROM user_companies WHERE user_id = ?")
                .bind(&id)
                .fetch_all(db.pool())
                .await
                .map_err(|e| format!("Database error: {}", e))?;

        users.push(UserWithRole {
            id,
            username,
            real_name,
            role,
            role_id,
            role_name,
            company_ids: company_rows.into_iter().map(|c| c.0).collect(),
        });
    }

    Ok(users)
}

#[tauri::command]
pub async fn update_user_role(
    input: UpdateUserRoleInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    update_user_role_record(db.pool(), input).await
}

async fn update_user_role_record(pool: &DbPool, input: UpdateUserRoleInput) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("成员角色更新事务失败: {error}"))?;
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.role_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "所选角色不存在".to_string())?;

    let result = sqlx::query(
        "UPDATE users SET role_id = ?, role = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&input.role_id)
    .bind(role.code)
    .bind(&input.user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to update user role field: {}", e))?;
    if result.rows_affected() == 0 {
        return Err("成员不存在".to_string());
    }

    tx.commit()
        .await
        .map_err(|error| format!("提交成员角色更新失败: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn link_user_company(
    input: LinkUserCompanyInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?")
            .bind(&input.user_id)
            .bind(&input.company_id)
            .fetch_optional(db.pool())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Ok(()); // Already linked
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO user_companies (id, user_id, company_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&input.user_id)
        .bind(&input.company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to link user to company: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn unlink_user_company(
    input: LinkUserCompanyInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM user_companies WHERE user_id = ? AND company_id = ?")
        .bind(&input.user_id)
        .bind(&input.company_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to unlink user from company: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn check_permission(
    user_id: String,
    resource: String,
    action: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    // Admin always has all permissions
    let user: crate::db::User = sqlx::query_as("SELECT * FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "User not found".to_string())?;

    if user.role == "admin" {
        return Ok(true);
    }

    // Check role_id based permissions
    if let Some(role_id) = &user.role_id {
        let perm: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM role_permissions WHERE role_id = ? AND resource = ? AND action = ?",
        )
        .bind(role_id)
        .bind(&resource)
        .bind(&action)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        return Ok(perm.is_some());
    }

    // Fallback: legacy role-based check
    let has_permission = match user.role.as_str() {
        "admin" => true,
        "manager" => action != "delete" || resource != "users",
        "accountant" => matches!(action.as_str(), "view" | "create" | "edit"),
        "viewer" => action == "view",
        _ => action == "view",
    };

    Ok(has_permission)
}
