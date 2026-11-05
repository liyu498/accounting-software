import { useEffect, useState } from 'react'
import { assertLocalFileWithinLimit, MAX_LOCAL_ATTACHMENT_FILE_BYTES, MAX_STRUCTURED_IMPORT_FILE_BYTES } from './fileLimits'
import { cloneVoucherAttachmentAssociations, filterVoucherAttachments } from './voucherAttachmentWorkflow.js'
import { currentActorName } from '../stores/authStore'
import { invoke, isTauri } from './tauri'

const IMPORT_STORAGE_KEY = 'accounting_local_import_jobs_v1'
const ATTACHMENT_STORAGE_KEY = 'accounting_local_attachment_records_v1'
const CHANGE_EVENT = 'accounting-local-file-registry-updated'

export type LocalFileStatus = '待确认' | '已关联' | '已校验' | '已写入' | '异常'

export interface LocalImportFailure {
  rowNumber: number
  message: string
}

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
  writtenRowCount?: number
  failedRowCount?: number
  failureRows?: LocalImportFailure[]
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

export interface RawLocalFileRecord {
  id: string
  record_kind: 'import' | 'attachment'
  company_id: string
  period: string
  module_name: string
  operation: string | null
  file_name: string
  file_size: number
  file_format: string
  checksum: string
  status: LocalFileStatus
  row_count: number | null
  column_preview: string | null
  preview_rows: string | null
  validation_note: string | null
  written_row_count: number | null
  failed_row_count: number | null
  failure_rows: string | null
  related_document: string | null
  operator: string
  created_at: string
  updated_at: string
}

function parseJsonValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapImportRecord(record: RawLocalFileRecord): LocalImportJob {
  return {
    id: record.id,
    companyId: record.company_id,
    period: record.period,
    moduleName: record.module_name,
    operation: record.operation || '导入批次登记',
    fileName: record.file_name,
    fileSize: record.file_size,
    fileFormat: record.file_format,
    checksum: record.checksum,
    status: record.status,
    rowCount: record.row_count,
    columnPreview: parseJsonValue<string[]>(record.column_preview, []),
    previewRows: parseJsonValue<string[][]>(record.preview_rows, []),
    validationNote: record.validation_note || '等待人工校验。',
    writtenRowCount: record.written_row_count ?? undefined,
    failedRowCount: record.failed_row_count ?? undefined,
    failureRows: parseJsonValue<LocalImportFailure[]>(record.failure_rows, []),
    operator: record.operator,
    createdAt: record.created_at,
  }
}

function mapAttachmentRecord(record: RawLocalFileRecord): LocalAttachmentRecord {
  return {
    id: record.id,
    companyId: record.company_id,
    period: record.period,
    sourceModule: record.module_name,
    fileName: record.file_name,
    fileSize: record.file_size,
    fileFormat: record.file_format,
    checksum: record.checksum,
    relatedDocument: record.related_document || '待关联单据',
    status: record.status,
    operator: record.operator,
    createdAt: record.created_at,
  }
}

function emitRegistryChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

