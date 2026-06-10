import { ImportBase } from '@skmtc/core'
import { List } from './List.ts'
import type { Identifier, EntityTypeValue } from '@skmtc/core'

/**
 * The concise import form a TypeScript generator passes to `register` —
 * `'z'`, `{ User: 'IUser' }` (aliased record), or
 * `{ name, alias?, type? }` (the `type: 'type'` tag drives type-only
 * imports under `verbatimModuleSyntax`). Owned by this package: the
 * concise vocabulary is language-specific, so each `lang-*` package
 * defines its own; the neutral engine never sees it.
 */
export type ImportNameArg =
  | string
  | { [name: string]: string }
  | { name: string; alias?: string; type?: EntityTypeValue }

/**
 * A single imported symbol on a {@link TsImport}.
 *
 * `typeOnly` drives TypeScript's `verbatimModuleSyntax` handling — a
 * per-name `type` keyword, or a statement-level `import type { … }` when
 * every specifier is type-only. `name === '*'` (with an `alias`) is a
 * namespace import (`import * as X from '…'`).
 */
export type TsImportSpecifier = {
  name: string
  alias?: string
  typeOnly: boolean
}

const renderSpecifier = (specifier: TsImportSpecifier): string => {
  const base = specifier.alias ? `${specifier.name} as ${specifier.alias}` : specifier.name
  return specifier.typeOnly ? `type ${base}` : base
}

/**
 * Convert one concise {@link ImportNameArg} (the ergonomic form a TS
 * generator passes — `'z'`, `{ User: 'IUser' }`, `{ name, type: 'type' }`)
 * into a structured {@link TsImportSpecifier}. The concise form lives only
 * at this conversion boundary; everything downstream is structured.
 */
const toSpecifier = (argument: ImportNameArg): TsImportSpecifier => {
  if (typeof argument === 'string') {
    return { name: argument, typeOnly: false }
  }

  if ('name' in argument && typeof argument.name === 'string') {
    return { name: argument.name, alias: argument.alias, typeOnly: argument.type === 'type' }
  }

  const entry = Object.entries(argument)[0]
  if (entry === undefined || typeof entry[1] !== 'string') {
    throw new Error(`Invalid import specifier: ${JSON.stringify(argument)}`)
  }
  return { name: entry[0], alias: entry[1], typeOnly: false }
}

/**
 * TypeScript's concrete {@link ImportBase}: one module's worth of imported
 * symbols. Owns the TS import rendering (per-name `type` tags, the
 * statement-level `import type { … }` shortcut, aliases, and namespace
 * imports) via the shared {@link List} helper, so its output is identical
 * to the engine's legacy `Import`.
 */
export class TsImport extends ImportBase {
  module: string
  specifiers: TsImportSpecifier[]

  constructor(module: string, specifiers: TsImportSpecifier[]) {
    super()
    this.module = module
    this.specifiers = specifiers
  }

  /** Build from the concise `{ module: ImportNameArg[] }` form a generator passes. */
  static fromConcise(module: string, names: ImportNameArg[]): TsImport {
    return new TsImport(module, names.map(toSpecifier))
  }

  /**
   * Build the import of a single {@link Identifier} from `module` — the
   * cross-file import a Driver registers when a generator references a
   * peer's Definition. The identifier's entity type drives `typeOnly`
   * (so a type identifier emits `import { type X }`), matching the
   * engine's `Identifier.toImport()` seam.
   */
  static fromIdentifier(module: string, identifier: Identifier): TsImport {
    return new TsImport(module, [
      { name: identifier.name, typeOnly: identifier.entityType.type === 'type' }
    ])
  }

  override mergeKey(): string {
    return this.module
  }

  override merge(other: ImportBase): ImportBase {
    if (!(other instanceof TsImport)) {
      throw new Error(`Cannot merge a TsImport with a ${other.constructor.name}`)
    }

    // Dedup on the rendered specifier (the encoded form) — matching the
    // engine's legacy `Set<string>` dedup, where `type Foo` and `Foo` are
    // distinct entries.
    const byRendered = new Map<string, TsImportSpecifier>()
    for (const specifier of [...this.specifiers, ...other.specifiers]) {
      byRendered.set(renderSpecifier(specifier), specifier)
    }
    return new TsImport(this.module, [...byRendered.values()])
  }

  override toString(): string {
    const namespace = this.specifiers.find(specifier => specifier.name === '*')
    const named = this.specifiers.filter(specifier => specifier.name !== '*')

    // Statement-level `import type { … }` when there's no namespace and
    // every named import is type-only. The per-name `type` form is equally
    // valid; this is purely the more readable output the engine emits.
    if (named.length > 0 && namespace === undefined && named.every(specifier => specifier.typeOnly)) {
      const names = named.map(specifier =>
        specifier.alias ? `${specifier.name} as ${specifier.alias}` : specifier.name
      )
      return `import type {${names.join(', ')}} from '${this.module}'`
    }

    const importObject =
      named.length > 0 || namespace === undefined ? List.toObject(named.map(renderSpecifier)) : undefined
    const namespaceRender = namespace ? `* as ${namespace.alias}` : undefined
    const importItems = new List([namespaceRender, importObject], { separator: ', ', skipEmpty: true })

    return `import ${importItems} from '${this.module}'`
  }
}
