use crate::db::Database;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupSnapshot {
    pub id: String,
    pub file_name: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupVerification {
    pub id: String,
    pub file_name: String,
    pub valid: bool,
    pub message: String,
}

fn backup_directory(db: &Database) -> Result<std::path::PathBuf, String> {
    let directory = db.app_data_dir().join("backups");
    fs::create_dir_all(&directory).map_err(|error| format!("Unable to create backup directory: {error}"))?;
    Ok(directory)
}

fn snapshot_from_path(path: &std::path::Path) -> Result<LocalBackupSnapshot, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Unable to read backup metadata: {error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Backup file name is invalid".to_string())?
        .to_string();
    let modified_at = metadata.modified().map_err(|error| format!("Unable to read backup timestamp: {error}"))?;

    Ok(LocalBackupSnapshot {
        id: file_name.clone(),
        file_name,
        created_at: DateTime::<Utc>::from(modified_at).to_rfc3339(),
        size_bytes: metadata.len(),
    })
}

fn local_backup_path(db: &Database, backup_id: &str) -> Result<std::path::PathBuf, String> {
    let requested_path = Path::new(backup_id);
    let is_plain_file_name = requested_path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|file_name| file_name == backup_id);
    let is_database = requested_path.extension().and_then(|extension| extension.to_str()) == Some("db");
    if !is_plain_file_name || !is_database {
        return Err("Backup identifier is invalid".to_string());
    }

    let path = backup_directory(db)?.join(backup_id);
    if !path.is_file() {
        return Err("Backup file does not exist".to_string());
    }
    Ok(path)
}

#[tauri::command]
pub async fn create_local_backup(db: State<'_, Database>) -> Result<LocalBackupSnapshot, String> {
    let directory = backup_directory(&db)?;
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S-%3f");
    let file_name = format!("accounting-{timestamp}.db");
    let target_path = directory.join(&file_name);
    let target_sql = target_path.to_string_lossy().replace('\'', "''");

    // SQLite creates a transactionally consistent copy without pausing normal reads.
    sqlx::query(&format!("VACUUM INTO '{target_sql}'"))
        .execute(db.pool())
        .await
        .map_err(|error| format!("Unable to create backup snapshot: {error}"))?;

    snapshot_from_path(&target_path)
}

#[tauri::command]
pub async fn list_local_backups(db: State<'_, Database>) -> Result<Vec<LocalBackupSnapshot>, String> {
    let directory = backup_directory(&db)?;
    let mut snapshots = fs::read_dir(directory)
        .map_err(|error| format!("Unable to read backup directory: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            (path.is_file() && path.extension().and_then(|extension| extension.to_str()) == Some("db"))
                .then(|| snapshot_from_path(&path))
        })
        .collect::<Result<Vec<_>, _>>()?;

    snapshots.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(snapshots)
}

#[tauri::command]
pub async fn verify_local_backup(
    backup_id: String,
    db: State<'_, Database>,
) -> Result<LocalBackupVerification, String> {
    let path = local_backup_path(&db, &backup_id)?;
    let mut file = fs::File::open(&path).map_err(|error| format!("Unable to open backup file: {error}"))?;
    let mut header = [0_u8; 16];
    let bytes_read = file.read(&mut header).map_err(|error| format!("Unable to read backup file: {error}"))?;
    let valid = bytes_read == header.len() && header == *b"SQLite format 3\0";
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Backup file name is invalid".to_string())?
        .to_string();

    Ok(LocalBackupVerification {
        id: backup_id,
        file_name,
        valid,
        message: if valid {
            "SQLite 文件头校验通过；恢复仍需人工确认。".to_string()
        } else {
            "文件不是有效的 SQLite 快照，禁止恢复。".to_string()
        },
    })
}
