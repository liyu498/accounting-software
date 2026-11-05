import { toChineseCurrencyUppercase } from "./voucherEntryWorkflow.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatAmount(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(number)
    : "0.00";
}
function statusLabel(status) {
  if (status === "approved") return "已审核";
  if (status === "reversed") return "已红冲";
  if (status === "draft") return "待审核";
  return status || "未知";
}

function entryAuxiliary(entry) {
  return [entry.auxiliary_type, entry.doc_number]
    .filter(Boolean)
    .join(" / ") || "—";
}

export function buildVoucherPrintHtml({
  companyName,
  periodLabel,
  generatedAt,
  voucher,
  entries,
}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const debitTotal = safeEntries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const creditTotal = safeEntries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const balancedTotal = Math.max(debitTotal, creditTotal);
  const rows = safeEntries
    .map(
      (entry) => `<tr>
        <td class="line">${escapeHtml(entry.line_num)}</td>
        <td>${escapeHtml(entry.summary || voucher.summary || "—")}</td>
        <td><span class="account-code">${escapeHtml(entry.account_code)}</span><br>${escapeHtml(entry.account_name)}</td>
        <td>${escapeHtml(entryAuxiliary(entry))}</td>
        <td class="amount">${entry.direction === "debit" ? escapeHtml(formatAmount(entry.amount)) : ""}</td>
        <td class="amount">${entry.direction === "credit" ? escapeHtml(formatAmount(entry.amount)) : ""}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(voucher.voucher_number || "记账凭证")}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#111827;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",Arial,sans-serif;font-size:11px}.voucher{break-inside:avoid;page-break-inside:avoid}h1{margin:0;text-align:center;font-size:22px;letter-spacing:0}.company{text-align:center;margin:4px 0 10px;color:#475569;font-size:12px}.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px 16px;margin-bottom:8px}.meta span{min-width:0;word-break:break-word}.summary{margin:0 0 8px;padding:6px 8px;border:1px solid #94a3b8;background:#f8fafc}.summary strong{font-weight:700}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #64748b;padding:6px;vertical-align:middle;word-break:break-word}th{background:#e8eef6;font-weight:700;text-align:center}.line{width:5%;text-align:center}.amount{width:14%;text-align:right;font-variant-numeric:tabular-nums}.account-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.totals td{font-weight:700;background:#f8fafc}.uppercase{text-align:left}.signatures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:12px;border-top:1px solid #94a3b8;padding-top:8px}.note{margin-top:8px;color:#64748b;font-size:10px}</style></head><body><section class="voucher page-break-block"><h1>记账凭证</h1><div class="company">${escapeHtml(companyName || "当前账套")}</div><div class="meta"><span>凭证字号：${escapeHtml(voucher.voucher_number || "—")}</span><span>凭证日期：${escapeHtml(voucher.voucher_date || "—")}</span><span>所属期间：${escapeHtml(periodLabel || voucher.voucher_date?.slice(0, 7) || "—")}</span><span>状态：${escapeHtml(statusLabel(voucher.status))}</span><span>来源参考号：${escapeHtml(voucher.reference_number || "—")}</span><span>原始附件：${escapeHtml(voucher.attachment_count || 0)} 张</span><span>打印时间：${escapeHtml(generatedAt || "—")}</span><span>分录行数：${safeEntries.length}</span></div><p class="summary"><strong>凭证摘要：</strong>${escapeHtml(voucher.summary || "未填写摘要")}</p><table><thead><tr><th class="line">行</th><th>摘要</th><th>会计科目</th><th>辅助核算 / 单据号</th><th class="amount">借方金额</th><th class="amount">贷方金额</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">暂无凭证分录</td></tr>'}<tr class="totals"><td colspan="4" class="uppercase">合计（大写）：${escapeHtml(toChineseCurrencyUppercase(balancedTotal))}</td><td class="amount">${escapeHtml(formatAmount(debitTotal))}</td><td class="amount">${escapeHtml(formatAmount(creditTotal))}</td></tr></tbody></table><div class="signatures"><span>制单：${escapeHtml(voucher.created_by || "未记录")}</span><span>审核：${escapeHtml(voucher.approved_by || "未审核")}</span><span>记账：${escapeHtml(voucher.bookkeeper || "未记录")}</span><span>主管：${escapeHtml(voucher.supervisor || "未记录")}</span></div><p class="note">本打印件按当前账套凭证数据生成；电子附件仍保留在本机原始位置。</p></section></body></html>`;
}
