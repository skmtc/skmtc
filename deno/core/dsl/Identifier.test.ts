import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import { Import, ImportName } from '@/dsl/Import.ts'

Deno.test('Identifier.createVariable - creates untyped variable', () => {
  const identifier = Identifier.createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.entityType.type, 'variable')
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('Identifier.createVariable - creates typed variable', () => {
  const identifier = Identifier.createVariable('userId', 'string')

  assertEquals(identifier.name, 'userId')
  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.entityType.type, 'variable')
  assertEquals(identifier.toString(), 'userId')
})

Deno.test('Identifier.createType - creates type identifier', () => {
  const identifier = Identifier.createType('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.entityType.type, 'type')
  assertEquals(identifier.toString(), 'User')
})

Deno.test('Identifier - toString returns identifier name', () => {
  const variable = Identifier.createVariable('count', 'number')
  const type = Identifier.createType('Status')

  assertEquals(variable.toString(), 'count')
  assertEquals(type.toString(), 'Status')
})

Deno.test('Identifier.toImport - variable identifier emits a bare string', () => {
  // Variable identifiers serialise as bare strings — the canonical
  // wire shape for plain value imports. This matches `Import#toRecord`
  // output and keeps consumers (including Driver-internal register
  // calls) compatible with hand-written `imports: { 'x': ['Foo'] }`.
  const id = Identifier.createVariable('useCustomer')
  assertEquals(id.toImport(), 'useCustomer')

  const importName = new ImportName(id.toImport())
  assertEquals(importName.toString(), 'useCustomer')
})

Deno.test(
  'Identifier.toImport - variable identifier with alias emits an alias-record',
  () => {
    const id = Identifier.createVariable('useCustomer')
    assertEquals(
      id.toImport({ alias: 'useCust' }),
      { useCustomer: 'useCust' }
    )

    const importName = new ImportName(id.toImport({ alias: 'useCust' }))
    assertEquals(importName.toString(), 'useCustomer as useCust')
  }
)

Deno.test('Identifier.toImport - type identifier emits the explicit type-import object', () => {
  const id = Identifier.createType('UserDto')
  assertEquals(id.toImport(), { name: 'UserDto', type: 'type' })

  const importName = new ImportName(id.toImport())
  assertEquals(importName.toString(), 'type UserDto')
})

Deno.test('Identifier.toImport - type identifier with alias keeps the explicit object', () => {
  const id = Identifier.createType('User')
  assertEquals(
    id.toImport({ alias: 'IUser' }),
    { name: 'User', alias: 'IUser', type: 'type' }
  )

  const importName = new ImportName(id.toImport({ alias: 'IUser' }))
  assertEquals(importName.toString(), 'type User as IUser')
})

Deno.test('Identifier.toImport - integrates with Import statement rendering', () => {
  // The end-to-end shape consumers see: a type Identifier and a
  // variable Identifier registered together in one Import statement
  // emit the per-name `type` prefix for the type identifier and a
  // plain reference for the variable.
  const typeId = Identifier.createType('UserDto')
  const varId = Identifier.createVariable('useCustomer')

  const statement = new Import({
    module: './api',
    importNames: [varId.toImport(), typeId.toImport()]
  })

  assertEquals(
    statement.toString(),
    "import {useCustomer, type UserDto} from './api'"
  )
})

Deno.test('Identifier.toImport - all-type list renders statement-level import type', () => {
  // When every imported name is a type, the engine prefers the
  // statement-level `import type { … }` form over per-name prefixes.
  const a = Identifier.createType('UserDto')
  const b = Identifier.createType('OrderDto')

  const statement = new Import({
    module: './types',
    importNames: [a.toImport(), b.toImport()]
  })

  assertEquals(
    statement.toString(),
    "import type {UserDto, OrderDto} from './types'"
  )
})
