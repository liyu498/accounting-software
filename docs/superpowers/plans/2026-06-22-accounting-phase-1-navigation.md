# Accounting Desktop Phase 1 Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable desktop information architecture for the agency bookkeeping app, aligned with the observed competitor modules and using a redesigned page style instead of preserving the old half-finished screens.

**Architecture:** Keep the existing Tauri + React shell and local app foundation, but route the main product surface to newly designed competitor-style pages. Existing old pages may remain in the repository temporarily for reference, but they should not be the primary UI for vouchers, invoices, reports, settings, or tax workflows. Add generic operational pages for modules that need consistent query bar, toolbar, table, status, and export affordances.

**Tech Stack:** React 19, React Router, TypeScript, Tailwind CSS, lucide-react, existing Zustand stores where already present.

---

### Task 1: Add Competitor-Aligned Module Pages

**Files:**
- Create: `src/pages/operations/BusinessModulePage.tsx`
- Create: `src/pages/tax/TaxWorkspace.tsx`

- [ ] **Step 1: Create a reusable business module page**

Implement a dense operation page with query controls, toolbar actions, summary strips, a horizontally scrollable table, status tags, source/voucher/attachment columns, and export/print buttons.

- [ ] **Step 2: Create a tax declaration workspace**

Implement a tax workbench with declaration status flow, validation findings, snapshot/log placeholders, and explicit adapter boundary text for real tax bureau submission.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: TypeScript and Vite build pass.

### Task 2: Wire Routes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the new module pages**

Import `BusinessModulePage` and `TaxWorkspace`.

- [ ] **Step 2: Add missing business-processing routes**

Add routes for invoice selection, bills, documents, transfers, employees, payroll, social security, special deductions, depreciation, inventory settings, and units.

- [ ] **Step 3: Add tax workspace and settings routes**

Route the tax declaration workspace under `/tax/workspace` and add settings pages for declaration initialization, history ledgers, customers, projects, departments, tags, asset categories, invoice matching rules, and bill matching rules.

### Task 3: Update Navigation IA

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Expand business navigation**

Expose all observed business modules in the sidebar in the competitor order.

- [ ] **Step 2: Expand finance/report/tax/settings navigation**

Add risk check, quarterly reports, tax workspace, and missing settings modules while keeping existing functional pages linked.

- [ ] **Step 3: Improve header context**

Show desktop period/status context and keep the company selector as the primary tenant switcher.

### Task 4: Final Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Inspect git diff**

Run: `git status --short && git diff --stat`
Expected: Only planned docs and frontend files changed.
