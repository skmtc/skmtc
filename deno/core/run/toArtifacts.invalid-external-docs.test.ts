import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A tag whose `externalDocs` has no `url`, the shape of a public document. It
// used to fail the whole run; the `externalDocs` is now left out with one
// INVALID_EXTERNAL_DOCS warning, and every operation is generated.

const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    tags: [
      { name: 'metrics', description: 'Metrics' },
      { name: 'traces', externalDocs: { description: 'Read the guide' } }
    ],
    paths: {
      '/metrics': {
        get: {
          operationId: 'listMetrics',
          tags: ['metrics'],
          responses: { '200': { description: 'ok' } }
        }
      },
      '/traces': {
        get: {
          operationId: 'listTraces',
          tags: ['traces'],
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  },
  'tag externalDocs without url'
)

Deno.test('toArtifacts - a tag externalDocs without url leaves every operation generated', () => {
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

  assertEquals(seen, ['get /metrics', 'get /traces'])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'INVALID_EXTERNAL_DOCS', location: 'parse:tags:1:externalDocs' }]
  )
})
