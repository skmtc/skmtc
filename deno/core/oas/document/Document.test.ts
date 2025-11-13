import { assert, assertEquals, assertExists, assertThrows } from '@std/assert'
import { OasDocument, type DocumentFields } from './Document.ts'
import { OasInfo } from '../info/Info.ts'
import { OasOperation } from '../operation/Operation.ts'
import { OasComponents } from '../components/Components.ts'
import { OasServer } from '../server/Server.ts'
import { OasTag } from '../tag/Tag.ts'
import { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
import { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'
import { OasString } from '../string/String.ts'
import { OasObject } from '../object/Object.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { RefName } from '@/types/RefName.ts'

// Helper to create minimal DocumentFields for testing
const createMinimalFields = (): DocumentFields => ({
  openapi: '3.0.0',
  info: new OasInfo({
    title: 'Test API',
    version: '1.0.0'
  }),
  operations: []
})

// Helper to create full DocumentFields with all properties
const createFullFields = (): DocumentFields => ({
  openapi: '3.1.0',
  info: new OasInfo({
    title: 'Full Test API',
    version: '2.0.0',
    description: 'A complete test API'
  }),
  servers: [
    new OasServer({
      url: 'https://api.example.com'
    })
  ],
  operations: [
    new OasOperation({
      path: '/users',
      method: 'get',
      pathItem: undefined,
      responses: {}
    }),
    new OasOperation({
      path: '/users/{id}',
      method: 'get',
      pathItem: undefined,
      responses: {}
    }),
    new OasOperation({
      path: '/users',
      method: 'post',
      pathItem: undefined,
      responses: {}
    })
  ],
  components: new OasComponents({
    schemas: {
      'User': new OasObject({ title: 'User' }),
      'Post': new OasObject({ title: 'Post' })
    } as Record<RefName, OasObject>
  }),
  tags: [
    new OasTag({ name: 'users', description: undefined }),
    new OasTag({ name: 'posts', description: undefined })
  ],
  extensionFields: {
    'x-custom': 'value',
    'x-internal': true
  },
  externalDocs: new OasExternalDocs({
    url: 'https://docs.example.com'
  })
})

// Helper to create a document with security (security needs document reference)
const createDocumentWithSecurity = (): OasDocument => {
  const document = new OasDocument(createFullFields())
  const securityRequirement = new OasSecurityRequirement(
    { requirement: { 'api_key': [] } },
    document
  )
  document.fields = {
    ...createFullFields(),
    security: [securityRequirement]
  }
  return document
}

Deno.test('OasDocument', async (t) => {
  await t.step('constructor and oasType', async (t) => {
    await t.step('should initialize with fields provided', () => {
      const fields = createMinimalFields()
      const document = new OasDocument(fields)

      assertEquals(document.oasType, 'openapi')
      assertEquals(document.openapi, '3.0.0')
      assertEquals(document.info.title, 'Test API')
    })

    await t.step('should initialize without fields (lazy initialization)', () => {
      const document = new OasDocument()

      assertEquals(document.oasType, 'openapi')
    })

    await t.step('should always have oasType as "openapi"', () => {
      const doc1 = new OasDocument()
      const doc2 = new OasDocument(createMinimalFields())

      assertEquals(doc1.oasType, 'openapi')
      assertEquals(doc2.oasType, 'openapi')
    })
  })

  await t.step('fields setter', async (t) => {
    await t.step('should set fields after construction', () => {
      const document = new OasDocument()
      const fields = createMinimalFields()

      document.fields = fields

      assertEquals(document.openapi, '3.0.0')
      assertEquals(document.info.title, 'Test API')
    })

    await t.step('should update/replace existing fields', () => {
      const document = new OasDocument(createMinimalFields())
      const newFields = createFullFields()

      document.fields = newFields

      assertEquals(document.openapi, '3.1.0')
      assertEquals(document.info.title, 'Full Test API')
    })
  })

  await t.step('getter methods - error cases before fields set', async (t) => {
    await t.step('openapi throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.openapi,
        Error,
        "Accessing 'openapi' before fields are set"
      )
    })

    await t.step('info throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.info,
        Error,
        "Accessing 'info' before fields are set"
      )
    })

    await t.step('servers throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.servers,
        Error,
        "Accessing 'servers' before fields are set"
      )
    })

    await t.step('operations throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.operations,
        Error,
        "Accessing 'operations' before fields are set"
      )
    })

    await t.step('components throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.components,
        Error,
        "Accessing 'components' before fields are set"
      )
    })

    await t.step('tags throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.tags,
        Error,
        "Accessing 'tags' before fields are set"
      )
    })

    await t.step('security throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.security,
        Error,
        "Accessing 'security' before fields are set"
      )
    })

    await t.step('extensionFields throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.extensionFields,
        Error,
        "Accessing 'extensionFields' before fields are set"
      )
    })

    await t.step('externalDocs throws before fields are set', () => {
      const document = new OasDocument()

      assertThrows(
        () => document.externalDocs,
        Error,
        "Accessing 'externalDocs' before fields are set"
      )
    })
  })

  await t.step('getter methods - success cases after fields set', async (t) => {
    await t.step('openapi returns version string', () => {
      const document = new OasDocument(createFullFields())

      assertEquals(document.openapi, '3.1.0')
    })

    await t.step('info returns OasInfo object', () => {
      const document = new OasDocument(createFullFields())

      assertExists(document.info)
      assertEquals(document.info.title, 'Full Test API')
      assertEquals(document.info.version, '2.0.0')
    })

    await t.step('servers returns array or undefined', () => {
      const docWithServers = new OasDocument(createFullFields())
      const docWithoutServers = new OasDocument(createMinimalFields())

      assertExists(docWithServers.servers)
      assertEquals(docWithServers.servers?.length, 1)
      assertEquals(docWithoutServers.servers, undefined)
    })

    await t.step('operations returns operations array', () => {
      const document = new OasDocument(createFullFields())

      assertExists(document.operations)
      assertEquals(document.operations.length, 3)
    })

    await t.step('components returns OasComponents or undefined', () => {
      const docWithComponents = new OasDocument(createFullFields())
      const docWithoutComponents = new OasDocument(createMinimalFields())

      assertExists(docWithComponents.components)
      assertEquals(docWithoutComponents.components, undefined)
    })

    await t.step('tags returns tags array or undefined', () => {
      const docWithTags = new OasDocument(createFullFields())
      const docWithoutTags = new OasDocument(createMinimalFields())

      assertExists(docWithTags.tags)
      assertEquals(docWithTags.tags?.length, 2)
      assertEquals(docWithoutTags.tags, undefined)
    })

    await t.step('security returns security requirements or undefined', () => {
      const docWithSecurity = createDocumentWithSecurity()
      const docWithoutSecurity = new OasDocument(createMinimalFields())

      assertExists(docWithSecurity.security)
      assertEquals(docWithSecurity.security?.length, 1)
      assertEquals(docWithoutSecurity.security, undefined)
    })

    await t.step('extensionFields returns extension fields or undefined', () => {
      const docWithExtensions = new OasDocument(createFullFields())
      const docWithoutExtensions = new OasDocument(createMinimalFields())

      assertExists(docWithExtensions.extensionFields)
      assertEquals(docWithExtensions.extensionFields?.['x-custom'], 'value')
      assertEquals(docWithoutExtensions.extensionFields, undefined)
    })

    await t.step('externalDocs returns external docs or undefined', () => {
      const docWithDocs = new OasDocument(createFullFields())
      const docWithoutDocs = new OasDocument(createMinimalFields())

      assertExists(docWithDocs.externalDocs)
      assertEquals(docWithDocs.externalDocs?.url, 'https://docs.example.com')
      assertEquals(docWithoutDocs.externalDocs, undefined)
    })
  })

  await t.step('removeItem() - operations removal', async (t) => {
    await t.step('should remove existing operation by path and method', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['paths', '/users', 'post'])

      const removed = document.removeItem(stackTrail)

      assertExists(removed)
      assert(removed instanceof OasOperation)
      if (removed instanceof OasOperation) {
        assertEquals(removed.path, '/users')
        assertEquals(removed.method, 'post')
      }
    })

    await t.step('should mutate operations array when removing', () => {
      const document = new OasDocument(createFullFields())
      const originalLength = document.operations.length
      const stackTrail = new StackTrail(['paths', '/users', 'get'])

      document.removeItem(stackTrail)

      assertEquals(document.operations.length, originalLength - 1)
    })

    await t.step('should return undefined for non-existent operation', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['paths', '/nonexistent', 'get'])

      const removed = document.removeItem(stackTrail)

      assertEquals(removed, undefined)
    })

    await t.step('should remove operation with path variables', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['paths', '/users/{id}', 'get'])

      const removed = document.removeItem(stackTrail)

      assertExists(removed)
      if (removed instanceof OasOperation) {
        assertEquals(removed.path, '/users/{id}')
      }
    })

    await t.step('should return undefined when removing from empty operations', () => {
      const fields = createMinimalFields()
      fields.operations = []
      const document = new OasDocument(fields)
      const stackTrail = new StackTrail(['paths', '/users', 'get'])

      const removed = document.removeItem(stackTrail)

      assertEquals(removed, undefined)
    })

    await t.step('should return undefined for wrong method', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['paths', '/users', 'delete'])

      const removed = document.removeItem(stackTrail)

      assertEquals(removed, undefined)
    })
  })

  await t.step('removeItem() - components removal', async (t) => {
    await t.step('should remove existing schema from components', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['components', 'schemas', 'User'])

      const removed = document.removeItem(stackTrail)

      assertExists(removed)
    })

    await t.step('should return undefined for non-existent schema', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['components', 'schemas', 'NonExistent'])

      const removed = document.removeItem(stackTrail)

      assertEquals(removed, undefined)
    })

    await t.step('should throw error when third element is number', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['components', 'schemas', 123 as any])

      assertThrows(
        () => document.removeItem(stackTrail),
        Error,
        'RefName cannot be a number: 123'
      )
    })

    await t.step('should handle removal from components', () => {
      const document = new OasDocument(createFullFields())
      const initialSize = Object.keys(document.components?.schemas ?? {}).length
      const stackTrail = new StackTrail(['components', 'schemas', 'Post'])

      const removed = document.removeItem(stackTrail)

      assertExists(removed)
      assertEquals(Object.keys(document.components?.schemas ?? {}).length, initialSize - 1)
    })

    await t.step('should handle case when components exists', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['components', 'schemas', 'User'])

      const removed = document.removeItem(stackTrail)

      assertExists(removed)
    })
  })

  await t.step('removeItem() - error cases', async (t) => {
    await t.step('should throw error for invalid first element', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['invalid', 'path', 'element'])

      assertThrows(
        () => document.removeItem(stackTrail),
        Error,
        'Unexpected stack trail'
      )
    })

    await t.step('should include stack trail in error message', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['unknown', 'test', 'path'])

      assertThrows(
        () => document.removeItem(stackTrail),
        Error,
        'unknown'
      )
    })

    await t.step('should handle edge case stack trails', () => {
      const document = new OasDocument(createFullFields())
      const stackTrail = new StackTrail(['info'])

      assertThrows(
        () => document.removeItem(stackTrail),
        Error
      )
    })
  })

  await t.step('toJSON() method', async (t) => {
    await t.step('should return object with all required fields', () => {
      const document = new OasDocument(createMinimalFields())

      const json = document.toJSON()

      assertExists(json)
      assertEquals((json as any).openapi, '3.0.0')
      assertExists((json as any).info)
      assertExists((json as any).operations)
    })

    await t.step('should include undefined optional fields', () => {
      const document = new OasDocument(createMinimalFields())

      const json = document.toJSON()

      assertEquals((json as any).servers, undefined)
      assertEquals((json as any).components, undefined)
      assertEquals((json as any).tags, undefined)
      assertEquals((json as any).security, undefined)
    })

    await t.step('should spread extension fields at root level', () => {
      const document = new OasDocument(createFullFields())

      const json = document.toJSON()

      assertEquals((json as any)['x-custom'], 'value')
      assertEquals((json as any)['x-internal'], true)
    })

    await t.step('should output all fields for full document', () => {
      const document = createDocumentWithSecurity()

      const json = document.toJSON()

      assertEquals((json as any).openapi, '3.1.0')
      assertExists((json as any).info)
      assertExists((json as any).servers)
      assertExists((json as any).operations)
      assertExists((json as any).components)
      assertExists((json as any).tags)
      assertExists((json as any).security)
      assertEquals((json as any)['x-custom'], 'value')
    })

    await t.step('should produce valid structure', () => {
      const document = new OasDocument(createFullFields())

      const json = document.toJSON()

      // Verify structure
      assertEquals(typeof json, 'object')
      assertEquals(typeof (json as any).openapi, 'string')
      assertEquals(typeof (json as any).info, 'object')
      assertEquals(Array.isArray((json as any).operations), true)
    })
  })

  await t.step('integration tests', async (t) => {
    await t.step('complete document lifecycle', () => {
      // Create empty document
      const document = new OasDocument()

      // Set fields
      document.fields = createFullFields()

      // Access properties
      assertEquals(document.openapi, '3.1.0')
      assertEquals(document.operations.length, 3)

      // Remove an operation
      const removed = document.removeItem(new StackTrail(['paths', '/users', 'post']))
      assertExists(removed)

      // Verify removal
      assertEquals(document.operations.length, 2)

      // Convert to JSON
      const json = document.toJSON()
      assertExists(json)
    })

    await t.step('document with all fields populated', () => {
      const document = createDocumentWithSecurity()

      assertEquals(document.openapi, '3.1.0')
      assertEquals(document.info.title, 'Full Test API')
      assertEquals(document.servers?.length, 1)
      assertEquals(document.operations.length, 3)
      assertExists(document.components)
      assertEquals(document.tags?.length, 2)
      assertEquals(document.security?.length, 1)
      assertExists(document.extensionFields)
      assertExists(document.externalDocs)
    })

    await t.step('document with only required fields', () => {
      const document = new OasDocument(createMinimalFields())

      assertEquals(document.openapi, '3.0.0')
      assertEquals(document.info.title, 'Test API')
      assertEquals(document.operations.length, 0)
      assertEquals(document.servers, undefined)
      assertEquals(document.components, undefined)
      assertEquals(document.tags, undefined)
      assertEquals(document.security, undefined)
      assertEquals(document.extensionFields, undefined)
      assertEquals(document.externalDocs, undefined)
    })

    await t.step('document with empty operations array', () => {
      const fields = createMinimalFields()
      fields.operations = []
      const document = new OasDocument(fields)

      assertEquals(document.operations.length, 0)

      const removed = document.removeItem(new StackTrail(['paths', '/test', 'get']))
      assertEquals(removed, undefined)
    })

    await t.step('document with no components', () => {
      const fields = createMinimalFields()
      const document = new OasDocument(fields)

      assertEquals(document.components, undefined)
    })

    await t.step('complex nested structure operations and schemas', () => {
      const document = new OasDocument(createFullFields())

      // Access nested operations
      const operations = document.operations
      assertEquals(operations.length, 3)
      assertEquals(operations[0].path, '/users')

      // Access nested components
      const schemas = document.components?.schemas
      assertExists(schemas)
      assertEquals(Object.keys(schemas).length, 2)

      // Remove and verify
      document.removeItem(new StackTrail(['paths', '/users', 'get']))
      assertEquals(document.operations.length, 2)

      document.removeItem(new StackTrail(['components', 'schemas', 'User']))
      assertEquals(Object.keys(document.components?.schemas ?? {}).length, 1)
    })
  })
})
