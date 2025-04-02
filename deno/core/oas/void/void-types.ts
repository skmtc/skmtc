import * as v from 'valibot'

// Not an actual OAS type, but adding it here to
// transform to a void type during transform
export const oasVoidData = v.object({
  oasType: v.literal('schema'),
  description: v.optional(v.string()),
  type: v.literal('void')
})

export type OasVoidData = {
  oasType: 'schema'
  description?: string
  type: 'void'
}
