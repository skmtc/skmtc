/**
 * `system.intersections`: which refs stay refs where the merge would inline
 * their target. Each document is parsed under a time and heap bound.
 */

import { assert, assertEquals } from '@std/assert'
import { parseBounded } from '@/test/parseBounded.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const text = { type: 'string' }
const toObject = (properties: Record<string, unknown>) => ({ type: 'object', properties })

/** The `allOf` of a schema that is an intersection, with each ref as its `$ref`. */
const toAllOf = (schema: unknown): unknown[] => {
  assert(typeof schema === 'object' && schema !== null && 'allOf' in schema && Array.isArray(schema.allOf), `not an intersection: ${JSON.stringify(schema)}`)

  return schema.allOf.map(member => (isRefTo(member) ? member.$ref : member))
}

const isRefTo = (value: unknown): value is { $ref: string } =>
  typeof value === 'object' && value !== null && '$ref' in value

/** The value at a path in a schema, as `toJsonSchema` writes it. */
const at = (schema: unknown, ...path: (string | number)[]): unknown =>
  path.reduce<unknown>((value, key) => (typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined), schema)

const geometryNames = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']

const geometries = {
  Geometry: { type: 'object', properties: { type: { oneOf: geometryNames.map(ref) } } },
  ...Object.fromEntries(
    geometryNames.map(name => [name, { allOf: [ref('Geometry'), toObject({ coordinates: text })] }])
  )
}

