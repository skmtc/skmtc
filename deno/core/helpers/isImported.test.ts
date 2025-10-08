import { assertEquals } from '@std/assert/equals'
import { isImported } from './isImported.ts'

Deno.test('isImported - returns false for same file paths', () => {
  assertEquals(isImported('./src/user.ts', './src/user.ts'), false)
})

Deno.test('isImported - returns true for different file paths', () => {
  assertEquals(isImported('./src/user.ts', './src/product.ts'), true)
})

Deno.test('isImported - normalizes paths with different formats', () => {
  assertEquals(isImported('./src/user.ts', 'src/user.ts'), false)
})

Deno.test('isImported - normalizes paths with dot segments', () => {
  assertEquals(isImported('src/./user.ts', 'src/user.ts'), false)
})

Deno.test('isImported - normalizes paths with parent references', () => {
  assertEquals(isImported('src/models/../user.ts', 'src/user.ts'), false)
})

Deno.test('isImported - handles different directories', () => {
  assertEquals(isImported('src/models/user.ts', 'src/api/user.ts'), true)
})

Deno.test('isImported - handles nested paths', () => {
  assertEquals(isImported('a/b/c/file.ts', 'a/b/c/file.ts'), false)
})

Deno.test('isImported - handles root level files', () => {
  assertEquals(isImported('user.ts', 'user.ts'), false)
})

Deno.test('isImported - differentiates files with same name', () => {
  assertEquals(isImported('models/user.ts', 'api/user.ts'), true)
})

Deno.test('isImported - handles absolute paths', () => {
  assertEquals(isImported('/absolute/path/file.ts', '/absolute/path/file.ts'), false)
})