async function loadDesktopRecords(scope: LocalFileScope, recordKind: 'import' | 'attachment') {
  return invoke<RawLocalFileRecord[]>('get_local_file_records', {
    companyId: scope.companyId,
    period: scope.period,
    recordKind,
  })
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
  assertLocalFileWithinLimit(file, MAX_STRUCTURED_IMPORT_FILE_BYTES, '导入文件')
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

export function listLocalVoucherAttachments(scope: LocalFileScope, voucherId: string) {
  return filterVoucherAttachments(listLocalAttachmentRecords(scope), voucherId) as LocalAttachmentRecord[]
}

export async function recordLocalImportJob(input: Omit<LocalImportJob, 'id' | 'fileName' | 'fileSize' | 'fileFormat' | 'checksum' | 'status' | 'rowCount' | 'columnPreview' | 'previewRows' | 'validationNote' | 'operator' | 'createdAt'> & { file: File }) {
  assertLocalFileWithinLimit(input.file, MAX_STRUCTURED_IMPORT_FILE_BYTES, '导入文件')
  const inspection = await inspectImportFile(input.file)
  const checksum = await fileChecksum(input.file)
  if (isTauri) {
    const record = await invoke<RawLocalFileRecord>('create_local_file_record', {
      input: {
        record_kind: 'import',
        company_id: input.companyId,
        period: input.period,
        module_name: input.moduleName,
        operation: input.operation,
        file_name: input.file.name,
        file_size: input.file.size,
        file_format: fileFormat(input.file),
        checksum,
        status: '待确认',
        row_count: inspection.rowCount,
        column_preview: JSON.stringify(inspection.columnPreview),
        preview_rows: JSON.stringify(inspection.previewRows),
        validation_note: inspection.validationNote,
      },
    })
    emitRegistryChange()
    return mapImportRecord(record)
  }
  const record: LocalImportJob = {
    id: `import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    companyId: input.companyId,
    period: input.period,
    moduleName: input.moduleName,
    operation: input.operation,
    fileName: input.file.name,
    fileSize: input.file.size,
    fileFormat: fileFormat(input.file),
    checksum,
    status: '待确认',
    rowCount: inspection.rowCount,
    columnPreview: inspection.columnPreview,
    previewRows: inspection.previewRows,
    validationNote: inspection.validationNote,
    operator: currentActorName(),
    createdAt: new Date().toLocaleString('zh-CN'),
  }
  return writeRecords(IMPORT_STORAGE_KEY, record)
}

export async function recordLocalAttachment(input: Omit<LocalAttachmentRecord, 'id' | 'fileName' | 'fileSize' | 'fileFormat' | 'checksum' | 'relatedDocument' | 'status' | 'operator' | 'createdAt'> & { file: File }) {
  assertLocalFileWithinLimit(input.file, MAX_LOCAL_ATTACHMENT_FILE_BYTES, '附件')
  const checksum = await fileChecksum(input.file)
  if (isTauri) {
    const record = await invoke<RawLocalFileRecord>('create_local_file_record', {
      input: {
        record_kind: 'attachment',
        company_id: input.companyId,
        period: input.period,
        module_name: input.sourceModule,
        operation: '附件登记',
        file_name: input.file.name,
        file_size: input.file.size,
        file_format: fileFormat(input.file),
        checksum,
        status: '待确认',
        related_document: '待关联单据',
      },
    })
    emitRegistryChange()
    return mapAttachmentRecord(record)
  }
  const record: LocalAttachmentRecord = {
    id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    companyId: input.companyId,
    period: input.period,
    sourceModule: input.sourceModule,
    fileName: input.file.name,
    fileSize: input.file.size,
    fileFormat: fileFormat(input.file),
    checksum,
    relatedDocument: '待关联单据',
    status: '待确认',
    operator: currentActorName(),
    createdAt: new Date().toLocaleString('zh-CN'),
  }
  return writeRecords(ATTACHMENT_STORAGE_KEY, record)
}

export async function removeLocalImportJob(id: string, companyId: string) {
  if (isTauri) {
    const removed = await invoke<boolean>('delete_local_file_record', {
      input: { id, company_id: companyId },
    })
    emitRegistryChange()
    return removed
  }
  return removeRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id)
}

export async function updateLocalImportJobValidation(id: string, companyId: string) {
  const validationNote = '已完成人工表头与行数核验；未执行字段映射或写入账套。'
  if (isTauri) {
    const record = await invoke<RawLocalFileRecord>('update_local_file_record', {
      input: {
        id,
        company_id: companyId,
        status: '已校验',
        validation_note: validationNote,
      },
    })
    emitRegistryChange()
    return mapImportRecord(record)
  }
  return updateRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id, {
    status: '已校验',
    validationNote,
  })
}

export async function updateLocalImportJobCommit(id: string, companyId: string, successCount: number, failedCount: number, failureRows: LocalImportFailure[] = []) {
  const validationNote = `已人工确认并写入本地账套：成功 ${successCount} 行，失败 ${failedCount} 行；未调用税局、银行或发票外部系统。`
  if (isTauri) {
    const record = await invoke<RawLocalFileRecord>('update_local_file_record', {
      input: {
        id,
        company_id: companyId,
        status: '已写入',
        validation_note: validationNote,
        written_row_count: successCount,
        failed_row_count: failedCount,
        failure_rows: JSON.stringify(failureRows.slice(0, 20)),
      },
    })
    emitRegistryChange()
    return mapImportRecord(record)
  }
  return updateRecord<LocalImportJob>(IMPORT_STORAGE_KEY, id, {
    status: '已写入',
    writtenRowCount: successCount,
    failedRowCount: failedCount,
    failureRows: failureRows.slice(0, 20),
    validationNote,
  })
}

export async function removeLocalAttachment(id: string, companyId: string) {
  if (isTauri) {
    const removed = await invoke<boolean>('delete_local_file_record', {
      input: { id, company_id: companyId },
    })
    emitRegistryChange()
    return removed
  }
  return removeRecord<LocalAttachmentRecord>(ATTACHMENT_STORAGE_KEY, id)
}

export async function updateLocalAttachmentAssociation(id: string, relatedDocument: string, companyId: string) {
  const normalizedRelatedDocument = relatedDocument.trim()
  if (!normalizedRelatedDocument) return null
  if (isTauri) {
    const record = await invoke<RawLocalFileRecord>('update_local_file_record', {
      input: {
        id,
        company_id: companyId,
        status: '已关联',
        related_document: normalizedRelatedDocument,
      },
    })
    emitRegistryChange()
    return mapAttachmentRecord(record)
  }
  return updateRecord<LocalAttachmentRecord>(ATTACHMENT_STORAGE_KEY, id, {
    relatedDocument: normalizedRelatedDocument,
    status: '已关联',
  })
}

export async function copyLocalVoucherAttachmentAssociations(scope: LocalFileScope, sourceVoucherId: string, targetVoucherId: string) {
  if (isTauri) {
    const records = await invoke<RawLocalFileRecord[]>('copy_local_voucher_attachments', {
      input: {
        company_id: scope.companyId,
        period: scope.period,
        source_document: sourceVoucherId,
        target_document: targetVoucherId,
      },
    })
    emitRegistryChange()
    return records.map(mapAttachmentRecord)
  }
  const copies = cloneVoucherAttachmentAssociations({
    records: listLocalAttachmentRecords(scope),
    sourceVoucherId,
    targetVoucherId,
  }) as LocalAttachmentRecord[]
  return copies.map((record) => writeRecords(ATTACHMENT_STORAGE_KEY, record)).filter((record): record is LocalAttachmentRecord => Boolean(record))
}

function useScopedRegistryRows<T extends { companyId: string; period: string }>(
  key: string,
  scope: LocalFileScope,
  recordKind: 'import' | 'attachment',
  list: (nextScope: LocalFileScope) => T[],
  mapRecord: (record: RawLocalFileRecord) => T,
) {
  const [rows, setRows] = useState<T[]>(() => list(scope))

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const nextRows = isTauri
          ? (await loadDesktopRecords(scope, recordKind)).map(mapRecord)
          : list(scope)
        if (active) setRows(nextRows)
      } catch {
        if (active) setRows([])
      }
    }
    const handleRefresh = () => void refresh()
    void refresh()
    window.addEventListener(CHANGE_EVENT, handleRefresh)
    window.addEventListener('storage', handleRefresh)
    return () => {
      active = false
      window.removeEventListener(CHANGE_EVENT, handleRefresh)
      window.removeEventListener('storage', handleRefresh)
    }
  }, [key, list, mapRecord, recordKind, scope.companyId, scope.period])

  return rows
}

export function useLocalImportJobs(scope: LocalFileScope) {
  return useScopedRegistryRows(IMPORT_STORAGE_KEY, scope, 'import', listLocalImportJobs, mapImportRecord)
}

export function useLocalAttachmentRecords(scope: LocalFileScope) {
  return useScopedRegistryRows(ATTACHMENT_STORAGE_KEY, scope, 'attachment', listLocalAttachmentRecords, mapAttachmentRecord)
}

export function formatLocalFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
