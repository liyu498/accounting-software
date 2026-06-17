export function resetFinancialPageState<T>(emptyData: T, error: unknown, fallbackMessage: string) {
  return {
    data: emptyData,
    errorMessage: error instanceof Error ? error.message : fallbackMessage,
  }
}
