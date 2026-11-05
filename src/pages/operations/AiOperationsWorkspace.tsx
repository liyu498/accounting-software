import {
  Bot,
  BrainCircuit,
  CheckCheck,
  CircleAlert,
  FileCheck2,
  FilePlus2,
  FileSearch,
  FileUp,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  automationApi,
  type AiProviderConfig,
  type AutomationJob,
} from "../../lib/api";
import { validateAiVoucherSuggestion } from "../../lib/aiVoucherSuggestionWorkflow.js";
import {
  automationJobConfidenceLabel,
  automationJobRiskLabel,
  automationJobStatusLabel,
  automationJobTypeLabel,
  canReviewAutomationJob,
} from "../../lib/automationJob.js";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useAccountStore } from "../../stores/accountStore";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useMatchingRuleStore,
  type MatchingRule,
  type MatchingRuleInput,
} from "../../stores/matchingRuleStore";
import { usePeriodStore } from "../../stores/periodStore";

type AiOperationView = "queue" | "recognition" | "suggestions";
type JobDraft = {
  jobType: string;
  sourceModule: string;
  sourceFile: string;
  summary: string;
  riskLevel: string;
  debitAccountCode: string;
  creditAccountCode: string;
  suggestionAmount: string;
};
type MetricTone = "sky" | "emerald" | "amber" | "rose" | "slate";
type RuleDraft = {
  name: string;
  conditionText: string;
  actionText: string;
  targetAccountCode: string;
  priority: string;
  enabled: boolean;
};
type ProviderDraft = {
  id?: string;
  providerName: string;
  endpoint: string;
  model: string;
  credentialEnv: string;
  timeoutSeconds: string;
  maxFileMb: string;
  enabled: boolean;
};

const viewDefinitions: Record<
  AiOperationView,
  {
    title: string;
    description: string;
    source: string;
    empty: string;
    icon: LucideIcon;
    newLabel?: string;
  }
> = {
  queue: {
    title: "AI 任务队列",
    description:
      "集中登记和跟踪待处理资料；任务必须经人工复核后再回到对应业务模块。",
    source: "当前账套的 AI 自动化任务",
    empty: "当前账期没有 AI 处理任务。请登记真实资料来源后创建任务。",
    icon: Bot,
    newLabel: "新建任务",
  },
  recognition: {
    title: "AI 识别结果",
    description:
      "只展示 OCR 和资料识别任务的来源、置信度、风险及人工复核结果。",
    source: "AI 识别任务与人工复核记录",
    empty: "当前账期没有可复核的识别任务。请从 AI 任务队列登记资料识别任务。",
    icon: FileSearch,
  },
  suggestions: {
    title: "AI 凭证建议",
    description:
      "核验来源、借贷科目和金额后确认进入凭证草稿复核，系统不自动入账。",
    source: "AI 凭证建议与人工确认记录",
    empty: "当前账期没有 AI 凭证建议。可登记真实业务来源后创建建议。",
    icon: Sparkles,
    newLabel: "新增建议",
  },
};

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16) || "-";
}

function formatCurrency(value: number | null) {
  return value === null
    ? "-"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 2,
      }).format(value);
}

function statusLabel(status: string) {
  return automationJobStatusLabel(status);
}

function statusClass(status: string) {
  const label = statusLabel(status);
  if (label === "异常")
    return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300";
  if (label === "已完成" || label === "已确认")
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (label === "待复核")
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300";
}

function isRecognitionJob(job: AutomationJob) {
  return /recognition|ocr|识别/i.test(`${job.jobType} ${job.sourceModule}`);
}

function isSuggestionJob(job: AutomationJob) {
  return (
    /voucher_suggestion|凭证建议/i.test(job.jobType) ||
    Boolean(job.suggestionNo || job.debitSubject || job.creditSubject)
  );
}

function jobsForView(view: AiOperationView, jobs: AutomationJob[]) {
  if (view === "recognition") return jobs.filter(isRecognitionJob);
  if (view === "suggestions") return jobs.filter(isSuggestionJob);
  return jobs;
}

function jobColumns(view: AiOperationView) {
  if (view === "queue")
    return ["任务", "来源", "状态", "置信度", "风险", "更新"];
  if (view === "recognition")
    return ["来源文件", "识别类型", "置信度", "风险", "复核人", "复核状态"];
  return ["建议号", "来源与摘要", "借方科目", "贷方科目", "金额", "确认状态"];
}

