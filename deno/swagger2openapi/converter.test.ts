import { assertEquals, assertExists, assertStringIncludes, assertThrows } from '@std/assert'
import { fromFileUrl } from '@std/path'
import { ConvertError, convertObj, convertStr, targetVersion } from './converter.ts'
import { convertFile, convertStream } from './io.ts'
import { isJsonObject, type JsonValue, toJson } from './json.ts'

const readFixture = async (name: string): Promise<JsonValue> => {
  const path = fromFileUrl(new URL(`./fixtures/${name}`, import.meta.url))
  return toJson(JSON.parse(await Deno.readTextFile(path)))
}

const obj = (value: JsonValue): Record<string, JsonValue> => {
  if (!isJsonObject(value)) throw new Error('expected object')
  return value
}

Deno.test('convertObj - petstore matches the canonical OpenAPI 3.0 fixture', async () => {
  const swagger = await readFixture('petstore.swagger.json')
  const expected = await readFixture('petstore.openapi.json')

  const { openapi } = convertObj(swagger, { origin: 'http://petstore.swagger.io/v2/swagger.json' })

  // The only expected difference is the converter version stamped into x-origin.
  const normalize = (doc: JsonValue): string =>
    JSON.stringify(doc).replace(/"version":"[^"]*"(\}\}\])/g, '"version":"X"$1')

  assertEquals(normalize(openapi), normalize(expected))
})

Deno.test('convertObj - sets the target OpenAPI version and drops swagger fields', () => {
  const { openapi } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    host: 'example.com',
    basePath: '/v1',
    schemes: ['https'],
    paths: {}
  })
  const doc = obj(openapi)
  assertEquals(doc.openapi, targetVersion)
  assertEquals(doc.swagger, undefined)
  assertEquals(doc.host, undefined)
  assertEquals(doc.basePath, undefined)
  assertEquals(JSON.stringify(doc.servers), JSON.stringify([{ url: 'https://example.com/v1' }]))
})

Deno.test('convertObj - basic securityDefinitions become securitySchemes', () => {
  const { openapi } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    paths: {},
    securityDefinitions: {
      petstore_auth: {
        type: 'oauth2',
        flow: 'implicit',
        authorizationUrl: 'https://example.com/auth',
        scopes: { 'read:pets': 'read your pets' }
      }
    }
  })
  const components = obj(obj(openapi).components)
  const schemes = obj(components.securitySchemes)
  const scheme = obj(schemes.petstore_auth)
  assertEquals(scheme.type, 'oauth2')
  assertExists(obj(scheme.flows).implicit)
})

Deno.test('convertObj - passes through an OpenAPI 3.x document unchanged in version', () => {
  const { openapi } = convertObj({
    openapi: '3.0.1',
    info: { title: 't', version: '1' },
    paths: {}
  })
  assertEquals(obj(openapi).openapi, '3.0.1')
})

Deno.test('convertObj - throws on an unsupported version', () => {
  assertThrows(
    () => convertObj({ swagger: '1.2', info: { title: 't', version: '1' }, paths: {} }),
    ConvertError,
    'Unsupported'
  )
})

Deno.test('convertObj - non-patchable missing info throws; patch repairs it', () => {
  assertThrows(
    () => convertObj({ swagger: '2.0', paths: {} }),
    ConvertError,
    'info object is mandatory'
  )
  const { openapi } = convertObj({ swagger: '2.0', paths: {} }, { patch: true })
  assertExists(obj(openapi).info)
})

Deno.test('convertObj - rejects options.resolve (use convertObjResolve instead)', () => {
  assertThrows(
    () =>
      convertObj(
        { swagger: '2.0', info: { title: 't', version: '1' }, paths: {} },
        {
          resolve: true
        }
      ),
    ConvertError,
    'convertObjResolve'
  )
})

Deno.test('convertStr - parses JSON and reports sourceYaml false', () => {
  const result = convertStr(
    JSON.stringify({ swagger: '2.0', info: { title: 't', version: '1' }, paths: {} })
  )
  assertEquals(result.sourceYaml, false)
  assertEquals(obj(result.openapi).openapi, targetVersion)
})

Deno.test('convertStr - parses YAML and reports sourceYaml true', () => {
  const yaml = `swagger: "2.0"
info:
  title: t
  version: "1"
paths: {}
`
  const result = convertStr(yaml)
  assertEquals(result.sourceYaml, true)
  assertEquals(obj(result.openapi).openapi, targetVersion)
})

Deno.test('convertObj - body parameter becomes a requestBody', () => {
  const { openapi } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    consumes: ['application/json'],
    paths: {
      '/pets': {
        post: {
          operationId: 'addPet',
          parameters: [
            {
              name: 'body',
              in: 'body',
              required: true,
              schema: { type: 'object' }
            }
          ],
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  })
  const post = obj(obj(obj(obj(openapi).paths)['/pets']).post)
  assertExists(post.requestBody)
  const requestBody = obj(post.requestBody)
  assertExists(obj(requestBody.content)['application/json'])
  assertEquals(post.parameters, undefined)
})

Deno.test('convertStr - throws on unparseable input', () => {
  assertThrows(() => convertStr('this: : : not valid'), ConvertError)
})

Deno.test('convertFile - reads and converts a local Swagger file', async () => {
  const path = fromFileUrl(new URL('./fixtures/petstore.swagger.json', import.meta.url))
  const { openapi } = await convertFile(path, { origin: 'x' })
  assertEquals(obj(openapi).openapi, targetVersion)
})

Deno.test('convertStream - drains a stream then converts', async () => {
  const body = JSON.stringify({ swagger: '2.0', info: { title: 't', version: '1' }, paths: {} })
  const stream = new Response(body).body
  assertExists(stream)
  const { openapi } = await convertStream(stream)
  assertEquals(obj(openapi).openapi, targetVersion)
})

Deno.test('convertObj - formData parameter migrates to urlencoded requestBody', () => {
  const { openapi } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    paths: {
      '/upload': {
        post: {
          operationId: 'upload',
          parameters: [{ name: 'field', in: 'formData', type: 'string' }],
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  })
  const post = obj(obj(obj(obj(openapi).paths)['/upload']).post)
  const content = obj(obj(post.requestBody).content)
  const media = obj(content['application/x-www-form-urlencoded'])
  const schema = obj(media.schema)
  assertEquals(schema.type, 'object')
  assertStringIncludes(JSON.stringify(schema.properties), 'field')
})
