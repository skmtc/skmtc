import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { RsDefinition } from './RsDefinition.ts'
import { RsStruct } from './RsStruct.ts'
import { RsEnum } from './RsEnum.ts'
import { RsFile } from './RsFile.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('RsDefinition + RsStruct render the User DTO as a pub struct', () => {
  const definition = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'User', kind: 'struct' }),
    value: new RsStruct([
      { name: 'id', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'email', type: 'String' }
    ])
  })

  assertEquals(
    definition.toString(),
    'pub struct User {\n' +
      '\tpub id: String,\n' +
      '\tpub name: String,\n' +
      '\tpub email: String,\n' +
      '}'
  )
})

Deno.test('RsStruct omits `pub` for unexported fields', () => {
  const struct = new RsStruct([
    { name: 'id', type: 'String' },
    { name: 'secret', type: 'String', exported: false }
  ])

  assertEquals(struct.toString(), '{\n\tpub id: String,\n\tsecret: String,\n}')
})

Deno.test('RsDefinition + RsEnum render a oneOf as a native tagged enum', () => {
  // Rust's distinctive constraint: a oneOf becomes a first-class tagged
  // enum, where TypeScript would emit a union and Go has no sum type.
  const definition = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'Pet', kind: 'enum' }),
    value: new RsEnum([
      { name: 'Cat', payload: 'Cat' },
      { name: 'Dog', payload: 'Dog' }
    ])
  })

  assertEquals(definition.toString(), 'pub enum Pet {\n\tCat(Cat),\n\tDog(Dog),\n}')
})

Deno.test('declaration keyword follows the opaque Identifier.kind', () => {
  // All three are type-level entities — only the opaque `kind` differs.
  // This was the forcing proof for `kind`: the old binary entityType
  // (deleted under F6) could not tell struct from enum from alias.
  const asStruct = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'Thing', kind: 'struct' }),
    value: new RsStruct([{ name: 'id', type: 'String' }])
  })
  const asEnum = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'Thing', kind: 'enum' }),
    value: new RsEnum([{ name: 'A' }])
  })
  const asAlias = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'Thing', kind: 'type' }),
    value: 'String'
  })

  assertEquals(asStruct.toString().startsWith('pub struct Thing '), true)
  assertEquals(asEnum.toString().startsWith('pub enum Thing '), true)
  assertEquals(asAlias.toString(), 'pub type Thing = String;')

})

Deno.test('exported renders as the `pub` keyword, name untouched (contrast Go casing)', () => {
  // Exported intent + lowercase input → `pub`, name kept verbatim
  // (Go would capitalize it; Rust does not).
  const exported = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'user', exported: true, kind: 'struct' }),
    value: new RsStruct([{ name: 'id', type: 'String' }])
  })
  assertEquals(exported.toString().startsWith('pub struct user '), true)

  // Unexported intent → no `pub`, name kept verbatim.
  const private_ = new RsDefinition({
    context,
    identifier: new Identifier({ name: 'Secret', exported: false, kind: 'struct' }),
    value: new RsStruct([{ name: 'id', type: 'String' }])
  })
  assertEquals(private_.toString().startsWith('struct Secret '), true)
})

Deno.test('RsFile needs no header — empty file renders empty (contrast Go package directive)', () => {
  const file = new RsFile({ path: 'models/user.rs' })

  assertEquals(file.toString(), '')
})

Deno.test('RsFile assembles use imports + definitions', () => {
  const file = new RsFile({ path: 'models/user.rs' })
  file.addUse('serde::Serialize')
  file.definitions.set(
    'User',
    new RsDefinition({
      context,
      identifier: new Identifier({ name: 'User', kind: 'struct' }),
      value: new RsStruct([{ name: 'id', type: 'String' }])
    })
  )

  assertEquals(
    file.toString(),
    'use serde::Serialize;\n\npub struct User {\n\tpub id: String,\n}'
  )
})
