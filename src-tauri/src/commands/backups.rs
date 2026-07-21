use crate::db::Database;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupSnapshot {
    pub id: String,
    pub file_name: String,
    pub created_at: String,
    pub size_bytes: u64,
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
