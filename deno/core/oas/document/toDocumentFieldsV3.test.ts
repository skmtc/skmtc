import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toDocumentFieldsV3 } from './toDocumentFieldsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { OasInfo } from '../info/Info.ts'
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

Deno.test('toDocumentFieldsV3 - a webhooks-only document with no `paths` currently throws (deferred to the native 3.1 parser)', () => {
  // OpenAPI 3.1 makes `paths` optional, so a webhooks-only document is legal.
  // The shared (down-convert) parser still assumes `paths` is present —
  // `toOperationsV3` does `Object.entries(paths)` with no guard — so it throws
  // today. The fix belongs in the native v3_1 parser fork (arc Phase 3), NOT
  // the shared parser; this test pins the current behavior and will trip when
  // the fork makes `paths` optional, prompting an update to assert the
  // success path (operations: [], one webhook).
  const documentObject = {
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
    // no `paths` key — legal in 3.1, not yet handled by the shared parser
    webhooks: {
      newPet: { post: { responses: { '200': { description: 'ok' } } } }
    }
    // deno-lint-ignore no-explicit-any -- intentionally omits the required `paths`
  } as any

  assertThrows(
    () =>
      toDocumentFieldsV3({
        stackTrail: new StackTrail(['TEST']),
        documentObject,
        context: mockParseContext
      }),
    Error,
    'Cannot convert undefined or null to object'
  )
})
