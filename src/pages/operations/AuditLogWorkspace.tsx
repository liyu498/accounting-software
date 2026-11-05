import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileDown,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { automationApi, type OperationAuditLog } from "../../lib/api";
import { useAuditLogs, type AuditLog } from "../../lib/exportJobs";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";

type AuditRecord = {
  id: string;
  createdAt: string;
  operator: string;
  moduleName: string;
  action: string;
  objectRef: string;
  riskLevel: "normal" | "medium" | "high" | "critical";
  result: "success" | "pending" | "failed";
  detail: string;
  companyName: string;
};

type Scope = "all" | "highRisk" | "pending" | "failed";

function normalizeRisk(
  value: string | null | undefined,
): AuditRecord["riskLevel"] {
  const normalized = (value || "").toLowerCase();
  if (normalized === "critical" || value === "严重") return "critical";
  if (normalized === "high" || value === "高") return "high";
  if (normalized === "medium" || value === "中") return "medium";
  return "normal";
}

function normalizeResult(
  value: string | null | undefined,
): AuditRecord["result"] {
  const normalized = (value || "").toLowerCase();
  if (["failed", "error", "rejected", "失败"].includes(normalized))
    return "failed";
  if (["pending", "review", "待审批", "待确认"].includes(normalized))
    return "pending";
  return "success";
}

function fromOperationAudit(log: OperationAuditLog): AuditRecord {
  return {
    id: log.id,
    createdAt: log.createdAt,
    operator: log.operator || "系统",
    moduleName: log.moduleName || "未标记模块",
    action: log.action || "未标记动作",
    objectRef: log.objectRef || "未标记对象",
    riskLevel: normalizeRisk(log.riskLevel),
    result: normalizeResult(log.result),
    detail: log.detail || "后端审计记录",
    companyName: log.companyName || "当前账套",
  };
}

