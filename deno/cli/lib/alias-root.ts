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
 * from it. What this does not read: `paths` that only an extended config
 * holds, and an alias that only a bundler config holds (`vite.config.ts`,
 * `webpack.config.js`). For those, and for an extended config that cannot
 * be read (a package that is not installed), the answer is "not found",
 * never a guess.
 */

import { parse } from '@std/jsonc'
import { existsSync } from '@std/fs/exists'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { join as joinPosix } from '@std/path/posix/join'
import { normalize } from '@std/path/posix/normalize'

export type AliasRoot = {
  /** The folder, from the app root, with no `./` and no trailing slash. `.` is the root. */
  path: string
  /** The file that states the alias, such as `tsconfig.json`. */
  from: string
}

type FindAliasRootArgs = {
  /** The folder that holds `.skmtc/`. */
  appRootPath: string
}

type ReadAliasArgs = {
  config: unknown
  appRootPath: string
}

type AliasReader = {
  fileName: string
  read: (args: ReadAliasArgs) => string | undefined
}

type FindBaseUrlArgs = {
  config: unknown
  /** The folder of the config file. */
  dir: string
  appRootPath: string
  /** How many `extends` were followed to reach this config. */
  depth: number
}

/** The folder that `paths` resolve from, as far as the configs on disk say. */
type BaseUrlSearch =
  | { type: 'found'; folder: string }
  /** No config of the chain sets a `baseUrl`. */
  | { type: 'none' }
  /** A config of the chain cannot be read, and it may set a `baseUrl`. */
  | { type: 'unreadable' }

type ToExtendedPathArgs = {
  /** A value of `extends`: `./tsconfig.base.json`, `astro/tsconfigs/strict`. */
  name: string
  dir: string
  appRootPath: string
}

// A chain longer than this is a cycle.
const MAX_EXTENDS_DEPTH = 8

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

/** The configs that `extends` names, last first: a later one wins. */
const toExtendedNames = (config: unknown): string[] => {
  const value = isRecord(config) ? config.extends : undefined
  const names: unknown[] = Array.isArray(value) ? value : [value]

  return names.filter(name => typeof name === 'string').reverse()
}

/**
 * The file that a value of `extends` names: a path from the folder of the
 * config, or a package under the app's `node_modules`. `undefined` when no
 * such file is on disk.
 */
const toExtendedPath = ({ name, dir, appRootPath }: ToExtendedPathArgs): string | undefined => {
  const base = name.startsWith('.') ? join(dir, name) : join(appRootPath, 'node_modules', name)

  return [base, `${base}.json`, join(base, 'tsconfig.json')].find(isFile)
}

/**
 * The `baseUrl` that applies to a config: its own, or the one of the first
 * config it extends that sets one.
 */
const findBaseUrl = ({ config, dir, appRootPath, depth }: FindBaseUrlArgs): BaseUrlSearch => {
  const baseUrl = toCompilerOptions(config)?.baseUrl

  if (typeof baseUrl === 'string') {
    return { type: 'found', folder: join(dir, baseUrl) }
  }

  if (depth > MAX_EXTENDS_DEPTH) {
    return { type: 'unreadable' }
  }

  return toExtendedNames(config).reduce<BaseUrlSearch>(
    (search, name) => {
      if (search.type !== 'none') {
        return search
      }

      const path = toExtendedPath({ name, dir, appRootPath })
      const extended = path === undefined ? undefined : readConfig(path)

      return path === undefined || extended === undefined
        ? { type: 'unreadable' }
        : findBaseUrl({ config: extended, dir: dirname(path), appRootPath, depth: depth + 1 })
    },
    { type: 'none' }
  )
}

/**
 * `compilerOptions.paths["@/*"]`, read from the `baseUrl` that applies.
 * With no `baseUrl`, `paths` resolve from the folder of the config.
 */
const toTsconfigAlias = ({ config, appRootPath }: ReadAliasArgs): string | undefined => {
  const paths = toCompilerOptions(config)?.paths
  const targets = isRecord(paths) ? paths['@/*'] : undefined
  const [target] = Array.isArray(targets) ? targets : []

  if (typeof target !== 'string' || !target.endsWith('/*')) {
    return undefined
  }

  const search = findBaseUrl({ config, dir: appRootPath, appRootPath, depth: 0 })

  if (search.type === 'unreadable') {
    return undefined
  }

  const base = search.type === 'found' ? toFolder(relative(appRootPath, search.folder)) : '.'

  return toFolder(joinPosix(base, target.slice(0, -2)))
}

/** `imports["@/"]` of a Deno import map. */
const toDenoAlias = ({ config }: ReadAliasArgs): string | undefined => {
  const imports = isRecord(config) ? config.imports : undefined
  const target = isRecord(imports) ? imports['@/'] : undefined

  return typeof target === 'string' && target.startsWith('.') ? toFolder(target) : undefined
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

/** The alias root from the first file that states one, or `undefined`. */
export const findAliasRoot = ({ appRootPath }: FindAliasRootArgs): AliasRoot | undefined =>
  ALIAS_READERS.flatMap(({ fileName, read }) => {
    const path = read({ config: readConfig(join(appRootPath, fileName)), appRootPath })

    return path === undefined ? [] : [{ path, from: fileName }]
  }).at(0)

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
