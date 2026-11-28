/**
 * The folder that the app's `@/` import alias points to.
 *
 * Generated files import each other through `@/` (`@/types/pet.generated.ts`),
 * so those imports resolve only when a project's `basePath` is that folder.
 * The CLI cannot read a bundler's config, but most apps state the alias in a
 * file it can read: `compilerOptions.paths` of a tsconfig, or the import map
 * of a `deno.json`. `init` proposes the folder from it, and `doctor` checks
 * a project's `basePath` against it.
 *
 * A tsconfig's `baseUrl` is read through `extends`, because `paths` resolve
 * from it. A package that `extends` names is looked up in the `node_modules`
 * of the config's folder and of each folder above it, as in a monorepo that
 * hoists its packages. What this does not read: `paths` that only an
 * extended config holds, and an alias that only a bundler config holds
 * (`vite.config.ts`, `webpack.config.js`). For those the answer is "none",
 * and for an extended config that cannot be read it is "unreadable", never a
 * guess.
 *
 * An alias to a folder outside the app root is "outside": `basePath` is a
 * forward path below the root, so no `basePath` can be that folder.
 */

import { hasParentSegment, isAbsolutePath } from '@skmtc/core'
import { parse } from '@std/jsonc'
import { existsSync } from '@std/fs/exists'
import { dirname } from '@std/path/dirname'
import { isAbsolute } from '@std/path/is-absolute'
import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { resolve } from '@std/path/resolve'
import { normalize } from '@std/path/posix/normalize'

export type AliasRoot = {
  /** The folder, from the app root, with no `./` and no trailing slash. `.` is the root. */
  path: string
  /** The file that states the alias, such as `tsconfig.json`. */
  from: string
}

/** What the app's files say about the `@/` alias. */
export type AliasSearch =
  | { type: 'found'; aliasRoot: AliasRoot }
  /**
   * The alias points to a folder outside the app root, such as
   * `../shared/src`. `basePath` has no `..` segment, so it cannot be it.
   */
  | { type: 'outside'; target: string; from: string }
  /** `from` extends a config that cannot be read, and that config may set a `baseUrl`. */
  | { type: 'unreadable'; extended: string; from: string }
  /** No file states an `@/` alias. */
  | { type: 'none' }

type FindAliasRootArgs = {
  /** The folder that holds `.skmtc/`. */
  appRootPath: string
}

type ReadAliasArgs = {
  config: unknown
  appRootPath: string
}

/** The absolute folder an alias points to, as one config file states it. */
type ReadResult =
  | { type: 'folder'; folder: string }
  | { type: 'unreadable'; extended: string }
  | { type: 'none' }

type AliasReader = {
  fileName: string
  read: (args: ReadAliasArgs) => ReadResult
}

type FindBaseUrlArgs = {
  config: unknown
  /** The folder of the config file. */
  dir: string
  /** The folder of the config that the chain starts at: what `${configDir}` means. */
  configDir: string
  /** How many `extends` were followed to reach this config. */
  depth: number
}

/** The folder that `paths` resolve from, as far as the configs on disk say. */
type BaseUrlSearch =
  | { type: 'found'; folder: string }
  /** No config of the chain sets a `baseUrl`. */
  | { type: 'none' }
  /** A config of the chain cannot be read, and it may set a `baseUrl`. */
  | { type: 'unreadable'; extended: string }

type ToExtendedPathArgs = {
  /** A value of `extends`: `./tsconfig.base.json`, `astro/tsconfigs/strict`. */
  name: string
  dir: string
  configDir: string
}

// A chain longer than this is a cycle.
const MAX_EXTENDS_DEPTH = 8

// The conditions of a package's `exports` that TypeScript reads for a config.
const EXPORT_CONDITIONS = ['types', 'require', 'import', 'default']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A folder as the comparison reads it: `./src/` and `src` are one folder.
 *
 * The separator is always `/`. `basePath` is a value of `client.json`, which
 * a team shares across machines, and the platform's `join` writes `app\src`
 * on Windows.
 */
