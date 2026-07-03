import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import {
  assertJsrReachable,
  getJsrBaseUrl,
  JsrRegistryUnreachableError,
  toJsrUrl
} from '@/lib/jsr-registry.ts'

const withJsrUrl = async <T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> => {
  const previous = Deno.env.get('JSR_URL')
  if (value === undefined) {
    Deno.env.delete('JSR_URL')
  } else {
    Deno.env.set('JSR_URL', value)
  }
  try {
    return await fn()
  } finally {
    if (previous === undefined) {
      Deno.env.delete('JSR_URL')
    } else {
      Deno.env.set('JSR_URL', previous)
    }
  }
}

const originalFetch = globalThis.fetch

Deno.test('getJsrBaseUrl - defaults to upstream jsr.io', async () => {
  await withJsrUrl(undefined, () => {
    assertEquals(getJsrBaseUrl(), 'https://jsr.io')
  })
})

Deno.test('getJsrBaseUrl - honors JSR_URL env override', async () => {
  await withJsrUrl('https://example.test/registry/', () => {
    assertEquals(getJsrBaseUrl(), 'https://example.test/registry')
  })
})

Deno.test('toJsrUrl - composes path against the resolved base, normalizing slashes', async () => {
  await withJsrUrl(undefined, () => {
    assertEquals(toJsrUrl('@skmtc/gen-zod/meta.json'), 'https://jsr.io/@skmtc/gen-zod/meta.json')
    assertEquals(toJsrUrl('/@skmtc/gen-zod/meta.json'), 'https://jsr.io/@skmtc/gen-zod/meta.json')
  })
})

Deno.test('assertJsrReachable - resolves on any non-5xx response', async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 })
  try {
    await withJsrUrl('https://example.test/', () => assertJsrReachable())
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('assertJsrReachable - throws JsrRegistryUnreachableError with recipe on network failure', async () => {
  globalThis.fetch = async () => {
    throw new Error('connection refused')
  }
  try {
    const err = await assertRejects(
      () => withJsrUrl('https://example.test/', () => assertJsrReachable()),
      JsrRegistryUnreachableError
    )
    assertStringIncludes(err.message, 'https://example.test')
    assertStringIncludes(err.message, 'JSR_URL=')
    assertStringIncludes(err.message, 'connection refused')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('assertJsrReachable - 5xx response is treated as unreachable', async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 })
  try {
    await assertRejects(
      () => withJsrUrl('https://example.test/', () => assertJsrReachable()),
      JsrRegistryUnreachableError,
      'HTTP 503'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
