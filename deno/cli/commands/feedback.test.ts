import { assertEquals, assertStringIncludes } from '@std/assert'
import { stub } from '@std/testing/mock'
import denoJson from '@/deno.json' with { type: 'json' }
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { withCapturedExit } from '@/tests/mocks/exit.mock.ts'
import { renderFeedback } from '@/commands/feedback.ts'

/** Run `fn` with a home folder of its own and no token or hub variables. */
const withTempHome = async (env: Record<string, string>, fn: () => Promise<void>) => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-feedback-test-' })
  try {
    await withEnv(
      {
        HOME: home,
        USERPROFILE: home,
        SKMTC_HUB_TOKEN: undefined,
        SKMTC_ENV: undefined,
        SKMTC_API_ORIGIN: undefined,
        ...env
      },
      fn
    )
  } finally {
    Deno.removeSync(home, { recursive: true })
  }
}

type Sent = { url: string; body: unknown }

const withHub = async (respond: () => Response, fn: (sent: Sent[]) => Promise<void>) => {
  const sent: Sent[] = []
  const fetchStub = stub(globalThis, 'fetch', (input, init) => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return Promise.resolve(respond())
  })
  try {
    await fn(sent)
  } finally {
    fetchStub.restore()
  }
}

const created = (): Response =>
  new Response(
    JSON.stringify({ id: 'fb_1', issueUrl: 'https://github.com/skmtc/skmtc-hub/issues/9' }),
    { status: 201, headers: { 'content-type': 'application/json' } }
  )

const ARGS = {
  kind: 'problem' as const,
  summary: 'generate drops enum descriptions',
  details: 'Run generate on pets.yaml.',
  operation: undefined,
  resource: undefined,
  requestId: undefined,
  token: undefined,
  env: undefined
}

Deno.test('feedback - prints the id and the issue URL, and sends the CLI name and version', async () => {
  await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
    await withHub(created, async sent => {
      const run = await withCapturedExit(() =>
        renderFeedback({ ...ARGS, operation: 'generate', requestId: 'req-7' })
      )

      assertEquals(run.exitCode, 0)
      assertEquals(run.stdout.split('\n'), [
        'Feedback sent: fb_1',
        '  https://github.com/skmtc/skmtc-hub/issues/9'
      ])
      assertEquals(sent, [
        {
          url: 'https://api.skmtc.dev/v1/feedback',
          body: {
            kind: 'problem',
            summary: 'generate drops enum descriptions',
            details: 'Run generate on pets.yaml.',
            context: {
              operation: 'generate',
              requestId: 'req-7',
              clientName: 'skmtc-cli',
              clientVersion: denoJson.version
            }
          }
        }
      ])
    })
  })
})

Deno.test('feedback --json - prints the id and the issue URL as JSON', async () => {
  await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
    await withHub(created, async () => {
      const run = await withCapturedExit(() => renderFeedback({ ...ARGS, jsonFlag: true }))

      assertEquals(run.exitCode, 0)
      assertEquals(JSON.parse(run.stdout), {
        type: 'sent',
        id: 'fb_1',
        issueUrl: 'https://github.com/skmtc/skmtc-hub/issues/9'
      })
    })
  })
})

Deno.test('feedback - a missing --kind, --summary or --details exits 2 naming it', async () => {
  const cases = [
    { args: { kind: undefined }, flag: '--kind' },
    { args: { summary: undefined }, flag: '--summary' },
    { args: { details: undefined }, flag: '--details' }
  ]
  for (const { args, flag } of cases) {
    await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
      await withHub(created, async sent => {
        const run = await withCapturedExit(() => renderFeedback({ ...ARGS, ...args }))

        assertEquals(run.exitCode, 2)
        assertStringIncludes(run.stderr, `missing required argument: ${flag}`)
        assertEquals(sent, [])
      })
    })
  }
})

Deno.test('feedback - a summary of two lines or too long exits 2 before any request', async () => {
  for (const summary of ['one\ntwo', 'x'.repeat(201)]) {
    await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
      await withHub(created, async sent => {
        const run = await withCapturedExit(() => renderFeedback({ ...ARGS, summary }))

        assertEquals(run.exitCode, 2)
        assertStringIncludes(run.stderr, 'Error: --summary')
        assertEquals(sent, [])
      })
    })
  }
})

Deno.test('feedback - no token exits 2 with the login recipe', async () => {
  await withTempHome({}, async () => {
    await withHub(created, async sent => {
      const run = await withCapturedExit(() => renderFeedback({ ...ARGS, env: 'staging' }))

      assertEquals(run.exitCode, 2)
      assertStringIncludes(run.stderr, 'Run `skmtc login --env staging`')
      assertEquals(sent, [])
    })
  })
})

Deno.test('feedback - a 401 exits 1 with the skmtc login recipe', async () => {
  await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
    await withHub(
      () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      async () => {
        const run = await withCapturedExit(() => renderFeedback(ARGS))

        assertEquals(run.exitCode, 1)
        assertStringIncludes(run.stderr, 'Feedback failed (unauthorized, 401): Unauthorized.')
        assertStringIncludes(run.stderr, 'Run `skmtc login`')
      }
    )
  })
})

Deno.test('feedback - a 429 exits 1 saying when to try again', async () => {
  await withTempHome({ SKMTC_HUB_TOKEN: 'pat-123' }, async () => {
    await withHub(
      () =>
        new Response(JSON.stringify({ message: 'Feedback limit reached' }), {
          status: 429,
          headers: { 'retry-after': '45' }
        }),
      async () => {
        const run = await withCapturedExit(() => renderFeedback({ ...ARGS, jsonFlag: true }))

        assertEquals(run.exitCode, 1)
        assertEquals(JSON.parse(run.stdout).retryAfterSeconds, 45)
        assertEquals(
          JSON.parse(run.stdout).message,
          'Feedback limit reached. Try again in 45 seconds.'
        )
      }
    )
  })
})
