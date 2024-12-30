import type { Definition } from '../dsl/Definition.js'
import type { Stringable } from '../dsl/Stringable.js'
import type { GeneratorKey } from './GeneratorKeys.js'

/**
 * 'force' - will generate content even it is not selected.
 * Use this option when generating code via a dependency.
 * For example, when you are generating a form and it needs
 * an accompanying API client as well. You should use 'force'
 * when generating the API client to ensure it is generated
 * event the API client itself is not selected.
 *
 * 'regular' - will generate content only if it is selected.
 */

export type GenerationType = 'force' | 'regular'

export type GeneratedValue = Stringable & {
  generatorKey?: GeneratorKey
}

export type GeneratedDefinition<
  V extends GeneratedValue,
  T extends GenerationType
> = T extends 'force' ? Definition<V> : Definition<V> | undefined
