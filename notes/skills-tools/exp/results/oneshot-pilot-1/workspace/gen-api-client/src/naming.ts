import { camelCase, capitalize } from '@skmtc/core'
import type { OasOperation } from '@skmtc/core'

export const toClientName = (operation: OasOperation): string => {
  const [tag] = operation.tags ?? []

  return `${capitalize(camelCase(tag ?? 'api'))}Client`
}

export const toMethodName = (operation: OasOperation): string => {
  const segments = operation.path
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => capitalize(camelCase(segment.replaceAll('{', '').replaceAll('}', ''))))
    .join('')

  return `${operation.method.toLowerCase()}${segments}`
}
