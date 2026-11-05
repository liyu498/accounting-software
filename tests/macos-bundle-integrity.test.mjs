import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('macOS CI seals the complete app bundle before publishing artifacts', () => {
  const workflow = read('.github/workflows/desktop-build.yml')
  const config = read('src-tauri/tauri.macos.ci.conf.json')
  const script = read('scripts/verify-macos-bundle.mjs')
  const packageJson = JSON.parse(read('package.json'))

  assert.match(workflow, /runner\.os == 'macOS'/)
  assert.match(workflow, /tauri\.macos\.ci\.conf\.json/)
  assert.match(workflow, /npm run verify:macos-bundle/)
  assert.equal(JSON.parse(config).bundle.macOS.signingIdentity, '-')
  assert.equal(packageJson.scripts['verify:macos-bundle'], 'node scripts/verify-macos-bundle.mjs')
  assert.match(script, /codesign/)
  assert.match(script, /--verify/)
  assert.match(script, /--deep/)
  assert.match(script, /--strict/)
  assert.match(script, /hdiutil/)
  assert.match(script, /mountpoint/)
  assert.match(script, /mountedAppPath/)
  assert.match(script, /process\.arch === ['"]arm64['"]\s*\?\s*['"]aarch64['"]/)
})

test('distribution verification rejects ad-hoc signatures', () => {
  const script = read('scripts/verify-macos-bundle.mjs')
  assert.match(script, /REQUIRE_DISTRIBUTION_SIGNATURE/)
  assert.match(script, /Signature=adhoc/)
  assert.match(script, /TeamIdentifier=/)
  assert.match(script, /not set/)
  assert.match(script, /None/)
})
