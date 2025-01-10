import type { OpenAPIV3 } from 'openapi-types'
import { isRef, resolveRef } from '@/lib/schemaFns'
import { match } from 'ts-pattern'
type IsSchemaSubsetArgs = {
  parentSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  childSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  topSchema: OpenAPIV3.SchemaObject
}
export const isSchemaSubset = ({
  parentSchema,
  childSchema,
  topSchema
}: IsSchemaSubsetArgs): boolean => {
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
