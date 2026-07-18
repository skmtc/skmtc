import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { ClientSettings, DefinitionBase, ImportBase, ReExportBase } from '@skmtc/core'
import { KtImport } from './KtImport.ts'
import { KtIdentifier } from './KtIdentifier.ts'
import type { KtEntityType } from './createIdentifier.ts'
import { toPackageName } from './toPackageName.ts'

/**
 * Constructor arguments for {@link KtFile} — the `Lang.createFile` shape.
 */
export type KtFileArgs = {
  path: string
  settings: ClientSettings | undefined
}

/**
 * Kotlin's concrete code file. Owns the definition + import collections and
 * their merge policy (the neutral {@link CodeFileBase} declares the
 * contract) and adds the Kotlin-specific pieces:
 *
 * - the `package` directive, DERIVED from the file's own path via
 *   {@link toPackageName} — the export path encodes the package
 *   (`@/com/example/api/User.generated.kt` → `package com.example.api`);
 *   `client.json#settings.basePath` points at the Gradle source root.
 * - **same-package import suppression**: any import whose resolved
 *   package equals this file's package is omitted at render (same-package
 *   symbols need no import in Kotlin — the structural analog of TsFile's
 *   intra-package `@/` normalization). In particular the Driver's
 *   cross-file peer imports vanish when peers share the package.
 * - the rendering arrangement: the neutral `custom` slot
 *   ({@link FileBase.custom}) first — leading content above the
 *   `package` directive (e.g. a generated-file attribution banner;
 *   only comments may precede `package`), the same placement `TsFile`
 *   gives it — then the package directive, imports (one statement
 *   per symbol, **sorted alphabetically** — not style, which is the
 *   consumer's formatter's job, but registration-order independence:
 *   the rendered bytes are what snapshot tests and byte-identical
 *   regression gates compare), then definitions joined by blank lines.
 *
 * `reExports` cannot arrive by construction — Kotlin's concise register
 * vocabulary has no `reExports` field and the Driver never registers
 * them — so rendering ignores the (always empty) neutral map.
 */
export class KtFile extends CodeFileBase {
  /**
   * The `package` this file declares — derived from `path`, with the
   * owning package's `rootPath` stripped first in multi-package mode
   * (`settings.packages`).
   */
  packageName: string
  /** Threaded into package derivation and same-package suppression. */
  settings: ClientSettings | undefined

  /** Definitions keyed by identifier name (first write wins; Kotlin has no declaration merging). */
  definitions: Map<string, DefinitionBase> = new Map()

  /** Imports keyed by {@link ImportBase.mergeKey}. */
  imports: Map<string, ImportBase> = new Map()

  /** Re-exports keyed by {@link ReExportBase.mergeKey} — Kotlin registers none; kept for the neutral contract. */
  reExports: Map<string, ReExportBase> = new Map()

  constructor({ path, settings }: KtFileArgs) {
    super({ path })
    this.packageName = toPackageName(path, settings?.packages)
    this.settings = settings
  }

  override addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
    }
  }

  override addImports(incoming: ImportBase[]): void {
    for (const importEntry of incoming) {
      const key = importEntry.mergeKey()
      const existing = this.imports.get(key)
      this.imports.set(key, existing ? existing.merge(importEntry) : importEntry)
    }
  }

  override addReExports(incoming: ReExportBase[]): void {
    for (const reExportEntry of incoming) {
      const key = reExportEntry.mergeKey()
      const existing = this.reExports.get(key)
      this.reExports.set(key, existing ? existing.merge(reExportEntry) : reExportEntry)
    }
  }

  override findDefinitions(query?: {
    name?: string
    type?: KtEntityType
  }): DefinitionBase[] | undefined {
    return matchDefinitions([...this.definitions.values()], query, identifier =>
      identifier instanceof KtIdentifier ? identifier.type : undefined
    )
  }

  override toString(): string {
    const packages = this.settings?.packages

    const importLines = Array.from(this.imports.values())
      .flatMap(importEntry => {
        if (!(importEntry instanceof KtImport)) {
          return [importEntry.toString()]
        }

        if (importEntry.resolvedPackage(packages) === this.packageName) {
          return []
        }

        return importEntry.toLines(packages)
      })
      .sort()

    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    const sections = [
      // The neutral leading-content slot (FileBase.custom) — e.g. a
      // generated-file attribution banner; only comments may precede
      // `package`. Set through the register vocabulary's `custom` field.
      this.custom === undefined ? '' : `${this.custom}`,
      this.packageName ? `package ${this.packageName}` : '',
      importLines.join('\n'),
      definitions
    ]

    return `${sections.filter(section => Boolean(section.length)).join('\n\n')}\n`
  }
}
