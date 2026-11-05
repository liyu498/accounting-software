function text(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function activeDetail(account) {
  return Number(account?.is_enabled ?? 1) === 1 && Number(account?.is_detail ?? 1) === 1;
}

export function canCreateVoucherFromBankTransaction(record) {
  return Boolean(
    record &&
      !(record.voucherId || record.voucher_id) &&
      text(record.status) !== "已生成凭证",
  );
}

export function buildBankVoucherPrefill({ record, accounts, periodLabel }) {
  if (!record || !text(record.id) || !text(record.serialNo ?? record.serial_no)) {
    throw new Error("银行流水缺少有效标识或流水号");
  }
  if (!canCreateVoucherFromBankTransaction(record)) {
    throw new Error("银行流水已关联凭证，不能重复生成草稿");
  }
  if (text(record.period) !== text(periodLabel)) {
    throw new Error("银行流水账期与当前账期不一致");
  }
  const income = money(record.incomeAmount ?? record.income_amount);
  const expense = money(record.expenseAmount ?? record.expense_amount);
  if ((income > 0) === (expense > 0)) {
    throw new Error("银行流水收入与支出必须二选一并大于零");
  }
  const bankAccount = (Array.isArray(accounts) ? accounts : []).find(
    (account) => activeDetail(account) && text(account.code) === "1002",
  );
  const serialNo = text(record.serialNo ?? record.serial_no);
  const counterparty = text(record.counterparty);
  const sourceSummary = text(record.summary);
  const summary = sourceSummary || `${income > 0 ? "收到" : "支付"}${counterparty || "银行款项"}`;
  const shared = {
    amount: String(income || expense),
    summary,
    docNumber: serialNo,
  };
  const bankEntry = {
    ...shared,
    accountCode: text(bankAccount?.code),
    accountName: text(bankAccount?.name),
  };
  const counterpartyEntry = {
    ...shared,
    accountCode: "",
    accountName: "",
  };
  return {
    voucherDate: text(record.transactionDate ?? record.transaction_date),
    summary,
    referenceNumber: serialNo,
    entries:
      income > 0
        ? [
            { ...bankEntry, direction: "debit" },
            { ...counterpartyEntry, direction: "credit" },
          ]
        : [
            { ...counterpartyEntry, direction: "debit" },
            { ...bankEntry, direction: "credit" },
          ],
  };
}
