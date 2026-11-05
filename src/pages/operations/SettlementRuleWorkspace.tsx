import {
  Calculator,
  CheckCheck,
  FilePenLine,
  FilePlus2,
  PlayCircle,
  Power,
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
  useSettlementRuleStore,
  type SettlementRule,
  type SettlementRuleInput,
} from "../../stores/settlementRuleStore";

type RuleDraft = {
  name: string;
  ruleType: string;
  sourceFormula: string;
  targetAccountCode: string;
  voucherWordId: string;
  summaryTemplate: string;
  priority: string;
  isEnabled: boolean;
};
const storageKey = "accounting-preview-settlement-rules-v1";
const ruleTypes = [
  { id: "profit_loss", label: "损益结转" },
  { id: "depreciation", label: "折旧摊销" },
  { id: "tax_accrual", label: "税费计提" },
  { id: "custom", label: "自定义结转" },
];

function isRule(value: unknown): value is SettlementRule {
  const rule = value as Partial<SettlementRule>;
  return Boolean(
    rule &&
    typeof rule.id === "string" &&
    typeof rule.company_id === "string" &&
    typeof rule.name === "string" &&
    typeof rule.rule_type === "string" &&
    Number.isInteger(rule.priority) &&
    Number.isFinite(rule.is_enabled),
  );
}
function loadPreviewRules(): SettlementRule[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}
function savePreviewRules(records: SettlementRule[]) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      /* The current preview stays editable when storage is unavailable. */
    }
}
function emptyDraft(): RuleDraft {
  return {
    name: "",
    ruleType: "profit_loss",
    sourceFormula: "",
    targetAccountCode: "",
    voucherWordId: "",
    summaryTemplate: "",
    priority: "10",
    isEnabled: true,
  };
}
function draftFromRule(rule: SettlementRule): RuleDraft {
  return {
    name: rule.name,
    ruleType: rule.rule_type,
    sourceFormula: rule.source_formula || "",
    targetAccountCode: rule.target_account_code || "",
    voucherWordId: rule.voucher_word_id || "",
    summaryTemplate: rule.summary_template || "",
    priority: String(rule.priority),
    isEnabled: rule.is_enabled === 1,
  };
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function ruleTypeLabel(value: string) {
  return ruleTypes.find((type) => type.id === value)?.label || value;
}

export function SettlementRuleWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const storeRules = useSettlementRuleStore((state) => state.rules);
  const loading = useSettlementRuleStore((state) => state.isLoading);
  const storeError = useSettlementRuleStore((state) => state.error);
  const fetchSettlementRules = useSettlementRuleStore(
    (state) => state.fetchSettlementRules,
  );
  const createSettlementRule = useSettlementRuleStore(
    (state) => state.createSettlementRule,
  );
  const updateSettlementRule = useSettlementRuleStore(
    (state) => state.updateSettlementRule,
  );
  const deleteSettlementRule = useSettlementRuleStore(
    (state) => state.deleteSettlementRule,
  );
  const [previewRules, setPreviewRules] = useState<SettlementRule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorRule, setEditorRule] = useState<
    SettlementRule | null | undefined
  >(undefined);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewRules([]);
      return;
    }
    if (!isTauri) {
      setPreviewRules(
        loadPreviewRules()
          .filter((rule) => rule.company_id === companyId)
          .sort(
            (left, right) =>
              left.priority - right.priority ||
              left.name.localeCompare(right.name, "zh-CN"),
          ),
      );
      return;
    }
    await fetchSettlementRules(companyId);
  }, [companyId, fetchSettlementRules]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const rules = isTauri ? storeRules : previewRules;
  const filteredRules = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return rules.filter(
      (rule) =>
        (typeFilter === "all" || rule.rule_type === typeFilter) &&
        (!term ||
          [
            rule.name,
            ruleTypeLabel(rule.rule_type),
            rule.source_formula || "",
            rule.target_account_code || "",
            rule.summary_template || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [keyword, rules, typeFilter]);
  const rulePage = useMemo(
    () => paginateOperationalRows(filteredRules, page, pageSize),
    [filteredRules, page, pageSize],
  );
  const exportHeaders = [
    "执行顺序",
    "规则名称",
    "结转类型",
    "取数口径",
    "目标科目",
    "摘要模板",
    "凭证字",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRules.map((rule) => [
        String(rule.priority),
        rule.name,
        ruleTypeLabel(rule.rule_type),
        rule.source_formula || "待补取数公式",
        rule.target_account_code || "-",
        rule.summary_template || "-",
        rule.voucher_word_id || "-",
        rule.is_enabled === 1 ? "启用" : "停用",
      ]),
    [filteredRules],
  );
  const metrics = useMemo(
    () => ({
      total: rules.length,
      enabled: rules.filter((rule) => rule.is_enabled === 1).length,
      pending: rules.filter(
        (rule) => rule.is_enabled === 1 && !rule.source_formula?.trim(),
      ).length,
    }),
    [rules],
  );
  const openCreate = () => {
    setEditorRule(null);
    setDraft({
      ...emptyDraft(),
      priority: String((rules[rules.length - 1]?.priority || 0) + 10),
    });
    setSaving(false);
  };
  const openEdit = (rule: SettlementRule) => {
    setEditorRule(rule);
    setDraft(draftFromRule(rule));
    setSaving(false);
  };

  const saveRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护结转规则。");
      return;
    }
    const name = draft.name.trim();
    const priority = Number(draft.priority);
    if (
      !name ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 9999
    ) {
      setNotice("请填写规则名称和 0 至 9999 的整数执行顺序。");
      return;
    }
    if (
      rules.some((rule) => rule.id !== editorRule?.id && rule.name === name)
    ) {
      setNotice(`规则名称“${name}”已存在。`);
      return;
    }
    const input: SettlementRuleInput = {
      companyId,
      name,
      ruleType: draft.ruleType,
      sourceFormula: draft.sourceFormula.trim() || undefined,
      targetAccountCode: draft.targetAccountCode.trim() || undefined,
      voucherWordId: draft.voucherWordId.trim() || undefined,
      summaryTemplate: draft.summaryTemplate.trim() || undefined,
      priority,
      isEnabled: draft.isEnabled,
    };
    setSaving(true);
    try {
      if (!isTauri) {
        const record: SettlementRule = {
          id:
            editorRule?.id || `preview-settlement-rule-${crypto.randomUUID()}`,
          company_id: companyId,
          name: input.name,
          rule_type: input.ruleType,
          source_formula: input.sourceFormula || null,
          target_account_code: input.targetAccountCode || null,
          voucher_word_id: input.voucherWordId || null,
          summary_template: input.summaryTemplate || null,
          priority: input.priority || 0,
          is_enabled: input.isEnabled ? 1 : 0,
        };
        const next = editorRule
          ? loadPreviewRules().map((rule) =>
              rule.id === record.id ? record : rule,
            )
          : [...loadPreviewRules(), record];
        savePreviewRules(next);
        await refresh();
      } else if (editorRule)
        await updateSettlementRule({ id: editorRule.id, ...input });
      else {
        const created = await createSettlementRule(input);
        if (!draft.isEnabled)
          await updateSettlementRule({
            id: created.id,
            ...input,
            isEnabled: false,
          });
      }
      setEditorRule(undefined);
      setNotice(
        editorRule
          ? `结转规则“${name}”已更新。`
          : `结转规则“${name}”已保存；执行前仍需人工复核。`,
      );
    } catch (error) {
      setNotice(`保存结转规则失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const switchRule = async (rule: SettlementRule) => {
    if (!companyId) return;
    const isEnabled = rule.is_enabled !== 1;
    const action = isEnabled ? "启用" : "停用";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认${action}结转规则“${rule.name}”吗？变更只影响后续结转任务。`,
      )
    )
      return;
    const input: SettlementRuleInput = {
      companyId,
      name: rule.name,
      ruleType: rule.rule_type,
      sourceFormula: rule.source_formula || undefined,
      targetAccountCode: rule.target_account_code || undefined,
      voucherWordId: rule.voucher_word_id || undefined,
      summaryTemplate: rule.summary_template || undefined,
      priority: rule.priority,
      isEnabled,
    };
    try {
      if (!isTauri) {
        const next = loadPreviewRules().map((item) =>
          item.id === rule.id
            ? { ...item, is_enabled: isEnabled ? 1 : 0 }
            : item,
        );
        savePreviewRules(next);
        await refresh();
      } else await updateSettlementRule({ id: rule.id, ...input });
      setNotice(`结转规则“${rule.name}”已${action}。`);
    } catch (error) {
      setNotice(`${action}结转规则失败：${String(error)}`);
    }
  };
  const removeRule = async (rule: SettlementRule) => {
    if (
      !companyId ||
      (typeof window !== "undefined" &&
        !window.confirm(
          `确认删除结转规则“${rule.name}”吗？历史结转凭证不会被删除。`,
        ))
    )
      return;
    try {
      if (!isTauri) {
        savePreviewRules(
          loadPreviewRules().filter((item) => item.id !== rule.id),
        );
        await refresh();
      } else await deleteSettlementRule(rule.id, companyId);
      setNotice(`结转规则“${rule.name}”已删除。`);
    } catch (error) {
      setNotice(`删除结转规则失败：${String(error)}`);
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
              <Calculator className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">结转规则</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护期末结转的取数口径、目标科目、摘要和执行顺序。规则保存不会自动生成或过账结转凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="结转规则清单"
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
              onClick={() => navigate("/period-closing")}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              进入期末结转
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增规则
            </button>
          </div>
        </header>
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护结转规则。" />
        )}
        {companyId && (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={Calculator}
                label="结转规则"
                value={String(metrics.total)}
              />
              <Metric
                icon={CheckCheck}
                label="已启用"
                value={String(metrics.enabled)}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={Power}
                label="待补取数口径"
                value={String(metrics.pending)}
                tone="text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_10rem_18rem]">
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                执行顺序越小越先处理。启用仅允许其进入后续期末结转候选，不代表已执行、已审核或已过账。
              </p>
              <select
                aria-label="结转类型"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
                className={inputClass()}
              >
                <option value="all">全部类型</option>
                {ruleTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索规则、公式、科目或摘要"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {storeError && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取结转规则失败：{storeError}
              </div>
            )}
            {isTauri && loading ? (
              <EmptyState message="正在读取当前账套的结转规则..." />
            ) : (
              <RuleList
                rules={rulePage.rows}
                onEdit={openEdit}
                onToggle={(rule) => void switchRule(rule)}
                onDelete={(rule) => void removeRule(rule)}
              />
            )}
            <OperationalPagination
              page={rulePage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {editorRule !== undefined && (
        <RuleEditor
          draft={draft}
          editing={Boolean(editorRule)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorRule(undefined)}
          onSubmit={saveRule}
        />
      )}
    </main>
  );
}

