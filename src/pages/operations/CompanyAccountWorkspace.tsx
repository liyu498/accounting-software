import {
  Building2,
  CircleAlert,
  CreditCard,
  FilePenLine,
  Landmark,
  Plus,
  Power,
  RefreshCw,
  Search,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useCompanyAccountStore,
  type CompanyAccount,
  type CompanyAccountInput,
} from "../../stores/companyAccountStore";

type AccountDraft = {
  accountName: string;
  accountType: string;
  bankName: string;
  accountNumber: string;
  subjectCode: string;
  openingBalance: string;
  attachmentNote: string;
  status: CompanyAccount["status"];
};

const previewStorageKey = "accounting-preview-company-accounts-v2";
const accountTypes = ["银行账户", "现金账户", "第三方支付账户", "其他资金账户"];
const emptyDraft = (): AccountDraft => ({
  accountName: "",
  accountType: "银行账户",
  bankName: "",
  accountNumber: "",
  subjectCode: "1002 银行存款",
  openingBalance: "0",
  attachmentNote: "",
  status: "启用",
});

function isPreviewAccount(value: unknown): value is CompanyAccount {
  const account = value as Partial<CompanyAccount>;
  return Boolean(
    account &&
    typeof account.id === "string" &&
    typeof account.company_id === "string" &&
    typeof account.account_name === "string" &&
    typeof account.account_type === "string" &&
    typeof account.account_number === "string" &&
    typeof account.subject_code === "string" &&
    Number.isFinite(account.opening_balance) &&
    (account.status === "启用" || account.status === "停用"),
  );
}

function loadPreviewAccounts(companyId: string): CompanyAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewStorageKey) || "null",
    );
    return Array.isArray(parsed) && parsed.every(isPreviewAccount)
      ? parsed.filter((item) => item.company_id === companyId)
      : [];
  } catch {
    return [];
  }
}

function savePreviewAccounts(companyId: string, accounts: CompanyAccount[]) {
  if (typeof window === "undefined") return;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewStorageKey) || "null",
    );
    const existing =
      Array.isArray(parsed) && parsed.every(isPreviewAccount)
        ? (parsed as CompanyAccount[])
        : [];
    window.localStorage.setItem(
      previewStorageKey,
      JSON.stringify([
        ...existing.filter((item) => item.company_id !== companyId),
        ...accounts,
      ]),
    );
  } catch {
    // Keep the rendered preview usable when local storage is unavailable.
  }
}

