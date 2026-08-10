import type { OpenAPIV3 } from 'openapi-types'
import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toSchemaV3 } from './toSchemasV3.ts'

/**
 * Two properties of union parsing that are easy to break while refactoring, and
 * invisible to the validation-equivalence harness unless a spec-authored example
 * happens to exercise them. Both were broken once and caught in review.
 */

const parse = (schema: OpenAPIV3.SchemaObject) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: {
        openapi: '3.0.3',
        info: { title: 't', version: '1' },
        paths: {}
      } as OpenAPIV3.Document
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  return toSchemaV3({ schema, stackTrail: new StackTrail(), context })
}

/**
 * `decomposeUnion` splits the parent's keys AT the union keyword: siblings
 * after it merge into each member as `second` and win; siblings before it merge
 * as `first` and lose. Anything that rebuilds the schema must keep the keyword
 * where the author put it.
 *
 * Appending the keyword instead (`{ ...rest, oneOf: members }`) drops every
 * sibling into the `before` bucket, so a parent `additionalProperties: false`
 * stops closing its members — the contract silently WIDENS.
 */
Deno.test('union - a parent key authored after the keyword wins over members', () => {
  const parsed = parse({
    oneOf: [
      { type: 'object', additionalProperties: true, properties: { a: { type: 'string' } } },
      { type: 'object', additionalProperties: true, properties: { b: { type: 'string' } } }
    ],
    type: 'object',
    additionalProperties: false
  })

  assert(parsed.type === 'union', 'expected a union')

  for (const member of parsed.members) {
    assert(member.type === 'object', 'expected object members')
    assertEquals(
      member.additionalProperties,
      false,
      'the parent closed the object after the keyword; the member must not reopen it'
    )
  }
})

Deno.test('union - a parent key authored before the keyword loses to members', () => {
  const parsed = parse({
    type: 'object',
    additionalProperties: false,
    oneOf: [
      { type: 'object', additionalProperties: true, properties: { a: { type: 'string' } } },
      { type: 'object', additionalProperties: true, properties: { b: { type: 'string' } } }
    ]
  })

  assert(parsed.type === 'union', 'expected a union')

  for (const member of parsed.members) {
    assert(member.type === 'object', 'expected object members')
    assertEquals(member.additionalProperties, true, 'a key before the keyword loses to the member')
  }
})

/**
 * `anyOf` and `oneOf` reach the same IR node, so nesting must collapse the same
 * way whichever keyword spells it. Reading only the parent's own keyword left
 * `anyOf`-inside-`anyOf` nested while flattening `oneOf`-inside-`anyOf`.
 */
const memberTypes = (schema: ReturnType<typeof parse>): string[] => {
  assert(schema.type === 'union', 'expected a union')
  return schema.members.map(member => member.type)
}

Deno.test('union - a nested anyOf flattens into its parent', () => {
  const parsed = parse({
    anyOf: [{ anyOf: [{ type: 'string' }, { type: 'integer' }] }, { type: 'boolean' }]
  })

  assertEquals(memberTypes(parsed), ['string', 'integer', 'boolean'])
})

Deno.test('union - a nested oneOf flattens into an anyOf parent', () => {
  const parsed = parse({
    anyOf: [{ oneOf: [{ type: 'string' }, { type: 'integer' }] }, { type: 'boolean' }]
  })

  assertEquals(memberTypes(parsed), ['string', 'integer', 'boolean'])
})

Deno.test('union - a nested anyOf flattens into a oneOf parent', () => {
  const parsed = parse({
    oneOf: [{ anyOf: [{ type: 'string' }, { type: 'integer' }] }, { type: 'boolean' }]
  })

  assertEquals(memberTypes(parsed), ['string', 'integer', 'boolean'])
})
