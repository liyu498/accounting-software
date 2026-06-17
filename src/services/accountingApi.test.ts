import { beforeEach, expect, test, vi } from 'vitest'

async function getAccountingApi() {
  const module = await import('./accountingApi')
  return module.accountingApi
}

beforeEach(() => {
  vi.resetModules()
})

test('mock login returns an admin session for valid credentials', async () => {
  const accountingApi = await getAccountingApi()
  const result = await accountingApi.login({ username: 'admin', password: 'admin123' })

  expect(result.session.user.username).toBe('admin')
  expect(result.session.token).toBeTruthy()
})

test('saving an unbalanced voucher is rejected', async () => {
  const accountingApi = await getAccountingApi()

  await expect(
    accountingApi.saveVoucher({
      companyId: 'company-1',
      periodId: 'period-2026-06',
      voucherDate: '2026-06-17',
      voucherWord: '记',
      attachmentCount: 0,
      entries: [
        { id: 'line-1', summary: '采购办公用品', accountCode: '1001', accountName: '库存现金', debit: 100, credit: 0 },
        { id: 'line-2', summary: '采购办公用品', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 99 },
      ],
    }),
  ).rejects.toThrow('借贷不平衡')
})

test('auditing a draft voucher changes its status to approved', async () => {
  const accountingApi = await getAccountingApi()

  const saved = await accountingApi.saveVoucher({
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-17',
    voucherWord: '记',
    attachmentCount: 0,
    entries: [
      { id: 'line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 800, credit: 0 },
      { id: 'line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 800 },
    ],
  })

  await accountingApi.auditVoucher(saved.id)
  const detail = await accountingApi.getVoucher(saved.id)

  expect(detail.status).toBe('approved')
})

test('saving changes to an approved voucher is rejected', async () => {
  const accountingApi = await getAccountingApi()

  await expect(
    accountingApi.saveVoucher({
      id: 'voucher-1',
      companyId: 'company-1',
      periodId: 'period-2026-06',
      voucherDate: '2026-06-10',
      voucherWord: '记',
      attachmentCount: 1,
      entries: [
        { id: 'voucher-1-line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 600, credit: 0 },
        { id: 'voucher-1-line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 600 },
      ],
    }),
  ).rejects.toThrow('已审核凭证不能直接修改')
})

test('creating a red reversal marks the source as reversed and creates an approved reversal voucher', async () => {
  const accountingApi = await getAccountingApi()

  const reversal = await accountingApi.createRedReversal('voucher-1')
  const source = await accountingApi.getVoucher('voucher-1')

  expect(source.status).toBe('reversed')
  expect(reversal.status).toBe('approved')
  expect(reversal.id).not.toBe('voucher-1')
  expect(reversal.entries).toEqual([
    { id: 'reversal-voucher-1-line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 500 },
    { id: 'reversal-voucher-1-line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 500, credit: 0 },
  ])
})

test('trial balance ignores draft vouchers', async () => {
  const accountingApi = await getAccountingApi()

  const trialBalance = await accountingApi.getTrialBalance({
    companyId: 'company-1',
    periodId: 'period-2026-06',
  })

  expect(trialBalance.totalDebit).toBe(500)
  expect(trialBalance.totalCredit).toBe(500)
})
