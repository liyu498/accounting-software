import { BookOpenCheck, Building2, CalendarDays, CheckCircle2, CircleAlert, FilePenLine, Landmark, MapPin, RefreshCw, Save, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChinaRegionSelect } from '../../components/forms/ChinaRegionSelect'
import { accountingSystemLabels } from '../../lib/constants'
import { buildEnableYearOptions, enterpriseTypeOptions, industryOptions, isValidChinaRegion, isValidEnableYear, withCurrentReferenceOption } from '../../lib/companyReferenceData.js'
import { isTauri } from '../../lib/tauri'
import { useCompanyStore, type Company } from '../../stores/companyStore'

type CompanyDraft = {
  code: string
  name: string
  taxId: string
  taxpayerType: string
  province: string
  city: string
  district: string
  accountingSystem: string
  enableYear: string
  enableMonth: string
  serviceStart: string
  serviceEnd: string
  industry: string
  enterpriseType: string
}

const previewStorageKey = 'accounting-preview-company-info-v1'
const taxpayerTypes = [{ value: 'general', label: '一般纳税人' }, { value: 'small', label: '小规模纳税人' }]
const accountingSystems = Object.entries(accountingSystemLabels).map(([value, label]) => ({ value, label }))

function emptyDraft(): CompanyDraft {
  const now = new Date()
  return { code: '', name: '', taxId: '', taxpayerType: 'general', province: '', city: '', district: '', accountingSystem: 'small_enterprise', enableYear: String(now.getFullYear()), enableMonth: String(now.getMonth() + 1), serviceStart: '', serviceEnd: '', industry: '', enterpriseType: '私营有限责任公司' }
}

function isDraft(value: unknown): value is CompanyDraft {
  const company = value as Partial<CompanyDraft>
  return Boolean(company && typeof company.code === 'string' && typeof company.name === 'string' && typeof company.taxId === 'string' && typeof company.taxpayerType === 'string' && typeof company.accountingSystem === 'string')
}

function loadPreview(): CompanyDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.localStorage.getItem(previewStorageKey) || 'null')
    return isDraft(value) ? { ...emptyDraft(), ...value } : null
  } catch {
    return null
  }
}

function savePreview(draft: CompanyDraft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewStorageKey, JSON.stringify(draft))
  } catch {
    // The current browser preview remains editable when local storage is unavailable.
  }
}

function draftFromCompany(company: Company): CompanyDraft {
  return {
    code: company.code,
    name: company.name,
    taxId: company.tax_id || '',
    taxpayerType: company.tax_type || 'general',
    province: company.province || '',
    city: company.city || '',
    district: company.district || '',
    accountingSystem: company.accounting_system || 'small_enterprise',
    enableYear: String(company.enable_year || new Date().getFullYear()),
    enableMonth: String(company.enable_month || new Date().getMonth() + 1),
    serviceStart: company.service_start || '',
    serviceEnd: company.service_end || '',
    industry: company.industry || '',
    enterpriseType: company.enterprise_type || '私营有限责任公司',
  }
}

function labelFor(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label || value || '待设置'
}

