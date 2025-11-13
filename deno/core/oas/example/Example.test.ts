import { assertEquals } from '@std/assert'
import { OasExample } from './Example.ts'

Deno.test('OasExample', async (t) => {
  await t.step('constructor and property initialization', async (t) => {
    await t.step('should initialize with all properties provided', () => {
      const example = new OasExample({
        value: { name: 'John Doe', age: 30 },
        summary: 'Example user',
        description: 'A typical user object with name and age',
        externalValue: 'https://example.com/user.json',
        extensionFields: { 'x-custom': 'metadata' },
      })

      assertEquals(example.oasType, 'example')
      assertEquals(example.value, { name: 'John Doe', age: 30 })
      assertEquals(example.summary, 'Example user')
      assertEquals(example.description, 'A typical user object with name and age')
      assertEquals(example.externalValue, 'https://example.com/user.json')
      assertEquals(example.extensionFields, { 'x-custom': 'metadata' })
    })

    await t.step('should initialize with minimal required properties (just value)', () => {
      const example = new OasExample({ value: 'simple string value' })

      assertEquals(example.oasType, 'example')
      assertEquals(example.value, 'simple string value')
      assertEquals(example.summary, undefined)
      assertEquals(example.description, undefined)
      assertEquals(example.externalValue, undefined)
      assertEquals(example.extensionFields, undefined)
    })

    await t.step('should handle optional properties correctly', () => {
      const example = new OasExample({
        value: 42,
        summary: 'Number example',
      })

      assertEquals(example.value, 42)
      assertEquals(example.summary, 'Number example')
      assertEquals(example.description, undefined)
      assertEquals(example.externalValue, undefined)
    })

    await t.step('should set oasType to example', () => {
      const example = new OasExample({ value: 'test' })
      assertEquals(example.oasType, 'example')
    })

    await t.step('should handle extension fields (x-* properties)', () => {
      const extensionFields = {
        'x-category': 'authentication',
        'x-priority': 'high',
        'x-metadata': { nested: { deep: 'value' } },
      }

      const example = new OasExample({
        value: 'test',
        extensionFields,
      })

      assertEquals(example.extensionFields, extensionFields)
      assertEquals(example.extensionFields?.['x-category'], 'authentication')
      assertEquals(example.extensionFields?.['x-priority'], 'high')
    })

    await t.step('should handle both value and externalValue', () => {
      const example = new OasExample({
        value: { default: 'fallback' },
        externalValue: 'https://api.example.com/examples/user.json',
        summary: 'User example with external reference',
      })

      assertEquals(example.value, { default: 'fallback' })
      assertEquals(example.externalValue, 'https://api.example.com/examples/user.json')
      assertEquals(example.summary, 'User example with external reference')
    })
  })

  await t.step('isRef() method', async (t) => {
    await t.step('should return false for OasExample instance (not a reference)', () => {
      const example = new OasExample({
        value: 'test value',
        summary: 'Test example',
      })

      assertEquals(example.isRef(), false)
    })

    await t.step('should work correctly with type narrowing', () => {
      const example = new OasExample({ value: 123 })

      if (!example.isRef()) {
        // Type should be OasExample here, not OasRef<'example'>
        assertEquals(example.oasType, 'example')
        assertEquals(example.value, 123)
      }
    })

    await t.step('should always return false regardless of properties', () => {
      const examples = [
        new OasExample({ value: 'string' }),
        new OasExample({ value: 42, summary: 'Number' }),
        new OasExample({ value: { complex: 'object' }, description: 'Desc' }),
        new OasExample({ value: [1, 2, 3], externalValue: 'https://example.com' }),
      ]

      examples.forEach((example) => {
        assertEquals(example.isRef(), false)
      })
    })
  })

  await t.step('resolve() method', async (t) => {
    await t.step('should return self when called on OasExample instance', () => {
      const example = new OasExample({
        value: 'Bearer token123',
        summary: 'Auth token example',
        description: 'Example of a valid bearer token',
      })

      const resolved = example.resolve()

      assertEquals(resolved, example)
      assertEquals(resolved.value, 'Bearer token123')
      assertEquals(resolved.summary, 'Auth token example')
    })

    await t.step('should not throw errors', () => {
      const example = new OasExample({ value: null })
      const resolved = example.resolve()
      assertEquals(resolved, example)
    })

    await t.step('should maintain all properties after resolve', () => {
      const example = new OasExample({
        value: { user: 'admin', role: 'administrator' },
        summary: 'Admin user',
        description: 'Example of an administrator user object',
        externalValue: 'https://docs.example.com/admin.json',
        extensionFields: { 'x-version': '2.0' },
      })

      const resolved = example.resolve()

      assertEquals(resolved.value, { user: 'admin', role: 'administrator' })
      assertEquals(resolved.summary, 'Admin user')
      assertEquals(resolved.description, 'Example of an administrator user object')
      assertEquals(resolved.externalValue, 'https://docs.example.com/admin.json')
      assertEquals(resolved.extensionFields, { 'x-version': '2.0' })
    })
  })

  await t.step('resolveOnce() method', async (t) => {
    await t.step('should return self when called on OasExample instance', () => {
      const example = new OasExample({
        value: [1, 2, 3, 4, 5],
        summary: 'Array example',
      })

      const resolved = example.resolveOnce()

      assertEquals(resolved, example)
      assertEquals(resolved.value, [1, 2, 3, 4, 5])
    })

    await t.step('should behave identically to resolve() for non-reference examples', () => {
      const example = new OasExample({
        value: true,
        summary: 'Boolean example',
        description: 'Example of a boolean value',
      })

      const resolved = example.resolve()
      const resolvedOnce = example.resolveOnce()

      assertEquals(resolved, resolvedOnce)
      assertEquals(resolved, example)
    })

    await t.step('should maintain all properties after resolveOnce', () => {
      const example = new OasExample({
        value: { status: 'active', count: 100 },
        summary: 'Status response',
        description: 'Example status response',
        extensionFields: { 'x-tags': ['status', 'health'] },
      })

      const resolved = example.resolveOnce()

      assertEquals(resolved.value, { status: 'active', count: 100 })
      assertEquals(resolved.summary, 'Status response')
      assertEquals(resolved.description, 'Example status response')
      assertEquals(resolved.extensionFields, { 'x-tags': ['status', 'health'] })
    })
  })

  await t.step('toJsonSchema() method', async (t) => {
    await t.step('should convert example to OpenAPI v3 JSON format', () => {
      const example = new OasExample({
        value: 'example value',
        summary: 'Simple example',
        description: 'A simple string example',
      })

      const result = example.toJsonSchema({ resolve: false })

      assertEquals(result.value, 'example value')
      assertEquals(result.summary, 'Simple example')
      assertEquals(result.description, 'A simple string example')
    })

    await t.step('should include all standard properties (summary, description, value)', () => {
      const example = new OasExample({
        value: { id: 123, name: 'Product A' },
        summary: 'Product example',
        description: 'Example of a product object with ID and name',
      })

      const result = example.toJsonSchema({ resolve: false })

      assertEquals(result.summary, 'Product example')
      assertEquals(result.description, 'Example of a product object with ID and name')
      assertEquals(result.value, { id: 123, name: 'Product A' })
    })

    await t.step('should handle examples with only value', () => {
      const example = new OasExample({ value: 42 })

      const result = example.toJsonSchema({ resolve: false })

      assertEquals(result.value, 42)
      assertEquals(result.summary, undefined)
      assertEquals(result.description, undefined)
    })

    await t.step('should handle examples with all properties', () => {
      const example = new OasExample({
        value: ['item1', 'item2', 'item3'],
        summary: 'Array of items',
        description: 'Example showing an array of string items',
        externalValue: 'https://example.com/items.json',
        extensionFields: { 'x-source': 'database' },
      })

      const result = example.toJsonSchema({ resolve: false })

      assertEquals(result.value, ['item1', 'item2', 'item3'])
      assertEquals(result.summary, 'Array of items')
      assertEquals(result.description, 'Example showing an array of string items')
      // Note: externalValue is not included in toJsonSchema output based on implementation
    })

    await t.step('should NOT include externalValue in output', () => {
      const example = new OasExample({
        value: 'test',
        externalValue: 'https://example.com/external.json',
      })

      const result = example.toJsonSchema({ resolve: false })

      // Based on the implementation, externalValue is not included in the output
      assertEquals('externalValue' in result, false)
      assertEquals(result.value, 'test')
    })

    await t.step('should handle undefined summary and description', () => {
      const example = new OasExample({
        value: { key: 'value' },
      })

      const result = example.toJsonSchema({ resolve: false })

      assertEquals(result.summary, undefined)
      assertEquals(result.description, undefined)
      assertEquals(result.value, { key: 'value' })
    })
  })

  await t.step('property handling', async (t) => {
    await t.step('should handle value property with string type', () => {
      const example = new OasExample({ value: 'string value' })
      assertEquals(example.value, 'string value')
      assertEquals(typeof example.value, 'string')
    })

    await t.step('should handle value property with number type', () => {
      const example = new OasExample({ value: 123.45 })
      assertEquals(example.value, 123.45)
      assertEquals(typeof example.value, 'number')
    })

    await t.step('should handle value property with object type', () => {
      const objectValue = {
        id: 1,
        name: 'Test',
        nested: { deep: { property: 'value' } },
      }
      const example = new OasExample({ value: objectValue })

      assertEquals(example.value, objectValue)
      assertEquals(typeof example.value, 'object')
    })

    await t.step('should handle value property with array type', () => {
      const arrayValue = [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]
      const example = new OasExample({ value: arrayValue })

      assertEquals(example.value, arrayValue)
      assertEquals(Array.isArray(example.value), true)
    })

    await t.step('should handle value property with null', () => {
      const example = new OasExample({ value: null })
      assertEquals(example.value, null)
    })

    await t.step('should handle value property with boolean type', () => {
      const trueExample = new OasExample({ value: true })
      const falseExample = new OasExample({ value: false })

      assertEquals(trueExample.value, true)
      assertEquals(falseExample.value, false)
    })

    await t.step('should handle externalValue for external reference URLs', () => {
      const example = new OasExample({
        value: 'placeholder',
        externalValue: 'https://api.example.com/v1/examples/user-response.json',
      })

      assertEquals(example.externalValue, 'https://api.example.com/v1/examples/user-response.json')
    })

    await t.step('should handle summary field', () => {
      const shortSummary = new OasExample({
        value: 'test',
        summary: 'Short',
      })
      const longSummary = new OasExample({
        value: 'test',
        summary: 'A much longer summary that describes the example in detail',
      })

      assertEquals(shortSummary.summary, 'Short')
      assertEquals(longSummary.summary, 'A much longer summary that describes the example in detail')
    })

    await t.step('should handle description field', () => {
      const example = new OasExample({
        value: 'test',
        description:
          'This is a detailed description that provides extensive information about what this example represents and how it should be used in the API documentation.',
      })

      assertEquals(
        example.description,
        'This is a detailed description that provides extensive information about what this example represents and how it should be used in the API documentation.',
      )
    })
  })

  await t.step('edge cases and integration', async (t) => {
    await t.step('should handle example with only value', () => {
      const example = new OasExample({ value: 'minimal' })

      assertEquals(example.value, 'minimal')
      assertEquals(example.summary, undefined)
      assertEquals(example.description, undefined)
      assertEquals(example.externalValue, undefined)
      assertEquals(example.extensionFields, undefined)
    })

    await t.step('should handle example with only externalValue (and required value)', () => {
      const example = new OasExample({
        value: undefined, // Still required in constructor
        externalValue: 'https://example.com/external-example.json',
        summary: 'External example',
      })

      assertEquals(example.value, undefined)
      assertEquals(example.externalValue, 'https://example.com/external-example.json')
      assertEquals(example.summary, 'External example')
    })

    await t.step('should handle example with extension fields only', () => {
      const example = new OasExample({
        value: 'value',
        extensionFields: {
          'x-custom-1': 'value1',
          'x-custom-2': { complex: 'object' },
        },
      })

      assertEquals(example.extensionFields?.['x-custom-1'], 'value1')
      assertEquals(example.extensionFields?.['x-custom-2'], { complex: 'object' })
      assertEquals(example.summary, undefined)
      assertEquals(example.description, undefined)
    })

    await t.step('should work with realistic API response examples', () => {
      // Success response example
      const successExample = new OasExample({
        value: {
          status: 200,
          data: { id: 123, name: 'John Doe', email: 'john@example.com' },
          message: 'User retrieved successfully',
        },
        summary: 'Successful user retrieval',
        description: 'Example of a successful GET /users/:id response',
      })

      // Error response example
      const errorExample = new OasExample({
        value: {
          status: 404,
          error: 'Not Found',
          message: 'User with ID 999 not found',
        },
        summary: 'User not found error',
        description: 'Example of a 404 error response when user does not exist',
      })

      // Pagination example
      const paginationExample = new OasExample({
        value: {
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          page: 1,
          per_page: 10,
          total: 100,
          total_pages: 10,
        },
        summary: 'Paginated results',
        description: 'Example showing paginated list of users',
      })

      assertEquals(successExample.value !== null, true)
      assertEquals(errorExample.value !== null, true)
      assertEquals(paginationExample.value !== null, true)
    })

    await t.step('should work with request body examples', () => {
      // Create user request example
      const createUserExample = new OasExample({
        value: {
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          password: 'SecureP@ssw0rd!',
          role: 'user',
        },
        summary: 'Create user request',
        description: 'Example payload for creating a new user',
      })

      // Update user request example
      const updateUserExample = new OasExample({
        value: {
          name: 'Jane Smith-Jones',
          email: 'jane.jones@example.com',
        },
        summary: 'Update user request',
        description: 'Example payload for partially updating user information',
      })

      assertEquals(typeof createUserExample.value, 'object')
      assertEquals(typeof updateUserExample.value, 'object')
    })

    await t.step('should handle examples with complex nested structures', () => {
      const complexExample = new OasExample({
        value: {
          user: {
            profile: {
              personal: {
                firstName: 'John',
                lastName: 'Doe',
                dateOfBirth: '1990-01-01',
              },
              contact: {
                email: 'john@example.com',
                phone: '+1-555-0123',
                address: {
                  street: '123 Main St',
                  city: 'Springfield',
                  country: 'USA',
                  zipCode: '12345',
                },
              },
            },
            preferences: {
              notifications: { email: true, sms: false, push: true },
              privacy: { shareData: false, showProfile: true },
            },
          },
          metadata: {
            created: '2024-01-01T00:00:00Z',
            updated: '2024-01-15T10:30:00Z',
            version: 2,
          },
        },
        summary: 'Complex user object',
        description: 'Example showing a deeply nested user profile structure',
      })

      assertEquals(typeof complexExample.value, 'object')
      assertEquals(complexExample.summary, 'Complex user object')
    })
  })
})
