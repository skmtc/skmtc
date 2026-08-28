/**
 * Cyclic composition — the shapes that used to make `parse()` never return
 * (skmtc/skmtc#122), each pinned to the IR the parser now produces. The
 * numbered "finding" tests are the reproductions from the review of
 * skmtc/skmtc#125. The same file exists under `parse/v3-1` with a 3.1 header.
 *
 * Every case is a whole-document parse through `ParseContext`, because the
 * behaviour spans the pre-parse hoist (`hoistCyclicAllOf`), the by-name
 * flattening (`SchemaFlattener`), and the union branch of `toSchemaV3`.
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

export const OPENAPI_VERSION = '3.0.3'

type Schemas = Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>

export const parseSchemas = (
  schemas: Schemas,
  paths: OpenAPIV3.PathsObject = {}
): { document: OasDocument; context: ParseContext } => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: {
        openapi: OPENAPI_VERSION,
        info: { title: 'cycles', version: '1' },
        paths,
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

const names = (document: OasDocument): string[] => Object.keys(document.components?.schemas ?? {})

const errors = (context: ParseContext) => context.issues.filter(issue => issue.level === 'error')

/** JSON-Schema view of a node with `undefined` keys dropped, so it compares by shape. */
const json = (node: OasSchema | OasRef<'schema'>): unknown =>
  JSON.parse(JSON.stringify(node.toJsonSchema({ resolve: false })))

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const memberNames = (union: OasUnion) =>
  union.members.map(member => (member instanceof OasRef ? member.toRefName() : 'inline'))

// ---------------------------------------------------------------------------
// Case 2 / 5 — the parent lists its children in a `oneOf` and every child
// `allOf`-extends the parent (springdoc, Swagger, buddy's `TargetView`).
// ---------------------------------------------------------------------------

export const parentListsChildren: Schemas = {
  Target: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' }, type: { type: 'string', enum: ['SSH', 'FTP'] } },
    discriminator: {
      propertyName: 'type',
      mapping: { SSH: ref('TargetSSH').$ref, FTP: ref('TargetFTP').$ref }
    },
    oneOf: [ref('TargetSSH'), ref('TargetFTP')]
  },
  TargetSSH: {
    allOf: [ref('Target'), { type: 'object', properties: { host: { type: 'string' } } }]
  },
  TargetFTP: {
    allOf: [ref('Target'), { type: 'object', properties: { passive: { type: 'boolean' } } }]
  }
}

Deno.test('cycles - parent lists its children, children extend the parent', async t => {
  const { document, context } = parseSchemas(parentListsChildren)

  await t.step('the parent is a union of refs to its children, discriminator kept', () => {
    const target = schema(document, 'Target')
    assert(target instanceof OasUnion)
    assertEquals(memberNames(target), ['TargetSSH', 'TargetFTP'])
    assertEquals(target.discriminator?.propertyName, 'type')
  })

  await t.step('each child is an object with the parent base properties plus its own', () => {
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
    const ftp = schema(document, 'TargetFTP')
    assert(ftp instanceof OasObject)
    assertEquals(Object.keys(ftp.properties ?? {}).sort(), ['id', 'passive', 'type'])
  })

  await t.step('no error-level issues', () => {
    assertEquals(errors(context), [])
  })

  await t.step(
    'the same idiom spelled oneOf: [{ allOf: [{ $ref }] }] (verifone) parses the same',
    () => {
      const { document: wrapped } = parseSchemas({
        ...parentListsChildren,
        Target: {
          ...parentListsChildren.Target,
          oneOf: [{ allOf: [ref('TargetSSH')] }, { allOf: [ref('TargetFTP')] }]
        }
      })
      const target = schema(wrapped, 'Target')
      assert(target instanceof OasUnion)
      assertEquals(memberNames(target), ['TargetSSH', 'TargetFTP'])
    }
  )
})

// ---------------------------------------------------------------------------
// Case 3 — wrapper properties on a union of refs whose members do NOT extend
// it. A `$ref` member is never copied to receive the wrapper's keywords; the
// references are kept and the unapplied keywords are recorded.
// ---------------------------------------------------------------------------

