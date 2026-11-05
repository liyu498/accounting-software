import {
  ArrowDownLeft,
  ArrowUpRight,
  FilePenLine,
  Landmark,
  Link2,
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
import { bankTransactionApi, type BankTransaction } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type BillScope = "all" | "receipt" | "matching" | "completed";

type BillDraft = {
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

const emptyDraft: BillDraft = {
  accountName: "",
  serialNo: "",
  transactionDate: "",
  counterparty: "",
  summary: "",
  incomeAmount: "",
  expenseAmount: "",
  balance: "",
  receiptStatus: "待补回单",
};

const scopes: Array<{ id: BillScope; label: string }> = [
  { id: "all", label: "全部账单" },
  { id: "receipt", label: "待补回单" },
  { id: "matching", label: "待匹配" },
  { id: "completed", label: "已生成凭证" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function billStatus(record: BankTransaction) {
  if (record.status === "已生成凭证") return "已生成凭证";
  if (record.matchResult) return "已匹配";
  if (record.receiptStatus !== "已关联") return "待补回单";
  return "待匹配";
}

function statusClass(status: string) {
  if (status === "已生成凭证")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "已匹配")
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  if (status === "待补回单")
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function draftFromRecord(record: BankTransaction): BillDraft {
  return {
    accountName: record.accountName,
    serialNo: record.serialNo,
    transactionDate: record.transactionDate,
    counterparty: record.counterparty || "",
    summary: record.summary || "",
    incomeAmount: record.incomeAmount ? String(record.incomeAmount) : "",
    expenseAmount: record.expenseAmount ? String(record.expenseAmount) : "",
    balance: record.balance === null ? "" : String(record.balance),
    receiptStatus: record.receiptStatus || "待补回单",
  };
}

export function BillListWorkspace() {
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
  const [records, setRecords] = useState<BankTransaction[]>([]);
  const [scope, setScope] = useState<BillScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<BankTransaction | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<BillDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
      setNotice(`读取账单失败：${result.error || "未知错误"}`);
    }
    setLoading(false);
  }, [companyId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const status = billStatus(record);
      const inScope =
        scope === "all" ||
        (scope === "receipt" && status === "待补回单") ||
        (scope === "matching" && status === "待匹配") ||
        (scope === "completed" && status === "已生成凭证");
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
  const billPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "交易日期",
    "账单号",
    "账户",
    "对方",
    "摘要",
    "收入",
    "支出",
    "余额",
    "回单状态",
    "处理状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.transactionDate,
        record.serialNo,
        record.accountName,
        record.counterparty || "待补对方",
        record.summary || "未填写摘要",
        record.incomeAmount ? formatCurrency(record.incomeAmount) : "-",
        record.expenseAmount ? formatCurrency(record.expenseAmount) : "-",
        record.balance === null ? "-" : formatCurrency(record.balance),
        record.receiptStatus || "待补回单",
        billStatus(record),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      income: records.reduce((total, record) => total + record.incomeAmount, 0),
      expense: records.reduce(
        (total, record) => total + record.expenseAmount,
        0,
      ),
      needReceipt: records.filter((record) => billStatus(record) === "待补回单")
        .length,
      unmatched: records.filter((record) => billStatus(record) === "待匹配")
        .length,
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
      setNotice("请先在顶部选择账期，再维护账单。");
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
        "请填写账户、账单号、日期和一项有效收支金额；收入与支出只能填写一项。",
      );
      return;
    }

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
    setSaving(true);
    const result = editingRecord
      ? await bankTransactionApi.updateBankTransaction({
          ...input,
          id: editingRecord.id,
        })
      : await bankTransactionApi.createBankTransaction({ ...input, period });
    if (!result.success) {
      setSaving(false);
      setNotice(
        `${editingRecord ? "更新" : "登记"}账单失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setSaving(false);
    setShowEditor(false);
    setNotice(
      editingRecord ? "账单已更新。" : "账单已登记，待补回单或进行凭证匹配。",
    );
    await refresh();
  };

  const associateReceipt = async (record: BankTransaction) => {
    if (!companyId) return;
    setSaving(true);
    const result = await bankTransactionApi.updateBankTransaction({
      id: record.id,
      companyId,
      accountName: record.accountName,
      serialNo: record.serialNo,
      transactionDate: record.transactionDate,
      counterparty: record.counterparty || undefined,
      summary: record.summary || undefined,
      incomeAmount: record.incomeAmount,
      expenseAmount: record.expenseAmount,
      balance: record.balance === null ? undefined : record.balance,
      receiptStatus: "已关联",
    });
    if (!result.success) {
      setSaving(false);
      setNotice(`更新回单状态失败：${result.error || "未知错误"}`);
      return;
    }
    setSaving(false);
    setNotice(`账单 ${record.serialNo} 已记录回单关联。`);
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
        <ReceiptText className="h-3.5 w-3.5" />
        {record.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        disabled={saving || record.receiptStatus === "已关联"}
        onClick={() => void associateReceipt(record)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Link2 className="h-3.5 w-3.5" />
        关联回单
      </button>
      <button
        type="button"
        disabled={record.status === "已生成凭证"}
        onClick={() => navigate("/matching")}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Waypoints className="h-3.5 w-3.5" />
        进入匹配
      </button>
      <button
        type="button"
        disabled={record.status === "已生成凭证"}
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
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">账单一览</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              按当前账期登记银行账单、关联回单并进入人工匹配流程；不登录银行、不下载回单、不自动生成或过账凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="银行账单清单"
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
              登记账单
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
            label="待补回单"
            value={`${metrics.needReceipt} 笔`}
            icon={ReceiptText}
            tone={
              metrics.needReceipt
                ? "text-rose-600 dark:text-rose-400"
                : undefined
            }
          />
          <Metric
            label="待匹配"
            value={`${metrics.unmatched} 笔`}
            icon={Waypoints}
            tone="text-sky-700 dark:text-sky-300"
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
              placeholder="搜索账单号、账户、对方或摘要"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {!companyId && <Placeholder message="请选择账套后查看或维护账单。" />}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期账单。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取账单..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">交易日期</th>
                    <th className="px-4 py-3 font-medium">账单号</th>
                    <th className="px-4 py-3 font-medium">账户/对方</th>
                    <th className="px-4 py-3 font-medium">摘要</th>
                    <th className="px-4 py-3 text-right font-medium">收入</th>
                    <th className="px-4 py-3 text-right font-medium">支出</th>
                    <th className="px-4 py-3 font-medium">回单</th>
                    <th className="px-4 py-3 font-medium">处理状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {billPage.rows.map((record) => (
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
                        <p className="truncate font-medium">
                          {record.accountName}
                        </p>
                        <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                          {record.counterparty || "待补对方"}
                        </p>
                      </td>
                      <td className="truncate px-4 py-3">
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
                        {record.receiptStatus || "待补回单"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${statusClass(billStatus(record))}`}
                        >
                          {billStatus(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{actions(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {billPage.rows.map((record) => (
                <article
                  key={record.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {record.serialNo}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {record.accountName} · {record.transactionDate}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-xs ${statusClass(billStatus(record))}`}
                    >
                      {billStatus(record)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="对方" value={record.counterparty || "待补"} />
                    <Info
                      label="回单"
                      value={record.receiptStatus || "待补回单"}
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
              <Placeholder message="当前筛选没有账单记录。" />
            )}
            <OperationalPagination
              page={billPage}
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
          title="账单匹配"
          description="按回单、摘要和金额进入人工匹配；匹配不会自动创建或过账凭证。"
          onClick={() => navigate("/matching")}
        />
        <QuickLink
          icon={ReceiptText}
          title="单据登记"
          description="需要补充收据、报销单或其他来源单据时，统一进入单据登记台账。"
          onClick={() => navigate("/documents")}
        />
      </section>
      {showEditor && (
        <BankBillEditor
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
    <div className="min-w-0">
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

function BankBillEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: BillDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: BillDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fields: Array<{
    key: Exclude<keyof BillDraft, "receiptStatus">;
    label: string;
    type?: string;
    required?: boolean;
    span?: boolean;
  }> = [
    { key: "accountName", label: "银行账户", required: true },
    { key: "serialNo", label: "账单号", required: true },
    { key: "transactionDate", label: "交易日期", type: "date", required: true },
    { key: "counterparty", label: "对方户名" },
    { key: "incomeAmount", label: "收入金额", type: "number" },
    { key: "expenseAmount", label: "支出金额", type: "number" },
    { key: "balance", label: "账户余额", type: "number" },
    { key: "summary", label: "交易摘要", span: true },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="账单编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "编辑账单" : "登记账单"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              收入与支出只能填写一项。关联回单和凭证匹配必须由用户后续确认。
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
          <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span>回单状态</span>
            <select
              value={draft.receiptStatus}
              onChange={(event) =>
                onChange({ ...draft, receiptStatus: event.target.value })
              }
              className="h-8 border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            >
              <option value="待补回单">待补回单</option>
              <option value="已关联">已关联</option>
              <option value="无需回单">无需回单</option>
            </select>
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
            {saving ? "保存中..." : "保存账单"}
          </button>
        </footer>
      </form>
    </div>
  );
}
