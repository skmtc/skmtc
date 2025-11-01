import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toContactV3 } from './toContactV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasContact } from './Contact.ts'

Deno.test('toContactV3 - basic contact object', () => {
  const contact: OpenAPIV3.ContactObject = {}
  const oasContact = toContactV3(contact, mockParseContext)

  assertEquals(oasContact, new OasContact())
})
