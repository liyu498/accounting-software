import {
  Calculator,
  CheckCheck,
  CircleDollarSign,
  FilePlus2,
  Pencil,
  RefreshCw,
  Search,
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
  useCurrencyStore,
  type Currency,
  type ExchangeAdjustmentItem,
} from "../../stores/currencyStore";
import { usePeriodStore } from "../../stores/periodStore";

type CurrencyDraft = {
  code: string;
  name: string;
  exchangeRate: string;
  isBase: boolean;
};
const storageKey = "accounting-preview-currencies-v1";

function isCurrency(value: unknown): value is Currency {
  const item = value as Partial<Currency>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.company_id === "string" &&
    typeof item.code === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(item.exchange_rate) &&
    (item.is_base === 0 || item.is_base === 1),
  );
}
function loadPreviewCurrencies(): Currency[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) || "null",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCurrency) : [];
  } catch {
    return [];
  }
}
function savePreviewCurrencies(records: Currency[]) {
  if (typeof window !== "undefined")
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      /* Storage failure does not block the active browser preview. */
    }
}
function inputClass() {
  return "h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500";
}
function rate(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

export function CurrencyWorkspace() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? null : "browser-preview-company");
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const currencies = useCurrencyStore((state) => state.currencies);
  const isLoading = useCurrencyStore((state) => state.isLoading);
  const error = useCurrencyStore((state) => state.error);
  const fetchCurrencies = useCurrencyStore((state) => state.fetchCurrencies);
  const createCurrency = useCurrencyStore((state) => state.createCurrency);
  const updateCurrency = useCurrencyStore((state) => state.updateCurrency);
  const deleteCurrency = useCurrencyStore((state) => state.deleteCurrency);
  const calculateExchangeAdjustment = useCurrencyStore(
    (state) => state.calculateExchangeAdjustment,
  );
  const [previewRecords, setPreviewRecords] = useState<Currency[]>([]);
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CurrencyDraft>({
    code: "",
    name: "",
    exchangeRate: "1",
    isBase: false,
  });
  const [saving, setSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<
    ExchangeAdjustmentItem[] | null
  >(null);
  const [calculating, setCalculating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPreviewRecords([]);
      return;
    }
    if (isTauri) {
      await fetchCurrencies(companyId);
      return;
    }
    setPreviewRecords(
      loadPreviewCurrencies()
        .filter((item) => item.company_id === companyId)
        .sort(
          (left, right) =>
            right.is_base - left.is_base || left.code.localeCompare(right.code),
        ),
    );
  }, [companyId, fetchCurrencies]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const records = isTauri ? currencies : previewRecords;
  const term = keyword.trim().toLowerCase();
  const filteredRecords = useMemo(
    () =>
      records.filter(
        (item) =>
          !term ||
          [item.code, item.name, item.is_base === 1 ? "本位币" : "外币"]
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [records, term],
  );
  const currencyPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "币别编码",
    "币别名称",
    "币别类型",
    "记账汇率",
    "期末调汇",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((item) => [
        item.code,
        item.name,
        item.is_base === 1 ? "本位币" : "外币",
        rate(item.exchange_rate),
        item.is_base === 1 ? "不参与" : "需按账期复核",
      ]),
    [filteredRecords],
  );
  const baseCurrency = records.find((item) => item.is_base === 1) || null;
  const foreignCurrencies = records.filter((item) => item.is_base !== 1);

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setSaving(false);
  };
  const openEditor = (currency?: Currency) => {
    setEditingId(currency?.id || null);
    setDraft(
      currency
        ? {
            code: currency.code,
            name: currency.name,
            exchangeRate: String(currency.exchange_rate),
            isBase: currency.is_base === 1,
          }
        : {
            code: "",
            name: "",
            exchangeRate: "1",
            isBase: records.length === 0,
          },
    );
    setEditorOpen(true);
  };

  const saveCurrency = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) return;
    const code = draft.code.trim().toUpperCase();
    const name = draft.name.trim();
    const exchangeRate = draft.isBase ? 1 : Number(draft.exchangeRate);
    if (!/^[A-Z]{3,12}$/.test(code)) {
      setNotice("币别编码应为 3 至 12 位大写字母。");
      return;
    }
    if (!name) {
      setNotice("币别名称不能为空。");
      return;
    }
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setNotice("记账汇率必须大于 0。");
      return;
    }
    if (records.some((item) => item.id !== editingId && item.code === code)) {
      setNotice(`币别编码 ${code} 已存在。`);
      return;
    }
    setSaving(true);
    try {
      if (!isTauri) {
        const currency: Currency = {
          id: editingId || `preview-currency-${crypto.randomUUID()}`,
          company_id: companyId,
          code,
          name,
          exchange_rate: exchangeRate,
          is_base: draft.isBase ? 1 : 0,
        };
        const all = loadPreviewCurrencies();
        const next = all.map((item) =>
          item.company_id === companyId && draft.isBase
            ? { ...item, is_base: 0 }
            : item,
        );
        savePreviewCurrencies(
          editingId
            ? next.map((item) => (item.id === editingId ? currency : item))
            : [...next, currency],
        );
        await refresh();
      } else if (editingId)
        await updateCurrency({
          id: editingId,
          company_id: companyId,
          code,
          name,
          exchange_rate: exchangeRate,
          is_base: draft.isBase ? 1 : 0,
        });
      else
        await createCurrency({
          company_id: companyId,
          code,
          name,
          exchange_rate: exchangeRate,
          is_base: draft.isBase ? 1 : 0,
        });
      setAdjustments(null);
      setNotice(
        draft.isBase
          ? `${code} 已设为本位币，其他币别已改为外币核算。`
          : `币别 ${code} 已保存，期末调汇前请复核汇率来源。`,
      );
      closeEditor();
    } catch (saveError) {
      setNotice(`保存币别失败：${String(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeCurrency = async (currency: Currency) => {
    if (currency.is_base === 1) {
      setNotice("本位币不能删除；请先设置其他币别为本位币并完成汇兑复核。");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认删除币别 ${currency.code} 吗？历史外币分录不会随之修改。`,
      )
    )
      return;
    try {
      if (!isTauri) {
        savePreviewCurrencies(
          loadPreviewCurrencies().filter((item) => item.id !== currency.id),
        );
        await refresh();
      } else await deleteCurrency(currency.id, companyId || "");
      setAdjustments(null);
      setNotice(`币别 ${currency.code} 已删除。`);
    } catch (removeError) {
      setNotice(`删除币别失败：${String(removeError)}`);
    }
  };

  const calculate = async () => {
    if (!companyId || !currentPeriodId) {
      setNotice("请先在顶部选择开放账期，再执行期末调汇计算。");
      return;
    }
    if (!isTauri) {
      setNotice(
        "浏览器预览只维护币别和汇率配置，不伪造期末调汇分录或计算结果。",
      );
      return;
    }
    setCalculating(true);
    try {
      const result = await calculateExchangeAdjustment(
        companyId,
        currentPeriodId,
      );
      setAdjustments(result);
      setNotice(
        result.length
          ? `已计算 ${result.length} 条汇兑调整候选，生成凭证前仍需人工复核。`
          : "当前账期没有需要调整的外币余额。",
      );
    } catch (calculateError) {
      setNotice(`计算期末调汇失败：${String(calculateError)}`);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">币别管理</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              维护当前账套的本位币、外币记账汇率和期末调汇入口。汇率来源、调整分录和过账均需人工复核。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="币别清单"
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
              onClick={() => void calculate()}
              disabled={!companyId || calculating}
              className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              <Calculator className="h-3.5 w-3.5" />
              {calculating ? "正在计算" : "期末调汇"}
            </button>
            <button
              type="button"
              onClick={() => openEditor()}
              disabled={!companyId}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              新增币别
            </button>
          </div>
        </header>
        {!companyId && <EmptyState message="请选择账套后查看或维护币别。" />}
        {companyId && (
          <>
            <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
              <Metric
                icon={CheckCheck}
                label="本位币"
                value={baseCurrency ? baseCurrency.code : "未设置"}
                tone="text-emerald-600 dark:text-emerald-400"
              />
              <Metric
                icon={CircleDollarSign}
                label="外币"
                value={`${foreignCurrencies.length} 种`}
              />
              <Metric
                icon={Calculator}
                label="本期调汇"
                value={
                  adjustments === null ? "未计算" : `${adjustments.length} 条`
                }
                tone="text-sky-700 dark:text-sky-300"
              />
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                本位币固定按 1.00000000 计价；更换本位币会影响后续外币折算口径。
              </p>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索币别编码、名称或状态"
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
                />
              </label>
            </div>
            {notice && <Notice value={notice} />}
            {error && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                读取币别失败：{error}
              </div>
            )}
            {isTauri && isLoading ? (
              <EmptyState message="正在读取币别配置..." />
            ) : (
              <CurrencyList
                items={currencyPage.rows}
                onEdit={openEditor}
                onDelete={removeCurrency}
              />
            )}
            <OperationalPagination
              page={currencyPage}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
            {adjustments !== null && <AdjustmentList items={adjustments} />}
          </>
        )}
      </section>
      {editorOpen && (
        <CurrencyEditor
          draft={draft}
          saving={saving}
          editing={Boolean(editingId)}
          onChange={setDraft}
          onClose={closeEditor}
          onSubmit={saveCurrency}
        />
      )}
    </main>
  );
}