function fromBrowserAudit(log: AuditLog): AuditRecord {
  return {
    id: log.id,
    createdAt: log.time,
    operator: log.operator || "本地预览用户",
    moduleName: log.module || "未标记模块",
    action: log.action || "未标记动作",
    objectRef: log.object || "未标记对象",
    riskLevel: normalizeRisk(log.level),
    result: normalizeResult(log.result),
    detail:
      [log.attachment, log.terminal].filter(Boolean).join(" · ") ||
      "浏览器本地留痕",
    companyName: "浏览器预览账套",
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "未记录"
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

function riskLabel(value: AuditRecord["riskLevel"]) {
  return {
    normal: "普通",
    medium: "中风险",
    high: "高风险",
    critical: "严重风险",
  }[value];
}

function resultLabel(value: AuditRecord["result"]) {
  return { success: "已完成", pending: "待复核", failed: "失败" }[value];
}

function riskClass(value: AuditRecord["riskLevel"]) {
  if (value === "critical" || value === "high")
    return "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300";
  if (value === "medium")
    return "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300";
  return "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";
}

function resultClass(value: AuditRecord["result"]) {
  if (value === "failed")
    return "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300";
  if (value === "pending")
    return "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300";
  return "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300";
}

export function AuditLogWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const browserLogs = useAuditLogs();
  const [liveLogs, setLiveLogs] = useState<OperationAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [scope, setScope] = useState<Scope>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!isTauri) return;
    if (!selectedCompanyId) {
      setLiveLogs([]);
      setReadError(null);
      return;
    }
    setLoading(true);
    setReadError(null);
    try {
      const response = await automationApi.getOperationAuditLogs({
        companyId: selectedCompanyId,
      });
      if (!response.success)
        throw new Error(response.error || "无法读取审计记录");
      setLiveLogs(response.data || []);
    } catch (error) {
      setLiveLogs([]);
      setReadError(String(error));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const records = useMemo(() => {
    const source = isTauri
      ? liveLogs.map(fromOperationAudit)
      : browserLogs.map(fromBrowserAudit);
    return source
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [browserLogs, liveLogs]);
  const modules = useMemo(
    () =>
      [...new Set(records.map((record) => record.moduleName))].sort(
        (left, right) => left.localeCompare(right, "zh-CN"),
      ),
    [records],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      highRisk: records.filter(
        (record) =>
          record.riskLevel === "high" || record.riskLevel === "critical",
      ).length,
      pending: records.filter((record) => record.result === "pending").length,
      failed: records.filter((record) => record.result === "failed").length,
    }),
    [records],
  );
  const visibleRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const scopeMatches =
        scope === "all" ||
        (scope === "highRisk" &&
          ["high", "critical"].includes(record.riskLevel)) ||
        (scope === "pending" && record.result === "pending") ||
        (scope === "failed" && record.result === "failed");
      const moduleMatches =
        moduleFilter === "all" || record.moduleName === moduleFilter;
      const textMatches =
        !term ||
        [
          record.createdAt,
          record.operator,
          record.moduleName,
          record.action,
          record.objectRef,
          record.detail,
          record.companyName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return scopeMatches && moduleMatches && textMatches;
    });
  }, [keyword, moduleFilter, records, scope]);
  const auditPage = useMemo(
    () => paginateOperationalRows(visibleRecords, page, pageSize),
    [page, pageSize, visibleRecords],
  );
  const exportHeaders = [
    "记录时间",
    "操作人",
    "模块",
    "动作",
    "对象引用",
    "账套范围",
    "风险级别",
    "处理结果",
    "留痕说明",
  ];
  const exportRows = useMemo(
    () =>
      visibleRecords.map((record) => [
        formatDateTime(record.createdAt),
        record.operator,
        record.moduleName,
        record.action,
        record.objectRef,
        record.companyName,
        riskLabel(record.riskLevel),
        resultLabel(record.result),
        record.detail,
      ]),
    [visibleRecords],
  );
  const scopes = [
    { id: "all" as const, label: `全部 ${metrics.total}` },
    { id: "highRisk" as const, label: `高风险 ${metrics.highRisk}` },
    { id: "pending" as const, label: `待复核 ${metrics.pending}` },
    { id: "failed" as const, label: `失败 ${metrics.failed}` },
  ];

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">审计日志</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              追溯当前账套的导入导出、凭证、结账、申报与高风险操作，按记录时间、操作主体和处理结果复核。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="审计日志"
              companyName={selectedCompany?.name}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新记录
            </button>
          </div>
        </header>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
            <p className="font-medium">审计边界</p>
            <p className="mt-1">
              审计日志只读展示系统已写入的留痕，不提供新增、修改、删除或覆盖历史记录。业务动作须回到对应模块处理后才会产生新的审计事件。
            </p>
          </div>
          <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            当前范围：
            {isTauri ? selectedCompany?.name || "未选择账套" : "浏览器本地预览"}
            。日志包含对象引用和说明，不展示税局、银行或其他敏感凭据。
          </p>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ClipboardList}
            label="日志条数"
            value={`${metrics.total} 条`}
          />
          <Metric
            icon={AlertTriangle}
            label="高风险"
            value={`${metrics.highRisk} 条`}
            tone={
              metrics.highRisk ? "text-rose-600 dark:text-rose-400" : undefined
            }
          />
          <Metric
            icon={Clock3}
            label="待复核"
            value={`${metrics.pending} 条`}
            tone={
              metrics.pending ? "text-amber-600 dark:text-amber-400" : undefined
            }
          />
          <Metric
            icon={CheckCircle2}
            label="失败记录"
            value={`${metrics.failed} 条`}
            tone={
              metrics.failed
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_11rem_21rem]">
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
          <select
            aria-label="审计模块"
            value={moduleFilter}
            onChange={(event) => {
              setModuleFilter(event.target.value);
              setPage(1);
            }}
            className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
          >
            <option value="all">全部模块</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索操作人、模块、动作、对象或说明"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {isTauri && !selectedCompanyId && (
          <EmptyState message="请选择账套后查看审计日志。" />
        )}
        {isTauri && selectedCompanyId && loading && (
          <EmptyState message="正在读取当前账套审计记录..." />
        )}
        {readError && <Notice value={`审计日志读取失败：${readError}`} />}
        {(!isTauri || selectedCompanyId) && !loading && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>审计记录</span>
              <span>
                当前显示 {visibleRecords.length} / {records.length} 条
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[13%] px-4 py-3 font-medium">记录时间</th>
                    <th className="w-[10%] px-4 py-3 font-medium">操作人</th>
                    <th className="w-[12%] px-4 py-3 font-medium">模块</th>
                    <th className="w-[13%] px-4 py-3 font-medium">动作</th>
                    <th className="w-[17%] px-4 py-3 font-medium">对象引用</th>
                    <th className="w-[10%] px-4 py-3 font-medium">风险级别</th>
                    <th className="w-[10%] px-4 py-3 font-medium">处理结果</th>
                    <th className="w-[15%] px-4 py-3 font-medium">留痕说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 tabular-nums">
                        {formatDateTime(record.createdAt)}
                      </td>
                      <td
                        className="truncate px-4 py-3"
                        title={record.operator}
                      >
                        {record.operator}
                      </td>
                      <td
                        className="truncate px-4 py-3"
                        title={record.moduleName}
                      >
                        {record.moduleName}
                      </td>
                      <td className="truncate px-4 py-3" title={record.action}>
                        {record.action}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate" title={record.objectRef}>
                          {record.objectRef}
                        </p>
                        <p
                          className="mt-0.5 truncate text-slate-500 dark:text-slate-400"
                          title={record.companyName}
                        >
                          {record.companyName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={riskLabel(record.riskLevel)}
                          className={riskClass(record.riskLevel)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={resultLabel(record.result)}
                          className={resultClass(record.result)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className="truncate text-slate-600 dark:text-slate-300"
                          title={record.detail}
                        >
                          {record.detail}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {auditPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {record.action}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(record.createdAt)} · {record.operator}
                      </p>
                    </div>
                    <Badge
                      value={resultLabel(record.result)}
                      className={resultClass(record.result)}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info label="模块" value={record.moduleName} />
                    <Info
                      label="风险级别"
                      value={riskLabel(record.riskLevel)}
                    />
                    <Info label="对象引用" value={record.objectRef} />
                    <Info label="账套范围" value={record.companyName} />
                  </div>
                  <p className="mt-3 break-words border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {record.detail}
                  </p>
                </article>
              ))}
            </div>
            {visibleRecords.length === 0 && (
              <EmptyState
                message={
                  records.length
                    ? "当前筛选条件没有匹配的审计记录。"
                    : "当前没有可展示的审计记录。请在业务模块完成操作后回到此处复核留痕。"
                }
              />
            )}
            <OperationalPagination
              page={auditPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}{" "}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={FileDown}
          title="下载中心"
          description="复核已生成的导出任务、文件范围和下载留痕。"
          onClick={() => navigate("/downloads")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="结账管理"
          description="查看结账、反结账与锁定操作的前置校验记录。"
          onClick={() => navigate("/settings/period-management")}
        />
        <QuickLink
          icon={History}
          title="凭证回收箱"
          description="复核凭证恢复操作及其后续审核状态。"
          onClick={() => navigate("/settings/voucher-recycle")}
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
