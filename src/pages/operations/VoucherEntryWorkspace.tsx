import {
  ArrowLeft,
  BookTemplate,
  Calculator,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  Landmark,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  automationApi,
  accountTransferApi,
  bankTransactionApi,
  businessOrderApi,
  costCarryoverApi,
  documentRecordApi,
  fixedAssetApi,
  invoiceApi,
  payrollApi,
  socialSecurityApi,
  type AccountTransfer,
  type AutomationJob,
  type BankTransaction,
  type BusinessOrder,
  type CostCarryoverRecord,
  type DocumentRecord,
  type DepreciationBatch,
  type FixedAssetDepreciationLine,
  type Invoice,
  type PayrollRecord,
  type SocialSecurityRecord,
} from "../../lib/api";
import { buildAiVoucherSuggestionPrefill } from "../../lib/aiVoucherSuggestionWorkflow.js";
import { buildBankVoucherPrefill } from "../../lib/bankVoucherWorkflow.js";
import {
  buildBusinessVoucherPrefill,
  loadBrowserBusinessVoucherSource,
} from "../../lib/businessVoucherSourceWorkflow.js";
import {
  loadBrowserPreviewBusinessTags,
  loadBrowserPreviewVoucherTagIds,
  replaceBrowserPreviewVoucherTags,
} from "../../lib/browserPreviewBusinessTags.js";
import {
  createBrowserPreviewVoucherTemplate,
  createBrowserPreviewVoucherTemplateType,
  loadBrowserPreviewVoucherTemplates,
  loadBrowserPreviewVoucherTemplateTypes,
} from "../../lib/browserPreviewVoucherTemplates.js";
import { isTauri } from "../../lib/tauri";
import {
  formatLocalFileSize,
  recordLocalAttachment,
  updateLocalAttachmentAssociation,
  useLocalAttachmentRecords,
} from "../../lib/localFileRegistry";
import {
  createNextVoucherDraft,
  getMissingRequiredAuxiliaryCategories,
  hydrateAuxiliarySelections,
  resolveVoucherSubmitIntent,
  serializeAuxiliarySelections,
  toChineseCurrencyUppercase,
} from "../../lib/voucherEntryWorkflow.js";
import {
  buildInvoiceVoucherPrefill,
  canCreateVoucherFromInvoice,
  parseVoucherSourceSearch,
} from "../../lib/voucherSourceWorkflow.js";
import {
  applyVoucherTemplateToDraft,
  createVoucherTemplateEntries,
} from "../../lib/voucherTemplateWorkflow.js";
import {
  getSelectableVoucherTags,
  toggleVoucherTagId,
} from "../../lib/voucherTagWorkflow.js";
import { filterVoucherAttachments } from "../../lib/voucherAttachmentWorkflow.js";
import { useAccountStore } from "../../stores/accountStore";
import {
  useAuxiliaryStore,
  type AccountAuxiliarySetup,
} from "../../stores/auxiliaryStore";
import {
  useBusinessTagStore,
  type BusinessTag,
} from "../../stores/businessTagStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { usePeriodStore } from "../../stores/periodStore";
import {
  useTemplateStore,
  type VoucherTemplateType,
  type VoucherTemplateWithEntries,
} from "../../stores/templateStore";
import { useVoucherStore, type Voucher } from "../../stores/voucherStore";

type EntryDraft = {
  accountCode: string;
  accountName: string;
  direction: "debit" | "credit";
  amount: string;
  summary: string;
  auxiliaryType: string;
  auxiliaryId: string;
  auxiliarySelections?: Record<string, string>;
  docNumber: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  currencyId: string;
  exchangeRate: string;
};
type VoucherDraft = {
  voucherDate: string;
  voucherNumber: string;
  summary: string;
  referenceNumber: string;
  attachmentCount: string;
  voucherWordId: string;
  entries: EntryDraft[];
};
type BusinessVoucherSourceKind =
  | "document_record"
  | "business_order"
  | "account_transfer"
  | "cost_carryover"
  | "payroll_batch"
  | "social_security_batch"
  | "depreciation_batch";
type PayrollBatchSource = {
  id: string;
  companyId: string;
  period: string;
  voucherDate: string;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  records: PayrollRecord[];
};
type SocialSecurityBatchSource = {
  id: string;
  companyId: string;
  period: string;
  voucherDate: string;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  records: SocialSecurityRecord[];
};
type DepreciationBatchSource = {
  id: string;
  companyId: string;
  period: string;
  voucherDate: string;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  records: FixedAssetDepreciationLine[];
  batch: DepreciationBatch | null;
};
type BusinessVoucherSourceRecord =
  | DocumentRecord
  | BusinessOrder
  | AccountTransfer
  | CostCarryoverRecord
  | PayrollBatchSource
  | SocialSecurityBatchSource
  | DepreciationBatchSource;
type BusinessVoucherSource = {
  kind: BusinessVoucherSourceKind;
  record: BusinessVoucherSourceRecord;
};

const emptyEntries = (): EntryDraft[] => [
  {
    accountCode: "",
    accountName: "",
    direction: "debit",
    amount: "",
    summary: "",
    auxiliaryType: "",
    auxiliaryId: "",
    auxiliarySelections: {},
    docNumber: "",
    quantity: "",
    unitPrice: "",
    unit: "",
    currencyId: "",
    exchangeRate: "",
  },
  {
    accountCode: "",
    accountName: "",
    direction: "credit",
    amount: "",
    summary: "",
    auxiliaryType: "",
    auxiliaryId: "",
    auxiliarySelections: {},
    docNumber: "",
    quantity: "",
    unitPrice: "",
    unit: "",
    currencyId: "",
    exchangeRate: "",
  },
];

