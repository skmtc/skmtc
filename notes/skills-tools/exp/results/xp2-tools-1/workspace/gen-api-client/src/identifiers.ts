import { camelCase } from '@skmtc/core'
import type { OasOperation } from '@skmtc/core'
import { join } from '@std/path'

export const toClientName = (tag: string): string => {
  return `${camelCase(tag, { upperFirst: true })}Client`
}

export const toClientPath = (tag: string): string => {
  return join('@', 'client', `${toClientName(tag)}.generated.ts`)
}

export const toMethodName = (operation: OasOperation): string => {
  return `${operation.method}${camelCase(operation.path, { upperFirst: true })}`
}
