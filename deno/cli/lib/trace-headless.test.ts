import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert/assert'
import { assertStringIncludes } from '@std/assert/string-includes'
import { fromFileUrl } from '@std/path/from-file-url'
import { parseLocation, runTrace } from '@/lib/trace-headless.ts'
import { explainProducer, explainRef } from '@/lib/explain-headless.ts'
import {
  resolvePointerInDocument,
  trailToSchemaPointer
} from '@/lib/provenance/schema-pointer.ts'

const fixtureRoot = fromFileUrl(new URL('./provenance/__fixtures__/root', import.meta.url))

Deno.test('parseLocation handles line and optional column', () => {
  assertEquals(parseLocation('src/a.ts:12'), { file: 'src/a.ts', line: 12, column: 1 })
  assertEquals(parseLocation('src/a.ts:12:5'), { file: 'src/a.ts', line: 12, column: 5 })
  assertEquals(parseLocation('src/a.ts'), undefined)
  assertEquals(parseLocation('src/a.ts:0'), undefined)
})

Deno.test('runTrace answers with the producer chain innermost-first', async () => {
  const result = await runTrace({
    root: fixtureRoot,
    location: 'src/types/pet.generated.ts:2:3'
  })
  assert(result.type === 'traced', JSON.stringify(result))
  assertEquals(result.project, 'demo')
  assertEquals(
    result.chain.map(hop => hop.producer),
    ['DemoString', 'DemoDefinition']
  )
  assertEquals(result.chain[0]?.schemaPointer, '#/components/schemas/Pet/properties/name')
  assertEquals(result.chain[0]?.generator, '@test/gen-demo')
  assert(result.chain[0]?.producerSource?.endsWith('gen-demo/src/DemoString.ts:1'))
})

Deno.test('runTrace carries the freshness header with the theme-1 invariant', async () => {
  const result = await runTrace({
    root: fixtureRoot,
    location: 'src/types/pet.generated.ts:1'
  })
  assert(result.type === 'traced')
  assertEquals(result.freshness.manifestPresent, true)
  assertEquals(result.freshness.mapsPresent, true)
  // The fixture manifest records one zero-character file beside a success
  // result — the impossible state must surface on every answer.
  assertEquals(result.freshness.invariants.emptyOutputWithSuccess, true)
  assertEquals(result.freshness.invariants.emptyFileCount, 1)
})

Deno.test('runTrace fails cleanly on malformed and unknown input', async () => {
  const malformed = await runTrace({ root: fixtureRoot, location: 'no-line-number' })
  assert(malformed.type === 'trace-failed')
  assertStringIncludes(malformed.message, 'not <file>:<line>')

  const unknown = await runTrace({ root: fixtureRoot, location: 'src/nope.ts:1' })
  assert(unknown.type === 'trace-failed')
  assertStringIncludes(unknown.message, 'nope.ts')
})

Deno.test('explainProducer returns sources, counts, and a real output sample', async () => {
  const result = await explainProducer({ root: fixtureRoot, className: 'DemoString' })
  assert(result.type === 'producer-explained', JSON.stringify(result))
  assertEquals(result.project, 'demo')
  assertEquals(result.spanCount, 1)
  assertEquals(result.fileCount, 1)
  assert(result.sources[0]?.endsWith('gen-demo/src/DemoString.ts:1'))
  assertEquals(result.samples[0]?.code, 'name: string')
  assertEquals(result.samples[0]?.schemaPointer, '#/components/schemas/Pet/properties/name')
})

Deno.test('explainProducer notes an unexercised producer instead of failing', async () => {
  const result = await explainProducer({ root: fixtureRoot, className: 'DemoHelper' })
  assert(result.type === 'producer-explained')
  assertEquals(result.spanCount, 0)
  assertStringIncludes(result.notes[0] ?? '', 'no spans in the last generate')
})

Deno.test('explainRef answers from the generation-map index', async () => {
  const result = await explainRef({ root: fixtureRoot, name: 'Pet' })
  assert(result.type === 'ref-explained', JSON.stringify(result))
  assertEquals(result.definitions.length, 1)
  assertEquals(result.definitions[0]?.artifactPath, 'src/types/pet.generated.ts')
  assertEquals(result.definitions[0]?.generator, '@test/gen-demo')
  assertEquals(result.definitions[0]?.schemaPointer, '#/components/schemas/Pet')
})

Deno.test('explainRef reports an unknown name with notes, not an error', async () => {
  const result = await explainRef({ root: fixtureRoot, name: 'Nope' })
  assert(result.type === 'ref-explained')
  assertEquals(result.definitions.length, 0)
  assertStringIncludes(result.notes[0] ?? '', "'Nope'")
})

Deno.test('schema-pointer helpers survive the port', () => {
  const swagger2 = '{"definitions": {"Pet": {"type": "object"}}}'
  const range = resolvePointerInDocument(swagger2, '#/components/schemas/Pet')
  assert(range !== undefined, 'expected the #/definitions fallback to resolve')
  assertEquals(swagger2.slice(range.keyStart, range.keyEnd), '"Pet"')
  assertEquals(
    trailToSchemaPointer('t:s:parse:components:schemas:Pet:properties:name'),
    '#/components/schemas/Pet/properties/name'
  )
})
