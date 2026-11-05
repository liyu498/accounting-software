import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("inventory opening balances are locked through an audited period workflow", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/inventory_opening.rs");
  const commandModules = read("src-tauri/src/commands.rs");
  const commandRegistry = read("src-tauri/src/lib.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /audited_inventory_opening_balances/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_opening_balances/);
  assert.match(database, /inventory_opening_finalized_at/);
  assert.match(commands, /pub async fn get_inventory_opening_balances/);
  assert.match(commands, /pub async fn save_inventory_opening_balance/);
  assert.match(commands, /pub async fn delete_inventory_opening_balance/);
  assert.match(commands, /pub async fn finalize_inventory_opening_balances/);
  assert.match(commands, /initial_balances_finalized_at/);
  assert.match(commands, /INSERT INTO inventory_movements/);
  assert.match(commands, /operation_audit_logs/);
  assert.match(commands, /authenticated_actor/);
  assert.match(commandModules, /pub mod inventory_opening/);
  assert.match(commandRegistry, /inventory_opening::get_inventory_opening_balances/);
  assert.match(commandRegistry, /inventory_opening::save_inventory_opening_balance/);
  assert.match(commandRegistry, /inventory_opening::delete_inventory_opening_balance/);
  assert.match(commandRegistry, /inventory_opening::finalize_inventory_opening_balances/);
});

test("inventory opening workspace reconciles quantity detail to financial opening balances", () => {
  const api = read("src/lib/api.ts");
  const app = read("src/App.tsx");
  const shell = read("src/components/layout/AppShell.tsx");
  const registry = read("src/pages/operations/businessModuleRegistry.ts");
  const verifier = read("scripts/verify-module-frameworks.mjs");
  const workspace = read(
    "src/pages/operations/InventoryOpeningWorkspace.tsx",
  );

  assert.match(api, /export interface InventoryOpeningBalance/);
  assert.match(api, /export interface InventoryOpeningReconciliation/);
  assert.match(api, /export const inventoryOpeningApi/);
  assert.match(api, /getInventoryOpeningBalances/);
  assert.match(api, /saveInventoryOpeningBalance/);
  assert.match(api, /deleteInventoryOpeningBalance/);
  assert.match(api, /finalizeInventoryOpeningBalances/);
  assert.match(app, /path="\/inventory\/opening" element={<InventoryOpeningWorkspace\s*\/>}/);
  assert.match(shell, /label:\s*'期初库存'.*path:\s*'\/inventory\/opening'/);
  assert.match(registry, /'inventoryOpening'/);
  assert.match(verifier, /kind:\s*'inventoryOpening'.*path:\s*'\/inventory\/opening'/);
  assert.match(workspace, /inventoryOpeningApi\.getInventoryOpeningBalances/);
  assert.match(workspace, /inventoryOpeningApi\.saveInventoryOpeningBalance/);
  assert.match(workspace, /inventoryOpeningApi\.deleteInventoryOpeningBalance/);
  assert.match(workspace, /inventoryOpeningApi\.finalizeInventoryOpeningBalances/);
  assert.match(workspace, /账面期初/);
  assert.match(workspace, /差异/);
  assert.match(workspace, /确认并锁定/);
});
