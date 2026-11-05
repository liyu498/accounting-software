import {
  BadgeCheck,
  Calculator,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  FileCheck2,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  automationApi,
  type TaxCalendarDay,
  type TaxDeadlineRule,
  type TaxDeclarationTask,
} from "../../lib/api";
import {
  buildBrowserInitialBalanceFinalization,
  hasBrowserInitialBalanceFinalization,
} from "../../lib/browserInitialBalanceWorkflow.js";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { isTauri } from "../../lib/tauri";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { useAccountStore, type AccountCode } from "../../stores/accountStore";
import { useCompanyStore } from "../../stores/companyStore";
import {
  usePeriodStore,
  type TrialBalanceItem,
} from "../../stores/periodStore";

type BalanceScope = "all" | "debit" | "credit" | "dual";
type InitialBalanceDraft = {
  accountCode: string;
  accountName: string;
  openingDebit: string;
  openingCredit: string;
  sourceNote: string;
};
type BrowserInitialBalance = {
  companyId: string;
  period: string;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  sourceNote: string;
  updatedAt: string;
};
type BrowserInitialBalanceFinalization = {
  companyId: string;
  period: string;
  totalDebit: number;
  totalCredit: number;
  finalizedBy: string;
  finalizedAt: string;
};
type TaxTaskDraft = {
  taxType: string;
  formName: string;
  sourceSnapshot: string;
  taxableAmount: string;
  deductionAmount: string;
  payableAmount: string;
  riskCount: string;
  adapterCode: string;
};
type TaxDeadlineRuleDraft = {
  taxType: string;
  filingFrequency: string;
  dueMonthOffset: string;
  dueDay: string;
  adjustmentPolicy: string;
  effectiveFrom: string;
  effectiveTo: string;
  sourceName: string;
  sourceUrl: string;
};
type TaxCalendarDayDraft = {
  calendarDate: string;
  dayType: string;
  reason: string;
  sourceName: string;
  sourceUrl: string;
};
type TaxConfigurationPanel = "rules" | "calendar" | null;

const initialBalanceStorageKey = "accounting-preview-initial-balances-v2";
const initialBalanceFinalizationStorageKey =
  "accounting-preview-initial-balance-finalizations-v1";
const taxTypes = [
  "增值税及附加",
  "扣缴所得税",
  "企业所得税",
  "印花税",
  "社保费",
  "财报报送",
  "非税收入",
];
const balanceScopes: Array<{ id: BalanceScope; label: string }> = [
  { id: "all", label: "全部科目" },
  { id: "debit", label: "有借方余额" },
  { id: "credit", label: "有贷方余额" },
  { id: "dual", label: "借贷同时有余额" },
];
const emptyBalanceDraft: InitialBalanceDraft = {
  accountCode: "",
  accountName: "",
  openingDebit: "",
  openingCredit: "",
  sourceNote: "",
};
const emptyTaxTaskDraft: TaxTaskDraft = {
  taxType: "增值税及附加",
  formName: "",
  sourceSnapshot: "",
  taxableAmount: "",
  deductionAmount: "",
  payableAmount: "",
  riskCount: "0",
  adapterCode: "",
};
const emptyTaxDeadlineRuleDraft: TaxDeadlineRuleDraft = {
  taxType: "增值税及附加",
  filingFrequency: "monthly",
  dueMonthOffset: "",
  dueDay: "",
  adjustmentPolicy: "next_workday",
  effectiveFrom: "",
  effectiveTo: "",
  sourceName: "",
  sourceUrl: "",
};
const emptyTaxCalendarDayDraft: TaxCalendarDayDraft = {
  calendarDate: "",
  dayType: "holiday",
  reason: "",
  sourceName: "",
  sourceUrl: "",
};

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function numericValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : NaN;
}

function loadBrowserInitialBalances(): BrowserInitialBalance[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(initialBalanceStorageKey) || "null",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BrowserInitialBalance =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserInitialBalance).companyId === "string" &&
        typeof (item as BrowserInitialBalance).period === "string" &&
        typeof (item as BrowserInitialBalance).accountCode === "string" &&
        typeof (item as BrowserInitialBalance).accountName === "string" &&
        Number.isFinite((item as BrowserInitialBalance).openingDebit) &&
        Number.isFinite((item as BrowserInitialBalance).openingCredit),
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserInitialBalances(records: BrowserInitialBalance[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      initialBalanceStorageKey,
      JSON.stringify(records),
    );
  } catch {
    // Keep the current browser preview interactive when persistent storage is unavailable.
  }
}

function loadBrowserInitialBalanceFinalizations(): BrowserInitialBalanceFinalization[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(initialBalanceFinalizationStorageKey) ||
        "null",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BrowserInitialBalanceFinalization =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as BrowserInitialBalanceFinalization).companyId ===
          "string" &&
        typeof (item as BrowserInitialBalanceFinalization).period ===
          "string" &&
        typeof (item as BrowserInitialBalanceFinalization).finalizedAt ===
          "string",
      ),
    );
  } catch {
    return [];
  }
}

function saveBrowserInitialBalanceFinalizations(
  records: BrowserInitialBalanceFinalization[],
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    initialBalanceFinalizationStorageKey,
    JSON.stringify(records),
  );
}

