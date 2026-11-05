import {
  Ban,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  Link2,
  Plus,
  RefreshCw,
  Save,
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
import { Link } from "react-router-dom";
import {
  inventoryItemApi,
  inventoryMasterDataApi,
  inventoryStocktakeApi,
  type InventoryItem,
  type InventoryMovement,
  type InventoryStocktake,
  type InventoryStocktakeLine,
  type InventoryWarehouse,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { createBrowserPreviewVoucher } from "../../lib/browserPreviewVouchers.js";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type CreateDraft = { stocktakeDate: string; warehouseId: string; note: string };
type CountDraft = { actualQuantity: string; actualUnitCost: string; reason: string };

const stocktakeStorageKey = "accounting-preview-inventory-stocktake-data-v1";
const lineStorageKey = "accounting-preview-inventory-stocktake-line-data-v1";
const movementStorageKey = "accounting-preview-inventory-movement-data-v1";
const itemStorageKey = "accounting-preview-inventory-item-data-v1";
const warehouseStorageKey = "accounting-preview-inventory-warehouse-data-v1";
const voucherStorageKey = "accounting-preview-vouchers-v1";
const epsilon = 0.000001;

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function localArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
function saveLocal<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}
function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
function bookBalance(
  movements: InventoryMovement[],
  companyId: string,
  itemId: string,
  warehouseId: string,
  throughDate: string,
) {
  return movements
    .filter(
      (movement) =>
        movement.companyId === companyId &&
        movement.inventoryItemId === itemId &&
        movement.warehouseId === warehouseId &&
        movement.movementDate <= throughDate &&
        ["已核验", "已生成凭证"].includes(movement.status),
    )
    .reduce(
      (result, movement) => {
        const sign = movement.direction === "inbound" ? 1 : -1;
        result.quantity += sign * movement.quantity;
        result.amount += sign * movement.amount;
        return result;
      },
      { quantity: 0, amount: 0 },
    );
}
function varianceForLine(
  line: InventoryStocktakeLine,
  actualQuantity: number,
  actualUnitCost?: number,
) {
  const varianceQuantity = actualQuantity - line.bookQuantity;
  if (Math.abs(varianceQuantity) <= epsilon) {
    return { varianceQuantity: 0, varianceAmount: 0, unitCost: line.bookUnitCost };
  }
  const unitCost =
    varianceQuantity > 0 && line.bookUnitCost <= epsilon
      ? actualUnitCost || 0
      : line.bookUnitCost;
  if (!Number.isFinite(unitCost) || unitCost <= 0) {
    throw new Error("账面无库存的盘盈必须填写大于零的实盘单位成本");
  }
  const varianceAmount = roundMoney(varianceQuantity * unitCost);
  if (Math.abs(varianceAmount) < 0.01) {
    throw new Error("盘点差异金额不足 0.01 元，请核对数量和单位成本");
  }
  return { varianceQuantity, varianceAmount, unitCost };
}

export function InventoryStocktakeWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const currentPeriod = periods.find((candidate) => candidate.id === currentPeriodId);
  const browserPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const periodId = currentPeriodId || browserPeriod?.id || null;
  const period =
    previewPeriodLabel(currentPeriod) || previewPeriodLabel(browserPeriod);
  const periodEnd = currentPeriod?.end_date || browserPeriod?.end_date || "";
  const [stocktakes, setStocktakes] = useState<InventoryStocktake[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<InventoryStocktakeLine[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [countLine, setCountLine] = useState<InventoryStocktakeLine | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    stocktakeDate: "",
    warehouseId: "",
    note: "",
  });
  const [countDraft, setCountDraft] = useState<CountDraft>({
    actualQuantity: "",
    actualUnitCost: "",
    reason: "",
  });
  const [addItemId, setAddItemId] = useState("");

  useEffect(() => {
    if (selectedCompanyId && isTauri) void fetchPeriods(selectedCompanyId);
  }, [fetchPeriods, selectedCompanyId]);

  const loadLines = useCallback(
    async (stocktakeId: string | null) => {
      if (!stocktakeId || !companyId) {
        setLines([]);
        return;
      }
      if (!isTauri) {
        setLines(
          localArray<InventoryStocktakeLine>(lineStorageKey)
            .filter(
              (line) =>
                line.companyId === companyId &&
                line.stocktakeId === stocktakeId,
            )
            .sort((left, right) => left.itemCode.localeCompare(right.itemCode)),
        );
        return;
      }
      const result = await inventoryStocktakeApi.getInventoryStocktakeLines({
        stocktakeId,
        companyId,
      });
      setLines(result.success ? result.data || [] : []);
      if (!result.success) {
        setNotice(`读取盘点明细失败：${result.error || "未知错误"}`);
      }
    },
    [companyId],
  );

  const refresh = useCallback(async () => {
    if (!companyId || !periodId) {
      setStocktakes([]);
      setLines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let nextStocktakes: InventoryStocktake[] = [];
    if (!isTauri) {
      nextStocktakes = localArray<InventoryStocktake>(stocktakeStorageKey)
        .filter(
          (stocktake) =>
            stocktake.companyId === companyId &&
            stocktake.periodId === periodId,
        )
        .sort(
          (left, right) =>
            right.stocktakeDate.localeCompare(left.stocktakeDate) ||
            right.stocktakeNo.localeCompare(left.stocktakeNo),
        );
      setItems(
        localArray<InventoryItem>(itemStorageKey).filter(
          (item) => item.companyId === companyId,
        ),
      );
      setWarehouses(
        localArray<InventoryWarehouse>(warehouseStorageKey).filter(
          (warehouse) => warehouse.companyId === companyId,
        ),
      );
    } else {
      const [stocktakeResult, itemResult, warehouseResult] = await Promise.all([
        inventoryStocktakeApi.getInventoryStocktakes({ companyId, periodId }),
        inventoryItemApi.getInventoryItems({ companyId }),
        inventoryMasterDataApi.getInventoryWarehouses({ companyId }),
      ]);
      nextStocktakes = stocktakeResult.success
        ? stocktakeResult.data || []
        : [];
      setItems(itemResult.success ? itemResult.data || [] : []);
      setWarehouses(warehouseResult.success ? warehouseResult.data || [] : []);
      const error =
        stocktakeResult.error || itemResult.error || warehouseResult.error;
      if (error) setNotice(`读取库存盘点失败：${error}`);
    }
    setStocktakes(nextStocktakes);
    const nextSelected = nextStocktakes.some(
      (stocktake) => stocktake.id === selectedId,
    )
      ? selectedId
      : nextStocktakes[0]?.id || null;
    setSelectedId(nextSelected);
    await loadLines(nextSelected);
    setLoading(false);
  }, [companyId, loadLines, periodId, selectedId]);

  useEffect(() => {
    void refresh();
    // Selection changes load their own detail and should not re-query the header list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, periodId]);

  const selected = stocktakes.find((stocktake) => stocktake.id === selectedId);
  const metrics = useMemo(
    () => ({
      uncounted: lines.filter((line) => line.actualQuantity === null).length,
      gain: lines
        .filter((line) => line.varianceAmount > 0)
        .reduce((sum, line) => sum + line.varianceAmount, 0),
      loss: lines
        .filter((line) => line.varianceAmount < 0)
        .reduce((sum, line) => sum + Math.abs(line.varianceAmount), 0),
      differenceLines: lines.filter(
        (line) => Math.abs(line.varianceQuantity) > epsilon,
      ).length,
    }),
    [lines],
  );

  const openCreate = () => {
    const warehouse = warehouses.find((candidate) => candidate.status === "启用");
    if (!warehouse) {
      setNotice("请先维护并启用仓库档案。");
      return;
    }
    setCreateDraft({
      stocktakeDate: periodEnd,
      warehouseId: warehouse.id,
      note: "",
    });
    setCreateOpen(true);
  };

  const createStocktake = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !periodId || !period) return;
    const warehouse = warehouses.find(
      (candidate) => candidate.id === createDraft.warehouseId,
    );
    if (!warehouse || !createDraft.stocktakeDate) {
      setNotice("请选择盘点日期和启用仓库。");
      return;
    }
    setSaving(true);
    if (!isTauri) {
      const allStocktakes = localArray<InventoryStocktake>(stocktakeStorageKey);
      if (
        allStocktakes.some(
          (row) =>
            row.companyId === companyId &&
            row.periodId === periodId &&
            row.warehouseId === warehouse.id &&
            row.status === "草稿",
        )
      ) {
        setSaving(false);
        setNotice("当前仓库在本期已有未确认盘点单，请先完成或作废。");
        return;
      }
      const now = new Date().toISOString();
      const movements = localArray<InventoryMovement>(movementStorageKey);
      const scopedCount = allStocktakes.filter(
        (row) => row.companyId === companyId && row.periodId === periodId,
      ).length;
      const stocktake: InventoryStocktake = {
        id: `preview-stocktake-${Date.now()}`,
        companyId,
        periodId,
        period,
        stocktakeNo: `PD-${period.replace("-", "")}-${String(scopedCount + 1).padStart(3, "0")}`,
        stocktakeDate: createDraft.stocktakeDate,
        warehouseId: warehouse.id,
        warehouseName: warehouse.warehouseName,
        status: "草稿",
        note: createDraft.note.trim() || null,
        sourceMovementMaxRowid: movements.filter(
          (movement) =>
            movement.companyId === companyId &&
            movement.warehouseId === warehouse.id &&
            ["已核验", "已生成凭证"].includes(movement.status),
        ).length,
        voucherId: null,
        confirmedAt: null,
        confirmedBy: null,
        voidedAt: null,
        voidedBy: null,
        createdBy: "admin",
        updatedBy: "admin",
        createdAt: now,
        updatedAt: now,
      };
      const snapshotLines = items
        .filter((item) => item.status === "启用")
        .map((item) => {
          const balance = bookBalance(
            movements,
            companyId,
            item.id,
            warehouse.id,
            createDraft.stocktakeDate,
          );
          const bookAmount = roundMoney(balance.amount);
          const bookUnitCost =
            balance.quantity > epsilon
              ? bookAmount / balance.quantity
              : 0;
          return {
            id: `preview-stocktake-line-${stocktake.id}-${item.id}`,
            stocktakeId: stocktake.id,
            companyId,
            inventoryItemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            unit: item.unit,
            inventorySubject: item.inventorySubject,
            bookQuantity: balance.quantity,
            bookAmount,
            bookUnitCost,
            actualQuantity: null,
            actualUnitCost: null,
            varianceQuantity: 0,
            varianceAmount: 0,
            reason: null,
            movementId: null,
            createdAt: now,
            updatedAt: now,
          } satisfies InventoryStocktakeLine;
        })
        .filter(
          (line) =>
            Math.abs(line.bookQuantity) > epsilon ||
            Math.abs(line.bookAmount) >= 0.005,
        );
      saveLocal(stocktakeStorageKey, [stocktake, ...allStocktakes]);
      saveLocal(lineStorageKey, [
        ...snapshotLines,
        ...localArray<InventoryStocktakeLine>(lineStorageKey),
      ]);
      setCreateOpen(false);
      setSaving(false);
      setSelectedId(stocktake.id);
      setNotice("预览盘点单已创建，账面数量和成本已形成快照。");
      await refresh();
      return;
    }
    const result = await inventoryStocktakeApi.createInventoryStocktake({
      companyId,
      periodId,
      stocktakeDate: createDraft.stocktakeDate,
      warehouseId: warehouse.id,
      note: createDraft.note,
    });
    setSaving(false);
    if (!result.success) {
      setNotice(`创建盘点单失败：${result.error || "未知错误"}`);
      return;
    }
    setCreateOpen(false);
    setSelectedId(result.data?.id || null);
    setNotice("盘点单已创建，账面数量和成本已形成快照。");
    await refresh();
  };

  const chooseStocktake = async (id: string) => {
    setSelectedId(id);
    await loadLines(id);
  };
  const openCount = (line: InventoryStocktakeLine) => {
    setCountLine(line);
    setCountDraft({
      actualQuantity:
        line.actualQuantity === null ? "" : String(line.actualQuantity),
      actualUnitCost:
        line.actualUnitCost === null ? "" : String(line.actualUnitCost),
      reason: line.reason || "",
    });
  };

  const saveCount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !countLine) return;
    const actualQuantity = Number(countDraft.actualQuantity);
    const actualUnitCost = countDraft.actualUnitCost
      ? Number(countDraft.actualUnitCost)
      : undefined;
    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
      setNotice("实盘数量必须是大于或等于零的有效数值。");
      return;
    }
    setSaving(true);
    if (!isTauri) {
      try {
        const variance = varianceForLine(
          countLine,
          actualQuantity,
          actualUnitCost,
        );
        if (
          Math.abs(variance.varianceQuantity) > epsilon &&
          !countDraft.reason.trim()
        ) {
          throw new Error("存在盘盈或盘亏时必须填写差异原因");
        }
        const allLines = localArray<InventoryStocktakeLine>(lineStorageKey);
        const now = new Date().toISOString();
        saveLocal(
          lineStorageKey,
          allLines.map((line) =>
            line.id === countLine.id
              ? {
                  ...line,
                  actualQuantity,
                  actualUnitCost: variance.unitCost,
                  varianceQuantity: variance.varianceQuantity,
                  varianceAmount: variance.varianceAmount,
                  reason: countDraft.reason.trim() || null,
                  updatedAt: now,
                }
              : line,
          ),
        );
        setCountLine(null);
        setSaving(false);
        setNotice("预览实盘数量已保存。");
        await loadLines(selectedId);
      } catch (error) {
        setSaving(false);
        setNotice(String(error));
      }
      return;
    }
    const result = await inventoryStocktakeApi.saveInventoryStocktakeCount({
      companyId,
      lineId: countLine.id,
      actualQuantity,
      actualUnitCost,
      reason: countDraft.reason,
    });
    setSaving(false);
    if (!result.success) {
      setNotice(`保存实盘数量失败：${result.error || "未知错误"}`);
      return;
    }
    setCountLine(null);
    setNotice("实盘数量已保存。");
    await loadLines(selectedId);
  };

  const addItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !selected || !addItemId) return;
    setSaving(true);
    if (!isTauri) {
      if (lines.some((line) => line.inventoryItemId === addItemId)) {
        setSaving(false);
        setNotice("该存货已在当前盘点单中。");
        return;
      }
      const item = items.find((candidate) => candidate.id === addItemId);
      if (!item) return;
      const movements = localArray<InventoryMovement>(movementStorageKey);
      const balance = bookBalance(
        movements,
        companyId,
        item.id,
        selected.warehouseId,
        selected.stocktakeDate,
      );
      const now = new Date().toISOString();
      const line: InventoryStocktakeLine = {
        id: `preview-stocktake-line-${selected.id}-${item.id}`,
        stocktakeId: selected.id,
        companyId,
        inventoryItemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        inventorySubject: item.inventorySubject,
        bookQuantity: balance.quantity,
        bookAmount: roundMoney(balance.amount),
        bookUnitCost:
          balance.quantity > epsilon ? balance.amount / balance.quantity : 0,
        actualQuantity: null,
        actualUnitCost: null,
        varianceQuantity: 0,
        varianceAmount: 0,
        reason: null,
        movementId: null,
        createdAt: now,
        updatedAt: now,
      };
      saveLocal(lineStorageKey, [
        line,
        ...localArray<InventoryStocktakeLine>(lineStorageKey),
      ]);
      setAddItemOpen(false);
      setSaving(false);
      setNotice("存货已加入预览盘点单。");
      await loadLines(selected.id);
      return;
    }
    const result = await inventoryStocktakeApi.addInventoryStocktakeLine({
      companyId,
      stocktakeId: selected.id,
      inventoryItemId: addItemId,
    });
    setSaving(false);
    if (!result.success) {
      setNotice(`新增盘点明细失败：${result.error || "未知错误"}`);
      return;
    }
    setAddItemOpen(false);
    setNotice("存货已加入盘点单。");
    await loadLines(selected.id);
  };

  const confirm = async () => {
    if (!companyId || !selected || selected.status !== "草稿") return;
    if (metrics.uncounted > 0) {
      setNotice(`仍有 ${metrics.uncounted} 条明细未录入实盘数量。`);
      return;
    }
    if (
      !window.confirm(
        "确认盘点并生成调整？确认后盘点单和实盘数量不可修改，盘盈/盘亏会进入库存，并形成待审核调整凭证。",
      )
    )
      return;
    setSaving(true);
    if (!isTauri) {
      const movements = localArray<InventoryMovement>(movementStorageKey);
      const confirmedCount = movements.filter(
        (movement) =>
          movement.companyId === companyId &&
          movement.warehouseId === selected.warehouseId &&
          ["已核验", "已生成凭证"].includes(movement.status),
      ).length;
      if (confirmedCount !== selected.sourceMovementMaxRowid) {
        setSaving(false);
        setNotice("盘点快照后已有新的核验出入库，请作废当前盘点单并重新盘点。");
        return;
      }
      const now = new Date().toISOString();
      const allLines = localArray<InventoryStocktakeLine>(lineStorageKey);
      const scopedLines = allLines.filter(
        (line) => line.stocktakeId === selected.id,
      );
      const generated: InventoryMovement[] = [];
      const updatedLines = allLines.map((line) => {
        if (
          line.stocktakeId !== selected.id ||
          Math.abs(line.varianceQuantity) <= epsilon
        )
          return line;
        const movementId = `preview-stocktake-movement-${line.id}`;
        const gain = line.varianceQuantity > 0;
        generated.push({
          id: movementId,
          companyId,
          period: selected.period,
          movementDate: selected.stocktakeDate,
          billNo: `${selected.stocktakeNo}-${String(generated.length + 1).padStart(3, "0")}`,
          movementType: gain ? "盘盈入库" : "盘亏出库",
          inventoryName: line.itemName,
          warehouse: selected.warehouseName,
          warehouseId: selected.warehouseId,
          counterparty: null,
          unit: line.unit,
          quantity: Math.abs(line.varianceQuantity),
          amount: Math.abs(line.varianceAmount),
          inventoryItemId: line.inventoryItemId,
          direction: gain ? "inbound" : "outbound",
          unitCost:
            Math.abs(line.varianceAmount) /
            Math.abs(line.varianceQuantity),
          confirmedAt: now,
          sourceDocument: `盘点单 ${selected.stocktakeNo}`,
          status: "已核验",
          createdAt: now,
          updatedAt: now,
        });
        return { ...line, movementId, updatedAt: now };
      });
      saveLocal(movementStorageKey, [...generated, ...movements]);
      saveLocal(lineStorageKey, updatedLines);
      let voucherId: string | null = null;
      if (generated.length > 0) {
        const vouchers = localArray<Record<string, unknown>>(voucherStorageKey);
        const entryMap = new Map<
          string,
          { account_code: string; account_name: string; direction: string; amount: number }
        >();
        const addEntry = (
          accountCode: string,
          accountName: string,
          direction: "debit" | "credit",
          amount: number,
        ) => {
          const key = `${accountCode}:${direction}`;
          const current = entryMap.get(key);
          entryMap.set(key, {
            account_code: accountCode,
            account_name: accountName,
            direction,
            amount: roundMoney((current?.amount || 0) + amount),
          });
        };
        for (const line of scopedLines) {
          if (Math.abs(line.varianceAmount) < 0.01) continue;
          const [inventoryCode, ...inventoryNameParts] = line.inventorySubject
            .trim()
            .split(/\s+/);
          const inventoryName = inventoryNameParts.join(" ") || line.itemName;
          const amount = Math.abs(line.varianceAmount);
          if (line.varianceAmount > 0) {
            addEntry(inventoryCode, inventoryName, "debit", amount);
            addEntry("1901", "待处理财产损溢", "credit", amount);
          } else {
            addEntry("1901", "待处理财产损溢", "debit", amount);
            addEntry(inventoryCode, inventoryName, "credit", amount);
          }
        }
        const voucher = createBrowserPreviewVoucher({
          input: {
            company_id: companyId,
            period_id: selected.periodId,
            voucher_word_id: `browser-voucher-word-${companyId}-ji`,
            voucher_date: selected.stocktakeDate,
            summary: `库存盘点差异调整 ${selected.stocktakeNo}`,
            reference_number: selected.stocktakeNo,
            created_by: "admin",
            entries: [...entryMap.values()].map((entry) => ({
              ...entry,
              summary: `库存盘点差异调整 ${selected.stocktakeNo}`,
            })),
          },
          vouchers,
          now: new Date(now),
        }) as Record<string, unknown>;
        voucherId = String(voucher.id);
        saveLocal(voucherStorageKey, [voucher, ...vouchers]);
      }
      saveLocal(
        stocktakeStorageKey,
        localArray<InventoryStocktake>(stocktakeStorageKey).map((row) =>
          row.id === selected.id
            ? {
                ...row,
                status: "已确认",
                voucherId,
                confirmedAt: now,
                confirmedBy: "admin",
                updatedBy: "admin",
                updatedAt: now,
              }
            : row,
        ),
      );
      setSaving(false);
      setNotice("预览盘点已确认，盘盈/盘亏记录及待审核调整凭证已生成。");
      await refresh();
      return;
    }
    const result = await inventoryStocktakeApi.confirmInventoryStocktake({
      id: selected.id,
      companyId,
    });
    setSaving(false);
    setNotice(
      result.success
        ? "盘点已确认，盘盈/盘亏记录及待审核调整凭证已生成。"
        : `确认盘点失败：${result.error || "未知错误"}`,
    );
    if (result.success) await refresh();
  };

  const voidStocktake = async () => {
    if (!companyId || !selected || selected.status !== "草稿") return;
    if (!window.confirm(`确认作废盘点单 ${selected.stocktakeNo}？`)) return;
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      saveLocal(
        stocktakeStorageKey,
        localArray<InventoryStocktake>(stocktakeStorageKey).map((row) =>
          row.id === selected.id
            ? {
                ...row,
                status: "已作废",
                voidedAt: now,
                voidedBy: "admin",
                updatedAt: now,
              }
            : row,
        ),
      );
      setSaving(false);
      setNotice("预览盘点单已作废，不产生库存和凭证影响。");
      await refresh();
      return;
    }
    const result = await inventoryStocktakeApi.voidInventoryStocktake({
      id: selected.id,
      companyId,
    });
    setSaving(false);
    setNotice(
      result.success
        ? "盘点单已作废，不产生库存和凭证影响。"
        : `作废盘点单失败：${result.error || "未知错误"}`,
    );
    if (result.success) await refresh();
  };

  const availableItems = items.filter(
    (item) =>
      item.status === "启用" &&
      !lines.some((line) => line.inventoryItemId === item.id),
  );
  const editable = selected?.status === "草稿";

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">库存盘点</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              冻结仓库账面库存，逐项录入实盘结果；盘盈/盘亏经确认后形成库存调整和待审核凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" /> 刷新</button>
            <button type="button" disabled={!companyId || !periodId} onClick={openCreate} className="inline-flex h-8 items-center gap-1 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> 新建盘点单</button>
          </div>
        </header>
        {notice && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{notice}</div>}
        {!companyId || !periodId ? (
          <Empty message="请选择账套和启用账期后维护库存盘点。" />
        ) : loading ? (
          <Empty message="正在读取库存盘点..." />
        ) : stocktakes.length === 0 ? (
          <Empty message="当前账期尚无盘点单。新建盘点单会按盘点日期冻结仓库账面数量和移动加权成本。" />
        ) : (
          <>
            <div className="border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {stocktakes.map((stocktake) => (
                  <button key={stocktake.id} type="button" onClick={() => void chooseStocktake(stocktake.id)} className={`min-w-48 border px-3 py-2 text-left text-xs ${stocktake.id === selectedId ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>
                    <span className="flex items-center justify-between gap-2"><strong>{stocktake.stocktakeNo}</strong><span>{stocktake.status}</span></span>
                    <span className="mt-1 block text-slate-500 dark:text-slate-400">{stocktake.stocktakeDate} · {stocktake.warehouseName}</span>
                  </button>
                ))}
              </div>
            </div>
            {selected && (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{selected.stocktakeNo} · {selected.warehouseName}</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">盘点日期 {selected.stocktakeDate}{selected.note ? ` · ${selected.note}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editable && <button type="button" disabled={availableItems.length === 0} onClick={() => { setAddItemId(availableItems[0]?.id || ""); setAddItemOpen(true); }} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs disabled:opacity-50 dark:border-slate-700"><Plus className="h-3.5 w-3.5" /> 增加存货</button>}
                    {editable && <button type="button" disabled={saving} onClick={() => void voidStocktake()} className="inline-flex h-8 items-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300"><Ban className="h-3.5 w-3.5" /> 作废</button>}
                    {editable && <button type="button" disabled={saving || lines.length === 0 || metrics.uncounted > 0} onClick={() => void confirm()} className="inline-flex h-8 items-center gap-1 bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> 确认盘点并生成调整</button>}
                    {selected.voucherId && <Link to={`/vouchers/detail/${selected.voucherId}`} className="inline-flex h-8 items-center gap-1 border border-blue-400 px-3 text-xs text-blue-700 dark:text-blue-300"><Link2 className="h-3.5 w-3.5" /> 调整凭证</Link>}
                  </div>
                </div>
                <div className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
                  <Metric label="盘点明细" value={`${lines.length} 项`} />
                  <Metric label="未盘数量" value={`${metrics.uncounted} 项`} tone={metrics.uncounted ? "warn" : "ok"} />
                  <Metric label="盘盈金额" value={currency(metrics.gain)} tone={metrics.gain ? "warn" : "normal"} />
                  <Metric label="盘亏金额" value={currency(metrics.loss)} tone={metrics.loss ? "warn" : "normal"} />
                </div>
                {lines.length === 0 ? <Empty message="盘点快照没有账面库存，可通过“增加存货”登记现场发现的账外存货。" /> : <StocktakeLines lines={lines} editable={editable} onCount={openCount} />}
              </>
            )}
          </>
        )}
      </section>
      {createOpen && <CreateDialog draft={createDraft} warehouses={warehouses} saving={saving} onChange={setCreateDraft} onClose={() => setCreateOpen(false)} onSubmit={createStocktake} />}
      {countLine && <CountDialog line={countLine} draft={countDraft} saving={saving} onChange={setCountDraft} onClose={() => setCountLine(null)} onSubmit={saveCount} />}
      {addItemOpen && <AddItemDialog itemId={addItemId} items={availableItems} saving={saving} onChange={setAddItemId} onClose={() => setAddItemOpen(false)} onSubmit={addItem} />}
    </main>
  );
}

