import { create } from 'zustand'

interface MenuState {
  activeMenu: string
  sidebarCollapsed: boolean
  setActiveMenu: (id: string) => void
  toggleSidebar: () => void
}

export const useMenuStore = create<MenuState>((set) => ({
  activeMenu: 'dashboard',
  sidebarCollapsed: false,
  setActiveMenu: (id) => set({ activeMenu: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))