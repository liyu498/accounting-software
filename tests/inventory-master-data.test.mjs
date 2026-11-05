import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("inventory categories and warehouses are persisted as scoped master data", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/inventory_master_data.rs");
  const commandModules = read("src-tauri/src/commands.rs");
  const commandRegistry = read("src-tauri/src/lib.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /structured_inventory_master_data/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_categories/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_warehouses/);
  assert.match(database, /inventory_items ADD COLUMN category_id/);
  assert.match(database, /inventory_movements ADD COLUMN warehouse_id/);
  assert.match(commands, /pub async fn get_inventory_categories/);
  assert.match(commands, /pub async fn create_inventory_category/);
  assert.match(commands, /pub async fn update_inventory_category/);
  assert.match(commands, /pub async fn get_inventory_warehouses/);
  assert.match(commands, /pub async fn create_inventory_warehouse/);
  assert.match(commands, /pub async fn update_inventory_warehouse/);
  assert.match(commands, /authenticated_actor/);
  assert.match(commands, /operation_audit_logs/);
  assert.match(commandModules, /pub mod inventory_master_data/);
  assert.match(commandRegistry, /inventory_master_data::get_inventory_categories/);
  assert.match(commandRegistry, /inventory_master_data::create_inventory_category/);
  assert.match(commandRegistry, /inventory_master_data::update_inventory_category/);
  assert.match(commandRegistry, /inventory_master_data::get_inventory_warehouses/);
  assert.match(commandRegistry, /inventory_master_data::create_inventory_warehouse/);
  assert.match(commandRegistry, /inventory_master_data::update_inventory_warehouse/);
});

test("inventory workspaces select structured category and warehouse records", () => {
  const api = read("src/lib/api.ts");
  const inventoryItems = read("src-tauri/src/commands/inventory_items.rs");
  const inventoryMovements = read("src-tauri/src/commands/inventory_movements.rs");
  const masterWorkspace = read(
    "src/pages/operations/InventoryMasterWorkspace.tsx",
  );
  const movementWorkspace = read(
    "src/pages/operations/InventoryMovementWorkspace.tsx",
  );

  assert.match(api, /export interface InventoryCategory/);
  assert.match(api, /export interface InventoryWarehouse/);
  assert.match(api, /export const inventoryMasterDataApi/);
  assert.match(api, /getInventoryCategories/);
  assert.match(api, /createInventoryCategory/);
  assert.match(api, /updateInventoryCategory/);
  assert.match(api, /getInventoryWarehouses/);
  assert.match(api, /createInventoryWarehouse/);
  assert.match(api, /updateInventoryWarehouse/);
  assert.match(inventoryItems, /category_id/);
  assert.match(inventoryMovements, /warehouse_id/);
  assert.match(masterWorkspace, /inventoryMasterDataApi\.getInventoryCategories/);
  assert.match(masterWorkspace, /categoryId/);
  assert.match(movementWorkspace, /inventoryMasterDataApi\.getInventoryWarehouses/);
  assert.match(movementWorkspace, /warehouseId/);
  assert.match(movementWorkspace, /<select[\s\S]*?请选择仓库/);
});

test("inventory BOMs are versioned scoped master data with audited component lines", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/inventory_master_data.rs");
  const commandRegistry = read("src-tauri/src/lib.rs");
  const api = read("src/lib/api.ts");
  const workspace = read(
    "src/pages/operations/InventoryMasterWorkspace.tsx",
  );

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /versioned_inventory_boms/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_boms/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS inventory_bom_items/);
  assert.match(database, /UNIQUE \(company_id, parent_item_id, version\)/);
  assert.match(database, /UNIQUE \(bom_id, component_item_id\)/);

  assert.match(commands, /pub async fn get_inventory_boms/);
  assert.match(commands, /pub async fn create_inventory_bom/);
  assert.match(commands, /pub async fn update_inventory_bom/);
  assert.match(commands, /物料清单不能引用自身/);
  assert.match(commands, /物料清单不能形成循环引用/);
  assert.match(commands, /同一组件不能重复/);
  assert.match(commands, /operation_audit_logs/);

  assert.match(commandRegistry, /inventory_master_data::get_inventory_boms/);
  assert.match(commandRegistry, /inventory_master_data::create_inventory_bom/);
  assert.match(commandRegistry, /inventory_master_data::update_inventory_bom/);

  assert.match(api, /export interface InventoryBom/);
  assert.match(api, /export interface InventoryBomLine/);
  assert.match(api, /getInventoryBoms/);
  assert.match(api, /createInventoryBom/);
  assert.match(api, /updateInventoryBom/);

  assert.match(workspace, /inventoryMasterDataApi\.getInventoryBoms/);
  assert.match(workspace, /aria-label="物料清单编辑"/);
  assert.match(
    workspace,
    /className="fixed inset-0 z-\[100\][^"]*"[\s\S]*aria-label="物料清单编辑"/,
  );
  assert.match(workspace, /物料清单/);
  assert.match(workspace, /损耗率/);
});
