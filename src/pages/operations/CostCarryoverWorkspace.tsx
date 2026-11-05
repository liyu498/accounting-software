import {
  Calculator,
  FilePenLine,
  FileText,
  ListChecks,
  PackageCheck,
  RefreshCw,
  Search,
  TriangleAlert,
  Warehouse,
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
import { costCarryoverApi, type CostCarryoverRecord } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type CarryoverScope = "all" | "review" | "pending" | "vouchered";
type CarryoverDraft = {
  batchNo: string;
  carryoverDate: string;
  valuationMethod: string;
  sourceBillNo: string;
  inventoryName: string;
  debitSubject: string;
  creditSubject: string;
  costAmount: string;
  differenceAmount: string;
  status: string;
  sourceDocument: string;
};

const browserStorageKey = "accounting-preview-cost-carryover-data-v1";
const valuationMethods = ["移动加权", "月末一次加权", "先进先出", "个别计价"];
const scopes: Array<{ id: CarryoverScope; label: string }> = [
  { id: "all", label: "全部结转" },
  { id: "review", label: "差异复核" },
  { id: "pending", label: "待确认" },
  { id: "vouchered", label: "已关联凭证" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function carryoverStatus(record: CostCarryoverRecord) {
  if (record.status === "异常") return "异常";
  if (record.status === "已生成凭证" || record.voucherId || record.voucherNo) return "已关联凭证";
  return record.status || "待确认";
}

function statusClass(status: string) {
  if (status === "已关联凭证" || status === "已核验")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "异常")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function isCostCarryoverRecord(value: unknown): value is CostCarryoverRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CostCarryoverRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    typeof record.batchNo === "string" &&
    typeof record.carryoverDate === "string" &&
    typeof record.valuationMethod === "string" &&
    typeof record.sourceBillNo === "string" &&
    typeof record.inventoryName === "string" &&
    typeof record.debitSubject === "string" &&
    typeof record.creditSubject === "string" &&
    Number.isFinite(record.costAmount) &&
    Number.isFinite(record.differenceAmount) &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function loadBrowserCarryovers(): CostCarryoverRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCostCarryoverRecord) : [];
  } catch {
    return [];
  }
}

function saveBrowserCarryovers(records: CostCarryoverRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    // The active preview remains usable if storage is unavailable.
  }
}

function emptyDraft(carryoverDate: string): CarryoverDraft {
  return {
    batchNo: "",
    carryoverDate,
    valuationMethod: "移动加权",
    sourceBillNo: "",
    inventoryName: "",
    debitSubject: "主营业务成本",
    creditSubject: "库存商品",
    costAmount: "",
    differenceAmount: "0",
    status: "待确认",
    sourceDocument: "",
  };
}

function draftFromRecord(record: CostCarryoverRecord): CarryoverDraft {
  return {
    batchNo: record.batchNo,
    carryoverDate: record.carryoverDate,
    valuationMethod: record.valuationMethod,
    sourceBillNo: record.sourceBillNo,
    inventoryName: record.inventoryName,
    debitSubject: record.debitSubject,
    creditSubject: record.creditSubject,
    costAmount: String(record.costAmount),
    differenceAmount: String(record.differenceAmount),
    status: record.status === "已生成凭证" ? "已核验" : record.status,
    sourceDocument: record.sourceDocument || "",
  };
}

