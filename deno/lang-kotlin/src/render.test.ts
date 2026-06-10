import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtDefinition } from './KtDefinition.ts'
import { KtDataClass } from './KtDataClass.ts'
import { KtFile } from './KtFile.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('KtDefinition + KtDataClass render the User DTO as a data class', () => {
  const definition = new KtDefinition({
    context,
    identifier: new Identifier({ name: 'User', kind: 'data-class' }),
    value: new KtDataClass([
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

Deno.test('top-level val is a legal Kotlin declaration (distinctive: file-scope value)', () => {
  // C#/PHP/Java forbid a value at file scope; Kotlin allows it. The same
  // KtDefinition dispatches to the `Name = value` shell on `kind: 'val'`.
  const definition = new KtDefinition({
    context,
    identifier: new Identifier({ name: 'MAX_RETRIES', kind: 'val' }),
    value: '3'
  })

  assertEquals(definition.toString(), 'val MAX_RETRIES = 3')
})

Deno.test('exported renders nothing (public default) vs `private` (sixth behaviour)', () => {
  const exported = new KtDefinition({
    context,
    identifier: new Identifier({ name: 'User', exported: true, kind: 'data-class' }),
    value: new KtDataClass([{ name: 'id', type: 'String' }])
  })
  const private_ = new KtDefinition({
    context,
    identifier: new Identifier({ name: 'User', exported: false, kind: 'data-class' }),
    value: new KtDataClass([{ name: 'id', type: 'String' }])
  })

  assertEquals(exported.toString().startsWith('data class User('), true)
  assertEquals(private_.toString().startsWith('private data class User('), true)
})

Deno.test('KtFile renders the package header (no semicolon)', () => {
  const file = new KtFile({ path: 'models/User.kt', packageName: 'app.models' })
  file.definitions.set(
    'User',
    new KtDefinition({
      context,
      identifier: new Identifier({ name: 'User', kind: 'data-class' }),
      value: new KtDataClass([{ name: 'id', type: 'String' }])
    })
  )

  assertEquals(file.toString(), 'package app.models\n\ndata class User(\n    val id: String\n)')
})
