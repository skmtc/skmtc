import { assertEquals, assertRejects } from '@std/assert'
import { EnvVariableError } from '@/lib/env.ts'
import { dirname } from '@std/path/dirname'
import { stub } from '@std/testing/mock'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import {
  deleteStoredAuth,
  readStoredAuth,
  resolveHubAuth,
  toAuthFilePath,
  toFreshStoredAuth,
  validateHubToken,
  writeStoredAuth
} from '@/lib/hub-token.ts'

/**
 * Run `fn` with HOME pointed at a fresh temp dir and SKMTC_HUB_TOKEN
 * cleared, restoring both afterwards — tests must never read or write
 * the real ~/.skmtc or be affected by an ambient token.
 */
const withIsolatedEnv = async (fn: () => void | Promise<void>): Promise<void> => {
  const tempHome = Deno.makeTempDirSync({ prefix: 'skmtc-hub-token-test-' })

  try {
    await withEnv(
      {
        HOME: tempHome,
        SKMTC_HUB_TOKEN: undefined,
        SKMTC_ENV: undefined
      },
      fn
    )
  } finally {
    Deno.removeSync(tempHome, { recursive: true })
  }
}

Deno.test('resolveHubAuth - flag beats env beats stored file', async () => {
  await withIsolatedEnv(async () => {
    writeStoredAuth({ env: 'production', token: 'file-token' })
    Deno.env.set('SKMTC_HUB_TOKEN', 'env-token')

    assertEquals((await resolveHubAuth({ tokenFlag: 'flag-token' })).token, 'flag-token')
    assertEquals((await resolveHubAuth()).token, 'env-token')

    Deno.env.delete('SKMTC_HUB_TOKEN')
    assertEquals((await resolveHubAuth()).token, 'file-token')
  })
})

Deno.test('resolveHubAuth - undefined when no source has a token', async () => {
  await withIsolatedEnv(async () => {
    assertEquals((await resolveHubAuth()).token, undefined)
    assertEquals((await resolveHubAuth({ tokenFlag: '   ' })).token, undefined)
  })
})

Deno.test('writeStoredAuth - writes auth.json with mode 0600', async () => {
  await withIsolatedEnv(() => {
    const filePath = writeStoredAuth({
      env: 'local',
      token: 'abcd1234'
    })

    assertEquals(filePath, toAuthFilePath())

    // POSIX file modes only: Windows has no 0600 to assert.
    if (Deno.build.os !== 'windows') {
      const mode = Deno.statSync(filePath).mode
      if (mode === null) {
        throw new Error('expected stat to return a mode')
      }
      assertEquals(mode & 0o777, 0o600)
    }

    assertEquals(readStoredAuth(), {
      env: 'local',
      token: 'abcd1234'
    })
  })
})

Deno.test('readStoredAuth - null for missing or malformed file', async () => {
  await withIsolatedEnv(() => {
    assertEquals(readStoredAuth(), null)

    Deno.mkdirSync(dirname(toAuthFilePath()), { recursive: true })
    Deno.writeTextFileSync(toAuthFilePath(), 'not json')
    assertEquals(readStoredAuth(), null)

    Deno.writeTextFileSync(toAuthFilePath(), JSON.stringify({ token: '' }))
    assertEquals(readStoredAuth(), null)
  })
})

Deno.test('deleteStoredAuth - removes the file and is idempotent', async () => {
  await withIsolatedEnv(() => {
    writeStoredAuth({ env: 'local', token: 'abcd1234' })

    assertEquals(deleteStoredAuth(), true)
    assertEquals(readStoredAuth(), null)

    // Second delete is a no-op, not an error.
    assertEquals(deleteStoredAuth(), false)
  })
})

Deno.test('validateHubToken - returns the handle on 200', async () => {
  const fetchStub = stub(globalThis, 'fetch', () =>
    Promise.resolve(new Response(JSON.stringify({ handle: 'ada' }), { status: 200 }))
  )

  try {
    const handle = await validateHubToken({
      origin: 'https://api.example.test',
      token: 'abcd1234'
    })
    assertEquals(handle, 'ada')
  } finally {
    fetchStub.restore()
  }
})

Deno.test('validateHubToken - throws on a rejected token', async () => {
  const fetchStub = stub(globalThis, 'fetch', () =>
    Promise.resolve(new Response('unauthorized', { status: 401 }))
  )

  try {
    await assertRejects(
      () => validateHubToken({ origin: 'https://api.example.test', token: 'bad' }),
      Error,
      'token validation failed (401)'
    )
  } finally {
    fetchStub.restore()
  }
})

