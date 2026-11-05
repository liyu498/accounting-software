import {
  CalendarRange,
  FilePenLine,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  employeeApi,
  specialDeductionApi,
  type Employee,
  type SpecialDeductionRecord,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type DeductionScope = "all" | "active" | "ending";
type DeductionDraft = {
  employeeId: string;
  deductionType: string;
  startMonth: string;
  endMonth: string;
  monthlyAmount: string;
  source: string;
};

const emptyDraft: DeductionDraft = {
  employeeId: "",
  deductionType: "子女教育",
  startMonth: "",
  endMonth: "",
  monthlyAmount: "",
  source: "手工登记",
};
const scopes: Array<{ id: DeductionScope; label: string }> = [
  { id: "all", label: "扣除清单" },
  { id: "active", label: "本期有效" },
  { id: "ending", label: "即将到期" },
];
const deductionTypes = [
  "子女教育",
  "继续教育",
  "大病医疗",
  "住房贷款利息",
  "住房租金",
  "赡养老人",
  "婴幼儿照护",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function recordStatus(record: SpecialDeductionRecord) {
  return record.status || "待确认";
}
function statusClass(status: string) {
  return status === "已通过"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : status === "异常"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

export function SpecialDeductionWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const currentPeriod = periods.find((period) => period.id === currentPeriodId);
  const browserPreviewPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const period =
    previewPeriodLabel(currentPeriod) ||
    previewPeriodLabel(browserPreviewPeriod);
  const [records, setRecords] = useState<SpecialDeductionRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scope, setScope] = useState<DeductionScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<SpecialDeductionRecord | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<DeductionDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);
  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [deductionResult, employeeResult] = await Promise.all([
      specialDeductionApi.getSpecialDeductionRecords({ companyId, period }),
      employeeApi.getEmployees(companyId),
    ]);
    if (deductionResult.success) setRecords(deductionResult.data || []);
    if (employeeResult.success) setEmployees(employeeResult.data || []);
    const errors = [
      !deductionResult.success && deductionResult.error,
      !employeeResult.success && employeeResult.error,
    ].filter(Boolean);
    setNotice(
      errors.length ? `读取专项附加扣除失败：${errors.join("；")}` : null,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === "在职"),
    [employees],
  );
  const metrics = useMemo(
    () => ({
      total: records.reduce((sum, record) => sum + record.monthlyAmount, 0),
      people: new Set(records.map((record) => record.employeeId)).size,
      ending: records.filter(
        (record) =>
          record.endMonth &&
          period &&
          record.endMonth >= period &&
          record.endMonth <= `${period.slice(0, 5)}12`,
      ).length,
    }),
    [period, records],
  );
  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const active = !record.endMonth || !period || record.endMonth >= period;
      const ending = Boolean(
        record.endMonth &&
        period &&
        record.endMonth >= period &&
        record.endMonth <= `${period.slice(0, 5)}12`,
      );
      const inScope =
        scope === "all" ||
        (scope === "active" && active) ||
        (scope === "ending" && ending);
      return (
        inScope &&
        (!normalizedKeyword ||
          [record.employeeName, record.deductionType, record.source]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword))
      );
    });
  }, [keyword, period, records, scope]);
  const deductionPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "人员",
    "扣除类型",
    "开始月份",
    "结束月份",
    "月扣除额",
    "证明来源",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.employeeName,
        record.deductionType,
        record.startMonth,
        record.endMonth || "长期有效",
        formatCurrency(record.monthlyAmount),
        record.source || "待补证明",
        recordStatus(record),
      ]),
    [filteredRecords],
  );
  const openCreate = (employeeId = "") => {
    setEditingRecord(null);
    setDraft({ ...emptyDraft, employeeId, startMonth: period || "" });
    setShowEditor(true);
  };
  const openEdit = (record: SpecialDeductionRecord) => {
    setEditingRecord(record);
    setDraft({
      employeeId: record.employeeId,
      deductionType: record.deductionType,
      startMonth: record.startMonth,
      endMonth: record.endMonth || "",
      monthlyAmount: String(record.monthlyAmount),
      source: record.source,
    });
    setShowEditor(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账期，再维护专项附加扣除。");
      return;
    }
    const monthlyAmount = Number(draft.monthlyAmount);
    if (
      !draft.employeeId ||
      !draft.deductionType ||
      !draft.startMonth ||
      !Number.isFinite(monthlyAmount) ||
      monthlyAmount < 0 ||
      (draft.endMonth && draft.endMonth < draft.startMonth)
    ) {
      setNotice(
        "请选择人员，填写有效的扣除类型、期间与月扣除额。结束月份不能早于开始月份。",
      );
      return;
    }
    setSaving(true);
    const result = editingRecord
      ? await specialDeductionApi.updateSpecialDeductionRecord({
          id: editingRecord.id,
          companyId,
          deductionType: draft.deductionType,
          startMonth: draft.startMonth,
          endMonth: draft.endMonth || undefined,
          monthlyAmount,
          source: draft.source || undefined,
        })
      : await specialDeductionApi.createSpecialDeductionRecord({
          companyId,
          employeeId: draft.employeeId,
          deductionType: draft.deductionType,
          startMonth: draft.startMonth,
          endMonth: draft.endMonth || undefined,
          monthlyAmount,
          source: draft.source || undefined,
        });
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}专项附加扣除失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "专项附加扣除已更新。"
        : "专项附加扣除已新增，可用于个税取数复核。",
    );
    await refresh();
  };
  const actions = (record: SpecialDeductionRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/payroll")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        个税取数
      </button>
      <button
        type="button"
        onClick={() => openEdit(record)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FilePenLine className="h-3.5 w-3.5" />
        编辑
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
              <CalendarRange className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">专项附加扣除资料核验</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护扣除类型、有效期间、证明来源和月度金额，为个人所得税取数提供可追溯依据。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="专项附加扣除清单"
              companyName={selectedCompany?.name}
              periodLabel={period}
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
              onClick={() => openCreate()}
              disabled={!companyId || !period}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增扣除资料
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="本期月度扣除" value={formatCurrency(metrics.total)} />
          <Metric
            label="覆盖人员"
            value={`${metrics.people} 人`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="即将到期"
            value={`${metrics.ending} 条`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric label="当前账期" value={period || "未选择"} />
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
              placeholder="搜索人员、扣除类型或来源"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护专项附加扣除。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期扣除资料。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取专项附加扣除资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">人员</th>
                    <th className="px-4 py-3 font-medium">扣除类型</th>
                    <th className="px-4 py-3 font-medium">有效期间</th>
                    <th className="px-4 py-3 text-right font-medium">
                      月扣除额
                    </th>
                    <th className="px-4 py-3 font-medium">证明来源</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deductionPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium">
                        {record.employeeName}
                      </td>
                      <td className="px-4 py-3">{record.deductionType}</td>
                      <td className="px-4 py-3">
                        {record.startMonth} 至 {record.endMonth || "长期有效"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(record.monthlyAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {record.source || "待补证明"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(recordStatus(record))}`}
                        >
                          {recordStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{actions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {deductionPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {record.employeeName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.deductionType}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(recordStatus(record))}`}
                    >
                      {recordStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="月扣除额"
                      value={formatCurrency(record.monthlyAmount)}
                    />
                    <Info label="来源" value={record.source || "待补"} />
                    <Info label="开始月份" value={record.startMonth} />
                    <Info
                      label="结束月份"
                      value={record.endMonth || "长期有效"}
                    />
                  </div>
                  <div className="mt-3">{actions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有专项附加扣除资料。" />
            )}
            <OperationalPagination
              page={deductionPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <QuickLink
          icon={<UsersRound className="h-4 w-4" />}
          title="人员档案"
          description="补齐证件和任职资料，确保专项扣除人员信息可追溯。"
          onClick={() => navigate("/employees")}
        />
        <QuickLink
          icon={<ShieldCheck className="h-4 w-4" />}
          title="薪酬与个税"
          description="将有效扣除资料纳入个人所得税取数和工资表复核。"
          onClick={() => navigate("/payroll")}
        />
      </section>
      {showEditor && (
        <SpecialDeductionEditor
          activeEmployees={activeEmployees}
          draft={draft}
          editing={Boolean(editingRecord)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveRecord}
        />
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-slate-800 dark:text-slate-200">
        {value}
      </p>
    </div>
  );
}
function Placeholder({ message }: { message: string }) {
  return (
    <div className="p-7 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
function QuickLink({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-200 bg-white p-3 text-left hover:border-[#1f65a7] dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-500"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-[#1f65a7] dark:text-sky-400">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
function SpecialDeductionEditor({
  activeEmployees,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  activeEmployees: Employee[];
  draft: DeductionDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: DeductionDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="专项附加扣除编辑"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑专项附加扣除" : "新增专项附加扣除"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              请留存合法证明材料，实际个税申报需经人工复核。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            取消
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
            <span>人员 *</span>
            <select
              required
              value={draft.employeeId}
              disabled={editing}
              onChange={(event) =>
                onChange({ ...draft, employeeId: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] disabled:opacity-60 dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            >
              <option value="">选择在职人员</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.employeeCode}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>扣除类型 *</span>
            <select
              value={draft.deductionType}
              onChange={(event) =>
                onChange({ ...draft, deductionType: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            >
              {deductionTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>月扣除额 *</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.monthlyAmount}
              onChange={(event) =>
                onChange({ ...draft, monthlyAmount: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>开始月份 *</span>
            <input
              required
              type="month"
              value={draft.startMonth}
              onChange={(event) =>
                onChange({ ...draft, startMonth: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>结束月份</span>
            <input
              type="month"
              value={draft.endMonth}
              onChange={(event) =>
                onChange({ ...draft, endMonth: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
            <span>证明来源</span>
            <input
              value={draft.source}
              onChange={(event) =>
                onChange({ ...draft, source: event.target.value })
              }
              placeholder="例如：纳税人确认、证明材料编号"
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || activeEmployees.length === 0}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : editing ? "保存修改" : "保存扣除资料"}
          </button>
        </footer>
      </form>
    </div>
  );
}
