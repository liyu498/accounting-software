import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Bot, Upload, FileText, Check, X, Edit2, Clock, Loader2, Sparkles, AlertCircle, Building2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { formatCurrency, formatDate } from '../lib/utils'
import { useCompanyStore } from '../stores/companyStore'

interface AIVoucherPreview {
  id: string
  invoiceNumber?: string
  date: string
  description: string
  entries: {
    accountCode: string
    accountName: string
    debit: number
    credit: number
  }[]
  confidence: number
  status: 'pending' | 'approved' | 'modified' | 'rejected'
  createdAt: string
}

const mockAIHistory: AIVoucherPreview[] = [
  {
    id: '1',
    invoiceNumber: 'FP-2024-045',
    date: '2024-01-15',
    description: '收到客户货款',
    entries: [
      { accountCode: '1002', accountName: '银行存款', debit: 125000.00, credit: 0 },
      { accountCode: '1122', accountName: '应收账款', debit: 0, credit: 125000.00 },
    ],
    confidence: 96,
    status: 'approved',
    createdAt: '2024-01-15 14:30:22',
  },
  {
    id: '2',
    invoiceNumber: 'FP-2024-044',
    date: '2024-01-15',
    description: '支付供应商货款',
    entries: [
      { accountCode: '2202', accountName: '应付账款', debit: 0, credit: 56800.00 },
      { accountCode: '1002', accountName: '银行存款', debit: 56800.00, credit: 0 },
    ],
    confidence: 94,
    status: 'approved',
    createdAt: '2024-01-15 14:25:10',
  },
  {
    id: '3',
    invoiceNumber: 'FP-2024-043',
    date: '2024-01-14',
    description: '办公室租金支出',
    entries: [
      { accountCode: '6603', accountName: '管理费用', debit: 12000.00, credit: 0 },
      { accountCode: '1002', accountName: '银行存款', debit: 0, credit: 12000.00 },
    ],
    confidence: 91,
    status: 'modified',
    createdAt: '2024-01-14 16:45:33',
  },
  {
    id: '4',
    invoiceNumber: 'FP-2024-042',
    date: '2024-01-14',
    description: '购买办公用品',
    entries: [
      { accountCode: '6603', accountName: '管理费用', debit: 1250.00, credit: 0 },
      { accountCode: '1001', accountName: '库存现金', debit: 0, credit: 1250.00 },
    ],
    confidence: 88,
    status: 'rejected',
    createdAt: '2024-01-14 11:20:05',
  },
]

const mockGeneratedVoucher: AIVoucherPreview = {
  id: 'new',
  invoiceNumber: 'FP-2024-046',
  date: '2024-01-16',
  description: '收到客户预付款',
  entries: [
    { accountCode: '1002', accountName: '银行存款', debit: 50000.00, credit: 0 },
    { accountCode: '2241', accountName: '其他应付款', debit: 0, credit: 50000.00 },
  ],
  confidence: 93,
  status: 'pending',
  createdAt: '2024-01-16 09:15:00',
}

interface AIBookkeepingProps {
  onNavigate?: (path: string) => void
}

