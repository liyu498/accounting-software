import {
  CheckCircle2,
  CircleAlert,
  FilePenLine,
  FileText,
  Hash,
  Landmark,
  Plus,
  Power,
  RefreshCw,
  Search,
  Tag,
  type LucideIcon,
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
  loadBrowserPreviewBusinessTags as loadPreviewTags,
  saveBrowserPreviewBusinessTags as savePreviewTags,
} from "../../lib/browserPreviewBusinessTags.js";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import {
  useBusinessTagStore,
  type BusinessTag,
  type BusinessTagInput,
} from "../../stores/businessTagStore";
import { useCompanyStore } from "../../stores/companyStore";

type TagDraft = {
  name: string;
  applicableModules: string[];
  colorName: string;
  autoRule: string;
  remarks: string;
  isEnabled: boolean;
};

const applicableModules = ["发票", "流水", "凭证", "单据", "报表", "税表"];
const colorOptions = [
  {
    name: "蓝色",
    dot: "bg-sky-500",
    chip: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200",
  },
  {
    name: "绿色",
    dot: "bg-emerald-500",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
  },
  {
    name: "橙色",
    dot: "bg-amber-500",
    chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  },
  {
    name: "红色",
    dot: "bg-rose-500",
    chip: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200",
  },
  {
    name: "灰色",
    dot: "bg-slate-500",
    chip: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
];

function emptyDraft(): TagDraft {
  return {
    name: "",
    applicableModules: ["发票"],
    colorName: "蓝色",
    autoRule: "",
    remarks: "",
    isEnabled: true,
  };
}

function draftFromTag(tag: BusinessTag): TagDraft {
  return {
    name: tag.name,
    applicableModules: splitModules(tag.applicable_modules),
    colorName: colorOptions.some((item) => item.name === tag.color_name)
      ? tag.color_name
      : "灰色",
    autoRule: tag.auto_rule || "",
    remarks: tag.remarks || "",
    isEnabled: tag.is_enabled === 1,
  };
}

function splitModules(value: string) {
  return value
    .split(/[、,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagChipClass(colorName: string) {
  return (
    colorOptions.find((option) => option.name === colorName)?.chip ||
    colorOptions[4].chip
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

export function BusinessTagWorkspace() {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const storeTags = useBusinessTagStore((state) => state.businessTags);
  const loading = useBusinessTagStore((state) => state.isLoading);
  const storeError = useBusinessTagStore((state) => state.error);
  const fetchBusinessTags = useBusinessTagStore(
    (state) => state.fetchBusinessTags,
  );
  const createBusinessTag = useBusinessTagStore(
    (state) => state.createBusinessTag,
  );
  const updateBusinessTag = useBusinessTagStore(
    (state) => state.updateBusinessTag,
  );
  const [previewTags, setPreviewTags] = useState<BusinessTag[]>([]);
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<"all" | "enabled" | "used" | "automatic">(
    "all",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [editorTag, setEditorTag] = useState<BusinessTag | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<TagDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewTags([]);
      return;
    }
    if (!isTauri) {
      setPreviewTags(loadPreviewTags(companyId));
      return;
    }
    await fetchBusinessTags(companyId);
  }, [companyId, fetchBusinessTags]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tags = useMemo(
    () =>
      isTauri
        ? storeTags.filter((tag) => tag.company_id === companyId)
        : previewTags,
    [companyId, previewTags, storeTags],
  );
  const filteredTags = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return tags.filter((tag) => {
      const matchesTerm =
        !term ||
        [
          tag.name,
          tag.applicable_modules,
          tag.auto_rule || "",
          tag.remarks || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesScope =
        scope === "all" ||
        (scope === "enabled" && tag.is_enabled === 1) ||
        (scope === "used" && tag.usage_count > 0) ||
        (scope === "automatic" && Boolean(tag.auto_rule));
      return matchesTerm && matchesScope;
    });
  }, [keyword, scope, tags]);
  const tagPage = useMemo(
    () => paginateOperationalRows(filteredTags, page, pageSize),
    [filteredTags, page, pageSize],
  );
  const exportHeaders = [
    "标签名称",
    "颜色",
    "适用模块",
    "自动规则",
    "引用次数",
    "状态",
    "备注",
    "更新时间",
  ];
  const exportRows = useMemo(
    () =>
      filteredTags.map((tag) => [
        tag.name,
        tag.color_name,
        tag.applicable_modules,
        tag.auto_rule || "未配置",
        String(tag.usage_count),
        tag.is_enabled === 1 ? "启用" : "停用",
        tag.remarks || "未填写",
        formatUpdatedAt(tag.updated_at),
      ]),
    [filteredTags],
  );
  const metrics = useMemo(
    () => ({
      total: tags.length,
      enabled: tags.filter((tag) => tag.is_enabled === 1).length,
      used: tags.reduce((total, tag) => total + tag.usage_count, 0),
      automatic: tags.filter((tag) => Boolean(tag.auto_rule)).length,
    }),
    [tags],
  );
  const scopes = [
    { id: "all" as const, label: `全部 ${metrics.total}` },
    { id: "enabled" as const, label: `启用 ${metrics.enabled}` },
    {
      id: "used" as const,
      label: `已使用 ${tags.filter((tag) => tag.usage_count > 0).length}`,
    },
    { id: "automatic" as const, label: `自动规则 ${metrics.automatic}` },
  ];

  const openCreate = () => {
    setDraft(emptyDraft());
    setEditorTag(null);
  };

  const openEdit = (tag: BusinessTag) => {
    setDraft(draftFromTag(tag));
    setEditorTag(tag);
  };

  const inputFromDraft = (): BusinessTagInput => ({
    companyId: companyId || "",
    name: draft.name.trim(),
    applicableModules: draft.applicableModules.join(" / "),
    colorName: draft.colorName,
    autoRule: draft.autoRule.trim() || undefined,
    remarks: draft.remarks.trim() || undefined,
    isEnabled: draft.isEnabled,
  });

  const saveTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !companyId ||
      !draft.name.trim() ||
      draft.applicableModules.length === 0
    ) {
      setNotice("请填写标签名称，并至少选择一个适用模块。");
      return;
    }
    const input = inputFromDraft();
    setSaving(true);
    try {
      if (!isTauri) {
        const timestamp = new Date().toISOString();
        const tag: BusinessTag = editorTag
          ? {
              ...editorTag,
              name: input.name,
              applicable_modules: input.applicableModules,
              color_name: input.colorName,
              auto_rule: input.autoRule || null,
              remarks: input.remarks || null,
              is_enabled: input.isEnabled ? 1 : 0,
              updated_at: timestamp,
            }
          : {
              id: `preview-business-tag-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
              company_id: companyId,
              name: input.name,
              applicable_modules: input.applicableModules,
              color_name: input.colorName,
              auto_rule: input.autoRule || null,
              usage_count: 0,
              remarks: input.remarks || null,
              is_enabled: input.isEnabled ? 1 : 0,
              created_at: timestamp,
              updated_at: timestamp,
            };
        const nextTags = [
          tag,
          ...previewTags.filter((item) => item.id !== tag.id),
        ];
        setPreviewTags(nextTags);
        savePreviewTags(companyId, nextTags);
      } else if (editorTag) {
        await updateBusinessTag(editorTag.id, input);
      } else {
        await createBusinessTag(input);
      }
      setEditorTag(undefined);
      setNotice(
        editorTag
          ? "标签已更新。已使用标签的历史关联保持不变。"
          : "标签已新增，可在对应业务单据中人工选择使用。",
      );
    } catch (error) {
      setNotice(`保存标签失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = async (tag: BusinessTag) => {
    if (!companyId) return;
    const input: BusinessTagInput = {
      companyId,
      name: tag.name,
      applicableModules: tag.applicable_modules,
      colorName: tag.color_name,
      autoRule: tag.auto_rule || undefined,
      remarks: tag.remarks || undefined,
      isEnabled: tag.is_enabled !== 1,
    };
    try {
      if (!isTauri) {
        const nextTags = previewTags.map((item) =>
          item.id === tag.id
            ? {
                ...item,
                is_enabled: item.is_enabled === 1 ? 0 : 1,
                updated_at: new Date().toISOString(),
              }
            : item,
        );
        setPreviewTags(nextTags);
        savePreviewTags(companyId, nextTags);
      } else {
        await updateBusinessTag(tag.id, input);
      }
      setNotice(
        tag.is_enabled === 1
          ? "标签已停用，不再供新增业务选择。"
          : "标签已启用，可在新增业务中选择。",
      );
    } catch (error) {
      setNotice(`更新标签状态失败：${String(error)}`);
    }
  };

  const actionButtons = (tag: BusinessTag) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => openEdit(tag)}
        className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FilePenLine className="h-3.5 w-3.5" />
        编辑
      </button>
      <button
        type="button"
        onClick={() => void toggleTag(tag)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Power className="h-3.5 w-3.5" />
        {tag.is_enabled === 1 ? "停用" : "启用"}
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
              <Tag className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">标签档案</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护发票、流水、凭证、单据、报表和税表使用的业务标签，并跟踪适用范围、自动规则与使用情况。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="业务标签清单"
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
              新增标签
            </button>
          </div>
        </header>
        {companyId && (
          <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium">使用边界</p>
              <p className="mt-1">
                标签只用于本地筛选、人工跟踪和风险提示，不会自动改写业务、生成凭证或提交税务。
              </p>
            </div>
            <p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
              已有使用记录的标签不提供删除入口。需要停止使用时请停用，以保留发票、凭证和流水的历史关联。
            </p>
          </div>
        )}
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric icon={Tag} label="标签数量" value={`${metrics.total} 个`} />
          <Metric
            icon={CheckCircle2}
            label="启用标签"
            value={`${metrics.enabled} 个`}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Metric
            icon={Hash}
            label="业务引用"
            value={`${metrics.used} 次`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={CircleAlert}
            label="自动规则"
            value={`${metrics.automatic} 条`}
            tone={
              metrics.automatic
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 xl:grid-cols-[minmax(0,1fr)_21rem]">
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
              placeholder="搜索标签、适用模块、自动规则或备注"
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && <Notice value={notice} />}
        {isTauri && storeError && (
          <Notice value={`标签数据读取提示：${storeError}`} />
        )}
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护业务标签。" />
        )}
        {companyId && loading && <EmptyState message="正在读取标签档案..." />}
        {companyId && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[16%] px-4 py-3 font-medium">标签</th>
                    <th className="w-[21%] px-4 py-3 font-medium">适用模块</th>
                    <th className="w-[22%] px-4 py-3 font-medium">自动规则</th>
                    <th className="w-[11%] px-4 py-3 text-right font-medium">
                      引用次数
                    </th>
                    <th className="w-[10%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[11%] px-4 py-3 font-medium">更新时间</th>
                    <th className="w-[9%] px-4 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tagPage.rows.map((tag) => (
                    <tr
                      key={tag.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex max-w-full truncate border px-2 py-0.5 text-xs ${tagChipClass(tag.color_name)}`}
                        >
                          {tag.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate">{tag.applicable_modules}</p>
                        <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                          {tag.remarks || "未填写备注"}
                        </p>
                      </td>
                      <td className="truncate px-4 py-3">
                        {tag.auto_rule || "未配置"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {tag.usage_count}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge enabled={tag.is_enabled === 1} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatUpdatedAt(tag.updated_at)}
                      </td>
                      <td className="px-4 py-3">{actionButtons(tag)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {tagPage.rows.map((tag) => (
                <article
                  key={tag.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex max-w-full truncate border px-2 py-0.5 text-xs ${tagChipClass(tag.color_name)}`}
                      >
                        {tag.name}
                      </span>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {tag.applicable_modules}
                      </p>
                    </div>
                    <StatusBadge enabled={tag.is_enabled === 1} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Info label="引用次数" value={`${tag.usage_count} 次`} />
                    <Info label="自动规则" value={tag.auto_rule || "未配置"} />
                    <Info label="备注" value={tag.remarks || "未填写"} />
                    <Info
                      label="更新时间"
                      value={formatUpdatedAt(tag.updated_at)}
                    />
                  </div>
                  <div className="mt-3">{actionButtons(tag)}</div>
                </article>
              ))}
            </div>
            {filteredTags.length === 0 && (
              <EmptyState message="当前筛选没有标签。新增标签后，可在对应业务单据中人工选择使用。" />
            )}
            <OperationalPagination
              page={tagPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}{" "}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={FileText}
          title="发票标签"
          description="在销项或进项发票中选择已启用标签，用于筛选、复核和风险提示。"
          onClick={() => navigate("/invoices/output")}
        />
        <QuickLink
          icon={Hash}
          title="凭证标签"
          description="为凭证补充业务标识，便于后续辅助查询和人工复核。"
          onClick={() => navigate("/vouchers")}
        />
        <QuickLink
          icon={Landmark}
          title="流水标签"
          description="在银行流水中添加标签，辅助匹配和异常跟踪。"
          onClick={() => navigate("/bank")}
        />
      </section>
      {editorTag !== undefined && (
        <TagEditor
          draft={draft}
          editing={Boolean(editorTag)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setEditorTag(undefined)}
          onSubmit={saveTag}
        />
      )}
    </main>
  );
}

function TagEditor({
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: TagDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: TagDraft | ((current: TagDraft) => TagDraft)) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass =
    "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
  const toggleModule = (module: string) =>
    onChange((current) => ({
      ...current,
      applicableModules: current.applicableModules.includes(module)
        ? current.applicableModules.filter((item) => item !== module)
        : [...current.applicableModules, module],
    }));
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "编辑业务标签" : "新增业务标签"}
    >
      <form
        onSubmit={onSubmit}
        className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑业务标签" : "新增业务标签"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            标签仅供本地业务筛选和人工复核；不会自动执行业务处理或对外提交。
          </p>
        </header>
        <div className="grid gap-4 p-4">
          <Field label="标签名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：待补附件"
              className={inputClass}
            />
          </Field>
          <fieldset>
            <legend className="text-xs text-slate-600 dark:text-slate-300">
              适用模块 *
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {applicableModules.map((module) => (
                <label
                  key={module}
                  className={`inline-flex h-8 cursor-pointer items-center gap-2 border px-2.5 text-xs ${draft.applicableModules.includes(module) ? "border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-200" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                >
                  <input
                    type="checkbox"
                    checked={draft.applicableModules.includes(module)}
                    onChange={() => toggleModule(module)}
                    className="h-3.5 w-3.5 accent-[#1f65a7]"
                  />
                  {module}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs text-slate-600 dark:text-slate-300">
              标签颜色
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      colorName: option.name,
                    }))
                  }
                  aria-label={`选择${option.name}`}
                  title={option.name}
                  className={`inline-flex h-8 items-center gap-2 border px-2.5 text-xs ${draft.colorName === option.name ? "border-[#1f65a7] ring-1 ring-[#1f65a7] dark:border-sky-500 dark:ring-sky-500" : "border-slate-300 dark:border-slate-700"}`}
                >
                  <span
                    className={`h-3 w-3 ${option.dot}`}
                    aria-hidden="true"
                  />
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="自动规则">
            <input
              value={draft.autoRule}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  autoRule: event.target.value,
                }))
              }
              placeholder="如：发票金额超过 10 万元时人工复核"
              className={inputClass}
            />
          </Field>
          <Field label="备注">
            <textarea
              value={draft.remarks}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  remarks: event.target.value,
                }))
              }
              placeholder="记录使用口径、复核人或注意事项"
              className="min-h-20 w-full resize-y border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </Field>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.isEnabled}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isEnabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1f65a7]"
            />
            保存后立即供新增业务选择
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
            {saving ? "正在保存" : editing ? "保存修改" : "保存标签"}
          </button>
        </footer>
      </form>
    </div>
  );
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
  icon: LucideIcon;
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
    <div className="min-w-0 text-xs">
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
      className="border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
