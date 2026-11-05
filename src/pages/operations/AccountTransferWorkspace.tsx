import {
  ArrowLeftRight,
  FilePenLine,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
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
import { accountTransferApi, type AccountTransfer } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type TransferScope = "all" | "pending" | "vouchered";
type TransferDraft = {
  transferDate: string;
  fromAccount: string;
  toAccount: string;
  amount: string;
  fee: string;
  serialNo: string;
};

const browserStorageKey = "accounting-preview-account-transfer-data-v1";
const scopes: Array<{ id: TransferScope; label: string }> = [
  { id: "all", label: "全部转账" },
  { id: "pending", label: "待核验" },
  { id: "vouchered", label: "已生成凭证" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}
function transferStatus(record: AccountTransfer) {
  return record.status || "待确认";
}
function statusClass(status: string) {
  return status === "已生成凭证"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}
function isTransfer(value: unknown): value is AccountTransfer {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AccountTransfer>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    typeof record.transferDate === "string" &&
    typeof record.fromAccount === "string" &&
    typeof record.toAccount === "string" &&
    Number.isFinite(record.amount) &&
    Number.isFinite(record.fee) &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
function loadBrowserTransfers() {
  if (typeof window === "undefined") return [] as AccountTransfer[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTransfer) : [];
  } catch {
    return [];
  }
}
function saveBrowserTransfers(records: AccountTransfer[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    /* The active preview remains usable if storage is unavailable. */
  }
}
function emptyDraft(transferDate: string): TransferDraft {
  return {
    transferDate,
    fromAccount: "",
    toAccount: "",
    amount: "",
    fee: "0",
    serialNo: "",
  };
}
function draftFromRecord(record: AccountTransfer): TransferDraft {
  return {
    transferDate: record.transferDate,
    fromAccount: record.fromAccount,
    toAccount: record.toAccount,
    amount: String(record.amount),
    fee: String(record.fee),
    serialNo: record.serialNo || "",
  };
}

export function AccountTransferWorkspace() {
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
  const [records, setRecords] = useState<AccountTransfer[]>([]);
  const [scope, setScope] = useState<TransferScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AccountTransfer | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<TransferDraft>(() =>
    emptyDraft(defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);
  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      setRecords(
        loadBrowserTransfers().filter(
          (record) =>
            record.companyId === companyId && record.period === period,
        ),
      );
      setLoading(false);
      return;
    }
    const result = await accountTransferApi.getAccountTransfers({
      companyId,
      period,
    });
    setRecords(result.success ? result.data || [] : []);
    setNotice(
      result.success ? null : `读取账户转账失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, period]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = transferStatus(record);
      const matchesScope =
        scope === "all" ||
        (scope === "pending" && status !== "已生成凭证") ||
        (scope === "vouchered" && status === "已生成凭证");
      return (
        matchesScope &&
        (!term ||
          [record.fromAccount, record.toAccount, record.serialNo]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, records, scope]);
  const transferPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "转账日期",
    "流水编号",
    "转出账户",
    "转入账户",
    "转账金额",
    "手续费",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.transferDate,
        record.serialNo || "待补",
        record.fromAccount,
        record.toAccount,
        formatCurrency(record.amount),
        formatCurrency(record.fee),
        transferStatus(record),
      ]),
    [filteredRecords],
  );
  const metrics = useMemo(
    () => ({
      total: records.reduce((sum, record) => sum + record.amount, 0),
      fee: records.reduce((sum, record) => sum + record.fee, 0),
      pending: records.filter(
        (record) => transferStatus(record) !== "已生成凭证",
      ).length,
      vouchered: records.filter(
        (record) => transferStatus(record) === "已生成凭证",
      ).length,
    }),
    [records],
  );
  const openCreate = () => {
    setEditingRecord(null);
    setDraft(emptyDraft(defaultDate));
    setShowEditor(true);
  };
  const openEdit = (record: AccountTransfer) => {
    if (transferStatus(record) === "已生成凭证") {
      setNotice("该转账已生成凭证，不能修改来源字段。");
      return;
    }
    setEditingRecord(record);
    setDraft(draftFromRecord(record));
    setShowEditor(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再登记转账。");
      return;
    }
    const amount = Number(draft.amount);
    const fee = Number(draft.fee || 0);
    if (
      !draft.transferDate ||
      !draft.fromAccount.trim() ||
      !draft.toAccount.trim() ||
      draft.fromAccount.trim() === draft.toAccount.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(fee) ||
      fee < 0
    ) {
      setNotice("请填写转账日期、不同的转出和转入账户、正数金额及非负手续费。");
      return;
    }
    const input = {
      companyId,
      period,
      transferDate: draft.transferDate,
      fromAccount: draft.fromAccount.trim(),
      toAccount: draft.toAccount.trim(),
      amount,
      fee,
      serialNo: draft.serialNo.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const now = new Date().toISOString();
      const record: AccountTransfer = editingRecord
        ? {
            ...editingRecord,
            ...input,
            serialNo: input.serialNo || null,
            updatedAt: now,
          }
        : {
            id: `preview-transfer-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            serialNo: input.serialNo || null,
            voucherId: null,
            voucherNumber: null,
            status: "待确认",
            createdAt: now,
            updatedAt: now,
          };
      saveBrowserTransfers([
        record,
        ...loadBrowserTransfers().filter((item) => item.id !== record.id),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingRecord
          ? "预览转账已更新。"
          : "预览转账已保存，等待回单和人工确认。",
      );
      await refresh();
      return;
    }
    const result = editingRecord
      ? await accountTransferApi.updateAccountTransfer({
          ...input,
          id: editingRecord.id,
        })
      : await accountTransferApi.createAccountTransfer(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingRecord ? "更新" : "新增"}转账失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingRecord
        ? "账户转账已更新。"
        : "账户转账已保存，系统不自动生成或过账凭证。",
    );
    await refresh();
  };
  const rowActions = (record: AccountTransfer) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            record.voucherId
              ? `/vouchers/detail/${record.voucherId}`
              : buildVoucherSourcePath({ kind: "account_transfer", id: record.id }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        onClick={() => navigate("/bank")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <ReceiptText className="h-3.5 w-3.5" />
        银行流水
      </button>
      <button
        type="button"
        onClick={() => openEdit(record)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        disabled={transferStatus(record) === "已生成凭证"}
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
              <ArrowLeftRight className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">账户转账与资金调拨</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              登记内部资金调拨、手续费和回单流水；可生成待复核凭证草稿，不自动审核或过账。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="账户转账清单"
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
              disabled={!companyId || !period}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              登记转账
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={ArrowLeftRight}
            label="本期转账金额"
            value={formatCurrency(metrics.total)}
          />
          <Metric
            icon={WalletCards}
            label="手续费"
            value={formatCurrency(metrics.fee)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={ReceiptText}
            label="待回单核验"
            value={`${metrics.pending} 笔`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={Landmark}
            label="已生成凭证"
            value={`${metrics.vouchered} 笔`}
            tone="text-emerald-600 dark:text-emerald-400"
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
              placeholder="搜索转出账户、转入账户或流水编号"
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
          <Placeholder message="请选择账套后查看或登记账户转账。" />
        )}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期账户转账。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取账户转账..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[12%] px-3 py-3 font-medium">转账日期</th>
                    <th className="w-[12%] px-3 py-3 font-medium">流水编号</th>
                    <th className="w-[15%] px-3 py-3 font-medium">转出账户</th>
                    <th className="w-[15%] px-3 py-3 font-medium">转入账户</th>
                    <th className="w-[13%] px-3 py-3 text-right font-medium">
                      转账金额
                    </th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      手续费
                    </th>
                    <th className="w-[12%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[11%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transferPage.rows.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        {record.transferDate}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={record.serialNo || ""}
                      >
                        {record.serialNo || "待补"}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.fromAccount}
                      >
                        {record.fromAccount}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={record.toAccount}
                      >
                        {record.toAccount}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(record.fee)}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={transferStatus(record)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {transferPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {record.fromAccount} → {record.toAccount}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.transferDate} · {record.serialNo || "待补流水"}
                      </p>
                    </div>
                    <Status status={transferStatus(record)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info
                      label="转账金额"
                      value={formatCurrency(record.amount)}
                    />
                    <Info label="手续费" value={formatCurrency(record.fee)} />
                  </div>
                  <div className="mt-3">{rowActions(record)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有转账记录。" />
            )}
            <OperationalPagination
              page={transferPage}
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
        <WorkflowLink
          icon={ReceiptText}
          title="核对银行流水与回单"
          description="银行流水仅作为资金调拨依据，需人工核对账户、金额和流水编号。"
          onClick={() => navigate("/bank")}
        />
        <WorkflowLink
          icon={Landmark}
          title="进入银行对账"
          description="账面与银行差异需先完成对账，不能通过本页自动生成或过账凭证。"
          onClick={() => navigate("/bank/reconciliation")}
        />
      </section>
      {showEditor && (
        <TransferEditor
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
function TransferEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: TransferDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: TransferDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="账户转账编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "编辑账户转账" : "登记账户转账"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              转账保存后需补齐银行回单和人工核验，系统不会自动生成凭证。
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
          <Field label="转账日期 *">
            <input
              required
              type="date"
              value={draft.transferDate}
              onChange={(event) =>
                onChange({ ...draft, transferDate: event.target.value })
              }
            />
          </Field>
          <Field label="银行流水编号">
            <input
              value={draft.serialNo}
              onChange={(event) =>
                onChange({ ...draft, serialNo: event.target.value })
              }
            />
          </Field>
          <Field label="转出账户 *">
            <input
              required
              value={draft.fromAccount}
              onChange={(event) =>
                onChange({ ...draft, fromAccount: event.target.value })
              }
            />
          </Field>
          <Field label="转入账户 *">
            <input
              required
              value={draft.toAccount}
              onChange={(event) =>
                onChange({ ...draft, toAccount: event.target.value })
              }
            />
          </Field>
          <Field label="转账金额 *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
              }
            />
          </Field>
          <Field label="手续费">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.fee}
              onChange={(event) =>
                onChange({ ...draft, fee: event.target.value })
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
            {saving ? "保存中..." : "保存转账"}
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
