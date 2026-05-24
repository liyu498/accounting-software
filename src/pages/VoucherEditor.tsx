import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVoucherFormStore } from '../stores/voucherFormStore'
import { useVoucherStore } from '../stores/voucherStore'
import { useCompanyStore } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { useAuthStore } from '../stores/authStore'
import { cn } from '../lib/utils'
import { useToast, useSuccessToast, useWarningToast } from '../components/ui/Toast'
import { VoucherToolbar } from '../components/voucher/VoucherToolbar'
import { VoucherHeaderFields } from '../components/voucher/VoucherHeaderFields'
import { VoucherEntryGrid } from '../components/voucher/VoucherEntryGrid'
import { VoucherBalanceFooter } from '../components/voucher/VoucherBalanceFooter'
import { Button } from '../components/ui/Button'
import { Loader2, BookOpen, FileText, Maximize2, Minimize2 } from 'lucide-react'
import { useKeyboardShortcuts } from '../lib/keyboardShortcuts'

interface DigestItem {
  id: string
  company_id: string
  content: string
}

interface TemplateType {
  id: string
  company_id: string
  name: string
  sort_order: number
}

interface TemplateWithEntries {
  template: {
    id: string
    type_id: string
    company_id: string
    name: string
    entries_json: string
  }
  entries: {
    account_code: string
    account_name: string
    direction: string
    summary: string
    auxiliary_type: string | null
    auxiliary_id: string | null
  }[]
}

