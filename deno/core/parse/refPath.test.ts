/**
 * Refs that do not point at a component (skmtc/skmtc#387): a `$defs` entry,
 * a component's property, an `allOf` member, a schema under `#/paths`, a
 * parameter declared on a path. Each resolves to its target, which the
 * parser parses once at its own position. A pointer that leads nowhere still
 * names nothing.
 */

import { assert, assertEquals, assertStrictEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'

const ok = (schema: unknown) => ({ '200': { description: 'ok', content: { 'application/json': { schema } } } })
const text = { type: 'string' }

const toDocument = (openapi: string) => ({
  openapi,
  info: { title: 'Ref paths', version: '1' },
  paths: {
    '/card-accounts': {
      post: {
        responses: {
          '201': {
            description: 'created',
            content: { 'application/json': { schema: { type: 'object', properties: { id: text } } } }
          }
        }
      }
    },
    '/accounts': {
      get: { responses: ok({ $ref: '#/paths/~1card-accounts/post/responses/201/content/application~1json/schema' }) }
    },
    '/disks/{diskId}': {
      parameters: [{ name: 'diskId', in: 'path', required: true, schema: text }],
      get: { responses: ok(text) }
    },
    '/backups/{diskId}': {
      get: {
        // Written with percent escapes, as docs-platform exports write it.
        parameters: [{ $ref: '#/paths/~1disks~1%7BdiskId%7D/parameters/0' }],
        responses: ok(text)
      }
    }
  },
  components: {
    schemas: {
      Pet: { type: 'object', properties: { id: text } },
      __sharedInput: {
        $defs: {
          // Refers back to itself through an array's items.
          schema0: { anyOf: [text, { type: 'array', items: { $ref: '#/components/schemas/__sharedInput/$defs/schema0' } }] }
        }
      },
      ObjectInput: { type: 'object', additionalProperties: { $ref: '#/components/schemas/__sharedInput/$defs/schema0' } },
      ChatResponse: {
        type: 'object',
        // `x-note` is skipped, with an issue, once: a target parsed again must not report it again.
        properties: { result: { type: 'object', properties: { text }, unknownKeyword: true } }
      },
      UsesResult: { type: 'object', properties: { result: { $ref: '#/components/schemas/ChatResponse/properties/result' } } },
      diskWithCursor: {
        type: 'object',
        properties: { disk: { type: 'object', required: ['id', 'createdAt'], properties: { id: text, createdAt: text } } }
      },
      webServiceDetails: {
        type: 'object',
        properties: { disk: { type: 'object', required: ['id'], properties: { id: text } } }
      },
      Disks: {
        type: 'object',
        properties: {
          first: { $ref: '#/components/schemas/diskWithCursor/properties/disk' },
          second: { $ref: '#/components/schemas/webServiceDetails/properties/disk' }
        }
      },
      Partial: { allOf: [{ type: 'object', properties: { x: text } }, { type: 'object', properties: { y: text } }] },
      UsesMember: { type: 'object', properties: { second: { $ref: '#/components/schemas/Partial/allOf/1' } } },
      Holder: { type: 'object', properties: { alias: { $ref: '#/components/schemas/Pet' } } },
      ViaAlias: { type: 'object', properties: { pet: { $ref: '#/components/schemas/Holder/properties/alias' } } },
      Looping: {
        type: 'object',
        properties: {
          a: { $ref: '#/components/schemas/Looping/properties/b' },
          b: { $ref: '#/components/schemas/Looping/properties/a' }
        }
      },
      UsesMissing: { type: 'object', properties: { ghost: { $ref: '#/components/schemas/Pet/properties/nope' } } },
      UsesBareId: { type: 'object', properties: { ghost: { $ref: 'b29a71d3-4f97-40ed-a676-731aa1fbe742' } } },
      Broken: { type: 'object', properties: { bad: { not: text } } },
      UsesBroken: { type: 'object', properties: { bad: { $ref: '#/components/schemas/Broken/properties/bad' } } }
    }
  }
})

const parse = (openapi: string) => {
  const context = new ParseContext({
    // Documents in the wild hold what the parser's input type does not allow.
    input: { type: 'oas', value: JSON.parse(JSON.stringify(toDocument(openapi))) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const document = parsed.type === 'oas' ? parsed.value : undefined
  const toSchema = (name: string): OasSchema | OasRef<'schema'> | undefined =>
    document?.components?.schemas?.[name as RefName]
  const toProperty = (name: string, property: string) => {
    const schema = toSchema(name)
    return schema !== undefined && !schema.isRef() && schema.type === 'object' ? schema.properties?.[property] : undefined
  }
  const toOperation = (path: string, method = 'get') =>
    document?.operations.find(operation => operation.path === path && operation.method === method)

  return { toSchema, toProperty, toOperation, issues: context.issues }
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} a ref into $defs resolves to the entry, and an entry that refers back to itself parses`, () => {
    const { toSchema } = parse(openapi)
    const input = toSchema('ObjectInput')
    assert(input !== undefined && !input.isRef() && input.type === 'object')

    const ref = input.additionalProperties
    assert(typeof ref === 'object' && ref.isRef())
    assertEquals({ refName: ref.refName, refPath: ref.refPath }, {
      refName: 'schema0',
      refPath: '#/components/schemas/__sharedInput/$defs'
    })

    const entry = ref.resolve()
    assert(entry.type === 'union')
    const array = entry.members.find(member => !member.isRef() && member.type === 'array')
    assert(array !== undefined && !array.isRef() && array.type === 'array')
    assert(array.items.isRef())
    // The entry's own ref back to it is lazy, and resolves to the same parsed entry.
    assertStrictEquals(array.items.resolve(), entry)
  })

  Deno.test(`${openapi} a ref into a component's property resolves to that property, and writes out its whole pointer`, () => {
    const { toProperty } = parse(openapi)
    const ref = toProperty('UsesResult', 'result')
    assert(ref?.isRef())

    const result = ref.resolve()
    assert(result.type === 'object')
    assertEquals(Object.keys(result.properties ?? {}), ['text'])
    assertEquals(ref.toJSON(), { $ref: '#/components/schemas/ChatResponse/properties/result' })
  })

  Deno.test(`${openapi} a ref into #/paths resolves to the schema of that response`, () => {
    const { toOperation } = parse(openapi)
    const schema = toOperation('/accounts')?.toSuccessResponse()?.resolve().toSchema()
    assert(schema?.isRef())
    assertEquals(schema.refName, 'schema')

    const target = schema.resolve()
    assert(target.type === 'object')
    assertEquals(Object.keys(target.properties ?? {}), ['id'])
  })

  Deno.test(`${openapi} two deep targets that share a refName are two targets`, () => {
    // The trap: render.com refers to both of these `disk`s, which are different schemas.
    const { toProperty } = parse(openapi)
    const first = toProperty('Disks', 'first')
    const second = toProperty('Disks', 'second')
    assert(first?.isRef() && second?.isRef())
    assertEquals(first.refName, second.refName)

    const [a, b] = [first.resolve(), second.resolve()]
    assert(a.type === 'object' && b.type === 'object')
    assertEquals(a.required, ['id', 'createdAt'])
    assertEquals(b.required, ['id'])
  })

  Deno.test(`${openapi} a ref to an allOf member resolves to that member, which its component has merged`, () => {
    const { toProperty } = parse(openapi)
    const ref = toProperty('UsesMember', 'second')
    assert(ref?.isRef())
    assertEquals(ref.refName, '1')

    const member = ref.resolve()
    assert(member.type === 'object')
    assertEquals(Object.keys(member.properties ?? {}), ['y'])
  })

  Deno.test(`${openapi} a parameter ref into a path's parameters, written with percent escapes, resolves`, () => {
    const { toOperation } = parse(openapi)
    const [parameter] = toOperation('/backups/{diskId}')?.toEffectiveParameters() ?? []
    assert(parameter?.isRef())
    assertEquals(parameter.refPath, '#/paths/~1disks~1%7BdiskId%7D/parameters')
    assertEquals(parameter.resolve().name, 'diskId')
    assertEquals(parameter.toJSON(), { $ref: '#/paths/~1disks~1{diskId}/parameters/0' })
  })

  Deno.test(`${openapi} a deep target that is itself a ref is followed to its end; deep refs that loop name nothing`, () => {
    const { toProperty, toSchema, issues } = parse(openapi)
    const pet = toProperty('ViaAlias', 'pet')
    assert(pet?.isRef())
    assertStrictEquals(pet.resolve(), toSchema('Pet'))

    assertEquals(toSchema('Looping'), undefined)
    assert(
      issues.some(issue => issue.type === 'DANGLING_REF' && issue.message.includes('#/components/schemas/Looping/properties/'))
    )
  })

  Deno.test(`${openapi} a pointer that leads nowhere, and a bare id, name nothing, with the whole $ref in the issue`, () => {
    const { toSchema, issues } = parse(openapi)
    const dangling = issues.filter(issue => issue.type === 'DANGLING_REF').map(issue => issue.message)

    assertEquals(toSchema('UsesMissing'), undefined)
    assertEquals(toSchema('UsesBareId'), undefined)
    assert(dangling.some(message => message.includes('"#/components/schemas/Pet/properties/nope"')))
    assert(dangling.some(message => message.includes('"b29a71d3-4f97-40ed-a676-731aa1fbe742"')))
  })

  Deno.test(`${openapi} a deep target that fails to parse removes what refers to it, naming its error, not as dangling`, () => {
    const { toSchema, issues } = parse(openapi)

    assertEquals(toSchema('UsesBroken'), undefined)
    assertEquals(issues.filter(issue => issue.type === 'DANGLING_REF' && issue.message.includes('Broken')), [])
    const dependency = issues.find(issue => issue.type === 'INVALID_DEPENDENCY_REF')
    assertEquals(dependency?.location, 'TEST:components:schemas:UsesBroken:properties:bad')
    assert(dependency?.message.includes('Schema uses unsupported "not" keyword'))
  })

  Deno.test(`${openapi} parsing a deep target again reports nothing twice`, () => {
    const { issues } = parse(openapi)
    const atResult = issues.filter(issue => issue.location.startsWith('TEST:components:schemas:ChatResponse:properties:result'))

    assert(atResult.length > 0)
    assertEquals(new Set(atResult.map(issue => `${issue.type} ${issue.location} ${issue.message}`)).size, atResult.length)
  })
}
