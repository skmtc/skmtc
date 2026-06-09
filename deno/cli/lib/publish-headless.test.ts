import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import {
  publishHeadless,
  publishVersion,
  resolveStackVersion
} from '@/lib/publish-headless.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { SourceFile } from '@/lib/source-upload.ts'
import { join } from '@std/path/join'

const originalFetch = globalThis.fetch

const toArrayBuffer = (text: string): ArrayBuffer => {
  const u8 = new TextEncoder().encode(text)
  const buf = new ArrayBuffer(u8.byteLength)
  new Uint8Array(buf).set(u8)
  return buf
}

const createSourceFiles = (): SourceFile[] => [
  { path: 'deno.json', bytes: toArrayBuffer('{}'), contentType: 'application/json' },
  { path: 'src/mod.ts', bytes: toArrayBuffer('export {}'), contentType: 'text/plain' }
]

const stackVersionPayload = {
  version: '3.0.1',
  releasedAt: '2026-06-09T12:00:00Z',
  yanked: false,
  bundle: {
    key: 'stack-versions/abc/server.js',
    bytes: 57344,
    sha256: 'deadbeef',
    uploadedAt: '2026-06-09T12:00:00Z'
  },
  source: {
    rootKey: 'stack-versions/abc/source/',
    fileCount: 2,
    totalBytes: 11,
    uploadedAt: '2026-06-09T12:00:00Z'
  },
  url: 'https://api.skmtc.dev/v1/stacks/acme/my-api/versions/3.0.1',
  htmlUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1'
}

Deno.test('publishVersion - POSTs multipart version + bundle + files to the versions endpoint', async () => {
  let fetchUrl: string | undefined
  let fetchOptions: RequestInit | undefined

  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    fetchUrl = url.toString()
    fetchOptions = options

    return new Response(JSON.stringify(stackVersionPayload), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const result = await publishVersion({
      hubUrl: 'https://hub.test',
      token: 'pat-123',
      account: 'acme',
      slug: 'my-api',
      version: '3.0.1',
      bundle: toArrayBuffer('// bundle'),
      files: createSourceFiles()
    })

    assertEquals(fetchUrl, 'https://hub.test/v1/stacks/acme/my-api/versions')
    assertEquals(fetchOptions?.method, 'POST')

    const body = fetchOptions?.body
    if (!(body instanceof FormData)) {
      throw new Error('expected a FormData body')
    }
    assertEquals(body.get('version'), '3.0.1')

    const bundlePart = body.get('bundle')
    if (!(bundlePart instanceof File)) {
      throw new Error('expected a file `bundle` part')
    }
    assertEquals(bundlePart.name, 'server.js')
    assertEquals(bundlePart.type, 'application/javascript')

    const fileParts = body.getAll('files')
    assertEquals(fileParts.length, 2)
    const filenames = fileParts.map(part => (part instanceof File ? part.name : ''))
    assertEquals(filenames, ['deno.json', 'src/mod.ts'])

    // The StackVersion response is parsed into the flat result shape.
    assertEquals(result, {
      version: '3.0.1',
      versionUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1',
      bundleBytes: 57344,
      bundleSha256: 'deadbeef',
      sourceFileCount: 2,
      sourceTotalBytes: 11
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('publishVersion - surfaces 409 as a clear "already published" failure', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'conflict', message: 'version exists' }), {
      status: 409
    })

  try {
    const error = await assertRejects(() =>
      publishVersion({
        hubUrl: 'https://hub.test',
        token: 'pat-123',
        account: 'acme',
        slug: 'my-api',
        version: '3.0.1',
        bundle: toArrayBuffer('// bundle'),
        files: createSourceFiles()
      })
    )

    if (!(error instanceof Error)) throw new Error('expected an Error')
    assertStringIncludes(error.message, 'version 3.0.1 is already published')
    assertStringIncludes(error.message, 'version exists')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resolveStackVersion - the --version flag wins over deno.json', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: '1.0.0' }))

    const version = await resolveStackVersion({ projectPath, versionFlag: ' 2.0.0 ' })
    assertEquals(version, '2.0.0')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackVersion - falls back to the project deno.json version', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: ' 1.2.3 ' }))

    const version = await resolveStackVersion({ projectPath })
    assertEquals(version, '1.2.3')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackVersion - throws the recipe when no version exists anywhere', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))

    const error = await assertRejects(() => resolveStackVersion({ projectPath }))
    if (!(error instanceof Error)) throw new Error('expected an Error')
    assertStringIncludes(error.message, "set a `version` in the project's deno.json")
    assertStringIncludes(error.message, '--version')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('publishHeadless - missing version fails before any network call', async () => {
  const projectPath = await Deno.makeTempDir()
  let fetchCalls = 0

  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('network must not be touched when the version is missing')
  }

  // Only `findProject(...).toPath()` is exercised on the missing-version
  // path — the failure short-circuits before identity/bundle/publish.
  const skmtcRoot = {
    findProject: () => ({ toPath: () => projectPath })
  } as unknown as SkmtcRoot

  try {
    const result = await publishHeadless({
      skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123'
    })

    assertEquals(result.kind, 'failed')
    if (result.kind !== 'failed') throw new Error('expected a failed result')
    assertEquals(result.stage, 'version')
    assertStringIncludes(result.reason, "set a `version` in the project's deno.json")
    assertEquals(fetchCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    await Deno.remove(projectPath, { recursive: true })
  }
})
