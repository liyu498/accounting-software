import {
  BookOpenCheck,
  CheckCheck,
  Copy,
  FilePenLine,
  FilePlus2,
  FileSpreadsheet,
  RefreshCw,
  Search,
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
  useReportTemplateStore,
  type ReportItem,
  type ReportTemplate,
} from "../../stores/reportTemplateStore";

type PreviewReportItem = ReportItem & { company_id: string };
type FormulaDraft = {
  templateId: string;
  itemCode: string;
  lineNumber: string;
  itemName: string;
  itemLevel: string;
  sortOrder: string;
  isTotal: boolean;
  calculationSign: 1 | -1;
  formula: string;
};

const storageKey = "accounting-preview-report-formulas-v1";
const previewTemplates: ReportTemplate[] = [
  {
    id: "system-balance-sheet",
    template_code: "BALANCE_SHEET",
    template_name: "资产负债表",
    report_type: "balance_sheet",
    company_id: null,
    accounting_system: "small_enterprise",
    form_code: "会小企 01 表",
    reporting_frequency: "月报、年报",
    is_statutory: 1,
    is_system: 1,
    created_at: null,
  },
  {
    id: "system-income-statement",
    template_code: "INCOME_STATEMENT",
    template_name: "利润表",
    report_type: "income_statement",
    company_id: null,
    accounting_system: "small_enterprise",
    form_code: "会小企 02 表",
    reporting_frequency: "月报、年报",
    is_statutory: 1,
    is_system: 1,
    created_at: null,
  },
  {
    id: "system-cash-flow",
    template_code: "CASH_FLOW",
    template_name: "现金流量表",
    report_type: "cash_flow",
    company_id: null,
    accounting_system: "small_enterprise",
    form_code: "会小企 03 表",
    reporting_frequency: "月报、年报",
    is_statutory: 1,
    is_system: 1,
    created_at: null,
  },
];

