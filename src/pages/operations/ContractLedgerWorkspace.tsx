import {
  Archive,
  BadgeCheck,
  CircleAlert,
  FilePenLine,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Stamp,
  type LucideIcon,
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
import { documentRecordApi, type DocumentRecord } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type ContractScope = "all" | "pendingTax" | "missingArchive" | "vouchered";
type ContractDraft = {
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
const contractTypes = [
  "销售合同",
  "采购合同",
  "服务合同",
  "技术合同",
  "其他合同",
];
const attachmentOptions = ["已归档", "待补附件", "待复核", "需补资料"];
const scopes: Array<{ id: ContractScope; label: string }> = [
  { id: "all", label: "本期合同" },
  { id: "pendingTax", label: "待确认税目" },
  { id: "missingArchive", label: "待补归档" },
  { id: "vouchered", label: "已关联凭证" },
];
const emptyDraft = (): ContractDraft => ({
  businessDate: "",
  documentCode: "",
  businessType: "销售合同",
  partner: "",
  amount: "",
  owner: "",
  attachmentStatus: "待补附件",
  stampTaxItem: "",
  stampTaxRate: "",
});

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
    // The current preview remains usable when local storage is unavailable.
  }
}

function isContract(record: DocumentRecord) {
  return /合同/.test(record.businessType) || Boolean(record.stampTaxItem);
}
function needsTaxConfirmation(record: DocumentRecord) {
  return !record.stampTaxItem || record.stampTaxRate === null;
}
function needsArchive(record: DocumentRecord) {
  return record.attachmentStatus !== "已归档";
}
function contractStatus(record: DocumentRecord) {
  if (record.status === "异常") return "异常";
  if (record.status === "已生成凭证") return "已关联凭证";
  if (needsArchive(record)) return "待补归档";
  if (needsTaxConfirmation(record)) return "待确认税目";
  return "资料齐全";
}
function statusClass(status: string) {
  if (status === "资料齐全" || status === "已关联凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "异常" || status === "待补归档")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function draftFromRecord(record: DocumentRecord): ContractDraft {
  return {
    businessDate: record.businessDate,
    documentCode: record.documentCode,
    businessType: contractTypes.includes(record.businessType)
      ? record.businessType
      : "其他合同",
    partner: record.partner || "",
    amount: String(record.amount),
    owner: record.owner || "",
    attachmentStatus: attachmentOptions.includes(record.attachmentStatus)
      ? record.attachmentStatus
      : "待补附件",
    stampTaxItem: record.stampTaxItem || "",
    stampTaxRate:
      record.stampTaxRate === null ? "" : String(record.stampTaxRate * 100),
  };
}

export function ContractLedgerWorkspace() {
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
  const [scope, setScope] = useState<ContractScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DocumentRecord | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft);
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
            isContract(record),
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
    setRecords(result.success ? (result.data || []).filter(isContract) : []);
    setNotice(
      result.success ? null : `读取合同台账失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const matchesScope =
        scope === "all" ||
        (scope === "pendingTax" && needsTaxConfirmation(record)) ||
        (scope === "missingArchive" && needsArchive(record)) ||
        (scope === "vouchered" && record.status === "已生成凭证");
      return (
        matchesScope &&
        (!term ||
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
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const contractPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "合同编号",
    "相对方",
    "合同类型",
    "签订日期",
    "合同金额",
    "印花税税目",
    "印花税率",
    "归档状态",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.documentCode,
        record.partner || "待补相对方",
        record.businessType,
        record.businessDate,
        formatCurrency(record.amount),
        record.stampTaxItem || "待确认税目",
        record.stampTaxRate === null
          ? "待补税率"
          : `${(record.stampTaxRate * 100).toFixed(3)}%`,
        record.attachmentStatus,
        contractStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      amount: records.reduce((sum, record) => sum + record.amount, 0),
      archived: records.filter((record) => !needsArchive(record)).length,
      pendingTax: records.filter(needsTaxConfirmation).length,
      vouchered: records.filter((record) => record.status === "已生成凭证")
        .length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditingRecord(null);
    setDraft({ ...emptyDraft(), businessDate: defaultBusinessDate });
    setShowEditor(true);
  };
  const openEdit = (record: DocumentRecord) => {
    if (record.status === "已生成凭证") {
      setNotice("该合同已关联凭证，请先在凭证流程完成复核后再调整来源资料。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };
  const saveContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护合同台账。");
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
        "请填写签订日期、合同编号、合同类型和大于零的金额；印花税率需为非负数。",
      );
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
      stampTaxItem: draft.stampTaxItem.trim() || undefined,
      stampTaxRate,
    };
    setSaving(true);
    try {
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
              id: `preview-contract-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
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
      } else {
        const result = editingRecord
          ? await documentRecordApi.updateDocumentRecord({
              ...input,
              id: editingRecord.id,
            })
          : await documentRecordApi.createDocumentRecord(input);
        if (!result.success) throw new Error(result.error || "未知错误");
      }
      setShowEditor(false);
      setNotice(
        editingRecord
          ? "合同资料已更新。请继续复核归档附件和印花税税目。"
          : "合同已登记。需人工复核归档附件、税目和凭证关联。",
      );
      await refresh();
    } catch (error) {
      setNotice(`保存合同资料失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const rowActions = (record: DocumentRecord) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => navigate("/tax/stamp")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Stamp className="h-3.5 w-3.5" />
        印花税复核
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
              <FileText className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">合同台账</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护本期客户、供应商和服务合同的相对方、金额、印花税取数、归档和凭证关联资料。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="合同台账"
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
              新增合同
            </button>
          </div>
        </header>
        {companyId && (
          <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium">使用边界</p>
              <p className="mt-1">
                合同台账不替代合同审批或税务申报确认。这里只维护本地合同资料、归档状态和印花税取数依据，不会对外签署、审批或提交申报。
              </p>
            </div>
            <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
              已关联凭证的合同禁止直接修改。附件状态仅表示本地归档复核结果，不上传或替代原合同文件。
            </p>
          </div>
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={FileText}
            label="合同数量"
            value={`${metrics.total} 份`}
          />
          <Metric
            icon={Landmark}
            label="合同金额"
            value={formatCurrency(metrics.amount)}
          />
          <Metric
            icon={Archive}
            label="已归档"
            value={`${metrics.archived} 份`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={CircleAlert}
            label="待确认税目"
            value={`${metrics.pendingTax} 份`}
            tone={
              metrics.pendingTax
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
          <Metric
            icon={BadgeCheck}
            label="已关联凭证"
            value={`${metrics.vouchered} 份`}
            tone="text-sky-700 dark:text-sky-300"
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_20rem]">
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
              placeholder="搜索合同编号、相对方、类型、税目或经办人"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && <Notice value={notice} />}
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护合同台账。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期合同资料。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取合同台账..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[12%] px-4 py-3 font-medium">合同编号</th>
                    <th className="w-[14%] px-4 py-3 font-medium">相对方</th>
                    <th className="w-[11%] px-4 py-3 font-medium">合同类型</th>
                    <th className="w-[11%] px-4 py-3 font-medium">签订日期</th>
                    <th className="w-[12%] px-4 py-3 text-right font-medium">
                      合同金额
                    </th>
                    <th className="w-[12%] px-4 py-3 font-medium">
                      印花税取数
                    </th>
                    <th className="w-[10%] px-4 py-3 font-medium">归档状态</th>
                    <th className="w-[9%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[9%] px-4 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contractPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {record.documentCode}
                      </td>
                      <td className="truncate px-4 py-3">
                        {record.partner || "待补相对方"}
                      </td>
                      <td className="truncate px-4 py-3">
                        {record.businessType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {record.businessDate}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate">
                          {record.stampTaxItem || "待确认税目"}
                        </p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {record.stampTaxRate === null
                            ? "待补税率"
                            : `${(record.stampTaxRate * 100).toFixed(3)}%`}
                        </p>
                      </td>
                      <td className="px-4 py-3">{record.attachmentStatus}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(contractStatus(record))}`}
                        >
                          {contractStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {contractPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.documentCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.businessType} · {record.businessDate}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 border px-2 py-0.5 text-xs ${statusClass(contractStatus(record))}`}
                    >
                      {contractStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info label="相对方" value={record.partner || "待补"} />
                    <Info
                      label="合同金额"
                      value={formatCurrency(record.amount)}
                    />
                    <Info
                      label="印花税税目"
                      value={record.stampTaxItem || "待确认"}
                    />
                    <Info label="归档状态" value={record.attachmentStatus} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有合同资料。新增合同后需继续复核归档附件、税目和凭证关联。" />
            )}
            <OperationalPagination
              page={contractPage}
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
          icon={Stamp}
          title="印花税复核"
          description="按合同税目、计税金额和归档资料复核取数，确认后再由人工处理申报事项。"
          onClick={() => navigate("/tax/stamp")}
        />
        <QuickLink
          icon={FilePenLine}
          title="原始单据登记"
          description="登记非合同类业务资料、附件和来源单据，避免在合同台账中混入无关业务。"
          onClick={() => navigate("/documents")}
        />
      </section>
      {showEditor && (
        <ContractEditor
          draft={draft}
          editing={Boolean(editingRecord)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveContract}
        />
      )}
    </main>
  );
}

function ContractEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ContractDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: ContractDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑合同资料" : "新增合同资料"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑合同资料" : "新增合同资料"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            保存后仍需人工复核附件、税目和凭证关联；系统不会对外签署、审批或申报。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="签订日期 *">
            <input
              required
              type="date"
              value={draft.businessDate}
              onChange={(event) =>
                onChange({ ...draft, businessDate: event.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="合同编号 *">
            <input
              required
              value={draft.documentCode}
              onChange={(event) =>
                onChange({ ...draft, documentCode: event.target.value })
              }
              placeholder="如：HT-2026-001"
              className={inputClass}
            />
          </Field>
          <Field label="合同类型 *">
            <select
              value={draft.businessType}
              onChange={(event) =>
                onChange({ ...draft, businessType: event.target.value })
              }
              className={inputClass}
            >
              {contractTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="客户/供应商">
            <input
              value={draft.partner}
              onChange={(event) =>
                onChange({ ...draft, partner: event.target.value })
              }
              placeholder="请输入相对方名称"
              className={inputClass}
            />
          </Field>
          <Field label="合同金额 *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
              }
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
          <Field label="经办人">
            <input
              value={draft.owner}
              onChange={(event) =>
                onChange({ ...draft, owner: event.target.value })
              }
              placeholder="如：张三"
              className={inputClass}
            />
          </Field>
          <Field label="归档状态">
            <select
              value={draft.attachmentStatus}
              onChange={(event) =>
                onChange({ ...draft, attachmentStatus: event.target.value })
              }
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
            />
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
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
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "正在保存" : editing ? "保存修改" : "保存合同"}
          </button>
        </footer>
      </form>
    </div>
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
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
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
      <p className="mt-0.5 truncate text-slate-800 dark:text-slate-100">
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
function Placeholder({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
      className="border border-slate-200 bg-white p-3 text-left hover:border-[#1f65a7] dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-500"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