Deno.test('login flow - failed validation never writes auth.json', async () => {
  await withIsolatedEnv(async () => {
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(new Response('unauthorized', { status: 401 }))
    )

    try {
      // Mirrors the command's ordering: validate FIRST, store only on
      // success. A rejected token must leave no credential behind.
      await assertRejects(async () => {
        const handle = await validateHubToken({
          origin: 'https://api.example.test',
          token: 'bad'
        })
        writeStoredAuth({ env: 'local', token: 'bad' })
        return handle
      })

      assertEquals(readStoredAuth(), null)
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('readStoredAuth - reads a file written before --env by its API host', async () => {
  await withIsolatedEnv(() => {
    Deno.mkdirSync(dirname(toAuthFilePath()), { recursive: true })

    Deno.writeTextFileSync(
      toAuthFilePath(),
      JSON.stringify({ host: 'https://api.skmtc.co.uk/', token: 'old-pat' })
    )
    assertEquals(readStoredAuth(), { env: 'local', token: 'old-pat' })

    // A host that is no environment's API (an old `--origin`) is not logged in.
    Deno.writeTextFileSync(
      toAuthFilePath(),
      JSON.stringify({ host: 'http://localhost:4812', token: 'old-pat' })
    )
    assertEquals(readStoredAuth(), null)
  })
})

Deno.test('resolveHubAuth - the stored env applies only with the stored token', async () => {
  await withIsolatedEnv(async () => {
    writeStoredAuth({ env: 'local', token: 'file-token' })

    // Token from the file → the environment defaults to the file's.
    assertEquals(await resolveHubAuth(), {
      token: 'file-token',
      env: 'local',
      origin: 'https://api.skmtc.co.uk'
    })

    // Token from env → the stored env does NOT apply (the token and the
    // environment must come from the same place).
    Deno.env.set('SKMTC_HUB_TOKEN', 'env-token')
    assertEquals(await resolveHubAuth(), {
      token: 'env-token',
      env: 'production',
      origin: 'https://api.skmtc.dev'
    })
    Deno.env.delete('SKMTC_HUB_TOKEN')

    // Token from the flag → same.
    assertEquals(await resolveHubAuth({ tokenFlag: 'flag-token' }), {
      token: 'flag-token',
      env: 'production',
      origin: 'https://api.skmtc.dev'
    })
  })
})

Deno.test('resolveHubAuth - a stored token is never sent to another environment', async () => {
  await withIsolatedEnv(async () => {
    writeStoredAuth({ env: 'local', token: 'local-token' })

    assertEquals(await resolveHubAuth({ envFlag: 'production' }), {
      token: undefined,
      env: 'production',
      origin: 'https://api.skmtc.dev'
    })

    Deno.env.set('SKMTC_ENV', 'staging')
    assertEquals((await resolveHubAuth()).token, undefined)
  })
})

Deno.test('resolveHubAuth - production default when nothing is stored', async () => {
  await withIsolatedEnv(async () => {
    assertEquals(await resolveHubAuth(), {
      token: undefined,
      env: 'production',
      origin: 'https://api.skmtc.dev'
    })
  })
})

Deno.test('toFreshStoredAuth - keeps a token that has not expired, without a request', async () => {
  await withIsolatedEnv(async () => {
    const fetchStub = stub(globalThis, 'fetch', () => Promise.reject(new Error('no request')))
    const stored = {
      env: 'local' as const,
      token: 'access',
      refreshToken: 'r1',
      expiresAt: 10 * 60_000
    }

    try {
      assertEquals(await toFreshStoredAuth(stored, () => 0), stored)
      assertEquals(fetchStub.calls.length, 0)
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('toFreshStoredAuth - refreshes an expired token and stores the new one', async () => {
  await withIsolatedEnv(async () => {
    const requests: { url: string; body: string }[] = []
    const fetchStub = stub(globalThis, 'fetch', async (input, init) => {
      requests.push({ url: String(input), body: String(init?.body) })
      return new Response(
        JSON.stringify({
          access_token: 'access-2',
          refresh_token: 'r2',
          expires_in: 3600
        }),
        { status: 200 }
      )
    })

    const stored = {
      env: 'local' as const,
      token: 'access-1',
      refreshToken: 'r1',
      expiresAt: 30_000
    }
    writeStoredAuth(stored)

    try {
      const fresh = await toFreshStoredAuth(stored, () => 0)

      const expected = {
        env: 'local' as const,
        token: 'access-2',
        refreshToken: 'r2',
        expiresAt: 3_600_000
      }
      assertEquals(fresh, expected)
      assertEquals(readStoredAuth(), expected)
      assertEquals(requests[0].url, 'https://skmtc.co.uk/api/auth/oauth2/token')
      assertEquals(Object.fromEntries(new URLSearchParams(requests[0].body)), {
        grant_type: 'refresh_token',
        refresh_token: 'r1',
        client_id: 'skmtc-cli'
      })
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('toFreshStoredAuth - a revoked refresh token says to run skmtc login and keeps the file', async () => {
  await withIsolatedEnv(async () => {
    const stored = {
      env: 'local' as const,
      token: 'access-1',
      refreshToken: 'r1',
      expiresAt: 0
    }
    writeStoredAuth(stored)
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400
        })
      )
    )

    try {
      await assertRejects(() => toFreshStoredAuth(stored, () => 0), Error, 'skmtc login')
      assertEquals(readStoredAuth(), stored)
    } finally {
      fetchStub.restore()
    }
  })
})

const refreshedTokens = (access: string, refresh: string): Response =>
  new Response(JSON.stringify({ access_token: access, refresh_token: refresh, expires_in: 3600 }), {
    status: 200
  })

// Identity revokes the whole sign-in when a used refresh token comes back.
// Two commands that find the same expired token must send it once.
Deno.test('toFreshStoredAuth - two commands at once refresh the token once', async () => {
  await withIsolatedEnv(async () => {
    const stored = { env: 'local' as const, token: 'access-1', refreshToken: 'r1', expiresAt: 0 }
    writeStoredAuth(stored)
    const sent: string[] = []
    const fetchStub = stub(globalThis, 'fetch', async (_input, init) => {
      sent.push(new URLSearchParams(String(init?.body)).get('refresh_token') ?? '')
      await new Promise(resolve => setTimeout(resolve, 20))
      return refreshedTokens('access-2', 'r2')
    })

    try {
      const [first, second] = await Promise.all([
        toFreshStoredAuth(stored, () => 0),
        toFreshStoredAuth(stored, () => 0)
      ])
      assertEquals(sent, ['r1'])
      assertEquals([first.refreshToken, second.refreshToken], ['r2', 'r2'])
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('toFreshStoredAuth - uses a token another command has already refreshed', async () => {
  await withIsolatedEnv(async () => {
    const newer = {
      env: 'local' as const,
      token: 'access-2',
      refreshToken: 'r2',
      expiresAt: 10 * 60_000
    }
    writeStoredAuth(newer)
    const fetchStub = stub(globalThis, 'fetch', () => Promise.reject(new Error('no request')))

    try {
      const fresh = await toFreshStoredAuth(
        { env: 'local', token: 'access-1', refreshToken: 'r1', expiresAt: 0 },
        () => 0
      )
      assertEquals(fresh, newer)
      assertEquals(fetchStub.calls.length, 0)
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('toFreshStoredAuth - releases the lock after a failed refresh', async () => {
  await withIsolatedEnv(async () => {
    const stored = { env: 'local' as const, token: 'access-1', refreshToken: 'r1', expiresAt: 0 }
    writeStoredAuth(stored)
    const fetchStub = stub(globalThis, 'fetch', () => Promise.reject(new TypeError('offline')))

    try {
      await assertRejects(() => toFreshStoredAuth(stored, () => 0), Error, 'offline')
      assertEquals(
        [...Deno.readDirSync(dirname(toAuthFilePath()))].map(entry => entry.name),
        ['auth.json']
      )
    } finally {
      fetchStub.restore()
    }
  })
})

// The old variable must not be ignored: CI that still sets it would send a
// staging or local token to production.
Deno.test('resolveHubAuth - fails when the retired SKMTC_API_ORIGIN is set', async () => {
  await withIsolatedEnv(async () => {
    await withEnv({ SKMTC_API_ORIGIN: 'https://api.skmtc.co.uk' }, async () => {
      await assertRejects(() => resolveHubAuth(), EnvVariableError, 'SKMTC_ENV')
    })
  })
})
