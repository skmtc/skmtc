/**
 * @fileoverview Generator Key System for SKMTC Core
 *
 * This module provides a comprehensive type-safe key system for identifying and
 * organizing generated content within the SKMTC pipeline. Generator keys provide
 * unique identification for operations, models, and other generated artifacts,
 * ensuring proper organization and preventing collisions.
 *
 * The key system uses branded types to ensure type safety and provides utilities
 * for creating, parsing, and manipulating keys throughout the generation process.
 *
 * ## Key Features
 *
 * - **Type Safety**: Branded types prevent mixing different kinds of keys
 * - **Unique Identification**: Composite keys ensure global uniqueness
 * - **Parsing Utilities**: Safe extraction of components from composite keys
 * - **Generator Organization**: Clear mapping between generators and their artifacts
 * - **Reference Integration**: Seamless integration with OpenAPI reference system
 *
 * @example Creating operation generator keys
 * ```typescript
 * import { toOasOperationGeneratorKey, parseOperationGeneratorKey } from '@skmtc/core/GeneratorKeys';
 *
 * // Create a key for a GET /users operation in api-client generator
 * const key = toOasOperationGeneratorKey({
 *   generatorId: 'api-client',
 *   path: '/users',
 *   method: 'GET'
 * });
 *
 * // Parse the key back into components
 * const parsed = parseOperationGeneratorKey(key);
 * console.log(parsed); // { generatorId: 'api-client', path: '/users', method: 'GET' }
 * ```
 *
 * @example Working with model keys
 * ```typescript
 * import { toModelGeneratorKey } from '@skmtc/core/GeneratorKeys';
 *
 * const modelKey = toModelGeneratorKey({
 *   generatorId: 'typescript-models',
 *   refName: 'User' as RefName
 * });
 * ```
 *
 * @example Type-safe key handling
 * ```typescript
 * import type { OasOperationGeneratorKey, ModelGeneratorKey } from '@skmtc/core/GeneratorKeys';
 *
 * function handleOperationKey(key: OasOperationGeneratorKey) {
 *   // TypeScript ensures this is specifically an operation key
 *   const parsed = parseOperationGeneratorKey(key);
 *   return `Processing ${parsed.method} ${parsed.path}`;
 * }
 *
 * function handleModelKey(key: ModelGeneratorKey) {
 *   // TypeScript ensures this is specifically a model key
 *   const parsed = parseModelGeneratorKey(key);
 *   return `Processing model ${parsed.refName}`;
 * }
 * ```
 *
 * @module GeneratorKeys
 */

