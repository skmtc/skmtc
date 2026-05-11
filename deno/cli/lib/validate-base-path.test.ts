import { assertEquals, assertThrows } from '@std/assert'
import { validateBasePath } from '@/lib/validate-base-path.ts'

Deno.test('validateBasePath - returns relative paths unchanged', () => {
  assertEquals(validateBasePath('./web/app/src'), './web/app/src')
  assertEquals(validateBasePath('web/app/src'), 'web/app/src')
  assertEquals(validateBasePath('.'), '.')
})

Deno.test('validateBasePath - rejects absolute POSIX paths with a recipe', () => {
  const err = assertThrows(
    () => validateBasePath('/Users/me/repo/web/app/src'),
    Error,
    'Invalid basePath'
  )
  // The recipe must point users at the relative-path fix.
  assertEquals(err.message.includes('relative to the SKMTC root'), true)
})
