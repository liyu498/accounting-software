import {
  ClipboardCheck,
  FilePenLine,
  FilePlus2,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Stamp,
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

type DocumentScope = "all" | "pending" | "attachments" | "vouchered";
type DocumentDraft = {
  businessDate: string;
  documentCode: string;
  businessType: string;
  partner: string;
  amount: string;
  owner: string;
  attachmentStatus: string;
  stampTaxItem: string;
  stampTaxRate: string;
};

type BrowserDocumentBusinessData = {
  documentRecords: DocumentRecord[];
  businessOrders: unknown[];
};

const browserStorageKey = "accounting-preview-document-business-data-v2";
const scopes: Array<{ id: DocumentScope; label: string }> = [
  { id: "all", label: "全部单据" },
  { id: "pending", label: "待审核" },
  { id: "attachments", label: "待补附件" },
  { id: "vouchered", label: "已生成凭证" },
];
const businessTypes = ["费用报销", "采购入库", "销售出库", "合同", "其他"];
const attachmentOptions = ["待补附件", "附件齐全", "待复核"];
const emptyDraft: DocumentDraft = {
  businessDate: "",
  documentCode: "",
  businessType: "费用报销",
  partner: "",
  amount: "",
  owner: "",
  attachmentStatus: "待补附件",
  stampTaxItem: "",
  stampTaxRate: "",
};

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
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as Partial<BrowserDocumentBusinessData> | null;
    if (
      !parsed ||
      !Array.isArray(parsed.documentRecords) ||
      !Array.isArray(parsed.businessOrders)
    )
      return { documentRecords: [], businessOrders: [] };
    const documentRecords = parsed.documentRecords.filter(
      (record): record is DocumentRecord =>
        Boolean(
          record &&
          typeof record.id === "string" &&
          typeof record.companyId === "string" &&
          typeof record.period === "string" &&
          typeof record.documentCode === "string" &&
          typeof record.businessType === "string" &&
          Number.isFinite(record.amount) &&
          typeof record.status === "string",
        ),
    );
    return { documentRecords, businessOrders: parsed.businessOrders };
  } catch {
    return { documentRecords: [], businessOrders: [] };
  }
}

function saveBrowserDocumentBusinessData(data: BrowserDocumentBusinessData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(data));
  } catch {
    // The current session remains usable when browser storage is unavailable.
  }
}

function isMissingAttachment(record: DocumentRecord) {
  return record.attachmentStatus !== "附件齐全";
}

function documentStatus(record: DocumentRecord) {
  if (record.status === "已生成凭证") return "已生成凭证";
  if (isMissingAttachment(record)) return "待补附件";
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
    stampTaxItem: record.stampTaxItem || "",
    stampTaxRate:
      record.stampTaxRate === null ? "" : String(record.stampTaxRate * 100),
  };
}

