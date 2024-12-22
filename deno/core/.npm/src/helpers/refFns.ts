import type { RefName } from '../types/RefName.js'

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
  if (
    value &&
    typeof value === 'object' &&
    '$ref' in value &&
    typeof value.$ref === 'string'
  ) {
    return true
  } else {
    return false
  }
}
