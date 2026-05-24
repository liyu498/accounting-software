use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryRequest {
    pub sql: String,
    pub params: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResponse {
    pub success: bool,
    pub data: Option<Vec<serde_json::Value>>,
    pub rows_affected: Option<u64>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub sql: String,
    pub params: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteResponse {
    pub success: bool,
    pub rows_affected: Option<u64>,
    pub message: String,
}

/// Execute read queries (SELECT, etc.)
#[tauri::command]
pub async fn query(request: QueryRequest) -> Result<QueryResponse, String> {
    // Placeholder implementation - actual implementation would execute SQL
    // Database schema reference:
    // - users: id, username, password_hash, real_name, role, is_active, last_login_at, created_at, updated_at
    // - customers: id, name, tax_id, contact, phone, email, address, bank_name, bank_account, tax_type, industry, created_by, created_at, updated_at
    // - accounts: id, customer_id, name, year, month, status, created_at, updated_at
    // - subjects: id, code, name, type, direction, parent_id, level, is_detail, is_cash_flow, created_at, updated_at
    // - vouchers: id, account_id, voucher_no, date, voucher_type, abstract, status, attachment_count, created_by, approved_by, posted_by, created_at, updated_at
    // - voucher_items: id, voucher_id, subject_id, amount, direction, summary, sequence_no, created_at
    // - invoices: id, customer_id, invoice_type, invoice_no, invoice_code, invoice_date, amount, tax_amount, total_amount, tax_rate, seller_name, seller_tax_id, buyer_name, buyer_tax_id, status, voucher_id, source, raw_data, ocr_confidence, remarks, created_by, created_at, updated_at
    // - inventory_items: id, customer_id, code, name, spec, unit, category, purchase_price, selling_price, initial_stock, current_stock, min_stock, max_stock, is_active, created_at, updated_at
    // - inventory_transactions: id, inventory_id, account_id, transaction_type, quantity, unit_price, amount, direction, voucher_id, transaction_date, warehouse, reference_no, remarks, created_by, created_at
    // - bank_reconciliations: id, account_id, statement_date, statement_balance, book_balance, difference, status, bank_statement_no, adjustments, prepared_by, prepared_at, created_at
    // - ai_processing_logs: id, entity_type, entity_id, agent_type, prompt, response, status, error, processing_time_ms, tokens_used, model_version, created_at
    // - vector_embeddings: id, entity_type, entity_id, embedding_source, content_text, content_hash, metadata, created_at, updated_at

    Ok(QueryResponse {
        success: true,
        data: Some(vec![]),
        rows_affected: Some(0),
        message: "Query executed successfully (placeholder)".to_string(),
    })
}

/// Execute write queries (INSERT, UPDATE, DELETE, etc.)
#[tauri::command]
pub async fn execute(request: ExecuteRequest) -> Result<ExecuteResponse, String> {
    // Placeholder implementation - actual implementation would execute SQL
    Ok(ExecuteResponse {
        success: true,
        rows_affected: Some(0),
        message: "Execute completed successfully (placeholder)".to_string(),
    })
}
