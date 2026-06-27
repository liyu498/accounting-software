import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.tsx', 'utf8')
const shellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
const businessSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')

const unique = (values) => [...new Set(values)]

const routeKinds = unique([...appSource.matchAll(/businessPage\('([^']+)'/g)].map((match) => match[1]))
const unionBlock = businessSource.match(/type ModuleKind =([\s\S]*?)\n\ninterface/)?.[1] ?? ''
const unionKinds = unique([...unionBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))
const configBlock = businessSource.match(/const moduleConfigs: Record<ModuleKind, ModuleConfig> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const configKinds = unique([...configBlock.matchAll(/^  ([A-Za-z0-9]+): \{\n    keywordPlaceholder:/gm)].map((match) => match[1]))

const routePaths = unique([...appSource.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]))
const shellPaths = unique([...shellSource.matchAll(/path: '([^']+)'/g)].map((match) => match[1]))

const missingUnion = routeKinds.filter((kind) => !unionKinds.includes(kind))
const missingConfig = routeKinds.filter((kind) => !configKinds.includes(kind))
const unusedUnion = unionKinds.filter((kind) => !routeKinds.includes(kind) && !['matchingRules'].includes(kind))
const navWithoutRoute = shellPaths.filter((path) => !routePaths.includes(path))

const summary = {
  businessRoutes: routeKinds.length,
  moduleKindUnion: unionKinds.length,
  moduleConfigs: configKinds.length,
  shellNavPaths: shellPaths.length,
  appRoutes: routePaths.length,
}

const errors = [
  ...missingUnion.map((kind) => `businessPage kind '${kind}' is missing from ModuleKind`),
  ...missingConfig.map((kind) => `businessPage kind '${kind}' is missing from moduleConfigs`),
  ...unusedUnion.map((kind) => `ModuleKind '${kind}' is not used by any business route`),
  ...navWithoutRoute.map((path) => `sidebar path '${path}' has no matching <Route>`),
]

if (errors.length > 0) {
  console.error('Module framework verification failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log('Module framework verification passed:')
console.log(JSON.stringify(summary, null, 2))
