import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

type PendingDefinitionArgs = {
  identifier: IdentifierBase
  exportPath: string
  generatorKey: GeneratorKey
  options: unknown
  projection: unknown
}

/**
 * A model whose projection is being constructed. The `ModelDriver` pushes it
 * onto the context's `pendingStack` before it runs the projection's
 * constructor, and pops it however the constructor ends, so the stack holds
 * exactly the models under construction. The model's File does not see it:
 * the Driver adds the Definition when the constructor returns.
 *
 * A reference to the model from inside that constructor (a cycle: the model
 * refers to itself, or to a model that refers back to it) finds this entry,
 * not a cache miss. `toModelRef` returns it suspended: the reference gets the
 * model's identity, which is all a reference by name needs, and no value,
 * which does not exist yet. A second projection for the model is never
 * constructed.
 */
export class PendingDefinition {
  identifier: IdentifierBase
  /** The file the Definition will go to, normalized. */
  exportPath: string
  /** The key the Definition will carry: the identity check runs on the entry too. */
  generatorKey: GeneratorKey
  /** The caller's options the projection is constructed with: identity, like the key. */
  options: unknown
  /** The projection class being constructed: another class under this name and file is a clash. */
  projection: unknown
  /** How many references found the model under construction: references back to it. */
  backReferences = 0
  /** True while the projection's constructor runs; false once it returned, however it returned. */
  pending = true
  /**
   * The models this model's construction reached while they were under
   * construction: the targets of its references back, and what the models it
   * refers to reached. When the constructor returns, the Driver hands the set
   * to the Definition (`DefinitionBase.reaches`).
   */
  reaches: Set<PendingDefinition> = new Set()

  constructor({
    identifier,
    exportPath,
    generatorKey,
    options,
    projection
  }: PendingDefinitionArgs) {
    this.identifier = identifier
    this.exportPath = exportPath
    this.generatorKey = generatorKey
    this.options = options
    this.projection = projection
  }
}
