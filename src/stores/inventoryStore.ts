import { create } from 'zustand'

export interface InventoryItem {
  id: string
  name: string
  spec: string
  unit: string
  quantity: number
  costPrice: number
  stockValue: number
}

interface InventoryState {
  items: InventoryItem[]
  isLoading: boolean
  addItem: (item: Omit<InventoryItem, 'id' | 'stockValue'>) => void
  updateItem: (id: string, item: Partial<InventoryItem>) => void
  deleteItem: (id: string) => void
  getItemById: (id: string) => InventoryItem | undefined
  adjustQuantity: (id: string, quantity: number) => void
}

const mockInventory: InventoryItem[] = [
  { id: '1', name: '笔记本电脑', spec: 'ThinkPad X1 Carbon', unit: '台', quantity: 50, costPrice: 8500, stockValue: 425000 },
  { id: '2', name: '无线鼠标', spec: '罗技MX Master 3', unit: '个', quantity: 200, costPrice: 450, stockValue: 90000 },
  { id: '3', name: '机械键盘', spec: 'HHKB Professional', unit: '把', quantity: 80, costPrice: 1200, stockValue: 96000 },
  { id: '4', name: '显示器', spec: 'Dell 27英寸 4K', unit: '台', quantity: 45, costPrice: 3500, stockValue: 157500 },
  { id: '5', name: 'USB-C扩展坞', spec: 'CalDigit TS4', unit: '个', quantity: 120, costPrice: 1800, stockValue: 216000 },
  { id: '6', name: '固态硬盘', spec: '三星980 PRO 1TB', unit: '块', quantity: 150, costPrice: 800, stockValue: 120000 },
  { id: '7', name: '办公桌', spec: '1.4米标准款', unit: '张', quantity: 30, costPrice: 1200, stockValue: 36000 },
  { id: '8', name: '办公椅', spec: '人体工学款', unit: '把', quantity: 60, costPrice: 800, stockValue: 48000 },
  { id: '9', name: '打印机', spec: 'HP LaserJet Pro', unit: '台', quantity: 15, costPrice: 2500, stockValue: 37500 },
  { id: '10', name: 'A4打印纸', spec: '晨鸣 500张/包', unit: '包', quantity: 500, costPrice: 25, stockValue: 12500 },
]

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: mockInventory,
  isLoading: false,
  addItem: (item) => {
    const newItem: InventoryItem = {
      ...item,
      id: Date.now().toString(),
      stockValue: item.quantity * item.costPrice,
    }
    set((state) => ({ items: [...state.items, newItem] }))
  },
  updateItem: (id, item) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (i.id !== id) return i
        const updated = { ...i, ...item }
        if (item.quantity !== undefined || item.costPrice !== undefined) {
          updated.stockValue = updated.quantity * updated.costPrice
        }
        return updated
      }),
    }))
  },
  deleteItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
  },
  getItemById: (id) => get().items.find((i) => i.id === id),
  adjustQuantity: (id, quantity) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (i.id !== id) return i
        const updatedQuantity = i.quantity + quantity
        return {
          ...i,
          quantity: updatedQuantity,
          stockValue: updatedQuantity * i.costPrice,
        }
      }),
    }))
  },
}))