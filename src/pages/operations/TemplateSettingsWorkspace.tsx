import {
  BookText,
  FilePlus2,
  FileText,
  FolderPlus,
  Pencil,
  RefreshCw,
  Search,
  Tags,
  Trash2,
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
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useTemplateStore,
  type CommonDigest,
  type TemplateEntry,
  type VoucherTemplateType,
  type VoucherTemplateWithEntries,
} from "../../stores/templateStore";

type WorkspaceMode = "digests" | "templates";
type EditorMode = "digest" | "template" | "type" | null;
type TemplateDraft = {
  typeId: string;
  name: string;
  summary: string;
  debitCode: string;
  debitName: string;
  creditCode: string;
  creditName: string;
};

const digestStorageKey = "accounting-preview-common-digests-v1";
const templateStorageKey = "accounting-preview-voucher-templates-v1";
const typeStorageKey = "accounting-preview-voucher-template-types-v1";

function readStorage<T>(
  key: string,
  predicate: (value: unknown) => value is T,
): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(predicate) : [];
  } catch {
    return [];
  }
}
function writeStorage<T>(key: string, values: T[]) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(key, JSON.stringify(values));
    } catch {
      /* Keep the active browser view usable when storage is unavailable. */
    }
}
function isDigest(value: unknown): value is CommonDigest {
  const item = value as Partial<CommonDigest>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.content === "string",
  );
}
function isType(value: unknown): value is VoucherTemplateType {
  const item = value as Partial<VoucherTemplateType>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(item.sort_order),
  );
}
function isEntry(value: unknown): value is TemplateEntry {
  const item = value as Partial<TemplateEntry>;
  return Boolean(
    item &&
    typeof item.account_code === "string" &&
    typeof item.account_name === "string" &&
    (item.direction === "debit" || item.direction === "credit") &&
    typeof item.summary === "string",
  );
}
function isTemplate(value: unknown): value is VoucherTemplateWithEntries {
  const item = value as Partial<VoucherTemplateWithEntries>;
  return Boolean(
    item &&
    item.template &&
    typeof item.template.id === "string" &&
    typeof item.template.company_id === "string" &&
    typeof item.template.type_id === "string" &&
    typeof item.template.name === "string" &&
    Array.isArray(item.entries) &&
    item.entries.every(isEntry),
  );
}
function loadDigests() {
  return readStorage(digestStorageKey, isDigest);
}
function loadTypes() {
  return readStorage(typeStorageKey, isType);
}
function loadTemplates() {
  return readStorage(templateStorageKey, isTemplate);
}
function modalInputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}

export function CommonDigestWorkspace() {
  return <TemplateSettingsWorkspace mode="digests" />;
}
export function VoucherTemplateWorkspace() {
  return <TemplateSettingsWorkspace mode="templates" />;
}

