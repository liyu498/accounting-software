use crate::commands::auth::authenticated_actor;
use crate::db::{secure_private_directory, secure_private_file, Database};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct PendingLocalRestore {
    pub backup_id: String,
    pub actor: String,
    pub scheduled_at: String,
    pub safety_backup_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupRestoreSchedule {
    pub backup_id: String,
    pub safety_backup_id: String,
    pub scheduled_at: String,
    pub restart_required: bool,
    pub message: String,
}

#[derive(Debug, Clone)]
pub(crate) struct AppliedLocalRestore {
    pub backup_id: String,
    pub actor: String,
    pub scheduled_at: String,
    pub safety_backup_id: String,
}

const PENDING_RESTORE_FILE: &str = "pending-restore.json";
const RESTORE_STAGING_FILE: &str = ".restore-staging.db";
const RESTORE_ORIGINAL_FILE: &str = ".restore-original.db";

fn backup_directory(db: &Database) -> Result<std::path::PathBuf, String> {
    backup_directory_for(&db.app_data_dir())
}

fn backup_directory_for(app_data_dir: &Path) -> Result<std::path::PathBuf, String> {
    let directory = app_data_dir.join("backups");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create backup directory: {error}"))?;
    secure_private_directory(&directory)
        .map_err(|error| format!("Unable to secure backup directory: {error}"))?;
    for entry in fs::read_dir(&directory)
        .map_err(|error| format!("Unable to inspect backup directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Unable to inspect backup entry: {error}"))?;
        if entry
            .file_type()
            .map_err(|error| format!("Unable to inspect backup entry type: {error}"))?
            .is_file()
        {
            secure_private_file(&entry.path())
                .map_err(|error| format!("Unable to secure backup file: {error}"))?;
        }
    }
    Ok(directory)
}

fn snapshot_from_path(path: &std::path::Path) -> Result<LocalBackupSnapshot, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Unable to read backup metadata: {error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Backup file name is invalid".to_string())?
        .to_string();
    let modified_at = metadata
        .modified()
        .map_err(|error| format!("Unable to read backup timestamp: {error}"))?;

    Ok(LocalBackupSnapshot {
        id: file_name.clone(),
        file_name,
        created_at: DateTime::<Utc>::from(modified_at).to_rfc3339(),
        size_bytes: metadata.len(),
    })
}

fn local_backup_path(db: &Database, backup_id: &str) -> Result<std::path::PathBuf, String> {
    local_backup_path_for(&db.app_data_dir(), backup_id)
}

fn local_backup_path_for(
    app_data_dir: &Path,
    backup_id: &str,
) -> Result<std::path::PathBuf, String> {
    let requested_path = Path::new(backup_id);
    let is_plain_file_name = requested_path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|file_name| file_name == backup_id);
    let is_database = requested_path
        .extension()
        .and_then(|extension| extension.to_str())
        == Some("db");
    if !is_plain_file_name || !is_database {
        return Err("Backup identifier is invalid".to_string());
    }

    let path = backup_directory_for(app_data_dir)?.join(backup_id);
    if !path.is_file() {
        return Err("Backup file does not exist".to_string());
    }
    Ok(path)
}

async fn verify_sqlite_snapshot(path: &Path) -> Result<(), String> {
    let mut file =
        fs::File::open(path).map_err(|error| format!("Unable to open backup file: {error}"))?;
    let mut header = [0_u8; 16];
    let bytes_read = file
        .read(&mut header)
        .map_err(|error| format!("Unable to read backup file: {error}"))?;
    if bytes_read != header.len() || header != *b"SQLite format 3\0" {
        return Err("文件不是有效的 SQLite 快照".to_string());
    }

    let options = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true)
        .create_if_missing(false);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|error| format!("Unable to open backup database: {error}"))?;
    let integrity: String = sqlx::query_scalar("PRAGMA quick_check")
        .fetch_one(&pool)
        .await
        .map_err(|error| format!("Unable to verify backup integrity: {error}"))?;
    pool.close().await;
    if integrity.trim().eq_ignore_ascii_case("ok") {
        Ok(())
    } else {
        Err(format!("SQLite 完整性校验失败: {integrity}"))
    }
}

