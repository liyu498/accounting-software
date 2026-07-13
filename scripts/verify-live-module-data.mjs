import { readFileSync } from 'node:fs'

const adapterSource = readFileSync('src/lib/liveModuleRows.ts', 'utf8')
const pageSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')

const requiredAdapterSnippets = [
  ['invoice row mapper', 'export function mapLiveInvoiceRows'],
  ['voucher row mapper', 'export function mapLiveVoucherRows'],
  ['invoice summary mapper', 'export function summarizeLiveInvoices'],
  ['voucher summary mapper', 'export function summarizeLiveVouchers'],
  ['output invoice type', "invoice.invoice_type === invoiceType"],
  ['invoice type boundary', "invoiceType: 'output' | 'input'"],
  ['voucher direction filter', "entry.direction === direction"],
  ['voucher debit mapping', "entryAccount(voucher.entries, 'debit')"],
  ['voucher credit mapping', "entryAccount(voucher.entries, 'credit')"],
]

const requiredPageSnippets = [
  ['live invoice store import', "from '../../stores/invoiceStore'"],
  ['live voucher store import', "from '../../stores/voucherStore'"],
  ['selected company integration', 'selectedCompanyId'],
  ['current period integration', 'currentPeriodId'],
  ['live data refresh effect', 'fetchInvoices({'],
  ['live voucher query effect', 'queryVouchers({'],
  ['output live row mapping', 'mapLiveInvoiceRows(invoices, \'output\')'],
  ['input live row mapping', 'mapLiveInvoiceRows(invoices, \'input\')'],
  ['voucher live row mapping', 'mapLiveVoucherRows(vouchers)'],
  ['browser mock fallback', 'isTauri && selectedCompanyId'],
]

function verify(source, checks, sourceName) {
  return checks
    .filter(([, snippet]) => !source.includes(snippet))
    .map(([label, snippet]) => `${sourceName}: ${label} missing snippet: ${snippet}`)
}

const errors = [
  ...verify(adapterSource, requiredAdapterSnippets, 'live module adapter'),
  ...verify(pageSource, requiredPageSnippets, 'business module page'),
]

if (errors.length > 0) {
  console.error('Live data adapter verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Live data adapter verification passed:')
console.log(JSON.stringify({
  modules: ['outputInvoice', 'inputInvoice', 'voucher'],
  scope: 'selected company and accounting period',
  browserFallback: 'existing mock rows',
}, null, 2))
