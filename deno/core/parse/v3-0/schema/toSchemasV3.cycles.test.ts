/**
 * Cyclic composition — the shapes that used to make `parse()` never return
 * (skmtc/skmtc#122), one test per case, each pinning the IR the parser now
 * produces. The same file exists under `parse/v3-1` with a 3.1 header.
 *
 * Every case is a whole-document parse through `ParseContext`, because the
 * behaviour under test spans `toSchemasV3` (which names components as it
 * builds them), the merge layer's resolver, and the end-of-parse
 * registration of synthesized schemas.
 */
import type { OpenAPIV3 } from 'openapi-types'
import { assert, assertEquals, assertExists } from '@std/assert'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { RefName } from '@/types/RefName.ts'
import * as log from '@std/log'
import { collectRefNames } from '@/helpers/collectRefNames.ts'

export const OPENAPI_VERSION = '3.0.3'

type Schemas = Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>

export const parseSchemas = (
  schemas: Schemas,
  openapi: string = OPENAPI_VERSION
): { document: OasDocument; context: ParseContext } => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: {
        openapi,
        info: { title: 'cycles', version: '1' },
        paths: {},
        components: { schemas }
      } as OpenAPIV3.Document
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  const parsed = context.parse(new StackTrail())

  if (parsed.type !== 'oas') {
    throw new Error('Expected an OAS document')
  }

  return { document: parsed.value, context }
}

const schema = (document: OasDocument, name: string): OasSchema | OasRef<'schema'> => {
  const found = document.components?.schemas?.[name as RefName]
  assertExists(found, `component "${name}"`)
  return found
}

/** JSON-Schema view of a node with the `undefined`-valued keys dropped, so it compares by shape. */
const json = (node: OasSchema | OasRef<'schema'>): unknown =>
  JSON.parse(JSON.stringify(node.toJsonSchema({ resolve: false })))

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

/**
 * Case 2 / 5 — the parent lists its children in a `oneOf` and every child
 * `allOf`-extends the parent (springdoc, Swagger, buddy's `TargetView`).
 */
export const parentListsChildren: Schemas = {
  Target: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['SSH', 'FTP'] }
    },
    discriminator: {
      propertyName: 'type',
      mapping: { SSH: ref('TargetSSH').$ref, FTP: ref('TargetFTP').$ref }
    },
    oneOf: [ref('TargetSSH'), ref('TargetFTP')]
  },
  TargetSSH: {
    allOf: [
      ref('Target'),
      {
        type: 'object',
        properties: { host: { type: 'string' } }
      }
    ]
  },
  TargetFTP: {
    allOf: [
      ref('Target'),
      {
        type: 'object',
        properties: { passive: { type: 'boolean' } }
      }
    ]
  }
}

Deno.test('cycles - parent lists its children, children extend the parent', async t => {
  const { document, context } = parseSchemas(parentListsChildren)

  await t.step('the parent is a union of refs to its children, discriminator kept', () => {
    const target = schema(document, 'Target')
    assert(target instanceof OasUnion)
    assertEquals(
      target.members.map(member => (member instanceof OasRef ? member.toRefName() : 'inline')),
      ['TargetSSH', 'TargetFTP']
    )
    assertEquals(target.discriminator?.propertyName, 'type')
  })

  await t.step('each child is an object with the parent base properties plus its own', () => {
    const ssh = schema(document, 'TargetSSH')
    assert(ssh instanceof OasObject)
    assertEquals(Object.keys(ssh.properties ?? {}).sort(), ['host', 'id', 'type'])
    assertEquals(ssh.required, ['id'])

    const ftp = schema(document, 'TargetFTP')
    assert(ftp instanceof OasObject)
    assertEquals(Object.keys(ftp.properties ?? {}).sort(), ['id', 'passive', 'type'])
  })

  await t.step('the parent union does not leak into a child', () => {
    assertEquals(json(schema(document, 'TargetSSH')), {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['SSH', 'FTP'] },
        host: { type: 'string' }
      },
      required: ['id'],
      additionalProperties: false
    })
  })

  await t.step('no error-level issues; the kept refs are recorded at debug', () => {
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
    const noted = context.issues.filter(issue => issue.type === 'CYCLIC_COMPOSITION')
    assert(noted.length >= 1)
  })

  await t.step(
    'the same idiom spelled oneOf: [{ allOf: [{ $ref }] }] (verifone) parses the same',
    () => {
      const wrapped: Schemas = {
        ...parentListsChildren,
        Target: {
          ...parentListsChildren.Target,
          oneOf: [{ allOf: [ref('TargetSSH')] }, { allOf: [ref('TargetFTP')] }]
        }
      }
      const { document: wrappedDocument } = parseSchemas(wrapped)
      const target = schema(wrappedDocument, 'Target')
      assert(target instanceof OasUnion)
      assertEquals(
        target.members.map(member => (member instanceof OasRef ? member.toRefName() : 'inline')),
        ['TargetSSH', 'TargetFTP']
      )
    }
  )
})

