function splitApplicableModules(value) {
  return String(value || "")
    .split(/[、,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSelectableVoucherTags(tags, selectedTagIds = []) {
  const selected = new Set(selectedTagIds);
  return tags.filter(
    (tag) =>
      splitApplicableModules(tag.applicable_modules).includes("凭证") &&
      (tag.is_enabled === 1 || selected.has(tag.id)),
  );
}

export function toggleVoucherTagId(selectedTagIds, tagId) {
  return selectedTagIds.includes(tagId)
    ? selectedTagIds.filter((id) => id !== tagId)
    : [...selectedTagIds, tagId];
}
