import { create } from 'zustand'

export interface BankTransaction {
  id: string
  date: string
  description: string
  debit: number
  credit: number
  matched: boolean
}

export interface BankAccount {
  id: string
  name: string
  accountNumber: string
  bankName: string
  balance: number
}

interface BankReconciliationState {
  bankAccounts: BankAccount[]
  bankTransactions: BankTransaction[]
  bookTransactions: BankTransaction[]
  isLoading: boolean
  addBankAccount: (account: Omit<BankAccount, 'id'>) => void
  addBankTransaction: (transaction: Omit<BankTransaction, 'id' | 'matched'>) => void
  matchTransaction: (bankTransactionId: string, bookTransactionId: string) => void
  unmatchTransaction: (bankTransactionId: string) => void
  getUnmatchedTransactions: () => { bank: BankTransaction[]; book: BankTransaction[] }
  getBankAccountById: (id: string) => BankAccount | undefined
}

const mockBankAccounts: BankAccount[] = [
  { id: '1', name: '基本户', accountNumber: '1100123456789012', bankName: '中国工商银行', balance: 150000 },
  { id: '2', name: '一般户', accountNumber: '1200123456789012', bankName: '中国建设银行', balance: 85000 },
  { id: '3', name: '纳税户', accountNumber: '1300123456789012', bankName: '中国农业银行', balance: 25000 },
]

const mockBankTransactions: BankTransaction[] = [
  { id: '1', date: '2024-04-01', description: '收到北京科技货款', debit: 50000, credit: 0, matched: true },
  { id: '2', date: '2024-04-02', description: '支付上海贸易货款', debit: 0, credit: 30000, matched: true },
  { id: '3', date: '2024-04-03', description: '收到深圳创新预付款', debit: 20000, credit: 0, matched: false },
  { id: '4', date: '2024-04-05', description: '支付办公室租金', debit: 0, credit: 15000, matched: false },
  { id: '5', date: '2024-04-06', description: '收到客户尾款', debit: 35000, credit: 0, matched: false },
  { id: '6', date: '2024-04-08', description: '支付供应商货款', debit: 0, credit: 45000, matched: false },
  { id: '7', date: '2024-04-10', description: '银行利息收入', debit: 150, credit: 0, matched: false },
]

const mockBookTransactions: BankTransaction[] = [
  { id: '1', date: '2024-04-01', description: '收到北京科技货款', debit: 50000, credit: 0, matched: true },
  { id: '2', date: '2024-04-02', description: '支付上海贸易货款', debit: 0, credit: 30000, matched: true },
  { id: '3', date: '2024-04-03', description: '收到深圳创新预付款', debit: 20000, credit: 0, matched: false },
  { id: '4', date: '2024-04-05', description: '支付办公室租金', debit: 0, credit: 15000, matched: false },
  { id: '5', date: '2024-04-07', description: '收到客户尾款', debit: 35000, credit: 0, matched: false },
  { id: '6', date: '2024-04-08', description: '支付供应商货款', debit: 0, credit: 42000, matched: false },
]

export const useBankReconciliationStore = create<BankReconciliationState>((set, get) => ({
  bankAccounts: mockBankAccounts,
  bankTransactions: mockBankTransactions,
  bookTransactions: mockBookTransactions,
  isLoading: false,
  addBankAccount: (account) => {
    const newAccount: BankAccount = {
      ...account,
      id: Date.now().toString(),
    }
    set((state) => ({ bankAccounts: [...state.bankAccounts, newAccount] }))
  },
  addBankTransaction: (transaction) => {
    const newTransaction: BankTransaction = {
      ...transaction,
      id: Date.now().toString(),
      matched: false,
    }
    set((state) => ({ bankTransactions: [...state.bankTransactions, newTransaction] }))
  },
  matchTransaction: (bankTransactionId, _bookTransactionId) => {
    set((state) => ({
      bankTransactions: state.bankTransactions.map((t) =>
        t.id === bankTransactionId ? { ...t, matched: true } : t
      ),
    }))
  },
  unmatchTransaction: (bankTransactionId) => {
    set((state) => ({
      bankTransactions: state.bankTransactions.map((t) =>
        t.id === bankTransactionId ? { ...t, matched: false } : t
      ),
    }))
  },
  getUnmatchedTransactions: () => {
    const state = get()
    return {
      bank: state.bankTransactions.filter((t) => !t.matched),
      book: state.bookTransactions.filter((t) => !t.matched),
    }
  },
  getBankAccountById: (id) => get().bankAccounts.find((a) => a.id === id),
}))