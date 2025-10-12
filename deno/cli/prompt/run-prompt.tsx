import React from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export const runPrompt = async (skmtcRoot: SkmtcRoot) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot,
    session,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  render(<App initialState={initialState} />)
}
