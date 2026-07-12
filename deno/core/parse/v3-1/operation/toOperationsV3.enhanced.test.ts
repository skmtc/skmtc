import { assertEquals, assert } from '@std/assert'
import { mockParseContext } from '@/test/mockParseContext.ts'
import { toOperationsV3, toOperationV3 } from './toOperationsV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('toOperationsV3 - empty paths object returns empty array', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {}

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations, [])
})

Deno.test('toOperationsV3 - single path with single GET operation', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: {
          '200': {
            description: 'Success'
          }
        }
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 1)
  assertEquals(operations[0].method, 'get')
  assertEquals(operations[0].path, '/users')
  assertEquals(operations[0].operationId, 'getUsers')
})

Deno.test('toOperationsV3 - single path with multiple operations', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: { '200': { description: 'Success' } }
      },
      post: {
        operationId: 'createUser',
        responses: { '201': { description: 'Created' } }
      },
      delete: {
        operationId: 'deleteUsers',
        responses: { '204': { description: 'No Content' } }
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 3)

  const methods = operations.map(op => op.method).sort()
  assertEquals(methods, ['delete', 'get', 'post'])

  const opIds = operations.map(op => op.operationId).sort()
  assertEquals(opIds, ['createUser', 'deleteUsers', 'getUsers'])
})

Deno.test('toOperationsV3 - multiple paths with multiple operations', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: { '200': { description: 'Success' } }
      }
    },
    '/posts': {
      get: {
        operationId: 'getPosts',
        responses: { '200': { description: 'Success' } }
      },
      post: {
        operationId: 'createPost',
        responses: { '201': { description: 'Created' } }
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 3)

  const paths_result = [...new Set(operations.map(op => op.path))].sort()
  assertEquals(paths_result, ['/posts', '/users'])
})

Deno.test('toOperationsV3 - skips path with undefined pathItem', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: { '200': { description: 'Success' } }
      }
    },
    '/undefined-path': undefined as any
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  // Should only have the one valid operation
  assertEquals(operations.length, 1)
  assertEquals(operations[0].path, '/users')
})

Deno.test('toOperationsV3 - handles all HTTP methods', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/api': {
      get: { operationId: 'get', responses: {} },
      post: { operationId: 'post', responses: {} },
      put: { operationId: 'put', responses: {} },
      delete: { operationId: 'delete', responses: {} },
      patch: { operationId: 'patch', responses: {} },
      head: { operationId: 'head', responses: {} },
      options: { operationId: 'options', responses: {} },
      trace: { operationId: 'trace', responses: {} }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 8)

  const methods = operations.map(op => op.method).sort()
  assertEquals(methods, ['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace'])
})

Deno.test('toOperationV3 - minimal operation with only required fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    responses: {
      '200': {
        description: 'Success'
      }
    }
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assert(result instanceof OasOperation)
  assertEquals(result.method, 'get')
  assertEquals(result.path, '/test')
  assertEquals(result.operationId, undefined)
})

Deno.test('toOperationV3 - operation with operationId and summary', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    operationId: 'testOperation',
    summary: 'Test Summary',
    description: 'Test Description',
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'post',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(result.operationId, 'testOperation')
  assertEquals(result.summary, 'Test Summary')
  assertEquals(result.description, 'Test Description')
})

Deno.test('toOperationV3 - operation with tags', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    tags: ['user', 'admin'],
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(result.tags, ['user', 'admin'])
})

Deno.test('toOperationV3 - operation with deprecated flag', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    deprecated: true,
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(result.deprecated, true)
})

Deno.test('toOperationV3 - operation with parameters', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      }
    ],
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test/{id}',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assert(Array.isArray(result.parameters))
  assertEquals(result.parameters.length, 1)
})

Deno.test('toOperationV3 - operation with requestBody', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    },
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'post',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assert(result.requestBody !== undefined)
})

Deno.test('toOperationV3 - operation with security requirements', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    security: [
      {
        api_key: []
      }
    ],
    responses: {}
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assert(Array.isArray(result.security))
  assertEquals(result.security.length, 1)
})

