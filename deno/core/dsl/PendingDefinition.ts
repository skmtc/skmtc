import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'

type PendingDefinitionArgs = {
  identifier: IdentifierBase
  generatorKey: GeneratorKey
  options: unknown
}

/**
 * A model whose projection is being constructed: the pending state of a
 * Definition. `findDefinition` returns `DefinitionBase | PendingDefinition`,
 * as a schema lookup returns `OasSchema | OasRef`, and `isPending()` tells
 * the two apart, as `isRef()` does.
 *
 * The `ModelDriver` adds it to the model's File (`addPendingDefinition`)
 * before it runs the projection's constructor. When the constructor returns,
 * the entry becomes the Definition in place (`resolvePendingDefinition`); if
 * the constructor throws, the entry is taken out.
 *
 * An insert of the model from inside that constructor (a cycle: the model
 * refers to itself, or to a model that refers back to it) finds this marker
 * instead of a cache miss. It gets the model's identity, which is all a
 * reference by name needs, and no value: the value does not exist yet. A
 * second projection for the model is never constructed.
 *
 * The entry has its slot among the File's Definitions from the start, but a
 * File renders its Definitions in the order each became one: each still lands
 * after the models it refers to (post-order), which keeps `const`
 * declarations in one file in a working order. A pending entry left at render
 * is an engine bug, and fails the run.
 */
export class PendingDefinition {
  identifier: IdentifierBase
  /** The key the Definition will carry: the identity check runs on the marker too. */
  generatorKey: GeneratorKey
  /** The caller's options the projection is constructed with: identity, like the key. */
  options: unknown
  /** How many inserts found the model pending: references back to it from inside its own construction. */
  backReferences = 0
  /** True while the projection's constructor runs; false once it returned, however it returned. */
  pending = true
  /**
   * The models this model's construction reached while they were pending:
   * the targets of its references back, and what the models it refers to
   * reached. When the constructor returns, the Driver hands the set to the
   * Definition (`DefinitionBase.reaches`).
   */
  reaches: Set<PendingDefinition> = new Set()

  constructor({ identifier, generatorKey, options }: PendingDefinitionArgs) {
    this.identifier = identifier
    this.generatorKey = generatorKey
    this.options = options
  }

  /** True: the model's projection is being constructed, so there is no value yet. */
  isPending(): this is PendingDefinition {
    return true
  }
}

type AssertNotPendingArgs = {
  name: string
  exportPath: string
}

/**
 * `found`, where only a constructed Definition can serve: an operation's
 * Definition, an inline model, a container. Only a model is ever pending, so
 * a pending one here shares the name and file of a model being constructed:
 * a clash, which throws.
 */
export const assertNotPending = (
  found: DefinitionBase | PendingDefinition | undefined,
  { name, exportPath }: AssertNotPendingArgs
): DefinitionBase | undefined => {
  if (found === undefined) {
    return undefined
  }

  if (found.isPending()) {
    throw new Error(
      `Registered definition mismatch: '${name}' in file '${exportPath}' is a model being constructed (key '${found.generatorKey}').`
    )
  }

  return found
}
