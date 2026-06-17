import { getVoucherTotals, isVoucherBalanced, isVoucherEditable } from '../../features/vouchers/voucherRules'

test('calculates debit and credit totals', () => {
  const totals = getVoucherTotals([
    { id: '1', summary: '鏀跺叆', accountCode: '1002', accountName: '閾惰瀛樻', debit: 500, credit: 0 },
    { id: '2', summary: '鏀跺叆', accountCode: '6001', accountName: '涓昏惀涓氬姟鏀跺叆', debit: 0, credit: 500 },
  ])

  expect(totals).toEqual({ debitTotal: 500, creditTotal: 500 })
})

test('detects unbalanced vouchers', () => {
  expect(
    isVoucherBalanced([
      { id: '1', summary: '鏀跺叆', accountCode: '1002', accountName: '閾惰瀛樻', debit: 500, credit: 0 },
      { id: '2', summary: '鏀跺叆', accountCode: '6001', accountName: '涓昏惀涓氬姟鏀跺叆', debit: 0, credit: 499 },
    ]),
  ).toBe(false)
})

test('only draft vouchers are editable', () => {
  expect(isVoucherEditable('draft')).toBe(true)
  expect(isVoucherEditable('approved')).toBe(false)
  expect(isVoucherEditable('reversed')).toBe(false)
})
