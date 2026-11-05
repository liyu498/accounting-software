const statusLabels = {
  queued: "待执行",
  pending: "待执行",
  created: "待执行",
  waiting_confirmation: "待复核",
  pending_review: "待复核",
  review: "待复核",
  reviewing: "待复核",
  processing: "执行中",
  confirmed: "已确认",
  approved: "已确认",
  completed: "已完成",
  succeeded: "已完成",
  success: "已完成",
  failed: "异常",
  error: "异常",
  blocked: "异常",
};

const typeLabels = {
  invoice_recognition: "发票识别",
  bank_statement_recognition: "银行流水识别",
  receipt_recognition: "票据识别",
  document_recognition: "单据识别",
  payroll_recognition: "薪酬资料识别",
  voucher_suggestion: "凭证建议",
};

const riskLabels = {
  normal: "普通",
  low: "低",
  medium: "中",
  high: "高",
  blocked: "阻断",
};

export function automationJobStatusLabel(status) {
  const value = String(status || "").trim();
  return statusLabels[value.toLowerCase()] || value || "未记录";
}

export function automationJobTypeLabel(jobType) {
  const value = String(jobType || "").trim();
  return typeLabels[value.toLowerCase()] || value || "未记录";
}

export function automationJobRiskLabel(riskLevel) {
  const value = String(riskLevel || "").trim();
  return riskLabels[value.toLowerCase()] || value || "未记录";
}

export function automationJobConfidenceLabel(job) {
  if (Number.isFinite(job?.confidence)) {
    return `${Math.round(Math.max(0, Math.min(1, job.confidence)) * 100)}%`;
  }
  const completed = ["已完成", "已确认"].includes(
    automationJobStatusLabel(job?.status),
  );
  return completed && String(job?.reviewer || "").trim() ? "人工复核" : "待识别";
}

export function canReviewAutomationJob(job) {
  return automationJobStatusLabel(job?.status) === "待复核";
}