/**
 * Case 3 — wrapper properties on a union whose members do NOT extend it. The
 * wrapper extends each member into a new inline entity (unchanged behaviour,
 * confirmed intended 2026-08-28).
 */
Deno.test('cycles - a wrapper still extends members that do not inherit from it', () => {
  const { document } = parseSchemas({
    Pet: {
      properties: { id: { type: 'string' } },
      discriminator: { propertyName: 'kind' },
      oneOf: [ref('Cat'), ref('Dog')]
    },
    Cat: {
      type: 'object',
      properties: { kind: { type: 'string' }, meows: { type: 'boolean' } }
    },
    Dog: {
      type: 'object',
      properties: { kind: { type: 'string' }, barks: { type: 'boolean' } }
    }
  })

  const pet = schema(document, 'Pet')
  assert(pet instanceof OasUnion)
  assertEquals(pet.members.length, 2)
  for (const member of pet.members) {
    assert(member instanceof OasObject)
    assert('id' in (member.properties ?? {}))
  }
})

/**
 * Case 9 — a nullable self-reference written as a one-member `anyOf` with a
 * `type: object` wrapper (OData `x-ms-navigationProperty`, churnzero).
 */
Deno.test('cycles - single-ref anyOf with a type wrapper stays a lazy nullable ref', () => {
  const { document, context } = parseSchemas({
    Account: {
      type: 'object',
      properties: {
        Id: { type: 'number' },
        ParentAccount: {
          type: 'object',
          anyOf: [ref('Account')],
          nullable: true,
          'x-ms-navigationProperty': true
        } as OpenAPIV3.SchemaObject,
        Children: {
          type: 'array',
          items: { type: 'object', anyOf: [ref('Account')] }
        }
      }
    }
  })

  const account = schema(document, 'Account')
  assert(account instanceof OasObject)

  const parent = account.properties?.ParentAccount
  assert(parent instanceof OasRef)
  assertEquals(parent.toRefName(), 'Account')
  assertEquals(parent.nullable, true)

  assertEquals(
    context.issues.filter(issue => issue.level === 'error'),
    []
  )
})

/**
 * Case 6 — an inline `allOf` that extends every member of a union which, a
 * few hops later, contains that same `allOf` (wiremock's `content-pattern`).
 * The recursive `allOf` is given a name and registered as a component; the
 * second occurrence is a `$ref` to it. Every member gets the extension.
 */
export const recursiveInlineAllOf: Schemas = {
  'content-pattern': {
    type: 'object',
    oneOf: [
      ref('equal-to-pattern'),
      ref('contains-pattern'),
      ref('matches-json-path-pattern'),
      ref('and-pattern')
    ]
  },
  'equal-to-pattern': {
    type: 'object',
    properties: { equalTo: { type: 'string' } }
  },
  'contains-pattern': {
    type: 'object',
    properties: { contains: { type: 'string' } }
  },
  'matches-json-path-pattern': {
    type: 'object',
    properties: {
      matchesJsonPath: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            allOf: [{ properties: { expression: { type: 'string' } } }, ref('content-pattern')],
            required: ['expression']
          }
        ]
      }
    }
  },
  'and-pattern': {
    type: 'object',
    properties: { and: { type: 'array', items: ref('content-pattern') } }
  }
}

export const SYNTHESIZED = 'matches-json-path-pattern~properties~matchesJsonPath~oneOf~1'