async fn create_backup_snapshot(
    db: &Database,
    prefix: &str,
) -> Result<LocalBackupSnapshot, String> {
    let directory = backup_directory(db)?;
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S-%3f");
    let file_name = format!("{prefix}-{timestamp}.db");
    let target_path = directory.join(&file_name);
    let target_sql = target_path.to_string_lossy().replace('\'', "''");

    sqlx::query(&format!("VACUUM INTO '{target_sql}'"))
        .execute(db.pool())
        .await
        .map_err(|error| format!("Unable to create backup snapshot: {error}"))?;
    secure_private_file(&target_path)
        .map_err(|error| format!("Unable to secure backup snapshot: {error}"))?;

    snapshot_from_path(&target_path)
}

fn write_pending_restore(app_data_dir: &Path, pending: &PendingLocalRestore) -> Result<(), String> {
    let marker = app_data_dir.join(PENDING_RESTORE_FILE);
    if marker.exists() {
        return Err("已有待执行的恢复任务，请先重启应用完成恢复".to_string());
    }
    let temporary = app_data_dir.join(format!("{PENDING_RESTORE_FILE}.tmp"));
    let payload = serde_json::to_vec_pretty(pending)
        .map_err(|error| format!("Unable to serialize restore request: {error}"))?;
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("Unable to create restore request: {error}"))?;
    secure_private_file(&temporary)
        .map_err(|error| format!("Unable to secure restore request: {error}"))?;
    file.write_all(&payload)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Unable to persist restore request: {error}"))?;
    fs::rename(&temporary, &marker)
        .map_err(|error| format!("Unable to activate restore request: {error}"))
}

#[tauri::command]
pub async fn create_local_backup(db: State<'_, Database>) -> Result<LocalBackupSnapshot, String> {
    create_backup_snapshot(&db, "accounting").await
}

#[tauri::command]
pub async fn list_local_backups(
    db: State<'_, Database>,
) -> Result<Vec<LocalBackupSnapshot>, String> {
    let directory = backup_directory(&db)?;
    let mut snapshots = fs::read_dir(directory)
        .map_err(|error| format!("Unable to read backup directory: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            (path.is_file()
                && path.extension().and_then(|extension| extension.to_str()) == Some("db"))
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
    let verification = verify_sqlite_snapshot(&path).await;
    let valid = verification.is_ok();
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
            "SQLite 文件头与完整性校验通过；可进入受控恢复确认。".to_string()
        } else {
            format!(
                "快照校验失败，禁止恢复：{}",
                verification.expect_err("invalid verification has an error")
            )
        },
    })
}

#[tauri::command]
pub async fn schedule_local_backup_restore(
    backup_id: String,
    auth_token: String,
    db: State<'_, Database>,
) -> Result<LocalBackupRestoreSchedule, String> {
    let actor = authenticated_actor(db.pool(), &auth_token).await?;
    let backup_path = local_backup_path(&db, &backup_id)?;
    verify_sqlite_snapshot(&backup_path)
        .await
        .map_err(|error| format!("快照不满足恢复条件：{error}"))?;

    let safety_snapshot = create_backup_snapshot(&db, "pre-restore").await?;
    let scheduled_at = Utc::now().to_rfc3339();
    let pending = PendingLocalRestore {
        backup_id: backup_id.clone(),
        actor: actor.clone(),
        scheduled_at: scheduled_at.clone(),
        safety_backup_id: safety_snapshot.id.clone(),
    };
    write_pending_restore(&db.app_data_dir(), &pending)?;

    let audit_result = sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, NULL, '系统备份', '安排备份恢复', ?, 'critical', 'pending', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&backup_id)
    .bind(format!(
        "已生成恢复前安全快照 {}；目标快照将在下次启动、数据库连接建立前恢复",
        safety_snapshot.file_name
    ))
    .bind(&actor)
    .execute(db.pool())
    .await;
    if let Err(error) = audit_result {
        let _ = fs::remove_file(db.app_data_dir().join(PENDING_RESTORE_FILE));
        return Err(format!("Unable to record restore audit: {error}"));
    }

    Ok(LocalBackupRestoreSchedule {
        backup_id,
        safety_backup_id: safety_snapshot.id,
        scheduled_at,
        restart_required: true,
        message: "恢复任务已安排。请立即退出并重新打开应用；恢复将在数据库连接建立前执行。"
            .to_string(),
    })
}

