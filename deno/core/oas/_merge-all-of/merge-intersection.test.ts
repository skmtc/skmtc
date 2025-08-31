import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import type { SchemaObject, GetRefFn, ReferenceObject } from './types.ts'
import { mergeIntersection } from './merge-intersection.ts'
import { match } from 'ts-pattern'
// Mock getRef function for testing
const mockGetRef: GetRefFn = () => {
  return {
    type: 'string',
    description: 'Mock resolved reference'
  }
}

Deno.test('mergeAllOf - basic property merging', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      },
      {
        type: 'object',
        properties: {
          age: { type: 'number' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - required fields combination', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      },
      {
        type: 'object',
        required: ['age'],
        properties: {
          age: { type: 'number' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - merge two objects', () => {
  const schema: SchemaObject = {
    allOf: [
      { type: 'object', properties: { name: { type: 'string' } } },
      { type: 'object', properties: { email: { type: 'string' } } }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

// This can be handled when we go deeper into the schema later during parsing
Deno.test('mergeAllOf - do not merge deeper allOf items', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          user: {
            allOf: [
              { type: 'object', properties: { name: { type: 'string' } } },
              { type: 'object', properties: { email: { type: 'string' } } }
            ]
          }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      user: {
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } } },
          { type: 'object', properties: { email: { type: 'string' } } }
        ]
      }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - reference resolution - leave single reference as is', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - reference resolution - combine identical references', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' }
        }
      },
      {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - reference resolution - resolve reference when merging is needed', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' }
        }
      },
      {
        type: 'object',
        properties: {
          user: {
            nullable: true
          }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description: 'Mock resolved reference',
        nullable: true
      }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test(
  'mergeAllOf - reference resolution - resolve reference when merging is needed - reverse order',
  () => {
    const schema: SchemaObject = {
      allOf: [
        {
          type: 'object',
          properties: {
            user: {
              nullable: true
            }
          }
        },
        {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' }
          }
        }
      ]
    }

    const expected: SchemaObject = {
      type: 'object',
      properties: {
        user: {
          nullable: true,
          type: 'string',
          description: 'Mock resolved reference'
        }
      }
    }

    assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
  }
)

Deno.test('mergeAllOf - empty allOf array', () => {
  const schema: SchemaObject = {
    allOf: []
  }

  const expected: SchemaObject = {}

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - array concatenation', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - conflicting property descriptions', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'First description' }
        }
      },
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Second description' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Second description' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - mixed type schemas', () => {
  const schema: SchemaObject = {
    allOf: [{ type: 'string' }, { type: 'object', properties: { name: { type: 'string' } } }]
  }

  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef, throwOnConflict: true }),
    Error,
    `Cannot merge schemas: conflicting types 'string' and 'object'`
  )
})

Deno.test('mergeAllOf - nullable properties', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string', nullable: true }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'string', nullable: false }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: { type: 'string', nullable: false }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - enum values', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'string',
        enum: ['A', 'B']
      },
      {
        type: 'string',
        enum: ['B', 'C']
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'string',
    enum: ['B']
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - additionalProperties with pattern', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      {
        type: 'object',
        additionalProperties: { type: 'number' }
      }
    ]
  }

  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef, throwOnConflict: true }),
    Error,
    `Cannot merge schemas: conflicting types 'string' and 'number'`
  )
})

Deno.test('mergeAllOf - min/max properties', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        minProperties: 2,
        maxProperties: 4
      },
      {
        type: 'object',
        minProperties: 3,
        maxProperties: 5
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    minProperties: 3,
    maxProperties: 4
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - array constraints', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        uniqueItems: true
      },
      {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 5,
        uniqueItems: false
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    minItems: 3,
    maxItems: 4,
    uniqueItems: true
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - number constraints', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'number',
        minimum: 0,
        maximum: 10,
        exclusiveMinimum: true
      },
      {
        type: 'number',
        minimum: 5,
        maximum: 15,
        exclusiveMaximum: true
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'number',
    minimum: 5,
    maximum: 10,
    exclusiveMinimum: true,
    exclusiveMaximum: true
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - string constraints', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'string',
        minLength: 2,
        maxLength: 10,
        pattern: '^[A-Z]'
      },
      {
        type: 'string',
        minLength: 5,
        maxLength: 15,
        pattern: '[0-9]$'
      }
    ]
  }

  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    `Cannot merge schemas: conflicting patterns '^[A-Z]' and '[0-9]$'`
  )
})

