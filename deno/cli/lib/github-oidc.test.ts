import { assertEquals, assertStringIncludes } from '@std/assert'
import {
  exchangeLinkedRepositoryToken,
  readGithubOidcEnv,
  requestGithubOidcToken
} from '@/lib/github-oidc.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'

const originalFetch = globalThis.fetch

type Call = {
  url: string
  method?: string
  authorization?: string
  accept?: string
  contentType?: string
  body?: string
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const withFetch = async (
  stub: (call: Call) => Response | Promise<Response>,
  run: (calls: Call[]) => Promise<void>
): Promise<void> => {
  const calls: Call[] = []
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const call: Call = {
      url: input.toString(),
      method: init?.method,
      authorization: headers.get('authorization') ?? undefined,
      accept: headers.get('accept') ?? undefined,
      contentType: headers.get('content-type') ?? undefined,
      body: typeof init?.body === 'string' ? init.body : undefined
    }
    calls.push(call)
    return Promise.resolve(stub(call))
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

const REQUEST = {
  requestUrl: 'https://pipelines.actions.githubusercontent.com/token?api-version=2.0',
  requestToken: 'gh-request-token',
  audience: 'https://api.skmtc.dev'
}

const API = { account: 'acme', slug: 'pets' }
const ORIGIN = 'https://api.skmtc.dev'

// --- readGithubOidcEnv ----------------------------------------------------------

const OIDC_URL = 'https://pipelines.actions.githubusercontent.com/token?x=1'

Deno.test('readGithubOidcEnv - outside GitHub Actions is undefined, even with the variables set', async () => {
  await withEnv(
    {
      GITHUB_ACTIONS: undefined,
      ACTIONS_ID_TOKEN_REQUEST_URL: OIDC_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
    },
    () => assertEquals(readGithubOidcEnv(), undefined)
  )
  await withEnv(
    {
      GITHUB_ACTIONS: 'false',
      ACTIONS_ID_TOKEN_REQUEST_URL: OIDC_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
    },
    () => assertEquals(readGithubOidcEnv(), undefined)
  )
})

Deno.test('readGithubOidcEnv - in GitHub Actions with both variables gives them', async () => {
  await withEnv(
    {
      GITHUB_ACTIONS: 'true',
      ACTIONS_ID_TOKEN_REQUEST_URL: OIDC_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
    },
    () =>
      assertEquals(readGithubOidcEnv(), {
        requestUrl: OIDC_URL,
        requestToken: 'request-token'
      })
  )
})

Deno.test('readGithubOidcEnv - in GitHub Actions with either variable missing is missing-permission', async () => {
  const cases: Array<[string | undefined, string | undefined]> = [
    [undefined, undefined],
    [OIDC_URL, undefined],
    [undefined, 'request-token']
  ]
  for (const [requestUrl, requestToken] of cases) {
    await withEnv(
      {
        GITHUB_ACTIONS: 'true',
        ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken
      },
      () => assertEquals(readGithubOidcEnv(), 'missing-permission')
    )
  }
})

Deno.test('readGithubOidcEnv - a variable the process may not read counts as unset', async () => {
  const originalGet = Deno.env.get
  const denyRequestVariables = (name: string): string | undefined => {
    if (name.startsWith('ACTIONS_ID_TOKEN_')) {
      throw new Deno.errors.NotCapable(`Requires env access to "${name}"`)
    }
    return originalGet.call(Deno.env, name)
  }

  await withEnv(
    {
      GITHUB_ACTIONS: 'true',
      ACTIONS_ID_TOKEN_REQUEST_URL: OIDC_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
    },
    () => {
      Object.defineProperty(Deno.env, 'get', {
        value: denyRequestVariables,
        configurable: true,
        writable: true
      })
      try {
        assertEquals(readGithubOidcEnv(), 'missing-permission')
      } finally {
        Object.defineProperty(Deno.env, 'get', {
          value: originalGet,
          configurable: true,
          writable: true
        })
      }
    }
  )
})

// --- requestGithubOidcToken -----------------------------------------------------

Deno.test('requestGithubOidcToken - GETs the request URL with the audience, the bearer and accept', async () => {
  await withFetch(
    () => json({ value: 'gh-jwt' }),
    async calls => {
      const result = await requestGithubOidcToken(REQUEST)

      assertEquals(result, { type: 'token', token: 'gh-jwt' })
      assertEquals(calls.length, 1)
      assertEquals(calls[0].method, 'GET')
      assertEquals(calls[0].authorization, 'bearer gh-request-token')
      assertEquals(calls[0].accept, 'application/json')
      const url = new URL(calls[0].url)
      assertEquals(
        `${url.origin}${url.pathname}`,
        'https://pipelines.actions.githubusercontent.com/token'
      )
      assertEquals(url.searchParams.get('api-version'), '2.0')
      assertEquals(url.searchParams.get('audience'), 'https://api.skmtc.dev')
    }
  )
})

Deno.test('requestGithubOidcToken - a request URL with no query still gets ?audience=', async () => {
  await withFetch(
    () => json({ value: 'gh-jwt' }),
    async calls => {
      await requestGithubOidcToken({ ...REQUEST, requestUrl: 'https://oidc.test/token' })

      assertEquals(calls[0].url, 'https://oidc.test/token?audience=https%3A%2F%2Fapi.skmtc.dev')
    }
  )
})

Deno.test('requestGithubOidcToken - a non-2xx answer is oidc-token with the status and the body', async () => {
  await withFetch(
    () => new Response(`internal error ${'x'.repeat(300)}`, { status: 500 }),
    async () => {
      const result = await requestGithubOidcToken(REQUEST)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'oidc-token')
      assertEquals(
        result.message,
        `GitHub's OIDC provider answered 500: internal error ${'x'.repeat(185)}`
      )
    }
  )
})

Deno.test('requestGithubOidcToken - an answer with no value is oidc-token', async () => {
  for (const response of [json({}), json({ value: '' }), new Response('not json')]) {
    await withFetch(
      () => response,
      async () => {
        const result = await requestGithubOidcToken(REQUEST)

        assertEquals(result, {
          type: 'failed',
          code: 'oidc-token',
          message: "GitHub's OIDC provider returned no token"
        })
      }
    )
  }
})

Deno.test('requestGithubOidcToken - a network failure or a narrow --allow-net is oidc-token', async () => {
  const errors = [
    new TypeError('error sending request: dns error'),
    new Deno.errors.NotCapable(
      'Requires net access to "pipelines.actions.githubusercontent.com:443"'
    )
  ]
  for (const error of errors) {
    await withFetch(
      () => {
        throw error
      },
      async () => {
        const result = await requestGithubOidcToken(REQUEST)

        assertEquals(result, {
          type: 'failed',
          code: 'oidc-token',
          message: `cannot reach GitHub's OIDC provider: ${error.message}`
        })
      }
    )
  }
})

// --- exchangeLinkedRepositoryToken ----------------------------------------------

Deno.test('exchangeLinkedRepositoryToken - POSTs the GitHub token to the API exchange route, unauthenticated', async () => {
  await withFetch(
    () => json({ accessToken: 'skmtc_lr_abc', expiresAt: '2026-10-29T12:15:00Z' }, 201),
    async calls => {
      const result = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })

      assertEquals(result, { type: 'token', token: 'skmtc_lr_abc' })
      assertEquals(calls, [
        {
          url: 'https://api.skmtc.dev/v1/apis/acme/pets/linked-repositories/exchange',
          method: 'POST',
          authorization: undefined,
          accept: undefined,
          contentType: 'application/json',
          body: '{"token":"gh-jwt"}'
        }
      ])
    }
  )
})

