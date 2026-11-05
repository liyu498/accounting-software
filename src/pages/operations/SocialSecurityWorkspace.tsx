import {
  Building2,
  FilePenLine,
  FileText,
  Landmark,
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
  socialSecurityApi,
  type Employee,
  type SocialSecurityRecord,
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

type SocialScope = "all" | "pending" | "exceptions";
type SocialDraft = {
  employeeId: string;
  city: string;
  contributionBase: string;
  companyAmount: string;
  personalAmount: string;
  fundAmount: string;
};

const emptyDraft: SocialDraft = {
  employeeId: "",
  city: "",
  contributionBase: "",
  companyAmount: "",
  personalAmount: "",
  fundAmount: "",
};
const scopes: Array<{ id: SocialScope; label: string }> = [
  { id: "all", label: "缴费明细" },
  { id: "pending", label: "待确认" },
  { id: "exceptions", label: "异常/待补" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function recordStatus(record: SocialSecurityRecord) {
  return record.status || "待确认";
}
function statusClass(status: string) {
  if (status === "已通过" || status === "已生成凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "异常")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

export function SocialSecurityWorkspace() {
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
  const [records, setRecords] = useState<SocialSecurityRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scope, setScope] = useState<SocialScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<SocialSecurityRecord | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<SocialDraft>(emptyDraft);
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
    const [socialResult, employeeResult] = await Promise.all([
      socialSecurityApi.getSocialSecurityRecords({ companyId, period }),
      employeeApi.getEmployees(companyId),
    ]);
    if (socialResult.success) setRecords(socialResult.data || []);
    if (employeeResult.success) setEmployees(employeeResult.data || []);
    const errors = [
      !socialResult.success && socialResult.error,
      !employeeResult.success && employeeResult.error,
    ].filter(Boolean);
    setNotice(errors.length ? `读取社保资料失败：${errors.join("；")}` : null);
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === "在职"),
    [employees],
  );
  const missingEmployees = useMemo(
    () =>
      activeEmployees.filter(
        (employee) =>
          !records.some((record) => record.employeeId === employee.id),
      ),
    [activeEmployees, records],
  );
  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = recordStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "pending" && status === "待确认") ||
        (scope === "exceptions" &&
          (status === "异常" || !record.city || record.contributionBase <= 0));
      return (
        inScope &&
        (!normalizedKeyword ||
          [record.employeeName, record.city, status]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const socialSecurityPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "人员",
    "账期",
    "缴费城市",
    "缴费基数",
    "单位金额",
    "个人金额",
    "公积金",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.employeeName,
        record.period,
        record.city || "待补",
        formatCurrency(record.contributionBase),
        formatCurrency(record.companyAmount),
        formatCurrency(record.personalAmount),
        formatCurrency(record.fundAmount),
        recordStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      base: records.reduce((sum, record) => sum + record.contributionBase, 0),
      company: records.reduce((sum, record) => sum + record.companyAmount, 0),
      personal: records.reduce((sum, record) => sum + record.personalAmount, 0),
    }),
    [records],
  );
  const linkedVoucherId =
    records.find((record) => record.voucherId)?.voucherId || null;

  const openCreate = (employeeId = "") => {
    if (linkedVoucherId) {
      setNotice("该账期社保公积金批次已生成凭证，不能再新增缴费资料。");
      return;
    }
    setEditingRecord(null);
    setDraft({ ...emptyDraft, employeeId });
    setShowEditor(true);
  };
  const openEdit = (record: SocialSecurityRecord) => {
    if (record.voucherId || record.status === "已生成凭证") {
      setNotice("该账期社保公积金批次已生成凭证，不能再修改缴费资料。");
      return;
    }
    setEditingRecord(record);
    setDraft({
      employeeId: record.employeeId,
      city: record.city || "",
      contributionBase: String(record.contributionBase),
      companyAmount: String(record.companyAmount),
      personalAmount: String(record.personalAmount),
      fundAmount: String(record.fundAmount),
    });
    setShowEditor(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账期，再维护社保缴费资料。");
      return;
    }
    const values = {
      contributionBase: Number(draft.contributionBase),
      companyAmount: Number(draft.companyAmount),
      personalAmount: Number(draft.personalAmount),
      fundAmount: Number(draft.fundAmount),
    };
    if (
      !draft.employeeId ||
      Object.values(values).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      setNotice("请选择人员，并填写有效的缴费基数和金额。");
      return;
    }
    setSaving(true);
    const result = editingRecord
      ? await socialSecurityApi.updateSocialSecurityRecord({
          id: editingRecord.id,
          companyId,
          city: draft.city.trim() || undefined,
          ...values,
        })
      : await socialSecurityApi.createSocialSecurityRecord({
          companyId,
          employeeId: draft.employeeId,
          period,
          city: draft.city.trim() || undefined,
          ...values,
        });
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}社保缴费资料失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "社保缴费资料已更新。"
        : "社保缴费资料已新增，待核对基数与工资表。",
    );
    await refresh();
  };
  const actions = (record: SocialSecurityRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/payroll")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Landmark className="h-3.5 w-3.5" />
        核对薪酬
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
              <ShieldCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">社保公积金缴费核对</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按当前账期维护缴费资料，并汇总单位社保和公积金生成一张可追溯凭证草稿。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="社保公积金缴费清单"
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
                        kind: "social_security_batch",
                        id: period,
                      }),
                    )
              }
              disabled={!companyId || !period || records.length === 0}
              className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <FileText className="h-3.5 w-3.5" />
              {linkedVoucherId ? "查看社保凭证" : "生成社保凭证"}
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
              新增缴费资料
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="缴费基数" value={formatCurrency(metrics.base)} />
          <Metric
            label="单位缴费"
            value={formatCurrency(metrics.company)}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="个人缴费"
            value={formatCurrency(metrics.personal)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            label="待建资料"
            value={`${missingEmployees.length} 人`}
            tone={
              missingEmployees.length
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
              placeholder="搜索人员、城市或状态"
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
          <Placeholder message="请选择账套后查看或维护社保缴费资料。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期缴费资料。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取社保缴费资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">人员</th>
                    <th className="px-4 py-3 font-medium">缴费城市</th>
                    <th className="px-4 py-3 text-right font-medium">
                      缴费基数
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      单位金额
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      个人金额
                    </th>
                    <th className="px-4 py-3 text-right font-medium">公积金</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {socialSecurityPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium">
                        {record.employeeName}
                      </td>
                      <td className="px-4 py-3">{record.city || "待补"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.contributionBase)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(record.companyAmount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.personalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.fundAmount)}
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
              {socialSecurityPage.rows.map((record) => (
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
                        {record.city || "待补缴费城市"}
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
                      label="缴费基数"
                      value={formatCurrency(record.contributionBase)}
                    />
                    <Info
                      label="单位缴费"
                      value={formatCurrency(record.companyAmount)}
                    />
                    <Info
                      label="个人缴费"
                      value={formatCurrency(record.personalAmount)}
                    />
                    <Info
                      label="公积金"
                      value={formatCurrency(record.fundAmount)}
                    />
                  </div>
                  <div className="mt-3">{actions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有社保缴费资料。" />
            )}
            <OperationalPagination
              page={socialSecurityPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
            {missingEmployees.length > 0 && (
              <section className="border-t border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">待建缴费资料人员</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      下列在职人员尚未建立 {period} 社保公积金资料。
                    </p>
                  </div>
                  <UsersRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => openCreate(employee.id)}
                      className="border border-amber-300 px-2.5 py-1.5 text-xs text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      {employee.name} · 新建缴费资料
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <QuickLink
          icon={<Building2 className="h-4 w-4" />}
          title="人员档案"
          description="先补齐证件、部门、岗位和入职资料，保证缴费人员口径一致。"
          onClick={() => navigate("/employees")}
        />
        <QuickLink
          icon={<Landmark className="h-4 w-4" />}
          title="薪酬表"
          description="按工资、个税和个人社保金额核对本期实发工资。"
          onClick={() => navigate("/payroll")}
        />
      </section>
      {showEditor && (
        <SocialSecurityEditor
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
function SocialSecurityEditor({
  activeEmployees,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  activeEmployees: Employee[];
  draft: SocialDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: SocialDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fields: Array<{
    key: Exclude<keyof SocialDraft, "employeeId">;
    label: string;
    required?: boolean;
  }> = [
    { key: "city", label: "缴费城市" },
    { key: "contributionBase", label: "缴费基数", required: true },
    { key: "companyAmount", label: "单位缴费", required: true },
    { key: "personalAmount", label: "个人缴费", required: true },
    { key: "fundAmount", label: "公积金", required: true },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="社保缴费编辑"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑缴费资料" : "新增缴费资料"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              登记本地缴费资料，实际申报和缴费仍需在合规渠道人工确认。
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
                type={field.key === "city" ? "text" : "number"}
                min={field.key === "city" ? undefined : "0"}
                step={field.key === "city" ? undefined : "0.01"}
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
            {saving ? "保存中..." : editing ? "保存修改" : "保存缴费资料"}
          </button>
        </footer>
      </form>
    </div>
  );
}