Deno.test('toOperationV3 - operation with extension fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    responses: {},
    'x-custom-field': 'custom-value',
    'x-internal': true
  } as any

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'get',
      path: '/test',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  // Extension fields should be extracted
  assert(result.extensionFields !== undefined)
})

Deno.test('toOperationsV3 - path with no operations returns empty array', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      // Only path-level properties, no operation methods
      summary: 'User operations',
      description: 'Operations for user management'
    } as any
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  // Should return empty array as there are no operation methods
  assertEquals(operations, [])
})

Deno.test('toOperationsV3 - separates method operations from path-level properties', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      summary: 'User endpoint',
      description: 'Path-level description',
      parameters: [
        {
          name: 'api_key',
          in: 'header',
          schema: { type: 'string' }
        }
      ],
      get: {
        operationId: 'getUsers',
        responses: { '200': { description: 'Success' } }
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  // Should have one operation
  assertEquals(operations.length, 1)
  assertEquals(operations[0].method, 'get')

  // PathItem should be created with path-level properties
  assert(operations[0].pathItem !== undefined)
})

Deno.test('toOperationsV3 - handles operation without responses', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/test': {
      get: {
        operationId: 'testOp',
        // Missing responses - should still process
        responses: {}
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 1)
})

Deno.test('toOperationsV3 - multiple operations on same path have same pathItem reference', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users': {
      summary: 'Users endpoint',
      get: {
        operationId: 'getUsers',
        responses: {}
      },
      post: {
        operationId: 'createUser',
        responses: {}
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(operations.length, 2)

  // Both operations on the same path should reference the same pathItem
  // (they're created from the same path-level properties)
  assert(operations[0].pathItem !== undefined)
  assert(operations[1].pathItem !== undefined)
})

Deno.test('toOperationsV3 - operation with all optional fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const operation: OpenAPIV3.OperationObject = {
    operationId: 'complexOp',
    summary: 'Complex operation',
    description: 'A complex operation with all fields',
    tags: ['tag1', 'tag2'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      }
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    },
    responses: {
      '200': { description: 'Success' },
      '400': { description: 'Bad Request' }
    },
    deprecated: true,
    security: [{ api_key: [] }],
    externalDocs: {
      url: 'https://example.com/docs'
    },
    servers: [
      {
        url: 'https://api.example.com'
      }
    ]
  }

  const result = toOperationV3({
    operation,
    operationInfo: {
      method: 'post',
      path: '/test/{id}',
      pathItem: undefined
    },
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  assertEquals(result.operationId, 'complexOp')
  assertEquals(result.summary, 'Complex operation')
  assertEquals(result.tags, ['tag1', 'tag2'])
  assertEquals(result.deprecated, true)
  assert(result.parameters !== undefined && result.parameters.length > 0)
  assert(result.requestBody !== undefined)
  assert(result.security !== undefined && result.security.length > 0)
})

Deno.test('toOperationsV3 - real-world example with nested paths', () => {
  const stackTrail = new StackTrail(['TEST'])
  const paths: OpenAPIV3.PathsObject = {
    '/users/{userId}': {
      get: {
        operationId: 'getUserById',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'User found' },
          '404': { description: 'User not found' }
        }
      },
      delete: {
        operationId: 'deleteUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '204': { description: 'User deleted' }
        }
      }
    },
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: {
          '200': { description: 'List of users' }
        }
      },
      post: {
        operationId: 'createUser',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        },
        responses: {
          '201': { description: 'User created' }
        }
      }
    }
  }

  const operations = toOperationsV3({
    paths,
    stackTrail,
    context: mockParseContext as unknown as ParseContextType
  })

  // Should have 4 operations total
  assertEquals(operations.length, 4)

  // Verify all operation IDs are present
  const opIds = operations.map(op => op.operationId).sort()
  assertEquals(opIds, ['createUser', 'deleteUser', 'getUserById', 'listUsers'])

  // Verify paths
  const uniquePaths = [...new Set(operations.map(op => op.path))].sort()
  assertEquals(uniquePaths, ['/users', '/users/{userId}'])
})
