import { BadgeCheck, CircleAlert, FileBarChart2, FileText, LockKeyhole, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadBrowserPreviewOpenPeriod, previewPeriodLabel } from '../../lib/browserPreviewPeriod'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore, type AccountingReconciliationResult, type BalanceSheetResult, type TrialBalanceResult } from '../../stores/periodStore'
import { useSettlementRuleStore, type SettlementRule, type SettlementRulePreview } from '../../stores/settlementRuleStore'
import { useVoucherStore, type Voucher } from '../../stores/voucherStore'

type CheckStatus = 'passed' | 'pending' | 'blocked' | 'closed'

type ClosingCheck = {
  id: string
  order: string
  title: string
  source: string
  condition: string
  value: string
  detail: string
  status: CheckStatus
  path: string
}

type SettlementExecutionStatus = 'ready' | 'draft' | 'approved' | 'no_activity' | 'invalid'

type SettlementExecutionState = {
  rule: SettlementRule
  status: SettlementExecutionStatus
  detail: string
  preview?: SettlementRulePreview
  voucher?: Voucher
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
}

function checkLabel(status: CheckStatus) {
  return { passed: '已通过', pending: '待取数', blocked: '阻断', closed: '已结账' }[status]
}

function checkClass(status: CheckStatus) {
  if (status === 'passed' || status === 'closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300'
  if (status === 'blocked') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300'
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300'
}

function panelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

function settlementStatusLabel(status: SettlementExecutionStatus) {
  return { ready: '待生成', draft: '待审核', approved: '已完成', no_activity: '无发生额', invalid: '配置异常' }[status]
}

function settlementStatusClass(status: SettlementExecutionStatus) {
  if (status === 'approved' || status === 'no_activity') return checkClass('passed')
  if (status === 'ready') return checkClass('pending')
  return checkClass('blocked')
}

export function ClosingTasksWorkspace() {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) => state.companies.find((company) => company.id === state.selectedCompanyId))
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance)
  const getAccountingReconciliation = usePeriodStore((state) => state.getAccountingReconciliation)
  const getBalanceSheet = usePeriodStore((state) => state.getBalanceSheet)
  const closePeriod = usePeriodStore((state) => state.closePeriod)
  const queryVouchers = useVoucherStore((state) => state.queryVouchers)
  const fetchSettlementRules = useSettlementRuleStore((state) => state.fetchSettlementRules)
  const previewSettlementRule = useSettlementRuleStore((state) => state.previewSettlementRule)
  const createSettlementVoucherDraft = useSettlementRuleStore((state) => state.createSettlementVoucherDraft)
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
  const browserPeriod = useMemo(() => isTauri ? undefined : loadBrowserPreviewOpenPeriod(companyId), [companyId])
  const period = periods.find((candidate) => candidate.id === currentPeriodId) || browserPeriod
  const periodId = currentPeriodId || browserPeriod?.id || null
  const periodLabel = previewPeriodLabel(period) || '未选择账期'
  const isClosed = period?.status === 'closed'

  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(null)
  const [reconciliation, setReconciliation] = useState<AccountingReconciliationResult | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null)
  const [settlementStates, setSettlementStates] = useState<SettlementExecutionState[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [generatingRuleId, setGeneratingRuleId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!companyId || !periodId) {
      setVouchers([])
      setTrialBalance(null)
      setReconciliation(null)
      setBalanceSheet(null)
      setSettlementStates([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [nextVouchers, nextTrialBalance, nextReconciliation, nextBalanceSheet, nextRules] = await Promise.all([
        queryVouchers({ company_id: companyId, period_id: periodId, page: 1, page_size: 100 }),
        fetchTrialBalance(periodId),
        getAccountingReconciliation(periodId),
        getBalanceSheet(periodId),
        fetchSettlementRules(companyId),
      ])
      const activeVouchers = nextVouchers.filter((voucher) => voucher.is_deleted !== 1)
      const enabledRules = nextRules.filter((rule) => rule.is_enabled === 1)
      const nextSettlementStates = await Promise.all(enabledRules.map(async (rule): Promise<SettlementExecutionState> => {
        const existingVoucher = activeVouchers.find((voucher) => voucher.settlement_rule_id === rule.id && voucher.status !== 'reversed')
        if (existingVoucher) {
          return existingVoucher.status === 'approved'
            ? { rule, status: 'approved', detail: `${existingVoucher.voucher_number} 已审核`, voucher: existingVoucher }
            : { rule, status: 'draft', detail: `${existingVoucher.voucher_number} 尚未审核`, voucher: existingVoucher }
        }
        try {
          const preview = await previewSettlementRule(rule.id, companyId, periodId)
          return { rule, status: 'ready', detail: `${preview.entries.length} 条分录，借贷各 ${formatCurrency(preview.totalAmount)}`, preview }
        } catch (error) {
          const message = String(error)
          return message.includes('没有可结转的来源科目发生额')
            ? { rule, status: 'no_activity', detail: '当前账期来源科目无发生额，无需生成凭证' }
            : { rule, status: 'invalid', detail: message.replace(/^Error:\s*/, '') }
        }
      }))
      setVouchers(activeVouchers)
      setTrialBalance(nextTrialBalance)
      setReconciliation(nextReconciliation)
      setBalanceSheet(nextBalanceSheet)
      setSettlementStates(nextSettlementStates)
    } catch (error) {
      setNotice(`读取结账预检失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [companyId, fetchSettlementRules, fetchTrialBalance, getAccountingReconciliation, getBalanceSheet, periodId, previewSettlementRule, queryVouchers])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const checks = useMemo<ClosingCheck[]>(() => {
    if (!period) return []
    const drafts = vouchers.filter((voucher) => voucher.status === 'draft')
    const unbalanced = vouchers.filter((voucher) => Math.abs(voucher.total_debit - voucher.total_credit) >= 0.005)
    const voucherStatus: CheckStatus = unbalanced.length > 0 ? 'blocked' : drafts.length > 0 ? 'blocked' : 'passed'
    const trialStatus: CheckStatus = !trialBalance ? 'pending' : trialBalance.is_balanced ? 'passed' : 'blocked'
    const reconciliationStatus: CheckStatus = !reconciliation ? 'pending' : reconciliation.is_reconciled ? 'passed' : 'blocked'
    const balanceStatus: CheckStatus = !balanceSheet ? 'pending' : balanceSheet.is_balanced ? 'passed' : 'blocked'
    const settlementBlocked = settlementStates.length === 0 || settlementStates.some((state) => !['approved', 'no_activity'].includes(state.status))
    const settlementStatus: CheckStatus = settlementBlocked ? 'blocked' : 'passed'
    const ready = [settlementStatus, voucherStatus, trialStatus, reconciliationStatus, balanceStatus].every((status) => status === 'passed')
    const lockStatus: CheckStatus = isClosed ? 'closed' : ready ? 'passed' : 'blocked'
    return [
      { id: 'settlement', order: '1', title: '期末结转', source: '结转规则与凭证', condition: '规则无需结转或凭证已审核', value: `${settlementStates.length} 条`, detail: settlementStates.length === 0 ? '未配置启用的结转规则，请先维护规则' : settlementBlocked ? `${settlementStates.filter((state) => !['approved', 'no_activity'].includes(state.status)).length} 条规则待处理` : '全部启用规则已完成', status: settlementStatus, path: '/settings/settlement-rules' },
      { id: 'voucher', order: '2', title: '凭证审核与平衡', source: '会计凭证', condition: '无草稿且借贷平衡', value: `${vouchers.length} 张`, detail: unbalanced.length > 0 ? `${unbalanced.length} 张借贷不平` : drafts.length > 0 ? `${drafts.length} 张待审核` : '全部凭证已审核且借贷平衡', status: voucherStatus, path: '/vouchers' },
      { id: 'trial', order: '3', title: '科目余额试算', source: '科目余额表', condition: '本期借贷平衡', value: trialBalance ? formatCurrency(trialBalance.total_period_debit) : '未取数', detail: !trialBalance ? '尚未取得试算结果' : trialBalance.is_balanced ? '本期借贷合计一致' : '试算借贷不平衡', status: trialStatus, path: '/reports/trial-balance' },
      { id: 'reconciliation', order: '4', title: '账簿与报表勾稽', source: '科目表、凭证、总账、科目余额表、资产负债表、利润表、权益变动表', condition: '适用的控制检查全部通过', value: reconciliation ? `${reconciliation.passed_count}/${reconciliation.checks.length} 项` : '未取数', detail: !reconciliation ? '尚未执行账簿与报表勾稽检查' : reconciliation.is_reconciled ? '科目覆盖、余额滚存、凭证汇总、试算平衡及适用的法定报表勾稽均通过' : reconciliation.checks.filter((check) => check.status === 'blocked').map((check) => check.name).join('、'), status: reconciliationStatus, path: '/reports/financial-statements' },
      { id: 'balance', order: '5', title: '资产负债表校验', source: '资产负债表', condition: '资产=负债+权益', value: balanceSheet ? formatCurrency(balanceSheet.total_assets) : '未取数', detail: !balanceSheet ? '尚未取得资产负债表' : balanceSheet.is_balanced ? '资产负债表已平衡' : '资产负债表不平衡', status: balanceStatus, path: '/reports/balance-sheet' },
      { id: 'lock', order: '6', title: '账期锁定', source: '结账管理', condition: '预检通过并人工确认', value: isClosed ? '已锁定' : '待确认', detail: isClosed ? '账期已结账，凭证不可再反审核' : ready ? '可以发起人工结账确认' : '存在未完成或阻断项', status: lockStatus, path: '/settings/period-management' },
    ]
  }, [balanceSheet, isClosed, period, reconciliation, settlementStates, trialBalance, vouchers])

  const blockers = checks.filter((check) => check.status === 'blocked')
  const pending = checks.filter((check) => check.status === 'pending')
  const passed = checks.filter((check) => check.status === 'passed' || check.status === 'closed')
  const canClose = Boolean(companyId && periodId && !isClosed && blockers.length === 0 && pending.length === 0)

  const handleClose = async () => {
    if (!periodId) {
      setNotice('请先选择需要结账的账期。')
      return
    }
    if (isClosed) {
      setNotice('当前账期已结账，无需重复执行。')
      return
    }
    if (!canClose) {
      setNotice('当前预检尚未全部通过，不能结账。')
      return
    }
    if (!window.confirm(`确认结账 ${periodLabel} 吗？结账后凭证将被锁定，反审核需先按受控流程重新打开账期。`)) return
    setClosing(true)
    try {
      await closePeriod(periodId)
      setNotice(`${periodLabel} 已结账并锁定。`)
      await refresh()
    } catch (error) {
      setNotice(`结账失败：${String(error)}`)
    } finally {
      setClosing(false)
    }
  }

  const handleGenerateSettlement = async (state: SettlementExecutionState) => {
    if (!companyId || !periodId || state.status !== 'ready' || !state.preview) return
    if (!window.confirm(`确认按“${state.rule.name}”生成 ${periodLabel} 结转草稿吗？生成后必须在凭证列表复核并审核，系统不会自动过账。`)) return
    setGeneratingRuleId(state.rule.id)
    try {
      const draft = await createSettlementVoucherDraft(state.rule.id, companyId, periodId)
      setNotice(`已生成结转草稿 ${draft.voucherNumber}，请复核并审核后再结账。`)
      await refresh()
    } catch (error) {
      setNotice(`生成结转草稿失败：${String(error)}`)
    } finally {
      setGeneratingRuleId(null)
    }
  }

  return <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
    <section className={panelClassName()}>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">期末结转与结账</h1></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">围绕结转规则、凭证审核、试算平衡、资产负债表校验和账期锁定完成结账前检查。</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />刷新预检</button><button type="button" disabled={!canClose || closing} onClick={() => void handleClose()} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole className="h-3.5 w-3.5" />确认结账</button></div>
      </header>

      {!isTauri && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">浏览器预览的结账操作只会锁定本机预览账期；不会提交税局、银行或其他外部系统。</div>}

      <div className="grid gap-3 border-b border-slate-200 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] dark:border-slate-800"><div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100"><div className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5" />当前检查范围</div><p className="mt-1">账套：{selectedCompany?.name || (companyId ? '浏览器预览账套' : '未选择')}；账期：{periodLabel}。检查范围仅限当前账期的未删除凭证和对应报表取数。</p></div><div className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300"><p className="font-medium text-slate-800 dark:text-slate-100">结账边界</p><p className="mt-1">系统不会自动结账。只有预检全部通过并经人工二次确认后，才会锁定当前账期。</p></div></div>

      <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800"><Metric icon={FileText} label="结账检查" value={`${checks.length} 项`} /><Metric icon={BadgeCheck} label="已通过" value={`${passed.length} 项`} tone="text-emerald-600 dark:text-emerald-400" /><Metric icon={CircleAlert} label="待取数" value={`${pending.length} 项`} tone="text-amber-600 dark:text-amber-400" /><Metric icon={CircleAlert} label="阻断结账" value={`${blockers.length} 项`} tone={blockers.length ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'} /></div>

      {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}
      {!companyId && <Placeholder message="请选择账套后进行结账预检。" />}
      {companyId && !periodId && <Placeholder message="请选择有效账期后进行结账预检。" />}
      {companyId && periodId && loading && <Placeholder message="正在读取当前账期结账预检..." />}
      {companyId && periodId && !loading && <>
        <section className="border-b border-slate-200 dark:border-slate-800"><div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">结转规则执行</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">金额由当前账期已审核凭证实时计算；只生成草稿，不自动审核或过账。</p></div><button type="button" onClick={() => navigate('/settings/settlement-rules')} className="inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">维护规则</button></div>
          {settlementStates.length === 0 ? <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">当前账套没有启用的结转规则。</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{settlementStates.map((state) => <div key={state.rule.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_8rem_9rem_auto] sm:items-center"><div className="min-w-0"><p className="font-medium text-slate-900 dark:text-slate-100">{state.rule.name}</p><p className="mt-1 break-words text-slate-500 dark:text-slate-400">{state.detail}</p></div><div className="tabular-nums text-slate-700 dark:text-slate-200">{state.preview ? formatCurrency(state.preview.totalAmount) : state.voucher ? formatCurrency(state.voucher.total_debit) : '-'}</div><div><span className={`inline-flex border px-2 py-0.5 ${settlementStatusClass(state.status)}`}>{settlementStatusLabel(state.status)}</span></div><div className="sm:text-right">{state.status === 'ready' ? <button type="button" disabled={generatingRuleId === state.rule.id} onClick={() => void handleGenerateSettlement(state)} className="inline-flex h-8 items-center bg-[#1f65a7] px-3 font-medium text-white hover:bg-[#174f82] disabled:opacity-50">生成结转草稿</button> : state.voucher ? <button type="button" onClick={() => navigate(`/vouchers/detail/${state.voucher?.id}`)} className="inline-flex h-8 items-center border border-slate-300 px-3 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看凭证</button> : <span className="text-slate-400">无需操作</span>}</div></div>)}</div>}
        </section>
        <div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[6%] px-4 py-3 font-medium">顺序</th><th className="w-[18%] px-4 py-3 font-medium">检查项</th><th className="w-[14%] px-4 py-3 font-medium">数据来源</th><th className="w-[16%] px-4 py-3 font-medium">通过条件</th><th className="w-[12%] px-4 py-3 text-right font-medium">取数结果</th><th className="w-[18%] px-4 py-3 font-medium">检查说明</th><th className="w-[8%] px-4 py-3 font-medium">状态</th><th className="w-[8%] px-4 py-3 text-right font-medium">处理</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{checks.map((check) => <tr key={check.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3 tabular-nums">{check.order}</td><td className="px-4 py-3 font-medium">{check.title}</td><td className="truncate px-4 py-3" title={check.source}>{check.source}</td><td className="truncate px-4 py-3" title={check.condition}>{check.condition}</td><td className="px-4 py-3 text-right tabular-nums">{check.value}</td><td className="truncate px-4 py-3" title={check.detail}>{check.detail}</td><td className="px-4 py-3"><span className={`inline-flex border px-2 py-0.5 text-xs ${checkClass(check.status)}`}>{checkLabel(check.status)}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => navigate(check.path)} className="inline-flex h-7 items-center border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看</button></td></tr>)}</tbody></table></div>
        <div className="space-y-2 p-3 lg:hidden">{checks.map((check) => <article key={check.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">检查 {check.order} · {check.source}</p><h2 className="mt-1 text-sm font-medium">{check.title}</h2></div><span className={`shrink-0 border px-2 py-0.5 text-xs ${checkClass(check.status)}`}>{checkLabel(check.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><Info label="通过条件" value={check.condition} /><Info label="取数结果" value={check.value} /></div><p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{check.detail}</p><button type="button" onClick={() => navigate(check.path)} className="mt-3 inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看来源</button></article>)}</div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><span>当前账期：{periodLabel}</span><span>{isClosed ? '账期已锁定' : blockers.length ? `存在 ${blockers.length} 项阻断` : pending.length ? `仍有 ${pending.length} 项待取数` : '可人工确认结账'}</span></div>
      </>}
    </section>
  </main>
}

function Metric({ icon: Icon, label, value, tone = 'text-slate-900 dark:text-slate-100' }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return <div className="px-4 py-3"><div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">{value}</p></div>
}

function Placeholder({ message }: { message: string }) {
  return <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
}
