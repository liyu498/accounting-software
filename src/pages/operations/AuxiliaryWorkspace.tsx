import {
  Boxes,
  FilePenLine,
  FolderTree,
  ListTree,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
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
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import {
  useAuxiliaryStore,
  type AuxiliaryCategory,
  type AuxiliaryItem,
} from "../../stores/auxiliaryStore";

type Mode = "categories" | "items";
type PreviewArchive = {
  categories: AuxiliaryCategory[];
  items: AuxiliaryItem[];
};
type CategoryDraft = { code: string; name: string; sortOrder: string };
type ItemDraft = {
  categoryId: string;
  code: string;
  name: string;
  remarks: string;
};

const previewStorageKey = "accounting-preview-auxiliary-archives-v2";
const previewSystemCategories: AuxiliaryCategory[] = [
  {
    id: "system-aux-customer",
    company_id: "browser-preview",
    code: "CUST",
    name: "客户",
    is_system: 1,
    sort_order: 10,
  },
  {
    id: "system-aux-supplier",
    company_id: "browser-preview",
    code: "SUPP",
    name: "供应商",
    is_system: 1,
    sort_order: 20,
  },
  {
    id: "system-aux-other-contact",
    company_id: "browser-preview",
    code: "EMP",
    name: "其他往来",
    is_system: 1,
    sort_order: 30,
  },
  {
    id: "system-aux-project",
    company_id: "browser-preview",
    code: "PROJ",
    name: "项目",
    is_system: 1,
    sort_order: 40,
  },
  {
    id: "system-aux-department",
    company_id: "browser-preview",
    code: "DEPT",
    name: "部门",
    is_system: 1,
    sort_order: 50,
  },
];

function isCategory(value: unknown): value is AuxiliaryCategory {
  const item = value as Partial<AuxiliaryCategory>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.code === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(item.is_system) &&
    Number.isFinite(item.sort_order),
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
function emptyPreview(): PreviewArchive {
  return {
    categories: previewSystemCategories.map((item) => ({ ...item })),
    items: [],
  };
}
function loadPreview(): PreviewArchive {
  if (typeof window === "undefined") return emptyPreview();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewStorageKey) || "null",
    ) as Partial<PreviewArchive> | null;
    if (
      !parsed ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.items) ||
      !parsed.categories.every(isCategory) ||
      !parsed.items.every(isItem)
    )
      return emptyPreview();
    return { categories: parsed.categories, items: parsed.items };
  } catch {
    return emptyPreview();
  }
}
function savePreview(data: PreviewArchive) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(previewStorageKey, JSON.stringify(data));
  } catch {
    /* The browser preview remains usable until navigation if storage is unavailable. */
  }
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function orderedCategories(records: AuxiliaryCategory[]) {
  return [...records].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}

