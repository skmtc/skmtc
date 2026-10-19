import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toMediaTypeItemsV3 } from './toMediaTypeItemV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { OasExample } from '@/oas/example/Example.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toMediaTypeItemsV3 - basic media type', () => {
  const content: Record<string, OpenAPIV3.MediaTypeObject> = {
    'application/json': {}
  }
  const stackTrail = new StackTrail(['TEST'])
  const oasMediaTypes = toMediaTypeItemsV3({ content, stackTrail, context: mockParseContext })

  assertEquals(oasMediaTypes, {
    'application/json': new OasMediaType({ mediaType: 'application/json' })
  })
})

Deno.test('toMediaTypeItemsV3 - threads the singular example through, keyed by media type', () => {
  const content: Record<string, OpenAPIV3.MediaTypeObject> = {
    'application/json': { example: { id: 1, name: 'Fido' } }
  }
  const stackTrail = new StackTrail(['TEST'])
  const oasMediaTypes = toMediaTypeItemsV3({ content, stackTrail, context: mockParseContext })

  // The value reaches the media type whole — a media type's `example` is a
  // literal, so it must not be unwrapped as though it were an Example Object.
  assertEquals(oasMediaTypes['application/json'].examples, {
    'application/json': new OasExample({ value: { id: 1, name: 'Fido' } })
  })
})

Deno.test('toMediaTypeItemsV3 - threads named examples through under their own keys', () => {
  const content: Record<string, OpenAPIV3.MediaTypeObject> = {
    'application/json': {
      examples: {
        one: { summary: 'A pet', value: { id: 1 } },
        remote: { externalValue: 'https://example.com/big.json' }
      }
    }
  }
  const stackTrail = new StackTrail(['TEST'])
  const oasMediaTypes = toMediaTypeItemsV3({ content, stackTrail, context: mockParseContext })

  assertEquals(oasMediaTypes['application/json'].examples, {
    one: new OasExample({ summary: 'A pet', value: { id: 1 } }),
    remote: new OasExample({ externalValue: 'https://example.com/big.json' })
  })
})
