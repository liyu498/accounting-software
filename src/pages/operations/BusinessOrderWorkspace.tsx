import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  FilePenLine,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
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
import { businessOrderApi, type BusinessOrder } from "../../lib/api";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { buildVoucherSourcePath } from "../../lib/voucherSourceWorkflow.js";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

export type BusinessOrderMode = "purchase" | "sales";
type OrderScope = "all" | "fulfillment" | "invoice" | "settlement";
type OrderDraft = {
  orderNo: string;
  businessDate: string;
  counterparty: string;
  goodsName: string;
  amount: string;
  fulfillmentStatus: string;
  invoiceStatus: string;
  settlementStatus: string;
  sourceDocument: string;
};

type BrowserDocumentBusinessData = {
  documentRecords: unknown[];
  businessOrders: BusinessOrder[];
};

type OrderWorkspaceConfig = {
  title: string;
  description: string;
  orderPrefix: string;
  counterpartyLabel: string;
  fulfillmentLabel: string;
  invoiceLabel: string;
  settlementLabel: string;
  fulfillmentOptions: string[];
  invoiceOptions: string[];
  settlementOptions: string[];
  newOrderLabel: string;
  documentLabel: string;
  invoicePath: string;
  invoiceLabelLink: string;
  workflowItems: Array<{
    title: string;
    description: string;
    path: string;
    icon: typeof FileText;
  }>;
};

const browserStorageKey = "accounting-preview-document-business-data-v2";
const scopes: Array<{ id: OrderScope; label: string }> = [
  { id: "all", label: "全部订单" },
  { id: "fulfillment", label: "待履约" },
  { id: "invoice", label: "待发票" },
  { id: "settlement", label: "待结算" },
];

const orderConfigs: Record<BusinessOrderMode, OrderWorkspaceConfig> = {
  purchase: {
    title: "采购订单与履约",
    description:
      "维护采购订单、到货入库、进项收票和付款状态；可生成待复核凭证草稿，不自动审核或过账。",
    orderPrefix: "CG",
    counterpartyLabel: "供应商",
    fulfillmentLabel: "入库状态",
    invoiceLabel: "收票状态",
    settlementLabel: "付款状态",
    fulfillmentOptions: ["待入库", "部分入库", "已入库"],
    invoiceOptions: ["待收票", "部分收票", "已收票"],
    settlementOptions: ["未付款", "部分付款", "已付款"],
    newOrderLabel: "新增采购订单",
    documentLabel: "采购单据",
    invoicePath: "/invoices/input",
    invoiceLabelLink: "进项发票",
    workflowItems: [
      {
        title: "登记采购来源",
        description:
          "补齐合同、到货单或验收资料，再由单据登记模块完成附件核验。",
        path: "/documents",
        icon: ReceiptText,
      },
      {
        title: "核对进项收票",
        description: "进入进项发票，人工确认认证、抵扣和订单匹配结果。",
        path: "/invoices/input",
        icon: ArrowDownToLine,
      },
      {
        title: "付款与应付核销",
        description: "付款流水和应付核销需按实际回单、发票与审批资料人工确认。",
        path: "/settlement/payable",
        icon: WalletCards,
      },
    ],
  },
  sales: {
    title: "销售订单与履约",
    description:
      "维护销售订单、出库履约、销项开票和收款状态；可生成待复核凭证草稿，不自动审核或过账。",
    orderPrefix: "XS",
    counterpartyLabel: "客户",
    fulfillmentLabel: "出库状态",
    invoiceLabel: "开票状态",
    settlementLabel: "收款状态",
    fulfillmentOptions: ["待出库", "部分出库", "已出库"],
    invoiceOptions: ["待开票", "部分开票", "已开票"],
    settlementOptions: ["未收款", "部分收款", "已收款"],
    newOrderLabel: "新增销售订单",
    documentLabel: "销售单据",
    invoicePath: "/invoices/output",
    invoiceLabelLink: "销项发票",
    workflowItems: [
      {
        title: "登记销售来源",
        description:
          "补齐合同、发货单或签收资料，再由单据登记模块完成附件核验。",
        path: "/documents",
        icon: ReceiptText,
      },
      {
        title: "核对销项开票",
        description: "进入销项发票，人工确认开票、红冲和订单匹配结果。",
        path: "/invoices/output",
        icon: ArrowUpFromLine,
      },
      {
        title: "收款与应收核销",
        description: "收款流水和应收核销需按实际回单、发票与审批资料人工确认。",
        path: "/settlement/receivable",
        icon: Landmark,
      },
    ],
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function isBusinessOrder(value: unknown): value is BusinessOrder {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<BusinessOrder>;
  return (
    typeof record.id === "string" &&
    typeof record.companyId === "string" &&
    typeof record.period === "string" &&
    (record.orderType === "purchase" || record.orderType === "sales") &&
    typeof record.orderNo === "string" &&
    typeof record.businessDate === "string" &&
    typeof record.counterparty === "string" &&
    typeof record.goodsName === "string" &&
    Number.isFinite(record.amount) &&
    typeof record.fulfillmentStatus === "string" &&
    typeof record.invoiceStatus === "string" &&
    typeof record.settlementStatus === "string" &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function loadBrowserDocumentBusinessData(): BrowserDocumentBusinessData {
  if (typeof window === "undefined")
    return { documentRecords: [], businessOrders: [] };
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(browserStorageKey) || "null",
    ) as Partial<BrowserDocumentBusinessData> | null;
    if (
      !parsed ||
      !Array.isArray(parsed.documentRecords) ||
      !Array.isArray(parsed.businessOrders)
    )
      return { documentRecords: [], businessOrders: [] };
    return {
      documentRecords: parsed.documentRecords,
      businessOrders: parsed.businessOrders.filter(isBusinessOrder),
    };
  } catch {
    return { documentRecords: [], businessOrders: [] };
  }
}

function saveBrowserDocumentBusinessData(data: BrowserDocumentBusinessData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(data));
  } catch {
    // Local preview remains usable until the browser storage quota is reached.
  }
}

