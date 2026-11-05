import {
  ArrowRight,
  BadgeAlert,
  CalendarClock,
  CircleAlert,
  Landmark,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { settlementRecordApi, type SettlementRecord } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

const browserStorageKey = "accounting-preview-settlement-data-v1";

type AgingFilter = "all" | "receivable" | "payable" | "overdue" | "highRisk";
type AgingRow = {
  record: SettlementRecord;
  days: number;
  bucket: string;
  overdue: number;
  risk: "高" | "中" | "低";
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function isSettlementRecord(value: unknown): value is SettlementRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SettlementRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    (record.settlementType === "receivable" ||
      record.settlementType === "payable") &&
    typeof record.settlementNo === "string" &&
    typeof record.settlementDate === "string" &&
    typeof record.counterparty === "string" &&
    Number.isFinite(record.totalAmount) &&
    Number.isFinite(record.settledAmount) &&
    Number.isFinite(record.balanceAmount) &&
    typeof record.settlementMethod === "string" &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function loadBrowserSettlementRecords() {
  if (typeof window === "undefined") return [] as SettlementRecord[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSettlementRecord) : [];
  } catch {
    return [];
  }
}

function ageDays(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((Date.now() - timestamp) / 86400000))
    : 0;
}

function ageBucket(days: number) {
  if (days <= 30) return "0-30天";
  if (days <= 60) return "31-60天";
  if (days <= 90) return "61-90天";
  return "90天以上";
}

function toAgingRows(records: SettlementRecord[]): AgingRow[] {
  return records
    .filter((record) => record.balanceAmount > 0)
    .map((record) => {
      const days = ageDays(record.settlementDate);
      const risk: AgingRow["risk"] =
        record.status === "异常" || days > 90 ? "高" : days > 30 ? "中" : "低";
      return {
        record,
        days,
        bucket: ageBucket(days),
        overdue: days > 30 ? record.balanceAmount : 0,
        risk,
      };
    })
    .sort(
      (left, right) =>
        right.days - left.days ||
        right.record.balanceAmount - left.record.balanceAmount,
    );
}

