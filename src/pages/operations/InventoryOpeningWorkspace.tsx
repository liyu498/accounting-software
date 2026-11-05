import {
  BadgeCheck,
  Boxes,
  FilePenLine,
  Link2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
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
import { Link } from "react-router-dom";
import {
  inventoryItemApi,
  inventoryMasterDataApi,
  inventoryOpeningApi,
  type InventoryItem,
  type InventoryOpeningBalance,
  type InventoryOpeningReconciliation,
  type InventoryWarehouse,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type OpeningDraft = {
  inventoryItemId: string;
  warehouseId: string;
  quantity: string;
  amount: string;
};
type BrowserInitialBalance = {
  companyId: string;
  period: string;
  accountCode: string;
  openingDebit: number;
  openingCredit: number;
};
type BrowserFinalization = {
  companyId: string;
  period: string;
  finalizedAt: string;
};

const openingStorageKey = "accounting-preview-inventory-opening-data-v1";
const openingFinalizationStorageKey =
  "accounting-preview-inventory-opening-finalizations-v1";
const itemStorageKey = "accounting-preview-inventory-item-data-v1";
const warehouseStorageKey = "accounting-preview-inventory-warehouse-data-v1";
const movementStorageKey = "accounting-preview-inventory-movement-data-v1";
const financialOpeningStorageKey = "accounting-preview-initial-balances-v2";
const financialFinalizationStorageKey =
  "accounting-preview-initial-balance-finalizations-v1";

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function emptyDraft(): OpeningDraft {
  return {
    inventoryItemId: "",
    warehouseId: "",
    quantity: "",
    amount: "",
  };
}
function subjectCode(subject: string) {
  return subject.trim().split(/\s+/)[0] || "";
}
function loadLocalArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
function saveLocalArray<T>(key: string, rows: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(rows));
}
function browserReconciliation(
  companyId: string,
  period: string,
  rows: InventoryOpeningBalance[],
  items: InventoryItem[],
): InventoryOpeningReconciliation {
  const financialRows = loadLocalArray<BrowserInitialBalance>(
    financialOpeningStorageKey,
  ).filter((row) => row.companyId === companyId && row.period === period);
  const financialFinalized = loadLocalArray<BrowserFinalization>(
    financialFinalizationStorageKey,
  ).some((row) => row.companyId === companyId && row.period === period);
  const inventoryFinalized = loadLocalArray<BrowserFinalization>(
    openingFinalizationStorageKey,
  ).some((row) => row.companyId === companyId && row.period === period);
  const codes = new Set(
    items
      .filter((item) => item.status === "启用")
      .map((item) => subjectCode(item.inventorySubject))
      .filter(Boolean),
  );
  const detailByCode = new Map<string, number>();
  rows.forEach((row) => {
    const code = subjectCode(row.inventorySubject);
    codes.add(code);
    detailByCode.set(code, (detailByCode.get(code) || 0) + row.amount);
  });
  const ledgerByCode = new Map(
    financialRows.map((row) => [
      row.accountCode,
      row.openingDebit - row.openingCredit,
    ]),
  );
  const mismatches = [...codes].filter(
    (code) =>
      Math.abs(
        (detailByCode.get(code) || 0) - (ledgerByCode.get(code) || 0),
      ) >= 0.01,
  );
  const detailAmount = [...detailByCode.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const ledgerAmount = [...codes].reduce(
    (sum, code) => sum + (ledgerByCode.get(code) || 0),
    0,
  );
  const isReconciled = mismatches.length === 0;
  return {
    detailAmount,
    ledgerAmount,
    differenceAmount: detailAmount - ledgerAmount,
    isReconciled,
    financialOpeningFinalized: financialFinalized,
    inventoryOpeningFinalized: inventoryFinalized,
    message: inventoryFinalized
      ? "期初库存已确认锁定"
      : !financialFinalized
        ? "请先在期初余额模块完成试算平衡并确认建账"
        : isReconciled
          ? "存货明细金额与财务期初余额一致，可以确认锁定"
          : `以下存货科目与财务期初余额不一致：${mismatches.join("、")}`,
  };
}

export function InventoryOpeningWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const currentPeriod = periods.find((period) => period.id === currentPeriodId);
  const browserPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const periodId = currentPeriodId || browserPeriod?.id || null;
  const period =
    previewPeriodLabel(currentPeriod) || previewPeriodLabel(browserPeriod);
  const [rows, setRows] = useState<InventoryOpeningBalance[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [reconciliation, setReconciliation] =
    useState<InventoryOpeningReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryOpeningBalance | null>(null);
  const [draft, setDraft] = useState<OpeningDraft>(emptyDraft());

  useEffect(() => {
    if (selectedCompanyId && isTauri) void fetchPeriods(selectedCompanyId);
  }, [fetchPeriods, selectedCompanyId]);

  const refresh = useCallback(async () => {
    if (!companyId || !periodId || !period) {
      setRows([]);
      setItems([]);
      setWarehouses([]);
      setReconciliation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      const openingRows = loadLocalArray<InventoryOpeningBalance>(
        openingStorageKey,
      ).filter(
        (row) => row.companyId === companyId && row.periodId === periodId,
      );
      const itemRows = loadLocalArray<InventoryItem>(itemStorageKey).filter(
        (item) => item.companyId === companyId,
      );
      const warehouseRows = loadLocalArray<InventoryWarehouse>(
        warehouseStorageKey,
      ).filter((warehouse) => warehouse.companyId === companyId);
      setRows(openingRows);
      setItems(itemRows);
      setWarehouses(warehouseRows);
      setReconciliation(
        browserReconciliation(companyId, period, openingRows, itemRows),
      );
      setLoading(false);
      return;
    }
    const [openingResult, reconciliationResult, itemResult, warehouseResult] =
      await Promise.all([
        inventoryOpeningApi.getInventoryOpeningBalances({
          companyId,
          periodId,
        }),
        inventoryOpeningApi.getInventoryOpeningReconciliation({
          companyId,
          periodId,
        }),
        inventoryItemApi.getInventoryItems({ companyId }),
        inventoryMasterDataApi.getInventoryWarehouses({ companyId }),
      ]);
    setRows(openingResult.success ? openingResult.data || [] : []);
    setReconciliation(
      reconciliationResult.success ? reconciliationResult.data || null : null,
    );
    setItems(itemResult.success ? itemResult.data || [] : []);
    setWarehouses(warehouseResult.success ? warehouseResult.data || [] : []);
    const error =
      openingResult.error ||
      reconciliationResult.error ||
      itemResult.error ||
      warehouseResult.error;
    setNotice(error ? `读取期初库存失败：${error}` : null);
    setLoading(false);
  }, [companyId, period, periodId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(
    () => ({
      quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
    }),
    [rows],
  );
  const locked = reconciliation?.inventoryOpeningFinalized === true;
  const canFinalize = Boolean(
    reconciliation?.financialOpeningFinalized &&
      reconciliation.isReconciled &&
      !reconciliation.inventoryOpeningFinalized,
  );
  const openCreate = () => {
    if (!items.some((item) => item.status === "启用")) {
      setNotice("请先维护并启用存货档案。");
      return;
    }
    if (!warehouses.some((warehouse) => warehouse.status === "启用")) {
      setNotice("请先维护并启用仓库档案。");
      return;
    }
    setEditing(null);
    setDraft({
      ...emptyDraft(),
      inventoryItemId: items.find((item) => item.status === "启用")?.id || "",
      warehouseId:
        warehouses.find((warehouse) => warehouse.status === "启用")?.id || "",
    });
    setEditorOpen(true);
  };
  const openEdit = (row: InventoryOpeningBalance) => {
    if (row.status !== "草稿" || locked) return;
    setEditing(row);
    setDraft({
      inventoryItemId: row.inventoryItemId,
      warehouseId: row.warehouseId,
      quantity: String(row.quantity),
      amount: String(row.amount),
    });
    setEditorOpen(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !periodId || !period) {
      setNotice("请先选择账套和账期。");
      return;
    }
    const item = items.find((candidate) => candidate.id === draft.inventoryItemId);
    const warehouse = warehouses.find(
      (candidate) => candidate.id === draft.warehouseId,
    );
    const quantity = Number(draft.quantity);
    const amount = Number(draft.amount);
    if (
      !item ||
      item.status !== "启用" ||
      !warehouse ||
      warehouse.status !== "启用" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setNotice("请选择启用的存货和仓库，并填写大于零的期初数量及金额。");
      return;
    }
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const all = loadLocalArray<InventoryOpeningBalance>(openingStorageKey);
      const existing = all.find(
        (row) =>
          row.companyId === companyId &&
          row.periodId === periodId &&
          row.inventoryItemId === item.id &&
          row.warehouseId === warehouse.id,
      );
      const record: InventoryOpeningBalance = {
        id:
          existing?.id ||
          `preview-inventory-opening-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        companyId,
        periodId,
        period,
        inventoryItemId: item.id,
        warehouseId: warehouse.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        warehouseName: warehouse.warehouseName,
        unit: item.unit,
        inventorySubject: item.inventorySubject,
        quantity,
        amount,
        status: "草稿",
        movementId: null,
        confirmedAt: null,
        confirmedBy: null,
        createdBy: existing?.createdBy || "admin",
        updatedBy: "admin",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      saveLocalArray(openingStorageKey, [
        record,
        ...all.filter((row) => row.id !== record.id),
      ]);
      setSaving(false);
      setEditorOpen(false);
      setNotice("预览期初库存已保存，确认前仍可修改。");
      await refresh();
      return;
    }
    const result = await inventoryOpeningApi.saveInventoryOpeningBalance({
      companyId,
      periodId,
      inventoryItemId: item.id,
      warehouseId: warehouse.id,
      quantity,
      amount,
    });
    setSaving(false);
    if (!result.success) {
      setNotice(`保存期初库存失败：${result.error || "未知错误"}`);
      return;
    }
    setEditorOpen(false);
    setNotice("期初库存已保存并记录操作日志。");
    await refresh();
  };
  const deleteRecord = async (row: InventoryOpeningBalance) => {
    if (!companyId || row.status !== "草稿") return;
    if (!window.confirm(`确认删除 ${row.itemName} / ${row.warehouseName} 的期初库存？`)) {
      return;
    }
    setSaving(true);
    if (!isTauri) {
      saveLocalArray(
        openingStorageKey,
        loadLocalArray<InventoryOpeningBalance>(openingStorageKey).filter(
          (item) => item.id !== row.id,
        ),
      );
      setSaving(false);
      setNotice("预览期初库存明细已删除。");
      await refresh();
      return;
    }
    const result = await inventoryOpeningApi.deleteInventoryOpeningBalance({
      id: row.id,
      companyId,
    });
    setSaving(false);
    setNotice(
      result.success
        ? "期初库存明细已删除并记录操作日志。"
        : `删除失败：${result.error || "未知错误"}`,
    );
    if (result.success) await refresh();
  };
  const finalize = async () => {
    if (!companyId || !periodId || !period || !canFinalize) return;
    if (
      !window.confirm(
        "确认锁定本期所有期初库存？确认后不可修改，并会形成已核验的期初入库记录。",
      )
    ) {
      return;
    }
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const openingRows = loadLocalArray<InventoryOpeningBalance>(
        openingStorageKey,
      );
      const currentRows = openingRows.filter(
        (row) => row.companyId === companyId && row.periodId === periodId,
      );
      const otherRows = openingRows.filter(
        (row) => !(row.companyId === companyId && row.periodId === periodId),
      );
      const movements = loadLocalArray<Record<string, unknown>>(movementStorageKey);
      const confirmedRows = currentRows.map((row) => {
        const movementId = `preview-opening-movement-${row.id}`;
        movements.unshift({
          id: movementId,
          companyId,
          period,
          movementDate: browserPeriod?.start_date || `${period}-01`,
          billNo: `OPEN-${period.replace("-", "")}-${row.id}`,
          movementType: "期初入库",
          inventoryName: row.itemName,
          warehouse: row.warehouseName,
          counterparty: null,
          unit: row.unit,
          quantity: row.quantity,
          amount: row.amount,
          inventoryItemId: row.inventoryItemId,
          warehouseId: row.warehouseId,
          direction: "inbound",
          unitCost: row.amount / row.quantity,
          confirmedAt: now,
          sourceDocument: "期初库存",
          status: "已核验",
          createdAt: now,
          updatedAt: now,
        });
        return {
          ...row,
          status: "已确认",
          movementId,
          confirmedAt: now,
          confirmedBy: "admin",
          updatedBy: "admin",
          updatedAt: now,
        };
      });
      saveLocalArray(openingStorageKey, [...confirmedRows, ...otherRows]);
      saveLocalArray(movementStorageKey, movements);
      saveLocalArray(openingFinalizationStorageKey, [
        { companyId, period, finalizedAt: now },
        ...loadLocalArray<BrowserFinalization>(openingFinalizationStorageKey).filter(
          (row) => !(row.companyId === companyId && row.period === period),
        ),
      ]);
      setSaving(false);
      setNotice("预览期初库存已确认锁定，并生成期初入库核验记录。");
      await refresh();
      return;
    }
    const result = await inventoryOpeningApi.finalizeInventoryOpeningBalances({
      companyId,
      periodId,
    });
    setSaving(false);
    setNotice(
      result.success
        ? "期初库存已确认锁定，并生成期初入库核验记录。"
        : `确认失败：${result.error || "未知错误"}`,
    );
    if (result.success) await refresh();
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">期初库存</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按存货与仓库登记启用账期的期初数量和金额；与财务期初余额核对后统一确认锁定。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 刷新
            </button>
            <button
              type="button"
              disabled={!companyId || !periodId || locked}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 border border-blue-500 px-3 text-xs text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
            >
              <Plus className="h-3.5 w-3.5" /> 新增明细
            </button>
            <button
              type="button"
              disabled={!canFinalize || saving}
              onClick={() => void finalize()}
              className="inline-flex h-8 items-center gap-1 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole className="h-3.5 w-3.5" />
              {locked ? "已锁定" : "确认并锁定"}
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric label="明细数量" value={`${totals.quantity.toLocaleString("zh-CN")} 件/单位`} />
          <Metric label="库存明细金额" value={currency(totals.amount)} />
          <Metric label="账面期初" value={currency(reconciliation?.ledgerAmount || 0)} />
          <Metric
            label="差异"
            value={currency(reconciliation?.differenceAmount || 0)}
            tone={reconciliation?.isReconciled ? "ok" : "warn"}
          />
        </div>
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 text-xs dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div
            className={`flex items-start gap-2 ${
              reconciliation?.isReconciled &&
              reconciliation.financialOpeningFinalized
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{reconciliation?.message || "等待读取期初核对状态"}</span>
          </div>
          <Link
            to="/settings/initial-balances"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Link2 className="h-3.5 w-3.5" /> 查看财务期初余额
          </Link>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {!companyId && <Empty message="请选择账套后维护期初库存。" />}
        {companyId && !periodId && <Empty message="请选择启用账期后维护期初库存。" />}
        {companyId && periodId && loading && <Empty message="正在读取期初库存..." />}
        {companyId && periodId && !loading && rows.length === 0 && (
          <Empty message="当前账期尚未登记期初库存；零库存账套也需在财务期初确认后执行锁定。" />
        )}
        {companyId && periodId && !loading && rows.length > 0 && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[12%] px-3 py-3 font-medium">存货编码</th>
                    <th className="w-[18%] px-3 py-3 font-medium">存货名称</th>
                    <th className="w-[14%] px-3 py-3 font-medium">仓库</th>
                    <th className="w-[18%] px-3 py-3 font-medium">存货科目</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">期初数量</th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">期初金额</th>
                    <th className="w-[7%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[7%] px-3 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="truncate px-3 py-3 font-mono" title={row.itemCode}>{row.itemCode}</td>
                      <td className="truncate px-3 py-3" title={row.itemName}>{row.itemName}</td>
                      <td className="truncate px-3 py-3" title={row.warehouseName}>{row.warehouseName}</td>
                      <td className="truncate px-3 py-3" title={row.inventorySubject}>{row.inventorySubject}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.quantity.toLocaleString("zh-CN")} {row.unit}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{currency(row.amount)}</td>
                      <td className="px-3 py-3">{row.status}</td>
                      <td className="px-3 py-3">
                        <RowActions row={row} disabled={saving || locked} onEdit={openEdit} onDelete={deleteRecord} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {rows.map((row) => (
                <article key={row.id} className="border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.itemName}</p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{row.itemCode} · {row.warehouseName}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{row.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="期初数量" value={`${row.quantity.toLocaleString("zh-CN")} ${row.unit}`} />
                    <Info label="期初金额" value={currency(row.amount)} />
                    <Info label="存货科目" value={row.inventorySubject} />
                  </div>
                  <div className="mt-3"><RowActions row={row} disabled={saving || locked} onEdit={openEdit} onDelete={deleteRecord} /></div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      {editorOpen && (
        <OpeningEditor
          draft={draft}
          editing={Boolean(editing)}
          items={items}
          warehouses={warehouses}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorOpen(false)}
          onSubmit={saveRecord}
        />
      )}
    </main>
  );
}

function RowActions({
  row,
  disabled,
  onEdit,
  onDelete,
}: {
  row: InventoryOpeningBalance;
  disabled: boolean;
  onEdit: (row: InventoryOpeningBalance) => void;
  onDelete: (row: InventoryOpeningBalance) => void;
}) {
  if (row.status !== "草稿") return <span className="text-xs text-slate-400">已锁定</span>;
  return (
    <div className="flex justify-end gap-1">
      <button type="button" disabled={disabled} onClick={() => onEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950/30" aria-label={`编辑 ${row.itemName}`}>
        <FilePenLine className="h-4 w-4" />
      </button>
      <button type="button" disabled={disabled} onClick={() => void onDelete(row)} className="p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950/30" aria-label={`删除 ${row.itemName}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "ok" | "warn" }) {
  return <div className="px-4 py-3"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>{value}</p></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 truncate text-slate-800 dark:text-slate-200" title={value}>{value}</p></div>;
}
function Empty({ message }: { message: string }) {
  return <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>;
}
function OpeningEditor({
  draft,
  editing,
  items,
  warehouses,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: OpeningDraft;
  editing: boolean;
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  saving: boolean;
  onChange: (draft: OpeningDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedItem = items.find((item) => item.id === draft.inventoryItemId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="期初库存编辑">
      <form onSubmit={onSubmit} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div><h2 className="text-sm font-semibold">{editing ? "编辑期初库存" : "新增期初库存"}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">同一存货与仓库在一个启用账期只能有一条期初记录。</p></div>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="关闭期初库存编辑"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="存货档案 *">
            <select required disabled={editing} value={draft.inventoryItemId} onChange={(event) => onChange({ ...draft, inventoryItemId: event.target.value })}>
              <option value="">请选择存货</option>
              {items.filter((item) => item.status === "启用" || item.id === draft.inventoryItemId).map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName} ({item.unit})</option>)}
            </select>
          </Field>
          <Field label="仓库 *">
            <select required disabled={editing} value={draft.warehouseId} onChange={(event) => onChange({ ...draft, warehouseId: event.target.value })}>
              <option value="">请选择仓库</option>
              {warehouses.filter((warehouse) => warehouse.status === "启用" || warehouse.id === draft.warehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseCode} · {warehouse.warehouseName}</option>)}
            </select>
          </Field>
          <Field label="期初数量 *">
            <input required type="number" min="0.0001" step="0.0001" value={draft.quantity} onChange={(event) => onChange({ ...draft, quantity: event.target.value })} />
          </Field>
          <Field label="期初金额 *">
            <input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            存货科目：{selectedItem?.inventorySubject || "请选择存货"}。金额将与该科目的财务期初借方净额核对。
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs dark:border-slate-700">取消</button>
          <button disabled={saving} className="inline-flex h-8 items-center gap-1 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? "保存中..." : "保存明细"}</button>
        </footer>
      </form>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300"><span>{label}</span><span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">{children}</span></label>;
}
