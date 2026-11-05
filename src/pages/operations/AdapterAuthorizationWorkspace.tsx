import {
  Building2,
  CircleAlert,
  Cable,
  ClipboardCheck,
  FilePenLine,
  FilePlus2,
  Landmark,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
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
import {
  automationApi,
  type AdapterAuthorization,
  type AdapterProviderConfig,
} from "../../lib/api";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";

type AdapterType = "tax" | "bank";
type EditableStatus = "pending" | "configured" | "expired" | "disabled";
type AdapterDraft = {
  adapterCode: string;
  region: string;
  authStatus: EditableStatus | "authorized";
  accountMask: string;
  loginIdentity: string;
  capabilityScope: string;
  lastCheckedDate: string;
  expiresDate: string;
  riskMessage: string;
};
type ConnectionDraft = {
  providerName: string;
  endpoint: string;
  credentialEnv: string;
  timeoutSeconds: number;
  isEnabled: boolean;
};
type AdapterProfile = {
  type: AdapterType;
  title: string;
  description: string;
  sourcePath: string;
  sourceAction: string;
  channelLabel: string;
  channelPlaceholder: string;
  defaultScope: string;
  boundary: string;
  empty: string;
};

const statusLabels: Record<string, string> = {
  pending: "待授权",
  configured: "已配置待复核",
  authorized: "已授权",
  expired: "已过期",
  disabled: "已停用",
};

const profiles: Record<AdapterType, AdapterProfile> = {
  tax: {
    type: "tax",
    title: "税局接口配置",
    description:
      "维护税局渠道、地区、脱敏识别信息和连接验证，为后续受控申报准备可信授权边界。",
    sourcePath: "/tax/workspace",
    sourceAction: "查看申报工作台",
    channelLabel: "税局渠道编码",
    channelPlaceholder: "如：电子税务局-上海",
    defaultScope: "申报资料准备、回执归档",
    boundary:
      "此页面只允许执行受控连接验证，不能在此页面发起税务提交、登录电子税务局或保存密码、令牌、Cookie、证书。连接验证不等于申报授权。",
    empty:
      "当前账套暂无税局渠道配置。新增后仍需通过受控流程完成授权和人工复核。",
  },
  bank: {
    type: "bank",
    title: "银行接口配置",
    description:
      "维护银行流水采集、回单和对账渠道的脱敏元数据与连接验证，明确可用范围。",
    sourcePath: "/bank",
    sourceAction: "查看银行流水",
    channelLabel: "银行渠道编码",
    channelPlaceholder: "如：招商银行-企业网银",
    defaultScope: "流水导入、回单归档、对账准备",
    boundary:
      "此页面只允许执行受控连接验证，不能在此页面登录网银、发起付款或保存密码、令牌、Cookie、证书。连接验证不授予付款能力。",
    empty:
      "当前账套暂无银行渠道配置。新增后仅作为受控导入与对账准备信息，不会连接银行系统。",
  },
};

function emptyDraft(profile: AdapterProfile): AdapterDraft {
  return {
    adapterCode: "",
    region: "",
    authStatus: "pending",
    accountMask: "",
    loginIdentity: "",
    capabilityScope: profile.defaultScope,
    lastCheckedDate: "",
    expiresDate: "",
    riskMessage: "",
  };
}

function emptyConnectionDraft(): ConnectionDraft {
  return {
    providerName: "",
    endpoint: "https://",
    credentialEnv: "",
    timeoutSeconds: 30,
    isEnabled: true,
  };
}

function connectionDraftFromConfig(
  config: AdapterProviderConfig | null,
): ConnectionDraft {
  return config
    ? {
        providerName: config.providerName,
        endpoint: config.endpoint,
        credentialEnv: config.credentialEnv,
        timeoutSeconds: config.timeoutSeconds,
        isEnabled: config.isEnabled,
      }
    : emptyConnectionDraft();
}

function draftFromAuthorization(record: AdapterAuthorization): AdapterDraft {
  return {
    adapterCode: record.adapterCode,
    region: record.region || "",
    authStatus: isEditableStatus(record.authStatus)
      ? record.authStatus
      : "authorized",
    accountMask: record.accountMask || "",
    loginIdentity: record.loginIdentity || "",
    capabilityScope: record.capabilityScope || "",
    lastCheckedDate: dateInputValue(record.lastCheckedAt),
    expiresDate: dateInputValue(record.expiresAt),
    riskMessage: record.riskMessage || "",
  };
}

function isEditableStatus(value: string): value is EditableStatus {
  return ["pending", "configured", "expired", "disabled"].includes(value);
}

function dateInputValue(value: string | null) {
  return value?.slice(0, 10) || "";
}

function displayDate(value: string | null) {
  return value?.slice(0, 10) || "未设置";
}

function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}

