/**
 * Accounting calculation utilities for reports
 */

export interface DateRange {
  startDate: string
  endDate: string
}

export interface AccountBalance {
  code: string
  name: string
  debit: number
  credit: number
  balance: number
  balanceDirection: 'debit' | 'credit'
}

/**
 * Calculate running balance for an account over time
 */
export function calculateRunningBalance(
  entries: Array<{ debit: number; credit: number }>,
  openingBalance: number,
  balanceDirection: 'debit' | 'credit'
): Array<{ balance: number; direction: 'debit' | 'credit' }> {
  let currentBalance = openingBalance

  return entries.map((entry) => {
    const netAmount = entry.debit - entry.credit
    currentBalance = balanceDirection === 'debit'
      ? currentBalance + netAmount
      : currentBalance - netAmount

    return {
      balance: Math.abs(currentBalance),
      direction: currentBalance >= 0 ? balanceDirection : (balanceDirection === 'debit' ? 'credit' : 'debit'),
    }
  })
}

/**
 * Calculate trial balance from account balances
 */
export function calculateTrialBalance(
  accounts: Array<{
    code: string
    name: string
    balance: number
    balanceDirection: 'debit' | 'credit'
  }>
): {
  totalDebit: number
  totalCredit: number
  entries: Array<{
    code: string
    name: string
    debitBalance: number
    creditBalance: number
  }>
  isBalanced: boolean
} {
  let totalDebit = 0
  let totalCredit = 0

  const entries = accounts.map((account) => {
    if (account.balanceDirection === 'debit') {
      totalDebit += account.balance
      return {
        code: account.code,
        name: account.name,
        debitBalance: account.balance,
        creditBalance: 0,
      }
    } else {
      totalCredit += account.balance
      return {
        code: account.code,
        name: account.name,
        debitBalance: 0,
        creditBalance: account.balance,
      }
    }
  })

  return {
    totalDebit,
    totalCredit,
    entries,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

/**
 * Calculate financial statement ratios
 */
export function calculateFinancialRatios(balanceSheet: {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}): {
  debtRatio: number
  equityRatio: number
  debtToEquity: number
} {
  const { totalAssets, totalLiabilities, totalEquity } = balanceSheet

  return {
    debtRatio: totalAssets > 0 ? totalLiabilities / totalAssets : 0,
    equityRatio: totalAssets > 0 ? totalEquity / totalAssets : 0,
    debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
  }
}

/**
 * Format currency for accounting display with debit/credit indication
 */
export function formatAccountingCurrency(
  amount: number,
  direction: 'debit' | 'credit' | 'balance',
  options?: { showSign?: boolean; showDirection?: boolean }
): string {
  const { showSign = false, showDirection = false } = options || {}

  const absAmount = Math.abs(amount)
  const formatted = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount)

  if (showDirection) {
    const directionLabel = direction === 'credit' ? '贷' : '借'
    if (direction === 'balance') {
      return `${formatted}`
    }
    return `${formatted} ${directionLabel}`
  }

  if (showSign && amount < 0) {
    return `( ${formatted} )`
  }

  return formatted
}

/**
 * Filter entries by date range
 */
export function filterByDateRange<T extends { date: string }>(
  entries: T[],
  dateRange: DateRange
): T[] {
  const { startDate, endDate } = dateRange

  return entries.filter((entry) => {
    const entryDate = entry.date
    return entryDate >= startDate && entryDate <= endDate
  })
}

/**
 * Calculate net amount from debit and credit
 */
export function calculateNetAmount(debit: number, credit: number): number {
  return debit - credit
}

/**
 * Determine balance direction based on net amount and original direction
 */
export function determineBalanceDirection(
  netAmount: number,
  originalDirection: 'debit' | 'credit'
): 'debit' | 'credit' {
  if (netAmount === 0) return originalDirection
  return netAmount > 0 ? originalDirection : (originalDirection === 'debit' ? 'credit' : 'debit')
}

/**
 * Format date for Chinese accounting reports
 */
export function formatChineseDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Get period string from date
 */
export function getPeriodString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}年${d.getMonth() + 1}期`
}

/**
 * Compare account codes for sorting
 */
export function compareAccountCodes(code1: string, code2: string): number {
  return code1.localeCompare(code2, undefined, { numeric: true })
}

/**
 * Calculate percentage of total
 */
export function calculatePercentageOfTotal(amount: number, total: number): number {
  if (total === 0) return 0
  return (amount / total) * 100
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}