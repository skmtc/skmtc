import { assertEquals } from '@std/assert'
import { GoIdentifier } from './GoIdentifier.ts'
import type { GenerateContextType } from '@skmtc/core/generate'
import { GoDefinition } from './GoDefinition.ts'
import { GoStruct } from './GoStruct.ts'
import { GoFile } from './GoFile.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('GoDefinition + GoStruct render the User DTO as a struct', () => {
  const definition = new GoDefinition({
    context,
    identifier: new GoIdentifier({ name: 'User', type: 'type' }),
    value: new GoStruct([
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' }
    ])
  })

  assertEquals(
    definition.toString(),
    'type User struct {\n' +
      '\tId string `json:"id"`\n' +
      '\tName string `json:"name"`\n' +
      '\tEmail string `json:"email"`\n' +
      '}'
  )
})

Deno.test('GoStruct lowercases unexported fields (visibility via casing)', () => {
  const struct = new GoStruct([
    { name: 'id', type: 'string' },
    { name: 'secret', type: 'string', exported: false }
  ])

  assertEquals(
    struct.toString(),
    'struct {\n' + '\tId string `json:"id"`\n' + '\tsecret string `json:"secret"`\n' + '}'
  )
})

Deno.test('GoDefinition casing follows Identifier.exported, not input name casing', () => {
  // Exported intent + lowercase input → Go capitalizes it.
  const exported = new GoDefinition({
    context,
    identifier: new GoIdentifier({ name: 'user', exported: true, type: 'type' }),
    value: new GoStruct([{ name: 'id', type: 'string' }])
  })
  assertEquals(exported.toString().startsWith('type User struct {'), true)

  // Unexported intent + capitalized input → Go lowercases it.
  const unexported = new GoDefinition({
    context,
    identifier: new GoIdentifier({ name: 'Secret', exported: false, type: 'type' }),
    value: new GoStruct([{ name: 'id', type: 'string' }])
  })
  assertEquals(unexported.toString().startsWith('type secret struct {'), true)
})

Deno.test('GoFile renders the package directive', () => {
  const file = new GoFile({ path: 'models/user.go', packageName: 'models' })

  assertEquals(file.toString(), 'package models')
})
