import {
  BookOpenCheck,
  CircleAlert,
  FileCheck2,
  FileSpreadsheet,
  Landmark,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useAccountStore } from "../../stores/accountStore";
import { useCompanyStore } from "../../stores/companyStore";
import {
  usePeriodStore,
  type GeneralLedgerItem,
  type SubsidiaryLedgerItem,
  type TrialBalanceResult,
} from "../../stores/periodStore";
import { useVoucherStore, type Voucher } from "../../stores/voucherStore";

type HistoryView =
  "vouchers" | "balances" | "generalLedger" | "subsidiaryLedger";
type Column = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};
type HistoryRow = {
  id: string;
  primary: string;
  secondary: string;
  values: Record<string, string>;
};
type MetricTone = "sky" | "emerald" | "amber" | "rose" | "slate";

const definitions: Record<
  HistoryView,
  { title: string; description: string; source: string; columns: Column[] }
> = {
  vouchers: {
    title: "历史凭证迁移",
    description: "按历史账期核对凭证字号、摘要、分录映射、附件和借贷平衡。",
    source: "历史账期凭证及分录",
    columns: [
      { key: "number", label: "凭证字号" },
      { key: "date", label: "凭证日期" },
      { key: "summary", label: "摘要" },
      { key: "subjects", label: "科目映射" },
      { key: "debit", label: "借方金额", align: "right" },
      { key: "credit", label: "贷方金额", align: "right" },
      { key: "attachments", label: "附件", align: "center" },
      { key: "check", label: "校验", align: "center" },
    ],
  },
  balances: {
    title: "历史科目余额核对",
    description:
      "按历史账期复核期初、本期借贷发生与期末余额，形成迁移对账依据。",
    source: "历史账期试算平衡表",
    columns: [
      { key: "code", label: "科目编码" },
      { key: "name", label: "科目名称" },
      { key: "opening", label: "期初余额", align: "right" },
      { key: "debit", label: "本期借方", align: "right" },
      { key: "credit", label: "本期贷方", align: "right" },
      { key: "ending", label: "期末余额", align: "right" },
      { key: "detail", label: "核算层级", align: "center" },
    ],
  },
  generalLedger: {
    title: "历史总账勾稽",
    description:
      "按科目汇总历史期初、本期发生和期末余额，用于与余额表和明细账比对。",
    source: "历史账期总账汇总",
    columns: [
      { key: "code", label: "科目编码" },
      { key: "name", label: "科目名称" },
      { key: "opening", label: "期初余额", align: "right" },
      { key: "debit", label: "借方发生", align: "right" },
      { key: "credit", label: "贷方发生", align: "right" },
      { key: "ending", label: "期末余额", align: "right" },
      { key: "entryCount", label: "明细笔数", align: "right" },
    ],
  },
  subsidiaryLedger: {
    title: "历史明细账穿透",
    description:
      "选择历史账期和科目后，逐笔查看原凭证字号、摘要、对方科目和余额变化。",
    source: "历史账期凭证分录明细",
    columns: [
      { key: "date", label: "日期" },
      { key: "number", label: "凭证字号" },
      { key: "summary", label: "摘要" },
      { key: "opposite", label: "对方科目" },
      { key: "debit", label: "借方", align: "right" },
      { key: "credit", label: "贷方", align: "right" },
      { key: "balance", label: "余额", align: "right" },
    ],
  },
};

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function balance(debit: number, credit: number) {
  if (debit > 0) return `借 ${currency(debit)}`;
  if (credit > 0) return `贷 ${currency(credit)}`;
  return currency(0);
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
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

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: MetricTone;
}) {
  const colors = {
    sky: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    slate: "text-slate-700 dark:text-slate-200",
  };
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${colors[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function voucherCheck(voucher: Voucher) {
  if (voucher.total_debit !== voucher.total_credit) return "借贷不平";
  if (voucher.entries.length === 0) return "待补分录";
  if (voucher.status === "approved" || voucher.status === "posted")
    return "已核对";
  return "待复核";
}

function voucherRows(vouchers: Voucher[]): HistoryRow[] {
  return vouchers.map((voucher) => ({
    id: voucher.id,
    primary: voucher.voucher_number,
    secondary: voucher.summary || voucher.entries[0]?.summary || "未填写摘要",
    values: {
      number: voucher.voucher_number,
      date: voucher.voucher_date,
      summary: voucher.summary || voucher.entries[0]?.summary || "未填写摘要",
      subjects: voucher.entries.length
        ? voucher.entries
            .map((entry) => `${entry.account_code} ${entry.account_name}`)
            .slice(0, 2)
            .join(" / ")
        : "未导入分录",
      debit: currency(voucher.total_debit),
      credit: currency(voucher.total_credit),
      attachments:
        voucher.attachment_count > 0
          ? `${voucher.attachment_count} 个`
          : "无附件",
      check: voucherCheck(voucher),
    },
  }));
}

function balanceRows(result: TrialBalanceResult): HistoryRow[] {
  return result.items.map((item) => ({
    id: item.account_code,
    primary: `${item.account_code} ${item.account_name}`,
    secondary: item.is_detail ? "明细科目" : "汇总科目",
    values: {
      code: item.account_code,
      name: item.account_name,
      opening: balance(item.opening_debit, item.opening_credit),
      debit: currency(item.period_debit),
      credit: currency(item.period_credit),
      ending: balance(item.closing_debit, item.closing_credit),
      detail: item.is_detail ? "明细核算" : "总账核算",
    },
  }));
}

function generalLedgerRows(items: GeneralLedgerItem[]): HistoryRow[] {
  return items.map((item) => ({
    id: item.account_code,
    primary: `${item.account_code} ${item.account_name}`,
    secondary: item.entries.length
      ? `关联 ${item.entries.length} 笔凭证`
      : "本期无发生",
    values: {
      code: item.account_code,
      name: item.account_name,
      opening: balance(item.opening_debit, item.opening_credit),
      debit: currency(item.period_debit),
      credit: currency(item.period_credit),
      ending: balance(item.closing_debit, item.closing_credit),
      entryCount: `${item.entries.length} 笔`,
    },
  }));
}

function subsidiaryRows(items: SubsidiaryLedgerItem[]): HistoryRow[] {
  return items.map((item, index) => ({
    id: `${item.voucher_id || "opening"}-${index}`,
    primary: item.voucher_number || "期初余额",
    secondary: item.summary || "未填写摘要",
    values: {
      date: item.voucher_date || "-",
      number: item.voucher_number || "期初",
      summary: item.summary || "期初余额",
      opposite: item.opposite_account || "-",
      debit: currency(item.debit),
      credit: currency(item.credit),
      balance: item.balance_direction
        ? `${item.balance_direction} ${currency(item.balance)}`
        : currency(item.balance),
    },
  }));
}

function HistoryMigrationWorkspace({ view }: { view: HistoryView }) {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const company = useCompanyStore((state) =>
    state.companies.find((item) => item.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance);
  const getGeneralLedger = usePeriodStore((state) => state.getGeneralLedger);
  const getSubsidiaryLedger = usePeriodStore(
    (state) => state.getSubsidiaryLedger,
  );
  const accounts = useAccountStore((state) => state.accounts);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const queryVouchers = useVoucherStore((state) => state.queryVouchers);
  const period = periods.find((item) => item.id === currentPeriodId);
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month).padStart(2, "0")}`
    : "";
  const definition = definitions[view];
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(
    null,
  );
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerItem[]>([]);
  const [subsidiaryLedger, setSubsidiaryLedger] = useState<
    SubsidiaryLedgerItem[]
  >([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (selectedCompanyId && isTauri) void fetchPeriods(selectedCompanyId);
  }, [fetchPeriods, selectedCompanyId]);
  useEffect(() => {
    if (view === "subsidiaryLedger" && selectedCompanyId && isTauri)
      void fetchAccounts(selectedCompanyId);
  }, [fetchAccounts, selectedCompanyId, view]);

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !currentPeriodId) {
      setVouchers([]);
      setTrialBalance(null);
      setGeneralLedger([]);
      setSubsidiaryLedger([]);
      setLoading(false);
      return;
    }
    if (!isTauri) {
      setVouchers([]);
      setTrialBalance(null);
      setGeneralLedger([]);
      setSubsidiaryLedger([]);
      setNotice(
        "浏览器预览不生成伪造历史账簿数据。请在桌面端选择实际账套和账期后读取历史迁移资料。",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (view === "vouchers") {
        setVouchers(
          await queryVouchers({
            company_id: selectedCompanyId,
            period_id: currentPeriodId,
            page: 1,
            page_size: 100,
          }),
        );
      } else if (view === "balances") {
        setTrialBalance(await fetchTrialBalance(currentPeriodId));
      } else if (view === "generalLedger") {
        setGeneralLedger(await getGeneralLedger(currentPeriodId));
      } else {
        const result = await fetchTrialBalance(currentPeriodId);
        setTrialBalance(result);
        const fallbackAccountCode =
          selectedAccountCode ||
          accounts[0]?.code ||
          result.items[0]?.account_code ||
          "";
        if (!selectedAccountCode && fallbackAccountCode)
          setSelectedAccountCode(fallbackAccountCode);
        setSubsidiaryLedger(
          fallbackAccountCode
            ? await getSubsidiaryLedger(currentPeriodId, fallbackAccountCode)
            : [],
        );
      }
      setNotice(null);
    } catch (error) {
      setNotice(`读取${definition.title}失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [
    accounts,
    currentPeriodId,
    definition.title,
    fetchTrialBalance,
    getGeneralLedger,
    getSubsidiaryLedger,
    queryVouchers,
    selectedAccountCode,
    selectedCompanyId,
    view,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshVersion]);

  const allRows = useMemo(() => {
    if (view === "vouchers") return voucherRows(vouchers);
    if (view === "balances")
      return trialBalance ? balanceRows(trialBalance) : [];
    if (view === "generalLedger") return generalLedgerRows(generalLedger);
    return subsidiaryRows(subsidiaryLedger);
  }, [generalLedger, subsidiaryLedger, trialBalance, view, vouchers]);
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
  const historyPage = useMemo(
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
    if (view === "vouchers") {
      const checks = vouchers.map(voucherCheck);
      return [
        {
          label: "历史凭证",
          value: `${vouchers.length} 张`,
          tone: "sky" as MetricTone,
          icon: FileCheck2,
        },
        {
          label: "已核对",
          value: `${checks.filter((item) => item === "已核对").length} 张`,
          tone: "emerald" as MetricTone,
          icon: BookOpenCheck,
        },
        {
          label: "待复核",
          value: `${checks.filter((item) => item === "待复核").length} 张`,
          tone: "amber" as MetricTone,
          icon: CircleAlert,
        },
        {
          label: "异常",
          value: `${checks.filter((item) => item === "借贷不平" || item === "待补分录").length} 张`,
          tone: "rose" as MetricTone,
          icon: CircleAlert,
        },
      ];
    }
    if (view === "balances" && trialBalance) {
      const difference = Math.abs(
        trialBalance.total_closing_debit - trialBalance.total_closing_credit,
      );
      return [
        {
          label: "科目余额行",
          value: `${trialBalance.items.length} 行`,
          tone: "sky" as MetricTone,
          icon: Landmark,
        },
        {
          label: "本期借方",
          value: currency(trialBalance.total_period_debit),
          tone: "emerald" as MetricTone,
          icon: FileSpreadsheet,
        },
        {
          label: "本期贷方",
          value: currency(trialBalance.total_period_credit),
          tone: "emerald" as MetricTone,
          icon: FileSpreadsheet,
        },
        {
          label: "试算差额",
          value: currency(difference),
          tone:
            difference < 0.005
              ? ("slate" as MetricTone)
              : ("rose" as MetricTone),
          icon: CircleAlert,
        },
      ];
    }
    if (view === "generalLedger") {
      const debit = generalLedger.reduce(
        (sum, item) => sum + item.period_debit,
        0,
      );
      const credit = generalLedger.reduce(
        (sum, item) => sum + item.period_credit,
        0,
      );
      return [
        {
          label: "总账科目",
          value: `${generalLedger.length} 个`,
          tone: "sky" as MetricTone,
          icon: Landmark,
        },
        {
          label: "关联凭证",
          value: `${generalLedger.reduce((sum, item) => sum + item.entries.length, 0)} 笔`,
          tone: "emerald" as MetricTone,
          icon: FileCheck2,
        },
        {
          label: "借方发生",
          value: currency(debit),
          tone: "amber" as MetricTone,
          icon: FileSpreadsheet,
        },
        {
          label: "勾稽差额",
          value: currency(Math.abs(debit - credit)),
          tone:
            Math.abs(debit - credit) < 0.005
              ? ("slate" as MetricTone)
              : ("rose" as MetricTone),
          icon: CircleAlert,
        },
      ];
    }
    const debit = subsidiaryLedger.reduce((sum, item) => sum + item.debit, 0);
    const credit = subsidiaryLedger.reduce((sum, item) => sum + item.credit, 0);
    return [
      {
        label: "明细行数",
        value: `${subsidiaryLedger.length} 行`,
        tone: "sky" as MetricTone,
        icon: FileSpreadsheet,
      },
      {
        label: "当前科目",
        value: selectedAccountCode || "未选择",
        tone: "emerald" as MetricTone,
        icon: Landmark,
      },
      {
        label: "借方发生",
        value: currency(debit),
        tone: "amber" as MetricTone,
        icon: FileCheck2,
      },
      {
        label: "贷方发生",
        value: currency(credit),
        tone: "slate" as MetricTone,
        icon: FileCheck2,
      },
    ];
  }, [
    generalLedger,
    selectedAccountCode,
    subsidiaryLedger,
    trialBalance,
    view,
    vouchers,
  ]);

  const emptyMessage =
    !selectedCompanyId || !currentPeriodId
      ? "请选择账套和账期后读取历史迁移资料。"
      : view === "subsidiaryLedger" && !selectedAccountCode
        ? "请选择科目后查看历史明细账。"
        : "当前范围没有可供核对的历史记录。";
  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{definition.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {definition.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${definition.title}清单`}
              companyName={company?.name}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => setRefreshVersion((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              重新取数
            </button>
          </div>
        </header>
        <div className="flex flex-col gap-1 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200 sm:flex-row sm:items-center sm:justify-between">
          <span>
            范围：{company?.name || "未选择账套"} ·{" "}
            {periodLabel || "未选择账期"}
          </span>
          <span>数据来源：{definition.source}</span>
        </div>
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
          本页仅作历史迁移核对，不导入文件、不自动修复差异，也不会覆盖当前账期。
        </div>
        {notice && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
            {notice}
          </div>
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          {metrics.map((metric) => (
            <Metric key={metric.label} {...metric} />
          ))}
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {view === "subsidiaryLedger" ? (
            <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>历史科目</span>
              <select
                value={selectedAccountCode}
                onChange={(event) => {
                  setSelectedAccountCode(event.target.value);
                  setPage(1);
                }}
                className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
              >
                <option value="">选择科目</option>
                {accounts.map((account) => (
                  <option key={account.code} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
                {accounts.length === 0 &&
                  trialBalance?.items.map((item) => (
                    <option key={item.account_code} value={item.account_code}>
                      {item.account_code} · {item.account_name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <p className="self-end text-xs text-slate-500 dark:text-slate-400">
              当前视图只读展示已迁移数据；异常需回到来源凭证或期初资料修复。
            </p>
          )}
          <label className="flex h-8 items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索当前视图"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {loading ? (
          <EmptyState message="正在读取历史迁移资料..." />
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
                  {historyPage.rows.map((row) => (
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
                          {row.values[column.key] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {historyPage.rows.map((row) => (
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
                </article>
              ))}
            </div>
          </section>
        )}
        <OperationalPagination
          page={historyPage}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              历史数据用于核对和迁移证据留存。导入、差异调整、凭证审核和期初确认必须在各自受控流程中由人工完成。
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}

export function HistoryVoucherWorkspace() {
  return <HistoryMigrationWorkspace view="vouchers" />;
}
export function HistoryBalanceWorkspace() {
  return <HistoryMigrationWorkspace view="balances" />;
}
export function HistoryGeneralLedgerWorkspace() {
  return <HistoryMigrationWorkspace view="generalLedger" />;
}
export function HistorySubsidiaryLedgerWorkspace() {
  return <HistoryMigrationWorkspace view="subsidiaryLedger" />;
}
