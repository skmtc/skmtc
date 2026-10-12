import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from '@std/assert'
import { EnvVariableError, readEnv, readHomeDirectory } from '@/lib/env.ts'
import { assertJsrReachable, getJsrBaseUrl, toJsrUrl } from '@/lib/jsr-registry.ts'
import { resolveHubAuth, resolveHubToken, resolveOrigin } from '@/lib/hub-token.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'

const originalFetch = globalThis.fetch

Deno.test('readEnv - an empty or whitespace-only value is unset', async () => {
  await withEnv({ SKMTC_HUB_TOKEN: '', HOME: '   ', DENO_DIR: '\t' }, () => {
    assertEquals(readEnv('SKMTC_HUB_TOKEN'), undefined)
    assertEquals(readEnv('HOME'), undefined)
    assertEquals(readEnv('DENO_DIR'), undefined)
  })
})

Deno.test('readEnv - values are trimmed', async () => {
  await withEnv({ SKMTC_HUB_TOKEN: '  pat-123\n' }, () => {
    assertEquals(readEnv('SKMTC_HUB_TOKEN'), 'pat-123')
  })
})

Deno.test('readEnv - JSR_URL defaults to jsr.io when unset or empty', async () => {
  await withEnv({ JSR_URL: undefined }, () => assertEquals(readEnv('JSR_URL'), 'https://jsr.io/'))
  await withEnv({ JSR_URL: '' }, () => assertEquals(readEnv('JSR_URL'), 'https://jsr.io/'))
})

Deno.test('readEnv - SKMTC_API_ORIGIN has no default of its own', async () => {
  await withEnv({ SKMTC_API_ORIGIN: undefined }, () =>
    assertEquals(readEnv('SKMTC_API_ORIGIN'), undefined)
  )
})

Deno.test('readEnv - a malformed URL fails with an error naming the variable', async () => {
  for (const name of ['JSR_URL', 'SKMTC_API_ORIGIN'] as const) {
    await withEnv({ [name]: 'not-a-url' }, () => {
      const error = assertThrows(() => readEnv(name), EnvVariableError)

      assertEquals(error.variable, name)
      assertStringIncludes(error.message, name)
    })
  }
})

Deno.test('readEnv - reads one variable, so a malformed JSR_URL does not break the others', async () => {
  await withEnv({ JSR_URL: 'not-a-url', SKMTC_HUB_TOKEN: 'pat-123' }, () => {
    assertEquals(readEnv('SKMTC_HUB_TOKEN'), 'pat-123')
  })
})

Deno.test('readHomeDirectory - falls back to USERPROFILE when HOME is unset or empty', async () => {
  await withEnv({ HOME: '/home/ada', USERPROFILE: 'C:\\Users\\ada' }, () =>
    assertEquals(readHomeDirectory(), '/home/ada')
  )
  await withEnv({ HOME: '', USERPROFILE: 'C:\\Users\\ada' }, () =>
    assertEquals(readHomeDirectory(), 'C:\\Users\\ada')
  )
  await withEnv({ HOME: undefined, USERPROFILE: undefined }, () =>
    assertEquals(readHomeDirectory(), undefined)
  )
})

Deno.test('JSR_URL="" gives https://jsr.io from every caller', async () => {
  const fetchedUrls: string[] = []
  globalThis.fetch = (input: RequestInfo | URL) => {
    fetchedUrls.push(String(input))
    return Promise.resolve(new Response(null, { status: 200 }))
  }

  try {
    await withEnv({ JSR_URL: '' }, async () => {
      assertEquals(getJsrBaseUrl(), 'https://jsr.io')
      assertEquals(toJsrUrl('@skmtc/core/meta.json'), 'https://jsr.io/@skmtc/core/meta.json')

      await assertJsrReachable()
      assertEquals(fetchedUrls.length, 1)
      assertStringIncludes(fetchedUrls[0], 'https://jsr.io')
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('JSR_URL=not-a-url fails with an error naming JSR_URL from every caller', async () => {
  await withEnv({ JSR_URL: 'not-a-url' }, async () => {
    assertEquals(assertThrows(() => getJsrBaseUrl(), EnvVariableError).variable, 'JSR_URL')
    assertEquals(assertThrows(() => toJsrUrl('@skmtc/core'), EnvVariableError).variable, 'JSR_URL')

    const error = await assertRejects(() => assertJsrReachable(), EnvVariableError)
    assertEquals(error.variable, 'JSR_URL')
    assertStringIncludes(error.message, 'JSR_URL')
  })
})

Deno.test('hub credentials - empty SKMTC_HUB_TOKEN and SKMTC_API_ORIGIN are unset', async () => {
  await withEnv({ SKMTC_HUB_TOKEN: '', SKMTC_API_ORIGIN: '', HOME: '/nonexistent-home' }, () => {
    assertEquals(resolveOrigin(), 'https://api.skmtc.dev')
    assertEquals(resolveHubToken(), undefined)
    assertEquals(resolveHubAuth(), { token: undefined, origin: 'https://api.skmtc.dev' })
  })
})

Deno.test('hub credentials - a malformed SKMTC_API_ORIGIN fails naming SKMTC_API_ORIGIN', async () => {
  await withEnv({ SKMTC_API_ORIGIN: 'not-a-url' }, () => {
    assertEquals(assertThrows(() => resolveOrigin(), EnvVariableError).variable, 'SKMTC_API_ORIGIN')
    assertEquals(
      assertThrows(() => resolveHubAuth(), EnvVariableError).variable,
      'SKMTC_API_ORIGIN'
    )
  })
})
