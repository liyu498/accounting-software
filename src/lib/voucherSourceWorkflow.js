const SUPPORTED_SOURCE_KINDS = new Set([
  "invoice",
  "ai_suggestion",
  "bank_transaction",
  "document_record",
  "business_order",
  "account_transfer",
  "cost_carryover",
  "payroll_batch",
  "social_security_batch",
  "depreciation_batch",
]);

function nonEmpty(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function moneyText(value) {
  return String(money(value));
}

export function buildVoucherSourcePath({ kind, id }) {
  const normalizedKind = nonEmpty(kind);
  const normalizedId = nonEmpty(id);
  if (!SUPPORTED_SOURCE_KINDS.has(normalizedKind) || !normalizedId) {
    throw new Error("凭证来源参数无效");
  }
  const search = new URLSearchParams({
    source: normalizedKind,
    sourceId: normalizedId,
  });
  return `/vouchers/new?${search.toString()}`;
}

export function parseVoucherSourceSearch(search) {
  const params = new URLSearchParams(nonEmpty(search).replace(/^\?/, ""));
  const kind = nonEmpty(params.get("source"));
  const id = nonEmpty(params.get("sourceId"));
  if (!SUPPORTED_SOURCE_KINDS.has(kind) || !id) return null;
  return { kind, id };
}

export function canCreateVoucherFromInvoice(invoice) {
  return nonEmpty(invoice?.status) === "verified";
}

export function buildInvoiceVoucherPrefill(invoice) {
  const invoiceType = nonEmpty(invoice?.invoiceType || invoice?.invoice_type);
  if (!['input', 'output'].includes(invoiceType)) {
    throw new Error("发票类型无效，不能生成凭证草稿");
  }

  const invoiceNo = nonEmpty(invoice?.invoiceNo || invoice?.invoice_no);
  const invoiceDate = nonEmpty(invoice?.invoiceDate || invoice?.invoice_date);
  const amount = money(invoice?.amount);
  const taxAmount = money(invoice?.taxAmount ?? invoice?.tax_amount);
  const suppliedTotal = money(invoice?.totalAmount ?? invoice?.total_amount);
  const totalAmount = suppliedTotal > 0 ? suppliedTotal : money(amount + taxAmount);
  if (!invoiceNo || !invoiceDate || amount <= 0 || totalAmount <= 0) {
    throw new Error("发票缺少号码、日期或有效金额，不能生成凭证草稿");
  }

  const counterparty = nonEmpty(
    invoiceType === "output"
      ? invoice?.buyerName || invoice?.buyer_name
      : invoice?.sellerName || invoice?.seller_name,
  );
  const summary = `${invoiceType === "output" ? "销售收入" : "采购支出"}${counterparty ? ` - ${counterparty}` : ""}`;
  const shared = { summary, docNumber: invoiceNo };
  const entries = invoiceType === "output"
    ? [
        { ...shared, direction: "debit", amount: moneyText(totalAmount) },
        { ...shared, direction: "credit", amount: moneyText(amount) },
        ...(taxAmount > 0
          ? [{ ...shared, direction: "credit", amount: moneyText(taxAmount) }]
          : []),
      ]
    : [
        { ...shared, direction: "debit", amount: moneyText(amount) },
        ...(taxAmount > 0
          ? [{ ...shared, direction: "debit", amount: moneyText(taxAmount) }]
          : []),
        { ...shared, direction: "credit", amount: moneyText(totalAmount) },
      ];

  return {
    voucherDate: invoiceDate,
    summary,
    referenceNumber: invoiceNo,
    entries,
  };
}
