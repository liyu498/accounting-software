import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const readOptional = (path) => {
  const url = new URL(`../${path}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : ''
}

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

test('Windows Authenticode inspection preserves multiline PowerShell hashtable syntax', () => {
  const script = read('scripts/verify-windows-bundle.mjs')

  assert.match(script, /\]\.join\(['"]\\n['"]\)/)
  assert.doesNotMatch(script, /\]\.join\(['"]; ['"]\)/)
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

test('Windows MSI uses a Chinese code page and a stable upgrade identity', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'))
  const wix = config.bundle?.windows?.wix

  assert.equal(wix?.language, 'zh-CN')
  assert.equal(wix?.upgradeCode, '95884cbd-6bf4-5430-b09b-1b9d6d0418ce')
})

test('Windows CI installs, upgrades and uninstalls both bundles without deleting app data', () => {
  const workflow = read('.github/workflows/desktop-build.yml')
  const lifecycle = readOptional('.github/scripts/verify-windows-installer-lifecycle.ps1')

  assert.match(workflow, /Build Windows upgrade baseline/)
  assert.match(workflow, /WINDOWS_BASELINE_INSTALLER/)
  assert.match(workflow, /Verify Windows installer lifecycle/)
  assert.match(workflow, /verify-windows-installer-lifecycle\.ps1/)
  assert.match(lifecycle, /Start-Process/)
  assert.match(lifecycle, /DisplayVersion/)
  assert.match(lifecycle, /0\.9\.0/)
  assert.match(lifecycle, /1\.0\.0/)
  assert.match(lifecycle, /msiexec\.exe/)
  assert.match(lifecycle, /\/qn/)
  assert.match(lifecycle, /\/S/)
  assert.match(lifecycle, /\$env:APPDATA/)
  assert.match(lifecycle, /release-data-sentinel/)
  assert.match(lifecycle, /Test-Path/)
})
