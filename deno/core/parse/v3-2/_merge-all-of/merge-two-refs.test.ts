import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from './merge-intersection.ts'
import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  if (ref.$ref === '#/components/schemas/custom-pages_custom_pages_response_collection') {
    return {
      allOf: [
        { $ref: '#/components/schemas/custom-pages_api-response-collection' },
        {
          properties: { result: { items: { type: 'object' }, type: 'array' } }
        }
      ]
    }
  }
  if (ref.$ref === '#/components/schemas/custom-pages_api-response-collection') {
    return {
      allOf: [
        { $ref: '#/components/schemas/custom-pages_api-response-common' },
        {
          properties: {
            result: { items: {}, nullable: true, type: 'array' },
            result_info: {
              $ref: '#/components/schemas/custom-pages_result_info'
            }
          }
        }
      ],
      type: 'object'
    }
  }
  if (ref.$ref === '#/components/schemas/custom-pages_api-response-common') {
    return {
      properties: {
        errors: { $ref: '#/components/schemas/custom-pages_messages' },
        messages: { $ref: '#/components/schemas/custom-pages_messages' },
        result: {
          anyOf: [
            { type: 'object' },
            { items: {}, type: 'array' },
            {
              type: 'string'
            }
          ]
        },
        success: {
          description: 'Whether the API call was successful',
          enum: [true],
          example: true,
          type: 'boolean'
        }
      },
      required: ['success', 'errors', 'messages', 'result'],
      type: 'object'
    }
  }
  if (ref.$ref === '#/components/schemas/custom-pages_messages') {
    return {
      example: [],
      items: {
        properties: {
          code: { minimum: 1000, type: 'integer' },
          message: { type: 'string' }
        },
        required: ['code', 'message'],
        type: 'object',
        uniqueItems: true
      },
      type: 'array'
    }
  }
  if (ref.$ref === '#/components/schemas/custom-pages_result_info') {
    return {
      properties: {
        count: {
          description: 'Total number of results for the requested service',
          example: 1,
          type: 'number'
        },
        page: {
          description: 'Current page within paginated list of results',
          example: 1,
          type: 'number'
        },
        per_page: {
          description: 'Number of results per page of results',
          example: 20,
          type: 'number'
        },
        total_count: {
          description: 'Total results available without any search parameters',
          example: 2000,
          type: 'number'
        }
      },
      type: 'object'
    }
  }
  if (ref.$ref === '#/components/schemas/custom-pages_api-response-common-failure') {
    return {
      properties: {
        errors: {
          allOf: [{ $ref: '#/components/schemas/custom-pages_messages' }],
          example: [{ code: 7003, message: 'No route for the URI' }],
          minLength: 1
        },
        messages: {
          allOf: [{ $ref: '#/components/schemas/custom-pages_messages' }],
          example: []
        },
        result: { enum: [null], nullable: true, type: 'object' },
        success: {
          description: 'Whether the API call was successful',
          enum: [false],
          example: false,
          type: 'boolean'
        }
      },
      required: ['success', 'errors', 'messages', 'result'],
      type: 'object'
    }
  }
  throw new Error(`Unknown ref: ${JSON.stringify(ref)}`)
}

