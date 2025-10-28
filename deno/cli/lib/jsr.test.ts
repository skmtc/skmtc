import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { Jsr, type JsrPkgVersionInfo, type JsrPkgMetaVersion } from '@/lib/jsr.ts'
import { Generator } from '@/lib/generator.ts'

// Define internal type used in tests (not exported from jsr.ts)
type JsrPkgMetaVersions = {
  scope: string
  name: string
  latest: string
  versions: {
    [version: string]: JsrPkgMetaVersion
  }
}

// Store original fetch to restore after tests
const originalFetch = globalThis.fetch

// Helper to create mock Generator
const createMockGenerator = (moduleName: string, version: string): Generator => {
  const mockGenerator = Object.create(Generator.prototype)
  Object.assign(mockGenerator, {
    toModuleName: () => moduleName,
    version
  })
  return mockGenerator
}

// Mock JSR API responses
const createMockMetaResponse = (): JsrPkgMetaVersions => ({
  scope: '@skmtc',
  name: 'gen-typescript',
  latest: '2.1.0',
  versions: {
    '1.0.0': {},
    '1.5.0': {},
    '2.0.0': {},
    '2.1.0': {},
    '3.0.0-alpha.1': { yanked: false }
  }
})

const createMockVersionMetaResponse = (): JsrPkgVersionInfo => ({
  pkg: {
    name: '@skmtc/gen-typescript',
    version: '2.1.0'
  },
  manifest: {
    'mod.ts': { size: 100, checksum: 'abc123' },
    'lib/helper.ts': { size: 200, checksum: 'def456' },
    'README.md': { size: 50, checksum: 'ghi789' }
  },
  exports: {
    '.': './mod.ts'
  }
})

