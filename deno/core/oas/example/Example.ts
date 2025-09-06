import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasExample}.
 */
export type ExampleFields = {
  /** Short summary of the example */
  summary: string | undefined
  /** Longer description of the example */
  description: string | undefined
  /** The example value */
  value: unknown
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents an Example Object in the OpenAPI Specification.
 * 
 * The `OasExample` class provides sample data for parameters, request bodies,
 * responses, and other components in an OpenAPI document. Examples are crucial
 * for API documentation, testing, and helping developers understand expected
 * data formats and structures.
 * 
 * This class supports rich example definitions with metadata, making API
 * documentation more informative and interactive for developers.
 * 
 * ## Key Features
 * 
 * - **Sample Data**: Concrete examples of API inputs and outputs
 * - **Documentation**: Summary and description for context
 * - **Type Flexibility**: Supports any data type as example values
 * - **Reference Support**: Can be referenced from multiple locations
 * - **Markdown Support**: Rich text descriptions with CommonMark
 * 
 * @example Simple string example
 * ```typescript
 * import { OasExample } from '@skmtc/core';
 * 
 * const nameExample = new OasExample({
 *   summary: 'Typical user name',
 *   description: 'A common first and last name combination',
 *   value: 'John Doe'
 * });
 * ```
 * 
 * @example JSON object example
 * ```typescript
 * const userExample = new OasExample({
 *   summary: 'Complete user profile',
 *   description: 'Example user with all profile fields populated',
 *   value: {
 *     id: 12345,
 *     name: 'Jane Smith',
 *     email: 'jane.smith@example.com',
 *     active: true,
 *     createdAt: '2023-01-15T10:30:00Z'
 *   }
 * });
 * ```
 * 
 * @example Array example with multiple items
 * ```typescript
 * const productsExample = new OasExample({
 *   summary: 'Product list sample',
 *   description: 'Typical response for product catalog endpoint',
 *   value: [
 *     { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' },
 *     { id: 2, name: 'Book', price: 19.99, category: 'Education' },
 *     { id: 3, name: 'Coffee Mug', price: 12.50, category: 'Home' }
 *   ]
 * });
 * ```
 * 
 * @example Error response example
 * ```typescript
 * const errorExample = new OasExample({
 *   summary: 'Validation error',
 *   description: 'Response when request validation fails',
 *   value: {
 *     error: 'Validation failed',
 *     code: 'INVALID_INPUT',
 *     details: [
 *       { field: 'email', message: 'Invalid email format' },
 *       { field: 'age', message: 'Must be between 18 and 120' }
 *     ]
 *   }
 * });
 * ```
 */
export class OasExample {
  /** Static identifier property for OasExample */
  oasType: 'example' = 'example'
  /** @internal */
  #fields: ExampleFields

  constructor(fields: ExampleFields) {
    this.#fields = fields
  }

  /** Brief summary of example */
  get summary(): string | undefined {
    return this.#fields.summary
  }

  /** Detailed description of the example. May contain CommonMark Markdown */
  get description(): string | undefined {
    return this.#fields.description
  }

  /** Embedded example value */
  get value(): unknown {
    return this.#fields.value
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }

  /** Returns true if object is a reference */
  isRef(): this is OasRef<'example'> {
    return false
  }

  /** Returns itself */
  resolve(): OasExample {
    return this
  }

  resolveOnce(): OasExample {
    return this
  }

  toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ExampleObject {
    return {
      summary: this.summary,
      description: this.description,
      value: this.value
    }
  }
}
