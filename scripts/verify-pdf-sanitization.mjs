import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PDF_SANITIZATION_PORT || 1421)
const BASE_URL = `http://${HOST}:${PORT}`

async function isServerReady() {
  try {
    return (await fetch(BASE_URL)).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isServerReady()) return null

  const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await isServerReady()) return child
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  child.kill()
  throw new Error(`Vite server did not become ready at ${BASE_URL}`)
}

async function main() {
  const server = await ensureServer()
  let browser

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    const output = await page.evaluate(async () => {
      const { sanitizePrintableHtml } = await import('/src/lib/pdfExport.ts')
      const malicious = sanitizePrintableHtml(`
        <!doctype html><html><head><style>@import url('https://example.invalid/evil.css'); .x { background: url('https://example.invalid/track'); }</style></head>
        <body><p>保留文本</p><img src="x" onerror="window.__pdfInjected = true"><a href="javascript:window.__pdfInjected = true">危险链接</a><script>window.__pdfInjected = true</script><iframe src="https://example.invalid"></iframe></body></html>
      `)
      const valid = sanitizePrintableHtml(`
        <!doctype html><html><head><style>@page { size: A4 landscape; } .total { font-weight: 700; }</style></head>
        <body><table><tr><th>科目</th><td>100.00</td></tr></table></body></html>
      `)
      return { malicious, valid }
    })

    assert.match(output.malicious, /保留文本/)
    assert.doesNotMatch(output.malicious, /<script|onerror=|javascript:|<iframe|@import|url\s*\(/i)
    assert.match(output.valid, /<table>/i)
    assert.match(output.valid, /@page\s*\{\s*size:\s*A4 landscape/i)
    console.log('PDF markup sanitization passed')
  } finally {
    await browser?.close()
    if (server) server.kill()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
