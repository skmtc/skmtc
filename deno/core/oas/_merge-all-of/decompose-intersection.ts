import type { OpenAPIV3 } from 'openapi-types'

type Output = {
  before: [string, any][]
  inside: OpenAPIV3.SchemaObject[]
  after: [string, any][]
}

type DecomposeIntersectionArgs = {
  schema: OpenAPIV3.SchemaObject
}

// Convert a schema object into an array of schemas that can be merged iteratively into a new schema
export const decomposeIntersection = ({
  schema
}: DecomposeIntersectionArgs): (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[] => {
  if (!schema.allOf) {
    return [schema]
  }

  let location: 'before' | 'inside' | 'after' = 'before'

  const output: Output = {
    before: [],
    inside: [],
    after: []
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'allOf') {
      // do not decompose wrapper for unions (oneOf, anyOf)
      output.inside = value
      location = 'after'
    } else {
      output[location].push([key, value])
    }
  }

  return [
    output.before.length > 0 ? Object.fromEntries(output.before) : undefined,
    ...output.inside,
    output.after.length > 0 ? Object.fromEntries(output.after) : undefined
  ].filter(item => item !== undefined)
}
