import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { Reach } from '@/parse/Reach.ts'
import { toRefParts } from '@/helpers/refFns.ts'

const schema = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const model = (name: string) => toRefParts({ $ref: `#/components/schemas/${name}` })
const sorted = (keys: readonly string[]) => [...keys].sort()

// Order -> Customer -> Address, and Customer -> Order back: a cycle of two
// with one model below it. Tag stands alone. Receipt is named only in data.
// Invoice is an allOf of Document and its own properties.
const document = {
  openapi: '3.0.3',
  info: { title: 'Reach', version: '1.0.0' },
  paths: {
    '/orders/{id}': {
      parameters: [{ $ref: '#/components/parameters/OrderId' }],
      get: {
        responses: {
          '200': { $ref: '#/components/responses/OrderFound' },
          '404': { description: 'none', content: { 'application/json': { schema: schema('Problem') } } }
        }
      },
      delete: { responses: { '204': { description: 'gone' } } }
    },
    '/tags': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'array', items: schema('Tag') } } }
          }
        }
      }
    },
    '/deep': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order/properties/total' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    parameters: {
      OrderId: { name: 'id', in: 'path', required: true, schema: schema('OrderKey') }
    },
    headers: {
      Trace: { schema: schema('TraceId') }
    },
    responses: {
      OrderFound: {
        description: 'ok',
        headers: { 'X-Trace': { $ref: '#/components/headers/Trace' } },
        content: { 'application/json': { schema: schema('Order') } }
      }
    },
    schemas: {
      Order: {
        type: 'object',
        properties: { customer: schema('Customer'), total: { type: 'object', properties: { tag: schema('Tag') } } },
        example: schema('Receipt')
      },
      Customer: { type: 'object', properties: { address: schema('Address'), last: schema('Order') } },
      Address: { type: 'object' },
      OrderKey: { type: 'string' },
      TraceId: { type: 'string' },
      Problem: { type: 'object' },
      Tag: { type: 'string' },
      Receipt: { type: 'object' },
      Document: { type: 'object', properties: { tag: schema('Tag') } },
      Invoice: { allOf: [schema('Document'), { type: 'object', properties: { address: schema('Address') } }] }
    }
  }
}

/** The reach of a document, as a run gets it: from the parser that read the document. */
const toReach = (value: unknown): Reach => {
  const context = new ParseContext({
    // @ts-expect-error a test document is not typed as an OpenAPI document
    input: { type: 'oas', value },
    logger: log.getLogger('reach-test'),
    silent: true
  })

  // The frames before the document's own are a run's: the reach must not count them.
  context.parse(new StackTrail(['trace', 'parse']))

  return context.toReach()
}

const reach = toReach(document)

Deno.test('Reach - a model reaches itself and every model below it', () => {
  assertEquals(sorted(reach.ofModel(model('Address'))), ['Address'])
  assertEquals(sorted(reach.ofModel(model('Customer'))), ['Address', 'Customer', 'Order', 'Tag'])
})

// Each model of a cycle reaches the whole cycle, wherever the walk starts.
Deno.test('Reach - the models of a cycle reach the same models', () => {
  assertEquals(sorted(reach.ofModel(model('Order'))), sorted(reach.ofModel(model('Customer'))))
})

// The trap: `example: { $ref }` in a schema is data. The parser makes no
// reference of it, so no generator gets from Order to Receipt.
Deno.test('Reach - a $ref in a schema example is not reached from the model', () => {
  assertEquals(reach.ofModel(model('Order')).includes('Receipt'), false)
})

// The trap: the parser merges the allOf of Invoice. A generator then reads
// Document's property on Invoice itself, and so gets to Tag from there. It
// does not get to Document: the merged schema has no reference to it.
Deno.test('Reach - a model reaches what the merged parent of its allOf names, and not the parent', () => {
  assertEquals(sorted(reach.ofModel(model('Invoice'))), ['Address', 'Invoice', 'Tag'])
})

// The trap: an operation's schemas are often behind a component that is no
// schema. The response here is a ref, its header is a ref, and the path
// item's parameter is a ref. Each holds a schema the operation's code uses.
Deno.test('Reach - an operation names the models behind its response, header and parameter components', () => {
  const get = reach.namedByOperation({ path: '/orders/{id}', method: 'get' })

  assertEquals(sorted(get), ['Order', 'OrderKey', 'Problem', 'TraceId'])
})

Deno.test('Reach - an operation names what the parameters of its path item name', () => {
  assertEquals(reach.namedByOperation({ path: '/orders/{id}', method: 'delete' }), ['OrderKey'])
})

// What a named model reaches in turn is `ofModel`'s to give, one time for the model.
Deno.test('Reach - an operation names the models its refs give, not what those reach', () => {
  assertEquals(reach.namedByOperation({ path: '/tags', method: 'get' }), ['Tag'])
  assertEquals(reach.namedByOperation({ path: '/orders/{id}', method: 'get' }).includes('Customer'), false)
})

// A ref into a schema is a model of its own, keyed by its whole pointer.
Deno.test('Reach - a ref to a place inside a schema names that place, which reaches what is below it', () => {
  const deep = '#/components/schemas/Order/properties/total'

  assertEquals(reach.namedByOperation({ path: '/deep', method: 'get' }), [deep])
  assertEquals(sorted(reach.ofModel(toRefParts({ $ref: deep }))), [deep, 'Tag'].sort())
})

Deno.test('Reach - an operation the document does not have names nothing', () => {
  assertEquals(reach.namedByOperation({ path: '/none', method: 'get' }), [])
  assertEquals(reach.namedByWebhook({ name: 'none', method: 'post' }), [])
})

// Two components that are no schemas, each a ref to the other, must end.
// The parser removes such a loop, so the refs are given to Reach as it would
// get them from a parser that kept it.
Deno.test('Reach - components that refer to each other in a loop end the walk', () => {
  const response = (name: string) => toRefParts({ $ref: `#/components/responses/${name}` })

  const looped = new Reach([
    { ref: response('A'), place: ['paths', '/loop', 'get', 'responses', '200'], refTarget: undefined },
    { ref: response('B'), place: ['components', 'responses', 'A'], refTarget: undefined },
    { ref: response('A'), place: ['components', 'responses', 'B'], refTarget: undefined },
    { ref: model('Tag'), place: ['components', 'responses', 'B', 'content'], refTarget: undefined }
  ])

  assertEquals(looped.namedByOperation({ path: '/loop', method: 'get' }), ['Tag'])
})

// A ref the parser read for a ref target belongs to that target, wherever the target is in the document.
Deno.test('Reach - a ref read for a ref target is named by that target', () => {
  const target = '#/paths/~1orders/get/responses/200/content/application~1json/schema'

  const targeted = new Reach([
    { ref: model('Tag'), place: ['paths', '/orders', 'get', 'responses', '200'], refTarget: target }
  ])

  assertEquals(targeted.ofModel(toRefParts({ $ref: target })).includes('Tag'), true)
  assertEquals(targeted.namedByOperation({ path: '/orders', method: 'get' }), [])
})

Deno.test('Reach - a webhook names the models of its own refs', () => {
  const webhooks = toReach({
    openapi: '3.1.0',
    info: { title: 'Reach', version: '1.0.0' },
    webhooks: {
      orderPaid: {
        post: {
          requestBody: { content: { 'application/json': { schema: schema('Tag') } } },
          responses: { '200': { description: 'ok' } }
        }
      }
    },
    components: { schemas: { Tag: { type: 'string' } } }
  })

  assertEquals(webhooks.namedByWebhook({ name: 'orderPaid', method: 'post' }), ['Tag'])
})
