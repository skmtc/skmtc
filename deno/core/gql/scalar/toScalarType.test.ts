import { assertEquals, assertInstanceOf } from '@std/assert'
import { GraphQLScalarType } from 'graphql'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { OasBoolean } from '@/oas/boolean/Boolean.ts'
import { toScalarType } from '@/gql/scalar/toScalarType.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

const builtin = (name: string) => new GraphQLScalarType({ name, serialize: x => x })

// `toScalarType` accepts `context` and `stackTrail` for parser-shape
// symmetry; today the function is pure so a minimal stub satisfies
// the type check without affecting behavior.
const context = {} as unknown as ParseContextType
const stackTrail = new StackTrail([])

Deno.test('toScalarType - Int → OasInteger int32', () => {
  const out = toScalarType({ scalar: builtin('Int'), nullable: false, context, stackTrail })
  assertInstanceOf(out, OasInteger)
  assertEquals(out.format, 'int32')
  assertEquals(out.nullable, false)
})

Deno.test('toScalarType - Float → OasNumber float', () => {
  const out = toScalarType({ scalar: builtin('Float'), nullable: false, context, stackTrail })
  assertInstanceOf(out, OasNumber)
  assertEquals(out.format, 'float')
})

Deno.test('toScalarType - String → OasString', () => {
  const out = toScalarType({ scalar: builtin('String'), nullable: false, context, stackTrail })
  assertInstanceOf(out, OasString)
  assertEquals(out.format, undefined)
})

Deno.test('toScalarType - Boolean → OasBoolean', () => {
  const out = toScalarType({ scalar: builtin('Boolean'), nullable: true, context, stackTrail })
  assertInstanceOf(out, OasBoolean)
  assertEquals(out.nullable, true)
})

Deno.test('toScalarType - ID → OasString format=id', () => {
  const out = toScalarType({ scalar: builtin('ID'), nullable: false, context, stackTrail })
  assertInstanceOf(out, OasString)
  assertEquals(out.format, 'id')
})

Deno.test('toScalarType - custom scalar → OasString with scalar name as format', () => {
  const out = toScalarType({ scalar: builtin('DateTime'), nullable: false, context, stackTrail })
  assertInstanceOf(out, OasString)
  assertEquals(out.format, 'DateTime')
})

Deno.test('toScalarType - nullability propagates', () => {
  const out = toScalarType({ scalar: builtin('JSON'), nullable: true, context, stackTrail })
  assertEquals(out.nullable, true)
})
