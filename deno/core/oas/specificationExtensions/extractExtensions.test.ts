import { assertEquals } from '@std/assert/equals'
import { extractExtensions } from './toSpecificationExtensionsV3.ts'

Deno.test('extractExtensions - empty object', () => {
  const result = extractExtensions({})

  assertEquals(result, {
    skipped: undefined,
    extensionFields: undefined
  })
})

Deno.test('extractExtensions - object with only extension fields', () => {
  const input = {
    'x-custom': 'value1',
    'x-vendor-specific': 'value2',
    'x-internal-id': 123,
    'x-feature-flag': true
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: undefined,
    extensionFields: {
      'x-custom': 'value1',
      'x-vendor-specific': 'value2',
      'x-internal-id': 123,
      'x-feature-flag': true
    }
  })
})

Deno.test('extractExtensions - object with only non-extension fields', () => {
  const input = {
    name: 'test',
    type: 'string',
    description: 'A test field',
    required: true
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      name: 'test',
      type: 'string',
      description: 'A test field',
      required: true
    },
    extensionFields: undefined
  })
})

Deno.test('extractExtensions - object with mixed fields', () => {
  const input = {
    name: 'test',
    'x-custom': 'extension1',
    type: 'string',
    'x-vendor': 'extension2',
    required: true,
    'x-internal': { nested: 'value' }
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      name: 'test',
      type: 'string',
      required: true
    },
    extensionFields: {
      'x-custom': 'extension1',
      'x-vendor': 'extension2',
      'x-internal': { nested: 'value' }
    }
  })
})

Deno.test('extractExtensions - keys containing but not starting with x-', () => {
  const input = {
    'max-value': 100,
    'min-x-value': 0,
    'regex-pattern': '^[a-z]+$',
    'x-actual-extension': 'yes'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      'max-value': 100,
      'min-x-value': 0,
      'regex-pattern': '^[a-z]+$'
    },
    extensionFields: {
      'x-actual-extension': 'yes'
    }
  })
})

Deno.test('extractExtensions - edge case key names', () => {
  const input = {
    'x-': 'minimal extension',
    x: 'not an extension',
    'X-': 'uppercase X',
    'X-UPPERCASE': 'uppercase extension',
    'x-lowercase': 'lowercase extension'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      x: 'not an extension',
      'X-': 'uppercase X',
      'X-UPPERCASE': 'uppercase extension'
    },
    extensionFields: {
      'x-': 'minimal extension',
      'x-lowercase': 'lowercase extension'
    }
  })
})

Deno.test('extractExtensions - various value types', () => {
  const input = {
    'x-null': null,
    'x-undefined': undefined,
    'x-number': 42,
    'x-string': 'text',
    'x-boolean': false,
    'x-array': [1, 2, 3],
    'x-object': { key: 'value' },
    'x-date': new Date('2024-01-01'),
    'normal-null': null,
    'normal-undefined': undefined
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      'normal-null': null,
      'normal-undefined': undefined
    },
    extensionFields: {
      'x-null': null,
      'x-undefined': undefined,
      'x-number': 42,
      'x-string': 'text',
      'x-boolean': false,
      'x-array': [1, 2, 3],
      'x-object': { key: 'value' },
      'x-date': input['x-date'] // Date object reference
    }
  })
})

Deno.test('extractExtensions - complex nested structures', () => {
  const input = {
    'x-nested': {
      level1: {
        level2: {
          level3: 'deep value',
          array: [{ item: 1 }, { item: 2 }]
        }
      }
    },
    'x-array-of-objects': [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' }
    ],
    'x-mixed': {
      string: 'text',
      number: 123,
      boolean: true,
      null: null,
      nested: {
        more: 'data'
      }
    },
    regular: 'field'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      regular: 'field'
    },
    extensionFields: {
      'x-nested': {
        level1: {
          level2: {
            level3: 'deep value',
            array: [{ item: 1 }, { item: 2 }]
          }
        }
      },
      'x-array-of-objects': [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' }
      ],
      'x-mixed': {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        nested: {
          more: 'data'
        }
      }
    }
  })
})

Deno.test('extractExtensions - single extension field', () => {
  const input = {
    'x-only': 'single extension'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: undefined,
    extensionFields: {
      'x-only': 'single extension'
    }
  })
})

Deno.test('extractExtensions - single non-extension field', () => {
  const input = {
    regular: 'single field'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: {
      regular: 'single field'
    },
    extensionFields: undefined
  })
})

Deno.test('extractExtensions - preserves object references', () => {
  const sharedObject = { shared: 'data' }
  const sharedArray = [1, 2, 3]

  const input = {
    'x-object-ref': sharedObject,
    'x-array-ref': sharedArray,
    'normal-object-ref': sharedObject,
    'normal-array-ref': sharedArray
  }

  const result = extractExtensions(input)

  // Check that references are preserved (same object instances)
  assertEquals(result.extensionFields?.['x-object-ref'], sharedObject)
  assertEquals(result.extensionFields?.['x-array-ref'], sharedArray)
  assertEquals(result.skipped?.['normal-object-ref'], sharedObject)
  assertEquals(result.skipped?.['normal-array-ref'], sharedArray)
})

Deno.test('extractExtensions - order preservation', () => {
  const input = {
    a: 1,
    'x-b': 2,
    c: 3,
    'x-d': 4,
    e: 5
  }

  const result = extractExtensions(input)

  // Check that the keys are processed in order
  assertEquals(Object.keys(result.skipped ?? {}), ['a', 'c', 'e'])
  assertEquals(Object.keys(result.extensionFields || {}), ['x-b', 'x-d'])
})

Deno.test('extractExtensions - special characters in extension names', () => {
  const input = {
    'x-kebab-case': 'value1',
    'x-snake_case': 'value2',
    'x-camelCase': 'value3',
    'x-PascalCase': 'value4',
    'x-with.dots': 'value5',
    'x-with spaces': 'value6',
    'x-with-numbers-123': 'value7',
    'x-😀': 'emoji',
    'x-@special#chars%': 'special'
  }

  const result = extractExtensions(input)

  assertEquals(result, {
    skipped: undefined,
    extensionFields: {
      'x-kebab-case': 'value1',
      'x-snake_case': 'value2',
      'x-camelCase': 'value3',
      'x-PascalCase': 'value4',
      'x-with.dots': 'value5',
      'x-with spaces': 'value6',
      'x-with-numbers-123': 'value7',
      'x-😀': 'emoji',
      'x-@special#chars%': 'special'
    }
  })
})
