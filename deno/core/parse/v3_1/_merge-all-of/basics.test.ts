import { assertEquals } from '@std/assert/equals'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from './merge-intersection.ts'

// Mock getRef function for testing
const mockGetRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  if (ref.$ref === '#/components/schemas/User') {
    return {
      type: 'string',
      description: 'Mock resolved reference'
    };
  }
  throw new Error(`Unknown ref: ${JSON.stringify(ref)}`);
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

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})
