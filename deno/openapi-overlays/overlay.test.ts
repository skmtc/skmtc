import { assertEquals, assertThrows } from '@std/assert'
import { parse as parseYaml } from '@std/yaml'
import {
  applyOverlay,
  type JsonValue,
  type Overlay,
  overlayFiles,
  stringifyDocument
} from './overlay.ts'

// applyOverlay narrates merge failures (e.g. the "immutable" fixture) to
// stderr; silence it so the test run stays readable.
console.error = () => {}

function fixture(type: 'openapi' | 'overlays' | 'expected', name: string): JsonValue {
  const url = new URL(`./fixtures/${type}/${name}.yaml`, import.meta.url)
  return parseYaml(Deno.readTextFileSync(url)) as JsonValue
}

// Each case mirrors a test from the upstream openapi-overlays-js suite. The
// reference tool asserts on serialised YAML; we compare parsed structures so
// the assertions are independent of key ordering and YAML formatting.
const cases: Array<{ name: string; openapi: string; overlay: string; expected: string }> = [
  {
    name: 'structured overlay (remove + wildcard + append)',
    openapi: 'petstore',
    overlay: 'overlay',
    expected: 'output1'
  },
  {
    name: 'add description and update summary',
    openapi: 'town',
    overlay: 'building-description',
    expected: 'town-building-description'
  },
  {
    name: 'update the root object',
    openapi: 'town',
    overlay: 'update-root',
    expected: 'town-root-updated'
  },
  {
    name: 'remove an example',
    openapi: 'town',
    overlay: 'remove-example',
    expected: 'town-remove-example'
  },
  {
    name: 'remove properties by filter',
    openapi: 'town',
    overlay: 'remove-properties',
    expected: 'town-remove-properties'
  },
  {
    name: 'remove all description fields',
    openapi: 'town',
    overlay: 'remove-descriptions',
    expected: 'town-remove-descriptions'
  },
  {
    name: 'remove a server array entry',
    openapi: 'openapi-with-servers',
    overlay: 'remove-server',
    expected: 'one-less-server'
  },
  {
    name: 'remove all matching responses',
    openapi: 'responses',
    overlay: 'remove-responses',
    expected: 'remove-responses'
  },
  {
    name: 'fail to update a primitive (no-op)',
    openapi: 'immutable',
    overlay: 'immutable',
    expected: 'immutable'
  },
  {
    name: 'invalid jsonpath target (no-op)',
    openapi: 'not-jsonpath',
    overlay: 'not-jsonpath',
    expected: 'not-jsonpath'
  },
  {
    name: 'document without actions (no-op)',
    openapi: 'not-overlay',
    overlay: 'not-overlay',
    expected: 'not-overlay'
  }
]

for (const testCase of cases) {
  Deno.test(`applyOverlay - ${testCase.name}`, () => {
    const result = applyOverlay(
      fixture('openapi', testCase.openapi),
      fixture('overlays', testCase.overlay) as Overlay
    )
    assertEquals(result, fixture('expected', testCase.expected))
  })
}

Deno.test('overlayFiles - serialises the overlaid document to YAML', async () => {
  const yaml = await overlayFiles(
    new URL('./fixtures/openapi/town.yaml', import.meta.url).pathname,
    new URL('./fixtures/overlays/update-root.yaml', import.meta.url).pathname
  )
  const parsed = parseYaml(yaml) as Record<string, JsonValue>
  const info = parsed.info as Record<string, JsonValue>
  assertEquals(info['x-overlaid'], true)
})

Deno.test('overlayFiles - can output JSON', async () => {
  const json = await overlayFiles(
    new URL('./fixtures/openapi/town.yaml', import.meta.url).pathname,
    new URL('./fixtures/overlays/update-root.yaml', import.meta.url).pathname,
    { format: 'json' }
  )
  const parsed = JSON.parse(json) as Record<string, JsonValue>
  const info = parsed.info as Record<string, JsonValue>
  assertEquals(info['x-overlaid'], true)
})

Deno.test('overlayFiles - YAML and JSON output describe the same document', async () => {
  const openapi = new URL('./fixtures/openapi/petstore.yaml', import.meta.url).pathname
  const overlay = new URL('./fixtures/overlays/overlay.yaml', import.meta.url).pathname

  const fromYaml = parseYaml(await overlayFiles(openapi, overlay, { format: 'yaml' }))
  const fromJson = JSON.parse(await overlayFiles(openapi, overlay, { format: 'json' }))

  assertEquals(fromJson, fromYaml)
})

