import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useToast, useSuccessToast } from '../../components/ui/Toast'
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Building2,
} from 'lucide-react'
import { cn, formatDate } from '../../lib/utils'
import { useCompanyStore } from '../../stores/companyStore'

interface ImportRecord {
  id: string
  fileName: string
  importType: string
  importDate: string
  recordCount: number
  successCount: number
  failCount: number
  status: 'success' | 'partial' | 'failed'
  importedBy: string
}

const mockImportRecords: ImportRecord[] = [
  {
    id: '1',
    fileName: '凭证导入模板-2024年1月.xlsx',
    importType: '凭证导入',
    importDate: '2024-01-15 10:30:00',
    recordCount: 50,
    successCount: 48,
    failCount: 2,
    status: 'partial',
    importedBy: 'admin',
  },
  {
    id: '2',
    fileName: '科目余额表-2024年期初.xlsx',
    importType: '期初余额',
    importDate: '2024-01-10 09:15:00',
    recordCount: 120,
    successCount: 120,
    failCount: 0,
    status: 'success',
    importedBy: 'admin',
  },
  {
    id: '3',
    fileName: '客户档案批量导入.xlsx',
    importType: '客户档案',
    importDate: '2024-01-05 14:20:00',
    recordCount: 30,
    successCount: 30,
    failCount: 0,
    status: 'success',
    importedBy: 'admin',
  },
]

export function ImportHistory() {
  const { selectedCompanyId } = useCompanyStore()
  const { addToast } = useToast()
  const successToast = useSuccessToast()

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请先选择客户账套</p>
        </div>
      </div>
    )
  }

  const [records] = useState<ImportRecord[]>(mockImportRecords)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const getStatusBadge = (status: ImportRecord['status']) => {
    const badges = {
      success: 'bg-green-100 text-green-700',
      partial: 'bg-amber-100 text-amber-700',
      failed: 'bg-red-100 text-red-700',
    }
    const labels = {
      success: '全部成功',
      partial: '部分成功',
      failed: '导入失败',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          badges[status]
        )}
      >
        {labels[status]}
      </span>
    )
  }

  const handleDownloadTemplate = (type: string) => {
    addToast(`${type}导入模板下载功能开发中`, 'info')
  }

  const handleUpload = () => {
    setShowUploadModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">历史凭证导入</h1>
          <p className="text-gray-500 mt-1">查看历史导入记录，下载导入模板</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleUpload}>
            <Upload className="w-4 h-4 mr-2" />
            新建导入
          </Button>
        </div>
      </div>

      {/* Import Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">凭证导入模板</p>
                <p className="text-xs text-gray-500">支持凭证批量导入</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDownloadTemplate('凭证')}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">期初余额模板</p>
                <p className="text-xs text-gray-500">科目期初余额导入</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDownloadTemplate('期初余额')}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">客户档案模板</p>
                <p className="text-xs text-gray-500">客户信息批量导入</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDownloadTemplate('客户档案')}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Records */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-900">导入历史记录</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  导入类型
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  导入时间
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记录数
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成功
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  失败
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作人
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.fileName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{record.importType}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{record.importDate}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{record.recordCount}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-green-600">{record.successCount}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{record.failCount}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(record.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{record.importedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowUploadModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建导入</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">导入类型</label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="voucher">凭证导入</option>
                  <option value="balance">期初余额导入</option>
                  <option value="customer">客户档案导入</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">选择文件</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">点击选择文件或拖拽文件到此处</p>
                  <p className="text-xs text-gray-400 mt-1">支持 .xlsx, .xls, .csv 格式</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
                取消
              </Button>
              <Button variant="primary" onClick={() => {
                successToast('导入功能开发中')
                setShowUploadModal(false)
              }}>
                开始导入
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
