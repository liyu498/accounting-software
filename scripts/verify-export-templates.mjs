import { readFileSync } from 'node:fs'

const taxSource = readFileSync('src/pages/tax/TaxWorkspace.tsx', 'utf8')
const agencySource = readFileSync('src/pages/agency/AgencyModulePage.tsx', 'utf8')
const operationalExportSource = readFileSync('src/components/operations/OperationalExportActions.tsx', 'utf8')
const xlsxSource = readFileSync('src/lib/xlsxExport.ts', 'utf8')
const pdfSource = readFileSync('src/lib/pdfExport.ts', 'utf8')

const routedOperationalSources = [
  'src/pages/operations/InputInvoiceWorkspace.tsx',
  'src/pages/operations/OutputInvoiceWorkspace.tsx',
  'src/pages/operations/BankStatementWorkspace.tsx',
  'src/pages/operations/VoucherWorkspace.tsx',
  'src/pages/operations/LedgerReportWorkspace.tsx',
  'src/pages/operations/FinancialStatementWorkspace.tsx',
  'src/pages/tax/TaxReportWorkspace.tsx',
].map((file) => [file, readFileSync(file, 'utf8')])

const dedicatedAccountingExportFiles = new Set([
  'src/pages/operations/LedgerReportWorkspace.tsx',
  'src/pages/operations/FinancialStatementWorkspace.tsx',
])

const requiredOperationalExportSnippets = [
  ['routed table discovery', "closest('[data-operational-export-root]')"],
  ['xlsx export', 'exportRowsToXlsx'],
  ['PDF export', 'exportHtmlToPdf'],
  ['sanitized print document', 'sanitizePrintableHtml'],
  ['Excel failure feedback', 'Excel 导出或下载中心登记失败：'],
  ['PDF failure feedback', 'PDF 导出或下载中心登记失败：'],
  ['print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
]

const requiredTaxSnippets = [
  ['tax print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
  ['tax PDF failure feedback', 'PDF 导出或下载中心登记失败：'],
  ['tax PDF failure audit', "action: '导出申报包 PDF'"],
  ['tax PDF failure result', "result: '失败'"],
  ['tax PDF failure attachment', 'attachment: String(error)'],
]

const requiredAgencySnippets = [
  ['agency print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
  ['agency repeating table headers', 'thead { display: table-header-group; }'],
  ['agency row pagination guard', 'tr { break-inside: avoid; page-break-inside: avoid; }'],
  ['agency PDF failure feedback', 'PDF 导出或下载中心登记失败：'],
  ['agency PDF failure audit', "writeAgencyAudit('导出PDF登记失败', fileName, '普通', '失败')"],
  ['agency Excel failure feedback', 'Excel 导出或下载中心登记失败：'],
  ['agency Excel failure audit', "writeAgencyAudit('导出Excel登记失败', fileName, '普通', '失败')"],
]

const requiredXlsxSnippets = [
  ['xlsx reusable workbook model', 'export function buildXlsxSheetData'],
  ['xlsx zero-value preservation', "row[columnIndex] ?? ''"],
  ['xlsx numeric cell types', "type: typeof value === 'number' ? Number : String"],
  ['xlsx merged-cell placeholders', 'if (isMergedCovered(merges, rowIndex, columnIndex)) return null'],
  ['xlsx span merge support', 'columnSpan: merge ? merge.e.c - merge.s.c + 1 : undefined'],
  ['xlsx header style', "backgroundColor: titleRow ? '#DDEBFA' : headerRow ? '#E8EEF6'"],
  ['xlsx table-only borders', "borderStyle: tableRow ? 'thin' : undefined"],
  ['xlsx print orientation', "orientation: orientation === 'landscape' ? 'landscape' : undefined"],
  ['xlsx frozen accounting header support', 'stickyRowsCount'],
  ['xlsx gridline control', 'showGridLines'],
  ['xlsx chinese font', "fontFamily: 'Noto Sans SC'"],
  ['xlsx note rows', "['制表说明', '边界说明', '本页小计']"],
]

const requiredPdfSnippets = [
  ['pdf chinese font stack', 'Noto Sans SC'],
  ['pdf font readiness', 'waitForChineseFonts'],
  ['pdf landscape template detection', 'function isLandscapeDocument'],
  ['pdf landscape orientation', "orientation: isLandscape ? 'l' : 'p'"],
  ['pdf landscape render width', "const renderWidth = isLandscape ? 1500 : 1120"],
  ['pdf a4 pagination', "new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'mm', format: 'a4'"],
  ['pdf page slicing', 'sliceHeightPx'],
  ['pdf page number', 'pdf.text(`${pageIndex + 1}`'],
]

function check(source, checks) {
  return checks
    .filter(([, snippet]) => !source.includes(snippet))
    .map(([label, snippet]) => `${label} missing snippet: ${snippet}`)
}

const errors = [
  ...check(operationalExportSource, requiredOperationalExportSnippets),
  ...routedOperationalSources.flatMap(([file, source]) => {
    const expectedComponent = dedicatedAccountingExportFiles.has(file)
      ? '<AccountingReportExportActions'
      : '<OperationalExportActions'
    return source.includes(expectedComponent)
      ? []
      : [`${file} does not render ${expectedComponent.slice(1)}`]
  }),
  ...check(taxSource, requiredTaxSnippets),
  ...check(agencySource, requiredAgencySnippets),
  ...check(xlsxSource, requiredXlsxSnippets),
  ...check(pdfSource, requiredPdfSnippets),
]

if (errors.length > 0) {
  console.error('Export template verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Export template verification passed:')
console.log(JSON.stringify({
  routedOperationalWorkspaces: routedOperationalSources.map(([file]) => file),
  fixedTemplates: ['operational-list', 'tax-package', 'agency-list'],
  xlsxFeatures: ['merged title/note rows', 'numeric accounting cells', 'zero-value preservation', 'header styling', 'table-only borders', 'print orientation', 'frozen headers', 'gridline control', 'Chinese font'],
  pdfFeatures: ['Chinese font readiness', 'A4 pagination', 'page numbers'],
}, null, 2))
