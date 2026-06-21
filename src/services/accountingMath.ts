export function normalizeAmount(value: number) {
  return Math.round(Number(value || 0) * 100)
}
