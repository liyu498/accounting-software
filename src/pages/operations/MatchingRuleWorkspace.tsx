import {
  CheckCheck,
  FileCheck2,
  FilePenLine,
  FilePlus2,
  Landmark,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
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
import { useAccountStore, type AccountCode } from "../../stores/accountStore";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useMatchingRuleStore,
  type MatchingRule,
  type MatchingRuleDirection,
  type MatchingRuleInput,
  type MatchingRuleScope,
} from "../../stores/matchingRuleStore";
import {
  useReportTemplateStore,
  type ReportItem,
} from "../../stores/reportTemplateStore";

type RuleVariant = "invoice" | "bill" | "cash" | "equity";
type RuleDraft = {
  name: string;
  conditionText: string;
  actionText: string;
  targetAccountCode: string;
  voucherTemplateId: string;
  sourceAccountCode: string;
  cashDirection: MatchingRuleDirection;
  cashFlowItemCode: string;
  summaryKeyword: string;
  priority: string;
  isEnabled: boolean;
};
type RuleProfile = {
  title: string;
  description: string;
  scope: MatchingRuleScope;
  sourceLabel: string;
  actionLabel: string;
  targetLabel: string;
  sourcePath: string;
  sourceAction: string;
  conditionHint: string;
  actionHint: string;
  targetHint: string;
  boundary: string;
  empty: string;
};

const storageKey = "accounting-preview-matching-rules-v1";
const profiles: Record<RuleVariant, RuleProfile> = {
  invoice: {
    title: "发票自动匹配规则",
    description: "按发票票种、购销方、商品、税率和金额条件生成待确认凭证建议。",
    scope: "invoice",
    sourceLabel: "发票字段条件",
    actionLabel: "候选处理动作",
    targetLabel: "目标科目",
    sourcePath: "/invoices/input",
    sourceAction: "查看进项发票",
    conditionHint: "如：进项专票，购方名称包含办公，税率为 13%",
    actionHint: "如：生成待确认费用凭证建议",
    targetHint: "如：6602 管理费用",
    boundary:
      "规则只生成待确认建议，不会自动生成已审核凭证，也不会替代会计对发票异常、税额和凭证的复核。",
    empty: "暂无发票自动匹配规则。新增后会在后续发票处理时生成待确认建议。",
  },
  bill: {
    title: "账单自动匹配规则",
    description: "按银行账户、摘要、对方户名和金额特征识别账单用途与候选分录。",
    scope: "bill",
    sourceLabel: "流水匹配条件",
    actionLabel: "候选处理动作",
    targetLabel: "目标科目",
    sourcePath: "/bills",
    sourceAction: "查看账单一览",
    conditionHint: "如：摘要包含货款，且对方户名匹配供应商",
    actionHint: "如：生成待确认应付结算建议",
    targetHint: "如：2202 应付账款",
    boundary:
      "规则只提供流水匹配候选，不会自动核销、记账或生成已审核凭证；金额与对方单位仍需人工确认。",
    empty: "暂无账单自动匹配规则。新增后会在后续流水处理时生成待确认候选。",
  },
  cash: {
    title: "现金流量映射",
    description: "按当前会计准则维护对方科目、现金方向和摘要到现金流量表项目的取数映射。",
    scope: "cash_flow",
    sourceLabel: "来源科目与方向",
    actionLabel: "项目名称",
    targetLabel: "现金流量项目",
    sourcePath: "/reports/cash-flow",
    sourceAction: "查看现金流量表",
    conditionHint: "如：借方 1002 且摘要包含销售回款",
    actionHint: "如：经营活动现金流入",
    targetHint: "如：CF-01 / 1002",
    boundary:
      "启用映射会参与后续现金流量表取数；冲突或未映射现金凭证会阻断勾稽，必须人工补齐，不会自动改写历史报表。",
    empty: "暂无结构化现金流量映射。报表暂按科目公式估算，不应作为完整现金流分类结果。",
  },
  equity: {
    title: "权益变动映射",
    description: "按当前会计准则维护权益科目、增减方向和摘要到所有者权益变动表法定原因的映射。",
    scope: "equity_change",
    sourceLabel: "权益科目与方向",
    actionLabel: "法定原因",
    targetLabel: "权益变动项目",
    sourcePath: "/reports/equity-change",
    sourceAction: "查看权益变动表",
    conditionHint: "如：实收资本增加且摘要包含股东投入",
    actionHint: "如：所有者投入普通股",
    targetHint: "如：EQ321",
    boundary:
      "启用映射会按已审核凭证分类权益变动；冲突、未映射或仅修改余额的变动继续阻断结账，不会自动改写凭证。",
    empty: "暂无权益变动映射。存在权益科目变动时，法定原因分类将保持未完成。",
  },
};

