import { assert, assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import { toRefName } from '@/helpers/refFns.ts'
import { collateExamples } from '@/helpers/collateExamples.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

const missing = { $ref: '#/components/schemas/Missing' }
const circle = {
  type: 'object',
  properties: { kind: { type: 'string', enum: ['circle'] } },
  required: ['kind']
}
const square = {
  type: 'object',
  properties: { kind: { type: 'string', enum: ['square'] } },
  required: ['kind']
}

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Dangling', version: '1' },
    paths: {
      // Holds a parameter ref that names nothing.
      '/pets': {
        get: {
          parameters: [{ $ref: '#/components/parameters/Missing' }],
          responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } }
        }
      },
      '/pet': {
        get: {
          responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } }
        }
      }
    },
    components: {
      schemas: {
        Pet: { type: 'object', properties: { id: { type: 'string', example: 'p1' } } },
        // A property that names nothing, next to one that resolves.
        Owner: {
          type: 'object',
          properties: { pet: { $ref: '#/components/schemas/Pet' }, ghost: missing }
        },
        // Uses Owner, so it goes when Owner goes.
        UsesOwner: { type: 'object', properties: { owner: { $ref: '#/components/schemas/Owner' } } },
        Circle: circle,
        Square: square,
        Shape: {
          oneOf: [{ $ref: '#/components/schemas/Circle' }, missing],
          discriminator: { propertyName: 'kind' }
        },
        KnownShape: {
          oneOf: [{ $ref: '#/components/schemas/Circle' }, { $ref: '#/components/schemas/Square' }],
          discriminator: { propertyName: 'kind' }
        },
        // A `type` next to a reference to a union with a dangling member.
        TypedShape: { allOf: [{ $ref: '#/components/schemas/Shape' }], type: 'object' },
        // Fails on its own (`system.not` is strict), so the ref to it is not dangling.
        Broken: { not: { type: 'string' } },
        UsesBroken: { type: 'object', properties: { broken: { $ref: '#/components/schemas/Broken' } } }
      }
    }
  }) as OpenAPIV3.Document

type ParseArgs = {
  openapi: string
  system: SystemSettings | undefined
  /** The document's `paths` and `components` (and root `security`); the shared document when left out. */
  document?: { paths?: Record<string, unknown>; components?: Record<string, unknown>; security?: unknown }
}

const parse = ({ openapi, system, document: fields }: ParseArgs) => {
  const value = fields === undefined
    ? toDocument(openapi)
    // Documents in the wild hold what the parser's input type does not allow.
    : JSON.parse(JSON.stringify({ openapi, info: { title: 'Dangling', version: '1' }, paths: {}, ...fields }))
  const context = new ParseContext({
    input: { type: 'oas', value },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const document = parsed.type === 'oas' ? parsed.value : undefined
  const toSchema = (name: string): OasSchema | OasRef<'schema'> | undefined =>
    document?.components?.schemas?.[toRefName(`#/components/schemas/${name}`)]
  const toOperation = (path: string, method = 'get') =>
    document?.operations.find(operation => operation.path === path && operation.method === method)
  const issuesOf = (type: string) => context.issues.filter(issue => issue.type === type)

  return { toSchema, toOperation, issuesOf, issues: context.issues }
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} system.danglingRefs strict: what holds a dangling ref is removed, with what uses it`, () => {
    for (const system of [undefined, { danglingRefs: 'strict' } satisfies SystemSettings]) {
      const { toSchema, toOperation, issuesOf } = parse({ openapi, system })

      assertEquals(toSchema('Owner'), undefined)
      assertEquals(toSchema('UsesOwner'), undefined)
      assertEquals(toSchema('Shape'), undefined)
      assertEquals(toOperation('/pets'), undefined)

      assert(toSchema('Pet') !== undefined)
      assert(toSchema('KnownShape') !== undefined)
      assert(toOperation('/pet') !== undefined)

      // One error at each place a dangling `$ref` is written.
      const dangling = issuesOf('DANGLING_REF')
      assertEquals(dangling.map(issue => issue.level), ['error', 'error', 'error'])
      assert(dangling.some(issue => issue.location.endsWith('components:schemas:Owner:properties:ghost')))
      assert(
        issuesOf('INVALID_DEPENDENCY_REF').some(issue =>
          issue.location.endsWith('components:schemas:UsesOwner:properties:owner')
        )
      )
    }
  })

  Deno.test(`${openapi} system.danglingRefs keep: the dangling ref stays, with a warning, and resolving it throws`, () => {
    const { toSchema, toOperation, issuesOf } = parse({ openapi, system: { danglingRefs: 'keep' } })
    const owner = toSchema('Owner')

    assert(owner !== undefined && !owner.isRef() && owner.type === 'object')
    const ghost = owner.properties?.ghost
    assert(ghost !== undefined && ghost.isRef())
    assertThrows(() => ghost.resolve(), DanglingRefError, 'Ref "#/components/schemas/Missing" names nothing in the document')
    assert(toSchema('UsesOwner') !== undefined)

    const parameter = toOperation('/pets')?.parameters?.[0]
    assert(parameter !== undefined && parameter.isRef())
    assertThrows(() => parameter.resolve(), DanglingRefError)

    assertEquals(issuesOf('DANGLING_REF').map(issue => issue.level), ['warning', 'warning', 'warning'])
    assertEquals(issuesOf('INVALID_DEPENDENCY_REF').filter(issue => issue.location.includes('Owner')), [])
  })

  Deno.test(`${openapi} system.danglingRefs keep: core's own walks read a dangling ref as unknown`, () => {
    const { toSchema } = parse({ openapi, system: { danglingRefs: 'keep' } })
    const shape = toSchema('Shape')
    const knownShape = toSchema('KnownShape')
    const typedShape = toSchema('TypedShape')

    // A dangling member cannot be shown to carry the discriminator.
    assert(shape?.type === 'union' && knownShape?.type === 'union')
    assertEquals(shape.isDiscriminable(), false)
    assertEquals(knownShape.isDiscriminable(), true)

    // The `type` next to the ref cannot be shown to agree with a dangling member.
    assert(typedShape?.isRef())
    assertEquals(typedShape.toSkippedSiblings(), ['type'])

    // A dangling property has no example, so it is left out.
    assertEquals(collateExamples({ objectSchema: toSchema('Owner'), depth: 0 }), { pet: { id: 'p1' } })
  })

  Deno.test(`${openapi} a ref to a schema that fails to parse is not reported as dangling`, () => {
    for (const system of [undefined, { danglingRefs: 'keep' } satisfies SystemSettings]) {
      const { toSchema, issuesOf } = parse({ openapi, system })

      assertEquals(toSchema('UsesBroken'), undefined)
      assertEquals(issuesOf('DANGLING_REF').filter(issue => issue.message.includes('Broken')), [])
    }
  })
}

