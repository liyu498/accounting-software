use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

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
pub struct UpdateUserRoleInput {
    pub user_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LinkUserCompanyInput {
    pub user_id: String,
    pub company_id: String,
}

// ============ Commands ============

#[tauri::command]
pub async fn get_roles(db: State<'_, Database>) -> Result<Vec<RoleWithPermissions>, String> {
    let roles: Vec<Role> = sqlx::query_as("SELECT * FROM roles ORDER BY is_system DESC, name")
        .fetch_all(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::new();
    for role in roles {
        let perms: Vec<RolePermission> = sqlx::query_as(
            "SELECT * FROM role_permissions WHERE role_id = ?",
        )
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
    if input.name.trim().is_empty() || input.code.trim().is_empty() {
        return Err("角色名称和编码不能为空".to_string());
    }

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM roles WHERE code = ?",
    )
    .bind(&input.code)
    .fetch_optional(db.pool())
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
    .execute(db.pool())
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
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to create permission: {}", e))?;
    }

    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch role: {}", e))?;

    let perms: Vec<RolePermission> = sqlx::query_as(
        "SELECT * FROM role_permissions WHERE role_id = ?",
    )
    .bind(&id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(RoleWithPermissions {
        role,
        permissions: perms,
    })
}

#[tauri::command]
pub async fn update_role(
    input: UpdateRoleInput,
    db: State<'_, Database>,
) -> Result<RoleWithPermissions, String> {
    // Check not system role
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if role.is_system == 1 {
        return Err("系统内置角色不可修改".to_string());
    }

    let _now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE roles SET name = ?, description = ?, created_at = created_at WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.id)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to update role: {}", e))?;

    // Replace permissions: delete old, insert new
    sqlx::query("DELETE FROM role_permissions WHERE role_id = ?")
        .bind(&input.id)
        .execute(db.pool())
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
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to create permission: {}", e))?;
    }

    let updated_role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let perms: Vec<RolePermission> = sqlx::query_as(
        "SELECT * FROM role_permissions WHERE role_id = ?",
    )
    .bind(&input.id)
    .fetch_all(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(RoleWithPermissions {
        role: updated_role,
        permissions: perms,
    })
}

#[tauri::command]
pub async fn delete_role(
    id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if role.is_system == 1 {
        return Err("系统内置角色不可删除".to_string());
    }

    // Unlink users from this role
    sqlx::query("UPDATE users SET role_id = NULL WHERE role_id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to unlink users: {}", e))?;

    // Delete permissions
    sqlx::query("DELETE FROM role_permissions WHERE role_id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete permissions: {}", e))?;

    // Delete role
    sqlx::query("DELETE FROM roles WHERE id = ?")
        .bind(&id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to delete role: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_users_with_roles(
    company_id: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<UserWithRole>, String> {
    let rows: Vec<(String, String, String, String, Option<String>, Option<String>)> = if let Some(ref cid) = company_id {
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
        let company_rows: Vec<(String,)> = sqlx::query_as(
            "SELECT company_id FROM user_companies WHERE user_id = ?",
        )
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
    sqlx::query("UPDATE users SET role_id = ? WHERE id = ?")
        .bind(&input.role_id)
        .bind(&input.user_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to update user role: {}", e))?;

    // Also update the legacy role field for backward compat
    let role: Role = sqlx::query_as("SELECT * FROM roles WHERE id = ?")
        .bind(&input.role_id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query("UPDATE users SET role = ? WHERE id = ?")
        .bind(&role.code)
        .bind(&input.user_id)
        .execute(db.pool())
        .await
        .map_err(|e| format!("Failed to update user role field: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn link_user_company(
    input: LinkUserCompanyInput,
    db: State<'_, Database>,
) -> Result<(), String> {
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?",
    )
    .bind(&input.user_id)
    .bind(&input.company_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Ok(()); // Already linked
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO user_companies (id, user_id, company_id) VALUES (?, ?, ?)",
    )
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
