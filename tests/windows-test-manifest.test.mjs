import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Windows test binaries embed the Common Controls v6 application manifest', () => {
  const manifestPath = new URL('../src-tauri/windows-app-manifest.xml', import.meta.url)
  assert.equal(existsSync(manifestPath), true)

  const build = read('src-tauri/build.rs')
  const manifest = read('src-tauri/windows-app-manifest.xml')

  assert.match(build, /new_without_app_manifest/)
  assert.match(build, /cargo:rustc-link-arg=\/MANIFEST:EMBED/)
  assert.match(build, /cargo:rustc-link-arg=\/MANIFESTINPUT:/)
  assert.match(build, /windows-app-manifest\.xml/)
  assert.match(manifest, /Microsoft\.Windows\.Common-Controls/)
  assert.match(manifest, /version="6\.0\.0\.0"/)
})
