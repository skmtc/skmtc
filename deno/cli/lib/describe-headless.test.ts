import { assertEquals } from '@std/assert'
import { describeHeadless } from '@/lib/describe-headless.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { mockClientJsonContents } from '@/tests/fixtures/client-json.fixture.ts'
import type { DescribePayload } from '@skmtc/worker/types'

const OriginalWorker = globalThis.Worker

// Mirrors the MockWorker in describe-worker.test.ts — we only need it to
// drive the READY → DESCRIBE → RESULT handshake without a real bundle.
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((error: ErrorEvent) => void) | null = null

  constructor(
    public url: string,
    public options?: WorkerOptions
  ) {}

  postMessage(_data: unknown) {}

  terminate() {}

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }
}

const emptyDescribeResult = {
  type: 'RESULT',
  subjects: {},
  descriptors: [],
  enrichmentDefaults: {},
  parseIssues: []
}

Deno.test(
  'describeHeadless - resolves client.json#source, feeds it to the worker, and stamps projectName',
  async () => {
    const schemaPath = await Deno.makeTempFile({ suffix: '.json' })
    await Deno.writeTextFile(
      schemaPath,
      JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Source-Of-Truth API', version: '1.0.0' },
        paths: {}
      })
    )

    // A mutable box: the closure assignment is invisible to TS flow
    // analysis, so a plain `let` would stay narrowed to `null`. Reading
    // a box property after the `await` keeps the declared type.
    const captured: { payload: DescribePayload | null } = { payload: null }

    globalThis.Worker = class {
      constructor(url: string | URL, options?: WorkerOptions) {
        const instance = new MockWorker(url.toString(), options)
        instance.postMessage = (data: unknown) => {
          const message = data as { type: string; payload: DescribePayload }
          if (message.type === 'DESCRIBE') {
            captured.payload = message.payload
            setTimeout(() => instance.simulateMessage(emptyDescribeResult), 0)
          }
        }
        setTimeout(() => instance.simulateMessage({ type: 'READY' }), 0)
        return instance as unknown as Worker
      }
    } as unknown as typeof Worker

    try {
      const manager = createMockManager()
      const project = createMockProject(manager, { name: 'my-api' })
      // No explicit schema override is passed, so describe must fall back
      // to client.json#source — point it at our fixture file.
      project.clientJson.contents = {
        settings: mockClientJsonContents.settings,
        source: schemaPath
      }

      const result = await describeHeadless({ project, schemaSourceString: undefined })

      // The worker's response is stamped with the project it ran for.
      assertEquals(result.projectName, 'my-api')

      // The schema the worker received is the one resolved from
      // client.json#source, converted host-side to an OAS document.
      const payload = captured.payload
      assertEquals(payload?.document.type, 'oas')
      if (payload?.document.type === 'oas') {
        assertEquals(payload.document.value.info.title, 'Source-Of-Truth API')
      }
    } finally {
      globalThis.Worker = OriginalWorker
      await Deno.remove(schemaPath)
    }
  }
)
