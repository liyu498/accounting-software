import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function commandBody(source, command) {
  const marker = `pub async fn ${command}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing command ${command}`);
  const next = source.indexOf("#[tauri::command]", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("tax deadlines are source-backed rules with explicit workday overrides", () => {
  const db = read("src-tauri/src/db.rs");
  const automation = read("src-tauri/src/commands/automation.rs");
  const lib = read("src-tauri/src/lib.rs");

  assert.match(db, /CREATE TABLE IF NOT EXISTS tax_deadline_rules/);
  assert.match(db, /source_name TEXT NOT NULL/);
  assert.match(db, /effective_from TEXT NOT NULL/);
  assert.match(db, /adjustment_policy TEXT NOT NULL/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS tax_calendar_days/);
  assert.match(db, /day_type TEXT NOT NULL/);
  assert.match(db, /UNIQUE \(company_id, calendar_date\)/);

  for (const command of [
    "get_tax_deadline_rules",
    "upsert_tax_deadline_rule",
    "get_tax_calendar_days",
    "upsert_tax_calendar_day",
    "get_tax_declaration_schedules",
  ]) {
    assert.match(automation, new RegExp(`pub async fn ${command}\\(`));
    assert.match(lib, new RegExp(`commands::automation::${command}`));
  }

  for (const command of [
    "upsert_tax_deadline_rule",
    "upsert_tax_calendar_day",
  ]) {
    const body = commandBody(automation, command);
    assert.match(body, /auth_token: String/);
    assert.match(body, /authenticated_actor/);
    assert.match(body, /operation_audit_logs/);
  }
  assert.match(automation, /fn calculate_tax_due_date/);
  assert.match(automation, /next_workday/);
  assert.match(automation, /tax_calendar_days/);
});

test("calendar and initialization use calculated schedules without invented dates", () => {
  const api = read("src/lib/api.ts");
  const preview = read("src/lib/tauri.ts");
  const calendar = read("src/pages/tax/DeclarationCalendarWorkspace.tsx");
  const initialization = read(
    "src/pages/operations/InitializationWorkspace.tsx",
  );

  assert.match(api, /export interface TaxDeadlineRule/);
  assert.match(api, /export interface TaxDeclarationSchedule/);
  assert.match(api, /getTaxDeclarationSchedules/);
  assert.match(api, /upsertTaxDeadlineRule/);
  assert.match(api, /upsertTaxCalendarDay/);
  assert.match(preview, /get_tax_deadline_rules/);
  assert.match(preview, /get_tax_declaration_schedules/);

  assert.match(calendar, /getTaxDeclarationSchedules/);
  assert.match(calendar, /schedule\.dueDate/);
  assert.match(calendar, /规则未配置/);
  assert.doesNotMatch(calendar, /截止日待配置/);
  assert.match(initialization, /期限规则/);
  assert.match(initialization, /法定来源/);
  assert.match(initialization, /工作日调整/);
});