export const toFolder = (path: string): string => {
  const folder = normalize(path.replaceAll('\\', '/')).replace(/\/+$/, '')

  return folder === '' ? '.' : folder
}

const isFile = (path: string): boolean => {
  try {
    return Deno.statSync(path).isFile
  } catch {
    return false
  }
}

const isDirectory = (path: string): boolean => {
  try {
    return Deno.statSync(path).isDirectory
  } catch {
    return false
  }
}

/** The file's content, or `undefined` when it is missing or does not parse. */
const readConfig = (path: string): unknown => {
  if (!existsSync(path)) {
    return undefined
  }

  try {
    return parse(Deno.readTextFileSync(path))
  } catch {
    return undefined
  }
}

const toCompilerOptions = (config: unknown): Record<string, unknown> | undefined => {
  const options = isRecord(config) ? config.compilerOptions : undefined

  return isRecord(options) ? options : undefined
}

/** A path of a tsconfig, with `${configDir}` replaced as TypeScript does. */
const toConfigPath = (path: string, configDir: string): string =>
  path.replaceAll('${configDir}', configDir)

/** The configs that `extends` names, last first: a later one wins. */
const toExtendedNames = (config: unknown): string[] => {
  const value = isRecord(config) ? config.extends : undefined
  const names: unknown[] = Array.isArray(value) ? value : [value]

  return names.filter(name => typeof name === 'string').reverse()
}

/** The `node_modules` folders that a package is looked up in: the folder's, then each one above. */
const toNodeModulesDirs = (dir: string): string[] => {
  const parent = dirname(dir)

  return [join(dir, 'node_modules'), ...(parent === dir ? [] : toNodeModulesDirs(parent))]
}

/** The file of one value of `exports`: a string, or the first condition that has one. */
const toExportTarget = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value
  }

  return isRecord(value)
    ? EXPORT_CONDITIONS.map(condition => toExportTarget(value[condition])).find(
        target => target !== undefined
      )
    : undefined
}

/** The file that `exports` gives for a subpath (`./tsconfigs/strict`), with `*` patterns. */
const toExportsEntry = (exports: unknown, subpath: string): string | undefined => {
  const key = subpath === '' ? '.' : `./${subpath}`

  if (!isRecord(exports)) {
    return key === '.' ? toExportTarget(exports) : undefined
  }

  // An `exports` with no `.` keys is the conditions of the package itself.
  if (Object.keys(exports).every(name => !name.startsWith('.'))) {
    return key === '.' ? toExportTarget(exports) : undefined
  }

  if (key in exports) {
    return toExportTarget(exports[key])
  }

  return Object.entries(exports)
    .flatMap(([pattern, value]) => {
      const [prefix, suffix, ...rest] = pattern.split('*')
      const matches =
        suffix !== undefined &&
        rest.length === 0 &&
        key.length >= prefix.length + suffix.length &&
        key.startsWith(prefix) &&
        key.endsWith(suffix)
      const target = matches ? toExportTarget(value) : undefined

      return target === undefined
        ? []
        : [target.replaceAll('*', key.slice(prefix.length, key.length - suffix.length))]
    })
    .at(0)
}

/** A config file at a path, at `<path>.json` or at `<path>/tsconfig.json`. */
const toConfigFile = (base: string): string | undefined =>
  [base, `${base}.json`, join(base, 'tsconfig.json')].find(isFile)

/** The config file of a package that `extends` names, in one package folder. */
const toPackageConfigFile = (packageDir: string, subpath: string): string | undefined => {
  const packageJson = readConfig(join(packageDir, 'package.json'))
  const exportsEntry = isRecord(packageJson)
    ? toExportsEntry(packageJson.exports, subpath)
    : undefined
  const tsconfigField =
    subpath === '' && isRecord(packageJson) && typeof packageJson.tsconfig === 'string'
      ? packageJson.tsconfig
      : undefined

  return [exportsEntry, tsconfigField]
    .flatMap(entry => (entry === undefined ? [] : [join(packageDir, entry)]))
    .concat(toConfigFile(join(packageDir, subpath)) ?? [])
    .find(isFile)
}

