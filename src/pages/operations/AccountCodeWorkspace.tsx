import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  FilePenLine,
  FileText,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Tags,
  Trash2,
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
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { useAccountStore, type AccountCode } from "../../stores/accountStore";

type AccountScope = "all" | "enabled" | "detail" | "auxiliary" | "quantity";
type AccountDraft = {
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  level: string;
  parentCode: string;
  isDetail: boolean;
  hasQuantity: boolean;
  defaultUnit: string;
  hasAuxiliary: boolean;
};

const browserStorageKey = "accounting-preview-account-code-data-v1";
const accountTypes = ["资产类", "负债类", "所有者权益类", "成本类", "损益类"];
const scopes: Array<{ id: AccountScope; label: string }> = [
  { id: "all", label: "全部科目" },
  { id: "enabled", label: "启用中" },
  { id: "detail", label: "末级明细" },
  { id: "auxiliary", label: "辅助核算" },
  { id: "quantity", label: "数量核算" },
];

function isAccountCode(value: unknown): value is AccountCode {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AccountCode>;
  return (
    typeof record.code === "string" &&
    typeof record.company_id === "string" &&
    typeof record.name === "string" &&
    typeof record.account_type === "string" &&
    typeof record.normal_balance === "string" &&
    Number.isInteger(record.level) &&
    typeof record.is_detail === "number" &&
    typeof record.is_enabled === "number" &&
    typeof record.has_quantity === "number" &&
    typeof record.has_auxiliary === "number"
  );
}

function loadBrowserAccounts(): AccountCode[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAccountCode) : [];
  } catch {
    return [];
  }
}

function saveBrowserAccounts(records: AccountCode[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
  } catch {
    // The current preview remains usable when local storage is unavailable.
  }
}

function emptyDraft(): AccountDraft {
  return {
    code: "",
    name: "",
    accountType: "资产类",
    normalBalance: "debit",
    level: "1",
    parentCode: "",
    isDetail: true,
    hasQuantity: false,
    defaultUnit: "",
    hasAuxiliary: false,
  };
}

function draftFromAccount(account: AccountCode): AccountDraft {
  return {
    code: account.code,
    name: account.name,
    accountType: account.account_type,
    normalBalance: account.normal_balance,
    level: String(account.level),
    parentCode: account.parent_code || "",
    isDetail: account.is_detail === 1,
    hasQuantity: account.has_quantity === 1,
    defaultUnit: account.default_unit || "",
    hasAuxiliary: account.has_auxiliary === 1,
  };
}

function accountStatus(account: AccountCode) {
  return account.is_enabled === 1 ? "启用" : "停用";
}

