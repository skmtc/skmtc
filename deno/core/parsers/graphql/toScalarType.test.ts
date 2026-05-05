import { assertEquals, assertInstanceOf } from '@std/assert'
import { GraphQLScalarType } from 'graphql'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { OasBoolean } from '@/oas/boolean/Boolean.ts'
import { toScalarType } from './toScalarType.ts'

const builtin = (name: string) =>
  new GraphQLScalarType({ name, serialize: x => x })

Deno.test('toScalarType - Int → OasInteger int32', () => {
  const out = toScalarType(builtin('Int'), false)
  assertInstanceOf(out, OasInteger)
  assertEquals(out.format, 'int32')
  assertEquals(out.nullable, false)
})

Deno.test('toScalarType - Float → OasNumber float', () => {
  const out = toScalarType(builtin('Float'), false)
  assertInstanceOf(out, OasNumber)
  assertEquals(out.format, 'float')
})

Deno.test('toScalarType - String → OasString', () => {
  const out = toScalarType(builtin('String'), false)
  assertInstanceOf(out, OasString)
  assertEquals(out.format, undefined)
})

Deno.test('toScalarType - Boolean → OasBoolean', () => {
  const out = toScalarType(builtin('Boolean'), true)
  assertInstanceOf(out, OasBoolean)
  assertEquals(out.nullable, true)
})

Deno.test('toScalarType - ID → OasString format=id', () => {
  const out = toScalarType(builtin('ID'), false)
  assertInstanceOf(out, OasString)
  assertEquals(out.format, 'id')
})

Deno.test('toScalarType - custom scalar → OasString with scalar name as format', () => {
  const out = toScalarType(builtin('DateTime'), false)
  assertInstanceOf(out, OasString)
  assertEquals(out.format, 'DateTime')
})

Deno.test('toScalarType - nullability propagates', () => {
  const out = toScalarType(builtin('JSON'), true)
  assertEquals(out.nullable, true)
})
