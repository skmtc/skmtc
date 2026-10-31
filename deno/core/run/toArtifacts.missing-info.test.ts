import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

// A document without `info` still generates its operations: the parse reads
// it as an empty title and version and records one MISSING_INFO warning.

// `info` is required by the document type; these documents leave it out or
// set it to null on purpose.
const toDocument = (openapi: string, info: 'missing' | 'null'): OpenAPIV3.Document =>
  JSON.parse(
    JSON.stringify({
      openapi,
      ...(info === 'null' ? { info: null } : {}),
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            responses: { '200': { description: 'ok' } }
          }
        }
      }
    })
  )

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  for (const info of ['missing', 'null'] as const) {
    Deno.test(`toArtifacts - ${openapi} document with info ${info} generates its operations`, () => {
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
        document: { type: 'oas', value: toDocument(openapi, info) },
        settings: undefined,
        toGeneratorConfigMap: generators,
        startAt: Date.now(),
        silent: true,
        stackTrail: new StackTrail([])
      })

      assertEquals(seen, ['get /pets'])
      assertEquals(
        result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
        [{ level: 'warning', type: 'MISSING_INFO', location: 'parse:info' }]
      )
    })
  }
}
