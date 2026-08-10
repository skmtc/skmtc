import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { mergeIntersection } from './merge-intersection.ts'
import type { GetRefFn } from './types.ts'

/**
 * 3.1 list-valued `type` through the merge.
 *
 * `['string','null']` is 3.1's nullable string. `checkAtLeastOneTypeMatch` routes
 * such a schema to the SCALAR merger, because the scalar is a member of the
 * list — and the scalar mergers used to assign `result.type = 'string'`,
 * flattening the list and dropping the `null`.
 *
 * That is worse than the throw it replaced: `normalizeTypeArray` (which turns a
 * list into `type` + `nullable`) runs on the MERGED result, so once the merge
 * has discarded the `null` the field emits as non-nullable. A loud failure
 * became silently wrong output.
 *
 * The object/array paths never had the problem — they merge through
 * `genericMerge`, which spreads `type` through untouched — so the object cases
 * below are the control.
 */

const noRefs = (() => {
  throw new Error('no refs in these fixtures')
}) as GetRefFn

// deno-lint-ignore no-explicit-any
const merge = (schema: any) =>
  mergeIntersection({ schema, getRef: noRefs }) as OpenAPIV3.SchemaObject

/**
 * `type` is read loosely for the same reason the parser does it: the 3.0-typed
 * `SchemaObject` models a single string, and the whole point here is the 3.1
 * list form it cannot express.
 */
const typeOf = (schema: OpenAPIV3.SchemaObject): unknown => schema.type

Deno.test('list types - a scalar constraint keeps the null member', () => {
  const merged = merge({ allOf: [{ type: ['string', 'null'] }, { maxLength: 5 }] })

  assertEquals(typeOf(merged), ['string', 'null'], 'the null member must survive the merge')
  assertEquals(merged.maxLength, 5)
})

Deno.test('list types - two list-typed string members merge', () => {
  const merged = merge({
    allOf: [
      { type: ['string', 'null'], maxLength: 10 },
      { type: ['string', 'null'], minLength: 2 }
    ]
  })

  assertEquals(typeOf(merged), ['string', 'null'])
  assertEquals(merged.maxLength, 10)
  assertEquals(merged.minLength, 2)
})

Deno.test('list types - two list-typed number members merge', () => {
  const merged = merge({
    allOf: [
      { type: ['number', 'null'], minimum: 1 },
      { type: ['number', 'null'], maximum: 9 }
    ]
  })

  assertEquals(typeOf(merged), ['number', 'null'])
  assertEquals(merged.minimum, 1)
  assertEquals(merged.maximum, 9)
})

Deno.test('list types - two list-typed integer members merge', () => {
  const merged = merge({
    allOf: [
      { type: ['integer', 'null'], minimum: 1 },
      { type: ['integer', 'null'], maximum: 9 }
    ]
  })

  assertEquals(typeOf(merged), ['integer', 'null'])
})

Deno.test('list types - a plain scalar on both sides stays a plain scalar', () => {
  const merged = merge({ allOf: [{ type: 'string', maxLength: 4 }, { type: 'string' }] })

  assertEquals(typeOf(merged), 'string', 'no list involved, so no list in the output')
})

Deno.test('list types - object members keep their list type (control)', () => {
  const merged = merge({
    allOf: [
      { type: ['object', 'null'], properties: { a: { type: 'string' } } },
      { type: ['object', 'null'], properties: { b: { type: 'string' } } }
    ]
  })

  assertEquals(typeOf(merged), ['object', 'null'])
  assertEquals(Object.keys(merged.properties ?? {}).sort(), ['a', 'b'])
})
