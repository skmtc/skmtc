import { assertEquals } from '@std/assert'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { stub } from '@std/testing/mock'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { LogLine } from '@skmtc/core/LogLine'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { generateLocal } from '@/lib/generate-local.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

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

/** Runs `generateLocal` against a worker result of `response`. */
const generateWith = async (projectPath: string, response: GenerateResponse) => {
  const workerStub = stub(GenerateArtifacts, 'generateWithWorker', () => Promise.resolve(response))

  try {
    return await generateLocal({
      bundlePath: 'bundle.js',
      schemaContents: '{}',
      fileType: 'json',
      clientSettings: undefined,
      manifestPath: join(projectPath, '.settings', 'manifest.json'),
      projectPath,
      schemaSource: undefined,
      anchorsFlag: undefined
    })
  } finally {
    workerStub.restore()
  }
}

Deno.test('generateLocal - writes logs.ndjson beside manifest.json, and removes it without logs', async () => {
  const projectPath = Deno.makeTempDirSync()
  const logLinesPath = join(projectPath, '.settings', 'logs.ndjson')

  try {
    await generateWith(projectPath, { artifacts: {}, manifest, logs: [errorLine] })

    assertEquals(existsSync(join(projectPath, '.settings', 'manifest.json')), true)
    assertEquals(Deno.readTextFileSync(logLinesPath), `${JSON.stringify(errorLine)}\n`)

    // A bundle that pins an older core returns no `logs`.
    await generateWith(projectPath, { artifacts: {}, manifest })

    assertEquals(existsSync(logLinesPath), false)
  } finally {
    Deno.removeSync(projectPath, { recursive: true })
  }
})
