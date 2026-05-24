import { useState } from 'react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import {
  Settings as SettingsIcon,
  BookOpen,
  Import,
  Wallet,
  Users,
  Building2,
  Truck,
  ArrowLeftRight,
  FileText,
  ChevronRight,
  Palette,
  Database,
  Shield,
  Info,
  Moon,
  Sun,
  Download,
  Upload,
  Edit2,
  Plus,
  User,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useToast } from '../components/ui/Toast'

interface SettingsProps {
  onNavigate?: (path: string) => void
}

// 设置模块配置
const settingsModules = [
  {
    category: '基本设置',
    items: [
      {
        id: 'account-codes',
        title: '科目设置',
        description: '管理会计科目编码和名称',
        icon: BookOpen,
        path: '/settings/account-codes',
        color: 'bg-blue-100 text-blue-600',
      },
      {
        id: 'initial-balances',
        title: '期初余额设置',
        description: '设置各科目期初余额',
        icon: Import,
        path: '/settings/initial-balances',
        color: 'bg-green-100 text-green-600',
      },
      {
        id: 'import-history',
        title: '历史凭证导入',
        description: '从Excel导入历史凭证',
        icon: FileText,
        path: '/settings/import-history',
        color: 'bg-purple-100 text-purple-600',
      },
    ],
  },
  {
    category: '数据设置',
    items: [
      {
        id: 'account-registration',
        title: '账户登记',
        description: '管理银行账户信息',
        icon: Wallet,
        path: '/settings/account-registration',
        color: 'bg-cyan-100 text-cyan-600',
      },
      {
        id: 'customer-contracts',
        title: '客户与合同',
        description: '管理客户信息和合同',
        icon: Users,
        path: '/settings/customer-contracts',
        color: 'bg-indigo-100 text-indigo-600',
      },
      {
        id: 'suppliers',
        title: '供应商',
        description: '管理供应商信息',
        icon: Truck,
        path: '/settings/suppliers',
        color: 'bg-orange-100 text-orange-600',
      },
      {
        id: 'other-contacts',
        title: '其他往来',
        description: '管理其他往来单位',
        icon: ArrowLeftRight,
        path: '/settings/other-contacts',
        color: 'bg-pink-100 text-pink-600',
      },
    ],
  },
  {
    category: '回收站',
    items: [
      {
        id: 'voucher-recycle',
        title: '凭证回收箱',
        description: '查看已删除的凭证',
        icon: FileText,
        path: '/settings/voucher-recycle',
        color: 'bg-gray-100 text-gray-600',
      },
    ],
  },
]

export function Settings(_props: SettingsProps) {
  const { addToast } = useToast()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const handleNavigate = (path: string) => {
    if (_props.onNavigate) {
      _props.onNavigate(path)
    }
    // 尝试通过 window.location 导航（如果使用 React Router）
    console.log('Navigate to:', path)
  }

  const handleBackup = () => {
    addToast('数据备份已开始，请稍候...', 'info')
  }

  const handleRestore = () => {
    addToast('数据恢复功能开发中...', 'info')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
          <p className="text-gray-500 mt-1">管理系统配置和数据</p>
        </div>
      </div>

      {/* Settings Modules Grid */}
      {settingsModules.map((module) => (
        <div key={module.category}>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            {module.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {module.items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md hover:border-primary-300 transition-all group"
                onClick={() => handleNavigate(item.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                          {item.title}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-400 transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Theme Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'light' ? 'bg-purple-100 text-purple-600' : 'bg-gray-800 text-yellow-400')}>
                  {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">主题设置</h3>
                  <p className="text-sm text-gray-500">{theme === 'light' ? '浅色模式' : '深色模式'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors',
                  theme === 'dark' ? 'bg-primary-600' : 'bg-gray-300'
                )}
                aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Data Backup */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">数据备份</h3>
                <p className="text-sm text-gray-500">备份和恢复数据</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleBackup}>
                <Download className="w-4 h-4 mr-1" />
                备份
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleRestore}>
                <Upload className="w-4 h-4 mr-1" />
                恢复
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">最后备份：2024-01-15 02:00:00</p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">安全设置</h3>
                <p className="text-sm text-gray-500">密码和权限</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => addToast('修改密码功能开发中', 'info')}>
                <Shield className="w-4 h-4 mr-1" />
                修改密码
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => addToast('审计日志功能开发中', 'info')}>
                <Info className="w-4 h-4 mr-1" />
                审计日志
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">代账公司智能记账软件</h3>
                <p className="text-sm text-gray-500">版本 v1.0.0</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span>数据库版本 v1.0.0</span>
              <span>构建日期 2024-01-01</span>
              <span>许可证 商用授权</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
