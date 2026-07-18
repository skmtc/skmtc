import { assertEquals, assertThrows } from '@std/assert'
import { IdentifierBase } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtDefinition } from './KtDefinition.ts'
import { kotlin } from './KtLang.ts'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'
import { isKtSupertyped } from './KtSupertyped.ts'
import {
  createClass,
  createDataClass,
  createEnumClass,
  createInterface,
  createSealedInterface,
  createTypeAlias,
  createValue,
  createVerbatim
} from './createIdentifier.ts'
import { isKtConstructed } from './KtConstructed.ts'

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

Deno.test('class shell renders the KtConstructed clause, body, and annotations', () => {
  const value = {
    annotations: [new KtAnnotation('RestController')],
    constructorParameters: new KtParameterList([
      { name: 'service', type: 'UsersService', visibility: 'private' }
    ]),
    toString: () => '    fun getUsersId(id: String): User = service.getUsersId(id)'
  }

  // the guard narrows without casts
  assertEquals(isKtConstructed(value), true)
  assertEquals(isKtConstructed({ toString: () => 'x' }), false)

  const definition = new KtDefinition({
    context,
    identifier: createClass('UsersController'),
    value
  })

  assertEquals(
    definition.toString(),
    '@RestController\n' +
      'class UsersController(\n' +
      '    private val service: UsersService\n' +
      ') {\n' +
      '    fun getUsersId(id: String): User = service.getUsersId(id)\n' +
      '}'
  )
})

Deno.test('class shell collapses without the protocol and without a body', () => {
  const bare = new KtDefinition({ context, identifier: createClass('Marker'), value: '' })
  const bodyOnly = new KtDefinition({
    context,
    identifier: createClass('Holder'),
    value: '    val x: Int = 1'
  })

  assertEquals(bare.toString(), 'class Marker')
  assertEquals(bodyOnly.toString(), 'class Holder {\n    val x: Int = 1\n}')
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
    value: '    val type: String'
  })

  assertEquals(bodyless.toString(), 'sealed interface Animal')
  assertEquals(withBody.toString(), 'sealed interface Animal {\n    val type: String\n}')
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

Deno.test('a foreign identifier throws at the Lang boundary — no silent fallback shell', () => {
  // A neutral IdentifierBase built for another language — the engine holds
  // identifiers as IdentifierBase, and `kotlin.toDefinition` narrows to
  // KtIdentifier (cast-free, via isKtIdentifier) BEFORE construction, so
  // the misconfiguration fails at Generate with the causing generator on
  // the stack, not at Render.
  assertThrows(
    () =>
      kotlin.toDefinition({
        context,
        identifier: new IdentifierBase({ name: 'User' }),
        value: 'x'
      }),
    Error,
    "KtDefinition needs a KtIdentifier to render 'User', got a foreign identifier"
  )
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

Deno.test('kinds without a supertype clause (typealias) ignore the KtSupertyped protocol', () => {
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

Deno.test('KtDocumented value supplies the KDoc; constructor description wins', () => {
  const fromValue = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: { description: 'A user.', toString: () => '    val id: String' }
  })
  const fromConstructor = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    description: 'Explicit.',
    value: { description: 'A user.', toString: () => '    val id: String' }
  })

  assertEquals(fromValue.toString(), '/** A user. */\ndata class User(\n    val id: String\n)')
  assertEquals(
    fromConstructor.toString(),
    '/** Explicit. */\ndata class User(\n    val id: String\n)'
  )
})

Deno.test('verbatim type renders the value as-is — no shell, visibility, or annotations', () => {
  const body =
    'internal fun add(a: Int, b: Int): Int = a + b\n\ninternal fun sub(a: Int, b: Int): Int = a - b'

  const definition = new KtDefinition({
    context,
    identifier: createVerbatim('MathUtilsBody'),
    value: body,
    // Ignored on verbatim — there is nothing to restrict
    noExport: true
  })

  assertEquals(definition.toString(), body)
})

Deno.test('class shell renders constructor modifiers with the explicit constructor keyword', () => {
  const value = {
    constructorModifiers: '@JsonCreator(mode = JsonCreator.Mode.DISABLED) private',
    constructorParameters: '    private val id: JsonField<String>',
    toString: (): string => ''
  }

  const definition = new KtDefinition({
    context,
    identifier: createClass('User'),
    value
  })

  assertEquals(
    definition.toString(),
    'class User @JsonCreator(mode = JsonCreator.Mode.DISABLED) private constructor(\n' +
      '    private val id: JsonField<String>\n' +
      ')'
  )
})

Deno.test('class shell without constructor modifiers keeps the bare parameter list', () => {
  const value = {
    constructorParameters: '    private val service: UsersService',
    toString: (): string => '    fun list(): List<User> = service.list()'
  }

  const definition = new KtDefinition({
    context,
    identifier: createClass('UsersController'),
    value
  })

  assertEquals(
    definition.toString(),
    'class UsersController(\n' +
      '    private val service: UsersService\n' +
      ') {\n' +
      '    fun list(): List<User> = service.list()\n' +
      '}'
  )
})

Deno.test('class shell renders a supertype clause via the KtSupertyped protocol', () => {
  const value = {
    constructorModifiers: 'private',
    constructorParameters: '    private val stopId: String?',
    supertypes: ['Params'],
    toString: (): string => '    fun stopId(): String? = stopId'
  }

  const definition = new KtDefinition({
    context,
    identifier: createClass('StopRetrieveParams'),
    value
  })

  assertEquals(
    definition.toString(),
    'class StopRetrieveParams private constructor(\n' +
      '    private val stopId: String?\n' +
      ') : Params {\n' +
      '    fun stopId(): String? = stopId\n' +
      '}'
  )
})