import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { GqlOperation, GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import type { Brand } from '@/types/Brand.ts'
import type { RefName } from '@/types/RefName.ts'
import { type Method, isMethod } from '@/types/Method.ts'

const GQL_ROOT_KINDS: readonly GqlRootKind[] = ['query', 'mutation', 'subscription']

const isGqlRootKind = (value: string): value is GqlRootKind =>
  (GQL_ROOT_KINDS as readonly string[]).includes(value)

/**
 * Template literal type for OAS operation generator keys before branding.
 * Format: `generatorId|path|method` (e.g., 'api-client|/users|get')
 */
export type NakedOasOperationGeneratorKey = `${string}|${string}|${Method}`

/**
 * Template literal type for GraphQL operation generator keys before branding.
 * Format: `generatorId|rootKind|fieldName`
 * (e.g., 'graphql-client|query|getUser', 'graphql-client|mutation|createPost').
 */
export type NakedGqlOperationGeneratorKey = `${string}|${GqlRootKind}|${string}`

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
export type OasOperationGeneratorKey = Brand<NakedOasOperationGeneratorKey, 'OasOperationGeneratorKey'>

/**
 * Branded type for GraphQL operation generator keys.
 *
 * Sibling to {@link OasOperationGeneratorKey} for the GraphQL protocol. The key
 * encodes the generator ID, the root kind (`query` / `mutation` /
 * `subscription`), and the root field name.
 */
export type GqlOperationGeneratorKey = Brand<
  NakedGqlOperationGeneratorKey,
  'GqlOperationGeneratorKey'
>

/**
 * Branded type for model generator keys.
 *
 * Model generator keys uniquely identify generators that process
 * OpenAPI schema models. The key encodes the generator ID and
 * the schema reference name.
 */
export type ModelGeneratorKey = Brand<NakedModelGeneratorKey, 'ModelGeneratorKey'>

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
 * const opKey: GeneratorKey = toOasOperationGeneratorKey({
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
  | OasOperationGeneratorKey
  | GqlOperationGeneratorKey
  | ModelGeneratorKey
  | GeneratorOnlyKey

/**
 * Arguments for {@link toOasOperationGeneratorKey}.
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
 * @returns A branded OasOperationGeneratorKey
 *
 * @example With explicit path and method
 * ```typescript
 * const key = toOasOperationGeneratorKey({
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
 * const key = toOasOperationGeneratorKey({
 *   generatorId: 'rest-client',
 *   operation
 * });
 * // Result: 'rest-client|/posts|post' (branded)
 * ```
 */
export const toOasOperationGeneratorKey = ({
  generatorId,
  ...rest
}: ToOperationGeneratorKeyArgs): OasOperationGeneratorKey => {
  const { path, method } = 'operation' in rest ? rest.operation : rest

  const nakedKey: NakedOasOperationGeneratorKey = `${generatorId}|${path}|${method}`

  return nakedKey as OasOperationGeneratorKey
}

/**
 * Arguments for {@link toGqlOperationGeneratorKey}.
 *
 * Can specify operation details directly or provide a {@link GqlOperation}
 * object from which the root kind and field name will be extracted.
 */
type ToGqlOperationGeneratorKeyArgs =
  | {
      /** Unique identifier for the generator */
      generatorId: string
      /** GraphQL root kind */
      rootKind: GqlRootKind
      /** Root field name */
      fieldName: string
    }
  | {
      /** Unique identifier for the generator */
      generatorId: string
      /** GraphQL operation object */
      operation: GqlOperation
    }

/**
 * Creates a GraphQL operation generator key.
 *
 * Sibling to {@link toOasOperationGeneratorKey} for the GraphQL protocol. Format:
 * `generatorId|rootKind|fieldName`.
 */
export const toGqlOperationGeneratorKey = ({
  generatorId,
  ...rest
}: ToGqlOperationGeneratorKeyArgs): GqlOperationGeneratorKey => {
  const { rootKind, fieldName } =
    'operation' in rest
      ? { rootKind: rest.operation.rootKind, fieldName: rest.operation.fieldName }
      : rest

  const nakedKey: NakedGqlOperationGeneratorKey = `${generatorId}|${rootKind}|${fieldName}`

  return nakedKey as GqlOperationGeneratorKey
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
export const toGeneratorOnlyKey = ({ generatorId }: ToGeneratorOnlyKeyArgs): GeneratorOnlyKey => {
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
    isOasOperationGeneratorKey(arg) ||
    isGqlOperationGeneratorKey(arg) ||
    isGeneratorOnlyKey(arg)
  )
}

/**
 * Type guard to check if a value is a valid OasOperationGeneratorKey.
 *
 * Validates that the argument is a string with the correct format:
 * `generatorId|path|method` where each part is non-empty and method
 * is a valid HTTP method.
 *
 * @param arg - Value to check
 * @returns True if the value is a valid OasOperationGeneratorKey
 *
 * @example
 * ```typescript
 * const key = 'api-client|/users/{id}|get';
 *
 * if (isOasOperationGeneratorKey(key)) {
 *   // key is now typed as OasOperationGeneratorKey
 *   const obj = fromGeneratorKey(key);
 *   console.log(obj.type);        // 'oasOperation'
 *   console.log(obj.generatorId); // 'api-client'
 *   console.log(obj.path);        // '/users/{id}'
 *   console.log(obj.method);      // 'get'
 * }
 * ```
 */
export const isOasOperationGeneratorKey = (arg: unknown): arg is OasOperationGeneratorKey => {
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
 * Type guard to check if a value is a valid {@link GqlOperationGeneratorKey}.
 *
 * Validates that the argument is a string with the format
 * `generatorId|rootKind|fieldName`, with `rootKind` constrained to a
 * GraphQL root operation kind (`query` / `mutation` / `subscription`).
 */
export const isGqlOperationGeneratorKey = (arg: unknown): arg is GqlOperationGeneratorKey => {
  if (typeof arg !== 'string') {
    return false
  }

  const keyTokens = arg.split('|')

  if (keyTokens.length !== 3) {
    return false
  }

  const [generatorId, rootKind, fieldName] = keyTokens

  if (typeof generatorId !== 'string' || !generatorId.length) {
    return false
  }

  if (typeof rootKind !== 'string' || !isGqlRootKind(rootKind)) {
    return false
  }

  if (typeof fieldName !== 'string' || !fieldName.length) {
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

/**
 * Extracts the generator ID from any type of GeneratorKey.
 *
 * This utility function parses the generator key to extract just the
 * generator identifier, regardless of the key type. For operation and
 * model keys, it extracts the first part before the pipe. For generator-only
 * keys, it returns the entire key since it's just the generator ID.
 *
 * @param generatorKey - Any type of generator key
 * @returns The generator ID string
 *
 * @example
 * ```typescript
 * const opKey = toOasOperationGeneratorKey({
 *   generatorId: 'api-client',
 *   path: '/users',
 *   method: 'get'
 * });
 * console.log(toGeneratorId(opKey)); // 'api-client'
 *
 * const modelKey = toModelGeneratorKey({
 *   generatorId: 'typescript-types',
 *   refName: 'User'
 * });
 * console.log(toGeneratorId(modelKey)); // 'typescript-types'
 *
 * const globalKey = toGeneratorOnlyKey({
 *   generatorId: 'utilities'
 * });
 * console.log(toGeneratorId(globalKey)); // 'utilities'
 * ```
 */
export const toGeneratorId = (generatorKey: GeneratorKey): string => {
  if (isOasOperationGeneratorKey(generatorKey)) {
    return generatorKey.split('|')[0]
  }

  if (isGqlOperationGeneratorKey(generatorKey)) {
    return generatorKey.split('|')[0]
  }

  if (isModelGeneratorKey(generatorKey)) {
    return generatorKey.split('|')[0]
  }

  return generatorKey
}

/**
 * Object representation of a parsed GeneratorKey.
 *
 * This discriminated union type represents the parsed components of any
 * generator key, making it easier to work with key data in a structured way.
 * The `type` field discriminates between the three key types.
 */
export type GeneratorKeyObject =
  | {
      /** Discriminator for OAS operation generator keys */
      type: 'oasOperation'
      /** Generator identifier */
      generatorId: string
      /** API path */
      path: string
      /** HTTP method */
      method: Method
    }
  | {
      /** Discriminator for GraphQL operation generator keys */
      type: 'gqlOperation'
      /** Generator identifier */
      generatorId: string
      /** GraphQL root kind */
      rootKind: GqlRootKind
      /** Root field name */
      fieldName: string
    }
  | {
      /** Discriminator for model generator keys */
      type: 'model'
      /** Generator identifier */
      generatorId: string
      /** Schema reference name */
      refName: string
    }
  | {
      /** Discriminator for generator-only keys */
      type: 'generator-only'
      /** Generator identifier */
      generatorId: string
    }

/**
 * Parses a GeneratorKey into its structured object representation.
 *
 * This function decomposes any generator key into a structured object
 * with discriminated union types, making it easier to work with the
 * key components in a type-safe manner.
 *
 * @param generatorKey - Any type of generator key to parse
 * @returns Parsed generator key object with discriminated type
 *
 * @example Operation key parsing
 * ```typescript
 * const opKey = 'api-client|/users/{id}|get' as OasOperationGeneratorKey;
 * const parsed = fromGeneratorKey(opKey);
 *
 * if (parsed.type === 'operation') {
 *   console.log(parsed.generatorId); // 'api-client'
 *   console.log(parsed.path);        // '/users/{id}'
 *   console.log(parsed.method);      // 'get'
 * }
 * ```
 *
 * @example Model key parsing
 * ```typescript
 * const modelKey = 'zod-schemas|User' as ModelGeneratorKey;
 * const parsed = fromGeneratorKey(modelKey);
 *
 * if (parsed.type === 'model') {
 *   console.log(parsed.generatorId); // 'zod-schemas'
 *   console.log(parsed.refName);     // 'User'
 * }
 * ```
 *
 * @example Generator-only key parsing
 * ```typescript
 * const globalKey = 'utilities' as GeneratorOnlyKey;
 * const parsed = fromGeneratorKey(globalKey);
 *
 * if (parsed.type === 'generator-only') {
 *   console.log(parsed.generatorId); // 'utilities'
 * }
 * ```
 */
export const fromGeneratorKey = (generatorKey: GeneratorKey): GeneratorKeyObject => {
  if (isOasOperationGeneratorKey(generatorKey)) {
    const [generatorId, path, method] = generatorKey.split('|')
    return { type: 'oasOperation', generatorId, path, method: method as Method }
  }

  if (isGqlOperationGeneratorKey(generatorKey)) {
    const [generatorId, rootKind, fieldName] = generatorKey.split('|')
    return {
      type: 'gqlOperation',
      generatorId,
      rootKind: rootKind as GqlRootKind,
      fieldName
    }
  }

  if (isModelGeneratorKey(generatorKey)) {
    const [generatorId, refName] = generatorKey.split('|')
    return { type: 'model', generatorId, refName }
  }

  return { type: 'generator-only', generatorId: generatorKey }
}
