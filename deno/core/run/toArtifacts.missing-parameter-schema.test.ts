import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { emptyEnrichmentSchema, type Enrichments } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// The curog/curog operation from skmtc.dev: every parameter has neither
// `schema` nor `content`. Each one reads as `{}` with a
// MISSING_PARAMETER_SCHEMA warning, so a generator that reads each
// parameter's schema writes its file.

const document = toDocumentObject(
  {
    openapi: '3.0.1',
    info: { title: 'curog', version: '0' },
    paths: {
      '/home_streets/{home_street}/firms': {
        get: {
          parameters: [
            { name: 'home_street', in: 'path', required: true },
            { name: 'page', in: 'query' },
            { name: 'per_page', in: 'query' },
            { name: 'q', in: 'query' }
          ],
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  },
  'curog document'
)

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) =>
    new MockDefinition({ context, identifier, value }),
  toImport: () => {
    throw new Error('this test registers no cross-file imports')
  },
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

const ParametersBase = toOasOperationProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'parameters',
  toIdentifierName: () => 'firms',
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/firms.txt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/** Lists each parameter with the type of the schema `toSchema()` returns. */
class ParametersProjection extends ParametersBase {
  override toString(): string {
    return (this.operation.parameters ?? [])
      .map(parameter => {
        const resolved = parameter.resolve()
        return `${resolved.location} ${resolved.name}: ${resolved.toSchema().type}`
      })
      .join(', ')
  }
}

const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
  parameters: toOasOperationEntry({
    id: 'parameters',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation }) => {
      context.insertOperation({ projection: ParametersProjection, operation })
    }
  })
})

Deno.test('toArtifacts - parameters with neither schema nor content generate as {}', () => {
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

  assertEquals(result.manifest.results, {
    TEST: {
      generate: {
        parameters: {
          '/home_streets/{home_street}/firms': { get: { variant: { main: 'success' } } }
        }
      },
      render: { '@/firms.generated.txt': 'success' }
    }
  })
  assertEquals(Object.values(result.artifacts), [
    'def firms = path home_street: unknown, query page: unknown, query per_page: unknown, query q: unknown'
  ])
  assertEquals(
    result.manifest.parseIssues.map(({ level, type, location }) => ({ level, type, location })),
    [0, 1, 2, 3].map(index => ({
      level: 'warning',
      type: 'MISSING_PARAMETER_SCHEMA',
      location: `TEST:parse:paths:/home_streets/{home_street}/firms:get:parameters:${index}`
    }))
  )
})