export function DocumentRegisterWorkspace() {
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
  const defaultBusinessDate =
    currentPeriod?.end_date || browserPreviewPeriod?.end_date || "";
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [scope, setScope] = useState<DocumentScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DocumentRecord | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<DocumentDraft>(emptyDraft);
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
            record.companyId === companyId && record.period === period,
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
    setRecords(result.success ? result.data || [] : []);
    setNotice(
      result.success ? null : `读取单据资料失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = documentStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "pending" && status !== "已生成凭证") ||
        (scope === "attachments" && isMissingAttachment(record)) ||
        (scope === "vouchered" && status === "已生成凭证");
      return (
        inScope &&
        (!normalizedKeyword ||
          [
            record.documentCode,
            record.businessType,
            record.partner,
            record.owner,
            record.stampTaxItem,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const documentPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "业务日期",
    "单据编号",
    "业务类型",
    "往来单位",
    "金额",
    "经办人",
    "附件",
    "印花税税目",
    "印花税率",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.businessDate,
        record.documentCode,
        record.businessType,
        record.partner || "待补",
        formatCurrency(record.amount),
        record.owner || "未分配",
        record.attachmentStatus || "待补附件",
        record.stampTaxItem || "不适用",
        record.stampTaxRate === null
          ? "不适用"
          : `${(record.stampTaxRate * 100).toFixed(3)}%`,
        documentStatus(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      totalAmount: records.reduce((sum, record) => sum + record.amount, 0),
      pending: records.filter(
        (record) => documentStatus(record) !== "已生成凭证",
      ).length,
      missingAttachments: records.filter(isMissingAttachment).length,
      stampTax: records.filter((record) => Boolean(record.stampTaxItem)).length,
    }),
    [records],
  );

  const openCreate = (businessType = "费用报销") => {
    setEditingRecord(null);
    setDraft({
      ...emptyDraft,
      businessType,
      businessDate: defaultBusinessDate,
    });
    setShowEditor(true);
  };

  const openEdit = (record: DocumentRecord) => {
    if (record.status === "已生成凭证") {
      setNotice("该单据已生成凭证，请先在凭证流程完成复核后再调整来源资料。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护单据。");
      return;
    }
    const amount = Number(draft.amount);
    const stampTaxRate =
      draft.stampTaxRate === "" ? undefined : Number(draft.stampTaxRate) / 100;
    if (
      !draft.businessDate ||
      !draft.documentCode.trim() ||
      !draft.businessType ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (stampTaxRate !== undefined &&
        (!Number.isFinite(stampTaxRate) || stampTaxRate < 0))
    ) {
      setNotice(
        "请填写业务日期、单据编号、业务类型和大于零的金额；印花税率需为非负数。",
      );
      return;
    }
    setSaving(true);
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
      stampTaxItem: draft.stampTaxItem.trim() || undefined,
      stampTaxRate,
    };
    if (!isTauri) {
      const data = loadBrowserDocumentBusinessData();
      const timestamp = new Date().toISOString();
      const record: DocumentRecord = editingRecord
        ? {
            ...editingRecord,
            ...input,
            partner: input.partner || null,
            owner: input.owner || null,
            stampTaxItem: input.stampTaxItem || null,
            stampTaxRate: input.stampTaxRate ?? null,
            updatedAt: timestamp,
          }
        : {
            id: `preview-document-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            partner: input.partner || null,
            owner: input.owner || null,
            stampTaxItem: input.stampTaxItem || null,
            stampTaxRate: input.stampTaxRate ?? null,
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
          ? "预览单据已更新。"
          : "预览单据已保存，待补附件或人工审核后再进入凭证流程。",
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
        `${editingRecord ? "更新" : "新增"}单据失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "单据已更新。"
        : "单据已登记，需人工审核，系统不自动生成或过账凭证。",
    );
    await refresh();
  };

  const rowActions = (record: DocumentRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            record.voucherId
              ? `/vouchers/detail/${record.voucherId}`
              : buildVoucherSourcePath({
                  kind: "document_record",
                  id: record.id,
                }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        disabled={record.status === "已生成凭证"}
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
              <ClipboardCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">原始单据登记与核验</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护非发票和非流水来源的业务单据、附件与印花税取数；可生成待复核凭证草稿，不自动审核或过账。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="原始单据清单"
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
              onClick={() => openCreate()}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              登记单据
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={WalletCards}
            label="本期金额"
            value={formatCurrency(metrics.totalAmount)}
          />
          <Metric
            icon={ClipboardCheck}
            label="待审核"
            value={`${metrics.pending} 张`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={FileText}
            label="待补附件"
            value={`${metrics.missingAttachments} 张`}
            tone={
              metrics.missingAttachments
                ? "text-rose-600 dark:text-rose-400"
                : undefined
            }
          />
          <Metric
            icon={Stamp}
            label="印花税取数"
            value={`${metrics.stampTax} 张`}
            tone="text-sky-700 dark:text-sky-300"
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
              placeholder="搜索单据编号、类型、往来单位或经办人"
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
          <Placeholder message="请选择账套后查看或维护原始单据。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期单据。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取单据资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">业务日期</th>
                    <th className="px-4 py-3 font-medium">单据编号</th>
                    <th className="px-4 py-3 font-medium">业务类型</th>
                    <th className="px-4 py-3 font-medium">往来单位</th>
                    <th className="px-4 py-3 text-right font-medium">金额</th>
                    <th className="px-4 py-3 font-medium">附件</th>
                    <th className="px-4 py-3 font-medium">印花税</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documentPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {record.businessDate}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {record.documentCode}
                      </td>
                      <td className="px-4 py-3">{record.businessType}</td>
                      <td className="px-4 py-3">{record.partner || "待补"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {record.attachmentStatus || "待补附件"}
                      </td>
                      <td className="px-4 py-3">
                        {record.stampTaxItem
                          ? `${record.stampTaxItem}${record.stampTaxRate === null ? "" : ` · ${(record.stampTaxRate * 100).toFixed(3)}%`}`
                          : "不适用"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(documentStatus(record))}`}
                        >
                          {documentStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {documentPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {record.documentCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.businessDate} · {record.businessType}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(documentStatus(record))}`}
                    >
                      {documentStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="往来单位" value={record.partner || "待补"} />
                    <Info label="金额" value={formatCurrency(record.amount)} />
                    <Info
                      label="附件"
                      value={record.attachmentStatus || "待补附件"}
                    />
                    <Info
                      label="印花税"
                      value={record.stampTaxItem || "不适用"}
                    />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有单据记录。" />
            )}
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
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <QuickLink
          icon={FilePlus2}
          title="费用报销登记"
          description="补齐报销人、附件、审批和付款资料后，再由人工复核费用凭证。"
          onClick={() => openCreate("费用报销")}
        />
        <QuickLink
          icon={Landmark}
          title="印花税取数"
          description="登记应税凭证和税目后，进入印花税模块复核取数、税率和申报口径。"
          onClick={() => navigate("/tax/stamp")}
        />
      </section>
      {showEditor && (
        <DocumentEditor
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

function QuickLink({
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

function DocumentEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
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
      aria-label="单据登记编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑登记单据" : "登记原始单据"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              保存后仍需核验附件、税目和人工审核状态，系统不会自动生成凭证。
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
          <Field label="业务日期 *">
            <input
              required
              type="date"
              value={draft.businessDate}
              onChange={(event) =>
                onChange({ ...draft, businessDate: event.target.value })
              }
            />
          </Field>
          <Field label="单据编号 *">
            <input
              required
              value={draft.documentCode}
              onChange={(event) =>
                onChange({ ...draft, documentCode: event.target.value })
              }
            />
          </Field>
          <Field label="业务类型 *">
            <select
              value={draft.businessType}
              onChange={(event) =>
                onChange({ ...draft, businessType: event.target.value })
              }
            >
              {businessTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="往来单位/部门">
            <input
              value={draft.partner}
              onChange={(event) =>
                onChange({ ...draft, partner: event.target.value })
              }
            />
          </Field>
          <Field label="金额 *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
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
          <Field label="附件状态">
            <select
              value={draft.attachmentStatus}
              onChange={(event) =>
                onChange({ ...draft, attachmentStatus: event.target.value })
              }
            >
              {attachmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="印花税税目">
            <input
              value={draft.stampTaxItem}
              onChange={(event) =>
                onChange({ ...draft, stampTaxItem: event.target.value })
              }
              placeholder="如：购销合同"
            />
          </Field>
          <Field label="印花税率（%）">
            <input
              type="number"
              min="0"
              step="0.001"
              value={draft.stampTaxRate}
              onChange={(event) =>
                onChange({ ...draft, stampTaxRate: event.target.value })
              }
              placeholder="可选"
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
            {saving ? "保存中..." : "保存单据"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none [&_select:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
