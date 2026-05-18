import { mockParseContext, toRefParseContextStub } from '@/test/mockParseContext.ts'
import type { OpenAPIV3_1 } from 'openapi-types'
import { toRefV31 } from './toRefV31.ts'
import { assertEquals } from '@std/assert/equals'
import { OasRef } from './Ref.ts'
import { OasDocument } from '../document/Document.ts'
import { OasInfo } from '../info/Info.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toRefV31 - basic schema reference', () => {
  const stackTrail = new StackTrail(['TEST'])
  const ref: OpenAPIV3_1.ReferenceObject = { $ref: '#/components/schemas/TestSchema' }
  const mockDocument = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: []
  })

  const parsedDocument = { type: 'oas', value: mockDocument } as const

  const contextWithDocument = {
    ...mockParseContext,
    oasDocument: mockDocument,
    parsedDocument,
    registerRef: () => {},
    stackTrail: { clone: () => ({ clone: () => ({}) }) }
  }

  const oasRef = toRefV31({
    ref,
    refType: 'schema',
    stackTrail,
    // deno-lint-ignore no-explicit-any
    context: contextWithDocument as any
  })

  assertEquals(
    oasRef,
    new OasRef(
      { refType: 'schema', $ref: '#/components/schemas/TestSchema' },
      toRefParseContextStub(parsedDocument)
    )
  )
})
