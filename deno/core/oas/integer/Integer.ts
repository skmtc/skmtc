import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import { toSiblingAnnotations, toSiblingEnums, toSiblingValue, isIntegerValue, isIntegerFormat } from '@/oas/schema/siblings.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
/**
 * Constructor fields for {@link OasInteger}.
 *
 * @template Nullable - Whether the integer value can be null
 */
export type IntegerFields<Nullable extends boolean | undefined> = {
  /** A short summary of the integer schema */
  title?: string
  /** A description of the integer schema */
  description?: string
  /** Whether the integer value can be null */
  nullable?: Nullable
  /** Integer format specification (int32 or int64) */
  format?: 'int32' | 'int64'
  /** Default value for the integer */
  default?: Nullable extends true ? number | null | undefined : number | undefined
  /** Array of allowed enum values */
  enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the integer */
  example?: Nullable extends true ? number | null | undefined : number | undefined
  /** Number must be a multiple of this value */
  multipleOf?: number
  /** Maximum value (inclusive) */
  maximum?: number
  /** Whether maximum is exclusive */
  exclusiveMaximum?: boolean
  /** Minimum value (inclusive) */
  minimum?: number
  /** Whether minimum is exclusive */
  exclusiveMinimum?: boolean
  /** Whether the integer is read-only */
  readOnly?: boolean
  /** Whether the integer is write-only */
  writeOnly?: boolean
  /** Whether the integer is deprecated */
  deprecated?: boolean
}

export class OasInteger<
  Nullable extends boolean | undefined = boolean | undefined
> extends OasBase {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'integer' useful for type narrowing and tagged unions.
   */
  type = 'integer' as const
  /**
   * A short summary of the integer.
   */
  title: string | undefined
  /**
   * A description of the integer.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable | undefined
  /**
   * The format of the integer.
   */
  format: 'int32' | 'int64' | undefined
  /**
   * An array of allowed values for the integer.
   */
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the integer.
   */
  example: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * The multiple of the integer.
   */
  multipleOf: number | undefined
  /**
   * The maximum value of the integer.
   */
  maximum: number | undefined
  /**
   * Whether the maximum value is exclusive.
   */
  exclusiveMaximum: boolean | undefined
  /**
   * The minimum value of the integer.
   */
  minimum: number | undefined
  /**
   * Whether the minimum value is exclusive.
   */
  exclusiveMinimum: boolean | undefined
  /**
   * The default value of the integer.
   */
  default: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * Whether the integer is read-only.
   */
  readOnly: boolean | undefined
  /**
   * Whether the integer is write-only.
   */
  writeOnly: boolean | undefined
  /**
   * Whether the integer is deprecated.
   */
  deprecated: boolean | undefined
  constructor(fields: IntegerFields<Nullable> = {}, context?: ParseContextType) {
    super(context)
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.format = fields.format
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.multipleOf = fields.multipleOf
    this.maximum = fields.maximum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minimum = fields.minimum
    this.exclusiveMinimum = fields.exclusiveMinimum
    this.default = fields.default
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  /** Whether the value is `readOnly`: sent by the API only, never in a request. */
  isReadOnly(): boolean {
    return this.readOnly === true
  }

  /** Whether the value is `writeOnly`: sent in a request only, never by the API. */
  isWriteOnly(): boolean {
    return this.writeOnly === true
  }

  /**
   * A copy of this schema with what `ref` adds at its site applied: its
   * `nullable`, `readOnly`, `writeOnly` and the keywords next to it (`RefFields.siblings`) that
   * this type takes, a sibling's value winning. A value that does not fit
   * this type is left out (the parser reports it). For `OasRef.resolve()`.
   * This schema does not change, and the copy shares its child schemas.
   */
  clone(ref?: OasRef<'schema'>): OasInteger {
    const siblings = ref?.siblings
    const nullable = this.nullable || ref?.nullable || undefined
    const copy = new OasInteger<boolean | undefined>({
      ...toSiblingAnnotations(this, siblings),
      example: toSiblingValue(siblings?.example, isIntegerValue) ?? this.example,
      nullable,
      format: toSiblingValue(siblings?.format, isIntegerFormat) ?? this.format,
      enums: toSiblingEnums(siblings?.enums, isIntegerValue, nullable) ?? this.enums,
      multipleOf: siblings?.multipleOf ?? this.multipleOf,
      maximum: siblings?.maximum ?? this.maximum,
      exclusiveMaximum: siblings?.exclusiveMaximum ?? this.exclusiveMaximum,
      minimum: siblings?.minimum ?? this.minimum,
      exclusiveMinimum: siblings?.exclusiveMinimum ?? this.exclusiveMinimum,
      default: toSiblingValue(siblings?.default, isIntegerValue) ?? this.default,
      readOnly: this.readOnly || ref?.readOnly || undefined,
      writeOnly: this.writeOnly || ref?.writeOnly || undefined,
      deprecated: siblings?.deprecated ?? this.deprecated,
    })
    copy.stackTrail = this.stackTrail

    return copy
  }

  traverse(path: SchemaPath): OasSchema | OasRef<'schema'> {
    return traverseSchema(this, path)
  }

  resolve(): OasInteger<Nullable> {
    return this
  }

  resolveOnce(): OasInteger<Nullable> {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'integer',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      format: this.format,
      enum: this.enums,
      example: this.example,
      multipleOf: this.multipleOf,
      maximum: this.maximum,
      exclusiveMaximum: this.exclusiveMaximum,
      minimum: this.minimum,
      exclusiveMinimum: this.exclusiveMinimum,
      default: this.default,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly
    }
  }
}
