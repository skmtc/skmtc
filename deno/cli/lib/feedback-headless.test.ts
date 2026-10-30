import { assertEquals } from '@std/assert'
import { feedbackHeadless, toFeedbackInputProblem, toWaitText } from '@/lib/feedback-headless.ts'
import {
  withNeverAnsweringFetch,
  withStallingBodyFetch
} from '@/tests/mocks/never-answering-fetch.mock.ts'

const originalFetch = globalThis.fetch

type Call = { url: string; method?: string; authorization: string | null; body?: string }

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })

const withFetch = async (
  respond: () => Response,
  run: (calls: Call[]) => Promise<void>
): Promise<void> => {
  const calls: Call[] = []
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: input.toString(),
      method: init?.method,
      authorization: new Headers(init?.headers).get('authorization'),
      body: typeof init?.body === 'string' ? init.body : undefined
    })
    return Promise.resolve(respond())
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

const BASE = {
  kind: 'problem' as const,
  summary: 'generate drops enum descriptions',
  details: 'Run generate on pets.yaml.',
  context: { clientName: 'skmtc-cli', clientVersion: '1.2.3' },
  token: 'pat-123',
  tokenSource: 'stored' as const,
  origin: 'https://hub.test',
  env: 'staging' as const
}

Deno.test('feedbackHeadless - posts the SendFeedbackRequest body and reads SentFeedback', async () => {
  await withFetch(
    () => json({ id: 'fb_1', issueUrl: 'https://github.com/skmtc/skmtc-hub/issues/9' }, 201),
    async calls => {
      const result = await feedbackHeadless({
        ...BASE,
        context: { ...BASE.context, operation: 'generate', resource: '@acme/pets', requestId: 'r1' }
      })

      assertEquals(result, {
        type: 'sent',
        id: 'fb_1',
        issueUrl: 'https://github.com/skmtc/skmtc-hub/issues/9'
      })
      assertEquals(calls.length, 1)
      assertEquals(calls[0].url, 'https://hub.test/v1/feedback')
      assertEquals(calls[0].method, 'POST')
      assertEquals(calls[0].authorization, 'Bearer pat-123')
      assertEquals(JSON.parse(calls[0].body ?? ''), {
        kind: 'problem',
        summary: 'generate drops enum descriptions',
        details: 'Run generate on pets.yaml.',
        context: {
          operation: 'generate',
          resource: '@acme/pets',
          requestId: 'r1',
          clientName: 'skmtc-cli',
          clientVersion: '1.2.3'
        }
      })
    }
  )
})

Deno.test('feedbackHeadless - a 401 gives the skmtc login recipe for the token source', async () => {
  const cases = [
    {
      tokenSource: 'stored' as const,
      message:
        'A token is stored in ~/.skmtc/auth.json but the hub rejected it. ' +
        'Run `skmtc logout`, then `skmtc login --env staging` again.'
    },
    {
      tokenSource: 'flag' as const,
      message:
        'The hub rejected the token from --token. Pass a valid token ' +
        '(mint a PAT at https://skmtc.net/settings/tokens), or drop --token and run `skmtc login --env staging`.'
    },
    {
      tokenSource: 'env' as const,
      message:
        'The hub rejected the token from $SKMTC_HUB_TOKEN. Set a valid token ' +
        '(mint a PAT at https://skmtc.net/settings/tokens), or unset it and run `skmtc login --env staging`.'
    }
  ]
  for (const { tokenSource, message } of cases) {
    await withFetch(
      () => json({ message: 'Unauthorized', requestId: 'req-1' }, 401),
      async () => {
        const result = await feedbackHeadless({ ...BASE, tokenSource })

        assertEquals(result, {
          type: 'failed',
          code: 'unauthorized',
          status: 401,
          message,
          requestId: 'req-1',
          details: undefined
        })
      }
    )
  }
})

Deno.test('feedbackHeadless - a 429 with Retry-After says when to try again', async () => {
  await withFetch(
    () => json({ message: 'Feedback limit reached' }, 429, { 'retry-after': '5400' }),
    async () => {
      const result = await feedbackHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'rate-limited')
      assertEquals(result.retryAfterSeconds, 5400)
      assertEquals(result.message, 'Feedback limit reached. Try again in 90 minutes.')
    }
  )
})

