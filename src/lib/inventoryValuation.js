const EPSILON = 0.000001;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundUnitCost(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function inventoryMovementDirection(movementType) {
  if (String(movementType).includes("入库")) return "inbound";
  if (String(movementType).includes("出库")) return "outbound";
  throw new Error("出入库类型必须明确为入库或出库");
}

export function calculateInventoryConfirmation({
  direction,
  quantity,
  enteredAmount,
  balanceQuantity,
  balanceAmount,
}) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("出入库数量必须大于零");
  }
  if (!Number.isFinite(balanceQuantity) || !Number.isFinite(balanceAmount)) {
    throw new Error("库存余额无效，不能核验出入库单");
  }

  if (direction === "inbound") {
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      throw new Error("入库金额必须大于零");
    }
    const amount = roundMoney(enteredAmount);
    return {
      unitCost: roundUnitCost(amount / quantity),
      amount,
      endingQuantity: balanceQuantity + quantity,
      endingAmount: roundMoney(balanceAmount + amount),
    };
  }

  if (direction !== "outbound") {
    throw new Error("出入库方向无效");
  }
  if (balanceQuantity + EPSILON < quantity) {
    throw new Error("出库数量超过可用库存，禁止形成负库存");
  }
  if (balanceQuantity <= EPSILON) {
    throw new Error("当前没有可用库存，禁止形成负库存");
  }

  const unitCost = roundUnitCost(balanceAmount / balanceQuantity);
  const amount =
    Math.abs(balanceQuantity - quantity) <= EPSILON
      ? roundMoney(balanceAmount)
      : roundMoney(unitCost * quantity);
  const endingQuantity = Math.max(0, balanceQuantity - quantity);
  const endingAmount =
    endingQuantity <= EPSILON
      ? 0
      : roundMoney(Math.max(0, balanceAmount - amount));
  return { unitCost, amount, endingQuantity, endingAmount };
}

export function calculateInventoryBalance(movements) {
  return movements.reduce(
    (balance, movement) => {
      if (movement.status !== "已核验" && movement.status !== "已生成凭证") {
        return balance;
      }
      const direction =
        movement.direction || inventoryMovementDirection(movement.movementType);
      const sign = direction === "inbound" ? 1 : -1;
      return {
        quantity: balance.quantity + sign * Number(movement.quantity || 0),
        amount: roundMoney(balance.amount + sign * Number(movement.amount || 0)),
      };
    },
    { quantity: 0, amount: 0 },
  );
}
