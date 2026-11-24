import { assertEquals, assertThrows } from '@std/assert'
import {
  fromModelKey,
  isDefaultRefPath,
  isRef,
  toGetRef,
  toModelKey,
  toRawRefTarget,
  toRefParts,
  toRefPointer,
  toSchemaComponentRef
} from './refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { DanglingRefError } from '../oas/ref/DanglingRefError.ts'
import type { RefName } from '@/types/RefName.ts'

Deno.test('toRefParts - a component ref is its bucket path and its name', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/User', refType: 'schema' }), {
    refName: 'User',
    refPath: '#/components/schemas'
  })
  assertEquals(toRefParts({ $ref: '#/components/responses/ErrorResponse', refType: 'response' }), {
    refName: 'ErrorResponse',
    refPath: '#/components/responses'
  })
})

Deno.test('toRefParts - a ref into a deeper path keeps the whole path before its last segment', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/__sharedInput/$defs/schema0', refType: 'schema' }), {
    refName: 'schema0',
    refPath: '#/components/schemas/__sharedInput/$defs'
  })
  assertEquals(
    toRefParts({
      $ref: '#/paths/~1card-accounts/post/responses/201/content/application~1json/schema',
      refType: 'schema'
    }),
    { refName: 'schema', refPath: '#/paths/~1card-accounts/post/responses/201/content/application~1json' }
  )
})

Deno.test('toRefParts - unescapes the name as a JSON pointer in a URI fragment, and keeps the path as written', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/Foo%20Bar', refType: 'schema' }).refName, 'Foo Bar')
  // `~01` is `~1` escaped once: unescaping `~1` before `~0` keeps it `~1`.
  assertEquals(toRefParts({ $ref: '#/components/schemas/a~1b~01', refType: 'schema' }).refName, 'a/b~1')
  // A `%` that starts no valid escape stays as written.
  assertEquals(toRefParts({ $ref: '#/components/schemas/100%', refType: 'schema' }).refName, '100%')
  assertEquals(
    toRefParts({ $ref: '#/paths/~1disks~1%7BdiskId%7D/parameters/0/schema', refType: 'schema' }).refPath,
    '#/paths/~1disks~1%7BdiskId%7D/parameters/0'
  )
})

Deno.test('toRefParts - reads an external ref by its fragment, and a ref with no # at the default path', () => {
  assertEquals(toRefParts({ $ref: 'other.yml#/components/schemas/A', refType: 'schema' }), {
    refName: 'A',
    refPath: '#/components/schemas'
  })
  // A bare id, as some docs-platform exports write: looked up as a component name, which names nothing.
  assertEquals(toRefParts({ $ref: 'b29a71d3-4f97-40ed-a676-731aa1fbe742', refType: 'parameter' }), {
    refName: 'b29a71d3-4f97-40ed-a676-731aa1fbe742',
    refPath: '#/components/parameters'
  })
})

Deno.test('toRefParts - does not throw for a ref that names nothing: its name is empty', () => {
  assertEquals(toRefParts({ $ref: '#/components/schemas/', refType: 'schema' }).refName, '')
  assertEquals(toRefParts({ $ref: '#', refType: 'schema' }), { refName: '', refPath: '#' })
})

Deno.test('isDefaultRefPath - only the bucket of the ref kind is a component path', () => {
  assertEquals(isDefaultRefPath({ refPath: '#/components/schemas', refType: 'schema' }), true)
  assertEquals(isDefaultRefPath({ refPath: '#/components/parameters', refType: 'schema' }), false)
  assertEquals(isDefaultRefPath({ refPath: '#/components/schemas/Pet/properties', refType: 'schema' }), false)
})

Deno.test('toRefPointer - two spellings of one place give one pointer', () => {
  const written = toRefPointer({ refName: 'schema' as RefName, refPath: '#/paths/~1disks~1%7BdiskId%7D/parameters/0' })
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
    toRawRefTarget(document, toRefParts({ $ref: '#/components/schemas/Pet/properties/tag', refType: 'schema' })),
    { type: 'string' }
  )
  assertEquals(
    toRawRefTarget(document, toRefParts({ $ref: '#/paths/~1x/get/parameters/1/schema', refType: 'schema' })),
    { type: 'integer' }
  )
  assertEquals(
    toRawRefTarget(document, toRefParts({ $ref: '#/paths/~1x/get/parameters/7', refType: 'parameter' })),
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