function draftFromAccount(account: CompanyAccount): AccountDraft {
  return {
    accountName: account.account_name,
    accountType: account.account_type,
    bankName: account.bank_name || "",
    accountNumber: account.account_number,
    subjectCode: account.subject_code,
    openingBalance: String(account.opening_balance),
    attachmentNote: account.attachment_note || "",
    status: account.status,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function maskAccountNumber(value: string) {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

export function CompanyAccountWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const storeAccounts = useCompanyAccountStore(
    (state) => state.companyAccounts,
  );
  const loading = useCompanyAccountStore((state) => state.isLoading);
  const storeError = useCompanyAccountStore((state) => state.error);
  const fetchCompanyAccounts = useCompanyAccountStore(
    (state) => state.fetchCompanyAccounts,
  );
  const createCompanyAccount = useCompanyAccountStore(
    (state) => state.createCompanyAccount,
  );
  const updateCompanyAccount = useCompanyAccountStore(
    (state) => state.updateCompanyAccount,
  );
  const [previewAccounts, setPreviewAccounts] = useState<CompanyAccount[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorAccount, setEditorAccount] = useState<
    CompanyAccount | null | undefined
  >(undefined);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewAccounts([]);
      return;
    }
    if (!isTauri) {
      setPreviewAccounts(loadPreviewAccounts(companyId));
      return;
    }
    await fetchCompanyAccounts(companyId);
  }, [companyId, fetchCompanyAccounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accounts = isTauri ? storeAccounts : previewAccounts;
  const filteredAccounts = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesTerm =
        !term ||
        [
          account.account_name,
          account.account_type,
          account.bank_name || "",
          account.account_number,
          account.subject_code,
          account.attachment_note || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return (
        matchesTerm &&
        (typeFilter === "all" || account.account_type === typeFilter) &&
        (statusFilter === "all" || account.status === statusFilter)
      );
    });
  }, [accounts, keyword, statusFilter, typeFilter]);
  const accountPage = useMemo(
    () => paginateOperationalRows(filteredAccounts, page, pageSize),
    [filteredAccounts, page, pageSize],
  );
  const exportHeaders = [
    "账户名称",
    "账户类型",
    "开户机构",
    "账户号码",
    "默认科目",
    "期初余额",
    "状态",
    "备注",
  ];
  const exportRows = useMemo(
    () =>
      filteredAccounts.map((account) => [
        account.account_name,
        account.account_type,
        account.bank_name || "未填写",
        maskAccountNumber(account.account_number),
        account.subject_code,
        formatCurrency(account.opening_balance),
        account.status,
        account.attachment_note || "未填写",
      ]),
    [filteredAccounts],
  );
  const metrics = useMemo(
    () => ({
      total: accounts.length,
      enabled: accounts.filter((account) => account.status === "启用").length,
      bank: accounts.filter((account) => account.account_type === "银行账户")
        .length,
      opening: accounts
        .filter((account) => account.status === "启用")
        .reduce((sum, account) => sum + account.opening_balance, 0),
    }),
    [accounts],
  );

  const openCreate = () => {
    setEditorAccount(null);
    setDraft(emptyDraft());
    setSaving(false);
  };
  const openEdit = (account: CompanyAccount) => {
    setEditorAccount(account);
    setDraft(draftFromAccount(account));
    setSaving(false);
  };

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先选择账套后维护账户档案。");
      return;
    }
    const openingBalance = Number(draft.openingBalance || 0);
    if (
      !draft.accountName.trim() ||
      !draft.accountNumber.trim() ||
      !draft.subjectCode.trim() ||
      !Number.isFinite(openingBalance)
    ) {
      setNotice("请填写账户名称、账户号码、默认科目和有效的期初余额。");
      return;
    }
    if (
      !editorAccount &&
      accounts.some(
        (account) => account.account_number === draft.accountNumber.trim(),
      )
    ) {
      setNotice("该账户号码已存在，请勿重复登记。");
      return;
    }
    const input: CompanyAccountInput = {
      companyId,
      accountName: draft.accountName.trim(),
      accountType: draft.accountType,
      bankName: draft.bankName.trim() || undefined,
      accountNumber: draft.accountNumber.trim(),
      subjectCode: draft.subjectCode.trim(),
      openingBalance,
      attachmentNote: draft.attachmentNote.trim() || undefined,
      status: draft.status,
    };
    setSaving(true);
    try {
      if (!isTauri) {
        const now = new Date().toISOString();
        const record: CompanyAccount = editorAccount
          ? {
              ...editorAccount,
              company_id: companyId,
              account_name: input.accountName,
              account_type: input.accountType,
              bank_name: input.bankName || null,
              account_number: input.accountNumber,
              subject_code: input.subjectCode,
              opening_balance: input.openingBalance,
              attachment_note: input.attachmentNote || null,
              status: input.status,
              updated_at: now,
            }
          : {
              id: `preview-company-account-${crypto.randomUUID()}`,
              company_id: companyId,
              account_name: input.accountName,
              account_type: input.accountType,
              bank_name: input.bankName || null,
              account_number: input.accountNumber,
              subject_code: input.subjectCode,
              opening_balance: input.openingBalance,
              attachment_note: input.attachmentNote || null,
              status: input.status,
              created_at: now,
              updated_at: now,
            };
        const nextAccounts = editorAccount
          ? accounts.map((account) =>
              account.id === record.id ? record : account,
            )
          : [...accounts, record];
        savePreviewAccounts(companyId, nextAccounts);
        setPreviewAccounts(nextAccounts);
      } else if (editorAccount) {
        await updateCompanyAccount(editorAccount.id, input);
      } else {
        await createCompanyAccount(input);
      }
      setEditorAccount(undefined);
      setNotice(
        `账户档案“${input.accountName}”已${editorAccount ? "更新" : "新增"}。`,
      );
    } catch (error) {
      setNotice(`保存账户档案失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (account: CompanyAccount) => {
    if (!companyId) return;
    const nextStatus: CompanyAccount["status"] =
      account.status === "启用" ? "停用" : "启用";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认${nextStatus}账户“${account.account_name}”吗？停用不改写历史凭证、流水和对账记录。`,
      )
    )
      return;
    try {
      const input: CompanyAccountInput = {
        companyId,
        accountName: account.account_name,
        accountType: account.account_type,
        bankName: account.bank_name || undefined,
        accountNumber: account.account_number,
        subjectCode: account.subject_code,
        openingBalance: account.opening_balance,
        attachmentNote: account.attachment_note || undefined,
        status: nextStatus,
      };
      if (!isTauri) {
        const nextAccounts = accounts.map((item) =>
          item.id === account.id
            ? {
                ...item,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              }
            : item,
        );
        savePreviewAccounts(companyId, nextAccounts);
        setPreviewAccounts(nextAccounts);
      } else {
        await updateCompanyAccount(account.id, input);
      }
      setNotice(`账户“${account.account_name}”已${nextStatus}。`);
    } catch (error) {
      setNotice(`${nextStatus}账户失败：${String(error)}`);
    }
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">账户登记</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护银行、现金和第三方支付账户的会计档案、默认科目和期初余额，供流水、收付款核销和对账引用。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="账户档案清单"
              companyName={selectedCompany?.name}
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
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增账户
            </button>
          </div>
        </header>
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护账户档案。" />
        )}
        {companyId && (
          <>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
                <p className="font-medium">使用边界</p>
                <p className="mt-1">
                  此处仅维护本地账户档案、会计科目和余额资料，不会登录银行或发起付款；账户停用不改写历史凭证、流水和对账记录。
                </p>
              </div>
              <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                账户号码在列表中脱敏展示。删除留给受控数据治理流程，日常维护支持编辑和停用。
              </p>
            </div>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={WalletCards}
                label="账户数量"
                value={String(metrics.total)}
              />
              <Metric
                icon={Power}
                label="启用中"
                value={String(metrics.enabled)}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={Landmark}
                label="银行账户"
                value={String(metrics.bank)}
                tone="text-sky-700 dark:text-sky-300"
              />
              <Metric
                icon={CreditCard}
                label="启用期初余额"
                value={formatCurrency(metrics.opening)}
              />
            </div>
            <div className="grid gap-2 border-b border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_10rem_8rem] dark:border-slate-800">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索账户、机构、号码或默认科目"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
              <select
                aria-label="账户类型"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
                className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
              >
                <option value="all">全部类型</option>
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                aria-label="账户状态"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
              >
                <option value="all">全部状态</option>
                <option value="启用">启用</option>
                <option value="停用">停用</option>
              </select>
            </div>
            {notice && <Notice value={notice} />}
            {storeError && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                账户档案读取失败：{storeError}
              </div>
            )}
            {loading && <Placeholder message="正在读取账户档案..." />}
            {!loading && (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                      <tr>
                        <th className="w-[15%] px-4 py-3 font-medium">
                          账户名称
                        </th>
                        <th className="w-[12%] px-4 py-3 font-medium">
                          账户类型
                        </th>
                        <th className="w-[16%] px-4 py-3 font-medium">
                          开户机构
                        </th>
                        <th className="w-[16%] px-4 py-3 font-medium">
                          账户号码
                        </th>
                        <th className="w-[15%] px-4 py-3 font-medium">
                          默认科目
                        </th>
                        <th className="w-[11%] px-4 py-3 text-right font-medium">
                          期初余额
                        </th>
                        <th className="w-[7%] px-4 py-3 font-medium">状态</th>
                        <th className="w-[8%] px-4 py-3 text-right font-medium">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {accountPage.rows.map((account) => (
                        <tr
                          key={account.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-3">
                            <p className="truncate font-medium">
                              {account.account_name}
                            </p>
                            <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                              {account.attachment_note || "未填写备注"}
                            </p>
                          </td>
                          <td className="truncate px-4 py-3">
                            {account.account_type}
                          </td>
                          <td className="truncate px-4 py-3">
                            {account.bank_name || "未填写"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">
                            {maskAccountNumber(account.account_number)}
                          </td>
                          <td className="truncate px-4 py-3">
                            {account.subject_code}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(account.opening_balance)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={account.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEdit(account)}
                                className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <FilePenLine className="h-3.5 w-3.5" />
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleStatus(account)}
                                className="h-7 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                              >
                                {account.status === "启用" ? "停用" : "启用"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 p-3 lg:hidden">
                  {accountPage.rows.map((account) => (
                    <article
                      key={account.id}
                      className="border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {account.account_name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {maskAccountNumber(account.account_number)}
                          </p>
                        </div>
                        <StatusBadge status={account.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Info label="账户类型" value={account.account_type} />
                        <Info
                          label="开户机构"
                          value={account.bank_name || "未填写"}
                        />
                        <Info label="默认科目" value={account.subject_code} />
                        <Info
                          label="期初余额"
                          value={formatCurrency(account.opening_balance)}
                        />
                      </div>
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {account.attachment_note || "未填写备注"}
                      </p>
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="h-7 border border-slate-300 px-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(account)}
                          className="h-7 border border-sky-300 px-2 text-xs text-sky-700 dark:border-sky-800 dark:text-sky-300"
                        >
                          {account.status === "启用" ? "停用" : "启用"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {filteredAccounts.length === 0 && (
                  <Placeholder message="当前筛选没有账户档案。新增账户后可在银行流水、收付款核销和对账中引用。" />
                )}
                <OperationalPagination
                  page={accountPage}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            )}
          </>
        )}
      </section>
      {editorAccount !== undefined && (
        <AccountEditor
          draft={draft}
          editing={Boolean(editorAccount)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorAccount(undefined)}
          onSubmit={saveAccount}
        />
      )}
    </main>
  );
}

function AccountEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: AccountDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: AccountDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑账户档案" : "新增账户档案"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑账户档案" : "新增账户档案"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            仅维护本地账户资料，不会登录银行或发起付款。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="账户名称 *">
            <input
              required
              value={draft.accountName}
              onChange={(event) =>
                onChange({ ...draft, accountName: event.target.value })
              }
              placeholder="如：基本户"
              className={inputClass}
            />
          </Field>
          <Field label="账户类型 *">
            <select
              value={draft.accountType}
              onChange={(event) =>
                onChange({ ...draft, accountType: event.target.value })
              }
              className={inputClass}
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="开户机构">
            <input
              value={draft.bankName}
              onChange={(event) =>
                onChange({ ...draft, bankName: event.target.value })
              }
              placeholder="如：中国银行上海分行"
              className={inputClass}
            />
          </Field>
          <Field label="账户号码 *">
            <input
              required
              value={draft.accountNumber}
              onChange={(event) =>
                onChange({ ...draft, accountNumber: event.target.value })
              }
              placeholder="仅用于本地档案识别"
              className={inputClass}
            />
          </Field>
          <Field label="默认会计科目 *">
            <input
              required
              value={draft.subjectCode}
              onChange={(event) =>
                onChange({ ...draft, subjectCode: event.target.value })
              }
              placeholder="如：1002 银行存款"
              className={inputClass}
            />
          </Field>
          <Field label="期初余额">
            <input
              type="number"
              step="0.01"
              value={draft.openingBalance}
              onChange={(event) =>
                onChange({ ...draft, openingBalance: event.target.value })
              }
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
          <Field label="状态">
            <select
              value={draft.status}
              onChange={(event) =>
                onChange({
                  ...draft,
                  status: event.target.value as CompanyAccount["status"],
                })
              }
              className={inputClass}
            >
              <option value="启用">启用</option>
              <option value="停用">停用</option>
            </select>
          </Field>
          <Field label="附件/备注">
            <input
              value={draft.attachmentNote}
              onChange={(event) =>
                onChange({ ...draft, attachmentNote: event.target.value })
              }
              placeholder="如：开户许可证已归档"
              className={inputClass}
            />
          </Field>
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
            {saving ? "正在保存" : editing ? "保存修改" : "保存账户"}
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
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function StatusBadge({ status }: { status: CompanyAccount["status"] }) {
  return (
    <span
      className={`inline-flex border px-1.5 py-0.5 text-[11px] ${status === "启用" ? "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
    >
      {status}
    </span>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-xs">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-slate-800 dark:text-slate-100">
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
function Placeholder({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}
