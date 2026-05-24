use crate::db::{Database, User};
use serde::{Deserialize, Serialize};
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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthCheckResponse {
    pub is_authenticated: bool,
    pub user: Option<UserInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterInput {
    pub username: String,
    pub password: String,
    pub real_name: String,
    pub role: Option<String>,
}

const JWT_SECRET: &str = "accounting-software-secret-key-2024";

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
    iat: usize,
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
        log::warn!("Failed login attempt for user: {}", request.username);
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
        &jsonwebtoken::EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| format!("Token generation error: {}", e))?;

    log::info!("User logged in successfully: {}", request.username);

    Ok(LoginResponse {
        success: true,
        token: Some(token),
        user: Some(UserInfo {
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            role: user.role,
            role_id: user.role_id,
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
    if token.is_none() || token.as_ref().map_or(true, |t| t.is_empty()) {
        return Ok(AuthCheckResponse {
            is_authenticated: false,
            user: None,
        });
    }

    // Verify JWT
    let token_data = jsonwebtoken::decode::<Claims>(
        token.as_ref().unwrap(),
        &jsonwebtoken::DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &jsonwebtoken::Validation::default(),
    );

    match token_data {
        Ok(data) => {
            let user_id = &data.claims.sub;
            let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = ?")
                .bind(user_id)
                .fetch_optional(db.pool())
                .await
                .map_err(|e| format!("Database error: {}", e))?;

            Ok(AuthCheckResponse {
                is_authenticated: user.is_some(),
                user: user.map(|u| UserInfo {
                    id: u.id,
                    username: u.username,
                    real_name: u.real_name,
                    role: u.role,
                    role_id: u.role_id,
                }),
            })
        }
        Err(_) => Ok(AuthCheckResponse {
            is_authenticated: false,
            user: None,
        }),
    }
}

#[tauri::command]
pub async fn register(
    input: RegisterInput,
    db: State<'_, Database>,
) -> Result<User, String> {
    log::info!("Registering new user: {}", input.username);

    // Check if username already exists
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE username = ?",
    )
    .bind(&input.username)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err("用户名已存在".to_string());
    }

    let password_hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Password hashing error: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, real_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.username)
    .bind(&password_hash)
    .bind(&input.real_name)
    .bind(input.role.as_deref().unwrap_or("user"))
    .bind(&now)
    .bind(&now)
    .execute(db.pool())
    .await
    .map_err(|e| format!("Failed to create user: {}", e))?;

    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .map_err(|e| format!("Failed to fetch created user: {}", e))?;

    log::info!("User registered successfully: {}", input.username);
    Ok(user)
}

#[tauri::command]
pub async fn get_current_user(
    db: State<'_, Database>,
) -> Result<Option<User>, String> {
    let user: Option<User> = sqlx::query_as(
        "SELECT * FROM users WHERE role = 'admin' LIMIT 1",
    )
    .fetch_optional(db.pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(user)
}
