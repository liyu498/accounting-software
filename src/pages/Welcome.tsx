import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useWarningToast, useSuccessToast } from '../components/ui/Toast'
import {
  Plus,
  Building2,
  Trash2,
  ChevronRight,
  Power,
  PowerOff,
  RotateCcw,
  Archive,
} from 'lucide-react'
import { useCompanyStore, type Company } from '../stores/companyStore'
import { usePeriodStore } from '../stores/periodStore'
import { taxpayerTypeLabels, accountingSystemLabels, accountingSystemDescriptions, accountingStandardLabels, provinces, citiesByProvince, TaxpayerType, AccountingSystem } from '../lib/constants'
import { cn } from '../lib/utils'

export function Welcome() {
  const navigate = useNavigate()
  const warningToast = useWarningToast()
  const successToast = useSuccessToast()

  const {
    companies,
    selectedCompanyId,
    selectCompany,
    fetchCompanies,
    createCompany,
    deleteCompany,
    deactivateCompany,
    activateCompany,
    restoreCompany,
    permanentDeleteCompany,
    getDeletedCompanies,
    cleanupExpiredCompanies,
  } = useCompanyStore()

  const { fetchPeriods, fetchVoucherWords } = usePeriodStore()

  useEffect(() => {
    fetchCompanies().catch((err) => {
      console.error('[Welcome] fetchCompanies failed:', err)
    })
  }, [fetchCompanies])

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [deletedCompanies, setDeletedCompanies] = useState<Company[]>([])
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    taxId: '',
    province: '',
    city: '',
    taxpayerType: 'small' as TaxpayerType,
    accountingSystem: 'small_enterprise' as AccountingSystem,
    enableYear: new Date().getFullYear(),
    enableMonth: new Date().getMonth() + 1,
  })

  const filteredCompanies = useMemo(() => {
    let list = companies
    if (!showInactive) {
      list = list.filter((c) => c.is_active)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      )
    }
    return list
  }, [companies, searchQuery, showInactive])

  const activeCount = useMemo(() => companies.filter((c) => c.is_active).length, [companies])
  const inactiveCount = useMemo(() => companies.filter((c) => !c.is_active).length, [companies])

  const handleSelectCompany = async (companyId: string) => {
    selectCompany(companyId)
    await fetchPeriods(companyId)
    await fetchVoucherWords(companyId)
    navigate('/dashboard')
  }

  const handleCreateCompany = async () => {
    if (!newCompany.name.trim() || !newCompany.code.trim()) {
      warningToast('请填写客户名称和编码')
      return
    }
    if (!newCompany.taxId.trim()) {
      warningToast('请填写纳税人识别号')
      return
    }

    try {
      const company = await createCompany({
        code: newCompany.code,
        name: newCompany.name,
        tax_id: newCompany.taxId,
        tax_type: newCompany.taxpayerType,
        province: newCompany.province || undefined,
        city: newCompany.city || undefined,
        accounting_system: newCompany.accountingSystem,
        enable_year: newCompany.enableYear,
        enable_month: newCompany.enableMonth,
      })
      setShowAddModal(false)
      setNewCompany({
        name: '',
        code: '',
        taxId: '',
        province: '',
        city: '',
        taxpayerType: 'small',
        accountingSystem: 'small_enterprise',
        enableYear: new Date().getFullYear(),
        enableMonth: new Date().getMonth() + 1,
      })
      handleSelectCompany(company.id)
    } catch (error) {
      warningToast(`创建失败: ${error}`)
    }
  }

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`确定要删除账套「${name}」吗？\n\n删除后保留30天，期间可从回收站恢复。30天后将永久删除。`)) return
    try {
      await deleteCompany(id)
      successToast(`账套「${name}」已删除，30天内可恢复`)
    } catch (error) {
      warningToast(`删除失败: ${error}`)
    }
  }

  const handleDeactivateCompany = async (id: string, name: string) => {
    if (!confirm(`确定要停用账套「${name}」吗？\n\n停用后该账套数据保留，但无法进行日常操作。可随时重新启用。`)) return
    try {
      await deactivateCompany(id)
      successToast(`账套「${name}」已停用`)
    } catch (error) {
      warningToast(`停用失败: ${error}`)
    }
  }

  const handleActivateCompany = async (id: string, name: string) => {
    try {
      await activateCompany(id)
      successToast(`账套「${name}」已启用`)
    } catch (error) {
      warningToast(`启用失败: ${error}`)
    }
  }

  const handleOpenRecycleBin = async () => {
    try {
      const deleted = await getDeletedCompanies()
      setDeletedCompanies(deleted)
      setShowRecycleBin(true)
    } catch (error) {
      warningToast(`获取回收站数据失败: ${error}`)
    }
  }

  const handleRestoreCompany = async (id: string, name: string) => {
    try {
      await restoreCompany(id)
      const deleted = await getDeletedCompanies()
      setDeletedCompanies(deleted)
      successToast(`账套「${name}」已恢复`)
    } catch (error) {
      warningToast(`恢复失败: ${error}`)
    }
  }

  const handlePermanentDelete = async (id: string, name: string) => {
    if (!confirm(`确定要永久删除账套「${name}」吗？\n\n此操作不可恢复，所有数据将被彻底清除！`)) return
    if (!confirm(`再次确认：永久删除「${name}」的所有数据？`)) return
    try {
      await permanentDeleteCompany(id)
      const deleted = await getDeletedCompanies()
      setDeletedCompanies(deleted)
      successToast(`账套「${name}」已永久删除`)
    } catch (error) {
      warningToast(`永久删除失败: ${error}`)
    }
  }

  const handleCleanup = async () => {
    try {
      const count = await cleanupExpiredCompanies()
      if (count > 0) {
        const deleted = await getDeletedCompanies()
        setDeletedCompanies(deleted)
        successToast(`已清理 ${count} 个过期账套`)
      } else {
        successToast('暂无过期账套需要清理')
      }
    } catch (error) {
      warningToast(`清理失败: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">代账客户管理</h1>
              <p className="text-sm text-gray-500 mt-1">
                共 {activeCount} 家客户{inactiveCount > 0 && `，${inactiveCount} 家已停用`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增客户
              </Button>
              <Button variant="outline" onClick={handleOpenRecycleBin}>
                <Archive className="w-4 h-4 mr-2" />
                回收站
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-4">
            <Input
              placeholder="搜索客户名称或编码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            {inactiveCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                显示已停用 ({inactiveCount})
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Company List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">暂无客户</p>
            <p className="text-gray-400 text-sm mt-2">
              点击「新增客户」添加第一家代账客户
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md hover:border-primary-200',
                  company.id === selectedCompanyId &&
                    'ring-2 ring-primary-500 border-primary-300',
                )}
                onClick={() => handleSelectCompany(company.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {company.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {company.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {company.is_active ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeactivateCompany(company.id, company.name)
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-colors"
                          title="停用账套"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleActivateCompany(company.id, company.name)
                          }}
                          className="p-1.5 text-amber-400 hover:text-green-500 rounded-lg hover:bg-green-50 transition-colors"
                          title="启用账套"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCompany(company.id, company.name)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="删除账套（30天可恢复）"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!company.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                        已停用
                      </span>
                    )}
                    {company.tax_id && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        税号: {company.tax_id}
                      </span>
                    )}
                    {company.tax_type && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {taxpayerTypeLabels[company.tax_type as TaxpayerType] || company.tax_type}
                      </span>
                    )}
                    {company.accounting_system && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        {accountingStandardLabels[company.accounting_system] || company.accounting_system}
                      </span>
                    )}
                    {company.province && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                        {company.province}
                        {company.city && ` ${company.city}`}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recycle Bin Modal */}
      {showRecycleBin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                <Archive className="w-5 h-5 inline mr-2" />
                回收站
              </h2>
              <Button variant="outline" size="sm" onClick={() => setShowRecycleBin(false)}>
                关闭
              </Button>
            </div>

            {deletedCompanies.length === 0 ? (
              <div className="text-center py-8">
                <Archive className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">回收站为空</p>
                <p className="text-gray-400 text-sm mt-1">删除的账套将在此保留30天</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deletedCompanies.map((company) => {
                  const deletedDate = company.deleted_at ? new Date(company.deleted_at) : null
                  const expiryDate = deletedDate ? new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null
                  const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 30

                  return (
                    <div key={company.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{company.name}</h4>
                          <p className="text-xs text-gray-500">{company.code}</p>
                          <p className="text-xs text-amber-600 mt-1">
                            {daysLeft > 0 ? `${daysLeft}天后永久删除` : '已过期，待清理'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreCompany(company.id, company.name)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            恢复
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            onClick={() => handlePermanentDelete(company.id, company.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            永久删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-gray-100">
                  <Button variant="outline" size="sm" onClick={handleCleanup}>
                    清理过期账套
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              新增代账客户
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户编码 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newCompany.code}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, code: e.target.value })
                  }
                  placeholder="如: A001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户名称 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newCompany.name}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, name: e.target.value })
                  }
                  placeholder="如: 北京示例科技有限公司"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  纳税人识别号 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newCompany.taxId}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, taxId: e.target.value })
                  }
                  placeholder="统一社会信用代码（18位）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会计制度 <span className="text-red-500">*</span>
                  <span className="text-xs text-amber-600 ml-2">确定后不可更改</span>
                </label>
                <div className="space-y-2">
                  {(Object.keys(accountingSystemLabels) as AccountingSystem[]).map((key) => (
                    <label
                      key={key}
                      className={cn(
                        'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                        newCompany.accountingSystem === key
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="accountingSystem"
                        value={key}
                        checked={newCompany.accountingSystem === key}
                        onChange={() =>
                          setNewCompany({ ...newCompany, accountingSystem: key })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {accountingSystemLabels[key]}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {accountingSystemDescriptions[key]}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  启用期间 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newCompany.enableYear}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, enableYear: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    title="启用年份"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                  <select
                    value={newCompany.enableMonth}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, enableMonth: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    title="启用月份"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  纳税人类型
                </label>
                <select
                  value={newCompany.taxpayerType}
                  onChange={(e) =>
                    setNewCompany({
                      ...newCompany,
                      taxpayerType: e.target.value as TaxpayerType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  title="纳税人类型"
                >
                  {Object.entries(taxpayerTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    省份
                  </label>
                  <select
                    value={newCompany.province}
                    onChange={(e) =>
                      setNewCompany({
                        ...newCompany,
                        province: e.target.value,
                        city: '',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    title="省份"
                  >
                    <option value="">请选择</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    城市
                  </label>
                  <select
                    value={newCompany.city}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={
                      !newCompany.province ||
                      !citiesByProvince[newCompany.province]
                    }
                    title="城市"
                  >
                    <option value="">请选择</option>
                    {newCompany.province &&
                      citiesByProvince[newCompany.province]?.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button onClick={handleCreateCompany}>创建客户</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
