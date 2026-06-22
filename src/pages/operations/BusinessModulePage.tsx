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
import { cn } from '../../lib/utils'

type ModuleKind =
  | 'outputInvoice'
  | 'inputInvoice'
  | 'invoiceSelection'
  | 'billList'
  | 'receipt'
  | 'documentRegister'
  | 'voucher'
  | 'transfer'
  | 'employee'
  | 'payroll'
  | 'socialSecurity'
  | 'specialDeduction'
  | 'depreciation'
  | 'inventorySettings'
  | 'unitSettings'
  | 'riskCheck'
  | 'ledgerReport'
  | 'financialReport'
  | 'taxReport'
  | 'settingsData'
  | 'matchingRules'
  | 'companyInfo'
  | 'initialBalance'
  | 'taxInit'
  | 'accountArchive'
  | 'customerArchive'
  | 'supplierArchive'
  | 'otherContactArchive'
  | 'projectArchive'
  | 'departmentArchive'
  | 'tagArchive'
  | 'subjectSettings'
  | 'assetCategory'
  | 'invoiceMatchingRules'
  | 'billMatchingRules'
  | 'settlementRules'
  | 'voucherRecycle'

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

type PrintTemplateKind = 'list' | 'voucher' | 'ledger' | 'financial' | 'tax'

