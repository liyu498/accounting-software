use sqlx::{Pool, Row, Sqlite, SqlitePool};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Business error: {0}")]
    Business(String),
}

pub type DbPool = Pool<Sqlite>;
const LATEST_SCHEMA_VERSION: i64 = 15;

#[cfg(unix)]
pub(crate) fn secure_private_directory(path: &Path) -> Result<(), std::io::Error> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
pub(crate) fn secure_private_directory(_path: &Path) -> Result<(), std::io::Error> {
    Ok(())
}

#[cfg(unix)]
pub(crate) fn secure_private_file(path: &Path) -> Result<(), std::io::Error> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
pub(crate) fn secure_private_file(_path: &Path) -> Result<(), std::io::Error> {
    Ok(())
}

struct SchemaMigration {
    version: i64,
    name: &'static str,
    checksum: &'static str,
    statements: &'static [&'static str],
}

const SCHEMA_MIGRATIONS: &[SchemaMigration] = &[
    SchemaMigration {
        version: 1,
        name: "legacy_schema_baseline",
        checksum: "baseline-v1",
        statements: &[],
    },
    SchemaMigration {
        version: 2,
        name: "source_backed_tax_deadlines",
        checksum: "tax-deadlines-v2",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS tax_deadline_rules (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                tax_type TEXT NOT NULL,
                filing_frequency TEXT NOT NULL CHECK (filing_frequency IN ('monthly', 'quarterly', 'annual', 'event')),
                due_month_offset INTEGER NOT NULL DEFAULT 1,
                due_day INTEGER NOT NULL,
                adjustment_policy TEXT NOT NULL DEFAULT 'next_workday' CHECK (adjustment_policy IN ('next_workday', 'none')),
                effective_from TEXT NOT NULL,
                effective_to TEXT,
                source_name TEXT NOT NULL,
                source_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, tax_type, filing_frequency, effective_from)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS tax_calendar_days (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                calendar_date TEXT NOT NULL,
                day_type TEXT NOT NULL CHECK (day_type IN ('holiday', 'workday')),
                reason TEXT NOT NULL,
                source_name TEXT NOT NULL,
                source_url TEXT,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, calendar_date)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_tax_deadline_rules_scope ON tax_deadline_rules(company_id, tax_type, effective_from, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_tax_calendar_days_scope ON tax_calendar_days(company_id, calendar_date)",
        ],
    },
    SchemaMigration {
        version: 3,
        name: "audited_ai_provider_adapter",
        checksum: "ai-provider-adapter-v3",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS ai_provider_configs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                provider_type TEXT NOT NULL DEFAULT 'generic_json' CHECK (provider_type IN ('generic_json')),
                endpoint TEXT NOT NULL,
                model TEXT NOT NULL,
                credential_env TEXT NOT NULL,
                timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (timeout_seconds BETWEEN 5 AND 120),
                max_file_bytes INTEGER NOT NULL DEFAULT 8388608 CHECK (max_file_bytes BETWEEN 1024 AND 20971520),
                is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (company_id, provider_name)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS ai_provider_runs (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                provider_config_id TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                model TEXT NOT NULL,
                source_file_name TEXT NOT NULL,
                source_checksum TEXT NOT NULL,
                request_fingerprint TEXT NOT NULL,
                response_checksum TEXT,
                response_payload TEXT,
                status TEXT NOT NULL CHECK (status IN ('running', 'pending_review', 'failed')),
                http_status INTEGER,
                confidence REAL,
                result_summary TEXT,
                error_message TEXT,
                executed_by TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (provider_config_id) REFERENCES ai_provider_configs(id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_scope ON ai_provider_configs(company_id, is_enabled, provider_name)",
            "CREATE INDEX IF NOT EXISTS idx_ai_provider_runs_job ON ai_provider_runs(company_id, job_id, created_at)",
        ],
    },
    SchemaMigration {
        version: 4,
        name: "verified_external_adapter_connections",
        checksum: "external-adapter-connections-v4",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS adapter_provider_configs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                credential_env TEXT NOT NULL,
                timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (timeout_seconds BETWEEN 5 AND 120),
                is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id) ON DELETE CASCADE,
                UNIQUE (authorization_id)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS adapter_provider_verifications (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                provider_config_id TEXT NOT NULL,
                request_fingerprint TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
                http_status INTEGER,
                response_checksum TEXT,
                external_reference TEXT,
                account_mask TEXT,
                capability_scope TEXT,
                expires_at TEXT,
                error_message TEXT,
                verified_by TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id) ON DELETE CASCADE,
                FOREIGN KEY (provider_config_id) REFERENCES adapter_provider_configs(id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_adapter_provider_configs_scope ON adapter_provider_configs(company_id, authorization_id, is_enabled)",
            "CREATE INDEX IF NOT EXISTS idx_adapter_provider_verifications_scope ON adapter_provider_verifications(company_id, authorization_id, created_at)",
        ],
    },
    SchemaMigration {
        version: 5,
        name: "audited_external_adapter_executions",
        checksum: "external-adapter-executions-v5",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS external_adapter_executions (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                provider_config_id TEXT NOT NULL,
                action_type TEXT NOT NULL CHECK (action_type IN ('tax_submit', 'tax_receipt_sync', 'tax_payment', 'invoice_pool_sync', 'bank_statement_sync')),
                object_type TEXT NOT NULL,
                object_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                source_fingerprint TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
                attempt_count INTEGER NOT NULL DEFAULT 1,
                http_status INTEGER,
                response_checksum TEXT,
                external_reference TEXT,
                receipt_no TEXT,
                response_message TEXT,
                error_message TEXT,
                executed_by TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id),
                FOREIGN KEY (provider_config_id) REFERENCES adapter_provider_configs(id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_external_adapter_executions_object ON external_adapter_executions(company_id, action_type, object_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_external_adapter_executions_status ON external_adapter_executions(company_id, status, created_at)",
        ],
    },
    SchemaMigration {
        version: 6,
        name: "reviewable_external_invoice_staging",
        checksum: "external-invoice-staging-v6",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS external_invoice_sync_batches (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                provider_config_id TEXT NOT NULL,
                period TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                source_cursor TEXT,
                next_cursor TEXT,
                status TEXT NOT NULL CHECK (status IN ('running', 'pending_review', 'completed', 'failed')),
                item_count INTEGER NOT NULL DEFAULT 0,
                duplicate_count INTEGER NOT NULL DEFAULT 0,
                response_checksum TEXT,
                error_message TEXT,
                executed_by TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id),
                FOREIGN KEY (provider_config_id) REFERENCES adapter_provider_configs(id)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS external_invoice_sync_items (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                external_invoice_id TEXT NOT NULL,
                invoice_type TEXT NOT NULL,
                invoice_code TEXT,
                invoice_no TEXT NOT NULL,
                invoice_date TEXT NOT NULL,
                seller_name TEXT,
                seller_tax_id TEXT,
                buyer_name TEXT,
                buyer_tax_id TEXT,
                amount REAL NOT NULL,
                tax_amount REAL NOT NULL,
                total_amount REAL NOT NULL,
                tax_rate REAL,
                currency TEXT NOT NULL DEFAULT 'CNY',
                review_status TEXT NOT NULL CHECK (review_status IN ('pending_review', 'duplicate', 'rejected', 'imported')),
                duplicate_invoice_id TEXT,
                payload_checksum TEXT NOT NULL,
                reviewed_by TEXT,
                reviewed_at TEXT,
                review_note TEXT,
                imported_invoice_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (batch_id) REFERENCES external_invoice_sync_batches(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id),
                FOREIGN KEY (duplicate_invoice_id) REFERENCES invoices(id),
                FOREIGN KEY (imported_invoice_id) REFERENCES invoices(id),
                UNIQUE (authorization_id, external_invoice_id)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS external_invoice_sync_item_lines (
                id TEXT PRIMARY KEY,
                staging_item_id TEXT NOT NULL,
                line_no INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                specification TEXT,
                unit TEXT,
                quantity REAL,
                unit_price REAL,
                amount REAL NOT NULL,
                tax_rate REAL,
                tax_amount REAL NOT NULL,
                tax_classification_code TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (staging_item_id) REFERENCES external_invoice_sync_items(id) ON DELETE CASCADE,
                UNIQUE (staging_item_id, line_no)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_external_invoice_sync_batches_scope ON external_invoice_sync_batches(company_id, period, status, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_external_invoice_sync_items_review ON external_invoice_sync_items(company_id, review_status, created_at)",
        ],
    },
    SchemaMigration {
        version: 7,
        name: "reviewable_external_bank_staging",
        checksum: "external-bank-staging-v7",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS external_bank_sync_batches (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                provider_config_id TEXT NOT NULL,
                period TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                source_cursor TEXT,
                next_cursor TEXT,
                status TEXT NOT NULL CHECK (status IN ('running', 'pending_review', 'completed', 'failed')),
                item_count INTEGER NOT NULL DEFAULT 0,
                duplicate_count INTEGER NOT NULL DEFAULT 0,
                response_checksum TEXT,
                error_message TEXT,
                executed_by TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id),
                FOREIGN KEY (provider_config_id) REFERENCES adapter_provider_configs(id)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS external_bank_sync_items (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                authorization_id TEXT NOT NULL,
                external_transaction_id TEXT NOT NULL,
                account_mask TEXT NOT NULL,
                transaction_date TEXT NOT NULL,
                value_date TEXT,
                direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'CNY',
                counterparty_name TEXT,
                counterparty_account_mask TEXT,
                bank_reference TEXT,
                summary TEXT,
                balance REAL,
                review_status TEXT NOT NULL CHECK (review_status IN ('pending_review', 'duplicate', 'rejected', 'imported')),
                duplicate_transaction_id TEXT,
                payload_checksum TEXT NOT NULL,
                reviewed_by TEXT,
                reviewed_at TEXT,
                review_note TEXT,
                imported_transaction_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (batch_id) REFERENCES external_bank_sync_batches(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (authorization_id) REFERENCES adapter_authorizations(id),
                FOREIGN KEY (duplicate_transaction_id) REFERENCES bank_transactions(id),
                FOREIGN KEY (imported_transaction_id) REFERENCES bank_transactions(id),
                UNIQUE (authorization_id, external_transaction_id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_external_bank_sync_batches_scope ON external_bank_sync_batches(company_id, period, status, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_external_bank_sync_items_review ON external_bank_sync_items(company_id, review_status, created_at)",
        ],
    },
    SchemaMigration {
        version: 8,
        name: "audited_inventory_valuation",
        checksum: "audited-inventory-valuation-v8",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS inventory_items (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                item_code TEXT NOT NULL,
                item_name TEXT NOT NULL,
                specification TEXT,
                unit TEXT NOT NULL,
                tax_rate REAL,
                default_subject TEXT,
                status TEXT NOT NULL DEFAULT '启用',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, item_code)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS inventory_movements (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                movement_date TEXT NOT NULL,
                bill_no TEXT NOT NULL,
                movement_type TEXT NOT NULL,
                inventory_name TEXT NOT NULL,
                warehouse TEXT NOT NULL,
                counterparty TEXT,
                unit TEXT NOT NULL,
                quantity REAL NOT NULL,
                amount REAL NOT NULL,
                source_document TEXT,
                status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, bill_no)
            )"#,
            "ALTER TABLE inventory_items ADD COLUMN category TEXT",
            "ALTER TABLE inventory_items ADD COLUMN valuation_method TEXT NOT NULL DEFAULT '移动加权' CHECK (valuation_method IN ('移动加权'))",
            "ALTER TABLE inventory_items ADD COLUMN inventory_subject TEXT NOT NULL DEFAULT '库存商品'",
            "ALTER TABLE inventory_items ADD COLUMN cost_subject TEXT NOT NULL DEFAULT '主营业务成本'",
            "ALTER TABLE inventory_items ADD COLUMN safety_stock REAL NOT NULL DEFAULT 0 CHECK (safety_stock >= 0)",
            "ALTER TABLE inventory_movements ADD COLUMN inventory_item_id TEXT REFERENCES inventory_items(id)",
            "ALTER TABLE inventory_movements ADD COLUMN direction TEXT CHECK (direction IN ('inbound', 'outbound'))",
            "ALTER TABLE inventory_movements ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0)",
            "ALTER TABLE inventory_movements ADD COLUMN confirmed_at TEXT",
            "CREATE INDEX IF NOT EXISTS idx_inventory_movements_valuation ON inventory_movements(company_id, inventory_item_id, warehouse, movement_date, status)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_items_company_status ON inventory_items(company_id, status, item_code)",
        ],
    },
    SchemaMigration {
        version: 9,
        name: "structured_inventory_master_data",
        checksum: "structured-inventory-master-data-v9",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS inventory_categories (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                category_code TEXT NOT NULL,
                category_name TEXT NOT NULL,
                inventory_subject TEXT NOT NULL DEFAULT '库存商品',
                cost_subject TEXT NOT NULL DEFAULT '主营业务成本',
                status TEXT NOT NULL DEFAULT '启用' CHECK (status IN ('启用', '停用')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (company_id, category_code),
                UNIQUE (company_id, category_name)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS inventory_warehouses (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                warehouse_code TEXT NOT NULL,
                warehouse_name TEXT NOT NULL,
                location TEXT,
                manager TEXT,
                status TEXT NOT NULL DEFAULT '启用' CHECK (status IN ('启用', '停用')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (company_id, warehouse_code),
                UNIQUE (company_id, warehouse_name)
            )"#,
            "ALTER TABLE inventory_items ADD COLUMN category_id TEXT REFERENCES inventory_categories(id)",
            "ALTER TABLE inventory_movements ADD COLUMN warehouse_id TEXT REFERENCES inventory_warehouses(id)",
            r#"INSERT INTO inventory_categories (id, company_id, category_code, category_name, inventory_subject, cost_subject)
               SELECT 'legacy-category-' || lower(hex(randomblob(16))), company_id, category, category,
                      MAX(inventory_subject), MAX(cost_subject)
               FROM inventory_items
               WHERE category IS NOT NULL AND TRIM(category) != ''
               GROUP BY company_id, category"#,
            r#"UPDATE inventory_items
               SET category_id = (
                   SELECT c.id FROM inventory_categories c
                   WHERE c.company_id = inventory_items.company_id
                     AND c.category_name = inventory_items.category
               )
               WHERE category IS NOT NULL AND TRIM(category) != ''"#,
            r#"INSERT INTO inventory_warehouses (id, company_id, warehouse_code, warehouse_name)
               SELECT 'legacy-warehouse-' || lower(hex(randomblob(16))), company_id, warehouse, warehouse
               FROM inventory_movements
               WHERE TRIM(warehouse) != ''
               GROUP BY company_id, warehouse"#,
            r#"UPDATE inventory_movements
               SET warehouse_id = (
                   SELECT w.id FROM inventory_warehouses w
                   WHERE w.company_id = inventory_movements.company_id
                     AND w.warehouse_name = inventory_movements.warehouse
               )
               WHERE TRIM(warehouse) != ''"#,
            "CREATE INDEX IF NOT EXISTS idx_inventory_categories_scope ON inventory_categories(company_id, status, category_code)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_scope ON inventory_warehouses(company_id, status, warehouse_code)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(company_id, category_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(company_id, warehouse_id, period, status)",
        ],
    },
    SchemaMigration {
        version: 10,
        name: "audited_inventory_opening_balances",
        checksum: "audited-inventory-opening-balances-v10",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS accounting_periods (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_year INTEGER NOT NULL,
                period_month INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                closed_at TEXT,
                closed_by TEXT,
                initial_balances_finalized_at TEXT,
                initial_balances_finalized_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period_year, period_month)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS inventory_opening_balances (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_id TEXT NOT NULL,
                period TEXT NOT NULL,
                inventory_item_id TEXT NOT NULL,
                warehouse_id TEXT NOT NULL,
                item_code TEXT NOT NULL,
                item_name TEXT NOT NULL,
                warehouse_name TEXT NOT NULL,
                unit TEXT NOT NULL,
                inventory_subject TEXT NOT NULL,
                quantity REAL NOT NULL CHECK (quantity > 0),
                amount REAL NOT NULL CHECK (amount > 0),
                status TEXT NOT NULL DEFAULT '草稿' CHECK (status IN ('草稿', '已确认')),
                movement_id TEXT,
                confirmed_at TEXT,
                confirmed_by TEXT,
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id) ON DELETE CASCADE,
                FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
                FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
                FOREIGN KEY (movement_id) REFERENCES inventory_movements(id),
                UNIQUE (company_id, period_id, inventory_item_id, warehouse_id)
            )"#,
            "ALTER TABLE accounting_periods ADD COLUMN inventory_opening_finalized_at TEXT",
            "ALTER TABLE accounting_periods ADD COLUMN inventory_opening_finalized_by TEXT",
            "CREATE INDEX IF NOT EXISTS idx_inventory_opening_scope ON inventory_opening_balances(company_id, period_id, status, item_code)",
        ],
    },
    SchemaMigration {
        version: 11,
        name: "audited_inventory_stocktakes",
        checksum: "audited-inventory-stocktakes-v11",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS inventory_stocktakes (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_id TEXT NOT NULL,
                period TEXT NOT NULL,
                stocktake_no TEXT NOT NULL,
                stocktake_date TEXT NOT NULL,
                warehouse_id TEXT NOT NULL,
                warehouse_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '草稿' CHECK (status IN ('草稿', '已确认', '已作废')),
                note TEXT,
                source_movement_max_rowid INTEGER NOT NULL DEFAULT 0,
                voucher_id TEXT,
                confirmed_at TEXT,
                confirmed_by TEXT,
                voided_at TEXT,
                voided_by TEXT,
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id),
                FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, stocktake_no)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS inventory_stocktake_lines (
                id TEXT PRIMARY KEY,
                stocktake_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                inventory_item_id TEXT NOT NULL,
                item_code TEXT NOT NULL,
                item_name TEXT NOT NULL,
                unit TEXT NOT NULL,
                inventory_subject TEXT NOT NULL,
                book_quantity REAL NOT NULL DEFAULT 0,
                book_amount REAL NOT NULL DEFAULT 0,
                book_unit_cost REAL NOT NULL DEFAULT 0,
                actual_quantity REAL CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
                actual_unit_cost REAL CHECK (actual_unit_cost IS NULL OR actual_unit_cost >= 0),
                variance_quantity REAL NOT NULL DEFAULT 0,
                variance_amount REAL NOT NULL DEFAULT 0,
                reason TEXT,
                movement_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (stocktake_id) REFERENCES inventory_stocktakes(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
                FOREIGN KEY (movement_id) REFERENCES inventory_movements(id),
                UNIQUE (stocktake_id, inventory_item_id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_inventory_stocktakes_scope ON inventory_stocktakes(company_id, period_id, warehouse_id, status, stocktake_date)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_stocktake_lines_scope ON inventory_stocktake_lines(company_id, stocktake_id, item_code)",
        ],
    },
    SchemaMigration {
        version: 12,
        name: "structured_inventory_measurement_units",
        checksum: "structured-inventory-measurement-units-v12",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS measurement_units (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                unit_name TEXT NOT NULL,
                unit_group TEXT,
                base_unit TEXT,
                conversion_rate REAL NOT NULL DEFAULT 1,
                precision_digits INTEGER NOT NULL DEFAULT 2,
                remark TEXT,
                status TEXT NOT NULL DEFAULT '启用',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (company_id, unit_name)
            )"#,
            r#"INSERT INTO measurement_units (id, company_id, unit_name, conversion_rate, precision_digits, remark)
               SELECT 'legacy-unit-' || lower(hex(randomblob(16))), company_id, TRIM(unit), 1, 2, '存货档案迁移生成'
               FROM inventory_items
               WHERE TRIM(unit) != ''
                 AND NOT EXISTS (
                   SELECT 1 FROM measurement_units m
                   WHERE m.company_id = inventory_items.company_id
                     AND m.unit_name = TRIM(inventory_items.unit)
                 )
               GROUP BY company_id, TRIM(unit)"#,
            "ALTER TABLE inventory_items ADD COLUMN unit_id TEXT REFERENCES measurement_units(id)",
            r#"UPDATE inventory_items
               SET unit_id = (
                   SELECT m.id FROM measurement_units m
                   WHERE m.company_id = inventory_items.company_id
                     AND m.unit_name = TRIM(inventory_items.unit)
                   LIMIT 1
               )
               WHERE unit_id IS NULL"#,
            "CREATE INDEX IF NOT EXISTS idx_inventory_items_unit ON inventory_items(company_id, unit_id, status)",
        ],
    },
    SchemaMigration {
        version: 13,
        name: "structured_fixed_asset_categories",
        checksum: "structured-fixed-asset-categories-v13",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS asset_categories (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
                useful_life_months INTEGER NOT NULL, residual_rate REAL NOT NULL DEFAULT 0,
                depreciation_method TEXT NOT NULL DEFAULT '平均年限法', asset_account TEXT NOT NULL,
                accumulated_depreciation_account TEXT NOT NULL, expense_account TEXT,
                is_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, code)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS fixed_assets (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, asset_code TEXT NOT NULL,
                asset_name TEXT NOT NULL, category TEXT NOT NULL, start_date TEXT NOT NULL, original_value REAL NOT NULL,
                useful_life_months INTEGER NOT NULL, residual_rate REAL NOT NULL DEFAULT 0, source_document TEXT,
                status TEXT NOT NULL DEFAULT '待计提', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, asset_code)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS depreciation_batches (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL,
                asset_count INTEGER NOT NULL DEFAULT 0, depreciation_amount REAL NOT NULL DEFAULT 0,
                voucher_id TEXT, voucher_number TEXT, status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id), FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, period)
            )"#,
            r#"INSERT INTO asset_categories (
                   id, company_id, code, name, useful_life_months, residual_rate,
                   depreciation_method, asset_account,
                   accumulated_depreciation_account, expense_account, is_enabled
               )
               SELECT 'legacy-asset-category-' || lower(hex(randomblob(16))),
                      fixed_assets.company_id,
                      'LEG-' || substr(lower(hex(randomblob(16))), 1, 10),
                      TRIM(fixed_assets.category),
                      MAX(fixed_assets.useful_life_months),
                      MAX(fixed_assets.residual_rate),
                      '平均年限法', '1601', '1602', '6602', 1
               FROM fixed_assets
               WHERE TRIM(fixed_assets.category) != ''
                 AND NOT EXISTS (
                   SELECT 1 FROM asset_categories category
                   WHERE category.company_id = fixed_assets.company_id
                     AND category.name = TRIM(fixed_assets.category)
                 )
               GROUP BY fixed_assets.company_id, TRIM(fixed_assets.category)"#,
            "ALTER TABLE fixed_assets ADD COLUMN category_id TEXT REFERENCES asset_categories(id)",
            "ALTER TABLE fixed_assets ADD COLUMN depreciation_method TEXT",
            "ALTER TABLE fixed_assets ADD COLUMN asset_account TEXT",
            "ALTER TABLE fixed_assets ADD COLUMN accumulated_depreciation_account TEXT",
            "ALTER TABLE fixed_assets ADD COLUMN expense_account TEXT",
            r#"UPDATE fixed_assets
               SET category_id = (
                       SELECT category.id FROM asset_categories category
                       WHERE category.company_id = fixed_assets.company_id
                         AND category.name = TRIM(fixed_assets.category)
                       ORDER BY category.created_at, category.id
                       LIMIT 1
                   )
               WHERE category_id IS NULL"#,
            r#"UPDATE fixed_assets
               SET depreciation_method = COALESCE(depreciation_method, (
                       SELECT category.depreciation_method FROM asset_categories category
                       WHERE category.id = fixed_assets.category_id
                   ), '平均年限法'),
                   asset_account = COALESCE(asset_account, (
                       SELECT category.asset_account FROM asset_categories category
                       WHERE category.id = fixed_assets.category_id
                   ), '1601'),
                   accumulated_depreciation_account = COALESCE(accumulated_depreciation_account, (
                       SELECT category.accumulated_depreciation_account FROM asset_categories category
                       WHERE category.id = fixed_assets.category_id
                   ), '1602'),
                   expense_account = COALESCE(expense_account, (
                       SELECT category.expense_account FROM asset_categories category
                       WHERE category.id = fixed_assets.category_id
                   ), '6602')"#,
            "CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(company_id, category_id, status)",
        ],
    },
    SchemaMigration {
        version: 14,
        name: "fixed_asset_depreciation_lines",
        checksum: "fixed-asset-depreciation-lines-v14",
        statements: &[
            "ALTER TABLE fixed_assets ADD COLUMN opening_accumulated_depreciation REAL NOT NULL DEFAULT 0 CHECK (opening_accumulated_depreciation >= 0)",
            "ALTER TABLE fixed_assets ADD COLUMN opening_depreciation_months INTEGER NOT NULL DEFAULT 0 CHECK (opening_depreciation_months >= 0)",
            r#"CREATE TABLE IF NOT EXISTS fixed_asset_depreciation_lines (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                asset_id TEXT NOT NULL,
                asset_code TEXT NOT NULL,
                asset_name TEXT NOT NULL,
                category TEXT NOT NULL,
                depreciation_method TEXT NOT NULL,
                expense_account TEXT NOT NULL,
                accumulated_depreciation_account TEXT NOT NULL,
                depreciable_amount REAL NOT NULL CHECK (depreciable_amount >= 0),
                months_depreciated INTEGER NOT NULL CHECK (months_depreciated >= 0),
                opening_accumulated_depreciation REAL NOT NULL CHECK (opening_accumulated_depreciation >= 0),
                depreciation_amount REAL NOT NULL CHECK (depreciation_amount > 0),
                closing_accumulated_depreciation REAL NOT NULL CHECK (closing_accumulated_depreciation >= 0),
                closing_net_value REAL NOT NULL CHECK (closing_net_value >= 0),
                voucher_id TEXT,
                status TEXT NOT NULL DEFAULT '待复核' CHECK (status IN ('待复核', '已生成凭证')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (batch_id) REFERENCES depreciation_batches(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (asset_id) REFERENCES fixed_assets(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, period, asset_id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_fixed_asset_depreciation_lines_batch ON fixed_asset_depreciation_lines(company_id, period, batch_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_fixed_asset_depreciation_lines_asset ON fixed_asset_depreciation_lines(company_id, asset_id, period)",
        ],
    },
    SchemaMigration {
        version: 15,
        name: "versioned_inventory_boms",
        checksum: "versioned-inventory-boms-v15",
        statements: &[
            r#"CREATE TABLE IF NOT EXISTS inventory_boms (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                bom_code TEXT NOT NULL,
                bom_name TEXT NOT NULL,
                version TEXT NOT NULL,
                parent_item_id TEXT NOT NULL,
                effective_date TEXT NOT NULL,
                expiration_date TEXT,
                status TEXT NOT NULL DEFAULT '启用' CHECK (status IN ('启用', '停用')),
                note TEXT,
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_item_id) REFERENCES inventory_items(id),
                UNIQUE (company_id, bom_code),
                UNIQUE (company_id, parent_item_id, version)
            )"#,
            r#"CREATE TABLE IF NOT EXISTS inventory_bom_items (
                id TEXT PRIMARY KEY,
                bom_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                component_item_id TEXT NOT NULL,
                quantity REAL NOT NULL CHECK (quantity > 0),
                loss_rate REAL NOT NULL DEFAULT 0 CHECK (loss_rate >= 0 AND loss_rate < 1),
                sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order > 0),
                note TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (bom_id) REFERENCES inventory_boms(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (component_item_id) REFERENCES inventory_items(id),
                UNIQUE (bom_id, component_item_id)
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_inventory_boms_scope ON inventory_boms(company_id, status, parent_item_id, version)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_bom_items_scope ON inventory_bom_items(company_id, bom_id, sort_order)",
        ],
    },
];
type AccountCodeSeed = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i32,
    Option<&'static str>,
    i32,
);
type BalanceSheetSeed = (
    &'static str,
    &'static str,
    Option<&'static str>,
    i32,
    i32,
    i32,
    Option<&'static str>,
);
type StatementSeed = (
    &'static str,
    &'static str,
    i32,
    i32,
    i32,
    Option<&'static str>,
);
type StandardReportItemSeed = (
    &'static str,
    &'static str,
    i32,
    i32,
    i32,
    Option<&'static str>,
    Option<&'static str>,
);

fn default_report_calculation_sign(report_type: &str, item_name: &str) -> i32 {
    const INCOME_ANALYTICAL_ITEMS: &[&str] = &[
        "营业税",
        "城市维护建设税",
        "资源税",
        "土地增值税",
        "城镇土地使用税、房产税、车船税、印花税",
        "教育费附加、矿产资源补偿费、排污费",
        "广告费和业务宣传费",
        "业务招待费",
        "研究费用",
        "无法收回的长期债券投资损失",
        "无法收回的长期股权投资损失",
        "自然灾害等不可抗力因素造成的损失",
        "税收滞纳金",
    ];
    const INCOME_DEDUCTION_ITEMS: &[&str] = &["剩余盈余分配", "转为成员出资"];
    match report_type {
        "income_statement"
            if item_name.trim_start().starts_with("其中：")
                || item_name.trim_start().starts_with('（')
                || INCOME_ANALYTICAL_ITEMS.contains(&item_name.trim())
                || item_name
                    .trim_start()
                    .chars()
                    .next()
                    .is_some_and(|ch| ch.is_ascii_digit()) =>
        {
            0
        }
        "income_statement"
            if item_name.trim_start().starts_with("减")
                || INCOME_DEDUCTION_ITEMS.contains(&item_name.trim())
                || ["成本", "费用", "支出", "税金及附加", "减值损失"]
                    .iter()
                    .any(|keyword| item_name.contains(keyword)) =>
        {
            -1
        }
        "cash_flow"
            if ["支付", "流出", "支出"]
                .iter()
                .any(|keyword| item_name.contains(keyword)) =>
        {
            -1
        }
        _ => 1,
    }
}

#[derive(Clone)]
pub struct Database {
    pool: Arc<DbPool>,
    app_data_dir: Arc<PathBuf>,
}

impl Database {
    pub async fn new(app_data_dir: PathBuf) -> Result<Self, DbError> {
        std::fs::create_dir_all(&app_data_dir)?;
        secure_private_directory(&app_data_dir)?;
        let db_path = app_data_dir.join("accounting.db");
        let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

        log::info!("Initializing database at: {}", db_path.display());

        let pool = SqlitePool::connect(&database_url).await?;
        secure_private_file(&db_path)?;

        // Enable foreign keys for SQLite
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await?;

        Self::run_migrations(&pool).await?;

        Ok(Self {
            pool: Arc::new(pool),
            app_data_dir: Arc::new(app_data_dir),
        })
    }

    pub fn pool(&self) -> &DbPool {
        &self.pool
    }

    pub fn app_data_dir(&self) -> PathBuf {
        self.app_data_dir.as_ref().clone()
    }

    async fn apply_versioned_migration(
        pool: &DbPool,
        migration: &SchemaMigration,
    ) -> Result<(), DbError> {
        let mut transaction = pool.begin().await?;
        for statement in migration.statements {
            sqlx::query(statement).execute(&mut *transaction).await?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)")
            .bind(migration.version)
            .bind(migration.name)
            .bind(migration.checksum)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    async fn run_versioned_migrations(pool: &DbPool) -> Result<(), DbError> {
        sqlx::query(
            r#"CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"#,
        )
        .execute(pool)
        .await?;

        let applied: Vec<(i64, String, String)> = sqlx::query_as(
            "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
        )
        .fetch_all(pool)
        .await?;
        if applied
            .last()
            .is_some_and(|(version, _, _)| *version > LATEST_SCHEMA_VERSION)
        {
            return Err(DbError::Business(
                "数据库版本高于当前应用，禁止使用旧版本程序打开".to_string(),
            ));
        }

        for (version, name, checksum) in &applied {
            let expected = SCHEMA_MIGRATIONS
                .iter()
                .find(|migration| migration.version == *version)
                .ok_or_else(|| DbError::Business(format!("数据库包含未知迁移版本 {version}")))?;
            if expected.name != name || expected.checksum != checksum {
                return Err(DbError::Business(format!(
                    "数据库迁移版本 {version} 的名称或校验值不匹配"
                )));
            }
        }

        for migration in SCHEMA_MIGRATIONS {
            if applied
                .iter()
                .any(|(version, _, _)| *version == migration.version)
            {
                continue;
            }
            Self::apply_versioned_migration(pool, migration).await?;
        }

        let current_version: i64 =
            sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")
                .fetch_one(pool)
                .await?;
        if current_version != LATEST_SCHEMA_VERSION {
            return Err(DbError::Business(format!(
                "数据库迁移未达到目标版本：当前 {current_version}，目标 {LATEST_SCHEMA_VERSION}"
            )));
        }
        Ok(())
    }

    async fn run_migrations(pool: &DbPool) -> Result<(), DbError> {
        log::info!("Running database migrations...");

        // === Core tables ===

        // Users
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                real_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Current-account-set todo ledger. This deliberately stays separate from agency-wide collaboration.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS company_todos (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT,
                title TEXT NOT NULL,
                source_module TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'normal',
                owner TEXT,
                due_date TEXT,
                related_entry TEXT,
                evidence TEXT,
                note TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                completed_at TEXT,
                completed_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Invoice, bank bill, cash-flow, and AI training rules share one company-scoped rule registry.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS matching_rules (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                rule_scope TEXT NOT NULL,
                name TEXT NOT NULL,
                condition_text TEXT NOT NULL,
                action_text TEXT NOT NULL,
                target_account_code TEXT,
                voucher_template_id TEXT,
                source_account_code TEXT,
                cash_direction TEXT,
                cash_flow_item_code TEXT,
                summary_keyword TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                hit_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        for statement in [
            "ALTER TABLE matching_rules ADD COLUMN source_account_code TEXT",
            "ALTER TABLE matching_rules ADD COLUMN cash_direction TEXT",
            "ALTER TABLE matching_rules ADD COLUMN cash_flow_item_code TEXT",
            "ALTER TABLE matching_rules ADD COLUMN summary_keyword TEXT",
        ] {
            sqlx::query(statement).execute(pool).await.ok();
        }

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS account_transfers (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, transfer_date TEXT NOT NULL,
                from_account TEXT NOT NULL, to_account TEXT NOT NULL, amount REAL NOT NULL, fee REAL NOT NULL DEFAULT 0,
                serial_no TEXT, voucher_id TEXT, voucher_number TEXT, status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id), FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"CREATE TABLE IF NOT EXISTS measurement_units (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, unit_name TEXT NOT NULL, unit_group TEXT, base_unit TEXT, conversion_rate REAL NOT NULL DEFAULT 1, precision_digits INTEGER NOT NULL DEFAULT 2, remark TEXT, status TEXT NOT NULL DEFAULT '启用', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id, unit_name))"#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS fixed_assets (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, asset_code TEXT NOT NULL,
                asset_name TEXT NOT NULL, category TEXT NOT NULL, start_date TEXT NOT NULL, original_value REAL NOT NULL,
                useful_life_months INTEGER NOT NULL, residual_rate REAL NOT NULL DEFAULT 0, source_document TEXT,
                status TEXT NOT NULL DEFAULT '待计提', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, asset_code)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS depreciation_batches (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL,
                asset_count INTEGER NOT NULL DEFAULT 0, depreciation_amount REAL NOT NULL DEFAULT 0,
                voucher_id TEXT, voucher_number TEXT, status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id), FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, period)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS asset_categories (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
                useful_life_months INTEGER NOT NULL, residual_rate REAL NOT NULL DEFAULT 0,
                depreciation_method TEXT NOT NULL DEFAULT '平均年限法', asset_account TEXT NOT NULL,
                accumulated_depreciation_account TEXT NOT NULL, expense_account TEXT,
                is_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, code)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS business_tags (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, applicable_modules TEXT NOT NULL,
                color_name TEXT NOT NULL DEFAULT '蓝色', auto_rule TEXT, usage_count INTEGER NOT NULL DEFAULT 0,
                remarks TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, name)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS invoice_tags (
                invoice_id TEXT NOT NULL, tag_id TEXT NOT NULL, company_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (invoice_id, tag_id), FOREIGN KEY (invoice_id) REFERENCES invoices(id),
                FOREIGN KEY (tag_id) REFERENCES business_tags(id), FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS voucher_tags (
                voucher_id TEXT NOT NULL, tag_id TEXT NOT NULL, company_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (voucher_id, tag_id), FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                FOREIGN KEY (tag_id) REFERENCES business_tags(id), FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS company_accounts (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, account_name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT '银行账户', bank_name TEXT, account_number TEXT NOT NULL,
                subject_code TEXT NOT NULL, opening_balance REAL NOT NULL DEFAULT 0, attachment_note TEXT,
                status TEXT NOT NULL DEFAULT '启用', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, account_number)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, movement_date TEXT NOT NULL,
                bill_no TEXT NOT NULL, movement_type TEXT NOT NULL, inventory_name TEXT NOT NULL, warehouse TEXT NOT NULL,
                counterparty TEXT, unit TEXT NOT NULL, quantity REAL NOT NULL, amount REAL NOT NULL, source_document TEXT,
                status TEXT NOT NULL DEFAULT '待确认', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, bill_no)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS inventory_items (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, item_code TEXT NOT NULL, item_name TEXT NOT NULL,
                specification TEXT, unit TEXT NOT NULL, tax_rate REAL, default_subject TEXT, status TEXT NOT NULL DEFAULT '启用',
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id), UNIQUE (company_id, item_code)
            )
        "#).execute(pool).await?;

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS social_security_records (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, employee_id TEXT NOT NULL, period TEXT NOT NULL,
                city TEXT, contribution_base REAL NOT NULL DEFAULT 0, company_amount REAL NOT NULL DEFAULT 0,
                personal_amount REAL NOT NULL DEFAULT 0, fund_amount REAL NOT NULL DEFAULT 0,
                voucher_id TEXT, voucher_number TEXT,
                status TEXT NOT NULL DEFAULT '待确认', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id), UNIQUE (company_id, employee_id, period)
            )
        "#).execute(pool).await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS special_deduction_records (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                employee_id TEXT NOT NULL,
                deduction_type TEXT NOT NULL,
                start_month TEXT NOT NULL,
                end_month TEXT,
                monthly_amount REAL NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT '手工',
                status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id),
                UNIQUE (company_id, employee_id, deduction_type, start_month)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS bank_transactions (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                account_name TEXT NOT NULL,
                serial_no TEXT NOT NULL,
                transaction_date TEXT NOT NULL,
                counterparty TEXT,
                summary TEXT,
                income_amount REAL NOT NULL DEFAULT 0,
                expense_amount REAL NOT NULL DEFAULT 0,
                balance REAL,
                receipt_status TEXT NOT NULL DEFAULT '待上传',
                match_result TEXT,
                voucher_id TEXT,
                voucher_number TEXT,
                status TEXT NOT NULL DEFAULT '待处理',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, serial_no)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS bank_transaction_tags (
                bank_transaction_id TEXT NOT NULL, tag_id TEXT NOT NULL, company_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (bank_transaction_id, tag_id), FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id),
                FOREIGN KEY (tag_id) REFERENCES business_tags(id), FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS document_records (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                business_date TEXT NOT NULL,
                document_code TEXT NOT NULL,
                business_type TEXT NOT NULL,
                partner TEXT,
                amount REAL NOT NULL DEFAULT 0,
                owner TEXT,
                attachment_status TEXT NOT NULL DEFAULT '待补附件',
                stamp_tax_item TEXT,
                stamp_tax_rate REAL,
                voucher_id TEXT,
                voucher_number TEXT,
                status TEXT NOT NULL DEFAULT '待审核',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, document_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Document tax fields are optional so historical business records remain valid.
        sqlx::query("ALTER TABLE document_records ADD COLUMN stamp_tax_item TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE document_records ADD COLUMN stamp_tax_rate REAL")
            .execute(pool)
            .await
            .ok();

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS business_orders (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                order_type TEXT NOT NULL CHECK (order_type IN ('purchase', 'sales')),
                order_no TEXT NOT NULL,
                business_date TEXT NOT NULL,
                counterparty TEXT NOT NULL,
                goods_name TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                fulfillment_status TEXT NOT NULL DEFAULT '待确认',
                invoice_status TEXT NOT NULL DEFAULT '待开票',
                settlement_status TEXT NOT NULL DEFAULT '未结算',
                status TEXT NOT NULL DEFAULT '待确认',
                source_document TEXT,
                voucher_id TEXT,
                voucher_number TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, order_type, order_no)
            )
            "#,
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_business_orders_company_period ON business_orders(company_id, period, order_type)")
            .execute(pool)
            .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS settlement_records (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                settlement_type TEXT NOT NULL CHECK (settlement_type IN ('receivable', 'payable')),
                settlement_no TEXT NOT NULL,
                settlement_date TEXT NOT NULL,
                counterparty TEXT NOT NULL,
                invoice_no TEXT,
                transaction_no TEXT,
                total_amount REAL NOT NULL DEFAULT 0,
                settled_amount REAL NOT NULL DEFAULT 0,
                balance_amount REAL NOT NULL DEFAULT 0,
                settlement_method TEXT NOT NULL DEFAULT '待人工核销',
                owner TEXT,
                status TEXT NOT NULL DEFAULT '待确认',
                source_document TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, settlement_type, settlement_no)
            )
            "#,
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_settlement_records_company_period ON settlement_records(company_id, period, settlement_type)")
            .execute(pool)
            .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS bank_reconciliation_records (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                reconciliation_no TEXT NOT NULL,
                reconciliation_date TEXT NOT NULL,
                bank_transaction_id TEXT,
                account_name TEXT NOT NULL,
                transaction_no TEXT NOT NULL,
                summary TEXT,
                bank_amount REAL NOT NULL DEFAULT 0,
                book_amount REAL NOT NULL DEFAULT 0,
                difference_amount REAL NOT NULL DEFAULT 0,
                voucher_no TEXT,
                match_status TEXT NOT NULL DEFAULT '待人工对账',
                owner TEXT,
                status TEXT NOT NULL DEFAULT '待处理',
                note TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id),
                UNIQUE (company_id, reconciliation_no)
            )
            "#,
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_records_company_period ON bank_reconciliation_records(company_id, period)")
            .execute(pool)
            .await?;

        sqlx::query(r#"CREATE TABLE IF NOT EXISTS cost_carryover_records (
            id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, batch_no TEXT NOT NULL, carryover_date TEXT NOT NULL,
            valuation_method TEXT NOT NULL, source_bill_no TEXT NOT NULL, inventory_name TEXT NOT NULL, debit_subject TEXT NOT NULL, credit_subject TEXT NOT NULL,
            cost_amount REAL NOT NULL DEFAULT 0, difference_amount REAL NOT NULL DEFAULT 0, voucher_id TEXT, voucher_no TEXT, status TEXT NOT NULL DEFAULT '待确认', source_document TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (company_id) REFERENCES companies(id), FOREIGN KEY (voucher_id) REFERENCES vouchers(id), UNIQUE (company_id, batch_no))"#).execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_cost_carryover_records_company_period ON cost_carryover_records(company_id, period)").execute(pool).await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS payroll_records (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                employee_id TEXT NOT NULL,
                period TEXT NOT NULL,
                base_salary REAL NOT NULL DEFAULT 0,
                bonus REAL NOT NULL DEFAULT 0,
                tax_amount REAL NOT NULL DEFAULT 0,
                social_personal REAL NOT NULL DEFAULT 0,
                net_salary REAL NOT NULL DEFAULT 0,
                voucher_id TEXT,
                voucher_number TEXT,
                status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                UNIQUE (company_id, employee_id, period)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Employee archives are the shared source for payroll, social security, and withholding tax.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS employees (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                employee_code TEXT NOT NULL,
                name TEXT NOT NULL,
                id_no TEXT,
                department TEXT,
                position TEXT,
                mobile TEXT,
                entry_date TEXT,
                employment_status TEXT NOT NULL DEFAULT '在职',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, employee_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Companies (business entities / tenants)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                tax_id TEXT,
                contact TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                bank_name TEXT,
                bank_account TEXT,
                tax_type TEXT DEFAULT 'small',
                industry TEXT,
                accounting_system TEXT DEFAULT 'small_enterprise',
                province TEXT,
                city TEXT,
                district TEXT,
                enterprise_type TEXT,
                service_start TEXT,
                service_end TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency-level follow-up memo for each company. Credentials and external session data are never stored here.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS company_memos (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                content TEXT NOT NULL,
                reminder_date TEXT,
                updated_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (company_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Accounting periods (one per company per month)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS accounting_periods (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_year INTEGER NOT NULL,
                period_month INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                closed_at TEXT,
                closed_by TEXT,
                initial_balances_finalized_at TEXT,
                initial_balances_finalized_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period_year, period_month)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("ALTER TABLE accounting_periods ADD COLUMN initial_balances_finalized_at TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE accounting_periods ADD COLUMN initial_balances_finalized_by TEXT")
            .execute(pool)
            .await
            .ok();

        // Account codes (chart of accounts - per company)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS account_codes (
                code TEXT NOT NULL,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'asset',
                normal_balance TEXT NOT NULL DEFAULT 'debit',
                level INTEGER NOT NULL DEFAULT 1,
                parent_code TEXT,
                is_detail INTEGER NOT NULL DEFAULT 1,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                has_quantity INTEGER NOT NULL DEFAULT 0,
                default_unit TEXT,
                has_auxiliary INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (company_id, parent_code) REFERENCES account_codes(company_id, code),
                PRIMARY KEY (company_id, code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_account_codes_company ON account_codes(company_id)",
        )
        .execute(pool)
        .await?;

        // Voucher words (unified "记" prefix)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_words (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                word_code TEXT NOT NULL,
                word_name TEXT NOT NULL,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, word_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Vouchers (main voucher table)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS vouchers (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_id TEXT NOT NULL,
                voucher_word_id TEXT NOT NULL,
                voucher_number TEXT NOT NULL,
                sequence_num INTEGER NOT NULL DEFAULT 0,
                voucher_date TEXT NOT NULL,
                summary TEXT,
                attachment_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'draft',
                total_debit REAL NOT NULL DEFAULT 0,
                total_credit REAL NOT NULL DEFAULT 0,
                version INTEGER NOT NULL DEFAULT 1,
                created_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                modified_by TEXT,
                modified_at TEXT,
                approved_by TEXT,
                approved_at TEXT,
                reversed_by TEXT,
                reversed_at TEXT,
                reversal_of_id TEXT,
                is_system INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id),
                FOREIGN KEY (voucher_word_id) REFERENCES voucher_words(id),
                UNIQUE (period_id, voucher_word_id, sequence_num)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vouchers_company ON vouchers(company_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vouchers_period ON vouchers(period_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status)")
            .execute(pool)
            .await?;

        // Voucher entries (line items)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_entries (
                id TEXT PRIMARY KEY,
                voucher_id TEXT NOT NULL,
                line_num INTEGER NOT NULL DEFAULT 0,
                account_code TEXT NOT NULL,
                account_name TEXT NOT NULL,
                direction TEXT NOT NULL DEFAULT 'debit',
                amount REAL NOT NULL DEFAULT 0,
                summary TEXT,
                auxiliary_type TEXT,
                auxiliary_id TEXT,
                doc_number TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Migration: add doc_number column if not exists (for existing databases)
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN doc_number TEXT")
            .execute(pool)
            .await
            .ok(); // Ignore error if column already exists

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_entries_voucher ON voucher_entries(voucher_id)",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_entries_account ON voucher_entries(account_code)",
        )
        .execute(pool)
        .await?;

        // Account balances (per period per account)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS account_balances (
                id TEXT PRIMARY KEY,
                period_id TEXT NOT NULL,
                account_code TEXT NOT NULL,
                opening_debit REAL NOT NULL DEFAULT 0,
                opening_credit REAL NOT NULL DEFAULT 0,
                period_debit REAL NOT NULL DEFAULT 0,
                period_credit REAL NOT NULL DEFAULT 0,
                closing_debit REAL NOT NULL DEFAULT 0,
                closing_credit REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id),
                UNIQUE (period_id, account_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_balances_period ON account_balances(period_id)",
        )
        .execute(pool)
        .await?;

        // Older builds stored gross opening-plus-debit and opening-plus-credit
        // amounts in both closing columns. A closing balance must be netted and
        // presented on exactly one side so ledgers, trial balances and
        // statements share the same accounting basis.
        sqlx::query(
            r#"UPDATE account_balances
               SET closing_debit = CASE
                     WHEN opening_debit - opening_credit + period_debit - period_credit > 0
                     THEN opening_debit - opening_credit + period_debit - period_credit
                     ELSE 0
                   END,
                   closing_credit = CASE
                     WHEN opening_debit - opening_credit + period_debit - period_credit < 0
                     THEN -(opening_debit - opening_credit + period_debit - period_credit)
                     ELSE 0
                   END"#,
        )
        .execute(pool)
        .await?;

        // Initial balances (opening balances when setting up)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS initial_balances (
                id TEXT PRIMARY KEY,
                period_id TEXT NOT NULL,
                account_code TEXT NOT NULL,
                opening_debit REAL NOT NULL DEFAULT 0,
                opening_credit REAL NOT NULL DEFAULT 0,
                created_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id),
                UNIQUE (period_id, account_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Voucher operation log
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_logs (
                id TEXT PRIMARY KEY,
                voucher_id TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                before_data TEXT,
                after_data TEXT,
                operator_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_voucher_logs_voucher ON voucher_logs(voucher_id)",
        )
        .execute(pool)
        .await?;

        // Report templates
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS report_templates (
                id TEXT PRIMARY KEY,
                template_code TEXT NOT NULL UNIQUE,
                template_name TEXT NOT NULL,
                report_type TEXT NOT NULL,
                company_id TEXT,
                accounting_system TEXT NOT NULL DEFAULT 'small_enterprise',
                form_code TEXT,
                reporting_frequency TEXT NOT NULL DEFAULT 'monthly',
                is_statutory INTEGER NOT NULL DEFAULT 1,
                is_system INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Report items (lines within a report template)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS report_items (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                item_code TEXT NOT NULL,
                item_name TEXT NOT NULL,
                parent_id TEXT,
                item_level INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_total INTEGER NOT NULL DEFAULT 0,
                formula TEXT,
                line_number TEXT,
                calculation_sign INTEGER NOT NULL DEFAULT 1,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (template_id) REFERENCES report_templates(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_report_items_template ON report_items(template_id)",
        )
        .execute(pool)
        .await?;

        // Report item -> account mapping
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS report_account_mappings (
                id TEXT PRIMARY KEY,
                report_item_id TEXT NOT NULL,
                account_code TEXT NOT NULL,
                operation_type TEXT NOT NULL DEFAULT 'add',
                coefficient REAL NOT NULL DEFAULT 1.0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (report_item_id) REFERENCES report_items(id),
                UNIQUE (report_item_id, account_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Published statutory reports are immutable point-in-time versions.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS report_snapshots (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_id TEXT NOT NULL,
                report_type TEXT NOT NULL,
                version INTEGER NOT NULL,
                template_id TEXT,
                template_name TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                source_fingerprint TEXT NOT NULL,
                template_fingerprint TEXT,
                generated_by TEXT NOT NULL,
                generated_at TEXT NOT NULL DEFAULT (datetime('now')),
                published_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id),
                FOREIGN KEY (template_id) REFERENCES report_templates(id),
                UNIQUE (company_id, period_id, report_type, version)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Formula edits keep durable before/after evidence even after an item is removed.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS report_formula_notes (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                template_id TEXT NOT NULL,
                report_item_id TEXT,
                action TEXT NOT NULL,
                before_json TEXT,
                after_json TEXT,
                operator TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (template_id) REFERENCES report_templates(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Counterparties (customers/suppliers)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS counterparties (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                counterparty_type TEXT NOT NULL DEFAULT 'customer',
                tax_id TEXT,
                contact_person TEXT,
                phone TEXT,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Invoices
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period_id TEXT,
                invoice_type TEXT NOT NULL,
                invoice_no TEXT NOT NULL,
                invoice_code TEXT,
                invoice_date TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                tax_amount REAL NOT NULL DEFAULT 0,
                total_amount REAL NOT NULL DEFAULT 0,
                tax_rate REAL,
                seller_name TEXT,
                seller_tax_id TEXT,
                buyer_name TEXT,
                buyer_tax_id TEXT,
                status TEXT DEFAULT 'pending',
                voucher_id TEXT,
                remarks TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS invoice_lines (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                line_no INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                specification TEXT,
                unit TEXT,
                quantity REAL,
                unit_price REAL,
                amount REAL NOT NULL,
                tax_rate REAL,
                tax_amount REAL NOT NULL DEFAULT 0,
                tax_classification_code TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (invoice_id, line_no)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS invoice_tax_events (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                deduction_period TEXT,
                deductible_tax_amount REAL NOT NULL DEFAULT 0,
                source TEXT NOT NULL,
                reference_no TEXT,
                remarks TEXT,
                operator TEXT NOT NULL,
                occurred_at TEXT NOT NULL,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS prevent_invoice_tax_event_update
            BEFORE UPDATE ON invoice_tax_events
            BEGIN
                SELECT RAISE(ABORT, 'invoice tax events are immutable');
            END
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS prevent_invoice_tax_event_delete
            BEFORE DELETE ON invoice_tax_events
            BEGIN
                SELECT RAISE(ABORT, 'invoice tax events are immutable');
            END
            "#,
        )
        .execute(pool)
        .await?;

        // === Migration: add columns to existing tables (safe for upgrades) ===

        // account_codes new columns
        sqlx::query("ALTER TABLE account_codes ADD COLUMN has_quantity INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE account_codes ADD COLUMN default_unit TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query(
            "ALTER TABLE account_codes ADD COLUMN has_auxiliary INTEGER NOT NULL DEFAULT 0",
        )
        .execute(pool)
        .await
        .ok();

        // voucher_entries new columns (quantity/currency support)
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN quantity REAL")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN unit_price REAL")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN unit TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN currency_id TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE voucher_entries ADD COLUMN exchange_rate REAL")
            .execute(pool)
            .await
            .ok();

        // vouchers new columns
        sqlx::query("ALTER TABLE vouchers ADD COLUMN reference_number TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE vouchers ADD COLUMN is_settlement INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE vouchers ADD COLUMN settlement_rule_id TEXT")
            .execute(pool)
            .await
            .ok();

        // companies new columns (enable period)
        sqlx::query("ALTER TABLE companies ADD COLUMN enable_year INTEGER")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN enable_month INTEGER")
            .execute(pool)
            .await
            .ok();

        // Company soft delete & deactivation
        sqlx::query("ALTER TABLE companies ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN deleted_at TEXT")
            .execute(pool)
            .await
            .ok();

        // Company archive fields collected from the agency account-set form.
        // Credentials remain outside this table and are handled by adapter authorization metadata.
        sqlx::query("ALTER TABLE companies ADD COLUMN district TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN enterprise_type TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN service_start TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE companies ADD COLUMN service_end TEXT")
            .execute(pool)
            .await
            .ok();

        // Accounting reports are selected by the company's accounting system.
        // Legacy global templates remain preserved as hidden, non-statutory templates.
        sqlx::query(
            "ALTER TABLE report_templates ADD COLUMN accounting_system TEXT NOT NULL DEFAULT 'small_enterprise'",
        )
        .execute(pool)
        .await
        .ok();
        sqlx::query("ALTER TABLE report_templates ADD COLUMN company_id TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_report_templates_company_type ON report_templates(company_id, report_type) WHERE company_id IS NOT NULL",
        )
        .execute(pool)
        .await?;
        sqlx::query("ALTER TABLE report_templates ADD COLUMN form_code TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query(
            "ALTER TABLE report_templates ADD COLUMN reporting_frequency TEXT NOT NULL DEFAULT 'monthly'",
        )
        .execute(pool)
        .await
        .ok();
        sqlx::query(
            "ALTER TABLE report_templates ADD COLUMN is_statutory INTEGER NOT NULL DEFAULT 1",
        )
        .execute(pool)
        .await
        .ok();
        sqlx::query("ALTER TABLE report_items ADD COLUMN line_number TEXT")
            .execute(pool)
            .await
            .ok();
        sqlx::query(
            "ALTER TABLE report_items ADD COLUMN calculation_sign INTEGER NOT NULL DEFAULT 1",
        )
        .execute(pool)
        .await
        .ok();

        for legacy_code in ["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW"] {
            sqlx::query(
                r#"UPDATE report_templates
                   SET template_code = 'LEGACY_' || template_code,
                       template_name = '旧版-' || template_name,
                       accounting_system = 'legacy',
                       is_statutory = 0,
                       is_system = 0
                   WHERE template_code = ?"#,
            )
            .bind(legacy_code)
            .execute(pool)
            .await?;
        }

        // Voucher soft delete columns
        sqlx::query("ALTER TABLE vouchers ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE vouchers ADD COLUMN deleted_at TEXT")
            .execute(pool)
            .await
            .ok();

        // === New tables ===

        // Auxiliary accounting categories (e.g. 客户, 供应商, 职员, 项目, 部门, 存货, 自定义)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS auxiliary_categories (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT NOT NULL,
                is_system INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Auxiliary accounting items (specific customers, suppliers, employees etc.)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS auxiliary_items (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                remarks TEXT,
                FOREIGN KEY (category_id) REFERENCES auxiliary_categories(id),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Account code -> auxiliary category linkage (which aux dimensions an account requires)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS account_auxiliary_links (
                id TEXT PRIMARY KEY,
                account_code TEXT NOT NULL,
                company_id TEXT NOT NULL,
                auxiliary_category_id TEXT NOT NULL,
                is_required INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id, account_code) REFERENCES account_codes(company_id, code),
                FOREIGN KEY (auxiliary_category_id) REFERENCES auxiliary_categories(id),
                UNIQUE (company_id, account_code, auxiliary_category_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Voucher entry -> auxiliary item linkage (actual aux data on a journal line)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_entry_auxiliaries (
                id TEXT PRIMARY KEY,
                entry_id TEXT NOT NULL,
                auxiliary_category_id TEXT NOT NULL,
                auxiliary_item_id TEXT NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES voucher_entries(id) ON DELETE CASCADE,
                FOREIGN KEY (auxiliary_category_id) REFERENCES auxiliary_categories(id),
                FOREIGN KEY (auxiliary_item_id) REFERENCES auxiliary_items(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Currencies / exchange rates
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS currencies (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                exchange_rate REAL NOT NULL DEFAULT 1.0,
                is_base INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Voucher template types (categories)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_template_types (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Voucher templates (predefined journal patterns)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS voucher_templates (
                id TEXT PRIMARY KEY,
                type_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                entries_json TEXT NOT NULL,
                FOREIGN KEY (type_id) REFERENCES voucher_template_types(id),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Common transaction descriptions (digests)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS common_digests (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Settlement rules (auto-generated closing vouchers)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS settlement_rules (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                source_formula TEXT,
                target_account_code TEXT,
                voucher_word_id TEXT,
                summary_template TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Dashboard widgets configuration
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS dashboard_widgets (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                widget_type TEXT NOT NULL,
                title TEXT NOT NULL,
                config_json TEXT NOT NULL DEFAULT '{}',
                position_x INTEGER NOT NULL DEFAULT 0,
                position_y INTEGER NOT NULL DEFAULT 0,
                width INTEGER NOT NULL DEFAULT 1,
                height INTEGER NOT NULL DEFAULT 1,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Financial indicators (e.g. ROE, current ratio, etc.)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS financial_indicators (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                formula TEXT NOT NULL,
                unit TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Roles
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                is_system INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Role permissions
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS role_permissions (
                id TEXT PRIMARY KEY,
                role_id TEXT NOT NULL,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                UNIQUE (role_id, resource, action)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // User-company association (multi-user multi-company)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS user_companies (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE (user_id, company_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency service contracts (outer agency workspace)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_service_contracts (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                contract_no TEXT NOT NULL,
                service_package TEXT NOT NULL,
                service_start TEXT NOT NULL,
                service_end TEXT NOT NULL,
                monthly_fee REAL NOT NULL DEFAULT 0,
                renewal_status TEXT NOT NULL DEFAULT 'normal',
                owner TEXT,
                archive_status TEXT NOT NULL DEFAULT 'pending',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, contract_no)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency fee collection ledger
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_fee_collections (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                receivable_amount REAL NOT NULL DEFAULT 0,
                received_amount REAL NOT NULL DEFAULT 0,
                arrears_amount REAL NOT NULL DEFAULT 0,
                invoice_status TEXT NOT NULL DEFAULT 'pending',
                payment_status TEXT NOT NULL DEFAULT 'pending',
                collector TEXT,
                last_follow_up TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency customer collaboration tasks
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_collaboration_items (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                todo_title TEXT NOT NULL,
                material_type TEXT,
                customer_contact TEXT,
                reminder_count INTEGER NOT NULL DEFAULT 0,
                last_contact_at TEXT,
                reply_status TEXT NOT NULL DEFAULT 'pending',
                owner TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency service delivery tickets
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_delivery_tickets (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                ticket_no TEXT NOT NULL,
                task_name TEXT NOT NULL,
                period TEXT NOT NULL,
                current_stage TEXT NOT NULL,
                sla_status TEXT NOT NULL DEFAULT 'normal',
                owner TEXT,
                delivery_status TEXT NOT NULL DEFAULT 'processing',
                status TEXT NOT NULL DEFAULT 'processing',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, ticket_no)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Agency batch work queue. Creation records a local preflight task only; external adapters execute separately.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_batch_tasks (
                id TEXT PRIMARY KEY,
                task_type TEXT NOT NULL,
                task_name TEXT NOT NULL,
                period TEXT NOT NULL,
                customer_scope TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress_current INTEGER NOT NULL DEFAULT 0,
                progress_total INTEGER,
                result_summary TEXT,
                risk_level TEXT NOT NULL DEFAULT 'normal',
                operator TEXT,
                requires_approval INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Per-account-set execution receipts for agency batch tasks.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agency_batch_task_items (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                period_id TEXT,
                action TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                result_summary TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (task_id) REFERENCES agency_batch_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (period_id) REFERENCES accounting_periods(id) ON DELETE SET NULL,
                UNIQUE (task_id, company_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Local attachment and import metadata. File bytes remain under explicit user control;
        // the database keeps the immutable checksum, scope, workflow state, and audit link.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS local_file_records (
                id TEXT PRIMARY KEY,
                record_kind TEXT NOT NULL CHECK (record_kind IN ('import', 'attachment')),
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                module_name TEXT NOT NULL,
                operation TEXT,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_format TEXT NOT NULL,
                checksum TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '待确认',
                row_count INTEGER,
                column_preview TEXT,
                preview_rows TEXT,
                validation_note TEXT,
                written_row_count INTEGER,
                failed_row_count INTEGER,
                failure_rows TEXT,
                related_document TEXT,
                operator TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                deleted_at TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS export_jobs (
                id TEXT PRIMARY KEY,
                scope_kind TEXT NOT NULL CHECK (scope_kind IN ('account', 'agency')),
                company_id TEXT,
                file_name TEXT NOT NULL,
                module_name TEXT NOT NULL,
                format TEXT NOT NULL,
                data_scope TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                operator TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '已完成',
                template_kind TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                CHECK (
                    (scope_kind = 'account' AND company_id IS NOT NULL) OR
                    (scope_kind = 'agency' AND company_id IS NULL)
                )
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Automation jobs for AI bookkeeping and data collection queues.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS automation_jobs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT,
                job_type TEXT NOT NULL,
                source_module TEXT NOT NULL,
                source_id TEXT,
                source_file TEXT,
                suggestion_no TEXT,
                debit_subject TEXT,
                credit_subject TEXT,
                suggestion_amount REAL,
                generated_voucher_id TEXT,
                generated_voucher_number TEXT,
                status TEXT NOT NULL DEFAULT 'queued',
                confidence REAL,
                result_summary TEXT,
                risk_level TEXT NOT NULL DEFAULT 'normal',
                reviewer TEXT,
                created_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Tax declaration tasks stop at local collection, validation, confirmation, and archive states.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tax_declaration_tasks (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                tax_type TEXT NOT NULL,
                form_name TEXT NOT NULL,
                collect_status TEXT NOT NULL DEFAULT 'not_collected',
                validation_status TEXT NOT NULL DEFAULT 'pending',
                declaration_status TEXT NOT NULL DEFAULT 'draft',
                source_snapshot TEXT,
                taxable_amount REAL NOT NULL DEFAULT 0,
                deduction_amount REAL NOT NULL DEFAULT 0,
                payable_amount REAL NOT NULL DEFAULT 0,
                risk_count INTEGER NOT NULL DEFAULT 0,
                adapter_code TEXT,
                confirmed_by TEXT,
                confirmed_at TEXT,
                receipt_no TEXT,
                payment_status TEXT NOT NULL DEFAULT 'unrecorded',
                payment_no TEXT,
                receipt_received_at TEXT,
                snapshot_version INTEGER NOT NULL DEFAULT 0,
                snapshot_fingerprint TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period, tax_type, form_name)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Every tax collection or confirmation writes an immutable source snapshot.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tax_declaration_snapshots (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                tax_type TEXT NOT NULL,
                form_name TEXT NOT NULL,
                version INTEGER NOT NULL,
                collect_status TEXT NOT NULL,
                validation_status TEXT NOT NULL,
                declaration_status TEXT NOT NULL,
                source_snapshot TEXT,
                taxable_amount REAL NOT NULL DEFAULT 0,
                deduction_amount REAL NOT NULL DEFAULT 0,
                payable_amount REAL NOT NULL DEFAULT 0,
                risk_count INTEGER NOT NULL DEFAULT 0,
                adapter_code TEXT,
                fingerprint TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (task_id) REFERENCES tax_declaration_tasks(id),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (task_id, version)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // External adapter authorizations keep only status, scope, and masked account metadata.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS adapter_authorizations (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                adapter_type TEXT NOT NULL,
                adapter_code TEXT NOT NULL,
                region TEXT,
                auth_status TEXT NOT NULL DEFAULT 'pending',
                account_mask TEXT,
                login_identity TEXT,
                capability_scope TEXT,
                last_checked_at TEXT,
                expires_at TEXT,
                risk_message TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, adapter_type, adapter_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Shared audit log for high-risk automation, tax, export, and adapter operations.
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS operation_audit_logs (
                id TEXT PRIMARY KEY,
                company_id TEXT,
                module_name TEXT NOT NULL,
                action TEXT NOT NULL,
                object_ref TEXT,
                risk_level TEXT NOT NULL DEFAULT 'normal',
                result TEXT NOT NULL DEFAULT 'success',
                detail TEXT,
                operator TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // === Additional indexes for performance ===

        // Voucher entries: direction for trial balance queries
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_entries_direction ON voucher_entries(direction)",
        )
        .execute(pool)
        .await?;

        // Account balances: account_code + period_id composite for ledger lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_balances_account_period ON account_balances(account_code, period_id)")
            .execute(pool)
            .await?;

        // Invoices: company + type + date for filtered listings
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_invoices_company_type ON invoices(company_id, invoice_type)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date)")
            .execute(pool)
            .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, line_no)",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_invoice_tax_events_invoice ON invoice_tax_events(invoice_id, occurred_at)",
        )
        .execute(pool)
        .await?;

        // Auxiliary: category lookups
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_aux_items_category ON auxiliary_items(category_id)",
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_employees_company_status ON employees(company_id, employment_status)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_company_todos_scope ON company_todos(company_id, period, status)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_payroll_company_period ON payroll_records(company_id, period)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_aux_links_account ON account_auxiliary_links(account_code)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entry_auxiliaries_entry ON voucher_entry_auxiliaries(entry_id)")
            .execute(pool)
            .await?;

        // Currencies: company lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_currencies_company ON currencies(company_id)")
            .execute(pool)
            .await?;

        // Role permissions: role lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id)")
            .execute(pool)
            .await?;

        // User companies: user lookups
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id)",
        )
        .execute(pool)
        .await?;

        // Agency operations: company and status lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_contracts_company ON agency_service_contracts(company_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_contracts_status ON agency_service_contracts(status, renewal_status)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_fees_company_period ON agency_fee_collections(company_id, period)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_fees_status ON agency_fee_collections(status, payment_status)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_collaboration_company ON agency_collaboration_items(company_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_collaboration_status ON agency_collaboration_items(status, reply_status)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_tickets_company_period ON agency_delivery_tickets(company_id, period)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_tickets_status ON agency_delivery_tickets(status, delivery_status)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agency_batch_tasks_period_status ON agency_batch_tasks(period, status)")
            .execute(pool)
            .await?;

        // Automation and adapter operations
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_automation_jobs_company_period ON automation_jobs(company_id, period)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_automation_jobs_status ON automation_jobs(status, job_type)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_tax_tasks_company_period ON tax_declaration_tasks(company_id, period)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_tax_tasks_status ON tax_declaration_tasks(declaration_status, validation_status)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_tax_snapshots_task_version ON tax_declaration_snapshots(task_id, version)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_adapter_auth_company_type ON adapter_authorizations(company_id, adapter_type)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_logs_company_module ON operation_audit_logs(company_id, module_name)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_report_snapshots_scope ON report_snapshots(company_id, period_id, report_type, version DESC)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_report_formula_notes_scope ON report_formula_notes(company_id, template_id, created_at DESC)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_local_files_scope ON local_file_records(company_id, period, record_kind, deleted_at)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_export_jobs_scope ON export_jobs(scope_kind, company_id, created_at)")
            .execute(pool)
            .await?;

        // Periods: company lookups
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_periods_company ON accounting_periods(company_id)",
        )
        .execute(pool)
        .await?;

        // Account codes: type filter
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_account_codes_type ON account_codes(account_type)",
        )
        .execute(pool)
        .await?;

        // Add role_id column to users if not exists
        let _ = sqlx::query("ALTER TABLE users ADD COLUMN role_id TEXT REFERENCES roles(id)")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN suggestion_no TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN debit_subject TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN credit_subject TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN suggestion_amount REAL")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN generated_voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE automation_jobs ADD COLUMN generated_voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE bank_transactions ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE bank_transactions ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE document_records ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE document_records ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE business_orders ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE account_transfers ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE account_transfers ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE cost_carryover_records ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE payroll_records ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE payroll_records ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE social_security_records ADD COLUMN voucher_id TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE social_security_records ADD COLUMN voucher_number TEXT")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tax_declaration_tasks ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unrecorded'")
            .execute(pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tax_declaration_tasks ADD COLUMN payment_no TEXT")
            .execute(pool)
            .await;
        let _ =
            sqlx::query("ALTER TABLE tax_declaration_tasks ADD COLUMN receipt_received_at TEXT")
                .execute(pool)
                .await;
        let _ = sqlx::query(
            "ALTER TABLE tax_declaration_tasks ADD COLUMN snapshot_version INTEGER NOT NULL DEFAULT 0",
        )
        .execute(pool)
        .await;
        let _ =
            sqlx::query("ALTER TABLE tax_declaration_tasks ADD COLUMN snapshot_fingerprint TEXT")
                .execute(pool)
                .await;

        // === Seed data ===

        // Seed default roles
        let roles_exist: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM roles")
            .fetch_one(pool)
            .await?;

        if roles_exist.0 == 0 {
            // Admin role - full access
            let admin_role_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO roles (id, name, code, description, is_system) VALUES (?, '超级管理员', 'admin', '拥有所有权限', 1)",
            )
            .bind(&admin_role_id)
            .execute(pool)
            .await?;

            // Manager role
            let manager_role_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO roles (id, name, code, description, is_system) VALUES (?, '财务管理员', 'manager', '管理所有财务数据，不能管理用户', 1)",
            )
            .bind(&manager_role_id)
            .execute(pool)
            .await?;

            // Accountant role
            let accountant_role_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO roles (id, name, code, description, is_system) VALUES (?, '会计', 'accountant', '录入凭证、查看账簿，不能审核和删除', 1)",
            )
            .bind(&accountant_role_id)
            .execute(pool)
            .await?;

            // Viewer role
            let viewer_role_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO roles (id, name, code, description, is_system) VALUES (?, '查看者', 'viewer', '只能查看数据，不能修改', 1)",
            )
            .bind(&viewer_role_id)
            .execute(pool)
            .await?;

            // Seed permissions for manager
            let manager_perms = [
                ("vouchers", "view"),
                ("vouchers", "create"),
                ("vouchers", "edit"),
                ("vouchers", "approve"),
                ("vouchers", "export"),
                ("vouchers", "print"),
                ("invoices", "view"),
                ("invoices", "create"),
                ("invoices", "edit"),
                ("invoices", "delete"),
                ("reports", "view"),
                ("reports", "export"),
                ("reports", "print"),
                ("settings", "view"),
                ("settings", "edit"),
                ("ledger", "view"),
                ("ledger", "export"),
                ("ledger", "print"),
                ("period", "close"),
            ];
            for (resource, action) in &manager_perms {
                let perm_id = uuid::Uuid::new_v4().to_string();
                sqlx::query("INSERT INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)")
                    .bind(&perm_id)
                    .bind(&manager_role_id)
                    .bind(resource)
                    .bind(action)
                    .execute(pool)
                    .await?;
            }

            // Seed permissions for accountant
            let accountant_perms = [
                ("vouchers", "view"),
                ("vouchers", "create"),
                ("vouchers", "edit"),
                ("vouchers", "export"),
                ("invoices", "view"),
                ("invoices", "create"),
                ("invoices", "edit"),
                ("reports", "view"),
                ("reports", "export"),
                ("ledger", "view"),
                ("ledger", "export"),
                ("settings", "view"),
            ];
            for (resource, action) in &accountant_perms {
                let perm_id = uuid::Uuid::new_v4().to_string();
                sqlx::query("INSERT INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)")
                    .bind(&perm_id)
                    .bind(&accountant_role_id)
                    .bind(resource)
                    .bind(action)
                    .execute(pool)
                    .await?;
            }

            // Seed permissions for viewer
            let viewer_perms = [
                ("vouchers", "view"),
                ("invoices", "view"),
                ("reports", "view"),
                ("ledger", "view"),
                ("settings", "view"),
            ];
            for (resource, action) in &viewer_perms {
                let perm_id = uuid::Uuid::new_v4().to_string();
                sqlx::query("INSERT INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)")
                    .bind(&perm_id)
                    .bind(&viewer_role_id)
                    .bind(resource)
                    .bind(action)
                    .execute(pool)
                    .await?;
            }

            // Link existing admin user to admin role
            let admin_user: Option<(String,)> =
                sqlx::query_as("SELECT id FROM users WHERE username = 'admin'")
                    .fetch_optional(pool)
                    .await?;
            if let Some((admin_user_id,)) = admin_user {
                sqlx::query("UPDATE users SET role_id = ? WHERE id = ?")
                    .bind(&admin_role_id)
                    .bind(&admin_user_id)
                    .execute(pool)
                    .await?;
            }

            log::info!("Default roles and permissions seeded");
        }

        // Keep system-role permissions complete for both new and existing databases.
        let system_permission_sets: [(&str, &[(&str, &str)]); 4] = [
            (
                "admin",
                &[
                    ("vouchers", "view"),
                    ("vouchers", "create"),
                    ("vouchers", "edit"),
                    ("vouchers", "delete"),
                    ("vouchers", "approve"),
                    ("vouchers", "export"),
                    ("vouchers", "print"),
                    ("vouchers", "import"),
                    ("invoices", "view"),
                    ("invoices", "create"),
                    ("invoices", "edit"),
                    ("invoices", "delete"),
                    ("invoices", "export"),
                    ("tax", "view"),
                    ("tax", "create"),
                    ("tax", "edit"),
                    ("tax", "delete"),
                    ("tax", "approve"),
                    ("tax", "export"),
                    ("tax", "print"),
                    ("reports", "view"),
                    ("reports", "export"),
                    ("reports", "print"),
                    ("ledger", "view"),
                    ("ledger", "export"),
                    ("ledger", "print"),
                    ("period", "view"),
                    ("period", "close"),
                    ("bank", "view"),
                    ("bank", "create"),
                    ("bank", "edit"),
                    ("bank", "delete"),
                    ("inventory", "view"),
                    ("inventory", "create"),
                    ("inventory", "edit"),
                    ("inventory", "delete"),
                    ("payroll", "view"),
                    ("payroll", "create"),
                    ("payroll", "edit"),
                    ("payroll", "delete"),
                    ("payroll", "approve"),
                    ("payroll", "export"),
                    ("payroll", "print"),
                    ("settings", "view"),
                    ("settings", "create"),
                    ("settings", "edit"),
                    ("settings", "delete"),
                    ("users", "view"),
                    ("users", "create"),
                    ("users", "edit"),
                    ("users", "delete"),
                ],
            ),
            (
                "manager",
                &[
                    ("vouchers", "view"),
                    ("vouchers", "create"),
                    ("vouchers", "edit"),
                    ("vouchers", "approve"),
                    ("vouchers", "export"),
                    ("vouchers", "print"),
                    ("invoices", "view"),
                    ("invoices", "create"),
                    ("invoices", "edit"),
                    ("invoices", "delete"),
                    ("tax", "view"),
                    ("tax", "create"),
                    ("tax", "edit"),
                    ("tax", "approve"),
                    ("tax", "export"),
                    ("tax", "print"),
                    ("reports", "view"),
                    ("reports", "export"),
                    ("reports", "print"),
                    ("ledger", "view"),
                    ("ledger", "export"),
                    ("ledger", "print"),
                    ("period", "close"),
                    ("bank", "view"),
                    ("bank", "create"),
                    ("bank", "edit"),
                    ("inventory", "view"),
                    ("inventory", "create"),
                    ("inventory", "edit"),
                    ("inventory", "delete"),
                    ("payroll", "view"),
                    ("payroll", "create"),
                    ("payroll", "edit"),
                    ("payroll", "export"),
                    ("settings", "view"),
                    ("settings", "edit"),
                    ("users", "view"),
                ],
            ),
            (
                "accountant",
                &[
                    ("vouchers", "view"),
                    ("vouchers", "create"),
                    ("vouchers", "edit"),
                    ("vouchers", "export"),
                    ("invoices", "view"),
                    ("invoices", "create"),
                    ("invoices", "edit"),
                    ("tax", "view"),
                    ("tax", "create"),
                    ("tax", "edit"),
                    ("tax", "export"),
                    ("reports", "view"),
                    ("reports", "export"),
                    ("ledger", "view"),
                    ("ledger", "export"),
                    ("bank", "view"),
                    ("inventory", "view"),
                    ("inventory", "create"),
                    ("inventory", "edit"),
                    ("payroll", "view"),
                    ("payroll", "create"),
                    ("payroll", "edit"),
                    ("payroll", "export"),
                    ("settings", "view"),
                ],
            ),
            (
                "viewer",
                &[
                    ("vouchers", "view"),
                    ("invoices", "view"),
                    ("tax", "view"),
                    ("reports", "view"),
                    ("ledger", "view"),
                    ("bank", "view"),
                    ("inventory", "view"),
                    ("payroll", "view"),
                    ("settings", "view"),
                ],
            ),
        ];
        for (role_code, permissions) in system_permission_sets {
            let role_id: Option<String> =
                sqlx::query_scalar("SELECT id FROM roles WHERE code = ? AND is_system = 1")
                    .bind(role_code)
                    .fetch_optional(pool)
                    .await?;
            if let Some(role_id) = role_id {
                for (resource, action) in permissions {
                    sqlx::query(
                        "INSERT OR IGNORE INTO role_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)",
                    )
                    .bind(uuid::Uuid::new_v4().to_string())
                    .bind(&role_id)
                    .bind(resource)
                    .bind(action)
                    .execute(pool)
                    .await?;
                }
            }
        }

        // Default report templates and items
        let templates_exist: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM report_templates WHERE is_system = 1 AND accounting_system <> 'legacy'",
        )
        .fetch_one(pool)
        .await?;

        if templates_exist.0 == 0 {
            Self::insert_default_report_templates(pool).await?;
            log::info!("Default report templates inserted");
        }

        Self::normalize_enterprise_equity_reporting(pool).await?;
        Self::normalize_enterprise_cash_flow_template(pool).await?;
        Self::normalize_enterprise_2019_reporting(pool).await?;
        Self::normalize_small_enterprise_2013_reporting(pool).await?;
        Self::normalize_cooperative_2023_reporting(pool).await?;
        Self::normalize_nonprofit_2026_reporting(pool).await?;
        Self::normalize_standard_report_calculation_signs(pool).await?;

        sqlx::query(
            r#"UPDATE report_items
               SET line_number = CAST(sort_order AS TEXT)
               WHERE line_number IS NULL
                 AND (formula IS NOT NULL OR is_total = 1)
                 AND template_id IN (
                   SELECT id FROM report_templates
                   WHERE is_system = 1 AND accounting_system <> 'legacy'
                     AND report_type <> 'equity_change'
                 )"#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"UPDATE report_items
               SET item_name = '五、期末现金及现金等价物余额'
               WHERE item_code = 'CF999'
                 AND item_name = '五、现金及现金等价物净增加额'
                 AND template_id IN (
                   SELECT id FROM report_templates
                   WHERE template_code IN (
                     'ENTERPRISE_CASH_FLOW',
                     'SMALL_ENTERPRISE_CASH_FLOW',
                     'COOPERATIVE_MANAGEMENT_CASH_FLOW'
                   )
                 )"#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"UPDATE report_items
               SET item_name = '五、现金及现金等价物净增加额', formula = NULL
               WHERE item_code = 'CF999'
                 AND template_id IN (
                   SELECT id FROM report_templates
                   WHERE template_code = 'NON_PROFIT_CASH_FLOW'
                 )"#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"UPDATE report_items
               SET formula = CASE item_code
                 WHEN 'BS102' THEN '113+closing_d:114'
                 WHEN 'BS199' THEN '101+102+113+closing_d:114+121+124+125+127+128+401+141'
                 WHEN 'BS999' THEN '101+102+113+closing_d:114+121+124+125+127+128+401+141+131+142-143+151-152+153+154+161-162+144+171'
                 WHEN 'BS302' THEN '211+closing_c:114'
                 WHEN 'BS399' THEN '201+211+closing_c:114+212+213+214+215+221+222'
                 WHEN 'BS599' THEN '201+211+closing_c:114+212+213+214+215+221+222+231+235'
                 WHEN 'BS799' THEN '201+211+closing_c:114+212+213+214+215+221+222+231+235+301+311+321+322+331+332'
                 ELSE formula
               END
               WHERE item_code IN ('BS102', 'BS199', 'BS999', 'BS302', 'BS399', 'BS599', 'BS799')
                 AND template_id IN (
                   SELECT id FROM report_templates
                   WHERE template_code = 'COOPERATIVE_BALANCE_SHEET'
                 )"#,
        )
        .execute(pool)
        .await?;

        Self::run_versioned_migrations(pool).await?;

        log::info!("Database migrations completed successfully");
        Ok(())
    }

    pub async fn insert_account_codes_for_system(
        transaction: &mut sqlx::Transaction<'_, Sqlite>,
        company_id: &str,
        accounting_system: &str,
    ) -> Result<(), DbError> {
        let codes: Vec<AccountCodeSeed> = match accounting_system {
            "enterprise" => Self::enterprise_account_codes(),
            "non_profit" => Self::non_profit_account_codes(),
            "cooperative" => Self::cooperative_account_codes(),
            _ => Self::small_enterprise_account_codes(), // default: small_enterprise
        };

        for (code, name, account_type, normal_balance, level, parent_code, is_detail) in &codes {
            sqlx::query(
                "INSERT OR IGNORE INTO account_codes (code, company_id, name, account_type, normal_balance, level, parent_code, is_detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(code)
            .bind(company_id)
            .bind(name)
            .bind(account_type)
            .bind(normal_balance)
            .bind(level)
            .bind(parent_code)
            .bind(is_detail)
            .execute(&mut **transaction)
            .await?;
        }

        Ok(())
    }

    fn small_enterprise_account_codes() -> Vec<AccountCodeSeed> {
        vec![
            // === 资产类 ===
            ("1001", "库存现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1012", "其他货币资金", "asset", "debit", 1, None, 0),
            ("101201", "存出投资款", "asset", "debit", 2, Some("1012"), 1),
            ("1101", "短期投资", "asset", "debit", 1, None, 1),
            ("1121", "应收票据", "asset", "debit", 1, None, 1),
            ("1122", "应收账款", "asset", "debit", 1, None, 0),
            (
                "112201",
                "应收账款-客户",
                "asset",
                "debit",
                2,
                Some("1122"),
                1,
            ),
            ("1123", "预付账款", "asset", "debit", 1, None, 1),
            ("1131", "应收股利", "asset", "debit", 1, None, 1),
            ("1132", "应收利息", "asset", "debit", 1, None, 1),
            ("1221", "其他应收款", "asset", "debit", 1, None, 1),
            ("1401", "材料采购", "asset", "debit", 1, None, 1),
            ("1402", "在途物资", "asset", "debit", 1, None, 1),
            ("1403", "原材料", "asset", "debit", 1, None, 1),
            ("1404", "材料成本差异", "asset", "debit", 1, None, 1),
            ("1405", "库存商品", "asset", "debit", 1, None, 1),
            ("1407", "商品进销差价", "asset", "credit", 1, None, 1),
            ("1408", "委托加工物资", "asset", "debit", 1, None, 1),
            ("1411", "周转材料", "asset", "debit", 1, None, 1),
            ("1421", "消耗性生物资产", "asset", "debit", 1, None, 1),
            ("1501", "长期债券投资", "asset", "debit", 1, None, 1),
            ("1511", "长期股权投资", "asset", "debit", 1, None, 1),
            ("1601", "固定资产", "asset", "debit", 1, None, 1),
            ("1602", "累计折旧", "asset", "credit", 1, None, 1),
            ("1604", "在建工程", "asset", "debit", 1, None, 1),
            ("1605", "工程物资", "asset", "debit", 1, None, 1),
            ("1606", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1621", "生产性生物资产", "asset", "debit", 1, None, 1),
            (
                "1622",
                "生产性生物资产累计折旧",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1701", "无形资产", "asset", "debit", 1, None, 1),
            ("1702", "累计摊销", "asset", "credit", 1, None, 1),
            ("1801", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1901", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 0),
            (
                "220201",
                "应付账款-供应商",
                "liability",
                "credit",
                2,
                Some("2202"),
                1,
            ),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2211", "应付职工薪酬", "liability", "credit", 1, None, 0),
            ("221101", "工资", "liability", "credit", 2, Some("2211"), 1),
            (
                "221102",
                "社会保险费",
                "liability",
                "credit",
                2,
                Some("2211"),
                1,
            ),
            (
                "221103",
                "住房公积金",
                "liability",
                "credit",
                2,
                Some("2211"),
                1,
            ),
            ("2221", "应交税费", "liability", "credit", 1, None, 0),
            (
                "222101",
                "应交增值税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222102",
                "应交所得税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222103",
                "应交城市维护建设税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222104",
                "应交教育费附加",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            ("2231", "应付利息", "liability", "credit", 1, None, 1),
            ("2232", "应付利润", "liability", "credit", 1, None, 1),
            ("2241", "其他应付款", "liability", "credit", 1, None, 1),
            ("2401", "递延收益", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2701", "长期应付款", "liability", "credit", 1, None, 1),
            // === 权益类 ===
            ("3001", "实收资本", "equity", "credit", 1, None, 1),
            ("3002", "资本公积", "equity", "credit", 1, None, 0),
            ("300201", "资本溢价", "equity", "credit", 2, Some("3002"), 1),
            ("3101", "盈余公积", "equity", "credit", 1, None, 0),
            (
                "310101",
                "法定盈余公积",
                "equity",
                "credit",
                2,
                Some("3101"),
                1,
            ),
            (
                "310102",
                "任意盈余公积",
                "equity",
                "credit",
                2,
                Some("3101"),
                1,
            ),
            ("3103", "本年利润", "equity", "credit", 1, None, 1),
            ("3104", "利润分配", "equity", "credit", 1, None, 0),
            (
                "310401",
                "未分配利润",
                "equity",
                "credit",
                2,
                Some("3104"),
                1,
            ),
            (
                "310402",
                "提取法定盈余公积",
                "equity",
                "credit",
                2,
                Some("3104"),
                1,
            ),
            // === 成本类 ===
            ("4001", "生产成本", "cost", "debit", 1, None, 0),
            (
                "400101",
                "基本生产成本",
                "cost",
                "debit",
                2,
                Some("4001"),
                1,
            ),
            (
                "400102",
                "辅助生产成本",
                "cost",
                "debit",
                2,
                Some("4001"),
                1,
            ),
            ("4101", "制造费用", "cost", "debit", 1, None, 1),
            ("4301", "研发支出", "cost", "debit", 1, None, 1),
            ("4401", "工程施工", "cost", "debit", 1, None, 1),
            ("4403", "机械作业", "cost", "debit", 1, None, 1),
            // === 损益类-收入 ===
            ("5001", "主营业务收入", "income", "credit", 1, None, 1),
            ("5051", "其他业务收入", "income", "credit", 1, None, 1),
            ("5111", "投资收益", "income", "credit", 1, None, 1),
            ("5301", "营业外收入", "income", "credit", 1, None, 0),
            (
                "530101",
                "非流动资产处置利得",
                "income",
                "credit",
                2,
                Some("5301"),
                1,
            ),
            (
                "530102",
                "政府补助利得",
                "income",
                "credit",
                2,
                Some("5301"),
                1,
            ),
            // === 损益类-费用 ===
            ("5401", "主营业务成本", "expense", "debit", 1, None, 1),
            ("5402", "其他业务成本", "expense", "debit", 1, None, 1),
            ("5403", "营业税金及附加", "expense", "debit", 1, None, 0),
            ("540301", "消费税", "expense", "debit", 2, Some("5403"), 1),
            ("540302", "营业税", "expense", "debit", 2, Some("5403"), 1),
            (
                "540303",
                "城市维护建设税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            ("540304", "资源税", "expense", "debit", 2, Some("5403"), 1),
            (
                "540305",
                "土地增值税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            (
                "540306",
                "城镇土地使用税、房产税、车船税、印花税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            (
                "540307",
                "教育费附加、矿产资源补偿费、排污费",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            ("5601", "销售费用", "expense", "debit", 1, None, 0),
            (
                "560101",
                "广告费和业务宣传费",
                "expense",
                "debit",
                2,
                Some("5601"),
                1,
            ),
            ("560102", "运输费", "expense", "debit", 2, Some("5601"), 1),
            (
                "560103",
                "业务招待费",
                "expense",
                "debit",
                2,
                Some("5601"),
                1,
            ),
            (
                "560104",
                "商品维修费",
                "expense",
                "debit",
                2,
                Some("5601"),
                1,
            ),
            ("5602", "管理费用", "expense", "debit", 1, None, 0),
            ("560201", "办公费", "expense", "debit", 2, Some("5602"), 1),
            ("560202", "差旅费", "expense", "debit", 2, Some("5602"), 1),
            ("560203", "折旧费", "expense", "debit", 2, Some("5602"), 1),
            (
                "560204",
                "管理人员薪酬",
                "expense",
                "debit",
                2,
                Some("5602"),
                1,
            ),
            (
                "560205",
                "无形资产摊销",
                "expense",
                "debit",
                2,
                Some("5602"),
                1,
            ),
            ("560206", "开办费", "expense", "debit", 2, Some("5602"), 1),
            (
                "560207",
                "业务招待费",
                "expense",
                "debit",
                2,
                Some("5602"),
                1,
            ),
            ("560208", "研究费用", "expense", "debit", 2, Some("5602"), 1),
            ("5603", "财务费用", "expense", "debit", 1, None, 0),
            ("560301", "利息支出", "expense", "debit", 2, Some("5603"), 1),
            ("560302", "手续费", "expense", "debit", 2, Some("5603"), 1),
            (
                "560303",
                "利息收入",
                "expense",
                "credit",
                2,
                Some("5603"),
                1,
            ),
            ("5711", "营业外支出", "expense", "debit", 1, None, 0),
            (
                "571101",
                "非流动资产处置损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571102",
                "公益性捐赠支出",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            ("571103", "坏账损失", "expense", "debit", 2, Some("5711"), 1),
            (
                "571104",
                "无法收回的长期债券投资损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571105",
                "无法收回的长期股权投资损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571106",
                "自然灾害等不可抗力因素造成的损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571107",
                "税收滞纳金",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            ("5801", "所得税费用", "expense", "debit", 1, None, 1),
        ]
    }

    fn enterprise_account_codes() -> Vec<AccountCodeSeed> {
        vec![
            // === 资产类 (企业会计准则) ===
            ("1001", "库存现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1003", "存放中央银行款项", "asset", "debit", 1, None, 1),
            ("1011", "存放同业", "asset", "debit", 1, None, 1),
            ("1012", "其他货币资金", "asset", "debit", 1, None, 0),
            ("101201", "存出投资款", "asset", "debit", 2, Some("1012"), 1),
            ("1021", "结算备付金", "asset", "debit", 1, None, 1),
            ("1101", "交易性金融资产", "asset", "debit", 1, None, 1),
            ("1111", "衍生金融资产", "asset", "debit", 1, None, 1),
            ("1121", "应收票据", "asset", "debit", 1, None, 1),
            ("1122", "应收账款", "asset", "debit", 1, None, 0),
            (
                "112201",
                "应收账款-客户",
                "asset",
                "debit",
                2,
                Some("1122"),
                1,
            ),
            ("1123", "预付账款", "asset", "debit", 1, None, 1),
            ("1124", "合同资产", "asset", "debit", 1, None, 1),
            ("1125", "应收款项融资", "asset", "debit", 1, None, 1),
            ("1131", "应收股利", "asset", "debit", 1, None, 1),
            ("1132", "应收利息", "asset", "debit", 1, None, 1),
            ("1201", "应收代位追偿款", "asset", "debit", 1, None, 1),
            ("1221", "其他应收款", "asset", "debit", 1, None, 1),
            ("1231", "坏账准备", "asset", "credit", 1, None, 1),
            ("1301", "贴现资产", "asset", "debit", 1, None, 1),
            ("1401", "材料采购", "asset", "debit", 1, None, 1),
            ("1402", "在途物资", "asset", "debit", 1, None, 1),
            ("1403", "原材料", "asset", "debit", 1, None, 1),
            ("1404", "材料成本差异", "asset", "debit", 1, None, 1),
            ("1405", "库存商品", "asset", "debit", 1, None, 1),
            ("1406", "发出商品", "asset", "debit", 1, None, 1),
            ("1407", "商品进销差价", "asset", "debit", 1, None, 1),
            ("1408", "委托加工物资", "asset", "debit", 1, None, 1),
            ("1411", "周转材料", "asset", "debit", 1, None, 1),
            ("1421", "消耗性生物资产", "asset", "debit", 1, None, 1),
            ("1461", "融资租赁资产", "asset", "debit", 1, None, 1),
            ("1471", "存货跌价准备", "asset", "credit", 1, None, 1),
            ("1481", "合同履约成本", "asset", "debit", 1, None, 1),
            ("1482", "合同取得成本", "asset", "debit", 1, None, 1),
            ("1483", "合同资产减值准备", "asset", "credit", 1, None, 1),
            (
                "1484",
                "合同履约成本减值准备",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1485", "持有待售资产", "asset", "debit", 1, None, 1),
            ("1486", "应收退货成本", "asset", "debit", 1, None, 1),
            ("1501", "持有至到期投资", "asset", "debit", 1, None, 1),
            (
                "1502",
                "持有至到期投资减值准备",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1503", "可供出售金融资产", "asset", "debit", 1, None, 1),
            ("1506", "债权投资", "asset", "debit", 1, None, 1),
            ("1507", "其他债权投资", "asset", "debit", 1, None, 1),
            ("1508", "其他权益工具投资", "asset", "debit", 1, None, 1),
            ("1509", "其他非流动金融资产", "asset", "debit", 1, None, 1),
            ("1511", "长期股权投资", "asset", "debit", 1, None, 1),
            (
                "1512",
                "长期股权投资减值准备",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1521", "投资性房地产", "asset", "debit", 1, None, 1),
            ("1531", "长期应收款", "asset", "debit", 1, None, 1),
            ("1601", "固定资产", "asset", "debit", 1, None, 1),
            ("1602", "累计折旧", "asset", "credit", 1, None, 1),
            ("1603", "固定资产减值准备", "asset", "credit", 1, None, 1),
            ("1604", "在建工程", "asset", "debit", 1, None, 1),
            ("1605", "工程物资", "asset", "debit", 1, None, 1),
            ("1606", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1611", "未担保余值", "asset", "debit", 1, None, 1),
            ("1621", "生产性生物资产", "asset", "debit", 1, None, 1),
            (
                "1622",
                "生产性生物资产累计折旧",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1631", "油气资产", "asset", "debit", 1, None, 1),
            ("1632", "累计折耗", "asset", "credit", 1, None, 1),
            ("1701", "无形资产", "asset", "debit", 1, None, 1),
            ("1702", "累计摊销", "asset", "credit", 1, None, 1),
            ("1703", "无形资产减值准备", "asset", "credit", 1, None, 1),
            ("1704", "使用权资产", "asset", "debit", 1, None, 1),
            ("1705", "使用权资产累计折旧", "asset", "credit", 1, None, 1),
            ("1706", "使用权资产减值准备", "asset", "credit", 1, None, 1),
            ("1711", "商誉", "asset", "debit", 1, None, 1),
            ("1801", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1811", "递延所得税资产", "asset", "debit", 1, None, 1),
            (
                "1902",
                "一年内到期的非流动资产",
                "asset",
                "debit",
                1,
                None,
                1,
            ),
            ("1903", "其他流动资产", "asset", "debit", 1, None, 1),
            ("1904", "其他非流动资产", "asset", "debit", 1, None, 1),
            ("1901", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2002", "存入保证金", "liability", "credit", 1, None, 1),
            ("2101", "交易性金融负债", "liability", "credit", 1, None, 1),
            ("2111", "衍生金融负债", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 0),
            (
                "220201",
                "应付账款-供应商",
                "liability",
                "credit",
                2,
                Some("2202"),
                1,
            ),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2204", "合同负债", "liability", "credit", 1, None, 1),
            ("2211", "应付职工薪酬", "liability", "credit", 1, None, 0),
            ("221101", "工资", "liability", "credit", 2, Some("2211"), 1),
            (
                "221102",
                "社会保险费",
                "liability",
                "credit",
                2,
                Some("2211"),
                1,
            ),
            (
                "221103",
                "住房公积金",
                "liability",
                "credit",
                2,
                Some("2211"),
                1,
            ),
            (
                "221104",
                "职工福利费",
                "liability",
                "credit",
                2,
                Some("2211"),
                1,
            ),
            ("2221", "应交税费", "liability", "credit", 1, None, 0),
            (
                "222101",
                "应交增值税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222102",
                "应交所得税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222103",
                "应交城市维护建设税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222104",
                "应交教育费附加",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222105",
                "应交房产税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            (
                "222106",
                "应交车船使用税",
                "liability",
                "credit",
                2,
                Some("2221"),
                1,
            ),
            ("2231", "应付利息", "liability", "credit", 1, None, 1),
            ("2232", "应付股利", "liability", "credit", 1, None, 1),
            ("2241", "其他应付款", "liability", "credit", 1, None, 1),
            ("2242", "持有待售负债", "liability", "credit", 1, None, 1),
            (
                "2243",
                "一年内到期的非流动负债",
                "liability",
                "credit",
                1,
                None,
                1,
            ),
            ("2314", "代理业务负债", "liability", "credit", 1, None, 1),
            ("2401", "递延收益", "liability", "credit", 1, None, 1),
            ("2491", "其他流动负债", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "应付债券", "liability", "credit", 1, None, 1),
            (
                "2601",
                "未到期责任准备金",
                "liability",
                "credit",
                1,
                None,
                1,
            ),
            ("2701", "长期应付款", "liability", "credit", 1, None, 1),
            ("2702", "未确认融资费用", "liability", "debit", 1, None, 1),
            ("2703", "租赁负债", "liability", "credit", 1, None, 1),
            ("2711", "专项应付款", "liability", "credit", 1, None, 1),
            ("2801", "预计负债", "liability", "credit", 1, None, 1),
            ("2901", "递延所得税负债", "liability", "credit", 1, None, 1),
            ("2902", "其他非流动负债", "liability", "credit", 1, None, 1),
            // === 共同类 ===
            ("3001", "清算资金往来", "equity", "debit", 1, None, 1),
            ("3002", "货币兑换", "equity", "debit", 1, None, 1),
            ("3101", "衍生工具", "equity", "debit", 1, None, 1),
            ("3201", "套期工具", "equity", "debit", 1, None, 1),
            ("3202", "被套期项目", "equity", "debit", 1, None, 1),
            // === 权益类 ===
            ("4001", "实收资本", "equity", "credit", 1, None, 1),
            ("4002", "资本公积", "equity", "credit", 1, None, 0),
            ("400201", "资本溢价", "equity", "credit", 2, Some("4002"), 1),
            ("400202", "股本溢价", "equity", "credit", 2, Some("4002"), 1),
            ("4003", "其他综合收益", "equity", "credit", 1, None, 0),
            (
                "400301",
                "重新计量设定受益计划变动额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400302",
                "权益法下不能转损益的其他综合收益",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400303",
                "其他权益工具投资公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400304",
                "企业自身信用风险公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400305",
                "权益法下可转损益的其他综合收益",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400306",
                "其他债权投资公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400307",
                "金融资产重分类计入其他综合收益的金额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400308",
                "其他债权投资信用减值准备",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400309",
                "现金流量套期储备",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400310",
                "外币财务报表折算差额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            ("4101", "盈余公积", "equity", "credit", 1, None, 0),
            (
                "410101",
                "法定盈余公积",
                "equity",
                "credit",
                2,
                Some("4101"),
                1,
            ),
            (
                "410102",
                "任意盈余公积",
                "equity",
                "credit",
                2,
                Some("4101"),
                1,
            ),
            ("4103", "本年利润", "equity", "credit", 1, None, 1),
            ("4104", "利润分配", "equity", "credit", 1, None, 0),
            (
                "410401",
                "未分配利润",
                "equity",
                "credit",
                2,
                Some("4104"),
                1,
            ),
            (
                "410402",
                "提取法定盈余公积",
                "equity",
                "credit",
                2,
                Some("4104"),
                1,
            ),
            ("4201", "库存股", "equity", "debit", 1, None, 1),
            ("4301", "专项储备", "equity", "credit", 1, None, 1),
            ("4401", "其他权益工具", "equity", "credit", 1, None, 0),
            ("440101", "优先股", "equity", "credit", 2, Some("4401"), 1),
            ("440102", "永续债", "equity", "credit", 2, Some("4401"), 1),
            // === 成本类 ===
            ("5001", "生产成本", "cost", "debit", 1, None, 0),
            (
                "500101",
                "基本生产成本",
                "cost",
                "debit",
                2,
                Some("5001"),
                1,
            ),
            (
                "500102",
                "辅助生产成本",
                "cost",
                "debit",
                2,
                Some("5001"),
                1,
            ),
            ("5101", "制造费用", "cost", "debit", 1, None, 1),
            ("5201", "劳务成本", "cost", "debit", 1, None, 1),
            ("5301", "研发支出", "cost", "debit", 1, None, 1),
            ("5401", "工程施工", "cost", "debit", 1, None, 1),
            ("5402", "工程结算", "cost", "credit", 1, None, 1),
            ("5403", "机械作业", "cost", "debit", 1, None, 1),
            // === 损益类-收入 ===
            ("6001", "主营业务收入", "income", "credit", 1, None, 1),
            ("6011", "利息收入", "income", "credit", 1, None, 1),
            ("6021", "手续费及佣金收入", "income", "credit", 1, None, 1),
            ("6041", "租赁收入", "income", "credit", 1, None, 1),
            ("6051", "其他业务收入", "income", "credit", 1, None, 1),
            ("6061", "汇兑损益", "income", "credit", 1, None, 1),
            ("6101", "公允价值变动损益", "income", "credit", 1, None, 1),
            ("6111", "投资收益", "income", "credit", 1, None, 0),
            (
                "611101",
                "对联营企业和合营企业的投资收益",
                "income",
                "credit",
                2,
                Some("6111"),
                1,
            ),
            (
                "611102",
                "以摊余成本计量的金融资产终止确认收益",
                "income",
                "credit",
                2,
                Some("6111"),
                1,
            ),
            ("6113", "净敞口套期收益", "income", "credit", 1, None, 1),
            ("6115", "资产处置收益", "income", "credit", 1, None, 1),
            ("6117", "其他收益", "income", "credit", 1, None, 1),
            ("6201", "摊回保险责任准备金", "income", "credit", 1, None, 1),
            ("6301", "营业外收入", "income", "credit", 1, None, 0),
            (
                "630101",
                "非流动资产处置利得",
                "income",
                "credit",
                2,
                Some("6301"),
                1,
            ),
            (
                "630102",
                "政府补助利得",
                "income",
                "credit",
                2,
                Some("6301"),
                1,
            ),
            ("630103", "捐赠利得", "income", "credit", 2, Some("6301"), 1),
            // === 损益类-费用 ===
            ("6401", "主营业务成本", "expense", "debit", 1, None, 1),
            ("6402", "其他业务成本", "expense", "debit", 1, None, 1),
            ("6403", "税金及附加", "expense", "debit", 1, None, 1),
            ("6411", "利息支出", "expense", "debit", 1, None, 1),
            ("6421", "手续费及佣金支出", "expense", "debit", 1, None, 1),
            (
                "6501",
                "提取未到期责任准备金",
                "expense",
                "debit",
                1,
                None,
                1,
            ),
            ("6511", "提取保险责任准备金", "expense", "debit", 1, None, 1),
            ("6521", "保单红利支出", "expense", "debit", 1, None, 1),
            ("6531", "退保金", "expense", "debit", 1, None, 1),
            ("6541", "赔付支出", "expense", "debit", 1, None, 1),
            ("6542", "分出保费", "expense", "debit", 1, None, 1),
            ("6601", "销售费用", "expense", "debit", 1, None, 0),
            ("660101", "广告费", "expense", "debit", 2, Some("6601"), 1),
            ("660102", "运输费", "expense", "debit", 2, Some("6601"), 1),
            (
                "660103",
                "业务招待费",
                "expense",
                "debit",
                2,
                Some("6601"),
                1,
            ),
            ("6602", "管理费用", "expense", "debit", 1, None, 0),
            ("660201", "办公费", "expense", "debit", 2, Some("6602"), 1),
            ("660202", "差旅费", "expense", "debit", 2, Some("6602"), 1),
            ("660203", "折旧费", "expense", "debit", 2, Some("6602"), 1),
            (
                "660204",
                "管理人员薪酬",
                "expense",
                "debit",
                2,
                Some("6602"),
                1,
            ),
            (
                "660205",
                "无形资产摊销",
                "expense",
                "debit",
                2,
                Some("6602"),
                1,
            ),
            ("660206", "研发费用", "expense", "debit", 2, Some("6602"), 1),
            ("6603", "财务费用", "expense", "debit", 1, None, 0),
            ("660301", "利息支出", "expense", "debit", 2, Some("6603"), 1),
            ("660302", "手续费", "expense", "debit", 2, Some("6603"), 1),
            ("660303", "汇兑损失", "expense", "debit", 2, Some("6603"), 1),
            (
                "660304",
                "利息收入",
                "expense",
                "credit",
                2,
                Some("6603"),
                1,
            ),
            ("6701", "资产减值损失", "expense", "debit", 1, None, 1),
            ("6702", "信用减值损失", "expense", "debit", 1, None, 1),
            ("6711", "营业外支出", "expense", "debit", 1, None, 0),
            (
                "671101",
                "非流动资产处置损失",
                "expense",
                "debit",
                2,
                Some("6711"),
                1,
            ),
            (
                "671102",
                "公益性捐赠支出",
                "expense",
                "debit",
                2,
                Some("6711"),
                1,
            ),
            ("6801", "所得税费用", "expense", "debit", 1, None, 1),
            ("6901", "以前年度损益调整", "expense", "debit", 1, None, 1),
        ]
    }

    fn non_profit_account_codes() -> Vec<AccountCodeSeed> {
        vec![
            // === 资产类 (民间非营利组织) ===
            ("1001", "现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1009", "其他货币资金", "asset", "debit", 1, None, 1),
            ("1101", "短期投资", "asset", "debit", 1, None, 1),
            ("1102", "短期投资跌价准备", "asset", "credit", 1, None, 1),
            ("1111", "应收票据", "asset", "debit", 1, None, 1),
            ("1121", "应收账款", "asset", "debit", 1, None, 1),
            ("1122", "其他应收款", "asset", "debit", 1, None, 1),
            ("1131", "坏账准备", "asset", "credit", 1, None, 1),
            ("1141", "预付账款", "asset", "debit", 1, None, 1),
            ("1201", "存货", "asset", "debit", 1, None, 1),
            ("1202", "存货跌价准备", "asset", "credit", 1, None, 1),
            ("1301", "待摊费用", "asset", "debit", 1, None, 1),
            ("1401", "长期股权投资", "asset", "debit", 1, None, 1),
            ("1402", "长期债权投资", "asset", "debit", 1, None, 1),
            ("1403", "其他长期投资", "asset", "debit", 1, None, 1),
            ("1421", "长期投资减值准备", "asset", "credit", 1, None, 1),
            ("1501", "固定资产", "asset", "debit", 1, None, 1),
            ("1502", "累计折旧", "asset", "credit", 1, None, 1),
            ("1505", "在建工程", "asset", "debit", 1, None, 1),
            ("1506", "文物资源", "asset", "debit", 1, None, 1),
            ("1509", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1601", "无形资产", "asset", "debit", 1, None, 1),
            ("1602", "累计摊销", "asset", "credit", 1, None, 1),
            ("1701", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1801", "受托代理资产", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2101", "短期借款", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 1),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2204", "应付职工薪酬", "liability", "credit", 1, None, 1),
            ("2206", "应交税费", "liability", "credit", 1, None, 1),
            ("2209", "其他应付款", "liability", "credit", 1, None, 1),
            ("2301", "预提费用", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "长期应付款", "liability", "credit", 1, None, 1),
            ("2503", "预计负债", "liability", "credit", 1, None, 1),
            ("2601", "受托代理负债", "liability", "credit", 1, None, 1),
            // === 净资产类 ===
            ("3101", "非限定性净资产", "equity", "credit", 1, None, 1),
            ("3102", "限定性净资产", "equity", "credit", 1, None, 1),
            ("3201", "以前年度净资产调整", "equity", "credit", 1, None, 1),
            // === 收入类 ===
            ("4101", "捐赠收入", "income", "credit", 1, None, 1),
            ("4201", "会费收入", "income", "credit", 1, None, 1),
            ("4301", "提供服务收入", "income", "credit", 1, None, 1),
            ("4401", "政府补助收入", "income", "credit", 1, None, 1),
            ("4501", "商品销售收入", "income", "credit", 1, None, 1),
            ("4601", "投资收益", "income", "credit", 1, None, 1),
            ("4701", "总部拨款收入", "income", "credit", 1, None, 1),
            ("4901", "其他收入", "income", "credit", 1, None, 1),
            // === 费用类 ===
            ("5101", "业务活动成本", "expense", "debit", 1, None, 1),
            ("5201", "税金及附加", "expense", "debit", 1, None, 1),
            ("5301", "管理费用", "expense", "debit", 1, None, 1),
            ("5401", "筹资费用", "expense", "debit", 1, None, 1),
            ("5501", "资产减值损失", "expense", "debit", 1, None, 1),
            ("5601", "所得税费用", "expense", "debit", 1, None, 1),
            ("5901", "其他费用", "expense", "debit", 1, None, 1),
        ]
    }

    fn cooperative_account_codes() -> Vec<AccountCodeSeed> {
        vec![
            // 财会〔2021〕37 号，自 2023-01-01 起施行。
            // === 资产类 ===
            ("101", "库存现金", "asset", "debit", 1, None, 1),
            ("102", "银行存款", "asset", "debit", 1, None, 1),
            ("113", "应收款", "asset", "debit", 1, None, 1),
            ("114", "成员往来", "asset", "debit", 1, None, 1),
            ("121", "产品物资", "asset", "debit", 1, None, 1),
            ("124", "委托加工物资", "asset", "debit", 1, None, 1),
            ("125", "委托代销商品", "asset", "debit", 1, None, 1),
            ("127", "受托代购商品", "asset", "debit", 1, None, 1),
            ("128", "受托代销商品", "asset", "debit", 1, None, 1),
            ("131", "对外投资", "asset", "debit", 1, None, 1),
            ("141", "消耗性生物资产", "asset", "debit", 1, None, 1),
            ("142", "生产性生物资产", "asset", "debit", 1, None, 1),
            (
                "143",
                "生产性生物资产累计折旧",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("144", "公益性生物资产", "asset", "debit", 1, None, 1),
            ("151", "固定资产", "asset", "debit", 1, None, 1),
            ("152", "累计折旧", "asset", "credit", 1, None, 1),
            ("153", "在建工程", "asset", "debit", 1, None, 1),
            ("154", "固定资产清理", "asset", "debit", 1, None, 1),
            ("161", "无形资产", "asset", "debit", 1, None, 1),
            ("162", "累计摊销", "asset", "credit", 1, None, 1),
            ("171", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("181", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("201", "短期借款", "liability", "credit", 1, None, 1),
            ("211", "应付款", "liability", "credit", 1, None, 1),
            ("212", "应付工资", "liability", "credit", 1, None, 1),
            ("213", "应付劳务费", "liability", "credit", 1, None, 1),
            ("214", "应交税费", "liability", "credit", 1, None, 1),
            ("215", "应付利息", "liability", "credit", 1, None, 1),
            ("221", "应付盈余返还", "liability", "credit", 1, None, 1),
            ("222", "应付剩余盈余", "liability", "credit", 1, None, 1),
            ("231", "长期借款", "liability", "credit", 1, None, 1),
            ("235", "专项应付款", "liability", "credit", 1, None, 1),
            // === 所有者权益类 ===
            ("301", "股金", "equity", "credit", 1, None, 1),
            ("311", "专项基金", "equity", "credit", 1, None, 1),
            ("321", "资本公积", "equity", "credit", 1, None, 1),
            ("322", "盈余公积", "equity", "credit", 1, None, 1),
            ("331", "本年盈余", "equity", "credit", 1, None, 1),
            ("332", "盈余分配", "equity", "credit", 1, None, 0),
            ("3321", "各项分配", "equity", "debit", 2, Some("332"), 0),
            (
                "332101",
                "提取盈余公积",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            ("332102", "盈余返还", "equity", "debit", 3, Some("3321"), 1),
            (
                "332103",
                "剩余盈余分配",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            (
                "332104",
                "转为成员出资",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            ("3322", "未分配盈余", "equity", "credit", 2, Some("332"), 1),
            // === 成本类 ===
            ("401", "生产成本", "cost", "debit", 1, None, 1),
            // === 收入类 ===
            ("501", "经营收入", "income", "credit", 1, None, 1),
            ("502", "其他收入", "income", "credit", 1, None, 1),
            ("511", "投资收益", "income", "credit", 1, None, 1),
            // === 支出（费用）类 ===
            ("521", "经营支出", "expense", "debit", 1, None, 1),
            ("522", "税金及附加", "expense", "debit", 1, None, 1),
            ("523", "管理费用", "expense", "debit", 1, None, 1),
            ("524", "财务费用", "expense", "debit", 1, None, 1),
            ("529", "其他支出", "expense", "debit", 1, None, 1),
            ("531", "所得税费用", "expense", "debit", 1, None, 1),
        ]
    }

    #[allow(clippy::too_many_arguments)]
    async fn insert_standard_report_template(
        pool: &DbPool,
        template_code: &str,
        template_name: &str,
        report_type: &str,
        accounting_system: &str,
        form_code: Option<&str>,
        reporting_frequency: &str,
        is_statutory: i32,
        items: &[StandardReportItemSeed],
    ) -> Result<(), DbError> {
        let existing_id: Option<String> =
            sqlx::query_scalar("SELECT id FROM report_templates WHERE template_code = ?")
                .bind(template_code)
                .fetch_optional(pool)
                .await?;
        if existing_id.is_some() {
            return Ok(());
        }

        let template_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO report_templates (
                   id, template_code, template_name, report_type, accounting_system,
                   form_code, reporting_frequency, is_statutory, is_system
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"#,
        )
        .bind(&template_id)
        .bind(template_code)
        .bind(template_name)
        .bind(report_type)
        .bind(accounting_system)
        .bind(form_code)
        .bind(reporting_frequency)
        .bind(is_statutory)
        .execute(pool)
        .await?;

        for (item_code, item_name, level, sort_order, is_total, formula, line_number) in items {
            let calculation_sign = default_report_calculation_sign(report_type, item_name);
            sqlx::query(
                r#"INSERT INTO report_items (
                       id, template_id, item_code, item_name, item_level, sort_order,
                       is_total, formula, line_number, calculation_sign
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&template_id)
            .bind(item_code)
            .bind(item_name)
            .bind(level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .bind(line_number)
            .bind(calculation_sign)
            .execute(pool)
            .await?;
        }

        Ok(())
    }

    async fn replace_system_report_items(
        pool: &DbPool,
        template_code: &str,
        report_type: &str,
        items: &[StandardReportItemSeed],
    ) -> Result<(), DbError> {
        let template_id: String = sqlx::query_scalar(
            "SELECT id FROM report_templates WHERE template_code = ? AND is_system = 1",
        )
        .bind(template_code)
        .fetch_one(pool)
        .await?;
        let mut transaction = pool.begin().await?;
        sqlx::query("DELETE FROM report_items WHERE template_id = ?")
            .bind(&template_id)
            .execute(&mut *transaction)
            .await?;
        for (item_code, item_name, level, sort_order, is_total, formula, line_number) in items {
            sqlx::query(
                r#"INSERT INTO report_items (
                       id, template_id, item_code, item_name, item_level, sort_order,
                       is_total, formula, line_number, calculation_sign
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&template_id)
            .bind(item_code)
            .bind(item_name)
            .bind(level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .bind(line_number)
            .bind(default_report_calculation_sign(report_type, item_name))
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    async fn normalize_enterprise_2019_reporting(pool: &DbPool) -> Result<(), DbError> {
        let account_seeds: Vec<AccountCodeSeed> = vec![
            ("1111", "衍生金融资产", "asset", "debit", 1, None, 1),
            ("1124", "合同资产", "asset", "debit", 1, None, 1),
            ("1125", "应收款项融资", "asset", "debit", 1, None, 1),
            ("1481", "合同履约成本", "asset", "debit", 1, None, 1),
            ("1482", "合同取得成本", "asset", "debit", 1, None, 1),
            ("1483", "合同资产减值准备", "asset", "credit", 1, None, 1),
            (
                "1484",
                "合同履约成本减值准备",
                "asset",
                "credit",
                1,
                None,
                1,
            ),
            ("1485", "持有待售资产", "asset", "debit", 1, None, 1),
            ("1486", "应收退货成本", "asset", "debit", 1, None, 1),
            ("1506", "债权投资", "asset", "debit", 1, None, 1),
            ("1507", "其他债权投资", "asset", "debit", 1, None, 1),
            ("1508", "其他权益工具投资", "asset", "debit", 1, None, 1),
            ("1509", "其他非流动金融资产", "asset", "debit", 1, None, 1),
            ("1704", "使用权资产", "asset", "debit", 1, None, 1),
            ("1705", "使用权资产累计折旧", "asset", "credit", 1, None, 1),
            ("1706", "使用权资产减值准备", "asset", "credit", 1, None, 1),
            (
                "1902",
                "一年内到期的非流动资产",
                "asset",
                "debit",
                1,
                None,
                1,
            ),
            ("1903", "其他流动资产", "asset", "debit", 1, None, 1),
            ("1904", "其他非流动资产", "asset", "debit", 1, None, 1),
            ("2111", "衍生金融负债", "liability", "credit", 1, None, 1),
            ("2204", "合同负债", "liability", "credit", 1, None, 1),
            ("2242", "持有待售负债", "liability", "credit", 1, None, 1),
            (
                "2243",
                "一年内到期的非流动负债",
                "liability",
                "credit",
                1,
                None,
                1,
            ),
            ("2491", "其他流动负债", "liability", "credit", 1, None, 1),
            ("2703", "租赁负债", "liability", "credit", 1, None, 1),
            ("2902", "其他非流动负债", "liability", "credit", 1, None, 1),
            ("4003", "其他综合收益", "equity", "credit", 1, None, 0),
            (
                "400301",
                "重新计量设定受益计划变动额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400302",
                "权益法下不能转损益的其他综合收益",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400303",
                "其他权益工具投资公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400304",
                "企业自身信用风险公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400305",
                "权益法下可转损益的其他综合收益",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400306",
                "其他债权投资公允价值变动",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400307",
                "金融资产重分类计入其他综合收益的金额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400308",
                "其他债权投资信用减值准备",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400309",
                "现金流量套期储备",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            (
                "400310",
                "外币财务报表折算差额",
                "equity",
                "credit",
                2,
                Some("4003"),
                1,
            ),
            ("6111", "投资收益", "income", "credit", 1, None, 0),
            (
                "611101",
                "对联营企业和合营企业的投资收益",
                "income",
                "credit",
                2,
                Some("6111"),
                1,
            ),
            (
                "611102",
                "以摊余成本计量的金融资产终止确认收益",
                "income",
                "credit",
                2,
                Some("6111"),
                1,
            ),
            ("6113", "净敞口套期收益", "income", "credit", 1, None, 1),
            ("6115", "资产处置收益", "income", "credit", 1, None, 1),
            ("6117", "其他收益", "income", "credit", 1, None, 1),
            (
                "660304",
                "利息收入",
                "expense",
                "credit",
                2,
                Some("6603"),
                1,
            ),
            ("6702", "信用减值损失", "expense", "debit", 1, None, 1),
        ];
        for (code, name, account_type, normal_balance, level, parent_code, is_detail) in
            account_seeds
        {
            sqlx::query(
                r#"INSERT OR IGNORE INTO account_codes (
                       code, company_id, name, account_type, normal_balance, level, parent_code, is_detail
                   )
                   SELECT ?, id, ?, ?, ?, ?, ?, ?
                   FROM companies WHERE accounting_system = 'enterprise'"#,
            )
            .bind(code)
            .bind(name)
            .bind(account_type)
            .bind(normal_balance)
            .bind(level)
            .bind(parent_code)
            .bind(is_detail)
            .execute(pool)
            .await?;
        }
        sqlx::query(
            r#"UPDATE account_codes SET is_detail = 0
               WHERE code IN ('4003', '6111', '6603')
                 AND company_id IN (
                   SELECT id FROM companies WHERE accounting_system = 'enterprise'
                 )"#,
        )
        .execute(pool)
        .await?;

        let balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("1001+1002+1012"), Some("1")),
            ("BS102", "交易性金融资产", 2, 3, 0, Some("1101"), Some("2")),
            ("BS103", "衍生金融资产", 2, 4, 0, Some("1111"), Some("3")),
            ("BS104", "应收票据", 2, 5, 0, Some("1121"), Some("4")),
            ("BS105", "应收账款", 2, 6, 0, Some("1122-1231"), Some("5")),
            ("BS106", "应收款项融资", 2, 7, 0, Some("1125"), Some("6")),
            ("BS107", "预付款项", 2, 8, 0, Some("1123"), Some("7")),
            ("BS108", "其他应收款", 2, 9, 0, Some("1131+1132+1221"), Some("8")),
            ("BS109", "存货", 2, 10, 0, Some("1401+1402+1403+1404+1405+1406-1407+1408+1411+1421+1481+1482+1486-1471-1484"), Some("9")),
            ("BS110", "合同资产", 2, 11, 0, Some("1124-1483"), Some("10")),
            ("BS111", "持有待售资产", 2, 12, 0, Some("1485"), Some("11")),
            ("BS112", "一年内到期的非流动资产", 2, 13, 0, Some("1902"), Some("12")),
            ("BS113", "其他流动资产", 2, 14, 0, Some("1903"), Some("13")),
            ("BS199", "流动资产合计", 2, 15, 1, Some("1001+1002+1012+1101+1111+1121+1122-1231+1125+1123+1131+1132+1221+1401+1402+1403+1404+1405+1406-1407+1408+1411+1421+1481+1482+1486-1471-1484+1124-1483+1485+1902+1903"), Some("14")),
            ("BS200", "非流动资产", 1, 16, 0, None, None),
            ("BS201", "债权投资", 2, 17, 0, Some("1506+1501-1502"), Some("15")),
            ("BS202", "其他债权投资", 2, 18, 0, Some("1507+1503"), Some("16")),
            ("BS203", "长期应收款", 2, 19, 0, Some("1531"), Some("17")),
            ("BS204", "长期股权投资", 2, 20, 0, Some("1511-1512"), Some("18")),
            ("BS205", "其他权益工具投资", 2, 21, 0, Some("1508"), Some("19")),
            ("BS206", "其他非流动金融资产", 2, 22, 0, Some("1509"), Some("20")),
            ("BS207", "投资性房地产", 2, 23, 0, Some("1521"), Some("21")),
            ("BS208", "固定资产", 2, 24, 0, Some("1601-1602-1603+1606"), Some("22")),
            ("BS209", "在建工程", 2, 25, 0, Some("1604+1605"), Some("23")),
            ("BS210", "生产性生物资产", 2, 26, 0, Some("1621-1622"), Some("24")),
            ("BS211", "油气资产", 2, 27, 0, Some("1631-1632"), Some("25")),
            ("BS212", "使用权资产", 2, 28, 0, Some("1704-1705-1706"), Some("26")),
            ("BS213", "无形资产", 2, 29, 0, Some("1701-1702-1703"), Some("27")),
            ("BS214", "开发支出", 2, 30, 0, Some("5301"), Some("28")),
            ("BS215", "商誉", 2, 31, 0, Some("1711"), Some("29")),
            ("BS216", "长期待摊费用", 2, 32, 0, Some("1801"), Some("30")),
            ("BS217", "递延所得税资产", 2, 33, 0, Some("1811"), Some("31")),
            ("BS218", "其他非流动资产", 2, 34, 0, Some("1904"), Some("32")),
            ("BS299", "非流动资产合计", 2, 35, 1, Some("1506+1501-1502+1507+1503+1531+1511-1512+1508+1509+1521+1601-1602-1603+1606+1604+1605+1621-1622+1631-1632+1704-1705-1706+1701-1702-1703+5301+1711+1801+1811+1904"), Some("33")),
            ("BS999", "资产总计", 1, 36, 1, Some("1001+1002+1012+1101+1111+1121+1122-1231+1125+1123+1131+1132+1221+1401+1402+1403+1404+1405+1406-1407+1408+1411+1421+1481+1482+1486-1471-1484+1124-1483+1485+1902+1903+1506+1501-1502+1507+1503+1531+1511-1512+1508+1509+1521+1601-1602-1603+1606+1604+1605+1621-1622+1631-1632+1704-1705-1706+1701-1702-1703+5301+1711+1801+1811+1904"), Some("34")),
            ("BS300", "流动负债", 1, 37, 0, None, None),
            ("BS301", "短期借款", 2, 38, 0, Some("2001"), Some("35")),
            ("BS302", "交易性金融负债", 2, 39, 0, Some("2101"), Some("36")),
            ("BS303", "衍生金融负债", 2, 40, 0, Some("2111"), Some("37")),
            ("BS304", "应付票据", 2, 41, 0, Some("2201"), Some("38")),
            ("BS305", "应付账款", 2, 42, 0, Some("2202"), Some("39")),
            ("BS306", "预收款项", 2, 43, 0, Some("2203"), Some("40")),
            ("BS307", "合同负债", 2, 44, 0, Some("2204"), Some("41")),
            ("BS308", "应付职工薪酬", 2, 45, 0, Some("2211"), Some("42")),
            ("BS309", "应交税费", 2, 46, 0, Some("2221"), Some("43")),
            ("BS310", "其他应付款", 2, 47, 0, Some("2231+2232+2241"), Some("44")),
            ("BS311", "持有待售负债", 2, 48, 0, Some("2242"), Some("45")),
            ("BS312", "一年内到期的非流动负债", 2, 49, 0, Some("2243"), Some("46")),
            ("BS313", "其他流动负债", 2, 50, 0, Some("2491"), Some("47")),
            ("BS399", "流动负债合计", 2, 51, 1, Some("2001+2101+2111+2201+2202+2203+2204+2211+2221+2231+2232+2241+2242+2243+2491"), Some("48")),
            ("BS400", "非流动负债", 1, 52, 0, None, None),
            ("BS401", "长期借款", 2, 53, 0, Some("2501"), Some("49")),
            ("BS402", "应付债券", 2, 54, 0, Some("2502"), Some("50")),
            ("BS403", "其中：优先股", 3, 55, 0, None, Some("51")),
            ("BS404", "永续债", 3, 56, 0, None, Some("52")),
            ("BS405", "租赁负债", 2, 57, 0, Some("2703"), Some("53")),
            ("BS406", "长期应付款", 2, 58, 0, Some("2701-2702+2711"), Some("54")),
            ("BS407", "预计负债", 2, 59, 0, Some("2801"), Some("55")),
            ("BS408", "递延收益", 2, 60, 0, Some("2401"), Some("56")),
            ("BS409", "递延所得税负债", 2, 61, 0, Some("2901"), Some("57")),
            ("BS410", "其他非流动负债", 2, 62, 0, Some("2902"), Some("58")),
            ("BS499", "非流动负债合计", 2, 63, 1, Some("2501+2502+2703+2701-2702+2711+2801+2401+2901+2902"), Some("59")),
            ("BS599", "负债合计", 1, 64, 1, Some("2001+2101+2111+2201+2202+2203+2204+2211+2221+2231+2232+2241+2242+2243+2491+2501+2502+2703+2701-2702+2711+2801+2401+2901+2902"), Some("60")),
            ("BS600", "所有者权益（或股东权益）", 1, 65, 0, None, None),
            ("BS601", "实收资本（或股本）", 2, 66, 0, Some("4001"), Some("61")),
            ("BS602", "其他权益工具", 2, 67, 0, Some("4401"), Some("62")),
            ("BS603", "其中：优先股", 3, 68, 0, Some("440101"), Some("63")),
            ("BS604", "永续债", 3, 69, 0, Some("440102"), Some("64")),
            ("BS605", "资本公积", 2, 70, 0, Some("4002"), Some("65")),
            ("BS606", "减：库存股", 2, 71, 0, Some("4201"), Some("66")),
            ("BS607", "其他综合收益", 2, 72, 0, Some("4003"), Some("67")),
            ("BS608", "专项储备", 2, 73, 0, Some("4301"), Some("68")),
            ("BS609", "盈余公积", 2, 74, 0, Some("4101"), Some("69")),
            ("BS610", "未分配利润", 2, 75, 0, Some("4103+4104"), Some("70")),
            ("BS699", "所有者权益（或股东权益）合计", 2, 76, 1, Some("4001+4401+4002-4201+4003+4301+4101+4103+4104"), Some("71")),
            ("BS799", "负债和所有者权益（或股东权益）总计", 1, 77, 1, Some("2001+2101+2111+2201+2202+2203+2204+2211+2221+2231+2232+2241+2242+2243+2491+2501+2502+2703+2701-2702+2711+2801+2401+2901+2902+4001+4401+4002-4201+4003+4301+4101+4103+4104"), Some("72")),
        ];

        let income_items: Vec<StandardReportItemSeed> = vec![
            (
                "IS001",
                "一、营业收入",
                1,
                1,
                0,
                Some("6001+6051"),
                Some("1"),
            ),
            (
                "IS002",
                "减：营业成本",
                1,
                2,
                0,
                Some("6401+6402"),
                Some("2"),
            ),
            ("IS003", "税金及附加", 1, 3, 0, Some("6403"), Some("3")),
            ("IS004", "销售费用", 1, 4, 0, Some("6601"), Some("4")),
            ("IS005", "管理费用", 1, 5, 0, Some("6602-660206"), Some("5")),
            ("IS006", "研发费用", 1, 6, 0, Some("660206"), Some("6")),
            ("IS007", "财务费用", 1, 7, 0, Some("6603"), Some("7")),
            (
                "IS008",
                "其中：利息费用",
                2,
                8,
                0,
                Some("660301"),
                Some("8"),
            ),
            (
                "IS009",
                "其中：利息收入",
                2,
                9,
                0,
                Some("660304"),
                Some("9"),
            ),
            ("IS010", "加：其他收益", 1, 10, 0, Some("6117"), Some("10")),
            (
                "IS011",
                "投资收益（损失以“-”号填列）",
                1,
                11,
                0,
                Some("6111"),
                Some("11"),
            ),
            (
                "IS012",
                "其中：对联营企业和合营企业的投资收益",
                2,
                12,
                0,
                Some("611101"),
                Some("12"),
            ),
            (
                "IS013",
                "其中：以摊余成本计量的金融资产终止确认收益（损失以“-”号填列）",
                2,
                13,
                0,
                Some("611102"),
                Some("13"),
            ),
            (
                "IS014",
                "净敞口套期收益（损失以“-”号填列）",
                1,
                14,
                0,
                Some("6113"),
                Some("14"),
            ),
            (
                "IS015",
                "公允价值变动收益（损失以“-”号填列）",
                1,
                15,
                0,
                Some("6101"),
                Some("15"),
            ),
            (
                "IS016",
                "信用减值损失（损失以“-”号填列）",
                1,
                16,
                0,
                Some("6702"),
                Some("16"),
            ),
            (
                "IS017",
                "资产减值损失（损失以“-”号填列）",
                1,
                17,
                0,
                Some("6701"),
                Some("17"),
            ),
            (
                "IS018",
                "资产处置收益（损失以“-”号填列）",
                1,
                18,
                0,
                Some("6115"),
                Some("18"),
            ),
            (
                "IS019",
                "二、营业利润（亏损以“-”号填列）",
                1,
                19,
                1,
                None,
                Some("19"),
            ),
            (
                "IS020",
                "加：营业外收入",
                1,
                20,
                0,
                Some("6301"),
                Some("20"),
            ),
            (
                "IS021",
                "减：营业外支出",
                1,
                21,
                0,
                Some("6711"),
                Some("21"),
            ),
            (
                "IS022",
                "三、利润总额（亏损总额以“-”号填列）",
                1,
                22,
                1,
                None,
                Some("22"),
            ),
            (
                "IS023",
                "减：所得税费用",
                1,
                23,
                0,
                Some("6801"),
                Some("23"),
            ),
            (
                "IS024",
                "四、净利润（净亏损以“-”号填列）",
                1,
                24,
                1,
                None,
                Some("24"),
            ),
            (
                "IS025",
                "（一）持续经营净利润（净亏损以“-”号填列）",
                2,
                25,
                0,
                None,
                Some("25"),
            ),
            (
                "IS026",
                "（二）终止经营净利润（净亏损以“-”号填列）",
                2,
                26,
                0,
                None,
                Some("26"),
            ),
            (
                "IS027",
                "五、其他综合收益的税后净额",
                1,
                27,
                0,
                Some("4003"),
                Some("27"),
            ),
            (
                "IS028",
                "（一）不能重分类进损益的其他综合收益",
                2,
                28,
                0,
                None,
                Some("28"),
            ),
            (
                "IS029",
                "1．重新计量设定受益计划变动额",
                3,
                29,
                0,
                Some("400301"),
                Some("29"),
            ),
            (
                "IS030",
                "2．权益法下不能转损益的其他综合收益",
                3,
                30,
                0,
                Some("400302"),
                Some("30"),
            ),
            (
                "IS031",
                "3．其他权益工具投资公允价值变动",
                3,
                31,
                0,
                Some("400303"),
                Some("31"),
            ),
            (
                "IS032",
                "4．企业自身信用风险公允价值变动",
                3,
                32,
                0,
                Some("400304"),
                Some("32"),
            ),
            (
                "IS033",
                "（二）将重分类进损益的其他综合收益",
                2,
                33,
                0,
                None,
                Some("33"),
            ),
            (
                "IS034",
                "1．权益法下可转损益的其他综合收益",
                3,
                34,
                0,
                Some("400305"),
                Some("34"),
            ),
            (
                "IS035",
                "2．其他债权投资公允价值变动",
                3,
                35,
                0,
                Some("400306"),
                Some("35"),
            ),
            (
                "IS036",
                "3．金融资产重分类计入其他综合收益的金额",
                3,
                36,
                0,
                Some("400307"),
                Some("36"),
            ),
            (
                "IS037",
                "4．其他债权投资信用减值准备",
                3,
                37,
                0,
                Some("400308"),
                Some("37"),
            ),
            (
                "IS038",
                "5．现金流量套期储备",
                3,
                38,
                0,
                Some("400309"),
                Some("38"),
            ),
            (
                "IS039",
                "6．外币财务报表折算差额",
                3,
                39,
                0,
                Some("400310"),
                Some("39"),
            ),
            ("IS040", "六、综合收益总额", 1, 40, 1, None, Some("40")),
            ("IS041", "七、每股收益", 1, 41, 0, None, Some("41")),
            ("IS042", "（一）基本每股收益", 2, 42, 0, None, Some("42")),
            ("IS043", "（二）稀释每股收益", 2, 43, 0, None, Some("43")),
        ];

        Self::replace_system_report_items(
            pool,
            "ENTERPRISE_BALANCE_SHEET",
            "balance_sheet",
            &balance_items,
        )
        .await?;
        Self::replace_system_report_items(
            pool,
            "ENTERPRISE_INCOME_STATEMENT",
            "income_statement",
            &income_items,
        )
        .await?;
        Ok(())
    }

    async fn normalize_small_enterprise_2013_reporting(pool: &DbPool) -> Result<(), DbError> {
        let account_seeds: Vec<AccountCodeSeed> = vec![
            ("540301", "消费税", "expense", "debit", 2, Some("5403"), 1),
            ("540302", "营业税", "expense", "debit", 2, Some("5403"), 1),
            (
                "540303",
                "城市维护建设税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            ("540304", "资源税", "expense", "debit", 2, Some("5403"), 1),
            (
                "540305",
                "土地增值税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            (
                "540306",
                "城镇土地使用税、房产税、车船税、印花税",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            (
                "540307",
                "教育费附加、矿产资源补偿费、排污费",
                "expense",
                "debit",
                2,
                Some("5403"),
                1,
            ),
            (
                "560104",
                "商品维修费",
                "expense",
                "debit",
                2,
                Some("5601"),
                1,
            ),
            ("560206", "开办费", "expense", "debit", 2, Some("5602"), 1),
            (
                "560207",
                "业务招待费",
                "expense",
                "debit",
                2,
                Some("5602"),
                1,
            ),
            ("560208", "研究费用", "expense", "debit", 2, Some("5602"), 1),
            (
                "560303",
                "利息收入",
                "expense",
                "credit",
                2,
                Some("5603"),
                1,
            ),
            ("571103", "坏账损失", "expense", "debit", 2, Some("5711"), 1),
            (
                "571104",
                "无法收回的长期债券投资损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571105",
                "无法收回的长期股权投资损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571106",
                "自然灾害等不可抗力因素造成的损失",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
            (
                "571107",
                "税收滞纳金",
                "expense",
                "debit",
                2,
                Some("5711"),
                1,
            ),
        ];
        for (code, name, account_type, normal_balance, level, parent_code, is_detail) in
            account_seeds
        {
            sqlx::query(
                r#"INSERT OR IGNORE INTO account_codes (
                       code, company_id, name, account_type, normal_balance, level, parent_code, is_detail
                   )
                   SELECT ?, id, ?, ?, ?, ?, ?, ?
                   FROM companies WHERE accounting_system = 'small_enterprise'"#,
            )
            .bind(code)
            .bind(name)
            .bind(account_type)
            .bind(normal_balance)
            .bind(level)
            .bind(parent_code)
            .bind(is_detail)
            .execute(pool)
            .await?;
        }
        sqlx::query(
            r#"UPDATE account_codes SET is_detail = 0
               WHERE code IN ('5403', '5601', '5602', '5603', '5711')
                 AND company_id IN (
                   SELECT id FROM companies WHERE accounting_system = 'small_enterprise'
                 )"#,
        )
        .execute(pool)
        .await?;
        sqlx::query(
            r#"UPDATE account_codes SET name = '广告费和业务宣传费'
               WHERE code = '560101' AND name = '广告费'
                 AND company_id IN (
                   SELECT id FROM companies WHERE accounting_system = 'small_enterprise'
                 )"#,
        )
        .execute(pool)
        .await?;

        let balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("1001+1002+1012"), Some("1")),
            ("BS102", "短期投资", 2, 3, 0, Some("1101"), Some("2")),
            ("BS103", "应收票据", 2, 4, 0, Some("1121"), Some("3")),
            ("BS104", "应收账款", 2, 5, 0, Some("1122"), Some("4")),
            ("BS105", "预付账款", 2, 6, 0, Some("1123"), Some("5")),
            ("BS106", "应收股利", 2, 7, 0, Some("1131"), Some("6")),
            ("BS107", "应收利息", 2, 8, 0, Some("1132"), Some("7")),
            ("BS108", "其他应收款", 2, 9, 0, Some("1221"), Some("8")),
            ("BS109", "存货", 2, 10, 0, Some("1401+1402+1403+1404+1405-1407+1408+1411+4001"), Some("9")),
            ("BS110", "其中：原材料", 3, 11, 0, Some("1403"), Some("10")),
            ("BS111", "在产品", 3, 12, 0, Some("4001"), Some("11")),
            ("BS112", "库存商品", 3, 13, 0, Some("1405"), Some("12")),
            ("BS113", "周转材料", 3, 14, 0, Some("1411"), Some("13")),
            ("BS114", "其他流动资产", 2, 15, 0, Some("1421"), Some("14")),
            ("BS199", "流动资产合计", 2, 16, 1, Some("1001+1002+1012+1101+1121+1122+1123+1131+1132+1221+1401+1402+1403+1404+1405-1407+1408+1411+4001+1421"), Some("15")),
            ("BS200", "非流动资产", 1, 17, 0, None, None),
            ("BS201", "长期债券投资", 2, 18, 0, Some("1501"), Some("16")),
            ("BS202", "长期股权投资", 2, 19, 0, Some("1511"), Some("17")),
            ("BS203", "固定资产原价", 2, 20, 0, Some("1601"), Some("18")),
            ("BS204", "减：累计折旧", 2, 21, 0, Some("1602"), Some("19")),
            ("BS205", "固定资产账面价值", 2, 22, 0, Some("1601-1602"), Some("20")),
            ("BS206", "在建工程", 2, 23, 0, Some("1604"), Some("21")),
            ("BS207", "工程物资", 2, 24, 0, Some("1605"), Some("22")),
            ("BS208", "固定资产清理", 2, 25, 0, Some("1606"), Some("23")),
            ("BS209", "生产性生物资产", 2, 26, 0, Some("1621-1622"), Some("24")),
            ("BS210", "无形资产", 2, 27, 0, Some("1701-1702"), Some("25")),
            ("BS211", "开发支出", 2, 28, 0, Some("4301"), Some("26")),
            ("BS212", "长期待摊费用", 2, 29, 0, Some("1801"), Some("27")),
            ("BS213", "其他非流动资产", 2, 30, 0, None, Some("28")),
            ("BS299", "非流动资产合计", 2, 31, 1, Some("1501+1511+1601-1602+1604+1605+1606+1621-1622+1701-1702+4301+1801"), Some("29")),
            ("BS999", "资产总计", 1, 32, 1, Some("1001+1002+1012+1101+1121+1122+1123+1131+1132+1221+1401+1402+1403+1404+1405-1407+1408+1411+4001+1421+1501+1511+1601-1602+1604+1605+1606+1621-1622+1701-1702+4301+1801"), Some("30")),
            ("BS300", "流动负债", 1, 33, 0, None, None),
            ("BS301", "短期借款", 2, 34, 0, Some("2001"), Some("31")),
            ("BS302", "应付票据", 2, 35, 0, Some("2201"), Some("32")),
            ("BS303", "应付账款", 2, 36, 0, Some("2202"), Some("33")),
            ("BS304", "预收账款", 2, 37, 0, Some("2203"), Some("34")),
            ("BS305", "应付职工薪酬", 2, 38, 0, Some("2211"), Some("35")),
            ("BS306", "应交税费", 2, 39, 0, Some("2221"), Some("36")),
            ("BS307", "应付利息", 2, 40, 0, Some("2231"), Some("37")),
            ("BS308", "应付利润", 2, 41, 0, Some("2232"), Some("38")),
            ("BS309", "其他应付款", 2, 42, 0, Some("2241"), Some("39")),
            ("BS310", "其他流动负债", 2, 43, 0, None, Some("40")),
            ("BS399", "流动负债合计", 2, 44, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241"), Some("41")),
            ("BS400", "非流动负债", 1, 45, 0, None, None),
            ("BS401", "长期借款", 2, 46, 0, Some("2501"), Some("42")),
            ("BS402", "长期应付款", 2, 47, 0, Some("2701"), Some("43")),
            ("BS403", "递延收益", 2, 48, 0, Some("2401"), Some("44")),
            ("BS404", "其他非流动负债", 2, 49, 0, None, Some("45")),
            ("BS499", "非流动负债合计", 2, 50, 1, Some("2401+2501+2701"), Some("46")),
            ("BS599", "负债合计", 1, 51, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241+2401+2501+2701"), Some("47")),
            ("BS600", "所有者权益（或股东权益）", 1, 52, 0, None, None),
            ("BS601", "实收资本（或股本）", 2, 53, 0, Some("3001"), Some("48")),
            ("BS602", "资本公积", 2, 54, 0, Some("3002"), Some("49")),
            ("BS603", "盈余公积", 2, 55, 0, Some("3101"), Some("50")),
            ("BS604", "未分配利润", 2, 56, 0, Some("3103+3104"), Some("51")),
            ("BS699", "所有者权益（或股东权益）合计", 2, 57, 1, Some("3001+3002+3101+3103+3104"), Some("52")),
            ("BS799", "负债和所有者权益（或股东权益）总计", 1, 58, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241+2401+2501+2701+3001+3002+3101+3103+3104"), Some("53")),
        ];

        let income_items: Vec<StandardReportItemSeed> = vec![
            (
                "IS001",
                "一、营业收入",
                1,
                1,
                0,
                Some("5001+5051"),
                Some("1"),
            ),
            (
                "IS002",
                "减：营业成本",
                1,
                2,
                0,
                Some("5401+5402"),
                Some("2"),
            ),
            ("IS003", "营业税金及附加", 1, 3, 0, Some("5403"), Some("3")),
            (
                "IS00301",
                "其中：消费税",
                2,
                4,
                0,
                Some("540301"),
                Some("4"),
            ),
            ("IS00302", "营业税", 2, 5, 0, Some("540302"), Some("5")),
            (
                "IS00303",
                "城市维护建设税",
                2,
                6,
                0,
                Some("540303"),
                Some("6"),
            ),
            ("IS00304", "资源税", 2, 7, 0, Some("540304"), Some("7")),
            ("IS00305", "土地增值税", 2, 8, 0, Some("540305"), Some("8")),
            (
                "IS00306",
                "城镇土地使用税、房产税、车船税、印花税",
                2,
                9,
                0,
                Some("540306"),
                Some("9"),
            ),
            (
                "IS00307",
                "教育费附加、矿产资源补偿费、排污费",
                2,
                10,
                0,
                Some("540307"),
                Some("10"),
            ),
            ("IS004", "销售费用", 1, 11, 0, Some("5601"), Some("11")),
            (
                "IS00401",
                "其中：商品维修费",
                2,
                12,
                0,
                Some("560104"),
                Some("12"),
            ),
            (
                "IS00402",
                "广告费和业务宣传费",
                2,
                13,
                0,
                Some("560101"),
                Some("13"),
            ),
            ("IS005", "管理费用", 1, 14, 0, Some("5602"), Some("14")),
            (
                "IS00501",
                "其中：开办费",
                2,
                15,
                0,
                Some("560206"),
                Some("15"),
            ),
            (
                "IS00502",
                "业务招待费",
                2,
                16,
                0,
                Some("560207"),
                Some("16"),
            ),
            ("IS00503", "研究费用", 2, 17, 0, Some("560208"), Some("17")),
            ("IS006", "财务费用", 1, 18, 0, Some("5603"), Some("18")),
            (
                "IS00601",
                "其中：利息费用（收入以“-”号填列）",
                2,
                19,
                0,
                Some("560301-560303"),
                Some("19"),
            ),
            (
                "IS009",
                "加：投资收益（损失以“-”号填列）",
                1,
                20,
                0,
                Some("5111"),
                Some("20"),
            ),
            (
                "IS010",
                "二、营业利润（亏损以“-”号填列）",
                1,
                21,
                1,
                None,
                Some("21"),
            ),
            (
                "IS011",
                "加：营业外收入",
                1,
                22,
                0,
                Some("5301"),
                Some("22"),
            ),
            (
                "IS01101",
                "其中：政府补助",
                2,
                23,
                0,
                Some("530102"),
                Some("23"),
            ),
            (
                "IS012",
                "减：营业外支出",
                1,
                24,
                0,
                Some("5711"),
                Some("24"),
            ),
            (
                "IS01201",
                "其中：坏账损失",
                2,
                25,
                0,
                Some("571103"),
                Some("25"),
            ),
            (
                "IS01202",
                "无法收回的长期债券投资损失",
                2,
                26,
                0,
                Some("571104"),
                Some("26"),
            ),
            (
                "IS01203",
                "无法收回的长期股权投资损失",
                2,
                27,
                0,
                Some("571105"),
                Some("27"),
            ),
            (
                "IS01204",
                "自然灾害等不可抗力因素造成的损失",
                2,
                28,
                0,
                Some("571106"),
                Some("28"),
            ),
            (
                "IS01205",
                "税收滞纳金",
                2,
                29,
                0,
                Some("571107"),
                Some("29"),
            ),
            (
                "IS013",
                "三、利润总额（亏损总额以“-”号填列）",
                1,
                30,
                1,
                None,
                Some("30"),
            ),
            (
                "IS014",
                "减：所得税费用",
                1,
                31,
                0,
                Some("5801"),
                Some("31"),
            ),
            (
                "IS015",
                "四、净利润（净亏损以“-”号填列）",
                1,
                32,
                1,
                None,
                Some("32"),
            ),
        ];

        let cash_items: Vec<StandardReportItemSeed> = vec![
            ("CF100", "一、经营活动产生的现金流量", 1, 1, 0, None, None),
            ("CF101", "销售产成品、商品、提供劳务收到的现金", 2, 2, 0, Some("credit:1121+credit:1122+credit:1123+credit:1221"), Some("1")),
            ("CF102", "收到其他与经营活动有关的现金", 2, 3, 0, Some("credit:5301+credit:5051"), Some("2")),
            ("CF104", "购买原材料、商品、接受劳务支付的现金", 2, 4, 0, Some("debit:2201+debit:2202+debit:2203+debit:2241"), Some("3")),
            ("CF105", "支付的职工薪酬", 2, 5, 0, Some("debit:2211"), Some("4")),
            ("CF106", "支付的税费", 2, 6, 0, Some("debit:2221"), Some("5")),
            ("CF107", "支付其他与经营活动有关的现金", 2, 7, 0, Some("debit:5601+debit:5602+debit:5603"), Some("6")),
            ("CF199", "经营活动产生的现金流量净额", 1, 8, 1, None, Some("7")),
            ("CF200", "二、投资活动产生的现金流量", 1, 9, 0, None, None),
            ("CF201", "收回短期投资、长期债券投资和长期股权投资收到的现金", 2, 10, 0, Some("credit:1101+credit:1501+credit:1511"), Some("8")),
            ("CF202", "取得投资收益收到的现金", 2, 11, 0, Some("credit:5111"), Some("9")),
            ("CF203", "处置固定资产、无形资产和其他非流动资产收回的现金净额", 2, 12, 0, Some("credit:1601+credit:1604+credit:1605+credit:1606+credit:1621+credit:1701+credit:1801"), Some("10")),
            ("CF204", "短期投资、长期债券投资和长期股权投资支付的现金", 2, 13, 0, Some("debit:1101+debit:1501+debit:1511"), Some("11")),
            ("CF205", "购建固定资产、无形资产和其他非流动资产支付的现金", 2, 14, 0, Some("debit:1601+debit:1604+debit:1605+debit:1621+debit:1701+debit:1801"), Some("12")),
            ("CF299", "投资活动产生的现金流量净额", 1, 15, 1, None, Some("13")),
            ("CF300", "三、筹资活动产生的现金流量", 1, 16, 0, None, None),
            ("CF302", "取得借款收到的现金", 2, 17, 0, Some("credit:2001+credit:2501"), Some("14")),
            ("CF301", "吸收投资者投资收到的现金", 2, 18, 0, Some("credit:3001+credit:3002"), Some("15")),
            ("CF303", "偿还借款本金支付的现金", 2, 19, 0, Some("debit:2001+debit:2501"), Some("16")),
            ("CF304", "偿还借款利息支付的现金", 2, 20, 0, Some("debit:2231"), Some("17")),
            ("CF306", "分配利润支付的现金", 2, 21, 0, Some("debit:2232"), Some("18")),
            ("CF399", "筹资活动产生的现金流量净额", 1, 22, 1, None, Some("19")),
            ("CF400", "四、现金净增加额", 1, 23, 1, None, Some("20")),
            ("CF500", "加：期初现金余额", 1, 24, 0, Some("1001+1002+1012"), Some("21")),
            ("CF999", "五、期末现金余额", 1, 25, 1, Some("1001+1002+1012"), Some("22")),
        ];

        for (code, name, report_type, form_code, items) in [
            (
                "SMALL_ENTERPRISE_BALANCE_SHEET",
                "资产负债表",
                "balance_sheet",
                "会小企 01 表",
                balance_items.as_slice(),
            ),
            (
                "SMALL_ENTERPRISE_INCOME_STATEMENT",
                "利润表",
                "income_statement",
                "会小企 02 表",
                income_items.as_slice(),
            ),
            (
                "SMALL_ENTERPRISE_CASH_FLOW",
                "现金流量表",
                "cash_flow",
                "会小企 03 表",
                cash_items.as_slice(),
            ),
        ] {
            Self::insert_standard_report_template(
                pool,
                code,
                name,
                report_type,
                "small_enterprise",
                Some(form_code),
                "月报、年报",
                1,
                items,
            )
            .await?;
            Self::replace_system_report_items(pool, code, report_type, items).await?;
        }
        Ok(())
    }

    async fn normalize_cooperative_2023_reporting(pool: &DbPool) -> Result<(), DbError> {
        let distribution_accounts: Vec<AccountCodeSeed> = vec![
            ("3321", "各项分配", "equity", "debit", 2, Some("332"), 0),
            (
                "332101",
                "提取盈余公积",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            ("332102", "盈余返还", "equity", "debit", 3, Some("3321"), 1),
            (
                "332103",
                "剩余盈余分配",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            (
                "332104",
                "转为成员出资",
                "equity",
                "debit",
                3,
                Some("3321"),
                1,
            ),
            ("3322", "未分配盈余", "equity", "credit", 2, Some("332"), 1),
        ];
        for (code, name, account_type, normal_balance, level, parent_code, is_detail) in
            distribution_accounts
        {
            sqlx::query(
                r#"INSERT OR IGNORE INTO account_codes (
                       code, company_id, name, account_type, normal_balance, level, parent_code, is_detail
                   )
                   SELECT ?, id, ?, ?, ?, ?, ?, ?
                   FROM companies WHERE accounting_system = 'cooperative'"#,
            )
            .bind(code)
            .bind(name)
            .bind(account_type)
            .bind(normal_balance)
            .bind(level)
            .bind(parent_code)
            .bind(is_detail)
            .execute(pool)
            .await?;
        }
        sqlx::query(
            r#"UPDATE account_codes SET is_detail = 0
               WHERE code IN ('332', '3321')
                 AND company_id IN (
                   SELECT id FROM companies WHERE accounting_system = 'cooperative'
                 )"#,
        )
        .execute(pool)
        .await?;

        let balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("101+102"), Some("1")),
            (
                "BS102",
                "应收款项",
                2,
                3,
                0,
                Some("113+closing_d:114"),
                Some("2"),
            ),
            (
                "BS103",
                "存货",
                2,
                4,
                0,
                Some("121+124+125+127+128+401"),
                Some("3"),
            ),
            ("BS104", "消耗性生物资产", 2, 5, 0, Some("141"), Some("4")),
            (
                "BS199",
                "流动资产合计",
                2,
                6,
                1,
                Some("101+102+113+closing_d:114+121+124+125+127+128+401+141"),
                Some("5"),
            ),
            ("BS200", "非流动资产", 1, 7, 0, None, None),
            ("BS201", "对外投资", 2, 8, 0, Some("131"), Some("6")),
            ("BS202", "生产性生物资产原值", 2, 9, 0, Some("142"), Some("7")),
            (
                "BS203",
                "减：生产性生物资产累计折旧",
                2,
                10,
                0,
                Some("143"),
                Some("8"),
            ),
            (
                "BS204",
                "生产性生物资产净值",
                2,
                11,
                0,
                Some("142-143"),
                Some("9"),
            ),
            ("BS205", "固定资产原值", 2, 12, 0, Some("151"), Some("10")),
            ("BS206", "减：累计折旧", 2, 13, 0, Some("152"), Some("11")),
            (
                "BS207",
                "固定资产净值",
                2,
                14,
                0,
                Some("151-152"),
                Some("12"),
            ),
            ("BS208", "在建工程", 2, 15, 0, Some("153"), Some("13")),
            ("BS209", "固定资产清理", 2, 16, 0, Some("154"), Some("14")),
            (
                "BS210",
                "固定资产小计",
                2,
                17,
                1,
                Some("151-152+153+154"),
                Some("15"),
            ),
            ("BS211", "无形资产原值", 2, 18, 0, Some("161"), Some("16")),
            ("BS212", "减：累计摊销", 2, 19, 0, Some("162"), Some("17")),
            (
                "BS213",
                "无形资产净值",
                2,
                20,
                0,
                Some("161-162"),
                Some("18"),
            ),
            ("BS214", "公益性生物资产", 2, 21, 0, Some("144"), Some("19")),
            ("BS215", "长期待摊费用", 2, 22, 0, Some("171"), Some("20")),
            (
                "BS299",
                "非流动资产合计",
                2,
                23,
                1,
                Some("131+142-143+151-152+153+154+161-162+144+171"),
                Some("21"),
            ),
            (
                "BS999",
                "资产总计",
                1,
                24,
                1,
                Some("101+102+113+closing_d:114+121+124+125+127+128+401+141+131+142-143+151-152+153+154+161-162+144+171"),
                Some("22"),
            ),
            ("BS300", "流动负债", 1, 25, 0, None, None),
            ("BS301", "短期借款", 2, 26, 0, Some("201"), Some("23")),
            (
                "BS302",
                "应付款项",
                2,
                27,
                0,
                Some("211+closing_c:114"),
                Some("24"),
            ),
            ("BS303", "应付工资", 2, 28, 0, Some("212"), Some("25")),
            ("BS304", "应付劳务费", 2, 29, 0, Some("213"), Some("26")),
            ("BS305", "应交税费", 2, 30, 0, Some("214"), Some("27")),
            ("BS306", "应付利息", 2, 31, 0, Some("215"), Some("28")),
            ("BS307", "应付盈余返还", 2, 32, 0, Some("221"), Some("29")),
            ("BS308", "应付剩余盈余", 2, 33, 0, Some("222"), Some("30")),
            (
                "BS399",
                "流动负债合计",
                2,
                34,
                1,
                Some("201+211+closing_c:114+212+213+214+215+221+222"),
                Some("31"),
            ),
            ("BS400", "非流动负债", 1, 35, 0, None, None),
            ("BS401", "长期借款", 2, 36, 0, Some("231"), Some("32")),
            ("BS402", "专项应付款", 2, 37, 0, Some("235"), Some("33")),
            (
                "BS499",
                "非流动负债合计",
                2,
                38,
                1,
                Some("231+235"),
                Some("34"),
            ),
            (
                "BS599",
                "负债合计",
                1,
                39,
                1,
                Some("201+211+closing_c:114+212+213+214+215+221+222+231+235"),
                Some("35"),
            ),
            ("BS600", "所有者权益", 1, 40, 0, None, None),
            ("BS601", "股金", 2, 41, 0, Some("301"), Some("36")),
            ("BS602", "专项基金", 2, 42, 0, Some("311"), Some("37")),
            ("BS603", "资本公积", 2, 43, 0, Some("321"), Some("38")),
            ("BS604", "盈余公积", 2, 44, 0, Some("322"), Some("39")),
            (
                "BS605",
                "未分配盈余",
                2,
                45,
                0,
                Some("331+332"),
                Some("40"),
            ),
            (
                "BS699",
                "所有者权益合计",
                2,
                46,
                1,
                Some("301+311+321+322+331+332"),
                Some("41"),
            ),
            (
                "BS799",
                "负债和所有者权益总计",
                1,
                47,
                1,
                Some("201+211+closing_c:114+212+213+214+215+221+222+231+235+301+311+321+322+331+332"),
                Some("42"),
            ),
        ];

        let income_items: Vec<StandardReportItemSeed> = vec![
            ("IS001", "一、经营收入", 1, 1, 0, Some("501"), Some("1")),
            ("IS009", "加：投资收益", 1, 2, 0, Some("511"), Some("2")),
            ("IS002", "减：经营支出", 1, 3, 0, Some("521"), Some("3")),
            ("IS003", "税金及附加", 1, 4, 0, Some("522"), Some("4")),
            ("IS004", "管理费用", 1, 5, 0, Some("523"), Some("5")),
            ("IS005", "财务费用", 1, 6, 0, Some("524"), Some("6")),
            ("IS010", "二、经营收益", 1, 7, 1, None, Some("7")),
            ("IS011", "加：其他收入", 1, 8, 0, Some("502"), Some("8")),
            ("IS012", "减：其他支出", 1, 9, 0, Some("529"), Some("9")),
            ("IS013", "三、盈余总额", 1, 10, 1, None, Some("10")),
            ("IS014", "减：所得税费用", 1, 11, 0, Some("531"), Some("11")),
            ("IS015", "四、本年盈余", 1, 12, 1, None, Some("12")),
            (
                "IS016",
                "加：年初未分配盈余",
                1,
                13,
                0,
                Some("opening:3322"),
                Some("13"),
            ),
            ("IS017", "其他转入", 1, 14, 0, Some("debit:322"), Some("14")),
            (
                "IS018",
                "减：提取盈余公积",
                1,
                15,
                0,
                Some("332101"),
                Some("15"),
            ),
            ("IS019", "五、可分配盈余", 1, 16, 1, None, Some("16")),
            (
                "IS020",
                "减：盈余返还",
                1,
                17,
                0,
                Some("332102"),
                Some("17"),
            ),
            (
                "IS021",
                "剩余盈余分配",
                1,
                18,
                0,
                Some("332103"),
                Some("18"),
            ),
            (
                "IS022",
                "转为成员出资",
                1,
                19,
                0,
                Some("332104"),
                Some("19"),
            ),
            ("IS023", "六、年末未分配盈余", 1, 20, 1, None, Some("20")),
        ];

        let equity_items: Vec<StandardReportItemSeed> = vec![
            ("EQ100", "年初余额", 1, 1, 1, None, None),
            ("EQ200", "本年增加数", 1, 2, 1, None, None),
            ("EQ210", "资本公积转增", 2, 3, 0, None, None),
            ("EQ211", "接受国家财政直接补助形成", 2, 4, 0, None, None),
            ("EQ212", "股金溢价", 2, 5, 0, None, None),
            ("EQ213", "从盈余中提取", 2, 6, 0, None, None),
            ("EQ214", "本年盈余", 2, 7, 0, None, None),
            ("EQ215", "盈余公积转增", 2, 8, 0, None, None),
            ("EQ216", "接受他人捐赠形成", 2, 9, 0, None, None),
            ("EQ217", "资产评估增值", 2, 10, 0, None, None),
            ("EQ218", "其他转入", 2, 11, 0, None, None),
            ("EQ219", "成员增加出资", 2, 12, 0, None, None),
            ("EQ300", "本年减少数", 1, 13, 1, None, None),
            ("EQ310", "成员减少出资", 2, 14, 0, None, None),
            ("EQ311", "资本公积转为成员出资", 2, 15, 0, None, None),
            ("EQ312", "盈余公积转为成员出资", 2, 16, 0, None, None),
            ("EQ313", "提取盈余公积", 2, 17, 0, None, None),
            ("EQ314", "弥补亏损", 2, 18, 0, None, None),
            ("EQ315", "盈余返还", 2, 19, 0, None, None),
            ("EQ316", "剩余盈余分配", 2, 20, 0, None, None),
            ("EQ317", "未分配盈余转为成员出资", 2, 21, 0, None, None),
            ("EQ400", "年末余额", 1, 22, 1, None, None),
        ];

        for (code, name, report_type, form_code, frequency, items) in [
            (
                "COOPERATIVE_BALANCE_SHEET",
                "资产负债表",
                "balance_sheet",
                "会农社 01 表",
                "月报、年报",
                balance_items.as_slice(),
            ),
            (
                "COOPERATIVE_INCOME_STATEMENT",
                "盈余及盈余分配表",
                "income_statement",
                "会农社 02 表",
                "年报",
                income_items.as_slice(),
            ),
            (
                "COOPERATIVE_EQUITY_CHANGE",
                "成员权益变动表",
                "equity_change",
                "会农社 03 表",
                "年报",
                equity_items.as_slice(),
            ),
        ] {
            Self::insert_standard_report_template(
                pool,
                code,
                name,
                report_type,
                "cooperative",
                Some(form_code),
                frequency,
                1,
                items,
            )
            .await?;
            Self::replace_system_report_items(pool, code, report_type, items).await?;
        }
        Ok(())
    }

    async fn normalize_nonprofit_2026_reporting(pool: &DbPool) -> Result<(), DbError> {
        let balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("1001+1002+1009"), Some("1")),
            ("BS102", "短期投资", 2, 3, 0, Some("1101-1102"), Some("2")),
            ("BS103", "应收款项", 2, 4, 0, Some("1111+1121+1122-1131"), Some("3")),
            ("BS104", "预付账款", 2, 5, 0, Some("1141"), Some("4")),
            ("BS105", "存货", 2, 6, 0, Some("1201-1202"), Some("5")),
            ("BS106", "待摊费用", 2, 7, 0, Some("1301"), Some("6")),
            ("BS107", "一年内到期的长期投资", 2, 8, 0, None, Some("7")),
            ("BS108", "其他流动资产", 2, 9, 0, None, Some("8")),
            ("BS199", "流动资产合计", 2, 10, 1, Some("1001+1002+1009+1101-1102+1111+1121+1122-1131+1141+1201-1202+1301"), Some("9")),
            ("BS200", "非流动资产", 1, 11, 0, None, None),
            ("BS201", "长期投资", 2, 12, 0, None, None),
            ("BS202", "长期股权投资", 3, 13, 0, Some("1401"), Some("10")),
            ("BS203", "长期债权投资", 3, 14, 0, Some("1402"), Some("11")),
            ("BS204", "其他长期投资", 3, 15, 0, Some("1403"), Some("12")),
            ("BS209", "长期投资合计", 2, 16, 1, Some("1401+1402+1403-1421"), Some("13")),
            ("BS210", "固定资产", 2, 17, 0, None, None),
            ("BS211", "固定资产原价", 3, 18, 0, Some("1501"), Some("14")),
            ("BS212", "减：累计折旧", 3, 19, 0, Some("1502"), Some("15")),
            ("BS213", "固定资产净值", 3, 20, 0, Some("1501-1502"), Some("16")),
            ("BS214", "在建工程", 3, 21, 0, Some("1505"), Some("17")),
            ("BS215", "固定资产清理", 3, 22, 0, Some("1509"), Some("18")),
            ("BS219", "固定资产合计", 2, 23, 1, Some("1501-1502+1505+1509"), Some("19")),
            ("BS220", "文物资源", 2, 24, 0, Some("1506"), Some("20")),
            ("BS230", "无形资产", 2, 25, 0, None, None),
            ("BS231", "无形资产原价", 3, 26, 0, Some("1601"), Some("21")),
            ("BS232", "减：累计摊销", 3, 27, 0, Some("1602"), Some("22")),
            ("BS233", "无形资产净值", 3, 28, 0, Some("1601-1602"), Some("23")),
            ("BS240", "长期待摊费用", 2, 29, 0, Some("1701"), Some("24")),
            ("BS299", "非流动资产合计", 2, 30, 1, Some("1401+1402+1403-1421+1501-1502+1505+1509+1506+1601-1602+1701"), Some("25")),
            ("BS290", "受托代理资产", 1, 31, 0, None, None),
            ("BS291", "受托代理资产", 2, 32, 0, Some("1801"), Some("26")),
            ("BS999", "资产总计", 1, 33, 1, Some("1001+1002+1009+1101-1102+1111+1121+1122-1131+1141+1201-1202+1301+1401+1402+1403-1421+1501-1502+1505+1509+1506+1601-1602+1701+1801"), Some("27")),
            ("BS300", "流动负债", 1, 34, 0, None, None),
            ("BS301", "短期借款", 2, 35, 0, Some("2101"), Some("28")),
            ("BS302", "应付款项", 2, 36, 0, Some("2201+2202"), Some("29")),
            ("BS303", "应付职工薪酬", 2, 37, 0, Some("2204"), Some("30")),
            ("BS304", "应交税费", 2, 38, 0, Some("2206"), Some("31")),
            ("BS305", "预收账款", 2, 39, 0, Some("2203"), Some("32")),
            ("BS306", "预提费用", 2, 40, 0, Some("2301"), Some("33")),
            ("BS307", "一年内到期的长期负债", 2, 41, 0, None, Some("34")),
            ("BS308", "其他流动负债", 2, 42, 0, Some("2209"), Some("35")),
            ("BS399", "流动负债合计", 2, 43, 1, Some("2101+2201+2202+2204+2206+2203+2301+2209"), Some("36")),
            ("BS400", "长期负债", 1, 44, 0, None, None),
            ("BS401", "长期借款", 2, 45, 0, Some("2501"), Some("37")),
            ("BS402", "长期应付款", 2, 46, 0, Some("2502"), Some("38")),
            ("BS403", "预计负债", 2, 47, 0, Some("2503"), Some("39")),
            ("BS404", "其他长期负债", 2, 48, 0, None, Some("40")),
            ("BS499", "长期负债合计", 2, 49, 1, Some("2501+2502+2503"), Some("41")),
            ("BS500", "受托代理负债", 1, 50, 0, None, None),
            ("BS501", "受托代理负债", 2, 51, 0, Some("2601"), Some("42")),
            ("BS599", "负债合计", 1, 52, 1, Some("2101+2201+2202+2204+2206+2203+2301+2209+2501+2502+2503+2601"), Some("43")),
            ("BS600", "净资产", 1, 53, 0, None, None),
            ("BS601", "非限定性净资产", 2, 54, 0, Some("3101+3201"), Some("44")),
            ("BS602", "限定性净资产", 2, 55, 0, Some("3102"), Some("45")),
            ("BS699", "净资产合计", 2, 56, 1, Some("3101+3102+3201"), Some("46")),
            ("BS799", "负债和净资产总计", 1, 57, 1, Some("2101+2201+2202+2204+2206+2203+2301+2209+2501+2502+2503+2601+3101+3102+3201"), Some("47")),
        ];
        let income_items: Vec<StandardReportItemSeed> = vec![
            ("IS100", "一、收入", 1, 1, 0, None, None),
            ("IS101", "捐赠收入", 2, 2, 0, Some("4101"), Some("1")),
            ("IS102", "会费收入", 2, 3, 0, Some("4201"), Some("2")),
            ("IS103", "提供服务收入", 2, 4, 0, Some("4301"), Some("3")),
            ("IS104", "政府补助收入", 2, 5, 0, Some("4401"), Some("4")),
            ("IS105", "商品销售收入", 2, 6, 0, Some("4501"), Some("5")),
            ("IS106", "总部拨款收入", 2, 7, 0, Some("4701"), Some("6")),
            ("IS107", "投资收益", 2, 8, 0, Some("4601"), Some("7")),
            ("IS108", "其他收入", 2, 9, 0, Some("4901"), Some("8")),
            (
                "IS109",
                "收入合计",
                1,
                10,
                1,
                Some("4101+4201+4301+4401+4501+4701+4601+4901"),
                Some("9"),
            ),
            ("IS200", "二、费用", 1, 11, 0, None, None),
            ("IS201", "业务活动成本", 2, 12, 0, Some("5101"), Some("10")),
            ("IS202", "其中：", 3, 13, 0, None, None),
            ("IS203", "税金及附加", 3, 14, 0, Some("5201"), Some("11")),
            ("IS204", "管理费用", 2, 15, 0, Some("5301"), Some("12")),
            ("IS205", "筹资费用", 2, 16, 0, Some("5401"), Some("13")),
            ("IS206", "资产减值损失", 2, 17, 0, Some("5501"), Some("14")),
            ("IS207", "所得税费用", 2, 18, 0, Some("5601"), Some("15")),
            ("IS208", "其他费用", 2, 19, 0, Some("5901"), Some("16")),
            (
                "IS209",
                "费用合计",
                1,
                20,
                1,
                Some("5101+5201+5301+5401+5501+5601+5901"),
                Some("17"),
            ),
            (
                "IS300",
                "三、限定性净资产转为非限定性净资产",
                1,
                21,
                0,
                None,
                Some("18"),
            ),
            (
                "IS400",
                "四、非限定性净资产转为限定性净资产",
                1,
                22,
                0,
                None,
                Some("19"),
            ),
            (
                "IS500",
                "五、以前年度净资产调整",
                1,
                23,
                0,
                Some("3201"),
                Some("20"),
            ),
            (
                "IS015",
                "六、净资产变动额（若为净资产减少额，以“-”号填列）",
                1,
                24,
                1,
                None,
                Some("21"),
            ),
        ];
        let cash_items: Vec<StandardReportItemSeed> = vec![
            ("CF100", "一、业务活动产生的现金流量", 1, 1, 0, None, None),
            (
                "CF101",
                "接受捐赠收到的现金",
                2,
                2,
                0,
                Some("credit:4101"),
                Some("1"),
            ),
            (
                "CF102",
                "收取会费收到的现金",
                2,
                3,
                0,
                Some("credit:4201"),
                Some("2"),
            ),
            (
                "CF103",
                "提供服务收到的现金",
                2,
                4,
                0,
                Some("credit:4301"),
                Some("3"),
            ),
            (
                "CF108",
                "销售商品收到的现金",
                2,
                5,
                0,
                Some("credit:4501"),
                Some("4"),
            ),
            (
                "CF110",
                "政府补助收到的现金",
                2,
                6,
                0,
                Some("credit:4401"),
                Some("5"),
            ),
            (
                "CF118",
                "收到的其他与业务活动有关的现金",
                2,
                7,
                0,
                Some("credit:4701+credit:4901"),
                Some("6"),
            ),
            ("CF109", "现金流入小计", 2, 8, 1, None, Some("7")),
            (
                "CF104",
                "提供捐赠或者资助支付的现金",
                2,
                9,
                0,
                Some("debit:5101"),
                Some("8"),
            ),
            (
                "CF105",
                "支付给员工以及为员工支付的现金",
                2,
                10,
                0,
                Some("debit:2204"),
                Some("9"),
            ),
            (
                "CF106",
                "购买商品、接受服务支付的现金",
                2,
                11,
                0,
                Some("debit:2201+debit:2202"),
                Some("10"),
            ),
            (
                "CF107",
                "各项税费支付的现金",
                2,
                12,
                0,
                Some("debit:2206"),
                Some("11"),
            ),
            (
                "CF117",
                "支付的其他与业务活动有关的现金",
                2,
                13,
                0,
                Some("debit:5301+debit:5401+debit:5901"),
                Some("12"),
            ),
            ("CF119", "现金流出小计", 2, 14, 1, None, Some("13")),
            (
                "CF199",
                "业务活动产生的现金流量净额",
                1,
                15,
                1,
                None,
                Some("14"),
            ),
            ("CF200", "二、投资活动产生的现金流量", 1, 16, 0, None, None),
            ("CF201", "收回投资所收到的现金", 2, 17, 0, None, Some("15")),
            (
                "CF202",
                "取得投资收益所收到的现金",
                2,
                18,
                0,
                Some("credit:4601"),
                Some("16"),
            ),
            (
                "CF203",
                "处置固定资产、无形资产和其他非流动资产所收回的现金",
                2,
                19,
                0,
                None,
                Some("17"),
            ),
            (
                "CF207",
                "收到的其他与投资活动有关的现金",
                2,
                20,
                0,
                None,
                Some("18"),
            ),
            ("CF209", "现金流入小计", 2, 21, 1, None, Some("19")),
            (
                "CF204",
                "购建固定资产、无形资产和其他非流动资产所支付的现金",
                2,
                22,
                0,
                Some("debit:1501+debit:1505+debit:1601"),
                Some("20"),
            ),
            (
                "CF205",
                "对外投资所支付的现金",
                2,
                23,
                0,
                Some("debit:1101+debit:1401+debit:1402+debit:1403"),
                Some("21"),
            ),
            (
                "CF210",
                "支付的其他与投资活动有关的现金",
                2,
                24,
                0,
                None,
                Some("22"),
            ),
            ("CF219", "现金流出小计", 2, 25, 1, None, Some("23")),
            (
                "CF299",
                "投资活动产生的现金流量净额",
                1,
                26,
                1,
                None,
                Some("24"),
            ),
            ("CF300", "三、筹资活动产生的现金流量", 1, 27, 0, None, None),
            (
                "CF301",
                "借款所收到的现金",
                2,
                28,
                0,
                Some("credit:2101+credit:2501"),
                Some("25"),
            ),
            (
                "CF305",
                "收到的其他与筹资活动有关的现金",
                2,
                29,
                0,
                None,
                Some("26"),
            ),
            ("CF309", "现金流入小计", 2, 30, 1, None, Some("27")),
            (
                "CF303",
                "偿还借款所支付的现金",
                2,
                31,
                0,
                Some("debit:2101+debit:2501"),
                Some("28"),
            ),
            ("CF304", "偿付利息所支付的现金", 2, 32, 0, None, Some("29")),
            (
                "CF306",
                "支付的其他与筹资活动有关的现金",
                2,
                33,
                0,
                None,
                Some("30"),
            ),
            ("CF319", "现金流出小计", 2, 34, 1, None, Some("31")),
            (
                "CF399",
                "筹资活动产生的现金流量净额",
                1,
                35,
                1,
                None,
                Some("32"),
            ),
            (
                "CF400",
                "四、汇率变动对现金的影响额",
                1,
                36,
                0,
                None,
                Some("33"),
            ),
            (
                "CF499",
                "五、现金及现金等价物净增加额",
                1,
                37,
                1,
                None,
                Some("34"),
            ),
        ];

        for (code, name, report_type, form_code, frequency, items) in [
            (
                "NON_PROFIT_BALANCE_SHEET",
                "资产负债表",
                "balance_sheet",
                "会民非 01 表",
                "中期报告、年度报告",
                balance_items.as_slice(),
            ),
            (
                "NON_PROFIT_INCOME_STATEMENT",
                "业务活动表",
                "income_statement",
                "会民非 02 表",
                "中期报告、年度报告",
                income_items.as_slice(),
            ),
            (
                "NON_PROFIT_CASH_FLOW",
                "现金流量表",
                "cash_flow",
                "会民非 03 表",
                "年度报告",
                cash_items.as_slice(),
            ),
        ] {
            Self::insert_standard_report_template(
                pool,
                code,
                name,
                report_type,
                "non_profit",
                Some(form_code),
                frequency,
                1,
                items,
            )
            .await?;
            Self::replace_system_report_items(pool, code, report_type, items).await?;
        }
        Ok(())
    }

    async fn normalize_enterprise_cash_flow_template(pool: &DbPool) -> Result<(), DbError> {
        for (report_type, form_code) in [
            ("balance_sheet", "会企 01 表"),
            ("income_statement", "会企 02 表"),
            ("cash_flow", "会企 03 表"),
        ] {
            sqlx::query(
                "UPDATE report_templates SET form_code = ? WHERE accounting_system = 'enterprise' AND report_type = ? AND is_system = 1",
            )
            .bind(form_code)
            .bind(report_type)
            .execute(pool)
            .await?;
        }

        let template_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM report_templates WHERE template_code = 'ENTERPRISE_CASH_FLOW' AND is_system = 1",
        )
        .fetch_optional(pool)
        .await?;
        let Some(template_id) = template_id else {
            return Ok(());
        };
        let rows: Vec<StandardReportItemSeed> = vec![
            ("CF100", "一、经营活动产生的现金流量", 1, 1, 0, None, None),
            (
                "CF101",
                "销售商品、提供劳务收到的现金",
                2,
                2,
                0,
                Some("credit:1121+credit:1122+credit:1123+credit:1221"),
                Some("1"),
            ),
            ("CF102", "收到的税费返还", 2, 3, 0, None, Some("2")),
            (
                "CF103",
                "收到其他与经营活动有关的现金",
                2,
                4,
                0,
                None,
                Some("3"),
            ),
            ("CF109", "经营活动现金流入小计", 2, 5, 1, None, Some("4")),
            (
                "CF104",
                "购买商品、接受劳务支付的现金",
                2,
                6,
                0,
                Some("debit:2201+debit:2202+debit:2203+debit:2241"),
                Some("5"),
            ),
            (
                "CF105",
                "支付给职工以及为职工支付的现金",
                2,
                7,
                0,
                Some("debit:2211"),
                Some("6"),
            ),
            (
                "CF106",
                "支付的各项税费",
                2,
                8,
                0,
                Some("debit:2221"),
                Some("7"),
            ),
            (
                "CF107",
                "支付其他与经营活动有关的现金",
                2,
                9,
                0,
                None,
                Some("8"),
            ),
            ("CF119", "经营活动现金流出小计", 2, 10, 1, None, Some("9")),
            (
                "CF199",
                "经营活动产生的现金流量净额",
                1,
                11,
                1,
                None,
                Some("10"),
            ),
            ("CF200", "二、投资活动产生的现金流量", 1, 12, 0, None, None),
            ("CF201", "收回投资收到的现金", 2, 13, 0, None, Some("11")),
            (
                "CF202",
                "取得投资收益收到的现金",
                2,
                14,
                0,
                None,
                Some("12"),
            ),
            (
                "CF203",
                "处置固定资产、无形资产和其他长期资产收回的现金净额",
                2,
                15,
                0,
                None,
                Some("13"),
            ),
            (
                "CF206",
                "处置子公司及其他营业单位收到的现金净额",
                2,
                16,
                0,
                None,
                Some("14"),
            ),
            (
                "CF207",
                "收到其他与投资活动有关的现金",
                2,
                17,
                0,
                None,
                Some("15"),
            ),
            ("CF209", "投资活动现金流入小计", 2, 18, 1, None, Some("16")),
            (
                "CF204",
                "购建固定资产、无形资产和其他长期资产支付的现金",
                2,
                19,
                0,
                Some("debit:1601+debit:1604+debit:1701"),
                Some("17"),
            ),
            ("CF205", "投资支付的现金", 2, 20, 0, None, Some("18")),
            (
                "CF208",
                "取得子公司及其他营业单位支付的现金净额",
                2,
                21,
                0,
                None,
                Some("19"),
            ),
            (
                "CF210",
                "支付其他与投资活动有关的现金",
                2,
                22,
                0,
                None,
                Some("20"),
            ),
            ("CF219", "投资活动现金流出小计", 2, 23, 1, None, Some("21")),
            (
                "CF299",
                "投资活动产生的现金流量净额",
                1,
                24,
                1,
                None,
                Some("22"),
            ),
            ("CF300", "三、筹资活动产生的现金流量", 1, 25, 0, None, None),
            (
                "CF301",
                "吸收投资收到的现金",
                2,
                26,
                0,
                Some("credit:4001+credit:4002"),
                Some("23"),
            ),
            (
                "CF302",
                "取得借款收到的现金",
                2,
                27,
                0,
                Some("credit:2001+credit:2501"),
                Some("24"),
            ),
            (
                "CF305",
                "收到其他与筹资活动有关的现金",
                2,
                28,
                0,
                None,
                Some("25"),
            ),
            ("CF309", "筹资活动现金流入小计", 2, 29, 1, None, Some("26")),
            ("CF303", "偿还债务支付的现金", 2, 30, 0, None, Some("27")),
            (
                "CF304",
                "分配股利、利润或偿付利息支付的现金",
                2,
                31,
                0,
                None,
                Some("28"),
            ),
            (
                "CF306",
                "支付其他与筹资活动有关的现金",
                2,
                32,
                0,
                None,
                Some("29"),
            ),
            ("CF319", "筹资活动现金流出小计", 2, 33, 1, None, Some("30")),
            (
                "CF399",
                "筹资活动产生的现金流量净额",
                1,
                34,
                1,
                None,
                Some("31"),
            ),
            (
                "CF400",
                "四、汇率变动对现金及现金等价物的影响",
                1,
                35,
                0,
                None,
                Some("32"),
            ),
            (
                "CF499",
                "五、现金及现金等价物净增加额",
                1,
                36,
                1,
                None,
                Some("33"),
            ),
            (
                "CF500",
                "加：期初现金及现金等价物余额",
                1,
                37,
                1,
                None,
                Some("34"),
            ),
            (
                "CF999",
                "六、期末现金及现金等价物余额",
                1,
                38,
                1,
                Some("1001+1002+1012"),
                Some("35"),
            ),
        ];
        for (item_code, item_name, item_level, sort_order, is_total, formula, line_number) in rows {
            let updated = sqlx::query(
                r#"UPDATE report_items
                   SET item_name = ?, item_level = ?, sort_order = ?, is_total = ?,
                       formula = ?, line_number = ?, is_enabled = 1
                   WHERE template_id = ? AND item_code = ?"#,
            )
            .bind(item_name)
            .bind(item_level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .bind(line_number)
            .bind(&template_id)
            .bind(item_code)
            .execute(pool)
            .await?;
            if updated.rows_affected() == 0 {
                sqlx::query(
                    r#"INSERT INTO report_items
                       (id, template_id, item_code, item_name, item_level, sort_order,
                        is_total, formula, line_number)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                )
                .bind(uuid::Uuid::new_v4().to_string())
                .bind(&template_id)
                .bind(item_code)
                .bind(item_name)
                .bind(item_level)
                .bind(sort_order)
                .bind(is_total)
                .bind(formula)
                .bind(line_number)
                .execute(pool)
                .await?;
            }
        }
        Ok(())
    }

    async fn normalize_enterprise_equity_reporting(pool: &DbPool) -> Result<(), DbError> {
        for (code, name, normal_balance, level, parent_code, is_detail) in [
            ("4301", "专项储备", "credit", 1, None, 1),
            ("4401", "其他权益工具", "credit", 1, None, 0),
            ("440101", "优先股", "credit", 2, Some("4401"), 1),
            ("440102", "永续债", "credit", 2, Some("4401"), 1),
        ] {
            sqlx::query(
                r#"INSERT OR IGNORE INTO account_codes (
                       code, company_id, name, account_type, normal_balance, level, parent_code, is_detail
                   )
                   SELECT ?, id, ?, 'equity', ?, ?, ?, ?
                   FROM companies WHERE accounting_system = 'enterprise'"#,
            )
            .bind(code)
            .bind(name)
            .bind(normal_balance)
            .bind(level)
            .bind(parent_code)
            .bind(is_detail)
            .execute(pool)
            .await?;
        }
        sqlx::query(
            "UPDATE account_codes SET is_detail = 0 WHERE code = '4401' AND company_id IN (SELECT id FROM companies WHERE accounting_system = 'enterprise')",
        )
        .execute(pool)
        .await?;

        let rows: Vec<StandardReportItemSeed> = vec![
            ("EQ100", "一、上年年末余额", 1, 1, 1, None, Some("1")),
            ("EQ101", "加：会计政策变更", 2, 2, 0, None, Some("2")),
            ("EQ102", "前期差错更正", 2, 3, 0, None, Some("3")),
            ("EQ103", "其他", 2, 4, 0, None, Some("4")),
            ("EQ200", "二、本年年初余额", 1, 5, 1, None, Some("5")),
            (
                "EQ300",
                "三、本年增减变动金额（减少以“-”号填列）",
                1,
                6,
                1,
                None,
                Some("6"),
            ),
            ("EQ310", "（一）综合收益总额", 2, 7, 0, None, Some("7")),
            (
                "EQ320",
                "（二）所有者投入和减少资本",
                2,
                8,
                1,
                None,
                Some("8"),
            ),
            ("EQ321", "1.所有者投入的普通股", 3, 9, 0, None, Some("9")),
            (
                "EQ322",
                "2.其他权益工具持有者投入资本",
                3,
                10,
                0,
                None,
                Some("10"),
            ),
            (
                "EQ323",
                "3.股份支付计入所有者权益的金额",
                3,
                11,
                0,
                None,
                Some("11"),
            ),
            ("EQ324", "4.其他", 3, 12, 0, None, Some("12")),
            ("EQ330", "（三）利润分配", 2, 13, 1, None, Some("13")),
            ("EQ331", "1.提取盈余公积", 3, 14, 0, None, Some("14")),
            (
                "EQ332",
                "2.对所有者（或股东）的分配",
                3,
                15,
                0,
                None,
                Some("15"),
            ),
            ("EQ333", "3.其他", 3, 16, 0, None, Some("16")),
            (
                "EQ340",
                "（四）所有者权益内部结转",
                2,
                17,
                1,
                None,
                Some("17"),
            ),
            (
                "EQ341",
                "1.资本公积转增资本（或股本）",
                3,
                18,
                0,
                None,
                Some("18"),
            ),
            (
                "EQ342",
                "2.盈余公积转增资本（或股本）",
                3,
                19,
                0,
                None,
                Some("19"),
            ),
            ("EQ343", "3.盈余公积弥补亏损", 3, 20, 0, None, Some("20")),
            (
                "EQ344",
                "4.设定受益计划变动额结转留存收益",
                3,
                21,
                0,
                None,
                Some("21"),
            ),
            (
                "EQ345",
                "5.其他综合收益结转留存收益",
                3,
                22,
                0,
                None,
                Some("22"),
            ),
            ("EQ346", "6.其他", 3, 23, 0, None, Some("23")),
            ("EQ350", "（五）专项储备", 2, 24, 1, None, Some("24")),
            ("EQ351", "1.本期提取", 3, 25, 0, None, Some("25")),
            ("EQ352", "2.本期使用", 3, 26, 0, None, Some("26")),
            ("EQ360", "（六）其他", 2, 27, 0, None, Some("27")),
            ("EQ400", "四、本年年末余额", 1, 28, 1, None, Some("28")),
        ];
        Self::insert_standard_report_template(
            pool,
            "ENTERPRISE_EQUITY_CHANGE",
            "所有者权益变动表",
            "equity_change",
            "enterprise",
            Some("会企 04 表"),
            "年报",
            1,
            &rows,
        )
        .await?;

        let template_id: String = sqlx::query_scalar(
            "SELECT id FROM report_templates WHERE template_code = 'ENTERPRISE_EQUITY_CHANGE'",
        )
        .fetch_one(pool)
        .await?;
        sqlx::query(
            r#"UPDATE report_templates
               SET template_name = '所有者权益变动表', form_code = '会企 04 表',
                   reporting_frequency = '年报', is_statutory = 1, is_system = 1
               WHERE id = ?"#,
        )
        .bind(&template_id)
        .execute(pool)
        .await?;
        for (item_code, item_name, item_level, sort_order, is_total, formula, line_number) in rows {
            let updated = sqlx::query(
                r#"UPDATE report_items
                   SET item_name = ?, item_level = ?, sort_order = ?, is_total = ?,
                       formula = ?, line_number = ?, is_enabled = 1
                   WHERE template_id = ? AND item_code = ?"#,
            )
            .bind(item_name)
            .bind(item_level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .bind(line_number)
            .bind(&template_id)
            .bind(item_code)
            .execute(pool)
            .await?;
            if updated.rows_affected() == 0 {
                sqlx::query(
                    r#"INSERT INTO report_items (
                           id, template_id, item_code, item_name, item_level, sort_order,
                           is_total, formula, line_number
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                )
                .bind(uuid::Uuid::new_v4().to_string())
                .bind(&template_id)
                .bind(item_code)
                .bind(item_name)
                .bind(item_level)
                .bind(sort_order)
                .bind(is_total)
                .bind(formula)
                .bind(line_number)
                .execute(pool)
                .await?;
            }
        }

        let balance_template_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM report_templates WHERE template_code = 'ENTERPRISE_BALANCE_SHEET'",
        )
        .fetch_optional(pool)
        .await?;
        if let Some(balance_template_id) = balance_template_id {
            let equity_rows: Vec<StandardReportItemSeed> = vec![
                ("BS601", "实收资本（或股本）", 2, 31, 0, Some("4001"), Some("43")),
                ("BS602", "其他权益工具", 2, 32, 0, Some("4401"), Some("44")),
                ("BS603", "资本公积", 2, 33, 0, Some("4002"), Some("45")),
                ("BS604", "减：库存股", 2, 34, 0, Some("4201"), Some("46")),
                ("BS605", "其他综合收益", 2, 35, 0, Some("4003"), Some("47")),
                ("BS606", "专项储备", 2, 36, 0, Some("4301"), Some("48")),
                ("BS607", "盈余公积", 2, 37, 0, Some("4101"), Some("49")),
                ("BS608", "未分配利润", 2, 38, 0, Some("4103+4104"), Some("50")),
                ("BS699", "所有者权益（或股东权益）合计", 2, 39, 1, Some("4001+4401+4002-4201+4003+4301+4101+4103+4104"), Some("51")),
                ("BS799", "负债和所有者权益（或股东权益）总计", 1, 40, 1, Some("2001+2201+2202+2203+2211+2221+2241+2501+4001+4401+4002-4201+4003+4301+4101+4103+4104"), Some("52")),
            ];
            for (item_code, item_name, item_level, sort_order, is_total, formula, line_number) in
                equity_rows
            {
                let calculation_sign = default_report_calculation_sign("balance_sheet", item_name);
                let updated = sqlx::query(
                    r#"UPDATE report_items
                       SET item_name = ?, item_level = ?, sort_order = ?, is_total = ?,
                           formula = ?, line_number = ?, calculation_sign = ?, is_enabled = 1
                       WHERE template_id = ? AND item_code = ?"#,
                )
                .bind(item_name)
                .bind(item_level)
                .bind(sort_order)
                .bind(is_total)
                .bind(formula)
                .bind(line_number)
                .bind(calculation_sign)
                .bind(&balance_template_id)
                .bind(item_code)
                .execute(pool)
                .await?;
                if updated.rows_affected() == 0 {
                    sqlx::query(
                        r#"INSERT INTO report_items (
                               id, template_id, item_code, item_name, item_level, sort_order,
                               is_total, formula, line_number, calculation_sign
                           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                    )
                    .bind(uuid::Uuid::new_v4().to_string())
                    .bind(&balance_template_id)
                    .bind(item_code)
                    .bind(item_name)
                    .bind(item_level)
                    .bind(sort_order)
                    .bind(is_total)
                    .bind(formula)
                    .bind(line_number)
                    .bind(calculation_sign)
                    .execute(pool)
                    .await?;
                }
            }
        }

        Ok(())
    }

    async fn normalize_standard_report_calculation_signs(pool: &DbPool) -> Result<(), DbError> {
        let items: Vec<(String, String, String)> = sqlx::query_as(
            r#"SELECT i.id, t.report_type, i.item_name
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE t.is_system = 1 AND t.accounting_system <> 'legacy'"#,
        )
        .fetch_all(pool)
        .await?;

        for (item_id, report_type, item_name) in items {
            sqlx::query("UPDATE report_items SET calculation_sign = ? WHERE id = ?")
                .bind(default_report_calculation_sign(&report_type, &item_name))
                .bind(item_id)
                .execute(pool)
                .await?;
        }

        Ok(())
    }

    async fn insert_default_report_templates(pool: &DbPool) -> Result<(), DbError> {
        // Balance Sheet template
        let bs_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, accounting_system, form_code, reporting_frequency, is_statutory, is_system) VALUES (?, 'ENTERPRISE_BALANCE_SHEET', '资产负债表', 'balance_sheet', 'enterprise', '会企 01 表', '月报、季报、年报', 1, 1)",
        )
        .bind(&bs_id)
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_matching_rules_company_scope ON matching_rules(company_id, rule_scope)")
            .execute(pool)
            .await?;

        // (item_code, item_name, parent_id, level, sort_order, is_total, formula)
        let bs_items: Vec<BalanceSheetSeed> = vec![
            ("BS100", "流动资产", None, 1, 1, 0, None),
            ("BS101", "货币资金", None, 2, 2, 0, Some("1001+1002+1012")),
            ("BS102", "应收票据", None, 2, 3, 0, Some("1121")),
            ("BS103", "应收账款", None, 2, 4, 0, Some("1122-1231")),
            ("BS104", "预付款项", None, 2, 5, 0, Some("1123")),
            (
                "BS105",
                "存货",
                None,
                2,
                6,
                0,
                Some("1401+1403+1405+1408-1471"),
            ),
            ("BS106", "其他应收款", None, 2, 7, 0, Some("1221")),
            ("BS199", "流动资产合计", None, 2, 8, 1, None),
            ("BS200", "非流动资产", None, 1, 9, 0, None),
            ("BS201", "长期股权投资", None, 2, 10, 0, Some("1511")),
            ("BS202", "固定资产", None, 2, 11, 0, Some("1601-1602")),
            ("BS203", "在建工程", None, 2, 12, 0, Some("1604")),
            ("BS204", "无形资产", None, 2, 13, 0, Some("1701-1702")),
            ("BS205", "长期待摊费用", None, 2, 14, 0, Some("1801")),
            ("BS299", "非流动资产合计", None, 2, 15, 1, None),
            ("BS999", "资产总计", None, 1, 16, 1, None),
            ("BS300", "流动负债", None, 1, 17, 0, None),
            ("BS301", "短期借款", None, 2, 18, 0, Some("2001")),
            ("BS302", "应付票据", None, 2, 19, 0, Some("2201")),
            ("BS303", "应付账款", None, 2, 20, 0, Some("2202")),
            ("BS304", "预收账款", None, 2, 21, 0, Some("2203")),
            ("BS305", "应付职工薪酬", None, 2, 22, 0, Some("2211")),
            ("BS306", "应交税费", None, 2, 23, 0, Some("2221")),
            ("BS307", "其他应付款", None, 2, 24, 0, Some("2241")),
            ("BS399", "流动负债合计", None, 2, 25, 1, None),
            ("BS400", "非流动负债", None, 1, 26, 0, None),
            ("BS401", "长期借款", None, 2, 27, 0, Some("2501")),
            ("BS499", "非流动负债合计", None, 2, 28, 1, None),
            ("BS599", "负债合计", None, 1, 29, 1, None),
            ("BS600", "所有者权益", None, 1, 30, 0, None),
            ("BS601", "实收资本", None, 2, 31, 0, Some("4001")),
            ("BS602", "资本公积", None, 2, 32, 0, Some("4002")),
            ("BS603", "盈余公积", None, 2, 33, 0, Some("4101")),
            ("BS604", "未分配利润", None, 2, 34, 0, Some("4104")),
            ("BS699", "所有者权益合计", None, 2, 35, 1, None),
            ("BS799", "负债和所有者权益总计", None, 1, 36, 1, None),
        ];

        for (item_code, item_name, _parent_id, level, sort_order, is_total, formula) in &bs_items {
            sqlx::query(
                "INSERT OR IGNORE INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&bs_id)
            .bind(item_code)
            .bind(item_name)
            .bind(level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .execute(pool)
            .await?;
        }

        // Income Statement template
        let is_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, accounting_system, form_code, reporting_frequency, is_statutory, is_system) VALUES (?, 'ENTERPRISE_INCOME_STATEMENT', '利润表', 'income_statement', 'enterprise', '会企 02 表', '月报、季报、年报', 1, 1)",
        )
        .bind(&is_id)
        .execute(pool)
        .await?;

        let is_items: Vec<StatementSeed> = vec![
            ("IS001", "一、营业收入", 1, 1, 0, Some("6001+6051")),
            ("IS002", "减：营业成本", 1, 2, 0, Some("6401+6402")),
            ("IS003", "税金及附加", 1, 3, 0, Some("6403")),
            ("IS004", "销售费用", 1, 4, 0, Some("6601")),
            ("IS005", "管理费用", 1, 5, 0, Some("6602")),
            ("IS006", "财务费用", 1, 6, 0, Some("6603")),
            ("IS007", "资产减值损失", 1, 7, 0, Some("6701")),
            ("IS008", "加：公允价值变动收益", 1, 8, 0, Some("6101")),
            ("IS009", "投资收益", 1, 9, 0, Some("6111")),
            ("IS010", "二、营业利润", 1, 10, 1, None),
            ("IS011", "加：营业外收入", 1, 11, 0, Some("6301")),
            ("IS012", "减：营业外支出", 1, 12, 0, Some("6711")),
            ("IS013", "三、利润总额", 1, 13, 1, None),
            ("IS014", "减：所得税费用", 1, 14, 0, Some("6801")),
            ("IS015", "四、净利润", 1, 15, 1, None),
        ];

        for (item_code, item_name, level, sort_order, is_total, formula) in &is_items {
            sqlx::query(
                "INSERT OR IGNORE INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&is_id)
            .bind(item_code)
            .bind(item_name)
            .bind(level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .execute(pool)
            .await?;
        }

        // Cash Flow Statement template
        let cf_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, accounting_system, form_code, reporting_frequency, is_statutory, is_system) VALUES (?, 'ENTERPRISE_CASH_FLOW', '现金流量表', 'cash_flow', 'enterprise', '会企 03 表', '月报、季报、年报', 1, 1)",
        )
        .bind(&cf_id)
        .execute(pool)
        .await?;

        let cf_items: Vec<StatementSeed> = vec![
            // Operating activities
            ("CF100", "一、经营活动产生的现金流量", 1, 1, 0, None),
            (
                "CF101",
                "销售商品、提供劳务收到的现金",
                2,
                2,
                0,
                Some("credit:1121+credit:1122+credit:1123+credit:1221"),
            ),
            ("CF102", "收到的税费返还", 2, 3, 0, None),
            ("CF103", "收到其他与经营活动有关的现金", 2, 4, 0, None),
            (
                "CF104",
                "购买商品、接受劳务支付的现金",
                2,
                5,
                0,
                Some("debit:2201+debit:2202+debit:2203+debit:2241"),
            ),
            (
                "CF105",
                "支付给职工以及为职工支付的现金",
                2,
                6,
                0,
                Some("debit:2211"),
            ),
            ("CF106", "支付的各项税费", 2, 7, 0, Some("debit:2221")),
            ("CF107", "支付其他与经营活动有关的现金", 2, 8, 0, None),
            ("CF199", "经营活动产生的现金流量净额", 1, 9, 1, None),
            // Investing activities
            ("CF200", "二、投资活动产生的现金流量", 1, 10, 0, None),
            ("CF201", "收回投资收到的现金", 2, 11, 0, None),
            ("CF202", "取得投资收益收到的现金", 2, 12, 0, None),
            (
                "CF203",
                "处置固定资产、无形资产收回的现金净额",
                2,
                13,
                0,
                None,
            ),
            (
                "CF204",
                "购建固定资产、无形资产支付的现金",
                2,
                14,
                0,
                Some("debit:1601+debit:1604+debit:1701"),
            ),
            ("CF205", "投资支付的现金", 2, 15, 0, None),
            ("CF299", "投资活动产生的现金流量净额", 1, 16, 1, None),
            // Financing activities
            ("CF300", "三、筹资活动产生的现金流量", 1, 17, 0, None),
            (
                "CF301",
                "吸收投资收到的现金",
                2,
                18,
                0,
                Some("credit:4001+credit:4002"),
            ),
            (
                "CF302",
                "取得借款收到的现金",
                2,
                19,
                0,
                Some("credit:2001+credit:2501"),
            ),
            ("CF303", "偿还债务支付的现金", 2, 20, 0, None),
            (
                "CF304",
                "分配股利、利润或偿付利息支付的现金",
                2,
                21,
                0,
                None,
            ),
            ("CF399", "筹资活动产生的现金流量净额", 1, 22, 1, None),
            // Summary
            ("CF400", "四、汇率变动对现金的影响", 1, 23, 0, None),
            (
                "CF999",
                "五、期末现金及现金等价物余额",
                1,
                24,
                1,
                Some("1001+1002+1012"),
            ),
        ];

        for (item_code, item_name, level, sort_order, is_total, formula) in &cf_items {
            sqlx::query(
                "INSERT OR IGNORE INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&cf_id)
            .bind(item_code)
            .bind(item_name)
            .bind(level)
            .bind(sort_order)
            .bind(is_total)
            .bind(formula)
            .execute(pool)
            .await?;
        }

        let small_balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("1001+1002+1012"), Some("1")),
            ("BS102", "短期投资", 2, 3, 0, Some("1101"), Some("2")),
            ("BS103", "应收票据", 2, 4, 0, Some("1121"), Some("3")),
            ("BS104", "应收账款", 2, 5, 0, Some("1122"), Some("4")),
            ("BS105", "预付账款", 2, 6, 0, Some("1123"), Some("5")),
            ("BS106", "应收股利", 2, 7, 0, Some("1131"), Some("6")),
            ("BS107", "应收利息", 2, 8, 0, Some("1132"), Some("7")),
            ("BS108", "其他应收款", 2, 9, 0, Some("1221"), Some("8")),
            ("BS109", "存货", 2, 10, 0, Some("1401+1402+1403+1404+1405-1407+1408+1411+4001"), Some("9")),
            ("BS110", "其中：原材料", 3, 11, 0, Some("1403"), Some("10")),
            ("BS111", "在产品", 3, 12, 0, Some("4001"), Some("11")),
            ("BS112", "库存商品", 3, 13, 0, Some("1405"), Some("12")),
            ("BS113", "周转材料", 3, 14, 0, Some("1411"), Some("13")),
            ("BS114", "其他流动资产", 2, 15, 0, Some("1421"), Some("14")),
            ("BS199", "流动资产合计", 2, 16, 1, Some("1001+1002+1012+1101+1121+1122+1123+1131+1132+1221+1401+1402+1403+1404+1405-1407+1408+1411+4001+1421"), Some("15")),
            ("BS200", "非流动资产", 1, 17, 0, None, None),
            ("BS201", "长期债券投资", 2, 18, 0, Some("1501"), Some("16")),
            ("BS202", "长期股权投资", 2, 19, 0, Some("1511"), Some("17")),
            ("BS203", "固定资产原价", 2, 20, 0, Some("1601"), Some("18")),
            ("BS204", "减：累计折旧", 2, 21, 0, Some("1602"), Some("19")),
            ("BS205", "固定资产账面价值", 2, 22, 0, Some("1601-1602"), Some("20")),
            ("BS206", "在建工程", 2, 23, 0, Some("1604"), Some("21")),
            ("BS207", "工程物资", 2, 24, 0, Some("1605"), Some("22")),
            ("BS208", "固定资产清理", 2, 25, 0, Some("1606"), Some("23")),
            ("BS209", "生产性生物资产", 2, 26, 0, Some("1621-1622"), Some("24")),
            ("BS210", "无形资产", 2, 27, 0, Some("1701-1702"), Some("25")),
            ("BS211", "开发支出", 2, 28, 0, Some("4301"), Some("26")),
            ("BS212", "长期待摊费用", 2, 29, 0, Some("1801"), Some("27")),
            ("BS299", "非流动资产合计", 2, 30, 1, Some("1501+1511+1601-1602+1604+1605+1606+1621-1622+1701-1702+4301+1801"), Some("29")),
            ("BS999", "资产总计", 1, 31, 1, Some("1001+1002+1012+1101+1121+1122+1123+1131+1132+1221+1401+1402+1403+1404+1405-1407+1408+1411+4001+1421+1501+1511+1601-1602+1604+1605+1606+1621-1622+1701-1702+4301+1801"), Some("30")),
            ("BS300", "流动负债", 1, 32, 0, None, None),
            ("BS301", "短期借款", 2, 33, 0, Some("2001"), Some("31")),
            ("BS302", "应付票据", 2, 34, 0, Some("2201"), Some("32")),
            ("BS303", "应付账款", 2, 35, 0, Some("2202"), Some("33")),
            ("BS304", "预收账款", 2, 36, 0, Some("2203"), Some("34")),
            ("BS305", "应付职工薪酬", 2, 37, 0, Some("2211"), Some("35")),
            ("BS306", "应交税费", 2, 38, 0, Some("2221"), Some("36")),
            ("BS307", "应付利息", 2, 39, 0, Some("2231"), Some("37")),
            ("BS308", "应付利润", 2, 40, 0, Some("2232"), Some("38")),
            ("BS309", "其他应付款", 2, 41, 0, Some("2241"), Some("39")),
            ("BS399", "流动负债合计", 2, 42, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241"), Some("41")),
            ("BS400", "非流动负债", 1, 43, 0, None, None),
            ("BS401", "长期借款", 2, 44, 0, Some("2501"), Some("42")),
            ("BS402", "长期应付款", 2, 45, 0, Some("2701"), Some("43")),
            ("BS403", "递延收益", 2, 46, 0, Some("2401"), Some("44")),
            ("BS499", "非流动负债合计", 2, 47, 1, Some("2401+2501+2701"), Some("46")),
            ("BS599", "负债合计", 1, 48, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241+2401+2501+2701"), Some("47")),
            ("BS600", "所有者权益（或股东权益）", 1, 49, 0, None, None),
            ("BS601", "实收资本（或股本）", 2, 50, 0, Some("3001"), Some("48")),
            ("BS602", "资本公积", 2, 51, 0, Some("3002"), Some("49")),
            ("BS603", "盈余公积", 2, 52, 0, Some("3101"), Some("50")),
            ("BS604", "未分配利润", 2, 53, 0, Some("3103+3104"), Some("51")),
            ("BS699", "所有者权益（或股东权益）合计", 2, 54, 1, Some("3001+3002+3101+3103+3104"), Some("52")),
            ("BS799", "负债和所有者权益（或股东权益）总计", 1, 55, 1, Some("2001+2201+2202+2203+2211+2221+2231+2232+2241+2401+2501+2701+3001+3002+3101+3103+3104"), Some("53")),
        ];
        Self::insert_standard_report_template(
            pool,
            "SMALL_ENTERPRISE_BALANCE_SHEET",
            "资产负债表",
            "balance_sheet",
            "small_enterprise",
            Some("会小企 01 表"),
            "月报、年报",
            1,
            &small_balance_items,
        )
        .await?;

        let small_income_items: Vec<StandardReportItemSeed> = vec![
            (
                "IS001",
                "一、营业收入",
                1,
                1,
                0,
                Some("5001+5051"),
                Some("1"),
            ),
            (
                "IS002",
                "减：营业成本",
                1,
                2,
                0,
                Some("5401+5402"),
                Some("2"),
            ),
            ("IS003", "营业税金及附加", 1, 3, 0, Some("5403"), Some("3")),
            ("IS004", "销售费用", 1, 4, 0, Some("5601"), Some("11")),
            ("IS005", "管理费用", 1, 5, 0, Some("5602"), Some("14")),
            ("IS006", "财务费用", 1, 6, 0, Some("5603"), Some("18")),
            ("IS009", "加：投资收益", 1, 7, 0, Some("5111"), Some("20")),
            ("IS010", "二、营业利润", 1, 8, 1, None, Some("21")),
            ("IS011", "加：营业外收入", 1, 9, 0, Some("5301"), Some("22")),
            (
                "IS012",
                "减：营业外支出",
                1,
                10,
                0,
                Some("5711"),
                Some("24"),
            ),
            ("IS013", "三、利润总额", 1, 11, 1, None, Some("30")),
            (
                "IS014",
                "减：所得税费用",
                1,
                12,
                0,
                Some("5801"),
                Some("31"),
            ),
            ("IS015", "四、净利润", 1, 13, 1, None, Some("32")),
        ];
        Self::insert_standard_report_template(
            pool,
            "SMALL_ENTERPRISE_INCOME_STATEMENT",
            "利润表",
            "income_statement",
            "small_enterprise",
            Some("会小企 02 表"),
            "月报、年报",
            1,
            &small_income_items,
        )
        .await?;

        let small_cash_items: Vec<StandardReportItemSeed> = vec![
            ("CF100", "一、经营活动产生的现金流量", 1, 1, 0, None, None),
            (
                "CF101",
                "销售产成品、商品、提供劳务收到的现金",
                2,
                2,
                0,
                Some("credit:1121+credit:1122+credit:1123+credit:1221"),
                Some("1"),
            ),
            (
                "CF104",
                "购买原材料、商品、接受劳务支付的现金",
                2,
                3,
                0,
                Some("debit:2201+debit:2202+debit:2203+debit:2241"),
                Some("3"),
            ),
            (
                "CF105",
                "支付的职工薪酬",
                2,
                4,
                0,
                Some("debit:2211"),
                Some("4"),
            ),
            (
                "CF106",
                "支付的税费",
                2,
                5,
                0,
                Some("debit:2221"),
                Some("5"),
            ),
            (
                "CF199",
                "经营活动产生的现金流量净额",
                1,
                6,
                1,
                None,
                Some("7"),
            ),
            ("CF200", "二、投资活动产生的现金流量", 1, 7, 0, None, None),
            (
                "CF204",
                "购建固定资产、无形资产和其他非流动资产支付的现金",
                2,
                8,
                0,
                Some("debit:1601+debit:1604+debit:1701"),
                Some("12"),
            ),
            (
                "CF299",
                "投资活动产生的现金流量净额",
                1,
                9,
                1,
                None,
                Some("13"),
            ),
            ("CF300", "三、筹资活动产生的现金流量", 1, 10, 0, None, None),
            (
                "CF301",
                "吸收投资者投资收到的现金",
                2,
                11,
                0,
                Some("credit:3001+credit:3002"),
                Some("15"),
            ),
            (
                "CF302",
                "取得借款收到的现金",
                2,
                12,
                0,
                Some("credit:2001+credit:2501"),
                Some("14"),
            ),
            (
                "CF399",
                "筹资活动产生的现金流量净额",
                1,
                13,
                1,
                None,
                Some("19"),
            ),
            ("CF400", "四、现金净增加额", 1, 14, 0, None, Some("20")),
            (
                "CF999",
                "五、期末现金余额",
                1,
                15,
                1,
                Some("1001+1002+1012"),
                Some("22"),
            ),
        ];
        Self::insert_standard_report_template(
            pool,
            "SMALL_ENTERPRISE_CASH_FLOW",
            "现金流量表",
            "cash_flow",
            "small_enterprise",
            Some("会小企 03 表"),
            "月报、年报",
            1,
            &small_cash_items,
        )
        .await?;

        let non_profit_balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("1001+1002+1009"), None),
            ("BS102", "短期投资", 2, 3, 0, Some("1101-1102"), None),
            ("BS103", "应收款项", 2, 4, 0, Some("1111+1121+1122-1131"), None),
            ("BS104", "预付账款", 2, 5, 0, Some("1141"), None),
            ("BS105", "存货", 2, 6, 0, Some("1201-1202"), None),
            ("BS106", "待摊费用", 2, 7, 0, Some("1301"), None),
            ("BS199", "流动资产合计", 2, 8, 1, Some("1001+1002+1009+1101-1102+1111+1121+1122-1131+1141+1201-1202+1301"), None),
            ("BS200", "非流动资产", 1, 9, 0, None, None),
            ("BS201", "长期投资", 2, 10, 0, Some("1401+1402+1403-1421"), None),
            ("BS202", "固定资产", 2, 11, 0, Some("1501-1502+1505+1509"), None),
            ("BS203", "文物资源", 2, 12, 0, Some("1506"), None),
            ("BS204", "无形资产", 2, 13, 0, Some("1601-1602"), None),
            ("BS205", "长期待摊费用", 2, 14, 0, Some("1701"), None),
            ("BS206", "受托代理资产", 2, 15, 0, Some("1801"), None),
            ("BS299", "非流动资产合计", 2, 16, 1, Some("1401+1402+1403-1421+1501-1502+1505+1506+1509+1601-1602+1701+1801"), None),
            ("BS999", "资产总计", 1, 17, 1, Some("1001+1002+1009+1101-1102+1111+1121+1122-1131+1141+1201-1202+1301+1401+1402+1403-1421+1501-1502+1505+1506+1509+1601-1602+1701+1801"), None),
            ("BS300", "负债", 1, 18, 0, None, None),
            ("BS301", "流动负债", 2, 19, 0, Some("2101+2201+2202+2203+2204+2206+2209+2301"), None),
            ("BS401", "长期负债", 2, 20, 0, Some("2501+2502+2503"), None),
            ("BS402", "受托代理负债", 2, 21, 0, Some("2601"), None),
            ("BS599", "负债合计", 1, 22, 1, Some("2101+2201+2202+2203+2204+2206+2209+2301+2501+2502+2503+2601"), None),
            ("BS600", "净资产", 1, 23, 0, None, None),
            ("BS601", "非限定性净资产", 2, 24, 0, Some("3101+3201"), None),
            ("BS602", "限定性净资产", 2, 25, 0, Some("3102"), None),
            ("BS699", "净资产合计", 2, 26, 1, Some("3101+3102+3201"), None),
            ("BS799", "负债和净资产总计", 1, 27, 1, Some("2101+2201+2202+2203+2204+2206+2209+2301+2501+2502+2503+2601+3101+3102+3201"), None),
        ];
        Self::insert_standard_report_template(
            pool,
            "NON_PROFIT_BALANCE_SHEET",
            "资产负债表",
            "balance_sheet",
            "non_profit",
            Some("会民非 01 表"),
            "中期报告、年度报告",
            1,
            &non_profit_balance_items,
        )
        .await?;

        let non_profit_income_items: Vec<StandardReportItemSeed> = vec![
            (
                "IS001",
                "一、收入合计",
                1,
                1,
                0,
                Some("4101+4201+4301+4401+4501+4601+4701+4901"),
                None,
            ),
            ("IS002", "二、业务活动成本", 1, 2, 0, Some("5101"), None),
            ("IS003", "税金及附加", 1, 3, 0, Some("5201"), None),
            ("IS004", "管理费用", 1, 4, 0, Some("5301"), None),
            ("IS005", "筹资费用", 1, 5, 0, Some("5401"), None),
            ("IS006", "资产减值损失", 1, 6, 0, Some("5501"), None),
            ("IS007", "所得税费用", 1, 7, 0, Some("5601"), None),
            ("IS012", "其他费用", 1, 8, 0, Some("5901"), None),
            ("IS015", "六、净资产变动额", 1, 9, 1, None, None),
        ];
        Self::insert_standard_report_template(
            pool,
            "NON_PROFIT_INCOME_STATEMENT",
            "业务活动表",
            "income_statement",
            "non_profit",
            Some("会民非 02 表"),
            "中期报告、年度报告",
            1,
            &non_profit_income_items,
        )
        .await?;

        let non_profit_cash_items: Vec<StandardReportItemSeed> = vec![
            ("CF100", "一、业务活动产生的现金流量", 1, 1, 0, None, None),
            (
                "CF101",
                "业务活动现金流入",
                2,
                2,
                0,
                Some("credit:1121+credit:1122+credit:1141"),
                None,
            ),
            (
                "CF104",
                "业务活动现金流出",
                2,
                3,
                0,
                Some("debit:2201+debit:2202+debit:2203+debit:2209"),
                None,
            ),
            ("CF199", "业务活动产生的现金流量净额", 1, 4, 1, None, None),
            ("CF200", "二、投资活动产生的现金流量", 1, 5, 0, None, None),
            (
                "CF204",
                "投资活动现金流出",
                2,
                6,
                0,
                Some("debit:1401+debit:1402+debit:1403+debit:1501+debit:1505+debit:1601"),
                None,
            ),
            ("CF299", "投资活动产生的现金流量净额", 1, 7, 1, None, None),
            ("CF300", "三、筹资活动产生的现金流量", 1, 8, 0, None, None),
            (
                "CF302",
                "借款所收到的现金",
                2,
                9,
                0,
                Some("credit:2101+credit:2501"),
                None,
            ),
            ("CF399", "筹资活动产生的现金流量净额", 1, 10, 1, None, None),
            ("CF400", "四、汇率变动对现金的影响额", 1, 11, 0, None, None),
            (
                "CF999",
                "五、现金及现金等价物净增加额",
                1,
                12,
                1,
                None,
                None,
            ),
        ];
        Self::insert_standard_report_template(
            pool,
            "NON_PROFIT_CASH_FLOW",
            "现金流量表",
            "cash_flow",
            "non_profit",
            Some("会民非 03 表"),
            "年度报告",
            1,
            &non_profit_cash_items,
        )
        .await?;

        let cooperative_balance_items: Vec<StandardReportItemSeed> = vec![
            ("BS100", "流动资产", 1, 1, 0, None, None),
            ("BS101", "货币资金", 2, 2, 0, Some("101+102"), Some("1")),
            ("BS102", "应收款项", 2, 3, 0, Some("113+closing_d:114"), Some("2")),
            ("BS103", "存货", 2, 4, 0, Some("121+124+125+127+128+401"), Some("3")),
            ("BS104", "消耗性生物资产", 2, 5, 0, Some("141"), Some("4")),
            ("BS199", "流动资产合计", 2, 6, 1, Some("101+102+113+closing_d:114+121+124+125+127+128+401+141"), Some("5")),
            ("BS200", "非流动资产", 1, 7, 0, None, None),
            ("BS201", "对外投资", 2, 8, 0, Some("131"), Some("6")),
            ("BS202", "生产性生物资产净值", 2, 9, 0, Some("142-143"), Some("9")),
            ("BS203", "固定资产净值", 2, 10, 0, Some("151-152"), Some("12")),
            ("BS204", "在建工程", 2, 11, 0, Some("153"), Some("13")),
            ("BS205", "固定资产清理", 2, 12, 0, Some("154"), Some("14")),
            ("BS206", "无形资产净值", 2, 13, 0, Some("161-162"), Some("18")),
            ("BS207", "公益性生物资产", 2, 14, 0, Some("144"), Some("19")),
            ("BS208", "长期待摊费用", 2, 15, 0, Some("171"), Some("20")),
            ("BS299", "非流动资产合计", 2, 16, 1, Some("131+142-143+151-152+153+154+161-162+144+171"), Some("21")),
            ("BS999", "资产总计", 1, 17, 1, Some("101+102+113+closing_d:114+121+124+125+127+128+401+141+131+142-143+151-152+153+154+161-162+144+171"), Some("22")),
            ("BS300", "流动负债", 1, 18, 0, None, None),
            ("BS301", "短期借款", 2, 19, 0, Some("201"), Some("23")),
            ("BS302", "应付款项", 2, 20, 0, Some("211+closing_c:114"), Some("24")),
            ("BS303", "应付工资", 2, 21, 0, Some("212"), Some("25")),
            ("BS304", "应付劳务费", 2, 22, 0, Some("213"), Some("26")),
            ("BS305", "应交税费", 2, 23, 0, Some("214"), Some("27")),
            ("BS306", "应付利息", 2, 24, 0, Some("215"), Some("28")),
            ("BS307", "应付盈余返还", 2, 25, 0, Some("221"), Some("29")),
            ("BS308", "应付剩余盈余", 2, 26, 0, Some("222"), Some("30")),
            ("BS399", "流动负债合计", 2, 27, 1, Some("201+211+closing_c:114+212+213+214+215+221+222"), Some("31")),
            ("BS401", "长期借款", 2, 28, 0, Some("231"), Some("32")),
            ("BS402", "专项应付款", 2, 29, 0, Some("235"), Some("33")),
            ("BS599", "负债合计", 1, 30, 1, Some("201+211+closing_c:114+212+213+214+215+221+222+231+235"), Some("35")),
            ("BS600", "所有者权益", 1, 31, 0, None, None),
            ("BS601", "股金", 2, 32, 0, Some("301"), Some("36")),
            ("BS602", "专项基金", 2, 33, 0, Some("311"), Some("37")),
            ("BS603", "资本公积", 2, 34, 0, Some("321"), Some("38")),
            ("BS604", "盈余公积", 2, 35, 0, Some("322"), Some("39")),
            ("BS605", "未分配盈余", 2, 36, 0, Some("331+332"), Some("40")),
            ("BS699", "所有者权益合计", 2, 37, 1, Some("301+311+321+322+331+332"), Some("41")),
            ("BS799", "负债和所有者权益总计", 1, 38, 1, Some("201+211+closing_c:114+212+213+214+215+221+222+231+235+301+311+321+322+331+332"), Some("42")),
        ];
        Self::insert_standard_report_template(
            pool,
            "COOPERATIVE_BALANCE_SHEET",
            "资产负债表",
            "balance_sheet",
            "cooperative",
            Some("会农社 01 表"),
            "月报、年报",
            1,
            &cooperative_balance_items,
        )
        .await?;

        let cooperative_income_items: Vec<StandardReportItemSeed> = vec![
            ("IS001", "一、经营收入", 1, 1, 0, Some("501"), Some("1")),
            ("IS009", "加：投资收益", 1, 2, 0, Some("511"), Some("2")),
            ("IS002", "减：经营支出", 1, 3, 0, Some("521"), Some("3")),
            ("IS003", "税金及附加", 1, 4, 0, Some("522"), Some("4")),
            ("IS004", "管理费用", 1, 5, 0, Some("523"), Some("5")),
            ("IS005", "财务费用", 1, 6, 0, Some("524"), Some("6")),
            ("IS010", "二、经营收益", 1, 7, 1, None, Some("7")),
            ("IS011", "加：其他收入", 1, 8, 0, Some("502"), Some("8")),
            ("IS012", "减：其他支出", 1, 9, 0, Some("529"), Some("9")),
            ("IS013", "三、盈余总额", 1, 10, 1, None, Some("10")),
            ("IS014", "减：所得税费用", 1, 11, 0, Some("531"), Some("11")),
            ("IS015", "四、本年盈余", 1, 12, 1, None, Some("12")),
        ];
        Self::insert_standard_report_template(
            pool,
            "COOPERATIVE_INCOME_STATEMENT",
            "盈余及盈余分配表",
            "income_statement",
            "cooperative",
            Some("会农社 02 表"),
            "年报",
            1,
            &cooperative_income_items,
        )
        .await?;

        let cooperative_equity_items: Vec<StandardReportItemSeed> = vec![
            ("EQ001", "股金", 1, 1, 0, Some("301"), None),
            ("EQ002", "专项基金", 1, 2, 0, Some("311"), None),
            ("EQ003", "资本公积", 1, 3, 0, Some("321"), None),
            ("EQ004", "盈余公积", 1, 4, 0, Some("322"), None),
            ("EQ005", "未分配盈余", 1, 5, 0, Some("331+332"), None),
            (
                "EQ999",
                "成员权益合计",
                1,
                6,
                1,
                Some("301+311+321+322+331+332"),
                None,
            ),
        ];
        Self::insert_standard_report_template(
            pool,
            "COOPERATIVE_EQUITY_CHANGE",
            "成员权益变动表",
            "equity_change",
            "cooperative",
            Some("会农社 03 表"),
            "年报",
            1,
            &cooperative_equity_items,
        )
        .await?;

        let cooperative_cash_items: Vec<StandardReportItemSeed> = vec![
            ("CF100", "经营活动产生的现金流量", 1, 1, 0, None, None),
            (
                "CF101",
                "经营活动现金流入",
                2,
                2,
                0,
                Some("credit:113+credit:114"),
                None,
            ),
            (
                "CF104",
                "经营活动现金流出",
                2,
                3,
                0,
                Some("debit:211+debit:114"),
                None,
            ),
            ("CF199", "经营活动现金流量净额", 1, 4, 1, None, None),
            ("CF999", "期末现金余额", 1, 5, 1, Some("101+102"), None),
        ];
        Self::insert_standard_report_template(
            pool,
            "COOPERATIVE_MANAGEMENT_CASH_FLOW",
            "现金收支分析表（管理报表）",
            "cash_flow",
            "cooperative",
            None,
            "按需",
            0,
            &cooperative_cash_items,
        )
        .await?;

        Ok(())
    }
}

// ==================== Model Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub real_name: String,
    pub role: String,
    pub role_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Company {
    pub id: String,
    pub code: String,
    pub name: String,
    pub tax_id: Option<String>,
    pub contact: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub tax_type: Option<String>,
    pub industry: Option<String>,
    pub accounting_system: Option<String>,
    pub province: Option<String>,
    pub city: Option<String>,
    pub district: Option<String>,
    pub enterprise_type: Option<String>,
    pub service_start: Option<String>,
    pub service_end: Option<String>,
    pub enable_year: Option<i32>,
    pub enable_month: Option<i32>,
    pub is_active: i32,
    pub is_deleted: i32,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountingPeriod {
    pub id: String,
    pub company_id: String,
    pub period_year: i32,
    pub period_month: i32,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub closed_at: Option<String>,
    pub closed_by: Option<String>,
    pub initial_balances_finalized_at: Option<String>,
    pub initial_balances_finalized_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountCode {
    pub code: String,
    pub company_id: String,
    pub name: String,
    pub account_type: String,
    pub normal_balance: String,
    pub level: i32,
    pub parent_code: Option<String>,
    pub is_detail: i32,
    pub is_enabled: i32,
    pub has_quantity: i32,
    pub default_unit: Option<String>,
    pub has_auxiliary: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VoucherWord {
    pub id: String,
    pub company_id: String,
    pub word_code: String,
    pub word_name: String,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Voucher {
    pub id: String,
    pub company_id: String,
    pub period_id: String,
    pub voucher_word_id: String,
    pub voucher_number: String,
    pub sequence_num: i32,
    pub voucher_date: String,
    pub summary: Option<String>,
    pub attachment_count: i32,
    pub status: String,
    pub total_debit: f64,
    pub total_credit: f64,
    pub version: i32,
    pub created_by: Option<String>,
    pub created_at: Option<String>,
    pub modified_by: Option<String>,
    pub modified_at: Option<String>,
    pub approved_by: Option<String>,
    pub approved_at: Option<String>,
    pub reversed_by: Option<String>,
    pub reversed_at: Option<String>,
    pub reversal_of_id: Option<String>,
    pub is_system: i32,
    pub reference_number: Option<String>,
    pub is_settlement: i32,
    pub settlement_rule_id: Option<String>,
    pub is_deleted: i32,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VoucherEntry {
    pub id: String,
    pub voucher_id: String,
    pub line_num: i32,
    pub account_code: String,
    pub account_name: String,
    pub direction: String,
    pub amount: f64,
    pub summary: Option<String>,
    pub auxiliary_type: Option<String>,
    pub auxiliary_id: Option<String>,
    pub doc_number: Option<String>,
    pub quantity: Option<f64>,
    pub unit_price: Option<f64>,
    pub unit: Option<String>,
    pub currency_id: Option<String>,
    pub exchange_rate: Option<f64>,
    pub created_at: String,
    #[serde(default)]
    pub auxiliary_items: Vec<VoucherEntryAuxiliaryValue>,
}

impl<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> for VoucherEntry {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            voucher_id: row.try_get("voucher_id")?,
            line_num: row.try_get("line_num")?,
            account_code: row.try_get("account_code")?,
            account_name: row.try_get("account_name")?,
            direction: row.try_get("direction")?,
            amount: row.try_get("amount")?,
            summary: row.try_get("summary")?,
            auxiliary_type: row.try_get("auxiliary_type")?,
            auxiliary_id: row.try_get("auxiliary_id")?,
            doc_number: row.try_get("doc_number")?,
            quantity: row.try_get("quantity")?,
            unit_price: row.try_get("unit_price")?,
            unit: row.try_get("unit")?,
            currency_id: row.try_get("currency_id")?,
            exchange_rate: row.try_get("exchange_rate")?,
            created_at: row.try_get("created_at")?,
            auxiliary_items: Vec::new(),
        })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VoucherEntryAuxiliaryValue {
    pub auxiliary_category_id: String,
    pub auxiliary_item_id: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountBalance {
    pub id: String,
    pub period_id: String,
    pub account_code: String,
    pub opening_debit: f64,
    pub opening_credit: f64,
    pub period_debit: f64,
    pub period_credit: f64,
    pub closing_debit: f64,
    pub closing_credit: f64,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InitialBalance {
    pub id: String,
    pub period_id: String,
    pub account_code: String,
    pub opening_debit: f64,
    pub opening_credit: f64,
    pub created_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VoucherLog {
    pub id: String,
    pub voucher_id: String,
    pub operation_type: String,
    pub before_data: Option<String>,
    pub after_data: Option<String>,
    pub operator_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ReportTemplate {
    pub id: String,
    pub template_code: String,
    pub template_name: String,
    pub report_type: String,
    pub company_id: Option<String>,
    pub accounting_system: String,
    pub form_code: Option<String>,
    pub reporting_frequency: String,
    pub is_statutory: i32,
    pub is_system: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ReportItem {
    pub id: String,
    pub template_id: String,
    pub item_code: String,
    pub item_name: String,
    pub parent_id: Option<String>,
    pub item_level: i32,
    pub sort_order: i32,
    pub is_total: i32,
    pub formula: Option<String>,
    pub line_number: Option<String>,
    pub calculation_sign: i32,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ReportAccountMapping {
    pub id: String,
    pub report_item_id: String,
    pub account_code: String,
    pub operation_type: String,
    pub coefficient: f64,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Counterparty {
    pub id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub counterparty_type: String,
    pub tax_id: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub is_enabled: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Invoice {
    pub id: String,
    pub company_id: String,
    pub period_id: Option<String>,
    pub invoice_type: String,
    pub invoice_no: String,
    pub invoice_code: Option<String>,
    pub invoice_date: String,
    pub amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub tax_rate: Option<f64>,
    pub seller_name: Option<String>,
    pub seller_tax_id: Option<String>,
    pub buyer_name: Option<String>,
    pub buyer_tax_id: Option<String>,
    pub status: String,
    pub voucher_id: Option<String>,
    pub remarks: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InvoiceLine {
    pub id: String,
    pub invoice_id: String,
    pub company_id: String,
    pub line_no: i32,
    pub item_name: String,
    pub specification: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<f64>,
    pub unit_price: Option<f64>,
    pub amount: f64,
    pub tax_rate: Option<f64>,
    pub tax_amount: f64,
    pub tax_classification_code: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InvoiceTaxEvent {
    pub id: String,
    pub invoice_id: String,
    pub company_id: String,
    pub event_type: String,
    pub deduction_period: Option<String>,
    pub deductible_tax_amount: f64,
    pub source: String,
    pub reference_no: Option<String>,
    pub remarks: Option<String>,
    pub operator: String,
    pub occurred_at: String,
}

// ==================== Input Structs ====================

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateCompanyInput {
    pub code: String,
    pub name: String,
    pub tax_id: Option<String>,
    pub tax_type: Option<String>,
    pub industry: Option<String>,
    pub accounting_system: Option<String>,
    pub province: Option<String>,
    pub city: Option<String>,
    pub district: Option<String>,
    pub enterprise_type: Option<String>,
    pub service_start: Option<String>,
    pub service_end: Option<String>,
    pub enable_year: Option<i32>,
    pub enable_month: Option<i32>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAccountCodeInput {
    pub code: String,
    pub company_id: String,
    pub name: String,
    pub account_type: String,
    pub normal_balance: Option<String>,
    pub level: i32,
    pub parent_code: Option<String>,
    pub is_detail: Option<i32>,
    pub has_quantity: Option<i32>,
    pub default_unit: Option<String>,
    pub has_auxiliary: Option<i32>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreatePeriodInput {
    pub company_id: String,
    pub period_year: i32,
    pub period_month: i32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateVoucherInput {
    pub company_id: String,
    pub period_id: String,
    pub voucher_word_id: String,
    pub voucher_date: String,
    pub voucher_number: Option<String>,
    pub summary: Option<String>,
    pub attachment_count: Option<i32>,
    pub reference_number: Option<String>,
    pub ai_suggestion_id: Option<String>,
    pub bank_transaction_id: Option<String>,
    pub business_source_kind: Option<String>,
    pub business_source_id: Option<String>,
    pub entries: Vec<CreateVoucherEntryInput>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateVoucherInput {
    pub id: String,
    pub voucher_date: Option<String>,
    pub summary: Option<String>,
    pub attachment_count: Option<i32>,
    pub version: Option<i32>,
    pub reference_number: Option<String>,
    pub entries: Option<Vec<CreateVoucherEntryInput>>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateVoucherEntryInput {
    pub account_code: String,
    pub account_name: String,
    pub direction: String,
    pub amount: f64,
    pub summary: Option<String>,
    pub auxiliary_type: Option<String>,
    pub auxiliary_id: Option<String>,
    pub doc_number: Option<String>,
    pub quantity: Option<f64>,
    pub unit_price: Option<f64>,
    pub unit: Option<String>,
    pub currency_id: Option<String>,
    pub exchange_rate: Option<f64>,
    pub auxiliary_items: Option<Vec<EntryAuxiliaryInput>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EntryAuxiliaryInput {
    pub auxiliary_category_id: String,
    pub auxiliary_item_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SaveInitialBalanceInput {
    pub period_id: String,
    pub account_code: String,
    pub opening_debit: f64,
    pub opening_credit: f64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ClosePeriodInput {
    pub period_id: String,
}

// ==================== Auxiliary Accounting Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AuxiliaryCategory {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub code: String,
    pub is_system: i32,
    pub sort_order: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AuxiliaryItem {
    pub id: String,
    pub category_id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub is_enabled: i32,
    pub remarks: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountAuxiliaryLink {
    pub id: String,
    pub account_code: String,
    pub auxiliary_category_id: String,
    pub is_required: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VoucherEntryAuxiliary {
    pub id: String,
    pub entry_id: String,
    pub auxiliary_category_id: String,
    pub auxiliary_item_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAuxiliaryCategoryInput {
    pub company_id: String,
    pub name: String,
    pub code: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAuxiliaryItemInput {
    pub category_id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub remarks: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct LinkAccountAuxiliaryInput {
    pub account_code: String,
    pub company_id: String,
    pub auxiliary_category_id: String,
    pub is_required: Option<i32>,
}

// ==================== Employee Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Employee {
    pub id: String,
    pub company_id: String,
    pub employee_code: String,
    pub name: String,
    pub id_no: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub mobile: Option<String>,
    pub entry_date: Option<String>,
    pub employment_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateEmployeeInput {
    pub company_id: String,
    pub employee_code: String,
    pub name: String,
    pub id_no: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub mobile: Option<String>,
    pub entry_date: Option<String>,
    pub employment_status: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateEmployeeInput {
    pub id: String,
    pub company_id: String,
    pub employee_code: String,
    pub name: String,
    pub id_no: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub mobile: Option<String>,
    pub entry_date: Option<String>,
    pub employment_status: Option<String>,
}

// ==================== Payroll Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct PayrollRecord {
    pub id: String,
    pub company_id: String,
    pub employee_id: String,
    pub employee_name: String,
    pub period: String,
    pub base_salary: f64,
    pub bonus: f64,
    pub tax_amount: f64,
    pub social_personal: f64,
    pub net_salary: f64,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreatePayrollRecordInput {
    pub company_id: String,
    pub employee_id: String,
    pub period: String,
    pub base_salary: f64,
    pub bonus: Option<f64>,
    pub tax_amount: Option<f64>,
    pub social_personal: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdatePayrollRecordInput {
    pub id: String,
    pub company_id: String,
    pub employee_id: String,
    pub period: String,
    pub base_salary: f64,
    pub bonus: Option<f64>,
    pub tax_amount: Option<f64>,
    pub social_personal: Option<f64>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct SocialSecurityRecord {
    pub id: String,
    pub company_id: String,
    pub employee_id: String,
    pub employee_name: String,
    pub period: String,
    pub city: Option<String>,
    pub contribution_base: f64,
    pub company_amount: f64,
    pub personal_amount: f64,
    pub fund_amount: f64,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSocialSecurityRecordInput {
    pub company_id: String,
    pub employee_id: String,
    pub period: String,
    pub city: Option<String>,
    pub contribution_base: f64,
    pub company_amount: f64,
    pub personal_amount: f64,
    pub fund_amount: f64,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateSocialSecurityRecordInput {
    pub id: String,
    pub company_id: String,
    pub city: Option<String>,
    pub contribution_base: f64,
    pub company_amount: f64,
    pub personal_amount: f64,
    pub fund_amount: f64,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct SpecialDeductionRecord {
    pub id: String,
    pub company_id: String,
    pub employee_id: String,
    pub employee_name: String,
    pub deduction_type: String,
    pub start_month: String,
    pub end_month: Option<String>,
    pub monthly_amount: f64,
    pub source: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSpecialDeductionRecordInput {
    pub company_id: String,
    pub employee_id: String,
    pub deduction_type: String,
    pub start_month: String,
    pub end_month: Option<String>,
    pub monthly_amount: f64,
    pub source: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateSpecialDeductionRecordInput {
    pub id: String,
    pub company_id: String,
    pub deduction_type: String,
    pub start_month: String,
    pub end_month: Option<String>,
    pub monthly_amount: f64,
    pub source: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct BankTransaction {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub account_name: String,
    pub serial_no: String,
    pub transaction_date: String,
    pub counterparty: Option<String>,
    pub summary: Option<String>,
    pub income_amount: f64,
    pub expense_amount: f64,
    pub balance: Option<f64>,
    pub receipt_status: String,
    pub match_result: Option<String>,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateBankTransactionInput {
    pub company_id: String,
    pub period: String,
    pub account_name: String,
    pub serial_no: String,
    pub transaction_date: String,
    pub counterparty: Option<String>,
    pub summary: Option<String>,
    pub income_amount: f64,
    pub expense_amount: f64,
    pub balance: Option<f64>,
    pub receipt_status: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateBankTransactionInput {
    pub id: String,
    pub company_id: String,
    pub account_name: String,
    pub serial_no: String,
    pub transaction_date: String,
    pub counterparty: Option<String>,
    pub summary: Option<String>,
    pub income_amount: f64,
    pub expense_amount: f64,
    pub balance: Option<f64>,
    pub receipt_status: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct DocumentRecord {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub business_date: String,
    pub document_code: String,
    pub business_type: String,
    pub partner: Option<String>,
    pub amount: f64,
    pub owner: Option<String>,
    pub attachment_status: String,
    pub stamp_tax_item: Option<String>,
    pub stamp_tax_rate: Option<f64>,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateDocumentRecordInput {
    pub company_id: String,
    pub period: String,
    pub business_date: String,
    pub document_code: String,
    pub business_type: String,
    pub partner: Option<String>,
    pub amount: f64,
    pub owner: Option<String>,
    pub attachment_status: Option<String>,
    pub stamp_tax_item: Option<String>,
    pub stamp_tax_rate: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateDocumentRecordInput {
    pub id: String,
    pub company_id: String,
    pub business_date: String,
    pub document_code: String,
    pub business_type: String,
    pub partner: Option<String>,
    pub amount: f64,
    pub owner: Option<String>,
    pub attachment_status: Option<String>,
    pub stamp_tax_item: Option<String>,
    pub stamp_tax_rate: Option<f64>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct BusinessOrder {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub order_type: String,
    pub order_no: String,
    pub business_date: String,
    pub counterparty: String,
    pub goods_name: String,
    pub amount: f64,
    pub fulfillment_status: String,
    pub invoice_status: String,
    pub settlement_status: String,
    pub status: String,
    pub source_document: Option<String>,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateBusinessOrderInput {
    pub company_id: String,
    pub period: String,
    pub order_type: String,
    pub order_no: String,
    pub business_date: String,
    pub counterparty: String,
    pub goods_name: String,
    pub amount: f64,
    pub fulfillment_status: Option<String>,
    pub invoice_status: Option<String>,
    pub settlement_status: Option<String>,
    pub status: Option<String>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateBusinessOrderInput {
    pub id: String,
    pub company_id: String,
    pub order_no: String,
    pub business_date: String,
    pub counterparty: String,
    pub goods_name: String,
    pub amount: f64,
    pub fulfillment_status: Option<String>,
    pub invoice_status: Option<String>,
    pub settlement_status: Option<String>,
    pub status: Option<String>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct SettlementRecord {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub settlement_type: String,
    pub settlement_no: String,
    pub settlement_date: String,
    pub counterparty: String,
    pub invoice_no: Option<String>,
    pub transaction_no: Option<String>,
    pub total_amount: f64,
    pub settled_amount: f64,
    pub balance_amount: f64,
    pub settlement_method: String,
    pub owner: Option<String>,
    pub status: String,
    pub source_document: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSettlementRecordInput {
    pub company_id: String,
    pub period: String,
    pub settlement_type: String,
    pub settlement_no: String,
    pub settlement_date: String,
    pub counterparty: String,
    pub invoice_no: Option<String>,
    pub transaction_no: Option<String>,
    pub total_amount: f64,
    pub settled_amount: f64,
    pub settlement_method: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateSettlementRecordInput {
    pub id: String,
    pub company_id: String,
    pub settlement_no: String,
    pub settlement_date: String,
    pub counterparty: String,
    pub invoice_no: Option<String>,
    pub transaction_no: Option<String>,
    pub total_amount: f64,
    pub settled_amount: f64,
    pub settlement_method: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct BankReconciliationRecord {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub reconciliation_no: String,
    pub reconciliation_date: String,
    pub bank_transaction_id: Option<String>,
    pub account_name: String,
    pub transaction_no: String,
    pub summary: Option<String>,
    pub bank_amount: f64,
    pub book_amount: f64,
    pub difference_amount: f64,
    pub voucher_no: Option<String>,
    pub match_status: String,
    pub owner: Option<String>,
    pub status: String,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateBankReconciliationRecordInput {
    pub company_id: String,
    pub period: String,
    pub reconciliation_no: String,
    pub reconciliation_date: String,
    pub bank_transaction_id: Option<String>,
    pub account_name: String,
    pub transaction_no: String,
    pub summary: Option<String>,
    pub bank_amount: f64,
    pub book_amount: f64,
    pub voucher_no: Option<String>,
    pub match_status: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateBankReconciliationRecordInput {
    pub id: String,
    pub company_id: String,
    pub reconciliation_no: String,
    pub reconciliation_date: String,
    pub bank_transaction_id: Option<String>,
    pub account_name: String,
    pub transaction_no: String,
    pub summary: Option<String>,
    pub bank_amount: f64,
    pub book_amount: f64,
    pub voucher_no: Option<String>,
    pub match_status: Option<String>,
    pub owner: Option<String>,
    pub status: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct CostCarryoverRecord {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub batch_no: String,
    pub carryover_date: String,
    pub valuation_method: String,
    pub source_bill_no: String,
    pub inventory_name: String,
    pub debit_subject: String,
    pub credit_subject: String,
    pub cost_amount: f64,
    pub difference_amount: f64,
    pub voucher_id: Option<String>,
    pub voucher_no: Option<String>,
    pub status: String,
    pub source_document: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateCostCarryoverRecordInput {
    pub id: String,
    pub company_id: String,
    pub batch_no: String,
    pub carryover_date: String,
    pub valuation_method: String,
    pub source_bill_no: String,
    pub inventory_name: String,
    pub debit_subject: String,
    pub credit_subject: String,
    pub cost_amount: f64,
    pub difference_amount: Option<f64>,
    pub voucher_no: Option<String>,
    pub status: Option<String>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountTransfer {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub transfer_date: String,
    pub from_account: String,
    pub to_account: String,
    pub amount: f64,
    pub fee: f64,
    pub serial_no: Option<String>,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAccountTransferInput {
    pub company_id: String,
    pub period: String,
    pub transfer_date: String,
    pub from_account: String,
    pub to_account: String,
    pub amount: f64,
    pub fee: Option<f64>,
    pub serial_no: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAccountTransferInput {
    pub id: String,
    pub company_id: String,
    pub transfer_date: String,
    pub from_account: String,
    pub to_account: String,
    pub amount: f64,
    pub fee: Option<f64>,
    pub serial_no: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct FixedAsset {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub asset_code: String,
    pub asset_name: String,
    pub category: String,
    pub category_id: Option<String>,
    pub start_date: String,
    pub original_value: f64,
    pub useful_life_months: i64,
    pub residual_rate: f64,
    pub depreciation_method: String,
    pub asset_account: String,
    pub accumulated_depreciation_account: String,
    pub expense_account: Option<String>,
    pub opening_accumulated_depreciation: f64,
    pub opening_depreciation_months: i64,
    pub source_document: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct DepreciationBatch {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub asset_count: i64,
    pub depreciation_amount: f64,
    pub voucher_id: Option<String>,
    pub voucher_number: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct FixedAssetDepreciationLine {
    pub id: String,
    pub batch_id: String,
    pub company_id: String,
    pub period: String,
    pub asset_id: String,
    pub asset_code: String,
    pub asset_name: String,
    pub category: String,
    pub depreciation_method: String,
    pub expense_account: String,
    pub accumulated_depreciation_account: String,
    pub depreciable_amount: f64,
    pub months_depreciated: i64,
    pub opening_accumulated_depreciation: f64,
    pub depreciation_amount: f64,
    pub closing_accumulated_depreciation: f64,
    pub closing_net_value: f64,
    pub voucher_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateFixedAssetInput {
    pub company_id: String,
    pub period: String,
    pub asset_code: String,
    pub asset_name: String,
    pub category_id: String,
    pub start_date: String,
    pub original_value: f64,
    pub useful_life_months: i64,
    pub residual_rate: Option<f64>,
    pub opening_accumulated_depreciation: Option<f64>,
    pub opening_depreciation_months: Option<i64>,
    pub source_document: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateFixedAssetInput {
    pub id: String,
    pub company_id: String,
    pub asset_code: String,
    pub asset_name: String,
    pub category_id: String,
    pub start_date: String,
    pub original_value: f64,
    pub useful_life_months: i64,
    pub residual_rate: Option<f64>,
    pub opening_accumulated_depreciation: Option<f64>,
    pub opening_depreciation_months: Option<i64>,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryMovement {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub movement_date: String,
    pub bill_no: String,
    pub movement_type: String,
    pub inventory_name: String,
    pub warehouse: String,
    pub counterparty: Option<String>,
    pub unit: String,
    pub quantity: f64,
    pub amount: f64,
    pub inventory_item_id: Option<String>,
    pub warehouse_id: Option<String>,
    pub direction: Option<String>,
    pub unit_cost: f64,
    pub confirmed_at: Option<String>,
    pub source_document: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryMovementInput {
    pub company_id: String,
    pub period: String,
    pub movement_date: String,
    pub bill_no: String,
    pub movement_type: String,
    pub inventory_item_id: String,
    pub warehouse_id: String,
    pub counterparty: Option<String>,
    pub quantity: f64,
    pub amount: f64,
    pub source_document: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryMovementInput {
    pub id: String,
    pub company_id: String,
    pub movement_date: String,
    pub bill_no: String,
    pub movement_type: String,
    pub inventory_item_id: String,
    pub warehouse_id: String,
    pub counterparty: Option<String>,
    pub quantity: f64,
    pub amount: f64,
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub company_id: String,
    pub item_code: String,
    pub item_name: String,
    pub specification: Option<String>,
    pub unit: String,
    pub unit_id: Option<String>,
    pub tax_rate: Option<f64>,
    pub default_subject: Option<String>,
    pub category: Option<String>,
    pub category_id: Option<String>,
    pub valuation_method: String,
    pub inventory_subject: String,
    pub cost_subject: String,
    pub safety_stock: f64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryItemInput {
    pub company_id: String,
    pub item_code: String,
    pub item_name: String,
    pub specification: Option<String>,
    pub unit_id: String,
    pub tax_rate: Option<f64>,
    pub default_subject: Option<String>,
    pub category_id: Option<String>,
    pub valuation_method: Option<String>,
    pub inventory_subject: Option<String>,
    pub cost_subject: Option<String>,
    pub safety_stock: Option<f64>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryItemInput {
    pub id: String,
    pub company_id: String,
    pub item_code: String,
    pub item_name: String,
    pub specification: Option<String>,
    pub unit_id: String,
    pub tax_rate: Option<f64>,
    pub default_subject: Option<String>,
    pub category_id: Option<String>,
    pub valuation_method: Option<String>,
    pub inventory_subject: Option<String>,
    pub cost_subject: Option<String>,
    pub safety_stock: Option<f64>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryCategory {
    pub id: String,
    pub company_id: String,
    pub category_code: String,
    pub category_name: String,
    pub inventory_subject: String,
    pub cost_subject: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryCategoryInput {
    pub company_id: String,
    pub category_code: String,
    pub category_name: String,
    pub inventory_subject: String,
    pub cost_subject: String,
    pub status: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryCategoryInput {
    pub id: String,
    pub company_id: String,
    pub category_code: String,
    pub category_name: String,
    pub inventory_subject: String,
    pub cost_subject: String,
    pub status: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryWarehouse {
    pub id: String,
    pub company_id: String,
    pub warehouse_code: String,
    pub warehouse_name: String,
    pub location: Option<String>,
    pub manager: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryWarehouseInput {
    pub company_id: String,
    pub warehouse_code: String,
    pub warehouse_name: String,
    pub location: Option<String>,
    pub manager: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryWarehouseInput {
    pub id: String,
    pub company_id: String,
    pub warehouse_code: String,
    pub warehouse_name: String,
    pub location: Option<String>,
    pub manager: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryBomLine {
    pub id: String,
    pub bom_id: String,
    pub company_id: String,
    pub component_item_id: String,
    pub component_item_code: String,
    pub component_item_name: String,
    pub component_specification: Option<String>,
    pub component_unit: String,
    pub quantity: f64,
    pub loss_rate: f64,
    pub sort_order: i64,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InventoryBom {
    pub id: String,
    pub company_id: String,
    pub bom_code: String,
    pub bom_name: String,
    pub version: String,
    pub parent_item_id: String,
    pub parent_item_code: String,
    pub parent_item_name: String,
    pub parent_specification: Option<String>,
    pub parent_unit: String,
    pub effective_date: String,
    pub expiration_date: Option<String>,
    pub status: String,
    pub note: Option<String>,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub lines: Vec<InventoryBomLine>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InventoryBomLineInput {
    pub component_item_id: String,
    pub quantity: f64,
    pub loss_rate: f64,
    pub sort_order: i64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryBomInput {
    pub company_id: String,
    pub bom_code: String,
    pub bom_name: String,
    pub version: String,
    pub parent_item_id: String,
    pub effective_date: String,
    pub expiration_date: Option<String>,
    pub status: Option<String>,
    pub note: Option<String>,
    pub lines: Vec<InventoryBomLineInput>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryBomInput {
    pub id: String,
    pub company_id: String,
    pub bom_code: String,
    pub bom_name: String,
    pub version: String,
    pub parent_item_id: String,
    pub effective_date: String,
    pub expiration_date: Option<String>,
    pub status: String,
    pub note: Option<String>,
    pub lines: Vec<InventoryBomLineInput>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryStockBalance {
    pub inventory_item_id: String,
    pub item_code: String,
    pub item_name: String,
    pub warehouse: String,
    pub unit: String,
    pub quantity: f64,
    pub amount: f64,
    pub average_unit_cost: f64,
    pub safety_stock: f64,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryOpeningBalance {
    pub id: String,
    pub company_id: String,
    pub period_id: String,
    pub period: String,
    pub inventory_item_id: String,
    pub warehouse_id: String,
    pub item_code: String,
    pub item_name: String,
    pub warehouse_name: String,
    pub unit: String,
    pub inventory_subject: String,
    pub quantity: f64,
    pub amount: f64,
    pub status: String,
    pub movement_id: Option<String>,
    pub confirmed_at: Option<String>,
    pub confirmed_by: Option<String>,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SaveInventoryOpeningBalanceInput {
    pub company_id: String,
    pub period_id: String,
    pub inventory_item_id: String,
    pub warehouse_id: String,
    pub quantity: f64,
    pub amount: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InventoryOpeningReconciliation {
    pub detail_amount: f64,
    pub ledger_amount: f64,
    pub difference_amount: f64,
    pub is_reconciled: bool,
    pub financial_opening_finalized: bool,
    pub inventory_opening_finalized: bool,
    pub message: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryStocktake {
    pub id: String,
    pub company_id: String,
    pub period_id: String,
    pub period: String,
    pub stocktake_no: String,
    pub stocktake_date: String,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub status: String,
    pub note: Option<String>,
    pub source_movement_max_rowid: i64,
    pub voucher_id: Option<String>,
    pub confirmed_at: Option<String>,
    pub confirmed_by: Option<String>,
    pub voided_at: Option<String>,
    pub voided_by: Option<String>,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryStocktakeLine {
    pub id: String,
    pub stocktake_id: String,
    pub company_id: String,
    pub inventory_item_id: String,
    pub item_code: String,
    pub item_name: String,
    pub unit: String,
    pub inventory_subject: String,
    pub book_quantity: f64,
    pub book_amount: f64,
    pub book_unit_cost: f64,
    pub actual_quantity: Option<f64>,
    pub actual_unit_cost: Option<f64>,
    pub variance_quantity: f64,
    pub variance_amount: f64,
    pub reason: Option<String>,
    pub movement_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryStocktakeInput {
    pub company_id: String,
    pub period_id: String,
    pub stocktake_date: String,
    pub warehouse_id: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct AddInventoryStocktakeLineInput {
    pub company_id: String,
    pub stocktake_id: String,
    pub inventory_item_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SaveInventoryStocktakeCountInput {
    pub company_id: String,
    pub line_id: String,
    pub actual_quantity: f64,
    pub actual_unit_cost: Option<f64>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct MeasurementUnit {
    pub id: String,
    pub company_id: String,
    pub unit_name: String,
    pub unit_group: Option<String>,
    pub base_unit: Option<String>,
    pub conversion_rate: f64,
    pub precision_digits: i64,
    pub remark: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateMeasurementUnitInput {
    pub company_id: String,
    pub unit_name: String,
    pub unit_group: Option<String>,
    pub base_unit: Option<String>,
    pub conversion_rate: f64,
    pub precision_digits: i64,
    pub remark: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateMeasurementUnitInput {
    pub id: String,
    pub company_id: String,
    pub unit_name: String,
    pub unit_group: Option<String>,
    pub base_unit: Option<String>,
    pub conversion_rate: f64,
    pub precision_digits: i64,
    pub remark: Option<String>,
}

// ==================== Currency Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Currency {
    pub id: String,
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub exchange_rate: f64,
    pub is_base: i32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateCurrencyInput {
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub exchange_rate: f64,
    pub is_base: Option<i32>,
}

// ==================== Voucher Template Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VoucherTemplateType {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct VoucherTemplate {
    pub id: String,
    pub type_id: String,
    pub company_id: String,
    pub name: String,
    pub entries_json: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateVoucherTemplateInput {
    pub type_id: String,
    pub company_id: String,
    pub name: String,
    pub entries_json: String,
}

// ==================== Common Digest Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct CommonDigest {
    pub id: String,
    pub company_id: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateCommonDigestInput {
    pub company_id: String,
    pub content: String,
}

// ==================== Settlement Rule Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct SettlementRule {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub rule_type: String,
    pub source_formula: Option<String>,
    pub target_account_code: Option<String>,
    pub voucher_word_id: Option<String>,
    pub summary_template: Option<String>,
    pub priority: i32,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSettlementRuleInput {
    pub company_id: String,
    pub name: String,
    pub rule_type: String,
    pub source_formula: Option<String>,
    pub target_account_code: Option<String>,
    pub voucher_word_id: Option<String>,
    pub summary_template: Option<String>,
    pub priority: Option<i32>,
}

// ==================== Agency Operation Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyServiceContract {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub contract_no: String,
    pub service_package: String,
    pub service_start: String,
    pub service_end: String,
    pub monthly_fee: f64,
    pub renewal_status: String,
    pub owner: Option<String>,
    pub archive_status: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAgencyServiceContractInput {
    pub company_id: String,
    pub contract_no: String,
    pub service_package: String,
    pub service_start: String,
    pub service_end: String,
    pub monthly_fee: f64,
    pub owner: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAgencyServiceContractInput {
    pub id: String,
    pub company_id: String,
    pub contract_no: String,
    pub service_package: String,
    pub service_start: String,
    pub service_end: String,
    pub monthly_fee: f64,
    pub renewal_status: String,
    pub archive_status: String,
    pub status: String,
    pub owner: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyFeeCollection {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub period: String,
    pub receivable_amount: f64,
    pub received_amount: f64,
    pub arrears_amount: f64,
    pub invoice_status: String,
    pub payment_status: String,
    pub collector: Option<String>,
    pub last_follow_up: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAgencyFeeCollectionInput {
    pub company_id: String,
    pub period: String,
    pub receivable_amount: f64,
    pub received_amount: f64,
    pub invoice_status: Option<String>,
    pub payment_status: Option<String>,
    pub collector: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAgencyFeeCollectionInput {
    pub id: String,
    pub company_id: String,
    pub period: String,
    pub receivable_amount: f64,
    pub received_amount: f64,
    pub invoice_status: String,
    pub payment_status: String,
    pub collector: Option<String>,
    pub last_follow_up: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyCollaborationItem {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub todo_title: String,
    pub material_type: Option<String>,
    pub customer_contact: Option<String>,
    pub reminder_count: i32,
    pub last_contact_at: Option<String>,
    pub reply_status: String,
    pub owner: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAgencyCollaborationItemInput {
    pub company_id: String,
    pub todo_title: String,
    pub material_type: Option<String>,
    pub customer_contact: Option<String>,
    pub reply_status: Option<String>,
    pub owner: Option<String>,
}
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAgencyCollaborationItemInput {
    pub id: String,
    pub company_id: String,
    pub todo_title: String,
    pub material_type: Option<String>,
    pub customer_contact: Option<String>,
    pub reply_status: String,
    pub owner: Option<String>,
    pub reminder_count: i32,
    pub last_contact_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyDeliveryTicket {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub ticket_no: String,
    pub task_name: String,
    pub period: String,
    pub current_stage: String,
    pub sla_status: String,
    pub owner: Option<String>,
    pub delivery_status: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyBatchTask {
    pub id: String,
    pub task_type: String,
    pub task_name: String,
    pub period: String,
    pub customer_scope: String,
    pub status: String,
    pub progress_current: i64,
    pub progress_total: Option<i64>,
    pub result_summary: Option<String>,
    pub risk_level: String,
    pub operator: Option<String>,
    pub requires_approval: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AgencyBatchTaskItem {
    pub id: String,
    pub task_id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub period_id: Option<String>,
    pub action: String,
    pub status: String,
    pub result_summary: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAgencyBatchTasksInput {
    pub period: String,
    #[serde(default)]
    pub task_types: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ReviewAgencyBatchTaskInput {
    pub id: String,
    pub decision: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RunAgencyBatchTaskInput {
    pub id: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct LocalFileRecord {
    pub id: String,
    pub record_kind: String,
    pub company_id: String,
    pub period: String,
    pub module_name: String,
    pub operation: Option<String>,
    pub file_name: String,
    pub file_size: i64,
    pub file_format: String,
    pub checksum: String,
    pub status: String,
    pub row_count: Option<i64>,
    pub column_preview: Option<String>,
    pub preview_rows: Option<String>,
    pub validation_note: Option<String>,
    pub written_row_count: Option<i64>,
    pub failed_row_count: Option<i64>,
    pub failure_rows: Option<String>,
    pub related_document: Option<String>,
    pub operator: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateLocalFileRecordInput {
    pub record_kind: String,
    pub company_id: String,
    pub period: String,
    pub module_name: String,
    pub operation: Option<String>,
    pub file_name: String,
    pub file_size: i64,
    pub file_format: String,
    pub checksum: String,
    pub status: Option<String>,
    pub row_count: Option<i64>,
    pub column_preview: Option<String>,
    pub preview_rows: Option<String>,
    pub validation_note: Option<String>,
    pub related_document: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateLocalFileRecordInput {
    pub id: String,
    pub company_id: String,
    pub status: String,
    pub related_document: Option<String>,
    pub validation_note: Option<String>,
    pub written_row_count: Option<i64>,
    pub failed_row_count: Option<i64>,
    pub failure_rows: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct DeleteLocalFileRecordInput {
    pub id: String,
    pub company_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CopyLocalVoucherAttachmentsInput {
    pub company_id: String,
    pub period: String,
    pub source_document: String,
    pub target_document: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ExportJobRecord {
    pub id: String,
    pub scope_kind: String,
    pub company_id: Option<String>,
    pub file_name: String,
    pub module_name: String,
    pub format: String,
    pub data_scope: String,
    pub fingerprint: String,
    pub operator: String,
    pub status: String,
    pub template_kind: String,
    pub row_count: i64,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateExportJobInput {
    pub scope_kind: String,
    pub company_id: Option<String>,
    pub file_name: String,
    pub module_name: String,
    pub format: String,
    pub data_scope: String,
    pub fingerprint: String,
    pub status: Option<String>,
    pub template_kind: String,
    pub row_count: i64,
}

// ==================== Automation and Adapter Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AutomationJob {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub period: Option<String>,
    pub job_type: String,
    pub source_module: String,
    pub source_id: Option<String>,
    pub source_file: Option<String>,
    pub suggestion_no: Option<String>,
    pub debit_subject: Option<String>,
    pub credit_subject: Option<String>,
    pub suggestion_amount: Option<f64>,
    pub generated_voucher_id: Option<String>,
    pub generated_voucher_number: Option<String>,
    pub status: String,
    pub confidence: Option<f64>,
    pub result_summary: Option<String>,
    pub risk_level: String,
    pub reviewer: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAutomationJobInput {
    pub company_id: String,
    pub period: Option<String>,
    pub job_type: String,
    pub source_module: String,
    pub source_id: Option<String>,
    pub source_file: Option<String>,
    pub suggestion_no: Option<String>,
    pub debit_subject: Option<String>,
    pub credit_subject: Option<String>,
    pub suggestion_amount: Option<f64>,
    pub status: Option<String>,
    pub confidence: Option<f64>,
    pub result_summary: Option<String>,
    pub risk_level: Option<String>,
    pub reviewer: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAutomationJobStatusInput {
    pub id: String,
    pub company_id: String,
    pub status: String,
    pub confidence: Option<f64>,
    pub result_summary: Option<String>,
    pub risk_level: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AiProviderConfig {
    pub id: String,
    pub company_id: String,
    pub provider_name: String,
    pub provider_type: String,
    pub endpoint: String,
    pub model: String,
    pub credential_env: String,
    pub timeout_seconds: i64,
    pub max_file_bytes: i64,
    pub is_enabled: i32,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpsertAiProviderConfigInput {
    pub id: Option<String>,
    pub company_id: String,
    pub provider_name: String,
    pub provider_type: String,
    pub endpoint: String,
    pub model: String,
    pub credential_env: String,
    pub timeout_seconds: i64,
    pub max_file_bytes: i64,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RunAiRecognitionJobInput {
    pub id: String,
    pub company_id: String,
    pub provider_config_id: String,
    pub disclosure_confirmed: bool,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct TaxDeclarationTask {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub period: String,
    pub tax_type: String,
    pub form_name: String,
    pub collect_status: String,
    pub validation_status: String,
    pub declaration_status: String,
    pub source_snapshot: Option<String>,
    pub taxable_amount: f64,
    pub deduction_amount: f64,
    pub payable_amount: f64,
    pub risk_count: i64,
    pub adapter_code: Option<String>,
    pub confirmed_by: Option<String>,
    pub confirmed_at: Option<String>,
    pub receipt_no: Option<String>,
    pub payment_status: String,
    pub payment_no: Option<String>,
    pub receipt_received_at: Option<String>,
    pub snapshot_version: i64,
    pub snapshot_fingerprint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpsertTaxDeclarationTaskInput {
    pub company_id: String,
    pub period: String,
    pub tax_type: String,
    pub form_name: String,
    pub collect_status: Option<String>,
    pub validation_status: Option<String>,
    pub declaration_status: Option<String>,
    pub source_snapshot: Option<String>,
    pub taxable_amount: Option<f64>,
    pub deduction_amount: Option<f64>,
    pub payable_amount: Option<f64>,
    pub risk_count: Option<i64>,
    pub adapter_code: Option<String>,
    pub receipt_no: Option<String>,
    pub payment_status: Option<String>,
    pub payment_no: Option<String>,
    pub receipt_received_at: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ConfirmTaxDeclarationTaskInput {
    pub id: String,
    pub company_id: String,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AdapterAuthorization {
    pub id: String,
    pub company_id: String,
    pub company_name: Option<String>,
    pub adapter_type: String,
    pub adapter_code: String,
    pub region: Option<String>,
    pub auth_status: String,
    pub account_mask: Option<String>,
    pub login_identity: Option<String>,
    pub capability_scope: Option<String>,
    pub last_checked_at: Option<String>,
    pub expires_at: Option<String>,
    pub risk_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpsertAdapterAuthorizationInput {
    pub company_id: String,
    pub adapter_type: String,
    pub adapter_code: String,
    pub region: Option<String>,
    pub auth_status: Option<String>,
    pub account_mask: Option<String>,
    pub login_identity: Option<String>,
    pub capability_scope: Option<String>,
    pub last_checked_at: Option<String>,
    pub expires_at: Option<String>,
    pub risk_message: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AdapterProviderConfig {
    pub id: String,
    pub company_id: String,
    pub authorization_id: String,
    pub provider_name: String,
    pub endpoint: String,
    pub credential_env: String,
    pub timeout_seconds: i64,
    pub is_enabled: i64,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpsertAdapterProviderConfigInput {
    pub id: Option<String>,
    pub company_id: String,
    pub authorization_id: String,
    pub provider_name: String,
    pub endpoint: String,
    pub credential_env: String,
    pub timeout_seconds: i64,
    pub is_enabled: i64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct VerifyAdapterAuthorizationInput {
    pub company_id: String,
    pub authorization_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SubmitTaxDeclarationTaskInput {
    pub company_id: String,
    pub task_id: String,
    pub authorization_id: String,
    pub submission_confirmed: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SyncTaxDeclarationReceiptInput {
    pub company_id: String,
    pub task_id: String,
    pub authorization_id: String,
    pub sync_confirmed: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SyncExternalInvoicePoolInput {
    pub company_id: String,
    pub authorization_id: String,
    pub period: String,
    pub source_cursor: Option<String>,
    pub sync_confirmed: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ReviewExternalInvoiceSyncItemInput {
    pub company_id: String,
    pub item_id: String,
    pub review_confirmed: bool,
    pub review_note: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ExternalInvoiceSyncItem {
    pub id: String,
    pub batch_id: String,
    pub company_id: String,
    pub external_invoice_id: String,
    pub invoice_type: String,
    pub invoice_code: Option<String>,
    pub invoice_no: String,
    pub invoice_date: String,
    pub seller_name: Option<String>,
    pub seller_tax_id: Option<String>,
    pub buyer_name: Option<String>,
    pub buyer_tax_id: Option<String>,
    pub amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub tax_rate: Option<f64>,
    pub currency: String,
    pub review_status: String,
    pub duplicate_invoice_id: Option<String>,
    pub payload_checksum: String,
    pub reviewed_by: Option<String>,
    pub reviewed_at: Option<String>,
    pub review_note: Option<String>,
    pub imported_invoice_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExternalInvoiceSyncResult {
    pub batch_id: String,
    pub staged_count: i64,
    pub duplicate_count: i64,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SyncExternalBankStatementInput {
    pub company_id: String,
    pub authorization_id: String,
    pub period: String,
    pub source_cursor: Option<String>,
    pub sync_confirmed: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ReviewExternalBankSyncItemInput {
    pub company_id: String,
    pub item_id: String,
    pub review_confirmed: bool,
    pub review_note: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ExternalBankSyncItem {
    pub id: String,
    pub batch_id: String,
    pub company_id: String,
    pub external_transaction_id: String,
    pub account_mask: String,
    pub transaction_date: String,
    pub value_date: Option<String>,
    pub direction: String,
    pub amount: f64,
    pub currency: String,
    pub counterparty_name: Option<String>,
    pub counterparty_account_mask: Option<String>,
    pub bank_reference: Option<String>,
    pub summary: Option<String>,
    pub balance: Option<f64>,
    pub review_status: String,
    pub duplicate_transaction_id: Option<String>,
    pub payload_checksum: String,
    pub reviewed_by: Option<String>,
    pub reviewed_at: Option<String>,
    pub review_note: Option<String>,
    pub imported_transaction_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExternalBankSyncResult {
    pub batch_id: String,
    pub staged_count: i64,
    pub duplicate_count: i64,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct OperationAuditLog {
    pub id: String,
    pub company_id: Option<String>,
    pub company_name: Option<String>,
    pub module_name: String,
    pub action: String,
    pub object_ref: Option<String>,
    pub risk_level: String,
    pub result: String,
    pub detail: Option<String>,
    pub operator: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateOperationAuditLogInput {
    pub company_id: Option<String>,
    pub module_name: String,
    pub action: String,
    pub object_ref: Option<String>,
    pub risk_level: Option<String>,
    pub result: Option<String>,
    pub detail: Option<String>,
}

// ==================== Dashboard Structs ====================

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct DashboardWidget {
    pub id: String,
    pub company_id: String,
    pub widget_type: String,
    pub title: String,
    pub config_json: String,
    pub position_x: i32,
    pub position_y: i32,
    pub width: i32,
    pub height: i32,
    pub is_enabled: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct FinancialIndicator {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub formula: String,
    pub unit: Option<String>,
    pub sort_order: i32,
    pub is_enabled: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::collections::{HashMap, HashSet};

    #[cfg(unix)]
    #[test]
    fn accounting_storage_permissions_are_private() {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

        let directory = std::env::temp_dir().join(format!(
            "accounting-private-storage-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&directory).expect("creates test directory");
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o777))
            .expect("widens test directory");
        let file_path = directory.join("accounting.db");
        std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .mode(0o666)
            .open(&file_path)
            .expect("creates test database");
        std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o666))
            .expect("widens test database");

        secure_private_directory(&directory).expect("secures directory");
        secure_private_file(&file_path).expect("secures database");

        assert_eq!(
            std::fs::metadata(&directory)
                .expect("reads directory metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        assert_eq!(
            std::fs::metadata(&file_path)
                .expect("reads file metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );

        std::fs::remove_dir_all(directory).expect("removes test directory");
    }

    fn top_level_accounts(codes: &[AccountCodeSeed]) -> HashMap<&'static str, &'static str> {
        codes
            .iter()
            .filter(|(_, _, _, _, level, _, _)| *level == 1)
            .map(|(code, name, _, _, _, _, _)| (*code, *name))
            .collect()
    }

    #[tokio::test]
    async fn release_recovery_upgrades_a_legacy_database_without_losing_business_data() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create legacy database");
        sqlx::query(
            "CREATE TABLE companies (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("create legacy companies table");
        sqlx::query(
            r#"CREATE TABLE tax_declaration_tasks (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                period TEXT NOT NULL,
                tax_type TEXT NOT NULL,
                form_name TEXT NOT NULL
            )"#,
        )
        .execute(&pool)
        .await
        .expect("create legacy tax task table");
        sqlx::query("INSERT INTO companies (id, code, name) VALUES ('c1', '001', '旧账套')")
            .execute(&pool)
            .await
            .expect("insert legacy company");
        sqlx::query(
            "INSERT INTO tax_declaration_tasks (id, company_id, period, tax_type, form_name) VALUES ('t1', 'c1', '2026-01', '增值税及附加', '增值税申报表')",
        )
        .execute(&pool)
        .await
        .expect("insert legacy business row");

        Database::run_versioned_migrations(&pool)
            .await
            .expect("upgrade legacy database");

        let versions: Vec<i64> =
            sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
                .fetch_all(&pool)
                .await
                .expect("read migration history");
        assert_eq!(
            versions,
            SCHEMA_MIGRATIONS
                .iter()
                .map(|migration| migration.version)
                .collect::<Vec<_>>()
        );
        let legacy_rows: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM tax_declaration_tasks WHERE id = 't1'")
                .fetch_one(&pool)
                .await
                .expect("read preserved legacy row");
        assert_eq!(legacy_rows, 1);
        for table_name in [
            "tax_deadline_rules",
            "tax_calendar_days",
            "ai_provider_configs",
            "ai_provider_runs",
            "adapter_provider_configs",
            "adapter_provider_verifications",
            "external_adapter_executions",
            "external_invoice_sync_batches",
            "external_invoice_sync_items",
            "external_invoice_sync_item_lines",
            "external_bank_sync_batches",
            "external_bank_sync_items",
            "inventory_items",
            "inventory_movements",
            "accounting_periods",
            "inventory_opening_balances",
            "inventory_stocktakes",
            "inventory_stocktake_lines",
            "measurement_units",
            "asset_categories",
            "fixed_assets",
            "depreciation_batches",
            "fixed_asset_depreciation_lines",
        ] {
            let table_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .bind(table_name)
            .fetch_one(&pool)
            .await
            .expect("read migrated table");
            assert_eq!(table_count, 1, "missing migrated table {table_name}");
        }
        for (table_name, column_name) in [
            ("inventory_items", "valuation_method"),
            ("inventory_items", "inventory_subject"),
            ("inventory_items", "cost_subject"),
            ("inventory_items", "safety_stock"),
            ("inventory_items", "unit_id"),
            ("inventory_movements", "inventory_item_id"),
            ("inventory_movements", "direction"),
            ("inventory_movements", "unit_cost"),
            ("inventory_movements", "confirmed_at"),
            ("accounting_periods", "inventory_opening_finalized_at"),
            ("accounting_periods", "inventory_opening_finalized_by"),
            ("inventory_stocktakes", "source_movement_max_rowid"),
            ("inventory_stocktakes", "voucher_id"),
            ("inventory_stocktake_lines", "actual_unit_cost"),
            ("inventory_stocktake_lines", "movement_id"),
        ] {
            let pragma = format!("PRAGMA table_info({table_name})");
            let column_count: i64 = sqlx::query_scalar(&format!(
                "SELECT COUNT(*) FROM pragma_table_info('{table_name}') WHERE name = ?"
            ))
            .bind(column_name)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| panic!("read {table_name}.{column_name} from {pragma}"));
            assert_eq!(
                column_count, 1,
                "missing migrated column {table_name}.{column_name}"
            );
        }
    }

    #[tokio::test]
    async fn release_recovery_failed_versioned_migration_rolls_back_every_statement() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create rollback database");
        sqlx::query(
            r#"CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"#,
        )
        .execute(&pool)
        .await
        .expect("create migration history");
        let failing_migration = SchemaMigration {
            version: 999,
            name: "rollback_probe",
            checksum: "rollback-probe-v1",
            statements: &[
                "CREATE TABLE rollback_probe (id TEXT PRIMARY KEY)",
                "INSERT INTO table_that_does_not_exist (id) VALUES ('failure')",
            ],
        };

        Database::apply_versioned_migration(&pool, &failing_migration)
            .await
            .expect_err("failing migration must roll back");

        let probe_tables: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'",
        )
        .fetch_one(&pool)
        .await
        .expect("check rollback probe table");
        assert_eq!(probe_tables, 0);
        let recorded: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM schema_migrations WHERE version = 999")
                .fetch_one(&pool)
                .await
                .expect("check rollback migration history");
        assert_eq!(recorded, 0);
    }

    #[test]
    fn statutory_account_charts_match_current_official_systems() {
        let enterprise = top_level_accounts(&Database::enterprise_account_codes());
        for (code, name) in [
            ("4003", "其他综合收益"),
            ("4201", "库存股"),
            ("4301", "专项储备"),
            ("4401", "其他权益工具"),
        ] {
            assert_eq!(
                enterprise.get(code),
                Some(&name),
                "企业准则权益科目 {code} 不匹配"
            );
        }

        let small = top_level_accounts(&Database::small_enterprise_account_codes());
        assert_eq!(small.len(), 66, "小企业会计准则应包含 66 个一级科目");
        assert_eq!(small.get("1101"), Some(&"短期投资"));
        for required in [
            "1402", "1404", "1407", "1411", "1421", "1501", "1621", "1622", "2401", "2701", "3001",
            "5001", "5801",
        ] {
            assert!(small.contains_key(required), "小企业科目缺少 {required}");
        }
        for forbidden in ["1231", "1471", "6101", "6701"] {
            assert!(
                !small.contains_key(forbidden),
                "小企业会计准则不应预置企业准则科目 {forbidden}"
            );
        }

        let non_profit = top_level_accounts(&Database::non_profit_account_codes());
        assert_eq!(
            non_profit.len(),
            56,
            "2026 年民间非营利组织会计制度应包含 56 个一级科目"
        );
        for (code, name) in [
            ("1001", "现金"),
            ("1506", "文物资源"),
            ("3201", "以前年度净资产调整"),
            ("4701", "总部拨款收入"),
            ("5901", "其他费用"),
        ] {
            assert_eq!(non_profit.get(code), Some(&name), "民非科目 {code} 不匹配");
        }

        let cooperative = top_level_accounts(&Database::cooperative_account_codes());
        assert_eq!(
            cooperative.len(),
            48,
            "农民专业合作社会计制度应包含 48 个一级科目"
        );
        for (code, name) in [
            ("101", "库存现金"),
            ("114", "成员往来"),
            ("301", "股金"),
            ("331", "本年盈余"),
            ("531", "所得税费用"),
        ] {
            assert_eq!(
                cooperative.get(code),
                Some(&name),
                "合作社科目 {code} 不匹配"
            );
        }
        assert!(
            cooperative.keys().all(|code| code.len() == 3),
            "合作社一级科目应使用现行三位编号"
        );
    }

    #[tokio::test]
    async fn report_templates_are_isolated_by_accounting_system_and_form_number() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let templates: Vec<(String, String, String, Option<String>, i32)> = sqlx::query_as(
            "SELECT accounting_system, template_code, report_type, form_code, is_statutory FROM report_templates ORDER BY accounting_system, report_type",
        )
        .fetch_all(&pool)
        .await
        .expect("read standard report templates");

        for system in [
            "small_enterprise",
            "enterprise",
            "non_profit",
            "cooperative",
        ] {
            assert!(
                templates
                    .iter()
                    .any(|row| row.0 == system && row.2 == "balance_sheet"),
                "{system} 缺少资产负债表模板"
            );
            assert!(
                templates
                    .iter()
                    .any(|row| row.0 == system && row.2 == "income_statement"),
                "{system} 缺少经营成果报表模板"
            );
        }

        let expected_form_codes = [
            ("enterprise", "balance_sheet", "会企 01 表"),
            ("enterprise", "income_statement", "会企 02 表"),
            ("enterprise", "cash_flow", "会企 03 表"),
            ("enterprise", "equity_change", "会企 04 表"),
            ("small_enterprise", "balance_sheet", "会小企 01 表"),
            ("small_enterprise", "income_statement", "会小企 02 表"),
            ("small_enterprise", "cash_flow", "会小企 03 表"),
            ("non_profit", "balance_sheet", "会民非 01 表"),
            ("non_profit", "income_statement", "会民非 02 表"),
            ("non_profit", "cash_flow", "会民非 03 表"),
            ("cooperative", "balance_sheet", "会农社 01 表"),
            ("cooperative", "income_statement", "会农社 02 表"),
            ("cooperative", "equity_change", "会农社 03 表"),
        ];
        for (system, report_type, form_code) in expected_form_codes {
            assert!(
                templates.iter().any(|row| {
                    row.0 == system
                        && row.2 == report_type
                        && row.3.as_deref() == Some(form_code)
                        && row.4 == 1
                }),
                "{system}/{report_type} 缺少法定表号 {form_code}"
            );
        }

        let unique_codes: HashSet<&str> = templates.iter().map(|row| row.1.as_str()).collect();
        assert_eq!(
            unique_codes.len(),
            templates.len(),
            "标准模板编码必须全局唯一"
        );
    }

    #[tokio::test]
    async fn enterprise_cash_flow_template_contains_the_statutory_control_rows() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let rows: Vec<(String, String)> = sqlx::query_as(
            r#"SELECT item.item_code, item.item_name
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'ENTERPRISE_CASH_FLOW'
               ORDER BY item.sort_order"#,
        )
        .fetch_all(&pool)
        .await
        .expect("reads enterprise cash-flow rows");
        let by_code: HashMap<String, String> = rows.into_iter().collect();
        for (code, name) in [
            ("CF109", "经营活动现金流入小计"),
            ("CF119", "经营活动现金流出小计"),
            ("CF209", "投资活动现金流入小计"),
            ("CF219", "投资活动现金流出小计"),
            ("CF309", "筹资活动现金流入小计"),
            ("CF319", "筹资活动现金流出小计"),
            ("CF499", "五、现金及现金等价物净增加额"),
            ("CF500", "加：期初现金及现金等价物余额"),
            ("CF999", "六、期末现金及现金等价物余额"),
        ] {
            assert_eq!(
                by_code.get(code).map(String::as_str),
                Some(name),
                "{code} 不符合一般企业现金流量表格式"
            );
        }
    }

    #[tokio::test]
    async fn enterprise_equity_change_template_contains_the_statutory_sections() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let rows: Vec<(String, String)> = sqlx::query_as(
            r#"SELECT item.item_code, item.item_name
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'ENTERPRISE_EQUITY_CHANGE'
               ORDER BY item.sort_order"#,
        )
        .fetch_all(&pool)
        .await
        .expect("reads enterprise equity-change rows");
        let by_code: HashMap<String, String> = rows.into_iter().collect();
        for (code, name) in [
            ("EQ100", "一、上年年末余额"),
            ("EQ200", "二、本年年初余额"),
            ("EQ300", "三、本年增减变动金额（减少以“-”号填列）"),
            ("EQ310", "（一）综合收益总额"),
            ("EQ320", "（二）所有者投入和减少资本"),
            ("EQ330", "（三）利润分配"),
            ("EQ340", "（四）所有者权益内部结转"),
            ("EQ350", "（五）专项储备"),
            ("EQ400", "四、本年年末余额"),
        ] {
            assert_eq!(
                by_code.get(code).map(String::as_str),
                Some(name),
                "{code} 不符合一般企业所有者权益变动表格式"
            );
        }
    }

    #[tokio::test]
    async fn nonprofit_2026_report_templates_contain_the_statutory_rows() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");
        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        for (template_code, expected_rows) in [
            (
                "NON_PROFIT_BALANCE_SHEET",
                vec![
                    ("BS107", "一年内到期的长期投资"),
                    ("BS108", "其他流动资产"),
                    ("BS202", "长期股权投资"),
                    ("BS203", "长期债权投资"),
                    ("BS204", "其他长期投资"),
                    ("BS211", "固定资产原价"),
                    ("BS212", "减：累计折旧"),
                    ("BS213", "固定资产净值"),
                    ("BS291", "受托代理资产"),
                    ("BS307", "一年内到期的长期负债"),
                    ("BS308", "其他流动负债"),
                    ("BS403", "预计负债"),
                    ("BS404", "其他长期负债"),
                    ("BS501", "受托代理负债"),
                ],
            ),
            (
                "NON_PROFIT_INCOME_STATEMENT",
                vec![
                    ("IS101", "捐赠收入"),
                    ("IS102", "会费收入"),
                    ("IS103", "提供服务收入"),
                    ("IS104", "政府补助收入"),
                    ("IS105", "商品销售收入"),
                    ("IS106", "总部拨款收入"),
                    ("IS107", "投资收益"),
                    ("IS108", "其他收入"),
                    ("IS209", "费用合计"),
                    ("IS300", "三、限定性净资产转为非限定性净资产"),
                    ("IS400", "四、非限定性净资产转为限定性净资产"),
                    ("IS500", "五、以前年度净资产调整"),
                    ("IS015", "六、净资产变动额（若为净资产减少额，以“-”号填列）"),
                ],
            ),
            (
                "NON_PROFIT_CASH_FLOW",
                vec![
                    ("CF101", "接受捐赠收到的现金"),
                    ("CF102", "收取会费收到的现金"),
                    ("CF103", "提供服务收到的现金"),
                    ("CF108", "销售商品收到的现金"),
                    ("CF110", "政府补助收到的现金"),
                    ("CF109", "现金流入小计"),
                    ("CF119", "现金流出小计"),
                    ("CF209", "现金流入小计"),
                    ("CF219", "现金流出小计"),
                    ("CF309", "现金流入小计"),
                    ("CF319", "现金流出小计"),
                    ("CF499", "五、现金及现金等价物净增加额"),
                ],
            ),
        ] {
            let rows: Vec<(String, String)> = sqlx::query_as(
                r#"SELECT item.item_code, item.item_name
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ?
                   ORDER BY item.sort_order"#,
            )
            .bind(template_code)
            .fetch_all(&pool)
            .await
            .expect("reads nonprofit statutory rows");
            let by_code: HashMap<String, String> = rows.into_iter().collect();
            for (code, name) in expected_rows {
                assert_eq!(
                    by_code.get(code).map(String::as_str),
                    Some(name),
                    "{template_code}/{code} 不符合 2026 年民间非营利组织报表格式"
                );
            }
        }
    }

    #[tokio::test]
    async fn enterprise_balance_sheet_equity_rows_match_the_equity_change_columns() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");
        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
            r#"SELECT item.item_code, item.item_name, item.formula
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'ENTERPRISE_BALANCE_SHEET'
                 AND item.item_code IN ('BS601','BS602','BS605','BS606','BS607','BS608','BS609','BS610','BS699')
               ORDER BY item.sort_order"#,
        )
        .fetch_all(&pool)
        .await
        .expect("reads enterprise balance-sheet equity rows");
        let by_code: HashMap<String, (String, Option<String>)> = rows
            .into_iter()
            .map(|(code, name, formula)| (code, (name, formula)))
            .collect();
        for (code, name, formula) in [
            ("BS601", "实收资本（或股本）", "4001"),
            ("BS602", "其他权益工具", "4401"),
            ("BS605", "资本公积", "4002"),
            ("BS606", "减：库存股", "4201"),
            ("BS607", "其他综合收益", "4003"),
            ("BS608", "专项储备", "4301"),
            ("BS609", "盈余公积", "4101"),
            ("BS610", "未分配利润", "4103+4104"),
            (
                "BS699",
                "所有者权益（或股东权益）合计",
                "4001+4401+4002-4201+4003+4301+4101+4103+4104",
            ),
        ] {
            let row = by_code.get(code).expect("contains statutory equity row");
            assert_eq!(row.0, name, "{code} 名称不匹配");
            assert_eq!(row.1.as_deref(), Some(formula), "{code} 公式不匹配");
        }
    }

    #[tokio::test]
    async fn enterprise_2019_current_report_templates_contain_statutory_rows() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");
        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let balance_count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'ENTERPRISE_BALANCE_SHEET'"#,
        )
        .fetch_one(&pool)
        .await
        .expect("counts enterprise balance-sheet rows");
        assert!(balance_count >= 75, "会企 01 表缺少现行法定项目");

        let income_count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'ENTERPRISE_INCOME_STATEMENT'"#,
        )
        .fetch_one(&pool)
        .await
        .expect("counts enterprise income-statement rows");
        assert!(income_count >= 43, "会企 02 表缺少现行法定项目");

        for (template_code, item_code, expected_name, expected_formula) in [
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS102",
                "交易性金融资产",
                Some("1101"),
            ),
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS106",
                "应收款项融资",
                Some("1125"),
            ),
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS110",
                "合同资产",
                Some("1124-1483"),
            ),
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS212",
                "使用权资产",
                Some("1704-1705-1706"),
            ),
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS307",
                "合同负债",
                Some("2204"),
            ),
            (
                "ENTERPRISE_BALANCE_SHEET",
                "BS405",
                "租赁负债",
                Some("2703"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS006",
                "研发费用",
                Some("660206"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS010",
                "加：其他收益",
                Some("6117"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS016",
                "信用减值损失（损失以“-”号填列）",
                Some("6702"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS018",
                "资产处置收益（损失以“-”号填列）",
                Some("6115"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS027",
                "五、其他综合收益的税后净额",
                Some("4003"),
            ),
            (
                "ENTERPRISE_INCOME_STATEMENT",
                "IS040",
                "六、综合收益总额",
                None,
            ),
        ] {
            let row: (String, Option<String>) = sqlx::query_as(
                r#"SELECT item.item_name, item.formula
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ? AND item.item_code = ?"#,
            )
            .bind(template_code)
            .bind(item_code)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| panic!("missing {template_code}/{item_code}"));
            assert_eq!(
                row.0, expected_name,
                "{template_code}/{item_code} 名称不匹配"
            );
            assert_eq!(
                row.1.as_deref(),
                expected_formula,
                "{template_code}/{item_code} 公式不匹配"
            );
        }

        for (code, name) in [
            ("1124", "合同资产"),
            ("1125", "应收款项融资"),
            ("1506", "债权投资"),
            ("1507", "其他债权投资"),
            ("1508", "其他权益工具投资"),
            ("1704", "使用权资产"),
            ("2204", "合同负债"),
            ("2703", "租赁负债"),
            ("6117", "其他收益"),
            ("6702", "信用减值损失"),
        ] {
            let actual = Database::enterprise_account_codes()
                .iter()
                .find(|seed| seed.0 == code)
                .map(|seed| seed.1);
            assert_eq!(actual, Some(name), "企业准则科目 {code} 不匹配");
        }

        for item_code in ["IS008", "IS009", "IS012", "IS013", "IS029"] {
            let calculation_sign: i32 = sqlx::query_scalar(
                r#"SELECT item.calculation_sign
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = 'ENTERPRISE_INCOME_STATEMENT'
                     AND item.item_code = ?"#,
            )
            .bind(item_code)
            .fetch_one(&pool)
            .await
            .expect("reads enterprise analytical row sign");
            assert_eq!(
                calculation_sign, 0,
                "{item_code} 是其中项，不得重复计入利润汇总"
            );
        }
    }

    #[tokio::test]
    async fn small_enterprise_2013_report_templates_contain_all_statutory_lines() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");
        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        for (template_code, last_line) in [
            ("SMALL_ENTERPRISE_BALANCE_SHEET", 53),
            ("SMALL_ENTERPRISE_INCOME_STATEMENT", 32),
            ("SMALL_ENTERPRISE_CASH_FLOW", 22),
        ] {
            let lines: Vec<String> = sqlx::query_scalar(
                r#"SELECT item.line_number
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ? AND item.line_number IS NOT NULL"#,
            )
            .bind(template_code)
            .fetch_all(&pool)
            .await
            .expect("reads small-enterprise statutory lines");
            let actual: HashSet<i32> = lines
                .into_iter()
                .map(|line| line.parse::<i32>().expect("numeric statutory line"))
                .collect();
            let expected: HashSet<i32> = (1..=last_line).collect();
            assert_eq!(
                actual, expected,
                "{template_code} 必须完整保留法定行次 1-{last_line}"
            );
        }

        for (template_code, line_number, expected_name, expected_formula) in [
            (
                "SMALL_ENTERPRISE_BALANCE_SHEET",
                "10",
                "其中：原材料",
                Some("1403"),
            ),
            (
                "SMALL_ENTERPRISE_BALANCE_SHEET",
                "28",
                "其他非流动资产",
                None,
            ),
            (
                "SMALL_ENTERPRISE_BALANCE_SHEET",
                "40",
                "其他流动负债",
                None,
            ),
            (
                "SMALL_ENTERPRISE_INCOME_STATEMENT",
                "19",
                "其中：利息费用（收入以“-”号填列）",
                Some("560301-560303"),
            ),
            (
                "SMALL_ENTERPRISE_INCOME_STATEMENT",
                "23",
                "其中：政府补助",
                Some("530102"),
            ),
            (
                "SMALL_ENTERPRISE_CASH_FLOW",
                "2",
                "收到其他与经营活动有关的现金",
                Some("credit:5301+credit:5051"),
            ),
            (
                "SMALL_ENTERPRISE_CASH_FLOW",
                "10",
                "处置固定资产、无形资产和其他非流动资产收回的现金净额",
                Some("credit:1601+credit:1604+credit:1605+credit:1606+credit:1621+credit:1701+credit:1801"),
            ),
            (
                "SMALL_ENTERPRISE_CASH_FLOW",
                "21",
                "加：期初现金余额",
                Some("1001+1002+1012"),
            ),
        ] {
            let row: (String, Option<String>) = sqlx::query_as(
                r#"SELECT item.item_name, item.formula
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ? AND item.line_number = ?"#,
            )
            .bind(template_code)
            .bind(line_number)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| panic!("missing {template_code} line {line_number}"));
            assert_eq!(row.0, expected_name, "{template_code} 行 {line_number} 名称不匹配");
            assert_eq!(
                row.1.as_deref(),
                expected_formula,
                "{template_code} 行 {line_number} 公式不匹配"
            );
        }

        for line_number in [
            4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19, 23, 25, 26, 27, 28, 29,
        ] {
            let calculation_sign: i32 = sqlx::query_scalar(
                r#"SELECT item.calculation_sign
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = 'SMALL_ENTERPRISE_INCOME_STATEMENT'
                     AND item.line_number = ?"#,
            )
            .bind(line_number.to_string())
            .fetch_one(&pool)
            .await
            .expect("reads small-enterprise analytical sign");
            assert_eq!(
                calculation_sign, 0,
                "利润表行 {line_number} 不得重复参与利润汇总"
            );
        }

        for (code, name) in [
            ("540301", "消费税"),
            ("540307", "教育费附加、矿产资源补偿费、排污费"),
            ("560104", "商品维修费"),
            ("560208", "研究费用"),
            ("560303", "利息收入"),
            ("571107", "税收滞纳金"),
        ] {
            let actual = Database::small_enterprise_account_codes()
                .iter()
                .find(|seed| seed.0 == code)
                .map(|seed| seed.1);
            assert_eq!(actual, Some(name), "小企业明细科目 {code} 不匹配");
        }
    }

    #[tokio::test]
    async fn cooperative_2023_report_templates_contain_all_statutory_rows() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");
        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        for (template_code, last_line) in [
            ("COOPERATIVE_BALANCE_SHEET", 42),
            ("COOPERATIVE_INCOME_STATEMENT", 20),
        ] {
            let lines: Vec<String> = sqlx::query_scalar(
                r#"SELECT item.line_number
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ? AND item.line_number IS NOT NULL"#,
            )
            .bind(template_code)
            .fetch_all(&pool)
            .await
            .expect("reads cooperative statutory lines");
            let actual: HashSet<i32> = lines
                .into_iter()
                .map(|line| line.parse::<i32>().expect("numeric statutory line"))
                .collect();
            let expected: HashSet<i32> = (1..=last_line).collect();
            assert_eq!(
                actual, expected,
                "{template_code} 必须完整保留法定行次 1-{last_line}"
            );
        }

        for (template_code, line_number, expected_name, expected_formula) in [
            (
                "COOPERATIVE_BALANCE_SHEET",
                "7",
                "生产性生物资产原值",
                Some("142"),
            ),
            (
                "COOPERATIVE_BALANCE_SHEET",
                "15",
                "固定资产小计",
                Some("151-152+153+154"),
            ),
            (
                "COOPERATIVE_BALANCE_SHEET",
                "34",
                "非流动负债合计",
                Some("231+235"),
            ),
            (
                "COOPERATIVE_INCOME_STATEMENT",
                "13",
                "加：年初未分配盈余",
                Some("opening:3322"),
            ),
            (
                "COOPERATIVE_INCOME_STATEMENT",
                "15",
                "减：提取盈余公积",
                Some("332101"),
            ),
            (
                "COOPERATIVE_INCOME_STATEMENT",
                "20",
                "六、年末未分配盈余",
                None,
            ),
        ] {
            let row: (String, Option<String>) = sqlx::query_as(
                r#"SELECT item.item_name, item.formula
                   FROM report_items item
                   JOIN report_templates template ON template.id = item.template_id
                   WHERE template.template_code = ? AND item.line_number = ?"#,
            )
            .bind(template_code)
            .bind(line_number)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| panic!("missing {template_code} line {line_number}"));
            assert_eq!(row.0, expected_name);
            assert_eq!(row.1.as_deref(), expected_formula);
        }

        let equity_rows: Vec<(String, String)> = sqlx::query_as(
            r#"SELECT item.item_code, item.item_name
               FROM report_items item
               JOIN report_templates template ON template.id = item.template_id
               WHERE template.template_code = 'COOPERATIVE_EQUITY_CHANGE'
               ORDER BY item.sort_order"#,
        )
        .fetch_all(&pool)
        .await
        .expect("reads cooperative member-equity rows");
        for (code, name) in [
            ("EQ100", "年初余额"),
            ("EQ200", "本年增加数"),
            ("EQ300", "本年减少数"),
            ("EQ400", "年末余额"),
        ] {
            assert!(
                equity_rows.iter().any(|row| row.0 == code && row.1 == name),
                "成员权益变动表缺少 {name}"
            );
        }
        assert!(
            equity_rows.len() > 10,
            "成员权益变动表必须包含法定增减原因行"
        );

        for (code, name) in [
            ("3321", "各项分配"),
            ("332101", "提取盈余公积"),
            ("332104", "转为成员出资"),
            ("3322", "未分配盈余"),
        ] {
            let actual = Database::cooperative_account_codes()
                .iter()
                .find(|seed| seed.0 == code)
                .map(|seed| seed.1);
            assert_eq!(actual, Some(name), "合作社盈余分配明细科目 {code} 不匹配");
        }
    }

    #[tokio::test]
    async fn statutory_report_items_keep_lines_signs_and_directional_control_formulas() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let missing_lines: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE t.is_system = 1
                 AND t.accounting_system <> 'legacy'
                 AND t.report_type <> 'equity_change'
                 AND (i.formula IS NOT NULL OR i.is_total = 1)
                 AND (i.line_number IS NULL OR trim(i.line_number) = '')"#,
        )
        .fetch_one(&pool)
        .await
        .expect("counts missing statutory line numbers");
        assert_eq!(missing_lines, 0, "有取数或汇总逻辑的标准报表行必须具有行次");

        let numbered_equity_rows: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE t.template_code = 'COOPERATIVE_EQUITY_CHANGE'
                 AND i.line_number IS NOT NULL AND trim(i.line_number) <> ''"#,
        )
        .fetch_one(&pool)
        .await
        .expect("counts artificial equity-matrix line numbers");
        assert_eq!(
            numbered_equity_rows, 0,
            "权益变动矩阵不得用排序号伪造法定行次"
        );

        let expense_and_outflow_signs: Vec<(String, String, i32)> = sqlx::query_as(
            r#"SELECT t.report_type, i.item_name, i.calculation_sign
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE t.is_system = 1
                 AND i.calculation_sign <> 0
                 AND (
                   (t.report_type = 'income_statement' AND (
                     ltrim(i.item_name) LIKE '减%'
                     OR i.item_name LIKE '%成本%'
                     OR i.item_name LIKE '%费用%'
                     OR i.item_name LIKE '%支出%'
                     OR i.item_name LIKE '%税金及附加%'
                     OR i.item_name LIKE '%减值损失%'
                   ))
                   OR (t.report_type = 'cash_flow' AND (
                     i.item_name LIKE '%支付%'
                     OR i.item_name LIKE '%流出%'
                     OR i.item_name LIKE '%支出%'
                   ))
                 )"#,
        )
        .fetch_all(&pool)
        .await
        .expect("reads expense and cash outflow signs");
        assert!(!expense_and_outflow_signs.is_empty());
        for (report_type, item_name, calculation_sign) in expense_and_outflow_signs {
            assert_eq!(
                calculation_sign, -1,
                "{report_type} 的减项/流出行 {item_name} 必须按减项汇总"
            );
        }

        let nonprofit_cash_control: (String, Option<String>) = sqlx::query_as(
            r#"SELECT i.item_name, i.formula
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE t.template_code = 'NON_PROFIT_CASH_FLOW' AND i.item_code = 'CF499'"#,
        )
        .fetch_one(&pool)
        .await
        .expect("reads nonprofit cash-flow control row");
        assert_eq!(
            nonprofit_cash_control,
            ("五、现金及现金等价物净增加额".to_string(), None)
        );

        let expected_cooperative_formulas = [
            ("BS102", "113+closing_d:114"),
            ("BS199", "101+102+113+closing_d:114+121+124+125+127+128+401+141"),
            ("BS999", "101+102+113+closing_d:114+121+124+125+127+128+401+141+131+142-143+151-152+153+154+161-162+144+171"),
            ("BS302", "211+closing_c:114"),
            ("BS399", "201+211+closing_c:114+212+213+214+215+221+222"),
            ("BS599", "201+211+closing_c:114+212+213+214+215+221+222+231+235"),
            ("BS799", "201+211+closing_c:114+212+213+214+215+221+222+231+235+301+311+321+322+331+332"),
        ];
        for (item_code, expected_formula) in expected_cooperative_formulas {
            let formula: Option<String> = sqlx::query_scalar(
                r#"SELECT i.formula
                   FROM report_items i
                   JOIN report_templates t ON t.id = i.template_id
                   WHERE t.template_code = 'COOPERATIVE_BALANCE_SHEET' AND i.item_code = ?"#,
            )
            .bind(item_code)
            .fetch_one(&pool)
            .await
            .expect("reads cooperative balance formula");
            assert_eq!(
                formula.as_deref(),
                Some(expected_formula),
                "{item_code} 应按成员往来借贷方向取数"
            );
        }
    }

    #[tokio::test]
    async fn report_formulas_reference_accounts_from_the_same_system() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        let formula_rows: Vec<(String, String, String)> = sqlx::query_as(
            r#"SELECT t.accounting_system, i.item_code, i.formula
               FROM report_items i
               JOIN report_templates t ON t.id = i.template_id
               WHERE i.formula IS NOT NULL AND trim(i.formula) <> ''"#,
        )
        .fetch_all(&pool)
        .await
        .expect("read report formulas");

        for (system, item_code, formula) in formula_rows {
            let seeds = match system.as_str() {
                "enterprise" => Database::enterprise_account_codes(),
                "non_profit" => Database::non_profit_account_codes(),
                "cooperative" => Database::cooperative_account_codes(),
                _ => Database::small_enterprise_account_codes(),
            };
            let valid_codes: HashSet<&str> = seeds.iter().map(|row| row.0).collect();
            for token in formula.split(['+', '-']) {
                let account_code = token.trim().split(':').next_back().unwrap_or_default();
                if account_code.is_empty() {
                    continue;
                }
                assert!(
                    valid_codes.contains(account_code),
                    "{system} 报表项目 {item_code} 引用了不存在的科目 {account_code}"
                );
            }
        }
    }

    #[tokio::test]
    async fn fresh_database_does_not_seed_demo_business_records() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create in-memory database");

        Database::run_migrations(&pool)
            .await
            .expect("run migrations");

        for table in [
            "companies",
            "agency_service_contracts",
            "agency_fee_collections",
            "agency_collaboration_items",
            "agency_delivery_tickets",
        ] {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(&pool)
                .await
                .expect("count seeded records");
            assert_eq!(count, 0, "fresh database seeded records into {table}");
        }
    }
}
