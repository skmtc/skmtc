import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import { TsImport } from '@skmtc/lang-typescript'

Deno.test('Identifier.createVariable - creates untyped variable', () => {
  const identifier = Identifier.createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.entityType.type, 'variable')
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('Identifier.createVariable - creates typed variable', () => {
  const identifier = Identifier.createVariable('userId', { typeName: 'string' })

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
  const variable = Identifier.createVariable('count', { typeName: 'number' })
  const type = Identifier.createType('Status')

  assertEquals(variable.toString(), 'count')
  assertEquals(type.toString(), 'Status')
})

Deno.test('Identifier.toImport - variable identifier emits a bare string', () => {
  // Variable identifiers serialize as bare strings — the canonical
  // concise wire shape for plain value imports, keeping consumers
  // compatible with hand-written `imports: { 'x': ['Foo'] }`.
  const id = Identifier.createVariable('useCustomer')
  assertEquals(id.toImport(), 'useCustomer')

  const rendered = TsImport.fromConcise('./api', [id.toImport()]).toString()
  assertEquals(rendered, `import {useCustomer} from './api'`)
})

Deno.test(
  'Identifier.toImport - variable identifier with alias emits an alias-record',
  () => {
    const id = Identifier.createVariable('useCustomer')
    assertEquals(
      id.toImport({ alias: 'useCust' }),
      { useCustomer: 'useCust' }
    )

    const rendered = TsImport.fromConcise('./api', [id.toImport({ alias: 'useCust' })]).toString()
    assertEquals(rendered, `import {useCustomer as useCust} from './api'`)
  }
)

Deno.test('Identifier.toImport - type identifier emits the explicit type-import object', () => {
  const id = Identifier.createType('UserDto')
  assertEquals(id.toImport(), { name: 'UserDto', type: 'type' })

  const rendered = TsImport.fromConcise('./api', ['useThing', id.toImport()]).toString()
  assertEquals(rendered, `import {useThing, type UserDto} from './api'`)
})

Deno.test('Identifier.toImport - type identifier with alias keeps the explicit object', () => {
  const id = Identifier.createType('User')
  assertEquals(
    id.toImport({ alias: 'IUser' }),
    { name: 'User', alias: 'IUser', type: 'type' }
  )

  const rendered = TsImport.fromConcise('./api', ['useThing', id.toImport({ alias: 'IUser' })]).toString()
  assertEquals(rendered, `import {useThing, type User as IUser} from './api'`)
})

Deno.test('Identifier.toImport - integrates with Import statement rendering', () => {
  // The end-to-end shape consumers see: a type Identifier and a
  // variable Identifier registered together in one Import statement
  // emit the per-name `type` prefix for the type identifier and a
  // plain reference for the variable.
  const typeId = Identifier.createType('UserDto')
  const varId = Identifier.createVariable('useCustomer')

  const statement = TsImport.fromConcise('./api', [varId.toImport(), typeId.toImport()])

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

  const statement = TsImport.fromConcise('./types', [a.toImport(), b.toImport()])

  assertEquals(
    statement.toString(),
    "import type {UserDto, OrderDto} from './types'"
  )
})