Deno.test('feedbackHeadless - a 429 without Retry-After keeps the hub message and says later', async () => {
  const cases = [
    { body: { message: 'Too many requests' }, message: 'Too many requests. Try again later.' },
    { body: {}, message: 'Too many feedback requests. Try again later.' }
  ]
  for (const { body, message } of cases) {
    await withFetch(
      () => json(body, 429),
      async () => {
        const result = await feedbackHeadless(BASE)

        if (result.type !== 'failed') throw new Error('expected a failed result')
        assertEquals(result.code, 'rate-limited')
        assertEquals('retryAfterSeconds' in result, false)
        assertEquals(result.message, message)
      }
    )
  }
})

Deno.test('feedbackHeadless - 400, 502 and 503 each have their own code and message', async () => {
  const cases = [
    {
      status: 400,
      body: { message: 'Invalid body', details: [{ field: 'summary', message: 'too long' }] },
      code: 'bad-request',
      message: 'Invalid body'
    },
    {
      status: 502,
      body: { message: 'GitHub did not confirm the feedback issue. Nothing was stored.' },
      code: 'bad-gateway',
      message:
        'GitHub did not confirm the feedback issue, and the hub stored nothing. Try again later.'
    },
    {
      status: 503,
      body: { message: 'Feedback is not available in this environment yet.' },
      code: 'unavailable',
      message: 'The hub at https://hub.test cannot take feedback yet.'
    },
    { status: 500, body: {}, code: 'hub-error', message: 'the hub answered 500' }
  ]
  for (const { status, body, code, message } of cases) {
    await withFetch(
      () => json(body, status, { 'retry-after': '3600' }),
      async () => {
        const result = await feedbackHeadless(BASE)

        if (result.type !== 'failed') throw new Error('expected a failed result')
        assertEquals(
          { code: result.code, status: result.status, message: result.message },
          {
            code,
            status,
            message
          }
        )
        assertEquals('retryAfterSeconds' in result, false)
      }
    )
  }
})

Deno.test('feedbackHeadless - a 201 without id or issueUrl is a hub-error', async () => {
  await withFetch(
    () => json({ id: 'fb_1' }, 201),
    async () => {
      const result = await feedbackHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'hub-error')
      assertEquals(result.status, 201)
    }
  )
})

Deno.test('feedbackHeadless - no answer in time is network, and says it may be filed', async () => {
  await withNeverAnsweringFetch(async () => {
    const result = await feedbackHeadless({ ...BASE, timeoutMs: 10 })

    assertEquals(result, {
      type: 'failed',
      code: 'network',
      message:
        'cannot reach the hub at https://hub.test: The operation was aborted due to timeout. ' +
        'The feedback may still have been filed.'
    })
  })
  await withStallingBodyFetch(201, async () => {
    const result = await feedbackHeadless({ ...BASE, timeoutMs: 10 })

    if (result.type !== 'failed') throw new Error('expected a failed result')
    assertEquals(result.code, 'network')
  })
})

Deno.test('toFeedbackInputProblem - refuses what the hub would refuse', () => {
  const ok = { summary: 's', details: 'd' }
  assertEquals(toFeedbackInputProblem(ok), undefined)
  assertEquals(
    toFeedbackInputProblem({ ...ok, summary: 'x'.repeat(200), details: 'y'.repeat(8000) }),
    undefined
  )
  assertEquals(
    [
      toFeedbackInputProblem({ ...ok, summary: '' }),
      toFeedbackInputProblem({ ...ok, summary: 'one\ntwo' }),
      toFeedbackInputProblem({ ...ok, summary: 'one\rtwo' }),
      toFeedbackInputProblem({ ...ok, summary: 'x'.repeat(201) }),
      toFeedbackInputProblem({ ...ok, details: '' }),
      toFeedbackInputProblem({ ...ok, details: 'y'.repeat(8001) }),
      toFeedbackInputProblem({ ...ok, operation: 'o'.repeat(201) }),
      toFeedbackInputProblem({ ...ok, resource: 'r'.repeat(201) }),
      toFeedbackInputProblem({ ...ok, requestId: 'i'.repeat(201) })
    ],
    [
      '--summary is empty',
      '--summary must be one line',
      '--summary must be one line',
      '--summary has 201 characters; the most is 200',
      '--details is empty',
      '--details has 8001 characters; the most is 8000',
      '--operation has 201 characters; the most is 200',
      '--resource has 201 characters; the most is 200',
      '--request-id has 201 characters; the most is 200'
    ]
  )
})

Deno.test('toWaitText - rounds up to seconds, minutes or hours', () => {
  assertEquals(
    [
      toWaitText(1),
      toWaitText(30),
      toWaitText(119),
      toWaitText(121),
      toWaitText(3600),
      toWaitText(7201)
    ],
    ['1 second', '30 seconds', '119 seconds', '3 minutes', '60 minutes', '3 hours']
  )
})
