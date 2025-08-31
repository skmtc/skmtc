import { match } from 'ts-pattern'
import type { GetRefFn, ReferenceObject, SchemaObject } from './types.ts'
import { assertEquals } from '@std/assert/equals'
import { mergeUnion } from './merge-union.ts'

const getRef = (ref: ReferenceObject): SchemaObject => {
  return match(ref)
    .returnType<SchemaObject>()
    .with(
      { $ref: '#/components/schemas/File' },
      (): SchemaObject => ({
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
      (): SchemaObject => ({
        type: 'string',
        enum: ['utf-8', 'base64']
      })
    )
    .with(
      { $ref: '#/components/schemas/Symlink' },
      (): SchemaObject => ({
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

const input: SchemaObject = {
  oneOf: [
    {
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
    },
    {
      allOf: [
        {
          $ref: '#/components/schemas/Symlink'
        },
        {
          type: 'object',
          required: ['kind'],
          properties: {
            kind: {
              type: 'string',
              enum: ['symlink']
            }
          }
        }
      ]
    }
  ],
  discriminator: {
    propertyName: 'kind'
  }
}

const expected: SchemaObject = {
  oneOf: [
    {
      type: 'object',
      required: ['content', 'kind'],
      properties: {
        content: {
          type: 'string'
        },
        encoding: {
          $ref: '#/components/schemas/Encoding'
        },
        kind: {
          type: 'string',
          enum: ['file']
        }
      }
    },
    {
      type: 'object',
      required: ['gitSha1', 'kind'],
      properties: {
        gitSha1: {
          type: 'string'
        },
        kind: {
          type: 'string',
          enum: ['file']
        }
      }
    },
    {
      type: 'object',
      required: ['target', 'kind'],
      properties: {
        target: {
          type: 'string'
        },
        kind: {
          type: 'string',
          enum: ['symlink']
        }
      },
      additionalProperties: false
    }
  ],
  discriminator: {
    propertyName: 'kind'
  }
}

Deno.test('mergeAllOf - with top-level oneOf', () => {
  const result = mergeUnion({ schema: input, getRef, groupType: 'oneOf' })

  assertEquals(result, expected)
})

Deno.test('mergeUnion - simple oneOf', () => {
  const mockGetRef: GetRefFn = () => ({})

  const input: SchemaObject = {
    oneOf: [
      {
        properties: {
          prompt: {
            description: 'The input text prompt for the model to generate a response.',
            minLength: 1,
            type: 'string'
          }
        },
        required: ['prompt'],
        title: 'Prompt'
      },
      {
        properties: {
          messages: {
            description: 'An array of message objects representing the conversation history.',
            items: {
              properties: {
                content: {
                  description: 'The content of the message as a string.',
                  type: 'string'
                },
                role: {
                  description:
                    "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                  type: 'string'
                }
              },
              required: ['role', 'content'],
              type: 'object'
            },
            type: 'array'
          }
        },
        required: ['messages'],
        title: 'Messages'
      }
    ],
    type: 'object'
  }

  const result = mergeUnion({ schema: input, getRef: mockGetRef, groupType: 'oneOf' })

  assertEquals(result, {
    oneOf: [
      {
        properties: {
          prompt: {
            description: 'The input text prompt for the model to generate a response.',
            minLength: 1,
            type: 'string'
          }
        },
        required: ['prompt'],
        title: 'Prompt',
        type: 'object'
      },
      {
        properties: {
          messages: {
            description: 'An array of message objects representing the conversation history.',
            items: {
              properties: {
                content: {
                  description: 'The content of the message as a string.',
                  type: 'string'
                },
                role: {
                  description:
                    "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                  type: 'string'
                }
              },
              required: ['role', 'content'],
              type: 'object'
            },
            type: 'array'
          }
        },
        required: ['messages'],
        title: 'Messages',
        type: 'object'
      }
    ]
  })
})