const navigation = { type: 'object', nullable: true, anyOf: [ref('Account')] }
const widgetNames = Array.from({ length: 30 }, (_, index) => `Widget${index}`)

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} properties that allOf their own schema (amplifyuibuilder)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          p: { allOf: [ref('A'), { description: 'p' }] },
          q: { allOf: [ref('A'), { description: 'q' }] }
        })
      }
    })

    assertEquals(toAllOf(at(schemas.A, 'properties', 'p')), ['#/components/schemas/A', { description: 'p' }])
    assertEquals(toAllOf(at(schemas.A, 'properties', 'q')), ['#/components/schemas/A', { description: 'q' }])
  })

  Deno.test(`${openapi} a subtype that allOfs a base whose property lists it (GeoJSON)`, async () => {
    const { schemas } = await parseBounded({ openapi, schemas: geometries })

    geometryNames.forEach(name => {
      const [base, own] = toAllOf(schemas[name])

      assertEquals(base, '#/components/schemas/Geometry')
      assertEquals(at(own, 'properties', 'coordinates', 'type'), 'string')
    })
  })

  Deno.test(`${openapi} a union member that wraps the union's base (wiremock-cloud)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: { oneOf: [ref('B'), ref('C'), ref('D')] },
        B: toObject({ m: { oneOf: [{ allOf: [ref('A')], description: 'm' }, text] } }),
        C: toObject({ n: { allOf: [ref('A'), { description: 'n' }] } }),
        D: toObject({ s: text })
      }
    })

    assertEquals(at(schemas.B, 'properties', 'm', 'oneOf', 0), { ...ref('A'), description: 'm' })
    assertEquals(toAllOf(at(schemas.C, 'properties', 'n')), ['#/components/schemas/A', { description: 'n' }])
  })

  Deno.test(`${openapi} a keyword beside a union whose member leads back (churnzero)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { Account: toObject({ Parent: navigation, Owner: navigation, Root: navigation }) }
    })

    for (const name of ['Parent', 'Owner', 'Root']) {
      // The target is an object already, so `type: object` adds no member.
      assertEquals(at(schemas.Account, 'properties', name), { ...ref('Account'), nullable: true })
    }
  })

  Deno.test(`${openapi} a type beside a kept ref is a member only when the target does not declare it`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        Obj: toObject({ a: text }),
        Alias: { allOf: [ref('Obj')] },
        Int: { type: 'integer' },
        Num: { type: 'number' },
        Either: { oneOf: [ref('Obj'), toObject({ c: text })] },
        Mixed: { oneOf: [ref('Obj'), text] },
        Untyped: { description: 'any' },
        same: { allOf: [ref('Obj'), { type: 'object' }] },
        reversed: { allOf: [{ type: 'object' }, ref('Obj')] },
        alias: { allOf: [ref('Alias'), { type: 'object' }] },
        wider: { allOf: [ref('Int'), { type: 'number' }] },
        union: { allOf: [ref('Either'), { type: 'object' }] },
        narrower: { allOf: [ref('Num'), { type: 'integer' }] },
        mixed: { allOf: [ref('Mixed'), { type: 'object' }] },
        untyped: { allOf: [ref('Untyped'), { type: 'object' }] },
        required: { allOf: [ref('Obj'), { type: 'object', required: ['a'] }] },
        two: { allOf: [ref('Obj'), ref('Either'), { type: 'object' }] }
      },
      system: { intersections: 'all' }
    })

    const target = { same: 'Obj', reversed: 'Obj', alias: 'Alias', wider: 'Int', union: 'Either' }

    for (const [name, expected] of Object.entries(target)) {
      assertEquals(schemas[name], ref(expected), name)
    }

    for (const name of ['narrower', 'mixed', 'untyped', 'required']) {
      assertEquals(toAllOf(schemas[name]).length, 2, name)
    }

    assertEquals(toAllOf(schemas.two), ['#/components/schemas/Obj', '#/components/schemas/Either'])
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} a type beside a kept ref stays when it rules out the null of the target`, async () => {
    const orNull = openapi === '3.0.3' ? { type: 'object', nullable: true } : { type: ['object', 'null'] }
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Obj: toObject({ a: text }),
        Nullable: { ...toObject({ a: text }), ...orNull },
        Alias: { allOf: [ref('Nullable')] },
        Either: { oneOf: [ref('Obj'), ref('Nullable')] },
        nullable: { allOf: [ref('Nullable'), { type: 'object' }] },
        alias: { allOf: [ref('Alias'), { type: 'object' }] },
        either: { allOf: [ref('Either'), { type: 'object' }] },
        two: { allOf: [ref('Obj'), ref('Nullable'), { type: 'object' }] },
        union: { type: 'object', oneOf: [ref('Nullable'), toObject({ b: text })] },
        siteNull: { allOf: [ref('Obj'), orNull] },
        bothNull: { allOf: [ref('Nullable'), orNull] }
      },
      system: { intersections: 'all' }
    })

    for (const name of ['nullable', 'alias', 'either']) {
      assertEquals(at(toAllOf(schemas[name])[1], 'type'), 'object', name)
    }

    assertEquals(toAllOf(schemas.two).length, 3)
    assertEquals(toAllOf(at(schemas.union, 'oneOf', 0)).includes('#/components/schemas/Nullable'), true)
    assertEquals(schemas.siteNull, { ...ref('Obj'), nullable: true })
    assertEquals(schemas.bothNull, { ...ref('Nullable'), nullable: true })
  })

  Deno.test(`${openapi} two types that lean on each other stay, so no ref loops to itself`, async () => {
    const schemas = {
      Self: { type: 'object', anyOf: [ref('Self')] },
      First: { allOf: [ref('Second'), { type: 'object' }] },
      Second: { allOf: [ref('First')] },
      Left: { type: 'object', oneOf: [ref('Right')] },
      Right: { type: 'object', oneOf: [ref('Left')] },
      User: toObject({ a: ref('Self'), b: ref('First'), c: ref('Left') })
    }
    const result = await parseBounded({ openapi, schemas })

    // The trap: a target that declares its type only by the member that is left out is a `DANGLING_REF` loop.
    assertEquals(result.issues, [])
    assertEquals(Object.keys(result.schemas), Object.keys(schemas))

    for (const name of ['Self', 'First', 'Left', 'Right']) {
      assertEquals(toAllOf(result.schemas[name]).length, 2, name)
    }
  })

  Deno.test(`${openapi} a type stays beside a ref that cannot hold what is at the site`, async () => {
    const site = (keywords: Record<string, unknown>) => ({ type: 'object', nullable: true, anyOf: [ref('A')], ...keywords })
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          byDefault: site({ default: null }),
          byExample: site({ example: null }),
          byDeprecated: site({ deprecated: true }),
          byDocs: { allOf: [ref('A'), { type: 'object' }], externalDocs: { url: 'https://example.com' } },
          byNot: site({ not: text }),
          held: site({ title: 't', description: 'd', readOnly: true, 'x-own': 1 })
        })
      },
      system: { not: 'unknown' }
    })
    const property = (name: string) => at(schemas.A, 'properties', name)

    for (const name of ['byDefault', 'byExample', 'byDeprecated', 'byDocs', 'byNot']) {
      assertEquals(toAllOf(property(name)).length, 2, name)
    }

    assertEquals(at(property('byDefault'), 'default'), null)
    assertEquals(at(property('byDeprecated'), 'deprecated'), true)
    assertEquals(at(property('byDocs'), 'externalDocs'), 'https://example.com')
    assertEquals(property('held'), { ...ref('A'), nullable: true, readOnly: true, description: 'd' })
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} a type stays when the target does not declare it as it is parsed`, async () => {
    const unknownAnyOf = await parseBounded({
      openapi,
      schemas: {
        Any: { anyOf: [toObject({ n: ref('N') }), toObject({ b: text })] },
        N: { allOf: [ref('Any'), { type: 'object' }] }
      },
      system: { anyOf: 'unknown' }
    })
    const contradiction = await parseBounded({
      openapi,
      schemas: {
        T: { allOf: [text, { type: 'integer' }] },
        N: { allOf: [ref('T'), { type: 'object' }] }
      },
      system: { allOf: 'latestWins', intersections: 'all' }
    })

    assertEquals(toAllOf(unknownAnyOf.schemas.N).length, 2)
    assertEquals(toAllOf(contradiction.schemas.N).length, 2)
  })

  Deno.test(`${openapi} a schema with a type that lists itself in its own union keeps the ref`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { Plan: { type: 'object', oneOf: [ref('Plan'), toObject({ p: text })] } }
    })

    // The trap: the type that `Plan` declares is the one beside its own union, so it stays.
    assertEquals(toAllOf(at(schemas.Plan, 'oneOf', 0)).includes('#/components/schemas/Plan'), true)
    assertEquals(at(schemas.Plan, 'oneOf', 1, 'type'), 'object')
  })

  Deno.test(`${openapi} a keyword beside a large union with a member that leads back (port)`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        DashboardWidget: toObject({
          widgets: {
            type: 'array',
            items: { type: 'object', anyOf: [...widgetNames.map(ref), ref('DashboardWidget')] }
          }
        }),
        ...Object.fromEntries(widgetNames.map(name => [name, toObject({ [name]: text })]))
      }
    })

    const members = at(schemas.DashboardWidget, 'properties', 'widgets', 'items', 'oneOf')

    assertEquals(at(members, 30), ref('DashboardWidget'))
    // The members that do not lead back merge, as they always did.
    assertEquals(at(members, 0, 'properties', 'Widget0', 'type'), 'string')
    assertEquals(issues.filter(({ level }) => level === 'error'), [])
  })

  Deno.test(`${openapi} a union base whose subtypes allOf it keeps the ref (PaymentAccountDetails)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Details: { oneOf: [ref('ACH'), ref('Wire')], discriminator: { propertyName: 'kind' } },
        ACH: { allOf: [ref('Details'), toObject({ kind: text, routing: text })] },
        Wire: { allOf: [ref('Details'), toObject({ kind: text, swift: text })] }
      }
    })

    assertEquals(toAllOf(schemas.ACH)[0], '#/components/schemas/Details')
    assertEquals(toAllOf(schemas.Wire)[0], '#/components/schemas/Details')
    assertEquals(at(schemas.Details, 'oneOf'), [ref('ACH'), ref('Wire')])
  })

  Deno.test(`${openapi} a schema that lists itself in its own union keeps the ref (FeaturePlan)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { FeaturePlan: { ...toObject({ name: text }), oneOf: [ref('FeaturePlan')] } }
    })

    const [object, self] = toAllOf(schemas.FeaturePlan)

    assertEquals(at(object, 'properties', 'name', 'type'), 'string')
    assertEquals(self, '#/components/schemas/FeaturePlan')
  })

  Deno.test(`${openapi} an annotation-only member, with no type guessed from its example`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: { A: toObject({ p: { allOf: [ref('A'), { description: 'd', example: 'e' }] } }) }
    })

    assertEquals(toAllOf(at(schemas.A, 'properties', 'p')), [
      '#/components/schemas/A',
      { description: 'd', example: 'e' }
    ])
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} a one-member allOf of a ref that leads back is a ref, not an intersection`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { A: toObject({ p: { allOf: [ref('A')], nullable: true } }) }
    })

    assertEquals(at(schemas.A, 'properties', 'p'), { ...ref('A'), nullable: true })
  })

  Deno.test(`${openapi} a union member that contradicts the keyword beside the union is left out (Cube Cloud)`, async () => {
    const member = (target: string) => ({ type: 'array', items: { type: 'string', oneOf: [text, ref(target)] } })
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        Folder: toObject({ direct: member('Folder'), alias: member('Alias'), union: member('Node'), allOf: member('Sub') }),
        Alias: ref('Folder'),
        Node: { oneOf: [ref('Folder'), ref('File')] },
        File: toObject({ folder: ref('Folder') }),
        Sub: { allOf: [ref('Folder'), { description: 'sub' }] }
      }
    })

    for (const name of ['direct', 'alias', 'union', 'allOf']) {
      assertEquals(at(schemas.Folder, 'properties', name, 'items', 'type'), 'string', name)
    }
    assertEquals(issues.filter(({ level }) => level === 'error'), [])
  })

  Deno.test(`${openapi} a cycle through a $defs ref, beside a target with the same last segment`, async () => {
    const pointer = '#/components/schemas/Root/$defs/node'
    const items = { type: 'object', anyOf: [{ $ref: pointer }, toObject({ leaf: text })] }
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Root: {
          ...toObject({ top: { $ref: pointer } }),
          $defs: { node: toObject({ children: { type: 'array', items } }) }
        },
        Other: {
          ...toObject({ p: { allOf: [{ $ref: '#/components/schemas/Other/$defs/node' }, { description: 'p' }] } }),
          $defs: { node: toObject({ x: text }) }
        }
      },
      targets: [pointer]
    })

    const member = at(schemas[pointer], 'properties', 'children', 'items', 'oneOf', 0)

    assertEquals(member, { $ref: pointer })
    assertEquals(at(schemas.Other, 'properties', 'p', 'properties', 'x', 'type'), 'string')
  })

  Deno.test(`${openapi} a deep target parses to the same intersections as inside its schema`, async () => {
    const pointer = '#/components/schemas/A/properties/p'
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({ p: toObject({ q: { allOf: [{ $ref: pointer }, { description: 'q' }] }, a: { allOf: [ref('A'), { description: 'a' }] } }) })
      },
      targets: [pointer]
    })

    const inside = at(schemas.A, 'properties', 'p')

    assertEquals(schemas[pointer], inside)
    assertEquals(toAllOf(at(inside, 'properties', 'q')), [pointer, { description: 'q' }])
    assertEquals(toAllOf(at(inside, 'properties', 'a')), ['#/components/schemas/A', { description: 'a' }])
  })

  Deno.test(`${openapi} refs to a target outside the components, from an operation only`, async () => {
    const pointer = '#/paths/~1a/get/x-models/Node'
    const { schemas } = await parseBounded({
      openapi,
      schemas: {},
      paths: {
        '/a': {
          get: {
            'x-models': { Node: toObject({ n: { allOf: [{ $ref: pointer }, { description: 'n' }] }, m: { allOf: [{ $ref: pointer }, { description: 'm' }] } }) },
            responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: pointer } } } } }
          }
        }
      },
      targets: [pointer]
    })

    assertEquals(toAllOf(at(schemas[pointer], 'properties', 'n')), [pointer, { description: 'n' }])
  })

  Deno.test(`${openapi} an alias loop names nothing`, async () => {
    const { issues, schemas } = await parseBounded({
      openapi,
      schemas: { A: ref('B'), B: ref('A'), C: { allOf: [ref('A'), toObject({ c: text })] } }
    })

    assert(issues.some(({ type, message }) => type === 'DANGLING_REF' && message.includes('loop')))
    assertEquals(Object.keys(schemas), [])
  })

  Deno.test(`${openapi} members beside a kept ref that contradict each other fail, or merge under latestWins`, async () => {
    const schemas = { A: toObject({ p: { allOf: [ref('A'), text, { type: 'number' }] } }), B: text }
    const strict = await parseBounded({ openapi, schemas })
    const latestWins = await parseBounded({ openapi, schemas, system: { allOf: 'latestWins' } })

    assertEquals(Object.keys(strict.schemas), ['B'])
    assert(strict.issues.some(({ level, type }) => level === 'error' && type === 'INVALID_SCHEMA'))
    assertEquals(toAllOf(at(latestWins.schemas.A, 'properties', 'p')), ['#/components/schemas/A', { type: 'number' }])
    assert(latestWins.issues.some(({ type }) => type === 'ALLOF_CONTRADICTION'))
  })

  Deno.test(`${openapi} the members that are not kept refs merge into one, at the place of the first`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: {
          title: 'a',
          description: 'd',
          properties: { before: text },
          allOf: [ref('Mixin'), ref('A'), { allOf: [toObject({ inner: text }), ref('Back')] }],
          required: ['before']
        },
        Back: toObject({ a: ref('A') }),
        Mixin: toObject({ mixed: text })
      }
    })

    const [object, ...refs] = toAllOf(schemas.A)

    assertEquals(refs, ['#/components/schemas/A', '#/components/schemas/Back'])
    assertEquals(Object.keys(at(object, 'properties') ?? {}).sort(), ['before', 'inner', 'mixed'])
    assertEquals(at(object, 'required'), ['before'])
    assertEquals([at(schemas.A, 'title'), at(schemas.A, 'description')], ['a', 'd'])
    assertEquals(at(object, 'description'), undefined)
  })

  Deno.test(`${openapi} a member's nullable, readOnly and default are the whole intersection's`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          p: { allOf: [ref('A'), { nullable: true, readOnly: true, default: {}, description: 'p' }] },
          q: { allOf: [ref('A'), { nullable: true, readOnly: true }] }
        })
      }
    })

    const p = at(schemas.A, 'properties', 'p')

    assertEquals(toAllOf(p), ['#/components/schemas/A', { description: 'p' }])
    assertEquals([at(p, 'nullable'), at(p, 'readOnly'), at(p, 'default')], [true, true, {}])
    // With nothing else beside the ref, it is a nullable ref.
    assertEquals(at(schemas.A, 'properties', 'q'), { ...ref('A'), nullable: true, readOnly: true })
  })

  Deno.test(`${openapi} a member that is readOnly and one that is writeOnly contradict beside a kept ref`, async () => {
    const schemas = {
      A: toObject({ p: { allOf: [ref('A'), { readOnly: true }, { writeOnly: true }] } }),
      B: toObject({ p: { readOnly: true, allOf: [ref('B'), { writeOnly: true, description: 'p' }] } })
    }
    const { schemas: parsed, issues } = await parseBounded({ openapi, schemas })

    assertEquals(Object.keys(parsed), [])
    assertEquals(issues.filter(({ type }) => type === 'INVALID_SCHEMA').length, 2)
  })

  Deno.test(`${openapi} the null of a nullable member's enum and example goes with its nullable`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        A: { oneOf: [text, ref('W')] },
        W: toObject({ p: { allOf: [ref('A'), { type: 'string', nullable: true, enum: ['a', null], example: null }] } })
      }
    })
    const property = at(schemas.W, 'properties', 'p')

    assertEquals(toAllOf(property), ['#/components/schemas/A', { type: 'string', enum: ['a'] }])
    assertEquals(at(property, 'nullable'), true)
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} a member of object keywords only keeps them`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        Node: toObject({ id: text, children: { type: 'array', items: ref('Child') } }),
        Child: { allOf: [ref('Node'), { required: ['id'], minProperties: 2 }] }
      }
    })
    const [, own] = toAllOf(schemas.Child)

    assertEquals([at(own, 'type'), at(own, 'required'), at(own, 'minProperties')], ['object', ['id'], 2])
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} the same ref in two merged members stays one ref, when one is outside the cycle`, async () => {
    const own = { parent: ref('Base'), kids: { type: 'array', items: ref('Base') }, map: { type: 'object', additionalProperties: ref('Base') } }
    const { schemas } = await parseBounded({
      openapi,
      schemas: { Base: toObject(own), Outside: { allOf: [ref('Base'), toObject(own)] }, Reversed: { allOf: [toObject(own), ref('Base')] } }
    })

    for (const name of ['Outside', 'Reversed']) {
      assertEquals(at(schemas[name], 'properties', 'parent'), ref('Base'))
      assertEquals(at(schemas[name], 'properties', 'kids', 'items'), ref('Base'))
      assertEquals(at(schemas[name], 'properties', 'map', 'additionalProperties'), ref('Base'))
    }
  })

  Deno.test(`${openapi} one kept ref twice stays kept`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { A: toObject({ p: { allOf: [ref('A'), ref('A'), { description: 'p' }] } }) }
    })

    assertEquals(toAllOf(at(schemas.A, 'properties', 'p')), ['#/components/schemas/A', { description: 'p' }])
  })

  Deno.test(`${openapi} a member's not and anyOf are read, and the wrapper's own keywords stay`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          negated: { allOf: [ref('A'), { not: text }] },
          either: { allOf: [ref('A'), { anyOf: [ref('B'), text] }] },
          own: {
            deprecated: true,
            example: { e: 1 },
            'x-own': 1,
            externalDocs: { url: 'https://example.com' },
            allOf: [ref('A'), toObject({ x: text })]
          }
        }),
        B: toObject({ b: text })
      },
      system: { not: 'unknown' }
    })
    const property = (name: string) => at(schemas.A, 'properties', name)

    assertEquals(toAllOf(property('negated')), ['#/components/schemas/A', { not: {} }])
    assertEquals(at(toAllOf(property('either'))[1], 'oneOf', 0), ref('B'))
    assertEquals(
      ['deprecated', 'example', 'x-own', 'externalDocs'].map(key => at(property('own'), key)),
      [true, { e: 1 }, 1, 'https://example.com']
    )
  })

  Deno.test(`${openapi} a null-only member makes the ref nullable and leaves no member`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          p: { allOf: [ref('A'), { nullable: true, enum: [null] }] },
          q: { allOf: [ref('A'), { oneOf: [toObject({ x: text }), { nullable: true, enum: [null] }] }] }
        })
      }
    })

    assertEquals(at(schemas.A, 'properties', 'p'), { ...ref('A'), nullable: true })
    assertEquals(at(schemas.A, 'properties', 'q', 'nullable'), true)
    assertEquals(at(toAllOf(at(schemas.A, 'properties', 'q'))[1], 'properties', 'x', 'type'), 'string')
  })

  Deno.test(`${openapi} keywords beside an allOf of a ref outside the cycle stay on the intersection`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Outside: { description: 'outside', allOf: [ref('A'), toObject({ own: text })] },
        A: { allOf: [ref('B'), toObject({ a: text })] },
        B: toObject({ back: ref('A') })
      }
    })

    assertEquals(at(schemas.Outside, 'description'), 'outside')
    assertEquals(at(toAllOf(schemas.Outside)[1], 'description'), undefined)
  })

  Deno.test(`${openapi} a contradicting union member stays under latestWins when it is the only one`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: { F: toObject({ p: { type: 'string', oneOf: [ref('F')] } }) },
      system: { allOf: 'latestWins' }
    })

    assertEquals(toAllOf(at(schemas.F, 'properties', 'p'))[1], '#/components/schemas/F')
    assertEquals(issues.filter(({ level }) => level === 'error'), [])
  })

  Deno.test(`${openapi} a member with the keywords of one type only is that type`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        List: { type: 'array', items: ref('Item') },
        Item: toObject({ subs: { allOf: [ref('List'), { minItems: 1 }] } }),
        Node: toObject({ x: text, y: text, sub: ref('Sub') }),
        Sub: { allOf: [ref('Node'), { oneOf: [{ required: ['x'] }, { required: ['y'] }] }] }
      }
    })
    const all = await parseBounded({
      openapi,
      schemas: {
        Name: text,
        Count: { type: 'number' },
        Short: { allOf: [ref('Name'), { minLength: 3, pattern: 'x' }] },
        Small: { allOf: [ref('Count'), { maximum: 5 }] }
      },
      system: { intersections: 'all' }
    })
    const list = toAllOf(at(schemas.Item, 'properties', 'subs'))[1]

    assertEquals([at(list, 'type'), at(list, 'minItems')], ['array', 1])
    assertEquals(at(toAllOf(schemas.Sub)[1], 'oneOf', 0, 'required'), ['x'])
    assertEquals(at(toAllOf(schemas.Sub)[1], 'oneOf', 1, 'required'), ['y'])
    assertEquals([at(toAllOf(all.schemas.Short)[1], 'minLength'), at(toAllOf(all.schemas.Short)[1], 'pattern')], [3, 'x'])
    assertEquals(at(toAllOf(all.schemas.Small)[1], 'maximum'), 5)
    assertEquals([...issues, ...all.issues], [])
  })

  Deno.test(`${openapi} a null allOf in a member beside a kept ref is no allOf`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        A: { allOf: [ref('B'), { ...toObject({ x: text }), allOf: null }] },
        B: toObject({ a: ref('A') })
      }
    })

    assertEquals(at(toAllOf(schemas.A)[1], 'properties', 'x', 'type'), 'string')
    assertEquals(issues.map(({ type }) => type), ['UNEXPECTED_PROPERTY'])
  })

  Deno.test(`${openapi} nested unions that share their members parse within the heap`, async () => {
    const levels = 25
    const unions = Object.fromEntries(
      Array.from({ length: levels }, (_, index) => [
        `U${index}`,
        { oneOf: [ref(`U${index + 1}`), { oneOf: [ref(`U${index + 1}`), ref('V')] }] }
      ])
    )

    await parseBounded({
      openapi,
      schemas: {
        K: { oneOf: [ref('U0'), toObject({ k: { type: 'object', oneOf: [ref('K'), toObject({ z: text })] } })] },
        ...unions,
        [`U${levels}`]: toObject({ u: text }),
        V: toObject({ v: text })
      }
    })
  })

  Deno.test(`${openapi} an allOf of one ref is an intersection as a union member with keywords of its own`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { A: toObject({ p: { oneOf: [{ allOf: [ref('A')], properties: { q: text } }, text] } }) }
    })

    assert(toAllOf(at(schemas.A, 'properties', 'p', 'oneOf', 0)).includes('#/components/schemas/A'))
  })

  Deno.test(`${openapi} an empty allOf in a member beside a kept ref is reported as one`, async () => {
    const { issues } = await parseBounded({
      openapi,
      schemas: { A: toObject({ p: { allOf: [ref('A'), { type: 'object', allOf: [] }] } }) }
    })

    assertEquals(issues.map(({ message }) => message), ['Empty allOf'])
  })

  Deno.test(`${openapi} a property that narrows its base's ref to its own schema ends`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        Base: toObject({ parent: ref('Base') }),
        Sub: { allOf: [ref('Base'), toObject({ parent: ref('Sub') })] }
      }
    })

    assertEquals(toAllOf(at(schemas.Sub, 'properties', 'parent')), ['#/components/schemas/Base', '#/components/schemas/Sub'])
    assertEquals(issues.filter(({ level }) => level === 'error'), [])
  })

  Deno.test(`${openapi} a ref into a cycle that does not lead back merges, and the cycle's own refs stay`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Outside: { allOf: [ref('A'), toObject({ own: text })] },
        A: { allOf: [ref('B'), toObject({ a: text })] },
        B: toObject({ back: { allOf: [ref('A'), { description: 'back' }] } })
      }
    })

    const [inherited, object] = toAllOf(schemas.Outside)

    assertEquals(inherited, '#/components/schemas/B')
    assertEquals(Object.keys(at(object, 'properties') ?? {}).sort(), ['a', 'own'])
  })

  Deno.test(`${openapi} a $ref in an example, or in a property named like a data keyword`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Example: { allOf: [ref('Target'), { description: 'e' }] },
        Target: { ...toObject({ t: text }), example: { allOf: [ref('Example')] } },
        Named: { allOf: [ref('Holder'), { description: 'n' }] },
        Holder: toObject({ default: ref('Named') })
      }
    })

    assertEquals(at(schemas.Example, 'properties', 't', 'type'), 'string')
    assertEquals(toAllOf(schemas.Named)[0], '#/components/schemas/Holder')
  })

  Deno.test(`${openapi} the parse gives the same intersections whichever schema it enters first`, async () => {
    const entries = Object.entries({
      A: { allOf: [ref('B'), toObject({ a: text })] },
      B: { type: 'object', properties: { c: { type: 'object', anyOf: [ref('C'), ref('D')] } } },
      C: { allOf: [ref('A'), ref('D'), { description: 'c' }] },
      D: toObject({ d: text }),
      E: { allOf: [ref('C'), toObject({ e: text })] }
    })
    const rotations = entries.map((_, index) => Object.fromEntries([...entries.slice(index), ...entries.slice(0, index)]))
    const results = await Promise.all(rotations.map(schemas => parseBounded({ openapi, schemas })))

    assertEquals(toAllOf(results[0]?.schemas.A)[0], '#/components/schemas/B')
    results.forEach(({ schemas }) => assertEquals(schemas, results[0]?.schemas))
  })

  Deno.test(`${openapi} a member that is not a schema parses as it does under merge`, async () => {
    const schemas = { A: { oneOf: ['fc2c78b2'] }, B: { type: 'object', oneOf: [null, ref('B')] }, C: { allOf: [ref('C'), null] } }
    const merge = await parseBounded({ openapi, schemas: { A: schemas.A }, system: { intersections: 'merge' } })
    const cycles = await parseBounded({ openapi, schemas })

    assertEquals(cycles.schemas.A, merge.schemas.A)
    assertEquals(Object.keys(cycles.schemas), Object.keys(merge.schemas))
  })

  Deno.test(`${openapi} merge keeps no ref, and all keeps each one`, async () => {
    const schemas = {
      A: { allOf: [ref('B'), ref('C'), toObject({ a: text })] },
      B: toObject({ b: ref('A') }),
      C: toObject({ c: text }),
      One: { allOf: [ref('C')], description: 'one' }
    }
    const merge = await parseBounded({ openapi, schemas, system: { intersections: 'merge' } })
    const cycles = await parseBounded({ openapi, schemas })
    const all = await parseBounded({ openapi, schemas, system: { intersections: 'all' } })

    assertEquals(Object.keys(at(merge.schemas.A, 'properties') ?? {}).sort(), ['a', 'b', 'c'])
    assertEquals(toAllOf(cycles.schemas.A)[0], '#/components/schemas/B')
    assertEquals(toAllOf(cycles.schemas.A).length, 2)
    assertEquals(toAllOf(all.schemas.A).slice(0, 2), ['#/components/schemas/B', '#/components/schemas/C'])
    assertEquals(all.schemas.One, { ...ref('C'), description: 'one' })
  })

  Deno.test(`${openapi} all makes each subtype of a discriminated oneOf an intersection`, async () => {
    const kind = (value: string) => ({ ...toObject({ kind: { type: 'string', enum: [value] } }), required: ['kind'] })
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Pet: { oneOf: [ref('Cat'), ref('Dog')], discriminator: { propertyName: 'kind' } },
        Base: toObject({ name: text }),
        Cat: { allOf: [ref('Base'), kind('cat')] },
        Dog: { allOf: [ref('Base'), kind('dog')] }
      },
      system: { intersections: 'all' }
    })

    assertEquals(toAllOf(schemas.Cat)[0], '#/components/schemas/Base')
    assertEquals(toAllOf(schemas.Dog)[0], '#/components/schemas/Base')
    assertEquals(at(schemas.Pet, 'oneOf'), [ref('Cat'), ref('Dog')])
  })
}

