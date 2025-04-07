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
import { toGetRef } from '../../helpers/refFns.ts'
import { mergeGroup } from '../_merge-all-of/merge-group.ts'

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
    .with({ allOf: P.array() }, allOf => {
      return context.trace('allOf', () => {
        const merged = mergeGroup({
          schema: allOf,
          getRef: toGetRef(context.documentObject),
          groupType: 'allOf'
        })

        if ('allOf' in merged) {
          console.log(JSON.stringify(merged, null, 2))

          throw new Error('Unexpected "allOf" in schema')
        }

        return toSchemaV3({ schema: merged, context })
      })
    })
    .with({ oneOf: P.array() }, oneOf => {
      return context.trace('oneOf', () => {
        const merged = mergeGroup({
          schema: oneOf,
          getRef: toGetRef(context.documentObject),
          groupType: 'oneOf'
        })

        if (!('oneOf' in merged) || !Array.isArray(merged.oneOf)) {
          throw new Error('Missing "oneOf" array')
        }

        const { oneOf: members, ...value } = merged

        return toUnion({ value, members, parentType: 'oneOf', context })
      })
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
      if (possibleObject(value)) {
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

      if (possibleArray(value)) {
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

      if (possibleBoolean(value)) {
        context.logWarningNoKey({
          message:
            'Object has a boolean "default" or "example" property, but is missing type="boolean" property',
          parent: value,
          type: 'MISSING_BOOLEAN_TYPE'
        })

        return toBoolean({
          value: {
            ...value,
            type: 'boolean'
          },
          context
        })
      }

      if (possibleString(value)) {
        context.logWarningNoKey({
          message:
            'Object has a string "default" or "example" property, but is missing type="string" property',
          parent: value,
          type: 'MISSING_STRING_TYPE'
        })

        return toString({
          value: {
            ...value,
            type: 'string'
          },
          context
        })
      }

      return toUnknown({ value, context })
    })
}

const possibleString = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    (('default' in value && typeof value.default === 'string') ||
      ('example' in value && typeof value.example === 'string'))
  )
}

const possibleBoolean = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    (('default' in value && typeof value.default === 'boolean') ||
      ('example' in value && typeof value.example === 'boolean'))
  )
}

const possibleArray = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    'items' in value &&
    value.items &&
    typeof value.items === 'object' &&
    value.items
  )
}

const possibleObject = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    'properties' in value &&
    typeof value.properties === 'object' &&
    value.properties
  )
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