const ok = (schema: unknown) => ({ '200': { description: 'ok', content: { 'application/json': { schema } } } })
const pet = { $ref: '#/components/schemas/Pet' }
const petSchema = { type: 'object', properties: { id: { type: 'string' } } }
const apiKey = { type: 'apiKey', name: 'X-Key', in: 'header' }

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} a ref into the wrong bucket is a REF_TYPE_MISMATCH, and what it names stays`, () => {
    // The wrong-bucket ref comes first, in `paths`, before the schema refs.
    const { toSchema, toOperation, issuesOf, issues } = parse({
      openapi,
      system: undefined,
      document: {
        paths: {
          '/a': { post: { requestBody: pet, responses: ok(pet) } },
          '/b': { get: { responses: ok(pet) } }
        },
        components: { schemas: { Pet: petSchema, Owner: { type: 'object', properties: { pet } } } }
      }
    })

    assert(toSchema('Pet') !== undefined && toSchema('Owner') !== undefined)
    assert(toOperation('/a', 'post') !== undefined && toOperation('/b') !== undefined)
    assertEquals(
      issuesOf('REF_TYPE_MISMATCH').map(({ level, location }) => ({ level, location })),
      [{ level: 'warning', location: 'TEST:paths:/a:post:requestBody' }]
    )
    assertEquals(issues.filter(issue => issue.level === 'error'), [])
  })

  Deno.test(`${openapi} system.danglingRefs strict: an operation goes with a security scheme that names nothing`, () => {
    for (const root of [undefined, [{ alias: [] }]]) {
      const { toOperation, issuesOf } = parse({
        openapi,
        system: undefined,
        document: {
          paths: {
            '/own': { get: { security: [{ alias: [] }], responses: ok(pet) } },
            '/inherits': { get: { responses: ok(pet) } },
            '/open': { get: { security: [], responses: ok(pet) } }
          },
          components: {
            schemas: { Pet: petSchema },
            securitySchemes: { apiKey, alias: { $ref: '#/components/securitySchemes/Missing' } }
          },
          security: root
        }
      })

      assertEquals(toOperation('/own'), undefined)
      // Kept without its auth on main: it inherits `alias` from the root.
      assertEquals(toOperation('/inherits') === undefined, root !== undefined)
      assert(toOperation('/open') !== undefined)
      assert(
        issuesOf('INVALID_DEPENDENCY_REF').some(
          ({ location, message }) =>
            location === 'TEST:paths:/own:get' && message.includes("'#/components/securitySchemes/alias'")
        )
      )
    }
  })

  Deno.test(`${openapi} system.danglingRefs keep: resolving a security scheme that names nothing throws`, () => {
    const { toOperation } = parse({
      openapi,
      system: { danglingRefs: 'keep' },
      document: {
        paths: { '/own': { get: { security: [{ alias: [] }], responses: ok(pet) } } },
        components: {
          schemas: { Pet: petSchema },
          securitySchemes: { alias: { $ref: '#/components/securitySchemes/Missing' } }
        }
      }
    })

    const requirement = toOperation('/own')?.security?.[0]
    assert(requirement !== undefined)
    assertThrows(() => requirement.toSecurityScheme(), DanglingRefError)
  })

  Deno.test(`${openapi} system.danglingRefs strict: an example ref that names nothing is a warning, and the operation stays`, () => {
    const { toOperation, issuesOf } = parse({
      openapi,
      system: undefined,
      document: {
        paths: {
          '/ex': {
            get: {
              responses: {
                '200': {
                  description: 'ok',
                  content: {
                    'application/json': { schema: pet, examples: { a: { $ref: '#/components/examples/Typo' } } }
                  }
                }
              }
            }
          }
        },
        components: { schemas: { Pet: petSchema } }
      }
    })

    assert(toOperation('/ex') !== undefined)
    // At the place the `$ref` is written: `examples` is traced once.
    assertEquals(
      issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [{ level: 'warning', location: 'TEST:paths:/ex:get:responses:200:content:application/json:examples:a' }]
    )
    assertEquals(issuesOf('INVALID_DEPENDENCY_REF'), [])
  })

  Deno.test(`${openapi} system.danglingRefs strict: one issue at a holder, and each removal names its own cause`, () => {
    const { toOperation, issuesOf } = parse({
      openapi,
      system: undefined,
      document: {
        paths: {
          '/p': {
            parameters: [{ $ref: '#/components/parameters/Missing' }],
            get: { responses: ok(pet) },
            post: { responses: ok(pet) }
          },
          '/q': { get: { parameters: [{ $ref: '#/components/parameters/Missing' }], responses: ok(pet) } }
        },
        components: { schemas: { Pet: petSchema } }
      }
    })

    assertEquals(toOperation('/p'), undefined)
    assertEquals(toOperation('/p', 'post'), undefined)
    assertEquals(toOperation('/q'), undefined)
    assertEquals(
      issuesOf('DANGLING_REF').map(({ location }) => location),
      ['TEST:paths:/p:parameters:0', 'TEST:paths:/q:get:parameters:0']
    )
    // `/q` holds the ref itself, so it has the DANGLING_REF only. The path-level
    // parameter removes each operation it applies to, and names itself as the cause.
    assertEquals(
      issuesOf('INVALID_DEPENDENCY_REF').map(({ location, message }) => ({
        location,
        cause: message.includes("at 'TEST:paths:/p:parameters:0'")
      })),
      [
        { location: 'TEST:paths:/p:get', cause: true },
        { location: 'TEST:paths:/p:post', cause: true }
      ]
    )
  })

  Deno.test(`${openapi} system.danglingRefs keep: toParams leaves out a parameter that names nothing`, () => {
    const query = (name: string) => ({ name, in: 'query', schema: { type: 'string' } })
    const { toOperation } = parse({
      openapi,
      system: { danglingRefs: 'keep' },
      document: {
        paths: {
          '/p': {
            parameters: [{ $ref: '#/components/parameters/Missing' }, query('shared')],
            get: { parameters: [query('own'), { $ref: '#/components/parameters/Other' }], responses: ok(pet) }
          }
        },
        components: { schemas: { Pet: petSchema } }
      }
    })

    const operation = toOperation('/p')
    assert(operation !== undefined)
    assertEquals(operation.toParams().map(({ name }) => name), ['shared', 'own'])
    assertEquals(Object.keys(operation.toParametersObject().properties ?? {}), ['shared', 'own'])
  })

  Deno.test(`${openapi} a dangling ref in an allOf that core merges removes the schema under either setting`, () => {
    for (const system of [undefined, { danglingRefs: 'keep' } satisfies SystemSettings]) {
      const { toSchema, issuesOf } = parse({
        openapi,
        system,
        document: {
          components: {
            schemas: {
              G: { allOf: [{ $ref: '#/components/schemas/Missing' }, { type: 'object', properties: { id: { type: 'string' } } }] }
            }
          }
        }
      })

      assertEquals(toSchema('G'), undefined)
      assertEquals(
        issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
        [{ level: 'error', location: 'TEST:components:schemas:G' }]
      )
      assertEquals(issuesOf('INVALID_SCHEMA'), [])
    }
  })

  Deno.test(`${openapi} a percent-encoded ref names the component it encodes`, () => {
    const { toOperation, issuesOf } = parse({
      openapi,
      system: undefined,
      document: {
        paths: { '/r': { get: { responses: ok({ $ref: '#/components/schemas/Foo%20Bar' }) } } },
        components: { schemas: { 'Foo Bar': petSchema } }
      }
    })

    const schema = toOperation('/r')?.toSuccessResponse()?.resolve().toSchema()
    assert(schema?.isRef())
    assertEquals(schema.resolve().type, 'object')
    assertEquals(issuesOf('DANGLING_REF'), [])
  })
}
