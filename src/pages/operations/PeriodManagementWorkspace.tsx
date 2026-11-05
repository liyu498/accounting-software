import {
  BadgeCheck,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  FileLock2,
  FilePlus2,
  FileText,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import {
  usePeriodStore,
  type AccountingPeriod,
} from "../../stores/periodStore";

type PeriodScope = "all" | "open" | "closed" | "current";
type PeriodDraft = { year: string; month: string };
const scopes: Array<{ id: PeriodScope; label: string }> = [
  { id: "all", label: "全部账期" },
  { id: "open", label: "开放中" },
  { id: "closed", label: "已结账" },
  { id: "current", label: "当前账期" },
];

function labelOf(period: AccountingPeriod) {
  return `${period.period_year}-${String(period.period_month).padStart(2, "0")}`;
}
function stateOf(period: AccountingPeriod) {
  return period.status === "closed" ? "已结账" : "开放中";
}
function stateClass(state: string) {
  return state === "已结账"
    ? "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

export function PeriodManagementWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const loadingFromStore = usePeriodStore((state) => state.isLoading);
  const storeError = usePeriodStore((state) => state.error);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const createPeriod = usePeriodStore((state) => state.createPeriod);
  const closePeriod = usePeriodStore((state) => state.closePeriod);
  const reopenPeriod = usePeriodStore((state) => state.reopenPeriod);
  const setCurrentPeriod = usePeriodStore((state) => state.setCurrentPeriod);
  const [scope, setScope] = useState<PeriodScope>("all");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<PeriodDraft>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    await fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const records = periods;
  const currentPeriod =
    records.find((period) => period.id === currentPeriodId) ||
    records.find((period) => period.status !== "closed") ||
    null;
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((period) => {
      const isCurrent = period.id === currentPeriod?.id;
      const matchesScope =
        scope === "all" ||
        (scope === "open" && period.status !== "closed") ||
        (scope === "closed" && period.status === "closed") ||
        (scope === "current" && isCurrent);
      return (
        matchesScope &&
        (!term ||
          [labelOf(period), stateOf(period), period.closed_by]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [currentPeriod?.id, keyword, records, scope]);
  const periodPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "账期",
    "开始日期",
    "结束日期",
    "状态",
    "是否当前",
    "关账时间",
    "操作人",
    "结账前控制",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((period) => [
        labelOf(period),
        period.start_date,
        period.end_date,
        stateOf(period),
        period.id === currentPeriod?.id ? "是" : "否",
        period.closed_at || "未关账",
        period.closed_by || "未记录",
        period.status === "closed"
          ? "已锁定，需反结账审批"
          : "草稿凭证、试算平衡、税表与结转",
      ]),
    [currentPeriod?.id, filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      open: records.filter((period) => period.status !== "closed").length,
      closed: records.filter((period) => period.status === "closed").length,
      current: currentPeriod ? labelOf(currentPeriod) : "未选择",
    }),
    [currentPeriod, records],
  );

  const selectCurrent = async (period: AccountingPeriod) => {
    if (period.status === "closed") {
      setNotice(
        `账期 ${labelOf(period)} 已结账并锁定，请反结账后再设为当前账期。`,
      );
      return;
    }
    setCurrentPeriod(period.id);
    setNotice(`当前账期已切换为 ${labelOf(period)}。`);
  };

  const openCreate = () => {
    const latest = records.reduce<AccountingPeriod | undefined>(
      (current, period) =>
        !current ||
        period.period_year > current.period_year ||
        (period.period_year === current.period_year &&
          period.period_month > current.period_month)
          ? period
          : current,
      undefined,
    );
    const nextDate = latest
      ? new Date(latest.period_year, latest.period_month, 1)
      : new Date();
    setDraft({
      year: String(nextDate.getFullYear()),
      month: String(nextDate.getMonth() + 1),
    });
    setShowEditor(true);
  };

  const savePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再创建账期。");
      return;
    }
    const year = Number(draft.year);
    const month = Number(draft.month);
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      setNotice("请填写有效的账期年份和月份。");
      return;
    }
    if (
      records.some(
        (period) =>
          period.period_year === year && period.period_month === month,
      )
    ) {
      setNotice(
        `账期 ${year}-${String(month).padStart(2, "0")} 已存在，请勿重复创建。`,
      );
      return;
    }
    setSaving(true);
    try {
      const period = await createPeriod(companyId, year, month);
      setCurrentPeriod(period.id);
      setShowEditor(false);
      setNotice(`账期 ${labelOf(period)} 已创建并设为当前账期。`);
    } catch (error) {
      setNotice(`创建账期失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const closeSelectedPeriod = async (period: AccountingPeriod) => {
    if (period.status === "closed") {
      setNotice(`账期 ${labelOf(period)} 已结账。`);
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认结账账期 ${labelOf(period)} 吗？结账后该账期将锁定。`,
      )
    )
      return;
    try {
      await closePeriod(period.id);
      setNotice(
        isTauri
          ? `账期 ${labelOf(period)} 已结账并锁定。`
          : `预览账期 ${labelOf(period)} 已标记为结账。浏览器预览不执行凭证或试算校验。`,
      );
    } catch (error) {
      setNotice(`账期结账失败：${String(error)}`);
    }
  };

  const reopenSelectedPeriod = async (period: AccountingPeriod) => {
    if (period.status !== "closed") {
      setNotice(`账期 ${labelOf(period)} 已处于开放状态。`);
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认申请反结账 ${labelOf(period)} 吗？恢复开放后必须重新核验凭证、报表、税表和结转结果。`,
      )
    )
      return;
    try {
      await reopenPeriod(period.id);
      setCurrentPeriod(period.id);
      setNotice(`账期 ${labelOf(period)} 已恢复开放。请重新执行结账前检查。`);
    } catch (error) {
      setNotice(`申请反结账失败：${String(error)}`);
    }
  };

  const rowActions = (period: AccountingPeriod) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {period.status !== "closed" && (
        <button
          type="button"
          onClick={() => void selectCurrent(period)}
          className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
        >
          {period.id === currentPeriod?.id ? "当前账期" : "设为当前"}
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          void (period.status === "closed"
            ? reopenSelectedPeriod(period)
            : closeSelectedPeriod(period))
        }
        className={`inline-flex h-7 items-center gap-1 border px-2 text-xs ${period.status === "closed" ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30" : "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"}`}
      >
        {period.status === "closed" ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <LockKeyhole className="h-3.5 w-3.5" />
        )}
        {period.status === "closed" ? "申请反结账" : "执行结账"}
      </button>
    </div>
  );

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">账期结账与锁定</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              桌面端按账期顺序关账，并强制验证结转规则、草稿凭证、试算平衡和账表勾稽；反结账须按逆序执行并写入高风险审计记录。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="账期结账与锁定清单"
              companyName={selectedCompany?.name}
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
              disabled={!companyId}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增账期
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={CalendarDays}
            label="账期数量"
            value={`${metrics.total} 期`}
          />
          <Metric
            icon={CheckCheck}
            label="开放中"
            value={`${metrics.open} 期`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={FileLock2}
            label="已结账"
            value={`${metrics.closed} 期`}
            tone="text-slate-700 dark:text-slate-200"
          />
          <Metric
            icon={CircleAlert}
            label="当前账期"
            value={metrics.current}
            tone="text-sky-700 dark:text-sky-300"
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-wrap gap-1">
            {scopes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScope(item.id);
                  setPage(1);
                }}
                className={`h-8 border px-3 text-xs ${scope === item.id ? "border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索账期、状态或关账操作人"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {storeError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            读取账期失败：{storeError}
          </div>
        )}
        {!companyId && <Placeholder message="请选择账套后查看或维护账期。" />}
        {companyId && loadingFromStore && (
          <Placeholder message="正在读取账期..." />
        )}
        {companyId && !loadingFromStore && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[14%] px-3 py-3 font-medium">账期</th>
                    <th className="w-[16%] px-3 py-3 font-medium">起止日期</th>
                    <th className="w-[12%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[16%] px-3 py-3 font-medium">关账时间</th>
                    <th className="w-[12%] px-3 py-3 font-medium">操作人</th>
                    <th className="w-[16%] px-3 py-3 font-medium">
                      结账前控制
                    </th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodPage.rows.map((period) => (
                    <tr
                      key={period.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {labelOf(period)}
                        {period.id === currentPeriod?.id && (
                          <span className="ml-2 border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
                            当前
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {period.start_date} 至 {period.end_date}
                      </td>
                      <td className="px-3 py-3">
                        <Status state={stateOf(period)} />
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={period.closed_at || ""}
                      >
                        {period.closed_at || "—"}
                      </td>
                      <td className="truncate px-3 py-3">
                        {period.closed_by || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {period.status === "closed"
                          ? "已锁定，需反结账审批"
                          : "草稿凭证、试算平衡、税表与结转"}
                      </td>
                      <td className="px-3 py-3">{rowActions(period)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {periodPage.rows.map((period) => (
                <article
                  key={period.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {labelOf(period)}
                        {period.id === currentPeriod?.id ? " · 当前" : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {period.start_date} 至 {period.end_date}
                      </p>
                    </div>
                    <Status state={stateOf(period)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="关账操作人" value={period.closed_by || "—"} />
                    <Info label="关账时间" value={period.closed_at || "—"} />
                    <Info
                      label="桌面端校验"
                      value={
                        period.status === "closed"
                          ? "已锁定"
                          : "草稿、试算、税表、结转"
                      }
                    />
                    <Info
                      label="反结账"
                      value={
                        period.status === "closed" ? "需人工确认" : "不适用"
                      }
                    />
                  </div>
                  <div className="mt-3">{rowActions(period)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有账期。" />
            )}
            <OperationalPagination
              page={periodPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <WorkflowLink
          icon={CheckCheck}
          title="执行结账前检查"
          description="凭证、报表、税表和结转分别在各自模块复核；本页不伪造检查通过结果。"
          onClick={() => navigate("/closing")}
        />
        <WorkflowLink
          icon={FileText}
          title="查看凭证草稿"
          description="草稿凭证会阻断桌面端关账，需在凭证模块审核、删除或恢复后再试。"
          onClick={() => navigate("/vouchers")}
        />
        <WorkflowLink
          icon={BadgeCheck}
          title="复核税务取数"
          description="申报包和回执状态需要在税务工作台复核，不能以账期关闭代替申报确认。"
          onClick={() => navigate("/tax/workspace")}
        />
      </section>
      {showEditor && (
        <PeriodEditor
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={savePeriod}
        />
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
        <p className="text-xs">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function Status({ state }: { state: string }) {
  return (
    <span
      className={`inline-flex border px-2 py-0.5 text-xs ${stateClass(state)}`}
    >
      {state}
    </span>
  );
}
function Placeholder({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className="mt-0.5 truncate text-slate-800 dark:text-slate-100"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
function WorkflowLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-2 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
function PeriodEditor({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: PeriodDraft;
  saving: boolean;
  onChange: (
    value: PeriodDraft | ((current: PeriodDraft) => PeriodDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="新增账期"
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-md"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">新增账期</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            创建后可登记当前账套的业务记录。账期创建不自动结账、导入数据或修改历史余额。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="年份 *">
            <input
              required
              type="number"
              min="2000"
              max="2100"
              value={draft.year}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  year: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="月份 *">
            <input
              required
              type="number"
              min="1"
              max="12"
              value={draft.month}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  month: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {saving ? "正在创建" : "创建账期"}
          </button>
        </footer>
      </form>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
