import { assertEquals, assertThrows } from 'https://deno.land/std/testing/asserts.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { allOfMerge } from './allOfMerge.ts'

// Mock getRef function for testing
const mockGetRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  return {
    type: 'string',
    description: 'Mock resolved reference'
  }
}

Deno.test('allOfMerge - basic property merging', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - required fields combination', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - nested allOf handling', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        }
      }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - reference resolution', () => {
  const schema: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          ref: { $ref: '#/components/schemas/User' }
        }
      }
    ]
  }

  const expected = {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'Mock resolved reference'
      }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - empty allOf array', () => {
  const schema: OpenAPIV3.SchemaObject = {
    allOf: []
  }

  const expected = {}

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - array concatenation', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - conflicting property descriptions', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Second description' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - mixed type schemas', () => {
  const schema: OpenAPIV3.SchemaObject = {
    allOf: [{ type: 'string' }, { type: 'object', properties: { name: { type: 'string' } } }]
  }

  const expected = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - nullable properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: { type: 'string', nullable: false }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - enum values', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'string',
    enum: ['B']
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - additionalProperties with pattern', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    additionalProperties: { type: 'number' }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - min/max properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    minProperties: 3,
    maxProperties: 4
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - array constraints', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'array',
    items: { type: 'string' },
    minItems: 3,
    maxItems: 4,
    uniqueItems: false
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - number constraints', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'number',
    minimum: 5,
    maximum: 10,
    exclusiveMinimum: true,
    exclusiveMaximum: true
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - string constraints', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'string',
    minLength: 5,
    maxLength: 10,
    pattern: '^[A-Z].*[0-9]$'
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - oneOf inside allOf', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: {
        oneOf: [{ type: 'number' }]
      }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - anyOf inside allOf', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: {
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }]
      }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - not keyword', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    not: {
      anyOf: [
        { properties: { forbidden: { type: 'string' } } },
        { properties: { restricted: { type: 'string' } } }
      ]
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - readOnly and writeOnly conflict throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    "Cannot merge schemas: property 'value' cannot be both readOnly and writeOnly"
  )
})

Deno.test('allOfMerge - format conflict throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    "Cannot merge schemas: conflicting formats 'email' and 'uri'"
  )
})

Deno.test('allOfMerge - empty enum intersection throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    'Cannot merge schemas: enum values have no intersection'
  )
})

Deno.test('allOfMerge - incompatible number constraints throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    'Cannot merge schemas: incompatible number ranges [10,20] and [30,40]'
  )
})

Deno.test('allOfMerge - array item type conflict throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    "Cannot merge schemas: array items have conflicting types 'string' and 'number'"
  )
})

Deno.test('allOfMerge - multipleOf', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'number',
    multipleOf: 6
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - default values', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: { type: 'string', default: 'second' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - example values', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: { type: 'string', example: 'second' }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - deprecated properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    properties: {
      value: { type: 'string', deprecated: true }
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - externalDocs', () => {
  const schema: OpenAPIV3.SchemaObject = {
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

  const expected = {
    type: 'object',
    externalDocs: {
      url: 'https://example.com/second',
      description: 'Second docs'
    }
  }

  assertEquals(allOfMerge(schema), expected)
})

Deno.test('allOfMerge - type conflict throws error', () => {
  const schema: OpenAPIV3.SchemaObject = {
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
    () => allOfMerge(schema),
    Error,
    "Cannot merge schemas: property 'value' has conflicting types 'string' and 'number'"
  )
})
