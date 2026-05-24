import { create } from 'zustand'

export interface VoucherFormEntry {
  accountCode: string
  accountName: string
  direction: 'debit' | 'credit'
  amount: number
  summary: string
  auxiliaryType: string | null
  auxiliaryId: string | null
  auxiliaryName: string | null
  docNumber: string | null
  quantity: number | null
  unitPrice: number | null
  unit: string | null
  cashFlowTag: string | null
  currencyId: string | null
  exchangeRate: number | null
}

interface VoucherFormState {
  // Header
  voucherDate: string
  voucherNumber: string
  attachmentCount: number
  voucherWordId: string

  // Entries
  entries: VoucherFormEntry[]
  activeEntryIndex: number

  // Meta
  isDirty: boolean
  isSaving: boolean
  lastAutoSaveAt: string | null
  editVoucherId: string | null
  selectedPeriodId: string
  selectedCompanyId: string

  // Computed
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  balanceDiff: number

  // Actions
  initForNew: (companyId: string, periodId: string, voucherWordId: string, nextNumber: string) => void
  initForEdit: (voucher: {
    id: string
    voucher_date: string
    voucher_number: string
    summary: string | null
    attachment_count: number
    voucher_word_id: string
    period_id: string
    company_id: string
    entries: Array<{
      account_code: string
      account_name: string
      direction: string
      amount: number
      summary: string | null
      auxiliary_type: string | null
      auxiliary_id: string | null
      doc_number: string | null
      line_num: number
    }>
  }) => void
  setHeaderField: (field: string, value: string | number) => void
  addEntry: () => void
  removeEntry: (index: number) => void
  updateEntry: (index: number, field: keyof VoucherFormEntry, value: unknown) => void
  selectAccount: (index: number, code: string, name: string) => void
  autoBalance: () => void
  setActiveEntry: (index: number) => void
  moveToNextRow: () => void
  moveToPrevRow: () => void
  toggleDirection: (index: number) => void
  reset: () => void
  recomputeBalances: () => void
}

function emptyEntry(): VoucherFormEntry {
  return {
    accountCode: '',
    accountName: '',
    direction: 'debit',
    amount: 0,
    summary: '',
    auxiliaryType: null,
    auxiliaryId: null,
    auxiliaryName: null,
    docNumber: null,
    quantity: null,
    unitPrice: null,
    unit: null,
    cashFlowTag: null,
    currencyId: null,
    exchangeRate: null,
  }
}

function defaultEntries(): VoucherFormEntry[] {
  return [
    { ...emptyEntry(), direction: 'debit' },
    { ...emptyEntry(), direction: 'credit' },
  ]
}

function computeBalances(entries: VoucherFormEntry[]) {
  const validEntries = entries.filter((e) => e.amount > 0)
  const totalDebit = validEntries
    .filter((e) => e.direction === 'debit')
    .reduce((s, e) => s + e.amount, 0)
  const totalCredit = validEntries
    .filter((e) => e.direction === 'credit')
    .reduce((s, e) => s + e.amount, 0)
  const balanceDiff = Math.abs(totalDebit - totalCredit)
  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: balanceDiff < 0.01,
    balanceDiff: Math.round(balanceDiff * 100) / 100,
  }
}

