function text(value) {
  return String(value ?? "").trim();
}

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function enabledDetailAccount(account) {
  return Number(account?.is_enabled ?? 1) === 1 && Number(account?.is_detail ?? 1) === 1;
}

function resolveAccount(subject, accounts) {
  const normalized = text(subject);
  if (!normalized) return null;
  const leadingCode = normalized.match(/^([^\s/\-]+)/)?.[1] || normalized;
  return (
    accounts.find(
      (account) =>
        enabledDetailAccount(account) &&
        [text(account.code), text(account.name), `${text(account.code)} ${text(account.name)}`].includes(
          normalized,
        ),
    ) ||
    accounts.find(
      (account) => enabledDetailAccount(account) && text(account.code) === leadingCode,
    ) ||
    null
  );
}

export function validateAiVoucherSuggestion({
  job,
  accounts,
  periodLabel,
  requireConfirmed = true,
}) {
  if (!job || text(job.jobType || job.job_type) !== "voucher_suggestion") {
    throw new Error("记录不是 AI 凭证建议");
  }
  if (job.generatedVoucherId || job.generated_voucher_id) {
    throw new Error("AI 凭证建议已关联凭证，不能重复生成草稿");
  }
  const status = text(job.status).toLowerCase();
  if (requireConfirmed && status !== "confirmed") {
    throw new Error("AI 凭证建议尚未人工确认");
  }
  const riskLevel = text(job.riskLevel || job.risk_level).toLowerCase();
  if (["high", "blocked", "高", "异常"].includes(riskLevel)) {
    throw new Error("高风险 AI 凭证建议必须先修正来源或降级风险");
  }
  const suggestionPeriod = text(job.period);
  if (!suggestionPeriod || suggestionPeriod !== text(periodLabel)) {
    throw new Error("AI 凭证建议账期与当前账期不一致");
  }
  const suggestionAmount = amount(job.suggestionAmount ?? job.suggestion_amount);
  if (suggestionAmount <= 0) {
    throw new Error("AI 凭证建议缺少有效金额");
  }
  const debitAccount = resolveAccount(
    job.debitSubject ?? job.debit_subject,
    Array.isArray(accounts) ? accounts : [],
  );
  const creditAccount = resolveAccount(
    job.creditSubject ?? job.credit_subject,
    Array.isArray(accounts) ? accounts : [],
  );
  if (!debitAccount || !creditAccount) {
    throw new Error("AI 凭证建议的借贷科目不存在、已停用或不是明细科目");
  }
  if (text(debitAccount.code) === text(creditAccount.code)) {
    throw new Error("AI 凭证建议的借贷科目不能相同");
  }
  return { debitAccount, creditAccount, suggestionAmount };
}

export function buildAiVoucherSuggestionPrefill(input) {
  const { job } = input;
  const { debitAccount, creditAccount, suggestionAmount } =
    validateAiVoucherSuggestion(input);
  const summary =
    text(job.resultSummary ?? job.result_summary) ||
    `AI 建议：${text(job.sourceModule ?? job.source_module) || "业务资料"}`;
  const referenceNumber =
    text(job.suggestionNo ?? job.suggestion_no) || text(job.id);
  const shared = {
    amount: String(suggestionAmount),
    summary,
    docNumber: text(job.sourceFile ?? job.source_file) || referenceNumber,
  };
  return {
    summary,
    referenceNumber,
    entries: [
      {
        ...shared,
        accountCode: text(debitAccount.code),
        accountName: text(debitAccount.name),
        direction: "debit",
      },
      {
        ...shared,
        accountCode: text(creditAccount.code),
        accountName: text(creditAccount.name),
        direction: "credit",
      },
    ],
  };
}
