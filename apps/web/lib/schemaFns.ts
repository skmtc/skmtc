import type { OpenAPIV3 } from 'openapi-types'

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

export const resolveRef = (ref: OpenAPIV3.ReferenceObject, topSchema: OpenAPIV3.SchemaObject) => {
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

export const schemaToType = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => {
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
