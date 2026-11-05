import {
  ArchiveRestore,
  CircleAlert,
  ClipboardList,
  FileText,
  History,
  Paperclip,
  RefreshCw,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { useVoucherStore, type Voucher } from "../../stores/voucherStore";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

function daysSince(value: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp)
    ? 0
    : Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
}

function statusClass(status: string) {
  if (status.includes("审核") || status === "approved")
    return "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300";
  if (status.includes("异常") || status.includes("拒绝"))
    return "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300";
  return "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";
}

export function VoucherRecycleWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const getDeletedVouchers = useVoucherStore(
    (state) => state.getDeletedVouchers,
  );
  const restoreVoucher = useVoucherStore((state) => state.restoreVoucher);
  const storeError = useVoucherStore((state) => state.error);
  const [deletedVouchers, setDeletedVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<
    "all" | "recent" | "attachments" | "older"
  >("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setDeletedVouchers([]);
      return;
    }
    setLoading(true);
    try {
      setDeletedVouchers(await getDeletedVouchers(companyId));
    } finally {
      setLoading(false);
    }
  }, [companyId, getDeletedVouchers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const vouchers = deletedVouchers;
  const filteredVouchers = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const age = daysSince(voucher.deleted_at);
      const matchesTerm =
        !term ||
        [
          voucher.voucher_number,
          voucher.summary || "",
          voucher.voucher_date,
          voucher.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesScope =
        scope === "all" ||
        (scope === "recent" && age <= 7) ||
        (scope === "attachments" && voucher.attachment_count > 0) ||
        (scope === "older" && age > 30);
      return matchesTerm && matchesScope;
    });
  }, [keyword, scope, vouchers]);
  const recyclePage = useMemo(
    () => paginateOperationalRows(filteredVouchers, page, pageSize),
    [filteredVouchers, page, pageSize],
  );
  const exportHeaders = [
    "凭证号",
    "凭证日期",
    "摘要",
    "分录数",
    "借贷金额",
    "附件数",
    "原状态",
    "删除时间",
    "回收时长",
  ];
  const exportRows = useMemo(
    () =>
      filteredVouchers.map((voucher) => [
        voucher.voucher_number,
        voucher.voucher_date,
        voucher.summary || "未填写摘要",
        `${voucher.entries.length} 条`,
        formatCurrency(voucher.total_debit),
        `${voucher.attachment_count} 个`,
        voucher.status || "未记录",
        formatDateTime(voucher.deleted_at),
        `${daysSince(voucher.deleted_at)} 天`,
      ]),
    [filteredVouchers],
  );
  const metrics = useMemo(
    () => ({
      total: vouchers.length,
      totalAmount: vouchers.reduce(
        (total, voucher) => total + voucher.total_debit,
        0,
      ),
      attachments: vouchers.filter((voucher) => voucher.attachment_count > 0)
        .length,
      older: vouchers.filter((voucher) => daysSince(voucher.deleted_at) > 30)
        .length,
    }),
    [vouchers],
  );
  const scopes = [
    { id: "all" as const, label: `全部 ${metrics.total}` },
    {
      id: "recent" as const,
      label: `近 7 天 ${vouchers.filter((voucher) => daysSince(voucher.deleted_at) <= 7).length}`,
    },
    { id: "attachments" as const, label: `含附件 ${metrics.attachments}` },
    { id: "older" as const, label: `超过 30 天 ${metrics.older}` },
  ];

  const restore = async (voucher: Voucher) => {
    if (!companyId) return;
    setRestoringId(voucher.id);
    try {
      await restoreVoucher(voucher.id, companyId);
      await refresh();
      setNotice(
        `凭证 ${voucher.voucher_number} 已恢复。请回到会计凭证页面复核分录、附件和审核状态。`,
      );
    } catch (error) {
      setNotice(`恢复凭证失败：${String(error)}`);
    } finally {
      setRestoringId(null);
    }
  };

  const actionButton = (voucher: Voucher) => (
    <button
      type="button"
      disabled={restoringId !== null}
      onClick={() => void restore(voucher)}
      className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
    >
      <ArchiveRestore className="h-3.5 w-3.5" />
      {restoringId === voucher.id ? "正在恢复" : "恢复凭证"}
    </button>
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
              <ArchiveRestore className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">凭证回收箱</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              查看已软删除凭证，按删除时间、附件和状态进行复核，并在确认后恢复原始凭证记录。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="凭证回收箱清单"
              companyName={selectedCompany?.name}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
        </header>
        {companyId && (
          <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium">恢复范围</p>
              <p className="mt-1">
                恢复操作只会取消软删除标记并恢复到原有凭证状态，不会审核、反审核、重编号或自动修改分录。
              </p>
            </div>
            <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
              本页不提供永久删除。涉及历史凭证、已审核凭证或归档资料时，应由具有审计权限的人员按既有制度处理。
            </p>
          </div>
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={History}
            label="回收凭证"
            value={`${metrics.total} 张`}
          />
          <Metric
            icon={FileText}
            label="凭证金额"
            value={formatCurrency(metrics.totalAmount)}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={Paperclip}
            label="含附件"
            value={`${metrics.attachments} 张`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={CircleAlert}
            label="超过 30 天"
            value={`${metrics.older} 张`}
            tone={
              metrics.older ? "text-amber-600 dark:text-amber-400" : undefined
            }
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_21rem]">
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
              placeholder="搜索凭证号、摘要、日期或状态"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && <Notice value={notice} />}
        {storeError && (
          <Notice value={`凭证回收箱读取提示：${storeError}`} />
        )}
        {!companyId && <EmptyState message="请选择账套后查看凭证回收箱。" />}
        {companyId && loading && <EmptyState message="正在读取已删除凭证..." />}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[12%] px-4 py-3 font-medium">凭证号</th>
                    <th className="w-[11%] px-4 py-3 font-medium">凭证日期</th>
                    <th className="w-[24%] px-4 py-3 font-medium">摘要</th>
                    <th className="w-[13%] px-4 py-3 text-right font-medium">
                      借贷金额
                    </th>
                    <th className="w-[9%] px-4 py-3 font-medium">附件</th>
                    <th className="w-[10%] px-4 py-3 font-medium">原状态</th>
                    <th className="w-[12%] px-4 py-3 font-medium">删除时间</th>
                    <th className="w-[9%] px-4 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recyclePage.rows.map((voucher) => (
                    <tr
                      key={voucher.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {voucher.voucher_number}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {voucher.voucher_date}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate">
                          {voucher.summary || "未填写摘要"}
                        </p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {voucher.entries.length} 条分录
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(voucher.total_debit)}
                      </td>
                      <td className="px-4 py-3">
                        {voucher.attachment_count > 0
                          ? `${voucher.attachment_count} 个`
                          : "无附件"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(voucher.status)}`}
                        >
                          {voucher.status || "未记录"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap">
                          {formatDateTime(voucher.deleted_at)}
                        </p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {daysSince(voucher.deleted_at)} 天前
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {actionButton(voucher)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {recyclePage.rows.map((voucher) => (
                <article
                  key={voucher.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        {voucher.voucher_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {voucher.voucher_date} · {voucher.entries.length} 条分录
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 border px-2 py-0.5 text-xs ${statusClass(voucher.status)}`}
                    >
                      {voucher.status || "未记录"}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-sm">
                    {voucher.summary || "未填写摘要"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info
                      label="凭证金额"
                      value={formatCurrency(voucher.total_debit)}
                    />
                    <Info
                      label="附件"
                      value={
                        voucher.attachment_count > 0
                          ? `${voucher.attachment_count} 个`
                          : "无附件"
                      }
                    />
                    <Info
                      label="删除时间"
                      value={formatDateTime(voucher.deleted_at)}
                    />
                    <Info
                      label="回收时长"
                      value={`${daysSince(voucher.deleted_at)} 天`}
                    />
                  </div>
                  <div className="mt-3">{actionButton(voucher)}</div>
                </article>
              ))}
            </div>
            {filteredVouchers.length === 0 && (
              <EmptyState message="当前筛选没有已删除凭证。回收箱仅展示软删除记录，不会自动清理或永久删除。" />
            )}
            <OperationalPagination
              page={recyclePage}
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
          icon={ClipboardList}
          title="会计凭证"
          description="恢复后在凭证工作台复核分录、附件和审核状态。"
          onClick={() => navigate("/vouchers")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="审计日志"
          description="查看凭证、导入导出和高风险操作的留痕记录。"
          onClick={() => navigate("/settings/audit-log")}
        />
        <QuickLink
          icon={FileText}
          title="凭证模板"
          description="维护后续录入使用的凭证模板，不会影响回收箱中的历史凭证。"
          onClick={() => navigate("/settings/voucher-templates")}
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
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
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
