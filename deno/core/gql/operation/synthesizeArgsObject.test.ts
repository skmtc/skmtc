import { assertEquals } from '@std/assert'
import { synthesizeArgsObject } from './synthesizeArgsObject.ts'
import { GqlOperation } from './GqlOperation.ts'
import { GqlArgument } from '@/gql/argument/GqlArgument.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'

const op = (args: GqlArgument[] = []) =>
  new GqlOperation({
    rootKind: 'query',
    fieldName: 'getUser',
    arguments: args,
    returnType: new OasString({})
  })

Deno.test('synthesizeArgsObject - returns undefined for zero-argument operation', () => {
  assertEquals(synthesizeArgsObject(op([])), undefined)
})

Deno.test('synthesizeArgsObject - non-required argument not added to required list', () => {
  const result = synthesizeArgsObject(
    op([new GqlArgument({ name: 'limit', schema: new OasInteger({}), required: false })])
  )
  assertEquals(result?.required, undefined)
  assertEquals(Object.keys(result?.properties ?? {}), ['limit'])
})

Deno.test('synthesizeArgsObject - required argument without default goes into required', () => {
  const result = synthesizeArgsObject(
    op([new GqlArgument({ name: 'id', schema: new OasString({}), required: true })])
  )
  assertEquals(result?.required, ['id'])
})

Deno.test('synthesizeArgsObject - required argument WITH default treated as not required', () => {
  // A required field with a default value can be omitted by the caller,
  // so it doesn't show up on the parent's `required` list.
  const result = synthesizeArgsObject(
    op([
      new GqlArgument({
        name: 'limit',
        schema: new OasInteger({}),
        required: true,
        defaultValue: 10
      })
    ])
  )
  assertEquals(result?.required, undefined)
})

Deno.test('synthesizeArgsObject - mixed required and optional arguments', () => {
  const result = synthesizeArgsObject(
    op([
      new GqlArgument({ name: 'id', schema: new OasString({}), required: true }),
      new GqlArgument({
        name: 'limit',
        schema: new OasInteger({}),
        required: false,
        defaultValue: 10
      })
    ])
  )
  assertEquals(result?.required, ['id'])
  assertEquals(Object.keys(result?.properties ?? {}).sort(), ['id', 'limit'])
})

Deno.test('synthesizeArgsObject - title reflects field name', () => {
  const result = synthesizeArgsObject(
    op([new GqlArgument({ name: 'id', schema: new OasString({}), required: true })])
  )
  assertEquals(result?.title, 'getUser arguments')
})

Deno.test('synthesizeArgsObject - properties carry the argument schemas exactly', () => {
  const idSchema = new OasString({})
  const limitSchema = new OasInteger({})
  const result = synthesizeArgsObject(
    op([
      new GqlArgument({ name: 'id', schema: idSchema, required: true }),
      new GqlArgument({ name: 'limit', schema: limitSchema, required: false })
    ])
  )
  assertEquals(result?.properties!.id, idSchema)
  assertEquals(result?.properties!.limit, limitSchema)
})