// Test 1: Jsr.getLatestMeta - success case
Deno.test('Jsr.getLatestMeta - fetches and parses metadata successfully', async () => {
  const mockMeta = createMockMetaResponse()

  // Mock fetch to return successful response
  globalThis.fetch = async (url: string | URL | Request) => {
    assertEquals(url, 'https://jsr.io/@skmtc/gen-typescript/meta.json')

    return new Response(JSON.stringify(mockMeta), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const result = await Jsr.getLatestMeta({
      scopeName: '@skmtc',
      packageName: 'gen-typescript'
    })

    assertEquals(result.scope, '@skmtc')
    assertEquals(result.name, 'gen-typescript')
    assertEquals(result.latest, '2.1.0')
    assertEquals(Object.keys(result.versions).length, 5)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 2: Jsr.getLatestMeta - handles network error
Deno.test('Jsr.getLatestMeta - throws error on network failure', async () => {
  // Mock fetch to reject
  globalThis.fetch = async () => {
    throw new Error('Network error')
  }

  try {
    await assertRejects(
      async () => {
        await Jsr.getLatestMeta({
          scopeName: '@skmtc',
          packageName: 'gen-typescript'
        })
      },
      Error,
      'Network error'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 3: Jsr.getLatestMeta - handles 404 error
Deno.test('Jsr.getLatestMeta - throws error with package name on 404', async () => {
  // Mock fetch to return 404
  globalThis.fetch = async () => {
    return new Response('Package not found', {
      status: 404,
      statusText: 'Not Found'
    })
  }

  try {
    await assertRejects(
      async () => {
        await Jsr.getLatestMeta({
          scopeName: '@skmtc',
          packageName: 'nonexistent'
        })
      },
      Error,
      'Failed to get latest meta for jsr:@skmtc/nonexistent'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 4: Jsr.getLatestVersion - resolves exact version match
Deno.test('Jsr.getLatestVersion - resolves ^2.0.0 to latest 2.x version', async () => {
  const mockMeta = createMockMetaResponse()

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    const version = await Jsr.getLatestVersion({
      scopeName: '@skmtc',
      packageName: 'gen-typescript',
      semver: '^2.0.0'
    })

    assertEquals(version, '2.1.0')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 5: Jsr.getLatestVersion - resolves major version range
Deno.test('Jsr.getLatestVersion - resolves ^1.0.0 to latest 1.x version', async () => {
  const mockMeta = createMockMetaResponse()

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    const version = await Jsr.getLatestVersion({
      scopeName: '@skmtc',
      packageName: 'gen-typescript',
      semver: '^1.0.0'
    })

    assertEquals(version, '1.5.0')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 6: Jsr.getLatestVersion - throws error when no matching version
Deno.test('Jsr.getLatestVersion - throws error when semver range matches nothing', async () => {
  const mockMeta = createMockMetaResponse()

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    await assertRejects(
      async () => {
        await Jsr.getLatestVersion({
          scopeName: '@skmtc',
          packageName: 'gen-typescript',
          semver: '^5.0.0' // No version 5.x exists
        })
      },
      Error,
      'Failed to find package for jsr:@skmtc/gen-typescript with version matching ^5.0.0'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 7: Jsr.getLatestVersion - picks latest from multiple versions
Deno.test('Jsr.getLatestVersion - picks latest satisfying version from multiple matches', async () => {
  const mockMeta: JsrPkgMetaVersions = {
    scope: '@skmtc',
    name: 'gen-typescript',
    latest: '1.9.5',
    versions: {
      '1.5.0': {},
      '1.7.0': {},
      '1.8.0': {},
      '1.9.0': {},
      '1.9.5': {}
    }
  }

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    const version = await Jsr.getLatestVersion({
      scopeName: '@skmtc',
      packageName: 'gen-typescript',
      semver: '^1.5.0'
    })

    // Should pick 1.9.5, the latest 1.x version >= 1.5.0
    assertEquals(version, '1.9.5')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 8: Jsr.getLatestVersion - excludes prerelease versions by default
Deno.test('Jsr.getLatestVersion - excludes prerelease versions for stable range', async () => {
  const mockMeta = createMockMetaResponse()

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    const version = await Jsr.getLatestVersion({
      scopeName: '@skmtc',
      packageName: 'gen-typescript',
      semver: '^2.0.0'
    })

    // Should pick 2.1.0, not 3.0.0-alpha.1
    assertEquals(version, '2.1.0')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 9: Jsr.download - downloads single file successfully
Deno.test('Jsr.download - downloads generator with single file', async () => {
  const mockMeta = createMockMetaResponse()
  const mockVersionMeta: JsrPkgVersionInfo = {
    pkg: { name: '@skmtc/gen-typescript', version: '2.1.0' },
    manifest: {
      'mod.ts': { size: 100, checksum: 'abc123' }
    }
  }

  let fetchCallCount = 0

  globalThis.fetch = async (url: string | URL | Request) => {
    fetchCallCount++
    const urlStr = url.toString()

    if (urlStr.includes('meta.json') && !urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockMeta), { status: 200 })
    } else if (urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockVersionMeta), { status: 200 })
    } else if (urlStr.includes('mod.ts')) {
      return new Response('export const hello = "world"', { status: 200 })
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const generator = createMockGenerator('@skmtc/gen-typescript', '^2.0.0')
    const files = await Jsr.download(generator)

    assertEquals(Object.keys(files).length, 1)
    assertEquals(files['mod.ts'], 'export const hello = "world"')
    assertEquals(fetchCallCount >= 3, true) // meta.json, _meta.json, mod.ts
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 10: Jsr.download - downloads multiple files in parallel
Deno.test('Jsr.download - downloads generator with multiple files', async () => {
  const mockMeta = createMockMetaResponse()
  const mockVersionMeta = createMockVersionMetaResponse()

  globalThis.fetch = async (url: string | URL | Request) => {
    const urlStr = url.toString()

    if (urlStr.includes('meta.json') && !urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockMeta), { status: 200 })
    } else if (urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockVersionMeta), { status: 200 })
    } else if (urlStr.includes('mod.ts')) {
      return new Response('export * from "./lib/helper.ts"', { status: 200 })
    } else if (urlStr.includes('lib/helper.ts')) {
      return new Response('export const helper = () => {}', { status: 200 })
    } else if (urlStr.includes('README.md')) {
      return new Response('# Generator Documentation', { status: 200 })
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const generator = createMockGenerator('@skmtc/gen-typescript', '^2.0.0')
    const files = await Jsr.download(generator)

    assertEquals(Object.keys(files).length, 3)
    assertEquals(files['mod.ts'], 'export * from "./lib/helper.ts"')
    assertEquals(files['lib/helper.ts'], 'export const helper = () => {}')
    assertEquals(files['README.md'], '# Generator Documentation')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 11: Jsr.download - throws error when version resolution fails
Deno.test('Jsr.download - throws error when version cannot be resolved', async () => {
  const mockMeta = createMockMetaResponse()

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockMeta), { status: 200 })
  }

  try {
    const generator = createMockGenerator('@skmtc/gen-typescript', '^10.0.0')

    await assertRejects(
      async () => {
        await Jsr.download(generator)
      },
      Error,
      'Failed to find package for jsr:@skmtc/gen-typescript with version matching ^10.0.0'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 12: Jsr.download - throws error when file download fails
Deno.test('Jsr.download - throws error when individual file fetch fails', async () => {
  const mockMeta = createMockMetaResponse()
  const mockVersionMeta = createMockVersionMetaResponse()

  globalThis.fetch = async (url: string | URL | Request) => {
    const urlStr = url.toString()

    if (urlStr.includes('meta.json') && !urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockMeta), { status: 200 })
    } else if (urlStr.includes('_meta.json')) {
      return new Response(JSON.stringify(mockVersionMeta), { status: 200 })
    } else if (urlStr.includes('mod.ts')) {
      // First file succeeds
      return new Response('export const hello = "world"', { status: 200 })
    } else if (urlStr.includes('lib/helper.ts')) {
      // Second file fails
      return new Response('File not found', { status: 404 })
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const generator = createMockGenerator('@skmtc/gen-typescript', '^2.0.0')

    await assertRejects(
      async () => {
        await Jsr.download(generator)
      },
      Error,
      'Failed to get file for jsr:@skmtc/gen-typescript'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