Deno.test('mergeAllOf - oneOf inside allOf', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: {
            oneOf: [{ type: 'string' }, { type: 'number' }]
          }
        }
      },
      {
        type: 'object',
        properties: {
          value: {
            oneOf: [{ type: 'number' }, { type: 'boolean' }]
          }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: {
        oneOf: [{ type: 'number' }]
      }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - anyOf inside allOf', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: {
            anyOf: [{ type: 'string' }, { type: 'number' }]
          }
        }
      },
      {
        type: 'object',
        properties: {
          value: {
            anyOf: [{ type: 'number' }, { type: 'boolean' }]
          }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: {
        anyOf: [{ type: 'number' }]
      }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - not keyword', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        not: {
          properties: {
            forbidden: { type: 'string' }
          }
        }
      },
      {
        type: 'object',
        not: {
          properties: {
            restricted: { type: 'string' }
          }
        }
      }
    ]
  }

  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    'Merging schemas with "not" keyword is not supported'
  )
})

Deno.test('mergeAllOf - readOnly and writeOnly conflict throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string', readOnly: true }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'string', writeOnly: true }
        }
      }
    ]
  }

  // Should throw an error about conflicting readOnly/writeOnly flags
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    'Cannot merge schemas: property cannot be both readOnly and writeOnly'
  )
})

Deno.test('mergeAllOf - format conflict throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'string',
        format: 'email'
      },
      {
        type: 'string',
        format: 'uri'
      }
    ]
  }

  // Should throw an error about conflicting formats
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    "Cannot merge schemas: conflicting formats 'email' and 'uri'"
  )
})

Deno.test('mergeAllOf - empty enum intersection throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'string',
        enum: ['A', 'B']
      },
      {
        type: 'string',
        enum: ['C', 'D']
      }
    ]
  }

  // Should throw an error about empty enum intersection
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    'Cannot merge schemas: enum values have no intersection'
  )
})

Deno.test('mergeAllOf - incompatible number constraints throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'number',
        minimum: 10,
        maximum: 20
      },
      {
        type: 'number',
        minimum: 30,
        maximum: 40
      }
    ]
  }

  // Should throw an error about incompatible number ranges
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    'Cannot merge schemas: incompatible number ranges [10,20] and [30,40]'
  )
})

Deno.test('mergeAllOf - array item type conflict throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'array',
        items: { type: 'string' }
      },
      {
        type: 'array',
        items: { type: 'number' }
      }
    ]
  }

  // Should throw an error about conflicting array item types
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef }),
    Error,
    "Cannot merge schemas: array items have conflicting types 'string' and 'number'"
  )
})

Deno.test('mergeAllOf - multipleOf', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'number',
        multipleOf: 2
      },
      {
        type: 'number',
        multipleOf: 3
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'number',
    multipleOf: 6
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - default values', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string', default: 'first' }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'string', default: 'second' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: { type: 'string', default: 'second' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - example values', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'first' }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'second' }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: { type: 'string', example: 'second' }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - deprecated properties', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string', deprecated: false }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'string', deprecated: true }
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    properties: {
      value: { type: 'string', deprecated: true }
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - externalDocs', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        externalDocs: {
          url: 'https://example.com/first',
          description: 'First docs'
        }
      },
      {
        type: 'object',
        externalDocs: {
          url: 'https://example.com/second',
          description: 'Second docs'
        }
      }
    ]
  }

  const expected: SchemaObject = {
    type: 'object',
    externalDocs: {
      url: 'https://example.com/second',
      description: 'Second docs'
    }
  }

  assertEquals(mergeIntersection({ schema, getRef: mockGetRef }), expected)
})

Deno.test('mergeAllOf - type conflict throws error', () => {
  const schema: SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      },
      {
        type: 'object',
        properties: {
          value: { type: 'number' }
        }
      }
    ]
  }

  // Should throw an error about conflicting types
  assertThrows(
    () => mergeIntersection({ schema, getRef: mockGetRef, throwOnConflict: true }),
    Error,
    "Cannot merge schemas: conflicting types 'string' and 'number'"
  )
})

Deno.test('mergeAllOf - simpler allOf', () => {
  const getRef = (ref: ReferenceObject): SchemaObject => {
    return match(ref)
      .returnType<SchemaObject>()
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

  const expected: SchemaObject = {
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

  const result = mergeIntersection({ schema: input, getRef })
  assertEquals(result, expected)
})
