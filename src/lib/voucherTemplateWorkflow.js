function optionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createVoucherTemplateEntries(entries, voucherSummary = "") {
  return entries
    .filter((entry) => String(entry.accountCode || "").trim())
    .map((entry) => {
      const auxiliaryItems = serializeAuxiliarySelections(
        entry.auxiliarySelections ||
          hydrateAuxiliarySelections({
            auxiliary_type: entry.auxiliaryType,
            auxiliary_id: entry.auxiliaryId,
          }),
      );
      const firstAuxiliary = auxiliaryItems[0];
      return {
      account_code: String(entry.accountCode || "").trim(),
      account_name: String(entry.accountName || "").trim(),
      direction: entry.direction === "credit" ? "credit" : "debit",
      amount: optionalNumber(entry.amount),
      summary: String(entry.summary || voucherSummary || "").trim(),
      auxiliary_type: optionalText(
        firstAuxiliary?.auxiliary_category_id || entry.auxiliaryType,
      ),
      auxiliary_id: optionalText(
        firstAuxiliary?.auxiliary_item_id || entry.auxiliaryId,
      ),
      auxiliary_items: auxiliaryItems,
      doc_number: optionalText(entry.docNumber),
      quantity: optionalNumber(entry.quantity),
      unit_price: optionalNumber(entry.unitPrice),
      unit: optionalText(entry.unit),
      currency_id: optionalText(entry.currencyId),
      exchange_rate: optionalNumber(entry.exchangeRate),
      };
    });
}

function templateEntryToDraft(entry) {
  const auxiliarySelections = hydrateAuxiliarySelections(entry);
  const firstAuxiliary = serializeAuxiliarySelections(auxiliarySelections)[0];
  return {
    accountCode: entry.account_code || "",
    accountName: entry.account_name || "",
    direction: entry.direction === "credit" ? "credit" : "debit",
    amount: entry.amount == null ? "" : String(entry.amount),
    summary: entry.summary || "",
    auxiliaryType:
      firstAuxiliary?.auxiliary_category_id || entry.auxiliary_type || "",
    auxiliaryId:
      firstAuxiliary?.auxiliary_item_id || entry.auxiliary_id || "",
    auxiliarySelections,
    docNumber: entry.doc_number || "",
    quantity: entry.quantity == null ? "" : String(entry.quantity),
    unitPrice: entry.unit_price == null ? "" : String(entry.unit_price),
    unit: entry.unit || "",
    currencyId: entry.currency_id || "",
    exchangeRate: entry.exchange_rate == null ? "" : String(entry.exchange_rate),
  };
}

export function applyVoucherTemplateToDraft(draft, templateEntries) {
  const entries = templateEntries.map(templateEntryToDraft);
  const normalizedEntries = [...entries];
  if (normalizedEntries.length === 0)
    normalizedEntries.push(templateEntryToDraft({ direction: "debit" }));
  if (normalizedEntries.length === 1)
    normalizedEntries.push(templateEntryToDraft({ direction: "credit" }));
  return {
    ...draft,
    summary: templateEntries.find((entry) => entry.summary)?.summary || draft.summary,
    entries: normalizedEntries,
  };
}
import {
  hydrateAuxiliarySelections,
  serializeAuxiliarySelections,
} from "./voucherEntryWorkflow.js";
