import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, isTauri } from '../../lib/tauri'
import {
  MAX_BROWSER_VOUCHER_IMPORT_FILE_BYTES,
  parseBrowserVoucherSheetRows,
} from '../../lib/browserVoucherImport.js'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { usePeriodStore } from '../../stores/periodStore'

type ImportFormat = 'chronological' | 'standard'

type ParsedVoucherRow = {
  row_index: number
  voucher_date: string
  voucher_number: string
  summary: string
  account_code: string
  account_name: string
  account_full_name: string
  direction: string
  amount: number
  errors: string[]
}

type ParseResult = {
  rows: ParsedVoucherRow[]
  total_rows: number
  error_count: number
  errors: string[]
}

type ImportVoucher = {
  voucher_date: string
  voucher_number?: string
  summary: string
  entries: Array<{
    account_code: string
    account_name?: string
    account_full_name?: string
    direction: string
    amount: number
    summary: string
  }>
}

type ImportResult = {
  success: number
  errors: string[]
  voucher_ids: string[]
  auto_created_accounts: number
  auto_created_periods: number
}

type Props = {
  companyId: string
  periodId: string
  onClose: () => void
  onImported: (message: string) => Promise<void> | void
}

function groupRows(rows: ParsedVoucherRow[]) {
  const groups = new Map<string, ImportVoucher>()
  let lastKey = ''

  for (const row of rows) {
    const explicitKey = row.voucher_number.trim()
      ? `${row.voucher_date}::${row.voucher_number.trim()}`
      : row.voucher_date.trim() && row.summary.trim()
        ? `${row.voucher_date}::${row.summary.trim()}`
        : ''
    const key = explicitKey || lastKey || `row-${row.row_index}`
    lastKey = key
    const existing = groups.get(key)
    const voucher = existing || {
      voucher_date: row.voucher_date,
      voucher_number: row.voucher_number || undefined,
      summary: row.summary || '批量导入凭证',
      entries: [],
    }
    voucher.entries.push({
      account_code: row.account_code,
      account_name: row.account_name || undefined,
      account_full_name: row.account_full_name || undefined,
      direction: row.direction,
      amount: row.amount,
      summary: row.summary || voucher.summary,
    })
    groups.set(key, voucher)
  }

  const vouchers = [...groups.values()]
  const errors = vouchers.flatMap((voucher, index) => {
    const debit = voucher.entries
      .filter((entry) => entry.direction === 'debit')
      .reduce((sum, entry) => sum + entry.amount, 0)
    const credit = voucher.entries
      .filter((entry) => entry.direction === 'credit')
      .reduce((sum, entry) => sum + entry.amount, 0)
    const prefix = `第 ${index + 1} 张候选凭证`
    return [
      ...(!voucher.voucher_date ? [`${prefix}缺少凭证日期`] : []),
      ...(voucher.entries.length < 2 ? [`${prefix}少于两条分录`] : []),
      ...(Math.abs(debit - credit) >= 0.005
        ? [`${prefix}借贷不平：借 ${debit.toFixed(2)} / 贷 ${credit.toFixed(2)}`]
        : []),
    ]
  })
  return { vouchers, errors }
}

