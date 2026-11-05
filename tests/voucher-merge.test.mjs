import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mergeModule = await import(
  "../src/lib/voucherMergeWorkflow.js"
).catch(() => null);

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function voucher(overrides = {}) {
  return {
    id: "voucher-1",
    company_id: "company-1",
    period_id: "period-1",
    voucher_word_id: "word-1",
    voucher_number: "记-001",
    voucher_date: "2026-05-10",
    summary: "采购服务",
    attachment_count: 1,
    status: "draft",
    total_debit: 100,
    total_credit: 100,
    entries: [
      {
        account_code: "6602",
        account_name: "管理费用",
        direction: "debit",
        amount: 100,
        summary: "采购服务",
        auxiliary_type: null,
        auxiliary_id: null,
        doc_number: "DOC-1",
        quantity: null,
        unit_price: null,
        unit: null,
        currency_id: null,
        exchange_rate: null,
      },
      {
        account_code: "1002",
        account_name: "银行存款",
        direction: "credit",
        amount: 100,
        summary: "采购服务",
        auxiliary_type: null,
        auxiliary_id: null,
        doc_number: null,
        quantity: null,
        unit_price: null,
        unit: null,
        currency_id: null,
        exchange_rate: null,
      },
    ],
    ...overrides,
  };
}

test("voucher merge creates one non-destructive balanced draft", () => {
  assert.notEqual(mergeModule, null, "voucher merge workflow helper is missing");
  const sources = [
    voucher(),
    voucher({
      id: "voucher-2",
      voucher_number: "记-002",
      voucher_date: "2026-05-20",
      summary: "支付运费",
      attachment_count: 2,
    }),
  ];
  const snapshot = structuredClone(sources);

  const input = mergeModule.createMergedVoucherDraft(sources, "admin");

  assert.deepEqual(sources, snapshot);
  assert.equal(input.company_id, "company-1");
  assert.equal(input.period_id, "period-1");
  assert.equal(input.voucher_word_id, "word-1");
  assert.equal(input.voucher_date, "2026-05-20");
  assert.equal(input.attachment_count, 3);
  assert.equal(input.entries.length, 4);
  assert.equal(
    input.entries.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amount, 0),
    200,
  );
  assert.equal(
    input.entries.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amount, 0),
    200,
  );
  assert.match(input.summary, /记-001/);
  assert.match(input.reference_number, /MERGE:记-001,记-002/);
});

test("voucher merge rejects unsafe source combinations", () => {
  assert.notEqual(mergeModule, null, "voucher merge workflow helper is missing");
  assert.throws(() => mergeModule.createMergedVoucherDraft([voucher()], "admin"), /至少选择两张/);
  assert.throws(
    () => mergeModule.createMergedVoucherDraft([voucher(), voucher({ id: "voucher-2", status: "approved" })], "admin"),
    /只能合并草稿凭证/,
  );
  assert.throws(
    () => mergeModule.createMergedVoucherDraft([voucher(), voucher({ id: "voucher-2", company_id: "company-2" })], "admin"),
    /同一账套/,
  );
  assert.throws(
    () => mergeModule.createMergedVoucherDraft([voucher(), voucher({ id: "voucher-2", total_credit: 90 })], "admin"),
    /借贷平衡/,
  );
});

test("voucher list exposes a guarded merge-to-draft action", () => {
  const workspace = read("src/pages/operations/VoucherWorkspace.tsx");
  assert.match(workspace, /createMergedVoucherDraft/);
  assert.match(workspace, /合并为草稿/);
  assert.match(workspace, /selectedDraftIds\.length < 2/);
  assert.match(workspace, /replaceVoucherTags/);
  assert.match(workspace, /copyLocalVoucherAttachmentAssociations/);
});
