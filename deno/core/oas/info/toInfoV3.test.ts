import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toInfoV3 } from './toInfoV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInfo } from './Info.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toInfoV3 - basic info object', () => {
  const info: OpenAPIV3.InfoObject = {
    title: 'Test API',
    version: '1.0.0'
  }
  const stackTrail = new StackTrail(['TEST'])
  const oasInfo = toInfoV3({ info, stackTrail, context: mockParseContext })

  assertEquals(oasInfo, new OasInfo({ title: 'Test API', version: '1.0.0' }))
})
