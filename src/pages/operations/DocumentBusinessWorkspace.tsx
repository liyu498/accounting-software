import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  FileCheck2,
  FilePenLine,
  FilePlus2,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { documentRecordApi, type DocumentRecord } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type DocumentMode = "receipt" | "expense";
type RecordScope = "all" | "pending" | "attachments" | "vouchered";
type DocumentDraft = {
  businessDate: string;
  documentCode: string;
  businessType: string;
  partner: string;
  amount: string;
  owner: string;
  attachmentStatus: string;
};

type BrowserDocumentBusinessData = {
  documentRecords: DocumentRecord[];
  businessOrders: unknown[];
};

const browserStorageKey = "accounting-preview-document-business-data-v2";
const scopeOptions: Array<{ id: RecordScope; label: string }> = [
  { id: "all", label: "本期全部" },
  { id: "pending", label: "待处理" },
  { id: "attachments", label: "待补附件" },
  { id: "vouchered", label: "已生成凭证" },
];

const configs = {
  receipt: {
    title: "票据登记与兑现跟踪",
    description:
      "维护收款、付款与商业汇票资料，核对附件和后续收付款流程；不发起扣款或自动入账。",
    action: "登记票据",
    icon: ReceiptText,
    types: ["收款票据", "付款票据", "商业汇票"],
    partnerLabel: "出票/收款方",
    ownerLabel: "经办人",
    detailPath: "/bank/reconciliation",
    detailLabel: "收付款核对",
  },
  expense: {
    title: "费用报销与附件核验",
    description:
      "维护报销单、经办人和附件状态，供人工审批与凭证处理使用；不自动生成或过账凭证。",
    action: "新增报销单",
    icon: WalletCards,
    types: ["费用报销", "差旅报销", "业务招待"],
    partnerLabel: "报销人",
    ownerLabel: "审批经办人",
    detailPath: "/attachments",
    detailLabel: "核对附件",
  },
} as const;

