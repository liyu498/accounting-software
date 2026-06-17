# AI Account Core Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Ant Design based frontend for the accounting core loop: login, company selection, vouchers, ledgers, balance sheet, income statement, and export entry points.

**Architecture:** The app is a Vite React TypeScript frontend with a local Ant Design shell. UI code talks only to `accountingApi`; adapter selection chooses mock data in browser preview and a Tauri adapter skeleton in desktop mode. Domain pages stay thin by using feature components and service types.

**Tech Stack:** React 18, TypeScript, Vite, React Router, Ant Design 6, ProComponents 2, Zustand, Vitest, Testing Library.

## Global Constraints

- New project path: `C:\Users\liyu498\Desktop\ai_account-TEST`.
- Old project path `C:\Users\liyu498\Desktop\CC-TEST\accounting-software-new-tauri` is reference material only.
- First release scope is login, company/account set selection, app layout, voucher list, voucher create/edit, voucher audit actions, general ledger, subsidiary ledger, trial balance, balance sheet, income statement, and export entry points.
- Out of first release scope: invoice workflows, inventory, bank reconciliation, AI bookkeeping, tax reports, full role and permission management, and full settings center.
- Use a local Ant Design layout with `Layout`, `Menu`, and route metadata first.
- Use React 18 for first implementation.
- Implement export as a service method with mock success first.
- Do not delete or reset any old production database.
- Do not import `@tauri-apps/api/core` directly in page components.
- Browser preview must stay usable with mock data.
- Amount columns must be right-aligned and use tabular numerals.

---

## File Structure

Create the project with these responsibilities:

- `package.json`: scripts and dependency versions.
- `vite.config.ts`: Vite React config and `@` alias.
- `tsconfig.json`, `tsconfig.node.json`: strict TypeScript config.
- `index.html`, `src/main.tsx`: app entry.
- `src/app/App.tsx`: top-level app composition.
- `src/app/providers.tsx`: Ant Design, router, and app providers.
- `src/app/router.tsx`: route tree and auth/company redirects.
- `src/layouts/AuthLayout.tsx`: login page frame.
- `src/layouts/AppLayout.tsx`: Ant Design shell with sidebar and topbar.
- `src/services/types.ts`: domain contracts shared by adapters and UI.
- `src/services/accountingApi.ts`: adapter selection and exported API.
- `src/services/adapters/mockAdapter.ts`: deterministic browser data with real accounting constraints.
- `src/services/adapters/tauriAdapter.ts`: desktop adapter skeleton, no page-level Tauri imports.
- `src/stores/sessionStore.ts`: session state and login/logout actions.
- `src/stores/companyStore.ts`: selected company and accounting period.
- `src/mocks/seed.ts`: mock companies, periods, vouchers, accounts, ledgers, and reports.
- `src/components/AmountText.tsx`: formatted right-aligned amount.
- `src/components/AccountingPeriodPicker.tsx`: reusable period selector.
- `src/components/ExportActions.tsx`: export button/dropdown.
- `src/components/PageHeaderBar.tsx`: standard title/action strip.
- `src/pages/login/LoginPage.tsx`: login flow.
- `src/pages/companies/CompanySelectPage.tsx`: company selection.
- `src/pages/dashboard/DashboardPage.tsx`: operational landing page.
- `src/pages/vouchers/VoucherListPage.tsx`: voucher search and state actions.
- `src/pages/vouchers/VoucherEditorPage.tsx`: voucher grid editor.
- `src/pages/vouchers/VoucherDetailPage.tsx`: read-only voucher details.
- `src/pages/ledgers/TrialBalancePage.tsx`: trial balance.
- `src/pages/ledgers/GeneralLedgerPage.tsx`: general ledger.
- `src/pages/ledgers/SubsidiaryLedgerPage.tsx`: subsidiary ledger.
- `src/pages/reports/BalanceSheetPage.tsx`: balance sheet.
- `src/pages/reports/IncomeStatementPage.tsx`: income statement.
- `src/styles.css`: global Ant Design friendly accounting styles.
- `src/test/setup.ts`: Testing Library setup.
- `src/services/accountingApi.test.ts`: service behavior tests.
- `src/pages/vouchers/voucherRules.test.ts`: voucher validation tests.

