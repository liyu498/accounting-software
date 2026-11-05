function text(value) {
  return String(value ?? "").trim();
}

function enabledItem(items, itemId) {
  return items.find(
    (item) => item.id === itemId && String(item.status || "启用") === "启用",
  );
}

export function validateInventoryBomGraph(existingBoms, candidate) {
  const records = [
    ...existingBoms.filter((bom) => bom.id !== candidate.id),
    candidate,
  ].filter((bom) => bom.status === "启用");
  const graph = new Map();
  for (const bom of records) {
    const parentItemId = text(bom.parentItemId);
    if (!parentItemId) continue;
    const components = (bom.lines || []).map((line) =>
      text(line.componentItemId),
    );
    if (components.includes(parentItemId)) {
      throw new Error("物料清单不能引用自身");
    }
    graph.set(parentItemId, components.filter(Boolean));
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(itemId) {
    if (visiting.has(itemId)) {
      throw new Error("物料清单不能形成循环引用");
    }
    if (visited.has(itemId)) return;
    visiting.add(itemId);
    for (const componentItemId of graph.get(itemId) || []) {
      visit(componentItemId);
    }
    visiting.delete(itemId);
    visited.add(itemId);
  }
  for (const itemId of graph.keys()) visit(itemId);
}

export function normalizeInventoryBomDraft(draft, items) {
  const bomCode = text(draft.bomCode);
  const bomName = text(draft.bomName);
  const version = text(draft.version);
  const parentItemId = text(draft.parentItemId);
  const effectiveDate = text(draft.effectiveDate);
  const expirationDate = text(draft.expirationDate);
  const status = text(draft.status) || "启用";
  if (!bomCode || !bomName || !version || !parentItemId || !effectiveDate) {
    throw new Error("BOM 编码、名称、版本、成品和生效日期不能为空");
  }
  if (!['启用', '停用'].includes(status)) {
    throw new Error("物料清单状态只能为启用或停用");
  }
  if (expirationDate && expirationDate < effectiveDate) {
    throw new Error("失效日期不能早于生效日期");
  }
  if (!enabledItem(items, parentItemId)) {
    throw new Error("成品必须选择当前账套已启用的存货档案");
  }
  if (!Array.isArray(draft.lines) || draft.lines.length === 0) {
    throw new Error("物料清单至少需要一个组件");
  }

  const componentIds = new Set();
  const lines = draft.lines.map((line, index) => {
    const componentItemId = text(line.componentItemId);
    const quantity = Number(line.quantity);
    const lossPercent = Number(line.lossRate || 0);
    if (!enabledItem(items, componentItemId)) {
      throw new Error(`第 ${index + 1} 行组件必须选择已启用的存货档案`);
    }
    if (componentItemId === parentItemId) {
      throw new Error("物料清单不能引用自身");
    }
    if (componentIds.has(componentItemId)) {
      throw new Error("同一组件不能重复");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("组件数量必须大于零");
    }
    if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent >= 100) {
      throw new Error("损耗率必须在 0% 至 100% 之间");
    }
    componentIds.add(componentItemId);
    return {
      componentItemId,
      quantity,
      lossRate: lossPercent / 100,
      sortOrder: index + 1,
      note: text(line.note) || undefined,
    };
  });

  return {
    bomCode,
    bomName,
    version,
    parentItemId,
    effectiveDate,
    expirationDate: expirationDate || undefined,
    status,
    note: text(draft.note) || undefined,
    lines,
  };
}
