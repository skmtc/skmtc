export const mockOpenAPISchema = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths: {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['id', 'name']
      }
    }
  }
}

export const mockOpenAPISchemaString = JSON.stringify(mockOpenAPISchema, null, 2)
