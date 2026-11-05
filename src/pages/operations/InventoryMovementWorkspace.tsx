import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  FilePenLine,
  FileText,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Warehouse,
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
  inventoryMovementApi,
  type CostCarryoverRecord,
  type InventoryItem,
  type InventoryMovement,
  type InventoryStockBalance,
  type InventoryWarehouse,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import {
  calculateInventoryBalance,
  calculateInventoryConfirmation,
  inventoryMovementDirection,
} from "../../lib/inventoryValuation.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type MovementScope = "all" | "inbound" | "outbound" | "pending";
type MovementDraft = {
  movementDate: string;
  billNo: string;
  movementType: string;
  inventoryItemId: string;
  warehouseId: string;
  counterparty: string;
  quantity: string;
  amount: string;
  sourceDocument: string;
};
type WarehouseDraft = {
  warehouseCode: string;
  warehouseName: string;
  location: string;
  manager: string;
  status: "启用" | "停用";
};

const browserStorageKey = "accounting-preview-inventory-movement-data-v1";
const browserItemStorageKey = "accounting-preview-inventory-item-data-v1";
const browserCarryoverStorageKey = "accounting-preview-cost-carryover-data-v1";
const browserWarehouseStorageKey = "accounting-preview-inventory-warehouse-data-v1";
const scopes: Array<{ id: MovementScope; label: string }> = [
  { id: "all", label: "全部单据" },
  { id: "inbound", label: "入库单" },
  { id: "outbound", label: "出库单" },
  { id: "pending", label: "待核验" },
];
const movementTypes = [
  "采购入库",
  "销售出库",
  "其他入库",
  "其他出库",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function isInbound(type: string) {
  return type.includes("入库");
}
function movementStatus(record: InventoryMovement) {
  return record.status || "待确认";
}
function statusClass(status: string) {
  return status === "已生成凭证" || status === "已核验"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}
function isMovement(value: unknown): value is InventoryMovement {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<InventoryMovement>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    typeof record.movementDate === "string" &&
    typeof record.billNo === "string" &&
    typeof record.movementType === "string" &&
    typeof record.inventoryName === "string" &&
    typeof record.warehouse === "string" &&
    typeof record.unit === "string" &&
    Number.isFinite(record.quantity) &&
    Number.isFinite(record.amount) &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserMovements() {
  if (typeof window === "undefined") return [] as InventoryMovement[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isMovement).map((record) => ({
          ...record,
          inventoryItemId: record.inventoryItemId || null,
          warehouseId: record.warehouseId || null,
          direction:
            record.direction || inventoryMovementDirection(record.movementType),
          unitCost: Number(record.unitCost || 0),
          confirmedAt: record.confirmedAt || null,
        }))
      : [];
  } catch {
    return [];
  }
}
function saveBrowserMovements(records: InventoryMovement[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The current preview continues without durable storage. */
  }
}
function emptyDraft(movementDate: string): MovementDraft {
  return {
    movementDate,
    billNo: "",
    movementType: "采购入库",
    inventoryItemId: "",
    warehouseId: "",
    counterparty: "",
    quantity: "",
    amount: "",
    sourceDocument: "",
  };
}
function draftFromRecord(record: InventoryMovement): MovementDraft {
  return {
    movementDate: record.movementDate,
    billNo: record.billNo,
    movementType: record.movementType,
    inventoryItemId: record.inventoryItemId || "",
    warehouseId: record.warehouseId || "",
    counterparty: record.counterparty || "",
    quantity: String(record.quantity),
    amount: String(record.amount),
    sourceDocument: record.sourceDocument || "",
  };
}

function loadBrowserItems(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserItemStorageKey) || "[]",
    ) as InventoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isWarehouse(value: unknown): value is InventoryWarehouse {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<InventoryWarehouse>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.warehouseCode === "string" &&
    typeof record.warehouseName === "string" &&
    (record.status === "启用" || record.status === "停用") &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserWarehouses(): InventoryWarehouse[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserWarehouseStorageKey) || "[]",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isWarehouse) : [];
  } catch {
    return [];
  }
}
function saveBrowserWarehouses(records: InventoryWarehouse[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      browserWarehouseStorageKey,
      JSON.stringify(records),
    );
  } catch {
    /* The preview continues even if storage is unavailable. */
  }
}
function emptyWarehouseDraft(): WarehouseDraft {
  return {
    warehouseCode: "",
    warehouseName: "",
    location: "",
    manager: "",
    status: "启用",
  };
}
function warehouseDraftFromRecord(record: InventoryWarehouse): WarehouseDraft {
  return {
    warehouseCode: record.warehouseCode,
    warehouseName: record.warehouseName,
    location: record.location || "",
    manager: record.manager || "",
    status: record.status === "停用" ? "停用" : "启用",
  };
}

