import type { OpenAPIV3 } from 'openapi-types'
import { decomposeAllOf } from './decompose-all-of.ts'
import { mergeTwoSchemas } from './merge-two-schemas.ts'
import type { GetRefFn } from './types.ts'
export const mergeAllOf = (
  schema: OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): OpenAPIV3.SchemaObject => {
  const decomposed = decomposeAllOf(schema)

  console.log('DECOMPOSED', JSON.stringify(decomposed, null, 2))
  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  console.log('DEREFFED', JSON.stringify(dereffed, null, 2))

  const result = dereffed.reduce((acc, decomposed) => {
    const merged = mergeTwoSchemas(acc, decomposed, getRef)

    console.log('MERGED', JSON.stringify(merged, null, 2))

    return merged
  }, {} as OpenAPIV3.SchemaObject)

  console.log('RESULT', JSON.stringify(result, null, 2))
  return result
}
