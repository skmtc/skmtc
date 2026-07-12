import type React from 'react'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { printRemoveResult, renderRemove } from './remove.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { assertEquals, assertStringIncludes } from '@std/assert'
import type { RemoveHeadlessResult } from '@/lib/remove-headless.ts'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test('renderRemove - interactive mode mounts the Ink App with the expected state', async () => {
  await withFakeTty(async () => {
    const manager = createMockManager()

    const skmtcRoot = createMockSkmtcRoot(manager)
    const testProjectName = 'test-project'
    const testGenerator = 'my-generator'
    const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)
    const AppSpy = (_props: AppProps): React.JSX.Element => 'AppSpy' as unknown as React.JSX.Element

    await renderRemove({
      skmtcRoot,
      projectName: testProjectName,
      generator: testGenerator,
      renderFn: renderSpy as InkRenderFn,
      AppComponent: AppSpy
    })

    assertSpyCalls(renderSpy, 1)
    assertSpyCall(renderSpy, 0, {
      args: [
        // deno-lint-ignore jsx-key
        <AppSpy
          initialState={{
            view: {
              page: 'remove-generator',
              projectName: testProjectName,
              generatorName: testGenerator
            },
            skmtcRoot,
            message: null,
            interactive: false,
            shortcuts: [],
            generators: []
          }}
        />
      ]
    })
  })
})

Deno.test('printRemoveResult - text format reports removed id + verify hint', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printRemoveResult({ projectName: 'my-api', removed: '@skmtc/gen-zod' }, { format: 'text' })
  } finally {
    console.log = original
  }
  assertEquals(logs, [
    'Removed "@skmtc/gen-zod" from "my-api".',
    '\nVerify with: cat .skmtc/my-api/deno.json'
  ])
})

Deno.test('printRemoveResult - json format emits a parseable object', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printRemoveResult({ projectName: 'my-api', removed: '@skmtc/gen-zod' }, { format: 'json' })
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  const parsed: RemoveHeadlessResult & { verifyWith: string } = JSON.parse(logs[0])
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(parsed.removed, '@skmtc/gen-zod')
})

Deno.test('renderRemove - missing project fails with recipe', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderRemove({
      projectName: undefined,
      generator: '@skmtc/gen-zod',
      noInputFlag: true
    })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <project>')
})

Deno.test('renderRemove - missing generator fails with recipe', async () => {
  // Project-aware discover hint: when the project is known, the
  // recipe points at `skmtc list <project>` so the agent can fetch
  // the candidate set without an extra round-trip.
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderRemove({
      projectName: 'my-api',
      generator: undefined,
      noInputFlag: true
    })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <generator>')
  assertStringIncludes(errors[0], 'skmtc list my-api')
})
