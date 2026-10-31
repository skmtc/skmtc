import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toTagsV3, type TagObjectV32 } from './toTagsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasTag } from '@/oas/tag/Tag.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import * as log from '@std/log'

const toContext = () =>
  new ParseContext({
    input: {
      type: 'oas',
      value: { openapi: '3.2.0', info: { title: 'Test', version: '1.0.0' }, paths: {} }
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

const toParents = (tags: OasTag[] | undefined) =>
  tags?.map(({ name, parent }) => ({ name, parent }))

Deno.test('toTagsV3 - basic tags', () => {
  const stackTrail = new StackTrail(['TEST'])
  const tags: OpenAPIV3.TagObject[] = [{ name: 'users' }]
  const oasTags = toTagsV3({ tags, stackTrail, context: mockParseContext })

  assertEquals(oasTags, [new OasTag({ name: 'users', description: undefined })])
})

Deno.test('toTagsV3 - reads the 3.2 summary, parent and kind', () => {
  const context = toContext()
  const tags: TagObjectV32[] = [
    { name: 'pets', summary: 'Pets', kind: 'nav' },
    { name: 'cats', parent: 'pets', kind: 'badge' }
  ]
  const oasTags = toTagsV3({ tags, stackTrail: new StackTrail(['TEST']), context })

  assertEquals(
    oasTags?.map(({ name, summary, parent, kind }) => ({ name, summary, parent, kind })),
    [
      { name: 'pets', summary: 'Pets', parent: undefined, kind: 'nav' },
      { name: 'cats', summary: undefined, parent: 'pets', kind: 'badge' }
    ]
  )
  assertEquals(context.issues, [])
})

Deno.test('toTagsV3 - a parent that is not a tag is dropped with INVALID_TAG_PARENT', () => {
  const context = toContext()
  const tags: TagObjectV32[] = [{ name: 'cats', summary: 'Cats', parent: 'pets' }]
  const oasTags = toTagsV3({ tags, stackTrail: new StackTrail(['TEST']), context })

  assertEquals(toParents(oasTags), [{ name: 'cats', parent: undefined }])
  assertEquals(oasTags?.[0].summary, 'Cats')
  assertEquals(
    context.issues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'INVALID_TAG_PARENT', location: 'TEST:0:parent' }]
  )
})

Deno.test('toTagsV3 - every tag on a parent cycle loses its parent', () => {
  const context = toContext()
  const tags: TagObjectV32[] = [
    { name: 'a', parent: 'b' },
    { name: 'b', parent: 'a' },
    { name: 'self', parent: 'self' },
    { name: 'leaf', parent: 'a' }
  ]
  const oasTags = toTagsV3({ tags, stackTrail: new StackTrail(['TEST']), context })

  // `leaf` hangs off the cycle but is not on it, so its parent stays.
  assertEquals(toParents(oasTags), [
    { name: 'a', parent: undefined },
    { name: 'b', parent: undefined },
    { name: 'self', parent: undefined },
    { name: 'leaf', parent: 'a' }
  ])
  assertEquals(
    context.issues.map(({ type, message }) => ({ type, message })),
    [
      {
        type: 'INVALID_TAG_PARENT',
        message: "Tag 'a' is in a parent cycle through 'b'; dropping 'parent'"
      },
      {
        type: 'INVALID_TAG_PARENT',
        message: "Tag 'b' is in a parent cycle through 'a'; dropping 'parent'"
      },
      {
        type: 'INVALID_TAG_PARENT',
        message: "Tag 'self' is in a parent cycle through 'self'; dropping 'parent'"
      }
    ]
  )
})

Deno.test('toTagsV3 - each tag is checked against its own parent', () => {
  const context = toContext()
  // Duplicate names are malformed, but each tag must still be judged by the
  // parent it declares, not by another tag with the same name.
  const tags: TagObjectV32[] = [{ name: 'pets', parent: 'ghost' }, { name: 'pets' }]
  const oasTags = toTagsV3({ tags, stackTrail: new StackTrail(['TEST']), context })

  assertEquals(toParents(oasTags), [
    { name: 'pets', parent: undefined },
    { name: 'pets', parent: undefined }
  ])
  assertEquals(
    context.issues.map(({ message }) => message),
    ["Tag 'pets' names parent 'ghost', which is not a tag; dropping 'parent'"]
  )
})

Deno.test('toTagsV3 - a parent chain several levels deep is valid', () => {
  const context = toContext()
  const tags: TagObjectV32[] = [
    { name: 'c', parent: 'b' },
    { name: 'b', parent: 'a' },
    { name: 'a' }
  ]
  const oasTags = toTagsV3({ tags, stackTrail: new StackTrail(['TEST']), context })

  assertEquals(toParents(oasTags), [
    { name: 'c', parent: 'b' },
    { name: 'b', parent: 'a' },
    { name: 'a', parent: undefined }
  ])
  assertEquals(context.issues, [])
})
