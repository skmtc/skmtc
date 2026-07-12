import { assertEquals, assertRejects } from '@std/assert'
import { stub } from '@std/testing/mock'
import {
  deleteStoredAuth,
  readStoredAuth,
  resolveHubAuth,
  resolveHubToken,
  toAuthFilePath,
  validateHubToken,
  writeStoredAuth
} from '@/lib/hub-token.ts'

/**
 * Run `fn` with HOME pointed at a fresh temp dir and SKMTC_HUB_TOKEN
 * cleared, restoring both afterwards — tests must never read or write
 * the real ~/.skmtc or be affected by an ambient token.
 */
const withIsolatedEnv = async (fn: () => void | Promise<void>): Promise<void> => {
  const originalHome = Deno.env.get('HOME')
  const originalToken = Deno.env.get('SKMTC_HUB_TOKEN')
  const tempHome = Deno.makeTempDirSync({ prefix: 'skmtc-hub-token-test-' })

  Deno.env.set('HOME', tempHome)
  Deno.env.delete('SKMTC_HUB_TOKEN')

  try {
    await fn()
  } finally {
    if (originalHome === undefined) {
      Deno.env.delete('HOME')
    } else {
      Deno.env.set('HOME', originalHome)
    }
    if (originalToken === undefined) {
      Deno.env.delete('SKMTC_HUB_TOKEN')
    } else {
      Deno.env.set('SKMTC_HUB_TOKEN', originalToken)
    }
    Deno.removeSync(tempHome, { recursive: true })
  }
}

Deno.test('resolveHubToken - flag beats env beats stored file', async () => {
  await withIsolatedEnv(() => {
    writeStoredAuth({ host: 'https://api.example.test', token: 'file-token' })
    Deno.env.set('SKMTC_HUB_TOKEN', 'env-token')

    assertEquals(resolveHubToken({ tokenFlag: 'flag-token' }), 'flag-token')
    assertEquals(resolveHubToken(), 'env-token')

    Deno.env.delete('SKMTC_HUB_TOKEN')
    assertEquals(resolveHubToken(), 'file-token')
  })
})

Deno.test('resolveHubToken - undefined when no source has a token', async () => {
  await withIsolatedEnv(() => {
    assertEquals(resolveHubToken(), undefined)
    assertEquals(resolveHubToken({ tokenFlag: '   ' }), undefined)
  })
})

Deno.test('writeStoredAuth - writes auth.json with mode 0600', async () => {
  await withIsolatedEnv(() => {
    const filePath = writeStoredAuth({
      host: 'https://api.example.test',
      token: 'abcd1234'
    })

    assertEquals(filePath, toAuthFilePath())

    const mode = Deno.statSync(filePath).mode
    if (mode === null) {
      throw new Error('expected stat to return a mode')
    }
    assertEquals(mode & 0o777, 0o600)

    assertEquals(readStoredAuth(), {
      host: 'https://api.example.test',
      token: 'abcd1234'
    })
  })
})

Deno.test('readStoredAuth - null for missing or malformed file', async () => {
  await withIsolatedEnv(() => {
    assertEquals(readStoredAuth(), null)

    Deno.mkdirSync(`${Deno.env.get('HOME')}/.skmtc`, { recursive: true })
    Deno.writeTextFileSync(toAuthFilePath(), 'not json')
    assertEquals(readStoredAuth(), null)

    Deno.writeTextFileSync(toAuthFilePath(), JSON.stringify({ token: '' }))
    assertEquals(readStoredAuth(), null)
  })
})

Deno.test('deleteStoredAuth - removes the file and is idempotent', async () => {
  await withIsolatedEnv(() => {
    writeStoredAuth({ host: 'https://api.example.test', token: 'abcd1234' })

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
        writeStoredAuth({ host: 'https://api.example.test', token: 'bad' })
        return handle
      })

      assertEquals(readStoredAuth(), null)
    } finally {
      fetchStub.restore()
    }
  })
})

Deno.test('resolveHubAuth - stored host rides along only with the stored token', async () => {
  await withIsolatedEnv(() => {
    writeStoredAuth({ host: 'http://localhost:4812', token: 'file-token' })

    // Token from the file → hub URL defaults to the file's host.
    assertEquals(resolveHubAuth(), {
      token: 'file-token',
      origin: 'http://localhost:4812'
    })

    // Explicit --origin flag still wins over the stored host.
    assertEquals(resolveHubAuth({ originFlag: 'http://other.test' }), {
      token: 'file-token',
      origin: 'http://other.test'
    })

    // Token from env → stored host does NOT apply (the token and the
    // host must come from the same place).
    Deno.env.set('SKMTC_HUB_TOKEN', 'env-token')
    assertEquals(resolveHubAuth(), {
      token: 'env-token',
      origin: 'https://api.skmtc.dev'
    })
    Deno.env.delete('SKMTC_HUB_TOKEN')

    // Token from the flag → same.
    assertEquals(resolveHubAuth({ tokenFlag: 'flag-token' }), {
      token: 'flag-token',
      origin: 'https://api.skmtc.dev'
    })
  })
})

Deno.test('resolveHubAuth - production default when nothing is stored', async () => {
  await withIsolatedEnv(() => {
    assertEquals(resolveHubAuth(), {
      token: undefined,
      origin: 'https://api.skmtc.dev'
    })
  })
})