function jobValues(view: AiOperationView, job: AutomationJob) {
  if (view === "queue")
    return [
      job.id,
      job.sourceModule,
      statusLabel(job.status),
      automationJobConfidenceLabel(job),
      automationJobRiskLabel(job.riskLevel),
      formatDateTime(job.updatedAt),
    ];
  if (view === "recognition")
    return [
      job.sourceFile || "未登记来源文件",
      automationJobTypeLabel(job.jobType),
      automationJobConfidenceLabel(job),
      automationJobRiskLabel(job.riskLevel),
      job.reviewer || "待分配",
      statusLabel(job.status),
    ];
  return [
    job.suggestionNo || job.id,
    `${job.sourceModule}${job.resultSummary ? ` · ${job.resultSummary}` : ""}`,
    job.debitSubject || "待补",
    job.creditSubject || "待补",
    formatCurrency(job.suggestionAmount),
    statusLabel(job.status),
  ];
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

const previewAiTrainingRuleStorageKey = "accounting-preview-matching-rules-v1";

function isPreviewAiTrainingRule(value: unknown): value is MatchingRule {
  const rule = value as Partial<MatchingRule>;
  return Boolean(
    rule &&
    typeof rule.id === "string" &&
    typeof rule.company_id === "string" &&
    rule.rule_scope === "ai_training" &&
    typeof rule.name === "string" &&
    typeof rule.condition_text === "string" &&
    typeof rule.action_text === "string" &&
    Number.isInteger(rule.priority) &&
    Number.isFinite(rule.is_enabled) &&
    Number.isFinite(rule.hit_count) &&
    typeof rule.created_at === "string" &&
    typeof rule.updated_at === "string",
  );
}

function loadPreviewAiTrainingRules(companyId: string) {
  if (typeof window === "undefined") return [] as MatchingRule[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewAiTrainingRuleStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter(isPreviewAiTrainingRule)
          .filter((rule) => rule.company_id === companyId)
      : [];
  } catch {
    return [];
  }
}

function savePreviewAiTrainingRules(
  companyId: string,
  nextRules: MatchingRule[],
) {
  if (typeof window === "undefined") return;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewAiTrainingRuleStorageKey) || "null",
    ) as unknown;
    const existing = Array.isArray(parsed)
      ? parsed.filter(
          (rule) =>
            !isPreviewAiTrainingRule(rule) || rule.company_id !== companyId,
        )
      : [];
    window.localStorage.setItem(
      previewAiTrainingRuleStorageKey,
      JSON.stringify([...existing, ...nextRules]),
    );
  } catch {
    // Browser preview keeps the current in-memory rules if storage is unavailable.
  }
}

export function AiJobQueueWorkspace() {
  return <AiAutomationWorkspace view="queue" />;
}
export function AiRecognitionWorkspace() {
  return <AiAutomationWorkspace view="recognition" />;
}
export function AiVoucherSuggestionWorkspace() {
  return <AiAutomationWorkspace view="suggestions" />;
}

