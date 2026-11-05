import {
  BadgeCheck,
  CircleAlert,
  FileCheck2,
  ReceiptText,
  RefreshCw,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { OperationalExportActions } from '../../components/operations/OperationalExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { automationApi, type TaxDeclarationTask } from '../../lib/api'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { confirmTaxDeclarationReview } from '../../lib/taxConfirmation.js'
import { useCompanyStore } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'

type TaxReportView =
  | 'overview'
  | 'vat'
  | 'withholding'
  | 'stamp'
  | 'income'
  | 'socialSecurity'
  | 'finance'
  | 'nonTax'
  | 'receipts'
type Column = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}
type TaskRow = {
  id: string
  primary: string
  secondary: string
  task: TaxDeclarationTask
  values: Record<string, string>
}
type MetricTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'
type Metric = {
  label: string
  value: string
  tone: MetricTone
  icon: LucideIcon
}

const viewDefinitions: Record<
  TaxReportView,
  {
    title: string
    description: string
    source: string
    empty: string
    columns: Column[]
  }
> = {
  overview: {
    title: '税务报表总览',
    description:
      '集中复核本期各税种的取数、校验、确认与应缴金额，按税表实际任务展示。',
    source: '本地税务申报任务与取数快照',
    empty: '当前账期没有税务申报任务。请在申报工作台完成初始化或导入后再查看。',
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'form', label: '申报表' },
      { key: 'source', label: '取数来源' },
      { key: 'taxable', label: '计税依据', align: 'right' },
      { key: 'deduction', label: '抵扣/减免', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'status', label: '校验状态', align: 'center' },
    ],
  },
  vat: {
    title: '增值税及附加',
    description:
      '只展示增值税及附加相关任务的计税依据、抵扣、应缴金额与发票取数快照。',
    source: '增值税及附加申报任务',
    empty: '当前账期没有增值税及附加申报任务。',
    columns: [
      { key: 'form', label: '申报表/栏次' },
      { key: 'source', label: '发票与取数来源' },
      { key: 'taxable', label: '计税依据', align: 'right' },
      { key: 'deduction', label: '抵扣/减免', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'risk', label: '风险', align: 'center' },
    ],
  },
  withholding: {
    title: '扣缴所得税',
    description:
      '只展示个税扣缴相关任务的工资取数、专项扣除校验与应缴金额，不在本页虚构员工明细。',
    source: '扣缴所得税申报任务',
    empty: '当前账期没有扣缴所得税申报任务。',
    columns: [
      { key: 'form', label: '扣缴申报表' },
      { key: 'source', label: '工资与扣除来源' },
      { key: 'taxable', label: '计税依据', align: 'right' },
      { key: 'deduction', label: '扣除金额', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'status', label: '校验状态', align: 'center' },
    ],
  },
  stamp: {
    title: '印花税',
    description:
      '只展示印花税任务关联的合同或单据取数快照、计税依据和人工校验状态。',
    source: '印花税申报任务',
    empty: '当前账期没有印花税申报任务。',
    columns: [
      { key: 'form', label: '税目/申报表' },
      { key: 'source', label: '合同与单据来源' },
      { key: 'taxable', label: '计税金额', align: 'right' },
      { key: 'payable', label: '应纳税额', align: 'right' },
      { key: 'risk', label: '资料校验', align: 'center' },
      { key: 'updated', label: '更新时间' },
    ],
  },
  income: {
    title: '企业所得税',
    description:
      '只展示企业所得税任务的利润、纳税调整取数快照与风险，纳税调整仍需人工确认。',
    source: '企业所得税申报任务',
    empty: '当前账期没有企业所得税申报任务。',
    columns: [
      { key: 'form', label: '申报表' },
      { key: 'source', label: '利润与调整来源' },
      { key: 'taxable', label: '应纳税所得额', align: 'right' },
      { key: 'deduction', label: '减免/弥补', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'risk', label: '复核状态', align: 'center' },
    ],
  },
  socialSecurity: {
    title: '社保费',
    description:
      '只展示社保费申报任务的人员、薪酬和基数取数快照，不在本页捏造人员缴费明细。',
    source: '社保费申报任务',
    empty: '当前账期没有社保费申报任务。',
    columns: [
      { key: 'form', label: '申报表' },
      { key: 'source', label: '人员与薪酬来源' },
      { key: 'taxable', label: '缴费基数', align: 'right' },
      { key: 'deduction', label: '减免金额', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'status', label: '校验状态', align: 'center' },
    ],
  },
  finance: {
    title: '财报报送',
    description: '只展示财务报表报送任务的报表来源、取数快照、校验和回执状态。',
    source: '财报报送任务',
    empty: '当前账期没有财报报送任务。',
    columns: [
      { key: 'form', label: '报送表' },
      { key: 'source', label: '来源报表' },
      { key: 'payable', label: '关键金额', align: 'right' },
      { key: 'status', label: '校验状态', align: 'center' },
      { key: 'receipt', label: '回执/附件' },
      { key: 'updated', label: '更新时间' },
    ],
  },
  nonTax: {
    title: '非税收入',
    description: '只展示已登记的非税缴费任务、计费依据、缴款状态与归档信息。',
    source: '非税收入申报任务',
    empty: '当前账期没有非税收入申报任务。',
    columns: [
      { key: 'taxType', label: '非税事项' },
      { key: 'form', label: '计费依据' },
      { key: 'taxable', label: '计费金额', align: 'right' },
      { key: 'payable', label: '应缴金额', align: 'right' },
      { key: 'payment', label: '缴费状态', align: 'center' },
      { key: 'receipt', label: '缴款书/回执' },
    ],
  },
  receipts: {
    title: '回执缴款书',
    description:
      '按申报任务查看本地确认、缴款书、回执号和收取时间；缺失信息会明确显示，避免伪造归档。',
    source: '申报回执与缴款本地记录',
    empty: '当前账期没有可展示的申报回执或缴款记录。',
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'form', label: '申报表' },
      { key: 'declaration', label: '申报状态', align: 'center' },
      { key: 'payment', label: '缴款状态', align: 'center' },
      { key: 'receipt', label: '回执号' },
      { key: 'receivedAt', label: '收取时间' },
    ],
  },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