Deno.test('cycles - a recursive inline allOf becomes a named component', async t => {
  const { document, context } = parseSchemas(recursiveInlineAllOf)

  await t.step('the site of the allOf refers to the synthesized component', () => {
    const pattern = schema(document, 'matches-json-path-pattern')
    assert(pattern instanceof OasObject)
    const property = pattern.properties?.matchesJsonPath
    assert(property instanceof OasUnion)
    const [, composite] = property.members
    assert(composite instanceof OasRef)
    assertEquals(composite.toRefName(), SYNTHESIZED)
  })

  await t.step('the synthesized component is registered and resolves', () => {
    const composite = schema(document, SYNTHESIZED)
    assert(composite instanceof OasUnion)
    assertEquals(composite.members.length, 4)
  })

  await t.step('every member of the union carries the extension', () => {
    const composite = schema(document, SYNTHESIZED)
    assert(composite instanceof OasUnion)
    for (const member of composite.members) {
      assert(member instanceof OasObject)
      assert('expression' in (member.properties ?? {}), 'expression applied')
      assertEquals(member.required, ['expression'])
    }
  })

  await t.step('the recursive member refers back to the component by name', () => {
    const composite = schema(document, SYNTHESIZED)
    assert(composite instanceof OasUnion)
    const recursive = composite.members[2]
    assert(recursive instanceof OasObject)
    const inner = recursive.properties?.matchesJsonPath
    assert(inner instanceof OasUnion)
    const [, innerComposite] = inner.members
    assert(innerComposite instanceof OasRef)
    assertEquals(innerComposite.toRefName(), SYNTHESIZED)
  })

  await t.step('it is reported at debug level, never as an error', () => {
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
    const noted = context.issues.find(
      issue => issue.type === 'CYCLIC_COMPOSITION' && issue.message.includes(SYNTHESIZED)
    )
    assertExists(noted)
    assertEquals(noted.level, 'debug')
  })
})

/**
 * Case 7 — mutual `allOf` with no union to take a branch of. There is no
 * finite reading; the schema is refused with an `INVALID_SCHEMA` issue and
 * the parse still returns.
 */
Deno.test('cycles - mutual allOf is refused rather than expanded', () => {
  const { document, context } = parseSchemas({
    A: {
      allOf: [
        ref('B'),
        {
          type: 'object',
          properties: { a: { type: 'string' } }
        }
      ]
    },
    B: {
      allOf: [
        ref('A'),
        {
          type: 'object',
          properties: { b: { type: 'string' } }
        }
      ]
    }
  })

  const invalid = context.issues.filter(issue => issue.type === 'INVALID_SCHEMA')
  assert(invalid.length >= 1)
  assert(invalid.some(issue => issue.message.includes('Cyclic allOf')))
  // Whichever of the two was refused, the other cannot be built either — the
  // document has no surviving reading of this pair.
  assertEquals(document.components?.schemas?.['A' as RefName], undefined)
})

/**
 * Regression guard — documents that parse today produce the same IR. A
 * non-recursive inline `allOf` inside a union member is still merged in
 * place: no name, no new component.
 */
Deno.test('cycles - a non-recursive inline allOf is merged in place, nothing synthesized', () => {
  const { document } = parseSchemas({
    Base: { type: 'object', properties: { id: { type: 'string' } } },
    Wrapper: {
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string' },
            {
              allOf: [
                ref('Base'),
                {
                  type: 'object',
                  properties: { extra: { type: 'string' } }
                }
              ]
            }
          ]
        }
      }
    }
  })

  assertEquals(Object.keys(document.components?.schemas ?? {}).sort(), ['Base', 'Wrapper'])

  const wrapper = schema(document, 'Wrapper')
  assert(wrapper instanceof OasObject)
  const value = wrapper.properties?.value
  assert(value instanceof OasUnion)
  const [, composite] = value.members
  assert(composite instanceof OasObject)
  assertEquals(Object.keys(composite.properties ?? {}).sort(), ['extra', 'id'])
})

// ---------------------------------------------------------------------------
// Review findings on the first round (skmtc/skmtc#125). Each test is the
// reviewer's reproduction, pinned. Numbering follows the review.
// ---------------------------------------------------------------------------

const animals: Schemas = {
  Animal: {
    type: 'object',
    properties: { kind: { type: 'string' } },
    discriminator: { propertyName: 'kind' },
    oneOf: [ref('Dog'), ref('Cat')]
  },
  Dog: { allOf: [ref('Animal'), { type: 'object', properties: { bark: { type: 'string' } } }] },
  Cat: { allOf: [ref('Animal'), { type: 'object', properties: { meow: { type: 'string' } } }] }
}

