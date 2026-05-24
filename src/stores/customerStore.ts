import { create } from 'zustand'

export interface Customer {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  address?: string
  createdAt: string
}

interface CustomerState {
  customers: Customer[]
  isLoading: boolean
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void
  updateCustomer: (id: string, customer: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  getCustomerById: (id: string) => Customer | undefined
}

// Mock data
const mockCustomers: Customer[] = [
  { id: '1', name: '北京科技有限公司', contact: '张经理', phone: '010-12345678', email: 'contact@example.com', createdAt: '2024-01-15' },
  { id: '2', name: '上海贸易公司', contact: '李总', phone: '021-87654321', email: 'shanghai@example.com', createdAt: '2024-02-20' },
  { id: '3', name: '深圳创新企业', contact: '王总监', phone: '0755-11223344', email: 'sz@example.com', createdAt: '2024-03-10' },
]

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: mockCustomers,
  isLoading: false,
  addCustomer: (customer) => {
    const newCustomer: Customer = {
      ...customer,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0] ?? '',
    }
    set((state) => ({ customers: [...state.customers, newCustomer] }))
  },
  updateCustomer: (id, customer) => {
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? { ...c, ...customer } : c)),
    }))
  },
  deleteCustomer: (id) => {
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }))
  },
  getCustomerById: (id) => get().customers.find((c) => c.id === id),
}))