Deno.test('mergeAllOf - merges two deep refs', () => {
  const input: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        properties: {
          errors: {
            example: [],
            items: {
              properties: {
                code: { minimum: 1000, type: 'integer' },
                message: { type: 'string' }
              },
              required: ['code', 'message'],
              type: 'object',
              uniqueItems: true
            },
            type: 'array'
          },
          messages: {
            example: [],
            items: {
              properties: {
                code: { minimum: 1000, type: 'integer' },
                message: { type: 'string' }
              },
              required: ['code', 'message'],
              type: 'object',
              uniqueItems: true
            },
            type: 'array'
          },
          result: {
            anyOf: [
              { type: 'object' },
              { items: {}, type: 'array' },
              {
                type: 'string'
              }
            ]
          },
          success: {
            description: 'Whether the API call was successful',
            enum: [true],
            example: true,
            type: 'boolean'
          }
        },
        required: ['success', 'errors', 'messages', 'result'],
        type: 'object'
      },
      {
        properties: {
          result: { items: {}, nullable: true, type: 'array' },
          result_info: {
            properties: {
              count: {
                description: 'Total number of results for the requested service',
                example: 1,
                type: 'number'
              },
              page: {
                description: 'Current page within paginated list of results',
                example: 1,
                type: 'number'
              },
              per_page: {
                description: 'Number of results per page of results',
                example: 20,
                type: 'number'
              },
              total_count: {
                description: 'Total results available without any search parameters',
                example: 2000,
                type: 'number'
              }
            },
            type: 'object'
          }
        }
      }
    ],
    type: 'object'
  }

  const result = mergeIntersection({ schema: input, getRef })

  const expected: OpenAPIV3.SchemaObject = {
    properties: {
      errors: {
        example: [],
        items: {
          properties: {
            code: { minimum: 1000, type: 'integer' },
            message: { type: 'string' }
          },
          required: ['code', 'message'],
          type: 'object',
          uniqueItems: true
        },
        type: 'array'
      },
      messages: {
        example: [],
        items: {
          properties: {
            code: { minimum: 1000, type: 'integer' },
            message: { type: 'string' }
          },
          required: ['code', 'message'],
          type: 'object',
          uniqueItems: true
        },
        type: 'array'
      },
      result: {
        anyOf: [{ items: {}, nullable: true, type: 'array' }]
      },
      result_info: {
        properties: {
          count: {
            description: 'Total number of results for the requested service',
            example: 1,
            type: 'number'
          },
          page: {
            description: 'Current page within paginated list of results',
            example: 1,
            type: 'number'
          },
          per_page: {
            description: 'Number of results per page of results',
            example: 20,
            type: 'number'
          },
          total_count: {
            description: 'Total results available without any search parameters',
            example: 2000,
            type: 'number'
          }
        },
        type: 'object'
      },
      success: {
        description: 'Whether the API call was successful',
        enum: [true],
        example: true,
        type: 'boolean'
      }
    },
    required: ['success', 'errors', 'messages', 'result'],
    type: 'object'
  }

  assertEquals(result, expected)
})

Deno.test('mergeAllOf - merges two refs chunks', () => {
  const input: OpenAPIV3.SchemaObject = {
    allOf: [
      { $ref: '#/components/schemas/custom-pages_api-response-common' },
      {
        properties: {
          result: { items: {}, nullable: true, type: 'array' },
          result_info: {
            $ref: '#/components/schemas/custom-pages_result_info'
          }
        }
      }
    ],
    type: 'object'
  }

  const result = mergeIntersection({ schema: input, getRef })

  const expected: OpenAPIV3.SchemaObject = {
    properties: {
      errors: {
        $ref: '#/components/schemas/custom-pages_messages'
      },
      messages: {
        $ref: '#/components/schemas/custom-pages_messages'
      },
      result: {
        anyOf: [
          {
            items: {},
            nullable: true,
            type: 'array'
          }
        ]
      },
      result_info: {
        $ref: '#/components/schemas/custom-pages_result_info'
      },
      success: {
        description: 'Whether the API call was successful',
        enum: [true],
        example: true,
        type: 'boolean'
      }
    },
    required: ['success', 'errors', 'messages', 'result'],
    type: 'object'
  }

  assertEquals(result, expected)
})

Deno.test('mergeAllOf - merges two deep refs', () => {
  const input: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        $ref: '#/components/schemas/custom-pages_custom_pages_response_collection'
      },
      {
        $ref: '#/components/schemas/custom-pages_api-response-common-failure'
      }
    ]
  }

  assertThrows(
    () => mergeIntersection({ schema: input, getRef }),
    Error,
    'Cannot merge schemas: enum values have no intersection'
  )
})