function balanceDirection(row: TrialBalanceItem) {
  if (row.opening_debit > 0 && row.opening_credit > 0) return "借贷同时有余额";
  if (row.opening_debit > 0) return "借方余额";
  if (row.opening_credit > 0) return "贷方余额";
  return "零余额";
}

function balanceDirectionClass(value: string) {
  if (value === "借方余额")
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  if (value === "贷方余额")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  if (value === "借贷同时有余额")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function statusClass(status: string) {
  if (status === "校验通过" || status === "已确认")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "待校验" || status === "待确认")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
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

function ScopeNotice({
  companyName,
  periodLabel,
}: {
  companyName?: string;
  periodLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200 sm:flex-row sm:items-center sm:justify-between">
      <span>
        范围：{companyName || "未选择账套"} · {periodLabel || "未选择账期"}
      </span>
      <span>仅维护本地账套资料</span>
    </div>
  );
}

function useInitializationScope() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const currentPeriod = periods.find((period) => period.id === currentPeriodId);
  const previewPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const periodLabel =
    previewPeriodLabel(currentPeriod) || previewPeriodLabel(previewPeriod);
  const periodId =
    currentPeriodId ||
    (previewPeriod
      ? `browser-preview-period-${previewPeriodLabel(previewPeriod)}`
      : null);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);

  return {
    companyId,
    companyName: selectedCompany?.name,
    periodId,
    periodLabel,
    currentPeriod,
  };
}

