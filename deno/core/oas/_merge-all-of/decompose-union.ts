import type { SchemaObject, ReferenceObject } from './types.ts'

type Output = {
  before: [string, any][]
  inside: SchemaObject[]
  after: [string, any][]
}

type DecomposeUnionArgs = {
  schema: SchemaObject
  groupType: 'oneOf' | 'anyOf'
}

type DecomposeUnionReturn = {
  beforeExcluded: SchemaObject
  decomposed: (SchemaObject | ReferenceObject)[]
  afterExcluded: SchemaObject
}

// Convert a schema object into an array of schemas that can be merged iteratively into a new schema
export const decomposeUnion = ({ schema, groupType }: DecomposeUnionArgs): DecomposeUnionReturn => {
  if (!schema[groupType]) {
    return {
      beforeExcluded: {},
      decomposed: [schema],
      afterExcluded: {}
    }
  }

  let location: 'before' | 'inside' | 'after' = 'before'

  const output: Output = {
    before: [],
    inside: [],
    after: []
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === groupType) {
      // do not decompose wrapper for unions (oneOf, anyOf)
      output.inside = [{ [groupType]: value }]
      location = 'after'
    } else {
      output[location].push([key, value])
    }
  }

  const { retained: before, excluded: beforeExcluded } = exclude(output.before)
  const { retained: after, excluded: afterExcluded } = exclude(output.after)

  const decomposed = [
    before.length > 0 ? Object.fromEntries(before) : undefined,
    ...output.inside,
    after.length > 0 ? Object.fromEntries(after) : undefined
  ].filter(item => item !== undefined)

  return {
    beforeExcluded: Object.fromEntries(beforeExcluded),
    decomposed,
    afterExcluded: Object.fromEntries(afterExcluded)
  }
}

const excludedProperties = ['discriminator', 'default']

type ExcludeOutput = {
  retained: [string, any][]
  excluded: [string, any][]
}

const exclude = (entries: [string, any][]): ExcludeOutput => {
  return entries.reduce<ExcludeOutput>(
    (acc, [key, value]) => {
      if (excludedProperties.includes(key)) {
        acc.retained.push([key, value])
      } else {
        acc.excluded.push([key, value])
      }

      return acc
    },
    { retained: [], excluded: [] }
  )
}
