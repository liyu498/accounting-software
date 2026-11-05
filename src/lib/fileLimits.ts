export const MAX_STRUCTURED_IMPORT_FILE_BYTES = 25 * 1024 * 1024
export const MAX_LOCAL_ATTACHMENT_FILE_BYTES = 100 * 1024 * 1024

export function assertLocalFileWithinLimit(file: File, maxBytes: number, label: string) {
  if (file.size <= 0) throw new Error(`${label}不能为空文件`)
  if (file.size > maxBytes) {
    const maxMegabytes = Math.floor(maxBytes / 1024 / 1024)
    throw new Error(`${label}不能超过 ${maxMegabytes} MB`)
  }
}
