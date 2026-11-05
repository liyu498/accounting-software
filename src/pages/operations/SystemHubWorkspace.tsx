import {
  BellRing,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  FileCog,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { companyTodoApi, type CompanyTodo } from "../../lib/api";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";
import { useReportTemplateStore } from "../../stores/reportTemplateStore";

type TodoScope = "all" | CompanyTodo["status"];
type TodoDraft = Pick<
  CompanyTodo,
  | "title"
  | "sourceModule"
  | "priority"
  | "owner"
  | "dueDate"
  | "relatedEntry"
  | "evidence"
  | "note"
>;

const PREVIEW_COMPANY_ID = "browser-preview-company";
const PREVIEW_TODO_STORAGE_KEY = "accounting-system-hub-todos-v1";

const emptyTodoDraft: TodoDraft = {
  title: "",
  sourceModule: "资料采集",
  priority: "normal",
  owner: "",
  dueDate: "",
  relatedEntry: "",
  evidence: "",
  note: "",
};

function readPreviewTodos() {
  if (typeof window === "undefined") return [] as CompanyTodo[];
  try {
    const stored = window.localStorage.getItem(PREVIEW_TODO_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CompanyTodo[]) : [];
  } catch {
    return [] as CompanyTodo[];
  }
}

function writePreviewTodos(todos: CompanyTodo[]) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(
      PREVIEW_TODO_STORAGE_KEY,
      JSON.stringify(todos),
    );
}

function writePreviewTodosForScope(
  companyId: string,
  period: string,
  todos: CompanyTodo[],
) {
  const otherScopes = readPreviewTodos().filter(
    (todo) => todo.companyId !== companyId || todo.period !== period,
  );
  writePreviewTodos([...otherScopes, ...todos]);
}

function periodLabel(
  period: { period_year: number; period_month: number } | undefined,
) {
  return period
    ? `${period.period_year}-${String(period.period_month).padStart(2, "0")}`
    : "未选择账期";
}

function formatDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}

function todoStatusLabel(status: CompanyTodo["status"]) {
  return {
    open: "待处理",
    review: "待复核",
    blocked: "已阻断",
    completed: "已完成",
  }[status];
}

function todoStatusClass(status: CompanyTodo["status"]) {
  if (status === "completed")
    return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300";
  if (status === "blocked")
    return "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300";
  if (status === "review")
    return "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300";
  return "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300";
}

function priorityLabel(priority: CompanyTodo["priority"]) {
  return { normal: "普通", high: "高", blocking: "阻断" }[priority];
}

function priorityClass(priority: CompanyTodo["priority"]) {
  if (priority === "blocking")
    return "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300";
  if (priority === "high")
    return "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300";
  return "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";
}

function sourceRoute(sourceModule: string) {
  if (sourceModule.includes("发票")) return "/invoices/input";
  if (sourceModule.includes("凭证")) return "/vouchers";
  if (sourceModule.includes("申报") || sourceModule.includes("税"))
    return "/tax/workspace";
  if (sourceModule.includes("银行") || sourceModule.includes("流水"))
    return "/bank";
  if (sourceModule.includes("结账")) return "/period-closing";
  if (sourceModule.includes("报表")) return "/reports";
  return "/dashboard";
}

function useScope() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const fetchCompanies = useCompanyStore((state) => state.fetchCompanies);
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const currentPeriod = periods.find((item) => item.id === currentPeriodId);
  const companyId = selectedCompanyId || (isTauri ? null : PREVIEW_COMPANY_ID);

  useEffect(() => {
    if (isTauri) void fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    if (selectedCompanyId) void fetchPeriods(selectedCompanyId);
  }, [fetchPeriods, selectedCompanyId]);

  return {
    companyId,
    companyName:
      selectedCompany?.name || (isTauri ? "未选择账套" : "浏览器预览账套"),
    currentPeriod,
    periodLabel: periodLabel(currentPeriod),
    selectedCompany,
  };
}