Deno.test('finding 1 - an inline allOf extending a listed child from another site terminates', async t => {
  await t.step('from a property of another component', () => {
    const { document, context } = parseSchemas({
      ...animals,
      Kennel: {
        type: 'object',
        properties: { resident: { allOf: [ref('Dog'), { type: 'object', required: ['bark'] }] } }
      }
    })

    const kennel = schema(document, 'Kennel')
    assert(kennel instanceof OasObject)
    const resident = kennel.properties?.resident
    assert(resident instanceof OasObject)
    assertEquals(Object.keys(resident.properties ?? {}).sort(), ['bark', 'kind'])
    assertEquals(resident.required, ['bark'])
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })

  await t.step('from an operation response schema (parsed before components)', () => {
    const context = new ParseContext({
      input: {
        type: 'oas',
        value: {
          openapi: OPENAPI_VERSION,
          info: { title: 'cycles', version: '1' },
          paths: {
            '/dogs/{id}': {
              get: {
                responses: {
                  '200': {
                    description: 'ok',
                    content: {
                      'application/json': {
                        schema: { allOf: [ref('Dog'), { type: 'object', required: ['bark'] }] }
                      }
                    }
                  }
                }
              }
            }
          },
          components: { schemas: animals }
        } as unknown as OpenAPIV3.Document
      },
      logger: new log.Logger('test', 'ERROR'),
      silent: true
    })

    const parsed = context.parse(new StackTrail())
    assert(parsed.type === 'oas')
    assertEquals(parsed.value.operations.length, 1)
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })

  await t.step('a sibling that extends the parent without being listed still parses', () => {
    const { document, context } = parseSchemas({
      ...animals,
      Other: { allOf: [ref('Animal'), { type: 'object', properties: { x: { type: 'string' } } }] }
    })

    const other = schema(document, 'Other')
    assert(other instanceof OasObject)
    assertEquals(Object.keys(other.properties ?? {}).sort(), ['kind', 'x'])
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })
})

Deno.test('finding 2 - a recursive allOf as a DIRECT union member, wrapper keywords retained', async t => {
  const recursiveMember = (wrapper: OpenAPIV3.SchemaObject): Schemas => ({
    Union: {
      ...wrapper,
      oneOf: [
        { allOf: [{ properties: { expression: { type: 'string' } } }, ref('Union')] },
        ref('Leaf')
      ]
    },
    Leaf: { type: 'object', properties: { leaf: { type: 'boolean' } } }
  })

  const wrappers: [string, OpenAPIV3.SchemaObject][] = [
    ['type + properties', { type: 'object', properties: { common: { type: 'string' } } }],
    ['type only', { type: 'object' }],
    ['empty wrapper', {}]
  ]

  for (const [label, wrapper] of wrappers) {
    await t.step(`${label}: finite union, no stack overflow, no silent unrolling`, () => {
      const { document, context } = parseSchemas(recursiveMember(wrapper))

      const union = schema(document, 'Union')
      assert(union instanceof OasUnion)
      assert(
        union.members.length <= 3,
        `expected a handful of members, got ${union.members.length}`
      )
      assert(
        !context.issues.some(issue => issue.message.includes('Maximum call stack')),
        'no swallowed stack overflow'
      )
      assertEquals(
        context.issues.filter(issue => issue.level === 'error'),
        []
      )
    })
  }
})

Deno.test('finding 3 - a single-ref self-reference with an extending keyword still terminates', async t => {
  const extras: [string, Partial<OpenAPIV3.SchemaObject>][] = [
    ['minProperties', { minProperties: 1 }],
    ['maxProperties', { maxProperties: 5 }],
    ['required', { required: ['Id'] }]
  ]

  for (const [label, extra] of extras) {
    await t.step(label, () => {
      const { document, context } = parseSchemas({
        Account: {
          type: 'object',
          properties: {
            Id: { type: 'number' },
            ParentAccount: {
              type: 'object',
              anyOf: [ref('Account')],
              nullable: true,
              ...extra
            } as OpenAPIV3.SchemaObject
          }
        }
      })

      const account = schema(document, 'Account')
      assert(account instanceof OasObject)
      const parent = account.properties?.ParentAccount
      // The wrapper extends the member, so it cannot stay a bare ref; but the
      // parent is still being built, so it must not be copied either.
      assert(parent instanceof OasRef, `ParentAccount is a ${parent?.constructor.name}`)
      assertEquals(parent.toRefName(), 'Account')
      assert(
        !context.issues.some(issue => issue.message.includes('Maximum call stack')),
        'no swallowed stack overflow'
      )
      assert(
        context.issues.some(
          issue => issue.type === 'CYCLIC_COMPOSITION' && issue.level === 'warning'
        ),
        'the unapplied wrapper keywords are recorded'
      )
    })
  }
})

