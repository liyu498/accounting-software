import { describe, expect, test } from 'vitest'
import { getEditorModeState } from './voucherEditorState'

describe('getEditorModeState', () => {
  test('keeps edit routes in loading mode until the voucher finishes loading', () => {
    expect(
      getEditorModeState({
        routeVoucherId: 'voucher-1',
        loading: true,
        voucher: null,
        loadErrorMessage: null,
      }),
    ).toMatchObject({
      mode: 'loading',
      canSave: false,
    })
  })

  test('shows an error state when an edit-route voucher fails to load', () => {
    expect(
      getEditorModeState({
        routeVoucherId: 'voucher-1',
        loading: false,
        voucher: null,
        loadErrorMessage: 'Voucher not found: voucher-1',
      }),
    ).toMatchObject({
      mode: 'load-error',
      canSave: false,
      resultStatus: 'error',
    })
  })

  test('shows a not-found state when an edit route finishes without a voucher', () => {
    expect(
      getEditorModeState({
        routeVoucherId: 'voucher-1',
        loading: false,
        voucher: null,
        loadErrorMessage: null,
      }),
    ).toMatchObject({
      mode: 'not-found',
      canSave: false,
      resultStatus: '404',
    })
  })

  test('keeps the existing non-draft edit guard after the voucher loads', () => {
    expect(
      getEditorModeState({
        routeVoucherId: 'voucher-1',
        loading: false,
        voucher: {
          id: 'voucher-1',
          status: 'approved',
          voucherNumber: '记-0001',
        },
        loadErrorMessage: null,
      }),
    ).toMatchObject({
      mode: 'locked',
      canSave: false,
    })
  })

  test('treats the new-voucher route as editable create mode', () => {
    expect(
      getEditorModeState({
        routeVoucherId: undefined,
        loading: false,
        voucher: null,
        loadErrorMessage: null,
      }),
    ).toMatchObject({
      mode: 'create',
      canSave: true,
    })
  })
})
