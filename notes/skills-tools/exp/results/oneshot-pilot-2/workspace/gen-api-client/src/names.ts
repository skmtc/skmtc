import { camelCase, capitalize } from '@skmtc/core'
import type { OasOperation } from '@skmtc/core'

export const toClientName = (operation: OasOperation): string => {
  const [tag] = operation.tags ?? []

  return `${capitalize(camelCase(tag ?? 'api'))}Client`
}

export const toMethodName = ({ method, path }: OasOperation): string => {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map(segment =>
      segment.startsWith('{') && segment.endsWith('}')
        ? capitalize(camelCase(segment.slice(1, -1)))
        : capitalize(camelCase(segment))
    )
    .join('')

  return `${method.toLowerCase()}${segments}`
}
