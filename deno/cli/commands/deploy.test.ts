import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import {
  printDeployResult,
  PUBLISH_ALIAS_NOTICE,
  renderDeploy,
  renderPublishAlias
} from '@/commands/deploy.tsx'
import { COMMANDS_THAT_SKIP_REGISTRY_CHECK, shouldSkipRegistryCheck } from '@/lib/registry-check.ts'
import type { DeployHeadlessResult } from '@/lib/deploy-headless.ts'
import { getCommandDescriptor } from '@/lib/cli-schema.ts'
import { withCapturedExit } from '@/tests/mocks/exit.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import {
  makeStackProject,
  stackVersionPayload,
  toJsonResponse,
  toStackServer,
  withStackHub
} from '@/tests/mocks/stack-hub.mock.ts'

const deployedResult: DeployHeadlessResult = {
  type: 'deployed',
  projectName: 'my-api',
  stack: { account: 'acme', slug: 'my-api' },
  version: '3.0.1',
  upload: {
    sourceHash: 'deadbeef',
    versionUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1',
    sourceFileCount: 2,
    sourceTotalBytes: 11
  },
  deploy: {
    status: 'active',
    statusReason: null,
    endpointUrl: 'https://acme-my-api.deno.dev/api',
    url: 'https://api.skmtc.dev/v1/stacks/acme/my-api/servers/3.0.1'
  }
}

Deno.test('printDeployResult - text prints the version, then deploy: <status>', async () => {
  const { stdout } = await withCapturedExit(async () => {
    printDeployResult(deployedResult, { format: 'text' })
  })

  const lines = stdout.split('\n')
  assertStringIncludes(lines[0], 'acme/my-api@3.0.1')
  const deployLine = lines.indexOf('deploy: active')
  assertEquals(deployLine > 0, true)
  assertStringIncludes(stdout, 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1')
  assertEquals(stdout.includes('ublish'), false)
})

Deno.test('printDeployResult - json emits the stored version and the deploy object', async () => {
  const { stdout } = await withCapturedExit(async () => {
    printDeployResult(deployedResult, { format: 'json' })
  })

  const parsed = JSON.parse(stdout)
  assertEquals(parsed, deployedResult)
  assertEquals(parsed.version, '3.0.1')
  assertEquals(Object.keys(parsed.deploy).sort(), ['endpointUrl', 'status', 'statusReason', 'url'])
})

Deno.test('printDeployResult - a failed result reports the stage and reason', async () => {
  const { stderr } = await withCapturedExit(async () => {
    printDeployResult(
      {
        type: 'failed',
        projectName: 'my-api',
        reason: 'Version 3.0.1 already exists.',
        stage: 'exists',
        stored: false
      },
      { format: 'text' }
    )
  })

  assertStringIncludes(stderr, 'Deploy failed for "my-api" at exists')
  assertStringIncludes(stderr, 'Version 3.0.1 already exists.')
})

/** Run `skmtc deploy my-api --json` in strict mode against `answers`. */
const runStrictDeploy = async (answers: Parameters<typeof withStackHub>[0], existing = false) => {
  await using project = await makeStackProject()
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'my-api' })
  mockProject.toPath = () => project.projectPath
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  let run: Awaited<ReturnType<typeof withCapturedExit>> | undefined
  await withStackHub(answers, async () => {
    run = await withCapturedExit(() =>
      renderDeploy({
        skmtcRoot,
        projectName: 'my-api',
        token: 'pat-123',
        env: 'staging',
        version: undefined,
        existing,
        jsonFlag: true
      })
    )
  })
  if (!run) throw new Error('renderDeploy did not run')
  return run
}

Deno.test('renderDeploy - an active deploy exits 0 with one JSON document', async () => {
  const { exitCode, stdout } = await runStrictDeploy({})
  assertEquals(exitCode, 0)
  const parsed = JSON.parse(stdout)
  assertEquals(parsed.type, 'deployed')
  assertEquals(parsed.version, '3.0.1')
  assertEquals(parsed.deploy.status, 'active')
})