const emptyDraft = (mode: DocumentMode): DocumentDraft => ({
  businessDate: "",
  documentCode: "",
  businessType: configs[mode].types[0],
  partner: "",
  amount: "",
  owner: "",
  attachmentStatus: "待补附件",
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function loadBrowserDocumentBusinessData(): BrowserDocumentBusinessData {
  if (typeof window === "undefined")
    return { documentRecords: [], businessOrders: [] };
  try {
    const value = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as Partial<BrowserDocumentBusinessData> | null;
    if (!value || !Array.isArray(value.documentRecords))
      return { documentRecords: [], businessOrders: [] };
    return {
      documentRecords: value.documentRecords.filter(
        (record): record is DocumentRecord =>
          Boolean(
            record &&
            typeof record.id === "string" &&
            typeof record.companyId === "string" &&
            typeof record.period === "string" &&
            typeof record.documentCode === "string" &&
            typeof record.businessType === "string" &&
            Number.isFinite(record.amount),
          ),
      ),
      businessOrders: Array.isArray(value.businessOrders)
        ? value.businessOrders
        : [],
    };
  } catch {
    return { documentRecords: [], businessOrders: [] };
  }
}

function saveBrowserDocumentBusinessData(data: BrowserDocumentBusinessData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(browserStorageKey, JSON.stringify(data));
}

function belongsToMode(record: DocumentRecord, mode: DocumentMode) {
  return mode === "expense"
    ? record.businessType.includes("报销")
    : /票据|收款|付款|汇票/.test(record.businessType);
}

function displayStatus(record: DocumentRecord) {
  if (record.status === "已生成凭证") return "已生成凭证";
  if (
    record.attachmentStatus !== "附件齐全" &&
    record.attachmentStatus !== "已归档"
  )
    return "待补附件";
  return record.status || "待审核";
}

function statusClass(status: string) {
  if (status === "已生成凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "待补附件")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function draftFromRecord(record: DocumentRecord): DocumentDraft {
  return {
    businessDate: record.businessDate,
    documentCode: record.documentCode,
    businessType: record.businessType,
    partner: record.partner || "",
    amount: String(record.amount),
    owner: record.owner || "",
    attachmentStatus: record.attachmentStatus || "待补附件",
  };
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "rose";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "rose"
          ? "text-rose-700 dark:text-rose-300"
          : "text-[#1f65a7] dark:text-sky-300";
  return (
    <div className="border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#111827]">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {message}
    </div>
  );
}

function DocumentBusinessWorkspace({ mode }: { mode: DocumentMode }) {
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
  const currentPeriod = periods.find((item) => item.id === currentPeriodId);
  const browserPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const period =
    previewPeriodLabel(currentPeriod) || previewPeriodLabel(browserPeriod);
  const config = configs[mode];
  const Icon = config.icon;
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [scope, setScope] = useState<RecordScope>("all");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<DocumentRecord | null>(
    null,
  );
  const [draft, setDraft] = useState<DocumentDraft>(() => emptyDraft(mode));
  const [showEditor, setShowEditor] = useState(false);
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
        loadBrowserDocumentBusinessData().documentRecords.filter(
          (record) =>
            record.companyId === companyId &&
            record.period === period &&
            belongsToMode(record, mode),
        ),
      );
      setNotice(null);
      setLoading(false);
      return;
    }
    const result = await documentRecordApi.getDocumentRecords({
      companyId,
      period,
    });
    setRecords(
      result.success
        ? (result.data || []).filter((record) => belongsToMode(record, mode))
        : [],
    );
    setNotice(
      result.success
        ? null
        : `读取${mode === "expense" ? "报销单" : "票据"}失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, mode, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = displayStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "pending" && status !== "已生成凭证") ||
        (scope === "attachments" && status === "待补附件") ||
        (scope === "vouchered" && status === "已生成凭证");
      return (
        inScope &&
        (!normalized ||
          [
            record.documentCode,
            record.businessType,
            record.partner,
            record.owner,
            record.attachmentStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized))
      );
    });
  }, [keyword, records, scope]);
  const documentPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "日期",
    "编号",
    "业务类型",
    config.partnerLabel,
    config.ownerLabel,
    "金额",
    "附件状态",
    "处理状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.businessDate,
        record.documentCode,
        record.businessType,
        record.partner || "待补",
        record.owner || "待分配",
        formatCurrency(record.amount),
        record.attachmentStatus || "待补附件",
        displayStatus(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      amount: records.reduce((sum, record) => sum + record.amount, 0),
      pending: records.filter(
        (record) => displayStatus(record) !== "已生成凭证",
      ).length,
      missingAttachments: records.filter(
        (record) => displayStatus(record) === "待补附件",
      ).length,
      vouchered: records.filter(
        (record) => displayStatus(record) === "已生成凭证",
      ).length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditingRecord(null);
    setDraft({
      ...emptyDraft(mode),
      businessDate: currentPeriod?.end_date || browserPeriod?.end_date || "",
    });
    setShowEditor(true);
  };

  const openEdit = (record: DocumentRecord) => {
    if (displayStatus(record) === "已生成凭证") {
      setNotice("该记录已生成凭证，请先在凭证流程完成复核后再调整来源资料。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护记录。");
      return;
    }
    const amount = Number(draft.amount);
    if (
      !draft.businessDate ||
      !draft.documentCode.trim() ||
      !config.types.includes(draft.businessType as never) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setNotice("请填写日期、编号、业务类型和大于零的金额。");
      return;
    }
    const input = {
      companyId,
      period,
      businessDate: draft.businessDate,
      documentCode: draft.documentCode.trim(),
      businessType: draft.businessType,
      partner: draft.partner.trim() || undefined,
      amount,
      owner: draft.owner.trim() || undefined,
      attachmentStatus: draft.attachmentStatus,
    };
    setSaving(true);
    if (!isTauri) {
      const timestamp = new Date().toISOString();
      const data = loadBrowserDocumentBusinessData();
      const record: DocumentRecord = editingRecord
        ? {
            ...editingRecord,
            ...input,
            partner: input.partner || null,
            owner: input.owner || null,
            updatedAt: timestamp,
          }
        : {
            id: `preview-${mode}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            partner: input.partner || null,
            owner: input.owner || null,
            stampTaxItem: null,
            stampTaxRate: null,
            voucherId: null,
            voucherNumber: null,
            status: "待审核",
            createdAt: timestamp,
            updatedAt: timestamp,
          };
      saveBrowserDocumentBusinessData({
        ...data,
        documentRecords: [
          record,
          ...data.documentRecords.filter((item) => item.id !== record.id),
        ],
      });
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord
          ? "预览记录已更新。"
          : "预览记录已保存，仍需人工核验附件和后续流程。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await documentRecordApi.updateDocumentRecord({
          ...input,
          id: editingRecord.id,
        })
      : await documentRecordApi.createDocumentRecord(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "记录已更新。"
        : `${mode === "expense" ? "报销单" : "票据"}已登记，系统不自动生成或过账凭证。`,
    );
    await refresh();
  };

  const actions = (record: DocumentRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            record.voucherId
              ? `/vouchers/detail/${record.voucherId}`
              : buildVoucherSourcePath({ kind: "document_record", id: record.id }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <ReceiptText className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        onClick={() => navigate(config.detailPath)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileCheck2 className="h-3.5 w-3.5" />
        {config.detailLabel}
      </button>
      <button
        type="button"
        disabled={displayStatus(record) === "已生成凭证"}
        onClick={() => openEdit(record)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
              <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{config.title}</h1>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {config.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${config.title}清单`}
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
              onClick={openCreate}
              disabled={!companyId || !period}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {config.action}
            </button>
          </div>
        </header>
        {notice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {notice}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-4">
          <Metric
            label={mode === "expense" ? "报销金额" : "票据金额"}
            value={formatCurrency(metrics.amount)}
          />
          <Metric label="待处理" value={`${metrics.pending} 条`} tone="amber" />
          <Metric
            label="待补附件"
            value={`${metrics.missingAttachments} 条`}
            tone={metrics.missingAttachments ? "rose" : "green"}
          />
          <Metric
            label="已生成凭证"
            value={`${metrics.vouchered} 条`}
            tone="green"
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex flex-wrap gap-1">
            {scopeOptions.map((item) => (
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
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder={
                mode === "expense"
                  ? "搜索报销单号、报销人、经办人"
                  : "搜索票据号、收付款方、经办人"
              }
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
        </div>
        {!companyId || !period || loading ? (
          <EmptyState
            message={
              !companyId
                ? "请选择账套后查看记录。"
                : !period
                  ? "请选择账期后查看本期记录。"
                  : "正在读取当前范围记录..."
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#202020] dark:text-slate-300">
                  <tr>
                    <th className="w-[12%] px-3 py-3 font-medium">日期</th>
                    <th className="w-[18%] px-3 py-3 font-medium">编号</th>
                    <th className="w-[14%] px-3 py-3 font-medium">业务类型</th>
                    <th className="w-[17%] px-3 py-3 font-medium">
                      {config.partnerLabel}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      金额
                    </th>
                    <th className="w-[11%] px-3 py-3 font-medium">
                      附件与状态
                    </th>
                    <th className="w-[16%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documentPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-slate-100 align-top dark:border-slate-800"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        {record.businessDate}
                      </td>
                      <td className="break-words px-3 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {record.documentCode}
                      </td>
                      <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                        {record.businessType}
                      </td>
                      <td className="break-words px-3 py-3">
                        <div>{record.partner || "待补"}</div>
                        <div className="mt-1 text-slate-500 dark:text-slate-400">
                          {config.ownerLabel}：{record.owner || "待分配"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-500 dark:text-slate-400">
                          {record.attachmentStatus || "待补附件"}
                        </div>
                        <span
                          className={`mt-1 inline-flex border px-2 py-0.5 text-xs ${statusClass(displayStatus(record))}`}
                        >
                          {displayStatus(record)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{actions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length === 0 && (
                <EmptyState message="当前筛选没有符合条件的记录。" />
              )}
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {filteredRecords.length === 0 ? (
                <EmptyState message="当前筛选没有符合条件的记录。" />
              ) : (
                documentPage.rows.map((record) => (
                  <article
                    key={record.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words font-mono text-sm font-medium">
                          {record.documentCode}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {record.businessDate} · {record.businessType}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 border px-2 py-0.5 text-xs ${statusClass(displayStatus(record))}`}
                      >
                        {displayStatus(record)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {config.partnerLabel}
                        </div>
                        <div className="mt-1 break-words">
                          {record.partner || "待补"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          金额
                        </div>
                        <div className="mt-1 font-medium tabular-nums">
                          {formatCurrency(record.amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {config.ownerLabel}
                        </div>
                        <div className="mt-1 break-words">
                          {record.owner || "待分配"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          附件
                        </div>
                        <div className="mt-1 break-words">
                          {record.attachmentStatus || "待补附件"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">{actions(record)}</div>
                  </article>
                ))
              )}
            </div>
            <OperationalPagination
              page={documentPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {showEditor && (
        <DocumentEditor
          mode={mode}
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

function DocumentEditor({
  mode,
  config,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: DocumentMode;
  config: (typeof configs)[DocumentMode];
  draft: DocumentDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: DocumentDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "expense" ? "费用报销编辑" : "票据编辑"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing
                ? `编辑${mode === "expense" ? "报销单" : "票据"}`
                : config.action}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              保存后仅写入当前账套的原始单据记录，不自动生成或过账凭证。
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
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            业务日期 *
            <input
              required
              type="date"
              value={draft.businessDate}
              onChange={(event) =>
                onChange({ ...draft, businessDate: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            单据编号 *
            <input
              required
              value={draft.documentCode}
              onChange={(event) =>
                onChange({ ...draft, documentCode: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            业务类型
            <select
              value={draft.businessType}
              onChange={(event) =>
                onChange({ ...draft, businessType: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            >
              {config.types.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            {config.partnerLabel}
            <input
              value={draft.partner}
              onChange={(event) =>
                onChange({ ...draft, partner: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            金额 *
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            {config.ownerLabel}
            <input
              value={draft.owner}
              onChange={(event) =>
                onChange({ ...draft, owner: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
            附件状态
            <select
              value={draft.attachmentStatus}
              onChange={(event) =>
                onChange({ ...draft, attachmentStatus: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
            >
              <option>待补附件</option>
              <option>附件齐全</option>
              <option>已归档</option>
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
            disabled={saving}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存记录"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function ReceiptWorkspace() {
  return <DocumentBusinessWorkspace mode="receipt" />;
}

export function ExpenseReimbursementWorkspace() {
  return <DocumentBusinessWorkspace mode="expense" />;
}