function isPreviewItem(value: unknown): value is PreviewReportItem {
  const item = value as Partial<PreviewReportItem>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.template_id === "string" &&
    typeof item.item_code === "string" &&
    typeof item.item_name === "string" &&
    typeof item.company_id === "string" &&
    Number.isInteger(item.item_level) &&
    Number.isInteger(item.sort_order) &&
    Number.isFinite(item.is_total) &&
    Number.isFinite(item.is_enabled),
  );
}
function loadPreviewItems(): PreviewReportItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isPreviewItem) : [];
  } catch {
    return [];
  }
}
function savePreviewItems(items: PreviewReportItem[]) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* Preview remains usable for the current rendered state when storage is unavailable. */
    }
}
function emptyDraft(templateId = ""): FormulaDraft {
  return {
    templateId,
    itemCode: "",
    lineNumber: "",
    itemName: "",
    itemLevel: "1",
    sortOrder: "10",
    isTotal: false,
    calculationSign: 1,
    formula: "",
  };
}
function draftFromItem(item: ReportItem): FormulaDraft {
  return {
    templateId: item.template_id,
    itemCode: item.item_code,
    lineNumber: item.line_number || "",
    itemName: item.item_name,
    itemLevel: String(item.item_level),
    sortOrder: String(item.sort_order),
    isTotal: item.is_total === 1,
    calculationSign: item.calculation_sign === -1 ? -1 : 1,
    formula: item.formula || "",
  };
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function reportPath(template: ReportTemplate | undefined) {
  if (template?.report_type === "income_statement")
    return "/reports/income-statement";
  if (template?.report_type === "cash_flow") return "/reports/cash-flow";
  return "/reports/balance-sheet";
}

export function ReportFormulaWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const reportTemplates = useReportTemplateStore(
    (state) => state.reportTemplates,
  );
  const reportItems = useReportTemplateStore((state) => state.reportItems);
  const loading = useReportTemplateStore((state) => state.isLoading);
  const storeError = useReportTemplateStore((state) => state.error);
  const fetchWorkspace = useReportTemplateStore(
    (state) => state.fetchReportTemplateWorkspace,
  );
  const createReportItem = useReportTemplateStore(
    (state) => state.createReportItem,
  );
  const cloneReportTemplate = useReportTemplateStore(
    (state) => state.cloneReportTemplate,
  );
  const updateReportItem = useReportTemplateStore(
    (state) => state.updateReportItem,
  );
  const deleteReportItem = useReportTemplateStore(
    (state) => state.deleteReportItem,
  );
  const [previewItems, setPreviewItems] = useState<PreviewReportItem[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorItem, setEditorItem] = useState<ReportItem | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<FormulaDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewItems([]);
      return;
    }
    if (!isTauri) {
      setPreviewItems(
        loadPreviewItems().filter((item) => item.company_id === companyId),
      );
      return;
    }
    await fetchWorkspace(companyId);
  }, [companyId, fetchWorkspace]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const templates = isTauri ? reportTemplates : previewTemplates;
  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templateId, templates]);
  const activeTemplate =
    templates.find((template) => template.id === templateId) || templates[0];
  const isSystemTemplate = activeTemplate?.is_system === 1;
  const items = isTauri ? reportItems : previewItems;
  const templateItems = useMemo(
    () =>
      items
        .filter((item) => item.template_id === activeTemplate?.id)
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.item_code.localeCompare(right.item_code, "zh-CN"),
        ),
    [activeTemplate?.id, items],
  );
  const filteredItems = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return templateItems.filter(
      (item) =>
        !term ||
        [item.item_code, item.line_number || "", item.item_name, item.formula || ""]
          .join(" ")
          .toLowerCase()
          .includes(term),
    );
  }, [keyword, templateItems]);
  const formulaPage = useMemo(
    () => paginateOperationalRows(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  );
  const exportHeaders = [
    "报表模板",
    "项目编码",
    "行次",
    "项目名称",
    "项目层级",
    "项目类型",
    "汇总方向",
    "取数公式",
    "显示顺序",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredItems.map((item) => [
        activeTemplate?.template_name || "未选择",
        item.item_code,
        item.line_number || "-",
        item.item_name,
        String(item.item_level),
        item.is_total === 1 ? "汇总" : "明细",
        item.calculation_sign === -1 ? "减项" : "加项",
        item.formula || "待补公式",
        String(item.sort_order),
        item.is_enabled === 1 ? "启用" : "停用",
      ]),
    [activeTemplate?.template_name, filteredItems],
  );
  const metrics = useMemo(
    () => ({
      total: templateItems.length,
      formulas: templateItems.filter((item) => item.formula?.trim()).length,
      totals: templateItems.filter((item) => item.is_total === 1).length,
      review: templateItems.filter((item) => !item.formula?.trim()).length,
    }),
    [templateItems],
  );
  const openCreate = () => {
    if (isSystemTemplate) {
      setNotice("系统标准模板只读，请先复制为当前账套模板后再新增公式。");
      return;
    }
    const nextOrder =
      Math.max(0, ...templateItems.map((item) => item.sort_order)) + 10;
    setEditorItem(null);
    setDraft({
      ...emptyDraft(activeTemplate?.id || ""),
      sortOrder: String(nextOrder),
    });
    setSaving(false);
  };
  const openEdit = (item: ReportItem) => {
    if (isSystemTemplate) {
      setNotice("系统标准模板只读，请先复制为当前账套模板后再修改公式。");
      return;
    }
    setEditorItem(item);
    setDraft(draftFromItem(item));
    setSaving(false);
  };

  const saveFormula = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !activeTemplate) {
      setNotice("请先选择账套和报表模板。");
      return;
    }
    if (isSystemTemplate) {
      setNotice("系统标准模板只读，请先复制为当前账套模板后再保存公式。");
      return;
    }
    const itemCode = draft.itemCode.trim();
    const lineNumber = draft.lineNumber.trim();
    const itemName = draft.itemName.trim();
    const formula = draft.formula.trim();
    const itemLevel = Number(draft.itemLevel);
    const sortOrder = Number(draft.sortOrder);
    if (
      !itemCode ||
      !lineNumber ||
      !itemName ||
      !formula ||
      !Number.isInteger(itemLevel) ||
      itemLevel < 1 ||
      itemLevel > 9 ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 9999
    ) {
      setNotice("请填写项目编码、行次、项目名称、取数公式，以及有效层级和排序。");
      return;
    }
    if (
      !editorItem &&
      templateItems.some((item) => item.item_code === itemCode)
    ) {
      setNotice(`当前模板已存在项目编码“${itemCode}”。`);
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const record: PreviewReportItem = editorItem
          ? {
              ...editorItem,
              item_name: itemName,
              formula,
              line_number: lineNumber,
              calculation_sign: draft.calculationSign,
              sort_order: sortOrder,
              is_total: draft.isTotal ? 1 : 0,
              company_id: companyId,
            }
          : {
              id: `preview-report-item-${crypto.randomUUID()}`,
              company_id: companyId,
              template_id: activeTemplate.id,
              item_code: itemCode,
              item_name: itemName,
              parent_id: null,
              item_level: itemLevel,
              sort_order: sortOrder,
              is_total: draft.isTotal ? 1 : 0,
              formula,
              line_number: lineNumber,
              calculation_sign: draft.calculationSign,
              is_enabled: 1,
            };
        const next = editorItem
          ? loadPreviewItems().map((item) =>
              item.id === record.id ? record : item,
            )
          : [...loadPreviewItems(), record];
        savePreviewItems(next);
        await refresh();
      } else if (editorItem)
        await updateReportItem({
          id: editorItem.id,
          companyId,
          itemName,
          formula,
          lineNumber,
          calculationSign: draft.calculationSign,
          sortOrder,
          isTotal: draft.isTotal ? 1 : 0,
        });
      else
        await createReportItem({
          companyId,
          templateId: activeTemplate.id,
          itemCode,
          itemName,
          itemLevel,
          sortOrder,
          isTotal: draft.isTotal ? 1 : 0,
          formula,
          lineNumber,
          calculationSign: draft.calculationSign,
        });
      setEditorItem(undefined);
      setNotice(
        `公式“${itemName}”已${editorItem ? "更新" : "新增"}。变更仅影响后续取数，需重算并人工复核。`,
      );
    } catch (error) {
      setNotice(`保存报表公式失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const removeItem = async (item: ReportItem) => {
    if (isSystemTemplate) {
      setNotice("系统标准模板只读，请先复制为当前账套模板后再删除公式。");
      return;
    }
    if (
      !companyId ||
      (typeof window !== "undefined" &&
        !window.confirm(
          `确认删除报表项目“${item.item_name}”吗？历史归档报表不会被改写。`,
        ))
    )
      return;
    try {
      if (!isTauri) {
        savePreviewItems(
          loadPreviewItems().filter((current) => current.id !== item.id),
        );
        await refresh();
      } else await deleteReportItem(item.id, companyId);
      setNotice(`报表项目“${item.item_name}”已删除。请重新校验模板勾稽关系。`);
    } catch (error) {
      setNotice(`删除报表项目失败：${String(error)}`);
    }
  };

  const cloneActiveTemplate = async () => {
    if (!companyId || !activeTemplate) {
      setNotice("请先选择账套和系统标准模板。");
      return;
    }
    if (!isTauri) {
      setNotice("浏览器预览不保存账套模板，请在桌面端复制后维护公式。");
      return;
    }
    setCloning(true);
    try {
      const template = await cloneReportTemplate(activeTemplate.id, companyId);
      setTemplateId(template.id);
      setPage(1);
      setNotice(
        `已创建账套模板“${template.template_name}”。该模板仅供当前账套使用，不再具有法定报表模板身份。`,
      );
    } catch (error) {
      setNotice(`复制账套模板失败：${String(error)}`);
    } finally {
      setCloning(false);
    }
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">报表公式</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护资产负债表、利润表和现金流量表的项目、行次、取数公式与勾稽口径。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${activeTemplate?.template_name || "报表"}公式清单`}
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
              onClick={() => navigate(reportPath(activeTemplate))}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <BookOpenCheck className="h-3.5 w-3.5" />
              查看报表
            </button>
            {isSystemTemplate && (
              <button
                type="button"
                onClick={() => void cloneActiveTemplate()}
                disabled={!companyId || cloning || !isTauri}
                title={isTauri ? "复制后仅影响当前账套" : "请在桌面端复制账套模板"}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" />
                {cloning ? "正在复制" : "复制为账套模板"}
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              disabled={!companyId || !activeTemplate || isSystemTemplate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增公式
            </button>
          </div>
        </header>
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护报表公式。" />
        )}
        {companyId && (
          <>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  生效边界
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  公式变更只影响后续报表取数和待复核结果，不会自动覆盖历史已归档报表。保存后应重算目标报表并确认资产负债表、利润表或现金流量表的勾稽关系。
                </p>
              </div>
              <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                <span>报表模板</span>
                <select
                  aria-label="报表模板"
                  value={activeTemplate?.id || ""}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    setPage(1);
                  }}
                  className={inputClass()}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.template_name}
                      {template.is_system === 1
                        ? "（系统标准）"
                        : "（账套自定义）"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={FileSpreadsheet}
                label="项目数量"
                value={String(metrics.total)}
              />
              <Metric
                icon={CheckCheck}
                label="已有公式"
                value={String(metrics.formulas)}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={BookOpenCheck}
                label="汇总项目"
                value={String(metrics.totals)}
                tone="text-sky-700 dark:text-sky-300"
              />
              <Metric
                icon={FilePenLine}
                label="待补公式"
                value={String(metrics.review)}
                tone="text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                当前模板：{activeTemplate?.template_name || "未选择"} ·
                {isSystemTemplate
                  ? " 系统标准模板只读，复制后方可维护；复制件不再作为法定标准模板。"
                  : " 当前为账套自定义模板，修改后需重算并复核勾稽关系。"}
              </p>
              <label className="relative block w-full lg:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索项目编码、行次、项目或取数公式"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {storeError && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取报表公式失败：{storeError}
              </div>
            )}
            {isTauri && loading ? (
              <EmptyState message="正在读取报表模板和项目..." />
            ) : (
              <FormulaList
                items={formulaPage.rows}
                readOnly={isSystemTemplate}
                onEdit={openEdit}
                onDelete={(item) => void removeItem(item)}
              />
            )}
            <OperationalPagination
              page={formulaPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {editorItem !== undefined && (
        <FormulaEditor
          templates={templates}
          activeTemplate={activeTemplate}
          draft={draft}
          editing={Boolean(editorItem)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorItem(undefined)}
          onSubmit={saveFormula}
        />
      )}
    </main>
  );
}

