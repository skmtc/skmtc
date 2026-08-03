import { camelCase, capitalize, decapitalize, toEndpointName, type OasOperation } from '@skmtc/core'
import { join } from '@std/path'

export const toApiTag = (operation: OasOperation): string => {
  return operation.tags?.[0] ?? 'default'
}

export const toClientName = (tag: string): string => {
  return capitalize(camelCase(tag)) + 'Client'
}

export const toClientExportPath = (tag: string): string => {
  return join('@', 'client', `${toClientName(tag)}.generated.ts`)
}

export const toMethodName = (operation: OasOperation): string => {
  return decapitalize(toEndpointName(operation))
}
