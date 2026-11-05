import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = join(root, "src/lib/operationalExport.ts");

async function loadModule() {
  assert.equal(
    existsSync(modulePath),
    true,
    "the routed workspaces need a shared operational export model",
  );
  return import(pathToFileURL(modulePath).href);
}

test("operational export removes selection and action columns while preserving aligned data", async () => {
  const { createOperationalExportModel } = await loadModule();

  const result = createOperationalExportModel({
    title: "进项发票清单",
    companyName: "测试企业",
    periodLabel: "2026-10",
    generatedAt: "2026-10-15 11:30:00",
    headers: ["", "发票号码", "销方名称", "金额", "操作"],
    rows: [
      ["选中", " 3100\n2600  ", " 上海示例公司 ", "¥ 1,200.00", "查看 编辑"],
      ["", "31002601", "苏州示例公司", "¥ 800.00", "查看"],
    ],
  });

  assert.deepEqual(result.headers, ["发票号码", "销方名称", "金额"]);
  assert.deepEqual(result.rows, [
    ["3100 2600", "上海示例公司", "¥ 1,200.00"],
    ["31002601", "苏州示例公司", "¥ 800.00"],
  ]);
  assert.deepEqual(result.sheetRows, [
    ["进项发票清单"],
    [
      "编制单位",
      "测试企业",
      "所属期间",
      "2026-10",
      "导出时间",
      "2026-10-15 11:30:00",
    ],
    [],
    ["发票号码", "销方名称", "金额"],
    ["3100 2600", "上海示例公司", 1200],
    ["31002601", "苏州示例公司", 800],
    ["制表说明", "按当前页面筛选范围导出，共 2 条记录。"],
  ]);
});

test("operational export keeps accounting numbers numeric without coercing account codes", async () => {
  const { createOperationalExportModel } = await loadModule();

  const result = createOperationalExportModel({
    title: "科目余额表",
    generatedAt: "2026-10-15 11:30:00",
    headers: ["科目编码", "本期借方", "本期贷方", "税率"],
    rows: [["001001", 0, "-¥1,234.50", "13.00%"]],
  });

  assert.deepEqual(result.rows, [["001001", "0", "-¥1,234.50", "13.00%"]]);
  assert.deepEqual(result.sheetRows[4], ["001001", 0, -1234.5, "13.00%"]);
});

test("generated xlsx preserves numeric accounting cells in a readable workbook", async () => {
  const { createOperationalExportModel } = await loadModule();
  const { buildXlsxSheetData } = await import(
    new URL("../src/lib/xlsxExport.ts", import.meta.url)
  );
  const [{ default: writeXlsxFile }, { default: readXlsxFile }] =
    await Promise.all([
      import("write-excel-file/node"),
      import("read-excel-file/node"),
    ]);
  const model = createOperationalExportModel({
    title: "科目余额表",
    companyName: "测试企业",
    periodLabel: "2026-10",
    generatedAt: "2026-10-15 11:30:00",
    headers: ["科目编码", "本期借方", "本期贷方", "税率"],
    rows: [["001001", 0, "-¥1,234.50", "13.00%"]],
  });
  const workbook = buildXlsxSheetData({
    sheetRows: model.sheetRows,
    columnWidths: [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }],
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }],
  });
  const directory = await mkdtemp(join(tmpdir(), "accounting-xlsx-"));
  const file = join(directory, "roundtrip.xlsx");

  await writeXlsxFile(workbook.data, { columns: workbook.columns }).toFile(file);
  const parsed = await readXlsxFile(file);
  const rows = Array.isArray(parsed[0]?.data) ? parsed[0].data : parsed;

  assert.deepEqual(rows[4].slice(0, 4), ["001001", 0, -1234.5, "13.00%"]);
});

