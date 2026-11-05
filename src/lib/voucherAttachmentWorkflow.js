export function filterVoucherAttachments(records, voucherId) {
  if (!voucherId) return [];
  return records.filter((record) => record.relatedDocument === voucherId);
}

export function cloneVoucherAttachmentAssociations({
  records,
  sourceVoucherId,
  targetVoucherId,
  createId = () => `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  createdAt = new Date().toLocaleString("zh-CN"),
}) {
  if (!sourceVoucherId || !targetVoucherId || sourceVoucherId === targetVoucherId) return [];
  return filterVoucherAttachments(records, sourceVoucherId).map((record) => ({
    ...record,
    id: createId(),
    relatedDocument: targetVoucherId,
    status: "已关联",
    createdAt,
  }));
}
