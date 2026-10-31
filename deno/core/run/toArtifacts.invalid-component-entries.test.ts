import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

// A `null` component header and a component request body with `content: null`,
// shapes from public documents. They used to fail the whole run; each is now
// dropped with one error, and the operations are generated.

// Documents in the wild hold entries the parser's input type does not allow.
const document: OpenAPIV3.Document = JSON.parse(
  JSON.stringify({
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: {
      '/pets': {
        get: { operationId: 'listPets', responses: { '200': { description: 'ok' } } },
        post: {
          operationId: 'createPet',
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '201': { description: 'created' } }
        }
      }
    },
    components: {
      headers: { 'X-Trace-ID': null },
      requestBodies: { UpdatePet: { content: null } }
    }
  })
)

Deno.test('toArtifacts - broken component headers and request bodies leave operations generated', () => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'operation-seen': toOasOperationEntry({
      id: 'operation-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        seen.push(`${operation.method} ${operation.path}`)
      }
    })
  })

  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: document },
    settings: undefined,
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail([])
  })

  assertEquals(seen.toSorted(), ['get /pets', 'post /pets'])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [
      {
        level: 'error',
        type: 'INVALID_REQUEST_BODY',
        location: 'parse:components:requestBodies:UpdatePet'
      },
      { level: 'error', type: 'INVALID_HEADER', location: 'parse:components:headers:X-Trace-ID' }
    ]
  )
})