function isRule(value: unknown): value is MatchingRule {
  const rule = value as Partial<MatchingRule>;
  return Boolean(
    rule &&
    typeof rule.id === "string" &&
    typeof rule.company_id === "string" &&
    typeof rule.rule_scope === "string" &&
    typeof rule.name === "string" &&
    typeof rule.condition_text === "string" &&
    typeof rule.action_text === "string" &&
    Number.isInteger(rule.priority) &&
    Number.isFinite(rule.is_enabled) &&
    Number.isFinite(rule.hit_count),
  );
}
function loadPreviewRules(): MatchingRule[] {
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
function savePreviewRules(records: MatchingRule[]) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      /* Preview keeps the current rendered state when local storage is unavailable. */
    }
}
function emptyDraft(profile: RuleProfile): RuleDraft {
  return {
    name: "",
    conditionText: "",
    actionText: profile.scope === "cash_flow"
      ? "经营活动现金流入"
      : profile.scope === "equity_change"
        ? "所有者投入和减少资本"
        : "生成待确认凭证建议",
    targetAccountCode: "",
    voucherTemplateId: "",
    sourceAccountCode: "",
    cashDirection: profile.scope === "equity_change" ? "increase" : "inflow",
    cashFlowItemCode: "",
    summaryKeyword: "",
    priority: "50",
    isEnabled: true,
  };
}
function draftFromRule(rule: MatchingRule): RuleDraft {
  return {
    name: rule.name,
    conditionText: rule.condition_text,
    actionText: rule.action_text,
    targetAccountCode: rule.target_account_code || "",
    voucherTemplateId: rule.voucher_template_id || "",
    sourceAccountCode: rule.source_account_code || "",
    cashDirection: rule.cash_direction || "inflow",
    cashFlowItemCode: rule.cash_flow_item_code || "",
    summaryKeyword: rule.summary_keyword || "",
    priority: String(rule.priority),
    isEnabled: rule.is_enabled === 1,
  };
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}

export function InvoiceMatchingRuleWorkspace() {
  return <MatchingRuleWorkspace variant="invoice" />;
}
export function BillMatchingRuleWorkspace() {
  return <MatchingRuleWorkspace variant="bill" />;
}
export function CashFlowMappingWorkspace() {
  return <MatchingRuleWorkspace variant="cash" />;
}
export function EquityChangeMappingWorkspace() {
  return <MatchingRuleWorkspace variant="equity" />;
}

