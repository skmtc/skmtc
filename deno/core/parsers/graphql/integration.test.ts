import { assertEquals, assertExists } from '@std/assert'
import { spy } from '@std/testing/mock'
import * as log from '@std/log'

import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasOperationConfig, TransformOasOperationArgs } from '@/dsl/operation/oas/types.ts'
import type { ModelConfig, TransformModelArgs } from '@/dsl/model/types.ts'
import type { ResultType } from '@/types/Results.ts'
import { Definition } from '@/dsl/Definition.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import { toGqlDocument } from '@/parsers/graphql/toGqlDocument.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { synthesizeArgsObject } from '@/gql/operation/synthesizeArgsObject.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasObject } from '@/oas/object/Object.ts'
import type { GqlOperationConfig } from '@/dsl/operation/gql/types.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

/**
 * End-to-end integration test for the full GraphQL pipeline.
 *
 * Exercises:
 *   1. SDL → GqlDocument via toGqlDocument
 *   2. GqlDocument wrapped in SkmtcDocument and handed to GenerateContext
 *   3. A model generator (synthetic) running per registered RefName
 *   4. A protocol='gql' operation generator (synthetic) running per
 *      GqlOperation, using `synthesizeArgsObject` to derive an args type
 *   5. The dispatcher routing each generator to the right document type
 *
 * Stands in for the gen-graphql-operation package end-to-end (which lives
 * in a sibling workspace and can't be tested in isolation due to Deno
 * cross-workspace import resolution). This test reproduces gen-graphql-
 * operation's logic inline so the pipeline behavior is verified.
 */
