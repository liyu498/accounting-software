import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_ROOT = path.join(ROOT, 'src-tauri', 'target', 'release', 'bundle')
const SIGNATURE_SCRIPT = fileURLToPath(new URL('./inspect-authenticode-signature.ps1', import.meta.url))
const strictSignature = process.env.REQUIRE_DISTRIBUTION_SIGNATURE === '1'

if (process.platform !== 'win32') {
  console.log('Windows bundle verification skipped: current platform is not Windows.')
  process.exit(0)
}

function findInstallers(directory, extension) {
  try {
    return readdirSync(directory)
      .filter((name) => name.toLowerCase().endsWith(extension))
      .map((name) => path.join(directory, name))
  } catch {
    return []
  }
}

function readAuthenticodeSignature(installerPath) {
  const result = spawnSync('pwsh.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    SIGNATURE_SCRIPT,
    '-InstallerPath',
    installerPath,
  ], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`Unable to inspect Authenticode signature for ${installerPath}: ${result.stderr.trim()}`)
  }

  const output = result.stdout.trim()
  if (!output) {
    throw new Error(`Authenticode inspection produced no output for ${installerPath}`)
  }

  try {
    return JSON.parse(output)
  } catch (error) {
    throw new Error(`Authenticode inspection returned invalid JSON for ${installerPath}: ${error.message}`)
  }
}

const groups = [
  { label: 'NSIS', directory: path.join(BUNDLE_ROOT, 'nsis'), extension: '.exe' },
  { label: 'MSI', directory: path.join(BUNDLE_ROOT, 'msi'), extension: '.msi' },
]

for (const group of groups) {
  const installers = findInstallers(group.directory, group.extension)
  if (installers.length === 0) {
    throw new Error(`${group.label} installer was not generated in ${group.directory}`)
  }

  for (const installerPath of installers) {
    const size = statSync(installerPath).size
    if (size < 100 * 1024) {
      throw new Error(`${group.label} installer is unexpectedly small (${size} bytes): ${installerPath}`)
    }

    const signature = readAuthenticodeSignature(installerPath)
    if (signature.Status !== 'Valid' && signature.Status !== 'NotSigned') {
      throw new Error(`${group.label} installer has an invalid Authenticode status (${signature.Status}): ${installerPath}`)
    }
    if (strictSignature && (signature.Status !== 'Valid' || !signature.Signer)) {
      throw new Error(`${group.label} installer requires a valid distribution signature: ${installerPath}`)
    }

    const relativePath = path.relative(ROOT, installerPath)
    console.log(`${group.label}: ${relativePath} (${size} bytes), signature=${signature.Status}${signature.Signer ? `, signer=${signature.Signer}` : ''}`)
  }
}

console.log(`Windows bundle verification passed${strictSignature ? ' with distribution signatures required' : ''}.`)
