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

// const input: OpenAPIV3.SchemaObject = {
//   oneOf: [
//     {
//       allOf: [
//         {
//           $ref: '#/components/schemas/File'
//         },
//         {
//           type: 'object',
//           required: ['kind'],
//           properties: {
//             kind: {
//               type: 'string',
//               enum: ['file']
//             }
//           }
//         }
//       ]
//     },
//     {
//       allOf: [
//         {
//           $ref: '#/components/schemas/Symlink'
//         },
//         {
//           type: 'object',
//           required: ['kind'],
//           properties: {
//             kind: {
//               type: 'string',
//               enum: ['symlink']
//             }
//           }
//         }
//       ]
//     }
//   ],
//   discriminator: {
//     propertyName: 'kind'
//   }
// }

// const expected: OpenAPIV3.SchemaObject = {
//   oneOf: [
//     {
//       allOf: [
//         {
//           $ref: '#/components/schemas/File'
//         },
//         {
//           type: 'object',
//           required: ['kind'],
//           properties: {
//             kind: {
//               type: 'string',
//               enum: ['file']
//             }
//           }
//         }
//       ]
//     },
//     {
//       allOf: [
//         {
//           $ref: '#/components/schemas/Symlink'
//         },
//         {
//           type: 'object',
//           required: ['kind'],
//           properties: {
//             kind: {
//               type: 'string',
//               enum: ['symlink']
//             }
//           }
//         }
//       ]
//     }
//   ],
//   discriminator: {
//     propertyName: 'kind'
//   }
// }

// Deno.test('mergeAllOf - with top-level oneOf', () => {
//   const result = mergeAllOf(input, getRef)
//   assertEquals(result, expected)
// })

Deno.test('mergeAllOf - simpler allOf', () => {
  const input: OpenAPIV3.SchemaObject = {
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

  const expected: OpenAPIV3.SchemaObject = {
    type: 'object',
    required: ['target', 'kind'],
    properties: {
      kind: {
        type: 'string',
        enum: ['symlink']
      },
      target: {
        type: 'string'
      }
    },
    additionalProperties: false
  }

  const result = mergeAllOf(input, getRef)
  assertEquals(result, expected)
})
