import { useEffect, useMemo, useState } from 'react'
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
} from '../../lib/api'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore, type Company } from '../../stores/companyStore'
import { usePeriodStore } from '../../stores/periodStore'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { exportRowsToXlsx } from '../../lib/xlsxExport'
import { recordAuditLog, recordExportJob, useExportJobs, type ExportJob } from '../../lib/exportJobs'

export type AgencyModuleKind =
  | 'clients'
  | 'accountManagement'
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

const configs: Record<AgencyModuleKind, AgencyConfig> = {
  clients: {
    title: '客户总览',
    description: '代理机构维度集中查看客户账套、收票、做账、报表、申报和风险进度。',
    tabs: ['全部客户', '待收票', '待做账', '待申报', '高风险', '已结账'],
    primaryAction: '新增客户',
    keywordPlaceholder: '搜索客户名称、编码、税号、负责人',
    summary: [
      { label: '客户数', value: '128 户', tone: 'blue' },
      { label: '待做账', value: '27 户', tone: 'amber' },
      { label: '待申报', value: '12 户', tone: 'red' },
      { label: '已结账', value: '86 户', tone: 'green' },
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
    rows: [
      { id: 'c-01460', status: '待确认', values: { code: '01460', name: '科旋电气（上海）有限公司', taxType: '一般纳税人', period: '2026-05', invoice: '126/138', voucher: '82 张', report: '已生成', tax: '待确认', owner: '张会计' } },
      { id: 'c-02018', status: '进行中', values: { code: '02018', name: '上海云启科技有限公司', taxType: '小规模', period: '2026-05', invoice: '84/91', voucher: '47 张', report: '待复核', tax: '未取数', owner: '李会计' } },
      { id: 'c-03009', status: '异常', values: { code: '03009', name: '杭州辰光贸易有限公司', taxType: '一般纳税人', period: '2026-05', invoice: '38/70', voucher: '19 张', report: '未生成', tax: '未开始', owner: '王会计' } },
    ],
    queueTitle: '待办队列',
    queue: ['杭州辰光贸易缺少 32 张销项票', '上海云启利润表需复核管理费用', '12 户客户增值税申报待确认'],
    notes: ['这里是机构层客户总览，不替代单账套内的业务处理页面。', '点击客户后进入单账套工作台，保持竞品同类“客户列表 -> 账套内页”的操作路径。'],
  },
  accountManagement: {
    title: '账套管理',
    description: '按竞品账套管理方式维护多客户企业档案、采集状态、税务登录信息、服务期限、主办会计和进入账套入口。',
    tabs: ['正常', '停用', '采集异常', '待授权', '服务到期', '异常原因'],
    primaryAction: '新增企业',
    keywordPlaceholder: '搜索企业名称、编码、纳税人识别号、登录人员',
    summary: [
      { label: '正常账套', value: '128 户', tone: 'blue' },
      { label: '采集成功', value: '102 户', tone: 'green' },
      { label: '采集警告', value: '18 户', tone: 'amber' },
      { label: '采集失败', value: '8 户', tone: 'red' },
    ],
    columns: [
      { key: 'tag', label: '企业标签' },
      { key: 'code', label: '编码' },
      { key: 'name', label: '企业名称' },
      { key: 'type', label: '企业类型' },
      { key: 'taxType', label: '纳税人资格' },
      { key: 'collect', label: '采集状态' },
      { key: 'credit', label: '信用等级', align: 'center' },
      { key: 'importedAt', label: '客户导入时间' },
      { key: 'owner', label: '主办会计' },
      { key: 'serviceEnd', label: '服务期限' },
      { key: 'manager', label: '部门主管' },
      { key: 'period', label: '账期', align: 'center' },
      { key: 'taxOffice', label: '主管税务机关' },
    ],
    rows: [
      { id: 'am-001', status: '已完成', values: { tag: '重点客户', code: '20258497', name: '上海王家德餐饮管理有限公司', type: '私营有限责任公司', taxType: '小规模纳税人', collect: '采集成功 06-26 18:09', credit: 'M', importedAt: '2026-06-26 17:40', owner: '李喻', serviceEnd: '2026-12', manager: '李喻', period: '2026-06', taxOffice: '普陀区税务局第十六税务所' } },
      { id: 'am-002', status: '待确认', values: { tag: '新签', code: '20258493', name: '上海蓝雀元智能科技有限公司', type: '私营有限责任公司', taxType: '小规模纳税人', collect: '采集成功 06-26 17:57', credit: 'M', importedAt: '2026-06-26 17:26', owner: '李喻', serviceEnd: '2027-05', manager: '李喻', period: '2026-06', taxOffice: '宝山区税务局第十六税务所' } },
      { id: 'am-003', status: '异常', values: { tag: '需回执', code: '20258486', name: '上海爱恩客工业科技有限公司', type: '内资企业', taxType: '一般纳税人', collect: '采集失败 06-26 17:54', credit: '-', importedAt: '2026-06-26 17:09', owner: '李喻', serviceEnd: '2026-06', manager: '李喻', period: '2026-06', taxOffice: '嘉定区税务局第十三税务所' } },
    ],
    queueTitle: '批量动作',
    queue: ['新增企业、导入、导出、采集、批量删除、批量停用只在机构层出现', '采集通过维护的税务登录方式获取客户基础资料、税种、主管税务机关和企业类型', '操作列保留编辑、删除、停用、备忘录、进入账套、登录税务局'],
    notes: ['账套管理负责多家公司档案和授权状态；进入单账套后只保留该公司的业务处理。', '采集、登录税务局等能力后续通过合法 adapter 接入，不在前端伪造真实提交。'],
  },
  authorizationCenter: {
    title: '授权中心',
    description: '集中维护多客户电子税务局、自然人税收、银行、工商和票池授权状态，为批量采集和批量申报提供前置授权检查。',
    tabs: ['授权总览', '税务授权', '个税授权', '银行授权', '工商授权', '票池授权', '到期提醒'],
    primaryAction: '新增授权',
    keywordPlaceholder: '搜索客户、授权类型、登录人员、到期时间、异常原因',
    summary: [
      { label: '授权客户', value: '116 户', tone: 'blue' },
      { label: '授权正常', value: '92 户', tone: 'green' },
      { label: '即将到期', value: '17 户', tone: 'amber' },
      { label: '授权异常', value: '7 户', tone: 'red' },
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
    rows: [
      { id: 'auth-001', status: '已完成', values: { customer: '科旋电气（上海）有限公司', taxNo: '91310115MA1K3****X', type: '电子税务局', loginPerson: '办税员', identity: '代理记账人员', method: '账号密码+短信', statusText: '正常', expireAt: '2026-12-31', lastCollect: '06-26 18:09', risk: '无' } },
      { id: 'auth-002', status: '待确认', values: { customer: '上海云启科技有限公司', taxNo: '91310113MA1G****2Q', type: '银行流水', loginPerson: '财务负责人', identity: '企业网银授权', method: '银行 adapter', statusText: '待确认', expireAt: '2026-07-15', lastCollect: '06-26 17:58', risk: '需客户确认授权范围' } },
      { id: 'auth-003', status: '异常', values: { customer: '杭州辰光贸易有限公司', taxNo: '91330106MA2H****8P', type: '自然人税收', loginPerson: '办税员', identity: '扣缴客户端', method: '申报密码登录', statusText: '失败', expireAt: '已过期', lastCollect: '06-25 21:40', risk: '申报密码失效' } },
    ],
    queueTitle: '授权检查',
    queue: ['批量采集发票、流水、税种和主管税务机关前先检查授权状态', '授权中心只保存状态、掩码账号、adapter 参数和审计日志，不保存明文敏感信息', '授权异常客户自动进入批量任务跳过队列并提示补授权'],
    notes: ['授权中心是机构层模块，服务所有客户账套的采集、申报和自动化任务。', '单账套内只展示当前公司的授权结果和使用记录，不放跨客户批量授权入口。'],
  },
  serviceContracts: {
    title: '服务合同',
    description: '维护代账服务合同、服务套餐、收费收款、客户协同、机构资料、人员权限、消息模板和归档。',
    tabs: ['服务合同', '收费管理', '客户协同', '机构资料', '服务套餐', '消息模板', '权限策略', '归档记录'],
    primaryAction: '新增合同',
    keywordPlaceholder: '搜索客户、合同编号、收费状态、协同事项、套餐、机构配置',
    summary: [
      { label: '服务中合同', value: '118 份', tone: 'blue' },
      { label: '待收服务费', value: '¥92,600', tone: 'amber' },
      { label: '待客户协同', value: '42 项', tone: 'red' },
      { label: '已归档', value: '96 份', tone: 'green' },
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
    rows: [
      { id: 'sc-001', status: '进行中', values: { contractNo: 'FW-2026-0018', customer: '科旋电气（上海）有限公司', package: '一般纳税人标准包', period: '2026-01 至 2026-12', fee: '¥2,800.00', payment: '已收款/已开票', collaboration: '无待办', renewal: '正常', owner: '张会计', archive: '合同PDF' } },
      { id: 'sc-002', status: '待确认', values: { contractNo: 'FW-2026-0042', customer: '上海云启科技有限公司', package: '小规模基础包', period: '2026-06 至 2027-05', fee: '¥1,200.00', payment: '待开票/待收款', collaboration: '确认管理费用差异', renewal: '待签署', owner: '李会计', archive: '待上传' } },
      { id: 'sc-003', status: '异常', values: { contractNo: 'FW-2025-0091', customer: '杭州辰光贸易有限公司', package: '一般纳税人含申报', period: '2025-07 至 2026-06', fee: '¥3,200.00', payment: '逾期欠费 ¥6,400', collaboration: '补传销项发票', renewal: '30天内到期', owner: '王会计', archive: '缺附件' } },
    ],
    queueTitle: '合同待办',
    queue: ['杭州辰光贸易合同 30 天内到期且欠费 2 个月', '上海云启新合同待签署，服务费发票待开具', '42 项客户协同待办统一在合同客户视图处理', '机构资料、服务套餐和消息模板在服务合同模块内维护'],
    notes: ['服务合同承接收费管理、客户协同和机构基础配置，避免机构首页入口过散。', '合同、收费、催办、套餐、权限策略和归档同属代理服务交付闭环；客户资料上传仍会流转到具体账套业务模块。'],
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
    primaryAction: '刷新统计',
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
    tabs: ['操作任务', '批量采集', '批量生成', '批量结账', '批量申报', '申报回执', '审批记录', '执行日志'],
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
    tabs: ['任务看板', '识别任务', '凭证建议'],
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
      period: '2026-05',
      statusText: job.status,
      createdAt: job.createdAt,
      creator: job.operator,
      expireAt: job.expireAt,
      hash: job.hash,
    },
  }
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

function getAgencyTabConfig(baseConfig: AgencyConfig, activeTab: string, useLiveDesktopData: boolean): AgencyConfig {
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

  if (useLiveDesktopData && baseConfig.title === '授权中心') {
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

  if (useLiveDesktopData && (baseConfig.title === '客户总览' || baseConfig.title === '账套管理')) {
    const isAccountManagement = baseConfig.title === '账套管理'
    return {
      ...baseConfig,
      description: isAccountManagement
        ? '维护本地企业档案、会计制度、启用账期和进入账套入口。采集、授权等外部能力由合法 adapter 单独接入。'
        : '集中查看本地客户账套、纳税人性质、启用账期和账套状态；业务进度在进入对应账套后处理。',
      summary: isAccountManagement
        ? [
            { label: '本地账套', value: '0 户', tone: 'blue' },
            { label: '一般纳税人', value: '0 户', tone: 'green' },
            { label: '小规模纳税人', value: '0 户', tone: 'amber' },
            { label: '已停用', value: '0 户', tone: 'red' },
          ]
        : [
            { label: '本地客户', value: '0 户', tone: 'blue' },
            { label: '启用账套', value: '0 户', tone: 'green' },
            { label: '一般纳税人', value: '0 户', tone: 'amber' },
            { label: '已停用', value: '0 户', tone: 'red' },
          ],
      keywordPlaceholder: isAccountManagement
        ? '搜索企业名称、编码、纳税人识别号、地区'
        : '搜索客户名称、编码、纳税人识别号、行业',
      columns: isAccountManagement
        ? [
            { key: 'code', label: '编码' },
            { key: 'name', label: '企业名称' },
            { key: 'taxId', label: '纳税人识别号' },
            { key: 'region', label: '地区' },
            { key: 'taxType', label: '纳税人资格' },
            { key: 'accountingSystem', label: '会计制度' },
            { key: 'enablePeriod', label: '启用账期', align: 'center' },
            { key: 'industry', label: '会计行业' },
            { key: 'createdAt', label: '建档时间' },
            { key: 'accountStatus', label: '账套状态' },
          ]
        : [
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
      queueTitle: isAccountManagement ? '账套说明' : '客户说明',
      queue: isAccountManagement
        ? ['本地企业档案以 SQLite 公司表为准，启用账期由企业建档信息决定。', '税务采集、授权、主管税务机关等外部信息需通过合法 adapter 写入后再展示。']
        : ['客户总览只列出本地企业事实，不伪造发票、凭证、申报或风险数量。', '进入账套后查看该客户的发票、凭证、报表和税务处理。'],
      notes: ['桌面端无企业记录时显示空表，浏览器预览使用现有静态布局样例。'],
    }
  }

  if (baseConfig.title !== '服务合同') return baseConfig

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
      rows: [
        { id: 'preview-fee-001', status: '已完成', values: { customer: '科旋电气（上海）有限公司', period: '2026-05', receivable: '¥2,800.00', received: '¥2,800.00', arrears: '¥0.00', invoice: '已开票', payment: '已收款', collector: '张会计', followUp: '2026-05-31' } },
        { id: 'preview-fee-002', status: '待确认', values: { customer: '上海云启科技有限公司', period: '2026-05', receivable: '¥1,200.00', received: '¥0.00', arrears: '¥1,200.00', invoice: '待开票', payment: '待催收', collector: '李会计', followUp: '2026-06-18' } },
      ],
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
      rows: [
        { id: 'preview-collaboration-001', status: '待确认', values: { customer: '上海云启科技有限公司', todo: '补充管理费用合同', material: '合同附件', contact: '王女士', reminder: '2 次', lastContact: '2026-06-18 10:30', reply: '待客户答复', owner: '李会计' } },
        { id: 'preview-collaboration-002', status: '异常', values: { customer: '杭州辰光贸易有限公司', todo: '补传销项发票影像', material: '发票附件', contact: '陈先生', reminder: '4 次', lastContact: '2026-06-17 16:20', reply: '超时', owner: '王会计' } },
      ],
      queueTitle: '协同待办',
      queue: ['资料补充、催办和客户答复在机构层统一跟进。', '资料进入账套后由对应的发票、单据或凭证模块继续处理。'],
      notes: ['协同事项不替代单账套业务处理，只保存跨客户服务交付跟进。', '桌面端仅展示本地协同事项和审计留痕。'],
    }
  }

  return baseConfig
}

function summarizeAgencyTabRows(config: AgencyConfig, rows: AgencyRow[]) {
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

export function AgencyModulePage({ kind }: AgencyModulePageProps) {
  const navigate = useNavigate()
  const { fetchCompanies, selectCompany } = useCompanyStore()
  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()
  const baseConfig = configs[kind]
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [localRows, setLocalRows] = useState<AgencyRow[]>([])
  const pageConfig = useMemo(() => getAgencyTabConfig(config, activeTab, isTauri), [activeTab, config])
  const overviewRows = useMemo(
    () => agencyOverview ? mapAgencyOverviewRows(agencyOverview, activeTab) : [],
    [activeTab, agencyOverview]
  )
  const rows = [
    ...localRows,
    ...(kind === 'downloadCenter' ? pageConfig.rows : isTauri && kind === 'dataStats'
      ? overviewRows
      : isTauri ? remoteRows ?? [] : remoteRows ?? pageConfig.rows),
  ]
  const summary = useMemo(
    () => {
      if (isTauri && kind === 'dataStats' && agencyOverview) return summarizeAgencyOverview(agencyOverview)
      return isTauri && remoteRows !== null ? summarizeAgencyTabRows(pageConfig, remoteRows) : pageConfig.summary
    },
    [agencyOverview, kind, pageConfig, remoteRows]
  )
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => Object.values(row.values).some((value) => value.toLowerCase().includes(q)))
  }, [rows, query])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, filteredRows.length)
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [kind, activeTab, query, pageSize])

  useEffect(() => {
    setActiveTab(config.tabs[0])
  }, [kind, config.tabs])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const loadRemoteRows = async () => {
    setIsLoadingRows(true)
    try {
      if (kind === 'clients' || kind === 'accountManagement') {
        if (!isTauri) {
          setRemoteRows(null)
          return
        }
        await fetchCompanies()
        const liveCompanies = useCompanyStore.getState().companies
        setRemoteRows(liveCompanies.map((item) => mapAgencyCompanyRow(item, kind)))
        return
      }

      if (kind === 'dataStats') {
        if (!isTauri) {
          setAgencyOverview(null)
          setRemoteRows(null)
          return
        }
        const response = await agencyApi.getOverview()
        if (!response.success) throw new Error(response.error || '机构统计读取失败')
        setAgencyOverview(response.data ?? null)
        setRemoteRows([])
        return
      }

      if (kind === 'downloadCenter') {
        setRemoteRows(null)
        return
      }

      const nextRows = await fetchAgencyRows(kind, activeTab)
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
    setLocalRows([])
    setOperationNotice(null)
    void loadRemoteRows()
  }, [activeTab, fetchCompanies, kind])

  const writeAgencyAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    recordAuditLog({
      module: `机构-${pageConfig.title}`,
      action,
      object,
      level,
      result,
      status: result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过',
      voucher: `${activeTab}/${query.trim() || '全部'}`,
      attachment: '操作快照',
    })
  }

  const rowObjectLabel = (row: AgencyRow) => {
    return row.values.name || row.values.customer || row.values.fileName || row.values.task || row.values.contractNo || row.values.code || row.id
  }

  const handleViewRow = (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    writeAgencyAudit('查看明细', `${pageConfig.title}-${object}`)
    setOperationNotice(`已打开 ${object} 的机构级明细留痕；后续会接入附件、来源任务和操作快照。`)
  }

  const handleProcessRow = (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    const isRisky = row.status === '异常' || kind === 'batchOps' || kind === 'authorizationCenter' || kind === 'healthCheck'
    writeAgencyAudit('处理行任务', `${pageConfig.title}-${object}`, isRisky ? '高' : '中', isRisky ? '待审批' : '成功')
    setOperationNotice(
      isRisky
        ? `${object} 已进入机构级待审批队列；批量采集、授权、申报和高风险处理不会自动提交外部系统。`
        : `${object} 已记录处理动作，后续将接入具体表单、附件和审批流。`
    )
  }

  const handleEnterAccount = async (row: AgencyRow) => {
    const object = rowObjectLabel(row)
    writeAgencyAudit('进入账套', `${pageConfig.title}-${object}`)
    if (isTauri && (kind === 'clients' || kind === 'accountManagement')) {
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
    writeAgencyAudit('导入资料', `${pageConfig.title}-导入批次`, '中', '待审批')
    setOperationNotice('导入任务已进入待确认留痕；后续会接入文件选择、字段映射和错误清单。')
  }

  const handlePrimaryAction = async () => {
    if (kind === 'dataStats') {
      writeAgencyAudit('刷新统计', `${pageConfig.title}-${activeTab}`)
      void loadRemoteRows()
      setOperationNotice('正在重新读取本地服务合同、收费、协同和交付工单汇总。')
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

    if (kind === 'downloadCenter') {
      writeAgencyAudit('刷新文件清单', `${pageConfig.title}-${activeTab}`)
      setOperationNotice('已刷新本机导出文件记录；过期文件需回到原模块重新生成。')
      return
    }

    if (kind !== 'batchOps') {
      writeAgencyAudit(pageConfig.primaryAction, `${pageConfig.title}-${activeTab}`, '中', '待审批')
      setOperationNotice(`${pageConfig.primaryAction} 已进入机构审计日志，等待后续表单和审批流接入。`)
      return
    }

    if (isTauri) {
      const response = await agencyApi.createBatchTasks({ period: '2026-05', operator: 'admin' })
      if (!response.success) {
        setOperationNotice(response.error || '批量预检任务创建失败。')
        return
      }
      await loadRemoteRows()
      writeAgencyAudit('新建批量任务', '批量采集发票/流水/结账预检/申报预检', '高', '待审批')
      setOperationNotice('已写入本地批量预检队列；采集、结账和申报均需后续人工确认，不会自动提交税局或银行。')
      return
    }

    const started = new Date().toLocaleString('zh-CN')
    const nextRows: AgencyRow[] = [
      { id: `local-batch-invoice-${Date.now()}`, status: '进行中', values: { task: '批量采集发票', scope: '全部授权客户', period: '2026-05', progress: '0/待计算', operator: 'admin', started, result: '检查税局授权后执行' } },
      { id: `local-batch-bank-${Date.now()}`, status: '进行中', values: { task: '批量采集银行流水', scope: '已授权银行客户', period: '2026-05', progress: '0/待计算', operator: 'admin', started, result: '检查银行授权后执行' } },
      { id: `local-batch-close-${Date.now()}`, status: '待确认', values: { task: '批量结账预检', scope: '待结账客户', period: '2026-05', progress: '待预检', operator: 'admin', started, result: '需完成风险检查' } },
      { id: `local-batch-tax-${Date.now()}`, status: '待确认', values: { task: '批量申报预检', scope: '待申报税种', period: '2026-05', progress: '待预检', operator: 'admin', started, result: '只生成申报包，不自动提交税局' } },
    ]
    setLocalRows((current) => [...nextRows, ...current].slice(0, 12))
    writeAgencyAudit('新建批量任务', '批量采集发票/流水/结账预检/申报预检', '高', '待审批')
    setOperationNotice('已创建批量采集、批量结账预检和批量申报预检任务；当前只进入队列和审计日志，不自动提交税局或银行。')
  }

  const handleExportExcel = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-2026-05.xlsx`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    await exportRowsToXlsx({
      sheetRows: buildAgencySheetRows(pageConfig, filteredRows, exportedAt, activeTab, query.trim()),
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
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-2026-05-print`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    const html = buildAgencyPrintHtml(pageConfig, filteredRows, exportedAt, activeTab, query.trim())
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
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
  }

  const handleExportPdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${pageConfig.title}-2026-05.pdf`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    await exportHtmlToPdf({
      html: buildAgencyPrintHtml(pageConfig, filteredRows, exportedAt, activeTab, query.trim()),
      fileName,
      pageTitle: `${pageConfig.title} 2026-05`,
    })
    recordExportJob({
      fileName,
      moduleName: `机构-${pageConfig.title}`,
      format: 'PDF',
      scope,
      templateKind: 'agency',
      rowCount: filteredRows.length,
    })
  }

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-1.5">
          <div className="min-w-0">
            <h1 className="text-base font-semibold">{pageConfig.title}</h1>
            <p className="text-xs text-slate-500">{pageConfig.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ToolButton icon={<RefreshCw className={cn('h-3.5 w-3.5', isLoadingRows && 'animate-spin')} />} label="刷新" onClick={handleRefresh} />
            <ToolButton icon={<Upload className="h-3.5 w-3.5" />} label="导入" onClick={handleImport} />
            <ToolButton icon={<Download className="h-3.5 w-3.5" />} label="导出Excel" onClick={handleExportExcel} />
            <ToolButton icon={<FileText className="h-3.5 w-3.5" />} label="导出PDF" onClick={handleExportPdf} />
            <ToolButton icon={<Printer className="h-3.5 w-3.5" />} label="打印" onClick={handlePrint} />
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
          <ToolButton icon={<Filter className="h-3.5 w-3.5" />} label="筛选" />
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
                        <button type="button" onClick={() => handleProcessRow(row)} className="mr-2 text-[#1f65a7] hover:underline">
                          处理
                        </button>
                        {(kind === 'clients' || kind === 'accountManagement') && (
                          <button type="button" onClick={() => handleEnterAccount(row)} className="text-[#1f65a7] hover:underline">
                            进入账套
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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

async function fetchAgencyRows(kind: AgencyModuleKind, activeTab: string): Promise<AgencyRow[]> {
  if (kind === 'automation') {
    const response = await agencyApi.getAutomationJobs()
    if (!response.success) throw new Error(response.error || '自动化任务读取失败')
    const rows = (response.data ?? []).map(mapAgencyAutomationJobRow)
    if (activeTab === '识别任务') return rows.filter((row) => row.values.name.includes('识别'))
    if (activeTab === '凭证建议') return rows.filter((row) => row.values.name.includes('凭证'))
    return rows
  }

  if (kind === 'healthCheck') {
    const response = await agencyApi.getHealthChecks()
    if (!response.success) throw new Error(response.error || '健康检查读取失败')
    const rows = (response.data ?? []).map(mapAgencyHealthCheckRow)
    if (activeTab === '发票风险') return rows.filter((row) => row.values.module === '发票')
    if (activeTab === '税务风险') return rows.filter((row) => row.values.module === '税务申报')
    if (activeTab === '交付风险') return rows.filter((row) => row.values.module === '交付')
    return rows
  }

  if (kind === 'batchOps') {
    const response = await agencyApi.getBatchTasks()
    if (!response.success) throw new Error(response.error || '批量任务读取失败')
    return (response.data ?? []).map(mapAgencyBatchTaskRow)
  }

  if (kind === 'authorizationCenter') {
    const response = await agencyApi.getAuthorizations()
    if (!response.success) throw new Error(response.error || '授权记录读取失败')
    return (response.data ?? []).map(mapAgencyAuthorizationRow)
  }

  if (kind === 'invoiceManagement') {
    const response = await agencyApi.getFeeCollections()
    if (!response.success) throw new Error(response.error || '服务费开票记录读取失败')
    const rows = (response.data ?? []).map(mapAgencyInvoiceManagementRow)
    if (activeTab === '待开票') return rows.filter((row) => row.values.invoice !== '已开票')
    if (activeTab === '已开票') return rows.filter((row) => row.values.invoice === '已开票')
    if (activeTab === '异常状态') return rows.filter((row) => row.status === '异常')
    return rows
  }

  if (kind === 'serviceContracts' && activeTab === '收费管理') {
    const response = await agencyApi.getFeeCollections()
    if (!response.success) throw new Error(response.error || '收费记录读取失败')
    return response.data?.map(mapFeeCollectionRow) ?? []
  }

  if (kind === 'serviceContracts' && activeTab === '客户协同') {
    const response = await agencyApi.getCollaborationItems()
    if (!response.success) throw new Error(response.error || '协同事项读取失败')
    return response.data?.map(mapCollaborationItemRow) ?? []
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
    status: mapAgencyBatchTaskStatus(item.status, item.requiresApproval),
    values: {
      task: item.taskName,
      scope: item.customerScope,
      period: item.period,
      progress: item.progressTotal === null ? `${item.progressCurrent}/待计算` : `${item.progressCurrent}/${item.progressTotal}`,
      operator: item.operator || '-',
      started: item.createdAt,
      result: item.resultSummary || '-',
    },
  }
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
      statusText: item.authStatus,
      expireAt: item.expiresAt || '-',
      lastCollect: item.lastCheckedAt || '-',
      risk: item.riskMessage || '无',
    },
  }
}

function mapAgencyCompanyRow(item: Company, kind: AgencyModuleKind): AgencyRow {
  const taxType = item.tax_type === 'general' ? '一般纳税人' : item.tax_type === 'small' ? '小规模纳税人' : '未设置'
  const accountingSystem = formatAccountingSystem(item.accounting_system)
  const enablePeriod = item.enable_year && item.enable_month
    ? `${item.enable_year}-${String(item.enable_month).padStart(2, '0')}`
    : '未设置'
  const accountStatus = item.is_active ? '启用' : '停用'
  const values = {
    code: item.code || '-',
    name: item.name,
    taxId: item.tax_id || '-',
    region: [item.province, item.city].filter(Boolean).join(' ') || '-',
    taxType,
    accountingSystem,
    enablePeriod,
    industry: item.industry || '-',
    createdAt: item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '-',
    accountStatus,
  }

  return {
    id: item.id,
    status: item.is_active ? '进行中' : '异常',
    values: kind === 'accountManagement' ? values : {
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
    },
  }
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
      invoice: item.invoiceStatus,
      payment: item.paymentStatus,
      collector: item.collector || '-',
      followUp: item.lastFollowUp || '-',
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

function mapAuthorizationStatus(authStatus: string, expiresAt: string | null, riskMessage: string | null): AgencyRow['status'] {
  const value = `${authStatus} ${expiresAt || ''} ${riskMessage || ''}`.toLowerCase()
  if (value.includes('expired') || value.includes('invalid') || value.includes('failed') || value.includes('异常') || value.includes('失效')) return '异常'
  if (value.includes('pending') || value.includes('待')) return '待确认'
  if (value.includes('valid') || value.includes('authorized') || value.includes('normal') || value.includes('有效') || value.includes('正常')) return '已完成'
  return '待处理'
}

function mapAgencyBatchTaskStatus(status: string, requiresApproval: boolean): AgencyRow['status'] {
  const normalized = status.toLowerCase()
  if (normalized === 'completed') return '已完成'
  if (normalized === 'failed' || normalized === 'blocked') return '异常'
  if (normalized === 'running' || normalized === 'processing') return '进行中'
  if (normalized === 'awaiting_approval' || (normalized === 'queued' && requiresApproval)) return '待确认'
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

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">
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

function buildAgencySheetRows(config: AgencyConfig, rows: AgencyRow[], exportedAt: string, activeTab: string, keyword: string) {
  return [
    [config.title],
    ['机构', 'AI 代理记账', '所属期', '2026-05', '当前视图', activeTab],
    ['导出时间', exportedAt, '筛选关键字', keyword || '全部', '记录数', `${rows.length}`],
    [],
    ['状态', ...config.columns.map((column) => column.label)],
    ...rows.map((row) => [row.status, ...config.columns.map((column) => row.values[column.key] || '')]),
    [],
    ['制表说明', `${config.title} 按当前筛选全集导出，后续可与固定模板、签章和归档目录绑定。`],
  ]
}

function buildAgencyPrintHtml(config: AgencyConfig, rows: AgencyRow[], exportedAt: string, activeTab: string, keyword: string) {
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
    <span>所属期: 2026-05</span>
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
