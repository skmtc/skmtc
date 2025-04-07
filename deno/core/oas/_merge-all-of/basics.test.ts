import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeGroup } from './merge-group.ts'
import { match } from 'ts-pattern'
// Mock getRef function for testing
const mockGetRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  return match(ref)
    .with(
      { $ref: '#/components/schemas/User' },
      (): OpenAPIV3.SchemaObject => ({
        type: 'string',
        description: 'Mock resolved reference'
      })
    )
    .otherwise(() => {
      throw new Error(`Unknown ref: ${JSON.stringify(ref)}`)
    })
}

Deno.test('mergeAllOf - basic property merging', () => {
  const schema: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        $ref: '#/components/schemas/User'
      }
    ],
    nullable: true
  }

  const expected: OpenAPIV3.SchemaObject = {
    type: 'string',
    description: 'Mock resolved reference',
    nullable: true
  }

  assertEquals(mergeGroup({ schema, getRef: mockGetRef, groupType: 'allOf' }), expected)
})
