import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("operational pagination clamps pages and reports visible row bounds", async () => {
  const { paginateOperationalRows } = await import(
    new URL("../src/lib/operationalPagination.ts", import.meta.url)
  );
  const rows = Array.from({ length: 45 }, (_, index) => index + 1);

  assert.deepEqual(paginateOperationalRows(rows, 2, 20), {
    rows: rows.slice(20, 40),
    page: 2,
    pageSize: 20,
    totalItems: 45,
    totalPages: 3,
    start: 21,
    end: 40,
  });
  assert.equal(paginateOperationalRows(rows, 99, 20).page, 3);
  assert.equal(paginateOperationalRows([], 3, 0).page, 1);
});

test("routed operational list families use the shared pagination control", async () => {
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
    const source = await readFile(
      new URL(`../${file}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /OperationalPagination/);
    assert.match(source, /paginateOperationalRows/);
  }
});

test("file center sub-workspaces each own a pagination control", async () => {
  const source = await readFile(
    new URL("../src/pages/operations/FileCenterWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/<OperationalPagination/g) || []).length, 3);
});

test("auxiliary master-data routes share the parameterized pagination control", async () => {
  const source = await readFile(
    new URL("../src/pages/operations/AuxiliaryWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/<OperationalPagination/g) || []).length, 1);
});

test("AI operations paginate both jobs and training rules", async () => {
  const source = await readFile(
    new URL(
      "../src/pages/operations/AiOperationsWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal((source.match(/<OperationalPagination/g) || []).length, 2);
});

test("parameterized archive and history routes each share one pagination control", async () => {
  for (const file of [
    "ArchiveProfileWorkspace.tsx",
    "HistoryMigrationWorkspace.tsx",
  ]) {
    const source = await readFile(
      new URL(`../src/pages/operations/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal((source.match(/<OperationalPagination/g) || []).length, 1);
  }
});

test("parameterized template and adapter routes share one pagination control", async () => {
  for (const file of [
    "AdapterAuthorizationWorkspace.tsx",
    "TemplateSettingsWorkspace.tsx",
  ]) {
    const source = await readFile(
      new URL(`../src/pages/operations/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal((source.match(/<OperationalPagination/g) || []).length, 1);
  }
});

test("initialization paginates balances and tax tasks independently", async () => {
  const source = await readFile(
    new URL(
      "../src/pages/operations/InitializationWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal((source.match(/<OperationalPagination/g) || []).length, 2);
});

test("remaining configuration lists each own one pagination control", async () => {
  for (const file of [
    "SettlementRuleWorkspace.tsx",
    "MatchingRuleWorkspace.tsx",
    "ReportFormulaWorkspace.tsx",
    "PrintTemplateWorkspace.tsx",
    "CurrencyWorkspace.tsx",
    "MeasurementUnitWorkspace.tsx",
  ]) {
    const source = await readFile(
      new URL(`../src/pages/operations/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal((source.match(/<OperationalPagination/g) || []).length, 1);
  }
});

test("tax declaration workbench paginates the filtered declaration result", async () => {
  const source = await readFile(
    new URL("../src/pages/tax/TaxWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /paginateOperationalRows\(filteredDeclarationRows,/);
  assert.match(source, /<OperationalPagination/);
  assert.match(source, /declarationPage\.rows\.map/);
  assert.doesNotMatch(source, /第 1 \/ 1 页，每页 50 条/);
});

test("agency account and member administration paginate growing datasets", async () => {
  const cases = [
    ["src/pages/Welcome.tsx", /paginateOperationalRows\(rows,/, /accountPage\.rows\.map/],
    ["src/pages/settings/RoleManager.tsx", /paginateOperationalRows\(users,/, /userPage\.rows\.map/],
  ];

  for (const [file, paginationPattern, rowPattern] of cases) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /OperationalPagination/);
    assert.match(source, paginationPattern);
    assert.match(source, rowPattern);
  }
});