function isComplete(status: string) {
  return status.startsWith("已");
}

function statusClass(status: string) {
  if (isComplete(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status.includes("部分"))
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
}

function createDraft(
  config: OrderWorkspaceConfig,
  businessDate: string,
): OrderDraft {
  return {
    orderNo: "",
    businessDate,
    counterparty: "",
    goodsName: "",
    amount: "",
    fulfillmentStatus: config.fulfillmentOptions[0],
    invoiceStatus: config.invoiceOptions[0],
    settlementStatus: config.settlementOptions[0],
    sourceDocument: "",
  };
}

function draftFromOrder(order: BusinessOrder): OrderDraft {
  return {
    orderNo: order.orderNo,
    businessDate: order.businessDate,
    counterparty: order.counterparty,
    goodsName: order.goodsName,
    amount: String(order.amount),
    fulfillmentStatus: order.fulfillmentStatus,
    invoiceStatus: order.invoiceStatus,
    settlementStatus: order.settlementStatus,
    sourceDocument: order.sourceDocument || "",
  };
}

export function BusinessOrderWorkspace({ mode }: { mode: BusinessOrderMode }) {
  const config = orderConfigs[mode];
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
  const defaultBusinessDate =
    currentPeriod?.end_date || browserPreviewPeriod?.end_date || "";
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [scope, setScope] = useState<OrderScope>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<BusinessOrder | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(() =>
    createDraft(config, defaultBusinessDate),
  );
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (companyId && isTauri) void fetchPeriods(companyId);
  }, [companyId, fetchPeriods]);

  const refresh = useCallback(async () => {
    if (!companyId || !period) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isTauri) {
      const preview = loadBrowserDocumentBusinessData();
      setOrders(
        preview.businessOrders.filter(
          (order) =>
            order.companyId === companyId &&
            order.period === period &&
            order.orderType === mode,
        ),
      );
      setLoading(false);
      return;
    }
    const result = await businessOrderApi.getBusinessOrders({
      companyId,
      period,
      orderType: mode,
    });
    setOrders(result.success ? result.data || [] : []);
    setNotice(
      result.success
        ? null
        : `读取${config.title}失败：${result.error || "未知错误"}`,
    );
    setLoading(false);
  }, [companyId, config.title, mode, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredOrders = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return orders.filter((order) => {
      const inScope =
        scope === "all" ||
        (scope === "fulfillment" && !isComplete(order.fulfillmentStatus)) ||
        (scope === "invoice" && !isComplete(order.invoiceStatus)) ||
        (scope === "settlement" && !isComplete(order.settlementStatus));
      const searchable = [
        order.orderNo,
        order.counterparty,
        order.goodsName,
        order.sourceDocument,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        inScope &&
        (!normalizedKeyword || searchable.includes(normalizedKeyword))
      );
    });
  }, [keyword, orders, scope]);
  const orderPage = useMemo(
    () => paginateOperationalRows(filteredOrders, page, pageSize),
    [filteredOrders, page, pageSize],
  );
  const exportHeaders = [
    "业务日期",
    "订单编号",
    config.counterpartyLabel,
    "商品/服务",
    "金额",
    config.fulfillmentLabel,
    config.invoiceLabel,
    config.settlementLabel,
    "来源单据",
  ];
  const exportRows = useMemo(
    () =>
      filteredOrders.map((order) => [
        order.businessDate,
        order.orderNo,
        order.counterparty,
        order.goodsName,
        formatCurrency(order.amount),
        order.fulfillmentStatus,
        order.invoiceStatus,
        order.settlementStatus,
        order.sourceDocument || "—",
      ]),
    [filteredOrders],
  );

  const metrics = useMemo(
    () => ({
      totalAmount: orders.reduce((total, order) => total + order.amount, 0),
      pendingFulfillment: orders.filter(
        (order) => !isComplete(order.fulfillmentStatus),
      ).length,
      pendingInvoice: orders.filter((order) => !isComplete(order.invoiceStatus))
        .length,
      pendingSettlement: orders.filter(
        (order) => !isComplete(order.settlementStatus),
      ).length,
    }),
    [orders],
  );

  const openCreate = () => {
    setEditingOrder(null);
    setDraft(createDraft(config, defaultBusinessDate));
    setShowEditor(true);
  };

  const openEdit = (order: BusinessOrder) => {
    setEditingOrder(order);
    setDraft(draftFromOrder(order));
    setShowEditor(true);
  };

  const saveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !period) {
      setNotice("请先在顶部选择账套和账期，再维护订单。");
      return;
    }
    const amount = Number(draft.amount);
    if (
      !draft.orderNo.trim() ||
      !draft.businessDate ||
      !draft.counterparty.trim() ||
      !draft.goodsName.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setNotice("请填写订单编号、业务日期、往来单位、商品服务和大于零的金额。");
      return;
    }
    const input = {
      companyId,
      period,
      orderType: mode,
      orderNo: draft.orderNo.trim(),
      businessDate: draft.businessDate,
      counterparty: draft.counterparty.trim(),
      goodsName: draft.goodsName.trim(),
      amount,
      fulfillmentStatus: draft.fulfillmentStatus,
      invoiceStatus: draft.invoiceStatus,
      settlementStatus: draft.settlementStatus,
      status:
        isComplete(draft.fulfillmentStatus) &&
        isComplete(draft.invoiceStatus) &&
        isComplete(draft.settlementStatus)
          ? "已完成"
          : "处理中",
      sourceDocument: draft.sourceDocument.trim() || undefined,
    };
    setSaving(true);
    if (!isTauri) {
      const preview = loadBrowserDocumentBusinessData();
      const timestamp = new Date().toISOString();
      const order: BusinessOrder = editingOrder
        ? {
            ...editingOrder,
            ...input,
            sourceDocument: input.sourceDocument || null,
            updatedAt: timestamp,
          }
        : {
            id: `preview-${mode}-order-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ...input,
            sourceDocument: input.sourceDocument || null,
            voucherId: null,
            voucherNumber: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
      saveBrowserDocumentBusinessData({
        ...preview,
        businessOrders: [
          order,
          ...preview.businessOrders.filter((item) => item.id !== order.id),
        ],
      });
      setSaving(false);
      setShowEditor(false);
      setNotice(
        editingOrder
          ? `${config.title}已更新。`
          : `${config.title}已保存，请继续人工核验履约、发票和结算资料。`,
      );
      await refresh();
      return;
    }
    const result = editingOrder
      ? await businessOrderApi.updateBusinessOrder({
          ...input,
          id: editingOrder.id,
        })
      : await businessOrderApi.createBusinessOrder(input);
    setSaving(false);
    if (!result.success) {
      setNotice(
        `${editingOrder ? "更新" : "新增"}订单失败：${result.error || "未知错误"}`,
      );
      return;
    }
    setShowEditor(false);
    setNotice(
      editingOrder
        ? `${config.title}已更新。`
        : `${config.title}已保存，系统不自动生成或过账凭证。`,
    );
    await refresh();
  };

  const rowActions = (order: BusinessOrder) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() =>
          navigate(
            order.voucherId
              ? `/vouchers/detail/${order.voucherId}`
              : buildVoucherSourcePath({ kind: "business_order", id: order.id }),
          )
        }
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {order.voucherId ? "查看凭证" : "生成凭证"}
      </button>
      <button
        type="button"
        onClick={() => navigate(config.invoicePath)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileText className="h-3.5 w-3.5" />
        {config.invoiceLabelLink}
      </button>
      <button
        type="button"
        onClick={() => openEdit(order)}
        disabled={Boolean(order.voucherId)}
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
              <Boxes className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">{config.title}</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {config.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title={`${config.title}清单`}
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
              disabled={!companyId || !period}
              onClick={openCreate}
              className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {config.newOrderLabel}
            </button>
          </div>
        </header>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={WalletCards}
            label="本期订单金额"
            value={formatCurrency(metrics.totalAmount)}
          />
          <Metric
            icon={Boxes}
            label={`待${config.fulfillmentLabel.replace("状态", "")}`}
            value={`${metrics.pendingFulfillment} 笔`}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Metric
            icon={FileText}
            label={`待${config.invoiceLabel.replace("状态", "")}`}
            value={`${metrics.pendingInvoice} 笔`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={Landmark}
            label={`待${config.settlementLabel.replace("状态", "")}`}
            value={`${metrics.pendingSettlement} 笔`}
            tone="text-rose-600 dark:text-rose-400"
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
              placeholder={`搜索订单、${config.counterpartyLabel}、商品服务或来源单据`}
              className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500"
            />
          </label>
        </div>
        {notice && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
            {notice}
          </div>
        )}
        {!companyId && <Placeholder message="请选择账套后查看或维护订单。" />}
        {companyId && !period && (
          <Placeholder message="请选择账期后读取本期订单。" />
        )}
        {companyId && period && loading && (
          <Placeholder message="正在读取订单资料..." />
        )}
        {companyId && period && !loading && (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[9%] px-3 py-3 font-medium">业务日期</th>
                    <th className="w-[12%] px-3 py-3 font-medium">订单编号</th>
                    <th className="w-[13%] px-3 py-3 font-medium">
                      {config.counterpartyLabel}
                    </th>
                    <th className="w-[15%] px-3 py-3 font-medium">商品/服务</th>
                    <th className="w-[10%] px-3 py-3 text-right font-medium">
                      金额
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">
                      {config.fulfillmentLabel}
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">
                      {config.invoiceLabel}
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">
                      {config.settlementLabel}
                    </th>
                    <th className="w-[14%] px-3 py-3 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orderPage.rows.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        {order.businessDate}
                      </td>
                      <td
                        className="truncate px-3 py-3 font-mono text-slate-700 dark:text-slate-200"
                        title={order.orderNo}
                      >
                        {order.orderNo}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={order.counterparty}
                      >
                        {order.counterparty}
                      </td>
                      <td
                        className="truncate px-3 py-3"
                        title={order.goodsName}
                      >
                        {order.goodsName}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(order.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <Status status={order.fulfillmentStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <Status status={order.invoiceStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <Status status={order.settlementStatus} />
                      </td>
                      <td className="px-3 py-3">{rowActions(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {orderPage.rows.map((order) => (
                <article
                  key={order.id}
                  className="border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {order.orderNo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {order.businessDate} · {order.counterparty}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(order.amount)}
                    </p>
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-700 dark:text-slate-200">
                    {order.goodsName}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <StatusInfo
                      label={config.fulfillmentLabel}
                      status={order.fulfillmentStatus}
                    />
                    <StatusInfo
                      label={config.invoiceLabel}
                      status={order.invoiceStatus}
                    />
                    <StatusInfo
                      label={config.settlementLabel}
                      status={order.settlementStatus}
                    />
                  </div>
                  <div className="mt-3">{rowActions(order)}</div>
                </article>
              ))}
            </div>
            {filteredOrders.length === 0 && (
              <Placeholder message="当前筛选没有订单记录。" />
            )}
            <OperationalPagination
              page={orderPage}
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
        {config.workflowItems.map((item) => (
          <WorkflowLink
            key={item.title}
            {...item}
            onClick={() => navigate(item.path)}
          />
        ))}
      </section>
      {showEditor && (
        <OrderEditor
          config={config}
          draft={draft}
          editing={Boolean(editingOrder)}
          saving={saving}
          onChange={setDraft}
          onClose={() => setShowEditor(false)}
          onSubmit={saveOrder}
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
        <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
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

function StatusInfo({ label, status }: { label: string; status: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1">
        <Status status={status} />
      </div>
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
      className="flex items-start gap-3 border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-900 dark:hover:bg-sky-950/20"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-sky-50 text-[#1f65a7] dark:bg-sky-950/40 dark:text-sky-300">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
    </button>
  );
}

function OrderEditor({
  config,
  draft,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  config: OrderWorkspaceConfig;
  draft: OrderDraft;
  editing: boolean;
  saving: boolean;
  onChange: (draft: OrderDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="订单编辑"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? `编辑${config.title}` : config.newOrderLabel}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              保存后需人工完成履约、发票和结算复核，系统不自动生成或过账凭证。
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
          <Field label="订单编号 *">
            <input
              required
              value={draft.orderNo}
              onChange={(event) =>
                onChange({ ...draft, orderNo: event.target.value })
              }
              placeholder={`${config.orderPrefix}-2026-0001`}
            />
          </Field>
          <Field label="业务日期 *">
            <input
              required
              type="date"
              value={draft.businessDate}
              onChange={(event) =>
                onChange({ ...draft, businessDate: event.target.value })
              }
            />
          </Field>
          <Field label={`${config.counterpartyLabel} *`}>
            <input
              required
              value={draft.counterparty}
              onChange={(event) =>
                onChange({ ...draft, counterparty: event.target.value })
              }
            />
          </Field>
          <Field label="商品/服务 *">
            <input
              required
              value={draft.goodsName}
              onChange={(event) =>
                onChange({ ...draft, goodsName: event.target.value })
              }
            />
          </Field>
          <Field label="金额 *">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: event.target.value })
              }
            />
          </Field>
          <Field label="来源单据">
            <input
              value={draft.sourceDocument}
              onChange={(event) =>
                onChange({ ...draft, sourceDocument: event.target.value })
              }
              placeholder={config.documentLabel}
            />
          </Field>
          <Field label={config.fulfillmentLabel}>
            <select
              value={draft.fulfillmentStatus}
              onChange={(event) =>
                onChange({ ...draft, fulfillmentStatus: event.target.value })
              }
            >
              {config.fulfillmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label={config.invoiceLabel}>
            <select
              value={draft.invoiceStatus}
              onChange={(event) =>
                onChange({ ...draft, invoiceStatus: event.target.value })
              }
            >
              {config.invoiceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label={config.settlementLabel}>
            <select
              value={draft.settlementStatus}
              onChange={(event) =>
                onChange({ ...draft, settlementStatus: event.target.value })
              }
            >
              {config.settlementOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            取消
          </button>
          <button
            disabled={saving}
            className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存订单"}
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
      <span className="[&_input]:h-8 [&_input]:w-full [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none [&_input:focus]:border-[#1f65a7] [&_select]:h-8 [&_select]:w-full [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none [&_select:focus]:border-[#1f65a7] dark:[&_input]:border-slate-700 dark:[&_input]:bg-[#0d1423] dark:[&_input]:text-slate-100 dark:[&_select]:border-slate-700 dark:[&_select]:bg-[#0d1423] dark:[&_select]:text-slate-100">
        {children}
      </span>
    </label>
  );
}
