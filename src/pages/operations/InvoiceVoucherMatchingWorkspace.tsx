import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  FileSearch,
  Link2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  mapLiveInvoiceVoucherMatchingRows,
  summarizeLiveInvoiceVoucherMatching,
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

type MatchingFilter =
  "all" | "unmatched" | "difference" | "matched" | "exception";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

function matchStatusLabel(status: LiveModuleRow["status"]) {
  if (status === "待处理") return "待匹配";
  if (status === "待确认") return "差异复核";
  if (status === "已匹配") return "已关联";
  if (status === "异常") return "异常";
  return status;
}

function matchStatusClass(status: LiveModuleRow["status"]) {
  if (status === "异常")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  if (status === "待确认")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  if (status === "待处理")
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function invoicePath(invoice: Invoice) {
  return invoice.invoice_type === "input"
    ? "/invoices/input"
    : "/invoices/output";
}

export function InvoiceVoucherMatchingWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices);
  const matchInvoiceToVoucher = useInvoiceStore(
    (state) => state.matchInvoiceToVoucher,
  );
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
  const periodClosed = period?.status === "closed";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filter, setFilter] = useState<MatchingFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId || !periodId) {
      setInvoices([]);
      setVouchers([]);
      setSelectedInvoiceId("");
      setSelectedVoucherId("");
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
      setNotice(`读取匹配数据失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchInvoices, periodId, queryVouchers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(
    () => mapLiveInvoiceVoucherMatchingRows(invoices, vouchers),
    [invoices, vouchers],
  );
  const summary = useMemo(
    () => summarizeLiveInvoiceVoucherMatching(invoices, vouchers),
    [invoices, vouchers],
  );
  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  const selectedVoucher =
    vouchers.find((voucher) => voucher.id === selectedVoucherId) || null;
  const candidateVouchers = useMemo(
    () => vouchers.filter((voucher) => voucher.status !== "reversed"),
    [vouchers],
  );
  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const inFilter =
        filter === "all" ||
        (filter === "unmatched" && row.status === "待处理") ||
        (filter === "difference" && row.status === "待确认") ||
        (filter === "matched" && row.status === "已匹配") ||
        (filter === "exception" && row.status === "异常");
      const searchText = [
        row.values.invoiceNo,
        row.values.counterparty,
        row.values.voucherNo,
        row.values.matchStatus,
      ]
        .join(" ")
        .toLowerCase();
      return (
        inFilter &&
        (!normalizedKeyword || searchText.includes(normalizedKeyword))
      );
    });
  }, [filter, keyword, rows]);
  const matchingPage = useMemo(
    () => paginateOperationalRows(visibleRows, page, pageSize),
    [page, pageSize, visibleRows],
  );
  const exportHeaders = [
    "状态",
    "发票号",
    "往来单位",
    "票据金额",
    "目标凭证",
    "差异",
    "匹配结论",
  ];
  const exportRows = useMemo(
    () =>
      visibleRows.map((row) => [
        matchStatusLabel(row.status),
        row.values.invoiceNo,
        row.values.counterparty,
        row.values.invoiceAmount,
        row.values.voucherNo,
        row.values.difference,
        row.values.matchStatus,
      ]),
    [visibleRows],
  );
  const selectedDifference =
    selectedInvoice && selectedVoucher
      ? Math.abs(selectedInvoice.total_amount - selectedVoucher.total_debit)
      : null;
  const canMatch = Boolean(
    companyId &&
    periodId &&
    !periodClosed &&
    selectedInvoice &&
    selectedVoucher &&
    selectedInvoice.status !== "rejected" &&
    selectedVoucher.status !== "reversed",
  );

  const selectInvoiceFromRow = (row: LiveModuleRow) => {
    const invoiceId = row.id.replace("invoice-voucher-match-", "");
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    setSelectedInvoiceId(invoice.id);
    setSelectedVoucherId(invoice.voucher_id || "");
    setNotice(null);
  };

  const handleMatch = async () => {
    if (!companyId || !periodId || !selectedInvoice || !selectedVoucher) {
      setNotice("请选择当前账套、账期、发票和目标凭证。");
      return;
    }
    if (periodClosed) {
      setNotice("当前账期已结账，不能变更发票与凭证关联。");
      return;
    }
    if (selectedInvoice.status === "rejected") {
      setNotice("异常发票不能直接关联凭证，请先回到发票模块修复。");
      return;
    }
    if (selectedVoucher.status === "reversed") {
      setNotice("红冲凭证不能作为匹配目标。");
      return;
    }
    const difference = Math.abs(
      selectedInvoice.total_amount - selectedVoucher.total_debit,
    );
    if (
      !window.confirm(
        `确认关联发票 ${selectedInvoice.invoice_no} 与凭证 ${selectedVoucher.voucher_number} 吗？${difference > 0.01 ? `当前金额差异为 ${formatCurrency(difference)}，仍需后续人工复核。` : "金额已核对一致。"}`,
      )
    )
      return;
    setMatching(true);
    try {
      await matchInvoiceToVoucher(
        selectedInvoiceId,
        selectedVoucherId,
        companyId,
      );
      setNotice(
        `已关联发票 ${selectedInvoice.invoice_no} 与凭证 ${selectedVoucher.voucher_number}。${difference > 0.01 ? "金额差异已保留为待复核事项。" : "金额已核对一致。"}`,
      );
      await refresh();
    } catch (error) {
      setNotice(`关联失败：${String(error)}`);
    } finally {
      setMatching(false);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">票据凭证匹配</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              核对票据金额、对方单位和凭证金额，人工确认关联后保留差异复核线索。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="票据凭证匹配清单"
              companyName={selectedCompany?.name}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || matching}
              className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              刷新候选
            </button>
          </div>
        </header>
        {!isTauri && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            浏览器预览的关联操作仅更新本机预览数据；不会提交税局、银行或其他外部系统。
          </div>
        )}
        {notice && (
          <div
            className={`border-b px-4 py-2 text-xs ${notice.includes("失败") || notice.includes("不能") ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200"}`}
          >
            {notice}
          </div>
        )}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              匹配范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || "未选择账套"} · {periodLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ReceiptText className="h-3.5 w-3.5" />
              发票金额
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" />
              凭证金额
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
                { id: "unmatched", label: "待匹配" },
                { id: "difference", label: "差异复核" },
                { id: "matched", label: "已关联" },
                { id: "exception", label: "异常" },
              ] as Array<{ id: MatchingFilter; label: string }>
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
              placeholder="搜索票号、单位或凭证"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {!companyId || !periodId ? (
          <EmptyState message="请选择账套和开放账期后查看匹配候选。" />
        ) : loading ? (
          <EmptyState message="正在读取票据和凭证候选..." />
        ) : (
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="min-w-0 border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                <h2 className="text-sm font-semibold">匹配清单</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {visibleRows.length} 张票据
                </span>
              </div>
              <div className="hidden lg:block">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                    <tr>
                      <th className="w-[11%] px-4 py-3 font-medium">状态</th>
                      <th className="w-[16%] px-4 py-3 font-medium">发票号</th>
                      <th className="w-[18%] px-4 py-3 font-medium">
                        往来单位
                      </th>
                      <th className="w-[13%] px-4 py-3 text-right font-medium">
                        票据金额
                      </th>
                      <th className="w-[15%] px-4 py-3 font-medium">
                        目标凭证
                      </th>
                      <th className="w-[13%] px-4 py-3 text-right font-medium">
                        差异
                      </th>
                      <th className="w-[14%] px-4 py-3 font-medium">结论</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matchingPage.rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => selectInvoiceFromRow(row)}
                        className={`cursor-pointer align-top hover:bg-slate-50 dark:hover:bg-slate-800/40 ${selectedInvoiceId === row.id.replace("invoice-voucher-match-", "") ? "bg-sky-50/70 dark:bg-sky-950/20" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex border px-2 py-0.5 text-xs ${matchStatusClass(row.status)}`}
                          >
                            {matchStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium">
                          {row.values.invoiceNo}
                        </td>
                        <td
                          className="truncate px-4 py-3"
                          title={row.values.counterparty}
                        >
                          {row.values.counterparty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.values.invoiceAmount}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {row.values.voucherNo}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.values.difference}
                        </td>
                        <td className="px-4 py-3">{row.values.matchStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 p-3 lg:hidden">
                {matchingPage.rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectInvoiceFromRow(row)}
                    className={`block w-full border p-3 text-left ${selectedInvoiceId === row.id.replace("invoice-voucher-match-", "") ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/20" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium">
                          {row.values.invoiceNo}
                        </p>
                        <p
                          className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                          title={row.values.counterparty}
                        >
                          {row.values.counterparty}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 border px-2 py-0.5 text-xs ${matchStatusClass(row.status)}`}
                      >
                        {matchStatusLabel(row.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <Info label="票据金额" value={row.values.invoiceAmount} />
                      <Info label="目标凭证" value={row.values.voucherNo} />
                      <Info label="差异" value={row.values.difference} />
                      <Info label="结论" value={row.values.matchStatus} />
                    </div>
                  </button>
                ))}
                {visibleRows.length === 0 && (
                  <EmptyState message="当前筛选下没有匹配记录。" />
                )}
              </div>
              <OperationalPagination
                page={matchingPage}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </section>
            <aside className="min-w-0">
              <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                <h2 className="text-sm font-semibold">人工复核</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  选择票据与目标凭证后，先核对金额差异再确认关联。
                </p>
              </div>
              {selectedInvoice ? (
                <div className="space-y-4 p-4">
                  <Info
                    label="已选票据"
                    value={`${selectedInvoice.invoice_no} · ${formatCurrency(selectedInvoice.total_amount)}`}
                  />
                  <label className="grid gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span>目标凭证</span>
                    <select
                      value={selectedVoucherId}
                      onChange={(event) =>
                        setSelectedVoucherId(event.target.value)
                      }
                      className="h-9 border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                    >
                      <option value="">请选择凭证</option>
                      {candidateVouchers.map((voucher) => (
                        <option key={voucher.id} value={voucher.id}>
                          {voucher.voucher_number} ·{" "}
                          {formatCurrency(voucher.total_debit)} ·{" "}
                          {voucher.summary || "无摘要"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedVoucher && (
                    <div className="border border-slate-200 p-3 text-xs leading-5 dark:border-slate-800">
                      <Info
                        label="凭证摘要"
                        value={selectedVoucher.summary || "未填写摘要"}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Info
                          label="凭证金额"
                          value={formatCurrency(selectedVoucher.total_debit)}
                        />
                        <Info
                          label="金额差异"
                          value={formatCurrency(selectedDifference || 0)}
                        />
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleMatch()}
                    disabled={!canMatch || matching}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 bg-[#1f65a7] px-3 text-sm font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {matching ? "正在关联..." : "确认人工关联"}
                  </button>
                  <div className="flex gap-2 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      关联只更新发票与既有凭证的对应关系，不会新增凭证或自动消除金额差异。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(invoicePath(selectedInvoice))}
                      className="h-8 flex-1 border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      查看发票
                    </button>
                    {selectedVoucher && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/vouchers/detail/${selectedVoucher.id}`)
                        }
                        className="h-8 flex-1 border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        查看凭证
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState message="从匹配清单中选择一张票据开始复核。" />
              )}
            </aside>
          </div>
        )}
        <footer className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              金额差异会保留为待复核状态。发票异常、红冲凭证和已结账账期都不能在此页强制建立关联。
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
