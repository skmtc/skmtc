import { assertEquals, assertThrows } from '@std/assert'
import { IdentifierBase } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtDefinition } from './KtDefinition.ts'
import { kotlin } from './KtLang.ts'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation, toKtAnnotations } from './KtAnnotation.ts'
import { KtPrimaryConstructor } from './KtPrimaryConstructor.ts'
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

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('data-class renders the User DTO (KtParameterList owns its parens)', () => {
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

Deno.test('enum-class renders its entries in a braced body', () => {
  const definition = new KtDefinition({
    context,
    identifier: createEnumClass('Status'),
    value: ' {\n    ACTIVE,\n    INACTIVE\n}'
  })

  assertEquals(definition.toString(), 'enum class Status {\n    ACTIVE,\n    INACTIVE\n}')
})

Deno.test('class value composes primary constructor, body, and annotations', () => {
  const value = {
    annotations: [new KtAnnotation({ context, name: 'RestController' })],
    toString: () =>
      `${new KtPrimaryConstructor({
        parameters: new KtParameterList([
          { name: 'service', type: 'UsersService', visibility: 'private' }
        ])
      })} {\n    fun getUsersId(id: String): User = service.getUsersId(id)\n}`
  }

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

Deno.test('class value renders bare or body-only — the value decides its own form', () => {
  const bare = new KtDefinition({ context, identifier: createClass('Marker'), value: '' })
  const bodyOnly = new KtDefinition({
    context,
    identifier: createClass('Holder'),
    value: ' {\n    val x: Int = 1\n}'
  })

  assertEquals(bare.toString(), 'class Marker')
  assertEquals(bodyOnly.toString(), 'class Holder {\n    val x: Int = 1\n}')
})

Deno.test('interface renders a braced body, bodyless when the value renders nothing', () => {
  const bodyless = new KtDefinition({
    context,
    identifier: createInterface('Marker'),
    value: ''
  })
  const withBody = new KtDefinition({
    context,
    identifier: createInterface('UsersApi'),
    value: ' {\n    fun getUsersId(id: String): User\n}'
  })

  assertEquals(bodyless.toString(), 'interface Marker')
  assertEquals(withBody.toString(), 'interface UsersApi {\n    fun getUsersId(id: String): User\n}')
})

Deno.test('interface renders class-level annotations and private visibility', () => {
  const definition = new KtDefinition({
    context,
    identifier: createInterface('UsersApi', { exported: false }),
    value: {
      annotations: [new KtAnnotation({ context, name: 'Suppress', args: ['"unused"'] })],
      toString: () => ' {\n    fun getUsersId(id: String): User\n}'
    }
  })

  assertEquals(
    definition.toString(),
    '@Suppress("unused")\nprivate interface UsersApi {\n    fun getUsersId(id: String): User\n}'
  )
})

Deno.test('sealed-interface renders bodyless when the value renders nothing (the oneOf parent)', () => {
  const bodyless = new KtDefinition({
    context,
    identifier: createSealedInterface('Animal'),
    value: ''
  })
  const withBody = new KtDefinition({
    context,
    identifier: createSealedInterface('Animal'),
    value: ' {\n    val type: String\n}'
  })

  assertEquals(bodyless.toString(), 'sealed interface Animal')
  assertEquals(withBody.toString(), 'sealed interface Animal {\n    val type: String\n}')
})

Deno.test('typealias renders the assignment form', () => {
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

  assertEquals(exported.toString().startsWith('data class User('), true)
  assertEquals(restricted.toString().startsWith('private data class User('), true)
})

Deno.test('the Lang boundary folds the neutral noExport into a restricted identifier', () => {
  // Drivers pass `noExport` on the neutral toDefinition call; Kotlin has
  // no definition-level visibility — the flag becomes `exported: false`
  // on a copy of the identifier, and the head renders `private `.
  const definition = kotlin.toDefinition({
    context,
    identifier: createDataClass('User'),
    value: new KtParameterList([{ name: 'id', type: 'String' }]),
    noExport: true
  })

  assertEquals(definition.toString().startsWith('private data class User('), true)
})

Deno.test('toKtAnnotations collects the protocol field; empty renders the empty string', () => {
  const annotated = { annotations: [new KtAnnotation({ context, name: 'Serializable' })], toString: () => 'x' }

  assertEquals(`${toKtAnnotations(annotated)}`, '@Serializable\n')
  assertEquals(`${toKtAnnotations('plain string value')}`, '')
  assertEquals(`${toKtAnnotations({ annotations: [] })}`, '')
  // A stray `annotations` field that is not KtAnnotation[] is not the protocol.
  assertEquals(`${toKtAnnotations({ annotations: ['@Fake'] })}`, '')
})

Deno.test('class-level annotations ride on the value via the KtAnnotated protocol', () => {
  class AnnotatedValue {
    annotations = [new KtAnnotation({ context, name: 'Serializable' })]

    toString(): string {
      return `${new KtParameterList([{ name: 'id', type: 'String' }])}`
    }
  }

  const definition = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new AnnotatedValue()
  })

  assertEquals(definition.toString(), '@Serializable\ndata class User(\n    val id: String\n)')
})

Deno.test('description renders as a KDoc block above annotations and declaration', () => {
  const definition = new KtDefinition({
    context,
    identifier: createTypeAlias('UserId'),
    value: 'String',
    description: 'Opaque user identifier'
  })

  assertEquals(definition.toString(), '/** Opaque user identifier */\ntypealias UserId = String')
})

Deno.test('the value composes an inline supertype clause after its parameter list', () => {
  class MemberValue {
    toString(): string {
      return `${new KtParameterList([{ name: 'name', type: 'String' }])} : Animal`
    }
  }

  const definition = new KtDefinition({
    context,
    identifier: createDataClass('Dog'),
    value: new MemberValue()
  })

  assertEquals(definition.toString(), 'data class Dog(\n    val name: String\n) : Animal')
})

Deno.test('annotations and a supertype clause compose on one value', () => {
  class SealedMemberValue {
    annotations = [new KtAnnotation({ context, name: 'Serializable' }), new KtAnnotation({ context, name: 'SerialName', args: ['"dog"'] })]

    toString(): string {
      return `${new KtParameterList([{ name: 'name', type: 'String' }])} : Animal`
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

Deno.test('a dynamic membership scan renders its clause inline — empty means no clause', () => {
  // A value whose supertypes are computed (union-membership scan) writes
  // the clause inline — one conditional, no dedicated class.
  class ScannedValue {
    supertypes: string[]

    constructor(supertypes: string[]) {
      this.supertypes = supertypes
    }

    toString(): string {
      const clause = this.supertypes.length ? ` : ${this.supertypes.join(', ')}` : ''

      return `${new KtParameterList([{ name: 'id', type: 'String' }])}${clause}`
    }
  }

  const member = new KtDefinition({
    context,
    identifier: createDataClass('Dog'),
    value: new ScannedValue(['Animal', 'Pet'])
  })
  const standalone = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: new ScannedValue([])
  })

  assertEquals(member.toString(), 'data class Dog(\n    val id: String\n) : Animal, Pet')
  assertEquals(standalone.toString(), 'data class User(\n    val id: String\n)')
})

Deno.test('KtDocumented value supplies the KDoc; constructor description wins', () => {
  const parameters = () => `${new KtParameterList([{ name: 'id', type: 'String' }])}`

  const fromValue = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    value: { description: 'A user.', toString: parameters }
  })
  const fromConstructor = new KtDefinition({
    context,
    identifier: createDataClass('User'),
    description: 'Explicit.',
    value: { description: 'A user.', toString: parameters }
  })

  assertEquals(fromValue.toString(), '/** A user. */\ndata class User(\n    val id: String\n)')
  assertEquals(
    fromConstructor.toString(),
    '/** Explicit. */\ndata class User(\n    val id: String\n)'
  )
})

Deno.test('verbatim type renders the value as-is — no head, visibility, or annotations', () => {
  const body =
    'internal fun add(a: Int, b: Int): Int = a + b\n\ninternal fun sub(a: Int, b: Int): Int = a - b'

  // Through the Lang boundary so the neutral noExport flag is exercised:
  // the fold restricts the identifier, but verbatim renders no head, so
  // there is nothing to restrict — the value passes through untouched.
  const definition = kotlin.toDefinition({
    context,
    identifier: createVerbatim('MathUtilsBody'),
    value: body,
    noExport: true
  })

  assertEquals(definition.toString(), body)
})

Deno.test('KtPrimaryConstructor renders modifiers with the explicit constructor keyword', () => {
  const definition = new KtDefinition({
    context,
    identifier: createClass('User'),
    value: new KtPrimaryConstructor({
      modifiers: '@JsonCreator(mode = JsonCreator.Mode.DISABLED) private',
      parameters: new KtParameterList([
        { name: 'id', type: 'JsonField<String>', visibility: 'private' }
      ])
    })
  })

  assertEquals(
    definition.toString(),
    'class User @JsonCreator(mode = JsonCreator.Mode.DISABLED) private constructor(\n' +
      '    private val id: JsonField<String>\n' +
      ')'
  )
})

Deno.test('KtPrimaryConstructor without modifiers is the bare parameter list', () => {
  const value = {
    toString: () =>
      `${new KtPrimaryConstructor({
        parameters: new KtParameterList([
          { name: 'service', type: 'UsersService', visibility: 'private' }
        ])
      })} {\n    fun list(): List<User> = service.list()\n}`
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

Deno.test('a class value composes constructor, supertype clause, and body', () => {
  const value = {
    toString: () =>
      `${new KtPrimaryConstructor({
        modifiers: 'private',
        parameters: new KtParameterList([
          { name: 'stopId', type: 'String', nullable: true, visibility: 'private' }
        ])
      })} : Params {\n    fun stopId(): String? = stopId\n}`
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
