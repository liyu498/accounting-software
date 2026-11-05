import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { OperationalPage } from '../../lib/operationalPagination'

interface OperationalPaginationProps {
  page: Pick<OperationalPage<unknown>, 'page' | 'pageSize' | 'totalItems' | 'totalPages' | 'start' | 'end'>
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function OperationalPagination({ page, onPageChange, onPageSizeChange }: OperationalPaginationProps) {
  return <footer className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
    <span>显示 {page.start}-{page.end} / {page.totalItems} 条</span>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5">
        <span>每页</span>
        <select value={page.pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-8 border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-200">
          {[20, 50, 100].map((size) => <option key={size} value={size}>{size} 条</option>)}
        </select>
      </label>
      <span className="min-w-16 text-center">第 {page.page} / {page.totalPages} 页</span>
      <button type="button" aria-label="上一页" title="上一页" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)} className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" aria-label="下一页" title="下一页" disabled={page.page >= page.totalPages} onClick={() => onPageChange(page.page + 1)} className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </footer>
}
