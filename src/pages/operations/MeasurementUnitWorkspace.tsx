import {
  ArrowRightLeft,
  Boxes,
  FilePenLine,
  FileText,
  Hash,
  Plus,
  RefreshCw,
  Ruler,
  Search,
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
  measurementUnitApi,
  type InventoryItem,
  type MeasurementUnit,
} from "../../lib/api";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";

type UnitScope = "all" | "base" | "conversion" | "precision";
type UnitDraft = {
  unitName: string;
  unitGroup: string;
  baseUnit: string;
  conversionRate: string;
  precisionDigits: string;
  remark: string;
};
const browserStorageKey = "accounting-preview-measurement-unit-data-v1";
const browserItemStorageKey = "accounting-preview-inventory-item-data-v1";
const browserInventoryBusinessKeys = [
  "accounting-preview-inventory-movement-data-v1",
  "accounting-preview-inventory-opening-data-v1",
  "accounting-preview-inventory-stocktake-line-data-v1",
];
const scopes: Array<{ id: UnitScope; label: string }> = [
  { id: "all", label: "全部单位" },
  { id: "base", label: "基础单位" },
  { id: "conversion", label: "换算单位" },
  { id: "precision", label: "整数精度" },
];
function statusClass(status: string) {
  return status === "启用"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}
