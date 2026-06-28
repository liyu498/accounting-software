import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  FileText,
  ReceiptText,
  RefreshCw,
  Users,
} from 'lucide-react'
import { recordAuditLog } from '../lib/exportJobs'

const statusCards = [
  { label: '销项发票', value: '58', sub: '已匹配 46 / 异常 2', icon: ReceiptText, path: '/invoices/output' },
  { label: '进项发票', value: '72', sub: '待勾选 18 / 可抵扣 4.28万', icon: FileCheck2, path: '/invoices/input' },
  { label: '银行账单', value: '96', sub: '待生成凭证 21', icon: Banknote, path: '/bills' },
  { label: '会计凭证', value: '82', sub: '待审核 9 / 已审核 73', icon: FileText, path: '/vouchers' },
  { label: '工资社保', value: '42', sub: '工资表待确认 3 人', icon: Users, path: '/payroll' },
  { label: '税务申报', value: '5', sub: '待确认 3 / 风险 1', icon: FileBarChart, path: '/tax/workspace' },
]

const todoRows = [
  ['发票勾选', '18 张进项发票待确认抵扣用途', '今天', '/invoices/selection'],
  ['银行流水', '21 笔流水未匹配凭证规则', '今天', '/bills'],
  ['风险检查', '凭证、税率、工资社保存在 5 条需复核事项', '结账前', '/risk-check'],
  ['申报取数', '增值税及附加申报表待人工确认', '06-24', '/tax/workspace'],
]

const progress = [
  ['资料采集', 82, '发票、流水、工资、社保资料'],
  ['AI识别', 68, 'OCR、流水分类、规则建议'],
  ['凭证生成', 74, '草稿、审核、附件追溯'],
  ['报表申报', 55, '报表重算、税表取数、申报确认'],
]

export function Dashboard() {
  const [operationNotice, setOperationNotice] = useState<string | null>(null)

  const handleRefreshProgress = () => {
    recordAuditLog({
      module: '账套工作台',
      action: '刷新业务处理进度',
      object: '2026-05主链路看板',
      level: '普通',
      result: '成功',
      status: '已通过',
      voucher: '2026-05/工作台',
      attachment: '进度快照',
    })
    setOperationNotice('业务处理进度已刷新，并记录当前账期主链路进度快照。')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">账套工作台</h1>
          <p className="mt-1 text-sm text-slate-500">2026-05 账期，集中处理资料、AI 做账、凭证、报表、结账和申报。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ai" className="inline-flex h-9 items-center gap-2 rounded border border-[#1f65a7] bg-white px-3 text-sm font-medium text-[#1f65a7] hover:bg-[#eef6ff]">
            <Bot className="h-4 w-4" />
            AI做账
          </Link>
          <Link to="/tax/workspace" className="inline-flex h-9 items-center gap-2 rounded bg-[#1f65a7] px-3 text-sm font-medium text-white hover:bg-[#174f82]">
            <FileCheck2 className="h-4 w-4" />
            申报工作台
          </Link>
        </div>
      </div>

      {operationNotice && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
          {operationNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {statusCards.map((item) => (
          <Link key={item.label} to={item.path} className="rounded border border-slate-200 bg-white p-3 hover:border-[#2d6fa8] hover:bg-[#f8fbff]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{item.label}</span>
              <item.icon className="h-4 w-4 text-[#2d6fa8]" />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{item.value}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{item.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-900">业务处理进度</h2>
              <p className="text-xs text-slate-500">按竞品看板结构展示从采集到申报的主链路。</p>
            </div>
            <button type="button" onClick={handleRefreshProgress} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {progress.map(([name, percent, desc]) => (
              <div key={String(name)} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{name}</span>
                  <span className="font-semibold text-[#1f65a7]">{percent}%</span>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-[#2d6fa8]" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 text-xs text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">税务日历</div>
          <div className="space-y-2 p-4">
            {[
              ['06-24', '增值税及附加', '待确认'],
              ['06-25', '扣缴所得税', '待取数'],
              ['06-28', '社保费', '校验通过'],
            ].map(([date, name, state]) => (
              <div key={name} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-[#2d6fa8]" />
                  <div>
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-slate-500">截止 {date}</div>
                  </div>
                </div>
                <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{state}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">待办事项</div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#f3f7fb] text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">模块</th>
                  <th className="px-4 py-3">事项</th>
                  <th className="px-4 py-3">期限</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todoRows.map(([module, text, due, path]) => (
                  <tr key={text} className="hover:bg-[#f8fbff]">
                    <td className="px-4 py-3 font-medium">{module}</td>
                    <td className="px-4 py-3 text-slate-600">{text}</td>
                    <td className="px-4 py-3 text-slate-500">{due}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={path} className="inline-flex items-center gap-1 text-[#1f65a7]">
                        处理
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">风险提示</div>
          <div className="space-y-3 p-4 text-sm">
            <div className="flex gap-2 rounded border border-red-100 bg-red-50 p-3 text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>1 张凭证借贷不平，阻断结账。</span>
            </div>
            <div className="flex gap-2 rounded border border-amber-100 bg-amber-50 p-3 text-amber-700">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
              <span>2 张进项发票税率与商品分类不一致。</span>
            </div>
            <div className="flex gap-2 rounded border border-green-100 bg-green-50 p-3 text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>工资表人数与社保人数校验通过。</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
