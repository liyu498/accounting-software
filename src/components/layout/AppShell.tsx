import React, { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  Receipt,
  Package,
  Building2,
  Bot,
  Settings,
  ChevronLeft,
  LogOut,
  User,
  Menu,
  ChevronDown,
  BookOpen,
  FileStack,
  Scale,
  BarChart3,
  TrendingUp,
  Activity,
  Calculator,
  Briefcase,
  FileBarChart,
  Coins,
  ArrowLeftRight,
  ReceiptText,
  Table2,
  Notebook,
  ScrollText,
  Landmark,
  ReceiptIndianRupee,
  FileSpreadsheet,
  HandCoins,
  PiggyBank,
  BadgeDollarSign,
  DollarSign,
  Shield,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore, type ThemeMode } from '../../stores/themeStore'
import { CompanySelector } from '../settings/CompanySelector'

interface SidebarSection {
  id: string
  label: string
  icon: React.ReactNode
  items: SidebarItem[]
}

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

// Top-level menu items (always visible in main nav - no sub-items)
const topLevelItems: SidebarItem[] = [
  { id: 'welcome', label: '客户总览', icon: <LayoutDashboard className="w-5 h-5" />, path: '/' },
  { id: 'ai', label: 'AI记账', icon: <Bot className="w-5 h-5" />, path: '/ai' },
]

// 业务处理 Section - 删除凭证管理（凭证管理合并到财务模块）
const businessProcessingSection: SidebarSection = {
  id: 'business',
  label: '业务处理',
  icon: <Briefcase className="w-5 h-5" />,
  items: [
    { id: 'invoices-output', label: '销项发票', icon: <ReceiptIndianRupee className="w-5 h-5" />, path: '/invoices/output' },
    { id: 'invoices-input', label: '进项发票', icon: <ReceiptText className="w-5 h-5" />, path: '/invoices/input' },
    { id: 'inventory', label: '库存管理', icon: <Package className="w-5 h-5" />, path: '/inventory' },
    { id: 'bank', label: '银行对账', icon: <Building2 className="w-5 h-5" />, path: '/bank' },
  ],
}

// 财务 Section - 包含"财务"和"账簿"两个子分组（UI不显示分组名）
// 财务子分组：会计凭证、期末结转
// 账簿子分组：科目余额表、科目汇总表、总账、明细账
const financeSection: SidebarSection = {
  id: 'finance',
  label: '财务',
  icon: <Coins className="w-5 h-5" />,
  items: [
    // 财务
    { id: 'vouchers', label: '会计凭证', icon: <FileText className="w-5 h-5" />, path: '/vouchers' },
    { id: 'period-closing', label: '期末结转', icon: <Calculator className="w-5 h-5" />, path: '/period-closing' },
    // 账簿
    { id: 'trial-balance', label: '科目余额表', icon: <Scale className="w-5 h-5" />, path: '/reports/trial-balance' },
    { id: 'account-summary', label: '科目汇总表', icon: <Table2 className="w-5 h-5" />, path: '/reports/account-summary' },
    { id: 'general-ledger', label: '总账', icon: <BookOpen className="w-5 h-5" />, path: '/reports/general-ledger' },
    { id: 'subsidiary-ledger', label: '明细账', icon: <ScrollText className="w-5 h-5" />, path: '/reports/subsidiary-ledger' },
    { id: 'auxiliary-ledger', label: '辅助核算账', icon: <Scale className="w-5 h-5" />, path: '/reports/auxiliary-ledger' },
    { id: 'auxiliary-balance', label: '辅助余额表', icon: <BarChart3 className="w-5 h-5" />, path: '/reports/auxiliary-balance' },
    { id: 'multi-column-ledger', label: '多栏账', icon: <Table2 className="w-5 h-5" />, path: '/reports/multi-column-ledger' },
  ],
}

// 报表 Section - 包含"会计报表"和"税务报表"两个子分组（UI不显示分组名）
// 会计报表：资产负债表、利润表、现金流量表、所有者权益变动表
// 税务报表：增值税、印花税、企业所得税、财报、非税收入
const reportsSection: SidebarSection = {
  id: 'reports',
  label: '报表',
  icon: <FileBarChart className="w-5 h-5" />,
  items: [
    // 会计报表
    { id: 'balance-sheet', label: '资产负债表', icon: <Landmark className="w-5 h-5" />, path: '/reports/balance-sheet' },
    { id: 'income-statement', label: '利润表', icon: <Activity className="w-5 h-5" />, path: '/reports/income-statement' },
    { id: 'cash-flow', label: '现金流量表', icon: <ArrowLeftRight className="w-5 h-5" />, path: '/reports/cash-flow' },
    { id: 'equity-change', label: '所有者权益变动表', icon: <Notebook className="w-5 h-5" />, path: '/reports/equity-change' },
    // 税务报表
    { id: 'vat-report', label: '增值税', icon: <BadgeDollarSign className="w-5 h-5" />, path: '/tax/vat' },
    { id: 'stamp-tax', label: '印花税', icon: <FileSpreadsheet className="w-5 h-5" />, path: '/tax/stamp' },
    { id: 'income-tax', label: '企业所得税', icon: <HandCoins className="w-5 h-5" />, path: '/tax/income' },
    { id: 'tax-finance-report', label: '财报', icon: <FileBarChart className="w-5 h-5" />, path: '/tax/finance-report' },
    { id: 'non-tax-revenue', label: '非税收入', icon: <PiggyBank className="w-5 h-5" />, path: '/tax/non-tax' },
  ],
}

