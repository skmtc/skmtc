/**
 * End-to-end test: pipeline emits sidecars + generation map when a
 * post-pass config is supplied (capture itself is always on).
 *
 * Wires a minimal model generator against a one-schema OpenAPI doc
 * and asserts the post-pass output (sidecars keyed by file path,
 * generation map populated) lands on the result.
 */

import { assert, assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { oxcAdapter } from '@/anchors/oxcAdapter.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { OpenAPIV3 } from 'openapi-types'

const ModelBase = toModelProjectionBase({
  id: '@test/gen-model',
  toIdentifier: ({ refName }) => Identifier.createType(refName),
  toExportPath: ({ refName }) => `@/types/${refName}.generated.ts`
})

class ModelProjection extends ModelBase {
  override toString(): string {
    return `{ id: string }`
  }
}

// The real `ModelProjection` static type requires `schemaToValueFn`
// and `createIdentifier`. Stock generators (`gen-typescript`,
// `gen-zod`) supply those. For this test the fixture model produces
// a constant body, so the static-shape check is the only blocker —
// cast through the test boundary.
const modelEntry = toModelEntry({
  id: '@test/gen-model',
  transform: ({ context, refName }) => {
    // deno-lint-ignore no-explicit-any
    context.insertModel(ModelProjection as any, refName)
  }
})

const oasDoc: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {},
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }
}

const buildGenerators = <EnrichmentType = undefined>(): GeneratorsMapContainer<EnrichmentType> =>
  // deno-lint-ignore no-explicit-any
  ({ '@test/gen-model': modelEntry } as any)

Deno.test('toArtifacts - no attribution config → no sidecars / generation map in result', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: buildGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test'])
  })

  assertEquals(result.sidecars, undefined)
  assertEquals(result.generationMap, undefined)
})

Deno.test('toArtifacts - attribution without postPass → still no sidecars (capture only)', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: buildGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test']),
    attribution: {}
  })

  // Pipeline ran with instrumentation but no post-pass was configured;
  // no sidecars / generation map should be present.
  assertEquals(result.sidecars, undefined)
  assertEquals(result.generationMap, undefined)
  // The standard artifacts are still produced normally.
  assert(Object.keys(result.artifacts).length > 0)
})

Deno.test('toArtifacts - attribution + postPass → sidecars emitted per File', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: buildGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test']),
    attribution: {
      postPass: {
        parser: oxcAdapter,
        schemaSrc: 'openapi.json'
      }
    }
  })

  assert(result.sidecars !== undefined, 'expected sidecars on the result')
  assert(result.generationMap !== undefined, 'expected generation map on the result')

  // One sidecar per non-Json file. The model generator emits
  // @/types/User.generated.ts.
  const sidecarPaths = Object.keys(result.sidecars!)
  assert(sidecarPaths.length >= 1)
  const userSidecar = result.sidecars![sidecarPaths.find(p => p.endsWith('User.generated.ts'))!]
  assert(userSidecar !== undefined)
  assertEquals(userSidecar.v, 2)
  assertEquals(userSidecar.src, 'openapi.json')
  assert(userSidecar.parser.startsWith('oxc@'))
})

Deno.test('toArtifacts - generation map carries one entry per Definition', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: buildGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test']),
    attribution: {
      postPass: {
        parser: oxcAdapter,
        schemaSrc: 'openapi.json'
      }
    }
  })

  assert(result.generationMap !== undefined)
  // Document has one schema (User) → one model Definition → one
  // generation-map entry pointing at the generated User file.
  const userEntry = result.generationMap!.find(e => e.name === 'User')
  assert(userEntry !== undefined, 'expected a generation-map entry for User')
  assertEquals(userEntry!.g, '@test/gen-model')
  assertEquals(userEntry!.s, '#/components/schemas/User')
  assertEquals(userEntry!.v, 'main')
})

Deno.test('toArtifacts - generatorMeta lookup flows through to sidecar entries', () => {
  const result = toArtifacts({
    traceId: 't',
    spanId: 's',
    document: { type: 'oas', value: oasDoc },
    settings: undefined,
    toGeneratorConfigMap: buildGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['test']),
    attribution: {
      postPass: {
        parser: oxcAdapter,
        schemaSrc: 'openapi.json',
        generatorMeta: (genId) => ({
          version: genId === '@test/gen-model' ? '1.2.3' : '',
          registry: { host: 'jsr.skmtc.dev', kind: 'jsr-private' }
        })
      }
    }
  })

  assert(result.sidecars !== undefined)
  // Pick any sidecar; its G pool should reflect the lookup.
  const sidecar = Object.values(result.sidecars!)[0]
  const ourGen = sidecar.G.find(g => g.name === '@test/gen-model')
  assert(ourGen !== undefined)
  assertEquals(ourGen!.version, '1.2.3')
  assertEquals(sidecar.R[ourGen!.r], { host: 'jsr.skmtc.dev', kind: 'jsr-private' })
})
