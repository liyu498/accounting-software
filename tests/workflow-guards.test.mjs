import assert from "node:assert/strict";
import test from "node:test";

const companyValidationModule = await import(
  "../src/lib/companyValidation.js"
).catch(() => null);
const taxConfirmationModule = await import(
  "../src/lib/taxConfirmation.js"
).catch(() => null);
const browserPeriodModule = await import(
  "../src/lib/browserPreviewPeriods.js"
).catch(() => null);
const browserInvoiceModule = await import(
  "../src/lib/browserPreviewInvoices.js"
).catch(() => null);
const workspaceSelectionModule = await import(
  "../src/lib/workspaceSelection.js"
).catch(() => null);
const invoiceRecordModule = await import(
  "../src/lib/invoiceRecord.js"
).catch(() => null);
const dashboardScopeModule = await import(
  "../src/lib/dashboardDataScope.js"
).catch(() => null);
const browserVoucherModule = await import(
  "../src/lib/browserPreviewVouchers.js"
).catch(() => null);
const browserAuxiliaryModule = await import(
  "../src/lib/browserPreviewAuxiliary.js"
).catch(() => null);
const browserBusinessTagModule = await import(
  "../src/lib/browserPreviewBusinessTags.js"
).catch(() => null);
const automationJobModule = await import(
  "../src/lib/automationJob.js"
).catch(() => null);
const voucherListFilterModule = await import(
  "../src/lib/voucherListFilters.js"
).catch(() => null);
const voucherAttachmentModule = await import(
  "../src/lib/voucherAttachmentWorkflow.js"
).catch(() => null);
const voucherPrintModule = await import(
  "../src/lib/voucherPrint.js"
).catch(() => null);
const agencyCompanyProgressModule = await import(
  "../src/lib/agencyCompanyProgress.js"
).catch(() => null);
const browserPreviewReportsModule = await import(
  "../src/lib/browserPreviewReports.js"
).catch(() => null);
const browserVoucherImportModule = await import(
  "../src/lib/browserVoucherImport.js"
).catch(() => null);
const browserInitialBalanceWorkflowModule = await import(
  "../src/lib/browserInitialBalanceWorkflow.js"
).catch(() => null);
const voucherSourceWorkflowModule = await import(
  "../src/lib/voucherSourceWorkflow.js"
).catch(() => null);
const settlementExecutionWorkflowModule = await import(
  "../src/lib/settlementExecutionWorkflow.js"
).catch(() => null);
const aiVoucherSuggestionWorkflowModule = await import(
  "../src/lib/aiVoucherSuggestionWorkflow.js"
).catch(() => null);
const bankVoucherWorkflowModule = await import(
  "../src/lib/bankVoucherWorkflow.js"
).catch(() => null);
const businessVoucherSourceWorkflowModule = await import(
  "../src/lib/businessVoucherSourceWorkflow.js"
).catch(() => null);

test("company creation rejects missing tax authorization fields", () => {
  assert.notEqual(
    companyValidationModule,
    null,
    "company creation validator is missing",
  );

  const validate = companyValidationModule.validateCompanyCreation;
  const baseDraft = {
    name: "测试企业",
    taxId: "91320115MA1AUDIT01",
    province: "江苏省",
    city: "南京市",
    district: "玄武区",
    taxLoginPerson: "法人",
    taxLoginMethod: "电子税务局授权",
  };

  assert.equal(validate({ ...baseDraft, province: "" }), "请选择完整的省、市、区县");
  assert.equal(validate({ ...baseDraft, city: "" }), "请选择完整的省、市、区县");
  assert.equal(validate({ ...baseDraft, district: "" }), "请选择完整的省、市、区县");
  assert.equal(
    validate({ ...baseDraft, city: "深圳市", district: "南山区" }),
    "省、市、区县组合不正确，请重新选择",
  );
  assert.equal(
    validate({ ...baseDraft, district: "南山区" }),
    "省、市、区县组合不正确，请重新选择",
  );
  assert.equal(validate({ ...baseDraft, taxLoginPerson: "" }), "请选择税务授权人员和授权方式");
  assert.equal(validate({ ...baseDraft, taxLoginMethod: "" }), "请选择税务授权人员和授权方式");
  assert.equal(validate(baseDraft), null);
});

test("tax confirmation stops when the reviewer cancels", () => {
  assert.notEqual(
    taxConfirmationModule,
    null,
    "tax confirmation guard is missing",
  );

  let prompt = "";
  const confirmed = taxConfirmationModule.confirmTaxDeclarationReview(
    { formName: "增值税及附加申报表" },
    (message) => {
      prompt = message;
      return false;
    },
  );

  assert.equal(confirmed, false);
  assert.match(prompt, /增值税及附加申报表/);
  assert.match(prompt, /不会向电子税务局提交申报/);
});

test("tax confirmation continues after explicit reviewer approval", () => {
  assert.notEqual(
    taxConfirmationModule,
    null,
    "tax confirmation guard is missing",
  );

  assert.equal(
    taxConfirmationModule.confirmTaxDeclarationReview(
      { formName: "企业所得税申报表" },
      () => true,
    ),
    true,
  );
});

test("browser preview creates a complete accounting year for a new company", () => {
  assert.notEqual(
    browserPeriodModule,
    null,
    "browser preview period manager is missing",
  );

  const periods = browserPeriodModule.ensureBrowserPreviewPeriods({
    company: { id: "company-1", enable_year: 2026, enable_month: 10 },
    periods: [
      {
        id: "other-period",
        company_id: "company-2",
        period_year: 2026,
        period_month: 1,
      },
    ],
    now: new Date("2026-10-16T00:00:00Z"),
  });

  const companyPeriods = periods.filter(
    (period) => period.company_id === "company-1",
  );
  assert.equal(companyPeriods.length, 12);
  assert.equal(companyPeriods[0].period_month, 1);
  assert.equal(companyPeriods[1].end_date, "2026-02-28");
  assert.equal(companyPeriods[11].period_month, 12);
  assert.equal(periods.some((period) => period.id === "other-period"), true);
});

test("browser preview rejects duplicate accounting periods", () => {
  assert.notEqual(
    browserPeriodModule,
    null,
    "browser preview period manager is missing",
  );

  assert.throws(
    () =>
      browserPeriodModule.createBrowserPreviewPeriod({
        companyId: "company-1",
        year: 2026,
        month: 10,
        periods: [
          {
            id: "existing",
            company_id: "company-1",
            period_year: 2026,
            period_month: 10,
          },
        ],
        now: new Date("2026-10-16T00:00:00Z"),
      }),
    /会计期间 2026-10 已存在/,
  );
});

test("browser preview closes and reopens an accounting period", () => {
  assert.notEqual(
    browserPeriodModule,
    null,
    "browser preview period manager is missing",
  );

  const period = browserPeriodModule.createBrowserPreviewPeriod({
    companyId: "company-1",
    year: 2026,
    month: 12,
    periods: [],
    now: new Date("2026-12-01T00:00:00Z"),
  });
  const closed = browserPeriodModule.closeBrowserPreviewPeriod({
    periodId: period.id,
    periods: [period],
    closedBy: "admin",
    now: new Date("2026-12-31T10:00:00Z"),
  });

  assert.equal(closed.period.status, "closed");
  assert.equal(closed.period.closed_by, "admin");
  assert.equal(closed.period.closed_at, "2026-12-31T10:00:00.000Z");
  assert.equal(closed.periods[0].status, "closed");

  const reopened = browserPeriodModule.reopenBrowserPreviewPeriod({
    periodId: period.id,
    periods: closed.periods,
    now: new Date("2027-01-02T08:00:00Z"),
  });

  assert.equal(reopened.period.status, "open");
  assert.equal(reopened.period.closed_by, null);
  assert.equal(reopened.period.closed_at, null);
  assert.equal(reopened.period.updated_at, "2027-01-02T08:00:00.000Z");
});

test("browser preview rejects missing or invalid period transitions", () => {
  const period = browserPeriodModule.createBrowserPreviewPeriod({
    companyId: "company-1",
    year: 2026,
    month: 11,
    periods: [],
  });

  assert.throws(
    () =>
      browserPeriodModule.closeBrowserPreviewPeriod({
        periodId: "missing",
        periods: [period],
      }),
    /未找到需要结账的会计期间/,
  );
  assert.throws(
    () =>
      browserPeriodModule.reopenBrowserPreviewPeriod({
        periodId: period.id,
        periods: [period],
      }),
    /尚未结账/,
  );
});