function statusClass(status: string) {
  return status === "启用"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function AccountCodeWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const accounts = useAccountStore((state) => state.accounts);
  const accountLoading = useAccountStore((state) => state.isLoading);
  const accountError = useAccountStore((state) => state.error);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const createAccount = useAccountStore((state) => state.createAccount);
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const toggleAccount = useAccountStore((state) => state.toggleAccount);
  const deleteAccount = useAccountStore((state) => state.deleteAccount);
  const [browserAccounts, setBrowserAccounts] = useState<AccountCode[]>([]);
  const [scope, setScope] = useState<AccountScope>("all");
  const [accountType, setAccountType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountCode | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setBrowserAccounts([]);
      return;
    }
    if (!isTauri) {
      setBrowserAccounts(
        loadBrowserAccounts()
          .filter((account) => account.company_id === companyId)
          .sort((left, right) => left.code.localeCompare(right.code)),
      );
      return;
    }
    await fetchAccounts(companyId);
  }, [companyId, fetchAccounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const records = isTauri ? accounts : browserAccounts;
  const loading = isTauri ? accountLoading : false;
  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((account) => {
      const matchesType =
        accountType === "all" || account.account_type === accountType;
      const matchesScope =
        scope === "all" ||
        (scope === "enabled" && account.is_enabled === 1) ||
        (scope === "detail" && account.is_detail === 1) ||
        (scope === "auxiliary" && account.has_auxiliary === 1) ||
        (scope === "quantity" && account.has_quantity === 1);
      const content = [
        account.code,
        account.name,
        account.account_type,
        account.parent_code,
        account.default_unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesType && matchesScope && (!term || content.includes(term));
    });
  }, [accountType, keyword, records, scope]);
  const accountPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "科目编码",
    "科目名称",
    "类别",
    "余额方向",
    "级次",
    "上级科目",
    "明细属性",
    "数量核算",
    "辅助核算",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((account) => [
        account.code,
        account.name,
        account.account_type,
        account.normal_balance === "credit" ? "贷方" : "借方",
        String(account.level),
        account.parent_code || "无",
        account.is_detail === 1 ? "末级" : "非末级",
        account.has_quantity === 1
          ? account.default_unit || "待补单位"
          : "未启用",
        account.has_auxiliary === 1 ? "已启用" : "未启用",
        accountStatus(account),
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      total: records.length,
      enabled: records.filter((account) => account.is_enabled === 1).length,
      detail: records.filter((account) => account.is_detail === 1).length,
      incomplete: records.filter(
        (account) => account.has_quantity === 1 && !account.default_unit,
      ).length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditingAccount(null);
    setDraft(emptyDraft());
    setShowEditor(true);
  };

  const openEdit = (account: AccountCode) => {
    setEditingAccount(account);
    setDraft(draftFromAccount(account));
    setShowEditor(true);
  };

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护会计科目。");
      return;
    }
    const level = Number(draft.level);
    const code = draft.code.trim();
    const parentCode = draft.parentCode.trim();
    const parent = records.find((account) => account.code === parentCode);
    if (
      !code ||
      !draft.name.trim() ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 9
    ) {
      setNotice("请填写科目编码、名称和 1 至 9 的有效级次。");
      return;
    }
    if (parentCode === code) {
      setNotice("上级科目不能是当前科目。");
      return;
    }
    if (parentCode && !parent) {
      setNotice("请选择当前账套中已经存在的上级科目。");
      return;
    }
    if (parent && level <= parent.level) {
      setNotice(
        `下级科目级次必须高于上级科目 ${parent.code} 的第 ${parent.level} 级。`,
      );
      return;
    }
    if (draft.hasQuantity && !draft.defaultUnit.trim()) {
      setNotice("启用数量核算时必须填写默认计量单位。");
      return;
    }
    const input = {
      code,
      company_id: companyId,
      name: draft.name.trim(),
      account_type: draft.accountType,
      normal_balance: draft.normalBalance,
      level,
      parent_code: parentCode || undefined,
      is_detail: draft.isDetail ? 1 : 0,
      has_quantity: draft.hasQuantity ? 1 : 0,
      default_unit: draft.hasQuantity ? draft.defaultUnit.trim() : undefined,
      has_auxiliary: draft.hasAuxiliary ? 1 : 0,
    };
    setSaving(true);
    if (!isTauri) {
      const record: AccountCode = editingAccount
        ? {
            ...editingAccount,
            ...input,
            parent_code: input.parent_code || null,
            default_unit: input.default_unit || null,
          }
        : {
            ...input,
            parent_code: input.parent_code || null,
            default_unit: input.default_unit || null,
            is_enabled: 1,
          };
      saveBrowserAccounts([
        record,
        ...loadBrowserAccounts().filter(
          (account) =>
            !(account.company_id === companyId && account.code === record.code),
        ),
      ]);
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingAccount ? "预览会计科目已更新。" : "预览会计科目已保存。",
      );
      await refresh();
      return;
    }
    try {
      if (editingAccount)
        await updateAccount(editingAccount.code, companyId, input);
      else await createAccount(input);
      setShowEditor(false);
      setNotice(
        editingAccount
          ? "会计科目已更新；历史凭证与已生成报表不会被重写。"
          : "会计科目已保存；后续凭证、报表和结转将使用新的核算口径。",
      );
    } catch (error) {
      setNotice(
        `${editingAccount ? "更新" : "新增"}会计科目失败：${String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const changeEnabled = async (account: AccountCode) => {
    if (!companyId) return;
    if (!isTauri) {
      const record = {
        ...account,
        is_enabled: account.is_enabled === 1 ? 0 : 1,
      };
      saveBrowserAccounts([
        record,
        ...loadBrowserAccounts().filter(
          (item) =>
            !(item.company_id === companyId && item.code === account.code),
        ),
      ]);
      setNotice(
        `预览科目“${account.code} ${account.name}”已${record.is_enabled === 1 ? "启用" : "停用"}。`,
      );
      await refresh();
      return;
    }
    try {
      const result = await toggleAccount(account.code, companyId);
      setNotice(
        `科目“${result.code} ${result.name}”已${result.is_enabled === 1 ? "启用" : "停用"}。`,
      );
    } catch (error) {
      setNotice(`更新科目状态失败：${String(error)}`);
    }
  };

  const removeAccount = async (account: AccountCode) => {
    if (!companyId) return;
    const hasChildren = records.some(
      (candidate) => candidate.parent_code === account.code,
    );
    if (hasChildren) {
      setNotice(
        `科目“${account.code} ${account.name}”仍有下级科目，不能删除。`,
      );
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除科目“${account.code} ${account.name}”吗？已引用的科目将被系统阻止删除。`,
      )
    )
      return;
    if (!isTauri) {
      saveBrowserAccounts(
        loadBrowserAccounts().filter(
          (item) =>
            !(item.company_id === companyId && item.code === account.code),
        ),
      );
      setNotice(`预览科目“${account.code} ${account.name}”已删除。`);
      await refresh();
      return;
    }
    try {
      await deleteAccount(account.code, companyId);
      setNotice(`科目“${account.code} ${account.name}”已删除。`);
    } catch (error) {
      setNotice(`删除科目失败：${String(error)}`);
    }
  };

  const rowActions = (account: AccountCode) => (
    <div className="flex flex-wrap justify-end gap-1.5">
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
        onClick={() => void changeEnabled(account)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        {account.is_enabled === 1 ? "停用" : "启用"}
      </button>
      <button
        type="button"
        onClick={() => void removeAccount(account)}
        className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
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
              <BookOpenCheck className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">会计科目与核算口径</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              维护层级、余额方向、数量与辅助核算。科目变更只影响后续凭证建议、账簿和报表取数，不会重写历史凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="会计科目清单"
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
              disabled={!companyId}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              新增科目
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={BookOpenCheck}
            label="科目总数"
            value={`${metrics.total} 个`}
          />
          <Metric
            icon={BadgeCheck}
            label="启用中"
            value={`${metrics.enabled} 个`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={Layers3}
            label="末级明细"
            value={`${metrics.detail} 个`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={Boxes}
            label="单位待补"
            value={`${metrics.incomplete} 个`}
            tone="text-amber-600 dark:text-amber-400"
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_12rem_18rem]">
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
          <select
            aria-label="科目类别"
            value={accountType}
            onChange={(event) => {
              setAccountType(event.target.value);
              setPage(1);
            }}
            className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
          >
            <option value="all">全部类别</option>
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {type}
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
              placeholder="搜索编码、名称、类别或上级科目"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {accountError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            读取会计科目失败：{accountError}
          </div>
        )}
        {!companyId && (
          <Placeholder message="请选择账套后查看或维护会计科目。" />
        )}
        {companyId && loading && <Placeholder message="正在读取会计科目..." />}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-medium">科目编码</th>
                    <th className="w-[16%] px-3 py-3 font-medium">科目名称</th>
                    <th className="w-[12%] px-3 py-3 font-medium">类别</th>
                    <th className="w-[8%] px-3 py-3 font-medium">余额方向</th>
                    <th className="w-[6%] px-3 py-3 text-center font-medium">
                      级次
                    </th>
                    <th className="w-[12%] px-3 py-3 font-medium">上级科目</th>
                    <th className="w-[8%] px-3 py-3 font-medium">明细</th>
                    <th className="w-[8%] px-3 py-3 font-medium">数量</th>
                    <th className="w-[8%] px-3 py-3 font-medium">辅助</th>
                    <th className="w-[7%] px-3 py-3 font-medium">状态</th>
                    <th className="w-[15%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accountPage.rows.map((account) => (
                    <tr
                      key={account.code}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={account.code}
                      >
                        {account.code}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-medium"
                        title={account.name}
                      >
                        {account.name}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={account.account_type}
                      >
                        {account.account_type}
                      </td>
                      <td className="px-3 py-3">
                        {account.normal_balance === "credit" ? "贷方" : "借方"}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {account.level}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono"
                        title={account.parent_code || ""}
                      >
                        {account.parent_code || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {account.is_detail === 1 ? "末级" : "非末级"}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={account.default_unit || ""}
                      >
                        {account.has_quantity === 1
                          ? account.default_unit || "待补"
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {account.has_auxiliary === 1 ? "已启用" : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={accountStatus(account)} />
                      </td>
                      <td className="px-3 py-3">{rowActions(account)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {accountPage.rows.map((account) => (
                <article
                  key={account.code}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {account.code}
                      </p>
                      <p className="mt-1 truncate text-sm">{account.name}</p>
                    </div>
                    <Status status={accountStatus(account)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info label="类别" value={account.account_type} />
                    <Info
                      label="余额方向"
                      value={
                        account.normal_balance === "credit" ? "贷方" : "借方"
                      }
                    />
                    <Info
                      label="级次 / 上级"
                      value={`${account.level} 级${account.parent_code ? ` / ${account.parent_code}` : ""}`}
                    />
                    <Info
                      label="核算"
                      value={[
                        account.is_detail === 1 ? "末级" : "非末级",
                        account.has_quantity === 1
                          ? `数量 ${account.default_unit || "待补"}`
                          : "",
                        account.has_auxiliary === 1 ? "辅助" : "",
                      ]
                        .filter(Boolean)
                        .join("；")}
                    />
                  </div>
                  <div className="mt-3">{rowActions(account)}</div>
                </article>
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <Placeholder message="当前筛选没有会计科目。" />
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
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <WorkflowLink
          icon={FileText}
          title="登记期初余额"
          description="期初余额按已启用末级科目维护，并在写入前执行借贷试算。"
          onClick={() => navigate("/settings/initial-balances")}
        />
        <WorkflowLink
          icon={Tags}
          title="配置凭证模板"
          description="默认科目应在凭证模板中明确借贷方向，不从科目页自动生成凭证。"
          onClick={() => navigate("/settings/voucher-templates")}
        />
        <WorkflowLink
          icon={Settings2}
          title="复核报表公式"
          description="报表取数与重分类规则需要独立维护，科目变更后应重新复核映射。"
          onClick={() => navigate("/settings/report-formulas")}
        />
      </section>
      {showEditor && (
        <AccountEditor
          draft={draft}
          editing={Boolean(editingAccount)}
          accounts={records}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveAccount}
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
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
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
function Placeholder({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
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
      className="min-w-0 border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-2 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}

function AccountEditor({
  draft,
  editing,
  accounts,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: AccountDraft;
  editing: boolean;
  accounts: AccountCode[];
  saving: boolean;
  onChange: (
    value: AccountDraft | ((current: AccountDraft) => AccountDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const parentOptions = accounts
    .filter((account) => account.code !== draft.code)
    .sort((left, right) => left.code.localeCompare(right.code));
  const editorInputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑会计科目" : "新增会计科目"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[94vh] w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">
              {editing ? "编辑会计科目" : "新增会计科目"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              编码保存后不可修改；有下级或凭证引用的科目不可删除。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            取消
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="科目编码 *">
            <input
              required
              disabled={editing}
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="如：1002"
              className={`${editorInputClass} disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800`}
            />
          </Field>
          <Field label="科目名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：银行存款"
              className={editorInputClass}
            />
          </Field>
          <Field label="科目类别 *">
            <select
              value={draft.accountType}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  accountType: event.target.value,
                  normalBalance: ["资产类", "成本类"].includes(
                    event.target.value,
                  )
                    ? "debit"
                    : "credit",
                }))
              }
              className={editorInputClass}
            >
              {accountTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="余额方向 *">
            <select
              value={draft.normalBalance}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  normalBalance: event.target.value,
                }))
              }
              className={editorInputClass}
            >
              <option value="debit">借方</option>
              <option value="credit">贷方</option>
            </select>
          </Field>
          <Field label="级次 *">
            <input
              required
              type="number"
              min="1"
              max="9"
              value={draft.level}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  level: event.target.value,
                }))
              }
              className={editorInputClass}
            />
          </Field>
          <Field label="上级科目">
            <select
              value={draft.parentCode}
              onChange={(event) => {
                const parent = parentOptions.find(
                  (account) => account.code === event.target.value,
                );
                onChange((current) => ({
                  ...current,
                  parentCode: event.target.value,
                  level: parent
                    ? String(Math.min(9, parent.level + 1))
                    : current.level,
                }));
              }}
              className={editorInputClass}
            >
              <option value="">无（一级科目）</option>
              {parentOptions.map((account) => (
                <option key={account.code} value={account.code}>
                  {account.code} {account.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.isDetail}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isDetail: event.target.checked,
                }))
              }
            />
            末级明细科目
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.hasAuxiliary}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  hasAuxiliary: event.target.checked,
                }))
              }
            />
            启用辅助核算
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.hasQuantity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  hasQuantity: event.target.checked,
                  defaultUnit: event.target.checked ? current.defaultUnit : "",
                }))
              }
            />
            启用数量核算
          </label>
          {draft.hasQuantity && (
            <Field label="默认计量单位 *">
              <input
                required
                value={draft.defaultUnit}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    defaultUnit: event.target.value,
                  }))
                }
                placeholder="如：件、台、千克"
                className={editorInputClass}
              />
            </Field>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
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
            className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            {saving ? "正在保存" : "保存科目"}
          </button>
        </footer>
      </form>
    </div>
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
