import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildOperatingPerformance, buildOperatingStatus } from '../src/lib/operatingReportWorkflow.js'

const balanceSheet = {
  total_assets: 1000, total_liabilities: 400, total_equity: 600,
  opening_total_assets: 900, opening_total_liabilities: 350, opening_total_equity: 550,
  is_balanced: true,
  items: [
    { item_code: 'BS101', item_name: '货币资金', opening_balance: 100, ending_balance: 180, children: [] },
    { item_code: 'BS103', item_name: '应收账款', opening_balance: 220, ending_balance: 260, children: [] },
    { item_code: 'BS105', item_name: '存货', opening_balance: 180, ending_balance: 210, children: [] },
    { item_code: 'BS199', item_name: '流动资产合计', opening_balance: 600, ending_balance: 700, children: [] },
    { item_code: 'BS399', item_name: '流动负债合计', opening_balance: 250, ending_balance: 300, children: [] },
  ],
}

const incomeStatement = {
  current_period_total: 90, year_to_date_total: 420,
  items: [
    { item_code: 'IS001', item_name: '营业收入', current_amount: 500, year_to_date: 2400, children: [] },
    { item_code: 'IS002', item_name: '营业成本', current_amount: 300, year_to_date: 1400, children: [] },
    { item_code: 'IS010', item_name: '营业利润', current_amount: 120, year_to_date: 560, children: [] },
    { item_code: 'IS015', item_name: '净利润', current_amount: 90, year_to_date: 420, children: [] },
  ],
}

test('operating status derives capital structure and liquidity indicators', () => {
  const report = buildOperatingStatus(balanceSheet)
  assert.equal(report.metrics.workingCapital, 400)
  assert.equal(report.metrics.currentRatio, 2.33)
  assert.equal(report.metrics.debtRatio, 40)
  assert.equal(report.rows.find((row) => row.code === 'BS101').ending, 180)
})

test('operating performance derives gross and net margins from statement lines', () => {
  const report = buildOperatingPerformance(incomeStatement)
  assert.equal(report.metrics.revenue, 500)
  assert.equal(report.metrics.grossProfit, 200)
  assert.equal(report.metrics.grossMargin, 40)
  assert.equal(report.metrics.netMargin, 18)
})

test('operating performance follows current enterprise statutory profit rows', () => {
  const report = buildOperatingPerformance({
    accounting_system: 'enterprise',
    current_period_total: 90,
    year_to_date_total: 420,
    items: [
      { item_code: 'IS001', item_name: '一、营业收入', current_amount: 500, year_to_date: 2400, children: [] },
      { item_code: 'IS002', item_name: '减：营业成本', current_amount: 300, year_to_date: 1400, children: [] },
      { item_code: 'IS015', item_name: '加：公允价值变动收益', current_amount: 9, year_to_date: 30, children: [] },
      { item_code: 'IS019', item_name: '二、营业利润', current_amount: 120, year_to_date: 560, is_total: 1, children: [] },
      { item_code: 'IS024', item_name: '四、净利润', current_amount: 90, year_to_date: 420, is_total: 1, children: [] },
    ],
  })

  assert.equal(report.metrics.operatingProfit, 120)
  assert.equal(report.metrics.netProfit, 90)
  assert.equal(report.metrics.netMargin, 18)
  assert.equal(report.rows.some((row) => row.code === 'IS019'), true)
  assert.equal(report.rows.some((row) => row.code === 'IS024'), true)
})

test('operating reports have dedicated routes and presentation', () => {
  const workspace = fs.readFileSync('src/pages/operations/OperatingAnalysisWorkspace.tsx', 'utf8')
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const shell = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf8')
  for (const label of ['经营状况表', '经营业绩表']) {
    assert.match(workspace, new RegExp(label))
    assert.match(shell, new RegExp(label))
  }
  assert.match(app, /\/reports\/operating-status/)
  assert.match(app, /\/reports\/operating-performance/)
})
