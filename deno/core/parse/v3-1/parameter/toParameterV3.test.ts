import { mockParseContext } from '@/test/mockParseContext.ts'
import { toParameterListV3, toParametersV3, toOptionalParametersV3 } from './toParameterV3.ts'
import { assertEquals, assert } from '@std/assert'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('toParameterListV3 - basic path parameter', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toParameterListV3({
    stackTrail,
    parameters: [{ name: 'test', in: 'path' }],
    context: mockParseContext
  })

  assertEquals(result !== undefined, true)
  assertEquals(result?.length, 1)
  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].name, 'test')
  assertEquals(result?.[0].location, 'path')
  assertEquals(result?.[0].required, true)
  assertEquals(result?.[0].style, 'simple')
  assertEquals(result?.[0].explode, false)
})

Deno.test('toParameterListV3 - parameter with description and required', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: OpenAPIV3.ParameterObject[] = [
    {
      name: 'userId',
      in: 'path',
      description: 'User identifier',
      required: true
    }
  ]

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].name, 'userId')
  assertEquals(result?.[0].description, 'User identifier')
  assertEquals(result?.[0].required, true)
})

Deno.test('toParameterListV3 - parameter with deprecated flag', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: OpenAPIV3.ParameterObject[] = [
    {
      name: 'oldParam',
      in: 'query',
      deprecated: true
    }
  ]

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].name, 'oldParam')
  assertEquals(result?.[0].deprecated, true)
  assertEquals(result?.[0].location, 'query')
})

Deno.test('toParameterListV3 - parameter with allowEmptyValue and allowReserved', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: OpenAPIV3.ParameterObject[] = [
    {
      name: 'filter',
      in: 'query',
      allowEmptyValue: true,
      allowReserved: true
    }
  ]

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].allowEmptyValue, true)
  assertEquals(result?.[0].allowReserved, true)
})

Deno.test('toParameterListV3 - parameter with extension fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters = [
    {
      name: 'param',
      in: 'query',
      'x-custom': 'value',
      'x-internal': true
    }
  ] as any

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].extensionFields?.['x-custom'], 'value')
  assertEquals(result?.[0].extensionFields?.['x-internal'], true)
})

Deno.test('toParameterListV3 - parameter with all optional fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: OpenAPIV3.ParameterObject[] = [
    {
      name: 'complexParam',
      in: 'query',
      description: 'A complex parameter',
      required: true,
      deprecated: true,
      allowEmptyValue: true,
      allowReserved: true,
      schema: { type: 'string' },
      style: 'form',
      explode: true
    }
  ]

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assert(result?.[0] instanceof OasParameter)
  assertEquals(result?.[0].name, 'complexParam')
  assertEquals(result?.[0].description, 'A complex parameter')
  assertEquals(result?.[0].required, true)
  assertEquals(result?.[0].deprecated, true)
  assertEquals(result?.[0].allowEmptyValue, true)
  assertEquals(result?.[0].allowReserved, true)
  assertEquals(result?.[0].style, 'form')
  assertEquals(result?.[0].explode, true)
})

Deno.test('toParameterListV3 - undefined returns undefined', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toParameterListV3({
    stackTrail,
    parameters: undefined,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toParameterListV3 - empty array returns empty array', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toParameterListV3({
    stackTrail,
    parameters: [],
    context: mockParseContext
  })

  assertEquals(result, [])
})

Deno.test('toParameterListV3 - multiple parameters', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: OpenAPIV3.ParameterObject[] = [
    { name: 'id', in: 'path' },
    { name: 'page', in: 'query' },
    { name: 'Authorization', in: 'header' }
  ]

  const result = toParameterListV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assertEquals(result?.length, 3)
  assert(result?.[0] instanceof OasParameter)
  assert(result?.[1] instanceof OasParameter)
  assert(result?.[2] instanceof OasParameter)
  assertEquals(result?.[0].name, 'id')
  assertEquals(result?.[1].name, 'page')
  assertEquals(result?.[2].name, 'Authorization')
})

Deno.test('toParametersV3 - empty object returns empty object', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: Record<string, OpenAPIV3.ParameterObject> = {}

  const result = toParametersV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assertEquals(result, {})
})

Deno.test('toParametersV3 - single parameter', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: Record<string, OpenAPIV3.ParameterObject> = {
    userId: {
      name: 'userId',
      in: 'path',
      description: 'User ID'
    }
  }

  const result = toParametersV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assertEquals(Object.keys(result).length, 1)
  assert(result.userId instanceof OasParameter)
  assertEquals(result.userId.name, 'userId')
  assertEquals(result.userId.description, 'User ID')
})

Deno.test('toParametersV3 - multiple parameters', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: Record<string, OpenAPIV3.ParameterObject> = {
    userId: { name: 'userId', in: 'path' },
    page: { name: 'page', in: 'query' },
    auth: { name: 'Authorization', in: 'header' }
  }

  const result = toParametersV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assertEquals(Object.keys(result).length, 3)
  assert(result.userId instanceof OasParameter)
  assert(result.page instanceof OasParameter)
  assert(result.auth instanceof OasParameter)
  assertEquals(result.userId.name, 'userId')
  assertEquals(result.page.name, 'page')
  assertEquals(result.auth.name, 'Authorization')
})

Deno.test('toOptionalParametersV3 - returns undefined when input is undefined', () => {
  const stackTrail = new StackTrail(['TEST'])

  const result = toOptionalParametersV3({
    stackTrail,
    parameters: undefined,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toOptionalParametersV3 - converts when input is provided', () => {
  const stackTrail = new StackTrail(['TEST'])
  const parameters: Record<string, OpenAPIV3.ParameterObject> = {
    userId: { name: 'userId', in: 'path' }
  }

  const result = toOptionalParametersV3({
    stackTrail,
    parameters,
    context: mockParseContext
  })

  assertEquals(result !== undefined, true)
  assert(result?.userId instanceof OasParameter)
  assertEquals(result?.userId.name, 'userId')
})
