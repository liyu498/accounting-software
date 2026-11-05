import {
  ArrowRight,
  BookOpenText,
  CircleAlert,
  FolderTree,
  Layers3,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountingReportExportActions } from "../../components/operations/AccountingReportExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { accountingStandardLabels } from "../../lib/constants";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import {
  useAuxiliaryStore,
  type AuxiliaryBalanceRow,
  type AuxiliaryLedgerRow,
} from "../../stores/auxiliaryStore";
import { useCompanyStore } from "../../stores/companyStore";
import {
  usePeriodStore,
  type SubsidiaryLedgerItem,
  type TrialBalanceResult,
} from "../../stores/periodStore";

type DetailView = "subsidiary" | "auxiliaryLedger" | "auxiliaryBalance";
type DetailRow = {
  id: string;
  primary: string;
  secondary: string;
  values: Record<string, string>;
  voucherId?: string;
};
type Column = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

const viewDefinitions: Record<
  DetailView,
  { title: string; description: string; source: string; columns: Column[] }
> = {
  subsidiary: {
    title: "明细账",
    description:
      "按选定科目逐笔查看已审核凭证的摘要、对方科目、借贷发生与余额变化。",
    source: "已审核会计凭证分录",
    columns: [
      { key: "date", label: "日期" },
      { key: "voucher", label: "凭证字号" },
      { key: "summary", label: "摘要" },
      { key: "opposite", label: "对方科目" },
      { key: "debit", label: "借方", align: "right" },
      { key: "credit", label: "贷方", align: "right" },
      { key: "balance", label: "余额", align: "right" },
    ],
  },
  auxiliaryLedger: {
    title: "辅助核算账",
    description:
      "按辅助类别和辅助项目查看已审核凭证的逐笔发生额，核对维度归属与借贷方向。",
    source: "凭证辅助核算分录",
    columns: [
      { key: "date", label: "日期" },
      { key: "voucher", label: "凭证字号" },
      { key: "summary", label: "摘要" },
      { key: "direction", label: "方向", align: "center" },
      { key: "amount", label: "发生额", align: "right" },
    ],
  },
  auxiliaryBalance: {
    title: "辅助余额表",
    description:
      "按辅助类别汇总项目期初、本期发生和期末余额，作为辅助核算与总账勾稽依据。",
    source: "辅助项目余额汇总",
    columns: [
      { key: "code", label: "项目编码" },
      { key: "name", label: "项目名称" },
      { key: "opening", label: "期初余额", align: "right" },
      { key: "debit", label: "本期借方", align: "right" },
      { key: "credit", label: "本期贷方", align: "right" },
      { key: "direction", label: "方向", align: "center" },
      { key: "ending", label: "期末余额", align: "right" },
    ],
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function balanceLabel(debit: number, credit: number) {
  if (debit > 0) return `借 ${formatCurrency(debit)}`;
  if (credit > 0) return `贷 ${formatCurrency(credit)}`;
  return formatCurrency(0);
}

function directionLabel(value: string) {
  if (value === "debit" || value === "借") return "借";
  if (value === "credit" || value === "贷") return "贷";
  return value || "-";
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

function LedgerDetailWorkspace({ view }: { view: DetailView }) {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance);
  const getSubsidiaryLedger = usePeriodStore(
    (state) => state.getSubsidiaryLedger,
  );
  const categories = useAuxiliaryStore((state) => state.categories);
  const items = useAuxiliaryStore((state) => state.items);
  const fetchCategories = useAuxiliaryStore((state) => state.fetchCategories);
  const fetchItems = useAuxiliaryStore((state) => state.fetchItems);
  const fetchAuxiliaryLedger = useAuxiliaryStore(
    (state) => state.fetchAuxiliaryLedger,
  );
  const fetchAuxiliaryBalance = useAuxiliaryStore(
    (state) => state.fetchAuxiliaryBalance,
  );
  const period = periods.find((item) => item.id === currentPeriodId);
  const periodId = currentPeriodId;
  const definition = viewDefinitions[view];
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month).padStart(2, "0")}`
    : "未选择账期";
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(
    null,
  );
  const [selectedAccountCode, setSelectedAccountCode] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [subsidiaryRows, setSubsidiaryRows] = useState<SubsidiaryLedgerItem[]>(
    [],
  );
  const [auxiliaryRows, setAuxiliaryRows] = useState<AuxiliaryLedgerRow[]>([]);
  const [auxiliaryBalanceRows, setAuxiliaryBalanceRows] = useState<
    AuxiliaryBalanceRow[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadScope = useCallback(async () => {
    if (!selectedCompanyId || !periodId) {
      setTrialBalance(null);
      setSelectedAccountCode("");
      setSelectedCategoryId("");
      setSelectedItemId("");
      setLoading(false);
      return;
    }
    if (!isTauri) {
      setTrialBalance(null);
      setNotice(
        "浏览器预览不生成伪造账簿数据。选择实际账套和账期后在桌面应用中读取明细账。",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextTrialBalance] = await Promise.all([
        fetchTrialBalance(periodId),
        fetchCategories(selectedCompanyId),
      ]);
      setTrialBalance(nextTrialBalance);
      setNotice(null);
    } catch (error) {
      setNotice(`读取账簿筛选范围失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchCategories, fetchTrialBalance, periodId, selectedCompanyId]);

  useEffect(() => {
    void loadScope();
  }, [loadScope, refreshVersion]);

  const detailAccounts = useMemo(
    () => trialBalance?.items.filter((item) => item.is_detail) || [],
    [trialBalance],
  );

  useEffect(() => {
    if (
      selectedAccountCode &&
      detailAccounts.some((item) => item.account_code === selectedAccountCode)
    )
      return;
    setSelectedAccountCode(detailAccounts[0]?.account_code || "");
  }, [detailAccounts, selectedAccountCode]);

  useEffect(() => {
    if (!selectedCategoryId && categories[0])
      setSelectedCategoryId(categories[0].id);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!selectedCompanyId || !selectedCategoryId || !isTauri) return;
    void fetchItems(selectedCategoryId, selectedCompanyId);
  }, [fetchItems, selectedCategoryId, selectedCompanyId]);

  useEffect(() => {
    if (!selectedItemId && items[0]) setSelectedItemId(items[0].id);
  }, [items, selectedItemId]);

  const loadRows = useCallback(async () => {
    if (!selectedCompanyId || !periodId || !isTauri) {
      setSubsidiaryRows([]);
      setAuxiliaryRows([]);
      setAuxiliaryBalanceRows([]);
      return;
    }
    setLoading(true);
    try {
      if (view === "subsidiary") {
        if (!selectedAccountCode) {
          setSubsidiaryRows([]);
          return;
        }
        setSubsidiaryRows(
          await getSubsidiaryLedger(periodId, selectedAccountCode),
        );
        setAuxiliaryRows([]);
        setAuxiliaryBalanceRows([]);
      } else if (view === "auxiliaryLedger") {
        if (!selectedItemId) {
          setAuxiliaryRows([]);
          return;
        }
        setAuxiliaryRows(
          await fetchAuxiliaryLedger({
            auxiliary_item_id: selectedItemId,
            company_id: selectedCompanyId,
            period_id: periodId,
          }),
        );
        setSubsidiaryRows([]);
        setAuxiliaryBalanceRows([]);
      } else {
        if (!selectedCategoryId) {
          setAuxiliaryBalanceRows([]);
          return;
        }
        setAuxiliaryBalanceRows(
          await fetchAuxiliaryBalance(
            selectedCategoryId,
            periodId,
            selectedCompanyId,
          ),
        );
        setSubsidiaryRows([]);
        setAuxiliaryRows([]);
      }
    } catch (error) {
      setNotice(`读取${definition.title}失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [
    definition.title,
    fetchAuxiliaryBalance,
    fetchAuxiliaryLedger,
    getSubsidiaryLedger,
    periodId,
    selectedAccountCode,
    selectedCategoryId,
    selectedCompanyId,
    selectedItemId,
    view,
  ]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshVersion]);

  const selectedAccount = trialBalance?.items.find(
    (item) => item.account_code === selectedAccountCode,
  );
  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  );
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const allRows = useMemo<DetailRow[]>(() => {
    if (view === "subsidiary")
      return subsidiaryRows.map((row, index) => ({
        id: `subsidiary-${row.voucher_id || index}`,
        primary: row.voucher_number || "期初余额",
        secondary: row.summary || "未填写摘要",
        voucherId: row.voucher_id || undefined,
        values: {
          date: row.voucher_date || "-",
          voucher: row.voucher_number || "期初",
          summary: row.summary || "-",
          opposite: row.opposite_account || "-",
          debit: formatCurrency(row.debit),
          credit: formatCurrency(row.credit),
          balance: row.balance_direction
            ? `${directionLabel(row.balance_direction)} ${formatCurrency(row.balance)}`
            : formatCurrency(row.balance),
        },
      }));
    if (view === "auxiliaryLedger")
      return auxiliaryRows.map((row, index) => ({
        id: `auxiliary-${row.voucher_number || index}-${row.date}`,
        primary: row.voucher_number || "期初余额",
        secondary: row.summary || "未填写摘要",
        values: {
          date: row.date || "-",
          voucher: row.voucher_number || "期初",
          summary: row.summary || "-",
          direction: directionLabel(row.direction),
          amount: formatCurrency(row.amount),
        },
      }));
    return auxiliaryBalanceRows.map((row) => ({
      id: `auxiliary-balance-${row.auxiliary_item_code}`,
      primary: `${row.auxiliary_item_code} ${row.auxiliary_item_name}`,
      secondary: selectedCategory?.name || "辅助类别",
      values: {
        code: row.auxiliary_item_code,
        name: row.auxiliary_item_name,
        opening: balanceLabel(row.beginning_debit, row.beginning_credit),
        debit: formatCurrency(row.period_debit),
        credit: formatCurrency(row.period_credit),
        direction:
          row.ending_debit > 0 ? "借" : row.ending_credit > 0 ? "贷" : "-",
        ending: balanceLabel(row.ending_debit, row.ending_credit),
      },
    }));
  }, [
    auxiliaryBalanceRows,
    auxiliaryRows,
    selectedCategory?.name,
    subsidiaryRows,
    view,
  ]);
  const rows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return query
      ? allRows.filter((row) =>
          [row.primary, row.secondary, ...Object.values(row.values)]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : allRows;
  }, [allRows, keyword]);
  const ledgerPage = useMemo(
    () => paginateOperationalRows(rows, page, pageSize),
    [page, pageSize, rows],
  );
  const exportHeaders = definition.columns.map((column) => column.label);
  const exportRows = useMemo(
    () =>
      rows.map((row) =>
        definition.columns.map((column) => row.values[column.key] || "-"),
      ),
    [definition.columns, rows],
  );
  const metrics = useMemo(() => {
    if (view === "subsidiary") {
      const debit = subsidiaryRows.reduce((sum, row) => sum + row.debit, 0);
      const credit = subsidiaryRows.reduce((sum, row) => sum + row.credit, 0);
      return [
        {
          label: "明细行数",
          value: `${subsidiaryRows.length} 行`,
          tone: "sky" as const,
          icon: BookOpenText,
        },
        {
          label: "借方发生",
          value: formatCurrency(debit),
          tone: "emerald" as const,
          icon: Layers3,
        },
        {
          label: "贷方发生",
          value: formatCurrency(credit),
          tone: "emerald" as const,
          icon: Layers3,
        },
        {
          label: "当前科目",
          value: selectedAccountCode || "未选择",
          tone: "slate" as const,
          icon: FolderTree,
        },
      ];
    }
    if (view === "auxiliaryLedger") {
      const amount = auxiliaryRows.reduce((sum, row) => sum + row.amount, 0);
      return [
        {
          label: "明细行数",
          value: `${auxiliaryRows.length} 行`,
          tone: "sky" as const,
          icon: BookOpenText,
        },
        {
          label: "辅助类别",
          value: selectedCategory?.name || "未选择",
          tone: "emerald" as const,
          icon: FolderTree,
        },
        {
          label: "辅助项目",
          value: selectedItem?.name || "未选择",
          tone: "amber" as const,
          icon: Layers3,
        },
        {
          label: "发生金额",
          value: formatCurrency(amount),
          tone: "slate" as const,
          icon: CircleAlert,
        },
      ];
    }
    const debit = auxiliaryBalanceRows.reduce(
      (sum, row) => sum + row.ending_debit,
      0,
    );
    const credit = auxiliaryBalanceRows.reduce(
      (sum, row) => sum + row.ending_credit,
      0,
    );
    return [
      {
        label: "余额项目",
        value: `${auxiliaryBalanceRows.length} 项`,
        tone: "sky" as const,
        icon: BookOpenText,
      },
      {
        label: "辅助类别",
        value: selectedCategory?.name || "未选择",
        tone: "emerald" as const,
        icon: FolderTree,
      },
      {
        label: "借方余额",
        value: formatCurrency(debit),
        tone: "amber" as const,
        icon: Layers3,
      },
      {
        label: "贷方余额",
        value: formatCurrency(credit),
        tone: "slate" as const,
        icon: CircleAlert,
      },
    ];
  }, [
    auxiliaryBalanceRows,
    auxiliaryRows,
    selectedAccountCode,
    selectedCategory?.name,
    selectedItem?.name,
    subsidiaryRows,
    view,
  ]);

  const handleRefresh = () => setRefreshVersion((value) => value + 1);
  const emptyMessage =
    !selectedCompanyId || !periodId
      ? "请选择账套和账期后读取账簿。"
      : view === "subsidiary" && !selectedAccountCode
        ? "请选择科目后查看明细账。"
        : view === "auxiliaryLedger" && !selectedItemId
          ? "请选择辅助类别和项目后查看辅助明细。"
          : view === "auxiliaryBalance" && !selectedCategoryId
            ? "请选择辅助类别后查看辅助余额。"
            : "当前筛选范围没有账簿记录。";

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
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
              periodLabel={periodLabel}
              accountingStandard={accountingStandardLabels[selectedCompany?.accounting_system || ""]}
              reportKind="ledger"
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              重新取数
            </button>
          </div>
        </header>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
          账簿页仅查询当前账套与账期；筛选与取数不会改写凭证、辅助项目或期末余额。
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
              {selectedCompany?.name || "未选择账套"} · {periodLabel}
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
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {view === "subsidiary" ? (
            <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>科目</span>
              <select
                value={selectedAccountCode}
                onChange={(event) => {
                  setSelectedAccountCode(event.target.value);
                  setPage(1);
                }}
                className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
              >
                <option value="">选择科目</option>
                {detailAccounts.map((item) => (
                  <option key={item.account_code} value={item.account_code}>
                    {item.account_code}｜{item.account_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>辅助类别</span>
                <select
                  value={selectedCategoryId}
                  onChange={(event) => {
                    setSelectedCategoryId(event.target.value);
                    setSelectedItemId("");
                    setPage(1);
                  }}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                >
                  <option value="">选择辅助类别</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code}｜{category.name}
                    </option>
                  ))}
                </select>
              </label>
              {view === "auxiliaryLedger" && (
                <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>辅助项目</span>
                  <select
                    value={selectedItemId}
                    onChange={(event) => {
                      setSelectedItemId(event.target.value);
                      setPage(1);
                    }}
                    className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                  >
                    <option value="">选择辅助项目</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}｜{item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <label className="self-end flex h-8 items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <BookOpenText className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索日期、凭证、摘要或项目"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {loading ? (
          <EmptyState message="正在读取当前范围账簿..." />
        ) : rows.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">{definition.title}清单</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {rows.length} 条结果
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    {definition.columns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-3 py-3 font-medium ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledgerPage.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {definition.columns.map((column) => (
                        <td
                          key={column.key}
                          title={row.values[column.key]}
                          className={`truncate px-3 py-3 ${column.align === "right" ? "text-right tabular-nums" : column.align === "center" ? "text-center" : ""}`}
                        >
                          {column.key === "voucher" && row.voucherId ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/vouchers/detail/${row.voucherId}`)
                              }
                              className="inline-flex items-center gap-1 text-sky-700 hover:underline dark:text-sky-300"
                              title="查看原凭证"
                            >
                              {row.values[column.key] || "-"}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            row.values[column.key] || "-"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {ledgerPage.rows.map((row) => (
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
                    {definition.columns.map((column) => (
                      <Info
                        key={column.key}
                        label={column.label}
                        value={row.values[column.key] || "-"}
                      />
                    ))}
                  </div>
                  {row.voucherId && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/vouchers/detail/${row.voucherId}`)
                      }
                      className="mt-3 inline-flex h-7 items-center gap-1 text-xs text-sky-700 hover:underline dark:text-sky-300"
                    >
                      查看原凭证
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </article>
              ))}
            </div>
            <OperationalPagination
              page={ledgerPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </section>
        )}
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              明细账和辅助账只用于核对取数范围。发现维度缺失、余额不一致或摘要异常时，应回到凭证或辅助资料模块处理并保留操作记录。
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber" | "slate";
}) {
  const color = {
    sky: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-400",
    slate: "text-slate-700 dark:text-slate-200",
  }[tone];
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
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}

export function SubsidiaryLedgerWorkspace() {
  return <LedgerDetailWorkspace view="subsidiary" />;
}
export function AuxiliaryLedgerWorkspace() {
  return <LedgerDetailWorkspace view="auxiliaryLedger" />;
}
export function AuxiliaryBalanceWorkspace() {
  return <LedgerDetailWorkspace view="auxiliaryBalance" />;
}
