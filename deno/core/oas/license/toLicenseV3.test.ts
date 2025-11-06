import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toLicenseV3 } from './toLicenseV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasLicense } from './License.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toLicenseV3 - basic license object', () => {
  const stackTrail = new StackTrail(['TEST'])
  const license: OpenAPIV3.LicenseObject = { name: 'MIT' }
  const oasLicense = toLicenseV3(license, stackTrail, mockParseContext)

  assertEquals(oasLicense, new OasLicense({ name: 'MIT' }))
})
