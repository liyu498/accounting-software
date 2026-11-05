import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CircleAlert,
  FileSpreadsheet,
  Landmark,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AccountingReportExportActions } from '../../components/operations/AccountingReportExportActions'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { accountingStandardLabels } from '../../lib/constants'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import { ledgerClosingDirection } from '../../lib/reportLogic'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import {
  usePeriodStore,
  type GeneralLedgerItem,
  type TrialBalanceResult,
} from '../../stores/periodStore'

type LedgerView =
  | 'overview'
  | 'trialBalance'
  | 'accountSummary'
  | 'generalLedger'
  | 'multiColumn'

type ReportColumn = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

type ReportRow = {
  id: string
  primary: string
  secondary: string
  values: Record<string, string>
  voucherId?: string
}

type ViewDefinition = {
  title: string
  description: string
  source: string
  columns: ReportColumn[]
}

const views: Record<LedgerView, ViewDefinition> = {
  overview: {
    title: '账簿总览',
    description:
      '集中复核科目余额、发生额与期末方向，作为总账、明细账和辅助账的共同取数入口。',
    source: '科目余额试算数据',
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
  },
  trialBalance: {
    title: '科目余额表',
    description:
      '展示科目期初、本期发生与期末余额，并明确标示本期借贷试算是否平衡。',
    source: '科目余额试算数据',
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'openingDebit', label: '期初借方', align: 'right' },
      { key: 'openingCredit', label: '期初贷方', align: 'right' },
      { key: 'periodDebit', label: '本期借方', align: 'right' },
      { key: 'periodCredit', label: '本期贷方', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
  },
  accountSummary: {
    title: '科目汇总表',
    description:
      '按科目汇总已记账凭证的借贷发生额和凭证笔数，便于月末复核与装订。',
    source: '总账凭证发生额',
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'voucherCount', label: '凭证笔数', align: 'right' },
      { key: 'debit', label: '借方发生额', align: 'right' },
      { key: 'credit', label: '贷方发生额', align: 'right' },
      { key: 'direction', label: '期末方向', align: 'center' },
    ],
  },
  generalLedger: {
    title: '总账',
    description: '按科目展示期初、本期发生和期末余额，可进入关联凭证继续核对。',
    source: '总账科目汇总',
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'ending', label: '期末余额', align: 'right' },
    ],
  },
  multiColumn: {
    title: '多栏账',
    description:
      '按凭证摘要归集办公、差旅和薪酬等栏目；未匹配栏目会保留在待配置金额中。',
    source: '总账凭证分录',
    columns: [
      { key: 'subject', label: '科目' },
      { key: 'date', label: '日期' },
      { key: 'voucher', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'office', label: '办公费', align: 'right' },
      { key: 'travel', label: '差旅费', align: 'right' },
      { key: 'payroll', label: '工资薪酬', align: 'right' },
      { key: 'pending', label: '待配置', align: 'right' },
      { key: 'total', label: '合计', align: 'right' },
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

function balanceLabel(debit: number, credit: number) {
  if (debit > 0) return `借 ${formatCurrency(debit)}`
  if (credit > 0) return `贷 ${formatCurrency(credit)}`
  return formatCurrency(0)
}

function columnBucket(accountName: string, summary: string) {
  const text = `${accountName} ${summary}`
  if (/办公|文具|打印|快递/.test(text)) return 'office'
  if (/差旅|住宿|交通|出差/.test(text)) return 'travel'
  if (/工资|薪酬|社保|公积金/.test(text)) return 'payroll'
  return 'pending'
}

function trialRows(
  view: 'overview' | 'trialBalance',
  result: TrialBalanceResult | null,
): ReportRow[] {
  if (!result) return []
  return result.items.map((item) => ({
    id: `${view}-${item.account_code}`,
    primary: `${item.account_code} ${item.account_name}`,
    secondary: item.is_detail ? '明细科目' : '汇总科目',
    values:
      view === 'overview'
        ? {
            code: item.account_code,
            name: item.account_name,
            opening: balanceLabel(item.opening_debit, item.opening_credit),
            debit: formatCurrency(item.period_debit),
            credit: formatCurrency(item.period_credit),
            direction:
              item.closing_debit > 0
                ? '借'
                : item.closing_credit > 0
                  ? '贷'
                  : '-',
            ending: balanceLabel(item.closing_debit, item.closing_credit),
          }
        : {
            code: item.account_code,
            name: item.account_name,
            openingDebit: formatCurrency(item.opening_debit),
            openingCredit: formatCurrency(item.opening_credit),
            periodDebit: formatCurrency(item.period_debit),
            periodCredit: formatCurrency(item.period_credit),
            ending: balanceLabel(item.closing_debit, item.closing_credit),
          },
  }))
}

function generalRows(
  view: 'accountSummary' | 'generalLedger',
  items: GeneralLedgerItem[],
): ReportRow[] {
  return items.map((item) => ({
    id: `${view}-${item.account_code}`,
    primary: `${item.account_code} ${item.account_name}`,
    secondary: `${item.entries.length} 笔凭证发生`,
    voucherId: item.entries[0]?.voucher_id,
    values:
      view === 'accountSummary'
        ? {
            code: item.account_code,
            name: item.account_name,
            voucherCount: `${item.entries.length} 笔`,
            debit: formatCurrency(item.period_debit),
            credit: formatCurrency(item.period_credit),
            direction: ledgerClosingDirection(item),
          }
        : {
            code: item.account_code,
            name: item.account_name,
            opening: balanceLabel(item.opening_debit, item.opening_credit),
            debit: formatCurrency(item.period_debit),
            credit: formatCurrency(item.period_credit),
            direction:
              item.closing_debit > 0
                ? '借'
                : item.closing_credit > 0
                  ? '贷'
                  : '-',
            ending: balanceLabel(item.closing_debit, item.closing_credit),
          },
  }))
}

function multiColumnRows(items: GeneralLedgerItem[]): ReportRow[] {
  return items.flatMap((item) =>
    item.entries.map((entry, index) => {
      const sourceCode = entry.source_account_code || item.account_code
      const sourceName = entry.source_account_name || item.account_name
      const bucket = columnBucket(sourceName, entry.summary || '')
      const values = { office: '-', travel: '-', payroll: '-', pending: '-' }
      values[bucket] = formatCurrency(entry.amount)
      return {
        id: `multi-${sourceCode}-${entry.voucher_id}-${index}`,
        primary: `${sourceCode} ${sourceName}`,
        secondary: entry.summary || '未填写摘要',
        voucherId: entry.voucher_id,
        values: {
          subject: `${sourceCode} ${sourceName}`,
          date: entry.voucher_date || '-',
          voucher: entry.voucher_number || '未记录',
          summary: entry.summary || '未填写摘要',
          ...values,
          total: formatCurrency(entry.amount),
        },
      }
    }),
  )
}

function panelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

function LedgerReportWorkspace({ view }: { view: LedgerView }) {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  )
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance)
  const getGeneralLedger = usePeriodStore((state) => state.getGeneralLedger)
  const period = periods.find((item) => item.id === currentPeriodId)
  const periodId = currentPeriodId
  const definition = views[view]
  const needsTrialBalance = view === 'overview' || view === 'trialBalance'
  const needsGeneralLedger =
    view === 'accountSummary' ||
    view === 'generalLedger' ||
    view === 'multiColumn'
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(
    null,
  )
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !periodId) {
      setTrialBalance(null)
      setGeneralLedger([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (!isTauri) {
        setTrialBalance(null)
        setGeneralLedger([])
        setNotice(
          '浏览器预览不生成伪造账簿数据。选择实际账套和账期后在桌面应用中读取账簿。',
        )
        return
      }
      const [nextTrialBalance, nextGeneralLedger] = await Promise.all([
        needsTrialBalance ? fetchTrialBalance(periodId) : Promise.resolve(null),
        needsGeneralLedger
          ? getGeneralLedger(periodId)
          : Promise.resolve([] as GeneralLedgerItem[]),
      ])
      setTrialBalance(nextTrialBalance)
      setGeneralLedger(nextGeneralLedger)
      setNotice(null)
    } catch (error) {
      setNotice(`读取账簿失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [
    fetchTrialBalance,
    getGeneralLedger,
    needsGeneralLedger,
    needsTrialBalance,
    periodId,
    selectedCompanyId,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(() => {
    if (view === 'overview' || view === 'trialBalance')
      return trialRows(view, trialBalance)
    if (view === 'accountSummary' || view === 'generalLedger')
      return generalRows(view, generalLedger)
    return multiColumnRows(generalLedger)
  }, [generalLedger, trialBalance, view])
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
  const metrics = useMemo(() => {
    if (needsTrialBalance) {
      const debit = trialBalance?.total_period_debit || 0
      const credit = trialBalance?.total_period_credit || 0
      return [
        {
          label: '科目行数',
          value: `${trialBalance?.items.length || 0} 行`,
          tone: 'sky' as const,
          icon: BookOpenCheck,
        },
        {
          label: '本期借方',
          value: formatCurrency(debit),
          tone: 'emerald' as const,
          icon: Landmark,
        },
        {
          label: '本期贷方',
          value: formatCurrency(credit),
          tone: 'emerald' as const,
          icon: Landmark,
        },
        {
          label: '试算差异',
          value: formatCurrency(Math.abs(debit - credit)),
          tone: trialBalance?.is_balanced
            ? ('slate' as const)
            : ('rose' as const),
          icon: CircleAlert,
        },
      ]
    }
    const debit = generalLedger.reduce(
      (sum, item) => sum + item.period_debit,
      0,
    )
    const credit = generalLedger.reduce(
      (sum, item) => sum + item.period_credit,
      0,
    )
    const entries = generalLedger.reduce(
      (sum, item) => sum + item.entries.length,
      0,
    )
    return [
      {
        label: view === 'multiColumn' ? '栏目明细' : '总账科目',
        value:
          view === 'multiColumn'
            ? `${rows.length} 笔`
            : `${generalLedger.length} 个`,
        tone: 'sky' as const,
        icon: FileSpreadsheet,
      },
      {
        label: '凭证发生',
        value: `${entries} 笔`,
        tone: 'emerald' as const,
        icon: BookOpenCheck,
      },
      {
        label: '本期借方',
        value: formatCurrency(debit),
        tone: 'amber' as const,
        icon: Landmark,
      },
      {
        label: '本期贷方',
        value: formatCurrency(credit),
        tone: 'slate' as const,
        icon: BarChart3,
      },
    ]
  }, [generalLedger, needsTrialBalance, rows.length, trialBalance, view])

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{definition.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {definition.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AccountingReportExportActions
              title={definition.title}
              companyName={selectedCompany?.name}
              periodLabel={
                period
                  ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
                  : undefined
              }
              accountingStandard={accountingStandardLabels[selectedCompany?.accounting_system || '']}
              reportKind="ledger"
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
          账簿页仅查询当前账套与账期；取数、导出和凭证穿透均不修改原始凭证或账期状态。
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
              {period
                ? `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
                : '未选择账期'}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            数据来源：{definition.source}
          </p>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          {metrics.map((metric) => (
            <Metric key={metric.label} {...metric} />
          ))}
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {visibleRows.length} 条取数结果
          </p>
          <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-80">
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
              placeholder="搜索科目、凭证字号或摘要"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {!selectedCompanyId || !periodId ? (
          <EmptyState message="请选择账套和账期后读取账簿。" />
        ) : loading ? (
          <EmptyState message="正在读取当前账期账簿..." />
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
                    <th className="w-20 px-3 py-3 text-right font-medium">
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
                        {row.voucherId ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/vouchers/detail/${row.voucherId}`)
                            }
                            className="inline-flex items-center gap-1 text-[#1f65a7] hover:underline dark:text-sky-400"
                          >
                            凭证
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <EmptyState message="当前范围没有可展示的账簿记录。" />
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
                    {row.voucherId && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/vouchers/detail/${row.voucherId}`)
                        }
                        className="shrink-0 text-xs text-[#1f65a7] dark:text-sky-400"
                      >
                        凭证
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
                <EmptyState message="当前范围没有可展示的账簿记录。" />
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
              账簿结果用于核对与复核。发现试算不平、科目映射或栏目归集异常时，应回到凭证、科目或报表公式模块处理并保留修订记录。
            </p>
          </div>
        </footer>
      </section>
    </main>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'
}) {
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

export function LedgerOverviewWorkspace() {
  return <LedgerReportWorkspace view="overview" />
}
export function TrialBalanceWorkspace() {
  return <LedgerReportWorkspace view="trialBalance" />
}
export function AccountSummaryWorkspace() {
  return <LedgerReportWorkspace view="accountSummary" />
}
export function GeneralLedgerWorkspace() {
  return <LedgerReportWorkspace view="generalLedger" />
}
export function MultiColumnLedgerWorkspace() {
  return <LedgerReportWorkspace view="multiColumn" />
}
