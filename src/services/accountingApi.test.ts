import { accountingApi } from './accountingApi'

test('mock login returns an admin session for valid credentials', async () => {
  const result = await accountingApi.login({ username: 'admin', password: 'admin123' })

  expect(result.session.user.username).toBe('admin')
  expect(result.session.token).toBeTruthy()
})

test('saving an unbalanced voucher is rejected', async () => {
  await expect(
    accountingApi.saveVoucher({
      companyId: 'company-1',
      periodId: 'period-2026-06',
      voucherDate: '2026-06-17',
      voucherWord: '璁?',
      attachmentCount: 0,
      entries: [
        { id: 'line-1', summary: '娴嬭瘯', accountCode: '1001', accountName: '搴撳瓨鐜伴噾', debit: 100, credit: 0 },
        { id: 'line-2', summary: '娴嬭瘯', accountCode: '6001', accountName: '涓昏惀涓氬姟鏀跺叆', debit: 0, credit: 99 },
      ],
    }),
  ).rejects.toThrow('鍊熻捶涓嶅钩琛?')
})

test('auditing a draft voucher changes its status to approved', async () => {
  const saved = await accountingApi.saveVoucher({
    companyId: 'company-1',
    periodId: 'period-2026-06',
    voucherDate: '2026-06-17',
    voucherWord: '璁?',
    attachmentCount: 0,
    entries: [
      { id: 'line-1', summary: '鏈嶅姟鏀跺叆', accountCode: '1002', accountName: '閾惰瀛樻', debit: 800, credit: 0 },
      { id: 'line-2', summary: '鏈嶅姟鏀跺叆', accountCode: '6001', accountName: '涓昏惀涓氬姟鏀跺叆', debit: 0, credit: 800 },
    ],
  })

  await accountingApi.auditVoucher(saved.id)
  const detail = await accountingApi.getVoucher(saved.id)

  expect(detail.status).toBe('approved')
})
