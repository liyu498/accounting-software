import {
  ArchiveRestore,
  BadgeCheck,
  Calculator,
  FilePenLine,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
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
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useAssetCategoryStore,
  type AssetCategory,
  type AssetCategoryInput,
} from "../../stores/assetCategoryStore";

type CategoryScope = "all" | "enabled" | "pendingExpense" | "straightLine";
type CategoryDraft = {
  code: string;
  name: string;
  usefulLifeMonths: string;
  residualRate: string;
  depreciationMethod: string;
  assetAccount: string;
  accumulatedDepreciationAccount: string;
  expenseAccount: string;
  isEnabled: boolean;
};

const browserStorageKey = "accounting-preview-asset-categories-v1";
const browserAssetStorageKey = "accounting-preview-fixed-asset-data-v1";
const scopes: Array<{ id: CategoryScope; label: string }> = [
  { id: "all", label: "全部类别" },
  { id: "enabled", label: "启用中" },
  { id: "pendingExpense", label: "待补费用科目" },
  { id: "straightLine", label: "平均年限法" },
];
const depreciationMethods = [
  "平均年限法",
  "工作量法",
  "双倍余额递减法",
  "年数总和法",
];

function isAssetCategory(value: unknown): value is AssetCategory {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AssetCategory>;
  return (
    typeof record.id === "string" &&
    typeof record.company_id === "string" &&
    typeof record.code === "string" &&
    typeof record.name === "string" &&
    Number.isInteger(record.useful_life_months) &&
    Number.isFinite(record.residual_rate) &&
    typeof record.depreciation_method === "string" &&
    typeof record.asset_account === "string" &&
    typeof record.accumulated_depreciation_account === "string" &&
    typeof record.is_enabled === "number"
  );
}
function loadBrowserCategories(): AssetCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAssetCategory) : [];
  } catch {
    return [];
  }
}
function saveBrowserCategories(records: AssetCategory[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function loadBrowserAssetRecords(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserAssetStorageKey) || "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
      : [];
  } catch {
    return [];
  }
}
function saveBrowserAssetRecords(records: Array<Record<string, unknown>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(browserAssetStorageKey, JSON.stringify(records));
}
function emptyDraft(): CategoryDraft {
  return {
    code: "",
    name: "",
    usefulLifeMonths: "60",
    residualRate: "5",
    depreciationMethod: "平均年限法",
    assetAccount: "1601 固定资产",
    accumulatedDepreciationAccount: "1602 累计折旧",
    expenseAccount: "6602 管理费用",
    isEnabled: true,
  };
}
function draftFromCategory(category: AssetCategory): CategoryDraft {
  return {
    code: category.code,
    name: category.name,
    usefulLifeMonths: String(category.useful_life_months),
    residualRate: String(category.residual_rate * 100),
    depreciationMethod: category.depreciation_method,
    assetAccount: category.asset_account,
    accumulatedDepreciationAccount: category.accumulated_depreciation_account,
    expenseAccount: category.expense_account || "",
    isEnabled: category.is_enabled === 1,
  };
}
function statusClass(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function AssetCategoryWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const assetCategories = useAssetCategoryStore(
    (state) => state.assetCategories,
  );
  const loadingFromStore = useAssetCategoryStore((state) => state.isLoading);
  const storeError = useAssetCategoryStore((state) => state.error);
  const fetchAssetCategories = useAssetCategoryStore(
    (state) => state.fetchAssetCategories,
  );
  const createAssetCategory = useAssetCategoryStore(
    (state) => state.createAssetCategory,
  );
  const updateAssetCategory = useAssetCategoryStore(
    (state) => state.updateAssetCategory,
  );
  const toggleAssetCategory = useAssetCategoryStore(
    (state) => state.toggleAssetCategory,
  );
  const deleteAssetCategory = useAssetCategoryStore(
    (state) => state.deleteAssetCategory,
  );
  const [browserCategories, setBrowserCategories] = useState<AssetCategory[]>(
    [],
  );
  const [scope, setScope] = useState<CategoryScope>("all");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setBrowserCategories([]);
      return;
    }
    if (!isTauri) {
      setBrowserCategories(
        loadBrowserCategories()
          .filter((category) => category.company_id === companyId)
          .sort((left, right) => left.code.localeCompare(right.code, "zh-CN")),
      );
      return;
    }
    await fetchAssetCategories(companyId);
  }, [companyId, fetchAssetCategories]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const records = isTauri ? assetCategories : browserCategories;
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((category) => {
      const matchesScope =
        scope === "all" ||
        (scope === "enabled" && category.is_enabled === 1) ||
        (scope === "pendingExpense" && !category.expense_account) ||
        (scope === "straightLine" &&
          category.depreciation_method === "平均年限法");
      return (
        matchesScope &&
        (!term ||
          [
            category.code,
            category.name,
            category.depreciation_method,
            category.asset_account,
            category.expense_account,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const categoryPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "类别编码",
    "类别名称",
    "使用年限",
    "残值率",
    "折旧方法",
    "固定资产科目",
    "累计折旧科目",
    "费用科目",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((category) => [
        category.code,
        category.name,
        `${category.useful_life_months} 月`,
        `${(category.residual_rate * 100).toFixed(2)}%`,
        category.depreciation_method,
        category.asset_account,
        category.accumulated_depreciation_account,
        category.expense_account || "待补",
        category.is_enabled === 1 ? "启用" : "停用",
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      enabled: records.filter((category) => category.is_enabled === 1).length,
      life: records.length
        ? Math.round(
            records.reduce(
              (sum, category) => sum + category.useful_life_months,
              0,
            ) / records.length,
          )
        : 0,
      missingExpense: records.filter((category) => !category.expense_account)
        .length,
    }),
    [records],
  );
  const openCreate = () => {
    setEditingCategory(null);
    setDraft(emptyDraft());
    setShowEditor(true);
  };
  const openEdit = (category: AssetCategory) => {
    setEditingCategory(category);
    setDraft(draftFromCategory(category));
    setShowEditor(true);
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护资产类别。");
      return;
    }
    const usefulLifeMonths = Number(draft.usefulLifeMonths);
    const residualPercent = Number(draft.residualRate);
    const code = draft.code.trim().toUpperCase();
    if (
      !code ||
      !draft.name.trim() ||
      !Number.isInteger(usefulLifeMonths) ||
      usefulLifeMonths <= 0 ||
      !Number.isFinite(residualPercent) ||
      residualPercent < 0 ||
      residualPercent > 100 ||
      !draft.assetAccount.trim() ||
      !draft.accumulatedDepreciationAccount.trim()
    ) {
      setNotice(
        "请填写编码、名称、正整数折旧年限、0% 至 100% 的残值率和折旧科目。",
      );
      return;
    }
    if (
      records.some(
        (category) =>
          category.code === code && category.id !== editingCategory?.id,
      )
    ) {
      setNotice(`类别编码 ${code} 已存在，请使用其他编码。`);
      return;
    }
    const input: AssetCategoryInput = {
      companyId,
      code,
      name: draft.name.trim(),
      usefulLifeMonths,
      residualRate: residualPercent / 100,
      depreciationMethod: draft.depreciationMethod,
      assetAccount: draft.assetAccount.trim(),
      accumulatedDepreciationAccount:
        draft.accumulatedDepreciationAccount.trim(),
      expenseAccount: draft.expenseAccount.trim() || undefined,
      isEnabled: draft.isEnabled,
    };
    setSaving(true);
    if (!isTauri) {
      const timestamp = new Date().toISOString();
      const record: AssetCategory = editingCategory
        ? {
            ...editingCategory,
            company_id: companyId,
            code: input.code,
            name: input.name,
            useful_life_months: input.usefulLifeMonths,
            residual_rate: input.residualRate,
            depreciation_method: input.depreciationMethod,
            asset_account: input.assetAccount,
            accumulated_depreciation_account:
              input.accumulatedDepreciationAccount,
            expense_account: input.expenseAccount || null,
            is_enabled: input.isEnabled ? 1 : 0,
            updated_at: timestamp,
          }
        : {
            id: `preview-asset-category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            company_id: companyId,
            code: input.code,
            name: input.name,
            useful_life_months: input.usefulLifeMonths,
            residual_rate: input.residualRate,
            depreciation_method: input.depreciationMethod,
            asset_account: input.assetAccount,
            accumulated_depreciation_account:
              input.accumulatedDepreciationAccount,
            expense_account: input.expenseAccount || null,
            is_enabled: input.isEnabled ? 1 : 0,
            created_at: timestamp,
            updated_at: timestamp,
          };
      saveBrowserCategories([
        record,
        ...loadBrowserCategories().filter(
          (category) => category.id !== record.id,
        ),
      ]);
      if (editingCategory && editingCategory.name !== record.name) {
        saveBrowserAssetRecords(
          loadBrowserAssetRecords().map((asset) =>
            asset.categoryId === editingCategory.id ||
            (!asset.categoryId && asset.category === editingCategory.name)
              ? { ...asset, categoryId: editingCategory.id, category: record.name }
              : asset,
          ),
        );
      }
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingCategory
          ? "预览资产类别已更新。"
          : "预览资产类别已保存，可供固定资产录入引用。",
      );
      await refresh();
      return;
    }
    try {
      if (editingCategory) await updateAssetCategory(editingCategory.id, input);
      else await createAssetCategory(input);
      setShowEditor(false);
      setNotice(
        editingCategory
          ? "资产类别已更新；已录入资产保留其原始折旧参数。"
          : "资产类别已保存，可供后续固定资产录入和折旧规则引用。",
      );
    } catch (error) {
      setNotice(
        `${editingCategory ? "更新" : "新增"}资产类别失败：${String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const changeEnabled = async (category: AssetCategory) => {
    if (!companyId) return;
    if (!isTauri) {
      const record = {
        ...category,
        is_enabled: category.is_enabled === 1 ? 0 : 1,
        updated_at: new Date().toISOString(),
      };
      saveBrowserCategories([
        record,
        ...loadBrowserCategories().filter((item) => item.id !== record.id),
      ]);
      setNotice(
        `预览资产类别“${record.name}”已${record.is_enabled === 1 ? "启用" : "停用"}。`,
      );
      await refresh();
      return;
    }
    try {
      const record = await toggleAssetCategory(category.id, companyId);
      setNotice(
        `资产类别“${record.name}”已${record.is_enabled === 1 ? "启用" : "停用"}。`,
      );
    } catch (error) {
      setNotice(`更新资产类别状态失败：${String(error)}`);
    }
  };
  const removeCategory = async (category: AssetCategory) => {
    if (!companyId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除资产类别“${category.code} ${category.name}”吗？类别删除不会重写已录入资产的折旧参数。`,
      )
    )
      return;
    if (!isTauri) {
      const referenced = loadBrowserAssetRecords().some(
        (asset) =>
          asset.categoryId === category.id ||
          (!asset.categoryId && asset.category === category.name),
      );
      if (referenced) {
        setNotice("已有固定资产引用该类别，不能删除。");
        return;
      }
      saveBrowserCategories(
        loadBrowserCategories().filter((item) => item.id !== category.id),
      );
      setNotice(`预览资产类别“${category.name}”已删除。`);
      await refresh();
      return;
    }
    try {
      await deleteAssetCategory(category.id, companyId);
      setNotice(`资产类别“${category.name}”已删除。`);
    } catch (error) {
      setNotice(`删除资产类别失败：${String(error)}`);
    }
  };

  const rowActions = (category: AssetCategory) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => openEdit(category)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FilePenLine className="h-3.5 w-3.5" />
        编辑
      </button>
      <button
        type="button"
        onClick={() => void changeEnabled(category)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        {category.is_enabled === 1 ? "停用" : "启用"}
      </button>
      <button
        type="button"
        onClick={() => void removeCategory(category)}
        className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
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
              <ArchiveRestore className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">资产类别与折旧口径</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护折旧年限、残值率和默认科目；类别变更只作用于后续资产录入，已录入资产保留原始折旧参数。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="资产类别清单"
              companyName={selectedCompany?.name}
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
              disabled={!companyId}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增类别
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ArchiveRestore}
            label="类别数量"
            value={`${metrics.total} 类`}
          />
          <Metric
            icon={BadgeCheck}
            label="启用中"
            value={`${metrics.enabled} 类`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={Calculator}
            label="平均年限"
            value={`${metrics.life} 月`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={Landmark}
            label="待补费用科目"
            value={`${metrics.missingExpense} 类`}
            tone="text-amber-600 dark:text-amber-400"
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
              placeholder="搜索编码、类别、折旧方法或科目"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {storeError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            读取资产类别失败：{storeError}
          </div>
        )}
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护资产类别。" />
        )}
        {companyId && loadingFromStore && isTauri && (
          <Placeholder message="正在读取资产类别..." />
        )}
        {companyId && (!isTauri || !loadingFromStore) && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">类别编码</th>
                    <th className="w-[14%] px-3 py-3 font-medium">类别名称</th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      使用年限
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      残值率
                    </th>
                    <th className="w-[12%] px-3 py-3 font-medium">折旧方法</th>
                    <th className="w-[14%] px-3 py-3 font-medium">
                      固定资产科目
                    </th>
                    <th className="w-[14%] px-3 py-3 font-medium">
                      累计折旧科目
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">费用科目</th>
                    <th className="w-[7%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[15%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryPage.rows.map((category) => (
                    <tr
                      key={category.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={category.code}
                      >
                        {category.code}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-medium"
                        title={category.name}
                      >
                        {category.name}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {category.useful_life_months} 月
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {(category.residual_rate * 100).toFixed(2)}%
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={category.depreciation_method}
                      >
                        {category.depreciation_method}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={category.asset_account}
                      >
                        {category.asset_account}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={category.accumulated_depreciation_account}
                      >
                        {category.accumulated_depreciation_account}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={category.expense_account || ""}
                      >
                        {category.expense_account || "待补"}
                      </td>
                      <td className="px-3 py-3">
                        <Status enabled={category.is_enabled === 1} />
                      </td>
                      <td className="px-3 py-3">{rowActions(category)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {categoryPage.rows.map((category) => (
                <article
                  key={category.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {category.code}
                      </p>
                      <p className="mt-1 truncate text-sm">{category.name}</p>
                    </div>
                    <Status enabled={category.is_enabled === 1} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="折旧口径"
                      value={`${category.depreciation_method} / ${category.useful_life_months} 月`}
                    />
                    <Info
                      label="残值率"
                      value={`${(category.residual_rate * 100).toFixed(2)}%`}
                    />
                    <Info label="资产科目" value={category.asset_account} />
                    <Info
                      label="费用科目"
                      value={category.expense_account || "待补"}
                    />
                  </div>
                  <div className="mt-3">{rowActions(category)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有资产类别。" />
            )}
            <OperationalPagination
              page={categoryPage}
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
          title="登记固定资产"
          description="固定资产录入时复制当前类别参数；后续类别调整不会追溯改写资产档案。"
          onClick={() => navigate("/depreciation")}
        />
        <WorkflowLink
          icon={Tags}
          title="复核会计科目"
          description="资产、累计折旧和费用科目应保持启用，并在会计科目页复核核算口径。"
          onClick={() => navigate("/settings/account-codes")}
        />
        <WorkflowLink
          icon={Calculator}
          title="查看成本结转"
          description="折旧入账与成本结转分别在各自工作台复核，不从类别页自动生成凭证。"
          onClick={() => navigate("/cost-carryover")}
        />
      </section>
      {showEditor && (
        <CategoryEditor
          draft={draft}
          editing={Boolean(editingCategory)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveCategory}
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
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function Status({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(enabled)}`}
    >
      {enabled ? "启用" : "停用"}
    </span>
  );
}
function Placeholder({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className="mt-0.5 truncate text-slate-800 dark:text-slate-100"
        title={value}
      >
        {value}
      </p>
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
      className="min-w-0 border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-2 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
function CategoryEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: CategoryDraft;
  editing: boolean;
  saving: boolean;
  onChange: (
    value: CategoryDraft | ((current: CategoryDraft) => CategoryDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑资产类别" : "新增资产类别"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[94vh] w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">
              {editing ? "编辑资产类别" : "新增资产类别"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              类别参数用于后续固定资产录入和折旧建议，保存不会自动生成或过账凭证。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            取消
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="类别编码 *">
            <input
              required
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="如：FA01"
              className={inputClass}
            />
          </Field>
          <Field label="类别名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：机器设备"
              className={inputClass}
            />
          </Field>
          <Field label="折旧年限（月） *">
            <input
              required
              type="number"
              min="1"
              step="1"
              value={draft.usefulLifeMonths}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  usefulLifeMonths: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="残值率（%） *">
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.residualRate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  residualRate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="折旧方法 *">
            <select
              value={draft.depreciationMethod}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  depreciationMethod: event.target.value,
                }))
              }
              className={inputClass}
            >
              {depreciationMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </Field>
          <Field label="费用科目">
            <input
              value={draft.expenseAccount}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  expenseAccount: event.target.value,
                }))
              }
              placeholder="如：6602 管理费用"
              className={inputClass}
            />
          </Field>
          <Field label="固定资产科目 *">
            <input
              required
              value={draft.assetAccount}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  assetAccount: event.target.value,
                }))
              }
              placeholder="如：1601 固定资产"
              className={inputClass}
            />
          </Field>
          <Field label="累计折旧科目 *">
            <input
              required
              value={draft.accumulatedDepreciationAccount}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  accumulatedDepreciationAccount: event.target.value,
                }))
              }
              placeholder="如：1602 累计折旧"
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.isEnabled}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isEnabled: event.target.checked,
                }))
              }
            />
            立即启用
          </label>
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
            className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            {saving ? "正在保存" : "保存类别"}
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
      {children}
    </label>
  );
}
