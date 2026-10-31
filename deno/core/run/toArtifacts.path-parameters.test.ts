import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// Path-level parameter shapes from public documents: `parameters` that is
// an object, and entries with `name` and `in` nested inside `schema`. They
// used to fail the whole run; now only the operations on those paths are
// dropped, and the other paths still generate.

const ok = { responses: { '200': { description: 'ok' } } }

const document = toDocumentObject(
  {
    openapi: '3.0.3',
    info: { title: 't', version: '0' },
    paths: {
      '/molecules': {
        parameters: { page: { name: 'page', in: 'query', schema: { type: 'integer' } } },
        get: { operationId: 'listMolecules', ...ok }
      },
      '/games/{appid}': {
        parameters: [{ schema: { type: 'integer', name: 'appid', in: 'path', required: true } }],
        get: { operationId: 'getGame', ...ok }
      },
      '/health': { get: { operationId: 'health', ...ok } }
    }
  },
  'path-level parameters document'
)

Deno.test('toArtifacts - a malformed path-level parameter drops only its operations', () => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    operations: toOasOperationEntry({
      id: 'operations',
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

  assertEquals(seen, ['get /health'])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [
      { level: 'error', type: 'INVALID_PARAMETER', location: 'parse:paths:/molecules:parameters' },
      { level: 'error', type: 'INVALID_OPERATION', location: 'parse:paths:/molecules:get' },
      {
        level: 'error',
        type: 'INVALID_PARAMETER',
        location: 'parse:paths:/games/{appid}:parameters:0'
      },
      { level: 'error', type: 'INVALID_OPERATION', location: 'parse:paths:/games/{appid}:get' }
    ]
  )
})
