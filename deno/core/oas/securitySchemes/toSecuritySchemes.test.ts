import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSecuritySchemesV3 } from './toSecuritySchemes.ts'
import { assertEquals } from '@std/assert/equals'
import { OasHttpSecurityScheme } from './SecurityScheme.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toSecuritySchemesV3 - undefined security schemes', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toSecuritySchemesV3({
    securitySchemes: {
      http: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    http: new OasHttpSecurityScheme({
      scheme: 'bearer',
      bearerFormat: 'JWT'
    })
  })
})
