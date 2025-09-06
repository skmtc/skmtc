import type { OasOperation } from '../oas/operation/Operation.ts'
import type { Brand } from './Brand.ts'
import type { RefName } from './RefName.ts'
import { type Method, isMethod } from './Method.ts'

/**
 * Template literal type for operation generator keys before branding.
 * Format: `generatorId|path|method` (e.g., 'api-client|/users|get')
 */
export type NakedOperationGeneratorKey = `${string}|${string}|${Method}`

/**
 * Template literal type for model generator keys before branding.
 * Format: `generatorId|refName` (e.g., 'typescript-models|User')
 */
export type NakedModelGeneratorKey = `${string}|${string}`

/**
 * Branded type for operation generator keys.
 * 
 * Operation generator keys uniquely identify generators that process
 * OpenAPI operations (HTTP methods on API paths). The key encodes
 * the generator ID, API path, and HTTP method.
 */
export type OperationGeneratorKey = Brand<
  NakedOperationGeneratorKey,
  'OperationGeneratorKey'
>

/**
 * Branded type for model generator keys.
 * 
 * Model generator keys uniquely identify generators that process
 * OpenAPI schema models. The key encodes the generator ID and
 * the schema reference name.
 */
export type ModelGeneratorKey = Brand<
  NakedModelGeneratorKey,
  'ModelGeneratorKey'
>

/**
 * Branded type for generator-only keys.
 * 
 * Generator-only keys identify generators that don't process specific
 * operations or models, but generate global artifacts like configuration
 * files, base classes, or utility modules.
 */
export type GeneratorOnlyKey = Brand<string, 'GeneratorOnlyKey'>

/**
 * Union type of all possible generator key types.
 * 
 * Generator keys serve as unique identifiers for different types of
 * code generators in the SKMTC system. They enable tracking, caching,
 * and dependency management between generated artifacts.
 * 
 * @example
 * ```typescript
 * // Operation generator key
 * const opKey: GeneratorKey = toOperationGeneratorKey({
 *   generatorId: 'api-client',
 *   path: '/users/{id}',
 *   method: 'get'
 * });
 * 
 * // Model generator key 
 * const modelKey: GeneratorKey = toModelGeneratorKey({
 *   generatorId: 'typescript-types',
 *   refName: 'User'
 * });
 * 
 * // Generator-only key
 * const globalKey: GeneratorKey = toGeneratorOnlyKey({
 *   generatorId: 'api-config'
 * });
 * ```
 */
export type GeneratorKey =
  | OperationGeneratorKey
  | ModelGeneratorKey
  | GeneratorOnlyKey

/**
 * Arguments for {@link toOperationGeneratorKey}.
 * 
 * Can specify operation details directly or provide an OasOperation
 * object from which the path and method will be extracted.
 */
type ToOperationGeneratorKeyArgs =
  | {
      /** Unique identifier for the generator */
      generatorId: string
      /** API path (e.g., '/users/{id}') */
      path: string
      /** HTTP method */
      method: Method
    }
  | {
      /** Unique identifier for the generator */
      generatorId: string
      /** OpenAPI operation object containing path and method */
      operation: OasOperation
    }

/**
 * Creates an operation generator key from generator ID and operation details.
 * 
 * Operation generator keys uniquely identify generators processing specific
 * API operations. The key format is: `generatorId|path|method`
 * 
 * @param args - Operation generator key arguments
 * @returns A branded OperationGeneratorKey
 * 
 * @example With explicit path and method
 * ```typescript
 * const key = toOperationGeneratorKey({
 *   generatorId: 'api-client',
 *   path: '/users/{id}',
 *   method: 'get'
 * });
 * // Result: 'api-client|/users/{id}|get' (branded)
 * ```
 * 
 * @example With OasOperation object
 * ```typescript
 * const operation = new OasOperation({
 *   path: '/posts',
 *   method: 'post',
 *   // ... other operation details
 * });
 * 
 * const key = toOperationGeneratorKey({
 *   generatorId: 'rest-client',
 *   operation
 * });
 * // Result: 'rest-client|/posts|post' (branded)
 * ```
 */
export const toOperationGeneratorKey = ({
  generatorId,
  ...rest
}: ToOperationGeneratorKeyArgs): OperationGeneratorKey => {
  const { path, method } = 'operation' in rest ? rest.operation : rest

  const nakedKey: NakedOperationGeneratorKey = `${generatorId}|${path}|${method}`

  return nakedKey as OperationGeneratorKey
}

/**
 * Arguments for {@link toModelGeneratorKey}.
 */
type ToModelGeneratorKeyArgs = {
  /** Unique identifier for the generator */
  generatorId: string
  /** Reference name of the schema model */
  refName: RefName
}

