import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { WorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'

type PendingDefinitionArgs = {
  identifier: IdentifierBase
  exportPath: WorkspacePath
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
  exportPath: WorkspacePath
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
  /** The model's place on the pending stack, counted from the bottom. The Driver sets it when it pushes the model. */
  depth = 0
  /**
   * The model lowest on the pending stack that this model's construction led
   * back to, directly or through the models it refers to: itself when it led
   * back to none. The models are constructed depth first, so this is the
   * lowlink of Tarjan's algorithm, and a model that leads back to itself
   * alone is the root of its cycle. When the constructor returns, the Driver
   * hands it to the Definition (`DefinitionBase.leadsTo`).
   */
  leadsTo: PendingDefinition = this

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

  /**
   * Record that this model's construction led back to `other`, a model on
   * the pending stack. The lowest one is kept.
   */
  leadBackTo(other: PendingDefinition): void {
    if (other.depth < this.leadsTo.depth) {
      this.leadsTo = other
    }
  }

  /**
   * The model under construction this model still leads back to: itself
   * while its own constructor runs, and after that the one its cycle goes
   * back to, for as long as that cycle is not complete. `undefined` once the
   * root of its cycle has returned: the model is in no cycle that is open.
   */
  toOpenEnd(): PendingDefinition | undefined {
    if (this.pending) {
      return this
    }

    return this.leadsTo === this ? undefined : this.leadsTo.toOpenEnd()
  }
}