Deno.test('renderDeploy - status error exits 1 and the JSON carries the reason', async () => {
  const { exitCode, stdout } = await runStrictDeploy({
    deploy: () => toJsonResponse(toStackServer({ status: 'error', statusReason: 'boom' }), 201)
  })
  assertEquals(exitCode, 1)
  const parsed = JSON.parse(stdout)
  assertEquals(parsed.deploy.status, 'error')
  assertEquals(parsed.deploy.statusReason, 'boom')
})

Deno.test('renderDeploy - a refused deploy exits 1 and the JSON says the version is stored', async () => {
  const { exitCode, stdout } = await runStrictDeploy({
    deploy: () => toJsonResponse({ message: 'missing scope' }, 403)
  })
  assertEquals(exitCode, 1)
  const parsed = JSON.parse(stdout)
  assertEquals(parsed.stage, 'deploy')
  assertEquals(parsed.stored, true)
})

Deno.test('renderDeploy - a stored version exits 2', async () => {
  const { exitCode, stdout } = await runStrictDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200)
  })
  assertEquals(exitCode, 2)
  assertEquals(JSON.parse(stdout).stage, 'exists')
})

Deno.test('renderPublishAlias - the notice is on stderr only; stdout is the deploy JSON', async () => {
  await using project = await makeStackProject()
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'my-api' })
  mockProject.toPath = () => project.projectPath
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })
  const args = {
    skmtcRoot,
    projectName: 'my-api',
    token: 'pat-123',
    env: 'staging' as const,
    version: undefined,
    jsonFlag: true
  }

  let alias: Awaited<ReturnType<typeof withCapturedExit>> | undefined
  let deploy: Awaited<ReturnType<typeof withCapturedExit>> | undefined
  await withStackHub({ exists: () => toJsonResponse(stackVersionPayload, 200) }, async () => {
    alias = await withCapturedExit(() => renderPublishAlias(args))
    deploy = await withCapturedExit(() => renderDeploy(args))
  })
  if (!alias || !deploy) throw new Error('expected both runs')

  assertEquals(alias.stderr.split('\n')[0], PUBLISH_ALIAS_NOTICE)
  assertEquals(PUBLISH_ALIAS_NOTICE, '`skmtc publish` is now `skmtc deploy`')
  assertEquals(alias.stdout, deploy.stdout)
  assertEquals(JSON.parse(alias.stdout).stage, 'exists')
  assertEquals(alias.exitCode, deploy.exitCode)
  assertEquals(alias.exitCode, 2)
  assertEquals(deploy.stderr.includes(PUBLISH_ALIAS_NOTICE), false)
})

Deno.test('deploy and publish run the registry check (not in the skip list)', () => {
  assertEquals(COMMANDS_THAT_SKIP_REGISTRY_CHECK.has('deploy'), false)
  assertEquals(COMMANDS_THAT_SKIP_REGISTRY_CHECK.has('publish'), false)
  assertEquals(shouldSkipRegistryCheck(['deploy', 'my-api', '--existing']), false)
  assertEquals(shouldSkipRegistryCheck(['publish', 'my-api']), false)
})

Deno.test('deploy command - descriptor registers --version and --existing', () => {
  const descriptor = getCommandDescriptor('deploy')

  assertEquals(descriptor.agentMode, 'full')
  assertEquals(descriptor.args, ['<project>'])
  const flags = descriptor.flags.map(({ flag }) => flag.split(' ')[0])
  assertEquals(flags.includes('--version'), true)
  assertEquals(flags.includes('--existing'), true)
  assertEquals(descriptor.description.includes('ublish'), false)
})

Deno.test('publish command - descriptor is the deploy alias with the same flags', () => {
  const publish = getCommandDescriptor('publish')
  const deploy = getCommandDescriptor('deploy')

  assertEquals(publish.flags, deploy.flags)
  assertEquals(publish.args, deploy.args)
  assertStringIncludes(publish.description, '`deploy`')
})
