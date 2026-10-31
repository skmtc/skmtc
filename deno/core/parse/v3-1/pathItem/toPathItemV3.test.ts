import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toPathItemV3 } from './toPathItemV3.ts'
import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

Deno.test('toPathItemV3 - basic path item', () => {
  const stackTrail = new StackTrail(['TEST'])
  const pathItem: OpenAPIV3.PathItemObject = {}
  const { pathItem: oasPathItem, brokenParameters } = toPathItemV3({
    pathItem,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasPathItem, new OasPathItem())
  assertEquals(brokenParameters, [])
})

const ok = { responses: { '200': { description: 'ok' } } }

const servers = [{ url: 'https://path.example.com', description: 'Path server' }]

const parse = (document: Record<string, unknown>) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        { openapi: '3.1.0', info: { title: 't', version: '0' }, ...document },
        '3.1 document'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  return { issues: context.issues, document: result.value }
}

const toServerSummaries = (pathItem: OasPathItem | undefined) =>
  pathItem?.servers?.map(({ url, description }) => ({ url, description }))

Deno.test('toPathItemV3 - an operation path item exposes its servers', () => {
  const { issues, document } = parse({ paths: { '/pets': { servers, get: ok } } })

  assertEquals(issues, [])
  assertEquals(toServerSummaries(document.operations[0].pathItem), servers)
})

Deno.test('toPathItemV3 - a webhook path item exposes its servers', () => {
  const { issues, document } = parse({ webhooks: { newPet: { servers, post: ok } } })

  assertEquals(issues, [])
  assertEquals(toServerSummaries(document.webhooks[0].pathItem), servers)
})

Deno.test('toPathItemV3 - a path item without servers leaves the field undefined', () => {
  const { issues, document } = parse({ paths: { '/pets': { summary: 'Pets', get: ok } } })

  assertEquals(issues, [])
  assert(document.operations[0].pathItem instanceof OasPathItem)
  assertEquals(document.operations[0].pathItem.servers, undefined)
})

Deno.test('toPathItemV3 - servers that is not an array logs an issue instead of throwing', () => {
  const { issues, document } = parse({
    paths: { '/pets': { servers: 'https://path.example.com', get: ok }, '/owners': { get: ok } }
  })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'error', type: 'INVALID_OPERATION', location: 'TEST:paths:/pets:servers' }]
  )
  assertEquals(
    document.operations.map(({ path, pathItem }) => ({ path, servers: pathItem?.servers })),
    [
      { path: '/pets', servers: undefined },
      { path: '/owners', servers: undefined }
    ]
  )
})