const moduleConfigs: Record<ModuleKind, ModuleConfig> = {
  outputInvoice: {
    keywordPlaceholder: '搜索发票号码、购方名称、商品名称、备注',
    primaryAction: '开具发票',
    importLabel: '导入销项',
    statusOptions: ['全部', '待匹配', '已生成凭证', '已作废', '异常'],
    summary: [
      { label: '发票张数', value: '58 张', tone: 'blue' },
      { label: '不含税金额', value: '¥680,000.00', tone: 'green' },
      { label: '销项税额', value: '¥54,210.00', tone: 'amber' },
      { label: '异常发票', value: '2 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '开票日期' },
      { key: 'number', label: '发票号码' },
      { key: 'buyer', label: '购方名称' },
      { key: 'goods', label: '商品/服务名称' },
      { key: 'amount', label: '不含税金额', align: 'right' },
      { key: 'taxRate', label: '税率', align: 'center' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'total', label: '价税合计', align: 'right' },
    ],
    rows: [
      { id: 'out-001', status: '已生成凭证', voucher: '记-0051', attachment: 'PDF', values: { date: '2026-05-03', number: '310026000118', buyer: '上海辰光贸易有限公司', goods: '控制器 A-100', amount: '¥86,000.00', taxRate: '13%', tax: '¥11,180.00', total: '¥97,180.00' } },
      { id: 'out-002', status: '待确认', voucher: '未生成', attachment: 'OFD', values: { date: '2026-05-08', number: '310026000126', buyer: '杭州辰星科技有限公司', goods: '技术服务费', amount: '¥120,000.00', taxRate: '6%', tax: '¥7,200.00', total: '¥127,200.00' } },
      { id: 'out-003', status: '异常', voucher: '未生成', attachment: 'PDF', values: { date: '2026-05-16', number: '310026000188', buyer: '南京云杉贸易有限公司', goods: '配件', amount: '¥38,000.00', taxRate: '待核', tax: '¥4,940.00', total: '¥42,940.00' } },
    ],
    notes: ['销项发票页面应以发票清单为主，支持开票数据导入、作废红冲、凭证生成和税表取数。', '导出格式包含购方、商品行、金额税额、凭证号和附件状态。'],
  },
  inputInvoice: {
    keywordPlaceholder: '搜索发票号码、销方名称、商品名称、勾选状态',
    primaryAction: '生成凭证',
    importLabel: '导入进项',
    statusOptions: ['全部', '待勾选', '已勾选', '已生成凭证', '异常'],
    summary: [
      { label: '发票张数', value: '72 张', tone: 'blue' },
      { label: '可抵扣税额', value: '¥42,860.00', tone: 'green' },
      { label: '待勾选', value: '18 张', tone: 'amber' },
      { label: '异常发票', value: '3 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '开票日期' },
      { key: 'number', label: '发票号码' },
      { key: 'seller', label: '销方名称' },
      { key: 'goods', label: '商品/服务名称' },
      { key: 'amount', label: '不含税金额', align: 'right' },
      { key: 'taxRate', label: '税率', align: 'center' },
      { key: 'tax', label: '税额', align: 'right' },
      { key: 'deduction', label: '勾选用途' },
    ],
    rows: [
      { id: 'in-001', status: '待确认', voucher: '未生成', attachment: 'PDF', values: { date: '2026-05-06', number: '310026000142', seller: '上海云启科技有限公司', goods: '服务器租赁', amount: '¥38,000.00', taxRate: '13%', tax: '¥4,940.00', deduction: '待勾选' } },
      { id: 'in-002', status: '已匹配', voucher: '记-0058', attachment: 'OFD', values: { date: '2026-05-09', number: '310026000186', seller: '苏州材料供应链有限公司', goods: '原材料', amount: '¥126,500.00', taxRate: '13%', tax: '¥16,445.00', deduction: '增值税抵扣' } },
      { id: 'in-003', status: '异常', voucher: '未生成', attachment: 'PDF', values: { date: '2026-05-12', number: '310026000221', seller: '杭州设备服务有限公司', goods: '维修费', amount: '¥9,800.00', taxRate: '6%', tax: '¥588.00', deduction: '税率需复核' } },
    ],
    notes: ['进项发票页面必须区分认证勾选、抵扣用途、供应商匹配和凭证生成。', '后续与发票勾选、增值税申报主表和进项转出明细联动。'],
  },
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
  voucher: {
    keywordPlaceholder: '搜索凭证号、摘要、科目、制单人、来源单据',
    primaryAction: '新增凭证',
    importLabel: '导入凭证',
    statusOptions: ['全部', '草稿', '待审核', '已审核', '已过账', '异常'],
    summary: [
      { label: '本期凭证', value: '82 张', tone: 'blue' },
      { label: '已审核', value: '73 张', tone: 'green' },
      { label: '待审核', value: '9 张', tone: 'amber' },
      { label: '断号/异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '凭证日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'debitAccount', label: '借方科目' },
      { key: 'creditAccount', label: '贷方科目' },
      { key: 'debit', label: '借方金额', align: 'right' },
      { key: 'credit', label: '贷方金额', align: 'right' },
      { key: 'source', label: '来源' },
      { key: 'maker', label: '制单人' },
      { key: 'auditor', label: '审核人' },
    ],
    rows: [
      { id: 'v-0051', status: '已生成凭证', voucher: '记-0051', attachment: '发票2', values: { date: '2026-05-03', wordNo: '记-0051', summary: '销售控制器', debitAccount: '应收账款', creditAccount: '主营业务收入/应交税费', debit: '¥97,180.00', credit: '¥97,180.00', source: '销项发票', maker: '王会计', auditor: '主管' } },
      { id: 'v-0058', status: '已通过', voucher: '记-0058', attachment: '发票1', values: { date: '2026-05-09', wordNo: '记-0058', summary: '采购原材料', debitAccount: '原材料/应交税费', creditAccount: '应付账款', debit: '¥142,945.00', credit: '¥142,945.00', source: '进项发票', maker: '李会计', auditor: '主管' } },
      { id: 'v-0062', status: '异常', voucher: '记-0062', attachment: '无', values: { date: '2026-05-15', wordNo: '记-0062', summary: '银行手续费', debitAccount: '财务费用', creditAccount: '银行存款', debit: '¥320.00', credit: '¥300.00', source: '银行账单', maker: '赵会计', auditor: '未审' } },
    ],
    notes: ['会计凭证页应支持新增、审核、反审核、复制、红冲、断号整理、打印、导出和来源穿透。', '凭证导出和打印模板需要按凭证纸格式单独设计。'],
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
  ledgerReport: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、摘要',
    primaryAction: '重新计算',
    importLabel: '导出账簿',
    statusOptions: ['全部', '有发生', '无发生', '借方余额', '贷方余额'],
    summary: [
      { label: '科目数', value: '128 个', tone: 'blue' },
      { label: '本期借方', value: '¥1,286,300.00', tone: 'green' },
      { label: '本期贷方', value: '¥1,286,300.00', tone: 'green' },
      { label: '不平项', value: '0', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'openingDebit', label: '期初借方', align: 'right' },
      { key: 'openingCredit', label: '期初贷方', align: 'right' },
      { key: 'debit', label: '本期借方', align: 'right' },
      { key: 'credit', label: '本期贷方', align: 'right' },
      { key: 'direction', label: '方向', align: 'center' },
      { key: 'balance', label: '期末余额', align: 'right' },
    ],
    rows: [
      { id: '1002', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '1002', name: '银行存款', aux: '工行基本户', openingDebit: '¥220,000.00', openingCredit: '-', debit: '¥821,300.00', credit: '¥574,920.00', direction: '借', balance: '¥466,380.00' } },
      { id: '1122', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '1122', name: '应收账款', aux: '客户', openingDebit: '¥410,000.00', openingCredit: '-', debit: '¥680,000.00', credit: '¥390,000.00', direction: '借', balance: '¥700,000.00' } },
      { id: '2221', status: '已通过', voucher: '可穿透', attachment: '账簿', values: { code: '2221', name: '应交税费', aux: '税种', openingDebit: '-', openingCredit: '¥18,000.00', debit: '¥42,860.00', credit: '¥54,210.00', direction: '贷', balance: '¥29,350.00' } },
    ],
    notes: ['账簿页需要支持科目、辅助核算、期间、发生额/余额方向筛选，并可穿透凭证明细。', '科目余额表、科目汇总表、总账、明细账、多栏账应分别拥有独立导出模板。'],
  },
  financialReport: {
    keywordPlaceholder: '搜索报表项目、行次、公式、取数科目',
    primaryAction: '重新计算',
    importLabel: '导出报表',
    statusOptions: ['全部', '已平衡', '需重算', '公式异常'],
    summary: [
      { label: '报表项目', value: '64 行', tone: 'blue' },
      { label: '资产合计', value: '¥2,186,300.00', tone: 'green' },
      { label: '负债权益', value: '¥2,186,300.00', tone: 'green' },
      { label: '校验差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'line', label: '行次', align: 'center' },
      { key: 'item', label: '报表项目' },
      { key: 'formula', label: '取数公式/科目' },
      { key: 'opening', label: '期初余额', align: 'right' },
      { key: 'ending', label: '期末余额', align: 'right' },
      { key: 'reclass', label: '重分类' },
      { key: 'note', label: '说明' },
    ],
    rows: [
      { id: 'bs-001', status: '已通过', voucher: '快照', attachment: 'PDF', values: { line: '1', item: '货币资金', formula: '1001+1002+1012', opening: '¥220,000.00', ending: '¥466,380.00', reclass: '否', note: '来自科目余额表' } },
      { id: 'bs-002', status: '已通过', voucher: '快照', attachment: 'PDF', values: { line: '6', item: '应收账款', formula: '1122 重分类', opening: '¥410,000.00', ending: '¥700,000.00', reclass: '是', note: '按客户辅助重分类' } },
      { id: 'bs-003', status: '待确认', voucher: '快照', attachment: 'PDF', values: { line: '32', item: '应交税费', formula: '2221', opening: '¥18,000.00', ending: '¥29,350.00', reclass: '否', note: '与税务申报联动复核' } },
    ],
    notes: ['会计报表页需要支持重算、公式说明、重分类设置、取数快照、Excel/PDF/打印。', '资产负债表、利润表、现金流量表、所有者权益变动表要分别做固定模板。'],
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
  companyInfo: {
    keywordPlaceholder: '搜索企业名称、纳税人识别号、开户行、联系人',
    primaryAction: '保存资料',
    importLabel: '导入执照',
    statusOptions: ['全部', '启用', '待确认', '异常'],
    summary: [
      { label: '基础字段', value: '42 项', tone: 'blue' },
      { label: '已完成', value: '36 项', tone: 'green' },
      { label: '待补资料', value: '5 项', tone: 'amber' },
      { label: '关键异常', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'field', label: '资料项' },
      { key: 'value', label: '当前值' },
      { key: 'source', label: '来源' },
      { key: 'required', label: '必填', align: 'center' },
      { key: 'updatedBy', label: '维护人' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    rows: [
      { id: 'ci-001', status: '启用', voucher: '-', attachment: '营业执照', values: { field: '企业名称', value: '科旋电气（上海）有限公司', source: '营业执照识别', required: '是', updatedBy: '王会计', updatedAt: '2026-05-01 09:20' } },
      { id: 'ci-002', status: '启用', voucher: '-', attachment: '税务截图', values: { field: '纳税人识别号', value: '91310115MA1K3****X', source: '手工录入', required: '是', updatedBy: '李会计', updatedAt: '2026-05-01 09:24' } },
      { id: 'ci-003', status: '待确认', voucher: '-', attachment: '开户许可证', values: { field: '开户行及账号', value: '招商银行上海分行 6214********8801', source: '银行资料', required: '是', updatedBy: '赵会计', updatedAt: '2026-05-02 14:08' } },
    ],
    notes: ['企业信息页按资料项维护税号、纳税人类型、开户行、联系人、申报口径和税务初始化基础。', '真实工商和税局资料同步需要外部授权接口；当前保留导入、识别和人工确认链路。'],
  },
  initialBalance: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、方向',
    primaryAction: '试算平衡',
    importLabel: '导入期初',
    statusOptions: ['全部', '已通过', '待确认', '异常'],
    summary: [
      { label: '科目行数', value: '128 行', tone: 'blue' },
      { label: '期初借方', value: '¥2,186,300.00', tone: 'green' },
      { label: '期初贷方', value: '¥2,186,300.00', tone: 'green' },
      { label: '差异', value: '¥0.00', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'aux', label: '辅助核算' },
      { key: 'direction', label: '余额方向', align: 'center' },
      { key: 'debit', label: '期初借方', align: 'right' },
      { key: 'credit', label: '期初贷方', align: 'right' },
      { key: 'check', label: '试算平衡' },
    ],
    rows: [
      { id: 'ib-1002', status: '已通过', voucher: '期初', attachment: '导入表', values: { code: '1002', name: '银行存款', aux: '工行基本户', direction: '借', debit: '¥220,000.00', credit: '-', check: '通过' } },
      { id: 'ib-1122', status: '已通过', voucher: '期初', attachment: '导入表', values: { code: '1122', name: '应收账款', aux: '客户辅助', direction: '借', debit: '¥410,000.00', credit: '-', check: '通过' } },
      { id: 'ib-2202', status: '待确认', voucher: '期初', attachment: '导入表', values: { code: '2202', name: '应付账款', aux: '供应商辅助', direction: '贷', debit: '-', credit: '¥268,000.00', check: '辅助明细待核' } },
    ],
    notes: ['期初余额需要支持科目和辅助核算双层录入，并在启用账套前完成试算平衡。', '历史账簿导入后可反向形成期初余额，但需要人工确认差异。'],
  },
  taxInit: {
    keywordPlaceholder: '搜索税种、申报周期、税局账号、申报口径',
    primaryAction: '保存初始化',
    importLabel: '导入税种认定',
    statusOptions: ['全部', '启用', '待确认', '异常'],
    summary: [
      { label: '认定税种', value: '9 项', tone: 'blue' },
      { label: '已启用', value: '7 项', tone: 'green' },
      { label: '待确认', value: '2 项', tone: 'amber' },
      { label: '接口缺失', value: '1 项', tone: 'red' },
    ],
    columns: [
      { key: 'taxType', label: '税种' },
      { key: 'period', label: '申报周期' },
      { key: 'method', label: '计税方式' },
      { key: 'adapter', label: '税局 adapter' },
      { key: 'account', label: '申报账号' },
      { key: 'nextPeriod', label: '下次申报期' },
    ],
    rows: [
      { id: 'ti-vat', status: '启用', voucher: '-', attachment: '认定截图', values: { taxType: '增值税', period: '月报', method: '一般纳税人', adapter: '上海电子税务局', account: '已配置', nextPeriod: '2026-06' } },
      { id: 'ti-income', status: '启用', voucher: '-', attachment: '认定截图', values: { taxType: '企业所得税', period: '季报', method: '查账征收', adapter: '上海电子税务局', account: '已配置', nextPeriod: '2026-Q2' } },
      { id: 'ti-stamp', status: '待确认', voucher: '-', attachment: '待补', values: { taxType: '印花税', period: '按次/季报', method: '应税合同', adapter: '未接入', account: '待配置', nextPeriod: '待确认' } },
    ],
    notes: ['申报初始化只维护取数和申报参数，不伪造税局提交能力。', '自动报税后续必须通过合法 adapter、授权登录、回执和人工确认闭环实现。'],
  },
  accountArchive: {
    keywordPlaceholder: '搜索账户名称、银行账号、开户行、默认科目',
    primaryAction: '新增账户',
    importLabel: '导入账户',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '账户数量', value: '8 个', tone: 'blue' },
      { label: '启用', value: '6 个', tone: 'green' },
      { label: '待对账', value: '2 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '账户名称' },
      { key: 'type', label: '账户类型' },
      { key: 'bank', label: '开户行/平台' },
      { key: 'number', label: '账号' },
      { key: 'subject', label: '默认科目' },
      { key: 'balance', label: '账面余额', align: 'right' },
    ],
    rows: [
      { id: 'acct-001', status: '启用', voucher: '-', attachment: '开户许可证', values: { name: '工行基本户', type: '银行账户', bank: '工商银行上海分行', number: '6222********0198', subject: '1002 银行存款', balance: '¥466,380.00' } },
      { id: 'acct-002', status: '启用', voucher: '-', attachment: '网银截图', values: { name: '招行一般户', type: '银行账户', bank: '招商银行上海分行', number: '6214********8801', subject: '1002 银行存款', balance: '¥82,600.00' } },
      { id: 'acct-003', status: '异常', voucher: '-', attachment: '缺失', values: { name: '支付宝账户', type: '第三方支付', bank: '支付宝', number: 'finance@demo.com', subject: '1012 其他货币资金', balance: '待对账' } },
    ],
    notes: ['账户登记是银行流水、账户转账和资金余额表的基础资料。'],
  },
  customerArchive: {
    keywordPlaceholder: '搜索客户编码、名称、税号、合同',
    primaryAction: '新增客户',
    importLabel: '导入客户',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '客户数量', value: '46 户', tone: 'blue' },
      { label: '启用', value: '43 户', tone: 'green' },
      { label: '待补税号', value: '4 户', tone: 'amber' },
      { label: '停用', value: '3 户', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '客户编码' },
      { key: 'name', label: '客户名称' },
      { key: 'taxNo', label: '纳税人识别号' },
      { key: 'bank', label: '开户行' },
      { key: 'subject', label: '默认科目' },
      { key: 'contract', label: '关联合同' },
    ],
    rows: [
      { id: 'cust-001', status: '启用', voucher: '-', attachment: '合同', values: { code: 'C001', name: '上海辰光贸易有限公司', taxNo: '9131********001X', bank: '上海银行浦东支行', subject: '1122 应收账款', contract: 'HT-2026-001' } },
      { id: 'cust-002', status: '启用', voucher: '-', attachment: '开票资料', values: { code: 'C002', name: '杭州辰星科技有限公司', taxNo: '9133********889K', bank: '杭州银行科技支行', subject: '1122 应收账款', contract: 'HT-2026-008' } },
      { id: 'cust-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'C009', name: '南京云杉贸易有限公司', taxNo: '待补', bank: '待补', subject: '1122 应收账款', contract: '无' } },
    ],
    notes: ['客户档案影响销项发票、收款核销、应收辅助账和合同印花税取数。'],
  },
  supplierArchive: {
    keywordPlaceholder: '搜索供应商编码、名称、税号、别名',
    primaryAction: '新增供应商',
    importLabel: '导入供应商',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '供应商', value: '39 户', tone: 'blue' },
      { label: '启用', value: '35 户', tone: 'green' },
      { label: '别名待确认', value: '6 户', tone: 'amber' },
      { label: '异常', value: '2 户', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '供应商编码' },
      { key: 'name', label: '供应商名称' },
      { key: 'alias', label: '发票/流水别名' },
      { key: 'taxNo', label: '纳税人识别号' },
      { key: 'subject', label: '默认科目' },
      { key: 'taxRate', label: '常用税率' },
    ],
    rows: [
      { id: 'sup-001', status: '启用', voucher: '-', attachment: '开票资料', values: { code: 'S001', name: '苏州材料供应链有限公司', alias: '苏州材料', taxNo: '9132********888K', subject: '2202 应付账款', taxRate: '13%' } },
      { id: 'sup-002', status: '启用', voucher: '-', attachment: '合同', values: { code: 'S002', name: '上海云启科技有限公司', alias: '云启科技', taxNo: '9131********775M', subject: '2202 应付账款', taxRate: '6%' } },
      { id: 'sup-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'S009', name: '杭州设备服务有限公司', alias: '设备服务', taxNo: '待补', subject: '2202 应付账款', taxRate: '待核' } },
    ],
    notes: ['供应商档案影响进项发票识别、付款核销、应付辅助账和税率风险检查。'],
  },
  otherContactArchive: {
    keywordPlaceholder: '搜索往来名称、类型、证件号、默认科目',
    primaryAction: '新增往来',
    importLabel: '导入往来',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '其他往来', value: '24 个', tone: 'blue' },
      { label: '启用', value: '22 个', tone: 'green' },
      { label: '待补证件', value: '3 个', tone: 'amber' },
      { label: '异常', value: '1 个', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '往来编码' },
      { key: 'name', label: '往来名称' },
      { key: 'type', label: '往来类型' },
      { key: 'idNo', label: '证件号/税号' },
      { key: 'subject', label: '默认科目' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'oc-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'O001', name: '张三', type: '员工备用金', idNo: '310********1234', subject: '1221 其他应收款', remark: '销售备用金' } },
      { id: 'oc-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'O002', name: '李股东', type: '股东往来', idNo: '320********5421', subject: '2241 其他应付款', remark: '借款往来' } },
      { id: 'oc-003', status: '异常', voucher: '-', attachment: '缺失', values: { code: 'O006', name: '临时个人', type: '个人往来', idNo: '待补', subject: '1221 其他应收款', remark: '待确认' } },
    ],
    notes: ['其他往来用于员工、股东、个人和临时往来辅助核算。'],
  },
  projectArchive: {
    keywordPlaceholder: '搜索项目编码、名称、负责人、默认科目',
    primaryAction: '新增项目',
    importLabel: '导入项目',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '项目数量', value: '12 个', tone: 'blue' },
      { label: '进行中', value: '9 个', tone: 'green' },
      { label: '待归集', value: '3 个', tone: 'amber' },
      { label: '停用', value: '2 个', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '项目编码' },
      { key: 'name', label: '项目名称' },
      { key: 'owner', label: '负责人' },
      { key: 'start', label: '开始日期' },
      { key: 'subject', label: '默认科目' },
      { key: 'budget', label: '预算金额', align: 'right' },
    ],
    rows: [
      { id: 'proj-001', status: '启用', voucher: '-', attachment: '立项单', values: { code: 'P001', name: '研发项目A', owner: '研发部', start: '2026-01-01', subject: '5301 研发支出', budget: '¥520,000.00' } },
      { id: 'proj-002', status: '启用', voucher: '-', attachment: '合同', values: { code: 'P002', name: '华东销售项目', owner: '销售部', start: '2026-03-01', subject: '6601 销售费用', budget: '¥180,000.00' } },
      { id: 'proj-003', status: '待确认', voucher: '-', attachment: '待补', values: { code: 'P006', name: '设备改造', owner: '生产部', start: '待确认', subject: '1604 在建工程', budget: '待确认' } },
    ],
    notes: ['项目档案影响费用归集、研发辅助账和项目维度报表。'],
  },
  departmentArchive: {
    keywordPlaceholder: '搜索部门编码、名称、负责人',
    primaryAction: '新增部门',
    importLabel: '导入部门',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '部门数量', value: '8 个', tone: 'blue' },
      { label: '启用', value: '7 个', tone: 'green' },
      { label: '人员归属', value: '42 人', tone: 'amber' },
      { label: '停用', value: '1 个', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '部门编码' },
      { key: 'name', label: '部门名称' },
      { key: 'parent', label: '上级部门' },
      { key: 'owner', label: '负责人' },
      { key: 'subject', label: '费用科目' },
      { key: 'people', label: '人员数', align: 'right' },
    ],
    rows: [
      { id: 'dept-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'D001', name: '销售部', parent: '总部', owner: '陈经理', subject: '6601 销售费用', people: '14' } },
      { id: 'dept-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'D002', name: '财务部', parent: '总部', owner: '王会计', subject: '6602 管理费用', people: '5' } },
      { id: 'dept-003', status: '停用', voucher: '-', attachment: '-', values: { code: 'D009', name: '临时项目组', parent: '总部', owner: '-', subject: '6602 管理费用', people: '0' } },
    ],
    notes: ['部门档案用于工资、费用、辅助核算和管理报表。'],
  },
  tagArchive: {
    keywordPlaceholder: '搜索标签名称、适用模块、颜色',
    primaryAction: '新增标签',
    importLabel: '导入标签',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '标签数量', value: '18 个', tone: 'blue' },
      { label: '启用', value: '16 个', tone: 'green' },
      { label: '本期使用', value: '126 次', tone: 'amber' },
      { label: '停用', value: '2 个', tone: 'gray' },
    ],
    columns: [
      { key: 'name', label: '标签名称' },
      { key: 'module', label: '适用模块' },
      { key: 'color', label: '颜色/标识' },
      { key: 'rule', label: '自动标记规则' },
      { key: 'count', label: '使用次数', align: 'right' },
      { key: 'remark', label: '备注' },
    ],
    rows: [
      { id: 'tag-001', status: '启用', voucher: '-', attachment: '-', values: { name: '需客户确认', module: '发票/流水/凭证', color: '橙色', rule: '金额差异', count: '38', remark: '待办跟踪' } },
      { id: 'tag-002', status: '启用', voucher: '-', attachment: '-', values: { name: '税务风险', module: '税表/凭证', color: '红色', rule: '税率异常', count: '12', remark: '风险检查' } },
      { id: 'tag-003', status: '停用', voucher: '-', attachment: '-', values: { name: '旧标签', module: '单据', color: '灰色', rule: '无', count: '0', remark: '不再使用' } },
    ],
    notes: ['标签用于跨模块筛选、待办、客户沟通和风险追踪。'],
  },
  subjectSettings: {
    keywordPlaceholder: '搜索科目编码、科目名称、辅助核算、报表项目',
    primaryAction: '新增科目',
    importLabel: '导入科目',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '科目数量', value: '128 个', tone: 'blue' },
      { label: '启用', value: '126 个', tone: 'green' },
      { label: '辅助核算', value: '32 个', tone: 'amber' },
      { label: '映射异常', value: '2 个', tone: 'red' },
    ],
    columns: [
      { key: 'code', label: '科目编码' },
      { key: 'name', label: '科目名称' },
      { key: 'direction', label: '余额方向', align: 'center' },
      { key: 'aux', label: '辅助核算' },
      { key: 'report', label: '报表项目' },
      { key: 'cashFlow', label: '现金流量项目' },
    ],
    rows: [
      { id: 'subj-1002', status: '启用', voucher: '-', attachment: '-', values: { code: '1002', name: '银行存款', direction: '借', aux: '账户', report: '货币资金', cashFlow: '现金及现金等价物' } },
      { id: 'subj-1122', status: '启用', voucher: '-', attachment: '-', values: { code: '1122', name: '应收账款', direction: '借', aux: '客户', report: '应收账款', cashFlow: '销售商品收到的现金' } },
      { id: 'subj-2221', status: '异常', voucher: '-', attachment: '-', values: { code: '2221', name: '应交税费', direction: '贷', aux: '税种', report: '应交税费', cashFlow: '待映射' } },
    ],
    notes: ['科目设置需要维护余额方向、辅助核算、报表取数和现金流量映射。'],
  },
  assetCategory: {
    keywordPlaceholder: '搜索资产类别、折旧年限、残值率、默认科目',
    primaryAction: '新增类别',
    importLabel: '导入类别',
    statusOptions: ['全部', '启用', '停用'],
    summary: [
      { label: '资产类别', value: '9 类', tone: 'blue' },
      { label: '启用', value: '8 类', tone: 'green' },
      { label: '默认规则', value: '8 条', tone: 'amber' },
      { label: '停用', value: '1 类', tone: 'gray' },
    ],
    columns: [
      { key: 'code', label: '类别编码' },
      { key: 'name', label: '资产类别' },
      { key: 'life', label: '折旧年限' },
      { key: 'residual', label: '残值率' },
      { key: 'method', label: '折旧方法' },
      { key: 'subject', label: '默认科目' },
    ],
    rows: [
      { id: 'asset-001', status: '启用', voucher: '-', attachment: '-', values: { code: 'FA01', name: '机器设备', life: '10 年', residual: '5%', method: '平均年限法', subject: '1601 固定资产/1602 累计折旧' } },
      { id: 'asset-002', status: '启用', voucher: '-', attachment: '-', values: { code: 'FA02', name: '电子设备', life: '3 年', residual: '5%', method: '平均年限法', subject: '1601 固定资产/6602 管理费用' } },
      { id: 'asset-003', status: '停用', voucher: '-', attachment: '-', values: { code: 'FA09', name: '旧资产类别', life: '5 年', residual: '5%', method: '平均年限法', subject: '停用' } },
    ],
    notes: ['资产类别是折旧摊销模块的规则基础，影响折旧凭证和资产明细表。'],
  },
  invoiceMatchingRules: {
    keywordPlaceholder: '搜索规则名称、发票商品、购销方、税率、凭证模板',
    primaryAction: '新增发票规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '发票规则', value: '18 条', tone: 'blue' },
      { label: '本期命中', value: '96 次', tone: 'green' },
      { label: 'AI 建议', value: '5 条', tone: 'amber' },
      { label: '冲突', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'condition', label: '匹配条件' },
      { key: 'template', label: '凭证模板' },
      { key: 'subject', label: '科目/税率' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'hit', label: '命中次数', align: 'right' },
    ],
    rows: [
      { id: 'ir-001', status: '启用', voucher: '-', attachment: '-', values: { name: '销售商品', condition: '销项 商品名称包含控制器', template: '借应收 贷收入/销项税', subject: '主营业务收入 13%', priority: '90', hit: '42' } },
      { id: 'ir-002', status: '启用', voucher: '-', attachment: '-', values: { name: '技术服务收入', condition: '销项 税率 6%', template: '借应收 贷服务收入/销项税', subject: '主营业务收入 6%', priority: '80', hit: '18' } },
      { id: 'ir-003', status: '异常', voucher: '-', attachment: '-', values: { name: '办公采购', condition: '进项 商品名称包含办公', template: '费用凭证', subject: '管理费用 6%/13%', priority: '冲突', hit: '9' } },
    ],
    notes: ['发票规则要记录匹配条件、凭证模板、优先级和命中日志；AI 规则必须人工确认后启用。'],
  },
  billMatchingRules: {
    keywordPlaceholder: '搜索规则名称、流水摘要、对方户名、金额区间',
    primaryAction: '新增账单规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '账单规则', value: '14 条', tone: 'blue' },
      { label: '本期命中', value: '118 次', tone: 'green' },
      { label: '待确认', value: '7 条', tone: 'amber' },
      { label: '冲突', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'name', label: '规则名称' },
      { key: 'condition', label: '匹配条件' },
      { key: 'action', label: '生成动作' },
      { key: 'subject', label: '目标科目' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'hit', label: '命中次数', align: 'right' },
    ],
    rows: [
      { id: 'br-001', status: '启用', voucher: '-', attachment: '-', values: { name: '银行手续费', condition: '摘要包含手续费 金额小于1000', action: '生成费用凭证', subject: '6603 财务费用', priority: '95', hit: '22' } },
      { id: 'br-002', status: '启用', voucher: '-', attachment: '-', values: { name: '销售收款核销', condition: '对方户名=客户 金额=发票价税合计', action: '核销应收', subject: '1002/1122', priority: '90', hit: '61' } },
      { id: 'br-003', status: '待确认', voucher: '-', attachment: '-', values: { name: '个人备用金', condition: '对方户名为个人', action: '其他应收', subject: '1221 其他应收款', priority: '60', hit: '6' } },
    ],
    notes: ['账单规则用于流水分类、收付款核销和回单凭证生成，需要保留命中明细。'],
  },
  settlementRules: {
    keywordPlaceholder: '搜索结转类型、执行顺序、取数来源、凭证模板',
    primaryAction: '新增结转规则',
    importLabel: '导入规则',
    statusOptions: ['全部', '启用', '停用', '异常'],
    summary: [
      { label: '结转规则', value: '11 条', tone: 'blue' },
      { label: '启用', value: '10 条', tone: 'green' },
      { label: '待执行', value: '6 条', tone: 'amber' },
      { label: '阻断', value: '1 条', tone: 'red' },
    ],
    columns: [
      { key: 'order', label: '顺序', align: 'center' },
      { key: 'name', label: '结转类型' },
      { key: 'source', label: '取数来源' },
      { key: 'template', label: '凭证模板' },
      { key: 'condition', label: '执行条件' },
      { key: 'lastRun', label: '最近执行' },
    ],
    rows: [
      { id: 'sr-001', status: '启用', voucher: '记-0080', attachment: '明细', values: { order: '1', name: '折旧摊销', source: '固定资产/待摊费用', template: '借费用 贷累计折旧', condition: '资产已计提', lastRun: '2026-05-20' } },
      { id: 'sr-002', status: '启用', voucher: '记-0086', attachment: '明细', values: { order: '2', name: '税费计提', source: '税务报表', template: '借税金及附加 贷应交税费', condition: '税表已确认', lastRun: '2026-05-20' } },
      { id: 'sr-003', status: '异常', voucher: '未生成', attachment: '风险项', values: { order: '8', name: '损益结转', source: '损益类科目余额', template: '结转本年利润', condition: '凭证借贷平衡', lastRun: '被风险阻断' } },
    ],
    notes: ['结转规则进入期末结转工作台，必须按顺序执行并记录凭证来源。'],
  },
  voucherRecycle: {
    keywordPlaceholder: '搜索凭证号、摘要、删除人、删除原因',
    primaryAction: '恢复凭证',
    importLabel: '导出日志',
    statusOptions: ['全部', '待确认', '已通过', '异常'],
    summary: [
      { label: '删除凭证', value: '6 张', tone: 'blue' },
      { label: '可恢复', value: '5 张', tone: 'green' },
      { label: '待复核', value: '1 张', tone: 'amber' },
      { label: '异常', value: '1 张', tone: 'red' },
    ],
    columns: [
      { key: 'date', label: '凭证日期' },
      { key: 'wordNo', label: '凭证字号' },
      { key: 'summary', label: '摘要' },
      { key: 'amount', label: '金额', align: 'right' },
      { key: 'deletedBy', label: '删除人' },
      { key: 'deletedAt', label: '删除时间' },
      { key: 'reason', label: '删除原因' },
    ],
    rows: [
      { id: 'vr-001', status: '待确认', voucher: '记-0028', attachment: '附件2', values: { date: '2026-05-06', wordNo: '记-0028', summary: '差旅费报销', amount: '¥2,860.00', deletedBy: '王会计', deletedAt: '2026-05-18 11:20', reason: '重复生成' } },
      { id: 'vr-002', status: '已通过', voucher: '记-0033', attachment: '附件1', values: { date: '2026-05-08', wordNo: '记-0033', summary: '办公用品', amount: '¥1,240.00', deletedBy: '李会计', deletedAt: '2026-05-19 09:12', reason: '改由发票生成' } },
      { id: 'vr-003', status: '异常', voucher: '记-0041', attachment: '无', values: { date: '2026-05-10', wordNo: '记-0041', summary: '银行手续费', amount: '¥320.00', deletedBy: '赵会计', deletedAt: '2026-05-19 15:44', reason: '关联结账检查' } },
    ],
    notes: ['凭证回收箱需要保留删除、恢复和彻底删除审计日志，避免凭证断号不可追溯。'],
  },
}

