import {
  BadgeAlert,
  BriefcaseBusiness,
  ContactRound,
  FilePenLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
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
import { employeeApi, type Employee } from "../../lib/api";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";

type EmployeeScope = "active" | "incomplete" | "inactive" | "all";
type EmployeeDraft = {
  employeeCode: string;
  name: string;
  idNo: string;
  department: string;
  position: string;
  mobile: string;
  entryDate: string;
  employmentStatus: string;
};

const emptyEmployeeDraft: EmployeeDraft = {
  employeeCode: "",
  name: "",
  idNo: "",
  department: "",
  position: "",
  mobile: "",
  entryDate: "",
  employmentStatus: "在职",
};

const scopes: Array<{ id: EmployeeScope; label: string }> = [
  { id: "active", label: "在职人员" },
  { id: "incomplete", label: "待补资料" },
  { id: "inactive", label: "离职/停用" },
  { id: "all", label: "全部档案" },
];

function maskIdNo(value: string | null) {
  if (!value) return "待补";
  if (value.length <= 7) return value;
  return `${value.slice(0, 3)}********${value.slice(-4)}`;
}

function maskMobile(value: string | null) {
  if (!value) return "待补";
  if (value.length < 7) return value;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function missingFields(employee: Employee) {
  return [
    !employee.idNo && "证件号",
    !employee.department && "部门",
    !employee.position && "岗位",
    !employee.mobile && "手机号",
    !employee.entryDate && "入职日期",
  ].filter(Boolean) as string[];
}

function employmentBadge(employee: Employee) {
  const active = employee.employmentStatus === "在职";
  return (
    <span
      className={`inline-flex border px-2 py-0.5 text-xs ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
    >
      {employee.employmentStatus || "待确认"}
    </span>
  );
}

function draftFromEmployee(employee: Employee): EmployeeDraft {
  return {
    employeeCode: employee.employeeCode,
    name: employee.name,
    idNo: employee.idNo || "",
    department: employee.department || "",
    position: employee.position || "",
    mobile: employee.mobile || "",
    entryDate: employee.entryDate || "",
    employmentStatus: employee.employmentStatus || "在职",
  };
}

export function EmployeeWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scope, setScope] = useState<EmployeeScope>("active");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployeeDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await employeeApi.getEmployees(companyId);
    if (result.success) {
      setEmployees(result.data || []);
      setNotice(null);
    } else {
      setNotice(`读取人员档案失败：${result.error || "未知错误"}`);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const metrics = useMemo(() => {
    const active = employees.filter(
      (employee) => employee.employmentStatus === "在职",
    );
    const incomplete = employees.filter(
      (employee) => missingFields(employee).length > 0,
    );
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      active: active.length,
      newEntries: employees.filter((employee) =>
        employee.entryDate?.startsWith(currentMonth),
      ).length,
      incomplete: incomplete.length,
      inactive: employees.length - active.length,
    };
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return employees.filter((employee) => {
      const incomplete = missingFields(employee).length > 0;
      const inScope =
        scope === "all" ||
        (scope === "active" && employee.employmentStatus === "在职") ||
        (scope === "incomplete" && incomplete) ||
        (scope === "inactive" && employee.employmentStatus !== "在职");
      const text = [
        employee.employeeCode,
        employee.name,
        employee.department,
        employee.position,
        employee.mobile,
        employee.idNo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inScope && (!normalizedKeyword || text.includes(normalizedKeyword))
      );
    });
  }, [employees, keyword, scope]);
  const employeePage = useMemo(
    () => paginateOperationalRows(visibleEmployees, page, pageSize),
    [page, pageSize, visibleEmployees],
  );
  const exportHeaders = [
    "人员编码",
    "姓名",
    "部门",
    "岗位",
    "证件号",
    "手机号",
    "入职日期",
    "任职状态",
    "资料完整度",
  ];
  const exportRows = useMemo(
    () =>
      visibleEmployees.map((employee) => {
        const missing = missingFields(employee);
        return [
          employee.employeeCode,
          employee.name,
          employee.department || "未分配",
          employee.position || "未设置",
          maskIdNo(employee.idNo),
          maskMobile(employee.mobile),
          employee.entryDate || "待补",
          employee.employmentStatus || "待确认",
          missing.length === 0 ? "完整" : `缺${missing.join("、")}`,
        ];
      }),
    [visibleEmployees],
  );

  const openCreate = () => {
    setEditingEmployee(null);
    setDraft(emptyEmployeeDraft);
    setShowEditor(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDraft(draftFromEmployee(employee));
    setShowEditor(true);
  };

  const saveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套，再维护人员档案。");
      return;
    }
    if (!draft.employeeCode.trim() || !draft.name.trim()) {
      setNotice("人员编码和姓名不能为空。");
      return;
    }
    setSaving(true);
    const input = {
      companyId,
      employeeCode: draft.employeeCode.trim(),
      name: draft.name.trim(),
      idNo: draft.idNo.trim() || undefined,
      department: draft.department.trim() || undefined,
      position: draft.position.trim() || undefined,
      mobile: draft.mobile.trim() || undefined,
      entryDate: draft.entryDate || undefined,
      employmentStatus: draft.employmentStatus,
    };
    const result = editingEmployee
      ? await employeeApi.updateEmployee({ ...input, id: editingEmployee.id })
      : await employeeApi.createEmployee(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingEmployee ? "更新" : "新增"}人员失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingEmployee
        ? "人员档案已更新。"
        : "人员档案已创建，可继续补充薪酬和社保资料。",
    );
    await refresh();
  };

  const actions = (employee: Employee) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/payroll")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <WalletCards className="h-3.5 w-3.5" />
        薪酬
      </button>
      <button
        type="button"
        onClick={() => openEdit(employee)}
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
              <ContactRound className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">
                人员档案与薪酬前置资料
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              管理员工身份、任职状态与资料完整度，并从档案直接进入薪酬、社保和专项扣除。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="人员档案清单"
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
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
            >
              <Plus className="h-3.5 w-3.5" />
              新增人员
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="在职人员" value={`${metrics.active} 人`} />
          <Metric
            label="本月入职"
            value={`${metrics.newEntries} 人`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="待补资料"
            value={`${metrics.incomplete} 人`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            label="离职/停用"
            value={`${metrics.inactive} 人`}
            tone="text-slate-600 dark:text-slate-300"
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
              placeholder="搜索姓名、部门、岗位或证件号"
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
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            请选择账套后查看或维护人员档案。
          </div>
        )}
        {companyId && loading && (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            正在读取人员档案...
          </div>
        )}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">人员</th>
                    <th className="px-4 py-3 font-medium">部门/岗位</th>
                    <th className="px-4 py-3 font-medium">证件号</th>
                    <th className="px-4 py-3 font-medium">联系方式</th>
                    <th className="px-4 py-3 font-medium">入职日期</th>
                    <th className="px-4 py-3 font-medium">任职状态</th>
                    <th className="px-4 py-3 font-medium">资料完整度</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeePage.rows.map((employee) => {
                    const missing = missingFields(employee);
                    return (
                      <tr
                        key={employee.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{employee.name}</p>
                          <p className="mt-0.5 font-mono text-slate-500 dark:text-slate-400">
                            {employee.employeeCode}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {employee.department || "未分配"}
                          <span className="mx-1 text-slate-300 dark:text-slate-600">
                            /
                          </span>
                          {employee.position || "未设置"}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {maskIdNo(employee.idNo)}
                        </td>
                        <td className="px-4 py-3">
                          {maskMobile(employee.mobile)}
                        </td>
                        <td className="px-4 py-3">
                          {employee.entryDate || "待补"}
                        </td>
                        <td className="px-4 py-3">
                          {employmentBadge(employee)}
                        </td>
                        <td className="px-4 py-3">
                          {missing.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              完整
                            </span>
                          ) : (
                            <span className="inline-flex max-w-44 items-center gap-1 truncate text-amber-700 dark:text-amber-300">
                              <BadgeAlert className="h-3.5 w-3.5 shrink-0" />缺
                              {missing.join("、")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{actions(employee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {employeePage.rows.map((employee) => {
                const missing = missingFields(employee);
                return (
                  <article
                    key={employee.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{employee.name}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {employee.employeeCode}
                        </p>
                      </div>
                      {employmentBadge(employee)}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Info
                        label="部门/岗位"
                        value={`${employee.department || "未分配"} / ${employee.position || "未设置"}`}
                      />
                      <Info
                        label="入职日期"
                        value={employee.entryDate || "待补"}
                      />
                      <Info label="证件号" value={maskIdNo(employee.idNo)} />
                      <Info
                        label="资料状态"
                        value={
                          missing.length === 0
                            ? "完整"
                            : `缺${missing.join("、")}`
                        }
                      />
                    </div>
                    <div className="mt-3">{actions(employee)}</div>
                  </article>
                );
              })}
            </div>
            {visibleEmployees.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                当前范围没有人员档案。
              </div>
            )}
            <OperationalPagination
              page={employeePage}
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
        <QuickLink
          icon={<WalletCards className="h-4 w-4" />}
          title="薪酬表"
          description="基于在职人员维护工资、个税与发放状态。"
          onClick={() => navigate("/payroll")}
        />
        <QuickLink
          icon={<ShieldCheck className="h-4 w-4" />}
          title="社保公积金"
          description="核验人员基数、单位缴费和个人缴费资料。"
          onClick={() => navigate("/social-security")}
        />
        <QuickLink
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          title="专项附加扣除"
          description="补齐子女教育、住房与赡养老人扣除资料。"
          onClick={() => navigate("/special-deductions")}
        />
      </section>
      {showEditor && (
        <EmployeeEditor
          draft={draft}
          editing={Boolean(editingEmployee)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveEmployee}
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

function EmployeeEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: EmployeeDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: EmployeeDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fields: Array<{
    key: keyof EmployeeDraft;
    label: string;
    required?: boolean;
    type?: string;
  }> = [
    { key: "employeeCode", label: "人员编码", required: true },
    { key: "name", label: "姓名", required: true },
    { key: "department", label: "部门" },
    { key: "position", label: "岗位" },
    { key: "mobile", label: "手机号" },
    { key: "idNo", label: "证件号" },
    { key: "entryDate", label: "入职日期", type: "date" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="人员档案编辑"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑人员档案" : "新增人员档案"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              人员资料会作为薪酬、社保和个税取数的前置依据。
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
                type={field.type || "text"}
                value={draft[field.key]}
                onChange={(event) =>
                  onChange({ ...draft, [field.key]: event.target.value })
                }
                className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
              />
            </label>
          ))}
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>任职状态</span>
            <select
              value={draft.employmentStatus}
              onChange={(event) =>
                onChange({ ...draft, employmentStatus: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            >
              <option value="在职">在职</option>
              <option value="离职">离职</option>
              <option value="停用">停用</option>
            </select>
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
            disabled={saving}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : editing ? "保存修改" : "保存人员"}
          </button>
        </footer>
      </form>
    </div>
  );
}
