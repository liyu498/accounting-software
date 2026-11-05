import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { useState } from 'react'
import { recordExportJob } from '../../lib/exportJobs'
import {
  accountingReportFileBase,
  buildAccountingReportPrintHtml,
  createAccountingReportExportModel,
  type AccountingReportKind,
  type AccountingHeaderGroup,
  type AccountingReportLayout,
} from '../../lib/accountingReportExport'
import { exportHtmlToPdf, sanitizePrintableHtml } from '../../lib/pdfExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'

interface AccountingReportExportActionsProps {
  title: string
  companyName?: string
  periodLabel?: string
  accountingStandard?: string
  formCode?: string | null
  unit?: string
  reportKind: AccountingReportKind
  layout?: AccountingReportLayout
  exportHeaders: string[]
  headerGroups?: AccountingHeaderGroup[]
  exportRows: Array<Array<string | number>>
  onNotice?: (message: string) => void
}

function generatedAtLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(/\//g, '-')
}

function columnWidths(headers: string[], rows: Array<Array<string | number>>) {
  return headers.map((header, index) => ({
    wch: Math.min(40, Math.max(10, header.length + 4, ...rows.map((row) => String(row[index] ?? '').length + 2))),
  }))
}

export function AccountingReportExportActions(props: AccountingReportExportActionsProps) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | 'print' | null>(null)
  const [status, setStatus] = useState('')
  const notify = (message: string) => {
    setStatus(message)
    props.onNotice?.(message)
  }
  const prepare = () => createAccountingReportExportModel({
    title: props.title,
    companyName: props.companyName,
    periodLabel: props.periodLabel,
    accountingStandard: props.accountingStandard,
    formCode: props.formCode,
    unit: props.unit,
    generatedAt: generatedAtLabel(),
    reportKind: props.reportKind,
    layout: props.layout,
    headers: props.exportHeaders,
    headerGroups: props.headerGroups,
    rows: props.exportRows,
  })
  const exportExcel = async () => {
    const model = prepare()
    setBusy('xlsx')
    try {
      const fileName = `${accountingReportFileBase(model.title, model.periodLabel)}.xlsx`
      await exportRowsToXlsx({
        sheetRows: model.sheetRows,
        columnWidths: columnWidths(model.headers, props.exportRows),
        sheetName: model.title,
        fileName,
        merges: model.xlsxMerges,
        orientation: model.orientation,
        stickyRowsCount: 6,
        showGridLines: false,
      })
      await recordExportJob({ scopeKind: 'account', fileName, moduleName: props.title, format: 'Excel', scope: model.periodLabel, templateKind: 'accounting', rowCount: model.rows.length })
      notify(`已按会计报表格式导出 ${model.rows.length} 行。`)
    } catch (error) {
      notify(`Excel 导出或下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }
  const exportPdf = async () => {
    const model = prepare()
    setBusy('pdf')
    try {
      const fileName = `${accountingReportFileBase(model.title, model.periodLabel)}.pdf`
      await exportHtmlToPdf({
        html: buildAccountingReportPrintHtml(model),
        fileName,
        pageTitle: model.title,
      })
      await recordExportJob({ scopeKind: 'account', fileName, moduleName: props.title, format: 'PDF', scope: model.periodLabel, templateKind: 'accounting', rowCount: model.rows.length })
      notify(`已按会计报表格式生成 ${model.rows.length} 行 PDF。`)
    } catch (error) {
      notify(`PDF 导出或下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }
  const printReport = async () => {
    const model = prepare()
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      notify('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      return
    }
    setBusy('print')
    try {
      printWindow.document.write(sanitizePrintableHtml(buildAccountingReportPrintHtml(model)))
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      await recordExportJob({ scopeKind: 'account', fileName: `${accountingReportFileBase(model.title, model.periodLabel)}-print`, moduleName: props.title, format: '打印预览', scope: model.periodLabel, templateKind: 'accounting', rowCount: model.rows.length })
      notify(`已打开 ${model.title} 打印预览。`)
    } catch (error) {
      notify(`打印预览已打开，但下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }
  const buttonClass = 'inline-flex h-8 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

  return <div className="flex flex-wrap gap-2" aria-label={`${props.title}会计格式导出`}>
    <button type="button" disabled={busy !== null} onClick={() => void exportExcel()} className={buttonClass} title="按会计格式导出 Excel"><FileSpreadsheet className="h-3.5 w-3.5" />导出Excel</button>
    <button type="button" disabled={busy !== null} onClick={() => void exportPdf()} className={buttonClass} title="按会计格式导出 PDF"><FileDown className="h-3.5 w-3.5" />导出PDF</button>
    <button type="button" disabled={busy !== null} onClick={() => void printReport()} className={buttonClass} title="按会计格式打印"><Printer className="h-3.5 w-3.5" />打印</button>
    <span className="sr-only" role="status" aria-live="polite">{status}</span>
  </div>
}
