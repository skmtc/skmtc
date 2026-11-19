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

const parse = ({ openapi, system }: { openapi: string; system: SystemSettings | undefined }) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const document = parsed.type === 'oas' ? parsed.value : undefined
  const toSchema = (name: string): OasSchema | OasRef<'schema'> | undefined =>
    document?.components?.schemas?.[toRefName(`#/components/schemas/${name}`)]
  const toOperation = (path: string) => document?.operations.find(operation => operation.path === path)
  const issuesOf = (type: string) => context.issues.filter(issue => issue.type === type)

  return { toSchema, toOperation, issuesOf }
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
