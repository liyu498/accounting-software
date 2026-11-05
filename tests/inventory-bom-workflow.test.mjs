import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeInventoryBomDraft,
  validateInventoryBomGraph,
} from "../src/lib/inventoryBom.js";

const items = [
  { id: "finished", companyId: "company-1", status: "启用" },
  { id: "component-a", companyId: "company-1", status: "启用" },
  { id: "component-b", companyId: "company-1", status: "启用" },
];

test("inventory BOM normalizes auditable component quantities and loss rates", () => {
  const normalized = normalizeInventoryBomDraft(
    {
      bomCode: " BOM-001 ",
      bomName: " 标准产品结构 ",
      version: " V1 ",
      parentItemId: "finished",
      effectiveDate: "2026-01-01",
      expirationDate: "",
      status: "启用",
      note: " 生产领料基础 ",
      lines: [
        {
          componentItemId: "component-a",
          quantity: "2.5",
          lossRate: "3",
          note: " 主材 ",
        },
      ],
    },
    items,
  );

  assert.equal(normalized.bomCode, "BOM-001");
  assert.equal(normalized.version, "V1");
  assert.equal(normalized.expirationDate, undefined);
  assert.equal(normalized.lines[0].quantity, 2.5);
  assert.equal(normalized.lines[0].lossRate, 0.03);
  assert.equal(normalized.lines[0].sortOrder, 1);
});

test("inventory BOM rejects self references, duplicate components and invalid quantities", () => {
  const base = {
    bomCode: "BOM-001",
    bomName: "标准产品结构",
    version: "V1",
    parentItemId: "finished",
    effectiveDate: "2026-01-01",
    expirationDate: "",
    status: "启用",
    note: "",
  };

  assert.throws(
    () =>
      normalizeInventoryBomDraft(
        {
          ...base,
          lines: [
            {
              componentItemId: "finished",
              quantity: "1",
              lossRate: "0",
              note: "",
            },
          ],
        },
        items,
      ),
    /不能引用自身/,
  );
  assert.throws(
    () =>
      normalizeInventoryBomDraft(
        {
          ...base,
          lines: [
            {
              componentItemId: "component-a",
              quantity: "1",
              lossRate: "0",
              note: "",
            },
            {
              componentItemId: "component-a",
              quantity: "2",
              lossRate: "0",
              note: "",
            },
          ],
        },
        items,
      ),
    /同一组件不能重复/,
  );
  assert.throws(
    () =>
      normalizeInventoryBomDraft(
        {
          ...base,
          lines: [
            {
              componentItemId: "component-a",
              quantity: "0",
              lossRate: "0",
              note: "",
            },
          ],
        },
        items,
      ),
    /组件数量必须大于零/,
  );
});

test("inventory BOM graph rejects indirect component cycles", () => {
  assert.throws(
    () =>
      validateInventoryBomGraph(
        [
          {
            id: "bom-a",
            parentItemId: "finished",
            status: "启用",
            lines: [{ componentItemId: "component-a" }],
          },
          {
            id: "bom-b",
            parentItemId: "component-a",
            status: "启用",
            lines: [{ componentItemId: "component-b" }],
          },
        ],
        {
          id: "bom-c",
          parentItemId: "component-b",
          status: "启用",
          lines: [{ componentItemId: "finished" }],
        },
      ),
    /不能形成循环引用/,
  );
});
