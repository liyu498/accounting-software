import {
  ChevronDown,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Play,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { exportHtmlToPdf } from '../../lib/pdfExport'
import { recordExportJob } from '../../lib/exportJobs'

const declarationRows = [
  {
    id: 'VAT-202605',
    category: '增值税及附加',
    form: '增值税及附加税费申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '待确认',
    declareStatus: '未申报',
    source: '销项发票 58 张 / 进项发票 72 张 / 凭证 82 张',
    sales: '680,000.00',
    deduction: '42,860.00',
    payable: '54,210.00',
    risk: '2 张进项未勾选',
    owner: '王会计',
    updated: '06-22 09:32',
  },
  {
    id: 'IIT-202605',
    category: '扣缴所得税',
    form: '个人所得税扣缴申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '待确认',
    declareStatus: '未申报',
    source: '薪酬表 42 人 / 专项附加扣除 26 条',
    sales: '386,200.00',
    deduction: '52,000.00',
    payable: '18,420.00',
    risk: '1 人扣除资料不完整',
    owner: '李会计',
    updated: '06-22 09:35',
  },
  {
    id: 'CIT-Q2',
    category: '企业所得税',
    form: '企业所得税月季度预缴纳税申报表',
    period: '2026-Q2',
    collectStatus: '已取数',
    checkStatus: '校验通过',
    declareStatus: '待申报',
    source: '利润表 / 纳税调整 / 历史亏损',
    sales: '126,000.00',
    deduction: '0.00',
    payable: '6,300.00',
    risk: '无',
    owner: '赵会计',
    updated: '06-22 09:38',
  },
  {
    id: 'STAMP-202605',
    category: '印花税',
    form: '财产和行为税纳税申报表',
    period: '2026-05',
    collectStatus: '待补资料',
    checkStatus: '需复核',
    declareStatus: '未申报',
    source: '合同台账 / 单据登记',
    sales: '980,000.00',
    deduction: '0.00',
    payable: '490.00',
    risk: '合同金额与单据金额不一致',
    owner: '王会计',
    updated: '06-22 09:41',
  },
  {
    id: 'SSF-202605',
    category: '社保费',
    form: '社会保险费申报表',
    period: '2026-05',
    collectStatus: '已取数',
    checkStatus: '校验通过',
    declareStatus: '待申报',
    source: '人员登记 42 人 / 社保公积金明细',
    sales: '103,870.00',
    deduction: '0.00',
    payable: '103,870.00',
    risk: '无',
    owner: '李会计',
    updated: '06-22 09:43',
  },
]

const riskRows = [
  ['阻断', '增值税及附加', '进项发票未完成勾选，抵扣税额不能进入申报主表', '发票勾选'],
  ['提示', '扣缴所得税', '员工王五专项附加扣除缺少结束月份', '专项附加扣除'],
  ['复核', '印花税', '合同台账金额与单据登记金额差异 20,000.00', '单据登记'],
]

const logs = [
  ['09:30', '重新取数', '系统从发票、凭证、工资和账簿生成本期申报快照'],
  ['09:32', '风险校验', '发现 1 条阻断、2 条需复核事项'],
  ['09:38', '人工确认', '企业所得税和社保费标记为待申报'],
  ['09:43', '导出申报包', '生成 Excel、PDF、取数说明和操作日志'],
]

const tabs = ['申报清单', '增值税', '企业所得税', '扣缴所得税', '印花税', '社保费', '财报报送', '回执缴款书']

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildTaxDeclarationPackageHtml(exportedAt: string) {
  const declarationBody = declarationRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.form)}</td>
      <td>${escapeHtml(row.period)}</td>
      <td>${escapeHtml(row.collectStatus)}</td>
      <td>${escapeHtml(row.checkStatus)}</td>
      <td>${escapeHtml(row.declareStatus)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td class="num">${escapeHtml(row.sales)}</td>
      <td class="num">${escapeHtml(row.deduction)}</td>
      <td class="num strong">${escapeHtml(row.payable)}</td>
      <td>${escapeHtml(row.risk)}</td>
      <td>${escapeHtml(row.owner)}</td>
    </tr>
  `).join('')
  const riskBody = riskRows.map(([level, module, desc, link]) => `
    <tr><td>${escapeHtml(level)}</td><td>${escapeHtml(module)}</td><td>${escapeHtml(desc)}</td><td>${escapeHtml(link)}</td></tr>
  `).join('')
  const logBody = logs.map(([time, action, detail]) => `
    <tr><td>${escapeHtml(time)}</td><td>${escapeHtml(action)}</td><td>${escapeHtml(detail)}</td></tr>
  `).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>税务申报包-2026-05</title><style>
    body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:22px;color:#111827}
    h1{text-align:center;font-size:20px;margin:0 0 8px} h2{font-size:15px;margin:18px 0 8px}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin:10px 0 14px;font-size:12px;color:#334155}
    .meta span{border-bottom:1px solid #cbd5e1;padding-bottom:5px}
    table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #64748b;padding:6px 7px;vertical-align:top}
    th{background:#e8eef6;text-align:left}.num{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.strong{font-weight:700}
    .notice{margin-top:14px;border:1px solid #cbd5e1;background:#f8fafc;padding:9px;font-size:11px;line-height:1.7;color:#475569}
    .sign{display:flex;justify-content:space-between;margin-top:18px;font-size:12px;color:#334155}
  </style></head><body>
    <h1>税务申报包</h1>
    <div class="meta">
      <span>纳税人: 科旋电气（上海）有限公司</span><span>纳税人识别号: 91310115MA1K3****X</span><span>所属期: 2026-05</span>
      <span>申报状态: 待人工确认</span><span>生成时间: ${escapeHtml(exportedAt)}</span><span>生成来源: 税务申报工作台</span>
    </div>
    <h2>一、申报清单</h2>
    <table><thead><tr><th>税种</th><th>申报表</th><th>所属期</th><th>取数状态</th><th>校验状态</th><th>申报状态</th><th>取数来源</th><th>计税依据</th><th>抵扣/减免</th><th>应缴金额</th><th>风险</th><th>负责人</th></tr></thead><tbody>${declarationBody}</tbody></table>
    <h2>二、风险与阻断</h2>
    <table><thead><tr><th>级别</th><th>税种/模块</th><th>风险说明</th><th>处理入口</th></tr></thead><tbody>${riskBody}</tbody></table>
    <h2>三、取数说明</h2>
    <table><tbody>
      <tr><td>销项税额</td><td>来自销项发票清单，按税率分组汇总。</td></tr>
      <tr><td>进项抵扣</td><td>来自已认证进项发票，未勾选发票不进入申报主表。</td></tr>
      <tr><td>企业所得税</td><td>来自利润表和纳税调整快照。</td></tr>
      <tr><td>工资个税</td><td>来自薪酬表、人员登记和专项附加扣除资料。</td></tr>
    </tbody></table>
    <h2>四、操作日志</h2>
    <table><thead><tr><th>时间</th><th>动作</th><th>说明</th></tr></thead><tbody>${logBody}</tbody></table>
    <div class="notice">边界说明: 本申报包为系统取数、校验、人工确认和留档材料，不代表已向电子税务局提交，也不代表已完成扣款或回执收取。真实申报必须通过合法税局 adapter、授权登录、提交回执和人工确认闭环。</div>
    <div class="sign"><span>制表: 系统</span><span>复核: 未签章</span><span>客户确认: 未签章</span></div>
  </body></html>`
}

