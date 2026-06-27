import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  BadgeDollarSign,
  BarChart3,
  Bot,
  Building2,
  CheckSquare,
  FileCheck2,
  LogOut,
  Monitor,
  Notebook,
  Shield,
  Users,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/authStore'

export interface AgencyNavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description: string
}

export const agencyNavItems: AgencyNavItem[] = [
  { id: 'agency-clients', label: '客户总览', icon: <Building2 className="h-4 w-4" />, path: '/agency/clients', description: '跨客户账套进度、风险、负责人和账期状态。' },
  { id: 'agency-service-contracts', label: '服务合同', icon: <Notebook className="h-4 w-4" />, path: '/agency/service-contracts', description: '代账合同、服务套餐、续费和归档。' },
  { id: 'agency-fees', label: '收费管理', icon: <BadgeDollarSign className="h-4 w-4" />, path: '/agency/fees', description: '机构服务费应收、开票、收款和欠费。' },
  { id: 'agency-collaboration', label: '客户协同', icon: <Users className="h-4 w-4" />, path: '/agency/collaboration', description: '跨客户资料催办、问题确认和门户消息。' },
  { id: 'agency-tickets', label: '服务工单', icon: <Monitor className="h-4 w-4" />, path: '/agency/tickets', description: '机构交付工单、SLA、复核和归档。' },
  { id: 'agency-batch-tax', label: '批量申报', icon: <FileCheck2 className="h-4 w-4" />, path: '/agency/batch-tax', description: '多客户申报取数、校验、确认和回执。' },
  { id: 'agency-data-stats', label: '数据统计', icon: <BarChart3 className="h-4 w-4" />, path: '/agency/data-stats', description: '机构经营、产能、自动化率和风险分布。' },
  { id: 'agency-batch-ops', label: '批量操作', icon: <CheckSquare className="h-4 w-4" />, path: '/agency/batch-ops', description: '多账套批量导入、生成、结转和归档。' },
  { id: 'agency-health', label: '健康体检', icon: <Shield className="h-4 w-4" />, path: '/agency/health-check', description: '跨客户发票、凭证、报表和税务风险扫描。' },
  { id: 'agency-automation', label: '财税自动化', icon: <Bot className="h-4 w-4" />, path: '/agency/automation', description: '机构自动采票、识别、匹配和申报前置任务。' },
]

export function AgencyLayout() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const activeItem = agencyNavItems.find((item) => item.path === location.pathname)

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3f8] text-slate-900">
      <header className="border-b border-slate-200 bg-[#f8fbff]">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded bg-[#1f65a7] text-sm font-semibold text-white">
              账
            </Link>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">代理机构工作台</div>
              <div className="text-[11px] text-slate-500">跨客户账套经营、批量处理和交付控制</div>
            </div>
            <div className="hidden h-5 w-px bg-slate-200 md:block" />
            <Link to="/" className="inline-flex rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[#1f65a7] hover:text-[#1f65a7]">
              返回客户账套列表
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden rounded border border-slate-200 bg-white px-2 py-1 sm:inline-flex">{user?.username || 'admin'}</span>
            <button type="button" onClick={logout} className="inline-flex h-8 items-center gap-1 rounded px-2 hover:bg-slate-100">
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-10 max-w-[1440px] items-center gap-1 overflow-x-auto px-6">
          {agencyNavItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs transition-colors',
                activeItem?.id === item.id ? 'bg-[#1f65a7] text-white' : 'text-slate-600 hover:bg-[#eef6ff] hover:text-[#1f65a7]'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
          <span className="ml-auto shrink-0 text-xs text-slate-400">机构级批量处理，不进入单公司账套</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
