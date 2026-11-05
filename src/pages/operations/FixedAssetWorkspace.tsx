import {
  BadgeDollarSign,
  Calculator,
  FilePenLine,
  FileText,
  Landmark,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
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
import {
  fixedAssetApi,
  type DepreciationBatch,
  type FixedAsset,
  type FixedAssetDepreciationLine,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";
import {
  useAssetCategoryStore,
  type AssetCategory,
} from "../../stores/assetCategoryStore";

type AssetScope = "all" | "forecast" | "missing" | "vouchered";
type AssetDraft = {
  assetCode: string;
  assetName: string;
  categoryId: string;
  startDate: string;
  originalValue: string;
  usefulLifeMonths: string;
  residualRate: string;
  openingAccumulatedDepreciation: string;
  openingDepreciationMonths: string;
  sourceDocument: string;
};

const browserStorageKey = "accounting-preview-fixed-asset-data-v1";
const browserBatchStorageKey = "accounting-preview-depreciation-batches-v1";
const browserCategoryStorageKey = "accounting-preview-asset-categories-v1";
const scopes: Array<{ id: AssetScope; label: string }> = [
  { id: "all", label: "全部资产" },
  { id: "forecast", label: "本期预测" },
  { id: "missing", label: "待补资料" },
  { id: "vouchered", label: "已生成凭证" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function assetStatus(record: FixedAsset) {
  return record.status || "待确认";
}
function monthlyDepreciation(
  record: Pick<
    FixedAsset,
    "originalValue" | "residualRate" | "usefulLifeMonths"
  >,
) {
  return record.usefulLifeMonths > 0
    ? Math.max(
        0,
        (record.originalValue * (1 - record.residualRate)) /
          record.usefulLifeMonths,
      )
    : 0;
}
function statusClass(status: string) {
  if (status === "已生成凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "异常")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function isFixedAsset(value: unknown): value is FixedAsset {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FixedAsset>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    typeof record.assetCode === "string" &&
    typeof record.assetName === "string" &&
    typeof record.category === "string" &&
    typeof record.startDate === "string" &&
    Number.isFinite(record.originalValue) &&
    Number.isInteger(record.usefulLifeMonths) &&
    Number.isFinite(record.residualRate) &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserAssets(): FixedAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isFixedAsset) : [];
  } catch {
    return [];
  }
}
function saveBrowserAssets(records: FixedAsset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function loadBrowserCategories(): AssetCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserCategoryStorageKey) || "[]",
    ) as AssetCategory[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (category) =>
            category &&
            typeof category.id === "string" &&
            typeof category.company_id === "string" &&
            typeof category.name === "string" &&
            Number.isInteger(category.useful_life_months) &&
            Number.isFinite(category.residual_rate),
        )
      : [];
  } catch {
    return [];
  }
}
function loadBrowserDepreciationBatch(
  companyId: string,
  period: string,
): DepreciationBatch | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserBatchStorageKey) || "[]",
    ) as DepreciationBatch[];
    return Array.isArray(parsed)
      ? parsed.find(
          (item) => item.companyId === companyId && item.period === period,
        ) || null
      : null;
  } catch {
    return null;
  }
}
function emptyDraft(
  startDate: string,
  category?: AssetCategory,
): AssetDraft {
  return {
    assetCode: "",
    assetName: "",
    categoryId: category?.id || "",
    startDate,
    originalValue: "",
    usefulLifeMonths: String(category?.useful_life_months || 36),
    residualRate: String((category?.residual_rate || 0) * 100),
    openingAccumulatedDepreciation: "0",
    openingDepreciationMonths: "0",
    sourceDocument: "",
  };
}
function draftFromRecord(record: FixedAsset): AssetDraft {
  return {
    assetCode: record.assetCode,
    assetName: record.assetName,
    categoryId: record.categoryId || "",
    startDate: record.startDate,
    originalValue: String(record.originalValue),
    usefulLifeMonths: String(record.usefulLifeMonths),
    residualRate: String(record.residualRate * 100),
    openingAccumulatedDepreciation: String(
      record.openingAccumulatedDepreciation || 0,
    ),
    openingDepreciationMonths: String(record.openingDepreciationMonths || 0),
    sourceDocument: record.sourceDocument || "",
  };
}

