import { describe, expect, test } from 'vitest'
import { getVoucherSaveBlockMessage } from './voucherSaveGuard'

describe('getVoucherSaveBlockMessage', () => {
  test('blocks save when voucher entries are not balanced', () => {
    expect(
      getVoucherSaveBlockMessage({
        canSave: true,
        hasCompany: true,
        hasPeriod: true,
        entries: [
          { id: 'line-1', summary: '服务收入', accountCode: '1002', accountName: '银行存款', debit: 500, credit: 0 },
          { id: 'line-2', summary: '服务收入', accountCode: '6001', accountName: '主营业务收入', debit: 0, credit: 499 },
        ],
      }),
    ).toBe('凭证明细借贷不平衡，无法保存。')
  })
})
