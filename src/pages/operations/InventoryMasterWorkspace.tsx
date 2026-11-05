import {
  Boxes,
  Calculator,
  FilePenLine,
  FileText,
  ListTree,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Tags,
  Trash2,
  X,
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
  inventoryItemApi,
  inventoryMasterDataApi,
  measurementUnitApi,
  type InventoryBom,
  type InventoryCategory,
  type InventoryItem,
  type MeasurementUnit,
} from "../../lib/api";
import {
  normalizeInventoryBomDraft,
  validateInventoryBomGraph,
  type InventoryBomDraft,
} from "../../lib/inventoryBom.js";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";

type InventoryScope = "all" | "missingTax" | "missingSubject" | "enabled";
type InventoryDraft = {
  itemCode: string;
  itemName: string;
  specification: string;
  unitId: string;
  taxRate: string;
  categoryId: string;
  valuationMethod: string;
  inventorySubject: string;
  costSubject: string;
  safetyStock: string;
};
type CategoryDraft = {
  categoryCode: string;
  categoryName: string;
  inventorySubject: string;
  costSubject: string;
  status: string;
};
type BomDraft = Omit<InventoryBomDraft, "expirationDate" | "note" | "lines"> & {
  expirationDate: string;
  note: string;
  lines: Array<{
    componentItemId: string;
    quantity: string;
    lossRate: string;
    note: string;
  }>;
};

const browserStorageKey = "accounting-preview-inventory-item-data-v1";
const browserCategoryStorageKey = "accounting-preview-inventory-category-data-v1";
const browserUnitStorageKey = "accounting-preview-measurement-unit-data-v1";
const browserBomStorageKey = "accounting-preview-inventory-bom-data-v1";
const browserInventoryBusinessKeys = [
  "accounting-preview-inventory-movement-data-v1",
  "accounting-preview-inventory-opening-data-v1",
  "accounting-preview-inventory-stocktake-line-data-v1",
];
const scopes: Array<{ id: InventoryScope; label: string }> = [
  { id: "all", label: "全部存货" },
  { id: "missingTax", label: "待补税率" },
  { id: "missingSubject", label: "待补科目" },
  { id: "enabled", label: "启用" },
];
function statusClass(status: string) {
  return status === "启用"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : status === "异常"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}
