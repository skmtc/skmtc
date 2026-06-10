import { assertEquals, assertThrows } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtDefinition } from './KtDefinition.ts'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'
import {
  createDataClass,
  createEnumClass,
  createSealedInterface,
  createTypeAlias,
  createValue
} from './createIdentifier.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('data-class shell renders the User DTO', () => {
  const definition = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new KtParameterList([
      { name: 'id', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'email', type: 'String', nullable: true }
    ])
  })

  assertEquals(
    definition.toString(),
    'data class User(\n' +
      '    val id: String,\n' +
      '    val name: String,\n' +
      '    val email: String?\n' +
      ')'
  )
})

Deno.test('enum-class shell renders entries in braces', () => {
  const definition = new KtDefinition({
    context,
    identifier: createEnumClass('Status'),
    value: '    ACTIVE,\n    INACTIVE'
  })

  assertEquals(definition.toString(), 'enum class Status {\n    ACTIVE,\n    INACTIVE\n}')
})

Deno.test('sealed-interface shell renders bodyless when the value is empty', () => {
  const bodyless = new KtDefinition({
    context,
    identifier: createSealedInterface('Animal'),
    value: ''
  })
  const withBody = new KtDefinition({
    context,
    identifier: createSealedInterface('Animal'),
    value: '    val kind: String'
  })

  assertEquals(bodyless.toString(), 'sealed interface Animal')
  assertEquals(withBody.toString(), 'sealed interface Animal {\n    val kind: String\n}')
})

Deno.test('typealias shell renders the assignment form', () => {
  const definition = new KtDefinition({
    context,
    identifier: createTypeAlias('UserList'),
    value: 'List<User>'
  })

  assertEquals(definition.toString(), 'typealias UserList = List<User>')
})

Deno.test('top-level val is a legal Kotlin declaration (distinctive: file-scope value)', () => {
  // C#/PHP/Java forbid a value at file scope; Kotlin allows it.
  const untyped = new KtDefinition({
    context,
    identifier: createValue('MAX_RETRIES'),
    value: '3'
  })
  const typed = new KtDefinition({
    context,
    identifier: createValue('timeout', { typeName: 'Long' }),
    value: '5000'
  })

  assertEquals(untyped.toString(), 'val MAX_RETRIES = 3')
  assertEquals(typed.toString(), 'val timeout: Long = 5000')
})

Deno.test('unknown kinds throw — no silent fallback shell', () => {
  // A foreign-language identifier (TypeScript's 'variable') reaching the
  // Kotlin renderer must fail loudly.
  const definition = new KtDefinition({
    context,
    identifier: new Identifier({ name: 'User', kind: 'variable' }),
    value: 'x'
  })

  assertThrows(() => definition.toString(), Error, 'Unknown Kotlin entity kind: variable')
})

Deno.test('exported renders nothing (public default) vs `private` to restrict', () => {
  const exported = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new KtParameterList([{ name: 'id', type: 'String' }])
  })
  const restricted = new KtDefinition({
    context,
    identifier: createDataClass('User', { exported: false }),
    value: new KtParameterList([{ name: 'id', type: 'String' }])
  })
  const noExport = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new KtParameterList([{ name: 'id', type: 'String' }]),
    noExport: true
  })

  assertEquals(exported.toString().startsWith('data class User('), true)
  assertEquals(restricted.toString().startsWith('private data class User('), true)
  assertEquals(noExport.toString().startsWith('private data class User('), true)
})

Deno.test('class-level annotations ride on the value via the KtAnnotated protocol', () => {
  class AnnotatedValue {
    annotations = [new KtAnnotation('Serializable')]

    toString(): string {
      return '    val id: String'
    }
  }

  const definition = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new AnnotatedValue()
  })

  assertEquals(definition.toString(), '@Serializable\ndata class User(\n    val id: String\n)')
})

Deno.test('description renders as a KDoc block above annotations and shell', () => {
  const definition = new KtDefinition({
    context,
    identifier: createTypeAlias('UserId'),
    value: 'String',
    description: 'Opaque user identifier'
  })

  assertEquals(definition.toString(), '/** Opaque user identifier */\ntypealias UserId = String')
})
