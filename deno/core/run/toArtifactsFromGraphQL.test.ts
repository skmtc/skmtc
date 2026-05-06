import { assertEquals, assertExists } from '@std/assert'
import { StackTrail } from '@/context/StackTrail.ts'
import { toArtifactsFromGraphQL, type TransformGraphQLArgs } from './toArtifactsFromGraphQL.ts'
import { toGqlDocument } from '@/parsers/graphql/toGqlDocument.ts'
import type { ModelConfig, TransformModelArgs } from '@/dsl/model/types.ts'
import type { GqlOperationConfig } from '@/dsl/operation/gql/types.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { OasOperationConfig, TransformOasOperationArgs } from '@/dsl/operation/oas/types.ts'

const sdl = /* GraphQL */ `
  type User {
    id: ID!
    name: String
  }
  type Query {
    getUser(id: ID!): User
  }
`

const mkArgs = (overrides: Record<string, unknown> = {}): TransformGraphQLArgs => ({
  traceId: 'gql-test',
  spanId: 'main',
  source: sdl,
  settings: undefined,
  toGeneratorConfigMap: <EnrichmentType = undefined>(): GeneratorsMapContainer<EnrichmentType> =>
    ({}) as unknown as GeneratorsMapContainer<EnrichmentType>,
  startAt: Date.now(),
  silent: true,
  stackTrail: new StackTrail(['gql-test']),
  ...overrides
})

Deno.test('toArtifactsFromGraphQL - parses SDL and returns artifacts shape', () => {
  const result = toArtifactsFromGraphQL(mkArgs())
  assertExists(result.artifacts)
  assertExists(result.manifest)
  assertEquals(typeof result.manifest.startAt, 'number')
  assertEquals(typeof result.manifest.endAt, 'number')
  assertEquals(result.manifest.traceId, 'gql-test')
})

Deno.test('toArtifactsFromGraphQL - accepts a pre-built GqlDocument', () => {
  const gqlDocument = toGqlDocument(sdl)
  const result = toArtifactsFromGraphQL(mkArgs({ source: gqlDocument }))
  assertExists(result.manifest)
})

Deno.test('toArtifactsFromGraphQL - runs model generators across the registry', () => {
  const seen: string[] = []
  const modelGen: ModelConfig = {
    id: 'capture-models',
    type: 'model',
    transform<Acc = void>({ refName }: TransformModelArgs<Acc>): Acc {
      seen.push(refName)
      return refName as Acc
    }
  }

  toArtifactsFromGraphQL(
    mkArgs({
      toGeneratorConfigMap: () => ({ modelGen })
    })
  )

  // Both User and the inline scalar types skip into the registry; here
  // we simply confirm User is reached.
  assertEquals(seen.includes('User'), true)
})

Deno.test('toArtifactsFromGraphQL - runs gql-protocol operation generators', () => {
  const seen: string[] = []
  const gqlGen: GqlOperationConfig = {
    id: 'capture-ops',
    type: 'gqlOperation',
    isSupported: () => true,
    transform: <Acc = void>(args: {
      context: GenerateContextType
      operation: unknown
      acc: Acc | undefined
    }): Acc => {
      const op = args.operation as unknown as GqlOperation
      seen.push(`${op.rootKind}_${op.fieldName}`)
      return args.acc as Acc
    }
  }

  toArtifactsFromGraphQL(
    mkArgs({
      toGeneratorConfigMap: () => ({ gqlGen })
    })
  )

  assertEquals(seen, ['query_getUser'])
})

Deno.test('toArtifactsFromGraphQL - http-protocol generators are skipped on GQL', () => {
  let httpRan = false
  const httpGen: OasOperationConfig = {
    id: 'http-only',
    type: 'oasOperation',
    isSupported: () => true,
    transform: <Acc = void>({ acc }: TransformOasOperationArgs<Acc>): Acc => {
      httpRan = true
      return acc as Acc
    }
  }

  toArtifactsFromGraphQL(
    mkArgs({
      toGeneratorConfigMap: () => ({ httpGen })
    })
  )

  assertEquals(httpRan, false)
})
