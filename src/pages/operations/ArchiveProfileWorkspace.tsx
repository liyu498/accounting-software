import {
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  FilePenLine,
  FilePlus2,
  FolderTree,
  Power,
  RefreshCw,
  Search,
  Users,
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
  auxiliaryArchiveDefinitions,
  parseAuxiliaryArchiveProfile,
  serializeAuxiliaryArchiveProfile,
  type AuxiliaryArchiveKind,
  type AuxiliaryArchiveProfile,
} from "../../lib/auxiliaryArchiveProfile";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import {
  useAuxiliaryStore,
  type AuxiliaryCategory,
  type AuxiliaryItem,
} from "../../stores/auxiliaryStore";
import { useCompanyStore } from "../../stores/companyStore";

type FieldKey = keyof AuxiliaryArchiveProfile;
type ProfileField = {
  key: FieldKey;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "date" | "number";
};
type ArchiveProfile = {
  kind: AuxiliaryArchiveKind;
  title: string;
  description: string;
  sourcePath: string;
  sourceAction: string;
  fields: ProfileField[];
  boundary: string;
  empty: string;
};
type ArchiveDraft = {
  code: string;
  name: string;
  metadata: AuxiliaryArchiveProfile;
};
type PreviewArchive = {
  categories: AuxiliaryCategory[];
  items: AuxiliaryItem[];
};

const previewStorageKey = "accounting-preview-auxiliary-archive-v1";
const profiles: Record<AuxiliaryArchiveKind, ArchiveProfile> = {
  customerArchive: {
    kind: "customerArchive",
    title: "客户档案",
    description: "维护销项、应收、收款核销和合同关联所需的客户辅助核算资料。",
    sourcePath: "/invoices/output",
    sourceAction: "查看销项发票",
    fields: [
      {
        key: "taxNo",
        label: "纳税人识别号",
        placeholder: "如：9131************",
        required: true,
      },
      { key: "bank", label: "开户行", placeholder: "如：中国银行上海分行" },
      {
        key: "subject",
        label: "默认往来科目",
        placeholder: "如：1122 应收账款",
        required: true,
      },
      { key: "contract", label: "关联合同", placeholder: "如：HT-2026-001" },
    ],
    boundary:
      "客户档案影响销项发票、收款核销和应收辅助账；停用后不应再用于新增业务单据。",
    empty: "暂无客户档案。新增客户后需复核税号、默认科目和合同关联。",
  },
  supplierArchive: {
    kind: "supplierArchive",
    title: "供应商档案",
    description: "维护进项发票识别、采购、应付核销和税率复核所需的供应商资料。",
    sourcePath: "/invoices/input",
    sourceAction: "查看进项发票",
    fields: [
      { key: "alias", label: "发票/流水别名", placeholder: "如：上海某某科技" },
      {
        key: "taxNo",
        label: "纳税人识别号",
        placeholder: "如：9131************",
        required: true,
      },
      {
        key: "subject",
        label: "默认往来科目",
        placeholder: "如：2202 应付账款",
        required: true,
      },
      { key: "taxRate", label: "常用税率", placeholder: "如：13%" },
    ],
    boundary:
      "供应商档案影响进项发票识别、付款核销和应付辅助账；税率和税号异常仍需人工复核。",
    empty: "暂无供应商档案。新增后需复核别名、税号、税率和默认科目。",
  },
  otherContactArchive: {
    kind: "otherContactArchive",
    title: "其他往来",
    description: "维护员工、股东、个人和临时往来的辅助核算主体。",
    sourcePath: "/reports/auxiliary-ledger",
    sourceAction: "查看辅助核算账",
    fields: [
      { key: "contactType", label: "往来类型", placeholder: "如：股东往来" },
      {
        key: "idNo",
        label: "证件号/税号",
        placeholder: "请输入脱敏证件号或税号",
      },
      {
        key: "subject",
        label: "默认往来科目",
        placeholder: "如：1221 其他应收款",
        required: true,
      },
      { key: "remark", label: "备注", placeholder: "如：代垫款往来" },
    ],
    boundary:
      "其他往来用于辅助核算，停用不会改写历史凭证；涉及自然人信息应仅维护必要的脱敏资料。",
    empty: "暂无其他往来档案。新增后请确认主体类型和默认科目。",
  },
  projectArchive: {
    kind: "projectArchive",
    title: "项目档案",
    description: "维护费用归集、研发辅助账和项目维度报表的项目资料。",
    sourcePath: "/expenses/reimbursements",
    sourceAction: "查看费用报销",
    fields: [
      { key: "owner", label: "项目负责人", placeholder: "如：张三" },
      { key: "start", label: "开始日期", placeholder: "", type: "date" },
      {
        key: "subject",
        label: "默认科目",
        placeholder: "如：5301 研发支出",
        required: true,
      },
      {
        key: "budget",
        label: "预算金额",
        placeholder: "如：500000",
        type: "number",
      },
    ],
    boundary:
      "项目档案影响费用归集、研发辅助账和项目维度报表；预算信息只作为归集复核依据，不自动生成凭证。",
    empty: "暂无项目档案。新增后请确认负责人、归集科目和预算口径。",
  },
  departmentArchive: {
    kind: "departmentArchive",
    title: "部门档案",
    description: "维护部门费用归集、人员归属和管理维度报表所需的组织资料。",
    sourcePath: "/employees",
    sourceAction: "查看人员登记",
    fields: [
      { key: "parent", label: "上级部门", placeholder: "如：总部" },
      { key: "owner", label: "部门负责人", placeholder: "如：李四" },
      {
        key: "subject",
        label: "默认费用科目",
        placeholder: "如：6602 管理费用",
        required: true,
      },
      {
        key: "people",
        label: "人员数量",
        placeholder: "如：12",
        type: "number",
      },
    ],
    boundary:
      "部门档案影响工资、费用归集和管理报表；停用后不应再用于新增人员或凭证分录。",
    empty: "暂无部门档案。新增后请确认上级部门、负责人和默认费用科目。",
  },
};

