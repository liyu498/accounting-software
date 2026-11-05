export const WORKSPACE_SELECTION_KEY = 'accounting-workspace-selection-v1'

function browserStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function normalizeSelection(value) {
  if (!value || typeof value !== 'object') {
    return { companyId: null, periodId: null }
  }
  return {
    companyId: typeof value.companyId === 'string' && value.companyId ? value.companyId : null,
    periodId: typeof value.periodId === 'string' && value.periodId ? value.periodId : null,
  }
}

export function loadWorkspaceSelection(storage = browserStorage()) {
  if (!storage) return { companyId: null, periodId: null }
  try {
    return normalizeSelection(JSON.parse(storage.getItem(WORKSPACE_SELECTION_KEY) || 'null'))
  } catch {
    return { companyId: null, periodId: null }
  }
}

function saveWorkspaceSelection(next, storage = browserStorage()) {
  if (!storage) return
  const current = loadWorkspaceSelection(storage)
  storage.setItem(WORKSPACE_SELECTION_KEY, JSON.stringify({ ...current, ...next }))
}

export function saveSelectedCompanyId(companyId, storage) {
  saveWorkspaceSelection({ companyId: companyId || null }, storage)
}

export function saveSelectedPeriodId(periodId, storage) {
  saveWorkspaceSelection({ periodId: periodId || null }, storage)
}
