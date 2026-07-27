import { useEffect, useState } from 'react'

const IMPORT_STORAGE_KEY = 'accounting_local_import_jobs_v1'
const ATTACHMENT_STORAGE_KEY = 'accounting_local_attachment_records_v1'
const CHANGE_EVENT = 'accounting-local-file-registry-updated'

export type LocalFileStatus = '待确认' | '已关联' | '已校验' | '已写入' | '异常'

export interface LocalImportJob {
  id: string
  companyId: string
  period: string
  moduleName: string
  operation: string
  fileName: string
  fileSize: number
  fileFormat: string
  checksum: string
  status: LocalFileStatus
  rowCount: number | null
  columnPreview: string[]
  previewRows: string[][]
  validationNote: string
  operator: string
  createdAt: string
}

export interface LocalAttachmentRecord {
  id: string
  companyId: string
  period: string
  sourceModule: string
  fileName: string
  fileSize: number
  fileFormat: string
  checksum: string
  relatedDocument: string
  status: LocalFileStatus
  operator: string
  createdAt: string
}

interface LocalFileScope {
  companyId: string
  period: string
}

function safeStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readRecords<T>(key: string): T[] {
  const storage = safeStorage()
  if (!storage) return []

  try {
    const records = JSON.parse(storage.getItem(key) || '[]')
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function writeRecords<T>(key: string, record: T) {
  const storage = safeStorage()
  if (!storage) return null
  const rows = [record, ...readRecords<T>(key)].slice(0, 100)
  storage.setItem(key, JSON.stringify(rows))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  return record
}

function removeRecord<T extends { id: string }>(key: string, id: string) {
  const storage = safeStorage()
  if (!storage) return false
  const nextRows = readRecords<T>(key).filter((record) => record.id !== id)
  storage.setItem(key, JSON.stringify(nextRows))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  return true
}

function updateRecord<T extends { id: string }>(key: string, id: string, patch: Partial<T>) {
  const storage = safeStorage()
  if (!storage) return null
  let updated: T | null = null
  const nextRows = readRecords<T>(key).map((record) => {
    if (record.id !== id) return record
    updated = { ...record, ...patch }
    return updated
  })
  if (!updated) return null
  storage.setItem(key, JSON.stringify(nextRows))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  return updated
}

function fileFormat(file: File) {
  const extension = file.name.split('.').pop()?.trim().toUpperCase()
  return extension || file.type || '未知格式'
}

function compactImportCell(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').trim()
}

function parseCsvRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean))
}

export async function parseLocalImportFile(file: File) {
  const name = file.name.toLowerCase()
  try {
    const rows = name.endsWith('.xlsx')
      ? (await (await import('read-excel-file/browser')).readSheet(file)).map((row) => row.map(compactImportCell))
      : name.endsWith('.csv')
        ? parseCsvRows(await file.text())
        : []
    if (rows.length === 0) return { headers: [], rows: [], validationNote: '该格式仅登记文件元数据，需在目标模块完成字段映射。' }
    const headerIndex = rows.findIndex((row) => row.filter(Boolean).length >= 3)
    const safeHeaderIndex = headerIndex >= 0 ? headerIndex : 0
    const header = rows[safeHeaderIndex] || []
    const dataRows = rows.slice(safeHeaderIndex + 1).filter((row) => {
      const firstCell = row.find(Boolean) || ''
      return row.filter(Boolean).length >= 2 && !/^(制表说明|边界说明|本页小计|合计)/.test(firstCell)
    })
    return { headers: header.map((cell) => cell.slice(0, 80)), rows: dataRows.map((row) => row.map((cell) => cell.slice(0, 200))), validationNote: `已识别表头并读取 ${dataRows.length} 条候选数据行，尚未写入账套。` }
  } catch {
    return { headers: [], rows: [], validationNote: '无法读取表格结构，需在目标模块完成格式校验。' }
  }
}

async function inspectImportFile(file: File) {
  const parsed = await parseLocalImportFile(file)
  return {
    rowCount: parsed.rows.length || null,
    columnPreview: parsed.headers.filter(Boolean).slice(0, 12).map((cell) => cell.slice(0, 40)),
    previewRows: parsed.rows.slice(0, 5).map((row) => row.slice(0, 12).map((cell) => cell.slice(0, 80))),
    validationNote: parsed.validationNote,
  }
}

