function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isBalanced(voucher) {
  return Math.abs(Number(voucher.total_debit || 0) - Number(voucher.total_credit || 0)) < 0.005;
}

export function filterVoucherList(vouchers, filters, tagNamesByVoucher = {}) {
  const keyword = normalize(filters.keyword);
  const accountKeyword = normalize(filters.accountKeyword);

  return vouchers.filter((voucher) => {
    const entries = Array.isArray(voucher.entries) ? voucher.entries : [];
    const tagNames = tagNamesByVoucher[voucher.id] || [];
    const inTab = filters.tab === "all"
      || (filters.tab === "draft" && voucher.status === "draft")
      || (filters.tab === "approved" && voucher.status === "approved")
      || (filters.tab === "unbalanced" && !isBalanced(voucher));
    const searchText = [
      voucher.voucher_number,
      voucher.voucher_date,
      voucher.summary,
      voucher.reference_number,
      voucher.created_by,
      voucher.approved_by,
      ...tagNames,
      ...entries.flatMap((entry) => [
        entry.account_code,
        entry.account_name,
        entry.summary,
        entry.doc_number,
      ]),
    ].filter(Boolean).join(" ").toLowerCase();
    const accountText = entries
      .flatMap((entry) => [entry.account_code, entry.account_name, entry.summary])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const attachmentCount = Number(voucher.attachment_count || 0);
    const hasExpectedAttachments = filters.attachmentFilter === "with"
      ? attachmentCount > 0
      : filters.attachmentFilter === "without"
        ? attachmentCount === 0
        : true;

    return inTab
      && (!keyword || searchText.includes(keyword))
      && (!filters.startDate || voucher.voucher_date >= filters.startDate)
      && (!filters.endDate || voucher.voucher_date <= filters.endDate)
      && (!accountKeyword || accountText.includes(accountKeyword))
      && (!filters.tagName || tagNames.includes(filters.tagName))
      && hasExpectedAttachments;
  });
}

export function sortVoucherList(vouchers, sortMode = "date-desc") {
  const rows = [...vouchers];
  const compareText = (left, right) => String(left || "").localeCompare(String(right || ""), "zh-CN", { numeric: true });
  const compareAmount = (left, right) => Number(left?.total_debit || 0) - Number(right?.total_debit || 0);
  const compareDate = (left, right) => compareText(left?.voucher_date, right?.voucher_date);
  const compareNumber = (left, right) => compareText(left?.voucher_number, right?.voucher_number);
  const compareCreated = (left, right) => compareText(left?.created_at, right?.created_at);

  rows.sort((left, right) => {
    if (sortMode === "date-asc") return compareDate(left, right) || compareNumber(left, right);
    if (sortMode === "number-asc") return compareNumber(left, right);
    if (sortMode === "number-desc") return compareNumber(right, left);
    if (sortMode === "amount-asc") return compareAmount(left, right) || compareNumber(left, right);
    if (sortMode === "amount-desc") return compareAmount(right, left) || compareNumber(left, right);
    if (sortMode === "created-desc") return compareCreated(right, left) || compareNumber(right, left);
    return compareDate(right, left) || compareNumber(right, left);
  });
  return rows;
}
