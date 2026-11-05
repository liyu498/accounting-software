import assert from "node:assert/strict";
import test from "node:test";

const workflowModule = await import(
  "../src/lib/voucherEntryWorkflow.js"
).catch(() => null);
const templateWorkflowModule = await import(
  "../src/lib/voucherTemplateWorkflow.js"
).catch(() => null);
const tagWorkflowModule = await import(
  "../src/lib/voucherTagWorkflow.js"
).catch(() => null);

test("save-and-new resets business data while preserving entry context", () => {
  assert.notEqual(
    workflowModule,
    null,
    "voucher entry workflow helper is missing",
  );

  const nextDraft = workflowModule.createNextVoucherDraft(
    {
      voucherDate: "2026-09-30",
      voucherNumber: "记字第018号",
      voucherWordId: "word-1",
      summary: "支付服务费",
      attachmentCount: "3",
      entries: [
        {
          accountCode: "6602",
          accountName: "管理费用",
          direction: "debit",
          amount: "100",
          summary: "支付服务费",
        },
        {
          accountCode: "1002",
          accountName: "银行存款",
          direction: "credit",
          amount: "100",
          summary: "支付服务费",
        },
      ],
    },
    "记字第019号",
  );

  assert.equal(nextDraft.voucherDate, "2026-09-30");
  assert.equal(nextDraft.voucherWordId, "word-1");
  assert.equal(nextDraft.voucherNumber, "记字第019号");
  assert.equal(nextDraft.summary, "");
  assert.equal(nextDraft.attachmentCount, "0");
  assert.deepEqual(
    nextDraft.entries.map((entry) => ({
      direction: entry.direction,
      accountCode: entry.accountCode,
      amount: entry.amount,
    })),
    [
      { direction: "debit", accountCode: "", amount: "" },
      { direction: "credit", accountCode: "", amount: "" },
    ],
  );
});

test("voucher submit intent distinguishes save-and-new", () => {
  assert.notEqual(
    workflowModule,
    null,
    "voucher entry workflow helper is missing",
  );

  assert.equal(workflowModule.resolveVoucherSubmitIntent("save-and-new"), "new");
  assert.equal(workflowModule.resolveVoucherSubmitIntent("save-and-close"), "close");
  assert.equal(workflowModule.resolveVoucherSubmitIntent("save"), "stay");
  assert.equal(workflowModule.resolveVoucherSubmitIntent(undefined), "stay");
});

test("voucher entry auxiliary workflow preserves multiple dimensions and legacy data", () => {
  assert.notEqual(
    workflowModule,
    null,
    "voucher entry workflow helper is missing",
  );

  const selections = workflowModule.hydrateAuxiliarySelections({
    auxiliary_type: "department",
    auxiliary_id: "department-1",
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
  });

  assert.deepEqual(selections, {
    customer: "customer-1",
    project: "project-1",
    department: "department-1",
  });
  assert.deepEqual(workflowModule.serializeAuxiliarySelections(selections), [
    {
      auxiliary_category_id: "customer",
      auxiliary_item_id: "customer-1",
    },
    {
      auxiliary_category_id: "department",
      auxiliary_item_id: "department-1",
    },
    {
      auxiliary_category_id: "project",
      auxiliary_item_id: "project-1",
    },
  ]);
});

test("voucher entry auxiliary workflow validates every required category", () => {
  const categories = [
    { category_id: "customer", category_name: "客户", is_required: 1 },
    { category_id: "project", category_name: "项目", is_required: 1 },
    { category_id: "department", category_name: "部门", is_required: 0 },
  ];

  assert.deepEqual(
    workflowModule.getMissingRequiredAuxiliaryCategories(categories, {
      customer: "customer-1",
    }),
    [{ category_id: "project", category_name: "项目", is_required: 1 }],
  );
  assert.deepEqual(
    workflowModule.getMissingRequiredAuxiliaryCategories(categories, {
      customer: "customer-1",
      project: "project-1",
    }),
    [],
  );
});

