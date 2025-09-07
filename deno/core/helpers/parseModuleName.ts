/**
 * Represents the parsed components of a module name.
 * 
 * This type breaks down a module name into its constituent parts,
 * supporting various formats used in different package managers
 * and registries (npm, JSR, Deno, etc.).
 * 
 * @example
 * ```typescript
 * // For 'jsr:@std/path@1.0.0'
 * const parsed: ParsedModuleName = {
 *   scheme: 'jsr',
 *   scopeName: '@std',
 *   packageName: 'path',
 *   version: '1.0.0'
 * };
 * ```
 */
export type ParsedModuleName = {
  /** The module scheme (e.g., 'npm', 'jsr', 'https') */
  scheme: string | null
  /** The scope name for scoped packages (e.g., '@std', '@company') */
  scopeName: string | null
  /** The package name (the main identifier) */
  packageName: string
  /** The version specifier (e.g., '1.0.0', '^2.3.4') */
  version: string | null
}

/**
 * Parses a module name string into its component parts.
 * 
 * This utility function decomposes module names from various formats into
 * structured components, handling schemes, scopes, versions, and package names.
 * It supports formats used by npm, JSR, Deno, and other package managers.
 * 
 * The parser handles complex module name patterns including:
 * - Scheme prefixes (jsr:, npm:, https:)
 * - Scoped packages (@scope/package)
 * - Version specifiers (@version)
 * - Combinations of the above
 * 
 * @param moduleName - The module name string to parse
 * @returns Parsed components of the module name
 * 
 * @example Basic package names
 * ```typescript
 * import { parseModuleName } from '@skmtc/core';
 * 
 * // Simple package name
 * const simple = parseModuleName('lodash');
 * // {
 * //   scheme: null,
 * //   scopeName: null,
 * //   packageName: 'lodash',
 * //   version: null
 * // }
 * 
 * // Package with version
 * const versioned = parseModuleName('lodash@4.17.21');
 * // {
 * //   scheme: null,
 * //   scopeName: null,
 * //   packageName: 'lodash',
 * //   version: '4.17.21'
 * // }
 * ```
 * 
 * @example Scoped packages
 * ```typescript
 * // Scoped package
 * const scoped = parseModuleName('@company/utils');
 * // {
 * //   scheme: null,
 * //   scopeName: '@company',
 * //   packageName: 'utils',
 * //   version: null
 * // }
 * 
 * // Scoped package with version
 * const scopedVersioned = parseModuleName('@company/utils@2.0.0');
 * // {
 * //   scheme: null,
 * //   scopeName: '@company',
 * //   packageName: 'utils',
 * //   version: '2.0.0'
 * // }
 * ```
 * 
 * @example Scheme-prefixed modules
 * ```typescript
 * // JSR module
 * const jsrModule = parseModuleName('jsr:@std/path@1.0.0');
 * // {
 * //   scheme: 'jsr',
 * //   scopeName: '@std',
 * //   packageName: 'path',
 * //   version: '1.0.0'
 * // }
 * 
 * // npm module with scheme
 * const npmModule = parseModuleName('npm:lodash@^4.17.0');
 * // {
 * //   scheme: 'npm',
 * //   scopeName: null,
 * //   packageName: 'lodash',
 * //   version: '^4.17.0'
 * // }
 * 
 * // HTTPS module
 * const httpsModule = parseModuleName('https:example.com/package@v1.2.3');
 * // {
 * //   scheme: 'https',
 * //   scopeName: null,
 * //   packageName: 'example.com/package',
 * //   version: 'v1.2.3'
 * // }
 * ```
 * 
 * @example Complex parsing scenarios
 * ```typescript
 * // Multiple levels in package name
 * const nested = parseModuleName('npm:@babel/plugin-transform-runtime@^7.0.0');
 * // {
 * //   scheme: 'npm',
 * //   scopeName: '@babel',
 * //   packageName: 'plugin-transform-runtime',
 * //   version: '^7.0.0'
 * // }
 * 
 * // Version ranges and pre-release versions
 * const prerelease = parseModuleName('jsr:@deno/std@1.0.0-rc.1');
 * // {
 * //   scheme: 'jsr',
 * //   scopeName: '@deno',
 * //   packageName: 'std',
 * //   version: '1.0.0-rc.1'
 * // }
 * ```
 * 
 * @example Usage in dependency management
 * ```typescript
 * class DependencyManager {
 *   processDependency(moduleSpec: string) {
 *     const parsed = parseModuleName(moduleSpec);
 *     
 *     console.log(`Processing ${parsed.packageName}`);
 *     
 *     if (parsed.scheme) {
 *       console.log(`Using ${parsed.scheme} registry`);
 *     }
 *     
 *     if (parsed.scopeName) {
 *       console.log(`Scoped package: ${parsed.scopeName}/${parsed.packageName}`);
 *     }
 *     
 *     if (parsed.version) {
 *       console.log(`Version constraint: ${parsed.version}`);
 *     }
 *     
 *     return this.resolvePackage(parsed);
 *   }
 * }
 * ```
 * 
 * @example Building module URLs
 * ```typescript
 * function buildModuleUrl(moduleSpec: string): string {
 *   const parsed = parseModuleName(moduleSpec);
 *   
 *   switch (parsed.scheme) {
 *     case 'jsr':
 *       return `https://jsr.io/${parsed.scopeName}/${parsed.packageName}`;
 *     case 'npm':
 *       const scope = parsed.scopeName ? `${parsed.scopeName}/` : '';
 *       return `https://npmjs.com/package/${scope}${parsed.packageName}`;
 *     default:
 *       return `https://deno.land/x/${parsed.packageName}`;
 *   }
 * }
 * ```
 */
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
