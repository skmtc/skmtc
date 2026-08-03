/**
 * Engine gate for the skeleton (and for your generator once the slots
 * are filled): the fixture below runs through the REAL pipeline and the
 * rendered artifacts are pinned byte-for-byte. After customizing a
 * slot, update the pinned strings to your target syntax — the
 * structural assertions (files exist, shared refs dedup, imports
 * stitched, recursion annotated) must keep passing unchanged.
 *
 * Fixture coverage: enum, array-of-ref, shared ref (Address ×2 →
 * ONE definition), optional, nullable, additionalProperties record,
 * self-recursion (Category → Category).
 */
import { StackTrail, toArtifacts } from '@skmtc/core'
import { assertEquals, assertStringIncludes } from '@std/assert'
import myLibEntry from './mod.ts'

const fixture = {
  openapi: '3.0.3',
  info: { title: 'Skeleton fixture', version: '0.0.1' },
  paths: {},
  components: {
    schemas: {
      Order: {
        type: 'object',
        required: ['id', 'status', 'items'],
        properties: {
          id: { type: 'string' },
          status: { $ref: '#/components/schemas/OrderStatus' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          shippingAddress: { $ref: '#/components/schemas/Address' },
          billingAddress: { $ref: '#/components/schemas/Address' },
          notes: { type: 'string', nullable: true },
        },
      },
      OrderItem: {
        type: 'object',
        required: ['sku', 'quantity'],
        properties: {
          sku: { type: 'string' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'number' },
        },
      },
      OrderStatus: {
        type: 'string',
        enum: ['pending', 'shipped', 'delivered'],
      },
      Address: {
        type: 'object',
        required: ['line1', 'city'],
        properties: {
          line1: { type: 'string' },
          city: { type: 'string' },
        },
      },
      Category: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Category' },
          },
        },
      },
      Metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
}

const generate = () => {
  return toArtifacts({
    traceId: 'skeleton-test',
    spanId: 'skeleton-test',
    // The fixture is a plain literal; the OpenAPI document type is only
    // asserted here, in test code.
    document: { type: 'oas', value: fixture as never },
    settings: undefined,
    stackTrail: new StackTrail(['skeleton', 'test']),
    // The same shape the CLI's generated server uses. The cast bridges
    // the config map's caller-chosen EnrichmentType generic — test-only.
    toGeneratorConfigMap: (() => ({
      [myLibEntry.id]: myLibEntry,
    })) as Parameters<typeof toArtifacts>[0]['toGeneratorConfigMap'],
    startAt: Date.now(),
    silent: true,
  })
}

Deno.test('every model renders to its own file', () => {
  const { artifacts, manifest } = generate()

  assertEquals(JSON.stringify(manifest.results).includes('error'), false)

  const paths = Object.keys(artifacts).toSorted()

  assertEquals(paths, [
    'models/address.generated.ts',
    'models/category.generated.ts',
    'models/metadata.generated.ts',
    'models/order.generated.ts',
    'models/orderItem.generated.ts',
    'models/orderStatus.generated.ts',
  ])
})

Deno.test('refs land as imported names, not inline expansions', () => {
  const { artifacts } = generate()

  const order = artifacts['models/order.generated.ts']

  // The import header is the first thing to check: a missing import
  // means a string swallowed a snippet.
  assertStringIncludes(order, `import {m} from 'mylib'`)
  assertStringIncludes(
    order,
    `import {address} from '@/models/address.generated.ts'`,
  )

  // Shared ref: two uses, one definition, referenced by NAME.
  assertEquals(order.match(/shippingAddress: address/g)?.length, 1)
  assertEquals(order.match(/billingAddress: address/g)?.length, 1)
  assertEquals(order.includes('line1'), false)
})

Deno.test('order model pins the full render', () => {
  const { artifacts } = generate()

  assertEquals(
    artifacts['models/order.generated.ts'],
    `import {m} from 'mylib'
import {orderStatus} from '@/models/orderStatus.generated.ts'
import {orderItem} from '@/models/orderItem.generated.ts'
import {address} from '@/models/address.generated.ts'

export const order = m.object({id: m.string(), status: orderStatus, items: m.array(orderItem), shippingAddress: address.optional(), billingAddress: address.optional(), notes: m.string().nullable().optional()});
`,
  )
})

Deno.test('self-recursion renders lazy and annotates the identifier', () => {
  const { artifacts } = generate()

  const category = artifacts['models/category.generated.ts']

  assertStringIncludes(category, 'm.lazy(() => category)')
  // SLOT(recursion-annotation) — the annotation that breaks TS7022.
  assertStringIncludes(
    category,
    'export const category: MyLibSchema<Category> =',
  )
})

Deno.test('additionalProperties renders as a record', () => {
  const { artifacts } = generate()

  assertStringIncludes(
    artifacts['models/metadata.generated.ts'],
    'm.record(m.string(), m.string())',
  )
})

Deno.test('enum and modifiers render at the leaf', () => {
  const { artifacts } = generate()

  assertStringIncludes(
    artifacts['models/orderStatus.generated.ts'],
    `m.enum(['pending', 'shipped', 'delivered'])`,
  )
  assertStringIncludes(
    artifacts['models/orderItem.generated.ts'],
    'unitPrice: m.number().optional()',
  )
})
