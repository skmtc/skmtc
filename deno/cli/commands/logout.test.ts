import { assertEquals } from '@std/assert'
import { stub } from '@std/testing/mock'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { readStoredAuth, writeStoredAuth } from '@/lib/hub-token.ts'
import { logout } from '@/commands/logout.ts'

const withTempHome = async (fn: () => Promise<void>): Promise<void> => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-logout-test-' })
  try {
    await withEnv({ HOME: home, SKMTC_HUB_TOKEN: undefined, SKMTC_ENV: undefined }, fn)
  } finally {
    Deno.removeSync(home, { recursive: true })
  }
}

const oauthLogin = {
  env: 'local' as const,
  token: 'access',
  refreshToken: 'refresh-1',
  expiresAt: 1
}

Deno.test('logout - revokes the refresh token at identity, then deletes the file', async () => {
  await withTempHome(async () => {
    writeStoredAuth(oauthLogin)
    const requests: { url: string; fields: Record<string, string> }[] = []
    const fetchStub = stub(globalThis, 'fetch', (input, init) => {
      const body = init?.body
      requests.push({
        url: String(input),
        fields: body instanceof URLSearchParams ? Object.fromEntries(body) : {}
      })
      return Promise.resolve(new Response(null, { status: 200 }))
    })

    try {
      assertEquals(await logout(), { removed: true, revoked: 'revoked' })
      assertEquals(requests, [
        {
          url: 'https://skmtc.co.uk/api/auth/oauth2/revoke',
          fields: { token: 'refresh-1', token_type_hint: 'refresh_token', client_id: 'skmtc-cli' }
        }
      ])
      assertEquals(readStoredAuth(), null)
    } finally {
      fetchStub.restore()
    }
  })
})

// A logout must always end the local login, even when identity cannot be
// reached; the command then tells the user to revoke in the hub.
Deno.test('logout - deletes the file when the revoke fails', async () => {
  await withTempHome(async () => {
    writeStoredAuth(oauthLogin)
    const fetchStub = stub(globalThis, 'fetch', () => Promise.reject(new Error('offline')))

    try {
      assertEquals(await logout(), { removed: true, revoked: 'failed' })
      assertEquals(readStoredAuth(), null)
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('logout - a stored PAT is deleted without a request', async () => {
  await withTempHome(async () => {
    writeStoredAuth({ env: 'production', token: 'skmtc_pat' })
    const fetchStub = stub(globalThis, 'fetch', () => Promise.reject(new Error('no request')))

    try {
      assertEquals(await logout(), { removed: true, revoked: 'not-applicable' })
      assertEquals(fetchStub.calls.length, 0)
    } finally {
      fetchStub.restore()
    }
  })
})