Deno.test('stringifyDocument - orders well-known OpenAPI fields first', () => {
  const json = stringifyDocument({ paths: {}, info: { title: 'API' } }, 'json')
  const keys = Object.keys(JSON.parse(json) as Record<string, unknown>)
  assertEquals(keys, ['info', 'paths'])
})

Deno.test('stringifyDocument - preserves the order of unknown keys', () => {
  const json = stringifyDocument({ zebra: 1, apple: 2 }, 'json')
  const keys = Object.keys(JSON.parse(json) as Record<string, unknown>)
  assertEquals(keys, ['zebra', 'apple'])
})

Deno.test('applyOverlay - appends to existing arrays', () => {
  const spec: JsonValue = { tags: ['a'] }
  const result = applyOverlay(spec, {
    overlay: '1.0.0',
    actions: [{ target: '$', update: { tags: ['b', 'c'] } }]
  }) as Record<string, JsonValue>
  assertEquals(result.tags, ['a', 'b', 'c'])
})

Deno.test('applyOverlay - removes an array element by filter', () => {
  const spec: JsonValue = {
    servers: [
      { url: 'dev', description: 'Dev' },
      { url: 'prod', description: 'Prod' }
    ]
  }
  const result = applyOverlay(spec, {
    overlay: '1.0.0',
    actions: [{ target: "$.servers[?(@.description == 'Dev')]", remove: true }]
  }) as Record<string, JsonValue>
  assertEquals(result.servers, [{ url: 'prod', description: 'Prod' }])
})

Deno.test('applyOverlay - recursive filter applies over specs containing null nodes', () => {
  // Regression: jsonpath-plus 10.x throws when `@.description` hits a null
  // node during recursive descent, which silently aborted the action. Our
  // engine null-guards, so the overlay applies without a `@ && …` workaround.
  const spec: JsonValue = {
    components: {
      schemas: {
        Check: {
          properties: {
            value: { description: 'The value of the check, should it exist.' },
            nullable: null
          }
        }
      }
    }
  }

  const result = applyOverlay(spec, {
    overlay: '1.0.0',
    actions: [
      {
        target: "$..[?(@.description == 'The value of the check, should it exist.')]",
        update: { type: 'string' }
      }
    ]
  })

  const value = JSON.parse(JSON.stringify(result)).components.schemas.Check.properties.value
  assertEquals(value.type, 'string')
})

Deno.test('applyOverlay - strict mode throws on a failed action', () => {
  const spec: JsonValue = { info: { version: '1.0.0' } }
  const overlay: Overlay = {
    overlay: '1.0.0',
    actions: [{ target: 'info.version', update: { nope: true } }]
  }

  // Non-strict: logged and skipped, document unchanged.
  assertEquals(applyOverlay(structuredClone(spec), overlay), spec)

  // Strict: surfaces the failure instead of silently shipping it.
  assertThrows(
    () => applyOverlay(structuredClone(spec), overlay, { strict: true }),
    Error,
    'info.version'
  )
})

Deno.test('applyOverlay - strict mode ignores actions that simply match nothing', () => {
  const spec: JsonValue = { info: { title: 'API' } }
  const result = applyOverlay(
    structuredClone(spec),
    {
      overlay: '1.0.0',
      actions: [{ target: '$.paths.does.not.exist', update: { x: 1 } }]
    },
    { strict: true }
  )
  assertEquals(result, spec)
})

Deno.test('applyOverlay - injects a $ref by replacing an inline schema', () => {
  const spec: JsonValue = {
    paths: {
      '/pets': {
        get: {
          responses: {
            '200': {
              content: {
                'application/json': { schema: { type: 'object', properties: {} } }
              }
            }
          }
        }
      }
    }
  }

  const overlay: Overlay = {
    overlay: '1.0.0',
    actions: [
      {
        target: "$.paths['/pets'].get.responses['200'].content['application/json'].schema",
        remove: true
      },
      {
        target: "$.paths['/pets'].get.responses['200'].content['application/json']",
        update: { schema: { $ref: '#/components/schemas/Pet' } }
      }
    ]
  }

  const result = applyOverlay(spec, overlay)
  const schema = JSON.parse(JSON.stringify(result)).paths['/pets'].get.responses['200'].content[
    'application/json'
  ].schema
  assertEquals(schema, { $ref: '#/components/schemas/Pet' })
})
