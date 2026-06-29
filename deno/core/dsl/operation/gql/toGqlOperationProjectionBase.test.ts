import { toGqlOperationProjectionBase } from './toGqlOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { TsSnippet, createVariable } from '@skmtc/lang-typescript'
import { OasString } from '@/oas/string/String.ts'
import type {
  ToGqlOperationIdentifierNameArgs,
  ToGqlOperationExportPathArgs
} from './types.ts'
import { emptyEnrichmentSchema, type EmptyEnrichments } from '@/types/Enrichments.ts'
import * as v from 'valibot'

const createMockGqlOperation = (
  overrides?: Partial<{
    rootKind: 'query' | 'mutation' | 'subscription'
    fieldName: string
  }>
) => {
  return new GqlOperation({
    rootKind: overrides?.rootKind ?? 'query',
    fieldName: overrides?.fieldName ?? 'getUsers',
    arguments: [],
    returnType: new OasString({})
  })
}

Deno.test('toGqlOperationProjectionBase - returns a class constructor', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toGqlOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'graphql-operations',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(OperationClass.id, 'graphql-operations')
})

Deno.test('toGqlOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(OperationClass.type, 'gqlOperation')
})

Deno.test('toGqlOperationProjectionBase - sets static toIdentifierName from config', () => {
  const identifierNameFn = ({ operation }: ToGqlOperationIdentifierNameArgs<EmptyEnrichments>) =>
    operation.fieldName

  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: identifierNameFn,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = createMockGqlOperation()

  const name = OperationClass.toIdentifierName({ operation: mockOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' })
  assertEquals(name, 'getUsers')
  assertEquals(OperationClass.toIdentifierType(mockOperation, {} as GenerateContextType).type, 'variable')
})

Deno.test('toGqlOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToGqlOperationExportPathArgs<EmptyEnrichments>) =>
    `./generated/${operation.fieldName}.ts`

  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: exportPathFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const exportPath = OperationClass.toExportPath({ operation: mockOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' })
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments yields the empty umbrella with the empty schema',
  () => {
    const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
      id: 'test-operation',
      toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
      toEnrichmentSchema: () => emptyEnrichmentSchema
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType,
    variant: 'main'
    })

    assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
  }
)

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments yields the empty umbrella when no enrichments in context',
  () => {
    const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
      id: 'test-operation',
      toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
      toEnrichmentSchema: () => emptyEnrichmentSchema
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType,
    variant: 'main'
    })

    assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
  }
)

Deno.test('toGqlOperationProjectionBase - toIdentifierName works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => `${operation.rootKind}${operation.fieldName}`,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'Users' })
  const queryName = OperationClass.toIdentifierName({ operation: queryOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' })
  assertEquals(queryName, 'queryUsers')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'Product'
  })
  const mutationName = OperationClass.toIdentifierName({ operation: mutationOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' })
  assertEquals(mutationName, 'mutationProduct')
})

Deno.test('toGqlOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./types/${operation.rootKind}-${operation.fieldName}.d.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'users' })
  assertEquals(OperationClass.toExportPath({ operation: queryOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' }), './types/query-users.d.ts')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'product'
  })
  assertEquals(OperationClass.toExportPath({ operation: mutationOperation, enrichments: { subject: undefined, generator: undefined, stack: undefined }, variant: 'main' }), './types/mutation-product.d.ts')
})

Deno.test('toGqlOperationProjectionBase - constructor creates correct generatorKey', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'graphql-client',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = createMockGqlOperation()

  const mockContext = {} as GenerateContextType

  const instance = new OperationClass({
    context: mockContext,
    operation: mockOperation,
    settings: {
      identifier: createVariable('getUsers'),
      exportPath: './operations/users.ts',
      enrichments: undefined,
      variant: 'main'
    } as any
  })

  // Key format: id|rootKind|fieldName|variant
  assertEquals(instance.generatorKey as unknown as string, 'graphql-client|query|getUsers|main')
})

Deno.test('toGqlOperationProjectionBase - instance is GqlOperationProjectionBase', () => {
  const OperationClass = toGqlOperationProjectionBase(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createProduct'
  })

  const mockContext = {} as GenerateContextType

  const instance = new OperationClass({
    context: mockContext,
    operation: mockOperation,
    settings: {
      identifier: createVariable('createProduct'),
      exportPath: './operations/products.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof TsSnippet, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toGqlOperationProjectionBase - toEnrichments validates with schema', () => {
  const OperationClass = toGqlOperationProjectionBase<{
    subject: { enabled: boolean; timeout?: number }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'graphql-client',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.object({
          enabled: v.boolean(),
          timeout: v.optional(v.number())
        }),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockOperation = createMockGqlOperation()

  const mockContext = {
    settings: {
      enrichments: {
        'graphql-client': {
          query: {
            getUsers: {
              main: {
                enabled: true,
                timeout: 5000
              }
            }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext,
    variant: 'main'
  })

  assertEquals(enrichments.subject, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toGqlOperationProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toGqlOperationProjectionBase<{
    subject: { customValue: string; flag: boolean }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'graphql-api',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.object({
          customValue: v.string(),
          flag: v.boolean()
        }),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'updateProduct'
  })

  const mockContext = {
    settings: {
      enrichments: {
        'graphql-api': {
          mutation: {
            updateProduct: { main: { customValue: 'found-it', flag: true } }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext,
    variant: 'main'
  })

  // Subject is retrieved from enrichments.{id}.{rootKind}.{fieldName}.{variant}
  assertEquals(enrichments.subject, { customValue: 'found-it', flag: true })
})
