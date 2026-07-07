import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bot,
  Check,
  Clock,
  Download,
  Edit2,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { cn, formatCurrency } from '../lib/utils'
import { recordAuditLog, recordExportJob, useAuditLogs } from '../lib/exportJobs'
import { exportRowsToXlsx } from '../lib/xlsxExport'
import { automationApi } from '../lib/api'
import { useCompanyStore } from '../stores/companyStore'

type AiTaskStatus = '待识别' | '待确认' | '已生成凭证' | '已修改' | '已拒绝' | '异常'

interface AiVoucherTask {
  id: string
  sourceType: string
  sourceNo: string
  sourceName: string
  date: string
  counterparty: string
  amount: number
  tax: number
  summary: string
  debitAccount: string
  creditAccount: string
  confidence: number
  sourceEvidence: string
  rule: string
  status: AiTaskStatus
  reviewer: string
  voucherNo: string
  createdAt: string
}

const aiTasks: AiVoucherTask[] = [
  {
    id: 'ai-001',
    sourceType: '销项发票',
    sourceNo: '310026000126',
    sourceName: '技术服务费',
    date: '2026-05-08',
    counterparty: '杭州辰星科技有限公司',
    amount: 127200,
    tax: 7200,
    summary: '确认技术服务收入',
    debitAccount: '1122 应收账款/杭州辰星',
    creditAccount: '6001 主营业务收入/2221 销项税额',
    confidence: 94,
    sourceEvidence: '发票 PDF + 销项清单第 18 行',
    rule: '销项 6% 技术服务收入',
    status: '待确认',
    reviewer: '王会计',
    voucherNo: '草稿-018',
    createdAt: '2026-06-26 09:12',
  },
  {
    id: 'ai-002',
    sourceType: '银行流水',
    sourceNo: 'ICBC-202605-083',
    sourceName: '客户回款',
    date: '2026-05-10',
    counterparty: '上海辰光贸易有限公司',
    amount: 97180,
    tax: 0,
    summary: '收到客户货款并核销应收',
    debitAccount: '1002 银行存款/工行基本户',
    creditAccount: '1122 应收账款/上海辰光',
    confidence: 91,
    sourceEvidence: '银行流水 + 销项发票 310026000118',
    rule: '客户户名+金额一致核销',
    status: '已生成凭证',
    reviewer: '张会计',
    voucherNo: '记-0061',
    createdAt: '2026-06-26 09:18',
  },
  {
    id: 'ai-003',
    sourceType: '进项发票',
    sourceNo: '310026000221',
    sourceName: '维修费',
    date: '2026-05-12',
    counterparty: '杭州设备服务有限公司',
    amount: 10388,
    tax: 588,
    summary: '设备维修费用',
    debitAccount: '6602 管理费用/维修费',
    creditAccount: '2202 应付账款/杭州设备',
    confidence: 78,
    sourceEvidence: '发票 OFD 识别 + 供应商档案待补',
    rule: 'AI 建议规则，未启用',
    status: '异常',
    reviewer: '李会计',
    voucherNo: '未生成',
    createdAt: '2026-06-26 09:24',
  },
  {
    id: 'ai-004',
    sourceType: '工资表',
    sourceNo: 'PAY-202605',
    sourceName: '5 月工资',
    date: '2026-05-31',
    counterparty: '员工薪酬',
    amount: 186420,
    tax: 6420,
    summary: '计提本月工资薪金',
    debitAccount: '6602 管理费用/销售费用',
    creditAccount: '2211 应付职工薪酬',
    confidence: 88,
    sourceEvidence: '薪酬表 + 人员档案 + 专项附加扣除',
    rule: '工资计提模板',
    status: '待确认',
    reviewer: '王会计',
    voucherNo: '草稿-019',
    createdAt: '2026-06-26 09:31',
  },
]

const aiStaticAuditLogs = [
  ['09:31:22', '生成草稿', '工资表 PAY-202605 生成凭证草稿，置信度 88%，待人工确认'],
  ['09:24:18', '阻断入账', '进项发票 310026000221 供应商资料缺失，未生成凭证'],
  ['09:18:03', '确认入账', '银行流水 ICBC-202605-083 经张会计确认生成记-0061'],
  ['09:12:46', '识别完成', '销项发票 310026000126 识别完成，匹配技术服务收入模板'],
]

const tabs = ['AI工作台', '待确认', '异常处理', '已生成凭证', '规则建议', '审计日志']

