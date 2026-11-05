# CLAUDE.md

This repository is a desktop accounting application built with Tauri 2, React,
TypeScript, Rust, SQLite, Zustand, Tailwind CSS, and Playwright smoke tests.

Use this file as the persistent project context for Claude Code sessions.

## Project Shape

- Frontend source lives in `src/`.
- Tauri and Rust backend source lives in `src-tauri/`.
- SQLite initialization, migrations, seed data, and Tauri commands must stay in
  sync with frontend data models.
- Browser mode is a development preview. It should remain usable even when real
  desktop-only Tauri APIs are unavailable.
- Desktop mode is the real application path. Do not replace real desktop auth or
  persistence with browser preview mocks.

## Development Rules

- Keep changes scoped to the user's requested feature or bug.
- Read the existing implementation before changing behavior.
- Do not rewrite unrelated components, styling, data models, or generated files.
- Do not revert user changes unless the user explicitly asks.
- Prefer existing project patterns over new abstractions.
- When a task touches a shared workflow, update all affected layers together.
- If a change affects accounting behavior, preserve a clear business-rule reason
  in the implementation or final handoff.

## Tauri And Browser Preview

- Do not import `invoke` directly from `@tauri-apps/api/core` in normal app code
  if that code can run in browser preview.
- Route Tauri calls through the shared safe wrapper in `src/lib/tauri.ts`.
- Browser preview fallbacks may return mock or empty data when needed for UI
  development, but they must not pretend to be the real desktop persistence
  layer.
- If a page says it can only run in the desktop app, first check whether a
  development-preview fallback would be more useful than a hard blocker.

## Accounting Business Rules

- Company creation must include `纳税人识别号` / `tax_id`.
- Company creation must include `会计制度选择` / `accounting_system`.
- After company creation, `accounting_system` is locked in normal edit flows.
- Account subjects, financial statements, and seeded data must follow the
  selected accounting system.
- If `accounting_system` changes are involved, check frontend form labels,
  Zustand store types, Rust command inputs, SQLite schema/defaults, and seed
  routines together.
- Normal company updates should not silently allow editing creation-time locked
  accounting configuration.

## Common Files To Check

- `src/lib/tauri.ts`
- `src/stores/authStore.ts`
- `src/stores/companyStore.ts`
- `src/pages/LoginPage.tsx`
- `src/pages/Welcome.tsx`
- `src-tauri/src/commands/companies.rs`
- `src-tauri/src/db.rs`

## Verification Commands

Run the smallest useful verification set for the change.

Frontend type/build check:

```powershell
npm run build
```

Tauri/Rust check:

```powershell
cd src-tauri
cargo check
```

Browser development preview:

```powershell
npm run dev
```

Desktop development app:

```powershell
npm run tauri -- dev
```

Use the maintained route audits for browser smoke coverage. The content audit
waits for lazy route content and rejects blank, duplicated, or runtime-error
pages; the visual audit checks every route in desktop/mobile and light/dark
modes:

```powershell
npm run verify:route-content
npm run verify:routes
```

## SQLite Recovery Note

If schema or seed data changes appear not to apply, check whether the desktop app
or leftover `cargo`/`node` processes are holding the database open. The app data
database has previously lived at:

```text
C:\Users\liyu498\AppData\Roaming\com.accounting.agent\accounting.db
```

Stop the app and related dev processes before rebuilding or removing that
database.

## Handoff Format

When context is getting long, stop and produce a handoff with:

- Task goal
- Current branch/worktree
- Files changed
- Key decisions and business rules
- Verification commands already run and their results
- Remaining risks or blockers
- Exact next steps