---

### Task 1: Scaffold Vite React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

**Interfaces:**
- Consumes: no project code.
- Produces: `npm run build`, `npm test`, and `npm run dev` commands; app root component `App`.

- [ ] **Step 1: Create package manifest**

Create `package.json`:

```json
{
  "name": "ai-account-test",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ant-design/icons": "^6.1.0",
    "@ant-design/pro-components": "^2.8.10",
    "@tauri-apps/api": "^2.10.1",
    "antd": "^6.4.4",
    "dayjs": "^1.11.19",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.14.0",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.10.0",
    "@types/react": "^18.3.27",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^5.1.0",
    "jsdom": "^29.1.1",
    "typescript": "^5.9.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and installation exits with code 0.

- [ ] **Step 3: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 4: Create app entry**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Account</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Create `src/styles.css`:

```css
:root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", sans-serif;
  color: #1f2329;
  background: #f5f7fa;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1024px;
}

.amount-text {
  display: inline-block;
  min-width: 7em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: "Cascadia Code", "SF Mono", Consolas, monospace;
}
```

Create `src/app/App.tsx`:

```tsx
export function App() {
  return <div>AI Account</div>
}
```

Create `src/app/providers.tsx`:

```tsx
import { App as AntApp, ConfigProvider, theme } from 'antd'
import type { ReactNode } from 'react'
import zhCN from 'antd/locale/zh_CN'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.compactAlgorithm,
        token: {
          colorPrimary: '#1f5fbf',
          borderRadius: 6,
          fontSize: 13,
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  )
}
```

Create `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import 'antd/dist/reset.css'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Verify scaffold**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

Run: `npm test`

Expected: Vitest exits successfully with no tests or a pass message.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "feat: scaffold react accounting frontend"
```

Expected: commit succeeds.

---

### Task 2: Add Domain Types And Mock Accounting API

**Files:**
- Create: `src/services/types.ts`
- Create: `src/mocks/seed.ts`
- Create: `src/services/adapters/mockAdapter.ts`
- Create: `src/services/adapters/tauriAdapter.ts`
- Create: `src/services/accountingApi.ts`
- Create: `src/services/accountingApi.test.ts`

**Interfaces:**
- Consumes: project scaffold.
- Produces: `accountingApi`, `AccountingApi`, `VoucherStatus`, `SaveVoucherInput`, `LedgerQuery`, `ReportQuery`.

- [ ] **Step 1: Write failing service tests**

Create `src/services/accountingApi.test.ts`:

```ts
import { accountingApi } from './accountingApi'

test('mock login returns an admin session for valid credentials', async () => {
  const result = await accountingApi.login({ username: 'admin', password: 'admin123' })

  expect(result.session.user.username).toBe('admin')
  expect(result.session.token).toBeTruthy()
})

test('saving an unbalanced voucher is rejected', async () => {
  await expect(accountingApi.saveVoucher({
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-17',
    voucherWord: '记',
    attachmentCount: 0,
    entries: [
      { id: 'line-1', summary: '测试', accountCode: '1001', accountName: '库存现金', debit: 100, credit: 0 },
      { id: 'line-2', summary: '测试', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 99 },
    ],
  })).rejects.toThrow('借贷不平衡')
})

