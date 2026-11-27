import { assert, assertEquals, assertThrows } from '@std/assert'
import {
  fromModelKey,
  isDefaultRefPath,
  isRemoteRefPath,
  isRef,
  toGetRef,
  toModelKey,
  toModelName,
  toRawRefTarget,
  toRefParts,
  toRefPathBucket,
  toRefPointer,
  toSchemaComponentRef
} from './refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { DanglingRefError } from '../oas/ref/DanglingRefError.ts'
import type { RefName } from '@/types/RefName.ts'

Deno.test('toRefParts - a component ref is its bucket path and its name', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/User' }), {
    refName: 'User',
    refPath: '#/components/schemas'
  })
  assertEquals(toRefParts({ $ref: '#/components/responses/ErrorResponse' }), {
    refName: 'ErrorResponse',
    refPath: '#/components/responses'
  })
})

Deno.test('toRefParts - a ref into a deeper path keeps the whole path before its last segment', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/__sharedInput/$defs/schema0' }), {
    refName: 'schema0',
    refPath: '#/components/schemas/__sharedInput/$defs'
  })
  assertEquals(
    toRefParts({
      $ref: '#/paths/~1card-accounts/post/responses/201/content/application~1json/schema' }),
    { refName: 'schema', refPath: '#/paths/~1card-accounts/post/responses/201/content/application~1json' }
  )
})

Deno.test('toRefParts - unescapes the name as a JSON pointer in a URI fragment, and spells the path without percent escapes', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/Foo%20Bar' }).refName, 'Foo Bar')
  // `~01` is `~1` escaped once: unescaping `~1` before `~0` keeps it `~1`.
  assertEquals(toRefParts({ $ref: '#/components/schemas/a~1b~01' }).refName, 'a/b~1')
  // A `%` that starts no valid escape stays as written.
  assertEquals(toRefParts({ $ref: '#/components/schemas/100%' }).refName, '100%')
  assertEquals(
    toRefParts({ $ref: '#/paths/~1disks~1%7BdiskId%7D/parameters/0/schema' }).refPath,
    '#/paths/~1disks~1{diskId}/parameters/0'
  )
})

Deno.test('toRefParts - a remote ref keeps its file in refPath, so it is no place in the document', () => {
  const toParts = ($ref: string) => toRefParts({ $ref })

  assertEquals(toParts('other.yml#/components/schemas/A'), { refName: 'A', refPath: 'other.yml#/components/schemas' })
  assertEquals(toParts('./schemas/pet.yaml'), { refName: 'pet.yaml', refPath: './schemas' })
  // A bare id, as some docs-platform exports write.
  assertEquals(toParts('b29a71d3-4f97-40ed-a676-731aa1fbe742').refPath, '.')

  const remote = toParts('other.yml#/components/schemas/A')
  assertEquals(isRemoteRefPath(remote.refPath), true)
  assertEquals(isDefaultRefPath({ refPath: remote.refPath, refType: 'schema' }), false)
  assertEquals(toModelKey(remote), 'other.yml#/components/schemas/A')
  assertEquals(toRawRefTarget({ components: { schemas: { A: {} } } }, remote), undefined)
})

Deno.test('toRefParts - does not throw for a ref that names nothing: its name is empty', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/' }).refName, '')
  assertEquals(toRefParts({ $ref: '#' }), { refName: '', refPath: '#' })
})

Deno.test('toRefPathBucket - a path that is exactly a bucket of components gives the bucket', () => {
  assertEquals(toRefPathBucket('#/components/schemas'), 'schemas')
  assertEquals(toRefPathBucket('#/components/parameters'), 'parameters')
  // A bucket core does not read is still a bucket.
  assertEquals(toRefPathBucket('#/components/pathItems'), 'pathItems')
})

// The trap: the usual path is read with no split. A path that only starts
// like a bucket must not take that way.
Deno.test('toRefPathBucket - any other path gives undefined', () => {
  assertEquals(toRefPathBucket('#/components/schemas/Pet/properties'), undefined)
  assertEquals(toRefPathBucket('#/components/x-shared'), undefined)
  assertEquals(toRefPathBucket('#/components/'), undefined)
  assertEquals(toRefPathBucket('#/components'), undefined)
  assertEquals(toRefPathBucket('#/paths/~1pets/get'), undefined)
  assertEquals(toRefPathBucket('other.json#/components/schemas'), undefined)
})