export function NotificationCenterWorkspace() {
  const navigate = useNavigate();
  const {
    companyId,
    companyName,
    periodLabel: currentPeriodLabel,
  } = useScope();
  const [todos, setTodos] = useState<CompanyTodo[]>([]);
  const [scope, setScope] = useState<TodoScope>("all");
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState<TodoDraft>(emptyTodoDraft);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setTodos([]);
      setNotice("请选择账套后查看待办。");
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      if (!isTauri) {
        setTodos(
          readPreviewTodos().filter(
            (todo) =>
              todo.companyId === companyId &&
              todo.period === currentPeriodLabel,
          ),
        );
        return;
      }
      const response = await companyTodoApi.getAll({
        companyId,
        period: currentPeriodLabel,
      });
      if (!response.success) throw new Error(response.error || "无法读取待办");
      setTodos(response.data || []);
    } catch (error) {
      setTodos([]);
      setNotice(`待办读取失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, currentPeriodLabel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(
    () => ({
      total: todos.length,
      open: todos.filter((todo) => todo.status === "open").length,
      review: todos.filter((todo) => todo.status === "review").length,
      blocked: todos.filter((todo) => todo.status === "blocked").length,
    }),
    [todos],
  );

  const visibleTodos = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase();
    return todos.filter((todo) => {
      const scopeMatches = scope === "all" || todo.status === scope;
      const termMatches =
        !term ||
        [
          todo.title,
          todo.sourceModule,
          todo.owner,
          todo.relatedEntry,
          todo.evidence,
          todo.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(term);
      return scopeMatches && termMatches;
    });
  }, [keyword, scope, todos]);
  const todoPage = useMemo(
    () => paginateOperationalRows(visibleTodos, page, pageSize),
    [page, pageSize, visibleTodos],
  );
  const exportHeaders = [
    "事项",
    "来源模块",
    "优先级",
    "负责人",
    "截止日期",
    "关联依据",
    "状态",
    "补充说明",
    "完成时间",
  ];
  const exportRows = useMemo(
    () =>
      visibleTodos.map((todo) => [
        todo.title,
        todo.sourceModule,
        priorityLabel(todo.priority),
        todo.owner || "未指定",
        formatDate(todo.dueDate),
        todo.relatedEntry || todo.evidence || "未关联",
        todoStatusLabel(todo.status),
        todo.note || "无补充说明",
        formatDate(todo.completedAt),
      ]),
    [visibleTodos],
  );

  const submitTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套，再新建待办。");
      return;
    }
    if (!draft.title.trim()) {
      setNotice("请填写待办事项。");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (!isTauri) {
        const timestamp = new Date().toISOString();
        const todo: CompanyTodo = {
          id: `preview-todo-${Date.now()}`,
          companyId,
          companyName,
          period: currentPeriodLabel,
          title: draft.title.trim(),
          sourceModule: draft.sourceModule.trim() || "未标记模块",
          priority: draft.priority,
          owner: draft.owner.trim() || null,
          dueDate: draft.dueDate || null,
          relatedEntry: draft.relatedEntry.trim() || null,
          evidence: draft.evidence.trim() || null,
          note: draft.note.trim() || null,
          status: "open",
          completedAt: null,
          completedBy: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const next = [todo, ...todos];
        writePreviewTodosForScope(companyId, currentPeriodLabel, next);
        setTodos(next);
      } else {
        const response = await companyTodoApi.create({
          companyId,
          period: currentPeriodLabel,
          title: draft.title.trim(),
          sourceModule: draft.sourceModule.trim() || "未标记模块",
          priority: draft.priority,
          owner: draft.owner.trim() || undefined,
          dueDate: draft.dueDate || undefined,
          relatedEntry: draft.relatedEntry.trim() || undefined,
          evidence: draft.evidence.trim() || undefined,
          note: draft.note.trim() || undefined,
        });
        if (!response.success || !response.data)
          throw new Error(response.error || "待办保存失败");
        setTodos((current) => [
          response.data!,
          ...current.filter((todo) => todo.id !== response.data!.id),
        ]);
      }
      setDraft(emptyTodoDraft);
      setShowCreate(false);
      setNotice("待办已保存到当前账套与账期；不会发送短信、邮件或外部消息。");
    } catch (error) {
      setNotice(`待办保存失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const completeTodo = async (todo: CompanyTodo) => {
    if (!companyId || todo.status === "completed") return;
    setSaving(true);
    setNotice(null);
    try {
      if (!isTauri) {
        const timestamp = new Date().toISOString();
        const next = todos.map((item) =>
          item.id === todo.id
            ? {
                ...item,
                status: "completed" as const,
                completedAt: timestamp,
                completedBy: "本地预览用户",
                updatedAt: timestamp,
              }
            : item,
        );
        writePreviewTodosForScope(companyId, currentPeriodLabel, next);
        setTodos(next);
      } else {
        const response = await companyTodoApi.complete({
          id: todo.id,
          companyId,
        });
        if (!response.success || !response.data)
          throw new Error(response.error || "待办完成失败");
        setTodos((current) =>
          current.map((item) =>
            item.id === response.data!.id ? response.data! : item,
          ),
        );
      }
      setNotice("待办已标记完成；原始业务仍需到对应模块复核。");
    } catch (error) {
      setNotice(`待办完成失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const scopeTabs: Array<{ id: TodoScope; label: string }> = [
    { id: "all", label: `全部 ${summary.total}` },
    { id: "open", label: `待处理 ${summary.open}` },
    { id: "review", label: `待复核 ${summary.review}` },
    { id: "blocked", label: `已阻断 ${summary.blocked}` },
    { id: "completed", label: "已完成" },
  ];

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">通知待办</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              聚合当前账套与账期的资料、复核、风险和申报事项。处理动作仅更新待办状态，原始业务须回到对应模块处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="通知待办清单"
              companyName={companyName}
              periodLabel={currentPeriodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyTodoDraft);
                setShowCreate(true);
              }}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
            >
              <ClipboardPlus className="h-3.5 w-3.5" />
              新建待办
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={BellRing}
            label="待办总数"
            value={`${summary.total} 条`}
          />
          <Metric
            icon={Clock3}
            label="待处理"
            value={`${summary.open} 条`}
            tone={summary.open ? "text-sky-600 dark:text-sky-400" : undefined}
          />
          <Metric
            icon={ShieldCheck}
            label="待复核"
            value={`${summary.review} 条`}
            tone={
              summary.review ? "text-amber-600 dark:text-amber-400" : undefined
            }
          />
          <Metric
            icon={CheckCircle2}
            label="已阻断"
            value={`${summary.blocked} 条`}
            tone={
              summary.blocked ? "text-rose-600 dark:text-rose-400" : undefined
            }
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {scopeTabs.map((item) => (
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
          <label className="relative block w-full lg:w-80">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索事项、模块、负责人或关联依据"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
          当前范围：{companyName} · {currentPeriodLabel}
          。不会发送短信、邮件或外部消息。
        </div>
        {notice && <Notice value={notice} />}
        {showCreate && (
          <TodoForm
            draft={draft}
            saving={saving}
            onChange={setDraft}
            onClose={() => setShowCreate(false)}
            onSubmit={submitTodo}
          />
        )}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>待办清单</span>
          <span>
            当前显示 {visibleTodos.length} / {todos.length} 条
          </span>
        </div>
        {loading ? (
          <EmptyState message="正在读取当前账套待办..." />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[24%] px-4 py-3 font-medium">事项</th>
                    <th className="w-[12%] px-4 py-3 font-medium">来源模块</th>
                    <th className="w-[9%] px-4 py-3 font-medium">优先级</th>
                    <th className="w-[11%] px-4 py-3 font-medium">负责人</th>
                    <th className="w-[12%] px-4 py-3 font-medium">截止日期</th>
                    <th className="w-[15%] px-4 py-3 font-medium">关联依据</th>
                    <th className="w-[9%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[8%] px-4 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todoPage.rows.map((todo) => (
                    <tr
                      key={todo.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <p className="truncate font-medium" title={todo.title}>
                          {todo.title}
                        </p>
                        <p
                          className="mt-0.5 truncate text-slate-500 dark:text-slate-400"
                          title={todo.note || undefined}
                        >
                          {todo.note || "无补充说明"}
                        </p>
                      </td>
                      <td
                        className="truncate px-4 py-3"
                        title={todo.sourceModule}
                      >
                        {todo.sourceModule}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={priorityLabel(todo.priority)}
                          className={priorityClass(todo.priority)}
                        />
                      </td>
                      <td
                        className="truncate px-4 py-3"
                        title={todo.owner || undefined}
                      >
                        {todo.owner || "未指定"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(todo.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className="truncate"
                          title={
                            todo.relatedEntry || todo.evidence || undefined
                          }
                        >
                          {todo.relatedEntry || todo.evidence || "未关联"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={todoStatusLabel(todo.status)}
                          className={todoStatusClass(todo.status)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(sourceRoute(todo.sourceModule))
                            }
                            className="text-xs text-[#1f65a7] hover:underline dark:text-sky-400"
                          >
                            处理
                          </button>
                          {todo.status !== "completed" && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void completeTodo(todo)}
                              className="text-xs text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-300"
                            >
                              完成
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {todoPage.rows.map((todo) => (
                <article
                  key={todo.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {todo.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {todo.sourceModule} · {todo.owner || "未指定负责人"}
                      </p>
                    </div>
                    <Badge
                      value={todoStatusLabel(todo.status)}
                      className={todoStatusClass(todo.status)}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info label="优先级" value={priorityLabel(todo.priority)} />
                    <Info label="截止日期" value={formatDate(todo.dueDate)} />
                    <Info
                      label="关联事项"
                      value={todo.relatedEntry || todo.evidence || "未关联"}
                    />
                    <Info
                      label="完成时间"
                      value={formatDate(todo.completedAt)}
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => navigate(sourceRoute(todo.sourceModule))}
                      className="text-[#1f65a7] dark:text-sky-400"
                    >
                      前往处理
                    </button>
                    {todo.status !== "completed" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void completeTodo(todo)}
                        className="text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                      >
                        标记完成
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {visibleTodos.length === 0 && (
              <EmptyState
                message={
                  todos.length
                    ? "当前筛选条件没有匹配的待办。"
                    : "当前账套和账期没有待办记录。新建待办后可在此统一复核处理进度。"
                }
              />
            )}
            <OperationalPagination
              page={todoPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
    </main>
  );
}

export function SettingsOverviewWorkspace() {
  const navigate = useNavigate();
  const {
    companyId,
    companyName,
    currentPeriod,
    periodLabel: currentPeriodLabel,
    selectedCompany,
  } = useScope();
  const reportTemplates = useReportTemplateStore(
    (state) => state.reportTemplates,
  );
  const reportItems = useReportTemplateStore((state) => state.reportItems);
  const loading = useReportTemplateStore((state) => state.isLoading);
  const fetchReportTemplateWorkspace = useReportTemplateStore(
    (state) => state.fetchReportTemplateWorkspace,
  );

  useEffect(() => {
    if (companyId && isTauri) void fetchReportTemplateWorkspace(companyId);
  }, [companyId, fetchReportTemplateWorkspace]);

  const settings = [
    {
      icon: Landmark,
      title: "账套主体",
      value: selectedCompany?.name || "未选择账套",
      detail: selectedCompany
        ? `${selectedCompany.code} · ${selectedCompany.tax_id || "未填写纳税人识别号"}`
        : "请选择账套后维护主体资料。",
      path: "/settings/company-info",
      action: "维护主体",
    },
    {
      icon: Clock3,
      title: "当前账期",
      value: currentPeriodLabel,
      detail: currentPeriod
        ? `${currentPeriod.start_date} 至 ${currentPeriod.end_date} · ${currentPeriod.status}`
        : "当前未设置账期。",
      path: "/settings/period-management",
      action: "维护账期",
    },
    {
      icon: FileCog,
      title: "会计科目",
      value: selectedCompany?.accounting_system || "未设置会计制度",
      detail: "科目编码、辅助核算和凭证模板在对应维护页管理。",
      path: "/settings/account-codes",
      action: "维护科目",
    },
    {
      icon: FileText,
      title: "报表模板",
      value: loading ? "正在读取" : `${reportTemplates.length} 个模板`,
      detail: loading
        ? "正在读取当前账套模板与报表项目。"
        : `${reportItems.length} 个报表项目已加载。`,
      path: "/settings/report-formulas",
      action: "维护模板",
    },
    {
      icon: UsersRound,
      title: "账套权限",
      value: "角色与用户管理",
      detail: "角色分配、用户权限和审计范围在受控页面维护。",
      path: "/settings/roles",
      action: "配置权限",
    },
    {
      icon: ShieldCheck,
      title: "授权与规则",
      value: "税务、银行与匹配规则",
      detail: "外部授权、匹配规则和结算策略须逐项维护并留痕。",
      path: "/settings/tax-adapters",
      action: "查看授权",
    },
  ];

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">设置总览</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              查看当前账套的启用范围与配置状态，并进入对应功能维护。设置总览不直接修改业务数据。
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings/company-info")}
            className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings2 className="h-3.5 w-3.5" />
            账套资料
          </button>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
          <Metric icon={Landmark} label="当前账套" value={companyName} />
          <Metric icon={Clock3} label="账期范围" value={currentPeriodLabel} />
          <Metric
            icon={FileCog}
            label="模板状态"
            value={loading ? "读取中" : `${reportTemplates.length} 个`}
          />
        </div>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
          配置范围：{companyName} · {currentPeriodLabel}
          。修改会计制度、账期、权限或外部授权时，将在对应受控模块执行并保留审计记录。
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3 dark:bg-slate-800">
          {settings.map((setting) => (
            <button
              key={setting.title}
              type="button"
              onClick={() => navigate(setting.path)}
              className="group min-w-0 bg-white p-4 text-left hover:bg-sky-50 dark:bg-[#111827] dark:hover:bg-sky-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <setting.icon className="h-4 w-4 shrink-0 text-[#1f65a7] dark:text-sky-400" />
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#1f65a7] dark:group-hover:text-sky-400" />
              </div>
              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
                {setting.title}
              </p>
              <p
                className="mt-1 truncate text-sm font-semibold"
                title={setting.value}
              >
                {setting.value}
              </p>
              <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {setting.detail}
              </p>
              <span className="mt-3 inline-flex text-xs text-[#1f65a7] dark:text-sky-400">
                {setting.action}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={CheckCheck}
          title="期初与迁移"
          description="录入期初余额、税务初始化和历史数据迁移，完成前置校验后再启用。"
          onClick={() => navigate("/settings/initial-balances")}
        />
        <QuickLink
          icon={SlidersHorizontal}
          title="规则与模板"
          description="维护匹配、结算、现金流、打印与凭证模板，避免以总览页直接写入配置。"
          onClick={() => navigate("/settings/invoice-rules")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="审计与恢复"
          description="查看配置留痕、下载备份并执行受控恢复，业务数据不会在此页直接变更。"
          onClick={() => navigate("/settings/audit-log")}
        />
      </section>
    </main>
  );
}

function TodoForm({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: TodoDraft;
  saving: boolean;
  onChange: (next: TodoDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <form
      onSubmit={onSubmit}
      className="border-b border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">新建账套待办</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            待办只用于汇总跟踪，不会替代原始模块的审核、申报或结账动作。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="关闭新建待办"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="待办事项">
          <input
            required
            value={draft.title}
            onChange={(event) =>
              onChange({ ...draft, title: event.target.value })
            }
            className={inputClass}
            placeholder="例如：复核进项发票税率"
          />
        </Field>
        <Field label="来源模块">
          <input
            value={draft.sourceModule}
            onChange={(event) =>
              onChange({ ...draft, sourceModule: event.target.value })
            }
            className={inputClass}
          />
        </Field>
        <Field label="优先级">
          <select
            value={draft.priority}
            onChange={(event) =>
              onChange({
                ...draft,
                priority: event.target.value as CompanyTodo["priority"],
              })
            }
            className={inputClass}
          >
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="blocking">阻断</option>
          </select>
        </Field>
        <Field label="负责人">
          <input
            value={draft.owner}
            onChange={(event) =>
              onChange({ ...draft, owner: event.target.value })
            }
            className={inputClass}
            placeholder="选填"
          />
        </Field>
        <Field label="截止日期">
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) =>
              onChange({ ...draft, dueDate: event.target.value })
            }
            className={inputClass}
          />
        </Field>
        <Field label="关联事项">
          <input
            value={draft.relatedEntry}
            onChange={(event) =>
              onChange({ ...draft, relatedEntry: event.target.value })
            }
            className={inputClass}
            placeholder="单据、凭证或任务编号"
          />
        </Field>
        <Field label="处理依据">
          <input
            value={draft.evidence}
            onChange={(event) =>
              onChange({ ...draft, evidence: event.target.value })
            }
            className={inputClass}
            placeholder="选填"
          />
        </Field>
        <Field label="补充说明">
          <input
            value={draft.note}
            onChange={(event) =>
              onChange({ ...draft, note: event.target.value })
            }
            className={inputClass}
            placeholder="选填"
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
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
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "正在保存" : "保存待办"}
        </button>
      </div>
    </form>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: typeof BellRing;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p
        className={`mt-1 truncate text-xl font-semibold ${tone}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
function Badge({ value, className }: { value: string; className: string }) {
  return (
    <span
      className={`inline-flex shrink-0 border px-2 py-0.5 text-xs ${className}`}
    >
      {value}
    </span>
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-xs">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
function Notice({ value }: { value: string }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
      {value}
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
function QuickLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof BellRing;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