export function TaxAdapterWorkspace() {
  return <AdapterAuthorizationWorkspace type="tax" />;
}

export function BankAdapterWorkspace() {
  return <AdapterAuthorizationWorkspace type="bank" />;
}

function AdapterAuthorizationWorkspace({ type }: { type: AdapterType }) {
  const profile = profiles[type];
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const [records, setRecords] = useState<AdapterAuthorization[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorRecord, setEditorRecord] = useState<
    AdapterAuthorization | null | undefined
  >(undefined);
  const [draft, setDraft] = useState<AdapterDraft>(() => emptyDraft(profile));
  const [saving, setSaving] = useState(false);
  const [connectionRecord, setConnectionRecord] = useState<
    AdapterAuthorization | null
  >(null);
  const [connectionConfig, setConnectionConfig] =
    useState<AdapterProviderConfig | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(
    emptyConnectionDraft,
  );
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const response = await automationApi.getAdapterAuthorizations({
        companyId,
        adapterType: profile.type,
      });
      if (!response.success || !response.data)
        throw new Error(response.error || "未能读取接口配置");
      setRecords(
        response.data.sort((left, right) =>
          left.adapterCode.localeCompare(right.adapterCode, "zh-CN"),
        ),
      );
    } catch (error) {
      setNotice(`读取接口配置失败：${String(error)}`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, profile.type]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecords = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "all" && record.authStatus !== statusFilter)
        return false;
      return (
        !term ||
        [
          record.adapterCode,
          record.region || "",
          record.accountMask || "",
          record.loginIdentity || "",
          record.capabilityScope || "",
          record.riskMessage || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [keyword, records, statusFilter]);
  const authorizationPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    profile.channelLabel,
    "地区",
    "状态",
    "脱敏账号",
    "登录标识",
    "能力范围",
    "最近复核",
    "到期日",
    "风险提示",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.adapterCode,
        record.region || "未设置",
        statusLabels[record.authStatus] || record.authStatus,
        record.accountMask || "未设置",
        record.loginIdentity || "未设置",
        record.capabilityScope || "未设置",
        displayDate(record.lastCheckedAt),
        displayDate(record.expiresAt),
        record.riskMessage || "无",
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      total: records.length,
      review: records.filter(
        (record) =>
          record.authStatus === "pending" || record.authStatus === "configured",
      ).length,
      available: records.filter((record) => record.authStatus === "authorized")
        .length,
      attention: records.filter(
        (record) =>
          record.authStatus === "expired" ||
          record.authStatus === "disabled" ||
          Boolean(record.riskMessage?.trim()),
      ).length,
    }),
    [records],
  );

  const openCreate = () => {
    setEditorRecord(null);
    setDraft(emptyDraft(profile));
    setSaving(false);
  };

  const openEdit = (record: AdapterAuthorization) => {
    setEditorRecord(record);
    setDraft(draftFromAuthorization(record));
    setSaving(false);
  };

  const saveAuthorization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护接口配置。");
      return;
    }
    const adapterCode = draft.adapterCode.trim();
    if (!adapterCode) {
      setNotice(`请填写${profile.channelLabel}。`);
      return;
    }
    if (
      !editorRecord &&
      records.some((record) => record.adapterCode === adapterCode)
    ) {
      setNotice(
        `当前账套已存在渠道“${adapterCode}”。请编辑现有配置，避免重复授权记录。`,
      );
      return;
    }
    if (draft.authStatus === "authorized" && !editorRecord) {
      setNotice(
        "“已授权”只能由受控授权流程写入，新增配置请保持待授权或已配置待复核。",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await automationApi.upsertAdapterAuthorization({
        companyId,
        adapterType: profile.type,
        adapterCode,
        region: draft.region.trim() || undefined,
        authStatus: draft.authStatus,
        accountMask: draft.accountMask.trim() || undefined,
        loginIdentity: draft.loginIdentity.trim() || undefined,
        capabilityScope: draft.capabilityScope.trim() || undefined,
        lastCheckedAt: draft.lastCheckedDate || undefined,
        expiresAt: draft.expiresDate || undefined,
        riskMessage: draft.riskMessage.trim() || undefined,
      });
      if (!response.success || !response.data)
        throw new Error(response.error || "未能保存接口配置");
      await refresh();
      setEditorRecord(undefined);
      setNotice(
        `渠道“${adapterCode}”已${editorRecord ? "更新" : "记录"}。${profile.boundary}`,
      );
    } catch (error) {
      setNotice(`保存接口配置失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const disableAuthorization = async (record: AdapterAuthorization) => {
    if (record.authStatus === "authorized") {
      setNotice("已授权状态需由受控授权流程变更；此页面不能撤销外部授权。");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认停用渠道“${record.adapterCode}”吗？历史导入、对账和审计记录不会删除。`,
      )
    )
      return;
    try {
      const response = await automationApi.upsertAdapterAuthorization({
        companyId: record.companyId,
        adapterType: record.adapterType,
        adapterCode: record.adapterCode,
        region: record.region || undefined,
        authStatus: "disabled",
        accountMask: record.accountMask || undefined,
        loginIdentity: record.loginIdentity || undefined,
        capabilityScope: record.capabilityScope || undefined,
        lastCheckedAt: record.lastCheckedAt || undefined,
        expiresAt: record.expiresAt || undefined,
        riskMessage: record.riskMessage || undefined,
      });
      if (!response.success)
        throw new Error(response.error || "未能停用接口配置");
      await refresh();
      setNotice(`渠道“${record.adapterCode}”已停用，历史留痕已保留。`);
    } catch (error) {
      setNotice(`停用接口配置失败：${String(error)}`);
    }
  };

  const openConnection = async (record: AdapterAuthorization) => {
    setConnectionRecord(record);
    setConnectionConfig(null);
    setConnectionDraft(emptyConnectionDraft());
    setConnectionBusy(true);
    try {
      const response = await automationApi.getAdapterProviderConfig({
        companyId: record.companyId,
        authorizationId: record.id,
      });
      if (!response.success)
        throw new Error(response.error || "未能读取连接配置");
      setConnectionConfig(response.data || null);
      setConnectionDraft(connectionDraftFromConfig(response.data || null));
    } catch (error) {
      setNotice(`读取连接配置失败：${String(error)}`);
    } finally {
      setConnectionBusy(false);
    }
  };

  const saveConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!connectionRecord) return;
    setConnectionBusy(true);
    try {
      const response = await automationApi.upsertAdapterProviderConfig({
        id: connectionConfig?.id,
        companyId: connectionRecord.companyId,
        authorizationId: connectionRecord.id,
        providerName: connectionDraft.providerName.trim(),
        endpoint: connectionDraft.endpoint.trim(),
        credentialEnv: connectionDraft.credentialEnv.trim(),
        timeoutSeconds: connectionDraft.timeoutSeconds,
        isEnabled: connectionDraft.isEnabled,
      });
      if (!response.success || !response.data)
        throw new Error(response.error || "未能保存连接配置");
      setConnectionConfig(response.data);
      setConnectionDraft(connectionDraftFromConfig(response.data));
      await refresh();
      setNotice(
        `渠道“${connectionRecord.adapterCode}”的连接配置已保存，授权状态已重置为待验证。`,
      );
    } catch (error) {
      setNotice(`保存连接配置失败：${String(error)}`);
    } finally {
      setConnectionBusy(false);
    }
  };

  const verifyConnection = async () => {
    if (!connectionRecord || !connectionConfig) {
      setNotice("请先保存连接配置，再执行连接验证。");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认使用本机环境变量 ${connectionConfig.credentialEnv} 向“${connectionConfig.providerName}”发起一次授权验证吗？`,
      )
    )
      return;
    setVerifying(true);
    try {
      const response = await automationApi.verifyAdapterAuthorization({
        companyId: connectionRecord.companyId,
        authorizationId: connectionRecord.id,
      });
      if (!response.success || !response.data)
        throw new Error(response.error || "连接验证失败");
      await refresh();
      setConnectionRecord(response.data);
      setNotice(
        `渠道“${connectionRecord.adapterCode}”已通过真实接口连接验证，授权范围以服务端返回结果为准。`,
      );
    } catch (error) {
      await refresh();
      setNotice(`连接验证失败：${String(error)}`);
    } finally {
      setVerifying(false);
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
              <Landmark className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{profile.title}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              {profile.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${profile.title}清单`}
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
              onClick={() => navigate(profile.sourcePath)}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <Building2 className="h-3.5 w-3.5" />
              {profile.sourceAction}
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增渠道
            </button>
          </div>
        </header>
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护接口配置。" />
        )}
        {companyId && (
          <>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex items-center gap-1.5 font-medium">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  外部动作边界
                </div>
                <p className="mt-1">{profile.boundary}</p>
              </div>
              <div className="border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  记录范围
                </p>
                <p className="mt-1 leading-5">
                  仅保存渠道名称、脱敏账号、能力范围、到期日、风险提示与复核信息。不要输入密码、令牌、Cookie
                  或证书。
                </p>
              </div>
            </div>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={Landmark}
                label="渠道数量"
                value={String(metrics.total)}
              />
              <Metric
                icon={ClipboardCheck}
                label="待人工复核"
                value={String(metrics.review)}
                tone="text-amber-600 dark:text-amber-400"
              />
              <Metric
                icon={ShieldCheck}
                label="受控流程已授权"
                value={String(metrics.available)}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={CircleAlert}
                label="风险或停用"
                value={String(metrics.attention)}
                tone="text-rose-600 dark:text-rose-400"
              />
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_10rem_19rem]">
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                配置保存不会发起外部请求。更新状态后应由具备权限的人员在受控流程中完成复核。
              </p>
              <select
                aria-label="授权状态"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className={inputClass()}
              >
                <option value="all">全部状态</option>
                <option value="pending">待授权</option>
                <option value="configured">已配置待复核</option>
                <option value="authorized">已授权</option>
                <option value="expired">已过期</option>
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
                  placeholder="搜索渠道、地区、账号或能力范围"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {loading ? (
              <EmptyState message="正在读取当前账套的接口配置..." />
            ) : (
              <AuthorizationList
                profile={profile}
                records={authorizationPage.rows}
                onEdit={openEdit}
                onConnect={(record) => void openConnection(record)}
                onDisable={(record) => void disableAuthorization(record)}
              />
            )}
            <OperationalPagination
              page={authorizationPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {editorRecord !== undefined && (
        <AuthorizationEditor
          profile={profile}
          draft={draft}
          editing={Boolean(editorRecord)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorRecord(undefined)}
          onSubmit={saveAuthorization}
        />
      )}
      {connectionRecord && (
        <ConnectionEditor
          record={connectionRecord}
          config={connectionConfig}
          draft={connectionDraft}
          saving={connectionBusy}
          verifying={verifying}
          onChange={setConnectionDraft}
          onClose={() => setConnectionRecord(null)}
          onSubmit={saveConnection}
          onVerify={() => void verifyConnection()}
        />
      )}
    </main>
  );
}

