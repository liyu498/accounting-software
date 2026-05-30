import { useState, useEffect } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import {
  Building2,
  User,
  FileText,
  Save,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import { useCompanyStore } from '../../stores/companyStore'
import { taxpayerTypeLabels, accountingStandardLabels, provinces, citiesByProvince } from '../../lib/constants'

const industryOptions = [
  '制造业', '批发和零售业', '交通运输、仓储和邮政业', '住宿和餐饮业',
  '信息传输、软件和信息技术服务业', '金融服务', '房地产业', '租赁和商务服务业',
  '科学研究和技术服务业', '水利、环境和公共设施管理业', '居民服务、修理和其他服务业',
  '教育', '卫生和社会工作', '文化、体育和娱乐业', '公共管理、社会保障和社会组织',
  '农、林、牧、渔业', '建筑业', '其他'
]

export function CompanyInfo() {
  const { addToast } = useToast()
  const { selectedCompanyId, getCompanyById, updateCompany } = useCompanyStore()
  const currentCompany = selectedCompanyId ? getCompanyById(selectedCompanyId) : null

  const [formData, setFormData] = useState({
    name: currentCompany?.name || '',
    industry: currentCompany?.industry || '',
    province: currentCompany?.province || '',
    city: currentCompany?.city || '',
    address: '',
    taxpayerType: currentCompany?.tax_type || 'small',
    accountingStandard: currentCompany?.accounting_system || 'small',
    enableYear: currentCompany?.enable_year || new Date().getFullYear(),
    enableMonth: currentCompany?.enable_month || new Date().getMonth() + 1,
    creditRating: '',
    registeredCapital: '',
    paidInCapital: '',
    taxNumber: '',
    bankName: currentCompany?.bank_name || '',
    bankAccount: currentCompany?.bank_account || '',
    legalRepresentative: '',
    financeContact: '',
    financePhone: '',
    financeEmail: '',
  })

  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (currentCompany) {
      setFormData({
        name: currentCompany.name,
        industry: currentCompany.industry || '',
        province: currentCompany.province || '',
        city: currentCompany.city || '',
        address: '',
        taxpayerType: currentCompany.tax_type || 'small',
        accountingStandard: currentCompany.accounting_system || 'small',
        enableYear: currentCompany.enable_year || new Date().getFullYear(),
        enableMonth: currentCompany.enable_month || new Date().getMonth() + 1,
        creditRating: '',
        registeredCapital: '',
        paidInCapital: '',
        taxNumber: '',
        bankName: currentCompany.bank_name || '',
        bankAccount: currentCompany.bank_account || '',
        legalRepresentative: '',
        financeContact: '',
        financePhone: '',
        financeEmail: '',
      })
      setIsEditing(false)
    }
  }, [currentCompany])

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedCompanyId) {
      addToast('请先选择客户账套', 'error')
      return
    }
    try {
      await updateCompany(selectedCompanyId, {
        code: currentCompany?.code || '',
        name: formData.name,
        tax_type: formData.taxpayerType,
        accounting_system: formData.accountingStandard,
        province: formData.province || undefined,
        city: formData.city || undefined,
        enable_year: Number(formData.enableYear),
        enable_month: Number(formData.enableMonth),
      })
      addToast('保存成功', 'success')
      setIsEditing(false)
    } catch (error) {
      addToast(`保存失败: ${error}`, 'error')
    }
  }

  const handleCancel = () => {
    if (currentCompany) {
      setFormData({
        name: currentCompany.name,
        industry: currentCompany.industry || '',
        province: currentCompany.province || '',
        city: currentCompany.city || '',
        address: '',
        taxpayerType: currentCompany.tax_type || 'small',
        accountingStandard: currentCompany.accounting_system || 'small',
        enableYear: currentCompany.enable_year || new Date().getFullYear(),
        enableMonth: currentCompany.enable_month || new Date().getMonth() + 1,
        creditRating: '',
        registeredCapital: '',
        paidInCapital: '',
        taxNumber: '',
        bankName: currentCompany.bank_name || '',
        bankAccount: currentCompany.bank_account || '',
        legalRepresentative: '',
        financeContact: '',
        financePhone: '',
        financeEmail: '',
      })
    }
    setIsEditing(false)
  }

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请先在首页选择客户账套</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">公司信息</h1>
          <p className="text-gray-500 mt-1">编辑当前账套的公司基本信息</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button variant="primary" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              <FileText className="w-4 h-4 mr-2" />
              编辑信息
            </Button>
          )}
        </div>
      </div>

      {/* 当前账套信息 */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary-600" />
            <div>
              <p className="text-sm text-primary-600 font-medium">当前账套</p>
              <p className="text-lg font-bold text-gray-900">{currentCompany.name}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-gray-500">
                {accountingStandardLabels[currentCompany.accounting_system || 'small']}
              </p>
              <p className="text-sm text-gray-500">
                {taxpayerTypeLabels[currentCompany.tax_type as keyof typeof taxpayerTypeLabels] || currentCompany.tax_type}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            登记信息
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">企业名称</label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="请输入企业名称"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">国标行业</label>
              {isEditing ? (
                <select
                  value={formData.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="国标行业"
                >
                  <option value="">请选择行业</option>
                  {industryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{formData.industry || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">省份</label>
              {isEditing ? (
                <select
                  value={formData.province}
                  onChange={(e) => handleChange('province', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="省份"
                >
                  <option value="">请选择省份</option>
                  {provinces.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{formData.province || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              {isEditing ? (
                <select
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="城市"
                  disabled={!formData.province || !citiesByProvince[formData.province]}
                >
                  <option value="">请选择城市</option>
                  {formData.province && citiesByProvince[formData.province]?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{formData.city || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">纳税人资格</label>
              {isEditing ? (
                <select
                  value={formData.taxpayerType}
                  onChange={(e) => handleChange('taxpayerType', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="纳税人资格"
                >
                  <option value="small">小规模纳税人</option>
                  <option value="general">一般纳税人</option>
                </select>
              ) : (
                <p className="text-gray-900 py-2">{taxpayerTypeLabels[formData.taxpayerType as keyof typeof taxpayerTypeLabels] || formData.taxpayerType}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">会计准则</label>
              {isEditing ? (
                <select
                  value={formData.accountingStandard}
                  onChange={(e) => handleChange('accountingStandard', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="会计准则"
                >
                  {Object.entries(accountingStandardLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{accountingStandardLabels[formData.accountingStandard] || formData.accountingStandard}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开户银行</label>
              {isEditing ? (
                <Input
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="请输入开户银行"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.bankName || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">银行账号</label>
              {isEditing ? (
                <Input
                  value={formData.bankAccount}
                  onChange={(e) => handleChange('bankAccount', e.target.value)}
                  placeholder="请输入银行账号"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.bankAccount || '-'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 人员信息 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            人员信息
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">法定代表人</label>
              {isEditing ? (
                <Input
                  value={formData.legalRepresentative}
                  onChange={(e) => handleChange('legalRepresentative', e.target.value)}
                  placeholder="请输入法定代表人"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.legalRepresentative || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">财务联系人</label>
              {isEditing ? (
                <Input
                  value={formData.financeContact}
                  onChange={(e) => handleChange('financeContact', e.target.value)}
                  placeholder="请输入财务联系人"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.financeContact || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">财务联系电话</label>
              {isEditing ? (
                <Input
                  value={formData.financePhone}
                  onChange={(e) => handleChange('financePhone', e.target.value)}
                  placeholder="请输入联系电话"
                />
              ) : (
                <p className="text-gray-900 py-2">{formData.financePhone || '-'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 启用期间 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            启用期间
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">启用年份</label>
              {isEditing ? (
                <select
                  value={formData.enableYear}
                  onChange={(e) => handleChange('enableYear', parseInt(e.target.value, 10))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="启用年份"
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{formData.enableYear}年</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">启用月份</label>
              {isEditing ? (
                <select
                  value={formData.enableMonth}
                  onChange={(e) => handleChange('enableMonth', parseInt(e.target.value, 10))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="启用月份"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}月</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{String(formData.enableMonth).padStart(2, '0')}月</p>
              )}
            </div>
          </div>
          {!isEditing && (
            <p className="text-xs text-gray-400 mt-3">
              启用期间即账套的起始会计期间，修改后需重新初始化期初数据。点击"编辑信息"可修改。
            </p>
          )}
        </CardContent>
      </Card>

      {/* 税务信息提示 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">自动采集功能</p>
              <p className="text-sm text-blue-700 mt-1">
                系统支持对接税务系统，自动采集企业基本信息和税务信息。如需开通，请联系管理员配置税务系统接口。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
