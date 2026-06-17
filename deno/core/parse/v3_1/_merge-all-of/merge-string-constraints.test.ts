import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { mergeStringConstraints } from './merge-string-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { GetRefFn } from './types.ts'

const getRef: GetRefFn = () => ({})

Deno.test('mergeStringConstraints', async (t) => {
  await t.step('minLength merging', async (t) => {
    await t.step('should take max of both minLength values', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 0,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 5,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 5,
      })
    })

    await t.step('should handle minLength only in first schema', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 3,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 3,
      })
    })

    await t.step('should handle minLength only in second schema', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 7,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 7,
      })
    })

    await t.step('should handle both undefined (no minLength)', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
      })
    })

    await t.step('should treat undefined as 0', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 0,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.minLength, 0)
    })
  })

  await t.step('maxLength merging', async (t) => {
    await t.step('should take min of both maxLength values', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 10,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 5,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        maxLength: 5,
      })
    })

    await t.step('should handle maxLength only in first schema', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 15,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        maxLength: 15,
      })
    })

    await t.step('should handle maxLength only in second schema', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 20,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        maxLength: 20,
      })
    })

    await t.step('should handle both undefined (no maxLength)', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
      })
    })
  })

  await t.step('pattern merging', async (t) => {
    await t.step('should throw on conflicting patterns', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+$',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z0-9]+$',
      }
      assertThrows(
        () => mergeStringConstraints(a, b, getRef),
        Error,
        "Cannot merge schemas: conflicting patterns '^[a-z]+$' and '^[a-z0-9]+$'"
      )
    })

    await t.step('should merge when both have same pattern', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+$',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+$',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        pattern: '^[a-z]+$',
      })
    })

    await t.step('should take pattern from first schema when second has none', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^test$',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        pattern: '^test$',
      })
    })

    await t.step('should take pattern from second schema when first has none', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^example$',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        pattern: '^example$',
      })
    })
  })

  await t.step('format merging', async (t) => {
    await t.step('should throw on conflicting formats', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'email',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'uri',
      }
      assertThrows(
        () => mergeStringConstraints(a, b, getRef),
        Error,
        'Incompatible string formats'
      )
    })

    await t.step('should merge when both have same format', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'email',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'email',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        format: 'email',
      })
    })

    await t.step('should take format from first schema when second has none', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'uuid',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        format: 'uuid',
      })
    })

    await t.step('should take format from second schema when first has none', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'date-time',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        format: 'date-time',
      })
    })

    await t.step('should handle common string formats', () => {
      const formats = ['email', 'uri', 'uuid', 'date', 'date-time', 'password', 'byte', 'binary']

      formats.forEach((format) => {
        const a: OpenAPIV3.SchemaObject = {
          type: 'string',
          format,
        }
        const b: OpenAPIV3.SchemaObject = {
          type: 'string',
        }
        const result = mergeStringConstraints(a, b, getRef)
        assertEquals(result.format, format)
      })
    })
  })

  await t.step('enum merging', async (t) => {
    await t.step('should intersect enum values when both schemas have enums', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['a', 'b', 'c'],
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['b', 'c', 'd'],
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        enum: ['b', 'c'],
      })
    })

    await t.step('should take enum from second schema when first has no enum', () => {
      const a: OpenAPIV3.SchemaObject = { type: 'string' }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['a', 'b', 'c'],
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        enum: ['a', 'b', 'c'],
      })
    })

    await t.step('should take enum from first schema when second has no enum', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['a', 'b', 'c'],
      }
      const b: OpenAPIV3.SchemaObject = { type: 'string' }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        enum: ['a', 'b', 'c'],
      })
    })

    await t.step('should throw when enum intersection is empty', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['a', 'b', 'c'],
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['d', 'e', 'f'],
      }
      assertThrows(
        () => mergeStringConstraints(a, b, getRef),
        Error,
        'Merged schema has empty enum array'
      )
    })
  })

  await t.step('combined constraints', async (t) => {
    await t.step('should merge minLength and maxLength together', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 5,
        maxLength: 20,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 3,
        maxLength: 15,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 5,
        maxLength: 15,
      })
    })

    await t.step('should merge minLength with pattern', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 3,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+$',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 3,
        pattern: '^[a-z]+$',
      })
    })

    await t.step('should merge maxLength with format', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 100,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        format: 'email',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        maxLength: 100,
        format: 'email',
      })
    })

    await t.step('should merge all constraints together', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 5,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9]+$',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9]+$',
        format: 'password',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 5,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9]+$',
        format: 'password',
      })
    })

    await t.step('should merge constraints with enum', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 2,
        enum: ['ab', 'abc', 'abcd'],
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 3,
        enum: ['abc', 'abcd', 'abcde'],
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        minLength: 2,
        maxLength: 3,
        enum: ['abc', 'abcd'],
      })
    })

    await t.step('should handle pattern and format together', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
        format: 'email',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
        format: 'email',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {
        type: 'string',
        pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
        format: 'email',
      })
    })
  })

  await t.step('type handling', async (t) => {
    await t.step('should throw error on conflicting types', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 5,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'number',
        minimum: 0,
      }
      assertThrows(
        () => mergeStringConstraints(a, b, getRef),
        Error,
        "Cannot merge schemas: conflicting types 'string' and 'number'"
      )
    })

    await t.step('should handle schemas without type', () => {
      const a: OpenAPIV3.SchemaObject = {}
      const b: OpenAPIV3.SchemaObject = {}
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result, {})
    })

    await t.step('should handle one schema with type, other without', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 5,
      }
      const b: OpenAPIV3.SchemaObject = {
        maxLength: 10,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.type, 'string')
      assertEquals(result.minLength, 5)
      assertEquals(result.maxLength, 10)
    })
  })

  await t.step('edge cases', async (t) => {
    await t.step('should handle zero minLength', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 0,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        minLength: 0,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.minLength, 0)
    })

    await t.step('should handle very large maxLength', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 999999,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        maxLength: 1000000,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.maxLength, 999999)
    })

    await t.step('should handle empty string pattern', () => {
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '',
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern: '',
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.pattern, '')
    })

    await t.step('should handle complex regex patterns', () => {
      const pattern = '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
      const a: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern,
      }
      const b: OpenAPIV3.SchemaObject = {
        type: 'string',
        pattern,
      }
      const result = mergeStringConstraints(a, b, getRef)
      assertEquals(result.pattern, pattern)
    })
  })
})
