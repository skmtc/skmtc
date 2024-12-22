import type { OasRef } from '../ref/Ref.ts'

export type VoidFields = {
  title?: string
  description?: string
}

/**
 * Object representing a void type in the OpenAPI Specification.
 * It is used to describe an absence of a value such as when no
 * content is returned by an operation.
 */
export class OasVoid {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'void' useful for type narrowing and tagged unions.
   */
  type = 'void' as const
  /**
   * A short summary of the value.
   */
  title: string | undefined
  /**
   * A description of the value.
   */
  description: string | undefined

  constructor(fields: VoidFields = {}) {
    this.title = fields.title
    this.description = fields.description
  }

  static empty(): OasVoid {
    return new OasVoid()
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasVoid {
    return this
  }

  resolveOnce(): OasVoid {
    return this
  }
}
