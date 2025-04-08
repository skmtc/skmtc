import { assertEquals } from '@std/assert'
import { decomposeIntersection } from './decompose-intersection.ts'
import type { SchemaObject } from './types.ts'

Deno.test('decomposeAllOf - nullable at the end', () => {
  const schema: SchemaObject = {
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

  const expected: SchemaObject[] = [
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

  assertEquals(decomposeIntersection({ schema }), expected)
})

Deno.test('decomposeAllOf - nullable at the start', () => {
  const schema: SchemaObject = {
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

  const expected: SchemaObject[] = [
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

  assertEquals(decomposeIntersection({ schema }), expected)
})

Deno.test('decomposeAllOf - two allOf items', () => {
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
          email: { type: 'string' }
        }
      }
    ]
  }

  const expected: SchemaObject[] = [
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

  assertEquals(decomposeIntersection({ schema }), expected)
})

Deno.test('decomposeAllOf - two allOf items with before and after', () => {
  const schema: SchemaObject = {
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

  const expected: SchemaObject[] = [
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

  assertEquals(decomposeIntersection({ schema }), expected)
})
