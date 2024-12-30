import "../_dnt.polyfills.js";
import type { OasOperation } from '../oas/operation/Operation.js'
import type { Brand } from './Brand.js'
import type { RefName } from './RefName.js'
import { type Method, isMethod } from './Method.js'

export type NakedOperationGeneratorKey = `${string}|${string}|${Method}`

export type NakedModelGeneratorKey = `${string}|${string}`

export type OperationGeneratorKey = Brand<
  NakedOperationGeneratorKey,
  'OperationGeneratorKey'
>

export type ModelGeneratorKey = Brand<
  NakedModelGeneratorKey,
  'ModelGeneratorKey'
>

export type GeneratorOnlyKey = Brand<string, 'GeneratorOnlyKey'>

export type GeneratorKey =
  | OperationGeneratorKey
  | ModelGeneratorKey
  | GeneratorOnlyKey

type ToOperationGeneratorKeyArgs =
  | {
      generatorId: string
      path: string
      method: Method
    }
  | {
      generatorId: string
      operation: OasOperation
    }

export const toOperationGeneratorKey = ({
  generatorId,
  ...rest
}: ToOperationGeneratorKeyArgs): OperationGeneratorKey => {
  const { path, method } = 'operation' in rest ? rest.operation : rest

  const nakedKey: NakedOperationGeneratorKey = `${generatorId}|${path}|${method}`

  return nakedKey as OperationGeneratorKey
}

type ToModelGeneratorKeyArgs = {
  generatorId: string
  refName: RefName
}

export const toModelGeneratorKey = ({
  generatorId,
  refName
}: ToModelGeneratorKeyArgs): ModelGeneratorKey => {
  const nakedKey: NakedModelGeneratorKey = `${generatorId}|${refName}`

  return nakedKey as ModelGeneratorKey
}

type ToGeneratorOnlyKeyArgs = {
  generatorId: string
}

export const toGeneratorOnlyKey = ({
  generatorId
}: ToGeneratorOnlyKeyArgs): GeneratorOnlyKey => {
  const nakedKey: string = `${generatorId}`

  return nakedKey as GeneratorOnlyKey
}

export const isGeneratorKey = (arg: unknown): arg is GeneratorKey => {
  return (
    isModelGeneratorKey(arg) ||
    isOperationGeneratorKey(arg) ||
    isGeneratorOnlyKey(arg)
  )
}

export const isOperationGeneratorKey = (
  arg: unknown
): arg is OperationGeneratorKey => {
  if (typeof arg !== 'string') {
    return false
  }

  const keyTokens = arg.split('|')

  if (keyTokens.length !== 3) {
    return false
  }

  const [generatorId, path, method] = keyTokens

  if (typeof generatorId !== 'string' || !generatorId.length) {
    return false
  }

  if (typeof path !== 'string' || !path.length) {
    return false
  }

  if (!isMethod(method)) {
    return false
  }

  return true
}

export const isModelGeneratorKey = (arg: unknown): arg is ModelGeneratorKey => {
  if (typeof arg !== 'string') {
    return false
  }

  const keyTokens = arg.split('|')

  if (keyTokens.length !== 2) {
    return false
  }

  const [generatorId, refName] = keyTokens

  if (typeof generatorId !== 'string' || !generatorId.length) {
    return false
  }

  if (typeof refName !== 'string' || !refName.length) {
    return false
  }

  return true
}

export const isGeneratorOnlyKey = (arg: unknown): arg is GeneratorOnlyKey => {
  if (typeof arg !== 'string') {
    return false
  }

  return Boolean(arg.length)
}

export const toGeneratorId = (generatorKey: GeneratorKey): string => {
  if (isOperationGeneratorKey(generatorKey)) {
    return generatorKey.split('|')[0]
  }

  if (isModelGeneratorKey(generatorKey)) {
    return generatorKey.split('|')[0]
  }

  return generatorKey
}

export type GeneratorKeyObject =
  | {
      type: 'operation'
      generatorId: string
      path: string
      method: Method
    }
  | {
      type: 'model'
      generatorId: string
      refName: string
    }
  | {
      type: 'generator-only'
      generatorId: string
    }

export const fromGeneratorKey = (
  generatorKey: GeneratorKey
): GeneratorKeyObject => {
  if (isOperationGeneratorKey(generatorKey)) {
    const [generatorId, path, method] = generatorKey.split('|')
    return { type: 'operation', generatorId, path, method: method as Method }
  }

  if (isModelGeneratorKey(generatorKey)) {
    const [generatorId, refName] = generatorKey.split('|')
    return { type: 'model', generatorId, refName }
  }

  return { type: 'generator-only', generatorId: generatorKey }
}
