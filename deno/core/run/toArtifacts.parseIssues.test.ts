/**
 * Tests for the parseIssues plumbing in `toArtifacts`:
 *   - OAS run surfaces a `parseIssues` array on the manifest (empty
 *     for clean input, populated when the document is bad).
 *   - GQL run goes through the same `toArtifacts` entry — no separate
 *     toArtifactsFromGraphQL — and also surfaces `parseIssues`.
 *   - The manifest's `parseIssues` round-trips through the Valibot
 *     schema cleanly (the runtime schema matches the TS type).
 */
import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { manifestContent } from '@/types/Manifest.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { OpenAPIV3 } from 'openapi-types'

const emptyGenerators = <EnrichmentType = undefined>(): GeneratorsMapContainer<EnrichmentType> =>
  ({}) as GeneratorsMapContainer<EnrichmentType>

const oasDoc: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {}
}

Deno.test('toArtifacts (oas) - returns parseIssues inside the manifest, empty for a clean doc', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: emptyGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test'])
  })

  // The manifest must always carry parseIssues (required field) — clean
  // docs produce an empty array, not a missing field.
  assertEquals(Array.isArray(result.manifest.parseIssues), true)
  assertEquals(result.manifest.parseIssues.length, 0)
})

Deno.test('toArtifacts (gql) - runs through the same entry as oas and surfaces parseIssues on the manifest', () => {
  // A schema that triggers a known GQL parse issue (NESTED_LIST_LOSSY)
  // so we can confirm the field flows end-to-end.
  const sdl = /* GraphQL */ `
    type Matrix {
      cells: [[Int]]
    }
    type Query {
      _: Boolean
    }
  `

  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'gql', value: sdl },
    settings: undefined,
    toGeneratorConfigMap: emptyGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test'])
  })

  const lossy = result.manifest.parseIssues.filter(i => i.type === 'NESTED_LIST_LOSSY')
  assertEquals(lossy.length, 1)
  assertEquals(lossy[0].protocol, 'gql')
  assertEquals(lossy[0].level, 'warning')
  // Location is the protocol-neutral `:`-joined stack trail. The
  // outer trace context ('test', 'parse') is contributed by
  // CoreContext.toArtifacts wrapping parseGqlDocument in
  // `stackTrail.trace('parse', ...)`. Real-world locations carry that
  // outer context too — agents reading the manifest will see the full
  // path.
  assertEquals(lossy[0].location.endsWith('Matrix:cells'), true)
})

Deno.test('manifestContent schema - round-trips a manifest carrying mixed parseIssues', () => {
  const manifest = {
    deploymentId: 'd',
    traceId: 't',
    spanId: 's',
    files: {},
    previews: {},
    results: {},
    parseIssues: [
      {
        protocol: 'oas' as const,
        level: 'error' as const,
        type: 'INVALID_SCHEMA',
        location: 'components.schemas.User',
        message: 'bad',
        cause: new Error('detail')
      },
      {
        protocol: 'gql' as const,
        level: 'warning' as const,
        type: 'NESTED_LIST_LOSSY',
        location: 'Matrix.cells',
        message: 'nested lists collapsed'
      }
    ],
    startAt: 0,
    endAt: 1
  }

  const parsed = v.parse(manifestContent, manifest)
  assertEquals(parsed.parseIssues.length, 2)
  assertEquals(parsed.parseIssues[0].protocol, 'oas')
  assertEquals(parsed.parseIssues[1].protocol, 'gql')
})

Deno.test('toArtifacts (oas) - a parse error keeps its name, message and stack through JSON', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: {
      type: 'oas',
      value: {
        ...oasDoc,
        components: {
          schemas: {
            // `minLength` must be a number, so the string schema throws.
            A: { type: 'object', properties: { x: { type: 'string', minLength: 'oops' } } }
          }
        }
      } as unknown as OpenAPIV3.Document
    },
    settings: undefined,
    toGeneratorConfigMap: emptyGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test'])
  })

  const written = v.parse(manifestContent, JSON.parse(JSON.stringify(result.manifest)))
  const issue = written.parseIssues.find(i => i.level === 'error')

  if (issue?.level !== 'error' || issue.cause === undefined) {
    throw new Error('expected an error issue with a cause')
  }
  assertEquals(issue.cause.name, 'ValiError')
  assertEquals(issue.cause.message, issue.message)
  assertEquals(issue.cause.stack?.startsWith('ValiError: '), true)
})

Deno.test('manifestContent schema - reads a legacy cause as a SerializedError', () => {
  const legacyIssue = (cause: unknown) => ({
    protocol: 'oas',
    level: 'error',
    type: 'INVALID_SCHEMA',
    location: 'components.schemas.User',
    message: 'bad',
    cause
  })
  const manifest = {
    deploymentId: 'd',
    traceId: 't',
    spanId: 's',
    files: {},
    previews: {},
    results: {},
    // An Error written by `JSON.stringify` before core serialized it, and a string.
    parseIssues: [legacyIssue({}), legacyIssue('text')],
    startAt: 0,
    endAt: 1
  }

  const parsed = v.parse(manifestContent, manifest)
  const causes = parsed.parseIssues.map(issue =>
    issue.level === 'error' ? issue.cause : undefined
  )

  assertEquals(causes, [
    { name: 'NonError', message: '{}' },
    { name: 'NonError', message: 'text' }
  ])
})

Deno.test('manifestContent schema - rejects a parseIssue with an unknown protocol', () => {
  const manifest = {
    deploymentId: 'd',
    traceId: 't',
    spanId: 's',
    files: {},
    previews: {},
    results: {},
    parseIssues: [
      {
        protocol: 'rest',
        level: 'error',
        type: 'INVALID_SCHEMA',
        location: 'foo',
        message: 'x'
      }
    ],
    startAt: 0,
    endAt: 1
  }

  let threw = false
  try {
    v.parse(manifestContent, manifest)
  } catch {
    threw = true
  }
  assertEquals(threw, true, 'expected unknown protocol to be rejected by the runtime schema')
})
