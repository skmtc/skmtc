import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

// A schema that fails to parse is reported where it fails, and every
// operation and component that references it is pruned with
// INVALID_DEPENDENCY_REF, also when the run's trail carries a trace and span
// prefix (the CLI and worker path).

const okResponse = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => ({
  '200': { description: 'ok', content: { 'application/json': { schema } } }
})

// Documents in the wild hold entries the parser's input type does not allow
// (`oneOf: []`).
const toDocument = (value: unknown): OpenAPIV3.Document => JSON.parse(JSON.stringify(value))

const document = toDocument({
  openapi: '3.1.0',
  info: { title: 't', version: '0' },
  paths: {
    '/direct': {
      get: { operationId: 'direct', responses: okResponse({ $ref: '#/components/schemas/X' }) }
    },
    '/unrelated': {
      get: {
        operationId: 'unrelated',
        responses: okResponse({ $ref: '#/components/schemas/Unrelated' })
      }
    }
  },
  components: {
    schemas: {
      X: { type: 'object', properties: { p: { oneOf: [] }, q: { type: 'string' } } },
      B: { type: 'object', properties: { x: { $ref: '#/components/schemas/X' } } },
      Unrelated: { type: 'string' }
    }
  }
})

type RunResult = {
  operations: string[]
  models: string[]
  issues: { type: string; location: string }[]
}

const run = (doc: OpenAPIV3.Document, frames: string[]): RunResult => {
  const operations: string[] = []
  const models: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'operation-seen': toOasOperationEntry({
      id: 'operation-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        operations.push(`${operation.method} ${operation.path}`)
      }
    }),
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'model-seen': toModelEntry({
      id: 'model-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ refName }) => {
        models.push(refName)
      }
    })
  })

  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: doc },
    settings: undefined,
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(frames)
  })

  return {
    operations: operations.toSorted(),
    models: models.toSorted(),
    issues: result.manifest.parseIssues.map(({ type, location }) => ({ type, location }))
  }
}

/** `run`'s result with `prefix` cut from the front of every issue location. */
const withoutPrefix = (result: RunResult, prefix: string): RunResult => ({
  ...result,
  issues: result.issues.map(({ type, location }) => {
    assertEquals(location.startsWith(prefix), true, `${location} starts with ${prefix}`)
    return { type, location: location.slice(prefix.length) }
  })
})

/** The same document through a direct `ParseContext.parse(new StackTrail([]))`. */
const parseDirectly = (doc: OpenAPIV3.Document) => {
  const context = new ParseContext({
    input: { type: 'oas', value: doc },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  context.parse(new StackTrail([]))

  return {
    operations: context.oasDocument.operations.map(({ method, path }) => `${method} ${path}`).toSorted(),
    models: context.oasDocument.components?.toSchemasRefNames().toSorted() ?? [],
    issues: context.issues.map(({ type, location }) => ({ type, location }))
  }
}

Deno.test('toArtifacts pruning - a trace and span prefix prunes the consumers of a broken schema', () => {
  assertEquals(withoutPrefix(run(document, ['t', 's']), 't:s:parse:'), {
    operations: ['get /unrelated'],
    models: ['Unrelated', 'X'],
    issues: [
      { type: 'INVALID_SCHEMA', location: 'components:schemas:X:properties:p' },
      {
        type: 'INVALID_DEPENDENCY_REF',
        location: 'paths:/direct:get:responses:200:content:application/json:schema'
      },
      { type: 'INVALID_DEPENDENCY_REF', location: 'components:schemas:B:properties:x' }
    ]
  })
})

Deno.test('toArtifacts pruning - empty trail, prefixed trail and a direct parse agree', () => {
  const prefixed = withoutPrefix(run(document, ['t', 's']), 't:s:parse:')

  assertEquals(withoutPrefix(run(document, []), 'parse:'), prefixed)
  assertEquals(parseDirectly(document), prefixed)
})
