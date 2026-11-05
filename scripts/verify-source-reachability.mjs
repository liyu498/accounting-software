import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE_ROOT = path.join(ROOT, 'src')
const ENTRY_FILE = path.join(ROOT, 'src/main.tsx')
const SOURCE_EXTENSION = /\.(ts|tsx|js|jsx)$/
const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(file)
    if (!SOURCE_EXTENSION.test(entry.name) || entry.name.endsWith('.d.ts')) return []
    return [path.normalize(file)]
  })
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((match) => match[1] || match[2])
}

function resolveSourceImport(fromFile, specifier, sourceFiles) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    base,
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]
  return candidates.map(path.normalize).find((candidate) => sourceFiles.has(candidate)) || null
}

function main() {
  const files = collectSourceFiles(SOURCE_ROOT)
  const sourceFiles = new Set(files)
  const graph = new Map(files.map((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const imports = importSpecifiers(source)
      .map((specifier) => resolveSourceImport(file, specifier, sourceFiles))
      .filter(Boolean)
    return [file, imports]
  }))

  const reachable = new Set()
  const visit = (file) => {
    if (reachable.has(file)) return
    reachable.add(file)
    for (const imported of graph.get(file) || []) visit(imported)
  }
  visit(path.normalize(ENTRY_FILE))

  const unreachable = files
    .filter((file) => !reachable.has(file))
    .map((file) => path.relative(ROOT, file))
    .sort()

  if (unreachable.length > 0) {
    console.error('Source reachability verification failed:')
    for (const file of unreachable) console.error(`- unreachable: ${file}`)
    process.exitCode = 1
    return
  }

  console.log('Source reachability verification passed:')
  console.log(JSON.stringify({ sourceFiles: files.length, reachableFiles: reachable.size, unreachable: 0 }, null, 2))
}

main()
