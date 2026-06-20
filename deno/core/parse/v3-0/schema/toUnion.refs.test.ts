/**
 * Parse-level guarantee for "preserve $ref identity in union members":
 * `anyOf` / `oneOf` of named `$ref`s parse into an `OasUnion` whose members
 * are `OasRef`s with their names intact — NOT inlined/resolved anonymous
 * objects. Previously only the merge step (`_merge-all-of/merge-union.test.ts`)
 * was covered; this pins the end-to-end OAS-model shape that generators see.
 */
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSchemaV3 } from './toSchemasV3.ts'
import { assert, assertEquals } from '@std/assert'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// `documentObject` is deliberately empty: preserving refs must NOT resolve
// them, so `toGetRef` is never consulted. If the parser regressed to inlining,
// resolution against `{}` would throw and fail these tests loudly.
const createTestContext = (): ParseContextType =>
  ({
    trace<T>(_token: string | string[], fn: () => T): T {
      return fn()
    },
    logSkippedFields(): void {},
    logIssue(): void {},
    logIssueNoKey(): void {},
    registerRef(): void {},
    documentObject: {} as unknown,
    withStackTrail<T>(_stackTrail: unknown, fn: () => T): T {
      return fn()
    }
  }) as unknown as ParseContextType

Deno.test('toSchemaV3 - anyOf of named $refs preserves ref identity', () => {
  const result = toSchemaV3({
    schema: {
      anyOf: [
        { $ref: '#/components/schemas/ModerationImageURLInput' },
        { $ref: '#/components/schemas/ModerationTextInput' }
      ]
    },
    stackTrail: new StackTrail(['components', 'schemas', 'ModerationMultiModalInput']),
    context: createTestContext()
  })

  assert(result instanceof OasUnion, 'expected an OasUnion')
  assertEquals(result.members.length, 2)
  assert(result.members[0] instanceof OasRef, 'member 0 stays a $ref')
  assert(result.members[1] instanceof OasRef, 'member 1 stays a $ref')
  assertEquals(result.members[0].toRefName(), 'ModerationImageURLInput')
  assertEquals(result.members[1].toRefName(), 'ModerationTextInput')
})

Deno.test('toSchemaV3 - oneOf of named $refs preserves ref identity', () => {
  const result = toSchemaV3({
    schema: {
      oneOf: [{ $ref: '#/components/schemas/Dog' }, { $ref: '#/components/schemas/Cat' }]
    },
    stackTrail: new StackTrail(['components', 'schemas', 'Pet']),
    context: createTestContext()
  })

  assert(result instanceof OasUnion)
  assertEquals(
    result.members.map(member => (member instanceof OasRef ? `${member.toRefName()}` : null)),
    ['Dog', 'Cat']
  )
})

Deno.test('toSchemaV3 - union-level metadata stays on the union; $ref members preserved', () => {
  const result = toSchemaV3({
    schema: {
      description: 'Where a widget came from.',
      title: 'WidgetSource',
      anyOf: [
        { $ref: '#/components/schemas/WidgetUrlSource' },
        { $ref: '#/components/schemas/WidgetFileSource' }
      ]
    },
    stackTrail: new StackTrail(['components', 'schemas', 'WidgetSource']),
    context: createTestContext()
  })

  assert(result instanceof OasUnion)
  assertEquals(result.description, 'Where a widget came from.')
  assertEquals(result.title, 'WidgetSource')
  assertEquals(result.members.length, 2)
  assert(
    result.members.every(member => member instanceof OasRef),
    'metadata on the union must not force members to resolve'
  )
})
