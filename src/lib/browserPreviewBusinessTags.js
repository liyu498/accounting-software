const businessTagStorageKey = "accounting-preview-business-tags-v1";
const voucherTagLinkStorageKey = "accounting-preview-voucher-tag-links-v1";

function readArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser preview remains usable when local storage is unavailable.
  }
}

function isBusinessTag(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.company_id === "string" &&
      typeof value.name === "string" &&
      typeof value.applicable_modules === "string" &&
      typeof value.color_name === "string" &&
      Number.isFinite(value.usage_count) &&
      (value.is_enabled === 0 || value.is_enabled === 1),
  );
}

function isVoucherTagLink(value) {
  return Boolean(
    value &&
      typeof value.company_id === "string" &&
      typeof value.voucher_id === "string" &&
      Array.isArray(value.tag_ids) &&
      value.tag_ids.every((id) => typeof id === "string"),
  );
}

export function loadBrowserPreviewBusinessTags(companyId) {
  return readArray(businessTagStorageKey)
    .filter(isBusinessTag)
    .filter((tag) => tag.company_id === companyId);
}

export function saveBrowserPreviewBusinessTags(companyId, tags) {
  const existing = readArray(businessTagStorageKey).filter(isBusinessTag);
  writeArray(businessTagStorageKey, [
    ...existing.filter((tag) => tag.company_id !== companyId),
    ...tags,
  ]);
}

export function loadBrowserPreviewVoucherTagIds(voucherId, companyId) {
  const link = readArray(voucherTagLinkStorageKey)
    .filter(isVoucherTagLink)
    .find(
      (item) =>
        item.company_id === companyId && item.voucher_id === voucherId,
    );
  return link ? [...new Set(link.tag_ids)] : [];
}

export function replaceBrowserPreviewVoucherTags(
  voucherId,
  companyId,
  tagIds,
) {
  const links = readArray(voucherTagLinkStorageKey).filter(isVoucherTagLink);
  const distinctTagIds = [...new Set(tagIds.filter(Boolean))];
  writeArray(voucherTagLinkStorageKey, [
    ...links.filter(
      (item) =>
        item.company_id !== companyId || item.voucher_id !== voucherId,
    ),
    { company_id: companyId, voucher_id: voucherId, tag_ids: distinctTagIds },
  ]);
  return distinctTagIds;
}

export function copyBrowserPreviewVoucherTags(
  sourceVoucherId,
  targetVoucherId,
  companyId,
) {
  return replaceBrowserPreviewVoucherTags(
    targetVoucherId,
    companyId,
    loadBrowserPreviewVoucherTagIds(sourceVoucherId, companyId),
  );
}
