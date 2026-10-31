import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// Path-level parameters from a public document: an empty `{}` entry before
// two header parameters. It used to crash the whole run; the `{}` is now
// left out with one EMPTY_PARAMETER warning.

const document = toDocumentObject(
  {
    openapi: '3.0.3',
    info: { title: 't', version: '0' },
    paths: {
      '/mi': {
        parameters: [
          {},
          { name: 'X-Request-ID', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Correlation-ID', in: 'header', required: false, schema: { type: 'string' } }
        ],
        get: { operationId: 'getMi', responses: { '200': { description: 'ok' } } }
      }
    }
  },
  '/mi document'
)

Deno.test('toArtifacts - an empty {} in path-level parameters is skipped with a warning', () => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'path-parameters': toOasOperationEntry({
      id: 'path-parameters',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        const names = (operation.pathItem?.parameters ?? []).map(
          parameter => `${parameter.resolve().location} ${parameter.resolve().name}`
        )
        seen.push(`${operation.method} ${operation.path}: ${names.join(', ')}`)
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

  assertEquals(seen, ['get /mi: header X-Request-ID, header X-Correlation-ID'])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'EMPTY_PARAMETER', location: 'parse:paths:/mi:parameters:0' }]
  )
})
