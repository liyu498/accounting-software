import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  CloudDownload,
  FilePlus2,
  FilePenLine,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  automationApi,
  bankTransactionApi,
  type BankTransaction,
  type ExternalBankSyncItem,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type BankScope = "all" | "income" | "expense" | "unmatched";
type BankDraft = {
  accountName: string;
  serialNo: string;
  transactionDate: string;
  counterparty: string;
  summary: string;
  incomeAmount: string;
  expenseAmount: string;
  balance: string;
  receiptStatus: string;
};

const emptyDraft: BankDraft = {
  accountName: "",
  serialNo: "",
  transactionDate: "",
  counterparty: "",
  summary: "",
  incomeAmount: "",
  expenseAmount: "",
  balance: "",
  receiptStatus: "待上传",
};

const scopes: Array<{ id: BankScope; label: string }> = [
  { id: "all", label: "本期流水" },
  { id: "income", label: "收入流水" },
  { id: "expense", label: "支出流水" },
  { id: "unmatched", label: "待匹配" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function recordStatus(record: BankTransaction) {
  if (record.voucherId || record.status === "已生成凭证") return "已生成凭证";
  if (record.matchResult) return "已匹配";
  return "待匹配";
}

function statusClass(status: string) {
  if (status === "已生成凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "已匹配")
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function draftFromRecord(record: BankTransaction): BankDraft {
  return {
    accountName: record.accountName,
    serialNo: record.serialNo,
    transactionDate: record.transactionDate,
    counterparty: record.counterparty || "",
    summary: record.summary || "",
    incomeAmount: record.incomeAmount ? String(record.incomeAmount) : "",
    expenseAmount: record.expenseAmount ? String(record.expenseAmount) : "",
    balance: record.balance === null ? "" : String(record.balance),
    receiptStatus: record.receiptStatus || "待上传",
  };
}

export function BankStatementWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId = selectedCompanyId || (isTauri ? null : 'browser-preview-company')
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
  const [records, setRecords] = useState<BankTransaction[]>([]);
  const [scope, setScope] = useState<BankScope>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<BankTransaction | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<BankDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [stagedBankItems, setStagedBankItems] = useState<ExternalBankSyncItem[]>([]);
  const [showStagedBankItems, setShowStagedBankItems] = useState(false);
  const [bankSyncCursor, setBankSyncCursor] = useState<string | undefined>();
  const [syncingBank, setSyncingBank] = useState(false);

  useEffect(() => {
    if (companyId) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);

  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await bankTransactionApi.getBankTransactions({
      companyId,
      period,
    });
    if (result.success) {
      setRecords(result.data || []);
      setNotice(null);
    } else {
      setNotice(`读取银行流水失败：${result.error || "未知错误"}`);
    }
    setLoading(false);
  }, [companyId, period]);

  const refreshStagedBankItems = useCallback(async () => {
    if (!companyId) {
      setStagedBankItems([]);
      return;
    }
    const result = await automationApi.getExternalBankSyncItems({
      companyId,
      reviewStatus: "pending_review",
    });
    if (result.success) setStagedBankItems(result.data || []);
    else setNotice(`读取银行待复核流水失败：${result.error || "未知错误"}`);
  }, [companyId]);

  useEffect(() => {
    void refresh();
    void refreshStagedBankItems();
  }, [refresh, refreshStagedBankItems]);

  const syncBankStatement = async () => {
    if (!companyId || !period) {
      setNotice("请先选择账套和开放账期，再同步银行流水。");
      return;
    }
    if (!isTauri) {
      setNotice("真实银行流水同步仅支持桌面版；浏览器预览不会连接网银、生成流水或发起付款。");
      return;
    }
    const authorizations = await automationApi.getAdapterAuthorizations({
      companyId,
      adapterType: "bank",
    });
    const authorization = authorizations.success
      ? authorizations.data?.find(
          (item) =>
            item.authStatus === "authorized" &&
            /bank_statement_sync|bank|流水|银行/i.test(item.capabilityScope || ""),
        )
      : undefined;
    if (!authorization) {
      setNotice("没有已验证且具备流水同步能力的银行渠道，请先到“设置 > 授权中心”配置并验证。");
      return;
    }
    const confirmed = window.confirm(
      `确认通过已验证渠道“${authorization.adapterCode}”同步 ${period} 银行流水？外部数据只进入待复核区，不会直接生成正式流水、凭证或发起付款。`,
    );
    if (!confirmed) return;
    setSyncingBank(true);
    const result = await automationApi.syncExternalBankStatement({
      companyId,
      authorizationId: authorization.id,
      period,
      sourceCursor: bankSyncCursor,
      syncConfirmed: true,
    });
    setSyncingBank(false);
    if (!result.success || !result.data) {
      setNotice(`同步银行流水失败：${result.error || "未知错误"}`);
      return;
    }
    setBankSyncCursor(result.data.nextCursor || undefined);
    setShowStagedBankItems(true);
    setNotice(
      `银行流水同步完成：待复核 ${result.data.stagedCount} 笔，重复 ${result.data.duplicateCount} 笔；未生成凭证或发起付款。`,
    );
    await refreshStagedBankItems();
  };

  const reviewStagedBankItem = async (
    item: ExternalBankSyncItem,
    action: "import" | "reject",
  ) => {
    if (!companyId) return;
    const confirmed = window.confirm(
      action === "import"
        ? `确认将 ${item.transactionDate} 的 ${item.direction === "income" ? "收入" : "支出"} ${formatCurrency(item.amount)} 导入本地流水？不会自动生成凭证或发起付款。`
        : `确认驳回外部流水 ${item.externalTransactionId}？`,
    );
    if (!confirmed) return;
    const result =
      action === "import"
        ? await automationApi.importExternalBankSyncItem({
            companyId,
            itemId: item.id,
            reviewConfirmed: true,
            reviewNote: "银行流水工作台人工复核导入",
          })
        : await automationApi.rejectExternalBankSyncItem({
            companyId,
            itemId: item.id,
            reviewConfirmed: true,
            reviewNote: "银行流水工作台人工复核驳回",
          });
    if (!result.success) {
      setNotice(`${action === "import" ? "导入" : "驳回"}银行流水失败：${result.error || "未知错误"}`);
      return;
    }
    setNotice(
      action === "import"
        ? `外部流水 ${item.externalTransactionId} 已导入待处理台账；未生成凭证或发起付款。`
        : `外部流水 ${item.externalTransactionId} 已驳回并留痕。`,
    );
    await Promise.all([refresh(), refreshStagedBankItems()]);
  };

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const inScope =
        scope === "all" ||
        (scope === "income" && record.incomeAmount > 0) ||
        (scope === "expense" && record.expenseAmount > 0) ||
        (scope === "unmatched" && !record.matchResult);
      const content = [
        record.serialNo,
        record.accountName,
        record.counterparty,
        record.summary,
        record.matchResult,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inScope && (!normalizedKeyword || content.includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const pagination = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );

  const metrics = useMemo(
    () => ({
      income: records.reduce((total, record) => total + record.incomeAmount, 0),
      expense: records.reduce(
        (total, record) => total + record.expenseAmount,
        0,
      ),
      unmatched: records.filter((record) => !record.matchResult).length,
      missingReceipt: records.filter(
        (record) => !record.receiptStatus || record.receiptStatus === "待上传",
      ).length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditingRecord(null);
    setDraft(emptyDraft);
    setShowEditor(true);
  };

  const openEdit = (record: BankTransaction) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账期，再维护银行流水。");
      return;
    }
    const incomeAmount = Number(draft.incomeAmount || 0);
    const expenseAmount = Number(draft.expenseAmount || 0);
    const balance =
      draft.balance.trim() === "" ? undefined : Number(draft.balance);
    if (
      !draft.accountName.trim() ||
      !draft.serialNo.trim() ||
      !draft.transactionDate ||
      !Number.isFinite(incomeAmount) ||
      !Number.isFinite(expenseAmount) ||
      incomeAmount < 0 ||
      expenseAmount < 0 ||
      (incomeAmount <= 0 && expenseAmount <= 0) ||
      (incomeAmount > 0 && expenseAmount > 0) ||
      (balance !== undefined && (!Number.isFinite(balance) || balance < 0))
    ) {
      setNotice(
        "请填写账户、流水号、日期和一项有效收支金额；收入与支出只能选择一项。",
      );
      return;
    }

    setSaving(true);
    const input = {
      companyId,
      accountName: draft.accountName.trim(),
      serialNo: draft.serialNo.trim(),
      transactionDate: draft.transactionDate,
      counterparty: draft.counterparty.trim() || undefined,
      summary: draft.summary.trim() || undefined,
      incomeAmount,
      expenseAmount,
      balance,
      receiptStatus: draft.receiptStatus,
    };
    const result = editingRecord
      ? await bankTransactionApi.updateBankTransaction({
          ...input,
          id: editingRecord.id,
        })
      : await bankTransactionApi.createBankTransaction({ ...input, period });
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}银行流水失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "银行流水已更新。"
        : "银行流水已登记，待匹配凭证或建立对账记录。",
    );
    await refresh();
  };

  const actions = (record: BankTransaction) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            record.voucherId
              ? `/vouchers/detail/${record.voucherId}`
              : buildVoucherSourcePath({
                  kind: "bank_transaction",
                  id: record.id,
                }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        onClick={() => navigate("/bank/reconciliation")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Waypoints className="h-3.5 w-3.5" />
        建立对账
      </button>
      <button
        type="button"
        disabled={Boolean(record.voucherId) || record.status === "已生成凭证"}
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
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">银行流水与对账准备</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按当前账期维护收支流水、回单和凭证匹配状态；仅管理本地记录，不登录或调用银行外部系统。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void syncBankStatement()}
              disabled={syncingBank}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <CloudDownload className="h-3.5 w-3.5" />
              {syncingBank ? "同步中..." : bankSyncCursor ? "继续同步银行流水" : "同步银行流水"}
            </button>
            <button
              type="button"
              onClick={() => setShowStagedBankItems((value) => !value)}
              className="inline-flex h-8 items-center gap-1 border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              银行待复核 {stagedBankItems.length}
            </button>
            <OperationalExportActions
              title="银行流水清单"
              companyName={selectedCompany?.name}
              periodLabel={period || undefined}
              exportHeaders={[
                "交易日期",
                "流水号",
                "账户",
                "对方",
                "摘要",
                "收入",
                "支出",
                "回单",
                "匹配状态",
              ]}
              exportRows={filteredRecords.map((record) => [
                record.transactionDate,
                record.serialNo,
                record.accountName,
                record.counterparty || "待补对方",
                record.summary || "未填写摘要",
                record.incomeAmount ? formatCurrency(record.incomeAmount) : "-",
                record.expenseAmount ? formatCurrency(record.expenseAmount) : "-",
                record.receiptStatus || "待上传",
                recordStatus(record),
              ])}
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
              onClick={openCreate}
              disabled={!companyId || !period}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              登记流水
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            label="本期收入"
            value={formatCurrency(metrics.income)}
            icon={ArrowDownLeft}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="本期支出"
            value={formatCurrency(metrics.expense)}
            icon={ArrowUpRight}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            label="待匹配"
            value={`${metrics.unmatched} 笔`}
            icon={Waypoints}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            label="待补回单"
            value={`${metrics.missingReceipt} 笔`}
            icon={ReceiptText}
            tone={
              metrics.missingReceipt
                ? "text-rose-600 dark:text-rose-400"
                : undefined
            }
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
              placeholder="搜索流水号、账户、对方或摘要"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {showStagedBankItems && (
          <section
            className="border-b border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/70 dark:bg-amber-950/10"
            aria-label="银行待复核流水"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">银行待复核</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  逐笔核对账号、日期、方向、金额和交易参考后再导入；导入后仍为待处理流水。
                </p>
              </div>
              <button type="button" onClick={() => setShowStagedBankItems(false)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">收起</button>
            </div>
            {stagedBankItems.length === 0 ? (
              <p className="border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">当前没有待复核的银行流水。</p>
            ) : (
              <div className="grid gap-2 xl:grid-cols-2">
                {stagedBankItems.map((item) => (
                  <article key={item.id} className="border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-[#111827]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{item.transactionDate} · {item.direction === "income" ? "收入" : "支出"} · {formatCurrency(item.amount)}</p>
                        <p className="mt-1 truncate text-slate-500 dark:text-slate-400">{item.accountMask} · {item.counterpartyName || "未返回对方名称"}</p>
                        <p className="mt-1 truncate text-slate-500 dark:text-slate-400">{item.bankReference || item.externalTransactionId} · {item.summary || "无摘要"}</p>
                      </div>
                      <span className="shrink-0 border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">待复核</span>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => void reviewStagedBankItem(item, "reject")} className="h-7 border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">驳回</button>
                      <button type="button" onClick={() => void reviewStagedBankItem(item, "import")} className="h-7 bg-[#1f65a7] px-2 text-xs font-medium text-white hover:bg-[#174f82]">复核并导入</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护银行流水。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期银行流水。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取银行流水..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">交易日期</th>
                    <th className="px-4 py-3 font-medium">流水号</th>
                    <th className="px-4 py-3 font-medium">账户/对方</th>
                    <th className="px-4 py-3 font-medium">摘要</th>
                    <th className="px-4 py-3 text-right font-medium">收入</th>
                    <th className="px-4 py-3 text-right font-medium">支出</th>
                    <th className="px-4 py-3 font-medium">回单</th>
                    <th className="px-4 py-3 font-medium">匹配状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagination.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {record.transactionDate}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">
                        {record.serialNo}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{record.accountName}</p>
                        <p className="mt-0.5 max-w-48 truncate text-slate-500 dark:text-slate-400">
                          {record.counterparty || "待补对方"}
                        </p>
                      </td>
                      <td className="max-w-56 truncate px-4 py-3">
                        {record.summary || "未填写摘要"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {record.incomeAmount
                          ? formatCurrency(record.incomeAmount)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                        {record.expenseAmount
                          ? formatCurrency(record.expenseAmount)
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {record.receiptStatus || "待上传"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(recordStatus(record))}`}
                        >
                          {recordStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{actions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {pagination.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {record.serialNo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.accountName} · {record.transactionDate}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(recordStatus(record))}`}
                    >
                      {recordStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="对方" value={record.counterparty || "待补"} />
                    <Info
                      label="回单"
                      value={record.receiptStatus || "待上传"}
                    />
                    <Info
                      label="收入"
                      value={
                        record.incomeAmount
                          ? formatCurrency(record.incomeAmount)
                          : "-"
                      }
                    />
                    <Info
                      label="支出"
                      value={
                        record.expenseAmount
                          ? formatCurrency(record.expenseAmount)
                          : "-"
                      }
                    />
                  </div>
                  <div className="mt-3">{actions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有银行流水。" />
            )}
            <OperationalPagination
              page={pagination}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <QuickLink
          icon={Waypoints}
          title="银行对账"
          description="将银行流水与账面金额、凭证号和未达账项逐笔核对。"
          onClick={() => navigate("/bank/reconciliation")}
        />
        <QuickLink
          icon={FilePenLine}
          title="凭证处理"
          description="匹配完成后人工确认分录和凭证，已生成凭证的流水不允许再直接修改。"
          onClick={() => navigate("/vouchers/new")}
        />
      </section>
      {showEditor && (
        <BankTransactionEditor
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
  label,
  value,
  icon: Icon,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
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
function QuickLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-200 bg-white p-3 text-left hover:border-[#1f65a7] dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-500"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}

function BankTransactionEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: BankDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: BankDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fields: Array<{
    key: keyof BankDraft;
    label: string;
    type?: string;
    required?: boolean;
    span?: boolean;
  }> = [
    { key: "accountName", label: "银行账户", required: true },
    { key: "serialNo", label: "流水号", required: true },
    { key: "transactionDate", label: "交易日期", type: "date", required: true },
    { key: "counterparty", label: "对方户名" },
    { key: "incomeAmount", label: "收入金额", type: "number" },
    { key: "expenseAmount", label: "支出金额", type: "number" },
    { key: "balance", label: "账户余额", type: "number" },
    { key: "receiptStatus", label: "回单状态" },
    { key: "summary", label: "交易摘要", span: true },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="银行流水编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑银行流水" : "登记银行流水"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              收入与支出只能填写一项；登记不会调用银行接口或下载回单。
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
          {fields.map((field) => (
            <label
              key={field.key}
              className={`grid gap-1 text-xs text-slate-600 dark:text-slate-300 ${field.span ? "sm:col-span-2" : ""}`}
            >
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                required={field.required}
                type={field.type || "text"}
                min={field.type === "number" ? "0" : undefined}
                step={field.type === "number" ? "0.01" : undefined}
                value={draft[field.key]}
                onChange={(event) =>
                  onChange({ ...draft, [field.key]: event.target.value })
                }
                className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
              />
            </label>
          ))}
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
            type="submit"
            disabled={saving}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : editing ? "保存修改" : "保存流水"}
          </button>
        </footer>
      </form>
    </div>
  );
}