/**
 * Creates a model generator key from generator ID and schema reference name.
 * 
 * Model generator keys uniquely identify generators processing specific
 * OpenAPI schema models. The key format is: `generatorId|refName`
 * 
 * @param args - Model generator key arguments
 * @returns A branded ModelGeneratorKey
 * 
 * @example
 * ```typescript
 * const key = toModelGeneratorKey({
 *   generatorId: 'typescript-interfaces',
 *   refName: 'User'
 * });
 * // Result: 'typescript-interfaces|User' (branded)
 * 
 * const validationKey = toModelGeneratorKey({
 *   generatorId: 'zod-schemas', 
 *   refName: 'CreateUserRequest'
 * });
 * // Result: 'zod-schemas|CreateUserRequest' (branded)
 * ```
 */
export const toModelGeneratorKey = ({
  generatorId,
  refName
}: ToModelGeneratorKeyArgs): ModelGeneratorKey => {
  const nakedKey: NakedModelGeneratorKey = `${generatorId}|${refName}`

  return nakedKey as ModelGeneratorKey
}

/**
 * Arguments for {@link toGeneratorOnlyKey}.
 */
type ToGeneratorOnlyKeyArgs = {
  /** Unique identifier for the generator */
  generatorId: string
}

/**
 * Creates a generator-only key for global/utility generators.
 * 
 * Generator-only keys identify generators that produce artifacts not tied
 * to specific operations or models, such as configuration files, base classes,
 * utilities, or documentation.
 * 
 * @param args - Generator-only key arguments
 * @returns A branded GeneratorOnlyKey
 * 
 * @example
 * ```typescript
 * const configKey = toGeneratorOnlyKey({
 *   generatorId: 'api-config'
 * });
 * // Result: 'api-config' (branded)
 * 
 * const utilsKey = toGeneratorOnlyKey({
 *   generatorId: 'common-utilities'
 * });
 * // Result: 'common-utilities' (branded)
 * ```
 */
export const toGeneratorOnlyKey = ({
  generatorId
}: ToGeneratorOnlyKeyArgs): GeneratorOnlyKey => {
  const nakedKey: string = `${generatorId}`

  return nakedKey as GeneratorOnlyKey
}

/**
 * Type guard to check if a value is a valid GeneratorKey.
 * 
 * This function validates that the argument is one of the three
 * generator key types: operation, model, or generator-only.
 * 
 * @param arg - Value to check
 * @returns True if the value is a valid GeneratorKey
 * 
 * @example
 * ```typescript
 * const key = 'api-client|/users|get';
 * 
 * if (isGeneratorKey(key)) {
 *   // key is now typed as GeneratorKey
 *   const generatorId = toGeneratorId(key);
 *   console.log(generatorId); // 'api-client'
 * }
 * ```
 */
export const isGeneratorKey = (arg: unknown): arg is GeneratorKey => {
  return (
    isModelGeneratorKey(arg) ||
    isOperationGeneratorKey(arg) ||
    isGeneratorOnlyKey(arg)
  )
}

/**
 * Type guard to check if a value is a valid OperationGeneratorKey.
 * 
 * Validates that the argument is a string with the correct format:
 * `generatorId|path|method` where each part is non-empty and method
 * is a valid HTTP method.
 * 
 * @param arg - Value to check
 * @returns True if the value is a valid OperationGeneratorKey
 * 
 * @example
 * ```typescript
 * const key = 'api-client|/users/{id}|get';
 * 
 * if (isOperationGeneratorKey(key)) {
 *   // key is now typed as OperationGeneratorKey
 *   const obj = fromGeneratorKey(key);
 *   console.log(obj.type);        // 'operation'
 *   console.log(obj.generatorId); // 'api-client'
 *   console.log(obj.path);        // '/users/{id}'
 *   console.log(obj.method);      // 'get'
 * }
 * ```
 */
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

/**
 * Type guard to check if a value is a valid ModelGeneratorKey.
 * 
 * Validates that the argument is a string with the correct format:
 * `generatorId|refName` where both parts are non-empty strings.
 * 
 * @param arg - Value to check
 * @returns True if the value is a valid ModelGeneratorKey
 * 
 * @example
 * ```typescript
 * const key = 'zod-schemas|User';
 * 
 * if (isModelGeneratorKey(key)) {
 *   // key is now typed as ModelGeneratorKey
 *   const obj = fromGeneratorKey(key);
 *   console.log(obj.type);        // 'model'
 *   console.log(obj.generatorId); // 'zod-schemas'
 *   console.log(obj.refName);     // 'User'
 * }
 * ```
 */
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

/**
 * Type guard to check if a value is a valid GeneratorOnlyKey.
 * 
 * Validates that the argument is a non-empty string. Generator-only keys
 * are simple strings containing just the generator ID.
 * 
 * @param arg - Value to check
 * @returns True if the value is a valid GeneratorOnlyKey
 * 
 * @example
 * ```typescript
 * const key = 'api-config';
 * 
 * if (isGeneratorOnlyKey(key)) {
 *   // key is now typed as GeneratorOnlyKey
 *   const obj = fromGeneratorKey(key);
 *   console.log(obj.type);        // 'generator-only'
 *   console.log(obj.generatorId); // 'api-config'
 * }
 * ```
 */
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
