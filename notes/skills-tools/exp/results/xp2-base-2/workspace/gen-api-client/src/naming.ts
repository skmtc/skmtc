import { camelCase, capitalize } from '@skmtc/core'
import type { OasOperation } from '@skmtc/core'
import { join } from '@std/path'

export const toClientTag = (operation: OasOperation): string => {
  return operation.tags?.[0] ?? 'api'
}

export const toClientName = (operation: OasOperation): string => {
  return `${capitalize(camelCase(toClientTag(operation)))}Client`
}

export const toClientExportPath = (operation: OasOperation): string => {
  return join('@', 'client', `${toClientName(operation)}.generated.ts`)
}

export const toMethodName = (operation: OasOperation): string => {
  return camelCase(`${operation.method} ${operation.path}`)
}
