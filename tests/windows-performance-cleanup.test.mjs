import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const performanceSource = readFileSync(
  new URL("../src-tauri/src/release_performance.rs", import.meta.url),
  "utf8",
);
const testSupportSource = readFileSync(
  new URL("../src-tauri/src/test_support.rs", import.meta.url),
  "utf8",
);

test("release performance cleanup retries transient Windows file locks", () => {
  assert.match(
    testSupportSource,
    /fn remove_test_data_dir[\s\S]*?remove_dir_all[\s\S]*?thread::sleep/,
    "performance fixtures should wait briefly for Windows to release SQLite handles",
  );
  assert.equal(
    [...performanceSource.matchAll(/test_support::remove_test_data_dir\(&data_dir,/g)].length,
    2,
    "both performance fixtures should use the bounded cleanup helper",
  );
});
