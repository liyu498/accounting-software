const MODES = new Set(['receivable', 'payable'])

function assertMode(mode) {
  if (!MODES.has(mode)) throw new Error('往来报表类型无效。')
}

function roundAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function rate(settledAmount, totalAmount) {
  return totalAmount > 0 ? roundAmount((settledAmount / totalAmount) * 100) : 0
}

function recordsForMode(records, mode) {
  assertMode(mode)
  return records.filter((record) => record?.settlementType === mode)
}

export function buildCounterpartyDetail(records, mode) {
  return recordsForMode(records, mode)
    .map((record) => ({ ...record }))
    .sort((left, right) =>
      String(right.settlementDate).localeCompare(String(left.settlementDate)) ||
      String(right.settlementNo).localeCompare(String(left.settlementNo)),
    )
}

export function buildCounterpartySummary(records, mode) {
  const grouped = new Map()
  for (const record of recordsForMode(records, mode)) {
    const counterparty = String(record.counterparty || '').trim() || '未指定往来单位'
    const row = grouped.get(counterparty) || {
      counterparty,
      documentCount: 0,
      totalAmount: 0,
      settledAmount: 0,
      balanceAmount: 0,
      latestDate: '',
      owners: new Set(),
      openDocumentCount: 0,
    }
    row.documentCount += 1
    row.totalAmount += Number(record.totalAmount) || 0
    row.settledAmount += Number(record.settledAmount) || 0
    row.balanceAmount += Number(record.balanceAmount) || 0
    if (Number(record.balanceAmount) > 0) row.openDocumentCount += 1
    if (record.owner) row.owners.add(record.owner)
    if (String(record.settlementDate) > row.latestDate) row.latestDate = String(record.settlementDate)
    grouped.set(counterparty, row)
  }

  return [...grouped.values()]
    .map((row) => ({
      counterparty: row.counterparty,
      documentCount: row.documentCount,
      totalAmount: roundAmount(row.totalAmount),
      settledAmount: roundAmount(row.settledAmount),
      balanceAmount: roundAmount(row.balanceAmount),
      settlementRate: rate(row.settledAmount, row.totalAmount),
      latestDate: row.latestDate,
      owner: row.owners.size === 0 ? '-' : row.owners.size === 1 ? [...row.owners][0] : '多人',
      openDocumentCount: row.openDocumentCount,
    }))
    .sort((left, right) => right.balanceAmount - left.balanceAmount || left.counterparty.localeCompare(right.counterparty, 'zh-CN'))
}

export function summarizeCounterpartyReport(records, mode) {
  const scoped = recordsForMode(records, mode)
  const totalAmount = roundAmount(scoped.reduce((sum, record) => sum + (Number(record.totalAmount) || 0), 0))
  const settledAmount = roundAmount(scoped.reduce((sum, record) => sum + (Number(record.settledAmount) || 0), 0))
  const balanceAmount = roundAmount(scoped.reduce((sum, record) => sum + (Number(record.balanceAmount) || 0), 0))
  return {
    counterpartyCount: new Set(scoped.map((record) => String(record.counterparty || '').trim() || '未指定往来单位')).size,
    documentCount: scoped.length,
    totalAmount,
    settledAmount,
    balanceAmount,
    settlementRate: rate(settledAmount, totalAmount),
  }
}
