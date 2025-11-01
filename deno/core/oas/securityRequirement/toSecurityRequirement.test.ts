import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSecurityRequirementsV3 } from './toSecurityRequirement.ts'
import { assertEquals } from '@std/assert/equals'
import { OasSecurityRequirement } from './SecurityRequirement.ts'
import { OasDocument } from '../document/Document.ts'

Deno.test('toSecurityRequirementsV3 - undefined security requirements', () => {
  const result = toSecurityRequirementsV3({
    security: [{ api_key: [] }],
    context: mockParseContext
  })

  assertEquals(result, [
    new OasSecurityRequirement({ requirement: { api_key: [] } }, new OasDocument())
  ])
})
