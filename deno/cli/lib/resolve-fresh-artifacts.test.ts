import { assertEquals } from '@std/assert/equals'
import { join } from '@std/path/join'
import { stub } from '@std/testing/mock'
import * as v from 'valibot'
import { manifestContent } from '@skmtc/core/Manifest'
import { resolveFreshArtifacts } from '@/lib/resolve-fresh-artifacts.ts'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

type WorkerCall = {
  bundlePath: string
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

Deno.test('resolveFreshArtifacts - builds the bundle, then renders from what it built', async () => {
  await withStubbedWorker(async (schemaPath, calls) => {
    const artifacts = await resolveFreshArtifacts({
      schemaSourceString: schemaPath,
      clientSettings: undefined,
      stackUrl: undefined,
      buildBundle: () => Promise.resolve('file:///project/bundle.js')
    })

    assertEquals(artifacts, { 'src/out.ts': 'export {}\n' })
    assertEquals(calls, [{ bundlePath: 'file:///project/bundle.js', stackUrl: undefined }])
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
        return Promise.resolve('file:///project/bundle.js')
      }
    })

    assertEquals(artifacts, { 'src/out.ts': 'export {}\n' })
    assertEquals(builds, [])
    assertEquals(calls, [{ bundlePath: '', stackUrl: 'https://stack.example' }])
  })
})