export function FixedAssetWorkspace() {
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
  const storedAssetCategories = useAssetCategoryStore(
    (state) => state.assetCategories,
  );
  const fetchAssetCategories = useAssetCategoryStore(
    (state) => state.fetchAssetCategories,
  );
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
  const [records, setRecords] = useState<FixedAsset[]>([]);
  const [browserCategories, setBrowserCategories] = useState<AssetCategory[]>(
    [],
  );
  const [depreciationBatch, setDepreciationBatch] =
    useState<DepreciationBatch | null>(null);
  const [depreciationLines, setDepreciationLines] = useState<
    FixedAssetDepreciationLine[]
  >([]);
  const [scope, setScope] = useState<AssetScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<FixedAsset | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(() => emptyDraft(defaultDate));
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);
  useEffect(() => {
    if (!companyId) {
      setBrowserCategories([]);
      return;
    }
    if (isTauri) {
      void fetchAssetCategories(companyId);
      return;
    }
    setBrowserCategories(
      loadBrowserCategories().filter(
        (category) => category.company_id === companyId,
      ),
    );
  }, [companyId, fetchAssetCategories]);
  const assetCategories = useMemo(
    () =>
      (isTauri ? storedAssetCategories : browserCategories).filter(
        (category) => category.company_id === companyId,
      ),
    [browserCategories, companyId, storedAssetCategories],
  );
  const enabledAssetCategories = useMemo(
    () => assetCategories.filter((category) => category.is_enabled === 1),
    [assetCategories],
  );
  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setDepreciationBatch(null);
      setDepreciationLines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      setRecords(
        loadBrowserAssets().filter(
          (record) =>
            record.companyId === companyId &&
            record.period <= period &&
            record.status !== "已处置",
        ),
      );
      setDepreciationBatch(loadBrowserDepreciationBatch(companyId, period));
      const lineResult = await fixedAssetApi.getDepreciationLines({
        companyId,
        period,
      });
      setDepreciationLines(lineResult.success ? lineResult.data || [] : []);
      setLoading(false);
      return;
    }
    const [result, batchResult, lineResult] = await Promise.all([
      fixedAssetApi.getFixedAssets({ companyId, period }),
      fixedAssetApi.getDepreciationBatch({ companyId, period }),
      fixedAssetApi.getDepreciationLines({ companyId, period }),
    ]);
    setRecords(result.success ? result.data || [] : []);
    setDepreciationBatch(batchResult.success ? batchResult.data || null : null);
    setDepreciationLines(lineResult.success ? lineResult.data || [] : []);
    setNotice(
      result.success && batchResult.success && lineResult.success
        ? null
        : `读取固定资产失败：${result.error || batchResult.error || lineResult.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = assetStatus(record);
      const scopeMatch =
        scope === "all" ||
        (scope === "forecast" && status !== "异常") ||
        (scope === "missing" && !record.sourceDocument) ||
        (scope === "vouchered" && Boolean(depreciationBatch?.voucherId));
      return (
        scopeMatch &&
        (!term ||
          [
            record.assetCode,
            record.assetName,
            record.category,
            record.sourceDocument,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [depreciationBatch?.voucherId, keyword, records, scope]);
  const assetPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "资产编码",
    "资产名称",
    "类别",
    "启用日期",
    "原值",
    "使用期限(月)",
    "残值率",
    "月折旧预测",
    "来源单据",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.assetCode,
        record.assetName,
        record.category,
        record.startDate,
        formatCurrency(record.originalValue),
        String(record.usefulLifeMonths),
        `${(record.residualRate * 100).toFixed(2)}%`,
        formatCurrency(monthlyDepreciation(record)),
        record.sourceDocument || "待补",
        assetStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      originalValue: records.reduce(
        (sum, record) => sum + record.originalValue,
        0,
      ),
      projectedDepreciation: records
        .filter((record) => assetStatus(record) !== "异常")
        .reduce((sum, record) => sum + monthlyDepreciation(record), 0),
      missing: records.filter((record) => !record.sourceDocument).length,
      vouchered: depreciationBatch?.voucherId ? 1 : 0,
    }),
    [depreciationBatch?.voucherId, records],
  );
  const openCreate = () => {
    const defaultCategory = enabledAssetCategories[0];
    if (!defaultCategory) {
      setNotice("请先在资产类别中维护至少一个启用类别，再新增固定资产。");
      return;
    }
    setEditingRecord(null);
    setDraft(emptyDraft(defaultDate, defaultCategory));
    setShowEditor(true);
  };
  const openEdit = (record: FixedAsset) => {
    const category = assetCategories.find(
      (item) =>
        item.id === record.categoryId ||
        (!record.categoryId && item.name === record.category),
    );
    setEditingRecord(record);
    setDraft({
      ...draftFromRecord(record),
      categoryId: category?.id || record.categoryId || "",
    });
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护固定资产。");
      return;
    }
    const originalValue = Number(draft.originalValue);
    const usefulLifeMonths = Number(draft.usefulLifeMonths);
    const residualPercent = Number(draft.residualRate || 0);
    const openingAccumulatedDepreciation = Number(
      draft.openingAccumulatedDepreciation || 0,
    );
    const openingDepreciationMonths = Number(
      draft.openingDepreciationMonths || 0,
    );
    const selectedCategory = assetCategories.find(
      (category) => category.id === draft.categoryId,
    );
    if (
      !draft.assetCode.trim() ||
      !draft.assetName.trim() ||
      !selectedCategory ||
      !draft.startDate ||
      !Number.isFinite(originalValue) ||
      originalValue <= 0 ||
      !Number.isInteger(usefulLifeMonths) ||
      usefulLifeMonths <= 0 ||
      !Number.isFinite(residualPercent) ||
      residualPercent < 0 ||
      residualPercent > 100 ||
      !Number.isFinite(openingAccumulatedDepreciation) ||
      openingAccumulatedDepreciation < 0 ||
      openingAccumulatedDepreciation >
        originalValue * (1 - residualPercent / 100) ||
      !Number.isInteger(openingDepreciationMonths) ||
      openingDepreciationMonths < 0 ||
      openingDepreciationMonths > usefulLifeMonths
    ) {
      setNotice(
        "请选择资产类别，并核对编码、启用日期、原值、折旧期限、残值率及期初累计折旧；期初金额和月数不得超过可折旧上限。",
      );
      return;
    }
    const input = {
      companyId,
      period,
      assetCode: draft.assetCode.trim(),
      assetName: draft.assetName.trim(),
      categoryId: selectedCategory.id,
      startDate: draft.startDate,
      originalValue,
      usefulLifeMonths,
      residualRate: residualPercent / 100,
      openingAccumulatedDepreciation,
      openingDepreciationMonths,
      sourceDocument: draft.sourceDocument.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const record: FixedAsset = editingRecord
        ? {
            ...editingRecord,
            ...input,
            category: selectedCategory.name,
            depreciationMethod: editingRecord.categoryId === selectedCategory.id
              ? editingRecord.depreciationMethod ||
                selectedCategory.depreciation_method
              : selectedCategory.depreciation_method,
            assetAccount: editingRecord.categoryId === selectedCategory.id
              ? editingRecord.assetAccount || selectedCategory.asset_account
              : selectedCategory.asset_account,
            accumulatedDepreciationAccount:
              editingRecord.categoryId === selectedCategory.id
                ? editingRecord.accumulatedDepreciationAccount ||
                  selectedCategory.accumulated_depreciation_account
                : selectedCategory.accumulated_depreciation_account,
            expenseAccount: editingRecord.categoryId === selectedCategory.id
              ? editingRecord.expenseAccount || selectedCategory.expense_account
              : selectedCategory.expense_account,
            sourceDocument: input.sourceDocument || null,
            updatedAt: now,
          }
        : {
            id: `preview-fixed-asset-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            category: selectedCategory.name,
            depreciationMethod: selectedCategory.depreciation_method,
            assetAccount: selectedCategory.asset_account,
            accumulatedDepreciationAccount:
              selectedCategory.accumulated_depreciation_account,
            expenseAccount: selectedCategory.expense_account,
            sourceDocument: input.sourceDocument || null,
            status: "待确认",
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserAssets([
        record,
        ...loadBrowserAssets().filter((item) => item.id !== record.id),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord
          ? "预览固定资产已更新。"
          : "预览固定资产已保存，等待折旧资料人工核验。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await fixedAssetApi.updateFixedAsset({ ...input, id: editingRecord.id })
      : await fixedAssetApi.createFixedAsset(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}固定资产失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "固定资产已更新。"
        : "固定资产已保存，可按当前账期汇总生成折旧凭证草稿。",
    );
    await refresh();
  };

  const prepareDepreciation = async () => {
    if (!companyId || !period) {
      setNotice("请先选择账套和账期。");
      return;
    }
    setCalculating(true);
    const result = await fixedAssetApi.prepareDepreciationBatch({
      companyId,
      period,
    });
    setCalculating(false);
    if (!result.success) {
      setNotice(`计算本期折旧失败：${result.error || "未知错误"}`);
      return;
    }
    setNotice(
      `本期折旧已计算：${result.data?.assetCount || 0} 项，金额 ${formatCurrency(result.data?.depreciationAmount || 0)}。请复核明细后生成凭证。`,
    );
    await refresh();
  };

  const rowActions = (record: FixedAsset) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            depreciationBatch?.voucherId
              ? `/vouchers/detail/${depreciationBatch.voucherId}`
              : "/vouchers",
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {depreciationBatch?.voucherId ? "查看本期凭证" : "凭证台账"}
      </button>
      <button
        type="button"
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
              <BadgeDollarSign className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">固定资产与折旧预测</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护资产档案，按直线法汇总本期折旧，并生成独立、可追溯的月度折旧凭证草稿。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void prepareDepreciation()}
              disabled={
                calculating ||
                !companyId ||
                !period ||
                records.length === 0 ||
                Boolean(depreciationBatch?.voucherId)
              }
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <Calculator className="h-3.5 w-3.5" />
              {calculating
                ? "计算中..."
                : depreciationBatch
                  ? "重新计算折旧"
                  : "计算本期折旧"}
            </button>
            <button
              type="button"
              onClick={() =>
                depreciationBatch?.voucherId
                  ? navigate(`/vouchers/detail/${depreciationBatch.voucherId}`)
                  : companyId &&
                    period &&
                    navigate(
                      buildVoucherSourcePath({
                        kind: "depreciation_batch",
                        id: `${companyId}:${period}`,
                      }),
                    )
              }
              disabled={
                !companyId ||
                !period ||
                !depreciationBatch ||
                depreciationLines.length === 0 ||
                depreciationBatch.depreciationAmount <= 0
              }
              className="inline-flex h-8 items-center gap-1 border border-emerald-300 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <FileText className="h-3.5 w-3.5" />
              {depreciationBatch?.voucherId
                ? "查看折旧凭证"
                : "生成折旧凭证"}
            </button>
            <OperationalExportActions
              title="固定资产清单"
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
              新增资产
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={Landmark}
            label="资产原值"
            value={formatCurrency(metrics.originalValue)}
          />
          <Metric
            icon={Calculator}
            label="本期折旧预测"
            value={formatCurrency(metrics.projectedDepreciation)}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={TriangleAlert}
            label="待补来源资料"
            value={`${metrics.missing} 项`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={PackageCheck}
            label="本期折旧凭证"
            value={metrics.vouchered ? "已生成" : "待生成"}
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
              placeholder="搜索资产编码、名称、类别或来源资料"
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
          <Placeholder message="请选择账套后查看或维护固定资产。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期固定资产。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取固定资产..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">资产编码</th>
                    <th className="w-[14%] px-3 py-3 font-medium">资产名称</th>
                    <th className="w-[10%] px-3 py-3 font-medium">类别</th>
                    <th className="w-[10%] px-3 py-3 font-medium">启用日期</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      原值
                    </th>
                    <th className="w-[8%] px-3 py-3 text-right font-medium">
                      期限
                    </th>
                    <th className="w-[8%] px-3 py-3 text-right font-medium">
                      残值率
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      月折旧预测
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[9%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assetPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.assetCode}
                      >
                        {record.assetCode}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.assetName}
                      >
                        {record.assetName}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.category}
                      >
                        {record.category}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {record.startDate}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.originalValue)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {record.usefulLifeMonths} 月
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {(record.residualRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-sky-700 dark:text-sky-300">
                        {formatCurrency(monthlyDepreciation(record))}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={assetStatus(record)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {assetPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.assetCode}
                      </p>
                      <p className="mt-1 truncate text-sm">
                        {record.assetName}
                      </p>
                    </div>
                    <Status status={assetStatus(record)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="资产类别" value={record.category} />
                    <Info label="启用日期" value={record.startDate} />
                    <Info
                      label="资产原值"
                      value={formatCurrency(record.originalValue)}
                    />
                    <Info
                      label="月折旧预测"
                      value={formatCurrency(monthlyDepreciation(record))}
                    />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有固定资产。" />
            )}
            <OperationalPagination
              page={assetPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">本期折旧明细</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {depreciationBatch
                ? `${depreciationBatch.assetCount} 项资产 · ${formatCurrency(depreciationBatch.depreciationAmount)} · ${depreciationBatch.status}`
                : "计算后逐项复核费用科目、累计折旧和期末净值。"}
            </p>
          </div>
          {depreciationBatch?.voucherNumber && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              凭证 {depreciationBatch.voucherNumber}
            </span>
          )}
        </header>
        {depreciationLines.length === 0 ? (
          <Placeholder message="尚未计算本期折旧。" />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[11%] px-3 py-3 font-medium">资产编码</th>
                    <th className="w-[15%] px-3 py-3 font-medium">资产名称</th>
                    <th className="w-[13%] px-3 py-3 font-medium">费用科目</th>
                    <th className="w-[13%] px-3 py-3 font-medium">累计折旧科目</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">期初累计</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">本期折旧</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">期末累计</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">期末净值</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {depreciationLines.map((line) => (
                    <tr key={line.id}>
                      <td className="truncate px-3 py-3 font-mono" title={line.assetCode}>
                        {line.assetCode}
                      </td>
                      <td className="truncate px-3 py-3" title={line.assetName}>
                        {line.assetName}
                      </td>
                      <td className="truncate px-3 py-3" title={line.expenseAccount}>
                        {line.expenseAccount}
                      </td>
                      <td className="truncate px-3 py-3" title={line.accumulatedDepreciationAccount}>
                        {line.accumulatedDepreciationAccount}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(line.openingAccumulatedDepreciation)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-sky-700 dark:text-sky-300">
                        {formatCurrency(line.depreciationAmount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(line.closingAccumulatedDepreciation)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(line.closingNetValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {depreciationLines.map((line) => (
                <article key={line.id} className="border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{line.assetCode}</p>
                      <p className="mt-1 truncate text-sm font-medium">{line.assetName}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-sky-700 dark:text-sky-300">
                      {formatCurrency(line.depreciationAmount)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="费用科目" value={line.expenseAccount} />
                    <Info label="累计折旧科目" value={line.accumulatedDepreciationAccount} />
                    <Info label="期初累计" value={formatCurrency(line.openingAccumulatedDepreciation)} />
                    <Info label="期末净值" value={formatCurrency(line.closingNetValue)} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <WorkflowLink
          icon={Calculator}
          title="复核折旧预测"
          description="以直线法基于原值、残值率和使用期限计算，实际入账前必须人工核验。"
          onClick={() => setScope("forecast")}
        />
        <WorkflowLink
          icon={TriangleAlert}
          title="补齐资产来源"
          description="发票、合同和验收资料不完整时不得把折旧预测直接用于过账。"
          onClick={() => setScope("missing")}
        />
        <WorkflowLink
          icon={FileText}
          title="查看凭证流程"
          description="折旧凭证需在凭证模块中独立编制、审核和过账。"
          onClick={() => navigate("/vouchers")}
        />
      </section>
      {showEditor && (
        <AssetEditor
          draft={draft}
          categories={assetCategories}
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
function AssetEditor({
  draft,
  categories,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: AssetDraft;
  categories: AssetCategory[];
  editing: boolean;
  saving: boolean;
  onChange: (draft: AssetDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="固定资产编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑固定资产" : "新增固定资产"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              平均年限法从启用次月起计提；历史资产应先补录期初累计折旧及已折旧月数。
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
          <Field label="资产编码 *">
            <input
              required
              value={draft.assetCode}
              onChange={(event) =>
                onChange({ ...draft, assetCode: event.target.value })
              }
            />
          </Field>
          <Field label="资产名称 *">
            <input
              required
              value={draft.assetName}
              onChange={(event) =>
                onChange({ ...draft, assetName: event.target.value })
              }
            />
          </Field>
          <Field label="资产类别 *">
            <select
              required
              value={draft.categoryId}
              onChange={(event) => {
                const category = categories.find(
                  (item) => item.id === event.target.value,
                );
                onChange({
                  ...draft,
                  categoryId: event.target.value,
                  usefulLifeMonths: category
                    ? String(category.useful_life_months)
                    : draft.usefulLifeMonths,
                  residualRate: category
                    ? String(category.residual_rate * 100)
                    : draft.residualRate,
                });
              }}
            >
              <option value="">请选择资产类别</option>
              {categories
                .filter(
                  (category) =>
                    category.is_enabled === 1 ||
                    category.id === draft.categoryId,
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.code} · {category.name}
                    {category.is_enabled === 1 ? "" : "（已停用）"}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="启用日期 *">
            <input
              required
              type="date"
              value={draft.startDate}
              onChange={(event) =>
                onChange({ ...draft, startDate: event.target.value })
              }
            />
          </Field>
          <Field label="资产原值 *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.originalValue}
              onChange={(event) =>
                onChange({ ...draft, originalValue: event.target.value })
              }
            />
          </Field>
          <Field label="使用期限（月） *">
            <input
              required
              type="number"
              min="1"
              step="1"
              value={draft.usefulLifeMonths}
              onChange={(event) =>
                onChange({ ...draft, usefulLifeMonths: event.target.value })
              }
            />
          </Field>
          <Field label="残值率（%）">
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.residualRate}
              onChange={(event) =>
                onChange({ ...draft, residualRate: event.target.value })
              }
            />
          </Field>
          <Field label="期初累计折旧">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.openingAccumulatedDepreciation}
              onChange={(event) =>
                onChange({
                  ...draft,
                  openingAccumulatedDepreciation: event.target.value,
                })
              }
            />
          </Field>
          <Field label="期初已折旧月数">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={draft.openingDepreciationMonths}
              onChange={(event) =>
                onChange({
                  ...draft,
                  openingDepreciationMonths: event.target.value,
                })
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
            {saving ? "保存中..." : "保存资产"}
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
