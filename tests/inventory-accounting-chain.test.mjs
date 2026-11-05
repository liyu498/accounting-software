import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const inventoryValuationModule = await import(
  "../src/lib/inventoryValuation.js"
).catch(() => null);

test("moving weighted valuation derives outbound cost and blocks negative stock", () => {
  assert.notEqual(
    inventoryValuationModule,
    null,
    "inventory valuation workflow is missing",
  );
  const calculate = inventoryValuationModule.calculateInventoryConfirmation;

  assert.deepEqual(
    calculate({
      direction: "inbound",
      quantity: 10,
      enteredAmount: 123.45,
      balanceQuantity: 2,
      balanceAmount: 20,
    }),
    {
      unitCost: 12.345,
      amount: 123.45,
      endingQuantity: 12,
      endingAmount: 143.45,
    },
  );
  assert.deepEqual(
    calculate({
      direction: "outbound",
      quantity: 4,
      enteredAmount: 999,
      balanceQuantity: 10,
      balanceAmount: 123.45,
    }),
    {
      unitCost: 12.345,
      amount: 49.38,
      endingQuantity: 6,
      endingAmount: 74.07,
    },
  );
  assert.throws(
    () =>
      calculate({
        direction: "outbound",
        quantity: 11,
        enteredAmount: 0,
        balanceQuantity: 10,
        balanceAmount: 123.45,
      }),
    /负库存/,
  );
  assert.throws(
    () =>
      calculate({
        direction: "inbound",
        quantity: 1,
        enteredAmount: 0,
        balanceQuantity: 0,
        balanceAmount: 0,
      }),
    /入库金额/,
  );
});

test("inventory persistence and UI expose an auditable valuation chain", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/inventory_movements.rs");
  const commandRegistry = read("src-tauri/src/lib.rs");
  const api = read("src/lib/api.ts");
  const movementWorkspace = read(
    "src/pages/operations/InventoryMovementWorkspace.tsx",
  );

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /audited_inventory_valuation/);
  assert.match(database, /inventory_item_id/);
  assert.match(database, /valuation_method/);
  assert.match(database, /unit_cost/);
  assert.match(commands, /confirm_inventory_movement/);
  assert.match(commands, /get_inventory_stock_balances/);
  assert.match(commands, /create_cost_carryover_from_inventory_movement/);
  assert.doesNotMatch(
    commandRegistry,
    /cost_carryover_records::create_cost_carryover_record/,
  );
  assert.match(commands, /负库存/);
  assert.match(commandRegistry, /confirm_inventory_movement/);
  assert.match(api, /confirmInventoryMovement/);
  assert.match(api, /getInventoryStockBalances/);
  assert.match(api, /createCostCarryoverFromInventoryMovement/);
  assert.doesNotMatch(api, /createCostCarryoverRecord/);
  assert.match(movementWorkspace, /inventoryItemApi\.getInventoryItems/);
  assert.match(movementWorkspace, /inventoryItemId/);
  assert.match(movementWorkspace, /核验\s*<\/button>/);
});
