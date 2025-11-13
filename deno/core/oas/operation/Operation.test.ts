import { assertEquals, assertExists } from '@std/assert'
import { OasOperation } from './Operation.ts'
import { OasParameter } from '../parameter/Parameter.ts'
import { OasRequestBody } from '../requestBody/RequestBody.ts'
import { OasResponse } from '../response/Response.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'
import { OasString } from '../string/String.ts'
import { OasInteger } from '../integer/Integer.ts'
import { OasObject } from '../object/Object.ts'
import { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'
import { OasServer } from '../server/Server.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'

// Helper to create basic ToJsonSchemaOptions
const createMockOptions = (): ToJsonSchemaOptions => ({
  resolve: false,
})

Deno.test('OasOperation', async (t) => {
  await t.step('constructor and property initialization', async (t) => {
    await t.step('should initialize with all properties provided', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        operationId: 'getUser',
        summary: 'Get user by ID',
        tags: ['users', 'accounts'],
        description: 'Retrieves a single user by their unique identifier',
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
        ],
        requestBody: new OasRequestBody({
          description: 'User data',
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: new OasObject(),
            }),
          },
        }),
        responses: {
          '200': new OasResponse({
            description: 'Success',
          }),
        },
        security: undefined,
        deprecated: false,
        externalDocs: new OasExternalDocs({
          url: 'https://docs.example.com',
        }),
        extensionFields: { 'x-custom': 'value' },
        servers: [
          new OasServer({
            url: 'https://api.example.com',
          }),
        ],
      })

      assertEquals(operation.oasType, 'operation')
      assertEquals(operation.path, '/users/{id}')
      assertEquals(operation.method, 'get')
      assertEquals(operation.operationId, 'getUser')
      assertEquals(operation.summary, 'Get user by ID')
      assertEquals(operation.tags, ['users', 'accounts'])
      assertEquals(operation.description, 'Retrieves a single user by their unique identifier')
      assertEquals(operation.parameters?.length, 1)
      assertExists(operation.requestBody)
      assertEquals(Object.keys(operation.responses).length, 1)
      assertEquals(operation.security, undefined)
      assertEquals(operation.deprecated, false)
      assertExists(operation.externalDocs)
      assertEquals(operation.extensionFields, { 'x-custom': 'value' })
      assertEquals(operation.servers?.length, 1)
    })

    await t.step('should initialize with minimal required properties (path, method, responses)', () => {
      const operation = new OasOperation({
        path: '/health',
        method: 'get',
        pathItem: undefined,
        responses: {},
      })

      assertEquals(operation.oasType, 'operation')
      assertEquals(operation.path, '/health')
      assertEquals(operation.method, 'get')
      assertEquals(operation.responses, {})
      assertEquals(operation.operationId, undefined)
      assertEquals(operation.summary, undefined)
      assertEquals(operation.tags, undefined)
      assertEquals(operation.description, undefined)
      assertEquals(operation.parameters, undefined)
      assertEquals(operation.requestBody, undefined)
      assertEquals(operation.security, undefined)
      assertEquals(operation.deprecated, undefined)
      assertEquals(operation.externalDocs, undefined)
      assertEquals(operation.extensionFields, undefined)
      assertEquals(operation.servers, undefined)
    })

    await t.step('should handle optional properties correctly', () => {
      const operation = new OasOperation({
        path: '/products',
        method: 'post',
        pathItem: undefined,
        operationId: 'createProduct',
        summary: 'Create a product',
        responses: {
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      assertEquals(operation.operationId, 'createProduct')
      assertEquals(operation.summary, 'Create a product')
      assertEquals(operation.description, undefined)
      assertEquals(operation.tags, undefined)
    })

    await t.step('should handle parameters array', () => {
      const operation = new OasOperation({
        path: '/search',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'q',
            location: 'query',
            required: false,
            schema: new OasString(),
            style: 'form',
            explode: true,
          }),
          new OasParameter({
            name: 'limit',
            location: 'query',
            required: false,
            schema: new OasInteger(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      assertEquals(operation.parameters?.length, 2)
      assertEquals(operation.parameters?.[0].resolve().name, 'q')
      assertEquals(operation.parameters?.[1].resolve().name, 'limit')
    })

    await t.step('should handle requestBody property', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          required: true,
          description: 'User to create',
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: new OasObject(),
            }),
          },
        }),
        responses: {
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      assertExists(operation.requestBody)
      assertEquals(operation.requestBody.resolve().required, true)
      assertEquals(operation.requestBody.resolve().description, 'User to create')
    })

    await t.step('should handle responses object with multiple status codes', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {
          '200': new OasResponse({ description: 'Success' }),
          '404': new OasResponse({ description: 'Not Found' }),
          '500': new OasResponse({ description: 'Server Error' }),
        },
      })

      assertEquals(Object.keys(operation.responses).length, 3)
      assertEquals(operation.responses['200'].resolve().description, 'Success')
      assertEquals(operation.responses['404'].resolve().description, 'Not Found')
      assertEquals(operation.responses['500'].resolve().description, 'Server Error')
    })

    await t.step('should handle security requirements', () => {
      const operation = new OasOperation({
        path: '/admin/users',
        method: 'get',
        pathItem: undefined,
        security: undefined,
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      assertEquals(operation.security, undefined)
    })

    await t.step('should handle extension fields (x-* properties)', () => {
      const extensionFields = {
        'x-rate-limit': 100,
        'x-category': 'user-management',
        'x-metadata': { version: '1.0' },
      }

      const operation = new OasOperation({
        path: '/api/resource',
        method: 'get',
        pathItem: undefined,
        extensionFields,
        responses: {},
      })

      assertEquals(operation.extensionFields, extensionFields)
      assertEquals(operation.extensionFields?.['x-rate-limit'], 100)
      assertEquals(operation.extensionFields?.['x-category'], 'user-management')
    })
  })

  await t.step('toSuccessResponse() method', async (t) => {
    await t.step('should return lowest 2xx response (200 over 201, 204)', () => {
      const response200 = new OasResponse({ description: 'OK' })
      const response201 = new OasResponse({ description: 'Created' })
      const response204 = new OasResponse({ description: 'No Content' })

      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        responses: {
          '204': response204,
          '200': response200,
          '201': response201,
        },
      })

      const successResponse = operation.toSuccessResponse()
      assertEquals(successResponse, response200)
    })

    await t.step('should handle multiple 2xx responses correctly', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        responses: {
          '201': new OasResponse({ description: 'Created' }),
          '202': new OasResponse({ description: 'Accepted' }),
          '204': new OasResponse({ description: 'No Content' }),
        },
      })

      const successResponse = operation.toSuccessResponse()
      assertEquals(successResponse?.resolve().description, 'Created')
    })

    await t.step('should fall back to "default" response when no 2xx exists', () => {
      const defaultResponse = new OasResponse({ description: 'Default response' })

      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '400': new OasResponse({ description: 'Bad Request' }),
          '404': new OasResponse({ description: 'Not Found' }),
          'default': defaultResponse,
        },
      })

      const successResponse = operation.toSuccessResponse()
      assertEquals(successResponse, defaultResponse)
    })

    await t.step('should return undefined when no success or default response', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'delete',
        pathItem: undefined,
        responses: {
          '404': new OasResponse({ description: 'Not Found' }),
          '500': new OasResponse({ description: 'Server Error' }),
        },
      })

      const successResponse = operation.toSuccessResponse()
      assertEquals(successResponse, undefined)
    })

    await t.step('should handle only error responses (4xx, 5xx)', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '400': new OasResponse({ description: 'Bad Request' }),
          '401': new OasResponse({ description: 'Unauthorized' }),
          '403': new OasResponse({ description: 'Forbidden' }),
          '500': new OasResponse({ description: 'Server Error' }),
        },
      })

      const successResponse = operation.toSuccessResponse()
      assertEquals(successResponse, undefined)
    })
  })

  await t.step('toSuccessResponseCode() method', async (t) => {
    await t.step('should return lowest 2xx status code as string', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      const code = operation.toSuccessResponseCode()
      assertEquals(code, '200')
    })

    await t.step('should handle multiple 2xx codes (200, 201, 204)', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        responses: {
          '204': new OasResponse({ description: 'No Content' }),
          '200': new OasResponse({ description: 'OK' }),
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      const code = operation.toSuccessResponseCode()
      assertEquals(code, '200')
    })

    await t.step('should return "default" when no 2xx exists', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '400': new OasResponse({ description: 'Bad Request' }),
          'default': new OasResponse({ description: 'Default' }),
        },
      })

      const code = operation.toSuccessResponseCode()
      assertEquals(code, 'default')
    })

    await t.step('should return undefined when no responses match', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '404': new OasResponse({ description: 'Not Found' }),
        },
      })

      const code = operation.toSuccessResponseCode()
      assertEquals(code, undefined)
    })

    await t.step('should ignore 4xx and 5xx codes', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {
          '400': new OasResponse({ description: 'Bad Request' }),
          '404': new OasResponse({ description: 'Not Found' }),
          '500': new OasResponse({ description: 'Server Error' }),
          '503': new OasResponse({ description: 'Service Unavailable' }),
        },
      })

      const code = operation.toSuccessResponseCode()
      assertEquals(code, undefined)
    })
  })

  await t.step('toRequestBody() method', async (t) => {
    await t.step('should map request body schema using provided function', () => {
      const schema = new OasString({ minLength: 1 })
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema,
            }),
          },
        }),
        responses: {},
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      })

      assertEquals(result, 'string')
    })

    await t.step('should use "application/json" as default media type', () => {
      const schema = new OasInteger({ minimum: 0 })
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema,
            }),
          },
        }),
        responses: {},
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      })

      assertEquals(result, 'integer')
    })

    await t.step('should handle custom media types', () => {
      const schema = new OasObject()
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          content: {
            'application/xml': new OasMediaType({
              mediaType: 'application/xml',
              schema,
            }),
          },
        }),
        responses: {},
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      }, 'application/xml')

      assertEquals(result, 'object')
    })

    await t.step('should resolve OasRef references', () => {
      const schema = new OasString({ pattern: '^[A-Z]+$' })
      const requestBody = new OasRequestBody({
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json',
            schema,
          }),
        },
      })

      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        requestBody,
        responses: {},
      })

      const result = operation.toRequestBody(({ requestBody }) => {
        return requestBody.required ?? false
      })

      assertEquals(result, false)
    })

    await t.step('should return undefined when no request body', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {},
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      })

      assertEquals(result, undefined)
    })

    await t.step('should return undefined when media type not found', () => {
      const operation = new OasOperation({
        path: '/test',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: new OasString(),
            }),
          },
        }),
        responses: {},
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      }, 'application/xml')

      assertEquals(result, undefined)
    })
  })

  await t.step('toParams() method', async (t) => {
    await t.step('should return all resolved parameters', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'fields',
            location: 'query',
            required: false,
            schema: new OasString(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const params = operation.toParams()
      assertEquals(params.length, 2)
      assertEquals(params[0].name, 'id')
      assertEquals(params[1].name, 'fields')
    })

    await t.step('should filter by location (query)', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'limit',
            location: 'query',
            required: false,
            schema: new OasInteger(),
            style: 'form',
            explode: true,
          }),
          new OasParameter({
            name: 'offset',
            location: 'query',
            required: false,
            schema: new OasInteger(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const params = operation.toParams(['query'])
      assertEquals(params.length, 2)
      assertEquals(params[0].name, 'limit')
      assertEquals(params[1].name, 'offset')
    })

    await t.step('should filter by location (path, header)', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'Authorization',
            location: 'header',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'limit',
            location: 'query',
            required: false,
            schema: new OasInteger(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const params = operation.toParams(['path', 'header'])
      assertEquals(params.length, 2)
      assertEquals(params[0].location, 'path')
      assertEquals(params[1].location, 'header')
    })

    await t.step('should handle empty parameters array', () => {
      const operation = new OasOperation({
        path: '/health',
        method: 'get',
        pathItem: undefined,
        parameters: [],
        responses: {},
      })

      const params = operation.toParams()
      assertEquals(params.length, 0)
      assertEquals(Array.isArray(params), true)
    })

    await t.step('should handle undefined parameters', () => {
      const operation = new OasOperation({
        path: '/health',
        method: 'get',
        pathItem: undefined,
        responses: {},
      })

      const params = operation.toParams()
      assertEquals(params.length, 0)
      assertEquals(Array.isArray(params), true)
    })
  })

  await t.step('toParametersObject() method', async (t) => {
    await t.step('should create OasObject from parameters', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'fields',
            location: 'query',
            required: false,
            schema: new OasString(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const paramsObject = operation.toParametersObject()
      assertEquals(paramsObject.type, 'object')
      assertExists(paramsObject.properties)
      assertEquals(paramsObject.properties?.id !== undefined, true)
      assertEquals(paramsObject.properties?.fields !== undefined, true)
    })

    await t.step('should respect required parameter fields', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'optional',
            location: 'query',
            required: false,
            schema: new OasString(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const paramsObject = operation.toParametersObject()
      assertEquals(paramsObject.required?.includes('id'), true)
      assertEquals(paramsObject.required?.includes('optional'), false)
    })

    await t.step('should filter parameters by location', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'limit',
            location: 'query',
            required: false,
            schema: new OasInteger(),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const paramsObject = operation.toParametersObject(['query'])
      assertEquals(paramsObject.properties?.id, undefined)
      assertExists(paramsObject.properties?.limit)
    })

    await t.step('should handle empty parameters', () => {
      const operation = new OasOperation({
        path: '/health',
        method: 'get',
        pathItem: undefined,
        parameters: [],
        responses: {},
      })

      const paramsObject = operation.toParametersObject()
      assertEquals(paramsObject.type, 'object')
      assertEquals(Object.keys(paramsObject.properties ?? {}).length, 0)
    })

    await t.step('should map parameter names to properties correctly', () => {
      const operation = new OasOperation({
        path: '/search',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'query',
            location: 'query',
            required: true,
            schema: new OasString({ minLength: 1 }),
            style: 'form',
            explode: true,
          }),
          new OasParameter({
            name: 'page',
            location: 'query',
            required: false,
            schema: new OasInteger({ minimum: 1 }),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {},
      })

      const paramsObject = operation.toParametersObject()
      assertExists(paramsObject.properties?.query)
      assertExists(paramsObject.properties?.page)
    })
  })

  await t.step('toJsonSchema() method', async (t) => {
    await t.step('should convert to OpenAPI v3 OperationObject format', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        operationId: 'listUsers',
        summary: 'List all users',
        description: 'Returns a list of all users in the system',
        tags: ['users'],
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertEquals(result.operationId, 'listUsers')
      assertEquals(result.summary, 'List all users')
      assertEquals(result.description, 'Returns a list of all users in the system')
      assertEquals(result.tags, ['users'])
      assertExists(result.responses)
    })

    await t.step('should include all standard properties', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'post',
        pathItem: undefined,
        operationId: 'createUser',
        summary: 'Create user',
        description: 'Create a new user',
        tags: ['users'],
        deprecated: true,
        responses: {
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertEquals(result.operationId, 'createUser')
      assertEquals(result.summary, 'Create user')
      assertEquals(result.description, 'Create a new user')
      assertEquals(result.tags, ['users'])
      assertEquals(result.deprecated, true)
    })

    await t.step('should convert nested parameters to JSON schema', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            schema: new OasString(),
            style: 'simple',
            explode: false,
          }),
        ],
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertExists(result.parameters)
      assertEquals(Array.isArray(result.parameters), true)
      assertEquals(result.parameters?.length, 1)
    })

    await t.step('should convert requestBody to JSON schema', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          required: true,
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: new OasObject(),
            }),
          },
        }),
        responses: {
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertExists(result.requestBody)
      assertEquals(typeof result.requestBody, 'object')
    })

    await t.step('should convert responses to JSON schema', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {
          '200': new OasResponse({ description: 'Success' }),
          '404': new OasResponse({ description: 'Not Found' }),
          '500': new OasResponse({ description: 'Server Error' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertExists(result.responses)
      assertEquals(Object.keys(result.responses).length, 3)
      assertExists(result.responses['200'])
      assertExists(result.responses['404'])
      assertExists(result.responses['500'])
    })

    await t.step('should include extension fields', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        extensionFields: {
          'x-rate-limit': 100,
          'x-scope': 'public',
        },
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      const result = operation.toJsonSchema(createMockOptions())

      assertEquals((result as Record<string, unknown>)['x-rate-limit'], 100)
      assertEquals((result as Record<string, unknown>)['x-scope'], 'public')
    })
  })

  await t.step('property handling', async (t) => {
    await t.step('should handle HTTP method variations', () => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const

      methods.forEach((method) => {
        const operation = new OasOperation({
          path: '/test',
          method,
          pathItem: undefined,
          responses: {},
        })

        assertEquals(operation.method, method)
      })
    })

    await t.step('should handle path with parameters', () => {
      const paths = [
        '/users/{id}',
        '/posts/{postId}/comments/{commentId}',
        '/api/v1/resources/{resourceId}',
        '/organizations/{orgId}/projects/{projectId}/tasks/{taskId}',
      ]

      paths.forEach((path) => {
        const operation = new OasOperation({
          path,
          method: 'get',
          pathItem: undefined,
          responses: {},
        })

        assertEquals(operation.path, path)
      })
    })

    await t.step('should handle tags array', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        tags: ['users', 'accounts', 'public'],
        responses: {},
      })

      assertEquals(operation.tags?.length, 3)
      assertEquals(operation.tags?.[0], 'users')
      assertEquals(operation.tags?.[1], 'accounts')
      assertEquals(operation.tags?.[2], 'public')
    })

    await t.step('should handle deprecated flag', () => {
      const deprecatedOperation = new OasOperation({
        path: '/old-endpoint',
        method: 'get',
        pathItem: undefined,
        deprecated: true,
        responses: {},
      })

      const activeOperation = new OasOperation({
        path: '/new-endpoint',
        method: 'get',
        pathItem: undefined,
        deprecated: false,
        responses: {},
      })

      assertEquals(deprecatedOperation.deprecated, true)
      assertEquals(activeOperation.deprecated, false)
    })

    await t.step('should handle externalDocs property', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        externalDocs: new OasExternalDocs({
          url: 'https://docs.example.com/users',
          description: 'User API documentation',
        }),
        responses: {},
      })

      assertExists(operation.externalDocs)
      assertEquals(operation.externalDocs.url, 'https://docs.example.com/users')
      assertEquals(operation.externalDocs.description, 'User API documentation')
    })

    await t.step('should handle servers array', () => {
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        servers: [
          new OasServer({ url: 'https://api.example.com' }),
          new OasServer({ url: 'https://api-staging.example.com' }),
        ],
        responses: {},
      })

      assertEquals(operation.servers?.length, 2)
      assertEquals(operation.servers?.[0].url, 'https://api.example.com')
      assertEquals(operation.servers?.[1].url, 'https://api-staging.example.com')
    })
  })

  await t.step('edge cases and integration', async (t) => {
    await t.step('should handle operation with no parameters or requestBody', () => {
      const operation = new OasOperation({
        path: '/health',
        method: 'get',
        pathItem: undefined,
        responses: {
          '200': new OasResponse({ description: 'Healthy' }),
        },
      })

      assertEquals(operation.parameters, undefined)
      assertEquals(operation.requestBody, undefined)
      assertEquals(operation.toParams().length, 0)
    })

    await t.step('should handle operation with security requirements', () => {
      const operation = new OasOperation({
        path: '/admin/dashboard',
        method: 'get',
        pathItem: undefined,
        security: undefined,
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      assertEquals(operation.security, undefined)
    })

    await t.step('should work with realistic REST API scenarios', () => {
      // GET operation with query parameters
      const listOperation = new OasOperation({
        path: '/api/v1/users',
        method: 'get',
        pathItem: undefined,
        operationId: 'listUsers',
        summary: 'List users',
        tags: ['Users'],
        parameters: [
          new OasParameter({
            name: 'page',
            location: 'query',
            schema: new OasInteger({ minimum: 1, default: 1 }),
            style: 'form',
            explode: true,
          }),
          new OasParameter({
            name: 'limit',
            location: 'query',
            schema: new OasInteger({ minimum: 1, maximum: 100, default: 20 }),
            style: 'form',
            explode: true,
          }),
        ],
        responses: {
          '200': new OasResponse({
            description: 'List of users',
            content: {
              'application/json': new OasMediaType({
                mediaType: 'application/json',
                schema: new OasObject(),
              }),
            },
          }),
        },
      })

      // POST operation with request body
      const createOperation = new OasOperation({
        path: '/api/v1/users',
        method: 'post',
        pathItem: undefined,
        operationId: 'createUser',
        summary: 'Create user',
        tags: ['Users'],
        requestBody: new OasRequestBody({
          required: true,
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: new OasObject(),
            }),
          },
        }),
        responses: {
          '201': new OasResponse({ description: 'User created' }),
          '400': new OasResponse({ description: 'Invalid input' }),
        },
      })

      assertEquals(listOperation.toParams().length, 2)
      assertEquals(createOperation.toSuccessResponseCode(), '201')
    })

    await t.step('should handle operations with complex nested schemas', () => {
      const complexSchema = new OasObject({
        properties: {
          user: new OasObject({
            properties: {
              id: new OasString(),
              profile: new OasObject({
                properties: {
                  name: new OasString(),
                  age: new OasInteger(),
                },
              }),
            },
          }),
        },
      })

      const operation = new OasOperation({
        path: '/users',
        method: 'post',
        pathItem: undefined,
        requestBody: new OasRequestBody({
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: complexSchema,
            }),
          },
        }),
        responses: {
          '201': new OasResponse({ description: 'Created' }),
        },
      })

      const result = operation.toRequestBody(({ schema }) => {
        return schema.resolve().type
      })

      assertEquals(result, 'object')
    })

    await t.step('should handle pathItem parent reference', () => {
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {
          '200': new OasResponse({ description: 'OK' }),
        },
      })

      assertEquals(operation.pathItem, undefined)
      assertEquals(operation.path, '/users/{id}')
    })
  })
})
