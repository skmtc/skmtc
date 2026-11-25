import { assert } from '@std/assert'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'

Deno.test('DanglingRefError.is - true for one from another copy of core, where instanceof is false', () => {
  // What a generator bundle with its own copy of core throws: the same name, another class.
  const fromAnotherCopy = new Error('Ref "#/components/schemas/Missing" names nothing in the document')
  fromAnotherCopy.name = 'DanglingRefError'

  assert(!(fromAnotherCopy instanceof DanglingRefError))
  assert(DanglingRefError.is(fromAnotherCopy))
  assert(DanglingRefError.is(new DanglingRefError('#/components/schemas/Missing')))
})

Deno.test('DanglingRefError.is - false for any other error or value', () => {
  assert(!DanglingRefError.is(new Error('Ref type mismatch')))
  assert(!DanglingRefError.is({ name: 'DanglingRefError' }))
  assert(!DanglingRefError.is(undefined))
})
