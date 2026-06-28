import { useEffect, useMemo, useState } from 'react'
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
  type AgencyServiceContract,
} from '../../lib/api'
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
    description: '统一管理跨客户导出文件、账簿报表、申报包、回执缴款书、附件压缩包和归档下载。',
    tabs: ['最近7天', 'Excel', 'PDF', 'ZIP归档包', '申报包', '回执缴款书', '失败任务'],
    primaryAction: '批量下载',
    keywordPlaceholder: '搜索文件名、客户、生成状态、发起人',
    summary: [
      { label: '可下载文件', value: '64 个', tone: 'blue' },
      { label: '今日生成', value: '18 个', tone: 'green' },
      { label: '生成中', value: '5 个', tone: 'amber' },
      { label: '失败', value: '2 个', tone: 'red' },
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
    rows: [
      { id: 'dl-001', status: '已完成', values: { fileName: '科旋电气-记账凭证-202605.pdf', customer: '科旋电气（上海）有限公司', type: 'PDF', period: '2026-05', statusText: '已生成', createdAt: '06-26 16:59', creator: '张会计', expireAt: '7天后', hash: 'a8f2...19c' } },
      { id: 'dl-002', status: '进行中', values: { fileName: '全部客户-申报包-202606.zip', customer: '36 户客户', type: 'ZIP', period: '2026-06', statusText: '生成中 68%', createdAt: '06-26 17:20', creator: '主管会计', expireAt: '7天后', hash: '生成中' } },
      { id: 'dl-003', status: '异常', values: { fileName: '杭州辰光-明细账-202605.xlsx', customer: '杭州辰光贸易有限公司', type: 'Excel', period: '2026-05', statusText: '生成失败', createdAt: '06-26 15:42', creator: '王会计', expireAt: '-', hash: '缺少模板' } },
    ],
    queueTitle: '下载规则',
    queue: ['默认只展示最近 7 天生成文件，过期后需重新生成', '批量下载保留文件清单、生成状态、发起人和哈希摘要', '申报包和回执下载需受客户范围权限控制'],
    notes: ['下载中心用于机构层跨客户文件，不替代单账套内当前模块的导出按钮。', '后续导出文件应接入固定 Excel/PDF 模板和归档目录。'],
  },
  dataStats: {
    title: '数据统计',
    description: '统计机构客户做账效率、收票率、凭证量、申报进度和风险分布。',
    tabs: ['经营概览', '客户进度', '收票统计', '凭证统计', '申报统计', '人员绩效'],
    primaryAction: '刷新统计',
    keywordPlaceholder: '搜索客户、负责人、统计口径',
    summary: [
      { label: '月处理凭证', value: '4,862 张', tone: 'blue' },
      { label: '平均收票率', value: '83.6%', tone: 'green' },
      { label: '逾期客户', value: '9 户', tone: 'red' },
      { label: '自动生成率', value: '71.4%', tone: 'amber' },
    ],
    columns: [
      { key: 'owner', label: '负责人' },
      { key: 'clients', label: '客户数', align: 'right' },
      { key: 'invoices', label: '发票数', align: 'right' },
      { key: 'vouchers', label: '凭证数', align: 'right' },
      { key: 'autoRate', label: '自动化率', align: 'right' },
      { key: 'taxDone', label: '申报完成率', align: 'right' },
      { key: 'risk', label: '风险项', align: 'right' },
    ],
    rows: [
      { id: 'st-001', status: '已完成', values: { owner: '张会计', clients: '36', invoices: '1,426', vouchers: '1,286', autoRate: '76.2%', taxDone: '91.7%', risk: '8' } },
      { id: 'st-002', status: '进行中', values: { owner: '李会计', clients: '42', invoices: '1,108', vouchers: '984', autoRate: '69.8%', taxDone: '82.1%', risk: '13' } },
      { id: 'st-003', status: '异常', values: { owner: '王会计', clients: '31', invoices: '842', vouchers: '617', autoRate: '63.5%', taxDone: '74.2%', risk: '21' } },
    ],
    queueTitle: '统计口径',
    queue: ['收票率=已采集发票/客户预估发票', '自动化率=自动生成且已确认凭证/总凭证', '风险项按未处理状态统计'],
    notes: ['这个模块用于机构负责人看整体产能，不混在单客户账套里。', '后续可接入真实数据库做跨客户聚合。'],
  },
  batchOps: {
    title: '批量操作',
    description: '集中执行批量采集发票、采集银行流水、生成凭证、结转结账、批量申报、回执归档、反结账审批和资料归档。',
    tabs: ['操作任务', '批量采集', '批量生成', '批量结账', '批量申报', '申报回执', '审批记录', '执行日志'],
    primaryAction: '新建任务',
    keywordPlaceholder: '搜索任务、客户、操作人、执行状态',
    summary: [
      { label: '待执行', value: '14 个', tone: 'amber' },
      { label: '执行中', value: '3 个', tone: 'blue' },
      { label: '已完成', value: '52 个', tone: 'green' },
      { label: '失败', value: '4 个', tone: 'red' },
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
    rows: [
      { id: 'op-001', status: '进行中', values: { task: '批量采集发票', scope: '36 户', period: '2026-05', progress: '28/36', operator: '张会计', started: '06-26 08:30', result: '8 户待授权' } },
      { id: 'op-002', status: '进行中', values: { task: '批量采集银行流水', scope: '23 户', period: '2026-05', progress: '16/23', operator: '张会计', started: '06-26 09:10', result: '执行中' } },
      { id: 'op-003', status: '待处理', values: { task: '批量生成银行流水凭证', scope: '23 户', period: '2026-05', progress: '0/23', operator: '李会计', started: '待执行', result: '排队' } },
      { id: 'op-004', status: '待处理', values: { task: '批量结账', scope: '18 户', period: '2026-05', progress: '0/18', operator: '王会计', started: '待执行', result: '需先完成风险检查' } },
      { id: 'op-005', status: '待确认', values: { task: '批量申报与回执归档', scope: '68 项税种', period: '2026-05', progress: '41/68', operator: '主管会计', started: '06-26 10:20', result: '12 项待确认' } },
      { id: 'op-006', status: '异常', values: { task: '批量反结账审批', scope: '6 户', period: '2026-05', progress: '2/6', operator: '机构管理员', started: '06-26 11:10', result: '4 项阻断复核' } },
      { id: 'op-007', status: '异常', values: { task: '批量期末结转', scope: '8 户', period: '2026-05', progress: '5/8', operator: '王会计', started: '06-25 18:30', result: '3 户失败' } },
    ],
    queueTitle: '执行控制',
    queue: ['批量采集需读取客户维护的税局和银行授权状态', '批量结账前必须完成凭证断号、报表平衡和税务风险检查', '批量申报、回执缴款书和扣款归档在同一任务内流转', '高风险客户自动跳过并进入审批记录', '所有任务保留执行日志和回滚说明'],
    notes: ['批量操作用于机构级效率提升，单账套页面仍保留逐户处理入口。', '申报确认、回执归档、删除、反结账等高风险动作合并在批量操作内二次确认和审批。'],
  },
  invoiceManagement: {
    title: '开票管理',
    description: '机构维度管理服务费开票、客户开票授权、发票抬头、开票申请、红冲作废和开票归档。',
    tabs: ['开票申请', '待开票', '已开票', '红冲作废', '抬头管理', '开票记录'],
    primaryAction: '新建开票申请',
    keywordPlaceholder: '搜索客户、合同、发票抬头、开票状态',
    summary: [
      { label: '待开票', value: '26 张', tone: 'amber' },
      { label: '本月已开', value: '108 张', tone: 'green' },
      { label: '待确认抬头', value: '9 户', tone: 'blue' },
      { label: '异常/红冲', value: '3 张', tone: 'red' },
    ],
    columns: [
      { key: 'customer', label: '客户名称' },
      { key: 'contract', label: '关联合同' },
      { key: 'invoiceTitle', label: '发票抬头' },
      { key: 'taxId', label: '税号' },
      { key: 'amount', label: '开票金额', align: 'right' },
      { key: 'type', label: '发票类型' },
      { key: 'status', label: '开票状态' },
      { key: 'owner', label: '负责人' },
    ],
    rows: [
      { id: 'im-001', status: '待确认', values: { customer: '科旋电气（上海）有限公司', contract: 'FW-2026-0018', invoiceTitle: '科旋电气（上海）有限公司', taxId: '91310115MA1K3****X', amount: '¥2,800.00', type: '数电专票', status: '待客户确认抬头', owner: '张会计' } },
      { id: 'im-002', status: '进行中', values: { customer: '上海云启科技有限公司', contract: 'FW-2026-0042', invoiceTitle: '上海云启科技有限公司', taxId: '91310113MA1G****2Q', amount: '¥1,200.00', type: '数电普票', status: '待开票', owner: '李会计' } },
      { id: 'im-003', status: '异常', values: { customer: '杭州辰光贸易有限公司', contract: 'FW-2025-0091', invoiceTitle: '杭州辰光贸易有限公司', taxId: '91330106MA2H****8P', amount: '¥3,200.00', type: '数电专票', status: '红冲申请待复核', owner: '王会计' } },
    ],
    queueTitle: '开票控制',
    queue: ['服务费开票只处理机构自身收入，不混入客户账套经营发票', '开票前校验合同、收费、抬头和税号', '红冲作废必须保留原票、申请原因和审核日志'],
    notes: ['开票管理是机构层模块，服务合同和收费管理产生开票申请。', '客户账套内经营发票仍在单账套的销项发票模块处理。'],
  },
  healthCheck: {
    title: '健康体检',
    description: '跨客户扫描发票、凭证、科目、报表、税表和结账风险。',
    tabs: ['体检总览', '发票风险', '凭证风险', '报表风险', '税务风险', '整改记录'],
    primaryAction: '开始体检',
    keywordPlaceholder: '搜索客户、风险项、责任人、整改状态',
    summary: [
      { label: '扫描客户', value: '96 户', tone: 'blue' },
      { label: '高风险', value: '18 项', tone: 'red' },
      { label: '中风险', value: '42 项', tone: 'amber' },
      { label: '已整改', value: '63 项', tone: 'green' },
    ],
    columns: [
      { key: 'customer', label: '客户名称' },
      { key: 'module', label: '模块' },
      { key: 'risk', label: '风险说明' },
      { key: 'level', label: '级别', align: 'center' },
      { key: 'owner', label: '责任人' },
      { key: 'deadline', label: '截止时间' },
      { key: 'fix', label: '整改状态' },
    ],
    rows: [
      { id: 'hc-001', status: '异常', values: { customer: '杭州辰光贸易有限公司', module: '发票', risk: '销项票少于银行收款匹配金额', level: '高', owner: '王会计', deadline: '06-27', fix: '待整改' } },
      { id: 'hc-002', status: '待确认', values: { customer: '上海云启科技有限公司', module: '报表', risk: '利润表收入与增值税销售额差异', level: '中', owner: '李会计', deadline: '06-28', fix: '待复核' } },
      { id: 'hc-003', status: '已完成', values: { customer: '科旋电气（上海）有限公司', module: '凭证', risk: '费用科目缺少部门辅助核算', level: '低', owner: '张会计', deadline: '06-25', fix: '已整改' } },
    ],
    queueTitle: '体检规则',
    queue: ['发票、流水、凭证三方金额核对', '报表勾稽和税表取数一致性检查', '结账前必须处理高风险阻断项'],
    notes: ['健康体检是竞品常见的机构级风控入口，适合放在外层导航。', '风险规则应可配置，并能回链到具体发票、凭证或报表。'],
  },
  automation: {
    title: '财税自动化',
    description: '管理自动采票、自动识票、自动匹配、自动生成凭证和自动申报前置任务。',
    tabs: ['任务看板', '采票任务', '识别任务', '匹配规则', '凭证任务', '申报任务'],
    primaryAction: '新建自动化',
    keywordPlaceholder: '搜索任务、客户、触发器、执行结果',
    summary: [
      { label: '启用任务', value: '36 个', tone: 'blue' },
      { label: '今日执行', value: '148 次', tone: 'green' },
      { label: '需确认', value: '19 项', tone: 'amber' },
      { label: '失败', value: '6 项', tone: 'red' },
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
    rows: [
      { id: 'au-001', status: '进行中', values: { name: '每日采集进销项发票', trigger: '每日 08:30', scope: '全部客户', lastRun: '06-26 08:30', confidence: '92%', confirm: '异常需确认', result: '执行中' } },
      { id: 'au-002', status: '待确认', values: { name: '银行流水自动生成凭证', trigger: '导入后', scope: '已授权客户', lastRun: '06-26 09:05', confidence: '86%', confirm: '21 条待确认', result: '待复核' } },
      { id: 'au-003', status: '异常', values: { name: '申报表自动取数', trigger: '结账后', scope: '一般纳税人', lastRun: '06-25 20:10', confidence: '78%', confirm: '必须确认', result: '税表差异' } },
    ],
    queueTitle: 'AI控制边界',
    queue: ['AI 只能生成建议和草稿，凭证入账前需确认', '自动申报只到申报包和待提交状态', '每条建议保留来源、置信度和人工处理日志'],
    notes: ['AI 是额外增强功能，必须解释来源和置信度，不能黑箱直接入账或报税。', '后续可接入 OCR、票据解析、规则引擎和税表取数 adapter。'],
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

export function AgencyModulePage({ kind }: AgencyModulePageProps) {
  const baseConfig = configs[kind]
  const exportJobs = useExportJobs()
  const config = useMemo(() => {
    if (kind !== 'downloadCenter') return baseConfig
    const dynamicRows = exportJobs.map(exportJobToAgencyRow)
    return {
      ...baseConfig,
      rows: [...dynamicRows, ...baseConfig.rows],
      summary: baseConfig.summary.map((item) => {
        if (item.label === '可下载文件') return { ...item, value: `${dynamicRows.length + baseConfig.rows.length} 个` }
        if (item.label === '今日生成') return { ...item, value: `${dynamicRows.length + 18} 个` }
        return item
      }),
    }
  }, [baseConfig, exportJobs, kind])
  const [remoteRows, setRemoteRows] = useState<AgencyRow[] | null>(null)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [activeTab, setActiveTab] = useState(config.tabs[0])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [localRows, setLocalRows] = useState<AgencyRow[]>([])
  const rows = [...localRows, ...(remoteRows && remoteRows.length > 0 ? remoteRows : config.rows)]
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
      const nextRows = await fetchAgencyRows(kind)
      setRemoteRows(nextRows.length > 0 ? nextRows : null)
    } catch {
      setRemoteRows(null)
    } finally {
      setIsLoadingRows(false)
    }
  }

  useEffect(() => {
    setRemoteRows(null)
    setLocalRows([])
    setOperationNotice(null)
    void loadRemoteRows()
  }, [kind])

  const writeAgencyAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    recordAuditLog({
      module: `机构-${config.title}`,
      action,
      object,
      level,
      result,
      status: result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过',
      voucher: `${activeTab}/${query.trim() || '全部'}`,
      attachment: '操作快照',
    })
  }

  const handleRefresh = () => {
    writeAgencyAudit('刷新列表', `${config.title}-${activeTab}`)
    void loadRemoteRows()
  }

  const handleImport = () => {
    writeAgencyAudit('导入资料', `${config.title}-导入批次`, '中', '待审批')
    setOperationNotice('导入任务已进入待确认留痕；后续会接入文件选择、字段映射和错误清单。')
  }

  const handlePrimaryAction = () => {
    if (kind !== 'batchOps') {
      writeAgencyAudit(config.primaryAction, `${config.title}-${activeTab}`, '中', '待审批')
      setOperationNotice(`${config.primaryAction} 已进入机构审计日志，等待后续表单和审批流接入。`)
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
    const fileName = `${config.title}-2026-05.xlsx`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    await exportRowsToXlsx({
      sheetRows: buildAgencySheetRows(config, filteredRows, exportedAt, activeTab, query.trim()),
      columnWidths: [{ wch: 18 }, { wch: 12 }, ...config.columns.map((column) => ({ wch: Math.max(14, column.label.length * 3) }))],
      sheetName: config.title,
      fileName,
    })
    recordExportJob({
      fileName,
      moduleName: `机构-${config.title}`,
      format: 'Excel',
      scope,
      templateKind: 'agency',
      rowCount: filteredRows.length,
    })
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${config.title}-2026-05-print`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    const html = buildAgencyPrintHtml(config, filteredRows, exportedAt, activeTab, query.trim())
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    recordExportJob({
      fileName,
      moduleName: `机构-${config.title}`,
      format: '打印预览',
      scope,
      templateKind: 'agency',
      rowCount: filteredRows.length,
    })
  }

  const handleExportPdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `${config.title}-2026-05.pdf`
    const scope = `${activeTab}/${query.trim() || '全部'}`
    await exportHtmlToPdf({
      html: buildAgencyPrintHtml(config, filteredRows, exportedAt, activeTab, query.trim()),
      fileName,
      pageTitle: `${config.title} 2026-05`,
    })
    recordExportJob({
      fileName,
      moduleName: `机构-${config.title}`,
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
            <h1 className="text-base font-semibold">{config.title}</h1>
            <p className="text-xs text-slate-500">{config.description}</p>
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
              {config.primaryAction}
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
          {config.summary.map((item) => (
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
              placeholder={config.keywordPlaceholder}
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
                    {config.columns.map((column) => (
                      <th key={column.key} className={cn('border-b border-r border-slate-300 px-2 py-2', alignClass(column.align))}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#f8fbff]">
                      <td className="border-b border-r border-slate-200 px-2 py-2"><input type="checkbox" /></td>
                      <td className="border-b border-r border-slate-200 px-2 py-2"><StatusBadge value={row.status} /></td>
                      {config.columns.map((column) => (
                        <td key={column.key} className={cn('border-b border-r border-slate-200 px-2 py-2', alignClass(column.align))}>
                          {row.values[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#f8fafc]">
                  <tr>
                    <td className="border-t border-r border-slate-200 px-2 py-2" />
                    <td className="border-t border-r border-slate-200 px-2 py-2 font-semibold" colSpan={Math.max(config.columns.length, 1)}>本页小计</td>
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
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">{config.queueTitle}</div>
            <div className="space-y-2 p-3">
              {config.queue.map((item, index) => (
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
              {config.notes.map((note) => (
                <p key={note} className="text-xs leading-5 text-slate-600">{note}</p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

async function fetchAgencyRows(kind: AgencyModuleKind): Promise<AgencyRow[]> {
  if (kind === 'serviceContracts') {
    const response = await agencyApi.getServiceContracts()
    return response.data?.map(mapServiceContractRow) ?? []
  }
  return []
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

function mapAgencyStatus(primary: string, secondary = ''): AgencyRow['status'] {
  const value = `${primary} ${secondary}`.toLowerCase()
  if (value.includes('paid') || value.includes('completed') || value.includes('已确认')) return '已完成'
  if (value.includes('blocked') || value.includes('overdue') || value.includes('expiring') || value.includes('超时')) return '异常'
  if (value.includes('waiting') || value.includes('pending') || value.includes('待')) return '待确认'
  if (value.includes('active') || value.includes('processing')) return '进行中'
  return '待处理'
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
