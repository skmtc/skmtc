import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// An operation that requires a broken or undefined security scheme, or
// inherits a malformed root `security`, is dropped with an INVALID_OPERATION
// error; the other operations are still generated.

const toDocument = (security: unknown) =>
  toDocumentObject(
    {
      openapi: '3.1.0',
      info: { title: 't', version: '0' },
      security,
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', name: 'X-Key', in: 'header' },
          broken: { type: 'apiKey' }
        }
      },
      paths: {
        '/broken': { get: { security: [{ broken: [] }], responses: {} } },
        '/missing': { get: { security: [{ missing: [] }], responses: {} } },
        '/own': { get: { security: [{ apiKey: [] }], responses: {} } },
        '/public': { get: { security: [], responses: {} } },
        '/inherits': { get: { responses: {} } }
      }
    },
    'security fixture'
  )

const run = (security: unknown) => {
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
    document: { type: 'oas', value: toDocument(security) },
    settings: undefined,
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail([])
  })

  return {
    seen,
    issues: result.manifest.parseIssues.map(({ level, type, location, message }) => ({
      level,
      type,
      location,
      message
    }))
  }
}

Deno.test('toArtifacts - operations that require a broken or undefined scheme are dropped', () => {
  const { seen, issues } = run([{ apiKey: [] }])

  assertEquals(seen, ['get /own', 'get /public', 'get /inherits'])
  assertEquals(
    issues.filter(({ type }) => type === 'INVALID_OPERATION'),
    [
      {
        level: 'error',
        type: 'INVALID_OPERATION',
        location: 'parse:paths:/broken:get',
        message: "Requires security scheme 'broken', which failed to parse"
      },
      {
        level: 'error',
        type: 'INVALID_OPERATION',
        location: 'parse:paths:/missing:get',
        message:
          "Requires security scheme 'missing', which is not defined in components.securitySchemes"
      }
    ]
  )
})

Deno.test('toArtifacts - a root security that is not a list drops only the operations that inherit it', () => {
  const { seen, issues } = run({ apiKey: [] })

  assertEquals(seen, ['get /own', 'get /public'])
  assertEquals(
    issues
      .filter(({ type }) => type === 'INVALID_OPERATION')
      .map(({ level, location }) => ({ level, location })),
    [
      { level: 'warning', location: 'parse:security' },
      { level: 'error', location: 'parse:paths:/broken:get' },
      { level: 'error', location: 'parse:paths:/missing:get' },
      { level: 'error', location: 'parse:paths:/inherits:get' }
    ]
  )
})
