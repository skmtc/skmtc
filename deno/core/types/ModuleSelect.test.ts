import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { lensInputModuleType, moduleSelect, moduleTypeOf } from './ModuleSelect.ts'

Deno.test('moduleSelect — parses the full { schemaPath, module } binding', () => {
  const parsed = v.parse(moduleSelect(lensInputModuleType), {
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
  const parsed = v.parse(moduleSelect(lensInputModuleType), {
    schemaPath: ['RequestBody', 'solicitorId']
  })
  assertEquals(parsed.schemaPath, ['RequestBody', 'solicitorId'])
  assertEquals(parsed.module, undefined)
})

Deno.test('moduleSelect — rejects a component without a path (nothing to type-check against)', () => {
  assertThrows(() =>
    v.parse(moduleSelect(lensInputModuleType), {
      module: { exportName: 'X', exportPath: '@/inputs/X.tsx' }
    })
  )
})

Deno.test('moduleSelect — rejects a partial module', () => {
  assertThrows(() =>
    v.parse(moduleSelect(lensInputModuleType), {
      schemaPath: ['RequestBody', 'name'],
      module: { exportName: 'X' }
    })
  )
})

Deno.test('moduleTypeOf — returns the declared module type for the created schema only', () => {
  const cellModuleType = `export type CellModule<F> = (props: { value: F }) => unknown`
  const withCellModuleType = moduleSelect(cellModuleType)
  const withLensModuleType = moduleSelect(lensInputModuleType)
  assertEquals(moduleTypeOf(withCellModuleType), cellModuleType)
  assertEquals(moduleTypeOf(withLensModuleType), lensInputModuleType)
  assertEquals(moduleTypeOf(v.object({})), undefined)
  assertEquals(moduleTypeOf('not a schema'), undefined)
})

Deno.test('lensInputModuleType — declares exactly one exported module type the matcher can parse', () => {
  const name = lensInputModuleType.match(/export type (\w+)\s*</)?.[1]
  assertEquals(name, 'InputModule')
})
