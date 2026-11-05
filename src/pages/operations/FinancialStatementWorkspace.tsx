import {
  BarChart3,
  CircleAlert,
  FileSpreadsheet,
  History,
  Landmark,
  RefreshCw,
  Save,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountingReportExportActions } from '../../components/operations/AccountingReportExportActions'
import { buildBalanceSheetDualTable } from '../../lib/accountingReportExport'
import { OperationalPagination } from '../../components/operations/OperationalPagination'
import { accountingStandardLabels } from '../../lib/constants'
import { reportSnapshotApi, type ReportSnapshot } from '../../lib/api'
import { paginateOperationalRows } from '../../lib/operationalPagination'
import {
  aggregateCashFlowQuarter,
  aggregateIncomeQuarter,
  quarterPeriods,
} from '../../lib/reportLogic'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore } from '../../stores/companyStore'
import {
  usePeriodStore,
  type BalanceSheetItem,
  type BalanceSheetResult,
  type CashFlowResult,
  type EquityChangeResult,
  type IncomeStatementResult,
} from '../../stores/periodStore'

type FinancialView =
  | 'overview'
  | 'balanceSheet'
  | 'incomeStatement'
  | 'incomeQuarter'
  | 'cashFlow'
  | 'cashFlowQuarter'
  | 'equityChange'
type Column = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}
type ReportRow = {
  id: string
  primary: string
  secondary: string
  values: Record<string, string>
}
type MetricTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'
type Metric = {
  label: string
  value: string
  tone: MetricTone
  icon: LucideIcon
}

const snapshotTypeByView: Partial<Record<FinancialView, string>> = {
  balanceSheet: 'balance_sheet',
  incomeStatement: 'income_statement',
  incomeQuarter: 'income_quarter',
  cashFlow: 'cash_flow',
  cashFlowQuarter: 'cash_flow_quarter',
  equityChange: 'equity_change',
}

function snapshotItemAmount(item: Record<string, unknown>) {
  const values = [
    ['期末', item.ending_balance],
    ['本期', item.current_amount],
    ['本年累计', item.year_to_date],
    ['年末', item.ending_balance],
  ] as const
  return values
    .filter(([, value]) => typeof value === 'number')
    .map(([label, value]) => `${label} ${formatCurrency(value as number)}`)
    .join(' / ') || '-'
}

const viewDefinitions: Record<
  FinancialView,
  { title: string; description: string; source: string; columns: Column[] }
