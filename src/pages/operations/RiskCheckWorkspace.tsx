import {
  CheckCircle2,
  CircleAlert,
  FileSearch,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  mapLiveRiskCheckRows,
  summarizeLiveRiskChecks,
  type LiveModuleRow,
} from "../../lib/liveModuleRows";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { useInvoiceStore, type Invoice } from "../../stores/invoiceStore";
import { usePeriodStore } from "../../stores/periodStore";
import { useVoucherStore, type Voucher } from "../../stores/voucherStore";

type RiskFilter = "all" | "blocker" | "pending" | "passed";

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

function riskStatusLabel(status: LiveModuleRow["status"]) {
  if (status === "异常") return "阻断";
  if (status === "待处理" || status === "待确认") return "待复核";
  if (status === "已通过") return "已通过";
  return status;
}

function riskStatusClass(status: LiveModuleRow["status"]) {
  if (status === "异常")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  if (status === "待处理" || status === "待确认")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function riskLevelClass(level: string) {
  if (level === "高") return "text-rose-700 dark:text-rose-300";
  if (level === "中") return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

function sourcePath(row: LiveModuleRow) {
  if (row.id.startsWith("risk-voucher-balance-"))
    return `/vouchers/detail/${row.id.slice("risk-voucher-balance-".length)}`;
  if (row.id.startsWith("risk-voucher-draft-"))
    return `/vouchers/detail/${row.id.slice("risk-voucher-draft-".length)}`;
  if (row.id.startsWith("risk-invoice-rejected-"))
    return row.values.module === "进项发票"
      ? "/invoices/input"
      : "/invoices/output";
  return "/period-closing";
}

function sourceLabel(row: LiveModuleRow) {
  if (row.id.startsWith("risk-voucher-")) return "查看凭证";
  if (row.id.startsWith("risk-invoice-")) return "查看发票";
  return "查看结账检查";
}

export function RiskCheckWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices);
  const queryVouchers = useVoucherStore((state) => state.queryVouchers);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const browserPreviewPeriod = useMemo(
    () => (isTauri ? undefined : loadBrowserPreviewOpenPeriod(companyId)),
    [companyId],
  );
  const period =
    periods.find((candidate) => candidate.id === currentPeriodId) ||
    browserPreviewPeriod;
  const periodId = currentPeriodId || browserPreviewPeriod?.id || null;
  const periodLabel = previewPeriodLabel(period) || "未选择账期";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId || !periodId) {
      setInvoices([]);
      setVouchers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await fetchInvoices({ company_id: companyId, period_id: periodId });
      const nextVouchers = await queryVouchers({
        company_id: companyId,
        period_id: periodId,
        page: 1,
        page_size: 100,
      });
      setInvoices(useInvoiceStore.getState().invoices);
      setVouchers(nextVouchers.filter((voucher) => voucher.is_deleted !== 1));
      setNotice(null);
    } catch (error) {
      setNotice(`读取风险检查数据失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchInvoices, periodId, queryVouchers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(
    () => mapLiveRiskCheckRows(vouchers, invoices),
    [invoices, vouchers],
  );
  const summary = useMemo(
    () => summarizeLiveRiskChecks(vouchers, invoices),
    [invoices, vouchers],
  );
  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const inFilter =
        filter === "all" ||
        (filter === "blocker" && row.status === "异常") ||
        (filter === "pending" &&
          (row.status === "待处理" || row.status === "待确认")) ||
        (filter === "passed" && row.status === "已通过");
      const searchText = [
        row.voucher,
        row.attachment,
        row.values.module,
        row.values.rule,
        row.values.impact,
        row.values.owner,
      ]
        .join(" ")
        .toLowerCase();
      return (
        inFilter &&
        (!normalizedKeyword || searchText.includes(normalizedKeyword))
      );
    });
  }, [filter, keyword, rows]);
  const riskPage = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  );
  const exportHeaders = [
    "状态",
    "风险级别",
    "模块",
    "检查规则",
    "影响",
    "责任人",
    "凭证依据",
    "附件依据",
    "处理入口",
  ];
  const exportRows = useMemo(
    () =>
      visibleRows.map((row) => [
        riskStatusLabel(row.status),
        row.values.level || "低",
        row.values.module || "基础校验",
        row.values.rule || "未记录规则",
        row.values.impact || "待确认影响",
        row.values.owner || "待分配",
        row.voucher,
        row.attachment,
        sourceLabel(row),
      ]),
    [visibleRows],
  );

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">风险检查</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按当前账套与账期检查借贷平衡、待审核凭证和异常发票，并定位至源业务处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="风险检查清单"
              companyName={selectedCompany?.name}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              刷新检查
            </button>
          </div>
        </header>

        {!isTauri && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            浏览器预览检查本机保存的发票和凭证数据；风险页不会直接改写会计数据。
          </div>
        )}
        {notice && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            {notice}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              检查范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || "未选择账套"} · {periodLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1">
              <FileSearch className="h-3.5 w-3.5" />
              凭证借贷平衡
            </span>
            <span className="inline-flex items-center gap-1">
              <ReceiptText className="h-3.5 w-3.5" />
              发票状态
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              审核状态
            </span>
          </div>
        </div>

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          {summary.map((item) => (
            <Metric
              key={item.label}
              label={item.label}
              value={item.value}
              tone={item.tone}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "全部" },
                { id: "blocker", label: "阻断" },
                { id: "pending", label: "待复核" },
                { id: "passed", label: "已通过" },
              ] as Array<{ id: RiskFilter; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFilter(item.id);
                  setPage(1);
                }}
                className={`h-8 border px-3 text-xs ${filter === item.id ? "border-[#1f65a7] bg-[#1f65a7] text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950" : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-72">
            <FileSearch className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索规则、模块、责任人"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>

        {!companyId || !periodId ? (
          <EmptyState message="请选择账套和开放账期后执行风险检查。" />
        ) : loading ? (
          <EmptyState message="正在读取检查范围..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">检查清单</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {visibleRows.length} 项符合当前筛选
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[9%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[9%] px-4 py-3 font-medium">级别</th>
                    <th className="w-[13%] px-4 py-3 font-medium">模块</th>
                    <th className="w-[19%] px-4 py-3 font-medium">检查规则</th>
                    <th className="w-[16%] px-4 py-3 font-medium">影响</th>
                    <th className="w-[13%] px-4 py-3 font-medium">责任人</th>
                    <th className="w-[13%] px-4 py-3 font-medium">检查依据</th>
                    <th className="w-[8%] px-4 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {riskPage.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${riskStatusClass(row.status)}`}
                        >
                          {riskStatusLabel(row.status)}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${riskLevelClass(row.values.level || "低")}`}
                      >
                        {row.values.level || "低"}
                      </td>
                      <td className="px-4 py-3">
                        {row.values.module || "基础校验"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.values.rule || "未记录规则"}
                      </td>
                      <td className="px-4 py-3">
                        {row.values.impact || "待确认影响"}
                      </td>
                      <td className="px-4 py-3">
                        {row.values.owner || "待分配"}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className="truncate"
                          title={`${row.voucher} · ${row.attachment}`}
                        >
                          {row.voucher}
                        </p>
                        <p
                          className="mt-1 truncate text-slate-500 dark:text-slate-400"
                          title={row.attachment}
                        >
                          {row.attachment}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(sourcePath(row))}
                          className="text-[#1f65a7] hover:underline dark:text-sky-400"
                        >
                          {sourceLabel(row)}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {riskPage.rows.map((row) => (
                <article
                  key={row.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-flex border px-2 py-0.5 text-xs ${riskStatusClass(row.status)}`}
                      >
                        {riskStatusLabel(row.status)}
                      </span>
                      <p
                        className={`mt-2 text-sm font-semibold ${riskLevelClass(row.values.level || "低")}`}
                      >
                        {row.values.level || "低"}风险 ·{" "}
                        {row.values.module || "基础校验"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(sourcePath(row))}
                      className="shrink-0 text-xs text-[#1f65a7] hover:underline dark:text-sky-400"
                    >
                      {sourceLabel(row)}
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {row.values.rule || "未记录规则"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    影响：{row.values.impact || "待确认影响"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <Info label="责任人" value={row.values.owner || "待分配"} />
                    <Info label="检查依据" value={row.voucher} />
                  </div>
                </article>
              ))}
              {visibleRows.length === 0 && (
                <EmptyState message="当前筛选下没有风险检查项。" />
              )}
            </div>
            <OperationalPagination
              page={riskPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </section>
        )}

        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              风险检查仅汇总异常并提供处理入口。修复、审核、红冲和结账必须回到对应业务模块执行，并由该模块记录操作留痕。
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "red" | "gray";
}) {
  const color = {
    blue: "text-sky-700 dark:text-sky-300",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
    gray: "text-slate-700 dark:text-slate-200",
  }[tone];
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