pub(crate) async fn apply_pending_restore(
    app_data_dir: &Path,
) -> Result<Option<AppliedLocalRestore>, String> {
    let marker = app_data_dir.join(PENDING_RESTORE_FILE);
    if !marker.is_file() {
        return Ok(None);
    }
    let pending: PendingLocalRestore = serde_json::from_slice(
        &fs::read(&marker).map_err(|error| format!("Unable to read restore request: {error}"))?,
    )
    .map_err(|error| format!("Unable to parse restore request: {error}"))?;
    let source = local_backup_path_for(app_data_dir, &pending.backup_id)?;
    verify_sqlite_snapshot(&source)
        .await
        .map_err(|error| format!("Pending restore snapshot is invalid: {error}"))?;

    let current = app_data_dir.join("accounting.db");
    let staging = app_data_dir.join(RESTORE_STAGING_FILE);
    let original = app_data_dir.join(RESTORE_ORIGINAL_FILE);
    if !current.exists() && original.is_file() {
        fs::rename(&original, &current)
            .map_err(|error| format!("Unable to recover interrupted restore: {error}"))?;
    }
    let _ = fs::remove_file(&staging);
    fs::copy(&source, &staging)
        .map_err(|error| format!("Unable to stage restore snapshot: {error}"))?;
    secure_private_file(&staging)
        .map_err(|error| format!("Unable to secure staged restore snapshot: {error}"))?;
    OpenOptions::new()
        .write(true)
        .open(&staging)
        .and_then(|file| file.sync_all())
        .map_err(|error| format!("Unable to sync staged restore snapshot: {error}"))?;

    for suffix in ["-wal", "-shm", "-journal"] {
        let _ = fs::remove_file(app_data_dir.join(format!("accounting.db{suffix}")));
    }
    let _ = fs::remove_file(&original);
    if current.exists() {
        fs::rename(&current, &original)
            .map_err(|error| format!("Unable to preserve current database: {error}"))?;
    }
    if let Err(error) = fs::rename(&staging, &current) {
        if original.is_file() {
            let _ = fs::rename(&original, &current);
        }
        return Err(format!("Unable to activate restored database: {error}"));
    }
    let _ = fs::remove_file(&original);
    fs::remove_file(&marker)
        .map_err(|error| format!("Unable to complete restore request: {error}"))?;

    Ok(Some(AppliedLocalRestore {
        backup_id: pending.backup_id,
        actor: pending.actor,
        scheduled_at: pending.scheduled_at,
        safety_backup_id: pending.safety_backup_id,
    }))
}

pub(crate) async fn apply_pending_restore_safely(
    app_data_dir: &Path,
) -> (Option<AppliedLocalRestore>, Option<String>) {
    match apply_pending_restore(app_data_dir).await {
        Ok(applied) => (applied, None),
        Err(error) => {
            let marker = app_data_dir.join(PENDING_RESTORE_FILE);
            if marker.is_file() {
                let failed_name = format!(
                    "failed-restore-request-{}.json",
                    Utc::now().format("%Y%m%d-%H%M%S-%3f")
                );
                match backup_directory_for(app_data_dir).and_then(|directory| {
                    fs::rename(&marker, directory.join(failed_name))
                        .map_err(|rename_error| rename_error.to_string())
                }) {
                    Ok(()) => {}
                    Err(quarantine_error) => log::error!(
                        "Unable to quarantine failed restore request: {}",
                        quarantine_error
                    ),
                }
            }
            (None, Some(error))
        }
    }
}

pub(crate) async fn record_applied_restore(
    db: &Database,
    applied: &AppliedLocalRestore,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, NULL, '系统备份', '完成备份恢复', ?, 'critical', 'success', ?, ?)"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&applied.backup_id)
    .bind(format!(
        "已恢复目标快照；安排时间 {}；恢复前安全快照 {}",
        applied.scheduled_at, applied.safety_backup_id
    ))
    .bind(&applied.actor)
    .execute(db.pool())
    .await
    .map_err(|error| format!("Unable to record completed restore audit: {error}"))?;
    Ok(())
}