Deno.test('GraphQL pipeline - parses SDL, runs model + operation generators', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      name: String
    }

    type Post {
      id: ID!
      author: User!
    }

    type Query {
      getUser(id: ID!): User
      listPosts(limit: Int = 10): [Post!]!
    }

    type Mutation {
      createUser(name: String!): User!
    }
  `

  const gqlDocument = toGqlDocument(sdl)

  // Sanity-check the parsed document.
  assertExists(gqlDocument.registry.schemas['User' as RefName])
  assertExists(gqlDocument.registry.schemas['Post' as RefName])
  assertEquals(gqlDocument.operations.length, 3) // 2 query + 1 mutation
  assertEquals(gqlDocument.rootTypes.query, 'Query')
  assertEquals(gqlDocument.rootTypes.mutation, 'Mutation')

  // Collect what the model generator sees.
  const modelRefNames: string[] = []
  const modelGenerator: ModelConfig = {
    id: 'synthetic-model',
    type: 'model',
    transform<Acc = void>({ refName }: TransformModelArgs<Acc>): Acc {
      modelRefNames.push(refName)
      return refName as Acc
    }
  }

  // Collect what the operation generator sees, and exercise
  // synthesizeArgsObject + Definition emission to verify cross-package
  // composition works end-to-end.
  const operationRecords: Array<{
    fieldName: string
    rootKind: string
    argsRequired: string[] | undefined
    argsKeys: string[]
  }> = []
  const operationGenerator: GqlOperationConfig = {
    id: 'synthetic-gql-op',
    type: 'gqlOperation',
    isSupported: () => true,
    transform: <Acc = void>({
      operation,
      acc,
      context
    }: {
      operation: unknown
      acc: Acc | undefined
      context: import('@/context/generateTypes.ts').GenerateContextType
    }): Acc => {
      const gqlOp = operation as unknown as GqlOperation

      const args = synthesizeArgsObject(gqlOp)
      operationRecords.push({
        fieldName: gqlOp.fieldName,
        rootKind: gqlOp.rootKind,
        argsRequired: args?.required,
        argsKeys: args ? Object.keys(args.properties ?? {}) : []
      })

      // Verify Definition emission works inside the dispatcher.
      const id = Identifier.createType(`${gqlOp.fieldName}Args`)
      context.register({
        destinationPath: `gql/operations/${gqlOp.identifier}.generated.ts`,
        definitions: [
          new Definition({
            context,
            identifier: id,
            value: {
              generatorKey: toGeneratorOnlyKey({ generatorId: 'synthetic-gql-op' }),
              toString: () => `Record<string, unknown>`
            }
          })
        ]
      })

      return acc as Acc
    }
  }

  const captureCurrentResult = spy((_result: ResultType, _st: StackTrail) => {})
  const context = new GenerateContext({
    document: { type: 'gql', value: gqlDocument },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult,
    // @ts-expect-error - mock
    toGeneratorConfigMap: () => ({
      modelGen: modelGenerator,
      operationGen: operationGenerator
    })
  })

  const result = context.toArtifacts(new StackTrail(['integration']))

  // Model generator must have run for every registry entry, in registry
  // order (User, Post — root types Query/Mutation are NOT in the registry).
  assertEquals(modelRefNames.includes('User'), true)
  assertEquals(modelRefNames.includes('Post'), true)
  assertEquals(modelRefNames.includes('Query'), false)
  assertEquals(modelRefNames.includes('Mutation'), false)

  // Operation generator must have run for every GqlOperation.
  assertEquals(operationRecords.length, 3)

  const getUser = operationRecords.find(r => r.fieldName === 'getUser')!
  assertEquals(getUser.rootKind, 'query')
  assertEquals(getUser.argsRequired, ['id'])
  assertEquals(getUser.argsKeys, ['id'])

  const listPosts = operationRecords.find(r => r.fieldName === 'listPosts')!
  // `limit: Int = 10` is required-with-default → not on required list.
  assertEquals(listPosts.argsRequired, undefined)
  assertEquals(listPosts.argsKeys, ['limit'])

  const createUser = operationRecords.find(r => r.fieldName === 'createUser')!
  assertEquals(createUser.rootKind, 'mutation')
  assertEquals(createUser.argsRequired, ['name'])

  // Definitions registered by the operation generator should appear in
  // the result's files map keyed by their destination paths.
  assertEquals(result.files.has('gql/operations/query_getUser.generated.ts'), true)
  assertEquals(result.files.has('gql/operations/query_listPosts.generated.ts'), true)
  assertEquals(result.files.has('gql/operations/mutation_createUser.generated.ts'), true)
})

Deno.test('GraphQL pipeline - HTTP-protocol operation generator skipped on GQL doc', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      getUser: User
    }
  `
  const gqlDocument = toGqlDocument(sdl)

  const httpTransform = spy((_args: TransformOasOperationArgs<unknown>) => undefined)

  const httpGenerator: OasOperationConfig = {
    id: 'http-only',
    type: 'oasOperation',
    isSupported: () => true,
    transform: <Acc = void>(args: TransformOasOperationArgs<Acc>): Acc => {
      return httpTransform(args as TransformOasOperationArgs<unknown>) as Acc
    }
  }

  const captureCurrentResult = spy((_result: ResultType, _st: StackTrail) => {})
  const context = new GenerateContext({
    document: { type: 'gql', value: gqlDocument },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult,
    // @ts-expect-error - mock
    toGeneratorConfigMap: () => ({ http: httpGenerator })
  })

  context.toArtifacts(new StackTrail(['integration']))

  // HTTP generator must not have been invoked even though the GQL
  // document has a Query.getUser operation.
  assertEquals(httpTransform.calls.length, 0)
})

Deno.test('GraphQL pipeline - return type ref resolves through the registry', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      getUser(id: ID!): User!
    }
  `
  const gqlDocument = toGqlDocument(sdl)

  const op = gqlDocument.operations[0]
  // Non-null ref return stays a bare OasRef so it resolves through the
  // registry directly. (Nullable ref returns are wrapped in OasUnion;
  // see parsers/graphql/toFieldSchema.test.ts for that path.)
  const ret = op.returnType as OasRef<'schema'>
  assertEquals(ret.isRef(), true)
  assertEquals(ret.toRefName(), 'User')

  const resolved = ret.resolveOnce() as OasObject
  assertEquals(resolved.title, 'User')
})
