/**
 * `toWorker` runs inside a Web Worker. These tests run it in-process by
 * giving `globalThis` the two members a worker scope has (`postMessage`,
 * `onmessage`), then driving the handler with messages the CLI sends.
 */
import { assert, assertEquals, assertThrows } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import toWorker, { buildAttributionState } from '@/worker/mod.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

const emptyGenerators = <EnrichmentType = undefined>(): GeneratorsMapContainer<EnrichmentType> => ({})

const document: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {}
}

type Posted = Record<string, unknown>

const isPosted = (value: unknown): value is Posted => typeof value === 'object' && value !== null

/**
 * Installs a fake worker scope on `globalThis` for the length of `fn`,
 * and hands `fn` the messages posted so far plus a way to send one.
 */
const withWorkerScope = (fn: (scope: { posted: Posted[]; send: (data: unknown) => void }) => void) => {
  const posted: Posted[] = []

  Object.defineProperty(globalThis, 'postMessage', {
    configurable: true,
    writable: true,
    value: (message: unknown) => {
      if (isPosted(message)) posted.push(message)
    }
  })
  Object.defineProperty(globalThis, 'onmessage', { configurable: true, writable: true, value: null })

  const send = (data: unknown) => {
    const handler: unknown = Reflect.get(globalThis, 'onmessage')
    assert(typeof handler === 'function', 'toWorker did not set onmessage')
    handler(new MessageEvent('message', { data }))
  }

  try {
    fn({ posted, send })
  } finally {
    Reflect.deleteProperty(globalThis, 'postMessage')
    Reflect.deleteProperty(globalThis, 'onmessage')
  }
}

Deno.test('toWorker - refuses to start outside a Web Worker', () => {
  // The main Deno thread has no postMessage; a silent no-op here would
  // leave the host waiting for a READY that never comes.
  assertThrows(() => toWorker(emptyGenerators), Error, 'must run inside a Web Worker')
})

Deno.test('toWorker - posts READY with the generator ids it was given', () => {
  withWorkerScope(({ posted }) => {
    toWorker(emptyGenerators)

    assertEquals(posted, [{ type: 'READY', generatorIds: [] }])
  })
})

Deno.test('toWorker - GENERATE runs the pipeline and posts the RESULT', () => {
  withWorkerScope(({ posted, send }) => {
    toWorker(emptyGenerators)

    send({ type: 'GENERATE', payload: { document: { type: 'oas', value: document }, silent: true } })

    const result = posted.at(-1)
    assertEquals(result?.type, 'RESULT')
    assertEquals(result?.artifacts, {})
    assert(isPosted(result?.manifest), 'RESULT carries the manifest')
  })
})

Deno.test('toWorker - DESCRIBE posts subjects, descriptors and defaults', () => {
  withWorkerScope(({ posted, send }) => {
    toWorker(emptyGenerators)

    send({ type: 'DESCRIBE', payload: { document: { type: 'oas', value: document } } })

    const result = posted.at(-1)
    assertEquals(result?.type, 'RESULT')
    assertEquals(result?.descriptors, [])
    assertEquals(result?.parseIssues, [])
  })
})

Deno.test('toWorker - an unknown message type posts an ERROR instead of throwing', () => {
  withWorkerScope(({ posted, send }) => {
    toWorker(emptyGenerators)

    send({ type: 'NOPE' })

    assertEquals(posted.at(-1), { type: 'ERROR', error: 'Unknown message type: NOPE' })
  })
})

Deno.test('toWorker - a pipeline failure posts an ERROR with the message and stack', () => {
  withWorkerScope(({ posted, send }) => {
    toWorker(emptyGenerators)

    // No document: toArtifacts throws, and the host must hear about it.
    send({ type: 'GENERATE', payload: {} })

    const result = posted.at(-1)
    assertEquals(result?.type, 'ERROR')
    assertEquals(typeof result?.error, 'string')
  })
})

Deno.test('buildAttributionState - nothing to emit without a postPass', () => {
  assertEquals(buildAttributionState(undefined), undefined)
  assertEquals(buildAttributionState({}), undefined)
})

Deno.test('buildAttributionState - rebuilds generatorMeta as a lookup with a default', () => {
  const state = buildAttributionState({
    postPass: {
      schemaSrc: '{}',
      generatorMeta: { '@skmtc/gen-zod': { version: '0.2.13', registry: { host: 'jsr.io', type: 'jsr' } } }
    }
  })

  const lookup = state?.postPass?.generatorMeta
  assert(lookup !== undefined)
  assertEquals(lookup('@skmtc/gen-zod').version, '0.2.13')
  // An id missing from the payload falls back instead of throwing.
  assertEquals(lookup('@skmtc/unknown'), { version: '', registry: { host: 'jsr.io', type: 'jsr' } })
})
