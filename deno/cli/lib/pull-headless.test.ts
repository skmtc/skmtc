import { assertEquals } from '@std/assert'
import { pullHeadless } from '@/lib/pull-headless.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

const originalFetch = globalThis.fetch

/** Pull the given hub settings into a project with the given local settings; return the settings written. */
const pullInto = async ({
  local,
  hub
}: {
  local: Record<string, unknown>
  hub: Record<string, unknown>
}): Promise<Record<string, unknown> | undefined> => {
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url.endsWith('/client-config')) {
      return Promise.resolve(new Response(JSON.stringify({ settings: hub }), { status: 200 }))
    }
    throw new Error(`unexpected fetch ${method} ${url}`)
  }

  let written: Record<string, unknown> | undefined
  const clientJson = {
    path: '/root/.skmtc/my-api/.settings/skmtc.config.json',
    contents: { project: '@acme/petstore', settings: local },
    write: () => {
      written = clientJson.contents.settings
      return Promise.resolve()
    }
  }
  const skmtcRoot = { findProject: () => ({ name: 'my-api', clientJson }) } as unknown as SkmtcRoot

  try {
    const result = await pullHeadless({
      skmtcRoot,
      projectName: 'my-api',
      token: 'pat',
      origin: 'https://hub.test'
    })
    assertEquals(result.type, 'pulled')
    return written
  } finally {
    globalThis.fetch = originalFetch
  }
}

Deno.test('pullHeadless - a hub parse is written as system into a project not yet migrated', async () => {
  const written = await pullInto({
    local: { basePath: 'src', system: { not: 'strict' } },
    hub: { parse: { not: 'unknown' } }
  })

  assertEquals(written, { basePath: 'src', system: { not: 'unknown' } })
})

Deno.test('pullHeadless - a hub parse is written as parse into a project with parse', async () => {
  const written = await pullInto({
    local: { basePath: 'src', parse: { not: 'strict' } },
    hub: { parse: { not: 'unknown' } }
  })

  assertEquals(written, { basePath: 'src', parse: { not: 'unknown' } })
})

Deno.test('pullHeadless - a hub parse is written as parse into a project with neither key', async () => {
  const written = await pullInto({
    local: { basePath: 'src' },
    hub: { parse: { not: 'unknown' } }
  })

  assertEquals(written, { basePath: 'src', parse: { not: 'unknown' } })
})

Deno.test('pullHeadless - an empty hub parse drops the local parse', async () => {
  const written = await pullInto({
    local: { basePath: 'src', parse: { not: 'unknown' } },
    hub: { parse: {} }
  })

  assertEquals(written, { basePath: 'src' })
})

Deno.test('pullHeadless - a missing hub parse drops the local system', async () => {
  const written = await pullInto({
    local: { basePath: 'src', system: { not: 'unknown' } },
    hub: {}
  })

  assertEquals(written, { basePath: 'src' })
})
