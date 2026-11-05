import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = join(root, "src/lib/accountingReportExport.ts");

async function loadModule() {
  assert.equal(
    existsSync(modulePath),
    true,
    "financial statements and ledgers need a dedicated accounting export model",
  );
  return import(pathToFileURL(modulePath).href);
}

test("statutory statement export preserves official identity and numeric cells", async () => {
  const { createAccountingReportExportModel } = await loadModule();
  const model = createAccountingReportExportModel({
    title: "利润表",
    companyName: "测试小企业",
    periodLabel: "2026年10月",
    accountingStandard: "小企业会计准则",
    formCode: "会小企 02 表",
    unit: "元",
    generatedAt: "2026-10-23 10:00:00",
    reportKind: "statutory_statement",
    headers: ["项目", "行次", "本月金额", "本年累计金额"],
    rows: [["一、营业收入", "1", "¥1,234.50", 4567.8]],
  });

  assert.equal(model.orientation, "portrait");
  assert.equal(model.formCode, "会小企 02 表");
  assert.deepEqual(model.sheetRows[1], ["", "", "", "会小企 02 表"]);
  assert.deepEqual(model.sheetRows[2], [
    "编制单位：测试小企业",
    "",
    "所属期间：2026年10月",
    "单位：元",
  ]);
  assert.deepEqual(model.sheetRows[3], ["会计准则：小企业会计准则"]);
  assert.deepEqual(model.sheetRows[6], ["一、营业收入", "1", 1234.5, 4567.8]);
  assert.deepEqual(model.sheetRows.at(-2), ["制表人：", "", "复核人：", "负责人："]);
  assert.deepEqual(model.xlsxMerges, [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
  ]);
});

