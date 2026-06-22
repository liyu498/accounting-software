import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Download,
  FileDown,
  FilePlus2,
  Filter,
  Paperclip,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Upload,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { cn } from '../../lib/utils'

type ModuleKind =
  | 'invoiceSelection'
  | 'billList'
  | 'receipt'
  | 'documentRegister'
  | 'transfer'
  | 'employee'
  | 'payroll'
  | 'socialSecurity'
  | 'specialDeduction'
  | 'depreciation'
  | 'inventorySettings'
  | 'unitSettings'
  | 'riskCheck'
  | 'taxReport'
  | 'settingsData'
  | 'matchingRules'

interface BusinessModulePageProps {
  kind: ModuleKind
  title: string
  description: string
}

interface ModuleColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

interface ModuleRow {
  id: string
  status: '待处理' | '已匹配' | '已生成凭证' | '待确认' | '异常' | '启用' | '停用' | '已通过'
  voucher?: string
  attachment?: string
  values: Record<string, string>
}

interface ModuleConfig {
  keywordPlaceholder: string
  primaryAction: string
  importLabel: string
  statusOptions: string[]
  summary: { label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' }[]
  columns: ModuleColumn[]
  rows: ModuleRow[]
  notes: string[]
}

const moduleConfigs: Record<ModuleKind, ModuleConfig> = {
  invoiceSelection: {
    keywordPlaceholder: '搜索发票代码、号码、销方或购方名称',
    primaryAction: '勾选认证',
    importLabel: '同步票池',
    statusOptions: ['全部', '待勾选', '已勾选', '异常'],
    summary: [
      { label: '待勾选', value: '18 张', tone: 'amber' },
      { label: '可抵扣税额', value: '¥42,860.00', tone: 'blue' },
      { label: '已匹配凭证', value: '12 张', tone: 'green' },
      { label: '异常票据', value: '2 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '开票日期' },
      { key: 'number', label: '发票号码' },
      { key: 'seller', label: '销方名称' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'deduction', label: '勾选用途' },
    ],
    rows: [
      { id: 'fx-001', status: '待确认', voucher: '未生成', attachment: 'PDF', values: { date: '2026-05-06', number: '310026000142', seller: '上海云启科技有限公司', amount: '¥38,000.00', tax: '¥4,940.00', deduction: '增值税抵扣' } },
      { id: 'fx-002', status: '已匹配', voucher: '记-0058', attachment: 'OFD', values: { date: '2026-05-09', number: '310026000186', seller: '苏州材料供应链有限公司', amount: '¥126,500.00', tax: '¥16,445.00', deduction: '增值税抵扣' } },
      { id: 'fx-003', status: '异常', voucher: '未生成', attachment: 'PDF', values: { date: '2026-05-12', number: '310026000221', seller: '杭州设备服务有限公司', amount: '¥9,800.00', tax: '¥588.00', deduction: '税率需复核' } },
    ],
    notes: ['真实发票云票池同步需要合法税务接口；当前先保留同步入口和勾选状态。', '后续与进项发票、凭证草稿、税表取数联动。'],
  },
  billList: {
    keywordPlaceholder: '搜索账单摘要、对方户名、银行账号',
    primaryAction: '生成凭证',
    importLabel: '导入流水',
    statusOptions: ['全部', '未匹配', '已匹配', '异常'],
    summary: [
      { label: '本期流水', value: '96 笔', tone: 'blue' },
      { label: '收入金额', value: '¥821,300.00', tone: 'green' },
      { label: '支出金额', value: '¥574,920.00', tone: 'amber' },
      { label: '待匹配', value: '21 笔', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '交易日期' },
      { key: 'account', label: '银行账户' },
      { key: 'counterparty', label: '对方户名' },
      { key: 'summary', label: '摘要' },
      { key: 'income', label: '收入', align: 'right' },
      { key: 'expense', label: '支出', align: 'right' },
    ],
    rows: [
      { id: 'bill-001', status: '待处理', voucher: '未生成', attachment: '回单', values: { date: '2026-05-03', account: '工行基本户', counterparty: '上海辰光贸易有限公司', summary: '货款', income: '¥86,000.00', expense: '-' } },
      { id: 'bill-002', status: '已生成凭证', voucher: '记-0042', attachment: '回单', values: { date: '2026-05-08', account: '招行一般户', counterparty: '上海办公服务有限公司', summary: '房租', income: '-', expense: '¥18,000.00' } },
      { id: 'bill-003', status: '异常', voucher: '未生成', attachment: '无', values: { date: '2026-05-13', account: '工行基本户', counterparty: '个人转账', summary: '备用金', income: '-', expense: '¥5,000.00' } },
    ],
    notes: ['银行直连采集后续通过 adapter 接入；当前支持 Excel/CSV 导入与规则匹配。', 'AI 可基于摘要、对方户名、金额区间推荐科目和辅助核算。'],
  },
  receipt: {
    keywordPlaceholder: '搜索票据号码、出票方、用途',
    primaryAction: '登记票据',
    importLabel: '导入票据',
    statusOptions: ['全部', '待处理', '已背书', '已到期', '异常'],
    summary: [
      { label: '票据余额', value: '¥310,000.00', tone: 'blue' },
      { label: '本期新增', value: '7 张', tone: 'green' },
      { label: '30天内到期', value: '2 张', tone: 'amber' },
      { label: '异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'number', label: '票据号码' },
      { key: 'type', label: '票据类型' },
      { key: 'issuer', label: '出票方' },
      { key: 'dueDate', label: '到期日' },
      { key: 'amount', label: '票面金额', align: 'right' },
      { key: 'purpose', label: '用途' },
    ],
    rows: [
      { id: 'rcp-001', status: '待确认', voucher: '未生成', attachment: '影像', values: { number: 'E20260501001', type: '银行承兑', issuer: '上海客户A', dueDate: '2026-08-01', amount: '¥120,000.00', purpose: '收款' } },
      { id: 'rcp-002', status: '已生成凭证', voucher: '记-0061', attachment: '影像', values: { number: 'E20260506009', type: '商业承兑', issuer: '江苏客户B', dueDate: '2026-07-15', amount: '¥80,000.00', purpose: '背书付款' } },
      { id: 'rcp-003', status: '异常', voucher: '未生成', attachment: '无', values: { number: 'E20260509011', type: '银行承兑', issuer: '浙江客户C', dueDate: '2026-05-28', amount: '¥110,000.00', purpose: '待补附件' } },
    ],
    notes: ['票据模块后续与应收应付、银行回单、凭证来源链路打通。'],
  },
  documentRegister: {
    keywordPlaceholder: '搜索单据编号、业务类型、往来单位',
    primaryAction: '新增单据',
    importLabel: '批量导入',
    statusOptions: ['全部', '待审核', '已审核', '已生成凭证'],
    summary: [
      { label: '登记单据', value: '34 张', tone: 'blue' },
      { label: '已审核', value: '24 张', tone: 'green' },
      { label: '待生成凭证', value: '10 张', tone: 'amber' },
      { label: '附件缺失', value: '3 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '业务日期' },
      { key: 'code', label: '单据编号' },
      { key: 'type', label: '业务类型' },
      { key: 'partner', label: '往来单位' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'owner', label: '经办人' },
    ],
    rows: [
      { id: 'doc-001', status: '待确认', voucher: '未生成', attachment: '3 个', values: { date: '2026-05-02', code: 'DJ-202605-001', type: '费用报销', partner: '行政部', amount: '¥2,360.00', owner: '王会计' } },
      { id: 'doc-002', status: '已生成凭证', voucher: '记-0039', attachment: '2 个', values: { date: '2026-05-07', code: 'DJ-202605-008', type: '采购入库', partner: '供应商A', amount: '¥47,500.00', owner: '李会计' } },
      { id: 'doc-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { date: '2026-05-11', code: 'DJ-202605-014', type: '差旅报销', partner: '销售部', amount: '¥6,120.00', owner: '赵会计' } },
    ],
    notes: ['单据登记用于覆盖非发票、非银行流水来源，统一进入凭证草稿池。'],
  },
  transfer: {
    keywordPlaceholder: '搜索转出账户、转入账户、流水号',
    primaryAction: '新增转账',
    importLabel: '导入转账',
    statusOptions: ['全部', '待确认', '已生成凭证', '异常'],
    summary: [
      { label: '本期转账', value: '12 笔', tone: 'blue' },
      { label: '转账金额', value: '¥450,000.00', tone: 'green' },
      { label: '待确认', value: '4 笔', tone: 'amber' },
      { label: '异常', value: '1 笔', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '转账日期' },
      { key: 'from', label: '转出账户' },
      { key: 'to', label: '转入账户' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'fee', label: '手续费', align: 'right' },
      { key: 'serial', label: '流水号' },
    ],
    rows: [
      { id: 'tr-001', status: '已生成凭证', voucher: '记-0046', attachment: '回单', values: { date: '2026-05-04', from: '工行基本户', to: '招行一般户', amount: '¥200,000.00', fee: '¥0.00', serial: 'TR20260504001' } },
      { id: 'tr-002', status: '待确认', voucher: '未生成', attachment: '回单', values: { date: '2026-05-12', from: '招行一般户', to: '支付宝账户', amount: '¥50,000.00', fee: '¥3.00', serial: 'TR20260512006' } },
      { id: 'tr-003', status: '异常', voucher: '未生成', attachment: '无', values: { date: '2026-05-16', from: '现金', to: '工行基本户', amount: '¥8,000.00', fee: '-', serial: '待补' } },
    ],
    notes: ['账户转账默认生成银行存款/其他货币资金内部转账凭证。'],
  },
  employee: {
    keywordPlaceholder: '搜索姓名、证件号、部门、手机号',
    primaryAction: '新增人员',
    importLabel: '导入人员',
    statusOptions: ['全部', '在职', '离职', '停用'],
    summary: [
      { label: '在职人数', value: '42 人', tone: 'blue' },
      { label: '本月入职', value: '3 人', tone: 'green' },
      { label: '待补资料', value: '6 人', tone: 'amber' },
      { label: '离职未停缴', value: '1 人', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '姓名' },
      { key: 'idNo', label: '证件号' },
      { key: 'department', label: '部门' },
      { key: 'position', label: '岗位' },
      { key: 'mobile', label: '手机号' },
      { key: 'entryDate', label: '入职日期' },
    ],
    rows: [
      { id: 'emp-001', status: '启用', voucher: '-', attachment: '身份证', values: { name: '张三', idNo: '310***********1234', department: '销售部', position: '客户经理', mobile: '138****1001', entryDate: '2025-09-01' } },
      { id: 'emp-002', status: '启用', voucher: '-', attachment: '合同', values: { name: '李四', idNo: '320***********5421', department: '财务部', position: '会计', mobile: '139****2033', entryDate: '2024-03-15' } },
      { id: 'emp-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '王五', idNo: '待补', department: '生产部', position: '操作员', mobile: '137****8821', entryDate: '2026-05-10' } },
    ],
    notes: ['人员资料供工资、社保公积金、个税扣缴和专项附加扣除使用。'],
  },
  payroll: {
    keywordPlaceholder: '搜索员工、部门、工资项',
    primaryAction: '生成工资凭证',
    importLabel: '导入薪酬表',
    statusOptions: ['全部', '待确认', '已确认', '已生成凭证'],
    summary: [
      { label: '应发工资', value: '¥386,200.00', tone: 'blue' },
      { label: '个税', value: '¥18,420.00', tone: 'amber' },
      { label: '实发工资', value: '¥321,680.00', tone: 'green' },
      { label: '异常行', value: '2 行', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'department', label: '部门' },
      { key: 'base', label: '基本工资', align: 'right' },
      { key: 'bonus', label: '奖金', align: 'right' },
      { key: 'tax', label: '个税', align: 'right' },
      { key: 'net', label: '实发', align: 'right' },
    ],
    rows: [
      { id: 'pay-001', status: '待确认', voucher: '未生成', attachment: '工资条', values: { name: '张三', department: '销售部', base: '¥12,000.00', bonus: '¥2,000.00', tax: '¥680.00', net: '¥11,820.00' } },
      { id: 'pay-002', status: '已生成凭证', voucher: '记-0072', attachment: '工资条', values: { name: '李四', department: '财务部', base: '¥15,000.00', bonus: '¥0.00', tax: '¥950.00', net: '¥12,850.00' } },
      { id: 'pay-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { name: '王五', department: '生产部', base: '¥8,000.00', bonus: '¥500.00', tax: '待算', net: '待算' } },
    ],
    notes: ['薪酬表后续生成计提工资、发放工资、个税和社保公积金凭证。'],
  },
  socialSecurity: {
    keywordPlaceholder: '搜索员工、缴费地、险种',
    primaryAction: '生成社保凭证',
    importLabel: '导入明细',
    statusOptions: ['全部', '待确认', '已生成凭证', '异常'],
    summary: [
      { label: '单位缴纳', value: '¥72,650.00', tone: 'blue' },
      { label: '个人缴纳', value: '¥31,220.00', tone: 'amber' },
      { label: '匹配工资', value: '38 人', tone: 'green' },
      { label: '差异', value: '4 人', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'city', label: '缴费地' },
      { key: 'base', label: '缴费基数', align: 'right' },
      { key: 'company', label: '单位部分', align: 'right' },
      { key: 'personal', label: '个人部分', align: 'right' },
      { key: 'fund', label: '公积金', align: 'right' },
    ],
    rows: [
      { id: 'ss-001', status: '已生成凭证', voucher: '记-0075', attachment: '缴费单', values: { name: '张三', city: '上海', base: '¥12,000.00', company: '¥3,120.00', personal: '¥1,260.00', fund: '¥1,680.00' } },
      { id: 'ss-002', status: '待确认', voucher: '未生成', attachment: '缴费单', values: { name: '李四', city: '上海', base: '¥15,000.00', company: '¥3,900.00', personal: '¥1,575.00', fund: '¥2,100.00' } },
      { id: 'ss-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { name: '王五', city: '上海', base: '待确认', company: '待算', personal: '待算', fund: '待算' } },
    ],
    notes: ['社保公积金模块需要和薪酬表、人员登记、个税申报初始化共享基础资料。'],
  },
  specialDeduction: {
    keywordPlaceholder: '搜索员工、扣除类型、证件号',
    primaryAction: '同步扣除',
    importLabel: '导入扣除',
    statusOptions: ['全部', '有效', '待确认', '异常'],
    summary: [
      { label: '专项扣除', value: '26 条', tone: 'blue' },
      { label: '月扣除额', value: '¥52,000.00', tone: 'green' },
      { label: '待确认', value: '5 条', tone: 'amber' },
      { label: '异常', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '员工' },
      { key: 'type', label: '扣除类型' },
      { key: 'start', label: '起始月份' },
      { key: 'end', label: '结束月份' },
      { key: 'amount', label: '月扣除额', align: 'right' },
      { key: 'source', label: '来源' },
    ],
    rows: [
      { id: 'sd-001', status: '启用', voucher: '-', attachment: '资料', values: { name: '张三', type: '住房租金', start: '2026-01', end: '2026-12', amount: '¥1,500.00', source: '导入' } },
      { id: 'sd-002', status: '待确认', voucher: '-', attachment: '资料', values: { name: '李四', type: '子女教育', start: '2026-03', end: '2026-12', amount: '¥2,000.00', source: '手工' } },
      { id: 'sd-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '王五', type: '赡养老人', start: '待补', end: '待补', amount: '¥2,000.00', source: '导入' } },
    ],
    notes: ['专项附加扣除影响个税测算和扣缴所得税申报表。'],
  },
  depreciation: {
    keywordPlaceholder: '搜索资产名称、编号、类别',
    primaryAction: '计提折旧',
    importLabel: '导入资产',
    statusOptions: ['全部', '使用中', '已清理', '异常'],
    summary: [
      { label: '资产原值', value: '¥1,286,000.00', tone: 'blue' },
      { label: '本月折旧', value: '¥28,650.00', tone: 'amber' },
      { label: '已生成凭证', value: '1 张', tone: 'green' },
      { label: '异常资产', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '资产编号' },
      { key: 'name', label: '资产名称' },
      { key: 'category', label: '资产类别' },
      { key: 'start', label: '开始使用' },
      { key: 'original', label: '原值', align: 'right' },
      { key: 'depreciation', label: '本月折旧', align: 'right' },
    ],
    rows: [
      { id: 'dep-001', status: '已生成凭证', voucher: '记-0080', attachment: '发票', values: { code: 'FA-001', name: '生产设备A', category: '机器设备', start: '2025-01', original: '¥860,000.00', depreciation: '¥14,333.33' } },
      { id: 'dep-002', status: '待确认', voucher: '未生成', attachment: '合同', values: { code: 'FA-018', name: '办公电脑', category: '电子设备', start: '2026-04', original: '¥48,000.00', depreciation: '¥1,333.33' } },
      { id: 'dep-003', status: '异常', voucher: '未生成', attachment: '缺失', values: { code: 'FA-020', name: '车辆', category: '运输设备', start: '待补', original: '¥210,000.00', depreciation: '待算' } },
    ],
    notes: ['折旧摊销应进入期末结转工作台，支持明细表导出和凭证来源追溯。'],
  },
  inventorySettings: {
    keywordPlaceholder: '搜索存货编码、名称、规格、类别',
    primaryAction: '新增存货',
    importLabel: '导入存货',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '存货档案', value: '128 项', tone: 'blue' },
      { label: '启用', value: '116 项', tone: 'green' },
      { label: '待补税率', value: '9 项', tone: 'amber' },
      { label: '停用', value: '12 项', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '存货编码' },
      { key: 'name', label: '存货名称' },
      { key: 'spec', label: '规格型号' },
      { key: 'unit', label: '计量单位' },
      { key: 'taxRate', label: '税率' },
      { key: 'subject', label: '默认科目' },
    ],
    rows: [
      { id: 'inv-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'CH-001', name: '控制器', spec: 'A-100', unit: '台', taxRate: '13%', subject: '库存商品' } },
      { id: 'inv-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'CH-002', name: '连接线', spec: '2m', unit: '根', taxRate: '13%', subject: '原材料' } },
      { id: 'inv-003', status: '异常', voucher: '-', attachment: '-', values: { code: 'CH-019', name: '技术服务', spec: '标准', unit: '项', taxRate: '待补', subject: '主营业务收入' } },
    ],
    notes: ['存货设置与发票商品行、出入库单、成本结转和税率检查联动。'],
  },
  unitSettings: {
    keywordPlaceholder: '搜索单位名称、换算关系',
    primaryAction: '新增单位',
    importLabel: '导入单位',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '计量单位', value: '24 个', tone: 'blue' },
      { label: '换算组', value: '6 组', tone: 'green' },
      { label: '待确认', value: '2 个', tone: 'amber' },
      { label: '停用', value: '3 个', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '单位名称' },
      { key: 'group', label: '单位组' },
      { key: 'base', label: '基础单位' },
      { key: 'rate', label: '换算率' },
      { key: 'precision', label: '数量精度' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'unit-001', status: '启用', voucher: '-', attachment: '-', values: { name: '台', group: '数量', base: '台', rate: '1', precision: '2', remark: '设备' } },
      { id: 'unit-002', status: '启用', voucher: '-', attachment: '-', values: { name: '箱', group: '包装', base: '个', rate: '12', precision: '2', remark: '包装换算' } },
      { id: 'unit-003', status: '停用', voucher: '-', attachment: '-', values: { name: '批', group: '临时', base: '批', rate: '1', precision: '0', remark: '不再使用' } },
    ],
    notes: ['计量单位用于发票商品、存货和成本表，必须支持换算和数量精度。'],
  },
  riskCheck: {
    keywordPlaceholder: '搜索风险项、科目、来源模块',
    primaryAction: '重新检查',
    importLabel: '生成报告',
    statusOptions: ['全部', '未处理', '已通过', '异常'],
    summary: [
      { label: '检查项', value: '42 项', tone: 'blue' },
      { label: '已通过', value: '35 项', tone: 'green' },
      { label: '需复核', value: '5 项', tone: 'amber' },
      { label: '阻断结账', value: '2 项', tone: 'red' },
    ],
    columns: [
      { key: 'level', label: '级别' },
      { key: 'module', label: '来源模块' },
      { key: 'rule', label: '检查规则' },
      { key: 'impact', label: '影响' },
      { key: 'owner', label: '处理人' },
      { key: 'updated', label: '更新时间' },
    ],
    rows: [
      { id: 'risk-001', status: '异常', voucher: '记-0032', attachment: '明细', values: { level: '高', module: '凭证', rule: '借贷不平', impact: '阻断结账', owner: '王会计', updated: '2026-05-20 10:12' } },
      { id: 'risk-002', status: '待处理', voucher: '未生成', attachment: '发票', values: { level: '中', module: '进项发票', rule: '税率异常', impact: '影响申报', owner: '李会计', updated: '2026-05-20 10:15' } },
      { id: 'risk-003', status: '已通过', voucher: '记-0075', attachment: '工资表', values: { level: '低', module: '薪酬', rule: '社保工资差异', impact: '提示', owner: '赵会计', updated: '2026-05-20 10:20' } },
    ],
    notes: ['风险检查是只读校验和结账前校验入口，不自动修改凭证。'],
  },
  taxReport: {
    keywordPlaceholder: '搜索税种、申报表、取数来源',
    primaryAction: '重新取数',
    importLabel: '导出税表',
    statusOptions: ['全部', '未取数', '校验通过', '异常'],
    summary: [
      { label: '税表', value: '12 张', tone: 'blue' },
      { label: '校验通过', value: '8 张', tone: 'green' },
      { label: '待确认', value: '3 张', tone: 'amber' },
      { label: '差异', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'form', label: '申报表' },
      { key: 'source', label: '取数来源' },
      { key: 'amount', label: '本期金额', align: 'right' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'check', label: '校验' },
    ],
    rows: [
      { id: 'taxr-001', status: '已通过', voucher: '报表快照', attachment: 'PDF', values: { taxType: '增值税', form: '主表', source: '销项/进项发票', amount: '¥680,000.00', tax: '¥54,210.00', check: '通过' } },
      { id: 'taxr-002', status: '待确认', voucher: '报表快照', attachment: 'PDF', values: { taxType: '企业所得税', form: '季报', source: '利润表', amount: '¥126,000.00', tax: '¥6,300.00', check: '待确认' } },
      { id: 'taxr-003', status: '异常', voucher: '报表快照', attachment: 'PDF', values: { taxType: '印花税', form: '应税合同', source: '单据登记', amount: '¥980,000.00', tax: '差异', check: '需复核' } },
    ],
    notes: ['税务报表支持重新计算、取数说明、差异解释和 PDF/Excel 导出。'],
  },
  settingsData: {
    keywordPlaceholder: '搜索编码、名称、助记码、税号',
    primaryAction: '新增资料',
    importLabel: '批量导入',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '资料数量', value: '86 条', tone: 'blue' },
      { label: '启用', value: '79 条', tone: 'green' },
      { label: '待补字段', value: '6 条', tone: 'amber' },
      { label: '停用', value: '7 条', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '编码' },
      { key: 'name', label: '名称' },
      { key: 'shortName', label: '简称' },
      { key: 'mnemonic', label: '助记码' },
      { key: 'taxNo', label: '税号/证件号' },
      { key: 'account', label: '默认科目/账号' },
    ],
    rows: [
      { id: 'set-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'C001', name: '上海辰光贸易有限公司', shortName: '辰光贸易', mnemonic: 'CGMY', taxNo: '9131**********001X', account: '应收账款' } },
      { id: 'set-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'S006', name: '苏州材料供应链有限公司', shortName: '苏州材料', mnemonic: 'SZCL', taxNo: '9132**********888K', account: '应付账款' } },
      { id: 'set-003', status: '异常', voucher: '-', attachment: '-', values: { code: 'P003', name: '研发项目A', shortName: '项目A', mnemonic: 'YFXMA', taxNo: '-', account: '研发支出' } },
    ],
    notes: ['客户、供应商、其他往来、项目、部门、标签、资产类别可复用这套资料表格。'],
  },
  matchingRules: {
    keywordPlaceholder: '搜索规则名称、关键词、目标科目',
    primaryAction: '新增规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '规则数量', value: '38 条', tone: 'blue' },
      { label: '本期命中', value: '214 次', tone: 'green' },
      { label: 'AI 建议', value: '9 条', tone: 'amber' },
      { label: '冲突规则', value: '2 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'source', label: '来源模块' },
      { key: 'condition', label: '匹配条件' },
      { key: 'action', label: '生成动作' },
      { key: 'subject', label: '目标科目' },
      { key: 'priority', label: '优先级', align: 'center' },
    ],
    rows: [
      { id: 'rule-001', status: '启用', voucher: '-', attachment: '-', values: { name: '银行手续费', source: '银行账单', condition: '摘要包含手续费', action: '生成费用凭证', subject: '财务费用', priority: '90' } },
      { id: 'rule-002', status: '启用', voucher: '-', attachment: '-', values: { name: '销售收款', source: '销项发票+流水', condition: '客户+金额一致', action: '核销应收', subject: '银行存款/应收账款', priority: '80' } },
      { id: 'rule-003', status: '异常', voucher: '-', attachment: '-', values: { name: '办公用品', source: '进项发票', condition: '商品名称包含办公', action: '生成费用凭证', subject: '管理费用', priority: '冲突' } },
    ],
    notes: ['匹配规则必须保留命中日志和人工确认状态，AI 只能建议规则。'],
  },
}

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  gray: 'bg-gray-50 text-gray-700 border-gray-100',
}

function statusBadge(status: ModuleRow['status']) {
  const className = {
    待处理: 'bg-amber-100 text-amber-700',
    已匹配: 'bg-blue-100 text-blue-700',
    已生成凭证: 'bg-green-100 text-green-700',
    待确认: 'bg-amber-100 text-amber-700',
    异常: 'bg-red-100 text-red-700',
    启用: 'bg-green-100 text-green-700',
    停用: 'bg-gray-100 text-gray-700',
    已通过: 'bg-green-100 text-green-700',
  }[status]

  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', className)}>{status}</span>
}

export function BusinessModulePage({ kind, title, description }: BusinessModulePageProps) {
  const config = moduleConfigs[kind]
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部')

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return config.rows.filter((row) => {
      const matchesStatus = status === '全部' || row.status === status || (status === '未匹配' && row.status === '待处理')
      if (!matchesStatus) return false
      if (!normalized) return true
      return Object.values(row.values).some((value) => value.toLowerCase().includes(normalized)) || row.id.toLowerCase().includes(normalized)
    })
  }, [config.rows, keyword, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            {config.importLabel}
          </Button>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            导出Excel
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            打印
          </Button>
          <Button variant="primary" size="sm">
            <FilePlus2 className="mr-2 h-4 w-4" />
            {config.primaryAction}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {config.summary.map((item) => (
          <div key={item.label} className={cn('rounded-lg border px-4 py-3', toneClasses[item.tone])}>
            <div className="text-xs font-medium opacity-80">{item.label}</div>
            <div className="mt-1 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_160px_160px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input className="pl-9" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={config.keywordPlaceholder} />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              aria-label="状态筛选"
            >
              {config.statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <Filter className="mr-2 h-4 w-4" />
              高级筛选
            </button>
            <button className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <Columns3 className="mr-2 h-4 w-4" />
              列设置
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-100 py-2 dark:border-gray-800">
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>期间: 2026-05</span>
              <span>状态: 可编辑</span>
              <span>显示 {filteredRows.length} / {config.rows.length} 条</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                刷新
              </button>
              <button className="inline-flex items-center rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                <Settings2 className="mr-1 h-3.5 w-3.5" />
                规则
              </button>
              <button className="inline-flex items-center rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                <Download className="mr-1 h-3.5 w-3.5" />
                模板
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" aria-label="全选" className="rounded border-gray-300" />
                  </th>
                  {config.columns.map((column) => (
                    <th key={column.key} className={cn('whitespace-nowrap px-3 py-3', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}>
                      {column.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-3">状态</th>
                  <th className="whitespace-nowrap px-3 py-3">凭证</th>
                  <th className="whitespace-nowrap px-3 py-3">附件</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="px-3 py-3">
                      <input type="checkbox" aria-label={`选择 ${row.id}`} className="rounded border-gray-300" />
                    </td>
                    {config.columns.map((column) => (
                      <td key={column.key} className={cn('whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-200', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center')}>
                        {row.values[column.key]}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-3">{statusBadge(row.status)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{row.voucher}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {row.attachment}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <button className="text-sm font-medium text-primary-600 hover:text-primary-700">查看</button>
                      <span className="mx-2 text-gray-300">|</span>
                      <button className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">生成凭证</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            {config.notes.map((note, index) => (
              <div key={note} className="flex items-start gap-2">
                {index === 0 ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-green-500" />}
                <span>{note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
