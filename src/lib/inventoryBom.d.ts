export interface InventoryBomDraftLine {
  componentItemId: string;
  quantity: string | number;
  lossRate: string | number;
  note?: string;
}

export interface InventoryBomDraft {
  bomCode: string;
  bomName: string;
  version: string;
  parentItemId: string;
  effectiveDate: string;
  expirationDate?: string;
  status: string;
  note?: string;
  lines: InventoryBomDraftLine[];
}

export interface NormalizedInventoryBomInput {
  bomCode: string;
  bomName: string;
  version: string;
  parentItemId: string;
  effectiveDate: string;
  expirationDate?: string;
  status: string;
  note?: string;
  lines: Array<{
    componentItemId: string;
    quantity: number;
    lossRate: number;
    sortOrder: number;
    note?: string;
  }>;
}

export function normalizeInventoryBomDraft(
  draft: InventoryBomDraft,
  items: Array<{ id: string; status: string }>,
): NormalizedInventoryBomInput;

export function validateInventoryBomGraph(
  existingBoms: Array<{
    id: string;
    parentItemId: string;
    status: string;
    lines: Array<{ componentItemId: string }>;
  }>,
  candidate: {
    id: string;
    parentItemId: string;
    status: string;
    lines: Array<{ componentItemId: string }>;
  },
): void;
