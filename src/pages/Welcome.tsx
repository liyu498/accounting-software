import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Ban,
  Building2,
  CalendarDays,
  CircleAlert,
  CloudDownload,
  Download,
  FileCheck2,
  FileText,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useWarningToast } from '../components/ui/Toast'
import { useCompanyStore } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { TaxpayerType, AccountingSystem, accountingSystemLabels } from '../lib/constants'
import { cn } from '../lib/utils'
import { agencyNavItems } from './agency/agencyNav'

interface SummaryMetric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}

interface AccountRow {
  id: string
  code: string
  name: string
  enterpriseType: string
  taxType: string
  collectStatus: string
  socialStatus: string
  credit: string
  importedAt: string
  accountant: string
  servicePeriod: string
  supervisor: string
  period: string
  taxOffice: string
  status: string
  invoices: string
  vouchers: string
  tax: string
  risk: string
  real: boolean
}

const demoCompanies: AccountRow[] = [
  {
    id: '01460',
    code: '01460',
    name: '科旋电气（上海）有限公司',
    enterpriseType: '私营有限责任公司',
    taxType: '一般纳税人',
    collectStatus: '采集成功 2026-06-26 18:09:49',
    socialStatus: '采集成功 2026-06-26 18:06:34',
    credit: 'M',
    importedAt: '2026-06-26 17:40:08',
    accountant: '李喻',
    servicePeriod: '2026-01 至 2026-12',
    supervisor: '李喻',
    period: '2026-05',
    taxOffice: '普陀区税务局 第十六税务所',
    status: '已结账',
    invoices: '126/138',
    vouchers: '82',
    tax: '待确认',
    risk: '2',
    real: false,
  },
  {
    id: '02018',
    code: '02018',
    name: '上海云启科技有限公司',
    enterpriseType: '私营有限责任公司',
    taxType: '小规模纳税人',
    collectStatus: '采集警告 2026-06-26 18:00:10',
    socialStatus: '采集成功 2026-06-26 17:58:25',
    credit: 'M',
    importedAt: '2026-06-26 17:26:07',
    accountant: '李喻',
    servicePeriod: '2026-05 至 2027-04',
    supervisor: '李喻',
    period: '2026-05',
    taxOffice: '宝山区税务局 第十六税务所',
    status: '做账中',
    invoices: '84/91',
    vouchers: '47',
    tax: '未取数',
    risk: '5',
    real: false,
  },
  {
    id: '03009',
    code: '03009',
    name: '杭州辰光贸易有限公司',
    enterpriseType: '内资企业',
    taxType: '一般纳税人',
    collectStatus: '采集失败 2026-06-26 17:54:16',
    socialStatus: '采集失败 2026-06-26 18:02:48',
    credit: 'M',
    importedAt: '2026-06-26 17:10:59',
    accountant: '王会计',
    servicePeriod: '2025-07 至 2026-06',
    supervisor: '王会计',
    period: '2026-05',
    taxOffice: '嘉定区税务局 第十三税务所',
    status: '待收票',
    invoices: '38/70',
    vouchers: '19',
    tax: '未开始',
    risk: '8',
    real: false,
  },
]

const taxCalendar = [
  { date: '06-24', name: '增值税及附加', count: 12 },
  { date: '06-25', name: '个税扣缴', count: 18 },
  { date: '06-28', name: '社保费', count: 9 },
]

const currentYear = new Date().getFullYear()

const emptyCompanyForm = {
  name: '',
  code: '',
  taxId: '',
  province: '江苏省',
  city: '南京市',
  district: '市辖区',
  taxpayerType: 'general' as TaxpayerType,
  accountingSystem: 'small_enterprise' as AccountingSystem,
  enableYear: currentYear,
  enableMonth: new Date().getMonth() + 1,
  serviceStart: '',
  serviceEnd: '',
  industry: '',
  enterpriseType: '私营有限责任公司',
  taxLoginPerson: '',
  taxLoginIdentity: '',
  taxLoginMethod: '',
  taxLoginAccount: '',
  taxLoginPassword: '',
  individualVerifyMethod: '申报密码登录',
  individualTaxPassword: '',
  businessContactId: '',
  businessContactPhone: '',
  businessContactEmail: '',
}

type CompanyForm = typeof emptyCompanyForm

