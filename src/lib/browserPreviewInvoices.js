function nullableText(value, fallback = null) {
  if (value === undefined) return fallback
  const text = String(value).trim()
  return text || null
}

export function createBrowserPreviewInvoice({ input, invoices, now = new Date() }) {
  if (!String(input.company_id ?? '').trim()) throw new Error('company_id is required')
  if (!String(input.invoice_no ?? '').trim()) throw new Error('请填写发票号码')
  if (!String(input.invoice_date ?? '').trim()) throw new Error('请填写开票日期')

  const amount = Number(input.amount) || 0
  const taxAmount = Number(input.tax_amount) || 0
  const timestamp = now.toISOString()
  return {
    id: `browser-invoice-${now.getTime()}-${invoices.length + 1}`,
    company_id: String(input.company_id),
    period_id: nullableText(input.period_id),
    invoice_type: String(input.invoice_type || 'input'),
    invoice_no: String(input.invoice_no).trim(),
    invoice_code: nullableText(input.invoice_code),
    invoice_date: String(input.invoice_date),
    amount,
    tax_amount: taxAmount,
    total_amount: amount + taxAmount,
    tax_rate: input.tax_rate === undefined ? null : Number(input.tax_rate),
    seller_name: nullableText(input.seller_name),
    seller_tax_id: nullableText(input.seller_tax_id),
    buyer_name: nullableText(input.buyer_name),
    buyer_tax_id: nullableText(input.buyer_tax_id),
    status: 'pending',
    voucher_id: null,
    remarks: nullableText(input.remarks),
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export function updateBrowserPreviewInvoice({ id, input, invoices, now = new Date() }) {
  const existing = invoices.find((invoice) => invoice.id === id)
  if (!existing) throw new Error('发票不存在')
  if (input.company_id && input.company_id !== existing.company_id) {
    throw new Error('发票不存在或不属于当前公司')
  }

  const patch = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )
  const amount = patch.amount === undefined ? existing.amount : Number(patch.amount)
  const taxAmount = patch.tax_amount === undefined
    ? existing.tax_amount
    : Number(patch.tax_amount)
  const invoice = {
    ...existing,
    ...patch,
    company_id: existing.company_id,
    amount,
    tax_amount: taxAmount,
    total_amount: amount + taxAmount,
    updated_at: now.toISOString(),
  }
  return {
    invoice,
    invoices: invoices.map((item) => (item.id === id ? invoice : item)),
  }
}

export function matchBrowserPreviewInvoiceToVoucher({
  id,
  voucherId,
  companyId,
  voucher,
  invoices,
  now = new Date(),
}) {
  const invoice = invoices.find(
    (item) => item.id === id && item.company_id === companyId,
  )
  if (!invoice) throw new Error('发票不存在或不属于当前公司')
  if (invoice.status !== 'verified' || invoice.voucher_id) {
    throw new Error('只有已复核且尚未关联凭证的发票可以生成凭证')
  }
  if (!voucher || voucher.id !== voucherId || voucher.company_id !== companyId) {
    throw new Error('凭证不存在或不属于当前公司')
  }
  if (voucher.status !== 'draft') throw new Error('只有草稿凭证可以关联发票')
  if (invoice.period_id && invoice.period_id !== voucher.period_id) {
    throw new Error('发票与凭证不属于同一账期')
  }
  return updateBrowserPreviewInvoice({
    id,
    input: {
      company_id: companyId,
      voucher_id: voucherId,
      status: 'matched',
    },
    invoices,
    now,
  })
}

export function filterBrowserPreviewInvoices(invoices, filters) {
  return invoices
    .filter(
      (invoice) =>
        (!filters.companyId || invoice.company_id === filters.companyId)
        && (!filters.periodId || invoice.period_id === filters.periodId)
        && (!filters.invoiceType || invoice.invoice_type === filters.invoiceType),
    )
    .sort((left, right) => right.invoice_date.localeCompare(left.invoice_date))
}