function emptyDraft(): VoucherDraft {
  return {
    voucherDate: "",
    voucherNumber: "",
    summary: "",
    referenceNumber: "",
    attachmentCount: "0",
    voucherWordId: "",
    entries: emptyEntries(),
  };
}

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatAuditTime(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", { hour12: false });
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function businessSourcePresentation(source: BusinessVoucherSource) {
  const { kind, record } = source;
  if (kind === "document_record") {
    const item = record as DocumentRecord;
    return {
      title: `业务单据 ${item.documentCode}`,
      detail: `${item.businessDate} · ${item.businessType} · ${item.partner || "往来单位待补"}`,
      amount: item.amount,
    };
  }
  if (kind === "business_order") {
    const item = record as BusinessOrder;
    return {
      title: `${item.orderType === "sales" ? "销售" : "采购"}订单 ${item.orderNo}`,
      detail: `${item.businessDate} · ${item.counterparty} · ${item.goodsName}`,
      amount: item.amount,
    };
  }
  if (kind === "cost_carryover") {
    const item = record as CostCarryoverRecord;
    return {
      title: `成本结转 ${item.batchNo}`,
      detail: `${item.carryoverDate} · ${item.inventoryName} · ${item.valuationMethod}`,
      amount: item.costAmount,
    };
  }
  if (kind === "payroll_batch") {
    const item = record as PayrollBatchSource;
    return {
      title: `${item.period} 工资批次`,
      detail: `${item.records.length} 人 · 应发工资汇总`,
      amount: item.records.reduce(
        (total, row) => total + row.baseSalary + row.bonus,
        0,
      ),
    };
  }
  if (kind === "social_security_batch") {
    const item = record as SocialSecurityBatchSource;
    return {
      title: `${item.period} 社保公积金批次`,
      detail: `${item.records.length} 人 · 单位缴费汇总`,
      amount: item.records.reduce(
        (total, row) => total + row.companyAmount + row.fundAmount,
        0,
      ),
    };
  }
  if (kind === "depreciation_batch") {
    const item = record as DepreciationBatchSource;
    return {
      title: `${item.period} 固定资产折旧批次`,
      detail: `${item.records.length} 项资产 · 已计算并待复核`,
      amount: item.records.reduce(
        (total, row) => total + row.depreciationAmount,
        0,
      ),
    };
  }
  const item = record as AccountTransfer;
  return {
    title: `账户转账 ${item.serialNo || item.id}`,
    detail: `${item.transferDate} · ${item.fromAccount} 至 ${item.toAccount}`,
    amount: item.amount + item.fee,
  };
}

function voucherEntryPayload(entry: EntryDraft & { amount: number }) {
  const auxiliaryItems = serializeAuxiliarySelections(
    entry.auxiliarySelections ||
      hydrateAuxiliarySelections({
        auxiliary_type: entry.auxiliaryType,
        auxiliary_id: entry.auxiliaryId,
      }),
  );
  const firstAuxiliary = auxiliaryItems[0];
  return {
    account_code: entry.accountCode,
    account_name: entry.accountName,
    direction: entry.direction,
    amount: entry.amount,
    summary: entry.summary.trim() || undefined,
    auxiliary_type:
      firstAuxiliary?.auxiliary_category_id || entry.auxiliaryType || undefined,
    auxiliary_id:
      firstAuxiliary?.auxiliary_item_id || entry.auxiliaryId || undefined,
    auxiliary_items: auxiliaryItems.length ? auxiliaryItems : undefined,
    doc_number: entry.docNumber.trim() || undefined,
    quantity: optionalNumber(entry.quantity),
    unit_price: optionalNumber(entry.unitPrice),
    unit: entry.unit.trim() || undefined,
    currency_id: entry.currencyId || undefined,
    exchange_rate: optionalNumber(entry.exchangeRate),
  };
}

function panelClassName() {
  return "border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]";
}

function tagColorClassName(colorName: string, selected: boolean) {
  if (!selected)
    return "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300";
  const classes: Record<string, string> = {
    蓝色:
      "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-200",
    绿色:
      "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    橙色:
      "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    红色:
      "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  };
  return (
    classes[colorName] ||
    "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function draftFromVoucher(voucher: Voucher): VoucherDraft {
  return {
    voucherDate: voucher.voucher_date,
    voucherNumber: voucher.voucher_number,
    summary: voucher.summary || "",
    referenceNumber: voucher.reference_number || "",
    attachmentCount: String(voucher.attachment_count || 0),
    voucherWordId: voucher.voucher_word_id,
    entries: voucher.entries.length
      ? voucher.entries.map((entry) => {
          const auxiliarySelections = hydrateAuxiliarySelections(entry);
          const firstAuxiliary =
            serializeAuxiliarySelections(auxiliarySelections)[0];
          return {
          accountCode: entry.account_code,
          accountName: entry.account_name,
          direction: entry.direction === "credit" ? "credit" : "debit",
          amount: String(entry.amount),
          summary: entry.summary || "",
          auxiliaryType:
            firstAuxiliary?.auxiliary_category_id ||
            entry.auxiliary_type ||
            "",
          auxiliaryId:
            firstAuxiliary?.auxiliary_item_id || entry.auxiliary_id || "",
          auxiliarySelections,
          docNumber: entry.doc_number || "",
          quantity: entry.quantity == null ? "" : String(entry.quantity),
          unitPrice: entry.unit_price == null ? "" : String(entry.unit_price),
          unit: entry.unit || "",
          currencyId: entry.currency_id || "",
          exchangeRate:
            entry.exchange_rate == null ? "" : String(entry.exchange_rate),
          };
        })
      : emptyEntries(),
  };
}

function VoucherEntryWorkspace({ mode }: { mode: "create" | "edit" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const voucherSourceSearch = searchParams.toString();
  const voucherSource = useMemo(
    () => parseVoucherSourceSearch(voucherSourceSearch),
    [voucherSourceSearch],
  );
  const routedNotice =
    (location.state as { voucherNotice?: string } | null)?.voucherNotice || null;
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const company = useCompanyStore((state) =>
    state.companies.find((item) => item.id === state.selectedCompanyId),
  );
  const fetchCompanies = useCompanyStore((state) => state.fetchCompanies);
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const voucherWords = usePeriodStore((state) => state.voucherWords);
  const fetchVoucherWords = usePeriodStore((state) => state.fetchVoucherWords);
  const accounts = useAccountStore((state) => state.accounts);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const auxiliaryItems = useAuxiliaryStore((state) => state.items);
  const fetchAllAuxiliaryItems = useAuxiliaryStore(
    (state) => state.fetchAllItems,
  );
  const fetchAccountSetup = useAuxiliaryStore(
    (state) => state.fetchAccountSetup,
  );
  const currencies = useCurrencyStore((state) => state.currencies);
  const fetchCurrencies = useCurrencyStore((state) => state.fetchCurrencies);
  const storedTemplateTypes = useTemplateStore(
    (state) => state.voucherTemplateTypes,
  );
  const storedTemplates = useTemplateStore((state) => state.voucherTemplates);
  const fetchTemplateWorkspace = useTemplateStore(
    (state) => state.fetchTemplateWorkspace,
  );
  const createVoucherTemplateType = useTemplateStore(
    (state) => state.createVoucherTemplateType,
  );
  const createVoucherTemplate = useTemplateStore(
    (state) => state.createVoucherTemplate,
  );
  const storedBusinessTags = useBusinessTagStore(
    (state) => state.businessTags,
  );
  const fetchBusinessTags = useBusinessTagStore(
    (state) => state.fetchBusinessTags,
  );
  const fetchVoucherTagIds = useBusinessTagStore(
    (state) => state.fetchVoucherTagIds,
  );
  const replaceVoucherTags = useBusinessTagStore(
    (state) => state.replaceVoucherTags,
  );
  const getVoucher = useVoucherStore((state) => state.getVoucher);
  const getNextVoucherNumber = useVoucherStore(
    (state) => state.getNextVoucherNumber,
  );
  const suggestSummaries = useVoucherStore((state) => state.suggestSummaries);
  const addVoucher = useVoucherStore((state) => state.addVoucher);
  const updateVoucher = useVoucherStore((state) => state.updateVoucher);
  const period = periods.find((item) => item.id === currentPeriodId);
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month).padStart(2, "0")}`
    : "未选择账期";
  const [loadedVoucher, setLoadedVoucher] = useState<Voucher | null>(null);
  const [sourceInvoice, setSourceInvoice] = useState<Invoice | null>(null);
  const [sourceAutomationJob, setSourceAutomationJob] =
    useState<AutomationJob | null>(null);
  const [sourceBankTransaction, setSourceBankTransaction] =
    useState<BankTransaction | null>(null);
  const [sourceBusinessRecord, setSourceBusinessRecord] =
    useState<BusinessVoucherSource | null>(null);
  const [draft, setDraft] = useState<VoucherDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(routedNotice);
  const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<number[]>([]);
  const [previewTemplateTypes, setPreviewTemplateTypes] = useState<
    VoucherTemplateType[]
  >([]);
  const [previewTemplates, setPreviewTemplates] = useState<
    VoucherTemplateWithEntries[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateTypeId, setTemplateTypeId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewBusinessTags, setPreviewBusinessTags] = useState<BusinessTag[]>(
    [],
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [auxiliarySetups, setAuxiliarySetups] = useState<
    Record<string, AccountAuxiliarySetup | null>
  >({});
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const templateTypes = isTauri ? storedTemplateTypes : previewTemplateTypes;
  const templates = isTauri ? storedTemplates : previewTemplates;
  const businessTags = isTauri ? storedBusinessTags : previewBusinessTags;
  const attachmentScope = {
    companyId: selectedCompanyId || "未选择账套",
    period: periodLabel,
  };
  const attachmentRecords = useLocalAttachmentRecords(attachmentScope);
  const linkedAttachments = useMemo(
    () => filterVoucherAttachments(attachmentRecords, loadedVoucher?.id || ""),
    [attachmentRecords, loadedVoucher?.id],
  );

  useEffect(() => {
    if (selectedCompanyId)
      void Promise.all([
        fetchCompanies(),
        fetchPeriods(selectedCompanyId),
        fetchVoucherWords(selectedCompanyId),
        fetchAccounts(selectedCompanyId),
        fetchAllAuxiliaryItems(selectedCompanyId),
        fetchCurrencies(selectedCompanyId),
        isTauri
          ? fetchTemplateWorkspace(selectedCompanyId)
          : Promise.resolve(),
        isTauri ? fetchBusinessTags(selectedCompanyId) : Promise.resolve(),
      ]);
    if (selectedCompanyId && !isTauri) {
      setPreviewTemplateTypes(
        loadBrowserPreviewVoucherTemplateTypes(selectedCompanyId),
      );
      setPreviewTemplates(
        loadBrowserPreviewVoucherTemplates(selectedCompanyId),
      );
      setPreviewBusinessTags(
        loadBrowserPreviewBusinessTags(selectedCompanyId),
      );
    }
  }, [
    fetchAccounts,
    fetchAllAuxiliaryItems,
    fetchCurrencies,
    fetchBusinessTags,
    fetchCompanies,
    fetchPeriods,
    fetchTemplateWorkspace,
    fetchVoucherWords,
    selectedCompanyId,
  ]);

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (mode === "edit") {
        setSourceInvoice(null);
        setSourceAutomationJob(null);
        setSourceBankTransaction(null);
        setSourceBusinessRecord(null);
        if (!id) throw new Error("缺少待编辑凭证标识");
        const voucher = await getVoucher(id, selectedCompanyId);
        if (!voucher) throw new Error("未找到该凭证，或该凭证不属于当前账套");
        if (voucher.status !== "draft")
          throw new Error(
            "只有草稿凭证可以编辑；已审核凭证请先在凭证列表执行反审核。",
          );
        setLoadedVoucher(voucher);
        setDraft(draftFromVoucher(voucher));
        setSelectedTagIds(
          isTauri
            ? await fetchVoucherTagIds(voucher.id, selectedCompanyId)
            : loadBrowserPreviewVoucherTagIds(voucher.id, selectedCompanyId),
        );
      } else if (currentPeriodId) {
        const voucherNumber = await getNextVoucherNumber(
          currentPeriodId,
          selectedCompanyId,
        );
        if (voucherSource?.kind === "invoice") {
          const result = await invoiceApi.get(
            voucherSource.id,
            selectedCompanyId,
          );
          if (!result.success)
            throw new Error(result.error || "读取来源发票失败");
          const invoice = result.data;
          if (!invoice) throw new Error("未找到来源发票，或发票不属于当前账套");
          if (!canCreateVoucherFromInvoice(invoice))
            throw new Error("只有已复核且尚未关联凭证的发票可以生成凭证草稿");
          if (invoice.periodId && invoice.periodId !== currentPeriodId)
            throw new Error("来源发票不属于当前账期，请切换账期后再生成凭证");
          if (
            !invoice.periodId &&
            period &&
            !invoice.invoiceDate.startsWith(
              `${period.period_year}-${String(period.period_month).padStart(2, "0")}`,
            )
          )
            throw new Error("来源发票日期不属于当前账期，请切换账期后再生成凭证");
          const prefill = buildInvoiceVoucherPrefill(invoice);
          setSourceInvoice(invoice);
          setSourceAutomationJob(null);
          setSourceBankTransaction(null);
          setSourceBusinessRecord(null);
          setDraft({
            ...emptyDraft(),
            voucherDate: prefill.voucherDate,
            voucherNumber,
            summary: prefill.summary,
            referenceNumber: prefill.referenceNumber,
            voucherWordId: voucherWords[0]?.id || "",
            entries: prefill.entries.map(
              (entry: {
                direction: string;
                amount: string;
                summary: string;
                docNumber: string;
              }): EntryDraft => ({
                accountCode: "",
                accountName: "",
                direction: entry.direction === "credit" ? "credit" : "debit",
                amount: entry.amount,
                summary: entry.summary,
                auxiliaryType: "",
                auxiliaryId: "",
                docNumber: entry.docNumber,
                quantity: "",
                unitPrice: "",
                unit: "",
                currencyId: "",
                exchangeRate: "",
              }),
            ),
          });
        } else if (voucherSource?.kind === "ai_suggestion") {
          if (accounts.length === 0) return;
          const result = await automationApi.getAutomationJobs({
            companyId: selectedCompanyId,
            period: periodLabel,
          });
          if (!result.success)
            throw new Error(result.error || "读取 AI 凭证建议失败");
          const job = (result.data || []).find(
            (item) => item.id === voucherSource.id,
          );
          if (!job)
            throw new Error("未找到 AI 凭证建议，或建议不属于当前账套和账期");
          const prefill = buildAiVoucherSuggestionPrefill({
            job,
            accounts,
            periodLabel,
          });
          setSourceInvoice(null);
          setSourceAutomationJob(job);
          setSourceBankTransaction(null);
          setSourceBusinessRecord(null);
          setDraft({
            ...emptyDraft(),
            voucherDate: period?.end_date || emptyDraft().voucherDate,
            voucherNumber,
            summary: prefill.summary,
            referenceNumber: prefill.referenceNumber,
            voucherWordId: voucherWords[0]?.id || "",
            entries: prefill.entries.map(
              (entry: {
                accountCode: string;
                accountName: string;
                direction: string;
                amount: string;
                summary: string;
                docNumber: string;
              }): EntryDraft => ({
                accountCode: entry.accountCode,
                accountName: entry.accountName,
                direction: entry.direction === "credit" ? "credit" : "debit",
                amount: entry.amount,
                summary: entry.summary,
                auxiliaryType: "",
                auxiliaryId: "",
                docNumber: entry.docNumber,
                quantity: "",
                unitPrice: "",
                unit: "",
                currencyId: "",
                exchangeRate: "",
              }),
            ),
          });
        } else if (voucherSource?.kind === "bank_transaction") {
          const result = await bankTransactionApi.getBankTransactions({
            companyId: selectedCompanyId,
            period: periodLabel,
          });
          if (!result.success)
            throw new Error(result.error || "读取银行流水失败");
          const record = (result.data || []).find(
            (item) => item.id === voucherSource.id,
          );
          if (!record)
            throw new Error("未找到银行流水，或流水不属于当前账套和账期");
          const prefill = buildBankVoucherPrefill({
            record,
            accounts,
            periodLabel,
          });
          setSourceInvoice(null);
          setSourceAutomationJob(null);
          setSourceBankTransaction(record);
          setSourceBusinessRecord(null);
          setDraft({
            ...emptyDraft(),
            voucherDate: prefill.voucherDate,
            voucherNumber,
            summary: prefill.summary,
            referenceNumber: prefill.referenceNumber,
            voucherWordId: voucherWords[0]?.id || "",
            entries: prefill.entries.map(
              (entry: {
                accountCode: string;
                accountName: string;
                direction: string;
                amount: string;
                summary: string;
                docNumber: string;
              }): EntryDraft => ({
                accountCode: entry.accountCode,
                accountName: entry.accountName,
                direction: entry.direction === "credit" ? "credit" : "debit",
                amount: entry.amount,
                summary: entry.summary,
                auxiliaryType: "",
                auxiliaryId: "",
                docNumber: entry.docNumber,
                quantity: "",
                unitPrice: "",
                unit: "",
                currencyId: "",
                exchangeRate: "",
              }),
            ),
          });
        } else if (
          voucherSource?.kind === "document_record" ||
          voucherSource?.kind === "business_order" ||
          voucherSource?.kind === "account_transfer" ||
          voucherSource?.kind === "cost_carryover" ||
          voucherSource?.kind === "payroll_batch" ||
          voucherSource?.kind === "social_security_batch" ||
          voucherSource?.kind === "depreciation_batch"
        ) {
          const kind = voucherSource.kind as BusinessVoucherSourceKind;
          let record: BusinessVoucherSourceRecord | null = null;
          if (
            !isTauri &&
            kind !== "payroll_batch" &&
            kind !== "social_security_batch" &&
            kind !== "depreciation_batch"
          ) {
            record = loadBrowserBusinessVoucherSource(kind, voucherSource.id);
          } else if (kind === "document_record") {
            const result = await documentRecordApi.getDocumentRecords({
              companyId: selectedCompanyId,
              period: periodLabel,
            });
            if (!result.success)
              throw new Error(result.error || "读取来源单据失败");
            record =
              (result.data || []).find((item) => item.id === voucherSource.id) ||
              null;
          } else if (kind === "business_order") {
            const [purchase, sales] = await Promise.all([
              businessOrderApi.getBusinessOrders({
                companyId: selectedCompanyId,
                period: periodLabel,
                orderType: "purchase",
              }),
              businessOrderApi.getBusinessOrders({
                companyId: selectedCompanyId,
                period: periodLabel,
                orderType: "sales",
              }),
            ]);
            if (!purchase.success || !sales.success)
              throw new Error(
                purchase.error || sales.error || "读取采购销售订单失败",
              );
            record = [...(purchase.data || []), ...(sales.data || [])].find(
              (item) => item.id === voucherSource.id,
            ) || null;
          } else if (kind === "account_transfer") {
            const result = await accountTransferApi.getAccountTransfers({
              companyId: selectedCompanyId,
              period: periodLabel,
            });
            if (!result.success)
              throw new Error(result.error || "读取账户转账失败");
            record =
              (result.data || []).find((item) => item.id === voucherSource.id) ||
              null;
          } else if (kind === "cost_carryover") {
            const result = await costCarryoverApi.getCostCarryoverRecords({
              companyId: selectedCompanyId,
              period: periodLabel,
            });
            if (!result.success)
              throw new Error(result.error || "读取成本结转来源失败");
            record =
              (result.data || []).find((item) => item.id === voucherSource.id) ||
              null;
          } else if (kind === "payroll_batch") {
            const result = await payrollApi.getPayrollRecords({
              companyId: selectedCompanyId,
              period: periodLabel,
            });
            if (!result.success)
              throw new Error(result.error || "读取工资批次来源失败");
            const payrollRecords = result.data || [];
            const linkedRecord = payrollRecords.find((item) => item.voucherId);
            record = payrollRecords.length > 0 && voucherSource.id === periodLabel
              ? {
                  id: periodLabel,
                  companyId: selectedCompanyId,
                  period: periodLabel,
                  voucherDate: period?.end_date || `${periodLabel}-01`,
                  voucherId: linkedRecord?.voucherId || null,
                  voucherNumber: linkedRecord?.voucherNumber || null,
                  status: linkedRecord ? "已生成凭证" : "待确认",
                  records: payrollRecords,
                }
              : null;
          } else if (kind === "social_security_batch") {
            const result = await socialSecurityApi.getSocialSecurityRecords({
              companyId: selectedCompanyId,
              period: periodLabel,
            });
            if (!result.success)
              throw new Error(result.error || "读取社保公积金批次来源失败");
            const socialRecords = result.data || [];
            const linkedRecord = socialRecords.find((item) => item.voucherId);
            record = socialRecords.length > 0 && voucherSource.id === periodLabel
              ? {
                  id: periodLabel,
                  companyId: selectedCompanyId,
                  period: periodLabel,
                  voucherDate: period?.end_date || `${periodLabel}-01`,
                  voucherId: linkedRecord?.voucherId || null,
                  voucherNumber: linkedRecord?.voucherNumber || null,
                  status: linkedRecord ? "已生成凭证" : "待确认",
                  records: socialRecords,
                }
              : null;
          } else {
            const [lineResult, batchResult] = await Promise.all([
              fixedAssetApi.getDepreciationLines({
                companyId: selectedCompanyId,
                period: periodLabel,
              }),
              fixedAssetApi.getDepreciationBatch({
                companyId: selectedCompanyId,
                period: periodLabel,
              }),
            ]);
            if (!lineResult.success || !batchResult.success)
              throw new Error(
                lineResult.error ||
                  batchResult.error ||
                  "读取折旧批次来源失败",
              );
            const depreciationLines = lineResult.data || [];
            const batch = batchResult.data || null;
            record =
              batch &&
              depreciationLines.length > 0 &&
              voucherSource.id === `${selectedCompanyId}:${periodLabel}`
                ? {
                    id: voucherSource.id,
                    companyId: selectedCompanyId,
                    period: periodLabel,
                    voucherDate: period?.end_date || `${periodLabel}-01`,
                    voucherId: batch?.voucherId || null,
                    voucherNumber: batch?.voucherNumber || null,
                    status: batch.status,
                    records: depreciationLines,
                    batch,
                  }
                : null;
          }
          if (!record)
            throw new Error("未找到业务来源，或来源不属于当前账套和账期");
          const prefill = buildBusinessVoucherPrefill({
            kind,
            record,
            accounts,
            periodLabel,
          });
          setSourceInvoice(null);
          setSourceAutomationJob(null);
          setSourceBankTransaction(null);
          setSourceBusinessRecord({ kind, record });
          setDraft({
            ...emptyDraft(),
            voucherDate: prefill.voucherDate,
            voucherNumber,
            summary: prefill.summary,
            referenceNumber: prefill.referenceNumber,
            voucherWordId: voucherWords[0]?.id || "",
            entries: prefill.entries.map(
              (entry: {
                accountCode: string;
                accountName: string;
                direction: string;
                amount: string;
                summary: string;
                docNumber: string;
              }): EntryDraft => ({
                accountCode: entry.accountCode,
                accountName: entry.accountName,
                direction: entry.direction === "credit" ? "credit" : "debit",
                amount: entry.amount,
                summary: entry.summary,
                auxiliaryType: "",
                auxiliaryId: "",
                docNumber: entry.docNumber,
                quantity: "",
                unitPrice: "",
                unit: "",
                currencyId: "",
                exchangeRate: "",
              }),
            ),
          });
        } else {
          setSourceInvoice(null);
          setSourceAutomationJob(null);
          setSourceBankTransaction(null);
          setSourceBusinessRecord(null);
          setDraft((current) => ({
            ...current,
            voucherDate: period?.end_date || current.voucherDate,
            voucherNumber,
            voucherWordId: voucherWords[0]?.id || current.voucherWordId,
          }));
        }
        setSelectedTagIds([]);
      }
      setNotice(routedNotice);
    } catch (error) {
      setSourceInvoice(null);
      setSourceAutomationJob(null);
      setSourceBankTransaction(null);
      setSourceBusinessRecord(null);
      setNotice(`读取凭证录入数据失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [
    accounts,
    currentPeriodId,
    getNextVoucherNumber,
    getVoucher,
    fetchVoucherTagIds,
    id,
    mode,
    period?.end_date,
    periodLabel,
    routedNotice,
    selectedCompanyId,
    voucherSource?.id,
    voucherSource?.kind,
    voucherWords,
  ]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "F12") {
        event.preventDefault();
        if (!loading && !saving) formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [loading, saving]);
  const enabledAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_enabled === 1 && account.is_detail === 1,
      ),
    [accounts],
  );
  const selectableVoucherTags = useMemo(
    () =>
      getSelectableVoucherTags(
        businessTags.filter((tag) => tag.company_id === selectedCompanyId),
        selectedTagIds,
      ),
    [businessTags, selectedCompanyId, selectedTagIds],
  );
  const totals = useMemo(() => {
    const debit = draft.entries
      .filter((entry) => entry.direction === "debit")
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    const credit = draft.entries
      .filter((entry) => entry.direction === "credit")
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    return {
      debit,
      credit,
      difference: Math.abs(debit - credit),
      balanced: Math.abs(debit - credit) < 0.005,
    };
  }, [draft.entries]);
  const updateEntry = (index: number, patch: Partial<EntryDraft>) =>
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  const stageAttachments = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setPendingAttachments((current) => {
      const keys = new Set(
        current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      );
      return [
        ...current,
        ...files.filter(
          (file) => !keys.has(`${file.name}:${file.size}:${file.lastModified}`),
        ),
      ];
    });
    setNotice(`已暂存 ${files.length} 个电子附件，保存凭证后完成关联。`);
  };
  const applySelectedTemplate = () => {
    const selectedTemplate = templates.find(
      (item) => item.template.id === selectedTemplateId,
    );
    if (!selectedTemplate) {
      setNotice("请选择要调用的凭证模板。");
      return;
    }
    setDraft((current) =>
      applyVoucherTemplateToDraft(current, selectedTemplate.entries),
    );
    setExpandedEntries([]);
    setNotice(`已调用凭证模板“${selectedTemplate.template.name}”。`);
  };
  const saveCurrentAsTemplate = async () => {
    if (!selectedCompanyId) return;
    const name = templateName.trim();
    if (!name) {
      setNotice("请填写模板名称。");
      return;
    }
    if (templates.some((item) => item.template.name === name)) {
      setNotice("当前账套已存在同名凭证模板。");
      return;
    }
    const entries = createVoucherTemplateEntries(
      draft.entries,
      draft.summary,
    );
    if (entries.length < 2) {
      setNotice("至少填写两条完整分录后才能保存模板。");
      return;
    }
    setSavingTemplate(true);
    try {
      let typeId = templateTypeId || templateTypes[0]?.id || "";
      if (!typeId) {
        const type = isTauri
          ? await createVoucherTemplateType({
              companyId: selectedCompanyId,
              name: "常用模板",
              sortOrder: 1,
            })
          : createBrowserPreviewVoucherTemplateType(
              selectedCompanyId,
              "常用模板",
              1,
            );
        typeId = type.id;
        if (!isTauri) setPreviewTemplateTypes([type]);
        setTemplateTypeId(typeId);
      }
      const savedTemplate = isTauri
        ? await createVoucherTemplate({
            companyId: selectedCompanyId,
            typeId,
            name,
            entries,
          })
        : createBrowserPreviewVoucherTemplate({
            companyId: selectedCompanyId,
            typeId,
            name,
            entries,
          });
      if (!isTauri)
        setPreviewTemplates((current) => [...current, savedTemplate]);
      setSelectedTemplateId(savedTemplate.template.id);
      setShowTemplateSave(false);
      setTemplateName("");
      setNotice(`凭证模板“${name}”已保存。`);
    } catch (error) {
      setNotice(`保存凭证模板失败：${String(error)}`);
    } finally {
      setSavingTemplate(false);
    }
  };
  const loadAuxiliarySetup = useCallback(
    async (accountCode: string) => {
      if (!selectedCompanyId || !accountCode) return;
      const setup = await fetchAccountSetup(accountCode, selectedCompanyId);
      setAuxiliarySetups((current) => ({ ...current, [accountCode]: setup }));
    },
    [fetchAccountSetup, selectedCompanyId],
  );
  useEffect(() => {
    const missingCodes = [
      ...new Set(draft.entries.map((entry) => entry.accountCode).filter(Boolean)),
    ].filter(
      (accountCode) =>
        !Object.prototype.hasOwnProperty.call(auxiliarySetups, accountCode),
    );
    for (const accountCode of missingCodes) void loadAuxiliarySetup(accountCode);
  }, [auxiliarySetups, draft.entries, loadAuxiliarySetup]);
  const changeAccount = (index: number, accountCode: string) => {
    const account = enabledAccounts.find((item) => item.code === accountCode);
    updateEntry(index, {
      accountCode,
      accountName: account?.name || "",
      auxiliaryType: "",
      auxiliaryId: "",
      auxiliarySelections: {},
      quantity: "",
      unitPrice: "",
      unit: account?.default_unit || "",
    });
    if (accountCode && selectedCompanyId) {
      void loadAuxiliarySetup(accountCode);
      void suggestSummaries(accountCode, selectedCompanyId).then(
        (suggestions) => {
          setSummarySuggestions((current) =>
            [...new Set([...current, ...suggestions])].slice(0, 20),
          );
        },
      );
    }
  };
  const addEntry = () =>
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          accountCode: "",
          accountName: "",
          direction: "debit",
          amount: "",
          summary: "",
          auxiliaryType: "",
          auxiliaryId: "",
          auxiliarySelections: {},
          docNumber: "",
          quantity: "",
          unitPrice: "",
          unit: "",
          currencyId: "",
          exchangeRate: "",
        },
      ],
    }));
  const removeEntry = (index: number) =>
    setDraft((current) =>
      current.entries.length <= 2
        ? current
        : {
            ...current,
            entries: current.entries.filter(
              (_, entryIndex) => entryIndex !== index,
            ),
          },
    );
  const autoBalance = () =>
    setDraft((current) => {
      if (totals.balanced) return current;
      const targetDirection = totals.debit > totals.credit ? "credit" : "debit";
      const lastEmpty = [...current.entries]
        .reverse()
        .findIndex(
          (entry) =>
            entry.direction === targetDirection &&
            entry.accountCode &&
            !Number(entry.amount),
        );
      if (lastEmpty < 0) return current;
      const index = current.entries.length - lastEmpty - 1;
      return {
        ...current,
        entries: current.entries.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, amount: String(totals.difference) }
            : entry,
        ),
      };
    });
  const toggleEntryDetails = (index: number) =>
    setExpandedEntries((current) =>
      current.includes(index)
        ? current.filter((entryIndex) => entryIndex !== index)
        : [...current, index],
    );
  const updateQuantityDimension = (
    index: number,
    field: "quantity" | "unitPrice",
    value: string,
  ) =>
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const next = { ...entry, [field]: value };
        const quantity = Number(next.quantity);
        const unitPrice = Number(next.unitPrice);
        return quantity > 0 && unitPrice >= 0 && next.quantity && next.unitPrice
          ? { ...next, amount: String(Math.round(quantity * unitPrice * 100) / 100) }
          : next;
      }),
    }));
  const renderAdvancedEntryFields = (entry: EntryDraft, index: number) => {
    const account = enabledAccounts.find(
      (item) => item.code === entry.accountCode,
    );
    const categories = auxiliarySetups[entry.accountCode]?.categories || [];
    const auxiliarySelections =
      entry.auxiliarySelections ||
      hydrateAuxiliarySelections({
        auxiliary_type: entry.auxiliaryType,
        auxiliary_id: entry.auxiliaryId,
      });
    const updateAuxiliarySelection = (
      categoryId: string,
      auxiliaryItemId: string,
    ) => {
      const nextSelections = { ...auxiliarySelections };
      if (auxiliaryItemId) nextSelections[categoryId] = auxiliaryItemId;
      else delete nextSelections[categoryId];
      const firstAuxiliary = serializeAuxiliarySelections(nextSelections)[0];
      updateEntry(index, {
        auxiliarySelections: nextSelections,
        auxiliaryType: firstAuxiliary?.auxiliary_category_id || "",
        auxiliaryId: firstAuxiliary?.auxiliary_item_id || "",
      });
    };
    const nonBaseCurrencies = currencies.filter(
      (currencyItem) => currencyItem.is_base !== 1,
    );
    const inputClass =
      "mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500";

    return (
      <div className="grid gap-3 bg-slate-50/80 p-3 sm:grid-cols-2 xl:grid-cols-6 dark:bg-[#0d1423]">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          单据号
          <input
            value={entry.docNumber}
            onChange={(event) =>
              updateEntry(index, { docNumber: event.target.value })
            }
            placeholder="合同号、发票号或业务单号"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          数量
          <input
            type="number"
            min="0"
            step="0.0001"
            disabled={account?.has_quantity !== 1}
            value={entry.quantity}
            onChange={(event) =>
              updateQuantityDimension(index, "quantity", event.target.value)
            }
            placeholder={account?.has_quantity === 1 ? "0" : "科目未启用"}
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          单价
          <input
            type="number"
            min="0"
            step="0.0001"
            disabled={account?.has_quantity !== 1}
            value={entry.unitPrice}
            onChange={(event) =>
              updateQuantityDimension(index, "unitPrice", event.target.value)
            }
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          单位
          <input
            disabled={account?.has_quantity !== 1}
            value={entry.unit}
            onChange={(event) => updateEntry(index, { unit: event.target.value })}
            placeholder={account?.default_unit || "单位"}
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          币别
          <select
            value={entry.currencyId}
            onChange={(event) => {
              const currencyId = event.target.value;
              const selectedCurrency = currencies.find(
                (currencyItem) => currencyItem.id === currencyId,
              );
              updateEntry(index, {
                currencyId,
                exchangeRate: selectedCurrency
                  ? String(selectedCurrency.exchange_rate)
                  : "",
              });
            }}
            className={inputClass}
          >
            <option value="">本位币</option>
            {nonBaseCurrencies.map((currencyItem) => (
              <option key={currencyItem.id} value={currencyItem.id}>
                {currencyItem.code} · {currencyItem.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          汇率
          <input
            type="number"
            min="0"
            step="0.000001"
            disabled={!entry.currencyId}
            value={entry.exchangeRate}
            onChange={(event) =>
              updateEntry(index, { exchangeRate: event.target.value })
            }
            placeholder={entry.currencyId ? "1.000000" : "本位币"}
            className={inputClass}
          />
        </label>
        <div className="sm:col-span-2 xl:col-span-6">
          <p className="text-xs text-slate-600 dark:text-slate-300">辅助核算</p>
          {categories.length === 0 ? (
            <p className="mt-1 flex h-8 items-center border border-dashed border-slate-300 px-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              当前科目未启用辅助核算
            </p>
          ) : (
            <div className="mt-1 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map((category) => {
                const categoryItems = auxiliaryItems.filter(
                  (item) =>
                    item.category_id === category.category_id &&
                    item.is_enabled === 1,
                );
                return (
                  <label
                    key={category.category_id}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  >
                    {category.category_name}
                    {category.is_required === 1 ? "（必填）" : ""}
                    <select
                      value={auxiliarySelections[category.category_id] || ""}
                      onChange={(event) =>
                        updateAuxiliarySelection(
                          category.category_id,
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">选择{category.category_name}</option>
                      {categoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const submitIntent = resolveVoucherSubmitIntent(submitter?.value);
    if (!selectedCompanyId || !currentPeriodId || !period)
      return setNotice("请先在顶部选择有效账套和账期。");
    const attachmentCount = Number(draft.attachmentCount || 0);
    const entries = draft.entries
      .map((entry) => ({ ...entry, amount: Number(entry.amount) || 0 }))
      .filter((entry) => entry.amount > 0);
    if (
      !draft.voucherDate ||
      !draft.voucherNumber.trim() ||
      !draft.voucherWordId ||
      !draft.summary.trim() ||
      !Number.isInteger(attachmentCount) ||
      attachmentCount < 0 ||
      entries.length < 2 ||
      entries.some((entry) => !entry.accountCode || !entry.accountName)
    )
      return setNotice(
        "请填写凭证日期、字号、摘要、凭证字、附件数和至少两条完整分录。",
      );
    const invalidQuantityEntry = entries.find(
      (entry) =>
        (entry.quantity.trim() || entry.unitPrice.trim() || entry.unit.trim()) &&
        (!(Number(entry.quantity) > 0) ||
          !(Number(entry.unitPrice) >= 0) ||
          !entry.unit.trim()),
    );
    if (invalidQuantityEntry)
      return setNotice("启用数量核算时，请完整填写大于零的数量、非负单价和单位。");
    const invalidCurrencyEntry = entries.find(
      (entry) => entry.currencyId && !(Number(entry.exchangeRate) > 0),
    );
    if (invalidCurrencyEntry)
      return setNotice("选择外币后，请填写大于零的汇率。");
    const pendingAuxiliarySetup = entries.find(
      (entry) =>
        !Object.prototype.hasOwnProperty.call(
          auxiliarySetups,
          entry.accountCode,
        ),
    );
    if (pendingAuxiliarySetup)
      return setNotice(
        `科目 ${pendingAuxiliarySetup.accountCode} 的辅助核算配置仍在读取，请稍后保存。`,
      );
    const missingRequiredAuxiliary = entries
      .map((entry) => ({
        entry,
        missing: getMissingRequiredAuxiliaryCategories(
          auxiliarySetups[entry.accountCode]?.categories || [],
          entry.auxiliarySelections ||
            hydrateAuxiliarySelections({
              auxiliary_type: entry.auxiliaryType,
              auxiliary_id: entry.auxiliaryId,
            }),
        ),
      }))
      .find((result) => result.missing.length > 0);
    if (missingRequiredAuxiliary)
      return setNotice(
        `科目 ${missingRequiredAuxiliary.entry.accountCode} 必须选择${missingRequiredAuxiliary.missing.map((category) => category.category_name).join("、")}辅助项目。`,
      );
    if (!totals.balanced)
      return setNotice(
        `借贷金额尚未平衡，当前差额为 ${currency(totals.difference)}。`,
      );
    setSaving(true);
    try {
      let savedVoucher: Voucher;
      if (mode === "edit") {
        if (!loadedVoucher) throw new Error("未加载可编辑的草稿凭证");
        savedVoucher = await updateVoucher(
          {
            id: loadedVoucher.id,
            voucher_date: draft.voucherDate,
            summary: draft.summary.trim(),
            reference_number: draft.referenceNumber.trim() || undefined,
            attachment_count: attachmentCount,
            version: loadedVoucher.version,
            entries: entries.map(voucherEntryPayload),
          },
          selectedCompanyId,
        );
      } else {
        savedVoucher = await addVoucher({
          company_id: selectedCompanyId,
          period_id: currentPeriodId,
          voucher_word_id: draft.voucherWordId,
          voucher_date: draft.voucherDate,
          voucher_number: draft.voucherNumber.trim(),
          summary: draft.summary.trim(),
          reference_number: draft.referenceNumber.trim() || undefined,
          attachment_count: attachmentCount,
          ai_suggestion_id: sourceAutomationJob?.id,
          bank_transaction_id: sourceBankTransaction?.id,
          business_source_kind: sourceBusinessRecord?.kind,
          business_source_id: sourceBusinessRecord?.record.id,
          entries: entries.map(voucherEntryPayload),
        });
      }
      if (isTauri) {
        await replaceVoucherTags(
          savedVoucher.id,
          selectedCompanyId,
          selectedTagIds,
        );
      } else {
        replaceBrowserPreviewVoucherTags(
          savedVoucher.id,
          selectedCompanyId,
          selectedTagIds,
        );
      }
      if (pendingAttachments.length > 0) {
        const createdAttachments = await Promise.all(
          pendingAttachments.map((file) =>
            recordLocalAttachment({
              companyId: selectedCompanyId,
              period: periodLabel,
              sourceModule: "会计凭证",
              file,
            }),
          ),
        );
        for (const attachment of createdAttachments) {
          if (attachment)
            await updateLocalAttachmentAssociation(
              attachment.id,
              savedVoucher.id,
              selectedCompanyId,
            );
        }
        setPendingAttachments([]);
      }
      const completionDetails: string[] = [];
      if (pendingAttachments.length > 0)
        completionDetails.push(`关联 ${pendingAttachments.length} 个电子附件`);
      if (mode === "create" && sourceInvoice) {
        const matchResult = await invoiceApi.matchToVoucher(
          sourceInvoice.id,
          savedVoucher.id,
          selectedCompanyId,
        );
        if (!matchResult.success) {
          navigate(`/vouchers/edit/${savedVoucher.id}`, {
            replace: true,
            state: {
              voucherNotice: `凭证草稿已保存，但发票 ${sourceInvoice.invoiceNo} 关联失败：${matchResult.error || "未知错误"}。请在发票或凭证匹配页面补充关联。`,
            },
          });
          return;
        }
        completionDetails.push(`关联发票 ${sourceInvoice.invoiceNo}`);
      }
      if (mode === "create" && sourceAutomationJob) {
        completionDetails.push(
          `回写 AI 建议 ${sourceAutomationJob.suggestionNo || sourceAutomationJob.id}`,
        );
      }
      if (mode === "create" && sourceBankTransaction) {
        completionDetails.push(`关联银行流水 ${sourceBankTransaction.serialNo}`);
      }
      if (mode === "create" && sourceBusinessRecord) {
        completionDetails.push(
          `回写${businessSourcePresentation(sourceBusinessRecord).title}`,
        );
      }
      const completionNotice = completionDetails.length
        ? `，并${completionDetails.join("、")}。`
        : "。";
      const successNotice = mode === "edit"
        ? `凭证草稿已保存修改${completionNotice}`
        : `凭证草稿已保存，等待人工审核${completionNotice}`;
      setNotice(successNotice);
      if (mode === "create" && submitIntent === "new") {
        const nextVoucherNumber = await getNextVoucherNumber(
          currentPeriodId,
          selectedCompanyId,
        );
        setDraft(createNextVoucherDraft(draft, nextVoucherNumber));
        setSourceInvoice(null);
        setSourceAutomationJob(null);
        setSourceBankTransaction(null);
        setSourceBusinessRecord(null);
        setSearchParams({}, { replace: true });
        setSelectedTagIds([]);
        setNotice(`凭证草稿已保存${completionNotice}已准备下一张凭证。`);
        return;
      }
      if (submitIntent === "close") {
        navigate("/vouchers");
        return;
      }
      if (mode === "create") {
        navigate(`/vouchers/edit/${savedVoucher.id}`, {
          replace: true,
          state: { voucherNotice: successNotice },
        });
        return;
      }
      setLoadedVoucher(savedVoucher);
      setDraft(draftFromVoucher(savedVoucher));
    } catch (error) {
      setNotice(`保存凭证失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section className={panelClassName()}>
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">
                {mode === "edit" ? "编辑会计凭证草稿" : "新增会计凭证草稿"}
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              录入凭证表头和分录后保存草稿；审核、反审核和过账仍在凭证列表受控执行。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/vouchers")}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回列表
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新读取
            </button>
          </div>
        </header>
        {mode === "create" && sourceInvoice && (
          <div className="flex flex-col gap-2 border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0">
                <p className="font-semibold">
                  来源：{sourceInvoice.invoiceType === "output" ? "销项" : "进项"}发票 {sourceInvoice.invoiceNo}
                </p>
                <p className="mt-1 break-words text-sky-700 dark:text-sky-300">
                  {sourceInvoice.invoiceDate} · {sourceInvoice.invoiceType === "output"
                    ? sourceInvoice.buyerName || "购方待补"
                    : sourceInvoice.sellerName || "销方待补"} · 含税金额 {currency(sourceInvoice.totalAmount)}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sky-700 dark:text-sky-300">
              保存后关联发票，不自动审核或过账；请核对并选择会计科目。
            </p>
          </div>
        )}
        {mode === "create" && sourceAutomationJob && (
          <div className="flex flex-col gap-2 border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0">
                <p className="font-semibold">
                  来源：AI 凭证建议 {sourceAutomationJob.suggestionNo || sourceAutomationJob.id}
                </p>
                <p className="mt-1 break-words text-sky-700 dark:text-sky-300">
                  {sourceAutomationJob.sourceModule} · {sourceAutomationJob.sourceFile || "未登记来源文件"} · 建议金额 {currency(sourceAutomationJob.suggestionAmount || 0)}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sky-700 dark:text-sky-300">
              保存后原子回写建议关联；仍需在凭证列表人工审核。
            </p>
          </div>
        )}
        {mode === "create" && sourceBankTransaction && (
          <div className="flex flex-col gap-2 border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0">
                <p className="font-semibold">来源：银行流水 {sourceBankTransaction.serialNo}</p>
                <p className="mt-1 break-words text-sky-700 dark:text-sky-300">
                  {sourceBankTransaction.transactionDate} · {sourceBankTransaction.counterparty || "对方待补"} · 流水金额 {currency(sourceBankTransaction.incomeAmount || sourceBankTransaction.expenseAmount)}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sky-700 dark:text-sky-300">
              银行科目已尽量预填；请补充对方科目，保存后回写流水关联。
            </p>
          </div>
        )}
        {mode === "create" && sourceBusinessRecord && (() => {
          const presentation = businessSourcePresentation(sourceBusinessRecord);
          return (
            <div className="flex flex-col gap-2 border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <div className="min-w-0">
                  <p className="font-semibold">来源：{presentation.title}</p>
                  <p className="mt-1 break-words text-sky-700 dark:text-sky-300">
                    {presentation.detail} · 来源金额 {currency(presentation.amount)}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sky-700 dark:text-sky-300">
                保存后原子回写来源关联；仍需人工核对科目并审核凭证。
              </p>
            </div>
          );
        })()}
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-[#0d1423]">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
              凭证模板
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="mt-1 h-8 w-full min-w-0 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
              >
                <option value="">选择已保存模板</option>
                {templateTypes.map((templateType) => (
                  <optgroup key={templateType.id} label={templateType.name}>
                    {templates
                      .filter(
                        (item) => item.template.type_id === templateType.id,
                      )
                      .map((item) => (
                        <option key={item.template.id} value={item.template.id}>
                          {item.template.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedTemplateId}
                onClick={applySelectedTemplate}
                className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
              >
                <BookTemplate className="h-3.5 w-3.5" />
                调用模板
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemplateTypeId((current) => current || templateTypes[0]?.id || "");
                  setTemplateName((current) => current || draft.summary.trim());
                  setShowTemplateSave((current) => !current);
                }}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Save className="h-3.5 w-3.5" />
                保存为模板
              </button>
            </div>
          </div>
          {showTemplateSave && (
            <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end dark:border-slate-800">
              <label className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
                模板分类
                <select
                  value={templateTypeId}
                  onChange={(event) => setTemplateTypeId(event.target.value)}
                  className="mt-1 h-8 w-full min-w-0 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                >
                  {templateTypes.length === 0 && (
                    <option value="">保存时自动创建“常用模板”</option>
                  )}
                  {templateTypes.map((templateType) => (
                    <option key={templateType.id} value={templateType.id}>
                      {templateType.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
                模板名称
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="例如：支付服务费"
                  className="mt-1 h-8 w-full min-w-0 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateSave(false)}
                  className="inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={savingTemplate}
                  onClick={() => void saveCurrentAsTemplate()}
                  className="inline-flex h-8 items-center bg-[#1f65a7] px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-sky-600"
                >
                  {savingTemplate ? "保存中" : "确认保存"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200 sm:flex-row sm:items-center sm:justify-between">
          <span>
            范围：{company?.name || "未选择账套"} · {periodLabel}
          </span>
          <span>状态：{mode === "edit" ? "仅草稿可修改" : "保存为草稿"}</span>
        </div>
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
          本页不会自动审核、过账或修改已结账账期凭证。
        </div>
        <datalist id="voucher-summary-suggestions">
          {summarySuggestions.map((summary) => (
            <option key={summary} value={summary} />
          ))}
        </datalist>
        {notice && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
            {notice}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            正在读取凭证录入范围...
          </div>
        ) : (
          <form ref={formRef} onSubmit={(event) => void save(event)}>
            <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-6 dark:border-slate-800">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                凭证日期
                <input
                  required
                  type="date"
                  value={draft.voucherDate}
                  onChange={(event) =>
                    setDraft({ ...draft, voucherDate: event.target.value })
                  }
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                凭证字号
                <input
                  required
                  value={draft.voucherNumber}
                  onChange={(event) =>
                    setDraft({ ...draft, voucherNumber: event.target.value })
                  }
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                凭证字
                <select
                  required
                  value={draft.voucherWordId}
                  onChange={(event) =>
                    setDraft({ ...draft, voucherWordId: event.target.value })
                  }
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                >
                  <option value="">选择凭证字</option>
                  {voucherWords.map((word) => (
                    <option key={word.id} value={word.id}>
                      {word.word_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                原始附件张数
                <input
                  required
                  type="number"
                  min="0"
                  value={draft.attachmentCount}
                  onChange={(event) =>
                    setDraft({ ...draft, attachmentCount: event.target.value })
                  }
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300 xl:col-span-2">
                来源参考号
                <input
                  value={draft.referenceNumber}
                  onChange={(event) =>
                    setDraft({ ...draft, referenceNumber: event.target.value })
                  }
                  placeholder="发票、流水或业务单据编号"
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300 xl:col-span-6">
                摘要
                <input
                  required
                  list="voucher-summary-suggestions"
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft({ ...draft, summary: event.target.value })
                  }
                  placeholder="概括本次经济业务"
                  className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100"
                />
              </label>
            </div>
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-[#1f65a7] dark:text-sky-400" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      电子附件
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      已关联 {linkedAttachments.length} 个 · 待保存 {pendingAttachments.length} 个
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    保存名称、大小、格式与校验值并关联凭证；文件本体保留在本机，不上传外部存储。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="inline-flex h-8 self-start items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30 sm:self-auto"
                >
                  <Upload className="h-3.5 w-3.5" />
                  选择本机文件
                </button>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.ofd,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.zip"
                  className="hidden"
                  onChange={stageAttachments}
                />
              </div>
              {(linkedAttachments.length > 0 || pendingAttachments.length > 0) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {linkedAttachments.map((attachment) => (
                    <div key={attachment.id} className="min-w-0 border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                      <p className="truncate font-medium" title={attachment.fileName}>{attachment.fileName}</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        {attachment.fileFormat} · {formatLocalFileSize(attachment.fileSize)} · 已关联
                      </p>
                    </div>
                  ))}
                  {pendingAttachments.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-start justify-between gap-2 border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={file.name}>{file.name}</p>
                        <p className="mt-1 text-amber-700 dark:text-amber-300">
                          {formatLocalFileSize(file.size)} · 待保存
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingAttachments((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        className="shrink-0 text-rose-600 hover:text-rose-700 dark:text-rose-300"
                        title="移除待保存附件"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-[#1f65a7] dark:text-sky-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    业务标签（可选）
                  </span>
                  {selectedTagIds.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      已选 {selectedTagIds.length} 项
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/settings/tags")}
                  className="self-start text-xs text-[#1f65a7] hover:underline dark:text-sky-300 sm:self-auto"
                >
                  前往标签档案
                </button>
              </div>
              {selectableVoucherTags.length > 0 ? (
                <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                  {selectableVoucherTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedTagIds((current) =>
                            toggleVoucherTagId(current, tag.id),
                          )
                        }
                        className={`inline-flex min-h-8 max-w-full items-center gap-1.5 border px-2.5 text-xs ${tagColorClassName(tag.color_name, selected)}`}
                      >
                        <span className="truncate">{tag.name}</span>
                        {tag.is_enabled !== 1 && (
                          <span className="shrink-0 opacity-70">已停用</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  当前账套暂无可用的凭证标签。
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold">凭证分录</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  从当前账套的启用明细科目中选择；必要时填写分录摘要。
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={autoBalance}
                  disabled={totals.balanced}
                  className="inline-flex h-8 items-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  补平空行
                </button>
                <button
                  type="button"
                  onClick={addEntry}
                  className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  增加分录
                </button>
              </div>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-12 px-3 py-3">行</th>
                    <th className="w-44 px-3 py-3">会计科目</th>
                    <th className="w-24 px-3 py-3">方向</th>
                    <th className="w-36 px-3 py-3 text-right">金额</th>
                    <th className="px-3 py-3">分录摘要</th>
                    <th className="w-16 px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {draft.entries.map((entry, index) => (
                    <Fragment key={index}>
                    <tr>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleEntryDetails(index)}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-[#1f65a7] dark:text-slate-400 dark:hover:text-sky-300"
                          title={expandedEntries.includes(index) ? "收起高级字段" : "展开高级字段"}
                        >
                          {expandedEntries.includes(index) ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {index + 1}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          required
                          aria-label={`分录 ${index + 1} 会计科目`}
                          value={entry.accountCode}
                          onChange={(event) =>
                            changeAccount(index, event.target.value)
                          }
                          className="h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        >
                          <option value="">选择明细科目</option>
                          {enabledAccounts.map((account) => (
                            <option key={account.code} value={account.code}>
                              {account.code} · {account.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`分录 ${index + 1} 借贷方向`}
                          value={entry.direction}
                          onChange={(event) =>
                            updateEntry(index, {
                              direction: event.target
                                .value as EntryDraft["direction"],
                            })
                          }
                          className="h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        >
                          <option value="debit">借方</option>
                          <option value="credit">贷方</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          required
                          aria-label={`分录 ${index + 1} 金额`}
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={entry.amount}
                          onChange={(event) =>
                            updateEntry(index, { amount: event.target.value })
                          }
                          className="h-8 w-full border border-slate-300 bg-white px-2 text-right text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          list="voucher-summary-suggestions"
                          value={entry.summary}
                          onChange={(event) =>
                            updateEntry(index, { summary: event.target.value })
                          }
                          placeholder={draft.summary || "分录摘要"}
                          className="h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          aria-label={`删除分录 ${index + 1}`}
                          disabled={draft.entries.length <= 2}
                          onClick={() => removeEntry(index)}
                          className="text-rose-600 disabled:opacity-40 dark:text-rose-300"
                        >
                          <Trash2 className="ml-auto h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {expandedEntries.includes(index) && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          {renderAdvancedEntryFields(entry, index)}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 lg:hidden">
              {draft.entries.map((entry, index) => (
                <article
                  key={index}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">分录 {index + 1}</p>
                    <button
                      type="button"
                      disabled={draft.entries.length <= 2}
                      onClick={() => removeEntry(index)}
                      className="text-xs text-rose-600 disabled:opacity-40 dark:text-rose-300"
                    >
                      删除
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <label className="text-xs text-slate-600 dark:text-slate-300">
                      会计科目
                      <select
                        required
                        value={entry.accountCode}
                        onChange={(event) =>
                          changeAccount(index, event.target.value)
                        }
                        className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                      >
                        <option value="">选择明细科目</option>
                        {enabledAccounts.map((account) => (
                          <option key={account.code} value={account.code}>
                            {account.code} · {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-600 dark:text-slate-300">
                        方向
                        <select
                          value={entry.direction}
                          onChange={(event) =>
                            updateEntry(index, {
                              direction: event.target
                                .value as EntryDraft["direction"],
                            })
                          }
                          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        >
                          <option value="debit">借方</option>
                          <option value="credit">贷方</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600 dark:text-slate-300">
                        金额
                        <input
                          required
                          inputMode="decimal"
                          value={entry.amount}
                          onChange={(event) =>
                            updateEntry(index, { amount: event.target.value })
                          }
                          className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                        />
                      </label>
                    </div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">
                      分录摘要
                      <input
                        list="voucher-summary-suggestions"
                        value={entry.summary}
                        onChange={(event) =>
                          updateEntry(index, { summary: event.target.value })
                        }
                        className="mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleEntryDetails(index)}
                        className="inline-flex h-8 items-center gap-1 text-xs text-[#1f65a7] dark:text-sky-300"
                      >
                        {expandedEntries.includes(index) ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {expandedEntries.includes(index)
                          ? "收起高级字段"
                          : "单据、数量、外币与辅助核算"}
                      </button>
                      {expandedEntries.includes(index) && (
                        <div className="mt-2">
                          {renderAdvancedEntryFields(entry, index)}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-4 dark:border-slate-800">
              <Info label="借方合计" value={currency(totals.debit)} />
              <Info label="贷方合计" value={currency(totals.credit)} />
              <Info label="借贷差额" value={currency(totals.difference)} />
              <Info
                label="校验状态"
                value={totals.balanced ? "借贷平衡" : "待补平"}
              />
              <div className="sm:col-span-4">
                <Info
                  label="金额大写"
                  value={toChineseCurrencyUppercase(totals.debit)}
                />
              </div>
            </div>
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800 dark:bg-[#0d1423]">
              <Info
                label="制单人"
                value={loadedVoucher ? loadedVoucher.created_by || "未记录" : "admin"}
              />
              <Info
                label="制单时间"
                value={
                  loadedVoucher
                    ? formatAuditTime(loadedVoucher.created_at)
                    : "保存凭证后生成"
                }
              />
              <Info
                label="最后修改"
                value={
                  loadedVoucher
                    ? `${loadedVoucher.modified_by || "未修改"} · ${formatAuditTime(loadedVoucher.modified_at)}`
                    : "尚未保存"
                }
              />
              <Info
                label="审核信息"
                value={
                  loadedVoucher
                    ? `${loadedVoucher.approved_by || "未审核"} · ${formatAuditTime(loadedVoucher.approved_at)}`
                    : "未审核"
                }
              />
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate("/vouchers")}
                className="inline-flex h-8 items-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                取消
              </button>
              {mode === "create" && (
                <button
                  type="submit"
                  value="save-and-new"
                  disabled={saving || !totals.balanced}
                  className="inline-flex h-8 items-center gap-1 border border-[#1f65a7] px-3 text-xs font-medium text-[#1f65a7] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500 dark:text-sky-300 dark:hover:bg-sky-950/30"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  保存并新增
                </button>
              )}
              <button
                type="submit"
                value="save-and-close"
                disabled={saving || !totals.balanced}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Save className="h-3.5 w-3.5" />
                保存并关闭
              </button>
              <button
                type="submit"
                value="save"
                disabled={saving || !totals.balanced}
                className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#19568f] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "保存中" : mode === "edit" ? "保存修改" : "保存草稿"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </main>
  );
}

export function VoucherCreateWorkspace() {
  return <VoucherEntryWorkspace mode="create" />;
}
export function VoucherEditWorkspace() {
  return <VoucherEntryWorkspace mode="edit" />;
}