Deno.test('exchangeLinkedRepositoryToken - a 2xx other than 201 is oidc-exchange', async () => {
  await withFetch(
    () => json({ accessToken: 'skmtc_lr_abc' }, 200),
    async () => {
      const result = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'oidc-exchange')
      assertEquals(result.status, 200)
    }
  )
})

Deno.test('exchangeLinkedRepositoryToken - each refusal has its text, status and request id', async () => {
  const cases: Array<{ status: number; body: unknown; message: string }> = [
    {
      status: 401,
      body: { code: 'unauthorized', message: 'The token has expired', requestId: 'req-401' },
      message: 'The hub refused the GitHub OIDC token (401): The token has expired.'
    },
    {
      status: 403,
      body: {
        code: 'forbidden',
        message: 'No linked repository of this API matches this workflow run.',
        requestId: 'req-403'
      },
      message:
        'No linked repository of @acme/pets matches this workflow run, or the API does not ' +
        'exist yet. A linked repository must be public and name this workflow file (and ' +
        'environment, if set). The first publish needs `skmtc login` or a PAT.'
    },
    {
      status: 503,
      body: { code: 'unavailable', message: 'JWKS fetch failed', requestId: 'req-503' },
      message:
        "The hub cannot check GitHub's signing keys right now (503). Run the job again in a few minutes."
    },
    {
      status: 400,
      body: { code: 'bad_request', message: 'token: too long', requestId: 'req-400' },
      message: 'token: too long'
    }
  ]
  for (const { status, body, message } of cases) {
    await withFetch(
      () => json(body, status),
      async () => {
        const result = await exchangeLinkedRepositoryToken({
          origin: ORIGIN,
          api: API,
          githubToken: 'gh-jwt'
        })

        assertEquals(result, {
          type: 'failed',
          code: 'oidc-exchange',
          status,
          message,
          requestId: `req-${status}`,
          details: undefined
        })
      }
    )
  }
})

Deno.test('exchangeLinkedRepositoryToken - an answer with no hub message names the status', async () => {
  const responses = [new Response('', { status: 401 }), new Response('<html>', { status: 502 })]
  await withFetch(
    () => responses.shift() ?? new Response('', { status: 500 }),
    async () => {
      const unauthorized = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })
      const gateway = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })

      if (unauthorized.type !== 'failed' || gateway.type !== 'failed') {
        throw new Error('expected failed results')
      }
      assertEquals(unauthorized.message, 'The hub refused the GitHub OIDC token (401).')
      assertEquals(gateway.message, 'the hub answered 502')
      assertEquals(gateway.code, 'oidc-exchange')
    }
  )
})

Deno.test('exchangeLinkedRepositoryToken - a 201 with no accessToken is oidc-exchange and echoes nothing', async () => {
  await withFetch(
    () => json({ token: 'skmtc_lr_wrong_field' }, 201),
    async () => {
      const result = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'oidc-exchange')
      assertEquals(result.status, 201)
      assertEquals(result.message.includes('skmtc_lr_'), false)
    }
  )
})

Deno.test('exchangeLinkedRepositoryToken - a network failure stays network', async () => {
  await withFetch(
    () => {
      throw new TypeError('error sending request: dns error')
    },
    async () => {
      const result = await exchangeLinkedRepositoryToken({
        origin: ORIGIN,
        api: API,
        githubToken: 'gh-jwt'
      })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'network')
      assertStringIncludes(result.message, 'cannot reach the hub at https://api.skmtc.dev')
    }
  )
})
