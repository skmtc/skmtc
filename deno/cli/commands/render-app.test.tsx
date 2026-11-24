import type React from 'react'
import { assertStringIncludes, assertThrows } from '@std/assert'
import { assertSpyCalls, spy } from '@std/testing/mock'
import type { Instance } from 'ink'
import { renderApp } from '@/commands/render-app.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import type { AppProps } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import { ProjectLoadError } from '@/lib/project-load-error.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'

const AppSpy = (_props: AppProps): React.JSX.Element => 'AppSpy' as unknown as React.JSX.Element

const toState = (view: SkmtcState['view'], skmtcRoot: SkmtcRoot): SkmtcState => ({
  view,
  skmtcRoot,
  message: null,
  interactive: false,
  shortcuts: [],
  generators: []
})

Deno.test('renderApp - a view naming a project that did not load throws before render', () => {
  const skmtcRoot = new SkmtcRoot([], createMockManager(), [
    { name: 'broken', error: new Error('openapi.missing.json not found') }
  ])
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  // Thrown inside render, Ink would print a stack trace and could exit 0.
  const error = assertThrows(
    () =>
      renderApp({
        renderFn: renderSpy as InkRenderFn,
        AppComponent: AppSpy,
        initialState: toState({ page: 'bundle', projectName: 'broken' }, skmtcRoot)
      }),
    ProjectLoadError
  )

  assertStringIncludes(error.message, 'Project "broken" did not load: openapi.missing.json not found')
  assertSpyCalls(renderSpy, 0)
})

Deno.test('renderApp - a view without a project renders', () => {
  const skmtcRoot = new SkmtcRoot([], createMockManager(), [
    { name: 'broken', error: new Error('missing') }
  ])
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  renderApp({
    renderFn: renderSpy as InkRenderFn,
    AppComponent: AppSpy,
    initialState: toState({ page: 'home' }, skmtcRoot)
  })

  assertSpyCalls(renderSpy, 1)
})
