export type ParsedModuleName = {
  scheme: string | null
  scopeName: string | null
  packageName: string
  version: string | null
}

export const parseModuleName = (moduleName: string): ParsedModuleName => {
  const result: ParsedModuleName = {
    scheme: null,
    scopeName: null,
    packageName: moduleName,
    version: null
  }

  let nameWithoutScheme = moduleName

  const schemeMatch = moduleName.match(/^([a-z]+):(.+)/)

  if (schemeMatch) {
    result.scheme = schemeMatch[1]
    nameWithoutScheme = schemeMatch[2]
  }

  const versionMatch = nameWithoutScheme.match(/^(.+)@([^@]+)$/)
  if (versionMatch) {
    nameWithoutScheme = versionMatch[1]
    result.version = versionMatch[2]
  }

  const scopeMatch = nameWithoutScheme.match(/^([^/]+)\/(.+)$/)
  if (scopeMatch) {
    result.scopeName = scopeMatch[1]
    result.packageName = scopeMatch[2]
  } else {
    result.packageName = nameWithoutScheme
  }

  return result
}
