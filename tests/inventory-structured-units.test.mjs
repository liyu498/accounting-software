import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("inventory items reference structured measurement units", () => {
  const database = read("src-tauri/src/db.rs");
  const items = read("src-tauri/src/commands/inventory_items.rs");
  const units = read("src-tauri/src/commands/units.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /name:\s*"structured_inventory_measurement_units"/);
  assert.match(database, /inventory_items ADD COLUMN unit_id/);
  assert.match(database, /UPDATE inventory_items[\s\S]*SET unit_id/);
  assert.match(database, /idx_inventory_items_unit/);
  assert.match(database, /pub unit_id: Option<String>/);
  assert.match(database, /CreateInventoryItemInput[\s\S]*pub unit_id: String/);
  assert.match(database, /UpdateInventoryItemInput[\s\S]*pub unit_id: String/);

  assert.match(items, /inventory_unit_for_item/);
  assert.match(items, /FROM measurement_units/);
  assert.match(items, /已有库存业务的存货不能更换计量单位/);
  assert.match(items, /unit_id/);
  assert.doesNotMatch(items, /input\.unit\.trim\(\)/);
  assert.match(units, /UPDATE inventory_items SET unit =/);
  assert.match(units, /已有库存业务/);
});

test("inventory editor selects an enabled unit record instead of accepting free text", () => {
  const api = read("src/lib/api.ts");
  const workspace = read("src/pages/operations/InventoryMasterWorkspace.tsx");

  assert.match(api, /export interface InventoryItem[\s\S]*unitId: string \| null/);
  assert.match(api, /createInventoryItem:[\s\S]*unitId: string/);
  assert.match(api, /unit_id: input\.unitId/);
  assert.match(workspace, /measurementUnitApi\.getMeasurementUnits/);
  assert.match(workspace, /unitId/);
  assert.match(workspace, /请选择计量单位/);
  assert.match(workspace, /<select[\s\S]*?请选择计量单位/);
  assert.doesNotMatch(workspace, /placeholder="件、吨、千克"/);
});