function unitStatus(record: MeasurementUnit) {
  return record.status || "启用";
}
function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MeasurementUnit>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.unitName === "string" &&
    Number.isFinite(record.conversionRate) &&
    Number.isInteger(record.precisionDigits) &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserUnits(): MeasurementUnit[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMeasurementUnit) : [];
  } catch {
    return [];
  }
}
function saveBrowserUnits(records: MeasurementUnit[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function browserUnitHasInventoryBusiness(unitId: string) {
  if (typeof window === "undefined") return false;
  try {
    const items = JSON.parse(
      window.localStorage.getItem(browserItemStorageKey) || "[]",
    ) as InventoryItem[];
    const itemIds = new Set(
      items.filter((item) => item.unitId === unitId).map((item) => item.id),
    );
    return browserInventoryBusinessKeys.some((key) => {
      const rows = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<{
        inventoryItemId?: string;
      }>;
      return rows.some((row) => row.inventoryItemId && itemIds.has(row.inventoryItemId));
    });
  } catch {
    return false;
  }
}
function syncBrowserInventoryUnit(unitId: string, unitName: string, updatedAt: string) {
  if (typeof window === "undefined") return;
  try {
    const items = JSON.parse(
      window.localStorage.getItem(browserItemStorageKey) || "[]",
    ) as InventoryItem[];
    window.localStorage.setItem(
      browserItemStorageKey,
      JSON.stringify(
        items.map((item) =>
          item.unitId === unitId ? { ...item, unit: unitName, updatedAt } : item,
        ),
      ),
    );
  } catch {
    /* The unit remains saved even when preview inventory storage is unavailable. */
  }
}
function emptyDraft(): UnitDraft {
  return {
    unitName: "",
    unitGroup: "",
    baseUnit: "",
    conversionRate: "1",
    precisionDigits: "2",
    remark: "",
  };
}
function draftFromRecord(record: MeasurementUnit): UnitDraft {
  return {
    unitName: record.unitName,
    unitGroup: record.unitGroup || "",
    baseUnit: record.baseUnit || "",
    conversionRate: String(record.conversionRate),
    precisionDigits: String(record.precisionDigits),
    remark: record.remark || "",
  };
}

export function MeasurementUnitWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const [records, setRecords] = useState<MeasurementUnit[]>([]);
  const [scope, setScope] = useState<UnitScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<MeasurementUnit | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<UnitDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const refresh = useCallback(async () => {
    if (!companyId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      setRecords(
        loadBrowserUnits().filter((record) => record.companyId === companyId),
      );
      setLoading(false);
      return;
    }
    const result = await measurementUnitApi.getMeasurementUnits({ companyId });
    setRecords(result.success ? result.data || [] : []);
    setNotice(
      result.success ? null : `读取计量单位失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const isBase =
        !record.baseUnit ||
        record.baseUnit === record.unitName ||
        record.conversionRate === 1;
      const matchesScope =
        scope === "all" ||
        (scope === "base" && isBase) ||
        (scope === "conversion" && !isBase) ||
        (scope === "precision" && record.precisionDigits === 0);
      return (
        matchesScope &&
        (!term ||
          [record.unitName, record.unitGroup, record.baseUnit, record.remark]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const unitPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "单位名称",
    "单位组",
    "基础单位",
    "换算倍率",
    "数量精度",
    "状态",
    "备注",
    "更新时间",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.unitName,
        record.unitGroup || "未分组",
        record.baseUnit || record.unitName,
        String(record.conversionRate),
        `${record.precisionDigits} 位`,
        unitStatus(record),
        record.remark || "—",
        record.updatedAt,
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.length,
      groups: new Set(records.map((record) => record.unitGroup).filter(Boolean))
        .size,
      converted: records.filter((record) =>
        Boolean(
          record.baseUnit &&
          record.baseUnit !== record.unitName &&
          record.conversionRate !== 1,
        ),
      ).length,
      integer: records.filter((record) => record.precisionDigits === 0).length,
    }),
    [records],
  );
  const openCreate = () => {
    setEditingRecord(null);
    setDraft(emptyDraft());
    setShowEditor(true);
  };
  const openEdit = (record: MeasurementUnit) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护计量单位。");
      return;
    }
    const conversionRate = Number(draft.conversionRate);
    const precisionDigits = Number(draft.precisionDigits);
    if (
      !draft.unitName.trim() ||
      !Number.isFinite(conversionRate) ||
      conversionRate <= 0 ||
      !Number.isInteger(precisionDigits) ||
      precisionDigits < 0
    ) {
      setNotice("请填写单位名称、正数换算倍率和非负整数数量精度。");
      return;
    }
    const input = {
      companyId,
      unitName: draft.unitName.trim(),
      unitGroup: draft.unitGroup.trim() || undefined,
      baseUnit: draft.baseUnit.trim() || undefined,
      conversionRate,
      precisionDigits,
      remark: draft.remark.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const semanticDefinitionChanged = Boolean(
        editingRecord &&
          (editingRecord.unitGroup !== (input.unitGroup || null) ||
            editingRecord.baseUnit !== (input.baseUnit || null) ||
            editingRecord.conversionRate !== input.conversionRate ||
            editingRecord.precisionDigits !== input.precisionDigits),
      );
      if (
        editingRecord &&
        semanticDefinitionChanged &&
        browserUnitHasInventoryBusiness(editingRecord.id)
      ) {
        setSaving(false);
        setNotice(
          "已有库存业务引用该计量单位，不能修改单位组、基础单位、换算倍率或数量精度。",
        );
        return;
      }
      const now = new Date().toISOString();
      const record: MeasurementUnit = editingRecord
        ? {
            ...editingRecord,
            ...input,
            unitGroup: input.unitGroup || null,
            baseUnit: input.baseUnit || null,
            remark: input.remark || null,
            updatedAt: now,
          }
        : {
            id: `preview-measurement-unit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            unitGroup: input.unitGroup || null,
            baseUnit: input.baseUnit || null,
            remark: input.remark || null,
            status: "启用",
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserUnits([
        record,
        ...loadBrowserUnits().filter((item) => item.id !== record.id),
      ]);
      if (editingRecord) {
        syncBrowserInventoryUnit(record.id, record.unitName, now);
      }
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord ? "预览计量单位已更新。" : "预览计量单位已保存。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await measurementUnitApi.updateMeasurementUnit({
          ...input,
          id: editingRecord.id,
        })
      : await measurementUnitApi.createMeasurementUnit(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}计量单位失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "计量单位已更新。"
        : "计量单位已保存，不自动生成或过账凭证。",
    );
    await refresh();
  };
  const rowActions = (record: MeasurementUnit) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/inventory")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Boxes className="h-3.5 w-3.5" />
        存货档案
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
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">计量单位与换算口径</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护单位组、基础单位、换算倍率和数量精度，为存货与出入库提供统一口径；不自动生成或过账凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="计量单位清单"
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
              新增单位
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric icon={Ruler} label="计量单位" value={`${metrics.total} 个`} />
          <Metric
            icon={Hash}
            label="换算组"
            value={`${metrics.groups} 组`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={ArrowRightLeft}
            label="换算单位"
            value={`${metrics.converted} 个`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={FileText}
            label="整数精度"
            value={`${metrics.integer} 个`}
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
              placeholder="搜索单位、单位组、基础单位或备注"
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
          <Placeholder message="请选择账套后查看或维护计量单位。" />
        )}
        {companyId && loading && <Placeholder message="正在读取计量单位..." />}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[16%] px-3 py-3 font-medium">单位名称</th>
                    <th className="w-[16%] px-3 py-3 font-medium">单位组</th>
                    <th className="w-[16%] px-3 py-3 font-medium">基础单位</th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">
                      换算倍率
                    </th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      数量精度
                    </th>
                    <th className="w-[16%] px-3 py-3 font-medium">备注</th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unitPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="truncate px-3 py-3 font-medium"
                        title={record.unitName}
                      >
                        {record.unitName}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.unitGroup || ""}
                      >
                        {record.unitGroup || "未分组"}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.baseUnit || ""}
                      >
                        {record.baseUnit || record.unitName}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {record.conversionRate}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {record.precisionDigits} 位
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.remark || ""}
                      >
                        {record.remark || "—"}
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {unitPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {record.unitName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.unitGroup || "未分组"} · 基础单位{" "}
                        {record.baseUnit || record.unitName}
                      </p>
                    </div>
                    <Status status={unitStatus(record)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="换算倍率"
                      value={String(record.conversionRate)}
                    />
                    <Info
                      label="数量精度"
                      value={`${record.precisionDigits} 位`}
                    />
                    <Info label="备注" value={record.remark || "—"} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有计量单位。" />
            )}
            <OperationalPagination
              page={unitPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <WorkflowLink
          icon={Boxes}
          title="维护存货档案"
          description="存货档案引用单位前，应先确认换算倍率与数量精度。"
          onClick={() => navigate("/inventory")}
        />
        <WorkflowLink
          icon={FileText}
          title="登记出入库单"
          description="出入库数量按此处口径登记，单据和成本结转不会在本页自动生成。"
          onClick={() => navigate("/inventory/movements")}
        />
      </section>
      {showEditor && (
        <UnitEditor
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
function UnitEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: UnitDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: UnitDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="计量单位编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑计量单位" : "新增计量单位"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              换算关系仅定义数量口径；不会自动变更库存、成本或生成凭证。
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
          <Field label="单位名称 *">
            <input
              required
              value={draft.unitName}
              onChange={(event) =>
                onChange({ ...draft, unitName: event.target.value })
              }
            />
          </Field>
          <Field label="单位组">
            <input
              value={draft.unitGroup}
              onChange={(event) =>
                onChange({ ...draft, unitGroup: event.target.value })
              }
            />
          </Field>
          <Field label="基础单位">
            <input
              value={draft.baseUnit}
              onChange={(event) =>
                onChange({ ...draft, baseUnit: event.target.value })
              }
            />
          </Field>
          <Field label="换算倍率 *">
            <input
              required
              type="number"
              min="0.000001"
              step="0.000001"
              value={draft.conversionRate}
              onChange={(event) =>
                onChange({ ...draft, conversionRate: event.target.value })
              }
            />
          </Field>
          <Field label="数量精度 *">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={draft.precisionDigits}
              onChange={(event) =>
                onChange({ ...draft, precisionDigits: event.target.value })
              }
            />
          </Field>
          <Field label="备注">
            <input
              value={draft.remark}
              onChange={(event) =>
                onChange({ ...draft, remark: event.target.value })
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
            {saving ? "保存中..." : "保存单位"}
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
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
