import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerV3 } from './toServerV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasServer } from './Server.ts'

Deno.test('toServerV3 - basic server', () => {
  const server: OpenAPIV3.ServerObject = { url: 'https://api.example.com' }
  const oasServer = toServerV3({ server, context: mockParseContext })

  assertEquals(oasServer, new OasServer({ url: 'https://api.example.com' }))
})
