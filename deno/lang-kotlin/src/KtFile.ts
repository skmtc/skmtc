import { CodeFileBase } from '@skmtc/core'
import type { ClientSettings } from '@skmtc/core'
import { KtImport } from './KtImport.ts'
import { toPackageName } from './toPackageName.ts'

/**
 * Constructor arguments for {@link KtFile} — the `Lang.createFile` shape.
 */
export type KtFileArgs = {
  path: string
  settings: ClientSettings | undefined
}

/**
 * Kotlin's concrete code file. Inherits the neutral import collection +
 * merge from {@link CodeFileBase} and adds the Kotlin-specific pieces:
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
 * - the rendering arrangement: package directive, imports (one statement
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
  /** The `package` this file declares — derived from `path`. */
  packageName: string
  /** Held for the multi-module (`settings.packages`) story; unused in v1. */
  settings: ClientSettings | undefined

  constructor({ path, settings }: KtFileArgs) {
    super({ path })
    this.packageName = toPackageName(path)
    this.settings = settings
  }

  override toString(): string {
    const importLines = Array.from(this.imports.values())
      .flatMap(importEntry => {
        if (!(importEntry instanceof KtImport)) {
          return [importEntry.toString()]
        }

        if (importEntry.resolvedPackage() === this.packageName) {
          return []
        }

        return importEntry.toLines()
      })
      .sort()

    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    const sections = [
      this.packageName ? `package ${this.packageName}` : '',
      importLines.join('\n'),
      definitions
    ]

    return `${sections.filter(section => Boolean(section.length)).join('\n\n')}\n`
  }
}
