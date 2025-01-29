import { ResolvedSchemaItem, SchemaItem } from '@/components/config/types'
import type { OpenAPIV3 } from 'openapi-types'
import invariant from 'tiny-invariant'

export const isRef = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): schema is OpenAPIV3.ReferenceObject => {
  return schema && '$ref' in schema
}

export const toRefNames = ({ $ref }: OpenAPIV3.ReferenceObject) => {
  const [_, refPath] = $ref.split('#')

  if (!refPath) {
    throw new Error(`Invalid reference: "${$ref}"`)
  }

  return refPath.split('/').filter(Boolean)
}

export const resolveRef = (ref: OpenAPIV3.ReferenceObject, fullSchema: OpenAPIV3.Document) => {
  const refNames = toRefNames(ref)

  const resolvedSchema = refNames.reduce((acc, refName) => {
    if (!(refName in acc)) {
      console.log('ACC', acc)

      throw new Error(`Reference "${ref.$ref}" not found in schema`)
    }
    // deno-lint-ignore ban-ts-comment
    // @ts-expect-error
    return acc[refName]
  }, fullSchema)

  return resolvedSchema as OpenAPIV3.SchemaObject
}

export const schemaToType = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): string => {
  if (isRef(schema)) {
    return toRefNames(schema).pop() ?? 'unknown'
  }

  if (schema.type === 'array') {
    return `array<${schemaToType(schema.items)}>`
  }

  if (!schema.type) {
    return 'unknown'
  }

  return schema.type
}

type ResolveSchemaItemArgs = {
  parsedSchema: OpenAPIV3.Document
  schemaItem: SchemaItem
}

export const resolveSchemaItem = ({
  parsedSchema,
  schemaItem
}: ResolveSchemaItemArgs): ResolvedSchemaItem => {
  const { schema } = schemaItem

  const name = isRef(schema) ? toRefNames(schema).pop() : schemaItem.name

  invariant(name, 'Name is required')

  return {
    ...schemaItem,
    name,
    schema: isRef(schema) ? resolveRef(schema, parsedSchema) : schema
  }
}
