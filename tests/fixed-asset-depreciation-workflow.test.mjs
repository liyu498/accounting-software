import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("depreciation batches persist reviewable per-asset lines", () => {
  const database = read("src-tauri/src/db.rs");
  const commands = read("src-tauri/src/commands/fixed_assets.rs");
  const vouchers = read("src-tauri/src/commands/vouchers.rs");

  assert.match(database, /LATEST_SCHEMA_VERSION:\s*i64\s*=\s*15/);
  assert.match(database, /name:\s*"fixed_asset_depreciation_lines"/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS fixed_asset_depreciation_lines/);
  assert.match(database, /opening_accumulated_depreciation/);
  assert.match(database, /opening_depreciation_months/);
  assert.match(database, /UNIQUE \(company_id, period, asset_id\)/);

  assert.match(commands, /prepare_fixed_asset_depreciation_batch/);
  assert.match(commands, /get_fixed_asset_depreciation_lines/);
  assert.match(commands, /next_month_period/);
  assert.match(commands, /closing_accumulated_depreciation/);
  assert.match(commands, /已有凭证的折旧批次不能重新计算/);
  assert.match(vouchers, /FROM depreciation_batches[\s\S]*fixed_asset_depreciation_lines/);
  assert.match(vouchers, /UPDATE fixed_asset_depreciation_lines[\s\S]*voucher_id = \?/);
  assert.doesNotMatch(
    vouchers,
    /SUM\(ROUND\(original_value \* \(1 - residual_rate\) \/ useful_life_months/,
  );
});

test("fixed asset workspace calculates and reviews lines before voucher creation", () => {
  const api = read("src/lib/api.ts");
  const workspace = read("src/pages/operations/FixedAssetWorkspace.tsx");
  const voucherEntry = read("src/pages/operations/VoucherEntryWorkspace.tsx");

  assert.match(api, /export interface FixedAssetDepreciationLine/);
  assert.match(api, /prepareDepreciationBatch/);
  assert.match(api, /getDepreciationLines/);
  assert.match(workspace, /计算本期折旧/);
  assert.match(workspace, /折旧明细/);
  assert.match(workspace, /openingAccumulatedDepreciation/);
  assert.match(workspace, /openingDepreciationMonths/);
  assert.match(voucherEntry, /fixedAssetApi\.getDepreciationLines/);
  assert.doesNotMatch(
    voucherEntry,
    /fixedAssetApi\.getFixedAssets\([\s\S]{0,500}折旧批次来源/,
  );
});
