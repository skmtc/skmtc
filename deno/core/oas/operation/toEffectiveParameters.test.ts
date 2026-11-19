import { assert, assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import type { OasParameter } from '@/oas/parameter/Parameter.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { SystemSettings } from '@/types/Settings.ts'

const string = { type: 'string' }
const responses = { '200': { description: 'ok' } }

/** The parameters a path item and its operation both declare, without refs that name nothing. */
const sharedParameters = [
  { name: 'id', in: 'path', required: true, schema: string },
  { $ref: '#/components/parameters/Trace' },
  { name: 'limit', in: 'query', schema: string }
]
const ownParameters = [
  // Replaces the path item's `limit`: same name and location.
  { name: 'limit', in: 'query', schema: { type: 'integer' } },
  // Same name as the path item's `id`, another location: both apply.
  { name: 'id', in: 'header', schema: string }
]

// Each `Missing…` ref names nothing in the document: the parser keeps it only
// when `system.danglingRefs` lists `parameter`.
const pathItem = {
  parameters: [...sharedParameters, { $ref: '#/components/parameters/MissingShared' }],
  get: {
    parameters: [...ownParameters, { $ref: '#/components/parameters/MissingOwn' }],
    responses
  }
}

const components = {
  parameters: { Trace: { name: 'trace', in: 'header', schema: string } }
}

type ParseArgs = {
  openapi: string
  system: SystemSettings
  /** The path item of `/items/{id}`, and of the `itemChanged` webhook. */
  item?: Record<string, unknown>
}

const parse = ({ openapi, system, item = pathItem }: ParseArgs) => {
  const value = JSON.parse(
    JSON.stringify({
      openapi,
      info: { title: 'Effective parameters', version: '1' },
      paths: { '/items/{id}': item },
      ...(openapi === '3.0.3' ? {} : { webhooks: { itemChanged: item } }),
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
  const document = parsed.value
  const operation = document.operations.find(({ path }) => path === '/items/{id}')

  return { document, operation }
}

const listed: SystemSettings = { danglingRefs: ['parameter'] }

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
    const { operation } = parse({ openapi, system: listed })
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

  Deno.test(`${openapi} toEffectiveParameters: the same ref that names nothing on both sides is kept once, in the operation's place`, () => {
    const missing = { $ref: '#/components/parameters/MissingShared' }
    const { operation } = parse({
      openapi,
      system: listed,
      item: { parameters: [missing, ...sharedParameters], get: { parameters: [...ownParameters, missing], responses } }
    })
    assert(operation !== undefined)

    assertEquals(toLabels(operation.toEffectiveParameters()), [
      'path:id',
      'header:trace (ref)',
      'query:limit',
      'header:id',
      '#/components/parameters/MissingShared'
    ])
  })

  Deno.test(`${openapi} toParams resolves toEffectiveParameters, and throws for a ref that names nothing`, () => {
    // Without refs that name nothing: the resolved list, in the same order.
    const { operation: clean } = parse({
      openapi,
      system: listed,
      item: { parameters: sharedParameters, get: { parameters: ownParameters, responses } }
    })
    assert(clean !== undefined)
    assertEquals(
      clean.toParams(),
      clean.toEffectiveParameters().map(parameter => parameter.resolve())
    )
    assertEquals(toLabels(clean.toParams()), ['path:id', 'header:trace', 'query:limit', 'header:id'])

    const { operation: kept } = parse({ openapi, system: listed })
    assert(kept !== undefined)
    assertThrows(() => kept.toParams(), DanglingRefError)

    // Unlisted, the parser removes what holds a ref that names nothing: the
    // path item's takes the whole path item.
    const { document: unlisted } = parse({ openapi, system: { danglingRefs: [] } })
    assertEquals(unlisted.operations.length, 0)
  })

  Deno.test(`${openapi} toJsonSchema throws DanglingRefError for a parameter ref that names nothing, and writes the merged parameters otherwise`, () => {
    // Neither a `$ref` to nothing nor a parameter quietly left out: the caller decides.
    const { operation } = parse({ openapi, system: listed })
    assert(operation !== undefined)
    for (const resolve of [false, true]) {
      assertThrows(() => operation.toJsonSchema({ resolve }), DanglingRefError)
    }

    const { operation: clean } = parse({
      openapi,
      system: listed,
      item: { parameters: sharedParameters, get: { parameters: ownParameters, responses } }
    })
    assert(clean !== undefined)
    const written = (clean.toJsonSchema({ resolve: false }).parameters ?? []).map(parameter =>
      '$ref' in parameter ? parameter.$ref : `${parameter.in}:${parameter.name}`
    )
    assertEquals(written, ['path:id', '#/components/parameters/Trace', 'query:limit', 'header:id'])
  })

  Deno.test(`${openapi} a parameter ref with no name names nothing: it is kept, and its name and toJsonSchema throw DanglingRefError`, () => {
    const { operation } = parse({
      openapi,
      system: listed,
      item: { get: { parameters: [{ $ref: '#/components/parameters/' }, ...ownParameters], responses } }
    })
    assert(operation !== undefined)

    const [noName] = operation.toEffectiveParameters()
    assert(noName.isRef() && noName.$ref === '#/components/parameters/')
    assertThrows(() => noName.toRefName(), DanglingRefError)
    assertThrows(() => noName.toJSON(), DanglingRefError)
    assertThrows(() => operation.toJsonSchema({ resolve: false }), DanglingRefError)
  })

  if (openapi !== '3.0.3') {
    Deno.test(`${openapi} a webhook's toEffectiveParameters reads the same as an operation's`, () => {
      const { document, operation } = parse({ openapi, system: listed })
      const webhook = document.webhooks.find(({ name }) => name === 'itemChanged')
      assert(webhook !== undefined && operation !== undefined)

      assertEquals(toLabels(webhook.toEffectiveParameters()), toLabels(operation.toEffectiveParameters()))
    })
  }
}
