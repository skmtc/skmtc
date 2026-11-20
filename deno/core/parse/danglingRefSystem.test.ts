import { assert, assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
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
  Deno.test(`${openapi} by default, what holds a dangling ref is removed, with what uses it`, () => {
    for (const system of [undefined, { danglingRefs: [] } satisfies SystemSettings]) {
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

  Deno.test(`${openapi} system.danglingRefs ['schema']: a dangling schema ref stays, with a warning, and resolving it throws`, () => {
    const { toSchema, toOperation, issuesOf } = parse({ openapi, system: { danglingRefs: ['schema'] } })
    const owner = toSchema('Owner')

    assert(owner !== undefined && !owner.isRef() && owner.type === 'object')
    const ghost = owner.properties?.ghost
    assert(ghost !== undefined && ghost.isRef())
    assertThrows(() => ghost.resolve(), DanglingRefError, 'Ref "#/components/schemas/Missing" names nothing in the document')
    assert(toSchema('UsesOwner') !== undefined)

    // `parameter` is not listed, so the operation that holds it goes.
    assertEquals(toOperation('/pets'), undefined)
    assert(toOperation('/pet') !== undefined)

    const dangling = issuesOf('DANGLING_REF')
    assertEquals(
      dangling.filter(({ level }) => level === 'error').map(({ location }) => location),
      ['TEST:paths:/pets:get:parameters:0']
    )
    assertEquals(dangling.filter(({ level }) => level === 'warning').length, 2)
    assertEquals(issuesOf('INVALID_DEPENDENCY_REF').filter(issue => issue.location.includes('Owner')), [])
  })

  Deno.test(`${openapi} system.danglingRefs ['schema']: core's own walks read a dangling ref as unknown`, () => {
    const { toSchema } = parse({ openapi, system: { danglingRefs: ['schema'] } })
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
    for (const system of [undefined, { danglingRefs: ['schema'] } satisfies SystemSettings]) {
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
  Deno.test(`${openapi} a ref into the wrong bucket removes what holds it, whatever system.danglingRefs lists, and what it names stays`, () => {
    for (const system of [undefined, { danglingRefs: ['schema', 'requestBody'] } satisfies SystemSettings]) {
      // The wrong-bucket ref comes first, in `paths`, before the schema refs.
      const { toSchema, toOperation, issues } = parse({
        openapi,
        system,
        document: {
          paths: {
            '/a': { post: { requestBody: pet, responses: ok(pet) } },
            '/b': { get: { responses: ok(pet) } }
          },
          components: { schemas: { Pet: petSchema, Owner: { type: 'object', properties: { pet } } } }
        }
      })

      assert(toSchema('Pet') !== undefined && toSchema('Owner') !== undefined)
      assertEquals(toOperation('/a', 'post'), undefined)
      assert(toOperation('/b') !== undefined)
      assertEquals(
        issues.filter(issue => issue.level === 'error').map(({ type, location }) => ({ type, location })),
        [{ type: 'REF_TYPE_MISMATCH', location: 'TEST:paths:/a:post:requestBody' }]
      )
    }
  })

  Deno.test(`${openapi} an operation goes with a security scheme that names nothing, unless system.danglingRefs lists it`, () => {
    const cases = [undefined, { danglingRefs: ['schema'] } satisfies SystemSettings].flatMap(system =>
      [undefined, [{ alias: [] }]].map(root => ({ system, root }))
    )

    for (const { system, root } of cases) {
      const { toOperation, issuesOf } = parse({
        openapi,
        system,
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

    // Listed, the scheme stays, and resolving it throws for the generator to handle.
    const { toOperation } = parse({
      openapi,
      system: { danglingRefs: ['securityScheme'] },
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

  Deno.test(`${openapi} an example ref that names nothing removes the operation, unless system.danglingRefs lists 'example'`, () => {
    for (const listed of [false, true]) {
      const { toOperation, issuesOf } = parse({
        openapi,
        system: listed ? { danglingRefs: ['example'] } : undefined,
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

      assertEquals(toOperation('/ex') !== undefined, listed)
      // At the place the `$ref` is written: `examples` is traced once.
      assertEquals(
        issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
        [
          {
            level: listed ? 'warning' : 'error',
            location: 'TEST:paths:/ex:get:responses:200:content:application/json:examples:a'
          }
        ]
      )
    }
  })

  Deno.test(`${openapi} a parameter that names nothing removes what holds it unless listed, with one issue at the holder`, () => {
    for (const system of [undefined, { danglingRefs: ['schema'] } satisfies SystemSettings]) {
      const { toOperation, issuesOf } = parse({
        openapi,
        system,
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
    }
  })

  Deno.test(`${openapi} system.danglingRefs: only a dangling ref of a listed kind stays`, () => {
    const missing = (bucket: string) => ({ $ref: `#/components/${bucket}/Missing` })
    const document = {
      paths: {
        // A schema ref in each place a schema goes.
        '/schemas': {
          post: {
            parameters: [{ name: 'mode', in: 'query', schema: missing('schemas') }],
            requestBody: { content: { 'application/json': { schema: missing('schemas') } } },
            responses: ok(missing('schemas'))
          }
        },
        '/parameter': { get: { parameters: [missing('parameters')], responses: ok(pet) } },
        '/body': { post: { requestBody: missing('requestBodies'), responses: ok(pet) } },
        '/response': { get: { responses: { '200': missing('responses') } } },
        // A response that a client does not read: unless listed, removal takes the whole operation.
        '/error-response': { get: { responses: { ...ok(pet), '404': missing('responses') } } },
        '/header': {
          get: { responses: { '200': { description: 'ok', headers: { 'X-Rate': missing('headers') } } } }
        }
      },
      components: { schemas: { Pet: petSchema } }
    }

    const schemaOnly = parse({ openapi, system: { danglingRefs: ['schema'] }, document })
    const schemas = schemaOnly.toOperation('/schemas', 'post')
    assert(schemas !== undefined)
    assertEquals(schemas.toParams().map(({ name }) => name), ['mode'])
    assertEquals(schemaOnly.toOperation('/body', 'post'), undefined)
    for (const path of ['/parameter', '/response', '/error-response', '/header']) {
      assertEquals(schemaOnly.toOperation(path), undefined, path)
    }
    const errors = schemaOnly.issuesOf('DANGLING_REF').filter(({ level }) => level === 'error')
    assertEquals(errors.length, 5)
    assert(errors.every(({ message }) => /To keep it, list '\w+' in system\.danglingRefs\./.test(message)))

    // Each listed kind stays, and the generator decides: `toParams()` throws for a parameter.
    const all = parse({
      openapi,
      system: { danglingRefs: ['schema', 'parameter', 'requestBody', 'response', 'header'] },
      document
    })
    const parameter = all.toOperation('/parameter')
    assert(parameter !== undefined)
    assertThrows(() => parameter.toParams(), DanglingRefError)
    assert(all.toOperation('/body', 'post') !== undefined)
    for (const path of ['/response', '/error-response', '/header']) {
      assert(all.toOperation(path) !== undefined, path)
    }
    assertEquals(all.issuesOf('DANGLING_REF').filter(({ level }) => level === 'error'), [])
  })

  Deno.test(`${openapi} a dangling member of an allOf that core merges: removed unless 'allOfMember' is listed, then left out of the merge`, () => {
    // `schema` does not cover it: here core, not the generator, decides.
    const cases = [
      { system: undefined, listed: false },
      { system: { danglingRefs: ['schema'] } satisfies SystemSettings, listed: false },
      { system: { danglingRefs: ['allOfMember'] } satisfies SystemSettings, listed: true }
    ]

    for (const { system, listed } of cases) {
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

      const g = toSchema('G')
      assertEquals(g !== undefined, listed)
      // `A & unknown` is `A`: the merge is the other member.
      if (g !== undefined) {
        assert(!g.isRef() && g.type === 'object')
        assertEquals(Object.keys(g.properties ?? {}), ['id'])
      }
      assertEquals(
        issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
        [{ level: listed ? 'warning' : 'error', location: 'TEST:components:schemas:G' }]
      )
      assertEquals(issuesOf('INVALID_SCHEMA'), [])
    }
  })

  Deno.test(`${openapi} a dangling ref that core merges in a oneOf or anyOf: removed unless 'allOfMember' is listed, then left out of the merge`, () => {
    const missing = { $ref: '#/components/schemas/Missing' }
    const objectWith = (name: string) => ({ type: 'object', properties: { [name]: { type: 'string' } } })
    // Core merges a member's own `allOf`, and each member with the keywords
    // beside the union. Each member is listed by its properties, or its type.
    const unions = [
      { U: { oneOf: [{ allOf: [missing, objectWith('u')] }, { type: 'string' }] }, members: ['u', 'string'] },
      { U: { anyOf: [{ allOf: [missing, objectWith('u')] }, { type: 'string' }] }, members: ['u', 'string'] },
      { U: { ...objectWith('id'), oneOf: [missing, objectWith('b')] }, members: ['id', 'id,b'] }
    ]
    const cases = [
      { system: undefined, listed: false },
      { system: { danglingRefs: ['schema'] } satisfies SystemSettings, listed: false },
      { system: { danglingRefs: ['allOfMember'] } satisfies SystemSettings, listed: true }
    ]
    const toMember = (member: OasSchema | OasRef<'schema'>): string => {
      if (member.isRef()) {
        return member.$ref
      }

      return member.type === 'object' ? Object.keys(member.properties ?? {}).join(',') : member.type
    }

    for (const { U, members } of unions) {
      for (const { system, listed } of cases) {
        const { toSchema, issuesOf } = parse({ openapi, system, document: { components: { schemas: { U } } } })

        // Never a union with the member dropped and no issue.
        const u = toSchema('U')
        assertEquals(u !== undefined, listed)
        if (u !== undefined) {
          assert(!u.isRef() && u.type === 'union')
          assertEquals(u.members.map(toMember), members)
        }
        assertEquals(
          issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
          [{ level: listed ? 'warning' : 'error', location: 'TEST:components:schemas:U' }]
        )
      }
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

  // `%20` and `~1` refs to `Foo Bar` and `a/b`, held by operations and by a schema.
  const escapedRefHolders = {
    '/r': { get: { responses: ok({ $ref: '#/components/schemas/Foo%20Bar' }) } },
    '/s': { get: { responses: ok({ $ref: '#/components/schemas/a~1b' }) } }
  }
  const usesEscaped = {
    type: 'object',
    properties: { r: { $ref: '#/components/schemas/Foo%20Bar' }, s: { $ref: '#/components/schemas/a~1b' } }
  }

  Deno.test(`${openapi} an escaped ref to a schema that fails to parse goes with it, under either setting`, () => {
    for (const system of [undefined, { danglingRefs: ['schema'] } satisfies SystemSettings]) {
      const broken = { not: { type: 'string' } }
      const { toSchema, toOperation, issuesOf } = parse({
        openapi,
        system,
        document: {
          paths: escapedRefHolders,
          components: { schemas: { 'Foo Bar': broken, 'a/b': broken, UsesEscaped: usesEscaped } }
        }
      })

      assertEquals(toOperation('/r'), undefined)
      assertEquals(toOperation('/s'), undefined)
      assertEquals(toSchema('UsesEscaped'), undefined)
      assertEquals(issuesOf('DANGLING_REF'), [])
      assertEquals(
        issuesOf('INVALID_DEPENDENCY_REF').map(({ location }) => location).sort(),
        [
          // Removed by the first of its two refs; the second finds it gone.
          'TEST:components:schemas:UsesEscaped:properties:r',
          'TEST:paths:/r:get:responses:200:content:application/json:schema',
          'TEST:paths:/s:get:responses:200:content:application/json:schema'
        ]
      )
    }
  })

  Deno.test(`${openapi} by default, an escaped ref goes with a schema that holds a dangling ref`, () => {
    const holdsDangling = { type: 'object', properties: { ghost: { $ref: '#/components/schemas/Missing' } } }
    const { toSchema, toOperation, issuesOf } = parse({
      openapi,
      system: undefined,
      document: {
        paths: escapedRefHolders,
        components: { schemas: { 'Foo Bar': holdsDangling, 'a/b': holdsDangling, UsesEscaped: usesEscaped } }
      }
    })

    assertEquals(toSchema('Foo Bar'), undefined)
    assertEquals(toSchema('UsesEscaped'), undefined)
    assertEquals(toOperation('/r'), undefined)
    assertEquals(toOperation('/s'), undefined)
    assertEquals(
      issuesOf('DANGLING_REF').map(({ location }) => location),
      ['TEST:components:schemas:Foo Bar:properties:ghost', 'TEST:components:schemas:a/b:properties:ghost']
    )
  })

  Deno.test(`${openapi} a $ref with no name names nothing`, () => {
    const { toOperation, issuesOf } = parse({
      openapi,
      system: undefined,
      document: { paths: { '/slash': { get: { responses: ok({ $ref: '#/components/schemas/' }) } } } }
    })

    assertEquals(toOperation('/slash'), undefined)
    assertEquals(
      issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [{ level: 'error', location: 'TEST:paths:/slash:get:responses:200:content:application/json:schema' }]
    )
    assertEquals(issuesOf('REF_TYPE_MISMATCH'), [])
  })

  Deno.test(`${openapi} a loop of parameter $refs names nothing: by default what uses it goes, and an operation without it stays`, () => {
    const { toOperation, issuesOf } = parse({ openapi, system: undefined, document: parameterLoop })

    assertEquals(toOperation('/a'), undefined)
    assert(toOperation('/b') !== undefined)
    // At the first `$ref` of the loop. Removing `P1` removes what uses it: `P2`,
    // the rest of the loop, and `/a`, whose own `$ref` names `P1`.
    assertEquals(
      issuesOf('DANGLING_REF').map(({ level, location, message }) => ({ level, location, message })),
      [
        {
          level: 'error',
          location: 'TEST:components:parameters:P1',
          message:
            "Ref \"#/components/parameters/P2\" names nothing in the document: its $refs loop (#/components/parameters/P2 → #/components/parameters/P1 → #/components/parameters/P2), so what holds it is removed. To keep it, list 'parameter' in system.danglingRefs."
        }
      ]
    )
    assertEquals(
      issuesOf('INVALID_DEPENDENCY_REF').map(({ location }) => location),
      ['TEST:paths:/a:get:parameters:0', 'TEST:components:parameters:P2']
    )
  })

  Deno.test(`${openapi} system.danglingRefs ['parameter']: a loop of parameter $refs stays, with a warning, and resolving it throws DanglingRefError`, () => {
    const { toOperation, issuesOf } = parse({ openapi, system: { danglingRefs: ['parameter'] }, document: parameterLoop })
    const a = toOperation('/a')

    assert(a !== undefined)
    assert(toOperation('/b') !== undefined)

    // It threw `Max lookups reached` here, before a generator saw the parameter.
    const parameters = a.toEffectiveParameters()
    const [parameter] = parameters

    assertEquals(parameters.length, 1)
    assert(parameter?.isRef())
    assertEquals(assertThrows(() => parameter.resolve(), DanglingRefError).loop, [
      '#/components/parameters/P2',
      '#/components/parameters/P1'
    ])
    assertEquals(
      issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [
        { level: 'warning', location: 'TEST:components:parameters:P1' },
        { level: 'warning', location: 'TEST:components:parameters:P2' }
      ]
    )
  })

  Deno.test(`${openapi} a loop of schema $refs names nothing, and a $ref into it is reported at the loop, not where it is written`, () => {
    const removed = parse({ openapi, system: undefined, document: schemaLoop })

    assertEquals(removed.toSchema('A'), undefined)
    assertEquals(removed.toSchema('B'), undefined)
    assertEquals(removed.toSchema('Owner'), undefined)
    assertEquals(removed.toOperation('/owner'), undefined)
    assert(removed.toOperation('/pet') !== undefined)
    // `Owner`'s `$ref` names `A`, which is there: it goes as an item that uses `A`.
    assertEquals(removed.issuesOf('DANGLING_REF').map(({ location }) => location), ['TEST:components:schemas:A'])
    assertEquals(
      removed.issuesOf('INVALID_DEPENDENCY_REF').map(({ location }) => location),
      [
        'TEST:components:schemas:B',
        'TEST:components:schemas:Owner:properties:a',
        'TEST:paths:/owner:get:responses:200:content:application/json:schema'
      ]
    )

    const kept = parse({ openapi, system: { danglingRefs: ['schema'] }, document: schemaLoop })
    const owner = kept.toSchema('Owner')

    assert(owner !== undefined && !owner.isRef() && owner.type === 'object')
    const a = owner.properties?.a
    assert(a !== undefined && a.isRef())
    // One step still names a component, so a generator can link to it.
    assertStrictEquals(a.resolveOnce(), kept.toSchema('A'))
    assertThrows(() => a.resolve(), DanglingRefError)
    assertEquals(
      kept.issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [
        { level: 'warning', location: 'TEST:components:schemas:A' },
        { level: 'warning', location: 'TEST:components:schemas:B' }
      ]
    )
  })

  Deno.test(`${openapi} a loop of response $refs names nothing, unless system.danglingRefs lists 'response'`, () => {
    const removed = parse({ openapi, system: undefined, document: responseLoop })

    assertEquals(removed.toOperation('/r'), undefined)
    assert(removed.toOperation('/pet') !== undefined)
    assertEquals(
      removed.issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [{ level: 'error', location: 'TEST:components:responses:R1' }]
    )

    const kept = parse({ openapi, system: { danglingRefs: ['response'] }, document: responseLoop })
    const response = kept.toOperation('/r')?.responses['200']

    assert(response !== undefined && response.isRef())
    assertThrows(() => response.resolve(), DanglingRefError)
    assertEquals(
      kept.issuesOf('DANGLING_REF').map(({ level, location }) => ({ level, location })),
      [
        { level: 'warning', location: 'TEST:components:responses:R1' },
        { level: 'warning', location: 'TEST:components:responses:R2' }
      ]
    )
  })
}

// skmtc/skmtc#364. Each step of a loop names a component, so the parser kept
// it, and resolving it threw a plain `Max lookups reached` that failed the run.
const parameterLoop = {
  paths: {
    '/a': { get: { parameters: [{ $ref: '#/components/parameters/P1' }], responses: ok(pet) } },
    '/b': { get: { responses: ok(pet) } }
  },
  components: {
    schemas: { Pet: petSchema },
    parameters: {
      P1: { $ref: '#/components/parameters/P2' },
      P2: { $ref: '#/components/parameters/P1' }
    }
  }
}

const schemaLoop = {
  paths: {
    '/owner': { get: { responses: ok({ $ref: '#/components/schemas/Owner' }) } },
    '/pet': { get: { responses: ok(pet) } }
  },
  components: {
    schemas: {
      Pet: petSchema,
      A: { $ref: '#/components/schemas/B' },
      B: { $ref: '#/components/schemas/A' },
      Owner: { type: 'object', properties: { a: { $ref: '#/components/schemas/A' } } }
    }
  }
}

const responseLoop = {
  paths: {
    '/r': { get: { responses: { '200': { $ref: '#/components/responses/R1' } } } },
    '/pet': { get: { responses: ok(pet) } }
  },
  components: {
    schemas: { Pet: petSchema },
    responses: {
      R1: { $ref: '#/components/responses/R2' },
      R2: { $ref: '#/components/responses/R1' }
    }
  }
}
