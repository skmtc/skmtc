import { assertEquals } from '@std/assert'
import { GqlArgument } from './GqlArgument.ts'
import { OasString } from '@/oas/string/String.ts'

Deno.test('GqlArgument - required flag preserved', () => {
  const arg = new GqlArgument({
    name: 'id',
    schema: new OasString({}),
    required: true
  })

  assertEquals(arg.required, true)
  assertEquals(arg.name, 'id')
})

Deno.test('GqlArgument - default values for optional fields', () => {
  const arg = new GqlArgument({
    name: 'limit',
    schema: new OasString({}),
    required: false
  })

  assertEquals(arg.defaultValue, undefined)
  assertEquals(arg.description, undefined)
  assertEquals(arg.deprecated, false)
  assertEquals(arg.deprecationReason, undefined)
})

Deno.test('GqlArgument - deprecation metadata stored', () => {
  const arg = new GqlArgument({
    name: 'oldField',
    schema: new OasString({}),
    required: false,
    deprecated: true,
    deprecationReason: 'use newField instead'
  })

  assertEquals(arg.deprecated, true)
  assertEquals(arg.deprecationReason, 'use newField instead')
})

Deno.test('GqlArgument - defaultValue passes through unchanged', () => {
  const arg = new GqlArgument({
    name: 'count',
    schema: new OasString({}),
    required: false,
    defaultValue: 42
  })

  assertEquals(arg.defaultValue, 42)
})
