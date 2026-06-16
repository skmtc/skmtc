import type { SchemaObject, ReferenceObject } from './types.ts'

type Output = {
  before: [string, unknown][]
  inside: SchemaObject[]
  after: [string, unknown][]
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
    console.log('NO GROUP TYPE', JSON.stringify(schema, null, 2))

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

  const result = {
    beforeExcluded: Object.fromEntries(beforeExcluded),
    decomposed,
    afterExcluded: Object.fromEntries(afterExcluded)
  }

  return result
}

// Kept on the union (via beforeExcluded/afterExcluded) rather than
// cross-product-merged into each member. Two reasons a key lands here:
//   - Union-level metadata: merging it *into* a member resolves `$ref`
//     members (to merge the metadata in), losing their names — `toUnion`
//     already captures this metadata on the union itself.
//   - Non-distributable constraints (`not`): they have no per-member meaning
//     and `mergeSchemasOrRefs` cannot merge them, so distributing them throws
//     for every member and collapses the union to an empty array. TypeScript
//     can't model `not` anyway, so it rides the union wrapper, ignored.
const excludedProperties = [
  'discriminator',
  'default',
  'description',
  'title',
  'nullable',
  'example',
  'examples',
  'readOnly',
  'writeOnly',
  'deprecated',
  'not'
]

type ExcludeOutput = {
  retained: [string, unknown][]
  excluded: [string, unknown][]
}

const exclude = (entries: [string, unknown][]): ExcludeOutput => {
  return entries.reduce<ExcludeOutput>(
    (acc, [key, value]) => {
      if (excludedProperties.includes(key)) {
        acc.excluded.push([key, value])
      } else {
        acc.retained.push([key, value])
      }

      return acc
    },
    { retained: [], excluded: [] }
  )
}