const toneClasses = {
  blue: 'text-[#1f65a7]',
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  gray: 'text-slate-600',
}

function statusBadge(status: ModuleRow['status']) {
  const className = {
    待处理: 'bg-amber-50 text-amber-700 ring-amber-100',
    已匹配: 'bg-blue-50 text-blue-700 ring-blue-100',
    已生成凭证: 'bg-green-50 text-green-700 ring-green-100',
    待确认: 'bg-amber-50 text-amber-700 ring-amber-100',
    异常: 'bg-red-50 text-red-700 ring-red-100',
    启用: 'bg-green-50 text-green-700 ring-green-100',
    停用: 'bg-slate-50 text-slate-600 ring-slate-200',
    已通过: 'bg-green-50 text-green-700 ring-green-100',
  }[status]

  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1', className)}>{status}</span>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function printTemplateKind(kind: ModuleKind): PrintTemplateKind {
  if (kind === 'voucher' || kind === 'voucherRecycle') return 'voucher'
  if (kind === 'ledgerReport' || kind === 'initialBalance') return 'ledger'
  if (kind === 'financialReport') return 'financial'
  if (kind === 'taxReport' || kind === 'taxInit') return 'tax'
  return 'list'
}

function printableRows(config: ModuleConfig, rows: ModuleRow[]) {
  return rows.map((row) => ({
    row,
    cells: [
      ...config.columns.map((column) => row.values[column.key] || ''),
      row.status,
      row.voucher || '',
      row.attachment || '',
    ],
  }))
}

