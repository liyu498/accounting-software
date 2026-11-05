import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Windows CI verifies generated NSIS and MSI installers', () => {
  const workflow = read('.github/workflows/desktop-build.yml')
  const script = read('scripts/verify-windows-bundle.mjs')
  const packageJson = JSON.parse(read('package.json'))

  assert.equal(packageJson.scripts['verify:windows-bundle'], 'node scripts/verify-windows-bundle.mjs')
  assert.match(workflow, /runner\.os == 'Windows'/)
  assert.match(workflow, /npm run verify:windows-bundle/)
  assert.match(script, /path\.join\(BUNDLE_ROOT, ['"]nsis['"]\)/)
  assert.match(script, /path\.join\(BUNDLE_ROOT, ['"]msi['"]\)/)
  assert.match(script, /Get-AuthenticodeSignature/)
  assert.match(script, /REQUIRE_DISTRIBUTION_SIGNATURE/)
  assert.match(script, /NotSigned/)
  assert.match(script, /Valid/)
})

test('Windows release CI imports a PFX certificate and passes its thumbprint to Tauri', () => {
  const workflow = read('.github/workflows/desktop-build.yml')

  assert.match(workflow, /WINDOWS_CERTIFICATE/)
  assert.match(workflow, /WINDOWS_CERTIFICATE_PASSWORD/)
  assert.match(workflow, /Import-PfxCertificate/)
  assert.match(workflow, /certificateThumbprint/)
  assert.match(workflow, /Build signed Windows bundle/)
  assert.match(workflow, /REQUIRE_DISTRIBUTION_SIGNATURE:\s*['"]?1['"]?/)
  assert.match(workflow, /Build unsigned Windows CI bundle/)
})
