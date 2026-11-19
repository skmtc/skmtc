import { assert, assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import type { OasParameter } from '@/oas/parameter/Parameter.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { SystemSettings } from '@/types/Settings.ts'

const string = { type: 'string' }

/** A path item that shares parameters with its operation, one of each kind. */
const pathItem = {
  parameters: [
    { name: 'id', in: 'path', required: true, schema: string },
    { $ref: '#/components/parameters/Trace' },
    { name: 'limit', in: 'query', schema: string },
    // Names nothing: kept only when `system.danglingRefs` lists `parameter`.
    { $ref: '#/components/parameters/MissingShared' }
  ],
  get: {
    parameters: [
      // Replaces the path item's `limit`: same name and location.
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
      // Same name as the path item's `id`, another location: both apply.
      { name: 'id', in: 'header', schema: string },
      { $ref: '#/components/parameters/MissingOwn' }
    ],
    responses: { '200': { description: 'ok' } }
  }
}

const components = {
  parameters: { Trace: { name: 'trace', in: 'header', schema: string } }
}

const parse = (openapi: string, system: SystemSettings) => {
  const value = JSON.parse(
    JSON.stringify({
      openapi,
      info: { title: 'Effective parameters', version: '1' },
      paths: { '/items/{id}': pathItem },
      ...(openapi === '3.0.3' ? {} : { webhooks: { itemChanged: pathItem } }),
      components
    })
  )
  const context = new ParseContext({
    input: { type: 'oas', value },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  assert(parsed.type === 'oas')

  return parsed.value
}

/** Each parameter as its location and name, or its `$ref` when it names nothing. */
const toLabels = (parameters: (OasParameter | OasRef<'parameter'>)[]): string[] =>
  parameters.map(parameter => {
    if (!parameter.isRef()) {
      return `${parameter.location}:${parameter.name}`
    }

    try {
      const { location, name } = parameter.resolve()

      return `${location}:${name} (ref)`
    } catch (error) {
      assert(DanglingRefError.is(error))

      return parameter.$ref
    }
  })

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} toEffectiveParameters: the path item's first, an own parameter replaces one of the same name and location, refs stay refs`, () => {
    const document = parse(openapi, { danglingRefs: ['parameter'] })
    const operation = document.operations.find(({ path }) => path === '/items/{id}')
    assert(operation !== undefined)

    const parameters = operation.toEffectiveParameters()

    assertEquals(toLabels(parameters), [
      'path:id',
      'header:trace (ref)',
      // A ref that names nothing keeps its place: it has no name or location.
      '#/components/parameters/MissingShared',
      'query:limit',
      'header:id',
      '#/components/parameters/MissingOwn'
    ])
    // The own `limit` replaced the path item's.
    const limit = parameters[3]
    assert(!limit.isRef() && limit.toSchema().type === 'integer')
  })

  Deno.test(`${openapi} toParams resolves toEffectiveParameters, and throws for a ref that names nothing`, () => {
    const listed = parse(openapi, { danglingRefs: ['parameter'] })
    const kept = listed.operations.find(({ path }) => path === '/items/{id}')
    assert(kept !== undefined)
    assertThrows(() => kept.toParams(), DanglingRefError)

    // Unlisted, the parser removes what holds a dangling ref: the shared one
    // takes the whole path item. A document without dangling refs reads the same.
    const unlisted = parse(openapi, { danglingRefs: [] })
    assertEquals(unlisted.operations.length, 0)
  })

  if (openapi !== '3.0.3') {
    Deno.test(`${openapi} a webhook's toEffectiveParameters reads the same as an operation's`, () => {
      const document = parse(openapi, { danglingRefs: ['parameter'] })
      const webhook = document.webhooks.find(({ name }) => name === 'itemChanged')
      const operation = document.operations.find(({ path }) => path === '/items/{id}')
      assert(webhook !== undefined && operation !== undefined)

      assertEquals(toLabels(webhook.toEffectiveParameters()), toLabels(operation.toEffectiveParameters()))
    })
  }
}
