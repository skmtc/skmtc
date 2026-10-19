import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { ResultsItem, ResultType } from '@/types/Results.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A 3.2 document with a `query` operation, an `additionalOperations` entry,
// a `querystring` parameter and a `style: cookie` parameter runs through the
// whole pipeline. The fixture generator reads each operation's parameters
// with `toParametersObject()`, which must not throw.

const ok = { responses: { '200': { description: 'ok' } } }

const document = toDocumentObject(
  {
    openapi: '3.2.0',
    info: { title: 't', version: '0' },
    paths: {
      '/pets': {
        query: {
          ...ok,
          parameters: [
            {
              name: 'filter',
              in: 'querystring',
              content: {
                'application/x-www-form-urlencoded': {
                  schema: { type: 'object', properties: { kind: { type: 'string' } } }
                }
              }
            }
          ]
        },
        additionalOperations: { COPY: ok },
        get: {
          ...ok,
          parameters: [
            { name: 'session', in: 'cookie', style: 'cookie', schema: { type: 'string' } }
          ]
        }
      }
    }
  },
  '3.2 operations document'
)

const toResultLeaves = (item: ResultsItem | ResultType | null): ResultType[] => {
  if (item === null) {
    return []
  }

  if (typeof item === 'string') {
    return [item]
  }

  return Object.values(item).flatMap(value =>
    Array.isArray(value) ? value.flatMap(toResultLeaves) : toResultLeaves(value)
  )
}

Deno.test('toArtifacts - a 3.2 operations document generates with no error', () => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'parameters-object': toOasOperationEntry({
      id: 'parameters-object',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        const parametersObject = operation.toParametersObject()
        const names = Object.keys(parametersObject.properties ?? {})
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
    stackTrail: new StackTrail(['TEST'])
  })

  assertEquals(seen, ['query /pets: filter', 'get /pets: session'])
  assertEquals(
    toResultLeaves(result.manifest.results).filter(leaf => leaf === 'error'),
    []
  )
  assertEquals(
    result.manifest.parseIssues.map(({ level, type }) => ({ level, type })),
    [{ level: 'warning', type: 'UNSUPPORTED_OPERATION_METHOD' }]
  )
})