> = {
  overview: {
    title: '财务报表总览',
    description:
      '汇总当前账套账期的三张主表取数状态、关键金额与平衡校验，作为报表复核入口。',
    source: '资产负债表、利润表与现金流量表',
    columns: [
      { key: 'report', label: '报表' },
      { key: 'scope', label: '取数范围' },
      { key: 'keyAmount', label: '关键取数', align: 'right' },
      { key: 'status', label: '校验状态', align: 'center' },
    ],
  },
  balanceSheet: {
    title: '资产负债表',
    description:
      '按资产、负债和所有者权益项目展示期初与期末余额，并核对资产是否等于负债加权益。',
    source: '科目期末余额与报表公式',
    columns: [
      { key: 'section', label: '报表类别' },
      { key: 'code', label: '行次' },
      { key: 'name', label: '项目名称' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
      { key: 'change', label: '本期变动', align: 'right' },
    ],
  },
  incomeStatement: {
    title: '利润表',
    description:
      '展示收入、成本、费用与利润项目的本月和本年累计金额，供经营结果与所得税复核使用。',
    source: '损益类科目发生额与报表公式',
    columns: [
      { key: 'code', label: '行次' },
      { key: 'name', label: '项目名称' },
      { key: 'current', label: '本月金额', align: 'right' },
      { key: 'yearToDate', label: '本年累计', align: 'right' },
      { key: 'type', label: '项目类型', align: 'center' },
    ],
  },
  incomeQuarter: {
    title: '利润表季报',
    description:
      '汇总当前季度起始月至所选账期的损益发生额，并保留所选账期的本年累计口径。',
    source: '当前季度各月损益类科目发生额',
    columns: [
      { key: 'code', label: '行次' },
      { key: 'name', label: '项目名称' },
      { key: 'current', label: '本季度金额', align: 'right' },
      { key: 'yearToDate', label: '本年累计', align: 'right' },
      { key: 'type', label: '项目类型', align: 'center' },
    ],
  },
  cashFlow: {
    title: '现金流量表',
    description:
      '展示经营、投资和筹资活动的本期与本年累计现金流项目，保留报表公式取数边界。',
    source: '现金流量项目映射与凭证发生额',
    columns: [
      { key: 'code', label: '行次' },
      { key: 'name', label: '项目名称' },
      { key: 'current', label: '本期金额', align: 'right' },
      { key: 'yearToDate', label: '本年累计', align: 'right' },
      { key: 'type', label: '项目类型', align: 'center' },
    ],
  },
  cashFlowQuarter: {
    title: '现金流量表季报',
    description:
      '汇总当前季度起始月至所选账期的现金流项目，并保留所选账期的本年累计口径。',
    source: '当前季度各月现金流量项目映射与发生额',
    columns: [
      { key: 'code', label: '行次' },
      { key: 'name', label: '项目名称' },
      { key: 'current', label: '本季度金额', align: 'right' },
      { key: 'yearToDate', label: '本年累计', align: 'right' },
      { key: 'type', label: '项目类型', align: 'center' },
    ],
  },
  equityChange: {
    title: '权益变动',
    description:
      '按当前会计准则读取法定权益变动表；未配置法定模板时仅展示资产负债表派生的内部变动分析。',
    source: '资产负债表权益类项目',
    columns: [
      { key: 'code', label: '行次' },
      { key: 'name', label: '权益项目' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'change', label: '本期变动', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
      { key: 'type', label: '项目类型', align: 'center' },
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

function flattenBalanceItems(items: BalanceSheetItem[]): BalanceSheetItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenBalanceItems(item.children || []),
  ])
}

function balanceRows(result: BalanceSheetResult | null): ReportRow[] {
  if (!result) return []
  return flattenBalanceItems(result.items).map((item) => ({
    id: `balance-${item.item_code}-${item.item_level}`,
    primary: item.item_name,
    secondary: item.section || '未分类',
    values: {
      section: item.section || '未分类',
      code: item.line_number || item.item_code,
      name: item.item_name,
      opening: formatCurrency(item.opening_balance),
      ending: formatCurrency(item.ending_balance),
      change: formatCurrency(item.ending_balance - item.opening_balance),
    },
  }))
}

function incomeRows(
  result: IncomeStatementResult | null,
  view: 'incomeStatement' | 'incomeQuarter',
): ReportRow[] {
  if (!result) return []
  return result.items.map((item) => ({
    id: `${view}-${item.item_code}-${item.item_level}`,
    primary: item.item_name,
    secondary: item.is_total ? '汇总项目' : '明细项目',
    values: {
      code: item.line_number || item.item_code,
      name: item.item_name,
      current: formatCurrency(item.current_amount),
      yearToDate: formatCurrency(item.year_to_date),
      statementCurrent: formatCurrency(item.year_to_date),
      comparative: formatCurrency(item.comparative_amount),
      currentUnrestricted: formatCurrency(item.current_unrestricted_amount),
      currentRestricted: formatCurrency(item.current_restricted_amount),
      currentTotal: formatCurrency(item.current_amount),
      ytdUnrestricted: formatCurrency(item.ytd_unrestricted_amount),
      ytdRestricted: formatCurrency(item.ytd_restricted_amount),
      ytdTotal: formatCurrency(item.year_to_date),
      type: item.is_total ? '汇总' : '明细',
    },
  }))
}

function cashFlowRows(
  result: CashFlowResult | null,
  view: 'cashFlow' | 'cashFlowQuarter',
): ReportRow[] {
  if (!result) return []
  return result.items.map((item) => ({
    id: `${view}-${item.item_code}-${item.item_level}`,
    primary: item.item_name,
    secondary: item.is_total ? '汇总项目' : '明细项目',
    values: {
      code: item.line_number || item.item_code,
      name: item.item_name,
      current: formatCurrency(item.current_amount),
      yearToDate: formatCurrency(item.year_to_date),
      statementCurrent: formatCurrency(item.year_to_date),
      comparative: formatCurrency(item.comparative_amount),
      type: item.is_total ? '汇总' : '明细',
    },
  }))
}

function equityRows(result: BalanceSheetResult | null): ReportRow[] {
  if (!result) return []
  return flattenBalanceItems(result.items)
    .filter((item) =>
      /权益|资本|利润/.test(`${item.section} ${item.item_name}`),
    )
    .map((item) => ({
      id: `equity-${item.item_code}-${item.item_level}`,
      primary: item.item_name,
      secondary: item.is_total ? '汇总项目' : '明细项目',
      values: {
        code: item.line_number || item.item_code,
        name: item.item_name,
        opening: formatCurrency(item.opening_balance),
        change: formatCurrency(item.ending_balance - item.opening_balance),
        ending: formatCurrency(item.ending_balance),
        type: item.is_total ? '汇总' : '明细',
      },
    }))
}

function equityStatementRows(
  result: EquityChangeResult | null,
  amountPeriod: 'current' | 'comparative' = 'current',
): ReportRow[] {
  if (!result) return []
  return result.items.map((item) => ({
    id: `equity-statement-${item.item_code}`,
    primary: item.item_name,
    secondary: item.is_total ? '汇总项目' : '明细项目',
    values: {
      code: item.line_number || item.item_code,
      name: item.item_name,
      opening: formatCurrency(item.opening_balance),
      change: formatCurrency(item.current_increase - item.current_decrease),
      ending: formatCurrency(item.ending_balance),
      type: item.is_total ? '汇总' : '明细',
      ...Object.fromEntries(
        result.columns.map((column, index) => [
          column.column_code,
          formatCurrency(
            (amountPeriod === 'comparative'
              ? item.comparative_values[index]
              : item.values[index]) || 0,
          ),
        ]),
      ),
    },
  }))
}

function overviewRows(
  balance: BalanceSheetResult | null,
  income: IncomeStatementResult | null,
  cashFlow: CashFlowResult | null,
): ReportRow[] {
  return [
    balance && {
      id: 'overview-balance',
      primary: '资产负债表',
      secondary: '资产、负债与所有者权益',
      values: {
        report: '资产负债表',
        scope: '期初与期末余额',
        keyAmount: formatCurrency(balance.total_assets),
        status: balance.is_balanced ? '资产负债平衡' : '待复核',
      },
    },
    income && {
      id: 'overview-income',
      primary: income.template_name,
      secondary: '本期与本年累计损益',
      values: {
        report: income.template_name,
        scope: '损益发生额',
        keyAmount: formatCurrency(income.year_to_date_total),
        status: '已读取',
      },
    },
    cashFlow && {
      id: 'overview-cash-flow',
      primary: cashFlow.template_name,
      secondary: '本期与本年累计现金流',
      values: {
        report: cashFlow.template_name,
        scope: '现金流项目映射',
        keyAmount: formatCurrency(cashFlow.net_increase_year_to_date),
        status: '已读取',
      },
    },
  ].filter(Boolean) as ReportRow[]
}

function statementReportKind(
  result: { is_statutory: boolean; reporting_frequency: string },
  quarterly = false,
) {
  return result.is_statutory && (!quarterly || result.reporting_frequency.includes('季'))
    ? ('statutory_statement' as const)
    : ('management_statement' as const)
}

function panelClassName() {
  return 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]'
}

function FinancialStatementWorkspace({ view }: { view: FinancialView }) {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  )
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const getBalanceSheet = usePeriodStore((state) => state.getBalanceSheet)
  const getIncomeStatement = usePeriodStore((state) => state.getIncomeStatement)
  const getCashFlowStatement = usePeriodStore(
    (state) => state.getCashFlowStatement,
  )
  const getEquityChangeStatement = usePeriodStore(
    (state) => state.getEquityChangeStatement,
  )
  const period = periods.find((item) => item.id === currentPeriodId)
  const periodId = currentPeriodId
  const isQuarterly = view === 'incomeQuarter' || view === 'cashFlowQuarter'
  const reportPeriodLabel = period
    ? isQuarterly
      ? `${period.period_year}年第${Math.ceil(period.period_month / 3)}季度（截至${period.period_month}月）`
      : `${period.period_year}-${String(period.period_month).padStart(2, '0')}`
    : undefined
  const definition = viewDefinitions[view]
  const needsBalanceSheet = [
    'overview',
    'balanceSheet',
    'equityChange',
  ].includes(view)
  const needsIncomeStatement = [
    'overview',
    'incomeStatement',
    'incomeQuarter',
  ].includes(view)
  const needsCashFlow = ['overview', 'cashFlow', 'cashFlowQuarter'].includes(
    view,
  )
  const needsEquityChange = view === 'equityChange'
    && ['enterprise', 'cooperative'].includes(selectedCompany?.accounting_system || '')
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(
    null,
  )
  const [incomeStatement, setIncomeStatement] =
    useState<IncomeStatementResult | null>(null)
  const [cashFlowStatement, setCashFlowStatement] =
    useState<CashFlowResult | null>(null)
  const [equityChangeStatement, setEquityChangeStatement] =
    useState<EquityChangeResult | null>(null)
  const [equityAmountPeriod, setEquityAmountPeriod] = useState<'current' | 'comparative'>('current')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReportSnapshot | null>(null)
  const [publishing, setPublishing] = useState(false)
  const snapshotType = snapshotTypeByView[view] || null

  const loadSnapshots = useCallback(async () => {
    if (!isTauri || !selectedCompanyId || !periodId || !snapshotType) {
      setSnapshots([])
      setSelectedSnapshot(null)
      return
    }
    const result = await reportSnapshotApi.getReportSnapshots({
      companyId: selectedCompanyId,
      periodId,
      reportType: snapshotType,
    })
    if (!result.success) {
      setNotice(`读取报表历史版本失败：${result.error}`)
      return
    }
    setSnapshots(result.data || [])
    setSelectedSnapshot((current) =>
      current && result.data?.some((snapshot) => snapshot.id === current.id)
        ? current
        : null,
    )
  }, [periodId, selectedCompanyId, snapshotType])

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !periodId) {
      setBalanceSheet(null)
      setIncomeStatement(null)
      setCashFlowStatement(null)
      setEquityChangeStatement(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (!isTauri) {
        setBalanceSheet(null)
        setIncomeStatement(null)
        setCashFlowStatement(null)
        setEquityChangeStatement(null)
        setNotice(
          '浏览器预览不生成伪造报表数据。选择实际账套和账期后在桌面应用中读取报表。',
        )
        return
      }
      const currentQuarterPeriods = quarterPeriods(periods, periodId)
      const quarterPeriodIds = currentQuarterPeriods.length > 0
        ? currentQuarterPeriods.map((item) => item.id)
        : [periodId]
      const incomePeriodIds = view === 'incomeQuarter' ? quarterPeriodIds : [periodId]
      const cashFlowPeriodIds = view === 'cashFlowQuarter' ? quarterPeriodIds : [periodId]
      const [nextBalanceSheet, nextIncomeStatements, nextCashFlowStatements, nextEquityChange] =
        await Promise.all([
          needsBalanceSheet ? getBalanceSheet(periodId) : Promise.resolve(null),
          needsIncomeStatement
            ? Promise.all(incomePeriodIds.map((id) => getIncomeStatement(id)))
            : Promise.resolve([] as IncomeStatementResult[]),
          needsCashFlow
            ? Promise.all(cashFlowPeriodIds.map((id) => getCashFlowStatement(id)))
            : Promise.resolve([] as CashFlowResult[]),
          needsEquityChange
            ? getEquityChangeStatement(periodId)
            : Promise.resolve(null),
        ])
      setBalanceSheet(nextBalanceSheet)
      setIncomeStatement(
        view === 'incomeQuarter'
          ? aggregateIncomeQuarter(nextIncomeStatements)
          : nextIncomeStatements[0] || null,
      )
      setCashFlowStatement(
        view === 'cashFlowQuarter'
          ? aggregateCashFlowQuarter(nextCashFlowStatements)
          : nextCashFlowStatements[0] || null,
      )
      setEquityChangeStatement(nextEquityChange)
      setNotice(null)
    } catch (error) {
      setNotice(`读取财务报表失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [
    getBalanceSheet,
    getCashFlowStatement,
    getIncomeStatement,
    getEquityChangeStatement,
    needsBalanceSheet,
    needsCashFlow,
    needsIncomeStatement,
    needsEquityChange,
    periodId,
    periods,
    selectedCompanyId,
    view,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setHistoryOpen(false)
    void loadSnapshots()
  }, [loadSnapshots])

  useEffect(() => {
    if (
      equityAmountPeriod === 'comparative'
      && !equityChangeStatement?.has_comparative_period
    ) {
      setEquityAmountPeriod('current')
    }
  }, [equityAmountPeriod, equityChangeStatement?.has_comparative_period])

  const displayColumns = useMemo<Column[]>(() => {
    if (
      view === 'equityChange'
      && equityChangeStatement?.layout === 'statutory_matrix'
    ) {
      return [
        { key: 'name', label: '项目' },
        { key: 'code', label: '行次', align: 'center' },
        ...equityChangeStatement.columns.map((column) => ({
          key: column.column_code,
          label: column.column_name,
          align: 'right' as const,
        })),
      ]
    }
    if (
      view === 'incomeStatement'
      && incomeStatement?.column_basis === 'nonprofit_activity_matrix'
    ) {
      return [
        { key: 'name', label: '项目' },
        { key: 'code', label: '行次', align: 'center' },
        { key: 'currentUnrestricted', label: '本月非限定性', align: 'right' },
        { key: 'currentRestricted', label: '本月限定性', align: 'right' },
        { key: 'currentTotal', label: '本月合计', align: 'right' },
        { key: 'ytdUnrestricted', label: '累计非限定性', align: 'right' },
        { key: 'ytdRestricted', label: '累计限定性', align: 'right' },
        { key: 'ytdTotal', label: '累计合计', align: 'right' },
      ]
    }
    if (
      view === 'incomeStatement'
      && incomeStatement?.column_basis === 'current_comparative'
    ) {
      return [
        { key: 'code', label: '行次', align: 'center' },
        { key: 'name', label: '项目' },
        { key: 'statementCurrent', label: '本期金额', align: 'right' },
        { key: 'comparative', label: '上期金额', align: 'right' },
        { key: 'type', label: '项目类型', align: 'center' },
      ]
    }
    if (
      view === 'cashFlow'
      && cashFlowStatement?.column_basis === 'current_comparative'
    ) {
      return [
        { key: 'code', label: '行次', align: 'center' },
        { key: 'name', label: '项目' },
        { key: 'statementCurrent', label: '本期金额', align: 'right' },
        { key: 'comparative', label: '上期金额', align: 'right' },
        { key: 'type', label: '项目类型', align: 'center' },
      ]
    }
    return definition.columns
  }, [cashFlowStatement, definition.columns, equityChangeStatement, incomeStatement, view])

  const rows = useMemo(() => {
    if (view === 'overview')
      return overviewRows(balanceSheet, incomeStatement, cashFlowStatement)
    if (view === 'balanceSheet') return balanceRows(balanceSheet)
    if (view === 'incomeStatement' || view === 'incomeQuarter')
      return incomeRows(incomeStatement, view)
    if (view === 'cashFlow' || view === 'cashFlowQuarter')
      return cashFlowRows(cashFlowStatement, view)
    return equityChangeStatement
      ? equityStatementRows(equityChangeStatement, equityAmountPeriod)
      : equityRows(balanceSheet)
  }, [balanceSheet, cashFlowStatement, equityAmountPeriod, equityChangeStatement, incomeStatement, view])
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
  const accountingExport = useMemo(() => {
    const equityAnalysisTitle = selectedCompany?.accounting_system === 'non_profit'
      ? '净资产变动分析'
      : selectedCompany?.accounting_system === 'cooperative'
        ? '成员权益变动分析'
        : '所有者权益变动分析'
    const fallback = {
      title: view === 'equityChange' ? equityAnalysisTitle : definition.title,
      accountingStandard: accountingStandardLabels[selectedCompany?.accounting_system || ''],
      formCode: null as string | null,
      reportKind: 'management_statement' as const,
      layout: 'standard_table' as const,
      headers: displayColumns.map((column) => column.label),
      rows: visibleRows.map((row) =>
        displayColumns.map((column) => row.values[column.key] || '-'),
      ) as Array<Array<string | number>>,
    }
    if (view === 'balanceSheet' && balanceSheet) {
      const rightHeader = balanceSheet.accounting_system === 'non_profit'
        ? '负债和净资产'
        : balanceSheet.accounting_system === 'cooperative'
          ? '负债和成员权益'
          : '负债和所有者权益'
      const table = buildBalanceSheetDualTable(
        flattenBalanceItems(balanceSheet.items).map((item) => ({
          section: item.section,
          name: item.item_name,
          lineNumber: item.line_number || item.item_code,
          closingBalance: item.ending_balance,
          openingBalance: item.opening_balance,
        })),
        rightHeader,
      )
      return {
        title: balanceSheet.template_name,
        accountingStandard: accountingStandardLabels[balanceSheet.accounting_system] || balanceSheet.accounting_system,
        formCode: balanceSheet.form_code,
        reportKind: statementReportKind(balanceSheet),
        layout: 'balance_sheet_dual' as const,
        headers: table.headers,
        rows: table.rows,
      }
    }
    if (view === 'equityChange' && equityChangeStatement) {
      if (equityChangeStatement.layout === 'statutory_matrix') {
        const componentHeaders = equityChangeStatement.columns.map((column) => column.column_name)
        const currentStartColumn = 2
        const currentEndColumn = currentStartColumn + componentHeaders.length - 1
        const comparativeStartColumn = currentEndColumn + 1
        const comparativeEndColumn = comparativeStartColumn + componentHeaders.length - 1
        return {
          title: equityChangeStatement.template_name,
          accountingStandard: accountingStandardLabels[equityChangeStatement.accounting_system]
            || equityChangeStatement.accounting_system,
          formCode: equityChangeStatement.form_code,
          reportKind: statementReportKind(equityChangeStatement),
          layout: 'equity_change_matrix' as const,
          headers: ['项目', '行次', ...componentHeaders, ...componentHeaders],
          headerGroups: [
            { label: '本年金额', startColumn: currentStartColumn, endColumn: currentEndColumn },
            { label: '上年金额', startColumn: comparativeStartColumn, endColumn: comparativeEndColumn },
          ],
          rows: equityChangeStatement.items.map((item) => [
            item.item_name,
            item.line_number || item.item_code,
            ...item.values,
            ...item.comparative_values,
          ]),
        }
      }
      return {
        title: equityChangeStatement.template_name,
        accountingStandard: accountingStandardLabels[equityChangeStatement.accounting_system]
          || equityChangeStatement.accounting_system,
        formCode: equityChangeStatement.form_code,
        reportKind: statementReportKind(equityChangeStatement),
        layout: 'standard_table' as const,
        headers: ['项目', '行次', '年初余额', '本年增加额', '本年减少额', '年末余额'],
        rows: equityChangeStatement.items.map((item) => [
          item.item_name,
          item.line_number || item.item_code,
          item.opening_balance,
          item.current_increase,
          item.current_decrease,
          item.ending_balance,
        ]),
      }
    }
    if ((view === 'incomeStatement' || view === 'incomeQuarter') && incomeStatement) {
      const quarterly = view === 'incomeQuarter'
      const comparative = !quarterly && incomeStatement.column_basis === 'current_comparative'
      if (!quarterly && incomeStatement.column_basis === 'nonprofit_activity_matrix') {
        return {
          title: incomeStatement.template_name,
          accountingStandard: accountingStandardLabels[incomeStatement.accounting_system]
            || incomeStatement.accounting_system,
          formCode: incomeStatement.form_code,
          reportKind: statementReportKind(incomeStatement),
          layout: 'income_activity_matrix' as const,
          headers: ['项目', '行次', '非限定性', '限定性', '合计', '非限定性', '限定性', '合计'],
          headerGroups: [
            { label: '本月数', startColumn: 2, endColumn: 4 },
            { label: '本年累计数', startColumn: 5, endColumn: 7 },
          ],
          rows: incomeStatement.items.map((item) => [
            item.item_name,
            item.line_number || item.item_code,
            item.current_unrestricted_amount,
            item.current_restricted_amount,
            item.current_amount,
            item.ytd_unrestricted_amount,
            item.ytd_restricted_amount,
            item.year_to_date,
          ]),
        }
      }
      return {
        title: quarterly ? `${incomeStatement.template_name}季报` : incomeStatement.template_name,
        accountingStandard: accountingStandardLabels[incomeStatement.accounting_system] || incomeStatement.accounting_system,
        formCode: quarterly && !incomeStatement.reporting_frequency.includes('季') ? null : incomeStatement.form_code,
        reportKind: statementReportKind(incomeStatement, quarterly),
        layout: 'standard_table' as const,
        headers: comparative
          ? ['项目', '行次', '本期金额', '上期金额']
          : ['项目', '行次', quarterly ? '本季度金额' : '本月金额', '本年累计金额'],
        rows: incomeStatement.items.map((item) => [
          item.item_name,
          item.line_number || item.item_code,
          comparative ? item.year_to_date : item.current_amount,
          comparative ? item.comparative_amount : item.year_to_date,
        ]),
      }
    }
    if ((view === 'cashFlow' || view === 'cashFlowQuarter') && cashFlowStatement) {
      const quarterly = view === 'cashFlowQuarter'
      const comparative = !quarterly && cashFlowStatement.column_basis === 'current_comparative'
      return {
        title: quarterly ? `${cashFlowStatement.template_name}季报` : cashFlowStatement.template_name,
        accountingStandard: accountingStandardLabels[cashFlowStatement.accounting_system] || cashFlowStatement.accounting_system,
        formCode: quarterly && !cashFlowStatement.reporting_frequency.includes('季') ? null : cashFlowStatement.form_code,
        reportKind: statementReportKind(cashFlowStatement, quarterly),
        layout: 'standard_table' as const,
        headers: comparative
          ? ['项目', '行次', '本期金额', '上期金额']
          : ['项目', '行次', quarterly ? '本季度金额' : '本期金额', '本年累计金额'],
        rows: cashFlowStatement.items.map((item) => [
          item.item_name,
          item.line_number || item.item_code,
          comparative ? item.year_to_date : item.current_amount,
          comparative ? item.comparative_amount : item.year_to_date,
        ]),
      }
    }
    return fallback
  }, [
    balanceSheet,
    cashFlowStatement,
    displayColumns,
    definition.title,
    equityChangeStatement,
    incomeStatement,
    selectedCompany?.accounting_system,
    view,
    visibleRows,
  ])
  const canPublishSnapshot = Boolean(
    isTauri
      && selectedCompanyId
      && periodId
      && snapshotType
      && accountingExport.reportKind === 'statutory_statement'
      && !loading,
  )
  const publishSnapshot = useCallback(async () => {
    if (!selectedCompanyId || !periodId || !snapshotType || !canPublishSnapshot) return
    if (!window.confirm('发布后该版本将保持只读。确认按服务端当前取数结果发布报表快照？')) return
    setPublishing(true)
    try {
      const result = await reportSnapshotApi.publishReportSnapshot({
        companyId: selectedCompanyId,
        periodId,
        reportType: snapshotType,
      })
      if (!result.success || !result.data) {
        setNotice(`发布报表快照失败：${result.error || '未知错误'}`)
        return
      }
      setNotice(`已发布 ${result.data.templateName} 第 ${result.data.version} 版快照。`)
      setSelectedSnapshot(result.data)
      setHistoryOpen(true)
      await loadSnapshots()
    } finally {
      setPublishing(false)
    }
  }, [canPublishSnapshot, loadSnapshots, periodId, selectedCompanyId, snapshotType])
  const openSnapshot = useCallback(async (snapshotId: string) => {
    if (!selectedCompanyId) return
    const result = await reportSnapshotApi.getReportSnapshot({
      id: snapshotId,
      companyId: selectedCompanyId,
    })
    if (!result.success || !result.data) {
      setNotice(`打开报表历史版本失败：${result.error || '未知错误'}`)
      return
    }
    setSelectedSnapshot(result.data)
  }, [selectedCompanyId])
  const selectedSnapshotItems = useMemo(() => {
    if (!selectedSnapshot) return [] as Array<Record<string, unknown>>
    try {
      const payload = JSON.parse(selectedSnapshot.snapshotJson) as {
        report?: { items?: Array<Record<string, unknown>> }
      }
      return Array.isArray(payload.report?.items) ? payload.report.items : []
    } catch {
      return [] as Array<Record<string, unknown>>
    }
  }, [selectedSnapshot])
  const reportDescription = view === 'equityChange'
    ? equityChangeStatement
      ? equityChangeStatement.layout === 'statutory_matrix'
        ? '一般企业按会企 04 表分权益组成项目展示本年金额与上年金额，并分别勾稽年初、变动和年末余额。'
        : '合作社账套按法定会农社 03 表读取成员权益年初、增加、减少和年末金额。'
      : '当前准则未配置法定权益变动模板，本页仅基于资产负债表权益项目生成内部管理分析。'
    : view === 'incomeStatement' && incomeStatement?.column_basis === 'nonprofit_activity_matrix'
      ? '民间非营利组织按会民非 02 表分别展示本月与本年累计的非限定性、限定性和合计金额。'
      : definition.description
  const pagination = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  )
  const metrics = useMemo<Metric[]>(() => {
    if (view === 'overview') {
      const reportCount = [
        balanceSheet,
        incomeStatement,
        cashFlowStatement,
      ].filter(Boolean).length
      return [
        {
          label: '已读取报表',
          value: `${reportCount} / 3 份`,
          tone: reportCount === 3 ? 'emerald' : 'amber',
          icon: FileSpreadsheet,
        },
        {
          label: '资产总额',
          value: formatCurrency(balanceSheet?.total_assets || 0),
          tone: 'sky',
          icon: Landmark,
        },
        {
          label: '本年累计利润',
          value: formatCurrency(incomeStatement?.year_to_date_total || 0),
          tone: 'emerald',
          icon: BarChart3,
        },
        {
          label: '现金净增加额',
          value: formatCurrency(
            cashFlowStatement?.net_increase_year_to_date || 0,
          ),
          tone: 'slate',
          icon: CircleAlert,
        },
      ]
    }
    if (view === 'balanceSheet' || view === 'equityChange') {
      const openingEquity = balanceSheet?.opening_total_equity || 0
      const endingEquity = balanceSheet?.total_equity || 0
      return [
        {
          label: '资产总额',
          value: formatCurrency(balanceSheet?.total_assets || 0),
          tone: 'sky',
          icon: Landmark,
        },
        {
          label: '负债总额',
          value: formatCurrency(balanceSheet?.total_liabilities || 0),
          tone: 'amber',
          icon: CircleAlert,
        },
        {
          label: '权益期末额',
          value: formatCurrency(endingEquity),
          tone: 'emerald',
          icon: FileSpreadsheet,
        },
        {
          label: view === 'equityChange' ? '权益本期变动' : '报表平衡',
          value:
            view === 'equityChange'
              ? formatCurrency(endingEquity - openingEquity)
              : balanceSheet?.is_balanced
                ? '已平衡'
                : '待复核',
          tone: balanceSheet?.is_balanced ? 'slate' : 'rose',
          icon: CircleAlert,
        },
      ]
    }
    if (view === 'incomeStatement' || view === 'incomeQuarter') {
      return [
        {
          label: '报表项目',
          value: `${incomeStatement?.items.length || 0} 项`,
          tone: 'sky',
          icon: FileSpreadsheet,
        },
        {
          label: view === 'incomeQuarter' ? '本季度结果' : '本期结果',
          value: formatCurrency(
            view === 'incomeStatement' && incomeStatement?.column_basis === 'current_comparative'
              ? incomeStatement.year_to_date_total
              : incomeStatement?.current_period_total || 0,
          ),
          tone: 'emerald',
          icon: BarChart3,
        },
        {
          label: view === 'incomeStatement' && incomeStatement?.column_basis === 'current_comparative'
            ? '上期金额'
            : '本年累计',
          value: formatCurrency(
            view === 'incomeStatement' && incomeStatement?.column_basis === 'current_comparative'
              ? incomeStatement.comparative_period_total
              : incomeStatement?.year_to_date_total || 0,
          ),
          tone: 'emerald',
          icon: Landmark,
        },
        {
          label: '口径',
          value: view === 'incomeQuarter'
            ? '季度复核'
            : incomeStatement?.column_basis === 'current_comparative'
              ? '法定比较列'
              : '月度复核',
          tone: 'slate',
          icon: CircleAlert,
        },
      ]
    }
    return [
      {
        label: '报表项目',
        value: `${cashFlowStatement?.items.length || 0} 项`,
        tone: 'sky',
        icon: FileSpreadsheet,
      },
      {
        label: view === 'cashFlowQuarter' ? '本季度净增加额' : '本期净增加额',
          value: formatCurrency(
            view === 'cashFlow' && cashFlowStatement?.column_basis === 'current_comparative'
              ? cashFlowStatement.net_increase_year_to_date
              : cashFlowStatement?.net_increase || 0,
          ),
        tone: 'emerald',
        icon: BarChart3,
      },
      {
          label: view === 'cashFlow' && cashFlowStatement?.column_basis === 'current_comparative'
            ? '上期净增加额'
            : '本年累计净增加额',
        value: formatCurrency(
            view === 'cashFlow' && cashFlowStatement?.column_basis === 'current_comparative'
              ? cashFlowStatement.net_increase_comparative
              : cashFlowStatement?.net_increase_year_to_date || 0,
        ),
        tone: 'emerald',
        icon: Landmark,
      },
      {
        label: '现金勾稽',
        value: cashFlowStatement?.is_reconciled
          ? '已勾稽'
          : `差额 ${formatCurrency(Math.abs(cashFlowStatement?.reconciliation_difference || 0))}`,
        tone: cashFlowStatement?.is_reconciled ? 'slate' : 'rose',
        icon: CircleAlert,
      },
    ]
  }, [balanceSheet, cashFlowStatement, incomeStatement, view])

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{accountingExport.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {reportDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshotType && (
              <>
                <button
                  type="button"
                  onClick={() => void publishSnapshot()}
                  disabled={!canPublishSnapshot || publishing}
                  title={accountingExport.reportKind === 'statutory_statement'
                    ? '按服务端当前取数结果发布不可变版本'
                    : '内部管理分析不能发布为法定报表快照'}
                  className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Save className="h-3.5 w-3.5" />
                  {publishing ? '发布中' : '发布快照'}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((open) => !open)}
                  disabled={!isTauri || !selectedCompanyId || !periodId}
                  className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <History className="h-3.5 w-3.5" />
                  历史版本{snapshots.length > 0 ? ` ${snapshots.length}` : ''}
                </button>
              </>
            )}
            <AccountingReportExportActions
              title={accountingExport.title}
              companyName={selectedCompany?.name}
              periodLabel={reportPeriodLabel}
              accountingStandard={accountingExport.accountingStandard}
              formCode={accountingExport.formCode}
              reportKind={accountingExport.reportKind}
              layout={accountingExport.layout}
              exportHeaders={accountingExport.headers}
              headerGroups={'headerGroups' in accountingExport ? accountingExport.headerGroups : undefined}
              exportRows={accountingExport.rows}
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
          报表页仅查询当前账套与账期；重新取数、查看报表和导出准备均不修改凭证或账期状态。{accountingExport.reportKind === 'management_statement' ? ' 当前页面为内部管理分析，不作为法定报送表。' : ''}
        </div>
        {notice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            {notice}
          </div>
        )}
        {historyOpen && snapshotType && (
          <section className="grid min-w-0 border-b border-slate-200 dark:border-slate-800 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="border-b border-slate-200 p-3 dark:border-slate-800 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">历史版本</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {snapshots.length} 版
                </span>
              </div>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {snapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    type="button"
                    onClick={() => void openSnapshot(snapshot.id)}
                    className={`block w-full border px-3 py-2 text-left text-xs ${selectedSnapshot?.id === snapshot.id
                      ? 'border-[#1f65a7] bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'}`}
                  >
                    <span className="flex items-center justify-between gap-2 font-medium">
                      <span>第 {snapshot.version} 版</span>
                      <span>{snapshot.generatedBy}</span>
                    </span>
                    <span className="mt-1 block text-slate-500 dark:text-slate-400">
                      {new Date(snapshot.publishedAt).toLocaleString('zh-CN')}
                    </span>
                  </button>
                ))}
                {snapshots.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    当前范围尚未发布快照。
                  </p>
                )}
              </div>
            </div>
            <div className="min-w-0 p-3">
              {selectedSnapshot ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {selectedSnapshot.templateName} · 第 {selectedSnapshot.version} 版
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        只读快照 · 发布人 {selectedSnapshot.generatedBy}
                      </p>
                    </div>
                    <div className="max-w-full text-right text-[11px] text-slate-500 dark:text-slate-400">
                      <p className="break-all">来源指纹：{selectedSnapshot.sourceFingerprint}</p>
                      <p className="mt-1 break-all">模板指纹：{selectedSnapshot.templateFingerprint || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 max-h-64 overflow-auto border border-slate-200 dark:border-slate-800">
                    <table className="w-full table-fixed text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">项目</th>
                          <th className="px-3 py-2 font-medium">行次</th>
                          <th className="px-3 py-2 text-right font-medium">快照金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedSnapshotItems.map((item, index) => (
                          <tr key={`${String(item.item_code || index)}-${index}`}>
                            <td className="break-words px-3 py-2">{String(item.item_name || '-')}</td>
                            <td className="break-words px-3 py-2">{String(item.line_number || item.item_code || '-')}</td>
                            <td className="break-words px-3 py-2 text-right tabular-nums">{snapshotItemAmount(item)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedSnapshotItems.length === 0 && (
                      <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        该版本没有可展示的报表项目。
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  选择一个版本查看只读快照内容。
                </p>
              )}
            </div>
          </section>
        )}
        {view === 'incomeStatement'
          && incomeStatement?.column_basis === 'current_comparative'
          && !incomeStatement.has_comparative_period && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              当前账套缺少上年同期账期，“上期金额”暂按零展示；补齐同期账期及凭证后再用于法定报送。
            </div>
          )}
        {view === 'incomeStatement'
          && incomeStatement?.column_basis === 'nonprofit_activity_matrix'
          && !incomeStatement.classification_complete && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              当前发生额中存在未明确标注“限定性”或“非限定性”的末级科目，系统暂将未分类金额列入非限定性以保持合计一致；法定报送前请补充分栏明细科目并重新取数。
            </div>
          )}
        {view === 'cashFlow'
          && cashFlowStatement?.column_basis === 'current_comparative'
          && !cashFlowStatement.has_comparative_period && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              当前账套缺少上年同期账期，现金流量表“上期金额”暂按零展示；补齐同期账期及凭证后再用于法定报送。
            </div>
          )}
        {(view === 'cashFlow' || view === 'cashFlowQuarter') &&
          cashFlowStatement &&
          cashFlowStatement.classification_mode === 'account_formula' && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              当前现金流项目采用科目公式估算，尚未启用凭证映射；请在现金流量映射中按来源科目、现金方向和报表项目配置后复核。
            </div>
          )}
        {view === 'equityChange'
          && equityChangeStatement?.layout === 'statutory_matrix'
          && !equityChangeStatement.classification_complete && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              权益组成项目的年初、变动和年末金额已勾稽，但本年变动原因尚未完成凭证级分类；导出前请复核综合收益、投入资本、利润分配和内部结转明细。
            </div>
          )}
        {view === 'equityChange'
          && equityChangeStatement?.layout === 'statutory_matrix'
          && !equityChangeStatement.has_comparative_period && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              当前账套缺少上年同期账期，“上年金额”暂按零展示；补齐上年同期余额及凭证后再用于法定报送。
            </div>
          )}
        {view === 'equityChange'
          && equityChangeStatement?.layout === 'statutory_matrix'
          && equityChangeStatement.has_comparative_period
          && !equityChangeStatement.comparative_classification_complete && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              上年权益变动金额已读取，但上年变动原因仍有未映射凭证；导出前请在权益变动映射中补齐分类。
            </div>
          )}
        {(view === 'cashFlow' || view === 'cashFlowQuarter') &&
          cashFlowStatement &&
          cashFlowStatement.classification_mode === 'voucher_mapping' &&
          !cashFlowStatement.is_classification_complete && (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
              凭证映射尚未完整：未映射现金{' '}
              {formatCurrency(cashFlowStatement.unmapped_cash_amount)}，涉及{' '}
              {cashFlowStatement.unmapped_voucher_count} 张凭证
              {cashFlowStatement.mapping_conflict_count > 0
                ? `，其中 ${cashFlowStatement.mapping_conflict_count} 张存在同优先级映射冲突`
                : ''}
              。补齐或调整映射后再报送。
            </div>
          )}
        {(view === 'cashFlow' || view === 'cashFlowQuarter') &&
          cashFlowStatement &&
          !cashFlowStatement.is_reconciled && (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
              现金流项目净额与现金及现金等价物余额变动不一致，差额为{' '}
              {formatCurrency(Math.abs(cashFlowStatement.reconciliation_difference))}；请补充现金流量映射或复核凭证分类后再报送。
            </div>
          )}
        {(view === 'cashFlow' || view === 'cashFlowQuarter') &&
          cashFlowStatement?.classification_mode === 'voucher_mapping' &&
          cashFlowStatement.is_classification_complete && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
              现金流量表已按已审核凭证映射取数，当前范围内无未映射现金凭证。
            </div>
          )}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              取数范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || '未选择账套'} ·{' '}
              {reportPeriodLabel || '未选择账期'}
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
            {visibleRows.length} 条报表项目
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          {view === 'equityChange' && equityChangeStatement?.layout === 'statutory_matrix' && (
            <div className="inline-flex h-8 shrink-0 border border-slate-300 p-0.5 text-xs dark:border-slate-700" aria-label="权益变动金额期间">
              {(['current', 'comparative'] as const).map((amountPeriod) => <button
                key={amountPeriod}
                type="button"
                onClick={() => setEquityAmountPeriod(amountPeriod)}
                disabled={amountPeriod === 'comparative' && !equityChangeStatement.has_comparative_period}
                className={`px-3 ${equityAmountPeriod === amountPeriod ? 'bg-[#1f65a7] text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-50`}
              >{amountPeriod === 'current' ? '本年金额' : '上年金额'}</button>)}
            </div>
          )}
          <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-80">
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
              placeholder="搜索报表项目或编码"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
          </div>
        </div>
        {!selectedCompanyId || !periodId ? (
          <EmptyState message="请选择账套和账期后读取财务报表。" />
        ) : loading ? (
          <EmptyState message="正在读取当前账期财务报表..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">{accountingExport.title}项目</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                仅展示当前范围
              </span>
            </div>
            <div className="hidden min-w-0 lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    {displayColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`break-words px-2 py-3 font-medium ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {displayColumns.map((column) => (
                        <td
                          key={column.key}
                          className={`break-words px-2 py-3 ${column.align === 'right' ? 'text-right tabular-nums' : column.align === 'center' ? 'text-center' : ''}`}
                          title={row.values[column.key]}
                        >
                          {row.values[column.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <EmptyState message="当前范围没有可展示的报表项目。" />
              )}
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {pagination.rows.map((row) => (
                <article
                  key={row.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <p
                    className="truncate text-sm font-semibold"
                    title={row.primary}
                  >
                    {row.primary}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {row.secondary}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {displayColumns.map((column) => (
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
                <EmptyState message="当前范围没有可展示的报表项目。" />
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
              报表结果仅用于查询和复核。公式映射、季度归集、税务报送与最终签章应在受控流程中确认，并保留调整依据。
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

export function FinancialOverviewWorkspace() {
  return <FinancialStatementWorkspace view="overview" />
}
export function BalanceSheetWorkspace() {
  return <FinancialStatementWorkspace view="balanceSheet" />
}
export function IncomeStatementWorkspace() {
  return <FinancialStatementWorkspace view="incomeStatement" />
}
export function IncomeQuarterWorkspace() {
  return <FinancialStatementWorkspace view="incomeQuarter" />
}
export function CashFlowWorkspace() {
  return <FinancialStatementWorkspace view="cashFlow" />
}
export function CashFlowQuarterWorkspace() {
  return <FinancialStatementWorkspace view="cashFlowQuarter" />
}
export function EquityChangeWorkspace() {
  return <FinancialStatementWorkspace view="equityChange" />
}
