import type { SheetData } from 'write-excel-file/browser'

interface SheetMerge {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

interface ExportXlsxOptions {
  sheetRows: Array<Array<string | number>>
  columnWidths: { wch: number }[]
  sheetName: string
  fileName: string
  merges?: SheetMerge[]
  orientation?: 'portrait' | 'landscape'
  stickyRowsCount?: number
  showGridLines?: boolean
}

type BuildXlsxSheetDataOptions = Pick<ExportXlsxOptions, 'sheetRows' | 'columnWidths' | 'merges'>

function isTableHeader(row: Array<string | number>, previousRow?: Array<string | number>) {
  return row.length >= 4 && previousRow?.length === 0
}

function noteTone(value: string | number) {
  return ['制表说明', '边界说明', '本页小计'].includes(String(value))
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

export function buildXlsxSheetData({ sheetRows, columnWidths, merges = [] }: BuildXlsxSheetDataOptions) {
  const columnCount = Math.max(columnWidths.length, ...sheetRows.map((row) => row.length), 1)
  const headerRowIndex = sheetRows.findIndex((row, index) => isTableHeader(row, sheetRows[index - 1]))
  const tableEndIndex = headerRowIndex < 0
    ? -1
    : sheetRows.findIndex((row, index) => index > headerRowIndex && row.length === 0)
  const data: SheetData = sheetRows.map((row, rowIndex) => {
    const paddedRow = Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] ?? '')
    const headerRow = isTableHeader(row, sheetRows[rowIndex - 1])
    const titleRow = rowIndex === 0
    const formCodeRow = rowIndex === 1
    const metadataRow = rowIndex === 2
    const standardRow = String(row[0] || '').startsWith('会计准则：')
    const signatureRow = String(row[0] || '').startsWith('制表人：')
    const exportedRow = row.some((value) => String(value).startsWith('导出时间：'))
    const tableRow = headerRowIndex >= 0 && rowIndex >= headerRowIndex && (tableEndIndex < 0 || rowIndex < tableEndIndex)
    const noteRow = noteTone(row[0] || '')

    return paddedRow.map((value, columnIndex) => {
      if (isMergedCovered(merges, rowIndex, columnIndex)) return null
      const merge = findMerge(merges, rowIndex, columnIndex)
      return {
        value,
        type: typeof value === 'number' ? Number : String,
        format: typeof value === 'number' ? '#,##0.00' : undefined,
        columnSpan: merge ? merge.e.c - merge.s.c + 1 : undefined,
        height: titleRow ? 26 : headerRow ? 22 : undefined,
        wrap: true,
        fontFamily: 'Noto Sans SC',
        textColor: titleRow ? '#0F172A' : undefined,
        fontWeight: titleRow || headerRow || standardRow || noteRow ? 'bold' : undefined,
        fontSize: titleRow ? 16 : undefined,
        align: titleRow || standardRow
          ? 'center'
          : formCodeRow || exportedRow
            ? 'right'
            : headerRow
              ? 'center'
              : metadataRow && columnIndex === Math.floor(columnCount / 2)
                ? 'center'
                : metadataRow && columnIndex === columnCount - 1
                  ? 'right'
                  : signatureRow && columnIndex === Math.floor(columnCount / 2)
                    ? 'center'
                    : signatureRow && columnIndex === columnCount - 1
                      ? 'right'
                      : noteRow && columnIndex === 0
                        ? 'center'
                        : typeof value === 'number'
                          ? 'right'
                          : undefined,
        alignVertical: 'center',
        backgroundColor: titleRow ? '#DDEBFA' : headerRow ? '#E8EEF6' : noteRow ? '#F8FAFC' : undefined,
        borderColor: tableRow ? '#CBD5E1' : undefined,
        borderStyle: tableRow ? 'thin' : undefined,
      }
    }) as SheetData[number]
  })

  return {
    data,
    columns: Array.from({ length: columnCount }, (_, index) => ({
      width: columnWidths[index]?.wch || 14,
    })),
  }
}

export async function exportRowsToXlsx({
  sheetRows,
  columnWidths,
  sheetName,
  fileName,
  merges = [],
  orientation,
  stickyRowsCount,
  showGridLines,
}: ExportXlsxOptions) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const workbook = buildXlsxSheetData({ sheetRows, columnWidths, merges })

  await writeXlsxFile(workbook.data, {
    sheet: sheetName.slice(0, 31),
    columns: workbook.columns,
    orientation: orientation === 'landscape' ? 'landscape' : undefined,
    stickyRowsCount,
    showGridLines,
  }).toFile(fileName)
}