test('auditing a draft voucher changes its status to approved', async () => {
  const saved = await accountingApi.saveVoucher({
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-17',
    voucherWord: '记',
    attachmentCount: 0,
    entries: [
      { id: 'line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 800, credit: 0 },
      { id: 'line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 800 },
    ],
  })

  await accountingApi.auditVoucher(saved.id)
  const detail = await accountingApi.getVoucher(saved.id)

  expect(detail.status).toBe('approved')
})
```

- [ ] **Step 2: Run tests to verify red**

Run: `npm test -- src/services/accountingApi.test.ts`

Expected: FAIL because `src/services/accountingApi.ts` does not exist.

- [ ] **Step 3: Add domain types**

Create `src/services/types.ts` with the exact interfaces from the design. Include these core definitions:

```ts
export type VoucherStatus = 'draft' | 'approved' | 'reversed'

export interface LoginInput {
  username: string
  password: string
}

export interface User {
  id: string
  username: string
  realName: string
  role: string
}

export interface Session {
  token: string
  user: User
}

export interface LoginResult {
  session: Session
}

export interface Company {
  id: string
  code: string
  name: string
  taxId: string
  accountingSystem: 'small_enterprise' | 'enterprise' | 'non_profit'
  currentPeriodId: string
  status: 'active' | 'archived'
}

export interface AccountingPeriod {
  id: string
  companyId: string
  year: number
  month: number
  status: 'open' | 'closed'
}

export interface VoucherEntry {
  id: string
  summary: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export interface SaveVoucherInput {
  id?: string
  companyId: string
  periodId: string
  voucherDate: string
  voucherWord: string
  attachmentCount: number
  entries: VoucherEntry[]
}

export interface VoucherSummary {
  id: string
  companyId: string
  periodId: string
  voucherDate: string
  voucherNumber: string
  summary: string
  debitTotal: number
  creditTotal: number
  status: VoucherStatus
  createdBy: string
}

export interface VoucherDetail extends VoucherSummary {
  voucherWord: string
  attachmentCount: number
  entries: VoucherEntry[]
}

export interface PagedResult<T> {
  items: T[]
  total: number
}

export interface VoucherQuery {
  companyId: string
  periodId?: string
  status?: VoucherStatus | 'all'
  keyword?: string
  page: number
  pageSize: number
}

export interface LedgerQuery {
  companyId: string
  periodId: string
}

export interface SubsidiaryLedgerQuery extends LedgerQuery {
  accountCode?: string
}

export interface ReportQuery {
  companyId: string
  periodId: string
}

export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export interface TrialBalance {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
}

export interface LedgerEntry {
  voucherDate: string
  voucherNumber: string
  summary: string
  debit: number
  credit: number
  balance: number
}

export interface GeneralLedgerRow extends TrialBalanceRow {
  entries: LedgerEntry[]
}

export type GeneralLedger = GeneralLedgerRow[]
export type SubsidiaryLedger = GeneralLedgerRow[]

export interface ReportRow {
  item: string
  lineNumber: string
  amount: number
}

export interface BalanceSheet {
  assets: ReportRow[]
  liabilitiesAndEquity: ReportRow[]
}

export interface IncomeStatement {
  rows: ReportRow[]
}

export interface ExportInput {
  type: 'voucher' | 'ledger' | 'report'
  format: 'excel' | 'pdf'
  title: string
}

export interface ExportResult {
  success: true
  message: string
}

export interface AccountingApi {
  login(input: LoginInput): Promise<LoginResult>
  checkSession(): Promise<Session | null>
  listCompanies(): Promise<Company[]>
  selectCompany(companyId: string): Promise<Company>
  listPeriods(companyId: string): Promise<AccountingPeriod[]>
  listVouchers(query: VoucherQuery): Promise<PagedResult<VoucherSummary>>
  getVoucher(id: string): Promise<VoucherDetail>
  saveVoucher(input: SaveVoucherInput): Promise<VoucherDetail>
  auditVoucher(id: string): Promise<void>
  reverseAuditVoucher(id: string): Promise<void>
  createRedReversal(id: string): Promise<VoucherDetail>
  getTrialBalance(query: LedgerQuery): Promise<TrialBalance>
  getGeneralLedger(query: LedgerQuery): Promise<GeneralLedger>
  getSubsidiaryLedger(query: SubsidiaryLedgerQuery): Promise<SubsidiaryLedger>
  getBalanceSheet(query: ReportQuery): Promise<BalanceSheet>
  getIncomeStatement(query: ReportQuery): Promise<IncomeStatement>
  exportDocument(input: ExportInput): Promise<ExportResult>
}
```

- [ ] **Step 4: Add mock seed and adapter**

Create `src/mocks/seed.ts` with one active company, one open period, a minimal account list, and two vouchers. Create `src/services/adapters/mockAdapter.ts` implementing all `AccountingApi` methods. `saveVoucher` must calculate totals and throw `new Error('借贷不平衡')` when totals differ. `auditVoucher` must throw `new Error('只能审核草稿凭证')` unless status is `draft`.

- [ ] **Step 5: Add Tauri adapter skeleton and API selector**

Create `src/services/adapters/tauriAdapter.ts`:

```ts
import type { AccountingApi } from '../types'

export const tauriAdapter: AccountingApi = new Proxy({} as AccountingApi, {
  get() {
    return async () => {
      throw new Error('Tauri adapter is not connected yet')
    }
  },
})
```

Create `src/services/accountingApi.ts`:

```ts
import { mockAdapter } from './adapters/mockAdapter'
import { tauriAdapter } from './adapters/tauriAdapter'

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

export const accountingApi = isTauri ? tauriAdapter : mockAdapter
```

- [ ] **Step 6: Verify green**

Run: `npm test -- src/services/accountingApi.test.ts`

Expected: all three tests pass.

Run: `npm run build`

Expected: build passes.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/services src/mocks
git commit -m "feat: add accounting api mock adapter"
```

Expected: commit succeeds.

---

### Task 3: Add Session, Company Flow, And Redirects

**Files:**
- Create: `src/stores/sessionStore.ts`
- Create: `src/stores/companyStore.ts`
- Create: `src/layouts/AuthLayout.tsx`
- Create: `src/pages/login/LoginPage.tsx`
- Create: `src/pages/companies/CompanySelectPage.tsx`
- Create: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/providers.tsx`

**Interfaces:**
- Consumes: `accountingApi.login`, `accountingApi.listCompanies`, `Company`, `Session`.
- Produces: route protection and selected company state.

- [ ] **Step 1: Write failing flow tests**

Create `src/pages/login/LoginPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

test('submits mock credentials and shows no validation error', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('用户名'), 'admin')
  await user.type(screen.getByLabelText('密码'), 'admin123')
  await user.click(screen.getByRole('button', { name: '登录' }))

  expect(await screen.findByText('登录成功')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify red**

Run: `npm test -- src/pages/login/LoginPage.test.tsx`

Expected: FAIL because `LoginPage` does not exist.

- [ ] **Step 3: Implement stores**

Create `sessionStore` with `session`, `login`, and `logout`. Create `companyStore` with `companies`, `selectedCompany`, `periods`, `selectedPeriodId`, `loadCompanies`, `selectCompany`, and `selectPeriod`.

- [ ] **Step 4: Implement login and company selection UI**

Use Ant Design `Form`, `Input`, `Button`, `Alert`, `Card`, and `List`. On successful login show `message.success('登录成功')`, then navigate to `/companies`.

- [ ] **Step 5: Implement router**

Routes:

```text
/login
/companies
/dashboard
*
```

Redirect logic must match the design:

1. no session goes to `/login`
2. session without selected company goes to `/companies`
3. session with selected company goes to `/dashboard`

- [ ] **Step 6: Verify**

Run: `npm test -- src/pages/login/LoginPage.test.tsx`

Expected: pass.

Run: `npm run build`

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src
git commit -m "feat: add login and company selection flow"
```

Expected: commit succeeds.

---

### Task 4: Add Ant Design App Shell And Dashboard

**Files:**
- Create: `src/layouts/AppLayout.tsx`
- Create: `src/components/AccountingPeriodPicker.tsx`
- Create: `src/components/PageHeaderBar.tsx`
- Create: `src/components/AmountText.tsx`
- Create: `src/components/ExportActions.tsx`
- Create: `src/pages/dashboard/DashboardPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: selected company and periods from `companyStore`.
- Produces: shared layout for all protected routes.

- [ ] **Step 1: Write failing layout smoke test**

Create `src/layouts/AppLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

test('renders core accounting navigation', () => {
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )

  expect(screen.getByText('工作台')).toBeInTheDocument()
  expect(screen.getByText('凭证')).toBeInTheDocument()
  expect(screen.getByText('账簿')).toBeInTheDocument()
  expect(screen.getByText('报表')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify red**

Run: `npm test -- src/layouts/AppLayout.test.tsx`

Expected: FAIL because `AppLayout` does not exist.

- [ ] **Step 3: Implement shell**

Use Ant Design `Layout`, `Menu`, `Dropdown`, `Button`, `Typography`, and `Outlet`. Menu entries:

1. `/dashboard` 工作台
2. `/vouchers` 凭证
3. `/ledgers/trial-balance` 科目余额表
4. `/ledgers/general` 总账
5. `/ledgers/subsidiary` 明细账
6. `/reports/balance-sheet` 资产负债表
7. `/reports/income-statement` 利润表

- [ ] **Step 4: Implement dashboard**

Dashboard shows selected company, selected period, voucher counts, quick actions, and recent vouchers from `accountingApi`.

- [ ] **Step 5: Verify**

Run: `npm test -- src/layouts/AppLayout.test.tsx`

Expected: pass.

Run: `npm run build`

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src
git commit -m "feat: add accounting app shell"
```

Expected: commit succeeds.

---

### Task 5: Add Voucher List, Detail, And Editor

**Files:**
- Create: `src/features/vouchers/voucherRules.ts`
- Create: `src/pages/vouchers/voucherRules.test.ts`
- Create: `src/pages/vouchers/VoucherListPage.tsx`
- Create: `src/pages/vouchers/VoucherDetailPage.tsx`
- Create: `src/pages/vouchers/VoucherEditorPage.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: `accountingApi.listVouchers`, `getVoucher`, `saveVoucher`, `auditVoucher`, `reverseAuditVoucher`, `createRedReversal`.
- Produces: working voucher core workflow.

- [ ] **Step 1: Write failing voucher rule tests**

Create `src/pages/vouchers/voucherRules.test.ts`:

```ts
import { getVoucherTotals, isVoucherBalanced } from '../../features/vouchers/voucherRules'

test('calculates debit and credit totals', () => {
  const totals = getVoucherTotals([
    { id: '1', summary: '收入', accountCode: '1002', accountName: '银行存款', debit: 500, credit: 0 },
    { id: '2', summary: '收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 500 },
  ])

  expect(totals).toEqual({ debitTotal: 500, creditTotal: 500 })
})

test('detects unbalanced vouchers', () => {
  expect(isVoucherBalanced([
    { id: '1', summary: '收入', accountCode: '1002', accountName: '银行存款', debit: 500, credit: 0 },
    { id: '2', summary: '收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 499 },
  ])).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify red**

Run: `npm test -- src/pages/vouchers/voucherRules.test.ts`

Expected: FAIL because `voucherRules` does not exist.

- [ ] **Step 3: Implement voucher rules**

Create `src/features/vouchers/voucherRules.ts`:

```ts
import type { VoucherEntry } from '../../services/types'

export function getVoucherTotals(entries: VoucherEntry[]) {
  return entries.reduce(
    (acc, entry) => ({
      debitTotal: acc.debitTotal + Number(entry.debit || 0),
      creditTotal: acc.creditTotal + Number(entry.credit || 0),
    }),
    { debitTotal: 0, creditTotal: 0 },
  )
}

export function isVoucherBalanced(entries: VoucherEntry[]) {
  const { debitTotal, creditTotal } = getVoucherTotals(entries)
  return debitTotal > 0 && Math.abs(debitTotal - creditTotal) < 0.005
}
```

- [ ] **Step 4: Implement voucher pages**

Voucher list uses Ant Design `Table`, `Form`, `Input.Search`, `Select`, `DatePicker`, `Tag`, `Popconfirm`, and `Button`. Voucher editor uses `Form`, `Table`, `Input`, `InputNumber`, `DatePicker`, `Select`, and a sticky totals footer. Save button disabled when `isVoucherBalanced(entries)` is false.

- [ ] **Step 5: Wire routes**

Add routes:

```text
/vouchers
/vouchers/new
/vouchers/:id
/vouchers/:id/edit
```

- [ ] **Step 6: Verify**

Run: `npm test -- src/pages/vouchers/voucherRules.test.ts`

Expected: pass.

Run: `npm run build`

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src
git commit -m "feat: add voucher workflow"
```

Expected: commit succeeds.

---

### Task 6: Add Ledgers, Reports, Export Entry Points, And Final Verification

**Files:**
- Create: `src/pages/ledgers/TrialBalancePage.tsx`
- Create: `src/pages/ledgers/GeneralLedgerPage.tsx`
- Create: `src/pages/ledgers/SubsidiaryLedgerPage.tsx`
- Create: `src/pages/reports/BalanceSheetPage.tsx`
- Create: `src/pages/reports/IncomeStatementPage.tsx`
- Modify: `src/components/ExportActions.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: ledger/report methods from `accountingApi` and selected company/period.
- Produces: first-release core loop complete.

- [ ] **Step 1: Write failing export component test**

Create `src/components/ExportActions.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportActions } from './ExportActions'

test('triggers export success callback', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn().mockResolvedValue(undefined)

  render(<ExportActions title="资产负债表" onExport={onExport} />)

  await user.click(screen.getByRole('button', { name: '导出' }))
  await user.click(screen.getByText('Excel'))

  expect(onExport).toHaveBeenCalledWith('excel')
})
```

- [ ] **Step 2: Run test to verify red**

Run: `npm test -- src/components/ExportActions.test.tsx`

Expected: FAIL because `ExportActions` implementation does not support the expected interaction yet.

- [ ] **Step 3: Implement export component**

`ExportActions` renders an Ant Design `Dropdown` with Excel and PDF actions. It accepts:

```ts
interface ExportActionsProps {
  title: string
  onExport: (format: 'excel' | 'pdf') => Promise<void>
}
```

- [ ] **Step 4: Implement ledger and report pages**

Each page uses the shared period picker, Ant Design `Table`, and `ExportActions`. Show `Empty` when no period is selected. Use right-aligned amount renderers with `AmountText`.

- [ ] **Step 5: Wire routes**

Add routes:

```text
/ledgers/trial-balance
/ledgers/general
/ledgers/subsidiary
/reports/balance-sheet
/reports/income-statement
```

- [ ] **Step 6: Verify unit tests and build**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: build passes.

- [ ] **Step 7: Manual browser verification**

Run: `npm run dev`

Open: `http://127.0.0.1:5173`

Verify:

1. Login with `admin` / `admin123`.
2. Select the demo company.
3. Open voucher list.
4. Create a balanced voucher.
5. Save draft.
6. Audit voucher.
7. Open trial balance.
8. Open balance sheet and income statement.
9. Trigger export action and see success message.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src
git commit -m "feat: add ledgers and reports"
```

Expected: commit succeeds.

---

## Self-Review

Spec coverage:

1. Scaffold and Ant Design system: Task 1.
2. API adapter boundary and mock/Tauri split: Task 2.
3. Login and session: Task 3.
4. Company selection: Task 3.
5. App layout: Task 4.
6. Voucher list, edit, and audit actions: Task 5.
7. Ledgers and reports: Task 6.
8. Export entry points: Task 6.
9. Browser mock mode: Tasks 2 through 6.

Completeness scan:

1. No unresolved markers or undecided sections remain.
2. Deferred features are named as out of scope rather than left ambiguous.

Type consistency:

1. `VoucherEntry`, `SaveVoucherInput`, and voucher rule tests use the same field names.
2. Ledger and report pages consume the same query types produced by Task 2.
3. Export component uses the same `'excel' | 'pdf'` format union as `ExportInput`.
