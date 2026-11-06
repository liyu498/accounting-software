import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const workflow = readFileSync(
  new URL('../.github/workflows/desktop-build.yml', import.meta.url),
  'utf8',
)
const lib = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')
const readOptional = (url) => existsSync(url) ? readFileSync(url, 'utf8') : ''
const performance = readOptional(
  new URL('../src-tauri/src/release_performance.rs', import.meta.url),
)
const guide = readOptional(new URL('../docs/release-performance.md', import.meta.url))

test('release performance gate covers large cross-year account sets and concurrent clients', () => {
  assert.match(
    packageJson.scripts?.['verify:release-performance'] ?? '',
    /cargo test.*release_performance/,
  )
  assert.match(workflow, /npm run verify:release-performance/)
  assert.match(lib, /mod release_performance;/)
  assert.match(
    performance,
    /release_performance_large_cross_year_account_set_meets_query_report_and_export_budgets/,
  )
  assert.match(
    performance,
    /release_performance_multi_company_concurrency_meets_budget/,
  )
  for (const requirement of [
    'LARGE_ACCOUNT_VOUCHERS',
    'CROSS_YEAR_MONTHS',
    'CONCURRENT_COMPANIES',
    'PAGINATION_BUDGET',
    'IMPORT_BUDGET',
    'EXPORT_BUDGET',
    'REPORT_BUDGET',
    'CONCURRENT_QUERY_BUDGET',
  ]) {
    assert.match(performance, new RegExp(requirement))
  }
  assert.match(guide, /大账套/)
  assert.match(guide, /跨年度/)
  assert.match(guide, /多客户并发/)
})
