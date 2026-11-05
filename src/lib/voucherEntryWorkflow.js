function emptyEntry(direction) {
  return {
    accountCode: "",
    accountName: "",
    direction,
    amount: "",
    summary: "",
    auxiliaryType: "",
    auxiliaryId: "",
    auxiliarySelections: {},
    docNumber: "",
    quantity: "",
    unitPrice: "",
    unit: "",
    currencyId: "",
    exchangeRate: "",
  };
}

function normalizedText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function hydrateAuxiliarySelections(entry = {}) {
  const selections = {};
  const auxiliaryItems = Array.isArray(entry.auxiliary_items)
    ? entry.auxiliary_items
    : [];
  auxiliaryItems.forEach((item) => {
    const categoryId = normalizedText(item?.auxiliary_category_id);
    const auxiliaryItemId = normalizedText(item?.auxiliary_item_id);
    if (categoryId && auxiliaryItemId) selections[categoryId] = auxiliaryItemId;
  });

  const legacyCategoryId = normalizedText(entry.auxiliary_type);
  const legacyItemId = normalizedText(entry.auxiliary_id);
  if (
    legacyCategoryId &&
    legacyItemId &&
    !Object.prototype.hasOwnProperty.call(selections, legacyCategoryId)
  ) {
    selections[legacyCategoryId] = legacyItemId;
  }
  return selections;
}

export function serializeAuxiliarySelections(selections = {}) {
  return Object.entries(selections)
    .map(([categoryId, itemId]) => ({
      auxiliary_category_id: normalizedText(categoryId),
      auxiliary_item_id: normalizedText(itemId),
    }))
    .filter(
      (item) => item.auxiliary_category_id && item.auxiliary_item_id,
    )
    .sort((left, right) =>
      left.auxiliary_category_id.localeCompare(
        right.auxiliary_category_id,
        "zh-CN",
      ),
    );
}

export function getMissingRequiredAuxiliaryCategories(
  categories = [],
  selections = {},
) {
  return categories.filter(
    (category) =>
      Number(category?.is_required) === 1 &&
      !normalizedText(selections?.[category.category_id]),
  );
}

export function createNextVoucherDraft(currentDraft, nextVoucherNumber) {
  return {
    ...currentDraft,
    voucherNumber: nextVoucherNumber,
    summary: "",
    attachmentCount: "0",
    entries: [emptyEntry("debit"), emptyEntry("credit")],
  };
}

export function resolveVoucherSubmitIntent(submitterValue) {
  if (submitterValue === "save-and-new") return "new";
  if (submitterValue === "save-and-close") return "close";
  return "stay";
}

const uppercaseDigits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const sectionUnits = ["", "拾", "佰", "仟"];
const groupUnits = ["", "万", "亿", "兆"];

function convertSection(section) {
  const digits = String(section);
  let result = "";
  let pendingZero = false;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[index]);
    const unitIndex = digits.length - index - 1;
    if (digit === 0) {
      if (result) pendingZero = true;
      continue;
    }
    if (pendingZero) result += uppercaseDigits[0];
    result += `${uppercaseDigits[digit]}${sectionUnits[unitIndex]}`;
    pendingZero = false;
  }
  return result;
}

function convertInteger(integer) {
  if (integer === 0) return uppercaseDigits[0];
  const sections = [];
  let remaining = integer;
  while (remaining > 0) {
    sections.unshift(remaining % 10000);
    remaining = Math.floor(remaining / 10000);
  }
  let result = "";
  let zeroSection = false;
  sections.forEach((section, index) => {
    const unitIndex = sections.length - index - 1;
    if (section === 0) {
      if (result) zeroSection = true;
      return;
    }
    if (result && (zeroSection || section < 1000)) result += uppercaseDigits[0];
    result += `${convertSection(section)}${groupUnits[unitIndex]}`;
    zeroSection = false;
  });
  return result;
}

export function toChineseCurrencyUppercase(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "金额无效";
  const cents = Math.round(Math.abs(number) * 100);
  const integer = Math.floor(cents / 100);
  const jiao = Math.floor(cents / 10) % 10;
  const fen = cents % 10;
  let result = `${convertInteger(integer)}元`;
  if (jiao === 0 && fen === 0) result += "整";
  else {
    if (jiao > 0) result += `${uppercaseDigits[jiao]}角`;
    else if (fen > 0) result += uppercaseDigits[0];
    if (fen > 0) result += `${uppercaseDigits[fen]}分`;
  }
  return number < 0 ? `负${result}` : result;
}
