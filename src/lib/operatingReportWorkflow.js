function round(value, precision = 2) {
  const scale = 10 ** precision
  return Math.round((Number(value || 0) + Number.EPSILON) * scale) / scale
}

function percent(value, base) {
  return Number(base) === 0 ? 0 : round((Number(value) / Number(base)) * 100)
}

function flatten(items = []) {
  return items.flatMap((item) => [item, ...flatten(item.children || [])])
}

function byCode(items = []) {
  return new Map(flatten(items).map((item) => [item.item_code, item]))
}

function amount(item, key) {
  return round(Number(item?.[key]) || 0)
}

function findByName(items, patterns) {
  return items.find((item) => patterns.some((pattern) => pattern.test(String(item.item_name || ''))))
}

const performanceRowPattern = /(营业收入|经营收入|收入合计|营业成本|经营支出|业务活动成本|税金及附加|销售费用|管理费用|研发费用|财务费用|利息费用|利息收入|其他收益|投资收益|公允价值变动收益|信用减值损失|资产减值损失|资产处置收益|营业利润|经营收益|营业外收入|其他收入|营业外支出|其他支出|利润总额|盈余总额|所得税费用|净利润|本年盈余|净资产变动额|综合收益总额)/

export function buildOperatingStatus(balanceSheet) {
  const items = byCode(balanceSheet?.items)
  const totalAssets = round(balanceSheet?.total_assets)
  const totalLiabilities = round(balanceSheet?.total_liabilities)
  const totalEquity = round(balanceSheet?.total_equity)
  const currentAssets = amount(items.get('BS199'), 'ending_balance')
  const currentLiabilities = amount(items.get('BS399'), 'ending_balance')
  const selectedCodes = ['BS101', 'BS103', 'BS105', 'BS199', 'BS202', 'BS999', 'BS303', 'BS399', 'BS599', 'BS699']
  const rows = selectedCodes
    .map((code) => items.get(code))
    .filter(Boolean)
    .map((item) => {
      const opening = amount(item, 'opening_balance')
      const ending = amount(item, 'ending_balance')
      return {
        code: item.item_code,
        name: item.item_name,
        opening,
        ending,
        change: round(ending - opening),
        share: percent(ending, totalAssets),
        kind: item.item_code.startsWith('BS1') || item.item_code.startsWith('BS2') ? '资产' : item.item_code.startsWith('BS3') || item.item_code.startsWith('BS4') || item.item_code === 'BS599' ? '负债' : '权益',
      }
    })
  return {
    metrics: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      workingCapital: round(currentAssets - currentLiabilities),
      currentRatio: currentLiabilities > 0 ? round(currentAssets / currentLiabilities) : 0,
      debtRatio: percent(totalLiabilities, totalAssets),
      assetGrowth: percent(totalAssets - Number(balanceSheet?.opening_total_assets || 0), Number(balanceSheet?.opening_total_assets || 0)),
      balanced: Boolean(balanceSheet?.is_balanced),
    },
    rows,
  }
}

export function buildOperatingPerformance(incomeStatement) {
  const items = flatten(incomeStatement?.items || [])
  const revenue = amount(findByName(items, [/营业收入$/, /经营收入$/, /收入合计$/]), 'current_amount')
  const cost = amount(findByName(items, [/营业成本$/, /经营支出$/, /业务活动成本$/]), 'current_amount')
  const operatingProfit = amount(findByName(items, [/营业利润$/, /经营收益$/]), 'current_amount')
  const primaryProfitItem = findByName(items, [/净利润/, /本年盈余/, /净资产变动额/])
  const statementTotal = Number(incomeStatement?.current_period_total)
  const netProfit = Number.isFinite(statementTotal)
    ? round(statementTotal)
    : amount(primaryProfitItem, 'current_amount')
  const rows = items
    .filter((item) => performanceRowPattern.test(String(item.item_name || '')))
    .map((item) => {
      const current = amount(item, 'current_amount')
      return {
        code: item.item_code,
        name: item.item_name,
        current,
        yearToDate: amount(item, 'year_to_date'),
        share: percent(Math.abs(current), Math.abs(revenue)),
        total: Number(item.is_total) === 1,
      }
    })
  return {
    metrics: {
      revenue,
      cost,
      grossProfit: round(revenue - cost),
      grossMargin: percent(revenue - cost, revenue),
      operatingProfit,
      operatingMargin: percent(operatingProfit, revenue),
      netProfit,
      netMargin: percent(netProfit, revenue),
      yearToDateProfit: Number.isFinite(Number(incomeStatement?.year_to_date_total))
        ? round(incomeStatement?.year_to_date_total)
        : amount(primaryProfitItem, 'year_to_date'),
    },
    rows,
  }
}
