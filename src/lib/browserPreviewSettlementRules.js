export const BROWSER_PREVIEW_SETTLEMENT_RULES_KEY =
  "accounting-preview-settlement-rules-v1";

function isRule(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.id === "string" &&
      typeof value.company_id === "string" &&
      typeof value.name === "string" &&
      typeof value.rule_type === "string" &&
      Number.isInteger(value.priority) &&
      Number.isFinite(value.is_enabled),
  );
}

export function readBrowserPreviewSettlementRules(storage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(BROWSER_PREVIEW_SETTLEMENT_RULES_KEY) || "[]",
    );
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}
