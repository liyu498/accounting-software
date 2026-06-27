import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  UploadCloud,
  WalletCards,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useWarningToast } from '../components/ui/Toast'
import { useCompanyStore, type Company } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { TaxpayerType, AccountingSystem } from '../lib/constants'
import { cn } from '../lib/utils'
import { agencyNavItems } from './agency/agencyNav'

interface SummaryMetric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}

const demoCompanies = [
  { code: '01460', name: '科旋电气（上海）有限公司', status: '已结账', invoices: '126/138', vouchers: '82', tax: '待确认', risk: '2' },
  { code: '02018', name: '上海云启科技有限公司', status: '做账中', invoices: '84/91', vouchers: '47', tax: '未取数', risk: '5' },
  { code: '03009', name: '杭州辰光贸易有限公司', status: '待收票', invoices: '38/70', vouchers: '19', tax: '未开始', risk: '8' },
]

const taxCalendar = [
  { date: '06-24', name: '增值税及附加', count: 12, tone: 'warn' },
  { date: '06-25', name: '个税扣缴', count: 18, tone: 'info' },
  { date: '06-28', name: '社保费', count: 9, tone: 'ok' },
]

export function Welcome() {
  const navigate = useNavigate()
  const warningToast = useWarningToast()
  const { companies, selectCompany, fetchCompanies, createCompany } = useCompanyStore()
  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    taxId: '',
    taxpayerType: 'small' as TaxpayerType,
    accountingSystem: 'small_enterprise' as AccountingSystem,
    enableYear: new Date().getFullYear(),
    enableMonth: new Date().getMonth() + 1,
  })

  useEffect(() => {
    fetchCompanies().catch((err) => console.error('[Welcome] fetchCompanies failed:', err))
  }, [fetchCompanies])

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return companies.filter((company) => {
      if (!company.is_active) return false
      if (!q) return true
      return company.name.toLowerCase().includes(q) || company.code.toLowerCase().includes(q)
    })
  }, [companies, searchQuery])

  const rows = filteredCompanies.length > 0
    ? filteredCompanies.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
        status: '做账中',
        invoices: '0/0',
        vouchers: '0',
        tax: '未取数',
        risk: '0',
        real: true,
      }))
    : demoCompanies.map((company) => ({ ...company, id: company.code, real: false }))

  const summaryMetrics: SummaryMetric[] = [
    { label: '客户数', value: companies.length || demoCompanies.length, icon: Building2 },
    { label: '待收票', value: 18, icon: ReceiptText },
    { label: '待做账', value: 27, icon: FileText },
    { label: '待申报', value: 12, icon: FileCheck2 },
    { label: '风险项', value: 15, icon: CircleAlert },
    { label: '自动化任务', value: 36, icon: ShieldCheck },
  ]

  const handleSelectCompany = async (companyId: string, isReal: boolean) => {
    if (!isReal) {
      navigate('/dashboard')
      return
    }
    selectCompany(companyId)
    await fetchPeriods(companyId)
    await fetchVoucherWords(companyId)
    navigate('/dashboard')
  }

  const handleCreateCompany = async () => {
    if (!newCompany.name.trim() || !newCompany.code.trim() || !newCompany.taxId.trim()) {
      warningToast('请填写客户名称、编码和纳税人识别号')
      return
    }

    const company = await createCompany({
      code: newCompany.code,
      name: newCompany.name,
      tax_id: newCompany.taxId,
      tax_type: newCompany.taxpayerType,
      accounting_system: newCompany.accountingSystem,
      enable_year: newCompany.enableYear,
      enable_month: newCompany.enableMonth,
    })
    setShowAddModal(false)
    await handleSelectCompany(company.id, true)
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      <header className="border-b border-slate-200 bg-[#f8fbff]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#1f65a7] text-sm font-semibold text-white">账</div>
            <div>
              <div className="text-base font-semibold">代理记账工作台</div>
              <div className="text-xs text-slate-500">多企业做账、申报、风险和资料进度</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <Archive className="h-4 w-4" />
              下载中心
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              新增账套
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-6 py-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-lg font-semibold">机构级批量工作</h1>
                <p className="text-xs text-slate-500">这些功能面向全部客户账套，处理合同、收费、协同、工单、批量申报、统计和自动化。</p>
              </div>
              <span className="inline-flex w-fit rounded bg-[#eef6ff] px-2 py-1 text-xs font-medium text-[#1f65a7]">不进入单公司账套</span>
            </div>
            <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-5">
              {agencyNavItems.map((item) => (
                <Link key={item.id} to={item.path} className="group rounded border border-slate-200 bg-white p-3 hover:border-[#2d6fa8] hover:bg-[#f8fbff]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 group-hover:text-[#1f65a7]">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#eef6ff] text-[#1f65a7]">{item.icon}</span>
                    {item.label}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {summaryMetrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <Icon className="h-4 w-4 text-[#2d6fa8]" />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{String(value)}</div>
              </div>
            ))}
          </div>

          <div className="rounded border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-lg font-semibold">客户账套进度</h1>
                <p className="text-xs text-slate-500">按竞品工作台方式集中查看收票、凭证、报表、申报和风险状态</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="h-9 rounded border-slate-300 pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索客户名称或编码" />
                </div>
                <Button size="sm" variant="outline"><UploadCloud className="h-4 w-4" />批量导入</Button>
                <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" />新增客户</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f3f7fb] text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">客户编码</th>
                    <th className="px-4 py-3">客户名称</th>
                    <th className="px-4 py-3">账期</th>
                    <th className="px-4 py-3">结账状态</th>
                    <th className="px-4 py-3">发票采集</th>
                    <th className="px-4 py-3">凭证</th>
                    <th className="px-4 py-3">申报</th>
                    <th className="px-4 py-3">风险</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((company) => (
                    <tr key={company.id} className="hover:bg-[#f8fbff]">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{company.code}</td>
                      <td className="px-4 py-3 font-medium">{company.name}</td>
                      <td className="px-4 py-3">2026-05</td>
                      <td className="px-4 py-3"><StatusPill value={company.status} /></td>
                      <td className="px-4 py-3">{company.invoices}</td>
                      <td className="px-4 py-3">{company.vouchers} 张</td>
                      <td className="px-4 py-3">{company.tax}</td>
                      <td className="px-4 py-3"><span className={cn('font-semibold', Number(company.risk) > 0 ? 'text-red-600' : 'text-green-600')}>{company.risk}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleSelectCompany(company.id, company.real)} className="inline-flex items-center gap-1 text-sm font-medium text-[#1f65a7] hover:text-[#174f82]">
                          进入账套
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold">税务日历</div>
            <div className="space-y-2 p-4">
              {taxCalendar.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-[#2d6fa8]" />
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-slate-500">截止 {item.date}</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold">批量处理</div>
            <div className="grid grid-cols-2 gap-2 p-4 text-sm">
              {agencyNavItems.slice(5).map((item) => (
                <Link key={item.id} to={item.path} className="rounded border border-slate-200 bg-white px-3 py-2 text-left hover:border-[#2d6fa8] hover:text-[#1f65a7]">{item.label}</Link>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">新增客户账套</h2>
            </div>
            <div className="space-y-3 p-5">
              <Input placeholder="客户名称" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} />
              <Input placeholder="客户编码" value={newCompany.code} onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value })} />
              <Input placeholder="纳税人识别号" value={newCompany.taxId} onChange={(e) => setNewCompany({ ...newCompany, taxId: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button onClick={handleCreateCompany}>保存并进入</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  const cls = value === '已结账' ? 'bg-green-50 text-green-700' : value === '做账中' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
  const Icon = value === '已结账' ? CheckCircle2 : value === '做账中' ? Clock3 : WalletCards
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium', cls)}>
      <Icon className="h-3.5 w-3.5" />
      {value}
    </span>
  )
}
