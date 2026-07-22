use sqlx::{Pool, Sqlite, SqlitePool};
use std::path::PathBuf;
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

#[derive(Clone)]
pub struct Database {
    pool: Arc<DbPool>,
    app_data_dir: Arc<PathBuf>,
}

impl Database {
    pub async fn new(app_data_dir: PathBuf) -> Result<Self, DbError> {
        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("accounting.db");
        let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

        log::info!("Initializing database at: {}", db_path.display());

        let pool = SqlitePool::connect(&database_url).await?;

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

        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS account_transfers (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL, period TEXT NOT NULL, transfer_date TEXT NOT NULL,
                from_account TEXT NOT NULL, to_account TEXT NOT NULL, amount REAL NOT NULL, fee REAL NOT NULL DEFAULT 0,
                serial_no TEXT, status TEXT NOT NULL DEFAULT '待确认', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id)
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
                status TEXT NOT NULL DEFAULT '待确认', created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (company_id, employee_id, period)
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
                status TEXT NOT NULL DEFAULT '待处理',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, serial_no)
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
                status TEXT NOT NULL DEFAULT '待审核',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, document_code)
            )
            "#,
        )
        .execute(pool)
        .await?;

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
                status TEXT NOT NULL DEFAULT '待确认',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id),
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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period_year, period_month)
            )
            "#,
        )
        .execute(pool)
        .await?;

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

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_account_codes_company ON account_codes(company_id)")
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

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_voucher ON voucher_entries(voucher_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_account ON voucher_entries(account_code)")
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

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_balances_period ON account_balances(period_id)")
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

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_voucher_logs_voucher ON voucher_logs(voucher_id)")
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
                is_enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (template_id) REFERENCES report_templates(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_report_items_template ON report_items(template_id)")
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
        sqlx::query("ALTER TABLE account_codes ADD COLUMN has_auxiliary INTEGER NOT NULL DEFAULT 0")
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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE (company_id, period, tax_type, form_name)
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
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_direction ON voucher_entries(direction)")
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

        // Auxiliary: category lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_aux_items_category ON auxiliary_items(category_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_employees_company_status ON employees(company_id, employment_status)")
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
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id)")
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
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_adapter_auth_company_type ON adapter_authorizations(company_id, adapter_type)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_logs_company_module ON operation_audit_logs(company_id, module_name)")
            .execute(pool)
            .await?;

        // Periods: company lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_periods_company ON accounting_periods(company_id)")
            .execute(pool)
            .await?;

        // Account codes: type filter
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_account_codes_type ON account_codes(account_type)")
            .execute(pool)
            .await?;

        // Add role_id column to users if not exists
        let _ = sqlx::query("ALTER TABLE users ADD COLUMN role_id TEXT REFERENCES roles(id)")
            .execute(pool)
            .await;

        // === Seed data ===

        // Default admin user
        let admin_exists: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = 'admin'")
                .fetch_one(pool)
                .await?;

        if admin_exists.0 == 0 {
            let password_hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST)
                .map_err(|e| DbError::Sqlx(sqlx::Error::Protocol(e.to_string())))?;

            sqlx::query(
                "INSERT INTO users (id, username, password_hash, real_name, role) VALUES (?, 'admin', ?, '系统管理员', 'admin')",
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(&password_hash)
            .execute(pool)
            .await?;
            log::info!("Default admin user created");
        }

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
                ("vouchers", "view"), ("vouchers", "create"), ("vouchers", "edit"), ("vouchers", "approve"),
                ("vouchers", "export"), ("vouchers", "print"),
                ("invoices", "view"), ("invoices", "create"), ("invoices", "edit"), ("invoices", "delete"),
                ("reports", "view"), ("reports", "export"), ("reports", "print"),
                ("settings", "view"), ("settings", "edit"),
                ("ledger", "view"), ("ledger", "export"), ("ledger", "print"),
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
                ("vouchers", "view"), ("vouchers", "create"), ("vouchers", "edit"), ("vouchers", "export"),
                ("invoices", "view"), ("invoices", "create"), ("invoices", "edit"),
                ("reports", "view"), ("reports", "export"),
                ("ledger", "view"), ("ledger", "export"),
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
                ("vouchers", "view"), ("invoices", "view"), ("reports", "view"), ("ledger", "view"), ("settings", "view"),
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
            let admin_user: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE username = 'admin'")
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

        // Account codes are now seeded per-company in insert_default_companies

        // Default report templates and items
        let templates_exist: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM report_templates")
                .fetch_one(pool)
                .await?;

        if templates_exist.0 == 0 {
            Self::insert_default_report_templates(pool).await?;
            log::info!("Default report templates inserted");
        }

        // Default companies with periods
        let company_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM companies")
            .fetch_one(pool)
            .await?;

        if company_exists.0 == 0 {
            Self::insert_default_companies(pool).await?;
            log::info!("Default companies created");
        }

        Self::insert_default_agency_operations(pool).await?;

        log::info!("Database migrations completed successfully");
        Ok(())
    }

    async fn insert_default_account_codes(pool: &DbPool, company_id: &str) -> Result<(), DbError> {
        // (code, name, account_type, normal_balance, level, parent_code, is_detail)
        let codes: Vec<(&str, &str, &str, &str, i32, Option<&str>, i32)> = vec![
            // === 资产类 (Asset) ===
            ("1001", "库存现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1012", "其他货币资金", "asset", "debit", 1, None, 0),
            ("101201", "存出投资款", "asset", "debit", 2, Some("1012"), 1),
            ("1101", "交易性金融资产", "asset", "debit", 1, None, 1),
            ("1121", "应收票据", "asset", "debit", 1, None, 1),
            ("1122", "应收账款", "asset", "debit", 1, None, 0),
            ("112201", "应收账款-客户", "asset", "debit", 2, Some("1122"), 1),
            ("1123", "预付账款", "asset", "debit", 1, None, 1),
            ("1131", "应收股利", "asset", "debit", 1, None, 1),
            ("1132", "应收利息", "asset", "debit", 1, None, 1),
            ("1221", "其他应收款", "asset", "debit", 1, None, 1),
            ("1231", "坏账准备", "asset", "credit", 1, None, 1),
            ("1401", "材料采购", "asset", "debit", 1, None, 1),
            ("1403", "原材料", "asset", "debit", 1, None, 1),
            ("1405", "库存商品", "asset", "debit", 1, None, 1),
            ("1408", "委托加工物资", "asset", "debit", 1, None, 1),
            ("1471", "存货跌价准备", "asset", "credit", 1, None, 1),
            ("1511", "长期股权投资", "asset", "debit", 1, None, 1),
            ("1601", "固定资产", "asset", "debit", 1, None, 1),
            ("1602", "累计折旧", "asset", "credit", 1, None, 1),
            ("1604", "在建工程", "asset", "debit", 1, None, 1),
            ("1605", "工程物资", "asset", "debit", 1, None, 1),
            ("1606", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1701", "无形资产", "asset", "debit", 1, None, 1),
            ("1702", "累计摊销", "asset", "credit", 1, None, 1),
            ("1801", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1901", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 (Liability) ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2101", "交易性金融负债", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 0),
            ("220201", "应付账款-供应商", "liability", "credit", 2, Some("2202"), 1),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2211", "应付职工薪酬", "liability", "credit", 1, None, 0),
            ("221101", "工资", "liability", "credit", 2, Some("2211"), 1),
            ("221102", "社会保险费", "liability", "credit", 2, Some("2211"), 1),
            ("221103", "住房公积金", "liability", "credit", 2, Some("2211"), 1),
            ("2221", "应交税费", "liability", "credit", 1, None, 0),
            ("222101", "应交增值税", "liability", "credit", 2, Some("2221"), 1),
            ("222102", "应交所得税", "liability", "credit", 2, Some("2221"), 1),
            ("222103", "应交城市维护建设税", "liability", "credit", 2, Some("2221"), 1),
            ("222104", "应交教育费附加", "liability", "credit", 2, Some("2221"), 1),
            ("2231", "应付利息", "liability", "credit", 1, None, 1),
            ("2232", "应付股利", "liability", "credit", 1, None, 1),
            ("2241", "其他应付款", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "应付债券", "liability", "credit", 1, None, 1),
            // === 权益类 (Equity) ===
            ("4001", "实收资本", "equity", "credit", 1, None, 1),
            ("4002", "资本公积", "equity", "credit", 1, None, 0),
            ("400201", "资本溢价", "equity", "credit", 2, Some("4002"), 1),
            ("4101", "盈余公积", "equity", "credit", 1, None, 0),
            ("410101", "法定盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("410102", "任意盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("4103", "本年利润", "equity", "credit", 1, None, 1),
            ("4104", "利润分配", "equity", "credit", 1, None, 0),
            ("410401", "未分配利润", "equity", "credit", 2, Some("4104"), 1),
            ("410402", "提取法定盈余公积", "equity", "credit", 2, Some("4104"), 1),
            // === 成本类 (Cost) ===
            ("5001", "生产成本", "cost", "debit", 1, None, 0),
            ("500101", "基本生产成本", "cost", "debit", 2, Some("5001"), 1),
            ("500102", "辅助生产成本", "cost", "debit", 2, Some("5001"), 1),
            ("5101", "制造费用", "cost", "debit", 1, None, 1),
            ("5301", "研发支出", "cost", "debit", 1, None, 1),
            // === 损益类 - 收入 (Income) ===
            ("6001", "主营业务收入", "income", "credit", 1, None, 1),
            ("6051", "其他业务收入", "income", "credit", 1, None, 1),
            ("6101", "公允价值变动损益", "income", "credit", 1, None, 1),
            ("6111", "投资收益", "income", "credit", 1, None, 1),
            ("6301", "营业外收入", "income", "credit", 1, None, 0),
            ("630101", "非流动资产处置利得", "income", "credit", 2, Some("6301"), 1),
            ("630102", "政府补助利得", "income", "credit", 2, Some("6301"), 1),
            // === 损益类 - 费用 (Expense) ===
            ("6401", "主营业务成本", "expense", "debit", 1, None, 1),
            ("6402", "其他业务成本", "expense", "debit", 1, None, 1),
            ("6403", "税金及附加", "expense", "debit", 1, None, 1),
            ("6601", "销售费用", "expense", "debit", 1, None, 0),
            ("660101", "广告费", "expense", "debit", 2, Some("6601"), 1),
            ("660102", "运输费", "expense", "debit", 2, Some("6601"), 1),
            ("660103", "业务招待费", "expense", "debit", 2, Some("6601"), 1),
            ("6602", "管理费用", "expense", "debit", 1, None, 0),
            ("660201", "办公费", "expense", "debit", 2, Some("6602"), 1),
            ("660202", "差旅费", "expense", "debit", 2, Some("6602"), 1),
            ("660203", "折旧费", "expense", "debit", 2, Some("6602"), 1),
            ("660204", "管理人员薪酬", "expense", "debit", 2, Some("6602"), 1),
            ("660205", "无形资产摊销", "expense", "debit", 2, Some("6602"), 1),
            ("6603", "财务费用", "expense", "debit", 1, None, 0),
            ("660301", "利息支出", "expense", "debit", 2, Some("6603"), 1),
            ("660302", "手续费", "expense", "debit", 2, Some("6603"), 1),
            ("6701", "资产减值损失", "expense", "debit", 1, None, 1),
            ("6711", "营业外支出", "expense", "debit", 1, None, 0),
            ("671101", "非流动资产处置损失", "expense", "debit", 2, Some("6711"), 1),
            ("671102", "公益性捐赠支出", "expense", "debit", 2, Some("6711"), 1),
            ("6801", "所得税费用", "expense", "debit", 1, None, 1),
            ("6901", "以前年度损益调整", "expense", "debit", 1, None, 1),
        ];

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
            .execute(pool)
            .await?;
        }

        Ok(())
    }

    pub async fn insert_account_codes_for_system(pool: &DbPool, company_id: &str, accounting_system: &str) -> Result<(), DbError> {
        let codes: Vec<(&str, &str, &str, &str, i32, Option<&str>, i32)> = match accounting_system {
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
            .execute(pool)
            .await?;
        }

        Ok(())
    }

    fn small_enterprise_account_codes() -> Vec<(&'static str, &'static str, &'static str, &'static str, i32, Option<&'static str>, i32)> {
        vec![
            // === 资产类 ===
            ("1001", "库存现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1012", "其他货币资金", "asset", "debit", 1, None, 0),
            ("101201", "存出投资款", "asset", "debit", 2, Some("1012"), 1),
            ("1101", "交易性金融资产", "asset", "debit", 1, None, 1),
            ("1121", "应收票据", "asset", "debit", 1, None, 1),
            ("1122", "应收账款", "asset", "debit", 1, None, 0),
            ("112201", "应收账款-客户", "asset", "debit", 2, Some("1122"), 1),
            ("1123", "预付账款", "asset", "debit", 1, None, 1),
            ("1131", "应收股利", "asset", "debit", 1, None, 1),
            ("1132", "应收利息", "asset", "debit", 1, None, 1),
            ("1221", "其他应收款", "asset", "debit", 1, None, 1),
            ("1231", "坏账准备", "asset", "credit", 1, None, 1),
            ("1401", "材料采购", "asset", "debit", 1, None, 1),
            ("1403", "原材料", "asset", "debit", 1, None, 1),
            ("1405", "库存商品", "asset", "debit", 1, None, 1),
            ("1408", "委托加工物资", "asset", "debit", 1, None, 1),
            ("1471", "存货跌价准备", "asset", "credit", 1, None, 1),
            ("1511", "长期股权投资", "asset", "debit", 1, None, 1),
            ("1601", "固定资产", "asset", "debit", 1, None, 1),
            ("1602", "累计折旧", "asset", "credit", 1, None, 1),
            ("1604", "在建工程", "asset", "debit", 1, None, 1),
            ("1605", "工程物资", "asset", "debit", 1, None, 1),
            ("1606", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1701", "无形资产", "asset", "debit", 1, None, 1),
            ("1702", "累计摊销", "asset", "credit", 1, None, 1),
            ("1801", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1901", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2101", "交易性金融负债", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 0),
            ("220201", "应付账款-供应商", "liability", "credit", 2, Some("2202"), 1),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2211", "应付职工薪酬", "liability", "credit", 1, None, 0),
            ("221101", "工资", "liability", "credit", 2, Some("2211"), 1),
            ("221102", "社会保险费", "liability", "credit", 2, Some("2211"), 1),
            ("221103", "住房公积金", "liability", "credit", 2, Some("2211"), 1),
            ("2221", "应交税费", "liability", "credit", 1, None, 0),
            ("222101", "应交增值税", "liability", "credit", 2, Some("2221"), 1),
            ("222102", "应交所得税", "liability", "credit", 2, Some("2221"), 1),
            ("222103", "应交城市维护建设税", "liability", "credit", 2, Some("2221"), 1),
            ("222104", "应交教育费附加", "liability", "credit", 2, Some("2221"), 1),
            ("2231", "应付利息", "liability", "credit", 1, None, 1),
            ("2232", "应付股利", "liability", "credit", 1, None, 1),
            ("2241", "其他应付款", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "应付债券", "liability", "credit", 1, None, 1),
            // === 权益类 ===
            ("4001", "实收资本", "equity", "credit", 1, None, 1),
            ("4002", "资本公积", "equity", "credit", 1, None, 0),
            ("400201", "资本溢价", "equity", "credit", 2, Some("4002"), 1),
            ("4101", "盈余公积", "equity", "credit", 1, None, 0),
            ("410101", "法定盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("410102", "任意盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("4103", "本年利润", "equity", "credit", 1, None, 1),
            ("4104", "利润分配", "equity", "credit", 1, None, 0),
            ("410401", "未分配利润", "equity", "credit", 2, Some("4104"), 1),
            ("410402", "提取法定盈余公积", "equity", "credit", 2, Some("4104"), 1),
            // === 成本类 ===
            ("5001", "生产成本", "cost", "debit", 1, None, 0),
            ("500101", "基本生产成本", "cost", "debit", 2, Some("5001"), 1),
            ("500102", "辅助生产成本", "cost", "debit", 2, Some("5001"), 1),
            ("5101", "制造费用", "cost", "debit", 1, None, 1),
            ("5301", "研发支出", "cost", "debit", 1, None, 1),
            // === 损益类-收入 ===
            ("6001", "主营业务收入", "income", "credit", 1, None, 1),
            ("6051", "其他业务收入", "income", "credit", 1, None, 1),
            ("6101", "公允价值变动损益", "income", "credit", 1, None, 1),
            ("6111", "投资收益", "income", "credit", 1, None, 1),
            ("6301", "营业外收入", "income", "credit", 1, None, 0),
            ("630101", "非流动资产处置利得", "income", "credit", 2, Some("6301"), 1),
            ("630102", "政府补助利得", "income", "credit", 2, Some("6301"), 1),
            // === 损益类-费用 ===
            ("6401", "主营业务成本", "expense", "debit", 1, None, 1),
            ("6402", "其他业务成本", "expense", "debit", 1, None, 1),
            ("6403", "税金及附加", "expense", "debit", 1, None, 1),
            ("6601", "销售费用", "expense", "debit", 1, None, 0),
            ("660101", "广告费", "expense", "debit", 2, Some("6601"), 1),
            ("660102", "运输费", "expense", "debit", 2, Some("6601"), 1),
            ("660103", "业务招待费", "expense", "debit", 2, Some("6601"), 1),
            ("6602", "管理费用", "expense", "debit", 1, None, 0),
            ("660201", "办公费", "expense", "debit", 2, Some("6602"), 1),
            ("660202", "差旅费", "expense", "debit", 2, Some("6602"), 1),
            ("660203", "折旧费", "expense", "debit", 2, Some("6602"), 1),
            ("660204", "管理人员薪酬", "expense", "debit", 2, Some("6602"), 1),
            ("660205", "无形资产摊销", "expense", "debit", 2, Some("6602"), 1),
            ("6603", "财务费用", "expense", "debit", 1, None, 0),
            ("660301", "利息支出", "expense", "debit", 2, Some("6603"), 1),
            ("660302", "手续费", "expense", "debit", 2, Some("6603"), 1),
            ("6701", "资产减值损失", "expense", "debit", 1, None, 1),
            ("6711", "营业外支出", "expense", "debit", 1, None, 0),
            ("671101", "非流动资产处置损失", "expense", "debit", 2, Some("6711"), 1),
            ("671102", "公益性捐赠支出", "expense", "debit", 2, Some("6711"), 1),
            ("6801", "所得税费用", "expense", "debit", 1, None, 1),
            ("6901", "以前年度损益调整", "expense", "debit", 1, None, 1),
        ]
    }

    fn enterprise_account_codes() -> Vec<(&'static str, &'static str, &'static str, &'static str, i32, Option<&'static str>, i32)> {
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
            ("1121", "应收票据", "asset", "debit", 1, None, 1),
            ("1122", "应收账款", "asset", "debit", 1, None, 0),
            ("112201", "应收账款-客户", "asset", "debit", 2, Some("1122"), 1),
            ("1123", "预付账款", "asset", "debit", 1, None, 1),
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
            ("1501", "持有至到期投资", "asset", "debit", 1, None, 1),
            ("1502", "持有至到期投资减值准备", "asset", "credit", 1, None, 1),
            ("1503", "可供出售金融资产", "asset", "debit", 1, None, 1),
            ("1511", "长期股权投资", "asset", "debit", 1, None, 1),
            ("1512", "长期股权投资减值准备", "asset", "credit", 1, None, 1),
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
            ("1622", "生产性生物资产累计折旧", "asset", "credit", 1, None, 1),
            ("1631", "油气资产", "asset", "debit", 1, None, 1),
            ("1632", "累计折耗", "asset", "credit", 1, None, 1),
            ("1701", "无形资产", "asset", "debit", 1, None, 1),
            ("1702", "累计摊销", "asset", "credit", 1, None, 1),
            ("1703", "无形资产减值准备", "asset", "credit", 1, None, 1),
            ("1711", "商誉", "asset", "debit", 1, None, 1),
            ("1801", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1811", "递延所得税资产", "asset", "debit", 1, None, 1),
            ("1901", "待处理财产损溢", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2002", "存入保证金", "liability", "credit", 1, None, 1),
            ("2101", "交易性金融负债", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 0),
            ("220201", "应付账款-供应商", "liability", "credit", 2, Some("2202"), 1),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2211", "应付职工薪酬", "liability", "credit", 1, None, 0),
            ("221101", "工资", "liability", "credit", 2, Some("2211"), 1),
            ("221102", "社会保险费", "liability", "credit", 2, Some("2211"), 1),
            ("221103", "住房公积金", "liability", "credit", 2, Some("2211"), 1),
            ("221104", "职工福利费", "liability", "credit", 2, Some("2211"), 1),
            ("2221", "应交税费", "liability", "credit", 1, None, 0),
            ("222101", "应交增值税", "liability", "credit", 2, Some("2221"), 1),
            ("222102", "应交所得税", "liability", "credit", 2, Some("2221"), 1),
            ("222103", "应交城市维护建设税", "liability", "credit", 2, Some("2221"), 1),
            ("222104", "应交教育费附加", "liability", "credit", 2, Some("2221"), 1),
            ("222105", "应交房产税", "liability", "credit", 2, Some("2221"), 1),
            ("222106", "应交车船使用税", "liability", "credit", 2, Some("2221"), 1),
            ("2231", "应付利息", "liability", "credit", 1, None, 1),
            ("2232", "应付股利", "liability", "credit", 1, None, 1),
            ("2241", "其他应付款", "liability", "credit", 1, None, 1),
            ("2314", "代理业务负债", "liability", "credit", 1, None, 1),
            ("2401", "递延收益", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "应付债券", "liability", "credit", 1, None, 1),
            ("2601", "未到期责任准备金", "liability", "credit", 1, None, 1),
            ("2701", "长期应付款", "liability", "credit", 1, None, 1),
            ("2702", "未确认融资费用", "liability", "debit", 1, None, 1),
            ("2711", "专项应付款", "liability", "credit", 1, None, 1),
            ("2801", "预计负债", "liability", "credit", 1, None, 1),
            ("2901", "递延所得税负债", "liability", "credit", 1, None, 1),
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
            ("4003", "其他综合收益", "equity", "credit", 1, None, 1),
            ("4101", "盈余公积", "equity", "credit", 1, None, 0),
            ("410101", "法定盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("410102", "任意盈余公积", "equity", "credit", 2, Some("4101"), 1),
            ("4103", "本年利润", "equity", "credit", 1, None, 1),
            ("4104", "利润分配", "equity", "credit", 1, None, 0),
            ("410401", "未分配利润", "equity", "credit", 2, Some("4104"), 1),
            ("410402", "提取法定盈余公积", "equity", "credit", 2, Some("4104"), 1),
            ("4201", "库存股", "equity", "debit", 1, None, 1),
            // === 成本类 ===
            ("5001", "生产成本", "cost", "debit", 1, None, 0),
            ("500101", "基本生产成本", "cost", "debit", 2, Some("5001"), 1),
            ("500102", "辅助生产成本", "cost", "debit", 2, Some("5001"), 1),
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
            ("6111", "投资收益", "income", "credit", 1, None, 1),
            ("6201", "摊回保险责任准备金", "income", "credit", 1, None, 1),
            ("6301", "营业外收入", "income", "credit", 1, None, 0),
            ("630101", "非流动资产处置利得", "income", "credit", 2, Some("6301"), 1),
            ("630102", "政府补助利得", "income", "credit", 2, Some("6301"), 1),
            ("630103", "捐赠利得", "income", "credit", 2, Some("6301"), 1),
            // === 损益类-费用 ===
            ("6401", "主营业务成本", "expense", "debit", 1, None, 1),
            ("6402", "其他业务成本", "expense", "debit", 1, None, 1),
            ("6403", "税金及附加", "expense", "debit", 1, None, 1),
            ("6411", "利息支出", "expense", "debit", 1, None, 1),
            ("6421", "手续费及佣金支出", "expense", "debit", 1, None, 1),
            ("6501", "提取未到期责任准备金", "expense", "debit", 1, None, 1),
            ("6511", "提取保险责任准备金", "expense", "debit", 1, None, 1),
            ("6521", "保单红利支出", "expense", "debit", 1, None, 1),
            ("6531", "退保金", "expense", "debit", 1, None, 1),
            ("6541", "赔付支出", "expense", "debit", 1, None, 1),
            ("6542", "分出保费", "expense", "debit", 1, None, 1),
            ("6601", "销售费用", "expense", "debit", 1, None, 0),
            ("660101", "广告费", "expense", "debit", 2, Some("6601"), 1),
            ("660102", "运输费", "expense", "debit", 2, Some("6601"), 1),
            ("660103", "业务招待费", "expense", "debit", 2, Some("6601"), 1),
            ("6602", "管理费用", "expense", "debit", 1, None, 0),
            ("660201", "办公费", "expense", "debit", 2, Some("6602"), 1),
            ("660202", "差旅费", "expense", "debit", 2, Some("6602"), 1),
            ("660203", "折旧费", "expense", "debit", 2, Some("6602"), 1),
            ("660204", "管理人员薪酬", "expense", "debit", 2, Some("6602"), 1),
            ("660205", "无形资产摊销", "expense", "debit", 2, Some("6602"), 1),
            ("660206", "研发费用", "expense", "debit", 2, Some("6602"), 1),
            ("6603", "财务费用", "expense", "debit", 1, None, 0),
            ("660301", "利息支出", "expense", "debit", 2, Some("6603"), 1),
            ("660302", "手续费", "expense", "debit", 2, Some("6603"), 1),
            ("660303", "汇兑损失", "expense", "debit", 2, Some("6603"), 1),
            ("6701", "资产减值损失", "expense", "debit", 1, None, 1),
            ("6711", "营业外支出", "expense", "debit", 1, None, 0),
            ("671101", "非流动资产处置损失", "expense", "debit", 2, Some("6711"), 1),
            ("671102", "公益性捐赠支出", "expense", "debit", 2, Some("6711"), 1),
            ("6801", "所得税费用", "expense", "debit", 1, None, 1),
            ("6901", "以前年度损益调整", "expense", "debit", 1, None, 1),
        ]
    }

    fn non_profit_account_codes() -> Vec<(&'static str, &'static str, &'static str, &'static str, i32, Option<&'static str>, i32)> {
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
            ("1421", "长期投资减值准备", "asset", "credit", 1, None, 1),
            ("1501", "固定资产", "asset", "debit", 1, None, 1),
            ("1502", "累计折旧", "asset", "credit", 1, None, 1),
            ("1505", "在建工程", "asset", "debit", 1, None, 1),
            ("1506", "文物文化资产", "asset", "debit", 1, None, 1),
            ("1509", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1601", "无形资产", "asset", "debit", 1, None, 1),
            ("1701", "长期待摊费用", "asset", "debit", 1, None, 1),
            ("1801", "受托代理资产", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2101", "短期借款", "liability", "credit", 1, None, 1),
            ("2201", "应付票据", "liability", "credit", 1, None, 1),
            ("2202", "应付账款", "liability", "credit", 1, None, 1),
            ("2203", "预收账款", "liability", "credit", 1, None, 1),
            ("2204", "应付工资", "liability", "credit", 1, None, 1),
            ("2206", "应交税金", "liability", "credit", 1, None, 1),
            ("2209", "其他应付款", "liability", "credit", 1, None, 1),
            ("2301", "预提费用", "liability", "credit", 1, None, 1),
            ("2401", "预计负债", "liability", "credit", 1, None, 1),
            ("2501", "长期借款", "liability", "credit", 1, None, 1),
            ("2502", "长期应付款", "liability", "credit", 1, None, 1),
            ("2601", "受托代理负债", "liability", "credit", 1, None, 1),
            // === 净资产类 ===
            ("3101", "非限定性净资产", "equity", "credit", 1, None, 1),
            ("3102", "限定性净资产", "equity", "credit", 1, None, 1),
            // === 收入类 ===
            ("4101", "捐赠收入", "income", "credit", 1, None, 1),
            ("4201", "会费收入", "income", "credit", 1, None, 1),
            ("4301", "提供服务收入", "income", "credit", 1, None, 1),
            ("4401", "政府补助收入", "income", "credit", 1, None, 1),
            ("4501", "商品销售收入", "income", "credit", 1, None, 1),
            ("4601", "投资收益", "income", "credit", 1, None, 1),
            ("4901", "其他收入", "income", "credit", 1, None, 1),
            // === 费用类 ===
            ("5101", "业务活动成本", "expense", "debit", 1, None, 1),
            ("5201", "管理费用", "expense", "debit", 1, None, 1),
            ("5301", "筹资费用", "expense", "debit", 1, None, 1),
            ("5401", "其他费用", "expense", "debit", 1, None, 1),
        ]
    }

    fn cooperative_account_codes() -> Vec<(&'static str, &'static str, &'static str, &'static str, i32, Option<&'static str>, i32)> {
        vec![
            // === 资产类 (农民专业合作社) ===
            ("1001", "库存现金", "asset", "debit", 1, None, 1),
            ("1002", "银行存款", "asset", "debit", 1, None, 1),
            ("1011", "其他货币资金", "asset", "debit", 1, None, 1),
            ("1101", "短期投资", "asset", "debit", 1, None, 1),
            ("1111", "应收款", "asset", "debit", 1, None, 1),
            ("1121", "预付款", "asset", "debit", 1, None, 1),
            ("1131", "应收股利", "asset", "debit", 1, None, 1),
            ("1132", "应收利息", "asset", "debit", 1, None, 1),
            ("1141", "存货", "asset", "debit", 1, None, 1),
            ("1142", "消耗性生物资产", "asset", "debit", 1, None, 1),
            ("1143", "生产性生物资产", "asset", "debit", 1, None, 1),
            ("1144", "生产性生物资产累计折旧", "asset", "credit", 1, None, 1),
            ("1145", "公益性生物资产", "asset", "debit", 1, None, 1),
            ("1201", "长期投资", "asset", "debit", 1, None, 1),
            ("1211", "牲畜(禽)资产", "asset", "debit", 1, None, 1),
            ("1221", "林木资产", "asset", "debit", 1, None, 1),
            ("1301", "固定资产", "asset", "debit", 1, None, 1),
            ("1302", "累计折旧", "asset", "credit", 1, None, 1),
            ("1303", "在建工程", "asset", "debit", 1, None, 1),
            ("1304", "固定资产清理", "asset", "debit", 1, None, 1),
            ("1311", "无形资产", "asset", "debit", 1, None, 1),
            // === 负债类 ===
            ("2001", "短期借款", "liability", "credit", 1, None, 1),
            ("2101", "应付款", "liability", "credit", 1, None, 1),
            ("2102", "应付工资", "liability", "credit", 1, None, 1),
            ("2103", "应付福利费", "liability", "credit", 1, None, 1),
            ("2104", "应交税费", "liability", "credit", 1, None, 1),
            ("2105", "应付股利", "liability", "credit", 1, None, 1),
            ("2111", "预收款", "liability", "credit", 1, None, 1),
            ("2201", "长期借款", "liability", "credit", 1, None, 1),
            ("2202", "专项应付款", "liability", "credit", 1, None, 1),
            // === 所有者权益类 ===
            ("3001", "股金", "equity", "credit", 1, None, 1),
            ("3002", "专项基金", "equity", "credit", 1, None, 1),
            ("3003", "资本公积", "equity", "credit", 1, None, 1),
            ("3004", "盈余公积", "equity", "credit", 1, None, 1),
            ("3101", "本年盈余", "equity", "credit", 1, None, 1),
            ("3102", "盈余分配", "equity", "credit", 1, None, 1),
            // === 收入类 ===
            ("4001", "经营收入", "income", "credit", 1, None, 1),
            ("4002", "发包及上交收入", "income", "credit", 1, None, 1),
            ("4003", "农业资产出售收入", "income", "credit", 1, None, 1),
            ("4004", "租赁收入", "income", "credit", 1, None, 1),
            ("4101", "投资收益", "income", "credit", 1, None, 1),
            ("4201", "补助收入", "income", "credit", 1, None, 1),
            ("4301", "其他收入", "income", "credit", 1, None, 1),
            // === 支出(费用)类 ===
            ("5001", "经营支出", "expense", "debit", 1, None, 1),
            ("5002", "管理费用", "expense", "debit", 1, None, 1),
            ("5003", "其他支出", "expense", "debit", 1, None, 1),
            ("5101", "税金及附加", "expense", "debit", 1, None, 1),
        ]
    }

    async fn insert_default_report_templates(pool: &DbPool) -> Result<(), DbError> {
        // Balance Sheet template
        let bs_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, is_system) VALUES (?, 'BALANCE_SHEET', '资产负债表', 'balance_sheet', 1)",
        )
        .bind(&bs_id)
        .execute(pool)
        .await?;

        // (item_code, item_name, parent_id, level, sort_order, is_total, formula)
        let bs_items: Vec<(&str, &str, Option<&str>, i32, i32, i32, Option<&str>)> = vec![
            ("BS100", "流动资产", None, 1, 1, 0, None),
            ("BS101", "货币资金", None, 2, 2, 0, Some("1001+1002+1012")),
            ("BS102", "应收票据", None, 2, 3, 0, Some("1121")),
            ("BS103", "应收账款", None, 2, 4, 0, Some("1122-1231")),
            ("BS104", "预付款项", None, 2, 5, 0, Some("1123")),
            ("BS105", "存货", None, 2, 6, 0, Some("1401+1403+1405+1408-1471")),
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
            .bind(&uuid::Uuid::new_v4().to_string())
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
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, is_system) VALUES (?, 'INCOME_STATEMENT', '利润表', 'income_statement', 1)",
        )
        .bind(&is_id)
        .execute(pool)
        .await?;

        let is_items: Vec<(&str, &str, i32, i32, i32, Option<&str>)> = vec![
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
            .bind(&uuid::Uuid::new_v4().to_string())
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
            "INSERT OR IGNORE INTO report_templates (id, template_code, template_name, report_type, is_system) VALUES (?, 'CASH_FLOW', '现金流量表', 'cash_flow', 1)",
        )
        .bind(&cf_id)
        .execute(pool)
        .await?;

        let cf_items: Vec<(&str, &str, i32, i32, i32, Option<&str>)> = vec![
            // Operating activities
            ("CF100", "一、经营活动产生的现金流量", 1, 1, 0, None),
            ("CF101", "销售商品、提供劳务收到的现金", 2, 2, 0, Some("credit:1121+credit:1122+credit:1123+credit:1221")),
            ("CF102", "收到的税费返还", 2, 3, 0, None),
            ("CF103", "收到其他与经营活动有关的现金", 2, 4, 0, None),
            ("CF104", "购买商品、接受劳务支付的现金", 2, 5, 0, Some("debit:2201+debit:2202+debit:2203+debit:2241")),
            ("CF105", "支付给职工以及为职工支付的现金", 2, 6, 0, Some("debit:2211")),
            ("CF106", "支付的各项税费", 2, 7, 0, Some("debit:2221")),
            ("CF107", "支付其他与经营活动有关的现金", 2, 8, 0, None),
            ("CF199", "经营活动产生的现金流量净额", 1, 9, 1, None),
            // Investing activities
            ("CF200", "二、投资活动产生的现金流量", 1, 10, 0, None),
            ("CF201", "收回投资收到的现金", 2, 11, 0, None),
            ("CF202", "取得投资收益收到的现金", 2, 12, 0, None),
            ("CF203", "处置固定资产、无形资产收回的现金净额", 2, 13, 0, None),
            ("CF204", "购建固定资产、无形资产支付的现金", 2, 14, 0, Some("debit:1601+debit:1604+debit:1701")),
            ("CF205", "投资支付的现金", 2, 15, 0, None),
            ("CF299", "投资活动产生的现金流量净额", 1, 16, 1, None),
            // Financing activities
            ("CF300", "三、筹资活动产生的现金流量", 1, 17, 0, None),
            ("CF301", "吸收投资收到的现金", 2, 18, 0, Some("credit:4001+credit:4002")),
            ("CF302", "取得借款收到的现金", 2, 19, 0, Some("credit:2001+credit:2501")),
            ("CF303", "偿还债务支付的现金", 2, 20, 0, None),
            ("CF304", "分配股利、利润或偿付利息支付的现金", 2, 21, 0, None),
            ("CF399", "筹资活动产生的现金流量净额", 1, 22, 1, None),
            // Summary
            ("CF400", "四、汇率变动对现金的影响", 1, 23, 0, None),
            ("CF999", "五、现金及现金等价物净增加额", 1, 24, 1, Some("1001+1002+1012")),
        ];

        for (item_code, item_name, level, sort_order, is_total, formula) in &cf_items {
            sqlx::query(
                "INSERT OR IGNORE INTO report_items (id, template_id, item_code, item_name, item_level, sort_order, is_total, formula) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&uuid::Uuid::new_v4().to_string())
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

        Ok(())
    }

    async fn insert_default_companies(pool: &DbPool) -> Result<(), DbError> {
        let current_year = chrono::Local::now().format("%Y").to_string().parse::<i32>().unwrap_or(2026);
        let current_month = chrono::Local::now().format("%m").to_string().parse::<i32>().unwrap_or(1);

        let companies = vec![
            ("A", "示例公司A", "北京市", "朝阳区"),
            ("B", "示例公司B", "上海市", "浦东新区"),
        ];

        for (code, name, province, city) in companies {
            let company_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO companies (id, code, name, tax_type, accounting_system, province, city) VALUES (?, ?, ?, 'small', 'small_enterprise', ?, ?)",
            )
            .bind(&company_id)
            .bind(code)
            .bind(name)
            .bind(province)
            .bind(city)
            .execute(pool)
            .await?;

            // Create default auxiliary categories for this company
            let aux_categories = vec![
                ("CUST", "客户", true),
                ("SUPP", "供应商", true),
                ("EMP", "职员", true),
                ("PROJ", "项目", true),
                ("DEPT", "部门", true),
                ("INV", "存货", true),
            ];
            for (cat_code, cat_name, is_system) in aux_categories {
                sqlx::query(
                    "INSERT OR IGNORE INTO auxiliary_categories (id, company_id, name, code, is_system, sort_order) VALUES (?, ?, ?, ?, ?, 0)",
                )
                .bind(&uuid::Uuid::new_v4().to_string())
                .bind(&company_id)
                .bind(cat_name)
                .bind(cat_code)
                .bind(is_system as i32)
                .execute(pool)
                .await?;
            }

            // Create default base currency (CNY)
            sqlx::query(
                "INSERT OR IGNORE INTO currencies (id, company_id, code, name, exchange_rate, is_base) VALUES (?, ?, 'CNY', '人民币', 1.0, 1)",
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(&company_id)
            .execute(pool)
            .await?;

            // Create voucher word for this company (unified "记" prefix)
            let words = vec![
                ("Ji", "记"),
            ];
            for (word_code, word_name) in words {
                sqlx::query(
                    "INSERT OR IGNORE INTO voucher_words (id, company_id, word_code, word_name) VALUES (?, ?, ?, ?)",
                )
                .bind(&uuid::Uuid::new_v4().to_string())
                .bind(&company_id)
                .bind(word_code)
                .bind(word_name)
                .execute(pool)
                .await?;
            }

            // Create the current month's accounting period
            let start_date = format!("{}-{:02}-01", current_year, current_month);
            let end_day = days_in_month(current_year, current_month);
            let end_date = format!("{}-{:02}-{}", current_year, current_month, end_day);

            sqlx::query(
                "INSERT INTO accounting_periods (id, company_id, period_year, period_month, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(&company_id)
            .bind(current_year)
            .bind(current_month)
            .bind(&start_date)
            .bind(&end_date)
            .execute(pool)
            .await?;

            // Seed account codes for this company
            Self::insert_default_account_codes(pool, &company_id).await?;

            log::info!("Created company {} with period, voucher words, and account codes", name);
        }

        Ok(())
    }

    async fn insert_default_agency_operations(pool: &DbPool) -> Result<(), DbError> {
        let existing: (i64,) = sqlx::query_as(
            r#"
            SELECT
                (SELECT COUNT(*) FROM agency_service_contracts) +
                (SELECT COUNT(*) FROM agency_fee_collections) +
                (SELECT COUNT(*) FROM agency_collaboration_items) +
                (SELECT COUNT(*) FROM agency_delivery_tickets)
            "#,
        )
        .fetch_one(pool)
        .await?;

        if existing.0 > 0 {
            return Ok(());
        }

        let companies: Vec<(String, String)> =
            sqlx::query_as("SELECT id, name FROM companies WHERE is_deleted = 0 ORDER BY created_at LIMIT 3")
                .fetch_all(pool)
                .await?;

        for (index, (company_id, company_name)) in companies.iter().enumerate() {
            let suffix = index + 1;
            let owner = match index {
                0 => "张会计",
                1 => "李会计",
                _ => "王会计",
            };
            let package = if index == 1 { "小规模基础包" } else { "一般纳税人标准包" };
            let monthly_fee = if index == 1 { 1200.0 } else { 2800.0 + index as f64 * 400.0 };
            let contract_status = if index == 2 { "expiring" } else { "active" };
            let renewal_status = if index == 2 { "30天内到期" } else { "正常" };
            let payment_status = if index == 0 { "paid" } else if index == 1 { "pending" } else { "overdue" };
            let received_amount = if index == 0 { monthly_fee } else { 0.0 };
            let arrears_amount = monthly_fee - received_amount;
            let collaboration_status = if index == 2 { "overdue" } else if index == 1 { "completed" } else { "pending" };
            let ticket_status = if index == 2 { "blocked" } else if index == 1 { "waiting_customer" } else { "processing" };

            sqlx::query(
                r#"
                INSERT OR IGNORE INTO agency_service_contracts
                    (id, company_id, contract_no, service_package, service_start, service_end, monthly_fee, renewal_status, owner, archive_status, status)
                VALUES (?, ?, ?, ?, '2026-01-01', '2026-12-31', ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(company_id)
            .bind(format!("FW-2026-{:04}", suffix))
            .bind(package)
            .bind(monthly_fee)
            .bind(renewal_status)
            .bind(owner)
            .bind(if index == 1 { "待上传" } else { "合同PDF" })
            .bind(contract_status)
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                INSERT OR IGNORE INTO agency_fee_collections
                    (id, company_id, period, receivable_amount, received_amount, arrears_amount, invoice_status, payment_status, collector, last_follow_up, status)
                VALUES (?, ?, '2026-05', ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(company_id)
            .bind(monthly_fee)
            .bind(received_amount)
            .bind(arrears_amount)
            .bind(if index == 0 { "issued" } else { "pending" })
            .bind(payment_status)
            .bind(owner)
            .bind(if index == 2 { "2026-06-24 09:00" } else { "2026-06-26 10:30" })
            .bind(payment_status)
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO agency_collaboration_items
                    (id, company_id, todo_title, material_type, customer_contact, reminder_count, last_contact_at, reply_status, owner, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(company_id)
            .bind(if index == 2 { "补传销项发票" } else { "补传 5 月银行回单" })
            .bind(if index == 2 { "发票影像" } else { "银行回单" })
            .bind(if index == 0 { "陈经理" } else if index == 1 { "刘总" } else { "周会计" })
            .bind(if index == 2 { 4 } else { 1 + index as i32 })
            .bind(if index == 2 { "2026-06-24 09:00" } else { "2026-06-26 14:12" })
            .bind(if index == 1 { "已确认" } else if index == 2 { "超时" } else { "待回复" })
            .bind(owner)
            .bind(collaboration_status)
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                INSERT OR IGNORE INTO agency_delivery_tickets
                    (id, company_id, ticket_no, task_name, period, current_stage, sla_status, owner, delivery_status, status)
                VALUES (?, ?, ?, ?, '2026-05', ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&uuid::Uuid::new_v4().to_string())
            .bind(company_id)
            .bind(format!("GD-202605-{:04}", 180 + suffix))
            .bind(if index == 2 { "增值税申报" } else { "月度做账交付" })
            .bind(if index == 0 { "凭证复核" } else if index == 1 { "客户确认" } else { "资料缺失" })
            .bind(if index == 2 { "已超时" } else { "正常" })
            .bind(owner)
            .bind(ticket_status)
            .bind(ticket_status)
            .execute(pool)
            .await?;

            log::info!("Seeded agency operation data for {}", company_name);
        }

        Ok(())
    }
}

fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
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

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
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
    pub created_by: Option<String>,
    pub reference_number: Option<String>,
    pub entries: Vec<CreateVoucherEntryInput>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateVoucherInput {
    pub id: String,
    pub voucher_date: Option<String>,
    pub summary: Option<String>,
    pub attachment_count: Option<i32>,
    pub modified_by: Option<String>,
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

#[derive(Debug, Clone, serde::Deserialize)]
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
    pub created_by: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ClosePeriodInput {
    pub period_id: String,
    pub closed_by: Option<String>,
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

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct SocialSecurityRecord { pub id: String, pub company_id: String, pub employee_id: String, pub employee_name: String, pub period: String, pub city: Option<String>, pub contribution_base: f64, pub company_amount: f64, pub personal_amount: f64, pub fund_amount: f64, pub status: String, pub created_at: String, pub updated_at: String }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSocialSecurityRecordInput { pub company_id: String, pub employee_id: String, pub period: String, pub city: Option<String>, pub contribution_base: f64, pub company_amount: f64, pub personal_amount: f64, pub fund_amount: f64 }

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
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AccountTransfer { pub id: String, pub company_id: String, pub period: String, pub transfer_date: String, pub from_account: String, pub to_account: String, pub amount: f64, pub fee: f64, pub serial_no: Option<String>, pub status: String, pub created_at: String, pub updated_at: String }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAccountTransferInput { pub company_id: String, pub period: String, pub transfer_date: String, pub from_account: String, pub to_account: String, pub amount: f64, pub fee: Option<f64>, pub serial_no: Option<String> }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAccountTransferInput { pub id: String, pub company_id: String, pub transfer_date: String, pub from_account: String, pub to_account: String, pub amount: f64, pub fee: Option<f64>, pub serial_no: Option<String> }

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct FixedAsset { pub id: String, pub company_id: String, pub period: String, pub asset_code: String, pub asset_name: String, pub category: String, pub start_date: String, pub original_value: f64, pub useful_life_months: i64, pub residual_rate: f64, pub source_document: Option<String>, pub status: String, pub created_at: String, pub updated_at: String }

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateFixedAssetInput { pub company_id: String, pub period: String, pub asset_code: String, pub asset_name: String, pub category: String, pub start_date: String, pub original_value: f64, pub useful_life_months: i64, pub residual_rate: Option<f64>, pub source_document: Option<String> }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateFixedAssetInput { pub id: String, pub company_id: String, pub asset_code: String, pub asset_name: String, pub category: String, pub start_date: String, pub original_value: f64, pub useful_life_months: i64, pub residual_rate: Option<f64>, pub source_document: Option<String> }

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryMovement { pub id: String, pub company_id: String, pub period: String, pub movement_date: String, pub bill_no: String, pub movement_type: String, pub inventory_name: String, pub warehouse: String, pub counterparty: Option<String>, pub unit: String, pub quantity: f64, pub amount: f64, pub source_document: Option<String>, pub status: String, pub created_at: String, pub updated_at: String }

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryMovementInput { pub company_id: String, pub period: String, pub movement_date: String, pub bill_no: String, pub movement_type: String, pub inventory_name: String, pub warehouse: String, pub counterparty: Option<String>, pub unit: String, pub quantity: f64, pub amount: f64, pub source_document: Option<String> }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateInventoryMovementInput { pub id: String, pub company_id: String, pub movement_date: String, pub bill_no: String, pub movement_type: String, pub inventory_name: String, pub warehouse: String, pub counterparty: Option<String>, pub unit: String, pub quantity: f64, pub amount: f64, pub source_document: Option<String> }

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct InventoryItem { pub id: String, pub company_id: String, pub item_code: String, pub item_name: String, pub specification: Option<String>, pub unit: String, pub tax_rate: Option<f64>, pub default_subject: Option<String>, pub status: String, pub created_at: String, pub updated_at: String }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateInventoryItemInput { pub company_id: String, pub item_code: String, pub item_name: String, pub specification: Option<String>, pub unit: String, pub tax_rate: Option<f64>, pub default_subject: Option<String> }
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)] pub struct MeasurementUnit { pub id:String, pub company_id:String, pub unit_name:String, pub unit_group:Option<String>, pub base_unit:Option<String>, pub conversion_rate:f64, pub precision_digits:i64, pub remark:Option<String>, pub status:String, pub created_at:String, pub updated_at:String }
#[derive(Debug, Clone, serde::Deserialize)] pub struct CreateMeasurementUnitInput { pub company_id:String, pub unit_name:String, pub unit_group:Option<String>, pub base_unit:Option<String>, pub conversion_rate:f64, pub precision_digits:i64, pub remark:Option<String> }

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
pub struct CreateAgencyServiceContractInput { pub company_id:String, pub contract_no:String, pub service_package:String, pub service_start:String, pub service_end:String, pub monthly_fee:f64, pub owner:Option<String> }

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

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateAgencyBatchTasksInput {
    pub period: String,
    pub operator: Option<String>,
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
    pub status: Option<String>,
    pub confidence: Option<f64>,
    pub result_summary: Option<String>,
    pub risk_level: Option<String>,
    pub reviewer: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateAutomationJobStatusInput {
    pub id: String,
    pub company_id: String,
    pub status: String,
    pub confidence: Option<f64>,
    pub result_summary: Option<String>,
    pub risk_level: Option<String>,
    pub reviewer: Option<String>,
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
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ConfirmTaxDeclarationTaskInput {
    pub id: String,
    pub company_id: String,
    pub confirmed_by: Option<String>,
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
    pub operator: Option<String>,
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
