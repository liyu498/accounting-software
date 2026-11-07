import fs from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { spawnNpm, stopProcessTree } from './spawn-npm.mjs'

const ROOT = process.cwd()
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8')
const HOST = '127.0.0.1'
const PORT = Number(process.env.ACCESSIBILITY_AUDIT_PORT || 1422)
const BASE_URL = `http://${HOST}:${PORT}`
const REPORT_PATH = process.env.ACCESSIBILITY_AUDIT_REPORT || path.join(ROOT, 'tmp', 'route-accessibility-audit.json')
const THEMES = ['light', 'dark']
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function unique(values) {
  return [...new Set(values)]
}

function extractRoutes() {
  return unique([...APP_SOURCE.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]))
    .filter((route) => route !== '*')
    .map((route) => route.replace(/:id/g, 'sample-id'))
}

async function isServerReady() {
  try {
    const response = await fetch(BASE_URL)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await isServerReady()) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Vite server did not become ready at ${BASE_URL}`)
}

async function ensureServer() {
  if (await isServerReady()) return null
  const child = spawnNpm(['run', 'dev', '--', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  await waitForServer()
  return child
}

async function navigateWithRetry(page, url) {
  let lastError
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8_000 })
      await page.waitForFunction(() => Boolean(document.querySelector('main')?.innerText.trim()), null, { timeout: 8_000 })
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      })
      await page.waitForTimeout(50)
      return
    } catch (error) {
      lastError = error
      if (attempt < 2) await page.waitForTimeout(250)
    }
  }
  throw new Error(`Route did not become ready after 2 attempts: ${String(lastError?.message || lastError)}`)
}

function summarizeViolation(violation) {
  return {
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.slice(0, 10).map((node) => ({
      target: node.target,
      html: node.html.slice(0, 300),
      failureSummary: node.failureSummary,
    })),
  }
}

async function main() {
  const routes = extractRoutes()
  const server = await ensureServer()
  const failures = []
  let browser

  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    await stopProcessTree(server)
    console.error('Playwright Chromium is not installed. Run `npx playwright install chromium`, then retry `npm run verify:accessibility`.')
    console.error(String(error?.message || error))
    process.exitCode = 2
    return
  }

  try {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: 1428, height: 789 },
        colorScheme: theme,
      })
      await context.addInitScript((themeMode) => {
        localStorage.setItem('app-theme-mode', themeMode)
        if (themeMode === 'dark') document.documentElement?.classList.add('dark')
      }, theme)
      const page = await context.newPage()

      for (const route of routes) {
        const url = `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`
        try {
          await navigateWithRetry(page, url)
          const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
          if (results.violations.length > 0) {
            failures.push({
              route,
              theme,
              issue: 'wcag-aa-violation',
              violations: results.violations.map(summarizeViolation),
              includesColorContrast: results.violations.some((violation) => violation.id === 'color-contrast'),
            })
          }
        } catch (error) {
          failures.push({ route, theme, issue: 'audit-error', error: String(error?.message || error) })
        }
      }
      await context.close()
    }
  } finally {
    await browser.close()
    await stopProcessTree(server)
  }

  const summary = {
    routes: routes.length,
    pages: routes.length * THEMES.length,
    themes: THEMES,
    wcagTags: WCAG_TAGS,
    failures: failures.length,
  }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ summary, failures }, null, 2)}\n`)

  if (failures.length > 0) {
    console.error('Route accessibility audit failed:')
    console.error(JSON.stringify({ summary, failures: failures.slice(0, 20) }, null, 2))
    console.error(`Full report: ${REPORT_PATH}`)
    process.exitCode = 1
    return
  }

  console.log('Route accessibility audit passed:')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Full report: ${REPORT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
