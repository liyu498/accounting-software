export type AccountingReportKind = 'statutory_statement' | 'management_statement' | 'ledger'
export type AccountingReportLayout = 'standard_table' | 'balance_sheet_dual' | 'equity_change_matrix' | 'income_activity_matrix'
export type AccountingExportCell = string | number
export interface AccountingSheetMerge {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

export interface AccountingHeaderGroup {
  label: string
  startColumn: number
  endColumn: number
}

export interface BalanceSheetExportLine {
  section: string
  name: string
  lineNumber: string
  closingBalance: number
  openingBalance: number
}

export interface AccountingReportExportInput {
  title: string
  companyName?: string
  periodLabel?: string
  accountingStandard?: string
  formCode?: string | null
  unit?: string
  generatedAt: string
  reportKind: AccountingReportKind
  layout?: AccountingReportLayout
  headers: string[]
  headerGroups?: AccountingHeaderGroup[]
  rows: Array<Array<string | number | null | undefined>>
}

export interface AccountingReportExportModel {
  title: string
  companyName: string
  periodLabel: string
  accountingStandard: string
  formCode: string
  unit: string
  generatedAt: string
  reportKind: AccountingReportKind
  layout: AccountingReportLayout
  orientation: 'portrait' | 'landscape'
  pageSize: 'A4' | 'A3'
  amountColumnIndexes: number[]
  headers: string[]
  headerGroups: AccountingHeaderGroup[]
  rows: string[][]
  sheetRows: AccountingExportCell[][]
  xlsxMerges: AccountingSheetMerge[]
}

function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function spreadsheetCell(value: unknown): AccountingExportCell {
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  const normalized = normalizeText(value)
  const currency = normalized.match(/^([+-]?)\s*[¥￥]\s*(\d[\d,]*(?:\.\d+)?)$/)
  if (!currency) return normalized
  const amount = Number(currency[2].replace(/,/g, ''))
  return Number.isFinite(amount) ? (currency[1] === '-' ? -amount : amount) : normalized
}

export function buildBalanceSheetDualTable(
  lines: BalanceSheetExportLine[],
  rightHeader = '负债和所有者权益',
) {
  const assets = lines.filter((line) => /(^|_)asset|资产/i.test(line.section))
  const liabilitiesAndEquity = lines.filter(
    (line) => !/(^|_)asset|资产/i.test(line.section),
  )
  const rowCount = Math.max(assets.length, liabilitiesAndEquity.length)
  const rows: Array<Array<string | number>> = []
  for (let index = 0; index < rowCount; index += 1) {
    const asset = assets[index]
    const right = liabilitiesAndEquity[index]
    rows.push([
      asset?.name || '',
      asset?.lineNumber || '',
      asset?.closingBalance ?? '',
      asset?.openingBalance ?? '',
      right?.name || '',
      right?.lineNumber || '',
      right?.closingBalance ?? '',
      right?.openingBalance ?? '',
    ])
  }
  return {
    headers: ['资产', '行次', '期末余额', '年初余额', rightHeader, '行次', '期末余额', '年初余额'],
    rows,
  }
}

export function createAccountingReportExportModel(
  input: AccountingReportExportInput,
): AccountingReportExportModel {
  const title = normalizeText(input.title) || '会计报表'
  const companyName = normalizeText(input.companyName) || '当前账套'
  const periodLabel = normalizeText(input.periodLabel) || '当前期间'
  const accountingStandard = normalizeText(input.accountingStandard) || '未标注会计准则'
  const formCode = normalizeText(input.formCode)
  const unit = normalizeText(input.unit) || '元'
  const generatedAt = normalizeText(input.generatedAt)
  const layout = input.layout || 'standard_table'
  const headers = input.headers.map(normalizeText)
  const headerGroups = (input.headerGroups || [])
    .map((group) => ({
      label: normalizeText(group.label),
      startColumn: Math.max(0, Math.trunc(group.startColumn)),
      endColumn: Math.min(headers.length - 1, Math.trunc(group.endColumn)),
    }))
    .filter((group) => group.label && group.startColumn <= group.endColumn)
  const rows = input.rows.map((row) => row.map(normalizeText))
  const dataRows = input.rows.map((row) => row.map(spreadsheetCell))
  const columnCount = Math.max(headers.length, 1)
  const lastColumn = columnCount - 1
  const middleColumn = Math.floor(columnCount / 2)
  const identity = formCode || (input.reportKind === 'management_statement' ? '内部管理报表' : '')
  const identityRow = Array<AccountingExportCell>(columnCount).fill('')
  identityRow[lastColumn] = identity
  const metadataRow = Array<AccountingExportCell>(columnCount).fill('')
  metadataRow[0] = `编制单位：${companyName}`
  metadataRow[middleColumn] = `所属期间：${periodLabel}`
  metadataRow[lastColumn] = `单位：${unit}`
  const signatureRow = Array<AccountingExportCell>(columnCount).fill('')
  signatureRow[0] = '制表人：'
  signatureRow[middleColumn] = '复核人：'
  signatureRow[lastColumn] = '负责人：'
  const generatedRow = Array<AccountingExportCell>(columnCount).fill('')
  generatedRow[lastColumn] = `导出时间：${generatedAt}`
  const xlsxMerges: AccountingSheetMerge[] = lastColumn > 0
    ? [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: lastColumn } },
      ]
    : []
  const groupHeaderRow = Array<AccountingExportCell>(columnCount).fill('')
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const group = headerGroups.find((candidate) => candidate.startColumn === columnIndex)
    const covered = headerGroups.some(
      (candidate) => columnIndex > candidate.startColumn && columnIndex <= candidate.endColumn,
    )
    groupHeaderRow[columnIndex] = group?.label || (covered ? '' : headers[columnIndex] || '')
  }
  for (const group of headerGroups) {
    if (group.endColumn > group.startColumn) {
      xlsxMerges.push({
        s: { r: 5, c: group.startColumn },
        e: { r: 5, c: group.endColumn },
      })
    }
  }

  return {
    title,
    companyName,
    periodLabel,
    accountingStandard,
    formCode,
    unit,
    generatedAt,
    reportKind: input.reportKind,
    layout,
    orientation: input.reportKind === 'ledger' || layout === 'balance_sheet_dual' || layout === 'equity_change_matrix' || layout === 'income_activity_matrix'
      ? 'landscape'
      : 'portrait',
    pageSize: layout === 'equity_change_matrix' && headerGroups.length > 0 ? 'A3' : 'A4',
    amountColumnIndexes: layout === 'equity_change_matrix' || layout === 'income_activity_matrix'
      ? headers.map((_, index) => index).filter((index) => index >= 2)
      : headers
          .map((header, index) => (/金额|余额|借方|贷方/.test(header) ? index : -1))
          .filter((index) => index >= 0),
    headers,
    headerGroups,
    rows,
    sheetRows: [
      [title],
      identityRow,
      metadataRow,
      [`会计准则：${accountingStandard}`],
      [],
      ...(headerGroups.length > 0 ? [groupHeaderRow] : []),
      headers,
      ...dataRows,
      [],
      signatureRow,
      generatedRow,
    ],
    xlsxMerges,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildAccountingReportPrintHtml(model: AccountingReportExportModel) {
  const groupedColumns = new Set(
    model.headerGroups.flatMap((group) =>
      Array.from({ length: group.endColumn - group.startColumn + 1 }, (_, index) => group.startColumn + index),
    ),
  )
  const groupHeaderHtml = model.headerGroups.length > 0
    ? `<tr>${model.headers.map((header, index) => {
        const group = model.headerGroups.find((candidate) => candidate.startColumn === index)
        if (group) return `<th colspan="${group.endColumn - group.startColumn + 1}">${escapeHtml(group.label)}</th>`
        if (groupedColumns.has(index)) return ''
        return `<th rowspan="2">${escapeHtml(header)}</th>`
      }).join('')}</tr>`
    : ''
  const headerHtml = model.headers
    .map((header, index) => model.headerGroups.length > 0 && !groupedColumns.has(index) ? '' : `<th>${escapeHtml(header)}</th>`)
    .join('')
  const bodyHtml = model.rows
    .map((row) => `<tr>${row.map((value, index) => `<td class="${model.amountColumnIndexes.includes(index) ? 'amount' : ''}">${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')
  const identity = model.formCode || (model.reportKind === 'management_statement' ? '内部管理报表' : '')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title><style>@page{size:${model.pageSize} ${model.orientation};margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;font-size:10px}.heading{position:relative;min-height:34px}.heading h1{margin:0;text-align:center;font-size:19px;font-weight:700}.form-code{position:absolute;right:0;top:3px;font-size:10px}.meta{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:12px;margin:7px 0 6px}.meta span:nth-child(2){text-align:center}.meta span:last-child{text-align:right}.standard{margin-bottom:6px;text-align:center;color:#334155}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #475569;padding:5px 6px;vertical-align:middle;word-break:break-word}th{background:#f1f5f9;text-align:center;font-weight:700}.amount{text-align:right;font-variant-numeric:tabular-nums}.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:12px}.signatures span:nth-child(2){text-align:center}.signatures span:last-child{text-align:right}.exported{margin-top:6px;text-align:right;color:#64748b;font-size:9px}</style></head><body><div class="heading"><h1>${escapeHtml(model.title)}</h1><span class="form-code">${escapeHtml(identity)}</span></div><div class="meta"><span>编制单位：${escapeHtml(model.companyName)}</span><span>所属期间：${escapeHtml(model.periodLabel)}</span><span>单位：${escapeHtml(model.unit)}</span></div><div class="standard">会计准则：${escapeHtml(model.accountingStandard)}</div><table><thead>${groupHeaderHtml}<tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table><div class="signatures"><span>制表人：</span><span>复核人：</span><span>负责人：</span></div><div class="exported">导出时间：${escapeHtml(model.generatedAt)}</div></body></html>`
}

export function accountingReportFileBase(title: string, periodLabel?: string) {
  const safe = (value: string) => normalizeText(value).replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/g, '')
  return [safe(title) || '会计报表', safe(periodLabel || '')].filter(Boolean).join('-')
}
