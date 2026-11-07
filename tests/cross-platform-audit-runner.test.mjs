import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { stopProcessTree } from '../scripts/spawn-npm.mjs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const readOptional = (path) => {
  const url = new URL(`../${path}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : ''
}

test('browser verification scripts use one cross-platform npm launcher', () => {
  const helper = readOptional('scripts/spawn-npm.mjs')
  assert.match(helper, /process\.env\.npm_execpath/)
  assert.match(helper, /process\.execPath/)
  assert.match(helper, /export async function stopProcessTree/)
  assert.match(helper, /taskkill/)
  assert.match(helper, /['"]\/T['"]/)

  for (const path of [
    'scripts/verify-pdf-sanitization.mjs',
    'scripts/audit-route-content.mjs',
    'scripts/audit-routes-visual.mjs',
    'scripts/audit-routes-accessibility.mjs',
  ]) {
    const source = read(path)
    assert.match(source, /spawnNpm/)
    assert.match(source, /stopProcessTree/)
    assert.match(source, /await stopProcessTree\(server\)/)
    assert.doesNotMatch(source, /spawn\(['"]npm['"]/)
    assert.doesNotMatch(source, /server\.kill\(/)
  }
})

test('browser verification cleanup waits for the launched process to exit', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'ignore' })
  await once(child, 'spawn')

  await stopProcessTree(child)

  assert.ok(child.exitCode !== null || child.signalCode !== null)
})
