import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  automationApi,
  type TaxDeclarationSchedule,
  type TaxDeclarationTask,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type Scope = "all" | "action" | "risk" | "complete";

function isCollected(task: TaxDeclarationTask) {
  return ["collected", "已取数"].includes(task.collectStatus);
}

function isConfirmed(task: TaxDeclarationTask) {
  return ["confirmed", "archived", "submitted", "completed"].includes(
    task.declarationStatus.toLowerCase(),
  );
}

function hasRisk(task: TaxDeclarationTask) {
  return task.riskCount > 0 || task.validationStatus === "failed";
}

function taskStage(task: TaxDeclarationTask) {
  if (task.receiptNo || task.declarationStatus.toLowerCase() === "archived")
    return "已归档";
  if (hasRisk(task)) return "风险待复核";
  if (isConfirmed(task)) return "已确认";
  if (task.validationStatus === "passed") return "待确认";
  if (isCollected(task)) return "待校验";
  return "待取数";
}

function stageClass(stage: string) {
  if (stage === "已归档" || stage === "已确认")
    return "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300";
  if (stage === "风险待复核")
    return "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300";
  if (stage === "待确认")
    return "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300";
  return "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";
}

function nextStep(task: TaxDeclarationTask) {
  if (task.receiptNo) return "复核回执";
  if (hasRisk(task)) return "处理风险";
  if (task.validationStatus === "passed" && !isConfirmed(task))
    return "确认申报";
  if (isCollected(task)) return "执行校验";
  return "生成取数快照";
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function DeclarationCalendarWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === currentPeriodId),
    [currentPeriodId, periods],
  );
  const browserPeriod = useMemo(
    () =>
      isTauri ? undefined : loadBrowserPreviewOpenPeriod(selectedCompanyId),
    [selectedCompanyId],
  );
  const activePeriod = isTauri ? selectedPeriod : browserPeriod;
  const currentPeriod = previewPeriodLabel(activePeriod);
  const companyId = selectedCompanyId || browserPeriod?.company_id || null;
  const hasScope = Boolean(companyId && currentPeriod);
  const [tasks, setTasks] = useState<TaxDeclarationTask[]>([]);
  const [schedules, setSchedules] = useState<TaxDeclarationSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [keyword, setKeyword] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    if (!companyId || !currentPeriod) {
      setTasks([]);
      setSchedules([]);
      return;
    }
    setLoading(true);
    try {
      const [taskResponse, scheduleResponse] = await Promise.all([
        automationApi.getTaxDeclarationTasks({
          companyId,
          period: currentPeriod,
        }),
        automationApi.getTaxDeclarationSchedules({
          companyId,
          period: currentPeriod,
        }),
      ]);
      if (!taskResponse.success)
        throw new Error(taskResponse.error || "无法读取申报事项");
      if (!scheduleResponse.success)
        throw new Error(scheduleResponse.error || "无法计算申报期限");
      setTasks(taskResponse.data || []);
      setSchedules(scheduleResponse.data || []);
    } catch (reason) {
      setTasks([]);
      setSchedules([]);
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [companyId, currentPeriod]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const metrics = useMemo(
    () => ({
      total: tasks.length,
      actionable: tasks.filter((task) => !isConfirmed(task) && !task.receiptNo)
        .length,
      risk: tasks.filter(hasRisk).length,
      complete: tasks.filter(
        (task) => isConfirmed(task) || Boolean(task.receiptNo),
      ).length,
    }),
    [tasks],
  );
  const scheduleByTaskId = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.taskId, schedule])),
    [schedules],
  );
  const visibleTasks = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return tasks
      .filter((task) => {
        const scopeMatches =
          scope === "all" ||
          (scope === "action" && !isConfirmed(task) && !task.receiptNo) ||
          (scope === "risk" && hasRisk(task)) ||
          (scope === "complete" &&
            (isConfirmed(task) || Boolean(task.receiptNo)));
        const textMatches =
          !term ||
          [
            task.taxType,
            task.formName,
            task.period,
            task.sourceSnapshot,
            task.adapterCode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term);
        return scopeMatches && textMatches;
      })
      .sort(
        (left, right) =>
          left.taxType.localeCompare(right.taxType, "zh-CN") ||
          left.formName.localeCompare(right.formName, "zh-CN"),
      );
  }, [keyword, scope, tasks]);
  const scopes = [
    { id: "all" as const, label: `全部 ${metrics.total}` },
    { id: "action" as const, label: `待处理 ${metrics.actionable}` },
    { id: "risk" as const, label: `风险 ${metrics.risk}` },
    { id: "complete" as const, label: `已完成 ${metrics.complete}` },
  ];

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className="min-w-0 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">申报日历</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              围绕当前账期组织税种申报事项，按已维护的法定来源规则计算期限并跟踪取数、校验、风险和确认节奏。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || !hasScope}
            className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新事项
          </button>
        </header>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              申报边界
            </div>
            <p className="mt-1">
              本页只读取申报事项、取数、校验和风险状态；不会登录税局、提交申报或发起扣款。申报确认须在申报工作台按受控流程执行。
            </p>
          </section>
          <section className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              当前排期范围
            </p>
            <p className="mt-1">
              {currentPeriod
                ? `${selectedCompany?.name || (isTauri ? "当前账套" : "浏览器预览账套")} · ${currentPeriod}`
                : "请先选择账套与开放账期。"}{" "}
              仅按已维护的期限规则和工作日覆盖计算；未配置规则时明确标记，不推测法定日期。
            </p>
          </section>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ListChecks}
            label="申报事项"
            value={`${metrics.total} 项`}
          />
          <Metric
            icon={CalendarDays}
            label="待处理"
            value={`${metrics.actionable} 项`}
            tone={
              metrics.actionable
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
          <Metric
            icon={CircleAlert}
            label="风险事项"
            value={`${metrics.risk} 项`}
            tone={metrics.risk ? "text-rose-600 dark:text-rose-400" : undefined}
          />
          <Metric
            icon={CheckCircle2}
            label="已完成"
            value={`${metrics.complete} 项`}
            tone={
              metrics.complete
                ? "text-emerald-600 dark:text-emerald-400"
                : undefined
            }
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-wrap gap-1">
            {scopes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={`h-8 border px-3 text-xs ${scope === item.id ? "border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative block">
            <span className="sr-only">搜索申报事项</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索税种、申报表或取数来源"
              className="h-8 w-full border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {error && <Notice value={`申报事项读取失败：${error}`} />}
        {!hasScope ? (
          <EmptyState
            message={
              isTauri
                ? "请选择账套和开放账期后查看申报排期。"
                : "请先在结账管理建立浏览器预览账期后查看申报排期。"
            }
          />
        ) : loading ? (
          <EmptyState message="正在读取当前账期的申报事项..." />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>当前账期申报节奏</span>
              <span>
                显示 {visibleTasks.length} / {tasks.length} 项
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[25%] px-4 py-3 font-medium">
                      税种与申报表
                    </th>
                    <th className="w-[12%] px-4 py-3 font-medium">所属期</th>
                    <th className="w-[14%] px-4 py-3 font-medium">处理阶段</th>
                    <th className="w-[18%] px-4 py-3 font-medium">
                      取数与校验
                    </th>
                    <th className="w-[13%] px-4 py-3 font-medium">应缴金额</th>
                    <th className="w-[18%] px-4 py-3 text-right font-medium">
                      下一步
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleTasks.map((task) => {
                    const stage = taskStage(task);
                    const schedule = scheduleByTaskId.get(task.id);
                    const deadline =
                      schedule && schedule.dueDate
                        ? schedule.dueDate
                        : "规则未配置";
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <p
                            className="truncate font-medium"
                            title={task.taxType}
                          >
                            {task.taxType}
                          </p>
                          <p
                            className="mt-0.5 truncate text-slate-500 dark:text-slate-400"
                            title={task.formName}
                          >
                            {task.formName}
                          </p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <p>{task.period}</p>
                          <p
                            className="mt-0.5 truncate text-slate-500 dark:text-slate-400"
                            title={
                              schedule?.calculationBasis ||
                              schedule?.sourceName ||
                              undefined
                            }
                          >
                            {deadline}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={stage} className={stageClass(stage)} />
                          <p
                            className="mt-1 truncate text-slate-500 dark:text-slate-400"
                            title={task.adapterCode || undefined}
                          >
                            {task.adapterCode || "未关联申报渠道"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p>
                            {isCollected(task) ? "已取数" : "未取数"} ·{" "}
                            {task.validationStatus === "passed"
                              ? "校验通过"
                              : task.validationStatus === "failed"
                                ? "校验失败"
                                : "待校验"}
                          </p>
                          <p
                            className={`mt-0.5 ${hasRisk(task) ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}
                          >
                            {hasRisk(task)
                              ? `${task.riskCount || 1} 项风险待复核`
                              : task.sourceSnapshot || "未记录取数快照"}
                          </p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatAmount(task.payableAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate("/tax/workspace")}
                            className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {nextStep(task)}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {visibleTasks.map((task) => {
                const stage = taskStage(task);
                const schedule = scheduleByTaskId.get(task.id);
                const deadline = schedule?.dueDate || "规则未配置";
                return (
                  <article
                    key={task.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium"
                          title={task.taxType}
                        >
                          {task.taxType}
                        </p>
                        <p
                          className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                          title={task.formName}
                        >
                          {task.formName} · {task.period}
                        </p>
                      </div>
                      <Badge value={stage} className={stageClass(stage)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Info
                        label="取数与校验"
                        value={`${isCollected(task) ? "已取数" : "未取数"} · ${task.validationStatus === "passed" ? "通过" : task.validationStatus === "failed" ? "失败" : "待校验"}`}
                      />
                      <Info
                        label="应缴金额"
                        value={formatAmount(task.payableAmount)}
                      />
                      <Info
                        label="风险"
                        value={
                          hasRisk(task)
                            ? `${task.riskCount || 1} 项待复核`
                            : "无"
                        }
                      />
                      <Info label="截止日" value={deadline} />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/tax/workspace")}
                      className="mt-3 inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {nextStep(task)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                );
              })}
            </div>
            {visibleTasks.length === 0 && (
              <EmptyState
                message={
                  tasks.length
                    ? "当前筛选条件没有匹配的申报事项。"
                    : "当前账期没有申报事项。请在申报工作台完成初始化或导入后返回查看。"
                }
              />
            )}
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={ListChecks}
          title="申报工作台"
          description="维护取数、校验和受控确认流程。"
          onClick={() => navigate("/tax/workspace")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="申报初始化"
          description="维护税种认定、周期和本地授权状态。"
          onClick={() => navigate("/settings/tax-init")}
        />
        <QuickLink
          icon={CalendarDays}
          title="回执缴款书"
          description="查看已确认事项的回执、缴款与归档状态。"
          onClick={() => navigate("/tax/receipts")}
        />
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
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
    <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
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
  icon: LucideIcon;
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
