import { CodeFileBase, matchDefinitions } from '@/dsl/CodeFileBase.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import type { FindDefinitionsQuery } from '@/dsl/CodeFileBase.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { ReExportBase } from '@/dsl/ReExportBase.ts'

/**
 * A neutral {@link DefinitionBase} for core tests. Renders a wrapper around
 * its value (`def <name> = <value>`) so a child value's capture span nests
 * inside the definition's span — enough to exercise the engine's
 * capture/render machinery without a concrete language's declaration syntax.
 *
 * Lang-specific rendering (the real `export const X = …`, JSDoc, keywords) is
 * tested in each `@skmtc/lang-*` package; core tests only need *a* definition.
 */
export class MockDefinition<V extends GeneratedValue = GeneratedValue> extends DefinitionBase<V> {
  override toString(): string {
    return `def ${this.identifier.name} = ${this.value}`
  }
}

/**
 * A neutral {@link CodeFileBase} for core tests — a stand-in for a
 * `@skmtc/lang-*` package's file so core tests exercise engine, render, and
 * capture behavior WITHOUT naming a concrete lang File class. Bound to the
 * bare {@link Lang} (opaque-`string` kind), since the mock has no declaration
 * vocabulary; tests filter by name or list all, never by `type`.
 *
 * Lang-specific dedup/merge/render policy is tested in each lang package; this
 * mock keeps the simplest neutral behavior (name-keyed definitions, per-module
 * import/re-export merge, definitions joined by blank lines).
 */
export class MockFile extends CodeFileBase {
  definitions: Map<string, DefinitionBase> = new Map()
  imports: Map<string, ImportBase> = new Map()
  reExports: Map<string, ReExportBase> = new Map()

  constructor({ path }: { path: string }) {
    super({ path })
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

  override findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined {
    return matchDefinitions([...this.definitions.values()], query, () => undefined)
  }

  override toString(): string {
    return [...this.definitions.values()].map(definition => definition.toString()).join('\n\n')
  }
}