function MatchingRuleWorkspace({ variant }: { variant: RuleVariant }) {
  const profile = profiles[variant];
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const accounts = useAccountStore((state) => state.accounts);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const reportTemplates = useReportTemplateStore((state) => state.reportTemplates);
  const reportItems = useReportTemplateStore((state) => state.reportItems);
  const fetchReportTemplateWorkspace = useReportTemplateStore(
    (state) => state.fetchReportTemplateWorkspace,
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const storeRules = useMatchingRuleStore((state) => state.rules);
  const loading = useMatchingRuleStore((state) => state.isLoading);
  const storeError = useMatchingRuleStore((state) => state.error);
  const fetchMatchingRules = useMatchingRuleStore(
    (state) => state.fetchMatchingRules,
  );
  const createMatchingRule = useMatchingRuleStore(
    (state) => state.createMatchingRule,
  );
  const updateMatchingRule = useMatchingRuleStore(
    (state) => state.updateMatchingRule,
  );
  const deleteMatchingRule = useMatchingRuleStore(
    (state) => state.deleteMatchingRule,
  );
  const [previewRules, setPreviewRules] = useState<MatchingRule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorRule, setEditorRule] = useState<MatchingRule | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<RuleDraft>(() => emptyDraft(profile));
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
          .filter(
            (rule) =>
              rule.company_id === companyId &&
              rule.rule_scope === profile.scope,
          )
          .sort(
            (left, right) =>
              right.priority - left.priority ||
              left.name.localeCompare(right.name, "zh-CN"),
          ),
      );
      return;
    }
    await fetchMatchingRules(companyId, profile.scope);
  }, [companyId, fetchMatchingRules, profile.scope]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!(["cash_flow", "equity_change"] as MatchingRuleScope[]).includes(profile.scope) || !companyId) return;
    void Promise.all([
      fetchAccounts(companyId),
      fetchReportTemplateWorkspace(companyId),
    ]);
  }, [companyId, fetchAccounts, fetchReportTemplateWorkspace, profile.scope]);
  const cashFlowTemplate = useMemo(
    () =>
      reportTemplates.find(
        (template) =>
          template.report_type === "cash_flow" &&
          template.company_id === companyId,
      ) ||
      reportTemplates.find((template) => template.report_type === "cash_flow"),
    [companyId, reportTemplates],
  );
  const cashFlowItems = useMemo(
    () =>
      cashFlowTemplate
        ? reportItems.filter(
            (item) =>
              item.template_id === cashFlowTemplate.id &&
              item.is_total === 0 &&
              (item.item_level > 1 ||
                Boolean(item.formula) ||
                item.item_name.includes("汇率变动")),
          )
        : [],
    [cashFlowTemplate, reportItems],
  );
  const equityChangeTemplate = useMemo(
    () =>
      reportTemplates.find(
        (template) =>
          template.report_type === "equity_change" &&
          template.company_id === companyId,
      ) ||
      reportTemplates.find(
        (template) => template.report_type === "equity_change",
      ),
    [companyId, reportTemplates],
  );
  const equityChangeItems = useMemo(
    () =>
      equityChangeTemplate
        ? reportItems.filter(
            (item) =>
              item.template_id === equityChangeTemplate.id &&
              item.is_total === 0 &&
              item.item_level >= 2,
          )
        : [],
    [equityChangeTemplate, reportItems],
  );
  const isReportMapping = ["cash_flow", "equity_change"].includes(profile.scope);
  const mappingItems = profile.scope === "equity_change" ? equityChangeItems : cashFlowItems;
  const sourceAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.is_enabled === 1 &&
          (profile.scope !== "equity_change" || account.account_type === "equity"),
      ),
    [accounts, profile.scope],
  );
  const rules = isTauri ? storeRules : previewRules;
  const filteredRules = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return rules.filter(
      (rule) =>
        (statusFilter === "all" ||
          (statusFilter === "enabled"
            ? rule.is_enabled === 1
            : rule.is_enabled !== 1)) &&
        (!term ||
          [
            rule.name,
            rule.condition_text,
            rule.action_text,
            rule.target_account_code || "",
            rule.voucher_template_id || "",
            rule.source_account_code || "",
            rule.cash_flow_item_code || "",
            rule.summary_keyword || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [keyword, rules, statusFilter]);
  const rulePage = useMemo(
    () => paginateOperationalRows(filteredRules, page, pageSize),
    [filteredRules, page, pageSize],
  );
  const exportHeaders = [
    "规则名称",
    profile.sourceLabel,
    profile.actionLabel,
    profile.targetLabel,
    "凭证模板",
    "优先级",
    "累计命中",
    "状态",
    "更新时间",
  ];
  const exportRows = useMemo(
    () =>
      filteredRules.map((rule) => [
        rule.name,
        rule.condition_text,
        rule.action_text,
        isReportMapping
          ? rule.cash_flow_item_code || "未配置"
          : rule.target_account_code || "未配置",
        rule.voucher_template_id || "未配置",
        String(rule.priority),
        String(rule.hit_count),
        rule.is_enabled === 1 ? "启用" : "停用",
        rule.updated_at || "未记录",
      ]),
    [filteredRules, isReportMapping],
  );
  const metrics = useMemo(
    () => ({
      total: rules.length,
      enabled: rules.filter((rule) => rule.is_enabled === 1).length,
      hitCount: rules.reduce((sum, rule) => sum + rule.hit_count, 0),
      incomplete: rules.filter((rule) =>
        isReportMapping
          ? !rule.source_account_code?.trim() ||
            !rule.cash_direction ||
            !rule.cash_flow_item_code?.trim()
          : !rule.target_account_code?.trim(),
      ).length,
    }),
    [isReportMapping, rules],
  );
  const openCreate = () => {
    setEditorRule(null);
    setDraft({
      ...emptyDraft(profile),
      priority: String(Math.max(0, ...rules.map((rule) => rule.priority)) + 10),
    });
    setSaving(false);
  };
  const openEdit = (rule: MatchingRule) => {
    setEditorRule(rule);
    setDraft(draftFromRule(rule));
    setSaving(false);
  };
  const asInput = (
    rule: MatchingRule,
    enabled = rule.is_enabled === 1,
  ): MatchingRuleInput => ({
    companyId: rule.company_id,
    ruleScope: profile.scope,
    name: rule.name,
    conditionText: rule.condition_text,
    actionText: rule.action_text,
    targetAccountCode: rule.target_account_code || undefined,
    voucherTemplateId: rule.voucher_template_id || undefined,
    sourceAccountCode: rule.source_account_code || undefined,
    cashDirection: rule.cash_direction || undefined,
    cashFlowItemCode: rule.cash_flow_item_code || undefined,
    summaryKeyword: rule.summary_keyword || undefined,
    priority: rule.priority,
    isEnabled: enabled,
  });

  const saveRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护规则。");
      return;
    }
    const name = draft.name.trim();
    const priority = Number(draft.priority);
    const isCashFlow = profile.scope === "cash_flow";
    const isEquityChange = profile.scope === "equity_change";
    const selectedAccount = sourceAccounts.find(
      (account) => account.code === draft.sourceAccountCode,
    );
    const selectedReportItem = mappingItems.find(
      (item) => item.item_code === draft.cashFlowItemCode,
    );
    const conditionText = isReportMapping
      ? `${isCashFlow ? (draft.cashDirection === "inflow" ? "现金流入" : "现金流出") : (draft.cashDirection === "increase" ? "权益增加" : "权益减少")}；来源科目 ${draft.sourceAccountCode}${draft.summaryKeyword.trim() ? `；摘要包含“${draft.summaryKeyword.trim()}”` : ""}`
      : draft.conditionText.trim();
    const actionText = isReportMapping
      ? selectedReportItem?.item_name || ""
      : draft.actionText.trim();
    if (
      !name ||
      !conditionText ||
      !actionText ||
      (isReportMapping &&
        (!selectedAccount ||
          !selectedReportItem ||
          !(isCashFlow
            ? ["inflow", "outflow"].includes(draft.cashDirection)
            : ["increase", "decrease"].includes(draft.cashDirection)))) ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 9999
    ) {
      setNotice(
        isReportMapping
          ? `请选择来源科目、${isEquityChange ? "权益增减方向和法定原因项目" : "现金方向和当前准则下的现金流量项目"}，并填写有效优先级。`
          : "请填写名称、条件、动作，以及 0 至 9999 的整数优先级。",
      );
      return;
    }
    if (
      rules.some((rule) => rule.id !== editorRule?.id && rule.name === name)
    ) {
      setNotice(`规则名称“${name}”已存在。`);
      return;
    }
    const input: MatchingRuleInput = {
      companyId,
      ruleScope: profile.scope,
      name,
      conditionText,
      actionText,
      targetAccountCode: draft.targetAccountCode.trim() || undefined,
      voucherTemplateId: draft.voucherTemplateId.trim() || undefined,
      sourceAccountCode: isReportMapping
        ? draft.sourceAccountCode.trim()
        : undefined,
      cashDirection: isReportMapping ? draft.cashDirection : undefined,
      cashFlowItemCode: isReportMapping
        ? draft.cashFlowItemCode.trim()
        : undefined,
      summaryKeyword: isReportMapping
        ? draft.summaryKeyword.trim() || undefined
        : undefined,
      priority,
      isEnabled: draft.isEnabled,
    };
    setSaving(true);
    try {
      if (!isTauri) {
        const timestamp = new Date().toISOString();
        const record: MatchingRule = {
          id: editorRule?.id || `preview-matching-rule-${crypto.randomUUID()}`,
          company_id: companyId,
          rule_scope: profile.scope,
          name,
          condition_text: conditionText,
          action_text: actionText,
          target_account_code: input.targetAccountCode || null,
          voucher_template_id: input.voucherTemplateId || null,
          source_account_code: input.sourceAccountCode || null,
          cash_direction: input.cashDirection || null,
          cash_flow_item_code: input.cashFlowItemCode || null,
          summary_keyword: input.summaryKeyword || null,
          priority,
          is_enabled: draft.isEnabled ? 1 : 0,
          hit_count: editorRule?.hit_count || 0,
          created_at: editorRule?.created_at || timestamp,
          updated_at: timestamp,
        };
        const next = editorRule
          ? loadPreviewRules().map((rule) =>
              rule.id === record.id ? record : rule,
            )
          : [...loadPreviewRules(), record];
        savePreviewRules(next);
        await refresh();
      } else if (editorRule) await updateMatchingRule(editorRule.id, input);
      else await createMatchingRule(input);
      setEditorRule(undefined);
      setNotice(
        `规则“${name}”已${editorRule ? "更新" : "保存"}。${profile.boundary}`,
      );
    } catch (error) {
      setNotice(`保存规则失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const switchRule = async (rule: MatchingRule) => {
    const isEnabled = rule.is_enabled !== 1;
    const action = isEnabled ? "启用" : "停用";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确认${action}规则“${rule.name}”吗？变更只影响后续候选。`)
    )
      return;
    try {
      if (!isTauri) {
        savePreviewRules(
          loadPreviewRules().map((item) =>
            item.id === rule.id
              ? {
                  ...item,
                  is_enabled: isEnabled ? 1 : 0,
                  updated_at: new Date().toISOString(),
                }
              : item,
          ),
        );
        await refresh();
      } else await updateMatchingRule(rule.id, asInput(rule, isEnabled));
      setNotice(`规则“${rule.name}”已${action}。`);
    } catch (error) {
      setNotice(`${action}规则失败：${String(error)}`);
    }
  };
  const removeRule = async (rule: MatchingRule) => {
    if (
      !companyId ||
      (typeof window !== "undefined" &&
        !window.confirm(
          `确认删除规则“${rule.name}”吗？历史匹配记录和凭证不会变更。`,
        ))
    )
      return;
    try {
      if (!isTauri) {
        savePreviewRules(
          loadPreviewRules().filter((item) => item.id !== rule.id),
        );
        await refresh();
      } else await deleteMatchingRule(rule.id, companyId);
      setNotice(`规则“${rule.name}”已删除。`);
    } catch (error) {
      setNotice(`删除规则失败：${String(error)}`);
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
              <FileCheck2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{profile.title}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              {profile.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${profile.title}清单`}
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
              onClick={() => navigate(profile.sourcePath)}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <Landmark className="h-3.5 w-3.5" />
              {profile.sourceAction}
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
        {!companyId && <EmptyState message="请选择账套后查看或维护规则。" />}
        {companyId && (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={FileCheck2}
                label="规则数量"
                value={String(metrics.total)}
              />
              <Metric
                icon={CheckCheck}
                label="已启用"
                value={String(metrics.enabled)}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={ShieldCheck}
                label="累计命中"
                value={String(metrics.hitCount)}
                tone="text-sky-700 dark:text-sky-300"
              />
              <Metric
                icon={Power}
                label="待补目标"
                value={String(metrics.incomplete)}
                tone="text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_9rem_19rem]">
              <p className="self-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                {profile.boundary}
              </p>
              <select
                aria-label="规则状态"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className={inputClass()}
              >
                <option value="all">全部状态</option>
                <option value="enabled">已启用</option>
                <option value="disabled">已停用</option>
              </select>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索名称、条件、动作或目标"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {storeError && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取规则失败：{storeError}
              </div>
            )}
            {isTauri && loading ? (
              <EmptyState message="正在读取当前账套的规则..." />
            ) : (
              <RuleList
                profile={profile}
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
          profile={profile}
          draft={draft}
          editing={Boolean(editorRule)}
          saving={saving}
          sourceAccounts={sourceAccounts}
          mappingItems={mappingItems}
          onChange={setDraft}
          onClose={() => setEditorRule(undefined)}
          onSubmit={saveRule}
        />
      )}
    </main>
  );
}

function RuleList({
  profile,
  rules,
  onEdit,
  onToggle,
  onDelete,
}: {
  profile: RuleProfile;
  rules: MatchingRule[];
  onEdit: (rule: MatchingRule) => void;
  onToggle: (rule: MatchingRule) => void;
  onDelete: (rule: MatchingRule) => void;
}) {
  const targetValue = (rule: MatchingRule) =>
    ["cash_flow", "equity_change"].includes(profile.scope)
      ? rule.cash_flow_item_code || "待补"
      : rule.target_account_code || "待补";
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[7%] px-3 py-3 font-medium">优先级</th>
              <th className="w-[16%] px-3 py-3 font-medium">规则名称</th>
              <th className="w-[23%] px-3 py-3 font-medium">
                {profile.sourceLabel}
              </th>
              <th className="w-[18%] px-3 py-3 font-medium">
                {profile.actionLabel}
              </th>
              <th className="w-[14%] px-3 py-3 font-medium">
                {profile.targetLabel}
              </th>
              <th className="w-[7%] px-3 py-3 text-right font-medium">命中</th>
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
                <td
                  className="truncate px-3 py-3 text-slate-500 dark:text-slate-400"
                  title={rule.condition_text}
                >
                  {rule.condition_text}
                </td>
                <td className="truncate px-3 py-3" title={rule.action_text}>
                  {rule.action_text}
                </td>
                <td
                  className="truncate px-3 py-3 font-mono"
                  title={targetValue(rule)}
                >
                  {targetValue(rule)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {rule.hit_count}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <span className="mr-1 inline-flex items-center border border-slate-300 px-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {rule.is_enabled === 1 ? "启用" : "停用"}
                    </span>
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
                  优先级 {rule.priority} · 累计命中 {rule.hit_count}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {rule.is_enabled === 1 ? "启用" : "停用"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Info label={profile.sourceLabel} value={rule.condition_text} />
              <Info label={profile.actionLabel} value={rule.action_text} />
              <Info
                label={profile.targetLabel}
                value={targetValue(rule)}
              />
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
      {rules.length === 0 && <EmptyState message={profile.empty} />}
    </>
  );
}
function RuleEditor({
  profile,
  draft,
  editing,
  saving,
  sourceAccounts,
  mappingItems,
  onChange,
  onClose,
  onSubmit,
}: {
  profile: RuleProfile;
  draft: RuleDraft;
  editing: boolean;
  saving: boolean;
  sourceAccounts: AccountCode[];
  mappingItems: ReportItem[];
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
      aria-label={editing ? `编辑${profile.title}` : `新增${profile.title}`}
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? `编辑${profile.title}` : `新增${profile.title}`}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {profile.boundary}
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
              placeholder="如：销售回款识别"
              className={className}
            />
          </Field>
          <Field label="优先级 *">
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
          {["cash_flow", "equity_change"].includes(profile.scope) ? (
            <>
              <Field label="来源科目 *">
                <select
                  required
                  value={draft.sourceAccountCode}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      sourceAccountCode: event.target.value,
                    }))
                  }
                  className={className}
                >
                  <option value="">{profile.scope === "equity_change" ? "请选择权益科目" : "请选择对方科目"}</option>
                  {sourceAccounts.map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={profile.scope === "equity_change" ? "权益方向 *" : "现金方向 *"}>
                <select
                  required
                  value={draft.cashDirection}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      cashDirection: event.target.value as MatchingRuleDirection,
                    }))
                  }
                  className={className}
                >
                  {profile.scope === "equity_change" ? <>
                    <option value="increase">权益增加</option>
                    <option value="decrease">权益减少</option>
                  </> : <>
                    <option value="inflow">现金流入</option>
                    <option value="outflow">现金流出</option>
                  </>}
                </select>
              </Field>
              <Field label={profile.scope === "equity_change" ? "法定原因项目 *" : "现金流量项目 *"} className="sm:col-span-2">
                <select
                  required
                  value={draft.cashFlowItemCode}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      cashFlowItemCode: event.target.value,
                    }))
                  }
                  className={className}
                >
                  <option value="">请选择当前会计准则的报表项目</option>
                  {mappingItems.map((item) => (
                    <option key={item.id} value={item.item_code}>
                      {item.line_number || item.item_code} {item.item_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="摘要关键词（可选）" className="sm:col-span-2">
                <input
                  value={draft.summaryKeyword}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      summaryKeyword: event.target.value,
                    }))
                  }
                  placeholder={profile.scope === "equity_change" ? "留空则匹配该科目的全部同方向权益凭证" : "留空则匹配该科目的全部同方向现金凭证"}
                  className={className}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={`${profile.sourceLabel} *`} className="sm:col-span-2">
                <textarea
                  required
                  rows={3}
                  value={draft.conditionText}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      conditionText: event.target.value,
                    }))
                  }
                  placeholder={profile.conditionHint}
                  className="w-full resize-y border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </Field>
              <Field label={`${profile.actionLabel} *`} className="sm:col-span-2">
                <input
                  required
                  value={draft.actionText}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      actionText: event.target.value,
                    }))
                  }
                  placeholder={profile.actionHint}
                  className={className}
                />
              </Field>
              <Field label={profile.targetLabel}>
                <input
                  value={draft.targetAccountCode}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      targetAccountCode: event.target.value,
                    }))
                  }
                  placeholder={profile.targetHint}
                  className={className}
                />
              </Field>
              <Field label="凭证模板（可选）">
                <input
                  value={draft.voucherTemplateId}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      voucherTemplateId: event.target.value,
                    }))
                  }
                  placeholder="模板 ID 或名称"
                  className={className}
                />
              </Field>
            </>
          )}
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
            启用并用于后续候选
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
  icon: typeof FileCheck2;
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
