import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { TsDefinition } from './TsDefinition.ts'
import { TsFile } from './TsFile.ts'

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

Deno.test('TsFile renders empty when it holds no definitions', () => {
  const file = new TsFile({ path: 'models/User.ts' })

  assertEquals(file.toString(), '')
})
