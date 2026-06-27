import React from 'react'
import {
  BadgeDollarSign,
  BarChart3,
  Bot,
  Building2,
  CheckSquare,
  FileCheck2,
  Monitor,
  Notebook,
  Shield,
  Users,
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
  { id: 'agency-service-contracts', label: '服务合同', icon: <Notebook className="h-4 w-4" />, path: '/agency/service-contracts', description: '代账合同、服务套餐、续费和归档。' },
  { id: 'agency-fees', label: '收费管理', icon: <BadgeDollarSign className="h-4 w-4" />, path: '/agency/fees', description: '机构服务费应收、开票、收款和欠费。' },
  { id: 'agency-collaboration', label: '客户协同', icon: <Users className="h-4 w-4" />, path: '/agency/collaboration', description: '跨客户资料催办、问题确认和门户消息。' },
  { id: 'agency-tickets', label: '服务工单', icon: <Monitor className="h-4 w-4" />, path: '/agency/tickets', description: '机构交付工单、SLA、复核和归档。' },
  { id: 'agency-batch-tax', label: '批量申报', icon: <FileCheck2 className="h-4 w-4" />, path: '/agency/batch-tax', description: '多客户申报取数、校验、确认和回执。' },
  { id: 'agency-data-stats', label: '数据统计', icon: <BarChart3 className="h-4 w-4" />, path: '/agency/data-stats', description: '机构经营、产能、自动化率和风险分布。' },
  { id: 'agency-batch-ops', label: '批量操作', icon: <CheckSquare className="h-4 w-4" />, path: '/agency/batch-ops', description: '多账套批量导入、生成、结转和归档。' },
  { id: 'agency-health', label: '健康体检', icon: <Shield className="h-4 w-4" />, path: '/agency/health-check', description: '跨客户发票、凭证、报表和税务风险扫描。' },
  { id: 'agency-automation', label: '财税自动化', icon: <Bot className="h-4 w-4" />, path: '/agency/automation', description: '机构自动采票、识别、匹配和申报前置任务。' },
]
