import { toRefV31 } from '../ref/toRefV31.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
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

type ToSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
  context: ParseContext
}

export const toSchemasV3 = ({
  schemas,
  context
}: ToSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> => {
  return Object.fromEntries(
    Object.entries(schemas).map(([key, schema]) => {
      return [
        key,
        context.trace(key, () => {
          return toSchemaV3({ schema, context })
        })
      ]
    })
  )
}

type ToOptionalSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> | undefined
  context: ParseContext
}

export const toOptionalSchemasV3 = ({
  schemas,
  context
}: ToOptionalSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> | undefined => {
  if (!schemas) {
    return undefined
  }

  return toSchemasV3({ schemas, context })
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
    .with({ allOf: P.array() }, () => {
      // if (members.length === 1) {
      //   return toSchemaV3({ schema: members[0], context })
      // }

      throw new Error('Unexpected "allOf" schema')

      // const merged = merge(schema, {
      //   source: context.documentObject,
      //   rules: openApiMergeRules('3.0.x'),
      //   mergeRefSibling: true
      // }) as OpenAPIV3.SchemaObject

      // return toSchemaV3({ schema: merged, context })
    })
    .with({ oneOf: P.array() }, ({ oneOf: members, ...value }) => {
      return toUnion({ value, members, parentType: 'oneOf', context })
    })
    .with({ anyOf: P.array() }, ({ anyOf: members, ...value }) => {
      return context.trace('anyOf', () => toUnion({ value, members, parentType: 'anyOf', context }))
    })
    .with({ type: 'object' }, value => toObject({ value, context }))
    .with({ type: 'array' }, value => toArray({ value, context }))
    .with({ type: 'integer' }, value => toInteger({ value, context }))
    .with({ type: 'number' }, value => toNumber({ value, context }))
    .with({ type: 'boolean' }, value => toBoolean({ value, context }))
    .with({ type: 'string' }, value => toString({ value, context }))
    .otherwise(value => {
      if (
        value &&
        'properties' in value &&
        typeof value.properties === 'object' &&
        value.properties
      ) {
        context.logWarningNoKey({
          message: 'Object has "properties" property, but is missing type="object" property',
          parent: value,
          type: 'MISSING_OBJECT_TYPE'
        })

        return toObject({
          value: {
            ...value,
            type: 'object'
          },
          context
        })
      }

      if (
        value &&
        'items' in value &&
        value.items &&
        typeof value.items === 'object' &&
        value.items
      ) {
        context.logWarningNoKey({
          message: 'Object has "items" property, but is missing type="array" property',
          parent: value,
          type: 'MISSING_ARRAY_TYPE'
        })

        return toArray({
          value: {
            ...value,
            type: 'array'
            // Adding cast here since {} is a valid value for items
          } as OpenAPIV3.ArraySchemaObject,
          context
        })
      }

      return toUnknown({ value, context })
    })
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
