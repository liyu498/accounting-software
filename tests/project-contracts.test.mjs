import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

function assertVerifierReadsWorkspace(verifier, variableName, workspacePath) {
  const escapedPath = workspacePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    verifier,
    new RegExp(
      `const\\s+${variableName}\\s*=\\s*existsSync\\(\\s*["']${escapedPath}["']\\s*,?\\s*\\)`,
    ),
  );
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [file]
        : [];
  });
}

test("desktop content security policy is explicit and restrictive", () => {
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const csp = config.app?.security?.csp;

  assert.equal(typeof csp, "string");
  for (const directive of [
    "default-src",
    "script-src",
    "style-src",
    "font-src",
    "img-src",
    "connect-src",
    "object-src",
    "base-uri",
    "form-action",
  ]) {
    assert.match(csp, new RegExp(`(?:^|;)\\s*${directive}\\s`));
  }
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.doesNotMatch(csp, /\*\s*;/);
});

test("release builds do not enable the Tauri devtools feature", () => {
  const cargoManifest = read("src-tauri/Cargo.toml");
  assert.doesNotMatch(cargoManifest, /tauri\s*=\s*\{[^\n]*features\s*=\s*\[[^\]]*["']devtools["']/);
});

test("desktop capabilities expose only the file picker used by the application", () => {
  const capabilities = JSON.parse(read("src-tauri/capabilities/default.json"));
  const cargoManifest = read("src-tauri/Cargo.toml");
  const backend = read("src-tauri/src/lib.rs");
  const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json"));

  assert.deepEqual(capabilities.permissions, ["core:default", "dialog:allow-open"]);
  assert.doesNotMatch(cargoManifest, /tauri-plugin-opener/);
  assert.doesNotMatch(backend, /tauri_plugin_opener/);
  assert.equal(tauriConfig.plugins?.opener, undefined);
});

test("desktop IPC rejects protected commands without a valid session token", () => {
  const auth = read("src-tauri/src/commands/auth.rs");
  const backend = read("src-tauri/src/lib.rs");
  const bridge = read("src/lib/tauri.ts");

  assert.match(auth, /pub\(crate\) async fn authorize_invoke/);
  assert.match(auth, /authToken/);
  assert.match(auth, /validate_session_token/);
  assert.match(auth, /authorize_user_command/);
  assert.match(auth, /FROM role_permissions/);
  assert.match(auth, /FROM user_companies/);
  assert.match(backend, /authorize_invoke\(&invoke\)\.await/);
  assert.match(backend, /invoke\.resolver\.reject/);
  assert.match(bridge, /PROTECTED_INVOKE_TOKEN_KEY/);
  assert.match(bridge, /sessionStorage\.getItem\(PROTECTED_INVOKE_TOKEN_KEY\)/);
  assert.doesNotMatch(bridge, /localStorage\.getItem\(PROTECTED_INVOKE_TOKEN_KEY\)/);
  assert.match(bridge, /authToken/);
});

test("desktop login tokens are confined to the current window session", () => {
  const authStore = read("src/stores/authStore.ts");

  assert.match(authStore, /sessionStorage\.setItem\("auth_token"/);
  assert.match(authStore, /sessionStorage\.getItem\("auth_token"\)/);
  assert.match(authStore, /sessionStorage\.removeItem\("auth_token"\)/);
  assert.doesNotMatch(authStore, /localStorage\.setItem\("auth_token"/);
  assert.match(authStore, /localStorage\.removeItem\("auth_token"\)/);
});

test("company directory queries are scoped to the authenticated user in Rust", () => {
  const companies = read("src-tauri/src/commands/companies.rs");

  assert.match(companies, /pub async fn get_companies\(\s*auth_token: String,/);
  assert.match(companies, /pub async fn get_company_memos\(\s*auth_token: String,/);
  assert.match(companies, /validate_session_token\(auth_token\)/);
  assert.match(companies, /authenticated_company_scope\(&auth_token, &db\)/);
  assert.match(companies, /JOIN user_companies uc ON uc\.company_id = c\.id/);
  assert.match(companies, /JOIN user_companies uc ON uc\.company_id = m\.company_id/);
});

test("role management exposes every server-side business permission resource", () => {
  const roleManager = read("src/pages/settings/RoleManager.tsx");
  const permissions = read("src/lib/usePermission.ts");
  const database = read("src-tauri/src/db.rs");

  for (const resource of [
    "vouchers",
    "invoices",
    "tax",
    "reports",
    "ledger",
    "period",
    "bank",
    "inventory",
    "payroll",
    "settings",
    "users",
  ]) {
    assert.match(roleManager, new RegExp(`key: ['"]${resource}['"]`));
    assert.match(permissions, new RegExp(`['"]${resource}['"]`));
    assert.match(database, new RegExp(`\\(['"]${resource}['"], ['"]view['"]\\)`));
  }
});

test("custom role grants flow from the desktop session into frontend permission checks", () => {
  const auth = read("src-tauri/src/commands/auth.rs");
  const store = read("src/stores/authStore.ts");
  const permissions = read("src/lib/usePermission.ts");

  assert.match(auth, /pub permissions: Vec<PermissionGrant>/);
  assert.match(auth, /load_user_permissions/);
  assert.match(store, /permissions: PermissionGrant\[\]/);
  assert.match(store, /permissions: result\.user\.permissions/);
  assert.match(permissions, /user\?\.permissions/);
  assert.match(permissions, /permission\.resource === resource/);
  assert.match(permissions, /permission\.action === action/);
});

test("member authorization supports secure user creation and password reset", () => {
  const backend = read("src-tauri/src/lib.rs");
  const roles = read("src-tauri/src/commands/roles.rs");
  const roleManager = read("src/pages/settings/RoleManager.tsx");

  assert.match(backend, /commands::roles::create_user/);
  assert.match(backend, /commands::roles::reset_user_password/);
  assert.match(roles, /bcrypt::hash/);
  assert.match(roles, /validate_admin_password/);
  assert.match(roles, /INSERT INTO user_companies/);
  assert.match(roleManager, /invoke\(['"]create_user['"]/);
  assert.match(roleManager, /invoke\(['"]reset_user_password['"]/);
  assert.match(roleManager, /新增成员/);
  assert.match(roleManager, /重置密码/);
});

test("browser-side imports and attachments reject empty or oversized files before parsing", () => {
  const limits = read("src/lib/fileLimits.ts");
  const registry = read("src/lib/localFileRegistry.ts");
  const welcome = read("src/pages/Welcome.tsx");
  const taxWorkspace = read("src/pages/tax/TaxWorkspace.tsx");

  assert.match(limits, /MAX_STRUCTURED_IMPORT_FILE_BYTES\s*=\s*25\s*\*\s*1024\s*\*\s*1024/);
  assert.match(limits, /MAX_LOCAL_ATTACHMENT_FILE_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024/);
  assert.match(limits, /file\.size\s*<=\s*0/);
  assert.match(limits, /file\.size\s*>\s*maxBytes/);
  assert.match(registry, /assertLocalFileWithinLimit\(file, MAX_STRUCTURED_IMPORT_FILE_BYTES, ['"]导入文件['"]\)/);
  assert.match(registry, /assertLocalFileWithinLimit\(input\.file, MAX_LOCAL_ATTACHMENT_FILE_BYTES, ['"]附件['"]\)/);
  assert.match(welcome, /assertLocalFileWithinLimit\(file, MAX_STRUCTURED_IMPORT_FILE_BYTES, ['"]企业档案导入文件['"]\)/);
  assert.match(taxWorkspace, /assertLocalFileWithinLimit\(file, MAX_STRUCTURED_IMPORT_FILE_BYTES, ['"]税务申报初始化文件['"]\)/);
});

test("PDF export sanitizes source markup before it reaches the render host", () => {
  const source = read("src/lib/pdfExport.ts");
  const printPages = [
    "src/components/operations/OperationalExportActions.tsx",
    "src/pages/tax/TaxWorkspace.tsx",
    "src/pages/agency/AgencyModulePage.tsx",
  ].map(read);

  assert.match(source, /import DOMPurify from 'dompurify'/);
  assert.match(source, /export function sanitizePrintableHtml\(/);
  assert.match(source, /DOMPurify\.sanitize\(/);
  assert.doesNotMatch(source, /host\.innerHTML\s*=/);
  for (const page of printPages) {
    assert.match(
      page,
      /import \{ exportHtmlToPdf, sanitizePrintableHtml \} from ['"]\.\.\/\.\.\/lib\/pdfExport['"]/,
    );
    assert.match(page, /\.document\.write\(sanitizePrintableHtml\(/);
  }
});

test("automation artifacts remain outside version control", () => {
  const gitignore = read(".gitignore");

  assert.match(gitignore, /^\.playwright-cli\/$/m);
  assert.match(gitignore, /^output\/$/m);
  assert.match(gitignore, /^src-tauri\/gen\/schemas\/macOS-schema\.json$/m);
});

test("legacy machine-specific browser smoke scripts are removed", () => {
  const legacyScripts = readdirSync(root).filter((file) =>
    /^test-.*\.cjs$/.test(file),
  );
  const guidance = read("CLAUDE.md");

  assert.deepEqual(legacyScripts, []);
  assert.doesNotMatch(guidance, /test-\*\.cjs/);
  assert.match(guidance, /npm run verify:route-content/);
  assert.match(guidance, /npm run verify:routes/);
});

test("build toolchain excludes unused vulnerable packages and preserves Tailwind class dark mode", () => {
  const packageJson = JSON.parse(read("package.json"));
  const viteConfig = read("vite.config.ts");
  const styles = read("src/styles.css");

  assert.equal(packageJson.devDependencies?.sharp, undefined);
  assert.equal(packageJson.dependencies?.recharts, undefined);
  assert.equal(packageJson.devDependencies?.bcryptjs, undefined);
  assert.equal(packageJson.devDependencies?.["better-sqlite3"], undefined);
  assert.equal(packageJson.dependencies?.["@playwright/test"], undefined);
  assert.match(
    packageJson.devDependencies?.["@playwright/test"] || "",
    /^\^1\./,
  );
  assert.equal(packageJson.packageManager, "npm@11.12.1");
  assert.equal(existsSync(join(root, "pnpm-lock.yaml")), false);
  assert.match(packageJson.devDependencies?.tailwindcss || "", /^\^4\./);
  assert.match(
    packageJson.devDependencies?.["@tailwindcss/vite"] || "",
    /^\^4\./,
  );
  assert.equal(
    packageJson.devDependencies?.["@tailwindcss/postcss"],
    undefined,
  );
  assert.match(viteConfig, /from ['\"]@tailwindcss\/vite['\"]/);
  assert.match(viteConfig, /tailwindcss\(\)/);
  assert.match(styles, /@config\s+['\"]\.\.\/tailwind\.config\.js['\"];/);
  assert.match(styles, /@import\s+['\"]tailwindcss['\"];/);
  assert.match(styles, /@custom-variant\s+dark/);
});

test("production build separates the large shared runtime from the application entry", () => {
  const viteConfig = read("vite.config.ts");

  assert.match(viteConfig, /manualChunks/);
  assert.match(viteConfig, /react-vendor/);
  assert.match(viteConfig, /icons-vendor/);
  assert.match(viteConfig, /app-api/);
});

test("build toolchain excludes Vite releases with the launch-editor command injection advisory", () => {
  const packageLock = JSON.parse(read("package-lock.json"));
  const viteVersion = packageLock.packages?.["node_modules/vite"]?.version;
  const [major, minor, patch] = String(viteVersion)
    .split(".")
    .map((part) => Number.parseInt(part, 10));

  assert.ok(
    major > 6 || (major === 6 && (minor > 4 || (minor === 4 && patch >= 4))),
    `Vite ${viteVersion || "missing"} is affected; require 6.4.4 or newer`,
  );
});

test("desktop release manifests and bundle verification share one version", () => {
  const packageJson = JSON.parse(read("package.json"));
  const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargoManifest = read("src-tauri/Cargo.toml");
  const macosVerifier = read("scripts/verify-macos-bundle.mjs");
  const cargoVersion = cargoManifest.match(
    /^version\s*=\s*["']([^"']+)["']/m,
  )?.[1];

  assert.equal(cargoVersion, packageJson.version);
  assert.equal(tauriConfig.version, packageJson.version);
  assert.match(macosVerifier, /tauriConfig\.version/);
  assert.doesNotMatch(macosVerifier, /智能代账系统_0\.1\.0_/);
});

test("release acceptance covers four accounting systems through the auditable close workflow", () => {
  const lib = read("src-tauri/src/lib.rs");
  const acceptance = read("src-tauri/src/release_acceptance.rs");
  const packageJson = JSON.parse(read("package.json"));
  const desktopWorkflow = read(".github/workflows/desktop-build.yml");

  assert.match(lib, /#\[cfg\(test\)\]\s*mod release_acceptance;/);
  assert.match(
    packageJson.scripts?.["verify:release-acceptance"] ?? "",
    /cargo test.*release_acceptance/,
  );
  assert.match(desktopWorkflow, /npm run verify:release-acceptance/);
  for (const accountingSystem of [
    "enterprise",
    "small_enterprise",
    "non_profit",
    "cooperative",
  ]) {
    assert.match(acceptance, new RegExp(`"${accountingSystem}"`));
  }
  for (const workflowCall of [
    "create_invoice",
    "review_output_invoice",
    "create_bank_transaction",
    "create_voucher",
    "match_invoice_to_voucher",
    "approve_voucher",
    "close_period",
    "get_balance_sheet",
    "get_income_statement",
    "upsert_tax_declaration_task",
    "confirm_tax_declaration_task",
    "reopen_period",
    "reverse_approve_voucher",
    "reverse_voucher",
    "operation_audit_logs",
  ]) {
    assert.match(acceptance, new RegExp(workflowCall));
  }
});

test("route shell lazy-loads heavy operating surfaces", () => {
  const app = read("src/App.tsx");

  assert.match(app, /import \{ lazy, Suspense \} from ['"]react['"]/);
  for (const page of [
    "./pages/tax/TaxWorkspace",
    "./pages/agency/AgencyModulePage",
  ]) {
    assert.match(
      app,
      new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*import\\(['\"]${page.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['\"]\\)`,
      ),
    );
  }
  assert.doesNotMatch(app, /pages\/operations\/BusinessModulePage/);
  assert.match(app, /<Suspense\s+fallback=/);
});

test("route visual audit waits for lazy content and captures runtime errors", () => {
  const audit = read("scripts/audit-routes-visual.mjs");

  assert.match(audit, /async function waitForRouteContent\(/);
  assert.match(audit, /async function navigateWithRetry\(/);
  assert.match(audit, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
  assert.match(audit, /document\.querySelector\(['"]main['"]\)/);
  assert.match(audit, /mainTextLength/);
  assert.match(audit, /page\.on\(['"]pageerror['"]/);
  assert.match(audit, /document\.documentElement\?\.classList/);
  assert.doesNotMatch(audit, /await page\.waitForTimeout\(80\)/);
});

test("agency and account download centers expose distinct scopes", () => {
  const agency = read("src/pages/agency/AgencyModulePage.tsx");
  const account = read("src/pages/operations/FileCenterWorkspace.tsx");

  assert.match(agency, /downloadCenter:\s*\{\s*title:\s*['"]机构下载中心['"]/);
  assert.match(account, /title=['"]账套下载中心['"]/);
});

test("route content audit rejects generic duplicate workspaces", () => {
  const packageJson = JSON.parse(read("package.json"));
  const auditFile = "scripts/audit-route-content.mjs";

  assert.equal(existsSync(join(root, auditFile)), true);
  assert.equal(
    packageJson.scripts?.["verify:route-content"],
    `node ${auditFile}`,
  );

  const audit = read(auditFile);
  assert.match(audit, /waitForRouteContent/);
  assert.match(audit, /duplicateContentSignatures/);
  assert.match(audit, /duplicateHeaderSignatures/);
  assert.match(audit, /page\.on\(['"]pageerror['"]/);
  assert.match(audit, /vouchers\/new/);
  assert.match(audit, /vouchers\/edit\/sample-id/);
});

test("source reachability audit rejects orphan implementation files", () => {
  const packageJson = JSON.parse(read("package.json"));
  const auditFile = "scripts/verify-source-reachability.mjs";

  assert.equal(existsSync(join(root, auditFile)), true);
  assert.equal(
    packageJson.scripts?.["verify:source-reachability"],
    `node ${auditFile}`,
  );

  const audit = read(auditFile);
  assert.match(audit, /src\/main\.tsx/);
  assert.match(audit, /unreachable/);
  assert.match(audit, /import\|export/);
});

test("retired generic business module page is removed after dedicated-route migration", () => {
  assert.equal(
    existsSync(join(root, "src/pages/operations/BusinessModulePage.tsx")),
    false,
  );
});

test("retired placeholder settings page is removed after dedicated settings migration", () => {
  assert.equal(existsSync(join(root, "src/pages/Settings.tsx")), false);
  const app = read("src/App.tsx");
  assert.doesNotMatch(app, /pages\/Settings/);
});

test("business module registry is data-only and contains every dedicated module kind", () => {
  const registryFile = "src/pages/operations/businessModuleRegistry.ts";

  assert.equal(existsSync(join(root, registryFile)), true);
  const registrySource = read(registryFile);
  const kindBlock =
    registrySource.match(
      /export const businessModuleKinds = \[([\s\S]*?)\n\] as const/,
    )?.[1] || "";

  assert.equal(
    existsSync(join(root, "src/pages/operations/businessModuleConfig.ts")),
    false,
  );
  assert.equal(
    existsSync(join(root, "src/pages/operations/BusinessModulePage.tsx")),
    false,
  );
  assert.match(
    registrySource,
    /export type ModuleKind = \(typeof businessModuleKinds\)\[number\]/,
  );
  assert.match(registrySource, /export const fixedPrintTemplatePreviews = \[/);
  assert.equal([...kindBlock.matchAll(/^  '[A-Za-z0-9]+',$/gm)].length, 107);
  assert.doesNotMatch(
    registrySource,
    /moduleConfigs|ModuleRow|keywordPlaceholder|from ['"]react['"]|use(State|Effect|Memo|Callback)\(/,
  );
});

test("retired generic workflow panels are removed with the generic shell", () => {
  const panelFile = "src/pages/operations/BusinessModuleWorkflowPanels.tsx";

  assert.equal(existsSync(join(root, panelFile)), false);
  assert.equal(
    existsSync(join(root, "src/pages/operations/BusinessModulePage.tsx")),
    false,
  );
});

test("high-frequency accounting routes use dedicated operational workspaces", () => {
  const app = read("src/App.tsx");
  const businessOrderWorkspaceFile =
    "src/pages/operations/BusinessOrderWorkspace.tsx";
  const purchaseWorkspaceFile =
    "src/pages/operations/PurchaseManagementWorkspace.tsx";
  const salesWorkspaceFile =
    "src/pages/operations/SalesManagementWorkspace.tsx";
  const settlementWorkspaceFile =
    "src/pages/operations/SettlementWorkspace.tsx";
  const receivableSettlementWorkspaceFile =
    "src/pages/operations/ReceivableSettlementWorkspace.tsx";
  const payableSettlementWorkspaceFile =
    "src/pages/operations/PayableSettlementWorkspace.tsx";
  const accountTransferWorkspaceFile =
    "src/pages/operations/AccountTransferWorkspace.tsx";
  const inventoryMovementWorkspaceFile =
    "src/pages/operations/InventoryMovementWorkspace.tsx";
  const costCarryoverWorkspaceFile =
    "src/pages/operations/CostCarryoverWorkspace.tsx";
  const fixedAssetWorkspaceFile =
    "src/pages/operations/FixedAssetWorkspace.tsx";
  const inventoryMasterWorkspaceFile =
    "src/pages/operations/InventoryMasterWorkspace.tsx";
  const measurementUnitWorkspaceFile =
    "src/pages/operations/MeasurementUnitWorkspace.tsx";
  const documentWorkspaceFile =
    "src/pages/operations/DocumentRegisterWorkspace.tsx";
  const bankReconciliationWorkspaceFile =
    "src/pages/operations/BankReconciliationWorkspace.tsx";
  const bankWorkspaceFile = "src/pages/operations/BankStatementWorkspace.tsx";
  const outputInvoiceWorkspaceFile =
    "src/pages/operations/OutputInvoiceWorkspace.tsx";
  const invoiceWorkspaceFile = "src/pages/operations/InputInvoiceWorkspace.tsx";
  const employeeWorkspaceFile = "src/pages/operations/EmployeeWorkspace.tsx";
  const payrollWorkspaceFile = "src/pages/operations/PayrollWorkspace.tsx";
  const socialSecurityWorkspaceFile =
    "src/pages/operations/SocialSecurityWorkspace.tsx";
  const specialDeductionWorkspaceFile =
    "src/pages/operations/SpecialDeductionWorkspace.tsx";

  assert.equal(existsSync(join(root, businessOrderWorkspaceFile)), true);
  assert.equal(existsSync(join(root, purchaseWorkspaceFile)), true);
  assert.equal(existsSync(join(root, salesWorkspaceFile)), true);
  assert.equal(existsSync(join(root, settlementWorkspaceFile)), true);
  assert.equal(existsSync(join(root, receivableSettlementWorkspaceFile)), true);
  assert.equal(existsSync(join(root, payableSettlementWorkspaceFile)), true);
  assert.equal(existsSync(join(root, accountTransferWorkspaceFile)), true);
  assert.equal(existsSync(join(root, inventoryMovementWorkspaceFile)), true);
  assert.equal(existsSync(join(root, costCarryoverWorkspaceFile)), true);
  assert.equal(existsSync(join(root, fixedAssetWorkspaceFile)), true);
  assert.equal(existsSync(join(root, inventoryMasterWorkspaceFile)), true);
  assert.equal(existsSync(join(root, measurementUnitWorkspaceFile)), true);
  assert.equal(existsSync(join(root, documentWorkspaceFile)), true);
  assert.equal(existsSync(join(root, bankReconciliationWorkspaceFile)), true);
  assert.equal(existsSync(join(root, bankWorkspaceFile)), true);
  assert.equal(existsSync(join(root, outputInvoiceWorkspaceFile)), true);
  assert.equal(existsSync(join(root, invoiceWorkspaceFile)), true);
  assert.equal(existsSync(join(root, employeeWorkspaceFile)), true);
  assert.equal(existsSync(join(root, payrollWorkspaceFile)), true);
  assert.equal(existsSync(join(root, socialSecurityWorkspaceFile)), true);
  assert.equal(existsSync(join(root, specialDeductionWorkspaceFile)), true);
  for (const workspace of [
    "PurchaseManagementWorkspace",
    "SalesManagementWorkspace",
    "ReceivableSettlementWorkspace",
    "PayableSettlementWorkspace",
    "AccountTransferWorkspace",
    "InventoryMovementWorkspace",
    "CostCarryoverWorkspace",
    "FixedAssetWorkspace",
    "InventoryMasterWorkspace",
    "MeasurementUnitWorkspace",
    "DocumentRegisterWorkspace",
    "BankReconciliationWorkspace",
    "BankStatementWorkspace",
    "OutputInvoiceWorkspace",
    "InputInvoiceWorkspace",
    "EmployeeWorkspace",
    "PayrollWorkspace",
    "SocialSecurityWorkspace",
    "SpecialDeductionWorkspace",
  ]) {
    assert.match(
      app,
      new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*import\\(['"]\\.\\/pages\\/operations\\/${workspace}['"]\\)`,
      ),
    );
  }
  assert.match(
    app,
    /path="\/purchase" element={<PurchaseManagementWorkspace \/>}/,
  );
  assert.match(app, /path="\/sales" element={<SalesManagementWorkspace \/>}/);
  assert.match(
    app,
    /path="\/settlement\/receivable" element={<ReceivableSettlementWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settlement\/payable" element={<PayableSettlementWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/transfers" element={<AccountTransferWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/inventory\/movements" element={<InventoryMovementWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/cost-carryover" element={<CostCarryoverWorkspace \/>}/,
  );
  assert.match(app, /path="\/depreciation" element={<FixedAssetWorkspace \/>}/);
  assert.match(
    app,
    /path="\/inventory" element={<InventoryMasterWorkspace \/>}/,
  );
  assert.match(app, /path="\/units" element={<MeasurementUnitWorkspace \/>}/);
  assert.match(
    app,
    /path="\/documents" element={<DocumentRegisterWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/bank\/reconciliation" element={<BankReconciliationWorkspace \/>}/,
  );
  assert.match(app, /path="\/bank" element={<BankStatementWorkspace \/>}/);
  assert.match(
    app,
    /path="\/invoices\/output" element={<OutputInvoiceWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/invoices\/input" element={<InputInvoiceWorkspace \/>}/,
  );
  assert.match(app, /path="\/employees" element={<EmployeeWorkspace \/>}/);
  assert.match(app, /path="\/payroll" element={<PayrollWorkspace \/>}/);
  assert.match(
    app,
    /path="\/social-security" element={<SocialSecurityWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/special-deductions" element={<SpecialDeductionWorkspace \/>}/,
  );

  const businessOrderWorkspace = read(businessOrderWorkspaceFile);
  assert.match(businessOrderWorkspace, /businessOrderApi\.getBusinessOrders\(/);
  assert.match(
    businessOrderWorkspace,
    /businessOrderApi\.createBusinessOrder\(/,
  );
  assert.match(
    businessOrderWorkspace,
    /businessOrderApi\.updateBusinessOrder\(/,
  );
  assert.match(businessOrderWorkspace, /待入库/);
  assert.match(businessOrderWorkspace, /待出库/);
  assert.match(businessOrderWorkspace, /不自动生成或过账凭证/);
  assert.match(
    read(purchaseWorkspaceFile),
    /export function PurchaseManagementWorkspace\(\)/,
  );
  assert.match(
    read(salesWorkspaceFile),
    /export function SalesManagementWorkspace\(\)/,
  );

  const settlementWorkspace = read(settlementWorkspaceFile);
  assert.match(
    settlementWorkspace,
    /settlementRecordApi\.getSettlementRecords\(/,
  );
  assert.match(
    settlementWorkspace,
    /settlementRecordApi\.createSettlementRecord\(/,
  );
  assert.match(
    settlementWorkspace,
    /settlementRecordApi\.updateSettlementRecord\(/,
  );
  assert.match(settlementWorkspace, /应收核销/);
  assert.match(settlementWorkspace, /应付核销/);
  assert.match(settlementWorkspace, /不自动生成或过账凭证/);
  assert.match(
    read(receivableSettlementWorkspaceFile),
    /export function ReceivableSettlementWorkspace\(\)/,
  );
  assert.match(
    read(payableSettlementWorkspaceFile),
    /export function PayableSettlementWorkspace\(\)/,
  );

  const accountTransferWorkspace = read(accountTransferWorkspaceFile);
  assert.match(
    accountTransferWorkspace,
    /accountTransferApi\.getAccountTransfers\(/,
  );
  assert.match(
    accountTransferWorkspace,
    /accountTransferApi\.createAccountTransfer\(/,
  );
  assert.match(
    accountTransferWorkspace,
    /accountTransferApi\.updateAccountTransfer\(/,
  );
  assert.match(accountTransferWorkspace, /转出账户/);
  assert.match(accountTransferWorkspace, /转入账户/);
  assert.match(accountTransferWorkspace, /不自动生成或过账凭证/);
  assert.match(
    accountTransferWorkspace,
    /export function AccountTransferWorkspace\(\)/,
  );

  const inventoryMovementWorkspace = read(inventoryMovementWorkspaceFile);
  assert.match(
    inventoryMovementWorkspace,
    /inventoryMovementApi\.getInventoryMovements\(/,
  );
  assert.match(
    inventoryMovementWorkspace,
    /inventoryMovementApi\.createInventoryMovement\(/,
  );
  assert.match(
    inventoryMovementWorkspace,
    /inventoryMovementApi\.updateInventoryMovement\(/,
  );
  assert.match(inventoryMovementWorkspace, /采购入库/);
  assert.match(inventoryMovementWorkspace, /销售出库/);
  assert.match(inventoryMovementWorkspace, /不自动生成或过账凭证/);
  assert.match(
    inventoryMovementWorkspace,
    /export function InventoryMovementWorkspace\(\)/,
  );

  const costCarryoverWorkspace = read(costCarryoverWorkspaceFile);
  assert.match(
    costCarryoverWorkspace,
    /costCarryoverApi\.getCostCarryoverRecords\(/,
  );
  assert.doesNotMatch(
    costCarryoverWorkspace,
    /costCarryoverApi\.createCostCarryoverRecord\(/,
  );
  assert.match(costCarryoverWorkspace, /选择已核验出库/);
  assert.match(
    costCarryoverWorkspace,
    /costCarryoverApi\.updateCostCarryoverRecord\(/,
  );
  assert.match(costCarryoverWorkspace, /移动加权/);
  assert.match(costCarryoverWorkspace, /可生成待复核凭证草稿/);
  assert.match(
    costCarryoverWorkspace,
    /export function CostCarryoverWorkspace\(\)/,
  );

  const fixedAssetWorkspace = read(fixedAssetWorkspaceFile);
  assert.match(fixedAssetWorkspace, /fixedAssetApi\.getFixedAssets\(/);
  assert.match(fixedAssetWorkspace, /fixedAssetApi\.createFixedAsset\(/);
  assert.match(fixedAssetWorkspace, /fixedAssetApi\.updateFixedAsset\(/);
  assert.match(fixedAssetWorkspace, /直线法/);
  assert.match(fixedAssetWorkspace, /生成折旧凭证/);
  assert.match(fixedAssetWorkspace, /export function FixedAssetWorkspace\(\)/);

  const inventoryMasterWorkspace = read(inventoryMasterWorkspaceFile);
  assert.match(
    inventoryMasterWorkspace,
    /inventoryItemApi\.getInventoryItems\(/,
  );
  assert.match(
    inventoryMasterWorkspace,
    /inventoryItemApi\.createInventoryItem\(/,
  );
  assert.match(
    inventoryMasterWorkspace,
    /inventoryItemApi\.updateInventoryItem\(/,
  );
  assert.match(inventoryMasterWorkspace, /默认科目/);
  assert.match(inventoryMasterWorkspace, /不自动生成或过账凭证/);
  assert.match(
    inventoryMasterWorkspace,
    /export function InventoryMasterWorkspace\(\)/,
  );

  const measurementUnitWorkspace = read(measurementUnitWorkspaceFile);
  assert.match(
    measurementUnitWorkspace,
    /measurementUnitApi\.getMeasurementUnits\(/,
  );
  assert.match(
    measurementUnitWorkspace,
    /measurementUnitApi\.createMeasurementUnit\(/,
  );
  assert.match(
    measurementUnitWorkspace,
    /measurementUnitApi\.updateMeasurementUnit\(/,
  );
  assert.match(measurementUnitWorkspace, /换算倍率/);
  assert.match(measurementUnitWorkspace, /不自动生成或过账凭证/);
  assert.match(
    measurementUnitWorkspace,
    /export function MeasurementUnitWorkspace\(\)/,
  );

  const documentWorkspace = read(documentWorkspaceFile);
  assert.match(documentWorkspace, /documentRecordApi\.getDocumentRecords\(/);
  assert.match(documentWorkspace, /documentRecordApi\.createDocumentRecord\(/);
  assert.match(documentWorkspace, /documentRecordApi\.updateDocumentRecord\(/);
  assert.match(documentWorkspace, /aria-label="单据登记编辑"/);
  assert.match(documentWorkspace, /不自动生成或过账凭证/);

  const bankReconciliationWorkspace = read(bankReconciliationWorkspaceFile);
  assert.match(
    bankReconciliationWorkspace,
    /bankReconciliationApi\.getBankReconciliationRecords\(/,
  );
  assert.match(
    bankReconciliationWorkspace,
    /bankReconciliationApi\.createBankReconciliationRecord\(/,
  );
  assert.match(
    bankReconciliationWorkspace,
    /bankReconciliationApi\.updateBankReconciliationRecord\(/,
  );
  assert.match(
    bankReconciliationWorkspace,
    /bankTransactionApi\.getBankTransactions\(/,
  );
  assert.match(bankReconciliationWorkspace, /aria-label="银行对账编辑"/);
  assert.match(bankReconciliationWorkspace, /不读取或调用银行外部系统/);

  const bankWorkspace = read(bankWorkspaceFile);
  assert.match(bankWorkspace, /bankTransactionApi\.getBankTransactions\(/);
  assert.match(bankWorkspace, /bankTransactionApi\.createBankTransaction\(/);
  assert.match(bankWorkspace, /bankTransactionApi\.updateBankTransaction\(/);
  assert.match(bankWorkspace, /aria-label="银行流水编辑"/);
  assert.match(bankWorkspace, /不登录或调用银行外部系统/);

  const outputInvoiceWorkspace = read(outputInvoiceWorkspaceFile);
  assert.match(
    outputInvoiceWorkspace,
    /invoiceApi\.getAll\(companyId, 'output', currentPeriodId \|\| undefined\)/,
  );
  assert.match(outputInvoiceWorkspace, /invoiceApi\.create\(/);
  assert.match(outputInvoiceWorkspace, /invoiceApi\.updateWithLines\(/);
  assert.match(outputInvoiceWorkspace, /aria-label="销项发票编辑"/);
  assert.match(outputInvoiceWorkspace, /不发起税局开票、红冲或申报/);

  const invoiceWorkspace = read(invoiceWorkspaceFile);
  assert.match(invoiceWorkspace, /invoiceApi\.getAll\(/);
  assert.match(invoiceWorkspace, /invoiceApi\.create\(/);
  assert.match(invoiceWorkspace, /invoiceApi\.updateWithLines\(/);
  assert.match(invoiceWorkspace, /aria-label="进项发票编辑"/);

  const employeeWorkspace = read(employeeWorkspaceFile);
  assert.match(employeeWorkspace, /employeeApi\.getEmployees\(/);
  assert.match(employeeWorkspace, /employeeApi\.createEmployee\(/);
  assert.match(employeeWorkspace, /employeeApi\.updateEmployee\(/);
  assert.match(employeeWorkspace, /aria-label="人员档案编辑"/);

  const payrollWorkspace = read(payrollWorkspaceFile);
  assert.match(payrollWorkspace, /payrollApi\.getPayrollRecords\(/);
  assert.match(payrollWorkspace, /payrollApi\.createPayrollRecord\(/);
  assert.match(payrollWorkspace, /payrollApi\.updatePayrollRecord\(/);
  assert.match(payrollWorkspace, /employeeApi\.getEmployees\(/);
  assert.match(payrollWorkspace, /aria-label="薪酬行编辑"/);

  const socialSecurityWorkspace = read(socialSecurityWorkspaceFile);
  assert.match(
    socialSecurityWorkspace,
    /socialSecurityApi\.getSocialSecurityRecords\(/,
  );
  assert.match(
    socialSecurityWorkspace,
    /socialSecurityApi\.createSocialSecurityRecord\(/,
  );
  assert.match(
    socialSecurityWorkspace,
    /socialSecurityApi\.updateSocialSecurityRecord\(/,
  );
  assert.match(socialSecurityWorkspace, /employeeApi\.getEmployees\(/);
  assert.match(socialSecurityWorkspace, /aria-label="社保缴费编辑"/);

  const specialDeductionWorkspace = read(specialDeductionWorkspaceFile);
  assert.match(
    specialDeductionWorkspace,
    /specialDeductionApi\.getSpecialDeductionRecords\(/,
  );
  assert.match(
    specialDeductionWorkspace,
    /specialDeductionApi\.createSpecialDeductionRecord\(/,
  );
  assert.match(
    specialDeductionWorkspace,
    /specialDeductionApi\.updateSpecialDeductionRecord\(/,
  );
  assert.match(specialDeductionWorkspace, /employeeApi\.getEmployees\(/);
  assert.match(specialDeductionWorkspace, /aria-label="专项附加扣除编辑"/);
});

test("period-scoped workspaces do not invent a browser preview period", () => {
  const periodScopedWorkspaceFiles = [
    "src/pages/operations/PayrollWorkspace.tsx",
    "src/pages/operations/SocialSecurityWorkspace.tsx",
    "src/pages/operations/SpecialDeductionWorkspace.tsx",
    "src/pages/operations/BankStatementWorkspace.tsx",
    "src/pages/operations/BankReconciliationWorkspace.tsx",
    "src/pages/operations/CostCarryoverWorkspace.tsx",
  ];

  for (const file of periodScopedWorkspaceFiles) {
    const workspace = read(file);
    assert.match(
      workspace,
      /from ['"]\.\.\/\.\.\/lib\/browserPreviewPeriod['"]/,
    );
    assert.match(
      workspace,
      /loadBrowserPreviewOpenPeriod\(selectedCompanyId\)/,
    );
    assert.doesNotMatch(workspace, /isTauri \? null : '2026-05'/);
  }

  const previewPeriod = read("src/lib/browserPreviewPeriod.ts");
  assert.match(previewPeriod, /accounting-preview-periods-v1/);
  assert.match(previewPeriod, /findLatestOpenBrowserPreviewPeriod/);
  const previewPeriods = read("src/lib/browserPreviewPeriods.js");
  assert.match(previewPeriods, /period\.company_id === companyId/);
  assert.match(previewPeriods, /period\.status !== 'closed'/);
});

test("dedicated operational tables do not depend on horizontal scrolling", () => {
  const workspaceFiles = [
    "src/pages/operations/BankReconciliationWorkspace.tsx",
    "src/pages/operations/BankStatementWorkspace.tsx",
    "src/pages/operations/DocumentRegisterWorkspace.tsx",
    "src/pages/operations/EmployeeWorkspace.tsx",
    "src/pages/operations/InputInvoiceWorkspace.tsx",
    "src/pages/operations/OutputInvoiceWorkspace.tsx",
    "src/pages/operations/PayrollWorkspace.tsx",
    "src/pages/operations/SocialSecurityWorkspace.tsx",
    "src/pages/operations/SpecialDeductionWorkspace.tsx",
  ];

  for (const file of workspaceFiles) {
    const workspace = read(file);
    assert.doesNotMatch(workspace, /hidden overflow-x-auto lg:block/);
    assert.doesNotMatch(workspace, /min-w-\[\d+px\]/);
    assert.match(workspace, /table className="w-full table-fixed/);
  }
});

test("dedicated browser previews do not use the retired mock company identifier", () => {
  const workspaceFiles = [
    "src/pages/operations/BankReconciliationWorkspace.tsx",
    "src/pages/operations/BankStatementWorkspace.tsx",
    "src/pages/operations/EmployeeWorkspace.tsx",
    "src/pages/operations/InputInvoiceWorkspace.tsx",
    "src/pages/operations/OutputInvoiceWorkspace.tsx",
    "src/pages/operations/PayrollWorkspace.tsx",
    "src/pages/operations/SocialSecurityWorkspace.tsx",
    "src/pages/operations/SpecialDeductionWorkspace.tsx",
  ];

  for (const file of workspaceFiles) {
    const workspace = read(file);
    assert.doesNotMatch(workspace, /'mock-1'/);
    assert.match(
      workspace,
      /isTauri\s*\?\s*null\s*:\s*["']browser-preview-company["']/,
    );
  }
});

test("account-code settings use a dedicated, persisted operational workspace", () => {
  const app = read("src/App.tsx");
  const workspace = read("src/pages/operations/AccountCodeWorkspace.tsx");

  assert.match(app, /import\('\.\/pages\/operations\/AccountCodeWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/account-codes" element={<AccountCodeWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-account-code-data-v1/);
  assert.match(workspace, /useAccountStore/);
  assert.match(workspace, /toggleAccount/);
  assert.match(workspace, /deleteAccount/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("asset-category settings use a dedicated, persisted operational workspace", () => {
  const app = read("src/App.tsx");
  const workspace = read("src/pages/operations/AssetCategoryWorkspace.tsx");

  assert.match(
    app,
    /import\('\.\/pages\/operations\/AssetCategoryWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/asset-categories" element={<AssetCategoryWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-asset-categories-v1/);
  assert.match(workspace, /useAssetCategoryStore/);
  assert.match(workspace, /toggleAssetCategory/);
  assert.match(workspace, /deleteAssetCategory/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("period management uses a dedicated workspace with explicit close and reopen boundaries", () => {
  const app = read("src/App.tsx");
  const workspace = read("src/pages/operations/PeriodManagementWorkspace.tsx");

  assert.match(
    app,
    /import\('\.\/pages\/operations\/PeriodManagementWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/period-management" element={<PeriodManagementWorkspace \/>} \/>/,
  );
  assert.match(workspace, /usePeriodStore/);
  assert.match(workspace, /closePeriod/);
  assert.match(workspace, /reopenPeriod/);
  assert.doesNotMatch(workspace, /localStorage/);
  assert.match(workspace, /强制验证结转规则、草稿凭证、试算平衡和账表勾稽/);
  assert.match(workspace, /反结账须按逆序执行并写入高风险审计记录/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("digest and voucher-template settings use dedicated operations with persisted preview data", () => {
  const app = read("src/App.tsx");
  const workspace = read("src/pages/operations/TemplateSettingsWorkspace.tsx");

  assert.match(
    app,
    /import\('\.\/pages\/operations\/TemplateSettingsWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/common-digests" element={<CommonDigestWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/voucher-templates" element={<VoucherTemplateWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-common-digests-v1/);
  assert.match(workspace, /accounting-preview-voucher-templates-v1/);
  assert.match(workspace, /accounting-preview-voucher-template-types-v1/);
  assert.match(workspace, /createCommonDigest/);
  assert.match(workspace, /createVoucherTemplate/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("currency settings use a dedicated workspace with base-currency and exchange-adjustment boundaries", () => {
  const app = read("src/App.tsx");
  const workspace = read("src/pages/operations/CurrencyWorkspace.tsx");

  assert.match(app, /import\('\.\/pages\/operations\/CurrencyWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/currencies" element={<CurrencyWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-currencies-v1/);
  assert.match(workspace, /useCurrencyStore/);
  assert.match(workspace, /calculateExchangeAdjustment/);
  assert.match(workspace, /本位币不能删除/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("auxiliary category and item settings use dedicated dimension workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/AuxiliaryWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);

  assert.match(app, /import\('\.\/pages\/operations\/AuxiliaryWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/auxiliary-categories" element={<AuxiliaryCategoryWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/auxiliary-items" element={<AuxiliaryItemWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-auxiliary-archives-v2/);
  assert.match(workspace, /useAuxiliaryStore/);
  assert.match(workspace, /系统预置辅助核算类别不能删除/);
  assert.match(workspace, /toggleItem/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("settlement rules use a dedicated workspace with execution boundaries", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/SettlementRuleWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/SettlementRuleWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/settlement-rules" element={<SettlementRuleWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-settlement-rules-v1/);
  assert.match(workspace, /useSettlementRuleStore/);
  assert.match(workspace, /不会自动生成或过账结转凭证/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("matching rule settings use scoped dedicated workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/MatchingRuleWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/MatchingRuleWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/invoice-rules" element={<InvoiceMatchingRuleWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/bill-rules" element={<BillMatchingRuleWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/cash-flow-mapping" element={<CashFlowMappingWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-matching-rules-v1/);
  assert.match(workspace, /useMatchingRuleStore/);
  assert.match(workspace, /不会自动生成已审核凭证/);
  assert.match(workspace, /不会自动改写历史报表/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("report formulas use a dedicated template-aware workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/ReportFormulaWorkspace.tsx";
  const reportStore = read("src/stores/reportTemplateStore.ts");

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/ReportFormulaWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/report-formulas" element={<ReportFormulaWorkspace \/>} \/>/,
  );
  assert.match(workspace, /accounting-preview-report-formulas-v1/);
  assert.match(workspace, /useReportTemplateStore/);
  assert.match(workspace, /不会自动覆盖历史已归档报表/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.match(reportStore, /deleteReportItem/);
});

test("tax and bank adapter settings use bounded authorization workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile =
    "src/pages/operations/AdapterAuthorizationWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/AdapterAuthorizationWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/tax-adapters" element={<TaxAdapterWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/bank-adapters" element={<BankAdapterWorkspace \/>} \/>/,
  );
  assert.match(workspace, /automationApi\.getAdapterAuthorizations/);
  assert.match(workspace, /automationApi\.upsertAdapterAuthorization/);
  assert.match(workspace, /不能在此页面发起税务提交/);
  assert.match(workspace, /不能在此页面登录网银、发起付款/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("browser adapter preview keeps authorization records scoped by channel code", () => {
  const tauri = read("src/lib/tauri.ts");

  assert.match(
    tauri,
    /item\.company_id === asPreviewText\(input\.company_id, firstCompanyId\)[\s\S]*?item\.adapter_type === asPreviewText\(input\.adapter_type, ["']tax["']\)[\s\S]*?item\.adapter_code === asPreviewText\(input\.adapter_code/,
  );
});

test("counterparty and dimension archives use dedicated profile workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/ArchiveProfileWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/ArchiveProfileWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/customers" element={<CustomerArchiveWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/suppliers" element={<SupplierArchiveWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/other-contacts" element={<OtherContactArchiveWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/projects" element={<ProjectArchiveWorkspace \/>} \/>/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/departments" element={<DepartmentArchiveWorkspace \/>} \/>/,
  );
  assert.match(workspace, /useAuxiliaryStore/);
  assert.match(workspace, /serializeAuxiliaryArchiveProfile/);
  assert.match(workspace, /客户档案影响销项发票、收款核销和应收辅助账/);
  assert.match(workspace, /供应商档案影响进项发票识别、付款核销和应付辅助账/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("company account archive uses a dedicated multi-account workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/CompanyAccountWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/CompanyAccountWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/accounts" element={<CompanyAccountWorkspace \/>} \/>/,
  );
  assert.match(workspace, /useCompanyAccountStore/);
  assert.match(workspace, /accounting-preview-company-accounts-v2/);
  assert.match(workspace, /不会登录银行或发起付款/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("contract ledger uses a dedicated contract lifecycle workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/ContractLedgerWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/ContractLedgerWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/contracts" element={<ContractLedgerWorkspace \/>} \/>/,
  );
  assert.match(workspace, /documentRecordApi/);
  assert.match(workspace, /accounting-preview-document-business-data-v2/);
  assert.match(workspace, /合同台账不替代合同审批或税务申报确认/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("business tags use a dedicated scoped archive workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/BusinessTagWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/BusinessTagWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/tags" element={<BusinessTagWorkspace \/>} \/>/,
  );
  assert.match(workspace, /useBusinessTagStore/);
  assert.match(workspace, /loadBrowserPreviewBusinessTags as loadPreviewTags/);
  assert.match(workspace, /saveBrowserPreviewBusinessTags as savePreviewTags/);
  assert.match(
    read("src/lib/browserPreviewBusinessTags.js"),
    /accounting-preview-business-tags-v1/,
  );
  assert.match(workspace, /标签只用于本地筛选、人工跟踪和风险提示/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("voucher recycle uses a dedicated recovery-only workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/VoucherRecycleWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/VoucherRecycleWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/voucher-recycle" element={<VoucherRecycleWorkspace \/>} \/>/,
  );
  assert.match(workspace, /useVoucherStore/);
  assert.match(workspace, /getDeletedVouchers\(companyId\)/);
  assert.match(workspace, /restoreVoucher\(voucher\.id, companyId\)/);
  assert.doesNotMatch(workspace, /accounting-preview-invoice-voucher-core-data-v2/);
  assert.match(workspace, /恢复操作只会取消软删除标记并恢复到原有凭证状态/);
  assert.match(workspace, /table className="w-full table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /permanentDeleteVoucher/);
});

test("company information uses a dedicated scoped profile workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/CompanyInfoWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/CompanyInfoWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/company-info" element={<CompanyInfoWorkspace \/>} \/>/,
  );
  assert.match(workspace, /useCompanyStore/);
  assert.match(workspace, /accounting-preview-company-info-v1/);
  assert.match(workspace, /不会保存税局、个税或工商密码/);
  assert.match(workspace, /updateCompany\(selectedCompanyId, input\)/);
  assert.match(workspace, /sm:grid-cols-2/);
});

test("audit logs use a dedicated immutable review workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/AuditLogWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/AuditLogWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/settings\/audit-log" element={<AuditLogWorkspace \/>} \/>/,
  );
  assert.match(workspace, /automationApi\.getOperationAuditLogs/);
  assert.match(workspace, /useAuditLogs/);
  assert.match(workspace, /不提供新增、修改、删除或覆盖历史记录/);
  assert.doesNotMatch(workspace, /writeOperationAuditLog/);
  assert.match(workspace, /lg:hidden/);
});

test("backup restoration verifies and schedules a restart-safe database replacement", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/BackupRestoreWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/BackupRestoreWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/backup-restore" element={<BackupRestoreWorkspace \/>} \/>/,
  );
  assert.match(workspace, /backupApi\.createLocalBackup/);
  assert.match(workspace, /backupApi\.listLocalBackups/);
  assert.match(workspace, /backupApi\.verifyLocalBackup/);
  assert.match(workspace, /backupApi\.scheduleLocalBackupRestore/);
  assert.match(workspace, /下次启动|重新打开应用/);
  assert.match(workspace, /window\.confirm/);
  assert.match(workspace, /lg:hidden/);
});

test("declaration calendar uses a dedicated tax schedule workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/tax/DeclarationCalendarWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/tax\/DeclarationCalendarWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/tax\/calendar" element={<DeclarationCalendarWorkspace \/>} \/>/,
  );
  assert.match(workspace, /automationApi\.getTaxDeclarationTasks/);
  assert.match(workspace, /loadBrowserPreviewOpenPeriod/);
  assert.match(workspace, /不会登录税局、提交申报或发起扣款/);
  assert.doesNotMatch(workspace, /confirmTaxDeclarationTask/);
  assert.match(workspace, /lg:hidden/);
});

test("print templates use a dedicated fixed-layout workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/PrintTemplateWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/PrintTemplateWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/settings\/print-templates" element={<PrintTemplateWorkspace \/>} \/>/,
  );
  assert.match(workspace, /fixedPrintTemplatePreviews/);
  assert.match(workspace, /不能在此页伪造可编辑的版式配置/);
  assert.doesNotMatch(workspace, /保存模板/);
  assert.match(workspace, /lg:hidden/);
});

test("voucher list uses a dedicated period-scoped operations workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/VoucherWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/VoucherWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/vouchers" element={<VoucherWorkspace \/>} \/>/,
  );
  assert.match(
    workspace,
    /queryVouchers\(\{ company_id: companyId, period_id: periodId/,
  );
  assert.match(workspace, /approveVoucher\(voucher\.id, companyId\)/);
  assert.match(workspace, /reverseApproveVoucher\(voucher\.id, companyId\)/);
  assert.match(workspace, /batchApprove\(selectedIds, companyId\)/);
  assert.match(workspace, /已结账账期不允许反审核/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("voucher detail uses a dedicated entry and audit review workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/VoucherDetailWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/VoucherDetailWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/vouchers\/detail\/:id" element={<VoucherDetailWorkspace \/>} \/>/,
  );
  assert.match(workspace, /getVoucher\(voucherId, companyId\)/);
  assert.match(workspace, /getVoucherEntries\(nextVoucher\.id\)/);
  assert.match(workspace, /getVoucherLogs\(nextVoucher\.id\)/);
  assert.match(workspace, /浏览器预览的凭证操作仅写入本机预览数据/);
  assert.match(workspace, /不会提交税局、银行或其他外部系统/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("risk check uses a dedicated scoped analysis workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/RiskCheckWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/RiskCheckWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/risk-check" element={<RiskCheckWorkspace \/>} \/>/,
  );
  assert.match(
    workspace,
    /fetchInvoices\(\{\s*company_id:\s*companyId,\s*period_id:\s*periodId,?\s*\}\)/,
  );
  assert.match(
    workspace,
    /queryVouchers\(\{\s*company_id:\s*companyId,\s*period_id:\s*periodId,\s*page:\s*1,\s*page_size:\s*100,?\s*\}\)/,
  );
  assert.match(workspace, /mapLiveRiskCheckRows\(vouchers, invoices\)/);
  assert.doesNotMatch(workspace, /accounting-preview-invoice-voucher-core-data-v2/);
  assert.match(workspace, /风险页不会直接改写会计数据/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("invoice voucher matching uses a dedicated candidate review workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile =
    "src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/InvoiceVoucherMatchingWorkspace'\)/,
  );
  assert.match(
    app,
    /<Route path="\/matching" element={<InvoiceVoucherMatchingWorkspace \/>} \/>/,
  );
  assert.match(
    workspace,
    /fetchInvoices\(\{\s*company_id:\s*companyId,\s*period_id:\s*periodId,?\s*\}\)/,
  );
  assert.match(
    workspace,
    /queryVouchers\(\{\s*company_id:\s*companyId,\s*period_id:\s*periodId,\s*page:\s*1,\s*page_size:\s*100,?\s*\}\)/,
  );
  assert.match(
    workspace,
    /matchInvoiceToVoucher\(\s*selectedInvoiceId,\s*selectedVoucherId,\s*companyId,?\s*\)/,
  );
  assert.doesNotMatch(workspace, /accounting-preview-invoice-voucher-core-data-v2/);
  assert.doesNotMatch(workspace, /人工关联需在桌面应用中执行/);
  assert.doesNotMatch(workspace, /canMatch = Boolean\(\s*isTauri/);
  assert.match(workspace, /浏览器预览的关联操作仅更新本机预览数据/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("aging uses a dedicated settlement-risk review workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/AgingWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/AgingWorkspace'\)/);
  assert.match(app, /<Route path="\/aging" element={<AgingWorkspace \/>} \/>/);
  assert.match(
    workspace,
    /settlementRecordApi\.getSettlementRecords\(\{\s*companyId,\s*period:\s*periodLabel,\s*settlementType:\s*["']receivable["'],?\s*\}\)/,
  );
  assert.match(
    workspace,
    /settlementRecordApi\.getSettlementRecords\(\{\s*companyId,\s*period:\s*periodLabel,\s*settlementType:\s*["']payable["'],?\s*\}\)/,
  );
  assert.match(workspace, /浏览器预览仅展示本地核销账龄/);
  assert.match(workspace, /const risk:\s*AgingRow\[["']risk["']\]\s*=/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("ledger reports use dedicated report workspaces with report-specific sources", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/LedgerReportWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/LedgerReportWorkspace'\)/);
  for (const [path, component] of [
    ["/reports/ledgers", "LedgerOverviewWorkspace"],
    ["/reports/trial-balance", "TrialBalanceWorkspace"],
    ["/reports/account-summary", "AccountSummaryWorkspace"],
    ["/reports/general-ledger", "GeneralLedgerWorkspace"],
    ["/reports/multi-column-ledger", "MultiColumnLedgerWorkspace"],
  ]) {
    assert.match(
      app,
      new RegExp(`<Route path="${path}" element={<${component} />} />`),
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(workspace, /fetchTrialBalance\(periodId\)/);
  assert.match(workspace, /getGeneralLedger\(periodId\)/);
  assert.match(workspace, /账簿页仅查询当前账套与账期/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("detailed and auxiliary ledgers use dedicated scoped review workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/LedgerDetailWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/LedgerDetailWorkspace'\)/);
  for (const [path, component] of [
    ["/reports/subsidiary-ledger", "SubsidiaryLedgerWorkspace"],
    ["/reports/auxiliary-ledger", "AuxiliaryLedgerWorkspace"],
    ["/reports/auxiliary-balance", "AuxiliaryBalanceWorkspace"],
  ]) {
    assert.match(
      app,
      new RegExp(`<Route path="${path}" element={<${component} />} />`),
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    workspace,
    /getSubsidiaryLedger\(periodId, selectedAccountCode\)/,
  );
  assert.match(
    workspace,
    /fetchAuxiliaryLedger\(\{\s*auxiliary_item_id:\s*selectedItemId,\s*company_id:\s*selectedCompanyId,\s*period_id:\s*periodId,?\s*\}\)/,
  );
  assert.match(
    workspace,
    /fetchAuxiliaryBalance\(\s*selectedCategoryId,\s*periodId,\s*selectedCompanyId,?\s*\)/,
  );
  assert.match(workspace, /账簿页仅查询当前账套与账期/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("financial statements use dedicated statement workspaces with distinct report sources", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/FinancialStatementWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /import\('\.\/pages\/operations\/FinancialStatementWorkspace'\)/,
  );
  for (const [path, component] of [
    ["/reports", "FinancialOverviewWorkspace"],
    ["/reports/balance-sheet", "BalanceSheetWorkspace"],
    ["/reports/income-statement", "IncomeStatementWorkspace"],
    ["/reports/income-quarter", "IncomeQuarterWorkspace"],
    ["/reports/cash-flow", "CashFlowWorkspace"],
    ["/reports/cash-flow-quarter", "CashFlowQuarterWorkspace"],
    ["/reports/equity-change", "EquityChangeWorkspace"],
  ]) {
    assert.match(
      app,
      new RegExp(`<Route path="${path}" element={<${component} />} />`),
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(workspace, /getBalanceSheet\(periodId\)/);
  assert.match(workspace, /quarterPeriods\(periods, periodId\)/);
  assert.match(
    workspace,
    /incomePeriodIds\.map\(\(id\) => getIncomeStatement\(id\)\)/,
  );
  assert.match(
    workspace,
    /cashFlowPeriodIds\.map\(\(id\) => getCashFlowStatement\(id\)\)/,
  );
  assert.match(workspace, /aggregateIncomeQuarter\(nextIncomeStatements\)/);
  assert.match(workspace, /aggregateCashFlowQuarter\(nextCashFlowStatements\)/);
  assert.match(workspace, /报表页仅查询当前账套与账期/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("tax declaration reports use dedicated task and receipt workspaces with tax-specific views", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/tax/TaxReportWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/tax\/TaxReportWorkspace'\)/);
  for (const [path, component] of [
    ["/tax/reports", "TaxReportOverviewWorkspace"],
    ["/tax/vat", "VatTaxReportWorkspace"],
    ["/tax/withholding", "WithholdingTaxReportWorkspace"],
    ["/tax/stamp", "StampTaxReportWorkspace"],
    ["/tax/income", "IncomeTaxReportWorkspace"],
    ["/tax/social-security", "SocialSecurityTaxReportWorkspace"],
    ["/tax/finance-report", "FinanceTaxReportWorkspace"],
    ["/tax/non-tax", "NonTaxRevenueReportWorkspace"],
    ["/tax/receipts", "DeclarationReceiptWorkspace"],
  ]) {
    assert.match(
      app,
      new RegExp(`<Route path="${path}" element={<${component} />} />`),
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    workspace,
    /automationApi\.getTaxDeclarationTasks\(\{ companyId: selectedCompanyId, period: periodLabel \}\)/,
  );
  assert.match(workspace, /automationApi\.confirmTaxDeclarationTask/);
  assert.match(workspace, /税务报表页仅查询当前账套与账期/);
  assert.match(workspace, /不会向电子税务局提交申报或发起扣款/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("period closing uses a dedicated precheck and controlled close workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/ClosingTasksWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(app, /import\('\.\/pages\/operations\/ClosingTasksWorkspace'\)/);
  assert.match(
    app,
    /<Route path="\/period-closing" element={<ClosingTasksWorkspace \/>} \/>/,
  );
  assert.match(
    workspace,
    /queryVouchers\(\{ company_id: companyId, period_id: periodId/,
  );
  assert.match(workspace, /fetchTrialBalance\(periodId\)/);
  assert.match(workspace, /getBalanceSheet\(periodId\)/);
  assert.match(workspace, /closePeriod\(periodId\)/);
  assert.match(workspace, /不会自动结账/);
  assert.match(workspace, /window\.confirm/);
  assert.doesNotMatch(workspace, /accounting-preview-invoice-voucher-core-data-v2/);
  assert.doesNotMatch(workspace, /canClose = Boolean\(isTauri/);
  assert.match(workspace, /浏览器预览的结账操作只会锁定本机预览账期/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("period closing previews settlement rules and only creates auditable drafts", () => {
  const workspace = read("src/pages/operations/ClosingTasksWorkspace.tsx");
  const store = read("src/stores/settlementRuleStore.ts");
  const settlementCommands = read("src-tauri/src/commands/settlement.rs");
  const rustEntry = read("src-tauri/src/lib.rs");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(workspace, /previewSettlementRule/);
  assert.match(workspace, /createSettlementVoucherDraft/);
  assert.match(workspace, /生成结转草稿/);
  assert.match(workspace, /必须在凭证列表复核并审核/);
  assert.match(store, /preview_settlement_rule/);
  assert.match(store, /create_settlement_voucher_draft/);
  assert.match(settlementCommands, /pub async fn preview_settlement_rule/);
  assert.match(settlementCommands, /pub async fn create_settlement_voucher_draft/);
  assert.match(settlementCommands, /status = 'approved'/);
  assert.match(settlementCommands, /is_settlement = 0/);
  assert.match(settlementCommands, /settlement_rule_id/);
  assert.match(settlementCommands, /'settlement_create'/);
  assert.match(rustEntry, /commands::settlement::preview_settlement_rule/);
  assert.match(rustEntry, /commands::settlement::create_settlement_voucher_draft/);
  assert.match(browserBridge, /cmd === "create_settlement_voucher_draft"/);
});

test("live data verification covers the dedicated business tag workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "businessTagWorkspaceSource",
    "src/pages/operations/BusinessTagWorkspace.tsx",
  );
  assert.match(verifier, /requiredBusinessTagWorkspaceSnippets/);
  assert.match(verifier, /business tag workspace/);
  assert.match(verifier, /["']tagArchive["']/);
});

test("live data verification covers the dedicated voucher recycle workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "voucherRecycleWorkspaceSource",
    "src/pages/operations/VoucherRecycleWorkspace.tsx",
  );
  assert.match(verifier, /requiredVoucherRecycleWorkspaceSnippets/);
  assert.match(verifier, /voucher recycle workspace/);
});

test("live data verification covers the dedicated company information workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "companyInfoWorkspaceSource",
    "src/pages/operations/CompanyInfoWorkspace.tsx",
  );
  assert.match(verifier, /requiredCompanyInfoWorkspaceSnippets/);
  assert.match(verifier, /company information workspace/);
});

test("live data verification covers the dedicated audit log workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "auditLogWorkspaceSource",
    "src/pages/operations/AuditLogWorkspace.tsx",
  );
  assert.match(verifier, /requiredAuditLogWorkspaceSnippets/);
  assert.match(verifier, /audit log workspace/);
});

test("live data verification covers the dedicated backup restoration workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "backupRestoreWorkspaceSource",
    "src/pages/operations/BackupRestoreWorkspace.tsx",
  );
  assert.match(verifier, /requiredBackupRestoreWorkspaceSnippets/);
  assert.match(verifier, /backup restoration workspace/);
});

test("live data verification covers the dedicated declaration calendar workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "declarationCalendarWorkspaceSource",
    "src/pages/tax/DeclarationCalendarWorkspace.tsx",
  );
  assert.match(verifier, /requiredDeclarationCalendarWorkspaceSnippets/);
  assert.match(verifier, /declaration calendar workspace/);
});

test("live data verification covers the dedicated print template workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "printTemplateWorkspaceSource",
    "src/pages/operations/PrintTemplateWorkspace.tsx",
  );
  assert.match(verifier, /requiredPrintTemplateWorkspaceSnippets/);
  assert.match(verifier, /print template workspace/);
});

test("live data verification covers the dedicated voucher workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "voucherWorkspaceSource",
    "src/pages/operations/VoucherWorkspace.tsx",
  );
  assert.match(verifier, /requiredVoucherWorkspaceSnippets/);
  assert.match(verifier, /voucher workspace/);
});

test("voucher workspace exposes the desktop import review workflow", () => {
  const workspace = read("src/pages/operations/VoucherWorkspace.tsx");
  const dialogFile = "src/components/operations/VoucherImportDialog.tsx";

  assert.equal(existsSync(join(root, dialogFile)), true);
  assert.match(workspace, /VoucherImportDialog/);
  assert.match(workspace, /批量导入/);

  const dialog = read(dialogFile);
  assert.match(dialog, /parse_voucher_excel/);
  assert.match(dialog, /import_vouchers/);
  assert.match(dialog, /download_voucher_template/);
  assert.match(dialog, /@tauri-apps\/plugin-dialog/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /window\.confirm/);
});

test("voucher import also supports bounded browser-local Excel review and draft creation", () => {
  const workspace = read("src/pages/operations/VoucherWorkspace.tsx");
  const dialog = read("src/components/operations/VoucherImportDialog.tsx");
  const parser = read("src/lib/browserVoucherImport.js");

  assert.doesNotMatch(workspace, /批量导入仅在桌面端开放/);
  assert.match(workspace, /setShowImportDialog\(true\)/);
  assert.match(dialog, /type="file"/);
  assert.match(dialog, /read-excel-file\/browser/);
  assert.match(dialog, /parseBrowserVoucherSheetRows/);
  assert.match(dialog, /exportRowsToXlsx/);
  assert.match(dialog, /create_voucher/);
  assert.doesNotMatch(dialog, /浏览器页面只用于界面预览/);
  assert.match(parser, /MAX_BROWSER_VOUCHER_IMPORT_ROWS/);
  assert.match(parser, /MAX_BROWSER_VOUCHER_IMPORT_COLUMNS/);
});

test("voucher import stays in draft until an explicit approval action", () => {
  const source = read("src-tauri/src/commands/vouchers.rs");
  const importBody = source.slice(
    source.indexOf("pub async fn import_vouchers("),
    source.indexOf("pub async fn delete_company_vouchers(", source.indexOf("pub async fn import_vouchers(")),
  );

  assert.match(importBody, /VALUES \([\s\S]+?'draft'/);
  assert.doesNotMatch(importBody, /approved_by|approved_at/);
  assert.doesNotMatch(importBody, /update_balances_on_approve/);
  assert.doesNotMatch(importBody, /recalculate closing balances/i);
});

test("voucher Excel parsing enforces bounded local-file inputs", () => {
  const source = read("src-tauri/src/commands/vouchers.rs");
  const parserBody = source.slice(
    source.indexOf("pub async fn parse_voucher_excel("),
    source.indexOf("pub async fn recalculate_balances(", source.indexOf("pub async fn parse_voucher_excel(")),
  );

  assert.match(source, /const MAX_VOUCHER_IMPORT_FILE_BYTES:/);
  assert.match(source, /const MAX_VOUCHER_IMPORT_ROWS:/);
  assert.match(source, /const MAX_VOUCHER_IMPORT_COLUMNS:/);
  assert.match(source, /const MAX_VOUCHER_IMPORT_PERIOD_SPAN_MONTHS:/);
  assert.match(parserBody, /metadata\(&file_path\)/);
  assert.match(parserBody, /MAX_VOUCHER_IMPORT_FILE_BYTES/);
  assert.match(parserBody, /MAX_VOUCHER_IMPORT_ROWS/);
  assert.match(parserBody, /MAX_VOUCHER_IMPORT_COLUMNS/);
  assert.match(parserBody, /xlsx.*xls/s);
});

test("new voucher numbers come from the scoped database sequence", () => {
  const workspace = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const store = read("src/stores/voucherStore.ts");

  assert.match(store, /getNextVoucherNumber:/);
  assert.match(store, /invoke<string>\(['"]get_next_voucher_number['"]/);
  assert.match(
    workspace,
    /getNextVoucherNumber\(\s*currentPeriodId,\s*selectedCompanyId,?\s*\)/,
  );
  assert.doesNotMatch(workspace, /Math\.max\(0, \.\.\.vouchers\.map/);
});

test("voucher entry exposes scoped historical summary suggestions", () => {
  const workspace = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const store = read("src/stores/voucherStore.ts");

  assert.match(store, /suggestSummaries:/);
  assert.match(store, /invoke<string\[]>\(['"]suggest_summary['"]/);
  assert.match(workspace, /suggestSummaries\(accountCode, selectedCompanyId\)/);
  assert.match(workspace, /<datalist id="voucher-summary-suggestions">/);
});

test("live data verification covers the dedicated voucher detail workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "voucherDetailWorkspaceSource",
    "src/pages/operations/VoucherDetailWorkspace.tsx",
  );
  assert.match(verifier, /requiredVoucherDetailWorkspaceSnippets/);
  assert.match(verifier, /voucher detail workspace/);
});

test("live data verification covers the dedicated risk check workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "riskCheckWorkspaceSource",
    "src/pages/operations/RiskCheckWorkspace.tsx",
  );
  assert.match(verifier, /requiredRiskCheckWorkspaceSnippets/);
  assert.match(verifier, /risk check workspace/);
});

test("live data verification covers the dedicated invoice voucher matching workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "invoiceVoucherMatchingWorkspaceSource",
    "src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx",
  );
  assert.match(verifier, /requiredInvoiceVoucherMatchingWorkspaceSnippets/);
  assert.match(verifier, /invoice voucher matching workspace/);
});

test("live data verification covers the dedicated aging workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "agingWorkspaceSource",
    "src/pages/operations/AgingWorkspace.tsx",
  );
  assert.match(verifier, /requiredAgingWorkspaceSnippets/);
  assert.match(verifier, /aging workspace/);
});

test("live data verification covers dedicated ledger report workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "ledgerReportWorkspaceSource",
    "src/pages/operations/LedgerReportWorkspace.tsx",
  );
  assert.match(verifier, /requiredLedgerReportWorkspaceSnippets/);
  assert.match(verifier, /ledger report workspace/);
});

test("live data verification covers detailed ledger workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "ledgerDetailWorkspaceSource",
    "src/pages/operations/LedgerDetailWorkspace.tsx",
  );
  assert.match(verifier, /requiredLedgerDetailWorkspaceSnippets/);
  assert.match(verifier, /ledger detail workspace/);
});

test("live data verification covers financial statement workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "financialStatementWorkspaceSource",
    "src/pages/operations/FinancialStatementWorkspace.tsx",
  );
  assert.match(verifier, /requiredFinancialStatementWorkspaceSnippets/);
  assert.match(verifier, /financial statement workspace/);
});

test("live data verification covers dedicated tax report workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  assertVerifierReadsWorkspace(
    verifier,
    "taxReportWorkspaceSource",
    "src/pages/tax/TaxReportWorkspace.tsx",
  );
  assert.match(verifier, /requiredTaxReportWorkspaceSnippets/);
  assert.match(verifier, /tax report workspace/);
});

test("AI routes use dedicated workspaces for queue, recognition, suggestions, and rule training", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/AiOperationsWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "AiJobQueueWorkspace",
    "AiRecognitionWorkspace",
    "AiVoucherSuggestionWorkspace",
    "AiRuleTrainingWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/AiOperationsWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(app, /path="\/ai\/jobs" element={<AiJobQueueWorkspace \/>}/);
  assert.match(
    app,
    /path="\/ai\/recognition" element={<AiRecognitionWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/ai\/suggestions" element={<AiVoucherSuggestionWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/ai\/rules" element={<AiRuleTrainingWorkspace \/>}/,
  );
  assert.match(workspace, /automationApi\.getAutomationJobs\(/);
  assert.match(workspace, /automationApi\.createAutomationJob\(/);
  assert.match(workspace, /automationApi\.updateAutomationJobStatus\(/);
  assert.match(workspace, /useMatchingRuleStore/);
  assert.match(workspace, /rule_scope\s*===\s*["']ai_training["']/);
  assert.match(workspace, /loadPreviewAiTrainingRules/);
  assert.match(workspace, /savePreviewAiTrainingRules/);
  assert.match(workspace, /不会自动生成或入账凭证/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
  assert.doesNotMatch(workspace, /min-w-\[/);
});

test("live data verification covers dedicated AI operation workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "aiOperationsWorkspaceSource",
    "src/pages/operations/AiOperationsWorkspace.tsx",
  );
  assert.match(verifier, /requiredAiOperationsWorkspaceSnippets/);
  assert.match(verifier, /AI operations workspace/);
});

test("file-center routes use dedicated attachment, import, and download workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/FileCenterWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "AttachmentCenterWorkspace",
    "ImportHistoryWorkspace",
    "DownloadCenterWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/FileCenterWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    app,
    /path="\/attachments" element={<AttachmentCenterWorkspace \/>}/,
  );
  assert.match(app, /path="\/imports" element={<ImportHistoryWorkspace \/>}/);
  assert.match(
    app,
    /path="\/downloads" element={<DownloadCenterWorkspace \/>}/,
  );
  assert.match(workspace, /recordLocalAttachment/);
  assert.match(workspace, /updateLocalAttachmentAssociation/);
  assert.match(workspace, /recordLocalImportJob/);
  assert.match(workspace, /updateLocalImportJobValidation/);
  assert.match(workspace, /useExportJobs/);
  assert.match(workspace, /useAuditLogs/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers dedicated file-center workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "fileCenterWorkspaceSource",
    "src/pages/operations/FileCenterWorkspace.tsx",
  );
  assert.match(verifier, /requiredFileCenterWorkspaceSnippets/);
  assert.match(verifier, /file center workspace/);
});

test("receipt and reimbursement routes use dedicated document workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/DocumentBusinessWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "ReceiptWorkspace",
    "ExpenseReimbursementWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/DocumentBusinessWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(app, /path="\/receipts" element={<ReceiptWorkspace \/>}/);
  assert.match(
    app,
    /path="\/expenses\/reimbursements" element={<ExpenseReimbursementWorkspace \/>}/,
  );
  assert.match(workspace, /documentRecordApi\.getDocumentRecords/);
  assert.match(workspace, /documentRecordApi\.createDocumentRecord/);
  assert.match(workspace, /documentRecordApi\.updateDocumentRecord/);
  assert.match(workspace, /accounting-preview-document-business-data-v2/);
  assert.match(workspace, /不自动生成或过账凭证/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers receipt and reimbursement workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "documentBusinessWorkspaceSource",
    "src/pages/operations/DocumentBusinessWorkspace.tsx",
  );
  assert.match(verifier, /requiredDocumentBusinessWorkspaceSnippets/);
  assert.match(verifier, /document business workspace/);
});

test("bill list route uses a dedicated bank-bill workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/BillListWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  assert.match(
    app,
    /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/BillListWorkspace['"]\)/,
  );
  assert.match(app, /path="\/bills" element={<BillListWorkspace \/>}/);
  assert.match(workspace, /export function BillListWorkspace\(\)/);
  assert.match(workspace, /bankTransactionApi\.getBankTransactions\(/);
  assert.match(workspace, /bankTransactionApi\.createBankTransaction\(/);
  assert.match(workspace, /bankTransactionApi\.updateBankTransaction\(/);
  assert.match(workspace, /不登录银行、不下载回单、不自动生成或过账凭证/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers the dedicated bill list workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "billListWorkspaceSource",
    "src/pages/operations/BillListWorkspace.tsx",
  );
  assert.match(verifier, /requiredBillListWorkspaceSnippets/);
  assert.match(verifier, /bill list workspace/);
});

test("initial balance and tax initialization routes use dedicated setup workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/InitializationWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "InitialBalanceWorkspace",
    "TaxInitializationWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/InitializationWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    app,
    /path="\/settings\/initial-balances" element={<InitialBalanceWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settings\/tax-init" element={<TaxInitializationWorkspace \/>}/,
  );
  assert.match(workspace, /saveInitialBalance\(/);
  assert.match(workspace, /validateInitialBalances\(/);
  assert.match(workspace, /finalizeInitialBalances\(/);
  assert.match(workspace, /automationApi\.getTaxDeclarationTasks\(/);
  assert.match(workspace, /automationApi\.upsertTaxDeclarationTask\(/);
  assert.match(workspace, /automationApi\.confirmTaxDeclarationTask\(/);
  assert.match(workspace, /不会自动向税局提交/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("browser initial balance confirmation locks the scoped local opening data", () => {
  const workspace = read("src/pages/operations/InitializationWorkspace.tsx");

  assert.match(workspace, /browserInitialBalanceWorkflow/);
  assert.match(workspace, /initialBalanceFinalizationStorageKey/);
  assert.match(workspace, /期初已确认/);
  assert.doesNotMatch(workspace, /浏览器预览不会执行最终确认/);
  assert.doesNotMatch(workspace, /const status = difference < 0\.005/);
  assert.doesNotMatch(workspace, /Math\.abs\(row\.opening_debit - row\.opening_credit\) < 0\.005/);
});

test("live data verification covers the dedicated initialization workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "initializationWorkspaceSource",
    "src/pages/operations/InitializationWorkspace.tsx",
  );
  assert.match(verifier, /requiredInitializationWorkspaceSnippets/);
  assert.match(verifier, /initialization workspace/);
});

test("history migration routes use dedicated voucher and ledger workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/HistoryMigrationWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "HistoryVoucherWorkspace",
    "HistoryBalanceWorkspace",
    "HistoryGeneralLedgerWorkspace",
    "HistorySubsidiaryLedgerWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/HistoryMigrationWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    app,
    /path="\/settings\/history-vouchers" element={<HistoryVoucherWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settings\/history-balances" element={<HistoryBalanceWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settings\/history-general-ledger" element={<HistoryGeneralLedgerWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settings\/history-subsidiary-ledger" element={<HistorySubsidiaryLedgerWorkspace \/>}/,
  );
  assert.match(workspace, /queryVouchers\(/);
  assert.match(workspace, /fetchTrialBalance\(/);
  assert.match(workspace, /getGeneralLedger\(/);
  assert.match(workspace, /getSubsidiaryLedger\(/);
  assert.match(workspace, /不会覆盖当前账期/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers the dedicated history migration workspaces", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "historyMigrationWorkspaceSource",
    "src/pages/operations/HistoryMigrationWorkspace.tsx",
  );
  assert.match(verifier, /requiredHistoryMigrationWorkspaceSnippets/);
  assert.match(verifier, /history migration workspace/);
});

test("voucher create and edit routes use a dedicated voucher entry workspace", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/VoucherEntryWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of ["VoucherCreateWorkspace", "VoucherEditWorkspace"]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/VoucherEntryWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    app,
    /path="\/vouchers\/new" element={<ProtectedRoute><VoucherCreateWorkspace \/><\/ProtectedRoute>}/,
  );
  assert.match(
    app,
    /path="\/vouchers\/edit\/:id" element={<ProtectedRoute><VoucherEditWorkspace \/><\/ProtectedRoute>}/,
  );
  assert.match(workspace, /addVoucher\(/);
  assert.match(workspace, /updateVoucher\(/);
  assert.match(workspace, /getVoucher\(/);
  assert.match(workspace, /不会自动审核、过账或修改已结账账期凭证/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers the dedicated voucher entry workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "voucherEntryWorkspaceSource",
    "src/pages/operations/VoucherEntryWorkspace.tsx",
  );
  assert.match(verifier, /requiredVoucherEntryWorkspaceSnippets/);
  assert.match(verifier, /voucher entry workspace/);
});

test("notification center and settings overview routes use dedicated system workspaces", () => {
  const app = read("src/App.tsx");
  const workspaceFile = "src/pages/operations/SystemHubWorkspace.tsx";

  assert.equal(existsSync(join(root, workspaceFile)), true);
  const workspace = read(workspaceFile);
  for (const component of [
    "NotificationCenterWorkspace",
    "SettingsOverviewWorkspace",
  ]) {
    assert.match(
      app,
      /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/operations\/SystemHubWorkspace['"]\)/,
    );
    assert.match(workspace, new RegExp(`export function ${component}\\(\\)`));
  }
  assert.match(
    app,
    /path="\/notifications" element={<NotificationCenterWorkspace \/>}/,
  );
  assert.match(
    app,
    /path="\/settings" element={<SettingsOverviewWorkspace \/>}/,
  );
  assert.match(workspace, /companyTodoApi\.getAll\(/);
  assert.match(workspace, /companyTodoApi\.create\(/);
  assert.match(workspace, /companyTodoApi\.complete\(/);
  assert.match(workspace, /function writePreviewTodosForScope\(/);
  assert.match(workspace, /不会发送短信、邮件或外部消息/);
  assert.match(workspace, /设置总览不直接修改业务数据/);
  assert.match(workspace, /table-fixed/);
  assert.match(workspace, /lg:hidden/);
});

test("live data verification covers the dedicated system hub workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "systemHubWorkspaceSource",
    "src/pages/operations/SystemHubWorkspace.tsx",
  );
  assert.match(verifier, /requiredSystemHubWorkspaceSnippets/);
  assert.match(verifier, /system hub workspace/);
});

test("live data verification covers the dedicated closing workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "closingTasksWorkspaceSource",
    "src/pages/operations/ClosingTasksWorkspace.tsx",
  );
  assert.match(verifier, /requiredClosingTasksWorkspaceSnippets/);
  assert.match(verifier, /closing tasks workspace/);
});

test("live data verification covers the dedicated contract ledger workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "contractLedgerWorkspaceSource",
    "src/pages/operations/ContractLedgerWorkspace.tsx",
  );
  assert.match(verifier, /requiredContractLedgerWorkspaceSnippets/);
  assert.match(verifier, /contract ledger workspace/);
  assert.match(verifier, /["']contractLedger["']/);
});

test("live data verification covers the dedicated company account workspace", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assertVerifierReadsWorkspace(
    verifier,
    "companyAccountWorkspaceSource",
    "src/pages/operations/CompanyAccountWorkspace.tsx",
  );
  assert.match(verifier, /requiredCompanyAccountWorkspaceSnippets/);
  assert.match(verifier, /company account workspace/);
  assert.match(verifier, /["']accountArchive["']/);
});

test("module framework verification normalizes Windows source newlines", () => {
  const verifier = read("scripts/verify-module-frameworks.mjs");

  assert.match(verifier, /replace\(\/\\r\\n\?\/g, ['"]\\n['"]\)/);
});

test("module framework explicitly registers dedicated operational workspaces", () => {
  const verifier = read("scripts/verify-module-frameworks.mjs");
  const dedicatedWorkspaces = [
    [
      "companyInfo",
      "/settings/company-info",
      "CompanyInfoWorkspace",
      "src/pages/operations/CompanyInfoWorkspace.tsx",
    ],
    [
      "auditLog",
      "/settings/audit-log",
      "AuditLogWorkspace",
      "src/pages/operations/AuditLogWorkspace.tsx",
    ],
    [
      "backupRestore",
      "/settings/backup-restore",
      "BackupRestoreWorkspace",
      "src/pages/operations/BackupRestoreWorkspace.tsx",
    ],
    [
      "declarationCalendar",
      "/tax/calendar",
      "DeclarationCalendarWorkspace",
      "src/pages/tax/DeclarationCalendarWorkspace.tsx",
    ],
    [
      "printTemplateSettings",
      "/settings/print-templates",
      "PrintTemplateWorkspace",
      "src/pages/operations/PrintTemplateWorkspace.tsx",
    ],
    [
      "voucher",
      "/vouchers",
      "VoucherWorkspace",
      "src/pages/operations/VoucherWorkspace.tsx",
    ],
    [
      "voucherDetail",
      "/vouchers/detail/:id",
      "VoucherDetailWorkspace",
      "src/pages/operations/VoucherDetailWorkspace.tsx",
    ],
    [
      "riskCheck",
      "/risk-check",
      "RiskCheckWorkspace",
      "src/pages/operations/RiskCheckWorkspace.tsx",
    ],
    [
      "invoiceVoucherMatching",
      "/matching",
      "InvoiceVoucherMatchingWorkspace",
      "src/pages/operations/InvoiceVoucherMatchingWorkspace.tsx",
    ],
    [
      "receivablePayableAging",
      "/aging",
      "AgingWorkspace",
      "src/pages/operations/AgingWorkspace.tsx",
    ],
    [
      "closingTasks",
      "/period-closing",
      "ClosingTasksWorkspace",
      "src/pages/operations/ClosingTasksWorkspace.tsx",
    ],
    [
      "voucherRecycle",
      "/settings/voucher-recycle",
      "VoucherRecycleWorkspace",
      "src/pages/operations/VoucherRecycleWorkspace.tsx",
    ],
    [
      "tagArchive",
      "/settings/tags",
      "BusinessTagWorkspace",
      "src/pages/operations/BusinessTagWorkspace.tsx",
    ],
    [
      "contractLedger",
      "/settings/contracts",
      "ContractLedgerWorkspace",
      "src/pages/operations/ContractLedgerWorkspace.tsx",
    ],
    [
      "accountArchive",
      "/settings/accounts",
      "CompanyAccountWorkspace",
      "src/pages/operations/CompanyAccountWorkspace.tsx",
    ],
    [
      "customerArchive",
      "/settings/customers",
      "CustomerArchiveWorkspace",
      "src/pages/operations/ArchiveProfileWorkspace.tsx",
    ],
    [
      "supplierArchive",
      "/settings/suppliers",
      "SupplierArchiveWorkspace",
      "src/pages/operations/ArchiveProfileWorkspace.tsx",
    ],
    [
      "otherContactArchive",
      "/settings/other-contacts",
      "OtherContactArchiveWorkspace",
      "src/pages/operations/ArchiveProfileWorkspace.tsx",
    ],
    [
      "projectArchive",
      "/settings/projects",
      "ProjectArchiveWorkspace",
      "src/pages/operations/ArchiveProfileWorkspace.tsx",
    ],
    [
      "departmentArchive",
      "/settings/departments",
      "DepartmentArchiveWorkspace",
      "src/pages/operations/ArchiveProfileWorkspace.tsx",
    ],
    [
      "taxAdapterSettings",
      "/settings/tax-adapters",
      "TaxAdapterWorkspace",
      "src/pages/operations/AdapterAuthorizationWorkspace.tsx",
    ],
    [
      "bankAdapterSettings",
      "/settings/bank-adapters",
      "BankAdapterWorkspace",
      "src/pages/operations/AdapterAuthorizationWorkspace.tsx",
    ],
    [
      "reportFormulaSettings",
      "/settings/report-formulas",
      "ReportFormulaWorkspace",
      "src/pages/operations/ReportFormulaWorkspace.tsx",
    ],
    [
      "invoiceMatchingRules",
      "/settings/invoice-rules",
      "InvoiceMatchingRuleWorkspace",
      "src/pages/operations/MatchingRuleWorkspace.tsx",
    ],
    [
      "billMatchingRules",
      "/settings/bill-rules",
      "BillMatchingRuleWorkspace",
      "src/pages/operations/MatchingRuleWorkspace.tsx",
    ],
    [
      "cashFlowMapping",
      "/settings/cash-flow-mapping",
      "CashFlowMappingWorkspace",
      "src/pages/operations/MatchingRuleWorkspace.tsx",
    ],
    [
      "settlementRules",
      "/settings/settlement-rules",
      "SettlementRuleWorkspace",
      "src/pages/operations/SettlementRuleWorkspace.tsx",
    ],
    [
      "auxiliaryCategories",
      "/settings/auxiliary-categories",
      "AuxiliaryCategoryWorkspace",
      "src/pages/operations/AuxiliaryWorkspace.tsx",
    ],
    [
      "auxiliaryItems",
      "/settings/auxiliary-items",
      "AuxiliaryItemWorkspace",
      "src/pages/operations/AuxiliaryWorkspace.tsx",
    ],
    [
      "currencySettings",
      "/settings/currencies",
      "CurrencyWorkspace",
      "src/pages/operations/CurrencyWorkspace.tsx",
    ],
    [
      "commonDigests",
      "/settings/common-digests",
      "CommonDigestWorkspace",
      "src/pages/operations/TemplateSettingsWorkspace.tsx",
    ],
    [
      "voucherTemplateSettings",
      "/settings/voucher-templates",
      "VoucherTemplateWorkspace",
      "src/pages/operations/TemplateSettingsWorkspace.tsx",
    ],
    [
      "periodManagement",
      "/settings/period-management",
      "PeriodManagementWorkspace",
      "src/pages/operations/PeriodManagementWorkspace.tsx",
    ],
    [
      "assetCategory",
      "/settings/asset-categories",
      "AssetCategoryWorkspace",
      "src/pages/operations/AssetCategoryWorkspace.tsx",
    ],
    [
      "subjectSettings",
      "/settings/account-codes",
      "AccountCodeWorkspace",
      "src/pages/operations/AccountCodeWorkspace.tsx",
    ],
    [
      "depreciation",
      "/depreciation",
      "FixedAssetWorkspace",
      "src/pages/operations/FixedAssetWorkspace.tsx",
    ],
    [
      "inventorySettings",
      "/inventory",
      "InventoryMasterWorkspace",
      "src/pages/operations/InventoryMasterWorkspace.tsx",
    ],
    [
      "unitSettings",
      "/units",
      "MeasurementUnitWorkspace",
      "src/pages/operations/MeasurementUnitWorkspace.tsx",
    ],
    [
      "costCarryover",
      "/cost-carryover",
      "CostCarryoverWorkspace",
      "src/pages/operations/CostCarryoverWorkspace.tsx",
    ],
    [
      "inventoryMovement",
      "/inventory/movements",
      "InventoryMovementWorkspace",
      "src/pages/operations/InventoryMovementWorkspace.tsx",
    ],
    [
      "transfer",
      "/transfers",
      "AccountTransferWorkspace",
      "src/pages/operations/AccountTransferWorkspace.tsx",
    ],
    [
      "receivableSettlement",
      "/settlement/receivable",
      "ReceivableSettlementWorkspace",
      "src/pages/operations/ReceivableSettlementWorkspace.tsx",
    ],
    [
      "payableSettlement",
      "/settlement/payable",
      "PayableSettlementWorkspace",
      "src/pages/operations/PayableSettlementWorkspace.tsx",
    ],
    [
      "purchaseManagement",
      "/purchase",
      "PurchaseManagementWorkspace",
      "src/pages/operations/PurchaseManagementWorkspace.tsx",
    ],
    [
      "salesManagement",
      "/sales",
      "SalesManagementWorkspace",
      "src/pages/operations/SalesManagementWorkspace.tsx",
    ],
    [
      "documentRegister",
      "/documents",
      "DocumentRegisterWorkspace",
      "src/pages/operations/DocumentRegisterWorkspace.tsx",
    ],
    [
      "bankReconciliation",
      "/bank/reconciliation",
      "BankReconciliationWorkspace",
      "src/pages/operations/BankReconciliationWorkspace.tsx",
    ],
    [
      "bankStatement",
      "/bank",
      "BankStatementWorkspace",
      "src/pages/operations/BankStatementWorkspace.tsx",
    ],
    [
      "billList",
      "/bills",
      "BillListWorkspace",
      "src/pages/operations/BillListWorkspace.tsx",
    ],
    [
      "notificationCenter",
      "/notifications",
      "NotificationCenterWorkspace",
      "src/pages/operations/SystemHubWorkspace.tsx",
    ],
    [
      "settingsData",
      "/settings",
      "SettingsOverviewWorkspace",
      "src/pages/operations/SystemHubWorkspace.tsx",
    ],
    [
      "initialBalance",
      "/settings/initial-balances",
      "InitialBalanceWorkspace",
      "src/pages/operations/InitializationWorkspace.tsx",
    ],
    [
      "taxInit",
      "/settings/tax-init",
      "TaxInitializationWorkspace",
      "src/pages/operations/InitializationWorkspace.tsx",
    ],
    [
      "historyVoucher",
      "/settings/history-vouchers",
      "HistoryVoucherWorkspace",
      "src/pages/operations/HistoryMigrationWorkspace.tsx",
    ],
    [
      "historyBalance",
      "/settings/history-balances",
      "HistoryBalanceWorkspace",
      "src/pages/operations/HistoryMigrationWorkspace.tsx",
    ],
    [
      "historyGeneralLedger",
      "/settings/history-general-ledger",
      "HistoryGeneralLedgerWorkspace",
      "src/pages/operations/HistoryMigrationWorkspace.tsx",
    ],
    [
      "historySubsidiaryLedger",
      "/settings/history-subsidiary-ledger",
      "HistorySubsidiaryLedgerWorkspace",
      "src/pages/operations/HistoryMigrationWorkspace.tsx",
    ],
    [
      "voucherCreate",
      "/vouchers/new",
      "VoucherCreateWorkspace",
      "src/pages/operations/VoucherEntryWorkspace.tsx",
    ],
    [
      "voucherEdit",
      "/vouchers/edit/:id",
      "VoucherEditWorkspace",
      "src/pages/operations/VoucherEntryWorkspace.tsx",
    ],
    [
      "outputInvoice",
      "/invoices/output",
      "OutputInvoiceWorkspace",
      "src/pages/operations/OutputInvoiceWorkspace.tsx",
    ],
    [
      "inputInvoice",
      "/invoices/input",
      "InputInvoiceWorkspace",
      "src/pages/operations/InputInvoiceWorkspace.tsx",
    ],
    [
      "employee",
      "/employees",
      "EmployeeWorkspace",
      "src/pages/operations/EmployeeWorkspace.tsx",
    ],
    [
      "payroll",
      "/payroll",
      "PayrollWorkspace",
      "src/pages/operations/PayrollWorkspace.tsx",
    ],
    [
      "socialSecurity",
      "/social-security",
      "SocialSecurityWorkspace",
      "src/pages/operations/SocialSecurityWorkspace.tsx",
    ],
    [
      "specialDeduction",
      "/special-deductions",
      "SpecialDeductionWorkspace",
      "src/pages/operations/SpecialDeductionWorkspace.tsx",
    ],
    [
      "aiJobQueue",
      "/ai/jobs",
      "AiJobQueueWorkspace",
      "src/pages/operations/AiOperationsWorkspace.tsx",
    ],
    [
      "aiRecognitionResults",
      "/ai/recognition",
      "AiRecognitionWorkspace",
      "src/pages/operations/AiOperationsWorkspace.tsx",
    ],
    [
      "aiVoucherSuggestions",
      "/ai/suggestions",
      "AiVoucherSuggestionWorkspace",
      "src/pages/operations/AiOperationsWorkspace.tsx",
    ],
    [
      "aiRuleTraining",
      "/ai/rules",
      "AiRuleTrainingWorkspace",
      "src/pages/operations/AiOperationsWorkspace.tsx",
    ],
  ];

  assert.match(verifier, /const dedicatedBusinessModuleRoutes = \[/);
  for (const [kind, path, component, file] of dedicatedWorkspaces) {
    assert.match(
      verifier,
      new RegExp(
        `kind: '${kind}'[\\s\\S]*?path: '${path}'[\\s\\S]*?component: '${component}'[\\s\\S]*?file: '${file}'`,
      ),
    );
  }
  assert.match(
    verifier,
    /\.\.\.dedicatedBusinessModuleRoutes\.map\(\(route\) => route\.kind\)/,
  );
  assert.match(
    verifier,
    /dedicated route '\$\{route\.path\}' must render \$\{route\.component\}/,
  );
  assert.match(
    verifier,
    /dedicated module workspace '\$\{route\.kind\}' must export \$\{route\.component\}/,
  );
});

test("desktop JavaScript API stays on the Rust Tauri minor release", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.dependencies?.["@tauri-apps/api"], "2.10.1");
  assert.equal(
    packageJson.dependencies?.["@tauri-apps/plugin-dialog"],
    "2.7.0",
  );
});

test("CI executes all project verification gates before desktop packaging", () => {
  const workflow = read(".github/workflows/desktop-build.yml");

  for (const command of [
    "npm run test",
    "npm run verify:modules",
    "npm run verify:live-data",
    "npm run verify:exports",
    "npm run verify:pdf-sanitization",
    "npm run verify:source-reachability",
    "npm run verify:route-content",
    "npm run verify:routes",
    "npm audit --omit=dev --audit-level=high",
    "npx playwright install chromium",
    "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
    "cargo check --manifest-path src-tauri/Cargo.toml",
    "cargo test --manifest-path src-tauri/Cargo.toml",
  ]) {
    assert.match(
      workflow,
      new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("unregistered generic SQL placeholder commands are not shipped", () => {
  assert.equal(existsSync(join(root, "src-tauri/src/commands/db.rs")), false);
  assert.doesNotMatch(read("src-tauri/src/commands.rs"), /pub mod db/);
  assert.doesNotMatch(read("src-tauri/src/lib.rs"), /commands::db::/);
});

test("each invoked desktop command is registered by Tauri", () => {
  const commands = new Set();
  for (const file of sourceFiles(join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /invoke(?:<[^>]*>)?\(\s*['\"]([^'\"]+)['\"]/g,
    ))
      commands.add(match[1]);
  }

  const rust = read("src-tauri/src/lib.rs");
  const handlerBlock =
    rust.match(/generate_handler!\s*\[([\s\S]*?)\]/)?.[1] || "";
  const handlers = new Set(
    [...handlerBlock.matchAll(/\b([a-z][a-z0-9_]*)\b/g)].map(
      (match) => match[1],
    ),
  );
  const missing = [...commands].filter((command) => !handlers.has(command));

  assert.deepEqual(missing, []);
});

test("live data verification scans invokes across the full source tree", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assert.match(verifier, /function sourceFiles\(/);
  assert.match(verifier, /sourceFiles\(["']src["']\)/);
  assert.doesNotMatch(verifier, /readdirSync\(["']src\/stores["']\)/);
});

test("live data verification counts only commands inside the Tauri handler macro", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assert.match(verifier, /const handlerBlock\s*=\s*rustEntrySource\.match\(\/generate_handler!/);
  assert.match(verifier, /handlerBlock\.matchAll\(\/commands::/);
  assert.doesNotMatch(verifier, /rustEntrySource\.matchAll\(\/commands::/);
});

test("live data verification rejects unused registered desktop commands", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");

  assert.match(verifier, /uninvokedRegisteredCommands/);
  assert.match(
    verifier,
    /registered Rust command is not invoked by the front end/,
  );
  assert.match(verifier, /unregisteredCommandAnnotations/);
  assert.match(verifier, /Rust command attribute is not registered by Tauri/);
  assert.match(verifier, /registeredCommandsWithoutAnnotations/);
  assert.match(verifier, /registered Tauri command has no command attribute/);
});

test("live data verification accepts stacked Rust attributes on Tauri commands", () => {
  const verifier = read("scripts/verify-live-module-data.mjs");
  const literal = verifier.match(
    /const commandAttributePattern\s*=\s*(\/[^\n]+\/g);/,
  )?.[1];

  assert.ok(literal, "command attribute matcher is missing");
  const pattern = Function(`return ${literal}`)();
  const source = `
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_report_item() {}
`;

  assert.deepEqual(
    [...source.matchAll(pattern)].map((match) => match[1]),
    ["create_report_item"],
  );
});

test("voucher workspaces expose draft deletion and save-and-new shortcuts", () => {
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");

  assert.match(list, /const deleteVoucher = useVoucherStore/);
  assert.match(list, /deleteVoucher\(voucher\.id, companyId\)/);
  assert.match(list, /确认删除草稿凭证/);
  assert.match(list, /确认批量删除/);
  assert.match(list, /selectedDraftIds\.map\(\(id\) => deleteVoucher\(id, companyId\)\)/);
  assert.match(entry, /resolveVoucherSubmitIntent/);
  assert.match(entry, /createNextVoucherDraft/);
  assert.match(entry, /value=["']save-and-new["']/);
  assert.match(entry, /value=["']save-and-close["']/);
  assert.match(entry, /navigate\(`\/vouchers\/edit\/\$\{savedVoucher\.id\}`/);
  assert.match(entry, /event\.key === ["']F12["']/);
});

test("voucher entry persists extended accounting dimensions", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const store = read("src/stores/voucherStore.ts");
  const preview = read("src/lib/browserPreviewVouchers.js");

  for (const field of [
    "doc_number",
    "quantity",
    "unit_price",
    "unit",
    "currency_id",
    "exchange_rate",
    "auxiliary_type",
    "auxiliary_id",
  ]) {
    assert.match(entry, new RegExp(`${field}:`), `entry payload misses ${field}`);
    assert.match(store, new RegExp(`${field}\\?:`), `store input misses ${field}`);
    assert.match(preview, new RegExp(`${field}:`), `preview persistence misses ${field}`);
  }

  for (const label of ["单据号", "数量", "单价", "单位", "币别", "汇率", "辅助核算"])
    assert.match(entry, new RegExp(label), `voucher entry UI misses ${label}`);
});

test("voucher entry consumes and creates persisted voucher templates", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const store = read("src/stores/templateStore.ts");
  const backend = read("src-tauri/src/commands/templates.rs");

  assert.match(entry, /fetchTemplateWorkspace\(selectedCompanyId\)/);
  assert.match(entry, /applyVoucherTemplateToDraft/);
  assert.match(entry, /createVoucherTemplateEntries/);
  assert.match(entry, /createVoucherTemplate\(/);
  assert.match(entry, /createVoucherTemplateType\(/);
  assert.match(entry, /调用模板/);
  assert.match(entry, /保存为模板/);
  assert.match(store, /amount\?: number \| null/);
  assert.match(store, /doc_number\?: string \| null/);
  assert.match(store, /exchange_rate\?: number \| null/);
  assert.match(backend, /pub amount: Option<f64>/);
  assert.match(backend, /pub doc_number: Option<String>/);
  assert.match(backend, /pub exchange_rate: Option<f64>/);
});

test("voucher entry displays a Chinese uppercase balanced total", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const workflow = read("src/lib/voucherEntryWorkflow.js");

  assert.match(entry, /toChineseCurrencyUppercase\(totals\.debit\)/);
  assert.match(entry, /金额大写/);
  assert.match(workflow, /export function toChineseCurrencyUppercase/);
});

test("voucher entry exposes maker and lifecycle audit metadata", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");

  for (const field of [
    "loadedVoucher.created_by",
    "loadedVoucher.created_at",
    "loadedVoucher.modified_by",
    "loadedVoucher.modified_at",
    "loadedVoucher.approved_by",
    "loadedVoucher.approved_at",
  ])
    assert.match(entry, new RegExp(field.replaceAll(".", "\\.")));
  for (const label of ["制单人", "制单时间", "最后修改", "审核信息"])
    assert.match(entry, new RegExp(label));
});

test("voucher entry loads and persists scoped business tags", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const preview = read("src/lib/browserPreviewBusinessTags.js");

  assert.match(entry, /useBusinessTagStore/);
  assert.match(entry, /fetchBusinessTags\(selectedCompanyId\)/);
  assert.match(entry, /fetchVoucherTagIds\(voucher\.id, selectedCompanyId\)/);
  assert.match(
    entry,
    /replaceVoucherTags\(\s*savedVoucher\.id,\s*selectedCompanyId,\s*selectedTagIds,?\s*\)/,
  );
  assert.match(entry, /getSelectableVoucherTags/);
  assert.match(entry, /业务标签（可选）/);
  assert.match(entry, /前往标签档案/);
  assert.match(preview, /accounting-preview-business-tags-v1/);
  assert.match(preview, /accounting-preview-voucher-tag-links-v1/);
  assert.match(entry, /getMissingRequiredAuxiliaryCategories/);
  assert.match(entry, /serializeAuxiliarySelections/);
});

test("voucher list and detail expose saved tags through the canonical voucher source", () => {
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");

  for (const source of [list, detail]) {
    assert.match(source, /useBusinessTagStore/);
    assert.match(source, /fetchVoucherTagIds/);
    assert.match(source, /业务标签/);
  }
  assert.match(list, /loadBrowserPreviewVoucherTagIds/);
  assert.match(detail, /loadBrowserPreviewVoucherTagIds/);
  assert.match(detail, /getVoucher\(voucherId, companyId\)/);
  assert.doesNotMatch(detail, /accounting-preview-invoice-voucher-core-data-v2/);
});

test("copying a voucher preserves its business tags in desktop and browser runtimes", () => {
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(voucherCommands, /copy_voucher_tag_links\(\s*&id,\s*&copy_id,\s*&company_id,\s*&mut tx/);
  assert.match(voucherCommands, /INSERT INTO voucher_tags \(voucher_id, tag_id, company_id\)[\s\S]*SELECT \?, tag_id, company_id FROM voucher_tags/);
  assert.match(voucherCommands, /UPDATE business_tags SET usage_count/);
  assert.match(browserBridge, /copyBrowserPreviewVoucherTags\(source\.id, voucher\.id, companyId\)/);
});

test("voucher list exposes responsive advanced filters and entry previews", () => {
  const list = read("src/pages/operations/VoucherWorkspace.tsx");

  assert.match(list, /filterVoucherList/);
  assert.match(list, /显示查询条件/);
  for (const label of ["开始日期", "结束日期", "科目", "业务标签", "附件状态", "重置筛选"])
    assert.match(list, new RegExp(label));
  assert.match(list, /voucher\.entries\.slice\(0, 2\)/);
  assert.match(list, /更多分录/);
});

test("voucher source references flow through entry, copy, list, and detail", () => {
  const store = read("src/stores/voucherStore.ts");
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");

  assert.match(store, /reference_number: string \| null/);
  assert.match(entry, /referenceNumber/);
  assert.match(entry, /来源参考号/);
  assert.match(entry, /reference_number: draft\.referenceNumber\.trim\(\) \|\| undefined/);
  assert.match(list, /来源参考号/);
  assert.match(detail, /来源参考号/);
  assert.match(voucherCommands, /attachment_count, status, total_debit, total_credit, version, created_by, created_at, reference_number/);
  assert.match(voucherCommands, /\.bind\(&original\.reference_number\)/);
});

test("verified invoices open a traceable voucher draft and link the saved voucher", () => {
  const outputInvoices = read("src/pages/operations/OutputInvoiceWorkspace.tsx");
  const inputInvoices = read("src/pages/operations/InputInvoiceWorkspace.tsx");
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");

  for (const workspace of [outputInvoices, inputInvoices]) {
    assert.match(workspace, /buildVoucherSourcePath/);
    assert.match(workspace, /kind:\s*['"]invoice['"]/);
    assert.match(workspace, /id:\s*invoice\.id/);
  }

  assert.match(entry, /useSearchParams/);
  assert.match(entry, /parseVoucherSourceSearch/);
  assert.match(entry, /canCreateVoucherFromInvoice/);
  assert.match(entry, /buildInvoiceVoucherPrefill/);
  assert.match(entry, /invoiceApi\.get\(/);
  assert.match(entry, /invoiceApi\.matchToVoucher\(/);
  assert.match(entry, /保存后关联发票/);
});

test("invoice voucher linking is single-use, period-scoped, and draft-only", () => {
  const commands = read("src-tauri/src/commands/invoices.rs");
  const body = commands.slice(
    commands.indexOf("pub async fn match_invoice_to_voucher("),
    commands.indexOf("pub async fn get_invoices_by_voucher("),
  );

  assert.match(body, /\.begin\(\)/);
  assert.match(body, /status\s*!=\s*"verified"/);
  assert.match(body, /voucher_id\.is_some\(\)/);
  assert.match(body, /voucher_status\s*!=\s*"draft"/);
  assert.match(body, /invoice_period_id[\s\S]*voucher_period_id/);
  assert.match(body, /status = 'verified' AND voucher_id IS NULL/);
  assert.match(body, /rows_affected\(\) == 0/);
  assert.match(body, /\.commit\(\)/);
});

test("voucher electronic attachments are staged, linked, copied, and displayed", () => {
  const entry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");
  const registry = read("src/lib/localFileRegistry.ts");

  assert.match(entry, /电子附件/);
  assert.match(entry, /recordLocalAttachment/);
  assert.match(entry, /updateLocalAttachmentAssociation/);
  assert.match(entry, /pendingAttachments/);
  assert.match(list, /copyLocalVoucherAttachmentAssociations/);
  assert.match(detail, /电子附件/);
  assert.match(detail, /useLocalAttachmentRecords/);
  assert.match(registry, /copyLocalVoucherAttachmentAssociations/);
});

test("voucher list and detail expose maker, reviewer, and lifecycle times", () => {
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");

  assert.match(list, /制单人/);
  assert.match(list, /审核人/);
  assert.match(list, /voucher\.created_by/);
  assert.match(list, /voucher\.approved_by/);
  assert.match(detail, /制单时间/);
  assert.match(detail, /最后修改/);
  assert.match(detail, /审核时间/);
  assert.match(detail, /formatDateTime\(voucher\.created_at\)/);
});

test("voucher detail exposes lifecycle actions and dedicated voucher printing", () => {
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");
  const printBuilder = read("src/lib/voucherPrint.js");

  for (const action of [
    "approveVoucher",
    "reverseApproveVoucher",
    "copyVoucher",
    "deleteVoucher",
    "reverseVoucher",
  ]) {
    assert.match(detail, new RegExp(`\\b${action}\\b`));
  }
  assert.match(detail, /copyLocalVoucherAttachmentAssociations/);
  assert.match(detail, /buildVoucherPrintHtml/);
  assert.match(detail, /exportHtmlToPdf/);
  assert.match(detail, /sanitizePrintableHtml/);
  assert.match(detail, />打印凭证</);
  assert.match(detail, />导出凭证PDF</);
  assert.match(printBuilder, /记账凭证/);
  assert.match(printBuilder, /合计（大写）/);
  assert.match(printBuilder, /制单：/);
  assert.match(printBuilder, /审核：/);
});

test("voucher reversal preserves source trace and records the human operator", () => {
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(voucherCommands, /approved_by, approved_at, reference_number, reversal_of_id/);
  assert.match(voucherCommands, /\.bind\(&original\.reference_number\)/);
  assert.match(voucherCommands, /copy_voucher_tag_links\(&id, &reversal_id, &company_id/);
  assert.match(
    voucherCommands,
    /UPDATE vouchers SET status = 'reversed', reversed_by = \?, reversed_at = \?[\s\S]*?\.bind\(&reversed_by\)/,
  );
  assert.match(voucherCommands, /authenticated_actor\(db\.pool\(\), &auth_token\)/);
  assert.match(browserBridge, /reverseBrowserPreviewVoucher/);
});

test("legacy desktop commands and command-only annotations stay removed", () => {
  const rustEntry = read("src-tauri/src/lib.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const settlementCommands = read("src-tauri/src/commands/settlement.rs");
  const browserBridge = read("src/lib/tauri.ts");

  for (const command of [
    "delete_voucher_template_type",
    "generate_settlement_voucher",
    "get_accounts_with_auxiliary",
    "get_current_user",
    "get_period",
    "insert_voucher",
    "read_text_file",
  ]) {
    assert.doesNotMatch(
      rustEntry,
      new RegExp(`commands::[a-z0-9_]+::${command}\\b`),
    );
  }

  assert.doesNotMatch(voucherCommands, /pub async fn insert_voucher\b/);
  assert.doesNotMatch(settlementCommands, /generate_settlement_voucher\b/);
  assert.doesNotMatch(browserBridge, /\bget_account_code:\s*null\b/);
  assert.doesNotMatch(
    voucherCommands,
    /#\[tauri::command\]\s*\/\/\/[^\n]*\n(?:\/\/\/[^\n]*\n)*async fn resolve_period_for_date\b/,
  );
});

test("desktop authentication uses secure first-run administrator setup", () => {
  const rustEntry = read("src-tauri/src/lib.rs");
  const authCommands = read("src-tauri/src/commands/auth.rs");
  const database = read("src-tauri/src/db.rs");
  const loginPage = read("src/pages/LoginPage.tsx");

  assert.doesNotMatch(database, /admin123/);
  assert.doesNotMatch(loginPage, /admin123|演示账号/);
  assert.doesNotMatch(authCommands, /JWT_SECRET\s*:/);
  assert.match(authCommands, /pub async fn get_auth_setup_status\b/);
  assert.match(authCommands, /pub async fn initialize_admin\b/);
  assert.match(authCommands, /password\.chars\(\)\.any/);
  assert.match(
    loginPage,
    /invoke<AuthSetupStatus>\(['"]get_auth_setup_status['"]/,
  );
  assert.match(loginPage, /invoke\(['"]initialize_admin['"]/);
  assert.match(rustEntry, /commands::auth::get_auth_setup_status/);
  assert.match(rustEntry, /commands::auth::initialize_admin/);
  assert.doesNotMatch(rustEntry, /commands::auth::register/);
  assert.equal(existsSync(join(root, "playwright.config.mcp.ts")), false);
});

test("company and agency editor overlays expose dialog semantics", () => {
  const welcome = read("src/pages/Welcome.tsx");
  const agency = read("src/pages/agency/AgencyModulePage.tsx");

  assert.match(
    welcome,
    /memoCompany[\s\S]*?role="dialog"[\s\S]*?aria-label="客户备忘录"/,
  );
  assert.match(
    welcome,
    /showAddModal[\s\S]*?role="dialog"[\s\S]*?aria-label=\{editingCompanyId \? '编辑企业' : '新增企业'\}/,
  );

  for (const label of [
    "新增或编辑服务合同",
    "新增或编辑收费记录",
    "新增或编辑协同事项",
    "复核自动化任务",
    "新增或编辑授权记录",
  ]) {
    assert.match(
      agency,
      new RegExp(`role="dialog"[\\s\\S]*?aria-label="${label}"`),
      `missing dialog semantics for ${label}`,
    );
  }
});

test("agency home separates customer progress from account archives and loads one scoped progress dataset", () => {
  const welcome = read("src/pages/Welcome.tsx");
  const api = read("src/lib/api.ts");
  const browserBridge = read("src/lib/tauri.ts");
  const rustEntry = read("src-tauri/src/lib.rs");
  const agencyCommands = read("src-tauri/src/commands/agency.rs");

  assert.match(welcome, /客户进度/);
  assert.match(welcome, /账套档案/);
  assert.match(welcome, /agencyApi\.getCompanyProgress/);
  assert.match(welcome, /资料采集/);
  assert.match(welcome, /账务进度/);
  assert.match(welcome, /申报进度/);
  assert.match(welcome, /缴款进度/);
  assert.match(api, /getCompanyProgress:[\s\S]*?get_agency_company_progress/);
  assert.match(browserBridge, /cmd === ["']get_agency_company_progress["']/);
  assert.match(rustEntry, /commands::agency::get_agency_company_progress/);
  assert.match(agencyCommands, /pub async fn get_agency_company_progress\b/);
  assert.doesNotMatch(welcome, /companies\.map\([\s\S]{0,400}getCompanyProgress/);
});

test("AI voucher suggestions collect accounting data and enter a traceable voucher draft workflow", () => {
  const aiWorkspace = read("src/pages/operations/AiOperationsWorkspace.tsx");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(aiWorkspace, /debitSubject:\s*suggestion \? draft\.debitAccountCode/);
  assert.match(aiWorkspace, /creditSubject:\s*suggestion \? draft\.creditAccountCode/);
  assert.match(aiWorkspace, /suggestionAmount:\s*suggestion/);
  assert.match(aiWorkspace, /kind:\s*["']ai_suggestion["']/);
  assert.match(voucherEntry, /buildAiVoucherSuggestionPrefill/);
  assert.match(voucherEntry, /ai_suggestion_id:\s*sourceAutomationJob\?\.id/);
  assert.match(
    voucherCommands,
    /generated_voucher_id = \?[\s\S]*?status = 'completed'[\s\S]*?AND status = 'confirmed'[\s\S]*?AND generated_voucher_id IS NULL/,
  );
  assert.match(browserBridge, /generated_voucher_id:\s*voucher\.id/);
  assert.match(browserBridge, /generated_voucher_number:\s*voucher\.voucher_number/);
});

test("bank transactions create one period-scoped voucher draft and retain the source link", () => {
  const database = read("src-tauri/src/db.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const bankWorkspace = read("src/pages/operations/BankStatementWorkspace.tsx");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(database, /bank_transactions ADD COLUMN voucher_id/);
  assert.match(database, /bank_transactions ADD COLUMN voucher_number/);
  assert.match(bankWorkspace, /kind:\s*["']bank_transaction["']/);
  assert.match(bankWorkspace, /record\.voucherId \? ["']查看凭证["'] : ["']生成凭证["']/);
  assert.match(voucherEntry, /buildBankVoucherPrefill/);
  assert.match(voucherEntry, /bank_transaction_id:\s*sourceBankTransaction\?\.id/);
  assert.match(
    voucherCommands,
    /UPDATE bank_transactions[\s\S]*?voucher_id = \?[\s\S]*?status = '已生成凭证'[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(browserBridge, /voucher_id:\s*voucher\.id/);
  assert.match(browserBridge, /status:\s*["']已生成凭证["']/);
});

test("business source records create one period-scoped voucher draft and retain atomic links", () => {
  const database = read("src-tauri/src/db.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const documentWorkspace = read("src/pages/operations/DocumentRegisterWorkspace.tsx");
  const orderWorkspace = read("src/pages/operations/BusinessOrderWorkspace.tsx");
  const transferWorkspace = read("src/pages/operations/AccountTransferWorkspace.tsx");
  const browserBridge = read("src/lib/tauri.ts");

  assert.match(database, /document_records ADD COLUMN voucher_id/);
  assert.match(database, /document_records ADD COLUMN voucher_number/);
  assert.match(database, /business_orders ADD COLUMN voucher_number/);
  assert.match(database, /account_transfers ADD COLUMN voucher_id/);
  assert.match(database, /account_transfers ADD COLUMN voucher_number/);
  for (const workspace of [documentWorkspace, orderWorkspace, transferWorkspace]) {
    assert.match(workspace, /buildVoucherSourcePath/);
    assert.match(workspace, /生成凭证/);
    assert.match(workspace, /查看凭证/);
  }
  assert.match(voucherEntry, /buildBusinessVoucherPrefill/);
  assert.match(voucherEntry, /business_source_kind:\s*sourceBusinessRecord\?\.kind/);
  assert.match(voucherEntry, /business_source_id:\s*sourceBusinessRecord\?\.record\.id/);
  assert.match(
    voucherCommands,
    /UPDATE document_records[\s\S]*?voucher_id = \?[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(
    voucherCommands,
    /UPDATE business_orders[\s\S]*?voucher_id = \?[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(
    voucherCommands,
    /UPDATE account_transfers[\s\S]*?voucher_id = \?[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(voucherCommands, /UPDATE document_records SET voucher_id = NULL/);
  assert.match(voucherCommands, /UPDATE business_orders SET voucher_id = NULL/);
  assert.match(voucherCommands, /UPDATE account_transfers SET voucher_id = NULL/);
  assert.match(browserBridge, /linkBrowserBusinessVoucherSource/);
});

test("cost carryover replaces manual voucher numbers with a traceable voucher source", () => {
  const database = read("src-tauri/src/db.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const workspace = read("src/pages/operations/CostCarryoverWorkspace.tsx");

  assert.match(database, /cost_carryover_records ADD COLUMN voucher_id/);
  assert.match(workspace, /buildVoucherSourcePath/);
  assert.match(workspace, /kind:\s*["']cost_carryover["']/);
  assert.match(workspace, /record\.voucherId \? ["']查看凭证["'] : ["']生成凭证["']/);
  assert.match(voucherEntry, /costCarryoverApi\.getCostCarryoverRecords/);
  assert.match(
    voucherCommands,
    /UPDATE cost_carryover_records[\s\S]*?voucher_id = \?[\s\S]*?status = '已生成凭证'[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(voucherCommands, /UPDATE cost_carryover_records SET voucher_id = NULL/);
});

test("payroll generates one period batch voucher and locks every included payroll row", () => {
  const database = read("src-tauri/src/db.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const payrollWorkspace = read("src/pages/operations/PayrollWorkspace.tsx");

  assert.match(database, /payroll_records ADD COLUMN voucher_id/);
  assert.match(database, /payroll_records ADD COLUMN voucher_number/);
  assert.match(payrollWorkspace, /kind:\s*["']payroll_batch["']/);
  assert.match(payrollWorkspace, /生成工资凭证/);
  assert.match(payrollWorkspace, /查看工资凭证/);
  assert.match(voucherEntry, /payrollApi\.getPayrollRecords/);
  assert.match(
    voucherCommands,
    /UPDATE payroll_records[\s\S]*?voucher_id = \?[\s\S]*?status = '已生成凭证'[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(voucherCommands, /UPDATE payroll_records SET voucher_id = NULL/);
});

test("browser preview persists employee and payroll data and links a payroll batch voucher", () => {
  const tauri = read("src/lib/tauri.ts");

  assert.match(tauri, /cmd === "get_employees"/);
  assert.match(tauri, /cmd === "create_employee"/);
  assert.match(tauri, /cmd === "update_employee"/);
  assert.match(tauri, /cmd === "get_payroll_records"/);
  assert.match(tauri, /cmd === "create_payroll_record"/);
  assert.match(tauri, /cmd === "update_payroll_record"/);
  assert.match(tauri, /businessSourceKind === "payroll_batch"/);
  assert.match(tauri, /data\.payrollRecords = data\.payrollRecords\.map/);
});

test("social security generates one period batch voucher and locks included rows", () => {
  const database = read("src-tauri/src/db.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const workspace = read("src/pages/operations/SocialSecurityWorkspace.tsx");

  assert.match(database, /social_security_records ADD COLUMN voucher_id/);
  assert.match(database, /social_security_records ADD COLUMN voucher_number/);
  assert.match(workspace, /kind:\s*["']social_security_batch["']/);
  assert.match(workspace, /生成社保凭证/);
  assert.match(workspace, /查看社保凭证/);
  assert.match(voucherEntry, /socialSecurityApi\.getSocialSecurityRecords/);
  assert.match(
    voucherCommands,
    /UPDATE social_security_records[\s\S]*?voucher_id = \?[\s\S]*?status = '已生成凭证'[\s\S]*?voucher_id IS NULL/,
  );
  assert.match(voucherCommands, /UPDATE social_security_records SET voucher_id = NULL/);
});

test("fixed assets use recurring depreciation batches rather than marking the asset master vouchered", () => {
  const database = read("src-tauri/src/db.rs");
  const fixedCommands = read("src-tauri/src/commands/fixed_assets.rs");
  const voucherCommands = read("src-tauri/src/commands/vouchers.rs");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");
  const workspace = read("src/pages/operations/FixedAssetWorkspace.tsx");

  assert.match(database, /CREATE TABLE IF NOT EXISTS depreciation_batches/);
  assert.match(fixedCommands, /get_fixed_asset_depreciation_batch/);
  assert.match(workspace, /kind:\s*["']depreciation_batch["']/);
  assert.match(workspace, /生成折旧凭证/);
  assert.match(workspace, /查看折旧凭证/);
  assert.match(voucherEntry, /fixedAssetApi\.getDepreciationLines/);
  assert.match(voucherEntry, /getDepreciationBatch/);
  assert.match(voucherCommands, /UPDATE depreciation_batches/);
  assert.match(voucherCommands, /UPDATE fixed_asset_depreciation_lines/);
  assert.match(voucherCommands, /UPDATE depreciation_batches SET voucher_id = NULL/);
  assert.doesNotMatch(fixedCommands, /status != '已生成凭证'/);
});
