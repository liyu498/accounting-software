import { useState } from 'react'
import { Button } from '../ui/Button'
import { useToast, useSuccessToast, useWarningToast } from '../ui/Toast'
import { X, Upload, FileDown, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

interface ParsedRow {
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

interface ImportModalProps {
  companyId: string
  periodId: string | null
  onClose: () => void
  onImported: () => void
}

export function VoucherImportModal({ companyId, periodId, onClose, onImported }: ImportModalProps) {
  const { addToast } = useToast()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const [importFormat, setImportFormat] = useState<'chronological' | 'standard' | 'json'>('chronological')
  const [importJson, setImportJson] = useState('')
  const [previewRows, setPreviewRows] = useState<ParsedRow[] | null>(null)
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [importResult, setImportResult] = useState<{ success: number; errors: string[]; auto_created_accounts?: number; auto_created_periods?: number } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [fileName, setFileName] = useState('')

  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

  const handleDownloadTemplate = async () => {
    try {
      if (isTauri) {
        const path = await invoke<string>('download_voucher_template')
        successToast('模板已下载: ' + path)
      } else {
        warningToast('模板下载仅支持桌面版')
      }
    } catch (error) {
      addToast('下载模板失败: ' + String(error), 'error')
    }
  }

  // Use Tauri file dialog + Rust-side parsing (preferred) or browser fallback
  const handleSelectFile = async () => {
    if (isTauri) {
      try {
        const selected = await dialogOpen({
          multiple: false,
          filters: [
            { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
            { name: 'JSON文件', extensions: ['json'] },
          ],
        })
        if (!selected) return

        const filePath = selected as string
        const name = filePath.split(/[\\/]/).pop() || filePath
        setFileName(name)

        if (name.endsWith('.json')) {
          setImportFormat('json')
          // Read JSON file via Tauri invoke (Rust reads the file)
          try {
            const text = await invoke<string>('read_text_file', { path: filePath })
            setImportJson(text)
          } catch {
            setImportJson('')
          }
          setStep('preview')
          return
        }

        // Use Rust-side calamine parser for Excel files
        const result = await invoke<{
          rows: ParsedRow[]
          total_rows: number
          error_count: number
          errors: string[]
        }>('parse_voucher_excel', {
          filePath,
          formatType: importFormat,
        })

        setPreviewRows(result.rows)
        setPreviewErrors(result.errors)
        setStep('preview')
      } catch (error) {
        addToast('文件选择失败: ' + String(error), 'error')
      }
    } else {
      // Browser fallback: trigger hidden file input
      document.getElementById('voucher-import-file-input')?.click()
    }
  }

  // Browser fallback file select handler
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    if (file.name.endsWith('.json')) {
      setImportFormat('json')
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string || ''
        setImportJson(text)
      }
      reader.readAsText(file)
      setStep('preview')
      return
    }

    // Browser-side Excel parsing
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      await parseExcelBrowser(file)
    }
  }

  const parseExcelBrowser = async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]

      // Read as 2D array to detect header row
      const sheetData: string[][] = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

      // Find header row by scanning for known column names
      const headerKeywords = ['日期', '凭证号', '凭证字号', '摘要', '科目编码', '科目全称', '科目名称', '借方金额', '贷方金额']
      let headerRowIdx = 0
      let colMap: Record<string, number> = {}

      for (let ri = 0; ri < Math.min(sheetData.length, 5); ri++) {
        const row = sheetData[ri]
        let found = 0
        const localMap: Record<string, number> = {}

        for (let ci = 0; ci < row.length; ci++) {
          const cellVal = String(row[ci]).trim()
          for (const kw of headerKeywords) {
            if (cellVal === kw || cellVal.includes(kw)) {
              found++
              localMap[kw] = ci
              if (cellVal.includes('凭证字号')) {
                localMap['凭证号'] = ci
              }
            }
          }
        }

        if (found >= 3) {
          headerRowIdx = ri
          colMap = localMap
          break
        }
      }

      const parseAmount = (val: unknown): number => {
        if (val === null || val === undefined) return 0
        const str = String(val).trim()
        if (str === '' || str === 'null' || str === 'undefined') return 0
        const num = Number(str)
        return isNaN(num) ? 0 : num
      }

      const getCell = (dataRow: string[], colName: string): string => {
        const ci = colMap[colName]
        if (ci === undefined) return ''
        return String(dataRow[ci] || '').trim()
      }

      const parsed: ParsedRow[] = []

      for (let ri = headerRowIdx + 1; ri < sheetData.length; ri++) {
        const dataRow = sheetData[ri]
        if (!dataRow || dataRow.every(c => !c || String(c).trim() === '')) continue

        if (importFormat === 'chronological') {
          const dateStr = getCell(dataRow, '日期')
          const vNum = getCell(dataRow, '凭证号')
          const summary = getCell(dataRow, '摘要')
          const acctCode = getCell(dataRow, '科目编码')
          const acctName = getCell(dataRow, '科目名称')
          const acctFullName = getCell(dataRow, '科目全称')
          const debitAmt = parseAmount(getCell(dataRow, '借方金额'))
          const creditAmt = parseAmount(getCell(dataRow, '贷方金额'))

          if (!dateStr && !acctCode && !debitAmt && !creditAmt) continue

          const direction = debitAmt > 0 ? 'debit' : 'credit'
          const amount = debitAmt > 0 ? debitAmt : creditAmt
          const rowErrors: string[] = []
          if (!acctCode) rowErrors.push('科目编码为空')
          if (amount <= 0) rowErrors.push('金额为零')

          parsed.push({
            row_index: ri + 1,
            voucher_date: dateStr,
            voucher_number: vNum,
            summary,
            account_code: acctCode,
            account_name: acctName,
            account_full_name: acctFullName,
            direction,
            amount,
            errors: rowErrors,
          })
        } else {
          const dateStr = getCell(dataRow, '日期')
          const summary = getCell(dataRow, '摘要')
          const acctCode = getCell(dataRow, '科目编码')
          const dirStr = getCell(dataRow, '方向')
          const amount = parseAmount(getCell(dataRow, '金额'))
          const entrySummary = getCell(dataRow, '分录摘要')

          if (!dateStr && !acctCode) continue

          const direction = (dirStr === '贷' || dirStr === 'credit' || dirStr === '贷方') ? 'credit' : 'debit'
          const rowErrors: string[] = []
          if (!acctCode) rowErrors.push('科目编码为空')
          if (amount <= 0) rowErrors.push('金额为零')

          parsed.push({
            row_index: ri + 1,
            voucher_date: dateStr,
            voucher_number: '',
            summary: entrySummary || summary,
            account_code: acctCode,
            account_name: '',
            account_full_name: '',
            direction,
            amount,
            errors: rowErrors,
          })
        }
      }

      setPreviewRows(parsed)
      setPreviewErrors(parsed.length === 0 ? ['文件中没有有效数据'] : [])
      setStep('preview')
    } catch (err) {
      addToast('Excel文件解析失败: ' + String(err), 'error')
    }
  }

  const handleImport = async () => {
    if (!companyId) {
      warningToast('请先选择账套')
      return
    }

    setIsImporting(true)

    try {
      let vouchersData: Array<{
        voucher_date: string
        summary: string
        entries: Array<{ account_code: string; account_name?: string; account_full_name?: string; direction: string; amount: number; summary: string }>
      }>

      if (importFormat === 'json' && importJson.trim()) {
        const parsed = JSON.parse(importJson)
        if (Array.isArray(parsed)) {
          vouchersData = parsed
        } else {
          warningToast('JSON数据必须是数组格式')
          setIsImporting(false)
          return
        }
      } else if (previewRows && previewRows.length > 0) {
        // Group by voucher_date + voucher_number to keep each voucher independent.
        // Each unique (date, number) combination = one voucher.
        // If no voucher_number, each row becomes its own voucher.
        const voucherMap = new Map<string, {
          voucher_date: string
          summary: string
          entries: Array<{ account_code: string; account_name?: string; account_full_name?: string; direction: string; amount: number; summary: string }>
        }>()

        let lastKey = ''

        for (const row of previewRows) {
          // Build key: date + number together, so different dates with same number stay separate
          const key = row.voucher_number
            ? `${row.voucher_date}::${row.voucher_number}`
            : ''

          // If no key, this row belongs to the previous voucher (continuation row in same voucher)
          const effectiveKey = key || lastKey || `solo_${row.row_index}`

          if (!voucherMap.has(effectiveKey)) {
            voucherMap.set(effectiveKey, {
              voucher_date: row.voucher_date,
              summary: row.summary,
              entries: [],
            })
          }
          voucherMap.get(effectiveKey)!.entries.push({
            account_code: row.account_code,
            account_name: row.account_name || undefined,
            account_full_name: row.account_full_name || undefined,
            direction: row.direction,
            amount: row.amount,
            summary: row.summary,
          })

          if (key) lastKey = key
        }
        vouchersData = Array.from(voucherMap.values())
      } else {
        warningToast('没有可导入的数据')
        setIsImporting(false)
        return
      }

      if (isTauri) {
        const result = await invoke<{ success: number; errors: string[]; voucher_ids: string[]; auto_created_accounts: number; auto_created_periods: number }>('import_vouchers', {
          companyId,
          periodId,
          voucherWordId: '',
          vouchers: vouchersData,
        })
        setImportResult(result)
        setStep('result')
        if (result.success > 0) {
          successToast(`成功导入 ${result.success} 张凭证`)
          onImported()
        }
        if (result.errors.length > 0) {
          addToast(`${result.errors.length} 条错误`, 'error')
        }
      } else {
        setImportResult({ success: vouchersData.length, errors: [] })
        setStep('result')
        successToast(`成功导入 ${vouchersData.length} 张凭证 (模拟)`)
        onImported()
      }
    } catch (error) {
      addToast('导入失败: ' + String(error), 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const resetModal = () => {
    setStep('upload')
    setImportJson('')
    setPreviewRows(null)
    setPreviewErrors([])
    setImportResult(null)
    setFileName('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">导入凭证</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-2 bg-gray-50 flex items-center gap-2 text-xs">
          <span className={step === 'upload' ? 'text-primary-600 font-semibold' : 'text-gray-400'}>1. 选择文件</span>
          <span className="text-gray-300">→</span>
          <span className={step === 'preview' ? 'text-primary-600 font-semibold' : 'text-gray-400'}>2. 数据预览</span>
          <span className="text-gray-300">→</span>
          <span className={step === 'result' ? 'text-primary-600 font-semibold' : 'text-gray-400'}>3. 导入结果</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Format selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">导入格式</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setImportFormat('chronological')}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                      importFormat === 'chronological'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm">序时账格式</p>
                    <p className="text-xs text-gray-500 mt-1">
                      日期 | 凭证号 | 摘要 | 科目编码 | 科目名称 | 借方金额 | 贷方金额
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportFormat('standard')}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                      importFormat === 'standard'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm">标准模板</p>
                    <p className="text-xs text-gray-500 mt-1">
                      日期 | 摘要 | 科目编码 | 方向 | 金额 | 分录摘要
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportFormat('json')}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                      importFormat === 'json'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm">JSON数据</p>
                    <p className="text-xs text-gray-500 mt-1">
                      直接粘贴JSON格式凭证数据
                    </p>
                  </button>
                </div>
              </div>

              {/* File input or JSON textarea */}
              {importFormat === 'json' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">粘贴JSON数据</label>
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder={`[
  {
    "voucher_date": "2026-04-30",
    "summary": "收到货款",
    "entries": [
      { "account_code": "1002", "direction": "debit", "amount": 10000, "summary": "收到货款" },
      { "account_code": "1122", "direction": "credit", "amount": 10000, "summary": "收到货款" }
    ]
  }
]`}
                    className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">选择Excel文件</label>
                    <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                      <FileDown className="w-3 h-3 mr-1" />
                      下载模板
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
                  >
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-2">
                      点击选择Excel文件
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      支持 .xlsx, .xls 格式
                    </p>
                  </button>
                  {/* Hidden file input for browser fallback */}
                  <input
                    id="voucher-import-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInputChange}
                    title="选择Excel文件"
                    className="hidden"
                  />
                  {fileName && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-primary-600">
                      <FileSpreadsheet className="w-4 h-4" />
                      {fileName}
                    </div>
                  )}
                </div>
              )}

              {/* Format description */}
              {importFormat === 'chronological' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">序时账格式说明：</p>
                  <p>Excel列顺序：日期 | 凭证号/凭证字号 | 摘要 | 科目编码 | 科目名称 | 借方金额 | 贷方金额</p>
                  <p className="mt-1">同一凭证号的分录将合并为一张凭证。同一行借方金额和贷方金额只能填写一个。</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {previewRows && previewRows.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      共解析 <span className="font-semibold text-gray-900">{previewRows.length}</span> 条分录
                    </p>
                    <div className="flex items-center gap-3">
                      {previewRows.some(r => r.errors.length > 0) && (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {previewRows.filter(r => r.errors.length > 0).length} 条有错误
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={resetModal}>重新选择</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">行号</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">日期</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">凭证号</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">摘要</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">科目编码</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">科目名称</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">方向</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">金额</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 100).map((row) => (
                          <tr key={row.row_index} className={`border-t ${row.errors.length > 0 ? 'bg-red-50' : ''}`}>
                            <td className="py-1.5 px-2">{row.row_index}</td>
                            <td className="py-1.5 px-2">{row.voucher_date}</td>
                            <td className="py-1.5 px-2">{row.voucher_number || '-'}</td>
                            <td className="py-1.5 px-2 max-w-[120px] truncate">{row.summary}</td>
                            <td className="py-1.5 px-2 font-mono">{row.account_code}</td>
                            <td className="py-1.5 px-2">{row.account_name || '-'}</td>
                            <td className="py-1.5 px-2">{row.direction === 'debit' ? '借' : '贷'}</td>
                            <td className="py-1.5 px-2 text-right">{row.amount.toFixed(2)}</td>
                            <td className="py-1.5 px-2">
                              {row.errors.length > 0 ? (
                                <span className="text-red-600" title={row.errors.join('; ')}>
                                  <AlertCircle className="w-3 h-3 inline" /> 错误
                                </span>
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-green-500 inline" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewRows.length > 100 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        仅显示前100条，共 {previewRows.length} 条
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2" />
                  <p>未能解析出有效数据</p>
                  {previewErrors.map((err, i) => (
                    <p key={i} className="text-red-500 text-sm">{err}</p>
                  ))}
                </div>
              )}

              {importFormat === 'json' && importJson && !previewRows && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">JSON数据已准备就绪</p>
                  <Button variant="ghost" size="sm" onClick={resetModal}>重新选择</Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && importResult && (
            <div className="space-y-4">
              <div className={`rounded-lg p-6 text-center ${importResult.success > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-3xl font-bold text-green-600">{importResult.success}</p>
                <p className="text-sm text-gray-600 mt-1">张凭证导入成功</p>
              </div>
              {(importResult.auto_created_accounts ?? 0) > 0 && (
                <div className="rounded-lg p-3 bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-700">
                    自动创建了 <span className="font-semibold">{importResult.auto_created_accounts}</span> 个明细科目（基于导入数据中的科目编码和名称）
                  </p>
                </div>
              )}
              {(importResult.auto_created_periods ?? 0) > 0 && (
                <div className="rounded-lg p-3 bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700">
                    自动创建了 <span className="font-semibold">{importResult.auto_created_periods}</span> 个会计期间（根据凭证日期自动归集到对应账期）
                  </p>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">
                    {importResult.errors.length} 条错误：
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-red-50 rounded-lg p-3">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50/50">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              {(importFormat === 'json' && importJson.trim()) && (
                <Button onClick={() => setStep('preview')}>下一步</Button>
              )}
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetModal}>上一步</Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || (!previewRows?.length && !importJson.trim())}
              >
                {isImporting ? '导入中...' : '确认导入'}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>完成</Button>
          )}
        </div>
      </div>
    </div>
  )
}
