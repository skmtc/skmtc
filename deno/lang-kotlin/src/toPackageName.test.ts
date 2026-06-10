import { assertEquals, assertThrows } from '@std/assert'
import { toPackageName } from './toPackageName.ts'

Deno.test('derives the package from the path after the @/ root', () => {
  assertEquals(toPackageName('@/com/example/api/User.generated.kt'), 'com.example.api')
})

Deno.test('handles ./ prefixed and bare paths', () => {
  assertEquals(toPackageName('./com/example/User.kt'), 'com.example')
  assertEquals(toPackageName('com/example/User.kt'), 'com.example')
})

Deno.test('a root-level file maps to the default package (empty string)', () => {
  assertEquals(toPackageName('@/User.kt'), '')
  assertEquals(toPackageName('User.kt'), '')
})

Deno.test('throws when a segment is not a valid package name part', () => {
  assertThrows(
    () => toPackageName('@/my-models/User.kt'),
    Error,
    "segment 'my-models' is not a valid package name part"
  )
})

Deno.test('throws when a segment is a hard keyword', () => {
  assertThrows(
    () => toPackageName('@/com/object/User.kt'),
    Error,
    "segment 'object' is not a valid package name part"
  )
})