test("accounting print output uses portrait statements and landscape ledgers", async () => {
  const { buildAccountingReportPrintHtml, createAccountingReportExportModel } =
    await loadModule();
  const base = {
    companyName: "A&B 公司",
    periodLabel: "2026-10",
    accountingStandard: "小企业会计准则",
    generatedAt: "2026-10-23 10:00:00",
    headers: ["科目编码", "科目名称", "金额"],
    rows: [["001001", "<库存现金>", 100]],
  };
  const statementHtml = buildAccountingReportPrintHtml(
    createAccountingReportExportModel({
      ...base,
      title: "资产负债表",
      formCode: "会小企 01 表",
      reportKind: "statutory_statement",
    }),
  );
  const ledgerHtml = buildAccountingReportPrintHtml(
    createAccountingReportExportModel({
      ...base,
      title: "总账",
      reportKind: "ledger",
    }),
  );

  assert.match(statementHtml, /@page\{size:A4 portrait;/);
  assert.match(statementHtml, /会小企 01 表/);
  assert.match(statementHtml, /小企业会计准则/);
  assert.match(statementHtml, /单位：元/);
  assert.match(statementHtml, /A&amp;B 公司/);
  assert.match(statementHtml, /&lt;库存现金&gt;/);
  assert.match(ledgerHtml, /@page\{size:A4 landscape;/);
});

test("balance sheet export pairs assets with liabilities and equity in the statutory dual layout", async () => {
  const { buildBalanceSheetDualTable, createAccountingReportExportModel } =
    await loadModule();
  const table = buildBalanceSheetDualTable([
    { section: "asset", name: "货币资金", lineNumber: "1", closingBalance: 100, openingBalance: 80 },
    { section: "asset", name: "应收账款", lineNumber: "2", closingBalance: 60, openingBalance: 50 },
    { section: "liability", name: "短期借款", lineNumber: "21", closingBalance: 90, openingBalance: 70 },
    { section: "equity", name: "实收资本", lineNumber: "31", closingBalance: 70, openingBalance: 60 },
  ]);

  assert.deepEqual(table.headers, [
    "资产", "行次", "期末余额", "年初余额",
    "负债和所有者权益", "行次", "期末余额", "年初余额",
  ]);
  assert.deepEqual(table.rows, [
    ["货币资金", "1", 100, 80, "短期借款", "21", 90, 70],
    ["应收账款", "2", 60, 50, "实收资本", "31", 70, 60],
  ]);

  const model = createAccountingReportExportModel({
    title: "资产负债表",
    generatedAt: "2026-10-23 10:00:00",
    reportKind: "statutory_statement",
    layout: "balance_sheet_dual",
    headers: table.headers,
    rows: table.rows,
  });
  assert.equal(model.orientation, "landscape");
  assert.deepEqual(model.amountColumnIndexes, [2, 3, 6, 7]);
});

test("equity change matrix exports in landscape with every component treated as an amount", async () => {
  const { createAccountingReportExportModel } = await loadModule();
  const model = createAccountingReportExportModel({
    title: "所有者权益变动表",
    formCode: "会企 04 表",
    generatedAt: "2026-10-25 10:00:00",
    reportKind: "statutory_statement",
    layout: "equity_change_matrix",
    headers: ["项目", "行次", "实收资本（或股本）", "减：库存股", "未分配利润", "所有者权益合计"],
    rows: [["二、本年年初余额", "5", 100, -5, 0, 95]],
  });

  assert.equal(model.orientation, "landscape");
  assert.deepEqual(model.amountColumnIndexes, [2, 3, 4, 5]);
  assert.deepEqual(model.sheetRows[6], ["二、本年年初余额", "5", 100, -5, 0, 95]);
});

test("comparative equity statement exports two statutory year groups on A3 landscape", async () => {
  const { buildAccountingReportPrintHtml, createAccountingReportExportModel } = await loadModule();
  const model = createAccountingReportExportModel({
    title: "所有者权益变动表",
    formCode: "会企 04 表",
    generatedAt: "2026-10-25 10:00:00",
    reportKind: "statutory_statement",
    layout: "equity_change_matrix",
    headers: ["项目", "行次", "实收资本", "所有者权益合计", "实收资本", "所有者权益合计"],
    headerGroups: [
      { label: "本年金额", startColumn: 2, endColumn: 3 },
      { label: "上年金额", startColumn: 4, endColumn: 5 },
    ],
    rows: [["四、本年年末余额", "28", 130, 130, 110, 110]],
  });

  assert.equal(model.pageSize, "A3");
  assert.deepEqual(model.sheetRows[5], ["项目", "行次", "本年金额", "", "上年金额", ""]);
  assert.deepEqual(model.sheetRows[6], model.headers);
  assert.ok(model.xlsxMerges.some((merge) => merge.s.r === 5 && merge.s.c === 2 && merge.e.c === 3));
  assert.ok(model.xlsxMerges.some((merge) => merge.s.r === 5 && merge.s.c === 4 && merge.e.c === 5));

  const html = buildAccountingReportPrintHtml(model);
  assert.match(html, /@page\{size:A3 landscape;/);
  assert.match(html, /colspan="2">本年金额/);
  assert.match(html, /colspan="2">上年金额/);
})

test("nonprofit activity statement exports grouped monthly and year-to-date columns", async () => {
  const { createAccountingReportExportModel } = await loadModule();
  const model = createAccountingReportExportModel({
    title: "业务活动表",
    companyName: "测试基金会",
    periodLabel: "2026-02",
    accountingStandard: "民间非营利组织会计制度",
    formCode: "会民非 02 表",
    generatedAt: "2026-10-25 12:00:00",
    reportKind: "statutory_statement",
    layout: "income_activity_matrix",
    headers: ["项目", "行次", "非限定性", "限定性", "合计", "非限定性", "限定性", "合计"],
    headerGroups: [
      { label: "本月数", startColumn: 2, endColumn: 4 },
      { label: "本年累计数", startColumn: 5, endColumn: 7 },
    ],
    rows: [["捐赠收入", "1", 10, 5, 15, 30, 13, 43]],
  });

  assert.equal(model.orientation, "landscape");
  assert.equal(model.pageSize, "A4");
  assert.deepEqual(model.amountColumnIndexes, [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(model.sheetRows[5], ["项目", "行次", "本月数", "", "", "本年累计数", "", ""]);
});

test("financial and ledger workspaces use the dedicated accounting exporter", () => {
  for (const file of [
    "src/pages/operations/FinancialStatementWorkspace.tsx",
    "src/pages/operations/LedgerReportWorkspace.tsx",
    "src/pages/operations/LedgerDetailWorkspace.tsx",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /AccountingReportExportActions/);
  }

  const actions = readFileSync(
    join(root, "src/components/operations/AccountingReportExportActions.tsx"),
    "utf8",
  );
  assert.match(actions, /merges:\s*model\.xlsxMerges/);
  assert.match(actions, /orientation:\s*model\.orientation/);
  assert.match(actions, /stickyRowsCount:\s*6/);
  assert.match(actions, /showGridLines:\s*false/);
});
