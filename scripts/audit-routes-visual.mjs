import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8')
const HOST = '127.0.0.1'
const PORT = Number(process.env.ROUTE_AUDIT_PORT || 1420)
const BASE_URL = `http://${HOST}:${PORT}`
const VIEWPORTS = [
  { name: 'desktop', width: 1428, height: 789 },
  { name: 'mobile', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']

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
  const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  await waitForServer()
  return child
}

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

async function auditPage(page) {
  return page.evaluate(() => {
    function parseRgb(color) {
      const match = color.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map((part) => Number(part.trim()))
      if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null
      const alpha = parts.length >= 4 ? parts[3] : 1
      return { rgb: parts.slice(0, 3), alpha }
    }

    const doc = document.documentElement
    const overflow = doc.scrollWidth > doc.clientWidth + 2
    const brightSurfaces = []
    for (const element of document.body.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect()
      const area = rect.width * rect.height
      if (area < 12000 || rect.width < 120 || rect.height < 40) continue
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      const parsed = parseRgb(style.backgroundColor)
      if (!parsed || parsed.alpha < 0.9) continue
      const [r, g, b] = parsed.rgb
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum > 235) {
        brightSurfaces.push({
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute('class') || '').slice(0, 100),
          area: Math.round(area),
          color: style.backgroundColor,
        })
      }
    }
    return {
      title: document.title,
      bodyTextLength: document.body.innerText.trim().length,
      overflow,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      brightSurfaces: brightSurfaces.slice(0, 5),
    }
  })
}

async function main() {
  const routes = extractRoutes()
  const server = await ensureServer()
  const failures = []
  let browser

  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    if (server) server.kill()
    console.error('Playwright Chromium is not installed. Run `npx playwright install chromium`, then retry `npm run verify:routes`.')
    console.error(String(error?.message || error))
    process.exit(2)
  }

  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
        })
        await context.addInitScript((themeMode) => {
          localStorage.setItem('app-theme-mode', themeMode)
          if (themeMode === 'dark') document.documentElement.classList.add('dark')
        }, theme)
        const page = await context.newPage()
        for (const route of routes) {
          const url = `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8_000 })
            await page.waitForTimeout(80)
            const result = await auditPage(page)
            if (result.bodyTextLength === 0) {
              failures.push({ route, viewport: viewport.name, theme, issue: 'blank-page' })
            }
            if (result.overflow) {
              failures.push({
                route,
                viewport: viewport.name,
                theme,
                issue: 'document-horizontal-overflow',
                scrollWidth: result.scrollWidth,
                clientWidth: result.clientWidth,
              })
            }
            if (theme === 'dark' && result.brightSurfaces.length > 0) {
              failures.push({
                route,
                viewport: viewport.name,
                theme,
                issue: 'large-bright-surface',
                samples: result.brightSurfaces,
              })
            }
          } catch (error) {
            failures.push({ route, viewport: viewport.name, theme, issue: 'navigation-error', error: String(error?.message || error) })
          }
        }
        await context.close()
      }
    }
  } finally {
    await browser.close()
    if (server) server.kill()
  }

  const summary = {
    routes: routes.length,
    pages: routes.length * VIEWPORTS.length * THEMES.length,
    viewports: VIEWPORTS.map((viewport) => viewport.name),
    themes: THEMES,
    failures: failures.length,
  }

  if (failures.length > 0) {
    console.error('Route visual audit failed:')
    console.error(JSON.stringify({ summary, failures: failures.slice(0, 80) }, null, 2))
    process.exit(1)
  }

  console.log('Route visual audit passed:')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
