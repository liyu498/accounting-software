import { describe, expect, it } from 'vitest'
import { getIdleFinancialPageState, getLoadingFinancialPageState, resetFinancialPageState } from './financialPageState'

describe('resetFinancialPageState', () => {
  it('returns empty data and a message for Error instances', () => {
    const emptyData = { rows: [], total: 0 }

    expect(resetFinancialPageState(emptyData, new Error('reload failed'), 'fallback')).toEqual({
      data: emptyData,
      errorMessage: 'reload failed',
    })
  })

  it('returns empty data and the fallback for unknown errors', () => {
    const emptyData = ['stale']

    expect(resetFinancialPageState(emptyData, 'boom', 'fallback')).toEqual({
      data: emptyData,
      errorMessage: 'fallback',
    })
  })

  it('marks idle financial pages as not loading', () => {
    const emptyData: string[] = []

    expect(getIdleFinancialPageState(emptyData)).toEqual({
      data: emptyData,
      errorMessage: null,
      loading: false,
    })
  })

  it('marks loading financial pages as empty and pending', () => {
    const emptyData: string[] = []

    expect(getLoadingFinancialPageState(emptyData)).toEqual({
      data: emptyData,
      errorMessage: null,
      loading: true,
    })
  })
})
