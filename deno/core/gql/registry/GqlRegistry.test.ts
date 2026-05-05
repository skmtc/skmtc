import { assertEquals } from '@std/assert'
import { GqlRegistry } from './GqlRegistry.ts'
import { OasString } from '@/oas/string/String.ts'
import type { RefName } from '@/types/RefName.ts'

const refName = (s: string) => s as unknown as RefName

Deno.test('GqlRegistry - stores and lists schemas in insertion order', () => {
  const registry = new GqlRegistry({
    schemas: {
      [refName('User')]: new OasString({}),
      [refName('Role')]: new OasString({ enums: ['ADMIN', 'USER'] })
    }
  })

  assertEquals(registry.toSchemasRefNames(), [refName('User'), refName('Role')])
})

Deno.test('GqlRegistry - returns empty list when no schemas registered', () => {
  const registry = new GqlRegistry({ schemas: {} })
  assertEquals(registry.toSchemasRefNames(), [])
})

Deno.test('GqlRegistry - removeSchema removes existing entry and reports true', () => {
  const registry = new GqlRegistry({
    schemas: {
      [refName('User')]: new OasString({})
    }
  })

  assertEquals(registry.removeSchema(refName('User')), true)
  assertEquals(registry.toSchemasRefNames(), [])
})

Deno.test('GqlRegistry - removeSchema returns false for missing entry', () => {
  const registry = new GqlRegistry({ schemas: {} })
  assertEquals(registry.removeSchema(refName('Missing')), false)
})

Deno.test('GqlRegistry - removeSchema does not affect siblings', () => {
  const registry = new GqlRegistry({
    schemas: {
      [refName('User')]: new OasString({}),
      [refName('Role')]: new OasString({})
    }
  })

  registry.removeSchema(refName('User'))

  assertEquals(registry.toSchemasRefNames(), [refName('Role')])
})