test("browser preview selects the latest open accounting period", () => {
  const periods = [
    { id: "jan", company_id: "company-1", period_year: 2026, period_month: 1, status: "open" },
    { id: "dec", company_id: "company-1", period_year: 2026, period_month: 12, status: "closed" },
    { id: "nov", company_id: "company-1", period_year: 2026, period_month: 11, status: "open" },
    { id: "other", company_id: "company-2", period_year: 2027, period_month: 1, status: "open" },
  ];

  assert.equal(
    browserPeriodModule.findLatestOpenBrowserPreviewPeriod(periods, "company-1")?.id,
    "nov",
  );
  assert.equal(
    browserPeriodModule.findLatestOpenBrowserPreviewPeriod(periods, "missing"),
    undefined,
  );
});

test("browser preview creates and filters a scoped invoice", () => {
  assert.notEqual(
    browserInvoiceModule,
    null,
    "browser preview invoice manager is missing",
  );

  const invoice = browserInvoiceModule.createBrowserPreviewInvoice({
    input: {
      company_id: "company-1",
      period_id: "period-1",
      invoice_type: "input",
      invoice_no: "INV-001",
      invoice_date: "2026-12-01",
      amount: 1000,
      tax_amount: 130,
    },
    invoices: [],
    now: new Date("2026-12-01T08:00:00Z"),
  });

  assert.equal(invoice.total_amount, 1130);
  assert.equal(invoice.status, "pending");
  assert.deepEqual(
    browserInvoiceModule.filterBrowserPreviewInvoices([invoice], {
      companyId: "company-1",
      periodId: "period-1",
      invoiceType: "input",
    }),
    [invoice],
  );
  assert.equal(
    browserInvoiceModule.filterBrowserPreviewInvoices([invoice], {
      companyId: "company-2",
    }).length,
    0,
  );
});

test("browser preview invoice update recalculates total amount", () => {
  assert.notEqual(
    browserInvoiceModule,
    null,
    "browser preview invoice manager is missing",
  );

  const existing = {
    id: "invoice-1",
    company_id: "company-1",
    period_id: "period-1",
    invoice_type: "input",
    invoice_no: "INV-001",
    invoice_date: "2026-12-01",
    amount: 1000,
    tax_amount: 130,
    total_amount: 1130,
    status: "pending",
    created_at: "2026-12-01T08:00:00.000Z",
    updated_at: "2026-12-01T08:00:00.000Z",
  };
  const result = browserInvoiceModule.updateBrowserPreviewInvoice({
    id: "invoice-1",
    input: { company_id: "company-1", amount: 2000, tax_amount: 260 },
    invoices: [existing],
    now: new Date("2026-12-02T08:00:00Z"),
  });

  assert.equal(result.invoice.total_amount, 2260);
  assert.equal(result.invoice.company_id, "company-1");
  assert.equal(result.invoices[0].updated_at, "2026-12-02T08:00:00.000Z");
});

test("browser preview invoice voucher linking matches desktop integrity rules", () => {
  assert.notEqual(browserInvoiceModule, null, "browser invoice helpers are missing");
  const invoice = {
    id: "invoice-1",
    company_id: "company-1",
    period_id: "period-1",
    status: "verified",
    voucher_id: null,
    invoice_no: "INV-001",
  };
  const voucher = {
    id: "voucher-1",
    company_id: "company-1",
    period_id: "period-1",
    status: "draft",
  };

  const linked = browserInvoiceModule.matchBrowserPreviewInvoiceToVoucher({
    id: invoice.id,
    voucherId: voucher.id,
    companyId: invoice.company_id,
    voucher,
    invoices: [invoice],
    now: new Date("2026-05-31T12:00:00Z"),
  });
  assert.equal(linked.invoice.status, "matched");
  assert.equal(linked.invoice.voucher_id, voucher.id);
  assert.throws(
    () => browserInvoiceModule.matchBrowserPreviewInvoiceToVoucher({
      id: invoice.id,
      voucherId: voucher.id,
      companyId: invoice.company_id,
      voucher,
      invoices: linked.invoices,
    }),
    /已复核且尚未关联/,
  );
  assert.throws(
    () => browserInvoiceModule.matchBrowserPreviewInvoiceToVoucher({
      id: invoice.id,
      voucherId: "voucher-2",
      companyId: invoice.company_id,
      voucher: { ...voucher, id: "voucher-2", period_id: "period-2" },
      invoices: [invoice],
    }),
    /同一账期/,
  );
});

test("workspace selection persists company and period across reloads", () => {
  assert.notEqual(
    workspaceSelectionModule,
    null,
    "workspace selection persistence is missing",
  );

  const storage = createMemoryStorage();
  workspaceSelectionModule.saveSelectedCompanyId("company-1", storage);
  workspaceSelectionModule.saveSelectedPeriodId("period-12", storage);

  assert.deepEqual(workspaceSelectionModule.loadWorkspaceSelection(storage), {
    companyId: "company-1",
    periodId: "period-12",
  });
});

