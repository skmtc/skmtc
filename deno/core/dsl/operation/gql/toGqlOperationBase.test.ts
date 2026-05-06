import { toGqlOperationBase } from './toGqlOperationBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlOperationBase } from './GqlOperationBase.ts'
import { OasString } from '@/oas/string/String.ts'
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

Deno.test('toGqlOperationBase - returns a class constructor', () => {
  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toGqlOperationBase - sets static id from config', () => {
  const OperationClass = toGqlOperationBase({
    id: 'graphql-operations',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.id, 'graphql-operations')
})

Deno.test('toGqlOperationBase - sets static type to operation', () => {
  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
  })

  assertEquals(OperationClass.type, 'gqlOperation')
})

Deno.test('toGqlOperationBase - sets static toIdentifier from config', () => {
  const identifierFn = (operation: GqlOperation) => Identifier.createVariable(operation.fieldName)

  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: identifierFn,
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
  })

  const mockOperation = createMockGqlOperation()

  const identifier = OperationClass.toIdentifier(mockOperation)
  assertEquals(identifier.name, 'getUsers')
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toGqlOperationBase - sets static toExportPath from config', () => {
  const exportPathFn = (operation: GqlOperation) => `./generated/${operation.fieldName}.ts`

  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: exportPathFn
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const exportPath = OperationClass.toExportPath(mockOperation)
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test(
  'toGqlOperationBase - toEnrichments returns undefined when no enrichmentSchema provided',
  () => {
    const OperationClass = toGqlOperationBase({
      id: 'test-operation',
      toIdentifier: operation => Identifier.createVariable(operation.fieldName),
      toExportPath: operation => `./operations/${operation.fieldName}.ts`
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
  'toGqlOperationBase - toEnrichments returns undefined when no enrichments in context',
  () => {
    const OperationClass = toGqlOperationBase({
      id: 'test-operation',
      toIdentifier: operation => Identifier.createVariable(operation.fieldName),
      toExportPath: operation => `./operations/${operation.fieldName}.ts`
    })

    const mockOperation = createMockGqlOperation()

    const enrichments = OperationClass.toEnrichments({
      operation: mockOperation,
      context: { settings: {} } as GenerateContextType
    })

    assertEquals(enrichments, undefined)
  }
)

Deno.test('toGqlOperationBase - toIdentifier works with different operations', () => {
  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation =>
      Identifier.createVariable(`${operation.rootKind}${operation.fieldName}`),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'Users' })
  const queryIdentifier = OperationClass.toIdentifier(queryOperation)
  assertEquals(queryIdentifier.name, 'queryUsers')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'Product'
  })
  const mutationIdentifier = OperationClass.toIdentifier(mutationOperation)
  assertEquals(mutationIdentifier.name, 'mutationProduct')
})

Deno.test('toGqlOperationBase - toExportPath works with different operations', () => {
  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./types/${operation.rootKind}-${operation.fieldName}.d.ts`
  })

  const queryOperation = createMockGqlOperation({ rootKind: 'query', fieldName: 'users' })
  assertEquals(OperationClass.toExportPath(queryOperation), './types/query-users.d.ts')

  const mutationOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'product'
  })
  assertEquals(OperationClass.toExportPath(mutationOperation), './types/mutation-product.d.ts')
})

Deno.test('toGqlOperationBase - constructor creates correct generatorKey', () => {
  const OperationClass = toGqlOperationBase({
    id: 'graphql-client',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
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

Deno.test('toGqlOperationBase - instance is GqlOperationBase', () => {
  const OperationClass = toGqlOperationBase({
    id: 'test-operation',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
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

  assertEquals(instance instanceof GqlOperationBase, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toGqlOperationBase - toEnrichments validates with schema', () => {
  const OperationClass = toGqlOperationBase<{ enabled: boolean; timeout?: number }>({
    id: 'graphql-client',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`,
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

Deno.test('toGqlOperationBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toGqlOperationBase({
    id: 'graphql-api',
    toIdentifier: operation => Identifier.createVariable(operation.fieldName),
    toExportPath: operation => `./operations/${operation.fieldName}.ts`
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