function FormulaList({
  items,
  readOnly,
  onEdit,
  onDelete,
}: {
  items: ReportItem[];
  readOnly: boolean;
  onEdit: (item: ReportItem) => void;
  onDelete: (item: ReportItem) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[8%] px-3 py-3 font-medium">项目编码</th>
              <th className="w-[7%] px-3 py-3 font-medium">行次</th>
              <th className="w-[17%] px-3 py-3 font-medium">报表项目</th>
              <th className="w-[6%] px-3 py-3 font-medium">层级</th>
              <th className="w-[8%] px-3 py-3 font-medium">类型</th>
              <th className="w-[8%] px-3 py-3 font-medium">方向</th>
              <th className="w-[30%] px-3 py-3 font-medium">取数公式</th>
              <th className="w-[7%] px-3 py-3 text-right font-medium">排序</th>
              <th className="w-[9%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-3 font-mono">{item.item_code}</td>
                <td className="px-3 py-3 font-mono">{item.line_number || "-"}</td>
                <td
                  className="truncate px-3 py-3 font-medium"
                  title={item.item_name}
                >
                  {item.item_name}
                </td>
                <td className="px-3 py-3">{item.item_level}</td>
                <td className="px-3 py-3">
                  <span className="border border-slate-300 px-1.5 py-0.5 text-[11px] dark:border-slate-700">
                    {item.is_total === 1 ? "汇总" : "明细"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {item.calculation_sign === -1 ? "减项" : "加项"}
                </td>
                <td
                  className="truncate px-3 py-3 font-mono text-slate-600 dark:text-slate-300"
                  title={item.formula || undefined}
                >
                  {item.formula || "待补公式"}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {item.sort_order}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label="编辑公式"
                      disabled={readOnly}
                      title={readOnly ? "系统标准模板只读" : "编辑公式"}
                      onClick={() => onEdit(item)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="删除公式"
                      disabled={readOnly}
                      title={readOnly ? "系统标准模板只读" : "删除公式"}
                      onClick={() => onDelete(item)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {items.map((item) => (
          <article
            key={item.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.item_name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  编码 {item.item_code} · 行次 {item.line_number || "-"} · 层级 {item.item_level} · 排序{" "}
                  {item.sort_order}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {item.is_total === 1 ? "汇总" : "明细"}
              </span>
            </div>
            <Info label="取数公式" value={item.formula || "待补公式"} />
            <Info label="汇总方向" value={item.calculation_sign === -1 ? "减项" : "加项"} />
            <div className="mt-3 flex justify-end gap-1.5">
              <button
                type="button"
                disabled={readOnly}
                title={readOnly ? "系统标准模板只读" : "编辑公式"}
                onClick={() => onEdit(item)}
                className="h-7 border border-slate-300 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
              >
                编辑
              </button>
              <button
                type="button"
                disabled={readOnly}
                title={readOnly ? "系统标准模板只读" : "删除公式"}
                onClick={() => onDelete(item)}
                className="h-7 border border-rose-300 px-2 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-300"
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState message="当前模板暂无公式项目。新增项目后需要重算并人工确认勾稽关系。" />
      )}
    </>
  );
}
function FormulaEditor({
  templates,
  activeTemplate,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  templates: ReportTemplate[];
  activeTemplate: ReportTemplate | undefined;
  draft: FormulaDraft;
  editing: boolean;
  saving: boolean;
  onChange: (
    value: FormulaDraft | ((current: FormulaDraft) => FormulaDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const className = inputClass();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑报表公式" : "新增报表公式"}
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑报表公式" : "新增报表公式"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            公式变更需要在目标报表重算后人工复核；不会自动覆盖历史已归档报表。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {!editing && (
            <Field label="报表模板">
              <select
                disabled
                value={activeTemplate?.id || ""}
                className={className}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="项目编码 *">
            <input
              required
              disabled={editing}
              value={draft.itemCode}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  itemCode: event.target.value,
                }))
              }
              placeholder="如：BS001"
              className={className}
            />
          </Field>
          <Field label="行次 *">
            <input
              required
              value={draft.lineNumber}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  lineNumber: event.target.value,
                }))
              }
              placeholder="如：1"
              className={className}
            />
          </Field>
          <Field label="项目名称 *">
            <input
              required
              value={draft.itemName}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  itemName: event.target.value,
                }))
              }
              placeholder="如：货币资金"
              className={className}
            />
          </Field>
          <Field label="项目层级 *">
            <input
              required
              disabled={editing}
              type="number"
              min="1"
              max="9"
              value={draft.itemLevel}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  itemLevel: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <Field label="显示顺序 *">
            <input
              required
              type="number"
              min="0"
              max="9999"
              value={draft.sortOrder}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <Field label="汇总方向">
            <div className="grid h-8 grid-cols-2 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                aria-pressed={draft.calculationSign === 1}
                onClick={() =>
                  onChange((current) => ({ ...current, calculationSign: 1 }))
                }
                className={draft.calculationSign === 1 ? "bg-[#1f65a7] text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}
              >
                加项
              </button>
              <button
                type="button"
                aria-pressed={draft.calculationSign === -1}
                onClick={() =>
                  onChange((current) => ({ ...current, calculationSign: -1 }))
                }
                className={draft.calculationSign === -1 ? "bg-[#1f65a7] text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}
              >
                减项
              </button>
            </div>
          </Field>
          <Field label="取数公式 *" className="sm:col-span-2">
            <textarea
              required
              rows={4}
              value={draft.formula}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  formula: event.target.value,
                }))
              }
              placeholder="如：1001 + 1002 + 1012"
              className="w-full resize-y border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.isTotal}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isTotal: event.target.checked,
                }))
              }
            />
            作为汇总项目
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
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "正在保存" : editing ? "保存修改" : "保存公式"}
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
  icon: typeof FileSpreadsheet;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`grid gap-1 text-xs text-slate-600 dark:text-slate-300 ${className}`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 min-w-0 text-xs">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 break-words font-mono text-slate-800 dark:text-slate-100">
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
function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
