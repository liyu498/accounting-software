import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/authStore'
import { agencyNavItems } from './agencyNav'

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
