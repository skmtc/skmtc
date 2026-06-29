import type { GenerateContextType, GeneratorKey, StackTrail } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { List } from './List.ts'

/** A heritage symbol — its name and the path it is exported from. */
export type TsHeritageSymbol = {
  name: string
  /** The path `name` is exported from (the import source — `normalizeModuleName`'s
   *  `exportPath`). **Required** — a heritage symbol always declares where it
   *  lives; whether it actually needs importing is decided centrally during
   *  registration (`register` drops a symbol whose source is the class's own
   *  file — it is already in scope). */
  exportPath: string
}

/**
 * Constructor arguments for {@link TsHeritage}.
 */
export type TsHeritageArgs = {
  context: GenerateContextType
  /** The file the class is rendered into — where the heritage imports register
   *  (`normalizeModuleName`'s `destinationPath`). Required: it is always known
   *  (the class's own path), and the imports can't land without it. */
  destinationPath: string
  /** The superclass — rendered as `extends <name>`. */
  extends?: TsHeritageSymbol
  /** The interfaces — rendered as `implements <A>, <B>`. */
  implements?: TsHeritageSymbol[]
  /** Optional attribution (gen-maps) inputs. */
  generatorKey?: GeneratorKey
  stackTrail?: StackTrail
}

/**
 * A class's full heritage — the `extends` clause followed by the `implements`
 * clause — owning both its rendering and the imports of the symbols it names.
 * A {@link TsSnippet} (a *leaf* entity): it registers the superclass as a
 * **value** import and each interface as a **type-only** import into
 * `destinationPath` (the class's file). It registers unconditionally — the
 * same-file case (a symbol whose `exportPath` is `destinationPath`, already in
 * scope) is dropped centrally by `register`, so this entity needs no such check.
 * {@link TsClass} holds one of these and renders it straight onto the `{`; the
 * trailing space is built in.
 */
export class TsHeritage extends TsSnippet {
  superclass: TsHeritageSymbol | undefined
  interfaces: TsHeritageSymbol[]

  constructor(args: TsHeritageArgs) {
    super({ context: args.context, generatorKey: args.generatorKey, stackTrail: args.stackTrail })

    const { destinationPath } = args

    this.superclass = args.extends
    this.interfaces = args.implements ?? []

    // Register each heritage symbol — the superclass as a value import, each
    // interface as type-only. `register` drops any whose source is this same
    // file (already in scope), so no same-file check here. One register per
    // symbol; `TsFile.addImports` merges any that share a module.
    if (this.superclass !== undefined) {
      this.register({ imports: { [this.superclass.exportPath]: [this.superclass.name] }, destinationPath })
    }

    for (const { name, exportPath } of this.interfaces) {
      this.register({ imports: { [exportPath]: [{ name, type: 'type' }] }, destinationPath })
    }
  }

  override toString(): string {
    const extendsClause = this.superclass ? `extends ${this.superclass.name} ` : ''
    const implementsClause = this.interfaces.length
      ? `implements ${new List(this.interfaces.map(entry => entry.name))} `
      : ''

    return `${extendsClause}${implementsClause}`
  }
}