function RuleList({
  rules,
  onEdit,
  onToggle,
  onDelete,
}: {
  rules: SettlementRule[];
  onEdit: (rule: SettlementRule) => void;
  onToggle: (rule: SettlementRule) => void;
  onDelete: (rule: SettlementRule) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[8%] px-3 py-3 font-medium">顺序</th>
              <th className="w-[16%] px-3 py-3 font-medium">规则名称</th>
              <th className="w-[13%] px-3 py-3 font-medium">结转类型</th>
              <th className="w-[20%] px-3 py-3 font-medium">取数口径</th>
              <th className="w-[14%] px-3 py-3 font-medium">目标科目</th>
              <th className="w-[14%] px-3 py-3 font-medium">摘要模板</th>
              <th className="w-[15%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-3 font-mono tabular-nums">
                  {rule.priority}
                </td>
                <td
                  className="truncate px-3 py-3 font-medium"
                  title={rule.name}
                >
                  {rule.name}
                </td>
                <td className="px-3 py-3">{ruleTypeLabel(rule.rule_type)}</td>
                <td
                  className="truncate px-3 py-3 text-slate-500 dark:text-slate-400"
                  title={rule.source_formula || undefined}
                >
                  {rule.source_formula || "待补取数公式"}
                </td>
                <td
                  className="truncate px-3 py-3 font-mono"
                  title={rule.target_account_code || undefined}
                >
                  {rule.target_account_code || "-"}
                </td>
                <td
                  className="truncate px-3 py-3"
                  title={rule.summary_template || undefined}
                >
                  {rule.summary_template || "-"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label="编辑规则"
                      onClick={() => onEdit(rule)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        rule.is_enabled === 1 ? "停用规则" : "启用规则"
                      }
                      onClick={() => onToggle(rule)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="删除规则"
                      onClick={() => onDelete(rule)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
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
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {ruleTypeLabel(rule.rule_type)} · 顺序 {rule.priority}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {rule.is_enabled === 1 ? "启用" : "停用"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Info label="取数口径" value={rule.source_formula || "待补"} />
              <Info label="目标科目" value={rule.target_account_code || "-"} />
              <Info label="摘要模板" value={rule.summary_template || "-"} />
            </div>
            <div className="mt-3 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(rule)}
                className="h-7 border border-slate-300 px-2 text-xs dark:border-slate-700"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onToggle(rule)}
                className="h-7 border border-sky-300 px-2 text-xs text-sky-700 dark:border-sky-800 dark:text-sky-300"
              >
                {rule.is_enabled === 1 ? "停用" : "启用"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(rule)}
                className="h-7 border border-rose-300 px-2 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300"
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
      {rules.length === 0 && (
        <EmptyState message="暂无结转规则。新增规则后仍需在期末结转中按账期复核并人工确认。" />
      )}
    </>
  );
}
function RuleEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: RuleDraft;
  editing: boolean;
  saving: boolean;
  onChange: (value: RuleDraft | ((current: RuleDraft) => RuleDraft)) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const className = inputClass();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑结转规则" : "新增结转规则"}
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑结转规则" : "新增结转规则"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            规则仅提供后续结转候选；金额、凭证和过账必须在期末结转中人工复核。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="规则名称 *">
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：月末损益结转"
              className={className}
            />
          </Field>
          <Field label="结转类型 *">
            <select
              value={draft.ruleType}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  ruleType: event.target.value,
                }))
              }
              className={className}
            >
              {ruleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="执行顺序 *">
            <input
              required
              type="number"
              min="0"
              max="9999"
              step="1"
              value={draft.priority}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <Field label="目标科目">
            <input
              value={draft.targetAccountCode}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  targetAccountCode: event.target.value,
                }))
              }
              placeholder="如：4103 本年利润"
              className={className}
            />
          </Field>
          <Field label="取数公式/口径" className="sm:col-span-2">
            <textarea
              rows={3}
              value={draft.sourceFormula}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sourceFormula: event.target.value,
                }))
              }
              placeholder="如：损益类末级科目余额按本期发生额汇总"
              className="w-full resize-y border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </Field>
          <Field label="摘要模板" className="sm:col-span-2">
            <input
              value={draft.summaryTemplate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  summaryTemplate: event.target.value,
                }))
              }
              placeholder="如：结转本期损益"
              className={className}
            />
          </Field>
          <Field label="凭证字（可选）">
            <input
              value={draft.voucherWordId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  voucherWordId: event.target.value,
                }))
              }
              placeholder="如：记"
              className={className}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-200">
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
            启用规则
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
            {saving ? "正在保存" : editing ? "保存修改" : "保存规则"}
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
  icon: typeof Calculator;
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