export const useVoucherFormStore = create<VoucherFormState>((set, get) => ({
  voucherDate: new Date().toISOString().split('T')[0],
  voucherNumber: '',
  attachmentCount: 0,
  voucherWordId: '',
  entries: defaultEntries(),
  activeEntryIndex: 0,
  isDirty: false,
  isSaving: false,
  lastAutoSaveAt: null,
  editVoucherId: null,
  selectedPeriodId: '',
  selectedCompanyId: '',
  ...computeBalances(defaultEntries()),

  initForNew: (companyId, periodId, voucherWordId, nextNumber) => {
    const entries = defaultEntries()
    set({
      selectedCompanyId: companyId,
      selectedPeriodId: periodId,
      voucherWordId,
      voucherNumber: nextNumber,
      entries,
      editVoucherId: null,
      voucherDate: new Date().toISOString().split('T')[0],
      attachmentCount: 0,
      activeEntryIndex: 0,
      isDirty: false,
      isSaving: false,
      ...computeBalances(entries),
    })
  },

  initForEdit: (voucher) => {
    const entries: VoucherFormEntry[] = voucher.entries
      .sort((a, b) => a.line_num - b.line_num)
      .map((e) => ({
        accountCode: e.account_code,
        accountName: e.account_name,
        direction: e.direction as 'debit' | 'credit',
        amount: e.amount,
        summary: e.summary || '',
        auxiliaryType: e.auxiliary_type,
        auxiliaryId: e.auxiliary_id,
        auxiliaryName: null,
        docNumber: e.doc_number || null,
        quantity: (e as Record<string, unknown>).quantity as number | null,
        unitPrice: (e as Record<string, unknown>).unit_price as number | null,
        unit: (e as Record<string, unknown>).unit as string | null,
        cashFlowTag: null,
        currencyId: (e as Record<string, unknown>).currency_id as string | null,
        exchangeRate: (e as Record<string, unknown>).exchange_rate as number | null,
      }))
    set({
      selectedCompanyId: voucher.company_id,
      selectedPeriodId: voucher.period_id,
      editVoucherId: voucher.id,
      voucherDate: voucher.voucher_date,
      voucherNumber: voucher.voucher_number,
      attachmentCount: voucher.attachment_count,
      voucherWordId: voucher.voucher_word_id,
      entries,
      activeEntryIndex: 0,
      isDirty: false,
      isSaving: false,
      ...computeBalances(entries),
    })
  },

  setHeaderField: (field, value) => {
    set({ [field]: value, isDirty: true } as Partial<VoucherFormState>)
  },

  addEntry: () => {
    set((state) => {
      const entries = [...state.entries, emptyEntry()]
      return { entries, isDirty: true, ...computeBalances(entries) }
    })
  },

  removeEntry: (index) => {
    set((state) => {
      if (state.entries.length <= 2) return state
      const entries = state.entries.filter((_, i) => i !== index)
      const newActive = Math.min(state.activeEntryIndex, entries.length - 1)
      return { entries, activeEntryIndex: newActive, isDirty: true, ...computeBalances(entries) }
    })
  },

  updateEntry: (index, field, value) => {
    set((state) => {
      const entries = state.entries.map((e, i) =>
        i === index ? { ...e, [field]: value } : e,
      )
      return { entries, isDirty: true, ...computeBalances(entries) }
    })
  },

  selectAccount: (index, code, name) => {
    set((state) => {
      const entries = state.entries.map((e, i) =>
        i === index ? { ...e, accountCode: code, accountName: name } : e,
      )
      return { entries, isDirty: true, ...computeBalances(entries) }
    })
  },

  autoBalance: () => {
    set((state) => {
      const diff = state.balanceDiff
      if (diff < 0.01) return state

      const entries = [...state.entries]
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].amount === 0 && entries[i].accountCode) {
          const targetDir = state.totalDebit > state.totalCredit ? 'credit' : 'debit'
          entries[i] = { ...entries[i], direction: targetDir, amount: diff }
          break
        }
      }
      return { entries, isDirty: true, ...computeBalances(entries) }
    })
  },

  setActiveEntry: (index) => {
    set({ activeEntryIndex: index })
  },

  moveToNextRow: () => {
    set((state) => {
      const next = state.activeEntryIndex + 1
      if (next >= state.entries.length) {
        // Stay on last row — use Ctrl+N to add new row
        return { activeEntryIndex: state.entries.length - 1 }
      }
      return { activeEntryIndex: next }
    })
  },

  moveToPrevRow: () => {
    set((state) => ({
      activeEntryIndex: Math.max(0, state.activeEntryIndex - 1),
    }))
  },

  toggleDirection: (index) => {
    set((state) => {
      const entries = state.entries.map((e, i) =>
        i === index
          ? { ...e, direction: (e.direction === 'debit' ? 'credit' : 'debit') as 'debit' | 'credit' }
          : e,
      )
      return { entries, isDirty: true, ...computeBalances(entries) }
    })
  },

  reset: () => {
    const entries = defaultEntries()
    set({
      voucherDate: new Date().toISOString().split('T')[0],
      voucherNumber: '',
      attachmentCount: 0,
      voucherWordId: '',
      entries,
      activeEntryIndex: 0,
      isDirty: false,
      isSaving: false,
      editVoucherId: null,
      lastAutoSaveAt: null,
      ...computeBalances(entries),
    })
  },

  recomputeBalances: () => {
    set((state) => computeBalances(state.entries))
  },
}))
