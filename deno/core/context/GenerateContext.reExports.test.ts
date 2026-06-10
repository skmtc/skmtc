/**
 * The barrel pattern through the converged register seam (F3): a
 * generator registers re-exports via the lang package's register
 * function; the neutral `ReExportBase` objects merge on `CodeFileBase`
 * (keyed by source module), and the language's file renders the section.
 *
 * Restores the coverage dropped when re-exports were removed from the
 * neutral register path during the lang migration (the F3 mistake) —
 * now against the step-5 shape: concise form converts in the lang
 * package, `context.register` speaks `ReExportBase[]` pure data.
 */
import { register, TsFile } from '@skmtc/lang-typescript'
import { toGenerateContext } from '../test/toGenerateContext.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { assertEquals } from '@std/assert/equals'
import { assertInstanceOf } from '@std/assert/instance-of'

Deno.test('barrel pattern - re-exports register and merge through the lang register function', () => {
  const context = toGenerateContext()
  const barrelPath = '@/models/index.generated.ts'

  // First registering generator contributes a value re-export.
  register(context, {
    reExports: { '@/models/User.generated.ts': [Identifier.createVariable('User')] },
    destinationPath: barrelPath
  })

  // A later call adds a type re-export for the SAME source module (merges
  // into the existing entry) and a new module (appends).
  register(context, {
    reExports: {
      '@/models/User.generated.ts': [Identifier.createType('UserDto')],
      '@/models/Order.generated.ts': [Identifier.createVariable('Order')]
    },
    destinationPath: barrelPath
  })

  const file = context.getFile(barrelPath)
  assertInstanceOf(file, TsFile)

  // One entry per source module after the merge; the entity-type split
  // picks `export { … }` vs `export type { … }` per line (the doubled
  // space when the keyword slot is empty matches the legacy renderer).
  assertEquals(
    file.toString(),
    `export  { User } from '@/models/User.generated.ts'\n` +
      `export type { UserDto } from '@/models/User.generated.ts'\n` +
      `export  { Order } from '@/models/Order.generated.ts'`
  )
})

Deno.test('barrel pattern - duplicate re-exported names dedup within an entry', () => {
  const context = toGenerateContext()
  const barrelPath = '@/models/index.generated.ts'

  register(context, {
    reExports: { '@/models/User.generated.ts': [Identifier.createVariable('User')] },
    destinationPath: barrelPath
  })
  register(context, {
    reExports: { '@/models/User.generated.ts': [Identifier.createVariable('User')] },
    destinationPath: barrelPath
  })

  const file = context.getFile(barrelPath)
  assertInstanceOf(file, TsFile)
  assertEquals(file.toString(), `export  { User } from '@/models/User.generated.ts'`)
})

Deno.test('barrel pattern - empty re-export lists register nothing', () => {
  const context = toGenerateContext()
  const barrelPath = '@/models/index.generated.ts'

  register(context, {
    reExports: { '@/models/User.generated.ts': [] },
    destinationPath: barrelPath
  })

  const file = context.getFile(barrelPath)
  assertInstanceOf(file, TsFile)
  assertEquals(file.toString(), '')
})
