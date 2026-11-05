import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleDollarSign,
  FilePenLine,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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

export type SettlementMode = "receivable" | "payable";
type SettlementScope = "all" | "pending" | "partial" | "completed";
type SettlementDraft = {
  settlementNo: string;
  settlementDate: string;
  counterparty: string;
  invoiceNo: string;
  transactionNo: string;
  totalAmount: string;
  settledAmount: string;
  settlementMethod: string;
  owner: string;
  sourceDocument: string;
};

type SettlementConfig = {
  title: string;
  description: string;
  counterpartyLabel: string;
  invoiceLabel: string;
  transactionLabel: string;
  totalLabel: string;
  newLabel: string;
  noPrefix: string;
  invoicePath: string;
  invoiceLinkLabel: string;
  bankLinkLabel: string;
  bankRoute: string;
  defaultMethod: string;
};

const browserStorageKey = "accounting-preview-settlement-data-v1";
const scopes: Array<{ id: SettlementScope; label: string }> = [
  { id: "all", label: "全部台账" },
  { id: "pending", label: "待核销" },
  { id: "partial", label: "部分核销" },
  { id: "completed", label: "已核销" },
];

const settlementConfigs: Record<SettlementMode, SettlementConfig> = {
  receivable: {
    title: "应收核销",
    description:
      "核对客户销项发票、收款流水和应收余额，维护本地核销台账；不自动生成或过账凭证。",
    counterpartyLabel: "客户",
    invoiceLabel: "销项发票",
    transactionLabel: "收款流水",
    totalLabel: "应收金额",
    newLabel: "新增应收核销",
    noPrefix: "YS",
    invoicePath: "/invoices/output",
    invoiceLinkLabel: "核对销项发票",
    bankLinkLabel: "核对收款流水",
    bankRoute: "/bank",
    defaultMethod: "发票与收款匹配",
  },
  payable: {
    title: "应付核销",
    description:
      "核对供应商进项发票、付款流水和应付余额，维护本地核销台账；不自动生成或过账凭证。",
    counterpartyLabel: "供应商",
    invoiceLabel: "进项发票",
    transactionLabel: "付款流水",
    totalLabel: "应付金额",
    newLabel: "新增应付核销",
    noPrefix: "YF",
    invoicePath: "/invoices/input",
    invoiceLinkLabel: "核对进项发票",
    bankLinkLabel: "核对付款流水",
    bankRoute: "/bank",
    defaultMethod: "发票与付款匹配",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function settlementStatus(
  record: Pick<SettlementRecord, "totalAmount" | "settledAmount">,
) {
  if (record.settledAmount <= 0) return "待核销";
  if (record.settledAmount >= record.totalAmount) return "已核销";
  return "部分核销";
}

function statusClass(status: string) {
  if (status === "已核销")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "部分核销")
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
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

function loadBrowserSettlementRecords(): SettlementRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSettlementRecord) : [];
  } catch {
    return [];
  }
}

function saveBrowserSettlementRecords(records: SettlementRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    // The active browser session remains usable if persistent storage is unavailable.
  }
}

function createDraft(
  config: SettlementConfig,
  settlementDate: string,
): SettlementDraft {
  return {
    settlementNo: "",
    settlementDate,
    counterparty: "",
    invoiceNo: "",
    transactionNo: "",
    totalAmount: "",
    settledAmount: "0",
    settlementMethod: config.defaultMethod,
    owner: "",
    sourceDocument: "",
  };
}

function draftFromRecord(record: SettlementRecord): SettlementDraft {
  return {
    settlementNo: record.settlementNo,
    settlementDate: record.settlementDate,
    counterparty: record.counterparty,
    invoiceNo: record.invoiceNo || "",
    transactionNo: record.transactionNo || "",
    totalAmount: String(record.totalAmount),
    settledAmount: String(record.settledAmount),
    settlementMethod: record.settlementMethod,
    owner: record.owner || "",
    sourceDocument: record.sourceDocument || "",
  };
}

