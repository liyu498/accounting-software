import React from 'react'
import {
  BarChart3,
  Bot,
  Building2,
  CheckSquare,
  Download,
  KeyRound,
  Notebook,
  ReceiptText,
  Shield,
} from 'lucide-react'

export interface AgencyNavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description: string
}

export const agencyNavItems: AgencyNavItem[] = [
  { id: 'agency-clients', label: '客户总览', icon: <Building2 className="h-4 w-4" />, path: '/agency/clients', description: '跨客户账套进度、风险、负责人和账期状态。' },
  { id: 'agency-authorizations', label: '授权中心', icon: <KeyRound className="h-4 w-4" />, path: '/agency/authorizations', description: '多客户税务、银行、个税、工商和票池授权状态。' },
  { id: 'agency-service-contracts', label: '服务合同', icon: <Notebook className="h-4 w-4" />, path: '/agency/service-contracts', description: '代账合同、收费、客户协同、服务套餐、续费和归档。' },
  { id: 'agency-downloads', label: '机构下载中心', icon: <Download className="h-4 w-4" />, path: '/agency/downloads', description: '跨客户导出文件、申报包、账簿和归档包下载。' },
  { id: 'agency-data-stats', label: '数据统计', icon: <BarChart3 className="h-4 w-4" />, path: '/agency/data-stats', description: '机构服务合同、收费、协同和交付数据汇总。' },
  { id: 'agency-batch-ops', label: '批量操作', icon: <CheckSquare className="h-4 w-4" />, path: '/agency/batch-ops', description: '多账套批量采集、生成凭证、结账、申报、回执和审批归档。' },
  { id: 'agency-invoice-management', label: '开票管理', icon: <ReceiptText className="h-4 w-4" />, path: '/agency/invoice-management', description: '机构服务费开票、抬头、红冲作废和归档。' },
  { id: 'agency-health', label: '健康体检', icon: <Shield className="h-4 w-4" />, path: '/agency/health-check', description: '跨客户发票、凭证、报表和税务风险扫描。' },
  { id: 'agency-automation', label: '财税自动化', icon: <Bot className="h-4 w-4" />, path: '/agency/automation', description: '机构自动采票、识别、匹配和申报前置任务。' },
]
