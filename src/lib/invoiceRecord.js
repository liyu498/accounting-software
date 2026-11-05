export function normalizeInvoiceRecord(record) {
  return {
    id: record.id,
    companyId: record.companyId ?? record.company_id ?? null,
    periodId: record.periodId ?? record.period_id ?? null,
    invoiceType: record.invoiceType ?? record.invoice_type,
    invoiceNo: record.invoiceNo ?? record.invoice_no,
    invoiceCode: record.invoiceCode ?? record.invoice_code ?? null,
    invoiceDate: record.invoiceDate ?? record.invoice_date,
    amount: Number(record.amount) || 0,
    taxAmount: Number(record.taxAmount ?? record.tax_amount) || 0,
    totalAmount: Number(record.totalAmount ?? record.total_amount) || 0,
    taxRate: record.taxRate ?? record.tax_rate ?? null,
    sellerName: record.sellerName ?? record.seller_name ?? null,
    sellerTaxId: record.sellerTaxId ?? record.seller_tax_id ?? null,
    buyerName: record.buyerName ?? record.buyer_name ?? null,
    buyerTaxId: record.buyerTaxId ?? record.buyer_tax_id ?? null,
    status: record.status,
    voucherId: record.voucherId ?? record.voucher_id ?? null,
    remarks: record.remarks ?? null,
    createdAt: record.createdAt ?? record.created_at,
    updatedAt: record.updatedAt ?? record.updated_at,
  }
}
