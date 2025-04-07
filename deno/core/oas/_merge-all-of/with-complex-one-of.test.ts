import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'
import { mergeAllOf } from './merge-all-of.ts'
import { assertEquals } from 'https://deno.land/std@0.131.0/testing/asserts.ts'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  return match(ref)
    .returnType<OpenAPIV3.SchemaObject>()
    .with(
      { $ref: '#/components/schemas/File' },
      (): OpenAPIV3.SchemaObject => ({
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
      })
    )
    .with(
      { $ref: '#/components/schemas/Encoding' },
      (): OpenAPIV3.SchemaObject => ({
        type: 'string',
        enum: ['utf-8', 'base64']
      })
    )
    .with(
      { $ref: '#/components/schemas/Symlink' },
      (): OpenAPIV3.SchemaObject => ({
        type: 'object',
        required: ['target'],
        properties: {
          target: {
            type: 'string'
          }
        },
        additionalProperties: false
      })
    )
    .otherwise(() => {
      throw new Error(`Unknown ref: ${JSON.stringify(ref)}`)
    })
}

Deno.test('mergeAllOf - complex oneOf', () => {
  const input: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        $ref: '#/components/schemas/File'
      },
      {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: {
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
        required: ['content', 'kind'],
        properties: {
          kind: {
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
        required: ['gitSha1', 'kind'],
        properties: {
          kind: {
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

  const got = {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['file']
      }
    },
    required: ['kind']
  }

  const result = mergeAllOf(input, getRef)

  assertEquals(result, expected)
})

// Cannot merge ref and object
// -> look up the ref and substitute in the value
const stepOne = {
  allOf: [
    {
      $ref: '#/components/schemas/File'
    },
    {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          enum: ['file']
        }
      }
    }
  ]
}

// Cannot oneOf and object
// -> apply allOf to each oneOfs
const stepTwo = {
  allOf: [
    {
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
    },
    {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['file'] }
      }
    }
  ]
}

const stepThree = {
  oneOf: [
    {
      allOf: [
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
          required: ['kind'],
          properties: {
            kind: { type: 'string', enum: ['file'] }
          }
        }
      ]
    },
    {
      allOf: [
        {
          type: 'object',
          required: ['gitSha1'],
          properties: {
            gitSha1: {
              type: 'string'
            }
          }
        },
        {
          type: 'object',
          required: ['kind'],
          properties: {
            kind: { type: 'string', enum: ['file'] }
          }
        }
      ]
    }
  ]
}

const stepFive = {
  oneOf: [
    {
      type: 'object',
      required: ['kind', 'content'],
      properties: {
        kind: {
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
      required: ['kind', 'gitSha1'],
      properties: {
        kind: {
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
