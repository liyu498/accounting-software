const amountOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

function postedVouchers(vouchers, periodId) {
  return vouchers.filter((voucher) => (
    voucher.period_id === periodId
    && Number(voucher.is_deleted || 0) !== 1
    && ['approved', 'reversed'].includes(String(voucher.status || '').toLowerCase())
  ))
}

function aggregateAccounts(vouchers, periodId) {
  const accounts = new Map()
  for (const voucher of postedVouchers(vouchers, periodId)) {
    for (const entry of voucher.entries || []) {
      const code = String(entry.account_code || '').trim()
      if (!code) continue
      const current = accounts.get(code) || {
        account_code: code,
        account_name: String(entry.account_name || code),
        debit: 0,
        credit: 0,
      }
      if (String(entry.direction || '').toLowerCase() === 'credit') current.credit += amountOf(entry.amount)
      else current.debit += amountOf(entry.amount)
      accounts.set(code, current)
    }
  }
  return [...accounts.values()].sort((left, right) => left.account_code.localeCompare(right.account_code))
}

function accountType(code) {
  if (code.startsWith('1')) return 'asset'
  if (code.startsWith('2')) return 'liability'
  if (code.startsWith('3')) return 'equity'
  if (code.startsWith('4')) return 'cost'
  if (code.startsWith('5')) return 'expense'
  return 'income'
}

export function buildBrowserPreviewTrialBalance(vouchers = [], periodId = '') {
  const accounts = aggregateAccounts(vouchers, periodId)
  const items = accounts.map((account) => {
    const net = account.debit - account.credit
    return {
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: accountType(account.account_code),
      account_level: 1,
      is_detail: true,
      opening_debit: 0,
      opening_credit: 0,
      period_debit: account.debit,
      period_credit: account.credit,
      cumulative_debit: account.debit,
      cumulative_credit: account.credit,
      closing_debit: Math.max(net, 0),
      closing_credit: Math.max(-net, 0),
    }
  })
  const totalDebit = items.reduce((sum, item) => sum + item.period_debit, 0)
  const totalCredit = items.reduce((sum, item) => sum + item.period_credit, 0)
  const closingDebit = items.reduce((sum, item) => sum + item.closing_debit, 0)
  const closingCredit = items.reduce((sum, item) => sum + item.closing_credit, 0)
  return {
    items,
    total_opening_debit: 0,
    total_opening_credit: 0,
    total_period_debit: totalDebit,
    total_period_credit: totalCredit,
    total_cumulative_debit: totalDebit,
    total_cumulative_credit: totalCredit,
    total_closing_debit: closingDebit,
    total_closing_credit: closingCredit,
    is_balanced: Math.abs(totalDebit - totalCredit) < 0.005,
  }
}

export function buildBrowserPreviewBalanceSheet(vouchers = [], periodId = '') {
  const trial = buildBrowserPreviewTrialBalance(vouchers, periodId)
  const items = trial.items
    .filter((item) => item.closing_debit > 0 || item.closing_credit > 0)
    .map((item) => {
      const liability = item.account_code.startsWith('2')
      const debitBalance = item.closing_debit > 0
      return {
        item_code: item.account_code,
        item_name: item.account_name,
        item_level: 1,
        is_total: 0,
        opening_balance: 0,
        ending_balance: debitBalance ? item.closing_debit : item.closing_credit,
        section: debitBalance ? 'asset' : liability ? 'liability' : 'equity',
        children: [],
      }
    })
  const totalAssets = items
    .filter((item) => item.section === 'asset')
    .reduce((sum, item) => sum + item.ending_balance, 0)
  const totalLiabilities = items
    .filter((item) => item.section === 'liability')
    .reduce((sum, item) => sum + item.ending_balance, 0)
  const totalEquity = items
    .filter((item) => item.section === 'equity')
    .reduce((sum, item) => sum + item.ending_balance, 0)

  return {
    period_id: periodId,
    items,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    opening_total_assets: 0,
    opening_total_liabilities: 0,
    opening_total_equity: 0,
    is_balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.005,
  }
}