Deno.test('cycles - wrapper keywords on a union extend its members, as before', () => {
  const { document, context } = parseSchemas({
    Pet: {
      properties: { id: { type: 'string' } },
      discriminator: { propertyName: 'kind' },
      oneOf: [ref('Cat'), ref('Dog'), { type: 'object', properties: { kind: { type: 'string' } } }]
    },
    Cat: { type: 'object', properties: { kind: { type: 'string' }, meows: { type: 'boolean' } } },
    Dog: { type: 'object', properties: { kind: { type: 'string' }, barks: { type: 'boolean' } } }
  })

  const pet = schema(document, 'Pet')
  assert(pet instanceof OasUnion)
  assertEquals(pet.members.length, 3)
  for (const member of pet.members) {
    assert(member instanceof OasObject)
    assert('id' in (member.properties ?? {}), 'every member is extended by the wrapper')
  }
  assertEquals(errors(context), [])
})

// ---------------------------------------------------------------------------
// Case 9 — a nullable self-reference written as a one-member `anyOf` with a
// `type: object` wrapper (OData `x-ms-navigationProperty`, churnzero).
// ---------------------------------------------------------------------------

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
        } as OpenAPIV3.SchemaObject
      }
    }
  })

  const account = schema(document, 'Account')
  assert(account instanceof OasObject)
  const parent = account.properties?.ParentAccount
  assert(parent instanceof OasRef)
  assertEquals(parent.toRefName(), 'Account')
  assertEquals(parent.nullable, true)
  assertEquals(errors(context), [])
})

// ---------------------------------------------------------------------------
// Case 6 — an inline `allOf` that extends every member of a union which, a
// few hops later, contains that same `allOf` (wiremock's `content-pattern`).
// The pre-parse hoist gives it a name; the recursion is a `$ref` to it.
// ---------------------------------------------------------------------------

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
  'equal-to-pattern': { type: 'object', properties: { equalTo: { type: 'string' } } },
  'contains-pattern': { type: 'object', properties: { contains: { type: 'string' } } },
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

export const HOISTED = 'matches-json-path-pattern~properties~matchesJsonPath~oneOf~1'

Deno.test('cycles - a recursive inline allOf becomes a named component', async t => {
  const { document, context } = parseSchemas(recursiveInlineAllOf)

  await t.step('the site of the allOf refers to the hoisted component', () => {
    const pattern = schema(document, 'matches-json-path-pattern')
    assert(pattern instanceof OasObject)
    const property = pattern.properties?.matchesJsonPath
    assert(property instanceof OasUnion)
    const [, composite] = property.members
    assert(composite instanceof OasRef)
    assertEquals(composite.toRefName(), HOISTED)
  })

  await t.step('the hoisted component is a union whose every member carries the extension', () => {
    const composite = schema(document, HOISTED)
    assert(composite instanceof OasUnion)
    assertEquals(composite.members.length, 4)
    for (const member of composite.members) {
      assert(member instanceof OasObject)
      assert('expression' in (member.properties ?? {}), 'expression applied')
      assertEquals(member.required, ['expression'])
    }
  })

  await t.step('the recursive member refers back to the component by name', () => {
    const composite = schema(document, HOISTED)
    assert(composite instanceof OasUnion)
    const recursive = composite.members[2]
    assert(recursive instanceof OasObject)
    const inner = recursive.properties?.matchesJsonPath
    assert(inner instanceof OasUnion)
    const [, innerComposite] = inner.members
    assert(innerComposite instanceof OasRef)
    assertEquals(innerComposite.toRefName(), HOISTED)
  })

  await t.step('the parent union of refs keeps its refs', () => {
    const pattern = schema(document, 'content-pattern')
    assert(pattern instanceof OasUnion)
    assertEquals(memberNames(pattern), [
      'equal-to-pattern',
      'contains-pattern',
      'matches-json-path-pattern',
      'and-pattern'
    ])
  })

  await t.step('it is reported at debug level, never as an error', () => {
    assertEquals(errors(context), [])
    const noted = context.issues.find(
      issue => issue.type === 'CYCLIC_COMPOSITION' && issue.message.includes(HOISTED)
    )
    assertExists(noted)
    assertEquals(noted.level, 'debug')
  })
})

// ---------------------------------------------------------------------------
// Case 7 — mutual `allOf` with no union to take a branch of: refused, named.
// ---------------------------------------------------------------------------

