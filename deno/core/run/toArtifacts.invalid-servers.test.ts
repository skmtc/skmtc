import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A document-level `servers` that is an object, the shape of the
// internetnl batch API fixture. It used to fail the whole run with
// `servers.flatMap is not a function`.

const document = toDocumentObject(
  {
    openapi: '3.0.3',
    info: { title: 't', version: '0' },
    servers: { url: 'https://x' },
    paths: {
      '/pets': { get: { operationId: 'listPets', responses: { '200': { description: 'ok' } } } }
    }
  },
  'servers as an object'
)

Deno.test('toArtifacts - a servers object leaves every operation generated', () => {
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

  assertEquals(seen, ['get /pets'])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'error', type: 'INVALID_OPERATION', location: 'parse:servers' }]
  )
})