export function AIBookkeeping(_props: AIBookkeepingProps) {
  const { selectedCompanyId } = useCompanyStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generatedVoucher, setGeneratedVoucher] = useState<AIVoucherPreview | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0]) {
      handleFileUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0 && files[0]) {
      handleFileUpload(files[0])
    }
  }

  const handleFileUpload = (_file: File) => {
    // Start processing animation
    setIsProcessing(true)
    setShowPreview(false)

    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false)
      setGeneratedVoucher(mockGeneratedVoucher)
      setShowPreview(true)
    }, 3000)
  }

  const handleApprove = () => {
    console.log('Approved voucher:', generatedVoucher)
    setShowPreview(false)
    setGeneratedVoucher(null)
    // Show success toast
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = '凭证已生成并保存'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  const handleReject = () => {
    console.log('Rejected voucher')
    setShowPreview(false)
    setGeneratedVoucher(null)
  }

  const getStatusBadge = (status: AIVoucherPreview['status']) => {
    const badges = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      modified: 'bg-blue-100 text-blue-700',
      rejected: 'bg-red-100 text-red-700',
    }
    const labels = {
      pending: '待审核',
      approved: '已确认',
      modified: '已修改',
      rejected: '已拒绝',
    }
    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', badges[status])}>
        {labels[status]}
      </span>
    )
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-600'
    if (confidence >= 85) return 'text-blue-600'
    if (confidence >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI智能记账</h1>
          <p className="text-gray-500 mt-1">上传发票单据，AI自动生成记账凭证</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upload')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'upload'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          上传单据
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'history'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          处理记录
        </button>
      </div>

      {activeTab === 'upload' ? (
        <>
          {/* Upload Area */}
          <Card>
            <CardContent className="p-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
                  isDragging
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                )}
              >
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mb-4',
                    isDragging ? 'bg-primary-100' : 'bg-gray-100'
                  )}>
                    <Upload className={cn('w-8 h-8', isDragging ? 'text-primary-600' : 'text-gray-400')} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    拖拽发票或单据到此处
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    支持 JPG、PNG、PDF 格式
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processing State */}
          {isProcessing && (
            <Card>
              <CardContent className="p-12">
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-primary-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI正在分析...</h3>
                  <p className="text-sm text-gray-500 mb-4">正在识别发票信息并生成凭证</p>
                  <div className="flex items-center gap-2 text-sm text-primary-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>图像识别中</span>
                  </div>
                  <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Preview */}
          {showPreview && generatedVoucher && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">AI生成凭证预览</h2>
                      <p className="text-sm text-gray-500">置信度：
                        <span className={cn('font-medium', getConfidenceColor(generatedVoucher.confidence))}>
                          {generatedVoucher.confidence}%
                        </span>
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(generatedVoucher.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">发票号</label>
                      <p className="text-sm font-mono text-primary-600">{generatedVoucher.invoiceNumber}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">日期</label>
                      <p className="text-sm text-gray-900">{formatDate(generatedVoucher.date)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">摘要</label>
                      <p className="text-sm text-gray-900">{generatedVoucher.description}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">凭证分录</label>
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">科目编码</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">科目名称</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">借方金额</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">贷方金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedVoucher.entries.map((entry, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-sm font-mono">{entry.accountCode}</td>
                          <td className="px-4 py-2 text-sm">{entry.accountName}</td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono text-red-600">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                        <td colSpan={2} className="px-4 py-2 text-sm">合计</td>
                        <td className="px-4 py-2 text-sm text-right font-mono">{formatCurrency(generatedVoucher.entries.reduce((sum, e) => sum + e.debit, 0))}</td>
                        <td className="px-4 py-2 text-sm text-right font-mono">{formatCurrency(generatedVoucher.entries.reduce((sum, e) => sum + e.credit, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">AI分析置信度 {generatedVoucher.confidence}%</p>
                      <p className="text-amber-700">请仔细核对凭证信息，确保准确无误后再确认。</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <Button variant="secondary" onClick={handleReject}>
                  <X className="w-4 h-4 mr-2" />
                  拒绝
                </Button>
                <Button variant="outline" onClick={() => console.log('Modify')}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  修改
                </Button>
                <Button variant="primary" onClick={handleApprove}>
                  <Check className="w-4 h-4 mr-2" />
                  确认生成
                </Button>
              </div>
            </Card>
          )}

          {/* Quick Stats */}
          {!isProcessing && !showPreview && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-primary-600 mb-1">89</div>
                  <div className="text-sm text-gray-500">本月AI自动生成</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">96.5%</div>
                  <div className="text-sm text-gray-500">平均置信度</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">3.2s</div>
                  <div className="text-sm text-gray-500">平均处理时间</div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        /* History Tab */
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">处理历史</h2>
            <p className="text-sm text-gray-500 mt-1">最近20条AI处理记录</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发票号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">置信度</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockAIHistory.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{record.createdAt}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-primary-600">
                      {record.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.description}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn('font-medium', getConfidenceColor(record.confidence))}>
                        {record.confidence}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => console.log('View', record.id)}
                        className="text-gray-500 hover:text-primary-600"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}