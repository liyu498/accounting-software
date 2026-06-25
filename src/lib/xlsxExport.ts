import type { SheetData } from 'write-excel-file/browser'

interface ExportXlsxOptions {
  sheetRows: string[][]
  columnWidths: { wch: number }[]
  sheetName: string
  fileName: string
}

export async function exportRowsToXlsx({ sheetRows, columnWidths, sheetName, fileName }: ExportXlsxOptions) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const data: SheetData = sheetRows.map((row, rowIndex) =>
    row.map((value) => ({
      value,
      type: String,
      fontWeight: rowIndex === 0 ? 'bold' : undefined,
      align: rowIndex === 0 ? 'center' : undefined,
      backgroundColor: rowIndex === 0 ? '#E8EEF6' : undefined,
    }))
  )

  await writeXlsxFile(data, {
    sheet: sheetName.slice(0, 31),
    columns: columnWidths.map((column) => ({ width: column.wch })),
  }).toFile(fileName)
}