function renderGenericPrintHtml(params: {
  title: string
  headers: string[]
  rows: ReturnType<typeof printableRows>
  exportedAt: string
  status: string
  keyword: string
}) {
  const { title, headers, rows, exportedAt, status, keyword } = params
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:24px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 10px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:12px;color:#334155;margin-bottom:14px}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #94a3b8;padding:6px 8px;white-space:nowrap}
    th{background:#e8eef6;text-align:left}.note{margin-top:12px;font-size:11px;color:#64748b}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>公司: 科旋电气（上海）有限公司</span><span>所属期: 2026-05</span><span>导出时间: ${escapeHtml(exportedAt)}</span><span>筛选状态: ${escapeHtml(status)}</span><span>关键词: ${escapeHtml(keyword || '全部')}</span><span>记录数: ${rows.length} 条</span></div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(({ cells }) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
  </tbody></table><div class="note">制表说明: 本打印件按当前列表筛选条件、列顺序和账期生成；正式导出需要保留操作日志和文件哈希。</div></body></html>`
}

function renderVoucherPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string) {
  const items = rows.map(({ row }) => {
    const values = row.values
    return `<section class="voucher">
      <div class="voucher-head"><div>记账凭证</div><div class="no">${escapeHtml(values.wordNo || row.voucher || row.id)}</div></div>
      <div class="meta"><span>公司: 科旋电气（上海）有限公司</span><span>日期: ${escapeHtml(values.date || '2026-05')}</span><span>附件: ${escapeHtml(row.attachment || '-')}</span></div>
      <table><thead><tr><th>摘要</th><th>借方科目</th><th>贷方科目</th><th>借方金额</th><th>贷方金额</th></tr></thead><tbody>
        <tr><td>${escapeHtml(values.summary || '')}</td><td>${escapeHtml(values.debitAccount || '')}</td><td>${escapeHtml(values.creditAccount || '')}</td><td class="amount">${escapeHtml(values.debit || '')}</td><td class="amount">${escapeHtml(values.credit || '')}</td></tr>
      </tbody></table>
      <div class="sign"><span>制单: ${escapeHtml(values.maker || '系统')}</span><span>审核: ${escapeHtml(values.auditor || '未审')}</span><span>来源: ${escapeHtml(values.source || row.voucher || '-')}</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
    </section>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:18px;color:#111827}
    .voucher{break-inside:avoid;margin:0 0 18px;border:1.5px solid #111827;padding:12px}
    .voucher-head{display:flex;align-items:center;justify-content:center;position:relative;font-size:20px;font-weight:700;letter-spacing:0}
    .voucher-head .no{position:absolute;right:0;font-size:13px;font-weight:500}
    .meta,.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;font-size:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #111827;padding:9px 8px} th{background:#f1f5f9}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  </style></head><body>${items}</body></html>`
}

function renderLedgerPrintHtml(title: string, headers: string[], rows: ReturnType<typeof printableRows>, exportedAt: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:20px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.sub{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #64748b;padding:6px 7px;white-space:nowrap} th{background:#e8eef6}.amount{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    tfoot td{background:#f8fafc;font-weight:700}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="sub"><span>单位: 科旋电气（上海）有限公司</span><span>期间: 2026-05</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ cells }) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="${headers.length}">本页小计: 当前筛选 ${rows.length} 行，借贷平衡状态以系统试算结果为准。</td></tr></tfoot></table></body></html>`
}

function renderFinancialPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.line || '')}</td><td>${escapeHtml(row.values.item || '')}</td><td>${escapeHtml(row.values.opening || '')}</td><td>${escapeHtml(row.values.ending || '')}</td><td>${escapeHtml(row.values.note || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:19px;margin:0 0 8px}.meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #475569;padding:7px 8px} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .foot{display:flex;justify-content:space-between;margin-top:14px;font-size:12px}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>编制单位: 科旋电气（上海）有限公司</span><span>所属期: 2026-05</span><span>单位: 元</span></div>
  <table><thead><tr><th>行次</th><th>项目</th><th>期初余额/本月数</th><th>期末余额/本年累计</th><th>说明</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="foot"><span>制表: 系统</span><span>复核: 未签章</span><span>打印时间: ${escapeHtml(exportedAt)}</span></div></body></html>`
}

function renderTaxPrintHtml(title: string, rows: ReturnType<typeof printableRows>, exportedAt: string) {
  const bodyRows = rows.map(({ row }) => `<tr><td>${escapeHtml(row.values.taxType || '')}</td><td>${escapeHtml(row.values.form || row.values.period || '')}</td><td>${escapeHtml(row.values.source || row.values.method || '')}</td><td class="num">${escapeHtml(row.values.amount || '')}</td><td class="num">${escapeHtml(row.values.tax || '')}</td><td>${escapeHtml(row.values.check || row.status)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:18px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;margin-bottom:12px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #475569;padding:7px 8px} th{background:#e8eef6}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .notice{margin-top:12px;border:1px solid #cbd5e1;background:#f8fafc;padding:8px;font-size:11px;color:#475569}
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta"><span>纳税人: 科旋电气（上海）有限公司</span><span>税号: 91310115MA1K3****X</span><span>所属期: 2026-05</span><span>申报口径: 系统取数</span><span>状态: 待人工确认</span><span>打印: ${escapeHtml(exportedAt)}</span></div>
  <table><thead><tr><th>税种</th><th>申报表/周期</th><th>取数来源/方式</th><th>本期金额</th><th>税额</th><th>校验</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="notice">边界说明: 本打印件为申报预览和留档材料，不代表已向电子税务局提交。真实申报需要 adapter 授权、提交回执和人工确认。</div></body></html>`
}

function buildPrintHtml(params: {
  kind: ModuleKind
  title: string
  config: ModuleConfig
  rows: ModuleRow[]
  exportedAt: string
  status: string
  keyword: string
}) {
  const headers = [...params.config.columns.map((column) => column.label), '状态', '凭证', '附件']
  const rows = printableRows(params.config, params.rows)
  const template = printTemplateKind(params.kind)

  if (template === 'voucher') return renderVoucherPrintHtml(params.title, rows, params.exportedAt)
  if (template === 'ledger') return renderLedgerPrintHtml(params.title, headers, rows, params.exportedAt)
  if (template === 'financial') return renderFinancialPrintHtml(params.title, rows, params.exportedAt)
  if (template === 'tax') return renderTaxPrintHtml(params.title, rows, params.exportedAt)

  return renderGenericPrintHtml({
    title: params.title,
    headers,
    rows,
    exportedAt: params.exportedAt,
    status: params.status,
    keyword: params.keyword,
  })
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

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx')
    const headers = [...config.columns.map((column) => column.label), '状态', '凭证', '附件']
    const rows = filteredRows.map((row) => [
      ...config.columns.map((column) => row.values[column.key] || ''),
      row.status,
      row.voucher || '',
      row.attachment || '',
    ])
    const exportedAt = new Date().toLocaleString('zh-CN')
    const sheetRows = [
      [`${title}导出表`],
      ['公司', '科旋电气（上海）有限公司', '所属期', '2026-05', '导出时间', exportedAt],
      ['筛选状态', status, '关键词', keyword.trim() || '全部', '记录数', `${filteredRows.length} 条`],
      [],
      headers,
      ...rows,
      [],
      ['制表说明', '本文件按当前列表筛选条件、列顺序和账期生成；真实数据导出需写入操作日志、文件哈希和操作人。'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
    worksheet['!cols'] = headers.map((header) => ({
      wch: Math.max(10, Math.min(28, header.length * 2 + 8)),
    }))
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
      { s: { r: sheetRows.length - 1, c: 1 }, e: { r: sheetRows.length - 1, c: Math.max(headers.length - 1, 1) } },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 28))
    XLSX.writeFile(workbook, `${title}-2026-05.xlsx`)
  }

  const handlePrint = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const html = buildPrintHtml({
      kind,
      title,
      config,
      rows: filteredRows,
      exportedAt,
      status,
      keyword: keyword.trim(),
    })
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const tabs = ['列表', '明细', '凭证草稿', '匹配规则', '附件', '操作日志']

  return (
    <div className="h-full min-w-[1120px] bg-[#f3f6fa] text-slate-900">
      <div className="border border-slate-200 bg-white">
        <div className="flex h-11 items-center justify-between border-b border-slate-200 px-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-base font-semibold">{title}</h1>
            <span className="rounded bg-[#e9f2fb] px-2 py-1 text-xs text-[#1f65a7]">科旋电气（上海）有限公司</span>
            <span className="rounded bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">所属期 2026-05</span>
            <span className="max-w-[520px] truncate text-xs text-slate-500">{description}</span>
          </div>
          <div className="flex items-center gap-1">
            <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label={config.importLabel} />
            <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新" />
            <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} label="模板" />
            <ToolbarButton icon={<FileDown className="h-3.5 w-3.5" />} label="导出Excel" onClick={handleExportExcel} />
            <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印" onClick={handlePrint} />
            <button className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">
              <FilePlus2 className="h-3.5 w-3.5" />
              {config.primaryAction}
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-[#f8fafc] px-2">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              className={cn(
                'h-9 border-b-2 px-3 text-xs font-medium',
                index === 0 ? 'border-[#1f65a7] bg-white text-[#1f65a7]' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 border-b border-slate-200 bg-white">
          {config.summary.map((item) => (
            <div key={item.label} className="border-r border-slate-100 px-4 py-3 last:border-r-0">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className={cn('mt-1 text-lg font-semibold tabular-nums', toneClasses[item.tone])}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 bg-[#fbfcfe] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-80 rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1f65a7]"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={config.keywordPlaceholder}
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1f65a7]"
              aria-label="状态筛选"
            >
              {config.statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">
              <Filter className="h-3.5 w-3.5" />
              高级筛选
            </button>
          </div>
          <div className="flex items-center gap-1">
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="规则" />
            <ToolbarButton icon={<Columns3 className="h-3.5 w-3.5" />} label="列设置" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-3 pt-3">
        <section className="border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="text-sm font-semibold text-slate-900">{title}列表</div>
            <div className="text-xs text-slate-500">显示 {filteredRows.length} / {config.rows.length} 条，支持导出和打印</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className="w-9 border-b border-slate-200 px-2 py-2">
                    <input type="checkbox" aria-label="全选" />
                  </th>
                  {config.columns.map((column) => (
                    <th key={column.key} className={cn('whitespace-nowrap border-b border-slate-200 px-2 py-2', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}>
                      {column.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">状态</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">凭证</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2">附件</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className="border-b border-slate-100 px-2 py-2">
                      <input type="checkbox" aria-label={`选择 ${row.id}`} />
                    </td>
                    {config.columns.map((column) => (
                      <td key={column.key} className={cn('whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-700', column.align === 'right' && 'text-right font-mono tabular-nums', column.align === 'center' && 'text-center')}>
                        {row.values[column.key]}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.status)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.voucher}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {row.attachment}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right">
                      <button className="mr-2 text-[#1f65a7] hover:underline">查看</button>
                      <button className="text-[#1f65a7] hover:underline">生成凭证</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f8fafc]">
                <tr>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 font-semibold" colSpan={Math.max(config.columns.length - 1, 1)}>合计/小计</td>
                  <td className="px-2 py-2 text-right text-xs text-slate-500" colSpan={4}>当前筛选结果 {filteredRows.length} 条</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex h-10 items-center justify-between border-t border-slate-200 px-3 text-xs text-slate-500">
            <div>导出文件按当前筛选、列顺序和金额格式生成；PDF 打印使用同一表格模板。</div>
            <div>第 1 / 1 页，每页 50 条</div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="border border-slate-200 bg-white">
            <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              规则与提示
            </div>
            {config.notes.map((note, index) => (
              <div key={note} className="border-b border-slate-100 p-3 text-xs leading-5 text-slate-600 last:border-b-0">
                <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                  {index === 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                  {index === 0 ? '业务边界' : '自动化说明'}
                </div>
                {note}
              </div>
            ))}
          </section>
          <section className="border border-slate-200 bg-white">
            <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 text-sm font-semibold">
              <Settings2 className="h-4 w-4 text-[#1f65a7]" />
              操作日志
            </div>
            {['刷新列表', '执行筛选', '导出文件'].map((action, index) => (
              <div key={action} className="border-b border-slate-100 p-3 text-xs last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{action}</span>
                  <span className="font-mono text-slate-400">09:{30 + index * 6}</span>
                </div>
                <div className="mt-1 text-slate-500">系统记录操作人、账期、筛选条件和导出文件名称。</div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  )
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]"
    >
      {icon}
      {label}
    </button>
  )
}