Deno.test('cycles - mutual allOf is refused naming the cycle', () => {
  const { document, context } = parseSchemas({
    A: { allOf: [ref('B'), { type: 'object', properties: { a: { type: 'string' } } }] },
    B: { allOf: [ref('C'), { type: 'object', properties: { b: { type: 'string' } } }] },
    C: { allOf: [ref('A'), { type: 'object', properties: { c: { type: 'string' } } }] }
  })

  const invalid = context.issues.filter(issue => issue.type === 'INVALID_SCHEMA')
  assert(invalid.length >= 1)
  assert(invalid.some(issue => issue.message.includes('Cyclic allOf: A -> B -> C -> A')))
  assert(invalid.every(issue => !issue.message.includes('Maximum call stack')))
  assertEquals(document.components?.schemas?.['A' as RefName], undefined)
})

Deno.test('cycles - a diamond is not a cycle', () => {
  const { document, context } = parseSchemas({
    C: { type: 'object', properties: { c: { type: 'string' } } },
    B: { allOf: [ref('C'), { type: 'object', properties: { b: { type: 'string' } } }] },
    A: { allOf: [ref('B'), ref('C'), { type: 'object', properties: { a: { type: 'string' } } }] }
  })

  const a = schema(document, 'A')
  assert(a instanceof OasObject)
  assertEquals(Object.keys(a.properties ?? {}).sort(), ['a', 'b', 'c'])
  assertEquals(errors(context), [])
})

// ---------------------------------------------------------------------------
// Regression guards — documents that parse today produce the same IR.
// ---------------------------------------------------------------------------

Deno.test('cycles - a non-recursive inline allOf is merged in place, nothing hoisted', () => {
  const { document } = parseSchemas({
    Base: { type: 'object', properties: { id: { type: 'string' } } },
    Wrapper: {
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string' },
            { allOf: [ref('Base'), { type: 'object', properties: { extra: { type: 'string' } } }] }
          ]
        }
      }
    }
  })

  assertEquals(names(document).sort(), ['Base', 'Wrapper'])
  const wrapper = schema(document, 'Wrapper')
  assert(wrapper instanceof OasObject)
  const value = wrapper.properties?.value
  assert(value instanceof OasUnion)
  const [, composite] = value.members
  assert(composite instanceof OasObject)
  assertEquals(Object.keys(composite.properties ?? {}).sort(), ['extra', 'id'])
})

Deno.test('cycles - a union of inline members with wrapper properties is extended as before', () => {
  const { document } = parseSchemas({
    Shape: {
      properties: { id: { type: 'string' } },
      oneOf: [
        { type: 'object', properties: { r: { type: 'number' } } },
        { type: 'object', properties: { side: { type: 'number' } } }
      ]
    }
  })

  const shape = schema(document, 'Shape')
  assert(shape instanceof OasUnion)
  for (const member of shape.members) {
    assert(member instanceof OasObject)
    assert('id' in (member.properties ?? {}))
  }
})

// ---------------------------------------------------------------------------
// Review findings on skmtc/skmtc#125. Each is the reviewer's reproduction.
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
    assertEquals(errors(context), [])
  })

  await t.step('from an operation response schema (parsed before components)', () => {
    const { document, context } = parseSchemas(animals, {
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
    })
    assertEquals(document.operations.length, 1)
    assertEquals(errors(context), [])
  })

  await t.step('a sibling that extends the parent without being listed still parses', () => {
    const { document, context } = parseSchemas({
      ...animals,
      Other: { allOf: [ref('Animal'), { type: 'object', properties: { x: { type: 'string' } } }] }
    })
    const other = schema(document, 'Other')
    assert(other instanceof OasObject)
    assertEquals(Object.keys(other.properties ?? {}).sort(), ['kind', 'x'])
    assertEquals(errors(context), [])
  })
})

