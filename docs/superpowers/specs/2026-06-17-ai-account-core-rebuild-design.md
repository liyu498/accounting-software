# AI Account Core Rebuild Design

Date: 2026-06-17

## Goal

Build a new frontend for the accounting desktop product in `C:\Users\liyu498\Desktop\ai_account-TEST`.

The old project at `C:\Users\liyu498\Desktop\CC-TEST\accounting-software-new-tauri` is reference material only. The new frontend should not copy the old page structure wholesale. It should preserve the core accounting workflow and leave a clean integration path for the existing Tauri/Rust/SQLite backend.

First release scope: core accounting loop.

1. Login and session state
2. Company/account set selection
3. Main app layout
4. Voucher list
5. Voucher create/edit
6. Voucher audit actions
7. General ledger, subsidiary ledger, and trial balance
8. Balance sheet and income statement
9. Export entry points

Out of first release scope:

1. Invoice workflows
2. Inventory
3. Bank reconciliation
4. AI bookkeeping
5. Tax reports
6. Full role and permission management
7. Full settings center

These can appear as disabled menu entries if needed, but they should not drive the first implementation.

## Design Read

This is a desktop accounting product for Chinese bookkeeping users. The interface should feel professional, dense, predictable, and operational. It should use Ant Design's enterprise application language, not a marketing site style.

Design dials:

1. Design variance: 3
2. Motion intensity: 2
3. Visual density: 7

The product should optimize for repeated daily work: fast scanning, keyboard-friendly forms, dense tables, clear audit states, and reliable export flows.

## Technical Foundation

Use a new Vite React TypeScript frontend.

Recommended stack:

1. React
2. TypeScript
3. Vite
4. React Router
5. Ant Design
6. ProComponents where they fit real accounting workflows
7. Zustand for small cross-page state

Ant Design should provide the main component system:

1. Layout
2. Menu
3. Table
4. Form
5. Modal
6. Drawer
7. Tabs
8. Button
9. Select
10. DatePicker
11. App notification/message APIs

ProComponents may be used for:

1. ProLayout or a local layout inspired by ProLayout
2. ProTable for dense searchable lists
3. ProForm for structured forms

Use ProComponents only when it reduces code and improves consistency. For highly specialized accounting input, such as voucher entry grids, build focused local components instead of forcing generic ProForm or ProTable behavior.

## Project Shape

Proposed source structure:

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  layouts/
    AppLayout.tsx
    AuthLayout.tsx
  pages/
    login/
    companies/
    dashboard/
    vouchers/
    ledgers/
    reports/
  features/
    auth/
    companies/
    vouchers/
    ledgers/
    reports/
  services/
    adapters/
      mockAdapter.ts
      tauriAdapter.ts
    accountingApi.ts
    types.ts
  stores/
    sessionStore.ts
    companyStore.ts
    uiStore.ts
  components/
    AmountText.tsx
    AccountingPeriodPicker.tsx
    ExportActions.tsx
    PageHeaderBar.tsx
  mocks/
    seed.ts
```

The `features` folder holds domain-specific components and helpers. The `pages` folder wires those features to routes. The `services` folder owns all data access and shields UI code from whether data comes from mock data or Tauri.

## Routing

First release routes:

```text
/login
/companies
/dashboard
/vouchers
/vouchers/new
/vouchers/:id
/vouchers/:id/edit
/ledgers/trial-balance
/ledgers/general
/ledgers/subsidiary
/reports/balance-sheet
/reports/income-statement
```

The root route should redirect based on session and selected company:

1. Not logged in: `/login`
2. Logged in but no selected company: `/companies`
3. Logged in with selected company: `/dashboard`

## App Layout

Use a two-level enterprise layout:

1. Left sidebar for primary modules
2. Top header for selected company, accounting period, user menu, and global actions

Primary menu groups:

1. Workbench
2. Vouchers
3. Ledgers
4. Reports
5. Settings

The first release should enable Workbench, Vouchers, Ledgers, and Reports. Settings can contain only company/accounting-period essentials or be deferred.

The layout must work in a desktop window first. Mobile layout is not a first-release priority, but the app should not break at narrower widths.

## Core Pages

### Login

Purpose: authenticate a user and start a session.

Behavior:

1. Form fields: username and password
2. Shows loading state during login
3. Shows inline error for failed login
4. Stores session in `sessionStore`
5. Redirects to company selection after login

Development mode can use mock credentials. The UI should still call the service layer, not hardcode login behavior in the component.

### Company Selection

Purpose: choose the active accounting company/account set.

Behavior:

1. Shows company list with accounting system, tax ID, current period, and status
2. Allows selecting a company
3. Stores selected company in `companyStore`
4. Redirects to dashboard

Create/edit company is not first-release core unless needed for testing.

### Dashboard

Purpose: operational landing page for the selected company and current period.

Content:

1. Current company and period
2. Voucher status counts
3. Trial balance health signal
4. Quick actions for new voucher, voucher list, trial balance, and reports
5. Recent vouchers

Avoid decorative dashboards. Cards should summarize real workflow status.

### Voucher List

Purpose: find, review, audit, and export vouchers.

Use Ant Design Table or ProTable.

Columns:

1. Voucher date
2. Voucher number
3. Summary
4. Debit amount
5. Credit amount
6. Status
7. Created by
8. Actions

Filters:

1. Accounting period
2. Status
3. Date range
4. Keyword

Actions:

1. New voucher
2. View
3. Edit draft
4. Audit draft
5. Reverse audit approved voucher
6. Red reversal approved voucher
7. Export

Dangerous actions must use confirmation dialogs. Draft-only and approved-only actions must be visibly disabled or hidden based on voucher state.

### Voucher Create/Edit

Purpose: fast voucher entry.

This page should use a specialized voucher grid, not a generic table form.

Fields:

1. Voucher word
2. Voucher number
3. Voucher date
4. Attachment count
5. Entry rows
6. Summary
7. Account subject
8. Debit amount
9. Credit amount

Behavior:

1. Debit and credit totals always visible
2. Balance state clearly shown
3. Save disabled when voucher is unbalanced
4. Keyboard navigation between cells
5. Add/remove entry rows
6. Account selector supports code/name search
7. Draft save first, audit as separate action

First release can implement a practical keyboard model without matching every shortcut from legacy desktop accounting tools.

### Ledgers

Purpose: inspect accounting results after voucher entry and audit.

Pages:

1. Trial balance
2. General ledger
3. Subsidiary ledger

Shared behavior:

1. Accounting period filter
2. Account subject filter where appropriate
3. Dense numeric tables
4. Export action
5. Empty state when no period is selected
6. Loading state that preserves table shape

Amounts should use tabular numerals and right alignment.

### Reports

Purpose: generate first-release statutory reports.

Pages:

1. Balance sheet
2. Income statement

Behavior:

1. Company and period header
2. Report table matching accounting report structure
3. Export action
4. Clear unbalanced or missing-data warnings

Cash flow statement and equity change statement are deferred.

## Data And Adapter Design

All UI data access goes through `accountingApi`.

```ts
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

