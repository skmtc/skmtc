import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A document whose only operation has no `responses` still generates that
// operation: the parse reads it as no documented responses and records a
// MISSING_RESPONSES warning, not INVALID_OPERATION.

const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: {
      '/pets': {
        post: {
          operationId: 'createPet',
          requestBody: {
            content: { 'application/json': { schema: { type: 'object' } } }
          }
        }
      }
    }
  },
  'operation without responses'
)

Deno.test('toArtifacts - an operation without responses is generated', () => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'operation-seen': toOasOperationEntry({
      id: 'operation-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        seen.push(`${operation.method} ${operation.path}: ${Object.keys(operation.responses)}`)
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

  assertEquals(seen, ['post /pets: '])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'MISSING_RESPONSES', location: 'parse:paths:/pets:post:responses' }]
  )
})
