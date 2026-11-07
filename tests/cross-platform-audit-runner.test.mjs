import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const readOptional = (path) => {
  const url = new URL(`../${path}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : ''
}

test('browser verification scripts use one cross-platform npm launcher', () => {
  const helper = readOptional('scripts/spawn-npm.mjs')
  assert.match(helper, /process\.env\.npm_execpath/)
  assert.match(helper, /process\.execPath/)

  for (const path of [
    'scripts/verify-pdf-sanitization.mjs',
    'scripts/audit-route-content.mjs',
    'scripts/audit-routes-visual.mjs',
    'scripts/audit-routes-accessibility.mjs',
  ]) {
    const source = read(path)
    assert.match(source, /spawnNpm/)
    assert.doesNotMatch(source, /spawn\(['"]npm['"]/)
  }
})
