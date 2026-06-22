import { AlertCircle, CheckCircle2, Clock3, Download, FileCheck2, FileText, LockKeyhole, Play, Printer, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { cn } from '../../lib/utils'

const declarationSteps = [
  { label: '未取数', done: true },
  { label: '已取数', done: true },
  { label: '校验通过', done: true },
  { label: '待确认', done: false },
  { label: '已申报', done: false },
  { label: '扣款状态', done: false },
  { label: '回执/缴款书', done: false },
]

const taxItems = [
  { tax: '增值税及附加', period: '2026-05', source: '销项发票、进项发票、账簿', payable: '¥54,210.00', status: '待确认', risk: '进项税额有 2 张发票未勾选' },
  { tax: '企业所得税', period: '2026-Q2', source: '利润表、纳税调整', payable: '¥6,300.00', status: '校验通过', risk: '收入与利润表一致' },
  { tax: '印花税', period: '2026-05', source: '合同台账、单据登记', payable: '¥490.00', status: '需复核', risk: '合同金额与单据金额存在差异' },
  { tax: '扣缴所得税', period: '2026-05', source: '薪酬表、专项附加扣除', payable: '¥18,420.00', status: '待确认', risk: '1 名员工专项扣除缺少结束月份' },
  { tax: '社保费', period: '2026-05', source: '人员登记、社保公积金', payable: '¥103,870.00', status: '校验通过', risk: '缴费人数与工资表一致' },
]

const logs = [
  { time: '2026-06-22 09:30', action: '重新取数', result: '生成 5 个申报快照', user: '系统' },
  { time: '2026-06-22 09:32', action: '风险校验', result: '发现 3 条需复核事项', user: '系统' },
  { time: '2026-06-22 09:38', action: '人工确认', result: '企业所得税标记为可申报', user: '管理员' },
]

function taxStatus(status: string) {
  const cls: Record<string, string> = {
    待确认: 'bg-amber-100 text-amber-700',
    校验通过: 'bg-green-100 text-green-700',
    需复核: 'bg-red-100 text-red-700',
  }
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', cls[status] || 'bg-gray-100 text-gray-700')}>{status}</span>
}

export function TaxWorkspace() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">税务申报工作台</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">按账期完成取数、校验、确认、申报、扣款和回执归档；真实提交通过后续税局 adapter 接入。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />重新取数</Button>
          <Button variant="outline" size="sm"><FileCheck2 className="mr-2 h-4 w-4" />风险校验</Button>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />导出申报包</Button>
          <Button variant="primary" size="sm"><Play className="mr-2 h-4 w-4" />确认申报</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
            {declarationSteps.map((step, index) => (
              <div key={step.label} className={cn('rounded-lg border p-3', step.done ? 'border-green-100 bg-green-50 text-green-700' : index === 3 ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-500')}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  {step.label}
                </div>
                <div className="mt-1 text-xs opacity-80">{index + 1}. 申报流程</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">本期申报清单</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">所有金额均来自已保存的取数快照，确认前可追溯到报表、凭证和来源单据。</p>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"><Printer className="mr-1 h-3.5 w-3.5" />打印</button>
                <button className="inline-flex items-center rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"><FileText className="mr-1 h-3.5 w-3.5" />取数说明</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3">税种/事项</th>
                    <th className="px-3 py-3">申报期</th>
                    <th className="px-3 py-3">取数来源</th>
                    <th className="px-3 py-3 text-right">应缴金额</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">风险/差异</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                  {taxItems.map((item) => (
                    <tr key={item.tax} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900 dark:text-gray-100">{item.tax}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{item.period}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{item.source}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{item.payable}</td>
                      <td className="whitespace-nowrap px-3 py-3">{taxStatus(item.status)}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.risk}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <button className="text-sm font-medium text-primary-600 hover:text-primary-700">查看快照</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                申报边界
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                当前版本实现申报取数、校验、确认、导出和日志。真实税局提交、扣款、回执收取必须接入合法税务服务 adapter 后启用，不能伪装为已自动提交。
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="text-gray-500">取数快照</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">5 个</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="text-gray-500">阻断风险</div>
                  <div className="mt-1 font-semibold text-red-600">1 条</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <LockKeyhole className="h-4 w-4 text-gray-500" />
                操作日志
              </div>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.time} className="rounded-lg border border-gray-100 p-3 text-xs dark:border-gray-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{log.action}</span>
                      <span className="text-gray-500">{log.time}</span>
                    </div>
                    <div className="mt-1 text-gray-600 dark:text-gray-300">{log.result}</div>
                    <div className="mt-1 text-gray-400">操作人: {log.user}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-2 p-4 text-xs text-gray-600 dark:text-gray-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>所有确认、申报、扣款动作都需要二次确认并写入日志，已结账期间默认只读。</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
