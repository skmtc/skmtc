import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from '@std/log'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

// A component with a parse error is removed, even when the error is in one
// of its properties. Everything that reaches it, directly or through other
// components at any depth, is pruned with one INVALID_DEPENDENCY_REF that
// names the error. This holds when the run's trail carries a trace and span
// prefix (the CLI and worker path).

const okResponse = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => ({
  '200': { description: 'ok', content: { 'application/json': { schema } } }
})

const toSchemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const toGet = (operationId: string, schema: OpenAPIV3.ReferenceObject) => ({
  get: { operationId, responses: okResponse(schema) }
})

// Documents in the wild hold entries the parser's input type does not allow
// (`oneOf: []`).
const toDocument = (value: unknown): OpenAPIV3.Document => JSON.parse(JSON.stringify(value))

// X has an error in property `p`. B reaches X directly, A through B, and
// Loop and X reference each other.
const document = toDocument({
  openapi: '3.1.0',
  info: { title: 't', version: '0' },
  paths: {
    '/direct': toGet('direct', toSchemaRef('X')),
    '/chain': toGet('chain', toSchemaRef('A')),
    '/loop': toGet('loop', toSchemaRef('Loop')),
    '/unrelated': toGet('unrelated', toSchemaRef('Unrelated'))
  },
  components: {
    schemas: {
      X: {
        type: 'object',
        properties: { p: { oneOf: [] }, q: { type: 'string' }, loop: toSchemaRef('Loop') }
      },
      B: { type: 'object', properties: { x: toSchemaRef('X') } },
      A: { type: 'object', properties: { b: toSchemaRef('B') } },
      Loop: { type: 'object', properties: { x: toSchemaRef('X') } },
      Unrelated: { type: 'object', properties: { name: { type: 'string' } } }
    }
  }
})

const rootCause = 'components:schemas:X:properties:p'

type RunResult = {
  operations: string[]
  models: string[]
  issues: { type: string; location: string; message: string }[]
}

const run = (doc: OpenAPIV3.Document, frames: string[]): RunResult => {
  const operations: string[] = []
  const models: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'operation-seen': toOasOperationEntry({
      id: 'operation-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        operations.push(`${operation.method} ${operation.path}`)
      }
    }),
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'model-seen': toModelEntry({
      id: 'model-seen',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ refName }) => {
        models.push(refName)
      }
    })
  })

  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: doc },
    settings: undefined,
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(frames)
  })

  return {
    operations: operations.toSorted(),
    models: models.toSorted(),
    issues: result.manifest.parseIssues.map(({ type, location, message }) => ({
      type,
      location,
      message
    }))
  }
}

/** `result` with `prefix` cut from every issue location and from the locations in messages. */
const withoutPrefix = (result: RunResult, prefix: string): RunResult => ({
  ...result,
  issues: result.issues.map(({ type, location, message }) => {
    assertEquals(location.startsWith(prefix), true, `${location} starts with ${prefix}`)
    return {
      type,
      location: location.slice(prefix.length),
      message: message.replaceAll(`'${prefix}`, `'`)
    }
  })
})

/** The same document through a direct `ParseContext.parse(new StackTrail([]))`. */
const parseDirectly = (doc: OpenAPIV3.Document): RunResult => {
  const context = new ParseContext({
    input: { type: 'oas', value: doc },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  context.parse(new StackTrail([]))

  return {
    operations: context.oasDocument.operations
      .map(({ method, path }) => `${method} ${path}`)
      .toSorted(),
    models: context.oasDocument.components?.toSchemasRefNames().toSorted() ?? [],
    issues: context.issues.map(({ type, location, message }) => ({ type, location, message }))
  }
}

/** Every `$ref` string anywhere under `value`. */
const toRefs = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(toRefs)
  }

  if (typeof value !== 'object' || value === null) {
    return []
  }

  return Object.entries(value).flatMap(([key, child]) =>
    key === '$ref' && typeof child === 'string' ? [child] : toRefs(child)
  )
}

/** Schema refs in the kept operations and models that name a schema no longer in the output. */
const toDanglingRefs = (doc: OpenAPIV3.Document, result: RunResult): string[] => {
  const kept = new Set(result.models.map(name => `#/components/schemas/${name}`))
  const operationRefs = result.operations.flatMap(operation => {
    const [method, path] = operation.split(' ')
    const pathItem: Record<string, unknown> = { ...doc.paths[path] }
    return toRefs(pathItem[method])
  })
  const modelRefs = result.models.flatMap(name => toRefs(doc.components?.schemas?.[name]))

  return [...operationRefs, ...modelRefs].filter(ref => !kept.has(ref))
}

const dependencyIssue = (location: string, refKey: string, message: string) => ({
  type: 'INVALID_DEPENDENCY_REF',
  location,
  message: `Depends on '${refKey}', removed because of the error at '${rootCause}': ${message}`
})

