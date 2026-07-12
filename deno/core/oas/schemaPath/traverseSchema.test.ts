import { assert, assertEquals, assertThrows } from '@std/assert'
import { OasObject } from '@/oas/object/Object.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasResponse } from '@/oas/response/Response.ts'
import { OasRequestBody } from '@/oas/requestBody/RequestBody.ts'
import { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import { toOasParsedDocument } from '@/types/SkmtcDocument.ts'
import { toRefParseContextStub } from '@/test/mockParseContext.ts'
import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

// A parse context whose document holds `schemas` in components, so `OasRef`s
// constructed against it resolve.
const toContext = (
  schemas: Record<string, OasSchema | OasRef<'schema'>> = {}
): ParseContextType => {
  const document = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
    operations: [],
    components: new OasComponents({ schemas })
  })

  return toRefParseContextStub(toOasParsedDocument(document))
}

const schemaRef = ($ref: string, context: ParseContextType): OasRef<'schema'> =>
  new OasRef<'schema'>({ refType: 'schema', $ref }, context)

const jsonResponse = (schema: OasSchema | OasRef<'schema'>) =>
  new OasResponse({
    description: 'ok',
    content: { 'application/json': new OasMediaType({ schema, mediaType: 'application/json' }) }
  })

const jsonRequestBody = (schema: OasSchema | OasRef<'schema'>) =>
  new OasRequestBody({
    content: { 'application/json': new OasMediaType({ schema, mediaType: 'application/json' }) }
  })

const operation = (fields: {
  responses?: OasOperation['responses']
  requestBody?: OasRequestBody
}) =>
  new OasOperation({
    path: '/things',
    method: 'get',
    pathItem: undefined,
    responses: fields.responses ?? {},
    requestBody: fields.requestBody
  })

// --- schema traversal -------------------------------------------------------

Deno.test('traverseSchema: empty path returns the value unchanged', () => {
  const schema = new OasObject({ properties: { name: new OasString() } })
  assertEquals(traverseSchema(schema, []), schema)
})

Deno.test('traverseSchema: descends an object property', () => {
  const schema = new OasObject({ properties: { name: new OasString(), age: new OasInteger() } })
  assert(traverseSchema(schema, ['name']) instanceof OasString)
  assert(traverseSchema(schema, ['age']) instanceof OasInteger)
})

Deno.test('traverseSchema: array needs an explicit "items" segment', () => {
  const array = new OasArray({ items: new OasString() })
  assert(traverseSchema(array, []) instanceof OasArray)
  assert(traverseSchema(array, ['items']) instanceof OasString)
})

Deno.test('traverseSchema: nested object -> array -> items', () => {
  const schema = new OasObject({
    properties: {
      data: new OasArray({ items: new OasObject({ properties: { id: new OasString() } }) }),
      pagination: new OasObject({ properties: { total: new OasInteger() } })
    }
  })
  // targets the list item, regardless of the pagination sibling
  assert(traverseSchema(schema, ['data', 'items', 'id']) instanceof OasString)
  assert(traverseSchema(schema, ['data']) instanceof OasArray)
})

Deno.test('traverseSchema: resolves a ref to descend, but leaves the final value a ref', () => {
  const context = toContext({ User: new OasObject({ properties: { name: new OasString() } }) })
  const schema = new OasObject({
    properties: { user: schemaRef('#/components/schemas/User', context) }
  })

  // final value stays a ref (refName preserved)
  const target = traverseSchema(schema, ['user'])
  assert(target.isRef())

  // resolved when the path descends through it
  assert(traverseSchema(schema, ['user', 'name']) instanceof OasString)
})

// --- union member selection -------------------------------------------------

Deno.test('traverseSchema: union member by index', () => {
  const union = new OasUnion({ members: [new OasString(), new OasInteger()] })
  assert(traverseSchema(union, ['[1]']) instanceof OasInteger)
})

Deno.test('traverseSchema: union member by refName and by discriminator', () => {
  const context = toContext({
    Circle: new OasObject({ properties: { radius: new OasInteger() } }),
    Square: new OasObject({ properties: { side: new OasInteger() } })
  })
  const union = new OasUnion({
    members: [
      schemaRef('#/components/schemas/Circle', context),
      schemaRef('#/components/schemas/Square', context)
    ],
    discriminator: new OasDiscriminator({
      propertyName: 'type',
      mapping: { circle: '#/components/schemas/Circle', square: '#/components/schemas/Square' }
    })
  })

  assert(traverseSchema(union, ['$Circle', 'radius']) instanceof OasInteger)
  assert(traverseSchema(union, ['{type:circle}', 'radius']) instanceof OasInteger)
  assert(traverseSchema(union, ['[1]', 'side']) instanceof OasInteger)
})

// --- error cases ------------------------------------------------------------

Deno.test('traverseSchema: throws on a missing property', () => {
  const schema = new OasObject({ properties: { name: new OasString() } })
  assertThrows(() => traverseSchema(schema, ['missing']), Error, 'not a property')
})

Deno.test('traverseSchema: throws on a non-"items" array segment', () => {
  const array = new OasArray({ items: new OasString() })
  assertThrows(() => traverseSchema(array, ['0']), Error, 'use "items"')
})

Deno.test('traverseSchema: throws when descending into a scalar', () => {
  assertThrows(() => traverseSchema(new OasString(), ['nope']), Error, 'cannot traverse')
})

Deno.test('traverseSchema: throws on a plain (un-prefixed) union segment', () => {
  const union = new OasUnion({ members: [new OasString(), new OasInteger()] })
  assertThrows(() => traverseSchema(union, ['Circle']), Error, 'not a valid union selector')
})

Deno.test('traverseSchema: throws on an out-of-range union index', () => {
  const union = new OasUnion({ members: [new OasString()] })
  assertThrows(() => traverseSchema(union, ['[5]']), Error, 'out of range')
})

// --- OasRef.traverse --------------------------------------------------------

Deno.test('OasRef.traverse: throws for a non-schema ref', () => {
  const context = toContext()
  const responseRef = new OasRef<'response'>(
    { refType: 'response', $ref: '#/components/responses/Err' },
    context
  )
  assertThrows(() => responseRef.traverse(['x']), Error, 'not yet supported')
})

// --- OasOperation.traverse --------------------------------------------------

Deno.test('OasOperation.traverse: SuccessResponse root', () => {
  const op = operation({
    responses: {
      '200': jsonResponse(
        new OasObject({
          properties: {
            data: new OasArray({ items: new OasObject({ properties: { id: new OasString() } }) })
          }
        })
      )
    }
  })

  assert(op.traverse(['SuccessResponse']) instanceof OasObject)
  assert(op.traverse(['SuccessResponse', 'data', 'items', 'id']) instanceof OasString)
})

Deno.test('OasOperation.traverse: RequestBody root', () => {
  const op = operation({
    requestBody: jsonRequestBody(new OasObject({ properties: { email: new OasString() } }))
  })

  assert(op.traverse(['RequestBody', 'email']) instanceof OasString)
})

Deno.test('OasOperation.traverse: throws on an unknown root', () => {
  const op = operation({ responses: { '200': jsonResponse(new OasObject()) } })
  assertThrows(() => op.traverse(['Nope']), Error, 'SuccessResponse')
})

Deno.test('OasOperation.traverse: throws when the root body schema is absent', () => {
  const op = operation({ responses: {} })
  assertThrows(() => op.traverse(['SuccessResponse']), Error, 'success response')
})
