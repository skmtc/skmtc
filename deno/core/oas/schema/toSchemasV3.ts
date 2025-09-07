import { toRefV31 } from '../ref/toRefV31.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { match, P } from 'npm:ts-pattern@^5.8.0'
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
import { mergeIntersection } from '../_merge-all-of/merge-intersection.ts'
import { mergeUnion } from '../_merge-all-of/merge-union.ts'
import invariant from 'tiny-invariant'
type ToSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
  context: ParseContext
}

export const toSchemasV3 = ({
  schemas,
  context
}: ToSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> => {
  return Object.fromEntries(
    Object.entries(schemas)
      .map(([key, schema]) => {
        try {
          return [
            key,
            context.trace(key, () => {
              return toSchemaV3({ schema, context })
            })
          ]
        } catch (error) {
          invariant(error instanceof Error, 'Invalid error')

          context.logIssue({
            key,
            level: 'error',
            error,
            parent: schema,
            type: 'INVALID_SCHEMA'
          })

          return undefined
        }
      })
      .filter(item => item !== undefined)
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

  return match(schema)
    .with({ allOf: P.array() }, schema => {
      return context.trace('allOf', () => {
        const merged = mergeIntersection({
          schema,
          getRef: toGetRef(context.documentObject)
        })

        return toSchemaV3({ schema: merged, context })
      })
    })
    .with({ oneOf: P.array() }, oneOf => {
      return context.trace('oneOf', () => {
        const merged = mergeUnion({
          schema: oneOf,
          getRef: toGetRef(context.documentObject),
          groupType: 'oneOf'
        })

        if (!('oneOf' in merged) || !Array.isArray(merged.oneOf)) {
          throw new Error('Missing "oneOf" array')
        }

        const { oneOf: members, ...value } = merged

        if (members.length === 0) {
          throw new Error('"oneOf" array is empty')
        }

        if (members.length === 1) {
          return toSchemaV3({ schema: members[0], context })
        }

        return toUnion({ value, members, parentType: 'oneOf', context })
      })
    })
    .with({ anyOf: P.array() }, matched => {
      return context.trace('anyOf', () => {
        const _lastThree = context.stackTrail.slice(-3).toString()

        const _lastFive = context.stackTrail.slice(-5).toString()

        // deno-lint-ignore ban-ts-comment
        // @ts-expect-error
        if (matched['x-expansionResources']) {
          const { anyOf, ...value } = matched
          return toUnion({ value, members: anyOf, parentType: 'anyOf', context })
        }

        const merged = mergeUnion({
          schema: matched,
          getRef: toGetRef(context.documentObject),
          groupType: 'anyOf'
        })

        if (!('anyOf' in merged) || !Array.isArray(merged.anyOf)) {
          throw new Error('Missing "anyOf" array')
        }

        const { anyOf: members, ...value } = merged

        if (members.length === 0) {
          throw new Error('"anyOf" array is empty')
        }

        if (members.length === 1) {
          return toSchemaV3({ schema: members[0], context })
        }

        return toUnion({ value, members, parentType: 'anyOf', context })
      })
    })
    .with({ type: 'object' }, value => toObject({ value, context }))
    .with({ type: 'array' }, value => toArray({ value, context }))
    .with({ type: 'integer' }, value => toInteger({ value, context }))
    .with({ type: 'number' }, value => toNumber({ value, context }))
    .with({ type: 'boolean' }, value => toBoolean({ value, context }))
    .with({ type: 'string' }, value => toString({ value, context }))
    .otherwise(value => {
      if (possibleObject(value)) {
        context.logIssueNoKey({
          level: 'warning',
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
        context.logIssueNoKey({
          level: 'warning',
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
        context.logIssueNoKey({
          level: 'warning',
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
        context.logIssueNoKey({
          level: 'warning',
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
      ('example' in value && typeof value.example === 'string') ||
      ('enum' in value &&
        Array.isArray(value.enum) &&
        value.enum.every(item => typeof item === 'string')) ||
      ('format' in value &&
        typeof value.format === 'string' &&
        ['date', 'date-time', 'binary', 'byte'].includes(value.format)))
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
