import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import { recordExportJob } from '../../lib/exportJobs'
import { exportHtmlToPdf, sanitizePrintableHtml } from '../../lib/pdfExport'
import { buildOperationalPrintHtml, createOperationalExportModel, operationalExportFileBase } from '../../lib/operationalExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'

interface OperationalExportActionsProps {
  title: string
  companyName?: string
  periodLabel?: string
  exportHeaders?: string[]
  exportRows?: Array<Array<string | number>>
  onNotice?: (message: string) => void
}

interface TableSnapshot {
  headers: string[]
  rows: string[][]
}

function tableSnapshot(trigger: HTMLButtonElement | null): TableSnapshot | null {
  const root = trigger?.closest('[data-operational-export-root]')
  if (!root) return null
  const tables = Array.from(root.querySelectorAll('table'))
  const table = tables.sort((left, right) => right.querySelectorAll('tbody tr').length - left.querySelectorAll('tbody tr').length)[0]
  if (!table) return null

  const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent || '')
  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent || ''))
    .filter((row) => row.length > 0)
  return headers.length > 0 ? { headers, rows } : null
}

function generatedAtLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(/\//g, '-')
}

function columnWidths(headers: string[], rows: string[][]) {
  return headers.map((header, index) => ({
    wch: Math.min(36, Math.max(12, header.length + 4, ...rows.map((row) => (row[index] || '').length + 2))),
  }))
}

export function OperationalExportActions({ title, companyName, periodLabel, exportHeaders, exportRows, onNotice }: OperationalExportActionsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | 'print' | null>(null)
  const [status, setStatus] = useState('')

  const notify = (message: string) => {
    setStatus(message)
    onNotice?.(message)
  }

  const prepare = () => {
    const snapshot = exportHeaders && exportRows ? { headers: exportHeaders, rows: exportRows } : tableSnapshot(triggerRef.current)
    if (!snapshot) {
      notify('当前页面没有可导出的列表数据。')
      return null
    }
    const model = createOperationalExportModel({
      title,
      companyName,
      periodLabel,
      generatedAt: generatedAtLabel(),
      headers: snapshot.headers,
      rows: snapshot.rows,
    })
    if (model.headers.length === 0) {
      notify('当前列表没有可导出的业务字段。')
      return null
    }
    return model
  }

  const exportExcel = async () => {
    const model = prepare()
    if (!model) return
    setBusy('xlsx')
    try {
      const fileName = `${operationalExportFileBase(model.title, periodLabel)}.xlsx`
      await exportRowsToXlsx({
        sheetRows: model.sheetRows,
        columnWidths: columnWidths(model.headers, model.rows),
        sheetName: model.title,
        fileName,
        merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(model.headers.length - 1, 0) } }],
      })
      await recordExportJob({ scopeKind: 'account', fileName, moduleName: title, format: 'Excel', scope: periodLabel || '当前筛选', templateKind: 'operational', rowCount: model.rows.length })
      notify(`已导出 ${model.rows.length} 条当前筛选记录。`)
    } catch (error) {
      notify(`Excel 导出或下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }

  const exportPdf = async () => {
    const model = prepare()
    if (!model) return
    setBusy('pdf')
    try {
      const fileName = `${operationalExportFileBase(model.title, periodLabel)}.pdf`
      await exportHtmlToPdf({
        html: buildOperationalPrintHtml(model),
        fileName,
        pageTitle: model.title,
      })
      await recordExportJob({ scopeKind: 'account', fileName, moduleName: title, format: 'PDF', scope: periodLabel || '当前筛选', templateKind: 'operational', rowCount: model.rows.length })
      notify(`已生成 ${model.rows.length} 条当前筛选记录的 PDF。`)
    } catch (error) {
      notify(`PDF 导出或下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }

  const printList = async () => {
    const model = prepare()
    if (!model) return
    setBusy('print')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      notify('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      setBusy(null)
      return
    }
    try {
      printWindow.document.write(sanitizePrintableHtml(buildOperationalPrintHtml(model)))
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      await recordExportJob({ scopeKind: 'account', fileName: `${operationalExportFileBase(model.title, periodLabel)}-print`, moduleName: title, format: '打印预览', scope: periodLabel || '当前筛选', templateKind: 'operational', rowCount: model.rows.length })
      notify(`已打开 ${model.rows.length} 条当前筛选记录的打印预览。`)
    } catch (error) {
      notify(`打印预览已打开，但下载中心登记失败：${String(error)}`)
    } finally {
      setBusy(null)
    }
  }

  const buttonClass = 'inline-flex h-8 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

  return <div className="flex flex-wrap gap-2" aria-label={`${title}导出操作`}>
    <button ref={triggerRef} type="button" disabled={busy !== null} onClick={() => void exportExcel()} className={buttonClass} title="导出当前筛选列表为 Excel"><FileSpreadsheet className="h-3.5 w-3.5" />导出Excel</button>
    <button type="button" disabled={busy !== null} onClick={() => void exportPdf()} className={buttonClass} title="导出当前筛选列表为 PDF"><FileDown className="h-3.5 w-3.5" />导出PDF</button>
    <button type="button" disabled={busy !== null} onClick={() => void printList()} className={buttonClass} title="打印当前筛选列表"><Printer className="h-3.5 w-3.5" />打印</button>
    <span className="sr-only" role="status" aria-live="polite">{status}</span>
  </div>
}
