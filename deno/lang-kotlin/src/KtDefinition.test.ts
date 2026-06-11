import { assertEquals, assertThrows } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtDefinition } from './KtDefinition.ts'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'
import { isKtSupertyped } from './KtSupertyped.ts'
import {
  createDataClass,
  createEnumClass,
  createInterface,
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

Deno.test('interface shell renders a body in braces, bodyless when the value is empty', () => {
  const bodyless = new KtDefinition({
    context,
    identifier: createInterface('Marker'),
    value: ''
  })
  const withBody = new KtDefinition({
    context,
    identifier: createInterface('UsersApi'),
    value: '    fun getUsersId(id: String): User'
  })

  assertEquals(bodyless.toString(), 'interface Marker')
  assertEquals(withBody.toString(), 'interface UsersApi {\n    fun getUsersId(id: String): User\n}')
})

Deno.test('interface shell renders class-level annotations and private visibility', () => {
  const definition = new KtDefinition({
    context,
    identifier: createInterface('UsersApi', { exported: false }),
    value: {
      annotations: [new KtAnnotation('Suppress', ['"unused"'])],
      toString: () => '    fun getUsersId(id: String): User'
    }
  })

  assertEquals(
    definition.toString(),
    '@Suppress("unused")\nprivate interface UsersApi {\n    fun getUsersId(id: String): User\n}'
  )
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

Deno.test('a supertype clause rides on the value via the KtSupertyped protocol', () => {
  class MemberValue {
    supertypes = ['Animal']

    toString(): string {
      return '    val name: String'
    }
  }

  class MultiMemberValue {
    supertypes = ['Animal', { toString: () => 'Pet' }]

    toString(): string {
      return '    val name: String'
    }
  }

  const single = new KtDefinition({
    context,
    identifier: createDataClass('Dog'),
    value: new MemberValue()
  })
  const multiple = new KtDefinition({
    context,
    identifier: createDataClass('Dog'),
    value: new MultiMemberValue()
  })

  assertEquals(single.toString(), 'data class Dog(\n    val name: String\n) : Animal')
  assertEquals(multiple.toString(), 'data class Dog(\n    val name: String\n) : Animal, Pet')
})

Deno.test('annotations and supertypes compose on one value', () => {
  class SealedMemberValue {
    annotations = [new KtAnnotation('Serializable'), new KtAnnotation('SerialName', ['"dog"'])]
    supertypes = ['Animal']

    toString(): string {
      return '    val name: String'
    }
  }

  const definition = new KtDefinition({
    context,
    identifier: createDataClass('Dog'),
    value: new SealedMemberValue()
  })

  assertEquals(
    definition.toString(),
    '@Serializable\n@SerialName("dog")\ndata class Dog(\n    val name: String\n) : Animal'
  )
})

Deno.test('empty or absent supertypes render no clause (byte-identical to pre-protocol output)', () => {
  class EmptySupertypesValue {
    supertypes: string[] = []

    toString(): string {
      return '    val id: String'
    }
  }

  const empty = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new EmptySupertypesValue()
  })
  const absent = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new KtParameterList([{ name: 'id', type: 'String' }])
  })

  assertEquals(empty.toString(), 'data class User(\n    val id: String\n)')
  assertEquals(absent.toString(), 'data class User(\n    val id: String\n)')
})

Deno.test('non-data-class kinds ignore the KtSupertyped protocol in v1', () => {
  class SupertypedAlias {
    supertypes = ['Animal']

    toString(): string {
      return 'JsonElement'
    }
  }

  const definition = new KtDefinition({
    context,
    identifier: createTypeAlias('Payload'),
    value: new SupertypedAlias()
  })

  assertEquals(definition.toString(), 'typealias Payload = JsonElement')
})

Deno.test('isKtSupertyped narrows the protocol without casts', () => {
  assertEquals(isKtSupertyped({ supertypes: ['Animal'] }), true)
  assertEquals(isKtSupertyped({ supertypes: [{ toString: () => 'Pet' }] }), true)
  assertEquals(isKtSupertyped({ supertypes: [] }), true)
  assertEquals(isKtSupertyped({ supertypes: 'Animal' }), false)
  assertEquals(isKtSupertyped({ supertypes: [null] }), false)
  assertEquals(isKtSupertyped({}), false)
  assertEquals(isKtSupertyped(null), false)
  assertEquals(isKtSupertyped('Animal'), false)
})
