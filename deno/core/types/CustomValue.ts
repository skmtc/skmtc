import type { GenerateContext } from '../context/GenerateContext.ts'
import { ContentBase } from '../dsl/ContentBase.ts'
import type { Stringable } from '../dsl/Stringable.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import type { OasRef } from '../oas/ref/Ref.ts'

type CreateArgs = {
  context: GenerateContext
  value: Stringable
  generatorKey?: GeneratorKey
}

/**
 * Represents a custom value in the SKMTC generation pipeline.
 * 
 * CustomValue allows generators to create arbitrary content that doesn't fit
 * standard schema types. Used for injecting custom code, templates, or specialized
 * content during the generation process.
 * 
 * @example Creating custom content
 * ```typescript
 * const customValue = new CustomValue({
 *   context: generateContext,
 *   value: 'const customCode = "generated";',
 *   generatorKey: 'my-generator'
 * });
 * 
 * console.log(customValue.toString()); // "const customCode = "generated";"
 * ```
 */
export class CustomValue extends ContentBase {
  /** Type identifier for this custom value */
  type = 'custom' as const
  /** The underlying value content that can be converted to string */
  value: Stringable

  /**
   * Creates a new CustomValue instance.
   * 
   * @param args - Creation arguments including context, value, and optional generator key
   */
  constructor({ context, value, generatorKey }: CreateArgs) {
    super({ context, generatorKey })

    this.value = value
  }

  /**
   * Determines if this custom value is a reference.
   * 
   * @returns Always false since custom values are concrete content, not references
   */
  isRef(): this is OasRef<'schema'> {
    return false
  }

  /**
   * Resolves this custom value.
   * 
   * @returns The custom value itself since it's already resolved
   */
  resolve(): CustomValue {
    return this
  }

  /**
   * Resolves this custom value one level.
   * 
   * @returns The custom value itself since it's already resolved
   */
  resolveOnce(): CustomValue {
    return this
  }

  /**
   * Converts the custom value to its string representation.
   * 
   * @returns String representation of the underlying value
   */
  override toString(): string {
    return `${this.value}`
  }
}

/**
 * Type guard function to check if a value is a CustomValue instance.
 * 
 * @param value - Value to check
 * @returns True if the value is a CustomValue, false otherwise
 * 
 * @example Type checking
 * ```typescript
 * if (isCustomValue(someValue)) {
 *   console.log(someValue.value); // TypeScript knows it's a CustomValue
 * }
 * ```
 */
export const isCustomValue = (value: unknown): value is CustomValue => {
  return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'custom')
}