function CurrencyList({
  items,
  onEdit,
  onDelete,
}: {
  items: Currency[];
  onEdit: (item: Currency) => void;
  onDelete: (item: Currency) => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[18%] px-3 py-3 font-medium">币别编码</th>
              <th className="w-[24%] px-3 py-3 font-medium">币别名称</th>
              <th className="w-[20%] px-3 py-3 font-medium">记账汇率</th>
              <th className="w-[18%] px-3 py-3 font-medium">核算角色</th>
              <th className="w-[20%] px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-3 font-mono font-medium">{item.code}</td>
                <td className="truncate px-3 py-3" title={item.name}>
                  {item.name}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  {rate(item.exchange_rate)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex border px-2 py-0.5 ${item.is_base === 1 ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {item.is_base === 1 ? "本位币" : "外币"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <ActionButtons
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                    deleteDisabled={item.is_base === 1}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-medium">{item.code}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.name}
                </p>
              </div>
              <span className="border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                {item.is_base === 1 ? "本位币" : "外币"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="font-mono text-sm tabular-nums">
                {rate(item.exchange_rate)}
              </span>
              <ActionButtons
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
                deleteDisabled={item.is_base === 1}
              />
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState message="尚未配置币别。请先登记一个本位币，再新增外币及记账汇率。" />
      )}
    </>
  );
}
function AdjustmentList({ items }: { items: ExchangeAdjustmentItem[] }) {
  return (
    <section className="border-t border-slate-200 dark:border-slate-800">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <Calculator className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <h2 className="text-sm font-semibold">期末调汇候选</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          仅供复核，不会自动生成凭证。
        </span>
      </header>
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
            <tr>
              <th className="w-[13%] px-3 py-3 font-medium">币别</th>
              <th className="w-[22%] px-3 py-3 font-medium">科目</th>
              <th className="w-[16%] px-3 py-3 font-medium">原账面余额</th>
              <th className="w-[16%] px-3 py-3 font-medium">调整后余额</th>
              <th className="w-[16%] px-3 py-3 font-medium">差额</th>
              <th className="w-[17%] px-3 py-3 font-medium">方向</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={`${item.currency_code}-${item.account_code}`}>
                <td className="px-3 py-3">
                  {item.currency_code} {item.currency_name}
                </td>
                <td
                  className="truncate px-3 py-3"
                  title={`${item.account_code} ${item.account_name}`}
                >
                  {item.account_code} {item.account_name}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  {rate(item.original_balance)}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  {rate(item.adjusted_balance)}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  {rate(item.difference)}
                </td>
                <td className="px-3 py-3">{item.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 lg:hidden">
        {items.map((item) => (
          <article
            key={`${item.currency_code}-${item.account_code}`}
            className="border border-slate-200 p-3 dark:border-slate-800"
          >
            <p className="text-sm font-medium">
              {item.currency_code} · {item.account_code} {item.account_name}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Info label="原余额" value={rate(item.original_balance)} />
              <Info label="调整后" value={rate(item.adjusted_balance)} />
              <Info label="差额" value={rate(item.difference)} />
              <Info label="方向" value={item.direction} />
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState message="当前账期没有可调整的外币余额。" />
      )}
    </section>
  );
}
function ActionButtons({
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
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
        disabled={deleteDisabled}
        title={deleteDisabled ? "本位币不能删除" : "删除币别"}
        onClick={onDelete}
        className="inline-flex h-7 w-7 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
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
  icon: typeof CircleDollarSign;
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
function CurrencyEditor({
  draft,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: CurrencyDraft;
  saving: boolean;
  editing: boolean;
  onChange: (
    value: CurrencyDraft | ((current: CurrencyDraft) => CurrencyDraft),
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
      aria-label={editing ? "编辑币别" : "新增币别"}
    >
      <form
        onSubmit={onSubmit}
        className="w-full border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-lg"
      >
        <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editing ? "编辑币别" : "新增币别"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            本位币汇率固定为 1；切换本位币前应先完成相关汇兑复核。
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="币别编码 *">
            <input
              required
              autoFocus
              maxLength={12}
              value={draft.code}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="USD"
              className={className}
            />
          </Field>
          <Field label="币别名称 *">
            <input
              required
              value={draft.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="美元"
              className={className}
            />
          </Field>
          <Field label="记账汇率 *">
            <input
              required
              type="number"
              min="0.00000001"
              step="0.00000001"
              disabled={draft.isBase}
              value={draft.isBase ? "1" : draft.exchangeRate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  exchangeRate: event.target.value,
                }))
              }
              className={className}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draft.isBase}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isBase: event.target.checked,
                  exchangeRate: event.target.checked
                    ? "1"
                    : current.exchangeRate,
                }))
              }
              className="h-4 w-4 accent-[#1f65a7]"
            />
            设为本位币
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
            {saving ? "正在保存" : editing ? "保存修改" : "创建币别"}
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
      {children}
    </label>
  );
}