/**
 * The file that a value of `extends` names: a path from the folder of the
 * config, an absolute path, or a package in a `node_modules` of the config's
 * folder or a folder above it. `undefined` when no such file is on disk.
 */
const toExtendedPath = ({ name, dir, configDir }: ToExtendedPathArgs): string | undefined => {
  const path = toConfigPath(name, configDir)

  if (path.startsWith('.') || isAbsolute(path)) {
    return toConfigFile(resolve(dir, path))
  }

  const segments = path.split('/')
  const nameLength = path.startsWith('@') ? 2 : 1
  const packageName = segments.slice(0, nameLength).join('/')
  const subpath = segments.slice(nameLength).join('/')

  return toNodeModulesDirs(dir)
    .map(nodeModules => join(nodeModules, packageName))
    .filter(isDirectory)
    .map(packageDir => toPackageConfigFile(packageDir, subpath))
    .find(file => file !== undefined)
}

/**
 * The `baseUrl` that applies to a config: its own, or the one of the first
 * config it extends that sets one.
 */
const findBaseUrl = ({ config, dir, configDir, depth }: FindBaseUrlArgs): BaseUrlSearch => {
  const baseUrl = toCompilerOptions(config)?.baseUrl

  if (typeof baseUrl === 'string') {
    // `resolve`, not `join`: an absolute `baseUrl` is that folder.
    return {
      type: 'found',
      folder: resolve(dir, toConfigPath(baseUrl, configDir))
    }
  }

  const names = toExtendedNames(config)

  if (depth > MAX_EXTENDS_DEPTH) {
    return { type: 'unreadable', extended: names.at(0) ?? '' }
  }

  return names.reduce<BaseUrlSearch>(
    (search, name) => {
      if (search.type !== 'none') {
        return search
      }

      const path = toExtendedPath({ name, dir, configDir })
      const extended = path === undefined ? undefined : readConfig(path)

      return path === undefined || extended === undefined
        ? { type: 'unreadable', extended: name }
        : findBaseUrl({
            config: extended,
            dir: dirname(path),
            configDir,
            depth: depth + 1
          })
    },
    { type: 'none' }
  )
}

/**
 * `compilerOptions.paths["@/*"]`, read from the `baseUrl` that applies.
 * With no `baseUrl`, `paths` resolve from the folder of the config.
 */
const toTsconfigAlias = ({ config, appRootPath }: ReadAliasArgs): ReadResult => {
  const paths = toCompilerOptions(config)?.paths
  const targets = isRecord(paths) ? paths['@/*'] : undefined
  const [target] = Array.isArray(targets) ? targets : []

  if (typeof target !== 'string' || !target.endsWith('/*')) {
    return { type: 'none' }
  }

  const search = findBaseUrl({
    config,
    dir: appRootPath,
    configDir: appRootPath,
    depth: 0
  })

  if (search.type === 'unreadable') {
    return search
  }

  const base = search.type === 'found' ? search.folder : appRootPath

  // `resolve`, not `join`: an absolute target is that folder.
  return {
    type: 'folder',
    folder: resolve(base, toConfigPath(target.slice(0, -2), appRootPath))
  }
}

/** `imports["@/"]` of a Deno import map. */
const toDenoAlias = ({ config, appRootPath }: ReadAliasArgs): ReadResult => {
  const imports = isRecord(config) ? config.imports : undefined
  const target = isRecord(imports) ? imports['@/'] : undefined

  return typeof target === 'string' && target.startsWith('.')
    ? { type: 'folder', folder: resolve(appRootPath, target) }
    : { type: 'none' }
}

