import { existsSync, mkdtempSync, readFileSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'darwin') {
  console.log('macOS bundle verification skipped on non-macOS host')
  process.exit(0)
}

const root = process.cwd()
const tauriConfig = JSON.parse(readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const bundleArch = process.arch === 'arm64' ? 'aarch64' : process.arch
const appPath = process.env.MACOS_APP_PATH
  || path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'macos', '智能代账系统.app')
const dmgPath = process.env.MACOS_DMG_PATH
  || path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'dmg', `智能代账系统_${tauriConfig.version}_${bundleArch}.dmg`)

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`)
  }
  return `${result.stdout}${result.stderr}`
}

if (existsSync(appPath)) {
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
}
if (!existsSync(dmgPath)) throw new Error(`macOS disk image not found: ${dmgPath}`)
run('hdiutil', ['verify', dmgPath])

const mountPoint = mkdtempSync(path.join(tmpdir(), 'accounting-dmg-verify-'))
let signature = ''
let attached = false
try {
  run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mountPoint, dmgPath])
  attached = true
  const mountedAppPath = path.join(mountPoint, '智能代账系统.app')
  if (!existsSync(mountedAppPath)) {
    throw new Error(`macOS app bundle is missing from disk image: ${mountedAppPath}`)
  }
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', mountedAppPath])
  signature = run('codesign', ['-dvvv', mountedAppPath])
} finally {
  if (attached) run('hdiutil', ['detach', mountPoint])
  if (existsSync(mountPoint)) rmdirSync(mountPoint)
}

if (!signature.includes('Identifier=com.accounting.agent')) {
  throw new Error('macOS bundle identifier does not match com.accounting.agent')
}

if (process.env.REQUIRE_DISTRIBUTION_SIGNATURE === '1') {
  if (/Signature=adhoc/.test(signature) || /TeamIdentifier=(?:not set|None)/.test(signature)) {
    throw new Error('distribution bundle must use an Apple Developer ID signature with a team identifier')
  }
}

console.log(JSON.stringify({
  appPath,
  dmgPath,
  signature: signature.match(/Signature=[^\n]+/)?.[0] || 'unknown',
  teamIdentifier: signature.match(/TeamIdentifier=[^\n]+/)?.[0] || 'unknown',
  distributionRequired: process.env.REQUIRE_DISTRIBUTION_SIGNATURE === '1',
}, null, 2))