Deno.test('finding 4 - a synthesized schema that depends on a failed schema is pruned with its host site', () => {
  const { document, context } = parseSchemas({
    Bad: { not: {} },
    Base: {
      type: 'object',
      properties: {
        p: {
          oneOf: [
            { type: 'string' },
            {
              allOf: [ref('Base'), { type: 'object', properties: { bad: ref('Bad') } }]
            }
          ]
        }
      }
    }
  })

  const names = Object.keys(document.components?.schemas ?? {})
  assert(!names.some(name => name.includes('~')), `no orphan synthesized schema: ${names}`)
  assert(context.issues.some(issue => issue.type === 'INVALID_DEPENDENCY_REF'))
  // Nothing left in the document refers to a component that does not exist.
  for (const name of names) {
    const refs = collectRefNames(schema(document, name).toJsonSchema({ resolve: false }))
    for (const target of refs) {
      assert(names.includes(target), `${name} refers to missing ${target}`)
    }
  }
})

Deno.test('finding 5 - the same recursive allOf reached by another path is one component with one name', async t => {
  await t.step('the review fixture itself synthesizes exactly one schema', () => {
    const { document } = parseSchemas(recursiveInlineAllOf)
    const synthesized = Object.keys(document.components?.schemas ?? {}).filter(name =>
      name.includes('~')
    )
    assertEquals(synthesized, [SYNTHESIZED])
  })

  await t.step('a subclass copying the property by reference reuses that name', () => {
    const { document } = parseSchemas({
      ...recursiveInlineAllOf,
      ChildA: {
        allOf: [
          ref('matches-json-path-pattern'),
          { type: 'object', properties: { a: { type: 'string' } } }
        ]
      }
    })
    const synthesized = Object.keys(document.components?.schemas ?? {}).filter(name =>
      name.includes('~')
    )
    assertEquals(synthesized, [SYNTHESIZED])

    const child = schema(document, 'ChildA')
    assert(child instanceof OasObject)
    const property = child.properties?.matchesJsonPath
    assert(property instanceof OasUnion)
    const [, composite] = property.members
    assert(composite instanceof OasRef)
    assertEquals(composite.toRefName(), SYNTHESIZED)
  })

  await t.step('component order does not change the name', () => {
    const reversed = Object.fromEntries(Object.entries(recursiveInlineAllOf).reverse())
    const { document } = parseSchemas(reversed)
    const synthesized = Object.keys(document.components?.schemas ?? {}).filter(name =>
      name.includes('~')
    )
    assertEquals(synthesized, [SYNTHESIZED])
  })
})

Deno.test('finding 6 - a union member whose allOf fails is dropped and the union survives, with the failure recorded', async t => {
  await t.step('missing $ref', () => {
    const { document, context } = parseSchemas({
      U: {
        oneOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { allOf: [ref('Missing'), { type: 'object' }] }
        ]
      },
      Consumer: { type: 'object', properties: { u: ref('U') } }
    })

    const u = schema(document, 'U')
    // The failing member is gone; the union survives with the other one.
    assert(u instanceof OasObject || (u instanceof OasUnion && u.members.length === 1))
    assertExists(document.components?.schemas?.['Consumer' as RefName])
    assert(
      context.issues.some(
        issue => issue.type === 'INVALID_SCHEMA' && issue.message.includes('Missing')
      )
    )
  })

  await t.step('conflicting types', () => {
    const { document } = parseSchemas({
      U: { oneOf: [{ type: 'string' }, { allOf: [{ type: 'string' }, { type: 'integer' }] }] }
    })
    assertExists(document.components?.schemas?.['U' as RefName])
  })
})

Deno.test('finding 7 - metadata a single-ref wrapper cannot carry onto the ref is logged as skipped', () => {
  const { document, context } = parseSchemas({
    X: { type: 'object', properties: { a: { type: 'string' } } },
    W: {
      oneOf: [ref('X')],
      type: 'object',
      description: 'wrapper desc',
      default: { a: 'z' }
    } as OpenAPIV3.SchemaObject
  })

  const w = schema(document, 'W')
  assert(w instanceof OasRef)
  const skipped = context.issues.find(
    issue => issue.location.includes('W') && issue.message.includes('description')
  )
  assertExists(skipped, 'the dropped description is recorded')
})

