import type { GenerateContextType } from '../context/generateTypes.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { GeneratedValue } from './GeneratedValue.ts'
import type { PendingDefinition } from '@/dsl/PendingDefinition.ts'

/**
 * Constructor arguments for {@link DefinitionBase}.
 *
 * @template V - The type of generated value this definition contains
 */
type DefinitionBaseArgs<V extends GeneratedValue> = {
  /** The generation context providing pipeline access */
  context: GenerateContextType
  /** The identifier for this definition */
  identifier: IdentifierBase
  /** The generated value content */
  value: V
}

/**
 * The language-neutral coordination surface of a registered, named
 * definition.
 *
 * The cross-generator cache reads only this surface — the definition's
 * `identifier` (the `(name, exportPath)` cache key), its `value`, and the
 * `generatorKey` (via {@link SnippetBase}) for the integrity check. How a
 * definition renders — the `export const X = …` wrapper, JSDoc, the
 * export/visibility keyword — is the concrete subclass's concern, so
 * `toString()` is abstract here.
 *
 * Concrete rendering subclasses live in the language packages
 * (`TsDefinition` in `@skmtc/lang-typescript`); Drivers construct them
 * through the `Lang` factories (`lang.toDefinition`).
 */
export abstract class DefinitionBase<
  V extends GeneratedValue = GeneratedValue
> extends SnippetBase {
  /** The identifier for this definition */
  identifier: IdentifierBase

  /** The generated value content */
  value: V

  /**
   * The models this Definition's model reached while its projection was
   * being constructed that were pending then: the models further up the
   * stack it refers back to, directly or through the models it refers to.
   * A reference to this model is inside a cycle while one of them is still
   * pending. Set by the `ModelDriver`; `undefined` for a Definition it did
   * not construct.
   */
  reaches: ReadonlySet<PendingDefinition> | undefined

  constructor({ context, identifier, value }: DefinitionBaseArgs<V>) {
    super({ context, generatorKey: value.generatorKey })

    this.value = value
    this.identifier = identifier
  }

  /** False: a registered Definition is constructed and holds its value. See {@link PendingDefinition}. */
  isPending(): this is PendingDefinition {
    return false
  }

  /** Renders the definition's code. Implemented by the concrete subclass. */
  abstract override toString(): string
}

/**
 * Arguments for {@link Definable.toDefinition}.
 */
export type ToDefinitionArgs = {
  /** The identifier the definition is registered under. */
  identifier: IdentifierBase
  /** Whether to omit the export keyword. */
  noExport?: boolean
}
