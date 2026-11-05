export const MAX_BROWSER_VOUCHER_IMPORT_FILE_BYTES = 25 * 1024 * 1024
export const MAX_BROWSER_VOUCHER_IMPORT_ROWS = 50_000
export const MAX_BROWSER_VOUCHER_IMPORT_COLUMNS = 128

const knownHeaders = [
  '日期',
  '凭证号',
  '凭证字号',
  '摘要',
  '分录摘要',
  '科目编码',
  '科目全称',
  '科目名称',
  '借方金额',
  '贷方金额',
  '方向',
  '金额',
]

function cellText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return value === undefined || value === null ? '' : String(value).trim()
}

function amountValue(value) {
  const normalized = cellText(value).replace(/[￥¥,\s]/g, '')
  if (!normalized) return 0
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function headerMap(row) {
  const result = new Map()
  row.forEach((cell, columnIndex) => {
    const label = cellText(cell)
    knownHeaders.forEach((header) => {
      if (label === header || label.includes(header)) result.set(header, columnIndex)
    })
    if (label.includes('凭证字号')) result.set('凭证号', columnIndex)
  })
  return result
}

function findHeader(rows) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 5); rowIndex += 1) {
    const columns = headerMap(rows[rowIndex] || [])
    if (columns.size >= 3) return { rowIndex, columns }
  }
  return null
}

function columnValue(row, columns, name) {
  const columnIndex = columns.get(name)
  return columnIndex === undefined ? '' : cellText(row[columnIndex])
}

function directionValue(value, errors) {
  const direction = cellText(value).toLowerCase()
  if (['debit', '借', '借方'].includes(direction)) return 'debit'
  if (['credit', '贷', '贷方'].includes(direction)) return 'credit'
  errors.push(`方向无法识别: '${cellText(value)}'`)
  return 'debit'
}

export function parseBrowserVoucherSheetRows(sheetRows, formatType) {
  if (!['chronological', 'standard'].includes(formatType)) throw new Error('不支持的凭证导入格式')
  if (!Array.isArray(sheetRows) || sheetRows.length === 0) throw new Error('Excel文件中没有数据')
  if (sheetRows.length > MAX_BROWSER_VOUCHER_IMPORT_ROWS + 5) {
    throw new Error(`凭证导入工作表最多允许 ${MAX_BROWSER_VOUCHER_IMPORT_ROWS} 行数据`)
  }
  if (sheetRows.some((row) => Array.isArray(row) && row.length > MAX_BROWSER_VOUCHER_IMPORT_COLUMNS)) {
    throw new Error(`凭证导入工作表最多允许 ${MAX_BROWSER_VOUCHER_IMPORT_COLUMNS} 列`)
  }

  const header = findHeader(sheetRows)
  if (!header) throw new Error('未找到可识别的凭证导入表头')

  const rows = []
  let errorCount = 0
  sheetRows.slice(header.rowIndex + 1).forEach((sourceRow) => {
    const row = Array.isArray(sourceRow) ? sourceRow : []
    const errors = []
    const voucherDate = columnValue(row, header.columns, '日期')
    const accountCode = columnValue(row, header.columns, '科目编码')

    if (formatType === 'chronological') {
      const debitText = columnValue(row, header.columns, '借方金额')
      const creditText = columnValue(row, header.columns, '贷方金额')
      if (!voucherDate && !accountCode && !debitText && !creditText) return
      const debit = amountValue(debitText)
      const credit = amountValue(creditText)
      if (debit > 0 && credit > 0) errors.push('借贷金额不能同时填写')
      const amount = debit > 0 ? debit : credit
      if (amount <= 0) errors.push('借贷金额均为零或负数')
      if (!accountCode) errors.push('科目编码为空')
      errorCount += errors.length
      rows.push({
        row_index: rows.length + 1,
        voucher_date: voucherDate,
        voucher_number: columnValue(row, header.columns, '凭证号'),
        summary: columnValue(row, header.columns, '摘要'),
        account_code: accountCode,
        account_name: columnValue(row, header.columns, '科目名称'),
        account_full_name: columnValue(row, header.columns, '科目全称'),
        direction: debit > 0 ? 'debit' : 'credit',
        amount,
        errors,
      })
      return
    }

    const amountText = columnValue(row, header.columns, '金额')
    const directionText = columnValue(row, header.columns, '方向')
    if (!voucherDate && !accountCode && !amountText && !directionText) return
    const direction = directionValue(directionText, errors)
    const amount = amountValue(amountText)
    if (!accountCode) errors.push('科目编码为空')
    if (amount <= 0) errors.push('金额为零或负数')
    errorCount += errors.length
    rows.push({
      row_index: rows.length + 1,
      voucher_date: voucherDate,
      voucher_number: '',
      summary: columnValue(row, header.columns, '分录摘要') || columnValue(row, header.columns, '摘要'),
      account_code: accountCode,
      account_name: columnValue(row, header.columns, '科目名称'),
      account_full_name: columnValue(row, header.columns, '科目全称'),
      direction,
      amount,
      errors,
    })
  })

  return {
    rows,
    total_rows: rows.length,
    error_count: errorCount,
    errors: rows.length ? [] : ['Excel文件中没有有效数据行'],
  }
}
