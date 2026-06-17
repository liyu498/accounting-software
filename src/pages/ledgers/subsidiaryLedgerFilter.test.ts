import { expect, test } from 'vitest'
import { shouldResetSubsidiaryLedgerFilter } from './subsidiaryLedgerFilter'

test('resets only after an existing context changes', () => {
  expect(shouldResetSubsidiaryLedgerFilter(null, 'company-1:period-1')).toBe(false)
  expect(shouldResetSubsidiaryLedgerFilter('company-1:period-1', 'company-1:period-1')).toBe(false)
  expect(shouldResetSubsidiaryLedgerFilter('company-1:period-1', 'company-2:period-2')).toBe(true)
})