Adapters:

1. `mockAdapter`: local deterministic data for browser development
2. `tauriAdapter`: invokes Tauri commands when running in desktop mode

Adapter selection should be centralized:

1. If Tauri globals exist, use `tauriAdapter`
2. Otherwise, use `mockAdapter`

The mock adapter should model real accounting constraints:

1. Vouchers have draft, approved, and reversed states
2. Voucher entries must balance
3. Approved vouchers cannot be edited directly
4. Reports derive from seeded voucher/account data where practical

## Integration With Old Backend

The old project is used for command names, data models, and business rules.

Important legacy concepts to preserve:

1. Company includes `tax_id`
2. Company includes `accounting_system`
3. `accounting_system` is locked after creation in normal edit flows
4. Accounting periods drive voucher and report queries
5. Browser preview must stay usable with mock data
6. Real desktop persistence belongs to Tauri/Rust/SQLite

Do not delete or reset the old production database during this rebuild.

When the new frontend later connects to Tauri, map service methods to existing or newly added commands. Do not import `@tauri-apps/api/core` directly in page components.

## State Management

Use Zustand for app-level state only:

1. Session
2. Selected company
3. Selected accounting period
4. UI preferences such as collapsed sidebar

Avoid storing table result sets globally unless multiple pages genuinely share them. Page-level query state should stay close to pages.

## Visual And Interaction Rules

Use Ant Design tokens as the default visual system.

Theme direction:

1. Light theme first
2. Compact density
3. Restrained blue as primary action color
4. Semantic colors for success, warning, and error
5. No marketing gradients
6. No oversized hero sections
7. No decorative cards without workflow purpose

Accounting tables:

1. Right-align amounts
2. Use tabular numerals
3. Keep row heights compact
4. Use sticky headers when helpful
5. Preserve clear hover and selected states

Forms:

1. Labels should be explicit
2. Required fields should be obvious
3. Validation should appear near the field
4. Destructive actions should require confirmation

## Error Handling

Service calls should return or throw typed errors where practical.

UI behavior:

1. Login errors appear inline
2. Page-level load errors show retry action
3. Save/audit/export errors use Ant Design App message or notification
4. Validation errors appear in the form
5. Unknown errors show a concise fallback message

## Testing And Verification

First implementation should support:

1. TypeScript build
2. Vite production build
3. A small smoke test or manual browser verification for the core route flow

Minimum manual verification:

1. Login with mock credentials
2. Select a company
3. Open voucher list
4. Create a balanced voucher
5. Save draft
6. Audit voucher
7. View trial balance
8. Open balance sheet and income statement
9. Trigger export action

## Implementation Phasing

Phase 1: scaffold and shell

1. Create Vite React TypeScript app
2. Install Ant Design dependencies
3. Add app providers, router, layouts, and theme
4. Add service adapter interfaces
5. Add mock seed data

Phase 2: session and company flow

1. Login page
2. Session store
3. Company selection page
4. Redirect rules

Phase 3: voucher workflow

1. Voucher list
2. Voucher editor
3. Draft save
4. Audit and reverse actions
5. State-aware action availability

Phase 4: ledgers and reports

1. Trial balance
2. General ledger
3. Subsidiary ledger
4. Balance sheet
5. Income statement
6. Export entry points

Phase 5: desktop integration prep

1. Add Tauri adapter skeleton
2. Map service methods to legacy command names
3. Document command gaps
4. Verify browser mock mode still works

## Implementation Decisions

1. Build a local Ant Design layout with `Layout`, `Menu`, and route metadata first. Add ProLayout later only if the local layout becomes a maintenance burden.
2. Use React 18 for first implementation because it is the most stable choice for Ant Design and ProComponents ecosystem compatibility.
3. Implement export as a service method with mock success first. Add real browser-side Excel generation after ledger and report table structures stabilize.

Rationale:

1. The product is a Tauri desktop app, so a lighter local shell avoids unnecessary web-admin assumptions.
2. React 18 reduces dependency risk during the rebuild.
3. Export behavior depends on finalized accounting table shapes, so the API boundary should come before file-generation implementation.
