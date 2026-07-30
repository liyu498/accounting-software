import { existsSync, readFileSync } from 'node:fs'

const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const databaseSource = readFileSync('src-tauri/src/db.rs', 'utf8')
const appSource = readFileSync('src-tauri/src/lib.rs', 'utf8')
const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'))
const workflowPath = '.github/workflows/desktop-build.yml'
const workflowSource = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : ''

const errors = []
const assert = (condition, message) => {
  if (!condition) errors.push(message)
}

assert(tauriConfig.bundle?.active === true, 'Tauri bundle must be enabled')
assert(tauriConfig.bundle?.targets === 'all', 'Tauri bundle targets must include macOS and Windows')
assert(tauriConfig.bundle?.windows?.nsis?.installMode === 'currentUser', 'Windows NSIS bundle must install per user')
assert(tauriConfig.bundle?.icon?.includes('icons/icon.ico'), 'Windows bundle must include an .ico icon')
assert(tauriConfig.bundle?.icon?.includes('icons/icon.icns'), 'macOS bundle must include an .icns icon')
assert(tauriConfig.app?.windows?.[0]?.resizable === true, 'main window must remain resizable for desktop layouts')
assert(databaseSource.includes('app_data_dir: Arc<PathBuf>'), 'database must use Tauri-managed app data storage')
assert(appSource.includes('.app_data_dir()'), 'app bootstrap must resolve the platform app data directory')
assert(capability.permissions?.includes('dialog:allow-open'), 'desktop capability must permit local file selection')
assert(workflowSource.includes('windows-latest'), 'desktop CI must validate the Windows target')
assert(workflowSource.includes('macos-latest'), 'desktop CI must validate the macOS target')
assert(workflowSource.includes('npm run tauri build'), 'desktop CI must build Tauri bundles')

if (errors.length > 0) {
  console.error('Desktop target verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Desktop target verification passed:')
console.log(JSON.stringify({
  targets: ['macOS', 'Windows'],
  bundle: tauriConfig.bundle.targets,
  windowsInstaller: tauriConfig.bundle.windows.nsis.installMode,
  appDataStorage: true,
  ciMatrix: ['macos-latest', 'windows-latest'],
}, null, 2))
