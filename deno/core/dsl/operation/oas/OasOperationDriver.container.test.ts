/**
 * A member projection declares its container; the engine does the rest.
 *
 * The whole point is what the entry does NOT contain: no probe for the
 * container, no accumulating `add`, no knowledge of which operation arrived
 * first. Every operation makes the same call and the cache decides.
 */
import { assertEquals, assertThrows } from '@std/assert'
import type * as log from '@std/log'
import { TsSnippet, createVariable, typescript } from '@skmtc/lang-typescript'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { toOasOperationContainerBase } from '@/dsl/operation/oas/toOasOperationContainerBase.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import type { Method } from '@/types/Method.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { OasOperationProjectionConstructorArgs } from '@/dsl/operation/oas/types.ts'
import type { OasOperationContainerConstructorArgs } from '@/dsl/operation/oas/toOasOperationContainerBase.ts'
import type { EmptyEnrichments } from '@/types/Enrichments.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const toOperation = (method: Method, path: string, tag: string) =>
  new OasOperation({ path, method, pathItem: undefined, tags: [tag], responses: {} })

const createContext = (operations: OasOperation[]) =>
  new GenerateContext({
    document: {
      type: 'oas',
      value: new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations
      })
    },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

const toTag = (operation: OasOperation) => operation.tags?.[0] ?? 'Default'

const ServiceBase = toOasOperationContainerBase(TsSnippet, {
  id: '@test/gen-service',
  toIdentifierName: ({ operation }) => `${toTag(operation)}Service`,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ operation }) => `@/api/${toTag(operation)}Api.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class ServiceContainer extends ServiceBase {
  constructor(args: OasOperationContainerConstructorArgs<EmptyEnrichments>) {
    super(args)
  }
  override toString(): string {
    return `{ ${this.definitions.map(definition => `${definition}`).join(', ')} }`
  }
}

const MethodBase = toOasOperationProjectionBase(TsSnippet, {
  id: '@test/gen-service',
  toIdentifierName: ({ operation }) => `${operation.method}${operation.path.replaceAll('/', '')}`,
  toIdentifierType: () => ({ type: 'variable' }),
  // Never consulted: a member's file is its container's.
  toExportPath: () => '@/unused.ts',
  toContainer: () => ServiceContainer,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class ServiceMethod extends MethodBase {
  constructor(args: OasOperationProjectionConstructorArgs<EmptyEnrichments>) {
    super(args)
  }
  override toString(): string {
    return `() => '${this.operation.method} ${this.operation.path}'`
  }
}

Deno.test('every member makes the same call; the first one creates the container', () => {
  const getUsers = toOperation('get', '/users', 'Users')
  const postUsers = toOperation('post', '/users', 'Users')
  const context = createContext([getUsers, postUsers])

  // What a transform does, twice, knowing nothing about ordering.
  context.insertOperation({ projection: ServiceMethod, operation: getUsers })
  context.insertOperation({ projection: ServiceMethod, operation: postUsers })

  const file = context.getFile('@/api/UsersApi.generated.ts')
  const container = context.findDefinition({
    name: 'UsersService',
    exportPath: '@/api/UsersApi.generated.ts'
  })

  assertEquals(container?.identifier.name, 'UsersService')
  assertEquals(
    context.findDefinition({
      name: 'getusers',
      exportPath: '@/api/UsersApi.generated.ts',
      into: 'UsersService'
    })?.identifier.name,
    'getusers'
  )
  // The members are NOT file-level declarations.
  assertEquals(
    context.findDefinition({ name: 'getusers', exportPath: '@/api/UsersApi.generated.ts' }),
    undefined
  )
  // One container, both members, rendered inside it. How a member renders is
  // the language's concern, not the engine's — TsDefinition's `export const
  // … ;` is wrong for a class member, and giving each language a member form
  // is the veneer's job.
  assertEquals(
    `${file}`,
    "export const UsersService = { export const getusers = () => 'get /users';\n, " +
      "export const postusers = () => 'post /users';\n };\n"
  )
  // The member's `toExportPath` was never consulted.
  assertEquals(context.getFile('@/unused.ts'), undefined)
})

Deno.test('the container carries an identity key, so every member computes the same one', () => {
  const getUsers = toOperation('get', '/users', 'Users')
  const postUsers = toOperation('post', '/users', 'Users')
  const context = createContext([getUsers, postUsers])

  context.insertOperation({ projection: ServiceMethod, operation: getUsers })
  context.insertOperation({ projection: ServiceMethod, operation: postUsers })

  const container = context.findDefinition({
    name: 'UsersService',
    exportPath: '@/api/UsersApi.generated.ts'
  })

  assertEquals(
    container?.generatorKey,
    '@test/gen-service|container|@/api/UsersApi.generated.ts|UsersService|main'
  )
})

Deno.test('operations of different tags get their own container and file', () => {
  const getUsers = toOperation('get', '/users', 'Users')
  const getOrders = toOperation('get', '/orders', 'Orders')
  const context = createContext([getUsers, getOrders])

  context.insertOperation({ projection: ServiceMethod, operation: getUsers })
  context.insertOperation({ projection: ServiceMethod, operation: getOrders })

  assertEquals(
    context.findDefinition({ name: 'UsersService', exportPath: '@/api/UsersApi.generated.ts' })?.identifier
      .name,
    'UsersService'
  )
  assertEquals(
    context.findDefinition({ name: 'OrdersService', exportPath: '@/api/OrdersApi.generated.ts' })?.identifier
      .name,
    'OrdersService'
  )
})

Deno.test('two members deriving one name collide loudly', () => {
  const getUsers = toOperation('get', '/users', 'Users')
  const getUsersAgain = toOperation('get', '/users', 'Users')
  const context = createContext([getUsers, getUsersAgain])

  const SameNameBase = toOasOperationProjectionBase(TsSnippet, {
    id: '@test/gen-service',
    toIdentifierName: () => 'handler',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: () => '@/unused.ts',
    toContainer: () => ServiceContainer,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class SameName extends SameNameBase {
    override toString(): string {
      return '() => null'
    }
  }

  context.insertOperation({ projection: SameName, operation: getUsers })

  // A second subject claiming a member name the first already owns is the
  // same failure a file-level name clash is — the member keys differ.
  assertThrows(
    () =>
      context.insertOperation({
        projection: SameName,
        operation: toOperation('post', '/users', 'Users')
      }),
    Error,
    'Registered definition mismatch'
  )
})

Deno.test('a projection used as a container must declare itself one', () => {
  const getUsers = toOperation('get', '/users', 'Users')
  const context = createContext([getUsers])

  const NotAContainerBase = toOasOperationProjectionBase(TsSnippet, {
    id: '@test/gen-service',
    toIdentifierName: ({ operation }) => `${toTag(operation)}Service`,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `@/api/${toTag(operation)}Api.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class NotAContainer extends NotAContainerBase {
    override toString(): string {
      return '{}'
    }
  }

  const MemberBase = toOasOperationProjectionBase(TsSnippet, {
    id: '@test/gen-service',
    toIdentifierName: () => 'handler',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: () => '@/unused.ts',
    // @ts-expect-error - deliberately not a container, which is the point
    toContainer: () => NotAContainer,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class Member extends MemberBase {
    override toString(): string {
      return '() => null'
    }
  }

  assertThrows(
    () => context.insertOperation({ projection: Member, operation: getUsers }),
    Error,
    'was not built with toOasOperationContainerBase'
  )
})

Deno.test('typescript lang is carried through to the container definition', () => {
  assertEquals(ServiceContainer.lang, typescript)
  assertEquals(createVariable('UsersService').name, 'UsersService')
})
