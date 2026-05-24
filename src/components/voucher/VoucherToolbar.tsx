import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface VoucherToolbarProps {
  title: string
}

export function VoucherToolbar({ title }: VoucherToolbarProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/vouchers')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="返回凭证列表"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="text-xs text-gray-400">
        F12 保存 · = 自动平衡 · Space 切换借贷 · Enter 下一行 · Ctrl+N 新增行 · Ctrl+D 删除行
      </div>
    </div>
  )
}
