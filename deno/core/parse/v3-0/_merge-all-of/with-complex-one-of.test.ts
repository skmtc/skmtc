import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from './merge-intersection.ts'
import { assertEquals } from '@std/assert/equals'
import { mergeUnion } from './merge-union.ts'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  if (ref.$ref === '#/components/schemas/File') {
    return {
      oneOf: [
        {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string'
            },
            encoding: {
              $ref: '#/components/schemas/Encoding'
            }
          }
        },
        {
          type: 'object',
          required: ['gitSha1'],
          properties: {
            gitSha1: {
              type: 'string'
            }
          }
        }
      ]
    }
  }
  if (ref.$ref === '#/components/schemas/Encoding') {
    return {
      type: 'string',
      enum: ['utf-8', 'base64']
    }
  }
  if (ref.$ref === '#/components/schemas/Symlink') {
    return {
      type: 'object',
      required: ['target'],
      properties: {
        target: {
          type: 'string'
        }
      },
      additionalProperties: false
    }
  }
  throw new Error(`Unknown ref: ${JSON.stringify(ref)}`)
}

Deno.test('mergeAllOf - complex oneOf', () => {
  const input: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        $ref: '#/components/schemas/File'
      },
      {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['file']
          }
        }
      }
    ]
  }

  const expected: OpenAPIV3.SchemaObject = {
    oneOf: [
      {
        type: 'object',
        required: ['content', 'type'],
        properties: {
          type: {
            type: 'string',
            enum: ['file']
          },
          content: {
            type: 'string'
          },
          encoding: {
            $ref: '#/components/schemas/Encoding'
          }
        }
      },
      {
        type: 'object',
        required: ['gitSha1', 'type'],
        properties: {
          type: {
            type: 'string',
            enum: ['file']
          },
          gitSha1: {
            type: 'string'
          }
        }
      }
    ]
  }

  const result = mergeIntersection({ schema: input, getRef })

  assertEquals(result, expected)
})

Deno.test('mergeAllOf - even more complex oneOf', () => {
  const input: OpenAPIV3.SchemaObject = {
    oneOf: [
      {
        allOf: [
          {
            $ref: '#/components/schemas/File'
          },
          {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['file']
              }
            }
          }
        ]
      },
      {
        allOf: [
          {
            $ref: '#/components/schemas/Symlink'
          },
          {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['symlink']
              }
            }
          }
        ]
      }
    ],
    discriminator: {
      propertyName: 'type'
    }
  }

  // Members are returned as written — see merge-union.test.ts for why the
  // merge layer leaves a union member's own `allOf` to `toSchemaV3`.
  const expected: OpenAPIV3.SchemaObject = {
    oneOf: input.oneOf,
    discriminator: input.discriminator
  }

  const result = mergeUnion({ schema: input, getRef, groupType: 'oneOf' })

  assertEquals(result, expected)
})
