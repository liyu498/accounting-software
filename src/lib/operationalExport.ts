export interface OperationalExportInput {
  title: string
  companyName?: string
  periodLabel?: string
  generatedAt: string
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
}

export type OperationalExportCell = string | number

export interface OperationalExportModel {
  title: string
  companyName: string
  periodLabel: string
  generatedAt: string
  headers: string[]
  rows: string[][]
  sheetRows: OperationalExportCell[][]
}

function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function spreadsheetCell(value: unknown): OperationalExportCell {
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  const normalized = normalizeText(value)
  const currency = normalized.match(/^([+-]?)\s*[¥￥]\s*(\d[\d,]*(?:\.\d+)?)$/)
  if (!currency) return normalized
  const amount = Number(currency[2].replace(/,/g, ''))
  return Number.isFinite(amount) ? (currency[1] === '-' ? -amount : amount) : normalized
}

function isControlColumn(header: string) {
  const normalized = normalizeText(header)
  return !normalized || ['操作', '选择', '勾选'].includes(normalized)
}

export function createOperationalExportModel(input: OperationalExportInput): OperationalExportModel {
  const retainedIndexes = input.headers
    .map((header, index) => ({ header: normalizeText(header), index }))
    .filter(({ header }) => !isControlColumn(header))

  const headers = retainedIndexes.map(({ header }) => header)
  const rows = input.rows.map((row) => retainedIndexes.map(({ index }) => normalizeText(row[index])))
  const sheetDataRows = input.rows.map((row) => retainedIndexes.map(({ index }) => spreadsheetCell(row[index])))
  const title = normalizeText(input.title) || '业务清单'
  const companyName = normalizeText(input.companyName) || '当前账套'
  const periodLabel = normalizeText(input.periodLabel) || '当前期间'
  const generatedAt = normalizeText(input.generatedAt)

  return {
    title,
    companyName,
    periodLabel,
    generatedAt,
    headers,
    rows,
    sheetRows: [
      [title],
      ['编制单位', companyName, '所属期间', periodLabel, '导出时间', generatedAt],
      [],
      headers,
      ...sheetDataRows,
      ['制表说明', `按当前页面筛选范围导出，共 ${rows.length} 条记录。`],
    ],
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

export function buildOperationalPrintHtml(model: OperationalExportModel) {
  const headerHtml = model.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')
  const bodyHtml = model.rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111827;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;font-size:11px}h1{margin:0 0 6px;text-align:center;font-size:18px}.meta{display:flex;justify-content:space-between;gap:16px;margin-bottom:10px;color:#475569}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #94a3b8;padding:6px;vertical-align:top;word-break:break-word}th{background:#e8eef6;font-weight:700}.note{margin-top:8px;color:#64748b}</style></head><body><h1>${escapeHtml(model.title)}</h1><div class="meta"><span>编制单位：${escapeHtml(model.companyName)}</span><span>所属期间：${escapeHtml(model.periodLabel)}</span><span>导出时间：${escapeHtml(model.generatedAt)}</span></div><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table><div class="note">按当前页面筛选范围输出，共 ${model.rows.length} 条记录。</div></body></html>`
}

export function operationalExportFileBase(title: string, periodLabel?: string) {
  const safeTitle = normalizeText(title).replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/g, '') || '业务清单'
  const safePeriod = normalizeText(periodLabel).replace(/[\\/:*?"<>|]/g, '-')
  return safePeriod ? `${safeTitle}-${safePeriod}` : safeTitle
}
