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

    assertEquals(at(schemas.B, 'properties', 'm', 'oneOf', 0), ref('A'))
    assertEquals(toAllOf(at(schemas.C, 'properties', 'n')), ['#/components/schemas/A', { description: 'n' }])
  })

  Deno.test(`${openapi} a keyword beside a union whose member leads back (churnzero)`, async () => {
    const { schemas } = await parseBounded({
      openapi,
      schemas: { Account: toObject({ Parent: navigation, Owner: navigation, Root: navigation }) }
    })

    for (const name of ['Parent', 'Owner', 'Root']) {
      const property = at(schemas.Account, 'properties', name)
      const [object, account] = toAllOf(property)

      assertEquals(at(object, 'type'), 'object')
      assertEquals(account, '#/components/schemas/Account')
      assertEquals(at(property, 'nullable'), true)
    }
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
    const [object, dashboard] = toAllOf(at(members, 30))

    assertEquals(at(object, 'type'), 'object')
    assertEquals(dashboard, '#/components/schemas/DashboardWidget')
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

    assertEquals(at(schemas.A, 'properties', 'p'), ref('A'))
  })

  Deno.test(`${openapi} a union member that contradicts the keyword beside the union is left out (Cube Cloud)`, async () => {
    const member = (target: string) => ({ type: 'array', items: { type: 'string', oneOf: [text, ref(target)] } })
    const { schemas, issues } = await parseBounded({
      openapi,
      schemas: {
        Folder: toObject({ direct: member('Folder'), alias: member('Alias'), union: member('Node'), allOf: member('Sub') }),
        Alias: ref('Folder'),
        Node: { oneOf: [ref('Folder'), ref('File'), ref('Node')] },
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

    assertEquals(toAllOf(member)[1], pointer)
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
    assertEquals(at(schemas.A, 'properties', 'q'), ref('A'))
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
    assertEquals(all.schemas.One, ref('C'))
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

    assertEquals(at(schemas.A, 'properties', 'p'), ref('A'))

    for (const name of ['q', 'r']) {
      const [self, object] = toAllOf(at(schemas.A, 'properties', name))

      assertEquals(self, '#/components/schemas/A')
      assertEquals(at(object, 'properties', 'x', 'type'), 'string')
    }
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