function TemplateSettingsWorkspace({ mode }: { mode: WorkspaceMode }) {
  const navigate = useNavigate();
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const commonDigests = useTemplateStore((state) => state.commonDigests);
  const voucherTemplateTypes = useTemplateStore(
    (state) => state.voucherTemplateTypes,
  );
  const voucherTemplates = useTemplateStore((state) => state.voucherTemplates);
  const isLoading = useTemplateStore((state) => state.isLoading);
  const error = useTemplateStore((state) => state.error);
  const fetchTemplateWorkspace = useTemplateStore(
    (state) => state.fetchTemplateWorkspace,
  );
  const createCommonDigest = useTemplateStore(
    (state) => state.createCommonDigest,
  );
  const updateCommonDigest = useTemplateStore(
    (state) => state.updateCommonDigest,
  );
  const deleteCommonDigest = useTemplateStore(
    (state) => state.deleteCommonDigest,
  );
  const createVoucherTemplateType = useTemplateStore(
    (state) => state.createVoucherTemplateType,
  );
  const createVoucherTemplate = useTemplateStore(
    (state) => state.createVoucherTemplate,
  );
  const updateVoucherTemplate = useTemplateStore(
    (state) => state.updateVoucherTemplate,
  );
  const deleteVoucherTemplate = useTemplateStore(
    (state) => state.deleteVoucherTemplate,
  );
  const [previewDigests, setPreviewDigests] = useState<CommonDigest[]>([]);
  const [previewTypes, setPreviewTypes] = useState<VoucherTemplateType[]>([]);
  const [previewTemplates, setPreviewTemplates] = useState<
    VoucherTemplateWithEntries[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [digestDraft, setDigestDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    typeId: "",
    name: "",
    summary: "",
    debitCode: "",
    debitName: "",
    creditCode: "",
    creditName: "",
  });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewDigests([]);
      setPreviewTypes([]);
      setPreviewTemplates([]);
      return;
    }
    if (isTauri) {
      await fetchTemplateWorkspace(companyId);
      return;
    }
    setPreviewDigests(
      loadDigests()
        .filter((item) => item.company_id === companyId)
        .sort((left, right) => left.content.localeCompare(right.content)),
    );
    setPreviewTypes(
      loadTypes()
        .filter((item) => item.company_id === companyId)
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.name.localeCompare(right.name),
        ),
    );
    setPreviewTemplates(
      loadTemplates()
        .filter((item) => item.template.company_id === companyId)
        .sort((left, right) =>
          left.template.name.localeCompare(right.template.name),
        ),
    );
  }, [companyId, fetchTemplateWorkspace]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const digests = isTauri ? commonDigests : previewDigests;
  const types = isTauri ? voucherTemplateTypes : previewTypes;
  const templates = isTauri ? voucherTemplates : previewTemplates;
  const typeById = useMemo(
    () => new Map(types.map((item) => [item.id, item])),
    [types],
  );
  const term = keyword.trim().toLowerCase();
  const filteredDigests = useMemo(
    () =>
      digests.filter(
        (item) => !term || item.content.toLowerCase().includes(term),
      ),
    [digests, term],
  );
  const filteredTemplates = useMemo(
    () =>
      templates.filter((item) => {
        const searchable = [
          item.template.name,
          typeById.get(item.template.type_id)?.name || "",
          ...item.entries.flatMap((entry) => [
            entry.summary,
            entry.account_code,
            entry.account_name,
          ]),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (selectedTypeId === "all" ||
            item.template.type_id === selectedTypeId) &&
          (!term || searchable.includes(term))
        );
      }),
    [selectedTypeId, templates, term, typeById],
  );
  const digestPage = useMemo(
    () => paginateOperationalRows(filteredDigests, page, pageSize),
    [filteredDigests, page, pageSize],
  );
  const templatePage = useMemo(
    () => paginateOperationalRows(filteredTemplates, page, pageSize),
    [filteredTemplates, page, pageSize],
  );
  const exportHeaders =
    mode === "digests"
      ? ["摘要内容", "字符数", "使用边界"]
      : ["模板名称", "分类", "摘要规则", "借方科目", "贷方科目"];
  const exportRows = useMemo(() => {
    if (mode === "digests")
      return filteredDigests.map((item) => [
        item.content,
        `${item.content.length} 字`,
        "凭证、流水、AI 建议",
      ]);
    return filteredTemplates.map((item) => {
      const debit = item.entries.find((entry) => entry.direction === "debit");
      const credit = item.entries.find((entry) => entry.direction === "credit");
      return [
        item.template.name,
        typeById.get(item.template.type_id)?.name || "未分类",
        item.entries[0]?.summary || "未配置",
        debit ? `${debit.account_code} ${debit.account_name}` : "未配置",
        credit ? `${credit.account_code} ${credit.account_name}` : "未配置",
      ];
    });
  }, [filteredDigests, filteredTemplates, mode, typeById]);

  const closeEditor = () => {
    setEditor(null);
    setEditingId(null);
    setSaving(false);
  };
  const openDigest = (digest?: CommonDigest) => {
    setEditingId(digest?.id || null);
    setDigestDraft(digest?.content || "");
    setEditor("digest");
  };
  const openType = () => {
    setTypeDraft("");
    setEditor("type");
  };
  const openTemplate = (template?: VoucherTemplateWithEntries) => {
    const debit = template?.entries.find(
      (entry) => entry.direction === "debit",
    );
    const credit = template?.entries.find(
      (entry) => entry.direction === "credit",
    );
    setEditingId(template?.template.id || null);
    setTemplateDraft({
      typeId: template?.template.type_id || types[0]?.id || "",
      name: template?.template.name || "",
      summary: template?.entries[0]?.summary || "",
      debitCode: debit?.account_code || "",
      debitName: debit?.account_name || "",
      creditCode: credit?.account_code || "",
      creditName: credit?.account_name || "",
    });
    setEditor("template");
  };

  const saveDigest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) return;
    const content = digestDraft.trim();
    if (!content) {
      setNotice("摘要内容不能为空。");
      return;
    }
    if (
      digests.some((item) => item.id !== editingId && item.content === content)
    ) {
      setNotice("当前账套中已存在相同摘要。");
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const record: CommonDigest = {
          id: editingId || `preview-digest-${crypto.randomUUID()}`,
          company_id: companyId,
          content,
        };
        const all = loadDigests();
        writeStorage(
          digestStorageKey,
          editingId
            ? all.map((item) => (item.id === editingId ? record : item))
            : [...all, record],
        );
        await refresh();
      } else if (editingId)
        await updateCommonDigest({ id: editingId, companyId, content });
      else await createCommonDigest({ companyId, content });
      setNotice(
        editingId ? `摘要“${content}”已更新。` : `摘要“${content}”已新增。`,
      );
      closeEditor();
    } catch (saveError) {
      setNotice(`保存摘要失败：${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeDigest = async (digest: CommonDigest) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确认删除摘要“${digest.content}”吗？`)
    )
      return;
    try {
      if (!isTauri) {
        writeStorage(
          digestStorageKey,
          loadDigests().filter((item) => item.id !== digest.id),
        );
        await refresh();
      } else await deleteCommonDigest(digest.id, companyId || "");
      setNotice(`摘要“${digest.content}”已删除。`);
    } catch (removeError) {
      setNotice(`删除摘要失败：${String(removeError)}`);
    }
  };

  const saveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) return;
    const name = typeDraft.trim();
    if (!name) {
      setNotice("模板分类名称不能为空。");
      return;
    }
    if (types.some((item) => item.name === name)) {
      setNotice("当前账套已存在同名模板分类。");
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const type: VoucherTemplateType = {
          id: `preview-template-type-${crypto.randomUUID()}`,
          company_id: companyId,
          name,
          sort_order: types.length + 1,
        };
        writeStorage(typeStorageKey, [...loadTypes(), type]);
        await refresh();
      } else
        await createVoucherTemplateType({
          companyId,
          name,
          sortOrder: types.length + 1,
        });
      setNotice(`模板分类“${name}”已创建。`);
      closeEditor();
    } catch (saveError) {
      setNotice(`创建模板分类失败：${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) return;
    const draft = {
      ...templateDraft,
      name: templateDraft.name.trim(),
      summary: templateDraft.summary.trim(),
      debitCode: templateDraft.debitCode.trim(),
      debitName: templateDraft.debitName.trim(),
      creditCode: templateDraft.creditCode.trim(),
      creditName: templateDraft.creditName.trim(),
    };
    if (!draft.typeId || !typeById.has(draft.typeId)) {
      setNotice("请选择当前账套的模板分类。");
      return;
    }
    if (
      !draft.name ||
      !draft.debitCode ||
      !draft.debitName ||
      !draft.creditCode ||
      !draft.creditName
    ) {
      setNotice("请填写模板名称以及完整的借贷科目编码和名称。");
      return;
    }
    if (
      templates.some(
        (item) =>
          item.template.id !== editingId && item.template.name === draft.name,
      )
    ) {
      setNotice("当前账套已存在同名凭证模板。");
      return;
    }
    const summary = draft.summary || draft.name;
    const entries: TemplateEntry[] = [
      {
        account_code: draft.debitCode,
        account_name: draft.debitName,
        direction: "debit",
        summary,
        auxiliary_type: null,
        auxiliary_id: null,
      },
      {
        account_code: draft.creditCode,
        account_name: draft.creditName,
        direction: "credit",
        summary,
        auxiliary_type: null,
        auxiliary_id: null,
      },
    ];
    setSaving(true);
    try {
      if (!isTauri) {
        const template = {
          id: editingId || `preview-voucher-template-${crypto.randomUUID()}`,
          type_id: draft.typeId,
          company_id: companyId,
          name: draft.name,
          entries_json: JSON.stringify(entries),
        };
        const record: VoucherTemplateWithEntries = { template, entries };
        const all = loadTemplates();
        writeStorage(
          templateStorageKey,
          editingId
            ? all.map((item) =>
                item.template.id === editingId ? record : item,
              )
            : [...all, record],
        );
        await refresh();
      } else if (editingId)
        await updateVoucherTemplate({
          id: editingId,
          companyId,
          typeId: draft.typeId,
          name: draft.name,
          entries,
        });
      else
        await createVoucherTemplate({
          companyId,
          typeId: draft.typeId,
          name: draft.name,
          entries,
        });
      setNotice(
        editingId
          ? `凭证模板“${draft.name}”已更新。`
          : `凭证模板“${draft.name}”已新增。`,
      );
      closeEditor();
    } catch (saveError) {
      setNotice(`保存凭证模板失败：${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (template: VoucherTemplateWithEntries) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除凭证模板“${template.template.name}”吗？不会影响已生成凭证。`,
      )
    )
      return;
    try {
      if (!isTauri) {
        writeStorage(
          templateStorageKey,
          loadTemplates().filter(
            (item) => item.template.id !== template.template.id,
          ),
        );
        await refresh();
      } else await deleteVoucherTemplate(template.template.id, companyId || "");
      setNotice(`凭证模板“${template.template.name}”已删除。`);
    } catch (removeError) {
      setNotice(`删除凭证模板失败：${String(removeError)}`);
    }
  };

  const title = mode === "digests" ? "常用摘要" : "凭证模板";
  const description =
    mode === "digests"
      ? "维护可复用的凭证摘要文本，供凭证录入、流水分类和 AI 建议人工确认后引用。"
      : "维护发票、流水和单据生成凭证时可复用的分类、摘要及借贷科目基础模板。";
  const Icon = mode === "digests" ? BookText : FileText;

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{title}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${title}清单`}
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
            {mode === "templates" && (
              <button
                type="button"
                onClick={openType}
                disabled={!companyId}
                className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                新增分类
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                mode === "digests" ? openDigest() : openTemplate()
              }
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {mode === "digests" ? "新增摘要" : "新增模板"}
            </button>
          </div>
        </header>
        {!companyId && <EmptyState message="请选择账套后查看或维护配置。" />}
        {companyId && (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={Icon}
                label={mode === "digests" ? "当前摘要" : "凭证模板"}
                value={String(
                  mode === "digests" ? digests.length : templates.length,
                )}
              />
              <Metric
                icon={Tags}
                label={mode === "digests" ? "可复用文本" : "模板分类"}
                value={String(
                  mode === "digests" ? filteredDigests.length : types.length,
                )}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={mode === "digests" ? FileText : BookText}
                label={mode === "digests" ? "应用边界" : "基础分录"}
                value={
                  mode === "digests"
                    ? "凭证与流水"
                    : `${templates.reduce((sum, item) => sum + item.entries.length, 0)} 条`
                }
                tone="text-sky-700 dark:text-sky-300"
              />
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-w-0 flex-wrap gap-1">
                {mode === "templates" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeId("all");
                        setPage(1);
                      }}
                      className={`h-8 border px-3 text-xs ${selectedTypeId === "all" ? "border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                    >
                      全部分类
                    </button>
                    {types.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedTypeId(type.id);
                          setPage(1);
                        }}
                        className={`max-w-full truncate border px-3 text-xs ${selectedTypeId === type.id ? "border-[#1f65a7] bg-blue-50 text-[#174f82] dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                      >
                        {type.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={
                    mode === "digests"
                      ? "搜索摘要内容"
                      : "搜索模板、摘要、科目或分类"
                  }
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {error && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取模板数据失败：{error}
              </div>
            )}
            {isTauri && isLoading ? (
              <EmptyState message="正在读取当前账套的模板配置..." />
            ) : mode === "digests" ? (
              <DigestList
                items={digestPage.rows}
                onEdit={openDigest}
                onDelete={removeDigest}
              />
            ) : (
              <TemplateList
                items={templatePage.rows}
                typeById={typeById}
                onEdit={openTemplate}
                onDelete={removeTemplate}
                onOpenAccounts={() => navigate("/settings/account-codes")}
              />
            )}
            <OperationalPagination
              page={mode === "digests" ? digestPage : templatePage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {editor === "digest" && (
        <DigestEditor
          value={digestDraft}
          saving={saving}
          editing={Boolean(editingId)}
          onChange={setDigestDraft}
          onClose={closeEditor}
          onSubmit={saveDigest}
        />
      )}
      {editor === "type" && (
        <TypeEditor
          value={typeDraft}
          saving={saving}
          onChange={setTypeDraft}
          onClose={closeEditor}
          onSubmit={saveType}
        />
      )}
      {editor === "template" && (
        <TemplateEditor
          draft={templateDraft}
          types={types}
          saving={saving}
          editing={Boolean(editingId)}
          onChange={setTemplateDraft}
          onClose={closeEditor}
          onSubmit={saveTemplate}
        />
      )}
    </main>
  );
}

function DigestList({
  items,
  onEdit,
  onDelete,
}: {
  items: CommonDigest[];
  onEdit: (item: CommonDigest) => void;
  onDelete: (item: CommonDigest) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[55%] px-3 py-3 font-medium">摘要内容</th>
              <th className="w-[18%] px-3 py-3 font-medium">字符数</th>
              <th className="w-[17%] px-3 py-3 font-medium">使用边界</th>
              <th className="w-[10%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td
                  className="truncate px-3 py-3 font-medium"
                  title={item.content}
                >
                  {item.content}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {item.content.length} 字
                </td>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                  凭证、流水、AI 建议
                </td>
                <td className="px-3 py-3">
                  <ActionButtons
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {items.map((item) => (
          <article
            key={item.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <p className="break-words text-sm font-medium">{item.content}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{item.content.length} 字 · 凭证、流水、AI 建议</span>
              <ActionButtons
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState message="尚未创建常用摘要。新增后可在凭证录入或人工确认 AI 建议时选用。" />
      )}
    </>
  );
}
function TemplateList({
  items,
  typeById,
  onEdit,
  onDelete,
  onOpenAccounts,
}: {
  items: VoucherTemplateWithEntries[];
  typeById: Map<string, VoucherTemplateType>;
  onEdit: (item: VoucherTemplateWithEntries) => void;
  onDelete: (item: VoucherTemplateWithEntries) => void;
  onOpenAccounts: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        模板中的科目编码和名称需与科目设置保持一致。
        <button
          type="button"
          onClick={onOpenAccounts}
          className="ml-2 text-sky-700 hover:underline dark:text-sky-300"
        >
          前往科目设置
        </button>
      </div>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[20%] px-3 py-3 font-medium">模板名称</th>
              <th className="w-[15%] px-3 py-3 font-medium">分类</th>
              <th className="w-[20%] px-3 py-3 font-medium">摘要规则</th>
              <th className="w-[17%] px-3 py-3 font-medium">借方科目</th>
              <th className="w-[17%] px-3 py-3 font-medium">贷方科目</th>
              <th className="w-[11%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => {
              const debit = item.entries.find(
                (entry) => entry.direction === "debit",
              );
              const credit = item.entries.find(
                (entry) => entry.direction === "credit",
              );
              return (
                <tr
                  key={item.template.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td
                    className="truncate px-3 py-3 font-medium"
                    title={item.template.name}
                  >
                    {item.template.name}
                  </td>
                  <td className="truncate px-3 py-3">
                    {typeById.get(item.template.type_id)?.name || "未分类"}
                  </td>
                  <td
                    className="truncate px-3 py-3"
                    title={item.entries[0]?.summary || ""}
                  >
                    {item.entries[0]?.summary || "—"}
                  </td>
                  <td
                    className="truncate px-3 py-3"
                    title={
                      debit ? `${debit.account_code} ${debit.account_name}` : ""
                    }
                  >
                    {debit
                      ? `${debit.account_code} ${debit.account_name}`
                      : "—"}
                  </td>
                  <td
                    className="truncate px-3 py-3"
                    title={
                      credit
                        ? `${credit.account_code} ${credit.account_name}`
                        : ""
                    }
                  >
                    {credit
                      ? `${credit.account_code} ${credit.account_name}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <ActionButtons
                      onEdit={() => onEdit(item)}
                      onDelete={() => onDelete(item)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {items.map((item) => {
          const debit = item.entries.find(
            (entry) => entry.direction === "debit",
          );
          const credit = item.entries.find(
            (entry) => entry.direction === "credit",
          );
          return (
            <article
              key={item.template.id}
              className="border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.template.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {typeById.get(item.template.type_id)?.name || "未分类"} ·{" "}
                    {item.entries[0]?.summary || "无摘要规则"}
                  </p>
                </div>
                <ActionButtons
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                />
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <Info
                  label="借方"
                  value={
                    debit ? `${debit.account_code} ${debit.account_name}` : "—"
                  }
                />
                <Info
                  label="贷方"
                  value={
                    credit
                      ? `${credit.account_code} ${credit.account_name}`
                      : "—"
                  }
                />
              </div>
            </article>
          );
        })}
      </div>
      {items.length === 0 && (
        <EmptyState message="尚未创建凭证模板。请先创建模板分类，再登记摘要和借贷科目。" />
      )}
    </>
  );
}
function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        aria-label="编辑"
        onClick={onEdit}
        className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="删除"
        onClick={onDelete}
        className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
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
      <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
        <span className="text-xs">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
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
function Modal({
  title,
  description,
  children,
  onClose,
  onSubmit,
  saving,
  submitLabel,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </header>
        {children}
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
            {saving ? "正在保存" : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
function DigestEditor({
  value,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  value: string;
  saving: boolean;
  editing: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={editing ? "编辑常用摘要" : "新增常用摘要"}
      description="摘要只保存文本规则，不会自动生成或审核凭证。"
      saving={saving}
      submitLabel={editing ? "保存修改" : "保存摘要"}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="p-4">
        <Field label="摘要内容 *">
          <input
            required
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="如：收到客户货款"
            className={modalInputClass()}
          />
        </Field>
      </div>
    </Modal>
  );
}
function TypeEditor({
  value,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="新增模板分类"
      description="分类用于整理模板和控制模板选择范围；已有模板分类不支持直接删除。"
      saving={saving}
      submitLabel="创建分类"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="p-4">
        <Field label="分类名称 *">
          <input
            required
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="如：销售、采购、费用、月末结转"
            className={modalInputClass()}
          />
        </Field>
      </div>
    </Modal>
  );
}
function TemplateEditor({
  draft,
  types,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: TemplateDraft;
  types: VoucherTemplateType[];
  saving: boolean;
  editing: boolean;
  onChange: (
    value: TemplateDraft | ((current: TemplateDraft) => TemplateDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputClass = modalInputClass();
  return (
    <Modal
      title={editing ? "编辑凭证模板" : "新增凭证模板"}
      description="当前页面维护基础借贷双分录模板；复杂多分录业务请在凭证草稿中人工补充并审核。"
      saving={saving}
      submitLabel={editing ? "保存修改" : "保存模板"}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label="模板名称 *">
          <input
            required
            autoFocus
            value={draft.name}
            onChange={(event) =>
              onChange((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="如：销售商品收入"
            className={inputClass}
          />
        </Field>
        <Field label="模板分类 *">
          <select
            required
            value={draft.typeId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                typeId: event.target.value,
              }))
            }
            className={inputClass}
          >
            <option value="">请选择分类</option>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="摘要规则">
            <input
              value={draft.summary}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              placeholder="如：销售{商品}"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            借方分录
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="科目编码 *">
              <input
                required
                value={draft.debitCode}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    debitCode: event.target.value,
                  }))
                }
                placeholder="1122"
                className={inputClass}
              />
            </Field>
            <Field label="科目名称 *">
              <input
                required
                value={draft.debitName}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    debitName: event.target.value,
                  }))
                }
                placeholder="应收账款"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            贷方分录
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="科目编码 *">
              <input
                required
                value={draft.creditCode}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    creditCode: event.target.value,
                  }))
                }
                placeholder="6001"
                className={inputClass}
              />
            </Field>
            <Field label="科目名称 *">
              <input
                required
                value={draft.creditName}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    creditName: event.target.value,
                  }))
                }
                placeholder="主营业务收入"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
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
