import type { RefName } from '../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ReferenceObject } from '../oas/_merge-all-of/types.ts'

export const toRefName = ($ref: string): RefName => {
  // TODO: Add validation here to ensure reference exists
  const refName = $ref.split('/').slice(-1)[0]

  if (!refName) {
    throw new Error('Invalid reference')
  }

  return refName as RefName
}

type Ref = {
  $ref: string
}

export const isRef = (value: unknown): value is Ref => {
  if (value && typeof value === 'object' && '$ref' in value && typeof value.$ref === 'string') {
    return true
  } else {
    return false
  }
}

export const toGetRef =
  (oasDocument: OpenAPIV3.Document) =>
  ({ $ref }: ReferenceObject): OpenAPIV3.SchemaObject => {
    const refName = toRefName($ref)

    const item = oasDocument.components?.schemas?.[refName]

    if (isRef(item)) {
      return toGetRef(oasDocument)(item)
    }

    if (item) {
      return item
    }

    throw new Error(`Invalid reference: ${$ref}`)
  }
