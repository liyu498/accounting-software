import {
  BadgeCheck,
  FilePenLine,
  Landmark,
  ListChecks,
  Plus,
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
  bankReconciliationApi,
  bankTransactionApi,
  type BankReconciliationRecord,
  type BankTransaction,
} from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type ReconciliationScope = "all" | "balanced" | "difference" | "pending";
type ReconciliationDraft = {
  reconciliationNo: string;
  reconciliationDate: string;
  bankTransactionId: string;
  accountName: string;
  transactionNo: string;
  summary: string;
  bankAmount: string;
  bookAmount: string;
  voucherNo: string;
  matchStatus: string;
  owner: string;
  status: string;
  note: string;
};

const emptyDraft: ReconciliationDraft = {
  reconciliationNo: "",
  reconciliationDate: "",
  bankTransactionId: "",
  accountName: "",
  transactionNo: "",
  summary: "",
  bankAmount: "",
  bookAmount: "",
  voucherNo: "",
  matchStatus: "待人工对账",
  owner: "",
  status: "待处理",
  note: "",
};

const scopes: Array<{ id: ReconciliationScope; label: string }> = [
  { id: "all", label: "对账清单" },
  { id: "balanced", label: "已平衡" },
  { id: "difference", label: "有差异" },
  { id: "pending", label: "待处理" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function reconciliationState(record: BankReconciliationRecord) {
  if (record.differenceAmount !== 0) return "有差异";
  if (record.voucherNo || record.status === "已完成") return "已平衡";
  return "待处理";
}

function statusClass(state: string) {
  if (state === "已平衡")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (state === "有差异")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function draftFromRecord(
  record: BankReconciliationRecord,
): ReconciliationDraft {
  return {
    reconciliationNo: record.reconciliationNo,
    reconciliationDate: record.reconciliationDate,
    bankTransactionId: record.bankTransactionId || "",
    accountName: record.accountName,
    transactionNo: record.transactionNo,
    summary: record.summary || "",
    bankAmount: String(record.bankAmount),
    bookAmount: String(record.bookAmount),
    voucherNo: record.voucherNo || "",
    matchStatus: record.matchStatus || "待人工对账",
    owner: record.owner || "",
    status: record.status || "待处理",
    note: record.note || "",
  };
}

export function BankReconciliationWorkspace() {
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
  const [records, setRecords] = useState<BankReconciliationRecord[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [scope, setScope] = useState<ReconciliationScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<BankReconciliationRecord | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<ReconciliationDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);

  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [reconciliationResult, transactionResult] = await Promise.all([
      bankReconciliationApi.getBankReconciliationRecords({ companyId, period }),
      bankTransactionApi.getBankTransactions({ companyId, period }),
    ]);
    if (reconciliationResult.success)
      setRecords(reconciliationResult.data || []);
    if (transactionResult.success)
      setTransactions(transactionResult.data || []);
    const errors = [
      !reconciliationResult.success && reconciliationResult.error,
      !transactionResult.success && transactionResult.error,
    ].filter(Boolean);
    setNotice(
      errors.length ? `读取银行对账资料失败：${errors.join("；")}` : null,
    );
    setLoading(false);
  }, [companyId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const state = reconciliationState(record);
      const inScope =
        scope === "all" ||
        (scope === "balanced" && state === "已平衡") ||
        (scope === "difference" && state === "有差异") ||
        (scope === "pending" && state === "待处理");
      const content = [
        record.reconciliationNo,
        record.accountName,
        record.transactionNo,
        record.summary,
        record.voucherNo,
        record.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inScope && (!normalizedKeyword || content.includes(normalizedKeyword))
      );
    });
  }, [keyword, records, scope]);
  const reconciliationPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "对账日期",
    "对账号",
    "流水号",
    "账户",
    "银行金额",
    "账面金额",
    "差异",
    "凭证",
    "负责人",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.reconciliationDate,
        record.reconciliationNo,
        record.transactionNo,
        record.accountName,
        formatCurrency(record.bankAmount),
        formatCurrency(record.bookAmount),
        formatCurrency(record.differenceAmount),
        record.voucherNo || "未关联",
        record.owner || "未分配",
        reconciliationState(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      balanced: records.filter(
        (record) => reconciliationState(record) === "已平衡",
      ).length,
      difference: records.filter(
        (record) => reconciliationState(record) === "有差异",
      ),
      pending: records.filter(
        (record) => reconciliationState(record) === "待处理",
      ).length,
    }),
    [records],
  );
  const totalDifference = metrics.difference.reduce(
    (sum, record) => sum + Math.abs(record.differenceAmount),
    0,
  );

  const openCreate = () => {
    setEditingRecord(null);
    setDraft({
      ...emptyDraft,
      reconciliationDate: new Date().toISOString().slice(0, 10),
    });
    setShowEditor(true);
  };

  const openEdit = (record: BankReconciliationRecord) => {
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };

  const selectTransaction = (transactionId: string) => {
    const transaction = transactions.find(
      (candidate) => candidate.id === transactionId,
    );
    if (!transaction) {
      setDraft((current) => ({ ...current, bankTransactionId: "" }));
      return;
    }
    const bankAmount = transaction.incomeAmount || transaction.expenseAmount;
    setDraft((current) => ({
      ...current,
      bankTransactionId: transaction.id,
      accountName: transaction.accountName,
      transactionNo: transaction.serialNo,
      summary: transaction.summary || "",
      bankAmount: String(bankAmount),
    }));
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账期，再维护银行对账记录。");
      return;
    }
    const bankAmount = Number(draft.bankAmount);
    const bookAmount = Number(draft.bookAmount);
    if (
      !draft.reconciliationNo.trim() ||
      !draft.reconciliationDate ||
      !draft.accountName.trim() ||
      !draft.transactionNo.trim() ||
      !Number.isFinite(bankAmount) ||
      !Number.isFinite(bookAmount) ||
      bankAmount < 0 ||
      bookAmount < 0
    ) {
      setNotice("请填写对账号、日期、账户、流水号以及有效的银行和账面金额。");
      return;
    }
    setSaving(true);
    const input = {
      companyId,
      period,
      reconciliationNo: draft.reconciliationNo.trim(),
      reconciliationDate: draft.reconciliationDate,
      bankTransactionId: draft.bankTransactionId || undefined,
      accountName: draft.accountName.trim(),
      transactionNo: draft.transactionNo.trim(),
      summary: draft.summary.trim() || undefined,
      bankAmount,
      bookAmount,
      voucherNo: draft.voucherNo.trim() || undefined,
      matchStatus: draft.matchStatus,
      owner: draft.owner.trim() || undefined,
      status: draft.status,
      note: draft.note.trim() || undefined,
    };
    const result = editingRecord
      ? await bankReconciliationApi.updateBankReconciliationRecord({
          ...input,
          id: editingRecord.id,
        })
      : await bankReconciliationApi.createBankReconciliationRecord(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}银行对账记录失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "银行对账记录已更新。"
        : "银行对账记录已新增，待人工核对差异和凭证。",
    );
    await refresh();
  };

  const actions = (record: BankReconciliationRecord) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => navigate("/vouchers/new")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FilePenLine className="h-3.5 w-3.5" />
        凭证处理
      </button>
      <button
        type="button"
        onClick={() => openEdit(record)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <ListChecks className="h-3.5 w-3.5" />
        编辑对账
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
              <BadgeCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">银行对账与未达账项</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              核对账面金额、银行金额、凭证和差异说明；只维护本地对账记录，不读取或调用银行外部系统。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="银行对账清单"
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
              onClick={openCreate}
              disabled={!companyId || !period}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新建对账
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            label="已平衡"
            value={`${metrics.balanced} 笔`}
            icon={BadgeCheck}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            label="差异笔数"
            value={`${metrics.difference.length} 笔`}
            icon={Waypoints}
            tone="text-rose-600 dark:text-rose-400"
          />
          <Metric
            label="差异金额"
            value={formatCurrency(totalDifference)}
            icon={Landmark}
            tone="text-rose-600 dark:text-rose-400"
          />
          <Metric
            label="待处理"
            value={`${metrics.pending} 笔`}
            icon={ListChecks}
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
              placeholder="搜索对账号、流水号、凭证或负责人"
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
          <Placeholder message="请选择账套后查看或维护银行对账。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期银行对账。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取银行对账资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">对账日期</th>
                    <th className="px-4 py-3 font-medium">对账号/流水号</th>
                    <th className="px-4 py-3 font-medium">账户</th>
                    <th className="px-4 py-3 text-right font-medium">
                      银行金额
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      账面金额
                    </th>
                    <th className="px-4 py-3 text-right font-medium">差异</th>
                    <th className="px-4 py-3 font-medium">凭证/负责人</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reconciliationPage.rows.map((record) => {
                    const state = reconciliationState(record);
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          {record.reconciliationDate}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-slate-700 dark:text-slate-200">
                            {record.reconciliationNo}
                          </p>
                          <p className="mt-0.5 font-mono text-slate-500 dark:text-slate-400">
                            {record.transactionNo}
                          </p>
                        </td>
                        <td className="max-w-48 truncate px-4 py-3">
                          {record.accountName}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(record.bankAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(record.bookAmount)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium tabular-nums ${record.differenceAmount === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
                        >
                          {formatCurrency(record.differenceAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <p>{record.voucherNo || "未关联"}</p>
                          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {record.owner || "未分配"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(state)}`}
                          >
                            {state}
                          </span>
                        </td>
                        <td className="px-4 py-3">{actions(record)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {reconciliationPage.rows.map((record) => {
                const state = reconciliationState(record);
                return (
                  <article
                    key={record.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium">
                          {record.reconciliationNo}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {record.accountName} · {record.reconciliationDate}
                        </p>
                      </div>
                      <span
                        className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(state)}`}
                      >
                        {state}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Info
                        label="银行金额"
                        value={formatCurrency(record.bankAmount)}
                      />
                      <Info
                        label="账面金额"
                        value={formatCurrency(record.bookAmount)}
                      />
                      <Info
                        label="差异"
                        value={formatCurrency(record.differenceAmount)}
                      />
                      <Info label="凭证" value={record.voucherNo || "未关联"} />
                    </div>
                    <div className="mt-3">{actions(record)}</div>
                  </article>
                );
              })}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有银行对账记录。" />
            )}
            <OperationalPagination
              page={reconciliationPage}
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
          icon={Landmark}
          title="银行流水"
          description="先维护本期收支流水和回单状态，再建立逐笔对账记录。"
          onClick={() => navigate("/bank")}
        />
        <QuickLink
          icon={FilePenLine}
          title="会计凭证"
          description="对账平衡后仍需人工确认科目和分录，生成可追溯的会计凭证。"
          onClick={() => navigate("/vouchers/new")}
        />
      </section>
      {showEditor && (
        <ReconciliationEditor
          transactions={transactions}
          draft={draft}
          editing={Boolean(editingRecord)}
          saving={saving}
          onSelectTransaction={selectTransaction}
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
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
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

function ReconciliationEditor({
  transactions,
  draft,
  editing,
  saving,
  onSelectTransaction,
  onChange,
  onClose,
  onSubmit,
}: {
  transactions: BankTransaction[];
  draft: ReconciliationDraft;
  editing: boolean;
  saving: boolean;
  onSelectTransaction: (id: string) => void;
  onChange: (draft: ReconciliationDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="银行对账编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑银行对账" : "新建银行对账"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              差异由银行金额和账面金额自动计算；确认凭证前需人工完成核对。
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
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
            <span>关联银行流水</span>
            <select
              value={draft.bankTransactionId}
              onChange={(event) => onSelectTransaction(event.target.value)}
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            >
              <option value="">手工填写</option>
              {transactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {transaction.transactionDate} · {transaction.serialNo} ·{" "}
                  {transaction.accountName}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="对账单号"
            value={draft.reconciliationNo}
            required
            onChange={(value) =>
              onChange({ ...draft, reconciliationNo: value })
            }
          />
          <Field
            label="对账日期"
            type="date"
            value={draft.reconciliationDate}
            required
            onChange={(value) =>
              onChange({ ...draft, reconciliationDate: value })
            }
          />
          <Field
            label="银行账户"
            value={draft.accountName}
            required
            onChange={(value) => onChange({ ...draft, accountName: value })}
          />
          <Field
            label="流水号"
            value={draft.transactionNo}
            required
            onChange={(value) => onChange({ ...draft, transactionNo: value })}
          />
          <Field
            label="银行金额"
            type="number"
            value={draft.bankAmount}
            required
            onChange={(value) => onChange({ ...draft, bankAmount: value })}
          />
          <Field
            label="账面金额"
            type="number"
            value={draft.bookAmount}
            required
            onChange={(value) => onChange({ ...draft, bookAmount: value })}
          />
          <Field
            label="关联凭证号"
            value={draft.voucherNo}
            onChange={(value) => onChange({ ...draft, voucherNo: value })}
          />
          <Field
            label="负责人"
            value={draft.owner}
            onChange={(value) => onChange({ ...draft, owner: value })}
          />
          <SelectField
            label="对账状态"
            value={draft.status}
            options={["待处理", "已完成", "异常"]}
            onChange={(value) => onChange({ ...draft, status: value })}
          />
          <SelectField
            label="匹配结论"
            value={draft.matchStatus}
            options={["待人工对账", "已匹配", "未达账项", "金额不符"]}
            onChange={(value) => onChange({ ...draft, matchStatus: value })}
          />
          <Field
            label="交易摘要"
            value={draft.summary}
            span
            onChange={(value) => onChange({ ...draft, summary: value })}
          />
          <Field
            label="差异说明"
            value={draft.note}
            span
            onChange={(value) => onChange({ ...draft, note: value })}
          />
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
            {saving ? "保存中..." : editing ? "保存修改" : "保存对账"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  required = false,
  span = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  span?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={`grid gap-1 text-xs text-slate-600 dark:text-slate-300 ${span ? "sm:col-span-2" : ""}`}
    >
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        required={required}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
