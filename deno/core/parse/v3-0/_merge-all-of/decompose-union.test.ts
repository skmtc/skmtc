/**
 * Direct unit tests for `decomposeUnion` — the split that decides which
 * union-level keys ride the wrapper (`beforeExcluded` / `afterExcluded`)
 * versus which distribute into each member (`decomposed`).
 *
 * Previously this was only exercised indirectly through `mergeUnion`, yet
 * `excludedProperties` is a frequently-touched seam: the "preserve $ref
 * identity" change added the metadata keys, and `not` handling later moved
 * upstream to `toSchemaV3`. These tests pin the bucketing directly.
 */
import { assertEquals } from '@std/assert'
import { decomposeUnion } from './decompose-union.ts'

Deno.test('decomposeUnion - metadata before the union is excluded onto the wrapper', () => {
  const result = decomposeUnion({
    schema: {
      description: 'Where a widget came from.',
      title: 'WidgetSource',
      anyOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }]
    },
    groupType: 'anyOf'
  })

  assertEquals(result.beforeExcluded, {
    description: 'Where a widget came from.',
    title: 'WidgetSource'
  })
  assertEquals(result.afterExcluded, {})
  // Only the union wrapper is left to distribute — no metadata leaks into the
  // members (which would force resolution of the $refs and lose their names).
  assertEquals(result.decomposed, [
    { anyOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }] }
  ])
})

Deno.test('decomposeUnion - metadata after the union is excluded onto the wrapper', () => {
  const result = decomposeUnion({
    schema: {
      anyOf: [{ type: 'string' }, { type: 'number' }],
      description: 'A scalar.',
      deprecated: true
    },
    groupType: 'anyOf'
  })

  assertEquals(result.beforeExcluded, {})
  assertEquals(result.afterExcluded, { description: 'A scalar.', deprecated: true })
  assertEquals(result.decomposed, [{ anyOf: [{ type: 'string' }, { type: 'number' }] }])
})

Deno.test('decomposeUnion - structural siblings stay in `decomposed` (they distribute into members)', () => {
  const result = decomposeUnion({
    schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      anyOf: [{ required: ['a'] }, { required: ['b'] }]
    },
    groupType: 'anyOf'
  })

  assertEquals(result.beforeExcluded, {})
  assertEquals(result.afterExcluded, {})
  assertEquals(result.decomposed, [
    { type: 'object', properties: { id: { type: 'string' } } },
    { anyOf: [{ required: ['a'] }, { required: ['b'] }] }
  ])
})

Deno.test('decomposeUnion - discriminator and default are excluded onto the wrapper', () => {
  const result = decomposeUnion({
    schema: {
      oneOf: [{ $ref: '#/components/schemas/Dog' }, { $ref: '#/components/schemas/Cat' }],
      discriminator: { propertyName: 'kind' },
      default: { kind: 'dog' }
    },
    groupType: 'oneOf'
  })

  assertEquals(result.afterExcluded, {
    discriminator: { propertyName: 'kind' },
    default: { kind: 'dog' }
  })
  assertEquals(result.decomposed, [
    { oneOf: [{ $ref: '#/components/schemas/Dog' }, { $ref: '#/components/schemas/Cat' }] }
  ])
})

Deno.test('decomposeUnion - `not` is NOT excluded here (refused upstream in toSchemaV3, never silently dropped)', () => {
  // Regression guard: `not` used to ride the wrapper, where it was silently
  // ignored — emitting a too-permissive type. It is now left in `decomposed`
  // so this layer never quietly discards it; a schema using `not` is refused
  // at parse time in `toSchemasV3` instead.
  const result = decomposeUnion({
    schema: {
      anyOf: [{ required: ['a'] }, { required: ['b'] }],
      not: { required: ['a', 'b'] }
    },
    groupType: 'anyOf'
  })

  assertEquals('not' in result.beforeExcluded, false)
  assertEquals('not' in result.afterExcluded, false)
  assertEquals(
    result.decomposed.some(part => 'not' in part),
    true,
    '`not` stays in `decomposed` rather than being excluded onto the wrapper'
  )
})
