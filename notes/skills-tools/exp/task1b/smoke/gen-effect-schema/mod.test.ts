/**
 * Engine gate for the skeleton (and for your generator once the slots
 * are filled): the fixture below runs through the REAL pipeline and the
 * rendered artifacts are pinned byte-for-byte (effect/Schema syntax) — the
 * structural assertions (files exist, shared refs dedup, imports
 * stitched, recursion annotated) must keep passing unchanged.
 *
 * Fixture coverage: enum, array-of-ref, shared ref (Address ×2 →
 * ONE definition), optional, nullable, additionalProperties record,
 * self-recursion (Category → Category).
 */
import { StackTrail, toArtifacts } from '@skmtc/core'
import { assertEquals, assertStringIncludes } from '@std/assert'
import effectEntry from './mod.ts'

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
      [effectEntry.id]: effectEntry,
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
    'models/Address.generated.ts',
    'models/Category.generated.ts',
    'models/Metadata.generated.ts',
    'models/Order.generated.ts',
    'models/OrderItem.generated.ts',
    'models/OrderStatus.generated.ts',
  ])
})

Deno.test('refs land as imported names, not inline expansions', () => {
  const { artifacts } = generate()

  const order = artifacts['models/Order.generated.ts']

  // The import header is the first thing to check: a missing import
  // means a string swallowed a snippet.
  assertStringIncludes(order, `import {Schema} from 'effect'`)
  assertStringIncludes(
    order,
    `import {Address} from '@/models/Address.generated.ts'`,
  )

  // Shared ref: two uses, one definition, referenced by NAME.
  assertEquals(order.match(/shippingAddress: Schema.optional\(Address\)/g)?.length, 1)
  assertEquals(order.match(/billingAddress: Schema.optional\(Address\)/g)?.length, 1)
  assertEquals(order.includes('line1'), false)
})

Deno.test('order model pins the full render', () => {
  const { artifacts } = generate()

  assertEquals(
    artifacts['models/Order.generated.ts'],
    `import {Schema} from 'effect'
import {OrderStatus} from '@/models/OrderStatus.generated.ts'
import {OrderItem} from '@/models/OrderItem.generated.ts'
import {Address} from '@/models/Address.generated.ts'

export const Order = Schema.Struct({ id: Schema.String, status: OrderStatus, items: Schema.Array(OrderItem), shippingAddress: Schema.optional(Address), billingAddress: Schema.optional(Address), notes: Schema.optional(Schema.NullOr(Schema.String)) });
`,
  )
})

Deno.test('self-recursion renders lazy and annotates the identifier', () => {
  const { artifacts } = generate()

  const category = artifacts['models/Category.generated.ts']

  assertStringIncludes(
    category,
    'Schema.suspend((): Schema.Schema<any> => Category)',
  )
  // For effect the circularity-breaking annotation lives on the suspend
  // closure, so the export itself stays unannotated.
  assertStringIncludes(category, 'export const Category = Schema.Struct(')
})

Deno.test('additionalProperties renders as a record', () => {
  const { artifacts } = generate()

  assertStringIncludes(
    artifacts['models/Metadata.generated.ts'],
    'Schema.Record({ key: Schema.String, value: Schema.String })',
  )
})

Deno.test('enum and modifiers render at the leaf', () => {
  const { artifacts } = generate()

  assertStringIncludes(
    artifacts['models/OrderStatus.generated.ts'],
    `Schema.Literal('pending', 'shipped', 'delivered')`,
  )
  assertStringIncludes(
    artifacts['models/OrderItem.generated.ts'],
    'unitPrice: Schema.optional(Schema.Number)',
  )
})
