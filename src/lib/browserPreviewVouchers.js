function text(value, fallback = '') {
  const normalized = value === undefined || value === null ? '' : String(value).trim()
  return normalized || fallback
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function totals(entries) {
  return entries.reduce(
    (result, entry) => {
      const amount = Number(entry.amount) || 0
      if (entry.direction === 'credit') result.credit += amount
      else result.debit += amount
      return result
    },
    { debit: 0, credit: 0 },
  )
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('凭证至少需要两条分录')
  if (entries.some((entry) => !text(entry.account_code) || !text(entry.account_name) || Number(entry.amount) <= 0)) {
    throw new Error('凭证分录不完整')
  }
  const result = totals(entries)
  if (Math.abs(result.debit - result.credit) >= 0.005) throw new Error('借贷金额不平衡')
  return result
}

function buildEntries(voucherId, entries, now) {
  return entries.map((entry, index) => ({
    id: `${voucherId}-entry-${index + 1}`,
    voucher_id: voucherId,
    line_num: index + 1,
    account_code: text(entry.account_code),
    account_name: text(entry.account_name),
    direction: entry.direction === 'credit' ? 'credit' : 'debit',
    amount: Number(entry.amount) || 0,
    summary: text(entry.summary) || null,
    auxiliary_type: text(entry.auxiliary_type) || null,
    auxiliary_id: text(entry.auxiliary_id) || null,
    auxiliary_items: Array.isArray(entry.auxiliary_items)
      ? entry.auxiliary_items
          .map((item) => ({
            auxiliary_category_id: text(item?.auxiliary_category_id),
            auxiliary_item_id: text(item?.auxiliary_item_id),
          }))
          .filter(
            (item) =>
              item.auxiliary_category_id && item.auxiliary_item_id,
          )
      : [],
    doc_number: text(entry.doc_number) || null,
    quantity: optionalNumber(entry.quantity),
    unit_price: optionalNumber(entry.unit_price),
    unit: text(entry.unit) || null,
    currency_id: text(entry.currency_id) || null,
    exchange_rate: optionalNumber(entry.exchange_rate),
    created_at: now.toISOString(),
  }))
}

export function createBrowserPreviewVoucher({ input, vouchers, now = new Date() }) {
  const companyId = text(input.company_id)
  const periodId = text(input.period_id)
  const voucherWordId = text(input.voucher_word_id)
  const voucherDate = text(input.voucher_date)
  if (!companyId || !periodId || !voucherWordId || !voucherDate) throw new Error('凭证账套、账期、凭证字和日期不能为空')

  const entryTotals = validateEntries(input.entries)
  const sequence = Math.max(
    0,
    ...vouchers
      .filter((voucher) => voucher.company_id === companyId && voucher.period_id === periodId)
      .map((voucher) => Number(voucher.sequence_num) || 0),
  ) + 1
  const id = `browser-voucher-${now.getTime()}-${vouchers.length + 1}`
  const timestamp = now.toISOString()
  return {
    id,
    company_id: companyId,
    period_id: periodId,
    voucher_word_id: voucherWordId,
    voucher_number: text(input.voucher_number, `记-${String(sequence).padStart(4, '0')}`),
    sequence_num: sequence,
    voucher_date: voucherDate,
    summary: text(input.summary) || null,
    reference_number: text(input.reference_number) || null,
    attachment_count: Math.max(0, Number(input.attachment_count) || 0),
    status: 'draft',
    total_debit: entryTotals.debit,
    total_credit: entryTotals.credit,
    version: 1,
    created_by: text(input.created_by) || null,
    created_at: timestamp,
    modified_by: null,
    modified_at: null,
    approved_by: null,
    approved_at: null,
    reversed_by: null,
    reversed_at: null,
    reversal_of_id: null,
    is_system: Number(input.is_system) === 1 ? 1 : 0,
    is_settlement: Number(input.is_settlement) === 1 ? 1 : 0,
    settlement_rule_id: text(input.settlement_rule_id) || null,
    is_deleted: 0,
    deleted_at: null,
    entries: buildEntries(id, input.entries, now),
  }
}

export function updateBrowserPreviewVoucher({ input, companyId, vouchers, now = new Date() }) {
  const existing = vouchers.find((voucher) => voucher.id === input.id && voucher.company_id === companyId)
  if (!existing) throw new Error('凭证不存在或不属于当前账套')
  if (existing.status !== 'draft') throw new Error('只有草稿凭证可以修改')
  const entries = input.entries ? buildEntries(existing.id, input.entries, now) : existing.entries
  const entryTotals = validateEntries(entries)
  const voucher = {
    ...existing,
    voucher_date: text(input.voucher_date, existing.voucher_date),
    summary: input.summary === undefined ? existing.summary : text(input.summary) || null,
    reference_number: input.reference_number === undefined ? existing.reference_number || null : text(input.reference_number) || null,
    attachment_count: input.attachment_count === undefined ? existing.attachment_count : Math.max(0, Number(input.attachment_count) || 0),
    total_debit: entryTotals.debit,
    total_credit: entryTotals.credit,
    version: (Number(existing.version) || 0) + 1,
    modified_by: text(input.modified_by) || null,
    modified_at: now.toISOString(),
    entries,
  }
  return { voucher, vouchers: vouchers.map((item) => item.id === voucher.id ? voucher : item) }
}

export function setBrowserPreviewVoucherStatus({ id, companyId, status, operator, vouchers, now = new Date() }) {
  const existing = vouchers.find((voucher) => voucher.id === id && voucher.company_id === companyId)
  if (!existing) throw new Error('凭证不存在或不属于当前账套')
  const timestamp = now.toISOString()
  const voucher = {
    ...existing,
    status,
    approved_by: status === 'approved' ? operator || 'admin' : null,
    approved_at: status === 'approved' ? timestamp : null,
    modified_at: timestamp,
    version: (Number(existing.version) || 0) + 1,
  }
  return { voucher, vouchers: vouchers.map((item) => item.id === id ? voucher : item) }
}

export function reverseBrowserPreviewVoucher({ id, companyId, reversedBy, vouchers, now = new Date() }) {
  const existing = vouchers.find(
    (voucher) => voucher.id === id && voucher.company_id === companyId && voucher.is_deleted !== 1,
  )
  if (!existing) throw new Error('凭证不存在或不属于当前账套')
  if (existing.status === 'reversed') throw new Error('凭证已红冲，不能重复操作')
  if (existing.status === 'draft') throw new Error('草稿凭证无需红冲，可直接删除')
  if (existing.status !== 'approved') throw new Error('只有已审核凭证可以红冲')

  const operator = text(reversedBy, 'admin')
  const timestamp = now.toISOString()
  const reversalDraft = createBrowserPreviewVoucher({
    input: {
      company_id: existing.company_id,
      period_id: existing.period_id,
      voucher_word_id: existing.voucher_word_id,
      voucher_date: existing.voucher_date,
      summary: `红冲：${existing.summary || existing.voucher_number}`,
      reference_number: existing.reference_number,
      attachment_count: 0,
      created_by: operator,
      entries: existing.entries.map((entry) => ({
        ...entry,
        direction: entry.direction === 'credit' ? 'debit' : 'credit',
      })),
    },
    vouchers,
    now,
  })
  const reversal = {
    ...reversalDraft,
    status: 'approved',
    approved_by: operator,
    approved_at: timestamp,
    reversal_of_id: existing.id,
    is_system: 1,
  }
  const source = {
    ...existing,
    status: 'reversed',
    reversed_by: operator,
    reversed_at: timestamp,
    modified_by: operator,
    modified_at: timestamp,
    version: (Number(existing.version) || 0) + 1,
  }
  return {
    source,
    reversal,
    vouchers: [
      reversal,
      ...vouchers.map((voucher) => voucher.id === source.id ? source : voucher),
    ],
  }
}

export function queryBrowserPreviewVouchers(vouchers, filters = {}) {
  const keyword = text(filters.keyword).toLowerCase()
  const scoped = vouchers
    .filter((voucher) => voucher.is_deleted !== 1)
    .filter((voucher) => !filters.company_id || voucher.company_id === filters.company_id)
    .filter((voucher) => !filters.period_id || voucher.period_id === filters.period_id)
    .filter((voucher) => !filters.status || voucher.status === filters.status)
    .filter((voucher) => !filters.start_date || voucher.voucher_date >= filters.start_date)
    .filter((voucher) => !filters.end_date || voucher.voucher_date <= filters.end_date)
    .filter((voucher) => !keyword || [voucher.voucher_number, voucher.summary, voucher.created_by].filter(Boolean).join(' ').toLowerCase().includes(keyword))
    .sort((left, right) => right.voucher_date.localeCompare(left.voucher_date) || right.sequence_num - left.sequence_num)
  const page = Math.max(1, Number(filters.page) || 1)
  const pageSize = Math.max(1, Number(filters.page_size) || 20)
  return { vouchers: scoped.slice((page - 1) * pageSize, page * pageSize), total: scoped.length }
}

export function softDeleteBrowserPreviewVoucher({ id, companyId, vouchers, now = new Date() }) {
  const existing = vouchers.find((voucher) => voucher.id === id && voucher.company_id === companyId)
  if (!existing) throw new Error('凭证不存在或不属于当前账套')
  if (existing.status !== 'draft') throw new Error('只有草稿凭证可以删除')
  const voucher = { ...existing, is_deleted: 1, deleted_at: now.toISOString() }
  return { voucher, vouchers: vouchers.map((item) => item.id === id ? voucher : item) }
}

export function getDeletedBrowserPreviewVouchers(vouchers, companyId) {
  return vouchers
    .filter((voucher) => voucher.company_id === companyId && voucher.is_deleted === 1)
    .sort((left, right) => String(right.deleted_at || '').localeCompare(String(left.deleted_at || '')))
}

export function restoreBrowserPreviewVoucher({ id, companyId, vouchers }) {
  const existing = vouchers.find(
    (voucher) => voucher.id === id && voucher.company_id === companyId && voucher.is_deleted === 1,
  )
  if (!existing) throw new Error('凭证不存在或未被删除')
  const voucher = { ...existing, is_deleted: 0, deleted_at: null }
  return { voucher, vouchers: vouchers.map((item) => item.id === id ? voucher : item) }
}
