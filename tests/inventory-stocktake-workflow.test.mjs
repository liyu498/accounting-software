import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("inventory stocktakes snapshot book stock and create audited adjustments", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/inventory_stocktakes.rs");
  const movementCommands = read("src-tauri/src/commands/inventory_movements.rs");
  const commandModules = read("src-tauri/src/commands.rs");
  const registration = read("src-tauri/src/lib.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /name:\s*"audited_inventory_stocktakes"/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_stocktakes/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_stocktake_lines/);
  assert.match(database, /source_movement_max_rowid/);
  assert.match(database, /actual_unit_cost/);
  assert.match(database, /voucher_id/);

  for (const command of [
    "get_inventory_stocktakes",
    "get_inventory_stocktake_lines",
    "create_inventory_stocktake",
    "add_inventory_stocktake_line",
    "save_inventory_stocktake_count",
    "confirm_inventory_stocktake",
    "void_inventory_stocktake",
  ]) {
    assert.match(commands, new RegExp(`pub async fn ${command}\\b`));
    assert.match(registration, new RegExp(`inventory_stocktakes::${command},`));
  }
  assert.match(commandModules, /pub mod inventory_stocktakes;/);
  assert.match(commands, /authenticated_actor/);
  assert.match(commands, /operation_audit_logs/);
  assert.match(commands, /risk_level[\s\S]*high/);
  assert.match(commands, /INSERT INTO inventory_movements/);
  assert.match(commands, /["']盘盈入库["']/);
  assert.match(commands, /["']盘亏出库["']/);
  assert.match(commands, /INSERT INTO vouchers/);
  assert.match(commands, /INSERT INTO voucher_entries/);
  assert.match(commands, /待处理财产损溢/);
  assert.match(commands, /source_movement_max_rowid/);
  assert.match(movementCommands, /盘盈入库.*盘点确认流程/s);
  assert.match(movementCommands, /盘亏出库.*盘点确认流程/s);
});

test("inventory stocktake workspace has a dedicated count and review flow", () => {
  const api = read("src/lib/api.ts");
  const app = read("src/App.tsx");
  const shell = read("src/components/layout/AppShell.tsx");
  const registry = read("src/pages/operations/businessModuleRegistry.ts");
  const verifier = read("scripts/verify-module-frameworks.mjs");
  const workspace = read("src/pages/operations/InventoryStocktakeWorkspace.tsx");
  const movementWorkspace = read("src/pages/operations/InventoryMovementWorkspace.tsx");

  assert.match(api, /export interface InventoryStocktake/);
  assert.match(api, /export interface InventoryStocktakeLine/);
  assert.match(api, /export const inventoryStocktakeApi/);
  for (const method of [
    "getInventoryStocktakes",
    "getInventoryStocktakeLines",
    "createInventoryStocktake",
    "addInventoryStocktakeLine",
    "saveInventoryStocktakeCount",
    "confirmInventoryStocktake",
    "voidInventoryStocktake",
  ]) {
    assert.match(api, new RegExp(`${method}: async`));
    assert.match(workspace, new RegExp(`inventoryStocktakeApi\\.${method}`));
  }
  assert.match(app, /path="\/inventory\/stocktakes"[\s\S]*InventoryStocktakeWorkspace/);
  assert.match(shell, /label: '库存盘点'[\s\S]*path: '\/inventory\/stocktakes'/);
  assert.match(registry, /'inventoryStocktake'/);
  assert.match(verifier, /kind: 'inventoryStocktake'[\s\S]*path: '\/inventory\/stocktakes'/);
  assert.match(workspace, /账面数量/);
  assert.match(workspace, /实盘数量/);
  assert.match(workspace, /盘盈\/盘亏/);
  assert.match(workspace, /确认盘点并生成调整/);
  assert.doesNotMatch(movementWorkspace, /"盘盈入库"/);
  assert.doesNotMatch(movementWorkspace, /"盘亏出库"/);
});
