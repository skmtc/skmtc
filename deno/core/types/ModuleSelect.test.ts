import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { lensInputSlot, moduleSelect, moduleSelectConfigOf } from './ModuleSelect.ts'

Deno.test('moduleSelect — parses the full { schemaPath, module } binding', () => {
  const parsed = v.parse(moduleSelect({ slot: lensInputSlot }), {
    schemaPath: ['RequestBody', 'officeIds'],
    module: {
      exportName: 'OfficesMultiSelectField',
      exportPath: '@/inputs/OfficesMultiSelectField.generated.tsx'
    }
  })
  assertEquals(parsed.schemaPath, ['RequestBody', 'officeIds'])
  assertEquals(parsed.module?.exportName, 'OfficesMultiSelectField')
})

Deno.test('moduleSelect — parses a path-only binding (default rendering for the field)', () => {
  // Real enrichments carry path-without-component entries: label/order
  // overrides using the generator's default input, and schema-seeded fields.
  const parsed = v.parse(moduleSelect({ slot: lensInputSlot }), {
    schemaPath: ['RequestBody', 'solicitorId']
  })
  assertEquals(parsed.schemaPath, ['RequestBody', 'solicitorId'])
  assertEquals(parsed.module, undefined)
})

Deno.test('moduleSelect — rejects a component without a path (nothing to type-check against)', () => {
  assertThrows(() =>
    v.parse(moduleSelect({ slot: lensInputSlot }), {
      module: { exportName: 'X', exportPath: '@/inputs/X.tsx' }
    })
  )
})

Deno.test('moduleSelect — rejects a partial module', () => {
  assertThrows(() =>
    v.parse(moduleSelect({ slot: lensInputSlot }), {
      schemaPath: ['RequestBody', 'name'],
      module: { exportName: 'X' }
    })
  )
})

Deno.test('moduleSelectConfigOf — returns the declared config for the created schema only', () => {
  const cellSlot = `export type CellSlot<F> = (props: { value: F }) => unknown`
  const withCellSlot = moduleSelect({ slot: cellSlot })
  const withLensSlot = moduleSelect({ slot: lensInputSlot })
  assertEquals(moduleSelectConfigOf(withCellSlot), { slot: cellSlot })
  assertEquals(moduleSelectConfigOf(withLensSlot), { slot: lensInputSlot })
  assertEquals(moduleSelectConfigOf(v.object({})), undefined)
  assertEquals(moduleSelectConfigOf('not a schema'), undefined)
})

Deno.test('lensInputSlot — declares exactly one exported slot type the matcher can parse', () => {
  const name = lensInputSlot.match(/export type (\w+)\s*</)?.[1]
  assertEquals(name, 'InputSlot')
})