test("workspace selection safely ignores corrupt stored values", () => {
  assert.notEqual(
    workspaceSelectionModule,
    null,
    "workspace selection persistence is missing",
  );

  const storage = createMemoryStorage();
  storage.setItem(workspaceSelectionModule.WORKSPACE_SELECTION_KEY, "not-json");

  assert.deepEqual(workspaceSelectionModule.loadWorkspaceSelection(storage), {
    companyId: null,
    periodId: null,
  });
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("invoice records are normalized for frontend consumers", () => {
  assert.notEqual(invoiceRecordModule, null, "invoice record normalizer is missing");

  assert.deepEqual(
    invoiceRecordModule.normalizeInvoiceRecord({
      id: "invoice-1",
      company_id: "company-1",
      period_id: "period-12",
      invoice_type: "input",
      invoice_no: "INV-001",
      invoice_code: null,
      invoice_date: "2026-12-01",
      amount: 1000,
      tax_amount: 130,
      total_amount: 1130,
      tax_rate: 0.13,
      seller_name: "审计供应商",
      seller_tax_id: null,
      buyer_name: "功能审计测试企业",
      buyer_tax_id: null,
      status: "pending",
      voucher_id: null,
      remarks: null,
      created_at: "2026-12-01T08:00:00.000Z",
      updated_at: "2026-12-01T08:00:00.000Z",
    }),
    {
      id: "invoice-1",
      companyId: "company-1",
      periodId: "period-12",
      invoiceType: "input",
      invoiceNo: "INV-001",
      invoiceCode: null,
      invoiceDate: "2026-12-01",
      amount: 1000,
      taxAmount: 130,
      totalAmount: 1130,
      taxRate: 0.13,
      sellerName: "审计供应商",
      sellerTaxId: null,
      buyerName: "功能审计测试企业",
      buyerTaxId: null,
      status: "pending",
      voucherId: null,
      remarks: null,
      createdAt: "2026-12-01T08:00:00.000Z",
      updatedAt: "2026-12-01T08:00:00.000Z",
    },
  );
});

test("dashboard live data scope works in browser and desktop runtimes", () => {
  assert.notEqual(dashboardScopeModule, null, "dashboard data scope helper is missing");

  assert.equal(
    dashboardScopeModule.hasDashboardDataScope({
      companyId: "company-1",
      periodId: "period-12",
    }),
    true,
  );
  assert.equal(
    dashboardScopeModule.hasDashboardDataScope({
      companyId: "company-1",
      periodId: null,
    }),
    false,
  );
});

test("browser preview creates a balanced voucher with scoped entries", () => {
  assert.notEqual(browserVoucherModule, null, "browser voucher manager is missing");

  const voucher = browserVoucherModule.createBrowserPreviewVoucher({
    input: {
      company_id: "company-1",
      period_id: "period-12",
      voucher_word_id: "word-ji",
      voucher_date: "2026-12-31",
      voucher_number: "记-0001",
      summary: "采购办公用品",
      entries: [
        { account_code: "6602", account_name: "管理费用", direction: "debit", amount: 1000 },
        { account_code: "1002", account_name: "银行存款", direction: "credit", amount: 1000 },
      ],
    },
    vouchers: [],
    now: new Date("2026-12-31T08:00:00Z"),
  });

  assert.equal(voucher.status, "draft");
  assert.equal(voucher.total_debit, 1000);
  assert.equal(voucher.total_credit, 1000);
  assert.equal(voucher.entries.length, 2);
  assert.equal(voucher.entries[0].voucher_id, voucher.id);
});

test("browser preview preserves extended voucher entry dimensions", () => {
  assert.notEqual(browserVoucherModule, null, "browser voucher manager is missing");

  const voucher = browserVoucherModule.createBrowserPreviewVoucher({
    input: {
      company_id: "company-1",
      period_id: "period-12",
      voucher_word_id: "word-ji",
      voucher_date: "2026-12-31",
      entries: [
        {
          account_code: "1405",
          account_name: "库存商品",
          direction: "debit",
          amount: 1400,
          auxiliary_type: "customer",
          auxiliary_id: "customer-1",
          auxiliary_items: [
            {
              auxiliary_category_id: "customer",
              auxiliary_item_id: "customer-1",
            },
            {
              auxiliary_category_id: "project",
              auxiliary_item_id: "project-1",
            },
          ],
          doc_number: "PO-2026-001",
          quantity: 10,
          unit_price: 140,
          unit: "件",
          currency_id: "currency-usd",
          exchange_rate: 7.1,
        },
        {
          account_code: "1002",
          account_name: "银行存款",
          direction: "credit",
          amount: 1400,
        },
      ],
    },
    vouchers: [],
    now: new Date("2026-12-31T08:00:00Z"),
  });

  assert.deepEqual(
    {
      auxiliary_type: voucher.entries[0].auxiliary_type,
      auxiliary_id: voucher.entries[0].auxiliary_id,
      doc_number: voucher.entries[0].doc_number,
      quantity: voucher.entries[0].quantity,
      unit_price: voucher.entries[0].unit_price,
      unit: voucher.entries[0].unit,
      currency_id: voucher.entries[0].currency_id,
      exchange_rate: voucher.entries[0].exchange_rate,
      auxiliary_items: voucher.entries[0].auxiliary_items,
    },
    {
      auxiliary_type: "customer",
      auxiliary_id: "customer-1",
      doc_number: "PO-2026-001",
      quantity: 10,
      unit_price: 140,
      unit: "件",
      currency_id: "currency-usd",
      exchange_rate: 7.1,
      auxiliary_items: [
        {
          auxiliary_category_id: "customer",
          auxiliary_item_id: "customer-1",
        },
        {
          auxiliary_category_id: "project",
          auxiliary_item_id: "project-1",
        },
      ],
    },
  );
});

test("browser preview exposes scoped multi-dimensional auxiliary setup", () => {
  assert.notEqual(
    browserAuxiliaryModule,
    null,
    "browser auxiliary preview is missing",
  );

  const categories =
    browserAuxiliaryModule.browserPreviewAuxiliaryCategories("company-1");
  const otherCategories =
    browserAuxiliaryModule.browserPreviewAuxiliaryCategories("company-2");
  const setup = browserAuxiliaryModule.browserPreviewAccountAuxiliarySetup(
    "company-1",
    "1122",
  );
  const items =
    browserAuxiliaryModule.browserPreviewAuxiliaryItems("company-1");

  assert.ok(categories.length >= 4);
  assert.ok(categories.every((category) => category.company_id === "company-1"));
  assert.notEqual(categories[0].id, otherCategories[0].id);
  assert.deepEqual(
    setup.categories.map((category) => ({
      name: category.category_name,
      required: category.is_required,
    })),
    [
      { name: "客户", required: 1 },
      { name: "项目", required: 0 },
    ],
  );
  assert.ok(
    items.some(
      (item) =>
        item.category_id === setup.categories[0].category_id &&
        item.is_enabled === 1,
    ),
  );
  assert.equal(
    browserAuxiliaryModule.browserPreviewAccountAuxiliarySetup(
      "company-1",
      "1001",
    ),
    null,
  );
});

test("browser preview preserves voucher source references across edits", () => {
  const voucher = browserVoucherModule.createBrowserPreviewVoucher({
    input: {
      company_id: "company-1",
      period_id: "period-12",
      voucher_word_id: "word-ji",
      voucher_date: "2026-12-31",
      reference_number: "进项发票-INV-001",
      entries: [
        { account_code: "6602", account_name: "管理费用", direction: "debit", amount: 100 },
        { account_code: "1002", account_name: "银行存款", direction: "credit", amount: 100 },
      ],
    },
    vouchers: [],
  });
  assert.equal(voucher.reference_number, "进项发票-INV-001");

  const updated = browserVoucherModule.updateBrowserPreviewVoucher({
    input: { id: voucher.id, reference_number: "银行流水-BANK-002" },
    companyId: "company-1",
    vouchers: [voucher],
  });
  assert.equal(updated.voucher.reference_number, "银行流水-BANK-002");
});

test("browser preview rejects an unbalanced voucher", () => {
  assert.notEqual(browserVoucherModule, null, "browser voucher manager is missing");

  assert.throws(
    () => browserVoucherModule.createBrowserPreviewVoucher({
      input: {
        company_id: "company-1",
        period_id: "period-12",
        voucher_word_id: "word-ji",
        voucher_date: "2026-12-31",
        entries: [
          { account_code: "6602", account_name: "管理费用", direction: "debit", amount: 1000 },
          { account_code: "1002", account_name: "银行存款", direction: "credit", amount: 900 },
        ],
      },
      vouchers: [],
    }),
    /借贷金额不平衡/,
  );
});

test("browser preview voucher query stays inside company and period", () => {
  assert.notEqual(browserVoucherModule, null, "browser voucher manager is missing");

  const vouchers = [
    { id: "v1", company_id: "company-1", period_id: "period-12", is_deleted: 0, voucher_date: "2026-12-31", sequence_num: 1 },
    { id: "v2", company_id: "company-1", period_id: "period-11", is_deleted: 0, voucher_date: "2026-11-30", sequence_num: 1 },
    { id: "v3", company_id: "company-2", period_id: "period-12", is_deleted: 0, voucher_date: "2026-12-31", sequence_num: 1 },
  ];
  const result = browserVoucherModule.queryBrowserPreviewVouchers(vouchers, {
    company_id: "company-1",
    period_id: "period-12",
    page: 1,
    page_size: 20,
  });

  assert.equal(result.total, 1);
  assert.deepEqual(result.vouchers.map((voucher) => voucher.id), ["v1"]);
});

test("voucher list advanced filters cover dates, accounts, tags, and attachments", () => {
  assert.notEqual(voucherListFilterModule, null, "voucher list filter helper is missing");
  const vouchers = [
    {
      id: "voucher-1",
      voucher_number: "记-001",
      voucher_date: "2026-09-20",
      summary: "采购办公用品",
      created_by: "张三",
      approved_by: null,
      status: "draft",
      attachment_count: 2,
      total_debit: 100,
      total_credit: 100,
      entries: [
        { account_code: "6602", account_name: "管理费用", summary: "办公费" },
        { account_code: "1002", account_name: "银行存款", summary: null },
      ],
    },
    {
      id: "voucher-2",
      voucher_number: "记-002",
      voucher_date: "2026-10-01",
      summary: "计提工资",
      created_by: "李四",
      approved_by: "王会计",
      status: "approved",
      attachment_count: 0,
      total_debit: 200,
      total_credit: 200,
      entries: [
        { account_code: "660201", account_name: "工资", summary: "九月工资" },
        { account_code: "2211", account_name: "应付职工薪酬", summary: null },
      ],
    },
  ];
  const tags = { "voucher-1": ["待复核"], "voucher-2": ["工资"] };

  assert.deepEqual(
    voucherListFilterModule.filterVoucherList(vouchers, {
      tab: "all",
      keyword: "银行存款",
      startDate: "",
      endDate: "",
      accountKeyword: "",
      tagName: "",
      attachmentFilter: "all",
    }, tags).map((voucher) => voucher.id),
    ["voucher-1"],
  );
  assert.deepEqual(
    voucherListFilterModule.filterVoucherList(vouchers, {
      tab: "approved",
      keyword: "",
      startDate: "2026-09-25",
      endDate: "2026-10-31",
      accountKeyword: "660201 工资",
      tagName: "工资",
      attachmentFilter: "without",
    }, tags).map((voucher) => voucher.id),
    ["voucher-2"],
  );
});

test("voucher list custom sorting is stable and does not mutate source order", () => {
  const vouchers = [
    { id: "v-2", voucher_number: "记-10", voucher_date: "2026-05-02", total_debit: 100, created_at: "2026-05-02T10:00:00Z" },
    { id: "v-1", voucher_number: "记-2", voucher_date: "2026-05-02", total_debit: 500, created_at: "2026-05-02T09:00:00Z" },
    { id: "v-3", voucher_number: "记-1", voucher_date: "2026-05-03", total_debit: 300, created_at: "2026-05-03T09:00:00Z" },
  ];

  assert.deepEqual(voucherListFilterModule.sortVoucherList(vouchers, "number-asc").map((voucher) => voucher.id), ["v-3", "v-1", "v-2"]);
  assert.deepEqual(voucherListFilterModule.sortVoucherList(vouchers, "amount-desc").map((voucher) => voucher.id), ["v-1", "v-3", "v-2"]);
  assert.deepEqual(vouchers.map((voucher) => voucher.id), ["v-2", "v-1", "v-3"]);
});

test("browser preview soft deletion and restoration share one voucher collection", () => {
  assert.notEqual(browserVoucherModule, null, "browser voucher manager is missing");
  const active = {
    id: "voucher-1",
    company_id: "company-1",
    status: "draft",
    is_deleted: 0,
    deleted_at: null,
  };

  const deleted = browserVoucherModule.softDeleteBrowserPreviewVoucher({
    id: active.id,
    companyId: active.company_id,
    vouchers: [active],
    now: new Date("2026-12-31T09:00:00Z"),
  });
  assert.equal(deleted.voucher.is_deleted, 1);
  assert.deepEqual(
    browserVoucherModule
      .getDeletedBrowserPreviewVouchers(deleted.vouchers, "company-1")
      .map((voucher) => voucher.id),
    ["voucher-1"],
  );

  const restored = browserVoucherModule.restoreBrowserPreviewVoucher({
    id: active.id,
    companyId: active.company_id,
    vouchers: deleted.vouchers,
  });
  assert.equal(restored.voucher.is_deleted, 0);
  assert.equal(restored.voucher.deleted_at, null);
});

test("browser preview voucher copies retain scoped business tags", () => {
  assert.notEqual(browserBusinessTagModule, null, "browser business tag manager is missing");
  const values = new Map();
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };

  try {
    browserBusinessTagModule.replaceBrowserPreviewVoucherTags(
      "source-voucher",
      "company-1",
      ["tag-review", "tag-project"],
    );
    assert.deepEqual(
      browserBusinessTagModule.copyBrowserPreviewVoucherTags(
        "source-voucher",
        "copied-voucher",
        "company-1",
      ),
      ["tag-review", "tag-project"],
    );
    assert.deepEqual(
      browserBusinessTagModule.loadBrowserPreviewVoucherTagIds(
        "copied-voucher",
        "company-1",
      ),
      ["tag-review", "tag-project"],
    );
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("browser preview reversal closes the source voucher and records the operator", () => {
  const source = {
    id: "voucher-approved",
    company_id: "company-1",
    period_id: "period-1",
    voucher_word_id: "word-1",
    voucher_number: "记-0001",
    sequence_num: 1,
    voucher_date: "2026-10-21",
    summary: "采购材料",
    reference_number: "INV-001",
    attachment_count: 1,
    status: "approved",
    total_debit: 100,
    total_credit: 100,
    version: 1,
    created_by: "张三",
    created_at: "2026-10-21T08:00:00.000Z",
    approved_by: "李四",
    approved_at: "2026-10-21T08:30:00.000Z",
    reversed_by: null,
    reversed_at: null,
    reversal_of_id: null,
    is_system: 0,
    is_deleted: 0,
    deleted_at: null,
    entries: [
      {
        id: "entry-1",
        voucher_id: "voucher-approved",
        line_num: 1,
        account_code: "1403",
        account_name: "原材料",
        direction: "debit",
        amount: 100,
        summary: null,
        auxiliary_items: [
          {
            auxiliary_category_id: "supplier",
            auxiliary_item_id: "supplier-1",
          },
          {
            auxiliary_category_id: "project",
            auxiliary_item_id: "project-1",
          },
        ],
      },
      { id: "entry-2", voucher_id: "voucher-approved", line_num: 2, account_code: "1002", account_name: "银行存款", direction: "credit", amount: 100, summary: null },
    ],
  };

  const result = browserVoucherModule.reverseBrowserPreviewVoucher({
    id: source.id,
    companyId: source.company_id,
    reversedBy: "王会计",
    vouchers: [source],
    now: new Date("2026-10-21T09:00:00.000Z"),
  });

  assert.equal(result.source.status, "reversed");
  assert.equal(result.source.reversed_by, "王会计");
  assert.equal(result.source.reversed_at, "2026-10-21T09:00:00.000Z");
  assert.equal(result.reversal.status, "approved");
  assert.equal(result.reversal.approved_by, "王会计");
  assert.equal(result.reversal.reversal_of_id, source.id);
  assert.equal(result.reversal.reference_number, "INV-001");
  assert.equal(result.reversal.entries[0].direction, "credit");
  assert.deepEqual(result.reversal.entries[0].auxiliary_items, [
    {
      auxiliary_category_id: "supplier",
      auxiliary_item_id: "supplier-1",
    },
    {
      auxiliary_category_id: "project",
      auxiliary_item_id: "project-1",
    },
  ]);
  assert.equal(result.reversal.entries[1].direction, "debit");
  assert.equal(result.vouchers.length, 2);
  assert.throws(
    () => browserVoucherModule.reverseBrowserPreviewVoucher({
      id: source.id,
      companyId: source.company_id,
      reversedBy: "王会计",
      vouchers: [{ ...source, status: "draft" }],
    }),
    /草稿凭证无需红冲/,
  );
});

test("voucher attachment workflow keeps links scoped and copies metadata", () => {
  assert.notEqual(voucherAttachmentModule, null, "voucher attachment workflow is missing");
  const records = [
    {
      id: "attachment-1",
      companyId: "company-1",
      period: "2026-12",
      sourceModule: "会计凭证",
      fileName: "invoice.pdf",
      fileSize: 2048,
      fileFormat: "PDF",
      checksum: "checksum-1",
      relatedDocument: "voucher-1",
      status: "已关联",
      operator: "admin",
      createdAt: "2026-12-31 09:00:00",
    },
    { id: "attachment-2", relatedDocument: "voucher-2" },
  ];

  assert.deepEqual(
    voucherAttachmentModule
      .filterVoucherAttachments(records, "voucher-1")
      .map((record) => record.id),
    ["attachment-1"],
  );

  const copies = voucherAttachmentModule.cloneVoucherAttachmentAssociations({
    records,
    sourceVoucherId: "voucher-1",
    targetVoucherId: "voucher-copy",
    createId: () => "attachment-copy",
    createdAt: "2026-12-31 10:00:00",
  });
  assert.equal(copies.length, 1);
  assert.deepEqual(copies[0], {
    ...records[0],
    id: "attachment-copy",
    relatedDocument: "voucher-copy",
    status: "已关联",
    createdAt: "2026-12-31 10:00:00",
  });
});

test("voucher print renders an escaped accounting voucher with audit signatures", () => {
  assert.notEqual(voucherPrintModule, null, "voucher print builder is missing");

  const html = voucherPrintModule.buildVoucherPrintHtml({
    companyName: "测试<公司>",
    periodLabel: "2026-10",
    generatedAt: "2026-10-21 10:30",
    voucher: {
      voucher_number: "记-0001",
      voucher_date: "2026-10-21",
      summary: "采购<script>alert(1)</script>",
      reference_number: "INV-001",
      attachment_count: 2,
      status: "approved",
      total_debit: 113,
      total_credit: 113,
      created_by: "张三",
      approved_by: "李四",
    },
    entries: [
      {
        line_num: 1,
        summary: "采购材料",
        account_code: "1403",
        account_name: "原材料",
        direction: "debit",
        amount: 113,
        auxiliary_type: "供应商",
        doc_number: "FP-001",
      },
      {
        line_num: 2,
        summary: "银行付款",
        account_code: "1002",
        account_name: "银行存款",
        direction: "credit",
        amount: 113,
        auxiliary_type: null,
        doc_number: null,
      },
    ],
  });

  assert.match(html, /记账凭证/);
  assert.match(html, /测试&lt;公司&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /壹佰壹拾叁元整/);
  assert.match(html, /借方金额/);
  assert.match(html, /贷方金额/);
  assert.match(html, /制单：张三/);
  assert.match(html, /审核：李四/);
  assert.match(html, /@page\{size:A4 landscape/);
});

test("agency customer progress aggregates real period operations without cross-company leakage", () => {
  assert.notEqual(
    agencyCompanyProgressModule,
    null,
    "agency customer progress aggregator is missing",
  );

  const rows = agencyCompanyProgressModule.buildAgencyCompanyProgressRows({
    companies: [
      { id: "company-a", name: "甲公司", enable_year: 2026, enable_month: 5 },
      { id: "company-b", name: "乙公司", enable_year: 2026, enable_month: 4 },
    ],
    periods: [
      { id: "period-a-05", company_id: "company-a", period_year: 2026, period_month: 5, status: "open" },
      { id: "period-b-04", company_id: "company-b", period_year: 2026, period_month: 4, status: "open" },
    ],
    invoices: [
      { id: "invoice-a-1", company_id: "company-a", period_id: "period-a-05", invoice_date: "2026-05-06", status: "matched", updated_at: "2026-05-08 09:00:00" },
      { id: "invoice-a-2", company_id: "company-a", period_id: "period-a-05", invoice_date: "2026-05-09", status: "pending", updated_at: "2026-05-09 09:00:00" },
      { id: "invoice-b-1", company_id: "company-b", period_id: "period-b-04", invoice_date: "2026-04-01", status: "abnormal", updated_at: "2026-04-02 09:00:00" },
    ],
    vouchers: [
      { id: "voucher-a-1", company_id: "company-a", period_id: "period-a-05", voucher_date: "2026-05-10", status: "approved", is_deleted: 0, updated_at: "2026-05-10 09:00:00" },
      { id: "voucher-a-2", company_id: "company-a", period_id: "period-a-05", voucher_date: "2026-05-11", status: "draft", is_deleted: 0, updated_at: "2026-05-11 09:00:00" },
      { id: "voucher-a-deleted", company_id: "company-a", period_id: "period-a-05", voucher_date: "2026-05-12", status: "approved", is_deleted: 1, updated_at: "2026-05-12 09:00:00" },
    ],
    taxTasks: [
      { id: "tax-a-1", company_id: "company-a", period: "2026-05", collect_status: "collected", validation_status: "passed", declaration_status: "confirmed", payment_status: "paid", risk_count: 0, updated_at: "2026-05-13 09:00:00" },
      { id: "tax-a-2", company_id: "company-a", period: "2026-05", collect_status: "pending", validation_status: "blocked", declaration_status: "draft", payment_status: "unrecorded", risk_count: 2, updated_at: "2026-05-14 09:00:00" },
    ],
  });

  assert.deepEqual(rows[0], {
    company_id: "company-a",
    period: "2026-05",
    invoice_count: 2,
    invoice_pending_count: 1,
    voucher_count: 2,
    approved_voucher_count: 1,
    tax_task_count: 2,
    collected_tax_task_count: 1,
    declared_tax_task_count: 1,
    paid_tax_task_count: 1,
    risk_count: 2,
    latest_activity_at: "2026-05-14 09:00:00",
  });
  assert.equal(rows[1].company_id, "company-b");
  assert.equal(rows[1].invoice_count, 1);
  assert.equal(rows[1].risk_count, 1);
  assert.equal(rows[1].voucher_count, 0);
});

test("browser preview reports derive balanced period controls from persisted voucher entries", () => {
  assert.notEqual(
    browserPreviewReportsModule,
    null,
    "browser preview report calculator is missing",
  );
  const vouchers = [
    {
      id: "voucher-1",
      period_id: "period-1",
      status: "approved",
      is_deleted: 0,
      entries: [
        { account_code: "1002", account_name: "银行存款", direction: "debit", amount: 100 },
        { account_code: "6001", account_name: "主营业务收入", direction: "credit", amount: 100 },
      ],
    },
    {
      id: "voucher-draft",
      period_id: "period-1",
      status: "draft",
      is_deleted: 0,
      entries: [
        { account_code: "1001", account_name: "库存现金", direction: "debit", amount: 50 },
        { account_code: "2241", account_name: "其他应付款", direction: "credit", amount: 50 },
      ],
    },
    {
      id: "voucher-other-period",
      period_id: "period-2",
      status: "approved",
      is_deleted: 0,
      entries: [],
    },
  ];

  const trial = browserPreviewReportsModule.buildBrowserPreviewTrialBalance(vouchers, "period-1");
  assert.equal(trial.total_period_debit, 100);
  assert.equal(trial.total_period_credit, 100);
  assert.equal(trial.is_balanced, true);
  assert.equal(trial.items.length, 2);

  const balanceSheet = browserPreviewReportsModule.buildBrowserPreviewBalanceSheet(vouchers, "period-1");
  assert.equal(balanceSheet.period_id, "period-1");
  assert.equal(balanceSheet.total_assets, 100);
  assert.equal(balanceSheet.total_liabilities + balanceSheet.total_equity, 100);
  assert.equal(balanceSheet.is_balanced, true);
});

test("browser voucher import parses chronological and standard Excel rows with row-level validation", () => {
  assert.notEqual(
    browserVoucherImportModule,
    null,
    "browser voucher import parser is missing",
  );

  const chronological = browserVoucherImportModule.parseBrowserVoucherSheetRows(
    [
      ["导出说明"],
      ["日期", "凭证号", "摘要", "科目编码", "科目名称", "借方金额", "贷方金额"],
      ["2026-05-06", "记-1", "收到货款", "1002", "银行存款", 100, ""],
      ["", "", "收到货款", "1122", "应收账款", "", 100],
    ],
    "chronological",
  );
  assert.equal(chronological.total_rows, 2);
  assert.equal(chronological.error_count, 0);
  assert.equal(chronological.rows[0].direction, "debit");
  assert.equal(chronological.rows[1].direction, "credit");

  const standard = browserVoucherImportModule.parseBrowserVoucherSheetRows(
    [
      ["日期(YYYY-MM-DD)", "摘要", "科目编码", "方向(debit/credit)", "金额", "分录摘要"],
      ["2026-05-07", "报销差旅费", "6602", "借", 88, "差旅费"],
      ["2026-05-07", "报销差旅费", "1001", "贷方", 0, "库存现金"],
    ],
    "standard",
  );
  assert.equal(standard.total_rows, 2);
  assert.equal(standard.rows[0].direction, "debit");
  assert.match(standard.rows[1].errors.join("；"), /金额为零或负数/);
  assert.equal(standard.error_count, 1);
});

test("browser initial balances can only be finalized when the scoped debit and credit totals balance", () => {
  assert.notEqual(
    browserInitialBalanceWorkflowModule,
    null,
    "browser initial balance finalization workflow is missing",
  );
  const records = [
    { companyId: "company-1", period: "2026-05", accountCode: "1002", openingDebit: 100, openingCredit: 0 },
    { companyId: "company-1", period: "2026-05", accountCode: "2001", openingDebit: 0, openingCredit: 100 },
    { companyId: "company-2", period: "2026-05", accountCode: "1002", openingDebit: 999, openingCredit: 0 },
  ];
  const result = browserInitialBalanceWorkflowModule.buildBrowserInitialBalanceFinalization({
    records,
    companyId: "company-1",
    period: "2026-05",
    finalizedBy: "admin",
    now: new Date("2026-05-31T12:00:00.000Z"),
  });
  assert.deepEqual(result, {
    companyId: "company-1",
    period: "2026-05",
    totalDebit: 100,
    totalCredit: 100,
    finalizedBy: "admin",
    finalizedAt: "2026-05-31T12:00:00.000Z",
  });
  assert.throws(
    () => browserInitialBalanceWorkflowModule.buildBrowserInitialBalanceFinalization({
      records: records.slice(0, 1),
      companyId: "company-1",
      period: "2026-05",
    }),
    /试算不平衡/,
  );
});

test("invoice sources create traceable balanced voucher draft candidates", () => {
  assert.notEqual(
    voucherSourceWorkflowModule,
    null,
    "voucher source workflow is missing",
  );

  const outputInvoice = {
    id: "invoice-output-1",
    invoiceType: "output",
    invoiceNo: "310026000142",
    invoiceDate: "2026-05-06",
    amount: 100,
    taxAmount: 13,
    totalAmount: 113,
    buyerName: "上海客户",
    status: "verified",
  };
  const outputDraft = voucherSourceWorkflowModule.buildInvoiceVoucherPrefill(
    outputInvoice,
  );
  assert.equal(outputDraft.referenceNumber, "310026000142");
  assert.equal(outputDraft.entries.length, 3);
  assert.deepEqual(
    outputDraft.entries.map((entry) => [entry.direction, entry.amount]),
    [
      ["debit", "113"],
      ["credit", "100"],
      ["credit", "13"],
    ],
  );

  const inputDraft = voucherSourceWorkflowModule.buildInvoiceVoucherPrefill({
    ...outputInvoice,
    id: "invoice-input-1",
    invoiceType: "input",
    sellerName: "苏州供应商",
  });
  assert.deepEqual(
    inputDraft.entries.map((entry) => [entry.direction, entry.amount]),
    [
      ["debit", "100"],
      ["debit", "13"],
      ["credit", "113"],
    ],
  );
  assert.equal(
    inputDraft.entries.reduce(
      (total, entry) => total + (entry.direction === "debit" ? 1 : -1) * Number(entry.amount),
      0,
    ),
    0,
  );
});

test("voucher source navigation rejects invalid or completed invoice sources", () => {
  assert.notEqual(
    voucherSourceWorkflowModule,
    null,
    "voucher source workflow is missing",
  );

  const path = voucherSourceWorkflowModule.buildVoucherSourcePath({
    kind: "invoice",
    id: "invoice/output 1",
  });
  assert.equal(path, "/vouchers/new?source=invoice&sourceId=invoice%2Foutput+1");
  assert.deepEqual(
    voucherSourceWorkflowModule.parseVoucherSourceSearch(path.split("?")[1]),
    { kind: "invoice", id: "invoice/output 1" },
  );
  assert.deepEqual(
    voucherSourceWorkflowModule.parseVoucherSourceSearch(
      "source=ai_suggestion&sourceId=job-1",
    ),
    { kind: "ai_suggestion", id: "job-1" },
  );
  assert.deepEqual(
    voucherSourceWorkflowModule.parseVoucherSourceSearch(
      "source=bank_transaction&sourceId=bank-1",
    ),
    { kind: "bank_transaction", id: "bank-1" },
  );
  assert.equal(
    voucherSourceWorkflowModule.parseVoucherSourceSearch("source=unknown&sourceId=1"),
    null,
  );
  assert.equal(
    voucherSourceWorkflowModule.canCreateVoucherFromInvoice({ status: "verified" }),
    true,
  );
  assert.equal(
    voucherSourceWorkflowModule.canCreateVoucherFromInvoice({ status: "matched" }),
    false,
  );
  assert.equal(
    voucherSourceWorkflowModule.canCreateVoucherFromInvoice({ status: "rejected" }),
    false,
  );
});

test("settlement preview derives balanced profit and loss closing entries", () => {
  assert.notEqual(
    settlementExecutionWorkflowModule,
    null,
    "settlement execution workflow is missing",
  );
  const preview = settlementExecutionWorkflowModule.buildSettlementRulePreview({
    rule: {
      id: "rule-profit",
      name: "月末损益结转",
      rule_type: "profit_loss",
      source_formula: null,
      target_account_code: "4103 本年利润",
      summary_template: "结转{期间}损益",
      is_enabled: 1,
    },
    periodLabel: "2026-05",
    accounts: [
      { code: "6001", name: "主营业务收入", account_type: "income", is_detail: 1, is_enabled: 1 },
      { code: "6602", name: "管理费用", account_type: "expense", is_detail: 1, is_enabled: 1 },
      { code: "4103", name: "本年利润", account_type: "equity", is_detail: 1, is_enabled: 1 },
    ],
    vouchers: [
      {
        status: "approved",
        is_deleted: 0,
        is_settlement: 0,
        entries: [
          { account_code: "6001", account_name: "主营业务收入", direction: "credit", amount: 100 },
          { account_code: "6602", account_name: "管理费用", direction: "debit", amount: 40 },
        ],
      },
      {
        status: "draft",
        is_deleted: 0,
        is_settlement: 0,
        entries: [{ account_code: "6001", account_name: "主营业务收入", direction: "credit", amount: 999 }],
      },
      {
        status: "approved",
        is_deleted: 0,
        is_settlement: 1,
        entries: [{ account_code: "6001", account_name: "主营业务收入", direction: "credit", amount: 500 }],
      },
    ],
  });

  assert.equal(preview.summary, "结转2026-05损益");
  assert.deepEqual(
    preview.entries.map(({ accountCode, direction, amount }) => ({ accountCode, direction, amount })),
    [
      { accountCode: "6001", direction: "debit", amount: 100 },
      { accountCode: "6602", direction: "credit", amount: 40 },
      { accountCode: "4103", direction: "credit", amount: 60 },
    ],
  );
  assert.equal(preview.totalDebit, 100);
  assert.equal(preview.totalCredit, 100);
});

test("custom settlement rules require explicit valid source accounts and prevent duplicates", () => {
  const buildPreview = settlementExecutionWorkflowModule.buildSettlementRulePreview;
  const rule = {
    id: "rule-custom",
    name: "自定义结转",
    rule_type: "custom",
    source_formula: "来源科目：660203, 1602",
    target_account_code: "4103",
    summary_template: "自定义结转",
    is_enabled: 1,
  };
  const accounts = [
    { code: "660203", name: "折旧费", account_type: "expense", is_detail: 1, is_enabled: 1 },
    { code: "1602", name: "累计折旧", account_type: "asset", is_detail: 1, is_enabled: 1 },
    { code: "4103", name: "本年利润", account_type: "equity", is_detail: 1, is_enabled: 1 },
  ];

  assert.deepEqual(
    settlementExecutionWorkflowModule.extractSettlementSourceAccountCodes(rule.source_formula),
    ["660203", "1602"],
  );
  assert.throws(
    () => buildPreview({ rule: { ...rule, source_formula: "按资产台账计提" }, accounts, vouchers: [], periodLabel: "2026-05" }),
    /来源科目编码/,
  );
  assert.throws(
    () => buildPreview({ rule, accounts, vouchers: [], periodLabel: "2026-05", existingVouchers: [{ settlement_rule_id: rule.id, status: "draft", is_deleted: 0 }] }),
    /已存在结转凭证/,
  );
});

test("AI recognition tasks cannot be reviewed before recognition completes", () => {
  assert.notEqual(automationJobModule, null, "AI job guard is missing");

  assert.equal(automationJobModule.canReviewAutomationJob({ status: "queued" }), false);
  assert.equal(
    automationJobModule.canReviewAutomationJob({ status: "waiting_confirmation" }),
    true,
  );
});

test("AI job presentation localizes machine codes without inventing confidence", () => {
  assert.notEqual(automationJobModule, null, "AI job presenter is missing");

  const reviewed = {
    status: "completed",
    confidence: null,
    reviewer: "admin",
  };
  assert.equal(automationJobModule.automationJobTypeLabel("invoice_recognition"), "发票识别");
  assert.equal(automationJobModule.automationJobRiskLabel("normal"), "普通");
  assert.equal(automationJobModule.automationJobConfidenceLabel(reviewed), "人工复核");
  assert.equal(
    automationJobModule.automationJobConfidenceLabel({ ...reviewed, status: "queued", reviewer: null }),
    "待识别",
  );
});

test("AI voucher suggestions build a balanced traceable voucher prefill", () => {
  assert.notEqual(
    aiVoucherSuggestionWorkflowModule,
    null,
    "AI voucher suggestion workflow is missing",
  );

  const prefill = aiVoucherSuggestionWorkflowModule.buildAiVoucherSuggestionPrefill({
    job: {
      id: "ai-job-1",
      jobType: "voucher_suggestion",
      period: "2026-05",
      status: "confirmed",
      riskLevel: "normal",
      suggestionNo: "AI-001",
      sourceModule: "进项发票",
      sourceFile: "invoice-001.ofd",
      resultSummary: "采购办公用品",
      debitSubject: "6602",
      creditSubject: "1002",
      suggestionAmount: 1280.5,
      generatedVoucherId: null,
    },
    accounts: [
      { code: "6602", name: "管理费用", is_detail: 1, is_enabled: 1 },
      { code: "1002", name: "银行存款", is_detail: 1, is_enabled: 1 },
    ],
    periodLabel: "2026-05",
  });

  assert.equal(prefill.summary, "采购办公用品");
  assert.equal(prefill.referenceNumber, "AI-001");
  assert.deepEqual(
    prefill.entries.map(({ accountCode, accountName, direction, amount }) => ({
      accountCode,
      accountName,
      direction,
      amount,
    })),
    [
      { accountCode: "6602", accountName: "管理费用", direction: "debit", amount: "1280.5" },
      { accountCode: "1002", accountName: "银行存款", direction: "credit", amount: "1280.5" },
    ],
  );
});

test("AI voucher suggestions reject unsafe, incomplete, cross-period and duplicate drafts", () => {
  assert.notEqual(aiVoucherSuggestionWorkflowModule, null);
  const buildPrefill = aiVoucherSuggestionWorkflowModule.buildAiVoucherSuggestionPrefill;
  const accounts = [
    { code: "6602", name: "管理费用", is_detail: 1, is_enabled: 1 },
    { code: "1002", name: "银行存款", is_detail: 1, is_enabled: 1 },
  ];
  const job = {
    id: "ai-job-1",
    jobType: "voucher_suggestion",
    period: "2026-05",
    status: "confirmed",
    riskLevel: "normal",
    suggestionNo: "AI-001",
    sourceModule: "进项发票",
    resultSummary: "采购办公用品",
    debitSubject: "6602",
    creditSubject: "1002",
    suggestionAmount: 1280.5,
    generatedVoucherId: null,
  };

  assert.throws(
    () => buildPrefill({ job: { ...job, riskLevel: "high" }, accounts, periodLabel: "2026-05" }),
    /高风险/,
  );
  assert.throws(
    () => buildPrefill({ job: { ...job, suggestionAmount: null }, accounts, periodLabel: "2026-05" }),
    /金额/,
  );
  assert.throws(
    () => buildPrefill({ job, accounts, periodLabel: "2026-06" }),
    /账期/,
  );
  assert.throws(
    () => buildPrefill({ job: { ...job, generatedVoucherId: "voucher-1" }, accounts, periodLabel: "2026-05" }),
    /已关联凭证/,
  );
});

test("bank transactions create balanced traceable voucher candidates", () => {
  assert.notEqual(bankVoucherWorkflowModule, null, "bank voucher workflow is missing");
  const accounts = [
    { code: "1002", name: "银行存款", is_detail: 1, is_enabled: 1 },
  ];
  const sourceRecord = {
    id: "bank-1",
    period: "2026-05",
    serialNo: "B-001",
    transactionDate: "2026-05-16",
    counterparty: "杭州客户",
    summary: "收到货款",
    incomeAmount: 2500,
    expenseAmount: 0,
    voucherId: null,
  };
  const income = bankVoucherWorkflowModule.buildBankVoucherPrefill({
    record: sourceRecord,
    accounts,
    periodLabel: "2026-05",
  });
  assert.equal(income.referenceNumber, "B-001");
  assert.deepEqual(
    income.entries.map(({ accountCode, direction, amount }) => ({ accountCode, direction, amount })),
    [
      { accountCode: "1002", direction: "debit", amount: "2500" },
      { accountCode: "", direction: "credit", amount: "2500" },
    ],
  );

  const expense = bankVoucherWorkflowModule.buildBankVoucherPrefill({
    record: { ...sourceRecord, id: "bank-2", incomeAmount: 0, expenseAmount: 880 },
    accounts,
    periodLabel: "2026-05",
  });
  assert.deepEqual(
    expense.entries.map(({ accountCode, direction }) => ({ accountCode, direction })),
    [
      { accountCode: "", direction: "debit" },
      { accountCode: "1002", direction: "credit" },
    ],
  );
});

test("bank voucher candidates reject cross-period, invalid and linked transactions", () => {
  assert.notEqual(bankVoucherWorkflowModule, null);
  const record = {
    id: "bank-1",
    period: "2026-05",
    serialNo: "B-001",
    transactionDate: "2026-05-16",
    incomeAmount: 2500,
    expenseAmount: 0,
    voucherId: null,
  };
  assert.throws(
    () => bankVoucherWorkflowModule.buildBankVoucherPrefill({ record, accounts: [], periodLabel: "2026-06" }),
    /账期/,
  );
  assert.throws(
    () => bankVoucherWorkflowModule.buildBankVoucherPrefill({ record: { ...record, voucherId: "voucher-1" }, accounts: [], periodLabel: "2026-05" }),
    /已关联凭证/,
  );
  assert.throws(
    () => bankVoucherWorkflowModule.buildBankVoucherPrefill({ record: { ...record, expenseAmount: 100 }, accounts: [], periodLabel: "2026-05" }),
    /二选一/,
  );
});

test("business documents, orders and transfers build traceable balanced voucher drafts", () => {
  assert.notEqual(
    businessVoucherSourceWorkflowModule,
    null,
    "business voucher source workflow is missing",
  );
  const build = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill;
  const accounts = [
    { code: "1002", name: "银行存款", is_detail: 1, is_enabled: 1 },
    { code: "1122", name: "应收账款", is_detail: 1, is_enabled: 1 },
    { code: "2202", name: "应付账款", is_detail: 1, is_enabled: 1 },
    { code: "5001", name: "主营业务收入", is_detail: 1, is_enabled: 1 },
    { code: "6602", name: "管理费用", is_detail: 1, is_enabled: 1 },
  ];

  const documentDraft = build({
    kind: "document_record",
    record: {
      id: "doc-1",
      period: "2026-05",
      businessDate: "2026-05-09",
      documentCode: "BX-001",
      businessType: "费用报销",
      partner: "张三",
      amount: 320,
      voucherId: null,
    },
    accounts,
    periodLabel: "2026-05",
  });
  assert.equal(documentDraft.referenceNumber, "BX-001");
  assert.deepEqual(
    documentDraft.entries.map(({ accountCode, direction, amount }) => ({ accountCode, direction, amount })),
    [
      { accountCode: "6602", direction: "debit", amount: "320" },
      { accountCode: "1002", direction: "credit", amount: "320" },
    ],
  );

  const orderDraft = build({
    kind: "business_order",
    record: {
      id: "order-1",
      period: "2026-05",
      orderType: "sales",
      orderNo: "XS-001",
      businessDate: "2026-05-10",
      counterparty: "杭州客户",
      goodsName: "技术服务",
      amount: 5000,
      voucherId: null,
    },
    accounts,
    periodLabel: "2026-05",
  });
  assert.deepEqual(
    orderDraft.entries.map(({ accountCode, direction, amount }) => ({ accountCode, direction, amount })),
    [
      { accountCode: "1122", direction: "debit", amount: "5000" },
      { accountCode: "5001", direction: "credit", amount: "5000" },
    ],
  );

  const transferDraft = build({
    kind: "account_transfer",
    record: {
      id: "transfer-1",
      period: "2026-05",
      transferDate: "2026-05-11",
      fromAccount: "1002 银行存款",
      toAccount: "1122 应收账款",
      amount: 1000,
      fee: 10,
      serialNo: "ZZ-001",
      voucherId: null,
    },
    accounts,
    periodLabel: "2026-05",
  });
  assert.deepEqual(
    transferDraft.entries.map(({ accountCode, direction, amount }) => ({ accountCode, direction, amount })),
    [
      { accountCode: "1122", direction: "debit", amount: "1000" },
      { accountCode: "6602", direction: "debit", amount: "10" },
      { accountCode: "1002", direction: "credit", amount: "1010" },
    ],
  );
});

test("cost carryover builds a traceable draft from its configured subjects", () => {
  const draft = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill({
    kind: "cost_carryover",
    periodLabel: "2026-05",
    accounts: [
      { code: "6401", name: "主营业务成本", is_enabled: 1, is_detail: 1 },
      { code: "1405", name: "库存商品", is_enabled: 1, is_detail: 1 },
    ],
    record: {
      id: "carryover-1",
      period: "2026-05",
      batchNo: "CB-2026-05",
      carryoverDate: "2026-05-31",
      inventoryName: "库存商品",
      debitSubject: "6401 主营业务成本",
      creditSubject: "1405 库存商品",
      costAmount: 18600,
      voucherId: null,
      status: "已核验",
    },
  });

  assert.equal(draft.referenceNumber, "CB-2026-05");
  assert.deepEqual(
    draft.entries.map((entry) => [entry.direction, entry.accountCode, entry.amount]),
    [
      ["debit", "6401", "18600"],
      ["credit", "1405", "18600"],
    ],
  );
});

test("payroll batch builds one balanced period voucher instead of one voucher per employee", () => {
  const draft = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill({
    kind: "payroll_batch",
    periodLabel: "2026-05",
    accounts: [
      { code: "6602", name: "管理费用", is_enabled: 1, is_detail: 1 },
      { code: "2211", name: "应付职工薪酬", is_enabled: 1, is_detail: 1 },
      { code: "2221", name: "应交税费", is_enabled: 1, is_detail: 1 },
    ],
    record: {
      id: "2026-05",
      period: "2026-05",
      status: "待确认",
      voucherId: null,
      records: [
        { baseSalary: 10000, bonus: 1000, taxAmount: 500, socialPersonal: 800, netSalary: 9700 },
        { baseSalary: 8000, bonus: 0, taxAmount: 200, socialPersonal: 600, netSalary: 7200 },
      ],
    },
  });

  assert.equal(draft.referenceNumber, "GZ-2026-05");
  assert.deepEqual(
    draft.entries.map((entry) => [entry.direction, entry.accountCode, entry.amount]),
    [
      ["debit", "6602", "19000"],
      ["credit", "2211", "16900"],
      ["credit", "2221", "2100"],
    ],
  );
});

test("social security batch accrues employer contributions in one period voucher", () => {
  const draft = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill({
    kind: "social_security_batch",
    periodLabel: "2026-05",
    accounts: [
      { code: "6602", name: "管理费用", is_enabled: 1, is_detail: 1 },
      { code: "2211", name: "应付职工薪酬", is_enabled: 1, is_detail: 1 },
    ],
    record: {
      id: "2026-05",
      period: "2026-05",
      status: "待确认",
      voucherId: null,
      records: [
        { companyAmount: 1900, fundAmount: 1200 },
        { companyAmount: 1500, fundAmount: 900 },
      ],
    },
  });

  assert.equal(draft.referenceNumber, "SB-2026-05");
  assert.deepEqual(
    draft.entries.map((entry) => [entry.direction, entry.accountCode, entry.amount]),
    [
      ["debit", "6602", "5500"],
      ["credit", "2211", "5500"],
    ],
  );
});

test("depreciation batch creates one recurring voucher without locking the asset master", () => {
  const draft = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill({
    kind: "depreciation_batch",
    periodLabel: "2026-05",
    accounts: [
      { code: "6602", name: "管理费用", is_enabled: 1, is_detail: 1 },
      { code: "1602", name: "累计折旧", is_enabled: 1, is_detail: 1 },
    ],
    record: {
      id: "company-1:2026-05",
      period: "2026-05",
      status: "待复核",
      voucherId: null,
      batch: { depreciationAmount: 3200 },
      records: [
        {
          depreciationAmount: 2000,
          expenseAccount: "6602",
          accumulatedDepreciationAccount: "1602",
        },
        {
          depreciationAmount: 1200,
          expenseAccount: "6602",
          accumulatedDepreciationAccount: "1602",
        },
      ],
    },
  });

  assert.equal(draft.referenceNumber, "ZJ-2026-05");
  assert.deepEqual(
    draft.entries.map((entry) => [entry.direction, entry.accountCode, entry.amount]),
    [
      ["debit", "6602", "3200"],
      ["credit", "1602", "3200"],
    ],
  );
});

test("reviewed depreciation lines use their snapshotted accounting subjects", () => {
  const draft = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill({
    kind: "depreciation_batch",
    periodLabel: "2026-06",
    accounts: [
      { code: "5101", name: "制造费用", is_enabled: 1, is_detail: 1 },
      { code: "6602", name: "管理费用", is_enabled: 1, is_detail: 1 },
      { code: "1602", name: "累计折旧", is_enabled: 1, is_detail: 1 },
    ],
    record: {
      id: "company-1:2026-06",
      period: "2026-06",
      status: "待复核",
      voucherId: null,
      batch: { depreciationAmount: 690 },
      records: [
        {
          assetName: "办公电脑",
          depreciationAmount: 190,
          expenseAccount: "6602",
          accumulatedDepreciationAccount: "1602",
        },
        {
          assetName: "生产设备",
          depreciationAmount: 500,
          expenseAccount: "5101",
          accumulatedDepreciationAccount: "1602",
        },
      ],
    },
  });

  assert.deepEqual(
    draft.entries.map((entry) => [entry.direction, entry.accountCode, entry.amount]),
    [
      ["debit", "5101", "500"],
      ["debit", "6602", "190"],
      ["credit", "1602", "690"],
    ],
  );
});

test("browser depreciation preview links and unlinks the reviewed batch with every line", () => {
  const link =
    businessVoucherSourceWorkflowModule.linkBrowserDepreciationVoucher;
  const unlink =
    businessVoucherSourceWorkflowModule.unlinkBrowserDepreciationVoucher;
  assert.equal(typeof link, "function");
  assert.equal(typeof unlink, "function");

  const initial = {
    batches: [
      {
        id: "batch-1",
        companyId: "company-1",
        period: "2026-06",
        voucherId: null,
        status: "待复核",
      },
      {
        id: "batch-2",
        companyId: "company-2",
        period: "2026-06",
        voucherId: null,
        status: "待复核",
      },
    ],
    lines: [
      {
        id: "line-1",
        companyId: "company-1",
        period: "2026-06",
        voucherId: null,
        status: "待复核",
      },
      {
        id: "line-2",
        companyId: "company-2",
        period: "2026-06",
        voucherId: null,
        status: "待复核",
      },
    ],
  };
  const linked = link({
    ...initial,
    companyId: "company-1",
    period: "2026-06",
    voucherId: "voucher-1",
    voucherNumber: "记-0001",
    now: "2026-06-30T10:00:00.000Z",
  });

  assert.deepEqual(
    linked.batches.map((item) => [item.id, item.voucherId, item.status]),
    [
      ["batch-1", "voucher-1", "已生成凭证"],
      ["batch-2", null, "待复核"],
    ],
  );
  assert.deepEqual(
    linked.lines.map((item) => [item.id, item.voucherId, item.status]),
    [
      ["line-1", "voucher-1", "已生成凭证"],
      ["line-2", null, "待复核"],
    ],
  );

  const unlinked = unlink({
    ...linked,
    companyId: "company-1",
    voucherId: "voucher-1",
    now: "2026-06-30T10:05:00.000Z",
  });
  assert.deepEqual(
    unlinked.batches.map((item) => [item.id, item.voucherId, item.status]),
    [
      ["batch-1", null, "待复核"],
      ["batch-2", null, "待复核"],
    ],
  );
  assert.deepEqual(
    unlinked.lines.map((item) => [item.id, item.voucherId, item.status]),
    [
      ["line-1", null, "待复核"],
      ["line-2", null, "待复核"],
    ],
  );
});

test("business voucher sources reject invalid periods, amounts and duplicate links", () => {
  assert.notEqual(businessVoucherSourceWorkflowModule, null);
  const build = businessVoucherSourceWorkflowModule.buildBusinessVoucherPrefill;
  const base = {
    id: "doc-1",
    period: "2026-05",
    businessDate: "2026-05-09",
    documentCode: "BX-001",
    businessType: "费用报销",
    amount: 320,
    voucherId: null,
  };
  assert.throws(
    () => build({ kind: "document_record", record: base, accounts: [], periodLabel: "2026-06" }),
    /账期/,
  );
  assert.throws(
    () => build({ kind: "document_record", record: { ...base, amount: 0 }, accounts: [], periodLabel: "2026-05" }),
    /金额/,
  );
  assert.throws(
    () => build({ kind: "document_record", record: { ...base, voucherId: "voucher-1" }, accounts: [], periodLabel: "2026-05" }),
    /已关联凭证/,
  );
});
