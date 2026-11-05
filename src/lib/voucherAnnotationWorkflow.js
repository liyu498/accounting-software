export const MAX_VOUCHER_ANNOTATION_LENGTH = 500;

export function normalizeVoucherAnnotation(value) {
  const content = String(value ?? "").trim();
  if (!content) {
    throw new Error("批注内容不能为空");
  }
  if (content.length > MAX_VOUCHER_ANNOTATION_LENGTH) {
    throw new Error(`批注内容不能超过 ${MAX_VOUCHER_ANNOTATION_LENGTH} 个字符`);
  }
  return content;
}

export function createVoucherAnnotationPayloads({
  voucherIds,
  companyId,
  content,
  operatorId,
}) {
  const normalizedCompanyId = String(companyId ?? "").trim();
  if (!normalizedCompanyId) {
    throw new Error("请选择账套后再添加批注");
  }

  const normalizedContent = normalizeVoucherAnnotation(content);
  const normalizedOperatorId = String(operatorId ?? "").trim() || "admin";
  const ids = [...new Set((voucherIds ?? []).map((id) => String(id).trim()).filter(Boolean))];

  if (ids.length === 0) {
    throw new Error("请至少选择一张凭证");
  }

  return ids.map((voucherId) => ({
    voucherId,
    companyId: normalizedCompanyId,
    content: normalizedContent,
    operatorId: normalizedOperatorId,
  }));
}
