import {
  CircleDollarSign,
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
  payrollApi,
  type Employee,
  type PayrollRecord,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type PayrollDraft = {
  employeeId: string;
  baseSalary: string;
  bonus: string;
  taxAmount: string;
  socialPersonal: string;
};
type PayrollScope = "all" | "pending" | "completed";

const emptyPayrollDraft: PayrollDraft = {
  employeeId: "",
  baseSalary: "",
  bonus: "",
  taxAmount: "",
  socialPersonal: "",
};
const scopes: Array<{ id: PayrollScope; label: string }> = [
  { id: "all", label: "本期薪酬表" },
  { id: "pending", label: "待确认" },
  { id: "completed", label: "已完成" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function payrollStatus(record: PayrollRecord) {
  return record.status === "已生成凭证"
    ? "已完成"
    : record.status === "异常"
      ? "异常"
      : "待确认";
}
function payrollStatusClass(record: PayrollRecord) {
  return record.status === "已生成凭证"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : record.status === "异常"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

export function PayrollWorkspace() {
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
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scope, setScope] = useState<PayrollScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<PayrollDraft>(emptyPayrollDraft);
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
    const [payrollResult, employeeResult] = await Promise.all([
      payrollApi.getPayrollRecords({ companyId, period }),
      employeeApi.getEmployees(companyId),
    ]);
    if (payrollResult.success) setRecords(payrollResult.data || []);
    if (employeeResult.success) setEmployees(employeeResult.data || []);
    const errors = [
      !payrollResult.success && payrollResult.error,
      !employeeResult.success && employeeResult.error,
    ].filter(Boolean);
    setNotice(errors.length ? `读取薪酬资料失败：${errors.join("；")}` : null);
    setLoading(false);
  }, [companyId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === "在职"),
    [employees],
  );
  const missingEmployeeIds = useMemo(
    () =>
      new Set(
        activeEmployees
          .filter(
            (employee) =>
              !records.some((record) => record.employeeId === employee.id),
          )
          .map((employee) => employee.id),
      ),
    [activeEmployees, records],
  );
  const waitingEmployees = useMemo(
    () =>
      activeEmployees.filter((employee) => missingEmployeeIds.has(employee.id)),
    [activeEmployees, missingEmployeeIds],
  );
  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const state = payrollStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "pending" && state === "待确认") ||
        (scope === "completed" && state === "已完成");
      return (
        inScope &&
        (!normalizedKeyword ||
          [record.employeeName, record.period, state]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const payrollPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "人员",
    "账期",
    "基本工资",
    "奖金",
    "个人社保",
    "个税",
    "实发工资",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.employeeName,
        record.period,
        formatCurrency(record.baseSalary),
        formatCurrency(record.bonus),
        formatCurrency(record.socialPersonal),
        formatCurrency(record.taxAmount),
        formatCurrency(record.netSalary),
        payrollStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      gross: records.reduce(
        (sum, record) => sum + record.baseSalary + record.bonus,
        0,
      ),
      net: records.reduce((sum, record) => sum + record.netSalary, 0),
      tax: records.reduce((sum, record) => sum + record.taxAmount, 0),
    }),
    [records],
  );
  const linkedVoucherId =
    records.find((record) => record.voucherId)?.voucherId || null;

  const openCreate = (employeeId = "") => {
    if (linkedVoucherId) {
      setNotice("该账期工资批次已生成凭证，不能再新增薪酬行。");
      return;
    }
    setEditingRecord(null);
    setDraft({ ...emptyPayrollDraft, employeeId });
    setShowEditor(true);
  };
  const openEdit = (record: PayrollRecord) => {
    if (record.voucherId || record.status === "已生成凭证") {
      setNotice("该账期工资批次已生成凭证，不能再修改薪酬行。");
      return;
    }
    setEditingRecord(record);
    setDraft({
      employeeId: record.employeeId,
      baseSalary: String(record.baseSalary),
      bonus: String(record.bonus),
      taxAmount: String(record.taxAmount),
      socialPersonal: String(record.socialPersonal),
    });
    setShowEditor(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账期，再维护薪酬行。");
      return;
    }
    const values = {
      baseSalary: Number(draft.baseSalary),
      bonus: Number(draft.bonus || 0),
      taxAmount: Number(draft.taxAmount || 0),
      socialPersonal: Number(draft.socialPersonal || 0),
    };
    if (
      !draft.employeeId ||
      !Number.isFinite(values.baseSalary) ||
      values.baseSalary < 0 ||
      Object.values(values).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      setNotice("请选择人员，并填写有效的工资、奖金、个税和个人社保金额。");
      return;
    }
    setSaving(true);
    const input = {
      companyId,
      employeeId: draft.employeeId,
      period,
      ...values,
    };
    const result = editingRecord
      ? await payrollApi.updatePayrollRecord({ ...input, id: editingRecord.id })
      : await payrollApi.createPayrollRecord(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}薪酬行失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "薪酬行已更新。"
        : "薪酬行已新增，待复核个税、社保和发放状态。",
    );
    await refresh();
  };

  const actions = (record: PayrollRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/social-security")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        核对社保
      </button>
      <button
        type="button"
        onClick={() => openEdit(record)}
        disabled={Boolean(record.voucherId) || record.status === "已生成凭证"}
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
              <CircleDollarSign className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">薪酬计算与发放核对</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按当前账期维护工资、奖金、个税和个人社保，并汇总生成一张可追溯的工资凭证草稿。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="薪酬计算与发放核对"
              companyName={selectedCompany?.name}
              periodLabel={period}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() =>
                linkedVoucherId
                  ? navigate(`/vouchers/detail/${linkedVoucherId}`)
                  : period &&
                    navigate(
                      buildVoucherSourcePath({
                        kind: "payroll_batch",
                        id: period,
                      }),
                    )
              }
              disabled={!companyId || !period || records.length === 0}
              className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <FileText className="h-3.5 w-3.5" />
              {linkedVoucherId ? "查看工资凭证" : "生成工资凭证"}
            </button>
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
              disabled={!companyId || !period || Boolean(linkedVoucherId)}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增薪酬行
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="本期应发" value={formatCurrency(metrics.gross)} />
          <Metric
            label="本期实发"
            value={formatCurrency(metrics.net)}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="代扣个税"
            value={formatCurrency(metrics.tax)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            label="待建薪酬"
            value={`${waitingEmployees.length} 人`}
            tone={
              waitingEmployees.length
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-900 dark:text-slate-100"
            }
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
              placeholder="搜索人员或薪酬状态"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {!companyId && <Placeholder message="请选择账套后查看或维护薪酬表。" />}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期薪酬数据。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取薪酬资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">人员</th>
                    <th className="px-4 py-3 text-right font-medium">
                      基本工资
                    </th>
                    <th className="px-4 py-3 text-right font-medium">奖金</th>
                    <th className="px-4 py-3 text-right font-medium">
                      个人社保
                    </th>
                    <th className="px-4 py-3 text-right font-medium">个税</th>
                    <th className="px-4 py-3 text-right font-medium">
                      实发工资
                    </th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payrollPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{record.employeeName}</p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {record.period}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.baseSalary)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.bonus)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.socialPersonal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                        {formatCurrency(record.taxAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(record.netSalary)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${payrollStatusClass(record)}`}
                        >
                          {payrollStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{actions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {payrollPage.rows.map((record) => (
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
                        {record.period}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-0.5 text-xs ${payrollStatusClass(record)}`}
                    >
                      {payrollStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="应发"
                      value={formatCurrency(record.baseSalary + record.bonus)}
                    />
                    <Info
                      label="实发"
                      value={formatCurrency(record.netSalary)}
                    />
                    <Info
                      label="个人社保"
                      value={formatCurrency(record.socialPersonal)}
                    />
                    <Info
                      label="个税"
                      value={formatCurrency(record.taxAmount)}
                    />
                  </div>
                  <div className="mt-3">{actions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有薪酬行。" />
            )}
            <OperationalPagination
              page={payrollPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
            {waitingEmployees.length > 0 && (
              <section className="border-t border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">待建薪酬人员</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      下列在职人员尚未建立 {period} 薪酬行。
                    </p>
                  </div>
                  <UsersRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {waitingEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => openCreate(employee.id)}
                      className="border border-amber-300 px-2.5 py-1.5 text-xs text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      {employee.name} · 新建薪酬
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </section>
      {showEditor && (
        <PayrollEditor
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
function PayrollEditor({
  activeEmployees,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  activeEmployees: Employee[];
  draft: PayrollDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: PayrollDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fields: Array<{
    key: Exclude<keyof PayrollDraft, "employeeId">;
    label: string;
    required?: boolean;
  }> = [
    { key: "baseSalary", label: "基本工资", required: true },
    { key: "bonus", label: "奖金" },
    { key: "taxAmount", label: "个人所得税" },
    { key: "socialPersonal", label: "个人社保" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="薪酬行编辑"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑薪酬行" : "新增薪酬行"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              实发工资由基本工资、奖金、个税和个人社保自动计算。
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
          {fields.map((field) => (
            <label
              key={field.key}
              className="grid gap-1 text-xs text-slate-600 dark:text-slate-300"
            >
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                required={field.required}
                type="number"
                min="0"
                step="0.01"
                value={draft[field.key]}
                onChange={(event) =>
                  onChange({ ...draft, [field.key]: event.target.value })
                }
                className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
              />
            </label>
          ))}
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
            {saving ? "保存中..." : editing ? "保存修改" : "保存薪酬行"}
          </button>
        </footer>
      </form>
    </div>
  );
}
