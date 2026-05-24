// Re-export from accounts module for backward compatibility
use crate::db::{AccountCode, CreateAccountCodeInput, Database};
use tauri::State;

#[tauri::command]
pub async fn get_subjects(
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    crate::commands::accounts::get_account_codes(company_id, db).await
}

#[tauri::command]
pub async fn get_subject(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Option<AccountCode>, String> {
    crate::commands::accounts::get_account_code(code, company_id, db).await
}

#[tauri::command]
pub async fn get_subjects_by_type(
    type_: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    crate::commands::accounts::get_account_codes_by_type(type_, company_id, db).await
}

#[tauri::command]
pub async fn create_subject(
    input: CreateAccountCodeInput,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    crate::commands::accounts::create_account_code(input, db).await
}

#[tauri::command]
pub async fn update_subject(
    code: String,
    company_id: String,
    input: CreateAccountCodeInput,
    db: State<'_, Database>,
) -> Result<AccountCode, String> {
    crate::commands::accounts::update_account_code(code, company_id, input, db).await
}

#[tauri::command]
pub async fn delete_subject(
    code: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    crate::commands::accounts::delete_account_code(code, company_id, db).await
}

#[tauri::command]
pub async fn search_subjects(
    keyword: String,
    company_id: String,
    db: State<'_, Database>,
) -> Result<Vec<AccountCode>, String> {
    crate::commands::accounts::search_account_codes(keyword, company_id, db).await
}
