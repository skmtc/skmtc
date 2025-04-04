import { assertEquals } from '@std/assert'
import { decomposeAllOf } from './decompose-all-of.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('decomposeAllOf - nullable at the end', () => {
  const schema: OpenAPIV3.SchemaObject = {
    allOf: [
      {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    ],
    nullable: true
  }

  const expected: OpenAPIV3.SchemaObject[] = [
    {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    {
      nullable: true
    }
  ]

  assertEquals(decomposeAllOf(schema), expected)
})

Deno.test('decomposeAllOf - nullable at the start', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    allOf: [
      {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    ]
  }

  const expected: OpenAPIV3.SchemaObject[] = [
    {
      nullable: true
    },
    {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
  ]

  assertEquals(decomposeAllOf(schema), expected)
})

Deno.test('decomposeAllOf - no allOf', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true
  }

  const expected: OpenAPIV3.SchemaObject[] = [
    {
      nullable: true
    }
  ]

  assertEquals(decomposeAllOf(schema), expected)
})

Deno.test('decomposeAllOf - two allOf items', () => {
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
          email: { type: 'string' }
        }
      }
    ]
  }

  const expected: OpenAPIV3.SchemaObject[] = [
    {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    {
      type: 'object',
      properties: {
        email: { type: 'string' }
      }
    }
  ]

  assertEquals(decomposeAllOf(schema), expected)
})

Deno.test('decomposeAllOf - two allOf items with before and after', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
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
          email: { type: 'string' }
        }
      }
    ],
    description: 'Mock description'
  }

  const expected: OpenAPIV3.SchemaObject[] = [
    {
      nullable: true
    },
    {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    {
      type: 'object',
      properties: {
        email: { type: 'string' }
      }
    },
    {
      description: 'Mock description'
    }
  ]

  assertEquals(decomposeAllOf(schema), expected)
})
