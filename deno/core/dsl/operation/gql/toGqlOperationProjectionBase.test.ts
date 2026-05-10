import { toGqlOperationProjectionBase } from './toGqlOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlOperationProjectionBase } from './GqlOperationProjectionBase.ts'
import { OasString } from '@/oas/string/String.ts'
import type {
  ToGqlOperationIdentifierArgs,
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
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toGqlOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'graphql-operations',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.id, 'graphql-operations')
})

Deno.test('toGqlOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.type, 'gqlOperation')
})

Deno.test('toGqlOperationProjectionBase - sets static toIdentifier from config', () => {
  const identifierFn = ({ operation }: ToGqlOperationIdentifierArgs) =>
    Identifier.createVariable(operation.fieldName)

  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: identifierFn,
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  const mockOperation = createMockGqlOperation()

  const identifier = OperationClass.toIdentifier({ operation: mockOperation, enrichments: undefined })
  assertEquals(identifier.name, 'getUsers')
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toGqlOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToGqlOperationExportPathArgs) =>
    `./generated/${operation.fieldName}.ts`

  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: exportPathFn
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const exportPath = OperationClass.toExportPath({ operation: mockOperation, enrichments: undefined })
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments returns undefined when no enrichmentSchema provided',
  () => {
    const OperationClass = toGqlOperationProjectionBase({
      id: 'test-operation',
      toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType
    })

    assertEquals(enrichments, undefined)
  }
)

Deno.test(
  'toGqlOperationProjectionBase - toEnrichments returns undefined when no enrichments in context',
  () => {
    const OperationClass = toGqlOperationProjectionBase({
      id: 'test-operation',
      toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
      toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType
    })

    assertEquals(enrichments, undefined)
  }
)

Deno.test('toGqlOperationProjectionBase - toIdentifier works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) =>
      Identifier.createVariable(`${operation.rootKind}${operation.fieldName}`),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'Users' })
  const queryIdentifier = OperationClass.toIdentifier({ operation: queryOperation, enrichments: undefined })
  assertEquals(queryIdentifier.name, 'queryUsers')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'Product'
  })
  const mutationIdentifier = OperationClass.toIdentifier({ operation: mutationOperation, enrichments: undefined })
  assertEquals(mutationIdentifier.name, 'mutationProduct')
})

Deno.test('toGqlOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: ({ operation }) => `./types/${operation.rootKind}-${operation.fieldName}.d.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'users' })
  assertEquals(OperationClass.toExportPath({ operation: queryOperation, enrichments: undefined }), './types/query-users.d.ts')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'product'
  })
  assertEquals(OperationClass.toExportPath({ operation: mutationOperation, enrichments: undefined }), './types/mutation-product.d.ts')
})

Deno.test('toGqlOperationProjectionBase - constructor creates correct generatorKey', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'graphql-client',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
    toExportPath: ({ operation }) => `./operations/${operation.fieldName}.ts`
  })

  const mockOperation = createMockGqlOperation()

  const mockContext = {} as GenerateContextType

  const instance = new OperationClass({
    context: mockContext,
    operation: mockOperation,
    settings: {
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts',
      enrichments: undefined
    } as any
  })

  // Key format: id|rootKind|fieldName
  assertEquals(instance.generatorKey as unknown as string, 'graphql-client|query|getUsers')
})

Deno.test('toGqlOperationProjectionBase - instance is GqlOperationProjectionBase', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
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
      identifier: Identifier.createVariable('createProduct'),
      exportPath: './operations/products.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof GqlOperationProjectionBase, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toGqlOperationProjectionBase - toEnrichments validates with schema', () => {
  const OperationClass = toGqlOperationProjectionBase<{ enabled: boolean; timeout?: number }>({
    id: 'graphql-client',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
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
              enabled: true,
              timeout: 5000
            }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext
  })

  assertEquals(enrichments, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toGqlOperationProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toGqlOperationProjectionBase({
    id: 'graphql-api',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.fieldName),
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
            updateProduct: { customValue: 'found-it', flag: true }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext
  })

  // Verify retrieved from path: enrichments.{id}.{rootKind}.{fieldName}
  assertEquals(enrichments, { customValue: 'found-it', flag: true })
})