export function CompanyInfoWorkspace() {
  const navigate = useNavigate()
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId)
  const companies = useCompanyStore((state) => state.companies)
  const loading = useCompanyStore((state) => state.isLoading)
  const storeError = useCompanyStore((state) => state.error)
  const fetchCompanies = useCompanyStore((state) => state.fetchCompanies)
  const updateCompany = useCompanyStore((state) => state.updateCompany)
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId)
  const [previewCompany, setPreviewCompany] = useState<CompanyDraft | null>(() => loadPreview())
  const [draft, setDraft] = useState<CompanyDraft>(() => selectedCompany ? draftFromCompany(selectedCompany) : loadPreview() || emptyDraft())
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauri) {
      const preview = loadPreview()
      setPreviewCompany(preview)
      if (!selectedCompany) setDraft(preview || emptyDraft())
      return
    }
    await fetchCompanies()
  }, [fetchCompanies, selectedCompany])

  useEffect(() => {
    if (selectedCompany) setDraft(draftFromCompany(selectedCompany))
    else if (!isTauri) setDraft(previewCompany || emptyDraft())
  }, [previewCompany, selectedCompany])

  const currentDraft = selectedCompany ? draftFromCompany(selectedCompany) : previewCompany
  const completion = useMemo(() => {
    const profile = currentDraft || emptyDraft()
    const fields = [profile.code, profile.name, profile.taxId, profile.taxpayerType, profile.accountingSystem, profile.enableYear, profile.enableMonth]
    return fields.filter(Boolean).length
  }, [currentDraft])
  const activeProfile = currentDraft || draft
  const location = [activeProfile.province, activeProfile.city, activeProfile.district].filter(Boolean).join(' ') || '待补地区'
  const metrics = [
    { icon: CheckCircle2, label: '基础资料', value: `${completion}/7`, tone: completion === 7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
    { icon: CalendarDays, label: '启用账期', value: `${activeProfile.enableYear || '----'}-${String(activeProfile.enableMonth || '').padStart(2, '0') || '--'}` },
    { icon: ShieldCheck, label: '纳税人类型', value: labelFor(taxpayerTypes, activeProfile.taxpayerType), tone: 'text-sky-700 dark:text-sky-300' },
    { icon: BookOpenCheck, label: '会计制度', value: labelFor(accountingSystems, activeProfile.accountingSystem) },
  ]

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.code.trim() || !draft.name.trim() || !draft.taxId.trim()) {
      setNotice('请填写企业编码、企业名称和纳税人识别号。')
      return
    }
    if (!draft.province.trim() || !draft.city.trim() || (!draft.district.trim() && draft.province !== '台湾省')) {
      setNotice('请选择完整的省、市、区县。')
      return
    }
    if (!isValidChinaRegion(draft)) {
      setNotice('省、市、区县组合不正确，请重新选择。')
      return
    }
    const enableYear = Number(draft.enableYear)
    const enableMonth = Number(draft.enableMonth)
    if (!isValidEnableYear(enableYear) || !Number.isInteger(enableMonth) || enableMonth < 1 || enableMonth > 12) {
      setNotice('请填写有效的启用年份和月份。')
      return
    }
    const input = { code: draft.code.trim(), name: draft.name.trim(), tax_id: draft.taxId.trim(), tax_type: draft.taxpayerType, industry: draft.industry.trim() || undefined, accounting_system: draft.accountingSystem, province: draft.province.trim() || undefined, city: draft.city.trim() || undefined, district: draft.district.trim() || undefined, enterprise_type: draft.enterpriseType.trim() || undefined, service_start: draft.serviceStart || undefined, service_end: draft.serviceEnd || undefined, enable_year: enableYear, enable_month: enableMonth }
    setSaving(true)
    try {
      if (isTauri) {
        if (!selectedCompanyId) {
          setNotice('请先选择账套，再维护企业资料。')
          return
        }
        await updateCompany(selectedCompanyId, input)
      } else {
        const saved = { ...draft, enableYear: String(enableYear), enableMonth: String(enableMonth) }
        setPreviewCompany(saved)
        savePreview(saved)
      }
      setEditing(false)
      setNotice(isTauri ? '企业资料已保存。税务授权、银行账户和业务档案仍在各自模块维护。' : '浏览器预览资料已保存到本地。桌面端保存会写入当前账套。')
    } catch (error) {
      setNotice(`保存企业资料失败：${String(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setDraft(selectedCompany ? draftFromCompany(selectedCompany) : previewCompany || emptyDraft())
    setEditing(true)
  }

  const details = [
    { icon: Building2, label: '企业编码', value: activeProfile.code || '待补企业编码' },
    { icon: Landmark, label: '纳税人识别号', value: activeProfile.taxId || '待补纳税人识别号' },
    { icon: MapPin, label: '注册地区', value: location },
    { icon: Building2, label: '企业类型', value: activeProfile.enterpriseType || '待设置企业类型' },
    { icon: BookOpenCheck, label: '所属行业', value: activeProfile.industry || '待设置所属行业' },
    { icon: CalendarDays, label: '服务期间', value: activeProfile.serviceStart || activeProfile.serviceEnd ? `${activeProfile.serviceStart || '未设置'} 至 ${activeProfile.serviceEnd || '未设置'}` : '未设置服务期间' },
  ]

  return <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100"><section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"><header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h1 className="text-base font-semibold">企业资料</h1></div><p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">维护账套主体、纳税人类型、会计制度、所属地区、服务期间与启用账期等基础资料。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void refresh()} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />刷新</button><button type="button" onClick={startEditing} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"><FilePenLine className="h-3.5 w-3.5" />编辑资料</button></div></header><div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100"><p className="font-medium">资料范围</p><p className="mt-1">本页仅维护账套基础资料。不会保存税局、个税或工商密码，也不会发起工商、银行或税局外部请求。</p></div><p className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">联系人与业务档案请在客户、供应商、人员等模块维护；银行账户请在账户登记维护；税局授权请在接口配置维护。</p></div><div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">{metrics.map((item) => <Metric key={item.label} icon={item.icon} label={item.label} value={item.value} tone={item.tone} />)}</div>{notice && <Notice value={notice} />}{isTauri && storeError && <Notice value={`企业资料读取提示：${storeError}`} />}{isTauri && !selectedCompanyId && <EmptyState message="请选择账套后查看或维护企业资料。" />}{(!isTauri || selectedCompanyId) && loading && <EmptyState message="正在读取企业资料..." />}{(!isTauri || selectedCompanyId) && !loading && <><section className="p-4"><div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-semibold">账套主体</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{activeProfile.name || '尚未维护企业主体资料'}</p></div><span className="inline-flex w-fit border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">{selectedCompany?.is_active === 0 ? '已停用' : '当前可用'}</span></div><div className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2 xl:grid-cols-3">{details.map((item) => <Detail key={item.label} icon={item.icon} label={item.label} value={item.value} />)}</div></section><section className="border-t border-slate-200 p-4 dark:border-slate-800"><h2 className="text-sm font-semibold">资料关联</h2><div className="mt-3 grid gap-3 lg:grid-cols-3"><QuickLink icon={Landmark} title="账户登记" description="维护开户行、账户用途和期初余额，避免把账户资料混入主体信息。" onClick={() => navigate('/settings/accounts')} /><QuickLink icon={CalendarDays} title="结账管理" description="查看启用期后的会计期间、结账状态和重新开放控制。" onClick={() => navigate('/settings/period-management')} /><QuickLink icon={ShieldCheck} title="税局接口配置" description="按渠道维护授权状态和授权范围，不在企业资料页存放敏感凭据。" onClick={() => navigate('/settings/tax-adapters')} /></div></section></>}</section>{editing && <CompanyEditor draft={draft} saving={saving} onChange={setDraft} onClose={() => setEditing(false)} onSubmit={save} />}</main>
}

function CompanyEditor({ draft, saving, onChange, onClose, onSubmit }: { draft: CompanyDraft; saving: boolean; onChange: (draft: CompanyDraft | ((current: CompanyDraft) => CompanyDraft)) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const inputClass = 'h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#1f65a7] dark:border-slate-700 dark:bg-[#0d1423] dark:text-slate-100 dark:focus:border-sky-500'
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="编辑企业资料"><form onSubmit={onSubmit} className="max-h-full w-full overflow-y-auto border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827] sm:max-w-3xl"><header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 className="text-base font-semibold">编辑企业资料</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">保存后会更新当前账套基础资料；不会保存税局、个税或工商密码。</p></header><div className="grid gap-3 p-4 sm:grid-cols-2"><Field label="企业编码 *"><input required value={draft.code} onChange={(event) => onChange((current) => ({ ...current, code: event.target.value }))} placeholder="如：COMP-001" className={inputClass} /></Field><Field label="企业名称 *"><input required value={draft.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} placeholder="请输入企业名称" className={inputClass} /></Field><Field label="纳税人识别号 *"><input required value={draft.taxId} onChange={(event) => onChange((current) => ({ ...current, taxId: event.target.value }))} placeholder="请输入纳税人识别号" className={inputClass} /></Field><Field label="纳税人类型"><select value={draft.taxpayerType} onChange={(event) => onChange((current) => ({ ...current, taxpayerType: event.target.value }))} className={inputClass}>{taxpayerTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="会计制度"><select value={draft.accountingSystem} onChange={(event) => onChange((current) => ({ ...current, accountingSystem: event.target.value }))} className={inputClass}>{accountingSystems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="所属行业"><select value={draft.industry} onChange={(event) => onChange((current) => ({ ...current, industry: event.target.value }))} className={inputClass}><option value="">请选择行业</option>{withCurrentReferenceOption(industryOptions, draft.industry).map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><div className="sm:col-span-2"><Field label="注册地区 *"><ChinaRegionSelect required value={draft} onChange={(region) => onChange((current) => ({ ...current, ...region }))} className={inputClass} /></Field></div><Field label="企业类型"><select value={draft.enterpriseType} onChange={(event) => onChange((current) => ({ ...current, enterpriseType: event.target.value }))} className={inputClass}>{withCurrentReferenceOption(enterpriseTypeOptions, draft.enterpriseType).map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><Field label="启用期 *"><div className="grid grid-cols-2 gap-2"><select required value={draft.enableYear} onChange={(event) => onChange((current) => ({ ...current, enableYear: event.target.value }))} className={inputClass}>{buildEnableYearOptions(new Date().getFullYear(), draft.enableYear).map((option) => <option key={option} value={option}>{option}年</option>)}</select><select required value={draft.enableMonth} onChange={(event) => onChange((current) => ({ ...current, enableMonth: event.target.value }))} className={inputClass}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((option) => <option key={option} value={option}>{option}月</option>)}</select></div></Field><Field label="服务开始"><input type="date" value={draft.serviceStart} onChange={(event) => onChange((current) => ({ ...current, serviceStart: event.target.value }))} className={inputClass} /></Field><Field label="服务结束"><input type="date" value={draft.serviceEnd} onChange={(event) => onChange((current) => ({ ...current, serviceEnd: event.target.value }))} className={inputClass} /></Field></div><footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><button type="button" onClick={onClose} className="h-8 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">取消</button><button type="submit" disabled={saving} className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? '正在保存' : '保存资料'}</button></footer></form></div>
}

function Metric({ icon: Icon, label, value, tone = 'text-slate-900 dark:text-slate-100' }: { icon: LucideIcon; label: string; value: string; tone?: string }) { return <div className="px-4 py-3"><div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className={`mt-1 truncate text-lg font-semibold ${tone}`} title={value}>{value}</p></div> }
function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <div className="min-w-0"><div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-1 break-words text-sm text-slate-900 dark:text-slate-100">{value}</p></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1 text-xs text-slate-600 dark:text-slate-300"><span>{label}</span>{children}</label> }
function Notice({ value }: { value: string }) { return <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">{value}</div> }
function EmptyState({ message }: { message: string }) { return <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div> }
function QuickLink({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"><Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" /><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p></button> }
