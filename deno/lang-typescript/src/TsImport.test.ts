import { assertEquals } from '@std/assert'
import { Identifier, Import } from '@skmtc/core'
import type { ImportNameArg } from '@skmtc/core'
import { TsImport } from './TsImport.ts'

/**
 * `TsImport` must render byte-identically to the engine's legacy `Import`
 * for every shape a generator emits — it's the same output, just owned by
 * the language package now. When core's `Import` is eventually deleted,
 * this test is what proves the move was lossless.
 */
const cases: { name: string; module: string; names: ImportNameArg[] }[] = [
  { name: 'plain value imports', module: 'zod', names: ['z'] },
  { name: 'multiple value imports', module: './utils', names: ['formatDate', 'parseJson'] },
  { name: 'alias record', module: 'lodash', names: [{ isEqual: 'deepEqual' }, 'cloneDeep'] },
  { name: 'explicit type import (statement-level)', module: 'react', names: [{ name: 'FC', type: 'type' }] },
  {
    name: 'mixed type and value (per-name type)',
    module: '@/models',
    names: [{ name: 'User', type: 'type' }, 'createUser']
  },
  { name: 'type alias', module: '@/models', names: [{ name: 'User', alias: 'IUser', type: 'type' }] },
  { name: 'namespace import', module: 'react', names: [{ '*': 'React' }] }
]

for (const testCase of cases) {
  Deno.test(`TsImport byte-identical to Import — ${testCase.name}`, () => {
    const legacy = new Import({ module: testCase.module, importNames: testCase.names }).toString()
    const tsImport = TsImport.fromConcise(testCase.module, testCase.names).toString()

    assertEquals(tsImport, legacy)
  })
}

Deno.test('TsImport.fromIdentifier byte-identical to Import of identifier.toImport()', () => {
  const variableIdentifier = Identifier.createVariable('useThing')
  const typeIdentifier = Identifier.createType('Thing')

  assertEquals(
    TsImport.fromIdentifier('@/hooks', variableIdentifier).toString(),
    new Import({ module: '@/hooks', importNames: [variableIdentifier.toImport()] }).toString()
  )
  assertEquals(
    TsImport.fromIdentifier('@/types', typeIdentifier).toString(),
    new Import({ module: '@/types', importNames: [typeIdentifier.toImport()] }).toString()
  )
})

Deno.test('TsImport merge unions specifiers, dedup on encoded form', () => {
  const first = TsImport.fromConcise('@/models', ['User'])
  const second = TsImport.fromConcise('@/models', [{ name: 'Order' }, 'User'])

  const merged = first.merge(second)

  // Same module merges to one statement; the duplicate `User` collapses.
  // (List.toObject emits `{a, b}` with no inner padding — matching the engine.)
  assertEquals(merged.toString(), `import {User, Order} from '@/models'`)
})
