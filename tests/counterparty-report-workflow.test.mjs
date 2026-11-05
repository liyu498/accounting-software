import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  buildCounterpartyDetail,
  buildCounterpartySummary,
  summarizeCounterpartyReport,
} from '../src/lib/counterpartyReportWorkflow.js'

const records = [
  {
    id: 'r-1', companyId: 'c-1', period: '2026-05', settlementType: 'receivable',
    settlementNo: 'YS-001', settlementDate: '2026-05-05', counterparty: '甲客户',
    invoiceNo: 'FP-01', transactionNo: 'LS-01', totalAmount: 1000, settledAmount: 400,
    balanceAmount: 600, settlementMethod: '银行转账', owner: '张会计', status: '部分核销',
    sourceDocument: '销项发票', createdAt: '2026-05-05', updatedAt: '2026-05-06',
  },
  {
    id: 'r-2', companyId: 'c-1', period: '2026-05', settlementType: 'receivable',
    settlementNo: 'YS-002', settlementDate: '2026-05-10', counterparty: '甲客户',
    invoiceNo: 'FP-02', transactionNo: null, totalAmount: 500, settledAmount: 500,
    balanceAmount: 0, settlementMethod: '承兑', owner: '张会计', status: '已核销',
    sourceDocument: '销项发票', createdAt: '2026-05-10', updatedAt: '2026-05-11',
  },
  {
    id: 'p-1', companyId: 'c-1', period: '2026-05', settlementType: 'payable',
    settlementNo: 'YF-001', settlementDate: '2026-05-12', counterparty: '乙供应商',
    invoiceNo: 'JX-01', transactionNo: 'LS-02', totalAmount: 800, settledAmount: 200,
    balanceAmount: 600, settlementMethod: '银行转账', owner: '李会计', status: '部分核销',
    sourceDocument: '进项发票', createdAt: '2026-05-12', updatedAt: '2026-05-13',
  },
]

test('counterparty summary groups one settlement type by counterparty', () => {
  assert.deepEqual(buildCounterpartySummary(records, 'receivable'), [{
    counterparty: '甲客户', documentCount: 2, totalAmount: 1500, settledAmount: 900,
    balanceAmount: 600, settlementRate: 60, latestDate: '2026-05-10', owner: '张会计',
    openDocumentCount: 1,
  }])
  assert.deepEqual(summarizeCounterpartyReport(records, 'receivable'), {
    counterpartyCount: 1, documentCount: 2, totalAmount: 1500, settledAmount: 900,
    balanceAmount: 600, settlementRate: 60,
  })
})

test('counterparty detail filters type and sorts newest documents first', () => {
  assert.deepEqual(buildCounterpartyDetail(records, 'receivable').map((row) => row.id), ['r-2', 'r-1'])
  assert.equal(buildCounterpartyDetail(records, 'payable')[0].counterparty, '乙供应商')
})

test('application exposes four dedicated receivable and payable report views', () => {
  const workspace = fs.readFileSync('src/pages/operations/CounterpartyReportWorkspace.tsx', 'utf8')
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const shell = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf8')

  for (const label of ['应收汇总表', '应收明细表', '应付汇总表', '应付明细表']) {
    assert.match(workspace, new RegExp(label))
    assert.match(shell, new RegExp(label))
  }
  for (const path of [
    '/reports/receivable-summary', '/reports/receivable-detail',
    '/reports/payable-summary', '/reports/payable-detail',
  ]) assert.match(app, new RegExp(path.replaceAll('/', '\\/')))
})
