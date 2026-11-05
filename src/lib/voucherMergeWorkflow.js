const BALANCE_TOLERANCE = 0.005;
const MAX_MERGED_ENTRIES = 500;

function isBalanced(voucher) {
  return Math.abs(Number(voucher.total_debit || 0) - Number(voucher.total_credit || 0)) < BALANCE_TOLERANCE;
}

function cleanOptional(value) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function createMergedVoucherDraft(sourceVouchers, createdBy = "admin") {
  const uniqueSources = Array.from(
    new Map((sourceVouchers ?? []).filter(Boolean).map((voucher) => [voucher.id, voucher])).values(),
  );
  if (uniqueSources.length < 2) {
    throw new Error("至少选择两张凭证后再合并");
  }

  const first = uniqueSources[0];
  if (uniqueSources.some((voucher) => voucher.company_id !== first.company_id)) {
    throw new Error("只能合并同一账套的凭证");
  }
  if (uniqueSources.some((voucher) => voucher.period_id !== first.period_id)) {
    throw new Error("只能合并同一账期的凭证");
  }
  if (uniqueSources.some((voucher) => voucher.voucher_word_id !== first.voucher_word_id)) {
    throw new Error("只能合并相同凭证字的凭证");
  }
  if (uniqueSources.some((voucher) => voucher.status !== "draft")) {
    throw new Error("只能合并草稿凭证");
  }
  if (uniqueSources.some((voucher) => !isBalanced(voucher))) {
    throw new Error("只能合并借贷平衡的凭证");
  }

  const entries = uniqueSources.flatMap((voucher) =>
    (voucher.entries ?? []).map((entry) => ({
      account_code: entry.account_code,
      account_name: entry.account_name,
      direction: entry.direction,
      amount: Number(entry.amount || 0),
      summary: cleanOptional(entry.summary) || cleanOptional(voucher.summary),
      auxiliary_type: cleanOptional(entry.auxiliary_type),
      auxiliary_id: cleanOptional(entry.auxiliary_id),
      doc_number: cleanOptional(entry.doc_number),
      quantity: entry.quantity ?? undefined,
      unit_price: entry.unit_price ?? undefined,
      unit: cleanOptional(entry.unit),
      currency_id: cleanOptional(entry.currency_id),
      exchange_rate: entry.exchange_rate ?? undefined,
      auxiliary_items: Array.isArray(entry.auxiliary_items)
        ? entry.auxiliary_items.map((item) => ({ ...item }))
        : undefined,
    })),
  );
  if (entries.length === 0) {
    throw new Error("所选凭证没有可合并的分录");
  }
  if (entries.length > MAX_MERGED_ENTRIES) {
    throw new Error(`合并后的分录不能超过 ${MAX_MERGED_ENTRIES} 行`);
  }

  const voucherNumbers = uniqueSources.map((voucher) => voucher.voucher_number);
  const description = voucherNumbers.join("、");
  return {
    company_id: first.company_id,
    period_id: first.period_id,
    voucher_word_id: first.voucher_word_id,
    voucher_date: uniqueSources
      .map((voucher) => voucher.voucher_date)
      .sort()
      .at(-1),
    summary: `合并凭证：${description}`,
    attachment_count: uniqueSources.reduce(
      (sum, voucher) => sum + Number(voucher.attachment_count || 0),
      0,
    ),
    created_by: String(createdBy || "admin").trim() || "admin",
    reference_number: `MERGE:${voucherNumbers.join(",")}`,
    entries,
  };
}
