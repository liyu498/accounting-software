import { useEffect, useState } from 'react'
import { currentActorName } from '../stores/authStore'
import { useCompanyStore } from '../stores/companyStore'
import { invoke, isTauri } from './tauri'

const STORAGE_KEY = 'accounting_export_jobs_v1'
const AUDIT_STORAGE_KEY = 'accounting_audit_logs_v1'
const CHANGE_EVENT = 'accounting-export-jobs-updated'
const AUDIT_CHANGE_EVENT = 'accounting-audit-logs-updated'

export interface ExportJob {
  id: string
  scopeKind: 'account' | 'agency'
  companyId: string | null
  fileName: string
  moduleName: string
  format: string
  scope: string
  hash: string
  operator: string
  createdAt: string
  expireAt: string
  status: '已完成' | '待确认' | '异常'
  templateKind: string
  rowCount: number
}

export interface RawExportJob {
  id: string
  scope_kind: 'account' | 'agency'
  company_id: string | null
  file_name: string
  module_name: string
  format: string
  data_scope: string
  fingerprint: string
  operator: string
  status: ExportJob['status']
  template_kind: string
  row_count: number
  expires_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  time: string
  operator: string
  module: string
  action: string
  object: string
  level: '普通' | '中' | '高'
  result: '成功' | '待审批' | '失败'
  terminal: string
  status: '已通过' | '待确认' | '异常'
  voucher: string
  attachment: string
}

interface RecordExportJobInput {
  scopeKind: 'account' | 'agency'
  fileName: string
  moduleName: string
  format: string
  scope: string
  templateKind: string
  rowCount: number
  status?: ExportJob['status']
}

interface RecordAuditLogInput {
  module: string
  action: string
  object: string
  level?: AuditLog['level']
  result?: AuditLog['result']
  status?: AuditLog['status']
  voucher?: string
  attachment?: string
}

function safeStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `h${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function mapRawExportJob(record: RawExportJob): ExportJob {
  return {
    id: record.id,
    scopeKind: record.scope_kind,
    companyId: record.company_id,
    fileName: record.file_name,
    moduleName: record.module_name,
    format: record.format,
    scope: record.data_scope,
    hash: record.fingerprint,
    operator: record.operator,
    createdAt: record.created_at,
    expireAt: record.expires_at || '不生成文件',
    status: record.status,
    templateKind: record.template_kind,
    rowCount: record.row_count,
  }
}

function listExportJobs(scopeKind: ExportJob['scopeKind'], companyId: string | null): ExportJob[] {
  const storage = safeStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as ExportJob[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((job) => job.scopeKind === scopeKind)
      .filter((job) => scopeKind === 'agency' || (Boolean(companyId) && job.companyId === companyId))
      .slice(0, 50)
  } catch {
    return []
  }
}

export function listAuditLogs(): AuditLog[] {
  const storage = safeStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(AUDIT_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 100) : []
  } catch {
    return []
  }
}

function persistAuditLog(storage: Storage, log: AuditLog) {
  const logs = [log, ...listAuditLogs()].slice(0, 100)
  storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs))
  window.dispatchEvent(new CustomEvent(AUDIT_CHANGE_EVENT, { detail: log }))
}

export function recordAuditLog(input: RecordAuditLogInput) {
  const storage = safeStorage()
  if (!storage) return null

  const result = input.result || '成功'
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    time: new Date().toLocaleString('zh-CN'),
    operator: currentActorName(),
    module: input.module,
    action: input.action,
    object: input.object,
    level: input.level || '普通',
    result,
    terminal: 'local-desktop',
    status: input.status || (result === '失败' ? '异常' : result === '待审批' ? '待确认' : '已通过'),
    voucher: input.voucher || '-',
    attachment: input.attachment || '快照',
  }

  persistAuditLog(storage, log)
  return log
}

export async function recordExportJob(input: RecordExportJobInput) {
  const createdAt = new Date().toLocaleString('zh-CN')
  const fingerprint = fnv1aHash([input.fileName, input.moduleName, input.format, input.scope, input.templateKind, input.rowCount, createdAt].join('|'))
  const companyId = input.scopeKind === 'account' ? useCompanyStore.getState().selectedCompanyId : null
  if (input.scopeKind === 'account' && !companyId) {
    throw new Error('登记账套导出任务前必须选择账套')
  }

  if (isTauri) {
    const record = await invoke<RawExportJob>('create_export_job', {
      input: {
        scope_kind: input.scopeKind,
        company_id: companyId,
        file_name: input.fileName,
        module_name: input.moduleName,
        format: input.format,
        data_scope: input.scope,
        fingerprint,
        status: input.status || '已完成',
        template_kind: input.templateKind,
        row_count: input.rowCount,
      },
    })
    const job = mapRawExportJob(record)
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: job }))
    return job
  }

  const storage = safeStorage()
  if (!storage) return null
  const job: ExportJob = {
    id: `exp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    scopeKind: input.scopeKind,
    companyId,
    fileName: input.fileName,
    moduleName: input.moduleName,
    format: input.format,
    scope: input.scope,
    hash: fingerprint,
    operator: currentActorName(),
    createdAt,
    expireAt: input.format === '打印预览' ? '不生成文件' : '7天内可下载',
    status: input.status || '已完成',
    templateKind: input.templateKind,
    rowCount: input.rowCount,
  }

  const allJobs = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as ExportJob[]
  storage.setItem(STORAGE_KEY, JSON.stringify([job, ...(Array.isArray(allJobs) ? allJobs : [])].slice(0, 100)))
  persistAuditLog(storage, {
    id: `audit-${job.id}`,
    time: job.createdAt,
    operator: job.operator,
    module: job.moduleName,
    action: `导出${job.format}`,
    object: job.fileName,
    level: input.templateKind === 'tax' ? '中' : '普通',
    result: job.status === '异常' ? '失败' : job.status === '待确认' ? '待审批' : '成功',
    terminal: 'local-desktop',
    status: job.status === '异常' ? '异常' : job.status === '待确认' ? '待确认' : '已通过',
    voucher: input.scope,
    attachment: job.hash,
  })
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: job }))
  return job
}

export function useExportJobs(scopeKind: ExportJob['scopeKind']) {
  const companyId = useCompanyStore((state) => state.selectedCompanyId)
  const [jobs, setJobs] = useState<ExportJob[]>(() => isTauri ? [] : listExportJobs(scopeKind, companyId))

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      if (isTauri) {
        if (scopeKind === 'account' && !companyId) {
          if (!cancelled) setJobs([])
          return
        }
        try {
          const records = await invoke<RawExportJob[]>('get_export_jobs', {
            scopeKind,
            companyId: scopeKind === 'account' ? companyId : null,
          })
          if (!cancelled) setJobs(records.map(mapRawExportJob))
        } catch {
          if (!cancelled) setJobs([])
        }
        return
      }
      if (!cancelled) setJobs(listExportJobs(scopeKind, companyId))
    }
    const handleChange = () => void refresh()
    void refresh()
    window.addEventListener(CHANGE_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      cancelled = true
      window.removeEventListener(CHANGE_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [companyId, scopeKind])

  return jobs
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>(() => listAuditLogs())

  useEffect(() => {
    const refresh = () => setLogs(listAuditLogs())
    window.addEventListener(AUDIT_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(AUDIT_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return logs
}
