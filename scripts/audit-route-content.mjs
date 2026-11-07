import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { spawnNpm, stopProcessTree } from './spawn-npm.mjs'

const ROOT = process.cwd()
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8')
const HOST = '127.0.0.1'
const PORT = Number(process.env.ROUTE_CONTENT_AUDIT_PORT || 1421)
const BASE_URL = `http://${HOST}:${PORT}`
const REPORT_PATH = process.env.ROUTE_CONTENT_AUDIT_REPORT || path.join(ROOT, 'tmp', 'route-content-audit.json')
const ALLOWED_SHARED_HEADER_GROUPS = [
  ['/vouchers/edit/sample-id', '/vouchers/new'],
]

function unique(values) {
  return [...new Set(values)]
}

function normalizeRoute(pathname) {
  return pathname.replace(/:id/g, 'sample-id')
}

function extractRoutes() {
  return unique([...APP_SOURCE.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]))
    .filter((route) => route !== '*')
    .map(normalizeRoute)
}

async function isServerReady() {
  try {
    return (await fetch(BASE_URL)).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isServerReady()) return null
  const child = spawnNpm(['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await isServerReady()) return child
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  await stopProcessTree(child)
  throw new Error(`Vite server did not become ready at ${BASE_URL}`)
}

async function waitForRouteContent(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main')
    return Boolean(main?.innerText.trim())
  }, null, { timeout: 8_000 })
}

async function inspectRoute(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return null

    const isVisible = (element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const text = (element) => (element.textContent || '').replace(/\s+/g, ' ').trim()
    const visibleText = (selector) => [...main.querySelectorAll(selector)]
      .filter(isVisible)
      .map(text)
      .filter(Boolean)

    return {
      path: window.location.pathname,
      heading: visibleText('h1, h2')[0] || '',
      tableHeaders: visibleText('th').slice(0, 40),
      actions: visibleText('button')
        .filter((label) => !['上一页', '下一页', '刷新', '打印'].includes(label))
        .slice(0, 40),
      mainTextLength: main.innerText.trim().length,
    }
  })
}

function duplicateGroups(rows, signatureOf, predicate = () => true) {
  const groups = new Map()
  for (const row of rows.filter(predicate)) {
    const signature = signatureOf(row)
    if (!signature) continue
    const routes = groups.get(signature) || []
    routes.push(row.route)
    groups.set(signature, routes)
  }
  return [...groups.entries()]
    .filter(([, routes]) => routes.length > 1)
    .map(([signature, routes]) => ({ signature: JSON.parse(signature), routes: routes.sort() }))
}

function isAllowedHeaderGroup(routes) {
  const key = routes.slice().sort().join('\n')
  return ALLOWED_SHARED_HEADER_GROUPS.some((group) => group.slice().sort().join('\n') === key)
}

async function main() {
  const routes = extractRoutes()
  const server = await ensureServer()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1428, height: 789 }, colorScheme: 'light' })
  const page = await context.newPage()
  const inspected = []
  const failures = []
  let runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.message || error)))

  try {
    for (const route of routes) {
      runtimeErrors = []
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 8_000 })
        await waitForRouteContent(page)
        const result = await inspectRoute(page)
        if (!result) {
          failures.push({ route, issue: 'missing-main-content' })
          continue
        }
        inspected.push({ route, ...result })
        if (runtimeErrors.length > 0) failures.push({ route, issue: 'runtime-error', errors: runtimeErrors.slice(0, 5) })
      } catch (error) {
        failures.push({ route, issue: 'navigation-error', error: String(error?.message || error) })
      }
    }
  } finally {
    await context.close()
    await browser.close()
    await stopProcessTree(server)
  }

  const canonicalRoutes = inspected.filter((row) => row.route === row.path)
  const redirects = inspected.filter((row) => row.route !== row.path).map(({ route, path: target }) => ({ route, target }))

  for (const row of canonicalRoutes) {
    if (!row.heading) failures.push({ route: row.route, issue: 'missing-primary-heading' })
    if (row.mainTextLength < 60) failures.push({ route: row.route, issue: 'insufficient-route-content', mainTextLength: row.mainTextLength })
  }

  const duplicateContentSignatures = duplicateGroups(
    canonicalRoutes,
    (row) => JSON.stringify([row.heading, row.tableHeaders, row.actions]),
  )
  const duplicateHeaderSignatures = duplicateGroups(
    canonicalRoutes,
    (row) => JSON.stringify(row.tableHeaders),
    (row) => row.tableHeaders.length >= 3,
  ).filter((group) => !isAllowedHeaderGroup(group.routes))
  const duplicateHeadings = duplicateGroups(
    canonicalRoutes,
    (row) => JSON.stringify([row.heading]),
    (row) => Boolean(row.heading),
  )

  for (const group of duplicateContentSignatures) failures.push({ issue: 'duplicate-route-content', ...group })
  for (const group of duplicateHeaderSignatures) failures.push({ issue: 'duplicate-business-table', ...group })
  for (const group of duplicateHeadings) failures.push({ issue: 'duplicate-primary-heading', ...group })

  const summary = {
    routes: routes.length,
    canonicalRoutes: canonicalRoutes.length,
    redirects: redirects.length,
    allowedSharedHeaderGroups: ALLOWED_SHARED_HEADER_GROUPS.length,
    failures: failures.length,
  }
  const report = { summary, redirects, duplicateContentSignatures, duplicateHeaderSignatures, duplicateHeadings, failures }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)

  if (failures.length > 0) {
    console.error('Route content audit failed:')
    console.error(JSON.stringify({ summary, failures: failures.slice(0, 80) }, null, 2))
    console.error(`Full report: ${REPORT_PATH}`)
    process.exitCode = 1
    return
  }

  console.log('Route content audit passed:')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Full report: ${REPORT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
