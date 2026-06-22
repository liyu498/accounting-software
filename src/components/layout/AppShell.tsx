import React, { useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  Calculator,
  CheckSquare,
  ChevronDown,
  Coins,
  FileBarChart,
  FileCheck2,
  FileSpreadsheet,
  FileStack,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Notebook,
  Package,
  PiggyBank,
  Receipt,
  ReceiptIndianRupee,
  ReceiptText,
  Scale,
  ScrollText,
  Settings,
  Shield,
  Sun,
  Table2,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore, type ThemeMode } from '../../stores/themeStore'
import { CompanySelector } from '../settings/CompanySelector'

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

interface SidebarSection {
  id: string
  label: string
  icon: React.ReactNode
  items: SidebarItem[]
}

const topLevelItems: SidebarItem[] = [
  { id: 'dashboard', label: '工作台', icon: <LayoutDashboard className="h-4 w-4" />, path: '/dashboard' },
  { id: 'ai', label: 'AI做账', icon: <Bot className="h-4 w-4" />, path: '/ai' },
]

const allSections: SidebarSection[] = [
  {
    id: 'business',
    label: '业务处理',
    icon: <Briefcase className="h-4 w-4" />,
    items: [
      { id: 'invoices-output', label: '销项发票', icon: <ReceiptIndianRupee className="h-4 w-4" />, path: '/invoices/output' },
      { id: 'invoice-selection', label: '发票勾选', icon: <CheckSquare className="h-4 w-4" />, path: '/invoices/selection' },
      { id: 'invoices-input', label: '进项发票', icon: <ReceiptText className="h-4 w-4" />, path: '/invoices/input' },
      { id: 'bills', label: '账单一览', icon: <Landmark className="h-4 w-4" />, path: '/bills' },
      { id: 'receipts', label: '票据', icon: <Receipt className="h-4 w-4" />, path: '/receipts' },
      { id: 'documents', label: '单据登记', icon: <FileStack className="h-4 w-4" />, path: '/documents' },
      { id: 'transfers', label: '账户转账', icon: <ArrowLeftRight className="h-4 w-4" />, path: '/transfers' },
      { id: 'employees', label: '人员登记', icon: <Users className="h-4 w-4" />, path: '/employees' },
      { id: 'payroll', label: '薪酬表', icon: <HandCoins className="h-4 w-4" />, path: '/payroll' },
      { id: 'social-security', label: '社保公积金', icon: <Shield className="h-4 w-4" />, path: '/social-security' },
      { id: 'special-deductions', label: '专项附加扣除', icon: <FileSpreadsheet className="h-4 w-4" />, path: '/special-deductions' },
      { id: 'depreciation', label: '折旧摊销', icon: <Calculator className="h-4 w-4" />, path: '/depreciation' },
      { id: 'inventory', label: '存货设置', icon: <Package className="h-4 w-4" />, path: '/inventory' },
      { id: 'units', label: '计量单位', icon: <Scale className="h-4 w-4" />, path: '/units' },
    ],
  },
  {
    id: 'finance',
    label: '财务',
    icon: <Coins className="h-4 w-4" />,
    items: [
      { id: 'vouchers', label: '会计凭证', icon: <FileText className="h-4 w-4" />, path: '/vouchers' },
      { id: 'period-closing', label: '期末结转', icon: <Calculator className="h-4 w-4" />, path: '/period-closing' },
      { id: 'risk-check', label: '风险检查', icon: <Shield className="h-4 w-4" />, path: '/risk-check' },
      { id: 'trial-balance', label: '科目余额表', icon: <Scale className="h-4 w-4" />, path: '/reports/trial-balance' },
      { id: 'account-summary', label: '科目汇总表', icon: <Table2 className="h-4 w-4" />, path: '/reports/account-summary' },
      { id: 'general-ledger', label: '总账', icon: <BookOpen className="h-4 w-4" />, path: '/reports/general-ledger' },
      { id: 'subsidiary-ledger', label: '明细账', icon: <ScrollText className="h-4 w-4" />, path: '/reports/subsidiary-ledger' },
      { id: 'auxiliary-ledger', label: '辅助核算账', icon: <Scale className="h-4 w-4" />, path: '/reports/auxiliary-ledger' },
      { id: 'auxiliary-balance', label: '辅助余额表', icon: <BarChart3 className="h-4 w-4" />, path: '/reports/auxiliary-balance' },
      { id: 'multi-column-ledger', label: '多栏账', icon: <Table2 className="h-4 w-4" />, path: '/reports/multi-column-ledger' },
    ],
  },
  {
    id: 'reports',
    label: '报表',
    icon: <FileBarChart className="h-4 w-4" />,
    items: [
      { id: 'balance-sheet', label: '资产负债表', icon: <Landmark className="h-4 w-4" />, path: '/reports/balance-sheet' },
      { id: 'income-statement', label: '利润表', icon: <Activity className="h-4 w-4" />, path: '/reports/income-statement' },
      { id: 'income-quarter', label: '利润表季报', icon: <Activity className="h-4 w-4" />, path: '/reports/income-quarter' },
      { id: 'cash-flow', label: '现金流量表', icon: <ArrowLeftRight className="h-4 w-4" />, path: '/reports/cash-flow' },
      { id: 'cash-flow-quarter', label: '现金流量表季报', icon: <ArrowLeftRight className="h-4 w-4" />, path: '/reports/cash-flow-quarter' },
      { id: 'equity-change', label: '所有者权益变动表', icon: <Notebook className="h-4 w-4" />, path: '/reports/equity-change' },
    ],
  },
  {
    id: 'tax',
    label: '税务申报',
    icon: <BadgeDollarSign className="h-4 w-4" />,
    items: [
      { id: 'tax-workspace', label: '申报工作台', icon: <FileCheck2 className="h-4 w-4" />, path: '/tax/workspace' },
      { id: 'vat-report', label: '增值税及附加', icon: <BadgeDollarSign className="h-4 w-4" />, path: '/tax/vat' },
      { id: 'withholding-tax', label: '扣缴所得税', icon: <HandCoins className="h-4 w-4" />, path: '/tax/withholding' },
      { id: 'stamp-tax', label: '印花税', icon: <FileSpreadsheet className="h-4 w-4" />, path: '/tax/stamp' },
      { id: 'income-tax', label: '企业所得税', icon: <Coins className="h-4 w-4" />, path: '/tax/income' },
      { id: 'social-security-tax', label: '社保费', icon: <Shield className="h-4 w-4" />, path: '/tax/social-security' },
      { id: 'tax-finance-report', label: '财报报送', icon: <FileBarChart className="h-4 w-4" />, path: '/tax/finance-report' },
      { id: 'non-tax-revenue', label: '非税收入', icon: <PiggyBank className="h-4 w-4" />, path: '/tax/non-tax' },
    ],
  },
  {
    id: 'settings-nav',
    label: '设置',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { id: 'company-info', label: '企业信息', icon: <Building2 className="h-4 w-4" />, path: '/settings/company-info' },
      { id: 'initial-balances', label: '期初余额', icon: <Calculator className="h-4 w-4" />, path: '/settings/initial-balances' },
      { id: 'tax-init', label: '申报初始化', icon: <BadgeDollarSign className="h-4 w-4" />, path: '/settings/tax-init' },
      { id: 'history-vouchers', label: '历史凭证', icon: <FileText className="h-4 w-4" />, path: '/settings/history-vouchers' },
      { id: 'history-balances', label: '历史科目余额表', icon: <Scale className="h-4 w-4" />, path: '/settings/history-balances' },
      { id: 'history-general-ledger', label: '历史总账', icon: <BookOpen className="h-4 w-4" />, path: '/settings/history-general-ledger' },
      { id: 'history-subsidiary-ledger', label: '历史明细账', icon: <ScrollText className="h-4 w-4" />, path: '/settings/history-subsidiary-ledger' },
      { id: 'accounts', label: '账户登记', icon: <Wallet className="h-4 w-4" />, path: '/settings/accounts' },
      { id: 'customers', label: '客户', icon: <Users className="h-4 w-4" />, path: '/settings/customers' },
      { id: 'suppliers', label: '供应商', icon: <Building2 className="h-4 w-4" />, path: '/settings/suppliers' },
      { id: 'other-contacts', label: '其他往来', icon: <ArrowLeftRight className="h-4 w-4" />, path: '/settings/other-contacts' },
      { id: 'projects', label: '项目', icon: <Briefcase className="h-4 w-4" />, path: '/settings/projects' },
      { id: 'departments', label: '部门', icon: <Building2 className="h-4 w-4" />, path: '/settings/departments' },
      { id: 'tags', label: '标签', icon: <Receipt className="h-4 w-4" />, path: '/settings/tags' },
      { id: 'account-codes', label: '科目', icon: <BookOpen className="h-4 w-4" />, path: '/settings/account-codes' },
      { id: 'asset-categories', label: '资产类别', icon: <Package className="h-4 w-4" />, path: '/settings/asset-categories' },
      { id: 'invoice-rules', label: '发票自动匹配规则', icon: <ReceiptText className="h-4 w-4" />, path: '/settings/invoice-rules' },
      { id: 'bill-rules', label: '账单自动匹配规则', icon: <Landmark className="h-4 w-4" />, path: '/settings/bill-rules' },
      { id: 'auxiliary-categories', label: '辅助核算类别', icon: <Scale className="h-4 w-4" />, path: '/settings/auxiliary-categories' },
      { id: 'auxiliary-items', label: '辅助核算项目', icon: <Table2 className="h-4 w-4" />, path: '/settings/auxiliary-items' },
      { id: 'common-digests', label: '常用摘要', icon: <ScrollText className="h-4 w-4" />, path: '/settings/common-digests' },
      { id: 'settlement-rules', label: '结转规则', icon: <ArrowLeftRight className="h-4 w-4" />, path: '/settings/settlement-rules' },
      { id: 'currencies', label: '币别管理', icon: <Coins className="h-4 w-4" />, path: '/settings/currencies' },
      { id: 'roles', label: '权限管理', icon: <Shield className="h-4 w-4" />, path: '/settings/roles' },
      { id: 'voucher-recycle', label: '会计凭证回收箱', icon: <FileText className="h-4 w-4" />, path: '/settings/voucher-recycle' },
    ],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const allItems = useMemo(() => [...topLevelItems, ...allSections.flatMap((section) => section.items)], [])
  const activeItem = allItems.find((item) => item.path === location.pathname)

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  return (
    <div className="flex h-screen bg-[#eef3f8] text-slate-900">
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed left-3 top-3 z-50 rounded bg-[#1f65a7] p-2 text-white lg:hidden"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside
        className={cn(
          'fixed z-40 flex h-full w-[248px] flex-col border-r border-[#102942] bg-[#173653] text-white lg:relative',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#2d79bd] text-sm font-semibold">账</div>
          <div>
            <div className="text-sm font-semibold leading-4">AI 代理记账</div>
            <div className="text-[11px] text-white/55">桌面端财税工作台</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <div className="mb-2 space-y-1">
            {topLevelItems.map((item) => (
              <NavLink key={item.id} item={item} active={activeItem?.id === item.id} onClick={() => setIsMobileMenuOpen(false)} />
            ))}
          </div>

          {allSections.map((section) => {
            const collapsed = collapsedSections.has(section.id)
            const sectionActive = section.items.some((item) => item.id === activeItem?.id)
            return (
              <div key={section.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded px-2 text-xs font-semibold text-white/75 hover:bg-white/10 hover:text-white',
                    sectionActive && 'bg-white/10 text-white'
                  )}
                >
                  {section.icon}
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', collapsed && '-rotate-90')} />
                </button>
                {!collapsed && (
                  <div className="mt-1 space-y-0.5 pl-2">
                    {section.items.map((item) => (
                      <NavLink key={item.id} item={item} active={activeItem?.id === item.id} onClick={() => setIsMobileMenuOpen(false)} dense />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-[#f8fbff] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <CompanySelector />
            <div className="hidden h-5 w-px bg-slate-200 sm:block" />
            <div className="hidden items-center gap-2 text-xs text-slate-600 md:flex">
              <span className="rounded border border-slate-200 bg-white px-2 py-1">账期 2026-05</span>
              <span className="rounded bg-green-50 px-2 py-1 text-green-700">已结账</span>
              <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">风险 5</span>
            </div>
            <h1 className="truncate text-sm font-semibold text-slate-900">{activeItem?.label || '工作台'}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 sm:flex">
              <User className="h-3.5 w-3.5 text-[#1f65a7]" />
              {user?.username || 'admin'}
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  )
}

function NavLink({ item, active, onClick, dense = false }: { item: SidebarItem; active: boolean; onClick: () => void; dense?: boolean }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded px-2 text-sm transition-colors',
        dense ? 'h-7 text-xs' : 'h-8',
        active ? 'bg-[#2d79bd] text-white' : 'text-white/67 hover:bg-white/10 hover:text-white'
      )}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function ThemeToggle() {
  const { mode, setMode } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)
  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: '跟随系统', icon: <Monitor className="h-4 w-4" /> },
    { value: 'light', label: '浅色', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: '深色', icon: <Moon className="h-4 w-4" /> },
  ]
  const currentIcon = mode === 'dark' ? <Moon className="h-4 w-4" /> : mode === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
        title="主题设置"
      >
        {currentIcon}
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded border border-slate-200 bg-white py-1 shadow-lg">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setMode(option.value)
                  setShowMenu(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs',
                  mode === option.value ? 'bg-[#eef6ff] text-[#1f65a7]' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
