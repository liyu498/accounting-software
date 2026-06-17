export function shouldResetSubsidiaryLedgerFilter(previousContextKey: string | null, currentContextKey: string | null) {
  return previousContextKey !== null && previousContextKey !== currentContextKey
}