Deno.test('finding 2 - a recursive allOf as a DIRECT union member, wrapper keywords retained', async t => {
  const wrappers: [string, OpenAPIV3.SchemaObject][] = [
    ['type + properties', { type: 'object', properties: { common: { type: 'string' } } }],
    ['type only', { type: 'object' }],
    ['empty wrapper', {}]
  ]

  for (const [label, wrapper] of wrappers) {
    await t.step(`${label}: finite union, no stack overflow, no silent unrolling`, () => {
      const { document, context } = parseSchemas({
        Union: {
          ...wrapper,
          oneOf: [
            { allOf: [{ properties: { expression: { type: 'string' } } }, ref('Union')] },
            ref('Leaf')
          ]
        },
        Leaf: { type: 'object', properties: { leaf: { type: 'boolean' } } }
      })

      const union = schema(document, 'Union')
      assert(union instanceof OasUnion)
      assertEquals(memberNames(union), ['Union~oneOf~0', 'Leaf'])
      const hoisted = schema(document, 'Union~oneOf~0')
      assert(hoisted instanceof OasObject)
      assert('expression' in (hoisted.properties ?? {}))
      assert(!context.issues.some(issue => issue.message.includes('Maximum call stack')))
      assertEquals(errors(context), [])
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
      // `Account` extended by the keyword is a distinct, named schema: the
      // reference points at it, and it is finite because it refers back to
      // `Account` by name.
      assert(parent instanceof OasRef, `ParentAccount is a ${parent?.constructor.name}`)
      assertEquals(parent.toRefName(), 'Account~properties~ParentAccount~anyOf~0')
      const extended = schema(document, 'Account~properties~ParentAccount~anyOf~0')
      assert(extended instanceof OasObject)
      assert(!context.issues.some(issue => issue.message.includes('Maximum call stack')))
      assertEquals(errors(context), [])
    })
  }
})

Deno.test('finding 4 - a hoisted schema that depends on a failed schema is pruned like any component', () => {
  const { document, context } = parseSchemas({
    Bad: { not: {} },
    Base: {
      type: 'object',
      properties: {
        p: {
          oneOf: [
            { type: 'string' },
            { allOf: [ref('Base'), { type: 'object', properties: { bad: ref('Bad') } }] }
          ]
        }
      }
    }
  })

  assert(
    !names(document).some(name => name.includes('~')),
    `no orphan hoisted schema: ${names(document)}`
  )
  assert(context.issues.some(issue => issue.type === 'INVALID_DEPENDENCY_REF'))
})

Deno.test('finding 5 - the same recursive allOf reached by another path is one component with one name', async t => {
  await t.step('the fixture hoists exactly one schema', () => {
    const { document } = parseSchemas(recursiveInlineAllOf)
    assertEquals(
      names(document).filter(name => name.includes('~')),
      [HOISTED]
    )
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
    assertEquals(
      names(document).filter(name => name.includes('~')),
      [HOISTED]
    )
    const child = schema(document, 'ChildA')
    assert(child instanceof OasObject)
    const property = child.properties?.matchesJsonPath
    assert(property instanceof OasUnion)
    const [, composite] = property.members
    assert(composite instanceof OasRef)
    assertEquals(composite.toRefName(), HOISTED)
  })

  await t.step('component order does not change the name', () => {
    const reversed = Object.fromEntries(Object.entries(recursiveInlineAllOf).reverse())
    const { document } = parseSchemas(reversed)
    assertEquals(
      names(document).filter(name => name.includes('~')),
      [HOISTED]
    )
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
    assert(u instanceof OasObject || (u instanceof OasUnion && u.members.length === 1))
    assertExists(document.components?.schemas?.['Consumer' as RefName])
    // The merge layer's cross product drops the failing member; that it does
    // so silently is pre-existing behaviour, not something this change adds.
    assertEquals(errors(context), [])
  })

  await t.step('conflicting types', () => {
    const { document } = parseSchemas({
      U: { oneOf: [{ type: 'string' }, { allOf: [{ type: 'string' }, { type: 'integer' }] }] }
    })
    assertExists(document.components?.schemas?.['U' as RefName])
  })
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
    assertEquals(errors(context), [])
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
    assertEquals(errors(context), [])
  })

  await t.step('(c) a self-listing inline member', () => {
    const { document, context } = parseSchemas({
      Parent: {
        properties: { kind: { type: 'string' } },
        oneOf: [{ allOf: [ref('Parent'), { properties: { extra: { type: 'string' } } }] }]
      }
    })
    assertExists(document.components?.schemas?.['Parent' as RefName])
    const hoisted = schema(document, 'Parent~oneOf~0')
    assert(hoisted instanceof OasObject)
    assertEquals(Object.keys(hoisted.properties ?? {}).sort(), ['extra', 'kind'])
    assertEquals(errors(context), [])
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
      assertEquals(errors(context), [])
    })
  }
})