test("voucher templates preserve amounts and extended accounting dimensions", () => {
  assert.notEqual(
    templateWorkflowModule,
    null,
    "voucher template workflow helper is missing",
  );

  const entries = templateWorkflowModule.createVoucherTemplateEntries(
    [
      {
        accountCode: "6602",
        accountName: "管理费用",
        direction: "debit",
        amount: "125.50",
        summary: "支付服务费",
        auxiliaryType: "department",
        auxiliaryId: "department-1",
        auxiliarySelections: {
          department: "department-1",
          project: "project-1",
        },
        docNumber: "HT-001",
        quantity: "5",
        unitPrice: "25.1",
        unit: "次",
        currencyId: "usd",
        exchangeRate: "7.12",
      },
      {
        accountCode: "1002",
        accountName: "银行存款",
        direction: "credit",
        amount: "125.50",
        summary: "",
        auxiliaryType: "",
        auxiliaryId: "",
        docNumber: "",
        quantity: "",
        unitPrice: "",
        unit: "",
        currencyId: "",
        exchangeRate: "",
      },
    ],
    "支付服务费",
  );

  assert.equal(entries.length, 2);
  assert.equal(entries[0].amount, 125.5);
  assert.equal(entries[0].doc_number, "HT-001");
  assert.equal(entries[0].quantity, 5);
  assert.equal(entries[0].unit_price, 25.1);
  assert.equal(entries[0].currency_id, "usd");
  assert.deepEqual(entries[0].auxiliary_items, [
    {
      auxiliary_category_id: "department",
      auxiliary_item_id: "department-1",
    },
    {
      auxiliary_category_id: "project",
      auxiliary_item_id: "project-1",
    },
  ]);
  assert.equal(entries[1].summary, "支付服务费");

  const applied = templateWorkflowModule.applyVoucherTemplateToDraft(
    {
      voucherDate: "2026-09-30",
      voucherNumber: "记字第019号",
      voucherWordId: "word-1",
      summary: "",
      attachmentCount: "0",
      entries: [],
    },
    entries,
  );

  assert.equal(applied.voucherDate, "2026-09-30");
  assert.equal(applied.voucherNumber, "记字第019号");
  assert.equal(applied.summary, "支付服务费");
  assert.equal(applied.entries[0].amount, "125.5");
  assert.equal(applied.entries[0].auxiliaryType, "department");
  assert.deepEqual(applied.entries[0].auxiliarySelections, {
    department: "department-1",
    project: "project-1",
  });
  assert.equal(applied.entries[0].exchangeRate, "7.12");
});

test("voucher totals expose standard Chinese uppercase currency", () => {
  assert.equal(workflowModule.toChineseCurrencyUppercase(0), "零元整");
  assert.equal(workflowModule.toChineseCurrencyUppercase(1234.56), "壹仟贰佰叁拾肆元伍角陆分");
  assert.equal(workflowModule.toChineseCurrencyUppercase(1001.05), "壹仟零壹元零伍分");
  assert.equal(workflowModule.toChineseCurrencyUppercase(1000001), "壹佰万零壹元整");
  assert.equal(workflowModule.toChineseCurrencyUppercase(0.08), "零元零捌分");
});

test("voucher tag choices honor module scope and preserve selected disabled tags", () => {
  assert.notEqual(tagWorkflowModule, null, "voucher tag workflow helper is missing");

  const tags = [
    { id: "voucher", applicable_modules: "凭证、报表", is_enabled: 1 },
    { id: "invoice", applicable_modules: "发票", is_enabled: 1 },
    { id: "disabled", applicable_modules: "凭证", is_enabled: 0 },
  ];

  assert.deepEqual(
    tagWorkflowModule
      .getSelectableVoucherTags(tags, ["disabled"])
      .map((tag) => tag.id),
    ["voucher", "disabled"],
  );
  assert.deepEqual(tagWorkflowModule.toggleVoucherTagId(["voucher"], "voucher"), []);
  assert.deepEqual(tagWorkflowModule.toggleVoucherTagId([], "voucher"), ["voucher"]);
});
