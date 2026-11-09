import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeSchemasOrRefs } from './merge.ts'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  if (ref.$ref === '#/components/schemas/Healthcheck') {
    return { type: 'object', properties: { name: { type: 'string' } } }
  }

  throw new Error(`Unknown ref: ${ref.$ref}`)
}

Deno.test('a oneOf merged with a reference is crossed with its target, as with any schema', () => {
  // Cloudflare's healthchecks_single_response: the common envelope says
  // `result` is an object or a string, the single response that it is a Healthcheck.
  const first: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'object', properties: { id: { type: 'string' } } }, { type: 'string' }],
  }
  const healthcheck: OpenAPIV3.ReferenceObject = { $ref: '#/components/schemas/Healthcheck' }

  // The trap: the oneOf was kept beside the target's merged properties, and the parse then failed.
  // A string cannot also be the Healthcheck object, so only the object member is left.
  assertEquals(mergeSchemasOrRefs(first, healthcheck, getRef), {
    oneOf: [{ type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }],
  })
})

Deno.test('a null-only member merged with a reference gives a nullable copy, and the shared target does not change', () => {
  const acl: OpenAPIV3.SchemaObject = { type: 'object', properties: { name: { type: 'string' } } }
  const nullOnly: OpenAPIV3.SchemaObject = { nullable: true, enum: [null] }

  const merged = mergeSchemasOrRefs({ $ref: '#/components/schemas/Acl' }, nullOnly, () => acl)

  assertEquals(merged, { type: 'object', properties: { name: { type: 'string' } }, nullable: true })
  // The trap: the component every reference shares became nullable everywhere.
  assertEquals(acl.nullable, undefined)
})