for (const openapi of ['3.1.0', '3.2.0']) {
  Deno.test(`${openapi} keywords beside a $ref: a ref with siblings, or an intersection with the allOf beside it`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          p: { ...ref('A'), description: 'p' },
          q: { ...ref('A'), description: 'q', allOf: [toObject({ x: text })] },
          r: { allOf: [{ ...ref('A'), description: 'r' }, toObject({ x: text })] }
        })
      }
    })

    assertEquals(at(schemas.A, 'properties', 'p'), { ...ref('A'), description: 'p' })

    for (const name of ['q', 'r']) {
      const [self, object] = toAllOf(at(schemas.A, 'properties', name))

      assertEquals(self, '#/components/schemas/A')
      assertEquals(at(object, 'properties', 'x', 'type'), 'string')
    }
  })

  Deno.test(`${openapi} a type stays beside a ref with keywords, and excludes the null of an alias`, async () => {
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({ a: text, p: { description: 'site', allOf: [{ ...ref('A'), required: ['a'] }, { type: 'object' }] } }),
        Obj: toObject({ n: ref('N') }),
        Alias: { ...ref('Obj'), type: ['object', 'null'] },
        N: { type: 'object', oneOf: [ref('Alias'), toObject({ z: text })] }
      }
    })

    assertEquals(at(schemas.A, 'properties', 'p', 'allOf', 0, 'required'), ['a'])
    assertEquals(at(schemas.A, 'properties', 'p', 'description'), 'site')
    assertEquals(toAllOf(at(schemas.N, 'oneOf', 0)).length, 2)
    assertEquals(issues, [])
  })

  Deno.test(`${openapi} the null of a member of a nested allOf is the whole intersection's`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        Base: toObject({ sub: ref('Sub') }),
        K: toObject({ sub: ref('Sub'), out: ref('Out') }),
        Sub: { allOf: [ref('Base'), { type: ['object', 'null'], properties: { s: text } }] },
        Out: { allOf: [ref('Sub'), ref('K')] },
        A: toObject({ p: { allOf: [{ allOf: [ref('A'), { type: 'null' }] }, ref('B')] } }),
        B: toObject({ a: ref('A') })
      }
    })

    assertEquals(at(schemas.Out, 'nullable'), true)
    assertEquals(toAllOf(schemas.Out).map(member => at(member, 'nullable')), toAllOf(schemas.Out).map(() => undefined))
    assertEquals(at(schemas.A, 'properties', 'p', 'nullable'), true)
    assertEquals(toAllOf(at(schemas.A, 'properties', 'p')), ['#/components/schemas/A', '#/components/schemas/B'])
  })

  Deno.test(`${openapi} a null type beside a kept ref makes it nullable`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: {
        A: toObject({
          p: { type: ['object', 'null'], anyOf: [ref('A')] },
          q: { allOf: [ref('A'), { type: 'null' }, { description: 'q' }] }
        })
      }
    })

    assertEquals(at(schemas.A, 'properties', 'p', 'nullable'), true)
    assertEquals(at(schemas.A, 'properties', 'q', 'nullable'), true)
    assertEquals(toAllOf(at(schemas.A, 'properties', 'q')), ['#/components/schemas/A', { description: 'q' }])
  })
}
