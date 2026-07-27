import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.tsx', 'utf8')
const shellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
const businessSource = readFileSync('src/pages/operations/BusinessModulePage.tsx', 'utf8')
const agencyNavSource = readFileSync('src/pages/agency/agencyNav.tsx', 'utf8')
const agencySource = readFileSync('src/pages/agency/AgencyModulePage.tsx', 'utf8')

const unique = (values) => [...new Set(values)]

const routeKinds = unique([...appSource.matchAll(/businessPage\('([^']+)'/g)].map((match) => match[1]))
const agencyRouteKinds = unique([...appSource.matchAll(/agencyPage\('([^']+)'/g)].map((match) => match[1]))
const unionBlock = businessSource.match(/type ModuleKind =([\s\S]*?)\n\ninterface/)?.[1] ?? ''
const unionKinds = unique([...unionBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))
const configBlock = businessSource.match(/const moduleConfigs: Record<ModuleKind, ModuleConfig> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const configKinds = unique([...configBlock.matchAll(/^  ([A-Za-z0-9]+): \{\n    keywordPlaceholder:/gm)].map((match) => match[1]))
const agencyUnionBlock = agencySource.match(/export type AgencyModuleKind =([\s\S]*?)\n\ninterface/)?.[1] ?? ''
const agencyUnionKinds = unique([...agencyUnionBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))
const agencyConfigBlock = agencySource.match(/const configs: Record<AgencyModuleKind, AgencyConfig> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const agencyConfigKinds = unique([...agencyConfigBlock.matchAll(/^  ([A-Za-z0-9]+): \{\n    title:/gm)].map((match) => match[1]))

const routePaths = unique([...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])).filter((path) => path !== '*')
const shellPaths = unique([...shellSource.matchAll(/path: '([^']+)'/g)].map((match) => match[1]))
const agencyNavPaths = unique([...agencyNavSource.matchAll(/path: '([^']+)'/g)].map((match) => match[1]))

const missingUnion = routeKinds.filter((kind) => !unionKinds.includes(kind))
const missingConfig = routeKinds.filter((kind) => !configKinds.includes(kind))
const unusedUnion = unionKinds.filter((kind) => !routeKinds.includes(kind))
const unusedConfig = configKinds.filter((kind) => !routeKinds.includes(kind))
const navWithoutRoute = shellPaths.filter((path) => !routePaths.includes(path))
const missingAgencyUnion = agencyRouteKinds.filter((kind) => !agencyUnionKinds.includes(kind))
const missingAgencyConfig = agencyRouteKinds.filter((kind) => !agencyConfigKinds.includes(kind))
const unusedAgencyUnion = agencyUnionKinds.filter((kind) => !agencyRouteKinds.includes(kind))
const agencyNavWithoutRoute = agencyNavPaths.filter((path) => !routePaths.includes(path))
const duplicateAccountRoute = '<Route path="/agency/accounts" element={agencyPage(\'accountManagement\')} />'
const accountRedirectRoute = '<Route path="/agency/accounts" element={<Navigate to="/" replace />} />'

const summary = {
  businessRoutes: routeKinds.length,
  moduleKindUnion: unionKinds.length,
  moduleConfigs: configKinds.length,
  shellNavPaths: shellPaths.length,
  agencyRoutes: agencyRouteKinds.length,
  agencyModuleKindUnion: agencyUnionKinds.length,
  agencyModuleConfigs: agencyConfigKinds.length,
  agencyNavPaths: agencyNavPaths.length,
  appRoutes: routePaths.length,
}

const errors = [
  ...missingUnion.map((kind) => `businessPage kind '${kind}' is missing from ModuleKind`),
  ...missingConfig.map((kind) => `businessPage kind '${kind}' is missing from moduleConfigs`),
  ...unusedUnion.map((kind) => `ModuleKind '${kind}' is not used by any business route`),
  ...unusedConfig.map((kind) => `moduleConfigs kind '${kind}' is not used by any business route`),
  ...navWithoutRoute.map((path) => `sidebar path '${path}' has no matching <Route>`),
  ...missingAgencyUnion.map((kind) => `agencyPage kind '${kind}' is missing from AgencyModuleKind`),
  ...missingAgencyConfig.map((kind) => `agencyPage kind '${kind}' is missing from agency configs`),
  ...unusedAgencyUnion.map((kind) => `AgencyModuleKind '${kind}' is not used by any agency route`),
  ...agencyNavWithoutRoute.map((path) => `agency nav path '${path}' has no matching <Route>`),
  ...(agencyRouteKinds.includes('accountManagement') ? ['duplicate agency account-management page is still routed'] : []),
  ...(agencyUnionKinds.includes('accountManagement') ? ['duplicate accountManagement kind is still declared'] : []),
  ...(agencyConfigKinds.includes('accountManagement') ? ['duplicate accountManagement config is still declared'] : []),
  ...(agencyNavSource.includes("path: '/agency/accounts'") ? ['duplicate account-management item is still in agency navigation'] : []),
  ...(appSource.includes(duplicateAccountRoute) ? ['agency accounts route still renders the duplicate page'] : []),
  ...(!appSource.includes(accountRedirectRoute) ? ['agency accounts route must redirect to the home account-management workspace'] : []),
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
