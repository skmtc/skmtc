import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toDocumentFieldsV3 } from './toDocumentFieldsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInfo } from '@/oas/info/Info.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toDocumentFieldsV3 - basic document fields', () => {
  const documentObject: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  }
  const stackTrail = new StackTrail(['TEST'])
  const documentFields = toDocumentFieldsV3({
    stackTrail,
    documentObject,
    context: mockParseContext
  })

  assertEquals(documentFields.openapi, '3.0.0')
  assertEquals(documentFields.info, new OasInfo({ title: 'Test API', version: '1.0.0' }))
  assertEquals(documentFields.operations, [])
})

Deno.test('toDocumentFieldsV3 - flattens webhooks into OasWebhook[]', () => {
  const documentObject: OpenAPIV3.Document & {
    webhooks?: Record<string, OpenAPIV3.PathItemObject>
  } = {
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {},
    webhooks: {
      newPet: { post: { responses: { '200': { description: 'ok' } } } }
    }
  }
  const stackTrail = new StackTrail(['TEST'])
  const documentFields = toDocumentFieldsV3({ stackTrail, documentObject, context: mockParseContext })

  const webhooks = documentFields.webhooks ?? []
  assertEquals(documentFields.operations, [])
  assertEquals(webhooks.length, 1)
  assertEquals(webhooks[0].name, 'newPet')
  assertEquals(webhooks[0].method, 'post')
  assertEquals(webhooks[0].oasType, 'webhook')
})

Deno.test('toDocumentFieldsV3 - operations and webhooks stay separate; webhooks never leak into operations', () => {
  const documentObject: OpenAPIV3.Document & {
    webhooks?: Record<string, OpenAPIV3.PathItemObject>
  } = {
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/pets': { get: { responses: { '200': { description: 'ok' } } } }
    },
    webhooks: {
      newPet: { post: { responses: { '200': { description: 'ok' } } } }
    }
  }
  const stackTrail = new StackTrail(['TEST'])
  const documentFields = toDocumentFieldsV3({ stackTrail, documentObject, context: mockParseContext })
  const webhooks = documentFields.webhooks ?? []

  // operations holds only the path operation
  assertEquals(documentFields.operations.length, 1)
  assertEquals(documentFields.operations[0].path, '/pets')
  assertEquals(documentFields.operations[0].method, 'get')
  assertEquals(documentFields.operations[0].oasType, 'operation')

  // webhooks holds only the webhook — and no webhook leaks into operations
  // (the inverted-semantics safety net: client/SDK generators iterate
  // `operations` and must never receive a webhook subject)
  assertEquals(webhooks.length, 1)
  assertEquals(webhooks[0].name, 'newPet')
  assertEquals(webhooks[0].oasType, 'webhook')
  assertEquals(
    documentFields.operations.every(op => op.oasType === 'operation'),
    true,
    'no webhook leaked into operations'
  )
})

Deno.test('toDocumentFieldsV3 - a webhooks-only document with no `paths` is valid (native 3.1)', () => {
  // OpenAPI 3.1 makes `paths` optional, so a webhooks-only document is legal.
  // v3-1 tolerates the missing `paths` (operations: []) and still parses the
  // webhooks. (v3-0 keeps requiring `paths`, per the 3.0 spec.)
  const documentFields = toDocumentFieldsV3({
    stackTrail: new StackTrail(['TEST']),
    documentObject: {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      // no `paths` key — legal in 3.1
      webhooks: {
        newPet: { post: { responses: { '200': { description: 'ok' } } } }
      }
    },
    context: mockParseContext
  })

  assertEquals(documentFields.operations, [])
  const webhooks = documentFields.webhooks ?? []
  assertEquals(webhooks.length, 1)
  assertEquals(webhooks[0].name, 'newPet')
})
