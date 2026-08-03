import { toRefName } from '@skmtc/core'
import type { CustomValue, OasRef, OasSchema, RefName } from '@skmtc/core'

/**
 * Any node this generator can turn into an effect `Schema` expression: a
 * parsed OAS schema, a `$ref` to one, or a `CustomValue` another generator
 * spliced into the document.
 */
export type SchemaNode = OasSchema | OasRef<'schema'> | CustomValue

/**
 * Resolves a `$ref` target to the expression that names it — either the
 * imported constant of the peer model's own file, or a `Schema.suspend(...)`
 * thunk when the reference closes a cycle. Supplied by the projection, which
 * owns the `insertModel` side effects.
 */
export type RefResolver = (refName: RefName) => string

/** Quotes a property key that isn't a bare JS identifier. */
const toPropertyKey = (name: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `'${name.replaceAll("'", "\\'")}'`

/** Renders a string literal for enum members. */
const toStringLiteral = (value: string): string => `'${value.replaceAll("'", "\\'")}'`

const withNullable = (value: string, nullable: boolean | undefined): string =>
  nullable ? `Schema.NullOr(${value})` : value

/**
 * A string schema: an `enum` becomes `Schema.Literal(...)`, everything else
 * `Schema.String`. A `null` inside the enum list is folded into nullability
 * rather than emitted as a literal member.
 */
const toStringValue = (enums: readonly (string | null)[] | undefined): string => {
  if (!enums?.length) {
    return 'Schema.String'
  }

  const literals = enums.filter((value): value is string => value !== null)

  if (literals.length === 0) {
    return 'Schema.Null'
  }

  return `Schema.Literal(${literals.map(toStringLiteral).join(', ')})`
}

const toObjectValue = (schema: Extract<OasSchema, { type: 'object' }>, resolveRef: RefResolver) => {
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])

  const entries = Object.entries(properties).map(([name, property]) => {
    const value = toSchemaValue(property, resolveRef)

    return `${toPropertyKey(name)}: ${required.has(name) ? value : `Schema.optional(${value})`}`
  })

  const { additionalProperties } = schema

  // A pure map (no declared properties, an `additionalProperties` schema) is
  // a `Schema.Record`; anything else is a struct. Mixed shapes keep the
  // struct — effect models open structs through `Schema.Struct` itself.
  if (entries.length === 0 && additionalProperties !== undefined) {
    const value =
      typeof additionalProperties === 'boolean'
        ? 'Schema.Unknown'
        : toSchemaValue(additionalProperties, resolveRef)

    return `Schema.Record({ key: Schema.String, value: ${value} })`
  }

  return entries.length === 0 ? 'Schema.Struct({})' : `Schema.Struct({\n${entries.join(',\n')}\n})`
}

/**
 * Renders one schema node as an effect `Schema` expression. Nullability is
 * applied here (`Schema.NullOr`); optionality belongs to the property slot
 * and is applied by {@link toObjectValue}.
 */
export const toSchemaValue = (schema: SchemaNode, resolveRef: RefResolver): string => {
  switch (schema.type) {
    case 'ref':
      return withNullable(resolveRef(toRefName(schema.$ref)), schema.nullable)

    case 'object':
      return withNullable(toObjectValue(schema, resolveRef), schema.nullable)

    case 'array':
      return withNullable(`Schema.Array(${toSchemaValue(schema.items, resolveRef)})`, schema.nullable)

    case 'union': {
      const members = schema.members.map(member => toSchemaValue(member, resolveRef))

      return withNullable(`Schema.Union(${members.join(', ')})`, schema.nullable)
    }

    case 'string':
      return withNullable(toStringValue(schema.enums), schema.nullable)

    case 'integer':
      return withNullable('Schema.Int', schema.nullable)

    case 'number':
      return withNullable('Schema.Number', schema.nullable)

    case 'boolean':
      return withNullable('Schema.Boolean', schema.nullable)

    case 'unknown':
      return 'Schema.Unknown'

    case 'custom':
      return `${schema}`

    default: {
      const exhaustive: never = schema
      throw new Error(`Unsupported schema node: ${JSON.stringify(exhaustive)}`)
    }
  }
}