Deno.test('finding 9 - other spellings of parent-lists-children', async t => {
  await t.step('(a) a two-member inline allOf as the union member', () => {
    const { document, context } = parseSchemas({
      Target: {
        properties: { id: { type: 'string' } },
        oneOf: [{ allOf: [ref('TargetSSH'), { description: 'x' }] }]
      },
      TargetSSH: {
        allOf: [ref('Target'), { type: 'object', properties: { host: { type: 'string' } } }]
      }
    })
    assertExists(document.components?.schemas?.['Target' as RefName])
    const ssh = schema(document, 'TargetSSH')
    assert(ssh instanceof OasObject)
    assertEquals(Object.keys(ssh.properties ?? {}).sort(), ['host', 'id'])
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })

  await t.step('(b) the parent ref nested in a single-member allOf', () => {
    const { document, context } = parseSchemas({
      Target: { properties: { id: { type: 'string' } }, oneOf: [ref('TargetSSH')] },
      TargetSSH: {
        allOf: [
          { allOf: [ref('Target')] },
          { type: 'object', properties: { host: { type: 'string' } } }
        ]
      }
    })
    const ssh = schema(document, 'TargetSSH')
    assert(ssh instanceof OasObject)
    assertEquals(Object.keys(ssh.properties ?? {}).sort(), ['host', 'id'])
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })

  await t.step('(c) a self-listing inline member', () => {
    const { document, context } = parseSchemas({
      Parent: {
        properties: { kind: { type: 'string' } },
        oneOf: [{ allOf: [ref('Parent'), { properties: { extra: { type: 'string' } } }] }]
      }
    })
    assertExists(document.components?.schemas?.['Parent' as RefName])
    assert(
      !context.issues.some(issue => issue.message.includes('Maximum call stack')),
      'no swallowed stack overflow'
    )
    assertEquals(
      context.issues.filter(issue => issue.level === 'error'),
      []
    )
  })
})

Deno.test('finding 10 - a parent-lists-children hierarchy with an intermediate level', async t => {
  const hierarchy: Schemas = {
    Grandparent: { type: 'object', properties: { id: { type: 'string' } }, oneOf: [ref('Child')] },
    Parent: {
      allOf: [ref('Grandparent'), { type: 'object', properties: { p: { type: 'string' } } }]
    },
    Child: { allOf: [ref('Parent'), { type: 'object', properties: { c: { type: 'string' } } }] }
  }

  for (const order of [
    ['Grandparent', 'Parent', 'Child'],
    ['Child', 'Parent', 'Grandparent'],
    ['Parent', 'Child', 'Grandparent']
  ]) {
    await t.step(order.join(','), () => {
      const { document, context } = parseSchemas(
        Object.fromEntries(order.map(name => [name, hierarchy[name]]))
      )
      const child = schema(document, 'Child')
      assert(child instanceof OasObject)
      assertEquals(Object.keys(child.properties ?? {}).sort(), ['c', 'id', 'p'])
      const parent = schema(document, 'Parent')
      assert(parent instanceof OasObject)
      assertEquals(Object.keys(parent.properties ?? {}).sort(), ['id', 'p'])
      // One listed child: the union of one ref collapses to the ref itself.
      const grandparent = schema(document, 'Grandparent')
      assert(grandparent instanceof OasUnion || grandparent instanceof OasRef)
      assertEquals(
        context.issues.filter(issue => issue.level === 'error'),
        []
      )
    })
  }
})

Deno.test('backstop - a cycle nothing above recognises is refused naming the chain, never a stack overflow', () => {
  // Three mutually-extending schemas: no union to take a branch of.
  const { context } = parseSchemas({
    A: { allOf: [ref('B'), { type: 'object', properties: { a: { type: 'string' } } }] },
    B: { allOf: [ref('C'), { type: 'object', properties: { b: { type: 'string' } } }] },
    C: { allOf: [ref('A'), { type: 'object', properties: { c: { type: 'string' } } }] }
  })

  const invalid = context.issues.filter(issue => issue.type === 'INVALID_SCHEMA')
  assert(invalid.length >= 1)
  assert(invalid.every(issue => !issue.message.includes('Maximum call stack')))
  assert(invalid.some(issue => /Cyclic/.test(issue.message)))
})
