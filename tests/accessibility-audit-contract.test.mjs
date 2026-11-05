import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('all application routes are audited against WCAG AA in light and dark themes', () => {
  const packageJson = JSON.parse(read('package.json'))
  const workflow = read('.github/workflows/desktop-build.yml')
  const audit = read('scripts/audit-routes-accessibility.mjs')

  assert.ok(packageJson.devDependencies['@axe-core/playwright'])
  assert.equal(packageJson.scripts['verify:accessibility'], 'node scripts/audit-routes-accessibility.mjs')
  assert.match(workflow, /npm run verify:accessibility/)
  assert.match(audit, /<Route\\s\+path=/)
  assert.match(audit, /wcag2aa/)
  assert.match(audit, /wcag21aa/)
  assert.match(audit, /THEMES = \['light', 'dark'\]/)
  assert.match(audit, /color-contrast/)
})
