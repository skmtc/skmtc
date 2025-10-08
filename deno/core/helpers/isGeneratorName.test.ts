import { assertEquals } from '@std/assert/equals'
import { isGeneratorName } from './isGeneratorName.ts'

Deno.test('isGeneratorName - returns true for generator package with gen- prefix', () => {
  assertEquals(isGeneratorName('gen-models'), true)
})

Deno.test('isGeneratorName - returns true for scoped generator package', () => {
  assertEquals(isGeneratorName('@skmtc/gen-api'), true)
})

Deno.test('isGeneratorName - returns false for non-generator package', () => {
  assertEquals(isGeneratorName('core'), false)
})

Deno.test('isGeneratorName - returns false for package without gen- prefix', () => {
  assertEquals(isGeneratorName('models'), false)
})

Deno.test('isGeneratorName - returns false for scoped non-generator package', () => {
  assertEquals(isGeneratorName('@skmtc/core'), false)
})

Deno.test('isGeneratorName - handles JSR module with gen- prefix', () => {
  assertEquals(isGeneratorName('jsr:@scope/gen-something'), true)
})

Deno.test('isGeneratorName - handles npm module with gen- prefix', () => {
  assertEquals(isGeneratorName('npm:@scope/gen-types'), true)
})

Deno.test('isGeneratorName - returns true for gen- at start of package name', () => {
  assertEquals(isGeneratorName('gen-client'), true)
})

Deno.test('isGeneratorName - returns false for gen- in middle of name', () => {
  assertEquals(isGeneratorName('my-gen-package'), false)
})
