import { assertEquals, assertRejects } from '@std/assert'
import { stub } from '@std/testing/mock'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import {
  type DeviceCode,
  DeviceLoginError,
  formatUserCode,
  pollForTokens,
  requestDeviceCode
} from '@/lib/device-login.ts'
import { readStoredAuth } from '@/lib/hub-token.ts'
import { deviceLogin } from '@/commands/login.tsx'

type Recorded = { url: string; fields: Record<string, string> }

/** Answer each request with the next response; record the URL and the form fields. */
const stubFetch = (responses: (() => Response)[]) => {
  const requests: Recorded[] = []
  const fetchStub = stub(globalThis, 'fetch', (input, init) => {
    const body = init?.body
    requests.push({
      url: String(input),
      fields: body instanceof URLSearchParams ? Object.fromEntries(body) : {}
    })
    const next = responses.shift()
    if (!next) {
      return Promise.reject(new Error(`unexpected request to ${String(input)}`))
    }
    return Promise.resolve(next())
  })
  return { requests, restore: () => fetchStub.restore() }
}

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status })

const code: DeviceCode = {
  deviceCode: 'device-1',
  userCode: 'WDJBMJHT',
  verificationUri: 'https://skmtc.co.uk/login/device',
  verificationUriComplete: 'https://skmtc.co.uk/login/device?user_code=WDJBMJHT',
  expiresIn: 900,
  interval: 5
}

const tokens = json(200, {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600
})

/** A clock the sleeps move forward, so polling runs without waiting. */
const fakeClock = () => {
  let time = 0
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => time,
    sleep: (ms: number) => {
      sleeps.push(ms)
      time += ms
      return Promise.resolve()
    }
  }
}

Deno.test('formatUserCode - groups eight characters as XXXX-XXXX', () => {
  assertEquals(formatUserCode('wdjbmjht'), 'WDJB-MJHT')
  assertEquals(formatUserCode('WDJB-MJHT'), 'WDJB-MJHT')
})

Deno.test('requestDeviceCode - asks the environment for the CLI client, resource and scopes', async () => {
  const fetchMock = stubFetch([
    json(200, {
      device_code: 'device-1',
      user_code: 'WDJBMJHT',
      verification_uri: 'https://skmtc.co.uk/login/device',
      expires_in: 900,
      interval: 5
    })
  ])

  try {
    const result = await requestDeviceCode('local')

    assertEquals(fetchMock.requests, [
      {
        url: 'https://skmtc.co.uk/api/auth/device/code',
        fields: {
          client_id: 'skmtc-cli',
          scope: 'write:catalog write:releases offline_access',
          resource: 'urn:skmtc:cli'
        }
      }
    ])
    // Identity sends no verification_uri_complete, so the CLI builds it.
    assertEquals(result, code)
  } finally {
    fetchMock.restore()
  }
})

Deno.test('pollForTokens - waits through pending, slows down when asked, then returns the tokens', async () => {
  const clock = fakeClock()
  const fetchMock = stubFetch([
    json(400, { error: 'authorization_pending' }),
    json(400, { error: 'slow_down' }),
    tokens
  ])

  try {
    const result = await pollForTokens({
      env: 'local',
      code,
      sleep: clock.sleep,
      now: clock.now
    })

    assertEquals(result, {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 20_000 + 3_600_000
    })
    assertEquals(clock.sleeps, [5000, 5000, 10_000])
    assertEquals(fetchMock.requests[0], {
      url: 'https://skmtc.co.uk/api/auth/oauth2/token',
      fields: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'device-1',
        client_id: 'skmtc-cli'
      }
    })
  } finally {
    fetchMock.restore()
  }
})

Deno.test('pollForTokens - a denied code fails and stops polling', async () => {
  const clock = fakeClock()
  const fetchMock = stubFetch([json(400, { error: 'access_denied' })])

  try {
    const error = await assertRejects(
      () =>
        pollForTokens({
          env: 'local',
          code,
          sleep: clock.sleep,
          now: clock.now
        }),
      DeviceLoginError
    )
    assertEquals(error.code, 'access_denied')
    assertEquals(fetchMock.requests.length, 1)
  } finally {
    fetchMock.restore()
  }
})

Deno.test('pollForTokens - stops at the code expiry instead of polling forever', async () => {
  const clock = fakeClock()
  const pending = json(400, { error: 'authorization_pending' })
  const fetchMock = stubFetch(Array.from({ length: 3 }, () => pending))

  try {
    const error = await assertRejects(
      () =>
        pollForTokens({
          env: 'local',
          code: { ...code, expiresIn: 15 },
          sleep: clock.sleep,
          now: clock.now
        }),
      DeviceLoginError,
      'skmtc login'
    )
    assertEquals(error.code, 'expired_token')
    assertEquals(fetchMock.requests.length, 3)
  } finally {
    fetchMock.restore()
  }
})

const withTempHome = async (fn: () => Promise<void>): Promise<void> => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-device-login-test-' })
  try {
    await withEnv(
      {
        HOME: home,
        SKMTC_HUB_TOKEN: undefined,
        SKMTC_ENV: undefined
      },
      fn
    )
  } finally {
    Deno.removeSync(home, { recursive: true })
  }
}

const deviceCodeResponse = json(200, {
  device_code: 'device-1',
  user_code: 'WDJBMJHT',
  verification_uri: 'https://skmtc.co.uk/login/device',
  expires_in: 900,
  interval: 5
})

Deno.test('deviceLogin - stores the OAuth token for the environment after the hub accepts it', async () => {
  await withTempHome(async () => {
    const clock = fakeClock()
    const shown: DeviceCode[] = []
    const fetchMock = stubFetch([deviceCodeResponse, tokens, json(200, { handle: 'ada' })])

    try {
      const handle = await deviceLogin({
        env: 'local',
        onCode: shown.push.bind(shown),
        sleep: clock.sleep
      })

      assertEquals(handle, 'ada')
      assertEquals(
        shown.map(item => item.userCode),
        ['WDJBMJHT']
      )
      assertEquals(fetchMock.requests[2].url, 'https://api.skmtc.co.uk/v1/user')
      const stored = readStoredAuth()
      assertEquals(
        {
          env: stored?.env,
          token: stored?.token,
          refreshToken: stored?.refreshToken
        },
        { env: 'local', token: 'access', refreshToken: 'refresh' }
      )
    } finally {
      fetchMock.restore()
    }
  })
})

Deno.test('deviceLogin - a token the hub rejects is never stored', async () => {
  await withTempHome(async () => {
    const clock = fakeClock()
    const fetchMock = stubFetch([
      deviceCodeResponse,
      tokens,
      () => new Response('unauthorized', { status: 401 })
    ])

    try {
      await assertRejects(
        () => deviceLogin({ env: 'local', onCode: () => {}, sleep: clock.sleep }),
        Error,
        'token validation failed (401)'
      )
      assertEquals(readStoredAuth(), null)
    } finally {
      fetchMock.restore()
    }
  })
})