function AuxiliaryWorkspace({ mode }: { mode: Mode }) {
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
  const createCategory = useAuxiliaryStore((state) => state.createCategory);
  const updateCategory = useAuxiliaryStore((state) => state.updateCategory);
  const deleteCategory = useAuxiliaryStore((state) => state.deleteCategory);
  const createItem = useAuxiliaryStore((state) => state.createItem);
  const updateItem = useAuxiliaryStore((state) => state.updateItem);
  const deleteItem = useAuxiliaryStore((state) => state.deleteItem);
  const toggleItem = useAuxiliaryStore((state) => state.toggleItem);
  const [preview, setPreview] = useState<PreviewArchive>(emptyPreview);
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<
    AuxiliaryCategory | null | undefined
  >(undefined);
  const [itemEditor, setItemEditor] = useState<
    AuxiliaryItem | null | undefined
  >(undefined);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    code: "",
    name: "",
    sortOrder: "0",
  });
  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    categoryId: "",
    code: "",
    name: "",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreview(emptyPreview());
      return;
    }
    if (!isTauri) {
      setPreview(loadPreview());
      return;
    }
    await Promise.all([fetchCategories(companyId), fetchAllItems(companyId)]);
  }, [companyId, fetchAllItems, fetchCategories]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = useMemo(
    () =>
      orderedCategories(
        isTauri
          ? storeCategories
          : preview.categories.filter(
              (item) => item.is_system === 1 || item.company_id === companyId,
            ),
      ),
    [companyId, preview.categories, storeCategories],
  );
  const items = useMemo(
    () =>
      (isTauri
        ? storeItems
        : preview.items.filter((item) => item.company_id === companyId)
      ).sort((left, right) => left.code.localeCompare(right.code, "zh-CN")),
    [companyId, preview.items, storeItems],
  );
  const term = keyword.trim().toLowerCase();
  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          !term ||
          [
            category.code,
            category.name,
            category.is_system === 1 ? "系统预置" : "自定义",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [categories, term],
  );
  const categoryNames = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          `${category.code}｜${category.name}`,
        ]),
      ),
    [categories],
  );
  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !term ||
          [
            item.code,
            item.name,
            item.remarks || "",
            categoryNames.get(item.category_id) || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [categoryNames, items, term],
  );
  const categoryPage = useMemo(
    () => paginateOperationalRows(filteredCategories, page, pageSize),
    [filteredCategories, page, pageSize],
  );
  const itemPage = useMemo(
    () => paginateOperationalRows(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  );
  const exportHeaders =
    mode === "categories"
      ? ["类别编码", "类别名称", "来源", "显示顺序", "项目数量"]
      : ["项目编码", "项目名称", "所属类别", "状态", "备注"];
  const exportRows = useMemo(
    () =>
      mode === "categories"
        ? filteredCategories.map((category) => [
            category.code,
            category.name,
            category.is_system === 1 ? "系统预置" : "自定义",
            String(category.sort_order),
            String(
              items.filter((item) => item.category_id === category.id).length,
            ),
          ])
        : filteredItems.map((item) => [
            item.code,
            item.name,
            categoryNames.get(item.category_id) || "未找到类别",
            item.is_enabled === 1 ? "启用" : "停用",
            item.remarks || "未填写",
          ]),
    [categoryNames, filteredCategories, filteredItems, items, mode],
  );

  const persistPreview = (
    update: (current: PreviewArchive) => PreviewArchive,
  ) => {
    setPreview((current) => {
      const next = update(current);
      savePreview(next);
      return next;
    });
  };
  const openCategoryEditor = (category?: AuxiliaryCategory) => {
    if (category?.is_system === 1) {
      setNotice("系统预置辅助核算类别不能修改。");
      return;
    }
    setCategoryEditor(category || null);
    setCategoryDraft(
      category
        ? {
            code: category.code,
            name: category.name,
            sortOrder: String(category.sort_order),
          }
        : {
            code: "",
            name: "",
            sortOrder: String(
              (categories[categories.length - 1]?.sort_order || 0) + 10,
            ),
          },
    );
  };
  const openItemEditor = (item?: AuxiliaryItem) => {
    if (!categories.length) {
      setNotice("请先维护至少一个辅助核算类别，再新增项目。");
      return;
    }
    setItemEditor(item || null);
    setItemDraft(
      item
        ? {
            categoryId: item.category_id,
            code: item.code,
            name: item.name,
            remarks: item.remarks || "",
          }
        : { categoryId: categories[0].id, code: "", name: "", remarks: "" },
    );
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护辅助核算类别。");
      return;
    }
    const code = categoryDraft.code.trim().toUpperCase();
    const name = categoryDraft.name.trim();
    const sortOrder = Number(categoryDraft.sortOrder);
    if (
      !/^[A-Z][A-Z0-9_-]{1,31}$/.test(code) ||
      !name ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      setNotice("请填写 2 至 32 位大写编码、类别名称和非负整数显示顺序。");
      return;
    }
    if (
      categories.some(
        (item) => item.id !== categoryEditor?.id && item.code === code,
      )
    ) {
      setNotice(`类别编码 ${code} 已存在。`);
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const record: AuxiliaryCategory = {
          id:
            categoryEditor?.id || `preview-aux-category-${crypto.randomUUID()}`,
          company_id: companyId,
          code,
          name,
          is_system: 0,
          sort_order: sortOrder,
        };
        persistPreview((current) => ({
          ...current,
          categories: categoryEditor
            ? current.categories.map((item) =>
                item.id === record.id ? record : item,
              )
            : [...current.categories, record],
        }));
      } else if (categoryEditor)
        await updateCategory(categoryEditor.id, {
          company_id: companyId,
          code,
          name,
          sort_order: sortOrder,
        });
      else
        await createCategory({
          company_id: companyId,
          code,
          name,
          sort_order: sortOrder,
        });
      setNotice(
        categoryEditor
          ? `辅助类别“${name}”已更新。`
          : `辅助类别“${name}”已保存，可继续维护明细项目和科目关联。`,
      );
      setCategoryEditor(undefined);
    } catch (error) {
      setNotice(`保存辅助类别失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const removeCategory = async (category: AuxiliaryCategory) => {
    if (!companyId) return;
    if (category.is_system === 1) {
      setNotice("系统预置辅助核算类别不能删除。");
      return;
    }
    if (items.some((item) => item.category_id === category.id)) {
      setNotice(`类别“${category.name}”仍有关联项目，请先处理项目后再删除。`);
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除辅助类别“${category.code} ${category.name}”吗？已关联科目时桌面端会阻止删除。`,
      )
    )
      return;
    try {
      if (!isTauri)
        persistPreview((current) => ({
          ...current,
          categories: current.categories.filter(
            (item) => item.id !== category.id,
          ),
        }));
      else await deleteCategory(category.id, companyId);
      setNotice(`辅助类别“${category.name}”已删除。`);
    } catch (error) {
      setNotice(`删除辅助类别失败：${String(error)}`);
    }
  };
  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setNotice("请先在顶部选择账套，再维护辅助核算项目。");
      return;
    }
    const categoryId = itemDraft.categoryId;
    const code = itemDraft.code.trim().toUpperCase();
    const name = itemDraft.name.trim();
    const remarks = itemDraft.remarks.trim();
    if (!categoryId || !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) || !name) {
      setNotice("请选择类别，并填写 2 至 32 位项目编码和项目名称。");
      return;
    }
    if (
      items.some(
        (item) =>
          item.id !== itemEditor?.id &&
          item.category_id === categoryId &&
          item.code === code,
      )
    ) {
      setNotice(`当前类别内的项目编码 ${code} 已存在。`);
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const record: AuxiliaryItem = {
          id: itemEditor?.id || `preview-aux-item-${crypto.randomUUID()}`,
          category_id: categoryId,
          company_id: companyId,
          code,
          name,
          is_enabled: itemEditor?.is_enabled ?? 1,
          remarks: remarks || null,
        };
        persistPreview((current) => ({
          ...current,
          items: itemEditor
            ? current.items.map((item) =>
                item.id === record.id ? record : item,
              )
            : [...current.items, record],
        }));
      } else if (itemEditor)
        await updateItem(itemEditor.id, {
          category_id: categoryId,
          company_id: companyId,
          code,
          name,
          remarks: remarks || undefined,
        });
      else
        await createItem({
          category_id: categoryId,
          company_id: companyId,
          code,
          name,
          remarks: remarks || undefined,
        });
      setNotice(
        itemEditor
          ? `辅助项目“${name}”已更新。`
          : `辅助项目“${name}”已保存，可在凭证和账簿中引用。`,
      );
      setItemEditor(undefined);
    } catch (error) {
      setNotice(`保存辅助项目失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  const changeItemStatus = async (item: AuxiliaryItem) => {
    if (!companyId) return;
    const action = item.is_enabled === 1 ? "停用" : "启用";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认${action}辅助项目“${item.name}”吗？该状态影响后续凭证选择。`,
      )
    )
      return;
    try {
      if (!isTauri)
        persistPreview((current) => ({
          ...current,
          items: current.items.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  is_enabled: currentItem.is_enabled === 1 ? 0 : 1,
                }
              : currentItem,
          ),
        }));
      else await toggleItem(item.id, companyId);
      setNotice(`辅助项目“${item.name}”已${action}。`);
    } catch (error) {
      setNotice(`${action}辅助项目失败：${String(error)}`);
    }
  };
  const removeItem = async (item: AuxiliaryItem) => {
    if (!companyId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除辅助项目“${item.code} ${item.name}”吗？已用于凭证的项目不能删除。`,
      )
    )
      return;
    try {
      if (!isTauri)
        persistPreview((current) => ({
          ...current,
          items: current.items.filter(
            (currentItem) => currentItem.id !== item.id,
          ),
        }));
      else await deleteItem(item.id, companyId);
      setNotice(`辅助项目“${item.name}”已删除。`);
    } catch (error) {
      setNotice(`删除辅助项目失败：${String(error)}`);
    }
  };

  const title = mode === "categories" ? "辅助核算类别" : "辅助核算项目";
  const description =
    mode === "categories"
      ? "定义客户、供应商、项目、部门等维度的编码与顺序；系统预置类别由账套规则维护。"
      : "维护可被凭证、期初和辅助账引用的明细项目；停用后不应再用于新增凭证。";
  const metrics =
    mode === "categories"
      ? [
          {
            label: "类别总数",
            value: String(categories.length),
            icon: FolderTree,
          },
          {
            label: "系统预置",
            value: String(
              categories.filter((item) => item.is_system === 1).length,
            ),
            icon: ShieldCheck,
          },
          {
            label: "自定义类别",
            value: String(
              categories.filter((item) => item.is_system !== 1).length,
            ),
            icon: Boxes,
          },
        ]
      : [
          { label: "项目总数", value: String(items.length), icon: ListTree },
          {
            label: "启用中",
            value: String(items.filter((item) => item.is_enabled === 1).length),
            icon: Power,
          },
          {
            label: "已停用",
            value: String(items.filter((item) => item.is_enabled !== 1).length),
            icon: ShieldCheck,
          },
        ];

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {mode === "categories" ? (
                <FolderTree className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              ) : (
                <ListTree className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              )}
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
            <button
              type="button"
              onClick={() =>
                mode === "categories" ? openCategoryEditor() : openItemEditor()
              }
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {mode === "categories" ? "新增类别" : "新增项目"}
            </button>
          </div>
        </header>
        {!companyId && (
          <EmptyState message="请选择账套后查看或维护辅助核算资料。" />
        )}
        {companyId && (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              {metrics.map(({ label, value, icon: Icon }) => (
                <div key={label} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{label}</span>
                    <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                {mode === "categories"
                  ? "系统预置类别不可编辑或删除；删除自定义类别前须先解除项目和科目关联。"
                  : "项目编码在同一类别内唯一；删除前会校验是否已被凭证辅助分录引用。"}
              </p>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={
                    mode === "categories"
                      ? "搜索类别编码、名称或来源"
                      : "搜索类别、项目编码、名称或备注"
                  }
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {storeError && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取辅助核算资料失败：{storeError}
              </div>
            )}
            {isTauri && loading ? (
              <EmptyState message="正在读取当前账套的辅助核算资料..." />
            ) : mode === "categories" ? (
              <CategoryList
                categories={categoryPage.rows}
                items={items}
                onEdit={openCategoryEditor}
                onDelete={(category) => void removeCategory(category)}
              />
            ) : (
              <ItemList
                items={itemPage.rows}
                categoryNames={categoryNames}
                onEdit={openItemEditor}
                onToggle={(item) => void changeItemStatus(item)}
                onDelete={(item) => void removeItem(item)}
              />
            )}
            <OperationalPagination
              page={mode === "categories" ? categoryPage : itemPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {categoryEditor !== undefined && (
        <CategoryEditor
          draft={categoryDraft}
          saving={saving}
          editing={Boolean(categoryEditor)}
          onChange={setCategoryDraft}
          onClose={() => setCategoryEditor(undefined)}
          onSubmit={saveCategory}
        />
      )}
      {itemEditor !== undefined && (
        <ItemEditor
          draft={itemDraft}
          categories={categories}
          saving={saving}
          editing={Boolean(itemEditor)}
          onChange={setItemDraft}
          onClose={() => setItemEditor(undefined)}
          onSubmit={saveItem}
        />
      )}
    </main>
  );
}

export function AuxiliaryCategoryWorkspace() {
  return <AuxiliaryWorkspace mode="categories" />;
}
export function AuxiliaryItemWorkspace() {
  return <AuxiliaryWorkspace mode="items" />;
}

function CategoryList({
  categories,
  items,
  onEdit,
  onDelete,
}: {
  categories: AuxiliaryCategory[];
  items: AuxiliaryItem[];
  onEdit: (category: AuxiliaryCategory) => void;
  onDelete: (category: AuxiliaryCategory) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[20%] px-3 py-3 font-medium">类别编码</th>
              <th className="w-[24%] px-3 py-3 font-medium">类别名称</th>
              <th className="w-[18%] px-3 py-3 font-medium">来源</th>
              <th className="w-[16%] px-3 py-3 font-medium">显示顺序</th>
              <th className="w-[22%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((category) => (
              <tr
                key={category.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-3 font-mono font-medium">
                  {category.code}
                </td>
                <td className="truncate px-3 py-3" title={category.name}>
                  {category.name}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {category.is_system === 1 ? "系统预置" : "自定义"}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  {category.sort_order}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={category.is_system === 1}
                      title={
                        category.is_system === 1
                          ? "系统预置类别不能修改"
                          : "编辑类别"
                      }
                      onClick={() => onEdit(category)}
                      className="inline-flex h-7 items-center gap-1 border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={
                        category.is_system === 1 ||
                        items.some((item) => item.category_id === category.id)
                      }
                      title={
                        category.is_system === 1
                          ? "系统预置类别不能删除"
                          : "有关联项目时不能删除"
                      }
                      onClick={() => onDelete(category)}
                      className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {categories.map((category) => (
          <article
            key={category.id}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{category.code}</p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {category.name}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {category.is_system === 1 ? "系统预置" : "自定义"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                显示顺序 {category.sort_order}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={category.is_system === 1}
                  onClick={() => onEdit(category)}
                  className="h-7 border border-slate-300 px-2 text-xs disabled:opacity-40 dark:border-slate-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={
                    category.is_system === 1 ||
                    items.some((item) => item.category_id === category.id)
                  }
                  onClick={() => onDelete(category)}
                  className="h-7 border border-rose-300 px-2 text-xs text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {categories.length === 0 && (
        <EmptyState message="暂无辅助核算类别。新增类别后可录入项目并在凭证中引用。" />
      )}
    </>
  );
}
function ItemList({
  items,
  categoryNames,
  onEdit,
  onToggle,
  onDelete,
}: {
  items: AuxiliaryItem[];
  categoryNames: Map<string, string>;
  onEdit: (item: AuxiliaryItem) => void;
  onToggle: (item: AuxiliaryItem) => void;
  onDelete: (item: AuxiliaryItem) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[18%] px-3 py-3 font-medium">所属类别</th>
              <th className="w-[14%] px-3 py-3 font-medium">项目编码</th>
              <th className="w-[20%] px-3 py-3 font-medium">项目名称</th>
              <th className="w-[20%] px-3 py-3 font-medium">备注</th>
              <th className="w-[12%] px-3 py-3 font-medium">状态</th>
              <th className="w-[16%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td
                  className="truncate px-3 py-3"
                  title={categoryNames.get(item.category_id)}
                >
                  {categoryNames.get(item.category_id) || "类别已删除"}
                </td>
                <td className="px-3 py-3 font-mono font-medium">{item.code}</td>
                <td className="truncate px-3 py-3" title={item.name}>
                  {item.name}
                </td>
                <td
                  className="truncate px-3 py-3 text-slate-500 dark:text-slate-400"
                  title={item.remarks || undefined}
                >
                  {item.remarks || "-"}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex border px-2 py-0.5 ${item.is_enabled === 1 ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {item.is_enabled === 1 ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label="编辑项目"
                      onClick={() => onEdit(item)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        item.is_enabled === 1 ? "停用项目" : "启用项目"
                      }
                      onClick={() => onToggle(item)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="删除项目"
                      onClick={() => onDelete(item)}
                      className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{item.code}</p>
                <p className="mt-1 truncate text-xs">{item.name}</p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {categoryNames.get(item.category_id) || "类别已删除"}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {item.is_enabled === 1 ? "启用" : "停用"}
              </span>
            </div>
            <p className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400">
              {item.remarks || "无备注"}
            </p>
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
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="h-7 border border-rose-300 px-2 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300"
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState message="暂无辅助核算项目。新增项目后可在凭证、期初余额和辅助账中引用。" />
      )}
    </>
  );
}
function CategoryEditor({
  draft,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: CategoryDraft;
  saving: boolean;
  editing: boolean;
  onChange: (
    value: CategoryDraft | ((current: CategoryDraft) => CategoryDraft),
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const className = inputClass();
  return (
    <Dialog
      title={editing ? "编辑辅助类别" : "新增辅助类别"}
      description="类别用于科目、凭证和账簿的辅助维度校验；系统预置类别不可改动。"
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="类别编码 *">
            <input
              required
              autoFocus
              maxLength={32}
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="CUSTOMER"
              className={className}
            />
          </Field>
          <Field label="类别名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：客户"
              className={className}
            />
          </Field>
          <Field label="显示顺序">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={draft.sortOrder}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
        </div>
        <DialogFooter
          onClose={onClose}
          saving={saving}
          label={editing ? "保存修改" : "保存类别"}
        />
      </form>
    </Dialog>
  );
}
function ItemEditor({
  draft,
  categories,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ItemDraft;
  categories: AuxiliaryCategory[];
  saving: boolean;
  editing: boolean;
  onChange: (value: ItemDraft | ((current: ItemDraft) => ItemDraft)) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const className = inputClass();
  return (
    <Dialog
      title={editing ? "编辑辅助项目" : "新增辅助项目"}
      description="项目是可被凭证、期初余额和辅助账引用的明细档案；停用不会改写历史凭证。"
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="所属类别 *" className="sm:col-span-2">
            <select
              required
              value={draft.categoryId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
              className={className}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code}｜{category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="项目编码 *">
            <input
              required
              autoFocus
              maxLength={32}
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="C001"
              className={className}
            />
          </Field>
          <Field label="项目名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="如：上海示例客户"
              className={className}
            />
          </Field>
          <Field label="别名/备注" className="sm:col-span-2">
            <input
              value={draft.remarks}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  remarks: event.target.value,
                }))
              }
              placeholder="助记码、合同号或补充说明"
              className={className}
            />
          </Field>
        </div>
        <DialogFooter
          onClose={onClose}
          saving={saving}
          label={editing ? "保存修改" : "保存项目"}
        />
      </form>
    </Dialog>
  );
}
function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-xl">
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </header>
        {children}
      </section>
    </div>
  );
}
function DialogFooter({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  return (
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
        {saving ? "正在保存" : label}
      </button>
    </footer>
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
