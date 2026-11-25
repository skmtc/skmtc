import type { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import { toSiblingAnnotations } from '@/oas/schema/siblings.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import type { OasExternalDocs } from '@/oas/externalDocs/ExternalDocs.ts'
import type { OasSchema, ToJsonSchemaOptions } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'

/**
 * Constructor fields for {@link OasIntersection}.
 */
export type IntersectionFields = {
  /** A short summary of the intersection */
  title?: string
  /** A description of the intersection */
  description?: string
  /** External documentation for the intersection */
  externalDocs?: OasExternalDocs | undefined
  /** Whether the value can be null */
  nullable?: boolean
  /** Whether the value is sent by the API only */
  readOnly?: boolean
  /** Whether the value is sent in a request only */
  writeOnly?: boolean
  /** Whether the value is deprecated */
  deprecated?: boolean
  /** Example value */
  example?: unknown
  /** Default value */
  default?: unknown
  /** The schemas a value matches all of */
  members: (OasSchema | OasRef<'schema'>)[]
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * An `allOf` that keeps at least one reference: a value matches every member.
 *
 * Core merges the members of an `allOf` into one schema. A reference that
 * `client.json` `system.intersections` keeps is not merged: the schema is an
 * `OasIntersection` of the kept references, and at most one other member, which
 * the other members of the `allOf` merge into. By default those are the
 * references that close a cycle.
 *
 * @example
 * ```typescript
 * // LineString: { allOf: [{ $ref: Geometry }, { properties: { coordinates } }] },
 * // where a property of Geometry leads back to LineString
 * lineString.members // [OasRef Geometry, OasObject { coordinates }]
 * ```
 */
export class OasIntersection extends OasBase {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'intersection' useful for type narrowing and tagged unions.
   */
  type = 'intersection' as const
  /** A short summary of the intersection. */
  title: string | undefined
  /** A description of the intersection. */
  description: string | undefined
  /** External documentation for the intersection. */
  externalDocs: OasExternalDocs | undefined
  /** Indicates whether the value can be null. */
  nullable: boolean | undefined
  /** Whether the value is sent by the API only. */
  readOnly: boolean | undefined
  /** Whether the value is sent in a request only. */
  writeOnly: boolean | undefined
  /** Whether the value is deprecated. */
  deprecated: boolean | undefined
  /** The schemas, or references to schemas, that a value matches all of. */
  members: (OasSchema | OasRef<'schema'>)[]
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /** An example of the value. */
  example?: unknown
  /** The default value. */
  default?: unknown

  /**
   * The schema's `not`, kept as an `OasUnknown` under `client.json`
   * `system.not: unknown`. `undefined` otherwise.
   */
  not: OasUnknown | undefined = undefined

  constructor(fields: IntersectionFields, context?: ParseContextType) {
    super(context)
    this.title = fields.title
    this.description = fields.description
    this.externalDocs = fields.externalDocs
    this.nullable = fields.nullable
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
    this.members = fields.members
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  /** Whether the value is `readOnly`: the intersection or one of its members is. */
  isReadOnly(): boolean {
    return this.#toMembersInside().some(member =>
      member.isRef() || member.type === 'intersection' ? member.readOnly === true : member.isReadOnly()
    )
  }

  /** Whether the value is `writeOnly`: the intersection or one of its members is. */
  isWriteOnly(): boolean {
    return this.#toMembersInside().some(member =>
      member.isRef() || member.type === 'intersection' ? member.writeOnly === true : member.isWriteOnly()
    )
  }

  /**
   * The schemas a value matches all of, with each reference resolved and each
   * intersection inside replaced by its own members. Each is given once, so a
   * member that leads back to an intersection ends. A reference that names
   * nothing is left out.
   */
  toParts(): Exclude<OasSchema, OasIntersection>[] {
    return this.#toMembersInside().filter(
      (member): member is Exclude<OasSchema, OasIntersection> => !member.isRef() && member.type !== 'intersection'
    )
  }

  /** This intersection, each member, what each reference resolves to, and the same of each intersection inside, in order. */
  #toMembersInside(): (OasSchema | OasRef<'schema'>)[] {
    const found = new Set<OasSchema | OasRef<'schema'>>()

    const visit = (item: OasSchema | OasRef<'schema'> | undefined): void => {
      if (item === undefined || found.has(item)) {
        return
      }

      found.add(item)

      if (item.isRef()) {
        visit(toTarget(item))
      } else if (item.type === 'intersection') {
        item.members.forEach(visit)
      }
    }

    visit(this)

    return [...found]
  }

  /**
   * A copy of this schema with what `ref` adds at its site applied, as
   * {@link OasUnion.clone} does: the keywords that this type takes, a
   * sibling's value winning. This schema does not change, and the copy shares
   * its members.
   */
  clone(ref?: OasRef<'schema'>): OasIntersection {
    const copy = new OasIntersection({
      ...toSiblingAnnotations(this, ref),
      example: ref?.example ?? this.example,
      externalDocs: this.externalDocs,
      nullable: this.nullable || ref?.nullable || undefined,
      readOnly: this.readOnly || ref?.readOnly || undefined,
      writeOnly: this.writeOnly || ref?.writeOnly || undefined,
      deprecated: ref?.deprecated ?? this.deprecated,
      members: this.members,
      default: ref?.default ?? this.default
    })
    copy.stackTrail = this.stackTrail
    copy.not = this.not

    return copy
  }

  traverse(path: SchemaPath): OasSchema | OasRef<'schema'> {
    return traverseSchema(this, path)
  }

  resolve(): OasIntersection {
    return this
  }

  resolveOnce(): OasIntersection {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly,
      deprecated: this.deprecated,
      example: this.example,
      default: this.default,
      allOf: this.members.map(member => member.toJsonSchema(options))
    }
  }
}

/** What a reference resolves to, or `undefined` when it names nothing. */
const toTarget = (ref: OasRef<'schema'>): OasSchema | undefined => {
  try {
    return ref.resolve()
  } catch (error) {
    if (DanglingRefError.is(error)) {
      return undefined
    }

    throw error
  }
}