export function InventoryMovementWorkspace() {
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
  const [records, setRecords] = useState<InventoryMovement[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [stockBalances, setStockBalances] = useState<InventoryStockBalance[]>([]);
  const [scope, setScope] = useState<MovementScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<InventoryMovement | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<MovementDraft>(() =>
    emptyDraft(defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const [showWarehouseManager, setShowWarehouseManager] = useState(false);
  const [editingWarehouse, setEditingWarehouse] =
    useState<InventoryWarehouse | null>(null);
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseDraft>(
    emptyWarehouseDraft(),
  );
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);
  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setInventoryItems([]);
      setWarehouses([]);
      setStockBalances([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      const allMovements = loadBrowserMovements().filter(
        (record) => record.companyId === companyId,
      );
      const items = loadBrowserItems().filter(
        (record) => record.companyId === companyId,
      );
      const warehouseRecords = loadBrowserWarehouses().filter(
        (record) => record.companyId === companyId,
      );
      setRecords(allMovements.filter((record) => record.period === period));
      setInventoryItems(items);
      setWarehouses(warehouseRecords);
      const grouped = new Map<string, InventoryMovement[]>();
      allMovements
        .filter(
          (record) =>
            record.period <= period &&
            record.inventoryItemId &&
            (record.status === "已核验" || record.status === "已生成凭证"),
        )
        .forEach((record) => {
          const key = `${record.inventoryItemId}::${record.warehouse}`;
          grouped.set(key, [...(grouped.get(key) || []), record]);
        });
      setStockBalances(
        [...grouped.entries()].flatMap(([key, movements]) => {
          const [inventoryItemId, warehouse] = key.split("::");
          const item = items.find((candidate) => candidate.id === inventoryItemId);
          if (!item) return [];
          const balance = calculateInventoryBalance(movements);
          return [{
            inventoryItemId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            warehouse,
            unit: item.unit,
            quantity: balance.quantity,
            amount: balance.amount,
            averageUnitCost:
              Math.abs(balance.quantity) < 0.000001
                ? 0
                : balance.amount / balance.quantity,
            safetyStock: item.safetyStock,
          }];
        }),
      );
      setLoading(false);
      return;
    }
    const [result, itemResult, warehouseResult, balanceResult] = await Promise.all([
      inventoryMovementApi.getInventoryMovements({ companyId, period }),
      inventoryItemApi.getInventoryItems({ companyId }),
      inventoryMasterDataApi.getInventoryWarehouses({ companyId }),
      inventoryMovementApi.getInventoryStockBalances({
        companyId,
        throughPeriod: period,
      }),
    ]);
    setRecords(result.success ? result.data || [] : []);
    setInventoryItems(itemResult.success ? itemResult.data || [] : []);
    setWarehouses(warehouseResult.success ? warehouseResult.data || [] : []);
    setStockBalances(balanceResult.success ? balanceResult.data || [] : []);
    setNotice(
      result.success && itemResult.success && warehouseResult.success && balanceResult.success
        ? null
        : `读取存货核算数据失败：${result.error || itemResult.error || warehouseResult.error || balanceResult.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = movementStatus(record);
      const scopeMatch =
        scope === "all" ||
        (scope === "inbound" && isInbound(record.movementType)) ||
        (scope === "outbound" && !isInbound(record.movementType)) ||
        (scope === "pending" && status === "待确认");
      return (
        scopeMatch &&
        (!term ||
          [
            record.billNo,
            record.inventoryName,
            record.warehouse,
            record.counterparty,
            record.sourceDocument,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const movementPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "日期",
    "单据编号",
    "类型",
    "存货",
    "仓库",
    "往来方",
    "数量",
    "单位",
    "金额",
    "来源单据",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.movementDate,
        record.billNo,
        record.movementType,
        record.inventoryName,
        record.warehouse,
        record.counterparty || "—",
        record.quantity.toLocaleString("zh-CN"),
        record.unit,
        formatCurrency(record.amount),
        record.sourceDocument || "—",
        movementStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      inboundAmount: records
        .filter((record) => isInbound(record.movementType))
        .reduce((sum, record) => sum + record.amount, 0),
      outboundAmount: records
        .filter((record) => !isInbound(record.movementType))
        .reduce((sum, record) => sum + record.amount, 0),
      quantity: stockBalances.reduce((sum, record) => sum + record.quantity, 0),
      pending: records.filter(
        (record) => movementStatus(record) === "待确认",
      ).length,
      belowSafety: stockBalances.filter(
        (record) => record.quantity < record.safetyStock,
      ).length,
    }),
    [records, stockBalances],
  );
  const openCreate = (movementType = "采购入库") => {
    const firstWarehouse = warehouses.find((item) => item.status === "启用");
    if (!firstWarehouse) {
      setShowWarehouseManager(true);
      setNotice("请先新增并启用仓库，再登记出入库单。");
      return;
    }
    setEditingRecord(null);
    setDraft({
      ...emptyDraft(defaultDate),
      movementType,
      warehouseId: firstWarehouse.id,
    });
    setShowEditor(true);
  };
  const openEdit = (record: InventoryMovement) => {
    if (movementStatus(record) === "已生成凭证") {
      setNotice("该出入库单已生成凭证，不能修改来源字段。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };
  const openWarehouseCreate = () => {
    setEditingWarehouse(null);
    setWarehouseDraft(emptyWarehouseDraft());
  };
  const openWarehouseEdit = (record: InventoryWarehouse) => {
    setEditingWarehouse(record);
    setWarehouseDraft(warehouseDraftFromRecord(record));
  };
  const saveWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套，再维护仓库档案。");
      return;
    }
    if (!warehouseDraft.warehouseCode.trim() || !warehouseDraft.warehouseName.trim()) {
      setNotice("仓库编码和仓库名称不能为空。");
      return;
    }
    const input = {
      companyId,
      warehouseCode: warehouseDraft.warehouseCode.trim(),
      warehouseName: warehouseDraft.warehouseName.trim(),
      location: warehouseDraft.location.trim() || undefined,
      manager: warehouseDraft.manager.trim() || undefined,
      status: warehouseDraft.status,
    };
    setSavingWarehouse(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const duplicate = loadBrowserWarehouses().some(
        (warehouse) =>
          warehouse.companyId === companyId &&
          warehouse.id !== editingWarehouse?.id &&
          (warehouse.warehouseCode === input.warehouseCode ||
            warehouse.warehouseName === input.warehouseName),
      );
      if (duplicate) {
        setSavingWarehouse(false);
        setNotice("同一账套内仓库编码和名称不能重复。");
        return;
      }
      const record: InventoryWarehouse = editingWarehouse
        ? {
            ...editingWarehouse,
            ...input,
            location: input.location || null,
            manager: input.manager || null,
            updatedAt: now,
          }
        : {
            id: `preview-inventory-warehouse-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            location: input.location || null,
            manager: input.manager || null,
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserWarehouses([
        record,
        ...loadBrowserWarehouses().filter((item) => item.id !== record.id),
      ]);
      setSavingWarehouse(false);
      setEditingWarehouse(null);
      setWarehouseDraft(emptyWarehouseDraft());
      setNotice("预览仓库档案已保存。");
      await refresh();
      return;
    }
    const result = editingWarehouse
      ? await inventoryMasterDataApi.updateInventoryWarehouse({
          ...input,
          id: editingWarehouse.id,
        })
      : await inventoryMasterDataApi.createInventoryWarehouse(input);
    setSavingWarehouse(false);
    if (!result.success) {
      setNotice(`保存仓库失败：${result.error || "未知错误"}`);
      return;
    }
    setEditingWarehouse(null);
    setWarehouseDraft(emptyWarehouseDraft());
    setNotice("仓库档案已保存并记录操作日志。");
    await refresh();
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再登记出入库单。");
      return;
    }
    const quantity = Number(draft.quantity);
    const amount = Number(draft.amount);
    const selectedItem = inventoryItems.find(
      (item) => item.id === draft.inventoryItemId,
    );
    const selectedWarehouse = warehouses.find(
      (warehouse) => warehouse.id === draft.warehouseId,
    );
    if (
      !draft.movementDate ||
      !draft.billNo.trim() ||
      !draft.movementType ||
      !draft.inventoryItemId ||
      !selectedItem ||
      !selectedWarehouse ||
      selectedWarehouse.status !== "启用" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (isInbound(draft.movementType) && amount <= 0)
    ) {
      setNotice(
        "请填写日期、单据编号、类型、存货档案、仓库和正数数量；入库金额必须大于零。",
      );
      return;
    }
    const input = {
      companyId,
      period,
      movementDate: draft.movementDate,
      billNo: draft.billNo.trim(),
      movementType: draft.movementType,
      inventoryItemId: draft.inventoryItemId,
      warehouseId: selectedWarehouse.id,
      counterparty: draft.counterparty.trim() || undefined,
      quantity,
      amount: isInbound(draft.movementType) ? amount : 0,
      sourceDocument: draft.sourceDocument.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const record: InventoryMovement = editingRecord
        ? {
            ...editingRecord,
            ...input,
            inventoryName: selectedItem.itemName,
            warehouse: selectedWarehouse.warehouseName,
            warehouseId: selectedWarehouse.id,
            unit: selectedItem.unit,
            direction: inventoryMovementDirection(input.movementType),
            unitCost: 0,
            confirmedAt: null,
            counterparty: input.counterparty || null,
            sourceDocument: input.sourceDocument || null,
            updatedAt: now,
          }
        : {
            id: `preview-inventory-movement-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            inventoryName: selectedItem.itemName,
            warehouse: selectedWarehouse.warehouseName,
            warehouseId: selectedWarehouse.id,
            unit: selectedItem.unit,
            direction: inventoryMovementDirection(input.movementType),
            unitCost: 0,
            confirmedAt: null,
            counterparty: input.counterparty || null,
            sourceDocument: input.sourceDocument || null,
            status: "待确认",
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserMovements([
        record,
        ...loadBrowserMovements().filter((item) => item.id !== record.id),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord
          ? "预览出入库单已更新。"
          : "预览出入库单已保存，等待人工核验。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await inventoryMovementApi.updateInventoryMovement({
          ...input,
          id: editingRecord.id,
        })
      : await inventoryMovementApi.createInventoryMovement(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}出入库单失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "出入库单已更新。"
        : "出入库单已保存，系统不自动生成或过账凭证。",
    );
    await refresh();
  };

  const confirmRecord = async (record: InventoryMovement) => {
    if (!companyId || movementStatus(record) !== "待确认") return;
    setSaving(true);
    if (!isTauri) {
      try {
        if (!record.inventoryItemId || !record.direction) {
          throw new Error("旧出入库单未关联存货档案，请先编辑补齐后再核验");
        }
        const all = loadBrowserMovements();
        const sameStock = all.filter(
          (item) =>
            item.companyId === record.companyId &&
            item.inventoryItemId === record.inventoryItemId &&
            (record.warehouseId
              ? item.warehouseId === record.warehouseId
              : item.warehouse === record.warehouse) &&
            (item.status === "已核验" || item.status === "已生成凭证"),
        );
        const later = sameStock.some(
          (item) =>
            item.movementDate > record.movementDate ||
            (item.movementDate === record.movementDate &&
              (item.createdAt > record.createdAt ||
                (item.createdAt === record.createdAt && item.id > record.id))),
        );
        if (later) {
          throw new Error("存在日期更晚的已核验记录，请按业务日期顺序核验");
        }
        const prior = sameStock.filter(
          (item) =>
            item.movementDate < record.movementDate ||
            (item.movementDate === record.movementDate &&
              (item.createdAt < record.createdAt ||
                (item.createdAt === record.createdAt && item.id < record.id))),
        );
        const balance = calculateInventoryBalance(prior);
        const valuation = calculateInventoryConfirmation({
          direction: record.direction,
          quantity: record.quantity,
          enteredAmount: record.amount,
          balanceQuantity: balance.quantity,
          balanceAmount: balance.amount,
        });
        const now = new Date().toISOString();
        saveBrowserMovements(
          all.map((item) =>
            item.id === record.id
              ? {
                  ...item,
                  amount: valuation.amount,
                  unitCost: valuation.unitCost,
                  status: "已核验",
                  confirmedAt: now,
                  updatedAt: now,
                }
              : item,
          ),
        );
        setNotice(
          `单据 ${record.billNo} 已核验，计价金额 ${formatCurrency(valuation.amount)}。`,
        );
      } catch (error) {
        setNotice(`核验失败：${String(error)}`);
      }
      setSaving(false);
      await refresh();
      return;
    }
    const result = await inventoryMovementApi.confirmInventoryMovement({
      id: record.id,
      companyId,
    });
    setSaving(false);
    setNotice(
      result.success
        ? `单据 ${record.billNo} 已核验，移动加权成本已锁定。`
        : `核验失败：${result.error || "未知错误"}`,
    );
    if (result.success) await refresh();
  };

  const createCarryover = async (record: InventoryMovement) => {
    if (!companyId) return;
    setSaving(true);
    if (!isTauri) {
      try {
        if (record.direction !== "outbound" || record.status !== "已核验") {
          throw new Error("只有已核验出库单可以生成成本结转");
        }
        const item = inventoryItems.find(
          (candidate) => candidate.id === record.inventoryItemId,
        );
        if (!item) throw new Error("未找到关联的存货档案");
        const existing = JSON.parse(
          window.localStorage.getItem(browserCarryoverStorageKey) || "[]",
        ) as CostCarryoverRecord[];
        if (
          !existing.some(
            (candidate) =>
              candidate.period === record.period &&
              candidate.sourceBillNo === record.billNo,
          )
        ) {
          const now = new Date().toISOString();
          existing.unshift({
            id: `preview-cost-carryover-${Date.now()}`,
            companyId,
            period: record.period,
            batchNo: `CB-${record.period.replace("-", "")}-${record.billNo}`,
            carryoverDate: record.movementDate,
            valuationMethod: item.valuationMethod,
            sourceBillNo: record.billNo,
            inventoryName: record.inventoryName,
            debitSubject: item.costSubject,
            creditSubject: item.inventorySubject,
            costAmount: record.amount,
            differenceAmount: 0,
            voucherId: null,
            voucherNo: null,
            status: "待确认",
            sourceDocument: record.sourceDocument,
            createdAt: now,
            updatedAt: now,
          });
          window.localStorage.setItem(
            browserCarryoverStorageKey,
            JSON.stringify(existing),
          );
        }
        setNotice(`已从出库单 ${record.billNo} 生成成本结转。`);
        navigate("/cost-carryover");
      } catch (error) {
        setNotice(`生成成本结转失败：${String(error)}`);
      }
      setSaving(false);
      return;
    }
    const result =
      await inventoryMovementApi.createCostCarryoverFromInventoryMovement({
        id: record.id,
        companyId,
      });
    setSaving(false);
    if (!result.success) {
      setNotice(`生成成本结转失败：${result.error || "未知错误"}`);
      return;
    }
    navigate("/cost-carryover");
  };

  const rowActions = (record: InventoryMovement) => (
    <div className="flex flex-wrap justify-end gap-2">
      {movementStatus(record) === "待确认" && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void confirmRecord(record)}
          className="inline-flex h-7 items-center gap-1 border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          核验
        </button>
      )}
      <button
        type="button"
        disabled={record.direction !== "outbound" || movementStatus(record) !== "已核验"}
        onClick={() => void createCarryover(record)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        生成结转
      </button>
      <button
        type="button"
        disabled={movementStatus(record) !== "待确认"}
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
              <Boxes className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">出入库单与履约核验</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              登记采购入库、销售出库和其他库存变动；仅保存本地来源单据，不自动生成或过账凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="存货出入库清单"
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
              disabled={!companyId}
              onClick={() => setShowWarehouseManager(true)}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              仓库管理
            </button>
            <button
              type="button"
              disabled={!companyId || !period}
              onClick={() => openCreate()}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              登记出入库单
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ArrowDownToLine}
            label="入库金额"
            value={formatCurrency(metrics.inboundAmount)}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={ArrowUpFromLine}
            label="出库金额"
            value={formatCurrency(metrics.outboundAmount)}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={PackageCheck}
            label="变动数量"
            value={metrics.quantity.toLocaleString("zh-CN")}
          />
          <Metric
            icon={Warehouse}
            label="待核验单据"
            value={`${metrics.pending} 张`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={PackageCheck}
            label="低于安全库存"
            value={`${metrics.belowSafety} 项`}
            tone={metrics.belowSafety ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
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
              placeholder="搜索单据、存货、仓库、往来方或来源资料"
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
          <Placeholder message="请选择账套后查看或维护出入库单。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期出入库单。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取出入库单..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">日期</th>
                    <th className="w-[12%] px-3 py-3 font-medium">单据编号</th>
                    <th className="w-[10%] px-3 py-3 font-medium">类型</th>
                    <th className="w-[14%] px-3 py-3 font-medium">存货</th>
                    <th className="w-[12%] px-3 py-3 font-medium">仓库</th>
                    <th className="w-[9%] px-3 py-3 text-right font-medium">
                      数量
                    </th>
                    <th className="w-[11%] px-3 py-3 text-right font-medium">
                      金额
                    </th>
                    <th className="w-[10%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movementPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        {record.movementDate}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.billNo}
                      >
                        {record.billNo}
                      </td>
                      <td className="px-3 py-3">{record.movementType}</td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.inventoryName}
                      >
                        {record.inventoryName}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.warehouse}
                      >
                        {record.warehouse}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {record.quantity.toLocaleString("zh-CN")} {record.unit}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={movementStatus(record)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {movementPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.billNo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.movementDate} · {record.movementType}
                      </p>
                    </div>
                    <Status status={movementStatus(record)} />
                  </div>
                  <p className="mt-2 truncate text-sm">
                    {record.inventoryName} · {record.warehouse}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="数量"
                      value={`${record.quantity.toLocaleString("zh-CN")} ${record.unit}`}
                    />
                    <Info label="金额" value={formatCurrency(record.amount)} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有出入库单。" />
            )}
            <OperationalPagination
              page={movementPage}
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
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">库存余额</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              汇总截至当前账期已核验出入库；金额和平均单位成本用于出库移动加权计价。
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {stockBalances.length} 个存货仓库组合
          </span>
        </header>
        {stockBalances.length === 0 ? (
          <Placeholder message="尚无已核验库存余额。" />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[12%] px-3 py-3 font-medium">存货编码</th>
                    <th className="w-[20%] px-3 py-3 font-medium">存货名称</th>
                    <th className="w-[16%] px-3 py-3 font-medium">仓库</th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">结存数量</th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">平均单位成本</th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">结存金额</th>
                    <th className="w-[10%] px-3 py-3 font-medium">库存状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stockBalances.map((balance) => {
                    const lowStock = balance.quantity < balance.safetyStock;
                    return (
                      <tr key={`${balance.inventoryItemId}-${balance.warehouse}`}>
                        <td className="truncate px-3 py-3 font-mono" title={balance.itemCode}>{balance.itemCode}</td>
                        <td className="truncate px-3 py-3" title={balance.itemName}>{balance.itemName}</td>
                        <td className="truncate px-3 py-3" title={balance.warehouse}>{balance.warehouse}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{balance.quantity.toLocaleString("zh-CN")} {balance.unit}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(balance.averageUnitCost)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(balance.amount)}</td>
                        <td className={`px-3 py-3 ${lowStock ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {lowStock ? "低于安全库存" : "正常"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {stockBalances.map((balance) => (
                <article key={`${balance.inventoryItemId}-${balance.warehouse}`} className="border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{balance.itemName}</p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{balance.itemCode} · {balance.warehouse}</p>
                    </div>
                    <span className={balance.quantity < balance.safetyStock ? "text-xs text-rose-600 dark:text-rose-400" : "text-xs text-emerald-600 dark:text-emerald-400"}>
                      {balance.quantity < balance.safetyStock ? "低库存" : "正常"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="结存数量" value={`${balance.quantity.toLocaleString("zh-CN")} ${balance.unit}`} />
                    <Info label="结存金额" value={formatCurrency(balance.amount)} />
                    <Info label="平均单位成本" value={formatCurrency(balance.averageUnitCost)} />
                    <Info label="安全库存" value={`${balance.safetyStock.toLocaleString("zh-CN")} ${balance.unit}`} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <WorkflowLink
          icon={ArrowDownToLine}
          title="登记采购入库"
          description="采购订单、验收资料和进项发票需分别人工核验后关联。"
          onClick={() => openCreate("采购入库")}
        />
        <WorkflowLink
          icon={ArrowUpFromLine}
          title="登记销售出库"
          description="销售订单、发货资料和销项发票需分别人工核验后关联。"
          onClick={() => openCreate("销售出库")}
        />
        <WorkflowLink
          icon={FileText}
          title="成本结转复核"
          description="成本结转仅基于已核验的出库来源，需在结转模块中人工确认。"
          onClick={() => navigate("/cost-carryover")}
        />
      </section>
      {showEditor && (
        <MovementEditor
          draft={draft}
          inventoryItems={inventoryItems}
          warehouses={warehouses}
          editing={Boolean(editingRecord)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveRecord}
        />
      )}
      {showWarehouseManager && (
        <WarehouseManager
          warehouses={warehouses}
          draft={warehouseDraft}
          editing={editingWarehouse}
          saving={savingWarehouse}
          onDraftChange={setWarehouseDraft}
          onCreate={openWarehouseCreate}
          onEdit={openWarehouseEdit}
          onClose={() => setShowWarehouseManager(false)}
          onSubmit={saveWarehouse}
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
function MovementEditor({
  draft,
  inventoryItems,
  warehouses,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: MovementDraft;
  inventoryItems: InventoryItem[];
  warehouses: InventoryWarehouse[];
  editing: boolean;
  saving: boolean;
  onChange: (draft: MovementDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="出入库单编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑出入库单" : "登记出入库单"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              保存后需核验数量和来源。入库按实际金额入账；出库在核验时按移动加权自动计价。
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
              value={draft.movementDate}
              onChange={(event) =>
                onChange({ ...draft, movementDate: event.target.value })
              }
            />
          </Field>
          <Field label="单据编号 *">
            <input
              required
              value={draft.billNo}
              onChange={(event) =>
                onChange({ ...draft, billNo: event.target.value })
              }
            />
          </Field>
          <Field label="出入库类型 *">
            <select
              value={draft.movementType}
              onChange={(event) =>
                onChange({ ...draft, movementType: event.target.value })
              }
            >
              {movementTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="存货档案 *">
            <select
              required
              value={draft.inventoryItemId}
              onChange={(event) =>
                onChange({ ...draft, inventoryItemId: event.target.value })
              }
            >
              <option value="">请选择存货</option>
              {inventoryItems
                .filter((item) => item.status === "启用")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} · {item.itemName} ({item.unit})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="仓库 *">
            <select
              required
              value={draft.warehouseId}
              onChange={(event) =>
                onChange({ ...draft, warehouseId: event.target.value })
              }
            >
              <option value="">请选择仓库</option>
              {warehouses
                .filter(
                  (warehouse) =>
                    warehouse.status === "启用" ||
                    warehouse.id === draft.warehouseId,
                )
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouseCode} · {warehouse.warehouseName}
                    {warehouse.status === "停用" ? "（停用）" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="往来方">
            <input
              value={draft.counterparty}
              onChange={(event) =>
                onChange({ ...draft, counterparty: event.target.value })
              }
            />
          </Field>
          <Field label="数量 *">
            <input
              required
              type="number"
              min="0.0001"
              step="0.0001"
              value={draft.quantity}
              onChange={(event) =>
                onChange({ ...draft, quantity: event.target.value })
              }
            />
          </Field>
          <Field label={isInbound(draft.movementType) ? "入库金额 *" : "出库金额（核验时计算）"}>
            <input
              required={isInbound(draft.movementType)}
              disabled={!isInbound(draft.movementType)}
              type="number"
              min="0"
              step="0.01"
              value={isInbound(draft.movementType) ? draft.amount : "0"}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
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
            {saving ? "保存中..." : "保存出入库单"}
          </button>
        </footer>
      </form>
    </div>
  );
}
function WarehouseManager({
  warehouses,
  draft,
  editing,
  saving,
  onDraftChange,
  onCreate,
  onEdit,
  onClose,
  onSubmit,
}: {
  warehouses: InventoryWarehouse[];
  draft: WarehouseDraft;
  editing: InventoryWarehouse | null;
  saving: boolean;
  onDraftChange: (draft: WarehouseDraft) => void;
  onCreate: () => void;
  onEdit: (record: InventoryWarehouse) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              仓库档案管理
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              出入库必须选择启用仓库，历史单据保留保存时的仓库名称快照。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="关闭仓库管理"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:overflow-hidden">
          <section className="min-h-0 border-b border-slate-200 lg:overflow-y-auto lg:border-b-0 lg:border-r dark:border-slate-800">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                仓库清单（{warehouses.length}）
              </span>
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-7 items-center gap-1 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> 新增仓库
              </button>
            </div>
            {warehouses.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                尚未建立仓库档案，请先新增仓库。
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {warehouses.map((warehouse) => (
                  <button
                    key={warehouse.id}
                    type="button"
                    onClick={() => onEdit(warehouse)}
                    className={`grid w-full gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      editing?.id === warehouse.id
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {warehouse.warehouseCode} · {warehouse.warehouseName}
                      </span>
                      <span
                        className={
                          warehouse.status === "启用"
                            ? "text-xs text-emerald-600 dark:text-emerald-400"
                            : "text-xs text-slate-500 dark:text-slate-400"
                        }
                      >
                        {warehouse.status}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {warehouse.location || "未维护位置"} · {warehouse.manager || "未维护负责人"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <form className="space-y-4 p-5 lg:overflow-y-auto" onSubmit={onSubmit}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editing ? "编辑仓库" : "新增仓库"}
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
            <Field label="仓库编码 *">
              <input
                required
                value={draft.warehouseCode}
                onChange={(event) =>
                  onDraftChange({ ...draft, warehouseCode: event.target.value })
                }
                placeholder="例如：WH01"
              />
            </Field>
            <Field label="仓库名称 *">
              <input
                required
                value={draft.warehouseName}
                onChange={(event) =>
                  onDraftChange({ ...draft, warehouseName: event.target.value })
                }
                placeholder="例如：主仓库"
              />
            </Field>
            <Field label="仓库位置">
              <input
                value={draft.location}
                onChange={(event) =>
                  onDraftChange({ ...draft, location: event.target.value })
                }
                placeholder="库区、楼层或地址"
              />
            </Field>
            <Field label="负责人">
              <input
                value={draft.manager}
                onChange={(event) =>
                  onDraftChange({ ...draft, manager: event.target.value })
                }
                placeholder="仓库负责人"
              />
            </Field>
            <Field label="状态">
              <select
                value={draft.status}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    status: event.target.value as WarehouseDraft["status"],
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
              {saving ? "保存中..." : editing ? "保存修改" : "新增仓库"}
            </button>
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
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none [&_select:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
