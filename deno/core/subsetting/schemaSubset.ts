import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'

type CompareSchemaArgs = {
  parentSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  childSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  topSchema: OpenAPIV3.SchemaObject
}
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
  return '$ref' in schema
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