function reportStatus(task: TaxDeclarationTask) {
  if (task.riskCount > 0 || task.validationStatus === 'failed') return '异常'
  if (task.validationStatus === 'passed') return '校验通过'
  return '待校验'
}

function receiptLabel(task: TaxDeclarationTask) {
  return task.receiptNo || '未收回执'
}

function includesTaxTask(view: TaxReportView, task: TaxDeclarationTask) {
  const text = `${task.taxType} ${task.formName}`
  if (view === 'overview' || view === 'receipts') return true
  if (view === 'vat') return /增值税|附加税/.test(text)
  if (view === 'withholding') return /扣缴|个税|个人所得税/.test(text)
  if (view === 'stamp') return /印花税/.test(text)
  if (view === 'income') return /企业所得税|所得税/.test(text)
  if (view === 'socialSecurity') return /社保|社会保险/.test(text)
  if (view === 'finance')
    return /财报|财务报表|资产负债|利润表|现金流/.test(text)
  return /非税|工会经费|残保金|水利建设/.test(text)
}

function taskRow(task: TaxDeclarationTask, view: TaxReportView): TaskRow {
  const status = reportStatus(task)
  return {
    id: task.id,
    primary: `${task.taxType} · ${task.formName}`,
    secondary: `${task.period} · ${status}`,
    task,
    values: {
      taxType: task.taxType,
      form: task.formName,
      source: task.sourceSnapshot || '未记录取数快照',
      taxable: formatCurrency(task.taxableAmount),
      deduction: formatCurrency(task.deductionAmount),
      payable: formatCurrency(task.payableAmount),
      status,
      risk:
        task.riskCount > 0
          ? `${task.riskCount} 项风险待复核`
          : status === '校验通过'
            ? '无风险'
            : '待校验',
      updated: task.updatedAt.replace('T', ' ').slice(0, 16),
      payment:
        task.paymentStatus === 'unrecorded'
          ? '未记录'
          : task.paymentStatus || '未记录',
      receipt: receiptLabel(task),
      declaration: task.declarationStatus || '未确认',
      receivedAt: task.receiptReceivedAt || task.confirmedAt || '未记录',
      view: viewDefinitions[view].title,
    },
  }
}

