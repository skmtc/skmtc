import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { TsDefinition } from './TsDefinition.ts'
import { TsFile } from './TsFile.ts'
import { TsImport } from './TsImport.ts'
import { TsObject } from './TsObject.ts'

// Construction only stores `context`; `toString()` never reads it, so a
// bare stub suffices. The cast is test-only (production code narrows).
const context = {} as unknown as GenerateContextType

Deno.test('TsDefinition renders an exported type alias', () => {
  const definition = new TsDefinition({
    context,
    identifier: Identifier.createType('User'),
    value: { toString: () => '{\n  id: string\n}' }
  })

  assertEquals(definition.toString(), 'export type User = {\n  id: string\n}')
})

Deno.test('TsDefinition renders an exported const', () => {
  const definition = new TsDefinition({
    context,
    identifier: Identifier.createVariable('apiUrl'),
    value: { toString: () => "'https://api.example.com'" }
  })

  assertEquals(definition.toString(), "export const apiUrl = 'https://api.example.com'")
})

Deno.test('TsDefinition + TsObject render the canonical User DTO', () => {
  const definition = new TsDefinition({
    context,
    identifier: Identifier.createType('User'),
    value: new TsObject([
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' }
    ])
  })

  assertEquals(
    definition.toString(),
    'export type User = {\n  id: string\n  name: string\n  email: string\n}'
  )
})

Deno.test('TsImport renders a value import', () => {
  assertEquals(new TsImport('zod', [{ name: 'z' }]).toString(), "import { z } from 'zod'")
})

Deno.test('TsImport renders an aliased import', () => {
  assertEquals(
    new TsImport('react', [{ name: 'Component', alias: 'ReactComponent' }]).toString(),
    "import { Component as ReactComponent } from 'react'"
  )
})

Deno.test('TsImport renders a statement-level type-only import', () => {
  assertEquals(
    new TsImport('./types.ts', [{ name: 'User', typeOnly: true }]).toString(),
    "import type { User } from './types.ts'"
  )
})

Deno.test('TsImport renders mixed value + per-name type imports', () => {
  assertEquals(
    new TsImport('./api.ts', [{ name: 'fetchUser' }, { name: 'User', typeOnly: true }]).toString(),
    "import { fetchUser, type User } from './api.ts'"
  )
})

Deno.test('TsFile renders empty when it holds no definitions', () => {
  const file = new TsFile({ path: 'models/User.ts' })

  assertEquals(file.toString(), '')
})
