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
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toGqlOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'graphql-operations',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.id, 'graphql-operations')
})

Deno.test('toGqlOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.type, 'gqlOperation')
})

Deno.test('toGqlOperationProjectionBase - sets static toIdentifierName from config', () => {
  const identifierNameFn = ({ operation }: ToGqlOperationIdentifierNameArgs) =>
    operation.fieldName

  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: identifierNameFn,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  const mockOperation = createMockGqlOperation()

  const name = OperationClass.toIdentifierName({ operation: mockOperation, enrichments: undefined, variant: 'main' })
  assertEquals(name, 'getUsers')
  assertEquals(OperationClass.toIdentifierType(mockOperation, {} as GenerateContextType).kind, 'variable')
})

Deno.test('toGqlOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToGqlOperationExportPathArgs) =>
    `./generated/${operation.fieldName}.ts`

  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: exportPathFn
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const exportPath = OperationClass.toExportPath({ operation: mockOperation, enrichments: undefined, variant: 'main' })
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments returns undefined when no enrichmentSchema provided',
  () => {
    const OperationClass = toGqlOperationProjectionBase({
      base: TsSnippet,
      id: 'test-operation',
      toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType,
    variant: 'main'
    })

    assertEquals(enrichments, undefined)
  }
)

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments returns undefined when no enrichments in context',
  () => {
    const OperationClass = toGqlOperationProjectionBase({
      base: TsSnippet,
      id: 'test-operation',
      toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType,
    variant: 'main'
    })

    assertEquals(enrichments, undefined)
  }
)

Deno.test('toGqlOperationProjectionBase - toIdentifierName works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => `${operation.rootKind}${operation.fieldName}`,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'Users' })
  const queryName = OperationClass.toIdentifierName({ operation: queryOperation, enrichments: undefined, variant: 'main' })
  assertEquals(queryName, 'queryUsers')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'Product'
  })
  const mutationName = OperationClass.toIdentifierName({ operation: mutationOperation, enrichments: undefined, variant: 'main' })
  assertEquals(mutationName, 'mutationProduct')
})

Deno.test('toGqlOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./types/${operation.rootKind}-${operation.fieldName}.d.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'users' })
  assertEquals(OperationClass.toExportPath({ operation: queryOperation, enrichments: undefined, variant: 'main' }), './types/query-users.d.ts')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'product'
  })
  assertEquals(OperationClass.toExportPath({ operation: mutationOperation, enrichments: undefined, variant: 'main' }), './types/mutation-product.d.ts')
})

Deno.test('toGqlOperationProjectionBase - constructor creates correct generatorKey', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'graphql-client',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
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
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
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
  const OperationClass = toGqlOperationProjectionBase<{ enabled: boolean; timeout?: number }>({
    base: TsSnippet,
    id: 'graphql-client',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        enabled: v.boolean(),
        timeout: v.optional(v.number())
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

  assertEquals(enrichments, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toGqlOperationProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toGqlOperationProjectionBase({
    base: TsSnippet,
    id: 'graphql-api',
    toIdentifierName: ({ operation }) => operation.fieldName,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
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

  // Retrieves from enrichments.{id}.{rootKind}.{fieldName}.{variant}
  assertEquals(enrichments, { customValue: 'found-it', flag: true })
})