function riskClass(risk: AgingRow["risk"]) {
  if (risk === "高")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  if (risk === "中")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

export function AgingWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const browserPreviewPeriod = useMemo(
    () => (isTauri ? undefined : loadBrowserPreviewOpenPeriod(companyId)),
    [companyId],
  );
  const period =
    periods.find((candidate) => candidate.id === currentPeriodId) ||
    browserPreviewPeriod;
  const periodLabel = previewPeriodLabel(period);
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [filter, setFilter] = useState<AgingFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId || !periodLabel) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isTauri) {
        const [receivable, payable] = await Promise.all([
          settlementRecordApi.getSettlementRecords({
            companyId,
            period: periodLabel,
            settlementType: "receivable",
          }),
          settlementRecordApi.getSettlementRecords({
            companyId,
            period: periodLabel,
            settlementType: "payable",
          }),
        ]);
        const errors = [receivable, payable]
          .filter((result) => !result.success)
          .map((result) => result.error || "未知错误");
        setRecords([...(receivable.data || []), ...(payable.data || [])]);
        setNotice(
          errors.length > 0 ? `读取核销台账失败：${errors.join("；")}` : null,
        );
      } else {
        setRecords(
          loadBrowserSettlementRecords().filter(
            (record) =>
              record.companyId === companyId && record.period === periodLabel,
          ),
        );
        setNotice(null);
      }
    } catch (error) {
      setNotice(`读取账龄数据失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, periodLabel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const agingRows = useMemo(() => toAgingRows(records), [records]);
  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return agingRows.filter((row) => {
      const inFilter =
        filter === "all" ||
        (filter === "receivable" &&
          row.record.settlementType === "receivable") ||
        (filter === "payable" && row.record.settlementType === "payable") ||
        (filter === "overdue" && row.overdue > 0) ||
        (filter === "highRisk" && row.risk === "高");
      const searchable = [
        row.record.settlementNo,
        row.record.counterparty,
        row.record.invoiceNo,
        row.record.transactionNo,
        row.record.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inFilter &&
        (!normalizedKeyword || searchable.includes(normalizedKeyword))
      );
    });
  }, [agingRows, filter, keyword]);
  const agingPage = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  );
  const exportHeaders = [
    "风险",
    "类型",
    "往来单位",
    "核销单号",
    "未核销余额",
    "账龄区间",
    "挂账天数",
    "逾期金额",
  ];
  const exportRows = useMemo(
    () =>
      visibleRows.map((row) => [
        `${row.risk}风险`,
        row.record.settlementType === "receivable" ? "应收账款" : "应付账款",
        row.record.counterparty,
        row.record.settlementNo,
        formatCurrency(row.record.balanceAmount),
        row.bucket,
        String(row.days),
        formatCurrency(row.overdue),
      ]),
    [visibleRows],
  );
  const metrics = useMemo(
    () => ({
      receivable: agingRows
        .filter((row) => row.record.settlementType === "receivable")
        .reduce((sum, row) => sum + row.record.balanceAmount, 0),
      payable: agingRows
        .filter((row) => row.record.settlementType === "payable")
        .reduce((sum, row) => sum + row.record.balanceAmount, 0),
      overdue: agingRows.reduce((sum, row) => sum + row.overdue, 0),
      highRisk: agingRows.filter((row) => row.risk === "高").length,
    }),
    [agingRows],
  );

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">往来账龄</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按应收、应付核销台账的未核销余额与单据日期计算账龄，识别逾期及高风险往来。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="往来账龄清单"
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
              重算账龄
            </button>
          </div>
        </header>
        {!isTauri && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            浏览器预览仅展示本地核销账龄，不会发起催收、付款或变更核销记录。
          </div>
        )}
        {notice && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            {notice}
          </div>
        )}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              计算范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || "未选择账套"} ·{" "}
              {periodLabel || "未选择账期"}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            账龄 = 当前日期 - 核销单据日期；逾期阈值为 30 天
          </p>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={WalletCards}
            label="应收余额"
            value={formatCurrency(metrics.receivable)}
            tone="sky"
          />
          <Metric
            icon={Landmark}
            label="应付余额"
            value={formatCurrency(metrics.payable)}
            tone="amber"
          />
          <Metric
            icon={BadgeAlert}
            label="逾期金额"
            value={formatCurrency(metrics.overdue)}
            tone={metrics.overdue > 0 ? "rose" : "slate"}
          />
          <Metric
            icon={CircleAlert}
            label="高风险项"
            value={`${metrics.highRisk} 项`}
            tone={metrics.highRisk > 0 ? "rose" : "slate"}
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "全部余额" },
                { id: "receivable", label: "应收" },
                { id: "payable", label: "应付" },
                { id: "overdue", label: "逾期" },
                { id: "highRisk", label: "高风险" },
              ] as Array<{ id: AgingFilter; label: string }>
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
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索往来单位、单据或负责人"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {!companyId || !periodLabel ? (
          <EmptyState message="请选择账套和开放账期后查看往来账龄。" />
        ) : loading ? (
          <EmptyState message="正在读取应收与应付核销台账..." />
        ) : (
          <section>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <h2 className="text-sm font-semibold">账龄清单</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {visibleRows.length} 笔未核销余额
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[9%] px-4 py-3 font-medium">风险</th>
                    <th className="w-[13%] px-4 py-3 font-medium">类型</th>
                    <th className="w-[17%] px-4 py-3 font-medium">往来单位</th>
                    <th className="w-[14%] px-4 py-3 font-medium">核销单号</th>
                    <th className="w-[12%] px-4 py-3 text-right font-medium">
                      余额
                    </th>
                    <th className="w-[12%] px-4 py-3 font-medium">账龄区间</th>
                    <th className="w-[12%] px-4 py-3 text-right font-medium">
                      逾期金额
                    </th>
                    <th className="w-[11%] px-4 py-3 text-right font-medium">
                      处置
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {agingPage.rows.map((row) => (
                    <tr
                      key={row.record.id}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${riskClass(row.risk)}`}
                        >
                          {row.risk}风险
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.record.settlementType === "receivable"
                          ? "应收账款"
                          : "应付账款"}
                      </td>
                      <td
                        className="truncate px-4 py-3 font-medium"
                        title={row.record.counterparty}
                      >
                        {row.record.counterparty}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {row.record.settlementNo}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(row.record.balanceAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.bucket}</p>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          已挂账 {row.days} 天
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(row.overdue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              row.record.settlementType === "receivable"
                                ? "/settlement/receivable"
                                : "/settlement/payable",
                            )
                          }
                          className="inline-flex items-center gap-1 text-[#1f65a7] hover:underline dark:text-sky-400"
                        >
                          核对台账
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {agingPage.rows.map((row) => (
                <article
                  key={row.record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold"
                        title={row.record.counterparty}
                      >
                        {row.record.counterparty}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.record.settlementNo}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-xs ${riskClass(row.risk)}`}
                    >
                      {row.risk}风险
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info
                      label="往来类型"
                      value={
                        row.record.settlementType === "receivable"
                          ? "应收账款"
                          : "应付账款"
                      }
                    />
                    <Info
                      label="未核销余额"
                      value={formatCurrency(row.record.balanceAmount)}
                    />
                    <Info
                      label="账龄"
                      value={`${row.bucket} · ${row.days} 天`}
                    />
                    <Info
                      label="逾期金额"
                      value={formatCurrency(row.overdue)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        row.record.settlementType === "receivable"
                          ? "/settlement/receivable"
                          : "/settlement/payable",
                      )
                    }
                    className="mt-4 inline-flex items-center gap-1 text-xs text-[#1f65a7] hover:underline dark:text-sky-400"
                  >
                    进入核销台账
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              ))}
              {visibleRows.length === 0 && (
                <EmptyState message="当前筛选下没有未核销的往来余额。" />
              )}
            </div>
            <OperationalPagination
              page={agingPage}
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
              账龄用于识别跟进优先级，不能替代催收、付款、坏账或核销审批。实际处置需回到应收或应付核销台账完成并留存记录。
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  tone: "sky" | "amber" | "rose" | "slate";
}) {
  const color = {
    sky: "text-sky-700 dark:text-sky-300",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    slate: "text-slate-700 dark:text-slate-200",
  }[tone];
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
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
