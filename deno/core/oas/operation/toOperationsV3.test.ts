import { assertEquals } from 'jsr:@std/assert@^1.0.10'
import { mockParseContext } from '../../test/mockParseContext.ts'
import { toOperationsV3 } from './toOperationsV3.ts'
import { mockPaths } from './mocks.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasOperation } from './Operation.ts'
import { OasPathItem } from '../pathItem/PathItem.ts'
import { OasResponse } from '../response/Response.ts'
import { OasRequestBody } from '../requestBody/RequestBody.ts'
import { OasParameter } from '../parameter/Parameter.ts'
import { OasInteger } from '../integer/Integer.ts' // Assuming this is where OasInteger is imported
import { OasMediaType } from '../mediaType/MediaType.ts'
import { OasDocument } from '../document/Document.ts'
import { OasObject } from '../object/Object.ts'
import { OasInfo } from '../info/Info.ts'
import { OasRef } from '../ref/Ref.ts'

Deno.test('Parse operations', () => {
  const operations = toOperationsV3({
    paths: mockPaths,
    context: mockParseContext as unknown as ParseContext
  })

  assertEquals(
    JSON.stringify(operations, null, 2),
    JSON.stringify(
      [
        new OasOperation({
          path: '/store/inventory',
          method: 'get',
          description: 'Returns a map of status codes to quantities',
          operationId: 'getInventory',
          pathItem: new OasPathItem(),
          responses: {
            '200': new OasResponse({
              content: {
                'application/json': new OasMediaType({
                  mediaType: 'application/json',
                  schema: new OasObject({
                    additionalProperties: new OasInteger({
                      format: 'int32',
                      nullable: undefined
                    }),
                    nullable: undefined
                  })
                })
              },
              description: 'successful operation'
            })
          },
          summary: 'Returns pet inventories by status',
          tags: ['store']
        }),
        new OasOperation({
          path: '/store/order',
          method: 'post',
          description: 'Place a new order in the store',
          operationId: 'placeOrder',
          pathItem: new OasPathItem(),
          requestBody: new OasRequestBody({
            content: {
              'application/json': new OasMediaType({
                mediaType: 'application/json',
                schema: new OasRef(
                  {
                    refType: 'schema',
                    $ref: '#/components/schemas/Order'
                  },
                  new OasDocument({
                    openapi: '3.0.0',
                    info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                    operations: []
                  })
                )
              }),
              'application/xml': new OasMediaType({
                mediaType: 'application/xml',
                schema: new OasRef(
                  {
                    refType: 'schema',
                    $ref: '#/components/schemas/Order'
                  },
                  new OasDocument({
                    openapi: '3.0.0',
                    info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                    operations: []
                  })
                )
              }),
              'application/x-www-form-urlencoded': new OasMediaType({
                mediaType: 'application/x-www-form-urlencoded',
                schema: new OasRef(
                  {
                    refType: 'schema',
                    $ref: '#/components/schemas/Order'
                  },
                  new OasDocument({
                    openapi: '3.0.0',
                    info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                    operations: []
                  })
                )
              })
            }
          }),
          responses: {
            '200': new OasResponse({
              description: 'successful operation',
              content: {
                'application/json': new OasMediaType({
                  mediaType: 'application/json',
                  schema: new OasRef(
                    {
                      refType: 'schema',
                      $ref: '#/components/schemas/Order'
                    },
                    new OasDocument({
                      openapi: '3.0.0',
                      info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                      operations: []
                    })
                  )
                })
              }
            }),
            '405': new OasResponse({
              description: 'Invalid input'
            })
          },
          summary: 'Place an order for a pet',
          tags: ['store']
        }),
        new OasOperation({
          path: '/store/order/{orderId}',
          method: 'get',
          description:
            'For valid response try integer IDs with value <= 5 or > 10. Other values will generate exceptions.',
          operationId: 'getOrderById',
          parameters: [
            new OasParameter({
              name: 'orderId',
              location: 'path',
              description: 'ID of order that needs to be fetched',
              required: true,
              style: 'simple',
              explode: false,
              schema: new OasInteger({
                format: 'int64',
                nullable: undefined
              })
            })
          ],
          pathItem: new OasPathItem(),
          responses: {
            '200': new OasResponse({
              content: {
                'application/xml': new OasMediaType({
                  mediaType: 'application/xml',
                  schema: new OasRef(
                    {
                      refType: 'schema',
                      $ref: '#/components/schemas/Order'
                    },
                    new OasDocument({
                      openapi: '3.0.0',
                      info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                      operations: []
                    })
                  )
                }),
                'application/json': new OasMediaType({
                  mediaType: 'application/json',
                  schema: new OasRef(
                    {
                      refType: 'schema',
                      $ref: '#/components/schemas/Order'
                    },
                    new OasDocument({
                      openapi: '3.0.0',
                      info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                      operations: []
                    })
                  )
                })
              },
              description: 'successful operation'
            }),
            '400': new OasResponse({
              description: 'Invalid ID supplied'
            }),
            '404': new OasResponse({
              description: 'Order not found'
            })
          },
          summary: 'Find purchase order by ID',
          tags: ['store']
        }),
        new OasOperation({
          description:
            'For valid response try integer IDs with value < 1000. Anything above 1000 or nonintegers will generate API errors',
          method: 'delete',
          operationId: 'deleteOrder',
          parameters: [
            new OasParameter({
              name: 'orderId',
              location: 'path',
              description: 'ID of the order that needs to be deleted',
              required: true,
              style: 'simple',
              explode: false,
              schema: new OasInteger({
                format: 'int64',
                nullable: undefined
              })
            })
          ],
          path: '/store/order/{orderId}',
          pathItem: new OasPathItem(),
          requestBody: undefined,
          responses: {
            '400': new OasResponse({
              description: 'Invalid ID supplied'
            }),
            '404': new OasResponse({
              description: 'Order not found'
            })
          },
          summary: 'Delete purchase order by ID',
          tags: ['store']
        })
      ],
      null,
      2
    )
  )
})
