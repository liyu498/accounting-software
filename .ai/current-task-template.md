# Current Task Template

Copy this into a new Claude Code session when starting a focused task.

```text
Project:
C:\Users\liyu498\Desktop\CC-TEST\accounting-software-new-tauri

Task:
[Describe exactly one feature, bug, or workflow.]

User-visible problem:
[What I see in the app, including exact error text or broken page.]

Expected behavior:
[What should happen instead.]

Scope:
- Only modify files needed for this task.
- Do not refactor unrelated code.
- Preserve browser preview usability.
- Preserve real Tauri desktop behavior.

Accounting constraints:
- Company creation requires 纳税人识别号 / tax_id when relevant.
- Company creation requires 会计制度选择 / accounting_system when relevant.
- accounting_system is locked after company creation in normal edit flows.
- If a database/accounting model changes, check frontend, store, Rust command,
  SQLite schema/defaults, and seed data together.

Suggested starting points:
- Read CLAUDE.md first.
- Check git status and current diff before editing.
- Search existing code before proposing a new abstraction.

Relevant files or areas:
[List likely files, pages, stores, commands, tests, or leave blank.]

Verification required:
- Run npm run build if frontend or shared TypeScript changed.
- Run cd src-tauri && cargo check if Rust, command, schema, or Tauri changed.
- Run the relevant test-*.cjs smoke script if this task maps to one.
- For UI changes, verify browser preview or desktop app as appropriate.

Final response should include:
- Files changed
- Behavior changed
- Verification commands and results
- Remaining risks or follow-up work
```

## Handoff Request

Use this when the current session is getting too long:

```text
Please stop coding and create a handoff for the next Claude Code session.

Include:
- Task goal
- Current branch/worktree
- Files changed
- Important decisions and business rules
- Verification commands already run and exact results
- Remaining risks or blockers
- Exact next steps
```

## Parallel Worktree Pattern

Use one worktree per independent feature:

```powershell
cd C:\Users\liyu498\Desktop\CC-TEST\accounting-software-new-tauri

git worktree add ..\acct-voucher -b codex/voucher-flow
git worktree add ..\acct-reports -b codex/reports-flow
git worktree add ..\acct-company -b codex/company-settings
```

Then open each folder in a separate VS Code window and keep each Claude Code
session focused on only that worktree's task.
