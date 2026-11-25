/**
 * What a ref target (`refPath.test.ts`) does when it, or what it refers to,
 * is broken: its errors and refs are its own, not those of the component or
 * operation its position is in.
 */

import { assert, assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import { toSchemaComponentRef } from '@/helpers/refFns.ts'
import { GenerateContext } from '@/context/GenerateContext.ts'
import type { RefName } from '@/types/RefName.ts'
import type { SystemSettings } from '@/types/Settings.ts'

const text = { type: 'string' }
const broken = { not: text }
const ok = (schema: unknown) => ({ '200': { description: 'ok', content: { 'application/json': { schema } } } })
const toObject = (properties: Record<string, unknown>) => ({ type: 'object', properties })
const refTo = (pointer: string) => ({ $ref: pointer })

type ParseArgs = {
  openapi: string
  schemas?: Record<string, unknown>
  components?: Record<string, unknown>
  paths?: Record<string, unknown>
  roots?: Record<string, unknown>
  system?: SystemSettings
}

const parse = ({ openapi, schemas = {}, components = {}, paths = {}, roots = {}, system }: ParseArgs) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      // Documents in the wild hold what the parser's input type does not allow.
      value: JSON.parse(
        JSON.stringify({ openapi, info: { title: 't', version: '1' }, ...roots, paths, components: { ...components, schemas } })
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  assert(parsed.type === 'oas')

  const identities = context.issues.map(issue => `${issue.level} ${issue.type} ${issue.location} ${issue.message}`)
  assertEquals(new Set(identities).size, identities.length, 'no issue is reported twice')

  return {
    parsed,
    issues: context.issues,
    names: Object.keys(parsed.value.components?.schemas ?? {}).sort(),
    operations: parsed.value.operations.map(({ method, path }) => `${method} ${path}`).sort()
  }
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} a dangling ref inside a target outside components removes what refers to the target`, () => {
    const { names, issues } = parse({
      openapi,
      roots: { 'x-models': { Pet: toObject({ o: refTo('#/x-models/Owner') }) } },
      schemas: { User: toObject({ p: refTo('#/x-models/Pet') }), Other: toObject({}) }
    })

    assertEquals(names, ['Other'])
    assertEquals(issues.filter(({ type }) => type === 'DANGLING_REF').map(({ location }) => location), [
      'TEST:x-models:Pet:properties:o'
    ])
    assert(issues.some(({ type, location }) => type === 'INVALID_DEPENDENCY_REF' && location.includes('User')))
  })

  Deno.test(`${openapi} a target outside components goes with the component it refers to`, () => {
    const { names } = parse({
      openapi,
      roots: { definitions: { Pet: toObject({ b: refTo('#/components/schemas/Broken') }) } },
      schemas: { Broken: broken, User: toObject({ p: refTo('#/definitions/Pet') }), Other: toObject({}) }
    })

    assertEquals(names, ['Other'])
  })

  Deno.test(`${openapi} removal reaches what refers to a target through another target`, () => {
    const { names, operations, issues } = parse({
      openapi,
      schemas: {
        Broken: broken,
        Holder: toObject({ alias: refTo('#/components/schemas/Broken') }),
        Via: toObject({ p: refTo('#/components/schemas/Holder/properties/alias') }),
        ViaVia: toObject({ p: refTo('#/components/schemas/Via/properties/p') }),
        Other: toObject({})
      },
      paths: { '/v': { get: { responses: ok(refTo('#/components/schemas/Holder/properties/alias')) } } }
    })

    assertEquals(names, ['Other'])
    assertEquals(operations, [])
    assert(issues.some(({ type, location }) => type === 'INVALID_DEPENDENCY_REF' && location.includes(':Via:')))
  })

  Deno.test(`${openapi} a malformed link that a ref points at is an issue, not an exception`, () => {
    const { operations, issues } = parse({
      openapi,
      paths: {
        '/a': { get: { responses: { '200': { description: 'ok', links: { l: { operationId: 'x', server: null } } } } } },
        '/b': { get: { responses: { '200': { description: 'ok', links: { m: refTo('#/paths/~1a/get/responses/200/links/l') } } } } },
        '/c': { get: { responses: ok(text) } }
      }
    })

    assert(operations.includes('get /c'))
    assert(issues.some(({ type }) => type === 'INVALID_RESPONSE'))
  })

  Deno.test(`${openapi} a broken $defs entry does not remove the component it is in`, () => {
    const { names } = parse({
      openapi,
      schemas: {
        Pet: { ...toObject({ id: text }), $defs: { bad: broken } },
        UsesPet: toObject({ pet: refTo('#/components/schemas/Pet') }),
        Other: toObject({ bad: refTo('#/components/schemas/Pet/$defs/bad') })
      }
    })

    assertEquals(names, ['Pet', 'UsesPet'])
  })

  Deno.test(`${openapi} a dangling ref inside a target is reported once`, () => {
    const document = {
      openapi,
      schemas: {
        Holder: toObject({ x: toObject({ b: refTo('#/components/schemas/Missing') }) }),
        User: toObject({ y: refTo('#/components/schemas/Holder/properties/x') })
      }
    }
    const strict = parse(document)
    assertEquals(strict.issues.filter(({ type }) => type === 'DANGLING_REF').length, 1)
    assertEquals(strict.names, [])

    const kept = parse({ ...document, system: { danglingRefs: ['schema'] } })
    assertEquals(kept.issues.filter(({ type }) => type === 'DANGLING_REF').length, 1)
    assertEquals(kept.names, ['Holder', 'User'])
  })

  Deno.test(`${openapi} an operation that overrides a broken path-level deep parameter is kept`, () => {
    const own = { name: 'id', in: 'path', required: true, schema: text }
    const { operations } = parse({
      openapi,
      paths: {
        '/a/{id}': {
          parameters: [refTo('#/paths/~1b/parameters/0')],
          get: { parameters: [own], responses: ok(text) },
          put: { responses: ok(text) }
        },
        '/b': { parameters: [{ name: 'id', in: 'path', required: true, schema: broken }] }
      }
    })

    assertEquals(operations, ['get /a/{id}'])
  })

  Deno.test(`${openapi} an allOf member that names a response is dangling`, () => {
    const { names, issues } = parse({
      openapi,
      components: { responses: { Err: { description: 'failed' } } },
      schemas: { A: { allOf: [refTo('#/components/responses/Err'), toObject({ a: text })] } }
    })

    assertEquals(names, [])
    assert(issues.some(({ type }) => type === 'DANGLING_REF'))
  })

  Deno.test(`${openapi} a ref into an extension under components resolves`, () => {
    const { names } = parse({
      openapi,
      components: { 'x-shared': { Foo: toObject({ id: text }) } },
      schemas: { User: toObject({ y: refTo('#/components/x-shared/Foo') }) }
    })

    assertEquals(names, ['User'])
  })

  for (const bucket of ['pathItems', 'callbacks', 'mediaTypes']) {
    Deno.test(`${openapi} a schema ref into components.${bucket} is a type mismatch`, () => {
      const { names, issues } = parse({
        openapi,
        components: { [bucket]: { P: {} } },
        schemas: { User: toObject({ p: refTo(`#/components/${bucket}/P`) }) }
      })

      assertEquals(names, [])
      assert(issues.some(({ type }) => type === 'REF_TYPE_MISMATCH'))
    })
  }

  Deno.test(`${openapi} a deep $ref with a % in its name is written so that it reads back`, () => {
    const { parsed } = parse({
      openapi,
      schemas: {
        Pet: toObject({ 'a%20b': text }),
        User: toObject({ y: refTo('#/components/schemas/Pet/properties/a%2520b') })
      }
    })
    const context = new GenerateContext({
      document: parsed,
      settings: undefined,
      logger: new log.Logger('test', 'ERROR'),
      captureCurrentResult: () => {},
      toGeneratorConfigMap: () => ({})
    })
    const user = context.resolveSchemaRefOnce(toSchemaComponentRef('User' as RefName))
    assert(!user.isRef() && user.type === 'object')
    const ref = user.properties?.y
    assert(ref !== undefined && ref.type === 'ref')

    assertEquals(ref.toJSON(), { $ref: '#/components/schemas/Pet/properties/a%2520b' })
  })

  Deno.test(`${openapi} a union member is selected by the whole pointer in a mapping`, () => {
    const disk = (own: string) => toObject({ kind: text, [own]: text })
    const { parsed } = parse({
      openapi,
      schemas: {
        A: toObject({ disk: { ...disk('a'), required: ['kind'] } }),
        B: toObject({ disk: { ...disk('b'), required: ['kind'] } }),
        Disk: {
          oneOf: [refTo('#/components/schemas/A/properties/disk'), refTo('#/components/schemas/B/properties/disk')],
          discriminator: { propertyName: 'kind', mapping: { b: '#/components/schemas/B/properties/disk' } }
        }
      }
    })
    const union = parsed.value.components?.schemas?.['Disk' as RefName]
    assert(union !== undefined && !union.isRef())
    const member = union.traverse(['{kind:b}'])
    const schema = member.isRef() ? member.resolve() : member
    assert(schema.type === 'object')

    assertEquals(Object.keys(schema.properties ?? {}), ['kind', 'b'])
  })

  Deno.test(`${openapi} a remote ref is never read in this document: an error, or dangling when listed`, () => {
    const document = {
      openapi,
      schemas: {
        Error: toObject({ own: text }),
        User: toObject({ error: refTo('./common.yaml#/components/schemas/Error') }),
        Whole: toObject({ pet: refTo('./pet.yaml') })
      }
    }
    const strict = parse(document)
    assertEquals(strict.names, ['Error'])
    const dangling = strict.issues.filter(({ type }) => type === 'DANGLING_REF')
    assertEquals(dangling.map(({ level }) => level), ['error', 'error'])
    assert(dangling.every(({ message }) => message.includes('points outside the document')))

    const kept = parse({ ...document, system: { danglingRefs: ['schema'] } })
    assertEquals(kept.names, ['Error', 'User', 'Whole'])
    const user = kept.parsed.value.components?.schemas?.['User' as RefName]
    assert(user !== undefined && !user.isRef() && user.type === 'object')
    const ref = user.properties?.error
    assert(ref !== undefined && ref.type === 'ref')
    assertThrows(() => ref.resolve(), DanglingRefError)

    // A generator passes the ref as it is: that must not find the local `Error`.
    const context = new GenerateContext({
      document: kept.parsed,
      settings: undefined,
      logger: new log.Logger('test', 'ERROR'),
      captureCurrentResult: () => {},
      toGeneratorConfigMap: () => ({})
    })
    assertThrows(() => context.resolveSchemaRefOnce(ref), DanglingRefError)
  })

  Deno.test(`${openapi} a remote allOf member is dangling, though the document has its fragment`, () => {
    const document = {
      openapi,
      schemas: {
        Base: toObject({ own: text }),
        A: { allOf: [refTo('./common.yaml#/components/schemas/Base'), toObject({ a: text })] }
      }
    }
    assertEquals(parse(document).names, ['Base'])
    assertEquals(parse({ ...document, system: { danglingRefs: ['allOfMember'] } }).names, ['A', 'Base'])
  })
}
