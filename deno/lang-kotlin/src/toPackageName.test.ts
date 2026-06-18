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

Deno.test('multi-package mode strips the owning rootPath before deriving', () => {
  const packages = [
    { rootPath: 'my-sdk-core/src/main/kotlin' },
    { rootPath: 'my-sdk-client-okhttp/src/main/kotlin' }
  ]

  assertEquals(
    toPackageName('my-sdk-core/src/main/kotlin/com/example/core/ClientOptions.kt', packages),
    'com.example.core'
  )
  assertEquals(
    toPackageName(
      'my-sdk-client-okhttp/src/main/kotlin/com/example/client/okhttp/OkHttpClient.kt',
      packages
    ),
    'com.example.client.okhttp'
  )
})

Deno.test('multi-package mode picks the LONGEST matching rootPath', () => {
  const packages = [{ rootPath: 'sdk' }, { rootPath: 'sdk/core/src/main/kotlin' }]

  assertEquals(toPackageName('sdk/core/src/main/kotlin/com/example/User.kt', packages), 'com.example')
})

Deno.test('multi-package mode leaves non-matching and @/ paths on single-package behavior', () => {
  const packages = [{ rootPath: 'my-sdk-core/src/main/kotlin' }]

  assertEquals(toPackageName('@/com/example/User.kt', packages), 'com.example')
  assertThrows(
    () => toPackageName('other-module/src/com/example/User.kt', packages),
    Error,
    "segment 'other-module' is not a valid package name part"
  )
})

Deno.test('rootPath ./ prefixes and trailing slashes are tolerated', () => {
  const packages = [{ rootPath: './my-sdk-core/src/main/kotlin/' }]

  assertEquals(
    toPackageName('my-sdk-core/src/main/kotlin/com/example/User.kt', packages),
    'com.example'
  )
})