const previewCategories = Object.entries(auxiliaryArchiveDefinitions).map(
  ([kind, definition], index) => ({
    id: `preview-archive-${kind}`,
    company_id: "browser-preview-company",
    name: definition.categoryName,
    code: definition.categoryCode,
    is_system: 1,
    sort_order: index + 1,
  }),
);
function isCategory(value: unknown): value is AuxiliaryCategory {
  const item = value as Partial<AuxiliaryCategory>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.name === "string" &&
    typeof item.code === "string",
  );
}
function isItem(value: unknown): value is AuxiliaryItem {
  const item = value as Partial<AuxiliaryItem>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.category_id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.code === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(item.is_enabled),
  );
}
function emptyPreview(companyId: string): PreviewArchive {
  return {
    categories: previewCategories.map((category) => ({
      ...category,
      company_id: companyId,
    })),
    items: [],
  };
}
function loadPreview(companyId: string): PreviewArchive {
  if (typeof window === "undefined") return emptyPreview(companyId);
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewStorageKey) || "null",
    ) as Partial<PreviewArchive> | null;
    if (
      parsed &&
      Array.isArray(parsed.categories) &&
      Array.isArray(parsed.items) &&
      parsed.categories.every(isCategory) &&
      parsed.items.every(isItem)
    )
      return { categories: parsed.categories, items: parsed.items };
    return emptyPreview(companyId);
  } catch {
    return emptyPreview(companyId);
  }
}
function savePreview(data: PreviewArchive) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(previewStorageKey, JSON.stringify(data));
    } catch {
      /* Keep the rendered preview when local storage is unavailable. */
    }
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function emptyDraft(): ArchiveDraft {
  return { code: "", name: "", metadata: {} };
}
function draftFromItem(item: AuxiliaryItem): ArchiveDraft {
  return {
    code: item.code,
    name: item.name,
    metadata: parseAuxiliaryArchiveProfile(item.remarks),
  };
}

export function CustomerArchiveWorkspace() {
  return <ArchiveProfileWorkspace kind="customerArchive" />;
}
export function SupplierArchiveWorkspace() {
  return <ArchiveProfileWorkspace kind="supplierArchive" />;
}
export function OtherContactArchiveWorkspace() {
  return <ArchiveProfileWorkspace kind="otherContactArchive" />;
}
export function ProjectArchiveWorkspace() {
  return <ArchiveProfileWorkspace kind="projectArchive" />;
}
export function DepartmentArchiveWorkspace() {
  return <ArchiveProfileWorkspace kind="departmentArchive" />;
}

