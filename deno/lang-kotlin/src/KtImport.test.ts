import { assertEquals, assertThrows } from '@std/assert'
import { Identifier } from '@skmtc/core'
import { KtImport } from './KtImport.ts'

Deno.test('fromConcise renders one statement per symbol (no brace grouping)', () => {
  const ktImport = KtImport.fromConcise('kotlinx.serialization', ['Serializable', 'SerialName'])

  assertEquals(
    ktImport.toString(),
    'import kotlinx.serialization.Serializable\nimport kotlinx.serialization.SerialName'
  )
})

Deno.test('aliases render via `as`', () => {
  const ktImport = KtImport.fromConcise('com.example.models', [
    { name: 'User', alias: 'UserModel' }
  ])

  assertEquals(ktImport.toString(), 'import com.example.models.User as UserModel')
})

Deno.test('fromIdentifier builds the Driver cross-file import; kind is ignored', () => {
  const ktImport = KtImport.fromIdentifier(
    '@/com/example/api/User.generated.kt',
    new Identifier({ name: 'User', kind: 'data-class' })
  )

  assertEquals(ktImport.toString(), 'import com.example.api.User')
})

Deno.test('resolvedPackage passes dotted packages through and derives from paths', () => {
  assertEquals(KtImport.fromConcise('kotlinx.serialization', ['X']).resolvedPackage(), 'kotlinx.serialization')
  assertEquals(
    KtImport.fromConcise('@/com/example/api/User.generated.kt', ['User']).resolvedPackage(),
    'com.example.api'
  )
})

Deno.test('merge dedups specifiers on name + alias', () => {
  const first = KtImport.fromConcise('kotlinx.serialization', ['Serializable', 'SerialName'])
  const second = KtImport.fromConcise('kotlinx.serialization', [
    'Serializable',
    { name: 'SerialName', alias: 'Rename' }
  ])

  const merged = first.merge(second)

  assertEquals(
    merged.toString(),
    'import kotlinx.serialization.Serializable\n' +
      'import kotlinx.serialization.SerialName\n' +
      'import kotlinx.serialization.SerialName as Rename'
  )
})

Deno.test('importing from the default package throws (Kotlin cannot)', () => {
  const ktImport = KtImport.fromConcise('@/User.generated.kt', ['User'])

  assertThrows(() => ktImport.toString(), Error, 'default package')
})
