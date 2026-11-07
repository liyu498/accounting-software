import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const backupsSource = readFileSync(
  new URL("../src-tauri/src/commands/backups.rs", import.meta.url),
  "utf8",
);

test("staged restore snapshots are synced through a writable file handle", () => {
  assert.match(
    backupsSource,
    /OpenOptions::new\(\)[\s\S]*?\.write\(true\)[\s\S]*?\.open\(&staging\)[\s\S]*?\.sync_all\(\)/,
    "Windows requires a writable handle before FlushFileBuffers can persist the staged restore snapshot",
  );
});
