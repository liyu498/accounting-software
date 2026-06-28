import { useEffect, useState } from 'react'

const STORAGE_KEY = 'accounting_export_jobs_v1'
const CHANGE_EVENT = 'accounting-export-jobs-updated'

export interface ExportJob {
  id: string
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

interface RecordExportJobInput {
  fileName: string
  moduleName: string
  format: string
  scope: string
  templateKind: string
  rowCount: number
  status?: ExportJob['status']
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

export function listExportJobs(): ExportJob[] {
  const storage = safeStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 50) : []
  } catch {
    return []
  }
}

export function recordExportJob(input: RecordExportJobInput) {
  const storage = safeStorage()
  if (!storage) return null

  const createdAt = new Date().toLocaleString('zh-CN')
  const hash = fnv1aHash([input.fileName, input.moduleName, input.format, input.scope, input.templateKind, input.rowCount, createdAt].join('|'))
  const job: ExportJob = {
    id: `exp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    fileName: input.fileName,
    moduleName: input.moduleName,
    format: input.format,
    scope: input.scope,
    hash,
    operator: 'admin',
    createdAt,
    expireAt: input.format === '打印预览' ? '不生成文件' : '7天内可下载',
    status: input.status || '已完成',
    templateKind: input.templateKind,
    rowCount: input.rowCount,
  }

  const jobs = [job, ...listExportJobs()].slice(0, 50)
  storage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: job }))
  return job
}

export function useExportJobs() {
  const [jobs, setJobs] = useState<ExportJob[]>(() => listExportJobs())

  useEffect(() => {
    const refresh = () => setJobs(listExportJobs())
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return jobs
}
