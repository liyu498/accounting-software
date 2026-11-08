import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function rustFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? rustFiles(path)
      : entry.isFile() && entry.name.endsWith(".rs")
        ? [path]
        : [];
  });
}

test("Rust test databases use bounded cross-platform cleanup", () => {
  const support = read("src-tauri/src/test_support.rs");
  assert.match(support, /pub\(crate\) fn remove_test_data_dir/);
  assert.match(support, /remove_dir_all[\s\S]*?thread::sleep/);

  const rustRoot = fileURLToPath(
    new URL("../src-tauri/src/", import.meta.url),
  );
  let cleanupUses = 0;
  for (const path of rustFiles(rustRoot)) {
    const source = readFileSync(path, "utf8");
    cleanupUses += [
      ...source.matchAll(/crate::test_support::remove_test_data_dir/g),
    ].length;
    assert.doesNotMatch(
      source,
      /std::fs::remove_dir_all\([^;]+\)\.(?:expect|unwrap)\(/,
      `${path} must not fail a business test on a transient Windows cleanup lock`,
    );
  }
  assert.ok(cleanupUses > 10, "Rust database tests should share the cleanup helper");
});

test("inventory item queries use stable explicit columns", () => {
  const source = read("src-tauri/src/commands/inventory_items.rs");
  assert.doesNotMatch(source, /SELECT \* FROM inventory_items/);
  assert.match(
    source,
    /const INVENTORY_ITEM_COLUMNS[\s\S]*?unit_id[\s\S]*?updated_at/,
  );
});
