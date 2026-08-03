import { camelCase, capitalize, decapitalize } from '@skmtc/core'
import type { OasOperation } from '@skmtc/core'
import { join } from '@std/path'

/** The grouping tag for an operation; untagged operations share an `Api` client. */
export const toTag = (operation: OasOperation): string => {
  return operation.tags?.[0] ?? 'api'
}

/** `orders` → `OrdersClient` */
export const toClientName = (operation: OasOperation): string => {
  return `${capitalize(camelCase(toTag(operation)))}Client`
}

/** `orders` → `@/client/OrdersClient.generated.ts` */
export const toClientPath = (operation: OasOperation): string => {
  return join('@', 'client', `${toClientName(operation)}.generated.ts`)
}

/** `GET /orders/{id}` → `getOrdersId` */
export const toMethodName = (operation: OasOperation): string => {
  const segments = operation.path
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => segment.replaceAll(/[{}]/g, ''))

  const joined = [operation.method, ...segments]
    .map(segment => capitalize(camelCase(segment)))
    .join('')

  return decapitalize(joined)
}
