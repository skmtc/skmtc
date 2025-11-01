import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSecuritySchemesV3 } from './toSecuritySchemes.ts'
import { assertEquals } from '@std/assert/equals'
import { OasHttpSecurityScheme } from './SecurityScheme.ts'

Deno.test('toSecuritySchemesV3 - undefined security schemes', () => {
  const result = toSecuritySchemesV3({
    securitySchemes: {
      http: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    context: mockParseContext
  })

  assertEquals(result, {
    http: new OasHttpSecurityScheme({
      scheme: 'bearer',
      bearerFormat: 'JWT'
    })
  })
})
