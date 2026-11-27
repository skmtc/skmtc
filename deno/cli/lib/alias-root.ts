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
 * What this does not read: a tsconfig's `extends`, and an alias that only a
 * bundler config holds (`vite.config.ts`, `webpack.config.js`). For those
 * the answer is "not found", never a guess.
 */

import { parse } from '@std/jsonc'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { normalize } from '@std/path/normalize'

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

type AliasReader = {
  fileName: string
  read: (config: unknown) => string | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A folder as the comparison reads it: `./src/` and `src` are one folder. */
export const toFolder = (path: string): string => {
  const folder = normalize(path).replace(/[\\/]+$/, '')

  return folder === '' ? '.' : folder
}

/** `compilerOptions.paths["@/*"]`, read from its `baseUrl`. */
const toTsconfigAlias = (config: unknown): string | undefined => {
  const options = isRecord(config) ? config.compilerOptions : undefined
  const paths = isRecord(options) ? options.paths : undefined
  const targets = isRecord(paths) ? paths['@/*'] : undefined
  const [target] = Array.isArray(targets) ? targets : []

  if (typeof target !== 'string' || !target.endsWith('/*')) {
    return undefined
  }

  const baseUrl = isRecord(options) && typeof options.baseUrl === 'string' ? options.baseUrl : '.'

  return toFolder(join(baseUrl, target.slice(0, -2)))
}

/** `imports["@/"]` of a Deno import map. */
const toDenoAlias = (config: unknown): string | undefined => {
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

/** The alias root from the first file that states one, or `undefined`. */
export const findAliasRoot = ({ appRootPath }: FindAliasRootArgs): AliasRoot | undefined =>
  ALIAS_READERS.flatMap(({ fileName, read }) => {
    const path = read(readConfig(join(appRootPath, fileName)))

    return path === undefined ? [] : [{ path, from: fileName }]
  }).at(0)

/** Whether `basePath` is the folder the alias points to. */
export const isAliasRoot = (basePath: string, aliasRoot: AliasRoot): boolean =>
  toFolder(basePath) === aliasRoot.path