Deno.test('toArtifacts pruning - an error in one property removes the component and everything that reaches it', () => {
  const result = withoutPrefix(run(document, ['t', 's']), 't:s:parse:')
  const [schemaError] = result.issues

  assertEquals(schemaError.type, 'INVALID_SCHEMA')
  assertEquals(schemaError.location, rootCause)
  assertEquals(result.operations, ['get /unrelated'])
  assertEquals(result.models, ['Unrelated'])
  assertEquals(
    result.issues.slice(1).toSorted((a, b) => a.location.localeCompare(b.location)),
    [
      dependencyIssue(
        'components:schemas:A:properties:b',
        '#/components/schemas/B',
        schemaError.message
      ),
      dependencyIssue(
        'components:schemas:B:properties:x',
        '#/components/schemas/X',
        schemaError.message
      ),
      dependencyIssue(
        'components:schemas:Loop:properties:x',
        '#/components/schemas/X',
        schemaError.message
      ),
      dependencyIssue(
        'paths:/chain:get:responses:200:content:application/json:schema',
        '#/components/schemas/A',
        schemaError.message
      ),
      dependencyIssue(
        'paths:/direct:get:responses:200:content:application/json:schema',
        '#/components/schemas/X',
        schemaError.message
      ),
      dependencyIssue(
        'paths:/loop:get:responses:200:content:application/json:schema',
        '#/components/schemas/Loop',
        schemaError.message
      )
    ]
  )
  assertEquals(toDanglingRefs(document, result), [])
})

Deno.test('toArtifacts pruning - empty trail, prefixed trail and a direct parse agree', () => {
  const prefixed = withoutPrefix(run(document, ['t', 's']), 't:s:parse:')

  assertEquals(withoutPrefix(run(document, []), 'parse:'), prefixed)
  assertEquals(parseDirectly(document), prefixed)
})

// A request body and a header with an error each share a name with a schema
// that an unrelated operation uses. The error removes the request body and
// the header, and leaves the schemas.
// A path-level parameter is shared by every operation on its path.
const pathParameterDocument = toDocument({
  openapi: '3.1.0',
  info: { title: 't', version: '0' },
  paths: {
    '/shared': {
      parameters: [{ $ref: '#/components/parameters/Filter' }],
      get: { operationId: 'listShared', responses: { '204': { description: 'ok' } } },
      post: { operationId: 'createShared', responses: { '204': { description: 'ok' } } }
    },
    '/other': { get: { operationId: 'listOther', responses: { '204': { description: 'ok' } } } }
  },
  components: {
    parameters: {
      Filter: {
        name: 'filter',
        in: 'query',
        schema: { type: 'object', properties: { p: { oneOf: [] } } }
      }
    }
  }
})

Deno.test('toArtifacts pruning - a broken path-level parameter removes every operation on its path', () => {
  const result = withoutPrefix(run(pathParameterDocument, ['t', 's']), 't:s:parse:')

  assertEquals(result.operations, ['get /other'])
  assertEquals(
    result.issues.map(({ type, location }) => ({ type, location })),
    [
      {
        type: 'INVALID_SCHEMA',
        location: 'components:parameters:Filter:schema:properties:p'
      },
      { type: 'INVALID_DEPENDENCY_REF', location: 'paths:/shared:get' },
      { type: 'INVALID_DEPENDENCY_REF', location: 'paths:/shared:post' }
    ]
  )
})

const bucketDocument = toDocument({
  openapi: '3.1.0',
  info: { title: 't', version: '0' },
  paths: {
    '/body': {
      post: {
        operationId: 'withBody',
        requestBody: { $ref: '#/components/requestBodies/Shared' },
        responses: { '204': { description: 'ok' } }
      }
    },
    '/header': {
      get: {
        operationId: 'withHeader',
        responses: {
          '204': {
            description: 'ok',
            headers: { 'X-Shared': { $ref: '#/components/headers/Shared' } }
          }
        }
      }
    },
    '/schema': toGet('withSchema', toSchemaRef('Shared'))
  },
  components: {
    schemas: { Shared: { type: 'object', properties: { name: { type: 'string' } } } },
    requestBodies: {
      Shared: {
        content: {
          'application/json': { schema: { type: 'object', properties: { p: { oneOf: [] } } } }
        }
      }
    },
    headers: { Shared: { schema: { type: 'object', properties: { p: { oneOf: [] } } } } }
  }
})

Deno.test('toArtifacts pruning - an error in a request body or header removes that entry, not the schema of the same name', () => {
  const result = withoutPrefix(run(bucketDocument, ['t', 's']), 't:s:parse:')

  assertEquals(result.operations, ['get /schema'])
  assertEquals(result.models, ['Shared'])
  assertEquals(
    result.issues
      .filter(({ type }) => type === 'INVALID_DEPENDENCY_REF')
      .map(({ location }) => location)
      .toSorted(),
    ['paths:/body:post:requestBody', 'paths:/header:get:responses:204:headers:X-Shared']
  )

  const context = new ParseContext({
    input: { type: 'oas', value: bucketDocument },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  context.parse(new StackTrail(['t', 's', 'parse']))
  const components = context.oasDocument.components

  assertEquals(Object.keys(components?.schemas ?? {}), ['Shared'])
  assertEquals(Object.keys(components?.requestBodies ?? {}), [])
  assertEquals(Object.keys(components?.headers ?? {}), [])
})
