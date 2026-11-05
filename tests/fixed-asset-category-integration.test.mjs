import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("fixed assets reference structured categories and snapshot accounting policy", () => {
  const database = read("src-tauri/src/db.rs");
  const assets = read("src-tauri/src/commands/fixed_assets.rs");
  const categories = read("src-tauri/src/commands/asset_categories.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /name:\s*"structured_fixed_asset_categories"/);
  assert.match(database, /fixed_assets ADD COLUMN category_id/);
  assert.match(database, /fixed_assets ADD COLUMN depreciation_method/);
  assert.match(database, /fixed_assets ADD COLUMN asset_account/);
  assert.match(database, /UPDATE fixed_assets[\s\S]*SET category_id/);
  assert.match(database, /idx_fixed_assets_category/);
  assert.match(database, /CreateFixedAssetInput[\s\S]*pub category_id: String/);
  assert.match(database, /UpdateFixedAssetInput[\s\S]*pub category_id: String/);

  assert.match(assets, /asset_category_for_asset/);
  assert.match(assets, /FROM asset_categories/);
  assert.match(assets, /已有折旧业务的固定资产不能修改类别/);
  assert.doesNotMatch(assets, /input\.category\.trim\(\)/);
  assert.match(categories, /UPDATE fixed_assets SET category =/);
  assert.match(categories, /已有固定资产引用该类别，不能删除/);
});

test("fixed asset editor selects an enabled category record", () => {
  const api = read("src/lib/api.ts");
  const workspace = read("src/pages/operations/FixedAssetWorkspace.tsx");

  assert.match(api, /export interface FixedAsset[\s\S]*categoryId: string \| null/);
  assert.match(api, /createFixedAsset:[\s\S]*categoryId: string/);
  assert.match(api, /category_id: input\.categoryId/);
  assert.match(workspace, /useAssetCategoryStore/);
  assert.match(workspace, /categoryId/);
  assert.match(workspace, /请选择资产类别/);
  assert.match(workspace, /<select[\s\S]*?请选择资产类别/);
  assert.doesNotMatch(
    workspace,
    /<Field label="资产类别 \*">\s*<input/,
  );
});