export function Welcome() {
  const navigate = useNavigate()
  const warningToast = useWarningToast()
  const { companies, selectCompany, fetchCompanies, createCompany, deactivateCompany, deleteCompany } = useCompanyStore()
  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'normal' | 'disabled'>('normal')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompany, setNewCompany] = useState<CompanyForm>(emptyCompanyForm)

  useEffect(() => {
    fetchCompanies().catch((err) => console.error('[Welcome] fetchCompanies failed:', err))
  }, [fetchCompanies])

  const realRows = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
        enterpriseType: '私营有限责任公司',
        taxType: company.tax_type === 'general' ? '一般纳税人' : '小规模纳税人',
        collectStatus: '待采集',
        socialStatus: '待采集',
        credit: 'M',
        importedAt: company.created_at?.slice(0, 16).replace('T', ' ') || '-',
        accountant: '未分配',
        servicePeriod: '-',
        supervisor: '未分配',
        period: `${company.enable_year || currentYear}-${String(company.enable_month || 1).padStart(2, '0')}`,
        taxOffice: company.city ? `${company.city}主管税务机关` : '-',
        status: company.is_active ? '做账中' : '停用',
        invoices: '0/0',
        vouchers: '0',
        tax: '未取数',
        risk: '0',
        real: true,
      })),
    [companies],
  )

  const allRows = realRows.length > 0 ? realRows : demoCompanies
  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allRows.filter((row) => {
      const statusMatch = statusFilter === 'disabled' ? row.status === '停用' : row.status !== '停用'
      if (!statusMatch) return false
      if (!q) return true
      return [row.name, row.code, row.taxType, row.taxOffice, row.accountant].some((value) => value.toLowerCase().includes(q))
    })
  }, [allRows, searchQuery, statusFilter])

  const summaryMetrics: SummaryMetric[] = [
    { label: '客户数', value: allRows.length, icon: Building2 },
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

  const handleCreateCompany = async (shouldContinue = false) => {
    if (!newCompany.name.trim() || !newCompany.taxId.trim()) {
      warningToast('请填写企业名称和纳税人识别号')
      return
    }

    const company = await createCompany({
      code: newCompany.code.trim() || `KH${Date.now().toString().slice(-6)}`,
      name: newCompany.name,
      tax_id: newCompany.taxId,
      tax_type: newCompany.taxpayerType,
      industry: newCompany.industry,
      accounting_system: newCompany.accountingSystem,
      province: newCompany.province,
      city: newCompany.city,
      enable_year: newCompany.enableYear,
      enable_month: newCompany.enableMonth,
    })

    if (shouldContinue) {
      setNewCompany(emptyCompanyForm)
      warningToast('已保存，继续新增下一户客户')
      return
    }

    setShowAddModal(false)
    await handleSelectCompany(company.id, true)
  }

  const handleBatchDeactivate = async () => {
    const ids = Array.from(selectedRows)
    if (ids.length === 0) {
      warningToast('请先勾选需要停用的账套')
      return
    }
    const realIds = ids.filter((id) => realRows.some((row) => row.id === id))
    if (realIds.length === 0) {
      warningToast('演示数据不可停用，真实账套会调用停用接口')
      return
    }
    await Promise.all(realIds.map((id) => deactivateCompany(id)))
    setSelectedRows(new Set())
  }

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedRows)
    if (ids.length === 0) {
      warningToast('请先勾选需要删除的账套')
      return
    }
    const realIds = ids.filter((id) => realRows.some((row) => row.id === id))
    if (realIds.length === 0) {
      warningToast('演示数据不可删除，真实账套会进入回收站')
      return
    }
    await Promise.all(realIds.map((id) => deleteCompany(id)))
    setSelectedRows(new Set())
  }

  const handleCollect = () => {
    warningToast('采集入口已预留：正式接入时将按维护的办税登录方式采集税务登记、税种认定、主管税务机关和办税人员信息')
  }

  const allChecked = rows.length > 0 && rows.every((row) => selectedRows.has(row.id))

  const toggleAllRows = () => {
    if (allChecked) {
      setSelectedRows(new Set())
      return
    }
    setSelectedRows(new Set(rows.map((row) => row.id)))
  }

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
          <Button size="sm" variant="outline">
            <Archive className="h-4 w-4" />
            下载中心
          </Button>
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
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold">账套管理</h1>
                  <p className="text-xs text-slate-500">跨客户账套筛选、采集、导入导出、停用删除和进入账套。</p>
                </div>
                <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 text-sm">
                  <button type="button" onClick={() => setStatusFilter('normal')} className={cn('h-8 rounded px-3', statusFilter === 'normal' && 'bg-[#eef6ff] text-[#1f65a7]')}>正常</button>
                  <button type="button" onClick={() => setStatusFilter('disabled')} className={cn('h-8 rounded px-3', statusFilter === 'disabled' && 'bg-[#eef6ff] text-[#1f65a7]')}>停用</button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs md:grid-cols-3 xl:grid-cols-6">
                <FilterField label="地区" value="全部" />
                <FilterField label="企业名称" value={searchQuery} onChange={setSearchQuery} placeholder="搜索企业名称" />
                <FilterField label="企业编码" placeholder="全部" />
                <FilterField label="纳税人识别号" placeholder="全部" />
                <FilterField label="企业类型" value="全部" />
                <FilterField label="纳税人资格" value="全部" />
                <FilterField label="采集状态" value="全部" />
                <FilterField label="社保采集状态" value="全部" />
                <FilterField label="角色" value="全部" />
                <FilterField label="人员" value="全部" />
                <FilterField label="账期" placeholder="2026-05" />
                <FilterField label="登录人员" value="全部" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" />新增</Button>
                <Button size="sm" variant="outline"><UploadCloud className="h-4 w-4" />导入</Button>
                <Button size="sm" variant="outline"><Download className="h-4 w-4" />导出</Button>
                <Button size="sm" variant="outline" onClick={handleCollect}><CloudDownload className="h-4 w-4" />采集</Button>
                <Button size="sm" variant="outline" onClick={handleBatchDelete}><Trash2 className="h-4 w-4" />批量删除</Button>
                <Button size="sm" variant="outline" onClick={handleBatchDeactivate}><Ban className="h-4 w-4" />批量停用</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1680px] w-full text-left text-sm">
                <thead className="bg-[#f3f7fb] text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" checked={allChecked} onChange={toggleAllRows} />
                    </th>
                    <th className="px-3 py-3">企业标签</th>
                    <th className="px-3 py-3">编码</th>
                    <th className="px-3 py-3">企业名称</th>
                    <th className="px-3 py-3">企业类型</th>
                    <th className="px-3 py-3">纳税人资格</th>
                    <th className="px-3 py-3">采集状态</th>
                    <th className="px-3 py-3">社保采集状态</th>
                    <th className="px-3 py-3">信用等级</th>
                    <th className="px-3 py-3">客户导入时间</th>
                    <th className="px-3 py-3">主办会计</th>
                    <th className="px-3 py-3">服务期限</th>
                    <th className="px-3 py-3">部门主管</th>
                    <th className="px-3 py-3">账期</th>
                    <th className="px-3 py-3">主管税务机关</th>
                    <th className="px-3 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((company) => (
                    <tr key={company.id} className="hover:bg-[#f8fbff]">
                      <td className="px-3 py-3"><input type="checkbox" checked={selectedRows.has(company.id)} onChange={() => toggleRow(company.id)} /></td>
                      <td className="px-3 py-3 text-[#1f65a7]">✎</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{company.code}</td>
                      <td className="px-3 py-3 font-medium">{company.name}</td>
                      <td className="px-3 py-3">{company.enterpriseType}</td>
                      <td className="px-3 py-3">{company.taxType}</td>
                      <td className="px-3 py-3"><CollectStatus value={company.collectStatus} /></td>
                      <td className="px-3 py-3"><CollectStatus value={company.socialStatus} /></td>
                      <td className="px-3 py-3">{company.credit}</td>
                      <td className="px-3 py-3">{company.importedAt}</td>
                      <td className="px-3 py-3">{company.accountant}</td>
                      <td className="px-3 py-3">{company.servicePeriod}</td>
                      <td className="px-3 py-3">{company.supervisor}</td>
                      <td className="px-3 py-3">{company.period}</td>
                      <td className="px-3 py-3">{company.taxOffice}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[#1f65a7]">
                          <button type="button">编辑</button>
                          <button type="button">删除</button>
                          <button type="button">停用</button>
                          <button type="button">备忘录</button>
                          <button type="button" onClick={() => handleSelectCompany(company.id, company.real)}>进入账套</button>
                          <button type="button" onClick={handleCollect}>登录税务局</button>
                        </div>
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
        </aside>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[92vh] w-full max-w-[1180px] flex-col rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-2xl font-semibold">新增企业</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
              <FormSection title="企业基本信息">
                <FormRow label="企业名称" required className="xl:col-span-2">
                  <TextInput value={newCompany.name} onChange={(value) => setNewCompany({ ...newCompany, name: value })} />
                </FormRow>
                <FormRow label="地区" required>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={newCompany.province} onChange={(value) => setNewCompany({ ...newCompany, province: value })} options={['江苏省', '上海市', '浙江省', '广东省']} />
                    <Select value={newCompany.city} onChange={(value) => setNewCompany({ ...newCompany, city: value })} options={['南京市', '上海市', '杭州市', '深圳市']} />
                    <Select value={newCompany.district} onChange={(value) => setNewCompany({ ...newCompany, district: value })} options={['市辖区', '浦东新区', '宝山区', '西湖区']} />
                  </div>
                </FormRow>
                <FormRow label="纳税人资格" required>
                  <div className="flex h-9 items-center gap-4">
                    <Radio checked={newCompany.taxpayerType === 'general'} label="一般纳税人" onChange={() => setNewCompany({ ...newCompany, taxpayerType: 'general' })} />
                    <Radio checked={newCompany.taxpayerType === 'small'} label="小规模纳税人" onChange={() => setNewCompany({ ...newCompany, taxpayerType: 'small' })} />
                  </div>
                </FormRow>
                <FormRow label="纳税人识别号" required>
                  <TextInput value={newCompany.taxId} onChange={(value) => setNewCompany({ ...newCompany, taxId: value })} />
                </FormRow>
                <FormRow label="企业编码">
                  <TextInput value={newCompany.code} onChange={(value) => setNewCompany({ ...newCompany, code: value })} placeholder="不填则自动生成" />
                </FormRow>
              </FormSection>

              <FormSection title="账套信息" warning="温馨提示：请选择正确的会计制度和启用期间，会计制度启用后无法修改，有业务数据后启用期间无法修改！">
                <FormRow label="会计制度" required>
                  <Select value={newCompany.accountingSystem} onChange={(value) => setNewCompany({ ...newCompany, accountingSystem: value as AccountingSystem })} options={Object.keys(accountingSystemLabels)} labels={accountingSystemLabels} />
                </FormRow>
                <FormRow label="启用期间" required>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={String(newCompany.enableYear)} onChange={(value) => setNewCompany({ ...newCompany, enableYear: Number(value) })} options={[String(currentYear - 1), String(currentYear), String(currentYear + 1)]} />
                    <Select value={String(newCompany.enableMonth)} onChange={(value) => setNewCompany({ ...newCompany, enableMonth: Number(value) })} options={Array.from({ length: 12 }, (_, index) => String(index + 1))} labels={Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), `${index + 1}月`]))} />
                  </div>
                </FormRow>
                <FormRow label="服务期限起">
                  <TextInput type="date" value={newCompany.serviceStart} onChange={(value) => setNewCompany({ ...newCompany, serviceStart: value })} />
                </FormRow>
                <FormRow label="服务期限止">
                  <TextInput type="date" value={newCompany.serviceEnd} onChange={(value) => setNewCompany({ ...newCompany, serviceEnd: value })} />
                </FormRow>
                <FormRow label="会计行业">
                  <Select value={newCompany.industry} onChange={(value) => setNewCompany({ ...newCompany, industry: value })} options={['', '软件和信息技术服务业', '批发和零售业', '制造业', '商务服务业', '餐饮业']} labels={{ '': '--请选择--' }} />
                </FormRow>
                <FormRow label="企业类型">
                  <Select value={newCompany.enterpriseType} onChange={(value) => setNewCompany({ ...newCompany, enterpriseType: value })} options={['私营有限责任公司', '内资企业', '个体工商户', '外商投资企业']} />
                </FormRow>
              </FormSection>

              <FormSection title="税务登录信息">
                <FormRow label="人员" required>
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <Select value={newCompany.taxLoginPerson} onChange={(value) => setNewCompany({ ...newCompany, taxLoginPerson: value })} options={['', '法人', '财务负责人', '办税员']} labels={{ '': '---请选择人员---' }} />
                    <button type="button" className="h-9 text-sm font-medium text-[#1f65a7]">新增人员</button>
                  </div>
                </FormRow>
                <FormRow label="登录身份">
                  <Select value={newCompany.taxLoginIdentity} onChange={(value) => setNewCompany({ ...newCompany, taxLoginIdentity: value })} options={['', '法人', '财务负责人', '办税员', '代理记账人员']} labels={{ '': '--请选择--' }} />
                </FormRow>
                <FormRow label="登录方式" required>
                  <Select value={newCompany.taxLoginMethod} onChange={(value) => setNewCompany({ ...newCompany, taxLoginMethod: value })} options={['', '电子税务局账号密码', '办税人手机号验证码', '代理记账登录']} labels={{ '': '---请选择登录方式---' }} />
                </FormRow>
                <FormRow label="登录账号">
                  <TextInput value={newCompany.taxLoginAccount} onChange={(value) => setNewCompany({ ...newCompany, taxLoginAccount: value })} />
                </FormRow>
                <FormRow label="登录密码">
                  <TextInput type="password" value={newCompany.taxLoginPassword} onChange={(value) => setNewCompany({ ...newCompany, taxLoginPassword: value })} />
                </FormRow>
              </FormSection>

              <FormSection title="个税验证方式">
                <FormRow label="验证方式" required>
                  <Select value={newCompany.individualVerifyMethod} onChange={(value) => setNewCompany({ ...newCompany, individualVerifyMethod: value })} options={['申报密码登录', '自然人电子税务局账号', '办税人短信验证']} />
                </FormRow>
                <FormRow label="个税申报密码" required>
                  <TextInput type="password" value={newCompany.individualTaxPassword} onChange={(value) => setNewCompany({ ...newCompany, individualTaxPassword: value })} />
                </FormRow>
              </FormSection>

              <FormSection title="工商系统登录信息">
                <FormRow label="工商联络员身份证号码">
                  <TextInput value={newCompany.businessContactId} onChange={(value) => setNewCompany({ ...newCompany, businessContactId: value })} />
                </FormRow>
                <FormRow label="工商联络员手机号码">
                  <TextInput value={newCompany.businessContactPhone} onChange={(value) => setNewCompany({ ...newCompany, businessContactPhone: value })} />
                </FormRow>
                <FormRow label="工商联络员邮箱">
                  <TextInput value={newCompany.businessContactEmail} onChange={(value) => setNewCompany({ ...newCompany, businessContactEmail: value })} />
                </FormRow>
              </FormSection>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
              <Button onClick={() => handleCreateCompany(false)}>保存</Button>
              <Button onClick={() => handleCreateCompany(true)}>保存并新增</Button>
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterField({ label, value, placeholder, onChange }: { label: string; value?: string; placeholder?: string; onChange?: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder || '全部'} className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1f65a7]" />
    </label>
  )
}

function CollectStatus({ value }: { value: string }) {
  const cls = value.includes('失败') ? 'text-red-600' : value.includes('警告') ? 'text-amber-600' : value.includes('成功') ? 'text-blue-600' : 'text-slate-500'
  return <span className={cn('font-medium', cls)}>{value}</span>
}

function FormSection({ title, warning, children }: { title: string; warning?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <h3 className="w-36 text-base font-semibold text-slate-800">{title}</h3>
        {warning && <p className="text-sm font-semibold text-red-600">{warning}</p>}
      </div>
      <div className="grid gap-x-8 gap-y-3 xl:grid-cols-2">{children}</div>
    </section>
  )
}

function FormRow({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('grid grid-cols-[160px_minmax(0,1fr)] items-center gap-3', className)}>
      <span className="text-right text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[11px] text-white">必须</span>}
      </span>
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1f65a7]" />
}

function Select({ value, options, labels, onChange }: { value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1f65a7]">
      {options.map((option) => (
        <option key={option} value={option}>{labels?.[option] || option}</option>
      ))}
    </select>
  )
}

function Radio({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="inline-flex items-center gap-1 text-sm">
      <input type="radio" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}