// `~0` and `~1` are escapes of a JSON pointer: `schema~0s` is the key
// `schema~s`, which is no bucket, and `~1` is a `/` inside one key.
Deno.test('toRefPathBucket - a path with an escape is unescaped before it is compared', () => {
  assertEquals(toRefPathBucket('#/components/schema~0s'), undefined)
  assertEquals(toRefPathBucket('#/components/schemas~1Pet'), undefined)
})

Deno.test('isDefaultRefPath - only the bucket of the ref kind is a component path', () => {
  assertEquals(isDefaultRefPath({ refPath: '#/components/schemas', refType: 'schema' }), true)
  assertEquals(isDefaultRefPath({ refPath: '#/components/parameters', refType: 'schema' }), false)
  assertEquals(isDefaultRefPath({ refPath: '#/components/schemas/Pet/properties', refType: 'schema' }), false)
})

Deno.test('toRefPointer - two spellings of one place give one pointer', () => {
  const written = toRefPointer(toRefParts({ $ref: '#/paths/~1disks~1%7BdiskId%7D/parameters/0/schema' }))
  const plain = toRefPointer({ refName: 'schema' as RefName, refPath: '#/paths/~1disks~1{diskId}/parameters/0' })

  assertEquals(written, '#/paths/~1disks~1{diskId}/parameters/0/schema')
  assertEquals(plain, written)
})

Deno.test('toModelKey - a component keeps its bare name, so existing keys do not change', () => {
  assertEquals(toModelKey({ refName: 'Pet' as RefName, refPath: '#/components/schemas' }), 'Pet')
})

Deno.test('toSchemaComponentRef - a component ref has refPath #/components/schemas', () => {
  assertEquals(toSchemaComponentRef('Pet' as RefName), { refName: 'Pet', refPath: '#/components/schemas' })
})

Deno.test('fromModelKey - reverses toModelKey for a component and for a deep target', () => {
  const component = toSchemaComponentRef('Pet' as RefName)
  // A property name with `/` and `~`: the pointer escapes both, and the key round-trips.
  const deep = { refName: 'a/b~c' as RefName, refPath: '#/components/schemas/Pet/properties' }

  assertEquals(fromModelKey(toModelKey(component)), component)
  assertEquals(toModelKey(deep), '#/components/schemas/Pet/properties/a~1b~0c')
  assertEquals(fromModelKey(toModelKey(deep)), deep)
})

Deno.test('toModelKey - two deep targets that share a refName get two keys', () => {
  // The trap: render.com refers to both of these, two different schemas named `disk`.
  const first = toModelKey({ refName: 'disk' as RefName, refPath: '#/components/schemas/diskWithCursor/properties' })
  const second = toModelKey({ refName: 'disk' as RefName, refPath: '#/components/schemas/webServiceDetails/properties' })

  assertEquals(first, '#/components/schemas/diskWithCursor/properties/disk')
  assertEquals(second, '#/components/schemas/webServiceDetails/properties/disk')
})

Deno.test('toRawRefTarget - walks objects by key and arrays by index', () => {
  const document = {
    components: { schemas: { Pet: { properties: { tag: { type: 'string' } } } } },
    paths: { '/x': { get: { parameters: [{ name: 'a' }, { name: 'b', schema: { type: 'integer' } }] } } }
  }

  assertEquals(
    toRawRefTarget(document, toRefParts({ $ref: '#/components/schemas/Pet/properties/tag' })),
    { type: 'string' }
  )
  assertEquals(
    toRawRefTarget(document, toRefParts({ $ref: '#/paths/~1x/get/parameters/1/schema' })),
    { type: 'integer' }
  )
  assertEquals(
    toRawRefTarget(document, toRefParts({ $ref: '#/paths/~1x/get/parameters/7' })),
    undefined
  )
})

Deno.test('isRef - returns true for valid reference object', () => {
  const ref = { $ref: '#/components/schemas/User' }
  assertEquals(isRef(ref), true)
})

Deno.test('isRef - returns false for schema object', () => {
  const schema = { type: 'string' }
  assertEquals(isRef(schema), false)
})

