import { readFileSync } from 'node:fs'

const businessSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')
const taxSource = readFileSync('src/pages/tax/TaxWorkspace.tsx', 'utf8')
const agencySource = readFileSync('src/pages/agency/AgencyModulePage.tsx', 'utf8')
const xlsxSource = readFileSync('src/lib/xlsxExport.ts', 'utf8')
const pdfSource = readFileSync('src/lib/pdfExport.ts', 'utf8')

const requiredBusinessSnippets = [
  ['voucher print template', 'function renderVoucherPrintHtml'],
  ['voucher detail print template', 'function renderVoucherDetailPrintHtml'],
  ['voucher detail entries', 'voucher.entries.map((entry) =>'],
  ['voucher detail print action', 'label="打印凭证" onClick={handlePrint}'],
  ['voucher excel template', 'function buildVoucherExcelTemplate'],
  ['voucher fields', "'凭证日期', '凭证字号', '摘要', '借方科目', '贷方科目', '借方金额', '贷方金额'"],
  ['ledger print template', 'function renderLedgerPrintHtml'],
  ['ledger excel template', 'function buildLedgerExcelTemplate'],
  ['ledger subtotal', '本页小计'],
  ['financial print template', 'function renderFinancialPrintHtml'],
  ['financial excel template', 'function buildFinancialExcelTemplate'],
  ['financial fields', "'行次', '报表项目', '取数公式/科目', '期初余额/本月数', '期末余额/本年累计'"],
  ['tax print template', 'function renderTaxPrintHtml'],
  ['tax excel template', 'function buildTaxExcelTemplate'],
  ['tax boundary notice', '不代表已向电子税务局提交'],
  ['generic export template', 'function buildGenericExcelTemplate'],
  ['template router', 'function buildExcelTemplate'],
  ['print router', 'function buildPrintHtml'],
  ['print A4 page setup', '@page{size:A4;margin:12mm}'],
  ['print repeating table headers', 'thead{display:table-header-group}'],
  ['print row pagination guard', 'tr{break-inside:avoid;page-break-inside:avoid}'],
  ['print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
  ['business PDF failure feedback', 'PDF 导出失败：'],
  ['business PDF failure audit', "writeModuleAudit('导出PDF', fileName, '普通', '失败')"],
]

const requiredTaxSnippets = [
  ['tax print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
  ['tax PDF failure feedback', 'PDF 导出失败：'],
  ['tax PDF failure audit', "action: '导出申报包 PDF'"],
  ['tax PDF failure result', "result: '失败'"],
  ['tax PDF failure attachment', 'attachment: String(error)'],
]

const requiredAgencySnippets = [
  ['agency print window feedback', '浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。'],
  ['agency repeating table headers', 'thead { display: table-header-group; }'],
  ['agency row pagination guard', 'tr { break-inside: avoid; page-break-inside: avoid; }'],
  ['agency PDF failure feedback', 'PDF 导出失败：'],
  ['agency PDF failure audit', "writeAgencyAudit('导出PDF', fileName, '普通', '失败')"],
]

const requiredXlsxSnippets = [
  ['xlsx span merge support', 'columnSpan: merge ? merge.e.c - merge.s.c + 1 : undefined'],
  ['xlsx header style', "backgroundColor: titleRow ? '#DDEBFA' : headerRow ? '#E8EEF6'"],
  ['xlsx borders', "borderStyle: headerRow || rowIndex > 0 ? 'thin' : undefined"],
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
  ...check(businessSource, requiredBusinessSnippets),
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
  fixedTemplates: ['voucher', 'ledger', 'financial', 'tax', 'generic-list'],
  xlsxFeatures: ['merged title/note rows', 'header styling', 'bordered data region', 'Chinese font'],
  pdfFeatures: ['Chinese font readiness', 'A4 pagination', 'page numbers'],
}, null, 2))
