import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toDiscriminatorV3 } from './toDiscriminatorV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasDiscriminator } from './Discriminator.ts'

Deno.test('toDiscriminatorV3 - basic discriminator', () => {
  const discriminator: OpenAPIV3.DiscriminatorObject = {
    propertyName: 'type'
  }
  const oasDiscriminator = toDiscriminatorV3({
    discriminator,
    context: mockParseContext
  })

  assertEquals(oasDiscriminator, new OasDiscriminator({ propertyName: 'type' }))
})
