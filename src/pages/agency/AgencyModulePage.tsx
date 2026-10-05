import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Play,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  agencyApi,
  type AdapterAuthorization,
  type AgencyBatchTask,
  type AgencyCollaborationItem,
  type AgencyFeeCollection,
  type AgencyHealthCheckItem,
  type AgencyOperationOverview,
  type AgencyServiceContract,
  type AutomationJob,
  automationApi,
} from '../../lib/api'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore, type Company } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { recordAuditLog, recordExportJob, useExportJobs, type ExportJob } from '../../lib/exportJobs'
import { recordLocalImportJob } from '../../lib/localFileRegistry'

export type AgencyModuleKind =
  | 'clients'
  | 'authorizationCenter'
  | 'serviceContracts'
  | 'downloadCenter'
  | 'dataStats'
  | 'batchOps'
  | 'invoiceManagement'
  | 'healthCheck'
  | 'automation'

interface AgencyModulePageProps {
  kind: AgencyModuleKind
}

interface AgencyRow {
  id: string
  status: '待处理' | '进行中' | '已完成' | '异常' | '待确认'
  values: Record<string, string>
}

interface AgencyConfig {
  title: string
  description: string
  tabs: string[]
  primaryAction: string
  keywordPlaceholder: string
  summary: { label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' }[]
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[]
  rows: AgencyRow[]
  queueTitle: string
  queue: string[]
  notes: string[]
}

interface AgencyBatchTaskOption {
  id: string
  label: string
  scope: string
  detail: string
  requiresApproval: boolean
}

interface AgencyDetailMeta {
  title: string
  boundary: string
  processLabel: string
}

interface AgencyToolbarMeta {
  refreshLabel: string
  importLabel?: string
  excelLabel: string
  pdfLabel: string
  printLabel: string
}

const agencyBatchTaskOptions: AgencyBatchTaskOption[] = [
  { id: 'invoice_collection', label: '批量采集发票', scope: '全部已授权税务客户', detail: '核验税务授权范围和发票采集条件。', requiresApproval: false },
  { id: 'bank_collection', label: '批量采集银行流水', scope: '已授权银行客户', detail: '核验银行授权状态和可用导入范围。', requiresApproval: false },
  { id: 'voucher_generation_precheck', label: '批量生成凭证预检', scope: '已完成资料核验客户', detail: '只生成凭证建议与待确认草稿，不自动入账。', requiresApproval: false },
  { id: 'closing_precheck', label: '批量结账预检', scope: '待结账客户', detail: '核验凭证、报表和税务风险，进入审批队列。', requiresApproval: true },
  { id: 'tax_declaration_precheck', label: '批量申报预检', scope: '待申报税种', detail: '只生成申报包和风险清单，不提交税局。', requiresApproval: true },
  { id: 'declaration_receipt_archive', label: '申报回执归档预检', scope: '已确认申报事项', detail: '核验本地回执和缴款书归档条件。', requiresApproval: true },
]

const configs: Record<AgencyModuleKind, AgencyConfig> = {
  clients: {
    title: '客户总览',
    description: '代理机构维度集中查看本地客户账套、纳税人资格和启用状态；业务进度进入对应账套处理。',
    tabs: ['全部客户', '启用账套', '停用账套', '一般纳税人', '小规模纳税人'],
    primaryAction: '新增客户',
    keywordPlaceholder: '搜索客户名称、编码、税号、负责人',
    summary: [
      { label: '本地客户', value: '0 户', tone: 'blue' },
      { label: '启用账套', value: '0 户', tone: 'green' },
      { label: '一般纳税人', value: '0 户', tone: 'amber' },
      { label: '已停用', value: '0 户', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '客户编码' },
      { key: 'name', label: '客户名称' },
      { key: 'taxType', label: '纳税人类型' },
      { key: 'period', label: '账期', align: 'center' },
      { key: 'invoice', label: '收票/发票', align: 'center' },
      { key: 'voucher', label: '凭证', align: 'center' },
      { key: 'report', label: '报表' },
      { key: 'tax', label: '申报' },
      { key: 'owner', label: '负责人' },
    ],
    rows: [],
    queueTitle: '客户说明',
    queue: ['客户总览只列出本地已保存的企业资料与启用状态。', '进入账套后继续处理该客户的发票、凭证、报表和税务事项。'],
    notes: ['这里是机构层客户总览，不替代单账套内的业务处理页面。', '浏览器预览会读取已保存的企业资料，不再以静态客户样例填充。'],
  },
  authorizationCenter: {
    title: '授权中心',
    description: '集中维护多客户电子税务局、自然人税收、银行、工商和票池授权状态，为批量采集和批量申报提供前置授权检查。',
    tabs: ['授权总览', '税务授权', '个税授权', '银行授权', '工商授权', '票池授权', '到期提醒'],
    primaryAction: '新增授权',
    keywordPlaceholder: '搜索客户、授权类型、登录人员、到期时间、异常原因',
    summary: [
      { label: '授权记录', value: '0 条', tone: 'blue' },
      { label: '授权有效', value: '0 条', tone: 'green' },
      { label: '待确认', value: '0 条', tone: 'amber' },
      { label: '授权异常', value: '0 条', tone: 'red' },
    ],
    columns: [
      { key: 'customer', label: '客户名称' },
      { key: 'taxNo', label: '纳税人识别号' },
      { key: 'type', label: '授权类型' },
      { key: 'loginPerson', label: '登录人员' },
      { key: 'identity', label: '登录身份' },
      { key: 'method', label: '登录方式' },
      { key: 'statusText', label: '授权状态' },
      { key: 'expireAt', label: '到期时间' },
      { key: 'lastCollect', label: '最近采集' },
      { key: 'risk', label: '异常原因' },
    ],
    rows: [],
    queueTitle: '授权检查',
    queue: ['批量采集发票、流水、税种和主管税务机关前先检查授权状态', '授权中心只保存状态、掩码账号、adapter 参数和审计日志，不保存明文敏感信息', '授权异常客户自动进入批量任务跳过队列并提示补授权'],
    notes: ['授权中心是机构层模块，服务所有客户账套的采集、申报和自动化任务。', '单账套内只展示当前公司的授权结果和使用记录，不放跨客户批量授权入口。'],
  },
  serviceContracts: {
    title: '服务合同',
    description: '维护代账服务合同、收费收款、客户协同、服务套餐、续费和合同归档。',
    tabs: ['服务合同', '收费管理', '客户协同', '服务套餐', '归档记录'],
    primaryAction: '新增合同',
    keywordPlaceholder: '搜索客户、合同编号、收费状态、协同事项和服务套餐',
    summary: [
      { label: '服务中合同', value: '0 份', tone: 'blue' },
      { label: '待续签/待确认', value: '0 份', tone: 'amber' },
      { label: '异常/到期', value: '0 份', tone: 'red' },
      { label: '已归档', value: '0 份', tone: 'green' },
    ],
    columns: [
      { key: 'contractNo', label: '合同编号' },
      { key: 'customer', label: '客户名称' },
      { key: 'package', label: '服务套餐' },
      { key: 'period', label: '服务期间' },
      { key: 'fee', label: '月服务费', align: 'right' },
      { key: 'payment', label: '收费状态' },
      { key: 'collaboration', label: '客户协同' },
      { key: 'renewal', label: '续费状态' },
      { key: 'owner', label: '负责人' },
      { key: 'archive', label: '归档' },
    ],
    rows: [],
    queueTitle: '合同待办',
    queue: ['客户协同待办统一在合同客户视图处理。', '套餐、收费、催办和归档都以同一份服务合同为准。', '尚未创建合同或收费记录时会显示空台账，不伪造交付数据。'],
    notes: ['服务合同承接收费管理、客户协同、套餐和归档，避免机构首页入口过散。', '角色权限在专用权限管理页面维护；尚未接入持久化的数据项不在合同页伪造入口。'],
  },
  downloadCenter: {
    title: '下载中心',
    description: '统一查看本机已生成的跨客户导出文件、账簿报表、申报包和归档文件记录。',
    tabs: ['最近记录', 'Excel', 'PDF', 'ZIP归档包', '申报包', '异常任务'],
    primaryAction: '刷新文件清单',
    keywordPlaceholder: '搜索文件名、客户、生成状态、发起人',
    summary: [
      { label: '文件记录', value: '0 个', tone: 'blue' },
      { label: '已生成', value: '0 个', tone: 'green' },
      { label: '待确认', value: '0 个', tone: 'amber' },
      { label: '异常', value: '0 个', tone: 'red' },
    ],
    columns: [
      { key: 'fileName', label: '文件名' },
      { key: 'customer', label: '客户名称' },
      { key: 'type', label: '文件类型' },
      { key: 'period', label: '期间', align: 'center' },
      { key: 'statusText', label: '生成状态' },
      { key: 'createdAt', label: '生成时间' },
      { key: 'creator', label: '发起人' },
      { key: 'expireAt', label: '过期时间' },
      { key: 'hash', label: '文件哈希' },
    ],
    rows: [],
    queueTitle: '下载规则',
    queue: ['只展示本机已生成的导出任务记录；文件过期后需在原模块重新生成', '批量下载保留文件清单、生成状态、发起人和哈希摘要', '申报包和回执下载需受客户范围权限控制'],
    notes: ['下载中心用于机构层跨客户文件，不替代单账套内当前模块的导出按钮。', '固定 Excel/PDF 模板在生成时写入本地导出记录；下载中心不伪造文件。'],
  },
  dataStats: {
    title: '数据统计',
    description: '汇总本地服务合同、收费、客户协同和交付工单数据，供机构负责人查看经营与交付状态。',
    tabs: ['经营概览', '合同与收费', '协同与交付'],
    primaryAction: '统计口径',
    keywordPlaceholder: '搜索统计指标、数据来源',
    summary: [
      { label: '服务中合同', value: '0 份', tone: 'blue' },
      { label: '当期应收', value: '¥0.00', tone: 'green' },
      { label: '待协同事项', value: '0 项', tone: 'amber' },
      { label: '阻断交付任务', value: '0 项', tone: 'red' },
    ],
    columns: [
      { key: 'metric', label: '统计指标' },
      { key: 'value', label: '当前数值', align: 'right' },
      { key: 'source', label: '本地数据来源' },
    ],
    rows: [],
    queueTitle: '统计口径',
    queue: ['服务中合同和到期合同来自机构服务合同记录。', '应收、欠费按当前账期的本地收费记录汇总。', '协同和交付风险只统计已保存的协同事项与交付工单。'],
    notes: ['这个模块只呈现本地已保存的机构数据，不用样例数字填充经营统计。', '发票、凭证和申报等跨客户统计需在对应数据完整落库后再纳入。'],
  },
  batchOps: {
    title: '批量操作',
    description: '集中执行批量采集发票、采集银行流水、生成凭证、结转结账、批量申报、回执归档、反结账审批和资料归档。',
    tabs: ['操作任务', '批量采集', '批量生成', '批量结账', '批量申报', '申报回执', '审批记录'],
    primaryAction: '新建任务',
    keywordPlaceholder: '搜索任务、客户、操作人、执行状态',
    summary: [
      { label: '待执行', value: '0 个', tone: 'amber' },
      { label: '执行中', value: '0 个', tone: 'blue' },
      { label: '已完成', value: '0 个', tone: 'green' },
      { label: '阻断/失败', value: '0 个', tone: 'red' },
    ],
    columns: [
      { key: 'task', label: '任务名称' },
      { key: 'scope', label: '客户范围' },
      { key: 'period', label: '期间', align: 'center' },
      { key: 'progress', label: '进度', align: 'center' },
      { key: 'operator', label: '操作人' },
      { key: 'started', label: '开始时间' },
      { key: 'result', label: '结果' },
    ],
    rows: [],
    queueTitle: '执行控制',
    queue: ['批量采集需读取客户维护的税局和银行授权状态', '批量结账前必须完成凭证断号、报表平衡和税务风险检查', '批量申报、回执缴款书和扣款归档在同一任务内流转', '高风险客户自动跳过并进入审批记录', '所有任务保留执行日志和回滚说明'],
    notes: ['批量操作用于机构级效率提升，单账套页面仍保留逐户处理入口。', '新建任务只写入本地预检队列；申报确认、回执归档、删除、反结账等高风险动作仍需二次确认和审批。'],
  },
  invoiceManagement: {
    title: '开票管理',
    description: '查看机构服务费收费记录对应的开票状态；客户经营发票仍在各自账套的销项发票模块处理。',
    tabs: ['服务费开票队列', '待开票', '已开票', '异常状态'],
    primaryAction: '刷新开票队列',
    keywordPlaceholder: '搜索客户、账期、服务费开票状态、收款负责人',
    summary: [
      { label: '服务费记录', value: '0 条', tone: 'blue' },
      { label: '待开票', value: '0 条', tone: 'amber' },
      { label: '已开票', value: '0 条', tone: 'green' },
      { label: '异常状态', value: '0 条', tone: 'red' },
    ],
    columns: [
      { key: 'customer', label: '客户名称' },
      { key: 'period', label: '账期', align: 'center' },
      { key: 'amount', label: '服务费应收', align: 'right' },
      { key: 'received', label: '已收金额', align: 'right' },
      { key: 'invoice', label: '开票状态' },
      { key: 'payment', label: '收款状态' },
      { key: 'owner', label: '收款负责人' },
      { key: 'followUp', label: '最近跟进' },
    ],
    rows: [],
    queueTitle: '开票控制',
    queue: ['服务费开票只处理机构自身收入，不混入客户账套经营发票', '收费与开票状态来自本地收费记录，不伪造抬头或税号', '红冲作废需接入合法开票 adapter 后才能执行'],
    notes: ['开票管理与收费管理共用同一服务费台账，但只聚焦开票状态和异常跟进。', '客户账套内经营发票仍在单账套的销项发票模块处理。'],
  },
  healthCheck: {
    title: '健康体检',
    description: '基于本地未匹配发票、税务申报风险和阻断交付任务生成跨客户体检清单。',
    tabs: ['体检总览', '发票风险', '税务风险', '交付风险'],
    primaryAction: '开始体检',
    keywordPlaceholder: '搜索客户、风险项、责任人、整改状态',
    summary: [
      { label: '风险客户', value: '0 户', tone: 'blue' },
      { label: '高风险', value: '0 项', tone: 'red' },
      { label: '中风险', value: '0 项', tone: 'amber' },
      { label: '待整改', value: '0 项', tone: 'green' },
    ],
    columns: [
      { key: 'customer', label: '客户名称' },
      { key: 'module', label: '模块' },
      { key: 'risk', label: '风险说明' },
      { key: 'level', label: '级别', align: 'center' },
      { key: 'owner', label: '责任人' },
      { key: 'source', label: '数据来源' },
      { key: 'fix', label: '整改状态' },
    ],
    rows: [],
    queueTitle: '体检规则',
    queue: ['未匹配凭证的有效发票按客户汇总显示。', '税务申报风险仅统计本地税表任务的风险数量。', '阻断交付任务需在批量操作或对应账套中人工处理。'],
    notes: ['健康体检只展示可追溯到本地数据表的风险，不以样例补足风险项。', '后续可在真实规则落库后补充凭证、报表和结账勾稽检查。'],
  },
  automation: {
    title: '财税自动化',
    description: '集中查看各客户账套已保存的 OCR、识别和凭证建议任务；不在机构页直接执行外部动作。',
    tabs: ['任务看板', '采集预检', '识别任务', '凭证建议'],
    primaryAction: '刷新任务',
    keywordPlaceholder: '搜索任务、客户、来源模块、执行结果',
    summary: [
      { label: '任务总数', value: '0 个', tone: 'blue' },
      { label: '已完成', value: '0 个', tone: 'green' },
      { label: '待确认', value: '0 项', tone: 'amber' },
      { label: '失败', value: '0 项', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '任务名称' },
      { key: 'trigger', label: '触发器' },
      { key: 'scope', label: '客户范围' },
      { key: 'lastRun', label: '最近执行' },
      { key: 'confidence', label: 'AI置信度', align: 'right' },
      { key: 'confirm', label: '人工确认' },
      { key: 'result', label: '结果' },
    ],
    rows: [],
    queueTitle: 'AI控制边界',
    queue: ['AI 只能生成建议和草稿，凭证入账前需确认', '自动申报只到申报包和待提交状态', '每条建议保留来源、置信度和人工处理日志'],
    notes: ['AI 是额外增强功能，必须解释来源和置信度，不能黑箱直接入账或报税。', '任务创建、凭证确认和税务操作在对应客户账套中完成，机构页仅做跨客户监管。'],
  },
}

function exportJobToAgencyRow(job: ExportJob): AgencyRow {
  return {
    id: job.id,
    status: job.status === '已完成' ? '已完成' : job.status === '待确认' ? '待确认' : '异常',
    values: {
      fileName: job.fileName,
      customer: job.moduleName.startsWith('机构-') ? '机构批量任务' : '当前账套/客户',
      type: job.format,
      period: extractAgencyExportPeriod(job),
      statusText: job.status,
      createdAt: job.createdAt,
      creator: job.operator,
      expireAt: job.expireAt,
      hash: job.hash,
    },
  }
}

function extractAgencyExportPeriod(job: ExportJob) {
  const match = `${job.fileName} ${job.scope}`.match(/(20\d{2})[-./年]?(\d{2})(?:月)?/)
  return match ? `${match[1]}-${match[2]}` : '未标注'
}

function summarizeAgencyDownloadJobs(rows: AgencyRow[]) {
  const completed = rows.filter((row) => row.status === '已完成').length
  const pending = rows.filter((row) => row.status === '待确认').length
  const abnormal = rows.filter((row) => row.status === '异常').length
  return [
    { label: '文件记录', value: `${rows.length} 个`, tone: 'blue' as const },
    { label: '已生成', value: `${completed} 个`, tone: 'green' as const },
    { label: '待确认', value: `${pending} 个`, tone: 'amber' as const },
    { label: '异常', value: `${abnormal} 个`, tone: 'red' as const },
  ]
}

function getAgencyTabConfig(baseConfig: AgencyConfig, activeTab: string): AgencyConfig {
  if (baseConfig.title === '下载中心') {
    const rows = baseConfig.rows.filter((row) => {
      if (activeTab === 'Excel') return row.values.type === 'Excel'
      if (activeTab === 'PDF') return row.values.type === 'PDF'
      if (activeTab === 'ZIP归档包') return row.values.type === 'ZIP'
      if (activeTab === '申报包') return row.values.fileName.includes('申报') || row.values.fileName.includes('回执')
      if (activeTab === '异常任务') return row.status === '异常'
      return true
    })
    return { ...baseConfig, rows }
  }

  if (baseConfig.title === '授权中心') {
    return {
      ...baseConfig,
      description: '集中查看本地保存的税务、个税、银行、工商和票池授权状态；仅展示掩码账号和授权元数据。',
      summary: [
        { label: '授权记录', value: '0 条', tone: 'blue' },
        { label: '授权有效', value: '0 条', tone: 'green' },
        { label: '待确认', value: '0 条', tone: 'amber' },
        { label: '授权异常', value: '0 条', tone: 'red' },
      ],
      keywordPlaceholder: '搜索客户、授权类型、掩码账号、登录身份、异常原因',
      columns: [
        { key: 'customer', label: '客户名称' },
        { key: 'taxNo', label: '授权账号（掩码）' },
        { key: 'type', label: '授权类型' },
        { key: 'loginPerson', label: '登录身份' },
        { key: 'identity', label: '授权范围' },
        { key: 'method', label: 'Adapter' },
        { key: 'statusText', label: '授权状态' },
        { key: 'expireAt', label: '到期时间' },
        { key: 'lastCollect', label: '最近校验' },
        { key: 'risk', label: '风险说明' },
      ],
      rows: [],
      queueTitle: '授权说明',
      queue: ['授权中心只读取本地已保存的授权状态、范围和掩码账号。', '需要补授权或授权已失效时，必须在合法 adapter 流程内由人工完成。'],
      notes: ['桌面端无授权记录时显示空表，不以样例授权填充。', '明文账号、密码、验证码和 Cookie 不会写入此列表或导出文件。'],
    }
  }

  if (baseConfig.title === '客户总览') {
    return {
      ...baseConfig,
      description: '集中查看本地客户账套、纳税人性质、启用账期和账套状态；业务进度在进入对应账套后处理。完整企业建档和批量管理只在首页进行。',
      summary: [
        { label: '本地客户', value: '0 户', tone: 'blue' },
        { label: '启用账套', value: '0 户', tone: 'green' },
        { label: '一般纳税人', value: '0 户', tone: 'amber' },
        { label: '已停用', value: '0 户', tone: 'red' },
      ],
      keywordPlaceholder: '搜索客户名称、编码、纳税人识别号、行业',
      columns: [
        { key: 'code', label: '客户编码' },
        { key: 'name', label: '客户名称' },
        { key: 'taxId', label: '纳税人识别号' },
        { key: 'taxType', label: '纳税人资格' },
        { key: 'enablePeriod', label: '启用账期', align: 'center' },
        { key: 'accountingSystem', label: '会计制度' },
        { key: 'industry', label: '会计行业' },
        { key: 'accountStatus', label: '账套状态' },
      ],
      rows: [],
      queueTitle: '客户说明',
      queue: ['客户总览只列出本地企业事实，不伪造发票、凭证、申报或风险数量。', '进入账套后查看该客户的发票、凭证、报表和税务处理。'],
      notes: ['无企业记录时显示空表，浏览器预览读取本机已保存的企业资料。'],
    }
  }

  if (baseConfig.title !== '服务合同') return baseConfig

  if (activeTab === '归档记录') {
    return {
      ...baseConfig,
      title: '合同归档',
      description: '查看本地服务合同的归档状态、服务期间、负责人和最近更新时间。',
      primaryAction: '刷新归档记录',
      keywordPlaceholder: '搜索合同编号、客户、归档状态、负责人',
      summary: [
        { label: '归档记录', value: '0 条', tone: 'blue' },
        { label: '已归档', value: '0 条', tone: 'green' },
        { label: '待归档', value: '0 条', tone: 'amber' },
        { label: '缺少附件', value: '0 条', tone: 'red' },
      ],
      columns: [
        { key: 'contractNo', label: '合同编号' },
        { key: 'customer', label: '客户名称' },
        { key: 'period', label: '服务期间' },
        { key: 'archive', label: '归档状态' },
        { key: 'renewal', label: '续费状态' },
        { key: 'owner', label: '负责人' },
        { key: 'updatedAt', label: '最近更新' },
      ],
      rows: [],
      queueTitle: '归档规则',
      queue: ['归档状态来自本地服务合同记录，不伪造合同附件或电子签章。', '缺少附件或到期合同需回到服务合同模块补充或续签。'],
      notes: ['归档记录是服务合同的子视图，不单独维护第二份合同数据。', '真实附件存储和下载将在文件存储 adapter 接入后开放。'],
    }
  }

  if (activeTab === '服务套餐') {
    return {
      ...baseConfig,
      title: '服务套餐',
      description: '按本地服务合同汇总套餐覆盖客户、合同数量、月服务费、续费和归档情况。',
      primaryAction: '刷新套餐汇总',
      keywordPlaceholder: '搜索套餐名称、客户数、续费状态、归档异常',
      summary: [
        { label: '套餐种类', value: '0 个', tone: 'blue' },
        { label: '服务合同', value: '0 份', tone: 'green' },
        { label: '月服务费', value: '¥0.00', tone: 'amber' },
        { label: '待续签套餐', value: '0 个', tone: 'red' },
      ],
      columns: [
        { key: 'package', label: '服务套餐' },
        { key: 'customers', label: '覆盖客户', align: 'center' },
        { key: 'contracts', label: '合同数量', align: 'center' },
        { key: 'monthlyFee', label: '月服务费合计', align: 'right' },
        { key: 'renewal', label: '续费状态' },
        { key: 'archive', label: '归档情况' },
      ],
      rows: [],
      queueTitle: '套餐说明',
      queue: ['套餐信息从服务合同汇总，不维护重复的套餐收费数据。', '新增套餐、修改套餐范围和价格需通过服务合同流程留痕。'],
      notes: ['服务套餐用于查看已签合同的服务范围与规模。', '套餐本身不触发开票、收款或客户经营账套业务。'],
    }
  }

  if (activeTab === '收费管理') {
    return {
      ...baseConfig,
      title: '收费管理',
      description: '按客户和账期查看应收、实收、欠费、服务费开票和催收记录。',
      primaryAction: '新增收费记录',
      keywordPlaceholder: '搜索客户、账期、收费状态、收款人',
      summary: [
        { label: '收费记录', value: '0 条', tone: 'blue' },
        { label: '应收金额', value: '¥0.00', tone: 'amber' },
        { label: '已收金额', value: '¥0.00', tone: 'green' },
        { label: '欠费金额', value: '¥0.00', tone: 'red' },
      ],
      columns: [
        { key: 'customer', label: '客户名称' },
        { key: 'period', label: '账期', align: 'center' },
        { key: 'receivable', label: '应收金额', align: 'right' },
        { key: 'received', label: '已收金额', align: 'right' },
        { key: 'arrears', label: '欠费金额', align: 'right' },
        { key: 'invoice', label: '服务费开票' },
        { key: 'payment', label: '收费状态' },
        { key: 'collector', label: '收款负责人' },
        { key: 'followUp', label: '最近催收' },
      ],
      rows: [],
      queueTitle: '收费待办',
      queue: ['欠费、开票和客户催收由收费记录驱动，不在客户账套内重复维护。', '收款与开票状态变更需要留存对应的客户、账期和操作人。'],
      notes: ['收费管理属于机构服务交付，不与客户经营发票混用。', '桌面端仅展示本地收费记录；税务和银行外部动作需要授权 adapter。'],
    }
  }

  if (activeTab === '客户协同') {
    return {
      ...baseConfig,
      title: '客户协同',
      description: '集中跟进客户资料补充、催办、答复状态和责任人，资料进入对应客户账套后再处理。',
      primaryAction: '新增协同事项',
      keywordPlaceholder: '搜索客户、事项、资料类型、联系人、负责人',
      summary: [
        { label: '协同事项', value: '0 项', tone: 'blue' },
        { label: '待客户答复', value: '0 项', tone: 'amber' },
        { label: '已完成', value: '0 项', tone: 'green' },
        { label: '超时提醒', value: '0 项', tone: 'red' },
      ],
      columns: [
        { key: 'customer', label: '客户名称' },
        { key: 'todo', label: '协同事项' },
        { key: 'material', label: '资料类型' },
        { key: 'contact', label: '客户联系人' },
        { key: 'reminder', label: '催办次数', align: 'center' },
        { key: 'lastContact', label: '最近联系' },
        { key: 'reply', label: '客户答复' },
        { key: 'owner', label: '负责人' },
      ],
      rows: [],
      queueTitle: '协同待办',
      queue: ['资料补充、催办和客户答复在机构层统一跟进。', '资料进入账套后由对应的发票、单据或凭证模块继续处理。'],
      notes: ['协同事项不替代单账套业务处理，只保存跨客户服务交付跟进。', '桌面端仅展示本地协同事项和审计留痕。'],
    }
  }

  return baseConfig
}

function summarizeAgencyTabRows(config: AgencyConfig, rows: AgencyRow[]) {
  if (config.title === '合同归档') {
    const archived = rows.filter((row) => row.values.archive === '已归档').length
    const missing = rows.filter((row) => row.values.archive === '缺少附件').length
    return [
      { label: '归档记录', value: `${rows.length} 条`, tone: 'blue' as const },
      { label: '已归档', value: `${archived} 条`, tone: 'green' as const },
      { label: '待归档', value: `${rows.filter((row) => row.values.archive === '待归档').length} 条`, tone: 'amber' as const },
      { label: '缺少附件', value: `${missing} 条`, tone: 'red' as const },
    ]
  }

  if (config.title === '服务套餐') {
    const totalContracts = rows.reduce((sum, row) => sum + Number(row.values.contracts.replace(/\D/g, '') || 0), 0)
    const totalFee = rows.reduce((sum, row) => sum + parseAgencyMoney(row.values.monthlyFee), 0)
    const renewal = rows.filter((row) => row.values.renewal !== '正常').length
    return [
      { label: '套餐种类', value: `${rows.length} 个`, tone: 'blue' as const },
      { label: '服务合同', value: `${totalContracts} 份`, tone: 'green' as const },
      { label: '月服务费', value: formatMoney(totalFee), tone: 'amber' as const },
      { label: '待续签套餐', value: `${renewal} 个`, tone: 'red' as const },
    ]
  }

  if (config.title === '开票管理') {
    const pending = rows.filter((row) => row.values.invoice !== '已开票').length
    const issued = rows.filter((row) => row.values.invoice === '已开票').length
    const abnormal = rows.filter((row) => row.status === '异常').length
    return [
      { label: '服务费记录', value: `${rows.length} 条`, tone: 'blue' as const },
      { label: '待开票', value: `${pending} 条`, tone: 'amber' as const },
      { label: '已开票', value: `${issued} 条`, tone: 'green' as const },
      { label: '异常状态', value: `${abnormal} 条`, tone: 'red' as const },
    ]
  }

  if (config.title === '收费管理') {
    const total = (key: string) => rows.reduce((sum, row) => sum + parseAgencyMoney(row.values[key]), 0)
    return [
      { label: '收费记录', value: `${rows.length} 条`, tone: 'blue' as const },
      { label: '应收金额', value: formatMoney(total('receivable')), tone: 'amber' as const },
      { label: '已收金额', value: formatMoney(total('received')), tone: 'green' as const },
      { label: '欠费金额', value: formatMoney(total('arrears')), tone: 'red' as const },
    ]
  }

  if (config.title === '客户协同') {
    const completed = rows.filter((row) => row.status === '已完成').length
    const overdue = rows.filter((row) => row.status === '异常').length
    return [
      { label: '协同事项', value: `${rows.length} 项`, tone: 'blue' as const },
      { label: '待客户答复', value: `${rows.filter((row) => row.status === '待确认' || row.status === '待处理').length} 项`, tone: 'amber' as const },
      { label: '已完成', value: `${completed} 项`, tone: 'green' as const },
      { label: '超时提醒', value: `${overdue} 项`, tone: 'red' as const },
    ]
  }

  if (config.title === '授权中心') {
    const valid = rows.filter((row) => row.status === '已完成').length
    const pending = rows.filter((row) => row.status === '待确认' || row.status === '待处理').length
    const abnormal = rows.filter((row) => row.status === '异常').length
    return [
      { label: '授权记录', value: `${rows.length} 条`, tone: 'blue' as const },
      { label: '授权有效', value: `${valid} 条`, tone: 'green' as const },
      { label: '待确认', value: `${pending} 条`, tone: 'amber' as const },
      { label: '授权异常', value: `${abnormal} 条`, tone: 'red' as const },
    ]
  }

  if (config.title === '批量操作') {
    const queued = rows.filter((row) => row.status === '待处理' || row.status === '待确认').length
    const processing = rows.filter((row) => row.status === '进行中').length
    const completed = rows.filter((row) => row.status === '已完成').length
    const blocked = rows.filter((row) => row.status === '异常').length
    return [
      { label: '待执行', value: `${queued} 个`, tone: 'amber' as const },
      { label: '执行中', value: `${processing} 个`, tone: 'blue' as const },
      { label: '已完成', value: `${completed} 个`, tone: 'green' as const },
      { label: '阻断/失败', value: `${blocked} 个`, tone: 'red' as const },
    ]
  }

  if (config.title === '健康体检') {
    const customers = new Set(rows.map((row) => row.values.customer).filter(Boolean)).size
    const high = rows.filter((row) => row.values.level === '高').length
    const medium = rows.filter((row) => row.values.level === '中').length
    return [
      { label: '风险客户', value: `${customers} 户`, tone: 'blue' as const },
      { label: '高风险', value: `${high} 项`, tone: 'red' as const },
      { label: '中风险', value: `${medium} 项`, tone: 'amber' as const },
      { label: '待整改', value: `${rows.length} 项`, tone: 'green' as const },
    ]
  }

  if (config.title === '财税自动化') {
    const completed = rows.filter((row) => row.status === '已完成').length
    const pending = rows.filter((row) => row.status === '待处理' || row.status === '待确认').length
    const failed = rows.filter((row) => row.status === '异常').length
    return [
      { label: '任务总数', value: `${rows.length} 个`, tone: 'blue' as const },
      { label: '已完成', value: `${completed} 个`, tone: 'green' as const },
      { label: '待确认', value: `${pending} 项`, tone: 'amber' as const },
      { label: '失败', value: `${failed} 项`, tone: 'red' as const },
    ]
  }

  if (config.title === '服务合同') {
    return [
      { label: '服务中合同', value: `${rows.filter((row) => row.status === '进行中').length} 份`, tone: 'blue' as const },
      { label: '待续签/待确认', value: `${rows.filter((row) => row.status === '待确认').length} 份`, tone: 'amber' as const },
      { label: '异常/到期', value: `${rows.filter((row) => row.status === '异常').length} 份`, tone: 'red' as const },
      { label: '已归档', value: `${rows.filter((row) => row.values.archive === 'archived' || row.values.archive === '已归档').length} 份`, tone: 'green' as const },
    ]
  }

  if (config.title === '客户总览' || config.title === '账套管理') {
    const activeCount = rows.filter((row) => row.values.accountStatus === '启用').length
    const generalTaxpayerCount = rows.filter((row) => row.values.taxType === '一般纳税人').length
    const smallTaxpayerCount = rows.filter((row) => row.values.taxType === '小规模纳税人').length
    const disabledCount = rows.filter((row) => row.values.accountStatus === '停用').length
    return config.title === '账套管理'
      ? [
          { label: '本地账套', value: `${rows.length} 户`, tone: 'blue' as const },
          { label: '一般纳税人', value: `${generalTaxpayerCount} 户`, tone: 'green' as const },
          { label: '小规模纳税人', value: `${smallTaxpayerCount} 户`, tone: 'amber' as const },
          { label: '已停用', value: `${disabledCount} 户`, tone: 'red' as const },
        ]
      : [
          { label: '本地客户', value: `${rows.length} 户`, tone: 'blue' as const },
          { label: '启用账套', value: `${activeCount} 户`, tone: 'green' as const },
          { label: '一般纳税人', value: `${generalTaxpayerCount} 户`, tone: 'amber' as const },
          { label: '已停用', value: `${disabledCount} 户`, tone: 'red' as const },
        ]
  }

  return config.summary
}

function mapAgencyOverviewRows(overview: AgencyOperationOverview, activeTab: string): AgencyRow[] {
  const rows: AgencyRow[] = [
    { id: 'overview-service-contracts', status: overview.serviceContracts > 0 ? '已完成' : '待处理', values: { metric: '服务中合同', value: `${overview.serviceContracts} 份`, source: '服务合同记录' } },
    { id: 'overview-expiring-contracts', status: overview.expiringContracts > 0 ? '异常' : '已完成', values: { metric: '即将到期合同', value: `${overview.expiringContracts} 份`, source: '服务合同记录' } },
    { id: 'overview-receivable', status: overview.receivableAmount > 0 ? '进行中' : '待处理', values: { metric: '当期应收金额', value: formatMoney(overview.receivableAmount), source: '收费记录（当前账期）' } },
    { id: 'overview-arrears', status: overview.arrearsAmount > 0 ? '异常' : '已完成', values: { metric: '当期欠费金额', value: formatMoney(overview.arrearsAmount), source: '收费记录（当前账期）' } },
    { id: 'overview-pending-collaboration', status: overview.pendingCollaboration > 0 ? '待确认' : '已完成', values: { metric: '待协同事项', value: `${overview.pendingCollaboration} 项`, source: '客户协同事项' } },
    { id: 'overview-overdue-collaboration', status: overview.overdueCollaboration > 0 ? '异常' : '已完成', values: { metric: '超时协同事项', value: `${overview.overdueCollaboration} 项`, source: '客户协同事项' } },
    { id: 'overview-open-tickets', status: overview.openTickets > 0 ? '进行中' : '已完成', values: { metric: '开放交付任务', value: `${overview.openTickets} 项`, source: '交付工单（当前账期）' } },
    { id: 'overview-blocked-tickets', status: overview.blockedTickets > 0 ? '异常' : '已完成', values: { metric: '阻断交付任务', value: `${overview.blockedTickets} 项`, source: '交付工单（当前账期）' } },
  ]

  if (activeTab === '合同与收费') return rows.slice(0, 4)
  if (activeTab === '协同与交付') return rows.slice(4)
  return rows
}

function summarizeAgencyOverview(overview: AgencyOperationOverview) {
  return [
    { label: '服务中合同', value: `${overview.serviceContracts} 份`, tone: 'blue' as const },
    { label: '当期应收', value: formatMoney(overview.receivableAmount), tone: 'green' as const },
    { label: '待协同事项', value: `${overview.pendingCollaboration} 项`, tone: 'amber' as const },
    { label: '阻断交付任务', value: `${overview.blockedTickets} 项`, tone: 'red' as const },
  ]
}

function parseAgencyMoney(value = '') {
  const normalized = value.replace(/[^0-9.-]/g, '')
  return Number.isFinite(Number(normalized)) ? Number(normalized) : 0
}

function getAgencyDetailMeta(kind: AgencyModuleKind): AgencyDetailMeta {
  if (kind === 'clients') return { title: '客户账套明细', boundary: '仅展示机构已维护的客户账套、当前账期和处理进度；进入账套后才处理该客户的发票、凭证、报表和申报事项。', processLabel: '核对账套' }
  if (kind === 'authorizationCenter') return { title: '授权记录明细', boundary: '仅展示授权类型、掩码账号、适用范围和到期状态；不会展示或保存明文密码、令牌、Cookie 或证书。', processLabel: '核验授权' }
  if (kind === 'serviceContracts') return { title: '合同履约明细', boundary: '仅展示机构服务合同、收费、协同、套餐和归档状态；客户账套内的业务单据和会计处理不在此修改。', processLabel: '更新履约' }
  if (kind === 'downloadCenter') return { title: '下载文件明细', boundary: '仅展示本机已生成文件的范围、状态和哈希摘要；查看不会重新生成文件或访问外部存储。', processLabel: '核验文件' }
  if (kind === 'dataStats') return { title: '机构统计口径明细', boundary: '统计仅基于本机已保存的机构级合同、收费、协同和交付数据；不使用样例数据代替真实统计。', processLabel: '复核口径' }
  if (kind === 'batchOps') return { title: '批量任务明细', boundary: '机构级明细仅覆盖跨客户的本地预检、风险清单和审批记录；不会进入单客户账套处理业务，也不会登录税局、银行或自动提交、扣款、结账和入账。', processLabel: '执行预检' }
  if (kind === 'invoiceManagement') return { title: '服务费开票明细', boundary: '这里只处理机构服务费开票状态；客户经营发票仍在各自账套的销项发票模块维护。', processLabel: '核验开票' }
  if (kind === 'healthCheck') return { title: '跨客户风险明细', boundary: '体检只汇总已保存的风险规则结果和处理状态；不会自动修复凭证、报表或税务问题。', processLabel: '复核风险' }
  return { title: '自动化任务明细', boundary: '自动化仅维护本地任务、建议和人工确认状态；不会越过授权边界调用外部系统或自动入账、申报。', processLabel: '复核任务' }
}

function getAgencyToolbarMeta(kind: AgencyModuleKind): AgencyToolbarMeta {
  if (kind === 'clients') return { refreshLabel: '刷新客户', importLabel: '导入账套', excelLabel: '导出客户Excel', pdfLabel: '导出客户PDF', printLabel: '打印客户清单' }
  if (kind === 'authorizationCenter') return { refreshLabel: '检查授权', importLabel: '导入授权', excelLabel: '导出授权Excel', pdfLabel: '导出授权PDF', printLabel: '打印授权清单' }
  if (kind === 'serviceContracts') return { refreshLabel: '刷新合同', importLabel: '导入合同', excelLabel: '导出履约Excel', pdfLabel: '导出履约PDF', printLabel: '打印合同清单' }
  if (kind === 'downloadCenter') return { refreshLabel: '刷新文件', excelLabel: '导出文件清单', pdfLabel: '导出下载清单', printLabel: '打印文件清单' }
  if (kind === 'dataStats') return { refreshLabel: '刷新统计', excelLabel: '导出统计Excel', pdfLabel: '导出统计PDF', printLabel: '打印统计口径' }
  if (kind === 'batchOps') return { refreshLabel: '刷新任务', importLabel: '导入任务模板', excelLabel: '导出任务Excel', pdfLabel: '导出任务PDF', printLabel: '打印任务清单' }
  if (kind === 'invoiceManagement') return { refreshLabel: '刷新开票', importLabel: '导入收费记录', excelLabel: '导出开票Excel', pdfLabel: '导出开票PDF', printLabel: '打印开票清单' }
  if (kind === 'healthCheck') return { refreshLabel: '重新体检', excelLabel: '导出风险Excel', pdfLabel: '导出风险PDF', printLabel: '打印风险清单' }
  return { refreshLabel: '刷新队列', importLabel: '导入自动化规则', excelLabel: '导出任务Excel', pdfLabel: '导出任务PDF', printLabel: '打印任务清单' }
}

export function AgencyModulePage({ kind }: AgencyModulePageProps) {
  const navigate = useNavigate()
  const { companies, fetchCompanies, selectCompany } = useCompanyStore()
  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId)
  const periods = usePeriodStore((state) => state.periods)
  const currentPeriod = useMemo(() => periods.find((period) => period.id === currentPeriodId), [currentPeriodId, periods])
  const agencyPeriodLabel = currentPeriod
    ? `${currentPeriod.period_year}-${String(currentPeriod.period_month).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7)
  const baseConfig = configs[kind]
  const detailMeta = getAgencyDetailMeta(kind)
  const toolbarMeta = getAgencyToolbarMeta(kind)
  const exportJobs = useExportJobs()
  const config = useMemo(() => {
    if (kind !== 'downloadCenter') return baseConfig
    const dynamicRows = exportJobs.map(exportJobToAgencyRow)
    return {
      ...baseConfig,
      rows: dynamicRows,
      summary: summarizeAgencyDownloadJobs(dynamicRows),
    }
  }, [baseConfig, exportJobs, kind])
  const [remoteRows, setRemoteRows] = useState<AgencyRow[] | null>(null)
  const [agencyOverview, setAgencyOverview] = useState<AgencyOperationOverview | null>(null)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [activeTab, setActiveTab] = useState(config.tabs[0])
  const [query, setQuery] = useState('')
  const [showDataStatsScopeDialog, setShowDataStatsScopeDialog] = useState(false)
  const [showAgencyFilterDialog, setShowAgencyFilterDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState('全部')
  const [statusFilterDraft, setStatusFilterDraft] = useState('全部')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [detailRow, setDetailRow] = useState<AgencyRow | null>(null)
  const [showBatchTaskDialog, setShowBatchTaskDialog] = useState(false)
  const [selectedBatchTaskTypes, setSelectedBatchTaskTypes] = useState<string[]>(() => agencyBatchTaskOptions.map((option) => option.id))
  const [showContractDialog, setShowContractDialog] = useState(false)
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [contractDraft, setContractDraft] = useState({
    companyId: '', contractNo: '', servicePackage: '', serviceStart: '', serviceEnd: '', monthlyFee: '', owner: '',
    renewalStatus: 'normal', archiveStatus: 'pending', status: 'active',
  })
  const [showFeeDialog, setShowFeeDialog] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [feeDraft, setFeeDraft] = useState({
    companyId: '',
    period: agencyPeriodLabel,
    receivableAmount: '',
    receivedAmount: '0',
    invoiceStatus: 'pending',
    paymentStatus: 'pending',
    collector: '',
    lastFollowUp: '',
    status: 'pending',
  })
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false)
  const [editingCollaborationId, setEditingCollaborationId] = useState<string | null>(null)
  const [collaborationDraft, setCollaborationDraft] = useState({
    companyId: '',
    todoTitle: '',
    materialType: '',
    customerContact: '',
    replyStatus: 'pending',
    owner: '',
    reminderCount: '0',
    lastContactAt: '',
    status: 'pending',
  })
  const [showAuthorizationDialog, setShowAuthorizationDialog] = useState(false)
  const [editingAuthorization, setEditingAuthorization] = useState(false)
  const [authorizationDraft, setAuthorizationDraft] = useState({
    companyId: '',
    adapterType: 'tax',
    adapterCode: '',
    region: '',
    authStatus: 'pending',
    accountMask: '',
    loginIdentity: '',
    capabilityScope: '',
    expiresAt: '',
    riskMessage: '',
  })
  const [showAutomationReviewDialog, setShowAutomationReviewDialog] = useState(false)
  const [automationReviewDraft, setAutomationReviewDraft] = useState({
    id: '',
    companyId: '',
    taskName: '',
    status: 'reviewing',
    confidence: '',
    riskLevel: 'normal',
    reviewer: 'admin',
    resultSummary: '',
  })
  const pageConfig = useMemo(() => getAgencyTabConfig(config, activeTab), [activeTab, config])
  const overviewRows = useMemo(
    () => agencyOverview ? mapAgencyOverviewRows(agencyOverview, activeTab) : [],
    [activeTab, agencyOverview]
  )
  const rows = [
    ...(kind === 'downloadCenter' ? pageConfig.rows : kind === 'dataStats'
      ? overviewRows
      : remoteRows ?? []),
  ]
  const summary = useMemo(
    () => {
      if (kind === 'dataStats' && agencyOverview) return summarizeAgencyOverview(agencyOverview)
      return remoteRows !== null ? summarizeAgencyTabRows(pageConfig, remoteRows) : pageConfig.summary
    },
    [agencyOverview, kind, pageConfig, remoteRows]
  )
  const usesAgencyPreviewRows = Boolean(!isTauri && remoteRows !== null && kind !== 'downloadCenter')
  const availableStatuses = useMemo(
    () => ['全部', ...Array.from(new Set(rows.map((row) => row.status).filter(Boolean)))],
    [rows],
  )
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesStatusFilter = statusFilter === '全部' || row.status === statusFilter
      const matchesQuery = !q || Object.values(row.values).some((value) => value.toLowerCase().includes(q))
      return matchesStatusFilter && matchesQuery
    })
  }, [rows, query, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, filteredRows.length)
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])
  const isFilteredAgencyListEmpty = filteredRows.length === 0 && rows.length > 0
  const agencyEmptyTitle = isFilteredAgencyListEmpty ? '没有符合当前条件的记录' : `暂无${pageConfig.title}`
  const agencyEmptyActionLabel = isFilteredAgencyListEmpty ? '清除筛选并显示当前工作区记录' : pageConfig.primaryAction
  const agencyEmptyDescription = isFilteredAgencyListEmpty
    ? '可以清除关键词和状态筛选，返回当前工作区的完整本地台账。'
    : `${pageConfig.description} ${pageConfig.notes[0]} 请通过“${agencyEmptyActionLabel}”开始当前工作。`

  useEffect(() => {
    setPage(1)
  }, [kind, activeTab, query, statusFilter, pageSize])

  useEffect(() => {
    setActiveTab(config.tabs[0])
  }, [kind, config.tabs])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const loadRemoteRows = async () => {
    setIsLoadingRows(true)
    try {
      if (kind === 'clients') {
        await fetchCompanies()
        const liveCompanies = useCompanyStore.getState().companies
        const companyRows = liveCompanies.map((item) => mapAgencyCompanyRow(item))
        setRemoteRows(filterAgencyCompanyRows(companyRows, activeTab))
        return
      }

      if (kind === 'dataStats') {
        const response = await agencyApi.getOverview(agencyPeriodLabel)
        if (!response.success) throw new Error(response.error || '机构统计读取失败')
        setAgencyOverview(response.data ?? null)
        setRemoteRows([])
        return
      }

      if (kind === 'downloadCenter') {
        setRemoteRows(null)
        return
      }

      const nextRows = await fetchAgencyRows(kind, activeTab, agencyPeriodLabel)
      setRemoteRows(nextRows)
    } catch {
      if (kind === 'dataStats') setAgencyOverview(null)
      setRemoteRows(null)
    } finally {
      setIsLoadingRows(false)
    }
  }

  useEffect(() => {
    setRemoteRows(null)
    setAgencyOverview(null)
    void loadRemoteRows()
  }, [activeTab, agencyPeriodLabel, fetchCompanies, kind])

  useEffect(() => {
    setOperationNotice(null)
  }, [kind])

  const writeAgencyAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    const status = result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过'
    recordAuditLog({
      module: `机构-${pageConfig.title}`,
      action,
      object,
      level,
      result,
      status,
      voucher: `${activeTab}/${query.trim() || '全部'}`,
      attachment: '操作快照',
    })
    if (!isTauri) return

    void automationApi.writeOperationAuditLog({
      moduleName: `机构-${pageConfig.title}`,
      action,
      objectRef: `${agencyPeriodLabel}｜${object}`,
      riskLevel: level,
      result,
      detail: `${status}｜${activeTab}/${query.trim() || '全部'}`,
      operator: 'admin',
    })
  }

  const openAgencyFilterDialog = () => {
    setStatusFilterDraft(statusFilter)
    setShowAgencyFilterDialog(true)
  }

  const applyAgencyStatusFilter = () => {
    setStatusFilter(statusFilterDraft)
    setShowAgencyFilterDialog(false)
    writeAgencyAudit('机构列表筛选', `${pageConfig.title}-${statusFilterDraft}`)
    setOperationNotice(statusFilterDraft === '全部' ? '已清除机构状态筛选。' : `已按“${statusFilterDraft}”筛选当前列表。`)
  }

  const resetAgencyListFilters = () => {
    setQuery('')
    setStatusFilter('全部')
    setStatusFilterDraft('全部')
    setOperationNotice('已清除筛选并返回当前工作区完整列表。')
  }

  const rowObjectLabel = (row: AgencyRow) => {
    return row.values.name || row.values.customer || row.values.fileName || row.values.task || row.values.contractNo || row.values.code || row.id
  }

  const handleViewRow = (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    writeAgencyAudit('查看明细', `${pageConfig.title}-${object}`)
    setDetailRow(row)
  }

  const resetContractEditor = () => {
    setEditingContractId(null)
    setContractDraft({ companyId: '', contractNo: '', servicePackage: '', serviceStart: '', serviceEnd: '', monthlyFee: '', owner: '', renewalStatus: 'normal', archiveStatus: 'pending', status: 'active' })
  }

  const openContractEditor = async (row?: AgencyRow) => {
    if (companies.length === 0) await fetchCompanies()
    if (!row) {
      resetContractEditor()
      setShowContractDialog(true)
      return
    }
    setEditingContractId(row.id)
    setContractDraft({
      companyId: row.values.companyId || '',
      contractNo: row.values.contractNo || '',
      servicePackage: row.values.servicePackage || row.values.package || '',
      serviceStart: row.values.serviceStart || '',
      serviceEnd: row.values.serviceEnd || '',
      monthlyFee: row.values.monthlyFee || '0',
      owner: row.values.owner === '-' ? '' : row.values.owner || '',
      renewalStatus: row.values.renewalStatus || 'normal',
      archiveStatus: row.values.archiveStatus || 'pending',
      status: row.values.recordStatus || 'active',
    })
    setShowContractDialog(true)
  }

  const resetFeeEditor = () => {
    setEditingFeeId(null)
    setFeeDraft({ companyId: '', period: agencyPeriodLabel, receivableAmount: '', receivedAmount: '0', invoiceStatus: 'pending', paymentStatus: 'pending', collector: '', lastFollowUp: '', status: 'pending' })
  }

  const openFeeEditor = async (row?: AgencyRow) => {
    if (companies.length === 0) await fetchCompanies()
    if (!row) {
      resetFeeEditor()
      setShowFeeDialog(true)
      return
    }
    setEditingFeeId(row.id)
    setFeeDraft({
      companyId: row.values.companyId || '',
      period: row.values.period || agencyPeriodLabel,
      receivableAmount: row.values.receivableAmount || row.values.amount || '0',
      receivedAmount: row.values.receivedAmount || row.values.received || '0',
      invoiceStatus: row.values.invoiceStatus || 'pending',
      paymentStatus: row.values.paymentStatus || 'pending',
      collector: row.values.collector === '-' ? '' : row.values.collector || row.values.owner || '',
      lastFollowUp: row.values.lastFollowUp === '-' ? '' : row.values.lastFollowUp || row.values.followUp || '',
      status: row.values.recordStatus || 'pending',
    })
    setShowFeeDialog(true)
  }

  const resetCollaborationEditor = () => {
    setEditingCollaborationId(null)
    setCollaborationDraft({ companyId: '', todoTitle: '', materialType: '', customerContact: '', replyStatus: 'pending', owner: '', reminderCount: '0', lastContactAt: '', status: 'pending' })
  }

  const openCollaborationEditor = async (row?: AgencyRow) => {
    if (companies.length === 0) await fetchCompanies()
    if (!row) {
      resetCollaborationEditor()
      setShowCollaborationDialog(true)
      return
    }
    setEditingCollaborationId(row.id)
    setCollaborationDraft({
      companyId: row.values.companyId || '',
      todoTitle: row.values.todo || '',
      materialType: row.values.materialType || (row.values.material === '-' ? '' : row.values.material || ''),
      customerContact: row.values.customerContact || (row.values.contact === '-' ? '' : row.values.contact || ''),
      replyStatus: row.values.replyStatus || 'pending',
      owner: row.values.owner === '-' ? '' : row.values.owner || '',
      reminderCount: row.values.reminderCount || '0',
      lastContactAt: row.values.lastContactAt === '-' ? '' : row.values.lastContactAt || row.values.lastContact || '',
      status: row.values.recordStatus || 'pending',
    })
    setShowCollaborationDialog(true)
  }

  const resetAuthorizationEditor = () => {
    setEditingAuthorization(false)
    setAuthorizationDraft({ companyId: '', adapterType: 'tax', adapterCode: '', region: '', authStatus: 'pending', accountMask: '', loginIdentity: '', capabilityScope: '', expiresAt: '', riskMessage: '' })
  }

  const openAuthorizationEditor = async (row?: AgencyRow) => {
    if (companies.length === 0) await fetchCompanies()
    if (!row) {
      resetAuthorizationEditor()
      setAuthorizationDraft((draft) => ({ ...draft, adapterType: agencyAuthorizationAdapterType(activeTab) || 'tax' }))
      setShowAuthorizationDialog(true)
      return
    }
    setEditingAuthorization(true)
    setAuthorizationDraft({
      companyId: row.values.companyId || '',
      adapterType: row.values.adapterType || 'tax',
      adapterCode: row.values.adapterCode || row.values.method || '',
      region: row.values.region || '',
      authStatus: row.values.authStatus || 'pending',
      accountMask: row.values.accountMask || (row.values.taxNo === '-' ? '' : row.values.taxNo || ''),
      loginIdentity: row.values.loginIdentity || (row.values.loginPerson === '-' ? '' : row.values.loginPerson || ''),
      capabilityScope: row.values.capabilityScope || (row.values.identity === '-' ? '' : row.values.identity || ''),
      expiresAt: row.values.expiresAt === '-' ? '' : row.values.expiresAt || '',
      riskMessage: row.values.riskMessage === '无' ? '' : row.values.riskMessage || '',
    })
    setShowAuthorizationDialog(true)
  }

  const openAutomationReview = (row: AgencyRow) => {
    setAutomationReviewDraft({
      id: row.id,
      companyId: row.values.companyId || 'browser-preview',
      taskName: row.values.name || row.id,
      status: row.values.jobStatus || 'reviewing',
      confidence: row.values.confidenceValue || '',
      riskLevel: row.values.riskLevel || 'normal',
      reviewer: row.values.reviewer || 'admin',
      resultSummary: row.values.resultSummary || row.values.result || '',
    })
    setShowAutomationReviewDialog(true)
  }

  const handleProcessRow = async (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    if (kind === 'batchOps') {
      if (row.status !== '待处理') {
        setOperationNotice(`${object} 当前不在待预检状态，请按任务状态继续处理。`)
        return
      }
      const response = await agencyApi.runBatchTaskPrecheck({ id: row.id, operator: 'admin' })
      if (!response.success || !response.data) {
        setOperationNotice(response.error || '批量任务本地预检失败。')
        return
      }
      writeAgencyAudit('执行批量预检', `${pageConfig.title}-${object}`, response.data.requiresApproval ? '高' : '中', response.data.requiresApproval ? '待审批' : '成功')
      await loadRemoteRows()
      setOperationNotice(`${object} 本地预检完成，不会登录或调用税局、银行等外部系统；${response.data.requiresApproval ? '当前任务已进入人工审批队列。' : '后续采集仍需人工发起。'}`)
      return
    }

    if (kind === 'serviceContracts') {
      if (activeTab === '服务合同' || activeTab === '归档记录') {
        await openContractEditor(row)
        return
      }
      if (activeTab === '收费管理') {
        await openFeeEditor(row)
        return
      }
      if (activeTab === '客户协同') {
        await openCollaborationEditor(row)
        return
      }
      setOperationNotice('服务套餐为合同汇总视图，请在服务合同或归档记录中编辑具体合同。')
      return
    }

    if (kind === 'invoiceManagement') {
      await openFeeEditor(row)
      return
    }

    if (kind === 'authorizationCenter') {
      await openAuthorizationEditor(row)
      return
    }

    if (kind === 'automation') {
      openAutomationReview(row)
      return
    }

    if (kind === 'healthCheck') {
      writeAgencyAudit('查看风险整改上下文', `${pageConfig.title}-${object}`, '高', '待审批')
      setDetailRow(row)
      setOperationNotice(`${object} 的风险依据已展开。整改需要进入对应客户账套处理；机构体检页不直接修改发票、凭证或税表。`)
      return
    }

    if (kind === 'clients' || kind === 'downloadCenter' || kind === 'dataStats') {
      writeAgencyAudit('查看机构明细', `${pageConfig.title}-${object}`)
      setDetailRow(row)
      setOperationNotice(kind === 'clients'
        ? `${object} 的机构级进度已展开；需进入该客户账套处理具体业务。`
        : `${object} 的本机记录与统计口径已展开。`)
      return
    }

    const isRisky = row.status === '异常'
    writeAgencyAudit('处理行任务', `${pageConfig.title}-${object}`, isRisky ? '高' : '中', isRisky ? '待审批' : '成功')
    setOperationNotice(`${object} 已记录到机构审计日志。`)
  }

  const handleReviewBatchTask = async (row: AgencyRow, decision: 'approved' | 'rejected') => {
    const object = rowObjectLabel(row)
    if (row.status !== '待确认' || row.values.approval !== '需审批') {
      setOperationNotice(`${object} 当前不在待审批状态。`)
      return
    }

    const action = decision === 'approved' ? '通过预检' : '驳回预检'
    const response = await agencyApi.reviewBatchTask({ id: row.id, decision, operator: 'admin' })
    if (!response.success || !response.data) {
      setOperationNotice(response.error || `${action}失败。`)
      return
    }
    writeAgencyAudit(action, `${pageConfig.title}-${object}`, '高', decision === 'approved' ? '成功' : '失败')
    await loadRemoteRows()
    setOperationNotice(
      decision === 'approved'
        ? `${object} 的本地预检已通过；仍未登录或调用税局、银行等外部系统，后续动作需人工发起。`
        : `${object} 的本地预检已驳回并阻断后续操作；未调用任何外部系统。`,
    )
  }

  const handleEnterAccount = async (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    writeAgencyAudit('进入账套', `${pageConfig.title}-${object}`)
    if (isTauri && kind === 'clients') {
      selectCompany(row.id)
      await fetchPeriods(row.id)
      await fetchVoucherWords(row.id)
    }
    navigate('/dashboard')
  }

  const handleRefresh = () => {
    writeAgencyAudit('刷新列表', `${pageConfig.title}-${activeTab}`)
    void loadRemoteRows()
  }

  const handleImport = () => {
    if (kind === 'clients') {
      writeAgencyAudit('导入企业档案', `${pageConfig.title}-${activeTab}`, '中', '待审批')
      navigate('/?importCompanies=1')
      return
    }
    importFileRef.current?.click()
  }

  const handleAgencyImportFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    try {
      const jobs = await Promise.all(files.map((file) => recordLocalImportJob({
        companyId: 'agency-workspace',
        period: agencyPeriodLabel,
        moduleName: `机构-${pageConfig.title}`,
        operation: toolbarMeta.importLabel || '导入资料',
        operator: 'admin',
        file,
      })))
      const completed = jobs.filter(Boolean).length
      const parsed = jobs.filter((job): job is NonNullable<typeof job> => Boolean(job))
      const preview = parsed[0]
      files.forEach((file) => writeAgencyAudit(toolbarMeta.importLabel || '导入资料', `${pageConfig.title}-${file.name}`, '中', '待审批'))
      setOperationNotice(
        `已登记 ${completed} 个机构导入批次${preview ? `；首个文件识别 ${preview.rowCount ?? 0} 条候选行、${preview.columnPreview.length} 个字段` : ''}。当前仅保存文件校验值、结构预览和待确认状态，不会直接改写客户账套。`,
      )
    } catch (error) {
      writeAgencyAudit(toolbarMeta.importLabel || '导入资料', `${pageConfig.title}-导入批次`, '中', '失败')
      setOperationNotice(`登记机构导入批次失败：${String(error)}`)
    } finally {
      event.target.value = ''
    }
  }

  const handlePrimaryAction = async () => {
    if (kind === 'serviceContracts' && activeTab === '服务合同') {
      await openContractEditor()
      return
    }
    if (kind === 'authorizationCenter') {
      await openAuthorizationEditor()
      return
    }
    if (kind === 'serviceContracts' && activeTab === '收费管理') {
      await openFeeEditor()
      return
    }
    if (kind === 'serviceContracts' && activeTab === '客户协同') {
      await openCollaborationEditor()
      return
    }
    if (kind === 'clients') {
      writeAgencyAudit('打开新增企业表单', `${pageConfig.title}-${activeTab}`)
      navigate('/?createCompany=1')
      return
    }

    if (kind === 'dataStats') {
      writeAgencyAudit('查看统计口径', `${pageConfig.title}-${activeTab}`)
      setShowDataStatsScopeDialog(true)
      return
    }

    if (kind === 'healthCheck') {
      writeAgencyAudit('开始体检', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在重新扫描本地未匹配发票、税务申报风险和阻断交付任务。')
      return
    }

    if (kind === 'automation') {
      writeAgencyAudit('刷新自动化任务', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在读取各客户账套本地保存的自动化任务队列。')
      return
    }

    if (kind === 'invoiceManagement') {
      writeAgencyAudit('刷新开票队列', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在读取本地服务费收费记录对应的开票状态。')
      return
    }

    if (kind === 'serviceContracts' && activeTab === '归档记录') {
      writeAgencyAudit('刷新归档记录', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在读取本地服务合同的归档状态和最近更新时间。')
      return
    }

    if (kind === 'serviceContracts' && activeTab === '服务套餐') {
      writeAgencyAudit('刷新套餐汇总', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在按本地服务合同汇总套餐覆盖客户、合同数量和月服务费。')
      return
    }

    if (kind === 'downloadCenter') {
      writeAgencyAudit('刷新文件清单', `${pageConfig.title}-${activeTab}`)
      setOperationNotice('已刷新本机导出文件记录；过期文件需回到原模块重新生成。')
      return
    }

    if (kind === 'batchOps') {
      setShowBatchTaskDialog(true)
      return
    }

    setOperationNotice('当前页面仅提供已保存数据的查询、筛选和导出。')
  }

  const handleCreateBatchTasks = async () => {
    if (selectedBatchTaskTypes.length === 0) {
      setOperationNotice('请选择至少一个批量预检任务。')
      return
    }

    const response = await agencyApi.createBatchTasks({ period: agencyPeriodLabel, taskTypes: selectedBatchTaskTypes, operator: 'admin' })
    if (!response.success) {
      setOperationNotice(response.error || '批量预检任务创建失败。')
      return
    }
    await loadRemoteRows()
    setShowBatchTaskDialog(false)
    const created = response.data?.created ?? 0
    const skipped = response.data?.skipped ?? 0
    writeAgencyAudit('新建批量任务', `${selectedBatchTaskTypes.length} 类任务 / 新建${created} / 跳过${skipped}`, '高', '待审批')
    setOperationNotice(`已写入本地批量预检队列：新建 ${created} 个，跳过 ${skipped} 个未完成同类任务。采集、结账、申报和回执归档均需后续人工确认，不会自动提交税局或银行。`)
  }

  const handleExportExcel = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-${agencyPeriodLabel}.xlsx`
    const scope = `${agencyPeriodLabel}/${activeTab}/${query.trim() || '全部'}`
    try {
      await exportRowsToXlsx({
        sheetRows: buildAgencySheetRows(pageConfig, filteredRows, exportedAt, activeTab, query.trim(), agencyPeriodLabel),
        columnWidths: [{ wch: 18 }, { wch: 12 }, ...pageConfig.columns.map((column) => ({ wch: Math.max(14, column.label.length * 3) }))],
        sheetName: pageConfig.title,
        fileName,
      })
      recordExportJob({
        fileName,
        moduleName: `机构-${pageConfig.title}`,
        format: 'Excel',
        scope,
        templateKind: 'agency',
        rowCount: filteredRows.length,
      })
      writeAgencyAudit('导出Excel', fileName)
    } catch (error) {
      setOperationNotice(`Excel 导出失败：${String(error)}`)
      writeAgencyAudit('导出Excel', fileName, '普通', '失败')
    }
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-${agencyPeriodLabel}-print`
    const scope = `${agencyPeriodLabel}/${activeTab}/${query.trim() || '全部'}`
    const html = buildAgencyPrintHtml(pageConfig, filteredRows, exportedAt, activeTab, query.trim(), agencyPeriodLabel)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setOperationNotice('浏览器阻止了打印窗口，请允许本应用打开打印预览后重试。')
      writeAgencyAudit('打印预览失败', fileName)
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    recordExportJob({
      fileName,
      moduleName: `机构-${pageConfig.title}`,
      format: '打印预览',
      scope,
      templateKind: 'agency',
      rowCount: filteredRows.length,
    })
    writeAgencyAudit('打印', fileName)
  }

  const handleExportPdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-${agencyPeriodLabel}.pdf`
    const scope = `${agencyPeriodLabel}/${activeTab}/${query.trim() || '全部'}`
    try {
      await exportHtmlToPdf({
        html: buildAgencyPrintHtml(pageConfig, filteredRows, exportedAt, activeTab, query.trim(), agencyPeriodLabel),
        fileName,
        pageTitle: `${pageConfig.title} ${agencyPeriodLabel}`,
      })
      recordExportJob({
        fileName,
        moduleName: `机构-${pageConfig.title}`,
        format: 'PDF',
        scope,
        templateKind: 'agency',
        rowCount: filteredRows.length,
      })
      writeAgencyAudit('导出PDF', fileName)
    } catch (error) {
      setOperationNotice(`PDF 导出失败：${String(error)}`)
      writeAgencyAudit('导出PDF', fileName, '普通', '失败')
    }
  }

  const handleCreateContract = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = editingContractId
      ? await agencyApi.updateServiceContract({
          id: editingContractId,
          companyId: contractDraft.companyId,
          contractNo: contractDraft.contractNo,
          servicePackage: contractDraft.servicePackage,
          serviceStart: contractDraft.serviceStart,
          serviceEnd: contractDraft.serviceEnd,
          monthlyFee: Number(contractDraft.monthlyFee || 0),
          renewalStatus: contractDraft.renewalStatus,
          archiveStatus: contractDraft.archiveStatus,
          status: contractDraft.status,
          owner: contractDraft.owner || undefined,
        })
      : await agencyApi.createServiceContract({
          companyId: contractDraft.companyId,
          contractNo: contractDraft.contractNo,
          servicePackage: contractDraft.servicePackage,
          serviceStart: contractDraft.serviceStart,
          serviceEnd: contractDraft.serviceEnd,
          monthlyFee: Number(contractDraft.monthlyFee || 0),
          owner: contractDraft.owner || undefined,
        })
    if (!result.success || !result.data) {
      setOperationNotice(`${editingContractId ? '更新' : '新增'}合同失败：${result.error || '未知错误'}`)
      return
    }
    setShowContractDialog(false)
    resetContractEditor()
    setOperationNotice(editingContractId ? '服务合同已更新，续费和归档状态已同步到机构台账。' : '服务合同已保存，收费、协同与归档标签将读取该合同记录。')
    void loadRemoteRows()
  }

  const handleCreateFeeCollection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = editingFeeId
      ? await agencyApi.updateFeeCollection({
          id: editingFeeId,
          companyId: feeDraft.companyId,
          period: feeDraft.period,
          receivableAmount: Number(feeDraft.receivableAmount),
          receivedAmount: Number(feeDraft.receivedAmount),
          invoiceStatus: feeDraft.invoiceStatus,
          paymentStatus: feeDraft.paymentStatus,
          collector: feeDraft.collector || undefined,
          lastFollowUp: feeDraft.lastFollowUp || undefined,
          status: feeDraft.status,
        })
      : await agencyApi.createFeeCollection({
          companyId: feeDraft.companyId,
          period: feeDraft.period,
          receivableAmount: Number(feeDraft.receivableAmount),
          receivedAmount: Number(feeDraft.receivedAmount),
          invoiceStatus: feeDraft.invoiceStatus,
          paymentStatus: feeDraft.paymentStatus,
          collector: feeDraft.collector || undefined,
        })
    if (!result.success || !result.data) {
      setOperationNotice(`${editingFeeId ? '更新' : '新增'}收费记录失败：${result.error || '未知错误'}`)
      return
    }
    setShowFeeDialog(false)
    resetFeeEditor()
    setOperationNotice(editingFeeId ? '收费记录已更新，应收、实收、欠费、开票与跟进状态已同步。' : '收费记录已保存到本地台账，并同步更新应收、实收和欠费汇总。')
    void loadRemoteRows()
  }

  const handleCreateCollaborationItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = editingCollaborationId
      ? await agencyApi.updateCollaborationItem({
          id: editingCollaborationId,
          companyId: collaborationDraft.companyId,
          todoTitle: collaborationDraft.todoTitle,
          materialType: collaborationDraft.materialType || undefined,
          customerContact: collaborationDraft.customerContact || undefined,
          replyStatus: collaborationDraft.replyStatus,
          owner: collaborationDraft.owner || undefined,
          reminderCount: Number(collaborationDraft.reminderCount || 0),
          lastContactAt: collaborationDraft.lastContactAt || undefined,
          status: collaborationDraft.status,
        })
      : await agencyApi.createCollaborationItem({
          companyId: collaborationDraft.companyId,
          todoTitle: collaborationDraft.todoTitle,
          materialType: collaborationDraft.materialType || undefined,
          customerContact: collaborationDraft.customerContact || undefined,
          replyStatus: collaborationDraft.replyStatus,
          owner: collaborationDraft.owner || undefined,
        })
    if (!result.success || !result.data) {
      setOperationNotice(`${editingCollaborationId ? '更新' : '新增'}协同事项失败：${result.error || '未知错误'}`)
      return
    }
    setShowCollaborationDialog(false)
    resetCollaborationEditor()
    setOperationNotice(editingCollaborationId ? '协同事项已更新，催办次数、答复和跟进状态已同步。' : '协同事项已保存到本地交付清单，可继续在当前机构层集中催办和跟进。')
    void loadRemoteRows()
  }

  const handleSaveAutomationReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const confidence = automationReviewDraft.confidence.trim() === '' ? undefined : Number(automationReviewDraft.confidence)
    if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      setOperationNotice('AI 置信度应填写 0 到 1 之间的数值。')
      return
    }
    const result = await automationApi.updateAutomationJobStatus({
      id: automationReviewDraft.id,
      companyId: automationReviewDraft.companyId,
      status: automationReviewDraft.status,
      confidence,
      riskLevel: automationReviewDraft.riskLevel,
      reviewer: automationReviewDraft.reviewer || undefined,
      resultSummary: automationReviewDraft.resultSummary || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`保存任务复核失败：${result.error || '未知错误'}`)
      return
    }
    writeAgencyAudit('保存自动化复核', `${automationReviewDraft.taskName}｜${automationReviewDraft.status}`, automationReviewDraft.riskLevel === 'high' ? '高' : '中', automationReviewDraft.status === 'failed' ? '失败' : '成功')
    setShowAutomationReviewDialog(false)
    setOperationNotice('自动化任务复核已保存到本地队列；凭证生成、结账和税务申报仍需进入对应模块人工确认。')
    void loadRemoteRows()
  }

  const handleCreateAuthorization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await automationApi.upsertAdapterAuthorization({
      companyId: authorizationDraft.companyId,
      adapterType: authorizationDraft.adapterType,
      adapterCode: authorizationDraft.adapterCode,
      region: authorizationDraft.region || undefined,
      authStatus: authorizationDraft.authStatus,
      accountMask: authorizationDraft.accountMask || undefined,
      loginIdentity: authorizationDraft.loginIdentity || undefined,
      capabilityScope: authorizationDraft.capabilityScope || undefined,
      expiresAt: authorizationDraft.expiresAt || undefined,
      riskMessage: authorizationDraft.riskMessage || undefined,
    })
    if (!result.success || !result.data) {
      setOperationNotice(`${editingAuthorization ? '更新' : '保存'}授权记录失败：${result.error || '未知错误'}`)
      return
    }
    setShowAuthorizationDialog(false)
    resetAuthorizationEditor()
    setOperationNotice(editingAuthorization ? '授权记录已更新；批量任务仍会先进行授权预检，不会自动登录外部系统。' : '授权状态已保存到本地台账；批量任务仍会先进行授权预检，不会自动登录外部系统。')
    void loadRemoteRows()
  }

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <input ref={importFileRef} type="file" multiple accept=".xlsx,.csv,.pdf,.ofd,.zip,.jpg,.jpeg,.png" className="hidden" onChange={(event) => void handleAgencyImportFiles(event)} />
      {showDataStatsScopeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="统计口径与范围">
          <div className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">统计口径与范围</h2>
                <p className="mt-1 text-xs text-slate-500">当前账期 {agencyPeriodLabel}，视图“{activeTab}”。仅统计本地已保存的机构服务与交付记录。</p>
              </div>
              <button type="button" onClick={() => setShowDataStatsScopeDialog(false)} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {summary.map((item) => (
                <div key={item.label} className="border border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className={cn('mt-1 text-lg font-semibold tabular-nums', toneClass(item.tone))}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              {config.queue.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowDataStatsScopeDialog(false)} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">确认</button>
            </div>
          </div>
        </div>
      )}
      {showAgencyFilterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="机构筛选条件">
          <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">机构筛选条件</h2>
                <p className="mt-1 text-xs text-slate-500">按当前模块、账期和视图内已有记录状态筛选，不修改任何客户账套数据。</p>
              </div>
              <button type="button" onClick={() => setShowAgencyFilterDialog(false)} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="p-4">
              <label className="space-y-1 text-xs text-slate-600">
                <span>记录状态</span>
                <select value={statusFilterDraft} onChange={(event) => setStatusFilterDraft(event.target.value)} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  {availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setStatusFilterDraft('全部')} className="h-8 text-xs text-[#1f65a7] hover:underline">重置</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAgencyFilterDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
                <button type="button" onClick={applyAgencyStatusFilter} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">应用筛选</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showContractDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleCreateContract} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingContractId ? '编辑服务合同' : '新增服务合同'}</h2>
                <p className="mt-1 text-xs text-slate-500">服务合同是机构服务交付台账，收费、协同、续费和归档均引用同一份合同记录。</p>
              </div>
              <button type="button" onClick={() => { setShowContractDialog(false); resetContractEditor() }} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户账套</span>
                <select required value={contractDraft.companyId} onChange={(event) => setContractDraft((draft) => ({ ...draft, companyId: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择客户账套</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.code} | {company.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>合同编号</span>
                <input required value={contractDraft.contractNo} onChange={(event) => setContractDraft((draft) => ({ ...draft, contractNo: event.target.value }))} placeholder="例如：HT-2026-0001" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>服务套餐</span>
                <input required value={contractDraft.servicePackage} onChange={(event) => setContractDraft((draft) => ({ ...draft, servicePackage: event.target.value }))} placeholder="例如：小规模纳税人标准代账" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>月服务费</span>
                <input required min="0" step="0.01" type="number" value={contractDraft.monthlyFee} onChange={(event) => setContractDraft((draft) => ({ ...draft, monthlyFee: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>服务开始</span>
                <input required type="date" value={contractDraft.serviceStart} onChange={(event) => setContractDraft((draft) => ({ ...draft, serviceStart: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>服务结束</span>
                <input required type="date" value={contractDraft.serviceEnd} onChange={(event) => setContractDraft((draft) => ({ ...draft, serviceEnd: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>负责人</span>
                <input value={contractDraft.owner} onChange={(event) => setContractDraft((draft) => ({ ...draft, owner: event.target.value }))} placeholder="例如：李会计" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              {editingContractId && <>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>续费状态</span>
                  <select value={contractDraft.renewalStatus} onChange={(event) => setContractDraft((draft) => ({ ...draft, renewalStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="normal">正常</option><option value="expiring">临近续费</option><option value="overdue">逾期</option><option value="renewed">已续签</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>归档状态</span>
                  <select value={contractDraft.archiveStatus} onChange={(event) => setContractDraft((draft) => ({ ...draft, archiveStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="pending">待归档</option><option value="archived">已归档</option><option value="missing">缺少附件</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                  <span>合同状态</span>
                  <select value={contractDraft.status} onChange={(event) => setContractDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="active">履约中</option><option value="completed">已完成</option><option value="suspended">已暂停</option><option value="overdue">异常逾期</option>
                  </select>
                </label>
              </>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => { setShowContractDialog(false); resetContractEditor() }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingContractId ? '保存合同变更' : '保存服务合同'}</button>
            </div>
          </form>
        </div>
      )}
      {showFeeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleCreateFeeCollection} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingFeeId ? '编辑收费记录' : '新增收费记录'}</h2>
                <p className="mt-1 text-xs text-slate-500">仅登记代理服务应收与实收，不代替客户账套的经营收入和发票。</p>
              </div>
              <button type="button" onClick={() => { setShowFeeDialog(false); resetFeeEditor() }} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户账套</span>
                <select required value={feeDraft.companyId} onChange={(event) => setFeeDraft((draft) => ({ ...draft, companyId: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择客户账套</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.code} | {company.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>收费账期</span>
                <input required type="month" value={feeDraft.period} onChange={(event) => setFeeDraft((draft) => ({ ...draft, period: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>应收金额</span>
                <input required min="0" step="0.01" type="number" value={feeDraft.receivableAmount} onChange={(event) => setFeeDraft((draft) => ({ ...draft, receivableAmount: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>实收金额</span>
                <input required min="0" step="0.01" type="number" value={feeDraft.receivedAmount} onChange={(event) => setFeeDraft((draft) => ({ ...draft, receivedAmount: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>服务费开票</span>
                <select value={feeDraft.invoiceStatus} onChange={(event) => setFeeDraft((draft) => ({ ...draft, invoiceStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="pending">待开票</option>
                  <option value="issued">已开票</option>
                  <option value="void">红冲/作废</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>收费状态</span>
                <select value={feeDraft.paymentStatus} onChange={(event) => setFeeDraft((draft) => ({ ...draft, paymentStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="pending">待收款</option>
                  <option value="paid">已收款</option>
                  <option value="overdue">逾期欠费</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>收款负责人</span>
                <input value={feeDraft.collector} onChange={(event) => setFeeDraft((draft) => ({ ...draft, collector: event.target.value }))} placeholder="例如：李会计" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              {editingFeeId && <>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>最近跟进</span>
                  <input value={feeDraft.lastFollowUp} onChange={(event) => setFeeDraft((draft) => ({ ...draft, lastFollowUp: event.target.value }))} placeholder="例如：2026-07-30 已电话跟进" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>台账状态</span>
                  <select value={feeDraft.status} onChange={(event) => setFeeDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="pending">待处理</option><option value="completed">已完成</option><option value="overdue">逾期</option>
                  </select>
                </label>
              </>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => { setShowFeeDialog(false); resetFeeEditor() }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingFeeId ? '保存收费变更' : '保存收费记录'}</button>
            </div>
          </form>
        </div>
      )}
      {showCollaborationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleCreateCollaborationItem} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingCollaborationId ? '编辑协同事项' : '新增协同事项'}</h2>
                <p className="mt-1 text-xs text-slate-500">用于机构层跟进客户资料和答复；资料入账后在对应账套继续处理。</p>
              </div>
              <button type="button" onClick={() => { setShowCollaborationDialog(false); resetCollaborationEditor() }} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户账套</span>
                <select required value={collaborationDraft.companyId} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, companyId: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择客户账套</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.code} | {company.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>协同事项</span>
                <input required value={collaborationDraft.todoTitle} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, todoTitle: event.target.value }))} placeholder="例如：补充管理费用合同" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>资料类型</span>
                <input value={collaborationDraft.materialType} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, materialType: event.target.value }))} placeholder="例如：合同附件" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户联系人</span>
                <input value={collaborationDraft.customerContact} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, customerContact: event.target.value }))} placeholder="例如：王女士" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户答复</span>
                <select value={collaborationDraft.replyStatus} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, replyStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="pending">待客户答复</option>
                  <option value="replied">客户已答复</option>
                  <option value="overdue">已超时</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>负责人</span>
                <input value={collaborationDraft.owner} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, owner: event.target.value }))} placeholder="例如：李会计" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              {editingCollaborationId && <>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>催办次数</span>
                  <input min="0" type="number" value={collaborationDraft.reminderCount} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, reminderCount: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>最近联系</span>
                  <input value={collaborationDraft.lastContactAt} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, lastContactAt: event.target.value }))} placeholder="例如：2026-07-30 14:30" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
                </label>
                <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                  <span>事项状态</span>
                  <select value={collaborationDraft.status} onChange={(event) => setCollaborationDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                    <option value="pending">待处理</option><option value="completed">已完成</option><option value="overdue">已超时</option>
                  </select>
                </label>
              </>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => { setShowCollaborationDialog(false); resetCollaborationEditor() }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingCollaborationId ? '保存协同变更' : '保存协同事项'}</button>
            </div>
          </form>
        </div>
      )}
      {showAutomationReviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleSaveAutomationReview} className="w-full max-w-xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">复核自动化任务</h2>
                <p className="mt-1 text-xs text-slate-500">{automationReviewDraft.taskName}。复核仅更新本地任务结论，不自动入账、结账或提交申报。</p>
              </div>
              <button type="button" onClick={() => setShowAutomationReviewDialog(false)} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>复核状态</span>
                <select value={automationReviewDraft.status} onChange={(event) => setAutomationReviewDraft((draft) => ({ ...draft, status: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="queued">待处理</option><option value="reviewing">复核中</option><option value="completed">已完成</option><option value="failed">已驳回/失败</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>AI 置信度</span>
                <input min="0" max="1" step="0.01" type="number" value={automationReviewDraft.confidence} onChange={(event) => setAutomationReviewDraft((draft) => ({ ...draft, confidence: event.target.value }))} placeholder="例如：0.92" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>风险级别</span>
                <select value={automationReviewDraft.riskLevel} onChange={(event) => setAutomationReviewDraft((draft) => ({ ...draft, riskLevel: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="normal">正常</option><option value="medium">中风险</option><option value="high">高风险</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>复核人</span>
                <input value={automationReviewDraft.reviewer} onChange={(event) => setAutomationReviewDraft((draft) => ({ ...draft, reviewer: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>复核结论</span>
                <textarea rows={4} value={automationReviewDraft.resultSummary} onChange={(event) => setAutomationReviewDraft((draft) => ({ ...draft, resultSummary: event.target.value }))} placeholder="记录识别依据、人工调整和下一步处理意见" className="w-full resize-y border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowAutomationReviewDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">保存复核结论</button>
            </div>
          </form>
        </div>
      )}
      {showAuthorizationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={handleCreateAuthorization} className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingAuthorization ? '编辑授权记录' : '新增授权记录'}</h2>
                <p className="mt-1 text-xs text-slate-500">仅维护授权元数据和掩码账号，不录入密码、验证码、Cookie 或税务局会话信息。</p>
              </div>
              <button type="button" onClick={() => { setShowAuthorizationDialog(false); resetAuthorizationEditor() }} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>客户账套</span>
                <select required value={authorizationDraft.companyId} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, companyId: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="">请选择客户账套</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.code} | {company.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>授权类型</span>
                <select value={authorizationDraft.adapterType} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, adapterType: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="tax">电子税务局</option>
                  <option value="individual_tax">自然人税收</option>
                  <option value="bank">银行</option>
                  <option value="industrial_commercial">工商</option>
                  <option value="invoice_pool">票池</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>授权标识</span>
                <input required value={authorizationDraft.adapterCode} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, adapterCode: event.target.value }))} placeholder="例如：tax-adapter-shanghai" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>地区</span>
                <input value={authorizationDraft.region} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, region: event.target.value }))} placeholder="例如：上海市" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>授权状态</span>
                <select value={authorizationDraft.authStatus} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, authStatus: event.target.value }))} className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900">
                  <option value="pending">待确认</option>
                  <option value="valid">正常</option>
                  <option value="expired">已过期</option>
                  <option value="invalid">授权异常</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>到期日期</span>
                <input type="date" value={authorizationDraft.expiresAt} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, expiresAt: event.target.value }))} className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>掩码账号</span>
                <input value={authorizationDraft.accountMask} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, accountMask: event.target.value }))} placeholder="仅可填写掩码，如 9131****1234" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>登录身份</span>
                <input value={authorizationDraft.loginIdentity} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, loginIdentity: event.target.value }))} placeholder="例如：办税员" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>授权范围</span>
                <input value={authorizationDraft.capabilityScope} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, capabilityScope: event.target.value }))} placeholder="例如：发票采集、申报取数" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
                <span>风险说明</span>
                <input value={authorizationDraft.riskMessage} onChange={(event) => setAuthorizationDraft((draft) => ({ ...draft, riskMessage: event.target.value }))} placeholder="可选，例如：等待客户确认授权范围" className="h-9 w-full border border-slate-300 px-2 text-sm text-slate-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => { setShowAuthorizationDialog(false); resetAuthorizationEditor() }} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="submit" className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">{editingAuthorization ? '保存授权变更' : '保存授权记录'}</button>
            </div>
          </form>
        </div>
      )}
      {showBatchTaskDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="选择批量预检任务">
          <div className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">选择批量预检任务</h2>
                <p className="mt-1 text-xs text-slate-500">按当前账期 {agencyPeriodLabel} 创建本地预检队列。未完成的同类型任务不会重复入队。</p>
              </div>
              <button type="button" onClick={() => setShowBatchTaskDialog(false)} className="text-sm text-slate-400 hover:text-slate-700">关闭</button>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">已选择 {selectedBatchTaskTypes.length} / {agencyBatchTaskOptions.length} 类任务</span>
                <button type="button" onClick={() => setSelectedBatchTaskTypes((selected) => selected.length === agencyBatchTaskOptions.length ? [] : agencyBatchTaskOptions.map((option) => option.id))} className="text-[#1f65a7] hover:underline">
                  {selectedBatchTaskTypes.length === agencyBatchTaskOptions.length ? '清空选择' : '全选任务'}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {agencyBatchTaskOptions.map((option) => {
                  const checked = selectedBatchTaskTypes.includes(option.id)
                  return (
                    <label key={option.id} className={cn('flex cursor-pointer gap-3 border p-3', checked ? 'border-[#1f65a7] bg-blue-50' : 'border-slate-200 bg-white')}>
                      <input
                        type="checkbox"
                        aria-label={`选择 ${option.label}`}
                        checked={checked}
                        onChange={() => setSelectedBatchTaskTypes((selected) => checked ? selected.filter((taskType) => taskType !== option.id) : [...selected, option.id])}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                          {option.label}
                          {option.requiresApproval && <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">需审批</span>}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">范围：{option.scope}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{option.detail}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="border-l-2 border-[#1f65a7] bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-700">安全边界：创建和执行的都是本地预检任务。不会登录电子税务局、银行或自然人税收系统，也不会自动报税、扣款、结账或生成入账凭证。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setShowBatchTaskDialog(false)} className="h-8 border border-slate-300 px-3 text-xs text-slate-700">取消</button>
              <button type="button" disabled={selectedBatchTaskTypes.length === 0} onClick={() => void handleCreateBatchTasks()} className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:bg-slate-400">创建本地预检任务</button>
            </div>
          </div>
        </div>
      )}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={detailMeta.title}>
          <div className="w-full max-w-2xl border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{detailMeta.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{pageConfig.title} / {rowObjectLabel(detailRow)}</p>
              </div>
              <button type="button" onClick={() => setDetailRow(null)} className="text-xs text-slate-500 hover:text-slate-900">关闭</button>
            </div>
            <div className="grid gap-x-5 gap-y-3 p-4 sm:grid-cols-2">
              <div className="border-b border-slate-100 pb-2 text-xs"><span className="text-slate-500">处理状态</span><div className="mt-1"><StatusBadge value={detailRow.status} /></div></div>
              {pageConfig.columns.map((column) => (
                <div key={column.key} className="min-w-0 border-b border-slate-100 pb-2 text-xs">
                  <div className="text-slate-500">{column.label}</div>
                  <div className="mt-1 break-words text-slate-800">{detailRow.values[column.key] || '-'}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{detailMeta.boundary}</div>
          </div>
        </div>
      )}
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-1.5">
          <div className="min-w-0">
            <h1 className="text-base font-semibold">{pageConfig.title}</h1>
            <p className="text-xs text-slate-500">{pageConfig.description}</p>
            {usesAgencyPreviewRows && <p className="mt-1 text-xs text-sky-700">浏览器本地台账：列表与汇总读取本机保存的预览记录，可在当前模块继续维护。</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ToolButton icon={<RefreshCw className={cn('h-3.5 w-3.5', isLoadingRows && 'animate-spin')} />} label={toolbarMeta.refreshLabel} onClick={handleRefresh} />
            {toolbarMeta.importLabel && <ToolButton icon={<Upload className="h-3.5 w-3.5" />} label={toolbarMeta.importLabel} onClick={handleImport} />}
            <ToolButton icon={<Download className="h-3.5 w-3.5" />} label={toolbarMeta.excelLabel} onClick={handleExportExcel} />
            <ToolButton icon={<FileText className="h-3.5 w-3.5" />} label={toolbarMeta.pdfLabel} onClick={handleExportPdf} />
            <ToolButton icon={<Printer className="h-3.5 w-3.5" />} label="打印" title={toolbarMeta.printLabel} onClick={handlePrint} />
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
            >
              <Play className="h-3.5 w-3.5" />
              {pageConfig.primaryAction}
            </button>
          </div>
        </div>
        {operationNotice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
            {operationNotice}
          </div>
        )}

        <div className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8fbff] px-3">
          {config.tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'h-7 rounded px-3 text-xs',
                activeTab === tab ? 'bg-[#1f65a7] text-white' : 'text-slate-600 hover:bg-white hover:text-[#1f65a7]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className="border-r border-slate-200 px-4 py-3 last:border-r-0">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className={cn('mt-1 text-xl font-semibold tabular-nums', toneClass(item.tone))}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="relative min-w-64 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={pageConfig.keywordPlaceholder}
              className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-xs outline-none focus:border-[#1f65a7] sm:w-80"
            />
          </div>
          <ToolButton
            icon={<Filter className="h-3.5 w-3.5" />}
            label={statusFilter === '全部' ? '筛选' : `筛选：${statusFilter}`}
            onClick={openAgencyFilterDialog}
          />
          <span className="ml-auto text-xs text-slate-500">当前视图: {activeTab} · 显示 {pageStart}-{pageEnd} / {filteredRows.length} 条</span>
        </div>

        <div className="grid min-h-[440px] min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col">
            <div className="max-w-full overflow-auto">
              <table className="w-full min-w-[840px] border-collapse text-xs">
                <thead className="sticky top-0 bg-[#e8eef6] text-slate-700">
                  <tr>
                    <th className="w-10 border-b border-r border-slate-300 px-2 py-2 text-left">选</th>
                    <th className="w-20 border-b border-r border-slate-300 px-2 py-2 text-left">状态</th>
                    {pageConfig.columns.map((column) => (
                      <th key={column.key} className={cn('border-b border-r border-slate-300 px-2 py-2', alignClass(column.align))}>{column.label}</th>
                    ))}
                    <th className="w-36 border-b border-slate-300 px-2 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#f8fbff]">
                      <td className="border-b border-r border-slate-200 px-2 py-2"><input type="checkbox" /></td>
                      <td className="border-b border-r border-slate-200 px-2 py-2"><StatusBadge value={row.status} /></td>
                      {pageConfig.columns.map((column) => (
                        <td key={column.key} className={cn('border-b border-r border-slate-200 px-2 py-2', alignClass(column.align))}>
                          {row.values[column.key]}
                        </td>
                      ))}
                      <td className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-right">
                        <button type="button" onClick={() => handleViewRow(row)} className="mr-2 text-[#1f65a7] hover:underline">
                          查看
                        </button>
                        {kind === 'batchOps' && row.status === '待处理' && (
                          <button type="button" onClick={() => void handleProcessRow(row)} className="mr-2 text-[#1f65a7] hover:underline">
                            执行预检
                          </button>
                        )}
                        {kind === 'batchOps' && row.status === '待确认' && row.values.approval === '需审批' && (
                          <>
                            <button type="button" onClick={() => void handleReviewBatchTask(row, 'approved')} className="mr-2 text-emerald-700 hover:underline">
                              通过预检
                            </button>
                            <button type="button" onClick={() => void handleReviewBatchTask(row, 'rejected')} className="mr-2 text-rose-700 hover:underline">
                              驳回预检
                            </button>
                          </>
                        )}
                        {kind !== 'batchOps' && (
                          <button type="button" onClick={() => void handleProcessRow(row)} className="mr-2 text-[#1f65a7] hover:underline">
                            {detailMeta.processLabel}
                          </button>
                        )}
                        {kind === 'clients' && (
                          <button type="button" onClick={() => handleEnterAccount(row)} className="text-[#1f65a7] hover:underline">
                            进入账套
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={pageConfig.columns.length + 3} className="border-b border-slate-200 px-3 py-12 text-center">
                        <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
                          <p className="text-sm font-semibold text-slate-700">{agencyEmptyTitle}</p>
                          <p className="max-w-lg text-xs leading-5 text-slate-500">{agencyEmptyDescription}</p>
                          <button
                            type="button"
                            onClick={() => {
                              if (isFilteredAgencyListEmpty) {
                                resetAgencyListFilters()
                                return
                              }
                              void handlePrimaryAction()
                            }}
                            className="mt-1 h-8 border border-[#1f65a7] px-3 text-xs font-medium text-[#1f65a7] hover:bg-blue-50"
                          >
                            {agencyEmptyActionLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-[#f8fafc]">
                  <tr>
                    <td className="border-t border-r border-slate-200 px-2 py-2" />
                    <td className="border-t border-r border-slate-200 px-2 py-2 font-semibold" colSpan={Math.max(pageConfig.columns.length + 1, 1)}>本页小计</td>
                    <td className="border-t border-slate-200 px-2 py-2 text-right text-slate-500">当前页 {pagedRows.length} 条</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
              <span>机构级批量页面按当前筛选分页展示，导出按筛选全集生成。</span>
              <div className="flex items-center gap-2">
                <span>第 {page} / {totalPages} 页</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
                  aria-label="每页条数"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>每页 {size} 条</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>

          <aside className="min-w-0 border-l border-slate-200 bg-[#fbfdff]">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">{pageConfig.queueTitle}</div>
            <div className="space-y-2 p-3">
              {pageConfig.queue.map((item, index) => (
                <div key={item} className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                  <div className="mb-1 flex items-center gap-1 font-medium text-slate-900">
                    {index === 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-[#1f65a7]" />}
                    {index + 1}. 待处理
                  </div>
                  {item}
                </div>
              ))}
            </div>

            <div className="border-y border-slate-200 px-3 py-2 text-sm font-semibold">模块说明</div>
            <div className="space-y-2 p-3">
              {pageConfig.notes.map((note) => (
                <p key={note} className="text-xs leading-5 text-slate-600">{note}</p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

async function fetchAgencyRows(kind: AgencyModuleKind, activeTab: string, period: string): Promise<AgencyRow[]> {
  if (kind === 'automation') {
    const response = await agencyApi.getAutomationJobs({ period })
    if (!response.success) throw new Error(response.error || '自动化任务读取失败')
    const rows = (response.data ?? []).map(mapAgencyAutomationJobRow)
    if (activeTab === '采集预检') return rows.filter((row) => row.values.name.includes('采集预检'))
    if (activeTab === '识别任务') return rows.filter((row) => row.values.name.includes('识别'))
    if (activeTab === '凭证建议') return rows.filter((row) => row.values.name.includes('凭证'))
    return rows
  }

  if (kind === 'healthCheck') {
    const response = await agencyApi.getHealthChecks(period)
    if (!response.success) throw new Error(response.error || '健康检查读取失败')
    const rows = (response.data ?? []).map(mapAgencyHealthCheckRow)
    if (activeTab === '发票风险') return rows.filter((row) => row.values.module === '发票')
    if (activeTab === '税务风险') return rows.filter((row) => row.values.module === '税务申报')
    if (activeTab === '交付风险') return rows.filter((row) => row.values.module === '交付')
    return rows
  }

  if (kind === 'batchOps') {
    const response = await agencyApi.getBatchTasks({ period })
    if (!response.success) throw new Error(response.error || '批量任务读取失败')
    return filterAgencyBatchTaskRows((response.data ?? []).map(mapAgencyBatchTaskRow), activeTab)
  }

  if (kind === 'authorizationCenter') {
    const adapterType = agencyAuthorizationAdapterType(activeTab)
    const response = adapterType
      ? await agencyApi.getAuthorizations({ adapterType })
      : await agencyApi.getAuthorizations()
    if (!response.success) throw new Error(response.error || '授权记录读取失败')
    const items = activeTab === '到期提醒'
      ? (response.data ?? []).filter((item) => isAuthorizationExpiryReminder(item.expiresAt))
      : response.data ?? []
    return items.map(mapAgencyAuthorizationRow)
  }

  if (kind === 'invoiceManagement') {
    const response = await agencyApi.getFeeCollections({ period })
    if (!response.success) throw new Error(response.error || '服务费开票记录读取失败')
    const rows = (response.data ?? []).map(mapAgencyInvoiceManagementRow)
    if (activeTab === '待开票') return rows.filter((row) => row.values.invoice !== '已开票')
    if (activeTab === '已开票') return rows.filter((row) => row.values.invoice === '已开票')
    if (activeTab === '异常状态') return rows.filter((row) => row.status === '异常')
    return rows
  }

  if (kind === 'serviceContracts' && activeTab === '收费管理') {
    const response = await agencyApi.getFeeCollections({ period })
    if (!response.success) throw new Error(response.error || '收费记录读取失败')
    return response.data?.map(mapFeeCollectionRow) ?? []
  }

  if (kind === 'serviceContracts' && activeTab === '客户协同') {
    const response = await agencyApi.getCollaborationItems()
    if (!response.success) throw new Error(response.error || '协同事项读取失败')
    return response.data?.map(mapCollaborationItemRow) ?? []
  }

  if (kind === 'serviceContracts' && activeTab === '归档记录') {
    const response = await agencyApi.getServiceContracts()
    if (!response.success) throw new Error(response.error || '合同归档记录读取失败')
    return response.data?.map(mapAgencyContractArchiveRow) ?? []
  }

  if (kind === 'serviceContracts' && activeTab === '服务套餐') {
    const response = await agencyApi.getServiceContracts()
    if (!response.success) throw new Error(response.error || '服务套餐汇总读取失败')
    return mapAgencyServicePackageRows(response.data ?? [])
  }

  if (kind === 'serviceContracts') {
    const response = await agencyApi.getServiceContracts()
    if (!response.success) throw new Error(response.error || '服务合同读取失败')
    return response.data?.map(mapServiceContractRow) ?? []
  }
  return []
}

function mapAgencyAutomationJobRow(item: AutomationJob): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyAutomationStatus(item.status, item.riskLevel),
    values: {
      name: formatAgencyAutomationJobType(item.jobType),
      trigger: item.sourceModule,
      scope: item.companyName || item.companyId,
      lastRun: item.updatedAt,
      confidence: item.confidence === null ? '-' : `${Math.round(item.confidence * 100)}%`,
      confirm: item.riskLevel === 'high' ? '必须人工确认' : item.reviewer || '人工复核',
      result: item.resultSummary || item.status,
      companyId: item.companyId,
      jobStatus: item.status,
      confidenceValue: item.confidence === null ? '' : String(item.confidence),
      riskLevel: item.riskLevel,
      reviewer: item.reviewer || '',
      resultSummary: item.resultSummary || '',
    },
  }
}

function mapAgencyHealthCheckRow(item: AgencyHealthCheckItem): AgencyRow {
  return {
    id: item.id,
    status: item.riskLevel === '高' ? '异常' : '待确认',
    values: {
      customer: item.companyName || item.companyId,
      module: item.moduleName,
      risk: item.riskMessage,
      level: item.riskLevel,
      owner: item.owner || '-',
      source: '本地风险扫描',
      fix: item.resolutionStatus,
    },
  }
}

function mapAgencyBatchTaskRow(item: AgencyBatchTask): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyBatchTaskStatus(item.status),
    values: {
      task: item.taskName,
      scope: item.customerScope,
      period: item.period,
      progress: item.progressTotal === null ? `${item.progressCurrent}/待计算` : `${item.progressCurrent}/${item.progressTotal}`,
      operator: item.operator || '-',
      started: item.createdAt,
      result: item.resultSummary || '-',
      approval: item.requiresApproval ? '需审批' : '无需审批',
    },
  }
}

function filterAgencyBatchTaskRows(rows: AgencyRow[], activeTab: string) {
  if (activeTab === '批量采集') return rows.filter((row) => row.values.task.includes('采集'))
  if (activeTab === '批量生成') return rows.filter((row) => row.values.task.includes('生成'))
  if (activeTab === '批量结账') return rows.filter((row) => row.values.task.includes('结账'))
  if (activeTab === '批量申报') return rows.filter((row) => row.values.task.includes('申报') && !row.values.task.includes('回执'))
  if (activeTab === '申报回执') return rows.filter((row) => /回执|缴款|扣款/.test(row.values.task))
  if (activeTab === '审批记录') return rows.filter((row) => row.values.approval === '需审批')
  return rows
}

function mapAgencyAuthorizationRow(item: AdapterAuthorization): AgencyRow {
  const authorizationStatus = mapAuthorizationStatus(item.authStatus, item.expiresAt, item.riskMessage)
  return {
    id: item.id,
    status: authorizationStatus,
    values: {
      customer: item.companyName || item.companyId,
      taxNo: item.accountMask || '-',
      type: formatAdapterType(item.adapterType),
      loginPerson: item.loginIdentity || '-',
      identity: item.capabilityScope || '-',
      method: item.adapterCode,
      statusText: formatAuthorizationStatus(item.authStatus),
      expireAt: item.expiresAt || '-',
      lastCollect: item.lastCheckedAt || '-',
      risk: item.riskMessage || '无',
      companyId: item.companyId,
      adapterType: item.adapterType,
      adapterCode: item.adapterCode,
      region: item.region || '',
      authStatus: item.authStatus,
      accountMask: item.accountMask || '',
      loginIdentity: item.loginIdentity || '',
      capabilityScope: item.capabilityScope || '',
      expiresAt: item.expiresAt || '',
      riskMessage: item.riskMessage || '',
    },
  }
}

function agencyAuthorizationAdapterType(activeTab: string) {
  if (activeTab === '税务授权') return 'tax'
  if (activeTab === '个税授权') return 'individual_tax'
  if (activeTab === '银行授权') return 'bank'
  if (activeTab === '工商授权') return 'industrial_commercial'
  if (activeTab === '票池授权') return 'invoice_pool'
  return undefined
}

function isAuthorizationExpiryReminder(expiresAt: string | null) {
  if (!expiresAt) return false
  const expiresAtValue = new Date(expiresAt).getTime()
  if (Number.isNaN(expiresAtValue)) return false
  const reminderWindow = 30 * 24 * 60 * 60 * 1000
  return expiresAtValue <= Date.now() + reminderWindow
}

function mapAgencyCompanyRow(item: Company): AgencyRow {
  const taxType = item.tax_type === 'general' ? '一般纳税人' : item.tax_type === 'small' ? '小规模纳税人' : '未设置'
  const accountingSystem = formatAccountingSystem(item.accounting_system)
  const enablePeriod = item.enable_year && item.enable_month
    ? `${item.enable_year}-${String(item.enable_month).padStart(2, '0')}`
    : '未设置'
  const servicePeriod = item.service_start || item.service_end
    ? `${item.service_start || '-'} 至 ${item.service_end || '-'}`
    : '-'
  const accountStatus = item.is_active ? '启用' : '停用'
  const values = {
    tag: '-',
    code: item.code || '-',
    name: item.name,
    taxId: item.tax_id || '-',
    type: item.enterprise_type || '-',
    region: [item.province, item.city, item.district].filter(Boolean).join(' ') || '-',
    taxType,
    collect: '未采集',
    credit: '-',
    accountingSystem,
    enablePeriod,
    industry: item.industry || '-',
    createdAt: item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '-',
    importedAt: item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '-',
    owner: '-',
    serviceEnd: item.service_start || item.service_end ? servicePeriod : '-',
    manager: '-',
    period: enablePeriod,
    taxOffice: '未采集',
    accountStatus,
  }

  return {
    id: item.id,
    status: item.is_active ? '进行中' : '异常',
    values: {
      code: values.code,
      name: values.name,
      taxId: values.taxId,
      taxType: values.taxType,
      enablePeriod: values.enablePeriod,
      accountingSystem: values.accountingSystem,
      industry: values.industry,
      accountStatus: values.accountStatus,
    },
  }
}

function filterAgencyCompanyRows(rows: AgencyRow[], activeTab: string) {
  if (activeTab === '启用账套' || activeTab === '正常') {
    return rows.filter((row) => row.values.accountStatus === '启用')
  }
  if (activeTab === '停用账套' || activeTab === '停用') {
    return rows.filter((row) => row.values.accountStatus === '停用')
  }
  if (activeTab === '一般纳税人' || activeTab === '小规模纳税人') {
    return rows.filter((row) => row.values.taxType === activeTab)
  }
  return rows
}

function formatAccountingSystem(value: string | null) {
  if (value === 'small_enterprise') return '小企业会计准则'
  if (value === 'enterprise') return '企业会计准则'
  if (value === 'government') return '政府会计准则'
  return value || '未设置'
}

function mapServiceContractRow(item: AgencyServiceContract): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyStatus(item.status, item.renewalStatus),
    values: {
      contractNo: item.contractNo,
      customer: item.companyName || item.companyId,
      package: item.servicePackage,
      period: `${item.serviceStart} 至 ${item.serviceEnd}`,
      fee: formatMoney(item.monthlyFee),
      payment: item.renewalStatus === 'overdue' ? '待收款/待催收' : '合同收费正常',
      collaboration: item.archiveStatus === 'missing' ? '待补合同附件' : '无待办',
      renewal: item.renewalStatus,
      owner: item.owner || '-',
      archive: item.archiveStatus,
      companyId: item.companyId,
      servicePackage: item.servicePackage,
      serviceStart: item.serviceStart,
      serviceEnd: item.serviceEnd,
      monthlyFee: String(item.monthlyFee),
      renewalStatus: item.renewalStatus,
      archiveStatus: item.archiveStatus,
      recordStatus: item.status,
    },
  }
}

function mapAgencyContractArchiveRow(item: AgencyServiceContract): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyStatus(item.status, item.archiveStatus),
    values: {
      contractNo: item.contractNo,
      customer: item.companyName || item.companyId,
      period: `${item.serviceStart} 至 ${item.serviceEnd}`,
      archive: formatAgencyArchiveStatus(item.archiveStatus),
      renewal: item.renewalStatus || '未设置',
      owner: item.owner || '-',
      updatedAt: item.updatedAt || '-',
      companyId: item.companyId,
      servicePackage: item.servicePackage,
      serviceStart: item.serviceStart,
      serviceEnd: item.serviceEnd,
      monthlyFee: String(item.monthlyFee),
      renewalStatus: item.renewalStatus,
      archiveStatus: item.archiveStatus,
      recordStatus: item.status,
    },
  }
}

function mapAgencyServicePackageRows(items: AgencyServiceContract[]): AgencyRow[] {
  const packages = new Map<string, {
    customers: Set<string>
    contracts: number
    monthlyFee: number
    pendingRenewal: number
    missingArchive: number
    abnormal: boolean
  }>()

  for (const item of items) {
    const packageName = item.servicePackage || '未设置套餐'
    const current = packages.get(packageName) || {
      customers: new Set<string>(),
      contracts: 0,
      monthlyFee: 0,
      pendingRenewal: 0,
      missingArchive: 0,
      abnormal: false,
    }
    current.customers.add(item.companyId)
    current.contracts += 1
    current.monthlyFee += item.monthlyFee
    current.pendingRenewal += item.renewalStatus === 'normal' ? 0 : 1
    current.missingArchive += item.archiveStatus === 'missing' ? 1 : 0
    current.abnormal ||= mapAgencyStatus(item.status, item.renewalStatus) === '异常'
    packages.set(packageName, current)
  }

  return [...packages.entries()].map(([packageName, item]) => ({
    id: `service-package-${packageName}`,
    status: item.abnormal ? '异常' : item.pendingRenewal > 0 ? '待确认' : '进行中',
    values: {
      package: packageName,
      customers: `${item.customers.size} 户`,
      contracts: `${item.contracts} 份`,
      monthlyFee: formatMoney(item.monthlyFee),
      renewal: item.pendingRenewal > 0 ? `待续签 ${item.pendingRenewal} 份` : '正常',
      archive: item.missingArchive > 0 ? `缺少附件 ${item.missingArchive} 份` : '完整',
    },
  }))
}

function mapFeeCollectionRow(item: AgencyFeeCollection): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyStatus(item.status, item.paymentStatus),
    values: {
      customer: item.companyName || item.companyId,
      period: item.period,
      receivable: formatMoney(item.receivableAmount),
      received: formatMoney(item.receivedAmount),
      arrears: formatMoney(item.arrearsAmount),
      invoice: formatAgencyInvoiceStatus(item.invoiceStatus),
      payment: formatAgencyPaymentStatus(item.paymentStatus),
      collector: item.collector || '-',
      followUp: item.lastFollowUp || '-',
      companyId: item.companyId,
      receivableAmount: String(item.receivableAmount),
      receivedAmount: String(item.receivedAmount),
      invoiceStatus: item.invoiceStatus,
      paymentStatus: item.paymentStatus,
      lastFollowUp: item.lastFollowUp || '',
      recordStatus: item.status,
    },
  }
}

function mapAgencyInvoiceManagementRow(item: AgencyFeeCollection): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyStatus(item.status, `${item.invoiceStatus} ${item.paymentStatus}`),
    values: {
      customer: item.companyName || item.companyId,
      period: item.period,
      amount: formatMoney(item.receivableAmount),
      received: formatMoney(item.receivedAmount),
      invoice: formatAgencyInvoiceStatus(item.invoiceStatus),
      payment: formatAgencyPaymentStatus(item.paymentStatus),
      owner: item.collector || '-',
      followUp: item.lastFollowUp || '-',
      companyId: item.companyId,
      receivableAmount: String(item.receivableAmount),
      receivedAmount: String(item.receivedAmount),
      invoiceStatus: item.invoiceStatus,
      paymentStatus: item.paymentStatus,
      lastFollowUp: item.lastFollowUp || '',
      recordStatus: item.status,
    },
  }
}

function mapCollaborationItemRow(item: AgencyCollaborationItem): AgencyRow {
  return {
    id: item.id,
    status: mapAgencyStatus(item.status, item.replyStatus),
    values: {
      customer: item.companyName || item.companyId,
      todo: item.todoTitle,
      material: item.materialType || '-',
      contact: item.customerContact || '-',
      reminder: `${item.reminderCount} 次`,
      lastContact: item.lastContactAt || '-',
      reply: item.replyStatus,
      owner: item.owner || '-',
      companyId: item.companyId,
      materialType: item.materialType || '',
      customerContact: item.customerContact || '',
      replyStatus: item.replyStatus,
      reminderCount: String(item.reminderCount),
      lastContactAt: item.lastContactAt || '',
      recordStatus: item.status,
    },
  }
}

function mapAgencyStatus(primary: string, secondary = ''): AgencyRow['status'] {
  const value = `${primary} ${secondary}`.toLowerCase()
  if (value.includes('paid') || value.includes('completed') || value.includes('已确认') || value.includes('已完成') || value.includes('已收')) return '已完成'
  if (value.includes('blocked') || value.includes('overdue') || value.includes('expiring') || value.includes('超时') || value.includes('异常')) return '异常'
  if (value.includes('waiting') || value.includes('pending') || value.includes('待')) return '待确认'
  if (value.includes('active') || value.includes('processing') || value.includes('进行中')) return '进行中'
  return '待处理'
}

function formatAgencyInvoiceStatus(value: string) {
  if (value === 'issued') return '已开票'
  if (value === 'pending') return '待开票'
  if (value === 'void' || value === 'reversed') return '红冲/作废'
  return value || '未设置'
}

function formatAgencyPaymentStatus(value: string) {
  if (value === 'paid') return '已收款'
  if (value === 'pending') return '待收款'
  if (value === 'overdue') return '逾期欠费'
  return value || '未设置'
}

function formatAgencyArchiveStatus(value: string) {
  if (value === 'archived') return '已归档'
  if (value === 'pending') return '待归档'
  if (value === 'missing') return '缺少附件'
  return value || '未设置'
}

function formatAuthorizationStatus(value: string) {
  if (value === 'valid') return '正常'
  if (value === 'pending') return '待确认'
  if (value === 'expired') return '已过期'
  if (value === 'invalid') return '授权异常'
  return value || '未设置'
}

function mapAuthorizationStatus(authStatus: string, expiresAt: string | null, riskMessage: string | null): AgencyRow['status'] {
  const value = `${authStatus} ${expiresAt || ''} ${riskMessage || ''}`.toLowerCase()
  if (value.includes('expired') || value.includes('invalid') || value.includes('failed') || value.includes('异常') || value.includes('失效')) return '异常'
  if (value.includes('pending') || value.includes('待')) return '待确认'
  if (value.includes('valid') || value.includes('authorized') || value.includes('normal') || value.includes('有效') || value.includes('正常')) return '已完成'
  return '待处理'
}

function mapAgencyBatchTaskStatus(status: string): AgencyRow['status'] {
  const normalized = status.toLowerCase()
  if (normalized === 'completed') return '已完成'
  if (normalized === 'failed' || normalized === 'blocked') return '异常'
  if (normalized === 'running' || normalized === 'processing') return '进行中'
  if (normalized === 'awaiting_approval') return '待确认'
  if (normalized === 'prechecked') return '已完成'
  return '待处理'
}

function mapAgencyAutomationStatus(status: string, riskLevel: string): AgencyRow['status'] {
  const normalized = status.toLowerCase()
  if (normalized === 'completed' || normalized === 'confirmed') return '已完成'
  if (normalized === 'failed' || normalized === 'rejected') return '异常'
  if (normalized === 'running' || normalized === 'processing') return '进行中'
  if (normalized === 'review' || normalized === 'awaiting_confirmation' || riskLevel === 'high') return '待确认'
  return '待处理'
}

function formatAgencyAutomationJobType(jobType: string) {
  if (jobType === 'document_ocr') return '单据 OCR 识别'
  if (jobType === 'voucher_suggestion') return 'AI 凭证建议'
  if (jobType === 'invoice_collection') return '发票采集任务'
  if (jobType === 'bank_collection') return '银行流水采集任务'
  if (jobType === 'tax_profile_collection') return '税务资料采集预检'
  return jobType
}

function formatAdapterType(value: string) {
  if (value === 'tax') return '电子税务局'
  if (value === 'individual_tax') return '自然人税收'
  if (value === 'bank') return '银行流水'
  if (value === 'industrial_commercial') return '工商系统'
  if (value === 'invoice_pool') return '发票票池'
  return value
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ToolButton({ icon, label, title, onClick }: { icon: React.ReactNode; label: string; title?: string; onClick?: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">
      {icon}
      {label}
    </button>
  )
}

function StatusBadge({ value }: { value: AgencyRow['status'] }) {
  const style =
    value === '已完成'
      ? 'bg-green-50 text-green-700'
      : value === '异常'
        ? 'bg-red-50 text-red-700'
        : value === '待确认'
          ? 'bg-amber-50 text-amber-700'
          : value === '进行中'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-600'
  return <span className={cn('inline-flex rounded px-2 py-0.5', style)}>{value}</span>
}

function toneClass(tone: AgencyConfig['summary'][number]['tone']) {
  if (tone === 'green') return 'text-green-700'
  if (tone === 'amber') return 'text-amber-700'
  if (tone === 'red') return 'text-red-700'
  return 'text-[#1f65a7]'
}

function alignClass(align: 'left' | 'right' | 'center' = 'left') {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

function buildAgencySheetRows(config: AgencyConfig, rows: AgencyRow[], exportedAt: string, activeTab: string, keyword: string, periodLabel: string) {
  return [
    [config.title],
    ['机构', 'AI 代理记账', '所属期', periodLabel, '当前视图', activeTab],
    ['导出时间', exportedAt, '筛选关键字', keyword || '全部', '记录数', `${rows.length}`],
    [],
    ['状态', ...config.columns.map((column) => column.label)],
    ...rows.map((row) => [row.status, ...config.columns.map((column) => row.values[column.key] || '')]),
    [],
    ['制表说明', `${config.title} 按当前筛选全集导出，后续可与固定模板、签章和归档目录绑定。`],
  ]
}

function buildAgencyPrintHtml(config: AgencyConfig, rows: AgencyRow[], exportedAt: string, activeTab: string, keyword: string, periodLabel: string) {
  const headerCells = ['状态', ...config.columns.map((column) => column.label)]
  const rowHtml = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.status)}</td>
      ${config.columns.map((column) => `<td class="${column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : ''}">${escapeHtml(row.values[column.key] || '')}</td>`).join('')}
    </tr>
  `).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(config.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { margin: 0; color: #111827; font-family: "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif; font-size: 12px; }
    h1 { margin: 0 0 6px; text-align: center; font-size: 20px; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; margin-bottom: 10px; color: #475569; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { background: #e8eef6; color: #1f2937; font-weight: 700; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; word-break: break-word; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .right { text-align: right; }
    .center { text-align: center; }
    .notes { margin-top: 10px; color: #475569; }
    .sign { display: flex; justify-content: space-between; margin-top: 18px; color: #334155; }
  </style>
</head>
<body>
  <h1>${escapeHtml(config.title)}</h1>
  <div class="meta">
    <span>机构: AI 代理记账</span>
    <span>所属期: ${escapeHtml(periodLabel)}</span>
    <span>当前视图: ${escapeHtml(activeTab)}</span>
    <span>导出时间: ${escapeHtml(exportedAt)}</span>
    <span>筛选关键字: ${escapeHtml(keyword || '全部')}</span>
    <span>记录数: ${rows.length}</span>
    <span>模板: 机构运营台账</span>
    <span>状态: 未签章</span>
  </div>
  <table>
    <thead><tr>${headerCells.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>
    <tbody>${rowHtml || `<tr><td colspan="${headerCells.length}" class="center">暂无数据</td></tr>`}</tbody>
  </table>
  <div class="notes">${escapeHtml(config.description)}</div>
  <div class="sign"><span>制表: 系统</span><span>复核: 未签章</span><span>机构确认: 未签章</span></div>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