export function CostCarryoverWorkspace() {
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
  const [records, setRecords] = useState<CostCarryoverRecord[]>([]);
  const [scope, setScope] = useState<CarryoverScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<CostCarryoverRecord | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<CarryoverDraft>(() =>
    emptyDraft(defaultDate),
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
        loadBrowserCarryovers().filter(
          (record) =>
            record.companyId === companyId && record.period === period,
        ),
      );
      setLoading(false);
      return;
    }
    const result = await costCarryoverApi.getCostCarryoverRecords({
      companyId,
      period,
    });
    setRecords(result.success ? result.data || [] : []);
    setNotice(
      result.success ? null : `读取成本结转失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = carryoverStatus(record);
      const scopeMatch =
        scope === "all" ||
        (scope === "review" && Math.abs(record.differenceAmount) > 0.005) ||
        (scope === "pending" && status === "待确认") ||
        (scope === "vouchered" && status === "已关联凭证");
      return (
        scopeMatch &&
        (!term ||
          [
            record.batchNo,
            record.inventoryName,
            record.sourceBillNo,
            record.debitSubject,
            record.creditSubject,
            record.voucherNo,
            record.sourceDocument,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const carryoverPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "结转日期",
    "结转批次",
    "计价方法",
    "出库来源",
    "存货",
    "结转成本",
    "差异金额",
    "借方科目",
    "贷方科目",
    "凭证",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.carryoverDate,
        record.batchNo,
        record.valuationMethod,
        record.sourceBillNo,
        record.inventoryName,
        formatCurrency(record.costAmount),
        formatCurrency(record.differenceAmount),
        record.debitSubject,
        record.creditSubject,
        record.voucherNo || "未关联",
        carryoverStatus(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      cost: records.reduce((sum, record) => sum + record.costAmount, 0),
      difference: records.reduce(
        (sum, record) => sum + Math.abs(record.differenceAmount),
        0,
      ),
      pending: records.filter((record) => carryoverStatus(record) === "待确认")
        .length,
      vouchered: records.filter(
        (record) => carryoverStatus(record) === "已关联凭证",
      ).length,
    }),
    [records],
  );

  const openEdit = (record: CostCarryoverRecord) => {
    if (carryoverStatus(record) === "已关联凭证") {
      setNotice("该结转批次已关联凭证，不能修改来源和科目。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period || !editingRecord) {
      setNotice("请先选择需要复核的成本结转记录。");
      return;
    }
    const costAmount = Number(draft.costAmount);
    const differenceAmount = Number(draft.differenceAmount || 0);
    if (
      !draft.batchNo.trim() ||
      !draft.carryoverDate ||
      !draft.valuationMethod ||
      !draft.sourceBillNo.trim() ||
      !draft.inventoryName.trim() ||
      !draft.debitSubject.trim() ||
      !draft.creditSubject.trim() ||
      !Number.isFinite(costAmount) ||
      costAmount < 0 ||
      !Number.isFinite(differenceAmount)
    ) {
      setNotice(
        "请填写批次、日期、计价方法、出库来源、存货、借贷科目、非负结转成本和有效差异金额。",
      );
      return;
    }
    const input = {
      companyId,
      period,
      batchNo: draft.batchNo.trim(),
      carryoverDate: draft.carryoverDate,
      valuationMethod: draft.valuationMethod,
      sourceBillNo: draft.sourceBillNo.trim(),
      inventoryName: draft.inventoryName.trim(),
      debitSubject: draft.debitSubject.trim(),
      creditSubject: draft.creditSubject.trim(),
      costAmount,
      differenceAmount,
      voucherNo: undefined,
      status: draft.status,
      sourceDocument: draft.sourceDocument.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const record: CostCarryoverRecord = {
        ...editingRecord,
        ...input,
        voucherNo: editingRecord.voucherNo,
        sourceDocument: input.sourceDocument || null,
        updatedAt: now,
      };
      saveBrowserCarryovers([
        record,
        ...loadBrowserCarryovers().filter((item) => item.id !== record.id),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice("预览成本结转已更新。");
      await refresh();
      return;
    }
    const result = await costCarryoverApi.updateCostCarryoverRecord({
      ...input,
      id: editingRecord.id,
    });
    setSaving(false);
    if (!result.success) {
      setNotice(`更新成本结转失败：${result.error || "未知错误"}`);
      return;
    }
    setShowEditor(false);
    setNotice("成本结转已更新。");
    await refresh();
  };

  const rowActions = (record: CostCarryoverRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            record.voucherId
              ? `/vouchers/detail/${record.voucherId}`
              : buildVoucherSourcePath({
                  kind: "cost_carryover",
                  id: record.id,
                }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        onClick={() => navigate("/inventory/movements")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Warehouse className="h-3.5 w-3.5" />
        出入库来源
      </button>
      <button
        type="button"
        disabled={carryoverStatus(record) === "已关联凭证"}
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
              <Calculator className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">成本结转与差异复核</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按已核验的出库来源登记存货计价、借贷科目和成本差异；可生成待复核凭证草稿，不自动审核或过账。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="成本结转清单"
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
              onClick={() => navigate("/inventory/movements")}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Warehouse className="h-3.5 w-3.5" />
              选择已核验出库
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={Calculator}
            label="本期结转成本"
            value={formatCurrency(metrics.cost)}
          />
          <Metric
            icon={TriangleAlert}
            label="待复核差异"
            value={formatCurrency(metrics.difference)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={ListChecks}
            label="待确认批次"
            value={`${metrics.pending} 批`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={FileText}
            label="已关联凭证"
            value={`${metrics.vouchered} 批`}
            tone="text-emerald-600 dark:text-emerald-400"
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
              placeholder="搜索批次、存货、来源单据、科目或凭证"
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
          <Placeholder message="请选择账套后查看或维护成本结转。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期成本结转。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取成本结转..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">结转日期</th>
                    <th className="w-[12%] px-3 py-3 font-medium">结转批次</th>
                    <th className="w-[11%] px-3 py-3 font-medium">计价方法</th>
                    <th className="w-[13%] px-3 py-3 font-medium">出库来源</th>
                    <th className="w-[12%] px-3 py-3 font-medium">存货</th>
                    <th className="w-[11%] px-3 py-3 text-right font-medium">
                      结转成本
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      差异金额
                    </th>
                    <th className="w-[10%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[11%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {carryoverPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        {record.carryoverDate}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.batchNo}
                      >
                        {record.batchNo}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.valuationMethod}
                      >
                        {record.valuationMethod}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.sourceBillNo}
                      >
                        {record.sourceBillNo}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.inventoryName}
                      >
                        {record.inventoryName}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.costAmount)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums ${Math.abs(record.differenceAmount) > 0.005 ? "text-amber-700 dark:text-amber-300" : ""}`}
                      >
                        {formatCurrency(record.differenceAmount)}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={carryoverStatus(record)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {carryoverPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.batchNo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.carryoverDate} · {record.valuationMethod}
                      </p>
                    </div>
                    <Status status={carryoverStatus(record)} />
                  </div>
                  <p className="mt-2 truncate text-sm">
                    {record.inventoryName} · {record.sourceBillNo}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="结转成本"
                      value={formatCurrency(record.costAmount)}
                    />
                    <Info
                      label="差异金额"
                      value={formatCurrency(record.differenceAmount)}
                    />
                    <Info label="借方科目" value={record.debitSubject} />
                    <Info label="贷方科目" value={record.creditSubject} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有成本结转批次。" />
            )}
            <OperationalPagination
              page={carryoverPage}
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
          icon={Warehouse}
          title="核对出入库来源"
          description="结转前先核验出库单、存货数量和来源资料，避免跨期或未核价出库。"
          onClick={() => navigate("/inventory/movements")}
        />
        <WorkflowLink
          icon={TriangleAlert}
          title="复核成本差异"
          description="存在差异时必须先补齐计价依据和科目，不应直接把差异写入账簿。"
          onClick={() => setScope("review")}
        />
        <WorkflowLink
          icon={FileText}
          title="查看凭证台账"
          description="成本结转可生成待复核草稿；审核和过账仍在凭证流程中独立完成。"
          onClick={() => navigate("/vouchers")}
        />
      </section>
      {showEditor && (
        <CarryoverEditor
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
      <p
        className="mt-0.5 truncate text-slate-800 dark:text-slate-200"
        title={value}
      >
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

function CarryoverEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: CarryoverDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: CarryoverDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="成本结转编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              复核成本结转
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              出库来源、计价方法和结转成本由已核验出库单锁定；这里只复核科目、差异和证据。
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
          <Field label="结转批次 *">
            <input
              required
              disabled
              value={draft.batchNo}
              onChange={(event) =>
                onChange({ ...draft, batchNo: event.target.value })
              }
            />
          </Field>
          <Field label="结转日期 *">
            <input
              required
              disabled
              type="date"
              value={draft.carryoverDate}
              onChange={(event) =>
                onChange({ ...draft, carryoverDate: event.target.value })
              }
            />
          </Field>
          <Field label="计价方法 *">
            <select
              disabled
              value={draft.valuationMethod}
              onChange={(event) =>
                onChange({ ...draft, valuationMethod: event.target.value })
              }
            >
              {valuationMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>
          <Field label="出库来源单据 *">
            <input
              required
              disabled
              value={draft.sourceBillNo}
              onChange={(event) =>
                onChange({ ...draft, sourceBillNo: event.target.value })
              }
            />
          </Field>
          <Field label="存货名称 *">
            <input
              required
              disabled
              value={draft.inventoryName}
              onChange={(event) =>
                onChange({ ...draft, inventoryName: event.target.value })
              }
            />
          </Field>
          <Field label="来源资料">
            <input
              value={draft.sourceDocument}
              onChange={(event) =>
                onChange({ ...draft, sourceDocument: event.target.value })
              }
            />
          </Field>
          <Field label="借方科目 *">
            <input
              required
              value={draft.debitSubject}
              onChange={(event) =>
                onChange({ ...draft, debitSubject: event.target.value })
              }
            />
          </Field>
          <Field label="贷方科目 *">
            <input
              required
              value={draft.creditSubject}
              onChange={(event) =>
                onChange({ ...draft, creditSubject: event.target.value })
              }
            />
          </Field>
          <Field label="结转成本 *">
            <input
              required
              type="number"
              disabled
              min="0"
              step="0.01"
              value={draft.costAmount}
              onChange={(event) =>
                onChange({ ...draft, costAmount: event.target.value })
              }
            />
          </Field>
          <Field label="差异金额">
            <input
              required
              type="number"
              step="0.01"
              value={draft.differenceAmount}
              onChange={(event) =>
                onChange({ ...draft, differenceAmount: event.target.value })
              }
            />
          </Field>
          <Field label="核验状态">
            <select
              value={draft.status}
              onChange={(event) =>
                onChange({ ...draft, status: event.target.value })
              }
            >
              <option value="待确认">待确认</option>
              <option value="已核验">已核验</option>
              <option value="异常">异常</option>
            </select>
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
            {saving ? "保存中..." : "保存结转批次"}
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
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none [&_select:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
