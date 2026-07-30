import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { printPublishResult } from '@/commands/publish.tsx'
import type { PublishHeadlessResult } from '@/lib/publish-headless.ts'
import { getCommandDescriptor } from '@/lib/cli-schema.ts'
import { captureStdout } from '@/tests/strict-mode-helpers.test.ts'

const publishedResult: PublishHeadlessResult = {
  type: 'published',
  projectName: 'my-api',
  sourceHash: 'deadbeef',
  stack: { account: 'acme', slug: 'my-api' },
  version: '3.0.1',
  versionUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1',
  sourceFileCount: 2,
  sourceTotalBytes: 11
}

Deno.test('printPublishResult - text format prints stack@version + version URL', async () => {
  const logs = await captureStdout(async () => {
    printPublishResult(publishedResult, { format: 'text' })
  })

  assertStringIncludes(logs[0], 'Published "my-api" → acme/my-api@3.0.1')
  const output = logs.join('\n')
  assertStringIncludes(output, 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1')
  // The deployment vocabulary is gone — versions are addressed by semver.
  assertEquals(output.includes('shortId'), false)
  assertEquals(output.includes('deployment'), false)
})

Deno.test('printPublishResult - json format emits the result verbatim', async () => {
  const logs = await captureStdout(async () => {
    printPublishResult(publishedResult, { format: 'json' })
  })

  assertEquals(logs.length, 1)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed, publishedResult)
})

Deno.test('printPublishResult - failed result reports the stage and reason', async () => {
  const errors: string[] = []
  const original = console.error
  console.error = (msg: string) => errors.push(msg)
  try {
    printPublishResult(
      {
        type: 'failed',
        projectName: 'my-api',
        reason: 'version 3.0.1 is already published for acme/my-api',
        stage: 'publish'
      },
      { format: 'text' }
    )
  } finally {
    console.error = original
  }

  assertStringIncludes(errors[0], 'Publish failed for "my-api" at publish')
  assertStringIncludes(errors[1], 'already published')
})

Deno.test('publish command - descriptor registers the --version flag', () => {
  const descriptor = getCommandDescriptor('publish')

  assertEquals(descriptor.agentMode, 'full')
  assertEquals(descriptor.args, ['<project>'])
  const versionFlag = descriptor.flags.find(({ flag }) => flag.startsWith('--version'))
  assertEquals(versionFlag !== undefined, true)
})
