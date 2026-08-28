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