// In the order an app is most likely to state its alias. A Vite app keeps
// `paths` in `tsconfig.app.json`, beside a `tsconfig.json` that has none.
const ALIAS_READERS: AliasReader[] = [
  { fileName: 'tsconfig.json', read: toTsconfigAlias },
  { fileName: 'tsconfig.app.json', read: toTsconfigAlias },
  { fileName: 'jsconfig.json', read: toTsconfigAlias },
  { fileName: 'deno.json', read: toDenoAlias },
  { fileName: 'deno.jsonc', read: toDenoAlias }
]

export const ALIAS_FILE_NAMES: string[] = ALIAS_READERS.map(reader => reader.fileName)

type ToAliasSearchArgs = {
  result: ReadResult
  from: string
  appRootPath: string
}

const toAliasSearch = ({ result, from, appRootPath }: ToAliasSearchArgs): AliasSearch => {
  switch (result.type) {
    case 'none':
      return { type: 'none' }
    case 'unreadable':
      return { type: 'unreadable', extended: result.extended, from }
    case 'folder': {
      // On Windows, a folder on another drive has no relative path: `relative` gives it whole.
      const path = toFolder(relative(appRootPath, result.folder))

      return isAbsolutePath(path) || hasParentSegment(path)
        ? { type: 'outside', target: path, from }
        : { type: 'found', aliasRoot: { path, from } }
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled alias read: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/**
 * What the first file that states an `@/` alias says. A file whose
 * extended config cannot be read gives way to a later file that states
 * one, and is the answer only when no later file does.
 */
export const findAliasRoot = ({ appRootPath }: FindAliasRootArgs): AliasSearch => {
  const searches = ALIAS_READERS.map(({ fileName, read }) =>
    toAliasSearch({
      result: read({
        config: readConfig(join(appRootPath, fileName)),
        appRootPath
      }),
      from: fileName,
      appRootPath
    })
  )

  return (
    searches.find(search => search.type === 'found' || search.type === 'outside') ??
    searches.find(search => search.type === 'unreadable') ?? { type: 'none' }
  )
}

/** The folder of a search that found a usable one, or `undefined`. */
export const toFoundAliasRoot = (search: AliasSearch): AliasRoot | undefined =>
  search.type === 'found' ? search.aliasRoot : undefined

/**
 * Why a search gives no folder to compare `basePath` with, for a search
 * that found an alias it cannot use. `undefined` for `found` and `none`.
 */
export const toAliasUnusableText = (search: AliasSearch): string | undefined => {
  switch (search.type) {
    case 'outside':
      return (
        `"@/" points to "${search.target}" (${search.from}), a folder outside the folder that holds .skmtc/. ` +
        'basePath must be a forward path below that folder, with no ".." segment, so it cannot be ' +
        `"${search.target}". Run skmtc in a folder that holds "${search.target}", or point "@/" at a folder below this one.`
      )
    case 'unreadable':
      return (
        `${search.from} extends "${search.extended}", and skmtc could not read that config, ` +
        'so it cannot tell where "@/" points. Install the package that holds it, or repair the path.'
      )
    case 'found':
    case 'none':
      return undefined
    default: {
      const _exhaustive: never = search
      throw new Error(`Unhandled alias search: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** Whether `basePath` is the folder the alias points to. */
export const isAliasRoot = (basePath: string, aliasRoot: AliasRoot): boolean =>
  toFolder(basePath) === aliasRoot.path

type AliasMismatchArgs = {
  aliasRoot: AliasRoot
  basePath: string
  projectName: string
}

/** What `init` says when `basePath` is not the folder the alias points to. */
export const toAliasMismatchText = ({
  aliasRoot,
  basePath,
  projectName
}: AliasMismatchArgs): string =>
  `Warning: "@/" points to "${aliasRoot.path}" (${aliasRoot.from}), not to "${basePath}". ` +
  'Generated files import each other through "@/", so those imports resolve only when ' +
  `the two are one folder. Set settings.basePath to "${aliasRoot.path}" in ` +
  `.skmtc/${projectName}/.settings/skmtc.config.json, or point "@/" at "${basePath}".`
