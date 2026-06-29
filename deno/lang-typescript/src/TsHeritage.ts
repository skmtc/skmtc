import type { GenerateContextType, GeneratorKey, StackTrail } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { List } from './List.ts'

/** A heritage symbol — its name and the path it is exported from. */
export type TsHeritageSymbol = {
  name: string
  /** The path `name` is exported from (the import source — `normalizeModuleName`'s
   *  `exportPath`). **Required** — a heritage symbol always declares where it
   *  lives; whether it needs importing is decided centrally, by comparing this
   *  to the class's own file (see {@link TsHeritage}). */
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
 * `destinationPath` (the class's file) — **except** a symbol that is already in
 * that same file (its `exportPath` equals `destinationPath`), which is in scope
 * and needs none. That same-file check is done here, once, rather than asked of
 * every caller — the rule the Driver applies for peer imports. {@link TsClass}
 * holds one of these and renders it straight onto the `{`; the trailing space is
 * built in.
 */
export class TsHeritage extends TsSnippet {
  superclass: TsHeritageSymbol | undefined
  interfaces: TsHeritageSymbol[]

  constructor(args: TsHeritageArgs) {
    super({ context: args.context, generatorKey: args.generatorKey, stackTrail: args.stackTrail })

    const { destinationPath } = args

    this.superclass = args.extends
    this.interfaces = args.implements ?? []

    // Import each heritage symbol that lives in a *different* file — the
    // superclass as a value import, each interface as type-only. A symbol whose
    // `exportPath` is the class's own file is already in scope, no import. One
    // register per symbol; `TsFile.addImports` merges any that share a module.
    if (this.superclass !== undefined && this.superclass.exportPath !== destinationPath) {
      this.register({ imports: { [this.superclass.exportPath]: [this.superclass.name] }, destinationPath })
    }

    for (const { name, exportPath } of this.interfaces) {
      if (exportPath !== destinationPath) {
        this.register({ imports: { [exportPath]: [{ name, type: 'type' }] }, destinationPath })
      }
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