test("operational print document escapes business data and uses a repeatable A4 table layout", async () => {
  const { buildOperationalPrintHtml, createOperationalExportModel } =
    await loadModule();
  const model = createOperationalExportModel({
    title: "<异常票据>",
    companyName: "A&B 公司",
    periodLabel: "2026-10",
    generatedAt: "2026-10-15 11:30:00",
    headers: ["摘要", "金额"],
    rows: [["<script>alert(1)</script>", "100.00"]],
  });

  const html = buildOperationalPrintHtml(model);

  assert.match(html, /@page\{size:A4 landscape;margin:12mm\}/);
  assert.match(html, /thead\{display:table-header-group\}/);
  assert.match(html, /tr\{break-inside:avoid;page-break-inside:avoid\}/);
  assert.match(html, /&lt;异常票据&gt;/);
  assert.match(html, /A&amp;B 公司/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("paginated operational workspaces export the complete filtered result", () => {
  const files = [
    "src/pages/operations/InputInvoiceWorkspace.tsx",
    "src/pages/operations/OutputInvoiceWorkspace.tsx",
    "src/pages/operations/BankStatementWorkspace.tsx",
    "src/pages/operations/VoucherWorkspace.tsx",
    "src/pages/operations/LedgerReportWorkspace.tsx",
    "src/pages/operations/FinancialStatementWorkspace.tsx",
    "src/pages/operations/EmployeeWorkspace.tsx",
    "src/pages/operations/PayrollWorkspace.tsx",
    "src/pages/operations/SocialSecurityWorkspace.tsx",
    "src/pages/operations/SpecialDeductionWorkspace.tsx",
    "src/pages/operations/AccountTransferWorkspace.tsx",
    "src/pages/operations/AgingWorkspace.tsx",
    "src/pages/operations/ContractLedgerWorkspace.tsx",
    "src/pages/operations/FixedAssetWorkspace.tsx",
    "src/pages/operations/InventoryMasterWorkspace.tsx",
    "src/pages/operations/InventoryMovementWorkspace.tsx",
    "src/pages/operations/BankReconciliationWorkspace.tsx",
    "src/pages/operations/BillListWorkspace.tsx",
    "src/pages/operations/BusinessOrderWorkspace.tsx",
    "src/pages/operations/CostCarryoverWorkspace.tsx",
    "src/pages/operations/DocumentBusinessWorkspace.tsx",
    "src/pages/operations/DocumentRegisterWorkspace.tsx",
    "src/pages/operations/SettlementWorkspace.tsx",
    "src/pages/operations/AuditLogWorkspace.tsx",
    "src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx",
    "src/pages/operations/LedgerDetailWorkspace.tsx",
    "src/pages/operations/RiskCheckWorkspace.tsx",
    "src/pages/operations/VoucherRecycleWorkspace.tsx",
    "src/pages/operations/FileCenterWorkspace.tsx",
    "src/pages/operations/AccountCodeWorkspace.tsx",
    "src/pages/operations/AuxiliaryWorkspace.tsx",
    "src/pages/operations/AssetCategoryWorkspace.tsx",
    "src/pages/operations/BusinessTagWorkspace.tsx",
    "src/pages/operations/CompanyAccountWorkspace.tsx",
    "src/pages/operations/AiOperationsWorkspace.tsx",
    "src/pages/operations/ArchiveProfileWorkspace.tsx",
    "src/pages/operations/HistoryMigrationWorkspace.tsx",
    "src/pages/operations/AdapterAuthorizationWorkspace.tsx",
    "src/pages/operations/BackupRestoreWorkspace.tsx",
    "src/pages/operations/PeriodManagementWorkspace.tsx",
    "src/pages/operations/TemplateSettingsWorkspace.tsx",
    "src/pages/operations/InitializationWorkspace.tsx",
    "src/pages/operations/SystemHubWorkspace.tsx",
    "src/pages/operations/SettlementRuleWorkspace.tsx",
    "src/pages/operations/MatchingRuleWorkspace.tsx",
    "src/pages/operations/ReportFormulaWorkspace.tsx",
    "src/pages/operations/PrintTemplateWorkspace.tsx",
    "src/pages/operations/CurrencyWorkspace.tsx",
    "src/pages/operations/MeasurementUnitWorkspace.tsx",
    "src/pages/tax/TaxReportWorkspace.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /exportHeaders=/);
    assert.match(source, /exportRows=/);
  }
});

test("file center sub-workspaces export their own filtered records", () => {
  const source = readFileSync(
    join(root, "src/pages/operations/FileCenterWorkspace.tsx"),
    "utf8",
  );
  assert.equal((source.match(/<OperationalExportActions/g) || []).length, 3);
  assert.equal((source.match(/exportHeaders=/g) || []).length, 3);
  assert.equal((source.match(/exportRows=/g) || []).length, 3);
});

test("auxiliary master-data routes share the parameterized export control", () => {
  const source = readFileSync(
    join(root, "src/pages/operations/AuxiliaryWorkspace.tsx"),
    "utf8",
  );
  assert.equal((source.match(/<OperationalExportActions/g) || []).length, 1);
  assert.equal((source.match(/exportHeaders=/g) || []).length, 1);
  assert.equal((source.match(/exportRows=/g) || []).length, 1);
});

test("AI operations export jobs and training rules independently", () => {
  const source = readFileSync(
    join(root, "src/pages/operations/AiOperationsWorkspace.tsx"),
    "utf8",
  );
  assert.equal((source.match(/<OperationalExportActions/g) || []).length, 2);
  assert.equal((source.match(/exportHeaders=/g) || []).length, 2);
  assert.equal((source.match(/exportRows=/g) || []).length, 2);
});

test("parameterized archive and history routes each share one export control", () => {
  for (const file of [
    "ArchiveProfileWorkspace.tsx",
    "HistoryMigrationWorkspace.tsx",
  ]) {
    const source = readFileSync(
      join(root, "src/pages/operations", file),
      "utf8",
    );
    assert.equal((source.match(/<OperationalExportActions/g) || []).length, 1);
    assert.equal((source.match(/exportHeaders=/g) || []).length, 1);
    assert.equal((source.match(/exportRows=/g) || []).length, 1);
  }
});

test("parameterized template and adapter routes share one export control", () => {
  for (const file of [
    "AdapterAuthorizationWorkspace.tsx",
    "TemplateSettingsWorkspace.tsx",
  ]) {
    const source = readFileSync(
      join(root, "src/pages/operations", file),
      "utf8",
    );
    assert.equal((source.match(/<OperationalExportActions/g) || []).length, 1);
    assert.equal((source.match(/exportHeaders=/g) || []).length, 1);
    assert.equal((source.match(/exportRows=/g) || []).length, 1);
  }
});

test("initialization exports balances and tax tasks independently", () => {
  const source = readFileSync(
    join(root, "src/pages/operations/InitializationWorkspace.tsx"),
    "utf8",
  );
  assert.equal((source.match(/<OperationalExportActions/g) || []).length, 2);
  assert.equal((source.match(/exportHeaders=/g) || []).length, 2);
  assert.equal((source.match(/exportRows=/g) || []).length, 2);
});

test("remaining configuration lists each own one full-result export", () => {
  for (const file of [
    "SettlementRuleWorkspace.tsx",
    "MatchingRuleWorkspace.tsx",
    "ReportFormulaWorkspace.tsx",
    "PrintTemplateWorkspace.tsx",
    "CurrencyWorkspace.tsx",
    "MeasurementUnitWorkspace.tsx",
  ]) {
    const source = readFileSync(
      join(root, "src/pages/operations", file),
      "utf8",
    );
    assert.equal((source.match(/<OperationalExportActions/g) || []).length, 1);
    assert.equal((source.match(/exportHeaders=/g) || []).length, 1);
    assert.equal((source.match(/exportRows=/g) || []).length, 1);
  }
});

test("tax declaration package exports the complete filtered result", () => {
  const source = readFileSync(
    join(root, "src/pages/tax/TaxWorkspace.tsx"),
    "utf8",
  );

  assert.match(source, /const taxPackageRows = filteredDeclarationRows/);
  assert.match(source, /buildTaxDeclarationPackageHtml\(exportedAt, taxPackageRows,/);
  assert.match(source, /rowCount: taxPackageRows\.length/);
});
