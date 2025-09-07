import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'

type CompareSchemaArgs = {
  parentSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  childSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  topSchema: OpenAPIV3.SchemaObject
}
/**
 * Determines if a child schema is a subset of a parent schema.
 * 
 * Performs structural comparison between OpenAPI schemas to determine
 * if the child schema is compatible with and more restrictive than
 * the parent schema. This is useful for schema validation, inheritance,
 * and compatibility checking in API evolution scenarios.
 * 
 * @param args - Arguments containing schemas to compare
 * @returns True if child schema is a valid subset of parent schema
 * 
 * @example Basic type compatibility
 * ```typescript
 * const parentSchema = { type: 'string' };
 * const childSchema = { type: 'string', maxLength: 100 };
 * 
 * const isCompatible = isSchemaSubset({
 *   parentSchema,
 *   childSchema,
 *   topSchema: parentSchema
 * });
 * console.log(isCompatible); // true - child is more restrictive
 * ```
 * 
 * @example Object property compatibility
 * ```typescript
 * const parentSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' }
 *   },
 *   required: ['name']
 * };
 * 
 * const childSchema = {
 *   type: 'object', 
 *   properties: {
 *     name: { type: 'string', minLength: 1 },
 *     age: { type: 'integer', minimum: 0 },
 *     email: { type: 'string', format: 'email' }
 *   },
 *   required: ['name', 'age']
 * };
 * 
 * const result = isSchemaSubset({
 *   parentSchema,
 *   childSchema,
 *   topSchema: parentSchema
 * });
 * console.log(result); // true - child maintains required fields and adds constraints
 * ```
 */
export const isSchemaSubset = ({
  parentSchema,
  childSchema,
  topSchema
}: CompareSchemaArgs): boolean => {
  if (!childSchema) {
    return false
  }

  if (isRef(parentSchema)) {
    parentSchema = resolveRef(parentSchema, topSchema)
  }

  if (isRef(childSchema)) {
    childSchema = resolveRef(childSchema, topSchema)
  }

  return match(parentSchema)
    .with({ type: 'string' }, () => {
      return childSchema.type === 'string'
    })
    .with({ type: 'number' }, () => {
      return childSchema.type === 'number' || childSchema.type === 'integer'
    })
    .with({ type: 'integer' }, () => {
      return childSchema.type === 'integer'
    })
    .with({ type: 'boolean' }, () => {
      return childSchema.type === 'boolean'
    })
    .with({ type: 'array' }, ({ items }) => {
      return (
        childSchema.type === 'array' &&
        isSchemaSubset({
          parentSchema: items,
          childSchema: childSchema?.items,
          topSchema
        })
      )
    })

    .with({ type: 'object' }, () => {
      if (childSchema.type !== 'object') {
        return false
      }

      const parentPropertyEntries = Object.entries(parentSchema?.properties || {})

      for (const [key, value] of parentPropertyEntries) {
        if (parentSchema.required?.includes(key)) {
          if (!childSchema?.properties || !(key in childSchema.properties)) {
            return false
          }

          if (!childSchema.required?.includes(key)) {
            return false
          }

          if (
            !isSchemaSubset({
              parentSchema: value,
              childSchema: childSchema.properties[key],
              topSchema
            })
          ) {
            return false
          }
        } else {
          if (
            childSchema?.properties?.[key] &&
            !isSchemaSubset({
              parentSchema: value,
              childSchema: childSchema.properties[key],
              topSchema
            })
          ) {
            return false
          }
        }
      }

      return true
    })
    .otherwise(() => {
      return false
    })
}

const isRef = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): schema is OpenAPIV3.ReferenceObject => {
  return schema && '$ref' in schema
}

const toRefNames = ({ $ref }: OpenAPIV3.ReferenceObject) => {
  const [_, refPath] = $ref.split('#')

  if (!refPath) {
    throw new Error(`Invalid reference: "${$ref}"`)
  }

  return refPath.split('/').filter(Boolean)
}

const resolveRef = (ref: OpenAPIV3.ReferenceObject, topSchema: OpenAPIV3.SchemaObject) => {
  const refNames = toRefNames(ref)

  return refNames.reduce((acc, refName) => {
    if (!(refName in acc)) {
      throw new Error(`Reference "${ref.$ref}" not found in schema`)
    }
    // deno-lint-ignore ban-ts-comment
    // @ts-expect-error
    return acc[refName] as unknown as OpenAPIV3.SchemaObject
  }, topSchema)
}