Deno.test('isRef - returns false for null', () => {
  assertEquals(isRef(null), false)
})

Deno.test('isRef - returns false for undefined', () => {
  assertEquals(isRef(undefined), false)
})

Deno.test('isRef - returns false for non-object values', () => {
  assertEquals(isRef('string'), false)
  assertEquals(isRef(123), false)
  assertEquals(isRef(true), false)
})

Deno.test('isRef - returns false for object without $ref', () => {
  assertEquals(isRef({ type: 'object' }), false)
})

Deno.test('isRef - returns false for object with non-string $ref', () => {
  assertEquals(isRef({ $ref: 123 }), false)
})

Deno.test('toGetRef - resolves direct schema reference', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      }
    }
  }

  const resolver = toGetRef(document)
  const schema = resolver({ $ref: '#/components/schemas/User' })

  assertEquals(schema.type, 'object')
  assertEquals(schema.properties?.name, { type: 'string' })
})

Deno.test('toGetRef - resolves nested reference chains', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        UserRef: { $ref: '#/components/schemas/User' },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  }

  const resolver = toGetRef(document)
  const schema = resolver({ $ref: '#/components/schemas/UserRef' })

  assertEquals(schema.type, 'object')
  assertEquals(schema.properties?.id, { type: 'string' })
})

Deno.test('toGetRef - throws error for non-existent reference', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {}
    }
  }

  const resolver = toGetRef(document)

  assertThrows(
    () => resolver({ $ref: '#/components/schemas/NonExistent' }),
    DanglingRefError,
    'Ref "#/components/schemas/NonExistent" names nothing in the document'
  )
})

Deno.test('toGetRef - throws error when components is missing', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {}
  }

  const resolver = toGetRef(document)

  assertThrows(
    () => resolver({ $ref: '#/components/schemas/User' }),
    DanglingRefError,
    'Ref "#/components/schemas/User" names nothing in the document'
  )
})

Deno.test('toRefParts - one place has equal parts, however its $ref is spelled', () => {
  const toParts = ($ref: string) => toRefParts({ $ref })

  assertEquals(toParts('#/paths/~1x~1%7Bid%7D/get/schema'), toParts('#/paths/~1x~1{id}/get/schema'))
  assertEquals(toParts('#components/schemas/Foo'), toParts('#/components/schemas/Foo'))
})

Deno.test('fromModelKey - reads a % or a leading # in a name as written', () => {
  const names = ['Foo%20Bar', '#Foo', 'a%20b']
  const refs = [
    ...names.map(name => toSchemaComponentRef(name as RefName)),
    ...names.map(name => ({ refName: name as RefName, refPath: '#/components/schemas/Pet/properties' }))
  ]

  assertEquals(refs.map(ref => fromModelKey(toModelKey(ref))), refs)
})

Deno.test('toGetRef - a $ref to a component that is not a schema names no schema', () => {
  const getRef = toGetRef({
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths: {},
    components: { responses: { Err: { description: 'failed' } } }
  })

  assertThrows(() => getRef({ $ref: '#/components/responses/Err' }), DanglingRefError)
})

Deno.test('toModelName - a component keeps its name, and other targets get names of their own', () => {
  const toName = ($ref: string) => toModelName(toRefParts({ $ref }))

  assertEquals(toName('#/components/schemas/order_item'), 'order_item')
  assertEquals(toModelName(toSchemaComponentRef('Order' as RefName), name => `${name}Dto`), 'OrderDto')
  assertEquals(toName('#/components/schemas/Order/items'), 'Order_items')

  const names = [
    '#/components/schemas/OrderItems',
    '#/components/schemas/Order/items',
    '#/components/schemas/A/properties/disk',
    '#/components/schemas/B/properties/disk',
    '#/components/schemas/Pet/properties/type',
    '#/components/schemas/Pet/properties/@type',
    '#/paths/~1x~1{id}/get/responses/200/content/application~1json/schema',
    '#/paths/~1x~1id/get/responses/200/content/application~1json/schema'
  ].map(toName)

  assertEquals(new Set(names.map(name => name.toLowerCase())).size, names.length)
  assert(names.every(name => /^[a-zA-Z0-9_]+$/.test(name)))
})