export function VoucherImportDialog({ companyId, periodId, onClose, onImported }: Props) {
  const voucherWords = usePeriodStore((state) => state.voucherWords)
  const periods = usePeriodStore((state) => state.periods)
  const fetchVoucherWords = usePeriodStore((state) => state.fetchVoucherWords)
  const createPeriod = usePeriodStore((state) => state.createPeriod)
  const notifyDataChange = usePeriodStore((state) => state.notifyDataChange)
  const browserFileInputRef = useRef<HTMLInputElement>(null)
  const [format, setFormat] = useState<ImportFormat>('chronological')
  const [voucherWordId, setVoucherWordId] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchVoucherWords(companyId)
  }, [companyId, fetchVoucherWords])

  useEffect(() => {
    if (!voucherWordId && voucherWords[0]?.id) setVoucherWordId(voucherWords[0].id)
  }, [voucherWordId, voucherWords])

  const grouped = useMemo(() => groupRows(parsed?.rows || []), [parsed])
  const rowErrors = useMemo(
    () => (parsed?.rows || []).flatMap((row) => row.errors.map((error) => `第 ${row.row_index} 行：${error}`)),
    [parsed],
  )
  const validationErrors = [...(parsed?.errors || []), ...rowErrors, ...grouped.errors]
  const canImport = Boolean(parsed?.rows.length && grouped.vouchers.length && voucherWordId && validationErrors.length === 0)

  const chooseFile = async () => {
    if (!isTauri) {
      browserFileInputRef.current?.click()
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const filePath = String(selected)
      const result = await invoke<ParseResult>('parse_voucher_excel', {
        filePath,
        formatType: format,
      })
      setFileName(filePath.split(/[\\/]/).pop() || filePath)
      setParsed(result)
      setNotice(result.rows.length ? null : '文件中没有可导入的数据行。')
    } catch (error) {
      setParsed(null)
      setNotice(`解析凭证文件失败：${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const parseBrowserFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setParsed(null)
      setNotice('浏览器导入仅支持 .xlsx 文件；旧版 .xls 请在桌面端转换或导入。')
      return
    }
    if (file.size <= 0 || file.size > MAX_BROWSER_VOUCHER_IMPORT_FILE_BYTES) {
      setParsed(null)
      setNotice('凭证导入文件须大于 0 且不超过 25 MB。')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const sheetRows = await readSheet(file)
      const result = parseBrowserVoucherSheetRows(sheetRows, format) as ParseResult
      setFileName(file.name)
      setParsed(result)
      setNotice(result.rows.length ? null : '文件中没有可导入的数据行。')
    } catch (error) {
      setParsed(null)
      setNotice(`解析凭证文件失败：${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = async () => {
    if (!isTauri) {
      setBusy(true)
      try {
        await exportRowsToXlsx({
          sheetRows: [
            ['日期(YYYY-MM-DD)', '摘要', '科目编码', '方向(debit/credit)', '金额', '分录摘要'],
            ['2026-05-01', '示例凭证', '1002', 'debit', 100, '银行存款'],
            ['2026-05-01', '示例凭证', '6001', 'credit', 100, '主营业务收入'],
          ],
          columnWidths: [{ wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 24 }],
          sheetName: '凭证导入模板',
          fileName: 'voucher_import_template.xlsx',
        })
        setNotice('标准凭证导入模板已下载。')
      } catch (error) {
        setNotice(`生成导入模板失败：${String(error)}`)
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    try {
      const path = await invoke<string>('download_voucher_template')
      setNotice(`模板已生成：${path}`)
    } catch (error) {
      setNotice(`生成导入模板失败：${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const importRows = async () => {
    if (!canImport) {
      setNotice('请先完成文件解析并处理全部校验问题。')
      return
    }
    if (!window.confirm(`确认向当前账套写入 ${grouped.vouchers.length} 张凭证草稿吗？系统可能按文件日期补建账期或科目，导入后仍需人工审核。`)) return

    setBusy(true)
    setNotice(null)
    try {
      let result: ImportResult
      if (isTauri) {
        result = await invoke<ImportResult>('import_vouchers', {
          companyId,
          periodId,
          voucherWordId,
          vouchers: grouped.vouchers,
        })
      } else {
        const resolvedPeriods = [...periods]
        const errors: string[] = []
        const voucherIds: string[] = []
        let createdPeriods = 0
        for (const [index, voucher] of grouped.vouchers.entries()) {
          try {
            const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(voucher.voucher_date)
            if (!match) throw new Error('凭证日期须为 YYYY-MM-DD')
            const year = Number(match[1])
            const month = Number(match[2])
            let targetPeriod = resolvedPeriods.find((item) => item.company_id === companyId && item.period_year === year && item.period_month === month)
            if (!targetPeriod) {
              targetPeriod = await createPeriod(companyId, year, month)
              resolvedPeriods.push(targetPeriod)
              createdPeriods += 1
            }
            if (targetPeriod.status === 'closed') throw new Error('目标账期已结账')
            const created = await invoke<{ id: string }>('create_voucher', {
              input: {
                company_id: companyId,
                period_id: targetPeriod.id,
                voucher_word_id: voucherWordId,
                voucher_date: voucher.voucher_date,
                voucher_number: voucher.voucher_number || undefined,
                summary: voucher.summary,
                entries: voucher.entries.map((entry) => ({
                  ...entry,
                  account_name: entry.account_name || entry.account_full_name || entry.account_code,
                })),
              },
            })
            voucherIds.push(created.id)
          } catch (error) {
            errors.push(`第 ${index + 1} 张：${String(error)}`)
          }
        }
        result = {
          success: voucherIds.length,
          errors,
          voucher_ids: voucherIds,
          auto_created_accounts: 0,
          auto_created_periods: createdPeriods,
        }
        notifyDataChange()
      }
      const details = [
        `成功导入 ${result.success} 张凭证草稿`,
        result.auto_created_accounts ? `补建 ${result.auto_created_accounts} 个科目` : '',
        result.auto_created_periods ? `补建 ${result.auto_created_periods} 个账期` : '',
        result.errors.length ? `${result.errors.length} 条失败记录` : '',
      ].filter(Boolean).join('；')
      await onImported(`${details}。导入结果仍需逐张复核和审核。`)
      onClose()
    } catch (error) {
      setNotice(`导入凭证失败：${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="批量导入凭证">
      <section className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col border border-slate-300 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h2 className="text-base font-semibold">批量导入凭证</h2></div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">解析 Excel 后先校验预览，再由人工确认写入当前账套；浏览器数据仅保存在本机。</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" title="关闭"><X className="h-4 w-4" /></button>
        </header>

        <div className="overflow-y-auto">
          <input
            ref={browserFileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void parseBrowserFile(file)
            }}
          />
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto_auto] dark:border-slate-800">
            <label className="text-xs text-slate-600 dark:text-slate-300">文件格式
              <select value={format} onChange={(event) => { setFormat(event.target.value as ImportFormat); setParsed(null); setFileName('') }} className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-[#0d1423]">
                <option value="chronological">序时账</option><option value="standard">标准导入模板</option>
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">凭证字
              <select value={voucherWordId} onChange={(event) => setVoucherWordId(event.target.value)} className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-[#0d1423]">
                <option value="">选择凭证字</option>{voucherWords.map((word) => <option key={word.id} value={word.id}>{word.word_name}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void downloadTemplate()} className="mt-5 inline-flex h-9 items-center justify-center gap-1 border border-slate-300 px-3 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download className="h-3.5 w-3.5" />下载模板</button>
            <button type="button" disabled={busy} onClick={() => void chooseFile()} className="mt-5 inline-flex h-9 items-center justify-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"><Upload className="h-3.5 w-3.5" />{busy ? '处理中' : '选择文件'}</button>
          </div>

          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="inline-flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" />写入边界</span> 导入只生成草稿，不自动审核或过账。跨账期数据可能补建账期，未知科目可能按来源名称补建，确认前请核对范围。
          </div>
          {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}

          {!parsed && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">尚未选择文件。建议先下载标准模板，或选择带凭证号、日期、科目和借贷金额的序时账。</div>}
          {parsed && <>
            <div className="grid gap-3 border-b border-slate-200 p-4 text-xs sm:grid-cols-4 dark:border-slate-800">
              <div><p className="text-slate-500 dark:text-slate-400">文件</p><p className="mt-1 truncate font-medium" title={fileName}>{fileName}</p></div>
              <div><p className="text-slate-500 dark:text-slate-400">数据行</p><p className="mt-1 font-medium">{parsed.total_rows} 行</p></div>
              <div><p className="text-slate-500 dark:text-slate-400">候选凭证</p><p className="mt-1 font-medium">{grouped.vouchers.length} 张</p></div>
              <div><p className="text-slate-500 dark:text-slate-400">校验问题</p><p className={`mt-1 font-medium ${validationErrors.length ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{validationErrors.length} 条</p></div>
            </div>
            {validationErrors.length > 0 && <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"><p className="font-medium">需先修正源文件后重新解析：</p><ul className="mt-1 list-disc space-y-1 pl-5">{validationErrors.slice(0, 12).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>{validationErrors.length > 12 && <p className="mt-2">另有 {validationErrors.length - 12} 条问题未展开。</p>}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="px-3 py-2">行</th><th className="px-3 py-2">日期</th><th className="px-3 py-2">凭证号</th><th className="px-3 py-2">摘要</th><th className="px-3 py-2">科目</th><th className="px-3 py-2">方向</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2">校验</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{parsed.rows.slice(0, 50).map((row) => <tr key={row.row_index}><td className="px-3 py-2">{row.row_index}</td><td className="whitespace-nowrap px-3 py-2">{row.voucher_date || '-'}</td><td className="px-3 py-2">{row.voucher_number || '-'}</td><td className="max-w-56 truncate px-3 py-2" title={row.summary}>{row.summary || '-'}</td><td className="whitespace-nowrap px-3 py-2">{row.account_code} {row.account_name}</td><td className="px-3 py-2">{row.direction === 'credit' ? '贷' : '借'}</td><td className="px-3 py-2 text-right tabular-nums">{row.amount.toFixed(2)}</td><td className={`px-3 py-2 ${row.errors.length ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{row.errors.join('；') || '通过'}</td></tr>)}</tbody></table>
            </div>
            {parsed.rows.length > 50 && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">仅预览前 50 行，共 {parsed.rows.length} 行。</p>}
          </>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">账套与账期由当前工作台锁定，导入后回到列表逐张复核。</p>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs dark:border-slate-700">取消</button><button type="button" disabled={!canImport || busy} onClick={() => void importRows()} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600">确认导入 {grouped.vouchers.length || 0} 张</button></div>
        </footer>
      </section>
    </div>
  )
}