export function AIBookkeeping() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const companyId = selectedCompanyId ?? 'mock-1'
  const currentPeriod = '2026-05'
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [query, setQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tasks, setTasks] = useState<AiVoucherTask[]>(aiTasks)
  const [previewTask, setPreviewTask] = useState<AiVoucherTask>(aiTasks[0])
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const [backendQueueCount, setBackendQueueCount] = useState(0)
  const [backendAuditCount, setBackendAuditCount] = useState(0)
  const liveAuditLogs = useAuditLogs()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBackendState() {
      const [jobsResult, logsResult] = await Promise.all([
        automationApi.getAutomationJobs({ companyId, period: currentPeriod }),
        automationApi.getOperationAuditLogs({ companyId, moduleName: 'AI做账' }),
      ])
      if (cancelled) return
      if (jobsResult.success) setBackendQueueCount(jobsResult.data?.length ?? 0)
      if (logsResult.success) setBackendAuditCount(logsResult.data?.length ?? 0)
    }

    void loadBackendState()
    return () => {
      cancelled = true
    }
  }, [companyId])

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesTab =
        activeTab === 'AI工作台' ||
        activeTab === '待确认' && task.status === '待确认' ||
        activeTab === '异常处理' && task.status === '异常' ||
        activeTab === '已生成凭证' && task.status === '已生成凭证' ||
        activeTab === '规则建议' && task.rule.includes('AI')
      if (!matchesTab) return false
      if (!normalized) return true
      return Object.values(task).some((value) => String(value).toLowerCase().includes(normalized))
    })
  }, [activeTab, query, tasks])

  const writeAiAudit = (action: string, object: string, level: '普通' | '中' | '高' = '普通', result: '成功' | '待审批' | '失败' = '成功') => {
    recordAuditLog({
      module: 'AI做账',
      action,
      object,
      level,
      result,
      status: result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过',
      voucher: `${activeTab}/${query.trim() || '全部'}`,
      attachment: 'AI操作快照',
    })
    void automationApi.writeOperationAuditLog({
      companyId,
      moduleName: 'AI做账',
      action,
      objectRef: object,
      riskLevel: level,
      result,
      detail: `${activeTab}/${query.trim() || '全部'}｜AI操作快照`,
      operator: 'admin',
    }).then((response) => {
      if (response.success) setBackendAuditCount((count) => count + 1)
    })
  }

  const updateTask = (id: string, patch: Partial<AiVoucherTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)))
    setPreviewTask((current) => (current.id === id ? { ...current, ...patch } : current))
  }

  const persistAiTask = (task: AiVoucherTask, status: string, resultSummary: string, riskLevel: string) => {
    void automationApi.createAutomationJob({
      companyId,
      period: currentPeriod,
      jobType: 'voucher_suggestion',
      sourceModule: task.sourceType,
      sourceId: task.sourceNo,
      sourceFile: task.sourceEvidence,
      status,
      confidence: task.confidence / 100,
      resultSummary,
      riskLevel,
      reviewer: task.reviewer,
      createdBy: 'admin',
    }).then((response) => {
      if (response.success) setBackendQueueCount((count) => count + 1)
    })
  }

  const handleRefresh = () => {
    writeAiAudit('刷新任务', `${activeTab}-${query.trim() || '全部'}`)
    setOperationNotice('AI 做账任务列表已刷新，并记录当前筛选条件。')
  }

  const handleExportAudit = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = `AI做账审计-${activeTab}-${exportedAt.replace(/[\\/:\s]/g, '')}.xlsx`
    const liveRows = liveAuditLogs
      .filter((log) => log.module === 'AI做账')
      .map((log) => [log.time, log.action, `${log.object}｜${log.result}｜${log.voucher}`])
    const sheetRows = [
      ['AI做账审计日志'],
      ['公司', '科旋电气（上海）有限公司', '账期', '2026-05', '视图', activeTab],
      ['导出时间', exportedAt, '筛选关键字', query.trim() || '全部', '记录数', `${liveRows.length + aiStaticAuditLogs.length}`],
      [],
      ['时间', '动作', '说明'],
      ...liveRows,
      ...aiStaticAuditLogs,
      [],
      ['边界说明', 'AI 只生成识别结果、凭证草稿和申报取数前置材料；确认入账、真实申报和外部提交必须人工确认并写入审计日志。'],
    ]
    await exportRowsToXlsx({
      sheetRows,
      columnWidths: [{ wch: 22 }, { wch: 18 }, { wch: 80 }],
      sheetName: 'AI审计',
      fileName,
    })
    recordExportJob({
      fileName,
      moduleName: 'AI做账',
      format: 'Excel',
      scope: `${activeTab}/${query.trim() || '全部'}`,
      templateKind: 'generic-list',
      rowCount: liveRows.length + aiStaticAuditLogs.length,
    })
    setOperationNotice(`${fileName} 已生成并写入下载中心。`)
  }

  const handleFileUpload = () => {
    setIsProcessing(true)
    writeAiAudit('上传识别', '票据/OFD/PDF/Excel 批次', '中', '待审批')
    void automationApi.createAutomationJob({
      companyId,
      period: currentPeriod,
      jobType: 'document_ocr',
      sourceModule: 'AI做账',
      sourceFile: '票据/OFD/PDF/Excel 批次',
      status: 'queued',
      riskLevel: 'medium',
      createdBy: 'admin',
    }).then((response) => {
      if (response.success) setBackendQueueCount((count) => count + 1)
    })
    window.setTimeout(() => {
      setIsProcessing(false)
      setPreviewTask(tasks[0] || aiTasks[0])
      setActiveTab('待确认')
      writeAiAudit('识别完成', '票据/OFD/PDF/Excel 批次', '中')
      setOperationNotice('识别批次已进入待确认列表；AI 结果不会自动入账。')
    }, 1200)
  }

  const handleViewTask = (task: AiVoucherTask) => {
    setPreviewTask(task)
    writeAiAudit('查看草稿', `${task.sourceType}-${task.sourceNo}`)
  }

  const handleEditDraft = () => {
    updateTask(previewTask.id, { status: '已修改' })
    persistAiTask(previewTask, 'needs_review', '人工修改凭证草稿，等待复核分录、辅助核算和附件', 'medium')
    writeAiAudit('修改草稿', `${previewTask.sourceType}-${previewTask.sourceNo}`, '中', '待审批')
    setOperationNotice(`${previewTask.sourceNo} 已标记为已修改，需复核分录、辅助核算和附件后再确认。`)
  }

  const handleRejectDraft = () => {
    updateTask(previewTask.id, { status: '已拒绝', voucherNo: '已拒绝' })
    persistAiTask(previewTask, 'cancelled', '人工拒绝 AI 凭证建议，不进入正式凭证', 'medium')
    writeAiAudit('拒绝草稿', `${previewTask.sourceType}-${previewTask.sourceNo}`, '中')
    setOperationNotice(`${previewTask.sourceNo} 已拒绝，不会进入正式凭证。`)
  }

  const handleApprove = () => {
    if (previewTask.status === '异常' || previewTask.confidence < 80) {
      persistAiTask(previewTask, 'needs_review', '异常或低置信度阻断自动入账，进入高风险待审批', 'high')
      writeAiAudit('确认凭证草稿', `${previewTask.sourceType}-${previewTask.sourceNo}`, '高', '待审批')
      setOperationNotice(`${previewTask.sourceNo} 存在异常或低置信度，已进入高风险待审批，不会自动入账。`)
      return
    }

    const voucherNo = previewTask.voucherNo.startsWith('记-') ? previewTask.voucherNo : `记-AI-${previewTask.id.slice(-3)}`
    updateTask(previewTask.id, { status: '已生成凭证', voucherNo })
    persistAiTask(previewTask, 'completed', `人工确认生成凭证草稿 ${voucherNo}`, 'normal')
    writeAiAudit('确认凭证草稿', `${previewTask.sourceType}-${previewTask.sourceNo}`, '中')
    setOperationNotice(`${previewTask.sourceNo} 已确认生成凭证草稿 ${voucherNo}，正式写账仍需后端凭证落库。`)
  }

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-1.5">
          <div className="min-w-0">
            <h1 className="text-base font-semibold">AI 做账工作台</h1>
            <p className="text-xs text-slate-500">发票识别、流水匹配、凭证草稿、人工确认、申报取数前置和审计闭环</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <span className="mr-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">本地队列 {backendQueueCount} · 审计 {backendAuditCount}</span>
            <ToolButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="刷新" onClick={handleRefresh} />
            <ToolButton icon={<Download className="h-3.5 w-3.5" />} label="导出审计" onClick={handleExportAudit} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">
              <Upload className="h-3.5 w-3.5" />
              上传识别
            </button>
          </div>
        </div>

        <div className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8fbff] px-3">
          {tabs.map((tab) => (
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

        {operationNotice && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
            {operationNotice}
          </div>
        )}

        <div className="grid grid-cols-2 border-b border-slate-200 md:grid-cols-3 xl:grid-cols-5">
          <SummaryCard label="待确认草稿" value="19 条" tone="amber" />
          <SummaryCard label="平均置信度" value="88.6%" tone="blue" />
          <SummaryCard label="自动生成率" value="71.4%" tone="green" />
          <SummaryCard label="异常阻断" value="6 条" tone="red" />
          <SummaryCard label="可入税表" value="12 项" tone="blue" />
        </div>

        <div className="grid min-h-[570px] min-w-0 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] 2xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="min-w-0 border-r border-slate-200 bg-[#fbfdff]">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">采集入口</div>
            <div className="p-3">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.ofd,.xlsx" className="hidden" onChange={handleFileUpload} />
              <button
                type="button"
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  handleFileUpload()
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex h-40 w-full flex-col items-center justify-center rounded border border-dashed text-center text-xs transition-colors',
                  isDragging ? 'border-[#1f65a7] bg-[#eef6ff] text-[#1f65a7]' : 'border-slate-300 bg-white text-slate-500 hover:border-[#1f65a7]'
                )}
              >
                {isProcessing ? <Loader2 className="mb-2 h-7 w-7 animate-spin text-[#1f65a7]" /> : <Upload className="mb-2 h-7 w-7 text-[#1f65a7]" />}
                <span className="font-medium text-slate-800">{isProcessing ? '识别处理中' : '拖拽或选择文件'}</span>
                <span className="mt-1">PDF/OFD/图片/Excel</span>
              </button>
            </div>

            <div className="border-y border-slate-200 px-3 py-2 text-sm font-semibold">识别流程</div>
            <div className="space-y-2 p-3">
              {['票据 OCR/版式解析', '客户供应商匹配', '科目和税率建议', '生成凭证草稿', '人工确认入账'].map((item, index) => (
                <div key={item} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8eef6] text-[11px] text-[#1f65a7]">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>

            <div className="border-y border-slate-200 px-3 py-2 text-sm font-semibold">控制边界</div>
            <div className="space-y-2 p-3 text-xs leading-5 text-slate-600">
              <p>AI 只生成建议、草稿和申报取数前置材料，凭证入账必须人工确认。</p>
              <p>自动报税只推进到申报包和待提交状态，真实提交需合法税局 adapter 和回执。</p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-1.5">
              <div className="relative min-w-64 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索来源编号、客户、摘要、规则" className="h-8 w-full rounded border border-slate-300 pl-8 pr-2 text-xs outline-none focus:border-[#1f65a7] sm:w-80" />
              </div>
              <ToolButton icon={<Filter className="h-3.5 w-3.5" />} label="筛选" />
              <span className="ml-auto text-xs text-slate-500">当前视图: {activeTab} · 共 {filteredTasks.length} 条</span>
            </div>

            {activeTab === '审计日志' ? (
              <AuditLog liveLogs={liveAuditLogs.filter((log) => log.module === 'AI做账')} />
            ) : (
              <div className="max-w-full overflow-auto">
                <table className="w-full min-w-[980px] border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#e8eef6] text-slate-700">
                    <tr>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">状态</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">来源</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">编号</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">往来方</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-right">价税合计</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">摘要</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">建议分录</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-center">置信度</th>
                      <th className="border-b border-r border-slate-300 px-2 py-2 text-left">凭证</th>
                      <th className="border-b border-slate-300 px-2 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-[#f8fbff]">
                        <td className="border-b border-r border-slate-200 px-2 py-2"><StatusBadge value={task.status} /></td>
                        <td className="border-b border-r border-slate-200 px-2 py-2">{task.sourceType}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2 font-mono text-[#1f65a7]">{task.sourceNo}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2">{task.counterparty}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2 text-right font-mono">{formatCurrency(task.amount)}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2">{task.summary}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2">{task.debitAccount} / {task.creditAccount}</td>
                        <td className="border-b border-r border-slate-200 px-2 py-2 text-center"><Confidence value={task.confidence} /></td>
                        <td className="border-b border-r border-slate-200 px-2 py-2">{task.voucherNo}</td>
                        <td className="border-b border-slate-200 px-2 py-2 text-center">
                          <button type="button" onClick={() => handleViewTask(task)} className="inline-flex h-7 items-center gap-1 rounded px-2 text-[#1f65a7] hover:bg-[#eef6ff]">
                            <Eye className="h-3.5 w-3.5" />
                            查看
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="min-w-0 border-l border-slate-200 bg-[#fbfdff]">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">凭证草稿预览</div>
            <div className="space-y-3 p-3">
              <div className="rounded border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-[#1f65a7]" />
                    {previewTask.voucherNo}
                  </div>
                  <Confidence value={previewTask.confidence} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>日期: {previewTask.date}</span>
                  <span>税额: {formatCurrency(previewTask.tax)}</span>
                  <span className="col-span-2">来源: {previewTask.sourceEvidence}</span>
                  <span className="col-span-2">规则: {previewTask.rule}</span>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold">建议分录</div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">借</td>
                      <td className="px-3 py-2">{previewTask.debitAccount}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(previewTask.amount - previewTask.tax)}</td>
                    </tr>
                    {previewTask.tax > 0 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2">借/贷</td>
                        <td className="px-3 py-2">2221 应交税费</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(previewTask.tax)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-3 py-2">贷</td>
                      <td className="px-3 py-2">{previewTask.creditAccount}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(previewTask.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertCircle className="h-3.5 w-3.5" />
                  人工确认要求
                </div>
                需核对来源、分录、辅助核算、税额和附件；确认后才允许写入正式凭证和税表取数。
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={handleEditDraft} className="inline-flex h-8 items-center justify-center gap-1 rounded border border-slate-300 bg-white text-xs text-slate-700 hover:border-[#1f65a7]">
                  <Edit2 className="h-3.5 w-3.5" />
                  修改
                </button>
                <button type="button" onClick={handleRejectDraft} className="inline-flex h-8 items-center justify-center gap-1 rounded border border-red-200 bg-white text-xs text-red-700 hover:bg-red-50">
                  <X className="h-3.5 w-3.5" />
                  拒绝
                </button>
                <button type="button" onClick={handleApprove} className="inline-flex h-8 items-center justify-center gap-1 rounded bg-[#1f65a7] text-xs text-white hover:bg-[#174f82]">
                  <Check className="h-3.5 w-3.5" />
                  确认
                </button>
              </div>

              <div className="rounded border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                <div className="mb-1 flex items-center gap-1 font-semibold text-slate-900">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-700" />
                  审计链
                </div>
                来源文件、识别结果、规则命中、修改记录、确认人和入账时间全部进入日志。
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function AuditLog({ liveLogs }: { liveLogs: ReturnType<typeof useAuditLogs> }) {
  const rows = [
    ...liveLogs.map((log) => [log.time, log.action, `${log.object}｜${log.result}｜${log.status}`]),
    ...aiStaticAuditLogs,
  ]
  return (
    <div className="p-3">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-[#e8eef6] text-slate-700">
          <tr><th className="border border-slate-300 px-2 py-2 text-left">时间</th><th className="border border-slate-300 px-2 py-2 text-left">动作</th><th className="border border-slate-300 px-2 py-2 text-left">说明</th></tr>
        </thead>
        <tbody>
          {rows.map(([time, action, detail]) => (
            <tr key={`${time}-${action}`}>
              <td className="border border-slate-200 px-2 py-2 font-mono"><Clock className="mr-1 inline h-3.5 w-3.5 text-slate-400" />{time}</td>
              <td className="border border-slate-200 px-2 py-2">{action}</td>
              <td className="border border-slate-200 px-2 py-2">{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-[#1f65a7]'
  return (
    <div className="border-r border-slate-200 px-4 py-3 last:border-r-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', color)}>{value}</div>
    </div>
  )
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7] hover:text-[#1f65a7]">
      {icon}
      {label}
    </button>
  )
}

function StatusBadge({ value }: { value: AiTaskStatus }) {
  const className =
    value === '已生成凭证'
      ? 'bg-green-50 text-green-700'
      : value === '异常' || value === '已拒绝'
        ? 'bg-red-50 text-red-700'
        : value === '已修改'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-amber-50 text-amber-700'
  return <span className={cn('inline-flex rounded px-2 py-0.5', className)}>{value}</span>
}

function Confidence({ value }: { value: number }) {
  const className = value >= 90 ? 'text-green-700 bg-green-50' : value >= 80 ? 'text-[#1f65a7] bg-blue-50' : 'text-amber-700 bg-amber-50'
  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold tabular-nums', className)}>{value}%</span>
}
