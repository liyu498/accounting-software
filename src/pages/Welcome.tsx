import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Ban,
  Building2,
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
import { recordAuditLog, recordExportJob } from '../lib/exportJobs'
import { exportRowsToXlsx } from '../lib/xlsxExport'
import { automationApi } from '../lib/api'

interface SummaryMetric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}

interface AccountRow {
  id: string
  code: string
  name: string
  taxId: string
  enterpriseType: string
  taxType: string
  collectStatus: string
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
    taxId: '91310115MA1K3****X',
    enterpriseType: '私营有限责任公司',
    taxType: '一般纳税人',
    collectStatus: '采集成功 2026-06-26 18:09:49',
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
    taxId: '91310113MA1G****2Q',
    enterpriseType: '私营有限责任公司',
    taxType: '小规模纳税人',
    collectStatus: '采集警告 2026-06-26 18:00:10',
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
    taxId: '91330106MA2H****8P',
    enterpriseType: '内资企业',
    taxType: '一般纳税人',
    collectStatus: '采集失败 2026-06-26 17:54:16',
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

function maskAuthorizationAccount(value: string) {
  const normalized = value.trim()
  if (!normalized) return '未维护账号'
  if (normalized.length <= 2) return '*'.repeat(normalized.length)
  return `${normalized.slice(0, 2)}${'*'.repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-2)}`
}

function buildCompanyAuthorizationInputs(companyId: string, company: CompanyForm) {
  const region = [company.province, company.city, company.district].filter(Boolean).join(' ')
  const riskMessage = '待完成合法授权验证；不保存密码、不执行真实提交'
  const inputs: Array<Parameters<typeof automationApi.upsertAdapterAuthorization>[0]> = []

  if (company.taxLoginAccount.trim()) {
    inputs.push({
      companyId,
      adapterType: 'tax',
      adapterCode: 'agency-account-set',
      region,
      authStatus: 'pending',
      accountMask: maskAuthorizationAccount(company.taxLoginAccount),
      loginIdentity: [company.taxLoginPerson, company.taxLoginIdentity, company.taxLoginMethod].filter(Boolean).join(' / ') || '待维护',
      capabilityScope: '税务资料采集/税种认定/申报包生成/回执归档',
      riskMessage: '待完成合法授权验证；不保存密码、不执行真实提交',
    })
  }

  if (company.individualTaxPassword || company.individualVerifyMethod !== '申报密码登录') {
    inputs.push({
      companyId,
      adapterType: 'individual_tax',
      adapterCode: 'agency-account-set',
      region,
      authStatus: 'pending',
      accountMask: '未维护账号',
      loginIdentity: company.individualVerifyMethod,
      capabilityScope: '个税验证/申报包生成/回执归档',
      riskMessage,
    })
  }

  if ([company.businessContactId, company.businessContactPhone, company.businessContactEmail].some(Boolean)) {
    inputs.push({
      companyId,
      adapterType: 'industrial_commercial',
      adapterCode: 'agency-account-set',
      region,
      authStatus: 'pending',
      accountMask: maskAuthorizationAccount(company.businessContactPhone),
      loginIdentity: '工商联络员',
      capabilityScope: '企业基础资料采集/工商联络信息校验',
      riskMessage,
    })
  }

  return inputs
}

async function persistCompanyAuthorizationMetadata(companyId: string, company: CompanyForm) {
  const inputs = buildCompanyAuthorizationInputs(companyId, company)
  if (inputs.length === 0) return true
  const results = await Promise.all(inputs.map((input) => automationApi.upsertAdapterAuthorization(input)))
  return results.every((result) => result.success)
}

function parseTaxAuthorizationIdentity(value: string | null) {
  const [person = '', identity = '', method = ''] = value?.split(' / ') ?? []
  const persons = ['法人', '财务负责人', '办税员']
  const identities = ['法人', '财务负责人', '办税员', '代理记账人员']
  const methods = ['电子税务局账号密码', '办税人手机号验证码', '代理记账登录']
  return {
    taxLoginPerson: persons.includes(person) ? person : '',
    taxLoginIdentity: identities.includes(identity) ? identity : '',
    taxLoginMethod: methods.includes(method) ? method : '',
  }
}

export function Welcome() {
  const navigate = useNavigate()
  const location = useLocation()
  const warningToast = useWarningToast()
  const { companies, selectCompany, fetchCompanies, createCompany, updateCompany, deactivateCompany, deleteCompany } = useCompanyStore()
  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'normal' | 'disabled'>('normal')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompany, setNewCompany] = useState<CompanyForm>(emptyCompanyForm)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies().catch((err) => console.error('[Welcome] fetchCompanies failed:', err))
  }, [fetchCompanies])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('createCompany') === '1') {
      setEditingCompanyId(null)
      setNewCompany(emptyCompanyForm)
      setShowAddModal(true)
    }
  }, [location.search])

  const realRows = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
        taxId: company.tax_id || '',
        enterpriseType: company.enterprise_type || '未设置',
        taxType: company.tax_type === 'general' ? '一般纳税人' : '小规模纳税人',
        collectStatus: '待采集',
        credit: 'M',
        importedAt: company.created_at?.slice(0, 16).replace('T', ' ') || '-',
        accountant: '未分配',
        servicePeriod: company.service_start || company.service_end
          ? `${company.service_start || '-'} 至 ${company.service_end || '-'}`
          : '-',
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
      return [row.name, row.code, row.taxId, row.taxType, row.taxOffice, row.accountant].some((value) => value.toLowerCase().includes(q))
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

  const recordWelcomeAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    recordAuditLog({
      module: '机构-账套管理',
      action,
      object,
      level,
      result,
      status: result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过',
      voucher: `${statusFilter}/${searchQuery.trim() || '全部'}`,
      attachment: '操作快照',
    })
  }

  const handleSelectCompany = async (companyId: string, isReal: boolean) => {
    if (!isReal) {
      recordWelcomeAudit('进入账套', `演示账套-${companyId}`)
      navigate('/dashboard')
      return
    }
    recordWelcomeAudit('进入账套', `真实账套-${companyId}`)
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

    if (editingCompanyId?.startsWith('demo:')) {
      recordWelcomeAudit('编辑企业预览', newCompany.name, '中', '待审批')
      warningToast('演示账套只展示编辑样式，不会写入数据库')
      return
    }

    if (editingCompanyId) {
      const company = await updateCompany(editingCompanyId, {
        code: newCompany.code.trim() || `KH${Date.now().toString().slice(-6)}`,
        name: newCompany.name,
        tax_id: newCompany.taxId,
        tax_type: newCompany.taxpayerType,
        industry: newCompany.industry,
        accounting_system: newCompany.accountingSystem,
        province: newCompany.province,
        city: newCompany.city,
        district: newCompany.district,
        enterprise_type: newCompany.enterpriseType,
        service_start: newCompany.serviceStart,
        service_end: newCompany.serviceEnd,
        enable_year: newCompany.enableYear,
        enable_month: newCompany.enableMonth,
      })
      const authorizationSaved = await persistCompanyAuthorizationMetadata(company.id, newCompany)
      recordWelcomeAudit('保存企业档案', newCompany.name, '中')
      warningToast(authorizationSaved ? '企业档案已保存' : '企业档案已保存，授权元数据待后续补充')
      setShowAddModal(false)
      setEditingCompanyId(null)
      setNewCompany(emptyCompanyForm)
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
      district: newCompany.district,
      enterprise_type: newCompany.enterpriseType,
      service_start: newCompany.serviceStart,
      service_end: newCompany.serviceEnd,
      enable_year: newCompany.enableYear,
      enable_month: newCompany.enableMonth,
    })
    const authorizationSaved = await persistCompanyAuthorizationMetadata(company.id, newCompany)
    recordWelcomeAudit('新增企业', newCompany.name, '中')

    if (shouldContinue) {
      setNewCompany(emptyCompanyForm)
      warningToast(authorizationSaved ? '已保存，继续新增下一户客户' : '企业已保存，授权元数据待后续补充')
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
      recordWelcomeAudit('批量停用', `${ids.length} 户演示账套`, '高', '待审批')
      warningToast('演示数据不可停用，真实账套会调用停用接口')
      return
    }
    await Promise.all(realIds.map((id) => deactivateCompany(id)))
    recordWelcomeAudit('批量停用', `${realIds.length} 户真实账套`, '高')
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
      recordWelcomeAudit('批量删除申请', `${ids.length} 户演示账套`, '高', '待审批')
      warningToast('演示数据不可删除，真实账套会进入回收站')
      return
    }
    await Promise.all(realIds.map((id) => deleteCompany(id)))
    recordWelcomeAudit('批量删除', `${realIds.length} 户真实账套`, '高')
    setSelectedRows(new Set())
  }

  const handleCollect = (company?: AccountRow) => {
    const target = company ? `${company.code}-${company.name}` : `${selectedRows.size || '当前筛选'}户客户`
    recordWelcomeAudit('采集税务资料', target, '高', '待审批')
    setOperationNotice(`${target} 的采集任务已进入待审批队列；正式接入时只通过合法 adapter 采集税务登记、税种认定、主管税务机关和办税人员信息。`)
    warningToast('采集入口已预留：正式接入时将按维护的办税登录方式采集税务登记、税种认定、主管税务机关和办税人员信息')
  }

  const handleImportCompanies = () => {
    recordWelcomeAudit('导入企业清单', '账套管理-导入批次', '中', '待审批')
    setOperationNotice('导入企业清单已进入待确认留痕；后续会接入 Excel 模板校验、字段映射、错误清单和回滚记录。')
    warningToast('导入任务已记录，正式文件选择和字段映射将在导入中心补齐')
  }

  const handleExportCompanies = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `账套管理-客户企业档案-${statusFilter}-${exportedAt.replace(/[\\/:\s]/g, '')}.xlsx`
    const sheetRows = [
      ['账套管理-客户企业档案'],
      ['机构', 'AI 代理记账', '状态筛选', statusFilter === 'normal' ? '正常' : '停用', '筛选关键字', searchQuery.trim() || '全部'],
      ['导出时间', exportedAt, '记录数', `${rows.length}`, '导出人', 'admin'],
      [],
      ['企业标签', '编码', '企业名称', '纳税人识别号', '企业类型', '纳税人资格', '采集状态', '信用等级', '客户导入时间', '主办会计', '服务期限', '部门主管', '账期', '主管税务机关', '状态'],
      ...rows.map((company) => [
        '编辑',
        company.code,
        company.name,
        company.taxId,
        company.enterpriseType,
        company.taxType,
        company.collectStatus,
        company.credit,
        company.importedAt,
        company.accountant,
        company.servicePeriod,
        company.supervisor,
        company.period,
        company.taxOffice,
        company.status,
      ]),
      [],
      ['制表说明', '账套管理按当前筛选导出，采集、登录税务局、删除和停用等高风险动作仅记录审计，不自动提交外部系统。'],
    ]
    await exportRowsToXlsx({
      sheetRows,
      columnWidths: [
        { wch: 10 },
        { wch: 12 },
        { wch: 28 },
        { wch: 24 },
        { wch: 18 },
        { wch: 14 },
        { wch: 24 },
        { wch: 10 },
        { wch: 20 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
        { wch: 10 },
        { wch: 28 },
        { wch: 12 },
      ],
      sheetName: '账套管理',
      fileName,
    })
    recordExportJob({
      fileName,
      moduleName: '机构-账套管理',
      format: 'Excel',
      scope: `${statusFilter}/${searchQuery.trim() || '全部'}`,
      templateKind: 'agency',
      rowCount: rows.length,
    })
    setOperationNotice(`${fileName} 已生成并写入下载中心；导出范围为当前账套管理筛选结果。`)
  }

  const handleEditCompany = async (company: AccountRow) => {
    const persistedCompany = company.real ? companies.find((item) => item.id === company.id) : undefined
    let taxAuthorization = { taxLoginPerson: '', taxLoginIdentity: '', taxLoginMethod: '' }
    let individualVerifyMethod = emptyCompanyForm.individualVerifyMethod
    let hasAuthorizationMetadata = false

    if (company.real) {
      try {
        const response = await automationApi.getAdapterAuthorizations({ companyId: company.id })
        const authorizations = response.success ? response.data || [] : []
        const taxAuthorizationRow = authorizations.find((item) => item.adapterType === 'tax' && item.adapterCode === 'agency-account-set')
        const individualAuthorizationRow = authorizations.find((item) => item.adapterType === 'individual_tax' && item.adapterCode === 'agency-account-set')
        if (taxAuthorizationRow) taxAuthorization = parseTaxAuthorizationIdentity(taxAuthorizationRow.loginIdentity)
        if (individualAuthorizationRow?.loginIdentity) individualVerifyMethod = individualAuthorizationRow.loginIdentity
        hasAuthorizationMetadata = authorizations.length > 0
      } catch {
        hasAuthorizationMetadata = false
      }
    }

    setEditingCompanyId(company.real ? company.id : `demo:${company.id}`)
    setNewCompany({
      ...emptyCompanyForm,
      name: company.name,
      code: company.code,
      taxId: company.taxId,
      taxpayerType: company.taxType.includes('小规模') ? 'small' : 'general',
      enterpriseType: company.enterpriseType,
      district: persistedCompany?.district || '市辖区',
      enableYear: Number(company.period.slice(0, 4)) || currentYear,
      enableMonth: Number(company.period.slice(5, 7)) || 1,
      serviceStart: persistedCompany?.service_start || '',
      serviceEnd: persistedCompany?.service_end || '',
      taxLoginPerson: taxAuthorization.taxLoginPerson,
      taxLoginIdentity: taxAuthorization.taxLoginIdentity,
      taxLoginMethod: taxAuthorization.taxLoginMethod,
      individualVerifyMethod,
    })
    setShowAddModal(true)
    if (hasAuthorizationMetadata) {
      setOperationNotice('已载入授权元数据；账号、身份证号、邮箱和密码不会回填。若需更新授权账号，请重新输入并经合法 adapter 完成验证。')
    }
    recordWelcomeAudit('编辑企业', `${company.code}-${company.name}`, '中')
  }

  const handleDeleteCompany = (company: AccountRow) => {
    recordWelcomeAudit('删除企业申请', `${company.code}-${company.name}`, '高', '待审批')
    setOperationNotice(`${company.name} 的删除动作已进入高风险待审批；当前不会直接删除账套数据。`)
    warningToast('删除属于高风险操作，已记录到审计日志并等待审批')
  }

  const handleDeactivateCompany = async (company: AccountRow) => {
    if (!company.real) {
      recordWelcomeAudit('停用企业申请', `${company.code}-${company.name}`, '高', '待审批')
      warningToast('演示账套不可停用，已记录停用申请')
      return
    }
    await deactivateCompany(company.id)
    recordWelcomeAudit('停用企业', `${company.code}-${company.name}`, '高')
    warningToast('账套已停用')
  }

  const handleMemoCompany = (company: AccountRow) => {
    recordWelcomeAudit('新增备忘录', `${company.code}-${company.name}`)
    setOperationNotice(`${company.name} 已记录备忘录操作；后续将接入可编辑备注、附件和提醒日期。`)
  }

  const handleTaxLogin = (company: AccountRow) => {
    recordWelcomeAudit('登录税务局申请', `${company.code}-${company.name}`, '高', '待审批')
    setOperationNotice(`${company.name} 的税务局登录已进入授权检查；当前不会打开或提交任何真实外部系统。`)
    warningToast('登录税务局需要先校验授权和办税人信息，当前仅记录申请')
  }

  const allChecked = rows.length > 0 && rows.every((row) => selectedRows.has(row.id))
  const homeAgencyItems = agencyNavItems.filter((item) => item.id !== 'agency-accounts')

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
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-6 py-4">
        <section className="min-w-0 space-y-4">
          <div className="rounded border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-lg font-semibold">机构级批量工作</h1>
                <p className="text-xs text-slate-500">这些功能面向全部客户账套，处理合同、批量申报、统计和自动化。</p>
              </div>
              <span className="inline-flex w-fit rounded bg-[#eef6ff] px-2 py-1 text-xs font-medium text-[#1f65a7]">不进入单公司账套</span>
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {homeAgencyItems.map((item) => (
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
                <FilterField label="角色" value="全部" />
                <FilterField label="人员" value="全部" />
                <FilterField label="账期" placeholder="2026-05" />
                <FilterField label="登录人员" value="全部" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => { setEditingCompanyId(null); setNewCompany(emptyCompanyForm); setShowAddModal(true) }}><Plus className="h-4 w-4" />新增</Button>
                <Button size="sm" variant="outline" onClick={handleImportCompanies}><UploadCloud className="h-4 w-4" />导入</Button>
                <Button size="sm" variant="outline" onClick={handleExportCompanies}><Download className="h-4 w-4" />导出</Button>
                <Button size="sm" variant="outline" onClick={() => handleCollect()}><CloudDownload className="h-4 w-4" />采集</Button>
                <Button size="sm" variant="outline" onClick={handleBatchDelete}><Trash2 className="h-4 w-4" />批量删除</Button>
                <Button size="sm" variant="outline" onClick={handleBatchDeactivate}><Ban className="h-4 w-4" />批量停用</Button>
              </div>
            </div>

            {operationNotice && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
                {operationNotice}
              </div>
            )}

            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[3%]" />
                  <col className="w-[4%]" />
                  <col className="w-[5%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[4%]" />
                  <col className="w-[9%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                  <col className="w-[5%]" />
                  <col className="w-[9%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="bg-[#f3f7fb] text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-2 py-2">
                      <input type="checkbox" checked={allChecked} onChange={toggleAllRows} />
                    </th>
                    <th className="px-2 py-2">企业标签</th>
                    <th className="px-2 py-2">编码</th>
                    <th className="px-2 py-2">企业名称</th>
                    <th className="px-2 py-2">企业类型</th>
                    <th className="px-2 py-2">纳税人资格</th>
                    <th className="px-2 py-2">采集状态</th>
                    <th className="px-2 py-2">信用等级</th>
                    <th className="px-2 py-2">客户导入时间</th>
                    <th className="px-2 py-2">主办会计</th>
                    <th className="px-2 py-2">服务期限</th>
                    <th className="px-2 py-2">部门主管</th>
                    <th className="px-2 py-2">账期</th>
                    <th className="px-2 py-2">主管税务机关</th>
                    <th className="px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((company) => (
                    <tr key={company.id} className="hover:bg-[#f8fbff]">
                      <td className="px-2 py-2 align-top"><input type="checkbox" checked={selectedRows.has(company.id)} onChange={() => toggleRow(company.id)} /></td>
                      <td className="break-words px-2 py-2 align-top text-[#1f65a7]">✎</td>
                      <td className="break-words px-2 py-2 align-top font-mono text-xs text-slate-500">{company.code}</td>
                      <td className="break-words px-2 py-2 align-top font-medium">{company.name}</td>
                      <td className="break-words px-2 py-2 align-top">{company.enterpriseType}</td>
                      <td className="break-words px-2 py-2 align-top">{company.taxType}</td>
                      <td className="break-words px-2 py-2 align-top"><CollectStatus value={company.collectStatus} /></td>
                      <td className="break-words px-2 py-2 align-top">{company.credit}</td>
                      <td className="break-words px-2 py-2 align-top">{company.importedAt}</td>
                      <td className="break-words px-2 py-2 align-top">{company.accountant}</td>
                      <td className="break-words px-2 py-2 align-top">{company.servicePeriod}</td>
                      <td className="break-words px-2 py-2 align-top">{company.supervisor}</td>
                      <td className="break-words px-2 py-2 align-top">{company.period}</td>
                      <td className="break-words px-2 py-2 align-top">{company.taxOffice}</td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-wrap justify-center gap-x-1 gap-y-1 text-[#1f65a7]">
                          <button type="button" onClick={() => handleEditCompany(company)}>编辑</button>
                          <button type="button" onClick={() => handleDeleteCompany(company)}>删除</button>
                          <button type="button" onClick={() => handleDeactivateCompany(company)}>停用</button>
                          <button type="button" onClick={() => handleMemoCompany(company)}>备忘录</button>
                          <button type="button" onClick={() => handleSelectCompany(company.id, company.real)}>进入账套</button>
                          <button type="button" onClick={() => handleTaxLogin(company)}>登录税务局</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[92vh] w-full max-w-[1180px] flex-col rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-2xl font-semibold">{editingCompanyId ? '编辑企业' : '新增企业'}</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingCompanyId(null); setNewCompany(emptyCompanyForm) }} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
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
              {!editingCompanyId && <Button onClick={() => handleCreateCompany(true)}>保存并新增</Button>}
              <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingCompanyId(null); setNewCompany(emptyCompanyForm) }}>取消</Button>
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
