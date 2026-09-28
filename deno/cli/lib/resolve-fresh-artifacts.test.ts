import { assertEquals } from '@std/assert/equals'
import { join } from '@std/path/join'
import { stub } from '@std/testing/mock'
import * as v from 'valibot'
import { manifestContent } from '@skmtc/core/Manifest'
import { resolveFreshArtifacts } from '@/lib/resolve-fresh-artifacts.ts'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import { toStubBundle } from '@/tests/mocks/read-only-bundle.mock.ts'

type WorkerCall = {
  bundlePath: string | undefined
  stackUrl: string | undefined
}

/** Stubs the worker run; `calls` records what each run was handed. */
const withStubbedWorker = async (
  body: (schemaPath: string, calls: WorkerCall[]) => Promise<void>
): Promise<void> => {
  const tempDir = await Deno.makeTempDir()
  const schemaPath = join(tempDir, 'openapi.json')
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({ openapi: '3.0.0', info: { title: 'api', version: '1' }, paths: {} })
  )
  const calls: WorkerCall[] = []
  const response: GenerateResponse = {
    artifacts: { 'src/out.ts': 'export {}\n' },
    manifest: v.parse(manifestContent, {
      deploymentId: 'test-deployment',
      traceId: 'test-trace',
      spanId: 'test-span',
      files: {},
      previews: {},
      parseIssues: [],
      results: {},
      startAt: 0,
      endAt: 0
    })
  }
  const workerStub = stub(GenerateArtifacts, 'generateWithWorker', ({ bundlePath, stackUrl }) => {
    calls.push({ bundlePath, stackUrl })
    return Promise.resolve(response)
  })
  try {
    await body(schemaPath, calls)
  } finally {
    workerStub.restore()
    await Deno.remove(tempDir, { recursive: true })
  }
}

Deno.test('resolveFreshArtifacts - builds the bundle, renders from it, then disposes of it', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const bundle = toStubBundle('file:///tmp/skmtc-bundle/bundle.js')
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: schemaPath,
      clientSettings: undefined,
      stackUrl: undefined,
      buildBundle: () => Promise.resolve(bundle)
    })

    assertEquals(artifacts, { 'src/out.ts': 'export {}\n' })
    assertEquals(calls, [{ bundlePath: 'file:///tmp/skmtc-bundle/bundle.js', stackUrl: undefined }])
    assertEquals(bundle.disposed(), true)
  })
})

Deno.test('resolveFreshArtifacts - an unreachable schema costs no build', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const builds: string[] = []
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: `${schemaPath}.missing`,
      clientSettings: undefined,
      stackUrl: undefined,
      buildBundle: () => {
        builds.push('built')
        return Promise.resolve(toStubBundle())
      }
    })

    assertEquals(artifacts, null)
    assertEquals(builds, [])
    assertEquals(calls, [])
  })
})

Deno.test('resolveFreshArtifacts - a failed build renders nothing', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: schemaPath,
      clientSettings: undefined,
      stackUrl: undefined,
      buildBundle: () => Promise.reject(new Error('two copies of @skmtc/core'))
    })

    assertEquals(artifacts, null)
    assertEquals(calls, [])
  })
})

Deno.test('resolveFreshArtifacts - a local project with no way to build renders nothing', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: schemaPath,
      clientSettings: undefined,
      stackUrl: undefined,
      buildBundle: undefined
    })

    assertEquals(artifacts, null)
    assertEquals(calls, [])
  })
})

Deno.test('resolveFreshArtifacts - a stack server project builds nothing locally', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const builds: string[] = []
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: schemaPath,
      clientSettings: undefined,
      stackUrl: 'https://stack.example',
      buildBundle: () => {
        builds.push('built')
        return Promise.resolve(toStubBundle())
      }
    })

    assertEquals(artifacts, { 'src/out.ts': 'export {}\n' })
    assertEquals(builds, [])
    assertEquals(calls, [{ bundlePath: undefined, stackUrl: 'https://stack.example' }])
  })
})
