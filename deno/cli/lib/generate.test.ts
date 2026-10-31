import { assertEquals } from '@std/assert'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { stub } from '@std/testing/mock'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { LogLine } from '@skmtc/core/LogLine'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { generate } from '@/lib/generate.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'

const manifest: ManifestContent = {
  deploymentId: 'd',
  traceId: 't',
  spanId: 's',
  files: {},
  previews: {},
  results: {},
  parseIssues: [],
  startAt: 0,
  endAt: 1
}

const errorLine: LogLine = {
  seq: 0,
  level: 'ERROR',
  trail: 't:s:generate:ops:/pets:get:variant:main',
  message: 'pets transform failed',
  time: 1
}

/** Runs the interactive `generate` against a worker result of `response`. */
const generateWith = async (manifestPath: string, response: GenerateResponse) => {
  const manager = createMockManager()
  const project = Object.assign(createMockProject(manager), { toManifestPath: () => manifestPath })
  const workerStub = stub(GenerateArtifacts, 'generateWithWorker', () => Promise.resolve(response))

  try {
    return await generate({
      project,
      bundlePath: 'bundle.js',
      skmtcRoot: createMockSkmtcRoot(manager, { projects: [project] }),
      schemaContents: '{}',
      fileType: 'json',
      clientSettings: undefined
    })
  } finally {
    workerStub.restore()
  }
}

Deno.test('generate - writes logs.ndjson beside manifest.json, and removes it without logs', async () => {
  const settingsPath = Deno.makeTempDirSync()
  const manifestPath = join(settingsPath, 'manifest.json')
  const logLinesPath = join(settingsPath, 'logs.ndjson')

  try {
    await generateWith(manifestPath, { artifacts: {}, manifest, logs: [errorLine] })

    assertEquals(Deno.readTextFileSync(logLinesPath), `${JSON.stringify(errorLine)}\n`)

    // A bundle that pins an older core returns no `logs`.
    await generateWith(manifestPath, { artifacts: {}, manifest })

    assertEquals(existsSync(logLinesPath), false)
  } finally {
    Deno.removeSync(settingsPath, { recursive: true })
  }
})
