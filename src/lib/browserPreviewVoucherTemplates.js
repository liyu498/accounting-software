const templateStorageKey = "accounting-preview-voucher-templates-v1";
const typeStorageKey = "accounting-preview-voucher-template-types-v1";

function readStorage(key) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function previewId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function loadBrowserPreviewVoucherTemplateTypes(companyId) {
  return readStorage(typeStorageKey).filter((item) => item?.company_id === companyId);
}

export function loadBrowserPreviewVoucherTemplates(companyId) {
  return readStorage(templateStorageKey).filter(
    (item) => item?.template?.company_id === companyId && Array.isArray(item.entries),
  );
}

export function createBrowserPreviewVoucherTemplateType(companyId, name, sortOrder) {
  const item = {
    id: previewId("preview-template-type"),
    company_id: companyId,
    name,
    sort_order: sortOrder,
  };
  writeStorage(typeStorageKey, [...readStorage(typeStorageKey), item]);
  return item;
}

export function createBrowserPreviewVoucherTemplate(input) {
  const item = {
    template: {
      id: previewId("preview-template"),
      type_id: input.typeId,
      company_id: input.companyId,
      name: input.name,
      entries_json: JSON.stringify(input.entries),
    },
    entries: input.entries,
  };
  writeStorage(templateStorageKey, [...readStorage(templateStorageKey), item]);
  return item;
}
