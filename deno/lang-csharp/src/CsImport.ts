import { ImportBase } from '@skmtc/core'
import type { Identifier } from '@skmtc/core'
import { toNamespaceName } from './toNamespaceName.ts'

/**
 * The concise import form a C# generator passes to `register` —
 * `'JsonElement'` or `{ name: 'Money', alias: 'SharedMoney' }`. Owned by
 * this package: the concise vocabulary is language-specific; the neutral
 * engine never sees it. No `type` tag — C# has no type-only imports.
 *
 * The symbol level exists at the REGISTER boundary only (dedup
 * bookkeeping + alias support, D8); rendering collapses to
 * namespace-level `using` directives — see {@link CsImport.toLines}.
 */
export type CsImportNameArg = string | { name: string; alias?: string }

/** A single imported symbol on a {@link CsImport}. */
export type CsImportSpecifier = {
  name: string
  alias?: string
}

const toSpecifier = (argument: CsImportNameArg): CsImportSpecifier => {
  return typeof argument === 'string'
    ? { name: argument }
    : { name: argument.name, alias: argument.alias }
}

const specifierKey = (specifier: CsImportSpecifier): string => {
  return specifier.alias ? `${specifier.name} as ${specifier.alias}` : specifier.name
}

/**
 * C#'s concrete {@link ImportBase}: one module's worth of imported
 * symbols. The `module` takes two forms, distinguished by shape:
 *
 * - a dotted namespace (`'System.Text.Json'`) — BCL or external
 *   libraries, generator-registered;
 * - an `@/`-export-path (`'@/Acme/Api/Models/User.generated.cs'`) —
 *   project files; this is what the Driver passes for cross-file peer
 *   imports.
 *
 * The path form resolves to its namespace via {@link toNamespaceName} at
 * render time ({@link resolvedNamespace});
 * {@link import('./CsFile.ts').CsFile} uses the same resolution to
 * suppress same-namespace imports (same-namespace symbols need no
 * `using` in C# — in the common single-`baseNamespace` project every
 * peer using vanishes, the Kotlin analog).
 *
 * Rendering is namespace-level: the plain specifiers collapse to ONE
 * `using <namespace>;` regardless of how many symbols ride it; an
 * aliased specifier renders the per-symbol alias-using form
 * (`using Alias = Ns.Type;` — the manual seam for cross-namespace name
 * collisions, D8).
 */
export class CsImport extends ImportBase {
  module: string
  specifiers: CsImportSpecifier[]

  constructor(module: string, specifiers: CsImportSpecifier[]) {
    super()
    this.module = module
    this.specifiers = specifiers
  }

  /** Build from the concise `{ module: CsImportNameArg[] }` form a generator passes. */
  static fromConcise(module: string, names: CsImportNameArg[]): CsImport {
    return new CsImport(module, names.map(toSpecifier))
  }

  /**
   * Build the import of a single {@link Identifier} from `module` — the
   * cross-file import a Driver registers when a generator references a
   * peer's Definition. The identifier's `kind` is ignored: every C#
   * using has the same form.
   */
  static fromIdentifier(module: string, identifier: Identifier): CsImport {
    return new CsImport(module, [{ name: identifier.name }])
  }

  /**
   * The namespace this import's symbols come from: a path-form module
   * (contains `/`) derives via {@link toNamespaceName}; a dotted
   * namespace passes through.
   */
  resolvedNamespace(): string {
    return this.module.includes('/') ? toNamespaceName(this.module) : this.module
  }

  override mergeKey(): string {
    return this.module
  }

  override merge(other: ImportBase): ImportBase {
    if (!(other instanceof CsImport)) {
      throw new Error(`Cannot merge a CsImport with a ${other.constructor.name}`)
    }

    const byKey = new Map<string, CsImportSpecifier>()
    for (const specifier of [...this.specifiers, ...other.specifiers]) {
      byKey.set(specifierKey(specifier), specifier)
    }

    return new CsImport(this.module, [...byKey.values()])
  }

  /**
   * The rendered `using` lines: one `using <namespace>;` when any plain
   * specifier exists, plus one `using <Alias> = <namespace>.<Name>;` per
   * aliased specifier.
   *
   * A module resolving to the GLOBAL namespace (a root-level artifact)
   * renders nothing — unlike Kotlin's default package (which cannot be
   * imported from, so KtImport throws), C#'s global-namespace types are
   * visible everywhere without a using; suppression is correct, not an
   * error. In practice gen output is always namespaced (`baseNamespace`
   * is required), so this path covers hand-registered edge cases.
   */
  toLines(): string[] {
    const namespaceName = this.resolvedNamespace()

    if (namespaceName === '') {
      return []
    }

    const lines: string[] = []

    if (this.specifiers.some(specifier => !specifier.alias)) {
      lines.push(`using ${namespaceName};`)
    }

    for (const specifier of this.specifiers) {
      if (specifier.alias) {
        lines.push(`using ${specifier.alias} = ${namespaceName}.${specifier.name};`)
      }
    }

    return lines
  }

  override toString(): string {
    return this.toLines().join('\n')
  }
}
