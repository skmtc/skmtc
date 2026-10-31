import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals, assertStringIncludes } from '@std/assert'
import { DeployView } from '@/components/DeployView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import type { DeployHeadlessResult } from '@/lib/deploy-headless.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { exitCallCount, mockExit, resetMocks } from '@/tests/mocks/ink.mock.ts'

const deployed = (
  status: 'active' | 'error',
  statusReason: string | null
): DeployHeadlessResult => ({
  type: 'deployed',
  projectName: 'my-api',
  stack: { account: 'acme', slug: 'my-api' },
  version: '3.0.1',
  upload: null,
  deploy: { status, statusReason, endpointUrl: null, url: null }
})

/** Render the view with the deploy answering `result`, and return the last frame. */
const renderWith = async (result: DeployHeadlessResult): Promise<string> => {
  resetMocks()
  const manager = createMockManager()
  const project = createMockProject(manager, { name: 'my-api' })
  const view = { page: 'deploy' as const, projectName: 'my-api', token: 'pat-123' }
  const initialState: SkmtcState = {
    view,
    skmtcRoot: createMockSkmtcRoot(manager, { projects: [project] }),
    interactive: false,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <DeployView project={project} view={view} runDeploy={() => Promise.resolve(result)} />
    </SkmtcProvider>
  )
  await new Promise(resolve => setTimeout(resolve, 50))
  const frame = lastFrame() ?? ''
  unmount()
  return frame
}

Deno.test(
  'DeployView - shows the version, then deploy: active',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const frame = await renderWith(deployed('active', null))
    assertStringIncludes(frame, 'acme/my-api@3.0.1')
    assertStringIncludes(frame, 'deploy: active')
    assertEquals(exitCallCount, 1)
  }
)

Deno.test(
  'DeployView - status error shows the reason and says the version is stored',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const frame = await renderWith(deployed('error', 'Module not found: x.ts'))
    assertStringIncludes(frame, 'deploy: error')
    assertStringIncludes(frame, 'Module not found: x.ts')
    assertStringIncludes(frame, 'Version 3.0.1 is stored')
  }
)

for (const reason of [
  'Version 3.0.1 is stored, but the hub refused the deploy (403): no. The token needs the `write:releases` scope.',
  'deploy not confirmed: the hub did not answer within 120 s. Version 3.0.1 is stored; it may still deploy.'
]) {
  Deno.test(
    `DeployView - a failed deploy shows the reason: ${reason.slice(0, 30)}`,
    { sanitizeResources: false, sanitizeOps: false },
    async () => {
      const frame = await renderWith({
        type: 'failed',
        projectName: 'my-api',
        reason,
        stage: 'deploy',
        stored: true
      })
      assertStringIncludes(frame, 'Deploy failed for my-api at deploy')
      // Ink wraps long lines, so compare without the line breaks.
      assertStringIncludes(frame.replace(/\s+/g, ' '), reason)
    }
  )
}