pub(crate) async fn record_restore_failure(db: &Database, error: &str) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO operation_audit_logs
           (id, company_id, module_name, action, object_ref, risk_level, result, detail, operator)
           VALUES (?, NULL, '系统备份', '备份恢复失败', NULL, 'critical', 'failed', ?, '系统启动')"#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(error)
    .execute(db.pool())
    .await
    .map_err(|audit_error| format!("Unable to record restore failure audit: {audit_error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        apply_pending_restore, apply_pending_restore_safely, record_applied_restore,
        schedule_local_backup_restore, verify_local_backup, PendingLocalRestore,
    };
    use crate::commands::{
        auth::{self, InitializeAdminInput, LoginRequest},
        companies,
    };
    use crate::db::{CreateCompanyInput, Database};
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    use tauri::Manager;

    #[cfg(unix)]
    #[test]
    fn backup_storage_repairs_existing_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let app_dir = std::env::temp_dir().join(format!(
            "accounting-backup-permissions-test-{}",
            uuid::Uuid::new_v4()
        ));
        let backup_dir = app_dir.join("backups");
        std::fs::create_dir_all(&backup_dir).expect("creates backup directory");
        let backup = backup_dir.join("legacy.db");
        std::fs::write(&backup, b"legacy").expect("creates legacy backup");
        std::fs::set_permissions(&backup_dir, std::fs::Permissions::from_mode(0o777))
            .expect("widens backup directory");
        std::fs::set_permissions(&backup, std::fs::Permissions::from_mode(0o666))
            .expect("widens backup file");

        super::backup_directory_for(&app_dir).expect("secures backup storage");

        assert_eq!(
            std::fs::metadata(&backup_dir)
                .expect("reads backup directory metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        assert_eq!(
            std::fs::metadata(&backup)
                .expect("reads backup metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );

        std::fs::remove_dir_all(app_dir).expect("removes backup test directory");
    }

    async fn create_database(path: &std::path::Path, value: &str) {
        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))
            .expect("builds sqlite options")
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("opens sqlite database");
        sqlx::query("CREATE TABLE restore_probe (value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .expect("creates restore probe");
        sqlx::query("INSERT INTO restore_probe (value) VALUES (?)")
            .bind(value)
            .execute(&pool)
            .await
            .expect("stores restore probe");
        pool.close().await;
    }

    #[tokio::test]
    async fn release_recovery_pending_restore_replaces_database_before_connections_open() {
        let app_dir = std::env::temp_dir().join(format!(
            "accounting-backup-restore-test-{}",
            uuid::Uuid::new_v4()
        ));
        let backup_dir = app_dir.join("backups");
        std::fs::create_dir_all(&backup_dir).expect("creates backup directory");
        create_database(&app_dir.join("accounting.db"), "current").await;
        create_database(&backup_dir.join("restore-point.db"), "restored").await;

        let pending = PendingLocalRestore {
            backup_id: "restore-point.db".to_string(),
            actor: "恢复管理员".to_string(),
            scheduled_at: "2026-10-27T10:00:00Z".to_string(),
            safety_backup_id: "pre-restore.db".to_string(),
        };
        std::fs::write(
            app_dir.join("pending-restore.json"),
            serde_json::to_vec(&pending).expect("serializes restore marker"),
        )
        .expect("writes restore marker");

        let applied = apply_pending_restore(&app_dir)
            .await
            .expect("applies pending restore")
            .expect("returns restore metadata");
        assert_eq!(applied.backup_id, "restore-point.db");
        assert_eq!(applied.actor, "恢复管理员");
        assert!(!app_dir.join("pending-restore.json").exists());

        let options = SqliteConnectOptions::from_str(&format!(
            "sqlite:{}",
            app_dir.join("accounting.db").display()
        ))
        .expect("builds restored sqlite options");
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("opens restored database");
        let value: String = sqlx::query_scalar("SELECT value FROM restore_probe")
            .fetch_one(&pool)
            .await
            .expect("reads restored content");
        assert_eq!(value, "restored");
        pool.close().await;

        std::fs::remove_dir_all(app_dir).expect("removes backup restore test directory");
    }

    #[tokio::test]
    async fn release_recovery_invalid_pending_restore_is_quarantined_without_replacing_current_database(
    ) {
        let app_dir = std::env::temp_dir().join(format!(
            "accounting-backup-restore-failure-test-{}",
            uuid::Uuid::new_v4()
        ));
        let backup_dir = app_dir.join("backups");
        std::fs::create_dir_all(&backup_dir).expect("creates backup directory");
        create_database(&app_dir.join("accounting.db"), "current").await;
        std::fs::write(backup_dir.join("broken.db"), b"not a sqlite database")
            .expect("writes invalid backup");
        let pending = PendingLocalRestore {
            backup_id: "broken.db".to_string(),
            actor: "恢复管理员".to_string(),
            scheduled_at: "2026-10-27T10:00:00Z".to_string(),
            safety_backup_id: "pre-restore.db".to_string(),
        };
        std::fs::write(
            app_dir.join("pending-restore.json"),
            serde_json::to_vec(&pending).expect("serializes restore marker"),
        )
        .expect("writes restore marker");

        let (applied, failure) = apply_pending_restore_safely(&app_dir).await;
        assert!(applied.is_none());
        assert!(failure
            .as_deref()
            .is_some_and(|message| message.contains("invalid")));
        assert!(!app_dir.join("pending-restore.json").exists());
        assert!(std::fs::read_dir(&backup_dir)
            .expect("reads backup directory")
            .filter_map(Result::ok)
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .starts_with("failed-restore-request-")));

        let options = SqliteConnectOptions::from_str(&format!(
            "sqlite:{}",
            app_dir.join("accounting.db").display()
        ))
        .expect("builds current sqlite options");
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("opens current database");
        let value: String = sqlx::query_scalar("SELECT value FROM restore_probe")
            .fetch_one(&pool)
            .await
            .expect("reads current content");
        assert_eq!(value, "current");
        pool.close().await;

        std::fs::remove_dir_all(app_dir).expect("removes failed restore test directory");
    }

    #[tokio::test]
    async fn release_recovery_cross_version_restore_upgrades_v14_to_v15_and_preserves_data() {
        let run_id = uuid::Uuid::new_v4();
        let app_dir = std::env::temp_dir().join(format!("accounting-release-recovery-{run_id}"));
        let legacy_dir =
            std::env::temp_dir().join(format!("accounting-release-recovery-v14-{run_id}"));

        let legacy = Database::new(legacy_dir.clone())
            .await
            .expect("initializes source database before v14 snapshot conversion");
        let legacy_app = tauri::test::mock_app();
        assert!(
            legacy_app.manage(legacy),
            "manages source database for company initialization"
        );
        let legacy_state = legacy_app.state::<Database>();
        let legacy_company = companies::create_company(
            CreateCompanyInput {
                code: "LEGACY".to_string(),
                name: "跨版本恢复账套".to_string(),
                tax_id: Some("91310000RECOVERY001".to_string()),
                tax_type: Some("small".to_string()),
                industry: Some("软件和信息技术服务业".to_string()),
                accounting_system: Some("small_enterprise".to_string()),
                province: Some("上海市".to_string()),
                city: Some("上海市".to_string()),
                district: Some("浦东新区".to_string()),
                enterprise_type: Some("有限责任公司".to_string()),
                service_start: Some("2026-01-01".to_string()),
                service_end: Some("2026-12-31".to_string()),
                enable_year: Some(2026),
                enable_month: Some(1),
            },
            legacy_state.clone(),
        )
        .await
        .expect("creates a complete legacy account set");
        sqlx::query("CREATE TABLE release_restore_probe (value TEXT NOT NULL)")
            .execute(legacy_state.pool())
            .await
            .expect("creates legacy restore probe");
        sqlx::query("INSERT INTO release_restore_probe (value) VALUES ('legacy-v14')")
            .execute(legacy_state.pool())
            .await
            .expect("stores legacy restore probe");
        sqlx::query("DROP TABLE inventory_bom_items")
            .execute(legacy_state.pool())
            .await
            .expect("removes v15 BOM items from legacy fixture");
        sqlx::query("DROP TABLE inventory_boms")
            .execute(legacy_state.pool())
            .await
            .expect("removes v15 BOMs from legacy fixture");
        sqlx::query("DELETE FROM schema_migrations WHERE version = 15")
            .execute(legacy_state.pool())
            .await
            .expect("marks fixture as schema v14");
        legacy_state.pool().close().await;
        drop(legacy_state);
        drop(legacy_app);

        let current = Database::new(app_dir.clone())
            .await
            .expect("initializes current v15 database");
        sqlx::query("CREATE TABLE release_restore_probe (value TEXT NOT NULL)")
            .execute(current.pool())
            .await
            .expect("creates current restore probe");
        sqlx::query("INSERT INTO release_restore_probe (value) VALUES ('current-v15')")
            .execute(current.pool())
            .await
            .expect("stores current restore probe");
        let backup_dir = app_dir.join("backups");
        std::fs::create_dir_all(&backup_dir).expect("creates release recovery backup directory");
        let backup_id = "legacy-v14.db";
        std::fs::copy(legacy_dir.join("accounting.db"), backup_dir.join(backup_id))
            .expect("copies v14 snapshot into backup storage");

        let app = tauri::test::mock_app();
        assert!(
            app.manage(current),
            "manages current database for restore commands"
        );
        let state = app.state::<Database>();
        let admin_password = format!("A1!{}", uuid::Uuid::new_v4());
        auth::initialize_admin(
            InitializeAdminInput {
                username: "recoveryadmin".to_string(),
                password: admin_password.clone(),
                real_name: "恢复验收员".to_string(),
            },
            state.clone(),
        )
        .await
        .expect("initializes recovery administrator");
        let login = auth::login(
            LoginRequest {
                username: "recoveryadmin".to_string(),
                password: admin_password,
            },
            state.clone(),
        )
        .await
        .expect("logs in recovery administrator");
        let token = login.token.expect("recovery login returns token");

        let verification = verify_local_backup(backup_id.to_string(), state.clone())
            .await
            .expect("verifies v14 backup snapshot");
        assert!(
            verification.valid,
            "v14 snapshot must pass SQLite verification"
        );
        let schedule = schedule_local_backup_restore(backup_id.to_string(), token, state.clone())
            .await
            .expect("schedules cross-version restore");
        assert!(schedule.restart_required);
        assert!(backup_dir.join(&schedule.safety_backup_id).is_file());

        state.pool().close().await;
        drop(state);
        drop(app);
        let applied = apply_pending_restore(&app_dir)
            .await
            .expect("applies scheduled v14 restore")
            .expect("returns applied restore metadata");
        assert_eq!(applied.backup_id, backup_id);
        assert_eq!(applied.safety_backup_id, schedule.safety_backup_id);

        let restored = Database::new(app_dir.clone())
            .await
            .expect("opens restored snapshot and migrates it to v15");
        let schema_version: i64 = sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
            .fetch_one(restored.pool())
            .await
            .expect("reads restored schema version");
        assert_eq!(schema_version, 15);
        let bom_tables: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('inventory_boms', 'inventory_bom_items')",
        )
        .fetch_one(restored.pool())
        .await
        .expect("checks v15 BOM tables");
        assert_eq!(bom_tables, 2);
        let restored_company: String =
            sqlx::query_scalar("SELECT name FROM companies WHERE id = ?")
                .bind(&legacy_company.id)
                .fetch_one(restored.pool())
                .await
                .expect("reads preserved legacy business data");
        assert_eq!(restored_company, "跨版本恢复账套");
        let restored_probe: String = sqlx::query_scalar("SELECT value FROM release_restore_probe")
            .fetch_one(restored.pool())
            .await
            .expect("reads restored v14 probe");
        assert_eq!(restored_probe, "legacy-v14");

        record_applied_restore(&restored, &applied)
            .await
            .expect("records completed restore audit");
        let restore_audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operation_audit_logs WHERE module_name = '系统备份' AND action = '完成备份恢复' AND result = 'success'",
        )
        .fetch_one(restored.pool())
        .await
        .expect("reads completed restore audit");
        assert_eq!(restore_audit_count, 1);

        let safety_options = SqliteConnectOptions::from_str(&format!(
            "sqlite:{}",
            backup_dir.join(&schedule.safety_backup_id).display()
        ))
        .expect("builds safety snapshot options")
        .read_only(true);
        let safety_pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(safety_options)
            .await
            .expect("opens pre-restore safety snapshot");
        let safety_probe: String = sqlx::query_scalar("SELECT value FROM release_restore_probe")
            .fetch_one(&safety_pool)
            .await
            .expect("reads pre-restore safety data");
        assert_eq!(safety_probe, "current-v15");
        safety_pool.close().await;

        restored.pool().close().await;
        std::fs::remove_dir_all(app_dir).expect("removes release recovery application data");
        std::fs::remove_dir_all(legacy_dir).expect("removes release recovery v14 fixture");
    }
}
