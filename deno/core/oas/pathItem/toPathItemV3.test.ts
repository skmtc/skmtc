import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toPathItemV3 } from './toPathItemV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasPathItem } from './PathItem.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toPathItemV3 - basic path item', () => {
  const stackTrail = new StackTrail(['TEST'])
  const pathItem: OpenAPIV3.PathItemObject = {}
  const oasPathItem = toPathItemV3({ pathItem, stackTrail, context: mockParseContext })

  assertEquals(oasPathItem, new OasPathItem())
})
