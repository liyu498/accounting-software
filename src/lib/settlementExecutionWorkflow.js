const MONEY_EPSILON = 0.005;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function accountCodeFromText(value) {
  return String(value ?? "").match(/\b\d{4,12}\b/)?.[0] ?? "";
}

export function extractSettlementSourceAccountCodes(formula) {
  return [...new Set(String(formula ?? "").match(/\b\d{4,12}\b/g) ?? [])];
}

function isExistingSettlementVoucher(voucher, ruleId) {
  return (
    String(voucher?.settlement_rule_id ?? "") === String(ruleId) &&
    Number(voucher?.is_deleted ?? 0) !== 1 &&
    String(voucher?.status ?? "") !== "reversed"
  );
}

function isEligibleSourceVoucher(voucher) {
  return (
    String(voucher?.status ?? "") === "approved" &&
    Number(voucher?.is_deleted ?? 0) !== 1 &&
    Number(voucher?.is_settlement ?? 0) !== 1 &&
    !voucher?.settlement_rule_id
  );
}

export function buildSettlementRulePreview({
  rule,
  periodLabel,
  accounts = [],
  vouchers = [],
  existingVouchers = vouchers,
}) {
  if (!rule || Number(rule.is_enabled ?? 1) !== 1) {
    throw new Error("结转规则未启用");
  }
  if (existingVouchers.some((voucher) => isExistingSettlementVoucher(voucher, rule.id))) {
    throw new Error("当前账期已存在结转凭证，请先处理已有凭证");
  }

  const enabledDetails = accounts.filter(
    (account) => Number(account.is_enabled ?? 1) === 1 && Number(account.is_detail ?? 1) === 1,
  );
  const accountByCode = new Map(
    enabledDetails.map((account) => [String(account.code), account]),
  );
  const targetAccountCode = accountCodeFromText(rule.target_account_code);
  const targetAccount = accountByCode.get(targetAccountCode);
  if (!targetAccount) {
    throw new Error("目标科目不存在、已停用或不是明细科目");
  }

  let sourceAccountCodes;
  if (String(rule.rule_type) === "profit_loss") {
    sourceAccountCodes = enabledDetails
      .filter((account) =>
        ["income", "revenue", "expense"].includes(String(account.account_type)),
      )
      .map((account) => String(account.code));
  } else {
    sourceAccountCodes = extractSettlementSourceAccountCodes(rule.source_formula);
    if (sourceAccountCodes.length === 0) {
      throw new Error("非损益结转必须在取数规则中填写来源科目编码");
    }
  }

  if (sourceAccountCodes.includes(targetAccountCode)) {
    throw new Error("目标科目不能同时作为来源科目");
  }
  const missingSource = sourceAccountCodes.find((code) => !accountByCode.has(code));
  if (missingSource) {
    throw new Error(`来源科目 ${missingSource} 不存在、已停用或不是明细科目`);
  }

  const sourceSet = new Set(sourceAccountCodes);
  const netByAccount = new Map(sourceAccountCodes.map((code) => [code, 0]));
  for (const voucher of vouchers.filter(isEligibleSourceVoucher)) {
    for (const entry of voucher.entries ?? []) {
      const code = String(entry.account_code ?? "");
      if (!sourceSet.has(code)) continue;
      const amount = Number(entry.amount ?? 0);
      const signed = String(entry.direction) === "debit" ? amount : -amount;
      netByAccount.set(code, (netByAccount.get(code) ?? 0) + signed);
    }
  }

  const period = String(periodLabel ?? "").trim();
  const summary = String(rule.summary_template || `${rule.name || "期末"}结转`)
    .replaceAll("{期间}", period)
    .replaceAll("{账期}", period);
  const entries = [];
  for (const code of [...sourceAccountCodes].sort()) {
    const netDebit = roundMoney(netByAccount.get(code) ?? 0);
    if (Math.abs(netDebit) < MONEY_EPSILON) continue;
    const account = accountByCode.get(code);
    entries.push({
      accountCode: code,
      accountName: account.name,
      direction: netDebit > 0 ? "credit" : "debit",
      amount: roundMoney(Math.abs(netDebit)),
      summary,
    });
  }
  if (entries.length === 0) {
    throw new Error("当前账期没有可结转的来源科目发生额");
  }

  let totalDebit = roundMoney(
    entries.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amount, 0),
  );
  let totalCredit = roundMoney(
    entries.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amount, 0),
  );
  const difference = roundMoney(totalDebit - totalCredit);
  if (Math.abs(difference) >= MONEY_EPSILON) {
    entries.push({
      accountCode: targetAccountCode,
      accountName: targetAccount.name,
      direction: difference > 0 ? "credit" : "debit",
      amount: roundMoney(Math.abs(difference)),
      summary,
    });
    totalDebit = roundMoney(
      entries.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amount, 0),
    );
    totalCredit = roundMoney(
      entries.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amount, 0),
    );
  }

  if (entries.length < 2 || Math.abs(totalDebit - totalCredit) >= MONEY_EPSILON) {
    throw new Error("结转分录无法形成借贷平衡凭证");
  }

  return {
    ruleId: String(rule.id),
    ruleName: String(rule.name ?? "结转规则"),
    periodLabel: period,
    targetAccountCode,
    summary,
    entries,
    totalDebit,
    totalCredit,
    totalAmount: Math.max(totalDebit, totalCredit),
  };
}
