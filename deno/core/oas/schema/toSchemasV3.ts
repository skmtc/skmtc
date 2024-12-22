import { toRefV31 } from '../ref/toRefV31.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import { match, P } from 'npm:ts-pattern@5.6.0'
import type { OasSchema } from './Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toArray } from '../array/toArray.ts'
import { toObject } from '../object/toObject.ts'
import { toInteger } from '../integer/toInteger.ts'
import { toNumber } from '../number/toNumber.ts'
import { toBoolean } from '../boolean/toBoolean.ts'
import { toString } from '../string/toString.ts'
import { toUnknown } from '../unknown/toUnknown.ts'
import { toUnion } from '../union/toUnion.ts'
import { toIntersection } from '../intersection/toIntersection.ts'
import { extractExtensions } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
  context: ParseContext
  childOfComponents?: boolean
}

export const toSchemasV3 = ({
  schemas,
  context,
  childOfComponents
}: ToSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> => {
  return Object.fromEntries(
    Object.entries(schemas).map(([key, schema]) => {
      return [
        key,
        context.trace(key, () => {
          const { extensionFields } = extractExtensions(schema as Record<string, unknown>)

          if (childOfComponents) {
            context.registerExtension({
              extensionFields: {
                Label: extensionFields?.['x-label'] ?? '',
                Description: extensionFields?.['x-description'] ?? ''
              },
              stackTrail: ['models', key],
              type: 'schema'
            })
          } else {
            const parentObject = context.stackTrail.getParentOf(key)

            if (!parentObject) {
              throw new Error(`Expected to find parent object for '${key}'`)
            }

            context.registerExtension({
              extensionFields: {
                Label: extensionFields?.['x-label'] ?? ''
              },
              stackTrail: ['models', parentObject, key],
              type: 'schema'
            })
          }

          return toSchemaV3({ schema, context })
        })
      ]
    })
  )
}

type ToOptionalSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> | undefined
  context: ParseContext
  childOfComponents?: boolean
}

export const toOptionalSchemasV3 = ({
  schemas,
  context,
  childOfComponents
}: ToOptionalSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> | undefined => {
  if (!schemas) {
    return undefined
  }

  return toSchemasV3({ schemas, context, childOfComponents })
}

type ToSchemaV3Args = {
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toSchemaV3 = ({ schema, context }: ToSchemaV3Args): OasSchema | OasRef<'schema'> => {
  if (isRef(schema)) {
    return toRefV31({ ref: schema, refType: 'schema', context })
  }

  // Workaround for dodgy Reapit schema
  // if (schema.type !== 'array' && 'optional' in schema && schema.optional === true) {
  //   schema.nullable = true
  // }

  return match(schema)
    .with({ oneOf: P.array() }, ({ oneOf: members, ...value }) => {
      // if (members.length === 1) {
      //   return toSchemaV3({ schema: members[0], context })
      // }

      return toUnion({ value, members, context })
    })
    .with({ anyOf: P.array() }, ({ anyOf: members, ...value }) => {
      // if (members.length === 1) {
      //   return toSchemaV3({ schema: members[0], context })
      // }

      return context.trace('anyOf', () => toUnion({ value, members, context }))
    })
    .with({ allOf: P.array() }, ({ allOf: members, ...value }) => {
      // if (members.length === 1) {
      //   return toSchemaV3({ schema: members[0], context })
      // }

      return context.trace('allOf', () => toIntersection({ value, members, context }))
    })
    .with({ type: 'object' }, value => toObject({ value, context }))
    .with({ type: 'array' }, value => toArray({ value, context }))
    .with({ type: 'integer' }, value => toInteger({ value, context }))
    .with({ type: 'number' }, value => toNumber({ value, context }))
    .with({ type: 'boolean' }, value => toBoolean({ value, context }))
    .with({ type: 'string' }, value => toString({ value, context }))
    .otherwise(value => toUnknown({ value, context }))
}

type ToOptionalSchemaV3Args = {
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined
  context: ParseContext
}

export const toOptionalSchemaV3 = ({
  schema,
  context
}: ToOptionalSchemaV3Args): OasSchema | OasRef<'schema'> | undefined => {
  if (!schema) {
    return undefined
  }

  return toSchemaV3({ schema, context })
}