function fallbackFingerprint(file: File) {
  let hash = 0x811c9dc5
  for (const value of `${file.name}|${file.size}|${file.lastModified}`) {
    hash ^= value.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `meta-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

async function fileChecksum(file: File) {
  if (!globalThis.crypto?.subtle) return fallbackFingerprint(file)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

function scopedRows<T extends { companyId: string; period: string }>(key: string, scope: LocalFileScope) {
  return readRecords<T>(key).filter((record) => record.companyId === scope.companyId && record.period === scope.period)
}

export function listLocalImportJobs(scope: LocalFileScope) {
  return scopedRows<LocalImportJob>(IMPORT_STORAGE_KEY, scope)
}

export function listLocalAttachmentRecords(scope: LocalFileScope) {
  return scopedRows<LocalAttachmentRecord>(ATTACHMENT_STORAGE_KEY, scope)
}

export async function recordLocalImportJob(input: Omit<LocalImportJob, 'id' | 'fileName' | 'fileSize' | 'fileFormat' | 'checksum' | 'status' | 'rowCount' | 'columnPreview' | 'previewRows' | 'validationNote' | 'createdAt'> & { file: File }) {
  const inspection = await inspectImportFile(input.file)
  const record: LocalImportJob = {
    id: `import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    companyId: input.companyId,
    period: input.period,
    moduleName: input.moduleName,
    operation: input.operation,
    fileName: input.file.name,
    fileSize: input.file.size,
    fileFormat: fileFormat(input.file),
    checksum: await fileChecksum(input.file),
    status: '待确认',
    rowCount: inspection.rowCount,
    columnPreview: inspection.columnPreview,
    previewRows: inspection.previewRows,
    validationNote: inspection.validationNote,
    operator: input.operator,
    createdAt: new Date().toLocaleString('zh-CN'),
  }
  return writeRecords(IMPORT_STORAGE_KEY, record)
}

export async function recordLocalAttachment(input: Omit<LocalAttachmentRecord, 'id' | 'fileName' | 'fileSize' | 'fileFormat' | 'checksum' | 'relatedDocument' | 'status' | 'createdAt'> & { file: File }) {
  const record: LocalAttachmentRecord = {
    id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    companyId: input.companyId,
    period: input.period,
    sourceModule: input.sourceModule,
    fileName: input.file.name,
    fileSize: input.file.size,
    fileFormat: fileFormat(input.file),
    checksum: await fileChecksum(input.file),
    relatedDocument: '待关联单据',
    status: '待确认',
    operator: input.operator,
    createdAt: new Date().toLocaleString('zh-CN'),
  }
  return writeRecords(ATTACHMENT_STORAGE_KEY, record)
}

export function removeLocalImportJob(id: string) {
  return removeRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id)
}

export function updateLocalImportJobValidation(id: string) {
  return updateRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id, {
    status: '已校验',
    validationNote: '已完成人工表头与行数核验；未执行字段映射或写入账套。',
  })
}

export function updateLocalImportJobCommit(id: string, successCount: number, failedCount: number) {
  return updateRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id, {
    status: '已写入',
    validationNote: `已人工确认并写入本地账套：成功 ${successCount} 行，失败 ${failedCount} 行；未调用税局、银行或发票外部系统。`,
  })
}

export function removeLocalAttachment(id: string) {
  return removeRecord<LocalAttachmentRecord>(ATTACHMENT_STORAGE_KEY, id)
}

export function updateLocalAttachmentAssociation(id: string, relatedDocument: string) {
  const normalizedRelatedDocument = relatedDocument.trim()
  if (!normalizedRelatedDocument) return null
  return updateRecord<LocalAttachmentRecord>(ATTACHMENT_STORAGE_KEY, id, {
    relatedDocument: normalizedRelatedDocument,
    status: '已关联',
  })
}

function useScopedRegistryRows<T extends { companyId: string; period: string }>(key: string, scope: LocalFileScope, list: (nextScope: LocalFileScope) => T[]) {
  const [rows, setRows] = useState<T[]>(() => list(scope))

  useEffect(() => {
    const refresh = () => setRows(list(scope))
    refresh()
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [key, list, scope.companyId, scope.period])

  return rows
}

export function useLocalImportJobs(scope: LocalFileScope) {
  return useScopedRegistryRows(IMPORT_STORAGE_KEY, scope, listLocalImportJobs)
}

export function useLocalAttachmentRecords(scope: LocalFileScope) {
  return useScopedRegistryRows(ATTACHMENT_STORAGE_KEY, scope, listLocalAttachmentRecords)
}

export function formatLocalFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