function statusBadge(value: string) {
  const className =
    value === '校验通过' || value === '待申报' || value === '已取数'
      ? 'bg-green-50 text-green-700 ring-green-100'
      : value === '需复核' || value === '待确认' || value === '待补资料'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-slate-50 text-slate-600 ring-slate-200'

  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1', className)}>{value}</span>
}

function riskBadge(value: string) {
  const cls = value === '无' ? 'text-slate-400' : value.includes('不一致') || value.includes('未勾选') ? 'text-red-600' : 'text-amber-600'
  return <span className={cn('text-xs font-medium', cls)}>{value}</span>
}

export function TaxWorkspace() {
  const [showRulesLog, setShowRulesLog] = useState(false)

  const exportTaxPackage = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = '税务申报包-2026-05.html'
    const html = buildTaxDeclarationPackageHtml(exportedAt)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: '申报包HTML',
      scope: '2026-05/全部税种',
      templateKind: 'tax',
      rowCount: declarationRows.length,
    })
  }

  const printTaxPackage = () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = '税务申报包-2026-05-print'
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(buildTaxDeclarationPackageHtml(exportedAt))
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: '打印预览',
      scope: '2026-05/全部税种',
      templateKind: 'tax',
      rowCount: declarationRows.length,
    })
  }

  const exportTaxPackagePdf = async () => {
    const exportedAt = new Date().toLocaleString('zh-CN')
    const fileName = '税务申报包-2026-05.pdf'
    await exportHtmlToPdf({
      html: buildTaxDeclarationPackageHtml(exportedAt),
      fileName,
      pageTitle: '税务申报包 2026-05',
    })
    recordExportJob({
      fileName,
      moduleName: '税务申报工作台',
      format: 'PDF',
      scope: '2026-05/全部税种',
      templateKind: 'tax',
      rowCount: declarationRows.length,
    })
  }

  return (
    <div className="h-full min-w-0 bg-[#f3f6fa] text-slate-900">
      <div className="border border-slate-200 bg-white">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-base font-semibold">税务申报</h1>
            <span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-100">已结账</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="重新取数" />
            <ToolbarButton icon={<ShieldAlert className="h-3.5 w-3.5" />} label="风险检查" />
            <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} label="导出申报包" onClick={exportTaxPackage} />
            <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} label="导出PDF" onClick={exportTaxPackagePdf} />
            <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} label="打印申报包" onClick={printTaxPackage} />
            <button className="inline-flex h-8 items-center gap-1 rounded bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]">
              <Play className="h-3.5 w-3.5" />
              确认申报
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto border-b border-slate-200 bg-[#f8fafc] px-2">
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

        <div className="grid grid-cols-2 border-b border-slate-200 bg-white md:grid-cols-3 xl:grid-cols-6">
          {[
            ['应申报税种', '5'],
            ['已取数', '4'],
            ['校验通过', '2'],
            ['待确认', '2'],
            ['阻断风险', '1'],
            ['预计应缴', '183,290.00'],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-slate-100 px-4 py-3 last:border-r-0">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#fbfcfe] px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1f65a7] sm:w-72" placeholder="搜索税种、申报表、取数来源" />
            </div>
            <SelectLike label="申报状态" value="全部" />
            <SelectLike label="校验状态" value="全部" />
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <ToolbarButton icon={<Upload className="h-3.5 w-3.5" />} label="导入初始化" />
            <ToolbarButton icon={<FileSpreadsheet className="h-3.5 w-3.5" />} label="下载模板" />
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="规则与日志" onClick={() => setShowRulesLog((value) => !value)} />
            <ToolbarButton icon={<Settings2 className="h-3.5 w-3.5" />} label="列设置" />
          </div>
        </div>
      </div>

      {showRulesLog && <TaxRulesLogPanel />}

      <div className="min-w-0 pt-3">
        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck2 className="h-4 w-4 text-[#1f65a7]" />
              本期申报清单
            </div>
            <div className="text-xs text-slate-500">显示 5 条，金额单位: 元</div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1240px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#eef3f8] text-slate-600">
                <tr>
                  <th className="w-9 border-b border-slate-200 px-2 py-2">
                    <input type="checkbox" aria-label="全选" />
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2">税种</th>
                  <th className="border-b border-slate-200 px-2 py-2">申报表</th>
                  <th className="border-b border-slate-200 px-2 py-2">所属期</th>
                  <th className="border-b border-slate-200 px-2 py-2">取数状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">校验状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">申报状态</th>
                  <th className="border-b border-slate-200 px-2 py-2">取数来源</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">计税依据</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">抵扣/减免</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">应缴金额</th>
                  <th className="border-b border-slate-200 px-2 py-2">风险</th>
                  <th className="border-b border-slate-200 px-2 py-2">负责人</th>
                  <th className="border-b border-slate-200 px-2 py-2">更新时间</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {declarationRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8fbff]">
                    <td className="border-b border-slate-100 px-2 py-2">
                      <input type="checkbox" aria-label={`选择 ${row.category}`} />
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 font-medium text-slate-900">{row.category}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-700">{row.form}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.period}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.collectStatus)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.checkStatus)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{statusBadge(row.declareStatus)}</td>
                    <td className="max-w-[260px] truncate border-b border-slate-100 px-2 py-2 text-slate-600">{row.source}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono text-slate-700">{row.sales}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono text-slate-700">{row.deduction}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-mono font-semibold text-slate-900">{row.payable}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2">{riskBadge(row.risk)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-600">{row.owner}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-500">{row.updated}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right">
                      <button className="mr-2 text-[#1f65a7] hover:underline">查看</button>
                      <button className="text-[#1f65a7] hover:underline">取数</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f8fafc] font-semibold">
                <tr>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" colSpan={8}>合计</td>
                  <td className="px-2 py-2 text-right font-mono">42,860.00</td>
                  <td className="px-2 py-2 text-right font-mono">183,290.00</td>
                  <td className="px-2 py-2" colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <div>真实税局提交、扣款、回执收取需要合法 adapter 接入；当前页面只做取数、校验、确认、导出和日志。</div>
            <div>第 1 / 1 页，每页 50 条</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function TaxRulesLogPanel() {
  return (
    <section className="mt-3 border border-slate-200 bg-white">
      <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-3 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-[#1f65a7]" />
        规则与日志
      </div>
      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">风险与阻断</div>
          <div className="divide-y divide-slate-100">
            {riskRows.map(([level, module, desc, link]) => (
              <div key={desc} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className={cn('rounded px-2 py-0.5 font-medium', level === '阻断' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{level}</span>
                  <button className="text-[#1f65a7]">{link}</button>
                </div>
                <div className="mt-2 font-medium text-slate-800">{module}</div>
                <div className="mt-1 leading-5 text-slate-600">{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">取数说明</div>
          <div className="space-y-2 p-3 text-xs leading-5 text-slate-600">
            <div className="rounded bg-slate-50 p-2">销项税额来自销项发票清单，按税率分组汇总。</div>
            <div className="rounded bg-slate-50 p-2">进项抵扣来自已认证进项发票，未勾选发票不进入申报主表。</div>
            <div className="rounded bg-slate-50 p-2">企业所得税来自利润表和纳税调整快照。</div>
          </div>
        </div>
        <div>
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">操作日志</div>
          <div className="divide-y divide-slate-100">
            {logs.map(([time, action, detail]) => (
              <div key={`${time}-${action}`} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{action}</span>
                  <span className="font-mono text-slate-400">{time}</span>
                </div>
                <div className="mt-1 leading-5 text-slate-600">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
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

function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <button className="inline-flex h-8 items-center gap-2 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:border-[#1f65a7]">
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
    </button>
  )
}