function AiAutomationWorkspace({ view }: { view: AiOperationView }) {
  const definition = viewDefinitions[view];
  const Icon = definition.icon;
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const period = periods.find((item) => item.id === currentPeriodId);
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month).padStart(2, "0")}`
    : "";
  const accounts = useAccountStore((state) => state.accounts);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<AiProviderConfig[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProvider, setShowProvider] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(() => emptyJobDraft(view));
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(() =>
    emptyProviderDraft(),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || !periodLabel) {
      setJobs([]);
      setProviderConfigs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [jobResult, providerResult] = await Promise.all([
        automationApi.getAutomationJobs({
          companyId: selectedCompanyId,
          period: periodLabel,
        }),
        automationApi.getAiProviderConfigs({ companyId: selectedCompanyId }),
      ]);
      if (!jobResult.success)
        throw new Error(jobResult.error || "未能读取 AI 任务");
      if (!providerResult.success)
        throw new Error(providerResult.error || "未能读取识别服务配置");
      setJobs(jobResult.data || []);
      setProviderConfigs(providerResult.data || []);
      setNotice(null);
    } catch (error) {
      setJobs([]);
      setNotice(`读取 AI 任务失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [periodLabel, selectedCompanyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (selectedCompanyId) void fetchAccounts(selectedCompanyId);
  }, [fetchAccounts, selectedCompanyId]);

  const suggestionAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_enabled === 1 && account.is_detail === 1,
      ),
    [accounts],
  );

  const scopedJobs = useMemo(() => jobsForView(view, jobs), [jobs, view]);
  const visibleJobs = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return scopedJobs;
    return scopedJobs.filter((job) =>
      [
        job.id,
        job.jobType,
        job.sourceModule,
        job.sourceFile || "",
        job.suggestionNo || "",
        job.resultSummary || "",
        job.reviewer || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [keyword, scopedJobs]);
  const jobPage = useMemo(
    () => paginateOperationalRows(visibleJobs, page, pageSize),
    [page, pageSize, visibleJobs],
  );
  const exportHeaders = jobColumns(view);
  const exportRows = useMemo(
    () => visibleJobs.map((job) => jobValues(view, job)),
    [view, visibleJobs],
  );
  const metrics = useMemo(
    () => ({
      total: scopedJobs.length,
      waiting: scopedJobs.filter((job) =>
        ["待执行", "待复核"].includes(statusLabel(job.status)),
      ).length,
      risk: scopedJobs.filter((job) =>
        /high|高|blocked|异常/i.test(`${job.riskLevel} ${job.status}`),
      ).length,
      done: scopedJobs.filter((job) =>
        ["已完成", "已确认"].includes(statusLabel(job.status)),
      ).length,
    }),
    [scopedJobs],
  );

  const openCreate = () => {
    setDraft(emptyJobDraft(view));
    setShowCreate(true);
  };

  const openProviderSettings = () => {
    const current = providerConfigs[0];
    setProviderDraft(
      current
        ? {
            id: current.id,
            providerName: current.providerName,
            endpoint: current.endpoint,
            model: current.model,
            credentialEnv: current.credentialEnv,
            timeoutSeconds: String(current.timeoutSeconds),
            maxFileMb: String(current.maxFileBytes / 1024 / 1024),
            enabled: current.isEnabled,
          }
        : emptyProviderDraft(),
    );
    setShowProvider(true);
  };

  const saveProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompanyId) return;
    setUpdatingId("provider");
    try {
      const result = await automationApi.upsertAiProviderConfig({
        id: providerDraft.id,
        companyId: selectedCompanyId,
        providerName: providerDraft.providerName.trim(),
        providerType: "generic_json",
        endpoint: providerDraft.endpoint.trim(),
        model: providerDraft.model.trim(),
        credentialEnv: providerDraft.credentialEnv.trim(),
        timeoutSeconds: Number(providerDraft.timeoutSeconds),
        maxFileBytes: Math.round(Number(providerDraft.maxFileMb) * 1024 * 1024),
        isEnabled: providerDraft.enabled,
      });
      if (!result.success || !result.data)
        throw new Error(result.error || "保存识别服务配置失败");
      setProviderConfigs((items) => [
        result.data!,
        ...items.filter((item) => item.id !== result.data!.id),
      ]);
      setShowProvider(false);
      setNotice(
        `识别服务“${result.data.providerName}”已保存。密钥只从桌面运行环境 ${result.data.credentialEnv} 读取。`,
      );
    } catch (error) {
      setNotice(`保存识别服务配置失败：${String(error)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const selectSourceFile = async () => {
    if (!isTauri) {
      setNotice("浏览器预览不会读取本地文件，请在桌面端选择识别资料。");
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "会计识别资料",
            extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
          },
        ],
      });
      if (typeof selected === "string")
        setDraft((current) => ({ ...current, sourceFile: selected }));
    } catch (error) {
      setNotice(`选择识别资料失败：${String(error)}`);
    }
  };

  const runRecognition = async (job: AutomationJob) => {
    if (!selectedCompanyId) return;
    const provider = providerConfigs.find((item) => item.isEnabled);
    if (!provider) {
      setNotice("请先配置并启用识别服务。");
      openProviderSettings();
      return;
    }
    if (!job.sourceFile) {
      setNotice("该任务没有来源文件，请重新登记并在桌面端选择文件。");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认将“${displayFileName(job.sourceFile)}”发送到外部服务“${provider.providerName}”识别吗？系统会保存文件校验值和执行审计，结果不会自动入账。`,
      )
    )
      return;
    setUpdatingId(job.id);
    try {
      const result = await automationApi.runAiRecognitionJob({
        id: job.id,
        companyId: selectedCompanyId,
        providerConfigId: provider.id,
        disclosureConfirmed: true,
      });
      if (!result.success || !result.data)
        throw new Error(result.error || "执行识别失败");
      setJobs((items) =>
        items.map((item) =>
          item.id === result.data!.id ? result.data! : item,
        ),
      );
      setNotice("识别结果已返回待人工复核，未写入发票、凭证或账簿。");
    } catch (error) {
      setNotice(`执行识别失败：${String(error)}`);
      void refresh();
    } finally {
      setUpdatingId(null);
    }
  };

  const createJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompanyId || !periodLabel) return;
    const sourceModule = draft.sourceModule.trim();
    if (!sourceModule) {
      setNotice("请填写真实的来源模块。");
      return;
    }
    setUpdatingId("creating");
    try {
      const suggestion = view === "suggestions";
      const result = await automationApi.createAutomationJob({
        companyId: selectedCompanyId,
        period: periodLabel,
        jobType: suggestion ? "voucher_suggestion" : draft.jobType,
        sourceModule,
        sourceFile: draft.sourceFile.trim() || undefined,
        suggestionNo: suggestion ? `AI-${Date.now()}` : undefined,
        debitSubject: suggestion ? draft.debitAccountCode : undefined,
        creditSubject: suggestion ? draft.creditAccountCode : undefined,
        suggestionAmount: suggestion
          ? Number(draft.suggestionAmount)
          : undefined,
        status: suggestion ? "waiting_confirmation" : "queued",
        resultSummary:
          draft.summary.trim() ||
          (suggestion
            ? "待人工核验来源、科目和金额。"
            : "等待处理并进入人工复核。"),
        riskLevel: draft.riskLevel,
      });
      if (!result.success || !result.data)
        throw new Error(result.error || "创建任务失败");
      setJobs((items) => [result.data!, ...items]);
      setShowCreate(false);
      setNotice(
        suggestion
          ? "凭证建议已登记为待复核记录；不会自动生成或入账凭证。"
          : "AI 任务已登记；执行结果必须人工复核后再进入业务流程。",
      );
    } catch (error) {
      setNotice(`创建 AI 任务失败：${String(error)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const reviewRecognition = async (job: AutomationJob) => {
    if (
      !selectedCompanyId ||
      !canReviewAutomationJob(job)
    )
      return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认已人工复核“${job.sourceFile || job.id}”的识别结果吗？`,
      )
    )
      return;
    setUpdatingId(job.id);
    try {
      const result = await automationApi.updateAutomationJobStatus({
        id: job.id,
        companyId: selectedCompanyId,
        status: "completed",
        resultSummary: `${job.resultSummary || "未记录识别摘要"}｜已人工复核。`,
      });
      if (!result.success || !result.data)
        throw new Error(result.error || "复核失败");
      setJobs((items) =>
        items.map((item) =>
          item.id === result.data!.id ? result.data! : item,
        ),
      );
      setNotice(
        "识别复核已记录。低置信度或风险资料仍应回到来源模块补充，不会自动写入账套。",
      );
    } catch (error) {
      setNotice(`识别复核失败：${String(error)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmSuggestion = async (job: AutomationJob) => {
    try {
      validateAiVoucherSuggestion({
        job,
        accounts: suggestionAccounts,
        periodLabel,
        requireConfirmed: false,
      });
    } catch (error) {
      setNotice(`无法生成凭证草稿：${String(error)}`);
      return;
    }
    if (
      !selectedCompanyId ||
      ["已确认", "已完成"].includes(statusLabel(job.status))
    )
      return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认“${job.suggestionNo || job.id}”进入凭证草稿复核队列吗？`,
      )
    )
      return;
    setUpdatingId(job.id);
    try {
      const result = await automationApi.updateAutomationJobStatus({
        id: job.id,
        companyId: selectedCompanyId,
        status: "confirmed",
        resultSummary: `${job.resultSummary || "未记录建议摘要"}｜已人工确认，待在凭证草稿中复核。`,
      });
      if (!result.success || !result.data)
        throw new Error(result.error || "确认失败");
      setJobs((items) =>
        items.map((item) =>
          item.id === result.data!.id ? result.data! : item,
        ),
      );
      navigate(
        buildVoucherSourcePath({ kind: "ai_suggestion", id: job.id }),
        {
          state: {
            voucherNotice:
              "AI 建议已人工确认并带入凭证草稿，请复核科目、金额和来源后保存。",
          },
        },
      );
    } catch (error) {
      setNotice(`确认凭证建议失败：${String(error)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{definition.title}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              {definition.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${definition.title}清单`}
              companyName={selectedCompany?.name}
              periodLabel={periodLabel}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className={secondaryButtonClass()}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </button>
            {view !== "suggestions" && (
              <button
                type="button"
                onClick={openProviderSettings}
                disabled={!selectedCompanyId}
                className={secondaryButtonClass()}
              >
                <Settings2 className="h-3.5 w-3.5" />
                识别服务设置
              </button>
            )}
            {definition.newLabel && (
              <button
                type="button"
                onClick={openCreate}
                disabled={!selectedCompanyId || !periodLabel}
                className={primaryButtonClass()}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                {definition.newLabel}
              </button>
            )}
          </div>
        </header>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs leading-5 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
          外部识别只会在桌面端、用户逐次确认后发送所选文件；凭据不写入数据库，识别结果必须人工复核，且不会自动生成或入账凭证。
        </div>
        {notice && <Notice value={notice} />}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              任务范围
            </p>
            <p className="mt-1 text-sm font-medium">
              {selectedCompany?.name || "未选择账套"} ·{" "}
              {periodLabel || "未选择账期"}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            数据来源：{definition.source}
          </p>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            label="任务数量"
            value={`${metrics.total} 条`}
            icon={Bot}
            tone="sky"
          />
          <Metric
            label="待处理/复核"
            value={`${metrics.waiting} 条`}
            icon={FileSearch}
            tone={metrics.waiting ? "amber" : "slate"}
          />
          <Metric
            label="风险提示"
            value={`${metrics.risk} 条`}
            icon={CircleAlert}
            tone={metrics.risk ? "rose" : "slate"}
          />
          <Metric
            label="已确认完成"
            value={`${metrics.done} 条`}
            icon={CheckCheck}
            tone={metrics.done ? "emerald" : "slate"}
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {visibleJobs.length} 条当前范围记录
          </p>
          <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-80">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索来源、文件、建议号或处理人"
              className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        {!selectedCompanyId || !periodLabel ? (
          <EmptyState message="请选择账套和账期后读取 AI 工作记录。" />
        ) : loading ? (
          <EmptyState message="正在读取 AI 工作记录..." />
        ) : (
          <>
            <AiJobTable
              view={view}
              jobs={jobPage.rows}
              busyId={updatingId}
              providerConfigured={providerConfigs.some(
                (provider) => provider.isEnabled,
              )}
              onRun={runRecognition}
              onReview={reviewRecognition}
              onConfirm={confirmSuggestion}
              onOpenVoucher={(job) =>
                job.generatedVoucherId
                  ? navigate(`/vouchers/detail/${job.generatedVoucherId}`)
                  : undefined
              }
              empty={definition.empty}
            />
            <OperationalPagination
              page={jobPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {showCreate && (
        <JobEditor
          view={view}
          draft={draft}
          busy={updatingId === "creating"}
          accounts={suggestionAccounts}
          onChange={setDraft}
          onSelectSourceFile={selectSourceFile}
          onClose={() => setShowCreate(false)}
          onSubmit={createJob}
        />
      )}
      {showProvider && (
        <ProviderEditor
          draft={providerDraft}
          busy={updatingId === "provider"}
          onChange={setProviderDraft}
          onClose={() => setShowProvider(false)}
          onSubmit={saveProvider}
        />
      )}
    </main>
  );
}

function AiJobTable({
  view,
  jobs,
  busyId,
  providerConfigured,
  onRun,
  onReview,
  onConfirm,
  onOpenVoucher,
  empty,
}: {
  view: AiOperationView;
  jobs: AutomationJob[];
  busyId: string | null;
  providerConfigured: boolean;
  onRun: (job: AutomationJob) => void;
  onReview: (job: AutomationJob) => void;
  onConfirm: (job: AutomationJob) => void;
  onOpenVoucher: (job: AutomationJob) => void;
  empty: string;
}) {
  const columns = [...jobColumns(view), "操作"];
  const action = (job: AutomationJob) => {
    const canRun =
      isRecognitionJob(job) &&
      ["待执行", "异常"].includes(statusLabel(job.status));
    if (view === "recognition") {
      if (canRun)
        return (
          <button
            type="button"
            disabled={busyId === job.id || !providerConfigured}
            onClick={() => onRun(job)}
            className={linkButtonClass()}
            title={providerConfigured ? "发送所选文件进行识别" : "请先配置识别服务"}
          >
            执行识别
          </button>
        );
      return canReviewAutomationJob(job) ? (
        <button
          type="button"
          disabled={busyId === job.id}
          onClick={() => onReview(job)}
          className={linkButtonClass()}
        >
          人工复核
        </button>
      ) : (
        <span className="text-slate-400 dark:text-slate-500">已复核</span>
      );
    }
    if (view === "suggestions") {
      if (job.generatedVoucherId)
        return (
          <button
            type="button"
            onClick={() => onOpenVoucher(job)}
            className={linkButtonClass()}
          >
            查看凭证
          </button>
        );
      return ["已确认", "已完成"].includes(statusLabel(job.status)) ? (
        <span className="text-slate-400 dark:text-slate-500">待草稿复核</span>
      ) : (
        <button
          type="button"
          disabled={busyId === job.id}
          onClick={() => onConfirm(job)}
          className={linkButtonClass()}
        >
          确认建议
        </button>
      );
    }
    if (canRun)
      return (
        <button
          type="button"
          disabled={busyId === job.id || !providerConfigured}
          onClick={() => onRun(job)}
          className={linkButtonClass()}
          title={providerConfigured ? "发送所选文件进行识别" : "请先配置识别服务"}
        >
          执行识别
        </button>
      );
    return (
      <span className="text-slate-500 dark:text-slate-400">
        {statusLabel(job.status) === "待复核" ? "进入对应复核台" : "记录已保留"}
      </span>
    );
  };
  const cells = (job: AutomationJob) => jobValues(view, job);
  return (
    <section>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">
          {viewDefinitions[view].title}清单
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          人工复核留痕
        </span>
      </div>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  className={`px-3 py-3 font-medium ${index === columns.length - 1 ? "w-28 text-right" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {cells(job).map((value, index) => (
                  <td
                    key={`${job.id}-${columns[index]}`}
                    className="truncate px-3 py-3"
                    title={value}
                  >
                    {(index === 2 && view !== "suggestions") ||
                    (index === 5 && view === "suggestions") ? (
                      <span
                        className={`inline-flex border px-1.5 py-0.5 text-xs ${statusClass(job.status)}`}
                      >
                        {value}
                      </span>
                    ) : (
                      value
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">{action(job)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <EmptyState message={empty} />}
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {jobs.map((job) => (
          <article
            key={job.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  title={cells(job)[0]}
                >
                  {cells(job)[0]}
                </p>
                <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                  {cells(job)[1]}
                </p>
              </div>
              <span
                className={`shrink-0 border px-1.5 py-0.5 text-xs ${statusClass(job.status)}`}
              >
                {statusLabel(job.status)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {columns.slice(2, -1).map((column, index) => (
                <Info
                  key={column}
                  label={column}
                  value={cells(job)[index + 2] || "-"}
                />
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 text-right dark:border-slate-800">
              {action(job)}
            </div>
          </article>
        ))}
        {jobs.length === 0 && <EmptyState message={empty} />}
      </div>
    </section>
  );
}

export function AiRuleTrainingWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? "" : "browser-preview-company");
  const rules = useMatchingRuleStore((state) => state.rules);
  const loading = useMatchingRuleStore((state) => state.isLoading);
  const error = useMatchingRuleStore((state) => state.error);
  const fetchMatchingRules = useMatchingRuleStore(
    (state) => state.fetchMatchingRules,
  );
  const createMatchingRule = useMatchingRuleStore(
    (state) => state.createMatchingRule,
  );
  const updateMatchingRule = useMatchingRuleStore(
    (state) => state.updateMatchingRule,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [previewRules, setPreviewRules] = useState<MatchingRule[]>([]);
  const [editor, setEditor] = useState<MatchingRule | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    if (!isTauri) {
      setPreviewRules(loadPreviewAiTrainingRules(companyId));
      return;
    }
    await fetchMatchingRules(companyId, "ai_training");
  }, [companyId, fetchMatchingRules]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const aiRules = useMemo(
    () =>
      (isTauri ? rules : previewRules).filter(
        (rule) => rule.rule_scope === "ai_training",
      ),
    [previewRules, rules],
  );
  const filteredRules = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return aiRules;
    return aiRules.filter((rule) =>
      [
        rule.name,
        rule.condition_text,
        rule.action_text,
        rule.target_account_code || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [aiRules, keyword]);
  const rulePage = useMemo(
    () => paginateOperationalRows(filteredRules, page, pageSize),
    [filteredRules, page, pageSize],
  );
  const exportHeaders = [
    "优先级",
    "规则名称",
    "训练条件",
    "目标动作",
    "目标科目",
    "命中次数",
    "状态",
    "更新时间",
  ];
  const exportRows = useMemo(
    () =>
      filteredRules.map((rule) => [
        String(rule.priority),
        rule.name,
        rule.condition_text,
        rule.action_text,
        rule.target_account_code || "待补",
        String(rule.hit_count),
        rule.is_enabled === 1 ? "启用" : "停用",
        formatDateTime(rule.updated_at),
      ]),
    [filteredRules],
  );
  const metrics = useMemo(
    () => ({
      total: aiRules.length,
      enabled: aiRules.filter((rule) => rule.is_enabled === 1).length,
      hit: aiRules.reduce((sum, rule) => sum + rule.hit_count, 0),
      pending: aiRules.filter((rule) => rule.is_enabled !== 1).length,
    }),
    [aiRules],
  );
  const openCreate = () => {
    setEditor(null);
    setDraft({
      ...emptyRuleDraft(),
      priority: String(
        Math.max(0, ...aiRules.map((rule) => rule.priority)) + 10,
      ),
    });
  };
  const openEdit = (rule: MatchingRule) => {
    setEditor(rule);
    setDraft({
      name: rule.name,
      conditionText: rule.condition_text,
      actionText: rule.action_text,
      targetAccountCode: rule.target_account_code || "",
      priority: String(rule.priority),
      enabled: rule.is_enabled === 1,
    });
  };
  const saveRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) return;
    const name = draft.name.trim();
    const conditionText = draft.conditionText.trim();
    const actionText = draft.actionText.trim();
    const priority = Number(draft.priority);
    if (
      !name ||
      !conditionText ||
      !actionText ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 9999
    ) {
      setNotice(
        "请填写名称、训练条件、目标动作，以及 0 至 9999 的整数优先级。",
      );
      return;
    }
    const input: MatchingRuleInput = {
      companyId,
      ruleScope: "ai_training",
      name,
      conditionText,
      actionText,
      targetAccountCode: draft.targetAccountCode.trim() || undefined,
      priority,
      isEnabled: draft.enabled,
    };
    setSaving(true);
    try {
      if (!isTauri) {
        const timestamp = new Date().toISOString();
        const record: MatchingRule = {
          id: editor?.id || `preview-ai-training-${crypto.randomUUID()}`,
          company_id: companyId,
          rule_scope: "ai_training",
          name,
          condition_text: conditionText,
          action_text: actionText,
          target_account_code: input.targetAccountCode || null,
          voucher_template_id: null,
          source_account_code: null,
          cash_direction: null,
          cash_flow_item_code: null,
          summary_keyword: null,
          priority,
          is_enabled: draft.enabled ? 1 : 0,
          hit_count: editor?.hit_count || 0,
          created_at: editor?.created_at || timestamp,
          updated_at: timestamp,
        };
        savePreviewAiTrainingRules(
          companyId,
          editor
            ? aiRules.map((rule) => (rule.id === record.id ? record : rule))
            : [...aiRules, record],
        );
        await refresh();
      } else if (editor) await updateMatchingRule(editor.id, input);
      else await createMatchingRule(input);
      setEditor(undefined);
      setNotice(
        `训练规则“${name}”已${editor ? "更新" : "保存"}；仅影响后续 AI 候选，不会自动生成或入账凭证。`,
      );
    } catch (saveError) {
      setNotice(`保存训练规则失败：${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  };
  const toggleRule = async (rule: MatchingRule) => {
    if (!companyId) return;
    const enabled = rule.is_enabled !== 1;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认${enabled ? "启用" : "停用"}训练规则“${rule.name}”吗？`,
      )
    )
      return;
    try {
      if (!isTauri) {
        savePreviewAiTrainingRules(
          companyId,
          aiRules.map((item) =>
            item.id === rule.id
              ? {
                  ...item,
                  is_enabled: enabled ? 1 : 0,
                  updated_at: new Date().toISOString(),
                }
              : item,
          ),
        );
        await refresh();
      } else {
        await updateMatchingRule(rule.id, {
          companyId,
          ruleScope: "ai_training",
          name: rule.name,
          conditionText: rule.condition_text,
          actionText: rule.action_text,
          targetAccountCode: rule.target_account_code || undefined,
          voucherTemplateId: rule.voucher_template_id || undefined,
          priority: rule.priority,
          isEnabled: enabled,
        });
      }
      setNotice(`训练规则“${rule.name}”已${enabled ? "启用" : "停用"}。`);
    } catch (updateError) {
      setNotice(`更新训练规则失败：${String(updateError)}`);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section data-operational-export-root className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">AI 规则训练</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              维护训练条件、目标动作、优先级和启用状态，记录规则命中，不替代人工审核。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="AI 训练规则清单"
              companyName={selectedCompany?.name}
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className={secondaryButtonClass()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={!companyId}
              className={primaryButtonClass()}
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增规则
            </button>
          </div>
        </header>
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs leading-5 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
          训练规则只影响后续 AI
          候选的优先级与待复核提示；不会改写历史凭证、提交税务或自动入账。
        </div>
        {notice && <Notice value={notice} />}
        {isTauri && error && (
          <Notice value={`读取规则失败：${error}`} tone="error" />
        )}
        {!companyId ? (
          <EmptyState message="请选择账套后维护 AI 训练规则。" />
        ) : (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                label="规则数量"
                value={`${metrics.total} 条`}
                icon={BrainCircuit}
                tone="sky"
              />
              <Metric
                label="已启用"
                value={`${metrics.enabled} 条`}
                icon={ShieldCheck}
                tone={metrics.enabled ? "emerald" : "slate"}
              />
              <Metric
                label="累计命中"
                value={`${metrics.hit} 次`}
                icon={CheckCheck}
                tone="sky"
              />
              <Metric
                label="待发布"
                value={`${metrics.pending} 条`}
                icon={CircleAlert}
                tone={metrics.pending ? "amber" : "slate"}
              />
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                按优先级控制后续候选，所有命中仍需人工复核。
              </p>
              <label className="flex h-8 w-full items-center gap-2 border border-slate-300 px-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:w-80">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索规则、条件、动作或目标科目"
                  className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </label>
            </div>
            {loading && isTauri ? (
              <EmptyState message="正在读取 AI 训练规则..." />
            ) : (
              <AiRuleTable
                rules={rulePage.rows}
                onEdit={openEdit}
                onToggle={toggleRule}
              />
            )}
            <OperationalPagination
              page={rulePage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {editor !== undefined && (
        <AiRuleEditor
          draft={draft}
          editing={Boolean(editor)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditor(undefined)}
          onSubmit={saveRule}
        />
      )}
    </main>
  );
}

function AiRuleTable({
  rules,
  onEdit,
  onToggle,
}: {
  rules: MatchingRule[];
  onEdit: (rule: MatchingRule) => void;
  onToggle: (rule: MatchingRule) => void;
}) {
  return (
    <section>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[8%] px-3 py-3 font-medium">优先级</th>
              <th className="w-[17%] px-3 py-3 font-medium">规则名称</th>
              <th className="w-[25%] px-3 py-3 font-medium">训练条件</th>
              <th className="w-[22%] px-3 py-3 font-medium">目标动作</th>
              <th className="w-[12%] px-3 py-3 font-medium">目标科目</th>
              <th className="w-[6%] px-3 py-3 text-right font-medium">命中</th>
              <th className="w-[10%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-3 tabular-nums">{rule.priority}</td>
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
                  title={rule.target_account_code || undefined}
                >
                  {rule.target_account_code || "待补"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {rule.hit_count}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    className={linkButtonClass()}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(rule)}
                    className="ml-3 text-xs text-slate-600 hover:underline dark:text-slate-300"
                  >
                    {rule.is_enabled === 1 ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <EmptyState message="暂无 AI 训练规则。新增规则后只作用于后续候选和人工复核提示。" />
        )}
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{rule.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  优先级 {rule.priority} · 命中 {rule.hit_count} 次
                </p>
              </div>
              <span
                className={`border px-1.5 py-0.5 text-xs ${rule.is_enabled === 1 ? statusClass("confirmed") : statusClass("queued")}`}
              >
                {rule.is_enabled === 1 ? "已启用" : "已停用"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Info label="训练条件" value={rule.condition_text} />
              <Info label="目标动作" value={rule.action_text} />
              <Info
                label="目标科目"
                value={rule.target_account_code || "待补"}
              />
              <Info label="更新时间" value={formatDateTime(rule.updated_at)} />
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 text-right dark:border-slate-800">
              <button
                type="button"
                onClick={() => onEdit(rule)}
                className={linkButtonClass()}
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onToggle(rule)}
                className="ml-3 text-xs text-slate-600 hover:underline dark:text-slate-300"
              >
                {rule.is_enabled === 1 ? "停用" : "启用"}
              </button>
            </div>
          </article>
        ))}
        {rules.length === 0 && <EmptyState message="暂无 AI 训练规则。" />}
      </div>
    </section>
  );
}

function JobEditor({
  view,
  draft,
  busy,
  accounts,
  onChange,
  onSelectSourceFile,
  onClose,
  onSubmit,
}: {
  view: AiOperationView;
  draft: JobDraft;
  busy: boolean;
  accounts: Array<{ code: string; name: string }>;
  onChange: (draft: JobDraft) => void;
  onSelectSourceFile: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const isSuggestion = view === "suggestions";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-3 sm:items-center sm:justify-center"
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
        role="dialog"
        aria-modal="true"
        aria-label={isSuggestion ? "新增 AI 凭证建议" : "新建 AI 任务"}
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            {isSuggestion ? "新增 AI 凭证建议" : "新建 AI 任务"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            仅登记当前账套的真实来源资料，后续必须人工复核。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {!isSuggestion && (
            <Field label="任务类型">
              <select
                value={draft.jobType}
                onChange={(event) =>
                  onChange({ ...draft, jobType: event.target.value })
                }
                className={inputClass()}
              >
                <option value="invoice_recognition">发票识别</option>
                <option value="document_ocr">资料 OCR</option>
                <option value="classification">资料分类</option>
              </select>
            </Field>
          )}
          <Field label="来源模块">
            <input
              required
              value={draft.sourceModule}
              onChange={(event) =>
                onChange({ ...draft, sourceModule: event.target.value })
              }
              placeholder={isSuggestion ? "如：进项发票" : "如：附件中心"}
              className={inputClass()}
            />
          </Field>
          <Field label="来源文件">
            <div className="flex gap-2">
              <input
                value={draft.sourceFile}
                onChange={(event) =>
                  onChange({ ...draft, sourceFile: event.target.value })
                }
                placeholder="桌面端选择 PDF 或图片"
                className={`${inputClass()} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={onSelectSourceFile}
                className={`${secondaryButtonClass()} shrink-0`}
                title="选择识别来源文件"
              >
                <FileUp className="h-3.5 w-3.5" />
                选择
              </button>
            </div>
          </Field>
          <Field label="风险级别">
            <select
              value={draft.riskLevel}
              onChange={(event) =>
                onChange({ ...draft, riskLevel: event.target.value })
              }
              className={inputClass()}
            >
              <option value="normal">普通</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </Field>
          {isSuggestion && (
            <>
              <Field label="借方科目">
                <select
                  required
                  value={draft.debitAccountCode}
                  onChange={(event) =>
                    onChange({ ...draft, debitAccountCode: event.target.value })
                  }
                  className={inputClass()}
                >
                  <option value="">请选择明细科目</option>
                  {accounts.map((account) => (
                    <option key={`debit-${account.code}`} value={account.code}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="贷方科目">
                <select
                  required
                  value={draft.creditAccountCode}
                  onChange={(event) =>
                    onChange({ ...draft, creditAccountCode: event.target.value })
                  }
                  className={inputClass()}
                >
                  <option value="">请选择明细科目</option>
                  {accounts.map((account) => (
                    <option key={`credit-${account.code}`} value={account.code}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="建议金额">
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={draft.suggestionAmount}
                  onChange={(event) =>
                    onChange({ ...draft, suggestionAmount: event.target.value })
                  }
                  className={inputClass()}
                />
              </Field>
            </>
          )}
          <Field
            label={isSuggestion ? "建议摘要" : "处理说明"}
            className="sm:col-span-2"
          >
            <textarea
              value={draft.summary}
              onChange={(event) =>
                onChange({ ...draft, summary: event.target.value })
              }
              placeholder={
                isSuggestion
                  ? "说明建议的业务来源和人工核验要点"
                  : "说明需要识别或分类的资料内容"
              }
              className={`${inputClass()} h-20 py-2`}
            />
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass()}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className={primaryButtonClass()}
          >
            {busy ? "保存中..." : isSuggestion ? "保存建议" : "保存任务"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ProviderEditor({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ProviderDraft;
  busy: boolean;
  onChange: (draft: ProviderDraft) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-3 sm:items-center sm:justify-center"
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
        role="dialog"
        aria-modal="true"
        aria-label="识别服务设置"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">识别服务设置</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            服务需实现通用 JSON 识别协议。这里只保存环境变量名，密钥本身不得录入或写入数据库。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="服务名称">
            <input
              required
              maxLength={100}
              value={draft.providerName}
              onChange={(event) =>
                onChange({ ...draft, providerName: event.target.value })
              }
              placeholder="如：机构 OCR 网关"
              className={inputClass()}
            />
          </Field>
          <Field label="模型或版本">
            <input
              required
              maxLength={200}
              value={draft.model}
              onChange={(event) =>
                onChange({ ...draft, model: event.target.value })
              }
              placeholder="由识别服务提供"
              className={inputClass()}
            />
          </Field>
          <Field label="HTTPS 接口地址" className="sm:col-span-2">
            <input
              required
              type="url"
              value={draft.endpoint}
              onChange={(event) =>
                onChange({ ...draft, endpoint: event.target.value })
              }
              placeholder="https://provider.example.com/v1/accounting/recognize"
              className={inputClass()}
            />
          </Field>
          <Field label="凭据环境变量">
            <input
              required
              pattern="[A-Z0-9_]+"
              value={draft.credentialEnv}
              onChange={(event) =>
                onChange({
                  ...draft,
                  credentialEnv: event.target.value.toUpperCase(),
                })
              }
              placeholder="ACCOUNTING_OCR_API_KEY"
              className={inputClass()}
            />
          </Field>
          <Field label="请求超时（秒）">
            <input
              required
              type="number"
              min="5"
              max="120"
              value={draft.timeoutSeconds}
              onChange={(event) =>
                onChange({ ...draft, timeoutSeconds: event.target.value })
              }
              className={inputClass()}
            />
          </Field>
          <Field label="单文件上限（MB）">
            <input
              required
              type="number"
              min="1"
              max="20"
              step="1"
              value={draft.maxFileMb}
              onChange={(event) =>
                onChange({ ...draft, maxFileMb: event.target.value })
              }
              className={inputClass()}
            />
          </Field>
          <label className="flex h-8 items-center gap-2 self-end text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                onChange({ ...draft, enabled: event.target.checked })
              }
            />
            启用该识别服务
          </label>
        </div>
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
          系统拒绝 HTTP、localhost、回环和私网目标；每次外发仍需操作人单独确认。
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass()}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className={primaryButtonClass()}
          >
            {busy ? "保存中..." : "保存设置"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function AiRuleEditor({
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
  onChange: (draft: RuleDraft) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-3 sm:items-center sm:justify-center"
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "编辑 AI 训练规则" : "新增 AI 训练规则"}
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            {editing ? "编辑 AI 训练规则" : "新增 AI 训练规则"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            规则仅影响后续候选；命中后仍需要人工复核。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="规则名称">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              className={inputClass()}
            />
          </Field>
          <Field label="优先级">
            <input
              required
              type="number"
              min="0"
              max="9999"
              value={draft.priority}
              onChange={(event) =>
                onChange({ ...draft, priority: event.target.value })
              }
              className={inputClass()}
            />
          </Field>
          <Field label="训练条件" className="sm:col-span-2">
            <textarea
              required
              value={draft.conditionText}
              onChange={(event) =>
                onChange({ ...draft, conditionText: event.target.value })
              }
              placeholder="如：来源为进项发票且税率为 13%"
              className={`${inputClass()} h-20 py-2`}
            />
          </Field>
          <Field label="目标动作" className="sm:col-span-2">
            <textarea
              required
              value={draft.actionText}
              onChange={(event) =>
                onChange({ ...draft, actionText: event.target.value })
              }
              placeholder="如：生成待复核的进项税额凭证建议"
              className={`${inputClass()} h-20 py-2`}
            />
          </Field>
          <Field label="目标科目">
            <input
              value={draft.targetAccountCode}
              onChange={(event) =>
                onChange({ ...draft, targetAccountCode: event.target.value })
              }
              placeholder="可选，如：222101"
              className={inputClass()}
            />
          </Field>
          <label className="flex h-8 items-center gap-2 self-end text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                onChange({ ...draft, enabled: event.target.checked })
              }
            />
            保存后启用
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass()}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClass()}
          >
            {saving ? "保存中..." : "保存规则"}
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
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: MetricTone;
}) {
  const color = {
    sky: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    slate: "text-slate-700 dark:text-slate-200",
  }[tone];
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
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
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}
function Notice({
  value,
  tone = "notice",
}: {
  value: string;
  tone?: "notice" | "error";
}) {
  return (
    <div
      className={`border-b px-4 py-2 text-xs leading-5 ${tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200"}`}
    >
      {value}
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
function emptyJobDraft(view: AiOperationView): JobDraft {
  return {
    jobType: view === "queue" ? "invoice_recognition" : "voucher_suggestion",
    sourceModule: "",
    sourceFile: "",
    summary: "",
    riskLevel: "normal",
    debitAccountCode: "",
    creditAccountCode: "",
    suggestionAmount: "",
  };
}
function emptyProviderDraft(): ProviderDraft {
  return {
    providerName: "",
    endpoint: "",
    model: "",
    credentialEnv: "ACCOUNTING_OCR_API_KEY",
    timeoutSeconds: "30",
    maxFileMb: "8",
    enabled: true,
  };
}
function displayFileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
function emptyRuleDraft(): RuleDraft {
  return {
    name: "",
    conditionText: "",
    actionText: "生成待人工复核的候选建议",
    targetAccountCode: "",
    priority: "10",
    enabled: true,
  };
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function primaryButtonClass() {
  return "inline-flex h-8 items-center justify-center gap-1.5 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60";
}
function secondaryButtonClass() {
  return "inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";
}
function linkButtonClass() {
  return "text-xs text-[#1f65a7] hover:underline disabled:opacity-60 dark:text-sky-400";
}