function canConfirm(task: TaxDeclarationTask) {
  return (
    task.validationStatus === 'passed' &&
    task.riskCount === 0 &&
    !['confirmed', 'archived', 'submitted', 'completed'].includes(
      task.declarationStatus.toLowerCase(),
    )
  )
}

function panelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

function TaxReportWorkspace({ view }: { view: TaxReportView }) {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  )
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const period = periods.find((item) => item.id === currentPeriodId)
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
    : ''
  const definition = viewDefinitions[view]
  const [tasks, setTasks] = useState<TaxDeclarationTask[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !periodLabel) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await automationApi.getTaxDeclarationTasks({ companyId: selectedCompanyId, period: periodLabel })
      if (!result.success)
        throw new Error(result.error || '未能读取税务申报任务')
      setTasks(result.data || [])
      setNotice(null)
    } catch (error) {
      setNotice(`读取税务报表失败：${String(error)}`)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [periodLabel, selectedCompanyId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(
    () =>
      tasks
        .filter((task) => includesTaxTask(view, task))
        .map((task) => taskRow(task, view)),
    [tasks, view],
  )
  const visibleRows = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [row.primary, row.secondary, ...Object.values(row.values)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [keyword, rows])
  const pagination = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  )
  const metrics = useMemo<Metric[]>(() => {
    const scopedTasks = rows.map((row) => row.task)
    const passed = scopedTasks.filter(
      (task) => reportStatus(task) === '校验通过',
    ).length
    const risk = scopedTasks.filter(
      (task) => reportStatus(task) === '异常',
    ).length
    const payable = scopedTasks.reduce(
      (sum, task) => sum + task.payableAmount,
      0,
    )
    const received = scopedTasks.filter((task) =>
      Boolean(task.receiptNo),
    ).length
    if (view === 'receipts')
      return [
        {
          label: '申报事项',
          value: `${scopedTasks.length} 项`,
          tone: scopedTasks.length ? 'sky' : 'slate',
          icon: ReceiptText,
        },
        {
          label: '已收回执',
          value: `${received} 项`,
          tone: received ? 'emerald' : 'slate',
          icon: FileCheck2,
        },
        {
          label: '待缴款',
          value: `${scopedTasks.filter((task) => task.paymentStatus === '待缴款').length} 项`,
          tone: 'amber',
          icon: CircleAlert,
        },
        {
          label: '异常任务',
          value: `${risk} 项`,
          tone: risk ? 'rose' : 'slate',
          icon: CircleAlert,
        },
      ]
    return [
      {
        label: view === 'overview' ? '本期税表' : '匹配任务',
        value: `${scopedTasks.length} 项`,
        tone: scopedTasks.length ? 'sky' : 'slate',
        icon: FileCheck2,
      },
      {
        label: '校验通过',
        value: `${passed} 项`,
        tone: passed ? 'emerald' : 'slate',
        icon: BadgeCheck,
      },
      {
        label: '应缴金额',
        value: formatCurrency(payable),
        tone: payable > 0 ? 'amber' : 'slate',
        icon: ReceiptText,
      },
      {
        label: '风险待复核',
        value: `${risk} 项`,
        tone: risk ? 'rose' : 'slate',
        icon: CircleAlert,
      },
    ]
  }, [rows, view])

  const confirmTask = useCallback(
    async (task: TaxDeclarationTask) => {
      if (!selectedCompanyId || !canConfirm(task)) return
      if (!confirmTaxDeclarationReview(task)) return
      setConfirmingId(task.id)
      try {
        const result = await automationApi.confirmTaxDeclarationTask({
          id: task.id,
          companyId: selectedCompanyId,
        })
        if (!result.success || !result.data)
          throw new Error(result.error || '本地确认失败')
        setTasks((items) =>
          items.map((item) =>
            item.id === result.data!.id ? result.data! : item,
          ),
        )
        setNotice(`已完成“${task.formName}”的本地确认；仍未向电子税务局提交。`)
      } catch (error) {
        setNotice(`确认申报任务失败：${String(error)}`)
      } finally {
        setConfirmingId(null)
      }
    },
    [selectedCompanyId],
  )

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{definition.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {definition.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${definition.title}清单`}
              companyName={selectedCompany?.name}
              periodLabel={periodLabel || undefined}
              exportHeaders={definition.columns.map((column) => column.label)}
              exportRows={visibleRows.map((row) =>
                definition.columns.map((column) => row.values[column.key] || '-'),
              )}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              重新取数
            </button>
          </div>
        </header>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
          税务报表页仅查询当前账套与账期；重新取数与本地确认不会向电子税务局提交申报或发起扣款。
        </div>
        {notice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            {notice}
          </div>
        )}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              取数范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || '未选择账套'} ·{' '}
              {periodLabel || '未选择账期'}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            数据来源：{definition.source}
          </p>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {visibleRows.length} 条任务记录
          </p>
          <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-80">
            <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
              placeholder="搜索税种、申报表或取数快照"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {!selectedCompanyId || !periodLabel ? (
          <EmptyState message="请选择账套和账期后读取税务申报任务。" />
        ) : loading ? (
          <EmptyState message="正在读取当前账期税务任务..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">{definition.title}清单</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                仅展示当前范围
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    {definition.columns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-3 py-3 font-medium ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="w-28 px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {definition.columns.map((column) => (
                        <td
                          key={column.key}
                          className={`truncate px-3 py-3 ${column.align === 'right' ? 'text-right tabular-nums' : column.align === 'center' ? 'text-center' : ''}`}
                          title={row.values[column.key]}
                        >
                          {row.values[column.key] || '-'}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">
                        {canConfirm(row.task) ? (
                          <button
                            type="button"
                            disabled={confirmingId === row.task.id}
                            onClick={() => void confirmTask(row.task)}
                            className="inline-flex items-center gap-1 text-[#1f65a7] hover:underline disabled:opacity-60 dark:text-sky-400"
                          >
                            <Send className="h-3.5 w-3.5" />
                            本地确认
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">
                            {row.task.receiptNo ? '已归档' : '待校验'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <EmptyState message={definition.empty} />
              )}
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {pagination.rows.map((row) => (
                <article
                  key={row.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold"
                        title={row.primary}
                      >
                        {row.primary}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.secondary}
                      </p>
                    </div>
                    {canConfirm(row.task) && (
                      <button
                        type="button"
                        disabled={confirmingId === row.task.id}
                        onClick={() => void confirmTask(row.task)}
                        className="shrink-0 text-xs text-[#1f65a7] disabled:opacity-60 dark:text-sky-400"
                      >
                        本地确认
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {definition.columns.map((column) => (
                      <Info
                        key={column.key}
                        label={column.label}
                        value={row.values[column.key] || '-'}
                      />
                    ))}
                  </div>
                </article>
              ))}
              {visibleRows.length === 0 && (
                <EmptyState message={definition.empty} />
              )}
            </div>
            <OperationalPagination
              page={pagination}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </section>
        )}
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              本地确认仅记录取数和人工复核结果。真实申报、扣款、回执下载和归档必须经合法税局
              adapter、授权登录与人工确认闭环。
            </p>
          </div>
        </footer>
      </section>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value, tone }: Metric) {
  const color = {
    sky: 'text-sky-700 dark:text-sky-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    slate: 'text-slate-700 dark:text-slate-200',
  }[tone]
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  )
}

export function TaxReportOverviewWorkspace() {
  return <TaxReportWorkspace view="overview" />
}
export function VatTaxReportWorkspace() {
  return <TaxReportWorkspace view="vat" />
}
export function WithholdingTaxReportWorkspace() {
  return <TaxReportWorkspace view="withholding" />
}
export function StampTaxReportWorkspace() {
  return <TaxReportWorkspace view="stamp" />
}
export function IncomeTaxReportWorkspace() {
  return <TaxReportWorkspace view="income" />
}
export function SocialSecurityTaxReportWorkspace() {
  return <TaxReportWorkspace view="socialSecurity" />
}
export function FinanceTaxReportWorkspace() {
  return <TaxReportWorkspace view="finance" />
}
export function NonTaxRevenueReportWorkspace() {
  return <TaxReportWorkspace view="nonTax" />
}
export function DeclarationReceiptWorkspace() {
  return <TaxReportWorkspace view="receipts" />
}
