import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const annotationModule = await import(
  "../src/lib/voucherAnnotationWorkflow.js"
).catch(() => null);

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voucher annotations normalize content and reject invalid input", () => {
  assert.notEqual(annotationModule, null, "voucher annotation workflow helper is missing");

  assert.equal(
    annotationModule.normalizeVoucherAnnotation("  请复核外币汇率。  "),
    "请复核外币汇率。",
  );
  assert.throws(
    () => annotationModule.normalizeVoucherAnnotation("   "),
    /批注内容不能为空/,
  );
  assert.throws(
    () => annotationModule.normalizeVoucherAnnotation("批".repeat(501)),
    /不能超过 500 个字符/,
  );
});

test("voucher annotations create one scoped payload per selected voucher", () => {
  assert.notEqual(annotationModule, null, "voucher annotation workflow helper is missing");

  assert.deepEqual(
    annotationModule.createVoucherAnnotationPayloads({
      voucherIds: ["voucher-1", "voucher-1", "voucher-2", ""],
      companyId: "company-1",
      content: "  复核附件  ",
      operatorId: "admin",
    }),
    [
      {
        voucherId: "voucher-1",
        companyId: "company-1",
        content: "复核附件",
        operatorId: "admin",
      },
      {
        voucherId: "voucher-2",
        companyId: "company-1",
        content: "复核附件",
        operatorId: "admin",
      },
    ],
  );
});

test("voucher annotation is wired through desktop, browser preview, list, and detail", () => {
  const commands = read("src-tauri/src/commands/vouchers.rs");
  const app = read("src-tauri/src/lib.rs");
  const store = read("src/stores/voucherStore.ts");
  const preview = read("src/lib/tauri.ts");
  const list = read("src/pages/operations/VoucherWorkspace.tsx");
  const detail = read("src/pages/operations/VoucherDetailWorkspace.tsx");

  assert.match(app, /commands::vouchers::add_voucher_annotation/);
  assert.match(commands, /pub async fn add_voucher_annotation/);
  assert.match(commands, /SELECT id FROM vouchers WHERE id = \? AND company_id = \?/);
  assert.match(commands, /operation_type[\s\S]*ANNOTATION/);
  assert.match(store, /addVoucherAnnotation/);
  assert.match(preview, /cmd === "add_voucher_annotation"/);
  assert.match(list, /批量批注/);
  assert.match(detail, /添加批注/);
  assert.match(detail, /operation_type === ['"]ANNOTATION['"]/);
});
