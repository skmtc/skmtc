import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { findSubclassLists, normalizeComposition } from './normalizeComposition.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const document = (
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
): OpenAPIV3.Document => ({
  openapi: '3.0.3',
  info: { title: 't', version: '1' },
  paths: {},
  components: { schemas }
})

Deno.test('normalizeComposition - a document with nothing to rewrite is returned as-is', () => {
  const input = document({
    Shape: { oneOf: [ref('Circle'), ref('Square')], discriminator: { propertyName: 'kind' } },
    Circle: { type: 'object', properties: { r: { type: 'number' } } },
    Square: { type: 'object', properties: { side: { type: 'number' } } }
  })

  const { document: output, hoisted, bases } = normalizeComposition(input)

  assertStrictEquals(output, input)
  assertEquals(hoisted, [])
  assertEquals(bases.size, 0)
})

Deno.test('normalizeComposition - a wrapper with extending keywords is distributed into its members as allOf', () => {
  const input = document({
    Pet: {
      properties: { id: { type: 'string' } },
      required: ['id'],
      oneOf: [ref('Cat'), { type: 'object' }]
    },
    Cat: { type: 'object', properties: { meows: { type: 'boolean' } } }
  })

  const { document: output, bases } = normalizeComposition(input)
  const pet = output.components?.schemas?.Pet as OpenAPIV3.SchemaObject
  const extension: OpenAPIV3.SchemaObject = {
    properties: { id: { type: 'string' } },
    required: ['id']
  }

  assertEquals(pet, {
    oneOf: [{ allOf: [extension, ref('Cat')] }, { allOf: [extension, { type: 'object' }] }]
  })
  assertEquals(bases.size, 0)
  assertEquals(input.components?.schemas?.Pet, {
    properties: { id: { type: 'string' } },
    required: ['id'],
    oneOf: [ref('Cat'), { type: 'object' }]
  })
})

Deno.test('normalizeComposition - a parent that lists its subclasses keeps the list and sets its base aside', () => {
  const input = document({
    Target: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
      discriminator: { propertyName: 'type' },
      oneOf: [ref('TargetSSH'), { allOf: [ref('TargetFTP')] }]
    },
    TargetSSH: { allOf: [ref('Target'), { properties: { host: { type: 'string' } } }] },
    TargetFTP: { allOf: [ref('Target'), { properties: { passive: { type: 'boolean' } } }] }
  })

  assertEquals(findSubclassLists(input), new Set(['Target']))

  const { document: output, bases } = normalizeComposition(input)
  const target = output.components?.schemas?.Target as OpenAPIV3.SchemaObject

  assertEquals(target, {
    type: 'object',
    discriminator: { propertyName: 'type' },
    oneOf: [ref('TargetSSH'), { allOf: [ref('TargetFTP')] }]
  })
  assertEquals(bases.get('Target'), {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } }
  })
})

Deno.test('normalizeComposition - a subclass list is recognised through an intermediate level', () => {
  const input = document({
    Grandparent: { properties: { id: { type: 'string' } }, oneOf: [ref('Child')] },
    Parent: { allOf: [ref('Grandparent'), { properties: { p: { type: 'string' } } }] },
    Child: { allOf: [ref('Parent'), { properties: { c: { type: 'string' } } }] }
  })

  assertEquals(findSubclassLists(input), new Set(['Grandparent']))
})

Deno.test('normalizeComposition - allOf beside a union is left to the parser', () => {
  const input = document({
    Wrapper: { oneOf: [ref('A')], allOf: [ref('A')], description: 'd' },
    A: { type: 'object' }
  })

  const { document: output } = normalizeComposition(input)

  assertStrictEquals(output, input)
})
