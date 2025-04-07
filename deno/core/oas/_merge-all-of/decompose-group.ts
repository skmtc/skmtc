import type { OpenAPIV3 } from 'openapi-types'

type Output = {
  before: [string, any][]
  inside: OpenAPIV3.SchemaObject[]
  after: [string, any][]
}

type DecomposeGroupArgs = {
  schema: OpenAPIV3.SchemaObject
  groupType: 'oneOf' | 'anyOf' | 'allOf'
}

// Break up a schema into its constituent parts that can be merged individually into a new schema
export const decomposeGroup = ({
  schema,
  groupType
}: DecomposeGroupArgs): (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[] => {
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
    if (key === groupType) {
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
