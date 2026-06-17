import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSecurityRequirementsV3 } from './toSecurityRequirement.ts'
import { assertEquals } from '@std/assert/equals'
import { OasSecurityRequirement } from '@/oas/securityRequirement/SecurityRequirement.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toSecurityRequirementsV3 - undefined security requirements', () => {
  const stackTrail = new StackTrail(['TEST'])

  const result = toSecurityRequirementsV3({
    stackTrail,
    security: [{ api_key: [] }],
    context: mockParseContext
  })

  assertEquals(result, [
    new OasSecurityRequirement({ requirement: { api_key: [] } }, new OasDocument())
  ])
})
