import type { SheetData } from 'write-excel-file/browser'

interface SheetMerge {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

interface ExportXlsxOptions {
  sheetRows: string[][]
  columnWidths: { wch: number }[]
  sheetName: string
  fileName: string
  merges?: SheetMerge[]
}

function isTableHeader(row: string[], previousRow?: string[]) {
  return row.length >= 4 && previousRow?.length === 0
}

function noteTone(value: string) {
  return ['制表说明', '边界说明', '本页小计'].includes(value)
}

function findMerge(merges: SheetMerge[], rowIndex: number, columnIndex: number) {
  return merges.find((merge) => merge.s.r === rowIndex && merge.s.c === columnIndex && merge.s.r === merge.e.r)
}

function isMergedCovered(merges: SheetMerge[], rowIndex: number, columnIndex: number) {
  return merges.some(
    (merge) =>
      merge.s.r === rowIndex &&
      merge.e.r === rowIndex &&
      rowIndex === merge.s.r &&
      columnIndex > merge.s.c &&
      columnIndex <= merge.e.c,
  )
}

export async function exportRowsToXlsx({ sheetRows, columnWidths, sheetName, fileName, merges = [] }: ExportXlsxOptions) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const columnCount = Math.max(columnWidths.length, ...sheetRows.map((row) => row.length), 1)
  const data: SheetData = sheetRows.map((row, rowIndex) => {
    const paddedRow = Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] || '')
    const headerRow = isTableHeader(row, sheetRows[rowIndex - 1])
    const titleRow = rowIndex === 0
    const noteRow = noteTone(row[0] || '')

    return paddedRow
      .map((value, columnIndex) => {
        if (isMergedCovered(merges, rowIndex, columnIndex)) return null
        const merge = findMerge(merges, rowIndex, columnIndex)
        return {
          value,
          type: String,
          columnSpan: merge ? merge.e.c - merge.s.c + 1 : undefined,
          height: titleRow ? 26 : headerRow ? 22 : undefined,
          wrap: true,
          fontFamily: 'Noto Sans SC',
          textColor: titleRow ? '#0F172A' : undefined,
          fontWeight: titleRow || headerRow || noteRow ? 'bold' : undefined,
          fontSize: titleRow ? 16 : undefined,
          align: titleRow ? 'center' : headerRow ? 'center' : noteRow && columnIndex === 0 ? 'center' : undefined,
          alignVertical: 'center',
          backgroundColor: titleRow ? '#DDEBFA' : headerRow ? '#E8EEF6' : noteRow ? '#F8FAFC' : undefined,
          borderColor: headerRow || rowIndex > 0 ? '#CBD5E1' : undefined,
          borderStyle: headerRow || rowIndex > 0 ? 'thin' : undefined,
        }
      })
      .filter(Boolean) as SheetData[number]
  })

  await writeXlsxFile(data, {
    sheet: sheetName.slice(0, 31),
    columns: Array.from({ length: columnCount }, (_, index) => ({
      width: columnWidths[index]?.wch || 14,
    })),
  }).toFile(fileName)
}