export function VoucherEditor() {
  const { id: voucherId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const successToast = useSuccessToast()
  const warningToast = useWarningToast()

  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const { currentPeriodId, voucherWords, fetchVoucherWords } = usePeriodStore()
  const { getVoucher, addVoucher, updateVoucher } = useVoucherStore()

  const {
    voucherDate,
    voucherNumber,
    attachmentCount,
    voucherWordId,
    entries,
    editVoucherId,
    selectedPeriodId,
    isBalanced,
    balanceDiff,
    initForNew,
    initForEdit,
    addEntry,
    removeEntry,
    autoBalance,
    toggleDirection,
    reset,
    updateEntry,
  } = useVoucherFormStore()

  const isEditMode = Boolean(voucherId)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  // Digest and template state
  const [digests, setDigests] = useState<DigestItem[]>([])
  const [templateTypes, setTemplateTypes] = useState<TemplateType[]>([])
  const [templates, setTemplates] = useState<TemplateWithEntries[]>([])
  const [selectedTemplateTypeId, setSelectedTemplateTypeId] = useState('')
  const [showDigestDropdown, setShowDigestDropdown] = useState(false)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [isCompact, setIsCompact] = useState(false)

  // Fetch digests and template types
  useEffect(() => {
    if (!selectedCompanyId) return
    const loadExtras = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const d = await invoke<DigestItem[]>('get_common_digests', { companyId: selectedCompanyId })
        setDigests(d)
        const types = await invoke<TemplateType[]>('get_voucher_template_types', { companyId: selectedCompanyId })
        setTemplateTypes(types)
      } catch {
        // Silently fail - digest/template are optional
      }
    }
    loadExtras()
  }, [selectedCompanyId])

  // Fetch templates when type changes
  useEffect(() => {
    if (!selectedTemplateTypeId) {
      setTemplates([])
      return
    }
    const loadTemplates = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const t = await invoke<TemplateWithEntries[]>('get_voucher_templates', { typeId: selectedTemplateTypeId, companyId: selectedCompanyId })
        setTemplates(t)
      } catch {
        setTemplates([])
      }
    }
    loadTemplates()
  }, [selectedTemplateTypeId])

  // Initialize form
  useEffect(() => {
    if (!selectedCompanyId) {
      navigate('/vouchers')
      return
    }

    let cancelled = false
    setIsInitializing(true)
    setInitError(null)

    const init = async () => {
      try {
        let periodId = currentPeriodId
        if (!periodId) {
          const { periods, fetchOpenPeriods } = usePeriodStore.getState()
          if (periods.length === 0) {
            await fetchOpenPeriods(selectedCompanyId)
          }
          const allPeriods = usePeriodStore.getState().periods
          const openPeriod = allPeriods.find((p) => p.status === 'open')
          if (!openPeriod) {
            setInitError('没有可用的会计期间，请先在设置中创建期间')
            return
          }
          periodId = openPeriod.id
          usePeriodStore.getState().setCurrentPeriod(periodId)
        }

        if (voucherWords.length === 0) {
          await fetchVoucherWords(selectedCompanyId)
        }

        if (cancelled) return

        if (isEditMode && voucherId) {
          const voucher = await getVoucher(voucherId, selectedCompanyId)
          if (cancelled) return
          if (voucher) {
            initForEdit(voucher)
          } else {
            warningToast('凭证不存在')
            navigate('/vouchers')
            return
          }
        } else {
          const words = usePeriodStore.getState().voucherWords
          if (words.length === 0) {
            setInitError('未配置凭证字，请先在系统设置中添加凭证字')
            return
          }
          const currentWord = words.find(w => w.word_name === '记') || words[0]
          const nextNumber = await getNextVoucherNumber(periodId, selectedCompanyId)
          if (cancelled) return
          initForNew(selectedCompanyId, periodId, currentWord.id, nextNumber)
        }
      } catch (err) {
        if (!cancelled) {
          setInitError('初始化凭证失败: ' + String(err))
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [isEditMode, voucherId, selectedCompanyId, currentPeriodId])

  // Auto-save draft to localStorage every 30s
  useEffect(() => {
    if (isInitializing || isEditMode) return // Only auto-save new vouchers
    const interval = setInterval(() => {
      const state = useVoucherFormStore.getState()
      if (!state.isDirty || state.entries.every((e) => !e.accountCode)) return
      const draft = {
        voucherDate: state.voucherDate,
        voucherNumber: state.voucherNumber,
        attachmentCount: state.attachmentCount,
        voucherWordId: state.voucherWordId,
        entries: state.entries,
        savedAt: new Date().toISOString(),
      }
      try {
        localStorage.setItem('voucher_draft', JSON.stringify(draft))
        useVoucherFormStore.setState({ lastAutoSaveAt: draft.savedAt })
      } catch {
        // localStorage full or unavailable
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [isInitializing, isEditMode])

  // Validate entries before save
  const validateEntries = useCallback((): string | null => {
    const validEntries = entries.filter((e) => e.accountCode && e.amount > 0)
    if (validEntries.length < 2) {
      return '会计分录至少需要两条'
    }
    if (!isBalanced) {
      return `借贷不平衡，差额: ${balanceDiff.toFixed(2)}`
    }
    const missingSummary = validEntries.findIndex((e) => !e.summary?.trim())
    if (missingSummary !== -1) {
      return `第${missingSummary + 1}条分录摘要不能为空`
    }
    const missingAccount = entries.findIndex((e) => e.amount > 0 && !e.accountCode)
    if (missingAccount !== -1) {
      return `第${missingAccount + 1}条分录科目不能为空`
    }
    if (!voucherNumber.trim()) {
      return '凭证号不能为空'
    }
    return null
  }, [entries, isBalanced, balanceDiff, voucherNumber])

  // Build save payload
  const buildPayload = useCallback(() => {
    const validEntries = entries
      .filter((e) => e.accountCode && e.amount > 0)
      .map((e, idx) => ({
        account_code: e.accountCode,
        account_name: e.accountName,
        direction: e.direction,
        amount: e.amount,
        summary: e.summary,
        line_num: idx + 1,
        auxiliary_type: e.auxiliaryType || undefined,
        auxiliary_id: e.auxiliaryId || undefined,
        doc_number: e.docNumber || undefined,
        quantity: e.quantity ?? undefined,
        unit_price: e.unitPrice ?? undefined,
        unit: e.unit || undefined,
        currency_id: e.currencyId || undefined,
        exchange_rate: e.exchangeRate ?? undefined,
      }))

    const createdBy = user?.username || user?.realName || 'admin'

    return {
      company_id: selectedCompanyId,
      period_id: selectedPeriodId,
      voucher_word_id: voucherWordId,
      voucher_date: voucherDate,
      voucher_number: voucherNumber.trim(),
      attachment_count: attachmentCount,
      created_by: createdBy,
      entries: validEntries,
    }
  }, [
    entries, selectedCompanyId, selectedPeriodId, voucherWordId,
    voucherDate, voucherNumber, attachmentCount, user,
  ])

  // Save handler
  const handleSave = useCallback(async () => {
    const validationError = validateEntries()
    if (validationError) {
      warningToast(validationError)
      return
    }

    try {
      if (isEditMode && editVoucherId) {
        const voucher = await getVoucher(editVoucherId, selectedCompanyId)
        if (!voucher) throw new Error('凭证不存在')

        const payload = buildPayload()
        await updateVoucher({
          id: editVoucherId,
          voucher_date: payload.voucher_date,
          attachment_count: payload.attachment_count,
          modified_by: payload.created_by,
          version: voucher.version,
          entries: payload.entries,
        }, selectedCompanyId)
        successToast('凭证修改成功')
      } else {
        await addVoucher(buildPayload())
        successToast('凭证创建成功')
      }
      localStorage.removeItem('voucher_draft')
      reset()
      navigate('/vouchers')
    } catch (error) {
      addToast('保存失败: ' + String(error), 'error')
    }
  }, [
    validateEntries, isEditMode, editVoucherId,
    buildPayload, addVoucher, updateVoucher,
    getVoucher, navigate, successToast, warningToast, addToast, reset,
  ])

  // Save and new handler
  const handleSaveAndNew = useCallback(async () => {
    const validationError = validateEntries()
    if (validationError) {
      warningToast(validationError)
      return
    }

    try {
      await addVoucher(buildPayload())
      localStorage.removeItem('voucher_draft')
      successToast('凭证创建成功')

      const nextNumber = await getNextVoucherNumber(selectedPeriodId, selectedCompanyId)
      const words = usePeriodStore.getState().voucherWords
      const currentWord = words.find(w => w.word_name === '记') || words[0]
      if (currentWord) {
        initForNew(selectedCompanyId, selectedPeriodId, currentWord.id, nextNumber)
      }
    } catch (error) {
      addToast('保存失败: ' + String(error), 'error')
    }
  }, [
    validateEntries, buildPayload, addVoucher,
    selectedCompanyId, selectedPeriodId, initForNew,
    successToast, warningToast, addToast,
  ])

  // Apply template to form
  const applyTemplate = useCallback((template: TemplateWithEntries) => {
    const newEntries = template.entries.map((te) => ({
      accountCode: te.account_code,
      accountName: te.account_name,
      direction: (te.direction === 'credit' ? 'credit' : 'debit') as 'debit' | 'credit',
      amount: 0,
      summary: te.summary || '',
      auxiliaryType: te.auxiliary_type || null,
      auxiliaryId: te.auxiliary_id || null,
      auxiliaryName: null,
      docNumber: null,
      quantity: null,
      unitPrice: null,
      unit: null,
      cashFlowTag: null,
      currencyId: null,
      exchangeRate: null,
    }))
    // Compute balances for new entries
    const validEntries = newEntries.filter((e) => e.amount > 0)
    const totalDebit = validEntries.filter((e) => e.direction === 'debit').reduce((s, e) => s + e.amount, 0)
    const totalCredit = validEntries.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amount, 0)
    const balanceDiff = Math.abs(totalDebit - totalCredit)
    useVoucherFormStore.setState({
      entries: newEntries,
      activeEntryIndex: 0,
      isDirty: true,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: balanceDiff < 0.01,
      balanceDiff: Math.round(balanceDiff * 100) / 100,
    })
    successToast(`已应用模板: ${template.template.name}`)
    setShowTemplateDropdown(false)
  }, [successToast])

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'F12',
      handler: handleSave,
      description: '保存凭证',
    },
    {
      key: '=',
      handler: autoBalance,
      description: '自动平衡借贷',
    },
    {
      key: 'n',
      ctrlKey: true,
      handler: addEntry,
      description: '新增分录行',
    },
    {
      key: 'd',
      ctrlKey: true,
      handler: () => {
        if (entries.length > 2) {
          const { activeEntryIndex } = useVoucherFormStore.getState()
          removeEntry(activeEntryIndex)
        }
      },
      description: '删除当前分录行',
    },
    {
      key: 'Escape',
      handler: () => {
        if (confirm('确定要取消吗？未保存的数据将丢失。')) {
          reset()
          navigate('/vouchers')
        }
      },
      description: '返回列表',
    },
  ])

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
        <span className="text-gray-500">加载中...</span>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-600 font-medium">{initError}</p>
        <Button variant="outline" onClick={() => navigate('/vouchers')}>
          返回列表
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Top toolbar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50/80">
        <div className={cn('mx-auto px-6 py-3', isCompact ? 'max-w-full' : 'max-w-[90rem]')}>
          <div className="flex items-center justify-between">
            <VoucherToolbar
              title={isEditMode ? '编辑凭证' : '新建凭证'}
            />
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title={isCompact ? '标准模式' : '紧凑模式（无边距）'}
            >
              {isCompact ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn('mx-auto px-6 py-4 space-y-4', isCompact ? 'max-w-full px-3 py-2' : 'max-w-[90rem]')}>
          {/* Quick tools row: digest + template */}
          <div className="flex items-center gap-3">
            {/* Common digest selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowDigestDropdown(!showDigestDropdown); setShowTemplateDropdown(false) }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-primary-300 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                常用摘要
                {digests.length > 0 && (
                  <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0 text-[10px]">{digests.length}</span>
                )}
              </button>
              {showDigestDropdown && digests.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72 max-h-48 overflow-y-auto">
                  {digests.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 border-b border-gray-50 last:border-0"
                      onClick={() => {
                        // Apply digest to active entry's summary, or first empty-summary entry
                        const state = useVoucherFormStore.getState()
                        const targetIdx = state.activeEntryIndex
                        state.updateEntry(targetIdx, 'summary', d.content)
                        setShowDigestDropdown(false)
                      }}
                    >
                      {d.content}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowTemplateDropdown(!showTemplateDropdown); setShowDigestDropdown(false) }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-primary-300 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                凭证模板
              </button>
              {showTemplateDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80">
                  <div className="p-2 border-b">
                    <select
                      value={selectedTemplateTypeId}
                      onChange={(e) => setSelectedTemplateTypeId(e.target.value)}
                      className="w-full h-8 px-2 border border-gray-200 rounded text-xs"
                    >
                      <option value="">选择模板类型...</option>
                      {templateTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  {templates.length > 0 && (
                    <div className="max-h-48 overflow-y-auto">
                      {templates.map((t) => (
                        <button
                          key={t.template.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 border-b border-gray-50 last:border-0"
                          onClick={() => applyTemplate(t)}
                        >
                          <div className="font-medium">{t.template.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {t.entries.map((e) => `${e.account_code} ${e.account_name}`).join(' | ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTemplateTypeId && templates.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">该类型下暂无模板</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <VoucherHeaderFields />
          <VoucherEntryGrid />
          <VoucherBalanceFooter />
        </div>
      </div>

      {/* Bottom actions — fixed */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        <div className="max-w-[90rem] mx-auto px-6 py-3 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('确定要取消吗？未保存的数据将丢失。')) {
                reset()
                navigate('/vouchers')
              }
            }}
          >
            取消 (Esc)
          </Button>
          {!isEditMode && (
            <Button variant="outline" onClick={handleSaveAndNew}>
              保存并新增
            </Button>
          )}
          <Button onClick={handleSave}>
            保存凭证 (F12)
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper: get next voucher number from backend
async function getNextVoucherNumber(periodId: string, companyId: string): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string>('get_next_voucher_number', { periodId, companyId })
  } catch {
    return '记字第001号'
  }
}
