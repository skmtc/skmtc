import { CodeFileBase, matchDefinitions } from '@/dsl/CodeFileBase.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import type { FindDefinitionsQuery } from '@/dsl/CodeFileBase.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { ImportBase } from '@/dsl/ImportBase.ts'
import type { ReExportBase } from '@/dsl/ReExportBase.ts'
import invariant from 'tiny-invariant'
import type { PendingDefinition } from '@/dsl/PendingDefinition.ts'

/**
 * A neutral {@link ImportBase} for core tests: named symbols from one module,
 * merged by module. Enough for the engine's cross-file import stitching
 * without a concrete language's import syntax.
 */
export class MockImport extends ImportBase {
  names: string[]
  module: string

  constructor({ names, module }: { names: string[]; module: string }) {
    super()
    this.names = names
    this.module = module
  }

  override mergeKey(): string {
    return this.module
  }

  override merge(other: ImportBase): ImportBase {
    invariant(other instanceof MockImport, 'MockImport can only merge with MockImport')

    return new MockImport({
      names: [...new Set([...this.names, ...other.names])],
      module: this.module
    })
  }

  override toString(): string {
    return `import { ${this.names.join(', ')} } from '${this.module}'`
  }
}

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
 * bare {@link Lang} (opaque-`string` type), since the mock has no declaration
 * vocabulary; tests filter by name or list all, never by `type`.
 *
 * Lang-specific dedup/merge/render policy is tested in each lang package; this
 * mock keeps the simplest neutral behavior (name-keyed definitions, per-module
 * import/re-export merge, definitions joined by blank lines).
 */
export class MockFile extends CodeFileBase {
  /** One entry per name: a Definition, or a pending entry that becomes one in place. */
  definitions: Map<string, DefinitionBase | PendingDefinition> = new Map()
  /** The names, in the order each entry became a Definition: render follows it, as a language's File does. */
  #renderOrder: string[] = []
  imports: Map<string, ImportBase> = new Map()
  reExports: Map<string, ReExportBase> = new Map()

  constructor({ path }: { path: string }) {
    super({ path })
  }

  override addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
      this.#renderOrder.push(definition.identifier.name)
    }
  }

  override addPendingDefinition(pending: PendingDefinition): void {
    this.definitions.set(pending.identifier.name, pending)
  }

  override resolvePendingDefinition(pending: PendingDefinition, definition: DefinitionBase): void {
    invariant(this.definitions.get(pending.identifier.name) === pending, 'no pending entry to resolve')
    this.definitions.set(pending.identifier.name, definition)
    this.#renderOrder.push(pending.identifier.name)
  }

  override removePendingDefinition(pending: PendingDefinition): void {
    if (this.definitions.get(pending.identifier.name) === pending) {
      this.definitions.delete(pending.identifier.name)
    }
  }

  override findPendingDefinitions(name?: string): PendingDefinition[] {
    return [...this.definitions.values()].filter(
      (entry): entry is PendingDefinition => entry.isPending() && (name === undefined || entry.identifier.name === name)
    )
  }

  #constructed(): DefinitionBase[] {
    return [...this.definitions.values()].filter((entry): entry is DefinitionBase => !entry.isPending())
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
    return matchDefinitions(this.#constructed(), query, () => undefined)
  }

  override toString(): string {
    return this.#renderOrder
      .flatMap(name => {
        const entry = this.definitions.get(name)
        return entry === undefined || entry.isPending() ? [] : [entry.toString()]
      })
      .join('\n\n')
  }
}
