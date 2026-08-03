import { camelCase, capitalize, decapitalize, toEndpointName, type OasOperation } from '@skmtc/core'
import { join } from '@std/path'

export const toApiTag = (operation: OasOperation): string => {
  return operation.tags?.[0] ?? 'default'
}

/*SLOT:naming*/
