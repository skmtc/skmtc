import { snapshotTest } from '@cliffy/testing'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toInitCommand } from './init.tsx'

// Create a stubbed version of renderInit that prints parameters
const renderInitStub = async ({
  projectName,
  generators,
  basePath
}: {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
}) => {
  console.log('projectName:', projectName)
  console.log('generators:', generators)
  console.log('basePath:', basePath)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project', '@skmtc/gen-typescript', './lib'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toInitCommand(createMockSkmtcRoot(createMockManager()), renderInitStub)
    await command.parse()
  }
})
