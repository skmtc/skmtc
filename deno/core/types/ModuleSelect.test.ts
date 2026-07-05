import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { moduleSelect, moduleSelectConfigOf } from './ModuleSelect.ts'

Deno.test('moduleSelect — parses the atomic { schemaPath, module } pair', () => {
  const parsed = v.parse(moduleSelect(), {
    schemaPath: ['RequestBody', 'officeIds'],
    module: {
      exportName: 'OfficesMultiSelectField',
      exportPath: '@/inputs/OfficesMultiSelectField.generated.tsx'
    }
  })
  assertEquals(parsed.schemaPath, ['RequestBody', 'officeIds'])
  assertEquals(parsed.module.exportName, 'OfficesMultiSelectField')
})

Deno.test('moduleSelect — rejects a module without a path (the pair is one unit)', () => {
  assertThrows(() =>
    v.parse(moduleSelect(), {
      module: { exportName: 'X', exportPath: '@/inputs/X.tsx' }
    })
  )
})

Deno.test('moduleSelect — rejects a partial module', () => {
  assertThrows(() =>
    v.parse(moduleSelect(), {
      schemaPath: ['RequestBody', 'name'],
      module: { exportName: 'X' }
    })
  )
})

Deno.test('moduleSelectConfigOf — returns the declared config for the created schema only', () => {
  const slot = `export type CellSlot<F> = (props: { value: F }) => unknown`
  const withSlot = moduleSelect({ slot })
  const bare = moduleSelect()
  assertEquals(moduleSelectConfigOf(withSlot), { slot })
  assertEquals(moduleSelectConfigOf(bare), {})
  assertEquals(moduleSelectConfigOf(v.object({})), undefined)
  assertEquals(moduleSelectConfigOf('not a schema'), undefined)
})