function StocktakeLines({ lines, editable, onCount }: { lines: InventoryStocktakeLine[]; editable: boolean; onCount: (line: InventoryStocktakeLine) => void }) {
  return <>
    <div className="hidden lg:block"><table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400"><tr><th className="w-[12%] px-3 py-3">存货编码</th><th className="w-[18%] px-3 py-3">存货名称</th><th className="w-[12%] px-3 py-3 text-right">账面数量</th><th className="w-[12%] px-3 py-3 text-right">实盘数量</th><th className="w-[13%] px-3 py-3 text-right">盘盈/盘亏</th><th className="w-[13%] px-3 py-3 text-right">差异金额</th><th className="w-[13%] px-3 py-3">差异原因</th><th className="w-[7%] px-3 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{lines.map((line) => <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="truncate px-3 py-3 font-mono">{line.itemCode}</td><td className="truncate px-3 py-3">{line.itemName}</td><td className="px-3 py-3 text-right tabular-nums">{line.bookQuantity.toLocaleString("zh-CN")} {line.unit}</td><td className="px-3 py-3 text-right tabular-nums">{line.actualQuantity === null ? "未盘" : `${line.actualQuantity.toLocaleString("zh-CN")} ${line.unit}`}</td><td className={`px-3 py-3 text-right tabular-nums ${line.varianceQuantity > 0 ? "text-emerald-600" : line.varianceQuantity < 0 ? "text-rose-600" : ""}`}>{line.actualQuantity === null ? "-" : line.varianceQuantity > 0 ? `盘盈 ${line.varianceQuantity}` : line.varianceQuantity < 0 ? `盘亏 ${Math.abs(line.varianceQuantity)}` : "相符"}</td><td className="px-3 py-3 text-right tabular-nums">{line.actualQuantity === null ? "-" : currency(line.varianceAmount)}</td><td className="truncate px-3 py-3" title={line.reason || ""}>{line.reason || "-"}</td><td className="px-3 py-3 text-right">{editable ? <button type="button" onClick={() => onCount(line)} className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30" aria-label={`实盘 ${line.itemName}`}><FilePenLine className="h-4 w-4" /></button> : <span className="text-slate-400">已锁定</span>}</td></tr>)}</tbody></table></div>
    <div className="space-y-2 p-3 lg:hidden">{lines.map((line) => <article key={line.id} className="border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{line.itemName}</p><p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{line.itemCode} · {line.inventorySubject}</p></div>{editable && <button type="button" onClick={() => onCount(line)} className="p-1 text-blue-600 dark:text-blue-400" aria-label={`实盘 ${line.itemName}`}><FilePenLine className="h-4 w-4" /></button>}</div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><Info label="账面数量" value={`${line.bookQuantity.toLocaleString("zh-CN")} ${line.unit}`} /><Info label="实盘数量" value={line.actualQuantity === null ? "未盘" : `${line.actualQuantity.toLocaleString("zh-CN")} ${line.unit}`} /><Info label="盘盈/盘亏" value={line.actualQuantity === null ? "-" : line.varianceQuantity > 0 ? `盘盈 ${line.varianceQuantity}` : line.varianceQuantity < 0 ? `盘亏 ${Math.abs(line.varianceQuantity)}` : "相符"} /><Info label="差异金额" value={line.actualQuantity === null ? "-" : currency(line.varianceAmount)} /><Info label="差异原因" value={line.reason || "-"} /></div></article>)}</div>
  </>;
}
function CreateDialog({ draft, warehouses, saving, onChange, onClose, onSubmit }: { draft: CreateDraft; warehouses: InventoryWarehouse[]; saving: boolean; onChange: (draft: CreateDraft) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog title="新建库存盘点" description="创建时会冻结盘点日期之前已核验的仓库账面数量和移动加权成本。" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-3 p-4 sm:grid-cols-2"><Field label="盘点日期 *"><input required type="date" value={draft.stocktakeDate} onChange={(event) => onChange({ ...draft, stocktakeDate: event.target.value })} /></Field><Field label="盘点仓库 *"><select required value={draft.warehouseId} onChange={(event) => onChange({ ...draft, warehouseId: event.target.value })}><option value="">请选择仓库</option>{warehouses.filter((warehouse) => warehouse.status === "启用").map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseCode} · {warehouse.warehouseName}</option>)}</select></Field><Field label="盘点说明"><input value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} /></Field></div><DialogFooter saving={saving} onClose={onClose} label="创建盘点单" /></form></Dialog>;
}
function CountDialog({ line, draft, saving, onChange, onClose, onSubmit }: { line: InventoryStocktakeLine; draft: CountDraft; saving: boolean; onChange: (draft: CountDraft) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const actual = Number(draft.actualQuantity);
  const difference = Number.isFinite(actual) ? actual - line.bookQuantity : 0;
  return <Dialog title={`实盘：${line.itemName}`} description={`账面数量 ${line.bookQuantity.toLocaleString("zh-CN")} ${line.unit}，账面单位成本 ${currency(line.bookUnitCost)}。`} onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-3 p-4 sm:grid-cols-2"><Field label="实盘数量 *"><input required type="number" min="0" step="0.0001" value={draft.actualQuantity} onChange={(event) => onChange({ ...draft, actualQuantity: event.target.value })} /></Field><Field label="实盘单位成本"><input type="number" min="0" step="0.000001" disabled={!(difference > epsilon && line.bookUnitCost <= epsilon)} value={draft.actualUnitCost} onChange={(event) => onChange({ ...draft, actualUnitCost: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="差异原因（存在盘盈/盘亏时必填）"><input value={draft.reason} onChange={(event) => onChange({ ...draft, reason: event.target.value })} /></Field></div></div><DialogFooter saving={saving} onClose={onClose} label="保存实盘" /></form></Dialog>;
}
function AddItemDialog({ itemId, items, saving, onChange, onClose, onSubmit }: { itemId: string; items: InventoryItem[]; saving: boolean; onChange: (id: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog title="增加盘点存货" description="用于补充现场发现但账面快照中没有余额的存货。" onClose={onClose}><form onSubmit={onSubmit}><div className="p-4"><Field label="存货档案 *"><select required value={itemId} onChange={(event) => onChange(event.target.value)}><option value="">请选择存货</option>{items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName} ({item.unit})</option>)}</select></Field></div><DialogFooter saving={saving} onClose={onClose} label="加入盘点单" /></form></Dialog>;
}
function Dialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title}><section className="w-full max-w-xl border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p></div><button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`关闭${title}`}><X className="h-4 w-4" /></button></header>{children}</section></div>;
}
function DialogFooter({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs dark:border-slate-700">取消</button><button disabled={saving} className="inline-flex h-8 items-center gap-1 bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? "处理中..." : label}</button></footer>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300"><span>{label}</span><span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">{children}</span></label>;
}
function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "ok" | "warn" }) { return <div className="border-b border-slate-200 px-4 py-3 sm:border-r xl:border-b-0 dark:border-slate-800"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 truncate" title={value}>{value}</p></div>; }
function Empty({ message }: { message: string }) { return <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400"><Boxes className="mx-auto mb-2 h-5 w-5" />{message}</div>; }
