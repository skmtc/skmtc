import { assertEquals, assertStringIncludes } from '@std/assert'
import { stub } from '@std/testing/mock'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { withCapturedExit } from '@/tests/mocks/exit.mock.ts'
import { writeStoredAuth } from '@/lib/hub-token.ts'
import { renderWhoami } from '@/commands/whoami.ts'

type Env = Record<string, string | undefined>

/** Run `fn` with a home folder of its own and no token or hub variables. */
const withTempHome = async (env: Env, fn: () => Promise<void>): Promise<void> => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-whoami-test-' })
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

/** Answer `GET /v1/user` with `response`, and record each request. */
const withUserRoute = async (
  response: () => Response,
  fn: (requests: { url: string; authorization: string | null }[]) => Promise<void>
): Promise<void> => {
  const requests: { url: string; authorization: string | null }[] = []
  const fetchStub = stub(globalThis, 'fetch', (input, init) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get('authorization')
    })
    return Promise.resolve(response())
  })
  try {
    await fn(requests)
  } finally {
    fetchStub.restore()
  }
}

const user = (): Response =>
  new Response(JSON.stringify({ handle: 'acme' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

Deno.test('whoami --json - names the handle, env, origin and token source of each token', async () => {
  const cases: Array<{
    env: Env
    stored?: { env: 'staging' | 'production'; token: string }
    args: { token?: string; env?: 'staging' }
    expected: { env: string; origin: string; tokenSource: string; token: string }
  }> = [
    {
      env: {},
      args: { token: 'flag-token' },
      expected: {
        env: 'production',
        origin: 'https://api.skmtc.dev',
        tokenSource: 'flag',
        token: 'flag-token'
      }
    },
    {
      env: { SKMTC_HUB_TOKEN: 'env-token' },
      args: { env: 'staging' },
      expected: {
        env: 'staging',
        origin: 'https://api.skmtc.net',
        tokenSource: 'env',
        token: 'env-token'
      }
    },
    {
      env: {},
      stored: { env: 'staging', token: 'stored-token' },
      args: {},
      expected: {
        env: 'staging',
        origin: 'https://api.skmtc.net',
        tokenSource: 'stored',
        token: 'stored-token'
      }
    }
  ]
  for (const { env, stored, args, expected } of cases) {
    await withTempHome(env, async () => {
      if (stored) writeStoredAuth(stored)
      await withUserRoute(user, async requests => {
        const run = await withCapturedExit(() =>
          renderWhoami({ token: args.token, env: args.env, jsonFlag: true })
        )

        assertEquals(run.exitCode, 0)
        assertEquals(JSON.parse(run.stdout), {
          type: 'whoami',
          handle: 'acme',
          env: expected.env,
          origin: expected.origin,
          tokenSource: expected.tokenSource
        })
        assertEquals(requests, [
          { url: `${expected.origin}/v1/user`, authorization: `Bearer ${expected.token}` }
        ])
      })
    })
  }
})

Deno.test('whoami - text names the handle, env, origin and source, and masks the token', async () => {
  await withTempHome({}, async () => {
    writeStoredAuth({ env: 'staging', token: 'stored-secret-1234' })
    await withUserRoute(user, async () => {
      const run = await withCapturedExit(() => renderWhoami({ token: undefined, env: undefined }))

      assertEquals(run.exitCode, 0)
      assertEquals(run.stdout.split('\n'), [
        'Logged in as acme (token …1234)',
        '  environment: staging',
        '  origin:      https://api.skmtc.net',
        '  token from:  skmtc login (~/.skmtc/auth.json)'
      ])
      assertEquals(run.stdout.includes('stored-secret'), false)
    })
  })
})

Deno.test('whoami - a stored login for another env is not used: exit 2 with the login recipe', async () => {
  await withTempHome({}, async () => {
    writeStoredAuth({ env: 'staging', token: 'stored-token' })
    await withUserRoute(user, async requests => {
      const run = await withCapturedExit(() =>
        renderWhoami({ token: undefined, env: 'production', jsonFlag: true })
      )

      assertEquals(run.exitCode, 2)
      assertEquals(run.stdout, '')
      assertStringIncludes(
        run.stderr,
        'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. ' +
          'Mint a PAT at https://skmtc.dev/settings/tokens.'
      )
      assertEquals(requests, [])
    })
  })
})

Deno.test('whoami - no token at all exits 2 with the recipe for the env', async () => {
  await withTempHome({ SKMTC_ENV: 'local' }, async () => {
    await withUserRoute(user, async requests => {
      const run = await withCapturedExit(() => renderWhoami({ token: undefined, env: undefined }))

      assertEquals(run.exitCode, 2)
      assertStringIncludes(run.stderr, 'skmtc whoami')
      assertStringIncludes(run.stderr, 'Run `skmtc login --env local`')
      assertEquals(requests, [])
    })
  })
})

Deno.test('whoami - a stored token the hub rejects (401 or 403) exits 1 with the logout and login text', async () => {
  for (const status of [401, 403]) {
    await withTempHome({}, async () => {
      writeStoredAuth({ env: 'staging', token: 'stored-token' })
      await withUserRoute(
        () => new Response('nope', { status }),
        async () => {
          const run = await withCapturedExit(() =>
            renderWhoami({ token: undefined, env: undefined, jsonFlag: true })
          )

          assertEquals(run.exitCode, 1)
          assertEquals(run.stdout, '')
          assertEquals(
            run.stderr,
            'A token is stored in ~/.skmtc/auth.json but the hub rejected it. ' +
              'Run `skmtc logout`, then `skmtc login --env staging` again.'
          )
        }
      )
    })
  }
})

Deno.test('whoami - a --token the hub rejects exits 1 naming --token, not logout', async () => {
  await withTempHome({}, async () => {
    await withUserRoute(
      () => new Response('nope', { status: 401 }),
      async () => {
        const run = await withCapturedExit(() =>
          renderWhoami({ token: 'bad-token', env: undefined })
        )

        assertEquals(run.exitCode, 1)
        assertStringIncludes(run.stderr, 'The hub rejected the token from --token.')
        assertEquals(run.stderr.includes('logout'), false)
      }
    )
  })
})

Deno.test('whoami - a hub that fails to answer exits 1 without a logout', async () => {
  await withTempHome({}, async () => {
    writeStoredAuth({ env: 'production', token: 'stored-token' })
    await withUserRoute(
      () => new Response('down', { status: 503 }),
      async () => {
        const run = await withCapturedExit(() => renderWhoami({ token: undefined, env: undefined }))

        assertEquals(run.exitCode, 1)
        assertStringIncludes(run.stderr, 'Could not check the token at https://api.skmtc.dev')
        assertEquals(run.stderr.includes('logout'), false)
      }
    )
  })
})