// 设置 Section - 包含"基本设置"和"数据设置"两个子分组（UI不显示分组名）
// 基本设置：公司信息、期初余额设置、历史凭证导入
// 数据设置：账户登记、供应商、其他往来、科目设置、会计凭证回收箱
const settingsSection: SidebarSection = {
  id: 'settings-nav',
  label: '设置',
  icon: <Settings className="w-5 h-5" />,
  items: [
    // 基本设置
    { id: 'company-info', label: '公司信息', icon: <Building2 className="w-5 h-5" />, path: '/settings/company-info' },
    { id: 'initial-balances', label: '期初余额设置', icon: <Calculator className="w-5 h-5" />, path: '/settings/initial-balances' },
    { id: 'import-history', label: '历史凭证导入', icon: <FileText className="w-5 h-5" />, path: '/settings/import-history' },
    // 数据设置
    { id: 'accounts', label: '账户登记', icon: <Wallet className="w-5 h-5" />, path: '/settings/accounts' },
    { id: 'suppliers', label: '供应商', icon: <Building2 className="w-5 h-5" />, path: '/settings/suppliers' },
    { id: 'other-contacts', label: '其他往来', icon: <ArrowLeftRight className="w-5 h-5" />, path: '/settings/other-contacts' },
    { id: 'account-codes', label: '科目设置', icon: <BookOpen className="w-5 h-5" />, path: '/settings/account-codes' },
    { id: 'auxiliary-categories', label: '辅助核算类别', icon: <Scale className="w-5 h-5" />, path: '/settings/auxiliary-categories' },
    { id: 'auxiliary-items', label: '辅助核算项目', icon: <Table2 className="w-5 h-5" />, path: '/settings/auxiliary-items' },
    { id: 'common-digests', label: '常用摘要', icon: <ScrollText className="w-5 h-5" />, path: '/settings/common-digests' },
    { id: 'settlement-rules', label: '结转规则', icon: <ArrowLeftRight className="w-5 h-5" />, path: '/settings/settlement-rules' },
    { id: 'currencies', label: '币别管理', icon: <Coins className="w-5 h-5" />, path: '/settings/currencies' },
    { id: 'roles', label: '权限管理', icon: <Shield className="w-5 h-5" />, path: '/settings/roles' },
    { id: 'voucher-recycle', label: '会计凭证回收箱', icon: <FileText className="w-5 h-5" />, path: '/settings/voucher-recycle' },
  ],
}


// 导航顺序：1.Dashboard 2.业务处理 3.财务 4.报表 5.AI记账 6.设置 7.客户与合同
const allSections = [
  businessProcessingSection,  // 2. 业务处理
  financeSection,              // 3. 财务
  reportsSection,              // 4. 报表
  settingsSection,             // 6. 设置
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  // Build flat list of all sidebar items for active detection
  const allItems = [
    ...topLevelItems,
    ...allSections.flatMap((s) => s.items),
  ]
  const activeItem = allItems.find((item) => item.path === location.pathname)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-primary-600 text-white rounded-lg"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:relative z-40 h-full bg-[#1e3a5f] text-white transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-[72px]' : 'w-[260px]',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div
            className={cn(
              'flex items-center h-16 px-4 border-b border-white/10',
              isCollapsed ? 'justify-center' : 'justify-between'
            )}
          >
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold">账</span>
                </div>
                <span className="font-semibold text-lg">会计软件</span>
              </div>
            )}
            {isCollapsed && (
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold">账</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {/* Top-level Menu Items */}
            <ul className="space-y-1 px-2 mb-4">
              {topLevelItems.map((item) => {
                const isActive = activeItem?.id === item.id
                return (
                  <li key={item.id}>
                    <Link
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors',
                        isActive
                          ? 'bg-white/20 text-white border-l-4 border-primary-400'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                        isCollapsed && 'justify-center px-2'
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!isCollapsed && <span className="font-medium">{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Divider */}
            {isCollapsed && <div className="mx-2 my-2 border-t border-white/10" />}

            {/* Collapsible Sections */}
            {allSections.map((section) => {
              const isSectionCollapsed = collapsedSections.has(section.id)
              return (
                <div key={section.id} className="px-2">
                  {/* Section Header */}
                  <button
                    type="button"
                    onClick={() => !isCollapsed && toggleSection(section.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-white/70 hover:bg-white/10 hover:text-white',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? section.label : undefined}
                  >
                    {section.icon}
                    {!isCollapsed && (
                      <>
                        <span className="font-medium flex-1 text-left">{section.label}</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 transition-transform',
                            isSectionCollapsed && 'rotate-180'
                          )}
                        />
                      </>
                    )}
                    {isCollapsed && <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Section Items */}
                  {!isCollapsed && !isSectionCollapsed && (
                    <ul className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {section.items.map((item) => {
                        const isActive = activeItem?.id === item.id
                        return (
                          <li key={item.id}>
                            <Link
                              to={item.path}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors',
                                isActive
                                  ? 'bg-white/20 text-white border-l-4 border-primary-400 -ml-3 pl-3'
                                  : 'text-white/60 hover:bg-white/10 hover:text-white'
                              )}
                            >
                              {item.icon}
                              <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Collapse Toggle */}
          <div className="hidden lg:block p-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center justify-center w-full p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              {isCollapsed ? (
                <ChevronLeft className="w-5 h-5 rotate-180" />
              ) : (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm">收起</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <CompanySelector />
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {activeItem?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.username || 'Admin'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role || '管理员'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">{children}</main>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { mode, setMode } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: '跟随系统', icon: <Monitor className="w-4 h-4" /> },
    { value: 'light', label: '浅色模式', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: '深色模式', icon: <Moon className="w-4 h-4" /> },
  ]

  const currentIcon = mode === 'dark' ? <Moon className="w-4 h-4" /> : mode === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="主题设置"
      >
        {currentIcon}
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-elevated py-1 min-w-[140px]">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setMode(opt.value); setShowMenu(false) }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                  mode === opt.value
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}