export function buildFilterValues(values, activeValue = '') {
  const options = new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )
  const normalizedActiveValue = String(activeValue ?? '').trim()
  if (normalizedActiveValue) options.add(normalizedActiveValue)
  return [...options].sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
}