function ArchiveProfileWorkspace({ kind }: { kind: AuxiliaryArchiveKind }) {
  const profile = profiles[kind];
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const storeCategories = useAuxiliaryStore((state) => state.categories);
  const storeItems = useAuxiliaryStore((state) => state.items);
  const loading = useAuxiliaryStore((state) => state.isLoading);
  const storeError = useAuxiliaryStore((state) => state.error);
  const fetchCategories = useAuxiliaryStore((state) => state.fetchCategories);
  const fetchAllItems = useAuxiliaryStore((state) => state.fetchAllItems);
  const createItem = useAuxiliaryStore((state) => state.createItem);
  const updateItem = useAuxiliaryStore((state) => state.updateItem);
  const toggleItem = useAuxiliaryStore((state) => state.toggleItem);
  const [preview, setPreview] = useState<PreviewArchive>(() =>
    emptyPreview(companyId || "browser-preview-company"),
  );
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorItem, setEditorItem] = useState<
    AuxiliaryItem | null | undefined
  >(undefined);
  const [draft, setDraft] = useState<ArchiveDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreview(emptyPreview("browser-preview-company"));
      return;
    }
    if (!isTauri) {
      setPreview(loadPreview(companyId));
      return;
    }
    await Promise.all([fetchCategories(companyId), fetchAllItems(companyId)]);
  }, [companyId, fetchAllItems, fetchCategories]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const categories = isTauri ? storeCategories : preview.categories;
  const category = categories.find(
    (item) => item.code === auxiliaryArchiveDefinitions[kind].categoryCode,
  );
  const scopedItems = useMemo(
    () =>
      (isTauri ? storeItems : preview.items)
        .filter((item) => item.category_id === category?.id)
        .sort((left, right) => left.code.localeCompare(right.code, "zh-CN")),
    [category?.id, preview.items, storeItems],
  );
  const filteredItems = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return scopedItems.filter((item) => {
      const metadata = parseAuxiliaryArchiveProfile(item.remarks);
      return (
        (statusFilter === "all" ||
          (statusFilter === "enabled"
            ? item.is_enabled === 1
            : item.is_enabled !== 1)) &&
        (!term ||
          [
            item.code,
            item.name,
            ...profile.fields.map((field) => metadata[field.key] || ""),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [keyword, profile.fields, scopedItems, statusFilter]);
  const archivePage = useMemo(
    () => paginateOperationalRows(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  );
  const exportHeaders = [
    "档案编码",
    "档案名称",
    ...profile.fields.map((field) => field.label),
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredItems.map((item) => {
        const metadata = parseAuxiliaryArchiveProfile(item.remarks);
        return [
          item.code,
          item.name,
          ...profile.fields.map((field) => metadata[field.key] || "待补"),
          item.is_enabled === 1 ? "启用" : "停用",
        ];
      }),
    [filteredItems, profile.fields],
  );
  const metrics = useMemo(
    () => ({
      total: scopedItems.length,
      enabled: scopedItems.filter((item) => item.is_enabled === 1).length,
      missing: scopedItems.filter((item) => {
        const metadata = parseAuxiliaryArchiveProfile(item.remarks);
        return profile.fields.some(
          (field) => field.required && !metadata[field.key]?.trim(),
        );
      }).length,
      disabled: scopedItems.filter((item) => item.is_enabled !== 1).length,
    }),
    [profile.fields, scopedItems],
  );
  const openCreate = () => {
    setEditorItem(null);
    setDraft(emptyDraft());
    setSaving(false);
  };
  const openEdit = (item: AuxiliaryItem) => {
    setEditorItem(item);
    setDraft(draftFromItem(item));
    setSaving(false);
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !category) {
      setNotice("当前账套缺少对应的系统辅助类别，请先完成辅助核算类别初始化。");
      return;
    }
    const code = draft.code.trim();
    const name = draft.name.trim();
    if (!code || !name) {
      setNotice("请填写档案编码和名称。");
      return;
    }
    if (
      profile.fields.some(
        (field) => field.required && !draft.metadata[field.key]?.trim(),
      )
    ) {
      setNotice("请补齐标记为必填的档案资料。");
      return;
    }
    if (!editorItem && scopedItems.some((item) => item.code === code)) {
      setNotice(`编码“${code}”已存在，请勿重复创建。`);
      return;
    }
    const remarks = serializeAuxiliaryArchiveProfile(draft.metadata);
    setSaving(true);
    try {
      if (!isTauri) {
        const data = loadPreview(companyId);
        const record: AuxiliaryItem = editorItem
          ? { ...editorItem, code, name, remarks }
          : {
              id: `preview-archive-item-${crypto.randomUUID()}`,
              category_id: category.id,
              company_id: companyId,
              code,
              name,
              is_enabled: 1,
              remarks,
            };
        const items = editorItem
          ? data.items.map((item) => (item.id === record.id ? record : item))
          : [...data.items, record];
        savePreview({ ...data, items });
        await refresh();
      } else if (editorItem)
        await updateItem(editorItem.id, {
          category_id: category.id,
          company_id: companyId,
          code,
          name,
          remarks,
        });
      else
        await createItem({
          category_id: category.id,
          company_id: companyId,
          code,
          name,
          remarks,
        });
      setEditorItem(undefined);
      setNotice(
        `${profile.title}“${name}”已${editorItem ? "更新" : "新增"}。${profile.boundary}`,
      );
    } catch (error) {
      setNotice(`保存${profile.title}失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (item: AuxiliaryItem) => {
    const action = item.is_enabled === 1 ? "停用" : "启用";
    if (
      !companyId ||
      (typeof window !== "undefined" &&
        !window.confirm(
          `确认${action}${profile.title}“${item.name}”吗？历史凭证和报表不会被改写。`,
        ))
    )
      return;
    try {
      if (!isTauri) {
        const data = loadPreview(companyId);
        savePreview({
          ...data,
          items: data.items.map((record) =>
            record.id === item.id
              ? { ...record, is_enabled: record.is_enabled === 1 ? 0 : 1 }
              : record,
          ),
        });
        await refresh();
      } else await toggleItem(item.id, companyId);
      setNotice(`${profile.title}“${item.name}”已${action}。`);
    } catch (error) {
      setNotice(`${action}${profile.title}失败：${String(error)}`);
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
              <ArchiveIcon kind={kind} />
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
              <FolderTree className="h-3.5 w-3.5" />
              {profile.sourceAction}
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={!companyId || !category}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增{profile.title}
            </button>
          </div>
        </header>
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护档案资料。" />
        )}
        {companyId && (
          <>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
                <p className="font-medium">使用边界</p>
                <p className="mt-1">{profile.boundary}</p>
              </div>
              <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                档案资料与系统辅助核算项目共用同一账套数据。删除留给受控数据治理流程，日常维护仅支持编辑和停用。
              </p>
            </div>
            {!category && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                未找到“{auxiliaryArchiveDefinitions[kind].categoryName}
                ”系统辅助类别，暂不能维护此档案。
              </div>
            )}
            {category && (
              <>
                <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
                  <Metric
                    icon={FolderTree}
                    label="档案数量"
                    value={String(metrics.total)}
                  />
                  <Metric
                    icon={Power}
                    label="启用中"
                    value={String(metrics.enabled)}
                    tone="text-emerald-600 dark:text-emerald-400"
                  />
                  <Metric
                    icon={CircleAlert}
                    label="必填待补"
                    value={String(metrics.missing)}
                    tone="text-amber-600 dark:text-amber-400"
                  />
                  <Metric
                    icon={Power}
                    label="已停用"
                    value={String(metrics.disabled)}
                    tone="text-slate-600 dark:text-slate-300"
                  />
                </div>
                <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_9rem_19rem]">
                  <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                    {profile.title}使用类别“{category.name}”和编码“
                    {category.code}”。变更仅影响后续单据选择与辅助归集。
                  </p>
                  <select
                    aria-label="档案状态"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass()}
                  >
                    <option value="all">全部状态</option>
                    <option value="enabled">启用</option>
                    <option value="disabled">停用</option>
                  </select>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                    <input
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value);
                        setPage(1);
                      }}
                      placeholder={`搜索编码、名称或${profile.fields[0].label}`}
                      className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                    />
                  </label>
                </div>
                {notice && <Notice value={notice} />}
                {storeError && (
                  <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                    读取档案失败：{storeError}
                  </div>
                )}
                {isTauri && loading ? (
                  <EmptyState message="正在读取当前账套的档案资料..." />
                ) : (
                  <ArchiveList
                    profile={profile}
                    items={archivePage.rows}
                    onEdit={openEdit}
                    onToggle={(item) => void changeStatus(item)}
                  />
                )}
                <OperationalPagination
                  page={archivePage}
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
      {editorItem !== undefined && category && (
        <ArchiveEditor
          profile={profile}
          draft={draft}
          editing={Boolean(editorItem)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorItem(undefined)}
          onSubmit={saveItem}
        />
      )}
    </main>
  );
}

function ArchiveList({
  profile,
  items,
  onEdit,
  onToggle,
}: {
  profile: ArchiveProfile;
  items: AuxiliaryItem[];
  onEdit: (item: AuxiliaryItem) => void;
  onToggle: (item: AuxiliaryItem) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[11%] px-3 py-3 font-medium">编码</th>
              <th className="w-[16%] px-3 py-3 font-medium">名称</th>
              {profile.fields.map((field) => (
                <th key={field.key} className="w-[15%] px-3 py-3 font-medium">
                  {field.label}
                </th>
              ))}
              <th className="w-[8%] px-3 py-3 font-medium">状态</th>
              <th className="w-[5%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => {
              const metadata = parseAuxiliaryArchiveProfile(item.remarks);
              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-3 py-3 font-mono">{item.code}</td>
                  <td
                    className="truncate px-3 py-3 font-medium"
                    title={item.name}
                  >
                    {item.name}
                  </td>
                  {profile.fields.map((field) => (
                    <td
                      key={field.key}
                      className="truncate px-3 py-3 text-slate-600 dark:text-slate-300"
                      title={metadata[field.key] || undefined}
                    >
                      {metadata[field.key] || "待补"}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <StatusBadge enabled={item.is_enabled === 1} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label="编辑档案"
                        onClick={() => onEdit(item)}
                        className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <FilePenLine className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={
                          item.is_enabled === 1 ? "停用档案" : "启用档案"
                        }
                        onClick={() => onToggle(item)}
                        className="inline-flex h-7 w-7 items-center justify-center border border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {items.map((item) => {
          const metadata = parseAuxiliaryArchiveProfile(item.remarks);
          return (
            <article
              key={item.id}
              className="border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {item.code}
                  </p>
                </div>
                <StatusBadge enabled={item.is_enabled === 1} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {profile.fields.map((field) => (
                  <Info
                    key={field.key}
                    label={field.label}
                    value={metadata[field.key] || "待补"}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="h-7 border border-slate-300 px-2 text-xs dark:border-slate-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  className="h-7 border border-sky-300 px-2 text-xs text-sky-700 dark:border-sky-800 dark:text-sky-300"
                >
                  {item.is_enabled === 1 ? "停用" : "启用"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {items.length === 0 && <EmptyState message={profile.empty} />}
    </>
  );
}

function ArchiveEditor({
  profile,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  profile: ArchiveProfile;
  draft: ArchiveDraft;
  editing: boolean;
  saving: boolean;
  onChange: (
    value: ArchiveDraft | ((current: ArchiveDraft) => ArchiveDraft),
  ) => void;
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
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-3xl"
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
          <Field label="档案编码 *">
            <input
              required
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="如：CUST-001"
              className={className}
            />
          </Field>
          <Field label="档案名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={`请输入${profile.title}名称`}
              className={className}
            />
          </Field>
          {profile.fields.map((field) => (
            <Field
              key={field.key}
              label={`${field.label}${field.required ? " *" : ""}`}
            >
              <input
                required={field.required}
                type={field.type || "text"}
                value={draft.metadata[field.key] || ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    metadata: {
                      ...current.metadata,
                      [field.key]: event.target.value,
                    },
                  }))
                }
                placeholder={field.placeholder}
                className={className}
              />
            </Field>
          ))}
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
            {saving ? "正在保存" : editing ? "保存修改" : "保存档案"}
          </button>
        </footer>
      </form>
    </div>
  );
}
function ArchiveIcon({ kind }: { kind: AuxiliaryArchiveKind }) {
  const Icon =
    kind === "projectArchive"
      ? BriefcaseBusiness
      : kind === "departmentArchive"
        ? Users
        : Building2;
  return <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />;
}
function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex border px-1.5 py-0.5 text-[11px] ${enabled ? "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
    >
      {enabled ? "启用" : "停用"}
    </span>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: typeof FolderTree;
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
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