function inventoryStatus(record: InventoryItem) {
  return record.status || "启用";
}
function isInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<InventoryItem>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.itemCode === "string" &&
    typeof record.itemName === "string" &&
    typeof record.unit === "string" &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserItems(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isInventoryItem).map((record) => ({
          ...record,
          unitId: record.unitId || null,
          category: record.category || null,
          categoryId: record.categoryId || null,
          valuationMethod: record.valuationMethod || "移动加权",
          inventorySubject:
            record.inventorySubject || record.defaultSubject || "库存商品",
          costSubject: record.costSubject || "主营业务成本",
          safetyStock: Number(record.safetyStock || 0),
        }))
      : [];
  } catch {
    return [];
  }
}
function loadBrowserUnits(): MeasurementUnit[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserUnitStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is MeasurementUnit =>
            Boolean(
              value &&
                typeof value === "object" &&
                typeof (value as Partial<MeasurementUnit>).id === "string" &&
                typeof (value as Partial<MeasurementUnit>).companyId ===
                  "string" &&
                typeof (value as Partial<MeasurementUnit>).unitName === "string",
            ),
        )
      : [];
  } catch {
    return [];
  }
}
function isInventoryCategory(value: unknown): value is InventoryCategory {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<InventoryCategory>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.categoryCode === "string" &&
    typeof record.categoryName === "string" &&
    typeof record.status === "string"
  );
}
function loadBrowserCategories(): InventoryCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserCategoryStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isInventoryCategory) : [];
  } catch {
    return [];
  }
}
function saveBrowserCategories(records: InventoryCategory[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      browserCategoryStorageKey,
      JSON.stringify(records),
    );
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function saveBrowserItems(records: InventoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function isInventoryBom(value: unknown): value is InventoryBom {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<InventoryBom>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.bomCode === "string" &&
    typeof record.parentItemId === "string" &&
    Array.isArray(record.lines)
  );
}
function loadBrowserBoms(): InventoryBom[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserBomStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isInventoryBom) : [];
  } catch {
    return [];
  }
}
function saveBrowserBoms(records: InventoryBom[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserBomStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function browserItemHasBusiness(itemId: string) {
  if (typeof window === "undefined") return false;
  try {
    return browserInventoryBusinessKeys.some((key) => {
      const rows = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<{
        inventoryItemId?: string;
      }>;
      return rows.some((row) => row.inventoryItemId === itemId);
    });
  } catch {
    return false;
  }
}
function emptyDraft(): InventoryDraft {
  return {
    itemCode: "",
    itemName: "",
    specification: "",
    unitId: "",
    taxRate: "",
    categoryId: "",
    valuationMethod: "移动加权",
    inventorySubject: "库存商品",
    costSubject: "主营业务成本",
    safetyStock: "0",
  };
}
function draftFromRecord(
  record: InventoryItem,
  units: MeasurementUnit[],
): InventoryDraft {
  return {
    itemCode: record.itemCode,
    itemName: record.itemName,
    specification: record.specification || "",
    unitId:
      record.unitId ||
      units.find((unit) => unit.unitName === record.unit)?.id ||
      "",
    taxRate: record.taxRate === null ? "" : String(record.taxRate * 100),
    categoryId: record.categoryId || "",
    valuationMethod: record.valuationMethod || "移动加权",
    inventorySubject: record.inventorySubject || "库存商品",
    costSubject: record.costSubject || "主营业务成本",
    safetyStock: String(record.safetyStock || 0),
  };
}
function emptyCategoryDraft(): CategoryDraft {
  return {
    categoryCode: "",
    categoryName: "",
    inventorySubject: "库存商品",
    costSubject: "主营业务成本",
    status: "启用",
  };
}
function categoryDraftFromRecord(record: InventoryCategory): CategoryDraft {
  return {
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    inventorySubject: record.inventorySubject,
    costSubject: record.costSubject,
    status: record.status,
  };
}
function emptyBomDraft(items: InventoryItem[]): BomDraft {
  const enabled = items.filter((item) => inventoryStatus(item) === "启用");
  return {
    bomCode: "",
    bomName: "",
    version: "V1",
    parentItemId: enabled[0]?.id || "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    expirationDate: "",
    status: "启用",
    note: "",
    lines: [
      {
        componentItemId: enabled[1]?.id || "",
        quantity: "1",
        lossRate: "0",
        note: "",
      },
    ],
  };
}
function bomDraftFromRecord(record: InventoryBom): BomDraft {
  return {
    bomCode: record.bomCode,
    bomName: record.bomName,
    version: record.version,
    parentItemId: record.parentItemId,
    effectiveDate: record.effectiveDate,
    expirationDate: record.expirationDate || "",
    status: record.status,
    note: record.note || "",
    lines: record.lines.map((line) => ({
      componentItemId: line.componentItemId,
      quantity: String(line.quantity),
      lossRate: String(line.lossRate * 100),
      note: line.note || "",
    })),
  };
}

export function InventoryMasterWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const [records, setRecords] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [boms, setBoms] = useState<InventoryBom[]>([]);
  const [scope, setScope] = useState<InventoryScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<InventoryItem | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<InventoryDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<InventoryCategory | null>(null);
  const [categoryDraft, setCategoryDraft] =
    useState<CategoryDraft>(emptyCategoryDraft);
  const [savingCategory, setSavingCategory] = useState(false);
  const [showBomManager, setShowBomManager] = useState(false);
  const [editingBom, setEditingBom] = useState<InventoryBom | null>(null);
  const [bomDraft, setBomDraft] = useState<BomDraft>(() => emptyBomDraft([]));
  const [savingBom, setSavingBom] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const refresh = useCallback(async () => {
    if (!companyId) {
      setRecords([]);
      setCategories([]);
      setUnits([]);
      setBoms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      setRecords(
        loadBrowserItems().filter((record) => record.companyId === companyId),
      );
      setCategories(
        loadBrowserCategories().filter(
          (record) => record.companyId === companyId,
        ),
      );
      setUnits(
        loadBrowserUnits().filter((record) => record.companyId === companyId),
      );
      setBoms(
        loadBrowserBoms().filter((record) => record.companyId === companyId),
      );
      setLoading(false);
      return;
    }
    const [result, categoryResult, unitResult, bomResult] = await Promise.all([
      inventoryItemApi.getInventoryItems({ companyId }),
      inventoryMasterDataApi.getInventoryCategories({ companyId }),
      measurementUnitApi.getMeasurementUnits({ companyId }),
      inventoryMasterDataApi.getInventoryBoms({ companyId }),
    ]);
    setRecords(result.success ? result.data || [] : []);
    setCategories(categoryResult.success ? categoryResult.data || [] : []);
    setUnits(unitResult.success ? unitResult.data || [] : []);
    setBoms(bomResult.success ? bomResult.data || [] : []);
    setNotice(
      result.success && categoryResult.success && unitResult.success && bomResult.success
        ? null
        : `读取存货主数据失败：${result.error || categoryResult.error || unitResult.error || bomResult.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const matchesScope =
        scope === "all" ||
        (scope === "missingTax" && record.taxRate === null) ||
        (scope === "missingSubject" &&
          (!record.inventorySubject || !record.costSubject)) ||
        (scope === "enabled" && inventoryStatus(record) === "启用");
      return (
        matchesScope &&
        (!term ||
          [
            record.itemCode,
            record.itemName,
            record.specification,
            record.unit,
            record.inventorySubject,
            record.costSubject,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const inventoryPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "存货编码",
    "存货名称",
    "规格型号",
    "计量单位",
    "税率",
    "存货科目",
    "成本科目",
    "计价方法",
    "安全库存",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.itemCode,
        record.itemName,
        record.specification || "—",
        record.unit,
        record.taxRate === null
          ? "待补"
          : `${(record.taxRate * 100).toFixed(0)}%`,
        record.inventorySubject || "待补",
        record.costSubject || "待补",
        record.valuationMethod,
        record.safetyStock.toLocaleString("zh-CN"),
        inventoryStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      enabled: records.filter((record) => inventoryStatus(record) === "启用")
        .length,
      missingTax: records.filter((record) => record.taxRate === null).length,
      missingSubject: records.filter(
        (record) => !record.inventorySubject || !record.costSubject,
      ).length,
    }),
    [records],
  );
  const openCreate = () => {
    const firstCategory = categories.find((category) => category.status === "启用");
    const firstUnit = units.find((unit) => unit.status === "启用");
    if (!firstCategory) {
      setShowCategoryManager(true);
      setNotice("请先新增并启用存货分类，再建立存货档案。");
      return;
    }
    if (!firstUnit) {
      setNotice("请先新增并启用计量单位，再建立存货档案。");
      return;
    }
    setEditingRecord(null);
    setDraft({
      ...emptyDraft(),
      categoryId: firstCategory.id,
      unitId: firstUnit.id,
      inventorySubject: firstCategory.inventorySubject,
      costSubject: firstCategory.costSubject,
    });
    setShowEditor(true);
  };
  const openEdit = (record: InventoryItem) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record, units));
    setShowEditor(true);
  };
  const openCategoryCreate = () => {
    setEditingCategory(null);
    setCategoryDraft(emptyCategoryDraft());
  };
  const openCategoryEdit = (record: InventoryCategory) => {
    setEditingCategory(record);
    setCategoryDraft(categoryDraftFromRecord(record));
  };
  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套，再维护存货分类。");
      return;
    }
    if (
      !categoryDraft.categoryCode.trim() ||
      !categoryDraft.categoryName.trim() ||
      !categoryDraft.inventorySubject.trim() ||
      !categoryDraft.costSubject.trim()
    ) {
      setNotice("分类编码、名称、存货科目和成本科目不能为空。");
      return;
    }
    const input = {
      companyId,
      categoryCode: categoryDraft.categoryCode.trim(),
      categoryName: categoryDraft.categoryName.trim(),
      inventorySubject: categoryDraft.inventorySubject.trim(),
      costSubject: categoryDraft.costSubject.trim(),
      status: categoryDraft.status,
    };
    setSavingCategory(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const duplicate = loadBrowserCategories().some(
        (category) =>
          category.companyId === companyId &&
          category.id !== editingCategory?.id &&
          (category.categoryCode === input.categoryCode ||
            category.categoryName === input.categoryName),
      );
      if (duplicate) {
        setSavingCategory(false);
        setNotice("同一账套内分类编码和名称不能重复。");
        return;
      }
      const record: InventoryCategory = editingCategory
        ? { ...editingCategory, ...input, updatedAt: now }
        : {
            id: `preview-inventory-category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserCategories([
        record,
        ...loadBrowserCategories().filter((item) => item.id !== record.id),
      ]);
      setSavingCategory(false);
      setEditingCategory(null);
      setCategoryDraft(emptyCategoryDraft());
      setNotice("预览存货分类已保存。");
      await refresh();
      return;
    }
    const result = editingCategory
      ? await inventoryMasterDataApi.updateInventoryCategory({
          ...input,
          id: editingCategory.id,
        })
      : await inventoryMasterDataApi.createInventoryCategory(input);
    setSavingCategory(false);
    if (!result.success) {
      setNotice(`保存存货分类失败：${result.error || "未知错误"}`);
      return;
    }
    setEditingCategory(null);
    setCategoryDraft(emptyCategoryDraft());
    setNotice("存货分类已保存并记录操作日志。");
    await refresh();
  };
  const openBomCreate = () => {
    setEditingBom(null);
    setBomDraft(emptyBomDraft(records));
  };
  const openBomEdit = (record: InventoryBom) => {
    setEditingBom(record);
    setBomDraft(bomDraftFromRecord(record));
  };
  const saveBom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套，再维护物料清单。");
      return;
    }
    let input: ReturnType<typeof normalizeInventoryBomDraft>;
    try {
      input = normalizeInventoryBomDraft(bomDraft, records);
      validateInventoryBomGraph(boms, {
        id: editingBom?.id || "pending-bom",
        parentItemId: input.parentItemId,
        status: input.status,
        lines: input.lines,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return;
    }
    setSavingBom(true);
    if (!isTauri) {
      const duplicate = loadBrowserBoms().some(
        (record) =>
          record.companyId === companyId &&
          record.id !== editingBom?.id &&
          (record.bomCode === input.bomCode ||
            (record.parentItemId === input.parentItemId &&
              record.version === input.version)),
      );
      if (duplicate) {
        setSavingBom(false);
        setNotice("同一账套内 BOM 编码或成品版本不能重复。");
        return;
      }
      const parent = records.find((item) => item.id === input.parentItemId);
      if (!parent) {
        setSavingBom(false);
        setNotice("未找到物料清单成品档案。");
        return;
      }
      const now = new Date().toISOString();
      const id =
        editingBom?.id ||
        `preview-inventory-bom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const record: InventoryBom = {
        id,
        companyId,
        bomCode: input.bomCode,
        bomName: input.bomName,
        version: input.version,
        parentItemId: input.parentItemId,
        parentItemCode: parent.itemCode,
        parentItemName: parent.itemName,
        parentSpecification: parent.specification,
        parentUnit: parent.unit,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate || null,
        status: input.status,
        note: input.note || null,
        createdBy: editingBom?.createdBy || "preview-user",
        updatedBy: "preview-user",
        createdAt: editingBom?.createdAt || now,
        updatedAt: now,
        lines: input.lines.map((line) => {
          const component = records.find(
            (item) => item.id === line.componentItemId,
          )!;
          return {
            id: `${id}-line-${line.sortOrder}`,
            bomId: id,
            companyId,
            componentItemId: component.id,
            componentItemCode: component.itemCode,
            componentItemName: component.itemName,
            componentSpecification: component.specification,
            componentUnit: component.unit,
            quantity: line.quantity,
            lossRate: line.lossRate,
            sortOrder: line.sortOrder,
            note: line.note || null,
            createdAt: now,
            updatedAt: now,
          };
        }),
      };
      saveBrowserBoms([
        record,
        ...loadBrowserBoms().filter((item) => item.id !== record.id),
      ]);
      setSavingBom(false);
      setEditingBom(null);
      setBomDraft(emptyBomDraft(records));
      setNotice(editingBom ? "预览物料清单已更新。" : "预览物料清单已保存。");
      await refresh();
      return;
    }
    const result = editingBom
      ? await inventoryMasterDataApi.updateInventoryBom({
          ...input,
          id: editingBom.id,
          companyId,
          status: input.status,
        })
      : await inventoryMasterDataApi.createInventoryBom({
          ...input,
          companyId,
        });
    setSavingBom(false);
    if (!result.success) {
      setNotice(`保存物料清单失败：${result.error || "未知错误"}`);
      return;
    }
    setEditingBom(null);
    setBomDraft(emptyBomDraft(records));
    setNotice("物料清单已保存并记录操作日志。");
    await refresh();
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护存货档案。");
      return;
    }
    const taxPercent =
      draft.taxRate.trim() === "" ? null : Number(draft.taxRate);
    const safetyStock = Number(draft.safetyStock || 0);
    const selectedCategory = categories.find(
      (category) => category.id === draft.categoryId,
    );
    const selectedUnit = units.find((unit) => unit.id === draft.unitId);
    if (
      !draft.itemCode.trim() ||
      !draft.itemName.trim() ||
      !selectedUnit ||
      selectedUnit.status !== "启用" ||
      !selectedCategory ||
      selectedCategory.status !== "启用" ||
      !draft.inventorySubject.trim() ||
      !draft.costSubject.trim() ||
      !Number.isFinite(safetyStock) ||
      safetyStock < 0 ||
      (taxPercent !== null &&
        (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100))
    ) {
      setNotice("请填写存货编码、名称、计量单位并选择启用的存货分类；税率须在 0% 至 100%，安全库存不得为负数。");
      return;
    }
    const input = {
      companyId,
      itemCode: draft.itemCode.trim(),
      itemName: draft.itemName.trim(),
      specification: draft.specification.trim() || undefined,
      unitId: selectedUnit.id,
      taxRate: taxPercent === null ? undefined : taxPercent / 100,
      defaultSubject: draft.inventorySubject.trim(),
      categoryId: selectedCategory.id,
      valuationMethod: "移动加权",
      inventorySubject: draft.inventorySubject.trim(),
      costSubject: draft.costSubject.trim(),
      safetyStock,
    };
    setSaving(true);
    if (!isTauri) {
      if (
        editingRecord?.unitId &&
        editingRecord.unitId !== input.unitId &&
        browserItemHasBusiness(editingRecord.id)
      ) {
        setSaving(false);
        setNotice("已有库存业务的存货不能更换计量单位。");
        return;
      }
      const now = new Date().toISOString();
      const record: InventoryItem = editingRecord
        ? {
            ...editingRecord,
            ...input,
            unit: selectedUnit.unitName,
            specification: input.specification || null,
            taxRate: input.taxRate ?? null,
            defaultSubject: input.defaultSubject || null,
            category: selectedCategory.categoryName,
            categoryId: selectedCategory.id,
            valuationMethod: input.valuationMethod,
            inventorySubject: input.inventorySubject,
            costSubject: input.costSubject,
            safetyStock: input.safetyStock,
            updatedAt: now,
          }
        : {
            id: `preview-inventory-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            unit: selectedUnit.unitName,
            specification: input.specification || null,
            taxRate: input.taxRate ?? null,
            defaultSubject: input.defaultSubject || null,
            category: selectedCategory.categoryName,
            categoryId: selectedCategory.id,
            valuationMethod: input.valuationMethod,
            inventorySubject: input.inventorySubject,
            costSubject: input.costSubject,
            safetyStock: input.safetyStock,
            status: "启用",
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserItems([
        record,
        ...loadBrowserItems().filter((item) => item.id !== record.id),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord ? "预览存货档案已更新。" : "预览存货档案已保存。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await inventoryItemApi.updateInventoryItem({
          ...input,
          id: editingRecord.id,
        })
      : await inventoryItemApi.createInventoryItem(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}存货档案失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "存货档案已更新。"
        : "存货档案已保存，不自动生成或过账凭证。",
    );
    await refresh();
  };
  const rowActions = (record: InventoryItem) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/inventory/movements")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Boxes className="h-3.5 w-3.5" />
        出入库单
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
              <Boxes className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">存货档案与计价基础</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护存货编码、规格、税率和默认科目，为出入库及成本结转提供基础资料；不自动生成或过账凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="存货档案清单"
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
              onClick={() => {
                openBomCreate();
                setShowBomManager(true);
              }}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ListTree className="h-3.5 w-3.5" />
              物料清单
            </button>
            <button
              type="button"
              disabled={!companyId}
              onClick={() => setShowCategoryManager(true)}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              分类管理
            </button>
            <button
              type="button"
              disabled={!companyId}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增存货
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric icon={Boxes} label="存货档案" value={`${metrics.total} 项`} />
          <Metric
            icon={PackageCheck}
            label="启用"
            value={`${metrics.enabled} 项`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={Tags}
            label="待补税率"
            value={`${metrics.missingTax} 项`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={Calculator}
            label="待补默认科目"
            value={`${metrics.missingSubject} 项`}
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
              placeholder="搜索编码、名称、规格、单位或默认科目"
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
          <Placeholder message="请选择账套后查看或维护存货档案。" />
        )}
        {companyId && loading && <Placeholder message="正在读取存货档案..." />}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[14%] px-3 py-3 font-medium">存货编码</th>
                    <th className="w-[18%] px-3 py-3 font-medium">存货名称</th>
                    <th className="w-[16%] px-3 py-3 font-medium">分类 / 规格</th>
                    <th className="w-[10%] px-3 py-3 font-medium">计量单位</th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      税率
                    </th>
                    <th className="w-[14%] px-3 py-3 font-medium">核算科目</th>
                    <th className="w-[8%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inventoryPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.itemCode}
                      >
                        {record.itemCode}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.itemName}
                      >
                        {record.itemName}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={[record.category, record.specification].filter(Boolean).join(" / ")}
                      >
                        {record.category || record.specification || "—"}
                      </td>
                      <td className="px-3 py-3">{record.unit}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {record.taxRate === null
                          ? "待补"
                          : `${(record.taxRate * 100).toFixed(0)}%`}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={`存货：${record.inventorySubject}；成本：${record.costSubject}`}
                      >
                        {record.inventorySubject || "待补"} / {record.costSubject || "待补"}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={inventoryStatus(record)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {inventoryPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.itemCode}
                      </p>
                      <p className="mt-1 truncate text-sm">{record.itemName}</p>
                    </div>
                    <Status status={inventoryStatus(record)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="规格型号"
                      value={record.specification || "待补"}
                    />
                    <Info label="计量单位" value={record.unit} />
                    <Info label="存货分类" value={record.category || "未分类"} />
                    <Info label="计价方法" value={record.valuationMethod} />
                    <Info
                      label="税率"
                      value={
                        record.taxRate === null
                          ? "待补"
                          : `${(record.taxRate * 100).toFixed(0)}%`
                      }
                    />
                    <Info
                      label="存货科目"
                      value={record.inventorySubject || "待补"}
                    />
                    <Info label="成本科目" value={record.costSubject || "待补"} />
                    <Info label="安全库存" value={`${record.safetyStock.toLocaleString("zh-CN")} ${record.unit}`} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有存货档案。" />
            )}
            <OperationalPagination
              page={inventoryPage}
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
          icon={Tags}
          title="维护计量单位"
          description="新增存货前先维护统一的计量单位和换算关系。"
          onClick={() => navigate("/units")}
        />
        <WorkflowLink
          icon={Boxes}
          title="登记出入库单"
          description="库存变化应由出入库单承载，不能从档案页直接变更数量。"
          onClick={() => navigate("/inventory/movements")}
        />
        <WorkflowLink
          icon={FileText}
          title="复核成本结转"
          description="成本结转需基于已核验的出库来源和明确的默认科目。"
          onClick={() => navigate("/cost-carryover")}
        />
      </section>
      {showEditor && (
        <InventoryEditor
          draft={draft}
          categories={categories}
          units={units}
          editing={Boolean(editingRecord)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveRecord}
        />
      )}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          draft={categoryDraft}
          editing={editingCategory}
          saving={savingCategory}
          onDraftChange={setCategoryDraft}
          onCreate={openCategoryCreate}
          onEdit={openCategoryEdit}
          onClose={() => setShowCategoryManager(false)}
          onSubmit={saveCategory}
        />
      )}
      {showBomManager && (
        <BomManager
          boms={boms}
          items={records}
          draft={bomDraft}
          editing={editingBom}
          saving={savingBom}
          onDraftChange={setBomDraft}
          onCreate={openBomCreate}
          onEdit={openBomEdit}
          onClose={() => setShowBomManager(false)}
          onSubmit={saveBom}
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
function InventoryEditor({
  draft,
  categories,
  units,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: InventoryDraft;
  categories: InventoryCategory[];
  units: MeasurementUnit[];
  editing: boolean;
  saving: boolean;
  onChange: (draft: InventoryDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="存货档案编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑存货档案" : "新增存货档案"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              存货档案统一维护计量单位、移动加权计价和结转科目；数量变化必须由出入库单核验形成。
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
          <Field label="存货编码 *">
            <input
              required
              value={draft.itemCode}
              onChange={(event) =>
                onChange({ ...draft, itemCode: event.target.value })
              }
            />
          </Field>
          <Field label="存货名称 *">
            <input
              required
              value={draft.itemName}
              onChange={(event) =>
                onChange({ ...draft, itemName: event.target.value })
              }
            />
          </Field>
          <Field label="规格型号">
            <input
              value={draft.specification}
              onChange={(event) =>
                onChange({ ...draft, specification: event.target.value })
              }
            />
          </Field>
          <Field label="计量单位 *">
            <select
              required
              value={draft.unitId}
              onChange={(event) =>
                onChange({ ...draft, unitId: event.target.value })
              }
            >
              <option value="">请选择计量单位</option>
              {units
                .filter(
                  (unit) =>
                    unit.status === "启用" || unit.id === draft.unitId,
                )
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitName}
                    {unit.unitGroup ? ` · ${unit.unitGroup}` : ""}
                    {unit.status === "停用" ? "（停用）" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="存货分类 *">
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
                  inventorySubject:
                    category?.inventorySubject || draft.inventorySubject,
                  costSubject: category?.costSubject || draft.costSubject,
                });
              }}
            >
              <option value="">请选择分类</option>
              {categories
                .filter(
                  (category) =>
                    category.status === "启用" ||
                    category.id === draft.categoryId,
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.categoryCode} · {category.categoryName}
                    {category.status === "停用" ? "（停用）" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="计价方法 *">
            <select
              value={draft.valuationMethod}
              onChange={(event) =>
                onChange({ ...draft, valuationMethod: event.target.value })
              }
            >
              <option value="移动加权">移动加权</option>
            </select>
          </Field>
          <Field label="税率（%）">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.taxRate}
              onChange={(event) =>
                onChange({ ...draft, taxRate: event.target.value })
              }
            />
          </Field>
          <Field label="存货科目 *">
            <input
              required
              value={draft.inventorySubject}
              onChange={(event) =>
                onChange({ ...draft, inventorySubject: event.target.value })
              }
            />
          </Field>
          <Field label="成本科目 *">
            <input
              required
              value={draft.costSubject}
              onChange={(event) =>
                onChange({ ...draft, costSubject: event.target.value })
              }
            />
          </Field>
          <Field label="安全库存">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={draft.safetyStock}
              onChange={(event) =>
                onChange({ ...draft, safetyStock: event.target.value })
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
            {saving ? "保存中..." : "保存存货"}
          </button>
        </footer>
      </form>
    </div>
  );
}
function CategoryManager({
  categories,
  draft,
  editing,
  saving,
  onDraftChange,
  onCreate,
  onEdit,
  onClose,
  onSubmit,
}: {
  categories: InventoryCategory[];
  draft: CategoryDraft;
  editing: InventoryCategory | null;
  saving: boolean;
  onDraftChange: (draft: CategoryDraft) => void;
  onCreate: () => void;
  onEdit: (record: InventoryCategory) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              存货分类管理
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              分类统一维护默认存货科目和成本科目，新增存货时自动带入。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="关闭存货分类管理"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:overflow-hidden">
          <section className="min-h-0 border-b border-slate-200 lg:overflow-y-auto lg:border-b-0 lg:border-r dark:border-slate-800">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                分类清单（{categories.length}）
              </span>
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-7 items-center gap-1 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> 新增分类
              </button>
            </div>
            {categories.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                尚未建立存货分类，请先新增分类。
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onEdit(category)}
                    className={`grid w-full gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      editing?.id === category.id
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {category.categoryCode} · {category.categoryName}
                      </span>
                      <span
                        className={
                          category.status === "启用"
                            ? "text-xs text-emerald-600 dark:text-emerald-400"
                            : "text-xs text-slate-500 dark:text-slate-400"
                        }
                      >
                        {category.status}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      存货科目 {category.inventorySubject} · 成本科目 {category.costSubject}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <form className="space-y-4 p-5 lg:overflow-y-auto" onSubmit={onSubmit}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editing ? "编辑分类" : "新增分类"}
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={onCreate}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  切换为新增
                </button>
              )}
            </div>
            <Field label="分类编码 *">
              <input
                required
                value={draft.categoryCode}
                onChange={(event) =>
                  onDraftChange({ ...draft, categoryCode: event.target.value })
                }
                placeholder="例如：RM"
              />
            </Field>
            <Field label="分类名称 *">
              <input
                required
                value={draft.categoryName}
                onChange={(event) =>
                  onDraftChange({ ...draft, categoryName: event.target.value })
                }
                placeholder="例如：原材料"
              />
            </Field>
            <Field label="默认存货科目 *">
              <input
                required
                value={draft.inventorySubject}
                onChange={(event) =>
                  onDraftChange({ ...draft, inventorySubject: event.target.value })
                }
                placeholder="例如：1403 原材料"
              />
            </Field>
            <Field label="默认成本科目 *">
              <input
                required
                value={draft.costSubject}
                onChange={(event) =>
                  onDraftChange({ ...draft, costSubject: event.target.value })
                }
                placeholder="例如：6401 主营业务成本"
              />
            </Field>
            <Field label="状态">
              <select
                value={draft.status}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    status: event.target.value as CategoryDraft["status"],
                  })
                }
              >
                <option value="启用">启用</option>
                <option value="停用">停用</option>
              </select>
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : editing ? "保存修改" : "新增分类"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
function BomManager({
  boms,
  items,
  draft,
  editing,
  saving,
  onDraftChange,
  onCreate,
  onEdit,
  onClose,
  onSubmit,
}: {
  boms: InventoryBom[];
  items: InventoryItem[];
  draft: BomDraft;
  editing: InventoryBom | null;
  saving: boolean;
  onDraftChange: (draft: BomDraft) => void;
  onCreate: () => void;
  onEdit: (record: InventoryBom) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const enabledItems = items.filter((item) => inventoryStatus(item) === "启用");
  const updateLine = (
    index: number,
    patch: Partial<BomDraft["lines"][number]>,
  ) => {
    onDraftChange({
      ...draft,
      lines: draft.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    });
  };
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="物料清单编辑"
    >
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#0d0d0d]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              物料清单（BOM）
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按成品和版本维护领料组成、标准用量及损耗率；启用前校验重复组件和循环引用。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="关闭物料清单编辑"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[minmax(17rem,0.7fr)_minmax(0,1.8fr)] xl:overflow-hidden">
          <section className="min-h-0 border-b border-slate-200 xl:overflow-y-auto xl:border-b-0 xl:border-r dark:border-slate-800">
            <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#0d0d0d]">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                版本清单（{boms.length}）
              </span>
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-7 items-center gap-1 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> 新增 BOM
              </button>
            </div>
            {boms.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                尚未建立物料清单。先准备至少两个启用的存货档案，再新增 BOM。
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {boms.map((bom) => (
                  <button
                    key={bom.id}
                    type="button"
                    onClick={() => onEdit(bom)}
                    className={`grid w-full gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      editing?.id === bom.id
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {bom.bomCode} · {bom.version}
                      </span>
                      <span
                        className={
                          bom.status === "启用"
                            ? "shrink-0 text-xs text-emerald-600 dark:text-emerald-400"
                            : "shrink-0 text-xs text-slate-500 dark:text-slate-400"
                        }
                      >
                        {bom.status}
                      </span>
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                      {bom.parentItemCode} · {bom.parentItemName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {bom.lines.length} 个组件 · {bom.effectiveDate} 生效
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <form className="min-h-0 overflow-y-auto" onSubmit={onSubmit}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editing ? "编辑 BOM 版本" : "新增 BOM 版本"}
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={onCreate}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  切换为新增
                </button>
              )}
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="BOM 编码 *">
                <input
                  required
                  value={draft.bomCode}
                  onChange={(event) =>
                    onDraftChange({ ...draft, bomCode: event.target.value })
                  }
                  placeholder="例如：BOM-FG-001"
                />
              </Field>
              <Field label="BOM 名称 *">
                <input
                  required
                  value={draft.bomName}
                  onChange={(event) =>
                    onDraftChange({ ...draft, bomName: event.target.value })
                  }
                  placeholder="例如：标准生产配方"
                />
              </Field>
              <Field label="版本 *">
                <input
                  required
                  value={draft.version}
                  onChange={(event) =>
                    onDraftChange({ ...draft, version: event.target.value })
                  }
                  placeholder="V1"
                />
              </Field>
              <Field label="成品存货 *">
                <select
                  required
                  value={draft.parentItemId}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      parentItemId: event.target.value,
                      lines: draft.lines.map((line) =>
                        line.componentItemId === event.target.value
                          ? { ...line, componentItemId: "" }
                          : line,
                      ),
                    })
                  }
                >
                  <option value="">请选择成品</option>
                  {enabledItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.itemCode} · {item.itemName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="生效日期 *">
                <input
                  required
                  type="date"
                  value={draft.effectiveDate}
                  onChange={(event) =>
                    onDraftChange({ ...draft, effectiveDate: event.target.value })
                  }
                />
              </Field>
              <Field label="失效日期">
                <input
                  type="date"
                  min={draft.effectiveDate}
                  value={draft.expirationDate}
                  onChange={(event) =>
                    onDraftChange({ ...draft, expirationDate: event.target.value })
                  }
                />
              </Field>
              <Field label="状态">
                <select
                  value={draft.status}
                  onChange={(event) =>
                    onDraftChange({ ...draft, status: event.target.value })
                  }
                >
                  <option value="启用">启用</option>
                  <option value="停用">停用</option>
                </select>
              </Field>
              <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2 dark:text-slate-300">
                <span>备注</span>
                <input
                  value={draft.note}
                  onChange={(event) =>
                    onDraftChange({ ...draft, note: event.target.value })
                  }
                  className="h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
            </div>
            <div className="border-y border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 bg-slate-50 px-5 py-2 dark:bg-[#111827]">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    组件明细
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    数量为生产一个成品的标准用量，损耗率按百分比录入。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      lines: [
                        ...draft.lines,
                        {
                          componentItemId: "",
                          quantity: "1",
                          lossRate: "0",
                          note: "",
                        },
                      ],
                    })
                  }
                  className="inline-flex h-7 shrink-0 items-center gap-1 border border-blue-300 px-2.5 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加组件
                </button>
              </div>
              <div className="divide-y divide-slate-200 px-5 dark:divide-slate-800">
                {draft.lines.map((line, index) => (
                  <div
                    key={`${index}-${line.componentItemId}`}
                    className="grid gap-2 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_7rem_7rem_minmax(0,1fr)_2rem] xl:items-end"
                  >
                    <Field label={`组件 ${index + 1} *`}>
                      <select
                        required
                        value={line.componentItemId}
                        onChange={(event) =>
                          updateLine(index, {
                            componentItemId: event.target.value,
                          })
                        }
                      >
                        <option value="">请选择组件</option>
                        {enabledItems
                          .filter((item) => item.id !== draft.parentItemId)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.itemCode} · {item.itemName}（{item.unit}）
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="标准用量 *">
                      <input
                        required
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="损耗率（%）">
                      <input
                        type="number"
                        min="0"
                        max="99.9999"
                        step="0.0001"
                        value={line.lossRate}
                        onChange={(event) =>
                          updateLine(index, { lossRate: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="行备注">
                      <input
                        value={line.note}
                        onChange={(event) =>
                          updateLine(index, { note: event.target.value })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      disabled={draft.lines.length === 1}
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          lines: draft.lines.filter(
                            (_, lineIndex) => lineIndex !== index,
                          ),
                        })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                      aria-label={`删除组件 ${index + 1}`}
                      title="删除组件"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                启用 BOM 后，成品及所有组件必须保持启用；历史版本可停用保留审计轨迹。
              </p>
              <button
                type="submit"
                disabled={saving || enabledItems.length < 2}
                className="inline-flex h-9 items-center justify-center gap-1.5 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "保存中..." : editing ? "保存修改" : "保存 BOM"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