function AuthorizationList({
  profile,
  records,
  onEdit,
  onConnect,
  onDisable,
}: {
  profile: AdapterProfile;
  records: AdapterAuthorization[];
  onEdit: (record: AdapterAuthorization) => void;
  onConnect: (record: AdapterAuthorization) => void;
  onDisable: (record: AdapterAuthorization) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[15%] px-3 py-3 font-medium">
                {profile.channelLabel}
              </th>
              <th className="w-[10%] px-3 py-3 font-medium">地区</th>
              <th className="w-[11%] px-3 py-3 font-medium">状态</th>
              <th className="w-[16%] px-3 py-3 font-medium">脱敏识别信息</th>
              <th className="w-[17%] px-3 py-3 font-medium">能力范围</th>
              <th className="w-[12%] px-3 py-3 font-medium">复核 / 到期</th>
              <th className="w-[10%] px-3 py-3 font-medium">风险提示</th>
              <th className="w-[9%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td
                  className="truncate px-3 py-3 font-medium"
                  title={record.adapterCode}
                >
                  {record.adapterCode}
                </td>
                <td
                  className="truncate px-3 py-3 text-slate-600 dark:text-slate-300"
                  title={record.region || undefined}
                >
                  {record.region || "未设置"}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={record.authStatus} />
                </td>
                <td className="px-3 py-3">
                  <p
                    className="truncate"
                    title={record.accountMask || undefined}
                  >
                    {record.accountMask || "未设置"}
                  </p>
                  <p
                    className="mt-0.5 truncate text-slate-500 dark:text-slate-400"
                    title={record.loginIdentity || undefined}
                  >
                    {record.loginIdentity || "无登录标识"}
                  </p>
                </td>
                <td
                  className="truncate px-3 py-3 text-slate-600 dark:text-slate-300"
                  title={record.capabilityScope || undefined}
                >
                  {record.capabilityScope || "未设置"}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  <p>复核 {displayDate(record.lastCheckedAt)}</p>
                  <p className="mt-0.5">到期 {displayDate(record.expiresAt)}</p>
                </td>
                <td
                  className="truncate px-3 py-3 text-rose-700 dark:text-rose-300"
                  title={record.riskMessage || undefined}
                >
                  {record.riskMessage || "无"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label="连接验证"
                      onClick={() => onConnect(record)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                    >
                      <Cable className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="编辑接口配置"
                      onClick={() => onEdit(record)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="停用接口配置"
                      disabled={record.authStatus === "disabled"}
                      onClick={() => onDisable(record)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {records.map((record) => (
          <article
            key={record.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {record.adapterCode}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {record.region || "地区未设置"} · 更新于{" "}
                  {displayDate(record.updatedAt)}
                </p>
              </div>
              <StatusBadge status={record.authStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Info label="脱敏账号" value={record.accountMask || "未设置"} />
              <Info label="登录标识" value={record.loginIdentity || "未设置"} />
              <Info
                label="能力范围"
                value={record.capabilityScope || "未设置"}
              />
              <Info
                label="复核 / 到期"
                value={`${displayDate(record.lastCheckedAt)} / ${displayDate(record.expiresAt)}`}
              />
            </div>
            {record.riskMessage && (
              <Info label="风险提示" value={record.riskMessage} />
            )}
            <div className="mt-3 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => onConnect(record)}
                className="h-7 border border-sky-300 px-2 text-xs text-sky-700 dark:border-sky-800 dark:text-sky-300"
              >
                连接验证
              </button>
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="h-7 border border-slate-300 px-2 text-xs dark:border-slate-700"
              >
                编辑
              </button>
              <button
                type="button"
                disabled={record.authStatus === "disabled"}
                onClick={() => onDisable(record)}
                className="h-7 border border-rose-300 px-2 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-900 dark:text-rose-300"
              >
                停用
              </button>
            </div>
          </article>
        ))}
      </div>
      {records.length === 0 && <EmptyState message={profile.empty} />}
    </>
  );
}

function AuthorizationEditor({
  profile,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  profile: AdapterProfile;
  draft: AdapterDraft;
  editing: boolean;
  saving: boolean;
  onChange: (
    value: AdapterDraft | ((current: AdapterDraft) => AdapterDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const className = inputClass();
  const authorizedByControlledFlow = draft.authStatus === "authorized";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑接口配置" : "新增接口配置"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-3xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑接口配置" : "新增接口配置"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            仅维护本地、脱敏的渠道元数据。不要输入密码、令牌、Cookie
            或证书；外部登录、报送和付款不在此页面执行。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label={`${profile.channelLabel} *`}>
            <input
              required
              disabled={editing}
              value={draft.adapterCode}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  adapterCode: event.target.value,
                }))
              }
              placeholder={profile.channelPlaceholder}
              className={className}
            />
          </Field>
          <Field label="地区">
            <input
              value={draft.region}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  region: event.target.value,
                }))
              }
              placeholder="如：上海市"
              className={className}
            />
          </Field>
          <Field label="授权状态">
            <select
              disabled={authorizedByControlledFlow}
              value={draft.authStatus}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  authStatus: event.target.value as EditableStatus,
                }))
              }
              className={className}
            >
              {authorizedByControlledFlow && (
                <option value="authorized">已授权（受控流程写入）</option>
              )}
              <option value="pending">待授权</option>
              <option value="configured">已配置待复核</option>
              <option value="expired">已过期</option>
              <option value="disabled">已停用</option>
            </select>
            {authorizedByControlledFlow && (
              <p className="text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                该状态不能在此页面手工变更。
              </p>
            )}
          </Field>
          <Field label="脱敏账号或主体标识">
            <input
              value={draft.accountMask}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  accountMask: event.target.value,
                }))
              }
              placeholder="如：6222 **** 1024 / 统一社会信用代码后四位"
              className={className}
            />
          </Field>
          <Field label="登录标识（脱敏）">
            <input
              value={draft.loginIdentity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  loginIdentity: event.target.value,
                }))
              }
              placeholder="如：admin*** / 操作员编号后四位"
              className={className}
            />
          </Field>
          <Field label="最近人工复核日期">
            <input
              type="date"
              value={draft.lastCheckedDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  lastCheckedDate: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <Field label="授权或复核到期日">
            <input
              type="date"
              value={draft.expiresDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  expiresDate: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <Field label="能力范围 *" className="sm:col-span-2">
            <textarea
              required
              rows={3}
              value={draft.capabilityScope}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  capabilityScope: event.target.value,
                }))
              }
              placeholder="如：流水导入、回单归档、对账准备"
              className="w-full resize-y border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </Field>
          <Field label="风险或复核提示" className="sm:col-span-2">
            <textarea
              rows={3}
              value={draft.riskMessage}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  riskMessage: event.target.value,
                }))
              }
              placeholder="如：待管理员在受控流程中复核授权范围"
              className="w-full resize-y border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
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
            {saving ? "正在保存" : editing ? "保存修改" : "保存配置"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ConnectionEditor({
  record,
  config,
  draft,
  saving,
  verifying,
  onChange,
  onClose,
  onSubmit,
  onVerify,
}: {
  record: AdapterAuthorization;
  config: AdapterProviderConfig | null;
  draft: ConnectionDraft;
  saving: boolean;
  verifying: boolean;
  onChange: (
    value: ConnectionDraft | ((current: ConnectionDraft) => ConnectionDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVerify: () => void;
}) {
  const className = inputClass();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="连接验证"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cable className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
            <h2 className="text-base font-semibold">连接验证</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            渠道：{record.adapterCode}。系统只保存凭证环境变量名，不会保存密钥；验证只确认授权与能力范围，不会发起申报、扣款或付款。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="服务名称 *">
            <input
              required
              value={draft.providerName}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  providerName: event.target.value,
                }))
              }
              placeholder="如：企业税务接口网关"
              className={className}
            />
          </Field>
          <Field label="请求超时（秒） *">
            <input
              required
              type="number"
              min={5}
              max={120}
              value={draft.timeoutSeconds}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  timeoutSeconds: Number(event.target.value),
                }))
              }
              className={className}
            />
          </Field>
          <Field label="HTTPS 验证地址 *" className="sm:col-span-2">
            <input
              required
              type="url"
              pattern="https://.*"
              value={draft.endpoint}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  endpoint: event.target.value,
                }))
              }
              placeholder="https://provider.example.com/authorization/verify"
              className={className}
            />
          </Field>
          <Field label="凭证环境变量 *" className="sm:col-span-2">
            <input
              required
              pattern="[A-Z0-9_]+"
              value={draft.credentialEnv}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  credentialEnv: event.target.value.toUpperCase(),
                }))
              }
              placeholder="如：ACCOUNTING_TAX_ADAPTER_TOKEN"
              className={className}
            />
            <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              密钥由桌面进程从本机环境变量读取；数据库、日志和页面均不保存密钥值。
            </p>
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 sm:col-span-2">
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
            启用此连接配置
          </label>
          <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100 sm:col-span-2">
            保存连接配置会将当前授权重置为“已配置待复核”。只有服务端返回明确的授权成功结果后，系统才会写入“已授权”。
          </div>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || verifying}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            关闭
          </button>
          <button
            type="submit"
            disabled={saving || verifying}
            className="h-8 border border-[#1f65a7] px-3 text-xs font-medium text-[#1f65a7] disabled:opacity-60 dark:border-sky-600 dark:text-sky-300"
          >
            {saving ? "正在保存" : "保存连接"}
          </button>
          <button
            type="button"
            onClick={onVerify}
            disabled={!config || saving || verifying || !draft.isEnabled}
            className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {verifying ? "正在验证" : "执行连接验证"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "authorized"
      ? "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
      : status === "pending" || status === "configured"
        ? "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300"
        : status === "expired"
          ? "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300"
          : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";
  return (
    <span
      className={`inline-flex whitespace-nowrap border px-1.5 py-0.5 text-[11px] ${tone}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: typeof Landmark;
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
      <p className="mt-0.5 break-words text-slate-800 dark:text-slate-100">
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