export function SettlementWorkspace({ mode }: { mode: SettlementMode }) {
  const config = settlementConfigs[mode];
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
  const currentPeriod = periods.find(
    (candidate) => candidate.id === currentPeriodId,
  );
  const browserPreviewPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const period =
    previewPeriodLabel(currentPeriod) ||
    previewPeriodLabel(browserPreviewPeriod);
  const defaultDate =
    currentPeriod?.end_date || browserPreviewPeriod?.end_date || "";
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [scope, setScope] = useState<SettlementScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<SettlementRecord | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<SettlementDraft>(() =>
    createDraft(config, defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);

  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      setRecords(
        loadBrowserSettlementRecords().filter(
          (record) =>
            record.companyId === companyId &&
            record.period === period &&
            record.settlementType === mode,
        ),
      );
      setLoading(false);
      return;
    }
    const result = await settlementRecordApi.getSettlementRecords({
      companyId,
      period,
      settlementType: mode,
    });
    setRecords(result.success ? result.data || [] : []);
    setNotice(
      result.success
        ? null
        : `读取${config.title}失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, config.title, mode, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = settlementStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "pending" && status === "待核销") ||
        (scope === "partial" && status === "部分核销") ||
        (scope === "completed" && status === "已核销");
      const searchable = [
        record.settlementNo,
        record.counterparty,
        record.invoiceNo,
        record.transactionNo,
        record.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inScope &&
        (!normalizedKeyword || searchable.includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const settlementPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "核销日期",
    "核销编号",
    config.counterpartyLabel,
    config.invoiceLabel,
    config.transactionLabel,
    config.totalLabel,
    "已核销",
    "未核销余额",
    "核销方式",
    "负责人",
    "来源单据",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.settlementDate,
        record.settlementNo,
        record.counterparty,
        record.invoiceNo || "待关联",
        record.transactionNo || "待关联",
        formatCurrency(record.totalAmount),
        formatCurrency(record.settledAmount),
        formatCurrency(record.balanceAmount),
        record.settlementMethod,
        record.owner || "未分配",
        record.sourceDocument || "未关联",
        settlementStatus(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      total: records.reduce((sum, record) => sum + record.totalAmount, 0),
      settled: records.reduce((sum, record) => sum + record.settledAmount, 0),
      balance: records.reduce((sum, record) => sum + record.balanceAmount, 0),
      pending: records.filter((record) => settlementStatus(record) !== "已核销")
        .length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditingRecord(null);
    setDraft(createDraft(config, defaultDate));
    setShowEditor(true);
  };

  const openEdit = (record: SettlementRecord) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护核销台账。");
      return;
    }
    const totalAmount = Number(draft.totalAmount);
    const settledAmount = Number(draft.settledAmount);
    if (
      !draft.settlementNo.trim() ||
      !draft.settlementDate ||
      !draft.counterparty.trim() ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      !Number.isFinite(settledAmount) ||
      settledAmount < 0 ||
      settledAmount > totalAmount
    ) {
      setNotice(
        "请填写编号、日期、往来单位和应收应付金额；核销金额需介于零与总金额之间。",
      );
      return;
    }
    const balanceAmount = totalAmount - settledAmount;
    const status = settlementStatus({ totalAmount, settledAmount });
    const input = {
      companyId,
      period,
      settlementType: mode,
      settlementNo: draft.settlementNo.trim(),
      settlementDate: draft.settlementDate,
      counterparty: draft.counterparty.trim(),
      invoiceNo: draft.invoiceNo.trim() || undefined,
      transactionNo: draft.transactionNo.trim() || undefined,
      totalAmount,
      settledAmount,
      settlementMethod: draft.settlementMethod.trim() || undefined,
      owner: draft.owner.trim() || undefined,
      status,
      sourceDocument: draft.sourceDocument.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const record: SettlementRecord = editingRecord
        ? {
            ...editingRecord,
            ...input,
            invoiceNo: input.invoiceNo || null,
            transactionNo: input.transactionNo || null,
            settlementMethod: input.settlementMethod || "待人工核销",
            owner: input.owner || null,
            sourceDocument: input.sourceDocument || null,
            balanceAmount,
            updatedAt: now,
          }
        : {
            id: `preview-${mode}-settlement-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            invoiceNo: input.invoiceNo || null,
            transactionNo: input.transactionNo || null,
            balanceAmount,
            settlementMethod: input.settlementMethod || "待人工核销",
            owner: input.owner || null,
            sourceDocument: input.sourceDocument || null,
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserSettlementRecords([
        record,
        ...loadBrowserSettlementRecords().filter(
          (item) => item.id !== record.id,
        ),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord
          ? `${config.title}已更新。`
          : `${config.title}已保存，需继续人工核对发票、流水和余额。`,
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await settlementRecordApi.updateSettlementRecord({
          ...input,
          id: editingRecord.id,
        })
      : await settlementRecordApi.createSettlementRecord(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}核销台账失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? `${config.title}已更新。`
        : `${config.title}已保存，系统不自动生成或过账凭证。`,
    );
    await refresh();
  };

  const rowActions = (record: SettlementRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate(config.invoicePath)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        发票
      </button>
      <button
        type="button"
        onClick={() => openEdit(record)}
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
              <h1 className="text-base font-semibold">{config.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {config.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${config.title}台账`}
              companyName={selectedCompany?.name}
              periodLabel={period}
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
              disabled={!companyId || !period}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {config.newLabel}
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={CircleDollarSign}
            label={config.totalLabel}
            value={formatCurrency(metrics.total)}
          />
          <Metric
            icon={mode === "receivable" ? BanknoteArrowDown : BanknoteArrowUp}
            label="已核销"
            value={formatCurrency(metrics.settled)}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={Landmark}
            label="未核销余额"
            value={formatCurrency(metrics.balance)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={ReceiptText}
            label="待人工核对"
            value={`${metrics.pending} 笔`}
            tone="text-rose-600 dark:text-rose-400"
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
              placeholder={`搜索${config.counterpartyLabel}、发票、流水或核销编号`}
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
          <Placeholder message="请选择账套后查看或维护核销台账。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期核销台账。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取核销台账..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">核销日期</th>
                    <th className="w-[13%] px-3 py-3 font-medium">核销编号</th>
                    <th className="w-[14%] px-3 py-3 font-medium">
                      {config.counterpartyLabel}
                    </th>
                    <th className="w-[12%] px-3 py-3 font-medium">
                      {config.invoiceLabel}
                    </th>
                    <th className="w-[10%] px-3 py-3 font-medium">
                      {config.transactionLabel}
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      总金额
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      已核销
                    </th>
                    <th className="w-[9%] px-3 py-3 text-right font-medium">
                      余额
                    </th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {settlementPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        {record.settlementDate}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.settlementNo}
                      >
                        {record.settlementNo}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.counterparty}
                      >
                        {record.counterparty}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.invoiceNo || ""}
                      >
                        {record.invoiceNo || "待关联"}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.transactionNo || ""}
                      >
                        {record.transactionNo || "待关联"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.totalAmount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.settledAmount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="mr-2 inline-block">
                          <Status status={settlementStatus(record)} />
                        </span>
                        {formatCurrency(record.balanceAmount)}
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {settlementPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.settlementNo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.settlementDate} · {record.counterparty}
                      </p>
                    </div>
                    <Status status={settlementStatus(record)} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Info
                      label="总金额"
                      value={formatCurrency(record.totalAmount)}
                    />
                    <Info
                      label="已核销"
                      value={formatCurrency(record.settledAmount)}
                    />
                    <Info
                      label="余额"
                      value={formatCurrency(record.balanceAmount)}
                    />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有核销记录。" />
            )}
            <OperationalPagination
              page={settlementPage}
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
        <WorkflowLink
          icon={FileText}
          title={config.invoiceLinkLabel}
          description="发票与核销台账分别维护，关联关系需由人工复核确认。"
          onClick={() => navigate(config.invoicePath)}
        />
        <WorkflowLink
          icon={Landmark}
          title={config.bankLinkLabel}
          description="银行流水仅作为核销依据，先核实回单、金额和往来单位。"
          onClick={() => navigate(config.bankRoute)}
        />
        <WorkflowLink
          icon={ReceiptText}
          title="查看账龄风险"
          description="账龄仅提供本地分析与风险提示，不代表自动冲销或自动记账。"
          onClick={() => navigate("/aging")}
        />
      </section>
      {showEditor && (
        <SettlementEditor
          config={config}
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
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
        <p className="text-xs">{label}</p>
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(status)}`}
    >
      {status}
    </span>
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
function WorkflowLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-900 dark:hover:bg-sky-950/20"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-sky-50 text-[#1f65a7] dark:bg-sky-950/40 dark:text-sky-300">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
    </button>
  );
}

function SettlementEditor({
  config,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  config: SettlementConfig;
  draft: SettlementDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: SettlementDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="核销记录编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? `编辑${config.title}` : config.newLabel}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              核销结果以人工复核的发票、流水和余额为准，系统不自动生成凭证。
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
          <Field label="核销编号 *">
            <input
              required
              value={draft.settlementNo}
              onChange={(event) =>
                onChange({ ...draft, settlementNo: event.target.value })
              }
              placeholder={`${config.noPrefix}-2026-0001`}
            />
          </Field>
          <Field label="核销日期 *">
            <input
              required
              type="date"
              value={draft.settlementDate}
              onChange={(event) =>
                onChange({ ...draft, settlementDate: event.target.value })
              }
            />
          </Field>
          <Field label={`${config.counterpartyLabel} *`}>
            <input
              required
              value={draft.counterparty}
              onChange={(event) =>
                onChange({ ...draft, counterparty: event.target.value })
              }
            />
          </Field>
          <Field label={config.invoiceLabel}>
            <input
              value={draft.invoiceNo}
              onChange={(event) =>
                onChange({ ...draft, invoiceNo: event.target.value })
              }
            />
          </Field>
          <Field label={config.transactionLabel}>
            <input
              value={draft.transactionNo}
              onChange={(event) =>
                onChange({ ...draft, transactionNo: event.target.value })
              }
            />
          </Field>
          <Field label={`${config.totalLabel} *`}>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.totalAmount}
              onChange={(event) =>
                onChange({ ...draft, totalAmount: event.target.value })
              }
            />
          </Field>
          <Field label="本次已核销金额">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.settledAmount}
              onChange={(event) =>
                onChange({ ...draft, settledAmount: event.target.value })
              }
            />
          </Field>
          <Field label="核销方式">
            <input
              value={draft.settlementMethod}
              onChange={(event) =>
                onChange({ ...draft, settlementMethod: event.target.value })
              }
            />
          </Field>
          <Field label="经办人">
            <input
              value={draft.owner}
              onChange={(event) =>
                onChange({ ...draft, owner: event.target.value })
              }
            />
          </Field>
          <Field label="来源单据">
            <input
              value={draft.sourceDocument}
              onChange={(event) =>
                onChange({ ...draft, sourceDocument: event.target.value })
              }
            />
          </Field>
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
            disabled={saving}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存核销台账"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