function BalanceEditor({
  accounts,
  draft,
  saving,
  onCancel,
  onChange,
  onSubmit,
}: {
  accounts: AccountCode[];
  draft: InitialBalanceDraft;
  saving: boolean;
  onCancel: () => void;
  onChange: (draft: InitialBalanceDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1423] lg:grid-cols-6"
    >
      <label className="text-xs text-slate-600 dark:text-slate-300 lg:col-span-2">
        会计科目
        <select
          value={draft.accountCode}
          onChange={(event) => {
            const account = accounts.find(
              (item) => item.code === event.target.value,
            );
            onChange({
              ...draft,
              accountCode: event.target.value,
              accountName: account?.name || draft.accountName,
            });
          }}
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        >
          <option value="">选择已启用科目</option>
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} · {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        借方期初
        <input
          value={draft.openingDebit}
          onChange={(event) =>
            onChange({ ...draft, openingDebit: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        贷方期初
        <input
          value={draft.openingCredit}
          onChange={(event) =>
            onChange({ ...draft, openingCredit: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300 lg:col-span-2">
        来源说明
        <input
          value={draft.sourceNote}
          onChange={(event) =>
            onChange({ ...draft, sourceNote: event.target.value })
          }
          placeholder="例如：上年结转试算表"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <div className="flex items-end gap-2 lg:col-span-6">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存期初
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          取消
        </button>
      </div>
    </form>
  );
}

export function InitialBalanceWorkspace() {
  const { companyId, companyName, periodId, periodLabel, currentPeriod } =
    useInitializationScope();
  const accounts = useAccountStore((state) => state.accounts);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const fetchTrialBalance = usePeriodStore((state) => state.fetchTrialBalance);
  const saveInitialBalance = usePeriodStore(
    (state) => state.saveInitialBalance,
  );
  const validateInitialBalances = usePeriodStore(
    (state) => state.validateInitialBalances,
  );
  const finalizeInitialBalances = usePeriodStore(
    (state) => state.finalizeInitialBalances,
  );
  const [rows, setRows] = useState<TrialBalanceItem[]>([]);
  const [scope, setScope] = useState<BalanceScope>("all");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<InitialBalanceDraft>(emptyBalanceDraft);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId || !periodId || !periodLabel) {
      setRows([]);
      setFinalized(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      const previewRows = loadBrowserInitialBalances()
        .filter(
          (row) => row.companyId === companyId && row.period === periodLabel,
        )
        .map((row) => ({
          account_code: row.accountCode,
          account_name: row.accountName,
          account_type: "预览科目",
          account_level: 1,
          is_detail: true,
          opening_debit: row.openingDebit,
          opening_credit: row.openingCredit,
          period_debit: 0,
          period_credit: 0,
          cumulative_debit: 0,
          cumulative_credit: 0,
          closing_debit: row.openingDebit,
          closing_credit: row.openingCredit,
        }));
      setRows(previewRows);
      setFinalized(
        hasBrowserInitialBalanceFinalization(
          loadBrowserInitialBalanceFinalizations(),
          companyId,
          periodLabel,
        ),
      );
      setLoading(false);
      return;
    }
    try {
      const result = await fetchTrialBalance(periodId);
      setRows(result.items);
      setNotice(null);
    } catch (error) {
      setRows([]);
      setNotice(`读取期初余额失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchTrialBalance, periodId, periodLabel]);

  useEffect(() => {
    if (companyId && isTauri) void fetchAccounts(companyId);
  }, [companyId, fetchAccounts]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (isTauri)
      setFinalized(Boolean(currentPeriod?.initial_balances_finalized_at));
  }, [companyId, currentPeriod?.initial_balances_finalized_at, periodId]);

  const enabledAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_enabled === 1 && account.is_detail === 1,
      ),
    [accounts],
  );
  const visibleRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesScope =
        scope === "all" ||
        (scope === "debit" && row.opening_debit > 0) ||
        (scope === "credit" && row.opening_credit > 0) ||
        (scope === "dual" && row.opening_debit > 0 && row.opening_credit > 0);
      return (
        matchesScope &&
        (!query ||
          `${row.account_code} ${row.account_name} ${row.account_type}`
            .toLowerCase()
            .includes(query))
      );
    });
  }, [keyword, rows, scope]);
  const balancePage = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  );
  const exportHeaders = [
    "科目编码",
    "科目名称",
    "科目类型",
    "借方期初",
    "贷方期初",
    "余额方向",
  ];
  const exportRows = useMemo(
    () =>
      visibleRows.map((row) => [
        row.account_code,
        row.account_name,
        row.account_type,
        currency(row.opening_debit),
        currency(row.opening_credit),
        balanceDirection(row),
      ]),
    [visibleRows],
  );
  const metrics = useMemo(
    () => ({
      debit: rows.reduce((sum, row) => sum + row.opening_debit, 0),
      credit: rows.reduce((sum, row) => sum + row.opening_credit, 0),
      difference: Math.abs(
        rows.reduce(
          (sum, row) => sum + row.opening_debit - row.opening_credit,
          0,
        ),
      ),
    }),
    [rows],
  );

  const openEditor = () => {
    if (finalized) {
      setNotice("当前账期期初余额已确认，不能继续登记或修改。");
      return;
    }
    setDraft(emptyBalanceDraft);
    setShowEditor(true);
  };
  const saveBalance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !periodId || !periodLabel)
      return setNotice("请先在顶部选择账套和账期。");
    if (finalized)
      return setNotice("当前账期期初余额已确认，不能继续登记或修改。");
    const openingDebit = numericValue(draft.openingDebit);
    const openingCredit = numericValue(draft.openingCredit);
    const selectedAccount = enabledAccounts.find(
      (account) => account.code === draft.accountCode,
    );
    if (
      !selectedAccount ||
      !Number.isFinite(openingDebit) ||
      !Number.isFinite(openingCredit) ||
      openingDebit < 0 ||
      openingCredit < 0 ||
      (openingDebit > 0 && openingCredit > 0)
    )
      return setNotice(
        "请选择已启用科目，并填写一项非负的借方或贷方期初余额。",
      );
    setSaving(true);
    try {
      if (!isTauri) {
        const records = loadBrowserInitialBalances();
        const next: BrowserInitialBalance = {
          companyId,
          period: periodLabel,
          accountCode: selectedAccount.code,
          accountName: selectedAccount.name,
          openingDebit,
          openingCredit,
          sourceNote: draft.sourceNote.trim(),
          updatedAt: new Date().toISOString(),
        };
        saveBrowserInitialBalances([
          ...records.filter(
            (row) =>
              !(
                row.companyId === companyId &&
                row.period === periodLabel &&
                row.accountCode === selectedAccount.code
              ),
          ),
          next,
        ]);
      } else {
        await saveInitialBalance({
          period_id: periodId,
          account_code: selectedAccount.code,
          opening_debit: openingDebit,
          opening_credit: openingCredit,
        });
      }
      setShowEditor(false);
      setNotice("期初余额已保存，尚未生成凭证或执行关账。");
      await refresh();
    } catch (error) {
      setNotice(`保存期初余额失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const validate = async () => {
    if (!periodId) return;
    if (!isTauri) {
      setNotice(
        metrics.difference < 0.005
          ? "浏览器预览试算平衡通过。"
          : `浏览器预览借贷差额为 ${currency(metrics.difference)}。`,
      );
      return;
    }
    const result = await validateInitialBalances(periodId);
    setNotice(result.message);
  };
  const finalize = async () => {
    if (!companyId || !periodId || !periodLabel) return;
    if (finalized) {
      setNotice("当前账期期初余额已经确认。");
      return;
    }
    if (
      !window.confirm(
        "确认锁定当前账期的期初余额吗？该操作不会自动生成凭证或关账。",
      )
    )
      return;
    try {
      if (isTauri) {
        await finalizeInitialBalances(periodId);
      } else {
        const finalization = buildBrowserInitialBalanceFinalization({
          records: loadBrowserInitialBalances(),
          companyId,
          period: periodLabel,
          finalizedBy: "admin",
        }) as BrowserInitialBalanceFinalization;
        const existing = loadBrowserInitialBalanceFinalizations();
        saveBrowserInitialBalanceFinalizations([
          ...existing.filter(
            (item) =>
              item.companyId !== companyId || item.period !== periodLabel,
          ),
          finalization,
        ]);
      }
      setFinalized(true);
      setShowEditor(false);
      setNotice("期初余额已确认。后续凭证和关账仍需在各自流程中人工处理。");
      await refresh();
    } catch (error) {
      setNotice(`确认期初余额失败：${String(error)}`);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">期初余额初始化</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护科目期初余额，完成借贷试算后再人工确认。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="期初余额清单"
              companyName={companyName}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
            <button
              type="button"
              onClick={() => void validate()}
              disabled={!periodId}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <Calculator className="h-3.5 w-3.5" />
              试算平衡
            </button>
            <button
              type="button"
              onClick={() => void finalize()}
              disabled={!periodId || finalized || metrics.difference >= 0.005}
              className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {finalized ? "期初已确认" : "确认期初"}
            </button>
            <button
              type="button"
              onClick={openEditor}
              disabled={
                !companyId ||
                !periodId ||
                finalized ||
                (isTauri && enabledAccounts.length === 0)
              }
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-3.5 w-3.5" />
              登记期初
            </button>
          </div>
        </header>
        <ScopeNotice companyName={companyName} periodLabel={periodLabel} />
        {finalized && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            当前账期期初余额已确认锁定；如需调整，应先通过受控初始化流程解除锁定。
          </div>
        )}
        {notice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            {notice}
          </div>
        )}
        {showEditor && (
          <BalanceEditor
            accounts={enabledAccounts}
            draft={draft}
            saving={saving}
            onChange={setDraft}
            onCancel={() => setShowEditor(false)}
            onSubmit={(event) => void saveBalance(event)}
          />
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ClipboardList}
            label="已登记科目"
            value={`${rows.length} 个`}
            tone="sky"
          />
          <Metric
            icon={Calculator}
            label="借方期初"
            value={currency(metrics.debit)}
            tone="sky"
          />
          <Metric
            icon={CircleAlert}
            label="借贷差额"
            value={currency(metrics.difference)}
            tone={metrics.difference < 0.005 ? "emerald" : "rose"}
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {balanceScopes.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setScope(item.id);
                  setPage(1);
                }}
                className={`h-8 border px-3 text-xs ${scope === item.id ? "border-sky-600 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300" : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索科目编码或名称"
            className="h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 lg:w-72"
          />
        </div>
        {!companyId || !periodId ? (
          <EmptyState message="请选择账套和账期后维护期初余额。" />
        ) : loading ? (
          <EmptyState message="正在读取期初余额..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">科目期初余额</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {visibleRows.length} 条记录
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-28 px-3 py-3">科目编码</th>
                    <th className="px-3 py-3">科目名称</th>
                    <th className="w-28 px-3 py-3">类型</th>
                    <th className="w-36 px-3 py-3 text-right">借方期初</th>
                    <th className="w-36 px-3 py-3 text-right">贷方期初</th>
                    <th className="w-28 px-3 py-3 text-right">平衡状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {balancePage.rows.map((row) => {
                    const status = balanceDirection(row);
                    return (
                      <tr key={row.account_code}>
                        <td className="px-3 py-3 font-mono">
                          {row.account_code}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={row.account_name}
                        >
                          {row.account_name}
                        </td>
                        <td className="px-3 py-3">{row.account_type}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {currency(row.opening_debit)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {currency(row.opening_credit)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`inline-flex border px-2 py-0.5 text-xs ${balanceDirectionClass(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <EmptyState message="当前范围没有已登记的期初余额。" />
              )}
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {balancePage.rows.map((row) => (
                <article
                  key={row.account_code}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {row.account_code}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.account_name}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-xs ${balanceDirectionClass(balanceDirection(row))}`}
                    >
                      {balanceDirection(row)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info
                      label="借方期初"
                      value={currency(row.opening_debit)}
                    />
                    <Info
                      label="贷方期初"
                      value={currency(row.opening_credit)}
                    />
                  </div>
                </article>
              ))}
              {visibleRows.length === 0 && (
                <EmptyState message="当前范围没有已登记的期初余额。" />
              )}
            </div>
            <OperationalPagination
              page={balancePage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </section>
        )}
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          期初确认仅锁定本地期初资料，不自动生成或过账凭证、不执行结账，也不会提交税务申报。
        </footer>
      </section>
    </main>
  );
}

function TaxTaskEditor({
  draft,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: TaxTaskDraft;
  saving: boolean;
  onChange: (draft: TaxTaskDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1423] lg:grid-cols-4"
    >
      <label className="text-xs text-slate-600 dark:text-slate-300">
        税种
        <select
          value={draft.taxType}
          onChange={(event) =>
            onChange({ ...draft, taxType: event.target.value })
          }
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        >
          {taxTypes.map((taxType) => (
            <option key={taxType}>{taxType}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        申报表
        <input
          value={draft.formName}
          onChange={(event) =>
            onChange({ ...draft, formName: event.target.value })
          }
          placeholder="例如：增值税申报表"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        税局适配器
        <select
          value={draft.adapterCode}
          onChange={(event) =>
            onChange({ ...draft, adapterCode: event.target.value })
          }
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        >
          <option value="">未选择</option>
          <option value="manual-review">人工复核</option>
        </select>
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        风险数
        <input
          value={draft.riskCount}
          onChange={(event) =>
            onChange({ ...draft, riskCount: event.target.value })
          }
          inputMode="numeric"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300 lg:col-span-2">
        取数快照
        <input
          value={draft.sourceSnapshot}
          onChange={(event) =>
            onChange({ ...draft, sourceSnapshot: event.target.value })
          }
          placeholder="例如：销项、进项发票及账簿取数"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        计税依据
        <input
          value={draft.taxableAmount}
          onChange={(event) =>
            onChange({ ...draft, taxableAmount: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        抵扣或减免
        <input
          value={draft.deductionAmount}
          onChange={(event) =>
            onChange({ ...draft, deductionAmount: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <label className="text-xs text-slate-600 dark:text-slate-300">
        应缴金额
        <input
          value={draft.payableAmount}
          onChange={(event) =>
            onChange({ ...draft, payableAmount: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
        />
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存任务
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function TaxDeadlineRuleEditor({
  draft,
  rules,
  saving,
  onChange,
  onSubmit,
  onClose,
}: {
  draft: TaxDeadlineRuleDraft;
  rules: TaxDeadlineRule[];
  saving: boolean;
  onChange: (draft: TaxDeadlineRuleDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const fieldClass =
    "mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <section className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1423]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">申报期限规则</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            按税种和生效区间维护期限。法定来源必填；系统不会内置或推测法定日期。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          收起
        </button>
      </div>
      <div className="mt-3 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <form
          onSubmit={onSubmit}
          className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-xs text-slate-600 dark:text-slate-300">
            税种
            <select
              value={draft.taxType}
              onChange={(event) =>
                onChange({ ...draft, taxType: event.target.value })
              }
              className={fieldClass}
            >
              {taxTypes.map((taxType) => (
                <option key={taxType}>{taxType}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            申报频率
            <select
              value={draft.filingFrequency}
              onChange={(event) =>
                onChange({ ...draft, filingFrequency: event.target.value })
              }
              className={fieldClass}
            >
              <option value="monthly">月度</option>
              <option value="quarterly">季度</option>
              <option value="annual">年度</option>
              <option value="event">按次</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            所属期后月份
            <input
              value={draft.dueMonthOffset}
              onChange={(event) =>
                onChange({ ...draft, dueMonthOffset: event.target.value })
              }
              inputMode="numeric"
              placeholder="0-24"
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            截止日
            <input
              value={draft.dueDay}
              onChange={(event) =>
                onChange({ ...draft, dueDay: event.target.value })
              }
              inputMode="numeric"
              placeholder="1-31"
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            工作日调整
            <select
              value={draft.adjustmentPolicy}
              onChange={(event) =>
                onChange({ ...draft, adjustmentPolicy: event.target.value })
              }
              className={fieldClass}
            >
              <option value="next_workday">遇非工作日顺延</option>
              <option value="none">不调整</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            生效日期
            <input
              type="date"
              value={draft.effectiveFrom}
              onChange={(event) =>
                onChange({ ...draft, effectiveFrom: event.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            失效日期（可选）
            <input
              type="date"
              value={draft.effectiveTo}
              onChange={(event) =>
                onChange({ ...draft, effectiveTo: event.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            法定来源
            <input
              value={draft.sourceName}
              onChange={(event) =>
                onChange({ ...draft, sourceName: event.target.value })
              }
              placeholder="文件或公告名称"
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2 lg:col-span-3">
            来源链接（可选）
            <input
              value={draft.sourceUrl}
              onChange={(event) =>
                onChange({ ...draft, sourceUrl: event.target.value })
              }
              placeholder="https://"
              className={fieldClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              保存规则
            </button>
          </div>
        </form>
        <div className="min-w-0 border-l border-slate-200 pl-4 dark:border-slate-800">
          <p className="text-xs font-medium">已维护规则 {rules.length} 条</p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="border-b border-slate-200 pb-2 text-xs dark:border-slate-800"
              >
                <p className="font-medium">
                  {rule.taxType} · {rule.filingFrequency}
                </p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  所属期后 {rule.dueMonthOffset} 月第 {rule.dueDay} 日 · 生效{" "}
                  {rule.effectiveFrom}
                </p>
                <p
                  className="mt-1 truncate text-slate-500 dark:text-slate-400"
                  title={rule.sourceName}
                >
                  来源：{rule.sourceName}
                </p>
              </div>
            ))}
            {rules.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                尚未维护期限规则。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaxCalendarDayEditor({
  draft,
  calendarDays,
  saving,
  onChange,
  onSubmit,
  onClose,
}: {
  draft: TaxCalendarDayDraft;
  calendarDays: TaxCalendarDay[];
  saving: boolean;
  onChange: (draft: TaxCalendarDayDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const fieldClass =
    "mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <section className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1423]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">工作日调整</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            仅维护有法定依据的节假日和调休工作日覆盖；普通周末由系统识别。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          收起
        </button>
      </div>
      <div className="mt-3 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <form
          onSubmit={onSubmit}
          className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-xs text-slate-600 dark:text-slate-300">
            调整日期
            <input
              type="date"
              value={draft.calendarDate}
              onChange={(event) =>
                onChange({ ...draft, calendarDate: event.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            日期类型
            <select
              value={draft.dayType}
              onChange={(event) =>
                onChange({ ...draft, dayType: event.target.value })
              }
              className={fieldClass}
            >
              <option value="holiday">休息日</option>
              <option value="workday">调休工作日</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            调整原因
            <input
              value={draft.reason}
              onChange={(event) =>
                onChange({ ...draft, reason: event.target.value })
              }
              placeholder="节假日或调休说明"
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            法定来源
            <input
              value={draft.sourceName}
              onChange={(event) =>
                onChange({ ...draft, sourceName: event.target.value })
              }
              placeholder="文件或公告名称"
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2 lg:col-span-1">
            来源链接（可选）
            <input
              value={draft.sourceUrl}
              onChange={(event) =>
                onChange({ ...draft, sourceUrl: event.target.value })
              }
              placeholder="https://"
              className={fieldClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              保存调整
            </button>
          </div>
        </form>
        <div className="min-w-0 border-l border-slate-200 pl-4 dark:border-slate-800">
          <p className="text-xs font-medium">
            当前年度覆盖 {calendarDays.length} 条
          </p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {calendarDays.map((day) => (
              <div
                key={day.id}
                className="border-b border-slate-200 pb-2 text-xs dark:border-slate-800"
              >
                <p className="font-medium">
                  {day.calendarDate} ·
                  {day.dayType === "workday" ? "调休工作日" : "休息日"}
                </p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {day.reason} · 来源：{day.sourceName}
                </p>
              </div>
            ))}
            {calendarDays.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                当前年度没有工作日覆盖。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function taskStatus(task: TaxDeclarationTask) {
  if (task.declarationStatus === "confirmed") return "已确认";
  if (task.validationStatus === "passed" && task.riskCount === 0)
    return "校验通过";
  if (task.validationStatus === "failed" || task.riskCount > 0) return "待复核";
  return "待校验";
}

function canConfirmTask(task: TaxDeclarationTask) {
  return (
    task.validationStatus === "passed" &&
    task.riskCount === 0 &&
    !["confirmed", "submitted", "archived", "completed"].includes(
      task.declarationStatus.toLowerCase(),
    )
  );
}

export function TaxInitializationWorkspace() {
  const { companyId, companyName, periodLabel } = useInitializationScope();
  const [tasks, setTasks] = useState<TaxDeclarationTask[]>([]);
  const [deadlineRules, setDeadlineRules] = useState<TaxDeadlineRule[]>([]);
  const [calendarDays, setCalendarDays] = useState<TaxCalendarDay[]>([]);
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<TaxTaskDraft>(emptyTaxTaskDraft);
  const [configurationPanel, setConfigurationPanel] =
    useState<TaxConfigurationPanel>(null);
  const [deadlineDraft, setDeadlineDraft] = useState<TaxDeadlineRuleDraft>(
    emptyTaxDeadlineRuleDraft,
  );
  const [calendarDraft, setCalendarDraft] = useState<TaxCalendarDayDraft>(
    emptyTaxCalendarDayDraft,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId || !periodLabel) {
      setTasks([]);
      setDeadlineRules([]);
      setCalendarDays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const year = Number(periodLabel.slice(0, 4));
    const [taskResult, ruleResult, calendarResult] = await Promise.all([
      automationApi.getTaxDeclarationTasks({
        companyId,
        period: periodLabel,
      }),
      automationApi.getTaxDeadlineRules({ companyId }),
      automationApi.getTaxCalendarDays({
        companyId,
        year: Number.isInteger(year) ? year : new Date().getFullYear(),
      }),
    ]);
    const failure = [taskResult, ruleResult, calendarResult].find(
      (result) => !result.success,
    );
    if (!failure) {
      setTasks(taskResult.data || []);
      setDeadlineRules(ruleResult.data || []);
      setCalendarDays(calendarResult.data || []);
      setNotice(null);
    } else {
      setTasks([]);
      setDeadlineRules([]);
      setCalendarDays([]);
      setNotice(`读取申报初始化资料失败：${failure.error || "未知错误"}`);
    }
    setLoading(false);
  }, [companyId, periodLabel]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleTasks = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return tasks.filter(
      (task) =>
        !query ||
        `${task.taxType} ${task.formName} ${task.sourceSnapshot || ""} ${task.adapterCode || ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [keyword, tasks]);
  const taskPage = useMemo(
    () => paginateOperationalRows(visibleTasks, page, pageSize),
    [page, pageSize, visibleTasks],
  );
  const exportHeaders = [
    "税种",
    "申报表",
    "取数快照",
    "计税依据",
    "抵扣/减免",
    "应缴金额",
    "风险",
    "状态",
    "税局适配器",
  ];
  const exportRows = useMemo(
    () =>
      visibleTasks.map((task) => [
        task.taxType,
        task.formName,
        task.sourceSnapshot || "未记录取数快照",
        currency(task.taxableAmount),
        currency(task.deductionAmount),
        currency(task.payableAmount),
        task.riskCount ? `${task.riskCount} 项` : "无",
        taskStatus(task),
        task.adapterCode || "未配置",
      ]),
    [visibleTasks],
  );
  const metrics = useMemo(
    () => ({
      total: tasks.length,
      passed: tasks.filter(
        (task) => task.validationStatus === "passed" && task.riskCount === 0,
      ).length,
      risk: tasks.reduce((sum, task) => sum + task.riskCount, 0),
      payable: tasks.reduce((sum, task) => sum + task.payableAmount, 0),
    }),
    [tasks],
  );
  const saveTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !periodLabel)
      return setNotice("请先在顶部选择账套和账期。");
    const taxableAmount = numericValue(draft.taxableAmount);
    const deductionAmount = numericValue(draft.deductionAmount);
    const payableAmount = numericValue(draft.payableAmount);
    const riskCount = Number(draft.riskCount || 0);
    if (
      !draft.formName.trim() ||
      !Number.isFinite(taxableAmount) ||
      !Number.isFinite(deductionAmount) ||
      !Number.isFinite(payableAmount) ||
      [taxableAmount, deductionAmount, payableAmount].some(
        (value) => value < 0,
      ) ||
      !Number.isInteger(riskCount) ||
      riskCount < 0
    )
      return setNotice("请填写申报表，并维护非负金额和非负整数风险数。");
    setSaving(true);
    const result = await automationApi.upsertTaxDeclarationTask({
      companyId,
      period: periodLabel,
      taxType: draft.taxType,
      formName: draft.formName.trim(),
      collectStatus: "initialized",
      validationStatus: riskCount === 0 ? "pending" : "failed",
      declarationStatus: "draft",
      sourceSnapshot: draft.sourceSnapshot.trim() || undefined,
      taxableAmount,
      deductionAmount,
      payableAmount,
      riskCount,
      adapterCode: draft.adapterCode || undefined,
      paymentStatus: "unrecorded",
    });
    setSaving(false);
    if (!result.success)
      return setNotice(`保存申报初始化任务失败：${result.error || "未知错误"}`);
    setShowEditor(false);
    setNotice("申报初始化任务已保存，仍需完成取数和校验。");
    await refresh();
  };
  const saveDeadlineRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isTauri)
      return setNotice(
        "期限规则须在桌面数据库中维护，浏览器预览不写入法定日期。",
      );
    if (!companyId) return setNotice("请先选择账套。");
    const dueMonthOffset = Number(deadlineDraft.dueMonthOffset);
    const dueDay = Number(deadlineDraft.dueDay);
    if (
      !Number.isInteger(dueMonthOffset) ||
      dueMonthOffset < 0 ||
      dueMonthOffset > 24 ||
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 31 ||
      !deadlineDraft.effectiveFrom ||
      !deadlineDraft.sourceName.trim()
    ) {
      return setNotice(
        "请填写 0-24 的月份偏移、1-31 的截止日、生效日期和法定来源。",
      );
    }
    setSaving(true);
    const result = await automationApi.upsertTaxDeadlineRule({
      companyId,
      taxType: deadlineDraft.taxType,
      filingFrequency: deadlineDraft.filingFrequency,
      dueMonthOffset,
      dueDay,
      adjustmentPolicy: deadlineDraft.adjustmentPolicy,
      effectiveFrom: deadlineDraft.effectiveFrom,
      effectiveTo: deadlineDraft.effectiveTo || undefined,
      sourceName: deadlineDraft.sourceName.trim(),
      sourceUrl: deadlineDraft.sourceUrl.trim() || undefined,
    });
    setSaving(false);
    if (!result.success)
      return setNotice(`保存期限规则失败：${result.error || "未知错误"}`);
    setDeadlineDraft(emptyTaxDeadlineRuleDraft);
    setNotice("期限规则已保存；申报日历将按生效区间和工作日调整重新计算。");
    await refresh();
  };
  const saveCalendarDay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isTauri)
      return setNotice(
        "工作日调整须在桌面数据库中维护，浏览器预览不会推测节假日。",
      );
    if (!companyId) return setNotice("请先选择账套。");
    if (
      !calendarDraft.calendarDate ||
      !calendarDraft.reason.trim() ||
      !calendarDraft.sourceName.trim()
    ) {
      return setNotice("请填写调整日期、调整原因和法定来源。");
    }
    setSaving(true);
    const result = await automationApi.upsertTaxCalendarDay({
      companyId,
      calendarDate: calendarDraft.calendarDate,
      dayType: calendarDraft.dayType,
      reason: calendarDraft.reason.trim(),
      sourceName: calendarDraft.sourceName.trim(),
      sourceUrl: calendarDraft.sourceUrl.trim() || undefined,
    });
    setSaving(false);
    if (!result.success)
      return setNotice(`保存工作日调整失败：${result.error || "未知错误"}`);
    setCalendarDraft(emptyTaxCalendarDayDraft);
    setNotice("工作日调整已保存；相关申报期限将按覆盖日历重新计算。");
    await refresh();
  };
  const confirmTask = async (task: TaxDeclarationTask) => {
    if (!companyId || !canConfirmTask(task)) return;
    setConfirmingId(task.id);
    const result = await automationApi.confirmTaxDeclarationTask({
      id: task.id,
      companyId,
    });
    setConfirmingId(null);
    if (!result.success || !result.data)
      return setNotice(`本地确认失败：${result.error || "未知错误"}`);
    setTasks((items) =>
      items.map((item) => (item.id === result.data!.id ? result.data! : item)),
    );
    setNotice(
      `已完成“${task.formName}”本地确认；不会自动向税局提交、扣款或生成回执。`,
    );
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()} data-operational-export-root>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">申报初始化</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护税种、取数快照、校验风险和本地确认状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setConfigurationPanel((current) =>
                  current === "rules" ? null : "rules",
                )
              }
              disabled={!companyId || !isTauri}
              title={
                isTauri
                  ? "维护账套适用的申报期限规则"
                  : "期限规则须在桌面数据库中维护"
              }
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              期限规则
            </button>
            <button
              type="button"
              onClick={() =>
                setConfigurationPanel((current) =>
                  current === "calendar" ? null : "calendar",
                )
              }
              disabled={!companyId || !isTauri}
              title={
                isTauri
                  ? "维护节假日和调休工作日覆盖"
                  : "工作日调整须在桌面数据库中维护"
              }
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              工作日调整
            </button>
            <OperationalExportActions
              title="税务申报准备清单"
              companyName={companyName}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <Link
              to="/settings/tax-adapters"
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              税局适配器
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyTaxTaskDraft);
                setShowEditor(true);
              }}
              disabled={!companyId || !periodLabel}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-3.5 w-3.5" />
              新增税表
            </button>
          </div>
        </header>
        <ScopeNotice companyName={companyName} periodLabel={periodLabel} />
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
          本页只维护本地申报准备资料和人工确认；不会自动向税局提交、扣款或生成回执。
        </div>
        {notice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            {notice}
          </div>
        )}
        {configurationPanel === "rules" && (
          <TaxDeadlineRuleEditor
            draft={deadlineDraft}
            rules={deadlineRules}
            saving={saving}
            onChange={setDeadlineDraft}
            onSubmit={(event) => void saveDeadlineRule(event)}
            onClose={() => setConfigurationPanel(null)}
          />
        )}
        {configurationPanel === "calendar" && (
          <TaxCalendarDayEditor
            draft={calendarDraft}
            calendarDays={calendarDays}
            saving={saving}
            onChange={setCalendarDraft}
            onSubmit={(event) => void saveCalendarDay(event)}
            onClose={() => setConfigurationPanel(null)}
          />
        )}
        {showEditor && (
          <TaxTaskEditor
            draft={draft}
            saving={saving}
            onChange={setDraft}
            onCancel={() => setShowEditor(false)}
            onSubmit={(event) => void saveTask(event)}
          />
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={FileCheck2}
            label="已初始化税表"
            value={`${metrics.total} 项`}
            tone="sky"
          />
          <Metric
            icon={BadgeCheck}
            label="校验通过"
            value={`${metrics.passed} 项`}
            tone="emerald"
          />
          <Metric
            icon={CircleAlert}
            label="待复核风险"
            value={`${metrics.risk} 项`}
            tone={metrics.risk ? "rose" : "slate"}
          />
          <Metric
            icon={Calculator}
            label="应缴金额"
            value={currency(metrics.payable)}
            tone={metrics.payable ? "amber" : "slate"}
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            确认条件：取数校验通过且无待复核风险。
          </p>
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索税种、申报表或取数来源"
            className="h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 lg:w-72"
          />
        </div>
        {!companyId || !periodLabel ? (
          <EmptyState message="请选择账套和账期后维护申报初始化。" />
        ) : loading ? (
          <EmptyState message="正在读取当前账期申报初始化任务..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">税务申报准备清单</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {visibleTasks.length} 条任务
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-28 px-3 py-3">税种</th>
                    <th className="w-40 px-3 py-3">申报表</th>
                    <th className="px-3 py-3">取数快照</th>
                    <th className="w-28 px-3 py-3 text-right">计税依据</th>
                    <th className="w-28 px-3 py-3 text-right">抵扣/减免</th>
                    <th className="w-28 px-3 py-3 text-right">应缴金额</th>
                    <th className="w-24 px-3 py-3 text-center">风险</th>
                    <th className="w-28 px-3 py-3 text-center">状态</th>
                    <th className="w-28 px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {taskPage.rows.map((task) => {
                    const status = taskStatus(task);
                    return (
                      <tr key={task.id}>
                        <td className="px-3 py-3">{task.taxType}</td>
                        <td
                          className="truncate px-3 py-3"
                          title={task.formName}
                        >
                          {task.formName}
                        </td>
                        <td
                          className="truncate px-3 py-3 text-slate-500 dark:text-slate-400"
                          title={task.sourceSnapshot || ""}
                        >
                          {task.sourceSnapshot || "未记录取数快照"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {currency(task.taxableAmount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {currency(task.deductionAmount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {currency(task.payableAmount)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {task.riskCount ? `${task.riskCount} 项` : "无"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {canConfirmTask(task) ? (
                            <button
                              type="button"
                              disabled={confirmingId === task.id}
                              onClick={() => void confirmTask(task)}
                              className="inline-flex items-center gap-1 text-[#1f65a7] hover:underline disabled:opacity-50 dark:text-sky-400"
                            >
                              <Send className="h-3.5 w-3.5" />
                              本地确认
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {task.declarationStatus === "confirmed"
                                ? "已确认"
                                : "待校验"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleTasks.length === 0 && (
                <EmptyState message="当前账期没有申报初始化任务。新增税表后再完成取数与校验。" />
              )}
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {taskPage.rows.map((task) => {
                const status = taskStatus(task);
                return (
                  <article
                    key={task.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          title={`${task.taxType} · ${task.formName}`}
                        >
                          {task.taxType} · {task.formName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {task.sourceSnapshot || "未记录取数快照"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 border px-2 py-0.5 text-xs ${statusClass(status)}`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Info
                        label="应缴金额"
                        value={currency(task.payableAmount)}
                      />
                      <Info
                        label="风险"
                        value={
                          task.riskCount ? `${task.riskCount} 项待复核` : "无"
                        }
                      />
                    </div>
                    {canConfirmTask(task) && (
                      <button
                        type="button"
                        disabled={confirmingId === task.id}
                        onClick={() => void confirmTask(task)}
                        className="mt-3 text-xs text-[#1f65a7] disabled:opacity-50 dark:text-sky-400"
                      >
                        本地确认
                      </button>
                    )}
                  </article>
                );
              })}
              {visibleTasks.length === 0 && (
                <EmptyState message="当前账期没有申报初始化任务。新增税表后再完成取数与校验。" />
              )}
            </div>
            <OperationalPagination
              page={taskPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </section>
        )}
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          税局 adapter
          仅用于配置和授权信息管理。真实申报、扣款、回执下载及归档，必须经合规授权和人工确认闭环。
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
  icon: typeof ClipboardList;
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber" | "rose" | "slate";
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
